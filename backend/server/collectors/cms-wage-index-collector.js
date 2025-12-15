/**
 * CMS Wage Index Collector
 *
 * Imports CMS SNF PPS wage index data from the FY2026 wage index files.
 * Urban areas use CBSA-level indexes, rural areas use state-level indexes.
 *
 * Data Source: CMS FY2026 SNF PPS Wage Index ZIP file
 * Contains Table A (urban CBSAs) and Table B (rural states)
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { Pool } = require('pg');

// Data file paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const WAGE_INDEX_ZIP = path.join(DATA_DIR, 'fy2026_wage_index_20250804.zip');
const FISCAL_YEAR = 2026;

// State code mapping (for rural table which uses numeric codes)
const STATE_CODE_MAP = {
  '01': 'AL', '02': 'AK', '03': 'AZ', '04': 'AR', '05': 'CA',
  '06': 'CO', '07': 'CT', '08': 'DE', '09': 'DC', '10': 'FL',
  '11': 'GA', '12': 'HI', '13': 'ID', '14': 'IL', '15': 'IN',
  '16': 'IA', '17': 'KS', '18': 'KY', '19': 'LA', '20': 'ME',
  '21': 'MD', '22': 'MA', '23': 'MI', '24': 'MN', '25': 'MS',
  '26': 'MO', '27': 'MT', '28': 'NE', '29': 'NV', '30': 'NH',
  '31': 'NJ', '32': 'NM', '33': 'NY', '34': 'NC', '35': 'ND',
  '36': 'OH', '37': 'OK', '38': 'OR', '39': 'PA', '40': 'PR',
  '41': 'RI', '42': 'SC', '43': 'SD', '44': 'TN', '45': 'TX',
  '46': 'UT', '47': 'VT', '48': 'VI', '49': 'VA', '50': 'WA',
  '51': 'WV', '52': 'WI', '53': 'WY'
};

/**
 * Parse CSV content into rows
 */
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const rows = [];

  for (const line of lines) {
    // Simple CSV parsing (handles quoted fields with commas)
    const row = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Parse Table A (Urban CBSAs)
 */
function parseTableA(content) {
  const rows = parseCSV(content);
  const records = [];
  let currentCbsa = null;

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // New CBSA starts when we have a CBSA code in first column
    if (row[0] && row[0].match(/^\d{5}$/)) {
      currentCbsa = {
        cbsa_code: row[0],
        area_name: row[1] ? row[1].replace(/"/g, '').trim() : '',
        wage_index: parseFloat(row[3]) || null
      };

      if (currentCbsa.wage_index) {
        records.push(currentCbsa);
      }
    }
  }

  return records;
}

/**
 * Parse Table B (Rural States)
 */
function parseTableB(content) {
  const rows = parseCSV(content);
  const records = [];

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;

    const stateNumeric = row[0].padStart(2, '0');
    const stateCode = STATE_CODE_MAP[stateNumeric];
    const areaName = row[1] ? row[1].trim() : '';
    const wageIndex = parseFloat(row[2]);

    if (stateCode && !isNaN(wageIndex)) {
      records.push({
        state_code: stateCode,
        area_name: areaName || `${stateCode} Rural`,
        wage_index: wageIndex
      });
    }
  }

  return records;
}

/**
 * Extract and parse wage index files from ZIP
 */
function extractWageIndexData(zipPath) {
  console.log('[CMS Wage Index] Extracting ZIP file...');

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  let tableAContent = null;
  let tableBContent = null;

  for (const entry of entries) {
    const name = entry.entryName.toLowerCase();

    if (name.includes('tablea') && name.endsWith('.csv')) {
      tableAContent = entry.getData().toString('utf8');
      console.log(`[CMS Wage Index] Found Table A: ${entry.entryName}`);
    } else if (name.includes('tableb') && name.endsWith('.csv')) {
      tableBContent = entry.getData().toString('utf8');
      console.log(`[CMS Wage Index] Found Table B: ${entry.entryName}`);
    }
  }

  if (!tableAContent) {
    throw new Error('Could not find Table A (urban CBSAs) in ZIP');
  }
  if (!tableBContent) {
    throw new Error('Could not find Table B (rural states) in ZIP');
  }

  const urbanRecords = parseTableA(tableAContent);
  const ruralRecords = parseTableB(tableBContent);

  console.log(`[CMS Wage Index] Parsed ${urbanRecords.length} urban CBSAs and ${ruralRecords.length} rural states`);

  return { urbanRecords, ruralRecords };
}

/**
 * Insert urban wage indexes into database
 */
