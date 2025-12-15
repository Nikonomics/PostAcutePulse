import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Award,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const styles = {
  container: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.5rem',
    padding: '1rem',
    marginTop: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  facilityName: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.25rem',
  },
  fyBadge: {
    fontSize: '0.625rem',
    fontWeight: 500,
    padding: '0.25rem 0.5rem',
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    borderRadius: '0.25rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  metric: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '0.375rem',
    padding: '0.75rem',
  },
  metricLabel: {
    fontSize: '0.625rem',
    fontWeight: 500,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  metricValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  metricSubtext: {
    fontSize: '0.625rem',
    color: '#94a3b8',
    marginTop: '0.25rem',
  },
  rankBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.625rem',
    fontWeight: 600,
  },
  topPerformer: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  midPerformer: {
    backgroundColor: '#fef9c3',
    color: '#854d0e',
  },
  lowPerformer: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  incentiveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  incentivePositive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  incentiveNegative: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  incentiveNeutral: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    color: '#64748b',
    fontSize: '0.875rem',
    gap: '0.5rem',
  },
  noData: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    color: '#94a3b8',
    textAlign: 'center',
  },
};

// Get performance tier styling
const getPerformanceTier = (percentile) => {
  if (percentile == null) return { style: styles.midPerformer, label: '-' };
  if (percentile >= 75) return { style: styles.topPerformer, label: 'Top 25%' };
  if (percentile >= 50) return { style: styles.midPerformer, label: 'Top 50%' };
  if (percentile >= 25) return { style: styles.lowPerformer, label: 'Bottom 50%' };
  return { style: styles.lowPerformer, label: 'Bottom 25%' };
};

// Get incentive styling
const getIncentiveStyle = (multiplier) => {
  if (multiplier == null) return styles.incentiveNeutral;
  if (multiplier > 1) return styles.incentivePositive;
  if (multiplier < 1) return styles.incentiveNegative;
  return styles.incentiveNeutral;
};

const VBPPerformancePanel = ({ ccn, facilityName }) => {
  const [loading, setLoading] = useState(false);
  const [vbpData, setVbpData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVBPData = async () => {
      if (!ccn) return;

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE}/api/market/vbp/${ccn}`);
        if (response.data.success && response.data.data) {
          setVbpData(response.data.data);
        } else {
          setVbpData(null);
        }
      } catch (err) {
        console.warn('[VBPPanel] Failed to fetch VBP data:', err.message);
        setError(err.message);
        setVbpData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVBPData();
  }, [ccn]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Loading VBP data...
        </div>
      </div>
    );
  }

  if (!vbpData) {
    return (
      <div style={styles.container}>
        <div style={styles.noData}>
          <AlertCircle size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <div style={{ fontSize: '0.75rem' }}>No VBP performance data available</div>
          <div style={{ fontSize: '0.625rem', marginTop: '0.25rem' }}>
            Facility may not be participating in the SNF VBP program
          </div>
        </div>
      </div>
    );
  }

  const tier = getPerformanceTier(vbpData.ranking_percentile);
  const incentiveStyle = getIncentiveStyle(vbpData.incentive_multiplier);
  const incentivePercent = vbpData.incentive_multiplier
    ? ((vbpData.incentive_multiplier - 1) * 100).toFixed(2)
    : null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>
            <Award size={16} color="#4338ca" />
            Value-Based Purchasing (VBP) Performance
          </div>
          <div style={styles.facilityName}>{facilityName || ccn}</div>
        </div>
        <span style={styles.fyBadge}>FY {vbpData.fiscal_year || '-'}</span>
      </div>

      <div style={styles.grid}>
        {/* Performance Score */}
        <div style={styles.metric}>
          <div style={styles.metricLabel}>
            <Target size={10} />
            Performance Score
          </div>
          <div style={styles.metricValue}>
            {vbpData.performance_score?.toFixed(1) || '-'}
          </div>
          <div style={styles.metricSubtext}>
            out of 100 points
          </div>
        </div>

        {/* National Ranking */}
        <div style={styles.metric}>
          <div style={styles.metricLabel}>
            <BarChart size={10} />
            National Rank
          </div>
          <div style={styles.metricValue}>
            #{vbpData.national_ranking || '-'}
          </div>
          <div style={{ marginTop: '0.375rem' }}>
            <span style={{ ...styles.rankBadge, ...tier.style }}>
              {tier.label}
            </span>
          </div>
        </div>

        {/* Readmission Rate */}
        <div style={styles.metric}>
          <div style={styles.metricLabel}>
            <TrendingDown size={10} />
            30-Day Readmission
          </div>
          <div style={styles.metricValue}>
            {vbpData.baseline_readmission_rate
              ? `${(vbpData.baseline_readmission_rate * 100).toFixed(1)}%`
              : '-'}
          </div>
          <div style={styles.metricSubtext}>
            Lower is better
          </div>
        </div>

        {/* Incentive Payment */}
        <div style={styles.metric}>
          <div style={styles.metricLabel}>
            <DollarSign size={10} />
            Payment Adjustment
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            <span style={{ ...styles.incentiveBadge, ...incentiveStyle }}>
              {incentivePercent !== null && (
                incentivePercent > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />
              )}
              {incentivePercent !== null
                ? `${incentivePercent > 0 ? '+' : ''}${incentivePercent}%`
                : '-'}
            </span>
          </div>
          <div style={styles.metricSubtext}>
            Multiplier: {vbpData.incentive_multiplier?.toFixed(4) || '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VBPPerformancePanel;
