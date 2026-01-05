/**
 * GradeBadge.jsx
 *
 * Displays a letter grade (A+, A, B+, B, C, D, F) with appropriate
 * color coding for market attractiveness scores.
 *
 * Props:
 * - grade: string (A+, A, B+, B, C, D, F) - required
 * - size: 'sm' | 'md' | 'lg' - default 'md'
 * - showLabel: boolean - whether to show "Grade X" label - default false
 * - className: string - additional CSS classes
 *
 * Usage:
 * <GradeBadge grade="A" />
 * <GradeBadge grade="C" size="lg" />
 * <GradeBadge grade="B" showLabel />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { GRADE_COLORS } from '../constants';

/**
 * Size configuration for each variant
 */
const SIZE_CONFIG = {
  sm: {
    width: 20,
    height: 20,
    fontSize: 12,
    borderRadius: 4,
    paddingX: 6,
    labelFontSize: 10
  },
  md: {
    width: 32,
    height: 32,
    fontSize: 16,
    borderRadius: 6,
    paddingX: 10,
    labelFontSize: 12
  },
  lg: {
    width: 48,
    height: 48,
    fontSize: 24,
    borderRadius: 8,
    paddingX: 14,
    labelFontSize: 14
  }
};

const GradeBadge = ({ grade, size = 'md', showLabel = false, className = '' }) => {
  // Get color configuration for the grade
  const gradeColor = GRADE_COLORS[grade] || { bg: '#6b7280', text: 'white', label: 'Unknown' };
  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  // Base styles for badge-only display
  const badgeOnlyStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: sizeConfig.width,
    height: sizeConfig.height,
    backgroundColor: gradeColor.bg,
    color: gradeColor.text,
    fontSize: sizeConfig.fontSize,
    fontWeight: 700,
    borderRadius: sizeConfig.borderRadius,
    lineHeight: 1,
    userSelect: 'none'
  };

  // Pill-shaped styles for label display
  const labelStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: sizeConfig.height,
    paddingLeft: sizeConfig.paddingX,
    paddingRight: sizeConfig.paddingX,
    backgroundColor: gradeColor.bg,
    color: gradeColor.text,
    fontSize: sizeConfig.labelFontSize,
    fontWeight: 600,
    borderRadius: sizeConfig.height / 2, // Pill shape
    lineHeight: 1,
    userSelect: 'none',
    whiteSpace: 'nowrap'
  };

  // Grade letter styles when showing label
  const gradeLetter = {
    fontWeight: 700,
    fontSize: sizeConfig.fontSize
  };

  if (showLabel) {
    return (
      <span style={labelStyles} className={className} title={gradeColor.label}>
        <span>Grade</span>
        <span style={gradeLetter}>{grade}</span>
      </span>
    );
  }

  return (
    <span style={badgeOnlyStyles} className={className} title={gradeColor.label}>
      {grade}
    </span>
  );
};

GradeBadge.propTypes = {
  /** Letter grade to display */
  grade: PropTypes.oneOf(['A+', 'A', 'B+', 'B', 'C', 'D', 'F']).isRequired,
  /** Size variant */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Whether to show "Grade X" label instead of just the letter */
  showLabel: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string
};

GradeBadge.defaultProps = {
  size: 'md',
  showLabel: false,
  className: ''
};

export default GradeBadge;
