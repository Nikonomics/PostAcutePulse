/**
 * MarketCard.jsx
 *
 * A card representing a single market in list/grid views.
 * Shows rank, name, grades, TAM, and archetype in a horizontal layout.
 *
 * Props:
 * - rank: number (required)
 * - cbsaCode: string (required)
 * - name: string (required)
 * - state: string (required)
 * - grades: { overall: string, snf: string, alf: string, hha: string } (required)
 * - scores: { overall: number, snf: number, alf: number, hha: number } (required)
 * - tam: { total: number, formatted: string } (required)
 * - archetype: string (required)
 * - isSelected: boolean (default: false)
 * - onSelect: (selected: boolean) => void (optional)
 * - onClick: () => void (required)
 * - className: string (optional)
 *
 * Usage:
 * <MarketCard
 *   rank={388}
 *   cbsaCode="14260"
 *   name="Boise City"
 *   state="ID"
 *   grades={{ overall: 'C', snf: 'D', alf: 'C', hha: 'C' }}
 *   scores={{ overall: 58.0, snf: 51.2, alf: 66.4, hha: 54.8 }}
 *   tam={{ total: 234000000, formatted: '$234M' }}
 *   archetype="Home-Heavy"
 *   isSelected={false}
 *   onSelect={(selected) => handleSelect('14260', selected)}
 *   onClick={() => navigate('/markets/14260')}
 * />
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { GradeBadge, ArchetypeTag } from '../core';

/**
 * Care type configuration for sub-grade badges
 */
const CARE_TYPES = {
  snf: { label: 'SNF', color: '#8b5cf6' },
  alf: { label: 'ALF', color: '#06b6d4' },
  hha: { label: 'HHA', color: '#f59e0b' }
};

const MarketCard = ({
  rank,
  cbsaCode,
  name,
  state,
  grades,
  scores,
  tam,
  archetype,
  isSelected = false,
  onSelect,
  onClick,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Container styles
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 16px',
    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
    borderRadius: 10,
    border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: isHovered
      ? '0 4px 12px rgba(0, 0, 0, 0.1)'
      : '0 1px 3px rgba(0, 0, 0, 0.05)',
    userSelect: 'none'
  };

  // Checkbox styles
  const checkboxContainerStyle = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const checkboxStyle = {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: '#3b82f6'
  };

  // Rank styles
  const rankStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#6b7280',
    minWidth: 45,
    flexShrink: 0
  };

  // Main content styles
  const mainContentStyle = {
    flex: 1,
    minWidth: 0, // Allow text truncation
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  };

  // Top row (name + overall grade)
  const topRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  };

  const nameStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const stateStyle = {
    color: '#6b7280',
    fontWeight: 500
  };

  // Middle row (score + sub-grades)
  const middleRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13
  };

  const overallScoreStyle = {
    color: '#4b5563',
    fontWeight: 500
  };

  const subGradesContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };

  const subGradeItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#6b7280'
  };

  const subGradeBadgeStyle = (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    fontSize: 10,
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: color,
    borderRadius: 3
  });

  // Bottom row (TAM + archetype)
  const bottomRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13
  };

  const tamStyle = {
    color: '#374151',
    fontWeight: 500
  };

  const tamLabelStyle = {
    color: '#9ca3af',
    fontWeight: 400
  };

  // Handle checkbox click (stop propagation to prevent card click)
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
  };

  const handleCheckboxChange = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(e.target.checked);
    }
  };

  // Handle card click
  const handleCardClick = () => {
    onClick();
  };

  // Get grade color for sub-badge
  const getGradeColor = (grade) => {
    const gradeColors = {
      'A+': '#059669',
      'A': '#10b981',
      'B+': '#22c55e',
      'B': '#84cc16',
      'C': '#eab308',
      'D': '#f97316',
      'F': '#ef4444'
    };
    return gradeColors[grade] || '#6b7280';
  };

  return (
    <div
      style={containerStyle}
      className={className}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-selected={isSelected}
      data-cbsa={cbsaCode}
    >
      {/* Checkbox (if onSelect provided) */}
      {onSelect && (
        <div style={checkboxContainerStyle}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={handleCheckboxClick}
            style={checkboxStyle}
            aria-label={`Select ${name}, ${state}`}
          />
        </div>
      )}

      {/* Rank */}
      <div style={rankStyle}>#{rank}</div>

      {/* Main content */}
      <div style={mainContentStyle}>
        {/* Top row: Name */}
        <div style={topRowStyle}>
          <div style={nameStyle}>
            {name}, <span style={stateStyle}>{state}</span>
          </div>
        </div>

        {/* Middle row: Overall score + sub-grades */}
        <div style={middleRowStyle}>
          <span style={overallScoreStyle}>
            Overall: {scores.overall.toFixed(1)}
          </span>
          <div style={subGradesContainerStyle}>
            {Object.entries(CARE_TYPES).map(([key, config]) => (
              <div key={key} style={subGradeItemStyle}>
                <span>{config.label}:</span>
                <span style={subGradeBadgeStyle(getGradeColor(grades[key]))}>
                  {grades[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row: TAM + archetype */}
        <div style={bottomRowStyle}>
          <span style={tamStyle}>
            <span style={tamLabelStyle}>TAM:</span> {tam.formatted}
          </span>
          <ArchetypeTag archetype={archetype} size="sm" />
        </div>
      </div>

      {/* Overall grade badge */}
      <GradeBadge grade={grades.overall} size="lg" />
    </div>
  );
};

MarketCard.propTypes = {
  /** Market rank */
  rank: PropTypes.number.isRequired,
  /** CBSA code */
  cbsaCode: PropTypes.string.isRequired,
  /** Market name */
  name: PropTypes.string.isRequired,
  /** State abbreviation */
  state: PropTypes.string.isRequired,
  /** Grade letters by category */
  grades: PropTypes.shape({
    overall: PropTypes.string.isRequired,
    snf: PropTypes.string.isRequired,
    alf: PropTypes.string.isRequired,
    hha: PropTypes.string.isRequired
  }).isRequired,
  /** Numeric scores by category */
  scores: PropTypes.shape({
    overall: PropTypes.number.isRequired,
    snf: PropTypes.number.isRequired,
    alf: PropTypes.number.isRequired,
    hha: PropTypes.number.isRequired
  }).isRequired,
  /** TAM data */
  tam: PropTypes.shape({
    total: PropTypes.number.isRequired,
    formatted: PropTypes.string.isRequired
  }).isRequired,
  /** Market archetype */
  archetype: PropTypes.oneOf([
    'Home-Heavy',
    'SNF-Heavy',
    'HHA-Heavy',
    'Institutional',
    'Balanced'
  ]).isRequired,
  /** Whether card is selected */
  isSelected: PropTypes.bool,
  /** Selection callback (enables checkbox) */
  onSelect: PropTypes.func,
  /** Click handler */
  onClick: PropTypes.func.isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

MarketCard.defaultProps = {
  isSelected: false,
  onSelect: undefined,
  className: ''
};

export default MarketCard;
