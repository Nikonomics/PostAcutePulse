/**
 * Production CMS Schema Migration
 *
 * Creates all CMS-related tables on the production database.
 * This script is safe to run multiple times (idempotent).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/migrate-cms-schema-production.js
 *
 * Or using the npm script:
 *   DATABASE_URL="postgresql://..." npm run db:migrate:cms
 */

const { Pool } = require('pg');

// Get database URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL="postgresql://..." node scripts/migrate-cms-schema-production.js');
  process.exit(1);
}

const isRemote = connectionString.includes('render.com') || connectionString.includes('amazonaws.com');

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('\n========================================');
    console.log('CMS SCHEMA MIGRATION FOR PRODUCTION');
    console.log('========================================\n');
    console.log('Target database:', connectionString.replace(/:[^:@]+@/, ':***@'));

    // STEP 1: Add missing columns to snf_facilities
    console.log('\n[1/8] Adding missing columns to snf_facilities...');

    await client.query(`
      ALTER TABLE snf_facilities
      ADD COLUMN IF NOT EXISTS lpn_staffing_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS licensed_staffing_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS pt_staffing_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS weekend_total_nurse_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS weekend_rn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS total_nursing_turnover NUMERIC(6,2),
      ADD COLUMN IF NOT EXISTS rn_turnover NUMERIC(6,2),
      ADD COLUMN IF NOT EXISTS admin_departures INTEGER,
      ADD COLUMN IF NOT EXISTS nursing_case_mix_index NUMERIC(6,4),
      ADD COLUMN IF NOT EXISTS nursing_case_mix_ratio NUMERIC(6,4),
      ADD COLUMN IF NOT EXISTS case_mix_cna_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_lpn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_rn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_total_nurse_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS case_mix_weekend_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_cna_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_lpn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_rn_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_total_nurse_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS adjusted_weekend_hours NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS chain_id VARCHAR(20),
      ADD COLUMN IF NOT EXISTS chain_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS chain_facility_count INTEGER,
      ADD COLUMN IF NOT EXISTS chain_avg_overall_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS chain_avg_health_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS chain_avg_staffing_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS chain_avg_qm_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS long_stay_qm_rating INTEGER,
      ADD COLUMN IF NOT EXISTS short_stay_qm_rating INTEGER,
      ADD COLUMN IF NOT EXISTS substantiated_complaints INTEGER,
      ADD COLUMN IF NOT EXISTS infection_control_citations INTEGER,
      ADD COLUMN IF NOT EXISTS facility_reported_incidents INTEGER,
      ADD COLUMN IF NOT EXISTS fine_count INTEGER,
      ADD COLUMN IF NOT EXISTS total_fines_amount NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS payment_denial_count INTEGER,
      ADD COLUMN IF NOT EXISTS last_health_inspection_date DATE,
      ADD COLUMN IF NOT EXISTS standard_health_deficiencies INTEGER,
      ADD COLUMN IF NOT EXISTS weighted_health_score NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS is_urban BOOLEAN,
      ADD COLUMN IF NOT EXISTS in_hospital BOOLEAN,
      ADD COLUMN IF NOT EXISTS has_resident_council BOOLEAN,
      ADD COLUMN IF NOT EXISTS has_sprinkler_system BOOLEAN,
      ADD COLUMN IF NOT EXISTS ownership_changed_12mo BOOLEAN,
      ADD COLUMN IF NOT EXISTS inspection_over_2yrs_ago BOOLEAN,
      ADD COLUMN IF NOT EXISTS cms_processing_date DATE,
      ADD COLUMN IF NOT EXISTS average_residents_per_day NUMERIC(8,2)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_chain_id ON snf_facilities(chain_id);
      CREATE INDEX IF NOT EXISTS idx_snf_chain_name ON snf_facilities(chain_name);
      CREATE INDEX IF NOT EXISTS idx_snf_is_urban ON snf_facilities(is_urban);
    `);
    console.log('  ✓ snf_facilities columns updated');

    // STEP 2: Create cms_extracts table
    console.log('\n[2/8] Creating cms_extracts table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cms_extracts (
        extract_id SERIAL PRIMARY KEY,
        extract_date DATE NOT NULL UNIQUE,
        source_file VARCHAR(255),
        processing_date DATE,
        record_count INTEGER,
        import_started_at TIMESTAMP,
        import_completed_at TIMESTAMP,
        import_status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_extracts_date ON cms_extracts(extract_date);
    `);

    // Insert a default extract for current data
    await client.query(`
      INSERT INTO cms_extracts (extract_date, source_file, import_status, notes)
      VALUES ('2025-11-01', 'NH_ProviderInfo_Nov2025.csv', 'completed', 'Initial import')
      ON CONFLICT (extract_date) DO NOTHING
    `);
    console.log('  ✓ cms_extracts table created');

    // STEP 3: Create vbp_scores table
    console.log('\n[3/8] Creating vbp_scores table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS vbp_scores (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        fiscal_year INTEGER NOT NULL,
        ccn VARCHAR(10) NOT NULL,
        vbp_ranking INTEGER,
        baseline_readmission_rate DECIMAL(8,4),
        baseline_period VARCHAR(50),
        performance_readmission_rate DECIMAL(8,4),
        performance_period VARCHAR(50),
        achievement_score DECIMAL(8,4),
        improvement_score DECIMAL(8,4),
        performance_score DECIMAL(8,4),
        incentive_payment_multiplier DECIMAL(8,6),
        ranking_footnote VARCHAR(20),
        baseline_footnote VARCHAR(20),
        performance_footnote VARCHAR(20),
        achievement_footnote VARCHAR(20),
        improvement_footnote VARCHAR(20),
        performance_score_footnote VARCHAR(20),
        multiplier_footnote VARCHAR(20),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fiscal_year, ccn)
      );
      CREATE INDEX IF NOT EXISTS idx_vbp_ccn ON vbp_scores(ccn);
      CREATE INDEX IF NOT EXISTS idx_vbp_fy ON vbp_scores(fiscal_year);
      CREATE INDEX IF NOT EXISTS idx_vbp_ranking ON vbp_scores(vbp_ranking);
    `);
    console.log('  ✓ vbp_scores table created');

    // STEP 4: Create mds_quality_measures table
    console.log('\n[4/8] Creating mds_quality_measures table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mds_quality_measures (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        measure_code VARCHAR(20) NOT NULL,
        measure_description TEXT,
        q1_score DECIMAL(10,4),
        q2_score DECIMAL(10,4),
        q3_score DECIMAL(10,4),
        q4_score DECIMAL(10,4),
        four_quarter_score DECIMAL(10,4),
        q1_footnote VARCHAR(20),
        q2_footnote VARCHAR(20),
        q3_footnote VARCHAR(20),
        q4_footnote VARCHAR(20),
        state_average DECIMAL(10,4),
        national_average DECIMAL(10,4),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ccn, measure_code)
      );
      CREATE INDEX IF NOT EXISTS idx_mdsqm_ccn ON mds_quality_measures(ccn);
      CREATE INDEX IF NOT EXISTS idx_mdsqm_measure ON mds_quality_measures(measure_code);
    `);
    console.log('  ✓ mds_quality_measures table created');

    // STEP 5: Create covid_vaccination table
    console.log('\n[5/8] Creating covid_vaccination table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS covid_vaccination (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        staff_vaccination_rate DECIMAL(6,2),
        staff_up_to_date_rate DECIMAL(6,2),
        resident_vaccination_rate DECIMAL(6,2),
        resident_up_to_date_rate DECIMAL(6,2),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ccn)
      );
      CREATE INDEX IF NOT EXISTS idx_covid_ccn ON covid_vaccination(ccn);
    `);
    console.log('  ✓ covid_vaccination table created');

    // STEP 6: Create survey_dates table
    console.log('\n[6/8] Creating survey_dates table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_dates (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        survey_date DATE,
        survey_type VARCHAR(100),
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_survdate_ccn ON survey_dates(ccn);
      CREATE INDEX IF NOT EXISTS idx_survdate_date ON survey_dates(survey_date);
      CREATE INDEX IF NOT EXISTS idx_survdate_type ON survey_dates(survey_type);
    `);
    console.log('  ✓ survey_dates table created');

    // STEP 7: Create ownership_records table
    console.log('\n[7/8] Creating ownership_records table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ownership_records (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        role_type VARCHAR(100),
        owner_type VARCHAR(100),
        owner_name VARCHAR(255),
        ownership_percentage DECIMAL(6,2),
        association_date DATE,
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ownership_ccn ON ownership_records(ccn);
      CREATE INDEX IF NOT EXISTS idx_ownership_name ON ownership_records(owner_name);
      CREATE INDEX IF NOT EXISTS idx_ownership_type ON ownership_records(owner_type);
    `);
    console.log('  ✓ ownership_records table created');

    // STEP 8: Create penalty_records table
    console.log('\n[8/8] Creating penalty_records table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS penalty_records (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        penalty_date DATE,
        penalty_type VARCHAR(100),
        fine_amount DECIMAL(12,2),
        payment_denial_start_date DATE,
        payment_denial_days INTEGER,
        cms_processing_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_penalty_ccn ON penalty_records(ccn);
      CREATE INDEX IF NOT EXISTS idx_penalty_date ON penalty_records(penalty_date);
    `);
    console.log('  ✓ penalty_records table created');

    // STEP 9: Create facility_snapshots table for historical data
    console.log('\n[Bonus] Creating facility_snapshots table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS facility_snapshots (
        id SERIAL PRIMARY KEY,
        extract_id INTEGER REFERENCES cms_extracts(extract_id),
        ccn VARCHAR(10) NOT NULL,
        snapshot_date DATE NOT NULL,

        -- Core ratings
        overall_rating INTEGER,
        health_rating INTEGER,
        staffing_rating INTEGER,
        qm_rating INTEGER,

        -- Staffing metrics
        rn_staffing_hours DECIMAL(6,3),
        cna_staffing_hours DECIMAL(6,3),
        lpn_staffing_hours DECIMAL(6,3),
        total_nurse_staffing_hours DECIMAL(6,3),

        -- Turnover
        rn_turnover DECIMAL(6,2),
        total_nursing_turnover DECIMAL(6,2),

        -- Census
        certified_beds INTEGER,
        average_residents_per_day DECIMAL(8,2),
        occupancy_rate DECIMAL(6,2),

        -- Deficiencies
        health_deficiencies INTEGER,
        fire_deficiencies INTEGER,

        -- Fines
        total_fines_amount DECIMAL(12,2),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(ccn, snapshot_date)
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_ccn ON facility_snapshots(ccn);
      CREATE INDEX IF NOT EXISTS idx_snapshots_date ON facility_snapshots(snapshot_date);
    `);
    console.log('  ✓ facility_snapshots table created');

    // Verification
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');

    const tables = [
      'snf_facilities',
      'cms_extracts',
      'vbp_scores',
      'mds_quality_measures',
      'covid_vaccination',
      'survey_dates',
      'ownership_records',
      'penalty_records',
      'facility_snapshots'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ✓ ${table}: ${result.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ✗ ${table}: ERROR - ${e.message}`);
      }
    }

    console.log('\n========================================');
    console.log('MIGRATION COMPLETE');
    console.log('========================================\n');
    console.log('All CMS tables have been created successfully.');
    console.log('');
    console.log('Next steps:');
    console.log('1. The tables are empty - data needs to be imported');
    console.log('2. Run the data import scripts locally with DATABASE_URL pointing to production');
    console.log('3. Or set up a scheduled job to sync data periodically');
    console.log('');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await runMigration();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
