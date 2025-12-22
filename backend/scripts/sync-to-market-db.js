#!/usr/bin/env node
/**
 * Sync Market Tables from Main DB to Shared Market DB
 *
 * This script syncs the 10 shared market tables from the main snfalyze_db
 * to the shared snf_market_data database used across multiple projects.
 *
 * Usage:
 *   node scripts/sync-to-market-db.js [options]
 *
 * Options:
 *   --table=<name>    Sync only a specific table
 *   --dry-run         Show what would be synced without making changes
 *   --force           Skip confirmation prompt
 *
 * Environment Variables:
 *   DATABASE_URL        - Main database connection string
 *   MARKET_DATABASE_URL - Market database connection string
 */

const { Client } = require('pg');

// Default connection strings (can be overridden by env vars)
const MAIN_URL = process.env.DATABASE_URL ||
  'postgresql://snfalyze_db_user:f0j8PFEmXBepKJXS2lwf7JXTte5mBWQs@dpg-d4oaisc9c44c73fb1um0-a.oregon-postgres.render.com/snfalyze_db?sslmode=require';

const MARKET_URL = process.env.MARKET_DATABASE_URL ||
  'postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data?sslmode=require';

// Tables to sync (in dependency order)
const MARKET_TABLES = [
  { name: 'state_demographics', primaryKey: 'id' },
  { name: 'county_demographics', primaryKey: 'id' },
  { name: 'cbsas', primaryKey: 'cbsa_code' },
  { name: 'county_cbsa_crosswalk', primaryKey: 'id' },
  { name: 'bls_state_wages', primaryKey: 'id' },
  { name: 'cms_wage_index', primaryKey: 'id' },
  { name: 'ownership_profiles', primaryKey: 'id' },
  { name: 'snf_facilities', primaryKey: 'id' },
  { name: 'alf_facilities', primaryKey: 'id' },
  { name: 'cms_facility_deficiencies', primaryKey: 'id' },
  // M&A Analytics tables (ownership change tracking)
  { name: 'cms_extracts', primaryKey: 'extract_id' },
  { name: 'facility_events', primaryKey: 'event_id' },
  { name: 'facility_ownership_details', primaryKey: 'id' },
];

const BATCH_SIZE = 500;

// Parse command line args
const args = process.argv.slice(2);
const options = {
  table: null,
  dryRun: false,
  force: false,
};

for (const arg of args) {
  if (arg.startsWith('--table=')) {
    options.table = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--force') {
    options.force = true;
  }
}

