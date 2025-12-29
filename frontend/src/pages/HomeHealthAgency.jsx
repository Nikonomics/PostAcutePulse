import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Star, MapPin, Phone, Calendar, Building2,
  Activity, Users, TrendingUp, TrendingDown, Minus,
  Heart, Stethoscope, AlertTriangle, Loader2, ExternalLink,
  ChevronRight, Award, DollarSign, ClipboardCheck,
  MessageSquare, ThumbsUp, UserCheck, Zap
} from 'lucide-react';
import {
  getAgencyByCCN,
  getStateBenchmark,
  getNationalBenchmark,
} from '../api/homeHealthService';
import { apiService } from '../api/apiService';

// Styles
const styles = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    minHeight: 'calc(100vh - 60px)',
  },
  header: {
    marginBottom: '1.5rem',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#6b7280',
    fontSize: '0.875rem',
    cursor: 'pointer',
    marginBottom: '1rem',
    padding: '0.5rem 0',
    border: 'none',
    backgroundColor: 'transparent',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  subtitleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  starBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  starBadgeNotRated: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
  },
  starValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#111827',
  },
  starValueNotRated: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#6b7280',
  },
  starLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  emptyStateCard: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '2rem',
    textAlign: 'center',
  },
  emptyStateIcon: {
    color: '#9ca3af',
    marginBottom: '0.75rem',
  },
  emptyStateTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.5rem',
  },
  emptyStateText: {
    fontSize: '0.8rem',
    color: '#6b7280',
    maxWidth: '300px',
    margin: '0 auto',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.5rem',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cardBody: {
    padding: '1rem',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0',
    borderBottom: '1px solid #f3f4f6',
  },
  metricLabel: {
    fontSize: '0.875rem',
    color: '#374151',
    flex: 1,
  },
  metricValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    textAlign: 'right',
  },
  metricComparison: {
    fontSize: '0.75rem',
    marginLeft: '0.5rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.125rem',
  },
  serviceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '9999px',
    marginRight: '0.5rem',
    marginBottom: '0.5rem',
  },
  serviceActive: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  serviceInactive: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
  },
  statCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
    padding: '1rem',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '3rem',
    color: '#6b7280',
  },
  error: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#dc2626',
  },
  performanceCategory: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '9999px',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
    marginTop: '1rem',
  },
  progressBar: {
    height: '0.5rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '0.25rem',
    overflow: 'hidden',
    flex: 1,
    marginRight: '0.5rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '0.25rem',
  },
  comparisonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  comparisonLabel: {
    width: '80px',
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  comparisonValue: {
    width: '50px',
    fontSize: '0.75rem',
    fontWeight: 500,
    textAlign: 'right',
  },
};

// Helper: Format percentage
const formatPct = (num) => {
  if (num === null || num === undefined || num === '') return 'N/A';
  return `${parseFloat(num).toFixed(1)}%`;
};

// Helper: Check if a value exists (not null/undefined/empty)
const hasValue = (val) => val !== null && val !== undefined && val !== '';

// Helper: Check if agency has any OASIS quality measures
const hasOasisMeasures = (agency) => {
  if (!agency) return false;
  return hasValue(agency.timely_initiation_pct) ||
         hasValue(agency.flu_shot_pct) ||
         hasValue(agency.walking_improvement_pct) ||
         hasValue(agency.bed_transfer_pct) ||
         hasValue(agency.bathing_improvement_pct) ||
         hasValue(agency.breathing_improvement_pct) ||
         hasValue(agency.medication_compliance_pct);
};

// Helper: Check if agency has any claims-based outcomes
const hasClaimsOutcomes = (agency) => {
  if (!agency) return false;
  return hasValue(agency.dtc_risk_std_rate) ||
         hasValue(agency.ppr_risk_std_rate) ||
         hasValue(agency.pph_risk_std_rate);
};

// Helper: Format number
const formatNumber = (num) => {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString();
};

