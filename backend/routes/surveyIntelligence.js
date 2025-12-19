/**
 * Survey Intelligence API Routes
 *
 * Provides analytics endpoints for CMS survey data including:
 * - National summary and trends
 * - State-level analytics
 * - F-Tag analysis
 * - Data freshness metadata
 *
 * Uses health_citations, survey_dates, and citation_descriptions tables
 * from snf_platform database.
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

// State code to name mapping (CMS uses 2-digit numeric codes)
const STATE_CODES = {
  '01': 'Alabama', '02': 'Alaska', '03': 'Arizona', '04': 'Arkansas', '05': 'California',
  '06': 'Colorado', '07': 'Connecticut', '08': 'Delaware', '09': 'District of Columbia',
  '10': 'Florida', '11': 'Georgia', '12': 'Hawaii', '13': 'Idaho', '14': 'Illinois',
  '15': 'Indiana', '16': 'Iowa', '17': 'Kansas', '18': 'Kentucky', '19': 'Louisiana',
  '20': 'Maine', '21': 'Maryland', '22': 'Massachusetts', '23': 'Michigan', '24': 'Minnesota',
  '25': 'Mississippi', '26': 'Missouri', '27': 'Montana', '28': 'Nebraska', '29': 'Nevada',
  '30': 'New Hampshire', '31': 'New Jersey', '32': 'New Mexico', '33': 'New York',
  '34': 'North Carolina', '35': 'North Dakota', '36': 'Ohio', '37': 'Oklahoma', '38': 'Oregon',
  '39': 'Pennsylvania', '40': 'Puerto Rico', '41': 'Rhode Island', '42': 'South Carolina',
  '43': 'South Dakota', '44': 'Tennessee', '45': 'Texas', '46': 'Utah', '47': 'Vermont',
  '49': 'Virginia', '50': 'Washington', '51': 'West Virginia', '52': 'Wisconsin',
  '53': 'Wyoming', '55': 'Wisconsin', '65': 'Guam', '67': 'Texas', '68': 'Virgin Islands',
  '74': 'Puerto Rico'
};

// Helper to get state name from CCN prefix
const getStateName = (stateCode) => STATE_CODES[stateCode] || `State ${stateCode}`;

// Helper to check if scope/severity is Immediate Jeopardy (J, K, or L)
const IJ_CODES = ['J', 'K', 'L'];

/**
 * GET /api/v1/survey-intelligence/national/summary
 * Returns national summary statistics for current year
 */
