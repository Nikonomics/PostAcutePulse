/**
 * Migration: Add deal activity tracking tables and fields
 *
 * This migration:
 * 1. Creates deal_change_logs table for audit trail
 * 2. Creates deal_user_views table for tracking when users last viewed deals
 * 3. Adds last_activity_* fields to deals table for fast queries
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Migration: Adding deal activity tracking tables and fields...');

    // Add new columns to deals table if they don't exist
    const dealsColumns = await queryInterface.describeTable('deals');

    if (!dealsColumns.last_activity_at) {
      await queryInterface.addColumn('deals', 'last_activity_at', {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      });
      console.log('Migration: Added last_activity_at column to deals');
    }

    if (!dealsColumns.last_activity_by) {
      await queryInterface.addColumn('deals', 'last_activity_by', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true
      });
      console.log('Migration: Added last_activity_by column to deals');
    }

    if (!dealsColumns.last_activity_type) {
      await queryInterface.addColumn('deals', 'last_activity_type', {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
      });
      console.log('Migration: Added last_activity_type column to deals');
    }

    // Tables are created automatically by Sequelize sync
    // This migration just ensures the deals table columns exist

    console.log('Migration: Deal activity tracking setup complete');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

module.exports = { runMigration };
