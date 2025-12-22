/**
 * Facility Regulatory Risk Assessment API
 *
 * Provides a comprehensive regulatory risk assessment for M&A analysts
 * to evaluate facility compliance history in 30 seconds.
 *
 * Uses health_citations table from snf_platform database.
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection - same pattern as surveyIntelligence.js
const getPool = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
  return new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });
};

// Severity code labels
const SEVERITY_LABELS = {
  'A': 'Isolated, No Actual Harm (potential for minimal)',
  'B': 'Isolated, No Actual Harm (potential for more than minimal)',
  'C': 'Pattern, No Actual Harm (potential for minimal)',
  'D': 'Isolated, No Actual Harm (potential for minimal)',
  'E': 'Pattern, No Actual Harm',
  'F': 'Widespread, No Actual Harm',
  'G': 'Isolated, Actual Harm',
  'H': 'Pattern, Actual Harm',
  'I': 'Widespread, Actual Harm',
  'J': 'Isolated Immediate Jeopardy',
  'K': 'Pattern Immediate Jeopardy',
  'L': 'Widespread Immediate Jeopardy',
};

// Severity order for sorting (L is most severe)
const SEVERITY_ORDER = ['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

// Immediate Jeopardy codes
const IJ_CODES = ['J', 'K', 'L'];

/**
 * Validate CCN format (6 characters, alphanumeric)
 */
const isValidCCN = (ccn) => {
  return ccn && /^[A-Za-z0-9]{6}$/.test(ccn);
};

/**
 * GET /api/v1/facilities/:ccn/regulatory-risk
 *
 * Returns comprehensive regulatory risk assessment for a facility
 */
