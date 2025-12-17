import React, { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { calculateFinancialRisk, getRiskColor, getRiskLabel } from './CompositeRiskScore';

// Format benchmark value for display
const formatBenchmark = (value, type) => {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  if (type === 'percent') return `${num.toFixed(0)}%`;
  if (type === 'rating') return num.toFixed(1);
  return num.toFixed(1);
};

const FinancialRiskCard = ({ facility, benchmarks }) => {
  const analysis = useMemo(() => {
    const medicaidPct = parseFloat(facility.medicaid_pct) || 60;
    const beds = parseInt(facility.certified_beds) || 1;
    const residents = parseInt(facility.average_residents_per_day) || 0;
    const occupancy = facility.occupancy_rate || Math.round((residents / beds) * 100);
    const qualityRating = parseInt(facility.qm_rating) || facility.quality_rating || 0;
    const vbpAdj = parseFloat(facility.vbp_adjustment) || 1;

    // Calculate individual point contributions
    let medicaidPoints = 0;
    if (medicaidPct > 80) medicaidPoints = 35;
    else if (medicaidPct > 70) medicaidPoints = 25;
    else if (medicaidPct > 60) medicaidPoints = 15;
    else if (medicaidPct > 50) medicaidPoints = 8;

    let occupancyPoints = 0;
    if (occupancy < 60) occupancyPoints = 30;
    else if (occupancy < 70) occupancyPoints = 22;
    else if (occupancy < 80) occupancyPoints = 12;
    else if (occupancy < 85) occupancyPoints = 5;

    let qualityPoints = 0;
    if (qualityRating === 1) qualityPoints = 20;
    else if (qualityRating === 2) qualityPoints = 14;
    else if (qualityRating === 3) qualityPoints = 6;

    let vbpPoints = 0;
    if (vbpAdj < 0.98) vbpPoints = 15;
    else if (vbpAdj < 0.99) vbpPoints = 10;
    else if (vbpAdj < 1.0) vbpPoints = 5;

    // Format VBP adjustment compactly
    let vbpDisplay = '0%';
    if (vbpAdj && vbpAdj !== 1) {
      const pctChange = ((vbpAdj - 1) * 100).toFixed(1);
      vbpDisplay = vbpAdj >= 1 ? `+${pctChange}%` : `${pctChange}%`;
    }

    return {
      totalScore: calculateFinancialRisk(facility),
      factors: [
        {
          id: 'medicaid',
          label: 'Medicaid %',
          facilityValue: `${medicaidPct.toFixed(0)}%`,
          points: medicaidPoints,
          benchmarkKey: null,
        },
        {
          id: 'occupancy',
          label: 'Occupancy',
          facilityValue: `${occupancy}%`,
          points: occupancyPoints,
          benchmarkKey: 'avg_occupancy',
          benchmarkType: 'percent',
        },
        {
          id: 'quality',
          label: 'Quality Rating',
          facilityValue: qualityRating ? `${qualityRating}★` : 'N/A',
          points: qualityPoints,
          benchmarkKey: 'avg_quality_rating',
          benchmarkType: 'rating',
        },
        {
          id: 'vbp',
          label: 'VBP Adj',
          facilityValue: vbpDisplay,
          points: vbpPoints,
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
          <DollarSign size={18} style={{ color: riskColor }} />
          <h4>Financial Risk</h4>
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
        Low occupancy and high Medicaid dependency reduce financial flexibility
      </div>
    </div>
  );
};

export default FinancialRiskCard;
