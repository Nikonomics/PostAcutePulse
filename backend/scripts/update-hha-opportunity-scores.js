/**
 * Update HHA Opportunity Scores Using Service Area Data
 *
 * This script recalculates HHA opportunity scores for all geographies (CBSA, state, county)
 * using the hh_service_areas table, which maps HHA agencies to the ZIP codes
 * they actually serve (60-100 mile radius), rather than just their
 * headquarters location.
 *
 * This provides a much more accurate picture of HHA competition in each market.
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/update-hha-opportunity-scores.js [--geography=<type>]
 *
 * Options:
 *   --geography=cbsa   Score CBSAs only
 *   --geography=state  Score states only
 *   --geography=county Score counties only (no ranking display)
 *   --geography=all    Score all geography types (default)
 */

const { Pool } = require('pg');

// Use market database
const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Calculate HHA opportunity score based on competition and population
 * Lower competition per capita = higher opportunity
 */
function calculateHHAOpportunityScore(hhaCount, pop65Plus) {
  if (!pop65Plus || pop65Plus === 0) return null;

  // HHAs per 10,000 65+ population
  const hhasPerTenK = (hhaCount / pop65Plus) * 10000;

  // National average is roughly 5-7 HHAs per 10K 65+ in metro areas
  // Lower = less competition = better opportunity

  // Scoring:
  // 0-1 HHAs/10K = 90-100 (excellent opportunity)
  // 1-3 HHAs/10K = 70-90 (good opportunity)
  // 3-6 HHAs/10K = 50-70 (moderate opportunity)
  // 6-10 HHAs/10K = 30-50 (limited opportunity)
  // 10+ HHAs/10K = 0-30 (saturated market)

  let score;
  if (hhasPerTenK <= 0.5) {
    score = 95 + (0.5 - hhasPerTenK) * 10; // 95-100
  } else if (hhasPerTenK <= 1) {
    score = 90 + (1 - hhasPerTenK) * 10; // 90-95
  } else if (hhasPerTenK <= 3) {
    score = 70 + (3 - hhasPerTenK) * 10; // 70-90
  } else if (hhasPerTenK <= 6) {
    score = 50 + (6 - hhasPerTenK) * 6.67; // 50-70
  } else if (hhasPerTenK <= 10) {
    score = 30 + (10 - hhasPerTenK) * 5; // 30-50
  } else {
    score = Math.max(0, 30 - (hhasPerTenK - 10) * 2); // 0-30
  }

  return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
}

/**
 * Convert score to letter grade
 */
function calculateLetterGrade(score) {
  if (score === null) return null;
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}

/**
 * Score CBSAs using service area data
 */
