/**
 * CBSA Crosswalk Collector
 *
 * Imports CBSA (Core Based Statistical Area) definitions and county-to-CBSA mappings
 * from the Census Bureau delineation file.
 *
 * Data Source: Census Bureau list1_2023.xlsx
 * Contains ~930 CBSAs and ~1,900 county mappings
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// Data file path
const DATA_DIR = path.join(__dirname, '..', 'data');
const CBSA_FILE = path.join(DATA_DIR, 'list1_2023.xlsx');

// State name to code mapping
const STATE_CODES = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Puerto Rico': 'PR',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

/**
 * Parse the CBSA Excel file
 */
function parseCBSAFile(filePath) {
  console.log('[CBSA Collector] Parsing Excel file...');

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find header row (contains "CBSA Code")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (data[i] && data[i].some(cell => cell === 'CBSA Code')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find header row in CBSA file');
  }

  const headers = data[headerRowIndex];
  console.log(`[CBSA Collector] Found headers at row ${headerRowIndex}:`, headers);

  // Map column indices
  const colMap = {
    cbsaCode: headers.indexOf('CBSA Code'),
    metroDiv: headers.indexOf('Metropolitan Division Code'),
    csaCode: headers.indexOf('CSA Code'),
    cbsaTitle: headers.indexOf('CBSA Title'),
    cbsaType: headers.indexOf('Metropolitan/Micropolitan Statistical Area'),
    metroDivTitle: headers.indexOf('Metropolitan Division Title'),
    csaTitle: headers.indexOf('CSA Title'),
    countyName: headers.indexOf('County/County Equivalent'),
    stateName: headers.indexOf('State Name'),
    stateFips: headers.indexOf('FIPS State Code'),
    countyFips: headers.indexOf('FIPS County Code'),
    centralOutlying: headers.indexOf('Central/Outlying County')
  };

  const cbsas = new Map();
  const counties = [];

  // Process data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[colMap.cbsaCode]) continue;

    const cbsaCode = String(row[colMap.cbsaCode]).trim();
    const cbsaTitle = row[colMap.cbsaTitle] ? String(row[colMap.cbsaTitle]).trim() : '';
    const cbsaTypeRaw = row[colMap.cbsaType] ? String(row[colMap.cbsaType]).trim() : '';
    const csaCode = row[colMap.csaCode] ? String(row[colMap.csaCode]).trim() : null;
    const csaTitle = row[colMap.csaTitle] ? String(row[colMap.csaTitle]).trim() : null;

    // Determine CBSA type
    let cbsaType = 'Metropolitan';
    if (cbsaTypeRaw.toLowerCase().includes('micropolitan')) {
      cbsaType = 'Micropolitan';
    }

    // Add/update CBSA
    if (!cbsas.has(cbsaCode)) {
      cbsas.set(cbsaCode, {
        cbsa_code: cbsaCode,
        cbsa_title: cbsaTitle,
        cbsa_type: cbsaType,
        csa_code: csaCode,
        csa_title: csaTitle
      });
    }

    // Process county
    const stateName = row[colMap.stateName] ? String(row[colMap.stateName]).trim() : '';
    const stateFips = row[colMap.stateFips] ? String(row[colMap.stateFips]).padStart(2, '0') : '';
    const countyFipsCode = row[colMap.countyFips] ? String(row[colMap.countyFips]).padStart(3, '0') : '';
    const countyName = row[colMap.countyName] ? String(row[colMap.countyName]).trim() : '';
    const centralOutlying = row[colMap.centralOutlying] ? String(row[colMap.centralOutlying]).trim() : '';
    const metroDivCode = row[colMap.metroDiv] ? String(row[colMap.metroDiv]).trim() : null;
    const metroDivTitle = row[colMap.metroDivTitle] ? String(row[colMap.metroDivTitle]).trim() : null;

    if (!stateFips || !countyFipsCode) continue;

    const fullCountyFips = stateFips + countyFipsCode;
    const stateCode = STATE_CODES[stateName] || '';

    counties.push({
      county_fips: fullCountyFips,
      county_name: countyName.replace(/ County$/, '').replace(/ Parish$/, '').replace(/ Borough$/, ''),
      state_fips: stateFips,
      state_code: stateCode,
      cbsa_code: cbsaCode,
      cbsa_title: cbsaTitle,
      is_central_county: centralOutlying.toLowerCase() === 'central',
      metropolitan_division_code: metroDivCode,
      metropolitan_division_title: metroDivTitle
    });
  }

  console.log(`[CBSA Collector] Parsed ${cbsas.size} CBSAs and ${counties.length} county mappings`);

  return {
    cbsas: Array.from(cbsas.values()),
    counties
  };
}

/**
 * Insert CBSAs into database
 */
