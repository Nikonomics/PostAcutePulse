/**
 * TAMDisplay.jsx
 *
 * Shows Total Addressable Market breakdown with visual representation.
 * Displays TAM by care type and payer, with rankings and per-facility metrics.
 *
 * Props:
 * - snfMedicare: number (required) - raw SNF Medicare value
 * - snfMedicaid: number (required) - raw SNF Medicaid value
 * - hhaMedicare: number (required) - raw HHA Medicare value
 * - totalPac: number (required) - total PAC TAM
 * - rankings: object (required) - state and national rankings
 * - perFacility: object (optional) - per-facility TAM values
 * - className: string (optional)
 *
 * Usage:
 * <TAMDisplay
 *   snfMedicare={111517200}
 *   snfMedicaid={108774000}
 *   hhaMedicare={13484800}
 *   totalPac={233776000}
 *   rankings={{
 *     state: { rank: 1, total: 14 },
 *     national: { rank: 142, total: 879 }
 *   }}
 *   perFacility={{ snf: 8472738, hha: 1685600 }}
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { formatCurrency } from '../../../api/marketGradingService';
import { CARE_TYPES } from '../constants';

/**
 * TAM segment configuration
 */
const TAM_SEGMENTS = {
  snfMedicare: {
    label: 'SNF Medicare',
    color: '#8b5cf6', // Purple
    order: 1
  },
  snfMedicaid: {
    label: 'SNF Medicaid',
    color: '#a78bfa', // Lighter purple
    order: 2
  },
  hhaMedicare: {
    label: 'HHA Medicare',
    color: '#f59e0b', // Amber
    order: 3
  }
};

