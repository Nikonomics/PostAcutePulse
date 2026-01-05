/**
 * Hospice Market Scoring Service
 *
 * Calculates comprehensive opportunity scores for hospice market entry.
 * Uses state-calibrated long-term bed calculations and multi-factor scoring.
 *
 * Scoring Components:
 * - Demand Score (30%): Population 85+, growth, SNF/ALF bed density
 * - Competition Score (25%): Hospice density, market concentration, for-profit %
 * - Quality Gap Score (15%): Avg star rating gaps, quality distribution
 * - Pennant Fit Score (30%): Existing ALF/HHA/Ensign presence
 */

const { getMarketPool } = require('../config/database');

// Cache for expensive calculations (10 minute TTL)
const cache = {
  data: {},
  ttl: 10 * 60 * 1000, // 10 minutes
  get(key) {
    const item = this.data[key];
    if (!item) return null;
    if (Date.now() > item.expires) {
      delete this.data[key];
      return null;
    }
    return item.value;
  },
  set(key, value) {
    this.data[key] = { value, expires: Date.now() + this.ttl };
  },
  clear() {
    this.data = {};
  }
};

/**
 * Calculate state-level long-term percentages based on LS/SS QM ratios
 * Formula: long_term_pct = 0.40 + (ls_ss_ratio / (ls_ss_ratio + 1)) * 0.35
 * This maps ratio 1.0→57%, 1.5→64%, 2.0→70%
 * @returns {Promise<Object>} { state: { ls_ss_ratio, long_term_pct, facility_count } }
 */
async function calculateStateLongTermPercentages() {
  const cacheKey = 'state_lt_percentages';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const pool = getMarketPool();

  const result = await pool.query(`
    SELECT
      state,
      COUNT(*) as facility_count,
      ROUND(AVG(long_stay_qm_rating)::numeric, 2) as avg_ls_rating,
      ROUND(AVG(short_stay_qm_rating)::numeric, 2) as avg_ss_rating,
      ROUND(AVG(long_stay_qm_rating::numeric / NULLIF(short_stay_qm_rating::numeric, 0)), 3) as ls_ss_ratio,
      SUM(certified_beds) as total_beds,
      SUM(occupied_beds) as total_occupied
    FROM snf_facilities
    WHERE long_stay_qm_rating IS NOT NULL
      AND short_stay_qm_rating IS NOT NULL
      AND short_stay_qm_rating > 0
    GROUP BY state
    ORDER BY state
  `);

  const stateLookup = {};
  for (const row of result.rows) {
    const ratio = parseFloat(row.ls_ss_ratio) || 1.46; // National avg fallback
    // Formula: long_term_pct = 0.40 + (ratio / (ratio + 1)) * 0.35
    const longTermPct = 0.40 + (ratio / (ratio + 1)) * 0.35;

    stateLookup[row.state] = {
      ls_ss_ratio: ratio,
      long_term_pct: Math.round(longTermPct * 1000) / 1000, // 3 decimal places
      facility_count: parseInt(row.facility_count),
      avg_ls_rating: parseFloat(row.avg_ls_rating),
      avg_ss_rating: parseFloat(row.avg_ss_rating),
      total_beds: parseInt(row.total_beds),
      total_occupied: parseInt(row.total_occupied)
    };
  }

  // Add national average for states without data
  stateLookup['_NATIONAL'] = {
    ls_ss_ratio: 1.46,
    long_term_pct: 0.61, // 0.40 + (1.46/2.46) * 0.35 = 0.61
    facility_count: result.rows.reduce((sum, r) => sum + parseInt(r.facility_count), 0),
    avg_ls_rating: 3.64,
    avg_ss_rating: 3.17
  };

  cache.set(cacheKey, stateLookup);
  return stateLookup;
}

/**
 * Calculate raw market metrics for a geographic area
 * @param {string} geoType - 'state', 'cbsa', or 'cluster'
 * @param {string} geoCode - State code, CBSA code, or cluster ID
 * @returns {Promise<Object>} Raw metrics object
 */
