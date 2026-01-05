/**
 * GradientLegend.jsx
 *
 * A horizontal or vertical gradient legend for choropleth maps
 * showing score-to-color mapping with grade labels.
 *
 * Props:
 * - min: number (required) - minimum score in dataset
 * - max: number (required) - maximum score in dataset
 * - labels: string[] (default: ['F', 'D', 'C', 'B', 'A'])
 * - orientation: 'horizontal' | 'vertical' (default: 'horizontal')
 * - width: number (default: 300) - for horizontal orientation
 * - height: number (default: 20) - bar height
 * - className: string (optional)
 *
 * Usage:
 * <GradientLegend min={38.2} max={68.4} />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { GRADE_COLORS, SCORE_THRESHOLDS } from '../constants';

/**
 * Gradient stops for the legend bar
 * Maps from low scores (red/F) to high scores (green/A)
 */
const GRADIENT_STOPS = [
  { position: 0, color: GRADE_COLORS.F?.bg || '#ef4444' },
  { position: 25, color: GRADE_COLORS.D?.bg || '#f97316' },
  { position: 50, color: GRADE_COLORS.C?.bg || '#eab308' },
  { position: 75, color: GRADE_COLORS.B?.bg || '#84cc16' },
  { position: 100, color: GRADE_COLORS.A?.bg || '#22c55e' }
];

/**
 * Default grade labels
 */
const DEFAULT_LABELS = ['F', 'D', 'C', 'B', 'A'];

/**
 * Calculate position percentage for a score within min/max range
 */
const getPositionPercent = (score, min, max) => {
  if (max === min) return 50;
  return ((score - min) / (max - min)) * 100;
};

/**
 * Get grade boundary scores that fall within the min/max range
 */
const getVisibleBoundaries = (min, max) => {
  const boundaries = [];
  const thresholds = [
    { grade: 'F', score: SCORE_THRESHOLDS.D }, // F/D boundary at 40
    { grade: 'D', score: SCORE_THRESHOLDS.C }, // D/C boundary at 50
    { grade: 'C', score: SCORE_THRESHOLDS.B }, // C/B boundary at 60
    { grade: 'B', score: SCORE_THRESHOLDS['B+'] || SCORE_THRESHOLDS.A }, // B/A boundary at 70 or 80
  ];

  thresholds.forEach(({ grade, score }) => {
    if (score > min && score < max) {
      boundaries.push({
        grade,
        score,
        position: getPositionPercent(score, min, max)
      });
    }
  });

  return boundaries;
};

const GradientLegend = ({
  min,
  max,
  labels = DEFAULT_LABELS,
  orientation = 'horizontal',
  width = 300,
  height = 20,
  className = ''
}) => {
  const isHorizontal = orientation === 'horizontal';
  const boundaries = getVisibleBoundaries(min, max);

  // Build gradient string
  const gradientDirection = isHorizontal ? 'to right' : 'to top';
  const gradientString = GRADIENT_STOPS
    .map(stop => `${stop.color} ${stop.position}%`)
    .join(', ');

  // Container styles
  const containerStyle = {
    display: 'flex',
    flexDirection: isHorizontal ? 'column' : 'row',
    alignItems: 'stretch',
    width: isHorizontal ? width : 'auto',
    gap: 6
  };

  // Gradient bar container styles
  const barContainerStyle = {
    position: 'relative',
    width: isHorizontal ? '100%' : height,
    height: isHorizontal ? height : width
  };

  // Gradient bar styles
  const barStyle = {
    width: '100%',
    height: '100%',
    background: `linear-gradient(${gradientDirection}, ${gradientString})`,
    borderRadius: 4,
    border: '1px solid #e5e7eb'
  };

  // Tick marks container
  const ticksContainerStyle = {
    position: 'absolute',
    top: isHorizontal ? '100%' : 0,
    left: isHorizontal ? 0 : '100%',
    right: isHorizontal ? 0 : 'auto',
    bottom: isHorizontal ? 'auto' : 0,
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    justifyContent: 'space-between',
    pointerEvents: 'none'
  };

  // Labels row styles
  const labelsRowStyle = {
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: isHorizontal ? '100%' : 'auto',
    height: isHorizontal ? 'auto' : '100%',
    position: 'relative'
  };

  // Min/Max value styles
  const valueStyle = {
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280'
  };

  // Grade label styles
  const gradeLabelStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase'
  };

  // Tick mark styles
  const tickStyle = (position) => ({
    position: 'absolute',
    [isHorizontal ? 'left' : 'bottom']: `${position}%`,
    [isHorizontal ? 'top' : 'left']: 0,
    transform: isHorizontal ? 'translateX(-50%)' : 'translateY(50%)',
    display: 'flex',
    flexDirection: isHorizontal ? 'column' : 'row',
    alignItems: 'center',
    gap: 2
  });

  const tickLineStyle = {
    width: isHorizontal ? 1 : 6,
    height: isHorizontal ? 6 : 1,
    backgroundColor: '#d1d5db'
  };

  return (
    <div style={containerStyle} className={className} role="img" aria-label="Score gradient legend">
      {/* Gradient bar with tick marks */}
      <div style={barContainerStyle}>
        <div style={barStyle} />

        {/* Boundary tick marks */}
        {boundaries.map(({ grade, score, position }) => (
          <div key={grade} style={tickStyle(position)}>
            <div style={tickLineStyle} />
            <span style={gradeLabelStyle}>{score}</span>
          </div>
        ))}
      </div>

      {/* Labels row with min/max values */}
      <div style={labelsRowStyle}>
        {/* Min value and grade */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isHorizontal ? 'flex-start' : 'center' }}>
          <span style={valueStyle}>{min.toFixed(1)}</span>
          <span style={{ ...gradeLabelStyle, color: GRADE_COLORS.F?.bg || '#ef4444' }}>Low</span>
        </div>

        {/* Center grades */}
        <div style={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          gap: isHorizontal ? 24 : 12,
          alignItems: 'center'
        }}>
          {labels.map((label, index) => {
            const gradeColor = GRADE_COLORS[label]?.bg || '#6b7280';
            return (
              <span
                key={label}
                style={{
                  ...gradeLabelStyle,
                  color: gradeColor,
                  fontWeight: 700
                }}
              >
                {label}
              </span>
            );
          })}
        </div>

        {/* Max value and grade */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isHorizontal ? 'flex-end' : 'center' }}>
          <span style={valueStyle}>{max.toFixed(1)}</span>
          <span style={{ ...gradeLabelStyle, color: GRADE_COLORS.A?.bg || '#22c55e' }}>High</span>
        </div>
      </div>
    </div>
  );
};

GradientLegend.propTypes = {
  /** Minimum score value in the dataset */
  min: PropTypes.number.isRequired,
  /** Maximum score value in the dataset */
  max: PropTypes.number.isRequired,
  /** Grade labels to display */
  labels: PropTypes.arrayOf(PropTypes.string),
  /** Legend orientation */
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  /** Width of the legend (for horizontal) or height (for vertical) */
  width: PropTypes.number,
  /** Height of the gradient bar */
  height: PropTypes.number,
  /** Additional CSS class names */
  className: PropTypes.string
};

GradientLegend.defaultProps = {
  labels: DEFAULT_LABELS,
  orientation: 'horizontal',
  width: 300,
  height: 20,
  className: ''
};

export default GradientLegend;
