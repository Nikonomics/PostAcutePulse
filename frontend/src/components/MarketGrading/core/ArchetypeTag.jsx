/**
 * ArchetypeTag.jsx
 *
 * A tag/badge showing the market archetype with icon and label.
 * Archetypes describe the dominant care delivery model in a market.
 *
 * Props:
 * - archetype: 'Home-Heavy' | 'SNF-Heavy' | 'HHA-Heavy' | 'Institutional' | 'Balanced' (required)
 * - size: 'sm' | 'md' (default: 'md')
 * - showIcon: boolean (default: true)
 * - className: string (optional)
 *
 * Usage:
 * <ArchetypeTag archetype="Home-Heavy" />
 * <ArchetypeTag archetype="Institutional" size="sm" showIcon={false} />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { ARCHETYPES } from '../constants';

/**
 * Extended archetype descriptions for tooltips
 */
const ARCHETYPE_TOOLTIPS = {
  'Home-Heavy': 'Market has higher home health utilization relative to institutional care',
  'SNF-Heavy': 'Market relies more heavily on skilled nursing facility care',
  'HHA-Heavy': 'Market has high home health agency utilization',
  'Institutional': 'Market relies more heavily on facility-based care (SNF/ALF)',
  'Balanced': 'Market has roughly equal institutional and home-based care utilization'
};

/**
 * Size configuration
 */
const SIZE_CONFIG = {
  sm: {
    fontSize: 12,
    paddingX: 8,
    paddingY: 4,
    iconGap: 4,
    borderRadius: 12
  },
  md: {
    fontSize: 14,
    paddingX: 10,
    paddingY: 6,
    iconGap: 6,
    borderRadius: 14
  }
};

const ArchetypeTag = ({
  archetype,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  // Get archetype configuration
  const archetypeConfig = ARCHETYPES[archetype] || {
    icon: '❓',
    color: '#6b7280',
    label: archetype || 'Unknown'
  };

  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const tooltip = ARCHETYPE_TOOLTIPS[archetype] || archetypeConfig.description || '';

  // Container styles - pill shaped with subtle background
  const tagStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: showIcon ? sizeConfig.iconGap : 0,
    fontSize: sizeConfig.fontSize,
    fontWeight: 500,
    color: archetypeConfig.color,
    backgroundColor: `${archetypeConfig.color}15`, // 15% opacity
    padding: `${sizeConfig.paddingY}px ${sizeConfig.paddingX}px`,
    borderRadius: sizeConfig.borderRadius,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    cursor: 'default',
    transition: 'background-color 0.15s ease'
  };

  // Icon styles
  const iconStyle = {
    fontSize: sizeConfig.fontSize,
    lineHeight: 1
  };

  // Label styles
  const labelStyle = {
    lineHeight: 1
  };

  return (
    <span
      style={tagStyle}
      className={className}
      title={tooltip}
      role="status"
      aria-label={`Market archetype: ${archetypeConfig.label}`}
    >
      {showIcon && (
        <span style={iconStyle} aria-hidden="true">
          {archetypeConfig.icon}
        </span>
      )}
      <span style={labelStyle}>
        {archetypeConfig.label}
      </span>
    </span>
  );
};

ArchetypeTag.propTypes = {
  /** Market archetype */
  archetype: PropTypes.oneOf([
    'Home-Heavy',
    'SNF-Heavy',
    'HHA-Heavy',
    'Institutional',
    'Balanced'
  ]).isRequired,
  /** Size variant */
  size: PropTypes.oneOf(['sm', 'md']),
  /** Whether to show the emoji icon */
  showIcon: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string
};

ArchetypeTag.defaultProps = {
  size: 'md',
  showIcon: true,
  className: ''
};

export default ArchetypeTag;
