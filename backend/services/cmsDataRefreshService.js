/**
 * CMS Data Refresh Service
 *
 * Handles monthly updates of CMS data from data.cms.gov API:
 * - SNF Facilities (Nursing Home Compare)
 * - Facility Deficiencies
 * - Ratings and Quality Measures
 *
 * CMS updates data monthly. This service:
 * 1. Checks if data needs refreshing (>30 days since last update)
 * 2. Fetches updated data from CMS API
 * 3. Updates local snf_news database
 * 4. Logs refresh history
 */

const { Pool } = require('pg');
// Use native fetch (Node.js 18+) - no need for node-fetch

// CMS API endpoints
const CMS_API_BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query';
const DATASETS = {
  facilities: {
    id: '4pq5-n9py',
    name: 'Nursing Home Compare - Provider Information',
    description: 'SNF facility information including ratings, beds, ownership'
  },
  deficiencies: {
    id: 'r5ix-sfxw',
    name: 'Health Deficiencies',
    description: 'Facility deficiency records from surveys'
  }
};

// US State codes for state-by-state fetching
const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Database connection
const getPool = () => {
  const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
  const isProduction = connectionString.includes('render.com');

  return new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
};

let pool = null;
const getPoolInstance = () => {
  if (!pool) {
    pool = getPool();
  }
  return pool;
};

/**
 * Check if data needs refreshing
 * Returns true if last refresh was more than 30 days ago
 */
async function needsRefresh(datasetName, refreshIntervalDays = 30) {
  const db = getPoolInstance();

  try {
    const result = await db.query(`
      SELECT completed_at
      FROM data_refresh_log
      WHERE dataset_name = $1 AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `, [datasetName]);

    if (result.rows.length === 0) {
      return { needsRefresh: true, lastRefresh: null, daysSinceRefresh: null };
    }

    const lastRefresh = new Date(result.rows[0].completed_at);
    const daysSinceRefresh = Math.floor((Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24));

    return {
      needsRefresh: daysSinceRefresh >= refreshIntervalDays,
      lastRefresh,
      daysSinceRefresh
    };
  } catch (error) {
    console.error('Error checking refresh status:', error);
    return { needsRefresh: true, lastRefresh: null, daysSinceRefresh: null, error: error.message };
  }
}

/**
 * Get refresh status for all datasets
 */
