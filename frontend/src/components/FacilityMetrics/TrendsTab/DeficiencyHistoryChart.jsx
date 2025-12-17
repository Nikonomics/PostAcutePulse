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
import { AlertTriangle } from 'lucide-react';

const DeficiencyHistoryChart = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => ({
        date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        deficiencies: parseInt(snapshot.cycle1_total_health_deficiencies) || 0,
        standard: parseInt(snapshot.cycle1_standard_deficiencies) || 0,
        complaint: parseInt(snapshot.cycle1_complaint_deficiencies) || 0,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>No deficiency data available</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <AlertTriangle size={18} className="status-watch" />
        <h4>Deficiency History</h4>
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
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <Bar
              dataKey="deficiencies"
              name="Total Deficiencies"
              fill="#f97316"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DeficiencyHistoryChart;
