import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform',
  ssl: { rejectUnauthorized: false }
});

const HISTORICAL_DIR = process.env.HOME + '/Desktop/cms_historical_data';
const CURRENT_DATA_DIR = process.env.HOME + '/Downloads/nursing_homes_including_rehab_services_12_2025';
const TEMP_DIR = '/tmp/cms_import';

// Column mappings: { dbColumn: [possibleCSVNames] }
// Includes both new format (2023+) and old format (2020-2022)
const PROVIDER_COLUMN_MAP = {
  ccn: ['CMS Certification Number (CCN)', 'Federal Provider Number', 'PROVNUM'],
  provider_name: ['Provider Name', 'Provname', 'PROVNAME'],
  address: ['Provider Address', 'Address', 'ADDRESS'],
  city: ['City/Town', 'City', 'CITY'],
  state: ['State', 'STATE', 'Provider State'],
  zip_code: ['ZIP Code', 'Zip Code', 'ZIP'],
  county: ['County/Parish', 'County Name', 'County_name'],
  phone: ['Telephone Number', 'Phone', 'PHONE'],
  latitude: ['Latitude', 'LAT'],
  longitude: ['Longitude', 'LONG'],
  ownership_type: ['Ownership Type', 'OWNERSHIP'],
  provider_type: ['Provider Type', 'CERTIFICATION'],
  certified_beds: ['Number of Certified Beds', 'Certified Beds', 'BEDCERT'],
  average_residents_per_day: ['Average Number of Residents per Day', 'RESTOT'],
  is_urban: ['Urban'],
  is_hospital_based: ['Provider Resides in Hospital', 'INHOSP'],
  legal_business_name: ['Legal Business Name', 'LBN'],
  date_first_approved: ['Date First Approved to Provide Medicare and Medicaid Services', 'PARTICIPATION_DATE'],
  chain_name: ['Chain Name', 'Chain Organization Name'],
  chain_id: ['Chain ID'],
  facilities_in_chain: ['Number of Facilities in Chain'],
  chain_avg_overall_rating: ['Chain Average Overall 5-star Rating'],
  chain_avg_health_rating: ['Chain Average Health Inspection Rating'],
  chain_avg_staffing_rating: ['Chain Average Staffing Rating'],
  chain_avg_qm_rating: ['Chain Average QM Rating'],
  is_ccrc: ['Continuing Care Retirement Community', 'CCRC_FACIL'],
  special_focus_status: ['Special Focus Status', 'Special Focus Facility', 'SFFStatus'],
  has_abuse_icon: ['Abuse Icon', 'ABUSE_ICON'],
  has_recent_ownership_change: ['Provider Changed Ownership in Last 12 Months', 'CHOW_LAST_12MOS'],
  has_resident_family_council: ['With a Resident and Family Council', 'RESFAMCOUNCIL'],
  has_sprinkler_system: ['Automatic Sprinkler Systems in All Required Areas', 'SPRINKLER_STATUS'],
  overall_rating: ['Overall Rating', 'Overall_Rating'],
  health_inspection_rating: ['Health Inspection Rating', 'SURVEY_RATING'],
  qm_rating: ['QM Rating', 'Quality_Rating'],
  long_stay_qm_rating: ['Long-Stay QM Rating', 'LS_Quality_Rating'],
  short_stay_qm_rating: ['Short-Stay QM Rating', 'SS_Quality_Rating'],
  staffing_rating: ['Staffing Rating', 'STAFFING_RATING'],
  reported_na_hrs: ['Reported Nurse Aide Staffing Hours per Resident per Day'],
  reported_lpn_hrs: ['Reported LPN Staffing Hours per Resident per Day'],
  reported_rn_hrs: ['Reported RN Staffing Hours per Resident per Day'],
  reported_licensed_hrs: ['Reported Licensed Staffing Hours per Resident per Day'],
  reported_total_nurse_hrs: ['Reported Total Nurse Staffing Hours per Resident per Day'],
  weekend_total_nurse_hrs: ['Total number of nurse staff hours per resident per day on the weekend'],
  weekend_rn_hrs: ['Registered Nurse hours per resident per day on the weekend'],
  reported_pt_hrs: ['Reported Physical Therapist Staffing Hours per Resident Per Day'],
  case_mix_index: ['Nursing Case-Mix Index'],
  adjusted_na_hrs: ['Adjusted Nurse Aide Staffing Hours per Resident per Day'],
  adjusted_lpn_hrs: ['Adjusted LPN Staffing Hours per Resident per Day'],
  adjusted_rn_hrs: ['Adjusted RN Staffing Hours per Resident per Day'],
  adjusted_total_nurse_hrs: ['Adjusted Total Nurse Staffing Hours per Resident per Day'],
  total_nursing_turnover: ['Total nursing staff turnover'],
  rn_turnover: ['Registered Nurse turnover'],
  administrator_departures: ['Number of administrators who have left the nursing home'],
  cycle1_survey_date: ['Rating Cycle 1 Standard Survey Health Date'],
  cycle1_total_health_deficiencies: ['Rating Cycle 1 Total Number of Health Deficiencies'],
  cycle1_standard_deficiencies: ['Rating Cycle 1 Number of Standard Health Deficiencies'],
  cycle1_complaint_deficiencies: ['Rating Cycle 1 Number of Complaint Health Deficiencies'],
  cycle1_deficiency_score: ['Rating Cycle 1 Health Deficiency Score'],
  cycle1_revisit_count: ['Rating Cycle 1 Number of Health Revisits'],
  cycle1_revisit_score: ['Rating Cycle 1 Health Revisit Score'],
  cycle1_total_score: ['Rating Cycle 1 Total Health Score'],
  cycle2_survey_date: ['Rating Cycle 2 Standard Health Survey Date'],
  cycle2_total_health_deficiencies: ['Rating Cycle 2/3 Total Number of Health Deficiencies'],
  cycle2_standard_deficiencies: ['Rating Cycle 2 Number of Standard Health Deficiencies'],
  cycle2_complaint_deficiencies: ['Rating Cycle 2/3 Number of Complaint Health Deficiencies'],
  cycle2_deficiency_score: ['Rating Cycle 2/3 Health Deficiency Score'],
  cycle2_revisit_count: ['Rating Cycle 2/3 Number of Health Revisits'],
  cycle2_revisit_score: ['Rating Cycle 2/3 Health Revisit Score'],
  cycle2_total_score: ['Rating Cycle 2/3 Total Health Score'],
  total_weighted_health_score: ['Total Weighted Health Survey Score'],
  facility_reported_incidents: ['Number of Facility Reported Incidents'],
  substantiated_complaints: ['Number of Substantiated Complaints'],
  infection_control_citations: ['Number of Citations from Infection Control Inspections'],
  fine_count: ['Number of Fines'],
  fine_total_dollars: ['Total Amount of Fines in Dollars'],
  payment_denial_count: ['Number of Payment Denials'],
  total_penalty_count: ['Total Number of Penalties'],
  cms_processing_date: ['Processing Date']
};