async function getRefreshStatus() {
  const db = getPoolInstance();

  try {
    // Get latest successful refresh for each dataset
    const latestRefreshes = await db.query(`
      SELECT DISTINCT ON (dataset_name)
        dataset_name,
        completed_at,
        records_updated,
        records_inserted,
        status
      FROM data_refresh_log
      WHERE status = 'completed'
      ORDER BY dataset_name, completed_at DESC
    `);

    // Get currently running refreshes
    const runningRefreshes = await db.query(`
      SELECT dataset_name, started_at, status
      FROM data_refresh_log
      WHERE status = 'running'
    `);

    // Get last CMS update dates from facilities
    const facilityDates = await db.query(`
      SELECT
        MAX(last_cms_update) as last_cms_update,
        MAX(updated_at) as last_db_update,
        COUNT(*) as total_facilities
      FROM snf_facilities
    `);

    // Get deficiency date range
    const deficiencyDates = await db.query(`
      SELECT
        MIN(survey_date) as earliest_survey,
        MAX(survey_date) as latest_survey,
        COUNT(*) as total_deficiencies
      FROM cms_facility_deficiencies
    `);

    const datasets = {
      facilities: {
        name: DATASETS.facilities.name,
        lastRefresh: null,
        daysSinceRefresh: null,
        recordCount: parseInt(facilityDates.rows[0]?.total_facilities) || 0,
        lastCmsUpdate: facilityDates.rows[0]?.last_cms_update,
        status: 'idle'
      },
      deficiencies: {
        name: DATASETS.deficiencies.name,
        lastRefresh: null,
        daysSinceRefresh: null,
        recordCount: parseInt(deficiencyDates.rows[0]?.total_deficiencies) || 0,
        dateRange: {
          earliest: deficiencyDates.rows[0]?.earliest_survey,
          latest: deficiencyDates.rows[0]?.latest_survey
        },
        status: 'idle'
      }
    };

    // Update with refresh log data
    for (const row of latestRefreshes.rows) {
      const key = row.dataset_name.replace('cms_', '').replace('snf_', '');
      if (datasets[key]) {
        datasets[key].lastRefresh = row.completed_at;
        datasets[key].daysSinceRefresh = Math.floor(
          (Date.now() - new Date(row.completed_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        datasets[key].lastRecordsUpdated = row.records_updated;
        datasets[key].lastRecordsInserted = row.records_inserted;
      }
    }

    // Mark running datasets
    for (const row of runningRefreshes.rows) {
      const key = row.dataset_name.replace('cms_', '').replace('snf_', '');
      if (datasets[key]) {
        datasets[key].status = 'running';
        datasets[key].startedAt = row.started_at;
      }
    }

    // Determine if refresh is needed
    const REFRESH_INTERVAL_DAYS = 30;
    for (const key of Object.keys(datasets)) {
      const ds = datasets[key];
      ds.needsRefresh = ds.daysSinceRefresh === null || ds.daysSinceRefresh >= REFRESH_INTERVAL_DAYS;
    }

    return {
      datasets,
      refreshIntervalDays: REFRESH_INTERVAL_DAYS,
      cmsUpdateFrequency: 'Monthly'
    };

  } catch (error) {
    console.error('Error getting refresh status:', error);
    throw error;
  }
}

/**
 * Start a refresh log entry
 */
async function startRefreshLog(datasetName, refreshType = 'full') {
  const db = getPoolInstance();

  const result = await db.query(`
    INSERT INTO data_refresh_log (dataset_name, refresh_type, status)
    VALUES ($1, $2, 'running')
    RETURNING id
  `, [datasetName, refreshType]);

  return result.rows[0].id;
}

/**
 * Update refresh log on completion
 */
async function completeRefreshLog(logId, stats) {
  const db = getPoolInstance();

  await db.query(`
    UPDATE data_refresh_log
    SET
      completed_at = CURRENT_TIMESTAMP,
      status = $2,
      records_fetched = $3,
      records_updated = $4,
      records_inserted = $5,
      error_count = $6,
      error_message = $7,
      metadata = $8
    WHERE id = $1
  `, [
    logId,
    stats.status || 'completed',
    stats.recordsFetched || 0,
    stats.recordsUpdated || 0,
    stats.recordsInserted || 0,
    stats.errorCount || 0,
    stats.errorMessage || null,
    JSON.stringify(stats.metadata || {})
  ]);
}

/**
 * Fetch facilities from CMS API
 */
async function fetchCMSFacilities(limit = 1000, offset = 0) {
  const url = `${CMS_API_BASE}/${DATASETS.facilities.id}/0?limit=${limit}&offset=${offset}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CMS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Fetch deficiencies from CMS API for a specific state
 */
async function fetchCMSDeficiencies(stateCode, limit = 1000, offset = 0) {
  const url = `${CMS_API_BASE}/${DATASETS.deficiencies.id}/0?filters[state_cd]=${stateCode}&limit=${limit}&offset=${offset}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CMS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Parse numeric values safely
 */
function parseNum(val) {
  if (val === null || val === undefined || val === '' || val === 'N/A') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function parseIntSafe(val) {
  const num = parseNum(val);
  return num === null ? null : Math.floor(num);
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '' || dateStr === 'N/A') return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Upsert a facility record
 */
async function upsertFacility(db, cmsRecord) {
  const query = `
    INSERT INTO snf_facilities (
      federal_provider_number,
      cms_certification_number,
      facility_name,
      address,
      city,
      state,
      zip_code,
      county,
      phone,
      ownership_type,
      provider_type,
      legal_business_name,
      parent_organization,
      ownership_chain,
      multi_facility_chain,
      total_beds,
      certified_beds,
      occupied_beds,
      occupancy_rate,
      overall_rating,
      health_inspection_rating,
      quality_measure_rating,
      staffing_rating,
      rn_staffing_hours,
      total_nurse_staffing_hours,
      reported_cna_staffing_hours,
      accepts_medicare,
      accepts_medicaid,
      special_focus_facility,
      abuse_icon,
      continuing_care_retirement_community,
      active,
      date_certified,
      certification_status,
      data_source,
      last_cms_update,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35, CURRENT_DATE, CURRENT_TIMESTAMP
    )
    ON CONFLICT (federal_provider_number) DO UPDATE SET
      facility_name = EXCLUDED.facility_name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip_code = EXCLUDED.zip_code,
      county = EXCLUDED.county,
      phone = EXCLUDED.phone,
      ownership_type = EXCLUDED.ownership_type,
      provider_type = EXCLUDED.provider_type,
      legal_business_name = EXCLUDED.legal_business_name,
      parent_organization = EXCLUDED.parent_organization,
      ownership_chain = EXCLUDED.ownership_chain,
      multi_facility_chain = EXCLUDED.multi_facility_chain,
      total_beds = EXCLUDED.total_beds,
      certified_beds = EXCLUDED.certified_beds,
      occupied_beds = EXCLUDED.occupied_beds,
      occupancy_rate = EXCLUDED.occupancy_rate,
      overall_rating = EXCLUDED.overall_rating,
      health_inspection_rating = EXCLUDED.health_inspection_rating,
      quality_measure_rating = EXCLUDED.quality_measure_rating,
      staffing_rating = EXCLUDED.staffing_rating,
      rn_staffing_hours = EXCLUDED.rn_staffing_hours,
      total_nurse_staffing_hours = EXCLUDED.total_nurse_staffing_hours,
      reported_cna_staffing_hours = EXCLUDED.reported_cna_staffing_hours,
      accepts_medicare = EXCLUDED.accepts_medicare,
      accepts_medicaid = EXCLUDED.accepts_medicaid,
      special_focus_facility = EXCLUDED.special_focus_facility,
      abuse_icon = EXCLUDED.abuse_icon,
      continuing_care_retirement_community = EXCLUDED.continuing_care_retirement_community,
      active = EXCLUDED.active,
      date_certified = EXCLUDED.date_certified,
      certification_status = EXCLUDED.certification_status,
      last_cms_update = CURRENT_DATE,
      updated_at = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) as inserted
  `;

  // Calculate occupancy rate
  const beds = parseIntSafe(cmsRecord.number_of_certified_beds);
  const residents = parseIntSafe(cmsRecord.average_number_of_residents_per_day);
  const occupancyRate = beds && residents ? parseNum((residents / beds * 100).toFixed(2)) : null;

  const values = [
    cmsRecord.cms_certification_number_ccn,
    cmsRecord.cms_certification_number_ccn,
    cmsRecord.provider_name,
    cmsRecord.provider_address,
    cmsRecord.citytown,
    cmsRecord.state,
    cmsRecord.zip_code,
    cmsRecord.countyparish,
    cmsRecord.telephone_number || null,
    cmsRecord.ownership_type,
    cmsRecord.provider_type || 'Skilled Nursing Facility',
    cmsRecord.legal_business_name || cmsRecord.provider_name,
    cmsRecord.chain_name || null,
    cmsRecord.chain_name || null,
    cmsRecord.chain_id ? true : false,
    parseIntSafe(cmsRecord.number_of_certified_beds),
    parseIntSafe(cmsRecord.number_of_certified_beds),
    parseIntSafe(cmsRecord.average_number_of_residents_per_day),
    occupancyRate,
    parseIntSafe(cmsRecord.overall_rating),
    parseIntSafe(cmsRecord.health_inspection_rating),
    parseIntSafe(cmsRecord.qm_rating),
    parseIntSafe(cmsRecord.staffing_rating),
    parseNum(cmsRecord.reported_rn_staffing_hours_per_resident_per_day),
    parseNum(cmsRecord.reported_total_nurse_staffing_hours_per_resident_per_day),
    parseNum(cmsRecord.reported_nurse_aide_staffing_hours_per_resident_per_day),
    true, // accepts_medicare
    true, // accepts_medicaid
    cmsRecord.special_focus_status === 'Y',
    cmsRecord.abuse_icon === 'Y',
    cmsRecord.continuing_care_retirement_community === 'Y',
    true, // active
    parseDate(cmsRecord.date_first_approved_to_provide_medicare_and_medicaid_services),
    'Active',
    'CMS Nursing Home Compare'
  ];

  const result = await db.query(query, values);
  return result.rows[0]?.inserted;
}

/**
 * Upsert a deficiency record
 */
async function upsertDeficiency(db, cmsRecord) {
  const providerNumber = cmsRecord.PROVNUM || cmsRecord.federal_provider_number || cmsRecord.cms_certification_number_ccn;
  const surveyDate = parseDate(cmsRecord.SURVEY_DATE || cmsRecord.survey_date);
  const deficiencyTag = cmsRecord.deficiency_tag_number || cmsRecord.DEFICIENCY_TAG_NUMBER || cmsRecord.deficiency_tag || cmsRecord.TAG || cmsRecord.tag;

  if (!providerNumber || !surveyDate || !deficiencyTag) {
    return null; // Skip incomplete records
  }

  const query = `
    INSERT INTO cms_facility_deficiencies (
      federal_provider_number,
      survey_date,
      survey_type,
      deficiency_tag,
      deficiency_prefix,
      scope_severity,
      deficiency_text,
      correction_date,
      is_corrected
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  const values = [
    providerNumber,
    surveyDate,
    cmsRecord.SURVEY_TYPE || cmsRecord.survey_type || 'Health',
    deficiencyTag,
    cmsRecord.deficiency_prefix || cmsRecord.DEFICIENCY_PREFIX || (deficiencyTag || '').charAt(0) || 'F',
    cmsRecord.scope_severity_code || cmsRecord.SCOPE_SEVERITY_CODE || cmsRecord.scope_severity || cmsRecord.SCOPE_SEVERITY || null,
    cmsRecord.deficiency_description || cmsRecord.DEFICIENCY_DESCRIPTION || cmsRecord.deficiency_text || null,
    parseDate(cmsRecord.CORRECTION_DATE || cmsRecord.correction_date),
    !!(cmsRecord.CORRECTION_DATE || cmsRecord.correction_date)
  ];

  const result = await db.query(query, values);
  return result.rows.length > 0;
}

/**
 * Refresh SNF facilities data
 */
async function refreshFacilities(progressCallback = null) {
  const db = getPoolInstance();
  const logId = await startRefreshLog('snf_facilities', 'full');

  const stats = {
    recordsFetched: 0,
    recordsUpdated: 0,
    recordsInserted: 0,
    errorCount: 0,
    errors: []
  };

  try {
    console.log('Starting SNF facilities refresh from CMS...');

    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const batch = await fetchCMSFacilities(batchSize, offset);

      if (batch.length === 0) {
        hasMore = false;
        continue;
      }

      stats.recordsFetched += batch.length;

      for (const record of batch) {
        try {
          const inserted = await upsertFacility(db, record);
          if (inserted) {
            stats.recordsInserted++;
          } else {
            stats.recordsUpdated++;
          }
        } catch (error) {
          stats.errorCount++;
          if (stats.errors.length < 10) {
            stats.errors.push(error.message);
          }
        }
      }

      offset += batchSize;

      if (progressCallback) {
        progressCallback({
          dataset: 'facilities',
          fetched: stats.recordsFetched,
          updated: stats.recordsUpdated,
          inserted: stats.recordsInserted,
          errors: stats.errorCount
        });
      }

      console.log(`  Processed ${stats.recordsFetched} facilities...`);

      if (batch.length < batchSize) {
        hasMore = false;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    stats.status = 'completed';
    console.log(`Facilities refresh complete: ${stats.recordsFetched} fetched, ${stats.recordsInserted} inserted, ${stats.recordsUpdated} updated`);

  } catch (error) {
    stats.status = 'failed';
    stats.errorMessage = error.message;
    console.error('Facilities refresh failed:', error);
  }

  await completeRefreshLog(logId, stats);
  return stats;
}

/**
 * Refresh deficiencies data
 */
async function refreshDeficiencies(progressCallback = null) {
  const db = getPoolInstance();
  const logId = await startRefreshLog('cms_deficiencies', 'full');

  const stats = {
    recordsFetched: 0,
    recordsUpdated: 0,
    recordsInserted: 0,
    errorCount: 0,
    statesProcessed: 0,
    errors: []
  };

  try {
    console.log('Starting deficiencies refresh from CMS...');
    console.log('Note: Fetching state-by-state to avoid 2GB+ full dataset download');

    for (const stateCode of STATE_CODES) {
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      let stateRecords = 0;

      while (hasMore) {
        try {
          const batch = await fetchCMSDeficiencies(stateCode, batchSize, offset);

          if (batch.length === 0) {
            hasMore = false;
            continue;
          }

          stats.recordsFetched += batch.length;
          stateRecords += batch.length;

          for (const record of batch) {
            try {
              const inserted = await upsertDeficiency(db, record);
              if (inserted) {
                stats.recordsInserted++;
              }
            } catch (error) {
              stats.errorCount++;
              if (stats.errors.length < 10) {
                stats.errors.push(`${stateCode}: ${error.message}`);
              }
            }
          }

          offset += batchSize;

          if (batch.length < batchSize) {
            hasMore = false;
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`  Error fetching ${stateCode}: ${error.message}`);
          hasMore = false;
        }
      }

      stats.statesProcessed++;
      console.log(`  ${stateCode}: ${stateRecords} deficiencies (${stats.statesProcessed}/${STATE_CODES.length} states)`);

      if (progressCallback) {
        progressCallback({
          dataset: 'deficiencies',
          state: stateCode,
          statesProcessed: stats.statesProcessed,
          totalStates: STATE_CODES.length,
          fetched: stats.recordsFetched,
          inserted: stats.recordsInserted,
          errors: stats.errorCount
        });
      }

      // Longer pause between states
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    stats.status = 'completed';
    console.log(`Deficiencies refresh complete: ${stats.recordsFetched} fetched, ${stats.recordsInserted} inserted`);

  } catch (error) {
    stats.status = 'failed';
    stats.errorMessage = error.message;
    console.error('Deficiencies refresh failed:', error);
  }

  await completeRefreshLog(logId, stats);
  return stats;
}

/**
 * Refresh all CMS data
 */
async function refreshAllData(progressCallback = null) {
  console.log('============================================================');
  console.log('  CMS DATA REFRESH - Starting full refresh');
  console.log('============================================================');

  const results = {
    facilities: null,
    deficiencies: null,
    startedAt: new Date(),
    completedAt: null
  };

  // Refresh facilities first
  console.log('\n--- Refreshing SNF Facilities ---');
  results.facilities = await refreshFacilities(progressCallback);

  // Then refresh deficiencies
  console.log('\n--- Refreshing Deficiencies ---');
  results.deficiencies = await refreshDeficiencies(progressCallback);

  results.completedAt = new Date();

  console.log('\n============================================================');
  console.log('  CMS DATA REFRESH - Complete');
  console.log('============================================================');
  console.log(`  Duration: ${Math.round((results.completedAt - results.startedAt) / 1000 / 60)} minutes`);
  console.log(`  Facilities: ${results.facilities.recordsFetched} fetched`);
  console.log(`  Deficiencies: ${results.deficiencies.recordsFetched} fetched`);
  console.log('============================================================\n');

  return results;
}

/**
 * Check if automatic refresh should run
 * Called by cron job or on app startup
 */
async function checkAndRefreshIfNeeded() {
  const status = await getRefreshStatus();

  const needsUpdate = [];

  if (status.datasets.facilities.needsRefresh) {
    needsUpdate.push('facilities');
  }
  if (status.datasets.deficiencies.needsRefresh) {
    needsUpdate.push('deficiencies');
  }

  if (needsUpdate.length === 0) {
    console.log('CMS data is up to date - no refresh needed');
    return { refreshed: false, status };
  }

  console.log(`CMS data needs refresh: ${needsUpdate.join(', ')}`);

  const results = await refreshAllData();

  return {
    refreshed: true,
    results,
    status: await getRefreshStatus()
  };
}

module.exports = {
  getRefreshStatus,
  needsRefresh,
  refreshFacilities,
  refreshDeficiencies,
  refreshAllData,
  checkAndRefreshIfNeeded,
  DATASETS,
  STATE_CODES
};
