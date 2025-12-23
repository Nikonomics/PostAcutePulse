/**
 * Migration: Add missing columns identified in schema audit
 * Date: 2024-12-23
 *
 * Fixes:
 * 1. user_saved_items.facility_name - for CMS facility display names
 * 2. deal_facilities.facility_role - subject vs competitor classification
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add facility_name to user_saved_items
    try {
      await queryInterface.addColumn('user_saved_items', 'facility_name', {
        type: Sequelize.STRING(500),
        allowNull: true
      });
      console.log('Added user_saved_items.facility_name');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('user_saved_items.facility_name already exists, skipping');
      } else {
        throw err;
      }
    }

    // 2. Add facility_role to deal_facilities
    try {
      await queryInterface.addColumn('deal_facilities', 'facility_role', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'subject'
      });
      console.log('Added deal_facilities.facility_role');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('deal_facilities.facility_role already exists, skipping');
      } else {
        throw err;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user_saved_items', 'facility_name');
    await queryInterface.removeColumn('deal_facilities', 'facility_role');
  }
};
