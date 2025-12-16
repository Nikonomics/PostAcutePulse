import React from 'react';
import {
  Users,
  Star,
  Activity,
  RefreshCw,
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

const StateBenchmarkPanel = ({ benchmarks, nationalBenchmarks, marketAverages, stateCode }) => {
  if (!benchmarks && !nationalBenchmarks) {
    return (
      <div style={styles.noData}>
        <Activity size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
        <div>No benchmark data available</div>
      </div>
    );
  }

  // Get nested value from benchmarks object
  const getNestedValue = (obj, key) => {
    if (!obj) return null;
    // Handle nested paths like 'staffing.rnHours'
    const parts = key.split('.');
    let value = obj;
    for (const part of parts) {
      if (value == null) return null;
      value = value[part];
    }
    return value;
  };

  const getStateValue = (key) => getNestedValue(benchmarks, key);
  const getNationalValue = (key) => getNestedValue(nationalBenchmarks, key);

  // Staffing metrics
  const staffingMetrics = [
    {
      label: 'RN Hours/Resident/Day',
      marketKey: 'avgRnHours',
      stateKey: 'staffing.rnHours',
      decimals: 2,
      tooltip: 'rn_staffing_hours',
    },
    {
      label: 'LPN Hours/Resident/Day',
      marketKey: 'avgLpnHours',
      stateKey: 'staffing.lpnHours',
      decimals: 2,
      tooltip: 'lpn_staffing_hours',
    },
    {
      label: 'CNA Hours/Resident/Day',
      marketKey: 'avgCnaHours',
      stateKey: 'staffing.cnaHours',
      decimals: 2,
      tooltip: 'reported_cna_staffing_hours',
    },
    {
      label: 'Total Nurse Hours/Res/Day',
      marketKey: 'avgTotalNurseHours',
      stateKey: 'staffing.totalNurseHours',
      decimals: 2,
      tooltip: 'total_nurse_staffing_hours',
    },
  ];

  // Turnover metrics (lower is better)
  const turnoverMetrics = [
    {
      label: 'Total Nursing Turnover',
      marketKey: 'avgTurnover',
      stateKey: 'turnover.totalNursing',
      isPercent: true,
      lowerIsBetter: true,
      tooltip: 'total_nursing_turnover',
    },
    {
      label: 'RN Turnover',
      marketKey: 'avgRnTurnover',
      stateKey: 'turnover.rn',
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
      stateKey: 'ratings.overall',
      decimals: 1,
      tooltip: 'overall_rating',
    },
    {
      label: 'Health Inspection Rating',
      marketKey: 'avgHealthRating',
      stateKey: 'ratings.healthInspection',
      decimals: 1,
      tooltip: 'health_inspection_rating',
    },
    {
      label: 'Quality Measure Rating',
      marketKey: 'avgQualityRating',
      stateKey: 'ratings.qm',
      decimals: 1,
      tooltip: 'quality_measure_rating',
    },
    {
      label: 'Staffing Rating',
      marketKey: 'avgStaffingRating',
      stateKey: 'ratings.staffing',
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
          Staffing Benchmarks
        </div>
        <div style={styles.headerRow}>
          <span style={styles.columnHeader}>Metric</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>Market</span>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>{stateCode || 'State'}</span>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>Nat'l</span>
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
                {formatNumber(getStateValue(metric.stateKey), metric.decimals)}
              </span>
              <span style={styles.benchmarkValue}>
                {formatNumber(getNationalValue(metric.stateKey), metric.decimals)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Turnover Comparison */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <RefreshCw size={14} />
          Turnover Benchmarks
        </div>
        <div style={styles.headerRow}>
          <span style={styles.columnHeader}>Metric</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>Market</span>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>{stateCode || 'State'}</span>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>Nat'l</span>
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
                  ? formatPercent(getStateValue(metric.stateKey))
                  : formatNumber(getStateValue(metric.stateKey), metric.decimals || 1)}
              </span>
              <span style={styles.benchmarkValue}>
                {metric.isPercent
                  ? formatPercent(getNationalValue(metric.stateKey))
                  : formatNumber(getNationalValue(metric.stateKey), metric.decimals || 1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Quality Comparison */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Star size={14} />
          Quality Benchmarks
        </div>
        <div style={styles.headerRow}>
          <span style={styles.columnHeader}>Metric</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>Market</span>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>{stateCode || 'State'}</span>
            <span style={{ ...styles.columnHeader, minWidth: '45px', textAlign: 'right' }}>Nat'l</span>
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
                {formatNumber(getStateValue(metric.stateKey), metric.decimals)}
              </span>
              <span style={styles.benchmarkValue}>
                {formatNumber(getNationalValue(metric.stateKey), metric.decimals)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StateBenchmarkPanel;
