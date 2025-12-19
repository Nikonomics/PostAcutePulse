import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Get color based on performance score
 */
const getScoreColor = (score) => {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
};

/**
 * Get color based on percentile ranking
 */
const getPercentileColor = (percentile) => {
  if (percentile >= 75) return '#22c55e';
  if (percentile >= 50) return '#eab308';
  return '#ef4444';
};

/**
 * Format dollar amount with sign and commas
 */
const formatDollar = (amount) => {
  if (amount == null) return '—';
  const absAmount = Math.abs(Math.round(amount));
  const formatted = absAmount.toLocaleString('en-US');
  return amount >= 0 ? `+$${formatted}` : `-$${formatted}`;
};

/**
 * Calculate year-over-year change in performance score
 */
const getYoYChange = (current, history) => {
  if (!current?.performance_score || !history || history.length === 0) return null;
  const previousYear = history.find(h => h.fiscal_year === current.fiscal_year - 1);
  if (!previousYear || previousYear.performance_score == null) return null;
  return Math.round(current.performance_score - previousYear.performance_score);
};

/**
 * VBPPerformanceSummary - Hero section showing key VBP metrics
 */
const VBPPerformanceSummary = ({ vbpData, facility }) => {
  const { current, history, rankings, estimated_impact } = vbpData || {};

  // Calculate derived values
  const performanceScore = current?.performance_score != null
    ? Math.round(current.performance_score)
    : null;
  const multiplier = current?.incentive_multiplier;
  const incentivePercentage = current?.incentive_percentage;
  const yoyChange = getYoYChange(current, history);
  const dollarImpact = estimated_impact?.dollar_impact;

  // National ranking calculations
  const nationalPercentile = rankings?.national?.percentile;
  const topPercent = nationalPercentile != null
    ? Math.round(100 - nationalPercentile)
    : null;

  // State ranking
  const stateRank = rankings?.state?.rank;
  const stateTotal = rankings?.state?.total;
  const statePercentile = rankings?.state?.percentile;

  // If no current data at all
  if (!current && (!history || history.length === 0)) {
    return (
      <div className="vbp-performance-summary">
        <div className="vbp-summary-header">
          <h3>Value-Based Purchasing Performance</h3>
        </div>
        <div className="vbp-summary-empty">
          <p>No VBP performance data available for this facility.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vbp-performance-summary">
      {/* Header */}
      <div className="vbp-summary-header">
        <h3>Value-Based Purchasing Performance</h3>
        {current?.fiscal_year && (
          <span className="vbp-fiscal-year-badge">FY {current.fiscal_year}</span>
        )}
      </div>

      {/* Cards Grid */}
      <div className="vbp-summary-cards">
        {/* Card 1: Performance Score */}
        <div className="vbp-summary-card">
          <div className="vbp-summary-card-label">Performance Score</div>
          <div
            className="vbp-summary-card-value"
            style={{ color: performanceScore != null ? getScoreColor(performanceScore) : '#6b7280' }}
          >
            {performanceScore != null ? performanceScore : '—'}
          </div>

          {/* Progress Bar */}
          {performanceScore != null && (
            <div className="vbp-progress-bar">
              <div
                className="vbp-progress-bar-fill"
                style={{
                  width: `${Math.min(performanceScore, 100)}%`,
                  backgroundColor: getScoreColor(performanceScore)
                }}
              />
            </div>
          )}

          {/* YoY Change */}
          <div className={`vbp-summary-card-change ${
            yoyChange == null ? 'neutral' : yoyChange > 0 ? 'positive' : yoyChange < 0 ? 'negative' : 'neutral'
          }`}>
            {yoyChange == null ? (
              <>
                <Minus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                N/A
              </>
            ) : yoyChange > 0 ? (
              <>
                <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                +{yoyChange} vs PY
              </>
            ) : yoyChange < 0 ? (
              <>
                <TrendingDown size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {yoyChange} vs PY
              </>
            ) : (
              <>
                <Minus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                No change
              </>
            )}
          </div>
        </div>

        {/* Card 2: Payment Multiplier */}
        <div className="vbp-summary-card">
          <div className="vbp-summary-card-label">Payment Multiplier</div>
          <div
            className="vbp-summary-card-value"
            style={{ color: multiplier != null ? (multiplier >= 1 ? '#22c55e' : '#ef4444') : '#6b7280' }}
          >
            {multiplier != null ? `${multiplier.toFixed(3)}x` : '—'}
          </div>

          {incentivePercentage != null && (
            <div className="vbp-summary-card-secondary">
              {incentivePercentage >= 0 ? '+' : ''}{incentivePercentage.toFixed(2)}%
            </div>
          )}

          <div className={`vbp-summary-card-change ${
            dollarImpact == null ? 'neutral' : dollarImpact >= 0 ? 'positive' : 'negative'
          }`}>
            {formatDollar(dollarImpact)}/yr
          </div>
        </div>

        {/* Card 3: National Ranking */}
        <div className="vbp-summary-card">
          <div className="vbp-summary-card-label">National Ranking</div>
          <div
            className="vbp-summary-card-value"
            style={{ color: nationalPercentile != null ? getPercentileColor(nationalPercentile) : '#6b7280' }}
          >
            {topPercent != null ? `Top ${topPercent}%` : '—'}
          </div>

          <div className="vbp-summary-card-secondary">
            {nationalPercentile != null
              ? `${Math.round(nationalPercentile)}th percentile`
              : 'No ranking data'
            }
          </div>

          {rankings?.national?.rank != null && rankings?.national?.total != null && (
            <div className="vbp-summary-card-rank-detail">
              #{rankings.national.rank.toLocaleString()} of {rankings.national.total.toLocaleString()}
            </div>
          )}
        </div>

        {/* Card 4: State Ranking */}
        <div className="vbp-summary-card">
          <div className="vbp-summary-card-label">State Ranking</div>
          <div
            className="vbp-summary-card-value"
            style={{ color: statePercentile != null ? getPercentileColor(statePercentile) : '#6b7280' }}
          >
            {stateRank != null && stateTotal != null
              ? `#${stateRank} / ${stateTotal}`
              : '—'
            }
          </div>

          <div className="vbp-summary-card-secondary">
            {statePercentile != null
              ? `${Math.round(statePercentile)}th percentile`
              : 'No ranking data'
            }
          </div>

          {facility?.state && (
            <div className="vbp-summary-card-rank-detail">
              {facility.state} facilities
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VBPPerformanceSummary;
