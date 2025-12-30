/**
 * Rebuild Market Metrics
 *
 * Aggregates facility data (SNF, ALF, HHA) per CBSA into the market_metrics table.
 * This is the foundation for all opportunity scoring - must run BEFORE scoring scripts.
 *
 * Data Sources:
 * - snf_facilities: SNF counts, beds, quality ratings, occupancy
 * - alf_facilities: ALF counts, capacity
 * - hh_provider_snapshots: HHA counts, episodes, star ratings (HQ-based)
 * - county_demographics: Population 65+, 85+, income, growth projections
 * - hud_zip_cbsa: ZIP-to-CBSA crosswalk for facility assignments
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/rebuild-market-metrics.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function main() {
  console.log('=== Rebuild Market Metrics ===\n');

  try {
    // Step 1: Verify HUD crosswalk exists
    console.log('Step 1: Verifying hud_zip_cbsa table...');
    const hudCheck = await pool.query(`SELECT COUNT(*) as count FROM hud_zip_cbsa`);
    console.log(`  Found ${hudCheck.rows[0].count} ZIP-to-CBSA mappings`);

    if (parseInt(hudCheck.rows[0].count) < 30000) {
      throw new Error('hud_zip_cbsa table appears incomplete. Run HUD crosswalk loader first.');
    }

    // Step 2: Update facility CBSA assignments from HUD crosswalk
    console.log('\nStep 2: Updating facility CBSA assignments...');

    // SNF
    const snfUpdate = await pool.query(`
      UPDATE snf_facilities f
      SET cbsa_code = h.cbsa_code
      FROM hud_zip_cbsa h
      WHERE LEFT(f.zip_code, 5) = h.zip5
        AND (f.cbsa_code IS DISTINCT FROM h.cbsa_code)
      RETURNING f.federal_provider_number
    `);
    console.log(`  SNF: ${snfUpdate.rowCount} facilities updated`);

    // ALF
    const alfUpdate = await pool.query(`
      UPDATE alf_facilities f
      SET cbsa_code = h.cbsa_code
      FROM hud_zip_cbsa h
      WHERE LEFT(f.zip_code, 5) = h.zip5
        AND (f.cbsa_code IS DISTINCT FROM h.cbsa_code)
      RETURNING f.id
    `);
    console.log(`  ALF: ${alfUpdate.rowCount} facilities updated`);

    // HHA (latest extract only)
    const hhaUpdate = await pool.query(`
      UPDATE hh_provider_snapshots h
      SET cbsa_code = hud.cbsa_code
      FROM hud_zip_cbsa hud
      WHERE h.extract_id = (SELECT MAX(extract_id) FROM hh_provider_snapshots)
        AND LEFT(h.zip_code, 5) = hud.zip5
        AND (h.cbsa_code IS DISTINCT FROM hud.cbsa_code)
      RETURNING h.ccn
    `);
    console.log(`  HHA: ${hhaUpdate.rowCount} providers updated`);

    // Step 3: Truncate and rebuild market_metrics
    console.log('\nStep 3: Rebuilding market_metrics table...');

    await pool.query(`TRUNCATE market_metrics CASCADE`);
    console.log('  Truncated market_metrics');

    // Insert base records from SNF data
    const snfInsert = await pool.query(`
      INSERT INTO market_metrics (
        geography_type, geography_id,
        snf_facility_count, snf_total_beds,
        snf_avg_overall_rating, snf_avg_occupancy
      )
      SELECT
        'cbsa',
        cbsa_code,
        COUNT(*) as snf_facility_count,
        SUM(number_of_certified_beds) as snf_total_beds,
        ROUND(AVG(overall_rating)::numeric, 2) as snf_avg_overall_rating,
        ROUND(AVG(occupancy_rate)::numeric, 2) as snf_avg_occupancy
      FROM snf_facilities
      WHERE cbsa_code IS NOT NULL
      GROUP BY cbsa_code
      RETURNING geography_id
    `);
    console.log(`  Inserted ${snfInsert.rowCount} CBSAs from SNF data`);

    // Step 4: Add ALF metrics
    console.log('\nStep 4: Adding ALF metrics...');

    const alfMetrics = await pool.query(`
      UPDATE market_metrics mm
      SET
        alf_facility_count = agg.facility_count,
        alf_total_capacity = agg.total_capacity
      FROM (
        SELECT
          cbsa_code,
          COUNT(*) as facility_count,
          SUM(COALESCE(capacity, 0)) as total_capacity
        FROM alf_facilities
        WHERE cbsa_code IS NOT NULL
        GROUP BY cbsa_code
      ) agg
      WHERE mm.geography_id = agg.cbsa_code
        AND mm.geography_type = 'cbsa'
      RETURNING mm.geography_id
    `);
    console.log(`  Updated ${alfMetrics.rowCount} CBSAs with ALF data`);

    // Insert CBSAs that have ALF but no SNF
    const alfOnlyInsert = await pool.query(`
      INSERT INTO market_metrics (
        geography_type, geography_id,
        alf_facility_count, alf_total_capacity
      )
      SELECT
        'cbsa',
        cbsa_code,
        COUNT(*) as alf_facility_count,
        SUM(COALESCE(capacity, 0)) as alf_total_capacity
      FROM alf_facilities
      WHERE cbsa_code IS NOT NULL
        AND cbsa_code NOT IN (SELECT geography_id FROM market_metrics WHERE geography_type = 'cbsa')
      GROUP BY cbsa_code
      RETURNING geography_id
    `);
    console.log(`  Inserted ${alfOnlyInsert.rowCount} ALF-only CBSAs`);

    // Step 5: Add HHA metrics (HQ-based)
    console.log('\nStep 5: Adding HHA metrics (headquarters-based)...');

    const hhaMetrics = await pool.query(`
      UPDATE market_metrics mm
      SET
        hha_agency_count = agg.agency_count,
        hha_total_episodes = agg.total_episodes,
        hha_avg_star_rating = agg.avg_rating
      FROM (
        SELECT
          cbsa_code,
          COUNT(*) as agency_count,
          SUM(total_episodes_fy) as total_episodes,
          ROUND(AVG(quality_of_patient_care_star_rating)::numeric, 2) as avg_rating
        FROM hh_provider_snapshots
        WHERE extract_id = (SELECT MAX(extract_id) FROM hh_provider_snapshots)
          AND cbsa_code IS NOT NULL
        GROUP BY cbsa_code
      ) agg
      WHERE mm.geography_id = agg.cbsa_code
        AND mm.geography_type = 'cbsa'
      RETURNING mm.geography_id
    `);
    console.log(`  Updated ${hhaMetrics.rowCount} CBSAs with HHA data`);

    // Step 6: Add demographics
    console.log('\nStep 6: Adding demographic data...');

    const demoUpdate = await pool.query(`
      UPDATE market_metrics mm
      SET
        pop_65_plus = cd.pop_65_plus,
        pop_85_plus = cd.pop_85_plus,
        median_household_income = cd.median_income,
        projected_growth_65_2030 = cd.growth_rate
      FROM (
        SELECT
          cbsa_code,
          SUM(population_65_plus) as pop_65_plus,
          SUM(population_85_plus) as pop_85_plus,
          ROUND(AVG(median_household_income)::numeric, 0) as median_income,
          ROUND(AVG(projected_growth_65_2030)::numeric, 2) as growth_rate
        FROM county_demographics
        WHERE cbsa_code IS NOT NULL
        GROUP BY cbsa_code
      ) cd
      WHERE mm.geography_id = cd.cbsa_code
        AND mm.geography_type = 'cbsa'
      RETURNING mm.geography_id
    `);
    console.log(`  Updated ${demoUpdate.rowCount} CBSAs with demographics`);

    // Step 7: Calculate per-capita metrics
    console.log('\nStep 7: Calculating per-capita metrics...');

    await pool.query(`
      UPDATE market_metrics
      SET
        snf_beds_per_1k_65 = CASE
          WHEN pop_65_plus > 0 THEN LEAST(999.99, ROUND((snf_total_beds::numeric / pop_65_plus) * 1000, 2))
          ELSE NULL
        END,
        alf_beds_per_1k_65 = CASE
          WHEN pop_65_plus > 0 THEN LEAST(999.99, ROUND((alf_total_capacity::numeric / pop_65_plus) * 1000, 2))
          ELSE NULL
        END,
        hha_agencies_per_100k_65 = CASE
          WHEN pop_65_plus > 0 THEN ROUND((hha_agency_count::numeric / pop_65_plus) * 100000, 2)
          ELSE NULL
        END
      WHERE geography_type = 'cbsa'
    `);
    console.log('  Calculated beds per 1K 65+ and agencies per 100K 65+');

    // Step 8: Summary
    console.log('\n=== Summary ===');

    const summary = await pool.query(`
      SELECT
        COUNT(*) as total_cbsas,
        COUNT(snf_facility_count) as with_snf,
        COUNT(alf_facility_count) as with_alf,
        COUNT(hha_agency_count) as with_hha,
        COUNT(pop_65_plus) as with_demographics
      FROM market_metrics
      WHERE geography_type = 'cbsa'
    `);

    const s = summary.rows[0];
    console.log(`Total CBSAs: ${s.total_cbsas}`);
    console.log(`  With SNF data: ${s.with_snf}`);
    console.log(`  With ALF data: ${s.with_alf}`);
    console.log(`  With HHA data: ${s.with_hha}`);
    console.log(`  With demographics: ${s.with_demographics}`);

    console.log('\n=== Done ===');
    console.log('Next step: Run update-snf-opportunity-scores.js');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