const TAMDisplay = ({
  snfMedicare,
  snfMedicaid,
  hhaMedicare,
  totalPac,
  rankings,
  perFacility,
  className = ''
}) => {
  // Calculate percentages for bar widths
  const segments = [
    { key: 'snfMedicare', value: snfMedicare, ...TAM_SEGMENTS.snfMedicare },
    { key: 'snfMedicaid', value: snfMedicaid, ...TAM_SEGMENTS.snfMedicaid },
    { key: 'hhaMedicare', value: hhaMedicare, ...TAM_SEGMENTS.hhaMedicare }
  ];

  const maxSegment = Math.max(snfMedicare, snfMedicaid, hhaMedicare);

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
    borderBottom: '1px solid #f3f4f6'
  };

  const titleStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: '#111827',
    margin: 0
  };

  // Total section styles
  const totalSectionStyle = {
    padding: '20px',
    backgroundColor: '#f9fafb',
    textAlign: 'center'
  };

  const totalLabelStyle = {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4
  };

  const totalValueStyle = {
    fontSize: 32,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8
  };

  const rankingsRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    color: '#6b7280'
  };

  const rankValueStyle = {
    fontWeight: 600,
    color: '#374151'
  };

  const separatorStyle = {
    color: '#d1d5db'
  };

  // Breakdown section styles
  const breakdownSectionStyle = {
    padding: '16px 20px'
  };

  const sectionLabelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 12
  };

  const segmentListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  };

  const segmentRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  };

  const segmentLabelContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: 110,
    flexShrink: 0
  };

  const colorDotStyle = (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0
  });

  const segmentLabelStyle = {
    fontSize: 13,
    color: '#4b5563'
  };

  const segmentValueStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    width: 70,
    textAlign: 'right',
    flexShrink: 0
  };

  const barContainerStyle = {
    flex: 1,
    height: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    overflow: 'hidden'
  };

  const getBarStyle = (value, color) => ({
    width: `${(value / maxSegment) * 100}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: 6,
    transition: 'width 0.3s ease',
    minWidth: value > 0 ? 4 : 0
  });

  // Stacked bar styles
  const stackedBarContainerStyle = {
    marginTop: 16,
    marginBottom: 8
  };

  const stackedBarStyle = {
    display: 'flex',
    height: 24,
    borderRadius: 6,
    overflow: 'hidden'
  };

  const getStackedSegmentStyle = (value, color) => ({
    width: `${(value / totalPac) * 100}%`,
    backgroundColor: color,
    transition: 'width 0.3s ease'
  });

  // Per facility section styles
  const perFacilitySectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 24
  };

  const perFacilityItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };

  const perFacilityLabelStyle = {
    fontSize: 13,
    color: '#6b7280'
  };

  const perFacilityValueStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151'
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>Total Addressable Market</h3>
      </div>

      {/* Total TAM */}
      <div style={totalSectionStyle}>
        <div style={totalLabelStyle}>Total PAC TAM</div>
        <div style={totalValueStyle}>{formatCurrency(totalPac, true)}</div>
        <div style={rankingsRowStyle}>
          <span>
            <span style={rankValueStyle}>#{rankings.national.rank}</span>
            /{rankings.national.total} nationally
          </span>
          <span style={separatorStyle}>•</span>
          <span>
            <span style={rankValueStyle}>#{rankings.state.rank}</span>
            /{rankings.state.total} in state
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div style={breakdownSectionStyle}>
        <div style={sectionLabelStyle}>Breakdown</div>

        {/* Stacked bar */}
        <div style={stackedBarContainerStyle}>
          <div style={stackedBarStyle}>
            {segments.map(segment => (
              <div
                key={segment.key}
                style={getStackedSegmentStyle(segment.value, segment.color)}
                title={`${segment.label}: ${formatCurrency(segment.value, true)}`}
              />
            ))}
          </div>
        </div>

        {/* Individual segment rows */}
        <div style={segmentListStyle}>
          {segments.map(segment => (
            <div key={segment.key} style={segmentRowStyle}>
              <div style={segmentLabelContainerStyle}>
                <span style={colorDotStyle(segment.color)} />
                <span style={segmentLabelStyle}>{segment.label}</span>
              </div>
              <span style={segmentValueStyle}>
                {formatCurrency(segment.value, true)}
              </span>
              <div style={barContainerStyle}>
                <div style={getBarStyle(segment.value, segment.color)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per Facility (optional) */}
      {perFacility && (
        <div style={perFacilitySectionStyle}>
          <div style={sectionLabelStyle}>Per Facility</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, width: '100%' }}>
            {perFacility.snf !== undefined && (
              <div style={perFacilityItemStyle}>
                <span style={colorDotStyle(CARE_TYPES.SNF?.color || '#8b5cf6')} />
                <span style={perFacilityLabelStyle}>SNF:</span>
                <span style={perFacilityValueStyle}>
                  {formatCurrency(perFacility.snf, true)}/facility
                </span>
              </div>
            )}
            {perFacility.hha !== undefined && (
              <div style={perFacilityItemStyle}>
                <span style={colorDotStyle(CARE_TYPES.HHA?.color || '#f59e0b')} />
                <span style={perFacilityLabelStyle}>HHA:</span>
                <span style={perFacilityValueStyle}>
                  {formatCurrency(perFacility.hha, true)}/agency
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

TAMDisplay.propTypes = {
  /** SNF Medicare TAM value */
  snfMedicare: PropTypes.number.isRequired,
  /** SNF Medicaid TAM value */
  snfMedicaid: PropTypes.number.isRequired,
  /** HHA Medicare TAM value */
  hhaMedicare: PropTypes.number.isRequired,
  /** Total PAC TAM value */
  totalPac: PropTypes.number.isRequired,
  /** State and national rankings */
  rankings: PropTypes.shape({
    state: PropTypes.shape({
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired,
    national: PropTypes.shape({
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired
  }).isRequired,
  /** Per-facility TAM values */
  perFacility: PropTypes.shape({
    snf: PropTypes.number,
    hha: PropTypes.number
  }),
  /** Additional CSS class names */
  className: PropTypes.string
};

TAMDisplay.defaultProps = {
  perFacility: undefined,
  className: ''
};

export default TAMDisplay;
