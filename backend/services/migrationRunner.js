/**
 * Auto Migration Runner
 *
 * Automatically runs pending database migrations on app startup.
 * Tracks which migrations have been run in the `_migrations` table.
 *
 * USAGE:
 * 1. Create migration files in backend/migrations/ with format:
 *    - YYYYMMDD-description.js (e.g., 20241218-add-ccn-to-deal-facilities.js)
 *
 * 2. Migration file structure:
 *    module.exports = {
 *      up: async (queryInterface, Sequelize) => { ... },
 *      down: async (queryInterface, Sequelize) => { ... }  // optional
 *    };
 *
 * 3. Migrations run automatically on app startup (in order by filename)
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * Ensure the migrations tracking table exists
 */
async function ensureMigrationsTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

/**
 * Get list of already-run migrations
 */
async function getCompletedMigrations(sequelize) {
  try {
    const [rows] = await sequelize.query('SELECT name FROM _migrations ORDER BY name');
    return new Set(rows.map(r => r.name));
  } catch (error) {
    return new Set();
  }
}

/**
 * Mark a migration as complete
 */
async function markMigrationComplete(sequelize, name) {
  await sequelize.query(
    'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    { bind: [name] }
  );
}

/**
 * Get all migration files from the migrations directory
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[Migrations] No migrations directory found');
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .sort(); // Sort alphabetically (YYYYMMDD prefix ensures correct order)

  return files;
}

/**
 * Run all pending migrations
 */
async function runPendingMigrations(sequelize) {
  console.log('[Migrations] Checking for pending migrations...');

  try {
    // Ensure tracking table exists
    await ensureMigrationsTable(sequelize);

    // Get completed migrations
    const completed = await getCompletedMigrations(sequelize);

    // Get all migration files
    const allMigrations = getMigrationFiles();

    // Filter to pending only
    const pending = allMigrations.filter(f => !completed.has(f));

    if (pending.length === 0) {
      console.log('[Migrations] All migrations are up to date');
      return { success: true, ran: 0 };
    }

    console.log(`[Migrations] Found ${pending.length} pending migration(s)`);

    // Create a queryInterface-like object for compatibility
    const queryInterface = sequelize.getQueryInterface();

    // Run each pending migration
    let ranCount = 0;
    for (const migrationFile of pending) {
      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);

      try {
        console.log(`[Migrations] Running: ${migrationFile}`);

        const migration = require(migrationPath);

        // Support both formats:
        // 1. { up: fn, down: fn }
        // 2. { runMigration: fn }
        if (typeof migration.up === 'function') {
          await migration.up(queryInterface, Sequelize);
        } else if (typeof migration.runMigration === 'function') {
          await migration.runMigration(sequelize);
        } else {
          console.log(`[Migrations] Skipping ${migrationFile} - no up() or runMigration() function`);
          continue;
        }

        // Mark as complete
        await markMigrationComplete(sequelize, migrationFile);
        console.log(`[Migrations] ✓ Completed: ${migrationFile}`);
        ranCount++;

      } catch (migrationError) {
        console.error(`[Migrations] ✗ Failed: ${migrationFile}`);
        console.error(`[Migrations] Error: ${migrationError.message}`);

        // Don't stop on failure - log and continue
        // This prevents one bad migration from blocking the app
      }
    }

    console.log(`[Migrations] Finished. Ran ${ranCount} migration(s)`);
    return { success: true, ran: ranCount };

  } catch (error) {
    console.error('[Migrations] Error running migrations:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * List migration status
 */
async function getMigrationStatus(sequelize) {
  await ensureMigrationsTable(sequelize);

  const completed = await getCompletedMigrations(sequelize);
  const allMigrations = getMigrationFiles();

  return allMigrations.map(name => ({
    name,
    status: completed.has(name) ? 'completed' : 'pending'
  }));
}

module.exports = {
  runPendingMigrations,
  getMigrationStatus
};
