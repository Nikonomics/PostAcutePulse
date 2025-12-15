/**
 * ALF Facilities API Routes
 *
 * Provides endpoints for searching and matching facilities
 * from the ALF reference database
 */

const express = require('express');
const router = express.Router();
const {
  matchFacility,
  searchFacilities,
  getFacilitiesNearby
} = require('../services/facilityMatcher');

/**
 * POST /api/facilities/match
 * Match a facility name against the database
 *
 * Body:
 * {
 *   "facilityName": "Sunrise Senior Living",
 *   "city": "Beverly Hills",  // optional
 *   "state": "CA",            // optional
 *   "minSimilarity": 0.7      // optional, default 0.7
 * }
 */
router.post('/match', async (req, res) => {
  try {
    const { facilityName, city, state, minSimilarity } = req.body;

    if (!facilityName) {
      return res.status(400).json({
        success: false,
        error: 'facilityName is required'
      });
    }

    const match = await matchFacility(facilityName, city, state, minSimilarity);

    if (!match) {
      return res.json({
        success: true,
        match: null,
        message: 'No match found'
      });
    }

    res.json({
      success: true,
      match: {
        facility_name: match.facility_name,
        address: match.address,
        city: match.city,
        state: match.state,
        zip_code: match.zip_code,
        capacity: match.capacity,
        ownership_type: match.ownership_type,
        latitude: match.latitude,
        longitude: match.longitude,
        match_score: match.match_score,
        match_confidence: match.match_confidence
      }
    });

  } catch (error) {
    console.error('Error matching facility:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/facilities/search
 * Search facilities by multiple criteria
 *
 * Body:
 * {
 *   "name": "Sunrise",         // optional, partial match
 *   "city": "Beverly Hills",   // optional
 *   "state": "CA",             // optional
 *   "zipCode": "90210",        // optional
 *   "minCapacity": 50,         // optional
 *   "maxCapacity": 200,        // optional
 *   "limit": 50                // optional, default 50
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const criteria = req.body;
    const facilities = await searchFacilities(criteria);

    res.json({
      success: true,
      count: facilities.length,
      facilities: facilities.map(f => ({
        id: f.id,
        facility_name: f.facility_name,
        address: f.address,
        city: f.city,
        state: f.state,
        zip_code: f.zip_code,
        capacity: f.capacity,
        ownership_type: f.ownership_type,
        latitude: f.latitude,
        longitude: f.longitude
      }))
    });

  } catch (error) {
    console.error('Error searching facilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/facilities/nearby
 * Find facilities within a geographic radius
 *
 * Body:
 * {
 *   "latitude": 34.0736,
 *   "longitude": -118.4004,
 *   "radiusMiles": 25,        // optional, default 25
 *   "limit": 50               // optional, default 50
 * }
 */
router.post('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radiusMiles, limit } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'latitude and longitude are required'
      });
    }

    const facilities = await getFacilitiesNearby(
      parseFloat(latitude),
      parseFloat(longitude),
      radiusMiles || 25,
      limit || 50
    );

    res.json({
      success: true,
      count: facilities.length,
      facilities: facilities.map(f => ({
        id: f.id,
        facility_name: f.facility_name,
        address: f.address,
        city: f.city,
        state: f.state,
        zip_code: f.zip_code,
        capacity: f.capacity,
        ownership_type: f.ownership_type,
        latitude: f.latitude,
        longitude: f.longitude,
        distance_miles: f.distance_miles ? parseFloat(f.distance_miles).toFixed(2) : null
      }))
    });

  } catch (error) {
    console.error('Error finding nearby facilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/facilities/stats
 * Get database statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      // Get total count
      const [[{ total }]] = await sequelize.query('SELECT COUNT(*) as total FROM alf_facilities');

      // Get facilities by state
      const [byState] = await sequelize.query(`
        SELECT state, COUNT(*) as count
        FROM alf_facilities
        WHERE state IS NOT NULL
        GROUP BY state
        ORDER BY count DESC
      `);

      res.json({
        success: true,
        total_facilities: parseInt(total),
        facilities_by_state: byState
      });
    } finally {
      await sequelize.close();
    }

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
