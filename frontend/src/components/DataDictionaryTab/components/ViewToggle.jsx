import React from 'react';

const VIEW_OPTIONS = [
  { id: 'source', label: 'By Source' },
  { id: 'tab', label: 'By Tab' },
  { id: 'category', label: 'By Category' }
];

const ViewToggle = ({ currentView, onViewChange }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '500' }}>
        View:
      </span>
      <div style={{
        display: 'flex',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        {VIEW_OPTIONS.map((option, idx) => (
          <button
            key={option.id}
            onClick={() => onViewChange(option.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRight: idx < VIEW_OPTIONS.length - 1 ? '1px solid #dee2e6' : 'none',
              background: currentView === option.id ? '#0d6efd' : 'white',
              color: currentView === option.id ? 'white' : '#212529',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: currentView === option.id ? '500' : '400',
              transition: 'all 0.15s ease'
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ViewToggle;
