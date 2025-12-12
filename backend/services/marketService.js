/**
 * Market Dynamics Service
 *
 * Provides market intelligence data for the Market Dynamics tab.
 * Connects to a shared market database containing:
 * - snf_facilities: Skilled Nursing Facility data with CMS ratings
 * - alf_facilities: Assisted Living Facility data
 * - county_demographics: Population and economic data by county
 * - county_cbsa_crosswalk: Maps counties to CBSA codes
 * - cbsas: CBSA definitions and metadata
 *
 * Database Configuration:
 * - Uses MARKET_DATABASE_URL if set (for shared market database)
 * - Falls back to DATABASE_URL (for unified local development)
 * - Local default: postgresql://localhost:5432/snf_platform
 */

const { Pool } = require('pg');

// Database connection configuration for market data
// Prioritizes MARKET_DATABASE_URL for shared market database
// Falls back to DATABASE_URL or local default
const getPool = () => {
  const connectionString = process.env.MARKET_DATABASE_URL ||
                          process.env.DATABASE_URL ||
                          'postgresql://localhost:5432/snf_platform';
  const isProduction = connectionString.includes('render.com');

  return new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });
};

// Reusable pool instance
let pool = null;

const getPoolInstance = () => {
  if (!pool) {
    pool = getPool();
  }
  return pool;
};

/**
 * Haversine distance calculation in SQL for PostgreSQL
 * Returns distance in miles between two points
 */
const HAVERSINE_SQL = `
  3959 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians($1)) * cos(radians(latitude)) *
      cos(radians(longitude) - radians($2)) +
      sin(radians($1)) * sin(radians(latitude))
    ))
  )
`;

/**
 * Get CBSA (market) demographics by aggregating all counties in the CBSA
 *
 * @param {string} state - State code (2 letters)
 * @param {string} county - County name (used to look up CBSA)
 * @returns {Promise<Object>} Market-level demographics data
 */
async function getMarketDemographics(state, county) {
  const pool = getPoolInstance();

  try {
    // Clean up county name - remove "County" suffix if present
    const countyClean = county.replace(/\s+county$/i, '').trim();

    // Step 1: Find the county FIPS code
    let countyFipsResult = await pool.query(`
      SELECT county_fips
      FROM county_demographics
      WHERE UPPER(state_code) = UPPER($1)
        AND (
          UPPER(county_name) = UPPER($2) OR
          UPPER(county_name) = UPPER($3) OR
          UPPER(county_name) = UPPER($4)
        )
      LIMIT 1
    `, [state, county, countyClean, `${countyClean} County`]);

    if (countyFipsResult.rows.length === 0) {
      // Fallback to partial match
      countyFipsResult = await pool.query(`
        SELECT county_fips
        FROM county_demographics
        WHERE UPPER(state_code) = UPPER($1)
          AND UPPER(county_name) ~ ('^' || UPPER($2) || '( County)?$')
        LIMIT 1
      `, [state, countyClean]);
    }

    if (countyFipsResult.rows.length === 0) {
      console.log(`[MarketService] No county found for ${county}, ${state}`);
      return null;
    }

    const countyFips = countyFipsResult.rows[0].county_fips;

    // Step 2: Look up the CBSA this county belongs to
    const cbsaResult = await pool.query(`
      SELECT cbsa_code, cbsa_title
      FROM county_cbsa_crosswalk
      WHERE county_fips = $1
    `, [countyFips]);

    // If county is not in a CBSA (rural), fall back to single county
    if (cbsaResult.rows.length === 0 || !cbsaResult.rows[0].cbsa_code) {
      console.log(`[MarketService] County ${countyFips} not in a CBSA, using single county`);
      const singleCountyData = await getDemographics(state, county);
      if (singleCountyData) {
        singleCountyData.marketType = 'rural';
        singleCountyData.marketName = `${singleCountyData.countyName}, ${singleCountyData.stateCode}`;
        singleCountyData.countyCount = 1;
        singleCountyData.counties = [{
          countyFips: singleCountyData.countyFips,
          countyName: singleCountyData.countyName,
          stateCode: singleCountyData.stateCode
        }];
      }
      return singleCountyData;
    }

    const cbsaCode = cbsaResult.rows[0].cbsa_code;
    const cbsaTitle = cbsaResult.rows[0].cbsa_title;

    // Step 3: Get all counties in the CBSA
    const cbsaCountiesResult = await pool.query(`
      SELECT county_fips, county_name, state_code, is_central_county
      FROM county_cbsa_crosswalk
      WHERE cbsa_code = $1
      ORDER BY is_central_county DESC, state_code, county_name
    `, [cbsaCode]);

    const cbsaCountyFips = cbsaCountiesResult.rows.map(r => r.county_fips);

    // Step 4: Aggregate demographics for all counties in the CBSA
    const aggregateResult = await pool.query(`
      SELECT
        COUNT(*) as county_count,
        SUM(total_population) as total_population,
        SUM(population_65_plus) as population_65_plus,
        SUM(population_85_plus) as population_85_plus,
        SUM(projected_65_plus_2030) as projected_65_plus_2030,
        SUM(projected_85_plus_2030) as projected_85_plus_2030,
        SUM(total_al_need) as total_al_need,
        -- Weighted averages (by population)
        SUM(median_household_income * total_population) / NULLIF(SUM(total_population), 0) as weighted_median_income,
        SUM(median_home_value * total_population) / NULLIF(SUM(total_population), 0) as weighted_median_home_value,
        SUM(homeownership_rate * total_population) / NULLIF(SUM(total_population), 0) as weighted_homeownership_rate,
        SUM(poverty_rate * total_population) / NULLIF(SUM(total_population), 0) as weighted_poverty_rate,
        SUM(unemployment_rate * total_population) / NULLIF(SUM(total_population), 0) as weighted_unemployment_rate,
        SUM(college_education_rate * total_population) / NULLIF(SUM(total_population), 0) as weighted_college_rate,
        SUM(less_than_hs_rate * total_population) / NULLIF(SUM(total_population), 0) as weighted_less_than_hs_rate,
        SUM(median_age * total_population) / NULLIF(SUM(total_population), 0) as weighted_median_age
      FROM county_demographics
      WHERE county_fips = ANY($1)
    `, [cbsaCountyFips]);

    const agg = aggregateResult.rows[0];

    // Calculate percentages and growth rates
    const totalPop = parseInt(agg.total_population) || 0;
    const pop65Plus = parseInt(agg.population_65_plus) || 0;
    const pop85Plus = parseInt(agg.population_85_plus) || 0;
    const projected65Plus2030 = parseInt(agg.projected_65_plus_2030) || 0;
    const projected85Plus2030 = parseInt(agg.projected_85_plus_2030) || 0;

    const percent65Plus = totalPop > 0 ? (pop65Plus / totalPop) * 100 : 0;
    const percent85Plus = totalPop > 0 ? (pop85Plus / totalPop) * 100 : 0;
    const growthRate65Plus = pop65Plus > 0 ? ((projected65Plus2030 - pop65Plus) / pop65Plus) * 100 : 0;
    const growthRate85Plus = pop85Plus > 0 ? ((projected85Plus2030 - pop85Plus) / pop85Plus) * 100 : 0;

    // Get CBSA type (Metropolitan/Micropolitan)
    const cbsaTypeResult = await pool.query(`
      SELECT cbsa_type FROM cbsas WHERE cbsa_code = $1
    `, [cbsaCode]);
    const cbsaType = cbsaTypeResult.rows.length > 0 ? cbsaTypeResult.rows[0].cbsa_type : 'Unknown';

    return {
      marketType: cbsaType === 'Metropolitan' ? 'metro' : 'micro',
      marketName: cbsaTitle,
      cbsaCode: cbsaCode,
      cbsaType: cbsaType,
      countyCount: parseInt(agg.county_count) || 0,
      counties: cbsaCountiesResult.rows.map(r => ({
        countyFips: r.county_fips,
        countyName: r.county_name,
        stateCode: r.state_code,
        isCentralCounty: r.is_central_county
      })),
      // The original county that was looked up
      sourceCounty: {
        countyFips: countyFips,
        countyName: county,
        stateCode: state
      },
      population: {
        total: totalPop,
        age65Plus: pop65Plus,
        age85Plus: pop85Plus,
        percent65Plus: percent65Plus.toFixed(1),
        percent85Plus: percent85Plus.toFixed(2)
      },
      projections: {
        age65Plus2030: projected65Plus2030,
        age85Plus2030: projected85Plus2030,
        growthRate65Plus: growthRate65Plus.toFixed(2),
        growthRate85Plus: growthRate85Plus.toFixed(2)
      },
      economics: {
        medianHouseholdIncome: Math.round(parseFloat(agg.weighted_median_income)) || null,
        medianHomeValue: Math.round(parseFloat(agg.weighted_median_home_value)) || null,
        homeownershipRate: parseFloat(agg.weighted_homeownership_rate)?.toFixed(1) || null,
        povertyRate: parseFloat(agg.weighted_poverty_rate)?.toFixed(1) || null,
        unemploymentRate: parseFloat(agg.weighted_unemployment_rate)?.toFixed(1) || null
      },
      education: {
        collegeRate: parseFloat(agg.weighted_college_rate)?.toFixed(1) || null,
        lessThanHsRate: parseFloat(agg.weighted_less_than_hs_rate)?.toFixed(1) || null
      },
      medianAge: parseFloat(agg.weighted_median_age)?.toFixed(1) || null,
      totalAlNeed: parseInt(agg.total_al_need) || null
    };
  } catch (error) {
    console.error('[MarketService] getMarketDemographics error:', error);
    throw error;
  }
}

