/**
 * CMS Home Health Value-Based Purchasing (HHVBP) Collector
 *
 * Imports VBP performance scores and payment adjustments
 * Uses multi-row inserts for fast import
 *
 * Key fields imported:
 * - Total Performance Score (TPS)
 * - Adjusted Payment Percentage (APP) - the payment impact
 * - Component scores for OASIS, Claims, and CAHPS measures
 */

const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Column mappings - focusing on key fields from 252-column file
const HHVBP_COLUMN_MAPPINGS = {
  'CMS Certification Number (CCN)': 'ccn',
  'State': 'state',
  'Provider Name': 'provider_name',
  'Nationwide Cohort': 'cohort',
  'Total Performance Score (TPS)': 'total_performance_score',
  'Payment Year': 'payment_year',
  'Adjusted Payment Percentage (APP)': 'payment_adjustment_pct',

  // Component measure values (performance year)
  'Discharged to Community: PY HHA Measure Value': 'dtc_measure_value',
  'ACH: PY HHA Measure Value': 'ach_measure_value',
  'ED Use: PY HHA Measure Value': 'ed_use_measure_value',

  // Care points (final scores)
  'Discharged to Community: HHA Care Points': 'dtc_care_points',
  'Dyspnea: HHA Care Points': 'dyspnea_care_points',
  'Oral Medications: HHA Care Points': 'oral_meds_care_points',
  'TNC Mobility: HHA Care Points': 'tnc_mobility_care_points',
  'TNC Self-Care: HHA Care Points': 'tnc_selfcare_care_points',
  'ACH: HHA Care Points': 'ach_care_points',
  'ED Use: HHA Care Points': 'ed_use_care_points',
  'Care of Patients: HHA Care Points': 'care_of_patients_points',
  'Communication: HHA Care Points': 'communication_points',
  'Specific Care Issues: HHA Care Points': 'specific_care_points',
  'Overall Rating: HHA Care Points': 'overall_rating_points',
  'Willingness to Recommend: HHA Care Points': 'willingness_recommend_points'
};

/**
 * Parse a row into database format
 */
function parseRow(row) {
  const result = {};

  for (const [csvCol, dbCol] of Object.entries(HHVBP_COLUMN_MAPPINGS)) {
    let value = row[csvCol];

    if (value === undefined || value === '' || value === null) {
      result[dbCol] = null;
      continue;
    }

    // Clean percentage signs and commas
    if (typeof value === 'string') {
      value = value.replace(/%/g, '').replace(/,/g, '').trim();
    }

    // Float fields
    const floatFields = [
      'total_performance_score', 'payment_adjustment_pct',
      'dtc_measure_value', 'ach_measure_value', 'ed_use_measure_value',
      'dtc_care_points', 'dyspnea_care_points', 'oral_meds_care_points',
      'tnc_mobility_care_points', 'tnc_selfcare_care_points',
      'ach_care_points', 'ed_use_care_points',
      'care_of_patients_points', 'communication_points', 'specific_care_points',
      'overall_rating_points', 'willingness_recommend_points'
    ];

    // Integer fields
    const intFields = ['payment_year'];

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
 * Import VBP data using multi-row inserts
 */
async function importVBPData(performanceYear, data) {
  const BATCH_SIZE = 500;
  let recordCount = 0;

  const columns = [
    'ccn', 'state', 'provider_name', 'performance_year',
    'total_performance_score', 'payment_adjustment_pct',
    'oasis_score', 'claims_score', 'cahps_score'
  ];

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const rows = [];
    const values = [];
    let paramIndex = 1;

    for (const row of batch) {
      const parsed = parseRow(row);
      if (!parsed.ccn) continue;

      // Calculate component scores from care points
      // OASIS = avg of dtc, dyspnea, oral_meds, tnc_mobility, tnc_selfcare
      const oasisPoints = [
        parsed.dtc_care_points, parsed.dyspnea_care_points, parsed.oral_meds_care_points,
        parsed.tnc_mobility_care_points, parsed.tnc_selfcare_care_points
      ].filter(v => v !== null);
      const oasisScore = oasisPoints.length > 0
        ? oasisPoints.reduce((a, b) => a + b, 0) / oasisPoints.length
        : null;

      // Claims = avg of ach, ed_use
      const claimsPoints = [parsed.ach_care_points, parsed.ed_use_care_points].filter(v => v !== null);
      const claimsScore = claimsPoints.length > 0
        ? claimsPoints.reduce((a, b) => a + b, 0) / claimsPoints.length
        : null;

      // CAHPS = avg of care_of_patients, communication, specific_care, overall_rating, willingness
      const cahpsPoints = [
        parsed.care_of_patients_points, parsed.communication_points, parsed.specific_care_points,
        parsed.overall_rating_points, parsed.willingness_recommend_points
      ].filter(v => v !== null);
      const cahpsScore = cahpsPoints.length > 0
        ? cahpsPoints.reduce((a, b) => a + b, 0) / cahpsPoints.length
        : null;

      const rowPlaceholders = [];
      for (let j = 0; j < columns.length; j++) {
        rowPlaceholders.push(`$${paramIndex++}`);
      }
      rows.push(`(${rowPlaceholders.join(', ')})`);

      values.push(
        parsed.ccn,
        parsed.state,
        parsed.provider_name,
        parsed.payment_year || performanceYear,
        parsed.total_performance_score,
        parsed.payment_adjustment_pct,
        oasisScore,
        claimsScore,
        cahpsScore
      );
      recordCount++;
    }

    if (rows.length === 0) continue;

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO hh_vbp_scores (${columns.join(', ')})
         VALUES ${rows.join(', ')}
         ON CONFLICT (ccn, performance_year) DO UPDATE SET
           total_performance_score = EXCLUDED.total_performance_score,
           payment_adjustment_pct = EXCLUDED.payment_adjustment_pct,
           oasis_score = EXCLUDED.oasis_score,
           claims_score = EXCLUDED.claims_score,
           cahps_score = EXCLUDED.cahps_score`,
        values
      );
      console.log(`  Inserted batch: ${recordCount} VBP records so far...`);
    } finally {
      client.release();
    }
  }

  return recordCount;
}

/**
 * Import from CSV file
 */
async function importFromCSV(filePath, performanceYear) {
  console.log(`Importing HHVBP data from: ${filePath}`);
  console.log(`Performance Year: ${performanceYear}`);

  const data = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => data.push(row))
      .on('end', async () => {
        try {
          console.log(`  Parsed ${data.length} rows from CSV`);
          const recordCount = await importVBPData(performanceYear, data);
          console.log(`Import completed: ${recordCount} VBP records`);
          resolve(recordCount);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('CMS HHVBP Collector');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case 'csv':
        const csvPath = args[1];
        const year = parseInt(args[2]);
        if (!csvPath || !year) {
          console.log('Usage: node cms-hhvbp-collector.js csv <file.csv> <performance_year>');
          break;
        }
        await importFromCSV(csvPath, year);
        break;

      case 'help':
      default:
        console.log(`
Usage: node cms-hhvbp-collector.js <command> [options]

Commands:
  csv <file> <year>     Import from CSV file with performance year

Examples:
  node cms-hhvbp-collector.js csv ./HHVBP_Provider_PerformanceYear_2023.csv 2023
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

module.exports = { importFromCSV };

if (require.main === module) {
  main();
}
