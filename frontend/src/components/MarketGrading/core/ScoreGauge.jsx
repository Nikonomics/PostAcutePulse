/**
 * ScoreGauge.jsx
 *
 * Visual component that displays a score (0-100) with optional label.
 * Supports bar and circle variants with grade-based coloring.
 *
 * Props:
 * - score: number (0-100) - required
 * - label: string - optional label above the gauge
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - variant: 'bar' | 'circle' (default: 'bar')
 * - showGrade: boolean (default: true) - show letter grade
 * - className: string (optional)
 *
 * Usage:
 * <ScoreGauge score={58.0} label="Overall" />
 * <ScoreGauge score={51.2} variant="bar" size="sm" />
 * <ScoreGauge score={66.4} variant="circle" size="lg" />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { getGradeFromScore, GRADE_COLORS } from '../constants';

/**
 * Size configuration for bar variant
 */
const BAR_SIZE_CONFIG = {
  sm: {
    barHeight: 4,
    labelFontSize: 11,
    scoreFontSize: 12,
    gradeFontSize: 10,
    gap: 4,
    borderRadius: 2
  },
  md: {
    barHeight: 8,
    labelFontSize: 12,
    scoreFontSize: 14,
    gradeFontSize: 12,
    gap: 6,
    borderRadius: 4
  },
  lg: {
    barHeight: 12,
    labelFontSize: 14,
    scoreFontSize: 18,
    gradeFontSize: 14,
    gap: 8,
    borderRadius: 6
  }
};

/**
 * Size configuration for circle variant
 */
const CIRCLE_SIZE_CONFIG = {
  sm: {
    size: 60,
    strokeWidth: 4,
    scoreFontSize: 14,
    gradeFontSize: 10
  },
  md: {
    size: 80,
    strokeWidth: 6,
    scoreFontSize: 18,
    gradeFontSize: 12
  },
  lg: {
    size: 120,
    strokeWidth: 8,
    scoreFontSize: 28,
    gradeFontSize: 14
  }
};

/**
 * Bar variant component
 */
const BarGauge = ({ score, label, size, showGrade, gradeColor, grade }) => {
  const config = BAR_SIZE_CONFIG[size] || BAR_SIZE_CONFIG.md;
  const clampedScore = Math.max(0, Math.min(100, score));

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: config.gap,
    width: '100%'
  };

  const labelRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const labelStyle = {
    fontSize: config.labelFontSize,
    fontWeight: 500,
    color: '#374151'
  };

  const scoreContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  };

  const scoreStyle = {
    fontSize: config.scoreFontSize,
    fontWeight: 600,
    color: '#111827'
  };

  const gradeStyle = {
    fontSize: config.gradeFontSize,
    fontWeight: 600,
    color: gradeColor.bg,
    backgroundColor: `${gradeColor.bg}15`,
    padding: '2px 6px',
    borderRadius: 4
  };

  const barTrackStyle = {
    width: '100%',
    height: config.barHeight,
    backgroundColor: '#e5e7eb',
    borderRadius: config.borderRadius,
    overflow: 'hidden'
  };

  const barFillStyle = {
    width: `${clampedScore}%`,
    height: '100%',
    backgroundColor: gradeColor.bg,
    borderRadius: config.borderRadius,
    transition: 'width 0.5s ease-out, background-color 0.3s ease'
  };

  return (
    <div style={containerStyle}>
      {/* Label and score row */}
      <div style={labelRowStyle}>
        {label && <span style={labelStyle}>{label}</span>}
        <div style={scoreContainerStyle}>
          <span style={scoreStyle}>{score.toFixed(1)}</span>
          {showGrade && <span style={gradeStyle}>{grade}</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div style={barTrackStyle}>
        <div style={barFillStyle} />
      </div>
    </div>
  );
};

BarGauge.propTypes = {
  score: PropTypes.number.isRequired,
  label: PropTypes.string,
  size: PropTypes.string,
  showGrade: PropTypes.bool,
  gradeColor: PropTypes.object,
  grade: PropTypes.string
};

/**
 * Circle variant component
 */
const CircleGauge = ({ score, label, size, showGrade, gradeColor, grade }) => {
  const config = CIRCLE_SIZE_CONFIG[size] || CIRCLE_SIZE_CONFIG.lg;
  const clampedScore = Math.max(0, Math.min(100, score));

  // SVG circle calculations
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8
  };

  const labelStyle = {
    fontSize: config.gradeFontSize,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 4
  };

  const svgContainerStyle = {
    position: 'relative',
    width: config.size,
    height: config.size
  };

  const centerContentStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const scoreStyle = {
    fontSize: config.scoreFontSize,
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1
  };

  const gradeContainerStyle = {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const gradeBadgeStyle = {
    fontSize: config.gradeFontSize,
    fontWeight: 700,
    color: gradeColor.text,
    backgroundColor: gradeColor.bg,
    padding: '4px 10px',
    borderRadius: 6
  };

  return (
    <div style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}

      <div style={svgContainerStyle}>
        <svg
          width={config.size}
          height={config.size}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={gradeColor.bg}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease'
            }}
          />
        </svg>

        {/* Center content */}
        <div style={centerContentStyle}>
          <span style={scoreStyle}>{score.toFixed(1)}</span>
        </div>
      </div>

      {/* Grade badge below */}
      {showGrade && (
        <div style={gradeContainerStyle}>
          <span style={gradeBadgeStyle}>{grade}</span>
        </div>
      )}
    </div>
  );
};

CircleGauge.propTypes = {
  score: PropTypes.number.isRequired,
  label: PropTypes.string,
  size: PropTypes.string,
  showGrade: PropTypes.bool,
  gradeColor: PropTypes.object,
  grade: PropTypes.string
};

/**
 * Main ScoreGauge component
 */
const ScoreGauge = ({
  score,
  label,
  size = 'md',
  variant = 'bar',
  showGrade = true,
  className = ''
}) => {
  // Handle invalid scores
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0;

  // Get grade and color
  const grade = getGradeFromScore(validScore);
  const gradeColor = GRADE_COLORS[grade] || { bg: '#6b7280', text: 'white' };

  const wrapperStyle = {
    display: 'inline-block',
    width: variant === 'bar' ? '100%' : 'auto'
  };

  const commonProps = {
    score: validScore,
    label,
    size,
    showGrade,
    gradeColor,
    grade
  };

  return (
    <div style={wrapperStyle} className={className}>
      {variant === 'circle' ? (
        <CircleGauge {...commonProps} />
      ) : (
        <BarGauge {...commonProps} />
      )}
    </div>
  );
};

ScoreGauge.propTypes = {
  /** Score value from 0-100 */
  score: PropTypes.number.isRequired,
  /** Label text displayed above the gauge */
  label: PropTypes.string,
  /** Size variant */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Visual variant - bar or circle */
  variant: PropTypes.oneOf(['bar', 'circle']),
  /** Whether to display the letter grade */
  showGrade: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string
};

ScoreGauge.defaultProps = {
  label: '',
  size: 'md',
  variant: 'bar',
  showGrade: true,
  className: ''
};

export default ScoreGauge;
