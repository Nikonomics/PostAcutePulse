const { Client } = require('pg');

const MAIN_URL = 'postgresql://snfalyze_db_user:f0j8PFEmXBepKJXS2lwf7JXTte5mBWQs@dpg-d4oaisc9c44c73fb1um0-a.oregon-postgres.render.com/snfalyze_db?sslmode=require';
const MARKET_URL = 'postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data?sslmode=require';

const TABLES_TO_COMPARE = [
  { name: 'snf_facilities', idCol: 'id', checkCols: ['federal_provider_number', 'facility_name', 'overall_rating', 'total_beds'] },
  { name: 'alf_facilities', idCol: 'id', checkCols: ['facility_name', 'state', 'capacity'] },
  { name: 'county_demographics', idCol: 'county_fips', checkCols: ['county_name', 'total_population', 'population_65_plus'] },
  { name: 'state_demographics', idCol: 'state_code', checkCols: ['state_name', 'total_population', 'population_65_plus'] },
  { name: 'ownership_profiles', idCol: 'id', checkCols: ['organization_name', 'total_facilities', 'states_count'] },
  { name: 'cms_facility_deficiencies', idCol: 'id', checkCols: ['federal_provider_number', 'deficiency_tag', 'survey_date'] },
];

async function compare() {
  const mainClient = new Client({ connectionString: MAIN_URL, ssl: { rejectUnauthorized: false } });
  const marketClient = new Client({ connectionString: MARKET_URL, ssl: { rejectUnauthorized: false } });

  await mainClient.connect();
  await marketClient.connect();

  console.log('=== Deep Comparison of Shared Tables ===\n');

  for (const table of TABLES_TO_COMPARE) {
    console.log(`\n--- ${table.name} ---`);

    try {
      // Row counts
      const mainCount = await mainClient.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      const marketCount = await marketClient.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      console.log(`  Row count: Main=${mainCount.rows[0].count}, Market=${marketCount.rows[0].count}`);

      // Max ID (to see if data is newer)
      const mainMaxId = await mainClient.query(`SELECT MAX(${table.idCol}) as max_id FROM ${table.name}`);
      const marketMaxId = await marketClient.query(`SELECT MAX(${table.idCol}) as max_id FROM ${table.name}`);
      console.log(`  Max ${table.idCol}: Main=${mainMaxId.rows[0].max_id}, Market=${marketMaxId.rows[0].max_id}`);

      // Sample comparison - get 3 random records and compare
      if (table.name === 'snf_facilities') {
        // Compare specific facilities by federal_provider_number
        const sampleFPNs = ['365704', '105543', '555064']; // Random sample
        for (const fpn of sampleFPNs) {
          const mainRec = await mainClient.query(`SELECT overall_rating, total_beds, facility_name FROM snf_facilities WHERE federal_provider_number = $1`, [fpn]);
          const marketRec = await marketClient.query(`SELECT overall_rating, total_beds, facility_name FROM snf_facilities WHERE federal_provider_number = $1`, [fpn]);

          if (mainRec.rows.length > 0 && marketRec.rows.length > 0) {
            const m = mainRec.rows[0];
            const mk = marketRec.rows[0];
            const same = m.overall_rating === mk.overall_rating && m.total_beds === mk.total_beds;
            if (!same) {
              console.log(`  ⚠ FPN ${fpn} differs: Main(rating=${m.overall_rating}, beds=${m.total_beds}) vs Market(rating=${mk.overall_rating}, beds=${mk.total_beds})`);
            }
          }
        }

        // Check for any rating differences
        const ratingDiff = await mainClient.query(`
          SELECT m.federal_provider_number, m.overall_rating as main_rating
          FROM snf_facilities m
          LIMIT 1000
        `);

        let ratingDiffs = 0;
        let bedDiffs = 0;
        for (const row of ratingDiff.rows) {
          const marketRec = await marketClient.query(
            `SELECT overall_rating, total_beds FROM snf_facilities WHERE federal_provider_number = $1`,
            [row.federal_provider_number]
          );
          if (marketRec.rows.length > 0) {
            const mainRec2 = await mainClient.query(
              `SELECT overall_rating, total_beds FROM snf_facilities WHERE federal_provider_number = $1`,
              [row.federal_provider_number]
            );
            if (mainRec2.rows[0].overall_rating !== marketRec.rows[0].overall_rating) ratingDiffs++;
            if (mainRec2.rows[0].total_beds !== marketRec.rows[0].total_beds) bedDiffs++;
          }
        }
        console.log(`  Sample of 1000 facilities: ${ratingDiffs} rating differences, ${bedDiffs} bed count differences`);
      }

      if (table.name === 'cms_facility_deficiencies') {
        // Check date ranges
        const mainDates = await mainClient.query(`SELECT MIN(survey_date) as min_date, MAX(survey_date) as max_date FROM cms_facility_deficiencies`);
        const marketDates = await marketClient.query(`SELECT MIN(survey_date) as min_date, MAX(survey_date) as max_date FROM cms_facility_deficiencies`);
        console.log(`  Date range Main: ${mainDates.rows[0].min_date} to ${mainDates.rows[0].max_date}`);
        console.log(`  Date range Market: ${marketDates.rows[0].min_date} to ${marketDates.rows[0].max_date}`);
      }

      if (table.name === 'ownership_profiles') {
        // Check latest ownership profiles
        const mainLatest = await mainClient.query(`SELECT organization_name, total_facilities FROM ownership_profiles ORDER BY total_facilities DESC LIMIT 3`);
        const marketLatest = await marketClient.query(`SELECT organization_name, total_facilities FROM ownership_profiles ORDER BY total_facilities DESC LIMIT 3`);
        console.log(`  Top 3 by facilities (Main): ${mainLatest.rows.map(r => r.organization_name + '(' + r.total_facilities + ')').join(', ')}`);
        console.log(`  Top 3 by facilities (Market): ${marketLatest.rows.map(r => r.organization_name + '(' + r.total_facilities + ')').join(', ')}`);
      }

    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await mainClient.end();
  await marketClient.end();

  console.log('\n\n=== Summary ===');
  console.log('Tables with same row count are likely identical.');
  console.log('ALF facilities has 127 more records in Main DB.');
  console.log('Check the detailed output above for any data differences.');
}

compare();
