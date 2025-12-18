import React from 'react';
import { Building2, Star, MapPin, Phone, Calendar, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  calculateRegulatoryRisk,
  calculateStaffingRisk,
  calculateFinancialRisk,
  getRiskColor,
  getRiskLabel,
} from '../RiskAnalysisTab/CompositeRiskScore';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCurrency = (value) => {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const formatPercent = (value) => {
  if (value == null) return 'N/A';
  return `${Math.round(value)}%`;
};

const getRatingColor = (rating) => {
  if (rating >= 4) return '#22c55e';
  if (rating >= 3) return '#84cc16';
  if (rating >= 2) return '#f59e0b';
  return '#ef4444';
};

// Helper to get benchmark value - handles both avg_* and regular field names
const getBenchmark = (benchmarks, level, field) => {
  if (!benchmarks?.[level]) return null;
  const data = benchmarks[level];

  // Map field names to backend avg_* fields
  const fieldMap = {
    overall_rating: 'avg_overall_rating',
    quality_rating: 'avg_quality_rating',
    staffing_rating: 'avg_staffing_rating',
    health_inspection_rating: 'avg_inspection_rating',
    total_nursing_hprd: 'avg_total_nursing_hprd',
    rn_hprd: 'avg_rn_hprd',
    rn_turnover: 'avg_rn_turnover',
    occupancy: 'avg_occupancy',
    total_deficiencies: 'avg_deficiencies',
  };

  const backendField = fieldMap[field] || field;
  const value = data[backendField] ?? data[field];
  return value != null ? parseFloat(value) : null;
};

const StarRating = ({ rating }) => {
  if (rating == null) return <span className="preview-na">N/A</span>;
  return (
    <div className="preview-stars" style={{ color: getRatingColor(rating) }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={n <= rating ? 'currentColor' : 'none'} />
      ))}
    </div>
  );
};

const TrendIndicator = ({ direction }) => {
  if (direction === 'up') return <TrendingUp size={14} className="trend-up" />;
  if (direction === 'down') return <TrendingDown size={14} className="trend-down" />;
  return <Minus size={14} className="trend-neutral" />;
};

// Section: Facility Overview
const OverviewSection = ({ facility }) => (
  <div className="preview-section">
    <h3 className="preview-section-title">
      <Building2 size={18} />
      Facility Overview
    </h3>
    <div className="preview-overview-grid">
      <div className="preview-overview-main">
        <h4 className="preview-facility-name">{facility.provider_name || facility.facility_name}</h4>
        <div className="preview-facility-meta">
          <span><MapPin size={14} /> {facility.city}, {facility.state} {facility.zip}</span>
          {facility.phone && <span><Phone size={14} /> {facility.phone}</span>}
        </div>
      </div>
      <div className="preview-overview-details">
        <div className="preview-detail-row">
          <span className="preview-detail-label">CCN:</span>
          <span className="preview-detail-value">{facility.ccn}</span>
        </div>
        <div className="preview-detail-row">
          <span className="preview-detail-label">Certified Beds:</span>
          <span className="preview-detail-value">{facility.certified_beds || 'N/A'}</span>
        </div>
        <div className="preview-detail-row">
          <span className="preview-detail-label">Ownership:</span>
          <span className="preview-detail-value">{facility.ownership_type || 'N/A'}</span>
        </div>
        <div className="preview-detail-row">
          <span className="preview-detail-label">Provider Type:</span>
          <span className="preview-detail-value">{facility.provider_type || 'SNF'}</span>
        </div>
      </div>
    </div>
  </div>
);

