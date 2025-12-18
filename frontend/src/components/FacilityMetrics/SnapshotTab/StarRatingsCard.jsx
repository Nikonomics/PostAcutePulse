import React, { useMemo } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const RATINGS = [
  { key: 'overall_rating', snapshotKey: 'overall_rating', label: 'Overall Rating' },
  { key: 'quality_rating', snapshotKey: 'qm_rating', label: 'Quality Rating' },
  { key: 'staffing_rating', snapshotKey: 'staffing_rating', label: 'Staffing Rating' },
  { key: 'health_inspection_rating', snapshotKey: 'health_inspection_rating', label: 'Health Inspection Rating' },
];

const renderStars = (rating) => {
  return [1, 2, 3, 4, 5].map((i) => (
    <Star
      key={i}
      size={16}
      fill={i <= rating ? '#fbbf24' : 'none'}
      stroke={i <= rating ? '#fbbf24' : '#d1d5db'}
    />
  ));
};

/**
 * Find snapshot closest to target date (approximately 12 months ago)
 */
const findHistoricalSnapshot = (snapshots, monthsAgo = 12) => {
  if (!snapshots || snapshots.length === 0) return null;

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() - monthsAgo);

  // Sort snapshots by date
  const sorted = [...snapshots]
    .filter(s => s.extract_date)
    .sort((a, b) => new Date(a.extract_date) - new Date(b.extract_date));

  if (sorted.length === 0) return null;

  // Find the snapshot closest to target date
  let closest = sorted[0];
  let closestDiff = Math.abs(new Date(sorted[0].extract_date) - targetDate);

  for (const snapshot of sorted) {
    const diff = Math.abs(new Date(snapshot.extract_date) - targetDate);
    if (diff < closestDiff) {
      closest = snapshot;
      closestDiff = diff;
    }
  }

  // Only return if it's within 3 months of target (not too stale)
  const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
  if (closestDiff > threeMonthsMs) return null;

  return closest;
};

const StarRatingsCard = ({ facility }) => {
  // Calculate historical changes
  const historicalData = useMemo(() => {
    if (!facility?.snapshots || facility.snapshots.length === 0) {
      return null;
    }

    const oldSnapshot = findHistoricalSnapshot(facility.snapshots, 12);
    if (!oldSnapshot) return null;

    const changes = {};
    for (const rating of RATINGS) {
      const currentValue = facility[rating.key];
      const oldValue = oldSnapshot[rating.snapshotKey];

      if (currentValue != null && oldValue != null) {
        const diff = currentValue - oldValue;
        changes[rating.key] = {
          diff,
          direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
        };
      } else {
        changes[rating.key] = { diff: 0, direction: 'unknown' };
      }
    }

    return {
      snapshotDate: oldSnapshot.extract_date,
      changes,
    };
  }, [facility]);

  if (!facility) return null;

  const getChangeIndicator = (ratingKey) => {
    if (!historicalData?.changes?.[ratingKey]) {
      return { icon: <Minus size={12} />, color: '#9ca3af', text: '━' };
    }

    const { diff, direction } = historicalData.changes[ratingKey];

    if (direction === 'up') {
      return {
        icon: <TrendingUp size={12} />,
        color: '#22c55e',
        text: `+${diff}`,
      };
    } else if (direction === 'down') {
      return {
        icon: <TrendingDown size={12} />,
        color: '#ef4444',
        text: `${diff}`,
      };
    } else {
      return {
        icon: <Minus size={12} />,
        color: '#9ca3af',
        text: '━',
      };
    }
  };

  // Calculate months since historical snapshot
  const getTimeLabel = () => {
    if (!historicalData?.snapshotDate) return 'vs 12 months ago';
    const snapshotDate = new Date(historicalData.snapshotDate);
    const now = new Date();
    const monthsDiff = Math.round((now - snapshotDate) / (30 * 24 * 60 * 60 * 1000));
    return `vs ${monthsDiff} months ago`;
  };

  return (
    <div className="metrics-card star-ratings-card">
      <div className="metrics-card-header">
        <Star size={18} className="status-watch" />
        <h4>Star Ratings</h4>
      </div>

      <div className="star-ratings-content">
        {RATINGS.map((rating, index) => {
          const value = facility[rating.key];
          const hasValue = value != null;

          return (
            <div
              key={rating.key}
              className={`star-rating-row ${index < RATINGS.length - 1 ? 'with-border' : ''}`}
            >
              <span className="star-rating-label">{rating.label}</span>
              <div className="star-rating-stars">{renderStars(hasValue ? value : 0)}</div>
              <span className="star-rating-value">{hasValue ? value : 'N/A'}</span>
            </div>
          );
        })}
      </div>

      <div className="star-ratings-history">
        <span className="history-label">{getTimeLabel()}</span>
        <div className="history-changes">
          {RATINGS.map((rating) => {
            const change = getChangeIndicator(rating.key);
            return (
              <div key={rating.key} className="history-change-item">
                <span className="history-change-name">{rating.label.replace(' Rating', '')}</span>
                <span
                  className="history-change-indicator"
                  style={{ color: change.color, display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  {change.icon}
                  {change.text !== '━' && <span>{change.text}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StarRatingsCard;