/**
 * Get county demographics data (single county - legacy)
 *
 * @param {string} state - State code (2 letters)
 * @param {string} county - County name
 * @returns {Promise<Object>} Demographics data
 */
async function getDemographics(state, county) {
  const pool = getPoolInstance();

  try {
    // Clean up county name - remove "County" suffix if present
    const countyClean = county.replace(/\s+county$/i, '').trim();

    // First try exact match (with and without " County" suffix)
    let result = await pool.query(`
      SELECT
        county_fips,
        county_name,
        state_code,
        state_name,
        total_population,
        population_65_plus,
        population_85_plus,
        percent_65_plus,
        percent_85_plus,
        projected_65_plus_2030,
        projected_85_plus_2030,
        growth_rate_65_plus,
        growth_rate_85_plus,
        median_household_income,
        median_home_value,
        homeownership_rate,
        poverty_rate,
        unemployment_rate,
        college_education_rate,
        less_than_hs_rate,
        median_age,
        total_al_need
      FROM county_demographics
      WHERE UPPER(state_code) = UPPER($1)
        AND (
          UPPER(county_name) = UPPER($2) OR
          UPPER(county_name) = UPPER($3) OR
          UPPER(county_name) = UPPER($4)
        )
      LIMIT 1
    `, [state, county, countyClean, `${countyClean} County`]);

    if (result.rows.length === 0) {
      // Fallback: try partial match but require word boundary (county name starts with the search term)
      // Use more restrictive matching to avoid Ada matching Adams
      result = await pool.query(`
        SELECT *
        FROM county_demographics
        WHERE UPPER(state_code) = UPPER($1)
          AND (
            UPPER(county_name) = UPPER($2 || ' County') OR
            UPPER(county_name) ~ ('^' || UPPER($2) || '( County)?$')
          )
        LIMIT 1
      `, [state, countyClean]);
    }

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      countyFips: row.county_fips,
      countyName: row.county_name,
      stateCode: row.state_code,
      stateName: row.state_name,
      population: {
        total: row.total_population,
        age65Plus: row.population_65_plus,
        age85Plus: row.population_85_plus,
        percent65Plus: row.percent_65_plus,
        percent85Plus: row.percent_85_plus
      },
      projections: {
        age65Plus2030: row.projected_65_plus_2030,
        age85Plus2030: row.projected_85_plus_2030,
        growthRate65Plus: row.growth_rate_65_plus,
        growthRate85Plus: row.growth_rate_85_plus
      },
      economics: {
        medianHouseholdIncome: row.median_household_income,
        medianHomeValue: row.median_home_value,
        homeownershipRate: row.homeownership_rate,
        povertyRate: row.poverty_rate,
        unemploymentRate: row.unemployment_rate
      },
      education: {
        collegeRate: row.college_education_rate,
        lessThanHsRate: row.less_than_hs_rate
      },
      medianAge: row.median_age,
      totalAlNeed: row.total_al_need
    };
  } catch (error) {
    console.error('[MarketService] getDemographics error:', error);
    throw error;
  }
}

