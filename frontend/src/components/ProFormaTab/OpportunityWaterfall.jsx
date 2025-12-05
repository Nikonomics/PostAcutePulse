import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { formatCurrency, formatCompactCurrency } from '../../utils/formatters';

/**
 * OpportunityWaterfall - EBITDA Bridge/Waterfall Chart
 *
 * Shows the path from current EBITDA to stabilized EBITDA through
 * improvement opportunities. Handles negative starting values correctly.
 *
 * @param {number} currentEbitda - Starting EBITDA (can be negative)
 * @param {Array} opportunities - Array of improvement opportunities
 * @param {number} stabilizedEbitda - Target stabilized EBITDA
 */
const OpportunityWaterfall = ({
  currentEbitda = 0,
  opportunities = [],
  stabilizedEbitda = 0,
  height = 350,
  showLabels = true,
  title = 'EBITDA Bridge to Stabilization'
}) => {
  // Color scheme
  const COLORS = {
    negative: '#ef4444',      // Red for negative values
    positive: '#22c55e',      // Green for positive values
    opportunity: '#10b981',   // Emerald for opportunity bars
    stabilized: '#3b82f6',    // Blue for final bar
    connector: '#9ca3af'      // Gray for connector lines
  };

  // Priority colors for opportunity bars
  const PRIORITY_COLORS = {
    critical: '#dc2626',   // Red
    high: '#f97316',       // Orange
    medium: '#eab308',     // Yellow
    low: '#22c55e'         // Green
  };

  /**
   * Transform data for waterfall chart
   * Waterfall charts use stacked bars with transparent "spacer" bars
   * to create the floating effect
   */
  const chartData = useMemo(() => {
    const result = [];
    let runningTotal = 0;

    // Starting bar: Current EBITDA
    // For the starting bar, we need to handle negative values specially
    const startValue = currentEbitda;
    result.push({
      name: 'Current\nEBITDA',
      shortName: 'Current',
      // For waterfall: spacer is distance from axis to bottom of bar
      spacer: startValue >= 0 ? 0 : startValue,
      value: startValue >= 0 ? startValue : Math.abs(startValue),
      displayValue: startValue,
      fill: startValue >= 0 ? COLORS.positive : COLORS.negative,
      type: 'start',
      runningTotal: startValue
    });
    runningTotal = startValue;

    // Opportunity bars - each floats from the previous running total
    opportunities.forEach((opp, index) => {
      const oppValue = opp.value || 0;
      const newTotal = runningTotal + oppValue;

      // Determine color based on priority or default
      let fillColor = COLORS.opportunity;
      if (opp.priority && PRIORITY_COLORS[opp.priority.toLowerCase()]) {
        fillColor = PRIORITY_COLORS[opp.priority.toLowerCase()];
      }

      // For positive opportunities (increases):
      // - spacer = runningTotal (where bar starts)
      // - value = oppValue (bar height going up)
      // For negative opportunities (decreases):
      // - spacer = newTotal (where bar ends)
      // - value = Math.abs(oppValue) (bar height going down)

      if (oppValue >= 0) {
        result.push({
          name: formatLabel(opp.label),
          shortName: opp.label,
          spacer: runningTotal >= 0 ? runningTotal : 0,
          negSpacer: runningTotal < 0 ? runningTotal : 0,
          value: oppValue,
          displayValue: oppValue,
          fill: fillColor,
          type: 'opportunity',
          priority: opp.priority,
          runningTotal: newTotal,
          prevTotal: runningTotal
        });
      } else {
        // Negative opportunity (rare, but handle it)
        result.push({
          name: formatLabel(opp.label),
          shortName: opp.label,
          spacer: newTotal >= 0 ? newTotal : 0,
          negSpacer: newTotal < 0 ? newTotal : 0,
          value: Math.abs(oppValue),
          displayValue: oppValue,
          fill: COLORS.negative,
          type: 'opportunity',
          priority: opp.priority,
          runningTotal: newTotal,
          prevTotal: runningTotal
        });
      }

      runningTotal = newTotal;
    });

    // Ending bar: Stabilized EBITDA
    result.push({
      name: 'Stabilized\nEBITDA',
      shortName: 'Stabilized',
      spacer: stabilizedEbitda >= 0 ? 0 : stabilizedEbitda,
      value: stabilizedEbitda >= 0 ? stabilizedEbitda : Math.abs(stabilizedEbitda),
      displayValue: stabilizedEbitda,
      fill: COLORS.stabilized,
      type: 'end',
      runningTotal: stabilizedEbitda
    });

    return result;
  }, [currentEbitda, opportunities, stabilizedEbitda]);

  /**
   * Format label to wrap long text
   */
  function formatLabel(label) {
    if (!label) return '';
    // Split long labels
    if (label.length > 12) {
      const words = label.split(' ');
      if (words.length >= 2) {
        const mid = Math.ceil(words.length / 2);
        return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ');
      }
    }
    return label;
  }

  /**
   * Format compact currency for bar labels with +/- prefix
   */
  const formatBarLabel = (value) => {
    if (value === null || value === undefined) return '';
    const formatted = formatCompactCurrency(Math.abs(value), 1);
    return value < 0 ? `-${formatted}` : `+${formatted}`;
  };

  /**
   * Format full currency for tooltip display
   */
  const formatTooltipCurrency = (value) => {
    if (value === null || value === undefined) return '';
    return formatCurrency(value);
  };

  /**
   * Custom tooltip component
   */
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        maxWidth: '200px'
      }}>
        <p style={{
          margin: 0,
          fontWeight: 600,
          color: '#111827',
          fontSize: '0.875rem',
          marginBottom: '0.25rem'
        }}>
          {data.shortName || data.name.replace('\n', ' ')}
        </p>

        <p style={{
          margin: 0,
          color: data.displayValue >= 0 ? '#059669' : '#dc2626',
          fontSize: '1rem',
          fontWeight: 700
        }}>
          {data.type === 'opportunity' ? (data.displayValue >= 0 ? '+' : '') : ''}
          {formatTooltipCurrency(data.displayValue)}
        </p>

        {data.type === 'opportunity' && (
          <p style={{
            margin: '0.5rem 0 0 0',
            color: '#6b7280',
            fontSize: '0.75rem'
          }}>
            Running Total: {formatTooltipCurrency(data.runningTotal)}
          </p>
        )}

        {data.priority && (
          <span style={{
            display: 'inline-block',
            marginTop: '0.5rem',
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.625rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            backgroundColor: PRIORITY_COLORS[data.priority.toLowerCase()] || '#e5e7eb',
            color: 'white'
          }}>
            {data.priority} Priority
          </span>
        )}
      </div>
    );
  };

  /**
   * Custom label renderer for bar values
   */
  const renderCustomLabel = (props) => {
    const { x, y, width, value, index } = props;
    const data = chartData[index];

    if (!showLabels || !data) return null;

    // Position label above or below bar based on value
    const isNegative = data.displayValue < 0;
    const labelY = isNegative ? y + 15 : y - 8;

    return (
      <text
        x={x + width / 2}
        y={labelY}
        fill={data.type === 'end' ? COLORS.stabilized : (isNegative ? COLORS.negative : '#059669')}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
      >
        {formatBarLabel(data.displayValue)}
      </text>
    );
  };

  /**
   * Calculate Y-axis domain to handle negative values
   */
  const yAxisDomain = useMemo(() => {
    const allValues = [currentEbitda, stabilizedEbitda];
    let running = currentEbitda;
    opportunities.forEach(opp => {
      running += (opp.value || 0);
      allValues.push(running);
    });

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    // Add some padding
    const padding = (max - min) * 0.15;
    return [
      Math.floor((min - padding) / 100000) * 100000,
      Math.ceil((max + padding) / 100000) * 100000
    ];
  }, [currentEbitda, opportunities, stabilizedEbitda]);

  /**
   * Format Y-axis tick using shared formatter
   */
  const formatYAxis = (value) => {
    if (value === 0) return '$0';
    return formatCompactCurrency(value, 1);
  };

  // Empty state
  if (!opportunities || opportunities.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px dashed #d1d5db'
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          No improvement opportunities identified yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {title && (
        <h3 style={{
          margin: '0 0 1rem 0',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#111827'
        }}>
          {title}
        </h3>
      )}

      {/* Summary stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '0.5rem',
        border: '1px solid #bbf7d0'
      }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Current EBITDA</span>
          <p style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: currentEbitda >= 0 ? '#059669' : '#dc2626'
          }}>
            {formatTooltipCurrency(currentEbitda)}
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Improvement</span>
          <p style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#059669'
          }}>
            +{formatTooltipCurrency(stabilizedEbitda - currentEbitda)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Stabilized EBITDA</span>
          <p style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: COLORS.stabilized
          }}>
            {formatTooltipCurrency(stabilizedEbitda)}
          </p>
        </div>
      </div>

      {/* Waterfall Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 30, right: 20, left: 20, bottom: 60 }}
          barCategoryGap="15%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

          <XAxis
            dataKey="name"
            tick={{
              fontSize: 10,
              fill: '#6b7280',
              fontWeight: 500
            }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          <YAxis
            domain={yAxisDomain}
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={70}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Reference line at zero */}
          <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />

          {/* Transparent spacer bar (creates the floating effect) */}
          <Bar
            dataKey="spacer"
            stackId="waterfall"
            fill="transparent"
            isAnimationActive={false}
          />

          {/* Actual value bar */}
          <Bar
            dataKey="value"
            stackId="waterfall"
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill}
                stroke={entry.type === 'end' ? COLORS.stabilized : 'none'}
                strokeWidth={entry.type === 'end' ? 2 : 0}
              />
            ))}
            <LabelList
              dataKey="value"
              content={renderCustomLabel}
              position="top"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1.5rem',
        marginTop: '0.5rem',
        flexWrap: 'wrap'
      }}>
        <LegendItem color={COLORS.negative} label="Current (Negative)" />
        <LegendItem color={COLORS.opportunity} label="Improvement" />
        <LegendItem color={COLORS.stabilized} label="Stabilized" />
      </div>
    </div>
  );
};

