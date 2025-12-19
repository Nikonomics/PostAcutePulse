/**
 * Migration to add federal_provider_number (CCN) column to deal_facilities table
 * This enables linking deal facilities to their CMS facility profiles
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('deal_facilities');

    if (!tableDescription.federal_provider_number) {
      // Add federal_provider_number column
      await queryInterface.addColumn('deal_facilities', 'federal_provider_number', {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'CMS Certification Number (CCN) linking to cms_snf_providers'
      });
      console.log('[Migration] Added federal_provider_number column to deal_facilities');
    } else {
      console.log('[Migration] federal_provider_number column already exists, skipping');
    }

    // Add index for faster lookups
    try {
      await queryInterface.addIndex('deal_facilities', ['federal_provider_number'], {
        name: 'idx_deal_facilities_ccn',
        where: {
          federal_provider_number: { [Sequelize.Op.ne]: null }
        }
      });
      console.log('[Migration] Added index on deal_facilities.federal_provider_number');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('[Migration] Index idx_deal_facilities_ccn already exists, skipping');
      } else {
        throw error;
      }
    }

    // Note: No backfill needed - there's no matched_facility_id column to backfill from.
    // The federal_provider_number will be populated when:
    // 1. New facilities are created with matched CMS facilities
    // 2. Existing facilities are edited and matched to CMS facilities
    console.log('[Migration] Complete. federal_provider_number will be populated on facility create/update.');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    try {
      await queryInterface.removeIndex('deal_facilities', 'idx_deal_facilities_ccn');
      console.log('[Rollback] Removed index idx_deal_facilities_ccn');
    } catch (error) {
      console.log('[Rollback] Index idx_deal_facilities_ccn does not exist, skipping');
    }

    // Remove column
    await queryInterface.removeColumn('deal_facilities', 'federal_provider_number');
    console.log('[Rollback] Removed federal_provider_number column from deal_facilities');
  }
};
