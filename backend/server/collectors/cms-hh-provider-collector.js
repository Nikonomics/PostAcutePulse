/**
 * CMS Home Health Provider Collector
 *
 * Downloads and imports CMS Home Health Compare provider data:
 * - hh_extracts: Tracking which monthly files have been imported
 * - hh_provider_snapshots: Point-in-time quality data for each agency
 * - hh_provider_events: Detected changes (rating changes, new agencies, etc.)
 *
 * Data Source: CMS Home Health Compare
 * URL: https://data.cms.gov/provider-data/dataset/6jpm-sxkc
 */

const axios = require('axios');
const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Market database connection
const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CMS API URL for Home Health Provider data
const CMS_HH_PROVIDER_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0';

// Column mappings from CSV headers to database columns
const HH_PROVIDER_COLUMN_MAPPINGS = {
  'State': 'state',
  'CMS Certification Number (CCN)': 'ccn',
  'Provider Name': 'provider_name',
  'Address': 'address',
  'City/Town': 'city',
  'ZIP Code': 'zip_code',
  'Telephone Number': 'telephone',
  'Type of Ownership': 'ownership_type',
  'Certification Date': 'certification_date',

  // Services offered
  'Offers Nursing Care Services': 'offers_nursing',
  'Offers Physical Therapy Services': 'offers_pt',
  'Offers Occupational Therapy Services': 'offers_ot',
  'Offers Speech Pathology Services': 'offers_speech',
  'Offers Medical Social Services': 'offers_social_work',
  'Offers Home Health Aide Services': 'offers_aide',

  // Quality Star Rating
  'Quality of patient care star rating': 'quality_star_rating',
  'Footnote for quality of patient care star rating': 'quality_star_footnote',

  // Timely Initiation of Care
  'Numerator for how often the home health team began their patients\' care in a timely manner': 'timely_initiation_num',
  'Denominator for how often the home health team began their patients\' care in a timely manner': 'timely_initiation_denom',
  'How often the home health team began their patients\' care in a timely manner': 'timely_initiation_pct',
  'Footnote for how often the home health team began their patients\' care in a timely manner': 'timely_initiation_fn',

  // Flu Shot
  'Numerator for how often the home health team determined whether patients received a flu shot for the current flu season': 'flu_shot_num',
  'Denominator for how often the home health team determined whether patients received a flu shot for the current flu season': 'flu_shot_denom',
  'How often the home health team determined whether patients received a flu shot for the current flu season': 'flu_shot_pct',
  'Footnote for how often the home health team determined whether patients received a flu shot for the current flu season': 'flu_shot_fn',

  // Walking/Ambulation Improvement
  'Numerator for how often patients got better at walking or moving around': 'walking_improvement_num',
  'Denominator for how often patients got better at walking or moving around': 'walking_improvement_denom',
  'How often patients got better at walking or moving around': 'walking_improvement_pct',
  'Footnote for how often patients got better at walking or moving around': 'walking_improvement_fn',

  // Bed Transfer Improvement
  'Numerator for how often patients got better at getting in and out of bed': 'bed_transfer_num',
  'Denominator for how often patients got better at getting in and out of bed': 'bed_transfer_denom',
  'How often patients got better at getting in and out of bed': 'bed_transfer_pct',
  'Footnote for how often patients got better at getting in and out of bed': 'bed_transfer_fn',

  // Bathing Improvement
  'Numerator for how often patients got better at bathing': 'bathing_improvement_num',
  'Denominator for how often patients got better at bathing': 'bathing_improvement_denom',
  'How often patients got better at bathing': 'bathing_improvement_pct',
  'Footnote for how often patients got better at bathing': 'bathing_improvement_fn',

  // Breathing Improvement
  'Numerator for how often patients\' breathing improved': 'breathing_improvement_num',
  'Denominator for how often patients\' breathing improved': 'breathing_improvement_denom',
  'How often patients\' breathing improved': 'breathing_improvement_pct',
  'Footnote for how often patients\' breathing improved': 'breathing_improvement_fn',

  // Medication Compliance
  'Numerator for how often patients got better at taking their drugs correctly by mouth': 'medication_compliance_num',
  'Denominator for how often patients got better at taking their drugs correctly by mouth': 'medication_compliance_denom',
  'How often patients got better at taking their drugs correctly by mouth': 'medication_compliance_pct',
  'Footnote for how often patients got better at taking their drugs correctly by mouth': 'medication_compliance_fn',

  // Pressure Ulcer
  'Numerator for Changes in skin integrity post-acute care: pressure ulcer/injury': 'pressure_ulcer_num',
  'Denominator for Changes in skin integrity post-acute care: pressure ulcer/injury': 'pressure_ulcer_denom',
  'Changes in skin integrity post-acute care: pressure ulcer/injury': 'pressure_ulcer_pct',
  'Footnote Changes in skin integrity post-acute care: pressure ulcer/injury': 'pressure_ulcer_fn',

  // Medication Actions Timely
  'Numerator for how often physician-recommended actions to address medication issues were completely timely': 'medication_actions_num',
  'Denominator for how often physician-recommended actions to address medication issues were completely timely': 'medication_actions_denom',
  'How often physician-recommended actions to address medication issues were completely timely': 'medication_actions_pct',
  'Footnote for how often physician-recommended actions to address medication issues were completely timely': 'medication_actions_fn',

  // Falls with Injury
  'Numerator for Percent of Residents Experiencing One or More Falls with Major Injury': 'falls_injury_num',
  'Denominator for Percent of Residents Experiencing One or More Falls with Major Injury': 'falls_injury_denom',
  'Percent of Residents Experiencing One or More Falls with Major Injury': 'falls_injury_pct',
  'Footnote for Percent of Residents Experiencing One or More Falls with Major Injury': 'falls_injury_fn',

  // Discharge Function Score
  'Numerator for Discharge Function Score': 'discharge_function_num',
  'Denominator for Discharge Function Score': 'discharge_function_denom',
  'Discharge Function Score': 'discharge_function_score',
  'Footnote for Discharge Function Score': 'discharge_function_fn',

  // Health Info to Provider
  'Numerator for Transfer of Health Information to the Provider': 'health_info_provider_num',
  'Denominator for Transfer of Health Information to the Provider': 'health_info_provider_denom',
  'Transfer of Health Information to the Provider': 'health_info_provider_pct',
  'Footnote for Transfer of Health Information to the Provider': 'health_info_provider_fn',

  // Health Info to Patient
  'Numerator for Transfer of Health Information to the Patient': 'health_info_patient_num',
  'Denominator for Transfer of Health Information to the Patient': 'health_info_patient_denom',
  'Transfer of Health Information to the Patient': 'health_info_patient_pct',
  'Footnote for Transfer of Health Information to the Patient': 'health_info_patient_fn',

  // DTC (Discharged to Community)
  'DTC Numerator': 'dtc_num',
  'DTC Denominator': 'dtc_denom',
  'DTC Observed Rate': 'dtc_observed_rate',
  'DTC Risk-Standardized Rate': 'dtc_risk_std_rate',
  'DTC Risk-Standardized Rate (Lower Limit)': 'dtc_risk_std_lower',
  'DTC Risk-Standardized Rate (Upper Limit)': 'dtc_risk_std_upper',
  'DTC Performance Categorization': 'dtc_performance_category',
  'Footnote for DTC Risk-Standardized Rate': 'dtc_fn',

  // PPR (Potentially Preventable Readmissions)
  'PPR Numerator': 'ppr_num',
  'PPR Denominator': 'ppr_denom',
  'PPR Observed Rate': 'ppr_observed_rate',
  'PPR Risk-Standardized Rate': 'ppr_risk_std_rate',
  'PPR Risk-Standardized Rate (Lower Limit)': 'ppr_risk_std_lower',
  'PPR Risk-Standardized Rate (Upper Limit)': 'ppr_risk_std_upper',
  'PPR Performance Categorization': 'ppr_performance_category',
  'Footnote for PPR Risk-Standardized Rate': 'ppr_fn',

  // PPH (Potentially Preventable Hospitalizations)
  'PPH Numerator': 'pph_num',
  'PPH Denominator': 'pph_denom',
  'PPH Observed Rate': 'pph_observed_rate',
  'PPH Risk-Standardized Rate': 'pph_risk_std_rate',
  'PPH Risk-Standardized Rate (Lower Limit)': 'pph_risk_std_lower',
  'PPH Risk-Standardized Rate (Upper Limit)': 'pph_risk_std_upper',
  'PPH Performance Categorization': 'pph_performance_category',
  'Footnote for PPH Risk-Standardized Rate': 'pph_fn',

  // Medicare Spending
  'How much Medicare spends on an episode of care at this agency, compared to Medicare spending across all agencies nationally': 'medicare_spending_ratio',
  'Footnote for how much Medicare spends on an episode of care at this agency, compared to Medicare spending across all agencies nationally': 'medicare_spending_fn',
  'No. of episodes to calc how much Medicare spends per episode of care at agency, compared to spending at all agencies (national)': 'episode_count'
};

