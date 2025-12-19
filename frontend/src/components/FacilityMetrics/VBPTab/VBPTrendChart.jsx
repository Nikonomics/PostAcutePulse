import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

/**
 * Metric configuration options
 */
const METRIC_OPTIONS = [
  {
    key: 'performance_score',
    label: 'Performance Score',
    format: (v) => v != null ? Math.round(v) : '—',
    formatTooltip: (v) => v != null ? `${Math.round(v)} points` : '—',
    domain: [0, 100],
    color: '#3b82f6',
    unit: 'points',
    lowerIsBetter: false
  },
  {
    key: 'incentive_multiplier',
    label: 'Payment Multiplier',
    format: (v) => v != null ? v.toFixed(4) : '—',
    formatTooltip: (v) => v != null ? `${v.toFixed(4)}x` : '—',
    domain: [0.96, 1.04],
    color: '#22c55e',
    unit: 'x',
    referenceLine: 1.0,
    lowerIsBetter: false
  },
  {
    key: 'performance_readmission_rate',
    label: 'Readmission Rate',
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    formatTooltip: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    domain: ['auto', 'auto'],
    color: '#ef4444',
    unit: '%',
    lowerIsBetter: true,
    isRate: true
  }
];

/**
 * Custom Tooltip Component
 */
const CustomTooltip = ({ active, payload, label, metricConfig }) => {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  const formattedValue = metricConfig.formatTooltip(value);

  return (
    <div className="vbp-chart-tooltip">
      <div className="vbp-chart-tooltip-label">FY{label}</div>
      <div className="vbp-chart-tooltip-value" style={{ color: metricConfig.color }}>
        {formattedValue}
      </div>
    </div>
  );
};

/**
 * VBPTrendChart - Line chart showing 6-year VBP performance history
 */
const VBPTrendChart = ({ vbpData }) => {
  const [selectedMetric, setSelectedMetric] = useState('performance_score');

  const history = vbpData?.history || [];

  // Get the selected metric configuration
  const metricConfig = METRIC_OPTIONS.find(m => m.key === selectedMetric) || METRIC_OPTIONS[0];

  // Prepare chart data - sort by year ascending, filter out null values for selected metric
  const chartData = useMemo(() => {
    return [...history]
      .filter(h => h[selectedMetric] != null)
      .sort((a, b) => a.fiscal_year - b.fiscal_year)
      .map(h => ({
        year: h.fiscal_year,
        [selectedMetric]: h[selectedMetric]
      }));
  }, [history, selectedMetric]);

  // Calculate year range
  const yearRange = useMemo(() => {
    if (chartData.length === 0) return null;
    const years = chartData.map(d => d.year);
    return {
      min: Math.min(...years),
      max: Math.max(...years)
    };
  }, [chartData]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (chartData.length < 2) return null;

    const firstYear = chartData[0];
    const lastYear = chartData[chartData.length - 1];
    const firstValue = firstYear[selectedMetric];
    const lastValue = lastYear[selectedMetric];

    if (firstValue == null || lastValue == null) return null;

    const change = lastValue - firstValue;
    const percentChange = (change / Math.abs(firstValue)) * 100;
    const improved = metricConfig.lowerIsBetter ? change < 0 : change > 0;

    // Format the change value
    let changeText;
    if (metricConfig.isRate) {
      // Convert rate difference to percentage points
      const ppChange = change * 100;
      changeText = `${ppChange > 0 ? '+' : ''}${ppChange.toFixed(1)} percentage points`;
    } else if (selectedMetric === 'incentive_multiplier') {
      changeText = `${change > 0 ? '+' : ''}${change.toFixed(4)}`;
    } else {
      changeText = `${change > 0 ? '+' : ''}${Math.round(change)} ${metricConfig.unit}`;
    }

    return {
      firstYear: firstYear.year,
      lastYear: lastYear.year,
      firstValue,
      lastValue,
      change,
      percentChange,
      improved,
      changeText,
      formattedFirst: metricConfig.format(firstValue),
      formattedLast: metricConfig.format(lastValue),
      yearSpan: lastYear.year - firstYear.year
    };
  }, [chartData, selectedMetric, metricConfig]);

  // Empty state
  if (!history || history.length === 0) {
    return (
      <div className="vbp-trend-chart">
        <div className="vbp-trend-header">
          <h3>Historical Performance</h3>
        </div>
        <div className="vbp-trend-empty">
          <p>No historical VBP data available for this facility.</p>
        </div>
      </div>
    );
  }

  // Format Y-axis tick
  const formatYAxis = (value) => {
    if (selectedMetric === 'performance_readmission_rate') {
      return `${(value * 100).toFixed(0)}%`;
    }
    if (selectedMetric === 'incentive_multiplier') {
      return value.toFixed(2);
    }
    return value;
  };

  return (
    <div className="vbp-trend-chart">
      {/* Header */}
      <div className="vbp-trend-header">
        <h3>Historical Performance</h3>
        {yearRange && (
          <span className="vbp-trend-year-range">
            FY{yearRange.min}–{yearRange.max}
          </span>
        )}
      </div>

      {/* Metric Toggle Buttons */}
      <div className="vbp-metric-toggle">
        {METRIC_OPTIONS.map(metric => (
          <button
            key={metric.key}
            className={selectedMetric === metric.key ? 'active' : ''}
            onClick={() => setSelectedMetric(metric.key)}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="vbp-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="year"
                tickFormatter={(year) => `FY${year}`}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                domain={metricConfig.domain}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickLine={{ stroke: '#d1d5db' }}
                width={50}
              />
              <Tooltip
                content={<CustomTooltip metricConfig={metricConfig} />}
              />
              {metricConfig.referenceLine != null && (
                <ReferenceLine
                  y={metricConfig.referenceLine}
                  stroke="#9ca3af"
                  strokeDasharray="5 5"
                  label={{
                    value: 'Break-even',
                    position: 'right',
                    fontSize: 11,
                    fill: '#9ca3af'
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={selectedMetric}
                stroke={metricConfig.color}
                strokeWidth={2}
                dot={{ r: 5, fill: metricConfig.color, strokeWidth: 2, stroke: 'white' }}
                activeDot={{ r: 7, fill: metricConfig.color, strokeWidth: 2, stroke: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="vbp-trend-empty">
          <p>No data available for {metricConfig.label}.</p>
        </div>
      )}

      {/* Summary Box */}
      {summary && (
        <div className="vbp-trend-summary">
          <div className={`vbp-trend-summary-title ${summary.improved ? 'improved' : 'declined'}`}>
            {summary.yearSpan}-Year Change: {summary.changeText}{' '}
            ({summary.improved ? '▲' : '▼'} {Math.abs(summary.percentChange).toFixed(0)}%{' '}
            {summary.improved ? 'improvement' : 'decline'})
          </div>
          <div className="vbp-trend-summary-detail">
            FY{summary.firstYear}: {summary.formattedFirst} → FY{summary.lastYear}: {summary.formattedLast}
          </div>
        </div>
      )}
    </div>
  );
};

export default VBPTrendChart;
