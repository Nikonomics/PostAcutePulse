/**
 * HHA M&A Analytics API Routes
 *
 * Provides endpoints for home health agency ownership change/transaction analytics.
 * Uses hha_ownership_events table (OWNER_ADDED, OWNER_REMOVED, NEW_AGENCY, etc.)
 * combined with enrollment data for agency context.
 */

const express = require('express');
const router = express.Router();
const { getMarketPool } = require('../config/database');

// Use market database pool (HHA data is in MARKET_DATABASE_URL)
const getPool = () => getMarketPool();

/**
 * GET /api/hha-ma/summary
 * Get summary statistics for HHA M&A activity
 *
 * Query params:
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - state: Filter by state abbreviation (e.g., 'FL')
 * - owner: Filter by owner name
 */
router.get('/summary', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, state, owner } = req.query;

    // Default to last 12 months if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    // Build filter conditions
    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND e.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (owner) {
      filterConditions += ` AND e.owner_name ILIKE $${paramIndex}`;
      queryParams.push(`%${owner}%`);
      paramIndex++;
    }

    // Get current period stats
    const currentPeriodQuery = `
      SELECT
        COUNT(*) FILTER (WHERE event_type IN ('OWNER_ADDED', 'OWNER_REMOVED', 'PERCENTAGE_CHANGED')) as total_ownership_changes,
        COUNT(*) FILTER (WHERE event_type = 'NEW_AGENCY') as new_agencies,
        COUNT(*) FILTER (WHERE event_type = 'AGENCY_CLOSED') as closed_agencies,
        COUNT(DISTINCT e.state) as active_markets,
        COUNT(*) FILTER (WHERE e.is_private_equity = true) as pe_involved
      FROM hha_ownership_events e
      WHERE e.event_date BETWEEN $1 AND $2
        ${filterConditions}
    `;

    const currentResult = await pool.query(currentPeriodQuery, queryParams);

    // Calculate YoY change
    const startDate1 = new Date(start);
    const endDate1 = new Date(end);
    const prevStart = new Date(startDate1.setFullYear(startDate1.getFullYear() - 1)).toISOString().split('T')[0];
    const prevEnd = new Date(endDate1.setFullYear(endDate1.getFullYear() - 1)).toISOString().split('T')[0];

    const prevParams = [prevStart, prevEnd, ...queryParams.slice(2)];

    const prevPeriodQuery = `
      SELECT COUNT(*) as total_changes
      FROM hha_ownership_events e
      WHERE e.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED', 'PERCENTAGE_CHANGED')
        AND e.event_date BETWEEN $1 AND $2
        ${filterConditions}
    `;

    const prevResult = await pool.query(prevPeriodQuery, prevParams);

    const currentChanges = parseInt(currentResult.rows[0].total_ownership_changes) || 0;
    const prevChanges = parseInt(prevResult.rows[0].total_changes) || 0;

    let yoyChange = 0;
    if (prevChanges > 0) {
      yoyChange = ((currentChanges - prevChanges) / prevChanges) * 100;
    }

    res.json({
      success: true,
      totalOwnershipChanges: currentChanges,
      newAgencies: parseInt(currentResult.rows[0].new_agencies) || 0,
      closedAgencies: parseInt(currentResult.rows[0].closed_agencies) || 0,
      activeMarkets: parseInt(currentResult.rows[0].active_markets) || 0,
      peInvolved: parseInt(currentResult.rows[0].pe_involved) || 0,
      yoyChange: Math.round(yoyChange * 10) / 10,
      dateRange: { start, end },
      filters: { state: state || null, owner: owner || null }
    });

  } catch (error) {
    console.error('[HHA MA Analytics] summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/volume
 * Get quarterly transaction volume for charting
 */
router.get('/volume', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, state, owner } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0];

    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND e.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (owner) {
      filterConditions += ` AND e.owner_name ILIKE $${paramIndex}`;
      queryParams.push(`%${owner}%`);
      paramIndex++;
    }

    // HHA data is quarterly, so group by quarter
    const query = `
      SELECT
        TO_CHAR(e.event_date, 'YYYY-"Q"Q') as quarter,
        COUNT(*) FILTER (WHERE event_type = 'OWNER_ADDED') as acquisitions,
        COUNT(*) FILTER (WHERE event_type = 'OWNER_REMOVED') as divestitures,
        COUNT(*) FILTER (WHERE event_type = 'NEW_AGENCY') as new_agencies,
        COUNT(*) FILTER (WHERE event_type = 'AGENCY_CLOSED') as closures
      FROM hha_ownership_events e
      WHERE e.event_date BETWEEN $1 AND $2
        ${filterConditions}
      GROUP BY TO_CHAR(e.event_date, 'YYYY-"Q"Q'), DATE_TRUNC('quarter', e.event_date)
      ORDER BY DATE_TRUNC('quarter', MIN(e.event_date))
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        quarter: row.quarter,
        acquisitions: parseInt(row.acquisitions),
        divestitures: parseInt(row.divestitures),
        newAgencies: parseInt(row.new_agencies),
        closures: parseInt(row.closures)
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] volume error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/by-state
 * Get transaction activity by state for map and leaderboard
 */
router.get('/by-state', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, owner } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (owner) {
      filterConditions += ` AND e.owner_name ILIKE $${paramIndex}`;
      queryParams.push(`%${owner}%`);
      paramIndex++;
    }

    const stateQuery = `
      SELECT
        e.state,
        COUNT(*) FILTER (WHERE event_type = 'OWNER_ADDED') as acquisitions,
        COUNT(*) FILTER (WHERE event_type = 'OWNER_REMOVED') as divestitures,
        COUNT(*) FILTER (WHERE event_type = 'NEW_AGENCY') as new_agencies,
        COUNT(*) FILTER (WHERE event_type = 'AGENCY_CLOSED') as closures,
        COUNT(DISTINCT e.ccn) as agencies_affected
      FROM hha_ownership_events e
      WHERE e.event_date BETWEEN $1 AND $2
        AND e.state IS NOT NULL
        ${filterConditions}
      GROUP BY e.state
      ORDER BY agencies_affected DESC
    `;

    const stateResult = await pool.query(stateQuery, queryParams);

    res.json({
      success: true,
      data: stateResult.rows.map(row => ({
        state: row.state,
        acquisitions: parseInt(row.acquisitions),
        divestitures: parseInt(row.divestitures),
        newAgencies: parseInt(row.new_agencies),
        closures: parseInt(row.closures),
        agenciesAffected: parseInt(row.agencies_affected)
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] by-state error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/startups
 * Get startup (new agency) analytics by geography
 */
router.get('/startups', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, state, cbsa, granularity = 'state' } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || '2023-04-01'; // Start of HHA data

    let query;
    const queryParams = [start, end];

    if (granularity === 'cbsa') {
      let cbsaFilter = '';
      if (cbsa) {
        cbsaFilter = ` AND geo_code = $3`;
        queryParams.push(cbsa);
      }

      query = `
        SELECT
          geo_code as cbsa_code,
          geo_name as cbsa_name,
          SUM(new_agencies) as total_startups,
          SUM(closed_agencies) as total_closures,
          SUM(net_change) as net_change
        FROM hha_startup_analytics
        WHERE granularity = 'cbsa'
          AND period_date BETWEEN $1 AND $2
          ${cbsaFilter}
        GROUP BY geo_code, geo_name
        ORDER BY total_startups DESC
        LIMIT 50
      `;
    } else if (granularity === 'national') {
      query = `
        SELECT
          period_date,
          new_agencies as startups,
          closed_agencies as closures,
          net_change
        FROM hha_startup_analytics
        WHERE granularity = 'national'
          AND period_date BETWEEN $1 AND $2
        ORDER BY period_date
      `;
    } else {
      // Default: state level
      let stateFilter = '';
      if (state) {
        stateFilter = ` AND geo_code = $3`;
        queryParams.push(state);
      }

      query = `
        SELECT
          geo_code as state,
          SUM(new_agencies) as total_startups,
          SUM(closed_agencies) as total_closures,
          SUM(net_change) as net_change
        FROM hha_startup_analytics
        WHERE granularity = 'state'
          AND period_date BETWEEN $1 AND $2
          ${stateFilter}
        GROUP BY geo_code
        ORDER BY total_startups DESC
      `;
    }

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      granularity,
      dateRange: { start, end },
      data: result.rows
    });

  } catch (error) {
    console.error('[HHA MA Analytics] startups error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/top-acquirers
 * Get the most active acquirers (new owners appearing)
 */
router.get('/top-acquirers', async (req, res) => {
  const pool = getPool();

  try {
    const { limit = 20, startDate, endDate, state } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    let filterConditions = '';
    const queryParams = [start, end, parseInt(limit)];
    let paramIndex = 4;

    if (state) {
      filterConditions += ` AND e.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    const query = `
      SELECT
        e.owner_name,
        e.owner_type,
        COUNT(DISTINCT e.ccn) as agencies_acquired,
        COUNT(DISTINCT e.state) as states,
        BOOL_OR(e.is_private_equity) as is_private_equity,
        BOOL_OR(e.is_reit) as is_reit,
        BOOL_OR(e.is_chain_office) as is_chain,
        ARRAY_AGG(DISTINCT e.state ORDER BY e.state) as state_list
      FROM hha_ownership_events e
      WHERE e.event_type = 'OWNER_ADDED'
        AND e.event_date BETWEEN $1 AND $2
        AND e.owner_name IS NOT NULL
        AND e.owner_name != ''
        ${filterConditions}
      GROUP BY e.owner_name, e.owner_type
      ORDER BY agencies_acquired DESC
      LIMIT $3
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ownerName: row.owner_name,
        ownerType: row.owner_type === 'I' ? 'Individual' : 'Organization',
        agenciesAcquired: parseInt(row.agencies_acquired),
        statesCount: parseInt(row.states),
        isPrivateEquity: row.is_private_equity,
        isReit: row.is_reit,
        isChain: row.is_chain,
        states: row.state_list
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] top-acquirers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/top-divesting
 * Get the most active divestors (owners leaving)
 */
router.get('/top-divesting', async (req, res) => {
  const pool = getPool();

  try {
    const { limit = 20, startDate, endDate, state } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    let filterConditions = '';
    const queryParams = [start, end, parseInt(limit)];
    let paramIndex = 4;

    if (state) {
      filterConditions += ` AND e.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    const query = `
      SELECT
        e.owner_name,
        e.owner_type,
        COUNT(DISTINCT e.ccn) as agencies_divested,
        COUNT(DISTINCT e.state) as states,
        BOOL_OR(e.is_private_equity) as is_private_equity,
        BOOL_OR(e.is_reit) as is_reit,
        ARRAY_AGG(DISTINCT e.state ORDER BY e.state) as state_list
      FROM hha_ownership_events e
      WHERE e.event_type = 'OWNER_REMOVED'
        AND e.event_date BETWEEN $1 AND $2
        AND e.owner_name IS NOT NULL
        AND e.owner_name != ''
        ${filterConditions}
      GROUP BY e.owner_name, e.owner_type
      ORDER BY agencies_divested DESC
      LIMIT $3
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ownerName: row.owner_name,
        ownerType: row.owner_type === 'I' ? 'Individual' : 'Organization',
        agenciesDivested: parseInt(row.agencies_divested),
        statesCount: parseInt(row.states),
        isPrivateEquity: row.is_private_equity,
        isReit: row.is_reit,
        states: row.state_list
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] top-divesting error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/owner/:ownerName
 * Get detailed portfolio and activity for a specific owner
 */
router.get('/owner/:ownerName', async (req, res) => {
  const pool = getPool();

  try {
    const { ownerName } = req.params;

    // Get current portfolio (latest extract)
    const portfolioQuery = `
      WITH latest_extract AS (
        SELECT MAX(extract_id) as extract_id FROM hha_ownership_extracts
      )
      SELECT
        e.ccn,
        e.organization_name,
        e.doing_business_as,
        e.state,
        e.city,
        o.percentage_ownership,
        o.role_text_owner,
        o.private_equity_owner,
        o.reit_owner
      FROM hha_enrollments e
      JOIN hha_owners o ON e.enrollment_id = o.enrollment_id AND e.extract_id = o.extract_id
      CROSS JOIN latest_extract le
      WHERE e.extract_id = le.extract_id
        AND (o.organization_name_owner ILIKE $1
             OR TRIM(COALESCE(o.first_name_owner, '') || ' ' || COALESCE(o.last_name_owner, '')) ILIKE $1)
      ORDER BY e.state, e.organization_name
    `;

    const portfolioResult = await pool.query(portfolioQuery, [`%${ownerName}%`]);

    // Get transaction history
    const historyQuery = `
      SELECT
        ccn,
        agency_name,
        event_type,
        event_date,
        state,
        previous_percentage,
        new_percentage
      FROM hha_ownership_events
      WHERE owner_name ILIKE $1
      ORDER BY event_date DESC
      LIMIT 100
    `;

    const historyResult = await pool.query(historyQuery, [`%${ownerName}%`]);

    // Get summary stats
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'OWNER_ADDED') as total_acquisitions,
        COUNT(*) FILTER (WHERE event_type = 'OWNER_REMOVED') as total_divestitures,
        MIN(event_date) as first_activity,
        MAX(event_date) as last_activity
      FROM hha_ownership_events
      WHERE owner_name ILIKE $1
    `;

    const statsResult = await pool.query(statsQuery, [`%${ownerName}%`]);

    res.json({
      success: true,
      ownerName,
      currentPortfolio: portfolioResult.rows.map(row => ({
        ccn: row.ccn,
        agencyName: row.doing_business_as || row.organization_name,
        state: row.state,
        city: row.city,
        percentageOwnership: parseFloat(row.percentage_ownership) || null,
        role: row.role_text_owner,
        isPrivateEquity: row.private_equity_owner,
        isReit: row.reit_owner
      })),
      portfolioSize: portfolioResult.rows.length,
      statesOperated: [...new Set(portfolioResult.rows.map(r => r.state))].sort(),
      stats: {
        totalAcquisitions: parseInt(statsResult.rows[0]?.total_acquisitions) || 0,
        totalDivestitures: parseInt(statsResult.rows[0]?.total_divestitures) || 0,
        firstActivity: statsResult.rows[0]?.first_activity,
        lastActivity: statsResult.rows[0]?.last_activity
      },
      transactionHistory: historyResult.rows.map(row => ({
        ccn: row.ccn,
        agencyName: row.agency_name,
        eventType: row.event_type,
        eventDate: row.event_date,
        state: row.state,
        previousPct: parseFloat(row.previous_percentage) || null,
        newPct: parseFloat(row.new_percentage) || null
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] owner detail error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/agency/:ccn
 * Get ownership history for a specific agency
 */
router.get('/agency/:ccn', async (req, res) => {
  const pool = getPool();

  try {
    const { ccn } = req.params;

    // Get agency info
    const agencyQuery = `
      WITH latest_extract AS (
        SELECT MAX(extract_id) as extract_id FROM hha_ownership_extracts
      )
      SELECT
        e.ccn,
        e.organization_name,
        e.doing_business_as,
        e.state,
        e.city,
        e.zip_code
      FROM hha_enrollments e
      CROSS JOIN latest_extract le
      WHERE e.ccn = $1 AND e.extract_id = le.extract_id
    `;

    const agencyResult = await pool.query(agencyQuery, [ccn]);

    // Get current owners
    const ownersQuery = `
      WITH latest_extract AS (
        SELECT MAX(extract_id) as extract_id FROM hha_ownership_extracts
      )
      SELECT
        CASE WHEN o.type_owner = 'I'
             THEN TRIM(COALESCE(o.first_name_owner, '') || ' ' || COALESCE(o.last_name_owner, ''))
             ELSE o.organization_name_owner END as owner_name,
        o.type_owner,
        o.role_text_owner,
        o.percentage_ownership,
        o.private_equity_owner,
        o.reit_owner,
        o.chain_home_office_owner
      FROM hha_enrollments e
      JOIN hha_owners o ON e.enrollment_id = o.enrollment_id AND e.extract_id = o.extract_id
      CROSS JOIN latest_extract le
      WHERE e.ccn = $1 AND e.extract_id = le.extract_id
      ORDER BY o.percentage_ownership DESC NULLS LAST
    `;

    const ownersResult = await pool.query(ownersQuery, [ccn]);

    // Get ownership change history
    const historyQuery = `
      SELECT
        event_type,
        event_date,
        owner_name,
        owner_type,
        owner_role,
        previous_percentage,
        new_percentage,
        is_private_equity,
        is_reit
      FROM hha_ownership_events
      WHERE ccn = $1
      ORDER BY event_date DESC
    `;

    const historyResult = await pool.query(historyQuery, [ccn]);

    const agency = agencyResult.rows[0];

    res.json({
      success: true,
      agency: agency ? {
        ccn: agency.ccn,
        name: agency.doing_business_as || agency.organization_name,
        state: agency.state,
        city: agency.city,
        zipCode: agency.zip_code
      } : null,
      currentOwners: ownersResult.rows.map(row => ({
        name: row.owner_name,
        type: row.type_owner === 'I' ? 'Individual' : 'Organization',
        role: row.role_text_owner,
        percentage: parseFloat(row.percentage_ownership) || null,
        isPrivateEquity: row.private_equity_owner,
        isReit: row.reit_owner,
        isChainOffice: row.chain_home_office_owner
      })),
      ownershipHistory: historyResult.rows.map(row => ({
        eventType: row.event_type,
        eventDate: row.event_date,
        ownerName: row.owner_name,
        ownerType: row.owner_type === 'I' ? 'Individual' : 'Organization',
        role: row.owner_role,
        previousPct: parseFloat(row.previous_percentage) || null,
        newPct: parseFloat(row.new_percentage) || null,
        isPrivateEquity: row.is_private_equity,
        isReit: row.is_reit
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] agency detail error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/hha-ma/new-agencies
 * Get list of new agencies (startups) with details
 */
router.get('/new-agencies', async (req, res) => {
  const pool = getPool();

  try {
    const { limit = 50, offset = 0, startDate, endDate, state, cbsa } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || '2023-04-01';

    let filterConditions = '';
    const queryParams = [start, end, parseInt(limit), parseInt(offset)];
    let paramIndex = 5;

    if (state) {
      filterConditions += ` AND state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (cbsa) {
      filterConditions += ` AND cbsa_code = $${paramIndex}`;
      queryParams.push(cbsa);
      paramIndex++;
    }

    const query = `
      SELECT
        ccn,
        agency_name,
        state,
        city,
        zip_code,
        cbsa_code,
        cbsa_name,
        county_name,
        first_seen_date,
        initial_owner_name,
        initial_owner_type
      FROM hha_new_agencies
      WHERE first_seen_date BETWEEN $1 AND $2
        ${filterConditions}
      ORDER BY first_seen_date DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM hha_new_agencies
      WHERE first_seen_date BETWEEN $1 AND $2
        ${filterConditions}
    `;

    const countResult = await pool.query(countQuery, queryParams.slice(0, paramIndex - 2));

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].total),
      data: result.rows.map(row => ({
        ccn: row.ccn,
        agencyName: row.agency_name,
        state: row.state,
        city: row.city,
        zipCode: row.zip_code,
        cbsaCode: row.cbsa_code,
        cbsaName: row.cbsa_name,
        county: row.county_name,
        firstSeenDate: row.first_seen_date,
        initialOwner: row.initial_owner_name,
        ownerType: row.initial_owner_type === 'I' ? 'Individual' : 'Organization'
      }))
    });

  } catch (error) {
    console.error('[HHA MA Analytics] new-agencies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
