/**
 * HHA Market Opportunity Score Generator
 *
 * Generates HHA opportunity scores by CBSA using the PostAcutePulse methodology.
 * Outputs scores 0-100 and letter grades A-F for each market.
 *
 * Score Components:
 * - Referral Opportunity (30%): SNF discharges per HHA, throughput capture
 * - Supply Gap (25%): HHA agencies per 100K 65+ (inverse)
 * - Capacity Strain (20%): Timely initiation rate (inverse - lower = more strain)
 * - Quality Gap (10%): Average star rating (inverse) + % low quality agencies
 * - Market Dynamics (10%): Net agency change 12 months
 * - Competition (5%): HHI concentration (inverse - lower = easier entry)
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/generate-hha-market-opportunity-scores.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Component weights
const WEIGHTS = {
  referral: 0.30,
  supplyGap: 0.25,
  capacityStrain: 0.20,
  qualityGap: 0.10,
  marketDynamics: 0.10,
  competition: 0.05
};

// Default for missing data
const DEFAULT_SCORE = 50;

/**
 * Convert score to letter grade
 * Using percentile-based grading for opportunity scores:
 * - Top 10% = A
 * - Next 20% = B
 * - Middle 40% = C
 * - Next 20% = D
 * - Bottom 10% = F
 */
function getLetterGrade(score, allScores) {
  if (score === null || score === undefined) return null;

  // Calculate percentile thresholds from all scores
  const sorted = [...allScores].sort((a, b) => b - a); // Descending
  const n = sorted.length;

  const topTenPct = sorted[Math.floor(n * 0.10)] || 90;
  const topThirtyPct = sorted[Math.floor(n * 0.30)] || 70;
  const topSeventyPct = sorted[Math.floor(n * 0.70)] || 50;
  const topNinetyPct = sorted[Math.floor(n * 0.90)] || 30;

  if (score >= topTenPct) return 'A';
  if (score >= topThirtyPct) return 'B';
  if (score >= topSeventyPct) return 'C';
  if (score >= topNinetyPct) return 'D';
  return 'F';
}

/**
 * Create the output table if it doesn't exist
 */
async function ensureTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hha_market_opportunity_scores (
      id SERIAL PRIMARY KEY,
      cbsa_code VARCHAR(5) NOT NULL UNIQUE,
      cbsa_name VARCHAR(255),
      state VARCHAR(50),
      hha_agency_count INTEGER,
      pop_65_plus BIGINT,
      total_episodes INTEGER,

      -- Component scores (0-100)
      referral_opportunity_score NUMERIC(5,2),
      supply_gap_score NUMERIC(5,2),
      capacity_strain_score NUMERIC(5,2),
      quality_gap_score NUMERIC(5,2),
      market_dynamics_score NUMERIC(5,2),
      competition_score NUMERIC(5,2),

      -- Final score and grade
      hha_opportunity_score NUMERIC(5,2),
      hha_grade CHAR(1),

      -- Rankings
      state_rank INTEGER,
      national_rank INTEGER,

      -- Key reference metrics
      snf_discharges_per_agency NUMERIC(10,2),
      throughput_capture_ratio NUMERIC(6,4),
      avg_timely_initiation NUMERIC(5,2),
      avg_star_rating NUMERIC(3,2),
      pct_low_quality NUMERIC(5,2),
      hha_hhi INTEGER,
      net_change_12mo INTEGER,
      hha_per_100k_65 NUMERIC(8,2),

      -- Data quality
      data_quality_flag VARCHAR(10),

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  console.log('✓ Table hha_market_opportunity_scores exists');
}

/**
 * Calculate scores for all CBSAs
 */
