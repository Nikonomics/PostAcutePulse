/**
 * Migration: Create cms_data_definitions table
 *
 * Purpose: Store field definitions, descriptions, and data collection periods
 * for CMS nursing home data. Used for UI tooltips and data explanations.
 *
 * Contains:
 * - Field/measure codes and names
 * - Human-readable descriptions
 * - Data collection periods
 * - Source table references
 * - Calculation notes where applicable
 */

const runMigration = async (sequelize) => {
  console.log('[Migration] Creating cms_data_definitions table...');

  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping - not PostgreSQL');
      return;
    }

    const [results] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'cms_data_definitions'
    `);

    if (results && results.length > 0) {
      console.log('[Migration] cms_data_definitions table already exists, skipping');
      return;
    }

    await sequelize.query(`
      CREATE TABLE cms_data_definitions (
        id SERIAL PRIMARY KEY,

        -- Identification
        field_name VARCHAR(100) NOT NULL,
        measure_code VARCHAR(20),

        -- Display info
        display_name VARCHAR(255) NOT NULL,
        short_description VARCHAR(500),
        full_description TEXT,

        -- Categorization
        category VARCHAR(100),
        subcategory VARCHAR(100),
        source_table VARCHAR(100),

        -- Data collection info
        collection_period_start DATE,
        collection_period_end DATE,
        update_frequency VARCHAR(50),

        -- Value info
        data_type VARCHAR(50),
        unit VARCHAR(50),
        min_value NUMERIC,
        max_value NUMERIC,

        -- Interpretation
        interpretation_notes TEXT,
        better_direction VARCHAR(20),

        -- Metadata
        cms_source VARCHAR(100),
        last_updated DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(field_name)
      )
    `);

    console.log('[Migration] Created cms_data_definitions table');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_definitions_field ON cms_data_definitions(field_name);
      CREATE INDEX IF NOT EXISTS idx_definitions_category ON cms_data_definitions(category);
      CREATE INDEX IF NOT EXISTS idx_definitions_measure_code ON cms_data_definitions(measure_code);
    `);

    console.log('[Migration] Added indexes');

  } catch (error) {
    console.error('[Migration] Error creating cms_data_definitions:', error.message);
    throw error;
  }
};

module.exports = { runMigration };
