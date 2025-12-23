/**
 * Import historical health inspection cutpoints to database
 */
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://localhost:5432/snf_platform'
});

async function importCutpoints() {
  const data = JSON.parse(fs.readFileSync('/tmp/cutpoints_historical.json', 'utf8'));

  console.log('Importing ' + data.length + ' records...');

  let imported = 0;
  let skipped = 0;

  for (const row of data) {
    try {
      await pool.query(
        `INSERT INTO health_inspection_cutpoints
         (month, state, five_star_max, four_star_max, three_star_max, two_star_max, one_star_min)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (month, state) DO UPDATE SET
           five_star_max = EXCLUDED.five_star_max,
           four_star_max = EXCLUDED.four_star_max,
           three_star_max = EXCLUDED.three_star_max,
           two_star_max = EXCLUDED.two_star_max,
           one_star_min = EXCLUDED.one_star_min`,
        [row.month, row.state, row.five_star_max, row.four_star_max,
         row.three_star_max, row.two_star_max, row.one_star_min]
      );
      imported++;
    } catch (err) {
      console.error('Error importing ' + row.state + ' ' + row.month + ': ' + err.message);
      skipped++;
    }
  }

  console.log('Imported: ' + imported);
  console.log('Skipped: ' + skipped);

  // Verify
  const result = await pool.query('SELECT COUNT(*) as count, MIN(month) as min_month, MAX(month) as max_month FROM health_inspection_cutpoints');
  console.log('\nDatabase now has:');
  console.log('  Total records: ' + result.rows[0].count);
  console.log('  Date range: ' + result.rows[0].min_month + ' to ' + result.rows[0].max_month);

  await pool.end();
}

importCutpoints().catch(console.error);
