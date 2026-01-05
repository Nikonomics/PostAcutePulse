/**
 * Update ALF Opportunity Scores
 *
 * Calculates ALF (Assisted Living Facility) opportunity scores for all geographies based on:
 * - Capacity gap (beds per 1K 65+ population) - primary factor
 * - Population growth (higher growth = more demand)
 * - Affluence (higher income = more private-pay potential)
 *
 * Note: ALF data quality varies by state due to inconsistent licensing.
 * Some states don't license ALFs separately from other care types.
 *
 * Methodology: Absolute thresholds (matching HHA/SNF script pattern)
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/update-alf-opportunity-scores.js [--geography=<type>]
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

/**
 * Score a single geography type
 */
async function scoreGeographyType(geoType, showRankings = true) {
  console.log(`\n--- Scoring ${geoType.toUpperCase()} ---`);

  // Fetch metrics for this geography type
  const metricsResult = await pool.query(`
    SELECT
      mm.geography_id,
      mm.geography_name,
      mm.alf_facility_count,
      mm.alf_total_capacity,
      mm.alf_beds_per_1k_65,
      mm.projected_growth_65_2030,
      mm.median_household_income,
      mm.pop_65_plus
    FROM market_metrics mm
    WHERE mm.geography_type = $1
      AND mm.alf_facility_count IS NOT NULL
      AND mm.alf_facility_count > 0
    ORDER BY mm.alf_facility_count DESC
  `, [geoType]);

  console.log(`Found ${metricsResult.rows.length} ${geoType}s with ALF data`);

  if (metricsResult.rows.length === 0) return 0;

  // Calculate opportunity scores
  const updates = [];
  for (const row of metricsResult.rows) {
    const score = calculateALFOpportunityScore(
      parseFloat(row.alf_beds_per_1k_65) || null,
      parseFloat(row.projected_growth_65_2030) || null,
      parseFloat(row.median_household_income) || null
    );
    const grade = calculateLetterGrade(score);

    updates.push({
      geography_id: row.geography_id,
      geography_name: row.geography_name,
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

  // Show rankings only for CBSAs and states (not counties)
  if (showRankings && updates.length > 0) {
    console.log(`\nTop 10 ${geoType.toUpperCase()} ALF opportunities:`);
    console.log('ID    | Name                          | ALFs | Capacity | Beds/1K | Income  | Score | Grade');
    console.log('-'.repeat(100));

    for (const u of updates.slice(0, 10)) {
      console.log(
        `${(u.geography_id || '').substring(0, 5).padEnd(5)} | ` +
        `${(u.geography_name || '').substring(0, 29).padEnd(29)} | ` +
        `${String(u.alf_count || '').padStart(4)} | ` +
        `${String(u.capacity || '').padStart(8)} | ` +
        `${String(u.beds_per_k || '').padStart(7)} | ` +
        `${String(Math.round((u.income || 0) / 1000)).padStart(4)}K | ` +
        `${String(u.score || '').padStart(5)} | ${u.grade || ''}`
      );
    }
  }

  // Ensure all records exist in market_grades
  await pool.query(`
    INSERT INTO market_grades (geography_type, geography_id, geography_name)
    SELECT $1::varchar, geography_id, geography_name
    FROM market_metrics
    WHERE geography_type = $1::varchar
      AND geography_id NOT IN (
        SELECT geography_id FROM market_grades WHERE geography_type = $1::varchar
      )
  `, [geoType]);

  // Update scores
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
          WHERE geography_type = $4 AND geography_id = $5
          RETURNING id
        `, [u.score, u.grade, u.geography_name, geoType, u.geography_id]);

        if (result.rowCount > 0) updated++;
      } catch (err) {
        console.error(`Error updating ${geoType} ${u.geography_id}: ${err.message}`);
      }
    }
  }

  console.log(`Updated ${updated} ${geoType}s with ALF opportunity scores`);

  // Show grade distribution
  const gradeDist = await pool.query(`
    SELECT alf_grade as grade, COUNT(*) as count
    FROM market_grades
    WHERE geography_type = $1 AND alf_grade IS NOT NULL
    GROUP BY alf_grade
    ORDER BY alf_grade
  `, [geoType]);

  if (gradeDist.rows.length > 0) {
    console.log(`Grade distribution for ${geoType}s:`);
    for (const row of gradeDist.rows) {
      console.log(`  ${row.grade}: ${row.count}`);
    }
  }

  return updated;
}

async function main() {
  console.log('=== ALF Opportunity Score Update ===\n');

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
      // Counties get scores but no ranking display
      const showRankings = geoType !== 'county';
      const updated = await scoreGeographyType(geoType, showRankings);
      totalUpdated += updated;
    }

    console.log('\n=== Summary ===');
    console.log(`Total records updated: ${totalUpdated}`);
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
