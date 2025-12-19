import React from 'react';
import './TabStates.css';

/**
 * Reusable skeleton loading component for facility metric tabs
 *
 * @param {'cards' | 'table' | 'chart'} variant - Layout variant
 * @param {number} count - Number of skeleton items (for cards variant)
 */
const TabSkeleton = ({ variant = 'cards', count = 4 }) => {
  const renderCards = () => (
    <div className="skeleton-cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-value" />
          <div className="skeleton-line skeleton-subtitle" />
        </div>
      ))}
    </div>
  );

  const renderTable = () => (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        <div className="skeleton-line skeleton-cell" />
        <div className="skeleton-line skeleton-cell" />
        <div className="skeleton-line skeleton-cell" />
        <div className="skeleton-line skeleton-cell" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-table-row">
          <div className="skeleton-line skeleton-cell" />
          <div className="skeleton-line skeleton-cell" />
          <div className="skeleton-line skeleton-cell" />
          <div className="skeleton-line skeleton-cell" />
        </div>
      ))}
    </div>
  );

  const renderChart = () => (
    <div className="skeleton-chart">
      <div className="skeleton-chart-area">
        <div className="skeleton-y-axis">
          <div className="skeleton-line skeleton-axis-tick" />
          <div className="skeleton-line skeleton-axis-tick" />
          <div className="skeleton-line skeleton-axis-tick" />
          <div className="skeleton-line skeleton-axis-tick" />
        </div>
        <div className="skeleton-chart-body">
          <div className="skeleton-chart-bars">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton-bar"
                style={{ height: `${30 + Math.random() * 50}%` }}
              />
            ))}
          </div>
          <div className="skeleton-x-axis">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-line skeleton-axis-label" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMixed = () => (
    <div className="skeleton-mixed">
      {/* Summary cards row */}
      <div className="skeleton-summary-row">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-summary-card">
            <div className="skeleton-line skeleton-label" />
            <div className="skeleton-line skeleton-big-value" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      {renderChart()}
    </div>
  );

  return (
    <div className="tab-skeleton">
      {variant === 'cards' && renderCards()}
      {variant === 'table' && renderTable()}
      {variant === 'chart' && renderChart()}
      {variant === 'mixed' && renderMixed()}
    </div>
  );
};

export default TabSkeleton;
