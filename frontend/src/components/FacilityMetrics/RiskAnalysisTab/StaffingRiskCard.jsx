import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { calculateStaffingRisk, getRiskColor, getRiskLabel } from './CompositeRiskScore';

// Format benchmark value for display
const formatBenchmark = (value, type) => {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  if (type === 'percent') return `${num.toFixed(0)}%`;
  if (type === 'rating') return num.toFixed(1);
  return num.toFixed(1);
};

const StaffingRiskCard = ({ facility, benchmarks }) => {
  const analysis = useMemo(() => {
    const rnTurnover = parseFloat(facility.rn_turnover) || facility.rn_turnover_rate || 0;
    const totalTurnover = parseFloat(facility.total_nursing_turnover) || facility.total_turnover_rate || 0;
    const staffingRating = parseInt(facility.staffing_rating) || 0;
    const adminDays = parseInt(facility.administrator_days_in_role) || 365;

    // Calculate individual point contributions
    let rnTurnoverPoints = 0;
    if (rnTurnover > 60) rnTurnoverPoints = 30;
    else if (rnTurnover > 45) rnTurnoverPoints = 22;
    else if (rnTurnover > 30) rnTurnoverPoints = 12;
    else if (rnTurnover > 20) rnTurnoverPoints = 5;

    let totalTurnoverPoints = 0;
    if (totalTurnover > 70) totalTurnoverPoints = 25;
    else if (totalTurnover > 50) totalTurnoverPoints = 18;
    else if (totalTurnover > 35) totalTurnoverPoints = 10;
    else if (totalTurnover > 25) totalTurnoverPoints = 4;

    let staffingPoints = 0;
    if (staffingRating === 1) staffingPoints = 25;
    else if (staffingRating === 2) staffingPoints = 18;
    else if (staffingRating === 3) staffingPoints = 8;
    else if (staffingRating === 4) staffingPoints = 2;

    let adminPoints = 0;
    if (adminDays < 90) adminPoints = 20;
    else if (adminDays < 180) adminPoints = 14;
    else if (adminDays < 365) adminPoints = 7;

    // Format admin tenure compactly
    let adminTenure = 'N/A';
    if (adminDays) {
      if (adminDays >= 365) {
        const years = Math.floor(adminDays / 365);
        adminTenure = `${years}yr`;
      } else if (adminDays >= 30) {
        const months = Math.floor(adminDays / 30);
        adminTenure = `${months}mo`;
      } else {
        adminTenure = `${adminDays}d`;
      }
    }

    return {
      totalScore: calculateStaffingRisk(facility),
      factors: [
        {
          id: 'rn_turnover',
          label: 'RN Turnover',
          facilityValue: rnTurnover > 0 ? `${rnTurnover.toFixed(0)}%` : 'N/A',
          points: rnTurnoverPoints,
          benchmarkKey: 'avg_rn_turnover',
          benchmarkType: 'percent',
        },
        {
          id: 'total_turnover',
          label: 'Total Turnover',
          facilityValue: totalTurnover > 0 ? `${totalTurnover.toFixed(0)}%` : 'N/A',
          points: totalTurnoverPoints,
          benchmarkKey: 'avg_total_turnover',
          benchmarkType: 'percent',
        },
        {
          id: 'staffing_rating',
          label: 'Staffing Rating',
          facilityValue: staffingRating ? `${staffingRating}★` : 'N/A',
          points: staffingPoints,
          benchmarkKey: 'avg_staffing_rating',
          benchmarkType: 'rating',
        },
        {
          id: 'admin_tenure',
          label: 'Admin Tenure',
          facilityValue: adminTenure,
          points: adminPoints,
          benchmarkKey: null,
        },
      ],
    };
  }, [facility]);

  const riskColor = getRiskColor(analysis.totalScore);
  const riskLabel = getRiskLabel(analysis.totalScore);

  return (
    <div className="risk-breakdown-card">
      <div className="risk-breakdown-header">
        <div className="risk-breakdown-title">
          <Users size={18} style={{ color: riskColor }} />
          <h4>Staffing Risk</h4>
        </div>
        <div className="risk-breakdown-score" style={{ backgroundColor: riskColor }}>
          {analysis.totalScore}
        </div>
      </div>

      <div className="risk-breakdown-label" style={{ color: riskColor }}>
        {riskLabel}
      </div>

      <table className="risk-factors-table">
        <thead>
          <tr>
            <th className="col-metric">Metric</th>
            <th className="col-value">Facility</th>
            <th className="col-benchmark">Mkt</th>
            <th className="col-benchmark">State</th>
            <th className="col-benchmark">Natl</th>
            <th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {analysis.factors.map((factor) => {
            const pointColor = factor.points > 0 ? getRiskColor(factor.points * 4) : '#22c55e';
            return (
              <tr key={factor.id}>
                <td className="col-metric">{factor.label}</td>
                <td className="col-value">{factor.facilityValue}</td>
                <td className="col-benchmark">
                  {factor.benchmarkKey ? formatBenchmark(benchmarks?.market?.[factor.benchmarkKey], factor.benchmarkType) : '—'}
                </td>
                <td className="col-benchmark">
                  {factor.benchmarkKey ? formatBenchmark(benchmarks?.state?.[factor.benchmarkKey], factor.benchmarkType) : '—'}
                </td>
                <td className="col-benchmark">
                  {factor.benchmarkKey ? formatBenchmark(benchmarks?.national?.[factor.benchmarkKey], factor.benchmarkType) : '—'}
                </td>
                <td className="col-pts" style={{ color: pointColor }}>
                  +{factor.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="risk-factor-note">
        High turnover and low staffing indicate operational instability
      </div>
    </div>
  );
};

export default StaffingRiskCard;
