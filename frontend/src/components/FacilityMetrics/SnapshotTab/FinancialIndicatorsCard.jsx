import React from 'react';
import { DollarSign } from 'lucide-react';

/**
 * Calculate Payer Mix Quality Score
 * Higher Medicare/Private Pay = better margins
 */
const calculatePayerMixScore = (medicare, medicaid, privatePay) => {
  if (medicare == null && medicaid == null && privatePay == null) return null;
  const m = medicare || 0;
  const md = medicaid || 0;
  const pp = privatePay || 0;
  const total = m + md + pp;
  if (total === 0) return null;
  // Weight: Medicare 1.0, Private 0.9, Medicaid 0.5
  return Math.round(((m * 1.0 + pp * 0.9 + md * 0.5) / total) * 100);
};

const getGrade = (score) => {
  if (score == null) return 'N/A';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
};

const getGradeColor = (grade) => {
  const colors = {
    A: '#22c55e',
    B: '#84cc16',
    C: '#eab308',
    D: '#f97316',
    F: '#ef4444',
  };
  return colors[grade] || '#9ca3af';
};

const getGradeDescription = (grade) => {
  const descriptions = {
    A: 'Excellent payer mix with strong margins',
    B: 'Good payer mix with healthy margins',
    C: 'Average payer mix with moderate margins',
    D: 'Below average payer mix, margin pressure',
    F: 'Poor payer mix, significant margin risk',
  };
  return descriptions[grade] || 'Unable to calculate';
};

const PAYER_TYPES = [
  { key: 'medicare_pct', label: 'Medicare', color: '#3b82f6' },
  { key: 'medicaid_pct', label: 'Medicaid', color: '#8b5cf6' },
  { key: 'private_pay_pct', label: 'Private Pay', color: '#22c55e' },
];

// Assumes ~$3M Medicare revenue for average facility
const ESTIMATED_MEDICARE_REVENUE = 3000000;

const FinancialIndicatorsCard = ({ facility }) => {
  if (!facility) return null;

  const payerMixScore = calculatePayerMixScore(
    facility.medicare_pct,
    facility.medicaid_pct,
    facility.private_pay_pct
  );
  const grade = getGrade(payerMixScore);
  const gradeColor = getGradeColor(grade);
  const gradeDescription = getGradeDescription(grade);

  const hasPayerData =
    facility.medicare_pct != null ||
    facility.medicaid_pct != null ||
    facility.private_pay_pct != null;

  const hasVBPData = facility.vbp_adjustment != null;
  const vbpAdjustmentPct = hasVBPData
    ? ((facility.vbp_adjustment - 1) * 100).toFixed(2)
    : null;
  const vbpDollarImpact = hasVBPData
    ? Math.round(ESTIMATED_MEDICARE_REVENUE * (facility.vbp_adjustment - 1))
    : null;

  const formatDollar = (value) => {
    if (value == null) return 'N/A';
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(value).toLocaleString()}`;
  };

  const formatPct = (value, signed = false) => {
    if (value == null) return 'N/A';
    const prefix = signed && value >= 0 ? '+' : '';
    return `${prefix}${value}%`;
  };

  return (
    <div className="metrics-card financial-indicators-card">
      <div className="metrics-card-header">
        <DollarSign size={18} className="status-good" />
        <h4>Financial Indicators</h4>
      </div>

      <div className="financial-content">
        {/* Section 1: Payer Mix Quality Score */}
        <div className="financial-section">
          <div className="section-label">Payer Mix Quality</div>
          {hasPayerData ? (
            <div className="payer-mix-score">
              <div
                className="grade-badge"
                style={{ backgroundColor: gradeColor }}
              >
                {grade}
              </div>
              <div className="grade-info">
                <span className="grade-score">{payerMixScore}/100</span>
                <span className="grade-description">{gradeDescription}</span>
              </div>
            </div>
          ) : (
            <div className="data-unavailable">Payer mix data not available</div>
          )}
        </div>

        {/* Section 2: Payer Mix Breakdown */}
        {hasPayerData && (
          <div className="financial-section">
            <div className="section-label">Payer Breakdown</div>
            <div className="payer-breakdown">
              {PAYER_TYPES.map((payer) => {
                const value = facility[payer.key];
                return (
                  <div key={payer.key} className="payer-row">
                    <span className="payer-label">{payer.label}</span>
                    <div className="payer-bar-container">
                      <div
                        className="payer-bar"
                        style={{
                          width: `${value || 0}%`,
                          backgroundColor: payer.color,
                        }}
                      />
                    </div>
                    <span className="payer-value">
                      {value != null ? `${value.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3: VBP Impact */}
        <div className="financial-section">
          <div className="section-label">VBP Impact</div>
          {hasVBPData ? (
            <div className="vbp-impact">
              <div className="vbp-row">
                <span className="vbp-label">VBP Adjustment</span>
                <span
                  className={`vbp-value ${parseFloat(vbpAdjustmentPct) >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatPct(vbpAdjustmentPct, true)}
                </span>
              </div>
              <div className="vbp-row">
                <span className="vbp-label">Est. Dollar Impact</span>
                <span
                  className={`vbp-value ${vbpDollarImpact >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatDollar(vbpDollarImpact)}
                </span>
              </div>
            </div>
          ) : (
            <div className="data-unavailable">VBP data not available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialIndicatorsCard;