async function insertUrbanIndexes(records, pool) {
  console.log('[CMS Wage Index] Inserting urban wage indexes...');

  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    try {
      const result = await pool.query(`
        INSERT INTO cms_wage_index (cbsa_code, state_code, area_name, wage_index, is_urban, fiscal_year)
        VALUES ($1, NULL, $2, $3, TRUE, $4)
        ON CONFLICT (cbsa_code, state_code, fiscal_year)
        DO UPDATE SET
          area_name = EXCLUDED.area_name,
          wage_index = EXCLUDED.wage_index,
          updated_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `, [record.cbsa_code, record.area_name, record.wage_index, FISCAL_YEAR]);

      if (result.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[CMS Wage Index] Error inserting urban CBSA ${record.cbsa_code}:`, err.message);
    }
  }

  return { inserted, updated };
}

/**
 * Insert rural wage indexes into database
 */
async function insertRuralIndexes(records, pool) {
  console.log('[CMS Wage Index] Inserting rural wage indexes...');

  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    try {
      const result = await pool.query(`
        INSERT INTO cms_wage_index (cbsa_code, state_code, area_name, wage_index, is_urban, fiscal_year)
        VALUES (NULL, $1, $2, $3, FALSE, $4)
        ON CONFLICT (cbsa_code, state_code, fiscal_year)
        DO UPDATE SET
          area_name = EXCLUDED.area_name,
          wage_index = EXCLUDED.wage_index,
          updated_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `, [record.state_code, record.area_name, record.wage_index, FISCAL_YEAR]);

      if (result.rows[0].is_insert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[CMS Wage Index] Error inserting rural state ${record.state_code}:`, err.message);
    }
  }

  return { inserted, updated };
}

/**
 * Print summary statistics
 */
async function printSummary(pool) {
  console.log('\n[CMS Wage Index] === Summary ===\n');

  // Counts by type
  const countResult = await pool.query(`
    SELECT is_urban, COUNT(*) as count,
           ROUND(AVG(wage_index)::numeric, 4) as avg_index,
           MIN(wage_index) as min_index,
           MAX(wage_index) as max_index
    FROM cms_wage_index
    WHERE fiscal_year = $1
    GROUP BY is_urban
    ORDER BY is_urban DESC
  `, [FISCAL_YEAR]);

  for (const row of countResult.rows) {
    const type = row.is_urban ? 'Urban CBSAs' : 'Rural States';
    console.log(`${type}:`);
    console.log(`  Count: ${row.count}`);
    console.log(`  Avg Index: ${row.avg_index}`);
    console.log(`  Range: ${row.min_index} - ${row.max_index}`);
    console.log('');
  }

  // Top 5 highest and lowest wage indexes
  const highResult = await pool.query(`
    SELECT area_name, cbsa_code, state_code, wage_index, is_urban
    FROM cms_wage_index
    WHERE fiscal_year = $1
    ORDER BY wage_index DESC
    LIMIT 5
  `, [FISCAL_YEAR]);

  console.log('Top 5 Highest Wage Indexes:');
  for (const row of highResult.rows) {
    const code = row.is_urban ? `CBSA ${row.cbsa_code}` : `${row.state_code} Rural`;
    console.log(`  ${row.wage_index.toFixed(4)} - ${row.area_name} (${code})`);
  }

  const lowResult = await pool.query(`
    SELECT area_name, cbsa_code, state_code, wage_index, is_urban
    FROM cms_wage_index
    WHERE fiscal_year = $1
    ORDER BY wage_index ASC
    LIMIT 5
  `, [FISCAL_YEAR]);

  console.log('\nTop 5 Lowest Wage Indexes:');
  for (const row of lowResult.rows) {
    const code = row.is_urban ? `CBSA ${row.cbsa_code}` : `${row.state_code} Rural`;
    console.log(`  ${row.wage_index.toFixed(4)} - ${row.area_name} (${code})`);
  }
}

/**
 * Main collector function
 */
async function runCollector() {
  console.log('='.repeat(60));
  console.log('[CMS Wage Index Collector] Starting collection run');
  console.log(`[CMS Wage Index Collector] Fiscal Year: ${FISCAL_YEAR}`);
  console.log('='.repeat(60));

  // Check for data file
  if (!fs.existsSync(WAGE_INDEX_ZIP)) {
    throw new Error(`Wage index ZIP not found at ${WAGE_INDEX_ZIP}. Please download from CMS.`);
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
    console.log('[CMS Wage Index] Database connection successful');

    // Extract and parse wage index data
    const { urbanRecords, ruralRecords } = extractWageIndexData(WAGE_INDEX_ZIP);

    // Insert urban indexes
    const urbanResult = await insertUrbanIndexes(urbanRecords, pool);
    console.log(`[CMS Wage Index] Urban: ${urbanResult.inserted} inserted, ${urbanResult.updated} updated`);

    // Insert rural indexes
    const ruralResult = await insertRuralIndexes(ruralRecords, pool);
    console.log(`[CMS Wage Index] Rural: ${ruralResult.inserted} inserted, ${ruralResult.updated} updated`);

    // Print summary
    await printSummary(pool);

    console.log('\n[CMS Wage Index] Collection run complete');

  } catch (err) {
    console.error('[CMS Wage Index] Error:', err);
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

module.exports = { runCollector, FISCAL_YEAR };
