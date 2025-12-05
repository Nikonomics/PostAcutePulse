/**
 * Migration to add benchmark_configurations and deal_proforma_scenarios tables
 * Also adds indexes for better query performance
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  try {
    console.log('Migration: Adding benchmark_configurations and deal_proforma_scenarios tables...');

    // Check if benchmark_configurations table exists
    const benchmarkTableExists = await queryInterface.showAllTables()
      .then(tables => tables.includes('benchmark_configurations'));

    if (!benchmarkTableExists) {
      console.log('Migration: benchmark_configurations table will be created by Sequelize sync');
    }

    // Check if deal_proforma_scenarios table exists
    const proformaTableExists = await queryInterface.showAllTables()
      .then(tables => tables.includes('deal_proforma_scenarios'));

    if (!proformaTableExists) {
      console.log('Migration: deal_proforma_scenarios table will be created by Sequelize sync');
    }

    // Wait for tables to be created by sync before adding indexes
    // This will be called after sync completes
    if (benchmarkTableExists) {
      await addBenchmarkIndexes(queryInterface, dialect);
    }

    if (proformaTableExists) {
      await addProformaIndexes(queryInterface, dialect);
    }

    console.log('Migration: Benchmark and proforma tables setup complete');
  } catch (error) {
    console.error('Migration error:', error.message);
    // Don't throw - let the app continue
  }
}

/**
 * Add indexes to benchmark_configurations table
 */
async function addBenchmarkIndexes(queryInterface, dialect) {
  try {
    // Add index on user_id for fast lookup of user's benchmarks
    const userIdIndexExists = await checkIndexExists(
      queryInterface,
      'benchmark_configurations',
      'idx_benchmark_config_user_id',
      dialect
    );

    if (!userIdIndexExists) {
      await queryInterface.addIndex('benchmark_configurations', ['user_id'], {
        name: 'idx_benchmark_config_user_id'
      });
      console.log('Migration: Added index idx_benchmark_config_user_id');
    }

    // Add unique index on user_id + config_name to prevent duplicate names per user
    const uniqueNameIndexExists = await checkIndexExists(
      queryInterface,
      'benchmark_configurations',
      'idx_benchmark_config_user_config_unique',
      dialect
    );

    if (!uniqueNameIndexExists) {
      await queryInterface.addIndex('benchmark_configurations', ['user_id', 'config_name'], {
        name: 'idx_benchmark_config_user_config_unique',
        unique: true
      });
      console.log('Migration: Added unique index idx_benchmark_config_user_config_unique');
    }

    // Add index on is_default for fast lookup of default configurations
    const defaultIndexExists = await checkIndexExists(
      queryInterface,
      'benchmark_configurations',
      'idx_benchmark_config_is_default',
      dialect
    );

    if (!defaultIndexExists) {
      await queryInterface.addIndex('benchmark_configurations', ['user_id', 'is_default'], {
        name: 'idx_benchmark_config_is_default'
      });
      console.log('Migration: Added index idx_benchmark_config_is_default');
    }
  } catch (error) {
    console.error('Error adding benchmark indexes:', error.message);
  }
}

/**
 * Add indexes to deal_proforma_scenarios table
 */
async function addProformaIndexes(queryInterface, dialect) {
  try {
    // Add index on deal_id for fast lookup of scenarios for a deal
    const dealIdIndexExists = await checkIndexExists(
      queryInterface,
      'deal_proforma_scenarios',
      'idx_proforma_scenario_deal_id',
      dialect
    );

    if (!dealIdIndexExists) {
      await queryInterface.addIndex('deal_proforma_scenarios', ['deal_id'], {
        name: 'idx_proforma_scenario_deal_id'
      });
      console.log('Migration: Added index idx_proforma_scenario_deal_id');
    }

    // Add index on user_id for fast lookup of user's scenarios
    const userIdIndexExists = await checkIndexExists(
      queryInterface,
      'deal_proforma_scenarios',
      'idx_proforma_scenario_user_id',
      dialect
    );

    if (!userIdIndexExists) {
      await queryInterface.addIndex('deal_proforma_scenarios', ['user_id'], {
        name: 'idx_proforma_scenario_user_id'
      });
      console.log('Migration: Added index idx_proforma_scenario_user_id');
    }

    // Add unique index on deal_id + scenario_name to prevent duplicate scenario names per deal
    const uniqueNameIndexExists = await checkIndexExists(
      queryInterface,
      'deal_proforma_scenarios',
      'idx_proforma_scenario_deal_scenario_unique',
      dialect
    );

    if (!uniqueNameIndexExists) {
      await queryInterface.addIndex('deal_proforma_scenarios', ['deal_id', 'scenario_name'], {
        name: 'idx_proforma_scenario_deal_scenario_unique',
        unique: true
      });
      console.log('Migration: Added unique index idx_proforma_scenario_deal_scenario_unique');
    }
  } catch (error) {
    console.error('Error adding proforma indexes:', error.message);
  }
}

/**
 * Check if an index exists (cross-database compatible)
 */
async function checkIndexExists(queryInterface, tableName, indexName, dialect) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    return indexes.some(index => index.name === indexName);
  } catch (error) {
    // If showIndex fails, assume index doesn't exist
    return false;
  }
}

module.exports = { runMigration };