async function calculateScores() {
  console.log('\n--- Calculating HHA Opportunity Scores ---\n');

  // Get all CBSA metrics
  const metricsResult = await pool.query(`
    WITH cbsa_base AS (
      SELECT
        mm.geography_id as cbsa_code,
        COALESCE(mm.geography_name, cb.cbsa_title) as cbsa_name,
        -- Extract primary state from CBSA title (e.g., "Portland-Vancouver-Hillsboro, OR-WA" -> "OR")
        NULLIF(SPLIT_PART(SPLIT_PART(cb.cbsa_title, ', ', 2), '-', 1), '') as state,
        mm.hha_agency_count,
        mm.pop_65_plus,
        mm.hha_total_episodes as total_episodes,

        -- Referral opportunity metrics
        mm.snf_discharges_per_agency,
        mm.snf_throughput_monthly,

        -- Supply gap
        mm.hha_agencies_per_100k_65 as hha_per_100k_65,

        -- Capacity strain
        mm.hha_avg_timely_initiation as avg_timely_initiation,

        -- Quality gap
        mm.hha_avg_star_rating as avg_star_rating,
        mm.hha_pct_1_2_star as pct_low_quality,

        -- Market dynamics
        mm.hha_net_change_12mo as net_change_12mo,

        -- Competition
        mm.hha_hhi

      FROM market_metrics mm
      LEFT JOIN cbsas cb ON cb.cbsa_code = mm.geography_id
      WHERE mm.geography_type = 'cbsa'
        AND mm.hha_agency_count > 0
        AND mm.pop_65_plus > 0
    ),

    -- Calculate throughput capture ratio
    metrics_with_capture AS (
      SELECT *,
        CASE
          WHEN snf_throughput_monthly > 0 AND total_episodes > 0
          THEN (total_episodes::numeric / (snf_throughput_monthly * 12))
          ELSE NULL
        END as throughput_capture_ratio
      FROM cbsa_base
    ),

    -- Calculate percentiles for each metric
    percentiles AS (
      SELECT
        cbsa_code,
        cbsa_name,
        state,
        hha_agency_count,
        pop_65_plus,
        total_episodes,
        snf_discharges_per_agency,
        throughput_capture_ratio,
        hha_per_100k_65,
        avg_timely_initiation,
        avg_star_rating,
        pct_low_quality,
        net_change_12mo,
        hha_hhi,

        -- Referral: higher discharges per agency = MORE opportunity (direct percentile)
        PERCENT_RANK() OVER (ORDER BY snf_discharges_per_agency NULLS FIRST) * 100 as discharges_pctl,
        -- Referral: lower capture = MORE opportunity (inverse percentile)
        (1 - PERCENT_RANK() OVER (ORDER BY throughput_capture_ratio NULLS LAST)) * 100 as capture_inv_pctl,

        -- Supply gap: fewer agencies per capita = MORE opportunity (inverse)
        (1 - PERCENT_RANK() OVER (ORDER BY hha_per_100k_65 NULLS LAST)) * 100 as supply_gap_pctl,

        -- Capacity strain: lower timely initiation = MORE opportunity (inverse)
        (1 - PERCENT_RANK() OVER (ORDER BY avg_timely_initiation NULLS LAST)) * 100 as timely_inv_pctl,

        -- Quality gap: lower rating = MORE opportunity (inverse)
        (1 - PERCENT_RANK() OVER (ORDER BY avg_star_rating NULLS LAST)) * 100 as rating_inv_pctl,
        -- Quality gap: higher % low quality = MORE opportunity (direct)
        PERCENT_RANK() OVER (ORDER BY pct_low_quality NULLS FIRST) * 100 as low_quality_pctl,

        -- Market dynamics: higher net change can signal growth or competition
        -- Positive = growing market, use direct percentile
        PERCENT_RANK() OVER (ORDER BY net_change_12mo NULLS FIRST) * 100 as dynamics_pctl,

        -- Competition: lower HHI = less concentrated = easier entry (inverse)
        (1 - PERCENT_RANK() OVER (ORDER BY hha_hhi NULLS LAST)) * 100 as competition_pctl

      FROM metrics_with_capture
    )

    SELECT * FROM percentiles
    ORDER BY cbsa_code
  `);

  console.log(`Found ${metricsResult.rows.length} CBSAs with HHA data`);

  if (metricsResult.rows.length === 0) {
    console.log('No CBSAs found with HHA data');
    return [];
  }

  // Calculate final scores (first pass - without grades)
  const scoredMarkets = metricsResult.rows.map(row => {
    // Component 1: Referral Opportunity (30%)
    const dischargeScore = row.discharges_pctl || DEFAULT_SCORE;
    const captureScore = row.capture_inv_pctl || DEFAULT_SCORE;
    const referralScore = (dischargeScore * 0.50) + (captureScore * 0.50);

    // Component 2: Supply Gap (25%)
    const supplyGapScore = row.supply_gap_pctl || DEFAULT_SCORE;

    // Component 3: Capacity Strain (20%)
    // Lower timely initiation (< 90%) = agencies at capacity = opportunity
    const capacityStrainScore = row.timely_inv_pctl || DEFAULT_SCORE;

    // Component 4: Quality Gap (10%)
    const ratingScore = row.rating_inv_pctl || DEFAULT_SCORE;
    const lowQualityScore = row.low_quality_pctl || DEFAULT_SCORE;
    const qualityGapScore = (ratingScore * 0.50) + (lowQualityScore * 0.50);

    // Component 5: Market Dynamics (10%)
    // Use dynamics percentile, default to 50 if missing
    const marketDynamicsScore = row.net_change_12mo !== null ? row.dynamics_pctl : DEFAULT_SCORE;

    // Component 6: Competition (5%)
    const competitionScore = row.competition_pctl || DEFAULT_SCORE;

    // Final weighted score
    const finalScore =
      (referralScore * WEIGHTS.referral) +
      (supplyGapScore * WEIGHTS.supplyGap) +
      (capacityStrainScore * WEIGHTS.capacityStrain) +
      (qualityGapScore * WEIGHTS.qualityGap) +
      (marketDynamicsScore * WEIGHTS.marketDynamics) +
      (competitionScore * WEIGHTS.competition);

    // Data quality flag
    const missingCount = [
      row.snf_discharges_per_agency,
      row.throughput_capture_ratio,
      row.avg_timely_initiation,
      row.avg_star_rating,
      row.hha_hhi
    ].filter(v => v === null).length;

    const dataQualityFlag = missingCount >= 2 ? 'low' : 'good';

    return {
      cbsa_code: row.cbsa_code,
      cbsa_name: row.cbsa_name,
      state: row.state,
      hha_agency_count: row.hha_agency_count,
      pop_65_plus: row.pop_65_plus,
      total_episodes: row.total_episodes,

      referral_opportunity_score: Math.round(referralScore * 100) / 100,
      supply_gap_score: Math.round(supplyGapScore * 100) / 100,
      capacity_strain_score: Math.round(capacityStrainScore * 100) / 100,
      quality_gap_score: Math.round(qualityGapScore * 100) / 100,
      market_dynamics_score: Math.round(marketDynamicsScore * 100) / 100,
      competition_score: Math.round(competitionScore * 100) / 100,

      hha_opportunity_score: Math.round(finalScore * 100) / 100,

      snf_discharges_per_agency: row.snf_discharges_per_agency,
      throughput_capture_ratio: row.throughput_capture_ratio,
      avg_timely_initiation: row.avg_timely_initiation,
      avg_star_rating: row.avg_star_rating,
      pct_low_quality: row.pct_low_quality,
      hha_hhi: row.hha_hhi,
      net_change_12mo: row.net_change_12mo,
      hha_per_100k_65: row.hha_per_100k_65,

      data_quality_flag: dataQualityFlag
    };
  });

  // Second pass - assign grades based on percentile distribution
  const allScores = scoredMarkets.map(m => m.hha_opportunity_score).filter(s => s !== null);
  scoredMarkets.forEach(market => {
    market.hha_grade = getLetterGrade(market.hha_opportunity_score, allScores);
  });

  // Sort by score for ranking
  scoredMarkets.sort((a, b) => (b.hha_opportunity_score || 0) - (a.hha_opportunity_score || 0));

  // Assign national rank
  scoredMarkets.forEach((market, index) => {
    market.national_rank = index + 1;
  });

  // Assign state ranks
  const stateGroups = {};
  scoredMarkets.forEach(market => {
    const state = market.state || 'Unknown';
    if (!stateGroups[state]) stateGroups[state] = [];
    stateGroups[state].push(market);
  });

  Object.values(stateGroups).forEach(markets => {
    markets.sort((a, b) => (b.hha_opportunity_score || 0) - (a.hha_opportunity_score || 0));
    markets.forEach((market, index) => {
      market.state_rank = index + 1;
    });
  });

  return scoredMarkets;
}

