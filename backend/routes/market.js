/**
 * Market Dynamics API Routes
 *
 * Provides market intelligence endpoints for the Market Dynamics tab.
 * All endpoints return JSON data from the snf_news PostgreSQL database.
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
  getNationalBenchmarks
} = require('../services/marketService');

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

    const { Pool } = require('pg');
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
    const pool = new Pool({
      connectionString,
      ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
    });

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
    await pool.end();

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
    // Quick test query
    const { Pool } = require('pg');
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
    const pool = new Pool({
      connectionString,
      ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });

    const result = await pool.query('SELECT COUNT(*) as count FROM snf_facilities');
    await pool.end();

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

    const { Pool } = require('pg');
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
    const pool = new Pool({
      connectionString,
      ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });

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

    await pool.end();

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

module.exports = router;
