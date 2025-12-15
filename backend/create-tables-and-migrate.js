/**
 * SNFalyze SQLite to PostgreSQL Migration - Direct SQL Approach
 *
 * This script:
 * 1. Creates all tables in snfalyze schema using raw SQL
 * 2. Migrates all data from SQLite to PostgreSQL
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

// Connect to PostgreSQL
const pgSequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
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

// Helper: Get SQLite schema for a table
async function getSQLiteTableInfo(tableName) {
  return await querySQLite(`PRAGMA table_info(${tableName})`);
}

// Helper: Convert SQLite type to PostgreSQL type
function sqliteTypeToPostgres(sqliteType) {
  const type = sqliteType.toUpperCase();

  if (type.includes('INT')) return 'INTEGER';
  if (type.includes('VARCHAR') || type.includes('TEXT')) return 'TEXT';
  if (type.includes('CHAR')) return 'TEXT';
  if (type.includes('TINYINT')) return 'BOOLEAN';
  if (type.includes('BOOLEAN')) return 'BOOLEAN';
  if (type.includes('DATETIME') || type.includes('TIMESTAMP')) return 'TIMESTAMP';
  if (type.includes('DATE')) return 'DATE';
  if (type.includes('REAL') || type.includes('DOUBLE') || type.includes('FLOAT')) return 'DOUBLE PRECISION';
  if (type.includes('DECIMAL') || type.includes('NUMERIC')) return 'NUMERIC';
  if (type.includes('BLOB')) return 'BYTEA';

  return 'TEXT'; // Default fallback
}

// Helper: Generate PostgreSQL CREATE TABLE statement from SQLite schema
async function generateCreateTableSQL(tableName) {
  const columns = await getSQLiteTableInfo(tableName);

  const columnDefs = columns.map(col => {
    let def = `"${col.name}" ${sqliteTypeToPostgres(col.type)}`;

    // Handle NOT NULL
    if (col.notnull) {
      def += ' NOT NULL';
    }

    // Handle DEFAULT values
    if (col.dflt_value !== null) {
      let defaultValue = col.dflt_value;
      // Remove quotes if it's a string default
      if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
        defaultValue = defaultValue.slice(1, -1);
      }
      // Handle CURRENT_TIMESTAMP
      if (defaultValue.includes('CURRENT_TIMESTAMP')) {
        def += ' DEFAULT CURRENT_TIMESTAMP';
      } else if (sqliteTypeToPostgres(col.type) === 'BOOLEAN') {
        // Convert 0/1 to false/true for boolean defaults
        def += ` DEFAULT ${defaultValue === '0' ? 'false' : 'true'}`;
      } else if (!defaultValue.match(/^\d+$/) && sqliteTypeToPostgres(col.type) !== 'INTEGER') {
        // String default
        def += ` DEFAULT '${defaultValue}'`;
      } else {
        def += ` DEFAULT ${defaultValue}`;
      }
    }

    // Handle PRIMARY KEY
    if (col.pk) {
      if (sqliteTypeToPostgres(col.type) === 'INTEGER') {
        def = `"${col.name}" SERIAL PRIMARY KEY`;
      } else {
        def += ' PRIMARY KEY';
      }
    }

    return def;
  });

  return `CREATE TABLE IF NOT EXISTS snfalyze.${tableName} (\n  ${columnDefs.join(',\n  ')}\n);`;
}

// Helper: Check if table exists in SQLite
async function tableExistsInSQLite(tableName) {
  const result = await querySQLite(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return result.length > 0;
}

async function migrate() {
  console.log('🚀 Starting SNFalyze PostgreSQL Migration\n');

  try {
    // Test PostgreSQL connection
    await pgSequelize.authenticate();
    console.log('✓ Connected to PostgreSQL (snf_shared_data)\n');

    // Create tables
    console.log('🔧 Creating tables in snfalyze schema...\n');

    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        // Check if table exists in SQLite
        const exists = await tableExistsInSQLite(tableName);
        if (!exists) {
          console.log(`  ⏭️  ${tableName}: Not found in SQLite, skipping`);
          continue;
        }

        // Generate and execute CREATE TABLE statement
        const createSQL = await generateCreateTableSQL(tableName);
        await pgSequelize.query(createSQL);
        console.log(`  ✓ ${tableName}: Table created`);

      } catch (error) {
        console.error(`  ❌ ${tableName}: Error creating table - ${error.message}`);
      }
    }

    console.log('\n📊 Starting data migration...\n');

    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    // Migrate data for each table
    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        // Check if table exists in SQLite
        const exists = await tableExistsInSQLite(tableName);
        if (!exists) {
          results.skipped.push(tableName);
          continue;
        }

        // Get row count
        const countResult = await querySQLite(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rowCount = countResult[0].count;

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
              // Silent skip on conflict
              if (!err.message.includes('duplicate key')) {
                console.log(`    ⚠️  Error inserting row: ${err.message}`);
              }
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
