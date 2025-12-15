/**
 * BLS OEWS Collector
 *
 * Downloads and imports BLS Occupational Employment and Wage Statistics (OEWS) data
 * for healthcare occupations relevant to SNF operations.
 *
 * Data Source: https://www.bls.gov/oes/special-requests/oesm24st.zip
 * Contains May 2024 state-level wage data
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// Target healthcare occupations for SNF operations
const TARGET_OCCUPATIONS = [
  '29-1141',  // Registered Nurses
  '29-2061',  // Licensed Practical and Licensed Vocational Nurses
  '31-1131',  // Nursing Assistants
  '11-9111',  // Medical and Health Services Managers
  '29-1123',  // Physical Therapists
  '31-2021',  // Physical Therapist Assistants
  '29-1122',  // Occupational Therapists
  '29-1127',  // Speech-Language Pathologists
];

// BLS data URL for May 2024 state-level data
const BLS_DATA_URL = 'https://www.bls.gov/oes/special-requests/oesm24st.zip';
const DATA_YEAR = 2024;

// Local cache directory
const DATA_DIR = path.join(__dirname, '..', 'data');
const ZIP_FILE = path.join(DATA_DIR, 'oesm24st.zip');

/**
 * Download file from URL
 */
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`[BLS Collector] Downloading from ${url}...`);

    const file = fs.createWriteStream(destPath);

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/zip,application/octet-stream,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };

    const parsedUrl = new URL(url);
    options.hostname = parsedUrl.hostname;
    options.path = parsedUrl.pathname + parsedUrl.search;

    https.get(options, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`[BLS Collector] Following redirect to ${response.headers.location}`);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const pct = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r[BLS Collector] Downloaded ${pct}%`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n[BLS Collector] Download complete');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Extract state Excel file from ZIP
 */
function extractStateFile(zipPath) {
  console.log('[BLS Collector] Extracting ZIP file...');

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Look for the state data file (e.g., state_M2024_dl.xlsx)
  const stateFile = entries.find(entry =>
    entry.entryName.toLowerCase().includes('state') &&
    entry.entryName.endsWith('.xlsx')
  );

  if (!stateFile) {
    throw new Error('Could not find state Excel file in ZIP archive');
  }

  console.log(`[BLS Collector] Found state file: ${stateFile.entryName}`);

  // Extract just the filename without directory path
  const fileName = path.basename(stateFile.entryName);
  const extractPath = path.join(DATA_DIR, fileName);

  // Extract file data directly
  fs.writeFileSync(extractPath, stateFile.getData());

  console.log(`[BLS Collector] Extracted to: ${extractPath}`);

  return extractPath;
}

/**
 * Parse wage value, handling BLS suppression markers
 */
function parseWage(value) {
  if (value === null || value === undefined) return null;

  const strVal = String(value).trim();

  // BLS uses *, **, #, or ~ for suppressed/unavailable data
  if (['*', '**', '#', '~', '-', 'N/A', ''].includes(strVal)) {
    return null;
  }

  const num = parseFloat(strVal.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * Parse employment value
 */
function parseEmployment(value) {
  if (value === null || value === undefined) return null;

  const strVal = String(value).trim();

  if (['*', '**', '#', '~', '-', 'N/A', ''].includes(strVal)) {
    return null;
  }

  const num = parseInt(strVal.replace(/,/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse Excel file and extract target occupations
 */
function parseExcelData(excelPath) {
  console.log('[BLS Collector] Parsing Excel file...');

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`[BLS Collector] Total rows in file: ${data.length}`);

  // Map column names (BLS uses various naming conventions)
  const records = [];

  for (const row of data) {
    // Get occupation code - try different column names
    const occCode = row['OCC_CODE'] || row['occ_code'] || row['Occ Code'];

    // Skip if not a target occupation
    if (!occCode || !TARGET_OCCUPATIONS.includes(occCode)) {
      continue;
    }

    // Get state code - try different column names
    const stateCode = row['ST'] || row['PRIM_STATE'] || row['STATE'] || row['st'];

    // Skip national-level or non-state records
    if (!stateCode || stateCode.length !== 2) {
      continue;
    }

    // Skip territories (PR, VI, GU)
    if (['PR', 'VI', 'GU', 'AS', 'MP'].includes(stateCode.toUpperCase())) {
      continue;
    }

    const record = {
      state_code: stateCode.toUpperCase(),
      state_name: row['STATE_NAME'] || row['AREA_NAME'] || row['state_name'] || row['area_name'] || '',
      occupation_code: occCode,
      occupation_title: row['OCC_TITLE'] || row['occ_title'] || row['Occ Title'] || '',
      employment: parseEmployment(row['TOT_EMP'] || row['tot_emp']),
      hourly_mean_wage: parseWage(row['H_MEAN'] || row['h_mean']),
      hourly_10_pct: parseWage(row['H_PCT10'] || row['h_pct10']),
      hourly_25_pct: parseWage(row['H_PCT25'] || row['h_pct25']),
      hourly_median: parseWage(row['H_MEDIAN'] || row['h_median']),
      hourly_75_pct: parseWage(row['H_PCT75'] || row['h_pct75']),
      hourly_90_pct: parseWage(row['H_PCT90'] || row['h_pct90']),
      annual_mean_wage: parseEmployment(row['A_MEAN'] || row['a_mean']),
      data_year: DATA_YEAR
    };

    // Clean up state name (remove "- Statewide" suffix if present)
    record.state_name = record.state_name.replace(/\s*-\s*Statewide$/i, '').trim();

    records.push(record);
  }

  console.log(`[BLS Collector] Extracted ${records.length} records for target occupations`);

  return records;
}

/**
 * Insert records into database
 */
async function insertRecords(records, pool) {
  console.log('[BLS Collector] Inserting records into database...');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const result = await pool.query(`
        INSERT INTO bls_state_wages (
          state_code, state_name, occupation_code, occupation_title,
          employment, hourly_mean_wage, hourly_10_pct, hourly_25_pct,
          hourly_median, hourly_75_pct, hourly_90_pct, annual_mean_wage,
          data_year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (state_code, occupation_code, data_year)
        DO UPDATE SET
          state_name = EXCLUDED.state_name,
          occupation_title = EXCLUDED.occupation_title,
          employment = EXCLUDED.employment,
          hourly_mean_wage = EXCLUDED.hourly_mean_wage,
          hourly_10_pct = EXCLUDED.hourly_10_pct,
          hourly_25_pct = EXCLUDED.hourly_25_pct,
          hourly_median = EXCLUDED.hourly_median,
          hourly_75_pct = EXCLUDED.hourly_75_pct,
          hourly_90_pct = EXCLUDED.hourly_90_pct,
          annual_mean_wage = EXCLUDED.annual_mean_wage
        RETURNING (xmax = 0) as is_insert
      `, [
        record.state_code,
        record.state_name,
        record.occupation_code,
        record.occupation_title,
        record.employment,
        record.hourly_mean_wage,
        record.hourly_10_pct,
        record.hourly_25_pct,
        record.hourly_median,
        record.hourly_75_pct,
        record.hourly_90_pct,
        record.annual_mean_wage,
        record.data_year
      ]);

      if (result.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[BLS Collector] Error inserting record for ${record.state_code}/${record.occupation_code}:`, err.message);
      errors++;
    }
  }

  return { inserted, updated, errors };
}

