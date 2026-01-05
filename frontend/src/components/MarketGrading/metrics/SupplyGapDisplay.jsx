/**
 * SupplyGapDisplay.jsx
 *
 * Shows ALF supply gap analysis with visual representation of
 * current capacity vs estimated need.
 *
 * Props:
 * - alNeed: number (required) - estimated AL need in beds
 * - currentCapacity: number (required) - existing beds
 * - coverageRatio: number (required) - percentage covered
 * - bedsNeeded: number (required) - gap in beds
 * - ranking: object (required) - gap ranking data
 * - className: string (optional)
 *
 * Usage:
 * <SupplyGapDisplay
 *   alNeed={6840}
 *   currentCapacity={4250}
 *   coverageRatio={62.1}
 *   bedsNeeded={2590}
 *   ranking={{ rank: 5, total: 14, context: "in state" }}
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Signal configuration based on gap percentage
 */
const getSignal = (coverageRatio) => {
  const gapPercent = 100 - coverageRatio;

  if (gapPercent > 20) {
    return {
      level: 'opportunity',
      label: 'Opportunity',
      color: '#22c55e',
      description: 'Significant unmet demand'
    };
  } else if (gapPercent >= 10) {
    return {
      level: 'moderate',
      label: 'Moderate',
      color: '#eab308',
      description: 'Some room for growth'
    };
  } else {
    return {
      level: 'saturated',
      label: 'Saturated',
      color: '#ef4444',
      description: 'Market near capacity'
    };
  }
};

const SupplyGapDisplay = ({
  alNeed,
  currentCapacity,
  coverageRatio,
  bedsNeeded,
  ranking,
  className = ''
}) => {
  const signal = getSignal(coverageRatio);
  const filledPercent = Math.min(100, Math.max(0, coverageRatio));
  const gapPercent = 100 - filledPercent;

  // Container styles
  const containerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  };

  // Header styles
  const headerStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid #f3f4f6'
  };

  const titleStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    margin: 0
  };

  // Coverage section styles
  const coverageSectionStyle = {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
    backgroundColor: '#f9fafb'
  };

  const coverageLabelStyle = {
    fontSize: 14,
    color: '#6b7280'
  };

  const coverageValueStyle = {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827'
  };

  const signalBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    backgroundColor: `${signal.color}15`,
    border: `1px solid ${signal.color}40`,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: signal.color
  };

  // Metrics section styles
  const metricsSectionStyle = {
    padding: '20px'
  };

  const metricRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6'
  };

  const metricLabelStyle = {
    fontSize: 14,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };

  const metricValueStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: '#374151'
  };

  // Progress bar styles
  const progressContainerStyle = {
    marginTop: 16,
    marginBottom: 8
  };

  const progressBarStyle = {
    display: 'flex',
    height: 24,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6'
  };

  const filledStyle = {
    width: `${filledPercent}%`,
    backgroundColor: '#06b6d4', // ALF color (cyan)
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: '#ffffff',
    minWidth: filledPercent > 15 ? 'auto' : 0
  };

  const gapStyle = {
    width: `${gapPercent}%`,
    backgroundColor: signal.color + '30',
    backgroundImage: `repeating-linear-gradient(
      45deg,
      transparent,
      transparent 4px,
      ${signal.color}20 4px,
      ${signal.color}20 8px
    )`,
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: signal.color,
    minWidth: gapPercent > 15 ? 'auto' : 0
  };

  const progressLabelContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
    fontSize: 11,
    color: '#9ca3af'
  };

  // Ranking section styles
  const rankingSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  };

  const rankingRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14
  };

  const rankingLabelStyle = {
    color: '#6b7280'
  };

  const rankingValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  const rankingHintStyle = {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic'
  };

  // Format numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>ALF Supply Gap Analysis</h3>
      </div>

      {/* Coverage ratio */}
      <div style={coverageSectionStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={coverageLabelStyle}>Coverage Ratio</div>
          <div style={coverageValueStyle}>{coverageRatio.toFixed(1)}%</div>
        </div>
        <span style={signalBadgeStyle}>{signal.label}</span>
      </div>

      {/* Metrics */}
      <div style={metricsSectionStyle}>
        <div style={metricRowStyle}>
          <span style={metricLabelStyle}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#9ca3af' }} />
            Estimated Need
          </span>
          <span style={metricValueStyle}>{formatNumber(alNeed)} beds</span>
        </div>

        <div style={metricRowStyle}>
          <span style={metricLabelStyle}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#06b6d4' }} />
            Current Capacity
          </span>
          <span style={metricValueStyle}>{formatNumber(currentCapacity)} beds</span>
        </div>

        <div style={{ ...metricRowStyle, borderBottom: 'none' }}>
          <span style={metricLabelStyle}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: signal.color,
              opacity: 0.6
            }} />
            Gap
          </span>
          <span style={{ ...metricValueStyle, color: signal.color }}>
            {formatNumber(bedsNeeded)} beds
          </span>
        </div>

        {/* Progress bar visualization */}
        <div style={progressContainerStyle}>
          <div style={progressBarStyle}>
            <div style={filledStyle}>
              {filledPercent > 20 && 'Current'}
            </div>
            <div style={gapStyle}>
              {gapPercent > 20 && 'Gap'}
            </div>
          </div>
          <div style={progressLabelContainerStyle}>
            <span>0</span>
            <span>Estimated Need: {formatNumber(alNeed)}</span>
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div style={rankingSectionStyle}>
        <div style={rankingRowStyle}>
          <span style={rankingLabelStyle}>Gap Ranking:</span>
          <span style={rankingValueStyle}>
            #{ranking.rank}/{ranking.total}
          </span>
          {ranking.context && (
            <span style={rankingLabelStyle}>{ranking.context}</span>
          )}
        </div>
        <div style={rankingHintStyle}>
          (Higher gap = more opportunity)
        </div>
      </div>
    </div>
  );
};

SupplyGapDisplay.propTypes = {
  /** Estimated AL need in beds */
  alNeed: PropTypes.number.isRequired,
  /** Current capacity in beds */
  currentCapacity: PropTypes.number.isRequired,
  /** Coverage ratio percentage */
  coverageRatio: PropTypes.number.isRequired,
  /** Gap in beds needed */
  bedsNeeded: PropTypes.number.isRequired,
  /** Gap ranking data */
  ranking: PropTypes.shape({
    rank: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    context: PropTypes.string
  }).isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

SupplyGapDisplay.defaultProps = {
  className: ''
};

export default SupplyGapDisplay;
