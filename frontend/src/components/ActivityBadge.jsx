/**
 * ActivityBadge Component
 * Red pill badge showing unread activity count
 */
import React from 'react';

const ActivityBadge = ({ count }) => {
  if (!count || count <= 0) return null;

  const displayCount = count > 99 ? '99+' : count;

  return (
    <span
      style={{
        backgroundColor: '#ef4444',
        color: 'white',
        fontSize: '11px',
        fontWeight: '600',
        padding: '2px 6px',
        borderRadius: '9999px',
        minWidth: '18px',
        textAlign: 'center',
        display: 'inline-block',
        lineHeight: '14px'
      }}
    >
      {displayCount}
    </span>
  );
};

export default ActivityBadge;