// Helper: Render star rating
const StarRating = ({ rating, size = 'normal' }) => {
  if (!rating) return <span style={{ color: '#9ca3af' }}>N/A</span>;

  const starSize = size === 'large' ? 20 : 14;
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={starSize}
          fill={i < fullStars ? '#f59e0b' : (i === fullStars && hasHalf ? '#fcd34d' : 'none')}
          stroke={i < fullStars || (i === fullStars && hasHalf) ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </div>
  );
};

// Helper: Comparison indicator
const ComparisonIndicator = ({ value, benchmark, higherIsBetter = true }) => {
  if (value === null || value === undefined || benchmark === null || benchmark === undefined) {
    return null;
  }

  const diff = parseFloat(value) - parseFloat(benchmark);
  const isGood = higherIsBetter ? diff >= 0 : diff <= 0;
  const isBad = higherIsBetter ? diff < 0 : diff > 0;

  if (Math.abs(diff) < 0.1) {
    return (
      <span style={{ ...styles.metricComparison, color: '#6b7280' }}>
        <Minus size={12} />
      </span>
    );
  }

  return (
    <span style={{ ...styles.metricComparison, color: isGood ? '#22c55e' : '#ef4444' }}>
      {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(diff).toFixed(1)}
    </span>
  );
};

// Helper: Performance category badge
const PerformanceBadge = ({ category }) => {
  if (!category) return <span style={{ color: '#9ca3af' }}>N/A</span>;

  const colors = {
    'Better than National Rate': { bg: '#dcfce7', text: '#166534' },
    'Same as National Rate': { bg: '#fef3c7', text: '#92400e' },
    'Worse than National Rate': { bg: '#fef2f2', text: '#dc2626' },
    'Not Available': { bg: '#f3f4f6', text: '#6b7280' },
  };

  const shortLabel = {
    'Better than National Rate': 'Better',
    'Same as National Rate': 'Same',
    'Worse than National Rate': 'Worse',
    'Not Available': 'N/A',
  };

  const color = colors[category] || colors['Not Available'];
  const label = shortLabel[category] || category;

  return (
    <span style={{ ...styles.performanceCategory, backgroundColor: color.bg, color: color.text }}>
      {label}
    </span>
  );
};

// Helper: Ownership badge
const OwnershipBadge = ({ type }) => {
  const colors = {
    'PROPRIETARY': { bg: '#dbeafe', text: '#1e40af' },
    'NON-PROFIT': { bg: '#dcfce7', text: '#166534' },
    'GOVERNMENT': { bg: '#fef3c7', text: '#92400e' },
  };

  const color = colors[type] || { bg: '#f3f4f6', text: '#374151' };
  const label = type === 'PROPRIETARY' ? 'For-Profit' :
                type === 'NON-PROFIT' ? 'Non-Profit' :
                type === 'GOVERNMENT' ? 'Government' : type || 'Unknown';

  return (
    <span style={{
      display: 'inline-flex',
      padding: '0.25rem 0.75rem',
      fontSize: '0.75rem',
      fontWeight: 500,
      borderRadius: '9999px',
      backgroundColor: color.bg,
      color: color.text,
    }}>
      {label}
    </span>
  );
};

