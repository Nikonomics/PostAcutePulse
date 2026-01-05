/**
 * Load HUD ZIP-to-County Crosswalk
 *
 * Reads ZIP_COUNTY_092025.xlsx and populates hud_zip_county table
 */

const xlsx = require('xlsx');
const { Pool } = require('pg');

const EXCEL_PATH = '/Users/nikolashulewsky/Desktop/ZIP_COUNTY_092025.xlsx';

async function main() {
  console.log('=== Load ZIP-County Crosswalk ===\n');

  // Read Excel
  console.log('Reading Excel file...');
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log(`Loaded ${data.length} rows`);

  // Deduplicate by ZIP (take highest ratio for multi-county ZIPs)
  const zipMap = new Map();
  for (const row of data) {
    const zip = String(row.ZIP).padStart(5, '0');
    const ratio = parseFloat(row.TOT_RATIO) || 0;
    if (!zipMap.has(zip) || ratio > zipMap.get(zip).ratio) {
      zipMap.set(zip, {
        zip5: zip,
        county_fips: row.COUNTY ? String(Math.floor(row.COUNTY)).padStart(5, '0') : null,
        city: row.USPS_ZIP_PREF_CITY || '',
        state: row.USPS_ZIP_PREF_STATE || row.STATE || '',
        ratio: ratio
      });
    }
  }
  console.log(`Unique ZIPs after deduplication: ${zipMap.size}`);

  // Connect to database
  const pool = new Pool({
    connectionString: process.env.MARKET_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Truncate existing data
    console.log('\nTruncating existing data...');
    await pool.query('TRUNCATE TABLE hud_zip_county');

    // Batch insert
    console.log('Inserting data...');
    const values = Array.from(zipMap.values());
    let inserted = 0;
    const batchSize = 500;

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const placeholders = batch.map((_, idx) =>
        `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`
      ).join(', ');
      const params = batch.flatMap(r => [r.zip5, r.county_fips, r.city, r.state, r.ratio]);

      await pool.query(
        `INSERT INTO hud_zip_county (zip5, county_fips, city, state, ratio) VALUES ${placeholders}`,
        params
      );
      inserted += batch.length;
      if (inserted % 10000 === 0) {
        console.log(`  Inserted ${inserted}...`);
      }
    }

    console.log(`\nTotal inserted: ${inserted} rows`);

    // Verify
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_zips,
        COUNT(DISTINCT county_fips) as unique_counties,
        COUNT(DISTINCT state) as unique_states
      FROM hud_zip_county
    `);
    console.log('\nVerification:');
    console.log(`  Total ZIPs: ${result.rows[0].total_zips}`);
    console.log(`  Unique Counties: ${result.rows[0].unique_counties}`);
    console.log(`  Unique States: ${result.rows[0].unique_states}`);

    // Sample data
    const sample = await pool.query(`
      SELECT * FROM hud_zip_county
      ORDER BY state, zip5
      LIMIT 5
    `);
    console.log('\nSample data:');
    console.table(sample.rows);

    console.log('\n=== Done ===');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
