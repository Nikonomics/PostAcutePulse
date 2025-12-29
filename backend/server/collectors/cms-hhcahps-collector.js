/**
 * CMS HHCAHPS (Home Health Consumer Assessment of Healthcare Providers and Systems) Collector
 *
 * Imports patient satisfaction survey data for home health agencies
 *
 * Data Source: CMS Home Health Compare HHCAHPS data
 */

const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Market database connection
const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Column mappings from CSV headers to database columns
const HHCAHPS_COLUMN_MAPPINGS = {
  'CMS Certification Number (CCN)': 'ccn',
  'HHCAHPS Survey Summary Star Rating': 'summary_star_rating',
  'HHCAHPS Survey Summary Star Rating Footnote': 'summary_star_fn',

  'Star Rating for health team gave care in a professional way': 'care_of_patients_star',
  'Percent of patients who reported that their home health team gave care in a professional way': 'care_of_patients_pct',
  'Footnote for Percent of patients who reported that their home health team gave care in a professional way': 'care_of_patients_fn',

  'Star Rating for health team communicated well with them': 'communication_star',
  'Percent of patients who reported that their home health team communicated well with them': 'communication_pct',
  'Footnote for Percent of patients who reported that their home health team communicated well with them': 'communication_fn',

  'Star Rating team discussed medicines, pain, and home safety': 'specific_care_star',
  'Percent of patients who reported that their home health team discussed medicines, pain, and home safety with them': 'specific_care_pct',
  'Footnote for Percent of patients who reported that their home health team discussed medicines, pain, and home safety with them': 'specific_care_fn',

  'Star Rating for how patients rated overall care from agency': 'overall_rating_star',
  'Percent of patients who gave their home health agency a rating of 9 or 10 on a scale from 0 (lowest) to 10 (highest)': 'overall_rating_pct',
  'Footnote for Percent of patients who gave their home health agency a rating of 9 or 10 on a scale from 0(lowest) to 10(highest)': 'overall_rating_fn',

  'Percent of patients who reported YES, they would definitely recommend the home health agency to friends and family': 'recommend_agency_pct',
  'Footnote for Percent of patients who reported YES, they would definitely recommend the home health agency to friends and family': 'recommend_agency_fn',

  'Number of completed Surveys': 'survey_response_count',
  'Survey response rate': 'survey_response_rate'
};

/**
 * Parse a CSV row into database format
 */
function parseRow(row) {
  const result = {};

  for (const [csvCol, dbCol] of Object.entries(HHCAHPS_COLUMN_MAPPINGS)) {
    let value = row[csvCol];

    if (value === undefined || value === '' || value === '-' || value === null) {
      result[dbCol] = null;
      continue;
    }

    // Clean up values
    if (typeof value === 'string') {
      value = value.replace(/,/g, '').trim();
    }

    // Float fields
    const floatFields = [
      'summary_star_rating',
      'care_of_patients_star', 'care_of_patients_pct',
      'communication_star', 'communication_pct',
      'specific_care_star', 'specific_care_pct',
      'overall_rating_star', 'overall_rating_pct',
      'recommend_agency_pct', 'survey_response_rate'
    ];

    // Integer fields
    const intFields = ['survey_response_count'];

    if (floatFields.includes(dbCol)) {
      result[dbCol] = value ? parseFloat(value) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else if (intFields.includes(dbCol)) {
      result[dbCol] = value ? parseInt(value, 10) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else {
      result[dbCol] = value;
    }
  }

  return result;
}

/**
 * Get extract ID for a date
 */
async function getExtractId(extractDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT extract_id FROM hh_extracts WHERE extract_date = $1',
      [extractDate]
    );

    if (result.rows.length === 0) {
      // Create extract if it doesn't exist
      const insertResult = await client.query(
        `INSERT INTO hh_extracts (extract_date, source_file, import_status)
         VALUES ($1, 'HHCAHPS', 'pending')
         RETURNING extract_id`,
        [extractDate]
      );
      return insertResult.rows[0].extract_id;
    }

    return result.rows[0].extract_id;
  } finally {
    client.release();
  }
}

/**
 * Import HHCAHPS data from parsed rows using multi-row inserts
 * Much faster than individual inserts
 */
async function importCAHPSData(extractId, data) {
  const BATCH_SIZE = 500;
  let recordCount = 0;

  // Define columns in fixed order for multi-row insert
  const columns = [
    'extract_id', 'ccn',
    'summary_star_rating', 'summary_star_fn',
    'care_of_patients_star', 'care_of_patients_pct', 'care_of_patients_fn',
    'communication_star', 'communication_pct', 'communication_fn',
    'specific_care_star', 'specific_care_pct', 'specific_care_fn',
    'overall_rating_star', 'overall_rating_pct', 'overall_rating_fn',
    'recommend_agency_pct', 'recommend_agency_fn',
    'survey_response_count', 'survey_response_rate'
  ];

  // Process in batches
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const rows = [];
    const values = [];
    let paramIndex = 1;

    for (const row of batch) {
      const parsed = parseRow(row);
      if (!parsed.ccn) continue;

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
        `INSERT INTO hh_cahps_snapshots (${columns.join(', ')})
         VALUES ${rows.join(', ')}
         ON CONFLICT (extract_id, ccn) DO UPDATE SET
           summary_star_rating = EXCLUDED.summary_star_rating,
           care_of_patients_star = EXCLUDED.care_of_patients_star,
           overall_rating_star = EXCLUDED.overall_rating_star`,
        values
      );
      console.log(`  Inserted batch: ${recordCount} CAHPS records so far...`);
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
  console.log(`Importing HHCAHPS data from: ${filePath}`);

  const extractId = await getExtractId(extractDate);
  const data = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', async () => {
        try {
          const recordCount = await importCAHPSData(extractId, data);
          console.log(`Import completed: ${recordCount} HHCAHPS records`);
          resolve(extractId);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('CMS HHCAHPS Collector');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case 'csv':
        const csvPath = args[1];
        const csvDate = args[2];
        if (!csvPath || !csvDate) {
          console.log('Usage: node cms-hhcahps-collector.js csv <file.csv> <YYYY-MM-DD>');
          break;
        }
        await importFromCSV(csvPath, csvDate);
        break;

      case 'help':
      default:
        console.log(`
Usage: node cms-hhcahps-collector.js <command> [options]

Commands:
  csv <file> <date>     Import from CSV file with extract date (YYYY-MM-DD)

Examples:
  node cms-hhcahps-collector.js csv ./HHCAHPS_Provider_Oct2025.csv 2025-10-01
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
  getExtractId,
  importCAHPSData
};

// Run if called directly
if (require.main === module) {
  main();
}
