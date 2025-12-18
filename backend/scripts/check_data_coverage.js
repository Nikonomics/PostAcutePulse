const { Pool } = require('pg');

const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
const isRemote = connectionString.includes('render.com') || connectionString.includes('amazonaws.com');

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

async function runQuery(client, query, label) {
  try {
    return await client.query(query);
  } catch (e) {
    console.log(`  [${label}] Query error: ${e.message}`);
    return null;
  }
}

async function checkCoverage() {
  const client = await pool.connect();
  try {
    // First get the actual columns in snf_facilities
    console.log('\n=== SNF_FACILITIES TABLE STRUCTURE ===');
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'snf_facilities'
      ORDER BY ordinal_position
    `);
    const colNames = columns.rows.map(r => r.column_name);
    console.log(`Total columns: ${colNames.length}`);

    // Get total count
    const totalRes = await client.query('SELECT COUNT(*) as total FROM snf_facilities');
    const total = parseInt(totalRes.rows[0].total);
    console.log(`Total facilities: ${total}`);

    console.log('\n=== CORE FACILITY DATA ===');
    const coreFields = ['federal_provider_number', 'facility_name', 'address', 'city', 'state', 'zip_code', 'county', 'phone', 'latitude', 'longitude', 'total_beds', 'certified_beds', 'occupied_beds', 'occupancy_rate', 'ownership_type', 'legal_business_name', 'parent_organization', 'chain_id', 'chain_name'];
    for (const field of coreFields) {
      if (colNames.includes(field)) {
        const res = await client.query(`SELECT COUNT(${field}) as cnt FROM snf_facilities`);
        const pct = ((parseInt(res.rows[0].cnt) / total) * 100).toFixed(1);
        console.log(`  ${field}: ${res.rows[0].cnt} (${pct}%)`);
      } else {
        console.log(`  ${field}: COLUMN NOT EXISTS`);
      }
    }

    console.log('\n=== QUALITY RATINGS ===');
    const ratingFields = ['overall_rating', 'health_inspection_rating', 'quality_measure_rating', 'staffing_rating', 'long_stay_qm_rating', 'short_stay_qm_rating'];
    for (const field of ratingFields) {
      if (colNames.includes(field)) {
        const res = await client.query(`SELECT COUNT(${field}) as cnt FROM snf_facilities`);
        const pct = ((parseInt(res.rows[0].cnt) / total) * 100).toFixed(1);
        console.log(`  ${field}: ${res.rows[0].cnt} (${pct}%)`);
      } else {
        console.log(`  ${field}: COLUMN NOT EXISTS`);
      }
    }

    console.log('\n=== STAFFING METRICS ===');
    const staffingFields = ['rn_staffing_hours', 'lpn_staffing_hours', 'total_nurse_staffing_hours', 'reported_cna_staffing_hours', 'pt_staffing_hours', 'weekend_total_nurse_hours', 'weekend_rn_hours', 'case_mix_cna_hours', 'case_mix_lpn_hours', 'case_mix_rn_hours', 'case_mix_total_nurse_hours', 'total_nursing_turnover', 'rn_turnover', 'admin_departures'];
    for (const field of staffingFields) {
      if (colNames.includes(field)) {
        const res = await client.query(`SELECT COUNT(${field}) as cnt FROM snf_facilities`);
        const pct = ((parseInt(res.rows[0].cnt) / total) * 100).toFixed(1);
        console.log(`  ${field}: ${res.rows[0].cnt} (${pct}%)`);
      } else {
        console.log(`  ${field}: COLUMN NOT EXISTS`);
      }
    }

    console.log('\n=== COMPLIANCE & PENALTIES ===');
    const complianceFields = ['health_deficiencies', 'fire_safety_deficiencies', 'complaint_deficiencies', 'infection_control_citations', 'substantiated_complaints', 'last_health_inspection_date', 'weighted_health_score', 'total_penalties_amount', 'penalty_count', 'fine_count', 'total_fines_amount', 'payment_denial_count'];
    for (const field of complianceFields) {
      if (colNames.includes(field)) {
        const res = await client.query(`SELECT COUNT(${field}) as cnt FROM snf_facilities`);
        const pct = ((parseInt(res.rows[0].cnt) / total) * 100).toFixed(1);
        console.log(`  ${field}: ${res.rows[0].cnt} (${pct}%)`);
      } else {
        console.log(`  ${field}: COLUMN NOT EXISTS`);
      }
    }

    // Check VBP Scores table
    console.log('\n=== VBP SCORES ===');
    try {
      const vbp = await client.query(`
        SELECT
          COUNT(*) as total_rows,
          COUNT(DISTINCT ccn) as unique_facilities,
          COUNT(DISTINCT fiscal_year) as fiscal_years,
          MIN(fiscal_year) as min_year,
          MAX(fiscal_year) as max_year
        FROM vbp_scores
      `);
      console.log(`Total rows: ${vbp.rows[0].total_rows}`);
      console.log(`Unique facilities: ${vbp.rows[0].unique_facilities}`);
      console.log(`Fiscal years: ${vbp.rows[0].fiscal_years} (${vbp.rows[0].min_year} - ${vbp.rows[0].max_year})`);

      // Get VBP columns
      const vbpCols = await client.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'vbp_scores'
      `);
      const vbpColNames = vbpCols.rows.map(r => r.column_name);
      const vbpFields = ['vbp_ranking', 'baseline_readmission_rate', 'performance_readmission_rate', 'achievement_score', 'improvement_score', 'performance_score', 'incentive_payment_multiplier'];
      const totalV = parseInt(vbp.rows[0].total_rows);
      for (const field of vbpFields) {
        if (vbpColNames.includes(field)) {
          const res = await client.query(`SELECT COUNT(${field}) as cnt FROM vbp_scores`);
          const pct = ((parseInt(res.rows[0].cnt) / totalV) * 100).toFixed(1);
          console.log(`  ${field}: ${res.rows[0].cnt} (${pct}%)`);
        } else {
          console.log(`  ${field}: COLUMN NOT EXISTS`);
        }
      }
    } catch (e) {
      console.log('VBP_SCORES table not found or error:', e.message);
    }

    // Check MDS Quality Measures
    console.log('\n=== MDS QUALITY MEASURES ===');
    try {
      const mds = await client.query(`
        SELECT
          COUNT(*) as total_rows,
          COUNT(DISTINCT ccn) as unique_facilities,
          COUNT(DISTINCT measure_code) as unique_measures
        FROM mds_quality_measures
      `);
      console.log(`Total rows: ${mds.rows[0].total_rows}`);
      console.log(`Unique facilities: ${mds.rows[0].unique_facilities}`);
      console.log(`Unique measures: ${mds.rows[0].unique_measures}`);

      const totalM = parseInt(mds.rows[0].total_rows);
      if (totalM > 0) {
        const mdsCols = await client.query(`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'mds_quality_measures'
        `);
        const mdsColNames = mdsCols.rows.map(r => r.column_name);
        const mdsFields = ['q1_score', 'q2_score', 'q3_score', 'q4_score', 'four_quarter_score', 'state_average', 'national_average'];
        for (const field of mdsFields) {
          if (mdsColNames.includes(field)) {
            const res = await client.query(`SELECT COUNT(${field}) as cnt FROM mds_quality_measures`);
            const pct = ((parseInt(res.rows[0].cnt) / totalM) * 100).toFixed(1);
            console.log(`  ${field}: ${res.rows[0].cnt} (${pct}%)`);
          }
        }
      }
    } catch (e) {
      console.log('MDS_QUALITY_MEASURES table not found or error:', e.message);
    }

    // Check COVID Vaccination
    console.log('\n=== COVID VACCINATION ===');
    try {
      const covid = await client.query(`
        SELECT COUNT(*) as total_rows, COUNT(DISTINCT ccn) as unique_facilities
        FROM covid_vaccination
      `);
      console.log(`Total rows: ${covid.rows[0].total_rows}`);
      console.log(`Unique facilities: ${covid.rows[0].unique_facilities}`);
    } catch (e) {
      console.log('COVID_VACCINATION table not found');
    }

    // Check Ownership Records
    console.log('\n=== OWNERSHIP RECORDS ===');
    try {
      const ownership = await client.query(`
        SELECT COUNT(*) as total_rows, COUNT(DISTINCT ccn) as unique_facilities
        FROM ownership_records
      `);
      console.log(`Total rows: ${ownership.rows[0].total_rows}`);
      console.log(`Unique facilities: ${ownership.rows[0].unique_facilities}`);
    } catch (e) {
      console.log('OWNERSHIP_RECORDS table not found');
    }

    // Check Market/Regional Data
    console.log('\n=== MARKET/REGIONAL DATA ===');
    const marketTables = ['state_demographics', 'county_demographics', 'state_market_metrics', 'cbsas', 'cms_wage_index', 'county_cbsa_crosswalk'];
    for (const table of marketTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ${table}: TABLE NOT FOUND`);
      }
    }

    // Check Historical/Timeseries Data
    console.log('\n=== HISTORICAL/TIMESERIES DATA ===');
    const tsTables = ['facility_snapshots', 'cms_extracts', 'health_citations', 'fire_safety_citations', 'penalty_records'];
    for (const table of tsTables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ${table}: TABLE NOT FOUND`);
      }
    }

    // List all tables
    console.log('\n=== ALL TABLES IN DATABASE ===');
    const allTables = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    for (const t of allTables.rows) {
      const cnt = await client.query(`SELECT COUNT(*) as count FROM "${t.tablename}"`);
      console.log(`  ${t.tablename}: ${cnt.rows[0].count} rows`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkCoverage().catch(console.error);
