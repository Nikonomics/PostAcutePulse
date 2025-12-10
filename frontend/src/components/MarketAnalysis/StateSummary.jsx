import React from 'react';
import {
  Building2,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  MapPin,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  stateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    borderRadius: '0.375rem',
    backgroundColor: '#1e40af',
    color: 'white',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
  },
  cardMeta: {
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  benchmarkSection: {
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '0.5rem',
    padding: '1rem',
  },
  benchmarkTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#0369a1',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  benchmarkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  benchmarkCard: {
    backgroundColor: 'white',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    border: '1px solid #e0f2fe',
  },
  benchmarkLabel: {
    fontSize: '0.625rem',
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
  },
  benchmarkValues: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  },
  benchmarkValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#111827',
  },
  benchmarkComparison: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.125rem',
  },
  nationalLabel: {
    fontSize: '0.625rem',
    color: '#6b7280',
  },
  nationalValue: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#0369a1',
  },
  diffBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.125rem',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 600,
  },
  diffPositive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  diffNegative: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
  },
  chartContainer: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '1rem',
  },
  chartTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  ratingBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  ratingLabel: {
    width: '60px',
    fontSize: '0.75rem',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  ratingBarContainer: {
    flex: 1,
    height: '20px',
    backgroundColor: '#f3f4f6',
    borderRadius: '0.25rem',
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    borderRadius: '0.25rem',
    transition: 'width 0.3s ease',
  },
  ratingCount: {
    width: '40px',
    textAlign: 'right',
    fontSize: '0.75rem',
    color: '#6b7280',
  },
};

const RATING_COLORS = {
  5: '#059669',
  4: '#10b981',
  3: '#fbbf24',
  2: '#f97316',
  1: '#ef4444',
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString();
};

