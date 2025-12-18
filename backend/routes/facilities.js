/**
 * SNF/ALF Facilities API Routes
 *
 * Provides endpoints for searching, matching, and viewing facility profiles
 * from the CMS nursing home and ALF reference databases
 */

const express = require('express');
const router = express.Router();
const {
  matchFacility,
  searchFacilities,
  getFacilitiesNearby
} = require('../services/facilityMatcher');

// ============================================================================
// FACILITY SEARCH API (must come BEFORE parameterized routes)
// ============================================================================

/**
 * GET /api/facilities/snf/search
 * Search SNF facilities with filters
 *
 * NOTE: This route MUST be defined before /snf/:ccn to avoid "search" being
 * matched as a CCN parameter.
 */
router.get('/snf/search', async (req, res) => {
  try {
    const {
      name, state, city, minBeds, maxBeds,
      minRating, maxRating, limit = 50, offset = 0
    } = req.query;

    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      let whereClause = '1=1';
      const replacements = {};

      if (name) {
        // Use ILIKE for case-insensitive search on facility_name
        whereClause += ` AND facility_name ILIKE :name`;
        replacements.name = `%${name}%`;
      }
      if (state) {
        whereClause += ` AND state = :state`;
        replacements.state = state.toUpperCase();
      }
      if (city) {
        whereClause += ` AND city ILIKE :city`;
        replacements.city = `%${city}%`;
      }
      if (minBeds) {
        whereClause += ` AND certified_beds >= :minBeds`;
        replacements.minBeds = parseInt(minBeds);
      }
      if (maxBeds) {
        whereClause += ` AND certified_beds <= :maxBeds`;
        replacements.maxBeds = parseInt(maxBeds);
      }
      if (minRating) {
        whereClause += ` AND overall_rating >= :minRating`;
        replacements.minRating = parseInt(minRating);
      }
      if (maxRating) {
        whereClause += ` AND overall_rating <= :maxRating`;
        replacements.maxRating = parseInt(maxRating);
      }

      // Query snf_facilities directly - much faster than facility_snapshots CTE
      const [facilities] = await sequelize.query(`
        SELECT
          federal_provider_number as ccn,
          facility_name as provider_name,
          address, city, state, zip_code,
          overall_rating, health_inspection_rating,
          quality_measure_rating as quality_rating, staffing_rating,
          certified_beds, average_residents_per_day as residents_total,
          latitude, longitude, ownership_type, chain_name
        FROM snf_facilities
        WHERE ${whereClause}
        ORDER BY
          CASE WHEN facility_name ILIKE :exactMatch THEN 0 ELSE 1 END,
          facility_name
        LIMIT :limit OFFSET :offset
      `, {
        replacements: {
          ...replacements,
          exactMatch: name ? `${name}%` : '%',
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

      // Get total count (fast query on snf_facilities)
      const [[{ total }]] = await sequelize.query(`
        SELECT COUNT(*) as total FROM snf_facilities WHERE ${whereClause}
      `, { replacements });

      res.json({
        success: true,
        total: parseInt(total),
        facilities
      });

    } finally {
      await sequelize.close();
    }

  } catch (error) {
    console.error('Error searching facilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// FACILITY PROFILE API
// Comprehensive facility data from CMS time-series database
// ============================================================================

/**
 * GET /api/facilities/snf/:ccn
 * Get comprehensive profile for a skilled nursing facility
 *
 * Returns: current info, ratings, quality measures, citations, trends, VBP, etc.
 */
router.get('/snf/:ccn', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      // Get latest facility snapshot
      const [[facility]] = await sequelize.query(`
        SELECT fs.*, e.extract_date
        FROM facility_snapshots fs
        JOIN cms_extracts e ON fs.extract_id = e.extract_id
        WHERE fs.ccn = :ccn
        ORDER BY e.extract_date DESC
        LIMIT 1
      `, { replacements: { ccn } });

      if (!facility) {
        return res.status(404).json({
          success: false,
          error: 'Facility not found'
        });
      }

      // Get historical snapshots for trends (parallel queries)
      const [
        [snapshots],
        [qualityMeasures],
        [healthCitations],
        [fireCitations],
        [vbpScores],
        [penaltyRecords],
        [ownershipRecords],
        [surveyDates],
        [events],
        [covidData]
      ] = await Promise.all([
        // Historical snapshots (all years)
        sequelize.query(`
          SELECT fs.*, e.extract_date
          FROM facility_snapshots fs
          JOIN cms_extracts e ON fs.extract_id = e.extract_id
          WHERE fs.ccn = :ccn
          ORDER BY e.extract_date ASC
        `, { replacements: { ccn } }),

        // Latest quality measures
        sequelize.query(`
          SELECT mqm.*, e.extract_date
          FROM mds_quality_measures mqm
          JOIN cms_extracts e ON mqm.extract_id = e.extract_id
          WHERE mqm.ccn = :ccn
          ORDER BY e.extract_date DESC
          LIMIT 50
        `, { replacements: { ccn } }),

        // Health citations (last 3 years)
        sequelize.query(`
          SELECT hc.*, cd.description as tag_description
          FROM health_citations hc
          LEFT JOIN citation_descriptions cd ON hc.deficiency_tag = cd.deficiency_tag
          WHERE hc.ccn = :ccn
            AND hc.survey_date >= NOW() - INTERVAL '3 years'
          ORDER BY hc.survey_date DESC
        `, { replacements: { ccn } }),

        // Fire safety citations (last 3 years)
        sequelize.query(`
          SELECT fsc.*, cd.description as tag_description
          FROM fire_safety_citations fsc
          LEFT JOIN citation_descriptions cd ON fsc.deficiency_tag = cd.deficiency_tag
          WHERE fsc.ccn = :ccn
            AND fsc.survey_date >= NOW() - INTERVAL '3 years'
          ORDER BY fsc.survey_date DESC
        `, { replacements: { ccn } }),

        // VBP scores (all years)
        sequelize.query(`
          SELECT * FROM vbp_scores
          WHERE ccn = :ccn
          ORDER BY fiscal_year DESC
        `, { replacements: { ccn } }),

        // Penalty records
        sequelize.query(`
          SELECT * FROM penalty_records
          WHERE ccn = :ccn
          ORDER BY penalty_date DESC
        `, { replacements: { ccn } }),

        // Ownership records
        sequelize.query(`
          SELECT * FROM ownership_records
          WHERE ccn = :ccn
          ORDER BY ownership_percentage DESC NULLS LAST
        `, { replacements: { ccn } }),

        // Survey dates
        sequelize.query(`
          SELECT * FROM survey_dates
          WHERE ccn = :ccn
          ORDER BY survey_date DESC
        `, { replacements: { ccn } }),

        // Events (rating changes, penalties, etc.)
        sequelize.query(`
          SELECT fe.*, e.extract_date
          FROM facility_events fe
          LEFT JOIN cms_extracts e ON fe.current_extract_id = e.extract_id
          WHERE fe.ccn = :ccn
          ORDER BY fe.event_date DESC NULLS LAST
          LIMIT 50
        `, { replacements: { ccn } }),

        // COVID vaccination data
        sequelize.query(`
          SELECT cv.*, e.extract_date
          FROM covid_vaccination cv
          JOIN cms_extracts e ON cv.extract_id = e.extract_id
          WHERE cv.ccn = :ccn
          ORDER BY e.extract_date DESC
          LIMIT 1
        `, { replacements: { ccn } })
      ]);

      // Calculate trends from snapshots
      const trends = calculateTrends(snapshots);

      // Group citations by year for chart
      const citationsByYear = groupCitationsByYear(healthCitations, fireCitations);

      res.json({
        success: true,
        facility: {
          ...facility,
          trends,
          citationsByYear
        },
        snapshots,
        qualityMeasures,
        healthCitations,
        fireCitations,
        vbpScores,
        penaltyRecords,
        ownershipRecords,
        surveyDates,
        events,
        covidData: covidData[0] || null
      });

    } finally {
      await sequelize.close();
    }

  } catch (error) {
    console.error('Error getting facility profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/facilities/snf/:ccn/competitors
 * Get nearby competing facilities
 */
router.get('/snf/:ccn/competitors', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { radiusMiles = 25, limit = 20 } = req.query;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      // Get the target facility's location
      const [[facility]] = await sequelize.query(`
        SELECT latitude, longitude, certified_beds
        FROM facility_snapshots fs
        JOIN cms_extracts e ON fs.extract_id = e.extract_id
        WHERE fs.ccn = :ccn
        ORDER BY e.extract_date DESC
        LIMIT 1
      `, { replacements: { ccn } });

      if (!facility || !facility.latitude || !facility.longitude) {
        return res.json({ success: true, competitors: [] });
      }

      // Find nearby facilities using Haversine formula
      const [competitors] = await sequelize.query(`
        WITH latest AS (
          SELECT DISTINCT ON (fs.ccn) fs.*, e.extract_date
          FROM facility_snapshots fs
          JOIN cms_extracts e ON fs.extract_id = e.extract_id
          ORDER BY fs.ccn, e.extract_date DESC
        )
        SELECT
          ccn, provider_name as facility_name, city, state,
          overall_rating, health_inspection_rating, qm_rating as quality_measure_rating, staffing_rating,
          certified_beds as number_of_certified_beds, average_residents_per_day as number_of_residents_in_certified_beds,
          latitude, longitude,
          (3959 * acos(
            cos(radians(:lat)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(latitude))
          )) AS distance_miles
        FROM latest
        WHERE ccn != :ccn
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (3959 * acos(
            cos(radians(:lat)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(latitude))
          )) <= :radius
        ORDER BY distance_miles
        LIMIT :limit
      `, {
        replacements: {
          ccn,
          lat: parseFloat(facility.latitude),
          lng: parseFloat(facility.longitude),
          radius: parseInt(radiusMiles),
          limit: parseInt(limit)
        }
      });

      res.json({
        success: true,
        competitors
      });

    } finally {
      await sequelize.close();
    }

  } catch (error) {
    console.error('Error getting competitors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/facilities/snf/:ccn/benchmarks
 * Returns market (county), state, and national averages for key metrics
 */
router.get('/snf/:ccn/benchmarks', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      // First get the facility's state and county
      const [[facility]] = await sequelize.query(`
        SELECT state, county
        FROM facility_snapshots fs
        JOIN cms_extracts e ON fs.extract_id = e.extract_id
        WHERE fs.ccn = :ccn
        ORDER BY e.extract_date DESC
        LIMIT 1
      `, { replacements: { ccn } });

      if (!facility) {
        return res.status(404).json({ success: false, error: 'Facility not found' });
      }

      const { state, county } = facility;

      // Get the latest extract_id for consistent comparison
      const [[latestExtract]] = await sequelize.query(`
        SELECT extract_id FROM cms_extracts ORDER BY extract_date DESC LIMIT 1
      `);
      const extractId = latestExtract.extract_id;

      // National averages
      const [[nationalAvg]] = await sequelize.query(`
        SELECT
          AVG(overall_rating) as avg_overall_rating,
          AVG(qm_rating) as avg_quality_rating,
          AVG(staffing_rating) as avg_staffing_rating,
          AVG(health_inspection_rating) as avg_inspection_rating,
          AVG(CAST(reported_total_nurse_hrs AS FLOAT)) as avg_total_nursing_hprd,
          AVG(CAST(reported_rn_hrs AS FLOAT)) as avg_rn_hprd,
          AVG(CAST(reported_lpn_hrs AS FLOAT)) as avg_lpn_hprd,
          AVG(CAST(reported_na_hrs AS FLOAT)) as avg_cna_hprd,
          AVG(CAST(rn_turnover AS FLOAT)) as avg_rn_turnover,
          AVG(CAST(total_nursing_turnover AS FLOAT)) as avg_total_turnover,
          AVG(CAST(cycle1_total_health_deficiencies AS FLOAT)) as avg_deficiencies,
          AVG(CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) as avg_occupancy,
          COUNT(*) as facility_count
        FROM facility_snapshots
        WHERE extract_id = :extractId
      `, { replacements: { extractId } });

      // State averages
      const [[stateAvg]] = await sequelize.query(`
        SELECT
          AVG(overall_rating) as avg_overall_rating,
          AVG(qm_rating) as avg_quality_rating,
          AVG(staffing_rating) as avg_staffing_rating,
          AVG(health_inspection_rating) as avg_inspection_rating,
          AVG(CAST(reported_total_nurse_hrs AS FLOAT)) as avg_total_nursing_hprd,
          AVG(CAST(reported_rn_hrs AS FLOAT)) as avg_rn_hprd,
          AVG(CAST(reported_lpn_hrs AS FLOAT)) as avg_lpn_hprd,
          AVG(CAST(reported_na_hrs AS FLOAT)) as avg_cna_hprd,
          AVG(CAST(rn_turnover AS FLOAT)) as avg_rn_turnover,
          AVG(CAST(total_nursing_turnover AS FLOAT)) as avg_total_turnover,
          AVG(CAST(cycle1_total_health_deficiencies AS FLOAT)) as avg_deficiencies,
          AVG(CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) as avg_occupancy,
          COUNT(*) as facility_count
        FROM facility_snapshots
        WHERE extract_id = :extractId
          AND state = :state
      `, { replacements: { extractId, state } });

      // Market (county) averages
      const [[marketAvg]] = await sequelize.query(`
        SELECT
          AVG(overall_rating) as avg_overall_rating,
          AVG(qm_rating) as avg_quality_rating,
          AVG(staffing_rating) as avg_staffing_rating,
          AVG(health_inspection_rating) as avg_inspection_rating,
          AVG(CAST(reported_total_nurse_hrs AS FLOAT)) as avg_total_nursing_hprd,
          AVG(CAST(reported_rn_hrs AS FLOAT)) as avg_rn_hprd,
          AVG(CAST(reported_lpn_hrs AS FLOAT)) as avg_lpn_hprd,
          AVG(CAST(reported_na_hrs AS FLOAT)) as avg_cna_hprd,
          AVG(CAST(rn_turnover AS FLOAT)) as avg_rn_turnover,
          AVG(CAST(total_nursing_turnover AS FLOAT)) as avg_total_turnover,
          AVG(CAST(cycle1_total_health_deficiencies AS FLOAT)) as avg_deficiencies,
          AVG(CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) as avg_occupancy,
          COUNT(*) as facility_count
        FROM facility_snapshots
        WHERE extract_id = :extractId
          AND state = :state
          AND county = :county
      `, { replacements: { extractId, state, county } });

      res.json({
        success: true,
        facility: { state, county },
        benchmarks: {
          national: nationalAvg,
          state: stateAvg,
          market: marketAvg
        }
      });

    } finally {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/facilities/snf/:ccn/deficiencies
 * Get detailed deficiency records for a facility
 */
router.get('/snf/:ccn/deficiencies', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      const [deficiencies] = await sequelize.query(`
        SELECT
          survey_date,
          survey_type,
          deficiency_tag,
          scope_severity,
          deficiency_text,
          correction_date,
          is_corrected
        FROM cms_facility_deficiencies
        WHERE federal_provider_number = :ccn
        ORDER BY survey_date DESC
        LIMIT 100
      `, { replacements: { ccn } });

      res.json({ success: true, deficiencies });
    } finally {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error fetching deficiencies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/facilities/snf/:ccn/penalties
 * Get penalty records for a facility
 */
router.get('/snf/:ccn/penalties', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      const [penalties] = await sequelize.query(`
        SELECT
          penalty_date,
          penalty_type,
          fine_amount,
          payment_denial_start_date,
          payment_denial_days
        FROM penalty_records
        WHERE ccn = :ccn
        ORDER BY penalty_date DESC
      `, { replacements: { ccn } });

      res.json({ success: true, penalties });
    } finally {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error fetching penalties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/facilities/snf/:ccn/ownership
 * Get ownership records for a facility
 */
router.get('/snf/:ccn/ownership', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      const [ownership] = await sequelize.query(`
        SELECT
          role_type,
          owner_type,
          owner_name,
          ownership_percentage,
          association_date
        FROM ownership_records
        WHERE ccn = :ccn
        ORDER BY
          CASE WHEN ownership_percentage IS NOT NULL THEN 0 ELSE 1 END,
          ownership_percentage DESC NULLS LAST,
          role_type
      `, { replacements: { ccn } });

      res.json({ success: true, ownership });
    } finally {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error fetching ownership:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions
function calculateTrends(snapshots) {
  if (!snapshots || snapshots.length < 2) return null;

  const trends = {
    ratings: [],
    staffing: [],
    occupancy: [],
    deficiencies: [],
    turnover: [],
    penalties: [],
    caseMix: [],
    weekendStaffing: [],
    qualityIndicators: []
  };

  snapshots.forEach(s => {
    const date = s.extract_date;

    // Star ratings over time
    trends.ratings.push({
      date,
      overall: s.overall_rating,
      health: s.health_inspection_rating,
      quality: s.qm_rating,
      staffing: s.staffing_rating,
      longStayQM: s.long_stay_qm_rating,
      shortStayQM: s.short_stay_qm_rating
    });

    // Staffing hours per resident day
    trends.staffing.push({
      date,
      rn: parseFloat(s.reported_rn_hrs) || 0,
      lpn: parseFloat(s.reported_lpn_hrs) || 0,
      cna: parseFloat(s.reported_na_hrs) || 0,
      total: parseFloat(s.reported_total_nurse_hrs) || 0,
      licensed: parseFloat(s.reported_licensed_hrs) || 0,
      pt: parseFloat(s.reported_pt_hrs) || 0
    });

    // Occupancy
    const beds = parseInt(s.certified_beds) || 1;
    const residents = parseInt(s.average_residents_per_day) || 0;
    trends.occupancy.push({
      date,
      rate: Math.round((residents / beds) * 100),
      beds,
      residents
    });

    // Deficiencies from survey cycles
    trends.deficiencies.push({
      date,
      cycle1Total: parseInt(s.cycle1_total_health_deficiencies) || 0,
      cycle1Standard: parseInt(s.cycle1_standard_deficiencies) || 0,
      cycle1Complaint: parseInt(s.cycle1_complaint_deficiencies) || 0,
      cycle2Total: parseInt(s.cycle2_total_health_deficiencies) || 0,
      deficiencyScore: parseFloat(s.cycle1_deficiency_score) || 0,
      totalWeightedScore: parseFloat(s.total_weighted_health_score) || 0
    });

    // Turnover rates
    trends.turnover.push({
      date,
      totalNursingTurnover: parseFloat(s.total_nursing_turnover) || null,
      rnTurnover: parseFloat(s.rn_turnover) || null,
      adminDepartures: parseInt(s.administrator_departures) || 0
    });

    // Penalties and fines
    trends.penalties.push({
      date,
      fineCount: parseInt(s.fine_count) || 0,
      fineTotalDollars: parseFloat(s.fine_total_dollars) || 0,
      paymentDenials: parseInt(s.payment_denial_count) || 0,
      totalPenalties: parseInt(s.total_penalty_count) || 0
    });

    // Case mix index (acuity measure)
    trends.caseMix.push({
      date,
      caseMixIndex: parseFloat(s.case_mix_index) || null
    });

    // Weekend staffing
    trends.weekendStaffing.push({
      date,
      weekendTotal: parseFloat(s.weekend_total_nurse_hrs) || null,
      weekendRN: parseFloat(s.weekend_rn_hrs) || null
    });

    // Quality indicators
    trends.qualityIndicators.push({
      date,
      incidents: parseInt(s.facility_reported_incidents) || 0,
      complaints: parseInt(s.substantiated_complaints) || 0,
      infectionCitations: parseInt(s.infection_control_citations) || 0
    });
  });

  return trends;
}

function groupCitationsByYear(healthCitations, fireCitations) {
  const byYear = {};

  healthCitations.forEach(c => {
    const year = new Date(c.survey_date).getFullYear();
    if (!byYear[year]) byYear[year] = { health: 0, fire: 0 };
    byYear[year].health++;
  });

  fireCitations.forEach(c => {
    const year = new Date(c.survey_date).getFullYear();
    if (!byYear[year]) byYear[year] = { health: 0, fire: 0 };
    byYear[year].fire++;
  });

  return Object.entries(byYear)
    .map(([year, counts]) => ({ year: parseInt(year), ...counts }))
    .sort((a, b) => a.year - b.year);
}

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
 * GET /api/facilities/snf/:ccn/percentiles
 * Get percentile rankings for a facility compared to peers
 */
router.get('/snf/:ccn/percentiles', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { scope = 'national', state: filterState, size } = req.query;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      // Get the facility's current data
      const [[facility]] = await sequelize.query(`
        SELECT * FROM facility_snapshots
        WHERE ccn = :ccn
        ORDER BY extract_id DESC
        LIMIT 1
      `, { replacements: { ccn } });

      if (!facility) {
        return res.status(404).json({ success: false, error: 'Facility not found' });
      }

      // Get the latest extract_id
      const extractId = facility.extract_id;

      // Build WHERE clause based on peer group filters
      let whereClause = 'WHERE extract_id = :extractId';
      const replacements = { extractId, ccn };

      if (scope === 'state' || filterState) {
        whereClause += ' AND state = :filterState';
        replacements.filterState = filterState || facility.state;
      }

      if (size) {
        // Size buckets: small (<60 beds), medium (60-120), large (>120)
        if (size === 'small') {
          whereClause += ' AND CAST(certified_beds AS INTEGER) < 60';
        } else if (size === 'medium') {
          whereClause += ' AND CAST(certified_beds AS INTEGER) >= 60 AND CAST(certified_beds AS INTEGER) <= 120';
        } else if (size === 'large') {
          whereClause += ' AND CAST(certified_beds AS INTEGER) > 120';
        }
      }

      // Get total count for peer group
      const [[{ facility_count }]] = await sequelize.query(`
        SELECT COUNT(*) as facility_count FROM facility_snapshots ${whereClause}
      `, { replacements });

      // Calculate percentiles for each metric
      const metrics = [
        { key: 'overall_rating', field: 'overall_rating', higherIsBetter: true },
        { key: 'quality_rating', field: 'qm_rating', higherIsBetter: true },
        { key: 'staffing_rating', field: 'staffing_rating', higherIsBetter: true },
        { key: 'inspection_rating', field: 'health_inspection_rating', higherIsBetter: true },
        { key: 'total_nursing_hprd', field: 'reported_total_nurse_hrs', higherIsBetter: true },
        { key: 'rn_hprd', field: 'reported_rn_hrs', higherIsBetter: true },
        { key: 'rn_turnover', field: 'rn_turnover', higherIsBetter: false },
        { key: 'deficiency_count', field: 'cycle1_total_health_deficiencies', higherIsBetter: false },
        { key: 'occupancy', field: null, higherIsBetter: true } // Calculated field
      ];

      const percentiles = {};

      for (const metric of metrics) {
        let facilityValue;
        let countQuery;

        if (metric.key === 'occupancy') {
          // Occupancy is calculated
          const beds = parseFloat(facility.certified_beds) || 1;
          const residents = parseFloat(facility.average_residents_per_day) || 0;
          facilityValue = (residents / beds) * 100;

          if (metric.higherIsBetter) {
            countQuery = `
              SELECT COUNT(*) as count FROM facility_snapshots
              ${whereClause}
              AND (CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) < :facilityValue
            `;
          } else {
            countQuery = `
              SELECT COUNT(*) as count FROM facility_snapshots
              ${whereClause}
              AND (CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) > :facilityValue
            `;
          }
        } else {
          facilityValue = parseFloat(facility[metric.field]) || 0;

          if (metric.higherIsBetter) {
            countQuery = `
              SELECT COUNT(*) as count FROM facility_snapshots
              ${whereClause}
              AND CAST(${metric.field} AS FLOAT) < :facilityValue
            `;
          } else {
            countQuery = `
              SELECT COUNT(*) as count FROM facility_snapshots
              ${whereClause}
              AND CAST(${metric.field} AS FLOAT) > :facilityValue
            `;
          }
        }

        const [[{ count }]] = await sequelize.query(countQuery, {
          replacements: { ...replacements, facilityValue }
        });

        const betterThan = parseInt(count);
        const percentile = facility_count > 0 ? Math.round((betterThan / facility_count) * 100) : 0;

        percentiles[metric.key] = {
          value: Math.round(facilityValue * 100) / 100,
          percentile,
          better_than: betterThan
        };
      }

      // Get distribution data for histograms (ratings and key metrics)
      const distributions = {};

      // Overall rating distribution (1-5)
      const [ratingDist] = await sequelize.query(`
        SELECT overall_rating as bucket, COUNT(*) as count
        FROM facility_snapshots
        ${whereClause}
        AND overall_rating IS NOT NULL
        GROUP BY overall_rating
        ORDER BY overall_rating
      `, { replacements });
      distributions.overall_rating = ratingDist;

      // Staffing HPRD distribution (buckets of 0.5)
      const [hprdDist] = await sequelize.query(`
        SELECT
          FLOOR(CAST(reported_total_nurse_hrs AS FLOAT) * 2) / 2 as bucket,
          COUNT(*) as count
        FROM facility_snapshots
        ${whereClause}
        AND reported_total_nurse_hrs IS NOT NULL
        GROUP BY FLOOR(CAST(reported_total_nurse_hrs AS FLOAT) * 2) / 2
        ORDER BY bucket
      `, { replacements });
      distributions.total_nursing_hprd = hprdDist;

      // Deficiency count distribution (buckets of 5)
      const [defDist] = await sequelize.query(`
        SELECT
          FLOOR(CAST(cycle1_total_health_deficiencies AS FLOAT) / 5) * 5 as bucket,
          COUNT(*) as count
        FROM facility_snapshots
        ${whereClause}
        AND cycle1_total_health_deficiencies IS NOT NULL
        GROUP BY FLOOR(CAST(cycle1_total_health_deficiencies AS FLOAT) / 5) * 5
        ORDER BY bucket
      `, { replacements });
      distributions.deficiency_count = defDist;

      // RN Turnover distribution (buckets of 10%)
      const [turnoverDist] = await sequelize.query(`
        SELECT
          FLOOR(CAST(rn_turnover AS FLOAT) / 10) * 10 as bucket,
          COUNT(*) as count
        FROM facility_snapshots
        ${whereClause}
        AND rn_turnover IS NOT NULL
        GROUP BY FLOOR(CAST(rn_turnover AS FLOAT) / 10) * 10
        ORDER BY bucket
      `, { replacements });
      distributions.rn_turnover = turnoverDist;

      // Occupancy distribution (buckets of 10%)
      const [occDist] = await sequelize.query(`
        SELECT
          FLOOR((CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) / 10) * 10 as bucket,
          COUNT(*) as count
        FROM facility_snapshots
        ${whereClause}
        AND average_residents_per_day IS NOT NULL
        AND certified_beds IS NOT NULL
        AND CAST(certified_beds AS FLOAT) > 0
        GROUP BY FLOOR((CAST(average_residents_per_day AS FLOAT) / NULLIF(CAST(certified_beds AS FLOAT), 0) * 100) / 10) * 10
        ORDER BY bucket
      `, { replacements });
      distributions.occupancy = occDist;

      res.json({
        success: true,
        facility: {
          ccn: facility.ccn,
          name: facility.provider_name,
          state: facility.state
        },
        percentiles,
        distributions,
        peer_group: {
          scope: scope,
          state: filterState || (scope === 'state' ? facility.state : null),
          size: size || null,
          facility_count: parseInt(facility_count)
        }
      });

    } finally {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error fetching percentiles:', error);
    res.status(500).json({ success: false, error: error.message });
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