/**
 * Insert/update scores in the database
 */
async function saveScores(scores) {
  console.log(`\nSaving ${scores.length} market scores...`);

  // Clear existing data
  await pool.query('TRUNCATE TABLE hha_market_opportunity_scores');

  // Insert new scores
  let inserted = 0;
  for (const s of scores) {
    try {
      await pool.query(`
        INSERT INTO hha_market_opportunity_scores (
          cbsa_code, cbsa_name, state, hha_agency_count, pop_65_plus, total_episodes,
          referral_opportunity_score, supply_gap_score, capacity_strain_score,
          quality_gap_score, market_dynamics_score, competition_score,
          hha_opportunity_score, hha_grade, state_rank, national_rank,
          snf_discharges_per_agency, throughput_capture_ratio, avg_timely_initiation,
          avg_star_rating, pct_low_quality, hha_hhi, net_change_12mo, hha_per_100k_65,
          data_quality_flag
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      `, [
        s.cbsa_code, s.cbsa_name, s.state, s.hha_agency_count, s.pop_65_plus, s.total_episodes,
        s.referral_opportunity_score, s.supply_gap_score, s.capacity_strain_score,
        s.quality_gap_score, s.market_dynamics_score, s.competition_score,
        s.hha_opportunity_score, s.hha_grade, s.state_rank, s.national_rank,
        s.snf_discharges_per_agency, s.throughput_capture_ratio, s.avg_timely_initiation,
        s.avg_star_rating, s.pct_low_quality, s.hha_hhi, s.net_change_12mo, s.hha_per_100k_65,
        s.data_quality_flag
      ]);
      inserted++;
    } catch (err) {
      console.error(`Error inserting ${s.cbsa_code}: ${err.message}`);
    }
  }

  console.log(`✓ Inserted ${inserted} market scores`);
  return inserted;
}

