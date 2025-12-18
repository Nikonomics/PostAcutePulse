import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

// Metrics to compare
const COMPARISON_METRICS = [
  {
    key: 'overall_rating',
    label: 'Overall Rating',
    format: 'rating',
    higherIsBetter: true,
    category: 'Ratings'
  },
  {
    key: 'health_inspection_rating',
    label: 'Health Inspection',
    format: 'rating',
    higherIsBetter: true,
    category: 'Ratings'
  },
  {
    key: 'quality_rating',
    altKey: 'qm_rating',
    label: 'Quality Measures',
    format: 'rating',
    higherIsBetter: true,
    category: 'Ratings'
  },
  {
    key: 'staffing_rating',
    label: 'Staffing',
    format: 'rating',
    higherIsBetter: true,
    category: 'Ratings'
  },
  {
    key: 'total_nursing_hprd',
    altKey: 'reported_total_nurse_hrs',
    label: 'Total Nursing HPRD',
    format: 'decimal',
    higherIsBetter: true,
    category: 'Staffing'
  },
  {
    key: 'rn_hprd',
    altKey: 'reported_rn_hrs',
    label: 'RN HPRD',
    format: 'decimal',
    higherIsBetter: true,
    category: 'Staffing'
  },
  {
    key: 'rn_turnover_rate',
    altKey: 'rn_turnover',
    label: 'RN Turnover',
    format: 'percent',
    higherIsBetter: false,
    category: 'Staffing'
  },
  {
    key: 'total_turnover_rate',
    altKey: 'total_nursing_turnover',
    label: 'Total Nursing Turnover',
    format: 'percent',
    higherIsBetter: false,
    category: 'Staffing'
  },
  {
    key: 'occupancy_rate',
    label: 'Occupancy Rate',
    format: 'percent',
    higherIsBetter: true,
    category: 'Operations'
  },
  {
    key: 'certified_beds',
    label: 'Certified Beds',
    format: 'number',
    higherIsBetter: null, // neutral
    category: 'Operations'
  },
  {
    key: 'total_deficiencies',
    altKey: 'cycle1_total_health_deficiencies',
    label: 'Total Deficiencies',
    format: 'number',
    higherIsBetter: false,
    category: 'Regulatory'
  },
  {
    key: 'total_penalties_amount',
    altKey: 'fine_total_dollars',
    label: 'Total Penalties',
    format: 'currency',
    higherIsBetter: false,
    category: 'Regulatory'
  }
];

const formatValue = (value, format) => {
  if (value == null || value === '') return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';

  switch (format) {
    case 'rating':
      return `${num.toFixed(0)}★`;
    case 'decimal':
      return num.toFixed(2);
    case 'percent':
      return `${num.toFixed(0)}%`;
    case 'number':
      return Math.round(num).toLocaleString();
    case 'currency':
      return num === 0 ? '$0' : `$${(num / 1000).toFixed(0)}K`;
    default:
      return value;
  }
};

const getValue = (facility, metric) => {
  let value = facility?.[metric.key];
  if ((value == null || value === '') && metric.altKey) {
    value = facility?.[metric.altKey];
  }
  return value;
};

const getDifference = (valueA, valueB, format, higherIsBetter) => {
  if (valueA == null || valueB == null) return null;
  const numA = parseFloat(valueA);
  const numB = parseFloat(valueB);
  if (isNaN(numA) || isNaN(numB)) return null;

  const diff = numA - numB;

  return {
    value: diff,
    formatted: format === 'percent' ? `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%` :
               format === 'decimal' ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` :
               format === 'currency' ? `${diff > 0 ? '+' : ''}$${Math.abs(diff / 1000).toFixed(0)}K` :
               `${diff > 0 ? '+' : ''}${Math.round(diff)}`,
    isBetter: higherIsBetter === null ? null :
              higherIsBetter ? diff > 0 : diff < 0,
    isWorse: higherIsBetter === null ? null :
             higherIsBetter ? diff < 0 : diff > 0
  };
};

const ComparisonTable = ({ facilityA, facilityB }) => {
  if (!facilityA || !facilityB) return null;

  const getNameA = () => facilityA.provider_name || facilityA.facility_name || 'Facility A';
  const getNameB = () => facilityB.provider_name || facilityB.facility_name || 'Facility B';

  // Group metrics by category
  const categories = [...new Set(COMPARISON_METRICS.map(m => m.category))];

  return (
    <div className="comparison-table-container">
      <table className="comparison-table">
        <thead>
          <tr>
            <th className="col-metric">Metric</th>
            <th className="col-facility">{getNameA()}</th>
            <th className="col-facility">{getNameB()}</th>
            <th className="col-diff">Difference</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(category => (
            <React.Fragment key={category}>
              <tr className="category-row">
                <td colSpan={4}>{category}</td>
              </tr>
              {COMPARISON_METRICS.filter(m => m.category === category).map(metric => {
                const valueA = getValue(facilityA, metric);
                const valueB = getValue(facilityB, metric);
                const diff = getDifference(valueA, valueB, metric.format, metric.higherIsBetter);

                return (
                  <tr key={metric.key}>
                    <td className="col-metric">{metric.label}</td>
                    <td className="col-facility">{formatValue(valueA, metric.format)}</td>
                    <td className="col-facility">{formatValue(valueB, metric.format)}</td>
                    <td className={`col-diff ${diff?.isBetter ? 'better' : ''} ${diff?.isWorse ? 'worse' : ''}`}>
                      {diff ? (
                        <>
                          {diff.isBetter && <ArrowUp size={14} />}
                          {diff.isWorse && <ArrowDown size={14} />}
                          {diff.isBetter === null && diff.value !== 0 && <Minus size={14} />}
                          <span>{diff.formatted}</span>
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;
