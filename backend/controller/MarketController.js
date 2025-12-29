/**
 * MarketController.js
 *
 * Market Intelligence controller for the refactored platform.
 *
 * This controller handles:
 * - Facility search across SNF/ALF databases
 * - Map filter options for facility visualization
 */

const helper = require("../config/helper");
const db = require("../models");
const sequelize = require("sequelize");
const Op = sequelize.Op;

// Services
const { searchFacilityByName } = require("../services/facilityMatcher");
const { getMarketPool } = require("../config/database");

/**
 * Get available filter options for the map from Cascadia facilities
 * @returns {Object} Filter options with statuses, serviceLines, companies, teams
 */
async function getMapFilterOptions() {
  const CascadiaFacility = require('../models').CascadiaFacility;

  const filterOptions = {
    statuses: [
      { value: 'pipeline', label: 'Pipeline' },
      { value: 'due_diligence', label: 'Due Diligence' },
      { value: 'hold', label: 'Hold' },
      { value: 'current_operations', label: 'Current Operations' }
    ],
    serviceLines: [
      { value: 'SNF', label: 'SNF' },
      { value: 'ALF', label: 'ALF' },
      { value: 'ILF', label: 'ILF' },
      { value: 'Home Office', label: 'Home Office' }
    ],
    companies: [],
    teams: []
  };

  // Get unique companies and teams from Cascadia facilities
  if (CascadiaFacility) {
    try {
      const companies = await CascadiaFacility.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('company')), 'company']],
        where: { company: { [Op.ne]: null } },
        raw: true
      });
      filterOptions.companies = companies
        .map(c => c.company)
        .filter(Boolean)
        .sort()
        .map(c => ({ value: c, label: c }));

      const teams = await CascadiaFacility.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('team')), 'team']],
        where: { team: { [Op.ne]: null } },
        raw: true
      });
      filterOptions.teams = teams
        .map(t => t.team)
        .filter(Boolean)
        .sort()
        .map(t => ({ value: t, label: t }));
    } catch (err) {
      console.log('Could not fetch Cascadia filter options:', err.message);
    }
  }

  return filterOptions;
}

// ============================================================================
// EXPRESS ROUTE HANDLERS (Endpoints)
// ============================================================================

