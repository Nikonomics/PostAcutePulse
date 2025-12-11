/**
 * Migration: Add indexes to improve facility search query performance
 *
 * This migration:
 * 1. Adds indexes to deals table (facility_name, city, state)
 * 2. Adds indexes to deal_facilities table (facility_name, state)
 *
 * Performance Impact:
 * - WHERE deals.facility_name LIKE '%search%' (DealController.js:4215)
 * - WHERE deals.state = ? (DealController.js:4238)
 * - ORDER BY deals.facility_name (DealController.js:755)
 * - Improves search queries from O(n) table scans to O(log n) index lookups
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Migration: Adding facility search indexes...');

    // Add indexes to deals table
    await queryInterface.addIndex('deals', ['facility_name'], {
      name: 'idx_deals_facility_name',
      concurrently: false
    });
    console.log('Migration: Added index on deals.facility_name');

    await queryInterface.addIndex('deals', ['city'], {
      name: 'idx_deals_city',
      concurrently: false
    });
    console.log('Migration: Added index on deals.city');

    await queryInterface.addIndex('deals', ['state'], {
      name: 'idx_deals_state',
      concurrently: false
    });
    console.log('Migration: Added index on deals.state');

    // Add indexes to deal_facilities table
    await queryInterface.addIndex('deal_facilities', ['facility_name'], {
      name: 'idx_deal_facilities_facility_name',
      concurrently: false
    });
    console.log('Migration: Added index on deal_facilities.facility_name');

    await queryInterface.addIndex('deal_facilities', ['state'], {
      name: 'idx_deal_facilities_state',
      concurrently: false
    });
    console.log('Migration: Added index on deal_facilities.state');

    console.log('Migration: Facility search indexes setup complete');
  } catch (error) {
    console.error('Migration error:', error.message);
    throw error;
  }
}

/**
 * Rollback function to remove indexes
 */
async function rollbackMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Rollback: Removing facility search indexes...');

    // Remove indexes from deal_facilities table
    await queryInterface.removeIndex('deal_facilities', 'idx_deal_facilities_state');
    console.log('Rollback: Removed index from deal_facilities.state');

    await queryInterface.removeIndex('deal_facilities', 'idx_deal_facilities_facility_name');
    console.log('Rollback: Removed index from deal_facilities.facility_name');

    // Remove indexes from deals table
    await queryInterface.removeIndex('deals', 'idx_deals_state');
    console.log('Rollback: Removed index from deals.state');

    await queryInterface.removeIndex('deals', 'idx_deals_city');
    console.log('Rollback: Removed index from deals.city');

    await queryInterface.removeIndex('deals', 'idx_deals_facility_name');
    console.log('Rollback: Removed index from deals.facility_name');

    console.log('Rollback: Facility search indexes removed successfully');
  } catch (error) {
    console.error('Rollback error:', error.message);
    throw error;
  }
}

module.exports = { runMigration, rollbackMigration };
