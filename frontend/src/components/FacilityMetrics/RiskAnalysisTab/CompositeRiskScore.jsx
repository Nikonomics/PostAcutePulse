import React, { useMemo } from 'react';
import { Shield, FileWarning, Users, DollarSign } from 'lucide-react';

// Calculate Regulatory Risk (0-100)
export const calculateRegulatoryRisk = (facility) => {
  let score = 0;

  // Deficiencies (0-35 points)
  const deficiencies = parseInt(facility.cycle1_total_health_deficiencies) || facility.total_deficiencies || 0;
  if (deficiencies > 15) score += 35;
  else if (deficiencies > 10) score += 25;
  else if (deficiencies > 5) score += 15;
  else if (deficiencies > 0) score += 5;

  // Penalties (0-30 points)
  const penalties = parseFloat(facility.fine_total_dollars) || facility.total_penalties_amount || 0;
  if (penalties > 100000) score += 30;
  else if (penalties > 50000) score += 22;
  else if (penalties > 10000) score += 12;
  else if (penalties > 0) score += 5;

  // Inspection Rating (0-25 points)
  const inspectionRating = parseInt(facility.health_inspection_rating) || 0;
  if (inspectionRating === 1) score += 25;
  else if (inspectionRating === 2) score += 18;
  else if (inspectionRating === 3) score += 10;
  else if (inspectionRating === 4) score += 3;

  // SFF Status (0-10 points)
  if (facility.sff_status || facility.special_focus_facility) score += 10;

  return Math.min(100, score);
};

// Calculate Staffing Risk (0-100)
export const calculateStaffingRisk = (facility) => {
  let score = 0;

  // RN Turnover (0-30 points)
  const rnTurnover = parseFloat(facility.rn_turnover) || facility.rn_turnover_rate || 0;
  if (rnTurnover > 60) score += 30;
  else if (rnTurnover > 45) score += 22;
  else if (rnTurnover > 30) score += 12;
  else if (rnTurnover > 20) score += 5;

  // Total Turnover (0-25 points)
  const totalTurnover = parseFloat(facility.total_nursing_turnover) || facility.total_turnover_rate || 0;
  if (totalTurnover > 70) score += 25;
  else if (totalTurnover > 50) score += 18;
  else if (totalTurnover > 35) score += 10;
  else if (totalTurnover > 25) score += 4;

  // Staffing Rating (0-25 points)
  const staffingRating = parseInt(facility.staffing_rating) || 0;
  if (staffingRating === 1) score += 25;
  else if (staffingRating === 2) score += 18;
  else if (staffingRating === 3) score += 8;
  else if (staffingRating === 4) score += 2;

  // Admin Tenure (0-20 points) - short tenure = higher risk
  const adminDays = parseInt(facility.administrator_days_in_role) || 365;
  if (adminDays < 90) score += 20;
  else if (adminDays < 180) score += 14;
  else if (adminDays < 365) score += 7;

  return Math.min(100, score);
};

// Calculate Financial Risk (0-100)
export const calculateFinancialRisk = (facility) => {
  let score = 0;

  // Medicaid Dependency (0-35 points) - high Medicaid = higher risk
  const medicaidPct = parseFloat(facility.medicaid_pct) || 60;
  if (medicaidPct > 80) score += 35;
  else if (medicaidPct > 70) score += 25;
  else if (medicaidPct > 60) score += 15;
  else if (medicaidPct > 50) score += 8;

  // Low Occupancy (0-30 points)
  const beds = parseInt(facility.certified_beds) || 1;
  const residents = parseInt(facility.average_residents_per_day) || 0;
  const occupancy = facility.occupancy_rate || Math.round((residents / beds) * 100);
  if (occupancy < 60) score += 30;
  else if (occupancy < 70) score += 22;
  else if (occupancy < 80) score += 12;
  else if (occupancy < 85) score += 5;

  // Quality Rating affects reimbursement (0-20 points)
  const qualityRating = parseInt(facility.qm_rating) || facility.quality_rating || 0;
  if (qualityRating === 1) score += 20;
  else if (qualityRating === 2) score += 14;
  else if (qualityRating === 3) score += 6;

  // VBP Negative Adjustment (0-15 points)
  const vbpAdj = parseFloat(facility.vbp_adjustment) || 1;
  if (vbpAdj < 0.98) score += 15;
  else if (vbpAdj < 0.99) score += 10;
  else if (vbpAdj < 1.0) score += 5;

  return Math.min(100, score);
};

export const getRiskColor = (score) => {
  if (score <= 25) return '#22c55e';
  if (score <= 50) return '#eab308';
  if (score <= 75) return '#f97316';
  return '#ef4444';
};

export const getRiskLabel = (score) => {
  if (score <= 25) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  if (score <= 75) return 'High Risk';
  return 'Severe Risk';
};

export const getRiskBgColor = (score) => {
  if (score <= 25) return '#f0fdf4';
  if (score <= 50) return '#fefce8';
  if (score <= 75) return '#fff7ed';
  return '#fef2f2';
};

const CompositeRiskScore = ({ facility }) => {
  const scores = useMemo(() => {
    const regulatory = calculateRegulatoryRisk(facility);
    const staffing = calculateStaffingRisk(facility);
    const financial = calculateFinancialRisk(facility);

    // Weighted composite (regulatory most important for SNFs)
    const composite = Math.round(
      regulatory * 0.40 + staffing * 0.35 + financial * 0.25
    );

    return { composite, regulatory, staffing, financial };
  }, [facility]);

  const compositeColor = getRiskColor(scores.composite);
  const compositeLabel = getRiskLabel(scores.composite);
  const compositeBg = getRiskBgColor(scores.composite);

  return (
    <div className="composite-risk-card" style={{ backgroundColor: compositeBg }}>
      <div className="composite-risk-header">
        <Shield size={24} style={{ color: compositeColor }} />
        <h3>Composite Risk Score</h3>
      </div>

      <div className="composite-risk-content">
        <div className="risk-gauge">
          <div className="risk-score-large" style={{ color: compositeColor }}>
            {scores.composite}
          </div>
          <div className="risk-score-max">/ 100</div>
          <div className="risk-label" style={{ color: compositeColor }}>
            {compositeLabel}
          </div>
        </div>

        <div className="risk-gauge-bar">
          <div
            className="risk-gauge-fill"
            style={{
              width: `${scores.composite}%`,
              backgroundColor: compositeColor
            }}
          />
          <div className="risk-gauge-markers">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        <div className="sub-risk-scores">
          <div className="sub-risk-item">
            <FileWarning size={18} style={{ color: getRiskColor(scores.regulatory) }} />
            <span className="sub-risk-label">Regulatory</span>
            <span className="sub-risk-value" style={{ color: getRiskColor(scores.regulatory) }}>
              {scores.regulatory}
            </span>
          </div>
          <div className="sub-risk-item">
            <Users size={18} style={{ color: getRiskColor(scores.staffing) }} />
            <span className="sub-risk-label">Staffing</span>
            <span className="sub-risk-value" style={{ color: getRiskColor(scores.staffing) }}>
              {scores.staffing}
            </span>
          </div>
          <div className="sub-risk-item">
            <DollarSign size={18} style={{ color: getRiskColor(scores.financial) }} />
            <span className="sub-risk-label">Financial</span>
            <span className="sub-risk-value" style={{ color: getRiskColor(scores.financial) }}>
              {scores.financial}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompositeRiskScore;
