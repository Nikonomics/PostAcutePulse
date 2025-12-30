/**
 * Calculate Overall PAC (Post-Acute Care) Scores
 *
 * Combines SNF, ALF, and HHA opportunity scores into a single overall
 * PAC opportunity score for each CBSA.
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
 * Usage: MARKET_DATABASE_URL=<url> node scripts/calculate-overall-pac-scores.js
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

async function main() {
  console.log('=== Overall PAC Score Calculation ===\n');
  console.log(`Weights: SNF ${WEIGHTS.snf * 100}%, ALF ${WEIGHTS.alf * 100}%, HHA ${WEIGHTS.hha * 100}%`);
  console.log(`Default score for missing segments: ${DEFAULT_SCORE}\n`);

  try {
    // Step 1: Check current state
    console.log('Step 1: Checking current scoring state...');

    const stateCheck = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(snf_opportunity_score) as with_snf,
        COUNT(alf_opportunity_score) as with_alf,
        COUNT(hha_opportunity_score) as with_hha,
        COUNT(CASE WHEN snf_opportunity_score IS NOT NULL
                    AND alf_opportunity_score IS NOT NULL
                    AND hha_opportunity_score IS NOT NULL THEN 1 END) as with_all_three
      FROM market_grades
      WHERE geography_type = 'cbsa'
    `);

    const state = stateCheck.rows[0];
    console.log(`Total CBSAs: ${state.total}`);
    console.log(`  With SNF score: ${state.with_snf}`);
    console.log(`  With ALF score: ${state.with_alf}`);
    console.log(`  With HHA score: ${state.with_hha}`);
    console.log(`  With all three: ${state.with_all_three}`);

    // Step 2: Calculate overall PAC scores
    console.log('\nStep 2: Calculating overall PAC scores...');

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
      WHERE geography_type = 'cbsa'
      RETURNING id
    `);

    console.log(`Updated ${updateResult.rowCount} CBSAs with overall PAC scores`);

    // Step 3: Show top and bottom markets
    console.log('\nStep 3: Top and bottom markets...');

    const topMarkets = await pool.query(`
      SELECT
        geography_id as cbsa,
        geography_name as market,
        snf_opportunity_score as snf,
        alf_opportunity_score as alf,
        hha_opportunity_score as hha,
        overall_pac_score as overall,
        overall_pac_grade as grade
      FROM market_grades
      WHERE geography_type = 'cbsa'
      ORDER BY overall_pac_score DESC NULLS LAST
      LIMIT 15
    `);

    console.log('\nTop 15 Overall PAC Opportunities:');
    console.log('CBSA  | Market Name                   |  SNF  |  ALF  |  HHA  | Overall | Grade');
    console.log('-'.repeat(95));

    for (const m of topMarkets.rows) {
      console.log(
        `${(m.cbsa || '').padEnd(5)} | ` +
        `${(m.market || '').substring(0, 29).padEnd(29)} | ` +
        `${String(m.snf || '-').padStart(5)} | ` +
        `${String(m.alf || '-').padStart(5)} | ` +
        `${String(m.hha || '-').padStart(5)} | ` +
        `${String(m.overall || '').padStart(7)} | ${m.grade || ''}`
      );
    }

    const bottomMarkets = await pool.query(`
      SELECT
        geography_id as cbsa,
        geography_name as market,
        snf_opportunity_score as snf,
        alf_opportunity_score as alf,
        hha_opportunity_score as hha,
        overall_pac_score as overall,
        overall_pac_grade as grade
      FROM market_grades
      WHERE geography_type = 'cbsa'
      ORDER BY overall_pac_score ASC NULLS LAST
      LIMIT 15
    `);

    console.log('\nBottom 15 Overall PAC Opportunities (Most Competitive):');
    console.log('CBSA  | Market Name                   |  SNF  |  ALF  |  HHA  | Overall | Grade');
    console.log('-'.repeat(95));

    for (const m of bottomMarkets.rows) {
      console.log(
        `${(m.cbsa || '').padEnd(5)} | ` +
        `${(m.market || '').substring(0, 29).padEnd(29)} | ` +
        `${String(m.snf || '-').padStart(5)} | ` +
        `${String(m.alf || '-').padStart(5)} | ` +
        `${String(m.hha || '-').padStart(5)} | ` +
        `${String(m.overall || '').padStart(7)} | ${m.grade || ''}`
      );
    }

    // Step 4: Grade distribution
    console.log('\n=== Overall PAC Grade Distribution ===');

    const gradeDist = await pool.query(`
      SELECT overall_pac_grade as grade, COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
      FROM market_grades
      WHERE geography_type = 'cbsa' AND overall_pac_grade IS NOT NULL
      GROUP BY overall_pac_grade
      ORDER BY overall_pac_grade
    `);

    for (const row of gradeDist.rows) {
      console.log(`  ${row.grade.padEnd(2)}: ${String(row.count).padStart(4)} CBSAs (${row.pct}%)`);
    }

    // Step 5: Score statistics
    console.log('\n=== Score Statistics ===');

    const stats = await pool.query(`
      SELECT
        ROUND(AVG(overall_pac_score)::numeric, 2) as avg_score,
        ROUND(STDDEV(overall_pac_score)::numeric, 2) as std_dev,
        MIN(overall_pac_score) as min_score,
        MAX(overall_pac_score) as max_score,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY overall_pac_score) as median
      FROM market_grades
      WHERE geography_type = 'cbsa' AND overall_pac_score IS NOT NULL
    `);

    const s = stats.rows[0];
    console.log(`  Average: ${s.avg_score}`);
    console.log(`  Std Dev: ${s.std_dev}`);
    console.log(`  Min: ${s.min_score}`);
    console.log(`  Max: ${s.max_score}`);
    console.log(`  Median: ${Math.round(s.median * 100) / 100}`);

    console.log('\n=== Done ===');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
