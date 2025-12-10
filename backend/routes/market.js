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
  getMarketMetrics
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
 * GET /api/market/health
 * Health check endpoint to verify database connectivity
 */
router.get('/health', async (req, res) => {
  try {
    // Quick test query
    const { Pool } = require('pg');
    const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
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

module.exports = router;
