/**
 * Update ALF Opportunity Scores
 *
 * Calculates ALF (Assisted Living Facility) opportunity scores for all CBSAs based on:
 * - Capacity gap (beds per 1K 65+ population) - primary factor
 * - Population growth (higher growth = more demand)
 * - Affluence (higher income = more private-pay potential)
 *
 * Note: ALF data quality varies by state due to inconsistent licensing.
 * Some states don't license ALFs separately from other care types.
 *
 * Methodology: Absolute thresholds (matching HHA/SNF script pattern)
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/update-alf-opportunity-scores.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Calculate ALF opportunity score based on market characteristics
 *
 * Factors:
 * - Low beds per 1K 65+ = underserved market = opportunity (50% weight)
 * - High population growth = increasing demand = opportunity (30% weight)
 * - High median income = private-pay potential = opportunity (20% weight)
 */
function calculateALFOpportunityScore(bedsPerK, growthRate, medianIncome) {
  let score = 0;
  let weights = 0;

  // Factor 1: Capacity gap (beds per 1K 65+) - 50% weight
  // ALF capacity varies widely; national average roughly 15-25 beds per 1K 65+
  if (bedsPerK !== null) {
    let capacityScore;
    if (bedsPerK <= 5) {
      capacityScore = 95 + (5 - bedsPerK); // Severely underserved
    } else if (bedsPerK <= 15) {
      capacityScore = 75 + (15 - bedsPerK) * 2; // Underserved
    } else if (bedsPerK <= 25) {
      capacityScore = 55 + (25 - bedsPerK) * 2; // Moderate
    } else if (bedsPerK <= 40) {
      capacityScore = 35 + (40 - bedsPerK) * 1.33; // Well-served
    } else {
      capacityScore = Math.max(0, 35 - (bedsPerK - 40) * 0.5); // Oversupplied
    }
    score += capacityScore * 0.5;
    weights += 0.5;
  }

  // Factor 2: Population growth (30% weight)
  // Higher growth = more future demand
  if (growthRate !== null) {
    let growthScore;
    if (growthRate >= 30) {
      growthScore = 95 + Math.min(5, (growthRate - 30) * 0.25);
    } else if (growthRate >= 20) {
      growthScore = 80 + (growthRate - 20) * 1.5;
    } else if (growthRate >= 10) {
      growthScore = 60 + (growthRate - 10) * 2;
    } else if (growthRate >= 0) {
      growthScore = 40 + growthRate * 2;
    } else {
      growthScore = Math.max(0, 40 + growthRate * 2);
    }
    score += growthScore * 0.3;
    weights += 0.3;
  }

  // Factor 3: Affluence / Private-pay potential (20% weight)
  // ALF is primarily private-pay, so higher income = better market
  // National median household income ~$75K
  if (medianIncome !== null) {
    let incomeScore;
    if (medianIncome >= 120000) {
      incomeScore = 95 + Math.min(5, (medianIncome - 120000) / 10000);
    } else if (medianIncome >= 90000) {
      incomeScore = 75 + (medianIncome - 90000) / 1500;
    } else if (medianIncome >= 70000) {
      incomeScore = 55 + (medianIncome - 70000) / 1000;
    } else if (medianIncome >= 50000) {
      incomeScore = 35 + (medianIncome - 50000) / 1000;
    } else {
      incomeScore = Math.max(0, 35 - (50000 - medianIncome) / 2000);
    }
    score += incomeScore * 0.2;
    weights += 0.2;
  }

  if (weights === 0) return null;

  // Normalize to 0-100
  const normalizedScore = score / weights;

  return Math.round(Math.max(0, Math.min(100, normalizedScore)) * 100) / 100;
}

