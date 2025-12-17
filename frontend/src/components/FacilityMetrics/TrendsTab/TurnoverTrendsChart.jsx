import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { RefreshCw } from 'lucide-react';

const TURNOVER_COLORS = {
  rn: '#ef4444', // red
  total: '#f97316', // orange
};

const TurnoverTrendsChart = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => ({
        date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        rn: parseFloat(snapshot.rn_turnover) || null,
        total: parseFloat(snapshot.total_nursing_turnover) || null,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>No turnover data available</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <RefreshCw size={18} className="status-problem" />
        <h4>Turnover Rates Over Time</h4>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value) => (value ? `${value.toFixed(1)}%` : 'N/A')}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <ReferenceLine
              y={50}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              label={{ value: 'Industry Avg', position: 'right', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="rn"
              name="RN Turnover"
              stroke={TURNOVER_COLORS.rn}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total Nursing"
              stroke={TURNOVER_COLORS.total}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TurnoverTrendsChart;