// Section: Star Ratings
const RatingsSection = ({ facility, benchmarks }) => (
  <div className="preview-section">
    <h3 className="preview-section-title">
      <Star size={18} />
      Star Ratings Summary
    </h3>
    <table className="preview-table">
      <thead>
        <tr>
          <th>Rating</th>
          <th>Facility</th>
          <th>National Avg</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Overall Rating</td>
          <td><StarRating rating={facility.overall_rating} /></td>
          <td>{getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || '3.0'}</td>
        </tr>
        <tr>
          <td>Quality Rating</td>
          <td><StarRating rating={facility.quality_rating} /></td>
          <td>{getBenchmark(benchmarks, 'national', 'quality_rating')?.toFixed(1) || '3.0'}</td>
        </tr>
        <tr>
          <td>Staffing Rating</td>
          <td><StarRating rating={facility.staffing_rating} /></td>
          <td>{getBenchmark(benchmarks, 'national', 'staffing_rating')?.toFixed(1) || '3.0'}</td>
        </tr>
        <tr>
          <td>Inspection Rating</td>
          <td><StarRating rating={facility.health_inspection_rating} /></td>
          <td>{getBenchmark(benchmarks, 'national', 'health_inspection_rating')?.toFixed(1) || '3.0'}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

// Section: Key Metrics
const MetricsSection = ({ facility, benchmarks }) => (
  <div className="preview-section">
    <h3 className="preview-section-title">Key Metrics</h3>
    <table className="preview-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Facility</th>
          <th>State Avg</th>
          <th>National Avg</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total Nursing HPRD</td>
          <td>{facility.total_nursing_hprd?.toFixed(2) || 'N/A'}</td>
          <td>{getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A'}</td>
          <td>{getBenchmark(benchmarks, 'national', 'total_nursing_hprd')?.toFixed(2) || 'N/A'}</td>
        </tr>
        <tr>
          <td>RN HPRD</td>
          <td>{facility.rn_hprd?.toFixed(2) || 'N/A'}</td>
          <td>{getBenchmark(benchmarks, 'state', 'rn_hprd')?.toFixed(2) || 'N/A'}</td>
          <td>{getBenchmark(benchmarks, 'national', 'rn_hprd')?.toFixed(2) || 'N/A'}</td>
        </tr>
        <tr>
          <td>RN Turnover</td>
          <td>{formatPercent(facility.rn_turnover_rate)}</td>
          <td>{formatPercent(getBenchmark(benchmarks, 'state', 'rn_turnover'))}</td>
          <td>{formatPercent(getBenchmark(benchmarks, 'national', 'rn_turnover'))}</td>
        </tr>
        <tr>
          <td>Occupancy</td>
          <td>{formatPercent(facility.occupancy_rate)}</td>
          <td>{formatPercent(getBenchmark(benchmarks, 'state', 'occupancy'))}</td>
          <td>{formatPercent(getBenchmark(benchmarks, 'national', 'occupancy'))}</td>
        </tr>
        <tr>
          <td>Total Deficiencies</td>
          <td>{facility.total_deficiencies || 0}</td>
          <td>{getBenchmark(benchmarks, 'state', 'total_deficiencies')?.toFixed(1) || 'N/A'}</td>
          <td>{getBenchmark(benchmarks, 'national', 'total_deficiencies')?.toFixed(1) || 'N/A'}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

// Section: Benchmark Comparison
const BenchmarksSection = ({ facility, benchmarks }) => {
  const nationalOverall = getBenchmark(benchmarks, 'national', 'overall_rating');
  const nationalHprd = getBenchmark(benchmarks, 'national', 'total_nursing_hprd');
  const nationalOccupancy = getBenchmark(benchmarks, 'national', 'occupancy');

  return (
    <div className="preview-section">
      <h3 className="preview-section-title">Benchmark Comparison</h3>
      <table className="preview-table benchmark-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Facility</th>
            <th>Market</th>
            <th>State</th>
            <th>National</th>
            <th>vs Natl</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Overall Rating</td>
            <td>{facility.overall_rating || 'N/A'}</td>
            <td>{getBenchmark(benchmarks, 'market', 'overall_rating')?.toFixed(1) || 'N/A'}</td>
            <td>{getBenchmark(benchmarks, 'state', 'overall_rating')?.toFixed(1) || 'N/A'}</td>
            <td>{nationalOverall?.toFixed(1) || 'N/A'}</td>
            <td className={facility.overall_rating > (nationalOverall || 3) ? 'positive' : 'negative'}>
              {facility.overall_rating && nationalOverall
                ? (facility.overall_rating - nationalOverall > 0 ? '+' : '') + (facility.overall_rating - nationalOverall).toFixed(1)
                : 'N/A'}
            </td>
          </tr>
          <tr>
            <td>Staffing HPRD</td>
            <td>{facility.total_nursing_hprd?.toFixed(2) || 'N/A'}</td>
            <td>{getBenchmark(benchmarks, 'market', 'total_nursing_hprd')?.toFixed(2) || 'N/A'}</td>
            <td>{getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A'}</td>
            <td>{nationalHprd?.toFixed(2) || 'N/A'}</td>
            <td className={facility.total_nursing_hprd > (nationalHprd || 0) ? 'positive' : 'negative'}>
              {facility.total_nursing_hprd && nationalHprd
                ? (facility.total_nursing_hprd - nationalHprd > 0 ? '+' : '') + (facility.total_nursing_hprd - nationalHprd).toFixed(2)
                : 'N/A'}
            </td>
          </tr>
          <tr>
            <td>Occupancy</td>
            <td>{formatPercent(facility.occupancy_rate)}</td>
            <td>{formatPercent(getBenchmark(benchmarks, 'market', 'occupancy'))}</td>
            <td>{formatPercent(getBenchmark(benchmarks, 'state', 'occupancy'))}</td>
            <td>{formatPercent(nationalOccupancy)}</td>
            <td className={facility.occupancy_rate > (nationalOccupancy || 0) ? 'positive' : 'negative'}>
              {facility.occupancy_rate != null && nationalOccupancy
                ? (facility.occupancy_rate - nationalOccupancy > 0 ? '+' : '') + Math.round(facility.occupancy_rate - nationalOccupancy) + '%'
                : 'N/A'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Section: Risk Assessment
const RiskSection = ({ facility }) => {
  // Use the same risk calculations as the Risk Analysis tab
  const regulatoryRisk = calculateRegulatoryRisk(facility);
  const staffingRisk = calculateStaffingRisk(facility);
  const financialRisk = calculateFinancialRisk(facility);

  // Weighted composite (same as CompositeRiskScore)
  const compositeScore = Math.round(
    regulatoryRisk * 0.40 + staffingRisk * 0.35 + financialRisk * 0.25
  );

  const riskColor = getRiskColor(compositeScore);
  const riskLevel = getRiskLabel(compositeScore);

  return (
    <div className="preview-section">
      <h3 className="preview-section-title">
        <AlertTriangle size={18} />
        Risk Assessment
      </h3>
      <div className="preview-risk-summary">
        <div className="preview-risk-score" style={{ borderColor: riskColor }}>
          <span className="preview-risk-value" style={{ color: riskColor }}>{compositeScore}</span>
          <span className="preview-risk-label">{riskLevel}</span>
        </div>
        <div className="preview-risk-breakdown">
          <div className="preview-risk-factor">
            <span>Regulatory Risk</span>
            <span style={{ color: getRiskColor(regulatoryRisk), fontWeight: 500 }}>
              {regulatoryRisk} - {getRiskLabel(regulatoryRisk)}
            </span>
          </div>
          <div className="preview-risk-factor">
            <span>Staffing Risk</span>
            <span style={{ color: getRiskColor(staffingRisk), fontWeight: 500 }}>
              {staffingRisk} - {getRiskLabel(staffingRisk)}
            </span>
          </div>
          <div className="preview-risk-factor">
            <span>Financial Risk</span>
            <span style={{ color: getRiskColor(financialRisk), fontWeight: 500 }}>
              {financialRisk} - {getRiskLabel(financialRisk)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Section: Trends Summary
const TrendsSection = ({ facility, snapshots }) => {
  const calculateTrend = (key) => {
    if (!snapshots || snapshots.length < 2) return 'neutral';
    const recent = snapshots[0]?.[key];
    const previous = snapshots[snapshots.length - 1]?.[key];
    if (recent == null || previous == null) return 'neutral';
    if (recent > previous) return 'up';
    if (recent < previous) return 'down';
    return 'neutral';
  };

  return (
    <div className="preview-section">
      <h3 className="preview-section-title">
        <TrendingUp size={18} />
        Trends Summary ({snapshots?.length || 0} months)
      </h3>
      <table className="preview-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>6mo Ago</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Overall Rating</td>
            <td>{facility.overall_rating || 'N/A'}</td>
            <td>{snapshots?.[snapshots.length - 1]?.overall_rating || 'N/A'}</td>
            <td><TrendIndicator direction={calculateTrend('overall_rating')} /></td>
          </tr>
          <tr>
            <td>Quality Rating</td>
            <td>{facility.quality_rating || 'N/A'}</td>
            <td>{snapshots?.[snapshots.length - 1]?.qm_rating || 'N/A'}</td>
            <td><TrendIndicator direction={calculateTrend('qm_rating')} /></td>
          </tr>
          <tr>
            <td>Staffing Rating</td>
            <td>{facility.staffing_rating || 'N/A'}</td>
            <td>{snapshots?.[snapshots.length - 1]?.staffing_rating || 'N/A'}</td>
            <td><TrendIndicator direction={calculateTrend('staffing_rating')} /></td>
          </tr>
          <tr>
            <td>Deficiencies</td>
            <td>{facility.total_deficiencies || 0}</td>
            <td>{snapshots?.[snapshots.length - 1]?.cycle1_total_health_deficiencies || 'N/A'}</td>
            <td><TrendIndicator direction={calculateTrend('cycle1_total_health_deficiencies')} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Section: Deficiency History
const DeficienciesSection = ({ facility, deficiencies }) => (
  <div className="preview-section">
    <h3 className="preview-section-title">Deficiency History</h3>
    {(!deficiencies || deficiencies.length === 0) ? (
      <p className="preview-empty">No deficiency data available</p>
    ) : (
      <table className="preview-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Tag</th>
            <th>Scope/Severity</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {deficiencies.slice(0, 10).map((def, idx) => (
            <tr key={idx}>
              <td>{formatDate(def.survey_date)}</td>
              <td>{def.deficiency_tag || def.tag_number || 'N/A'}</td>
              <td>
                <span className={`severity-badge severity-${def.scope_severity?.toLowerCase() || 'unknown'}`}>
                  {def.scope_severity || 'N/A'}
                </span>
              </td>
              <td className="description-cell">{(def.deficiency_text || def.description)?.substring(0, 100) || 'N/A'}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// Section: Penalty History
const PenaltiesSection = ({ facility, penalties }) => {
  // Calculate total from penalties if not available on facility
  const totalFines = facility.total_penalties_amount ||
    penalties?.reduce((sum, p) => sum + (parseFloat(p.fine_amount) || 0), 0) || 0;

  return (
    <div className="preview-section">
      <h3 className="preview-section-title">Penalty History</h3>
      {(!penalties || penalties.length === 0) ? (
        <p className="preview-empty">No penalty data available</p>
      ) : (
        <>
          <div className="preview-penalty-summary">
            <div className="preview-penalty-stat">
              <span className="preview-penalty-value">{formatCurrency(totalFines)}</span>
              <span className="preview-penalty-label">Total Fines</span>
            </div>
            <div className="preview-penalty-stat">
              <span className="preview-penalty-value">{penalties.length}</span>
              <span className="preview-penalty-label">Total Penalties</span>
            </div>
          </div>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {penalties.slice(0, 10).map((penalty, idx) => (
                <tr key={idx}>
                  <td>{formatDate(penalty.penalty_date)}</td>
                  <td>{penalty.penalty_type || 'Fine'}</td>
                  <td>{formatCurrency(penalty.fine_amount || penalty.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

// Main Preview Component
const ReportPreview = ({ facility, benchmarks, deficiencies, penalties, selectedSections }) => {
  if (selectedSections.length === 0) {
    return (
      <div className="report-preview">
        <div className="preview-empty-state">
          <p>Select sections from the left to build your report</p>
        </div>
      </div>
    );
  }

  const snapshots = facility?.snapshots || [];

  return (
    <div className="report-preview">
      <div className="preview-header">
        <h2>Facility Report</h2>
        <span className="preview-date">Generated: {new Date().toLocaleDateString()}</span>
      </div>

      <div className="preview-content">
        {selectedSections.includes('overview') && <OverviewSection facility={facility} />}
        {selectedSections.includes('ratings') && <RatingsSection facility={facility} benchmarks={benchmarks} />}
        {selectedSections.includes('metrics') && <MetricsSection facility={facility} benchmarks={benchmarks} />}
        {selectedSections.includes('benchmarks') && <BenchmarksSection facility={facility} benchmarks={benchmarks} />}
        {selectedSections.includes('risk') && <RiskSection facility={facility} />}
        {selectedSections.includes('trends') && <TrendsSection facility={facility} snapshots={snapshots} />}
        {selectedSections.includes('deficiencies') && <DeficienciesSection facility={facility} deficiencies={deficiencies} />}
        {selectedSections.includes('penalties') && <PenaltiesSection facility={facility} penalties={penalties} />}
      </div>
    </div>
  );
};

export default ReportPreview;
