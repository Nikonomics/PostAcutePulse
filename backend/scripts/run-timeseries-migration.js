import fs from 'fs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
const pool = new Pool({ connectionString });

async function runMigration() {
  console.log('Running time-series tables migration...\n');
  console.log(`Connecting to: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const migrationPath = path.join(__dirname, '../server/migrations/create-facility-timeseries-tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolons but be careful with function definitions
  // We'll run the whole file as one transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Run the migration
    await client.query(sql);

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

    // Verify tables were created
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'cms_extracts',
          'facility_snapshots',
          'quality_snapshots',
          'penalty_snapshots',
          'deficiency_snapshots',
          'facility_events',
          'market_events',
          'facility_monthly_metrics',
          'market_monthly_metrics',
          'facility_features',
          'facility_predictions',
          'market_opportunities'
        )
      ORDER BY table_name
    `);

    console.log('\nTables created:');
    tables.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
