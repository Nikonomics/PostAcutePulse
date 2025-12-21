const { Client } = require('pg');

const MAIN_URL = 'postgresql://snfalyze_db_user:f0j8PFEmXBepKJXS2lwf7JXTte5mBWQs@dpg-d4oaisc9c44c73fb1um0-a.oregon-postgres.render.com/snfalyze_db?sslmode=require';
const MARKET_URL = 'postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data?sslmode=require';

async function compare() {
  const mainClient = new Client({ connectionString: MAIN_URL, ssl: { rejectUnauthorized: false } });
  const marketClient = new Client({ connectionString: MARKET_URL, ssl: { rejectUnauthorized: false } });

  await mainClient.connect();
  await marketClient.connect();

  console.log('=== ALF Facilities Comparison ===\n');

  // Check states breakdown
  console.log('By State (showing differences):');
  const mainStates = await mainClient.query('SELECT state, COUNT(*) as count FROM alf_facilities GROUP BY state ORDER BY state');
  const marketStates = await marketClient.query('SELECT state, COUNT(*) as count FROM alf_facilities GROUP BY state ORDER BY state');

  const mainMap = new Map(mainStates.rows.map(r => [r.state, parseInt(r.count)]));
  const marketMap = new Map(marketStates.rows.map(r => [r.state, parseInt(r.count)]));

  for (const [state, mainCount] of mainMap) {
    const marketCount = marketMap.get(state) || 0;
    if (mainCount !== marketCount) {
      console.log('  ' + state + ': Main=' + mainCount + ', Market=' + marketCount + ' (diff: ' + (mainCount - marketCount) + ')');
    }
  }

  // Check for states only in market
  for (const [state, marketCount] of marketMap) {
    if (!mainMap.has(state)) {
      console.log('  ' + state + ': Main=0, Market=' + marketCount);
    }
  }

  // Check latest records
  console.log('\nLatest records in Main DB:');
  const mainLatest = await mainClient.query('SELECT id, facility_name, state, city FROM alf_facilities ORDER BY id DESC LIMIT 3');
  mainLatest.rows.forEach(r => console.log('  ID ' + r.id + ': ' + r.facility_name + ', ' + r.city + ', ' + r.state));

  console.log('\nLatest records in Market DB:');
  const marketLatest = await marketClient.query('SELECT id, facility_name, state, city FROM alf_facilities ORDER BY id DESC LIMIT 3');
  marketLatest.rows.forEach(r => console.log('  ID ' + r.id + ': ' + r.facility_name + ', ' + r.city + ', ' + r.state));

  await mainClient.end();
  await marketClient.end();
}

compare();
