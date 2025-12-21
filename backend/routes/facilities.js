/**
 * SNF/ALF Facilities API Routes
 *
 * Provides endpoints for searching, matching, and viewing facility profiles
 * from the CMS nursing home and ALF reference databases
 *
 * Database Strategy:
 * - Market DB (MARKET_DATABASE_URL): For current facility data (snf_facilities, alf_facilities, cms_facility_deficiencies)
 * - Main DB (DATABASE_URL): For time-series data (facility_snapshots, vbp_scores, health_citations, etc.)
 */

const express = require('express');
const router = express.Router();
const {
  matchFacility,
  searchFacilities,
  getFacilitiesNearby
} = require('../services/facilityMatcher');
const { getMarketPool } = require('../config/database');

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

    // Use Market DB for current facility data
    const pool = getMarketPool();

    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (name) {
      whereClause += ` AND facility_name ILIKE $${paramIndex}`;
      params.push(`%${name}%`);
      paramIndex++;
    }
    if (state) {
      whereClause += ` AND state = $${paramIndex}`;
      params.push(state.toUpperCase());
      paramIndex++;
    }
    if (city) {
      whereClause += ` AND city ILIKE $${paramIndex}`;
      params.push(`%${city}%`);
      paramIndex++;
    }
    if (minBeds) {
      whereClause += ` AND certified_beds >= $${paramIndex}`;
      params.push(parseInt(minBeds));
      paramIndex++;
    }
    if (maxBeds) {
      whereClause += ` AND certified_beds <= $${paramIndex}`;
      params.push(parseInt(maxBeds));
      paramIndex++;
    }
    if (minRating) {
      whereClause += ` AND overall_rating >= $${paramIndex}`;
      params.push(parseInt(minRating));
      paramIndex++;
    }
    if (maxRating) {
      whereClause += ` AND overall_rating <= $${paramIndex}`;
      params.push(parseInt(maxRating));
      paramIndex++;
    }

    // Query snf_facilities from Market DB
    const exactMatchParam = name ? `${name}%` : '%';
    const facilitiesResult = await pool.query(`
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
        CASE WHEN facility_name ILIKE $${paramIndex} THEN 0 ELSE 1 END,
        facility_name
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `, [...params, exactMatchParam, parseInt(limit), parseInt(offset)]);

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM snf_facilities WHERE ${whereClause}
    `, params);

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].total),
      facilities: facilitiesResult.rows
    });

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
 * Uses Market DB for cms_facility_deficiencies
 */
router.get('/snf/:ccn/deficiencies', async (req, res) => {
  try {
    const { ccn } = req.params;

    // Use Market DB for deficiency data
    const pool = getMarketPool();

    const result = await pool.query(`
      SELECT
        survey_date,
        survey_type,
        deficiency_tag,
        scope_severity,
        deficiency_text,
        correction_date,
        is_corrected
      FROM cms_facility_deficiencies
      WHERE federal_provider_number = $1
      ORDER BY survey_date DESC
      LIMIT 100
    `, [ccn]);

    res.json({ success: true, deficiencies: result.rows });
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

/**
 * GET /api/facilities/snf/:ccn/vbp-rankings
 * Get VBP rankings for a facility at national, state, market, and chain levels
 */
router.get('/snf/:ccn/vbp-rankings', async (req, res) => {
  try {
    const { ccn } = req.params;
    const { year } = req.query;
    const { getSequelizeInstance } = require('../config/database');
    const sequelize = getSequelizeInstance();

    try {
      // Get rankings - either for specific year or most recent
      let query;
      let replacements = { ccn };

      if (year) {
        query = `
          SELECT *
          FROM facility_vbp_rankings
          WHERE federal_provider_number = :ccn
            AND fiscal_year = :year
        `;
        replacements.year = parseInt(year);
      } else {
        // Get most recent year's rankings
        query = `
          SELECT *
          FROM facility_vbp_rankings
          WHERE federal_provider_number = :ccn
          ORDER BY fiscal_year DESC
          LIMIT 1
        `;
      }

      const [results] = await sequelize.query(query, { replacements });

      if (results.length === 0) {
        return res.json({
          success: true,
          rankings: null,
          message: 'No VBP rankings found for this facility'
        });
      }

      const r = results[0];

      // Format response
      const rankings = {
        fiscal_year: r.fiscal_year,
        national: {
          rank: r.national_rank,
          total: r.national_total,
          percentile: parseFloat(r.national_percentile)
        },
        state: r.state_rank ? {
          rank: r.state_rank,
          total: r.state_total,
          percentile: parseFloat(r.state_percentile)
        } : null,
        market: r.market_rank ? {
          rank: r.market_rank,
          total: r.market_total,
          percentile: parseFloat(r.market_percentile)
        } : null,
        chain: r.chain_rank ? {
          rank: r.chain_rank,
          total: r.chain_total,
          percentile: parseFloat(r.chain_percentile)
        } : null,
        calculated_at: r.calculated_at
      };

      res.json({ success: true, rankings });
    } finally {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error fetching VBP rankings:', error);
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
 * Uses Market DB for alf_facilities
 */
router.get('/stats', async (req, res) => {
  try {
    // Use Market DB for ALF facility stats
    const pool = getMarketPool();

    // Get total count
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM alf_facilities');

    // Get facilities by state
    const byStateResult = await pool.query(`
      SELECT state, COUNT(*) as count
      FROM alf_facilities
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      total_facilities: parseInt(totalResult.rows[0].total),
      facilities_by_state: byStateResult.rows
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// VBP (VALUE-BASED PURCHASING) DATA API
// ============================================================================

