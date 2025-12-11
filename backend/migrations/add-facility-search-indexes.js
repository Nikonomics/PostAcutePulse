/**
 * Migration: Add facility search indexes
 *
 * Purpose: Improve query performance for deal searches by adding indexes on commonly searched/filtered columns.
 *
 * These indexes optimize:
 * - Facility name searches (LIKE queries)
 * - State filtering
 * - City filtering
 * - Sorting by facility name
 */

const runMigration = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();

  console.log('[Migration] Adding facility search indexes...');

  try {
    // Check if we're using PostgreSQL (indexes work differently in SQLite)
    const dialect = sequelize.getDialect();

    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping index creation (not PostgreSQL)');
      return;
    }

    // Add indexes to deals table
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deals_facility_name
      ON snfalyze.deals(facility_name);
    `);
    console.log('[Migration] Created index: idx_deals_facility_name');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deals_city
      ON snfalyze.deals(city);
    `);
    console.log('[Migration] Created index: idx_deals_city');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deals_state
      ON snfalyze.deals(state);
    `);
    console.log('[Migration] Created index: idx_deals_state');

    // Add indexes to deal_facilities table
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deal_facilities_facility_name
      ON snfalyze.deal_facilities(facility_name);
    `);
    console.log('[Migration] Created index: idx_deal_facilities_facility_name');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deal_facilities_state
      ON snfalyze.deal_facilities(state);
    `);
    console.log('[Migration] Created index: idx_deal_facilities_state');

    console.log('[Migration] Facility search indexes created successfully');

  } catch (error) {
    console.error('[Migration] Error creating facility search indexes:', error.message);
    // Don't throw - allow app to continue even if indexes fail
  }
};

module.exports = {
  runMigration
};
