import React from 'react';
import { Star } from 'lucide-react';

const RATINGS = [
  { key: 'overall_rating', label: 'Overall Rating' },
  { key: 'quality_rating', label: 'Quality Rating' },
  { key: 'staffing_rating', label: 'Staffing Rating' },
  { key: 'health_inspection_rating', label: 'Health Inspection Rating' },
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

const StarRatingsCard = ({ facility }) => {
  if (!facility) return null;

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
        <span className="history-label">vs 12 months ago</span>
        <div className="history-changes">
          {RATINGS.map((rating) => (
            <div key={rating.key} className="history-change-item">
              <span className="history-change-name">{rating.label.replace(' Rating', '')}</span>
              <span className="history-change-indicator">━</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StarRatingsCard;
