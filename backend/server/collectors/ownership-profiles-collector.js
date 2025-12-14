/**
 * Ownership Profiles Collector
 *
 * Computes and refreshes aggregate statistics for SNF parent organizations
 * with 2+ facilities. Run periodically to keep profiles current.
 *
 * IMPORTANT: This collector preserves user-editable fields (notes, contacts,
 * comments, etc.) while refreshing CMS aggregate data.
 */

const path = require('path');
const { Pool } = require('pg');

// Minimum facilities to create a profile
const MIN_FACILITIES = 2;

/**
 * Refresh all ownership profiles
 * Uses upsert approach to preserve user-editable fields
 */
async function refreshOwnershipProfiles(pool) {
  console.log('[Ownership Profiles] Starting refresh...');
  const startTime = Date.now();

  // Step 1: Create temp table with computed CMS data
  await pool.query(`
    CREATE TEMP TABLE temp_ownership_profiles AS
    SELECT
      f.parent_organization,
      COUNT(*) as facility_count,
      COALESCE(SUM(f.total_beds), 0) as total_beds,
      COALESCE(SUM(f.certified_beds), 0) as total_certified_beds,
      ARRAY_AGG(DISTINCT f.state ORDER BY f.state) as states_operated,
      COUNT(DISTINCT f.state) as state_count,
      COUNT(DISTINCT f.cbsa_code) as cbsa_count,
      ROUND(AVG(f.overall_rating)::numeric, 2) as avg_overall_rating,
      ROUND(AVG(f.health_inspection_rating)::numeric, 2) as avg_health_inspection_rating,
      ROUND(AVG(f.quality_measure_rating)::numeric, 2) as avg_quality_measure_rating,
      ROUND(AVG(f.staffing_rating)::numeric, 2) as avg_staffing_rating,
      COUNT(*) FILTER (WHERE f.overall_rating = 5) as five_star_count,
      COUNT(*) FILTER (WHERE f.overall_rating = 4) as four_star_count,
      COUNT(*) FILTER (WHERE f.overall_rating = 3) as three_star_count,
      COUNT(*) FILTER (WHERE f.overall_rating = 2) as two_star_count,
      COUNT(*) FILTER (WHERE f.overall_rating = 1) as one_star_count,
      ROUND(AVG(f.occupancy_rate)::numeric, 2) as avg_occupancy_rate,
      COALESCE(SUM(f.occupied_beds), 0) as total_occupied_beds,
      ROUND(AVG(f.rn_staffing_hours)::numeric, 2) as avg_rn_staffing_hours,
      ROUND(AVG(f.total_nurse_staffing_hours)::numeric, 2) as avg_total_nurse_staffing_hours,
      COALESCE(SUM(f.health_deficiencies), 0) as total_health_deficiencies,
      COALESCE(SUM(f.fire_safety_deficiencies), 0) as total_fire_safety_deficiencies,
      ROUND(AVG(f.health_deficiencies)::numeric, 2) as avg_health_deficiencies_per_facility,
      COALESCE(SUM(f.total_penalties_amount), 0) as total_penalties_amount,
      COALESCE(SUM(f.penalty_count), 0) as total_penalty_count,
      COUNT(*) FILTER (WHERE f.ownership_type ILIKE '%profit%' AND f.ownership_type NOT ILIKE '%non%') as for_profit_count,
      COUNT(*) FILTER (WHERE f.ownership_type ILIKE '%non%profit%') as non_profit_count,
      COUNT(*) FILTER (WHERE f.ownership_type ILIKE '%government%') as government_count
    FROM snf_facilities f
    WHERE f.parent_organization IS NOT NULL
      AND f.parent_organization != ''
    GROUP BY f.parent_organization
    HAVING COUNT(*) >= $1
  `, [MIN_FACILITIES]);

  // Step 2: Update existing CMS-sourced profiles (preserves user-editable fields)
  const updateResult = await pool.query(`
    UPDATE ownership_profiles op
    SET
      facility_count = t.facility_count,
      total_beds = t.total_beds,
      total_certified_beds = t.total_certified_beds,
      states_operated = t.states_operated,
      state_count = t.state_count,
      cbsa_count = t.cbsa_count,
      avg_overall_rating = t.avg_overall_rating,
      avg_health_inspection_rating = t.avg_health_inspection_rating,
      avg_quality_measure_rating = t.avg_quality_measure_rating,
      avg_staffing_rating = t.avg_staffing_rating,
      five_star_count = t.five_star_count,
      four_star_count = t.four_star_count,
      three_star_count = t.three_star_count,
      two_star_count = t.two_star_count,
      one_star_count = t.one_star_count,
      avg_occupancy_rate = t.avg_occupancy_rate,
      total_occupied_beds = t.total_occupied_beds,
      avg_rn_staffing_hours = t.avg_rn_staffing_hours,
      avg_total_nurse_staffing_hours = t.avg_total_nurse_staffing_hours,
      total_health_deficiencies = t.total_health_deficiencies,
      total_fire_safety_deficiencies = t.total_fire_safety_deficiencies,
      avg_health_deficiencies_per_facility = t.avg_health_deficiencies_per_facility,
      total_penalties_amount = t.total_penalties_amount,
      total_penalty_count = t.total_penalty_count,
      for_profit_count = t.for_profit_count,
      non_profit_count = t.non_profit_count,
      government_count = t.government_count,
      last_refreshed_at = NOW()
    FROM temp_ownership_profiles t
    WHERE op.parent_organization = t.parent_organization
  `);
  console.log(`[Ownership Profiles] Updated ${updateResult.rowCount} existing profiles`);

  // Step 3: Insert new profiles that don't exist yet
  const insertResult = await pool.query(`
    INSERT INTO ownership_profiles (
      parent_organization,
      facility_count,
      total_beds,
      total_certified_beds,
      states_operated,
      state_count,
      cbsa_count,
      avg_overall_rating,
      avg_health_inspection_rating,
      avg_quality_measure_rating,
      avg_staffing_rating,
      five_star_count,
      four_star_count,
      three_star_count,
      two_star_count,
      one_star_count,
      avg_occupancy_rate,
      total_occupied_beds,
      avg_rn_staffing_hours,
      avg_total_nurse_staffing_hours,
      total_health_deficiencies,
      total_fire_safety_deficiencies,
      avg_health_deficiencies_per_facility,
      total_penalties_amount,
      total_penalty_count,
      for_profit_count,
      non_profit_count,
      government_count,
      is_cms_sourced,
      last_refreshed_at
    )
    SELECT
      t.parent_organization,
      t.facility_count,
      t.total_beds,
      t.total_certified_beds,
      t.states_operated,
      t.state_count,
      t.cbsa_count,
      t.avg_overall_rating,
      t.avg_health_inspection_rating,
      t.avg_quality_measure_rating,
      t.avg_staffing_rating,
      t.five_star_count,
      t.four_star_count,
      t.three_star_count,
      t.two_star_count,
      t.one_star_count,
      t.avg_occupancy_rate,
      t.total_occupied_beds,
      t.avg_rn_staffing_hours,
      t.avg_total_nurse_staffing_hours,
      t.total_health_deficiencies,
      t.total_fire_safety_deficiencies,
      t.avg_health_deficiencies_per_facility,
      t.total_penalties_amount,
      t.total_penalty_count,
      t.for_profit_count,
      t.non_profit_count,
      t.government_count,
      TRUE,
      NOW()
    FROM temp_ownership_profiles t
    LEFT JOIN ownership_profiles op ON op.parent_organization = t.parent_organization
    WHERE op.id IS NULL
  `);
  console.log(`[Ownership Profiles] Inserted ${insertResult.rowCount} new profiles`);

  // Step 4: Handle profiles that no longer meet minimum facility count
  // Only delete CMS-sourced profiles with no user data (contacts, comments, edits)
  const deleteResult = await pool.query(`
    DELETE FROM ownership_profiles op
    WHERE op.is_cms_sourced = TRUE
      AND op.parent_organization NOT IN (SELECT parent_organization FROM temp_ownership_profiles)
      AND op.notes IS NULL
      AND op.company_description IS NULL
      AND op.headquarters_address IS NULL
      AND NOT EXISTS (SELECT 1 FROM ownership_contacts oc WHERE oc.ownership_profile_id = op.id)
      AND NOT EXISTS (SELECT 1 FROM ownership_comments ocm WHERE ocm.ownership_profile_id = op.id)
  `);
  if (deleteResult.rowCount > 0) {
    console.log(`[Ownership Profiles] Removed ${deleteResult.rowCount} obsolete profiles (no user data)`);
  }

  // Step 5: Mark profiles that lost facilities but have user data (soft-mark for review)
  const orphanedResult = await pool.query(`
    UPDATE ownership_profiles op
    SET facility_count = 0, last_refreshed_at = NOW()
    WHERE op.is_cms_sourced = TRUE
      AND op.parent_organization NOT IN (SELECT parent_organization FROM temp_ownership_profiles)
      AND (
        op.notes IS NOT NULL
        OR op.company_description IS NOT NULL
        OR op.headquarters_address IS NOT NULL
        OR EXISTS (SELECT 1 FROM ownership_contacts oc WHERE oc.ownership_profile_id = op.id)
        OR EXISTS (SELECT 1 FROM ownership_comments ocm WHERE ocm.ownership_profile_id = op.id)
      )
  `);
  if (orphanedResult.rowCount > 0) {
    console.log(`[Ownership Profiles] Marked ${orphanedResult.rowCount} profiles as orphaned (have user data, keeping)`);
  }

  // Clean up temp table
  await pool.query('DROP TABLE IF EXISTS temp_ownership_profiles');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalProfiles = updateResult.rowCount + insertResult.rowCount;
  console.log(`[Ownership Profiles] Refresh complete: ${totalProfiles} profiles in ${elapsed}s`);

  return totalProfiles;
}

