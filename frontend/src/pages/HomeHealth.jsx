import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, MapPin, Star, TrendingUp, TrendingDown, Minus,
  Building2, Users, Activity, AlertTriangle, ChevronDown,
  Loader2, RefreshCw, Filter, X, Heart, Stethoscope,
  ArrowUpRight, ArrowDownRight, Phone, Calendar
} from 'lucide-react';
import {
  getHomeHealthStats,
  getHomeHealthAgencies,
  getAgencyByCCN,
  searchHomeHealthAgencies,
  getStateBenchmark,
  getNationalBenchmark,
} from '../api/homeHealthService';

// Inline styles following existing patterns
const styles = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    minHeight: 'calc(100vh - 60px)',
  },
  header: {
    marginBottom: '1.5rem',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
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
  statCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
  },
  statChange: {
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginTop: '0.25rem',
  },
  searchContainer: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: '1 1 300px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '0.875rem',
    color: '#111827',
  },
  select: {
    padding: '0.5rem 2rem 0.5rem 1rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    backgroundColor: 'white',
    fontSize: '0.875rem',
    color: '#111827',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
  },
  secondaryButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  td: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#111827',
    borderBottom: '1px solid #e5e7eb',
  },
  starRating: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '9999px',
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
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    color: '#6b7280',
  },
  clickableRow: {
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  benchmarkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f3f4f6',
  },
  benchmarkLabel: {
    fontSize: '0.875rem',
    color: '#374151',
  },
  benchmarkValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
  },
};

// US States list
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'VI', name: 'Virgin Islands' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

// Helper: Render star rating
const StarRating = ({ rating }) => {
  if (!rating) return <span style={{ color: '#9ca3af' }}>N/A</span>;

  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  return (
    <div style={styles.starRating}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < fullStars ? '#f59e0b' : (i === fullStars && hasHalf ? '#fcd34d' : 'none')}
          stroke={i < fullStars || (i === fullStars && hasHalf) ? '#f59e0b' : '#d1d5db'}
        />
      ))}
      <span style={{ marginLeft: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>
        {parseFloat(rating).toFixed(1)}
      </span>
    </div>
  );
};

// Helper: Ownership type badge
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
    <span style={{ ...styles.badge, backgroundColor: color.bg, color: color.text }}>
      {label}
    </span>
  );
};

// Helper: Format number with commas
const formatNumber = (num) => {
  if (!num && num !== 0) return 'N/A';
  return num.toLocaleString();
};

// Helper: Format percentage
const formatPct = (num) => {
  if (!num && num !== 0) return 'N/A';
  return `${parseFloat(num).toFixed(1)}%`;
};