async function scoreCBSAs(showRankings = true) {
  console.log('\n--- Scoring CBSAs (using service areas) ---');

  // Get HHA count per CBSA using service areas
  const hhaCountsResult = await pool.query(`
    SELECT
      zc.cbsa_code,
      cb.cbsa_title,
      COUNT(DISTINCT sa.ccn) as hha_count
    FROM hh_service_areas sa
    JOIN hud_zip_cbsa zc ON sa.zip_code = zc.zip5
    JOIN cbsas cb ON cb.cbsa_code = zc.cbsa_code
    WHERE zc.cbsa_code IS NOT NULL
    GROUP BY zc.cbsa_code, cb.cbsa_title
    ORDER BY hha_count DESC
  `);

  console.log(`Found ${hhaCountsResult.rows.length} CBSAs with HHA service area data`);

  // Get population data
  const popResult = await pool.query(`
    SELECT geography_id, pop_65_plus
    FROM market_metrics
    WHERE geography_type = 'cbsa'
  `);
  const popMap = new Map(popResult.rows.map(r => [r.geography_id, parseInt(r.pop_65_plus) || 0]));

  // Calculate scores
  const updates = [];
  for (const row of hhaCountsResult.rows) {
    const pop65Plus = popMap.get(row.cbsa_code) || 0;
    const hhaCount = parseInt(row.hha_count);
    const score = calculateHHAOpportunityScore(hhaCount, pop65Plus);
    const grade = calculateLetterGrade(score);

    if (score !== null) {
      updates.push({
        geography_id: row.cbsa_code,
        geography_name: row.cbsa_title,
        hha_count: hhaCount,
        pop_65_plus: pop65Plus,
        hhas_per_10k: pop65Plus > 0 ? ((hhaCount / pop65Plus) * 10000).toFixed(2) : null,
        score: score,
        grade: grade
      });
    }
  }

  updates.sort((a, b) => (b.score || 0) - (a.score || 0));

  if (showRankings && updates.length > 0) {
    console.log(`\nTop 10 CBSA HHA opportunities:`);
    console.log('ID    | Name                          | HHAs | Pop 65+ | HHAs/10K | Score | Grade');
    console.log('-'.repeat(90));

    for (const u of updates.slice(0, 10)) {
      console.log(
        `${(u.geography_id || '').padEnd(5)} | ` +
        `${(u.geography_name || '').substring(0, 29).padEnd(29)} | ` +
        `${String(u.hha_count).padStart(4)} | ` +
        `${String(u.pop_65_plus).padStart(7)} | ` +
        `${String(u.hhas_per_10k).padStart(8)} | ` +
        `${String(u.score).padStart(5)} | ${u.grade}`
      );
    }
  }

  // Update market_grades
  let updated = 0;
  for (const u of updates) {
    try {
      const result = await pool.query(`
        UPDATE market_grades
        SET hha_opportunity_score = $1, hha_grade = $2,
            geography_name = COALESCE(geography_name, $3), calculated_at = NOW()
        WHERE geography_type = 'cbsa' AND geography_id = $4
        RETURNING id
      `, [u.score, u.grade, u.geography_name, u.geography_id]);
      if (result.rowCount > 0) updated++;
    } catch (err) {
      console.error(`Error updating CBSA ${u.geography_id}: ${err.message}`);
    }
  }

  console.log(`Updated ${updated} CBSAs with HHA opportunity scores`);
  return updated;
}

/**
 * Score states using HQ-based HHA data (service areas cross state lines)
 */
async function scoreStates(showRankings = true) {
  console.log('\n--- Scoring STATES (HQ-based) ---');

  // For states, use HQ location since service areas cross state lines
  const metricsResult = await pool.query(`
    SELECT geography_id, geography_name, hha_agency_count, pop_65_plus
    FROM market_metrics
    WHERE geography_type = 'state' AND hha_agency_count IS NOT NULL AND hha_agency_count > 0
    ORDER BY hha_agency_count DESC
  `);

  console.log(`Found ${metricsResult.rows.length} states with HHA data`);

  const updates = [];
  for (const row of metricsResult.rows) {
    const score = calculateHHAOpportunityScore(row.hha_agency_count, row.pop_65_plus);
    const grade = calculateLetterGrade(score);

    if (score !== null) {
      updates.push({
        geography_id: row.geography_id,
        geography_name: row.geography_name,
        hha_count: row.hha_agency_count,
        pop_65_plus: row.pop_65_plus,
        hhas_per_10k: row.pop_65_plus > 0 ? ((row.hha_agency_count / row.pop_65_plus) * 10000).toFixed(2) : null,
        score: score,
        grade: grade
      });
    }
  }

  updates.sort((a, b) => (b.score || 0) - (a.score || 0));

  if (showRankings && updates.length > 0) {
    console.log(`\nTop 10 STATE HHA opportunities:`);
    console.log('ID    | Name                          | HHAs | Pop 65+ | HHAs/10K | Score | Grade');
    console.log('-'.repeat(90));

    for (const u of updates.slice(0, 10)) {
      console.log(
        `${(u.geography_id || '').padEnd(5)} | ` +
        `${(u.geography_name || '').substring(0, 29).padEnd(29)} | ` +
        `${String(u.hha_count).padStart(4)} | ` +
        `${String(u.pop_65_plus).padStart(7)} | ` +
        `${String(u.hhas_per_10k).padStart(8)} | ` +
        `${String(u.score).padStart(5)} | ${u.grade}`
      );
    }
  }

  // Update market_grades
  let updated = 0;
  for (const u of updates) {
    try {
      const result = await pool.query(`
        UPDATE market_grades
        SET hha_opportunity_score = $1, hha_grade = $2,
            geography_name = COALESCE(geography_name, $3), calculated_at = NOW()
        WHERE geography_type = 'state' AND geography_id = $4
        RETURNING id
      `, [u.score, u.grade, u.geography_name, u.geography_id]);
      if (result.rowCount > 0) updated++;
    } catch (err) {
      console.error(`Error updating state ${u.geography_id}: ${err.message}`);
    }
  }

  console.log(`Updated ${updated} states with HHA opportunity scores`);
  return updated;
}

