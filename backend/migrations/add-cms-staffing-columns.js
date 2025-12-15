/**
 * Migration: Add CMS staffing, turnover, and chain data columns to snf_facilities
 *
 * Purpose: Expand snf_facilities table to include all relevant data from CMS NH_ProviderInfo
 * This enables comprehensive benchmarking and market research using official CMS data.
 *
 * New columns added:
 * - LPN staffing hours
 * - Licensed staffing hours (LPN + RN combined)
 * - Physical therapist staffing hours
 * - Weekend staffing (total + RN)
 * - Turnover rates (total nursing, RN, admin)
 * - Case-mix index and adjusted staffing metrics
 * - Chain data (ID, facility count, chain average ratings)
 * - Quality ratings (long-stay, short-stay)
 * - Complaints and inspection data
 * - Survey/deficiency details
 */

const runMigration = async (sequelize) => {
  console.log('[Migration] Adding CMS staffing columns to snf_facilities...');

  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping - not PostgreSQL');
      return;
    }

    // Check if column already exists (idempotent)
    const [existing] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'snf_facilities' AND column_name = 'lpn_staffing_hours'
    `);

    if (existing.length > 0) {
      console.log('[Migration] CMS staffing columns already exist, skipping');
      return;
    }

    // Add all new columns in one ALTER TABLE statement for efficiency
    await sequelize.query(`
      ALTER TABLE snf_facilities

      -- Additional Staffing Hours (per resident per day)
      ADD COLUMN IF NOT EXISTS lpn_staffing_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS licensed_staffing_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS pt_staffing_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS weekend_total_nurse_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS weekend_rn_hours NUMERIC(6,3),

      -- Turnover Rates (percentages)
      ADD COLUMN IF NOT EXISTS total_nursing_turnover NUMERIC(6,2),
      ADD COLUMN IF NOT EXISTS rn_turnover NUMERIC(6,2),
      ADD COLUMN IF NOT EXISTS admin_departures INTEGER,

      -- Case-Mix Index
      ADD COLUMN IF NOT EXISTS nursing_case_mix_index NUMERIC(6,4),
      ADD COLUMN IF NOT EXISTS nursing_case_mix_ratio NUMERIC(6,4),

      -- Case-Mix Adjusted Staffing (per resident per day)
      ADD COLUMN IF NOT EXISTS case_mix_cna_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_lpn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_rn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_total_nurse_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_weekend_hours NUMERIC(6,3),

      -- Adjusted Staffing (for state averages comparison)
      ADD COLUMN IF NOT EXISTS adjusted_cna_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_lpn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_rn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_total_nurse_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_weekend_hours NUMERIC(6,3),

      -- Chain Data
      ADD COLUMN IF NOT EXISTS chain_id VARCHAR(20),
      ADD COLUMN IF NOT EXISTS chain_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS chain_facility_count INTEGER,
      ADD COLUMN IF NOT EXISTS chain_avg_overall_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS chain_avg_health_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS chain_avg_staffing_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS chain_avg_qm_rating NUMERIC(3,2),

      -- Additional Quality Ratings
      ADD COLUMN IF NOT EXISTS long_stay_qm_rating INTEGER,
      ADD COLUMN IF NOT EXISTS short_stay_qm_rating INTEGER,

      -- Complaints and Inspections
      ADD COLUMN IF NOT EXISTS substantiated_complaints INTEGER,
      ADD COLUMN IF NOT EXISTS infection_control_citations INTEGER,
      ADD COLUMN IF NOT EXISTS facility_reported_incidents INTEGER,
      ADD COLUMN IF NOT EXISTS fine_count INTEGER,
      ADD COLUMN IF NOT EXISTS total_fines_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS payment_denial_count INTEGER,

      -- Survey Data
      ADD COLUMN IF NOT EXISTS last_health_inspection_date DATE,
      ADD COLUMN IF NOT EXISTS standard_health_deficiencies INTEGER,
      ADD COLUMN IF NOT EXISTS weighted_health_score NUMERIC(8,2),

      -- Additional Flags
      ADD COLUMN IF NOT EXISTS is_urban BOOLEAN,
      ADD COLUMN IF NOT EXISTS in_hospital BOOLEAN,
      ADD COLUMN IF NOT EXISTS has_resident_council BOOLEAN,
      ADD COLUMN IF NOT EXISTS has_sprinkler_system BOOLEAN,
      ADD COLUMN IF NOT EXISTS ownership_changed_12mo BOOLEAN,
      ADD COLUMN IF NOT EXISTS inspection_over_2yrs_ago BOOLEAN,

      -- Data tracking
      ADD COLUMN IF NOT EXISTS cms_processing_date DATE,
      ADD COLUMN IF NOT EXISTS average_residents_per_day NUMERIC(8,2)
    `);

    console.log('[Migration] Added CMS staffing columns successfully');

    // Add indexes for commonly queried columns
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_chain_id ON snf_facilities(chain_id);
      CREATE INDEX IF NOT EXISTS idx_snf_chain_name ON snf_facilities(chain_name);
      CREATE INDEX IF NOT EXISTS idx_snf_is_urban ON snf_facilities(is_urban);
    `);

    console.log('[Migration] Added indexes for new columns');

  } catch (error) {
    console.error('[Migration] Error adding CMS staffing columns:', error.message);
    throw error;
  }
};

module.exports = { runMigration };
