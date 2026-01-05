/**
 * HHIDisplay.jsx
 *
 * Shows Herfindahl-Hirschman Index (market concentration) for competition analysis.
 * Displays HHI value, concentration level, and operator statistics.
 *
 * Props:
 * - hhi: number (required) - 0 to 10000
 * - level: 'Unconcentrated' | 'Moderate' | 'Concentrated' (required)
 * - top3Share: number (required) - percentage
 * - independentShare: number (optional)
 * - topOperator: string (optional)
 * - operatorCount: number (required)
 * - careType: 'SNF' | 'HHA' (default: 'SNF')
 * - className: string (optional)
 *
 * Usage:
 * <HHIDisplay
 *   hhi={2449}
 *   level="Moderate"
 *   top3Share={76.5}
 *   independentShare={18.2}
 *   topOperator="Cascadia Healthcare"
 *   operatorCount={11}
 *   careType="SNF"
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { HHI_LEVELS } from '../constants';

/**
 * Level configuration mapping
 */
const LEVEL_CONFIG = {
  Unconcentrated: {
    color: HHI_LEVELS.UNCONCENTRATED?.color || '#22c55e',
    label: 'Unconcentrated',
    description: 'Competitive market with many players'
  },
  Moderate: {
    color: HHI_LEVELS.MODERATE?.color || '#eab308',
    label: 'Moderate',
    description: 'Moderately concentrated market'
  },
  Concentrated: {
    color: HHI_LEVELS.CONCENTRATED?.color || '#ef4444',
    label: 'Concentrated',
    description: 'Highly concentrated, few dominant players'
  }
};

/**
 * HHI thresholds for gauge
 */
const HHI_THRESHOLDS = {
  unconcentrated: 1500,
  moderate: 2500,
  max: 10000
};

