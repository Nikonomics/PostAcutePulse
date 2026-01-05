/**
 * MarketHoverCard.jsx
 *
 * A hover card popup for CBSA/county areas on state detail maps.
 * Shows market grades and key stats in a compact format.
 *
 * Props:
 * - code: string (required) - CBSA code or county FIPS
 * - name: string (required) - market name
 * - type: 'cbsa' | 'county' (required)
 * - grades: object (required) - grades for overall, snf, alf, hha
 * - tam: string (required) - formatted TAM value
 * - stateRank: number (required) - rank within state
 * - stateTotal: number (required) - total markets in state
 * - position: { x, y } (required) - screen position for the card
 * - className: string (optional)
 *
 * Usage:
 * <MarketHoverCard
 *   code="14260"
 *   name="Boise City, ID"
 *   type="cbsa"
 *   grades={{
 *     overall: { grade: 'C', score: 58.0 },
 *     snf: { grade: 'D', score: 51.2 },
 *     alf: { grade: 'C', score: 66.4 },
 *     hha: { grade: 'C', score: 54.8 }
 *   }}
 *   tam="$234M"
 *   stateRank={1}
 *   stateTotal={14}
 *   position={{ x: 300, y: 150 }}
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { GradeBadge } from '../core';

/**
 * Grade row labels
 */
const GRADE_ROWS = [
  { key: 'overall', label: 'Overall' },
  { key: 'snf', label: 'SNF' },
  { key: 'alf', label: 'ALF' },
  { key: 'hha', label: 'HHA' }
];

/**
 * Type labels
 */
const TYPE_LABELS = {
  cbsa: 'CBSA',
  county: 'County'
};

/**
 * Arrow size for the pointer
 */
const ARROW_SIZE = 8;

const MarketHoverCard = ({
  code,
  name,
  type,
  grades,
  tam,
  stateRank,
  stateTotal,
  position,
  className = ''
}) => {
  const typeLabel = TYPE_LABELS[type] || type.toUpperCase();

  // Container styles - positioned absolutely
  const containerStyle = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, calc(-100% - 12px))',
    zIndex: 1000,
    maxWidth: 260,
    minWidth: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    animation: 'marketHoverCardIn 0.15s ease-out',
    pointerEvents: 'none'
  };

  // Arrow styles (CSS triangle pointing down)
  const arrowStyle = {
    position: 'absolute',
    bottom: -ARROW_SIZE,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: `${ARROW_SIZE}px solid transparent`,
    borderRight: `${ARROW_SIZE}px solid transparent`,
    borderTop: `${ARROW_SIZE}px solid white`,
    filter: 'drop-shadow(0 2px 2px rgba(0, 0, 0, 0.08))'
  };

  // Header styles
  const headerStyle = {
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb'
  };

  const nameContainerStyle = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap'
  };

  const nameStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
    margin: 0,
    lineHeight: 1.3
  };

  const typeIndicatorStyle = {
    fontSize: 11,
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  };

  // Grades section styles
  const gradesSectionStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid #e5e7eb'
  };

  const gradeRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '3px 0',
    gap: 8
  };

  const gradeLabelStyle = {
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    width: 48,
    flexShrink: 0
  };

  const gradeValueContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end'
  };

  const scoreStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    width: 32,
    textAlign: 'right'
  };

  // Footer section styles
  const footerStyle = {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  };

  const statsRowStyle = {
    fontSize: 12,
    color: '#4b5563',
    display: 'flex',
    alignItems: 'center',
    gap: 4
  };

  const statsValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  const statsSeparatorStyle = {
    color: '#d1d5db',
    margin: '0 4px'
  };

  const clickHintStyle = {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 2
  };

  return (
    <>
      {/* Inject keyframes for animation */}
      <style>
        {`
          @keyframes marketHoverCardIn {
            from {
              opacity: 0;
              transform: translate(-50%, calc(-100% - 12px)) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translate(-50%, calc(-100% - 12px)) scale(1);
            }
          }
        `}
      </style>

      <div
        style={containerStyle}
        className={className}
        role="tooltip"
        aria-label={`${name} market grades`}
      >
        {/* Header with name and type */}
        <div style={headerStyle}>
          <div style={nameContainerStyle}>
            <h4 style={nameStyle}>{name}</h4>
            <span style={typeIndicatorStyle}>({typeLabel})</span>
          </div>
        </div>

        {/* Grades breakdown */}
        <div style={gradesSectionStyle}>
          {GRADE_ROWS.map(({ key, label }) => {
            const gradeData = grades[key];
            if (!gradeData) return null;

            return (
              <div key={key} style={gradeRowStyle}>
                <span style={gradeLabelStyle}>{label}</span>
                <div style={gradeValueContainerStyle}>
                  <GradeBadge grade={gradeData.grade} size="sm" />
                  <span style={scoreStyle}>{gradeData.score.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with TAM and rank */}
        <div style={footerStyle}>
          <div style={statsRowStyle}>
            <span>TAM:</span>
            <span style={statsValueStyle}>{tam}</span>
            <span style={statsSeparatorStyle}>•</span>
            <span style={statsValueStyle}>#{stateRank}/{stateTotal}</span>
            <span>in state</span>
          </div>
          <div style={clickHintStyle}>Click to view details</div>
        </div>

        {/* Arrow pointer */}
        <div style={arrowStyle} aria-hidden="true" />
      </div>
    </>
  );
};

MarketHoverCard.propTypes = {
  /** CBSA code or county FIPS */
  code: PropTypes.string.isRequired,
  /** Market name */
  name: PropTypes.string.isRequired,
  /** Market type */
  type: PropTypes.oneOf(['cbsa', 'county']).isRequired,
  /** Grade data for each category */
  grades: PropTypes.shape({
    overall: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired
    }).isRequired,
    snf: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired
    }).isRequired,
    alf: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired
    }).isRequired,
    hha: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired
    }).isRequired
  }).isRequired,
  /** Formatted TAM value */
  tam: PropTypes.string.isRequired,
  /** Rank within the state */
  stateRank: PropTypes.number.isRequired,
  /** Total markets in the state */
  stateTotal: PropTypes.number.isRequired,
  /** Screen position for the card */
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

MarketHoverCard.defaultProps = {
  className: ''
};

export default MarketHoverCard;
