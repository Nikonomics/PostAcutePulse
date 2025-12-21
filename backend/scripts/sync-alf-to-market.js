const { Client } = require('pg');

const MAIN_URL = 'postgresql://snfalyze_db_user:f0j8PFEmXBepKJXS2lwf7JXTte5mBWQs@dpg-d4oaisc9c44c73fb1um0-a.oregon-postgres.render.com/snfalyze_db?sslmode=require';
const MARKET_URL = 'postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data?sslmode=require';

async function syncALF() {
  const mainClient = new Client({ connectionString: MAIN_URL, ssl: { rejectUnauthorized: false } });
  const marketClient = new Client({ connectionString: MARKET_URL, ssl: { rejectUnauthorized: false } });

  await mainClient.connect();
  await marketClient.connect();

  console.log('=== Syncing ALF Facilities from Main DB to Market DB ===\n');

  // Get column names from market DB (to ensure we insert the right columns)
  const colsResult = await marketClient.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'alf_facilities' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  const marketCols = colsResult.rows.map(r => r.column_name).filter(c => c !== 'id');
  console.log('Market DB columns:', marketCols.join(', '));

  // Get all facilities from both DBs using a unique key (facility_name + address + city + state)
  console.log('\nFinding facilities in Main DB that are not in Market DB...');

  const mainFacilities = await mainClient.query(`
    SELECT * FROM alf_facilities
  `);

  const marketFacilities = await marketClient.query(`
    SELECT facility_name, address, city, state FROM alf_facilities
  `);

  // Create a set of existing facilities in Market DB
  const marketSet = new Set();
  for (const f of marketFacilities.rows) {
    const key = `${(f.facility_name || '').toLowerCase()}|${(f.address || '').toLowerCase()}|${(f.city || '').toLowerCase()}|${(f.state || '').toLowerCase()}`;
    marketSet.add(key);
  }

  // Find facilities that don't exist in Market DB
  const toInsert = [];
  for (const f of mainFacilities.rows) {
    const key = `${(f.facility_name || '').toLowerCase()}|${(f.address || '').toLowerCase()}|${(f.city || '').toLowerCase()}|${(f.state || '').toLowerCase()}`;
    if (!marketSet.has(key)) {
      toInsert.push(f);
    }
  }

  console.log(`Found ${toInsert.length} facilities to sync\n`);

  if (toInsert.length === 0) {
    console.log('No new facilities to sync!');
    await mainClient.end();
    await marketClient.end();
    return;
  }

  // Show sample of what we're about to insert
  console.log('Sample of facilities to insert:');
  for (let i = 0; i < Math.min(5, toInsert.length); i++) {
    const f = toInsert[i];
    console.log(`  - ${f.facility_name}, ${f.city}, ${f.state}`);
  }
  console.log('');

  // Insert in batches
  let inserted = 0;
  let errors = 0;

  for (const facility of toInsert) {
    try {
      // Build insert query dynamically based on market columns
      const values = [];
      const placeholders = [];
      let idx = 1;

      for (const col of marketCols) {
        if (facility[col] !== undefined) {
          values.push(facility[col]);
          placeholders.push(`$${idx}`);
          idx++;
        } else {
          values.push(null);
          placeholders.push(`$${idx}`);
          idx++;
        }
      }

      const insertQuery = `
        INSERT INTO alf_facilities (${marketCols.join(', ')})
        VALUES (${placeholders.join(', ')})
      `;

      await marketClient.query(insertQuery, values);
      inserted++;

      if (inserted % 20 === 0) {
        console.log(`  Inserted ${inserted}/${toInsert.length}...`);
      }
    } catch (e) {
      errors++;
      if (errors <= 3) {
        console.log(`  Error inserting ${facility.facility_name}: ${e.message}`);
      }
    }
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Errors: ${errors}`);

  // Verify final counts
  const mainFinalCount = await mainClient.query('SELECT COUNT(*) FROM alf_facilities');
  const marketFinalCount = await marketClient.query('SELECT COUNT(*) FROM alf_facilities');
  console.log(`\nFinal counts:`);
  console.log(`  Main DB: ${mainFinalCount.rows[0].count}`);
  console.log(`  Market DB: ${marketFinalCount.rows[0].count}`);

  await mainClient.end();
  await marketClient.end();
}

syncALF().catch(console.error);