const HHIDisplay = ({
  hhi,
  level,
  top3Share,
  independentShare,
  topOperator,
  operatorCount,
  careType = 'SNF',
  className = ''
}) => {
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG.Moderate;

  // Calculate gauge position (0-100%)
  const gaugePosition = Math.min(100, Math.max(0, (hhi / HHI_THRESHOLDS.max) * 100));

  // Container styles
  const containerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  };

  // Header styles
  const headerStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  };

  const titleContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };

  const titleStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    margin: 0
  };

  const helpIconStyle = {
    fontSize: 12,
    color: '#9ca3af',
    cursor: 'help',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#f3f4f6'
  };

  // HHI value section styles
  const hhiSectionStyle = {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap'
  };

  const hhiLabelStyle = {
    fontSize: 14,
    color: '#6b7280'
  };

  const hhiValueStyle = {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827'
  };

  const levelBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    backgroundColor: `${levelConfig.color}15`,
    border: `1px solid ${levelConfig.color}40`,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: levelConfig.color
  };

  // Gauge styles
  const gaugeSectionStyle = {
    padding: '0 20px 20px 20px'
  };

  const gaugeContainerStyle = {
    position: 'relative',
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 8
  };

  // Create gradient background for zones
  const gaugeBackgroundStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex'
  };

  const getZoneStyle = (color, widthPercent) => ({
    width: `${widthPercent}%`,
    backgroundColor: `${color}30`,
    borderRight: '1px solid #ffffff'
  });

  // Marker styles
  const markerStyle = {
    position: 'absolute',
    left: `${gaugePosition}%`,
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 4,
    height: 24,
    backgroundColor: levelConfig.color,
    borderRadius: 2,
    boxShadow: `0 0 0 3px ${levelConfig.color}40`,
    zIndex: 2
  };

  // Labels below gauge
  const gaugeLabelsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: '#9ca3af'
  };

  const gaugeTicksStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    position: 'relative',
    marginTop: 4
  };

  const tickStyle = {
    textAlign: 'center'
  };

  const tickValueStyle = {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 500
  };

  const tickLabelStyle = {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2
  };

  // Stats section styles
  const statsSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  };

  const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13
  };

  const statLabelStyle = {
    color: '#6b7280'
  };

  const statValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  const topOperatorStyle = {
    ...statValueStyle,
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  // Calculate zone widths
  const unconcWidth = (HHI_THRESHOLDS.unconcentrated / HHI_THRESHOLDS.max) * 100;
  const modWidth = ((HHI_THRESHOLDS.moderate - HHI_THRESHOLDS.unconcentrated) / HHI_THRESHOLDS.max) * 100;
  const concWidth = 100 - unconcWidth - modWidth;

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleContainerStyle}>
          <h3 style={titleStyle}>{careType} Competition</h3>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="hhi-tooltip">
                HHI (Herfindahl-Hirschman Index) measures market concentration.
                Higher values = less competition. Under 1,500 is competitive,
                over 2,500 is highly concentrated.
              </Tooltip>
            }
          >
            <span style={helpIconStyle}>?</span>
          </OverlayTrigger>
        </div>
      </div>

      {/* HHI Value */}
      <div style={hhiSectionStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={hhiLabelStyle}>HHI</div>
          <div style={hhiValueStyle}>{hhi.toLocaleString()}</div>
        </div>
        <span style={levelBadgeStyle}>{levelConfig.label}</span>
      </div>

      {/* Gauge */}
      <div style={gaugeSectionStyle}>
        <div style={gaugeContainerStyle}>
          {/* Zone backgrounds */}
          <div style={gaugeBackgroundStyle}>
            <div style={getZoneStyle(LEVEL_CONFIG.Unconcentrated.color, unconcWidth)} />
            <div style={getZoneStyle(LEVEL_CONFIG.Moderate.color, modWidth)} />
            <div style={getZoneStyle(LEVEL_CONFIG.Concentrated.color, concWidth)} />
          </div>
          {/* Position marker */}
          <div style={markerStyle} />
        </div>

        {/* Tick marks and labels */}
        <div style={gaugeTicksStyle}>
          <div style={tickStyle}>
            <div style={tickValueStyle}>0</div>
            <div style={tickLabelStyle}>Comp.</div>
          </div>
          <div style={{ ...tickStyle, position: 'absolute', left: `${unconcWidth}%`, transform: 'translateX(-50%)' }}>
            <div style={tickValueStyle}>1,500</div>
            <div style={tickLabelStyle}></div>
          </div>
          <div style={{ ...tickStyle, position: 'absolute', left: `${unconcWidth + modWidth}%`, transform: 'translateX(-50%)' }}>
            <div style={tickValueStyle}>2,500</div>
            <div style={tickLabelStyle}></div>
          </div>
          <div style={{ ...tickStyle, textAlign: 'right' }}>
            <div style={tickValueStyle}>10,000</div>
            <div style={tickLabelStyle}>Conc.</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={statsSectionStyle}>
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Top 3 operators</span>
          <span style={statValueStyle}>{top3Share.toFixed(1)}%</span>
        </div>
        {independentShare !== undefined && (
          <div style={statRowStyle}>
            <span style={statLabelStyle}>Independent</span>
            <span style={statValueStyle}>{independentShare.toFixed(1)}%</span>
          </div>
        )}
        <div style={statRowStyle}>
          <span style={statLabelStyle}>Total operators</span>
          <span style={statValueStyle}>{operatorCount}</span>
        </div>
        {topOperator && (
          <div style={statRowStyle}>
            <span style={statLabelStyle}>Top operator</span>
            <span style={topOperatorStyle} title={topOperator}>{topOperator}</span>
          </div>
        )}
      </div>
    </div>
  );
};

HHIDisplay.propTypes = {
  /** HHI value (0-10000) */
  hhi: PropTypes.number.isRequired,
  /** Concentration level */
  level: PropTypes.oneOf(['Unconcentrated', 'Moderate', 'Concentrated']).isRequired,
  /** Top 3 operators market share percentage */
  top3Share: PropTypes.number.isRequired,
  /** Independent operators share percentage */
  independentShare: PropTypes.number,
  /** Name of top operator */
  topOperator: PropTypes.string,
  /** Total number of operators */
  operatorCount: PropTypes.number.isRequired,
  /** Care type for title */
  careType: PropTypes.oneOf(['SNF', 'HHA']),
  /** Additional CSS class names */
  className: PropTypes.string
};

HHIDisplay.defaultProps = {
  independentShare: undefined,
  topOperator: undefined,
  careType: 'SNF',
  className: ''
};

export default HHIDisplay;
