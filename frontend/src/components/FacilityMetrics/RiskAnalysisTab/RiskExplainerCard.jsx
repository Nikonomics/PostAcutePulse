import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Shield, FileWarning, Users, DollarSign } from 'lucide-react';

const RiskExplainerCard = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="risk-explainer-card">
      <button
        className="explainer-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <HelpCircle size={18} />
        <span>How is the Risk Score calculated?</span>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isExpanded && (
        <div className="explainer-content">
          <div className="explainer-section">
            <h4><Shield size={16} /> What is the Composite Risk Score?</h4>
            <p>
              The Composite Risk Score (0-100) provides a quick assessment of overall facility risk
              based on publicly available CMS data. Higher scores indicate higher risk. This score
              helps identify facilities that may require additional due diligence before acquisition.
            </p>
          </div>

          <div className="explainer-section">
            <h4>Score Interpretation</h4>
            <div className="score-legend">
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
                <span className="legend-range">0-25</span>
                <span className="legend-label">Low Risk</span>
                <span className="legend-desc">Facility performing well across metrics</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#eab308' }}></span>
                <span className="legend-range">26-50</span>
                <span className="legend-label">Medium Risk</span>
                <span className="legend-desc">Some areas of concern, worth monitoring</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#f97316' }}></span>
                <span className="legend-range">51-75</span>
                <span className="legend-label">High Risk</span>
                <span className="legend-desc">Significant concerns requiring attention</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
                <span className="legend-range">76-100</span>
                <span className="legend-label">Severe Risk</span>
                <span className="legend-desc">Major issues, proceed with caution</span>
              </div>
            </div>
          </div>

          <div className="explainer-section">
            <h4>How It's Calculated</h4>
            <p>The composite score is a weighted average of three risk categories:</p>
            <div className="weight-breakdown">
              <div className="weight-item">
                <FileWarning size={16} style={{ color: '#f97316' }} />
                <span className="weight-category">Regulatory Risk</span>
                <span className="weight-value">40%</span>
                <span className="weight-factors">Deficiencies, penalties, inspection rating, SFF status</span>
              </div>
              <div className="weight-item">
                <Users size={16} style={{ color: '#8b5cf6' }} />
                <span className="weight-category">Staffing Risk</span>
                <span className="weight-value">35%</span>
                <span className="weight-factors">RN turnover, total turnover, staffing rating, admin tenure</span>
              </div>
              <div className="weight-item">
                <DollarSign size={16} style={{ color: '#3b82f6' }} />
                <span className="weight-category">Financial Risk</span>
                <span className="weight-value">25%</span>
                <span className="weight-factors">Medicaid dependency, occupancy, quality rating, VBP adjustment</span>
              </div>
            </div>
          </div>

          <div className="explainer-section">
            <h4>Important Notes</h4>
            <ul className="explainer-notes">
              <li>This score is based on publicly available CMS data and should be one input among many in your evaluation.</li>
              <li>Some data (like payer mix) may not be available and is estimated based on industry averages.</li>
              <li>Historical trends matter - a high-risk facility improving is different from one getting worse.</li>
              <li>Always conduct thorough on-site due diligence before any acquisition decision.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskExplainerCard;
