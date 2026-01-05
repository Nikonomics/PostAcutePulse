/**
 * StateHoverCard.jsx
 *
 * A hover card popup that appears when hovering over a state on the national map.
 * Shows state grades breakdown and key highlights.
 *
 * Props:
 * - stateCode: string (required) - two-letter state code
 * - stateName: string (required) - full state name
 * - grades: object (required) - grades for overall, snf, alf, hha
 * - highlights: object (required) - marketCount, totalTam, topMarket, archetypeDominant
 * - position: { x, y } (required) - screen position for the card
 * - className: string (optional)
 *
 * Usage:
 * <StateHoverCard
 *   stateCode="ID"
 *   stateName="Idaho"
 *   grades={{
 *     overall: { grade: 'C', score: 54.2, rank: 28, total: 51 },
 *     snf: { grade: 'D', score: 48.3, rank: 35, total: 51 },
 *     alf: { grade: 'C', score: 61.2, rank: 18, total: 51 },
 *     hha: { grade: 'D', score: 44.8, rank: 38, total: 51 }
 *   }}
 *   highlights={{
 *     marketCount: 14,
 *     totalTam: '$890M',
 *     topMarket: 'Boise City',
 *     archetypeDominant: 'Home-Heavy'
 *   }}
 *   position={{ x: 400, y: 200 }}
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { GradeBadge } from '../core';
import { ARCHETYPES } from '../constants';

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
 * Arrow size for the pointer
 */
const ARROW_SIZE = 8;

const StateHoverCard = ({
  stateCode,
  stateName,
  grades,
  highlights,
  position,
  className = ''
}) => {
  // Get archetype config for icon
  const archetypeConfig = ARCHETYPES[highlights.archetypeDominant] || {
    icon: '📊',
    label: highlights.archetypeDominant || 'Mixed'
  };

  // Container styles - positioned absolutely
  const containerStyle = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    transform: 'translate(-50%, calc(-100% - 12px))', // Center horizontally, position above with gap for arrow
    zIndex: 1000,
    maxWidth: 280,
    minWidth: 240,
    backgroundColor: 'white',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    animation: 'stateHoverCardIn 0.15s ease-out',
    pointerEvents: 'none' // Prevent card from interfering with hover
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
    filter: 'drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1))'
  };

  // Header styles
  const headerStyle = {
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb'
  };

  const stateNameStyle = {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
    margin: 0
  };

  // Grades section styles
  const gradesSectionStyle = {
    padding: '10px 14px',
    borderBottom: '1px solid #e5e7eb'
  };

  const gradeRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    gap: 8
  };

  const gradeLabelStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: '#6b7280',
    width: 50,
    flexShrink: 0
  };

  const gradeValueContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end'
  };

  const scoreStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    width: 36,
    textAlign: 'right'
  };

  const rankStyle = {
    fontSize: 12,
    color: '#9ca3af',
    width: 50,
    textAlign: 'right'
  };

  // Highlights section styles
  const highlightsSectionStyle = {
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  };

  const highlightRowStyle = {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 1.4
  };

  const highlightLabelStyle = {
    color: '#9ca3af'
  };

  const highlightValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  const archetypeRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#4b5563'
  };

  const archetypeIconStyle = {
    fontSize: 14
  };

  return (
    <>
      {/* Inject keyframes for animation */}
      <style>
        {`
          @keyframes stateHoverCardIn {
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
        aria-label={`${stateName} market grades`}
      >
        {/* Header with state name */}
        <div style={headerStyle}>
          <h3 style={stateNameStyle}>{stateName}</h3>
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
                  <span style={rankStyle}>
                    #{gradeData.rank}/{gradeData.total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Highlights section */}
        <div style={highlightsSectionStyle}>
          {/* Market count and TAM */}
          <div style={highlightRowStyle}>
            <span style={highlightValueStyle}>{highlights.marketCount}</span>
            <span> markets</span>
            <span style={{ margin: '0 6px', color: '#d1d5db' }}>•</span>
            <span style={highlightValueStyle}>{highlights.totalTam}</span>
            <span> TAM</span>
          </div>

          {/* Top market */}
          <div style={highlightRowStyle}>
            <span style={highlightLabelStyle}>Top: </span>
            <span style={highlightValueStyle}>{highlights.topMarket}</span>
          </div>

          {/* Dominant archetype */}
          <div style={archetypeRowStyle}>
            <span style={archetypeIconStyle} aria-hidden="true">
              {archetypeConfig.icon}
            </span>
            <span>
              Mostly <span style={highlightValueStyle}>{archetypeConfig.label}</span>
            </span>
          </div>
        </div>

        {/* Arrow pointer */}
        <div style={arrowStyle} aria-hidden="true" />
      </div>
    </>
  );
};

StateHoverCard.propTypes = {
  /** Two-letter state code */
  stateCode: PropTypes.string.isRequired,
  /** Full state name */
  stateName: PropTypes.string.isRequired,
  /** Grade data for each category */
  grades: PropTypes.shape({
    overall: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired,
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired,
    snf: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired,
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired,
    alf: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired,
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired,
    hha: PropTypes.shape({
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired,
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired
  }).isRequired,
  /** Highlight statistics */
  highlights: PropTypes.shape({
    marketCount: PropTypes.number.isRequired,
    totalTam: PropTypes.string.isRequired,
    topMarket: PropTypes.string.isRequired,
    archetypeDominant: PropTypes.string.isRequired
  }).isRequired,
  /** Screen position for the card */
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

StateHoverCard.defaultProps = {
  className: ''
};

export default StateHoverCard;
