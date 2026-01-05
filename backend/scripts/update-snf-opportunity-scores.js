/**
 * Update SNF Opportunity Scores
 *
 * Calculates SNF opportunity scores for all geographies (CBSA, state, county) based on:
 * - Capacity gap (beds per 1K 65+ population)
 * - Occupancy opportunity (lower occupancy = room for growth)
 * - Quality gap (lower ratings = improvement opportunity)
 * - Population growth (higher growth = more demand)
 *
 * Methodology: Absolute thresholds (matching HHA script pattern)
 * Lower competition / more growth = higher opportunity score
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/update-snf-opportunity-scores.js [--geography=<type>]
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
 * Calculate SNF opportunity score based on market characteristics
 *
 * Factors (all contribute to opportunity):
 * - Low beds per 1K 65+ = underserved market = opportunity
 * - Low occupancy = room for growth = opportunity
 * - Low quality ratings = improvement opportunity
 * - High population growth = increasing demand = opportunity
 */
function calculateSNFOpportunityScore(bedsPerK, occupancy, avgRating, growthRate) {
  let score = 0;
  let factors = 0;

  // Factor 1: Capacity gap (beds per 1K 65+)
  // National average is roughly 25-35 beds per 1K 65+
  if (bedsPerK !== null) {
    factors++;
    if (bedsPerK <= 15) {
      score += 95 + (15 - bedsPerK) * 0.33; // Severely underserved
    } else if (bedsPerK <= 25) {
      score += 75 + (25 - bedsPerK) * 2; // Underserved
    } else if (bedsPerK <= 35) {
      score += 55 + (35 - bedsPerK) * 2; // Moderate
    } else if (bedsPerK <= 50) {
      score += 35 + (50 - bedsPerK) * 1.33; // Well-served
    } else {
      score += Math.max(0, 35 - (bedsPerK - 50) * 0.5); // Oversupplied
    }
  }

  // Factor 2: Occupancy opportunity (weight: 20%)
  // Lower occupancy = struggling facilities = acquisition opportunity
  if (occupancy !== null) {
    factors++;
    if (occupancy <= 60) {
      score += 90 + (60 - occupancy) * 0.25; // Distressed
    } else if (occupancy <= 75) {
      score += 70 + (75 - occupancy) * 1.33; // Opportunity
    } else if (occupancy <= 85) {
      score += 50 + (85 - occupancy) * 2; // Moderate
    } else if (occupancy <= 95) {
      score += 30 + (95 - occupancy) * 2; // Healthy
    } else {
      score += 30; // Full
    }
  }

  // Factor 3: Quality gap (weight: 20%)
  // Lower quality = improvement opportunity for operators
  if (avgRating !== null) {
    factors++;
    if (avgRating <= 2) {
      score += 90 + (2 - avgRating) * 5; // Poor quality = big opportunity
    } else if (avgRating <= 3) {
      score += 70 + (3 - avgRating) * 20; // Below average
    } else if (avgRating <= 4) {
      score += 50 + (4 - avgRating) * 20; // Average
    } else {
      score += 30 + (5 - avgRating) * 20; // Good quality
    }
  }

  // Factor 4: Population growth (weight: 30%)
  // Higher growth = more future demand
  if (growthRate !== null) {
    factors++;
    if (growthRate >= 30) {
      score += 95 + Math.min(5, (growthRate - 30) * 0.25);
    } else if (growthRate >= 20) {
      score += 80 + (growthRate - 20) * 1.5;
    } else if (growthRate >= 10) {
      score += 60 + (growthRate - 10) * 2;
    } else if (growthRate >= 0) {
      score += 40 + growthRate * 2;
    } else {
      score += Math.max(0, 40 + growthRate * 2); // Declining population
    }
  }

  if (factors === 0) return null;

  // Weight the factors: capacity 30%, occupancy 20%, quality 20%, growth 30%
  // Since we're summing 4 factors, divide by 4 to normalize to 0-100
  const avgScore = score / factors;

  return Math.round(Math.max(0, Math.min(100, avgScore)) * 100) / 100;
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
      mm.snf_facility_count,
      mm.snf_total_beds,
      mm.snf_beds_per_1k_65,
      mm.snf_avg_occupancy,
      mm.snf_avg_overall_rating,
      mm.projected_growth_65_2030,
      mm.pop_65_plus
    FROM market_metrics mm
    WHERE mm.geography_type = $1
      AND mm.snf_facility_count IS NOT NULL
      AND mm.snf_facility_count > 0
    ORDER BY mm.snf_facility_count DESC
  `, [geoType]);

  console.log(`Found ${metricsResult.rows.length} ${geoType}s with SNF data`);

  if (metricsResult.rows.length === 0) return 0;

  // Calculate opportunity scores
  const updates = [];
  for (const row of metricsResult.rows) {
    const score = calculateSNFOpportunityScore(
      parseFloat(row.snf_beds_per_1k_65) || null,
      parseFloat(row.snf_avg_occupancy) || null,
      parseFloat(row.snf_avg_overall_rating) || null,
      parseFloat(row.projected_growth_65_2030) || null
    );
    const grade = calculateLetterGrade(score);

    updates.push({
      geography_id: row.geography_id,
      geography_name: row.geography_name,
      snf_count: row.snf_facility_count,
      beds_per_k: row.snf_beds_per_1k_65,
      occupancy: row.snf_avg_occupancy,
      rating: row.snf_avg_overall_rating,
      growth: row.projected_growth_65_2030,
      score: score,
      grade: grade
    });
  }

  // Sort by score descending
  updates.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Show rankings only for CBSAs and states (not counties)
  if (showRankings && updates.length > 0) {
    console.log(`\nTop 10 ${geoType.toUpperCase()} SNF opportunities:`);
    console.log('ID    | Name                          | SNFs | Beds/1K | Occ% | Rating | Score | Grade');
    console.log('-'.repeat(95));

    for (const u of updates.slice(0, 10)) {
      console.log(
        `${(u.geography_id || '').substring(0, 5).padEnd(5)} | ` +
        `${(u.geography_name || '').substring(0, 29).padEnd(29)} | ` +
        `${String(u.snf_count || '').padStart(4)} | ` +
        `${String(u.beds_per_k || '').padStart(7)} | ` +
        `${String(u.occupancy || '').padStart(4)} | ` +
        `${String(u.rating || '').padStart(6)} | ` +
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
            snf_opportunity_score = $1,
            snf_grade = $2,
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

  console.log(`Updated ${updated} ${geoType}s with SNF opportunity scores`);

  // Show grade distribution
  const gradeDist = await pool.query(`
    SELECT snf_grade as grade, COUNT(*) as count
    FROM market_grades
    WHERE geography_type = $1 AND snf_grade IS NOT NULL
    GROUP BY snf_grade
    ORDER BY snf_grade
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
  console.log('=== SNF Opportunity Score Update ===\n');

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
    console.log('Next step: Run update-alf-opportunity-scores.js');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
