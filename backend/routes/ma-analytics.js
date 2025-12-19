/**
 * M&A Analytics API Routes
 *
 * Provides endpoints for ownership change/transaction analytics.
 * Uses facility_events table (OWNER_ADDED, OWNER_REMOVED) combined
 * with facility data for beds and location context.
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const getPool = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
  return new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });
};

/**
 * GET /api/ma-analytics/summary
 * Get summary statistics for M&A activity
 *
 * Query params:
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - state: Filter by state abbreviation (e.g., 'FL')
 * - operator: Filter by operator name (matches buyer OR seller)
 */
router.get('/summary', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, state, operator } = req.query;

    // Default to last 12 months if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    // Build filter conditions
    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND fe.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (operator) {
      filterConditions += ` AND (fe.new_value ILIKE $${paramIndex} OR fe.previous_value ILIKE $${paramIndex})`;
      queryParams.push(`%${operator}%`);
      paramIndex++;
    }

    // Get current period stats
    const currentPeriodQuery = `
      SELECT
        COUNT(DISTINCT fe.ccn) as total_transactions,
        COALESCE(SUM(sf.certified_beds), 0) as total_beds_changed,
        COUNT(DISTINCT fe.state) as active_markets
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        ${filterConditions}
    `;

    const currentResult = await pool.query(currentPeriodQuery, queryParams);

    // Calculate YoY change - get same period from previous year
    const startDate1 = new Date(start);
    const endDate1 = new Date(end);
    const prevStart = new Date(startDate1.setFullYear(startDate1.getFullYear() - 1)).toISOString().split('T')[0];
    const prevEnd = new Date(endDate1.setFullYear(endDate1.getFullYear() - 1)).toISOString().split('T')[0];

    // Build prev period params with same filters
    const prevParams = [prevStart, prevEnd, ...queryParams.slice(2)];

    const prevPeriodQuery = `
      SELECT COUNT(DISTINCT ccn) as total_transactions
      FROM facility_events fe
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        ${filterConditions}
    `;

    const prevResult = await pool.query(prevPeriodQuery, prevParams);

    const currentTransactions = parseInt(currentResult.rows[0].total_transactions) || 0;
    const prevTransactions = parseInt(prevResult.rows[0].total_transactions) || 0;

    let yoyChange = 0;
    if (prevTransactions > 0) {
      yoyChange = ((currentTransactions - prevTransactions) / prevTransactions) * 100;
    }

    res.json({
      success: true,
      totalTransactions: currentTransactions,
      totalBedsChanged: parseInt(currentResult.rows[0].total_beds_changed) || 0,
      activeMarkets: parseInt(currentResult.rows[0].active_markets) || 0,
      yoyChange: Math.round(yoyChange * 10) / 10,
      dateRange: { start, end },
      filters: { state: state || null, operator: operator || null }
    });

  } catch (error) {
    console.error('[MA Analytics API] summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/volume
 * Get monthly transaction volume for charting
 *
 * Query params:
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - state: Filter by state abbreviation
 * - operator: Filter by operator name (matches buyer OR seller)
 */
router.get('/volume', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, state, operator } = req.query;

    // Default to last 24 months if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0];

    // Build filter conditions
    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND fe.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (operator) {
      filterConditions += ` AND (fe.new_value ILIKE $${paramIndex} OR fe.previous_value ILIKE $${paramIndex})`;
      queryParams.push(`%${operator}%`);
      paramIndex++;
    }

    const query = `
      SELECT
        TO_CHAR(fe.event_date, 'YYYY-MM') as month,
        COUNT(DISTINCT fe.ccn) as transactions,
        COALESCE(SUM(DISTINCT sf.certified_beds), 0) as beds_changed
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        ${filterConditions}
      GROUP BY TO_CHAR(fe.event_date, 'YYYY-MM')
      ORDER BY month
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        month: row.month,
        transactions: parseInt(row.transactions),
        bedsChanged: parseInt(row.beds_changed)
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] volume error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/by-state
 * Get transaction activity by state for map and leaderboard
 *
 * Query params:
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - state: Filter by state abbreviation
 * - operator: Filter by operator name (matches buyer OR seller)
 */
router.get('/by-state', async (req, res) => {
  const pool = getPool();

  try {
    const { startDate, endDate, state, operator } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    // Build filter conditions
    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND fe.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (operator) {
      filterConditions += ` AND (fe.new_value ILIKE $${paramIndex} OR fe.previous_value ILIKE $${paramIndex})`;
      queryParams.push(`%${operator}%`);
      paramIndex++;
    }

    // Get state-level transaction stats
    const stateQuery = `
      SELECT
        fe.state,
        COUNT(DISTINCT fe.ccn) as transactions,
        COALESCE(SUM(DISTINCT sf.certified_beds), 0) as beds_changed
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        AND fe.state IS NOT NULL
        ${filterConditions}
      GROUP BY fe.state
      ORDER BY transactions DESC
    `;

    const stateResult = await pool.query(stateQuery, queryParams);

    // For top 15 states by activity, get detailed buyer/seller info
    // For remaining states, just return transaction counts (to keep API fast)
    const topStates = stateResult.rows.slice(0, 15);
    const remainingStates = stateResult.rows.slice(15);

    // Build operator filter for sub-queries
    const operatorFilter = operator ? ` AND (new_value ILIKE '%${operator.replace(/'/g, "''")}%' OR previous_value ILIKE '%${operator.replace(/'/g, "''")}%')` : '';

    const topStatesWithDetails = await Promise.all(
      topStates.map(async (stateRow) => {
        // Top buyers in this state
        const buyersQuery = `
          SELECT
            SPLIT_PART(new_value, ' (', 1) as name,
            COUNT(DISTINCT ccn) as count
          FROM facility_events
          WHERE event_type = 'OWNER_ADDED'
            AND state = $1
            AND event_date BETWEEN $2 AND $3
            AND new_value IS NOT NULL
            ${operatorFilter}
          GROUP BY SPLIT_PART(new_value, ' (', 1)
          ORDER BY count DESC
          LIMIT 3
        `;

        const buyersResult = await pool.query(buyersQuery, [stateRow.state, start, end]);

        // Top sellers in this state
        const sellersQuery = `
          SELECT
            SPLIT_PART(previous_value, ' (', 1) as name,
            COUNT(DISTINCT ccn) as count
          FROM facility_events
          WHERE event_type = 'OWNER_REMOVED'
            AND state = $1
            AND event_date BETWEEN $2 AND $3
            AND previous_value IS NOT NULL
            ${operatorFilter}
          GROUP BY SPLIT_PART(previous_value, ' (', 1)
          ORDER BY count DESC
          LIMIT 3
        `;

        const sellersResult = await pool.query(sellersQuery, [stateRow.state, start, end]);

        return {
          state: stateRow.state,
          transactions: parseInt(stateRow.transactions),
          bedsChanged: parseInt(stateRow.beds_changed),
          topBuyers: buyersResult.rows.map(r => r.name),
          topSellers: sellersResult.rows.map(r => r.name)
        };
      })
    );

    // Add remaining states without detailed buyer/seller queries (for map coloring)
    const remainingStatesSimple = remainingStates.map(stateRow => ({
      state: stateRow.state,
      transactions: parseInt(stateRow.transactions),
      bedsChanged: parseInt(stateRow.beds_changed),
      topBuyers: [],
      topSellers: []
    }));

    res.json({
      success: true,
      data: [...topStatesWithDetails, ...remainingStatesSimple]
    });

  } catch (error) {
    console.error('[MA Analytics API] by-state error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/top-buyers
 * Get the most active acquirers
 *
 * Query params:
 * - limit: Number of results (default 20)
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - state: Filter by state abbreviation
 * - operator: Filter by operator name (matches buyer OR seller)
 */
router.get('/top-buyers', async (req, res) => {
  const pool = getPool();

  try {
    const { limit = 20, startDate, endDate, state, operator } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    // Build filter conditions
    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND fe.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (operator) {
      // When filtering by operator, show buyers who were counterparties (i.e., the seller was the operator)
      filterConditions += ` AND fe.previous_value ILIKE $${paramIndex}`;
      queryParams.push(`%${operator}%`);
      paramIndex++;
    }

    queryParams.push(parseInt(limit));

    const query = `
      SELECT
        SPLIT_PART(fe.new_value, ' (', 1) as name,
        COUNT(DISTINCT fe.ccn) as acquisitions,
        COALESCE(SUM(DISTINCT sf.certified_beds), 0) as total_beds,
        ARRAY_AGG(DISTINCT fe.state) FILTER (WHERE fe.state IS NOT NULL) as states
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type = 'OWNER_ADDED'
        AND fe.event_date BETWEEN $1 AND $2
        AND fe.new_value IS NOT NULL
        ${filterConditions}
      GROUP BY SPLIT_PART(fe.new_value, ' (', 1)
      HAVING COUNT(DISTINCT fe.ccn) >= 1
      ORDER BY acquisitions DESC
      LIMIT $${paramIndex}
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        name: row.name,
        acquisitions: parseInt(row.acquisitions),
        totalBeds: parseInt(row.total_beds),
        states: row.states || []
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] top-buyers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/top-sellers
 * Get the most active sellers/divestors
 *
 * Query params:
 * - limit: Number of results (default 20)
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - state: Filter by state abbreviation
 * - operator: Filter by operator name (matches buyer OR seller)
 */
router.get('/top-sellers', async (req, res) => {
  const pool = getPool();

  try {
    const { limit = 20, startDate, endDate, state, operator } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    // Build filter conditions
    let filterConditions = '';
    const queryParams = [start, end];
    let paramIndex = 3;

    if (state) {
      filterConditions += ` AND fe.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (operator) {
      // When filtering by operator, show sellers who were counterparties (i.e., the buyer was the operator)
      filterConditions += ` AND fe.new_value ILIKE $${paramIndex}`;
      queryParams.push(`%${operator}%`);
      paramIndex++;
    }

    queryParams.push(parseInt(limit));

    const query = `
      SELECT
        SPLIT_PART(fe.previous_value, ' (', 1) as name,
        COUNT(DISTINCT fe.ccn) as divestitures,
        COALESCE(SUM(DISTINCT sf.certified_beds), 0) as total_beds,
        ARRAY_AGG(DISTINCT fe.state) FILTER (WHERE fe.state IS NOT NULL) as states
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type = 'OWNER_REMOVED'
        AND fe.event_date BETWEEN $1 AND $2
        AND fe.previous_value IS NOT NULL
        ${filterConditions}
      GROUP BY SPLIT_PART(fe.previous_value, ' (', 1)
      HAVING COUNT(DISTINCT fe.ccn) >= 1
      ORDER BY divestitures DESC
      LIMIT $${paramIndex}
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        name: row.name,
        divestitures: parseInt(row.divestitures),
        totalBeds: parseInt(row.total_beds),
        states: row.states || []
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] top-sellers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/recent-transactions
 * Get recent ownership change transactions with details
 *
 * Query params:
 * - limit: Number of results (default 50)
 * - state: Filter by state (optional)
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 */
router.get('/recent-transactions', async (req, res) => {
  const pool = getPool();

  try {
    const { limit = 50, state, startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    let query = `
      SELECT
        fe.ccn,
        fe.event_type,
        fe.event_date,
        fe.state,
        fe.county,
        COALESCE(fe.new_value, fe.previous_value) as owner_info,
        sf.facility_name,
        sf.city,
        sf.certified_beds,
        sf.overall_rating,
        sf.parent_organization
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
    `;

    const params = [start, end];
    let paramIndex = 3;

    if (state) {
      query += ` AND fe.state = $${paramIndex}`;
      params.push(state.toUpperCase());
      paramIndex++;
    }

    query += ` ORDER BY fe.event_date DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ccn: row.ccn,
        eventType: row.event_type,
        eventDate: row.event_date,
        state: row.state,
        county: row.county,
        ownerInfo: row.owner_info,
        facilityName: row.facility_name,
        city: row.city,
        certifiedBeds: row.certified_beds,
        overallRating: row.overall_rating,
        parentOrganization: row.parent_organization
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] recent-transactions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/facility/:ccn/history
 * Get ownership change history for a specific facility
 *
 * @param ccn: CMS Certification Number (Federal Provider Number)
 */
router.get('/facility/:ccn/history', async (req, res) => {
  const pool = getPool();

  try {
    const { ccn } = req.params;

    // Get facility info
    const facilityQuery = `
      SELECT
        federal_provider_number,
        facility_name,
        city,
        state,
        county,
        certified_beds,
        overall_rating,
        parent_organization,
        ownership_type
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;

    const facilityResult = await pool.query(facilityQuery, [ccn]);

    // Get ownership change history
    const historyQuery = `
      SELECT
        fe.event_type,
        fe.event_date,
        COALESCE(fe.new_value, fe.previous_value) as owner_info,
        e.extract_date
      FROM facility_events fe
      LEFT JOIN cms_extracts e ON fe.current_extract_id = e.extract_id
      WHERE fe.ccn = $1
        AND fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
      ORDER BY fe.event_date DESC
    `;

    const historyResult = await pool.query(historyQuery, [ccn]);

    // Get current owners from most recent snapshot
    const currentOwnersQuery = `
      SELECT
        fod.owner_name,
        fod.owner_type,
        fod.owner_role,
        fod.ownership_percentage,
        fod.association_date
      FROM facility_ownership_details fod
      JOIN cms_extracts e ON fod.extract_id = e.extract_id
      WHERE fod.ccn = $1
      ORDER BY e.extract_date DESC
      LIMIT 20
    `;

    const currentOwnersResult = await pool.query(currentOwnersQuery, [ccn]);

    res.json({
      success: true,
      facility: facilityResult.rows[0] || null,
      history: historyResult.rows.map(row => ({
        eventType: row.event_type,
        eventDate: row.event_date,
        ownerInfo: row.owner_info,
        extractDate: row.extract_date
      })),
      currentOwners: currentOwnersResult.rows.map(row => ({
        ownerName: row.owner_name,
        ownerType: row.owner_type,
        ownerRole: row.owner_role,
        ownershipPercentage: row.ownership_percentage,
        associationDate: row.association_date
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] facility history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/transactions
 * Paginated, filterable transaction explorer
 * Pairs OWNER_REMOVED + OWNER_ADDED events into single transaction rows
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - state: Filter by state(s) - can be multi-value: state=FL&state=CA
 * - cbsa: Filter by CBSA(s) - can be multi-value
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 * - oldOperator: Search for seller name (partial match)
 * - newOperator: Search for buyer name (partial match)
 * - minBeds: Minimum bed count
 * - search: Search facility name (partial match)
 * - sortBy: Sort field - 'date', 'beds', 'state', 'facility' (default: 'date')
 * - sortOrder: 'asc' or 'desc' (default: 'desc')
 */
router.get('/transactions', async (req, res) => {
  const pool = getPool();

  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      oldOperator,
      newOperator,
      minBeds,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Handle multi-value state and cbsa params
    let states = req.query.state;
    if (states && !Array.isArray(states)) {
      states = [states];
    }

    let cbsas = req.query.cbsa;
    if (cbsas && !Array.isArray(cbsas)) {
      cbsas = [cbsas];
    }

    // Validate and constrain params
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Default date range to last 2 years if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0];

    // Build dynamic WHERE conditions
    const conditions = ['oc.event_date BETWEEN $1 AND $2'];
    const params = [start, end];
    let paramIndex = 3;

    // State filter
    if (states && states.length > 0) {
      conditions.push(`sf.state = ANY($${paramIndex})`);
      params.push(states.map(s => s.toUpperCase()));
      paramIndex++;
    }

    // CBSA filter
    if (cbsas && cbsas.length > 0) {
      conditions.push(`sf.cbsa_code = ANY($${paramIndex})`);
      params.push(cbsas);
      paramIndex++;
    }

    // Old operator (seller) search
    if (oldOperator) {
      conditions.push(`oc.old_operator ILIKE $${paramIndex}`);
      params.push(`%${oldOperator}%`);
      paramIndex++;
    }

    // New operator (buyer) search
    if (newOperator) {
      conditions.push(`oc.new_operator ILIKE $${paramIndex}`);
      params.push(`%${newOperator}%`);
      paramIndex++;
    }

    // Minimum beds filter
    if (minBeds) {
      conditions.push(`sf.certified_beds >= $${paramIndex}`);
      params.push(parseInt(minBeds));
      paramIndex++;
    }

    // Facility name search
    if (search) {
      conditions.push(`sf.facility_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Determine sort column and order
    const validSortFields = {
      date: 'oc.event_date',
      beds: 'sf.certified_beds',
      state: 'sf.state',
      facility: 'sf.facility_name'
    };
    const sortField = validSortFields[sortBy] || 'oc.event_date';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Main query with pairing logic
    const dataQuery = `
      WITH ownership_changes AS (
        SELECT
          fe.ccn,
          fe.event_date,
          MAX(CASE WHEN fe.event_type = 'OWNER_REMOVED' THEN SPLIT_PART(fe.previous_value, ' (', 1) END) as old_operator,
          MAX(CASE WHEN fe.event_type = 'OWNER_ADDED' THEN SPLIT_PART(fe.new_value, ' (', 1) END) as new_operator
        FROM facility_events fe
        WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
          AND fe.event_date BETWEEN $1 AND $2
        GROUP BY fe.ccn, fe.event_date
        HAVING COUNT(DISTINCT fe.event_type) = 2
      )
      SELECT
        oc.event_date as date,
        oc.ccn,
        sf.facility_name,
        sf.city,
        sf.state,
        sf.cbsa_title as cbsa,
        sf.cbsa_code,
        sf.certified_beds as beds,
        sf.overall_rating as rating,
        oc.old_operator,
        oc.new_operator
      FROM ownership_changes oc
      JOIN snf_facilities sf ON oc.ccn = sf.federal_provider_number
      WHERE ${whereClause}
      ORDER BY ${sortField} ${sortDirection} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limitNum, offset);

    // Count query for pagination
    const countQuery = `
      WITH ownership_changes AS (
        SELECT
          fe.ccn,
          fe.event_date,
          MAX(CASE WHEN fe.event_type = 'OWNER_REMOVED' THEN SPLIT_PART(fe.previous_value, ' (', 1) END) as old_operator,
          MAX(CASE WHEN fe.event_type = 'OWNER_ADDED' THEN SPLIT_PART(fe.new_value, ' (', 1) END) as new_operator
        FROM facility_events fe
        WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
          AND fe.event_date BETWEEN $1 AND $2
        GROUP BY fe.ccn, fe.event_date
        HAVING COUNT(DISTINCT fe.event_type) = 2
      )
      SELECT COUNT(*) as total
      FROM ownership_changes oc
      JOIN snf_facilities sf ON oc.ccn = sf.federal_provider_number
      WHERE ${whereClause}
    `;

    // Execute queries in parallel
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)) // Remove limit/offset for count
    ]);

    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limitNum);

    res.json({
      success: true,
      data: dataResult.rows.map(row => ({
        date: row.date,
        ccn: row.ccn,
        facilityName: row.facility_name,
        city: row.city,
        state: row.state,
        cbsa: row.cbsa,
        cbsaCode: row.cbsa_code,
        beds: row.beds,
        rating: row.rating,
        oldOperator: row.old_operator,
        newOperator: row.new_operator
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages
      }
    });

  } catch (error) {
    console.error('[MA Analytics API] transactions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/filter-options
 * Get available filter values for transaction explorer dropdowns/autocomplete
 *
 * Returns distinct states, CBSAs, and operator names that have transaction activity
 */
router.get('/filter-options', async (req, res) => {
  const pool = getPool();

  try {
    // Get distinct states with transactions
    const statesQuery = `
      SELECT DISTINCT fe.state
      FROM facility_events fe
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.state IS NOT NULL
      ORDER BY fe.state
    `;

    // Get distinct CBSAs with transactions
    const cbsasQuery = `
      SELECT DISTINCT sf.cbsa_code, sf.cbsa_title
      FROM facility_events fe
      JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND sf.cbsa_code IS NOT NULL
        AND sf.cbsa_title IS NOT NULL
      ORDER BY sf.cbsa_title
    `;

    // Get top operators (for autocomplete - limit to those with 5+ transactions)
    const operatorsQuery = `
      WITH all_operators AS (
        SELECT SPLIT_PART(new_value, ' (', 1) as name, 'buyer' as type
        FROM facility_events
        WHERE event_type = 'OWNER_ADDED' AND new_value IS NOT NULL
        UNION ALL
        SELECT SPLIT_PART(previous_value, ' (', 1) as name, 'seller' as type
        FROM facility_events
        WHERE event_type = 'OWNER_REMOVED' AND previous_value IS NOT NULL
      )
      SELECT name, COUNT(*) as count
      FROM all_operators
      GROUP BY name
      HAVING COUNT(*) >= 5
      ORDER BY count DESC
      LIMIT 500
    `;

    const [statesResult, cbsasResult, operatorsResult] = await Promise.all([
      pool.query(statesQuery),
      pool.query(cbsasQuery),
      pool.query(operatorsQuery)
    ]);

    res.json({
      success: true,
      states: statesResult.rows.map(r => r.state),
      cbsas: cbsasResult.rows.map(r => ({
        code: r.cbsa_code,
        title: r.cbsa_title
      })),
      operators: operatorsResult.rows.map(r => ({
        name: r.name,
        count: parseInt(r.count)
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] filter-options error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/owner-history
 * Get acquisition history for a specific owner/operator
 *
 * Query params:
 * - ownerName: Name of the owner/operator (required)
 * - startDate: Start of date range (YYYY-MM-DD) - defaults to all time
 * - endDate: End of date range (YYYY-MM-DD) - defaults to today
 */
router.get('/owner-history', async (req, res) => {
  const pool = getPool();

  try {
    const { ownerName, startDate, endDate } = req.query;

    if (!ownerName) {
      return res.status(400).json({
        success: false,
        error: 'ownerName parameter is required'
      });
    }

    // Default to all time if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || '2020-01-01';

    // Search pattern for owner name (partial match)
    const searchPattern = `%${ownerName}%`;

    // Get total acquired facilities
    const acquiredQuery = `
      SELECT
        COUNT(DISTINCT ccn) as total,
        COALESCE(SUM(sf.certified_beds), 0) as beds
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type = 'OWNER_ADDED'
        AND fe.event_date BETWEEN $1 AND $2
        AND fe.new_value ILIKE $3
    `;
    const acquiredResult = await pool.query(acquiredQuery, [start, end, searchPattern]);

    // Get total divested facilities
    const divestedQuery = `
      SELECT
        COUNT(DISTINCT ccn) as total,
        COALESCE(SUM(sf.certified_beds), 0) as beds
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type = 'OWNER_REMOVED'
        AND fe.event_date BETWEEN $1 AND $2
        AND fe.previous_value ILIKE $3
    `;
    const divestedResult = await pool.query(divestedQuery, [start, end, searchPattern]);

    const totalAcquired = parseInt(acquiredResult.rows[0].total) || 0;
    const totalDivested = parseInt(divestedResult.rows[0].total) || 0;

    // Get year-by-year breakdown
    const byYearQuery = `
      SELECT
        EXTRACT(YEAR FROM fe.event_date)::integer as year,
        SUM(CASE WHEN fe.event_type = 'OWNER_ADDED' AND fe.new_value ILIKE $3 THEN 1 ELSE 0 END) as acquired,
        SUM(CASE WHEN fe.event_type = 'OWNER_REMOVED' AND fe.previous_value ILIKE $3 THEN 1 ELSE 0 END) as divested
      FROM facility_events fe
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        AND (
          (fe.event_type = 'OWNER_ADDED' AND fe.new_value ILIKE $3)
          OR (fe.event_type = 'OWNER_REMOVED' AND fe.previous_value ILIKE $3)
        )
      GROUP BY EXTRACT(YEAR FROM fe.event_date)
      ORDER BY year
    `;
    const byYearResult = await pool.query(byYearQuery, [start, end, searchPattern]);

    // Get recent transactions (last 20)
    const recentQuery = `
      SELECT
        fe.event_date as date,
        fe.ccn,
        sf.facility_name,
        sf.state,
        sf.city,
        sf.certified_beds as beds,
        fe.event_type,
        CASE
          WHEN fe.event_type = 'OWNER_ADDED' THEN 'acquired'
          ELSE 'divested'
        END as type,
        CASE
          WHEN fe.event_type = 'OWNER_ADDED' THEN
            (SELECT SPLIT_PART(fe2.previous_value, ' (', 1)
             FROM facility_events fe2
             WHERE fe2.ccn = fe.ccn
               AND fe2.event_date = fe.event_date
               AND fe2.event_type = 'OWNER_REMOVED'
             LIMIT 1)
          ELSE
            (SELECT SPLIT_PART(fe2.new_value, ' (', 1)
             FROM facility_events fe2
             WHERE fe2.ccn = fe.ccn
               AND fe2.event_date = fe.event_date
               AND fe2.event_type = 'OWNER_ADDED'
             LIMIT 1)
        END as counterparty
      FROM facility_events fe
      LEFT JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        AND (
          (fe.event_type = 'OWNER_ADDED' AND fe.new_value ILIKE $3)
          OR (fe.event_type = 'OWNER_REMOVED' AND fe.previous_value ILIKE $3)
        )
      ORDER BY fe.event_date DESC
      LIMIT 20
    `;
    const recentResult = await pool.query(recentQuery, [start, end, searchPattern]);

    res.json({
      success: true,
      ownerName,
      summary: {
        totalAcquired,
        totalDivested,
        netChange: totalAcquired - totalDivested,
        bedsAcquired: parseInt(acquiredResult.rows[0].beds) || 0,
        bedsDivested: parseInt(divestedResult.rows[0].beds) || 0
      },
      byYear: byYearResult.rows.map(row => ({
        year: row.year,
        acquired: parseInt(row.acquired) || 0,
        divested: parseInt(row.divested) || 0
      })),
      recentTransactions: recentResult.rows.map(row => ({
        date: row.date,
        ccn: row.ccn,
        facilityName: row.facility_name,
        state: row.state,
        city: row.city,
        beds: row.beds,
        type: row.type,
        counterparty: row.counterparty || 'Unknown'
      }))
    });

  } catch (error) {
    console.error('[MA Analytics API] owner-history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/operator-facilities
 * Get facilities that an operator transacted (acquired or divested) during a date range
 * Returns facilities with lat/lng for map plotting across all states
 *
 * Query params:
 * - operator: Operator name (required, partial match)
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 */
router.get('/operator-facilities', async (req, res) => {
  const pool = getPool();

  try {
    const { operator, startDate, endDate } = req.query;

    if (!operator) {
      return res.status(400).json({
        success: false,
        error: 'operator parameter is required'
      });
    }

    // Default to last 12 months if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    const searchPattern = `%${operator}%`;

    // Get facilities where operator was involved (as buyer or seller)
    const query = `
      SELECT DISTINCT ON (fe.ccn)
        fe.ccn,
        sf.facility_name,
        sf.city,
        fe.state,
        sf.county,
        sf.certified_beds,
        sf.overall_rating,
        sf.latitude,
        sf.longitude,
        fe.event_date as transaction_date,
        fe.event_type,
        CASE
          WHEN fe.event_type = 'OWNER_ADDED' AND fe.new_value ILIKE $3 THEN 'acquired'
          WHEN fe.event_type = 'OWNER_REMOVED' AND fe.previous_value ILIKE $3 THEN 'divested'
          ELSE 'involved'
        END as transaction_type,
        CASE
          WHEN fe.event_type = 'OWNER_ADDED' THEN SPLIT_PART(fe.new_value, ' (', 1)
          ELSE NULL
        END as new_operator,
        CASE
          WHEN fe.event_type = 'OWNER_REMOVED' THEN SPLIT_PART(fe.previous_value, ' (', 1)
          ELSE NULL
        END as old_operator
      FROM facility_events fe
      JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.event_date BETWEEN $1 AND $2
        AND (fe.new_value ILIKE $3 OR fe.previous_value ILIKE $3)
        AND sf.latitude IS NOT NULL
        AND sf.longitude IS NOT NULL
      ORDER BY fe.ccn, fe.event_date DESC
    `;

    const result = await pool.query(query, [start, end, searchPattern]);

    // Build facility list and calculate summary
    const facilitiesMap = new Map();
    const statesSet = new Set();

    for (const row of result.rows) {
      statesSet.add(row.state);

      if (!facilitiesMap.has(row.ccn)) {
        facilitiesMap.set(row.ccn, {
          ccn: row.ccn,
          facilityName: row.facility_name,
          city: row.city,
          state: row.state,
          county: row.county,
          beds: row.certified_beds,
          rating: row.overall_rating,
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          transactionDate: row.transaction_date,
          transactionType: row.transaction_type,
          newOperator: row.new_operator,
          oldOperator: row.old_operator
        });
      }
    }

    const facilities = Array.from(facilitiesMap.values());
    const totalBeds = facilities.reduce((sum, f) => sum + (f.beds || 0), 0);

    res.json({
      success: true,
      operator,
      dateRange: { start, end },
      summary: {
        totalFacilities: facilities.length,
        totalBeds,
        statesPresent: Array.from(statesSet).sort()
      },
      facilities
    });

  } catch (error) {
    console.error('[MA Analytics API] operator-facilities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/state-facilities
 * Get facilities that transacted in a specific state during a date range
 * Returns facilities with lat/lng for map plotting
 *
 * Query params:
 * - state: State abbreviation (required, e.g., 'FL')
 * - startDate: Start of date range (YYYY-MM-DD)
 * - endDate: End of date range (YYYY-MM-DD)
 */
router.get('/state-facilities', async (req, res) => {
  const pool = getPool();

  try {
    const { state, startDate, endDate } = req.query;

    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'state parameter is required'
      });
    }

    // Default to last 12 months if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

    // Get facilities that had ownership changes in this state during the date range
    // Join with snf_facilities to get lat/lng and facility details
    const query = `
      SELECT DISTINCT ON (fe.ccn)
        fe.ccn,
        sf.facility_name,
        sf.city,
        sf.county,
        sf.certified_beds,
        sf.overall_rating,
        sf.latitude,
        sf.longitude,
        fe.event_date as transaction_date,
        fe.event_type,
        CASE
          WHEN fe.event_type = 'OWNER_ADDED' THEN SPLIT_PART(fe.new_value, ' (', 1)
          ELSE NULL
        END as new_operator,
        CASE
          WHEN fe.event_type = 'OWNER_REMOVED' THEN SPLIT_PART(fe.previous_value, ' (', 1)
          ELSE NULL
        END as old_operator
      FROM facility_events fe
      JOIN snf_facilities sf ON fe.ccn = sf.federal_provider_number
      WHERE fe.event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
        AND fe.state = $1
        AND fe.event_date BETWEEN $2 AND $3
        AND sf.latitude IS NOT NULL
        AND sf.longitude IS NOT NULL
      ORDER BY fe.ccn, fe.event_date DESC
    `;

    const result = await pool.query(query, [state.toUpperCase(), start, end]);

    // For facilities that have both OWNER_ADDED and OWNER_REMOVED on the same date,
    // we want to show both the old and new operator. Let's enhance the data.
    const facilitiesMap = new Map();

    for (const row of result.rows) {
      if (!facilitiesMap.has(row.ccn)) {
        facilitiesMap.set(row.ccn, {
          ccn: row.ccn,
          facilityName: row.facility_name,
          city: row.city,
          county: row.county,
          beds: row.certified_beds,
          rating: row.overall_rating,
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude),
          transactionDate: row.transaction_date,
          newOperator: row.new_operator,
          oldOperator: row.old_operator
        });
      } else {
        // Merge operator info if we have both add and remove events
        const existing = facilitiesMap.get(row.ccn);
        if (row.new_operator && !existing.newOperator) {
          existing.newOperator = row.new_operator;
        }
        if (row.old_operator && !existing.oldOperator) {
          existing.oldOperator = row.old_operator;
        }
      }
    }

    const facilities = Array.from(facilitiesMap.values());

    res.json({
      success: true,
      state: state.toUpperCase(),
      dateRange: { start, end },
      totalFacilities: facilities.length,
      facilities
    });

  } catch (error) {
    console.error('[MA Analytics API] state-facilities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/ma-analytics/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  const pool = getPool();

  try {
    const eventCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM facility_events
      WHERE event_type IN ('OWNER_ADDED', 'OWNER_REMOVED')
    `);

    const ownershipCount = await pool.query(`
      SELECT COUNT(*) as count FROM facility_ownership_details
    `);

    const extractCount = await pool.query(`
      SELECT COUNT(DISTINCT extract_id) as count FROM facility_ownership_details
    `);

    res.json({
      success: true,
      message: 'M&A Analytics service is healthy',
      stats: {
        ownershipEvents: parseInt(eventCount.rows[0].count),
        ownershipRecords: parseInt(ownershipCount.rows[0].count),
        monthlySnapshots: parseInt(extractCount.rows[0].count)
      }
    });

  } catch (error) {
    console.error('[MA Analytics API] health error:', error);
    res.status(503).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

module.exports = router;