/**
 * Get competitors within a radius of a location
 *
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radiusMiles - Search radius in miles
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {number} limit - Maximum results to return
 * @param {number} excludeFacilityId - Optional facility ID to exclude (the subject facility)
 * @returns {Promise<Array>} Array of competitor facilities
 */
async function getCompetitors(latitude, longitude, radiusMiles = 25, facilityType = 'SNF', limit = 50, excludeFacilityId = null) {
  const pool = getPoolInstance();

  try {
    if (facilityType === 'SNF') {
      // Query snf_facilities table
      let query = `
        SELECT
          id,
          federal_provider_number,
          facility_name,
          address,
          city,
          state,
          zip_code,
          county,
          latitude,
          longitude,
          total_beds,
          certified_beds,
          occupied_beds,
          occupancy_rate,
          overall_rating,
          health_inspection_rating,
          quality_measure_rating,
          staffing_rating,
          health_deficiencies,
          fire_safety_deficiencies,
          total_penalties_amount,
          special_focus_facility,
          ownership_type,
          parent_organization,
          multi_facility_chain,
          average_daily_rate,
          medicare_rate,
          medicaid_rate,
          ${HAVERSINE_SQL} AS distance_miles
        FROM snf_facilities
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND ${HAVERSINE_SQL} <= $3
      `;

      const params = [latitude, longitude, radiusMiles];

      if (excludeFacilityId) {
        query += ` AND id != $4`;
        params.push(excludeFacilityId);
      }

      query += ` ORDER BY distance_miles LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        federalProviderNumber: row.federal_provider_number,
        facilityName: row.facility_name,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        county: row.county,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        distanceMiles: parseFloat(row.distance_miles).toFixed(2),
        // SNF-specific fields
        beds: {
          total: row.total_beds,
          certified: row.certified_beds,
          occupied: row.occupied_beds
        },
        occupancyRate: row.occupancy_rate,
        ratings: {
          overall: row.overall_rating,
          healthInspection: row.health_inspection_rating,
          qualityMeasure: row.quality_measure_rating,
          staffing: row.staffing_rating
        },
        deficiencies: {
          health: row.health_deficiencies,
          fireSafety: row.fire_safety_deficiencies
        },
        totalPenalties: row.total_penalties_amount,
        specialFocusFacility: row.special_focus_facility,
        ownership: {
          type: row.ownership_type,
          parentOrganization: row.parent_organization,
          isChain: row.multi_facility_chain
        },
        rates: {
          averageDaily: row.average_daily_rate,
          medicare: row.medicare_rate,
          medicaid: row.medicaid_rate
        }
      }));

    } else {
      // Query alf_facilities table
      let query = `
        SELECT
          id,
          facility_name,
          address,
          city,
          state,
          zip_code,
          county,
          county_fips,
          latitude,
          longitude,
          capacity,
          ownership_type,
          licensee,
          ${HAVERSINE_SQL} AS distance_miles
        FROM alf_facilities
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND ${HAVERSINE_SQL} <= $3
      `;

      const params = [latitude, longitude, radiusMiles];

      if (excludeFacilityId) {
        query += ` AND id != $4`;
        params.push(excludeFacilityId);
      }

      query += ` ORDER BY distance_miles LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        facilityName: row.facility_name,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        county: row.county,
        countyFips: row.county_fips,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        distanceMiles: parseFloat(row.distance_miles).toFixed(2),
        // ALF-specific fields
        capacity: row.capacity,
        ownership: {
          type: row.ownership_type,
          licensee: row.licensee
        }
      }));
    }
  } catch (error) {
    console.error('[MarketService] getCompetitors error:', error);
    throw error;
  }
}

/**
 * Get supply summary statistics for a county
 *
 * @param {string} countyFips - County FIPS code
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {string} state - State code (fallback if no FIPS)
 * @param {string} county - County name (fallback if no FIPS)
 * @returns {Promise<Object>} Supply statistics
 */