// Column types for proper parsing
const COLUMN_TYPES = {
  // Integers
  certified_beds: 'int', average_residents_per_day: 'decimal', facilities_in_chain: 'int',
  overall_rating: 'int', health_inspection_rating: 'int', qm_rating: 'int',
  long_stay_qm_rating: 'int', short_stay_qm_rating: 'int', staffing_rating: 'int',
  administrator_departures: 'int', cycle1_total_health_deficiencies: 'int',
  cycle1_standard_deficiencies: 'int', cycle1_complaint_deficiencies: 'int',
  cycle1_revisit_count: 'int', cycle2_total_health_deficiencies: 'int',
  cycle2_standard_deficiencies: 'int', cycle2_complaint_deficiencies: 'int',
  cycle2_revisit_count: 'int', facility_reported_incidents: 'int',
  substantiated_complaints: 'int', infection_control_citations: 'int',
  fine_count: 'int', payment_denial_count: 'int', total_penalty_count: 'int',

  // Decimals
  latitude: 'decimal', longitude: 'decimal',
  chain_avg_overall_rating: 'decimal', chain_avg_health_rating: 'decimal',
  chain_avg_staffing_rating: 'decimal', chain_avg_qm_rating: 'decimal',
  reported_na_hrs: 'decimal', reported_lpn_hrs: 'decimal', reported_rn_hrs: 'decimal',
  reported_licensed_hrs: 'decimal', reported_total_nurse_hrs: 'decimal',
  weekend_total_nurse_hrs: 'decimal', weekend_rn_hrs: 'decimal', reported_pt_hrs: 'decimal',
  case_mix_index: 'decimal', adjusted_na_hrs: 'decimal', adjusted_lpn_hrs: 'decimal',
  adjusted_rn_hrs: 'decimal', adjusted_total_nurse_hrs: 'decimal',
  total_nursing_turnover: 'decimal', rn_turnover: 'decimal',
  cycle1_deficiency_score: 'decimal', cycle1_revisit_score: 'decimal', cycle1_total_score: 'decimal',
  cycle2_deficiency_score: 'decimal', cycle2_revisit_score: 'decimal', cycle2_total_score: 'decimal',
  total_weighted_health_score: 'decimal', fine_total_dollars: 'decimal',

  // Booleans
  is_urban: 'bool', is_hospital_based: 'bool', is_ccrc: 'bool',
  has_abuse_icon: 'bool', has_recent_ownership_change: 'bool',
  has_resident_family_council: 'bool', has_sprinkler_system: 'bool',

  // Dates
  date_first_approved: 'date', cycle1_survey_date: 'date', cycle2_survey_date: 'date',
  cms_processing_date: 'date'
};

