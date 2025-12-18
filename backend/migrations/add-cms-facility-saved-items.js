/**
 * Migration to add CMS facility support to user_saved_items table
 * Adds ccn and facility_name columns for saving CMS facilities by CCN
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add ccn column
    await queryInterface.addColumn('user_saved_items', 'ccn', {
      type: Sequelize.STRING(10),
      allowNull: true
    });

    // Add facility_name column
    await queryInterface.addColumn('user_saved_items', 'facility_name', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    // Add unique index for user_id + ccn
    await queryInterface.addIndex('user_saved_items', ['user_id', 'ccn'], {
      name: 'idx_saved_items_user_ccn_unique',
      unique: true,
      where: {
        ccn: { [Sequelize.Op.ne]: null }
      }
    });

    console.log('Added ccn and facility_name columns to user_saved_items');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index first
    await queryInterface.removeIndex('user_saved_items', 'idx_saved_items_user_ccn_unique');

    // Remove columns
    await queryInterface.removeColumn('user_saved_items', 'facility_name');
    await queryInterface.removeColumn('user_saved_items', 'ccn');

    console.log('Removed ccn and facility_name columns from user_saved_items');
  }
};