async function getSupplySummary(countyFips, facilityType = 'SNF', state = null, county = null) {
  const pool = getPoolInstance();

  try {
    if (facilityType === 'SNF') {
      let query;
      let params;

      if (countyFips) {
        query = `
          SELECT
            COUNT(*) as facility_count,
            SUM(total_beds) as total_beds,
            SUM(certified_beds) as certified_beds,
            SUM(occupied_beds) as occupied_beds,
            AVG(occupancy_rate) as avg_occupancy,
            AVG(overall_rating) as avg_rating,
            AVG(average_daily_rate) as avg_daily_rate,
            SUM(CASE WHEN special_focus_facility = true THEN 1 ELSE 0 END) as special_focus_count,
            COUNT(DISTINCT parent_organization) as unique_operators
          FROM snf_facilities
          WHERE county_fips = $1
        `;
        params = [countyFips];
      } else if (state && county) {
        query = `
          SELECT
            COUNT(*) as facility_count,
            SUM(total_beds) as total_beds,
            SUM(certified_beds) as certified_beds,
            SUM(occupied_beds) as occupied_beds,
            AVG(occupancy_rate) as avg_occupancy,
            AVG(overall_rating) as avg_rating,
            AVG(average_daily_rate) as avg_daily_rate,
            SUM(CASE WHEN special_focus_facility = true THEN 1 ELSE 0 END) as special_focus_count,
            COUNT(DISTINCT parent_organization) as unique_operators
          FROM snf_facilities
          WHERE UPPER(state) = UPPER($1)
            AND UPPER(county) LIKE UPPER($2)
        `;
        params = [state, `%${county.replace(/\s+county$/i, '')}%`];
      } else {
        throw new Error('Either countyFips or state+county required');
      }

      const result = await pool.query(query, params);
      const row = result.rows[0];

      // Get rating distribution
      const ratingQuery = countyFips
        ? `SELECT overall_rating, COUNT(*) as count FROM snf_facilities WHERE county_fips = $1 AND overall_rating IS NOT NULL GROUP BY overall_rating ORDER BY overall_rating`
        : `SELECT overall_rating, COUNT(*) as count FROM snf_facilities WHERE UPPER(state) = UPPER($1) AND UPPER(county) LIKE UPPER($2) AND overall_rating IS NOT NULL GROUP BY overall_rating ORDER BY overall_rating`;

      const ratingResult = await pool.query(ratingQuery, params);
      const ratingDistribution = {};
      ratingResult.rows.forEach(r => {
        ratingDistribution[`star${r.overall_rating}`] = parseInt(r.count);
      });

      return {
        facilityCount: parseInt(row.facility_count) || 0,
        beds: {
          total: parseInt(row.total_beds) || 0,
          certified: parseInt(row.certified_beds) || 0,
          occupied: parseInt(row.occupied_beds) || 0
        },
        avgOccupancy: row.avg_occupancy ? parseFloat(row.avg_occupancy).toFixed(1) : null,
        avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : null,
        avgDailyRate: row.avg_daily_rate ? parseFloat(row.avg_daily_rate).toFixed(2) : null,
        specialFocusCount: parseInt(row.special_focus_count) || 0,
        uniqueOperators: parseInt(row.unique_operators) || 0,
        ratingDistribution
      };

    } else {
      // ALF supply summary
      let query;
      let params;

      if (countyFips) {
        query = `
          SELECT
            COUNT(*) as facility_count,
            SUM(capacity) as total_capacity,
            AVG(capacity) as avg_capacity,
            COUNT(DISTINCT ownership_type) as ownership_types,
            COUNT(DISTINCT licensee) as unique_operators
          FROM alf_facilities
          WHERE county_fips = $1
        `;
        params = [countyFips];
      } else if (state && county) {
        query = `
          SELECT
            COUNT(*) as facility_count,
            SUM(capacity) as total_capacity,
            AVG(capacity) as avg_capacity,
            COUNT(DISTINCT ownership_type) as ownership_types,
            COUNT(DISTINCT licensee) as unique_operators
          FROM alf_facilities
          WHERE UPPER(state) = UPPER($1)
            AND UPPER(county) LIKE UPPER($2)
        `;
        params = [state, `%${county.replace(/\s+county$/i, '')}%`];
      } else {
        throw new Error('Either countyFips or state+county required');
      }

      const result = await pool.query(query, params);
      const row = result.rows[0];

      return {
        facilityCount: parseInt(row.facility_count) || 0,
        totalCapacity: parseInt(row.total_capacity) || 0,
        avgCapacity: row.avg_capacity ? parseFloat(row.avg_capacity).toFixed(1) : null,
        ownershipTypes: parseInt(row.ownership_types) || 0,
        uniqueOperators: parseInt(row.unique_operators) || 0
      };
    }
  } catch (error) {
    console.error('[MarketService] getSupplySummary error:', error);
    throw error;
  }
}

/**
 * Get detailed facility information
 *
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {number} facilityId - Facility ID in the database
 * @returns {Promise<Object>} Facility details
 */