function parseValue(value, type) {
  if (value === null || value === undefined || value === '' || value === 'NULL') {
    return null;
  }

  switch (type) {
    case 'int':
      const intVal = parseInt(value, 10);
      return isNaN(intVal) ? null : intVal;
    case 'decimal':
      const floatVal = parseFloat(value);
      return isNaN(floatVal) ? null : floatVal;
    case 'bool':
      if (typeof value === 'boolean') return value;
      const lower = String(value).toLowerCase();
      return lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1';
    case 'date':
      if (!value) return null;
      if (/^\d{8}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      }
      const parts = value.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
      return value;
    default:
      return String(value).trim().slice(0, 255); // Truncate strings
  }
}

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function findFile(dir, pattern) {
  try {
    const files = fs.readdirSync(dir);
    return files.find(f => f.includes(pattern));
  } catch {
    return null;
  }
}

function findFilesRecursive(dir, pattern) {
  const results = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...findFilesRecursive(fullPath, pattern));
      } else if (item.name.includes(pattern)) {
        results.push(fullPath);
      }
    }
  } catch { }
  return results;
}

async function extractArchive(zipPath, targetDir) {
  if (fs.existsSync(targetDir)) {
    execSync(`rm -rf "${targetDir}"`);
  }
  fs.mkdirSync(targetDir, { recursive: true });

  execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`, { stdio: 'pipe' });

  // Check for nested monthly zips
  const nestedZips = fs.readdirSync(targetDir).filter(f => f.endsWith('.zip'));
  if (nestedZips.length > 0) {
    const latestZip = nestedZips.sort().pop();
    const monthDir = path.join(targetDir, 'month');
    fs.mkdirSync(monthDir, { recursive: true });
    execSync(`unzip -q -o "${path.join(targetDir, latestZip)}" -d "${monthDir}"`, { stdio: 'pipe' });
    return monthDir;
  }

  return targetDir;
}

function getExtractDate(filename) {
  const monthMatch = filename.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i);
  if (monthMatch) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                     jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    return `${monthMatch[2]}-${months[monthMatch[1].toLowerCase()]}-01`;
  }

  const yearMatch = filename.match(/(\d{4})/);
  if (yearMatch) {
    return `${yearMatch[1]}-12-01`;
  }
  return null;
}

async function getOrCreateExtract(extractDate, sourceFile) {
  const existing = await pool.query(
    'SELECT extract_id FROM cms_extracts WHERE extract_date = $1',
    [extractDate]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].extract_id;
  }

  const result = await pool.query(
    `INSERT INTO cms_extracts (extract_date, source_file, import_started_at, import_status)
     VALUES ($1, $2, CURRENT_TIMESTAMP, 'importing')
     RETURNING extract_id`,
    [extractDate, sourceFile]
  );

  return result.rows[0].extract_id;
}

/**
 * Build column mapper based on what's in the CSV
 */
function buildMapper(csvHeaders, columnMap) {
  const mapper = {};
  for (const [dbCol, csvNames] of Object.entries(columnMap)) {
    for (const csvName of csvNames) {
      if (csvHeaders.includes(csvName)) {
        mapper[dbCol] = csvName;
        break;
      }
    }
  }
  return mapper;
}

/**
 * Import provider info dynamically based on available columns
 */
async function importProviderInfo(csvPath, extractId) {
  console.log(`  Importing provider info from ${path.basename(csvPath)}...`);

  const rows = await readCSV(csvPath);
  if (rows.length === 0) {
    console.log('  Warning: No rows found');
    return 0;
  }

  const csvHeaders = Object.keys(rows[0]);
  const mapper = buildMapper(csvHeaders, PROVIDER_COLUMN_MAP);

  // Build dynamic INSERT based on what columns we have
  const dbColumns = ['extract_id'];
  const placeholders = ['$1'];
  let paramIndex = 2;

  const availableColumns = Object.keys(mapper);
  for (const col of availableColumns) {
    dbColumns.push(col);
    placeholders.push(`$${paramIndex}`);
    paramIndex++;
  }

  const insertSQL = `
    INSERT INTO facility_snapshots (${dbColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (extract_id, ccn) DO UPDATE SET
      provider_name = EXCLUDED.provider_name,
      overall_rating = EXCLUDED.overall_rating
  `;

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const ccnCol = mapper.ccn;
    if (!ccnCol || !row[ccnCol]) {
      skipped++;
      continue;
    }

    // Build values array
    const values = [extractId];
    for (const dbCol of availableColumns) {
      const csvCol = mapper[dbCol];
      const rawValue = row[csvCol];
      const colType = COLUMN_TYPES[dbCol] || 'string';
      values.push(parseValue(rawValue, colType));
    }

    try {
      await pool.query(insertSQL, values);
      imported++;
    } catch (err) {
      if (imported === 0 && skipped < 5) {
        console.error(`  Error importing: ${err.message}`);
      }
      skipped++;
    }
  }

  console.log(`  Imported ${imported} facilities (skipped ${skipped})`);
  return imported;
}

/**
 * Import quality measures
 */
async function importQualityMeasures(csvPath, extractId) {
  console.log(`  Importing quality measures from ${path.basename(csvPath)}...`);

  const rows = await readCSV(csvPath);
  if (rows.length === 0) return 0;

  const headers = Object.keys(rows[0]);

  // Find CCN column
  const ccnCol = headers.find(h =>
    h.includes('CCN') || h.includes('Provider ID') || h.includes('Federal Provider')
  );

  // Find measure code column
  const measureCol = headers.find(h =>
    h.includes('Measure Code') || h === 'Measure_ID'
  );

  // Find score column
  const scoreCol = headers.find(h =>
    h === 'Score' || h.includes('Score')
  );

  if (!ccnCol || !measureCol) {
    console.log('  Warning: Could not find required columns');
    return 0;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const ccn = row[ccnCol];
    const measureCode = row[measureCol];

    if (!ccn || !measureCode) {
      skipped++;
      continue;
    }

    try {
      await pool.query(`
        INSERT INTO quality_snapshots (extract_id, ccn, measure_code, score, footnote)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
          score = EXCLUDED.score
      `, [
        extractId,
        ccn,
        measureCode,
        scoreCol ? parseValue(row[scoreCol], 'decimal') : null,
        row['Footnote'] || null
      ]);
      imported++;
    } catch (err) {
      skipped++;
    }
  }

  console.log(`  Imported ${imported} quality measures (skipped ${skipped})`);
  return imported;
}

async function importExtract(source, isArchive = true) {
  const sourceName = path.basename(source);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Processing: ${sourceName}`);

  let dataDir;
  if (isArchive) {
    const extractDir = path.join(TEMP_DIR, sourceName.replace('.zip', ''));
    dataDir = await extractArchive(source, extractDir);
  } else {
    dataDir = source;
  }

  const extractDate = getExtractDate(sourceName);
  if (!extractDate) {
    console.log('  Warning: Could not determine extract date');
    return;
  }

  console.log(`  Extract date: ${extractDate}`);

  const extractId = await getOrCreateExtract(extractDate, sourceName);
  console.log(`  Extract ID: ${extractId}`);

  // Find provider info - search recursively (handles both old and new naming)
  let providerFiles = findFilesRecursive(dataDir, 'NH_ProviderInfo');
  if (providerFiles.length === 0) {
    providerFiles = findFilesRecursive(dataDir, 'ProviderInfo_Download');
  }
  if (providerFiles.length === 0) {
    providerFiles = findFilesRecursive(dataDir, 'ProviderInfo');
  }

  if (providerFiles.length > 0) {
    // Use the most recent one (sort by name, take last)
    const providerFile = providerFiles.sort().pop();
    await importProviderInfo(providerFile, extractId);
  } else {
    console.log('  Warning: No provider info file found');
  }

  // Find quality measures
  let qrpFiles = findFilesRecursive(dataDir, 'Skilled_Nursing_Facility_Quality_Reporting_Program_Provider');
  if (qrpFiles.length === 0) {
    qrpFiles = findFilesRecursive(dataDir, 'NH_QualityMsr_MDS');
  }

  if (qrpFiles.length > 0) {
    const qrpFile = qrpFiles.sort().pop();
    await importQualityMeasures(qrpFile, extractId);
  }

  // Update extract record
  await pool.query(`
    UPDATE cms_extracts
    SET import_completed_at = CURRENT_TIMESTAMP,
        import_status = 'completed',
        record_count = (SELECT COUNT(*) FROM facility_snapshots WHERE extract_id = $1)
    WHERE extract_id = $1
  `, [extractId]);

  console.log(`  Import completed`);
}

async function detectEvents() {
  console.log('\n' + '='.repeat(60));
  console.log('DETECTING EVENTS BETWEEN EXTRACTS');
  console.log('='.repeat(60));

  const extracts = await pool.query(`
    SELECT extract_id, extract_date
    FROM cms_extracts
    WHERE import_status = 'completed'
    ORDER BY extract_date
  `);

  if (extracts.rows.length < 2) {
    console.log('Need at least 2 extracts to detect events');
    return;
  }

  for (let i = 1; i < extracts.rows.length; i++) {
    const prev = extracts.rows[i - 1];
    const curr = extracts.rows[i];

    console.log(`\nComparing ${prev.extract_date} → ${curr.extract_date}`);

    // Rating changes
    const ratings = await pool.query(`
      INSERT INTO facility_events (ccn, event_type, event_date, previous_extract_id, current_extract_id, previous_value, new_value, change_magnitude, state, county, chain_id)
      SELECT curr.ccn, 'RATING_CHANGE', $3::date, $1, $2,
        prev.overall_rating::text, curr.overall_rating::text,
        (curr.overall_rating - prev.overall_rating)::decimal,
        curr.state, curr.county, curr.chain_id
      FROM facility_snapshots curr
      JOIN facility_snapshots prev ON curr.ccn = prev.ccn AND prev.extract_id = $1
      WHERE curr.extract_id = $2
        AND curr.overall_rating IS NOT NULL AND prev.overall_rating IS NOT NULL
        AND curr.overall_rating != prev.overall_rating
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [prev.extract_id, curr.extract_id, curr.extract_date]);
    console.log(`  Rating changes: ${ratings.rowCount}`);

    // New penalties
    const penalties = await pool.query(`
      INSERT INTO facility_events (ccn, event_type, event_date, previous_extract_id, current_extract_id, previous_value, new_value, change_magnitude, state, county, chain_id)
      SELECT curr.ccn, 'PENALTY_ISSUED', $3::date, $1, $2,
        prev.fine_total_dollars::text, curr.fine_total_dollars::text,
        (COALESCE(curr.fine_total_dollars, 0) - COALESCE(prev.fine_total_dollars, 0))::decimal,
        curr.state, curr.county, curr.chain_id
      FROM facility_snapshots curr
      JOIN facility_snapshots prev ON curr.ccn = prev.ccn AND prev.extract_id = $1
      WHERE curr.extract_id = $2
        AND COALESCE(curr.fine_total_dollars, 0) > COALESCE(prev.fine_total_dollars, 0)
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [prev.extract_id, curr.extract_id, curr.extract_date]);
    console.log(`  New penalties: ${penalties.rowCount}`);

    // New facilities
    const newFacilities = await pool.query(`
      INSERT INTO facility_events (ccn, event_type, event_date, current_extract_id, state, county, chain_id)
      SELECT curr.ccn, 'FACILITY_OPENED', $3::date, $2, curr.state, curr.county, curr.chain_id
      FROM facility_snapshots curr
      LEFT JOIN facility_snapshots prev ON curr.ccn = prev.ccn AND prev.extract_id = $1
      WHERE curr.extract_id = $2 AND prev.ccn IS NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [prev.extract_id, curr.extract_id, curr.extract_date]);
    console.log(`  New facilities: ${newFacilities.rowCount}`);

    // Closed facilities
    const closed = await pool.query(`
      INSERT INTO facility_events (ccn, event_type, event_date, previous_extract_id, current_extract_id, state, county, chain_id)
      SELECT prev.ccn, 'FACILITY_CLOSED', $3::date, $1, $2, prev.state, prev.county, prev.chain_id
      FROM facility_snapshots prev
      LEFT JOIN facility_snapshots curr ON prev.ccn = curr.ccn AND curr.extract_id = $2
      WHERE prev.extract_id = $1 AND curr.ccn IS NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [prev.extract_id, curr.extract_id, curr.extract_date]);
    console.log(`  Closed facilities: ${closed.rowCount}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('CMS HISTORICAL DATA IMPORT');
  console.log('='.repeat(60));

  if (fs.existsSync(TEMP_DIR)) {
    execSync(`rm -rf "${TEMP_DIR}"`);
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  try {
    // Get historical archives
    const archives = fs.readdirSync(HISTORICAL_DIR)
      .filter(f => f.endsWith('.zip'))
      .sort()
      .map(f => path.join(HISTORICAL_DIR, f));

    console.log(`\nFound ${archives.length} historical archives`);

    for (const archive of archives) {
      await importExtract(archive, true);
    }

    // Import current data
    if (fs.existsSync(CURRENT_DATA_DIR)) {
      console.log('\nImporting current (December 2025) data...');
      await importExtract(CURRENT_DATA_DIR, false);
    }

    // Detect events
    await detectEvents();

    // Summary
    const summary = await pool.query(`
      SELECT COUNT(DISTINCT fs.extract_id) as extracts, COUNT(*) as snapshots,
        MIN(e.extract_date) as earliest, MAX(e.extract_date) as latest
      FROM facility_snapshots fs
      JOIN cms_extracts e ON fs.extract_id = e.extract_id
    `);

    const events = await pool.query(`
      SELECT event_type, COUNT(*) as count
      FROM facility_events GROUP BY event_type ORDER BY count DESC
    `);

    console.log('\n' + '='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`\nExtracts: ${summary.rows[0].extracts}`);
    console.log(`Snapshots: ${summary.rows[0].snapshots}`);
    console.log(`Date range: ${summary.rows[0].earliest} to ${summary.rows[0].latest}`);
    console.log('\nEvents:');
    for (const e of events.rows) {
      console.log(`  ${e.event_type}: ${e.count}`);
    }

  } finally {
    execSync(`rm -rf "${TEMP_DIR}"`);
    await pool.end();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
