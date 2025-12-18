import React from 'react';

/**
 * Reusable skeleton loading components for FacilityMetrics
 */

// Base skeleton element with shimmer animation
const SkeletonElement = ({ width = '100%', height = '1rem', style = {} }) => (
  <div
    className="skeleton-element"
    style={{
      width,
      height,
      backgroundColor: '#e5e7eb',
      borderRadius: '4px',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    <div className="shimmer-overlay" />
  </div>
);

// Skeleton for a metrics card (used in SnapshotTab, RiskAnalysisTab)
export const SkeletonMetricsCard = ({ rows = 4, showHeader = true }) => (
  <div className="metrics-card skeleton-card">
    {showHeader && (
      <div className="metrics-card-header">
        <SkeletonElement width="1.25rem" height="1.25rem" />
        <SkeletonElement width="120px" height="1.25rem" style={{ marginLeft: '0.5rem' }} />
      </div>
    )}
    <div className="skeleton-card-body">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <SkeletonElement width="40%" height="0.875rem" />
          <SkeletonElement width="25%" height="0.875rem" />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for star ratings display
export const SkeletonStarRatings = () => (
  <div className="metrics-card skeleton-card star-ratings-skeleton">
    <div className="metrics-card-header">
      <SkeletonElement width="1.25rem" height="1.25rem" />
      <SkeletonElement width="100px" height="1.25rem" style={{ marginLeft: '0.5rem' }} />
    </div>
    <div className="skeleton-ratings-grid">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-rating-item">
          <SkeletonElement width="80px" height="0.75rem" />
          <SkeletonElement width="100px" height="1.5rem" style={{ marginTop: '0.5rem' }} />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for the overall health score card
export const SkeletonHealthScore = () => (
  <div className="metrics-card skeleton-card health-score-skeleton">
    <div className="metrics-card-header">
      <SkeletonElement width="1.25rem" height="1.25rem" />
      <SkeletonElement width="140px" height="1.25rem" style={{ marginLeft: '0.5rem' }} />
    </div>
    <div className="skeleton-score-display">
      <SkeletonElement width="80px" height="80px" style={{ borderRadius: '50%' }} />
    </div>
    <div className="skeleton-score-breakdown">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-breakdown-item">
          <SkeletonElement width="60px" height="0.75rem" />
          <SkeletonElement width="40px" height="1rem" style={{ marginTop: '0.25rem' }} />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for risk breakdown cards
export const SkeletonRiskCard = () => (
  <div className="risk-breakdown-card skeleton-card">
    <div className="risk-breakdown-header">
      <div className="risk-breakdown-title">
        <SkeletonElement width="1.25rem" height="1.25rem" />
        <SkeletonElement width="100px" height="1rem" style={{ marginLeft: '0.5rem' }} />
      </div>
      <SkeletonElement width="40px" height="40px" style={{ borderRadius: '8px' }} />
    </div>
    <SkeletonElement width="80px" height="0.875rem" style={{ margin: '0.5rem 0' }} />
    <div className="skeleton-table">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-table-row">
          <SkeletonElement width="30%" height="0.75rem" />
          <SkeletonElement width="15%" height="0.75rem" />
          <SkeletonElement width="12%" height="0.75rem" />
          <SkeletonElement width="12%" height="0.75rem" />
          <SkeletonElement width="12%" height="0.75rem" />
          <SkeletonElement width="8%" height="0.75rem" />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for the composite risk score
export const SkeletonCompositeRisk = () => (
  <div className="composite-risk-card skeleton-card">
    <div className="metrics-card-header">
      <SkeletonElement width="1.25rem" height="1.25rem" />
      <SkeletonElement width="160px" height="1.25rem" style={{ marginLeft: '0.5rem' }} />
    </div>
    <div className="skeleton-composite-content">
      <SkeletonElement width="120px" height="120px" style={{ borderRadius: '50%' }} />
      <div className="skeleton-composite-bars">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-bar-item">
            <SkeletonElement width="80px" height="0.75rem" />
            <SkeletonElement width="100%" height="0.5rem" style={{ marginTop: '0.25rem' }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Full page skeleton for when facility is loading
export const SkeletonFacilityMetrics = () => (
  <div className="facility-metrics-skeleton">
    {/* Row 1 */}
    <div className="skeleton-row-group">
      <SkeletonHealthScore />
      <SkeletonStarRatings />
    </div>
    {/* Row 2 */}
    <SkeletonMetricsCard rows={6} />
    {/* Row 3 */}
    <div className="skeleton-row-group">
      <SkeletonMetricsCard rows={4} />
      <SkeletonMetricsCard rows={4} />
    </div>
  </div>
);

export default SkeletonElement;