async function getFacilityDetail(facilityType, facilityId) {
  const pool = getPoolInstance();

  try {
    if (facilityType === 'SNF') {
      const result = await pool.query(`
        SELECT
          id,
          federal_provider_number,
          facility_name,
          address,
          city,
          state,
          zip_code,
          county,
          county_fips,
          phone_number,
          latitude,
          longitude,
          total_beds,
          certified_beds,
          occupied_beds,
          occupancy_rate,
          overall_rating,
          health_inspection_rating,
          quality_measure_rating,
          staffing_rating,
          health_deficiencies,
          fire_safety_deficiencies,
          total_penalties_amount,
          special_focus_facility,
          ownership_type,
          parent_organization,
          multi_facility_chain,
          average_daily_rate,
          medicare_rate,
          medicaid_rate,
          accepts_medicare,
          accepts_medicaid,
          active
        FROM snf_facilities
        WHERE id = $1
      `, [facilityId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        federalProviderNumber: row.federal_provider_number,
        facilityName: row.facility_name,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        county: row.county,
        countyFips: row.county_fips,
        phoneNumber: row.phone_number,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        beds: {
          total: row.total_beds,
          certified: row.certified_beds,
          occupied: row.occupied_beds
        },
        occupancyRate: row.occupancy_rate,
        ratings: {
          overall: row.overall_rating,
          healthInspection: row.health_inspection_rating,
          qualityMeasure: row.quality_measure_rating,
          staffing: row.staffing_rating
        },
        deficiencies: {
          health: row.health_deficiencies,
          fireSafety: row.fire_safety_deficiencies
        },
        totalPenalties: row.total_penalties_amount,
        specialFocusFacility: row.special_focus_facility,
        ownership: {
          type: row.ownership_type,
          parentOrganization: row.parent_organization,
          isChain: row.multi_facility_chain
        },
        rates: {
          averageDaily: row.average_daily_rate,
          medicare: row.medicare_rate,
          medicaid: row.medicaid_rate
        },
        acceptsMedicare: row.accepts_medicare,
        acceptsMedicaid: row.accepts_medicaid,
        active: row.active
      };

    } else {
      const result = await pool.query(`
        SELECT
          id,
          facility_name,
          address,
          city,
          state,
          zip_code,
          county,
          county_fips,
          latitude,
          longitude,
          capacity,
          ownership_type,
          licensee
        FROM alf_facilities
        WHERE id = $1
      `, [facilityId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        facilityName: row.facility_name,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        county: row.county,
        countyFips: row.county_fips,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        capacity: row.capacity,
        ownership: {
          type: row.ownership_type,
          licensee: row.licensee
        }
      };
    }
  } catch (error) {
    console.error('[MarketService] getFacilityDetail error:', error);
    throw error;
  }
}

/**
 * Get market metrics for a specific location
 * Uses CBSA-level demographics (aggregating all counties in the market)
 * Combines demographics + supply data for scorecard display
 *
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Object>} Combined market metrics
 */
async function getMarketMetrics(state, county, facilityType = 'SNF') {
  try {
    // Use CBSA-level demographics for market-wide view
    const demographics = await getMarketDemographics(state, county);

    if (!demographics) {
      return null;
    }

    // Get supply data for either the CBSA counties or single county
    let supply;
    if (demographics.counties && demographics.counties.length > 1) {
      // Aggregate supply across all CBSA counties
      supply = await getSupplySummaryForCBSA(demographics.counties.map(c => c.countyFips), facilityType);
    } else {
      // Single county (rural area)
      supply = await getSupplySummary(null, facilityType, state, county);
    }

    // Calculate derived metrics for 65+
    const pop65Plus = parseInt(demographics.population.age65Plus) || 0;
    const pop85Plus = parseInt(demographics.population.age85Plus) || 0;

    const bedsPerThousand65Plus = pop65Plus && supply.beds?.total
      ? ((supply.beds.total / pop65Plus) * 1000).toFixed(2)
      : null;

    const bedsPerThousand85Plus = pop85Plus && supply.beds?.total
      ? ((supply.beds.total / pop85Plus) * 1000).toFixed(2)
      : null;

    const capacityPerThousand65Plus = pop65Plus && supply.totalCapacity
      ? ((supply.totalCapacity / pop65Plus) * 1000).toFixed(2)
      : null;

    const capacityPerThousand85Plus = pop85Plus && supply.totalCapacity
      ? ((supply.totalCapacity / pop85Plus) * 1000).toFixed(2)
      : null;

    return {
      demographics,
      supply,
      metrics: {
        bedsPerThousand65Plus: facilityType === 'SNF' ? bedsPerThousand65Plus : null,
        bedsPerThousand85Plus: facilityType === 'SNF' ? bedsPerThousand85Plus : null,
        capacityPerThousand65Plus: facilityType === 'ALF' ? capacityPerThousand65Plus : null,
        capacityPerThousand85Plus: facilityType === 'ALF' ? capacityPerThousand85Plus : null,
        marketCompetition: supply.uniqueOperators > 5 ? 'High' : supply.uniqueOperators > 2 ? 'Medium' : 'Low',
        growthOutlook: parseFloat(demographics.projections.growthRate65Plus) > 15 ? 'Strong' : parseFloat(demographics.projections.growthRate65Plus) > 8 ? 'Moderate' : 'Slow'
      }
    };
  } catch (error) {
    console.error('[MarketService] getMarketMetrics error:', error);
    throw error;
  }
}

/**
 * Get supply summary statistics for multiple counties (CBSA)
 *
 * @param {string[]} countyFipsList - Array of county FIPS codes
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Object>} Aggregated supply statistics
 */
async function getSupplySummaryForCBSA(countyFipsList, facilityType = 'SNF') {
  const pool = getPoolInstance();

  try {
    if (facilityType === 'SNF') {
      const query = `
        SELECT
          COUNT(*) as facility_count,
          SUM(total_beds) as total_beds,
          SUM(certified_beds) as certified_beds,
          SUM(occupied_beds) as occupied_beds,
          AVG(occupancy_rate) as avg_occupancy,
          AVG(overall_rating) as avg_rating,
          AVG(average_daily_rate) as avg_daily_rate,
          SUM(CASE WHEN special_focus_facility = true THEN 1 ELSE 0 END) as special_focus_count,
          COUNT(DISTINCT parent_organization) as unique_operators
        FROM snf_facilities
        WHERE county_fips = ANY($1)
      `;

      const result = await pool.query(query, [countyFipsList]);
      const row = result.rows[0];

      // Get rating distribution
      const ratingResult = await pool.query(`
        SELECT overall_rating, COUNT(*) as count
        FROM snf_facilities
        WHERE county_fips = ANY($1) AND overall_rating IS NOT NULL
        GROUP BY overall_rating
        ORDER BY overall_rating
      `, [countyFipsList]);

      const ratingDistribution = {};
      ratingResult.rows.forEach(r => {
        ratingDistribution[`star${r.overall_rating}`] = parseInt(r.count);
      });

      return {
        facilityCount: parseInt(row.facility_count) || 0,
        beds: {
          total: parseInt(row.total_beds) || 0,
          certified: parseInt(row.certified_beds) || 0,
          occupied: parseInt(row.occupied_beds) || 0
        },
        avgOccupancy: row.avg_occupancy ? parseFloat(row.avg_occupancy).toFixed(1) : null,
        avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : null,
        avgDailyRate: row.avg_daily_rate ? parseFloat(row.avg_daily_rate).toFixed(2) : null,
        specialFocusCount: parseInt(row.special_focus_count) || 0,
        uniqueOperators: parseInt(row.unique_operators) || 0,
        ratingDistribution
      };

    } else {
      // ALF supply summary
      const query = `
        SELECT
          COUNT(*) as facility_count,
          SUM(capacity) as total_capacity,
          AVG(capacity) as avg_capacity,
          COUNT(DISTINCT ownership_type) as ownership_types,
          COUNT(DISTINCT licensee) as unique_operators
        FROM alf_facilities
        WHERE county_fips = ANY($1)
      `;

      const result = await pool.query(query, [countyFipsList]);
      const row = result.rows[0];

      return {
        facilityCount: parseInt(row.facility_count) || 0,
        totalCapacity: parseInt(row.total_capacity) || 0,
        avgCapacity: row.avg_capacity ? parseFloat(row.avg_capacity).toFixed(1) : null,
        ownershipTypes: parseInt(row.ownership_types) || 0,
        uniqueOperators: parseInt(row.unique_operators) || 0
      };
    }
  } catch (error) {
    console.error('[MarketService] getSupplySummaryForCBSA error:', error);
    throw error;
  }
}

/**
 * Get list of all states with facility counts
 *
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Array>} Array of states with counts
 */
async function getStates(facilityType = 'SNF') {
  const pool = getPoolInstance();

  try {
    const table = facilityType === 'ALF' ? 'alf_facilities' : 'snf_facilities';
    const capacityField = facilityType === 'ALF' ? 'SUM(capacity)' : 'SUM(total_beds)';

    const result = await pool.query(`
      SELECT
        state,
        COUNT(*) as facility_count,
        ${capacityField} as total_capacity
      FROM ${table}
      WHERE state IS NOT NULL AND state != ''
      GROUP BY state
      ORDER BY state
    `);

    return result.rows.map(row => ({
      stateCode: row.state,
      facilityCount: parseInt(row.facility_count) || 0,
      totalCapacity: parseInt(row.total_capacity) || 0
    }));
  } catch (error) {
    console.error('[MarketService] getStates error:', error);
    throw error;
  }
}

/**
 * Get counties for a state with facility counts
 *
 * @param {string} state - State code (2 letters)
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Array>} Array of counties with counts
 */
async function getCounties(state, facilityType = 'SNF') {
  const pool = getPoolInstance();

  try {
    const table = facilityType === 'ALF' ? 'alf_facilities' : 'snf_facilities';
    const capacityField = facilityType === 'ALF' ? 'SUM(capacity)' : 'SUM(total_beds)';
    const avgRatingField = facilityType === 'SNF' ? ', AVG(overall_rating) as avg_rating' : '';

    const result = await pool.query(`
      SELECT
        county,
        COUNT(*) as facility_count,
        ${capacityField} as total_capacity
        ${avgRatingField}
      FROM ${table}
      WHERE UPPER(state) = UPPER($1)
        AND county IS NOT NULL AND county != ''
      GROUP BY county
      ORDER BY county
    `, [state]);

    return result.rows.map(row => ({
      countyName: row.county,
      facilityCount: parseInt(row.facility_count) || 0,
      totalCapacity: parseInt(row.total_capacity) || 0,
      avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : null
    }));
  } catch (error) {
    console.error('[MarketService] getCounties error:', error);
    throw error;
  }
}

/**
 * Search facilities by name (for autocomplete)
 *
 * @param {string} query - Search query
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Array of matching facilities
 */
async function searchFacilities(query, facilityType = 'SNF', limit = 20) {
  const pool = getPoolInstance();

  try {
    if (!query || query.length < 2) {
      return [];
    }

    if (facilityType === 'SNF') {
      const result = await pool.query(`
        SELECT
          id,
          facility_name,
          city,
          state,
          county,
          latitude,
          longitude,
          total_beds,
          overall_rating
        FROM snf_facilities
        WHERE LOWER(facility_name) LIKE LOWER($1)
        ORDER BY facility_name
        LIMIT $2
      `, [`%${query}%`, limit]);

      return result.rows.map(row => ({
        id: row.id,
        facilityName: row.facility_name,
        city: row.city,
        state: row.state,
        county: row.county,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        beds: row.total_beds,
        rating: row.overall_rating
      }));
    } else {
      const result = await pool.query(`
        SELECT
          id,
          facility_name,
          city,
          state,
          county,
          latitude,
          longitude,
          capacity
        FROM alf_facilities
        WHERE LOWER(facility_name) LIKE LOWER($1)
        ORDER BY facility_name
        LIMIT $2
      `, [`%${query}%`, limit]);

      return result.rows.map(row => ({
        id: row.id,
        facilityName: row.facility_name,
        city: row.city,
        state: row.state,
        county: row.county,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        capacity: row.capacity
      }));
    }
  } catch (error) {
    console.error('[MarketService] searchFacilities error:', error);
    throw error;
  }
}

/**
 * Get national benchmark statistics
 *
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Object>} National benchmark statistics
 */
async function getNationalBenchmarks(facilityType = 'SNF') {
  const pool = getPoolInstance();

  try {
    // Get total national population 65+ and 85+
    const popResult = await pool.query(`
      SELECT
        SUM(population_65_plus) as total_65_plus,
        SUM(population_85_plus) as total_85_plus,
        SUM(total_population) as total_population
      FROM state_demographics
    `);

    const pop = popResult.rows[0];
    const total65Plus = parseInt(pop.total_65_plus) || 0;
    const total85Plus = parseInt(pop.total_85_plus) || 0;

    if (facilityType === 'SNF') {
      // Get total national SNF beds
      const bedsResult = await pool.query(`
        SELECT
          SUM(total_beds) as total_beds,
          COUNT(*) as facility_count,
          AVG(overall_rating) as avg_rating,
          AVG(occupancy_rate) as avg_occupancy
        FROM snf_facilities
      `);

      const beds = bedsResult.rows[0];
      const totalBeds = parseInt(beds.total_beds) || 0;

      return {
        facilityType: 'SNF',
        population: {
          total65Plus,
          total85Plus
        },
        supply: {
          totalFacilities: parseInt(beds.facility_count) || 0,
          totalBeds,
          avgRating: beds.avg_rating ? parseFloat(beds.avg_rating).toFixed(2) : null,
          avgOccupancy: beds.avg_occupancy ? parseFloat(beds.avg_occupancy).toFixed(1) : null
        },
        benchmarks: {
          bedsPerThousand65Plus: total65Plus > 0 ? ((totalBeds / total65Plus) * 1000).toFixed(2) : null,
          bedsPerThousand85Plus: total85Plus > 0 ? ((totalBeds / total85Plus) * 1000).toFixed(2) : null
        }
      };
    } else {
      // Get total national ALF capacity
      const capacityResult = await pool.query(`
        SELECT
          SUM(capacity) as total_capacity,
          COUNT(*) as facility_count
        FROM alf_facilities
      `);

      const capacity = capacityResult.rows[0];
      const totalCapacity = parseInt(capacity.total_capacity) || 0;

      return {
        facilityType: 'ALF',
        population: {
          total65Plus,
          total85Plus
        },
        supply: {
          totalFacilities: parseInt(capacity.facility_count) || 0,
          totalCapacity
        },
        benchmarks: {
          capacityPerThousand65Plus: total65Plus > 0 ? ((totalCapacity / total65Plus) * 1000).toFixed(2) : null,
          capacityPerThousand85Plus: total85Plus > 0 ? ((totalCapacity / total85Plus) * 1000).toFixed(2) : null
        }
      };
    }
  } catch (error) {
    console.error('[MarketService] getNationalBenchmarks error:', error);
    throw error;
  }
}

/**
 * Get state-level summary statistics
 *
 * @param {string} state - State code (2 letters)
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Object>} State summary statistics
 */
async function getStateSummary(state, facilityType = 'SNF') {
  const pool = getPoolInstance();

  try {
    // Get state demographics
    const demoResult = await pool.query(`
      SELECT
        population_65_plus,
        population_85_plus,
        total_population,
        percent_65_plus,
        percent_85_plus,
        projected_65_plus_2030,
        projected_85_plus_2030,
        growth_rate_65_plus,
        growth_rate_85_plus
      FROM state_demographics
      WHERE UPPER(state_code) = UPPER($1)
    `, [state]);

    const demo = demoResult.rows[0] || {};
    const pop65Plus = parseInt(demo.population_65_plus) || 0;
    const pop85Plus = parseInt(demo.population_85_plus) || 0;

    if (facilityType === 'SNF') {
      // Get overall state stats
      const statsResult = await pool.query(`
        SELECT
          COUNT(*) as facility_count,
          SUM(total_beds) as total_beds,
          SUM(certified_beds) as certified_beds,
          SUM(occupied_beds) as occupied_beds,
          AVG(occupancy_rate) as avg_occupancy,
          AVG(overall_rating) as avg_rating,
          AVG(average_daily_rate) as avg_daily_rate,
          SUM(CASE WHEN special_focus_facility = true THEN 1 ELSE 0 END) as special_focus_count,
          COUNT(DISTINCT parent_organization) as unique_operators,
          COUNT(DISTINCT county) as county_count
        FROM snf_facilities
        WHERE UPPER(state) = UPPER($1)
      `, [state]);

      const stats = statsResult.rows[0];
      const totalBeds = parseInt(stats.total_beds) || 0;

      // Get rating distribution
      const ratingResult = await pool.query(`
        SELECT overall_rating, COUNT(*) as count
        FROM snf_facilities
        WHERE UPPER(state) = UPPER($1) AND overall_rating IS NOT NULL
        GROUP BY overall_rating
        ORDER BY overall_rating
      `, [state]);

      const ratingDistribution = {};
      ratingResult.rows.forEach(r => {
        ratingDistribution[`star${r.overall_rating}`] = parseInt(r.count);
      });

      // Get top counties by facility count
      const countiesResult = await pool.query(`
        SELECT
          county,
          COUNT(*) as facility_count,
          SUM(total_beds) as total_beds,
          AVG(overall_rating) as avg_rating
        FROM snf_facilities
        WHERE UPPER(state) = UPPER($1) AND county IS NOT NULL
        GROUP BY county
        ORDER BY facility_count DESC
        LIMIT 10
      `, [state]);

      return {
        stateCode: state.toUpperCase(),
        facilityCount: parseInt(stats.facility_count) || 0,
        countyCount: parseInt(stats.county_count) || 0,
        beds: {
          total: totalBeds,
          certified: parseInt(stats.certified_beds) || 0,
          occupied: parseInt(stats.occupied_beds) || 0
        },
        demographics: {
          population65Plus: pop65Plus,
          population85Plus: pop85Plus,
          totalPopulation: parseInt(demo.total_population) || 0,
          percent65Plus: demo.percent_65_plus ? parseFloat(demo.percent_65_plus).toFixed(1) : null,
          percent85Plus: demo.percent_85_plus ? parseFloat(demo.percent_85_plus).toFixed(2) : null,
          projected65Plus2030: parseInt(demo.projected_65_plus_2030) || null,
          projected85Plus2030: parseInt(demo.projected_85_plus_2030) || null,
          growthRate65Plus: demo.growth_rate_65_plus ? parseFloat(demo.growth_rate_65_plus).toFixed(2) : null,
          growthRate85Plus: demo.growth_rate_85_plus ? parseFloat(demo.growth_rate_85_plus).toFixed(2) : null
        },
        metrics: {
          bedsPerThousand65Plus: pop65Plus > 0 ? ((totalBeds / pop65Plus) * 1000).toFixed(2) : null,
          bedsPerThousand85Plus: pop85Plus > 0 ? ((totalBeds / pop85Plus) * 1000).toFixed(2) : null
        },
        avgOccupancy: stats.avg_occupancy ? parseFloat(stats.avg_occupancy).toFixed(1) : null,
        avgRating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(2) : null,
        avgDailyRate: stats.avg_daily_rate ? parseFloat(stats.avg_daily_rate).toFixed(2) : null,
        specialFocusCount: parseInt(stats.special_focus_count) || 0,
        uniqueOperators: parseInt(stats.unique_operators) || 0,
        ratingDistribution,
        topCounties: countiesResult.rows.map(row => ({
          countyName: row.county,
          facilityCount: parseInt(row.facility_count) || 0,
          totalBeds: parseInt(row.total_beds) || 0,
          avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : null
        }))
      };

    } else {
      // ALF state summary
      const statsResult = await pool.query(`
        SELECT
          COUNT(*) as facility_count,
          SUM(capacity) as total_capacity,
          AVG(capacity) as avg_capacity,
          COUNT(DISTINCT ownership_type) as ownership_types,
          COUNT(DISTINCT licensee) as unique_operators,
          COUNT(DISTINCT county) as county_count
        FROM alf_facilities
        WHERE UPPER(state) = UPPER($1)
      `, [state]);

      const stats = statsResult.rows[0];
      const totalCapacity = parseInt(stats.total_capacity) || 0;

      // Get top counties by facility count
      const countiesResult = await pool.query(`
        SELECT
          county,
          COUNT(*) as facility_count,
          SUM(capacity) as total_capacity
        FROM alf_facilities
        WHERE UPPER(state) = UPPER($1) AND county IS NOT NULL
        GROUP BY county
        ORDER BY facility_count DESC
        LIMIT 10
      `, [state]);

      return {
        stateCode: state.toUpperCase(),
        facilityCount: parseInt(stats.facility_count) || 0,
        countyCount: parseInt(stats.county_count) || 0,
        totalCapacity,
        demographics: {
          population65Plus: pop65Plus,
          population85Plus: pop85Plus,
          totalPopulation: parseInt(demo.total_population) || 0,
          percent65Plus: demo.percent_65_plus ? parseFloat(demo.percent_65_plus).toFixed(1) : null,
          percent85Plus: demo.percent_85_plus ? parseFloat(demo.percent_85_plus).toFixed(2) : null,
          projected65Plus2030: parseInt(demo.projected_65_plus_2030) || null,
          projected85Plus2030: parseInt(demo.projected_85_plus_2030) || null,
          growthRate65Plus: demo.growth_rate_65_plus ? parseFloat(demo.growth_rate_65_plus).toFixed(2) : null,
          growthRate85Plus: demo.growth_rate_85_plus ? parseFloat(demo.growth_rate_85_plus).toFixed(2) : null
        },
        metrics: {
          capacityPerThousand65Plus: pop65Plus > 0 ? ((totalCapacity / pop65Plus) * 1000).toFixed(2) : null,
          capacityPerThousand85Plus: pop85Plus > 0 ? ((totalCapacity / pop85Plus) * 1000).toFixed(2) : null
        },
        avgCapacity: stats.avg_capacity ? parseFloat(stats.avg_capacity).toFixed(1) : null,
        ownershipTypes: parseInt(stats.ownership_types) || 0,
        uniqueOperators: parseInt(stats.unique_operators) || 0,
        topCounties: countiesResult.rows.map(row => ({
          countyName: row.county,
          facilityCount: parseInt(row.facility_count) || 0,
          totalCapacity: parseInt(row.total_capacity) || 0
        }))
      };
    }
  } catch (error) {
    console.error('[MarketService] getStateSummary error:', error);
    throw error;
  }
}

/**
 * Get facilities in a county (for map display without specific coordinates)
 *
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Array of facilities with coordinates
 */
async function getFacilitiesInCounty(state, county, facilityType = 'SNF', limit = 500) {
  const pool = getPoolInstance();

  // Clean up county name for matching
  const countyClean = county.replace(/\s+county$/i, '').trim();

  // Calculate date 3 years ago for deficiency filtering
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const threeYearsAgoStr = threeYearsAgo.toISOString().split('T')[0];

  try {
    if (facilityType === 'SNF') {
      // Query facilities with LEFT JOIN to count deficiencies from last 3 years
      const result = await pool.query(`
        SELECT
          f.id,
          f.federal_provider_number,
          f.facility_name,
          f.address,
          f.city,
          f.state,
          f.county,
          f.latitude,
          f.longitude,
          f.total_beds,
          f.certified_beds,
          f.occupied_beds,
          f.overall_rating,
          f.health_inspection_rating,
          f.quality_measure_rating,
          f.staffing_rating,
          f.occupancy_rate,
          f.ownership_type,
          f.provider_type,
          f.parent_organization,
          f.legal_business_name,
          f.multi_facility_chain,
          f.total_penalties_amount,
          f.penalty_count,
          f.special_focus_facility,
          f.abuse_icon,
          f.accepts_medicare,
          f.accepts_medicaid,
          COALESCE(d.deficiency_count_3yr, 0) as deficiency_count_3yr
        FROM snf_facilities f
        LEFT JOIN (
          SELECT
            federal_provider_number,
            COUNT(*) as deficiency_count_3yr
          FROM cms_facility_deficiencies
          WHERE survey_date >= $6
          GROUP BY federal_provider_number
        ) d ON f.federal_provider_number = d.federal_provider_number
        WHERE UPPER(f.state) = UPPER($1)
          AND (
            UPPER(f.county) = UPPER($2) OR
            UPPER(f.county) = UPPER($3) OR
            UPPER(f.county) LIKE UPPER($4)
          )
        ORDER BY f.total_beds DESC NULLS LAST
        LIMIT $5
      `, [state, county, countyClean, `${countyClean}%`, limit, threeYearsAgoStr]);

      return result.rows.map(row => ({
        id: row.id,
        federalProviderNumber: row.federal_provider_number,
        facilityName: row.facility_name,
        address: row.address,
        city: row.city,
        state: row.state,
        county: row.county,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        beds: {
          total: row.total_beds,
          certified: row.certified_beds,
          occupied: row.occupied_beds
        },
        ratings: {
          overall: row.overall_rating,
          healthInspection: row.health_inspection_rating,
          qualityMeasure: row.quality_measure_rating,
          staffing: row.staffing_rating
        },
        occupancyRate: row.occupancy_rate ? parseFloat(row.occupancy_rate) : null,
        ownership: {
          type: row.ownership_type,
          parentOrganization: row.parent_organization,
          legalBusinessName: row.legal_business_name,
          isChain: row.multi_facility_chain
        },
        providerType: row.provider_type,
        deficiencies: {
          // Use the 3-year count from cms_facility_deficiencies
          total: parseInt(row.deficiency_count_3yr) || 0
        },
        penalties: {
          totalAmount: row.total_penalties_amount ? parseFloat(row.total_penalties_amount) : 0,
          count: row.penalty_count || 0
        },
        flags: {
          specialFocusFacility: row.special_focus_facility,
          abuseIcon: row.abuse_icon,
          acceptsMedicare: row.accepts_medicare,
          acceptsMedicaid: row.accepts_medicaid
        }
      }));
    } else {
      const result = await pool.query(`
        SELECT
          id,
          facility_name,
          address,
          city,
          state,
          county,
          latitude,
          longitude,
          capacity,
          ownership_type,
          licensee
        FROM alf_facilities
        WHERE UPPER(state) = UPPER($1)
          AND (
            UPPER(county) = UPPER($2) OR
            UPPER(county) = UPPER($3) OR
            UPPER(county) LIKE UPPER($4)
          )
        ORDER BY capacity DESC NULLS LAST
        LIMIT $5
      `, [state, county, countyClean, `${countyClean}%`, limit]);

      return result.rows.map(row => ({
        id: row.id,
        facilityName: row.facility_name,
        address: row.address,
        city: row.city,
        state: row.state,
        county: row.county,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        capacity: row.capacity,
        ownership: {
          type: row.ownership_type,
          licensee: row.licensee
        }
      }));
    }
  } catch (error) {
    console.error('[MarketService] getFacilitiesInCounty error:', error);
    throw error;
  }
}

/**
 * Close the database connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getDemographics,
  getMarketDemographics,
  getCompetitors,
  getSupplySummary,
  getSupplySummaryForCBSA,
  getFacilityDetail,
  getMarketMetrics,
  getStates,
  getCounties,
  searchFacilities,
  getStateSummary,
  getFacilitiesInCounty,
  getNationalBenchmarks,
  closePool
};