/**
 * Print summary statistics
 */
async function printSummary(pool) {
  console.log('\n[Ownership Profiles] === Summary ===\n');

  // Total profiles
  const totalResult = await pool.query('SELECT COUNT(*) as count FROM ownership_profiles');
  console.log(`Total profiles: ${totalResult.rows[0].count}`);

  // By size tier
  const tierResult = await pool.query(`
    SELECT
      CASE
        WHEN facility_count >= 100 THEN '100+ facilities'
        WHEN facility_count >= 50 THEN '50-99 facilities'
        WHEN facility_count >= 20 THEN '20-49 facilities'
        WHEN facility_count >= 10 THEN '10-19 facilities'
        WHEN facility_count >= 5 THEN '5-9 facilities'
        ELSE '2-4 facilities'
      END as tier,
      COUNT(*) as companies,
      SUM(facility_count) as total_facilities,
      SUM(total_beds) as total_beds
    FROM ownership_profiles
    GROUP BY 1
    ORDER BY MIN(facility_count) DESC
  `);

  console.log('\nBy size tier:');
  console.log('Tier              | Companies | Facilities | Beds');
  console.log('------------------|-----------|------------|--------');
  for (const row of tierResult.rows) {
    console.log(`${row.tier.padEnd(17)} | ${String(row.companies).padStart(9)} | ${String(row.total_facilities).padStart(10)} | ${String(row.total_beds || 0).padStart(6)}`);
  }

  // Top 10 by facility count
  const topResult = await pool.query(`
    SELECT parent_organization, facility_count, total_beds,
           state_count, avg_overall_rating
    FROM ownership_profiles
    ORDER BY facility_count DESC
    LIMIT 10
  `);

  console.log('\nTop 10 by facility count:');
  for (const row of topResult.rows) {
    const rating = row.avg_overall_rating ? parseFloat(row.avg_overall_rating).toFixed(1) : 'N/A';
    console.log(`  ${row.facility_count} facilities - ${row.parent_organization} (${row.state_count} states, ${rating}★)`);
  }
}

/**
 * Main function
 */
async function runCollector() {
  console.log('='.repeat(60));
  console.log('[Ownership Profiles Collector] Starting');
  console.log('='.repeat(60));

  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query('SELECT 1');
    console.log('[Ownership Profiles] Database connection successful');

    const profileCount = await refreshOwnershipProfiles(pool);
    await printSummary(pool);

    console.log('\n[Ownership Profiles] Collection complete');
    return profileCount;

  } catch (err) {
    console.error('[Ownership Profiles] Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

  runCollector()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Collector failed:', err);
      process.exit(1);
    });
}

module.exports = { runCollector, refreshOwnershipProfiles, MIN_FACILITIES };
