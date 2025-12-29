import React, { useMemo } from 'react';
import {
  Building2,
  Users,
  Star,
  MapPin,
  Briefcase,
  TrendingUp,
  Activity,
  Zap,
  Target,
  ArrowUpRight,
  Heart,
} from 'lucide-react';

// ============================================================================
// STYLES - Dark Mode State Analytics
// ============================================================================
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    backgroundColor: '#1e293b',
  },
  section: {
    padding: '0.75rem',
    borderBottom: '1px solid #334155',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '0.625rem',
  },
  sectionTitleAccent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '0.625rem',
  },

  // Proprietary Metrics Cards
  proprietaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
  },
  proprietaryCard: {
    padding: '0.625rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    borderLeft: '3px solid #f59e0b',
  },
  proprietaryValue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  proprietaryLabel: {
    fontSize: '0.5625rem',
    color: '#64748b',
    marginTop: '0.125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  proprietaryBadge: {
    fontSize: '0.5625rem',
    padding: '0.125rem 0.375rem',
    borderRadius: '9999px',
    fontWeight: 600,
    marginTop: '0.25rem',
    display: 'inline-block',
  },

  // Supply Density Cards
  densityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
  },
  densityCard: {
    padding: '0.5rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    textAlign: 'center',
  },
  densityValue: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  densityLabel: {
    fontSize: '0.5625rem',
    color: '#64748b',
    marginTop: '0.125rem',
  },

  // Rating Distribution
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.375rem',
  },
  ratingLabel: {
    width: '50px',
    fontSize: '0.6875rem',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  ratingBarContainer: {
    flex: 1,
    height: '14px',
    backgroundColor: '#0f172a',
    borderRadius: '0.25rem',
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    borderRadius: '0.25rem',
    transition: 'width 0.3s ease',
  },
  ratingCount: {
    width: '35px',
    fontSize: '0.6875rem',
    color: '#64748b',
    textAlign: 'right',
  },

  // Top Counties / Ownership
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.3rem',
  },
  listRank: {
    width: '16px',
    fontSize: '0.5625rem',
    fontWeight: 600,
    color: '#64748b',
  },
  listName: {
    flex: 1,
    fontSize: '0.6875rem',
    color: '#e2e8f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  listBarContainer: {
    width: '70px',
    height: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '0.25rem',
    overflow: 'hidden',
  },
  listBar: {
    height: '100%',
    borderRadius: '0.25rem',
    transition: 'width 0.3s ease',
  },
  listValue: {
    width: '30px',
    fontSize: '0.625rem',
    color: '#94a3b8',
    textAlign: 'right',
  },

  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    color: '#64748b',
    textAlign: 'center',
    height: '100%',
  },
};

// Rating colors
const RATING_COLORS = {
  5: '#10b981',
  4: '#22c55e',
  3: '#eab308',
  2: '#f97316',
  1: '#ef4444',
};

