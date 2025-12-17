import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign } from 'lucide-react';

const PenaltyTimelineChart = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => ({
        date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        amount: parseFloat(snapshot.fine_total_dollars) || 0,
        count: parseInt(snapshot.fine_count) || 0,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>No penalty data available</p>
      </div>
    );
  }

  const formatDollar = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <DollarSign size={18} className="status-problem" />
        <h4>Penalty History</h4>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatDollar} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value, name) => {
                if (name === 'amount') return [`$${value.toLocaleString()}`, 'Penalty Amount'];
                return [value, 'Fine Count'];
              }}
            />
            <Bar
              dataKey="amount"
              name="amount"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PenaltyTimelineChart;
