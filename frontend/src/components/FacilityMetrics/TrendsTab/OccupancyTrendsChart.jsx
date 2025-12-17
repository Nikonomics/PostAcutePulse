import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Home } from 'lucide-react';

const OccupancyTrendsChart = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => {
        const beds = parseInt(snapshot.certified_beds) || 1;
        const residents = parseFloat(snapshot.average_residents_per_day) || 0;
        const occupancy = Math.round((residents / beds) * 100);
        return {
          date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
          }),
          occupancy,
          residents: Math.round(residents),
          beds,
        };
      });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>No occupancy data available</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <Home size={18} className="status-good" />
        <h4>Occupancy Rate Over Time</h4>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
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
              domain={[0, 100]}
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
              formatter={(value, name) => {
                if (name === 'occupancy') return [`${value}%`, 'Occupancy'];
                return [value, name];
              }}
              labelFormatter={(label) => label}
            />
            <ReferenceLine
              y={85}
              stroke="#22c55e"
              strokeDasharray="3 3"
              label={{ value: 'Target 85%', position: 'right', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="occupancy"
              name="occupancy"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OccupancyTrendsChart;
