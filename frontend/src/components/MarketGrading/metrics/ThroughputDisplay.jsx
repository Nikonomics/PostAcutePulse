/**
 * ThroughputDisplay.jsx
 *
 * Shows HHA throughput/capture metrics with visual representation
 * of captured vs uncaptured SNF discharges.
 *
 * Props:
 * - captureRatio: number (required) - e.g., 0.59
 * - capturePct: number (required) - as percentage e.g., 59
 * - uncapturedPct: number (required) - e.g., 41
 * - dischargesPerAgency: number (required)
 * - snfMonthlyDischarges: number (optional)
 * - hhaAnnualEpisodes: number (optional)
 * - signal: 'opportunity' | 'moderate' | 'saturated' (required)
 * - ranking: object (required)
 * - className: string (optional)
 *
 * Usage:
 * <ThroughputDisplay
 *   captureRatio={0.59}
 *   capturePct={59}
 *   uncapturedPct={41}
 *   dischargesPerAgency={895.5}
 *   snfMonthlyDischarges={500}
 *   hhaAnnualEpisodes={4214}
 *   signal="opportunity"
 *   ranking={{ rank: 5, total: 14 }}
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Signal configuration
 */
const SIGNAL_CONFIG = {
  opportunity: {
    label: 'Opportunity',
    color: '#22c55e',
    description: 'Low capture = room for growth'
  },
  moderate: {
    label: 'Moderate',
    color: '#eab308',
    description: 'Balanced capture rate'
  },
  saturated: {
    label: 'Saturated',
    color: '#ef4444',
    description: 'High capture = competitive'
  }
};

