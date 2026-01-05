/**
 * MetricRow.jsx
 *
 * A reusable row component for displaying a metric label, value,
 * and optional comparison/rank information.
 *
 * Props:
 * - label: string (required) - metric name
 * - value: string | number (required) - the metric value
 * - suffix: string (optional) - e.g., "%", "beds", "/1k"
 * - comparison: object (optional) - comparison data
 * - rank: object (optional) - ranking data
 * - highlight: 'good' | 'warning' | 'bad' | null (optional)
 * - tooltip: string (optional) - help text
 * - className: string (optional)
 *
 * Usage:
 * <MetricRow
 *   label="Avg Occupancy"
 *   value={78.2}
 *   suffix="%"
 *   comparison={{ stateValue: 74.2, direction: 'up' }}
 *   highlight="good"
 * />
 * <MetricRow
 *   label="Beds per 1k 65+"
 *   value={21.5}
 *   rank={{ rank: 10, total: 14, context: "in state" }}
 *   highlight="warning"
 *   tooltip="Number of SNF beds per 1,000 population aged 65+"
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

/**
 * Highlight color configuration
 */
const HIGHLIGHT_COLORS = {
  good: '#16a34a',    // Green
  warning: '#f59e0b', // Orange/Amber
  bad: '#dc2626'      // Red
};

/**
 * Direction arrow configuration
 */
const DIRECTION_CONFIG = {
  up: { arrow: '↑', color: '#16a34a' },
  down: { arrow: '↓', color: '#dc2626' },
  neutral: { arrow: '→', color: '#6b7280' }
};

/**
 * Format a numeric value for display
 */
const formatValue = (value) => {
  if (typeof value === 'number') {
    // Format with appropriate decimal places
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }
  return value;
};

const MetricRow = ({
  label,
  value,
  suffix = '',
  comparison,
  rank,
  highlight,
  tooltip,
  className = ''
}) => {
  // Container styles
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6',
    gap: 12,
    flexWrap: 'wrap'
  };

  // Label styles
  const labelContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flex: '1 1 auto',
    minWidth: 120
  };

  const labelStyle = {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 1.4
  };

  // Help icon styles
  const helpIconStyle = {
    fontSize: 12,
    color: '#9ca3af',
    cursor: 'help',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: '#f3f4f6',
    flexShrink: 0
  };

  // Value container styles
  const valueContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0
  };

  // Value styles
  const valueStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: highlight ? HIGHLIGHT_COLORS[highlight] : '#111827',
    whiteSpace: 'nowrap'
  };

  // Suffix styles
  const suffixStyle = {
    fontSize: 13,
    fontWeight: 400,
    color: highlight ? HIGHLIGHT_COLORS[highlight] : '#6b7280',
    marginLeft: 2
  };

  // Comparison styles
  const comparisonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#6b7280',
    whiteSpace: 'nowrap'
  };

  const getArrowStyle = (direction) => ({
    color: DIRECTION_CONFIG[direction]?.color || '#6b7280',
    fontWeight: 600
  });

  // Rank styles
  const rankStyle = {
    fontSize: 12,
    color: '#6b7280',
    whiteSpace: 'nowrap'
  };

  const rankValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  // Render comparison info
  const renderComparison = () => {
    if (!comparison) return null;

    const direction = comparison.direction || 'neutral';
    const dirConfig = DIRECTION_CONFIG[direction];
    const compareValue = comparison.stateValue ?? comparison.nationalValue;
    const compareLabel = comparison.stateLabel ||
      (comparison.stateValue !== undefined ? 'state' : "nat'l");

    return (
      <span style={comparisonStyle}>
        <span style={getArrowStyle(direction)}>{dirConfig.arrow}</span>
        <span>vs {formatValue(compareValue)} {compareLabel}</span>
      </span>
    );
  };

  // Render rank info
  const renderRank = () => {
    if (!rank) return null;

    return (
      <span style={rankStyle}>
        <span style={rankValueStyle}>#{rank.rank}/{rank.total}</span>
        {rank.context && <span> {rank.context}</span>}
      </span>
    );
  };

  // Render tooltip wrapper
  const renderWithTooltip = (content) => {
    if (!tooltip) return content;

    return (
      <OverlayTrigger
        placement="top"
        overlay={
          <Tooltip id={`tooltip-${label.replace(/\s+/g, '-').toLowerCase()}`}>
            {tooltip}
          </Tooltip>
        }
      >
        {content}
      </OverlayTrigger>
    );
  };

  // Label with optional tooltip
  const labelContent = (
    <div style={labelContainerStyle}>
      <span style={labelStyle}>{label}</span>
      {tooltip && (
        <span style={helpIconStyle} aria-hidden="true">?</span>
      )}
    </div>
  );

  return (
    <div
      style={containerStyle}
      className={className}
      role="row"
      aria-label={`${label}: ${formatValue(value)}${suffix}`}
    >
      {/* Label with optional tooltip */}
      {tooltip ? renderWithTooltip(labelContent) : labelContent}

      {/* Value and comparison/rank */}
      <div style={valueContainerStyle}>
        <span style={valueStyle}>
          {formatValue(value)}
          {suffix && <span style={suffixStyle}>{suffix}</span>}
        </span>
        {renderComparison()}
        {renderRank()}
      </div>
    </div>
  );
};

MetricRow.propTypes = {
  /** Metric label/name */
  label: PropTypes.string.isRequired,
  /** Metric value */
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  /** Value suffix (e.g., "%", "beds") */
  suffix: PropTypes.string,
  /** Comparison data */
  comparison: PropTypes.shape({
    stateValue: PropTypes.number,
    nationalValue: PropTypes.number,
    stateLabel: PropTypes.string,
    direction: PropTypes.oneOf(['up', 'down', 'neutral'])
  }),
  /** Rank data */
  rank: PropTypes.shape({
    rank: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    context: PropTypes.string
  }),
  /** Highlight color */
  highlight: PropTypes.oneOf(['good', 'warning', 'bad']),
  /** Tooltip help text */
  tooltip: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string
};

MetricRow.defaultProps = {
  suffix: '',
  comparison: null,
  rank: null,
  highlight: null,
  tooltip: null,
  className: ''
};

export default MetricRow;
