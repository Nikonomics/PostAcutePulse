import React from 'react';
import { BarChart3 } from 'lucide-react';

// Metrics configuration with facility field -> benchmark field mapping
const METRICS = [
  {
    key: 'occupancy_rate',
    benchmarkKey: 'avg_occupancy',
    label: 'Occupancy Rate',
    format: 'percent',
    higherIsBetter: true
  },
  {
    key: 'overall_rating',
    benchmarkKey: 'avg_overall_rating',
    label: 'Overall Rating',
    format: 'rating',
    higherIsBetter: true
  },
  {
    key: 'total_nursing_hprd',
    altKey: 'reported_total_nurse_hrs',
    benchmarkKey: 'avg_total_nursing_hprd',
    label: 'Total HPRD',
    format: 'decimal',
    higherIsBetter: true
  },
  {
    key: 'rn_hprd',
    altKey: 'reported_rn_hrs',
    benchmarkKey: 'avg_rn_hprd',
    label: 'RN HPRD',
    format: 'decimal',
    higherIsBetter: true
  },
  {
    key: 'rn_turnover_rate',
    altKey: 'rn_turnover',
    benchmarkKey: 'avg_rn_turnover',
    label: 'RN Turnover',
    format: 'percent',
    higherIsBetter: false
  },
  {
    key: 'total_deficiencies',
    altKey: 'cycle1_total_health_deficiencies',
    benchmarkKey: 'avg_deficiencies',
    label: 'Deficiencies',
    format: 'number',
    higherIsBetter: false
  },
];

const formatValue = (value, format) => {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';

  switch (format) {
    case 'percent':
      return `${num.toFixed(0)}%`;
    case 'decimal':
      return num.toFixed(2);
    case 'number':
      return Math.round(num).toString();
    case 'rating':
      return `${num.toFixed(1)}★`;
    default:
      return value;
  }
};

const formatBenchmark = (value, format) => {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';

  switch (format) {
    case 'percent':
      return `${num.toFixed(0)}%`;
    case 'decimal':
      return num.toFixed(2);
    case 'number':
      return Math.round(num).toString();
    case 'rating':
      return num.toFixed(1);
    default:
      return value;
  }
};

const getDeltaIndicator = (facilityValue, nationalValue, higherIsBetter) => {
  if (facilityValue == null || nationalValue == null) {
    return { text: '—', className: 'delta-neutral' };
  }

  const fVal = parseFloat(facilityValue);
  const nVal = parseFloat(nationalValue);

  if (isNaN(fVal) || isNaN(nVal)) {
    return { text: '—', className: 'delta-neutral' };
  }

  const diff = fVal - nVal;
  if (Math.abs(diff) < 0.01) {
    return { text: '—', className: 'delta-neutral' };
  }

  const isBetter = higherIsBetter ? diff > 0 : diff < 0;
  const arrow = diff > 0 ? '▲' : '▼';

  return {
    text: arrow,
    className: isBetter ? 'delta-positive' : 'delta-negative',
  };
};

const KeyMetricsComparisonCard = ({ facility, comparisonMode = 'state', benchmarks }) => {
  if (!facility) return null;

  // Get facility value with fallback to alternate key
  const getFacilityValue = (metric) => {
    let value = facility[metric.key];
    if ((value == null || value === '') && metric.altKey) {
      value = facility[metric.altKey];
    }
    return value;
  };

  // Get comparison value based on selected mode
  const getComparisonValue = (metric) => {
    const benchmarkKey = metric.benchmarkKey;
    switch (comparisonMode) {
      case 'market':
        return benchmarks?.market?.[benchmarkKey];
      case 'state':
        return benchmarks?.state?.[benchmarkKey];
      case 'national':
        return benchmarks?.national?.[benchmarkKey];
      case 'chain':
        return benchmarks?.chain?.[benchmarkKey] || benchmarks?.national?.[benchmarkKey];
      case 'custom':
        return benchmarks?.custom?.[benchmarkKey] || benchmarks?.national?.[benchmarkKey];
      default:
        return benchmarks?.state?.[benchmarkKey];
    }
  };

  // Map comparisonMode to column key for highlighting
  const getActiveColumn = () => {
    switch (comparisonMode) {
      case 'market':
        return 'market';
      case 'state':
        return 'state';
      case 'national':
        return 'national';
      case 'chain':
        return 'market'; // chain uses market column for now
      case 'custom':
        return 'national'; // custom uses national column for now
      default:
        return 'state';
    }
  };

  const activeColumn = getActiveColumn();

  return (
    <div className="metrics-card key-metrics-card">
      <div className="metrics-card-header">
        <BarChart3 size={18} className="status-neutral" />
        <h4>Key Metrics</h4>
      </div>

      <div className="key-metrics-table-wrapper">
        <table className="key-metrics-table benchmarks-table">
          <thead>
            <tr>
              <th className="col-metric">Metric</th>
              <th className="col-value">Facility</th>
              <th className={`col-benchmark ${activeColumn === 'market' ? 'col-active' : ''}`}>Mkt</th>
              <th className={`col-benchmark ${activeColumn === 'state' ? 'col-active' : ''}`}>State</th>
              <th className={`col-benchmark ${activeColumn === 'national' ? 'col-active' : ''}`}>Natl</th>
              <th className="col-delta"></th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const facilityValue = getFacilityValue(metric);
              const marketValue = benchmarks?.market?.[metric.benchmarkKey];
              const stateValue = benchmarks?.state?.[metric.benchmarkKey];
              const nationalValue = benchmarks?.national?.[metric.benchmarkKey];
              const comparisonValue = getComparisonValue(metric);
              const delta = getDeltaIndicator(facilityValue, comparisonValue, metric.higherIsBetter);

              return (
                <tr key={metric.key}>
                  <td className="col-metric">{metric.label}</td>
                  <td className="col-value">{formatValue(facilityValue, metric.format)}</td>
                  <td className={`col-benchmark ${activeColumn === 'market' ? 'col-active' : ''}`}>{formatBenchmark(marketValue, metric.format)}</td>
                  <td className={`col-benchmark ${activeColumn === 'state' ? 'col-active' : ''}`}>{formatBenchmark(stateValue, metric.format)}</td>
                  <td className={`col-benchmark ${activeColumn === 'national' ? 'col-active' : ''}`}>{formatBenchmark(nationalValue, metric.format)}</td>
                  <td className={`col-delta ${delta.className}`}>{delta.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {benchmarks && (
        <div className="benchmarks-context">
          Comparing to {benchmarks.market?.facility_count?.toLocaleString() || '—'} local, {' '}
          {benchmarks.state?.facility_count?.toLocaleString() || '—'} state, {' '}
          {benchmarks.national?.facility_count?.toLocaleString() || '—'} national facilities
        </div>
      )}
    </div>
  );
};

export default KeyMetricsComparisonCard;
