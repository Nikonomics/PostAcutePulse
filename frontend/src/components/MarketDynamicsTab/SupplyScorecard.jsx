import React from 'react';
import {
  Building2,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
  },
  cardIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontWeight: 500,
  },
  cardValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1.2,
  },
  cardSubvalue: {
    fontSize: '0.625rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
  },
  ratingDistribution: {
    display: 'flex',
    gap: '0.25rem',
    marginTop: '0.5rem',
  },
  ratingBar: {
    flex: 1,
    height: '4px',
    borderRadius: '2px',
  },
  ratingLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.5rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
  },
  trendBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.125rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
  },
  trendUp: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  trendDown: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
  },
  trendNeutral: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  starRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
  },
};

// Icon background colors
const iconColors = {
  blue: { bg: '#dbeafe', color: '#2563eb' },
  green: { bg: '#dcfce7', color: '#16a34a' },
  yellow: { bg: '#fef9c3', color: '#ca8a04' },
  purple: { bg: '#f3e8ff', color: '#9333ea' },
  red: { bg: '#fee2e2', color: '#dc2626' },
  gray: { bg: '#f3f4f6', color: '#6b7280' },
};

// Format number with commas
const formatNumber = (num) => {
  if (num == null) return '-';
  return parseInt(num).toLocaleString();
};

// Format percentage
const formatPercent = (num) => {
  if (num == null) return '-';
  return `${parseFloat(num).toFixed(1)}%`;
};

const SupplyScorecard = ({ marketData, facilityType }) => {
  if (!marketData) return null;

  const { supply, metrics, demographics } = marketData;

  // Rating colors
  const ratingColors = {
    star5: '#22c55e',
    star4: '#84cc16',
    star3: '#eab308',
    star2: '#f97316',
    star1: '#ef4444',
  };

  // Calculate total for rating distribution
  const totalRated = supply?.ratingDistribution
    ? Object.values(supply.ratingDistribution).reduce((a, b) => a + b, 0)
    : 0;

  // SNF-specific cards
  const snfCards = [
    {
      icon: Building2,
      iconBg: iconColors.blue,
      label: 'Facilities',
      value: supply?.facilityCount || 0,
      subvalue: `${supply?.uniqueOperators || 0} unique operators`,
    },
    {
      icon: Users,
      iconBg: iconColors.green,
      label: 'Total Beds',
      value: formatNumber(supply?.beds?.total),
      subvalue: `${formatNumber(supply?.beds?.occupied)} occupied`,
    },
    {
      icon: BarChart3,
      iconBg: iconColors.yellow,
      label: 'Avg Occupancy',
      value: supply?.avgOccupancy ? `${supply.avgOccupancy}%` : '-',
      subvalue: 'County average',
    },
    {
      icon: Star,
      iconBg: iconColors.purple,
      label: 'Avg Rating',
      value: supply?.avgRating ? parseFloat(supply.avgRating).toFixed(1) : '-',
      subvalue: 'CMS 5-star scale',
      showRatingDist: true,
    },
    {
      icon: TrendingUp,
      iconBg: iconColors.blue,
      label: 'Beds per 1K 65+',
      value: metrics?.bedsPerThousand65Plus || '-',
      subvalue: 'Supply density',
    },
    {
      icon: metrics?.growthOutlook === 'Strong' ? TrendingUp : metrics?.growthOutlook === 'Slow' ? TrendingDown : Minus,
      iconBg: metrics?.growthOutlook === 'Strong' ? iconColors.green : metrics?.growthOutlook === 'Slow' ? iconColors.red : iconColors.gray,
      label: 'Growth Outlook',
      value: metrics?.growthOutlook || '-',
      subvalue: `${demographics?.projections?.growthRate65Plus || 0}% CAGR`,
      showTrend: true,
    },
  ];

  // ALF-specific cards
  const alfCards = [
    {
      icon: Building2,
      iconBg: iconColors.blue,
      label: 'Facilities',
      value: supply?.facilityCount || 0,
      subvalue: `${supply?.uniqueOperators || 0} unique operators`,
    },
    {
      icon: Users,
      iconBg: iconColors.green,
      label: 'Total Capacity',
      value: formatNumber(supply?.totalCapacity),
      subvalue: `Avg ${supply?.avgCapacity ? Math.round(supply.avgCapacity) : '-'} per facility`,
    },
    {
      icon: TrendingUp,
      iconBg: iconColors.blue,
      label: 'Capacity per 1K 65+',
      value: metrics?.capacityPerThousand65Plus || '-',
      subvalue: 'Supply density',
    },
    {
      icon: BarChart3,
      iconBg: iconColors.yellow,
      label: 'Competition Level',
      value: metrics?.marketCompetition || '-',
      subvalue: `${supply?.uniqueOperators || 0} operators`,
    },
    {
      icon: metrics?.growthOutlook === 'Strong' ? TrendingUp : metrics?.growthOutlook === 'Slow' ? TrendingDown : Minus,
      iconBg: metrics?.growthOutlook === 'Strong' ? iconColors.green : metrics?.growthOutlook === 'Slow' ? iconColors.red : iconColors.gray,
      label: 'Growth Outlook',
      value: metrics?.growthOutlook || '-',
      subvalue: `${demographics?.projections?.growthRate65Plus || 0}% CAGR`,
      showTrend: true,
    },
  ];

  const cards = facilityType === 'SNF' ? snfCards : alfCards;

  return (
    <div style={styles.container}>
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        return (
          <div key={index} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ ...styles.cardIcon, backgroundColor: card.iconBg.bg }}>
                <IconComponent size={16} color={card.iconBg.color} />
              </div>
            </div>
            <div style={styles.cardLabel}>{card.label}</div>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardSubvalue}>{card.subvalue}</div>

            {/* Rating distribution for SNF */}
            {card.showRatingDist && supply?.ratingDistribution && totalRated > 0 && (
              <>
                <div style={styles.ratingDistribution}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = supply.ratingDistribution[`star${star}`] || 0;
                    const width = (count / totalRated) * 100;
                    return (
                      <div
                        key={star}
                        style={{
                          ...styles.ratingBar,
                          backgroundColor: ratingColors[`star${star}`],
                          width: `${Math.max(width, 5)}%`,
                        }}
                        title={`${star}-star: ${count} facilities`}
                      />
                    );
                  })}
                </div>
                <div style={styles.ratingLabel}>
                  <span>5-star</span>
                  <span>1-star</span>
                </div>
              </>
            )}

            {/* Trend badge */}
            {card.showTrend && metrics?.growthOutlook && (
              <span style={{
                ...styles.trendBadge,
                ...(metrics.growthOutlook === 'Strong' ? styles.trendUp :
                    metrics.growthOutlook === 'Slow' ? styles.trendDown :
                    styles.trendNeutral),
              }}>
                {metrics.growthOutlook === 'Strong' && <TrendingUp size={10} />}
                {metrics.growthOutlook === 'Slow' && <TrendingDown size={10} />}
                {metrics.growthOutlook === 'Moderate' && <Minus size={10} />}
                {demographics?.projections?.growthRate65Plus > 0 ? '+' : ''}
                {demographics?.projections?.growthRate65Plus || 0}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SupplyScorecard;
