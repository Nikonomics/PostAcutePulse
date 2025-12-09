/**
 * LastActivityCell Component
 * Displays last activity info like "Comment by John - 2h ago"
 */
import React from 'react';

/**
 * Format a timestamp as relative time (e.g., "2h ago", "1d ago")
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  // For older dates, show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Get activity type display text
 */
const getActivityTypeText = (type) => {
  switch (type) {
    case 'edited':
      return 'Edited';
    case 'commented':
      return 'Comment';
    case 'document_added':
      return 'Document';
    case 'status_changed':
      return 'Status change';
    case 'created':
      return 'Created';
    default:
      return 'Updated';
  }
};

const LastActivityCell = ({
  activityType,
  activityUser,
  activityAt,
  showFull = true
}) => {
  if (!activityAt) {
    return (
      <span style={{ color: '#9ca3af', fontSize: '13px' }}>
        No activity
      </span>
    );
  }

  const typeText = getActivityTypeText(activityType);
  const userName = activityUser?.first_name || activityUser?.email?.split('@')[0] || 'Unknown';
  const relativeTime = formatRelativeTime(activityAt);

  if (!showFull) {
    return (
      <span style={{ color: '#6b7280', fontSize: '13px' }}>
        {relativeTime}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ color: '#374151', fontSize: '13px', fontWeight: '500' }}>
        {typeText} by {userName}
      </span>
      <span style={{ color: '#9ca3af', fontSize: '12px' }}>
        {relativeTime}
      </span>
    </div>
  );
};

export default LastActivityCell;
