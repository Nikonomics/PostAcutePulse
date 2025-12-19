import React from 'react';

const FacilityTypeBadge = ({ type }) => {
  const badgeStyles = {
    'SNF': {
      backgroundColor: '#cfe2ff',
      color: '#084298',
      border: '1px solid #b6d4fe'
    },
    'ALF': {
      backgroundColor: '#d1e7dd',
      color: '#0f5132',
      border: '1px solid #badbcc'
    },
    'Both': {
      backgroundColor: '#e2d9f3',
      color: '#432874',
      border: '1px solid #c5b3e6'
    }
  };

  const style = badgeStyles[type] || badgeStyles['Both'];

  return (
    <span
      style={{
        ...style,
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '600',
        display: 'inline-block'
      }}
    >
      {type}
    </span>
  );
};

export default FacilityTypeBadge;
