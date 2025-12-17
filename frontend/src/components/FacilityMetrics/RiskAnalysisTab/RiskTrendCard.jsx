import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  calculateRegulatoryRisk,
  calculateStaffingRisk,
  calculateFinancialRisk,
  getRiskColor,
} from './CompositeRiskScore';

const RiskTrendCard = ({ facility, snapshots }) => {
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    return snapshots
      .filter((s) => s.extract_date)
      .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date))
      .map((snapshot) => {
        const regulatory = calculateRegulatoryRisk(snapshot);
        const staffing = calculateStaffingRisk(snapshot);
        const financial = calculateFinancialRisk(snapshot);
        const composite = Math.round(
          regulatory * 0.40 + staffing * 0.35 + financial * 0.25
        );

        return {
          date: new Date(snapshot.extract_date).toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
          }),
          composite,
          regulatory,
          staffing,
          financial,
        };
      });
  }, [snapshots]);

  if (chartData.length === 0) {
    return (
      <div className="risk-trend-card empty">
        <TrendingUp size={32} />
        <p>No historical risk data available</p>
      </div>
    );
  }

  // Calculate trend direction
  const recentData = chartData.slice(-6);
  const oldAvg = recentData.slice(0, 3).reduce((a, b) => a + b.composite, 0) / 3;
  const newAvg = recentData.slice(-3).reduce((a, b) => a + b.composite, 0) / 3;
  const trendDirection = newAvg > oldAvg ? 'increasing' : newAvg < oldAvg ? 'decreasing' : 'stable';
  const trendChange = Math.abs(newAvg - oldAvg).toFixed(1);

  const currentScore = chartData[chartData.length - 1]?.composite || 0;
  const currentColor = getRiskColor(currentScore);

  return (
    <div className="risk-trend-card">
      <div className="risk-trend-header">
        <div className="risk-trend-title">
          <TrendingUp size={20} style={{ color: currentColor }} />
          <h4>Risk Score Trend</h4>
        </div>
        <div className="risk-trend-summary">
          <span className={`trend-direction ${trendDirection}`}>
            {trendDirection === 'increasing' && '+ '}
            {trendDirection === 'decreasing' && '- '}
            {trendChange} pts
          </span>
          <span className="trend-period">vs 6 months ago</span>
        </div>
      </div>

      <div className="risk-trend-chart">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={currentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value, name) => {
                const labels = {
                  composite: 'Composite',
                  regulatory: 'Regulatory',
                  staffing: 'Staffing',
                  financial: 'Financial',
                };
                return [value, labels[name] || name];
              }}
            />
            {/* Risk level reference lines */}
            <ReferenceLine y={25} stroke="#22c55e" strokeDasharray="5 5" strokeOpacity={0.5} />
            <ReferenceLine y={50} stroke="#eab308" strokeDasharray="5 5" strokeOpacity={0.5} />
            <ReferenceLine y={75} stroke="#f97316" strokeDasharray="5 5" strokeOpacity={0.5} />

            {/* Area fill under composite line */}
            <Area
              type="monotone"
              dataKey="composite"
              stroke="none"
              fill="url(#riskGradient)"
            />

            {/* Main composite risk line */}
            <Line
              type="monotone"
              dataKey="composite"
              name="composite"
              stroke={currentColor}
              strokeWidth={3}
              dot={false}
              connectNulls
            />

            {/* Sub-category lines (thinner, dotted) */}
            <Line
              type="monotone"
              dataKey="regulatory"
              name="regulatory"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="staffing"
              name="staffing"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="financial"
              name="financial"
              stroke="#06b6d4"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="risk-trend-legend">
        <div className="legend-item">
          <span className="legend-line composite" style={{ backgroundColor: currentColor }}></span>
          <span>Composite</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" style={{ backgroundColor: '#6366f1' }}></span>
          <span>Regulatory</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" style={{ backgroundColor: '#8b5cf6' }}></span>
          <span>Staffing</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" style={{ backgroundColor: '#06b6d4' }}></span>
          <span>Financial</span>
        </div>
      </div>
    </div>
  );
};

export default RiskTrendCard;