async function calculateMarketMetrics(geoType, geoCode) {
  const pool = getMarketPool();
  const stateLtPcts = await calculateStateLongTermPercentages();

  let metrics = {};

  if (geoType === 'cbsa') {
    // Get CBSA-level metrics
    const result = await pool.query(`
      WITH cbsa_demo AS (
        SELECT
          SUM(cd.total_population) as total_population,
          SUM(cd.population_65_plus) as population_65_plus,
          SUM(cd.population_85_plus) as population_85_plus,
          AVG(cd.growth_rate_65_plus) as growth_rate_65_plus,
          AVG(cd.median_household_income) as median_household_income
        FROM county_demographics cd
        JOIN county_cbsa_crosswalk cw ON cd.county_fips = cw.county_fips
        WHERE cw.cbsa_code = $1
      ),
      cbsa_snf AS (
        SELECT
          COUNT(*) as snf_count,
          SUM(certified_beds) as snf_total_beds,
          SUM(occupied_beds) as snf_occupied_beds,
          AVG(occupancy_rate) as snf_avg_occupancy,
          SUM(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN certified_beds ELSE 0 END) as ensign_snf_beds,
          SUM(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN occupied_beds ELSE 0 END) as ensign_occupied_beds,
          COUNT(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN 1 END) as ensign_snf_count,
          -- State for LT pct lookup (use most common)
          MODE() WITHIN GROUP (ORDER BY state) as primary_state
        FROM snf_facilities
        WHERE cbsa_code = $1
      ),
      cbsa_alf AS (
        SELECT
          COUNT(*) as alf_count,
          SUM(capacity) as alf_total_beds,
          SUM(CASE WHEN UPPER(licensee) LIKE '%PENNANT%' THEN capacity ELSE 0 END) as pennant_alf_beds,
          COUNT(CASE WHEN UPPER(licensee) LIKE '%PENNANT%' THEN 1 END) as pennant_alf_count
        FROM alf_facilities
        WHERE cbsa_code = $1
      ),
      cbsa_hha AS (
        SELECT
          COUNT(DISTINCT ccn) as hha_count,
          SUM(episode_count) as hha_total_episodes,
          AVG(quality_star_rating) as hha_avg_star_rating
        FROM hh_provider_snapshots
        WHERE cbsa_code = $1
          AND extract_id = (SELECT MAX(extract_id) FROM hh_provider_snapshots)
      ),
      -- Pennant HHA count (using ownership data + ZIP-to-CBSA mapping)
      pennant_hha AS (
        SELECT COUNT(DISTINCT he.ccn) as pennant_hha_count
        FROM hha_enrollments he
        JOIN hha_owners ho ON he.enrollment_id = ho.enrollment_id AND he.extract_id = ho.extract_id
        JOIN hud_zip_cbsa hzc ON LEFT(he.zip_code, 5) = hzc.zip5
        WHERE hzc.cbsa_code = $1
          AND he.extract_id = (SELECT MAX(extract_id) FROM hha_enrollments)
          AND ho.type_owner = 'O'
          AND (
            UPPER(ho.organization_name_owner) LIKE '%PENNANT%'
            OR UPPER(ho.organization_name_owner) LIKE '%CORNERSTONE%'
          )
      ),
      -- Hospice metrics via ZIP matching
      cbsa_zips AS (
        SELECT DISTINCT zip5 FROM hud_zip_cbsa WHERE cbsa_code = $1
      ),
      cbsa_hospice AS (
        SELECT
          COUNT(DISTINCT hp.ccn) as hospice_count,
          SUM(CASE WHEN hp.ownership_type = 'For-Profit' THEN 1 ELSE 0 END) as hospice_for_profit_count,
          SUM(CASE WHEN hp.ownership_type = 'Non-Profit' THEN 1 ELSE 0 END) as hospice_non_profit_count
        FROM hospice_providers hp
        WHERE SUBSTRING(hp.zip_code, 1, 5) IN (SELECT zip5 FROM cbsa_zips)
          AND hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
      ),
      hospice_quality AS (
        SELECT
          hp.ccn,
          MAX(CASE WHEN hc.measure_code = 'SUMMARY_STAR_RATING' AND hc.star_rating ~ '^[0-9]+$'
              THEN hc.star_rating::integer END) as star_rating,
          MAX(CASE WHEN hq.measure_code = 'Average_Daily_Census' AND hq.score ~ '^[0-9]+\\.?[0-9]*$'
              THEN hq.score::numeric END) as avg_daily_census
        FROM hospice_providers hp
        LEFT JOIN hospice_cahps_snapshots hc ON hp.ccn = hc.ccn
          AND hc.extract_id = (SELECT MAX(extract_id) FROM hospice_cahps_snapshots)
        LEFT JOIN hospice_quality_measures hq ON hp.ccn = hq.ccn
          AND hq.extract_id = (SELECT MAX(extract_id) FROM hospice_quality_measures)
        WHERE SUBSTRING(hp.zip_code, 1, 5) IN (SELECT zip5 FROM cbsa_zips)
          AND hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
        GROUP BY hp.ccn
      ),
      hospice_agg AS (
        SELECT
          ROUND(AVG(star_rating)::numeric, 2) as hospice_avg_star_rating,
          ROUND(SUM(avg_daily_census)::numeric, 0) as hospice_total_adc,
          ROUND(AVG(avg_daily_census)::numeric, 1) as hospice_avg_adc,
          ROUND((SUM(CASE WHEN star_rating = 5 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(star_rating), 0))::numeric, 1) as hospice_pct_5_star,
          ROUND((SUM(CASE WHEN star_rating <= 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(star_rating), 0))::numeric, 1) as hospice_pct_1_2_star
        FROM hospice_quality
      ),
      -- Pennant hospice in CBSA
      pennant_hospice AS (
        WITH pennant_hospice_orgs AS (
          SELECT DISTINCT organization_name
          FROM hospice_owners
          WHERE organization_name_owner IN ('THE PENNANT GROUP INC', 'CORNERSTONE HEALTHCARE INC')
            AND type_owner = 'O'
            AND extract_id = (SELECT MAX(extract_id) FROM hospice_owners)
        )
        SELECT
          COUNT(DISTINCT hp.ccn) as pennant_hospice_count,
          COALESCE(SUM(hq.avg_daily_census), 0) as pennant_hospice_adc
        FROM hospice_providers hp
        JOIN pennant_hospice_orgs pho ON UPPER(hp.facility_name) LIKE '%' || UPPER(SPLIT_PART(pho.organization_name, ' ', 1)) || '%'
        LEFT JOIN hospice_quality hq ON hp.ccn = hq.ccn
        WHERE SUBSTRING(hp.zip_code, 1, 5) IN (SELECT zip5 FROM cbsa_zips)
          AND hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
      ),
      -- Hospice HHI (market concentration)
      hospice_shares AS (
        SELECT
          hp.ownership_type,
          COUNT(*) as count
        FROM hospice_providers hp
        WHERE SUBSTRING(hp.zip_code, 1, 5) IN (SELECT zip5 FROM cbsa_zips)
          AND hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
        GROUP BY hp.ownership_type
      ),
      hospice_total AS (
        SELECT SUM(count) as total FROM hospice_shares
      ),
      hospice_hhi_calc AS (
        SELECT
          ROUND(SUM(POWER(hs.count * 100.0 / NULLIF(ht.total, 0), 2)))::integer as hospice_hhi
        FROM hospice_shares hs
        CROSS JOIN hospice_total ht
      ),
      cbsa_info AS (
        SELECT cbsa_code, cbsa_title FROM cbsas WHERE cbsa_code = $1
      )
      SELECT
        ci.cbsa_code as geo_code,
        ci.cbsa_title as geo_name,
        -- Demographics
        d.total_population,
        d.population_65_plus,
        d.population_85_plus,
        d.growth_rate_65_plus,
        d.median_household_income,
        -- SNF
        s.snf_count as snf_facility_count,
        s.snf_total_beds,
        s.snf_occupied_beds,
        s.snf_avg_occupancy,
        s.ensign_snf_beds,
        s.ensign_occupied_beds,
        s.ensign_snf_count,
        s.primary_state,
        -- ALF
        a.alf_count as alf_facility_count,
        a.alf_total_beds,
        a.pennant_alf_beds,
        a.pennant_alf_count,
        -- HHA
        h.hha_count,
        h.hha_total_episodes,
        h.hha_avg_star_rating,
        ph.pennant_hha_count,
        -- Hospice
        ch.hospice_count as hospice_provider_count,
        ch.hospice_for_profit_count,
        ch.hospice_non_profit_count,
        ha.hospice_avg_star_rating,
        ha.hospice_total_adc,
        ha.hospice_avg_adc,
        ha.hospice_pct_5_star,
        ha.hospice_pct_1_2_star,
        hhi.hospice_hhi,
        phosp.pennant_hospice_count,
        phosp.pennant_hospice_adc
      FROM cbsa_info ci
      CROSS JOIN cbsa_demo d
      CROSS JOIN cbsa_snf s
      CROSS JOIN cbsa_alf a
      CROSS JOIN cbsa_hha h
      CROSS JOIN pennant_hha ph
      CROSS JOIN cbsa_hospice ch
      CROSS JOIN hospice_agg ha
      CROSS JOIN pennant_hospice phosp
      CROSS JOIN hospice_hhi_calc hhi
    `, [geoCode]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const state = row.primary_state || 'AZ';
    const stateData = stateLtPcts[state] || stateLtPcts['_NATIONAL'];

    // Calculate long-term beds
    const snfOccupiedBeds = parseInt(row.snf_occupied_beds) || 0;
    const snfLtBeds = Math.round(snfOccupiedBeds * stateData.long_term_pct);
    const ensignOccupied = parseInt(row.ensign_occupied_beds) || 0;
    const ensignLtBeds = Math.round(ensignOccupied * stateData.long_term_pct);

    const pop65 = parseInt(row.population_65_plus) || 1;
    const pop85 = parseInt(row.population_85_plus) || 0;

    metrics = {
      geo_type: geoType,
      geo_code: geoCode,
      geo_name: row.geo_name,
      primary_state: state,
      state_lt_pct: stateData.long_term_pct,
      state_ls_ss_ratio: stateData.ls_ss_ratio,

      // Demographics
      total_population: parseInt(row.total_population) || 0,
      population_65_plus: pop65,
      population_85_plus: pop85,
      growth_rate_65_plus: parseFloat(row.growth_rate_65_plus) || 0,
      median_household_income: parseInt(row.median_household_income) || 0,

      // SNF Supply
      snf_facility_count: parseInt(row.snf_facility_count) || 0,
      snf_total_beds: parseInt(row.snf_total_beds) || 0,
      snf_occupied_beds: snfOccupiedBeds,
      snf_avg_occupancy: parseFloat(row.snf_avg_occupancy) || 0,
      snf_lt_beds: snfLtBeds,
      snf_lt_beds_per_100k_65: Math.round(snfLtBeds * 100000 / pop65 * 10) / 10,
      ensign_snf_count: parseInt(row.ensign_snf_count) || 0,
      ensign_snf_beds: parseInt(row.ensign_snf_beds) || 0,
      ensign_lt_beds: ensignLtBeds,

      // ALF Supply
      alf_facility_count: parseInt(row.alf_facility_count) || 0,
      alf_total_beds: parseInt(row.alf_total_beds) || 0,
      alf_beds_per_100k_65: Math.round((parseInt(row.alf_total_beds) || 0) * 100000 / pop65 * 10) / 10,
      pennant_alf_count: parseInt(row.pennant_alf_count) || 0,
      pennant_alf_beds: parseInt(row.pennant_alf_beds) || 0,

      // HHA Supply
      hha_count: parseInt(row.hha_count) || 0,
      hha_total_episodes: parseInt(row.hha_total_episodes) || 0,
      hha_avg_star_rating: parseFloat(row.hha_avg_star_rating) || null,
      pennant_hha_count: parseInt(row.pennant_hha_count) || 0,

      // Hospice Supply
      hospice_provider_count: parseInt(row.hospice_provider_count) || 0,
      hospice_for_profit_count: parseInt(row.hospice_for_profit_count) || 0,
      hospice_non_profit_count: parseInt(row.hospice_non_profit_count) || 0,
      hospice_for_profit_pct: Math.round((parseInt(row.hospice_for_profit_count) || 0) * 100 / Math.max(parseInt(row.hospice_provider_count) || 1, 1)),
      hospice_per_100k_65: Math.round((parseInt(row.hospice_provider_count) || 0) * 100000 / pop65 * 100) / 100,
      hospice_total_adc: parseInt(row.hospice_total_adc) || 0,
      hospice_avg_adc: parseFloat(row.hospice_avg_adc) || 0,
      hospice_avg_star_rating: parseFloat(row.hospice_avg_star_rating) || null,
      hospice_pct_5_star: parseFloat(row.hospice_pct_5_star) || 0,
      hospice_pct_1_2_star: parseFloat(row.hospice_pct_1_2_star) || 0,
      hospice_hhi: parseInt(row.hospice_hhi) || 0,
      pennant_hospice_count: parseInt(row.pennant_hospice_count) || 0,
      pennant_hospice_adc: parseInt(row.pennant_hospice_adc) || 0
    };
  } else if (geoType === 'state') {
    // State-level metrics aggregation
    const result = await pool.query(`
      WITH state_demo AS (
        SELECT
          SUM(total_population) as total_population,
          SUM(population_65_plus) as population_65_plus,
          SUM(population_85_plus) as population_85_plus,
          AVG(growth_rate_65_plus) as growth_rate_65_plus,
          AVG(median_household_income) as median_household_income
        FROM county_demographics
        WHERE state_code = $1
      ),
      state_snf AS (
        SELECT
          COUNT(*) as snf_count,
          SUM(certified_beds) as snf_total_beds,
          SUM(occupied_beds) as snf_occupied_beds,
          AVG(occupancy_rate) as snf_avg_occupancy,
          SUM(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN certified_beds ELSE 0 END) as ensign_snf_beds,
          SUM(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN occupied_beds ELSE 0 END) as ensign_occupied_beds,
          COUNT(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN 1 END) as ensign_snf_count
        FROM snf_facilities
        WHERE state = $1
      ),
      state_alf AS (
        SELECT
          COUNT(*) as alf_count,
          SUM(capacity) as alf_total_beds,
          SUM(CASE WHEN UPPER(licensee) LIKE '%PENNANT%' THEN capacity ELSE 0 END) as pennant_alf_beds,
          COUNT(CASE WHEN UPPER(licensee) LIKE '%PENNANT%' THEN 1 END) as pennant_alf_count
        FROM alf_facilities
        WHERE state = $1
      ),
      state_hha AS (
        SELECT
          COUNT(DISTINCT ccn) as hha_count,
          SUM(episode_count) as hha_total_episodes,
          AVG(quality_star_rating) as hha_avg_star_rating
        FROM hh_provider_snapshots
        WHERE state = $1
          AND extract_id = (SELECT MAX(extract_id) FROM hh_provider_snapshots)
      ),
      state_hospice AS (
        SELECT
          COUNT(DISTINCT hp.ccn) as hospice_count,
          SUM(CASE WHEN hp.ownership_type = 'For-Profit' THEN 1 ELSE 0 END) as hospice_for_profit_count
        FROM hospice_providers hp
        WHERE hp.state = $1
          AND hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
      )
      SELECT
        d.*,
        s.snf_count, s.snf_total_beds, s.snf_occupied_beds, s.snf_avg_occupancy,
        s.ensign_snf_beds, s.ensign_occupied_beds, s.ensign_snf_count,
        a.alf_count, a.alf_total_beds, a.pennant_alf_beds, a.pennant_alf_count,
        h.hha_count, h.hha_total_episodes, h.hha_avg_star_rating,
        hosp.hospice_count, hosp.hospice_for_profit_count
      FROM state_demo d
      CROSS JOIN state_snf s
      CROSS JOIN state_alf a
      CROSS JOIN state_hha h
      CROSS JOIN state_hospice hosp
    `, [geoCode]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const stateData = stateLtPcts[geoCode] || stateLtPcts['_NATIONAL'];
    const snfOccupied = parseInt(row.snf_occupied_beds) || 0;
    const snfLtBeds = Math.round(snfOccupied * stateData.long_term_pct);
    const pop65 = parseInt(row.population_65_plus) || 1;

    metrics = {
      geo_type: geoType,
      geo_code: geoCode,
      geo_name: geoCode, // State code as name
      primary_state: geoCode,
      state_lt_pct: stateData.long_term_pct,
      state_ls_ss_ratio: stateData.ls_ss_ratio,
      total_population: parseInt(row.total_population) || 0,
      population_65_plus: pop65,
      population_85_plus: parseInt(row.population_85_plus) || 0,
      growth_rate_65_plus: parseFloat(row.growth_rate_65_plus) || 0,
      snf_facility_count: parseInt(row.snf_count) || 0,
      snf_total_beds: parseInt(row.snf_total_beds) || 0,
      snf_occupied_beds: snfOccupied,
      snf_lt_beds: snfLtBeds,
      snf_lt_beds_per_100k_65: Math.round(snfLtBeds * 100000 / pop65 * 10) / 10,
      ensign_snf_beds: parseInt(row.ensign_snf_beds) || 0,
      ensign_lt_beds: Math.round((parseInt(row.ensign_occupied_beds) || 0) * stateData.long_term_pct),
      alf_facility_count: parseInt(row.alf_count) || 0,
      alf_total_beds: parseInt(row.alf_total_beds) || 0,
      alf_beds_per_100k_65: Math.round((parseInt(row.alf_total_beds) || 0) * 100000 / pop65 * 10) / 10,
      pennant_alf_beds: parseInt(row.pennant_alf_beds) || 0,
      pennant_alf_count: parseInt(row.pennant_alf_count) || 0,
      hha_count: parseInt(row.hha_count) || 0,
      pennant_hha_count: 0, // Would need complex matching
      hospice_provider_count: parseInt(row.hospice_count) || 0,
      hospice_for_profit_count: parseInt(row.hospice_for_profit_count) || 0,
      hospice_for_profit_pct: Math.round((parseInt(row.hospice_for_profit_count) || 0) * 100 / Math.max(parseInt(row.hospice_count) || 1, 1)),
      hospice_per_100k_65: Math.round((parseInt(row.hospice_count) || 0) * 100000 / pop65 * 100) / 100,
      hospice_hhi: 0, // Would need complex calculation
      pennant_hospice_count: 0
    };
  }

  return metrics;
}

/**
 * Calculate national percentiles for all metrics
 * @param {string} geoType - 'cbsa' or 'state'
 * @returns {Promise<Object>} Percentile lookup for each metric
 */
async function calculateNationalPercentiles(geoType = 'cbsa') {
  const cacheKey = `percentiles_${geoType}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const pool = getMarketPool();
  const stateLtPcts = await calculateStateLongTermPercentages();

  // Get all markets with metrics
  let query;
  if (geoType === 'cbsa') {
    query = `
      WITH cbsa_metrics AS (
        SELECT
          mm.geography_id as geo_code,
          mm.pop_65_plus,
          mm.pop_85_plus,
          mm.projected_growth_65_2030 as growth_rate_65,
          mm.snf_total_beds,
          mm.snf_occupied_beds,
          mm.alf_total_capacity as alf_total_beds,
          sf.primary_state,
          COALESCE(hosp.hospice_count, 0) as hospice_count,
          COALESCE(hosp.for_profit_count, 0) as hospice_for_profit_count
        FROM market_metrics mm
        LEFT JOIN (
          SELECT cbsa_code, MODE() WITHIN GROUP (ORDER BY state) as primary_state
          FROM snf_facilities
          WHERE cbsa_code IS NOT NULL
          GROUP BY cbsa_code
        ) sf ON mm.geography_id = sf.cbsa_code
        LEFT JOIN (
          SELECT
            hz.cbsa_code,
            COUNT(DISTINCT hp.ccn) as hospice_count,
            SUM(CASE WHEN hp.ownership_type = 'For-Profit' THEN 1 ELSE 0 END) as for_profit_count
          FROM hud_zip_cbsa hz
          JOIN hospice_providers hp ON SUBSTRING(hp.zip_code, 1, 5) = hz.zip5
          WHERE hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
          GROUP BY hz.cbsa_code
        ) hosp ON mm.geography_id = hosp.cbsa_code
        WHERE mm.geography_type = 'cbsa'
          AND mm.pop_65_plus > 10000  -- Filter small markets
      )
      SELECT
        geo_code,
        pop_65_plus,
        pop_85_plus,
        growth_rate_65,
        snf_total_beds,
        snf_occupied_beds,
        alf_total_beds,
        primary_state,
        hospice_count,
        hospice_for_profit_count,
        -- Calculate per-capita metrics
        ROUND((snf_occupied_beds * 100000.0 / NULLIF(pop_65_plus, 0))::numeric, 1) as snf_beds_per_100k,
        ROUND((alf_total_beds * 100000.0 / NULLIF(pop_65_plus, 0))::numeric, 1) as alf_beds_per_100k,
        ROUND((hospice_count * 100000.0 / NULLIF(pop_65_plus, 0))::numeric, 2) as hospice_per_100k
      FROM cbsa_metrics
      ORDER BY pop_65_plus DESC
    `;
  } else {
    // State-level query
    query = `
      SELECT
        state_code as geo_code,
        SUM(population_65_plus) as pop_65_plus,
        SUM(population_85_plus) as pop_85_plus,
        AVG(growth_rate_65_plus) as growth_rate_65
      FROM county_demographics
      WHERE state_code IS NOT NULL
      GROUP BY state_code
      ORDER BY SUM(population_65_plus) DESC
    `;
  }

  const result = await pool.query(query);
  const markets = result.rows;

  // Calculate percentile ranks for each metric
  const calculatePercentileRanks = (values) => {
    const sorted = [...values].filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b);
    const n = sorted.length;
    return values.map(v => {
      if (v === null || isNaN(v)) return 50; // Default to median
      const rank = sorted.filter(x => x <= v).length;
      return Math.round((rank / n) * 100);
    });
  };

  // Extract metric arrays
  const pop85Values = markets.map(m => parseInt(m.pop_85_plus) || 0);
  const growthValues = markets.map(m => parseFloat(m.growth_rate_65) || 0);
  const hospicePerCapValues = markets.map(m => parseFloat(m.hospice_per_100k) || 0);
  const forProfitPctValues = markets.map(m => {
    const total = parseInt(m.hospice_count) || 1;
    const fp = parseInt(m.hospice_for_profit_count) || 0;
    return (fp / total) * 100;
  });

  // Calculate LT beds per 100k with state adjustments
  const ltBedsPerCapValues = markets.map(m => {
    const state = m.primary_state || 'AZ';
    const ltPct = (stateLtPcts[state] || stateLtPcts['_NATIONAL']).long_term_pct;
    const occupied = parseInt(m.snf_occupied_beds) || 0;
    const ltBeds = occupied * ltPct;
    const pop65 = parseInt(m.pop_65_plus) || 1;
    return (ltBeds * 100000 / pop65);
  });

  const alfPerCapValues = markets.map(m => parseFloat(m.alf_beds_per_100k) || 0);

  // Calculate percentile ranks
  const pop85Pctls = calculatePercentileRanks(pop85Values);
  const growthPctls = calculatePercentileRanks(growthValues);
  const hospicePctls = calculatePercentileRanks(hospicePerCapValues);
  const forProfitPctls = calculatePercentileRanks(forProfitPctValues);
  const ltBedsPctls = calculatePercentileRanks(ltBedsPerCapValues);
  const alfPctls = calculatePercentileRanks(alfPerCapValues);

  // Create lookup by geo_code
  const percentileLookup = {};
  markets.forEach((m, i) => {
    percentileLookup[m.geo_code] = {
      pop_85_plus_pctl: pop85Pctls[i],
      growth_rate_65_pctl: growthPctls[i],
      hospice_per_100k_pctl: hospicePctls[i],
      for_profit_pct_pctl: forProfitPctls[i],
      snf_lt_beds_per_100k_pctl: ltBedsPctls[i],
      alf_beds_per_100k_pctl: alfPctls[i]
    };
  });

  cache.set(cacheKey, percentileLookup);
  return percentileLookup;
}

/**
 * Calculate Demand Score (30% weight)
 * Based on population 85+, growth rate, SNF/ALF density
 */
function calculateDemandScore(metrics, percentiles) {
  const p = percentiles || {};

  // Pop 85+ percentile (40% of demand score)
  const pop85Score = (p.pop_85_plus_pctl || 50) * 0.40;

  // Growth rate percentile (25% of demand score)
  const growthScore = (p.growth_rate_65_pctl || 50) * 0.25;

  // SNF LT beds per 100k percentile (20% of demand score)
  // Higher density = more referral potential
  const snfScore = (p.snf_lt_beds_per_100k_pctl || 50) * 0.20;

  // ALF beds per 100k percentile (15% of demand score)
  const alfScore = (p.alf_beds_per_100k_pctl || 50) * 0.15;

  return Math.round((pop85Score + growthScore + snfScore + alfScore) * 10) / 10;
}

/**
 * Calculate Competition Score (25% weight)
 * Based on hospice density (inverse), market concentration, for-profit %
 */
function calculateCompetitionScore(metrics, percentiles) {
  const p = percentiles || {};

  // Hospice per 100k percentile - INVERSE (fewer = better opportunity)
  // 50% of competition score
  const densityScore = (100 - (p.hospice_per_100k_pctl || 50)) * 0.50;

  // HHI opportunity score (30%)
  // < 1500: competitive market (harder to enter) = 50 points
  // 1500-2500: moderate concentration = 70 points
  // > 2500: highly concentrated (few players) = 40 points (hard to enter)
  const hhi = metrics.hospice_hhi || 2500;
  let hhiScore;
  if (hhi < 1500) {
    hhiScore = 50;
  } else if (hhi <= 2500) {
    hhiScore = 70;
  } else {
    hhiScore = 40;
  }
  const hhiComponent = hhiScore * 0.30;

  // For-profit percentage - INVERSE (less for-profit = more quality-focused opportunity)
  // 20% of competition score
  const forProfitScore = (100 - (p.for_profit_pct_pctl || 50)) * 0.20;

  return Math.round((densityScore + hhiComponent + forProfitScore) * 10) / 10;
}

/**
 * Calculate Quality Gap Score (15% weight)
 * Based on average star rating gaps and quality distribution
 */
function calculateQualityGapScore(metrics) {
  // Avg star rating gap (50% of quality score)
  // Lower avg rating = more opportunity for quality-focused entrant
  const avgRating = metrics.hospice_avg_star_rating || 3.5;
  const ratingGapScore = ((5 - avgRating) / 4 * 100) * 0.50;

  // 5-star percentage - INVERSE (fewer 5-stars = opportunity)
  // 30% of quality score
  const pct5Star = metrics.hospice_pct_5_star || 15;
  const fiveStarScore = (100 - pct5Star) * 0.30;

  // 1-2 star percentage (more low quality = opportunity)
  // 20% of quality score
  const pct12Star = metrics.hospice_pct_1_2_star || 10;
  const lowQualityScore = pct12Star * 0.20;

  return Math.round((ratingGapScore + fiveStarScore + lowQualityScore) * 10) / 10;
}

/**
 * Calculate Pennant Synergy Score
 * Based on existing ALF/HHA/Ensign presence - these are CAPTIVE referral sources
 *
 * Key insight: In markets with Ensign SNFs and Pennant ALFs, hospice referrals
 * are essentially captive - market saturation matters much less.
 */
function calculatePennantFitScore(metrics) {
  // For HOSPICE, the key referral sources are:
  // 1. Ensign SNF long-term patients - PRIMARY driver (these patients transition to hospice)
  // 2. Pennant ALF residents - needing end-of-life care
  // 3. Pennant HHA patients - may transition to hospice as condition worsens
  // 4. Existing Pennant hospice - market knowledge/infrastructure

  // Ensign SNF presence (50% of synergy score) - PRIMARY driver
  // 1000 LT beds = max score (Phoenix has 1802, LA has 1842)
  const ensignLtBeds = metrics.ensign_lt_beds || 0;
  const ensignScore = Math.min(ensignLtBeds / 1000, 1) * 100 * 0.50;

  // Pennant ALF presence (25% of synergy score)
  // 250 beds = max score (Phoenix has 392, gives full credit)
  const pennantAlfBeds = metrics.pennant_alf_beds || 0;
  const alfScore = Math.min(pennantAlfBeds / 250, 1) * 100 * 0.25;

  // Pennant HHA presence (10% of synergy score)
  // HHA patients may transition to hospice as condition worsens
  // 2 agencies = max score
  const pennantHha = metrics.pennant_hha_count || 0;
  const hhaScore = Math.min(pennantHha / 2, 1) * 100 * 0.10;

  // Existing Pennant hospice presence (15% of synergy score)
  // Having hospice already is a STRENGTH - market knowledge, infrastructure, relationships
  // 3 agencies = max score
  const pennantHospice = metrics.pennant_hospice_count || 0;
  const hospiceScore = Math.min(pennantHospice / 3, 1) * 100 * 0.15;

  return Math.round((ensignScore + alfScore + hhaScore + hospiceScore) * 10) / 10;
}

/**
 * Calculate final Opportunity Score based on mode
 * @param {string} mode - 'footprint' or 'greenfield'
 *
 * FOOTPRINT MODE: Where should Pennant focus within existing presence?
 *   - Requires Pennant ALF/HHA/Ensign presence
 *   - Pennant Synergy is PRIMARY driver (captive referral sources!)
 *   - Market saturation matters less when you have captive sources
 *   - Weights: Pennant Synergy 50%, Demand 30%, Market Opportunity 10%, Quality Gap 10%
 *
 * GREENFIELD MODE: Where should Pennant expand to new markets?
 *   - No Pennant presence required
 *   - Market opportunity (underserved markets) is key
 *   - Weights: Demand 40%, Market Opportunity 40%, Quality Gap 20%
 */
function calculateOpportunityScore(demandScore, marketOpportunityScore, qualityGapScore, pennantFitScore, mode = 'footprint') {
  if (mode === 'greenfield') {
    // Greenfield: Pure market attractiveness, no Pennant presence needed
    return Math.round((
      (demandScore * 0.40) +
      (marketOpportunityScore * 0.40) +
      (qualityGapScore * 0.20)
    ) * 10) / 10;
  } else {
    // Footprint: Pennant Synergy DOMINATES because captive referral sources
    // When you have Ensign SNFs and Pennant ALFs, market saturation is nearly irrelevant
    return Math.round((
      (pennantFitScore * 0.75) +      // Captive referral sources dominate decision
      (demandScore * 0.15) +           // Is there volume in this market?
      (qualityGapScore * 0.10)         // Quality data is sparse, minimize weight
      // Note: Market Opportunity (competition) excluded - captive sources negate it
    ) * 10) / 10;
  }
}

/**
 * Assign letter grade based on score
 */
function assignGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

/**
 * Score a single market with full breakdown
 * @param {string} geoType - 'cbsa' or 'state'
 * @param {string} geoCode - Geographic code
 * @param {string} mode - 'footprint' (within Pennant presence) or 'greenfield' (new markets)
 * @returns {Promise<Object>} Full scoring breakdown
 */
async function scoreMarket(geoType, geoCode, mode = 'footprint') {
  const cacheKey = `market_score_${geoType}_${geoCode}_${mode}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const metrics = await calculateMarketMetrics(geoType, geoCode);
  if (!metrics) return null;

  // For footprint mode, skip markets with no Pennant presence
  const hasPennantPresence = (metrics.pennant_alf_beds > 0) ||
                             (metrics.pennant_hha_count > 0) ||
                             (metrics.ensign_lt_beds > 0);

  if (mode === 'footprint' && !hasPennantPresence) {
    return null; // Skip markets without Pennant presence in footprint mode
  }

  const percentiles = await calculateNationalPercentiles(geoType);
  const marketPercentiles = percentiles[geoCode] || {};

  const demandScore = calculateDemandScore(metrics, marketPercentiles);
  const marketOpportunityScore = calculateCompetitionScore(metrics, marketPercentiles);
  const qualityGapScore = calculateQualityGapScore(metrics);
  const pennantFitScore = calculatePennantFitScore(metrics);
  const opportunityScore = calculateOpportunityScore(demandScore, marketOpportunityScore, qualityGapScore, pennantFitScore, mode);
  const grade = assignGrade(opportunityScore);

  const result = {
    geo_type: geoType,
    geo_code: geoCode,
    geo_name: metrics.geo_name,
    score_mode: mode,
    has_pennant_presence: hasPennantPresence,

    // Scores
    opportunity_score: opportunityScore,
    grade,
    component_scores: {
      demand_score: demandScore,
      market_opportunity_score: marketOpportunityScore, // Renamed from competition_score
      quality_gap_score: qualityGapScore,
      pennant_synergy_score: mode === 'footprint' ? pennantFitScore : null // Only relevant in footprint mode
    },

    // Weight explanation
    weights: mode === 'greenfield'
      ? { demand: 0.40, market_opportunity: 0.40, quality_gap: 0.20 }
      : { pennant_synergy: 0.75, demand: 0.15, quality_gap: 0.10 },

    // Percentiles
    percentiles: marketPercentiles,

    // Raw metrics
    metrics,

    // Calculated at
    calculated_at: new Date().toISOString()
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Score all markets of a given type using BULK query (fast)
 * Instead of N queries (one per market), uses a single bulk query
 * @param {string} geoType - 'cbsa' or 'state'
 * @param {number} minPop65 - Minimum population 65+ to include
 * @param {string} mode - 'footprint' or 'greenfield'
 * @returns {Promise<Array>} Sorted array of market scores
 */
async function scoreAllMarkets(geoType = 'cbsa', minPop65 = 50000, mode = 'footprint') {
  const cacheKey = `all_scores_${geoType}_${minPop65}_${mode}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const pool = getMarketPool();
  const stateLtPcts = await calculateStateLongTermPercentages();

  // BULK QUERY: Get all CBSA metrics in a single query
  const bulkQuery = `
    WITH cbsa_snf AS (
      SELECT
        cbsa_code,
        COUNT(*) as snf_count,
        SUM(occupied_beds) as snf_occupied_beds,
        SUM(CASE WHEN UPPER(parent_organization) LIKE '%ENSIGN%' THEN occupied_beds ELSE 0 END) as ensign_occupied_beds,
        MODE() WITHIN GROUP (ORDER BY state) as primary_state
      FROM snf_facilities
      WHERE cbsa_code IS NOT NULL
      GROUP BY cbsa_code
    ),
    cbsa_alf AS (
      SELECT
        cbsa_code,
        SUM(capacity) as alf_total_beds,
        SUM(CASE WHEN UPPER(licensee) LIKE '%PENNANT%' THEN capacity ELSE 0 END) as pennant_alf_beds
      FROM alf_facilities
      WHERE cbsa_code IS NOT NULL
      GROUP BY cbsa_code
    ),
    pennant_hha AS (
      SELECT
        hzc.cbsa_code,
        COUNT(DISTINCT he.ccn) as pennant_hha_count
      FROM hha_enrollments he
      JOIN hha_owners ho ON he.enrollment_id = ho.enrollment_id AND he.extract_id = ho.extract_id
      JOIN hud_zip_cbsa hzc ON LEFT(he.zip_code, 5) = hzc.zip5
      WHERE he.extract_id = (SELECT MAX(extract_id) FROM hha_enrollments)
        AND ho.type_owner = 'O'
        AND (UPPER(ho.organization_name_owner) LIKE '%PENNANT%' OR UPPER(ho.organization_name_owner) LIKE '%CORNERSTONE%')
      GROUP BY hzc.cbsa_code
    ),
    cbsa_hospice AS (
      SELECT
        hz.cbsa_code,
        COUNT(DISTINCT hp.ccn) as hospice_count,
        SUM(CASE WHEN hp.ownership_type = 'For-Profit' THEN 1 ELSE 0 END) as hospice_for_profit_count
      FROM hud_zip_cbsa hz
      JOIN hospice_providers hp ON SUBSTRING(hp.zip_code, 1, 5) = hz.zip5
      WHERE hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
      GROUP BY hz.cbsa_code
    ),
    hospice_quality AS (
      SELECT
        hz.cbsa_code,
        AVG(CASE WHEN hc.measure_code = 'SUMMARY_STAR_RATING' AND hc.star_rating ~ '^[0-9]+$'
            THEN hc.star_rating::integer END) as hospice_avg_star_rating,
        (SUM(CASE WHEN hc.star_rating ~ '^[0-9]+$' AND hc.star_rating::integer = 5 THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(CASE WHEN hc.star_rating ~ '^[0-9]+$' THEN 1 END), 0)) as hospice_pct_5_star,
        (SUM(CASE WHEN hc.star_rating ~ '^[0-9]+$' AND hc.star_rating::integer <= 2 THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(CASE WHEN hc.star_rating ~ '^[0-9]+$' THEN 1 END), 0)) as hospice_pct_1_2_star
      FROM hud_zip_cbsa hz
      JOIN hospice_providers hp ON SUBSTRING(hp.zip_code, 1, 5) = hz.zip5
      LEFT JOIN hospice_cahps_snapshots hc ON hp.ccn = hc.ccn
        AND hc.extract_id = (SELECT MAX(extract_id) FROM hospice_cahps_snapshots)
      WHERE hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
      GROUP BY hz.cbsa_code
    ),
    pennant_hospice AS (
      WITH pennant_orgs AS (
        SELECT DISTINCT organization_name
        FROM hospice_owners
        WHERE organization_name_owner IN ('THE PENNANT GROUP INC', 'CORNERSTONE HEALTHCARE INC')
          AND type_owner = 'O'
          AND extract_id = (SELECT MAX(extract_id) FROM hospice_owners)
      )
      SELECT
        hz.cbsa_code,
        COUNT(DISTINCT hp.ccn) as pennant_hospice_count
      FROM hud_zip_cbsa hz
      JOIN hospice_providers hp ON SUBSTRING(hp.zip_code, 1, 5) = hz.zip5
      JOIN pennant_orgs po ON UPPER(hp.facility_name) LIKE '%' || UPPER(SPLIT_PART(po.organization_name, ' ', 1)) || '%'
      WHERE hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
      GROUP BY hz.cbsa_code
    )
    SELECT
      mm.geography_id as geo_code,
      mm.geography_name as geo_name,
      c.cbsa_title,
      mm.pop_65_plus,
      mm.pop_85_plus,
      mm.projected_growth_65_2030 as growth_rate_65,
      COALESCE(s.snf_occupied_beds, 0) as snf_occupied_beds,
      COALESCE(s.ensign_occupied_beds, 0) as ensign_occupied_beds,
      COALESCE(s.primary_state, 'AZ') as primary_state,
      COALESCE(a.alf_total_beds, 0) as alf_total_beds,
      COALESCE(a.pennant_alf_beds, 0) as pennant_alf_beds,
      COALESCE(ph.pennant_hha_count, 0) as pennant_hha_count,
      COALESCE(h.hospice_count, 0) as hospice_count,
      COALESCE(h.hospice_for_profit_count, 0) as hospice_for_profit_count,
      COALESCE(hq.hospice_avg_star_rating, 3.5) as hospice_avg_star_rating,
      COALESCE(hq.hospice_pct_5_star, 15) as hospice_pct_5_star,
      COALESCE(hq.hospice_pct_1_2_star, 10) as hospice_pct_1_2_star,
      COALESCE(phosp.pennant_hospice_count, 0) as pennant_hospice_count
    FROM market_metrics mm
    LEFT JOIN cbsas c ON mm.geography_id = c.cbsa_code
    LEFT JOIN cbsa_snf s ON mm.geography_id = s.cbsa_code
    LEFT JOIN cbsa_alf a ON mm.geography_id = a.cbsa_code
    LEFT JOIN pennant_hha ph ON mm.geography_id = ph.cbsa_code
    LEFT JOIN cbsa_hospice h ON mm.geography_id = h.cbsa_code
    LEFT JOIN hospice_quality hq ON mm.geography_id = hq.cbsa_code
    LEFT JOIN pennant_hospice phosp ON mm.geography_id = phosp.cbsa_code
    WHERE mm.geography_type = 'cbsa'
      AND mm.pop_65_plus >= $1
    ORDER BY mm.pop_65_plus DESC
  `;

  console.log('[HospiceScoring] Running bulk query for all CBSAs...');
  const result = await pool.query(bulkQuery, [minPop65]);
  console.log(`[HospiceScoring] Got ${result.rows.length} CBSAs, now scoring...`);

  // Calculate per-capita metrics and percentiles IN MEMORY
  const markets = result.rows.map(row => {
    const state = row.primary_state || 'AZ';
    const stateData = stateLtPcts[state] || stateLtPcts['_NATIONAL'];
    const pop65 = parseInt(row.pop_65_plus) || 1;
    const pop85 = parseInt(row.pop_85_plus) || 0;
    const snfOccupied = parseInt(row.snf_occupied_beds) || 0;
    const ensignOccupied = parseInt(row.ensign_occupied_beds) || 0;
    const ensignLtBeds = Math.round(ensignOccupied * stateData.long_term_pct);
    const pennantAlfBeds = parseInt(row.pennant_alf_beds) || 0;
    const pennantHhaCount = parseInt(row.pennant_hha_count) || 0;
    const hospiceCount = parseInt(row.hospice_count) || 0;

    return {
      geo_code: row.geo_code,
      geo_name: row.cbsa_title || row.geo_name,
      pop_65_plus: pop65,
      pop_85_plus: pop85,
      growth_rate_65: parseFloat(row.growth_rate_65) || 0,
      snf_lt_beds_per_100k: Math.round(snfOccupied * stateData.long_term_pct * 100000 / pop65),
      alf_beds_per_100k: Math.round((parseInt(row.alf_total_beds) || 0) * 100000 / pop65),
      hospice_per_100k: Math.round(hospiceCount * 100000 / pop65 * 100) / 100,
      hospice_count: hospiceCount,
      hospice_for_profit_pct: hospiceCount > 0 ? Math.round((parseInt(row.hospice_for_profit_count) || 0) * 100 / hospiceCount) : 50,
      hospice_avg_star_rating: parseFloat(row.hospice_avg_star_rating) || 3.5,
      hospice_pct_5_star: parseFloat(row.hospice_pct_5_star) || 15,
      hospice_pct_1_2_star: parseFloat(row.hospice_pct_1_2_star) || 10,
      ensign_lt_beds: ensignLtBeds,
      pennant_alf_beds: pennantAlfBeds,
      pennant_hha_count: pennantHhaCount,
      pennant_hospice_count: parseInt(row.pennant_hospice_count) || 0,
      has_pennant_presence: (ensignLtBeds > 0) || (pennantAlfBeds > 0) || (pennantHhaCount > 0)
    };
  });

  // Calculate percentile ranks IN MEMORY
  const calcPercentile = (values, v) => {
    const sorted = [...values].filter(x => x !== null && !isNaN(x)).sort((a, b) => a - b);
    if (v === null || isNaN(v)) return 50;
    const rank = sorted.filter(x => x <= v).length;
    return Math.round((rank / sorted.length) * 100);
  };

  const pop85Values = markets.map(m => m.pop_85_plus);
  const growthValues = markets.map(m => m.growth_rate_65);
  const hospicePerCapValues = markets.map(m => m.hospice_per_100k);
  const forProfitPctValues = markets.map(m => m.hospice_for_profit_pct);
  const ltBedsPerCapValues = markets.map(m => m.snf_lt_beds_per_100k);
  const alfPerCapValues = markets.map(m => m.alf_beds_per_100k);

  // Score all markets IN MEMORY
  const scores = markets
    .filter(m => mode !== 'footprint' || m.has_pennant_presence) // Filter for footprint mode
    .map(m => {
      const percentiles = {
        pop_85_plus_pctl: calcPercentile(pop85Values, m.pop_85_plus),
        growth_rate_65_pctl: calcPercentile(growthValues, m.growth_rate_65),
        hospice_per_100k_pctl: calcPercentile(hospicePerCapValues, m.hospice_per_100k),
        for_profit_pct_pctl: calcPercentile(forProfitPctValues, m.hospice_for_profit_pct),
        snf_lt_beds_per_100k_pctl: calcPercentile(ltBedsPerCapValues, m.snf_lt_beds_per_100k),
        alf_beds_per_100k_pctl: calcPercentile(alfPerCapValues, m.alf_beds_per_100k)
      };

      // Calculate component scores
      const demandScore = calculateDemandScore(m, percentiles);
      const marketOpportunityScore = calculateCompetitionScore(m, percentiles);
      const qualityGapScore = calculateQualityGapScore(m);
      const pennantSynergyScore = calculatePennantFitScore(m);
      const opportunityScore = calculateOpportunityScore(demandScore, marketOpportunityScore, qualityGapScore, pennantSynergyScore, mode);
      const grade = assignGrade(opportunityScore);

      return {
        geo_code: m.geo_code,
        geo_name: m.geo_name,
        population_65_plus: m.pop_65_plus,
        pop_65_plus: m.pop_65_plus, // Alias for frontend compatibility
        has_pennant_presence: m.has_pennant_presence,
        opportunity_score: opportunityScore,
        grade,
        demand_score: demandScore,
        market_opportunity_score: marketOpportunityScore,
        quality_gap_score: qualityGapScore,
        pennant_synergy_score: mode === 'footprint' ? pennantSynergyScore : null,
        hospice_count: m.hospice_count,
        hospice_per_100k: m.hospice_per_100k,
        pennant_alf_beds: m.pennant_alf_beds,
        ensign_lt_beds: m.ensign_lt_beds,
        pennant_hha_count: m.pennant_hha_count,
        pennant_hospice_count: m.pennant_hospice_count
      };
    });

  // Sort by opportunity score descending
  scores.sort((a, b) => b.opportunity_score - a.opportunity_score);

  console.log(`[HospiceScoring] Scored ${scores.length} markets`);
  cache.set(cacheKey, scores);
  return scores;
}

/**
 * Get summary statistics across all markets
 * @param {string} geoType - 'cbsa' or 'state'
 * @param {string} mode - 'footprint' or 'greenfield'
 * @returns {Promise<Object>} Summary with grade distribution, top markets, analysis
 */
async function getMarketScoreSummary(geoType = 'cbsa', mode = 'footprint') {
  const cacheKey = `score_summary_${geoType}_${mode}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const allScores = await scoreAllMarkets(geoType, 50000, mode);

  // Grade distribution
  const gradeDistribution = {
    A: allScores.filter(s => s.grade === 'A').length,
    B: allScores.filter(s => s.grade === 'B').length,
    C: allScores.filter(s => s.grade === 'C').length,
    D: allScores.filter(s => s.grade === 'D').length,
    F: allScores.filter(s => s.grade === 'F').length
  };

  // Top 10 markets
  const top10Markets = allScores.slice(0, 10);

  // Bottom 10 markets (least attractive)
  const bottom10Markets = allScores.slice(-10).reverse();

  // Mode-specific analysis
  let modeAnalysis;
  if (mode === 'footprint') {
    // Footprint mode: All markets have Pennant presence, analyze by synergy strength
    const highSynergy = allScores.filter(s => s.pennant_synergy_score >= 50);
    const lowSynergy = allScores.filter(s => s.pennant_synergy_score < 50);
    modeAnalysis = {
      mode: 'footprint',
      description: 'Markets where Pennant has existing ALF/HHA/Ensign presence',
      high_synergy_markets: {
        count: highSynergy.length,
        avg_score: highSynergy.length > 0
          ? Math.round(highSynergy.reduce((sum, m) => sum + m.opportunity_score, 0) / highSynergy.length * 10) / 10
          : 0,
        markets: highSynergy.slice(0, 5)
      },
      low_synergy_markets: {
        count: lowSynergy.length,
        avg_score: lowSynergy.length > 0
          ? Math.round(lowSynergy.reduce((sum, m) => sum + m.opportunity_score, 0) / lowSynergy.length * 10) / 10
          : 0,
        markets: lowSynergy.slice(0, 5)
      }
    };
  } else {
    // Greenfield mode: Analyze by market opportunity (underserved markets)
    const underserved = allScores.filter(s => s.market_opportunity_score >= 60);
    const saturated = allScores.filter(s => s.market_opportunity_score < 40);
    modeAnalysis = {
      mode: 'greenfield',
      description: 'All markets scored for new market entry (Pennant presence not required)',
      underserved_markets: {
        count: underserved.length,
        avg_score: underserved.length > 0
          ? Math.round(underserved.reduce((sum, m) => sum + m.opportunity_score, 0) / underserved.length * 10) / 10
          : 0,
        markets: underserved.slice(0, 5)
      },
      saturated_markets: {
        count: saturated.length,
        avg_score: saturated.length > 0
          ? Math.round(saturated.reduce((sum, m) => sum + m.opportunity_score, 0) / saturated.length * 10) / 10
          : 0,
        note: 'High hospice density - harder to enter'
      }
    };
  }

  const summary = {
    score_mode: mode,
    total_markets_scored: allScores.length,
    avg_opportunity_score: allScores.length > 0
      ? Math.round(allScores.reduce((sum, m) => sum + m.opportunity_score, 0) / allScores.length * 10) / 10
      : 0,
    grade_distribution: gradeDistribution,
    top_10_markets: top10Markets,
    bottom_10_markets: bottom10Markets,
    mode_analysis: modeAnalysis,
    weights: mode === 'greenfield'
      ? { demand: '40%', market_opportunity: '40%', quality_gap: '20%' }
      : { pennant_synergy: '75%', demand: '15%', quality_gap: '10%' },
    calculated_at: new Date().toISOString()
  };

  cache.set(cacheKey, summary);
  return summary;
}

/**
 * Get state long-term percentage lookup
 * @returns {Promise<Object>} State lookup with LT percentages
 */
async function getStateLongTermLookup() {
  return await calculateStateLongTermPercentages();
}

/**
 * Clear all caches
 */
function clearCache() {
  cache.clear();
}

module.exports = {
  calculateStateLongTermPercentages,
  calculateMarketMetrics,
  calculateNationalPercentiles,
  calculateDemandScore,
  calculateCompetitionScore,
  calculateQualityGapScore,
  calculatePennantFitScore,
  calculateOpportunityScore,
  assignGrade,
  scoreMarket,
  scoreAllMarkets,
  getMarketScoreSummary,
  getStateLongTermLookup,
  clearCache
};
