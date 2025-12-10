import React from 'react';
import {
  X,
  Building2,
  Users,
  Star,
  Percent,
  DollarSign,
  TrendingUp,
  Home,
  GraduationCap,
  AlertTriangle,
} from 'lucide-react';

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  clearAllButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: '#f9fafb',
  },
  th: {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top',
  },
  thMarket: {
    minWidth: '180px',
    position: 'relative',
  },
  marketHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  marketName: {
    fontWeight: 600,
    color: '#111827',
    fontSize: '0.875rem',
  },
  marketMeta: {
    fontSize: '0.625rem',
    color: '#6b7280',
    fontWeight: 400,
  },
  removeButton: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    padding: '0.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    borderRadius: '0.25rem',
  },
  td: {
    padding: '0.625rem 1rem',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '0.875rem',
  },
  categoryRow: {
    backgroundColor: '#f9fafb',
  },
  categoryLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  metricLabel: {
    color: '#6b7280',
    fontWeight: 500,
  },
  metricValue: {
    fontWeight: 600,
    color: '#111827',
  },
  valueBest: {
    color: '#059669',
    fontWeight: 700,
  },
  valueWorst: {
    color: '#dc2626',
  },
  emptyState: {
    padding: '3rem',
    textAlign: 'center',
    color: '#9ca3af',
  },
  emptyIcon: {
    opacity: 0.3,
    marginBottom: '0.5rem',
  },
  emptyText: {
    fontSize: '0.875rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.125rem 0.5rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    borderRadius: '9999px',
    marginLeft: '0.5rem',
  },
  snfBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  alfBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
};