module.exports = {
  /**
   * Get available filter options for the map
   * GET /api/v1/market/filter-options
   */
  getMapFilterOptions: async (req, res) => {
    try {
      const filterOptions = await getMapFilterOptions();
      return helper.success(res, "Filter options fetched successfully", filterOptions);
    } catch (err) {
      console.error("Get map filter options error:", err);
      return helper.error(res, err.message || "Failed to fetch filter options");
    }
  },

  /**
   * Search facilities by name in database (simple, direct query)
   * GET /api/v1/market/search-facilities
   *
   * Query params:
   * - searchTerm (required): Search string (min 2 characters)
   * - limit (optional): Max results (default 20)
   */
  searchFacilities: async (req, res) => {
    try {
      const { searchTerm, limit = 20 } = req.query;

      if (!searchTerm || searchTerm.length < 2) {
        return helper.success(res, 'Search term too short', { data: [] });
      }

      console.log(`[searchFacilities] Searching for "${searchTerm}" in SNF and HHA...`);

      const pool = getMarketPool();
      const searchPattern = `%${searchTerm}%`;
      const halfLimit = Math.ceil(parseInt(limit) / 2); // Get ~10 from each table

      // Run both queries in parallel
      const [snfResult, hhaResult] = await Promise.all([
        // Query 1: Search SNF facilities
        pool.query(`
          SELECT
            federal_provider_number as ccn,
            facility_name as name,
            city,
            state,
            overall_rating,
            certified_beds,
            'SNF' as type
          FROM snf_facilities
          WHERE
            facility_name ILIKE $1
            OR city ILIKE $1
            OR federal_provider_number ILIKE $1
          ORDER BY facility_name
          LIMIT $2
        `, [searchPattern, halfLimit]),

        // Query 2: Search Home Health agencies (most recent snapshot per CCN)
        pool.query(`
          SELECT DISTINCT ON (ccn)
            ccn,
            provider_name as name,
            city,
            state,
            quality_star_rating as overall_rating,
            NULL as certified_beds,
            'HHA' as type
          FROM hh_provider_snapshots
          WHERE
            provider_name ILIKE $1
            OR city ILIKE $1
            OR ccn ILIKE $1
          ORDER BY ccn, extract_id DESC
          LIMIT $2
        `, [searchPattern, halfLimit])
      ]);

      console.log(`[searchFacilities] Found ${snfResult.rows.length} SNF, ${hhaResult.rows.length} HHA`);

      // Combine results
      const combined = [...snfResult.rows, ...hhaResult.rows];

      // Sort by name (case-insensitive)
      combined.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Limit to requested max
      const finalResults = combined.slice(0, parseInt(limit));

      console.log(`[searchFacilities] Returning ${finalResults.length} combined results`);

      return helper.success(res, 'Search completed successfully', {
        data: finalResults
      });

    } catch (err) {
      console.error('[searchFacilities] Error:', err);
      return helper.error(res, err.message || 'Failed to search facilities');
    }
  },

  /**
   * Get facility details by CCN (CMS Certification Number)
   * GET /api/v1/market/facility/:ccn
   *
   * URL params:
   * - ccn (required): CMS Certification Number (e.g., "015009")
   */
  getFacilityByCCN: async (req, res) => {
    try {
      const { ccn } = req.params;

      if (!ccn) {
        return helper.error(res, 'CCN (CMS Certification Number) is required');
      }

      console.log(`[getFacilityByCCN] Fetching facility with CCN: ${ccn}`);

      const pool = getMarketPool();

      // Query snf_facilities table for full facility details
      const result = await pool.query(`
        SELECT
          federal_provider_number as ccn,
          provider_name as facility_name,
          provider_address as address,
          provider_city as city,
          provider_state as state,
          provider_zip_code as zip_code,
          provider_county_name as county,
          provider_phone_number as phone,
          ownership_type,
          number_of_certified_beds as total_beds,
          number_of_residents as resident_count,
          average_number_of_residents_per_day as avg_daily_census,
          overall_rating,
          health_inspection_rating,
          staffing_rating,
          quality_measure_rating as qm_rating,
          reported_nurse_aide_staffing_hours_per_resident_per_day as cna_hrs_per_resident,
          reported_lpn_staffing_hours_per_resident_per_day as lpn_hrs_per_resident,
          reported_rn_staffing_hours_per_resident_per_day as rn_hrs_per_resident,
          reported_licensed_staffing_hours_per_resident_per_day as licensed_hrs_per_resident,
          reported_total_nurse_staffing_hours_per_resident_per_day as total_nurse_hrs_per_resident,
          total_nursing_staff_turnover,
          registered_nurse_turnover,
          administrator_departure,
          number_of_health_deficiencies,
          number_of_fire_safety_deficiencies,
          total_weighted_health_survey_score,
          latitude,
          longitude,
          location_updated_date,
          processing_date as last_updated
        FROM snf_facilities
        WHERE federal_provider_number = $1
        LIMIT 1
      `, [ccn]);

      if (result.rows.length === 0) {
        return helper.error(res, `No facility found with CCN: ${ccn}`, 404);
      }

      const facility = result.rows[0];

      console.log(`[getFacilityByCCN] Found facility: ${facility.facility_name}`);

      return helper.success(res, 'Facility details fetched successfully', {
        facility: facility
      });

    } catch (err) {
      console.error('[getFacilityByCCN] Error:', err);
      return helper.error(res, err.message || 'Failed to fetch facility details');
    }
  },

  /**
   * Get provider metadata by CCN (unified SNF/HHA lookup)
   * GET /api/v1/market/provider/:ccn/metadata
   *
   * Returns provider type and basic info for SNF or HHA
   */
  getProviderMetadata: async (req, res) => {
    try {
      const { ccn } = req.params;

      if (!ccn) {
        return helper.error(res, 'CCN is required');
      }

      console.log(`[getProviderMetadata] Looking up CCN: ${ccn}`);

      const pool = getMarketPool();

      // Step 1: Check SNF facilities first (use correct column names)
      try {
        const snfResult = await pool.query(`
          SELECT
            federal_provider_number as ccn,
            provider_name as name,
            provider_city as city,
            provider_state as state,
            overall_rating,
            number_of_certified_beds as certified_beds,
            ownership_type,
            latitude,
            longitude
          FROM snf_facilities
          WHERE federal_provider_number = $1
          LIMIT 1
        `, [ccn]);

        if (snfResult.rows.length > 0) {
          const facility = snfResult.rows[0];
          console.log(`[getProviderMetadata] Found SNF: ${facility.name}`);
          return helper.success(res, 'Provider metadata fetched successfully', {
            type: 'SNF',
            ccn: facility.ccn,
            name: facility.name,
            city: facility.city,
            state: facility.state,
            overall_rating: facility.overall_rating,
            certified_beds: facility.certified_beds,
            ownership_type: facility.ownership_type,
            latitude: facility.latitude,
            longitude: facility.longitude
          });
        }
      } catch (snfErr) {
        console.warn(`[getProviderMetadata] SNF lookup failed: ${snfErr.message}`);
        // Continue to HHA lookup
      }

      // Step 2: Check Home Health Agency snapshots
      try {
        const hhaResult = await pool.query(`
          SELECT
            ccn,
            provider_name as name,
            city,
            state,
            quality_star_rating,
            ownership_type,
            latitude,
            longitude
          FROM hh_provider_snapshots
          WHERE ccn = $1
          ORDER BY extract_id DESC
          LIMIT 1
        `, [ccn]);

        if (hhaResult.rows.length > 0) {
          const agency = hhaResult.rows[0];
          console.log(`[getProviderMetadata] Found HHA: ${agency.name}`);
          return helper.success(res, 'Provider metadata fetched successfully', {
            type: 'HHA',
            ccn: agency.ccn,
            name: agency.name,
            city: agency.city,
            state: agency.state,
            quality_star_rating: agency.quality_star_rating,
            ownership_type: agency.ownership_type,
            latitude: agency.latitude,
            longitude: agency.longitude
          });
        }
      } catch (hhaErr) {
        console.warn(`[getProviderMetadata] HHA lookup failed: ${hhaErr.message}`);
        // Continue to not found
      }

      // Step 3: Not found in either table - return null-like response (not crash)
      console.log(`[getProviderMetadata] No provider found for CCN: ${ccn}`);
      return res.status(404).json({
        success: false,
        message: `No provider found with CCN: ${ccn}`,
        data: null
      });

    } catch (err) {
      console.error('[getProviderMetadata] Error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch provider metadata',
        data: null
      });
    }
  },

  // ============================================================================
  // EXPORTED UTILITY FUNCTIONS (for use by other controllers/services)
  // ============================================================================

  /**
   * Get map filter options (utility function)
   * Can be called directly without HTTP request/response
   */
  getMapFilterOptionsUtil: getMapFilterOptions
};
