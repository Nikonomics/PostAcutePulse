import React from 'react';
import { Globe, MapPin, Building2, Users, LinkIcon } from 'lucide-react';

/**
 * Get color class based on percentile
 * Green: top 25% (percentile >= 75)
 * Yellow: middle 50% (25 <= percentile < 75)
 * Red: bottom 25% (percentile < 25)
 */
const getPercentileColor = (percentile) => {
  if (percentile === null || percentile === undefined) return 'neutral';
  if (percentile >= 75) return 'excellent';
  if (percentile >= 25) return 'average';
  return 'poor';
};

/**
 * Get icon for ranking type
 */
const getRankingIcon = (title) => {
  switch (title.toLowerCase()) {
    case 'national':
      return Globe;
    case 'state':
      return MapPin;
    case 'market':
      return Building2;
    case 'chain':
      return LinkIcon;
    default:
      return Users;
  }
};

/**
 * Format percentile for display
 */
const formatPercentile = (percentile) => {
  if (percentile === null || percentile === undefined) return null;
  // Show "top X%" for high performers
  const topPercent = 100 - percentile;
  if (topPercent <= 1) return 'Top 1%';
  if (topPercent <= 5) return `Top ${Math.round(topPercent)}%`;
  if (topPercent <= 25) return `Top ${Math.round(topPercent)}%`;
  if (topPercent <= 50) return `Top ${Math.round(topPercent)}%`;
  // For lower performers, show percentile
  return `${Math.round(percentile)}th percentile`;
};

/**
 * RankingCard component displays a single VBP ranking metric
 */
const RankingCard = ({ title, rank, total, percentile, subtitle, isChain = false }) => {
  const Icon = getRankingIcon(title);
  const colorClass = getPercentileColor(percentile);

  // Handle chain-specific empty state
  if (isChain && (rank === null || rank === undefined)) {
    return (
      <div className="ranking-card no-data">
        <div className="ranking-card-header">
          <Icon size={18} />
          <span className="ranking-title">{title}</span>
        </div>
        <div className="ranking-no-chain">
          <Users size={32} strokeWidth={1.5} />
          <p>Not part of a chain</p>
        </div>
      </div>
    );
  }

  // Handle missing data
  if (rank === null || rank === undefined || total === null || total === undefined) {
    return (
      <div className="ranking-card no-data">
        <div className="ranking-card-header">
          <Icon size={18} />
          <span className="ranking-title">{title}</span>
        </div>
        <div className="ranking-no-data">
          <p>No ranking data</p>
        </div>
      </div>
    );
  }

  const percentileText = formatPercentile(percentile);

  return (
    <div className={`ranking-card ${colorClass}`}>
      <div className="ranking-card-header">
        <Icon size={18} />
        <span className="ranking-title">{title}</span>
      </div>

      <div className="ranking-content">
        <div className="ranking-main">
          <span className="ranking-hash">#</span>
          <span className="ranking-number">{rank.toLocaleString()}</span>
        </div>
        <div className="ranking-total">
          of {total.toLocaleString()} facilities
        </div>
      </div>

      {percentileText && (
        <div className={`ranking-percentile ${colorClass}`}>
          {percentileText}
        </div>
      )}

      {subtitle && (
        <div className="ranking-subtitle">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default RankingCard;