/**
 * Convert score to letter grade (matching HHA script)
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
  console.log('=== ALF Opportunity Score Update ===\n');

  try {
    // Step 1: Get ALF metrics per CBSA
    console.log('Step 1: Fetching ALF metrics per CBSA...');

    const metricsResult = await pool.query(`
      SELECT
        mm.geography_id as cbsa_code,
        c.cbsa_title,
        mm.alf_facility_count,
        mm.alf_total_capacity,
        mm.alf_beds_per_1k_65,
        mm.projected_growth_65_2030,
        mm.median_household_income,
        mm.pop_65_plus
      FROM market_metrics mm
      LEFT JOIN cbsas c ON c.cbsa_code = mm.geography_id
      WHERE mm.geography_type = 'cbsa'
        AND mm.alf_facility_count IS NOT NULL
      ORDER BY mm.alf_facility_count DESC
    `);

    console.log(`Found ${metricsResult.rows.length} CBSAs with ALF data`);

    // Step 2: Calculate opportunity scores
    console.log('\nStep 2: Calculating opportunity scores...');

    const updates = [];
    for (const row of metricsResult.rows) {
      const score = calculateALFOpportunityScore(
        parseFloat(row.alf_beds_per_1k_65) || null,
        parseFloat(row.projected_growth_65_2030) || null,
        parseFloat(row.median_household_income) || null
      );
      const grade = calculateLetterGrade(score);

      updates.push({
        cbsa_code: row.cbsa_code,
        cbsa_title: row.cbsa_title,
        alf_count: row.alf_facility_count,
        capacity: row.alf_total_capacity,
        beds_per_k: row.alf_beds_per_1k_65,
        growth: row.projected_growth_65_2030,
        income: row.median_household_income,
        score: score,
        grade: grade
      });
    }

    // Sort by score descending
    updates.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`\nTop 15 ALF opportunities (highest scores):`);
    console.log('CBSA  | Market Name                   | ALFs | Capacity | Beds/1K | Growth | Income  | Score | Grade');
    console.log('-'.repeat(110));

    for (const u of updates.slice(0, 15)) {
      console.log(
        `${(u.cbsa_code || '').padEnd(5)} | ` +
        `${(u.cbsa_title || '').substring(0, 29).padEnd(29)} | ` +
        `${String(u.alf_count || '').padStart(4)} | ` +
        `${String(u.capacity || '').padStart(8)} | ` +
        `${String(u.beds_per_k || '').padStart(7)} | ` +
        `${String(u.growth || '').padStart(6)} | ` +
        `${String(Math.round(u.income / 1000) || '').padStart(4)}K | ` +
        `${String(u.score || '').padStart(5)} | ${u.grade || ''}`
      );
    }

    console.log(`\nBottom 15 ALF opportunities (most competitive):`);
    console.log('CBSA  | Market Name                   | ALFs | Capacity | Beds/1K | Growth | Income  | Score | Grade');
    console.log('-'.repeat(110));

    for (const u of updates.slice(-15).reverse()) {
      console.log(
        `${(u.cbsa_code || '').padEnd(5)} | ` +
        `${(u.cbsa_title || '').substring(0, 29).padEnd(29)} | ` +
        `${String(u.alf_count || '').padStart(4)} | ` +
        `${String(u.capacity || '').padStart(8)} | ` +
        `${String(u.beds_per_k || '').padStart(7)} | ` +
        `${String(u.growth || '').padStart(6)} | ` +
        `${String(Math.round(u.income / 1000) || '').padStart(4)}K | ` +
        `${String(u.score || '').padStart(5)} | ${u.grade || ''}`
      );
    }

    // Step 3: Update market_grades table
    console.log('\n\nStep 3: Updating market_grades table...');

    // First ensure all CBSAs exist in market_grades
    await pool.query(`
      INSERT INTO market_grades (geography_type, geography_id)
      SELECT 'cbsa', geography_id
      FROM market_metrics
      WHERE geography_type = 'cbsa'
        AND geography_id NOT IN (
          SELECT geography_id FROM market_grades WHERE geography_type = 'cbsa'
        )
    `);

    let updated = 0;
    for (const u of updates) {
      if (u.score !== null) {
        try {
          const result = await pool.query(`
            UPDATE market_grades
            SET
              alf_opportunity_score = $1,
              alf_grade = $2,
              geography_name = COALESCE(geography_name, $3),
              calculated_at = NOW()
            WHERE geography_type = 'cbsa' AND geography_id = $4
            RETURNING id
          `, [u.score, u.grade, u.cbsa_title, u.cbsa_code]);

          if (result.rowCount > 0) updated++;
        } catch (err) {
          console.error(`Error updating CBSA ${u.cbsa_code}: ${err.message}`);
        }
      }
    }

    console.log(`Updated ${updated} CBSAs with ALF opportunity scores`);

    // Step 4: Grade distribution
    console.log('\n=== Grade Distribution ===');

    const gradeDist = await pool.query(`
      SELECT alf_grade as grade, COUNT(*) as count
      FROM market_grades
      WHERE geography_type = 'cbsa' AND alf_grade IS NOT NULL
      GROUP BY alf_grade
      ORDER BY alf_grade
    `);

    for (const row of gradeDist.rows) {
      console.log(`  ${row.grade}: ${row.count} CBSAs`);
    }

    console.log('\n=== Done ===');
    console.log('Next step: Run update-hha-opportunity-scores.js');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
