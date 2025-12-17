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
} from 'recharts';
import { Users } from 'lucide-react';

const STAFFING_COLORS = {
  total: '#3b82f6', // blue
  rn: '#22c55e', // green
  lpn: '#8b5cf6', // purple
  cna: '#f97316', // orange
};

const StaffingTrendsChart = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => ({
        date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        total: parseFloat(snapshot.reported_total_nurse_hrs) || null,
        rn: parseFloat(snapshot.reported_rn_hrs) || null,
        lpn: parseFloat(snapshot.reported_lpn_hrs) || null,
        cna: parseFloat(snapshot.reported_na_hrs) || null,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>No staffing data available</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <Users size={18} className="status-neutral" />
        <h4>Staffing Hours (HPRD) Over Time</h4>
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
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value) => (value ? value.toFixed(2) : 'N/A')}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke={STAFFING_COLORS.total}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="rn"
              name="RN"
              stroke={STAFFING_COLORS.rn}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="lpn"
              name="LPN"
              stroke={STAFFING_COLORS.lpn}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="cna"
              name="CNA"
              stroke={STAFFING_COLORS.cna}
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

export default StaffingTrendsChart;
