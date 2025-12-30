/**
 * Migration: Create Ownership Hierarchy Tables
 *
 * Creates tables for tracking parent company → subsidiary relationships
 * and name variations across different data sources (PECOS, CMS, etc.)
 *
 * Tables:
 * 1. ownership_name_variants - Maps name variations to canonical names
 * 2. ownership_subsidiaries - Maps subsidiaries to parent companies
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ownership_name_variants table
    await queryInterface.createTable('ownership_name_variants', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      canonical_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'The normalized/canonical company name'
      },
      variant_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'A name variation found in source data'
      },
      source_context: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Source: snf_pecos, hha_pecos, alf_licensee, snf_chain, manual'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint on variant_name + source_context
    await queryInterface.addIndex('ownership_name_variants', ['variant_name', 'source_context'], {
      unique: true,
      name: 'ownership_name_variants_unique_variant_source'
    });

    // Add index on canonical_name for lookups
    await queryInterface.addIndex('ownership_name_variants', ['canonical_name']);

    console.log('Created ownership_name_variants table');

    // Create ownership_subsidiaries table
    await queryInterface.createTable('ownership_subsidiaries', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      parent_canonical_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Normalized parent company name (e.g., "THE PENNANT GROUP")'
      },
      subsidiary_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Subsidiary/operating company name (e.g., "MOHAVE HEALTHCARE INC")'
      },
      care_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Provider type: HHA, SNF, ALF, Hospice'
      },
      agency_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of individual agencies/facilities under this subsidiary'
      },
      states_operated: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
        comment: 'Array of state codes where subsidiary operates'
      },
      dba_names: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
        comment: 'Consumer-facing brand names (e.g., "River Valley Home Health")'
      },
      verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True if manually verified, false if auto-detected'
      },
      source: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Data source: pecos_auto, manual, sec_filing'
      },
      last_extract_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Most recent PECOS extract this was updated from'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add unique constraint on subsidiary_name + care_type
    await queryInterface.addIndex('ownership_subsidiaries', ['subsidiary_name', 'care_type'], {
      unique: true,
      name: 'ownership_subsidiaries_unique_subsidiary_care_type'
    });

    // Add indexes for lookups
    await queryInterface.addIndex('ownership_subsidiaries', ['parent_canonical_name']);
    await queryInterface.addIndex('ownership_subsidiaries', ['care_type']);
    await queryInterface.addIndex('ownership_subsidiaries', ['verified']);
    await queryInterface.addIndex('ownership_subsidiaries', ['source']);

    console.log('Created ownership_subsidiaries table');
    console.log('Ownership hierarchy tables migration complete.');
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order
    await queryInterface.dropTable('ownership_subsidiaries');
    await queryInterface.dropTable('ownership_name_variants');
    console.log('Dropped ownership hierarchy tables.');
  }
};
