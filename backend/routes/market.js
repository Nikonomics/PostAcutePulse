/**
 * Market Dynamics API Routes
 *
 * Provides market intelligence endpoints for the Market Dynamics tab.
 * All endpoints use the shared Market DB (MARKET_DATABASE_URL).
 */

const express = require('express');
const router = express.Router();
const {
  getDemographics,
  getCompetitors,
  getSupplySummary,
  getFacilityDetail,
  getMarketMetrics,
  getStates,
  getCounties,
  searchFacilities,
  getStateSummary,
  getFacilitiesInCounty,
  getNationalBenchmarks,
  // New CMS data functions
  getStateBenchmarks,
  getVbpPerformance,
  getDataDefinitions
} = require('../services/marketService');
const { getMarketPool } = require('../config/database');
const MarketController = require('../controller/MarketController');

// ============================================================================
// MARKET CONTROLLER ENDPOINTS (Facility Search & Filters)
// ============================================================================

/**
 * GET /api/market/filters
 * Get available filter options for the map (statuses, serviceLines, companies, teams)
 */
router.get('/filters', MarketController.getMapFilterOptions);

/**
 * GET /api/market/search
 * Search facilities by name
 * Query params: searchTerm, facilityType (SNF|ALF|both), state (optional)
 */
router.get('/search', MarketController.searchFacilities);

/**
 * GET /api/market/facility/:ccn
 * Get full facility details by CCN (CMS Certification Number)
 */
router.get('/facility/:ccn', MarketController.getFacilityByCCN);

/**
 * GET /api/market/provider/:ccn/metadata
 * Get provider metadata by CCN (unified SNF/HHA lookup)
 * Returns provider type and basic info
 */
router.get('/provider/:ccn/metadata', MarketController.getProviderMetadata);

// ============================================================================
// MARKET SERVICE ENDPOINTS (Market Dynamics Data)
// ============================================================================

/**
 * GET /api/market/demographics/:state/:county
 * Get county demographics data
 *
 * URL Params:
 * - state: State code (e.g., "CA", "OR")
 * - county: County name (e.g., "Los Angeles", "Multnomah")
 *
 * Returns population, projections, economics, and education data
 */