/**
 * GET /api/facilities/snf/:ccn/vbp
 * Get comprehensive VBP data for a facility
 *
 * Returns:
 * - current: Detailed current year data with all 4 measure domains
 * - history: 6 years of historical VBP scores
 * - rankings: National, state, market, and chain rankings
 * - estimated_impact: Dollar impact calculations
 */
router.get('/snf/:ccn/vbp', async (req, res) => {
  const { ccn } = req.params;

  if (!ccn) {
    return res.status(400).json({
      success: false,
      error: 'CCN is required'
    });
  }

  const { getSequelizeInstance } = require('../config/database');
  const sequelize = getSequelizeInstance();

  try {
    // Get current year detailed data from snf_vbp_performance (FY2026)
    const [currentResult] = await sequelize.query(`
      SELECT
        fiscal_year,
        performance_score,
        incentive_payment_multiplier,
        incentive_percentage,
        -- Readmission measures
        baseline_readmission_rate,
        performance_readmission_rate,
        readmission_achievement_score,
        readmission_improvement_score,
        readmission_measure_score,
        -- HAI measures
        baseline_hai_rate,
        performance_hai_rate,
        hai_achievement_score,
        hai_improvement_score,
        hai_measure_score,
        -- Turnover measures
        baseline_turnover_rate,
        performance_turnover_rate,
        turnover_achievement_score,
        turnover_improvement_score,
        turnover_measure_score,
        -- Staffing measures
        baseline_staffing_hours,
        performance_staffing_hours,
        staffing_achievement_score,
        staffing_improvement_score,
        staffing_measure_score
      FROM snf_vbp_performance
      WHERE cms_certification_number = :ccn
      ORDER BY fiscal_year DESC
      LIMIT 1
    `, {
      replacements: { ccn }
    });

    // Get historical data from vbp_scores (6 years)
    const [historyResult] = await sequelize.query(`
      SELECT
        fiscal_year,
        performance_score,
        incentive_payment_multiplier,
        baseline_readmission_rate,
        baseline_period,
        performance_readmission_rate,
        performance_period,
        achievement_score,
        improvement_score,
        vbp_ranking
      FROM vbp_scores
      WHERE ccn = :ccn
      ORDER BY fiscal_year DESC
    `, {
      replacements: { ccn }
    });

    // Get rankings from facility_vbp_rankings (most recent year)
    const [rankingsResult] = await sequelize.query(`
      SELECT
        fiscal_year,
        national_rank, national_total, national_percentile,
        state_rank, state_total, state_percentile,
        market_rank, market_total, market_percentile,
        chain_rank, chain_total, chain_percentile
      FROM facility_vbp_rankings
      WHERE federal_provider_number = :ccn
      ORDER BY fiscal_year DESC
      LIMIT 1
    `, {
      replacements: { ccn }
    });

    // Get facility info for benchmarks and dollar impact
    const [facilityResult] = await sequelize.query(`
      SELECT certified_beds, state, county
      FROM snf_facilities
      WHERE federal_provider_number = :ccn
      LIMIT 1
    `, {
      replacements: { ccn }
    });

    const facilityState = facilityResult?.[0]?.state;
    const facilityCounty = facilityResult?.[0]?.county;

    // Get benchmark averages (national, state, county) for each measure
    const [benchmarkResult] = await sequelize.query(`
      WITH facility_info AS (
        SELECT state, county
        FROM snf_facilities
        WHERE federal_provider_number = :ccn
        LIMIT 1
      )
      SELECT
        -- National averages
        AVG(performance_readmission_rate) as national_readmission,
        AVG(performance_hai_rate) as national_hai,
        AVG(performance_turnover_rate) as national_turnover,
        AVG(performance_staffing_hours) as national_staffing,
        -- State averages
        AVG(CASE WHEN v.state = (SELECT state FROM facility_info)
            THEN performance_readmission_rate END) as state_readmission,
        AVG(CASE WHEN v.state = (SELECT state FROM facility_info)
            THEN performance_hai_rate END) as state_hai,
        AVG(CASE WHEN v.state = (SELECT state FROM facility_info)
            THEN performance_turnover_rate END) as state_turnover,
        AVG(CASE WHEN v.state = (SELECT state FROM facility_info)
            THEN performance_staffing_hours END) as state_staffing,
        -- County averages (using snf_facilities for county lookup)
        AVG(CASE WHEN f.county = (SELECT county FROM facility_info) AND f.state = (SELECT state FROM facility_info)
            THEN performance_readmission_rate END) as county_readmission,
        AVG(CASE WHEN f.county = (SELECT county FROM facility_info) AND f.state = (SELECT state FROM facility_info)
            THEN performance_hai_rate END) as county_hai,
        AVG(CASE WHEN f.county = (SELECT county FROM facility_info) AND f.state = (SELECT state FROM facility_info)
            THEN performance_turnover_rate END) as county_turnover,
        AVG(CASE WHEN f.county = (SELECT county FROM facility_info) AND f.state = (SELECT state FROM facility_info)
            THEN performance_staffing_hours END) as county_staffing
      FROM snf_vbp_performance v
      LEFT JOIN snf_facilities f ON v.cms_certification_number = f.federal_provider_number
      WHERE v.fiscal_year = (SELECT MAX(fiscal_year) FROM snf_vbp_performance)
    `, {
      replacements: { ccn }
    });

    // Build current year response
    let current = null;
    if (currentResult && currentResult.length > 0) {
      const c = currentResult[0];
      current = {
        fiscal_year: c.fiscal_year,
        performance_score: parseFloat(c.performance_score) || null,
        incentive_multiplier: parseFloat(c.incentive_payment_multiplier) || null,
        incentive_percentage: parseFloat(c.incentive_percentage) || null,
        measures: {
          readmission: {
            baseline_rate: parseFloat(c.baseline_readmission_rate) || null,
            performance_rate: parseFloat(c.performance_readmission_rate) || null,
            achievement_score: parseFloat(c.readmission_achievement_score) || null,
            improvement_score: parseFloat(c.readmission_improvement_score) || null,
            measure_score: parseFloat(c.readmission_measure_score) || null
          },
          hai: {
            baseline_rate: parseFloat(c.baseline_hai_rate) || null,
            performance_rate: parseFloat(c.performance_hai_rate) || null,
            achievement_score: parseFloat(c.hai_achievement_score) || null,
            improvement_score: parseFloat(c.hai_improvement_score) || null,
            measure_score: parseFloat(c.hai_measure_score) || null
          },
          turnover: {
            baseline_rate: parseFloat(c.baseline_turnover_rate) || null,
            performance_rate: parseFloat(c.performance_turnover_rate) || null,
            achievement_score: parseFloat(c.turnover_achievement_score) || null,
            improvement_score: parseFloat(c.turnover_improvement_score) || null,
            measure_score: parseFloat(c.turnover_measure_score) || null
          },
          staffing: {
            baseline_hours: parseFloat(c.baseline_staffing_hours) || null,
            performance_hours: parseFloat(c.performance_staffing_hours) || null,
            achievement_score: parseFloat(c.staffing_achievement_score) || null,
            improvement_score: parseFloat(c.staffing_improvement_score) || null,
            measure_score: parseFloat(c.staffing_measure_score) || null
          }
        }
      };
    }

    // Build history response
    const history = (historyResult || []).map(h => ({
      fiscal_year: h.fiscal_year,
      performance_score: parseFloat(h.performance_score) || null,
      incentive_multiplier: parseFloat(h.incentive_payment_multiplier) || null,
      baseline_readmission_rate: parseFloat(h.baseline_readmission_rate) || null,
      baseline_period: h.baseline_period,
      performance_readmission_rate: parseFloat(h.performance_readmission_rate) || null,
      performance_period: h.performance_period,
      achievement_score: parseFloat(h.achievement_score) || null,
      improvement_score: parseFloat(h.improvement_score) || null,
      vbp_ranking: h.vbp_ranking
    }));

    // Build rankings response
    let rankings = null;
    if (rankingsResult && rankingsResult.length > 0) {
      const r = rankingsResult[0];
      rankings = {
        fiscal_year: r.fiscal_year,
        national: {
          rank: r.national_rank,
          total: r.national_total,
          percentile: parseFloat(r.national_percentile) || null
        },
        state: {
          rank: r.state_rank,
          total: r.state_total,
          percentile: parseFloat(r.state_percentile) || null
        },
        market: {
          rank: r.market_rank,
          total: r.market_total,
          percentile: parseFloat(r.market_percentile) || null
        },
        chain: {
          rank: r.chain_rank,
          total: r.chain_total,
          percentile: parseFloat(r.chain_percentile) || null
        }
      };
    }

    // Calculate estimated dollar impact
    let estimated_impact = null;
    const certifiedBeds = facilityResult && facilityResult.length > 0
      ? parseInt(facilityResult[0].certified_beds)
      : null;
    const multiplier = current?.incentive_multiplier || (history.length > 0 ? history[0].incentive_multiplier : null);

    if (certifiedBeds && multiplier) {
      // Estimate: beds * 365 days * 30% Medicare * $500/day
      const estimatedMedicareRevenue = certifiedBeds * 365 * 0.30 * 500;
      const dollarImpact = estimatedMedicareRevenue * (multiplier - 1);

      // Calculate improvement potential (if they reached 90th percentile multiplier ~1.02)
      const targetMultiplier = 1.02;
      const improvementPotential = multiplier < targetMultiplier
        ? estimatedMedicareRevenue * (targetMultiplier - multiplier)
        : 0;

      estimated_impact = {
        certified_beds: certifiedBeds,
        estimated_medicare_revenue: Math.round(estimatedMedicareRevenue),
        current_multiplier: multiplier,
        dollar_impact: Math.round(dollarImpact),
        target_multiplier: targetMultiplier,
        improvement_potential: Math.round(improvementPotential)
      };
    }

    // Build benchmarks response
    let benchmarks = null;
    if (benchmarkResult && benchmarkResult.length > 0) {
      const b = benchmarkResult[0];
      benchmarks = {
        readmission: {
          national: parseFloat(b.national_readmission) || null,
          state: parseFloat(b.state_readmission) || null,
          county: parseFloat(b.county_readmission) || null
        },
        hai: {
          national: parseFloat(b.national_hai) || null,
          state: parseFloat(b.state_hai) || null,
          county: parseFloat(b.county_hai) || null
        },
        turnover: {
          national: parseFloat(b.national_turnover) || null,
          state: parseFloat(b.state_turnover) || null,
          county: parseFloat(b.county_turnover) || null
        },
        staffing: {
          national: parseFloat(b.national_staffing) || null,
          state: parseFloat(b.state_staffing) || null,
          county: parseFloat(b.county_staffing) || null
        }
      };
    }

    // Return response
    res.json({
      success: true,
      data: {
        current,
        history,
        rankings,
        benchmarks,
        estimated_impact
      }
    });

  } catch (error) {
    console.error('[Facilities API] Error fetching VBP data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VBP data',
      message: error.message
    });
  }
});

module.exports = router;
