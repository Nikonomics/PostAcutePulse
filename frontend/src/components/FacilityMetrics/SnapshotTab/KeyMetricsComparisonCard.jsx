import React, { useState, useEffect } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { getFacilityBenchmarks } from '../../../api/facilityService';

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

const KeyMetricsComparisonCard = ({ facility }) => {
  const [benchmarks, setBenchmarks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      if (!facility?.ccn) {
        setBenchmarks(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getFacilityBenchmarks(facility.ccn);
        if (data.success) {
          setBenchmarks(data.benchmarks);
        } else {
          setError('Failed to load benchmarks');
        }
      } catch (err) {
        console.error('Failed to fetch benchmarks:', err);
        setError('Failed to load benchmarks');
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, [facility?.ccn]);

  if (!facility) return null;

  // Get facility value with fallback to alternate key
  const getFacilityValue = (metric) => {
    let value = facility[metric.key];
    if ((value == null || value === '') && metric.altKey) {
      value = facility[metric.altKey];
    }
    return value;
  };

  return (
    <div className="metrics-card key-metrics-card">
      <div className="metrics-card-header">
        <BarChart3 size={18} className="status-neutral" />
        <h4>Key Metrics</h4>
        {loading && <Loader2 size={14} className="spinning" style={{ marginLeft: 'auto' }} />}
      </div>

      <div className="key-metrics-table-wrapper">
        <table className="key-metrics-table benchmarks-table">
          <thead>
            <tr>
              <th className="col-metric">Metric</th>
              <th className="col-value">Facility</th>
              <th className="col-benchmark">Mkt</th>
              <th className="col-benchmark">State</th>
              <th className="col-benchmark">Natl</th>
              <th className="col-delta"></th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const facilityValue = getFacilityValue(metric);
              const marketValue = benchmarks?.market?.[metric.benchmarkKey];
              const stateValue = benchmarks?.state?.[metric.benchmarkKey];
              const nationalValue = benchmarks?.national?.[metric.benchmarkKey];
              const delta = getDeltaIndicator(facilityValue, nationalValue, metric.higherIsBetter);

              return (
                <tr key={metric.key}>
                  <td className="col-metric">{metric.label}</td>
                  <td className="col-value">{formatValue(facilityValue, metric.format)}</td>
                  <td className="col-benchmark">{formatBenchmark(marketValue, metric.format)}</td>
                  <td className="col-benchmark">{formatBenchmark(stateValue, metric.format)}</td>
                  <td className="col-benchmark">{formatBenchmark(nationalValue, metric.format)}</td>
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

      {error && !loading && (
        <div className="benchmarks-error">{error}</div>
      )}
    </div>
  );
};

export default KeyMetricsComparisonCard;
