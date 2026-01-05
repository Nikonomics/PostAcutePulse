/**
 * QuadrantDisplay.jsx
 *
 * Shows the market quadrant distribution for facilities in a state/market.
 * Displays a 2x2 grid visualization of market positioning.
 *
 * Props:
 * - data: object (required) - quadrant distribution percentages
 *   { 'Growth + Competitive': 25, 'Growth + Concentrated': 30, ... }
 * - title: string (optional) - display title
 * - className: string (optional)
 *
 * Usage:
 * <QuadrantDisplay
 *   data={{
 *     'Growth + Competitive': 25,
 *     'Growth + Concentrated': 30,
 *     'Stable + Competitive': 20,
 *     'Stable + Concentrated': 25
 *   }}
 *   title="SNF Market Quadrants"
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Quadrant configuration with colors and positions
 */
const QUADRANT_CONFIG = {
  'Growth + Competitive': {
    color: '#22c55e',
    bgColor: '#dcfce7',
    description: 'High growth, competitive market'
  },
  'Growth + Concentrated': {
    color: '#f59e0b',
    bgColor: '#fef3c7',
    description: 'High growth, concentrated market'
  },
  'Stable + Competitive': {
    color: '#3b82f6',
    bgColor: '#dbeafe',
    description: 'Stable growth, competitive market'
  },
  'Stable + Concentrated': {
    color: '#6b7280',
    bgColor: '#f3f4f6',
    description: 'Stable growth, concentrated market'
  }
};

const QuadrantDisplay = ({
  data,
  title = 'Market Quadrants',
  className = ''
}) => {
  // Defensive check: if data is missing or invalid, don't render
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Quadrant order for 2x2 grid display
  const quadrantOrder = [
    'Growth + Competitive',
    'Growth + Concentrated',
    'Stable + Competitive',
    'Stable + Concentrated'
  ];

  // Calculate total for percentages
  const total = quadrantOrder.reduce((sum, key) => sum + (data[key] || 0), 0);

  // Container styles
  const containerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  };

  const headerStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14,
    fontWeight: 600,
    color: '#374151'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 1,
    backgroundColor: '#e5e7eb',
    padding: 1
  };

  const getCellStyle = (quadrantKey) => {
    const config = QUADRANT_CONFIG[quadrantKey] || { color: '#6b7280', bgColor: '#f3f4f6' };
    const value = data[quadrantKey] || 0;
    const isHighest = value === Math.max(...quadrantOrder.map(k => data[k] || 0)) && value > 0;

    return {
      backgroundColor: config.bgColor,
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      border: isHighest ? `2px solid ${config.color}` : '2px solid transparent',
      transition: 'all 0.2s ease'
    };
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 1.2
  };

  const valueStyle = (quadrantKey) => {
    const config = QUADRANT_CONFIG[quadrantKey] || { color: '#374151' };
    return {
      fontSize: 20,
      fontWeight: 700,
      color: config.color
    };
  };

  const axisLabelStyle = {
    fontSize: 10,
    color: '#9ca3af',
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-between'
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>{title}</div>

      {/* Axis label - top */}
      <div style={{ ...axisLabelStyle, borderBottom: '1px solid #f3f4f6' }}>
        <span>Competitive</span>
        <span>Concentrated</span>
      </div>

      {/* 2x2 Grid */}
      <div style={gridStyle}>
        {quadrantOrder.map((quadrantKey) => {
          const value = data[quadrantKey] || 0;
          const shortLabel = quadrantKey.split(' + ')[0];

          return (
            <div
              key={quadrantKey}
              style={getCellStyle(quadrantKey)}
              title={QUADRANT_CONFIG[quadrantKey]?.description || ''}
            >
              <span style={labelStyle}>{shortLabel}</span>
              <span style={valueStyle(quadrantKey)}>{value}%</span>
            </div>
          );
        })}
      </div>

      {/* Footer with total */}
      {total > 0 && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
          Total: {total}%
        </div>
      )}
    </div>
  );
};

QuadrantDisplay.propTypes = {
  /** Quadrant distribution data */
  data: PropTypes.shape({
    'Growth + Competitive': PropTypes.number,
    'Growth + Concentrated': PropTypes.number,
    'Stable + Competitive': PropTypes.number,
    'Stable + Concentrated': PropTypes.number
  }).isRequired,
  /** Display title */
  title: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string
};

QuadrantDisplay.defaultProps = {
  title: 'Market Quadrants',
  className: ''
};

export default QuadrantDisplay;
