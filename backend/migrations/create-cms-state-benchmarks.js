/**
 * Migration: Create cms_state_benchmarks table
 *
 * Purpose: Store state and national averages from CMS NH_StateUSAverages data
 * This enables "vs state average" and "vs national average" comparisons for all metrics.
 *
 * Contains:
 * - Star ratings (overall, health, QM, staffing)
 * - Deficiency counts by survey cycle
 * - Staffing hours (reported, case-mix adjusted)
 * - Turnover rates
 * - Quality measures (16 long-stay + 4 short-stay metrics)
 * - Penalty/fine data
 */

const runMigration = async (sequelize) => {
  console.log('[Migration] Creating cms_state_benchmarks table...');

  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping - not PostgreSQL');
      return;
    }

    // Check if table already exists
    const [results] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'cms_state_benchmarks'
    `);

    if (results && results.length > 0) {
      console.log('[Migration] cms_state_benchmarks table already exists, skipping');
      return;
    }

    await sequelize.query(`
      CREATE TABLE cms_state_benchmarks (
        id SERIAL PRIMARY KEY,

        -- State identifier (2-letter code or 'NATION' for national average)
        state_code VARCHAR(10) NOT NULL UNIQUE,
        is_national BOOLEAN DEFAULT FALSE,

        -- Star Ratings (averages)
        avg_overall_rating NUMERIC(3,2),
        avg_health_inspection_rating NUMERIC(3,2),
        avg_qm_rating NUMERIC(3,2),
        avg_staffing_rating NUMERIC(3,2),

        -- Deficiency Counts by Survey Cycle
        cycle1_health_deficiencies NUMERIC(6,2),
        cycle1_fire_safety_deficiencies NUMERIC(6,2),
        cycle2_health_deficiencies NUMERIC(6,2),
        cycle2_fire_safety_deficiencies NUMERIC(6,2),
        cycle3_health_deficiencies NUMERIC(6,2),
        cycle3_fire_safety_deficiencies NUMERIC(6,2),

        -- Census
        avg_residents_per_day NUMERIC(8,2),

        -- Reported Staffing Hours (per resident per day)
        avg_cna_hours NUMERIC(6,3),
        avg_lpn_hours NUMERIC(6,3),
        avg_rn_hours NUMERIC(6,3),
        avg_licensed_hours NUMERIC(6,3),
        avg_total_nurse_hours NUMERIC(6,3),
        avg_weekend_total_hours NUMERIC(6,3),
        avg_weekend_rn_hours NUMERIC(6,3),
        avg_pt_hours NUMERIC(6,3),

        -- Turnover Rates
        avg_total_nursing_turnover NUMERIC(6,2),
        avg_rn_turnover NUMERIC(6,2),
        avg_admin_departures NUMERIC(6,2),

        -- Case-Mix Index and Adjusted Staffing
        avg_case_mix_index NUMERIC(6,4),
        avg_case_mix_rn_hours NUMERIC(6,3),
        avg_case_mix_total_hours NUMERIC(6,3),
        avg_case_mix_weekend_hours NUMERIC(6,3),

        -- Penalties
        avg_fine_count NUMERIC(6,2),
        avg_fine_amount NUMERIC(12,2),

        -- Quality Measures - Long Stay (percentages)
        qm_ls_adl_decline NUMERIC(6,3),
        qm_ls_weight_loss NUMERIC(6,3),
        qm_ls_catheter NUMERIC(6,3),
        qm_ls_uti NUMERIC(6,3),
        qm_ls_depressive_symptoms NUMERIC(6,3),
        qm_ls_physical_restraints NUMERIC(6,3),
        qm_ls_falls_major_injury NUMERIC(6,3),
        qm_ls_pneumococcal_vaccine NUMERIC(6,3),
        qm_ls_antipsychotic NUMERIC(6,3),
        qm_ls_walking_decline NUMERIC(6,3),
        qm_ls_antianxiety_hypnotic NUMERIC(6,3),
        qm_ls_flu_vaccine NUMERIC(6,3),
        qm_ls_pressure_ulcers NUMERIC(6,3),
        qm_ls_incontinence NUMERIC(6,3),

        -- Quality Measures - Short Stay (percentages)
        qm_ss_pneumococcal_vaccine NUMERIC(6,3),
        qm_ss_antipsychotic NUMERIC(6,3),
        qm_ss_rehospitalized NUMERIC(6,3),
        qm_ss_ed_visit NUMERIC(6,3),

        -- Utilization Rates (per 1000 resident days)
        hospitalizations_per_1000_days NUMERIC(8,4),
        ed_visits_per_1000_days NUMERIC(8,4),

        -- Metadata
        processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[Migration] Created cms_state_benchmarks table');

    // Add index for fast lookups
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_state_benchmarks_state ON cms_state_benchmarks(state_code);
    `);

    console.log('[Migration] Added index for state_code');

  } catch (error) {
    console.error('[Migration] Error creating cms_state_benchmarks:', error.message);
    throw error;
  }
};

module.exports = { runMigration };
