/**
 * DealRegulatoryRisk Component
 *
 * Displays regulatory risk information for facilities in a deal.
 * - Single facility: Shows full RegulatoryRiskCard
 * - Multi-facility (portfolio): Shows compact summary table with expandable rows
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RegulatoryRiskCard from '../RegulatoryRiskCard';
import { getRegulatoryRisk } from '../../api/facilityService';
import './DealRegulatoryRisk.css';

// Risk level configuration
const RISK_CONFIG = {
  low: { color: '#28a745', bg: '#d4edda', label: 'Low' },
  moderate: { color: '#ffc107', bg: '#fff3cd', label: 'Moderate' },
  elevated: { color: '#fd7e14', bg: '#ffe5d0', label: 'Elevated' },
  high: { color: '#dc3545', bg: '#f8d7da', label: 'High' },
};

// Trend icons and colors
const TREND_CONFIG = {
  improving: { icon: TrendingDown, color: '#28a745', label: 'Improving' },
  stable: { icon: Minus, color: '#6b7280', label: 'Stable' },
  deteriorating: { icon: TrendingUp, color: '#dc3545', label: 'Worsening' },
};

const RiskBadge = ({ level }) => {
  const config = RISK_CONFIG[level] || RISK_CONFIG.moderate;
  return (
    <span
      className="deal-risk-badge"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
};

const TrendIndicator = ({ direction }) => {
  const config = TREND_CONFIG[direction] || TREND_CONFIG.stable;
  const Icon = config.icon;
  return (
    <span className="deal-trend-indicator" style={{ color: config.color }}>
      <Icon size={14} />
      <span>{config.label}</span>
    </span>
  );
};

const FacilityRiskRow = ({ facility, riskData, loading, error, expanded, onToggle, dealId }) => {
  const navigate = useNavigate();
  const ccn = facility.federal_provider_number;

  const handleFacilityClick = (e) => {
    e.stopPropagation();
    if (ccn) {
      navigate(`/facility-metrics/${ccn}?from=deal&dealId=${dealId}`);
    }
  };

  return (
    <div className={`facility-risk-row ${expanded ? 'expanded' : ''}`}>
      <div className="facility-risk-header" onClick={onToggle}>
        <div className="facility-risk-name">
          <span
            className={ccn ? 'facility-link' : ''}
            onClick={ccn ? handleFacilityClick : undefined}
          >
            {facility.facility_name || 'Unnamed Facility'}
            {ccn && <ExternalLink size={12} className="link-icon" />}
          </span>
          <span className="facility-location">
            {[facility.city, facility.state].filter(Boolean).join(', ')}
          </span>
        </div>

        {loading ? (
          <div className="facility-risk-loading">
            <Loader2 size={16} className="spin" />
          </div>
        ) : error ? (
          <div className="facility-risk-error">
            <AlertCircle size={16} />
            <span>No data</span>
          </div>
        ) : riskData ? (
          <>
            <div className="facility-risk-cell">
              <RiskBadge level={riskData.risk_score} />
            </div>
            <div className="facility-risk-cell deficiencies">
              <span className="def-count">{riskData.vs_state_peers?.facility_count || 0}</span>
              <span className="def-percentile">
                {riskData.vs_state_peers?.percentile
                  ? `${Math.round(riskData.vs_state_peers.percentile)}th %ile`
                  : '—'}
              </span>
            </div>
            <div className="facility-risk-cell">
              <TrendIndicator direction={riskData.trend?.direction || 'stable'} />
            </div>
            <div className="facility-risk-cell ij-status">
              {riskData.immediate_jeopardy?.has_ij_history ? (
                <span className="ij-warning">
                  <AlertTriangle size={14} />
                  {riskData.immediate_jeopardy.days_since_ij < 365
                    ? `${riskData.immediate_jeopardy.days_since_ij}d ago`
                    : 'IJ History'}
                </span>
              ) : (
                <span className="no-ij">
                  <Shield size={14} />
                  None
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="facility-risk-na">—</div>
        )}

        <button className="expand-btn" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && riskData && (
        <div className="facility-risk-details">
          <RegulatoryRiskCard ccn={ccn} initialData={riskData} />
        </div>
      )}
    </div>
  );
};

const DealRegulatoryRisk = ({ facilities = [], dealId }) => {
  const [riskData, setRiskData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [sectionExpanded, setSectionExpanded] = useState(true);

  // Filter facilities that have CCN
  const facilitiesWithCcn = useMemo(() => {
    return facilities.filter(f => f.federal_provider_number);
  }, [facilities]);

  // Calculate portfolio-level risk summary
  const portfolioSummary = useMemo(() => {
    const risks = Object.values(riskData);
    if (risks.length === 0) return null;

    const riskCounts = { high: 0, elevated: 0, moderate: 0, low: 0 };
    let totalDeficiencies = 0;
    let ijCount = 0;

    risks.forEach(r => {
      if (r.risk_score) riskCounts[r.risk_score]++;
      totalDeficiencies += r.vs_state_peers?.facility_count || 0;
      if (r.immediate_jeopardy?.has_ij_history) ijCount++;
    });

    // Overall risk is highest individual risk
    let overallRisk = 'low';
    if (riskCounts.high > 0) overallRisk = 'high';
    else if (riskCounts.elevated > 0) overallRisk = 'elevated';
    else if (riskCounts.moderate > 0) overallRisk = 'moderate';

    return {
      overallRisk,
      riskCounts,
      totalDeficiencies,
      ijCount,
      facilitiesAnalyzed: risks.length,
    };
  }, [riskData]);

  // Fetch risk data for all facilities in parallel
  useEffect(() => {
    const fetchAllRiskData = async () => {
      const ccns = facilitiesWithCcn.map(f => f.federal_provider_number);

      // Set loading state for all
      setLoading(ccns.reduce((acc, ccn) => ({ ...acc, [ccn]: true }), {}));

      // Fetch in parallel
      const results = await Promise.allSettled(
        ccns.map(ccn => getRegulatoryRisk(ccn))
      );

      const newRiskData = {};
      const newErrors = {};

      results.forEach((result, index) => {
        const ccn = ccns[index];
        if (result.status === 'fulfilled' && result.value?.success && result.value?.data) {
          // Extract the data object from the API response
          newRiskData[ccn] = result.value.data;
        } else {
          newErrors[ccn] = true;
        }
      });

      setRiskData(newRiskData);
      setErrors(newErrors);
      setLoading({});
    };

    if (facilitiesWithCcn.length > 0) {
      fetchAllRiskData();
    }
  }, [facilitiesWithCcn]);

  const toggleRow = (ccn) => {
    setExpandedRows(prev => ({ ...prev, [ccn]: !prev[ccn] }));
  };

  // No facilities with CCN - show message
  if (facilitiesWithCcn.length === 0) {
    return (
      <div className="deal-regulatory-risk-section">
        <div className="deal-risk-header-bar">
          <div className="deal-risk-title">
            <Shield size={20} />
            <span>Regulatory Risk Assessment</span>
          </div>
        </div>
        <div className="deal-risk-empty">
          <AlertCircle size={24} />
          <p>No CMS-linked facilities found. Link facilities to CMS data to view regulatory risk.</p>
        </div>
      </div>
    );
  }

  // Single facility - show full card
  if (facilitiesWithCcn.length === 1) {
    const facility = facilitiesWithCcn[0];
    const ccn = facility.federal_provider_number;

    return (
      <div className="deal-regulatory-risk-section single-facility">
        <div className="deal-risk-header-bar">
          <div className="deal-risk-title">
            <Shield size={20} />
            <span>Regulatory Risk Assessment</span>
          </div>
          {riskData[ccn] && (
            <RiskBadge level={riskData[ccn].risk_score} />
          )}
        </div>
        <div className="deal-risk-card-container">
          <RegulatoryRiskCard ccn={ccn} />
        </div>
      </div>
    );
  }

  // Multi-facility - show table
  return (
    <div className="deal-regulatory-risk-section">
      <div
        className="deal-risk-header-bar clickable"
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <div className="deal-risk-title">
          <Shield size={20} />
          <span>Regulatory Risk Assessment</span>
          <span className="facility-count">{facilitiesWithCcn.length} facilities</span>
        </div>

        {portfolioSummary && (
          <div className="portfolio-risk-summary">
            <div className="summary-item">
              <span className="summary-label">Portfolio Risk:</span>
              <RiskBadge level={portfolioSummary.overallRisk} />
            </div>
            {portfolioSummary.riskCounts.high > 0 && (
              <div className="summary-item warning">
                <AlertTriangle size={14} />
                <span>{portfolioSummary.riskCounts.high} high risk</span>
              </div>
            )}
            {portfolioSummary.ijCount > 0 && (
              <div className="summary-item warning">
                <span>{portfolioSummary.ijCount} with IJ history</span>
              </div>
            )}
          </div>
        )}

        <button className="section-expand-btn">
          {sectionExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {sectionExpanded && (
        <>
          <div className="deal-risk-table-header">
            <div className="table-col facility">Facility</div>
            <div className="table-col risk">Risk</div>
            <div className="table-col deficiencies">Deficiencies</div>
            <div className="table-col trend">Trend</div>
            <div className="table-col ij">IJ Status</div>
            <div className="table-col expand"></div>
          </div>

          <div className="deal-risk-table-body">
            {facilitiesWithCcn.map(facility => {
              const ccn = facility.federal_provider_number;
              return (
                <FacilityRiskRow
                  key={facility.id || ccn}
                  facility={facility}
                  riskData={riskData[ccn]}
                  loading={loading[ccn]}
                  error={errors[ccn]}
                  expanded={expandedRows[ccn]}
                  onToggle={() => toggleRow(ccn)}
                  dealId={dealId}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default DealRegulatoryRisk;