// Progress bar with comparison
const MetricProgressBar = ({ label, value, benchmark, nationalBenchmark, higherIsBetter = true }) => {
  const maxVal = Math.max(
    parseFloat(value) || 0,
    parseFloat(benchmark) || 0,
    parseFloat(nationalBenchmark) || 0,
    100
  );

  const getColor = (val, bench) => {
    if (!val || !bench) return '#6b7280';
    const diff = parseFloat(val) - parseFloat(bench);
    if (higherIsBetter) {
      return diff >= 0 ? '#22c55e' : diff >= -5 ? '#eab308' : '#ef4444';
    } else {
      return diff <= 0 ? '#22c55e' : diff <= 5 ? '#eab308' : '#ef4444';
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
          {formatPct(value)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={styles.progressBar}>
          <div style={{
            ...styles.progressFill,
            width: `${Math.min((parseFloat(value) || 0) / maxVal * 100, 100)}%`,
            backgroundColor: getColor(value, benchmark),
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
          State: {formatPct(benchmark)}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
          National: {formatPct(nationalBenchmark)}
        </span>
      </div>
    </div>
  );
};

function HomeHealthAgency({ ccn: propCcn, hideHeader = false }) {
  const { ccn: urlCcn } = useParams();
  // Prefer prop CCN over URL CCN (allows embedding in other pages)
  const ccn = propCcn || urlCcn;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agencyData, setAgencyData] = useState(null);
  const [vbpData, setVbpData] = useState(null);

  // Load data
  useEffect(() => {
    if (ccn) {
      loadAgencyData();
    }
  }, [ccn]);

  const loadAgencyData = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAgencyByCCN(ccn);
      setAgencyData(data);

      // Try to load VBP data
      try {
        const vbpResponse = await apiService.get(`/api/hh-market/agencies/${ccn}/vbp`);
        setVbpData(vbpResponse.data);
      } catch (err) {
        // VBP data may not exist for all agencies
        console.log('No VBP data available');
      }
    } catch (err) {
      console.error('Error loading agency:', err);
      setError(err.message || 'Failed to load agency data');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    const fromState = searchParams.get('state');
    if (fromState) {
      navigate(`/home-health?state=${fromState}`);
    } else {
      navigate('/home-health');
    }
  };

  // Extract data
  const agency = agencyData?.agency;
  const cahps = agencyData?.cahps;
  const stateBenchmark = agencyData?.stateBenchmark;
  const nationalBenchmark = agencyData?.nationalBenchmark;

  // Services offered
  const services = useMemo(() => {
    if (!agency) return [];
    return [
      { name: 'Nursing', active: agency.offers_nursing },
      { name: 'Physical Therapy', active: agency.offers_pt },
      { name: 'Occupational Therapy', active: agency.offers_ot },
      { name: 'Speech Therapy', active: agency.offers_speech },
      { name: 'Medical Social Work', active: agency.offers_social_work },
      { name: 'Home Health Aide', active: agency.offers_aide },
    ];
  }, [agency]);

  // Loading state
  if (loading) {
    return (
      <div style={hideHeader ? { ...styles.container, padding: 0, minHeight: 'auto' } : styles.container}>
        <div style={styles.loading}>
          <Loader2 size={24} className="animate-spin" style={{ marginRight: '0.5rem' }} />
          Loading agency data...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={hideHeader ? { ...styles.container, padding: 0, minHeight: 'auto' } : styles.container}>
        {!hideHeader && (
          <button style={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={16} />
            Back to Home Health
          </button>
        )}
        <div style={styles.error}>
          <AlertTriangle size={20} />
          {error}
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div style={hideHeader ? { ...styles.container, padding: 0, minHeight: 'auto' } : styles.container}>
        {!hideHeader && (
          <button style={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={16} />
            Back to Home Health
          </button>
        )}
        <div style={styles.error}>
          <AlertTriangle size={20} />
          Agency not found
        </div>
      </div>
    );
  }

  return (
    <div style={hideHeader ? { ...styles.container, padding: 0, minHeight: 'auto' } : styles.container}>
      {/* Header - hidden when embedded */}
      {!hideHeader && (
        <div style={styles.header}>
          <button style={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={16} />
            Back to Home Health
          </button>

          <div style={styles.headerContent}>
            <div style={styles.titleSection}>
              <h1 style={styles.title}>{agency.provider_name}</h1>
              <div style={styles.subtitle}>
                <span style={styles.subtitleItem}>
                  <MapPin size={14} />
                  {agency.city}, {agency.state} {agency.zip_code}
                </span>
                <span style={styles.subtitleItem}>
                  CCN: {agency.ccn}
                </span>
                {agency.telephone && (
                  <span style={styles.subtitleItem}>
                    <Phone size={14} />
                    {agency.telephone}
                  </span>
                )}
                <OwnershipBadge type={agency.ownership_type} />
              </div>
            </div>

            {agency.quality_star_rating ? (
              <div style={styles.starBadge}>
                <div>
                  <div style={styles.starValue}>
                    {parseFloat(agency.quality_star_rating).toFixed(1)}
                  </div>
                  <StarRating rating={agency.quality_star_rating} size="large" />
                </div>
                <div style={{ marginLeft: '0.5rem' }}>
                  <div style={styles.starLabel}>Quality</div>
                  <div style={styles.starLabel}>Rating</div>
                </div>
              </div>
            ) : (
              <div style={styles.starBadgeNotRated}>
                <Star size={24} stroke="#9ca3af" fill="none" />
                <div>
                  <div style={styles.starValueNotRated}>Not Rated</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                    Insufficient data
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Stats Row */}
      <div style={styles.grid4}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{formatPct(agency.timely_initiation_pct)}</div>
          <div style={styles.statLabel}>Timely Care Initiation</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{formatNumber(agency.episode_count)}</div>
          <div style={styles.statLabel}>Medicare Episodes</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{agency.medicare_spending_ratio || 'N/A'}</div>
          <div style={styles.statLabel}>Medicare Spending Ratio</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>
            {agency.certification_date
              ? new Date(agency.certification_date).getFullYear()
              : 'N/A'}
          </div>
          <div style={styles.statLabel}>Certified Since</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={styles.grid2}>
        {/* Left Column */}
        <div>
          {/* Services Offered */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <Stethoscope size={16} />
                Services Offered
              </span>
            </div>
            <div style={styles.cardBody}>
              {services.map((service) => (
                <span
                  key={service.name}
                  style={{
                    ...styles.serviceBadge,
                    ...(service.active ? styles.serviceActive : styles.serviceInactive),
                  }}
                >
                  {service.active ? '✓' : '✗'} {service.name}
                </span>
              ))}
            </div>
          </div>

          {/* OASIS Quality Measures */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <Activity size={16} />
                OASIS Quality Measures
              </span>
            </div>
            <div style={styles.cardBody}>
              {hasOasisMeasures(agency) ? (
                <>
                  <MetricProgressBar
                    label="Timely Initiation of Care"
                    value={agency.timely_initiation_pct}
                    benchmark={stateBenchmark?.timely_initiation_pct}
                    nationalBenchmark={nationalBenchmark?.timely_initiation_pct}
                  />
                  <MetricProgressBar
                    label="Flu Vaccination"
                    value={agency.flu_shot_pct}
                    benchmark={stateBenchmark?.flu_shot_pct}
                    nationalBenchmark={nationalBenchmark?.flu_shot_pct}
                  />
                  <MetricProgressBar
                    label="Walking/Locomotion Improvement"
                    value={agency.walking_improvement_pct}
                    benchmark={stateBenchmark?.walking_improvement_pct}
                    nationalBenchmark={nationalBenchmark?.walking_improvement_pct}
                  />
                  <MetricProgressBar
                    label="Bed Transfer Improvement"
                    value={agency.bed_transfer_pct}
                    benchmark={stateBenchmark?.bed_transfer_pct}
                    nationalBenchmark={nationalBenchmark?.bed_transfer_pct}
                  />
                  <MetricProgressBar
                    label="Bathing Improvement"
                    value={agency.bathing_improvement_pct}
                    benchmark={stateBenchmark?.bathing_improvement_pct}
                    nationalBenchmark={nationalBenchmark?.bathing_improvement_pct}
                  />
                  <MetricProgressBar
                    label="Breathing Improvement"
                    value={agency.breathing_improvement_pct}
                    benchmark={stateBenchmark?.breathing_improvement_pct}
                    nationalBenchmark={nationalBenchmark?.breathing_improvement_pct}
                  />
                  <MetricProgressBar
                    label="Medication Compliance"
                    value={agency.medication_compliance_pct}
                    benchmark={stateBenchmark?.medication_compliance_pct}
                    nationalBenchmark={nationalBenchmark?.medication_compliance_pct}
                  />
                </>
              ) : (
                <div style={styles.emptyStateCard}>
                  <Activity size={32} style={styles.emptyStateIcon} />
                  <div style={styles.emptyStateTitle}>Quality Measures Unavailable</div>
                  <div style={styles.emptyStateText}>
                    OASIS quality measure data has not been reported for this agency.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Claims-Based Outcomes */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <ClipboardCheck size={16} />
                Claims-Based Outcomes
              </span>
            </div>
            <div style={styles.cardBody}>
              {hasClaimsOutcomes(agency) ? (
                <>
                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>
                      Discharged to Community (DTC)
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        Higher is better
                      </div>
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={styles.metricValue}>{formatPct(agency.dtc_risk_std_rate)}</span>
                      <div><PerformanceBadge category={agency.dtc_performance_category} /></div>
                    </div>
                  </div>

                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>
                      Potentially Preventable Rehospitalization (PPR)
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        Lower is better
                      </div>
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={styles.metricValue}>{formatPct(agency.ppr_risk_std_rate)}</span>
                      <div><PerformanceBadge category={agency.ppr_performance_category} /></div>
                    </div>
                  </div>

                  <div style={{ ...styles.metricRow, borderBottom: 'none' }}>
                    <span style={styles.metricLabel}>
                      Potentially Preventable Hospitalization (PPH)
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        Lower is better
                      </div>
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={styles.metricValue}>{formatPct(agency.pph_risk_std_rate)}</span>
                      <div><PerformanceBadge category={agency.pph_performance_category} /></div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={styles.emptyStateCard}>
                  <ClipboardCheck size={32} style={styles.emptyStateIcon} />
                  <div style={styles.emptyStateTitle}>Claims Data Unavailable</div>
                  <div style={styles.emptyStateText}>
                    Claims-based outcome measures have not been reported for this agency.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* HHCAHPS Patient Satisfaction */}
          {cahps ? (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <MessageSquare size={16} />
                  Patient Satisfaction (HHCAHPS)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    {cahps.summary_star_rating || 'N/A'}
                  </span>
                  <Star size={16} fill="#f59e0b" stroke="#f59e0b" />
                </div>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <UserCheck size={14} />
                      Care Delivered Professionally
                    </span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StarRating rating={cahps.care_of_patients_star} />
                    <span style={styles.metricValue}>{formatPct(cahps.care_of_patients_pct)}</span>
                  </div>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MessageSquare size={14} />
                      Communication
                    </span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StarRating rating={cahps.communication_star} />
                    <span style={styles.metricValue}>{formatPct(cahps.communication_pct)}</span>
                  </div>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Stethoscope size={14} />
                      Specific Care Issues
                    </span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StarRating rating={cahps.specific_care_star} />
                    <span style={styles.metricValue}>{formatPct(cahps.specific_care_pct)}</span>
                  </div>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Award size={14} />
                      Overall Rating (9-10)
                    </span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StarRating rating={cahps.overall_rating_star} />
                    <span style={styles.metricValue}>{formatPct(cahps.overall_rating_pct)}</span>
                  </div>
                </div>

                <div style={{ ...styles.metricRow, borderBottom: 'none' }}>
                  <span style={styles.metricLabel}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ThumbsUp size={14} />
                      Would Recommend Agency
                    </span>
                  </span>
                  <span style={styles.metricValue}>{formatPct(cahps.recommend_agency_pct)}</span>
                </div>

                {cahps.survey_response_count && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Based on {formatNumber(cahps.survey_response_count)} completed surveys
                      {cahps.survey_response_rate && ` (${formatPct(cahps.survey_response_rate)} response rate)`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <MessageSquare size={16} />
                  Patient Satisfaction (HHCAHPS)
                </span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.emptyStateCard}>
                  <MessageSquare size={32} style={styles.emptyStateIcon} />
                  <div style={styles.emptyStateTitle}>No Survey Data Available</div>
                  <div style={styles.emptyStateText}>
                    This agency has not reported sufficient patient survey data to CMS.
                    This is common for newer or smaller agencies.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VBP Payment Adjustment */}
          {vbpData && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <DollarSign size={16} />
                  Value-Based Purchasing (FY{vbpData.performance_year})
                </span>
              </div>
              <div style={styles.cardBody}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    PAYMENT ADJUSTMENT
                  </div>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: parseFloat(vbpData.payment_adjustment_pct) >= 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {parseFloat(vbpData.payment_adjustment_pct) >= 0 ? '+' : ''}
                    {formatPct(vbpData.payment_adjustment_pct)}
                  </div>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Total Performance Score</span>
                  <span style={styles.metricValue}>
                    {vbpData.total_performance_score
                      ? parseFloat(vbpData.total_performance_score).toFixed(2)
                      : 'N/A'}
                  </span>
                </div>

                {vbpData.oasis_score && (
                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>OASIS Measures Score</span>
                    <span style={styles.metricValue}>
                      {parseFloat(vbpData.oasis_score).toFixed(2)}
                    </span>
                  </div>
                )}

                {vbpData.claims_score && (
                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>Claims-Based Score</span>
                    <span style={styles.metricValue}>
                      {parseFloat(vbpData.claims_score).toFixed(2)}
                    </span>
                  </div>
                )}

                {vbpData.cahps_score && (
                  <div style={{ ...styles.metricRow, borderBottom: 'none' }}>
                    <span style={styles.metricLabel}>CAHPS Score</span>
                    <span style={styles.metricValue}>
                      {parseFloat(vbpData.cahps_score).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* State Comparison */}
          {stateBenchmark && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardTitle}>
                  <TrendingUp size={16} />
                  vs. {agency.state} State Average
                </span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Quality Rating</span>
                  <span style={styles.metricValue}>
                    {agency.quality_star_rating || 'N/A'}
                    <ComparisonIndicator
                      value={agency.quality_star_rating}
                      benchmark={stateBenchmark.quality_star_avg}
                      higherIsBetter={true}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: '0.25rem' }}>
                      (Avg: {parseFloat(stateBenchmark.quality_star_avg).toFixed(1)})
                    </span>
                  </span>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Timely Care</span>
                  <span style={styles.metricValue}>
                    {formatPct(agency.timely_initiation_pct)}
                    <ComparisonIndicator
                      value={agency.timely_initiation_pct}
                      benchmark={stateBenchmark.timely_initiation_pct}
                      higherIsBetter={true}
                    />
                  </span>
                </div>

                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Walking Improvement</span>
                  <span style={styles.metricValue}>
                    {formatPct(agency.walking_improvement_pct)}
                    <ComparisonIndicator
                      value={agency.walking_improvement_pct}
                      benchmark={stateBenchmark.walking_improvement_pct}
                      higherIsBetter={true}
                    />
                  </span>
                </div>

                <div style={{ ...styles.metricRow, borderBottom: 'none' }}>
                  <span style={styles.metricLabel}>Flu Vaccination</span>
                  <span style={styles.metricValue}>
                    {formatPct(agency.flu_shot_pct)}
                    <ComparisonIndicator
                      value={agency.flu_shot_pct}
                      benchmark={stateBenchmark.flu_shot_pct}
                      higherIsBetter={true}
                    />
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Contact & Location */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <Building2 size={16} />
                Contact Information
              </span>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.metricRow}>
                <span style={styles.metricLabel}>Address</span>
                <span style={{ ...styles.metricValue, textAlign: 'right' }}>
                  {agency.address}<br />
                  {agency.city}, {agency.state} {agency.zip_code}
                </span>
              </div>

              {agency.telephone && (
                <div style={styles.metricRow}>
                  <span style={styles.metricLabel}>Phone</span>
                  <span style={styles.metricValue}>
                    <a
                      href={`tel:${agency.telephone}`}
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                    >
                      {agency.telephone}
                    </a>
                  </span>
                </div>
              )}

              <div style={{ ...styles.metricRow, borderBottom: 'none' }}>
                <span style={styles.metricLabel}>Certification Date</span>
                <span style={styles.metricValue}>
                  {agency.certification_date
                    ? new Date(agency.certification_date).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Date Footer */}
      {agencyData?.dataDate && (
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>
          Data as of {new Date(agencyData.dataDate).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

export default HomeHealthAgency;
