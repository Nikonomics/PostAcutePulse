import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Shield,
  FileWarning,
  Calendar,
  MessageSquareWarning,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { getRegulatoryRisk } from '../../api/facilityService';
import './RegulatoryRiskCard.css';

// Risk badge colors and labels
const RISK_CONFIG = {
  low: { color: '#28a745', bgColor: '#d4edda', label: 'LOW' },
  moderate: { color: '#856404', bgColor: '#fff3cd', label: 'MODERATE' },
  elevated: { color: '#fd7e14', bgColor: '#ffe5d0', label: 'ELEVATED' },
  high: { color: '#dc3545', bgColor: '#f8d7da', label: 'HIGH' },
};

// Trend icons and colors
const TREND_CONFIG = {
  improving: { icon: TrendingDown, color: '#28a745', label: 'Improving' },
  stable: { icon: Minus, color: '#6c757d', label: 'Stable' },
  deteriorating: { icon: TrendingUp, color: '#dc3545', label: 'Deteriorating' },
  new_issues: { icon: AlertTriangle, color: '#fd7e14', label: 'New Issues' },
  insufficient_data: { icon: Minus, color: '#6c757d', label: 'Insufficient Data' },
};

// Severity badge colors
const SEVERITY_COLORS = {
  L: { bg: '#f8d7da', text: '#721c24', label: 'Widespread IJ' },
  K: { bg: '#f8d7da', text: '#721c24', label: 'Pattern IJ' },
  J: { bg: '#f8d7da', text: '#721c24', label: 'Isolated IJ' },
  I: { bg: '#ffe5d0', text: '#856404', label: 'Widespread Harm' },
  H: { bg: '#ffe5d0', text: '#856404', label: 'Pattern Harm' },
  G: { bg: '#fff3cd', text: '#856404', label: 'Isolated Harm' },
  F: { bg: '#e2e3e5', text: '#383d41', label: 'Widespread' },
  E: { bg: '#e2e3e5', text: '#383d41', label: 'Pattern' },
  D: { bg: '#d4edda', text: '#155724', label: 'Isolated' },
};