/**
 * Display results summary
 */
async function displayResults(scores) {
  console.log('\n' + '='.repeat(100));
  console.log('TOP 20 HHA MARKET OPPORTUNITIES');
  console.log('='.repeat(100));

  console.log('Rank | CBSA  | Name                          | State | HHAs | Pop65+ | Score | Grade | Components (Ref/Sup/Cap/Qua/Dyn/Comp)');
  console.log('-'.repeat(120));

  for (const m of scores.slice(0, 20)) {
    const components = `${m.referral_opportunity_score.toFixed(0)}/${m.supply_gap_score.toFixed(0)}/${m.capacity_strain_score.toFixed(0)}/${m.quality_gap_score.toFixed(0)}/${m.market_dynamics_score.toFixed(0)}/${m.competition_score.toFixed(0)}`;
    console.log(
      `${String(m.national_rank).padStart(4)} | ` +
      `${(m.cbsa_code || '').padEnd(5)} | ` +
      `${(m.cbsa_name || '').substring(0, 29).padEnd(29)} | ` +
      `${(m.state || '').substring(0, 2).padEnd(5)} | ` +
      `${String(m.hha_agency_count || '').padStart(4)} | ` +
      `${String(m.pop_65_plus || '').padStart(6)} | ` +
      `${String(m.hha_opportunity_score).padStart(5)} | ` +
      `${(m.hha_grade || '').padEnd(5)} | ` +
      `${components}`
    );
  }

  // Grade distribution
  const gradeDist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach(s => {
    if (s.hha_grade) gradeDist[s.hha_grade]++;
  });

  const total = scores.length;
  console.log('\n--- Grade Distribution ---');
  console.log(`A: ${gradeDist.A} (${(gradeDist.A/total*100).toFixed(1)}%)`);
  console.log(`B: ${gradeDist.B} (${(gradeDist.B/total*100).toFixed(1)}%)`);
  console.log(`C: ${gradeDist.C} (${(gradeDist.C/total*100).toFixed(1)}%)`);
  console.log(`D: ${gradeDist.D} (${(gradeDist.D/total*100).toFixed(1)}%)`);
  console.log(`F: ${gradeDist.F} (${(gradeDist.F/total*100).toFixed(1)}%)`);

  // Score statistics
  const scoreStats = scores.map(s => s.hha_opportunity_score).filter(s => s !== null);
  const avg = scoreStats.reduce((a, b) => a + b, 0) / scoreStats.length;
  const min = Math.min(...scoreStats);
  const max = Math.max(...scoreStats);

  console.log('\n--- Score Statistics ---');
  console.log(`Total markets: ${scores.length}`);
  console.log(`Average score: ${avg.toFixed(2)}`);
  console.log(`Min score: ${min.toFixed(2)}`);
  console.log(`Max score: ${max.toFixed(2)}`);

  // Data quality
  const goodQuality = scores.filter(s => s.data_quality_flag === 'good').length;
  console.log(`\nData quality: ${goodQuality} good (${(goodQuality/total*100).toFixed(1)}%), ${total - goodQuality} low`);
}