const ThroughputDisplay = ({
  captureRatio,
  capturePct,
  uncapturedPct,
  dischargesPerAgency,
  snfMonthlyDischarges,
  hhaAnnualEpisodes,
  signal,
  ranking,
  className = ''
}) => {
  const signalConfig = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.moderate;

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

  // Capture ratio section styles
  const ratioSectionStyle = {
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
    backgroundColor: '#f9fafb'
  };

  const ratioLabelStyle = {
    fontSize: 14,
    color: '#6b7280'
  };

  const ratioValueStyle = {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827'
  };

  const signalBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    backgroundColor: `${signalConfig.color}15`,
    border: `1px solid ${signalConfig.color}40`,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: signalConfig.color
  };

  // Bar section styles
  const barSectionStyle = {
    padding: '0 20px 20px 20px'
  };

  const barRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10
  };

  const barLabelStyle = {
    fontSize: 13,
    color: '#4b5563',
    width: 90,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6
  };

  const colorDotStyle = (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0
  });

  const barContainerStyle = {
    flex: 1,
    height: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden'
  };

  const getBarFillStyle = (percent, color) => ({
    width: `${Math.min(100, Math.max(0, percent))}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: 8,
    transition: 'width 0.3s ease'
  });

  const barValueStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    width: 40,
    textAlign: 'right',
    flexShrink: 0
  };

  // Metrics section styles
  const metricsSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid #f3f4f6'
  };

  const metricRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6'
  };

  const metricLabelStyle = {
    fontSize: 13,
    color: '#6b7280'
  };

  const metricValueStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#374151'
  };

  // Market math section styles
  const mathSectionStyle = {
    padding: '16px 20px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #f3f4f6'
  };

  const mathTitleStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 12
  };

  const mathRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6
  };

  const mathSymbolStyle = {
    width: 20,
    textAlign: 'center',
    color: '#9ca3af',
    fontWeight: 500
  };

  const mathValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  // Insight section styles
  const insightSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid #f3f4f6'
  };

  const insightTextStyle = {
    fontSize: 13,
    color: signalConfig.color,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '8px 12px',
    backgroundColor: `${signalConfig.color}10`,
    borderRadius: 8
  };

  // Ranking section styles
  const rankingSectionStyle = {
    padding: '12px 20px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13
  };

  const rankingLabelStyle = {
    color: '#6b7280'
  };

  const rankingValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000) {
      return num.toLocaleString();
    }
    return num.toFixed(1);
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>HHA Throughput Analysis</h3>
      </div>

      {/* Capture ratio */}
      <div style={ratioSectionStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={ratioLabelStyle}>Capture Ratio</div>
          <div style={ratioValueStyle}>{captureRatio.toFixed(2)}</div>
        </div>
        <span style={signalBadgeStyle}>{signalConfig.label}</span>
      </div>

      {/* Capture bars */}
      <div style={barSectionStyle}>
        <div style={barRowStyle}>
          <div style={barLabelStyle}>
            <span style={colorDotStyle('#f59e0b')} />
            <span>Captured</span>
          </div>
          <div style={barContainerStyle}>
            <div style={getBarFillStyle(capturePct, '#f59e0b')} />
          </div>
          <span style={barValueStyle}>{capturePct}%</span>
        </div>

        <div style={barRowStyle}>
          <div style={barLabelStyle}>
            <span style={colorDotStyle('#d1d5db')} />
            <span>Uncaptured</span>
          </div>
          <div style={barContainerStyle}>
            <div style={getBarFillStyle(uncapturedPct, '#d1d5db')} />
          </div>
          <span style={barValueStyle}>{uncapturedPct}%</span>
        </div>
      </div>

      {/* Discharges per agency */}
      <div style={metricsSectionStyle}>
        <div style={{ ...metricRowStyle, borderBottom: 'none', padding: '4px 0' }}>
          <span style={metricLabelStyle}>Discharges per Agency</span>
          <span style={metricValueStyle}>{formatNumber(dischargesPerAgency)}</span>
        </div>
      </div>

      {/* Market math (optional) */}
      {(snfMonthlyDischarges || hhaAnnualEpisodes) && (
        <div style={mathSectionStyle}>
          <div style={mathTitleStyle}>Market Math</div>

          {snfMonthlyDischarges && (
            <div style={mathRowStyle}>
              <span style={mathSymbolStyle}></span>
              <span>SNF Monthly Discharges:</span>
              <span style={mathValueStyle}>~{formatNumber(snfMonthlyDischarges)}</span>
            </div>
          )}

          {hhaAnnualEpisodes && (
            <div style={mathRowStyle}>
              <span style={mathSymbolStyle}>÷</span>
              <span>HHA Annual Episodes:</span>
              <span style={mathValueStyle}>{formatNumber(hhaAnnualEpisodes)}</span>
            </div>
          )}

          <div style={mathRowStyle}>
            <span style={mathSymbolStyle}>=</span>
            <span>Capture Ratio:</span>
            <span style={mathValueStyle}>{captureRatio.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Insight text */}
      <div style={insightSectionStyle}>
        <div style={insightTextStyle}>
          "{uncapturedPct}% of discharges not captured by HHA"
        </div>
      </div>

      {/* Ranking */}
      <div style={rankingSectionStyle}>
        <span style={rankingLabelStyle}>Capture Ranking:</span>
        <span style={rankingValueStyle}>
          #{ranking.rank}/{ranking.total}
        </span>
        <span style={rankingLabelStyle}>in state</span>
      </div>
    </div>
  );
};

ThroughputDisplay.propTypes = {
  /** Capture ratio (decimal) */
  captureRatio: PropTypes.number.isRequired,
  /** Captured percentage */
  capturePct: PropTypes.number.isRequired,
  /** Uncaptured percentage */
  uncapturedPct: PropTypes.number.isRequired,
  /** Discharges per agency */
  dischargesPerAgency: PropTypes.number.isRequired,
  /** SNF monthly discharges (optional) */
  snfMonthlyDischarges: PropTypes.number,
  /** HHA annual episodes (optional) */
  hhaAnnualEpisodes: PropTypes.number,
  /** Signal level */
  signal: PropTypes.oneOf(['opportunity', 'moderate', 'saturated']).isRequired,
  /** Ranking data */
  ranking: PropTypes.shape({
    rank: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired
  }).isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

ThroughputDisplay.defaultProps = {
  snfMonthlyDischarges: undefined,
  hhaAnnualEpisodes: undefined,
  className: ''
};

export default ThroughputDisplay;