function RegulatoryRiskCard({ ccn, initialData = null }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // If initialData is provided, use it and skip fetch
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      if (!ccn) return;

      setLoading(true);
      setError(null);

      try {
        const response = await getRegulatoryRisk(ccn);
        if (response.success) {
          setData(response.data);
        } else {
          setError(response.error || 'Failed to load regulatory risk data');
        }
      } catch (err) {
        console.error('Failed to load regulatory risk:', err);
        setError('No regulatory data available');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ccn, initialData]);

  // Loading state
  if (loading) {
    return (
      <div className="regulatory-risk-card">
        <div className="risk-card-header">
          <div className="risk-card-title">
            <Shield size={18} />
            <span>Regulatory Risk</span>
          </div>
        </div>
        <div className="risk-card-loading">
          <Loader2 size={24} className="spin" />
          <span>Analyzing regulatory history...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="regulatory-risk-card">
        <div className="risk-card-header">
          <div className="risk-card-title">
            <Shield size={18} />
            <span>Regulatory Risk</span>
          </div>
        </div>
        <div className="risk-card-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const riskConfig = RISK_CONFIG[data.risk_score] || RISK_CONFIG.moderate;
  const trendConfig = TREND_CONFIG[data.trend?.direction] || TREND_CONFIG.stable;
  const TrendIcon = trendConfig.icon;

  return (
    <div className="regulatory-risk-card">
      {/* Header with risk badge */}
      <div className="risk-card-header">
        <div className="risk-card-title">
          <Shield size={18} />
          <span>Regulatory Risk</span>
        </div>
        <div
          className="risk-badge"
          style={{
            backgroundColor: riskConfig.bgColor,
            color: riskConfig.color,
          }}
        >
          {riskConfig.label}
        </div>
      </div>

      {/* Summary content */}
      <div className="risk-card-summary">
        {/* Deficiency count and percentile */}
        <div className="risk-summary-row">
          <FileWarning size={16} className="risk-icon" />
          <span>
            <strong>{data.vs_state_peers?.facility_count || 0}</strong> deficiencies
            {data.vs_state_peers?.percentile > 0 && (
              <span className="percentile-note">
                {' '}({data.vs_state_peers.percentile}th percentile in state)
              </span>
            )}
          </span>
        </div>

        {/* Trend */}
        <div className="risk-summary-row">
          <TrendIcon size={16} className="risk-icon" style={{ color: trendConfig.color }} />
          <span>
            Trend: <strong style={{ color: trendConfig.color }}>{trendConfig.label}</strong>
            {data.trend?.change !== 0 && data.trend?.direction !== 'insufficient_data' && (
              <span className="trend-change">
                {' '}({data.trend.change > 0 ? '+' : ''}{data.trend.change} vs prior year)
              </span>
            )}
          </span>
        </div>

        {/* Immediate Jeopardy warning - only show if has IJ history */}
        {data.immediate_jeopardy?.has_ij_history && (
          <div className="risk-summary-row ij-warning">
            <AlertTriangle size={16} className="risk-icon" />
            <span>
              <strong>Immediate Jeopardy:</strong>{' '}
              {data.immediate_jeopardy.days_since_ij !== null
                ? `${data.immediate_jeopardy.days_since_ij} days ago`
                : 'Historical'}
              {data.immediate_jeopardy.total_ij_citations > 1 && (
                <span className="ij-count">
                  {' '}({data.immediate_jeopardy.total_ij_citations} total citations)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Low risk positive message */}
        {data.risk_score === 'low' && !data.immediate_jeopardy?.has_ij_history && (
          <div className="risk-summary-row low-risk">
            <CheckCircle size={16} className="risk-icon" style={{ color: '#28a745' }} />
            <span style={{ color: '#28a745' }}>
              Clean regulatory history with no immediate jeopardy
            </span>
          </div>
        )}
      </div>

      {/* Expand/collapse button */}
      <button
        className="risk-expand-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <>
            <ChevronUp size={16} /> Less Details
          </>
        ) : (
          <>
            <ChevronDown size={16} /> More Details
          </>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="risk-card-details">
          {/* Complaint surveys */}
          <div className="risk-detail-section">
            <h4>
              <MessageSquareWarning size={16} />
              Complaint Surveys (3 Years)
            </h4>
            <div className="complaint-stats">
              <div className="complaint-stat">
                <span className="stat-value">{data.complaint_surveys?.facility_count || 0}</span>
                <span className="stat-label">This Facility</span>
              </div>
              <div className="complaint-stat">
                <span className="stat-value">{data.complaint_surveys?.state_avg?.toFixed(1) || '0'}</span>
                <span className="stat-label">State Avg</span>
              </div>
              <div className="complaint-stat">
                <span className="stat-value">{data.complaint_surveys?.national_avg?.toFixed(1) || '0'}</span>
                <span className="stat-label">National Avg</span>
              </div>
            </div>
          </div>

          {/* Serious findings */}
          {data.serious_findings && data.serious_findings.length > 0 && (
            <div className="risk-detail-section">
              <h4>
                <AlertTriangle size={16} />
                Most Serious Findings
              </h4>
              <div className="findings-list">
                {data.serious_findings.map((finding, idx) => {
                  const severityConfig = SEVERITY_COLORS[finding.severity_code] || SEVERITY_COLORS.D;
                  return (
                    <div key={idx} className="finding-item">
                      <div className="finding-header">
                        <div className="finding-meta">
                          <span className="finding-ftag">{finding.ftag}</span>
                          <span
                            className="finding-severity"
                            style={{
                              backgroundColor: severityConfig.bg,
                              color: severityConfig.text,
                            }}
                          >
                            {severityConfig.label}
                          </span>
                          {finding.is_complaint && (
                            <span className="finding-complaint">Complaint</span>
                          )}
                        </div>
                        <span className="finding-date">
                          <Calendar size={12} />
                          {finding.survey_date}
                        </span>
                      </div>
                      <p className="finding-summary">{finding.summary}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data freshness */}
          <div className="risk-data-freshness">
            Data through: {data.data_through}
          </div>
        </div>
      )}
    </div>
  );
}

export default RegulatoryRiskCard;
