/**
 * GradeCard.jsx
 *
 * A card component showing a grade, score, and ranking for one care type.
 * Used to display Overall, SNF, ALF, or HHA grades in a compact card format.
 *
 * Props:
 * - type: 'Overall' | 'SNF' | 'ALF' | 'HHA' (required)
 * - grade: string (required)
 * - score: number (required)
 * - percentile: number (optional)
 * - nationalRank: number (required)
 * - nationalTotal: number (required)
 * - stateRank: number (optional)
 * - stateTotal: number (optional)
 * - stateName: string (optional)
 * - onClick: () => void (optional)
 * - isActive: boolean (default: false)
 * - className: string (optional)
 *
 * Usage:
 * <GradeCard
 *   type="Overall"
 *   grade="C"
 *   score={58.0}
 *   nationalRank={388}
 *   nationalTotal={879}
 *   stateRank={6}
 *   stateTotal={14}
 *   stateName="ID"
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import GradeBadge from './GradeBadge';
import RankDisplay from './RankDisplay';
import { GRADE_COLORS, CARE_TYPES } from '../constants';

/**
 * Type label configuration
 */
const TYPE_CONFIG = {
  Overall: {
    label: 'Overall',
    color: '#374151'
  },
  SNF: {
    label: CARE_TYPES.SNF?.shortLabel || 'SNF',
    fullLabel: CARE_TYPES.SNF?.label || 'Skilled Nursing',
    color: CARE_TYPES.SNF?.color || '#8b5cf6'
  },
  ALF: {
    label: CARE_TYPES.ALF?.shortLabel || 'ALF',
    fullLabel: CARE_TYPES.ALF?.label || 'Assisted Living',
    color: CARE_TYPES.ALF?.color || '#06b6d4'
  },
  HHA: {
    label: CARE_TYPES.HHA?.shortLabel || 'HHA',
    fullLabel: CARE_TYPES.HHA?.label || 'Home Health',
    color: CARE_TYPES.HHA?.color || '#f59e0b'
  }
};

const GradeCard = ({
  type,
  grade,
  score,
  percentile,
  nationalRank,
  nationalTotal,
  stateRank,
  stateTotal,
  stateName,
  facilityCount,
  tam,
  onClick,
  isActive = false,
  className = ''
}) => {
  const typeConfig = TYPE_CONFIG[type] || TYPE_CONFIG.Overall;
  const gradeColor = GRADE_COLORS[grade] || { bg: '#6b7280', text: 'white' };
  const hasStateRank = stateRank && stateTotal;
  const isClickable = typeof onClick === 'function';
  const hasExtraMetrics = facilityCount || tam;

  // Container styles
  const cardStyle = {
    width: '100%',
    minWidth: 140,
    backgroundColor: 'white',
    borderRadius: 12,
    border: `2px solid ${isActive ? gradeColor.bg : '#e5e7eb'}`,
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    cursor: isClickable ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    boxShadow: isActive
      ? `0 4px 12px ${gradeColor.bg}25`
      : '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  // Hover styles applied via inline event handlers
  const handleMouseEnter = (e) => {
    if (isClickable) {
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }
  };

  const handleMouseLeave = (e) => {
    if (isClickable) {
      e.currentTarget.style.boxShadow = isActive
        ? `0 4px 12px ${gradeColor.bg}25`
        : '0 1px 3px rgba(0, 0, 0, 0.1)';
      e.currentTarget.style.transform = 'translateY(0)';
    }
  };

  // Type label styles
  const typeLabelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: type === 'Overall' ? '#374151' : typeConfig.color,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 4
  };

  // Score styles
  const scoreStyle = {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1,
    marginTop: 4
  };

  // Percentile styles
  const percentileStyle = {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2
  };

  // Rank container styles
  const rankContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginTop: 4
  };

  // State rank styles (slightly smaller)
  const stateRankStyle = {
    fontSize: 11,
    color: '#9ca3af'
  };

  return (
    <div
      style={cardStyle}
      className={className}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick() : undefined}
      title={typeConfig.fullLabel || typeConfig.label}
    >
      {/* Type label */}
      <span style={typeLabelStyle}>{typeConfig.label}</span>

      {/* Grade badge */}
      <GradeBadge grade={grade} size="lg" />

      {/* Score */}
      <span style={scoreStyle}>{score.toFixed(1)}</span>

      {/* Percentile (if provided) */}
      {percentile !== undefined && (
        <span style={percentileStyle}>
          {percentile.toFixed(0)}th percentile
        </span>
      )}

      {/* Rankings */}
      <div style={rankContainerStyle}>
        {/* National rank */}
        <RankDisplay
          rank={nationalRank}
          total={nationalTotal}
          size="sm"
        />

        {/* State rank (if provided) */}
        {hasStateRank && (
          <span style={stateRankStyle}>
            #{stateRank}/{stateTotal} {stateName || 'state'}
          </span>
        )}
      </div>

      {/* Extra metrics (if provided) */}
      {hasExtraMetrics && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 4,
          paddingTop: 8,
          borderTop: '1px solid #f3f4f6',
          width: '100%',
          justifyContent: 'center'
        }}>
          {facilityCount && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                {facilityCount.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Facilities</div>
            </div>
          )}
          {tam && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                ${(tam / 1e6).toFixed(0)}M
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>TAM</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

GradeCard.propTypes = {
  /** Care type being displayed */
  type: PropTypes.oneOf(['Overall', 'SNF', 'ALF', 'HHA']).isRequired,
  /** Letter grade */
  grade: PropTypes.oneOf(['A+', 'A', 'B+', 'B', 'C', 'D', 'F']).isRequired,
  /** Numeric score (0-100) */
  score: PropTypes.number.isRequired,
  /** Percentile rank (0-100) */
  percentile: PropTypes.number,
  /** National rank position */
  nationalRank: PropTypes.number.isRequired,
  /** Total items in national ranking */
  nationalTotal: PropTypes.number.isRequired,
  /** State rank position */
  stateRank: PropTypes.number,
  /** Total items in state ranking */
  stateTotal: PropTypes.number,
  /** State abbreviation */
  stateName: PropTypes.string,
  /** Facility count for this care type */
  facilityCount: PropTypes.number,
  /** Total addressable market for this care type */
  tam: PropTypes.number,
  /** Click handler */
  onClick: PropTypes.func,
  /** Whether card is currently active/selected */
  isActive: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string
};

GradeCard.defaultProps = {
  percentile: undefined,
  stateRank: null,
  stateTotal: null,
  stateName: '',
  facilityCount: null,
  tam: null,
  onClick: null,
  isActive: false,
  className: ''
};

export default GradeCard;
