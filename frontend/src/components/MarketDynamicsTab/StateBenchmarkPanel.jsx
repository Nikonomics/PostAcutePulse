import React from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Star,
  Activity,
  RefreshCw,
  Building2,
  BarChart3,
} from 'lucide-react';
import DataTooltip from './DataTooltip';

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  section: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '1rem',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f3f4f6',
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  metricValues: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  metricValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    minWidth: '50px',
    textAlign: 'right',
  },
  benchmarkValue: {
    fontSize: '0.75rem',
    color: '#6b7280',
    minWidth: '60px',
    textAlign: 'right',
  },
  diffBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.125rem',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    minWidth: '50px',
    justifyContent: 'center',
  },
  positive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  negative: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },
  neutral: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #e5e7eb',
  },
  columnHeader: {
    fontSize: '0.625rem',
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  noData: {
    color: '#9ca3af',
    fontSize: '0.75rem',
    textAlign: 'center',
    padding: '1rem',
  },
};

// Helper function to format numbers
const formatNumber = (num, decimals = 1) => {
  if (num == null || isNaN(num)) return '-';
  return parseFloat(num).toFixed(decimals);
};

// Helper function to format percentage
const formatPercent = (num) => {
  if (num == null || isNaN(num)) return '-';
  return `${parseFloat(num).toFixed(0)}%`;
};

