/**
 * Survey Analytics API Routes
 *
 * Provides endpoints for survey deficiency data, F-tag trends,
 * and state/national comparisons.
 *
 * Uses cms_facility_deficiencies table which has real survey data.
 * Column mapping:
 * - ccn or federal_provider_number for facility ID
 * - scope_severity for severity codes
 * - deficiency_tag for F-tag codes
 */

const express = require('express');
const router = express.Router();
const { getMainPool, getMarketPool } = require('../config/database');

// Table and column configuration
// Use cms_facility_deficiencies which has actual data in production
const SURVEY_TABLE = 'cms_facility_deficiencies';
const CCN_COLUMN = 'COALESCE(ccn, federal_provider_number)'; // Use ccn if available, fallback to federal_provider_number
const SEVERITY_COLUMN = 'scope_severity';

/**
 * Get the appropriate database pool for survey queries
 * Uses Market DB which has the full CMS deficiency dataset (417k+ rows)
 * and separates analytics queries from transactional operations
 */
const getSurveyPool = () => {
  return getMarketPool();
};

/**
 * Build WHERE clause for deficiency type filter
 * Uses the deficiency type columns in cms_facility_deficiencies
 * @param {string} deficiencyType - 'all' | 'standard' | 'complaint' | 'infection'
 * @returns {string} SQL WHERE clause fragment
 */
const buildDeficiencyTypeFilter = (deficiencyType) => {
  switch (deficiencyType) {
    case 'standard':
      return 'AND is_standard_deficiency = true';
    case 'complaint':
      return 'AND is_complaint_deficiency = true';
    case 'infection':
      return 'AND is_infection_control = true';
    case 'all':
    default:
      return '';
  }
};

/**
 * Helper to convert period to days
 * @param {string} period - '30days' | '90days' | '12months' | 'all'
 * @returns {number} Number of days
 */
const periodToDays = (period) => {
  switch (period) {
    case '30days': return 30;
    case '12months': return 365;
    case 'all': return 36500; // ~100 years - effectively all data
    default: return 90;
  }
};

// ============================================================================
// NATIONAL OVERVIEW ENDPOINTS
// ============================================================================

/**
 * GET /api/survey/national-overview
 * Get national survey statistics and top F-tags
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: '90days')
 * - deficiencyType: 'all' | 'standard' | 'complaint' | 'infection' (default: 'all')
 */
