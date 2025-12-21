/**
 * Ownership Research API Routes
 *
 * Provides ownership intelligence endpoints for facility and chain research.
 * Uses Claude API for natural language facility search.
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const requireAuthentication = require("../passport").authenticateUser;
const db = require('../models');
const { createNotification } = require('../services/notificationService');

// Database connection configuration
const getPool = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
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

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * GET /api/v1/ownership/top-chains
 * Get top SNF chains nationwide ranked by facility count or beds
 * @query {number} limit - Number of chains to return (default 20)
 * @query {string} sortBy - Sort by 'facilities' or 'beds' (default 'beds')
 */
router.get('/top-chains', async (req, res) => {
  try {
    const { limit = 20, sortBy = 'beds' } = req.query;
    const pool = getPoolInstance();

    // Determine sort column and ranking based on sortBy parameter
    const sortColumn = sortBy === 'facilities' ? 'COUNT(*)' : 'SUM(total_beds)';
    const orderColumn = sortBy === 'facilities' ? 'facility_count' : 'total_beds';

    const result = await pool.query(`
      SELECT
        ownership_chain,
        COUNT(*) as facility_count,
        SUM(total_beds) as total_beds,
        COUNT(DISTINCT state) as state_count,
        AVG(overall_rating) as avg_rating,
        AVG(occupancy_rate) as avg_occupancy,
        AVG(health_deficiencies) as avg_deficiencies,
        ROW_NUMBER() OVER (ORDER BY ${sortColumn} DESC) as ranking
      FROM snf_facilities
      WHERE active = true
        AND ownership_chain IS NOT NULL
        AND ownership_chain != ''
      GROUP BY ownership_chain
      ORDER BY ${orderColumn} DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Ownership Routes] getTopChains error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/ownership/stats
 * Get overall ownership statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const pool = getPoolInstance();

    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT ownership_chain) as total_chains,
        COUNT(*) as total_facilities,
        SUM(total_beds) as total_beds,
        AVG(overall_rating) as avg_rating
      FROM snf_facilities
      WHERE active = true
        AND ownership_chain IS NOT NULL
        AND ownership_chain != ''
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[Ownership Routes] getStats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/ownership/search
 * Search ownership chains with filters
 */
router.get('/search', async (req, res) => {
  try {
    const {
      search = '',
      ownershipType = 'all',
      minFacilities = '0',
      minBeds = '0',
      sortBy = 'facilities'
    } = req.query;

    const pool = getPoolInstance();

    let orderBy = 'facility_count DESC';
    switch (sortBy) {
      case 'beds':
        orderBy = 'total_beds DESC';
        break;
      case 'rating':
        orderBy = 'avg_rating DESC NULLS LAST';
        break;
      case 'name':
        orderBy = 'ownership_chain ASC';
        break;
    }

    // Parse numeric filters, defaulting to 0 for empty/invalid values
    const minFacilitiesNum = parseInt(minFacilities) || 0;
    const minBedsNum = parseInt(minBeds) || 0;

    // Build dynamic query
    let whereConditions = [`
      active = true
      AND ownership_chain IS NOT NULL
      AND ownership_chain != ''
    `];
    let params = [minFacilitiesNum, minBedsNum];
    let paramIndex = 3;

    if (ownershipType !== 'all') {
      whereConditions.push(`ownership_type ILIKE $${paramIndex}`);
      params.push(`%${ownershipType}%`);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`LOWER(ownership_chain) LIKE LOWER($${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await pool.query(`
      WITH chain_stats AS (
        SELECT
          ownership_chain,
          COUNT(*) as facility_count,
          SUM(total_beds) as total_beds,
          COUNT(DISTINCT state) as state_count,
          AVG(overall_rating) as avg_rating,
          AVG(occupancy_rate) as avg_occupancy,
          AVG(health_deficiencies) as avg_deficiencies,
          -- Get the most common ownership type for this chain
          MODE() WITHIN GROUP (ORDER BY ownership_type) as ownership_type
        FROM snf_facilities
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ownership_chain
      ),
      ranked_chains AS (
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY facility_count DESC) as ranking
        FROM chain_stats
        WHERE facility_count >= $1
          AND COALESCE(total_beds, 0) >= $2
      )
      SELECT *
      FROM ranked_chains
      ORDER BY ${orderBy}
      LIMIT 100
    `, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Ownership Routes] search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/ownership/:ownerName/details
 * Get detailed information for a specific owner/chain
 */
router.get('/:ownerName/details', async (req, res) => {
  try {
    const { ownerName } = req.params;
    const pool = getPoolInstance();

    // Get aggregated stats
    const statsResult = await pool.query(`
      SELECT
        ownership_chain as chain_name,
        ownership_type,
        COUNT(*) as facility_count,
        SUM(total_beds) as total_beds,
        COUNT(DISTINCT state) as state_count,
        AVG(overall_rating) as avg_rating,
        AVG(occupancy_rate) as avg_occupancy,
        AVG(health_deficiencies) as avg_deficiencies,
        AVG(staffing_rating) as avg_staffing_rating,
        AVG(health_inspection_rating) as avg_health_rating,
        AVG(quality_measure_rating) as avg_quality_rating
      FROM snf_facilities
      WHERE ownership_chain = $1 AND active = true
      GROUP BY ownership_chain, ownership_type
    `, [ownerName]);

    if (statsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Owner not found'
      });
    }

    // Get state breakdown
    const stateBreakdown = await pool.query(`
      SELECT
        state,
        COUNT(*) as facility_count,
        SUM(total_beds) as total_beds,
        AVG(overall_rating) as avg_rating
      FROM snf_facilities
      WHERE ownership_chain = $1 AND active = true
      GROUP BY state
      ORDER BY facility_count DESC
    `, [ownerName]);

    // Get all facilities
    const facilities = await pool.query(`
      SELECT
        federal_provider_number,
        facility_name,
        city,
        state,
        total_beds,
        overall_rating,
        occupancy_rate,
        health_deficiencies
      FROM snf_facilities
      WHERE ownership_chain = $1 AND active = true
      ORDER BY state, city, facility_name
    `, [ownerName]);

    const stats = statsResult.rows[0];
    res.json({
      success: true,
      data: {
        chainName: stats.chain_name,
        ownershipType: stats.ownership_type,
        facilityCount: parseInt(stats.facility_count),
        totalBeds: parseInt(stats.total_beds) || 0,
        stateCount: parseInt(stats.state_count),
        avgRating: parseFloat(stats.avg_rating) || 0,
        avgOccupancy: parseFloat(stats.avg_occupancy) || 0,
        avgDeficiencies: parseFloat(stats.avg_deficiencies) || 0,
        avgStaffingRating: parseFloat(stats.avg_staffing_rating) || 0,
        avgHealthRating: parseFloat(stats.avg_health_rating) || 0,
        avgQualityRating: parseFloat(stats.avg_quality_rating) || 0,
        stateBreakdown: stateBreakdown.rows,
        facilities: facilities.rows
      }
    });
  } catch (error) {
    console.error('[Ownership Routes] getOwnerDetails error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/ownership/facility-search
 * Natural language facility search using Claude
 */
router.post('/facility-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query string is required'
      });
    }

    console.log('[Ownership] Natural language query:', query);

    // Use Claude to parse natural language into structured filters
    const parsePrompt = `You are a facility search query parser. Convert natural language queries into structured database filters.

Available facility attributes:
- states: Array of 2-letter state codes (e.g., ["WA", "OR", "ID"])
- counties: Array of county names
- cities: Array of city names
- ownershipTypes: Array from ["For profit", "Non-profit", "Government"]
- minBeds, maxBeds: Numbers for bed count range
- minOccupancy, maxOccupancy: Numbers for occupancy percentage (0-100)
- minOverallRating, maxOverallRating: Star ratings 1-5
- minHealthRating, maxHealthRating: Health inspection rating 1-5
- minStaffingRating, maxStaffingRating: Staffing rating 1-5
- maxDeficiencies: Maximum number of health deficiencies
- acceptsMedicare: true/false
- acceptsMedicaid: true/false
- chainSizeMin, chainSizeMax: Number of facilities in ownership group
- multiFacilityChain: true (part of chain) or false (independent)
- specialFocusFacility: true/false (SFF designation - facilities with serious quality issues)
- searchTerm: Text to search in facility name or parent organization

Regional mappings:
- Pacific Northwest: ["WA", "OR", "ID"]
- Northeast: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"]
- Southeast: ["MD", "DE", "VA", "WV", "KY", "TN", "NC", "SC", "GA", "FL", "AL", "MS", "LA", "AR"]
- Midwest: ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"]
- Southwest: ["TX", "OK", "NM", "AZ"]
- West: ["MT", "WY", "CO", "UT", "NV", "CA", "AK", "HI"]

Parse this query: "${query}"

Return ONLY a JSON object with the appropriate filters. Use null for filters that don't apply.

Example outputs:
Query: "facilities in California with 4+ stars"
{"states": ["CA"], "minOverallRating": 4}

Query: "small independent facilities in the midwest"
{"states": ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"], "maxBeds": 50, "multiFacilityChain": false}

Query: "show me all skilled nursing facilities that are part of an ownership group of 10 or less and are located in the pacific northwest"
{"states": ["WA", "OR", "ID"], "chainSizeMax": 10, "multiFacilityChain": true}

Return ONLY valid JSON with no additional text:`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: 'user', content: parsePrompt }]
    });

    const parsedText = response.content[0].text.trim();
    console.log('[Ownership] Claude parsed filters:', parsedText);

    // Extract JSON from response
    let filters;
    try {
      const jsonMatch = parsedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      filters = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[Ownership] Failed to parse Claude response:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse query. Please try rephrasing.',
        details: parsedText
      });
    }

    // Execute search with parsed filters
    const results = await searchFacilitiesAdvanced(filters);

    res.json({
      success: true,
      query,
      filters,
      results: results.facilities,
      total: results.total,
      hasMore: results.hasMore
    });
  } catch (error) {
    console.error('[Ownership Routes] facilitySearch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Advanced facility search with structured filters
 */
async function searchFacilitiesAdvanced(filters) {
  const pool = getPoolInstance();

  // Use f. prefix for all conditions since main query uses 'f' as alias
  let whereConditions = ['f.active = true'];
  let params = [];
  let paramIndex = 1;

  // State filter
  if (filters.states && filters.states.length > 0) {
    whereConditions.push(`f.state = ANY($${paramIndex})`);
    params.push(filters.states);
    paramIndex++;
  }

  // Rating filters
  if (filters.minOverallRating) {
    whereConditions.push(`f.overall_rating >= $${paramIndex}`);
    params.push(filters.minOverallRating);
    paramIndex++;
  }
  if (filters.maxOverallRating) {
    whereConditions.push(`f.overall_rating <= $${paramIndex}`);
    params.push(filters.maxOverallRating);
    paramIndex++;
  }

  // Bed count filters
  if (filters.minBeds) {
    whereConditions.push(`f.total_beds >= $${paramIndex}`);
    params.push(filters.minBeds);
    paramIndex++;
  }
  if (filters.maxBeds) {
    whereConditions.push(`f.total_beds <= $${paramIndex}`);
    params.push(filters.maxBeds);
    paramIndex++;
  }

  // Occupancy filters
  if (filters.minOccupancy) {
    whereConditions.push(`f.occupancy_rate >= $${paramIndex}`);
    params.push(filters.minOccupancy);
    paramIndex++;
  }
  if (filters.maxOccupancy) {
    whereConditions.push(`f.occupancy_rate <= $${paramIndex}`);
    params.push(filters.maxOccupancy);
    paramIndex++;
  }

  // Deficiency filter
  if (filters.maxDeficiencies !== undefined && filters.maxDeficiencies !== null) {
    whereConditions.push(`COALESCE(f.health_deficiencies, 0) <= $${paramIndex}`);
    params.push(filters.maxDeficiencies);
    paramIndex++;
  }

  // Ownership type filter
  if (filters.ownershipTypes && filters.ownershipTypes.length > 0) {
    whereConditions.push(`f.ownership_type = ANY($${paramIndex})`);
    params.push(filters.ownershipTypes);
    paramIndex++;
  }

  // Chain size filters (via subquery)
  if (filters.chainSizeMin || filters.chainSizeMax || filters.multiFacilityChain !== undefined) {
    // First get chain sizes - use different alias (sf) to avoid ambiguity
    const chainSizeSubquery = `
      f.ownership_chain IN (
        SELECT sf.ownership_chain
        FROM snf_facilities sf
        WHERE sf.active = true AND sf.ownership_chain IS NOT NULL AND sf.ownership_chain != ''
        GROUP BY sf.ownership_chain
        HAVING COUNT(*) ${filters.chainSizeMin ? `>= ${parseInt(filters.chainSizeMin)}` : '>= 1'}
        ${filters.chainSizeMax ? `AND COUNT(*) <= ${parseInt(filters.chainSizeMax)}` : ''}
      )
    `;

    if (filters.multiFacilityChain === true) {
      whereConditions.push(`(${chainSizeSubquery})`);
    } else if (filters.multiFacilityChain === false) {
      // Independent facilities
      whereConditions.push(`(
        f.ownership_chain IS NULL
        OR f.ownership_chain = ''
        OR f.ownership_chain IN (
          SELECT sf.ownership_chain
          FROM snf_facilities sf
          WHERE sf.active = true AND sf.ownership_chain IS NOT NULL AND sf.ownership_chain != ''
          GROUP BY sf.ownership_chain
          HAVING COUNT(*) = 1
        )
      )`);
    } else if (filters.chainSizeMin || filters.chainSizeMax) {
      whereConditions.push(`(${chainSizeSubquery})`);
    }
  }

  // Special focus facility
  if (filters.specialFocusFacility !== undefined) {
    whereConditions.push(`f.special_focus_facility = $${paramIndex}`);
    params.push(filters.specialFocusFacility);
    paramIndex++;
  }

  // Medicare/Medicaid
  if (filters.acceptsMedicare !== undefined) {
    whereConditions.push(`f.accepts_medicare = $${paramIndex}`);
    params.push(filters.acceptsMedicare);
    paramIndex++;
  }
  if (filters.acceptsMedicaid !== undefined) {
    whereConditions.push(`f.accepts_medicaid = $${paramIndex}`);
    params.push(filters.acceptsMedicaid);
    paramIndex++;
  }

  // Search term
  if (filters.searchTerm) {
    whereConditions.push(`(
      LOWER(f.facility_name) LIKE LOWER($${paramIndex})
      OR LOWER(f.ownership_chain) LIKE LOWER($${paramIndex})
    )`);
    params.push(`%${filters.searchTerm}%`);
    paramIndex++;
  }

  // Get chain facility counts
  const query = `
    WITH chain_counts AS (
      SELECT ownership_chain, COUNT(*) as chain_facility_count
      FROM snf_facilities
      WHERE active = true AND ownership_chain IS NOT NULL AND ownership_chain != ''
      GROUP BY ownership_chain
    )
    SELECT
      f.id,
      f.federal_provider_number,
      f.facility_name,
      f.address,
      f.city,
      f.state,
      f.zip_code,
      f.county,
      f.phone,
      f.ownership_type,
      f.ownership_chain,
      f.total_beds,
      f.certified_beds,
      f.occupancy_rate,
      f.overall_rating,
      f.health_inspection_rating,
      f.staffing_rating,
      f.quality_measure_rating,
      f.health_deficiencies,
      f.accepts_medicare,
      f.accepts_medicaid,
      f.special_focus_facility,
      f.latitude,
      f.longitude,
      COALESCE(cc.chain_facility_count, 1) as chain_facility_count
    FROM snf_facilities f
    LEFT JOIN chain_counts cc ON f.ownership_chain = cc.ownership_chain
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY f.overall_rating DESC NULLS LAST, f.facility_name ASC
    LIMIT 1000
  `;

  const result = await pool.query(query, params);

  return {
    facilities: result.rows,
    total: result.rows.length,
    hasMore: result.rows.length === 1000
  };
}

// =============================================================================
// OWNERSHIP PROFILES ENDPOINTS
// Pre-computed aggregates for parent organizations with 2+ facilities
// =============================================================================

/**
 * GET /api/v1/ownership/profiles
 * List all ownership profiles with summary stats
 */
router.get('/profiles', async (req, res) => {
  try {
    const {
      search,
      min_facilities = 2,
      sort = 'facility_count',
      order = 'desc',
      limit = 100,
      offset = 0
    } = req.query;

    const pool = getPoolInstance();

    const validSorts = ['facility_count', 'total_beds', 'avg_overall_rating', 'state_count', 'parent_organization'];
    const sortField = validSorts.includes(sort) ? sort : 'facility_count';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let query = `
      SELECT
        id,
        parent_organization,
        facility_count,
        total_beds,
        state_count,
        states_operated,
        avg_overall_rating,
        avg_health_inspection_rating,
        avg_staffing_rating,
        five_star_count,
        one_star_count,
        avg_occupancy_rate,
        total_health_deficiencies,
        for_profit_count,
        non_profit_count,
        government_count,
        last_refreshed_at
      FROM ownership_profiles
      WHERE facility_count >= $1
    `;

    const params = [parseInt(min_facilities)];
    let paramIndex = 2;

    if (search) {
      query += ` AND parent_organization ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY ${sortField} ${sortOrder} NULLS LAST`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM ownership_profiles WHERE facility_count >= $1`;
    const countParams = [parseInt(min_facilities)];
    if (search) {
      countQuery += ` AND parent_organization ILIKE $2`;
      countParams.push(`%${search}%`);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: result.rows.map(row => ({
        id: row.id,
        parent_organization: row.parent_organization,
        facility_count: row.facility_count,
        total_beds: row.total_beds,
        state_count: row.state_count,
        states: row.states_operated,
        avg_overall_rating: row.avg_overall_rating ? parseFloat(row.avg_overall_rating) : null,
        avg_health_inspection_rating: row.avg_health_inspection_rating ? parseFloat(row.avg_health_inspection_rating) : null,
        avg_staffing_rating: row.avg_staffing_rating ? parseFloat(row.avg_staffing_rating) : null,
        five_star_count: row.five_star_count,
        one_star_count: row.one_star_count,
        avg_occupancy_rate: row.avg_occupancy_rate ? parseFloat(row.avg_occupancy_rate) : null,
        total_health_deficiencies: row.total_health_deficiencies,
        ownership_breakdown: {
          for_profit: row.for_profit_count,
          non_profit: row.non_profit_count,
          government: row.government_count
        },
        last_refreshed_at: row.last_refreshed_at
      }))
    });
  } catch (error) {
    console.error('[Ownership API] profiles list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/ownership/profiles/stats
 * Get overall statistics about ownership profiles
 */
router.get('/profiles/stats', async (req, res) => {
  try {
    const pool = getPoolInstance();

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_profiles,
        SUM(facility_count) as total_facilities,
        SUM(total_beds) as total_beds,
        ROUND(AVG(avg_overall_rating)::numeric, 2) as avg_rating,
        MAX(facility_count) as largest_portfolio,
        (SELECT parent_organization FROM ownership_profiles ORDER BY facility_count DESC LIMIT 1) as largest_owner
      FROM ownership_profiles
    `);

    const tierResult = await pool.query(`
      SELECT
        CASE
          WHEN facility_count >= 100 THEN 'mega'
          WHEN facility_count >= 50 THEN 'large'
          WHEN facility_count >= 20 THEN 'medium'
          WHEN facility_count >= 10 THEN 'small'
          ELSE 'micro'
        END as tier,
        COUNT(*) as count
      FROM ownership_profiles
      GROUP BY 1
    `);

    const stats = result.rows[0];
    const tiers = {};
    tierResult.rows.forEach(r => { tiers[r.tier] = parseInt(r.count); });

    res.json({
      success: true,
      stats: {
        total_profiles: parseInt(stats.total_profiles),
        total_facilities: parseInt(stats.total_facilities),
        total_beds: parseInt(stats.total_beds),
        avg_rating: stats.avg_rating ? parseFloat(stats.avg_rating) : null,
        largest_portfolio: stats.largest_portfolio,
        largest_owner: stats.largest_owner,
        by_tier: tiers
      }
    });
  } catch (error) {
    console.error('[Ownership API] profiles stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/ownership/profiles/:id
 * Get detailed ownership profile with all facilities
 */
router.get('/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPoolInstance();

    // Determine if ID is numeric or organization name
    const isNumeric = /^\d+$/.test(id);

    const profileQuery = isNumeric
      ? 'SELECT * FROM ownership_profiles WHERE id = $1'
      : 'SELECT * FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ownership profile not found' });
    }

    const profile = profileResult.rows[0];

    // Get all facilities
    const facilitiesResult = await pool.query(`
      SELECT
        f.id,
        f.federal_provider_number,
        f.facility_name,
        f.address,
        f.city,
        f.state,
        f.zip_code,
        f.county,
        f.latitude,
        f.longitude,
        f.total_beds,
        f.certified_beds,
        f.occupancy_rate,
        f.overall_rating,
        f.health_inspection_rating,
        f.quality_measure_rating,
        f.staffing_rating,
        f.health_deficiencies,
        f.fire_safety_deficiencies,
        f.total_penalties_amount,
        f.ownership_type,
        f.cbsa_code,
        f.cbsa_title,
        f.is_rural
      FROM snf_facilities f
      WHERE f.parent_organization = $1
      ORDER BY f.state, f.city, f.facility_name
    `, [profile.parent_organization]);

    // Get recent deficiencies
    const providerNumbers = facilitiesResult.rows.map(f => f.federal_provider_number);
    let deficiencySummary = [];

    if (providerNumbers.length > 0) {
      const defResult = await pool.query(`
        SELECT
          federal_provider_number,
          COUNT(*) as deficiency_count,
          COUNT(*) FILTER (WHERE scope_severity IN ('G', 'H', 'I', 'J', 'K', 'L')) as serious_count,
          MAX(survey_date) as last_survey_date
        FROM cms_facility_deficiencies
        WHERE federal_provider_number = ANY($1)
          AND survey_date >= CURRENT_DATE - INTERVAL '3 years'
        GROUP BY federal_provider_number
      `, [providerNumbers]);
      deficiencySummary = defResult.rows;
    }

    const deficiencyMap = new Map(deficiencySummary.map(d => [d.federal_provider_number, d]));

    const facilities = facilitiesResult.rows.map(f => ({
      id: f.id,
      federal_provider_number: f.federal_provider_number,
      facility_name: f.facility_name,
      address: f.address,
      city: f.city,
      state: f.state,
      zip_code: f.zip_code,
      county: f.county,
      latitude: f.latitude ? parseFloat(f.latitude) : null,
      longitude: f.longitude ? parseFloat(f.longitude) : null,
      total_beds: f.total_beds,
      certified_beds: f.certified_beds,
      occupancy_rate: f.occupancy_rate ? parseFloat(f.occupancy_rate) : null,
      overall_rating: f.overall_rating,
      health_inspection_rating: f.health_inspection_rating,
      quality_measure_rating: f.quality_measure_rating,
      staffing_rating: f.staffing_rating,
      health_deficiencies: f.health_deficiencies,
      fire_safety_deficiencies: f.fire_safety_deficiencies,
      total_penalties_amount: f.total_penalties_amount ? parseFloat(f.total_penalties_amount) : null,
      ownership_type: f.ownership_type,
      cbsa_code: f.cbsa_code,
      cbsa_title: f.cbsa_title,
      is_rural: f.is_rural,
      recent_deficiencies: deficiencyMap.get(f.federal_provider_number) || null
    }));

    // Get contacts for this profile
    const contactsResult = await pool.query(`
      SELECT * FROM ownership_contacts
      WHERE ownership_profile_id = $1
      ORDER BY is_primary DESC, last_name, first_name
    `, [profile.id]);

    res.json({
      success: true,
      profile: {
        id: profile.id,
        parent_organization: profile.parent_organization,
        facility_count: profile.facility_count,
        total_beds: profile.total_beds,
        total_certified_beds: profile.total_certified_beds,
        states_operated: profile.states_operated,
        state_count: profile.state_count,
        cbsa_count: profile.cbsa_count,
        // Editable fields
        is_cms_sourced: profile.is_cms_sourced !== false,
        notes: profile.notes,
        headquarters: {
          address: profile.headquarters_address,
          city: profile.headquarters_city,
          state: profile.headquarters_state,
          zip: profile.headquarters_zip
        },
        company_website: profile.company_website,
        phone: profile.phone,
        founded_year: profile.founded_year,
        company_description: profile.company_description,
        logo_url: profile.logo_url,
        last_edited_by: profile.last_edited_by,
        last_edited_at: profile.last_edited_at,
        ratings: {
          avg_overall: profile.avg_overall_rating ? parseFloat(profile.avg_overall_rating) : null,
          avg_health_inspection: profile.avg_health_inspection_rating ? parseFloat(profile.avg_health_inspection_rating) : null,
          avg_quality_measure: profile.avg_quality_measure_rating ? parseFloat(profile.avg_quality_measure_rating) : null,
          avg_staffing: profile.avg_staffing_rating ? parseFloat(profile.avg_staffing_rating) : null
        },
        rating_distribution: {
          five_star: profile.five_star_count,
          four_star: profile.four_star_count,
          three_star: profile.three_star_count,
          two_star: profile.two_star_count,
          one_star: profile.one_star_count
        },
        occupancy: {
          avg_rate: profile.avg_occupancy_rate ? parseFloat(profile.avg_occupancy_rate) : null,
          total_occupied_beds: profile.total_occupied_beds
        },
        staffing: {
          avg_rn_hours: profile.avg_rn_staffing_hours ? parseFloat(profile.avg_rn_staffing_hours) : null,
          avg_total_nurse_hours: profile.avg_total_nurse_staffing_hours ? parseFloat(profile.avg_total_nurse_staffing_hours) : null
        },
        deficiencies: {
          total_health: profile.total_health_deficiencies,
          total_fire_safety: profile.total_fire_safety_deficiencies,
          avg_per_facility: profile.avg_health_deficiencies_per_facility ? parseFloat(profile.avg_health_deficiencies_per_facility) : null
        },
        penalties: {
          total_amount: profile.total_penalties_amount ? parseFloat(profile.total_penalties_amount) : null,
          total_count: profile.total_penalty_count
        },
        ownership_breakdown: {
          for_profit: profile.for_profit_count,
          non_profit: profile.non_profit_count,
          government: profile.government_count
        },
        last_refreshed_at: profile.last_refreshed_at
      },
      contacts: contactsResult.rows,
      facilities
    });
  } catch (error) {
    console.error('[Ownership API] get profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/ownership/profiles/:id/facilities
 * Get just the facilities for an ownership profile (for map/table)
 */
router.get('/profiles/:id/facilities', async (req, res) => {
  try {
    const { id } = req.params;
    const { state } = req.query;
    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT parent_organization FROM ownership_profiles WHERE id = $1'
      : 'SELECT parent_organization FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ownership profile not found' });
    }

    const parentOrg = profileResult.rows[0].parent_organization;

    let query = `
      SELECT
        id,
        federal_provider_number,
        facility_name,
        city,
        state,
        latitude,
        longitude,
        total_beds,
        overall_rating,
        health_deficiencies
      FROM snf_facilities
      WHERE parent_organization = $1
    `;
    const params = [parentOrg];

    if (state) {
      query += ' AND state = $2';
      params.push(state.toUpperCase());
    }

    query += ' ORDER BY state, city, facility_name';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      parent_organization: parentOrg,
      count: result.rows.length,
      facilities: result.rows.map(f => ({
        id: f.id,
        federal_provider_number: f.federal_provider_number,
        facility_name: f.facility_name,
        city: f.city,
        state: f.state,
        latitude: f.latitude ? parseFloat(f.latitude) : null,
        longitude: f.longitude ? parseFloat(f.longitude) : null,
        total_beds: f.total_beds,
        overall_rating: f.overall_rating,
        health_deficiencies: f.health_deficiencies
      }))
    });
  } catch (error) {
    console.error('[Ownership API] profile facilities error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/ownership/profiles/refresh
 * Manually trigger a refresh of ownership profiles
 */
router.post('/profiles/refresh', async (req, res) => {
  try {
    const { refreshOwnershipProfiles } = require('../server/collectors/ownership-profiles-collector');
    const pool = getPoolInstance();

    res.json({
      success: true,
      message: 'Ownership profiles refresh started'
    });

    // Run refresh in background
    refreshOwnershipProfiles(pool).then(count => {
      console.log(`[Ownership API] Refresh complete: ${count} profiles`);
    }).catch(err => {
      console.error('[Ownership API] Refresh failed:', err);
    });
  } catch (error) {
    console.error('[Ownership API] refresh error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/ownership/profiles
 * Create a custom (non-CMS) ownership profile
 */
router.post('/profiles', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      parent_organization,
      notes,
      headquarters_address,
      headquarters_city,
      headquarters_state,
      headquarters_zip,
      company_website,
      phone,
      founded_year,
      company_description
    } = req.body;

    if (!parent_organization) {
      return res.status(400).json({
        success: false,
        error: 'parent_organization is required'
      });
    }

    const pool = getPoolInstance();

    // Check if profile already exists
    const existingCheck = await pool.query(
      'SELECT id FROM ownership_profiles WHERE parent_organization = $1',
      [parent_organization]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An ownership profile with this name already exists',
        existing_id: existingCheck.rows[0].id
      });
    }

    // Create new profile
    const result = await pool.query(`
      INSERT INTO ownership_profiles (
        parent_organization,
        is_cms_sourced,
        notes,
        headquarters_address,
        headquarters_city,
        headquarters_state,
        headquarters_zip,
        company_website,
        phone,
        founded_year,
        company_description,
        created_by,
        last_edited_by,
        last_edited_at,
        facility_count,
        total_beds,
        state_count
      ) VALUES ($1, FALSE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, NOW(), 0, 0, 0)
      RETURNING *
    `, [
      parent_organization,
      notes,
      headquarters_address,
      headquarters_city,
      headquarters_state,
      headquarters_zip,
      company_website,
      phone,
      founded_year,
      company_description,
      userId
    ]);

    // Log the creation
    await pool.query(`
      INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, metadata)
      VALUES ($1, $2, 'profile_created', $3)
    `, [result.rows[0].id, userId, JSON.stringify({ parent_organization })]);

    res.status(201).json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('[Ownership API] create profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/v1/ownership/profiles/:id
 * Update editable fields on an ownership profile
 */
router.put('/profiles/:id', requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      notes,
      headquarters_address,
      headquarters_city,
      headquarters_state,
      headquarters_zip,
      company_website,
      phone,
      founded_year,
      company_description,
      logo_url
    } = req.body;

    const pool = getPoolInstance();

    // Get current profile
    const isNumeric = /^\d+$/.test(id);
    const currentQuery = isNumeric
      ? 'SELECT * FROM ownership_profiles WHERE id = $1'
      : 'SELECT * FROM ownership_profiles WHERE parent_organization = $1';

    const currentResult = await pool.query(currentQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const currentProfile = currentResult.rows[0];

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fieldsToUpdate = {
      notes,
      headquarters_address,
      headquarters_city,
      headquarters_state,
      headquarters_zip,
      company_website,
      phone,
      founded_year,
      company_description,
      logo_url
    };

    // Track changes for audit log
    const changes = [];

    for (const [field, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        const oldValue = currentProfile[field];
        if (oldValue !== value) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
          changes.push({ field, old_value: oldValue, new_value: value });
        }
      }
    }

    if (updates.length === 0) {
      return res.json({
        success: true,
        message: 'No changes to save',
        profile: currentProfile
      });
    }

    // Add audit fields
    updates.push(`last_edited_by = $${paramIndex}`);
    values.push(userId);
    paramIndex++;

    updates.push(`last_edited_at = NOW()`);

    // Add profile ID to params
    values.push(currentProfile.id);

    const updateResult = await pool.query(`
      UPDATE ownership_profiles
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    // Log each change
    for (const change of changes) {
      await pool.query(`
        INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, field_name, old_value, new_value)
        VALUES ($1, $2, 'profile_updated', $3, $4, $5)
      `, [currentProfile.id, userId, change.field, change.old_value?.toString() || null, change.new_value?.toString() || null]);
    }

    res.json({
      success: true,
      profile: updateResult.rows[0],
      changes_made: changes.length
    });
  } catch (error) {
    console.error('[Ownership API] update profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// CONTACTS ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/ownership/profiles/:id/contacts
 * Get all contacts for an ownership profile
 */
router.get('/profiles/:id/contacts', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    const result = await pool.query(`
      SELECT c.*, u.first_name as created_by_name, u.last_name as created_by_last
      FROM ownership_contacts c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.ownership_profile_id = $1
      ORDER BY c.is_primary DESC, c.last_name, c.first_name
    `, [profileId]);

    res.json({
      success: true,
      contacts: result.rows
    });
  } catch (error) {
    console.error('[Ownership API] get contacts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/ownership/profiles/:id/contacts
 * Add a contact to an ownership profile
 */
router.post('/profiles/:id/contacts', requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      title,
      email,
      phone,
      mobile,
      linkedin_url,
      contact_type,
      is_primary,
      notes
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'first_name and last_name are required'
      });
    }

    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    // If this is set as primary, unset other primaries
    if (is_primary) {
      await pool.query(
        'UPDATE ownership_contacts SET is_primary = FALSE WHERE ownership_profile_id = $1',
        [profileId]
      );
    }

    const result = await pool.query(`
      INSERT INTO ownership_contacts (
        ownership_profile_id, first_name, last_name, title, email, phone, mobile,
        linkedin_url, contact_type, is_primary, notes, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
      RETURNING *
    `, [profileId, first_name, last_name, title, email, phone, mobile, linkedin_url, contact_type || 'other', is_primary || false, notes, userId]);

    // Log the addition
    await pool.query(`
      INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, metadata)
      VALUES ($1, $2, 'contact_added', $3)
    `, [profileId, userId, JSON.stringify({ contact_id: result.rows[0].id, name: `${first_name} ${last_name}` })]);

    res.status(201).json({
      success: true,
      contact: result.rows[0]
    });
  } catch (error) {
    console.error('[Ownership API] add contact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/v1/ownership/profiles/:id/contacts/:contactId
 * Update a contact
 */
router.put('/profiles/:id/contacts/:contactId', requireAuthentication, async (req, res) => {
  try {
    const { id, contactId } = req.params;
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      title,
      email,
      phone,
      mobile,
      linkedin_url,
      contact_type,
      is_primary,
      notes
    } = req.body;

    const pool = getPoolInstance();

    // Verify contact exists and belongs to this profile
    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    const contactCheck = await pool.query(
      'SELECT * FROM ownership_contacts WHERE id = $1 AND ownership_profile_id = $2',
      [contactId, profileId]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // If this is set as primary, unset other primaries
    if (is_primary) {
      await pool.query(
        'UPDATE ownership_contacts SET is_primary = FALSE WHERE ownership_profile_id = $1 AND id != $2',
        [profileId, contactId]
      );
    }

    const result = await pool.query(`
      UPDATE ownership_contacts SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        title = $3,
        email = $4,
        phone = $5,
        mobile = $6,
        linkedin_url = $7,
        contact_type = COALESCE($8, contact_type),
        is_primary = COALESCE($9, is_primary),
        notes = $10,
        updated_by = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING *
    `, [first_name, last_name, title, email, phone, mobile, linkedin_url, contact_type, is_primary, notes, userId, contactId]);

    // Log the update
    await pool.query(`
      INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, metadata)
      VALUES ($1, $2, 'contact_updated', $3)
    `, [profileId, userId, JSON.stringify({ contact_id: contactId, name: `${result.rows[0].first_name} ${result.rows[0].last_name}` })]);

    res.json({
      success: true,
      contact: result.rows[0]
    });
  } catch (error) {
    console.error('[Ownership API] update contact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/ownership/profiles/:id/contacts/:contactId
 * Delete a contact
 */
router.delete('/profiles/:id/contacts/:contactId', requireAuthentication, async (req, res) => {
  try {
    const { id, contactId } = req.params;
    const userId = req.user.id;
    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    // Get contact info before deleting
    const contactInfo = await pool.query(
      'SELECT first_name, last_name FROM ownership_contacts WHERE id = $1 AND ownership_profile_id = $2',
      [contactId, profileId]
    );

    if (contactInfo.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    await pool.query(
      'DELETE FROM ownership_contacts WHERE id = $1 AND ownership_profile_id = $2',
      [contactId, profileId]
    );

    // Log the deletion
    await pool.query(`
      INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, metadata)
      VALUES ($1, $2, 'contact_deleted', $3)
    `, [profileId, userId, JSON.stringify({
      contact_id: contactId,
      name: `${contactInfo.rows[0].first_name} ${contactInfo.rows[0].last_name}`
    })]);

    res.json({
      success: true,
      deleted: true
    });
  } catch (error) {
    console.error('[Ownership API] delete contact error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// COMMENTS ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/ownership/profiles/:id/comments
 * Get all comments for an ownership profile
 */
router.get('/profiles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    // Get comments with user info
    const result = await pool.query(`
      SELECT
        c.id, c.comment, c.parent_id, c.created_at, c.updated_at,
        c.user_id,
        u.first_name, u.last_name, u.profile_url
      FROM ownership_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.ownership_profile_id = $1
      ORDER BY c.created_at DESC
    `, [profileId]);

    // Get mentions for all comments
    const commentIds = result.rows.map(c => c.id);
    let mentions = [];
    if (commentIds.length > 0) {
      const mentionsResult = await pool.query(`
        SELECT m.comment_id, m.mentioned_user_id, u.first_name, u.last_name
        FROM ownership_comment_mentions m
        JOIN users u ON m.mentioned_user_id = u.id
        WHERE m.comment_id = ANY($1)
      `, [commentIds]);
      mentions = mentionsResult.rows;
    }

    // Group mentions by comment
    const mentionsByComment = {};
    mentions.forEach(m => {
      if (!mentionsByComment[m.comment_id]) {
        mentionsByComment[m.comment_id] = [];
      }
      mentionsByComment[m.comment_id].push({
        user_id: m.mentioned_user_id,
        name: `${m.first_name} ${m.last_name}`
      });
    });

    // Organize into threaded structure
    const commentsMap = new Map();
    const topLevelComments = [];

    result.rows.forEach(row => {
      const comment = {
        id: row.id,
        comment: row.comment,
        parent_id: row.parent_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          profile_url: row.profile_url
        },
        mentioned_users: mentionsByComment[row.id] || [],
        replies: []
      };
      commentsMap.set(row.id, comment);
    });

    // Build tree structure
    commentsMap.forEach(comment => {
      if (comment.parent_id) {
        const parent = commentsMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        topLevelComments.push(comment);
      }
    });

    // Sort replies by date
    const sortReplies = (comments) => {
      comments.forEach(c => {
        c.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        sortReplies(c.replies);
      });
    };
    sortReplies(topLevelComments);

    res.json({
      success: true,
      comments: topLevelComments
    });
  } catch (error) {
    console.error('[Ownership API] get comments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/ownership/profiles/:id/comments
 * Add a comment to an ownership profile
 */
router.post('/profiles/:id/comments', requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { comment, mentioned_user_ids, parent_id } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required'
      });
    }

    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id, parent_organization FROM ownership_profiles WHERE id = $1'
      : 'SELECT id, parent_organization FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;
    const parentOrg = profileResult.rows[0].parent_organization;

    // Verify parent comment exists if provided
    if (parent_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM ownership_comments WHERE id = $1 AND ownership_profile_id = $2',
        [parent_id, profileId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Parent comment not found' });
      }
    }

    // Insert comment
    const result = await pool.query(`
      INSERT INTO ownership_comments (ownership_profile_id, user_id, comment, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [profileId, userId, comment.trim(), parent_id || null]);

    const newComment = result.rows[0];

    // Handle mentions
    if (mentioned_user_ids && mentioned_user_ids.length > 0) {
      for (const mentionedUserId of mentioned_user_ids) {
        await pool.query(`
          INSERT INTO ownership_comment_mentions (comment_id, mentioned_user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [newComment.id, mentionedUserId]);

        // Create notification for mentioned user (with real-time socket emit)
        await createNotification({
          to_id: mentionedUserId,
          from_id: userId,
          notification_type: 'mention',
          title: 'You were mentioned in a comment',
          content: `${req.user.first_name} ${req.user.last_name} mentioned you in a comment on ${parentOrg}`,
          ref_type: 'ownership_profile',
          ref_id: profileId
        });
      }
    }

    // Log the comment
    await pool.query(`
      INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, metadata)
      VALUES ($1, $2, 'comment_added', $3)
    `, [profileId, userId, JSON.stringify({ comment_id: newComment.id, preview: comment.substring(0, 100) })]);

    // Get user info for response
    const userInfo = await pool.query(
      'SELECT first_name, last_name, profile_url FROM users WHERE id = $1',
      [userId]
    );

    res.status(201).json({
      success: true,
      comment: {
        ...newComment,
        user: userInfo.rows[0],
        mentioned_users: [],
        replies: []
      }
    });
  } catch (error) {
    console.error('[Ownership API] add comment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/ownership/profiles/:id/comments/:commentId
 * Delete a comment (and its replies)
 */
router.delete('/profiles/:id/comments/:commentId', requireAuthentication, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;
    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    // Verify comment exists and user owns it (or is admin)
    const commentCheck = await pool.query(
      'SELECT user_id, comment FROM ownership_comments WHERE id = $1 AND ownership_profile_id = $2',
      [commentId, profileId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Only allow deletion by comment owner or admin
    if (commentCheck.rows[0].user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
    }

    // Delete comment (CASCADE will handle replies and mentions)
    await pool.query(
      'DELETE FROM ownership_comments WHERE id = $1',
      [commentId]
    );

    // Log the deletion
    await pool.query(`
      INSERT INTO ownership_change_logs (ownership_profile_id, user_id, change_type, metadata)
      VALUES ($1, $2, 'comment_deleted', $3)
    `, [profileId, userId, JSON.stringify({ comment_id: commentId, preview: commentCheck.rows[0].comment.substring(0, 100) })]);

    res.json({
      success: true,
      deleted: true
    });
  } catch (error) {
    console.error('[Ownership API] delete comment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ACTIVITY / CHANGE LOG ENDPOINT
// =============================================================================

/**
 * GET /api/v1/ownership/profiles/:id/activity
 * Get activity/change log for an ownership profile
 */
router.get('/profiles/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const pool = getPoolInstance();

    const isNumeric = /^\d+$/.test(id);
    const profileQuery = isNumeric
      ? 'SELECT id FROM ownership_profiles WHERE id = $1'
      : 'SELECT id FROM ownership_profiles WHERE parent_organization = $1';

    const profileResult = await pool.query(profileQuery, [isNumeric ? parseInt(id) : decodeURIComponent(id)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const profileId = profileResult.rows[0].id;

    const result = await pool.query(`
      SELECT
        cl.id, cl.change_type, cl.field_name, cl.old_value, cl.new_value, cl.metadata, cl.created_at,
        u.id as user_id, u.first_name, u.last_name, u.profile_url
      FROM ownership_change_logs cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.ownership_profile_id = $1
      ORDER BY cl.created_at DESC
      LIMIT $2 OFFSET $3
    `, [profileId, parseInt(limit), parseInt(offset)]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM ownership_change_logs WHERE ownership_profile_id = $1',
      [profileId]
    );

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].count),
      activities: result.rows.map(row => ({
        id: row.id,
        change_type: row.change_type,
        field_name: row.field_name,
        old_value: row.old_value,
        new_value: row.new_value,
        metadata: row.metadata,
        created_at: row.created_at,
        user: {
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          profile_url: row.profile_url
        }
      }))
    });
  } catch (error) {
    console.error('[Ownership API] get activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// FACILITY DEFICIENCIES ENDPOINT
// =============================================================================

/**
 * GET /api/v1/ownership/facilities/:id/deficiencies
 * Get deficiency records for a facility
 */
router.get('/facilities/:id/deficiencies', async (req, res) => {
  try {
    const { id } = req.params;
    const { prefix = 'all', years = 3 } = req.query;
    const pool = getPoolInstance();

    let whereConditions = [`federal_provider_number = $1`];
    let params = [id];
    let paramIndex = 2;

    // Date filter
    const yearsAgo = new Date();
    yearsAgo.setFullYear(yearsAgo.getFullYear() - parseInt(years));
    whereConditions.push(`survey_date >= $${paramIndex}`);
    params.push(yearsAgo.toISOString().split('T')[0]);
    paramIndex++;

    // Prefix filter
    if (prefix !== 'all') {
      whereConditions.push(`deficiency_prefix = $${paramIndex}`);
      params.push(prefix);
      paramIndex++;
    }

    const result = await pool.query(`
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
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY survey_date DESC, deficiency_tag ASC
    `, params);

    res.json({
      success: true,
      providerId: id,
      count: result.rows.length,
      deficiencies: result.rows
    });
  } catch (error) {
    console.error('[Ownership Routes] getDeficiencies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// STARRED ITEMS API
// Allow users to star/bookmark ownership chains and facilities
// ============================================================================

/**
 * GET /api/v1/ownership/starred
 * Get all starred items for the current user
 */
router.get('/starred', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { type } = req.query; // Optional filter by type
    const pool = getPoolInstance();

    let query = `
      SELECT id, item_type, item_identifier, item_name, notes, created_at
      FROM user_starred_items
      WHERE user_id = $1
    `;
    const params = [userId];

    if (type) {
      query += ` AND item_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[Ownership Routes] getStarredItems error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/ownership/starred
 * Star an item (ownership chain or facility)
 */
router.post('/starred', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { itemType, itemIdentifier, itemName, notes } = req.body;

    if (!itemType || !itemIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'itemType and itemIdentifier are required'
      });
    }

    if (!['ownership_chain', 'facility'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        error: 'itemType must be "ownership_chain" or "facility"'
      });
    }

    const pool = getPoolInstance();

    const result = await pool.query(`
      INSERT INTO user_starred_items (user_id, item_type, item_identifier, item_name, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, item_type, item_identifier) DO UPDATE
      SET item_name = EXCLUDED.item_name, notes = EXCLUDED.notes
      RETURNING id, item_type, item_identifier, item_name, notes, created_at
    `, [userId, itemType, itemIdentifier, itemName || null, notes || null]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[Ownership Routes] starItem error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/ownership/starred/:itemType/:itemIdentifier
 * Unstar an item
 */
router.delete('/starred/:itemType/:itemIdentifier', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { itemType, itemIdentifier } = req.params;
    const pool = getPoolInstance();

    const result = await pool.query(`
      DELETE FROM user_starred_items
      WHERE user_id = $1 AND item_type = $2 AND item_identifier = $3
      RETURNING id
    `, [userId, itemType, decodeURIComponent(itemIdentifier)]);

    res.json({
      success: true,
      deleted: result.rowCount > 0
    });
  } catch (error) {
    console.error('[Ownership Routes] unstarItem error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/ownership/starred/check
 * Check if items are starred (batch check)
 */
router.get('/starred/check', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { items } = req.query; // JSON array of {itemType, itemIdentifier}
    if (!items) {
      return res.json({ success: true, data: {} });
    }

    const pool = getPoolInstance();
    const itemsArray = JSON.parse(items);

    // Build query to check multiple items at once
    const result = await pool.query(`
      SELECT item_type, item_identifier
      FROM user_starred_items
      WHERE user_id = $1
    `, [userId]);

    // Create a map of starred items
    const starredMap = {};
    result.rows.forEach(row => {
      const key = `${row.item_type}:${row.item_identifier}`;
      starredMap[key] = true;
    });

    // Check each requested item
    const checkedItems = {};
    itemsArray.forEach(item => {
      const key = `${item.itemType}:${item.itemIdentifier}`;
      checkedItems[key] = !!starredMap[key];
    });

    res.json({
      success: true,
      data: checkedItems
    });
  } catch (error) {
    console.error('[Ownership Routes] checkStarred error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
