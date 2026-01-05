/**
 * OpportunityBadge.jsx
 *
 * A badge showing primary/secondary market opportunity by care type.
 * Indicates which care segment presents the best opportunity in a market.
 *
 * Props:
 * - type: 'primary' | 'secondary' (required)
 * - careType: 'SNF' | 'ALF' | 'HHA' (required)
 * - className: string (optional)
 *
 * Usage:
 * <OpportunityBadge type="primary" careType="ALF" />
 * <OpportunityBadge type="secondary" careType="HHA" />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { CARE_TYPES } from '../constants';

/**
 * Care type icons
 */
const CARE_TYPE_ICONS = {
  SNF: '🏥',
  ALF: '🏠',
  HHA: '🚗'
};

/**
 * Opportunity type configuration
 */
const OPPORTUNITY_CONFIG = {
  primary: {
    label: 'Primary',
    fontWeight: 600,
    tooltip: 'Primary opportunity based on supply/demand gaps and competitive dynamics'
  },
  secondary: {
    label: 'Secondary',
    fontWeight: 400,
    tooltip: 'Secondary opportunity based on supply/demand gaps and competitive dynamics'
  }
};

const OpportunityBadge = ({
  type,
  careType,
  className = ''
}) => {
  // Get configurations
  const opportunityConfig = OPPORTUNITY_CONFIG[type] || OPPORTUNITY_CONFIG.primary;
  const careTypeConfig = CARE_TYPES[careType] || {
    color: '#6b7280',
    label: careType || 'Unknown',
    shortLabel: careType || '?'
  };
  const icon = CARE_TYPE_ICONS[careType] || '❓';

  // Container styles
  const containerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    lineHeight: 1.4,
    cursor: 'default'
  };

  // Label styles (Primary/Secondary)
  const labelStyle = {
    color: '#6b7280',
    fontWeight: opportunityConfig.fontWeight
  };

  // Care type container styles
  const careTypeContainerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: careTypeConfig.color,
    fontWeight: 600,
    backgroundColor: `${careTypeConfig.color}12`,
    padding: '3px 8px',
    borderRadius: 6
  };

  // Icon styles
  const iconStyle = {
    fontSize: 12,
    lineHeight: 1
  };

  return (
    <span
      style={containerStyle}
      className={className}
      title={opportunityConfig.tooltip}
      role="status"
      aria-label={`${opportunityConfig.label} opportunity: ${careTypeConfig.label}`}
    >
      <span style={labelStyle}>
        {opportunityConfig.label}:
      </span>
      <span style={careTypeContainerStyle}>
        <span style={iconStyle} aria-hidden="true">
          {icon}
        </span>
        <span>{careTypeConfig.shortLabel || careType}</span>
      </span>
    </span>
  );
};

OpportunityBadge.propTypes = {
  /** Opportunity priority level */
  type: PropTypes.oneOf(['primary', 'secondary']).isRequired,
  /** Care type for the opportunity */
  careType: PropTypes.oneOf(['SNF', 'ALF', 'HHA']).isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

OpportunityBadge.defaultProps = {
  className: ''
};

export default OpportunityBadge;