/**
 * Validate results
 */
async function validateResults() {
  console.log('\n--- Validation Checks ---');

  // Check for NULL scores
  const nullCheck = await pool.query(`
    SELECT COUNT(*) as null_count
    FROM hha_market_opportunity_scores
    WHERE hha_opportunity_score IS NULL
  `);
  console.log(`NULL scores: ${nullCheck.rows[0].null_count}`);

  // Check score distribution
  const distCheck = await pool.query(`
    SELECT
      MIN(hha_opportunity_score) as min_score,
      MAX(hha_opportunity_score) as max_score,
      AVG(hha_opportunity_score) as avg_score,
      STDDEV(hha_opportunity_score) as std_score
    FROM hha_market_opportunity_scores
  `);
  const dist = distCheck.rows[0];
  console.log(`Score range: ${parseFloat(dist.min_score)?.toFixed(2)} - ${parseFloat(dist.max_score)?.toFixed(2)}`);
  console.log(`Avg: ${parseFloat(dist.avg_score)?.toFixed(2)}, StdDev: ${parseFloat(dist.std_score)?.toFixed(2)}`);

  // Spot check known markets
  const spotCheck = await pool.query(`
    SELECT cbsa_code, cbsa_name, hha_opportunity_score, hha_grade, national_rank
    FROM hha_market_opportunity_scores
    WHERE cbsa_code IN ('14260', '38900', '31080', '35620', '19100')
    ORDER BY national_rank
  `);

  console.log('\n--- Spot Check Known Markets ---');
  for (const m of spotCheck.rows) {
    console.log(`${m.cbsa_code} ${m.cbsa_name}: Score ${m.hha_opportunity_score}, Grade ${m.hha_grade}, Rank #${m.national_rank}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    HHA Market Opportunity Score Generator                  ║');
  console.log('║    PostAcutePulse Methodology                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Component Weights:');
  console.log(`  Referral Opportunity: ${WEIGHTS.referral * 100}%`);
  console.log(`  Supply Gap: ${WEIGHTS.supplyGap * 100}%`);
  console.log(`  Capacity Strain: ${WEIGHTS.capacityStrain * 100}%`);
  console.log(`  Quality Gap: ${WEIGHTS.qualityGap * 100}%`);
  console.log(`  Market Dynamics: ${WEIGHTS.marketDynamics * 100}%`);
  console.log(`  Competition: ${WEIGHTS.competition * 100}%`);

  try {
    // Step 1: Ensure table exists
    await ensureTableExists();

    // Step 2: Calculate scores
    const scores = await calculateScores();

    if (scores.length === 0) {
      console.log('No scores calculated. Check data availability.');
      return;
    }

    // Step 3: Save to database
    await saveScores(scores);

    // Step 4: Display results
    await displayResults(scores);

    // Step 5: Validate
    await validateResults();

    console.log('\n=== Done ===');
    console.log('Query: SELECT * FROM hha_market_opportunity_scores ORDER BY national_rank LIMIT 50;');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