/**
 * Parse a CSV row into database format
 */
function parseRow(row) {
  const result = {};

  for (const [csvCol, dbCol] of Object.entries(HH_PROVIDER_COLUMN_MAPPINGS)) {
    let value = row[csvCol];

    if (value === undefined || value === '' || value === '-' || value === null) {
      result[dbCol] = null;
      continue;
    }

    // Clean up values with commas in numbers
    if (typeof value === 'string') {
      value = value.replace(/,/g, '').trim();
    }

    // Integer fields
    const intFields = [
      'timely_initiation_num', 'timely_initiation_denom',
      'flu_shot_num', 'flu_shot_denom',
      'walking_improvement_num', 'walking_improvement_denom',
      'bed_transfer_num', 'bed_transfer_denom',
      'bathing_improvement_num', 'bathing_improvement_denom',
      'breathing_improvement_num', 'breathing_improvement_denom',
      'medication_compliance_num', 'medication_compliance_denom',
      'pressure_ulcer_num', 'pressure_ulcer_denom',
      'medication_actions_num', 'medication_actions_denom',
      'falls_injury_num', 'falls_injury_denom',
      'discharge_function_num', 'discharge_function_denom',
      'health_info_provider_num', 'health_info_provider_denom',
      'health_info_patient_num', 'health_info_patient_denom',
      'dtc_num', 'dtc_denom',
      'ppr_num', 'ppr_denom',
      'pph_num', 'pph_denom',
      'episode_count'
    ];

    // Float fields
    const floatFields = [
      'quality_star_rating',
      'timely_initiation_pct', 'flu_shot_pct',
      'walking_improvement_pct', 'bed_transfer_pct',
      'bathing_improvement_pct', 'breathing_improvement_pct',
      'medication_compliance_pct', 'pressure_ulcer_pct',
      'medication_actions_pct', 'falls_injury_pct',
      'discharge_function_score',
      'health_info_provider_pct', 'health_info_patient_pct',
      'dtc_observed_rate', 'dtc_risk_std_rate', 'dtc_risk_std_lower', 'dtc_risk_std_upper',
      'ppr_observed_rate', 'ppr_risk_std_rate', 'ppr_risk_std_lower', 'ppr_risk_std_upper',
      'pph_observed_rate', 'pph_risk_std_rate', 'pph_risk_std_lower', 'pph_risk_std_upper',
      'medicare_spending_ratio'
    ];

    // Boolean fields
    const boolFields = [
      'offers_nursing', 'offers_pt', 'offers_ot',
      'offers_speech', 'offers_social_work', 'offers_aide'
    ];

    if (intFields.includes(dbCol)) {
      result[dbCol] = value ? parseInt(value, 10) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else if (floatFields.includes(dbCol)) {
      result[dbCol] = value ? parseFloat(value) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else if (boolFields.includes(dbCol)) {
      result[dbCol] = value === 'Yes' || value === 'Y' || value === 'TRUE' || value === '1';
    }
    else if (dbCol === 'certification_date') {
      if (value) {
        const date = new Date(value);
        result[dbCol] = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      } else {
        result[dbCol] = null;
      }
    }
    else {
      result[dbCol] = value;
    }
  }

  return result;
}

/**
 * Create or get extract record for a given date
 */
async function getOrCreateExtract(extractDate, sourceFile = null) {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT extract_id, import_status FROM hh_extracts WHERE extract_date = $1',
      [extractDate]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const result = await client.query(
      `INSERT INTO hh_extracts (extract_date, source_file, import_status)
       VALUES ($1, $2, 'pending')
       RETURNING extract_id, import_status`,
      [extractDate, sourceFile]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Update extract status
 */
async function updateExtractStatus(extractId, status, recordCount = null) {
  const client = await pool.connect();
  try {
    const updates = ['import_status = $2'];
    const params = [extractId, status];
    let paramIdx = 3;

    if (recordCount !== null) {
      updates.push(`record_count = $${paramIdx}`);
      params.push(recordCount);
      paramIdx++;
    }

    if (status === 'importing') {
      updates.push('import_started_at = NOW()');
    } else if (status === 'completed' || status === 'failed') {
      updates.push('import_completed_at = NOW()');
    }

    await client.query(
      `UPDATE hh_extracts SET ${updates.join(', ')} WHERE extract_id = $1`,
      params
    );
  } finally {
    client.release();
  }
}

/**
 * Import provider data from parsed rows using multi-row inserts
 * Much faster than individual inserts (24 round-trips vs 12,000)
 */
async function importProviderData(extractId, data) {
  const BATCH_SIZE = 500;
  let recordCount = 0;

  // Define the columns we'll insert (fixed order for multi-row insert)
  const columns = [
    'extract_id', 'ccn', 'state', 'provider_name', 'address', 'city', 'zip_code',
    'telephone', 'ownership_type', 'certification_date',
    'offers_nursing', 'offers_pt', 'offers_ot', 'offers_speech', 'offers_social_work', 'offers_aide',
    'quality_star_rating', 'quality_star_footnote',
    'timely_initiation_num', 'timely_initiation_denom', 'timely_initiation_pct',
    'flu_shot_num', 'flu_shot_denom', 'flu_shot_pct',
    'walking_improvement_num', 'walking_improvement_denom', 'walking_improvement_pct',
    'bed_transfer_num', 'bed_transfer_denom', 'bed_transfer_pct',
    'bathing_improvement_num', 'bathing_improvement_denom', 'bathing_improvement_pct',
    'breathing_improvement_num', 'breathing_improvement_denom', 'breathing_improvement_pct',
    'medication_compliance_num', 'medication_compliance_denom', 'medication_compliance_pct',
    'pressure_ulcer_num', 'pressure_ulcer_denom', 'pressure_ulcer_pct',
    'medication_actions_num', 'medication_actions_denom', 'medication_actions_pct',
    'falls_injury_num', 'falls_injury_denom', 'falls_injury_pct',
    'discharge_function_num', 'discharge_function_denom', 'discharge_function_score',
    'health_info_provider_num', 'health_info_provider_denom', 'health_info_provider_pct',
    'health_info_patient_num', 'health_info_patient_denom', 'health_info_patient_pct',
    'dtc_num', 'dtc_denom', 'dtc_observed_rate', 'dtc_risk_std_rate', 'dtc_performance_category',
    'ppr_num', 'ppr_denom', 'ppr_observed_rate', 'ppr_risk_std_rate', 'ppr_performance_category',
    'pph_num', 'pph_denom', 'pph_observed_rate', 'pph_risk_std_rate', 'pph_performance_category',
    'medicare_spending_ratio', 'episode_count'
  ];

  // Process in batches
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const rows = [];
    const values = [];
    let paramIndex = 1;

    for (const row of batch) {
      const parsed = parseRow(row);
      if (!parsed.ccn || !parsed.state) continue;

      // Build value placeholders for this row
      const rowPlaceholders = [];
      rowPlaceholders.push(`$${paramIndex++}`); // extract_id
      values.push(extractId);

      for (const col of columns.slice(1)) { // skip extract_id
        rowPlaceholders.push(`$${paramIndex++}`);
        values.push(parsed[col] !== undefined ? parsed[col] : null);
      }

      rows.push(`(${rowPlaceholders.join(', ')})`);
      recordCount++;
    }

    if (rows.length === 0) continue;

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO hh_provider_snapshots (${columns.join(', ')})
         VALUES ${rows.join(', ')}
         ON CONFLICT (extract_id, ccn) DO UPDATE SET
           provider_name = EXCLUDED.provider_name,
           quality_star_rating = EXCLUDED.quality_star_rating,
           ownership_type = EXCLUDED.ownership_type`,
        values
      );
      console.log(`  Inserted batch: ${recordCount} agencies so far...`);
    } finally {
      client.release();
    }
  }

  return recordCount;
}

/**
 * Import from a CSV file
 */
async function importFromCSV(filePath, extractDate) {
  console.log(`Importing Home Health providers from: ${filePath}`);

  const extract = await getOrCreateExtract(extractDate, path.basename(filePath));

  if (extract.import_status === 'completed') {
    console.log('This extract has already been imported');
    return extract.extract_id;
  }

  await updateExtractStatus(extract.extract_id, 'importing');

  const data = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', async () => {
        try {
          const recordCount = await importProviderData(extract.extract_id, data);
          await updateExtractStatus(extract.extract_id, 'completed', recordCount);

          console.log(`Import completed: ${recordCount} agencies`);
          resolve(extract.extract_id);
        } catch (error) {
          await updateExtractStatus(extract.extract_id, 'failed');
          reject(error);
        }
      })
      .on('error', async (error) => {
        await updateExtractStatus(extract.extract_id, 'failed');
        reject(error);
      });
  });
}

/**
 * Detect rating changes between two extracts
 */
async function detectRatingChanges(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting rating changes between extracts ${previousExtractId} and ${currentExtractId}...`);

    const result = await client.query(`
      INSERT INTO hh_provider_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        previous_value, new_value, change_magnitude, state
      )
      SELECT
        curr.ccn,
        'RATING_CHANGE',
        $1,
        $2,
        $3,
        prev.quality_star_rating::text,
        curr.quality_star_rating::text,
        (curr.quality_star_rating - prev.quality_star_rating)::decimal,
        curr.state
      FROM hh_provider_snapshots curr
      JOIN hh_provider_snapshots prev ON curr.ccn = prev.ccn
      WHERE curr.extract_id = $3
        AND prev.extract_id = $2
        AND curr.quality_star_rating IS DISTINCT FROM prev.quality_star_rating
        AND curr.quality_star_rating IS NOT NULL
        AND prev.quality_star_rating IS NOT NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} rating changes`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Detect new agencies
 */
async function detectNewAgencies(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting new agencies in extract ${currentExtractId}...`);

    const result = await client.query(`
      INSERT INTO hh_provider_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        new_value, state
      )
      SELECT
        curr.ccn,
        'NEW_AGENCY',
        $1,
        $2,
        $3,
        curr.provider_name,
        curr.state
      FROM hh_provider_snapshots curr
      LEFT JOIN hh_provider_snapshots prev ON curr.ccn = prev.ccn AND prev.extract_id = $2
      WHERE curr.extract_id = $3
        AND prev.ccn IS NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} new agencies`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Detect closed agencies
 */
async function detectClosedAgencies(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting closed agencies...`);

    const result = await client.query(`
      INSERT INTO hh_provider_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        previous_value, state
      )
      SELECT
        prev.ccn,
        'AGENCY_CLOSED',
        $1,
        $2,
        $3,
        prev.provider_name,
        prev.state
      FROM hh_provider_snapshots prev
      LEFT JOIN hh_provider_snapshots curr ON prev.ccn = curr.ccn AND curr.extract_id = $3
      WHERE prev.extract_id = $2
        AND curr.ccn IS NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} closed agencies`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Detect ownership changes
 */
async function detectOwnershipChanges(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting ownership changes...`);

    const result = await client.query(`
      INSERT INTO hh_provider_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        previous_value, new_value, state
      )
      SELECT
        curr.ccn,
        'OWNERSHIP_CHANGE',
        $1,
        $2,
        $3,
        prev.ownership_type,
        curr.ownership_type,
        curr.state
      FROM hh_provider_snapshots curr
      JOIN hh_provider_snapshots prev ON curr.ccn = prev.ccn
      WHERE curr.extract_id = $3
        AND prev.extract_id = $2
        AND curr.ownership_type IS DISTINCT FROM prev.ownership_type
        AND curr.ownership_type IS NOT NULL
        AND prev.ownership_type IS NOT NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} ownership changes`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Run all event detection between two extracts
 */
async function detectAllEvents(currentExtractId, previousExtractId, extractDate) {
  let totalEvents = 0;

  totalEvents += await detectRatingChanges(currentExtractId, previousExtractId, extractDate);
  totalEvents += await detectNewAgencies(currentExtractId, previousExtractId, extractDate);
  totalEvents += await detectClosedAgencies(currentExtractId, previousExtractId, extractDate);
  totalEvents += await detectOwnershipChanges(currentExtractId, previousExtractId, extractDate);

  console.log(`Total events detected: ${totalEvents}`);
  return totalEvents;
}

/**
 * Get summary statistics
 */
async function getSummary() {
  const client = await pool.connect();
  try {
    const extractsResult = await client.query(`
      SELECT COUNT(*) as extract_count,
             MIN(extract_date) as earliest,
             MAX(extract_date) as latest,
             SUM(record_count) as total_records
      FROM hh_extracts
      WHERE import_status = 'completed'
    `);

    const eventsResult = await client.query(`
      SELECT event_type, COUNT(*) as count
      FROM hh_provider_events
      GROUP BY event_type
      ORDER BY count DESC
    `);

    const stateResult = await client.query(`
      SELECT state, COUNT(*) as agency_count, AVG(quality_star_rating) as avg_rating
      FROM hh_provider_snapshots
      WHERE extract_id = (SELECT MAX(extract_id) FROM hh_extracts WHERE import_status = 'completed')
      GROUP BY state
      ORDER BY agency_count DESC
      LIMIT 10
    `);

    return {
      extracts: extractsResult.rows[0],
      events: eventsResult.rows,
      topStates: stateResult.rows
    };
  } finally {
    client.release();
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('CMS Home Health Provider Collector');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case 'csv':
        const csvPath = args[1];
        const csvDate = args[2];
        if (!csvPath || !csvDate) {
          console.log('Usage: node cms-hh-provider-collector.js csv <file.csv> <YYYY-MM-DD>');
          break;
        }
        await importFromCSV(csvPath, csvDate);
        break;

      case 'detect':
        const currId = parseInt(args[1]);
        const prevId = parseInt(args[2]);
        const eventDate = args[3];
        if (!currId || !prevId || !eventDate) {
          console.log('Usage: node cms-hh-provider-collector.js detect <current_extract_id> <previous_extract_id> <date>');
          break;
        }
        await detectAllEvents(currId, prevId, eventDate);
        break;

      case 'summary':
        const summary = await getSummary();
        console.log('\nDatabase Summary:');
        console.log('Extracts:', summary.extracts);
        console.log('\nEvent Types:');
        console.table(summary.events);
        console.log('\nTop States by Agency Count:');
        console.table(summary.topStates);
        break;

      case 'help':
      default:
        console.log(`
Usage: node cms-hh-provider-collector.js <command> [options]

Commands:
  csv <file> <date>              Import from CSV file with extract date (YYYY-MM-DD)
  detect <cur> <prev> <date>     Detect events between two extracts
  summary                        Show database summary

Examples:
  node cms-hh-provider-collector.js csv ./HH_Provider_Oct2025.csv 2025-10-01
  node cms-hh-provider-collector.js detect 2 1 2025-10-01
  node cms-hh-provider-collector.js summary
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for use as module
module.exports = {
  importFromCSV,
  detectAllEvents,
  getSummary,
  getOrCreateExtract,
  importProviderData
};

// Run if called directly
if (require.main === module) {
  main();
}
