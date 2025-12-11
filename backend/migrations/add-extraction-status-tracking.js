/**
 * Migration: Add extraction status tracking columns to deals table
 *
 * This migration adds:
 * - extraction_status: Track extraction state (pending, processing, completed, failed, partial)
 * - extraction_started_at: When extraction began
 * - extraction_completed_at: When extraction finished
 * - extraction_error: Error message if extraction failed
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Migration: Adding extraction status tracking columns...');

    // Get current columns
    const dealsColumns = await queryInterface.describeTable('deals');

    // Add extraction_status column
    if (!dealsColumns.extraction_status) {
      await queryInterface.addColumn('deals', 'extraction_status', {
        type: sequelize.Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'pending'
      });
      console.log('Migration: Added extraction_status column to deals');
    }

    // Add extraction_started_at column
    if (!dealsColumns.extraction_started_at) {
      await queryInterface.addColumn('deals', 'extraction_started_at', {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      });
      console.log('Migration: Added extraction_started_at column to deals');
    }

    // Add extraction_completed_at column
    if (!dealsColumns.extraction_completed_at) {
      await queryInterface.addColumn('deals', 'extraction_completed_at', {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      });
      console.log('Migration: Added extraction_completed_at column to deals');
    }

    // Add extraction_error column
    if (!dealsColumns.extraction_error) {
      await queryInterface.addColumn('deals', 'extraction_error', {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      });
      console.log('Migration: Added extraction_error column to deals');
    }

    // Backfill existing deals based on extraction_data presence
    console.log('Migration: Backfilling extraction status for existing deals...');

    // Deals with extraction_data are 'completed'
    await sequelize.query(`
      UPDATE deals
      SET extraction_status = 'completed'
      WHERE extraction_data IS NOT NULL
        AND (extraction_status IS NULL OR extraction_status = 'pending')
    `);

    // Deals without extraction_data remain 'pending'
    await sequelize.query(`
      UPDATE deals
      SET extraction_status = 'pending'
      WHERE extraction_data IS NULL
        AND extraction_status IS NULL
    `);

    console.log('Migration: Extraction status tracking setup complete');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

module.exports = { runMigration };
