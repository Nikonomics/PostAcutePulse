/**
 * Update HHA Opportunity Scores Using Service Area Data
 *
 * This script recalculates HHA opportunity scores for all CBSAs using
 * the hh_service_areas table, which maps HHA agencies to the ZIP codes
 * they actually serve (60-100 mile radius), rather than just their
 * headquarters location.
 *
 * This provides a much more accurate picture of HHA competition in each market.
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/update-hha-opportunity-scores.js
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

async function main() {
  console.log('=== HHA Opportunity Score Update (Service Area Based) ===\n');

  try {
    // Step 1: Get HHA count per CBSA using service areas
    console.log('Step 1: Calculating HHA counts per CBSA using service area data...');

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

    // Create lookup map
    const hhaCountsByCBSA = new Map();
    for (const row of hhaCountsResult.rows) {
      hhaCountsByCBSA.set(row.cbsa_code, {
        hha_count: parseInt(row.hha_count),
        cbsa_title: row.cbsa_title
      });
    }

    // Step 2: Get 65+ population per CBSA
    console.log('\nStep 2: Getting 65+ population data per CBSA...');

    const popResult = await pool.query(`
      SELECT
        cbsa_code,
        SUM(population_65_plus) as pop_65_plus
      FROM county_demographics
      WHERE cbsa_code IS NOT NULL
      GROUP BY cbsa_code
    `);

    const popByCBSA = new Map();
    for (const row of popResult.rows) {
      popByCBSA.set(row.cbsa_code, parseInt(row.pop_65_plus) || 0);
    }

    console.log(`Found population data for ${popByCBSA.size} CBSAs`);

    // Step 3: Calculate new HHA opportunity scores
    console.log('\nStep 3: Calculating new HHA opportunity scores...');

    const updates = [];
    for (const [cbsaCode, data] of hhaCountsByCBSA) {
      const pop65Plus = popByCBSA.get(cbsaCode) || 0;
      const score = calculateHHAOpportunityScore(data.hha_count, pop65Plus);
      const grade = calculateLetterGrade(score);

      if (score !== null) {
        updates.push({
          cbsa_code: cbsaCode,
          cbsa_title: data.cbsa_title,
          hha_count: data.hha_count,
          pop_65_plus: pop65Plus,
          hhas_per_10k: pop65Plus > 0 ? ((data.hha_count / pop65Plus) * 10000).toFixed(2) : null,
          score: score,
          grade: grade
        });
      }
    }

    // Sort by score descending to show best opportunities
    updates.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`\nTop 15 HHA opportunities (best scores):`);
    console.log('CBSA Code | CBSA Name | HHAs | Pop 65+ | HHAs/10K | Score | Grade');
    console.log('-'.repeat(85));

    for (const u of updates.slice(0, 15)) {
      console.log(`${u.cbsa_code.padEnd(9)} | ${(u.cbsa_title || '').substring(0, 25).padEnd(25)} | ${String(u.hha_count).padStart(4)} | ${String(u.pop_65_plus).padStart(7)} | ${String(u.hhas_per_10k).padStart(8)} | ${String(u.score).padStart(5)} | ${u.grade}`);
    }

    console.log(`\nBottom 15 HHA opportunities (most competitive):`);
    console.log('CBSA Code | CBSA Name | HHAs | Pop 65+ | HHAs/10K | Score | Grade');
    console.log('-'.repeat(85));

    for (const u of updates.slice(-15).reverse()) {
      console.log(`${u.cbsa_code.padEnd(9)} | ${(u.cbsa_title || '').substring(0, 25).padEnd(25)} | ${String(u.hha_count).padStart(4)} | ${String(u.pop_65_plus).padStart(7)} | ${String(u.hhas_per_10k).padStart(8)} | ${String(u.score).padStart(5)} | ${u.grade}`);
    }

    // Step 4: Update market_grades table
    console.log('\nStep 4: Updating market_grades table...');

    let updated = 0;
    let notFound = 0;

    for (const u of updates) {
      try {
        const result = await pool.query(`
          UPDATE market_grades
          SET
            hha_opportunity_score = $1,
            hha_grade = $2,
            geography_name = COALESCE(geography_name, $3),
            calculated_at = NOW()
          WHERE geography_type = 'cbsa' AND geography_id = $4
          RETURNING id
        `, [u.score, u.grade, u.cbsa_title, u.cbsa_code]);

        if (result.rowCount > 0) {
          updated++;
        } else {
          notFound++;
        }
      } catch (err) {
        console.error(`Error updating CBSA ${u.cbsa_code}: ${err.message}`);
      }
    }

    console.log(`\nUpdate complete: ${updated} CBSAs updated, ${notFound} not found in market_grades`);

    // Step 5: Show specific examples
    console.log('\n=== Sample Results ===');

    const sampleCBSAs = ['26820', '14260', '31080', '19100', '13940']; // Idaho Falls, Boise, LA, Dallas, Blackfoot

    for (const cbsa of sampleCBSAs) {
      const data = hhaCountsByCBSA.get(cbsa);
      const pop = popByCBSA.get(cbsa);
      const update = updates.find(u => u.cbsa_code === cbsa);

      if (data) {
        console.log(`\n${cbsa} - ${data.cbsa_title || 'Unknown'}:`);
        console.log(`  HHAs serving via service areas: ${data.hha_count}`);
        console.log(`  Population 65+: ${pop?.toLocaleString() || 'N/A'}`);
        console.log(`  HHAs per 10K 65+: ${update?.hhas_per_10k || 'N/A'}`);
        console.log(`  New Score: ${update?.score || 'N/A'} (${update?.grade || 'N/A'})`);
      } else {
        console.log(`\n${cbsa}: No service area data found`);
      }
    }

    // Step 6: Recalculate overall PAC scores
    console.log('\n\nStep 6: Recalculating overall PAC scores...');

    const recalcResult = await pool.query(`
      UPDATE market_grades
      SET overall_pac_score = ROUND(
        (COALESCE(snf_opportunity_score, 50) * 0.40) +
        (COALESCE(alf_opportunity_score, 50) * 0.30) +
        (COALESCE(hha_opportunity_score, 50) * 0.30)
      , 2),
      overall_pac_grade = CASE
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 95 THEN 'A+'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 90 THEN 'A'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 85 THEN 'A-'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 80 THEN 'B+'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 75 THEN 'B'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 70 THEN 'B-'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 65 THEN 'C+'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 60 THEN 'C'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 55 THEN 'C-'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 50 THEN 'D+'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 45 THEN 'D'
        WHEN (COALESCE(snf_opportunity_score, 50) * 0.40 + COALESCE(alf_opportunity_score, 50) * 0.30 + COALESCE(hha_opportunity_score, 50) * 0.30) >= 40 THEN 'D-'
        ELSE 'F'
      END
      WHERE geography_type = 'cbsa'
      RETURNING id
    `);

    console.log(`Recalculated overall PAC scores for ${recalcResult.rowCount} CBSAs`);

    console.log('\n=== Done ===');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