const formatCurrency = (num) => {
  if (num === null || num === undefined) return 'N/A';
  return `$${parseFloat(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPercent = (num) => {
  if (num === null || num === undefined) return 'N/A';
  return `${parseFloat(num).toFixed(1)}%`;
};

const BenchmarkComparison = ({ label, stateValue, nationalValue, unit = '', lowerIsBetter = false }) => {
  const stateNum = parseFloat(stateValue);
  const nationalNum = parseFloat(nationalValue);

  if (isNaN(stateNum) || isNaN(nationalNum)) {
    return (
      <div style={styles.benchmarkCard}>
        <div style={styles.benchmarkLabel}>{label}</div>
        <div style={styles.benchmarkValues}>
          <div style={styles.benchmarkValue}>{stateValue || 'N/A'}{unit}</div>
        </div>
      </div>
    );
  }

  const diff = stateNum - nationalNum;
  const diffPercent = ((diff / nationalNum) * 100).toFixed(1);
  const isPositive = lowerIsBetter ? diff < 0 : diff > 0;

  return (
    <div style={styles.benchmarkCard}>
      <div style={styles.benchmarkLabel}>{label}</div>
      <div style={styles.benchmarkValues}>
        <div style={styles.benchmarkValue}>{stateNum.toFixed(1)}{unit}</div>
        <div style={styles.benchmarkComparison}>
          <div style={styles.nationalLabel}>National: {nationalNum.toFixed(1)}{unit}</div>
          <div style={{
            ...styles.diffBadge,
            ...(isPositive ? styles.diffPositive : styles.diffNegative),
          }}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {diff > 0 ? '+' : ''}{diffPercent}%
          </div>
        </div>
      </div>
    </div>
  );
};

const StateSummary = ({ data, facilityType, nationalBenchmarks }) => {
  if (!data) return null;

  const isSNF = facilityType === 'SNF';

  // Prepare chart data for top counties
  const countyChartData = (data.topCounties || []).map(county => ({
    name: county.countyName,
    facilities: county.facilityCount,
    beds: isSNF ? county.totalBeds : county.totalCapacity,
  }));

  // Prepare rating distribution data for SNF
  const ratingData = isSNF && data.ratingDistribution
    ? [5, 4, 3, 2, 1].map(rating => ({
        rating,
        count: data.ratingDistribution[`star${rating}`] || 0,
      }))
    : [];

  const maxRatingCount = Math.max(...ratingData.map(d => d.count), 1);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>
          <MapPin size={20} />
          State Overview
          <span style={styles.stateBadge}>{data.stateCode}</span>
        </div>
      </div>

      {/* Supply Density Benchmarks */}
      {(data.metrics || nationalBenchmarks) && (
        <div style={styles.benchmarkSection}>
          <div style={styles.benchmarkTitle}>
            <Target size={16} />
            Supply Density (Beds per 1,000 Population)
          </div>
          <div style={styles.benchmarkGrid}>
            {isSNF ? (
              <>
                <BenchmarkComparison
                  label="Beds per 1,000 Age 65+"
                  stateValue={data.metrics?.bedsPerThousand65Plus}
                  nationalValue={nationalBenchmarks?.benchmarks?.bedsPerThousand65Plus}
                />
                <BenchmarkComparison
                  label="Beds per 1,000 Age 85+"
                  stateValue={data.metrics?.bedsPerThousand85Plus}
                  nationalValue={nationalBenchmarks?.benchmarks?.bedsPerThousand85Plus}
                />
              </>
            ) : (
              <>
                <BenchmarkComparison
                  label="Capacity per 1,000 Age 65+"
                  stateValue={data.metrics?.capacityPerThousand65Plus}
                  nationalValue={nationalBenchmarks?.benchmarks?.capacityPerThousand65Plus}
                />
                <BenchmarkComparison
                  label="Capacity per 1,000 Age 85+"
                  stateValue={data.metrics?.capacityPerThousand85Plus}
                  nationalValue={nationalBenchmarks?.benchmarks?.capacityPerThousand85Plus}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Building2 size={14} />
            Total Facilities
          </div>
          <div style={styles.cardValue}>{formatNumber(data.facilityCount)}</div>
          <div style={styles.cardMeta}>
            Across {formatNumber(data.countyCount)} counties
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Users size={14} />
            {isSNF ? 'Total Beds' : 'Total Capacity'}
          </div>
          <div style={styles.cardValue}>
            {formatNumber(isSNF ? data.beds?.total : data.totalCapacity)}
          </div>
          {isSNF && data.beds && (
            <div style={styles.cardMeta}>
              {formatNumber(data.beds.occupied)} occupied
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Users size={14} />
            Population 65+
          </div>
          <div style={styles.cardValue}>{formatNumber(data.demographics?.population65Plus)}</div>
          <div style={styles.cardMeta}>
            {data.demographics?.percent65Plus}% of total
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Users size={14} />
            Population 85+
          </div>
          <div style={styles.cardValue}>{formatNumber(data.demographics?.population85Plus)}</div>
          <div style={styles.cardMeta}>
            {data.demographics?.percent85Plus}% of total
          </div>
        </div>

        {isSNF && (
          <>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <Star size={14} />
                Avg Rating
              </div>
              <div style={styles.cardValue}>{data.avgRating || 'N/A'}</div>
              <div style={styles.cardMeta}>Out of 5 stars</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <Percent size={14} />
                Avg Occupancy
              </div>
              <div style={styles.cardValue}>{formatPercent(data.avgOccupancy)}</div>
              <div style={styles.cardMeta}>Statewide average</div>
            </div>
          </>
        )}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <TrendingUp size={14} />
            Unique Operators
          </div>
          <div style={styles.cardValue}>{formatNumber(data.uniqueOperators)}</div>
          <div style={styles.cardMeta}>Parent organizations</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <TrendingUp size={14} />
            Growth Rate 65+
          </div>
          <div style={styles.cardValue}>{data.demographics?.growthRate65Plus || 'N/A'}%</div>
          <div style={styles.cardMeta}>CAGR to 2030</div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={styles.twoColumn}>
        {/* Top Counties Chart */}
        <div style={styles.chartContainer}>
          <div style={styles.chartTitle}>
            <MapPin size={16} />
            Top Counties by Facility Count
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={countyChartData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatNumber(value),
                  name === 'facilities' ? 'Facilities' : (isSNF ? 'Beds' : 'Capacity'),
                ]}
              />
              <Bar dataKey="facilities" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rating Distribution for SNF */}
        {isSNF && data.ratingDistribution && (
          <div style={styles.chartContainer}>
            <div style={styles.chartTitle}>
              <Star size={16} />
              Rating Distribution
            </div>
            <div style={styles.ratingBars}>
              {ratingData.map(({ rating, count }) => (
                <div key={rating} style={styles.ratingRow}>
                  <div style={styles.ratingLabel}>
                    <Star size={12} style={{ color: RATING_COLORS[rating] }} />
                    {rating} star
                  </div>
                  <div style={styles.ratingBarContainer}>
                    <div
                      style={{
                        ...styles.ratingBar,
                        width: `${(count / maxRatingCount) * 100}%`,
                        backgroundColor: RATING_COLORS[rating],
                      }}
                    />
                  </div>
                  <div style={styles.ratingCount}>{formatNumber(count)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ALF: Counties by Capacity */}
        {!isSNF && (
          <div style={styles.chartContainer}>
            <div style={styles.chartTitle}>
              <Users size={16} />
              Top Counties by Capacity
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={countyChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatNumber(value),
                    name === 'facilities' ? 'Facilities' : 'Capacity',
                  ]}
                />
                <Bar dataKey="beds" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default StateSummary;
