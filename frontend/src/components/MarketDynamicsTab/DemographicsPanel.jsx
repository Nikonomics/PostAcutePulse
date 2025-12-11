import React from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Home,
  GraduationCap,
} from 'lucide-react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  section: {
    marginBottom: '0.5rem',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #e5e7eb',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  metricLabel: {
    fontSize: '0.625rem',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metricValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
  },
  metricSubvalue: {
    fontSize: '0.625rem',
    color: '#6b7280',
  },
  growthBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.125rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    padding: '0.125rem 0.25rem',
    borderRadius: '0.25rem',
  },
  growthPositive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  growthNeutral: {
    backgroundColor: '#fef9c3',
    color: '#854d0e',
  },
  noData: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
};

// Format number with commas
const formatNumber = (num) => {
  if (num == null) return '-';
  return parseInt(num).toLocaleString();
};

// Format currency
const formatCurrency = (num) => {
  if (num == null) return '-';
  return `$${parseInt(num).toLocaleString()}`;
};

// Format percentage
const formatPercent = (num) => {
  if (num == null) return '-';
  return `${parseFloat(num).toFixed(1)}%`;
};

const DemographicsPanel = ({ demographics }) => {
  if (!demographics) {
    return <div style={styles.noData}>No demographics data available</div>;
  }

  const { population, projections, economics, education, marketName, cbsaCode, countyCount, marketType } = demographics;

  return (
    <div style={styles.container}>
      {/* Market Name Header */}
      {marketName && (
        <div style={{
          padding: '0.5rem 0.75rem',
          marginBottom: '0.5rem',
          backgroundColor: marketType === 'metro' ? '#eff6ff' : marketType === 'micro' ? '#f0fdf4' : '#fef3c7',
          borderRadius: '0.375rem',
          borderLeft: `3px solid ${marketType === 'metro' ? '#3b82f6' : marketType === 'micro' ? '#22c55e' : '#f59e0b'}`,
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            {marketName}
          </div>
          <div style={{ fontSize: '0.625rem', color: '#6b7280', marginTop: '0.125rem' }}>
            {marketType === 'metro' ? 'Metropolitan' : marketType === 'micro' ? 'Micropolitan' : 'Rural'} Market
            {countyCount > 1 ? ` • ${countyCount} counties` : ''}
            {cbsaCode ? ` • CBSA ${cbsaCode}` : ''}
          </div>
        </div>
      )}

      {/* Population Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Users size={14} />
          Population
        </div>
        <div style={styles.grid}>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Total</span>
            <span style={styles.metricValue}>{formatNumber(population?.total)}</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Age 65+</span>
            <span style={styles.metricValue}>{formatNumber(population?.age65Plus)}</span>
            {population?.percent65Plus && (
              <span style={styles.metricSubvalue}>
                ({formatPercent(population.percent65Plus)} of total)
              </span>
            )}
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Age 85+</span>
            <span style={styles.metricValue}>{formatNumber(population?.age85Plus)}</span>
            {population?.percent85Plus && (
              <span style={styles.metricSubvalue}>
                ({formatPercent(population.percent85Plus)} of total)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Projections Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <TrendingUp size={14} />
          2030 Projections
        </div>
        <div style={styles.grid}>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Age 65+ (2030)</span>
            <span style={styles.metricValue}>{formatNumber(projections?.age65Plus2030)}</span>
            {projections?.growthRate65Plus && (
              <span style={{
                ...styles.growthBadge,
                ...(parseFloat(projections.growthRate65Plus) > 0 ? styles.growthPositive : styles.growthNeutral),
              }}>
                <TrendingUp size={10} />
                {formatPercent(projections.growthRate65Plus)} CAGR
              </span>
            )}
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Age 85+ (2030)</span>
            <span style={styles.metricValue}>{formatNumber(projections?.age85Plus2030)}</span>
            {projections?.growthRate85Plus && (
              <span style={{
                ...styles.growthBadge,
                ...(parseFloat(projections.growthRate85Plus) > 0 ? styles.growthPositive : styles.growthNeutral),
              }}>
                <TrendingUp size={10} />
                {formatPercent(projections.growthRate85Plus)} CAGR
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Economics Section */}
      {economics && (economics.medianHouseholdIncome || economics.povertyRate) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <DollarSign size={14} />
            Economics
          </div>
          <div style={styles.grid}>
            {economics.medianHouseholdIncome && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Median Income</span>
                <span style={styles.metricValue}>{formatCurrency(economics.medianHouseholdIncome)}</span>
              </div>
            )}
            {economics.medianHomeValue && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Median Home Value</span>
                <span style={styles.metricValue}>{formatCurrency(economics.medianHomeValue)}</span>
              </div>
            )}
            {economics.povertyRate && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Poverty Rate</span>
                <span style={styles.metricValue}>{formatPercent(economics.povertyRate)}</span>
              </div>
            )}
            {economics.unemploymentRate && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Unemployment</span>
                <span style={styles.metricValue}>{formatPercent(economics.unemploymentRate)}</span>
              </div>
            )}
            {economics.homeownershipRate && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Homeownership</span>
                <span style={styles.metricValue}>{formatPercent(economics.homeownershipRate)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Education Section */}
      {education && (education.collegeRate || education.lessThanHsRate) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <GraduationCap size={14} />
            Education
          </div>
          <div style={styles.grid}>
            {education.collegeRate && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>College Educated</span>
                <span style={styles.metricValue}>{formatPercent(education.collegeRate)}</span>
              </div>
            )}
            {education.lessThanHsRate && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>No HS Diploma</span>
                <span style={styles.metricValue}>{formatPercent(education.lessThanHsRate)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DemographicsPanel;