router.get('/:ccn/regulatory-risk', async (req, res) => {
  const { ccn } = req.params;
  const pool = getPool();

  // Validate CCN format
  if (!isValidCCN(ccn)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid CCN format. CCN must be 6 alphanumeric characters.',
    });
  }

  const upperCCN = ccn.toUpperCase();
  const stateCode = upperCCN.substring(0, 2);

  try {
    // Check if facility exists in our data
    const existsResult = await pool.query(
      'SELECT COUNT(*) as count FROM health_citations WHERE ccn = $1',
      [upperCCN]
    );

    if (parseInt(existsResult.rows[0].count) === 0) {
      return res.status(404).json({
        success: false,
        error: `No citation data found for CCN ${upperCCN}`,
      });
    }

    // Get data freshness
    const maxDateResult = await pool.query(
      'SELECT MAX(survey_date) as max_date FROM health_citations'
    );
    const dataThrough = maxDateResult.rows[0].max_date;

    // Run all queries in parallel for performance
    const [
      ijResult,
      peerResult,
      trendResult,
      complaintResult,
      seriousResult,
    ] = await Promise.all([
      // 1. Immediate Jeopardy History
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE scope_severity_code IN ('J', 'K', 'L')) as total_ij,
          MAX(survey_date) FILTER (WHERE scope_severity_code IN ('J', 'K', 'L')) as most_recent_ij
        FROM health_citations
        WHERE ccn = $1
      `, [upperCCN]),

      // 2. Deficiency Count vs State Peers (last 3 years)
      pool.query(`
        WITH facility_counts AS (
          SELECT
            ccn,
            COUNT(*) as citation_count
          FROM health_citations
          WHERE LEFT(ccn, 2) = $1
            AND survey_date >= CURRENT_DATE - INTERVAL '3 years'
          GROUP BY ccn
        ),
        stats AS (
          SELECT
            AVG(citation_count) as state_avg,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY citation_count) as state_median,
            COUNT(*) as facility_count
          FROM facility_counts
        ),
        target AS (
          SELECT citation_count as facility_count
          FROM facility_counts
          WHERE ccn = $2
        ),
        ranking AS (
          SELECT
            (SELECT COUNT(*) FROM facility_counts WHERE citation_count < (SELECT facility_count FROM target))::float /
            NULLIF((SELECT COUNT(*) FROM facility_counts), 0) * 100 as percentile
        )
        SELECT
          COALESCE(t.facility_count, 0) as facility_count,
          ROUND(s.state_avg::numeric, 1) as state_avg,
          ROUND(s.state_median::numeric, 1) as state_median,
          ROUND(COALESCE(r.percentile, 0)::numeric, 0) as percentile,
          s.facility_count as total_state_facilities
        FROM stats s
        CROSS JOIN ranking r
        LEFT JOIN target t ON true
      `, [stateCode, upperCCN]),

      // 3. Trend Direction (last 12 months vs prior 12 months)
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE survey_date >= CURRENT_DATE - INTERVAL '12 months') as recent_12mo,
          COUNT(*) FILTER (WHERE survey_date >= CURRENT_DATE - INTERVAL '24 months'
                               AND survey_date < CURRENT_DATE - INTERVAL '12 months') as prior_12mo
        FROM health_citations
        WHERE ccn = $1
      `, [upperCCN]),

      // 4. Complaint Survey Comparison (last 3 years)
      pool.query(`
        WITH facility_complaints AS (
          SELECT
            ccn,
            COUNT(DISTINCT survey_date) as complaint_surveys
          FROM health_citations
          WHERE is_complaint_deficiency = true
            AND survey_date >= CURRENT_DATE - INTERVAL '3 years'
          GROUP BY ccn
        ),
        state_facilities AS (
          SELECT
            ccn,
            COALESCE(fc.complaint_surveys, 0) as complaint_surveys
          FROM (SELECT DISTINCT ccn FROM health_citations WHERE LEFT(ccn, 2) = $1) f
          LEFT JOIN facility_complaints fc USING (ccn)
        ),
        national_facilities AS (
          SELECT
            ccn,
            COALESCE(fc.complaint_surveys, 0) as complaint_surveys
          FROM (SELECT DISTINCT ccn FROM health_citations) f
          LEFT JOIN facility_complaints fc USING (ccn)
        )
        SELECT
          COALESCE((SELECT complaint_surveys FROM facility_complaints WHERE ccn = $2), 0) as facility_count,
          ROUND((SELECT AVG(complaint_surveys) FROM state_facilities)::numeric, 2) as state_avg,
          ROUND((SELECT AVG(complaint_surveys) FROM national_facilities)::numeric, 2) as national_avg
      `, [stateCode, upperCCN]),

      // 5. Most Serious Findings (top 3, last 3 years)
      pool.query(`
        SELECT
          survey_date,
          COALESCE(deficiency_prefix, 'F') || deficiency_tag as ftag,
          scope_severity_code,
          is_complaint_deficiency,
          LEFT(deficiency_description, 500) as summary
        FROM health_citations
        WHERE ccn = $1
          AND survey_date >= CURRENT_DATE - INTERVAL '3 years'
        ORDER BY
          CASE scope_severity_code
            WHEN 'L' THEN 1
            WHEN 'K' THEN 2
            WHEN 'J' THEN 3
            WHEN 'I' THEN 4
            WHEN 'H' THEN 5
            WHEN 'G' THEN 6
            WHEN 'F' THEN 7
            WHEN 'E' THEN 8
            WHEN 'D' THEN 9
            WHEN 'C' THEN 10
            WHEN 'B' THEN 11
            WHEN 'A' THEN 12
            ELSE 13
          END,
          survey_date DESC
        LIMIT 3
      `, [upperCCN]),
    ]);

    // Process Immediate Jeopardy results
    const totalIJ = parseInt(ijResult.rows[0].total_ij) || 0;
    const mostRecentIJ = ijResult.rows[0].most_recent_ij;
    const daysSinceIJ = mostRecentIJ
      ? Math.floor((new Date() - new Date(mostRecentIJ)) / (1000 * 60 * 60 * 24))
      : null;

    const immediateJeopardy = {
      has_ij_history: totalIJ > 0,
      total_ij_citations: totalIJ,
      most_recent_ij: mostRecentIJ ? mostRecentIJ.toISOString().split('T')[0] : null,
      days_since_ij: daysSinceIJ,
    };

    // Process State Peers results
    const facilityCount = parseInt(peerResult.rows[0]?.facility_count) || 0;
    const stateAvg = parseFloat(peerResult.rows[0]?.state_avg) || 0;
    const stateMedian = parseFloat(peerResult.rows[0]?.state_median) || 0;
    const percentile = parseInt(peerResult.rows[0]?.percentile) || 0;

    let peerAssessment;
    if (percentile <= 25) peerAssessment = 'below_average';
    else if (percentile <= 50) peerAssessment = 'typical';
    else if (percentile <= 75) peerAssessment = 'above_average';
    else peerAssessment = 'high';

    const vsStatePeers = {
      facility_count: facilityCount,
      state_avg: stateAvg,
      state_median: stateMedian,
      percentile,
      assessment: peerAssessment,
    };

    // Process Trend results
    const recent12mo = parseInt(trendResult.rows[0].recent_12mo) || 0;
    const prior12mo = parseInt(trendResult.rows[0].prior_12mo) || 0;
    const trendChange = recent12mo - prior12mo;

    let trendDirection;
    if (recent12mo === 0 && prior12mo === 0) {
      trendDirection = 'insufficient_data';
    } else if (prior12mo === 0 && recent12mo > 0) {
      trendDirection = 'new_issues';
    } else if (trendChange < -2) {
      trendDirection = 'improving';
    } else if (trendChange > 2) {
      trendDirection = 'deteriorating';
    } else {
      trendDirection = 'stable';
    }

    const trend = {
      recent_12mo: recent12mo,
      prior_12mo: prior12mo,
      change: trendChange,
      direction: trendDirection,
    };

    // Process Complaint Survey results
    const facilityComplaintCount = parseInt(complaintResult.rows[0].facility_count) || 0;
    const complaintStateAvg = parseFloat(complaintResult.rows[0].state_avg) || 0;
    const complaintNationalAvg = parseFloat(complaintResult.rows[0].national_avg) || 0;

    let complaintVsState;
    if (complaintStateAvg === 0) {
      complaintVsState = facilityComplaintCount > 0 ? 'above' : 'typical';
    } else if (facilityComplaintCount > complaintStateAvg * 1.5) {
      complaintVsState = 'high';
    } else if (facilityComplaintCount > complaintStateAvg) {
      complaintVsState = 'above';
    } else if (facilityComplaintCount < complaintStateAvg * 0.5) {
      complaintVsState = 'below';
    } else {
      complaintVsState = 'typical';
    }

    const complaintSurveys = {
      facility_count: facilityComplaintCount,
      state_avg: complaintStateAvg,
      national_avg: complaintNationalAvg,
      vs_state: complaintVsState,
    };

    // Process Serious Findings
    const seriousFindings = seriousResult.rows.map(row => ({
      survey_date: row.survey_date.toISOString().split('T')[0],
      ftag: row.ftag,
      severity_code: row.scope_severity_code,
      severity_label: SEVERITY_LABELS[row.scope_severity_code] || 'Unknown',
      is_complaint: row.is_complaint_deficiency || false,
      summary: row.summary,
    }));

    // Calculate Risk Score
    let riskPoints = 0;

    // IJ scoring
    if (daysSinceIJ !== null) {
      if (daysSinceIJ <= 365) {
        riskPoints += 40;
      } else if (daysSinceIJ <= 730) {
        riskPoints += 25;
      } else {
        riskPoints += 10;
      }
    }

    // Percentile scoring
    if (percentile > 75) {
      riskPoints += 20;
    } else if (percentile > 50) {
      riskPoints += 10;
    }

    // Trend scoring
    if (trendDirection === 'deteriorating') {
      riskPoints += 20;
    } else if (trendDirection === 'improving') {
      riskPoints -= 10;
    }

    // Complaint scoring
    if (complaintVsState === 'high') {
      riskPoints += 15;
    }

    // Ensure points don't go below 0
    riskPoints = Math.max(0, riskPoints);

    // Map points to label
    let riskLabel;
    if (riskPoints < 15) {
      riskLabel = 'low';
    } else if (riskPoints < 30) {
      riskLabel = 'moderate';
    } else if (riskPoints < 50) {
      riskLabel = 'elevated';
    } else {
      riskLabel = 'high';
    }

    // Build response
    const response = {
      success: true,
      data: {
        ccn: upperCCN,
        immediate_jeopardy: immediateJeopardy,
        vs_state_peers: vsStatePeers,
        trend,
        complaint_surveys: complaintSurveys,
        serious_findings: seriousFindings,
        risk_score: riskLabel,
        risk_points: riskPoints,
        data_through: dataThrough.toISOString().split('T')[0],
      },
    };

    res.json(response);

  } catch (error) {
    console.error('[Facility Risk API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while calculating regulatory risk',
    });
  } finally {
    await pool.end();
  }
});

module.exports = router;
