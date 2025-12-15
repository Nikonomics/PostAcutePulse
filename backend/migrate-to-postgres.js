/**
 * SNFalyze SQLite to PostgreSQL Migration Script
 *
 * This script migrates all SNFalyze-specific data from SQLite to PostgreSQL.
 * It SKIPS alf_facilities since that already exists in public schema.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Tables to migrate (excluding alf_facilities which is already in public schema)
const TABLES_TO_MIGRATE = [
  'users',
  'user_notifications',
  'deals',
  'master_deals',
  'deals_backup',
  'deal_facilities',
  'deal_documents',
  'deal_comments',
  'comment_mentions',
  'deal_change_logs',
  'deal_team_members',
  'deal_external_advisors',
  'deal_user_views',
  'deal_monthly_financials',
  'deal_monthly_expenses',
  'deal_monthly_census',
  'deal_expense_ratios',
  'deal_rate_schedules',
  'deal_proforma_scenarios',
  'benchmark_configurations',
  'due_diligence_projects',
  'dd_analyzed_contracts',
  'deal_extracted_text',
  'document_types',
  'document_tags',
  'document_type_tag_assignments',
  'functional_categories',
  'service_subcategories',
  'vendors',
  'states',
  'facilities',
  'recent_activities'
];

// Connect to SQLite
const sqlitePath = path.join(__dirname, 'database.sqlite');
const sqliteDb = new sqlite3.Database(sqlitePath);

// Connect to PostgreSQL (using DATABASE_URL from .env)
const pgSequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  define: {
    schema: 'snfalyze'
  }
});

// Helper: Query SQLite as promise
function querySQLite(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper: Get table schema from SQLite
async function getSQLiteSchema(tableName) {
  return await querySQLite(`PRAGMA table_info(${tableName})`);
}

// Helper: Check if table exists in SQLite
async function tableExistsInSQLite(tableName) {
  const result = await querySQLite(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return result.length > 0;
}

// Helper: Get row count from table
async function getRowCount(tableName, db = 'sqlite') {
  if (db === 'sqlite') {
    const result = await querySQLite(`SELECT COUNT(*) as count FROM ${tableName}`);
    return result[0].count;
  } else {
    const result = await pgSequelize.query(
      `SELECT COUNT(*) as count FROM snfalyze.${tableName}`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    return parseInt(result[0].count);
  }
}

async function migrate() {
  console.log('🚀 Starting SNFalyze PostgreSQL Migration\n');

  try {
    // Test PostgreSQL connection
    await pgSequelize.authenticate();
    console.log('✓ Connected to PostgreSQL (snf_shared_data)\n');

    // Load all Sequelize models
    console.log('📦 Loading Sequelize models...');
    const models = require('./models/index.js');
    console.log(`✓ Loaded ${Object.keys(models).length} models\n`);

    // Sync all models to create tables (using snfalyze schema)
    console.log('🔧 Creating tables in snfalyze schema...');
    await pgSequelize.sync({ force: false, alter: true });
    console.log('✓ Tables created/updated\n');

    // Migrate data for each table
    console.log('📊 Starting data migration...\n');

    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        // Check if table exists in SQLite
        const exists = await tableExistsInSQLite(tableName);
        if (!exists) {
          console.log(`  ⏭️  ${tableName}: Not found in SQLite, skipping`);
          results.skipped.push(tableName);
          continue;
        }

        // Get row count
        const rowCount = await getRowCount(tableName, 'sqlite');
        if (rowCount === 0) {
          console.log(`  ⏭️  ${tableName}: Empty table, skipping`);
          results.skipped.push(tableName);
          continue;
        }

        console.log(`  📝 ${tableName}: Migrating ${rowCount} rows...`);

        // Read all data from SQLite
        const rows = await querySQLite(`SELECT * FROM ${tableName}`);

        // Insert into PostgreSQL
        if (rows.length > 0) {
          // Get column names from first row
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const columnNames = columns.map(c => `"${c}"`).join(', ');

          const insertQuery = `
            INSERT INTO snfalyze.${tableName} (${columnNames})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;

          let inserted = 0;
          for (const row of rows) {
            try {
              const values = columns.map(col => row[col]);
              await pgSequelize.query(insertQuery, {
                bind: values,
                type: Sequelize.QueryTypes.INSERT
              });
              inserted++;
            } catch (err) {
              console.log(`    ⚠️  Error inserting row: ${err.message}`);
            }
          }

          console.log(`  ✓ ${tableName}: Inserted ${inserted}/${rowCount} rows`);
          results.success.push({ table: tableName, rows: inserted });
        }

      } catch (error) {
        console.error(`  ❌ ${tableName}: ${error.message}`);
        results.failed.push({ table: tableName, error: error.message });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✓ Success: ${results.success.length} tables`);
    console.log(`⏭️  Skipped: ${results.skipped.length} tables`);
    console.log(`❌ Failed: ${results.failed.length} tables`);

    if (results.success.length > 0) {
      console.log('\n📋 Migrated Tables:');
      results.success.forEach(({ table, rows }) => {
        console.log(`  - ${table}: ${rows} rows`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\n⚠️  Failed Tables:');
      results.failed.forEach(({ table, error }) => {
        console.log(`  - ${table}: ${error}`);
      });
    }

    console.log('\n✅ Migration complete!');
    console.log('\n💡 Next steps:');
    console.log('  1. Verify data in PostgreSQL');
    console.log('  2. Test application functionality');
    console.log('  3. Keep SQLite as backup until fully verified\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close connections
    sqliteDb.close();
    await pgSequelize.close();
  }
}

// Run migration
migrate();
