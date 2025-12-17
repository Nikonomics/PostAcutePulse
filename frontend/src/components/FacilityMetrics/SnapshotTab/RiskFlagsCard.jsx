import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import {
  calculateRegulatoryRisk,
  calculateStaffingRisk,
  calculateFinancialRisk,
  getRiskColor,
  getRiskLabel,
} from '../RiskAnalysisTab/CompositeRiskScore';

/**
 * Generate risk flags based on facility data
 */
const generateRiskFlags = (facility) => {
  const flags = [];

  // Warnings (high severity = red, medium = yellow)
  if (facility.overall_rating && facility.overall_rating <= 2) {
    flags.push({
      type: 'warning',
      severity: 'high',
      text: 'Overall rating is 2 stars or below',
    });
  }

  if (facility.rn_turnover_rate && facility.rn_turnover_rate > 50) {
    flags.push({
      type: 'warning',
      severity: 'high',
      text: `High RN turnover: ${facility.rn_turnover_rate.toFixed(0)}%`,
    });
  } else if (facility.rn_turnover_rate && facility.rn_turnover_rate > 35) {
    flags.push({
      type: 'warning',
      severity: 'medium',
      text: `Elevated RN turnover: ${facility.rn_turnover_rate.toFixed(0)}%`,
    });
  }

  if (facility.total_deficiencies && facility.total_deficiencies > 10) {
    flags.push({
      type: 'warning',
      severity: 'high',
      text: `High deficiency count: ${facility.total_deficiencies}`,
    });
  } else if (facility.total_deficiencies && facility.total_deficiencies > 5) {
    flags.push({
      type: 'warning',
      severity: 'medium',
      text: `Elevated deficiencies: ${facility.total_deficiencies}`,
    });
  }

  if (facility.total_penalties_amount && facility.total_penalties_amount > 50000) {
    flags.push({
      type: 'warning',
      severity: 'high',
      text: `Significant penalties: $${facility.total_penalties_amount.toLocaleString()}`,
    });
  } else if (facility.total_penalties_amount && facility.total_penalties_amount > 10000) {
    flags.push({
      type: 'warning',
      severity: 'medium',
      text: `Penalties on record: $${facility.total_penalties_amount.toLocaleString()}`,
    });
  }

  if (facility.staffing_rating && facility.staffing_rating <= 2) {
    flags.push({
      type: 'warning',
      severity: 'medium',
      text: 'Staffing rating below average',
    });
  }

  if (facility.occupancy_rate && facility.occupancy_rate < 70) {
    flags.push({
      type: 'warning',
      severity: 'medium',
      text: `Low occupancy: ${facility.occupancy_rate}%`,
    });
  }

  // Positives
  if (facility.overall_rating && facility.overall_rating >= 4) {
    flags.push({
      type: 'positive',
      text: 'Above average overall rating',
    });
  }

  if (facility.total_penalties_amount === 0 || facility.total_penalties_amount == null) {
    flags.push({
      type: 'positive',
      text: 'No penalties on record',
    });
  }

  if (facility.quality_rating && facility.quality_rating >= 4) {
    flags.push({
      type: 'positive',
      text: 'Strong quality measures',
    });
  }

  if (facility.staffing_rating && facility.staffing_rating >= 4) {
    flags.push({
      type: 'positive',
      text: 'Above average staffing levels',
    });
  }

  // Sort: high severity warnings, medium severity warnings, then positives
  return flags.sort((a, b) => {
    if (a.type === 'warning' && b.type === 'positive') return -1;
    if (a.type === 'positive' && b.type === 'warning') return 1;
    if (a.type === 'warning' && b.type === 'warning') {
      if (a.severity === 'high' && b.severity === 'medium') return -1;
      if (a.severity === 'medium' && b.severity === 'high') return 1;
    }
    return 0;
  });
};

/**
 * Calculate composite risk score (0-100, higher = more risk)
 * Uses the same weighted calculation as CompositeRiskScore component
 */
const calculateRiskScore = (facility) => {
  const regulatory = calculateRegulatoryRisk(facility);
  const staffing = calculateStaffingRisk(facility);
  const financial = calculateFinancialRisk(facility);

  // Weighted composite (same weights as Risk Analysis tab)
  return Math.round(regulatory * 0.40 + staffing * 0.35 + financial * 0.25);
};

const getSeverityColor = (severity) => {
  if (severity === 'high') return '#ef4444';
  return '#eab308';
};

const RiskFlagsCard = ({ facility }) => {
  if (!facility) return null;

  const flags = generateRiskFlags(facility);
  const riskScore = calculateRiskScore(facility);
  const riskColor = getRiskColor(riskScore);
  const riskLabel = getRiskLabel(riskScore);

  return (
    <div className="metrics-card risk-flags-card">
      <div className="metrics-card-header">
        <AlertTriangle size={18} className="status-watch" />
        <h4>Risk Flags</h4>
      </div>

      <div className="risk-flags-content">
        {/* Risk Flags List */}
        <div className="risk-flags-list">
          {flags.length === 0 ? (
            <div className="no-flags">No significant risk flags detected</div>
          ) : (
            flags.map((flag, index) => (
              <div
                key={index}
                className={`risk-flag-item ${flag.type} ${flag.severity || ''}`}
                style={{
                  borderLeftColor:
                    flag.type === 'warning'
                      ? getSeverityColor(flag.severity)
                      : '#22c55e',
                }}
              >
                {flag.type === 'warning' ? (
                  <AlertTriangle
                    size={16}
                    style={{ color: getSeverityColor(flag.severity) }}
                  />
                ) : (
                  <CheckCircle size={16} style={{ color: '#22c55e' }} />
                )}
                <span className="risk-flag-text">{flag.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Risk Score */}
        <div className="risk-score-section">
          <div className="risk-score-header">
            <span className="risk-score-label">Risk Score</span>
            <span className="risk-score-value" style={{ color: riskColor }}>
              {riskScore}/100 · {riskLabel}
            </span>
          </div>
          <div className="risk-score-bar-container">
            <div
              className="risk-score-bar"
              style={{
                width: `${riskScore}%`,
                backgroundColor: riskColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskFlagsCard;