function HomeHealth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [selectedState, setSelectedState] = useState(searchParams.get('state') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [stateBenchmark, setStateBenchmark] = useState(null);
  const [nationalBenchmark, setNationalBenchmark] = useState(null);
  const [sortBy, setSortBy] = useState('quality_star_rating');
  const [sortDir, setSortDir] = useState('DESC');

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Load agencies when state changes
  useEffect(() => {
    if (selectedState) {
      loadAgencies();
      loadStateBenchmark();
      setSearchParams({ state: selectedState });
    } else {
      setAgencies([]);
      setStateBenchmark(null);
      setSearchParams({});
    }
  }, [selectedState, sortBy, sortDir]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, nationalData] = await Promise.all([
        getHomeHealthStats(),
        getNationalBenchmark(),
      ]);

      setStats(statsData);
      setNationalBenchmark(nationalData);
    } catch (err) {
      console.error('Error loading home health data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAgencies = async () => {
    try {
      const data = await getHomeHealthAgencies({
        state: selectedState,
        limit: 100,
        sortBy,
        sortDir,
      });
      setAgencies(data.agencies || []);
    } catch (err) {
      console.error('Error loading agencies:', err);
    }
  };

  const loadStateBenchmark = async () => {
    try {
      const data = await getStateBenchmark(selectedState);
      setStateBenchmark(data);
    } catch (err) {
      console.error('Error loading state benchmark:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const data = await searchHomeHealthAgencies({
        q: searchQuery,
        state: selectedState || undefined,
        limit: 50,
      });
      setAgencies(data.results || []);
    } catch (err) {
      console.error('Error searching agencies:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAgencyClick = (ccn) => {
    navigate(`/home-health/${ccn}`);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortDir('DESC');
    }
  };

  // Get state stats
  const stateStats = useMemo(() => {
    if (!stats?.byState || !selectedState) return null;
    return stats.byState.find(s => s.state === selectedState);
  }, [stats, selectedState]);

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <Loader2 size={24} className="animate-spin" style={{ marginRight: '0.5rem' }} />
          Loading home health data...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <AlertTriangle size={20} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>
              <Heart size={24} color="#ef4444" />
              Home Health Analytics
            </h1>
            <p style={styles.subtitle}>
              CMS Home Health Compare data for {formatNumber(stats?.totalAgencies)} agencies
            </p>
          </div>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={loadData}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* National Stats */}
      <div style={styles.grid4}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Total Agencies</span>
          <span style={styles.statValue}>{formatNumber(stats?.totalAgencies)}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>National Avg Rating</span>
          <span style={styles.statValue}>
            <StarRating rating={nationalBenchmark?.quality_star_avg} />
          </span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Timely Care Initiation</span>
          <span style={styles.statValue}>{formatPct(nationalBenchmark?.timely_initiation_pct)}</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>States Covered</span>
          <span style={styles.statValue}>{stats?.byState?.length || 0}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={styles.card}>
        <div style={styles.cardBody}>
          <div style={styles.searchContainer}>
            <div style={styles.searchInput}>
              <Search size={18} color="#9ca3af" />
              <input
                type="text"
                placeholder="Search agencies by name, city, or CCN..."
                style={styles.input}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              {searchQuery && (
                <X
                  size={16}
                  color="#9ca3af"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSearchQuery('');
                    if (selectedState) loadAgencies();
                  }}
                />
              )}
            </div>

            <select
              style={styles.select}
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
            >
              <option value="">All States</option>
              {US_STATES.map(state => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>

            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleSearch}
            >
              <Search size={16} />
              Search
            </button>
          </div>
        </div>
      </div>

      {/* State Summary (when state is selected) */}
      {selectedState && stateStats && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <MapPin size={16} />
              {US_STATES.find(s => s.code === selectedState)?.name} Overview
            </span>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.grid4}>
              <div>
                <span style={styles.statLabel}>Agencies</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {formatNumber(parseInt(stateStats.agency_count))}
                </div>
              </div>
              <div>
                <span style={styles.statLabel}>Avg Quality Rating</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  <StarRating rating={stateStats.avg_rating} />
                </div>
              </div>
              <div>
                <span style={styles.statLabel}>Avg Timely Care</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {formatPct(stateStats.avg_timely_initiation)}
                </div>
              </div>
              <div>
                <span style={styles.statLabel}>% of National</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {((parseInt(stateStats.agency_count) / stats.totalAgencies) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={styles.grid2}>
        {/* Agencies Table */}
        <div style={{ ...styles.card, gridColumn: selectedState ? 'span 1' : 'span 2' }}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <Building2 size={16} />
              {selectedState
                ? `Home Health Agencies in ${US_STATES.find(s => s.code === selectedState)?.name}`
                : 'Top Rated Agencies Nationwide'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {agencies.length} agencies
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Agency</th>
                  <th style={styles.th}>Location</th>
                  <th
                    style={{ ...styles.th, cursor: 'pointer' }}
                    onClick={() => handleSort('quality_star_rating')}
                  >
                    Quality Rating
                    {sortBy === 'quality_star_rating' && (
                      sortDir === 'DESC' ? ' ▼' : ' ▲'
                    )}
                  </th>
                  <th style={styles.th}>Ownership</th>
                  <th
                    style={{ ...styles.th, cursor: 'pointer' }}
                    onClick={() => handleSort('timely_initiation_care_pct')}
                  >
                    Timely Care
                    {sortBy === 'timely_initiation_care_pct' && (
                      sortDir === 'DESC' ? ' ▼' : ' ▲'
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {agencies.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.emptyState}>
                      {selectedState
                        ? 'No agencies found. Try a different search.'
                        : 'Select a state to view agencies.'}
                    </td>
                  </tr>
                ) : (
                  agencies.map((agency) => (
                    <tr
                      key={agency.ccn}
                      style={styles.clickableRow}
                      onClick={() => handleAgencyClick(agency.ccn)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <td style={styles.td}>
                        <div style={{ fontWeight: 500 }}>{agency.provider_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          CCN: {agency.ccn}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={14} color="#6b7280" />
                          {agency.city}, {agency.state}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <StarRating rating={agency.quality_star_rating} />
                      </td>
                      <td style={styles.td}>
                        <OwnershipBadge type={agency.ownership_type} />
                      </td>
                      <td style={styles.td}>
                        {formatPct(agency.timely_initiation_care_pct)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* State Benchmarks (when state selected) */}
        {selectedState && stateBenchmark && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>
                <Activity size={16} />
                State Benchmarks
              </span>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Quality Star Avg</span>
                <span style={styles.benchmarkValue}>
                  <StarRating rating={stateBenchmark.quality_star_avg} />
                </span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Timely Care Initiation</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.timely_initiation_pct)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Flu Shot</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.flu_shot_pct)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Walking Improvement</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.walking_improvement_pct)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Bed Transfer Improvement</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.bed_transfer_pct)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Bathing Improvement</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.bathing_improvement_pct)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>Breathing Improvement</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.breathing_improvement_pct)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>DTC Rate</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.dtc_rate)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>PPR Rate</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.ppr_rate)}</span>
              </div>
              <div style={styles.benchmarkRow}>
                <span style={styles.benchmarkLabel}>PPH Rate</span>
                <span style={styles.benchmarkValue}>{formatPct(stateBenchmark.pph_rate)}</span>
              </div>

              {/* Star distribution */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  STAR DISTRIBUTION
                </div>
                {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map(stars => {
                  const key = `star_${stars.toString().replace('.', '_')}_pct`;
                  const value = stateBenchmark[key];
                  if (!value) return null;
                  return (
                    <div key={stars} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ width: '3rem', fontSize: '0.75rem' }}>{stars} ★</span>
                      <div style={{
                        flex: 1,
                        height: '0.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '0.25rem',
                        overflow: 'hidden',
                        marginRight: '0.5rem',
                      }}>
                        <div style={{
                          width: `${parseFloat(value)}%`,
                          height: '100%',
                          backgroundColor: stars >= 4 ? '#22c55e' : stars >= 3 ? '#eab308' : '#ef4444',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', width: '3rem' }}>
                        {formatPct(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top States Table (when no state selected) */}
      {!selectedState && stats?.byState && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <MapPin size={16} />
              Agencies by State
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>State</th>
                  <th style={styles.th}>Agencies</th>
                  <th style={styles.th}>Avg Quality Rating</th>
                  <th style={styles.th}>Avg Timely Care</th>
                  <th style={styles.th}>% of National</th>
                </tr>
              </thead>
              <tbody>
                {stats.byState.slice(0, 20).map((state) => (
                  <tr
                    key={state.state}
                    style={styles.clickableRow}
                    onClick={() => setSelectedState(state.state)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <td style={styles.td}>
                      <div style={{ fontWeight: 500 }}>
                        {US_STATES.find(s => s.code === state.state)?.name || state.state}
                      </div>
                    </td>
                    <td style={styles.td}>{formatNumber(parseInt(state.agency_count))}</td>
                    <td style={styles.td}>
                      <StarRating rating={state.avg_rating} />
                    </td>
                    <td style={styles.td}>{formatPct(state.avg_timely_initiation)}</td>
                    <td style={styles.td}>
                      {((parseInt(state.agency_count) / stats.totalAgencies) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeHealth;
