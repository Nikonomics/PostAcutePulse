import React, { useState } from 'react';
import SourceCard from './SourceCard';

const SourceGroup = ({ groupName, sources, expandedSources, onToggleSource }) => {
  const [isGroupExpanded, setIsGroupExpanded] = useState(true);

  if (!sources || sources.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        onClick={() => setIsGroupExpanded(!isGroupExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#e9ecef',
          borderRadius: '6px',
          cursor: 'pointer',
          userSelect: 'none',
          marginBottom: '0.75rem'
        }}
      >
        <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>
          {isGroupExpanded ? '▼' : '▶'}
        </span>
        <h3 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: '600',
          color: '#212529'
        }}>
          {groupName}
        </h3>
        <span style={{
          color: '#6c757d',
          fontSize: '0.85rem',
          marginLeft: '0.25rem'
        }}>
          ({sources.length} {sources.length === 1 ? 'source' : 'sources'})
        </span>
      </div>

      {isGroupExpanded && (
        <div style={{ paddingLeft: '0.5rem' }}>
          {sources.map(source => (
            <SourceCard
              key={source.id}
              source={source}
              isExpanded={expandedSources.has(source.id)}
              onToggle={() => onToggleSource(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceGroup;
