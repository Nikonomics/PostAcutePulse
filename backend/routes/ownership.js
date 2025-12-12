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
 * Get top SNF chains nationwide ranked by facility count
 */
router.get('/top-chains', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const pool = getPoolInstance();

    const result = await pool.query(`
      SELECT
        ownership_chain,
        COUNT(*) as facility_count,
        SUM(total_beds) as total_beds,
        COUNT(DISTINCT state) as state_count,
        AVG(overall_rating) as avg_rating,
        AVG(occupancy_rate) as avg_occupancy,
        AVG(health_deficiencies) as avg_deficiencies,
        ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as ranking
      FROM snf_facilities
      WHERE active = true
        AND ownership_chain IS NOT NULL
        AND ownership_chain != ''
      GROUP BY ownership_chain
      ORDER BY facility_count DESC
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
      minFacilities = 0,
      minBeds = 0,
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

    // Build dynamic query
    let whereConditions = [`
      active = true
      AND ownership_chain IS NOT NULL
      AND ownership_chain != ''
    `];
    let params = [parseInt(minFacilities), parseInt(minBeds)];
    let paramIndex = 3;

    if (ownershipType !== 'all') {
      whereConditions.push(`ownership_type = $${paramIndex}`);
      params.push(ownershipType);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`LOWER(ownership_chain) LIKE LOWER($${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await pool.query(`
      WITH ranked_chains AS (
        SELECT
          ownership_chain,
          ownership_type,
          COUNT(*) as facility_count,
          SUM(total_beds) as total_beds,
          COUNT(DISTINCT state) as state_count,
          AVG(overall_rating) as avg_rating,
          AVG(occupancy_rate) as avg_occupancy,
          AVG(health_deficiencies) as avg_deficiencies,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as ranking
        FROM snf_facilities
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ownership_chain, ownership_type
      )
      SELECT *
      FROM ranked_chains
      WHERE facility_count >= $1
        AND COALESCE(total_beds, 0) >= $2
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

module.exports = router;
