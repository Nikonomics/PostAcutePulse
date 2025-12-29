/**
 * CMS Home Health Service Area ZIP Collector
 *
 * Imports ZIP codes served by each home health agency
 * Uses multi-row inserts for fast import (~200K records in 2-3 min)
 */

const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
      const insertResult = await client.query(
        `INSERT INTO hh_extracts (extract_date, source_file, import_status)
         VALUES ($1, 'HH_Zip', 'pending')
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
 * Import ZIP data using multi-row inserts
 */
async function importZipData(extractId, data) {
  const BATCH_SIZE = 1000; // Larger batch for simple 3-column table
  let recordCount = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const rows = [];
    const values = [];
    let paramIndex = 1;

    for (const row of batch) {
      const ccn = row['CMS Certification Number (CCN)'];
      const zipCode = row['ZIP Code'];

      if (!ccn || !zipCode) continue;

      rows.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(extractId, ccn, zipCode);
      recordCount++;
    }

    if (rows.length === 0) continue;

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO hh_service_areas (extract_id, ccn, zip_code)
         VALUES ${rows.join(', ')}
         ON CONFLICT (extract_id, ccn, zip_code) DO NOTHING`,
        values
      );
      console.log(`  Inserted batch: ${recordCount} ZIP records so far...`);
    } finally {
      client.release();
    }
  }

  return recordCount;
}

/**
 * Import from CSV file
 */
async function importFromCSV(filePath, extractDate) {
  console.log(`Importing Home Health ZIP codes from: ${filePath}`);

  const extractId = await getExtractId(extractDate);
  const data = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => data.push(row))
      .on('end', async () => {
        try {
          console.log(`  Parsed ${data.length} rows from CSV`);
          const recordCount = await importZipData(extractId, data);
          console.log(`Import completed: ${recordCount} ZIP records`);
          resolve(extractId);
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

  console.log('CMS Home Health ZIP Collector');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case 'csv':
        const csvPath = args[1];
        const csvDate = args[2];
        if (!csvPath || !csvDate) {
          console.log('Usage: node cms-hh-zip-collector.js csv <file.csv> <YYYY-MM-DD>');
          break;
        }
        await importFromCSV(csvPath, csvDate);
        break;

      case 'help':
      default:
        console.log(`
Usage: node cms-hh-zip-collector.js <command> [options]

Commands:
  csv <file> <date>     Import from CSV file with extract date (YYYY-MM-DD)

Examples:
  node cms-hh-zip-collector.js csv ./HH_Zip_Oct2025.csv 2025-10-01
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
