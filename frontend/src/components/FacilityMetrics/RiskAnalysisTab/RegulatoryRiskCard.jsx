import React, { useMemo, useState } from 'react';
import { FileWarning, ExternalLink } from 'lucide-react';
import { calculateRegulatoryRisk, getRiskColor, getRiskLabel } from './CompositeRiskScore';
import DeficiencyDrillDown from './DeficiencyDrillDown';
import PenaltyDrillDown from './PenaltyDrillDown';

// Format benchmark value for display
const formatBenchmark = (value, type) => {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  if (type === 'rating') return num.toFixed(1);
  if (type === 'count') return Math.round(num).toString();
  return num.toFixed(1);
};

const RegulatoryRiskCard = ({ facility, benchmarks }) => {
  const [showDeficiencies, setShowDeficiencies] = useState(false);
  const [showPenalties, setShowPenalties] = useState(false);

  const analysis = useMemo(() => {
    const deficiencies = parseInt(facility.cycle1_total_health_deficiencies) || facility.total_deficiencies || 0;
    const penalties = parseFloat(facility.fine_total_dollars) || facility.total_penalties_amount || 0;
    const inspectionRating = parseInt(facility.health_inspection_rating) || 0;
    const isSFF = facility.sff_status || facility.special_focus_facility;

    // Calculate individual point contributions
    let deficiencyPoints = 0;
    if (deficiencies > 15) deficiencyPoints = 35;
    else if (deficiencies > 10) deficiencyPoints = 25;
    else if (deficiencies > 5) deficiencyPoints = 15;
    else if (deficiencies > 0) deficiencyPoints = 5;

    let penaltyPoints = 0;
    if (penalties > 100000) penaltyPoints = 30;
    else if (penalties > 50000) penaltyPoints = 22;
    else if (penalties > 10000) penaltyPoints = 12;
    else if (penalties > 0) penaltyPoints = 5;

    let inspectionPoints = 0;
    if (inspectionRating === 1) inspectionPoints = 25;
    else if (inspectionRating === 2) inspectionPoints = 18;
    else if (inspectionRating === 3) inspectionPoints = 10;
    else if (inspectionRating === 4) inspectionPoints = 3;

    const sffPoints = isSFF ? 10 : 0;

    return {
      totalScore: calculateRegulatoryRisk(facility),
      factors: [
        {
          id: 'deficiencies',
          label: 'Health Deficiencies',
          facilityValue: deficiencies.toString(),
          points: deficiencyPoints,
          clickable: true,
          onClick: () => setShowDeficiencies(true),
          benchmarkKey: 'avg_deficiencies',
          benchmarkType: 'count',
        },
        {
          id: 'penalties',
          label: 'Civil Penalties',
          facilityValue: penalties > 0 ? `$${(penalties / 1000).toFixed(0)}K` : '$0',
          points: penaltyPoints,
          clickable: true,
          onClick: () => setShowPenalties(true),
          benchmarkKey: null,
        },
        {
          id: 'inspection',
          label: 'Inspection Rating',
          facilityValue: inspectionRating ? `${inspectionRating}★` : 'N/A',
          points: inspectionPoints,
          clickable: false,
          benchmarkKey: 'avg_inspection_rating',
          benchmarkType: 'rating',
        },
        {
          id: 'sff',
          label: 'Special Focus Status',
          facilityValue: isSFF ? 'Yes' : 'No',
          points: sffPoints,
          clickable: false,
          benchmarkKey: null,
        },
      ],
    };
  }, [facility]);

  const riskColor = getRiskColor(analysis.totalScore);
  const riskLabel = getRiskLabel(analysis.totalScore);

  return (
    <>
      <div className="risk-breakdown-card">
        <div className="risk-breakdown-header">
          <div className="risk-breakdown-title">
            <FileWarning size={18} style={{ color: riskColor }} />
            <h4>Regulatory Risk</h4>
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
                <tr
                  key={factor.id}
                  className={factor.clickable ? 'clickable-row' : ''}
                  onClick={factor.clickable ? factor.onClick : undefined}
                >
                  <td className="col-metric">
                    <span className={factor.clickable ? 'has-drilldown' : ''}>
                      {factor.label}
                    </span>
                    {factor.clickable && <ExternalLink size={10} className="drilldown-icon-inline" />}
                  </td>
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
          Higher scores indicate greater regulatory compliance risk
        </div>
      </div>

      {/* Drill-down modals */}
      <DeficiencyDrillDown
        isOpen={showDeficiencies}
        onClose={() => setShowDeficiencies(false)}
        ccn={facility.ccn}
        facilityName={facility.provider_name || facility.facility_name}
      />
      <PenaltyDrillDown
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        ccn={facility.ccn}
        facilityName={facility.provider_name || facility.facility_name}
      />
    </>
  );
};

export default RegulatoryRiskCard;