/**
 * Print summary by occupation
 */
async function printSummary(pool) {
  console.log('\n[BLS Collector] === Summary by Occupation ===\n');

  const result = await pool.query(`
    SELECT
      occupation_code,
      occupation_title,
      COUNT(*) as state_count,
      ROUND(AVG(hourly_mean_wage)::numeric, 2) as avg_hourly_wage,
      MIN(hourly_mean_wage) as min_wage,
      MAX(hourly_mean_wage) as max_wage,
      SUM(employment) as total_employment
    FROM bls_state_wages
    WHERE data_year = $1
    GROUP BY occupation_code, occupation_title
    ORDER BY avg_hourly_wage DESC
  `, [DATA_YEAR]);

  console.log('Occupation                                   | States | Avg Wage | Min-Max Wage    | Employment');
  console.log('---------------------------------------------|--------|----------|-----------------|------------');

  for (const row of result.rows) {
    const title = row.occupation_title.substring(0, 43).padEnd(43);
    const states = String(row.state_count).padStart(6);
    const avgWage = row.avg_hourly_wage ? `$${row.avg_hourly_wage}`.padStart(8) : '     N/A';
    const minMax = row.min_wage && row.max_wage
      ? `$${row.min_wage}-$${row.max_wage}`.padStart(15)
      : '            N/A';
    const emp = row.total_employment ? row.total_employment.toLocaleString().padStart(10) : '       N/A';

    console.log(`${title} | ${states} | ${avgWage} | ${minMax} | ${emp}`);
  }

  // Total records
  const totalResult = await pool.query(
    'SELECT COUNT(*) as total FROM bls_state_wages WHERE data_year = $1',
    [DATA_YEAR]
  );
  console.log(`\nTotal records: ${totalResult.rows[0].total}`);
}

/**
 * Main collector function
 */
async function runCollector() {
  console.log('='.repeat(60));
  console.log('[BLS OEWS Collector] Starting collection run');
  console.log(`[BLS OEWS Collector] Data year: ${DATA_YEAR}`);
  console.log('='.repeat(60));

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Connect to database
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('[BLS Collector] Database connection successful');

    // Check if we need to download the file
    let needsDownload = true;
    if (fs.existsSync(ZIP_FILE)) {
      const stats = fs.statSync(ZIP_FILE);
      const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

      // Re-download if older than 30 days
      if (ageHours < 30 * 24) {
        console.log('[BLS Collector] Using cached ZIP file (less than 30 days old)');
        needsDownload = false;
      }
    }

    if (needsDownload) {
      await downloadFile(BLS_DATA_URL, ZIP_FILE);
    }

    // Extract state file
    const excelPath = extractStateFile(ZIP_FILE);

    // Parse Excel data
    const records = parseExcelData(excelPath);

    if (records.length === 0) {
      throw new Error('No records found for target occupations');
    }

    // Insert into database
    const result = await insertRecords(records, pool);

    console.log('\n[BLS Collector] Import complete:');
    console.log(`  - Inserted: ${result.inserted}`);
    console.log(`  - Updated: ${result.updated}`);
    console.log(`  - Errors: ${result.errors}`);

    // Print summary
    await printSummary(pool);

    // Clean up extracted Excel file
    if (fs.existsSync(excelPath)) {
      fs.unlinkSync(excelPath);
    }

    console.log('\n[BLS Collector] Collection run complete');

  } catch (err) {
    console.error('[BLS Collector] Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

  runCollector()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Collector failed:', err);
      process.exit(1);
    });
}

module.exports = { runCollector, TARGET_OCCUPATIONS, DATA_YEAR };