router.get('/demographics/:state/:county', async (req, res) => {
  try {
    const { state, county } = req.params;

    if (!state || !county) {
      return res.status(400).json({
        success: false,
        error: 'State and county are required'
      });
    }

    const demographics = await getDemographics(state, county);

    if (!demographics) {
      return res.status(404).json({
        success: false,
        error: `No demographics found for ${county}, ${state}`
      });
    }

    res.json({
      success: true,
      data: demographics
    });

  } catch (error) {
    console.error('[Market Routes] getDemographics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/competitors
 * Get competitor facilities within a radius
 *
 * Query Params:
 * - lat: Center latitude (required)
 * - lon: Center longitude (required)
 * - radius: Search radius in miles (default: 25)
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 * - limit: Maximum results (default: 50)
 * - excludeId: Facility ID to exclude (optional)
 *
 * Returns array of competitor facilities with distance
 */
router.get('/competitors', async (req, res) => {
  try {
    const {
      lat,
      lon,
      radius = 25,
      type = 'SNF',
      limit = 50,
      excludeId
    } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: 'Latitude (lat) and longitude (lon) are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude values'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const competitors = await getCompetitors(
      latitude,
      longitude,
      parseFloat(radius),
      facilityType,
      parseInt(limit),
      excludeId ? parseInt(excludeId) : null
    );

    res.json({
      success: true,
      facilityType,
      searchParams: {
        latitude,
        longitude,
        radiusMiles: parseFloat(radius)
      },
      count: competitors.length,
      data: competitors
    });

  } catch (error) {
    console.error('[Market Routes] getCompetitors error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GEO-SEARCH ENDPOINTS (Map-based facility search)
// ============================================================================

/**
 * GET /api/market/map
 * Get facilities within a radius of a point (for map view)
 *
 * Query Params:
 * - lat: Center latitude (required)
 * - lng: Center longitude (required)
 * - radius: Search radius in miles (default: 25)
 * - types: Comma-separated list of provider types (default: 'SNF')
 *          Supported: SNF, HHA
 *
 * Returns array of facilities with coordinates
 */
router.get('/map', async (req, res) => {
  try {
    const { lat, lng, radius = 25, types = 'SNF' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude (lat) and longitude (lng) are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMiles = parseFloat(radius);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude values'
      });
    }

    // Parse types
    const typeList = types.split(',').map(t => t.trim().toUpperCase());
    const includeSNF = typeList.includes('SNF');
    const includeHHA = typeList.includes('HHA');
    const includeALF = typeList.includes('ALF');

    const pool = getMarketPool();
    const results = [];
    const errors = [];

    // Query SNF facilities if requested (with try/catch so one failure doesn't crash the whole map)
    // Uses exact column names from Data Dictionary: facility_name, federal_provider_number, county, certified_beds
    if (includeSNF) {
      try {
        const snfQuery = `
          SELECT
            federal_provider_number as ccn,
            facility_name as name,
            city,
            state,
            county as county_name,
            overall_rating,
            certified_beds as total_beds,
            latitude,
            longitude,
            'SNF' as type,
            (
              3959 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )
            ) as distance_miles
          FROM snf_facilities
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND (
              3959 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )
            ) <= $3
          ORDER BY distance_miles
          LIMIT 200
        `;
        const snfResult = await pool.query(snfQuery, [latitude, longitude, radiusMiles]);
        results.push(...snfResult.rows);
        console.log(`[Market Map] SNF query returned ${snfResult.rows.length} results`);
      } catch (snfErr) {
        console.warn(`[Market Map] SNF query failed: ${snfErr.message}`);
        errors.push({ type: 'SNF', error: snfErr.message });
      }
    }

    // Query HHA facilities if requested
    // Uses: ccn, provider_name, city, state, county_name, quality_star_rating
    if (includeHHA) {
      try {
        const hhaQuery = `
          SELECT DISTINCT ON (ccn)
            ccn,
            provider_name as name,
            city,
            state,
            county_name,
            quality_star_rating as overall_rating,
            NULL as total_beds,
            latitude,
            longitude,
            'HHA' as type,
            (
              3959 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )
            ) as distance_miles
          FROM hh_provider_snapshots
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND (
              3959 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )
            ) <= $3
          ORDER BY ccn, extract_id DESC
          LIMIT 200
        `;
        const hhaResult = await pool.query(hhaQuery, [latitude, longitude, radiusMiles]);
        results.push(...hhaResult.rows);
        console.log(`[Market Map] HHA query returned ${hhaResult.rows.length} results`);
      } catch (hhaErr) {
        console.warn(`[Market Map] HHA query failed: ${hhaErr.message}`);
        errors.push({ type: 'HHA', error: hhaErr.message });
      }
    }

    // Query ALF facilities if requested
    // Uses exact column names from Data Dictionary: facility_name, county, capacity
    if (includeALF) {
      try {
        const alfQuery = `
          SELECT
            CAST(id AS TEXT) as ccn,
            facility_name as name,
            city,
            state,
            county as county_name,
            NULL as overall_rating,
            capacity as total_beds,
            latitude,
            longitude,
            'ALF' as type,
            (
              3959 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )
            ) as distance_miles
          FROM alf_facilities
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND (
              3959 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
              )
            ) <= $3
          ORDER BY distance_miles
          LIMIT 200
        `;
        const alfResult = await pool.query(alfQuery, [latitude, longitude, radiusMiles]);
        results.push(...alfResult.rows);
        console.log(`[Market Map] ALF query returned ${alfResult.rows.length} results`);
      } catch (alfErr) {
        console.warn(`[Market Map] ALF query failed: ${alfErr.message}`);
        errors.push({ type: 'ALF', error: alfErr.message });
      }
    }

    // Sort combined results by distance
    results.sort((a, b) => (a.distance_miles || 0) - (b.distance_miles || 0));

    console.log(`[Market Map] Found ${results.length} total facilities within ${radiusMiles} miles of (${latitude}, ${longitude})`);

    res.json({
      success: true,
      searchParams: {
        latitude,
        longitude,
        radiusMiles,
        types: typeList
      },
      count: results.length,
      data: results,
      ...(errors.length > 0 && { warnings: errors })
    });

  } catch (error) {
    console.error('[Market Routes] getMarketMap error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/map/bounds
 * Get facilities within map viewport bounds
 *
 * Query Params:
 * - north: Northern boundary latitude (required)
 * - south: Southern boundary latitude (required)
 * - east: Eastern boundary longitude (required)
 * - west: Western boundary longitude (required)
 * - types: Comma-separated list of provider types (default: 'SNF')
 *          Supported: SNF, HHA, ALF
 *
 * Returns array of facilities within bounds
 */
router.get('/map/bounds', async (req, res) => {
  try {
    const { north, south, east, west, types = 'SNF' } = req.query;

    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        error: 'All bounds (north, south, east, west) are required'
      });
    }

    const northLat = parseFloat(north);
    const southLat = parseFloat(south);
    const eastLng = parseFloat(east);
    const westLng = parseFloat(west);

    if (isNaN(northLat) || isNaN(southLat) || isNaN(eastLng) || isNaN(westLng)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounds values'
      });
    }

    // Parse types
    const typeList = types.split(',').map(t => t.trim().toUpperCase());
    const includeSNF = typeList.includes('SNF');
    const includeHHA = typeList.includes('HHA');
    const includeALF = typeList.includes('ALF');

    const pool = getMarketPool();
    const results = [];
    const errors = [];

    // Query SNF facilities if requested (with try/catch)
    // Uses exact column names from Data Dictionary: facility_name, federal_provider_number, county, certified_beds
    if (includeSNF) {
      try {
        const snfQuery = `
          SELECT
            federal_provider_number as ccn,
            facility_name as name,
            city,
            state,
            county as county_name,
            overall_rating,
            certified_beds as total_beds,
            latitude,
            longitude,
            'SNF' as type
          FROM snf_facilities
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND latitude BETWEEN $1 AND $2
            AND longitude BETWEEN $3 AND $4
          LIMIT 500
        `;
        const snfResult = await pool.query(snfQuery, [southLat, northLat, westLng, eastLng]);
        results.push(...snfResult.rows);
      } catch (snfErr) {
        console.warn(`[Market Map Bounds] SNF query failed: ${snfErr.message}`);
        errors.push({ type: 'SNF', error: snfErr.message });
      }
    }

    // Query HHA facilities if requested
    // Uses: ccn, provider_name, city, state, county_name, quality_star_rating
    if (includeHHA) {
      try {
        const hhaQuery = `
          SELECT DISTINCT ON (ccn)
            ccn,
            provider_name as name,
            city,
            state,
            county_name,
            quality_star_rating as overall_rating,
            NULL as total_beds,
            latitude,
            longitude,
            'HHA' as type
          FROM hh_provider_snapshots
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND latitude BETWEEN $1 AND $2
            AND longitude BETWEEN $3 AND $4
          ORDER BY ccn, extract_id DESC
          LIMIT 500
        `;
        const hhaResult = await pool.query(hhaQuery, [southLat, northLat, westLng, eastLng]);
        results.push(...hhaResult.rows);
      } catch (hhaErr) {
        console.warn(`[Market Map Bounds] HHA query failed: ${hhaErr.message}`);
        errors.push({ type: 'HHA', error: hhaErr.message });
      }
    }

    // Query ALF facilities if requested
    // Uses exact column names from Data Dictionary: facility_name, county, capacity
    if (includeALF) {
      try {
        const alfQuery = `
          SELECT
            CAST(id AS TEXT) as ccn,
            facility_name as name,
            city,
            state,
            county as county_name,
            NULL as overall_rating,
            capacity as total_beds,
            latitude,
            longitude,
            'ALF' as type
          FROM alf_facilities
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND latitude BETWEEN $1 AND $2
            AND longitude BETWEEN $3 AND $4
          LIMIT 500
        `;
        const alfResult = await pool.query(alfQuery, [southLat, northLat, westLng, eastLng]);
        results.push(...alfResult.rows);
      } catch (alfErr) {
        console.warn(`[Market Map Bounds] ALF query failed: ${alfErr.message}`);
        errors.push({ type: 'ALF', error: alfErr.message });
      }
    }

    console.log(`[Market Map Bounds] Found ${results.length} facilities in bounds`);

    res.json({
      success: true,
      bounds: {
        north: northLat,
        south: southLat,
        east: eastLng,
        west: westLng
      },
      types: typeList,
      count: results.length,
      data: results,
      ...(errors.length > 0 && { warnings: errors })
    });

  } catch (error) {
    console.error('[Market Routes] getMarketMapBounds error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/supply-summary
 * Get supply statistics for a county
 *
 * Query Params:
 * - countyFips: County FIPS code (preferred)
 * - state: State code (fallback with county)
 * - county: County name (fallback with state)
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 *
 * Returns aggregated supply statistics
 */
router.get('/supply-summary', async (req, res) => {
  try {
    const { countyFips, state, county, type = 'SNF' } = req.query;

    if (!countyFips && (!state || !county)) {
      return res.status(400).json({
        success: false,
        error: 'Either countyFips or both state and county are required'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const summary = await getSupplySummary(countyFips, facilityType, state, county);

    res.json({
      success: true,
      facilityType,
      data: summary
    });

  } catch (error) {
    console.error('[Market Routes] getSupplySummary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/facility/:type/:id
 * Get detailed facility information
 *
 * URL Params:
 * - type: Facility type - 'snf' or 'alf'
 * - id: Facility ID in the database
 *
 * Returns full facility details
 */
router.get('/facility/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!type || !id) {
      return res.status(400).json({
        success: false,
        error: 'Facility type and ID are required'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const facilityId = parseInt(id);

    if (isNaN(facilityId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid facility ID'
      });
    }

    const facility = await getFacilityDetail(facilityType, facilityId);

    if (!facility) {
      return res.status(404).json({
        success: false,
        error: `No ${facilityType} facility found with ID ${facilityId}`
      });
    }

    res.json({
      success: true,
      facilityType,
      data: facility
    });

  } catch (error) {
    console.error('[Market Routes] getFacilityDetail error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/metrics
 * Get combined market metrics for scorecard display
 *
 * Query Params:
 * - state: State code (required)
 * - county: County name (required)
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 *
 * Returns demographics + supply + derived metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { state, county, type = 'SNF' } = req.query;

    if (!state || !county) {
      return res.status(400).json({
        success: false,
        error: 'State and county are required'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const metrics = await getMarketMetrics(state, county, facilityType);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: `No market data found for ${county}, ${state}`
      });
    }

    res.json({
      success: true,
      facilityType,
      data: metrics
    });

  } catch (error) {
    console.error('[Market Routes] getMarketMetrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/national-benchmarks
 * Get national benchmark statistics for comparison
 *
 * Query Params:
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 *
 * Returns national totals and beds/capacity per 1,000 population
 */
router.get('/national-benchmarks', async (req, res) => {
  try {
    const { type = 'SNF' } = req.query;
    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';

    const benchmarks = await getNationalBenchmarks(facilityType);

    res.json({
      success: true,
      data: benchmarks
    });

  } catch (error) {
    console.error('[Market Routes] getNationalBenchmarks error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/states
 * Get list of all states with facility counts
 *
 * Query Params:
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 *
 * Returns array of states with facility counts
 */
router.get('/states', async (req, res) => {
  try {
    const { type = 'SNF' } = req.query;
    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';

    const states = await getStates(facilityType);

    res.json({
      success: true,
      facilityType,
      count: states.length,
      data: states
    });

  } catch (error) {
    console.error('[Market Routes] getStates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/counties
 * Get counties for a state with facility counts
 *
 * Query Params:
 * - state: State code (required)
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 *
 * Returns array of counties with facility counts
 */
router.get('/counties', async (req, res) => {
  try {
    const { state, type = 'SNF' } = req.query;

    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'State is required'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const counties = await getCounties(state, facilityType);

    res.json({
      success: true,
      facilityType,
      state: state.toUpperCase(),
      count: counties.length,
      data: counties
    });

  } catch (error) {
    console.error('[Market Routes] getCounties error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/facilities/search
 * Search facilities by name (for autocomplete)
 *
 * Query Params:
 * - q: Search query (required, min 2 characters)
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 * - limit: Maximum results (default: 20)
 *
 * Returns array of matching facilities
 */
router.get('/facilities/search', async (req, res) => {
  try {
    const { q, type = 'SNF', limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) must be at least 2 characters'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const facilities = await searchFacilities(q, facilityType, parseInt(limit));

    res.json({
      success: true,
      facilityType,
      query: q,
      count: facilities.length,
      data: facilities
    });

  } catch (error) {
    console.error('[Market Routes] searchFacilities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/state-summary/:state
 * Get state-level summary statistics
 *
 * URL Params:
 * - state: State code (e.g., "CA", "TX")
 *
 * Query Params:
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 *
 * Returns state-level aggregated statistics
 */
router.get('/state-summary/:state', async (req, res) => {
  try {
    const { state } = req.params;
    const { type = 'SNF' } = req.query;

    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'State is required'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const summary = await getStateSummary(state, facilityType);

    if (!summary || summary.facilityCount === 0) {
      return res.status(404).json({
        success: false,
        error: `No ${facilityType} facilities found in ${state.toUpperCase()}`
      });
    }

    res.json({
      success: true,
      facilityType,
      data: summary
    });

  } catch (error) {
    console.error('[Market Routes] getStateSummary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/facilities-in-county
 * Get facilities in a county (for map display)
 *
 * Query Params:
 * - state: State code (required)
 * - county: County name (required)
 * - type: Facility type - 'SNF' or 'ALF' (default: 'SNF')
 * - limit: Maximum results (default: 100)
 *
 * Returns array of facilities with coordinates
 */
router.get('/facilities-in-county', async (req, res) => {
  try {
    const { state, county, type = 'SNF', limit = 100 } = req.query;

    if (!state || !county) {
      return res.status(400).json({
        success: false,
        error: 'State and county are required'
      });
    }

    const facilityType = type.toUpperCase() === 'ALF' ? 'ALF' : 'SNF';
    const facilities = await getFacilitiesInCounty(state, county, facilityType, parseInt(limit));

    res.json({
      success: true,
      facilityType,
      state: state.toUpperCase(),
      county,
      count: facilities.length,
      data: facilities
    });

  } catch (error) {
    console.error('[Market Routes] getFacilitiesInCounty error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/facilities/:providerId/deficiencies
 * Get deficiencies for a specific facility from CMS data
 *
 * URL Params:
 * - providerId: Federal provider number
 *
 * Query Params:
 * - prefix: Filter by deficiency prefix (F, G, K, E, etc.) - optional
 * - years: Number of years of history (default: 3)
 *
 * Returns array of deficiencies with survey info
 */
router.get('/facilities/:providerId/deficiencies', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { prefix = 'all', years = 3 } = req.query;

    // Use Market DB for deficiency data
    const pool = getMarketPool();

    let query = `
      SELECT
        id,
        federal_provider_number,
        survey_date,
        survey_type,
        deficiency_tag,
        deficiency_prefix,
        scope_severity,
        deficiency_text,
        correction_date,
        is_corrected
      FROM cms_facility_deficiencies
      WHERE federal_provider_number = $1
        AND survey_date >= CURRENT_DATE - INTERVAL '${parseInt(years)} years'
    `;

    const params = [providerId];

    if (prefix !== 'all') {
      query += ` AND deficiency_prefix = $2`;
      params.push(prefix);
    }

    query += ` ORDER BY survey_date DESC, deficiency_tag ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      providerId,
      count: result.rows.length,
      deficiencies: result.rows
    });

  } catch (error) {
    console.error('[Market Routes] getDeficiencies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/health
 * Health check endpoint to verify database connectivity
 */
router.get('/health', async (req, res) => {
  try {
    // Use Market DB for health check
    const pool = getMarketPool();

    const result = await pool.query('SELECT COUNT(*) as count FROM snf_facilities');

    res.json({
      success: true,
      message: 'Market service is healthy',
      snfFacilitiesCount: parseInt(result.rows[0].count)
    });

  } catch (error) {
    console.error('[Market Routes] health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    });
  }
});

// =============================================================================
// CMS Data Refresh Endpoints
// =============================================================================

const cmsRefreshService = require('../services/cmsDataRefreshService');

/**
 * GET /api/market/data-status
 * Get CMS data freshness status
 *
 * Returns last refresh dates, record counts, and whether refresh is needed
 */
router.get('/data-status', async (req, res) => {
  try {
    const status = await cmsRefreshService.getRefreshStatus();

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('[Market Routes] getDataStatus error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/market/refresh
 * Trigger a manual CMS data refresh
 *
 * Body:
 * - dataset: 'facilities', 'deficiencies', or 'all' (default: 'all')
 *
 * Note: This is a long-running operation (can take 30+ minutes for full refresh)
 */
router.post('/refresh', async (req, res) => {
  try {
    const { dataset = 'all' } = req.body;

    // Check if a refresh is already running
    const status = await cmsRefreshService.getRefreshStatus();

    const runningDatasets = Object.entries(status.datasets)
      .filter(([key, ds]) => ds.status === 'running')
      .map(([key]) => key);

    if (runningDatasets.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Refresh already in progress for: ${runningDatasets.join(', ')}`,
        runningDatasets
      });
    }

    // Start refresh in background (don't await)
    console.log(`[Market Routes] Starting CMS data refresh: ${dataset}`);

    // Return immediately, refresh runs in background
    res.json({
      success: true,
      message: `CMS data refresh started for: ${dataset}`,
      dataset,
      note: 'This operation can take 30+ minutes. Check /api/market/data-status for progress.'
    });

    // Run refresh in background
    if (dataset === 'facilities') {
      cmsRefreshService.refreshFacilities().catch(err => {
        console.error('[Market Routes] Facilities refresh failed:', err);
      });
    } else if (dataset === 'deficiencies') {
      cmsRefreshService.refreshDeficiencies().catch(err => {
        console.error('[Market Routes] Deficiencies refresh failed:', err);
      });
    } else {
      cmsRefreshService.refreshAllData().catch(err => {
        console.error('[Market Routes] Full refresh failed:', err);
      });
    }

  } catch (error) {
    console.error('[Market Routes] refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/refresh-history
 * Get history of CMS data refresh operations
 *
 * Query:
 * - limit: Number of records (default: 10)
 */
router.get('/refresh-history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Use Market DB for refresh log
    const pool = getMarketPool();

    const result = await pool.query(`
      SELECT
        id,
        dataset_name,
        refresh_type,
        started_at,
        completed_at,
        status,
        records_fetched,
        records_updated,
        records_inserted,
        error_count,
        error_message,
        EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
      FROM data_refresh_log
      ORDER BY started_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('[Market Routes] getRefreshHistory error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Census ACS Data Refresh Endpoints
// ============================================

const censusService = require('../services/censusDataRefreshService');

/**
 * GET /api/market/census-status
 * Get Census data refresh status and coverage statistics
 */
router.get('/census-status', async (req, res) => {
  try {
    const status = await censusService.getCensusRefreshStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Market Routes] getCensusStatus error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/market/census-refresh
 * Trigger Census ACS data refresh
 * Fetches all county economic/demographic data from Census Bureau API
 */
router.post('/census-refresh', async (req, res) => {
  try {
    // Return immediately, run refresh in background
    res.json({
      success: true,
      message: 'Census data refresh started. This will take 1-2 minutes.',
      checkStatus: '/api/market/census-status'
    });

    // Run refresh asynchronously
    censusService.refreshCensusData((progress) => {
      console.log(`[Census Refresh] ${progress.stage || ''}: ${progress.message || ''} ${progress.percent ? progress.percent + '%' : ''}`);
    }).then(result => {
      console.log('[Census Refresh] Complete:', result);
    }).catch(err => {
      console.error('[Census Refresh] Failed:', err);
    });

  } catch (error) {
    console.error('[Market Routes] censusRefresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// CMS Benchmarks, VBP & Definitions Endpoints
// ============================================

/**
 * GET /api/market/benchmarks/:stateCode
 * Get state or national benchmarks from CMS data
 *
 * URL Params:
 * - stateCode: State code (e.g., "CA", "TX") or "NATION" for national averages
 *
 * Returns staffing averages, turnover rates, quality measures
 */
router.get('/benchmarks/:stateCode', async (req, res) => {
  try {
    const { stateCode } = req.params;

    if (!stateCode) {
      return res.status(400).json({
        success: false,
        error: 'State code is required'
      });
    }

    const benchmarks = await getStateBenchmarks(stateCode);

    if (!benchmarks) {
      return res.status(404).json({
        success: false,
        error: `No benchmarks found for ${stateCode}`
      });
    }

    res.json({
      success: true,
      data: benchmarks
    });

  } catch (error) {
    console.error('[Market Routes] getStateBenchmarks error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/vbp/:ccn
 * Get VBP (Value-Based Purchasing) performance for a facility
 *
 * URL Params:
 * - ccn: CMS Certification Number (e.g., "015009")
 *
 * Returns VBP ranking, performance scores, incentive payment info
 */
router.get('/vbp/:ccn', async (req, res) => {
  try {
    const { ccn } = req.params;

    if (!ccn) {
      return res.status(400).json({
        success: false,
        error: 'CCN (CMS Certification Number) is required'
      });
    }

    const vbpData = await getVbpPerformance(ccn);

    if (!vbpData) {
      return res.status(404).json({
        success: false,
        error: `No VBP data found for CCN ${ccn}`
      });
    }

    res.json({
      success: true,
      data: vbpData
    });

  } catch (error) {
    console.error('[Market Routes] getVbpPerformance error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/market/definitions
 * Get data definitions for UI tooltips
 *
 * Query Params:
 * - category: Filter by category (e.g., "Staffing", "Ratings", "VBP")
 * - fields: Comma-separated list of field names (e.g., "rn_staffing_hours,total_nursing_turnover")
 *
 * Returns array of definitions with descriptions, units, interpretation notes
 */
router.get('/definitions', async (req, res) => {
  try {
    const { category, fields } = req.query;

    const fieldNames = fields ? fields.split(',').map(f => f.trim()) : null;
    const definitions = await getDataDefinitions(category || null, fieldNames);

    res.json({
      success: true,
      count: definitions.length,
      data: definitions
    });

  } catch (error) {
    console.error('[Market Routes] getDataDefinitions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// MARKET COMMENTS API
// ============================================================================

const db = require('../models');
const requireAuthentication = require('../passport').authenticateUser;
const { createNotification } = require('../services/notificationService');

/**
 * GET /api/market/:state/:county/comments
 * Get all comments for a market (state + county)
 */
router.get('/:state/:county/comments', requireAuthentication, async (req, res) => {
  try {
    const { state, county } = req.params;

    const comments = await db.market_comments.findAll({
      where: { state: state.toUpperCase(), county, parent_id: null },
      include: [
        {
          model: db.users,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'profile_url']
        },
        {
          model: db.market_comments,
          as: 'replies',
          include: [
            {
              model: db.users,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'profile_url']
            }
          ],
          order: [['created_at', 'ASC']]
        },
        {
          model: db.market_comment_mentions,
          as: 'mentions',
          include: [
            {
              model: db.users,
              as: 'mentionedUser',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    console.error('[Market Routes] Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments'
    });
  }
});

/**
 * POST /api/market/:state/:county/comments
 * Add a new comment to a market
 */
router.post('/:state/:county/comments', requireAuthentication, async (req, res) => {
  try {
    const { state, county } = req.params;
    const { comment, parent_id, mentioned_user_ids = [] } = req.body;
    const userId = req.user.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required'
      });
    }

    // Create the comment
    const newComment = await db.market_comments.create({
      state: state.toUpperCase(),
      county,
      user_id: userId,
      comment: comment.trim(),
      parent_id: parent_id || null
    });

    // Create mentions and send notifications
    if (mentioned_user_ids.length > 0) {
      const mentions = mentioned_user_ids.map(mentionedUserId => ({
        comment_id: newComment.id,
        mentioned_user_id: mentionedUserId
      }));
      await db.market_comment_mentions.bulkCreate(mentions);

      // Send notifications to mentioned users
      const commenter = await db.users.findByPk(userId, {
        attributes: ['first_name', 'last_name']
      });
      const commenterName = `${commenter.first_name} ${commenter.last_name}`;

      for (const mentionedUserId of mentioned_user_ids) {
        if (mentionedUserId !== userId) {
          await createNotification({
            to_id: mentionedUserId,
            from_id: userId,
            title: 'You were mentioned in a market comment',
            body: `${commenterName} mentioned you in a comment on ${county} County, ${state}`,
            type: 'mention',
            resource_type: 'market',
            resource_id: `${state}:${county}`
          });
        }
      }
    }

    // Fetch the created comment with associations
    const createdComment = await db.market_comments.findByPk(newComment.id, {
      include: [
        {
          model: db.users,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'profile_url']
        },
        {
          model: db.market_comment_mentions,
          as: 'mentions',
          include: [
            {
              model: db.users,
              as: 'mentionedUser',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      comment: createdComment
    });
  } catch (error) {
    console.error('[Market Routes] Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
});

/**
 * DELETE /api/market/:state/:county/comments/:commentId
 * Delete a comment (only owner or admin can delete)
 */
router.delete('/:state/:county/comments/:commentId', requireAuthentication, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await db.market_comments.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check if user owns the comment or is admin
    if (comment.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this comment'
      });
    }

    // Delete associated mentions first
    await db.market_comment_mentions.destroy({
      where: { comment_id: commentId }
    });

    // Delete any replies
    await db.market_comments.destroy({
      where: { parent_id: commentId }
    });

    // Delete the comment
    await comment.destroy();

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('[Market Routes] Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment'
    });
  }
});

module.exports = router;