/**
 * Score counties using service area data
 */
async function scoreCounties(showRankings = false) {
  console.log('\n--- Scoring COUNTIES (using service areas) ---');

  // Get HHA count per county using service areas
  const hhaCountsResult = await pool.query(`
    SELECT
      zc.county_fips,
      COUNT(DISTINCT sa.ccn) as hha_count
    FROM hh_service_areas sa
    JOIN hud_zip_county zc ON sa.zip_code = zc.zip5
    WHERE zc.county_fips IS NOT NULL
    GROUP BY zc.county_fips
  `);

  console.log(`Found ${hhaCountsResult.rows.length} counties with HHA service area data`);

  // Get population and name data
  const countyData = await pool.query(`
    SELECT geography_id, geography_name, pop_65_plus
    FROM market_metrics
    WHERE geography_type = 'county'
  `);
  const countyMap = new Map(countyData.rows.map(r => [r.geography_id, r]));

  // Calculate scores
  const updates = [];
  for (const row of hhaCountsResult.rows) {
    const county = countyMap.get(row.county_fips);
    if (!county) continue;

    const hhaCount = parseInt(row.hha_count);
    const pop65Plus = parseInt(county.pop_65_plus) || 0;
    const score = calculateHHAOpportunityScore(hhaCount, pop65Plus);
    const grade = calculateLetterGrade(score);

    if (score !== null) {
      updates.push({
        geography_id: row.county_fips,
        geography_name: county.geography_name,
        hha_count: hhaCount,
        pop_65_plus: pop65Plus,
        score: score,
        grade: grade
      });
    }
  }

  console.log(`Calculated scores for ${updates.length} rural counties`);

  // Update market_grades
  let updated = 0;
  for (const u of updates) {
    try {
      const result = await pool.query(`
        UPDATE market_grades
        SET hha_opportunity_score = $1, hha_grade = $2, calculated_at = NOW()
        WHERE geography_type = 'county' AND geography_id = $3
        RETURNING id
      `, [u.score, u.grade, u.geography_id]);
      if (result.rowCount > 0) updated++;
    } catch (err) {
      // Silently skip errors for counties
    }
  }

  console.log(`Updated ${updated} counties with HHA opportunity scores`);
  return updated;
}

async function main() {
  console.log('=== HHA Opportunity Score Update (Service Area Based) ===\n');

  // Parse command line args
  const args = process.argv.slice(2);
  let geographyArg = args.find(a => a.startsWith('--geography='));
  let geoTypes = ['cbsa', 'state', 'county']; // default: all

  if (geographyArg) {
    const geoType = geographyArg.split('=')[1];
    if (geoType !== 'all') {
      geoTypes = [geoType];
    }
  }

  console.log(`Scoring geography types: ${geoTypes.join(', ')}`);

  try {
    let totalUpdated = 0;

    for (const geoType of geoTypes) {
      const showRankings = geoType !== 'county';

      if (geoType === 'cbsa') {
        totalUpdated += await scoreCBSAs(showRankings);
      } else if (geoType === 'state') {
        totalUpdated += await scoreStates(showRankings);
      } else if (geoType === 'county') {
        totalUpdated += await scoreCounties(showRankings);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total records updated: ${totalUpdated}`);
    console.log('\n=== Done ===');
    console.log('Next step: Run calculate-overall-pac-scores.js');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
