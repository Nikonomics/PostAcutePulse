/**
 * ScoreTypeToggle.jsx
 *
 * A toggle button group for selecting which score type to display.
 * Options: Overall, SNF, ALF, HHA
 *
 * Props:
 * - value: 'overall' | 'snf' | 'alf' | 'hha' (required)
 * - onChange: (value) => void (required)
 * - size: 'sm' | 'md' (default: 'md')
 * - className: string (optional)
 *
 * Usage:
 * const [scoreType, setScoreType] = useState('overall');
 * <ScoreTypeToggle value={scoreType} onChange={setScoreType} />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { CARE_TYPES } from '../constants';

/**
 * Score type configuration
 */
const SCORE_TYPES = [
  {
    value: 'overall',
    label: 'Overall',
    fullLabel: 'Overall Score',
    color: '#3b82f6' // Primary blue
  },
  {
    value: 'snf',
    label: CARE_TYPES.SNF?.shortLabel || 'SNF',
    fullLabel: CARE_TYPES.SNF?.description || 'Skilled Nursing Facilities',
    color: CARE_TYPES.SNF?.color || '#8b5cf6'
  },
  {
    value: 'alf',
    label: CARE_TYPES.ALF?.shortLabel || 'ALF',
    fullLabel: CARE_TYPES.ALF?.description || 'Assisted Living Facilities',
    color: CARE_TYPES.ALF?.color || '#06b6d4'
  },
  {
    value: 'hha',
    label: CARE_TYPES.HHA?.shortLabel || 'HHA',
    fullLabel: CARE_TYPES.HHA?.description || 'Home Health Agencies',
    color: CARE_TYPES.HHA?.color || '#f59e0b'
  }
];

/**
 * Size configuration
 */
const SIZE_CONFIG = {
  sm: {
    fontSize: 12,
    paddingX: 10,
    paddingY: 4,
    gap: 0
  },
  md: {
    fontSize: 14,
    paddingX: 14,
    paddingY: 6,
    gap: 0
  }
};

const ScoreTypeToggle = ({
  value,
  onChange,
  size = 'md',
  className = ''
}) => {
  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  // Container styles
  const containerStyle = {
    display: 'inline-flex',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb'
  };

  // Get button styles based on active state
  const getButtonStyle = (type, isActive) => {
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: sizeConfig.fontSize,
      fontWeight: 500,
      padding: `${sizeConfig.paddingY}px ${sizeConfig.paddingX}px`,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      outline: 'none',
      whiteSpace: 'nowrap'
    };

    if (isActive) {
      return {
        ...baseStyle,
        backgroundColor: type.color,
        color: 'white',
        boxShadow: `0 1px 3px ${type.color}40`
      };
    }

    return {
      ...baseStyle,
      backgroundColor: 'transparent',
      color: '#6b7280'
    };
  };

  // Hover styles handler
  const handleMouseEnter = (e, type, isActive) => {
    if (!isActive) {
      e.currentTarget.style.backgroundColor = '#f3f4f6';
      e.currentTarget.style.color = type.color;
    }
  };

  const handleMouseLeave = (e, type, isActive) => {
    if (!isActive) {
      e.currentTarget.style.backgroundColor = 'transparent';
      e.currentTarget.style.color = '#6b7280';
    }
  };

  // Divider style between inactive buttons
  const getDividerStyle = (index, isActive, nextIsActive) => {
    // Don't show divider if current or next button is active
    if (isActive || nextIsActive || index === SCORE_TYPES.length - 1) {
      return null;
    }
    return {
      width: 1,
      backgroundColor: '#e5e7eb',
      alignSelf: 'stretch',
      margin: '4px 0'
    };
  };

  return (
    <div
      style={containerStyle}
      className={className}
      role="group"
      aria-label="Score type selection"
    >
      {SCORE_TYPES.map((type, index) => {
        const isActive = value === type.value;
        const nextType = SCORE_TYPES[index + 1];
        const nextIsActive = nextType && value === nextType.value;
        const dividerStyle = getDividerStyle(index, isActive, nextIsActive);

        return (
          <React.Fragment key={type.value}>
            <button
              type="button"
              style={getButtonStyle(type, isActive)}
              onClick={() => onChange(type.value)}
              onMouseEnter={(e) => handleMouseEnter(e, type, isActive)}
              onMouseLeave={(e) => handleMouseLeave(e, type, isActive)}
              title={type.fullLabel}
              aria-pressed={isActive}
              aria-label={`Select ${type.fullLabel}`}
            >
              {type.label}
            </button>
            {dividerStyle && <div style={dividerStyle} aria-hidden="true" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

ScoreTypeToggle.propTypes = {
  /** Currently selected score type */
  value: PropTypes.oneOf(['overall', 'snf', 'alf', 'hha']).isRequired,
  /** Callback when selection changes */
  onChange: PropTypes.func.isRequired,
  /** Size variant */
  size: PropTypes.oneOf(['sm', 'md']),
  /** Additional CSS class names */
  className: PropTypes.string
};

ScoreTypeToggle.defaultProps = {
  size: 'md',
  className: ''
};

export default ScoreTypeToggle;