/**
 * Legend item component
 */
const LegendItem = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
    <div style={{
      width: '12px',
      height: '12px',
      backgroundColor: color,
      borderRadius: '2px'
    }} />
    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{label}</span>
  </div>
);

LegendItem.propTypes = {
  color: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired
};

OpportunityWaterfall.propTypes = {
  currentEbitda: PropTypes.number,
  opportunities: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    priority: PropTypes.oneOf(['critical', 'high', 'medium', 'low'])
  })),
  stabilizedEbitda: PropTypes.number,
  height: PropTypes.number,
  showLabels: PropTypes.bool,
  title: PropTypes.string
};

export default OpportunityWaterfall;

/**
 * Demo/test component showing example usage
 */
export const OpportunityWaterfallDemo = () => {
  const exampleData = {
    currentEbitda: -706544,
    opportunities: [
      { label: 'Labor Optimization', value: 417000, priority: 'critical' },
      { label: 'Agency Reduction', value: 193000, priority: 'high' },
      { label: 'Food Cost Reduction', value: 86000, priority: 'medium' },
      { label: 'Management Fee', value: 78000, priority: 'low' }
    ],
    stabilizedEbitda: 67456
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <OpportunityWaterfall
        currentEbitda={exampleData.currentEbitda}
        opportunities={exampleData.opportunities}
        stabilizedEbitda={exampleData.stabilizedEbitda}
      />
    </div>
  );
};
