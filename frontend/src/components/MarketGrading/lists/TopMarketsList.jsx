/**
 * TopMarketsList.jsx
 *
 * A compact list of top markets for sidebar/summary displays.
 * Shows ranked markets with grades and optional scores.
 *
 * Props:
 * - markets: Array<{ rank, cbsaCode, name, grade, score }> (required)
 * - onMarketClick: (cbsaCode: string) => void (required)
 * - title: string (default: "Top Markets")
 * - maxItems: number (default: 5)
 * - showScores: boolean (default: true)
 * - onViewAll: () => void (optional) - if provided, shows "View all" link
 * - className: string (optional)
 *
 * Usage:
 * <TopMarketsList
 *   markets={[
 *     { rank: 1, cbsaCode: '14260', name: 'Boise City', grade: 'C', score: 58.0 },
 *     // ...
 *   ]}
 *   onMarketClick={(code) => navigate(`/markets/${code}`)}
 *   title="Top Markets in Idaho"
 * />
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { GradeBadge } from '../core';

const TopMarketsList = ({
  markets,
  onMarketClick,
  title = 'Top Markets',
  maxItems = 5,
  showScores = true,
  onViewAll,
  className = ''
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Display only up to maxItems
  const displayedMarkets = markets.slice(0, maxItems);
  const hasMore = markets.length > maxItems;

  // Container styles
  const containerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  };

  // Header styles
  const headerStyle = {
    padding: '14px 16px',
    borderBottom: '1px solid #f3f4f6'
  };

  const titleStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
    margin: 0
  };

  // List styles
  const listStyle = {
    padding: 0,
    margin: 0,
    listStyle: 'none'
  };

  // Row styles
  const getRowStyle = (isHovered) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    cursor: 'pointer',
    backgroundColor: isHovered ? '#f9fafb' : 'transparent',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s ease'
  });

  // Rank styles
  const rankStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#9ca3af',
    width: 20,
    flexShrink: 0,
    textAlign: 'right'
  };

  // Name styles
  const nameStyle = {
    flex: 1,
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  // Score styles
  const scoreStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: '#6b7280',
    width: 36,
    textAlign: 'right',
    flexShrink: 0
  };

  // View all link styles
  const viewAllContainerStyle = {
    padding: '10px 16px',
    textAlign: 'center'
  };

  const viewAllStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: '#3b82f6',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4
  };

  const arrowStyle = {
    fontSize: 14
  };

  // Handle row click
  const handleRowClick = (cbsaCode) => {
    onMarketClick(cbsaCode);
  };

  // Handle view all click
  const handleViewAllClick = () => {
    if (onViewAll) {
      onViewAll();
    }
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h4 style={titleStyle}>{title}</h4>
      </div>

      {/* Market list */}
      <ul style={listStyle}>
        {displayedMarkets.map((market, index) => (
          <li
            key={market.cbsaCode}
            style={getRowStyle(hoveredIndex === index)}
            onClick={() => handleRowClick(market.cbsaCode)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleRowClick(market.cbsaCode);
              }
            }}
          >
            <span style={rankStyle}>{market.rank}.</span>
            <span style={nameStyle} title={market.name}>
              {market.name}
            </span>
            <GradeBadge grade={market.grade} size="sm" />
            {showScores && (
              <span style={scoreStyle}>{market.score.toFixed(1)}</span>
            )}
          </li>
        ))}
      </ul>

      {/* View all link */}
      {hasMore && onViewAll && (
        <div style={viewAllContainerStyle}>
          <button
            style={viewAllStyle}
            onClick={handleViewAllClick}
            type="button"
          >
            View all
            <span style={arrowStyle}>→</span>
          </button>
        </div>
      )}
    </div>
  );
};

TopMarketsList.propTypes = {
  /** Array of market objects */
  markets: PropTypes.arrayOf(
    PropTypes.shape({
      rank: PropTypes.number.isRequired,
      cbsaCode: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      grade: PropTypes.string.isRequired,
      score: PropTypes.number.isRequired
    })
  ).isRequired,
  /** Click handler for market rows */
  onMarketClick: PropTypes.func.isRequired,
  /** List title */
  title: PropTypes.string,
  /** Maximum items to display */
  maxItems: PropTypes.number,
  /** Whether to show score values */
  showScores: PropTypes.bool,
  /** Handler for "View all" click (enables the link) */
  onViewAll: PropTypes.func,
  /** Additional CSS class names */
  className: PropTypes.string
};

TopMarketsList.defaultProps = {
  title: 'Top Markets',
  maxItems: 5,
  showScores: true,
  onViewAll: undefined,
  className: ''
};

export default TopMarketsList;
