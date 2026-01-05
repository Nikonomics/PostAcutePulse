/**
 * GradeDistributionChart.jsx
 *
 * Shows distribution of grades (A/B/C/D/F) as a bar chart or pie chart.
 *
 * Props:
 * - distribution: { A: number, B: number, C: number, D: number, F: number } (required)
 * - variant: 'bar' | 'pie' (default: 'bar')
 * - title: string (default: "Grade Distribution")
 * - showCounts: boolean (default: true)
 * - showPercentages: boolean (default: false)
 * - className: string (optional)
 *
 * Usage:
 * <GradeDistributionChart
 *   distribution={{ A: 1, B: 3, C: 6, D: 3, F: 1 }}
 *   variant="bar"
 * />
 */

import React from 'react';
import PropTypes from 'prop-types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { GRADE_COLORS } from '../constants';

/**
 * Grade order for display
 */
const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F'];

const GradeDistributionChart = ({
  distribution,
  variant = 'bar',
  title = 'Grade Distribution',
  showCounts = true,
  showPercentages = false,
  className = ''
}) => {
  // Calculate total and prepare data
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  const data = GRADE_ORDER.map(grade => ({
    grade,
    count: distribution[grade] || 0,
    percent: total > 0 ? ((distribution[grade] || 0) / total) * 100 : 0,
    color: GRADE_COLORS[grade]?.bg || '#6b7280'
  }));

  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Container styles
  const containerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  };

  // Header styles
  const headerStyle = {
    padding: '14px 16px',
    borderBottom: '1px solid #f3f4f6'
  };

  const titleStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
    margin: 0
  };

  // Content styles
  const contentStyle = {
    padding: '16px'
  };

  // Bar chart styles
  const barListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  };

  const barRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  };

  const gradeLabelStyle = (color) => ({
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: GRADE_COLORS[color]?.text || 'white',
    backgroundColor: GRADE_COLORS[color]?.bg || '#6b7280',
    borderRadius: 4,
    flexShrink: 0
  });

  const barContainerStyle = {
    flex: 1,
    height: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden'
  };

  const getBarStyle = (count, color) => ({
    width: `${(count / maxCount) * 100}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: 4,
    transition: 'width 0.3s ease',
    minWidth: count > 0 ? 4 : 0
  });

  const countStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: '#6b7280',
    minWidth: 30,
    textAlign: 'right',
    flexShrink: 0
  };

  const percentStyle = {
    fontSize: 12,
    color: '#9ca3af',
    minWidth: 40,
    textAlign: 'right',
    flexShrink: 0
  };

  // Pie chart custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>
            Grade {item.grade}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {item.count} market{item.count !== 1 ? 's' : ''} ({item.percent.toFixed(1)}%)
          </div>
        </div>
      );
    }
    return null;
  };

  // Pie chart custom legend
  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8
      }}>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: entry.color
            }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {entry.payload.grade}: {entry.payload.count}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Render bar variant
  const renderBarChart = () => (
    <div style={barListStyle}>
      {data.map(item => (
        <div key={item.grade} style={barRowStyle}>
          <div style={gradeLabelStyle(item.grade)}>{item.grade}</div>
          <div style={barContainerStyle}>
            <div style={getBarStyle(item.count, item.color)} />
          </div>
          {showCounts && (
            <span style={countStyle}>({item.count})</span>
          )}
          {showPercentages && (
            <span style={percentStyle}>{item.percent.toFixed(0)}%</span>
          )}
        </div>
      ))}
    </div>
  );

  // Render pie variant
  const renderPieChart = () => {
    // Filter out zero values for pie chart
    const pieData = data.filter(d => d.count > 0);

    return (
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="count"
              nameKey="grade"
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
    );
  };

  // Summary row
  const summaryStyle = {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#6b7280'
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h4 style={titleStyle}>{title}</h4>
      </div>

      {/* Chart content */}
      <div style={contentStyle}>
        {variant === 'bar' ? renderBarChart() : renderPieChart()}

        {/* Summary */}
        <div style={summaryStyle}>
          <span>Total Markets</span>
          <span style={{ fontWeight: 600, color: '#374151' }}>{total}</span>
        </div>
      </div>
    </div>
  );
};

GradeDistributionChart.propTypes = {
  /** Distribution counts by grade */
  distribution: PropTypes.shape({
    A: PropTypes.number,
    B: PropTypes.number,
    C: PropTypes.number,
    D: PropTypes.number,
    F: PropTypes.number
  }).isRequired,
  /** Chart variant */
  variant: PropTypes.oneOf(['bar', 'pie']),
  /** Chart title */
  title: PropTypes.string,
  /** Whether to show count numbers */
  showCounts: PropTypes.bool,
  /** Whether to show percentages */
  showPercentages: PropTypes.bool,
  /** Additional CSS class names */
  className: PropTypes.string
};

GradeDistributionChart.defaultProps = {
  variant: 'bar',
  title: 'Grade Distribution',
  showCounts: true,
  showPercentages: false,
  className: ''
};

export default GradeDistributionChart;
