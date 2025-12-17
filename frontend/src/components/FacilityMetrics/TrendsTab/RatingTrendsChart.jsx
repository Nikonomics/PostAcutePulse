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
import { Star } from 'lucide-react';

const RATING_COLORS = {
  overall: '#3b82f6', // blue
  quality: '#22c55e', // green
  staffing: '#8b5cf6', // purple
  inspection: '#f97316', // orange
};

const RatingTrendsChart = ({ data }) => {
  const chartData = useMemo(() => {
    return data
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => ({
        date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        overall: snapshot.overall_rating,
        quality: snapshot.qm_rating,
        staffing: snapshot.staffing_rating,
        inspection: snapshot.health_inspection_rating,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="trend-chart-card empty">
        <p>No rating data available</p>
      </div>
    );
  }

  return (
    <div className="trend-chart-card">
      <div className="chart-header">
        <Star size={18} className="status-watch" />
        <h4>Star Ratings Over Time</h4>
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
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line
              type="monotone"
              dataKey="overall"
              name="Overall"
              stroke={RATING_COLORS.overall}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="quality"
              name="Quality"
              stroke={RATING_COLORS.quality}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="staffing"
              name="Staffing"
              stroke={RATING_COLORS.staffing}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="inspection"
              name="Inspection"
              stroke={RATING_COLORS.inspection}
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

export default RatingTrendsChart;
