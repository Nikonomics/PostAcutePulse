/**
 * Migration: Create facility_vbp_rankings table
 *
 * Stores pre-calculated VBP rankings at national, state, market (county), and chain levels
 * for efficient retrieval on facility profile pages.
 */

const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';

async function up() {
  const sequelize = new Sequelize(connectionString, {
    logging: false,
    dialectOptions: connectionString.includes('render.com') ? { ssl: { rejectUnauthorized: false } } : {}
  });

  try {
    console.log('Creating facility_vbp_rankings table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS facility_vbp_rankings (
        id SERIAL PRIMARY KEY,
        federal_provider_number VARCHAR(10) NOT NULL,
        fiscal_year INTEGER NOT NULL,

        -- National rankings
        national_rank INTEGER,
        national_total INTEGER,
        national_percentile NUMERIC(5,2),

        -- State rankings
        state_rank INTEGER,
        state_total INTEGER,
        state_percentile NUMERIC(5,2),

        -- Market (county) rankings
        market_rank INTEGER,
        market_total INTEGER,
        market_percentile NUMERIC(5,2),

        -- Chain rankings (null if facility has no parent_organization)
        chain_rank INTEGER,
        chain_total INTEGER,
        chain_percentile NUMERIC(5,2),

        -- Metadata
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Unique constraint
        CONSTRAINT facility_vbp_rankings_unique UNIQUE (federal_provider_number, fiscal_year)
      );
    `);

    console.log('Creating indexes...');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vbp_rankings_ccn
      ON facility_vbp_rankings(federal_provider_number);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vbp_rankings_fiscal_year
      ON facility_vbp_rankings(fiscal_year);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vbp_rankings_ccn_year
      ON facility_vbp_rankings(federal_provider_number, fiscal_year DESC);
    `);

    console.log('Migration complete: facility_vbp_rankings table created');

  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function down() {
  const sequelize = new Sequelize(connectionString, {
    logging: false,
    dialectOptions: connectionString.includes('render.com') ? { ssl: { rejectUnauthorized: false } } : {}
  });

  try {
    console.log('Dropping facility_vbp_rankings table...');
    await sequelize.query('DROP TABLE IF EXISTS facility_vbp_rankings CASCADE;');
    console.log('Rollback complete');
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'down') {
    down().catch(console.error);
  } else {
    up().catch(console.error);
  }
}

module.exports = { up, down };
