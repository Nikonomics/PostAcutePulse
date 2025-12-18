/**
 * Migration: Add position column to deals table
 *
 * Purpose: Support Kanban board drag-and-drop reordering of deals within status columns
 * The position field allows deals to be sorted by their display order within each status.
 */

const runMigration = async (sequelize) => {
  console.log('[Migration] Adding position column to deals table...');

  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping - not PostgreSQL');
      return;
    }

    // Check if column already exists (idempotent)
    const [existing] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'position'
    `);

    if (existing.length > 0) {
      console.log('[Migration] Position column already exists, skipping');
      return;
    }

    // Add position column with default value of 0
    await sequelize.query(`
      ALTER TABLE deals
      ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0
    `);

    console.log('[Migration] Added position column to deals table successfully');

    // Add index for faster sorting by position within status
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deals_status_position ON deals(deal_status, position)
    `);

    console.log('[Migration] Added index for deals position sorting');

  } catch (error) {
    console.error('[Migration] Error adding position column:', error.message);
    throw error;
  }
};

module.exports = { runMigration };
