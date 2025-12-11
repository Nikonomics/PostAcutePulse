/**
 * Migration: Standardize bed count field name across the codebase
 *
 * This migration:
 * 1. Renames deals.no_of_beds to deals.bed_count
 * 2. Renames deal_facilities.total_beds to deal_facilities.bed_count
 *
 * Note: extraction_data.bed_count is already correct, no JSON migration needed.
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  try {
    console.log('Migration: Standardizing bed_count field name...');

    // Check if columns exist before renaming
    const dealsColumns = await queryInterface.describeTable('deals');
    const facilitiesColumns = await queryInterface.describeTable('deal_facilities');

    // Rename deals.no_of_beds to deals.bed_count
    if (dealsColumns.no_of_beds && !dealsColumns.bed_count) {
      if (dialect === 'sqlite') {
        // SQLite doesn't support RENAME COLUMN directly in older versions
        // But newer SQLite (3.25.0+) does support it
        await sequelize.query('ALTER TABLE deals RENAME COLUMN no_of_beds TO bed_count');
      } else {
        await queryInterface.renameColumn('deals', 'no_of_beds', 'bed_count');
      }
      console.log('Migration: Renamed deals.no_of_beds to deals.bed_count');
    } else if (dealsColumns.bed_count) {
      console.log('Migration: deals.bed_count already exists, skipping');
    }

    // Rename deal_facilities.total_beds to deal_facilities.bed_count
    if (facilitiesColumns.total_beds && !facilitiesColumns.bed_count) {
      if (dialect === 'sqlite') {
        await sequelize.query('ALTER TABLE deal_facilities RENAME COLUMN total_beds TO bed_count');
      } else {
        await queryInterface.renameColumn('deal_facilities', 'total_beds', 'bed_count');
      }
      console.log('Migration: Renamed deal_facilities.total_beds to deal_facilities.bed_count');
    } else if (facilitiesColumns.bed_count) {
      console.log('Migration: deal_facilities.bed_count already exists, skipping');
    }

    console.log('Migration: Bed count field standardization complete');
  } catch (error) {
    console.error('Migration error:', error.message);
    // Don't throw - let the app continue even if migration fails
  }
}

module.exports = { runMigration };
