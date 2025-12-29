/**
 * Home Health Market Data Routes
 *
 * Provides API endpoints for querying CMS Home Health Compare data:
 * - Agency listings with filters
 * - Agency details and quality metrics
 * - State and national benchmarks
 * - Historical trends and comparisons
 */

const express = require('express');
const router = express.Router();
const { getMarketPool } = require('../config/database');

// Use centralized market database pool
const pool = getMarketPool();

/**
 * GET /api/hh-market/agencies
 * List all agencies with optional filters
 *
 * Query params:
 * - state: Filter by state (e.g., "CA", "TX")
 * - stars: Filter by star rating (e.g., "4", "4.5", "4+")
 * - ownership: Filter by ownership type (e.g., "PROPRIETARY", "NON-PROFIT")
 * - search: Search by name or CCN
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 500)
 * - sortBy: Sort field (default "provider_name")
 * - sortOrder: Sort order ("asc" or "desc", default "asc")
 */
router.get('/agencies', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      state,
      stars,
      ownership,
      search,
      page = 1,
      limit = 50,
      sortBy = 'provider_name',
      sortOrder = 'asc'
    } = req.query;

    // Get latest extract
    const extractResult = await client.query(
      `SELECT extract_id FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.json({ agencies: [], total: 0, page: 1, pages: 0 });
    }

    const extractId = extractResult.rows[0].extract_id;

    // Build query
    let conditions = ['extract_id = $1'];
    let params = [extractId];
    let paramIndex = 2;

    if (state) {
      conditions.push(`state = $${paramIndex}`);
      params.push(state.toUpperCase());
      paramIndex++;
    }

    if (stars) {
      if (stars.endsWith('+')) {
        const minStars = parseFloat(stars.slice(0, -1));
        conditions.push(`quality_star_rating >= $${paramIndex}`);
        params.push(minStars);
      } else {
        conditions.push(`quality_star_rating = $${paramIndex}`);
        params.push(parseFloat(stars));
      }
      paramIndex++;
    }

    if (ownership) {
      conditions.push(`ownership_type ILIKE $${paramIndex}`);
      params.push(`%${ownership}%`);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(provider_name ILIKE $${paramIndex} OR ccn ILIKE $${paramIndex + 1})`);
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sortBy to prevent SQL injection
    const allowedSortFields = [
      'provider_name', 'state', 'city', 'quality_star_rating',
      'ownership_type', 'ccn', 'timely_initiation_pct',
      'walking_improvement_pct', 'medicare_spending_ratio'
    ];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'provider_name';
    const safeSortOrder = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM hh_provider_snapshots WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pageLimit = Math.min(parseInt(limit), 500);

    const dataResult = await client.query(
      `SELECT
         ccn, state, provider_name, address, city, zip_code,
         telephone, ownership_type, certification_date,
         offers_nursing, offers_pt, offers_ot, offers_speech,
         offers_social_work, offers_aide,
         quality_star_rating,
         timely_initiation_pct, flu_shot_pct,
         walking_improvement_pct, bed_transfer_pct, bathing_improvement_pct,
         dtc_performance_category, ppr_performance_category, pph_performance_category,
         medicare_spending_ratio, episode_count
       FROM hh_provider_snapshots
       WHERE ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageLimit, offset]
    );

    res.json({
      agencies: dataResult.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / pageLimit),
      limit: pageLimit
    });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({ error: 'Failed to fetch agencies' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/agencies/:ccn
 * Get detailed agency information
 */
router.get('/agencies/:ccn', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ccn } = req.params;

    // Get latest extract
    const extractResult = await client.query(
      `SELECT extract_id, extract_date FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.status(404).json({ error: 'No data available' });
    }

    const { extract_id: extractId, extract_date: extractDate } = extractResult.rows[0];

    // Get agency details
    const agencyResult = await client.query(
      `SELECT * FROM hh_provider_snapshots
       WHERE extract_id = $1 AND ccn = $2`,
      [extractId, ccn]
    );

    if (agencyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    const agency = agencyResult.rows[0];

    // Get CAHPS data if available
    const cahpsResult = await client.query(
      `SELECT * FROM hh_cahps_snapshots
       WHERE extract_id = $1 AND ccn = $2`,
      [extractId, ccn]
    );

    // Get state benchmark for comparison
    const benchmarkResult = await client.query(
      `SELECT * FROM hh_state_benchmarks
       WHERE extract_id = $1 AND state = $2`,
      [extractId, agency.state]
    );

    // Get national benchmark
    const nationalResult = await client.query(
      `SELECT * FROM hh_national_benchmarks
       WHERE extract_id = $1`,
      [extractId]
    );

    res.json({
      agency,
      cahps: cahpsResult.rows[0] || null,
      stateBenchmark: benchmarkResult.rows[0] || null,
      nationalBenchmark: nationalResult.rows[0] || null,
      dataDate: extractDate
    });
  } catch (error) {
    console.error('Error fetching agency:', error);
    res.status(500).json({ error: 'Failed to fetch agency details' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/agencies/:ccn/history
 * Get historical snapshots for an agency
 */
router.get('/agencies/:ccn/history', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ccn } = req.params;
    const { limit = 12 } = req.query;

    const result = await client.query(
      `SELECT
         e.extract_date,
         p.quality_star_rating,
         p.timely_initiation_pct,
         p.walking_improvement_pct,
         p.dtc_risk_std_rate,
         p.ppr_risk_std_rate,
         p.pph_risk_std_rate,
         p.medicare_spending_ratio,
         p.ownership_type
       FROM hh_provider_snapshots p
       JOIN hh_extracts e ON p.extract_id = e.extract_id
       WHERE p.ccn = $1 AND e.import_status = 'completed'
       ORDER BY e.extract_date DESC
       LIMIT $2`,
      [ccn, parseInt(limit)]
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/agencies/:ccn/vbp
 * Get VBP (Value-Based Purchasing) scores for an agency
 */
router.get('/agencies/:ccn/vbp', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ccn } = req.params;

    // VBP data may have CCNs without leading zeros, so try both formats
    const ccnWithoutLeadingZeros = ccn.replace(/^0+/, '');

    // Get latest VBP score for this agency
    const result = await client.query(
      `SELECT *
       FROM hh_vbp_scores
       WHERE ccn = $1 OR ccn = $2
       ORDER BY performance_year DESC
       LIMIT 1`,
      [ccn, ccnWithoutLeadingZeros]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'VBP data not found for this agency' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching VBP data:', error);
    res.status(500).json({ error: 'Failed to fetch VBP data' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/agencies/:ccn/events
 * Get events/changes for an agency
 */
router.get('/agencies/:ccn/events', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ccn } = req.params;
    const { limit = 20 } = req.query;

    const result = await client.query(
      `SELECT
         event_id, event_type, event_date,
         previous_value, new_value, change_magnitude
       FROM hh_provider_events
       WHERE ccn = $1
       ORDER BY event_date DESC
       LIMIT $2`,
      [ccn, parseInt(limit)]
    );

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/benchmarks/state/:state
 * Get state benchmark data
 */
router.get('/benchmarks/state/:state', async (req, res) => {
  const client = await pool.connect();
  try {
    const { state } = req.params;

    const extractResult = await client.query(
      `SELECT extract_id FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.status(404).json({ error: 'No data available' });
    }

    const result = await client.query(
      `SELECT * FROM hh_state_benchmarks
       WHERE extract_id = $1 AND state = $2`,
      [extractResult.rows[0].extract_id, state.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'State not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching state benchmark:', error);
    res.status(500).json({ error: 'Failed to fetch benchmark' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/benchmarks/national
 * Get national benchmark data
 */
router.get('/benchmarks/national', async (req, res) => {
  const client = await pool.connect();
  try {
    const extractResult = await client.query(
      `SELECT extract_id FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.status(404).json({ error: 'No data available' });
    }

    const result = await client.query(
      `SELECT * FROM hh_national_benchmarks
       WHERE extract_id = $1`,
      [extractResult.rows[0].extract_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'National data not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching national benchmark:', error);
    res.status(500).json({ error: 'Failed to fetch benchmark' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/benchmarks/states
 * Get all state benchmarks for the latest extract
 */
router.get('/benchmarks/states', async (req, res) => {
  const client = await pool.connect();
  try {
    const extractResult = await client.query(
      `SELECT extract_id FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.json({ benchmarks: [] });
    }

    const result = await client.query(
      `SELECT * FROM hh_state_benchmarks
       WHERE extract_id = $1
       ORDER BY state`,
      [extractResult.rows[0].extract_id]
    );

    res.json({ benchmarks: result.rows });
  } catch (error) {
    console.error('Error fetching state benchmarks:', error);
    res.status(500).json({ error: 'Failed to fetch benchmarks' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/compare
 * Compare multiple agencies
 *
 * Query params:
 * - ccns: Comma-separated list of CCNs (max 10)
 */
router.get('/compare', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ccns } = req.query;

    if (!ccns) {
      return res.status(400).json({ error: 'CCNs required' });
    }

    const ccnList = ccns.split(',').slice(0, 10);

    const extractResult = await client.query(
      `SELECT extract_id FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.status(404).json({ error: 'No data available' });
    }

    const extractId = extractResult.rows[0].extract_id;

    // Generate placeholders for IN clause
    const placeholders = ccnList.map((_, i) => `$${i + 2}`).join(',');

    const result = await client.query(
      `SELECT * FROM hh_provider_snapshots
       WHERE extract_id = $1 AND ccn IN (${placeholders})`,
      [extractId, ...ccnList]
    );

    res.json({ agencies: result.rows });
  } catch (error) {
    console.error('Error comparing agencies:', error);
    res.status(500).json({ error: 'Failed to compare agencies' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/events/recent
 * Get recent events across all agencies
 *
 * Query params:
 * - days: Number of days to look back (default 30)
 * - state: Filter by state
 * - type: Filter by event type (RATING_CHANGE, OWNERSHIP_CHANGE, etc.)
 * - limit: Results limit (default 100, max 500)
 */
router.get('/events/recent', async (req, res) => {
  const client = await pool.connect();
  try {
    const { days = 30, state, type, limit = 100 } = req.query;

    let conditions = [`event_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'`];
    let params = [];
    let paramIndex = 1;

    if (state) {
      conditions.push(`state = $${paramIndex}`);
      params.push(state.toUpperCase());
      paramIndex++;
    }

    if (type) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(type.toUpperCase());
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limitValue = Math.min(parseInt(limit), 500);

    const result = await client.query(
      `SELECT
         e.event_id, e.ccn, e.event_type, e.event_date,
         e.previous_value, e.new_value, e.change_magnitude, e.state,
         p.provider_name
       FROM hh_provider_events e
       LEFT JOIN hh_provider_snapshots p ON e.ccn = p.ccn
         AND p.extract_id = e.current_extract_id
       WHERE ${whereClause}
       ORDER BY e.event_date DESC
       LIMIT $${paramIndex}`,
      [...params, limitValue]
    );

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching recent events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/stats
 * Get summary statistics
 */
router.get('/stats', async (req, res) => {
  const client = await pool.connect();
  try {
    const extractResult = await client.query(
      `SELECT extract_id, extract_date, record_count FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.json({ error: 'No data available' });
    }

    const { extract_id: extractId, extract_date: extractDate, record_count } = extractResult.rows[0];

    // Get stats by state
    const stateStats = await client.query(
      `SELECT state, COUNT(*) as agency_count,
              AVG(quality_star_rating) as avg_rating,
              AVG(timely_initiation_pct) as avg_timely_initiation
       FROM hh_provider_snapshots
       WHERE extract_id = $1 AND quality_star_rating IS NOT NULL
       GROUP BY state
       ORDER BY agency_count DESC`,
      [extractId]
    );

    // Get star rating distribution
    const ratingDist = await client.query(
      `SELECT quality_star_rating as rating, COUNT(*) as count
       FROM hh_provider_snapshots
       WHERE extract_id = $1 AND quality_star_rating IS NOT NULL
       GROUP BY quality_star_rating
       ORDER BY quality_star_rating`,
      [extractId]
    );

    // Get ownership distribution
    const ownershipDist = await client.query(
      `SELECT ownership_type, COUNT(*) as count
       FROM hh_provider_snapshots
       WHERE extract_id = $1
       GROUP BY ownership_type
       ORDER BY count DESC`,
      [extractId]
    );

    res.json({
      dataDate: extractDate,
      totalAgencies: record_count,
      byState: stateStats.rows,
      byRating: ratingDist.rows,
      byOwnership: ownershipDist.rows
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/hh-market/search
 * Search agencies by name, city, or CCN
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 * - state: Filter by state
 * - limit: Results limit (default 20)
 */
router.get('/search', async (req, res) => {
  const client = await pool.connect();
  try {
    const { q, state, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const extractResult = await client.query(
      `SELECT extract_id FROM hh_extracts
       WHERE import_status = 'completed'
       ORDER BY extract_date DESC LIMIT 1`
    );

    if (extractResult.rows.length === 0) {
      return res.json({ results: [] });
    }

    const extractId = extractResult.rows[0].extract_id;

    // Build query with optional state filter
    let conditions = [
      'extract_id = $1',
      '(provider_name ILIKE $2 OR city ILIKE $2 OR ccn ILIKE $2)'
    ];
    let params = [extractId, `%${q}%`];
    let paramIndex = 3;

    if (state) {
      conditions.push(`state = $${paramIndex}`);
      params.push(state.toUpperCase());
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await client.query(
      `SELECT ccn, provider_name, city, state, quality_star_rating
       FROM hh_provider_snapshots
       WHERE ${whereClause}
       ORDER BY
         CASE WHEN provider_name ILIKE $${paramIndex} THEN 0 ELSE 1 END,
         provider_name
       LIMIT $${paramIndex + 1}`,
      [...params, `${q}%`, parseInt(limit)]
    );

    res.json({ results: result.rows });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