const formatCurrency = (num) => {
  if (num === null || num === undefined) return '-';
  return `$${parseFloat(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPercent = (num) => {
  if (num === null || num === undefined) return '-';
  return `${parseFloat(num).toFixed(1)}%`;
};

// Metric definitions with formatting
// Note: data structure is { demographics: { population, projections, economics }, supply, metrics }
const METRIC_CATEGORIES = [
  {
    label: 'Demographics',
    icon: Users,
    metrics: [
      { key: 'demographics.population.total', label: 'Total Population', format: formatNumber },
      { key: 'demographics.population.age65Plus', label: 'Population 65+', format: formatNumber },
      { key: 'demographics.population.percent65Plus', label: '% Age 65+', format: formatPercent, higherIsBetter: true },
      { key: 'demographics.projections.growthRate65Plus', label: 'Growth Rate 65+', format: formatPercent, higherIsBetter: true },
    ],
  },
  {
    label: 'Supply',
    icon: Building2,
    metrics: [
      { key: 'supply.facilityCount', label: 'Facilities', format: formatNumber },
      { key: 'supply.beds.total', label: 'Total Beds', format: formatNumber, snfOnly: true },
      { key: 'supply.totalCapacity', label: 'Total Capacity', format: formatNumber, alfOnly: true },
      { key: 'supply.avgOccupancy', label: 'Avg Occupancy', format: formatPercent, higherIsBetter: true, snfOnly: true },
      { key: 'supply.avgRating', label: 'Avg Rating', format: (v) => v || '-', higherIsBetter: true, snfOnly: true },
      { key: 'supply.uniqueOperators', label: 'Unique Operators', format: formatNumber },
    ],
  },
  {
    label: 'Economics',
    icon: DollarSign,
    metrics: [
      { key: 'demographics.economics.medianHouseholdIncome', label: 'Median Income', format: formatCurrency, higherIsBetter: true },
      { key: 'demographics.economics.medianHomeValue', label: 'Median Home Value', format: formatCurrency },
      { key: 'demographics.economics.povertyRate', label: 'Poverty Rate', format: formatPercent, higherIsBetter: false },
      { key: 'demographics.economics.unemploymentRate', label: 'Unemployment', format: formatPercent, higherIsBetter: false },
    ],
  },
  {
    label: 'Market Analysis',
    icon: TrendingUp,
    metrics: [
      { key: 'metrics.bedsPerThousand65Plus', label: 'Beds/1K 65+', format: (v) => v || '-', snfOnly: true },
      { key: 'metrics.bedsPerThousand85Plus', label: 'Beds/1K 85+', format: (v) => v || '-', snfOnly: true },
      { key: 'metrics.capacityPerThousand65Plus', label: 'Capacity/1K 65+', format: (v) => v || '-', alfOnly: true },
      { key: 'metrics.capacityPerThousand85Plus', label: 'Capacity/1K 85+', format: (v) => v || '-', alfOnly: true },
      { key: 'metrics.marketCompetition', label: 'Competition Level', format: (v) => v || '-' },
      { key: 'metrics.growthOutlook', label: 'Growth Outlook', format: (v) => v || '-' },
    ],
  },
];

// Helper to get nested value from object
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const MarketComparison = ({
  markets,
  facilityType,
  onRemoveMarket,
  onClearAll,
}) => {
  if (!markets || markets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>
            <TrendingUp size={16} />
            Market Comparison
          </div>
        </div>
        <div style={styles.emptyState}>
          <Building2 size={48} style={styles.emptyIcon} />
          <div style={styles.emptyText}>
            Select markets to compare (up to 3)
          </div>
        </div>
      </div>
    );
  }

  const isSNF = facilityType === 'SNF';

  // Find best values for highlighting
  const findBestValue = (metricKey, higherIsBetter) => {
    const values = markets
      .map((m) => {
        const val = getNestedValue(m.data, metricKey);
        return val !== null && val !== undefined ? parseFloat(val) : null;
      })
      .filter((v) => v !== null && !isNaN(v));

    if (values.length === 0) return null;
    return higherIsBetter ? Math.max(...values) : Math.min(...values);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <TrendingUp size={16} />
          Market Comparison ({markets.length}/3)
        </div>
        {markets.length > 0 && (
          <button style={styles.clearAllButton} onClick={onClearAll}>
            <X size={12} />
            Clear All
          </button>
        )}
      </div>

      <table style={styles.table}>
        <thead>
          <tr style={styles.tableHeader}>
            <th style={styles.th}>Metric</th>
            {markets.map((market, index) => (
              <th key={index} style={{ ...styles.th, ...styles.thMarket }}>
                <div style={styles.marketHeader}>
                  <div style={styles.marketName}>
                    {market.county}, {market.state}
                  </div>
                  <div style={styles.marketMeta}>
                    {market.data?.supply?.facilityCount || 0} facilities
                    <span style={{
                      ...styles.badge,
                      ...(isSNF ? styles.snfBadge : styles.alfBadge),
                    }}>
                      {facilityType}
                    </span>
                  </div>
                </div>
                <button
                  style={styles.removeButton}
                  onClick={() => onRemoveMarket(index)}
                  title="Remove market"
                >
                  <X size={14} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_CATEGORIES.map((category) => {
            // Filter metrics based on facility type
            const filteredMetrics = category.metrics.filter((metric) => {
              if (metric.snfOnly && !isSNF) return false;
              if (metric.alfOnly && isSNF) return false;
              return true;
            });

            if (filteredMetrics.length === 0) return null;

            return (
              <React.Fragment key={category.label}>
                {/* Category Header Row */}
                <tr style={styles.categoryRow}>
                  <td colSpan={markets.length + 1} style={styles.td}>
                    <div style={styles.categoryLabel}>
                      <category.icon size={14} />
                      {category.label}
                    </div>
                  </td>
                </tr>

                {/* Metric Rows */}
                {filteredMetrics.map((metric) => {
                  const bestValue = metric.higherIsBetter !== undefined
                    ? findBestValue(metric.key, metric.higherIsBetter)
                    : null;

                  return (
                    <tr key={metric.key}>
                      <td style={{ ...styles.td, ...styles.metricLabel }}>
                        {metric.label}
                      </td>
                      {markets.map((market, index) => {
                        const rawValue = getNestedValue(market.data, metric.key);
                        const formattedValue = metric.format(rawValue);
                        const numericValue = rawValue !== null && rawValue !== undefined
                          ? parseFloat(rawValue)
                          : null;

                        const isBest = bestValue !== null &&
                          numericValue !== null &&
                          !isNaN(numericValue) &&
                          numericValue === bestValue &&
                          markets.length > 1;

                        return (
                          <td
                            key={index}
                            style={{
                              ...styles.td,
                              ...styles.metricValue,
                              ...(isBest ? styles.valueBest : {}),
                            }}
                          >
                            {formattedValue}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MarketComparison;