async function getTableColumns(client, tableName) {
  const result = await client.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

async function syncTable(mainClient, marketClient, tableConfig, dryRun = false) {
  const { name: tableName, primaryKey } = tableConfig;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Syncing: ${tableName}`);
  console.log('═'.repeat(60));

  // Get columns from main
  const mainColumns = await getTableColumns(mainClient, tableName);
  const marketColumns = await getTableColumns(marketClient, tableName);

  if (mainColumns.length === 0) {
    console.log(`  ⚠ Table does not exist in main DB, skipping`);
    return { table: tableName, status: 'skipped', reason: 'not in main' };
  }

  const mainColNames = new Set(mainColumns.map(c => c.column_name));
  const marketColNames = new Set(marketColumns.map(c => c.column_name));

  // Check for schema differences
  const missingInMarket = [...mainColNames].filter(c => !marketColNames.has(c));
  const extraInMarket = [...marketColNames].filter(c => !mainColNames.has(c));

  console.log(`  Main DB: ${mainColumns.length} columns, Market DB: ${marketColumns.length} columns`);

  if (missingInMarket.length > 0 || extraInMarket.length > 0) {
    console.log(`  Schema differences detected:`);
    if (missingInMarket.length > 0) {
      console.log(`    - Missing in market: ${missingInMarket.length} columns`);
    }
    if (extraInMarket.length > 0) {
      console.log(`    - Extra in market: ${extraInMarket.length} columns`);
    }
    console.log(`  Will recreate table with main DB schema`);
  }

  // Get row counts
  const mainCount = await mainClient.query(`SELECT COUNT(*) FROM "${tableName}"`);
  const marketCount = marketColumns.length > 0
    ? await marketClient.query(`SELECT COUNT(*) FROM "${tableName}"`)
    : { rows: [{ count: 0 }] };

  console.log(`  Rows - Main: ${mainCount.rows[0].count}, Market: ${marketCount.rows[0].count}`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would sync ${mainCount.rows[0].count} rows`);
    return { table: tableName, status: 'dry-run', rows: parseInt(mainCount.rows[0].count) };
  }

  // Drop and recreate table if schema differs significantly
  const needsRecreate = missingInMarket.length > 0 || marketColumns.length === 0;

  if (needsRecreate) {
    console.log(`  Dropping and recreating table...`);
    await marketClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);

    // Build CREATE TABLE statement
    const colDefs = mainColumns.map(col => {
      let def = `"${col.column_name}" `;

      // Handle primary key / serial
      if (col.column_name === primaryKey && col.data_type === 'integer') {
        return `"${col.column_name}" SERIAL PRIMARY KEY`;
      }

      let type = col.data_type;
      if (type === 'character varying') {
        type = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'TEXT';
      } else if (type === 'timestamp without time zone') {
        type = 'TIMESTAMP';
      } else if (type === 'timestamp with time zone') {
        type = 'TIMESTAMPTZ';
      }

      return def + type;
    });

    await marketClient.query(`CREATE TABLE "${tableName}" (${colDefs.join(', ')})`);
    console.log(`  Created table with ${mainColumns.length} columns`);
  } else {
    // Just truncate if schema matches
    console.log(`  Truncating existing data...`);
    await marketClient.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
  }

  // Copy data
  console.log(`  Copying data...`);
  const colNames = mainColumns.map(c => `"${c.column_name}"`).join(', ');
  const data = await mainClient.query(`SELECT ${colNames} FROM "${tableName}" ORDER BY "${primaryKey}"`);

  let inserted = 0;
  for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
    const batch = data.rows.slice(i, i + BATCH_SIZE);
    const placeholders = [];
    const values = [];
    let paramIndex = 1;

    for (const row of batch) {
      const rowPlaceholders = [];
      for (const col of mainColumns) {
        rowPlaceholders.push(`$${paramIndex++}`);
        values.push(row[col.column_name]);
      }
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    await marketClient.query(
      `INSERT INTO "${tableName}" (${colNames}) VALUES ${placeholders.join(', ')}`,
      values
    );
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${data.rows.length}`);
  }

  // Reset sequence if applicable
  if (needsRecreate && primaryKey === 'id') {
    try {
      const maxId = await marketClient.query(`SELECT MAX(id) FROM "${tableName}"`);
      if (maxId.rows[0].max) {
        await marketClient.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), $2)`,
          [tableName, maxId.rows[0].max]
        );
      }
    } catch (e) {
      // Sequence may not exist for all tables
    }
  }

  // Add indexes for key tables
  if (tableName === 'snf_facilities') {
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_snf_federal_provider ON snf_facilities(federal_provider_number)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_snf_state_county ON snf_facilities(state, county)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_snf_state ON snf_facilities(state)`);
  } else if (tableName === 'alf_facilities') {
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_alf_state_county ON alf_facilities(state, county)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_alf_state ON alf_facilities(state)`);
  } else if (tableName === 'cms_facility_deficiencies') {
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_def_fpn ON cms_facility_deficiencies(federal_provider_number)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_def_date ON cms_facility_deficiencies(survey_date)`);
  } else if (tableName === 'cms_extracts') {
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_extracts_date ON cms_extracts(extract_date)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_extracts_status ON cms_extracts(import_status)`);
  } else if (tableName === 'facility_events') {
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fe_ccn ON facility_events(ccn)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fe_date ON facility_events(event_date)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fe_type ON facility_events(event_type)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fe_state ON facility_events(state)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fe_ccn_type ON facility_events(ccn, event_type)`);
  } else if (tableName === 'facility_ownership_details') {
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fod_ccn ON facility_ownership_details(ccn)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fod_extract ON facility_ownership_details(extract_id)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fod_ccn_extract ON facility_ownership_details(ccn, extract_id)`);
    await marketClient.query(`CREATE INDEX IF NOT EXISTS idx_fod_owner_name ON facility_ownership_details(owner_name)`);
  }

  console.log(`\n  ✓ Synced ${inserted} rows`);
  return { table: tableName, status: 'synced', rows: inserted };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          MARKET DATABASE SYNC                                ║');
  console.log('║          Main DB → Market DB                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Main DB:   ${MAIN_URL.split('@')[1]?.split('/')[0] || 'localhost'}`);
  console.log(`Market DB: ${MARKET_URL.split('@')[1]?.split('/')[0] || 'localhost'}`);
  console.log(`Mode:      ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);

  if (options.table) {
    console.log(`Table:     ${options.table} only`);
  }

  const mainClient = new Client({ connectionString: MAIN_URL });
  const marketClient = new Client({ connectionString: MARKET_URL });

  try {
    await mainClient.connect();
    await marketClient.connect();
    console.log('\n✓ Connected to both databases');

    const tablesToSync = options.table
      ? MARKET_TABLES.filter(t => t.name === options.table)
      : MARKET_TABLES;

    if (tablesToSync.length === 0) {
      console.error(`\n✗ Table "${options.table}" not found in market tables list`);
      console.log('Available tables:', MARKET_TABLES.map(t => t.name).join(', '));
      process.exit(1);
    }

    const results = [];
    const startTime = Date.now();

    for (const tableConfig of tablesToSync) {
      const result = await syncTable(mainClient, marketClient, tableConfig, options.dryRun);
      results.push(result);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('SYNC SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Time elapsed: ${elapsed}s`);
    console.log('');

    const synced = results.filter(r => r.status === 'synced');
    const skipped = results.filter(r => r.status === 'skipped');
    const dryRun = results.filter(r => r.status === 'dry-run');

    if (synced.length > 0) {
      console.log(`✓ Synced: ${synced.length} tables, ${synced.reduce((sum, r) => sum + r.rows, 0).toLocaleString()} total rows`);
    }
    if (skipped.length > 0) {
      console.log(`⚠ Skipped: ${skipped.length} tables`);
    }
    if (dryRun.length > 0) {
      console.log(`[DRY RUN] Would sync: ${dryRun.length} tables, ${dryRun.reduce((sum, r) => sum + r.rows, 0).toLocaleString()} total rows`);
    }

    console.log('\n✓ Sync complete!');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  } finally {
    await mainClient.end();
    await marketClient.end();
  }
}

main();