async function insertCBSAs(cbsas, pool) {
  console.log('[CBSA Collector] Inserting CBSAs...');

  let inserted = 0;
  let updated = 0;

  for (const cbsa of cbsas) {
    try {
      const result = await pool.query(`
        INSERT INTO cbsas (cbsa_code, cbsa_title, cbsa_type, csa_code, csa_title)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (cbsa_code)
        DO UPDATE SET
          cbsa_title = EXCLUDED.cbsa_title,
          cbsa_type = EXCLUDED.cbsa_type,
          csa_code = EXCLUDED.csa_code,
          csa_title = EXCLUDED.csa_title,
          updated_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `, [cbsa.cbsa_code, cbsa.cbsa_title, cbsa.cbsa_type, cbsa.csa_code, cbsa.csa_title]);

      if (result.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[CBSA Collector] Error inserting CBSA ${cbsa.cbsa_code}:`, err.message);
    }
  }

  return { inserted, updated };
}

/**
 * Insert county mappings into database
 */
async function insertCounties(counties, pool) {
  console.log('[CBSA Collector] Inserting county mappings...');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const county of counties) {
    try {
      const result = await pool.query(`
        INSERT INTO county_cbsa_crosswalk (
          county_fips, county_name, state_fips, state_code,
          cbsa_code, cbsa_title, is_central_county,
          metropolitan_division_code, metropolitan_division_title
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (county_fips)
        DO UPDATE SET
          county_name = EXCLUDED.county_name,
          cbsa_code = EXCLUDED.cbsa_code,
          cbsa_title = EXCLUDED.cbsa_title,
          is_central_county = EXCLUDED.is_central_county,
          metropolitan_division_code = EXCLUDED.metropolitan_division_code,
          metropolitan_division_title = EXCLUDED.metropolitan_division_title,
          updated_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `, [
        county.county_fips,
        county.county_name,
        county.state_fips,
        county.state_code,
        county.cbsa_code,
        county.cbsa_title,
        county.is_central_county,
        county.metropolitan_division_code,
        county.metropolitan_division_title
      ]);

      if (result.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[CBSA Collector] Error inserting county ${county.county_fips}:`, err.message);
      errors++;
    }
  }

  return { inserted, updated, errors };
}

/**
 * Print summary statistics
 */
async function printSummary(pool) {
  console.log('\n[CBSA Collector] === Summary ===\n');

  // CBSA counts by type
  const cbsaResult = await pool.query(`
    SELECT cbsa_type, COUNT(*) as count
    FROM cbsas
    GROUP BY cbsa_type
    ORDER BY cbsa_type
  `);

  console.log('CBSAs by type:');
  for (const row of cbsaResult.rows) {
    console.log(`  ${row.cbsa_type}: ${row.count}`);
  }

  // County counts by state
  const countyResult = await pool.query(`
    SELECT state_code, COUNT(*) as count
    FROM county_cbsa_crosswalk
    GROUP BY state_code
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('\nTop 10 states by county count:');
  for (const row of countyResult.rows) {
    console.log(`  ${row.state_code}: ${row.count} counties`);
  }

  // Total counts
  const totalCbsas = await pool.query('SELECT COUNT(*) as count FROM cbsas');
  const totalCounties = await pool.query('SELECT COUNT(*) as count FROM county_cbsa_crosswalk');

  console.log(`\nTotal CBSAs: ${totalCbsas.rows[0].count}`);
  console.log(`Total county mappings: ${totalCounties.rows[0].count}`);
}

/**
 * Main collector function
 */
async function runCollector() {
  console.log('='.repeat(60));
  console.log('[CBSA Crosswalk Collector] Starting collection run');
  console.log('='.repeat(60));

  // Check for data file
  if (!fs.existsSync(CBSA_FILE)) {
    throw new Error(`CBSA file not found at ${CBSA_FILE}. Please download from Census Bureau.`);
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
    console.log('[CBSA Collector] Database connection successful');

    // Parse Excel file
    const { cbsas, counties } = parseCBSAFile(CBSA_FILE);

    // Insert CBSAs
    const cbsaResult = await insertCBSAs(cbsas, pool);
    console.log(`[CBSA Collector] CBSAs: ${cbsaResult.inserted} inserted, ${cbsaResult.updated} updated`);

    // Insert county mappings
    const countyResult = await insertCounties(counties, pool);
    console.log(`[CBSA Collector] Counties: ${countyResult.inserted} inserted, ${countyResult.updated} updated, ${countyResult.errors} errors`);

    // Print summary
    await printSummary(pool);

    console.log('\n[CBSA Collector] Collection run complete');

  } catch (err) {
    console.error('[CBSA Collector] Error:', err);
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

module.exports = { runCollector };