router.get('/national/summary', async (req, res) => {
  const pool = getPool();

  try {
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    // Get YTD summary stats
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT ccn || '-' || survey_date::text) as total_surveys,
        COUNT(*) as total_citations,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations,
        COUNT(DISTINCT ccn) as facilities_surveyed
      FROM health_citations
      WHERE survey_date >= $1
        AND is_standard_deficiency = true
    `;

    const summaryResult = await pool.query(summaryQuery, [yearStart]);
    const stats = summaryResult.rows[0];

    const totalSurveys = parseInt(stats.total_surveys) || 0;
    const totalCitations = parseInt(stats.total_citations) || 0;
    const ijCitations = parseInt(stats.ij_citations) || 0;

    // Calculate IJ rate and avg deficiencies per survey
    const ijRate = totalCitations > 0 ? (ijCitations / totalCitations * 100) : 0;
    const avgDeficiencies = totalSurveys > 0 ? (totalCitations / totalSurveys) : 0;

    // Get top 10 F-tags
    const topFtagsQuery = `
      SELECT
        deficiency_tag as ftag,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facility_count
      FROM health_citations
      WHERE survey_date >= $1
        AND is_standard_deficiency = true
        AND deficiency_tag IS NOT NULL
      GROUP BY deficiency_tag
      ORDER BY citation_count DESC
      LIMIT 10
    `;

    const ftagsResult = await pool.query(topFtagsQuery, [yearStart]);

    res.json({
      success: true,
      data: {
        year: currentYear,
        total_surveys_ytd: totalSurveys,
        total_citations_ytd: totalCitations,
        facilities_surveyed_ytd: parseInt(stats.facilities_surveyed) || 0,
        ij_rate: Math.round(ijRate * 100) / 100,
        avg_deficiencies_per_survey: Math.round(avgDeficiencies * 100) / 100,
        top_ftags: ftagsResult.rows.map(row => ({
          ftag: `F${row.ftag}`,
          citation_count: parseInt(row.citation_count),
          facility_count: parseInt(row.facility_count)
        }))
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] national/summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/national/trends
 * Returns monthly time series data
 * Query params: ?months=12
 */
router.get('/national/trends', async (req, res) => {
  const pool = getPool();

  try {
    const months = parseInt(req.query.months) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    const trendsQuery = `
      SELECT
        DATE_TRUNC('month', survey_date) as month,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count,
        COUNT(*) as citation_count,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations
      FROM health_citations
      WHERE survey_date >= $1
        AND is_standard_deficiency = true
      GROUP BY DATE_TRUNC('month', survey_date)
      ORDER BY month
    `;

    const result = await pool.query(trendsQuery, [startDateStr]);

    const trends = result.rows.map(row => {
      const surveyCount = parseInt(row.survey_count) || 0;
      const citationCount = parseInt(row.citation_count) || 0;
      const ijCitations = parseInt(row.ij_citations) || 0;

      return {
        month: row.month.toISOString().split('T')[0].substring(0, 7), // YYYY-MM format
        survey_count: surveyCount,
        citation_count: citationCount,
        ij_rate: citationCount > 0 ? Math.round((ijCitations / citationCount) * 10000) / 100 : 0,
        avg_deficiencies: surveyCount > 0 ? Math.round((citationCount / surveyCount) * 100) / 100 : 0
      };
    });

    res.json({
      success: true,
      data: trends,
      meta: {
        months_requested: months,
        actual_months: trends.length,
        date_range: {
          start: startDateStr,
          end: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] national/trends error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/states
 * Returns aggregated statistics by state
 */
router.get('/states', async (req, res) => {
  const pool = getPool();

  try {
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    const statesQuery = `
      SELECT
        LEFT(ccn, 2) as state_code,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facility_count,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations
      FROM health_citations
      WHERE survey_date >= $1
        AND is_standard_deficiency = true
      GROUP BY LEFT(ccn, 2)
      ORDER BY citation_count DESC
    `;

    const result = await pool.query(statesQuery, [yearStart]);

    const states = result.rows.map(row => {
      const citationCount = parseInt(row.citation_count) || 0;
      const surveyCount = parseInt(row.survey_count) || 0;
      const ijCitations = parseInt(row.ij_citations) || 0;

      return {
        state_code: row.state_code,
        state_name: getStateName(row.state_code),
        survey_count: surveyCount,
        citation_count: citationCount,
        facility_count: parseInt(row.facility_count) || 0,
        ij_rate: citationCount > 0 ? Math.round((ijCitations / citationCount) * 10000) / 100 : 0,
        avg_deficiencies: surveyCount > 0 ? Math.round((citationCount / surveyCount) * 100) / 100 : 0
      };
    });

    res.json({
      success: true,
      data: states,
      meta: {
        year: currentYear,
        total_states: states.length
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] states error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/states/:stateCode
 * Returns detailed statistics for a specific state
 */
router.get('/states/:stateCode', async (req, res) => {
  const pool = getPool();

  try {
    const { stateCode } = req.params;
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    // Basic stats for state
    const statsQuery = `
      SELECT
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facility_count,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations
      FROM health_citations
      WHERE LEFT(ccn, 2) = $1
        AND survey_date >= $2
        AND is_standard_deficiency = true
    `;

    const statsResult = await pool.query(statsQuery, [stateCode, yearStart]);
    const stats = statsResult.rows[0];

    // Top F-tags for state
    const topFtagsQuery = `
      SELECT
        deficiency_tag as ftag,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facility_count
      FROM health_citations
      WHERE LEFT(ccn, 2) = $1
        AND survey_date >= $2
        AND is_standard_deficiency = true
        AND deficiency_tag IS NOT NULL
      GROUP BY deficiency_tag
      ORDER BY citation_count DESC
      LIMIT 10
    `;

    const ftagsResult = await pool.query(topFtagsQuery, [stateCode, yearStart]);

    // Day of week distribution
    const dowQuery = `
      SELECT
        EXTRACT(DOW FROM survey_date) as day_of_week,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count
      FROM health_citations
      WHERE LEFT(ccn, 2) = $1
        AND survey_date >= $2
        AND is_standard_deficiency = true
      GROUP BY EXTRACT(DOW FROM survey_date)
      ORDER BY day_of_week
    `;

    const dowResult = await pool.query(dowQuery, [stateCode, yearStart]);

    // Monthly distribution
    const monthlyQuery = `
      SELECT
        DATE_TRUNC('month', survey_date) as month,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count,
        COUNT(*) as citation_count
      FROM health_citations
      WHERE LEFT(ccn, 2) = $1
        AND survey_date >= $2
        AND is_standard_deficiency = true
      GROUP BY DATE_TRUNC('month', survey_date)
      ORDER BY month
    `;

    const monthlyResult = await pool.query(monthlyQuery, [stateCode, yearStart]);

    const citationCount = parseInt(stats.citation_count) || 0;
    const surveyCount = parseInt(stats.survey_count) || 0;
    const ijCitations = parseInt(stats.ij_citations) || 0;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      success: true,
      data: {
        state_code: stateCode,
        state_name: getStateName(stateCode),
        year: currentYear,
        survey_count: surveyCount,
        citation_count: citationCount,
        facility_count: parseInt(stats.facility_count) || 0,
        ij_rate: citationCount > 0 ? Math.round((ijCitations / citationCount) * 10000) / 100 : 0,
        avg_deficiencies: surveyCount > 0 ? Math.round((citationCount / surveyCount) * 100) / 100 : 0,
        top_ftags: ftagsResult.rows.map(row => ({
          ftag: `F${row.ftag}`,
          citation_count: parseInt(row.citation_count),
          facility_count: parseInt(row.facility_count)
        })),
        day_of_week_distribution: dowResult.rows.map(row => ({
          day: dayNames[parseInt(row.day_of_week)],
          day_number: parseInt(row.day_of_week),
          survey_count: parseInt(row.survey_count)
        })),
        monthly_distribution: monthlyResult.rows.map(row => ({
          month: row.month.toISOString().split('T')[0].substring(0, 7),
          survey_count: parseInt(row.survey_count),
          citation_count: parseInt(row.citation_count)
        }))
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] states/:stateCode error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/states/:stateCode/trends
 * Returns monthly trends for a specific state
 * Query params: ?months=12
 */
router.get('/states/:stateCode/trends', async (req, res) => {
  const pool = getPool();

  try {
    const { stateCode } = req.params;
    const months = parseInt(req.query.months) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    const trendsQuery = `
      SELECT
        DATE_TRUNC('month', survey_date) as month,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count,
        COUNT(*) as citation_count,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations
      FROM health_citations
      WHERE LEFT(ccn, 2) = $1
        AND survey_date >= $2
        AND is_standard_deficiency = true
      GROUP BY DATE_TRUNC('month', survey_date)
      ORDER BY month
    `;

    const result = await pool.query(trendsQuery, [stateCode, startDateStr]);

    const trends = result.rows.map(row => {
      const surveyCount = parseInt(row.survey_count) || 0;
      const citationCount = parseInt(row.citation_count) || 0;
      const ijCitations = parseInt(row.ij_citations) || 0;

      return {
        month: row.month.toISOString().split('T')[0].substring(0, 7),
        survey_count: surveyCount,
        citation_count: citationCount,
        ij_rate: citationCount > 0 ? Math.round((ijCitations / citationCount) * 10000) / 100 : 0,
        avg_deficiencies: surveyCount > 0 ? Math.round((citationCount / surveyCount) * 100) / 100 : 0
      };
    });

    res.json({
      success: true,
      data: trends,
      meta: {
        state_code: stateCode,
        state_name: getStateName(stateCode),
        months_requested: months,
        actual_months: trends.length
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] states/:stateCode/trends error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/ftags/top
 * Returns top F-tags with optional filters
 * Query params: ?limit=20&state=05&months=12
 */
router.get('/ftags/top', async (req, res) => {
  const pool = getPool();

  try {
    const limit = parseInt(req.query.limit) || 20;
    const state = req.query.state; // State code (e.g., '05' for California)
    const months = parseInt(req.query.months) || 12;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Build query with optional state filter
    let whereClause = `WHERE survey_date >= $1 AND is_standard_deficiency = true AND deficiency_tag IS NOT NULL`;
    const params = [startDateStr];

    if (state) {
      whereClause += ` AND LEFT(ccn, 2) = $2`;
      params.push(state);
    }

    // Get top F-tags with citation counts
    const topFtagsQuery = `
      SELECT
        deficiency_tag as ftag,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facility_count,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations
      FROM health_citations
      ${whereClause}
      GROUP BY deficiency_tag
      ORDER BY citation_count DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(topFtagsQuery, params);

    // Get descriptions from citation_descriptions table
    const ftags = result.rows.map(row => row.ftag);
    let descriptions = {};

    if (ftags.length > 0) {
      const descQuery = `
        SELECT deficiency_tag, description
        FROM citation_descriptions
        WHERE deficiency_tag = ANY($1)
      `;
      const descResult = await pool.query(descQuery, [ftags]);
      descResult.rows.forEach(row => {
        descriptions[row.deficiency_tag] = row.description;
      });
    }

    // Calculate trend direction (compare last 3 months vs prior 3 months)
    const trendsQuery = `
      SELECT
        deficiency_tag as ftag,
        CASE
          WHEN survey_date >= CURRENT_DATE - INTERVAL '3 months' THEN 'recent'
          ELSE 'prior'
        END as period,
        COUNT(*) as count
      FROM health_citations
      ${whereClause}
        AND survey_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY deficiency_tag, CASE WHEN survey_date >= CURRENT_DATE - INTERVAL '3 months' THEN 'recent' ELSE 'prior' END
    `;

    // Remove limit param for trends query
    const trendParams = state ? [startDateStr, state] : [startDateStr];
    const trendsResult = await pool.query(trendsQuery, trendParams);

    // Build trends map
    const trendsMap = {};
    trendsResult.rows.forEach(row => {
      if (!trendsMap[row.ftag]) {
        trendsMap[row.ftag] = { recent: 0, prior: 0 };
      }
      trendsMap[row.ftag][row.period] = parseInt(row.count);
    });

    const ftagsData = result.rows.map(row => {
      const citationCount = parseInt(row.citation_count) || 0;
      const ijCitations = parseInt(row.ij_citations) || 0;
      const trend = trendsMap[row.ftag] || { recent: 0, prior: 0 };
      const trendDirection = trend.recent > trend.prior ? 'up' : trend.recent < trend.prior ? 'down' : 'stable';

      return {
        ftag: `F${row.ftag}`,
        ftag_code: row.ftag,
        description: descriptions[row.ftag] || 'Description not available',
        citation_count: citationCount,
        facility_count: parseInt(row.facility_count) || 0,
        ij_percentage: citationCount > 0 ? Math.round((ijCitations / citationCount) * 10000) / 100 : 0,
        trend_direction: trendDirection
      };
    });

    res.json({
      success: true,
      data: ftagsData,
      meta: {
        limit,
        state: state ? { code: state, name: getStateName(state) } : null,
        months,
        date_range: {
          start: startDateStr,
          end: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] ftags/top error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/ftags/:ftagCode
 * Returns detailed analytics for a specific F-tag
 */
router.get('/ftags/:ftagCode', async (req, res) => {
  const pool = getPool();

  try {
    let { ftagCode } = req.params;

    // Remove 'F' prefix if provided
    if (ftagCode.toUpperCase().startsWith('F')) {
      ftagCode = ftagCode.substring(1);
    }

    // Get description
    const descQuery = `
      SELECT description FROM citation_descriptions WHERE deficiency_tag = $1
    `;
    const descResult = await pool.query(descQuery, [ftagCode]);
    const description = descResult.rows[0]?.description || 'Description not available';

    // Get total citations
    const totalQuery = `
      SELECT
        COUNT(*) as total_citations,
        COUNT(DISTINCT ccn) as total_facilities,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations
      FROM health_citations
      WHERE deficiency_tag = $1
        AND is_standard_deficiency = true
    `;
    const totalResult = await pool.query(totalQuery, [ftagCode]);
    const totals = totalResult.rows[0];

    // By state
    const byStateQuery = `
      SELECT
        LEFT(ccn, 2) as state_code,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facility_count
      FROM health_citations
      WHERE deficiency_tag = $1
        AND is_standard_deficiency = true
      GROUP BY LEFT(ccn, 2)
      ORDER BY citation_count DESC
      LIMIT 15
    `;
    const byStateResult = await pool.query(byStateQuery, [ftagCode]);

    // By severity
    const bySeverityQuery = `
      SELECT
        scope_severity_code as severity,
        COUNT(*) as count
      FROM health_citations
      WHERE deficiency_tag = $1
        AND is_standard_deficiency = true
        AND scope_severity_code IS NOT NULL
      GROUP BY scope_severity_code
      ORDER BY count DESC
    `;
    const bySeverityResult = await pool.query(bySeverityQuery, [ftagCode]);

    // 12-month trend
    const trendQuery = `
      SELECT
        DATE_TRUNC('month', survey_date) as month,
        COUNT(*) as citation_count
      FROM health_citations
      WHERE deficiency_tag = $1
        AND is_standard_deficiency = true
        AND survey_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', survey_date)
      ORDER BY month
    `;
    const trendResult = await pool.query(trendQuery, [ftagCode]);

    const totalCitations = parseInt(totals.total_citations) || 0;
    const ijCitations = parseInt(totals.ij_citations) || 0;

    res.json({
      success: true,
      data: {
        ftag: `F${ftagCode}`,
        ftag_code: ftagCode,
        description,
        total_citations: totalCitations,
        total_facilities: parseInt(totals.total_facilities) || 0,
        ij_rate: totalCitations > 0 ? Math.round((ijCitations / totalCitations) * 10000) / 100 : 0,
        by_state: byStateResult.rows.map(row => ({
          state_code: row.state_code,
          state_name: getStateName(row.state_code),
          citation_count: parseInt(row.citation_count),
          facility_count: parseInt(row.facility_count)
        })),
        by_severity: bySeverityResult.rows.map(row => ({
          severity: row.severity,
          count: parseInt(row.count),
          is_ij: IJ_CODES.includes(row.severity)
        })),
        trend_12_months: trendResult.rows.map(row => ({
          month: row.month.toISOString().split('T')[0].substring(0, 7),
          citation_count: parseInt(row.citation_count)
        }))
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] ftags/:ftagCode error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// TIMING PATTERN ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/survey-intelligence/patterns/day-of-week
 * Returns survey distribution by day of week
 * Query params: ?state=05 (optional state filter)
 */
router.get('/patterns/day-of-week', async (req, res) => {
  const pool = getPool();

  try {
    const state = req.query.state;
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    let whereClause = `WHERE survey_type = 'Health Standard' AND survey_date >= $1`;
    const params = [yearStart];

    if (state) {
      whereClause += ` AND LEFT(ccn, 2) = $2`;
      params.push(state);
    }

    // Get survey counts by day of week from survey_dates table
    const dowQuery = `
      SELECT
        EXTRACT(DOW FROM survey_date) as day_of_week,
        COUNT(*) as survey_count
      FROM survey_dates
      ${whereClause}
      GROUP BY EXTRACT(DOW FROM survey_date)
      ORDER BY day_of_week
    `;

    const dowResult = await pool.query(dowQuery, params);

    // Get deficiency stats by day of week from health_citations
    let citationWhereClause = `WHERE is_standard_deficiency = true AND survey_date >= $1`;
    if (state) {
      citationWhereClause += ` AND LEFT(ccn, 2) = $2`;
    }

    const citationQuery = `
      SELECT
        EXTRACT(DOW FROM survey_date) as day_of_week,
        COUNT(*) as citation_count,
        COUNT(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_citations,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count
      FROM health_citations
      ${citationWhereClause}
      GROUP BY EXTRACT(DOW FROM survey_date)
    `;

    const citationResult = await pool.query(citationQuery, params);

    // Build citation stats map
    const citationMap = {};
    citationResult.rows.forEach(row => {
      citationMap[row.day_of_week] = {
        citation_count: parseInt(row.citation_count) || 0,
        ij_citations: parseInt(row.ij_citations) || 0,
        survey_count: parseInt(row.survey_count) || 0
      };
    });

    // Calculate total surveys for percentage
    const totalSurveys = dowResult.rows.reduce((sum, row) => sum + parseInt(row.survey_count), 0);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const data = dowResult.rows.map(row => {
      const dow = parseInt(row.day_of_week);
      const surveyCount = parseInt(row.survey_count) || 0;
      const citationStats = citationMap[dow] || { citation_count: 0, ij_citations: 0, survey_count: 0 };
      const avgDeficiencies = citationStats.survey_count > 0
        ? citationStats.citation_count / citationStats.survey_count
        : 0;
      const ijRate = citationStats.citation_count > 0
        ? (citationStats.ij_citations / citationStats.citation_count) * 100
        : 0;

      return {
        day_of_week: dow,
        day_name: dayNames[dow],
        survey_count: surveyCount,
        percentage: totalSurveys > 0 ? Math.round((surveyCount / totalSurveys) * 10000) / 100 : 0,
        avg_deficiencies: Math.round(avgDeficiencies * 100) / 100,
        ij_rate: Math.round(ijRate * 100) / 100
      };
    });

    res.json({
      success: true,
      data,
      meta: {
        year: currentYear,
        total_surveys: totalSurveys,
        state: state ? { code: state, name: getStateName(state) } : null
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] patterns/day-of-week error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/patterns/week-of-month
 * Returns survey distribution by week of month
 * Week 1 = days 1-7, Week 2 = days 8-14, Week 3 = days 15-21, Week 4 = days 22-31
 * Query params: ?state=05 (optional)
 */
router.get('/patterns/week-of-month', async (req, res) => {
  const pool = getPool();

  try {
    const state = req.query.state;
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    let whereClause = `WHERE survey_type = 'Health Standard' AND survey_date >= $1`;
    const params = [yearStart];

    if (state) {
      whereClause += ` AND LEFT(ccn, 2) = $2`;
      params.push(state);
    }

    const weekQuery = `
      SELECT
        CASE
          WHEN EXTRACT(DAY FROM survey_date) BETWEEN 1 AND 7 THEN 1
          WHEN EXTRACT(DAY FROM survey_date) BETWEEN 8 AND 14 THEN 2
          WHEN EXTRACT(DAY FROM survey_date) BETWEEN 15 AND 21 THEN 3
          ELSE 4
        END as week_of_month,
        COUNT(*) as survey_count
      FROM survey_dates
      ${whereClause}
      GROUP BY
        CASE
          WHEN EXTRACT(DAY FROM survey_date) BETWEEN 1 AND 7 THEN 1
          WHEN EXTRACT(DAY FROM survey_date) BETWEEN 8 AND 14 THEN 2
          WHEN EXTRACT(DAY FROM survey_date) BETWEEN 15 AND 21 THEN 3
          ELSE 4
        END
      ORDER BY week_of_month
    `;

    const result = await pool.query(weekQuery, params);

    const totalSurveys = result.rows.reduce((sum, row) => sum + parseInt(row.survey_count), 0);

    const weekLabels = {
      1: 'Week 1 (Days 1-7)',
      2: 'Week 2 (Days 8-14)',
      3: 'Week 3 (Days 15-21)',
      4: 'Week 4 (Days 22-31)'
    };

    const data = result.rows.map(row => {
      const week = parseInt(row.week_of_month);
      const surveyCount = parseInt(row.survey_count) || 0;

      return {
        week,
        week_label: weekLabels[week],
        survey_count: surveyCount,
        percentage: totalSurveys > 0 ? Math.round((surveyCount / totalSurveys) * 10000) / 100 : 0
      };
    });

    res.json({
      success: true,
      data,
      meta: {
        year: currentYear,
        total_surveys: totalSurveys,
        state: state ? { code: state, name: getStateName(state) } : null
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] patterns/week-of-month error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/patterns/seasonal
 * Returns survey distribution by month with peak/blackout flags
 * Query params: ?state=05 (optional)
 */
router.get('/patterns/seasonal', async (req, res) => {
  const pool = getPool();

  try {
    const state = req.query.state;

    // Use last 2 years for seasonal patterns
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    const startDateStr = startDate.toISOString().split('T')[0];

    let whereClause = `WHERE survey_type = 'Health Standard' AND survey_date >= $1`;
    const params = [startDateStr];

    if (state) {
      whereClause += ` AND LEFT(ccn, 2) = $2`;
      params.push(state);
    }

    const seasonalQuery = `
      SELECT
        EXTRACT(MONTH FROM survey_date) as month,
        COUNT(*) as survey_count
      FROM survey_dates
      ${whereClause}
      GROUP BY EXTRACT(MONTH FROM survey_date)
      ORDER BY month
    `;

    const result = await pool.query(seasonalQuery, params);

    const totalSurveys = result.rows.reduce((sum, row) => sum + parseInt(row.survey_count), 0);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Peak months: August, September, October (fiscal year end push)
    const peakMonths = [8, 9, 10];
    // Blackout-adjacent: December (holiday slowdown)
    const blackoutMonths = [12];

    const data = result.rows.map(row => {
      const month = parseInt(row.month);
      const surveyCount = parseInt(row.survey_count) || 0;

      return {
        month,
        month_name: monthNames[month - 1],
        survey_count: surveyCount,
        percentage: totalSurveys > 0 ? Math.round((surveyCount / totalSurveys) * 10000) / 100 : 0,
        is_peak: peakMonths.includes(month),
        is_blackout: blackoutMonths.includes(month)
      };
    });

    res.json({
      success: true,
      data,
      meta: {
        years_analyzed: 2,
        total_surveys: totalSurveys,
        state: state ? { code: state, name: getStateName(state) } : null,
        notes: {
          peak_months: 'August-October (federal fiscal year end)',
          blackout_period: 'December 22 - January 2 (holiday slowdown)'
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] patterns/seasonal error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// REGIONAL ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/survey-intelligence/regions/hotspots
 * Returns counties with most recent survey activity
 * Query params: ?days=30&limit=20
 */
router.get('/regions/hotspots', async (req, res) => {
  const pool = getPool();

  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 20;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Join with snf_facilities to get county info
    const hotspotsQuery = `
      SELECT
        LEFT(hc.ccn, 2) as state_code,
        sf.county,
        COUNT(DISTINCT hc.ccn || '-' || hc.survey_date::text) as survey_count,
        COUNT(*) as citation_count,
        COUNT(DISTINCT hc.ccn) as facilities_surveyed,
        MAX(hc.survey_date) as most_recent_survey
      FROM health_citations hc
      LEFT JOIN snf_facilities sf ON hc.ccn = sf.federal_provider_number
      WHERE hc.survey_date >= $1
        AND hc.is_standard_deficiency = true
        AND sf.county IS NOT NULL
      GROUP BY LEFT(hc.ccn, 2), sf.county
      ORDER BY survey_count DESC
      LIMIT $2
    `;

    const result = await pool.query(hotspotsQuery, [startDateStr, limit]);

    const data = result.rows.map(row => {
      const surveyCount = parseInt(row.survey_count) || 0;
      const citationCount = parseInt(row.citation_count) || 0;

      return {
        state_code: row.state_code,
        state_name: getStateName(row.state_code),
        county: row.county,
        survey_count: surveyCount,
        citation_count: citationCount,
        facilities_surveyed: parseInt(row.facilities_surveyed) || 0,
        avg_deficiencies: surveyCount > 0 ? Math.round((citationCount / surveyCount) * 100) / 100 : 0,
        most_recent_survey: row.most_recent_survey
      };
    });

    res.json({
      success: true,
      data,
      meta: {
        days,
        limit,
        date_range: {
          start: startDateStr,
          end: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] regions/hotspots error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/counties/:stateCode/:countyName/activity
 * Returns recent survey activity for a specific county
 * Query params: ?days=90
 */
router.get('/counties/:stateCode/:countyName/activity', async (req, res) => {
  const pool = getPool();

  try {
    const { stateCode, countyName } = req.params;
    const days = parseInt(req.query.days) || 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Decode URL-encoded county name
    const decodedCounty = decodeURIComponent(countyName);

    // Get surveys in this county
    const surveysQuery = `
      SELECT
        hc.ccn as federal_provider_number,
        sf.facility_name,
        hc.survey_date,
        COUNT(*) as deficiency_count,
        MODE() WITHIN GROUP (ORDER BY hc.deficiency_tag) as top_ftag
      FROM health_citations hc
      LEFT JOIN snf_facilities sf ON hc.ccn = sf.federal_provider_number
      WHERE LEFT(hc.ccn, 2) = $1
        AND LOWER(sf.county) = LOWER($2)
        AND hc.survey_date >= $3
        AND hc.is_standard_deficiency = true
      GROUP BY hc.ccn, sf.facility_name, hc.survey_date
      ORDER BY hc.survey_date DESC
      LIMIT 50
    `;

    const surveysResult = await pool.query(surveysQuery, [stateCode, decodedCounty, startDateStr]);

    // Get summary stats
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT hc.ccn || '-' || hc.survey_date::text) as total_surveys,
        COUNT(*) as total_citations,
        COUNT(DISTINCT hc.ccn) as facilities_surveyed
      FROM health_citations hc
      LEFT JOIN snf_facilities sf ON hc.ccn = sf.federal_provider_number
      WHERE LEFT(hc.ccn, 2) = $1
        AND LOWER(sf.county) = LOWER($2)
        AND hc.survey_date >= $3
        AND hc.is_standard_deficiency = true
    `;

    const summaryResult = await pool.query(summaryQuery, [stateCode, decodedCounty, startDateStr]);
    const summary = summaryResult.rows[0];

    res.json({
      success: true,
      data: {
        county: decodedCounty,
        state_code: stateCode,
        state_name: getStateName(stateCode),
        surveys: surveysResult.rows.map(row => ({
          federal_provider_number: row.federal_provider_number,
          facility_name: row.facility_name,
          survey_date: row.survey_date,
          deficiency_count: parseInt(row.deficiency_count) || 0,
          top_ftag: row.top_ftag ? `F${row.top_ftag}` : null
        })),
        summary: {
          total_surveys: parseInt(summary.total_surveys) || 0,
          total_citations: parseInt(summary.total_citations) || 0,
          facilities_surveyed: parseInt(summary.facilities_surveyed) || 0
        }
      },
      meta: {
        days,
        date_range: {
          start: startDateStr,
          end: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] counties/:stateCode/:countyName/activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/nearby
 * Returns recent surveys near a geographic location
 * Query params: ?lat=34.0522&lng=-118.2437&radius=25&days=30
 * Uses Haversine formula for distance calculation
 */
router.get('/nearby', async (req, res) => {
  const pool = getPool();

  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 25; // miles
    const days = parseInt(req.query.days) || 30;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'lat and lng query parameters are required'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Haversine formula in SQL (distance in miles)
    // 3959 is Earth's radius in miles
    const nearbyQuery = `
      SELECT
        hc.ccn as federal_provider_number,
        sf.facility_name,
        sf.city,
        sf.state,
        sf.latitude,
        sf.longitude,
        hc.survey_date,
        COUNT(*) as deficiency_count,
        (
          3959 * acos(
            cos(radians($1)) * cos(radians(sf.latitude)) *
            cos(radians(sf.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(sf.latitude))
          )
        ) as distance_miles
      FROM health_citations hc
      INNER JOIN snf_facilities sf ON hc.ccn = sf.federal_provider_number
      WHERE hc.survey_date >= $3
        AND hc.is_standard_deficiency = true
        AND sf.latitude IS NOT NULL
        AND sf.longitude IS NOT NULL
        AND sf.latitude BETWEEN $1 - ($4 / 69.0) AND $1 + ($4 / 69.0)
        AND sf.longitude BETWEEN $2 - ($4 / (69.0 * cos(radians($1)))) AND $2 + ($4 / (69.0 * cos(radians($1))))
      GROUP BY hc.ccn, sf.facility_name, sf.city, sf.state, sf.latitude, sf.longitude, hc.survey_date
      HAVING (
        3959 * acos(
          cos(radians($1)) * cos(radians(sf.latitude)) *
          cos(radians(sf.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(sf.latitude))
        )
      ) <= $4
      ORDER BY hc.survey_date DESC, distance_miles ASC
      LIMIT 50
    `;

    const result = await pool.query(nearbyQuery, [lat, lng, startDateStr, radius]);

    const data = result.rows.map(row => ({
      federal_provider_number: row.federal_provider_number,
      facility_name: row.facility_name,
      city: row.city,
      state: row.state,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      distance_miles: Math.round(parseFloat(row.distance_miles) * 100) / 100,
      survey_date: row.survey_date,
      deficiency_count: parseInt(row.deficiency_count) || 0
    }));

    res.json({
      success: true,
      data,
      meta: {
        center: { lat, lng },
        radius_miles: radius,
        days,
        results_count: data.length,
        date_range: {
          start: startDateStr,
          end: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] nearby error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// FACILITY-SPECIFIC FORECAST ENDPOINTS
// ============================================================================

// Day-of-week probability factors
const DOW_FACTORS = {
  0: 0.1,   // Sunday
  1: 1.0,   // Monday
  2: 1.1,   // Tuesday
  3: 1.4,   // Wednesday (peak)
  4: 1.1,   // Thursday
  5: 0.3,   // Friday
  6: 0.1    // Saturday
};

// Week-of-month probability factors
const WEEK_FACTORS = {
  1: 0.9,   // Week 1 (days 1-7)
  2: 1.0,   // Week 2 (days 8-14)
  3: 0.9,   // Week 3 (days 15-21)
  4: 1.3    // Week 4 (days 22-31) - end of month push
};

// Seasonal factors by month
const SEASONAL_FACTORS = {
  1: 0.8,   // January
  2: 1.0,   // February
  3: 1.0,   // March
  4: 1.0,   // April
  5: 1.0,   // May
  6: 1.0,   // June
  7: 1.0,   // July
  8: 1.1,   // August (fiscal year end push)
  9: 1.1,   // September
  10: 1.1,  // October
  11: 0.9,  // November
  12: 0.7   // December (holiday slowdown)
};

// Helper to calculate week of month (1-4)
const getWeekOfMonth = (date) => {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

// Helper to check if date is in blackout period (Dec 22 - Jan 2)
const isBlackoutPeriod = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return (month === 12 && day >= 22) || (month === 1 && day <= 2);
};

// Helper to determine risk level
const getRiskLevel = (daysSinceSurvey, stateAvgInterval, bellwetherActive) => {
  const federalMax = 456; // 15 months
  const percentOfMax = daysSinceSurvey / federalMax;

  if (bellwetherActive && daysSinceSurvey > stateAvgInterval * 0.7) return 'HIGH';
  if (daysSinceSurvey > federalMax * 0.9) return 'HIGH';
  if (daysSinceSurvey > stateAvgInterval * 1.1 || percentOfMax > 0.8) return 'ELEVATED';
  if (daysSinceSurvey > stateAvgInterval * 0.8 || percentOfMax > 0.6) return 'MODERATE';
  return 'LOW';
};

/**
 * GET /api/v1/survey-intelligence/facilities/:federalProviderNumber/forecast
 * Returns survey probability forecast for a facility
 */
router.get('/facilities/:federalProviderNumber/forecast', async (req, res) => {
  const pool = getPool();

  try {
    const { federalProviderNumber } = req.params;
    const ccn = federalProviderNumber;

    // Get facility info
    const facilityQuery = `
      SELECT
        facility_name, city, state, certified_beds,
        latitude, longitude
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;
    const facilityResult = await pool.query(facilityQuery, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facilityResult.rows[0];

    // Get last Health Standard survey for this facility
    const lastSurveyQuery = `
      SELECT
        survey_date,
        COUNT(*) as deficiency_count
      FROM health_citations
      WHERE ccn = $1 AND is_standard_deficiency = true
      GROUP BY survey_date
      ORDER BY survey_date DESC
      LIMIT 1
    `;
    const lastSurveyResult = await pool.query(lastSurveyQuery, [ccn]);

    const lastSurvey = lastSurveyResult.rows[0];
    const lastSurveyDate = lastSurvey ? new Date(lastSurvey.survey_date) : null;
    const today = new Date();
    const daysSinceSurvey = lastSurveyDate
      ? Math.floor((today - lastSurveyDate) / (1000 * 60 * 60 * 24))
      : 365; // Assume 1 year if no survey found

    // Get state code from CCN
    const stateCode = ccn.substring(0, 2);

    // Calculate state average survey interval
    const stateIntervalQuery = `
      SELECT AVG(interval_days) as avg_interval
      FROM (
        SELECT
          ccn,
          survey_date,
          survey_date - LAG(survey_date) OVER (PARTITION BY ccn ORDER BY survey_date) as interval_days
        FROM survey_dates
        WHERE survey_type = 'Health Standard'
          AND LEFT(ccn, 2) = $1
          AND survey_date >= CURRENT_DATE - INTERVAL '3 years'
      ) intervals
      WHERE interval_days IS NOT NULL AND interval_days > 30
    `;
    const stateIntervalResult = await pool.query(stateIntervalQuery, [stateCode]);
    const stateAvgInterval = Math.round(parseFloat(stateIntervalResult.rows[0]?.avg_interval) || 365);

    // Check for bellwether activity (similar facilities surveyed recently)
    const bellwetherQuery = `
      SELECT COUNT(DISTINCT ccn || '-' || survey_date::text) as recent_surveys
      FROM health_citations hc
      INNER JOIN snf_facilities sf ON hc.ccn = sf.federal_provider_number
      WHERE hc.is_standard_deficiency = true
        AND LEFT(hc.ccn, 2) = $1
        AND hc.survey_date >= CURRENT_DATE - INTERVAL '14 days'
        AND hc.ccn != $2
        AND sf.latitude IS NOT NULL
        AND (
          3959 * acos(
            cos(radians($3)) * cos(radians(sf.latitude)) *
            cos(radians(sf.longitude) - radians($4)) +
            sin(radians($3)) * sin(radians(sf.latitude))
          )
        ) <= 25
    `;
    const bellwetherResult = await pool.query(bellwetherQuery, [
      stateCode, ccn,
      facility.latitude || 0, facility.longitude || 0
    ]);
    const bellwetherActive = parseInt(bellwetherResult.rows[0]?.recent_surveys || 0) > 0;
    const bellwetherCount = parseInt(bellwetherResult.rows[0]?.recent_surveys || 0);

    // Federal maximum (15 months = 456 days)
    const federalMax = 456;
    const daysUntilMax = Math.max(0, federalMax - daysSinceSurvey);

    // Calculate probabilities for different windows
    const calculateProbability = (windowDays) => {
      if (daysSinceSurvey + windowDays > federalMax) {
        return 0.99; // Nearly certain if past federal max
      }

      // Base probability
      let baseProbability = windowDays / Math.max(1, stateAvgInterval - daysSinceSurvey);
      baseProbability = Math.min(baseProbability, 1);

      // Apply bellwether factor
      if (bellwetherActive) {
        baseProbability *= 3.5;
      }

      // Cap at 0.99
      return Math.min(0.99, Math.round(baseProbability * 100) / 100);
    };

    // Generate high-risk days for next 30 days
    const highRiskDays = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 1; i <= 30; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);

      const dow = futureDate.getDay();
      const weekOfMonth = getWeekOfMonth(futureDate);
      const month = futureDate.getMonth() + 1;

      // Skip blackout period
      if (isBlackoutPeriod(futureDate)) continue;

      // Calculate daily probability
      let dailyProb = 0.03; // Base 3% per day
      dailyProb *= DOW_FACTORS[dow];
      dailyProb *= WEEK_FACTORS[weekOfMonth];
      dailyProb *= SEASONAL_FACTORS[month];
      if (bellwetherActive) dailyProb *= 3.5;

      // Increase probability as we get closer to state average
      const daysAtDate = daysSinceSurvey + i;
      if (daysAtDate > stateAvgInterval) {
        dailyProb *= 1 + ((daysAtDate - stateAvgInterval) / stateAvgInterval);
      }

      dailyProb = Math.min(0.95, dailyProb);

      // Only include days with >10% probability
      if (dailyProb > 0.1) {
        const factors = [];
        if (dow === 3) factors.push('Wednesday peak');
        if (dow === 2 || dow === 4) factors.push(`${dayNames[dow]} elevated`);
        if (weekOfMonth === 4) factors.push('Week 4 push');
        if ([8, 9, 10].includes(month)) factors.push('Peak season');
        if (bellwetherActive) factors.push('Bellwether signal');
        if (daysAtDate > stateAvgInterval) factors.push('Past state average');

        highRiskDays.push({
          date: futureDate.toISOString().split('T')[0],
          day_of_week: dayNames[dow],
          probability: Math.round(dailyProb * 100) / 100,
          factors
        });
      }
    }

    // Sort by probability and take top 10
    highRiskDays.sort((a, b) => b.probability - a.probability);
    const topHighRiskDays = highRiskDays.slice(0, 10);

    // Determine risk level and reason
    const riskLevel = getRiskLevel(daysSinceSurvey, stateAvgInterval, bellwetherActive);
    let riskReason = '';
    if (riskLevel === 'HIGH') {
      if (bellwetherActive) {
        riskReason = `${bellwetherCount} nearby facilit${bellwetherCount > 1 ? 'ies' : 'y'} surveyed in last 14 days`;
      } else {
        riskReason = `${daysSinceSurvey} days since last survey (approaching federal maximum)`;
      }
    } else if (riskLevel === 'ELEVATED') {
      riskReason = `${daysSinceSurvey} days since last survey (above state average of ${stateAvgInterval})`;
    } else if (riskLevel === 'MODERATE') {
      riskReason = `${daysSinceSurvey} days since last survey (approaching state average)`;
    } else {
      riskReason = `${daysSinceSurvey} days since last survey (within normal range)`;
    }

    res.json({
      success: true,
      data: {
        facility: {
          federal_provider_number: ccn,
          name: facility.facility_name,
          city: facility.city,
          state: facility.state,
          beds: facility.certified_beds
        },
        last_survey: lastSurvey ? {
          date: lastSurvey.survey_date,
          days_ago: daysSinceSurvey,
          deficiency_count: parseInt(lastSurvey.deficiency_count) || 0
        } : null,
        timing: {
          days_since_last_survey: daysSinceSurvey,
          state_average_interval: stateAvgInterval,
          federal_maximum: federalMax,
          days_until_maximum: daysUntilMax
        },
        probability: {
          next_7_days: calculateProbability(7),
          next_14_days: calculateProbability(14),
          next_30_days: calculateProbability(30),
          next_90_days: calculateProbability(90)
        },
        high_risk_days: topHighRiskDays,
        risk_level: riskLevel,
        risk_reason: riskReason,
        bellwether: {
          active: bellwetherActive,
          nearby_surveys_14_days: bellwetherCount
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] facilities/:federalProviderNumber/forecast error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/facilities/:federalProviderNumber/history
 * Returns survey history with patterns for a facility
 * Query params: ?cycles=3
 */
router.get('/facilities/:federalProviderNumber/history', async (req, res) => {
  const pool = getPool();

  try {
    const { federalProviderNumber } = req.params;
    const cycles = parseInt(req.query.cycles) || 3;
    const ccn = federalProviderNumber;

    // Get facility info
    const facilityQuery = `
      SELECT facility_name, city, state
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;
    const facilityResult = await pool.query(facilityQuery, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facilityResult.rows[0];

    // Get survey history with deficiency details
    const historyQuery = `
      WITH survey_summary AS (
        SELECT
          hc.survey_date,
          COUNT(*) as deficiency_count,
          COUNT(CASE WHEN hc.scope_severity_code IN ('J', 'K', 'L') THEN 1 END) as ij_count,
          ARRAY_AGG(DISTINCT hc.deficiency_tag) as ftags
        FROM health_citations hc
        WHERE hc.ccn = $1 AND hc.is_standard_deficiency = true
        GROUP BY hc.survey_date
        ORDER BY hc.survey_date DESC
        LIMIT $2
      ),
      survey_with_lag AS (
        SELECT
          survey_date,
          deficiency_count,
          ij_count,
          ftags,
          survey_date - LAG(survey_date) OVER (ORDER BY survey_date DESC) as days_since_previous
        FROM survey_summary
      )
      SELECT * FROM survey_with_lag ORDER BY survey_date DESC
    `;

    const historyResult = await pool.query(historyQuery, [ccn, cycles]);

    // Get top F-tags with descriptions for each survey
    const surveys = [];
    for (const row of historyResult.rows) {
      // Get top 5 F-tags for this survey
      const ftagsQuery = `
        SELECT
          hc.deficiency_tag,
          cd.description,
          hc.scope_severity_code as severity,
          COUNT(*) as count
        FROM health_citations hc
        LEFT JOIN citation_descriptions cd ON hc.deficiency_tag = cd.deficiency_tag
        WHERE hc.ccn = $1
          AND hc.survey_date = $2
          AND hc.is_standard_deficiency = true
        GROUP BY hc.deficiency_tag, cd.description, hc.scope_severity_code
        ORDER BY count DESC
        LIMIT 5
      `;
      const ftagsResult = await pool.query(ftagsQuery, [ccn, row.survey_date]);

      // Get survey type from survey_dates
      const typeQuery = `
        SELECT survey_type FROM survey_dates
        WHERE ccn = $1 AND survey_date = $2
        LIMIT 1
      `;
      const typeResult = await pool.query(typeQuery, [ccn, row.survey_date]);

      surveys.push({
        survey_date: row.survey_date,
        survey_type: typeResult.rows[0]?.survey_type || 'Health Standard',
        deficiency_count: parseInt(row.deficiency_count) || 0,
        ij_count: parseInt(row.ij_count) || 0,
        top_ftags: ftagsResult.rows.map(f => ({
          ftag: `F${f.deficiency_tag}`,
          description: f.description || 'Description not available',
          severity: f.severity
        })),
        days_since_previous: row.days_since_previous ? Math.abs(parseInt(row.days_since_previous)) : null
      });
    }

    // Calculate patterns
    const validIntervals = surveys
      .filter(s => s.days_since_previous !== null && s.days_since_previous > 30)
      .map(s => s.days_since_previous);

    const avgInterval = validIntervals.length > 0
      ? Math.round(validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length)
      : null;

    const avgDeficiencies = surveys.length > 0
      ? Math.round(surveys.reduce((a, b) => a + b.deficiency_count, 0) / surveys.length)
      : 0;

    // Calculate most common day of week
    const dowCounts = {};
    surveys.forEach(s => {
      const dow = new Date(s.survey_date).getDay();
      dowCounts[dow] = (dowCounts[dow] || 0) + 1;
    });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mostCommonDow = Object.keys(dowCounts).length > 0
      ? dayNames[parseInt(Object.keys(dowCounts).reduce((a, b) => dowCounts[a] > dowCounts[b] ? a : b))]
      : null;

    // Calculate typical month
    const monthCounts = {};
    surveys.forEach(s => {
      const month = new Date(s.survey_date).getMonth() + 1;
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const typicalMonth = Object.keys(monthCounts).length > 0
      ? monthNames[parseInt(Object.keys(monthCounts).reduce((a, b) => monthCounts[a] > monthCounts[b] ? a : b))]
      : null;

    res.json({
      success: true,
      data: {
        facility: {
          federal_provider_number: ccn,
          name: facility.facility_name,
          city: facility.city,
          state: facility.state
        },
        surveys,
        patterns: {
          avg_interval_days: avgInterval,
          avg_deficiencies: avgDeficiencies,
          most_common_day_of_week: mostCommonDow,
          typical_month: typicalMonth,
          total_surveys_in_history: surveys.length
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] facilities/:federalProviderNumber/history error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/facilities/:federalProviderNumber/regional-activity
 * Returns nearby survey activity for a facility
 * Query params: ?days=30&radius=10
 */
router.get('/facilities/:federalProviderNumber/regional-activity', async (req, res) => {
  const pool = getPool();

  try {
    const { federalProviderNumber } = req.params;
    const days = parseInt(req.query.days) || 30;
    const radius = parseFloat(req.query.radius) || 10;
    const ccn = federalProviderNumber;

    // Get facility info including lat/lng
    const facilityQuery = `
      SELECT
        facility_name, city, state,
        latitude, longitude
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;
    const facilityResult = await pool.query(facilityQuery, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facilityResult.rows[0];

    if (!facility.latitude || !facility.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Facility does not have geographic coordinates'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get nearby surveys using Haversine formula
    const nearbyQuery = `
      SELECT
        hc.ccn as federal_provider_number,
        sf.facility_name,
        sf.city,
        hc.survey_date,
        COUNT(*) as deficiency_count,
        MODE() WITHIN GROUP (ORDER BY hc.deficiency_tag) as top_ftag,
        (
          3959 * acos(
            cos(radians($1)) * cos(radians(sf.latitude)) *
            cos(radians(sf.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(sf.latitude))
          )
        ) as distance_miles
      FROM health_citations hc
      INNER JOIN snf_facilities sf ON hc.ccn = sf.federal_provider_number
      WHERE hc.survey_date >= $3
        AND hc.is_standard_deficiency = true
        AND hc.ccn != $4
        AND sf.latitude IS NOT NULL
        AND sf.longitude IS NOT NULL
        AND sf.latitude BETWEEN $1 - ($5 / 69.0) AND $1 + ($5 / 69.0)
        AND sf.longitude BETWEEN $2 - ($5 / (69.0 * cos(radians($1)))) AND $2 + ($5 / (69.0 * cos(radians($1))))
      GROUP BY hc.ccn, sf.facility_name, sf.city, hc.survey_date, sf.latitude, sf.longitude
      HAVING (
        3959 * acos(
          cos(radians($1)) * cos(radians(sf.latitude)) *
          cos(radians(sf.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(sf.latitude))
        )
      ) <= $5
      ORDER BY hc.survey_date DESC, distance_miles ASC
      LIMIT 25
    `;

    const nearbyResult = await pool.query(nearbyQuery, [
      facility.latitude, facility.longitude, startDateStr, ccn, radius
    ]);

    const today = new Date();
    const nearbySurveys = nearbyResult.rows.map(row => ({
      federal_provider_number: row.federal_provider_number,
      facility_name: row.facility_name,
      city: row.city,
      distance_miles: Math.round(parseFloat(row.distance_miles) * 100) / 100,
      survey_date: row.survey_date,
      days_ago: Math.floor((today - new Date(row.survey_date)) / (1000 * 60 * 60 * 24)),
      deficiency_count: parseInt(row.deficiency_count) || 0,
      top_ftag: row.top_ftag ? `F${row.top_ftag}` : null
    }));

    // Calculate summary
    const avgDistance = nearbySurveys.length > 0
      ? Math.round(nearbySurveys.reduce((a, b) => a + b.distance_miles, 0) / nearbySurveys.length * 100) / 100
      : 0;

    // Get common F-tags
    const ftagCounts = {};
    nearbySurveys.forEach(s => {
      if (s.top_ftag) {
        ftagCounts[s.top_ftag] = (ftagCounts[s.top_ftag] || 0) + 1;
      }
    });
    const commonFtags = Object.entries(ftagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ftag]) => ftag);

    // Generate insight
    let insight = '';
    const recentSurveys = nearbySurveys.filter(s => s.days_ago <= 14);
    const veryRecentSurveys = nearbySurveys.filter(s => s.days_ago <= 7);

    if (veryRecentSurveys.length >= 3) {
      insight = `HIGH ALERT: Survey team very active. ${veryRecentSurveys.length} facilities within ${radius} miles surveyed in last 7 days.`;
    } else if (recentSurveys.length >= 2) {
      insight = `Survey team active in your area. ${recentSurveys.length} facilities within ${radius} miles surveyed in last 2 weeks.`;
    } else if (nearbySurveys.length > 0) {
      insight = `${nearbySurveys.length} surveys within ${radius} miles in last ${days} days. Monitor for increased activity.`;
    } else {
      insight = `No recent surveys within ${radius} miles in the last ${days} days.`;
    }

    res.json({
      success: true,
      data: {
        facility: {
          federal_provider_number: ccn,
          name: facility.facility_name,
          city: facility.city,
          state: facility.state,
          latitude: parseFloat(facility.latitude),
          longitude: parseFloat(facility.longitude)
        },
        nearby_surveys: nearbySurveys,
        summary: {
          surveys_in_area: nearbySurveys.length,
          avg_distance_miles: avgDistance,
          common_ftags: commonFtags,
          surveys_last_7_days: veryRecentSurveys.length,
          surveys_last_14_days: recentSurveys.length
        },
        insight
      },
      meta: {
        radius_miles: radius,
        days,
        date_range: {
          start: startDateStr,
          end: new Date().toISOString().split('T')[0]
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] facilities/:federalProviderNumber/regional-activity error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/facilities/:federalProviderNumber/risk-profile
 * Returns risk profile with prep checklist for a facility
 */
router.get('/facilities/:federalProviderNumber/risk-profile', async (req, res) => {
  const pool = getPool();

  try {
    const { federalProviderNumber } = req.params;
    const ccn = federalProviderNumber;
    const stateCode = ccn.substring(0, 2);

    // Get facility info
    const facilityQuery = `
      SELECT facility_name, city, state
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;
    const facilityResult = await pool.query(facilityQuery, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facilityResult.rows[0];

    // Get facility's previously cited F-tags
    const facilityHistoryQuery = `
      SELECT
        hc.deficiency_tag,
        cd.description,
        COUNT(*) as times_cited,
        MAX(hc.survey_date) as last_cited
      FROM health_citations hc
      LEFT JOIN citation_descriptions cd ON hc.deficiency_tag = cd.deficiency_tag
      WHERE hc.ccn = $1
        AND hc.is_standard_deficiency = true
        AND hc.deficiency_tag IS NOT NULL
      GROUP BY hc.deficiency_tag, cd.description
      ORDER BY times_cited DESC, last_cited DESC
      LIMIT 15
    `;
    const facilityHistoryResult = await pool.query(facilityHistoryQuery, [ccn]);

    // Get state-level trending F-tags (comparing last 6 months to prior 6 months)
    const stateTrendsQuery = `
      WITH recent AS (
        SELECT deficiency_tag, COUNT(*) as count
        FROM health_citations
        WHERE LEFT(ccn, 2) = $1
          AND is_standard_deficiency = true
          AND survey_date >= CURRENT_DATE - INTERVAL '6 months'
          AND deficiency_tag IS NOT NULL
        GROUP BY deficiency_tag
      ),
      prior AS (
        SELECT deficiency_tag, COUNT(*) as count
        FROM health_citations
        WHERE LEFT(ccn, 2) = $1
          AND is_standard_deficiency = true
          AND survey_date >= CURRENT_DATE - INTERVAL '12 months'
          AND survey_date < CURRENT_DATE - INTERVAL '6 months'
          AND deficiency_tag IS NOT NULL
        GROUP BY deficiency_tag
      )
      SELECT
        r.deficiency_tag,
        cd.description,
        r.count as recent_count,
        COALESCE(p.count, 0) as prior_count,
        CASE
          WHEN COALESCE(p.count, 0) = 0 THEN 100
          ELSE ROUND(((r.count - COALESCE(p.count, 0))::numeric / COALESCE(p.count, 1)) * 100)
        END as trend_pct
      FROM recent r
      LEFT JOIN prior p ON r.deficiency_tag = p.deficiency_tag
      LEFT JOIN citation_descriptions cd ON r.deficiency_tag = cd.deficiency_tag
      WHERE r.count > 10
      ORDER BY trend_pct DESC
      LIMIT 10
    `;
    const stateTrendsResult = await pool.query(stateTrendsQuery, [stateCode]);

    // Get national trends
    const nationalTrendsQuery = `
      WITH recent AS (
        SELECT deficiency_tag, COUNT(*) as count
        FROM health_citations
        WHERE is_standard_deficiency = true
          AND survey_date >= CURRENT_DATE - INTERVAL '6 months'
          AND deficiency_tag IS NOT NULL
        GROUP BY deficiency_tag
      ),
      prior AS (
        SELECT deficiency_tag, COUNT(*) as count
        FROM health_citations
        WHERE is_standard_deficiency = true
          AND survey_date >= CURRENT_DATE - INTERVAL '12 months'
          AND survey_date < CURRENT_DATE - INTERVAL '6 months'
          AND deficiency_tag IS NOT NULL
        GROUP BY deficiency_tag
      )
      SELECT
        r.deficiency_tag,
        cd.description,
        r.count as recent_count,
        COALESCE(p.count, 0) as prior_count,
        CASE
          WHEN COALESCE(p.count, 0) = 0 THEN 100
          ELSE ROUND(((r.count - COALESCE(p.count, 0))::numeric / COALESCE(p.count, 1)) * 100)
        END as trend_pct
      FROM recent r
      LEFT JOIN prior p ON r.deficiency_tag = p.deficiency_tag
      LEFT JOIN citation_descriptions cd ON r.deficiency_tag = cd.deficiency_tag
      WHERE r.count > 100
      ORDER BY trend_pct DESC
      LIMIT 10
    `;
    const nationalTrendsResult = await pool.query(nationalTrendsQuery);

    // Get state vs national comparison for top F-tags
    const comparisonQuery = `
      WITH state_counts AS (
        SELECT
          deficiency_tag,
          COUNT(*) as state_count,
          COUNT(DISTINCT ccn) as state_facilities
        FROM health_citations
        WHERE LEFT(ccn, 2) = $1
          AND is_standard_deficiency = true
          AND survey_date >= CURRENT_DATE - INTERVAL '12 months'
          AND deficiency_tag IS NOT NULL
        GROUP BY deficiency_tag
      ),
      national_counts AS (
        SELECT
          deficiency_tag,
          COUNT(*) as national_count,
          COUNT(DISTINCT ccn) as national_facilities
        FROM health_citations
        WHERE is_standard_deficiency = true
          AND survey_date >= CURRENT_DATE - INTERVAL '12 months'
          AND deficiency_tag IS NOT NULL
        GROUP BY deficiency_tag
      )
      SELECT
        s.deficiency_tag,
        cd.description,
        ROUND((s.state_count::numeric / NULLIF(s.state_facilities, 0)) * 100, 2) as state_rate,
        ROUND((n.national_count::numeric / NULLIF(n.national_facilities, 0)) * 100, 2) as national_rate,
        ROUND((s.state_count::numeric / NULLIF(s.state_facilities, 0)) * 100 -
              (n.national_count::numeric / NULLIF(n.national_facilities, 0)) * 100, 2) as delta
      FROM state_counts s
      JOIN national_counts n ON s.deficiency_tag = n.deficiency_tag
      LEFT JOIN citation_descriptions cd ON s.deficiency_tag = cd.deficiency_tag
      WHERE s.state_count > 20
      ORDER BY delta DESC
      LIMIT 10
    `;
    const comparisonResult = await pool.query(comparisonQuery, [stateCode]);

    // Build prep checklist with priorities
    const prepChecklist = [];
    const addedFtags = new Set();

    // Priority 1: Previously cited + trending up in state
    const facilityFtags = new Set(facilityHistoryResult.rows.map(r => r.deficiency_tag));
    const stateTrendingUp = stateTrendsResult.rows.filter(r => parseFloat(r.trend_pct) > 10);

    for (const trend of stateTrendingUp) {
      if (facilityFtags.has(trend.deficiency_tag) && !addedFtags.has(trend.deficiency_tag)) {
        prepChecklist.push({
          priority: 1,
          ftag: `F${trend.deficiency_tag}`,
          description: trend.description || 'Description not available',
          reason: 'Previously cited AND trending up in state',
          times_cited: facilityHistoryResult.rows.find(r => r.deficiency_tag === trend.deficiency_tag)?.times_cited || 0,
          trend_pct: parseFloat(trend.trend_pct)
        });
        addedFtags.add(trend.deficiency_tag);
      }
    }

    // Priority 2: Previously cited multiple times
    for (const hist of facilityHistoryResult.rows) {
      if (parseInt(hist.times_cited) >= 2 && !addedFtags.has(hist.deficiency_tag)) {
        prepChecklist.push({
          priority: 2,
          ftag: `F${hist.deficiency_tag}`,
          description: hist.description || 'Description not available',
          reason: `Previously cited ${hist.times_cited} times`,
          times_cited: parseInt(hist.times_cited),
          last_cited: hist.last_cited
        });
        addedFtags.add(hist.deficiency_tag);
      }
    }

    // Priority 3: Trending up in state (not previously cited)
    for (const trend of stateTrendingUp) {
      if (!addedFtags.has(trend.deficiency_tag) && prepChecklist.length < 10) {
        prepChecklist.push({
          priority: 3,
          ftag: `F${trend.deficiency_tag}`,
          description: trend.description || 'Description not available',
          reason: `Trending up ${trend.trend_pct}% in state`,
          trend_pct: parseFloat(trend.trend_pct)
        });
        addedFtags.add(trend.deficiency_tag);
      }
    }

    // Priority 4: State rate significantly above national
    for (const comp of comparisonResult.rows) {
      if (parseFloat(comp.delta) > 5 && !addedFtags.has(comp.deficiency_tag) && prepChecklist.length < 12) {
        prepChecklist.push({
          priority: 4,
          ftag: `F${comp.deficiency_tag}`,
          description: comp.description || 'Description not available',
          reason: `State rate ${comp.delta}% above national average`,
          state_rate: parseFloat(comp.state_rate),
          national_rate: parseFloat(comp.national_rate)
        });
        addedFtags.add(comp.deficiency_tag);
      }
    }

    // Sort by priority
    prepChecklist.sort((a, b) => a.priority - b.priority);

    res.json({
      success: true,
      data: {
        facility: {
          federal_provider_number: ccn,
          name: facility.facility_name,
          city: facility.city,
          state: facility.state
        },
        facility_history: {
          previously_cited_ftags: facilityHistoryResult.rows.map(r => ({
            ftag: `F${r.deficiency_tag}`,
            description: r.description || 'Description not available',
            times_cited: parseInt(r.times_cited),
            last_cited: r.last_cited
          }))
        },
        state_focus: {
          trending_up: stateTrendsResult.rows
            .filter(r => parseFloat(r.trend_pct) > 0)
            .map(r => ({
              ftag: `F${r.deficiency_tag}`,
              description: r.description || 'Description not available',
              trend_pct: parseFloat(r.trend_pct),
              recent_count: parseInt(r.recent_count)
            })),
          state_vs_national: comparisonResult.rows.map(r => ({
            ftag: `F${r.deficiency_tag}`,
            description: r.description || 'Description not available',
            state_rate: parseFloat(r.state_rate),
            national_rate: parseFloat(r.national_rate),
            delta: parseFloat(r.delta)
          }))
        },
        national_trends: {
          trending_up: nationalTrendsResult.rows
            .filter(r => parseFloat(r.trend_pct) > 0)
            .map(r => ({
              ftag: `F${r.deficiency_tag}`,
              description: r.description || 'Description not available',
              trend_pct: parseFloat(r.trend_pct)
            }))
        },
        prep_checklist: prepChecklist
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] facilities/:federalProviderNumber/risk-profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// BELLWETHER SYSTEM ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/survey-intelligence/bellwethers/:federalProviderNumber
 * Returns bellwether relationships for a facility
 */
router.get('/bellwethers/:federalProviderNumber', async (req, res) => {
  const pool = getPool();

  try {
    const { federalProviderNumber } = req.params;
    const ccn = federalProviderNumber;

    // Get facility info
    const facilityQuery = `
      SELECT
        facility_name, city, state, county
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;
    const facilityResult = await pool.query(facilityQuery, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facilityResult.rows[0];

    // Get bellwethers for this facility (facilities that precede this one)
    const bellwethersForMeQuery = `
      SELECT
        br.bellwether_facility_id,
        sf.facility_name,
        sf.city,
        br.times_bellwether_preceded,
        br.avg_days_gap,
        br.stddev_days_gap,
        br.min_days_gap,
        br.max_days_gap,
        br.confidence_score,
        br.is_active_signal,
        br.signal_date,
        br.days_since_signal,
        (
          SELECT MAX(survey_date)
          FROM survey_dates
          WHERE ccn = br.bellwether_facility_id
            AND survey_type = 'Health Standard'
        ) as last_survey_date
      FROM facility_bellwether_relationships br
      LEFT JOIN snf_facilities sf ON br.bellwether_facility_id = sf.federal_provider_number
      WHERE br.facility_id = $1
      ORDER BY br.confidence_score DESC, br.times_bellwether_preceded DESC
    `;
    const bellwethersForMeResult = await pool.query(bellwethersForMeQuery, [ccn]);

    // Get facilities this one is a bellwether for
    const iAmBellwetherForQuery = `
      SELECT
        br.facility_id,
        sf.facility_name,
        sf.city,
        br.times_bellwether_preceded,
        br.avg_days_gap,
        br.confidence_score
      FROM facility_bellwether_relationships br
      LEFT JOIN snf_facilities sf ON br.facility_id = sf.federal_provider_number
      WHERE br.bellwether_facility_id = $1
      ORDER BY br.confidence_score DESC
    `;
    const iAmBellwetherForResult = await pool.query(iAmBellwetherForQuery, [ccn]);

    // Attempt to build survey sequence/territory
    // This groups facilities by county that have bellwether relationships
    const territoryQuery = `
      WITH territory_facilities AS (
        SELECT DISTINCT
          CASE
            WHEN br.facility_id = $1 THEN br.bellwether_facility_id
            WHEN br.bellwether_facility_id = $1 THEN br.facility_id
            ELSE br.facility_id
          END as ccn
        FROM facility_bellwether_relationships br
        WHERE br.facility_id = $1 OR br.bellwether_facility_id = $1
        UNION
        SELECT $1 as ccn
      ),
      facility_order AS (
        SELECT
          tf.ccn,
          sf.facility_name,
          sf.city,
          COALESCE(
            (SELECT AVG(survey_date - LAG(survey_date) OVER (PARTITION BY ccn ORDER BY survey_date))
             FROM survey_dates
             WHERE ccn = tf.ccn AND survey_type = 'Health Standard'),
            0
          ) as avg_position,
          CASE WHEN tf.ccn = $1 THEN 'this_facility'
               WHEN EXISTS (
                 SELECT 1 FROM facility_bellwether_relationships
                 WHERE bellwether_facility_id = tf.ccn AND facility_id = $1
               ) THEN 'bellwether'
               ELSE NULL
          END as role
        FROM territory_facilities tf
        LEFT JOIN snf_facilities sf ON tf.ccn = sf.federal_provider_number
      )
      SELECT * FROM facility_order
      ORDER BY role DESC NULLS LAST, avg_position
      LIMIT 10
    `;

    let surveySequence = null;
    try {
      const territoryResult = await pool.query(territoryQuery, [ccn]);
      if (territoryResult.rows.length > 1) {
        surveySequence = {
          territory: `${facility.county || 'Unknown'} County - ${facility.state}`,
          typical_order: territoryResult.rows.map((row, idx) => ({
            position: idx + 1,
            federal_provider_number: row.ccn,
            facility_name: row.facility_name,
            city: row.city,
            role: row.role
          }))
        };
      }
    } catch (e) {
      // Territory calculation is optional
      console.log('Territory calculation skipped:', e.message);
    }

    res.json({
      success: true,
      data: {
        facility: {
          federal_provider_number: ccn,
          name: facility.facility_name,
          city: facility.city,
          state: facility.state,
          county: facility.county
        },
        bellwethers_for_me: bellwethersForMeResult.rows.map(row => ({
          federal_provider_number: row.bellwether_facility_id,
          facility_name: row.facility_name,
          city: row.city,
          times_preceded: parseInt(row.times_bellwether_preceded) || 0,
          avg_days_gap: parseFloat(row.avg_days_gap) || 0,
          stddev_days_gap: parseFloat(row.stddev_days_gap) || 0,
          min_days_gap: parseInt(row.min_days_gap) || 0,
          max_days_gap: parseInt(row.max_days_gap) || 0,
          confidence_score: parseFloat(row.confidence_score) || 0,
          last_survey_date: row.last_survey_date,
          is_active_signal: row.is_active_signal || false,
          days_since_signal: row.days_since_signal ? parseInt(row.days_since_signal) : null
        })),
        i_am_bellwether_for: iAmBellwetherForResult.rows.map(row => ({
          federal_provider_number: row.facility_id,
          facility_name: row.facility_name,
          city: row.city,
          times_preceded: parseInt(row.times_bellwether_preceded) || 0,
          avg_days_gap: parseFloat(row.avg_days_gap) || 0,
          confidence_score: parseFloat(row.confidence_score) || 0
        })),
        survey_sequence: surveySequence
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] bellwethers/:federalProviderNumber error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/v1/survey-intelligence/bellwethers/:federalProviderNumber/signals
 * Returns active bellwether signals for a facility
 */
router.get('/bellwethers/:federalProviderNumber/signals', async (req, res) => {
  const pool = getPool();

  try {
    const { federalProviderNumber } = req.params;
    const ccn = federalProviderNumber;

    // Get facility info
    const facilityQuery = `
      SELECT facility_name, city, state
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `;
    const facilityResult = await pool.query(facilityQuery, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Facility not found' });
    }
    const facility = facilityResult.rows[0];

    // Get active signals for this facility
    const signalsQuery = `
      SELECT
        br.bellwether_facility_id,
        sf.facility_name,
        sf.city,
        br.signal_date,
        br.days_since_signal,
        br.avg_days_gap,
        br.stddev_days_gap,
        br.min_days_gap,
        br.max_days_gap,
        br.confidence_score
      FROM facility_bellwether_relationships br
      LEFT JOIN snf_facilities sf ON br.bellwether_facility_id = sf.federal_provider_number
      WHERE br.facility_id = $1
        AND br.is_active_signal = true
      ORDER BY br.days_since_signal ASC
    `;
    const signalsResult = await pool.query(signalsQuery, [ccn]);

    const today = new Date();
    const activeSignals = signalsResult.rows.map(row => {
      const daysSinceSignal = row.days_since_signal ? parseInt(row.days_since_signal) : 0;
      const minDays = parseInt(row.min_days_gap) || 5;
      const maxDays = parseInt(row.max_days_gap) || 14;
      const avgDays = parseFloat(row.avg_days_gap) || 8;

      // Calculate days into expected window
      const windowStart = minDays;
      const windowEnd = maxDays;
      let daysIntoWindow = null;
      let urgency = 'LOW';

      if (daysSinceSignal >= windowStart) {
        daysIntoWindow = daysSinceSignal - windowStart;
        const windowProgress = daysIntoWindow / (windowEnd - windowStart);

        if (windowProgress >= 1) {
          urgency = 'CRITICAL'; // Past expected window
        } else if (windowProgress >= 0.7) {
          urgency = 'HIGH';
        } else if (windowProgress >= 0.3) {
          urgency = 'ELEVATED';
        } else {
          urgency = 'MODERATE';
        }
      } else {
        // Before window starts
        urgency = daysSinceSignal >= windowStart - 2 ? 'MODERATE' : 'LOW';
      }

      return {
        bellwether: {
          federal_provider_number: row.bellwether_facility_id,
          facility_name: row.facility_name,
          city: row.city
        },
        signal_date: row.signal_date,
        days_ago: daysSinceSignal,
        expected_window: {
          min_days: minDays,
          max_days: maxDays,
          avg_days: Math.round(avgDays * 10) / 10
        },
        days_into_window: daysIntoWindow,
        urgency,
        confidence_score: parseFloat(row.confidence_score) || 0
      };
    });

    // Determine overall alert status
    let alertStatus = 'INACTIVE';
    let recommendedAction = 'No immediate action required. Continue routine compliance monitoring.';

    if (activeSignals.length > 0) {
      const highestUrgency = activeSignals.reduce((max, s) => {
        const urgencyOrder = { 'CRITICAL': 5, 'HIGH': 4, 'ELEVATED': 3, 'MODERATE': 2, 'LOW': 1 };
        return urgencyOrder[s.urgency] > urgencyOrder[max] ? s.urgency : max;
      }, 'LOW');

      if (highestUrgency === 'CRITICAL') {
        alertStatus = 'CRITICAL';
        recommendedAction = 'IMMEDIATE: Survey expected any day. Complete all outstanding compliance items NOW.';
      } else if (highestUrgency === 'HIGH') {
        alertStatus = 'HIGH';
        recommendedAction = 'Conduct internal audit this week. Ensure all documentation is current.';
      } else if (highestUrgency === 'ELEVATED') {
        alertStatus = 'ELEVATED';
        recommendedAction = 'Begin survey preparation. Review recent citations and correction plans.';
      } else if (highestUrgency === 'MODERATE') {
        alertStatus = 'ACTIVE';
        recommendedAction = 'Monitor situation. Start preliminary survey readiness activities.';
      } else {
        alertStatus = 'ACTIVE';
        recommendedAction = 'Bellwether surveyed. Survey window approaching. Maintain readiness.';
      }
    }

    res.json({
      success: true,
      data: {
        facility: {
          federal_provider_number: ccn,
          name: facility.facility_name,
          city: facility.city,
          state: facility.state
        },
        active_signals: activeSignals,
        alert_status: alertStatus,
        recommended_action: recommendedAction,
        total_active_signals: activeSignals.length
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] bellwethers/:federalProviderNumber/signals error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * POST /api/v1/survey-intelligence/bellwethers/calculate
 * Calculate bellwether relationships for a geographic area
 * Body: { state: "CA", county: "Los Angeles", min_occurrences: 3, min_confidence: 0.5 }
 */
router.post('/bellwethers/calculate', async (req, res) => {
  const pool = getPool();
  const startTime = Date.now();

  try {
    const {
      state,
      county,
      min_occurrences = 3,
      min_confidence = 0.5,
      lookback_years = 3
    } = req.body;

    if (!state) {
      return res.status(400).json({ success: false, error: 'state is required' });
    }

    // Get state code from 2-letter abbreviation
    const stateCodeQuery = `
      SELECT DISTINCT LEFT(federal_provider_number, 2) as state_code
      FROM snf_facilities
      WHERE UPPER(state) = UPPER($1)
      LIMIT 1
    `;
    const stateCodeResult = await pool.query(stateCodeQuery, [state]);

    if (stateCodeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'State not found' });
    }
    const stateCode = stateCodeResult.rows[0].state_code;

    // Get all Health Standard surveys in the area
    let surveysQuery = `
      SELECT
        sd.ccn,
        sd.survey_date,
        sf.county,
        sf.facility_name
      FROM survey_dates sd
      INNER JOIN snf_facilities sf ON sd.ccn = sf.federal_provider_number
      WHERE sd.survey_type = 'Health Standard'
        AND LEFT(sd.ccn, 2) = $1
        AND sd.survey_date >= CURRENT_DATE - INTERVAL '${lookback_years} years'
    `;
    const params = [stateCode];

    if (county) {
      surveysQuery += ` AND LOWER(sf.county) = LOWER($2)`;
      params.push(county);
    }

    surveysQuery += ` ORDER BY sd.survey_date`;

    const surveysResult = await pool.query(surveysQuery, params);
    const surveys = surveysResult.rows;

    // Build facility pairs and count preceding occurrences
    const pairStats = {};
    const facilitySurveys = {};

    // Group surveys by facility
    surveys.forEach(s => {
      if (!facilitySurveys[s.ccn]) {
        facilitySurveys[s.ccn] = [];
      }
      facilitySurveys[s.ccn].push({
        date: new Date(s.survey_date),
        county: s.county
      });
    });

    const facilityIds = Object.keys(facilitySurveys);

    // For each pair of facilities, check if A precedes B within 14 days
    for (let i = 0; i < facilityIds.length; i++) {
      for (let j = 0; j < facilityIds.length; j++) {
        if (i === j) continue;

        const facilityA = facilityIds[i]; // Potential bellwether
        const facilityB = facilityIds[j]; // Facility that follows

        const surveysA = facilitySurveys[facilityA];
        const surveysB = facilitySurveys[facilityB];

        let precedingCount = 0;
        const gaps = [];

        // Check each survey of B to see if A preceded it
        for (const surveyB of surveysB) {
          for (const surveyA of surveysA) {
            const daysDiff = Math.floor((surveyB.date - surveyA.date) / (1000 * 60 * 60 * 24));

            // A preceded B within 1-14 days
            if (daysDiff >= 1 && daysDiff <= 14) {
              precedingCount++;
              gaps.push(daysDiff);
              break; // Count only once per B survey
            }
          }
        }

        if (precedingCount >= min_occurrences) {
          const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
          const stddev = Math.sqrt(variance);
          const confidence = Math.min(1, (precedingCount / surveysB.length) * (1 - (stddev / 14)));

          if (confidence >= min_confidence) {
            const pairKey = `${facilityB}:${facilityA}`;
            pairStats[pairKey] = {
              facility_id: facilityB,
              bellwether_facility_id: facilityA,
              county: surveysA[0]?.county || county,
              state: state,
              times_bellwether_preceded: precedingCount,
              total_survey_cycles: surveysB.length,
              avg_days_gap: Math.round(avgGap * 100) / 100,
              stddev_days_gap: Math.round(stddev * 100) / 100,
              min_days_gap: Math.min(...gaps),
              max_days_gap: Math.max(...gaps),
              pattern_years: lookback_years,
              confidence_score: Math.round(confidence * 100) / 100
            };
          }
        }
      }
    }

    // Insert relationships into database
    const relationships = Object.values(pairStats);
    let insertedCount = 0;
    let highConfidenceCount = 0;

    for (const rel of relationships) {
      try {
        await pool.query(`
          INSERT INTO facility_bellwether_relationships (
            facility_id, bellwether_facility_id, county, state,
            times_bellwether_preceded, total_survey_cycles,
            avg_days_gap, stddev_days_gap, min_days_gap, max_days_gap,
            pattern_years, confidence_score, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (facility_id, bellwether_facility_id)
          DO UPDATE SET
            times_bellwether_preceded = EXCLUDED.times_bellwether_preceded,
            total_survey_cycles = EXCLUDED.total_survey_cycles,
            avg_days_gap = EXCLUDED.avg_days_gap,
            stddev_days_gap = EXCLUDED.stddev_days_gap,
            min_days_gap = EXCLUDED.min_days_gap,
            max_days_gap = EXCLUDED.max_days_gap,
            pattern_years = EXCLUDED.pattern_years,
            confidence_score = EXCLUDED.confidence_score,
            updated_at = NOW()
        `, [
          rel.facility_id, rel.bellwether_facility_id, rel.county, rel.state,
          rel.times_bellwether_preceded, rel.total_survey_cycles,
          rel.avg_days_gap, rel.stddev_days_gap, rel.min_days_gap, rel.max_days_gap,
          rel.pattern_years, rel.confidence_score
        ]);

        insertedCount++;
        if (rel.confidence_score >= 0.7) highConfidenceCount++;
      } catch (e) {
        console.error('Error inserting relationship:', e.message);
      }
    }

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        relationships_created: insertedCount,
        high_confidence: highConfidenceCount,
        facilities_analyzed: facilityIds.length,
        surveys_analyzed: surveys.length,
        processing_time_ms: processingTime,
        parameters: {
          state,
          county: county || 'all',
          min_occurrences,
          min_confidence,
          lookback_years
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] bellwethers/calculate error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * POST /api/v1/survey-intelligence/bellwethers/update-signals
 * Update active signals based on recent survey activity
 * Called when new survey data is imported
 * Body: { days_lookback: 14 } (optional)
 */
router.post('/bellwethers/update-signals', async (req, res) => {
  const pool = getPool();

  try {
    const { days_lookback = 14 } = req.body;

    // First, clear old signals (beyond max_days_gap or 30 days, whichever is greater)
    const clearOldSignalsQuery = `
      UPDATE facility_bellwether_relationships
      SET
        is_active_signal = false,
        signal_date = NULL,
        days_since_signal = NULL,
        updated_at = NOW()
      WHERE is_active_signal = true
        AND (
          signal_date < CURRENT_DATE - GREATEST(max_days_gap, 30)
          OR signal_date IS NULL
        )
    `;
    const clearResult = await pool.query(clearOldSignalsQuery);
    const signalsCleared = clearResult.rowCount;

    // Find all bellwether facilities that were surveyed recently
    const recentSurveysQuery = `
      SELECT DISTINCT
        sd.ccn as bellwether_ccn,
        sd.survey_date
      FROM survey_dates sd
      WHERE sd.survey_type = 'Health Standard'
        AND sd.survey_date >= CURRENT_DATE - INTERVAL '${days_lookback} days'
        AND EXISTS (
          SELECT 1 FROM facility_bellwether_relationships br
          WHERE br.bellwether_facility_id = sd.ccn
        )
      ORDER BY sd.survey_date DESC
    `;
    const recentSurveysResult = await pool.query(recentSurveysQuery);

    let signalsActivated = 0;
    const alertsQueued = [];

    for (const survey of recentSurveysResult.rows) {
      // Activate signals for all facilities that follow this bellwether
      const activateQuery = `
        UPDATE facility_bellwether_relationships
        SET
          is_active_signal = true,
          signal_date = $2,
          days_since_signal = CURRENT_DATE - $2::date,
          updated_at = NOW()
        WHERE bellwether_facility_id = $1
          AND (is_active_signal = false OR signal_date < $2)
        RETURNING facility_id
      `;
      const activateResult = await pool.query(activateQuery, [
        survey.bellwether_ccn,
        survey.survey_date
      ]);

      signalsActivated += activateResult.rowCount;

      // Add to alerts queue
      for (const row of activateResult.rows) {
        alertsQueued.push({
          facility_id: row.facility_id,
          bellwether_id: survey.bellwether_ccn,
          signal_date: survey.survey_date
        });
      }
    }

    // Update days_since_signal for all active signals
    await pool.query(`
      UPDATE facility_bellwether_relationships
      SET days_since_signal = CURRENT_DATE - signal_date
      WHERE is_active_signal = true AND signal_date IS NOT NULL
    `);

    res.json({
      success: true,
      data: {
        signals_activated: signalsActivated,
        signals_cleared: signalsCleared,
        alerts_queued: alertsQueued.length,
        bellwethers_surveyed: recentSurveysResult.rows.length,
        parameters: {
          days_lookback
        }
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] bellwethers/update-signals error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// METADATA ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/survey-intelligence/meta/freshness
 * Returns data freshness metadata
 */
router.get('/meta/freshness', async (req, res) => {
  const pool = getPool();

  try {
    const freshnessQuery = `
      SELECT
        MAX(survey_date) as most_recent_survey,
        CURRENT_DATE - MAX(survey_date) as data_lag_days,
        COUNT(*) as total_citations,
        COUNT(DISTINCT ccn) as total_facilities,
        MIN(survey_date) as earliest_survey
      FROM health_citations
    `;

    const result = await pool.query(freshnessQuery);
    const stats = result.rows[0];

    // Get survey counts by year
    const byYearQuery = `
      SELECT
        EXTRACT(YEAR FROM survey_date) as year,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn || '-' || survey_date::text) as survey_count
      FROM health_citations
      WHERE is_standard_deficiency = true
      GROUP BY EXTRACT(YEAR FROM survey_date)
      ORDER BY year DESC
      LIMIT 5
    `;

    const byYearResult = await pool.query(byYearQuery);

    res.json({
      success: true,
      data: {
        most_recent_survey: stats.most_recent_survey,
        data_lag_days: parseInt(stats.data_lag_days) || 0,
        surveys_through_date: stats.most_recent_survey,
        earliest_survey: stats.earliest_survey,
        total_citations: parseInt(stats.total_citations) || 0,
        total_facilities: parseInt(stats.total_facilities) || 0,
        last_refresh: new Date().toISOString(),
        by_year: byYearResult.rows.map(row => ({
          year: parseInt(row.year),
          citation_count: parseInt(row.citation_count),
          survey_count: parseInt(row.survey_count)
        }))
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] meta/freshness error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

// ============================================================================
// ALERT ENDPOINTS
// ============================================================================

// Ensure alert tables exist on startup
const ensureAlertTables = async () => {
  const pool = getPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_alert_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        federal_provider_number VARCHAR(20) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        notification_channel VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_alerts (
        id SERIAL PRIMARY KEY,
        user_id INT,
        federal_provider_number VARCHAR(20),
        alert_type VARCHAR(50) NOT NULL,
        urgency VARCHAR(20),
        title VARCHAR(200),
        message TEXT,
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('[Survey Intelligence] Alert tables verified');
  } catch (error) {
    console.error('[Survey Intelligence] Error ensuring alert tables:', error.message);
  } finally {
    await pool.end();
  }
};

// Run table setup on module load
ensureAlertTables();

/**
 * GET /api/v1/survey-intelligence/alerts
 * Returns alerts for a user or facility
 * Query params: ?user_id=123 or ?facility_id=055001
 */
router.get('/alerts', async (req, res) => {
  const pool = getPool();

  try {
    const { user_id, facility_id } = req.query;

    if (!user_id && !facility_id) {
      return res.status(400).json({
        success: false,
        error: 'Either user_id or facility_id query parameter is required'
      });
    }

    let whereClause = '';
    const params = [];

    if (user_id) {
      params.push(user_id);
      whereClause = 'user_id = $1';
    } else if (facility_id) {
      params.push(facility_id);
      whereClause = 'federal_provider_number = $1';
    }

    // Get alerts
    const alertsQuery = `
      SELECT
        sa.id,
        sa.alert_type as type,
        sa.federal_provider_number,
        sf.facility_name,
        sa.created_at,
        sa.is_read,
        sa.urgency,
        sa.title,
        sa.message,
        sa.data
      FROM survey_alerts sa
      LEFT JOIN snf_facilities sf ON sa.federal_provider_number = sf.federal_provider_number
      WHERE ${whereClause}
      ORDER BY sa.created_at DESC
      LIMIT 100
    `;

    const alertsResult = await pool.query(alertsQuery, params);

    // Get unread count
    const unreadQuery = `
      SELECT COUNT(*) as unread_count
      FROM survey_alerts
      WHERE ${whereClause} AND is_read = false
    `;

    const unreadResult = await pool.query(unreadQuery, params);

    const alerts = alertsResult.rows.map(row => ({
      id: row.id,
      type: row.type,
      facility: {
        federal_provider_number: row.federal_provider_number,
        name: row.facility_name
      },
      created_at: row.created_at,
      is_read: row.is_read,
      urgency: row.urgency,
      title: row.title,
      message: row.message,
      data: row.data || {}
    }));

    res.json({
      success: true,
      alerts,
      unread_count: parseInt(unreadResult.rows[0].unread_count) || 0
    });

  } catch (error) {
    console.error('[Survey Intelligence API] alerts error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * POST /api/v1/survey-intelligence/alerts/subscribe
 * Subscribe to alerts for a facility
 * Body: { user_id, federal_provider_number, alert_types: [], notification_channels: [] }
 */
router.post('/alerts/subscribe', async (req, res) => {
  const pool = getPool();

  try {
    const { user_id, federal_provider_number, alert_types, notification_channels } = req.body;

    if (!user_id || !federal_provider_number) {
      return res.status(400).json({
        success: false,
        error: 'user_id and federal_provider_number are required'
      });
    }

    const types = alert_types || ['bellwether', 'regional_activity', 'weekly_digest'];
    const channels = notification_channels || ['in_app'];

    const subscriptions = [];

    // Create subscription for each type/channel combination
    for (const alertType of types) {
      for (const channel of channels) {
        // Check if subscription already exists
        const existingQuery = `
          SELECT id FROM survey_alert_subscriptions
          WHERE user_id = $1
            AND federal_provider_number = $2
            AND alert_type = $3
            AND notification_channel = $4
        `;

        const existing = await pool.query(existingQuery, [user_id, federal_provider_number, alertType, channel]);

        if (existing.rows.length === 0) {
          const insertQuery = `
            INSERT INTO survey_alert_subscriptions (user_id, federal_provider_number, alert_type, notification_channel)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `;

          const result = await pool.query(insertQuery, [user_id, federal_provider_number, alertType, channel]);
          subscriptions.push({
            id: result.rows[0].id,
            alert_type: alertType,
            notification_channel: channel
          });
        } else {
          // Reactivate if exists but inactive
          await pool.query(
            'UPDATE survey_alert_subscriptions SET is_active = true WHERE id = $1',
            [existing.rows[0].id]
          );
          subscriptions.push({
            id: existing.rows[0].id,
            alert_type: alertType,
            notification_channel: channel,
            reactivated: true
          });
        }
      }
    }

    res.json({
      success: true,
      subscription_id: subscriptions[0]?.id,
      subscriptions,
      status: 'active'
    });

  } catch (error) {
    console.error('[Survey Intelligence API] alerts/subscribe error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * PUT /api/v1/survey-intelligence/alerts/:alertId/read
 * Mark an alert as read
 */
router.put('/alerts/:alertId/read', async (req, res) => {
  const pool = getPool();

  try {
    const { alertId } = req.params;

    const updateQuery = `
      UPDATE survey_alerts
      SET is_read = true
      WHERE id = $1
      RETURNING id, is_read
    `;

    const result = await pool.query(updateQuery, [alertId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      alert: {
        id: result.rows[0].id,
        is_read: result.rows[0].is_read
      }
    });

  } catch (error) {
    console.error('[Survey Intelligence API] alerts/:alertId/read error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * DELETE /api/v1/survey-intelligence/alerts/subscribe/:subscriptionId
 * Unsubscribe from alerts
 */
router.delete('/alerts/subscribe/:subscriptionId', async (req, res) => {
  const pool = getPool();

  try {
    const { subscriptionId } = req.params;

    // Soft delete by setting is_active to false
    const updateQuery = `
      UPDATE survey_alert_subscriptions
      SET is_active = false
      WHERE id = $1
      RETURNING id, user_id, federal_provider_number, alert_type
    `;

    const result = await pool.query(updateQuery, [subscriptionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription deactivated',
      subscription: result.rows[0]
    });

  } catch (error) {
    console.error('[Survey Intelligence API] alerts/subscribe/:subscriptionId error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

module.exports = router;
