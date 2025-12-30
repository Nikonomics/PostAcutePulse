/**
 * Migration: Add Multi-Segment Columns to Ownership Profiles
 *
 * Extends ownership_profiles to track operators across SNF, ALF, HHA, and Hospice
 * segments with unified totals and PE/investment tracking.
 *
 * Current SNF columns (facility_count, total_beds, etc.) remain as-is.
 * New columns add ALF, HHA, cross-segment totals, and PE tracking.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding multi-segment columns to ownership_profiles...');

    // Care type flags
    await queryInterface.addColumn('ownership_profiles', 'has_snf', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Has SNF facilities'
    });

    await queryInterface.addColumn('ownership_profiles', 'has_alf', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Has ALF facilities'
    });

    await queryInterface.addColumn('ownership_profiles', 'has_hha', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Has Home Health agencies'
    });

    await queryInterface.addColumn('ownership_profiles', 'has_hospice', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Has Hospice agencies (future use)'
    });

    await queryInterface.addColumn('ownership_profiles', 'care_types', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'Array of care types: SNF, ALF, HHA, HOSPICE'
    });

    await queryInterface.addColumn('ownership_profiles', 'is_diversified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if operates in 2+ care segments'
    });

    console.log('  Added care type flags');

    // ALF metrics
    await queryInterface.addColumn('ownership_profiles', 'alf_facility_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of ALF facilities'
    });

    await queryInterface.addColumn('ownership_profiles', 'alf_total_capacity', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total ALF beds/units'
    });

    await queryInterface.addColumn('ownership_profiles', 'alf_states', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'States where ALF facilities operate'
    });

    console.log('  Added ALF metrics');

    // HHA metrics
    await queryInterface.addColumn('ownership_profiles', 'hha_subsidiary_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of HHA subsidiary companies'
    });

    await queryInterface.addColumn('ownership_profiles', 'hha_agency_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of individual HHA agencies (CCNs)'
    });

    await queryInterface.addColumn('ownership_profiles', 'hha_states', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'States where HHA agencies operate'
    });

    await queryInterface.addColumn('ownership_profiles', 'hha_dba_brands', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'Consumer-facing HHA brand names'
    });

    console.log('  Added HHA metrics');

    // Cross-segment totals
    await queryInterface.addColumn('ownership_profiles', 'total_locations', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total locations across all care types (SNF + ALF + HHA)'
    });

    await queryInterface.addColumn('ownership_profiles', 'total_states_operated', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Unique state count across all care types'
    });

    await queryInterface.addColumn('ownership_profiles', 'all_states', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'Union of all states across all care types'
    });

    console.log('  Added cross-segment totals');

    // PE/Investment tracking
    await queryInterface.addColumn('ownership_profiles', 'pe_backed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if backed by private equity or institutional investors'
    });

    await queryInterface.addColumn('ownership_profiles', 'pe_investors', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'List of PE/REIT/investment firm investors'
    });

    console.log('  Added PE/Investment tracking');

    // Add indexes for common queries
    await queryInterface.addIndex('ownership_profiles', ['is_diversified'], {
      name: 'idx_ownership_diversified'
    });

    await queryInterface.addIndex('ownership_profiles', ['has_snf', 'has_alf', 'has_hha'], {
      name: 'idx_ownership_care_types'
    });

    await queryInterface.addIndex('ownership_profiles', ['pe_backed'], {
      name: 'idx_ownership_pe_backed'
    });

    await queryInterface.addIndex('ownership_profiles', ['total_locations'], {
      name: 'idx_ownership_total_locations',
      order: { total_locations: 'DESC' }
    });

    console.log('  Added indexes');

    // Update existing SNF records to set has_snf = true where facility_count > 0
    await queryInterface.sequelize.query(`
      UPDATE ownership_profiles
      SET has_snf = true,
          care_types = ARRAY['SNF'],
          total_locations = facility_count,
          total_states_operated = state_count,
          all_states = states_operated
      WHERE facility_count > 0
    `);

    console.log('  Updated existing SNF profiles with care type flags');
    console.log('Multi-segment ownership_profiles migration complete.');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing multi-segment columns from ownership_profiles...');

    // Drop indexes first
    await queryInterface.removeIndex('ownership_profiles', 'idx_ownership_diversified');
    await queryInterface.removeIndex('ownership_profiles', 'idx_ownership_care_types');
    await queryInterface.removeIndex('ownership_profiles', 'idx_ownership_pe_backed');
    await queryInterface.removeIndex('ownership_profiles', 'idx_ownership_total_locations');

    // Remove columns in reverse order
    await queryInterface.removeColumn('ownership_profiles', 'pe_investors');
    await queryInterface.removeColumn('ownership_profiles', 'pe_backed');
    await queryInterface.removeColumn('ownership_profiles', 'all_states');
    await queryInterface.removeColumn('ownership_profiles', 'total_states_operated');
    await queryInterface.removeColumn('ownership_profiles', 'total_locations');
    await queryInterface.removeColumn('ownership_profiles', 'hha_dba_brands');
    await queryInterface.removeColumn('ownership_profiles', 'hha_states');
    await queryInterface.removeColumn('ownership_profiles', 'hha_agency_count');
    await queryInterface.removeColumn('ownership_profiles', 'hha_subsidiary_count');
    await queryInterface.removeColumn('ownership_profiles', 'alf_states');
    await queryInterface.removeColumn('ownership_profiles', 'alf_total_capacity');
    await queryInterface.removeColumn('ownership_profiles', 'alf_facility_count');
    await queryInterface.removeColumn('ownership_profiles', 'is_diversified');
    await queryInterface.removeColumn('ownership_profiles', 'care_types');
    await queryInterface.removeColumn('ownership_profiles', 'has_hospice');
    await queryInterface.removeColumn('ownership_profiles', 'has_hha');
    await queryInterface.removeColumn('ownership_profiles', 'has_alf');
    await queryInterface.removeColumn('ownership_profiles', 'has_snf');

    console.log('Removed multi-segment columns from ownership_profiles.');
  }
};
