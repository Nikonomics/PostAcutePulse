/**
 * Migration: Create snf_vbp_performance table
 *
 * Purpose: Store SNF Value-Based Purchasing (VBP) Program performance data
 * This enables tracking facility performance on key quality metrics and their
 * financial incentives/penalties under the Medicare VBP program.
 *
 * Contains:
 * - National ranking
 * - Readmission rates (baseline vs performance period)
 * - Healthcare-Associated Infection (HAI) rates
 * - Staff turnover rates
 * - Staffing hours
 * - Achievement, improvement, and measure scores
 * - Final performance score and incentive payment multiplier
 */

const runMigration = async (sequelize) => {
  console.log('[Migration] Creating snf_vbp_performance table...');

  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping - not PostgreSQL');
      return;
    }

    // Check if table already exists
    const [results] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'snf_vbp_performance'
    `);

    if (results && results.length > 0) {
      console.log('[Migration] snf_vbp_performance table already exists, skipping');
      return;
    }

    await sequelize.query(`
      CREATE TABLE snf_vbp_performance (
        id SERIAL PRIMARY KEY,

        -- Facility identification
        cms_certification_number VARCHAR(10) NOT NULL,
        provider_name VARCHAR(255),
        address VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(2),
        zip_code VARCHAR(10),

        -- National ranking
        vbp_ranking INTEGER,
        fiscal_year INTEGER,

        -- Readmission Rates (SNFRM - SNF Readmission Measure)
        baseline_readmission_rate NUMERIC(8,5),
        performance_readmission_rate NUMERIC(8,5),
        readmission_achievement_score NUMERIC(8,5),
        readmission_improvement_score NUMERIC(8,5),
        readmission_measure_score NUMERIC(8,5),

        -- Healthcare-Associated Infection Rates (HAI)
        baseline_hai_rate NUMERIC(8,5),
        performance_hai_rate NUMERIC(8,5),
        hai_achievement_score NUMERIC(8,5),
        hai_improvement_score NUMERIC(8,5),
        hai_measure_score NUMERIC(8,5),

        -- Staff Turnover
        baseline_turnover_rate NUMERIC(6,2),
        performance_turnover_rate NUMERIC(6,2),
        turnover_achievement_score NUMERIC(8,5),
        turnover_improvement_score NUMERIC(8,5),
        turnover_measure_score NUMERIC(8,5),

        -- Staffing Hours
        baseline_staffing_hours NUMERIC(6,3),
        performance_staffing_hours NUMERIC(6,3),
        staffing_achievement_score NUMERIC(8,5),
        staffing_improvement_score NUMERIC(8,5),
        staffing_measure_score NUMERIC(8,5),

        -- Final Scores
        performance_score NUMERIC(10,5),
        incentive_payment_multiplier NUMERIC(12,10),

        -- Calculated fields
        incentive_percentage NUMERIC(6,4),  -- (multiplier - 1) * 100

        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add unique constraint to snf_facilities.cms_certification_number if not exists
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_snf_facilities_ccn_unique
      ON snf_facilities(cms_certification_number)
    `);

    console.log('[Migration] Created snf_vbp_performance table');

    // Add indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vbp_ccn ON snf_vbp_performance(cms_certification_number);
      CREATE INDEX IF NOT EXISTS idx_vbp_ranking ON snf_vbp_performance(vbp_ranking);
      CREATE INDEX IF NOT EXISTS idx_vbp_state ON snf_vbp_performance(state);
      CREATE INDEX IF NOT EXISTS idx_vbp_performance_score ON snf_vbp_performance(performance_score DESC);
    `);

    console.log('[Migration] Added indexes for VBP table');

  } catch (error) {
    console.error('[Migration] Error creating snf_vbp_performance:', error.message);
    throw error;
  }
};

module.exports = { runMigration };
