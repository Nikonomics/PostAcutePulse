/**
 * PACPenetrationDisplay.jsx
 *
 * Shows combined PAC penetration index with breakdown by care type.
 * Includes pie chart visualization of distribution.
 *
 * Props:
 * - index: number (required) - combined penetration index
 * - snfComponent: number (required) - beds per 1k 65+
 * - alfComponent: number (required) - beds per 1k 65+
 * - hhaComponent: number (required) - episodes per 1k 65+
 * - ranking: object (required) - state and national rankings
 * - className: string (optional)
 *
 * Usage:
 * <PACPenetrationDisplay
 *   index={78.5}
 *   snfComponent={32.4}
 *   alfComponent={28.1}
 *   hhaComponent={18.0}
 *   ranking={{
 *     national: { rank: 142, total: 879 },
 *     state: { rank: 5, total: 14 }
 *   }}
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

/**
 * Care type configuration
 */
const CARE_CONFIG = {
  snf: {
    key: 'snf',
    label: 'SNF',
    fullLabel: 'Skilled Nursing',
    color: '#8b5cf6',
    unit: 'beds/1k 65+'
  },
  alf: {
    key: 'alf',
    label: 'ALF',
    fullLabel: 'Assisted Living',
    color: '#06b6d4',
    unit: 'beds/1k 65+'
  },
  hha: {
    key: 'hha',
    label: 'HHA',
    fullLabel: 'Home Health',
    color: '#f59e0b',
    unit: 'episodes/1k 65+'
  }
};

const PACPenetrationDisplay = ({
  index,
  snfComponent,
  alfComponent,
  hhaComponent,
  ranking,
  className = ''
}) => {
  // Calculate total for percentage computation
  const total = snfComponent + alfComponent + hhaComponent;

  // Prepare pie chart data
  const pieData = [
    { name: 'SNF', value: snfComponent, color: CARE_CONFIG.snf.color },
    { name: 'ALF', value: alfComponent, color: CARE_CONFIG.alf.color },
    { name: 'HHA', value: hhaComponent, color: CARE_CONFIG.hha.color }
  ];

  // Component breakdown data
  const components = [
    { ...CARE_CONFIG.snf, value: snfComponent, percent: (snfComponent / total) * 100 },
    { ...CARE_CONFIG.alf, value: alfComponent, percent: (alfComponent / total) * 100 },
    { ...CARE_CONFIG.hha, value: hhaComponent, percent: (hhaComponent / total) * 100 }
  ];

  const maxComponent = Math.max(snfComponent, alfComponent, hhaComponent);

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

  // Index section styles
  const indexSectionStyle = {
    padding: '20px',
    backgroundColor: '#f9fafb',
    textAlign: 'center'
  };

  const indexLabelStyle = {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4
  };

  const indexValueStyle = {
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

  // Chart section styles
  const chartSectionStyle = {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  // Breakdown section styles
  const breakdownSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid #f3f4f6'
  };

  const sectionLabelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 12
  };

  const componentListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  };

  const componentRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  };

  const componentLabelContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: 50,
    flexShrink: 0
  };

  const colorDotStyle = (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0
  });

  const componentLabelStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: '#4b5563'
  };

  const barContainerStyle = {
    flex: 1,
    height: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    overflow: 'hidden'
  };

  const getBarStyle = (value, color) => ({
    width: `${(value / maxComponent) * 100}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: 6,
    transition: 'width 0.3s ease',
    minWidth: value > 0 ? 4 : 0
  });

  const componentValueStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    width: 80,
    textAlign: 'right',
    flexShrink: 0
  };

  const componentPercentStyle = {
    fontSize: 12,
    color: '#9ca3af',
    width: 40,
    textAlign: 'right',
    flexShrink: 0
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: data.payload.color }}>
            {data.name}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {data.value.toFixed(1)} ({((data.value / total) * 100).toFixed(1)}%)
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        marginTop: 8
      }}>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={colorDotStyle(entry.color)} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>PAC Penetration Index</h3>
      </div>

      {/* Index value */}
      <div style={indexSectionStyle}>
        <div style={indexLabelStyle}>Combined Index</div>
        <div style={indexValueStyle}>{index.toFixed(1)}</div>
        <div style={rankingsRowStyle}>
          <span>
            <span style={rankValueStyle}>#{ranking.national.rank}</span>
            /{ranking.national.total} nationally
          </span>
          <span style={separatorStyle}>•</span>
          <span>
            <span style={rankValueStyle}>#{ranking.state.rank}</span>
            /{ranking.state.total} in state
          </span>
        </div>
      </div>

      {/* Pie chart */}
      <div style={chartSectionStyle}>
        <ResponsiveContainer width={200} height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Component breakdown */}
      <div style={breakdownSectionStyle}>
        <div style={sectionLabelStyle}>Component Breakdown</div>
        <div style={componentListStyle}>
          {components.map(comp => (
            <div key={comp.key} style={componentRowStyle}>
              <div style={componentLabelContainerStyle}>
                <span style={colorDotStyle(comp.color)} />
                <span style={componentLabelStyle}>{comp.label}</span>
              </div>
              <div style={barContainerStyle}>
                <div style={getBarStyle(comp.value, comp.color)} />
              </div>
              <span style={componentValueStyle}>
                {comp.value.toFixed(1)} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>{comp.unit}</span>
              </span>
              <span style={componentPercentStyle}>{comp.percent.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

PACPenetrationDisplay.propTypes = {
  /** Combined penetration index */
  index: PropTypes.number.isRequired,
  /** SNF component (beds per 1k 65+) */
  snfComponent: PropTypes.number.isRequired,
  /** ALF component (beds per 1k 65+) */
  alfComponent: PropTypes.number.isRequired,
  /** HHA component (episodes per 1k 65+) */
  hhaComponent: PropTypes.number.isRequired,
  /** State and national rankings */
  ranking: PropTypes.shape({
    national: PropTypes.shape({
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired,
    state: PropTypes.shape({
      rank: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired
    }).isRequired
  }).isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

PACPenetrationDisplay.defaultProps = {
  className: ''
};

export default PACPenetrationDisplay;