// Comparison badge component
const ComparisonBadge = ({ marketValue, stateValue, lowerIsBetter = false }) => {
  const market = parseFloat(marketValue);
  const state = parseFloat(stateValue);

  if (isNaN(market) || isNaN(state)) {
    return <span style={{ ...styles.diffBadge, ...styles.neutral }}>-</span>;
  }

  const diff = market - state;
  const diffPercent = ((diff / state) * 100).toFixed(0);
  const isPositive = lowerIsBetter ? diff < 0 : diff > 0;

  return (
    <span style={{
      ...styles.diffBadge,
      ...(Math.abs(diffPercent) < 5 ? styles.neutral : isPositive ? styles.positive : styles.negative),
    }}>
      {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {diff > 0 ? '+' : ''}{diffPercent}%
    </span>
  );
};

const StateBenchmarkPanel = ({ benchmarks, marketAverages, stateCode }) => {
  if (!benchmarks) {
    return (
      <div style={styles.noData}>
        <Activity size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
        <div>No state benchmark data available</div>
      </div>
    );
  }

  // Staffing metrics
  const staffingMetrics = [
    {
      label: 'RN Hours/Resident/Day',
      marketKey: 'avgRnHours',
      stateKey: 'rn_staffing_hours_avg',
      decimals: 2,
      tooltip: 'rn_staffing_hours',
    },
    {
      label: 'LPN Hours/Resident/Day',
      marketKey: 'avgLpnHours',
      stateKey: 'lpn_staffing_hours_avg',
      decimals: 2,
      tooltip: 'lpn_staffing_hours',
    },
    {
      label: 'CNA Hours/Resident/Day',
      marketKey: 'avgCnaHours',
      stateKey: 'reported_cna_staffing_hours_avg',
      decimals: 2,
      tooltip: 'reported_cna_staffing_hours',
    },
    {
      label: 'Total Nurse Hours/Res/Day',
      marketKey: 'avgTotalNurseHours',
      stateKey: 'total_nurse_staffing_hours_avg',
      decimals: 2,
      tooltip: 'total_nurse_staffing_hours',
    },
  ];

  // Turnover metrics (lower is better)
  const turnoverMetrics = [
    {
      label: 'Total Nursing Turnover',
      marketKey: 'avgTurnover',
      stateKey: 'total_nursing_turnover_avg',
      isPercent: true,
      lowerIsBetter: true,
      tooltip: 'total_nursing_turnover',
    },
    {
      label: 'RN Turnover',
      marketKey: 'avgRnTurnover',
      stateKey: 'rn_turnover_avg',
      isPercent: true,
      lowerIsBetter: true,
      tooltip: 'rn_turnover',
    },
  ];

  // Quality metrics
  const qualityMetrics = [
    {
      label: 'Overall Rating',
      marketKey: 'avgRating',
      stateKey: 'overall_rating_avg',
      decimals: 1,
      tooltip: 'overall_rating',
    },
    {
      label: 'Health Inspection Rating',
      marketKey: 'avgHealthRating',
      stateKey: 'health_inspection_rating_avg',
      decimals: 1,
      tooltip: 'health_inspection_rating',
    },
    {
      label: 'Quality Measure Rating',
      marketKey: 'avgQualityRating',
      stateKey: 'quality_measure_rating_avg',
      decimals: 1,
      tooltip: 'quality_measure_rating',
    },
    {
      label: 'Staffing Rating',
      marketKey: 'avgStaffingRating',
      stateKey: 'staffing_rating_avg',
      decimals: 1,
      tooltip: 'staffing_rating',
    },
  ];

  return (
    <div style={styles.container}>
      {/* Staffing Comparison */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Users size={14} />
          Staffing vs {stateCode || 'State'} Avg
        </div>
        <div style={styles.headerRow}>
          <span style={styles.columnHeader}>Metric</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'right' }}>Market</span>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'right' }}>State</span>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'center' }}>Diff</span>
          </div>
        </div>
        {staffingMetrics.map((metric, idx) => (
          <div key={idx} style={styles.metricRow}>
            <span style={styles.metricLabel}>
              {metric.tooltip ? (
                <DataTooltip fieldName={metric.tooltip} size={10}>
                  {metric.label}
                </DataTooltip>
              ) : (
                metric.label
              )}
            </span>
            <div style={styles.metricValues}>
              <span style={styles.metricValue}>
                {formatNumber(marketAverages?.[metric.marketKey], metric.decimals)}
              </span>
              <span style={styles.benchmarkValue}>
                {formatNumber(benchmarks[metric.stateKey], metric.decimals)}
              </span>
              <ComparisonBadge
                marketValue={marketAverages?.[metric.marketKey]}
                stateValue={benchmarks[metric.stateKey]}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Turnover Comparison */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <RefreshCw size={14} />
          Turnover vs {stateCode || 'State'} Avg
        </div>
        <div style={styles.headerRow}>
          <span style={styles.columnHeader}>Metric</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'right' }}>Market</span>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'right' }}>State</span>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'center' }}>Diff</span>
          </div>
        </div>
        {turnoverMetrics.map((metric, idx) => (
          <div key={idx} style={styles.metricRow}>
            <span style={styles.metricLabel}>
              {metric.tooltip ? (
                <DataTooltip fieldName={metric.tooltip} size={10}>
                  {metric.label}
                </DataTooltip>
              ) : (
                metric.label
              )}
            </span>
            <div style={styles.metricValues}>
              <span style={styles.metricValue}>
                {metric.isPercent
                  ? formatPercent(marketAverages?.[metric.marketKey])
                  : formatNumber(marketAverages?.[metric.marketKey], metric.decimals || 1)}
              </span>
              <span style={styles.benchmarkValue}>
                {metric.isPercent
                  ? formatPercent(benchmarks[metric.stateKey])
                  : formatNumber(benchmarks[metric.stateKey], metric.decimals || 1)}
              </span>
              <ComparisonBadge
                marketValue={marketAverages?.[metric.marketKey]}
                stateValue={benchmarks[metric.stateKey]}
                lowerIsBetter={metric.lowerIsBetter}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Quality Comparison */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Star size={14} />
          Quality vs {stateCode || 'State'} Avg
        </div>
        <div style={styles.headerRow}>
          <span style={styles.columnHeader}>Metric</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'right' }}>Market</span>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'right' }}>State</span>
            <span style={{ ...styles.columnHeader, minWidth: '50px', textAlign: 'center' }}>Diff</span>
          </div>
        </div>
        {qualityMetrics.map((metric, idx) => (
          <div key={idx} style={styles.metricRow}>
            <span style={styles.metricLabel}>
              {metric.tooltip ? (
                <DataTooltip fieldName={metric.tooltip} size={10}>
                  {metric.label}
                </DataTooltip>
              ) : (
                metric.label
              )}
            </span>
            <div style={styles.metricValues}>
              <span style={styles.metricValue}>
                {formatNumber(marketAverages?.[metric.marketKey], metric.decimals)}
              </span>
              <span style={styles.benchmarkValue}>
                {formatNumber(benchmarks[metric.stateKey], metric.decimals)}
              </span>
              <ComparisonBadge
                marketValue={marketAverages?.[metric.marketKey]}
                stateValue={benchmarks[metric.stateKey]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StateBenchmarkPanel;
