import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

const CHART_CONFIG = {
  total_nursing_hprd: {
    title: 'Staffing HPRD Distribution',
    xLabel: 'Hours per Resident Day',
    color: '#10b981',
    formatBucket: (v) => v?.toFixed(1),
  },
  deficiency_count: {
    title: 'Deficiency Count Distribution',
    xLabel: 'Number of Deficiencies',
    color: '#f97316',
    formatBucket: (v) => v?.toString(),
  },
  rn_turnover: {
    title: 'RN Turnover Distribution',
    xLabel: 'Turnover Rate (%)',
    color: '#ef4444',
    formatBucket: (v) => `${v}%`,
  },
  occupancy: {
    title: 'Occupancy Distribution',
    xLabel: 'Occupancy Rate (%)',
    color: '#6366f1',
    formatBucket: (v) => `${v}%`,
  },
  overall_rating: {
    title: 'Overall Rating Distribution',
    xLabel: 'Star Rating',
    color: '#3b82f6',
    formatBucket: (v) => `${v}★`,
  },
};

const CustomTooltip = ({ active, payload, label, config }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="distribution-tooltip">
      <div className="tooltip-label">{config.formatBucket(label)}</div>
      <div className="tooltip-value">{payload[0].value.toLocaleString()} facilities</div>
    </div>
  );
};

const DistributionChart = ({ metricKey, distribution, facilityValue }) => {
  const config = CHART_CONFIG[metricKey];

  const chartData = useMemo(() => {
    if (!distribution || distribution.length === 0) return [];
    return distribution
      .filter((d) => d.bucket != null)
      .map((d) => ({
        bucket: parseFloat(d.bucket),
        count: parseInt(d.count),
      }))
      .sort((a, b) => a.bucket - b.bucket);
  }, [distribution]);

  // Find which bucket the facility falls into
  const facilityBucket = useMemo(() => {
    if (facilityValue == null || chartData.length === 0) return null;
    const val = parseFloat(facilityValue);

    // Find the bucket that contains the facility value
    for (const d of chartData) {
      const nextBucket = chartData.find((item) => item.bucket > d.bucket);
      const nextVal = nextBucket ? nextBucket.bucket : d.bucket + 10;
      if (val >= d.bucket && val < nextVal) {
        return d.bucket;
      }
    }
    // If value is higher than all buckets, return the last bucket
    return chartData.length > 0 ? chartData[chartData.length - 1].bucket : null;
  }, [chartData, facilityValue]);

  // Early return after hooks
  if (!config || chartData.length === 0) return null;

  return (
    <div className="distribution-chart-card">
      <div className="distribution-chart-header">
        <h4>{config.title}</h4>
        {facilityValue != null && (
          <span className="facility-marker-label">
            Your facility: <strong>{config.formatBucket(facilityValue)}</strong>
          </span>
        )}
      </div>

      <div className="distribution-chart-container">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="bucket"
              tickFormatter={config.formatBucket}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip config={config} />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.bucket === facilityBucket ? '#1d4ed8' : config.color}
                  fillOpacity={entry.bucket === facilityBucket ? 1 : 0.6}
                />
              ))}
            </Bar>
            {facilityValue != null && (
              <ReferenceLine
                x={facilityBucket}
                stroke="#1d4ed8"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="distribution-chart-footer">
        <span className="chart-x-label">{config.xLabel}</span>
      </div>
    </div>
  );
};

export default DistributionChart;