// ============================================================================
// COMPONENT
// ============================================================================
const StateAnalytics = ({ stateData, stateName }) => {
  // Calculate proprietary metrics
  const proprietaryMetrics = useMemo(() => {
    if (!stateData) return null;

    const summary = stateData.summary || stateData;
    const totalSnfBeds = summary.totalBeds || summary.total_beds || 0;
    const totalFacilities = summary.totalFacilities || summary.facility_count || 0;
    const avgOccupancy = summary.avgOccupancy || summary.avg_occupancy || 75;

    // Demographics from marketMetrics if available
    const pop65 = summary.population65Plus || summary.pop65 || 100000;
    const pop85 = summary.population85Plus || summary.pop85 || pop65 * 0.12;

    // For now, estimate ALF beds and agencies
    const totalAlfBeds = Math.round(totalSnfBeds * 0.4); // Estimate
    const totalAgencies = Math.round(totalFacilities * 0.3); // Estimate HHA count

    // A. Institutional Saturation Score
    const satScore = ((totalSnfBeds * 1.0) + (totalAlfBeds * 0.8)) / (pop65 / 1000);
    let satLabel = 'Balanced';
    let satColor = '#22c55e';
    if (satScore > 50) { satLabel = 'High Saturation'; satColor = '#ef4444'; }
    else if (satScore > 35) { satLabel = 'Moderate'; satColor = '#eab308'; }
    else if (satScore < 20) { satLabel = 'Underserved'; satColor = '#3b82f6'; }

    // B. Aging Velocity Index
    const velocity = (pop85 / pop65) * 100;
    let velLabel = 'Standard';
    let velColor = '#94a3b8';
    if (velocity > 15) { velLabel = 'Frail Market'; velColor = '#f59e0b'; }
    else if (velocity > 12) { velLabel = 'Aging Fast'; velColor = '#eab308'; }

    // C. Referral Intensity
    const intensity = totalAgencies / Math.max(totalFacilities, 1);
    let intLabel = 'Optimal';
    let intColor = '#22c55e';
    if (intensity > 0.6) { intLabel = 'High Competition'; intColor = '#ef4444'; }
    else if (intensity < 0.3) { intLabel = 'Opportunity'; intColor = '#3b82f6'; }

    // D. Est. Monthly Discharges
    const discharges = Math.round(totalSnfBeds * (avgOccupancy / 100) * 0.15 * 1.5);

    return {
      satScore: satScore.toFixed(1),
      satLabel,
      satColor,
      velocity: velocity.toFixed(1),
      velLabel,
      velColor,
      intensity: intensity.toFixed(2),
      intLabel,
      intColor,
      discharges: discharges.toLocaleString(),
    };
  }, [stateData]);

  if (!stateData) {
    return (
      <div style={styles.emptyState}>
        <Activity size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
        <div>Select a state to view analytics</div>
      </div>
    );
  }

  // Handle both wrapped and unwrapped data formats
  const summary = stateData.summary || stateData;
  const ratingDistribution = stateData.ratingDistribution || stateData.rating_distribution || [];
  const topCounties = stateData.topCounties || stateData.top_counties || [];
  const topOwnershipGroups = stateData.topOwnershipGroups || stateData.top_ownership_groups || [];

  // Calculate max values for bar scaling
  const maxRatingCount = Math.max(...ratingDistribution.map(r => r.count || 0), 1);
  const maxCountyCount = Math.max(...topCounties.map(c => c.facility_count || c.count || 0), 1);
  const maxOwnerCount = Math.max(...topOwnershipGroups.map(o => o.facility_count || o.count || 0), 1);

  return (
    <div style={styles.container}>
      {/* ================================================================== */}
      {/* PROPRIETARY INSIGHTS (Top Section) */}
      {/* ================================================================== */}
      {proprietaryMetrics && (
        <div style={styles.section}>
          <div style={styles.sectionTitleAccent}>
            <Zap size={12} /> Proprietary Insights
          </div>
          <div style={styles.proprietaryGrid}>
            {/* Saturation Score */}
            <div style={styles.proprietaryCard}>
              <div style={styles.proprietaryValue}>
                <Target size={14} color="#f59e0b" />
                {proprietaryMetrics.satScore}
              </div>
              <div style={styles.proprietaryLabel}>Saturation Score</div>
              <span style={{
                ...styles.proprietaryBadge,
                backgroundColor: `${proprietaryMetrics.satColor}20`,
                color: proprietaryMetrics.satColor,
              }}>
                {proprietaryMetrics.satLabel}
              </span>
            </div>

            {/* Aging Velocity */}
            <div style={styles.proprietaryCard}>
              <div style={styles.proprietaryValue}>
                <ArrowUpRight size={14} color="#f59e0b" />
                {proprietaryMetrics.velocity}%
              </div>
              <div style={styles.proprietaryLabel}>Aging Velocity</div>
              <span style={{
                ...styles.proprietaryBadge,
                backgroundColor: `${proprietaryMetrics.velColor}20`,
                color: proprietaryMetrics.velColor,
              }}>
                {proprietaryMetrics.velLabel}
              </span>
            </div>

            {/* Referral Intensity */}
            <div style={styles.proprietaryCard}>
              <div style={styles.proprietaryValue}>
                <Heart size={14} color="#f59e0b" />
                {proprietaryMetrics.intensity}
              </div>
              <div style={styles.proprietaryLabel}>Referral Intensity</div>
              <span style={{
                ...styles.proprietaryBadge,
                backgroundColor: `${proprietaryMetrics.intColor}20`,
                color: proprietaryMetrics.intColor,
              }}>
                {proprietaryMetrics.intLabel}
              </span>
            </div>

            {/* Est. Monthly Discharges */}
            <div style={styles.proprietaryCard}>
              <div style={styles.proprietaryValue}>
                <Activity size={14} color="#f59e0b" />
                {proprietaryMetrics.discharges}
              </div>
              <div style={styles.proprietaryLabel}>Est. Discharges/Mo</div>
              <span style={{
                ...styles.proprietaryBadge,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
              }}>
                Monthly Volume
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SUPPLY DENSITY */}
      {/* ================================================================== */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Building2 size={12} /> Supply Overview
        </div>
        <div style={styles.densityGrid}>
          <div style={styles.densityCard}>
            <div style={styles.densityValue}>
              {summary.totalFacilities || summary.facility_count || '--'}
            </div>
            <div style={styles.densityLabel}>Facilities</div>
          </div>
          <div style={styles.densityCard}>
            <div style={styles.densityValue}>
              {(summary.totalBeds || summary.total_beds)?.toLocaleString() || '--'}
            </div>
            <div style={styles.densityLabel}>Total Beds</div>
          </div>
          <div style={styles.densityCard}>
            <div style={styles.densityValue}>
              {summary.avgRating || summary.avg_rating || '--'}
            </div>
            <div style={styles.densityLabel}>Avg Rating</div>
          </div>
          <div style={styles.densityCard}>
            <div style={styles.densityValue}>
              {summary.bedsPerThousand65Plus || summary.beds_per_thousand || '--'}
            </div>
            <div style={styles.densityLabel}>Beds/1K 65+</div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RATING DISTRIBUTION */}
      {/* ================================================================== */}
      {ratingDistribution.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Star size={12} /> Rating Distribution
          </div>
          {[5, 4, 3, 2, 1].map(rating => {
            const data = ratingDistribution.find(r => (r.rating || r.star_rating) === rating) || { count: 0 };
            const count = data.count || data.facility_count || 0;
            const pct = (count / maxRatingCount) * 100;
            return (
              <div key={rating} style={styles.ratingRow}>
                <div style={styles.ratingLabel}>
                  <Star size={10} fill={RATING_COLORS[rating]} color={RATING_COLORS[rating]} />
                  {rating}-star
                </div>
                <div style={styles.ratingBarContainer}>
                  <div
                    style={{
                      ...styles.ratingBar,
                      width: `${pct}%`,
                      backgroundColor: RATING_COLORS[rating],
                    }}
                  />
                </div>
                <div style={styles.ratingCount}>{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================== */}
      {/* TOP COUNTIES */}
      {/* ================================================================== */}
      {topCounties.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <MapPin size={12} /> Top Counties
          </div>
          {topCounties.slice(0, 6).map((county, idx) => {
            const count = county.facility_count || county.count || 0;
            const pct = (count / maxCountyCount) * 100;
            const name = county.county || county.name || 'Unknown';
            return (
              <div key={name + idx} style={styles.listItem}>
                <div style={styles.listRank}>{idx + 1}.</div>
                <div style={styles.listName} title={name}>
                  {name}
                </div>
                <div style={styles.listBarContainer}>
                  <div
                    style={{
                      ...styles.listBar,
                      width: `${pct}%`,
                      backgroundColor: '#3b82f6',
                    }}
                  />
                </div>
                <div style={styles.listValue}>{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================== */}
      {/* TOP OPERATORS */}
      {/* ================================================================== */}
      {topOwnershipGroups.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Briefcase size={12} /> Top Operators
          </div>
          {topOwnershipGroups.slice(0, 6).map((owner, idx) => {
            const count = owner.facility_count || owner.count || 0;
            const pct = (count / maxOwnerCount) * 100;
            const name = owner.ownership_group || owner.name || 'Unknown';
            return (
              <div key={name + idx} style={styles.listItem}>
                <div style={styles.listRank}>{idx + 1}.</div>
                <div style={styles.listName} title={name}>
                  {name}
                </div>
                <div style={styles.listBarContainer}>
                  <div
                    style={{
                      ...styles.listBar,
                      width: `${pct}%`,
                      backgroundColor: '#8b5cf6',
                    }}
                  />
                </div>
                <div style={styles.listValue}>{count}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StateAnalytics;