router.get('/national-overview', async (req, res) => {
  const { period = '90days', deficiencyType = 'all' } = req.query;
  const pool = getSurveyPool();
  const typeFilter = buildDeficiencyTypeFilter(deficiencyType);

  try {
    // Get the most recent data date (data may be stale)
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    // Calculate date range based on period, relative to max available data
    const days = periodToDays(period);
    const priorDays = days * 2; // For comparison period

    // When filtering by deficiency type, we must query raw data (MV doesn't have type columns)
    const useRawData = deficiencyType !== 'all';

    // Run all queries in parallel for performance
    const [topFTagsResult, monthlyVolumeResult, summaryResult, typeBreakdownResult] = await Promise.all([
      // Get top F-tags for current period (relative to max data date)
      pool.query(`
        WITH current_period AS (
          SELECT
            d.deficiency_tag,
            COUNT(*) as count
          FROM cms_facility_deficiencies d
          WHERE d.survey_date >= $1::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY d.deficiency_tag
        ),
        prior_period AS (
          SELECT
            d.deficiency_tag,
            COUNT(*) as count
          FROM cms_facility_deficiencies d
          WHERE d.survey_date >= $1::date - INTERVAL '${priorDays} days'
            AND d.survey_date < $1::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY d.deficiency_tag
        )
        SELECT
          ROW_NUMBER() OVER (ORDER BY c.count DESC) as rank,
          c.deficiency_tag as code,
          COALESCE(cd.category, 'Unknown') as category,
          COALESCE(cd.description, 'No description available') as name,
          c.count,
          COALESCE(p.count, 0) as prior_count,
          CASE
            WHEN COALESCE(p.count, 0) = 0 THEN 0
            ELSE ROUND(((c.count - p.count)::numeric / p.count * 100)::numeric, 1)
          END as change_pct,
          CASE
            WHEN COALESCE(p.count, 0) = 0 THEN 'NEW'
            WHEN c.count > p.count * 1.05 THEN 'UP'
            WHEN c.count < p.count * 0.95 THEN 'DOWN'
            ELSE 'STABLE'
          END as trend
        FROM current_period c
        LEFT JOIN prior_period p ON c.deficiency_tag = p.deficiency_tag
        LEFT JOIN citation_descriptions cd ON c.deficiency_tag = cd.deficiency_tag
        ORDER BY c.count DESC
        LIMIT 15
      `, [maxDate]),

      // Get monthly volume data (last 12 months relative to max data date)
      // Uses raw table with type filter, or MV for 'all' types
      useRawData ? pool.query(`
        SELECT
          TO_CHAR(survey_date, 'YYYY-MM') as month,
          TO_CHAR(survey_date, 'Mon') as month_label,
          COUNT(DISTINCT (federal_provider_number, survey_date)) as surveys,
          COUNT(*) as total_defs,
          ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT (federal_provider_number, survey_date)), 0), 1) as avg_defs_per_survey,
          ROUND((SUM(CASE WHEN scope_severity IN ('J', 'K', 'L') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as ij_rate_pct
        FROM cms_facility_deficiencies
        WHERE survey_date >= $1::date - INTERVAL '12 months'
          ${typeFilter}
        GROUP BY TO_CHAR(survey_date, 'YYYY-MM'), TO_CHAR(survey_date, 'Mon')
        ORDER BY month
      `, [maxDate]) : pool.query(`
        SELECT
          year_month as month,
          TO_CHAR(survey_date, 'Mon') as month_label,
          COUNT(*) as surveys,
          SUM(deficiency_count) as total_defs,
          ROUND(SUM(deficiency_count)::numeric / NULLIF(COUNT(*), 0), 1) as avg_defs_per_survey,
          ROUND((SUM(ij_count)::numeric / NULLIF(SUM(deficiency_count), 0) * 100)::numeric, 2) as ij_rate_pct
        FROM mv_survey_aggregates
        WHERE survey_date >= $1::date - INTERVAL '12 months'
        GROUP BY year_month, TO_CHAR(survey_date, 'Mon')
        ORDER BY month
      `, [maxDate]),

      // Get summary stats
      // Uses raw table with type filter, or MV for 'all' types
      useRawData ? pool.query(`
        SELECT
          COUNT(DISTINCT (federal_provider_number, survey_date)) as survey_count,
          ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT (federal_provider_number, survey_date)), 0), 1) as avg_deficiencies,
          ROUND((SUM(CASE WHEN scope_severity IN ('J', 'K', 'L') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0))::numeric, 4) as ij_rate
        FROM cms_facility_deficiencies
        WHERE survey_date >= $1::date - INTERVAL '${days} days'
          ${typeFilter}
      `, [maxDate]) : pool.query(`
        SELECT
          COUNT(*) as survey_count,
          ROUND(AVG(deficiency_count)::numeric, 1) as avg_deficiencies,
          ROUND((SUM(ij_count)::numeric / NULLIF(SUM(deficiency_count), 0))::numeric, 4) as ij_rate
        FROM mv_survey_aggregates
        WHERE survey_date >= $1::date - INTERVAL '${days} days'
      `, [maxDate]),

      // Get deficiency type breakdown
      pool.query(`
        SELECT COUNT(*) as total
        FROM cms_facility_deficiencies
        WHERE survey_date >= $1::date - INTERVAL '${days} days'
          ${typeFilter}
      `, [maxDate])
    ]);

    // Generate insights based on actual data
    const topTag = topFTagsResult.rows[0];
    const insights = [];

    if (topTag) {
      insights.push(`F${topTag.code} (${topTag.name.split(' ').slice(0, 3).join(' ')}...) is the most cited deficiency with ${topTag.count.toLocaleString()} citations`);
    }

    // Find biggest movers
    const biggestUp = topFTagsResult.rows.find(r => r.trend === 'UP' && parseFloat(r.change_pct) > 10);
    if (biggestUp) {
      insights.push(`F${biggestUp.code} citations up ${biggestUp.change_pct}% vs prior period`);
    }

    const biggestDown = topFTagsResult.rows.find(r => r.trend === 'DOWN' && parseFloat(r.change_pct) < -10);
    if (biggestDown) {
      insights.push(`F${biggestDown.code} citations down ${Math.abs(biggestDown.change_pct)}% vs prior period`);
    }

    const typeBreakdown = typeBreakdownResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        period,
        deficiencyType,
        dataAsOf: maxDate,
        summary: summaryResult.rows[0],
        typeBreakdown: {
          // Note: Type breakdown not available in cms_facility_deficiencies
          // These would require enriching the data with survey_type analysis
          standardOnly: 0,
          complaintOnly: 0,
          both: 0,
          infectionControl: 0,
          total: parseInt(typeBreakdown.total) || 0
        },
        topFTags: topFTagsResult.rows.map(r => ({
          rank: parseInt(r.rank),
          code: `F${r.code}`,
          name: r.name.length > 50 ? r.name.substring(0, 50) + '...' : r.name,
          fullName: r.name, // Full name for tooltips
          category: r.category,
          count: parseInt(r.count),
          priorCount: parseInt(r.prior_count),
          changePct: parseFloat(r.change_pct),
          trend: r.trend
        })),
        monthlyVolume: monthlyVolumeResult.rows.map(r => ({
          month: r.month,
          monthLabel: r.month_label,
          surveys: parseInt(r.surveys),
          totalDefs: parseInt(r.total_defs),
          avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey),
          ijRatePct: parseFloat(r.ij_rate_pct)
        })),
        insights
      }
    });

  } catch (error) {
    console.error('[Survey API] National overview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// STATE DEEP DIVE ENDPOINTS
// ============================================================================

/**
 * GET /api/survey/state/:stateCode
 * Get state-specific survey statistics and comparison to national
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: '90days')
 * - deficiencyType: 'all' | 'standard' | 'complaint' | 'infection' (default: 'all')
 */
router.get('/state/:stateCode', async (req, res) => {
  const { stateCode } = req.params;
  const { period = '90days', deficiencyType = 'all' } = req.query;
  const pool = getSurveyPool();
  const typeFilter = buildDeficiencyTypeFilter(deficiencyType);

  try {
    // Get the most recent data date (data may be stale)
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    const days = periodToDays(period);

    // Run all queries in parallel for performance
    // When filtering by deficiency type, we must query raw data (MV doesn't have type columns)
    const useRawData = deficiencyType !== 'all';

    const [comparisonResult, ftagPrioritiesResult, dayOfWeekResult, monthlyTrendsResult] = await Promise.all([
      // Get state comparison stats
      // Uses raw table with type filter, or MV for 'all' types
      useRawData ? pool.query(`
        WITH state_stats AS (
          SELECT
            COUNT(DISTINCT (d.federal_provider_number, d.survey_date)) as surveys,
            COUNT(*) as total_defs,
            ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT (d.federal_provider_number, d.survey_date)), 0), 1) as avg_defs,
            ROUND(SUM(CASE WHEN d.scope_severity IN ('J', 'K', 'L') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 4) as ij_rate
          FROM cms_facility_deficiencies d
          JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND d.survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
        ),
        national_stats AS (
          SELECT
            COUNT(DISTINCT (federal_provider_number, survey_date)) as surveys,
            COUNT(*) as total_defs,
            ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT (federal_provider_number, survey_date)), 0), 1) as avg_defs,
            ROUND(SUM(CASE WHEN scope_severity IN ('J', 'K', 'L') THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 4) as ij_rate
          FROM cms_facility_deficiencies
          WHERE survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
        )
        SELECT
          s.surveys as state_surveys,
          n.surveys as national_surveys,
          s.avg_defs as state_avg_defs,
          n.avg_defs as national_avg_defs,
          s.ij_rate as state_ij_rate,
          n.ij_rate as national_ij_rate
        FROM state_stats s, national_stats n
      `, [stateCode, maxDate]) : pool.query(`
        WITH state_stats AS (
          SELECT
            COUNT(*) as surveys,
            SUM(deficiency_count) as total_defs,
            ROUND(AVG(deficiency_count)::numeric, 1) as avg_defs,
            ROUND((SUM(ij_count)::numeric / NULLIF(SUM(deficiency_count), 0))::numeric, 4) as ij_rate
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND mv.survey_date >= $2::date - INTERVAL '${days} days'
        ),
        national_stats AS (
          SELECT
            COUNT(*) as surveys,
            SUM(deficiency_count) as total_defs,
            ROUND(AVG(deficiency_count)::numeric, 1) as avg_defs,
            ROUND((SUM(ij_count)::numeric / NULLIF(SUM(deficiency_count), 0))::numeric, 4) as ij_rate
          FROM mv_survey_aggregates
          WHERE survey_date >= $2::date - INTERVAL '${days} days'
        )
        SELECT
          s.surveys as state_surveys,
          n.surveys as national_surveys,
          s.avg_defs as state_avg_defs,
          n.avg_defs as national_avg_defs,
          s.ij_rate as state_ij_rate,
          n.ij_rate as national_ij_rate
        FROM state_stats s, national_stats n
      `, [stateCode, maxDate]),

      // Get state F-tag priorities vs national ranking
      pool.query(`
        WITH state_ftags AS (
          SELECT
            d.deficiency_tag,
            COUNT(*) as state_count,
            ROUND((COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100)::numeric, 1) as state_pct
          FROM cms_facility_deficiencies d
          JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND d.survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY d.deficiency_tag
        ),
        national_ftags AS (
          SELECT
            deficiency_tag,
            COUNT(*) as national_count,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as national_rank
          FROM cms_facility_deficiencies
          WHERE survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY deficiency_tag
        )
        SELECT
          ROW_NUMBER() OVER (ORDER BY s.state_count DESC) as state_rank,
          s.deficiency_tag as code,
          COALESCE(cd.description, 'Unknown') as name,
          s.state_count,
          s.state_pct,
          COALESCE(n.national_rank, 999) as national_rank,
          (ROW_NUMBER() OVER (ORDER BY s.state_count DESC))::int - COALESCE(n.national_rank, 999)::int as delta
        FROM state_ftags s
        LEFT JOIN national_ftags n ON s.deficiency_tag = n.deficiency_tag
        LEFT JOIN citation_descriptions cd ON s.deficiency_tag = cd.deficiency_tag
        ORDER BY s.state_count DESC
        LIMIT 10
      `, [stateCode, maxDate]),

      // Get day of week distribution
      // Uses raw table with type filter, or MV for 'all' types
      useRawData ? pool.query(`
        WITH state_dow AS (
          SELECT
            EXTRACT(DOW FROM d.survey_date) as dow,
            COUNT(DISTINCT (d.federal_provider_number, d.survey_date)) as surveys
          FROM cms_facility_deficiencies d
          JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND d.survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY EXTRACT(DOW FROM d.survey_date)
        ),
        national_dow AS (
          SELECT
            EXTRACT(DOW FROM survey_date) as dow,
            COUNT(DISTINCT (federal_provider_number, survey_date)) as surveys
          FROM cms_facility_deficiencies
          WHERE survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY EXTRACT(DOW FROM survey_date)
        )
        SELECT
          CASE s.dow
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
          END as day,
          CASE s.dow
            WHEN 0 THEN 'Sun'
            WHEN 1 THEN 'Mon'
            WHEN 2 THEN 'Tue'
            WHEN 3 THEN 'Wed'
            WHEN 4 THEN 'Thu'
            WHEN 5 THEN 'Fri'
            WHEN 6 THEN 'Sat'
          END as short_day,
          ROUND((s.surveys::numeric / SUM(s.surveys) OVER () * 100)::numeric, 0) as pct,
          ROUND((n.surveys::numeric / SUM(n.surveys) OVER () * 100)::numeric, 0) as national_pct
        FROM state_dow s
        LEFT JOIN national_dow n ON s.dow = n.dow
        ORDER BY s.dow
      `, [stateCode, maxDate]) : pool.query(`
        WITH state_dow AS (
          SELECT
            day_of_week as dow,
            COUNT(*) as surveys
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND mv.survey_date >= $2::date - INTERVAL '${days} days'
          GROUP BY day_of_week
        ),
        national_dow AS (
          SELECT
            day_of_week as dow,
            COUNT(*) as surveys
          FROM mv_survey_aggregates
          WHERE survey_date >= $2::date - INTERVAL '${days} days'
          GROUP BY day_of_week
        )
        SELECT
          CASE s.dow
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
          END as day,
          CASE s.dow
            WHEN 0 THEN 'Sun'
            WHEN 1 THEN 'Mon'
            WHEN 2 THEN 'Tue'
            WHEN 3 THEN 'Wed'
            WHEN 4 THEN 'Thu'
            WHEN 5 THEN 'Fri'
            WHEN 6 THEN 'Sat'
          END as short_day,
          ROUND((s.surveys::numeric / SUM(s.surveys) OVER () * 100)::numeric, 0) as pct,
          ROUND((n.surveys::numeric / SUM(n.surveys) OVER () * 100)::numeric, 0) as national_pct
        FROM state_dow s
        LEFT JOIN national_dow n ON s.dow = n.dow
        ORDER BY s.dow
      `, [stateCode, maxDate]),

      // Get monthly trends for state
      // Uses raw table with type filter, or MV for 'all' types
      useRawData ? pool.query(`
        WITH state_facilities AS (
          SELECT COUNT(DISTINCT federal_provider_number) as facility_count
          FROM snf_facilities
          WHERE state = $1
        ),
        monthly_data AS (
          SELECT
            TO_CHAR(d.survey_date, 'YYYY-MM') as month,
            TO_CHAR(d.survey_date, 'Mon') as month_label,
            COUNT(DISTINCT (d.federal_provider_number, d.survey_date)) as surveys,
            COUNT(*) as total_defs,
            SUM(CASE WHEN is_complaint_deficiency THEN 1 ELSE 0 END) as complaint_defs
          FROM cms_facility_deficiencies d
          JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND d.survey_date >= $2::date - INTERVAL '${days} days'
            ${typeFilter}
          GROUP BY TO_CHAR(d.survey_date, 'YYYY-MM'), TO_CHAR(d.survey_date, 'Mon')
        )
        SELECT
          md.month,
          md.month_label,
          md.surveys,
          md.total_defs,
          ROUND(md.total_defs::numeric / NULLIF(md.surveys, 0), 1) as avg_defs_per_survey,
          md.complaint_defs as complaint_surveys,
          sf.facility_count,
          ROUND((md.complaint_defs::numeric / NULLIF(sf.facility_count, 0))::numeric, 2) as complaint_surveys_per_facility
        FROM monthly_data md
        CROSS JOIN state_facilities sf
        ORDER BY md.month
      `, [stateCode, maxDate]) : pool.query(`
        WITH state_facilities AS (
          SELECT COUNT(DISTINCT federal_provider_number) as facility_count
          FROM snf_facilities
          WHERE state = $1
        ),
        monthly_data AS (
          SELECT
            mv.year_month as month,
            TO_CHAR(mv.survey_date, 'Mon') as month_label,
            COUNT(*) as surveys,
            SUM(mv.deficiency_count) as total_defs,
            0 as complaint_surveys
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND mv.survey_date >= $2::date - INTERVAL '${days} days'
          GROUP BY mv.year_month, TO_CHAR(mv.survey_date, 'Mon')
        )
        SELECT
          md.month,
          md.month_label,
          md.surveys,
          md.total_defs,
          ROUND(md.total_defs::numeric / NULLIF(md.surveys, 0), 1) as avg_defs_per_survey,
          md.complaint_surveys,
          sf.facility_count,
          ROUND((md.complaint_surveys::numeric / NULLIF(sf.facility_count, 0))::numeric, 2) as complaint_surveys_per_facility
        FROM monthly_data md
        CROSS JOIN state_facilities sf
        ORDER BY md.month
      `, [stateCode, maxDate])
    ]);

    const comparison = comparisonResult.rows[0] || {};

    // Generate state-specific insights
    const insights = [];
    const topStateTag = ftagPrioritiesResult.rows[0];
    if (topStateTag && topStateTag.national_rank) {
      const diff = parseInt(topStateTag.state_rank) - parseInt(topStateTag.national_rank);
      if (Math.abs(diff) >= 3) {
        insights.push(`F${topStateTag.code} ranks #${topStateTag.state_rank} in ${stateCode} vs #${topStateTag.national_rank} nationally`);
      }
    }

    if (comparison.state_avg_defs && comparison.national_avg_defs) {
      const avgDiff = parseFloat(comparison.state_avg_defs) - parseFloat(comparison.national_avg_defs);
      if (Math.abs(avgDiff) >= 0.5) {
        insights.push(`${stateCode} averages ${comparison.state_avg_defs} deficiencies per survey (national: ${comparison.national_avg_defs})`);
      }
    }

    // Calculate peak day from state distribution
    const dayOfWeekData = dayOfWeekResult.rows.map(r => ({
      day: r.day,
      shortDay: r.short_day,
      pct: parseInt(r.pct) || 0,
      nationalPct: parseInt(r.national_pct) || 0
    }));

    // Find state peak day
    const statePeak = dayOfWeekData.reduce((max, r) => r.pct > max.pct ? r : max, { pct: 0 });
    // Find national peak day
    const nationalPeak = dayOfWeekData.reduce((max, r) => r.nationalPct > max.nationalPct ? r : max, { nationalPct: 0 });

    // State name lookup
    const stateNames = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
    };

    res.json({
      success: true,
      data: {
        state: stateCode,
        stateName: stateNames[stateCode] || stateCode,
        period,
        deficiencyType,
        dataAsOf: maxDate,
        comparison: {
          surveys: {
            state: parseInt(comparison.state_surveys) || 0,
            national: parseInt(comparison.national_surveys) || 0
          },
          avgDeficiencies: {
            state: parseFloat(comparison.state_avg_defs) || 0,
            national: parseFloat(comparison.national_avg_defs) || 0,
            delta: parseFloat(comparison.state_avg_defs) - parseFloat(comparison.national_avg_defs) || 0,
            status: parseFloat(comparison.state_avg_defs) > parseFloat(comparison.national_avg_defs) * 1.1 ? 'ABOVE' :
                    parseFloat(comparison.state_avg_defs) < parseFloat(comparison.national_avg_defs) * 0.9 ? 'BELOW' : 'AT'
          },
          ijRate: {
            state: parseFloat(comparison.state_ij_rate) || 0,
            national: parseFloat(comparison.national_ij_rate) || 0,
            delta: parseFloat(comparison.state_ij_rate) - parseFloat(comparison.national_ij_rate) || 0,
            status: parseFloat(comparison.state_ij_rate) > parseFloat(comparison.national_ij_rate) * 1.2 ? 'ABOVE' : 'AT'
          }
        },
        ftagPriorities: ftagPrioritiesResult.rows.map(r => ({
          stateRank: parseInt(r.state_rank),
          code: `F${r.code}`,
          name: r.name.length > 40 ? r.name.substring(0, 40) + '...' : r.name,
          fullName: r.name, // Full name for tooltips
          stateCount: parseInt(r.state_count),
          statePct: parseFloat(r.state_pct),
          nationalRank: parseInt(r.national_rank),
          delta: parseInt(r.delta)
        })),
        dayOfWeekDistribution: dayOfWeekData,
        peakDay: statePeak.day || 'Unknown',
        peakDayPct: statePeak.pct,
        nationalPeakDay: nationalPeak.day || 'Unknown',
        nationalPeakPct: nationalPeak.nationalPct,
        insights,
        monthlyTrends: monthlyTrendsResult.rows.map(r => ({
          month: r.month,
          monthLabel: r.month_label,
          surveys: parseInt(r.surveys) || 0,
          totalDefs: parseInt(r.total_defs) || 0,
          avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey) || 0,
          complaintSurveys: parseInt(r.complaint_surveys) || 0,
          facilityCount: parseInt(r.facility_count) || 0,
          complaintSurveysPerFacility: parseFloat(r.complaint_surveys_per_facility) || 0
        }))
      }
    });

  } catch (error) {
    console.error('[Survey API] State deep dive error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/state/:stateCode/facilities
 * Get list of facilities surveyed in a state with their deficiency details
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: '90days')
 * - deficiencyType: 'all' | 'standard' | 'complaint' | 'infection' (default: 'all')
 * - page: Page number for pagination (default: 1)
 * - limit: Number of results per page (default: 50)
 */
router.get('/state/:stateCode/facilities', async (req, res) => {
  const { stateCode } = req.params;
  const { period = '90days', deficiencyType = 'all', page = 1, limit = 50 } = req.query;
  const surveyPool = getSurveyPool();
  const typeFilter = buildDeficiencyTypeFilter(deficiencyType);

  try {
    // Get the most recent data date
    const maxDateResult = await surveyPool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    const days = periodToDays(period);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get facilities with survey counts
    const facilitiesResult = await surveyPool.query(`
      WITH facility_surveys AS (
        SELECT
          d.federal_provider_number,
          f.facility_name,
          f.city,
          f.county,
          d.survey_date,
          COUNT(*) as deficiency_count,
          COUNT(*) FILTER (WHERE d.scope_severity IN ('J', 'K', 'L')) as ij_count,
          ARRAY_AGG(DISTINCT d.deficiency_tag ORDER BY d.deficiency_tag) as deficiency_tags
        FROM cms_facility_deficiencies d
        JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
        WHERE f.state = $1
          AND d.survey_date >= $2::date - INTERVAL '${days} days'
          ${typeFilter}
        GROUP BY d.federal_provider_number, f.facility_name, f.city, f.county, d.survey_date
      )
      SELECT
        federal_provider_number as ccn,
        facility_name,
        city,
        county,
        survey_date,
        deficiency_count,
        ij_count,
        deficiency_tags,
        $2::date - survey_date as days_ago
      FROM facility_surveys
      ORDER BY survey_date DESC, deficiency_count DESC
      LIMIT $3 OFFSET $4
    `, [stateCode, maxDate, parseInt(limit), offset]);

    // Get total count for pagination - uses materialized view
    const countResult = await surveyPool.query(`
      SELECT COUNT(*) as total
      FROM mv_survey_aggregates mv
      JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
      WHERE f.state = $1
        AND mv.survey_date >= $2::date - INTERVAL '${days} days'
    `, [stateCode, maxDate]);

    const total = parseInt(countResult.rows[0]?.total) || 0;

    res.json({
      success: true,
      data: {
        state: stateCode,
        period,
        deficiencyType,
        dataAsOf: maxDate,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        facilities: facilitiesResult.rows.map(r => ({
          ccn: r.ccn,
          name: r.facility_name,
          city: r.city,
          county: r.county,
          surveyDate: r.survey_date,
          daysAgo: parseInt(r.days_ago),
          deficiencyCount: parseInt(r.deficiency_count),
          ijCount: parseInt(r.ij_count),
          deficiencyTags: r.deficiency_tags || []
        }))
      }
    });

  } catch (error) {
    console.error('[Survey API] State facilities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/deficiency/:tag
 * Get deficiency tag details including description
 */
router.get('/deficiency/:tag', async (req, res) => {
  const { tag } = req.params;
  const surveyPool = getSurveyPool();

  try {
    // Clean the tag - remove F prefix if present
    const cleanTag = tag.replace(/^F/i, '');

    const result = await surveyPool.query(`
      SELECT
        deficiency_tag,
        description,
        category
      FROM citation_descriptions
      WHERE deficiency_tag = $1
    `, [cleanTag]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          tag: `F${cleanTag}`,
          description: 'No description available',
          category: 'Unknown'
        }
      });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        tag: `F${row.deficiency_tag}`,
        description: row.description,
        category: row.category
      }
    });

  } catch (error) {
    console.error('[Survey API] Deficiency details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// REGIONAL HOT SPOTS ENDPOINTS
// ============================================================================

/**
 * GET /api/survey/regional-hotspots/national
 * Get national-level regional survey activity hot spots (top counties/CBSAs across all states)
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: '90days')
 * - level: 'county' | 'cbsa' (default: 'county')
 * - deficiencyType: 'all' | 'standard' | 'complaint' | 'infection' (default: 'all')
 * - sortBy: 'deficiencies' | 'surveys' | 'avgDefsPerSurvey' (default: 'deficiencies')
 */
router.get('/regional-hotspots/national', async (req, res) => {
  const { period = '90days', level = 'county', deficiencyType = 'all', sortBy = 'deficiencies' } = req.query;
  const pool = getSurveyPool();
  const typeFilter = buildDeficiencyTypeFilter(deficiencyType);

  // Map sortBy to SQL column names
  const sortColumnMap = {
    'deficiencies': 'deficiencies DESC',
    'surveys': 'surveys DESC',
    'avgDefsPerSurvey': 'avg_defs_per_survey DESC'
  };
  const orderByClause = sortColumnMap[sortBy] || 'deficiencies DESC';

  // Minimum surveys threshold when sorting by rate (to avoid tiny samples with skewed averages)
  const minSurveys = sortBy === 'avgDefsPerSurvey' ? 10 : 1;

  try {
    // Get the most recent data date
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    const days = periodToDays(period);

    if (level === 'cbsa') {
      // National CBSA-level aggregation - uses materialized view for performance
      const hotSpotsResult = await pool.query(`
        WITH cbsa_stats AS (
          SELECT
            f.cbsa_code,
            c.cbsa_title as cbsa_name,
            f.state,
            COUNT(*) as surveys,
            SUM(mv.deficiency_count) as deficiencies,
            COUNT(DISTINCT f.federal_provider_number) as facilities,
            ROUND(AVG(mv.deficiency_count)::numeric, 1) as avg_defs_per_survey,
            SUM(mv.ij_count) as ij_count
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          LEFT JOIN cbsas c ON f.cbsa_code = c.cbsa_code
          WHERE mv.survey_date >= $1::date - INTERVAL '${days} days'
            AND f.cbsa_code IS NOT NULL
          GROUP BY f.cbsa_code, c.cbsa_title, f.state
        )
        SELECT
          cbsa_code,
          COALESCE(cbsa_name, 'Unknown CBSA') as region_name,
          state,
          surveys,
          deficiencies,
          facilities,
          avg_defs_per_survey,
          ij_count,
          ROUND((ij_count::numeric / NULLIF(deficiencies, 0)) * 100, 1) as ij_pct
        FROM cbsa_stats
        WHERE surveys >= ${minSurveys}
        ORDER BY ${orderByClause}
        LIMIT 25
      `, [maxDate]);

      // Get national total for comparison
      const nationalTotalResult = await pool.query(`
        SELECT
          COUNT(*) as total_surveys,
          SUM(deficiency_count) as total_deficiencies
        FROM mv_survey_aggregates
        WHERE survey_date >= $1::date - INTERVAL '${days} days'
      `, [maxDate]);

      const nationalTotal = nationalTotalResult.rows[0] || { total_surveys: 0, total_deficiencies: 0 };

      res.json({
        success: true,
        data: {
          scope: 'national',
          period,
          level: 'cbsa',
          dataAsOf: maxDate,
          nationalTotal: {
            surveys: parseInt(nationalTotal.total_surveys) || 0,
            deficiencies: parseInt(nationalTotal.total_deficiencies) || 0
          },
          hotSpots: hotSpotsResult.rows.map(r => ({
            code: r.cbsa_code,
            name: r.region_name,
            state: r.state,
            surveys: parseInt(r.surveys),
            deficiencies: parseInt(r.deficiencies),
            facilities: parseInt(r.facilities),
            avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey) || 0,
            ijCount: parseInt(r.ij_count),
            ijPct: parseFloat(r.ij_pct) || 0,
            pctOfNational: Math.round((parseInt(r.deficiencies) / parseInt(nationalTotal.total_deficiencies)) * 100) || 0
          }))
        }
      });
    } else {
      // National County-level aggregation - uses materialized view for performance
      const hotSpotsResult = await pool.query(`
        WITH county_stats AS (
          SELECT
            f.county,
            f.state,
            COUNT(*) as surveys,
            SUM(mv.deficiency_count) as deficiencies,
            COUNT(DISTINCT f.federal_provider_number) as facilities,
            ROUND(AVG(mv.deficiency_count)::numeric, 1) as avg_defs_per_survey,
            SUM(mv.ij_count) as ij_count
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          WHERE mv.survey_date >= $1::date - INTERVAL '${days} days'
            AND f.county IS NOT NULL
          GROUP BY f.county, f.state
        )
        SELECT
          county as region_name,
          state,
          surveys,
          deficiencies,
          facilities,
          avg_defs_per_survey,
          ij_count,
          ROUND((ij_count::numeric / NULLIF(deficiencies, 0)) * 100, 1) as ij_pct
        FROM county_stats
        WHERE surveys >= ${minSurveys}
        ORDER BY ${orderByClause}
        LIMIT 25
      `, [maxDate]);

      // Get national total for comparison
      const nationalTotalResult = await pool.query(`
        SELECT
          COUNT(*) as total_surveys,
          SUM(deficiency_count) as total_deficiencies
        FROM mv_survey_aggregates
        WHERE survey_date >= $1::date - INTERVAL '${days} days'
      `, [maxDate]);

      const nationalTotal = nationalTotalResult.rows[0] || { total_surveys: 0, total_deficiencies: 0 };

      res.json({
        success: true,
        data: {
          scope: 'national',
          period,
          level: 'county',
          dataAsOf: maxDate,
          nationalTotal: {
            surveys: parseInt(nationalTotal.total_surveys) || 0,
            deficiencies: parseInt(nationalTotal.total_deficiencies) || 0
          },
          hotSpots: hotSpotsResult.rows.map(r => ({
            name: r.region_name,
            state: r.state,
            surveys: parseInt(r.surveys),
            deficiencies: parseInt(r.deficiencies),
            facilities: parseInt(r.facilities),
            avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey) || 0,
            ijCount: parseInt(r.ij_count),
            ijPct: parseFloat(r.ij_pct) || 0,
            pctOfNational: Math.round((parseInt(r.deficiencies) / parseInt(nationalTotal.total_deficiencies)) * 100) || 0
          }))
        }
      });
    }
  } catch (error) {
    console.error('[Survey API] National regional hotspots error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/regional-hotspots/:stateCode
 * Get regional survey activity hot spots for a state
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: '90days')
 * - level: 'county' | 'cbsa' (default: 'county')
 * - deficiencyType: 'all' | 'standard' | 'complaint' | 'infection' (default: 'all')
 */
router.get('/regional-hotspots/:stateCode', async (req, res) => {
  const { stateCode } = req.params;
  const { period = '90days', level = 'county', deficiencyType = 'all' } = req.query;
  const pool = getSurveyPool();
  const typeFilter = buildDeficiencyTypeFilter(deficiencyType);

  try {
    // Get the most recent data date
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    const days = periodToDays(period);

    if (level === 'cbsa') {
      // CBSA-level aggregation - uses materialized view for performance
      const hotSpotsResult = await pool.query(`
        WITH cbsa_stats AS (
          SELECT
            f.cbsa_code,
            c.cbsa_title as cbsa_name,
            COUNT(*) as surveys,
            SUM(mv.deficiency_count) as deficiencies,
            COUNT(DISTINCT f.federal_provider_number) as facilities,
            ROUND(AVG(mv.deficiency_count)::numeric, 1) as avg_defs_per_survey,
            SUM(mv.ij_count) as ij_count
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          LEFT JOIN cbsas c ON f.cbsa_code = c.cbsa_code
          WHERE f.state = $1
            AND mv.survey_date >= $2::date - INTERVAL '${days} days'
            AND f.cbsa_code IS NOT NULL
          GROUP BY f.cbsa_code, c.cbsa_title
        )
        SELECT
          cbsa_code,
          COALESCE(cbsa_name, 'Unknown CBSA') as region_name,
          surveys,
          deficiencies,
          facilities,
          avg_defs_per_survey,
          ij_count,
          ROUND((ij_count::numeric / NULLIF(deficiencies, 0)) * 100, 1) as ij_pct
        FROM cbsa_stats
        ORDER BY deficiencies DESC
        LIMIT 15
      `, [stateCode, maxDate]);

      // Get state total for comparison - uses materialized view
      const stateTotalResult = await pool.query(`
        SELECT
          COUNT(*) as total_surveys,
          SUM(mv.deficiency_count) as total_deficiencies
        FROM mv_survey_aggregates mv
        JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
        WHERE f.state = $1
          AND mv.survey_date >= $2::date - INTERVAL '${days} days'
      `, [stateCode, maxDate]);

      const stateTotal = stateTotalResult.rows[0] || { total_surveys: 0, total_deficiencies: 0 };

      res.json({
        success: true,
        data: {
          state: stateCode,
          period,
          level: 'cbsa',
          dataAsOf: maxDate,
          stateTotal: {
            surveys: parseInt(stateTotal.total_surveys) || 0,
            deficiencies: parseInt(stateTotal.total_deficiencies) || 0
          },
          hotSpots: hotSpotsResult.rows.map(r => ({
            code: r.cbsa_code,
            name: r.region_name,
            surveys: parseInt(r.surveys),
            deficiencies: parseInt(r.deficiencies),
            facilities: parseInt(r.facilities),
            avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey) || 0,
            ijCount: parseInt(r.ij_count),
            ijPct: parseFloat(r.ij_pct) || 0,
            pctOfState: Math.round((parseInt(r.deficiencies) / parseInt(stateTotal.total_deficiencies)) * 100) || 0
          }))
        }
      });
    } else {
      // County-level aggregation (default) - uses materialized view for performance
      const hotSpotsResult = await pool.query(`
        WITH county_stats AS (
          SELECT
            f.county,
            COUNT(*) as surveys,
            SUM(mv.deficiency_count) as deficiencies,
            COUNT(DISTINCT f.federal_provider_number) as facilities,
            ROUND(AVG(mv.deficiency_count)::numeric, 1) as avg_defs_per_survey,
            SUM(mv.ij_count) as ij_count
          FROM mv_survey_aggregates mv
          JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
          WHERE f.state = $1
            AND mv.survey_date >= $2::date - INTERVAL '${days} days'
            AND f.county IS NOT NULL
          GROUP BY f.county
        )
        SELECT
          county as region_name,
          surveys,
          deficiencies,
          facilities,
          avg_defs_per_survey,
          ij_count,
          ROUND((ij_count::numeric / NULLIF(deficiencies, 0)) * 100, 1) as ij_pct
        FROM county_stats
        ORDER BY deficiencies DESC
        LIMIT 20
      `, [stateCode, maxDate]);

      // Get state total for comparison - uses materialized view
      const stateTotalResult = await pool.query(`
        SELECT
          COUNT(*) as total_surveys,
          SUM(mv.deficiency_count) as total_deficiencies
        FROM mv_survey_aggregates mv
        JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
        WHERE f.state = $1
          AND mv.survey_date >= $2::date - INTERVAL '${days} days'
      `, [stateCode, maxDate]);

      const stateTotal = stateTotalResult.rows[0] || { total_surveys: 0, total_deficiencies: 0 };

      res.json({
        success: true,
        data: {
          state: stateCode,
          period,
          level: 'county',
          dataAsOf: maxDate,
          stateTotal: {
            surveys: parseInt(stateTotal.total_surveys) || 0,
            deficiencies: parseInt(stateTotal.total_deficiencies) || 0
          },
          hotSpots: hotSpotsResult.rows.map(r => ({
            name: r.region_name,
            surveys: parseInt(r.surveys),
            deficiencies: parseInt(r.deficiencies),
            facilities: parseInt(r.facilities),
            avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey) || 0,
            ijCount: parseInt(r.ij_count),
            ijPct: parseFloat(r.ij_pct) || 0,
            pctOfState: Math.round((parseInt(r.deficiencies) / parseInt(stateTotal.total_deficiencies)) * 100) || 0
          }))
        }
      });
    }

  } catch (error) {
    console.error('[Survey API] Regional hot spots error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// F-TAG TRENDS ENDPOINTS
// ============================================================================

/**
 * Convert period to months for trend analysis
 * @param {string} period - '30days' | '90days' | '12months' | 'all'
 * @returns {number} Number of months
 */
const periodToMonths = (period) => {
  switch (period) {
    case '30days': return 3;     // Show 3 months for context even with 30-day filter
    case '90days': return 6;     // Show 6 months for 90-day view
    case '12months': return 18;  // Show 18 months for yearly view
    case 'all': return 60;       // 5 years
    default: return 60;          // Default to 5 years
  }
};

/**
 * GET /api/survey/ftag-trends
 * Get F-tag trend data over time
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: 'all')
 * - state: State code filter (optional, default: national)
 * - ftags: Comma-separated F-tag codes (optional)
 * - deficiencyType: 'all' | 'standard' | 'complaint' | 'infection' (default: 'all')
 */
router.get('/ftag-trends', async (req, res) => {
  const { state, ftags, deficiencyType = 'all', period = 'all' } = req.query;
  const pool = getSurveyPool();
  const typeFilter = buildDeficiencyTypeFilter(deficiencyType);
  const months = periodToMonths(period);

  try {
    // Get the most recent data date (data may be stale)
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    // Get monthly counts for top F-tags over the selected period
    let query = `
      SELECT
        TO_CHAR(d.survey_date, 'YYYY-MM') as month,
        TO_CHAR(d.survey_date, 'Mon YY') as month_label,
        d.deficiency_tag,
        COUNT(*) as count
      FROM cms_facility_deficiencies d
      ${state && state !== 'ALL' ? 'JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number' : ''}
      WHERE d.survey_date >= $${state && state !== 'ALL' ? 2 : 1}::date - INTERVAL '${months} months'
        ${state && state !== 'ALL' ? 'AND f.state = $1' : ''}
        ${ftags ? `AND d.deficiency_tag IN (${ftags.split(',').map((_, i) => `$${state && state !== 'ALL' ? i + 3 : i + 2}`).join(',')})` : ''}
        ${typeFilter}
      GROUP BY TO_CHAR(d.survey_date, 'YYYY-MM'), TO_CHAR(d.survey_date, 'Mon YY'), d.deficiency_tag
      ORDER BY month, d.deficiency_tag
    `;

    const params = [];
    if (state && state !== 'ALL') params.push(state);
    params.push(maxDate);
    if (ftags) params.push(...ftags.split(',').map(t => t.replace('F', '')));

    const trendsResult = await pool.query(query, params);

    // Get F-tag details for the tags we're showing
    const ftagCodesInData = [...new Set(trendsResult.rows.map(r => r.deficiency_tag))];

    // Build params for ftagDetailsResult query
    // If state is provided: [state, maxDate, ftagCodesInData] -> $1=state, $2=maxDate, $3=ftagCodesInData
    // If no state: [maxDate, ftagCodesInData] -> $1=maxDate, $2=ftagCodesInData
    const ftagDetailsParams = state && state !== 'ALL'
      ? [state, maxDate, ftagCodesInData]
      : [maxDate, ftagCodesInData];
    const maxDateParam = state && state !== 'ALL' ? '$2' : '$1';
    const ftagArrayParam = state && state !== 'ALL' ? '$3' : '$2';

    const ftagDetailsResult = await pool.query(`
      WITH ftag_stats AS (
        SELECT
          d.deficiency_tag,
          COUNT(*) as current_count,
          COUNT(*) FILTER (WHERE d.survey_date >= ${maxDateParam}::date - INTERVAL '6 months') as recent_count,
          COUNT(*) FILTER (WHERE d.survey_date >= ${maxDateParam}::date - INTERVAL '12 months'
                           AND d.survey_date < ${maxDateParam}::date - INTERVAL '6 months') as prior_count
        FROM cms_facility_deficiencies d
        ${state && state !== 'ALL' ? 'JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number' : ''}
        WHERE d.survey_date >= ${maxDateParam}::date - INTERVAL '12 months'
          ${state && state !== 'ALL' ? 'AND f.state = $1' : ''}
          ${typeFilter}
        GROUP BY d.deficiency_tag
      ),
      severity_dist AS (
        SELECT
          deficiency_tag,
          scope_severity,
          COUNT(*) as count
        FROM cms_facility_deficiencies
        WHERE survey_date >= ${maxDateParam}::date - INTERVAL '12 months'
          ${typeFilter}
        GROUP BY deficiency_tag, scope_severity
      )
      SELECT
        s.deficiency_tag as code,
        cd.description as name,
        cd.category,
        s.current_count,
        s.recent_count,
        s.prior_count,
        CASE
          WHEN s.prior_count = 0 THEN 0
          ELSE ROUND(((s.recent_count - s.prior_count)::numeric / s.prior_count * 100)::numeric, 1)
        END as change_pct,
        CASE
          WHEN s.prior_count = 0 THEN 'NEW'
          WHEN s.recent_count > s.prior_count * 1.05 THEN 'UP'
          WHEN s.recent_count < s.prior_count * 0.95 THEN 'DOWN'
          ELSE 'STABLE'
        END as trend
      FROM ftag_stats s
      LEFT JOIN citation_descriptions cd ON s.deficiency_tag = cd.deficiency_tag
      WHERE s.deficiency_tag = ANY(${ftagArrayParam}::text[])
      ORDER BY s.current_count DESC
    `, ftagDetailsParams);

    // Transform trend data into chart format
    const monthsSet = [...new Set(trendsResult.rows.map(r => r.month))].sort();
    const trendData = monthsSet.map(month => {
      const monthData = { month, monthLabel: trendsResult.rows.find(r => r.month === month)?.month_label };
      trendsResult.rows.filter(r => r.month === month).forEach(r => {
        monthData[`F${r.deficiency_tag}`] = parseInt(r.count);
      });
      return monthData;
    });

    // Pre-defined colors for chart lines
    const FTAG_COLORS = [
      '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    // Build ftagDetails object
    const ftagDetails = ftagDetailsResult.rows.reduce((acc, r) => {
      acc[`F${r.code}`] = {
        code: `F${r.code}`,
        name: r.name || 'Unknown',
        category: r.category || 'Unknown',
        currentCount: parseInt(r.current_count),
        changePct: parseFloat(r.change_pct),
        trend: r.trend
      };
      return acc;
    }, {});

    // Build availableFTags array for the chart selector
    const availableFTags = ftagDetailsResult.rows.map((r, i) => ({
      code: `F${r.code}`,
      name: r.name || 'Unknown',
      color: FTAG_COLORS[i % FTAG_COLORS.length]
    }));

    // Generate emerging patterns from trend data
    const emergingPatterns = ftagDetailsResult.rows
      .filter(r => r.trend === 'UP' && parseFloat(r.change_pct) > 5)
      .slice(0, 5)
      .map(r => ({
        code: `F${r.code}`,
        name: r.name || 'Unknown',
        current: parseInt(r.recent_count) || 0,
        prior: parseInt(r.prior_count) || 0,
        changePct: parseFloat(r.change_pct) || 0,
        ijPct: 3, // Placeholder - would need separate IJ query
        insight: `F${r.code} citations up ${Math.abs(parseFloat(r.change_pct)).toFixed(1)}% - increased regulatory focus`
      }));

    // Generate correlation insights
    const correlationInsights = [];
    if (ftagDetailsResult.rows.length >= 2) {
      const top2 = ftagDetailsResult.rows.slice(0, 2);
      correlationInsights.push({
        ftags: [top2[0].code, top2[1].code].map(c => `F${c}`),
        insight: `F${top2[0].code} and F${top2[1].code} are frequently cited together`
      });
    }

    res.json({
      success: true,
      data: {
        state: state || 'ALL',
        period,
        months,
        dataAsOf: maxDate,
        trendData,
        ftagDetails,
        availableFTags,
        emergingPatterns,
        correlationInsights
      }
    });

  } catch (error) {
    console.error('[Survey API] F-tag trends error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// FACILITY-LEVEL SURVEY ENDPOINTS
// ============================================================================

/**
 * GET /api/survey/facility/:ccn
 * Get survey intelligence data for a specific facility
 */
router.get('/facility/:ccn', async (req, res) => {
  const { ccn } = req.params;
  const surveyPool = getSurveyPool();
  const facilityPool = getMarketPool();

  try {
    // Get last survey date and days since
    const lastSurveyResult = await surveyPool.query(`
      SELECT
        MAX(survey_date) as last_survey_date,
        CURRENT_DATE - MAX(survey_date) as days_since_survey
      FROM cms_facility_deficiencies
      WHERE federal_provider_number = $1
    `, [ccn]);

    // Get facility's citation history (last 3 years)
    const citationHistoryResult = await surveyPool.query(`
      SELECT
        d.deficiency_tag,
        cd.description as name,
        COUNT(*) as count,
        MAX(d.survey_date) as last_cited,
        ARRAY_AGG(DISTINCT d.scope_severity) as severities
      FROM cms_facility_deficiencies d
      LEFT JOIN citation_descriptions cd ON d.deficiency_tag = cd.deficiency_tag
      WHERE d.federal_provider_number = $1
        AND d.survey_date >= CURRENT_DATE - INTERVAL '3 years'
      GROUP BY d.deficiency_tag, cd.description
      ORDER BY count DESC
      LIMIT 10
    `, [ccn]);

    // Get recent surveys at this facility
    const recentSurveysResult = await surveyPool.query(`
      SELECT
        survey_date,
        COUNT(*) as deficiency_count,
        COUNT(*) FILTER (WHERE scope_severity IN ('J', 'K', 'L')) as ij_count,
        ARRAY_AGG(DISTINCT deficiency_tag ORDER BY deficiency_tag) as ftags
      FROM cms_facility_deficiencies
      WHERE federal_provider_number = $1
      GROUP BY survey_date
      ORDER BY survey_date DESC
      LIMIT 5
    `, [ccn]);

    // Get facility state for regional context
    const facilityResult = await facilityPool.query(`
      SELECT state, county, latitude, longitude
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `, [ccn]);

    const lastSurvey = lastSurveyResult.rows[0];
    const facility = facilityResult.rows[0];

    // Calculate simple risk level based on days since survey
    const daysSince = parseInt(lastSurvey?.days_since_survey) || 0;
    let riskLevel = 'LOW';
    if (daysSince > 365) riskLevel = 'HIGH';
    else if (daysSince > 300) riskLevel = 'ELEVATED';
    else if (daysSince > 240) riskLevel = 'MODERATE';

    res.json({
      success: true,
      data: {
        ccn,
        lastSurveyDate: lastSurvey?.last_survey_date,
        daysSinceSurvey: daysSince,
        riskLevel,
        state: facility?.state,
        county: facility?.county,
        citationHistory: citationHistoryResult.rows.map(r => ({
          code: `F${r.deficiency_tag}`,
          name: r.name || 'Unknown',
          count: parseInt(r.count),
          lastCited: r.last_cited,
          severities: r.severities
        })),
        recentSurveys: recentSurveysResult.rows.map(r => ({
          date: r.survey_date,
          deficiencyCount: parseInt(r.deficiency_count),
          ijCount: parseInt(r.ij_count),
          ftags: r.ftags.map(t => `F${t}`)
        }))
      }
    });

  } catch (error) {
    console.error('[Survey API] Facility survey error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/nearby/:ccn
 * Get recent surveys at facilities near the specified facility
 */
router.get('/nearby/:ccn', async (req, res) => {
  const { ccn } = req.params;
  const { days = 90, radius = 25 } = req.query;
  const surveyPool = getSurveyPool();
  const facilityPool = getMarketPool();

  try {
    // Get facility location
    const facilityResult = await facilityPool.query(`
      SELECT latitude, longitude, state
      FROM snf_facilities
      WHERE federal_provider_number = $1
    `, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    const { latitude, longitude, state } = facilityResult.rows[0];

    if (!latitude || !longitude) {
      return res.json({
        success: true,
        data: {
          ccn,
          facilities: [],
          message: 'Facility location not available'
        }
      });
    }

    // Find nearby facilities with recent surveys using Haversine formula
    // Note: This query joins across tables that exist in both pools (facilities in market, citations in main)
    const nearbyResult = await surveyPool.query(`
      WITH nearby_facilities AS (
        SELECT
          f.federal_provider_number,
          f.facility_name,
          f.city,
          f.state,
          (3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians($2)) * cos(radians(f.latitude)) *
              cos(radians(f.longitude) - radians($3)) +
              sin(radians($2)) * sin(radians(f.latitude))
            ))
          )) as distance_miles
        FROM snf_facilities f
        WHERE f.federal_provider_number != $1
          AND f.latitude IS NOT NULL
          AND f.longitude IS NOT NULL
          AND (3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians($2)) * cos(radians(f.latitude)) *
              cos(radians(f.longitude) - radians($3)) +
              sin(radians($2)) * sin(radians(f.latitude))
            ))
          )) <= $4
      ),
      recent_surveys AS (
        SELECT
          federal_provider_number,
          survey_date,
          COUNT(*) as deficiency_count,
          MODE() WITHIN GROUP (ORDER BY deficiency_tag) as top_ftag
        FROM cms_facility_deficiencies
        WHERE survey_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY federal_provider_number, survey_date
      )
      SELECT
        nf.federal_provider_number as ccn,
        nf.facility_name as name,
        nf.city,
        nf.state,
        ROUND(nf.distance_miles::numeric, 1) as distance,
        rs.survey_date,
        CURRENT_DATE - rs.survey_date as days_ago,
        rs.deficiency_count,
        rs.top_ftag,
        cd.description as top_ftag_description
      FROM nearby_facilities nf
      JOIN recent_surveys rs ON nf.federal_provider_number = rs.federal_provider_number
      LEFT JOIN citation_descriptions cd ON rs.top_ftag = cd.deficiency_tag
      ORDER BY rs.survey_date DESC, nf.distance_miles
      LIMIT 20
    `, [ccn, latitude, longitude, parseInt(radius)]);

    // Generate summary insight
    let summary = null;
    if (nearbyResult.rows.length > 0) {
      const within14 = nearbyResult.rows.filter(r => parseInt(r.days_ago) <= 14).length;
      if (within14 > 0) {
        summary = `${within14} facilities within ${radius} miles surveyed in last 14 days`;
      }
    }

    res.json({
      success: true,
      data: {
        ccn,
        facilityState: state,
        summary,
        facilities: nearbyResult.rows.map(r => ({
          ccn: r.ccn,
          name: r.name,
          city: r.city,
          state: r.state,
          distance: parseFloat(r.distance),
          surveyDate: r.survey_date,
          daysAgo: parseInt(r.days_ago),
          deficiencyCount: parseInt(r.deficiency_count),
          topFTag: r.top_ftag ? `F${r.top_ftag}` : null,
          topFTagDescription: r.top_ftag_description || 'Unknown'
        }))
      }
    });

  } catch (error) {
    console.error('[Survey API] Nearby surveys error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SURVEY INTELLIGENCE ENDPOINTS (for Facility Metrics tab)
// ============================================================================

/**
 * GET /api/survey/facility-intelligence/:ccn
 * Get comprehensive survey intelligence data for Facility Metrics tab
 * Returns data in the format expected by SurveyIntelligenceTab.jsx
 */
router.get('/facility-intelligence/:ccn', async (req, res) => {
  const { ccn } = req.params;
  const surveyPool = getSurveyPool();
  const facilityPool = getMarketPool();

  try {
    // Get the most recent data date (data may be stale)
    const maxDateResult = await surveyPool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    // Get facility basic info
    const facilityResult = await facilityPool.query(`
      SELECT
        f.federal_provider_number as ccn,
        f.facility_name as name,
        f.state,
        f.city,
        f.county,
        f.latitude,
        f.longitude
      FROM snf_facilities f
      WHERE f.federal_provider_number = $1
    `, [ccn]);

    if (facilityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Facility not found'
      });
    }

    const facility = facilityResult.rows[0];

    // Get last survey date and days since
    const lastSurveyResult = await surveyPool.query(`
      SELECT
        MAX(survey_date) as last_survey_date,
        $2::date - MAX(survey_date) as days_since_survey
      FROM cms_facility_deficiencies
      WHERE federal_provider_number = $1
    `, [ccn, maxDate]);

    const lastSurveyDate = lastSurveyResult.rows[0]?.last_survey_date;
    const daysSinceSurvey = parseInt(lastSurveyResult.rows[0]?.days_since_survey) || 0;

    // Calculate risk level based on days since survey
    let riskLevel = 'LOW';
    if (daysSinceSurvey > 365) riskLevel = 'HIGH';
    else if (daysSinceSurvey > 300) riskLevel = 'ELEVATED';
    else if (daysSinceSurvey > 240) riskLevel = 'MODERATE';

    // Calculate simple probability estimates based on days since survey
    // Federal surveys typically occur every 9-15 months (274-456 days)
    const probability7Days = Math.min(0.95, Math.max(0.05, (daysSinceSurvey - 240) / 200));
    const probability14Days = Math.min(0.95, Math.max(0.10, (daysSinceSurvey - 220) / 180));
    const probability30Days = Math.min(0.95, Math.max(0.15, (daysSinceSurvey - 200) / 160));

    // Calculate survey window
    const avgSurveyInterval = 365; // Average is about 1 year
    const windowOpens = lastSurveyDate ? new Date(lastSurveyDate) : null;
    if (windowOpens) {
      windowOpens.setDate(windowOpens.getDate() + 274); // 9 months
    }
    const federalMaximum = lastSurveyDate ? new Date(lastSurveyDate) : null;
    if (federalMaximum) {
      federalMaximum.setDate(federalMaximum.getDate() + 456); // 15 months
    }
    const windowDuration = 456 - 274; // Days in window
    const daysIntoWindow = Math.max(0, daysSinceSurvey - 274);
    const percentThroughWindow = Math.min(100, Math.round((daysIntoWindow / windowDuration) * 100));

    // Get facility's citation history and create prep priorities
    const citationHistoryResult = await surveyPool.query(`
      SELECT
        d.deficiency_tag,
        cd.description as name,
        cd.category,
        COUNT(*) as count,
        MAX(d.survey_date) as last_cited
      FROM cms_facility_deficiencies d
      LEFT JOIN citation_descriptions cd ON d.deficiency_tag = cd.deficiency_tag
      WHERE d.federal_provider_number = $1
        AND d.survey_date >= $2::date - INTERVAL '3 years'
      GROUP BY d.deficiency_tag, cd.description, cd.category
      ORDER BY count DESC
      LIMIT 5
    `, [ccn, maxDate]);

    // Get state/regional F-tag trends for prep priorities
    const regionalTrendsResult = await surveyPool.query(`
      WITH recent_period AS (
        SELECT deficiency_tag, COUNT(*) as recent_count
        FROM cms_facility_deficiencies d
        JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
        WHERE f.state = $1
          AND d.survey_date >= $2::date - INTERVAL '90 days'
        GROUP BY deficiency_tag
      ),
      prior_period AS (
        SELECT deficiency_tag, COUNT(*) as prior_count
        FROM cms_facility_deficiencies d
        JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
        WHERE f.state = $1
          AND d.survey_date >= $2::date - INTERVAL '180 days'
          AND d.survey_date < $2::date - INTERVAL '90 days'
        GROUP BY deficiency_tag
      )
      SELECT
        r.deficiency_tag,
        CASE
          WHEN COALESCE(p.prior_count, 0) = 0 THEN 0
          ELSE ROUND(((r.recent_count - COALESCE(p.prior_count, 0))::numeric / p.prior_count * 100)::numeric, 0)
        END as trend_pct,
        CASE
          WHEN COALESCE(p.prior_count, 0) = 0 THEN 'NEW'
          WHEN r.recent_count > COALESCE(p.prior_count, 0) * 1.1 THEN 'UP'
          WHEN r.recent_count < COALESCE(p.prior_count, 0) * 0.9 THEN 'DOWN'
          ELSE 'STABLE'
        END as trend
      FROM recent_period r
      LEFT JOIN prior_period p ON r.deficiency_tag = p.deficiency_tag
    `, [facility.state, maxDate]);

    const regionalTrends = regionalTrendsResult.rows.reduce((acc, r) => {
      acc[r.deficiency_tag] = { trendPct: parseInt(r.trend_pct), trend: r.trend };
      return acc;
    }, {});

    // Build prep priorities from facility citations + regional trends
    const prepPriorities = citationHistoryResult.rows.map((r, i) => {
      const regional = regionalTrends[r.deficiency_tag] || { trendPct: 0, trend: 'STABLE' };
      let priority = 'MODERATE';
      if (parseInt(r.count) >= 2 || regional.trend === 'UP') priority = 'HIGH';
      if (parseInt(r.count) >= 3 || (regional.trend === 'UP' && regional.trendPct > 15)) priority = 'CRITICAL';

      return {
        priority,
        fTag: `F${r.deficiency_tag}`,
        fTagName: r.name || 'Unknown',
        reason: parseInt(r.count) > 1
          ? `Cited ${r.count}x in last 3 years` + (regional.trend === 'UP' ? ` + trending up ${regional.trendPct}% regionally` : '')
          : regional.trend === 'UP'
            ? `Trending up ${regional.trendPct}% in ${facility.state}`
            : `Previously cited at this facility`,
        facilityCitationCount: parseInt(r.count),
        regionalTrend: regional.trend,
        regionalTrendPct: regional.trendPct
      };
    });

    // Get nearby activity (last 30 days, within 15 miles)
    let nearbyActivity = { summary: null, facilities: [] };

    if (facility.latitude && facility.longitude) {
      const nearbyResult = await surveyPool.query(`
        WITH nearby_facilities AS (
          SELECT
            f.federal_provider_number,
            f.facility_name,
            f.city,
            (3959 * acos(
              LEAST(1.0, GREATEST(-1.0,
                cos(radians($2)) * cos(radians(f.latitude)) *
                cos(radians(f.longitude) - radians($3)) +
                sin(radians($2)) * sin(radians(f.latitude))
              ))
            )) as distance_miles
          FROM snf_facilities f
          WHERE f.federal_provider_number != $1
            AND f.latitude IS NOT NULL
            AND f.longitude IS NOT NULL
        ),
        recent_surveys AS (
          SELECT
            federal_provider_number,
            survey_date,
            COUNT(*) as deficiency_count,
            MODE() WITHIN GROUP (ORDER BY deficiency_tag) as top_ftag
          FROM cms_facility_deficiencies
          WHERE survey_date >= $4::date - INTERVAL '30 days'
          GROUP BY federal_provider_number, survey_date
        )
        SELECT
          nf.federal_provider_number as ccn,
          nf.facility_name as name,
          nf.city,
          ROUND(nf.distance_miles::numeric, 1) as distance,
          rs.survey_date,
          $4::date - rs.survey_date as days_ago,
          rs.deficiency_count,
          rs.top_ftag,
          cd.description as top_ftag_description
        FROM nearby_facilities nf
        JOIN recent_surveys rs ON nf.federal_provider_number = rs.federal_provider_number
        LEFT JOIN citation_descriptions cd ON rs.top_ftag = cd.deficiency_tag
        WHERE nf.distance_miles <= 15
        ORDER BY rs.survey_date DESC
        LIMIT 5
      `, [ccn, facility.latitude, facility.longitude, maxDate]);

      if (nearbyResult.rows.length > 0) {
        const within14Days = nearbyResult.rows.filter(r => parseInt(r.days_ago) <= 14);
        const commonFTags = [...new Set(nearbyResult.rows.filter(r => r.top_ftag).map(r => r.top_ftag_description))];

        nearbyActivity = {
          summary: within14Days.length > 0
            ? `${within14Days.length} facilities within 15 miles surveyed in last 14 days.${commonFTags.length > 0 ? ` Common focus: ${commonFTags[0]}` : ''}`
            : `${nearbyResult.rows.length} nearby facilities surveyed in last 30 days`,
          facilities: nearbyResult.rows.map(r => ({
            name: r.name,
            ccn: r.ccn,
            distance: parseFloat(r.distance),
            surveyDate: r.survey_date,
            daysAgo: parseInt(r.days_ago),
            deficiencyCount: parseInt(r.deficiency_count),
            topFTag: r.top_ftag ? `F${r.top_ftag}` : null,
            topFTagDescription: r.top_ftag_description || 'Unknown'
          }))
        };
      }
    }

    res.json({
      success: true,
      data: {
        lastSurveyDate,
        daysSinceSurvey,
        riskLevel,
        probability7Days: Math.round(probability7Days * 100) / 100,
        probability14Days: Math.round(probability14Days * 100) / 100,
        probability30Days: Math.round(probability30Days * 100) / 100,
        prepItemsCount: prepPriorities.length,
        dataAsOf: maxDate,
        surveyWindow: {
          windowOpens: windowOpens?.toISOString()?.split('T')[0] || null,
          federalMaximum: federalMaximum?.toISOString()?.split('T')[0] || null,
          stateAverageInterval: avgSurveyInterval,
          percentThroughWindow
        },
        nearbyActivity,
        prepPriorities,
        // Bellwether network is complex ML - return placeholder for V1
        bellwetherSignal: null,
        bellwetherNetwork: { bellwethers: [], followers: [] }
      }
    });

  } catch (error) {
    console.error('[Survey API] Facility intelligence error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// COMPANY/CHAIN SURVEY ANALYTICS
// ============================================================================

/**
 * GET /api/survey/company/:parentOrg
 * Get aggregated survey analytics for all facilities owned by a company/chain
 *
 * Query params:
 * - period: '30days' | '90days' | '12months' | 'all' (default: '12months')
 */
router.get('/company/:parentOrg', async (req, res) => {
  const { parentOrg } = req.params;
  const { period = '12months' } = req.query;
  const pool = getSurveyPool();
  const days = periodToDays(period);

  try {
    // Get the most recent data date
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    // Get all facilities for this company
    const facilitiesResult = await pool.query(`
      SELECT federal_provider_number as ccn, facility_name, city, state
      FROM snf_facilities
      WHERE parent_organization = $1
    `, [parentOrg]);

    const ccns = facilitiesResult.rows.map(f => f.ccn);

    if (ccns.length === 0) {
      return res.json({
        success: true,
        data: {
          companyName: parentOrg,
          facilityCount: 0,
          period,
          dataAsOf: maxDate,
          summary: null,
          topFTags: [],
          monthlyTrends: [],
          facilityBreakdown: [],
          categoryBreakdown: [],
          insights: [],
          yearOverYear: null
        }
      });
    }

    // Summary metrics for selected period - uses materialized view for fast aggregation
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*) as total_surveys,
        SUM(deficiency_count) as total_deficiencies,
        ROUND(AVG(deficiency_count)::numeric, 2) as avg_defs_per_survey,
        ROUND((SUM(ij_count)::numeric / NULLIF(SUM(deficiency_count), 0) * 100)::numeric, 2) as ij_rate_pct,
        COUNT(DISTINCT CASE WHEN has_ij = 1 THEN federal_provider_number END) as facilities_with_ij
      FROM mv_survey_aggregates
      WHERE federal_provider_number = ANY($1)
        AND survey_date >= $2::date - INTERVAL '${days} days'
    `, [ccns, maxDate]);

    // Top F-tags across all facilities for selected period with trend
    // Use half of the period for current vs prior comparison
    const halfDays = Math.floor(days / 2);
    const topFTagsResult = await pool.query(`
      WITH current_period AS (
        SELECT deficiency_tag, COUNT(*) as count
        FROM cms_facility_deficiencies
        WHERE federal_provider_number = ANY($1)
          AND survey_date >= $2::date - INTERVAL '${halfDays} days'
        GROUP BY deficiency_tag
      ),
      prior_period AS (
        SELECT deficiency_tag, COUNT(*) as count
        FROM cms_facility_deficiencies
        WHERE federal_provider_number = ANY($1)
          AND survey_date >= $2::date - INTERVAL '${days} days'
          AND survey_date < $2::date - INTERVAL '${halfDays} days'
        GROUP BY deficiency_tag
      )
      SELECT
        c.deficiency_tag as code,
        COALESCE(cd.description, 'Unknown') as name,
        COALESCE(cd.category, 'Unknown') as category,
        c.count as current_count,
        COALESCE(p.count, 0) as prior_count,
        c.count + COALESCE(p.count, 0) as total_count,
        CASE
          WHEN COALESCE(p.count, 0) = 0 THEN 'NEW'
          WHEN c.count > p.count * 1.1 THEN 'UP'
          WHEN c.count < p.count * 0.9 THEN 'DOWN'
          ELSE 'STABLE'
        END as trend,
        CASE
          WHEN COALESCE(p.count, 0) = 0 THEN 0
          ELSE ROUND(((c.count - p.count)::numeric / p.count * 100)::numeric, 1)
        END as change_pct
      FROM current_period c
      LEFT JOIN prior_period p ON c.deficiency_tag = p.deficiency_tag
      LEFT JOIN citation_descriptions cd ON c.deficiency_tag = cd.deficiency_tag
      ORDER BY c.count + COALESCE(p.count, 0) DESC
      LIMIT 10
    `, [ccns, maxDate]);

    // Monthly trends - show proportional to period (24 months max)
    // Uses materialized view for fast aggregation
    const trendMonths = Math.min(24, Math.ceil(days / 30) * 2);
    const monthlyTrendsResult = await pool.query(`
      SELECT
        year_month as month,
        TO_CHAR(survey_date, 'Mon YY') as month_label,
        COUNT(*) as surveys,
        SUM(deficiency_count) as deficiencies,
        ROUND(AVG(deficiency_count)::numeric, 1) as avg_defs
      FROM mv_survey_aggregates
      WHERE federal_provider_number = ANY($1)
        AND survey_date >= $2::date - INTERVAL '${trendMonths} months'
      GROUP BY year_month, TO_CHAR(survey_date, 'Mon YY')
      ORDER BY month
    `, [ccns, maxDate]);

    // Category breakdown for the period
    const categoryBreakdownResult = await pool.query(`
      SELECT
        COALESCE(cd.category, 'Unknown') as category,
        COUNT(*) as count,
        COUNT(DISTINCT h.federal_provider_number) as facilities_affected
      FROM cms_facility_deficiencies h
      LEFT JOIN citation_descriptions cd ON h.deficiency_tag = cd.deficiency_tag
      WHERE h.federal_provider_number = ANY($1)
        AND h.survey_date >= $2::date - INTERVAL '${days} days'
      GROUP BY COALESCE(cd.category, 'Unknown')
      ORDER BY count DESC
    `, [ccns, maxDate]);

    // Facility breakdown - last survey for each facility
    const facilityBreakdownResult = await pool.query(`
      WITH last_surveys AS (
        SELECT
          federal_provider_number,
          MAX(survey_date) as last_survey_date
        FROM cms_facility_deficiencies
        WHERE federal_provider_number = ANY($1)
        GROUP BY federal_provider_number
      ),
      survey_details AS (
        SELECT
          h.federal_provider_number,
          ls.last_survey_date,
          COUNT(*) as deficiency_count,
          SUM(CASE WHEN h.scope_severity IN ('J', 'K', 'L') THEN 1 ELSE 0 END) as ij_count
        FROM cms_facility_deficiencies h
        JOIN last_surveys ls ON h.federal_provider_number = ls.federal_provider_number AND h.survey_date = ls.last_survey_date
        GROUP BY h.federal_provider_number, ls.last_survey_date
      )
      SELECT
        f.federal_provider_number as ccn,
        f.facility_name as name,
        f.city,
        f.state,
        sd.last_survey_date,
        $2::date - sd.last_survey_date as days_since,
        COALESCE(sd.deficiency_count, 0) as deficiency_count,
        COALESCE(sd.ij_count, 0) as ij_count
      FROM snf_facilities f
      LEFT JOIN survey_details sd ON f.federal_provider_number = sd.federal_provider_number
      WHERE f.parent_organization = $3
      ORDER BY sd.last_survey_date DESC NULLS LAST
    `, [ccns, maxDate, parentOrg]);

    // Year-over-year comparison - uses materialized view for fast aggregation
    const yoyResult = await pool.query(`
      WITH current_year AS (
        SELECT
          COUNT(*) as surveys,
          SUM(deficiency_count) as deficiencies
        FROM mv_survey_aggregates
        WHERE federal_provider_number = ANY($1)
          AND survey_date >= $2::date - INTERVAL '12 months'
      ),
      prior_year AS (
        SELECT
          COUNT(*) as surveys,
          SUM(deficiency_count) as deficiencies
        FROM mv_survey_aggregates
        WHERE federal_provider_number = ANY($1)
          AND survey_date >= $2::date - INTERVAL '24 months'
          AND survey_date < $2::date - INTERVAL '12 months'
      )
      SELECT
        c.surveys as current_surveys,
        c.deficiencies as current_deficiencies,
        ROUND(c.deficiencies::numeric / NULLIF(c.surveys, 0), 1) as current_avg,
        p.surveys as prior_surveys,
        p.deficiencies as prior_deficiencies,
        ROUND(p.deficiencies::numeric / NULLIF(p.surveys, 0), 1) as prior_avg,
        CASE
          WHEN p.deficiencies = 0 THEN 0
          ELSE ROUND(((c.deficiencies - p.deficiencies)::numeric / p.deficiencies * 100)::numeric, 1)
        END as change_pct
      FROM current_year c, prior_year p
    `, [ccns, maxDate]);

    const summary = summaryResult.rows[0] || {};
    const yoy = yoyResult.rows[0] || {};

    // Generate insights based on data
    const insights = [];

    // Top F-tag insight
    if (topFTagsResult.rows.length > 0) {
      const top = topFTagsResult.rows[0];
      insights.push({
        type: 'top_ftag',
        icon: 'alert',
        text: `F${top.code} (${top.name.split(' ').slice(0, 4).join(' ')}...) is the most common deficiency with ${top.total_count} citations`
      });
    }

    // Trending up insights
    const trendingUp = topFTagsResult.rows.filter(r => r.trend === 'UP' && parseFloat(r.change_pct) > 15);
    if (trendingUp.length > 0) {
      const biggest = trendingUp[0];
      insights.push({
        type: 'trending_up',
        icon: 'trending-up',
        text: `F${biggest.code} citations increased ${biggest.change_pct}% - consider focusing training on this area`
      });
    }

    // Trending down insights
    const trendingDown = topFTagsResult.rows.filter(r => r.trend === 'DOWN' && parseFloat(r.change_pct) < -15);
    if (trendingDown.length > 0) {
      const biggest = trendingDown[0];
      insights.push({
        type: 'trending_down',
        icon: 'trending-down',
        text: `Good news: F${biggest.code} citations down ${Math.abs(biggest.change_pct)}%`
      });
    }

    // IJ rate insight
    if (parseFloat(summary.ij_rate_pct) > 2) {
      insights.push({
        type: 'ij_warning',
        icon: 'warning',
        text: `IJ rate of ${summary.ij_rate_pct}% is above industry average - ${summary.facilities_with_ij} facilities have had IJ findings`
      });
    }

    // Overdue survey insight
    const overdue = facilityBreakdownResult.rows.filter(r => parseInt(r.days_since) > 365);
    if (overdue.length > 0) {
      insights.push({
        type: 'overdue',
        icon: 'clock',
        text: `${overdue.length} facilities are overdue for annual survey (>365 days since last survey)`
      });
    }

    // Category concentration insight
    if (categoryBreakdownResult.rows.length > 0) {
      const topCategory = categoryBreakdownResult.rows[0];
      const totalDefs = categoryBreakdownResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
      const pct = Math.round((parseInt(topCategory.count) / totalDefs) * 100);
      if (pct > 30) {
        insights.push({
          type: 'category_concentration',
          icon: 'info',
          text: `${pct}% of deficiencies are in "${topCategory.category}" category - concentrated risk area`
        });
      }
    }

    res.json({
      success: true,
      data: {
        companyName: parentOrg,
        facilityCount: ccns.length,
        period,
        dataAsOf: maxDate,
        summary: {
          totalSurveys: parseInt(summary.total_surveys) || 0,
          totalDeficiencies: parseInt(summary.total_deficiencies) || 0,
          avgDeficienciesPerSurvey: parseFloat(summary.avg_defs_per_survey) || 0,
          ijRatePct: parseFloat(summary.ij_rate_pct) || 0,
          facilitiesWithIJ: parseInt(summary.facilities_with_ij) || 0
        },
        topFTags: topFTagsResult.rows.map(r => ({
          code: `F${r.code}`,
          name: r.name,
          category: r.category,
          count: parseInt(r.total_count),
          currentCount: parseInt(r.current_count),
          priorCount: parseInt(r.prior_count),
          trend: r.trend,
          changePct: parseFloat(r.change_pct) || 0
        })),
        categoryBreakdown: categoryBreakdownResult.rows.map(r => ({
          category: r.category,
          count: parseInt(r.count),
          facilitiesAffected: parseInt(r.facilities_affected)
        })),
        monthlyTrends: monthlyTrendsResult.rows.map(r => ({
          month: r.month,
          monthLabel: r.month_label,
          surveys: parseInt(r.surveys),
          deficiencies: parseInt(r.deficiencies),
          avgDefs: parseFloat(r.avg_defs)
        })),
        facilityBreakdown: facilityBreakdownResult.rows.map(r => ({
          ccn: r.ccn,
          name: r.name,
          city: r.city,
          state: r.state,
          lastSurveyDate: r.last_survey_date,
          daysSince: parseInt(r.days_since) || null,
          deficiencyCount: parseInt(r.deficiency_count),
          ijCount: parseInt(r.ij_count)
        })),
        yearOverYear: {
          currentYear: {
            surveys: parseInt(yoy.current_surveys) || 0,
            deficiencies: parseInt(yoy.current_deficiencies) || 0,
            avgDefs: parseFloat(yoy.current_avg) || 0
          },
          priorYear: {
            surveys: parseInt(yoy.prior_surveys) || 0,
            deficiencies: parseInt(yoy.prior_deficiencies) || 0,
            avgDefs: parseFloat(yoy.prior_avg) || 0
          },
          changePct: parseFloat(yoy.change_pct) || 0
        },
        insights
      }
    });

  } catch (error) {
    console.error('[Survey API] Company survey analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/cutpoints
 * Get historical health inspection star rating cutpoints by state
 *
 * Query params:
 * - state: State code (e.g., "CA") - optional, returns all states if not specified
 * - startMonth: Start month (YYYY-MM format) - optional
 * - endMonth: End month (YYYY-MM format) - optional
 */
router.get('/cutpoints', async (req, res) => {
  const { state, startMonth, endMonth } = req.query;
  const pool = getMarketPool(); // cutpoints table is in Market DB

  try {
    let query = `
      SELECT
        month,
        state,
        five_star_max,
        four_star_max,
        three_star_max,
        two_star_max,
        one_star_min
      FROM health_inspection_cutpoints
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (state) {
      query += ` AND state = $${paramIdx++}`;
      params.push(state.toUpperCase());
    }

    if (startMonth) {
      query += ` AND month >= $${paramIdx++}`;
      params.push(startMonth);
    }

    if (endMonth) {
      query += ` AND month <= $${paramIdx++}`;
      params.push(endMonth);
    }

    query += ` ORDER BY month, state`;

    const result = await pool.query(query, params);

    // Get available date range
    const rangeResult = await pool.query(`
      SELECT MIN(month) as min_month, MAX(month) as max_month, COUNT(DISTINCT month) as month_count
      FROM health_inspection_cutpoints
    `);

    res.json({
      success: true,
      data: {
        cutpoints: result.rows.map(r => ({
          month: r.month,
          state: r.state,
          fiveStarMax: parseFloat(r.five_star_max),
          fourStarMax: parseFloat(r.four_star_max),
          threeStarMax: parseFloat(r.three_star_max),
          twoStarMax: parseFloat(r.two_star_max),
          oneStarMin: parseFloat(r.one_star_min)
        })),
        dateRange: {
          min: rangeResult.rows[0].min_month,
          max: rangeResult.rows[0].max_month,
          monthCount: parseInt(rangeResult.rows[0].month_count)
        }
      }
    });
  } catch (error) {
    console.error('[Survey API] Cutpoints error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/cutpoints/trends
 * Get cutpoint trends over time for a specific state
 * Shows how thresholds have changed and calculates trend direction
 */
router.get('/cutpoints/trends', async (req, res) => {
  const { state } = req.query;
  const pool = getMarketPool(); // cutpoints table is in Market DB

  if (!state) {
    return res.status(400).json({
      success: false,
      error: 'State parameter is required'
    });
  }

  try {
    // Get all cutpoints for this state
    const cutpointsResult = await pool.query(`
      SELECT
        month,
        five_star_max,
        four_star_max,
        three_star_max,
        two_star_max,
        one_star_min
      FROM health_inspection_cutpoints
      WHERE state = $1
      ORDER BY month
    `, [state.toUpperCase()]);

    if (cutpointsResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { state, cutpoints: [], trends: null }
      });
    }

    const cutpoints = cutpointsResult.rows;
    const first = cutpoints[0];
    const last = cutpoints[cutpoints.length - 1];

    // Calculate trends
    const trends = {
      fiveStar: {
        start: parseFloat(first.five_star_max),
        end: parseFloat(last.five_star_max),
        change: parseFloat(last.five_star_max) - parseFloat(first.five_star_max),
        changePct: ((parseFloat(last.five_star_max) - parseFloat(first.five_star_max)) / parseFloat(first.five_star_max) * 100).toFixed(1)
      },
      fourStar: {
        start: parseFloat(first.four_star_max),
        end: parseFloat(last.four_star_max),
        change: parseFloat(last.four_star_max) - parseFloat(first.four_star_max),
        changePct: ((parseFloat(last.four_star_max) - parseFloat(first.four_star_max)) / parseFloat(first.four_star_max) * 100).toFixed(1)
      },
      threeStar: {
        start: parseFloat(first.three_star_max),
        end: parseFloat(last.three_star_max),
        change: parseFloat(last.three_star_max) - parseFloat(first.three_star_max),
        changePct: ((parseFloat(last.three_star_max) - parseFloat(first.three_star_max)) / parseFloat(first.three_star_max) * 100).toFixed(1)
      }
    };

    // Determine if thresholds are getting stricter or more lenient
    const interpretation = parseFloat(trends.fiveStar.changePct) > 5
      ? 'MORE_LENIENT' // Higher threshold = easier to get 5 stars
      : parseFloat(trends.fiveStar.changePct) < -5
        ? 'STRICTER'
        : 'STABLE';

    res.json({
      success: true,
      data: {
        state: state.toUpperCase(),
        dateRange: {
          start: first.month,
          end: last.month
        },
        cutpoints: cutpoints.map(r => ({
          month: r.month,
          fiveStarMax: parseFloat(r.five_star_max),
          fourStarMax: parseFloat(r.four_star_max),
          threeStarMax: parseFloat(r.three_star_max),
          twoStarMax: parseFloat(r.two_star_max),
          oneStarMin: parseFloat(r.one_star_min)
        })),
        trends,
        interpretation,
        insight: interpretation === 'MORE_LENIENT'
          ? `${state} cutpoints have increased ${trends.fiveStar.changePct}% since ${first.month}, meaning it's easier to achieve 5 stars now.`
          : interpretation === 'STRICTER'
            ? `${state} cutpoints have decreased ${Math.abs(trends.fiveStar.changePct)}% since ${first.month}, meaning 5-star ratings are harder to achieve.`
            : `${state} cutpoints have remained relatively stable since ${first.month}.`
      }
    });
  } catch (error) {
    console.error('[Survey API] Cutpoints trends error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/cutpoints/compare
 * Compare cutpoints across states for a specific month
 */
router.get('/cutpoints/compare', async (req, res) => {
  const { month } = req.query;
  const pool = getMarketPool(); // cutpoints table is in Market DB

  try {
    // Default to latest month if not specified
    let targetMonth = month;
    if (!targetMonth) {
      const latestResult = await pool.query('SELECT MAX(month) as max_month FROM health_inspection_cutpoints');
      targetMonth = latestResult.rows[0].max_month;
    }

    const result = await pool.query(`
      SELECT
        state,
        five_star_max,
        four_star_max,
        three_star_max,
        two_star_max,
        one_star_min
      FROM health_inspection_cutpoints
      WHERE month = $1
      ORDER BY five_star_max DESC
    `, [targetMonth]);

    // Calculate national averages
    const avgResult = await pool.query(`
      SELECT
        ROUND(AVG(five_star_max)::numeric, 2) as avg_five_star,
        ROUND(AVG(four_star_max)::numeric, 2) as avg_four_star,
        ROUND(AVG(three_star_max)::numeric, 2) as avg_three_star
      FROM health_inspection_cutpoints
      WHERE month = $1
    `, [targetMonth]);

    const avg = avgResult.rows[0];

    res.json({
      success: true,
      data: {
        month: targetMonth,
        states: result.rows.map(r => ({
          state: r.state,
          fiveStarMax: parseFloat(r.five_star_max),
          fourStarMax: parseFloat(r.four_star_max),
          threeStarMax: parseFloat(r.three_star_max),
          twoStarMax: parseFloat(r.two_star_max),
          oneStarMin: parseFloat(r.one_star_min),
          // Relative to national average
          vsNationalAvg: ((parseFloat(r.five_star_max) - parseFloat(avg.avg_five_star)) / parseFloat(avg.avg_five_star) * 100).toFixed(1)
        })),
        nationalAverages: {
          fiveStarMax: parseFloat(avg.avg_five_star),
          fourStarMax: parseFloat(avg.avg_four_star),
          threeStarMax: parseFloat(avg.avg_three_star)
        }
      }
    });
  } catch (error) {
    console.error('[Survey API] Cutpoints compare error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/cutpoints/heatmap
 * Get state data for heat map visualization
 * Includes 5-star thresholds and average deficiencies per survey (TTM)
 */
router.get('/cutpoints/heatmap', async (req, res) => {
  const mainPool = getMainPool();
  const marketPool = getMarketPool();

  try {
    // Get latest cutpoints month (cutpoints table is in Market DB)
    const latestResult = await marketPool.query('SELECT MAX(month) as max_month FROM health_inspection_cutpoints');
    const latestMonth = latestResult.rows[0].max_month;

    // Get 5-star thresholds for all states
    const cutpointsResult = await marketPool.query(`
      SELECT state, five_star_max
      FROM health_inspection_cutpoints
      WHERE month = $1
    `, [latestMonth]);

    // Get most recent survey data date
    const maxDateResult = await marketPool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    // Get average deficiencies per survey by state for TTM (trailing 12 months)
    // Uses materialized view for fast aggregation (83x faster)
    const stateDefsResult = await marketPool.query(`
      SELECT
        f.state,
        COUNT(*) as survey_count,
        SUM(mv.deficiency_count) as deficiency_count,
        ROUND(AVG(mv.deficiency_count)::numeric, 2) as avg_defs_per_survey
      FROM mv_survey_aggregates mv
      JOIN snf_facilities f ON mv.federal_provider_number = f.federal_provider_number
      WHERE mv.survey_date >= $1::date - INTERVAL '365 days'
        AND f.state IS NOT NULL
      GROUP BY f.state
      ORDER BY f.state
    `, [maxDate]);

    // Calculate national average - uses materialized view
    const nationalResult = await marketPool.query(`
      SELECT
        COUNT(*) as survey_count,
        SUM(deficiency_count) as deficiency_count,
        ROUND(AVG(deficiency_count)::numeric, 2) as avg_defs_per_survey
      FROM mv_survey_aggregates
      WHERE survey_date >= $1::date - INTERVAL '365 days'
    `, [maxDate]);

    const nationalAvg = parseFloat(nationalResult.rows[0]?.avg_defs_per_survey) || 0;

    // Merge cutpoints with deficiency data
    const cutpointsMap = {};
    cutpointsResult.rows.forEach(r => {
      cutpointsMap[r.state] = parseFloat(r.five_star_max);
    });

    const stateData = stateDefsResult.rows.map(r => ({
      state: r.state,
      fiveStarMax: cutpointsMap[r.state] || null,
      surveyCount: parseInt(r.survey_count),
      avgDefsPerSurvey: parseFloat(r.avg_defs_per_survey)
    }));

    // Find min/max 5-star thresholds for color scale
    const thresholds = stateData.filter(s => s.fiveStarMax !== null).map(s => s.fiveStarMax);
    const minThreshold = Math.min(...thresholds);
    const maxThreshold = Math.max(...thresholds);

    res.json({
      success: true,
      data: {
        month: latestMonth,
        dataAsOf: maxDate,
        states: stateData,
        nationalAvgDefsPerSurvey: nationalAvg,
        thresholdRange: {
          min: minThreshold,
          max: maxThreshold
        }
      }
    });
  } catch (error) {
    console.error('[Survey API] Cutpoints heatmap error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SURVEY PATTERNS ENDPOINTS
// ============================================================================

/**
 * GET /api/survey/patterns/by-state
 * Get survey type patterns (combined/standard-only/complaint-only) by state
 *
 * This reveals how different states approach CMS enforcement - whether they
 * combine complaint investigations with standard surveys or conduct them separately.
 *
 * Query params:
 * - period: '12months' | '24months' | 'all' (default: '12months')
 */
router.get('/patterns/by-state', async (req, res) => {
  const { period = '12months' } = req.query;
  const pool = getSurveyPool();

  try {
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    let dateFilter = '';
    if (period === '12months') {
      dateFilter = `AND d.survey_date >= '${maxDate.toISOString().split('T')[0]}'::date - INTERVAL '12 months'`;
    } else if (period === '24months') {
      dateFilter = `AND d.survey_date >= '${maxDate.toISOString().split('T')[0]}'::date - INTERVAL '24 months'`;
    }
    // 'all' = no date filter

    const result = await pool.query(`
      WITH survey_types AS (
        SELECT
          f.state,
          d.federal_provider_number,
          d.survey_date,
          BOOL_OR(d.is_standard_deficiency) as has_standard,
          BOOL_OR(d.is_complaint_deficiency) as has_complaint
        FROM cms_facility_deficiencies d
        JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
        WHERE (d.is_standard_deficiency IS NOT NULL OR d.is_complaint_deficiency IS NOT NULL)
          ${dateFilter}
        GROUP BY f.state, d.federal_provider_number, d.survey_date
      ),
      state_stats AS (
        SELECT
          state,
          COUNT(*) as total_surveys,
          SUM(CASE WHEN has_standard AND has_complaint THEN 1 ELSE 0 END) as combined,
          SUM(CASE WHEN has_standard AND NOT has_complaint THEN 1 ELSE 0 END) as standard_only,
          SUM(CASE WHEN has_complaint AND NOT has_standard THEN 1 ELSE 0 END) as complaint_only
        FROM survey_types
        GROUP BY state
      )
      SELECT
        state,
        total_surveys,
        combined,
        standard_only,
        complaint_only,
        ROUND(combined * 100.0 / NULLIF(total_surveys, 0), 1) as combined_pct,
        ROUND(standard_only * 100.0 / NULLIF(total_surveys, 0), 1) as standard_only_pct,
        ROUND(complaint_only * 100.0 / NULLIF(total_surveys, 0), 1) as complaint_only_pct,
        ROUND(combined * 100.0 / NULLIF(combined + standard_only, 0), 1) as pct_standard_with_complaint,
        ROUND(combined * 100.0 / NULLIF(combined + complaint_only, 0), 1) as pct_complaint_with_standard
      FROM state_stats
      WHERE total_surveys >= 5
      ORDER BY combined_pct DESC
    `);

    // Calculate national totals
    const national = result.rows.reduce((acc, r) => {
      acc.total_surveys += parseInt(r.total_surveys);
      acc.combined += parseInt(r.combined);
      acc.standard_only += parseInt(r.standard_only);
      acc.complaint_only += parseInt(r.complaint_only);
      return acc;
    }, { total_surveys: 0, combined: 0, standard_only: 0, complaint_only: 0 });

    national.combined_pct = Math.round(national.combined * 1000 / national.total_surveys) / 10;
    national.standard_only_pct = Math.round(national.standard_only * 1000 / national.total_surveys) / 10;
    national.complaint_only_pct = Math.round(national.complaint_only * 1000 / national.total_surveys) / 10;
    national.pct_standard_with_complaint = Math.round(national.combined * 1000 / (national.combined + national.standard_only)) / 10;
    national.pct_complaint_with_standard = Math.round(national.combined * 1000 / (national.combined + national.complaint_only)) / 10;

    res.json({
      success: true,
      data: {
        period,
        dataAsOf: maxDate,
        national,
        states: result.rows.map(r => ({
          state: r.state,
          totalSurveys: parseInt(r.total_surveys),
          combined: parseInt(r.combined),
          standardOnly: parseInt(r.standard_only),
          complaintOnly: parseInt(r.complaint_only),
          combinedPct: parseFloat(r.combined_pct),
          standardOnlyPct: parseFloat(r.standard_only_pct),
          complaintOnlyPct: parseFloat(r.complaint_only_pct),
          pctStandardWithComplaint: parseFloat(r.pct_standard_with_complaint) || 0,
          pctComplaintWithStandard: parseFloat(r.pct_complaint_with_standard) || 0
        }))
      }
    });
  } catch (error) {
    console.error('[Survey API] Survey patterns error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/survey/patterns/trends
 * Get survey type pattern trends over time (by year or quarter)
 *
 * Query params:
 * - state: state code or 'ALL' for national (default: 'ALL')
 * - granularity: 'year' | 'quarter' (default: 'year')
 */
router.get('/patterns/trends', async (req, res) => {
  const { state = 'ALL', granularity = 'year' } = req.query;
  const pool = getSurveyPool();

  try {
    const maxDateResult = await pool.query('SELECT MAX(survey_date) as max_date FROM cms_facility_deficiencies');
    const maxDate = maxDateResult.rows[0]?.max_date || new Date();

    const stateFilter = state !== 'ALL' ? `AND f.state = '${state}'` : '';
    const periodExpr = granularity === 'quarter'
      ? `TO_CHAR(d.survey_date, 'YYYY-"Q"Q')`
      : `EXTRACT(YEAR FROM d.survey_date)::text`;

    const result = await pool.query(`
      WITH survey_types AS (
        SELECT
          ${periodExpr} as period,
          d.federal_provider_number,
          d.survey_date,
          BOOL_OR(d.is_standard_deficiency) as has_standard,
          BOOL_OR(d.is_complaint_deficiency) as has_complaint
        FROM cms_facility_deficiencies d
        JOIN snf_facilities f ON d.federal_provider_number = f.federal_provider_number
        WHERE (d.is_standard_deficiency IS NOT NULL OR d.is_complaint_deficiency IS NOT NULL)
          ${stateFilter}
        GROUP BY ${periodExpr}, d.federal_provider_number, d.survey_date
      )
      SELECT
        period,
        COUNT(*) as total_surveys,
        SUM(CASE WHEN has_standard AND has_complaint THEN 1 ELSE 0 END) as combined,
        SUM(CASE WHEN has_standard AND NOT has_complaint THEN 1 ELSE 0 END) as standard_only,
        SUM(CASE WHEN has_complaint AND NOT has_standard THEN 1 ELSE 0 END) as complaint_only,
        ROUND(SUM(CASE WHEN has_standard AND has_complaint THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as combined_pct
      FROM survey_types
      GROUP BY period
      ORDER BY period
    `);

    res.json({
      success: true,
      data: {
        state: state === 'ALL' ? 'National' : state,
        granularity,
        dataAsOf: maxDate,
        trends: result.rows.map(r => ({
          period: r.period,
          totalSurveys: parseInt(r.total_surveys),
          combined: parseInt(r.combined),
          standardOnly: parseInt(r.standard_only),
          complaintOnly: parseInt(r.complaint_only),
          combinedPct: parseFloat(r.combined_pct)
        }))
      }
    });
  } catch (error) {
    console.error('[Survey API] Survey patterns trends error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
