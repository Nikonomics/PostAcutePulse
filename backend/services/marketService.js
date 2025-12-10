/**
 * Market Dynamics Service
 *
 * Provides market intelligence data for the Market Dynamics tab.
 * Connects to the snf_news PostgreSQL database containing:
 * - snf_facilities: Skilled Nursing Facility data with CMS ratings
 * - alf_facilities: Assisted Living Facility data
 * - county_demographics: Population and economic data by county
 */

const { Pool } = require('pg');

// Database connection configuration
// Local: postgresql://localhost:5432/snf_news
// Production: Uses SNF_NEWS_DATABASE_URL environment variable
const getPool = () => {
  const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
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
 * Get county demographics data
 *
 * @param {string} state - State code (2 letters)
 * @param {string} county - County name
 * @returns {Promise<Object>} Demographics data
 */
async function getDemographics(state, county) {
  const pool = getPoolInstance();

  try {
    // First try exact match
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
        AND UPPER(county_name) LIKE UPPER($2)
      LIMIT 1
    `, [state, `%${county}%`]);

    if (result.rows.length === 0) {
      // Try with "County" suffix removed
      const countyClean = county.replace(/\s+county$/i, '').trim();
      result = await pool.query(`
        SELECT *
        FROM county_demographics
        WHERE UPPER(state_code) = UPPER($1)
          AND (
            UPPER(county_name) = UPPER($2) OR
            UPPER(county_name) = UPPER($3) OR
            UPPER(county_name) LIKE UPPER($4)
          )
        LIMIT 1
      `, [state, county, countyClean, `${countyClean}%`]);
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
 * Combines demographics + supply data for scorecard display
 *
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Object>} Combined market metrics
 */
async function getMarketMetrics(state, county, facilityType = 'SNF') {
  try {
    const [demographics, supply] = await Promise.all([
      getDemographics(state, county),
      getSupplySummary(null, facilityType, state, county)
    ]);

    if (!demographics) {
      return null;
    }

    // Calculate derived metrics
    const bedsPerThousand65Plus = demographics.population.age65Plus && supply.beds?.total
      ? ((supply.beds.total / demographics.population.age65Plus) * 1000).toFixed(2)
      : null;

    const capacityPerThousand65Plus = demographics.population.age65Plus && supply.totalCapacity
      ? ((supply.totalCapacity / demographics.population.age65Plus) * 1000).toFixed(2)
      : null;

    return {
      demographics,
      supply,
      metrics: {
        bedsPerThousand65Plus: facilityType === 'SNF' ? bedsPerThousand65Plus : null,
        capacityPerThousand65Plus: facilityType === 'ALF' ? capacityPerThousand65Plus : null,
        marketCompetition: supply.uniqueOperators > 5 ? 'High' : supply.uniqueOperators > 2 ? 'Medium' : 'Low',
        growthOutlook: demographics.projections.growthRate65Plus > 15 ? 'Strong' : demographics.projections.growthRate65Plus > 8 ? 'Moderate' : 'Slow'
      }
    };
  } catch (error) {
    console.error('[MarketService] getMarketMetrics error:', error);
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
  getCompetitors,
  getSupplySummary,
  getFacilityDetail,
  getMarketMetrics,
  closePool
};
