/**
 * RankDisplay.jsx
 *
 * Displays ranking information in a formatted string.
 * Examples: "#28/51 nationally" or "#28/51 nat'l • #6/14 in ID"
 *
 * Props:
 * - rank: number (required) - primary rank position
 * - total: number (required) - total items being ranked
 * - context: string (optional) - context label e.g., "nationally", "in state"
 * - stateRank: number (optional) - secondary state rank
 * - stateTotal: number (optional) - total items in state
 * - stateName: string (optional) - state abbreviation e.g., "ID"
 * - size: 'sm' | 'md' (default: 'md')
 * - className: string (optional)
 *
 * Usage:
 * <RankDisplay rank={388} total={879} context="nationally" />
 * <RankDisplay rank={388} total={879} stateRank={6} stateTotal={14} stateName="ID" />
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Size configuration
 */
const SIZE_CONFIG = {
  sm: {
    fontSize: 12,
    arrowSize: 10,
    gap: 4
  },
  md: {
    fontSize: 14,
    arrowSize: 12,
    gap: 6
  }
};

/**
 * Arrow indicator component
 */
const RankArrow = ({ direction, size }) => {
  const arrowStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: 4
  };

  if (direction === 'up') {
    return (
      <span style={arrowStyle} title="Top 10%">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </span>
    );
  }

  if (direction === 'down') {
    return (
      <span style={arrowStyle} title="Bottom 10%">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    );
  }

  return null;
};

RankArrow.propTypes = {
  direction: PropTypes.oneOf(['up', 'down', null]),
  size: PropTypes.number
};

/**
 * Get arrow direction based on percentile
 * @param {number} rank
 * @param {number} total
 * @returns {'up' | 'down' | null}
 */
const getArrowDirection = (rank, total) => {
  if (!rank || !total) return null;
  const percentile = (rank / total) * 100;
  if (percentile <= 10) return 'up';    // Top 10%
  if (percentile >= 90) return 'down';  // Bottom 10%
  return null;
};

const RankDisplay = ({
  rank,
  total,
  context,
  stateRank,
  stateTotal,
  stateName,
  size = 'md',
  className = ''
}) => {
  // Defensive check: if required props are missing, don't render
  if (rank === undefined || rank === null || total === undefined || total === null) {
    return null;
  }

  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const arrowDirection = getArrowDirection(rank, total);
  const hasStateRank = stateRank && stateTotal;

  const containerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: sizeConfig.fontSize,
    color: '#6b7280', // text-secondary equivalent
    fontWeight: 400,
    lineHeight: 1.4
  };

  const rankNumberStyle = {
    fontWeight: 600,
    color: '#4b5563' // slightly darker for emphasis
  };

  const separatorStyle = {
    margin: `0 ${sizeConfig.gap}px`,
    color: '#9ca3af'
  };

  // Format the primary rank string
  const formatRank = (r, t, ctx) => {
    const rankStr = `#${r.toLocaleString()}`;
    const totalStr = t.toLocaleString();
    const contextStr = ctx ? ` ${ctx}` : '';
    return { rankStr, totalStr, contextStr };
  };

  const primary = formatRank(rank, total, hasStateRank ? "nat'l" : context);

  return (
    <span style={containerStyle} className={className}>
      {/* Primary rank */}
      <span>
        <span style={rankNumberStyle}>{primary.rankStr}</span>
        <span>/{primary.totalStr}</span>
        <span>{primary.contextStr}</span>
      </span>

      {/* State rank (if provided) */}
      {hasStateRank && (
        <>
          <span style={separatorStyle}>•</span>
          <span>
            <span style={rankNumberStyle}>#{stateRank.toLocaleString()}</span>
            <span>/{stateTotal.toLocaleString()}</span>
            <span> in {stateName || 'state'}</span>
          </span>
        </>
      )}

      {/* Arrow indicator */}
      <RankArrow direction={arrowDirection} size={sizeConfig.arrowSize} />
    </span>
  );
};

RankDisplay.propTypes = {
  /** Primary rank position */
  rank: PropTypes.number.isRequired,
  /** Total items in primary ranking */
  total: PropTypes.number.isRequired,
  /** Context label for primary rank (e.g., "nationally") */
  context: PropTypes.string,
  /** State-level rank position */
  stateRank: PropTypes.number,
  /** Total items in state ranking */
  stateTotal: PropTypes.number,
  /** State abbreviation (e.g., "ID") */
  stateName: PropTypes.string,
  /** Size variant */
  size: PropTypes.oneOf(['sm', 'md']),
  /** Additional CSS class names */
  className: PropTypes.string
};

RankDisplay.defaultProps = {
  context: '',
  stateRank: null,
  stateTotal: null,
  stateName: '',
  size: 'md',
  className: ''
};

export default RankDisplay;
