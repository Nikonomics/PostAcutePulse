/**
 * Calculate Overall PAC (Post-Acute Care) Scores
 *
 * Combines SNF, ALF, and HHA opportunity scores into a single overall
 * PAC opportunity score for each geography (CBSA, state, county).
 *
 * Weights:
 * - SNF: 40% (largest revenue potential, most regulated)
 * - ALF: 30% (growing segment, private-pay dominant)
 * - HHA: 30% (fastest growing, home-based care trend)
 *
 * Missing scores default to 50 (neutral).
 *
 * Prerequisites: Run all individual scoring scripts first:
 * 1. update-snf-opportunity-scores.js
 * 2. update-alf-opportunity-scores.js
 * 3. update-hha-opportunity-scores.js
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/calculate-overall-pac-scores.js [--geography=<type>]
 *
 * Options:
 *   --geography=cbsa   Score CBSAs only
 *   --geography=state  Score states only
 *   --geography=county Score counties only (no ranking display)
 *   --geography=all    Score all geography types (default)
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Weights for each segment
const WEIGHTS = {
  snf: 0.40,
  alf: 0.30,
  hha: 0.30
};

// Default score for missing segments
const DEFAULT_SCORE = 50;

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
 * Score a single geography type
 */
async function scoreGeographyType(geoType, showRankings = true) {
  console.log(`\n--- Calculating ${geoType.toUpperCase()} PAC scores ---`);

  // Check current state
  const stateCheck = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(snf_opportunity_score) as with_snf,
      COUNT(alf_opportunity_score) as with_alf,
      COUNT(hha_opportunity_score) as with_hha
    FROM market_grades
    WHERE geography_type = $1
  `, [geoType]);

  const state = stateCheck.rows[0];
  console.log(`Total: ${state.total}, SNF: ${state.with_snf}, ALF: ${state.with_alf}, HHA: ${state.with_hha}`);

  // Calculate overall PAC scores
  const updateResult = await pool.query(`
    UPDATE market_grades
    SET
      overall_pac_score = ROUND(
        (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf}) +
        (COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf}) +
        (COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha})
      , 2),
      overall_pac_grade = CASE
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 95 THEN 'A+'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 90 THEN 'A'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 85 THEN 'A-'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 80 THEN 'B+'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 75 THEN 'B'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 70 THEN 'B-'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 65 THEN 'C+'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 60 THEN 'C'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 55 THEN 'C-'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 50 THEN 'D+'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 45 THEN 'D'
        WHEN (COALESCE(snf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.snf} +
              COALESCE(alf_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.alf} +
              COALESCE(hha_opportunity_score, ${DEFAULT_SCORE}) * ${WEIGHTS.hha}) >= 40 THEN 'D-'
        ELSE 'F'
      END,
      calculated_at = NOW()
    WHERE geography_type = $1
    RETURNING id
  `, [geoType]);

  console.log(`Updated ${updateResult.rowCount} ${geoType}s with overall PAC scores`);

  // Show rankings only for CBSAs and states
  if (showRankings) {
    const topMarkets = await pool.query(`
      SELECT
        geography_id as id,
        geography_name as name,
        snf_opportunity_score as snf,
        alf_opportunity_score as alf,
        hha_opportunity_score as hha,
        overall_pac_score as overall,
        overall_pac_grade as grade
      FROM market_grades
      WHERE geography_type = $1
      ORDER BY overall_pac_score DESC NULLS LAST
      LIMIT 10
    `, [geoType]);

    console.log(`\nTop 10 ${geoType.toUpperCase()} Overall PAC Opportunities:`);
    console.log('ID    | Name                          |  SNF  |  ALF  |  HHA  | Overall | Grade');
    console.log('-'.repeat(90));

    for (const m of topMarkets.rows) {
      console.log(
        `${(m.id || '').substring(0, 5).padEnd(5)} | ` +
        `${(m.name || '').substring(0, 29).padEnd(29)} | ` +
        `${String(m.snf || '-').padStart(5)} | ` +
        `${String(m.alf || '-').padStart(5)} | ` +
        `${String(m.hha || '-').padStart(5)} | ` +
        `${String(m.overall || '').padStart(7)} | ${m.grade || ''}`
      );
    }

    // Grade distribution
    const gradeDist = await pool.query(`
      SELECT overall_pac_grade as grade, COUNT(*) as count
      FROM market_grades
      WHERE geography_type = $1 AND overall_pac_grade IS NOT NULL
      GROUP BY overall_pac_grade
      ORDER BY overall_pac_grade
    `, [geoType]);

    console.log(`\nGrade distribution for ${geoType}s:`);
    for (const row of gradeDist.rows) {
      console.log(`  ${row.grade}: ${row.count}`);
    }
  }

  return updateResult.rowCount;
}

async function main() {
  console.log('=== Overall PAC Score Calculation ===\n');
  console.log(`Weights: SNF ${WEIGHTS.snf * 100}%, ALF ${WEIGHTS.alf * 100}%, HHA ${WEIGHTS.hha * 100}%`);
  console.log(`Default score for missing segments: ${DEFAULT_SCORE}`);

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

  console.log(`\nScoring geography types: ${geoTypes.join(', ')}`);

  try {
    let totalUpdated = 0;

    for (const geoType of geoTypes) {
      // Counties get scores but no ranking display
      const showRankings = geoType !== 'county';
      const updated = await scoreGeographyType(geoType, showRankings);
      totalUpdated += updated;
    }

    console.log('\n=== Summary ===');
    console.log(`Total records updated: ${totalUpdated}`);
    console.log('\n=== Done ===');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
