import React from 'react';
import FacilityTypeBadge from './FacilityTypeBadge';
import FieldsTable from './FieldsTable';

const SourceCard = ({ source, isExpanded, onToggle }) => {
  const usedFieldsCount = source.fields?.filter(f => f.usedBySNFalyze)?.length || 0;
  const totalFieldsCount = source.fields?.length || 0;

  return (
    <div
      className="source-card"
      style={{
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        backgroundColor: 'white',
        overflow: 'hidden'
      }}
    >
      {/* Card Header - Always visible */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '1rem',
          cursor: 'pointer',
          gap: '1rem',
          backgroundColor: isExpanded ? '#f8f9fa' : 'white',
          transition: 'background-color 0.2s'
        }}
      >
        <span style={{ color: '#6c757d', fontSize: '0.85rem' }}>
          {isExpanded ? '▼' : '▶'}
        </span>

        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
            {source.name}
          </h4>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.85rem',
            color: '#6c757d',
            display: '-webkit-box',
            WebkitLineClamp: isExpanded ? 'none' : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {source.description}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FacilityTypeBadge type={source.facilityType} />
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#e9ecef',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: '#495057'
          }}>
            {source.updateFrequency}
          </span>
        </div>

        {source.sourceUrl && (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              color: '#0d6efd',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.25rem'
            }}
            title="Open source"
          >
            ↗
          </a>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          padding: '1rem 1rem 1.5rem 2.5rem',
          borderTop: '1px solid #dee2e6',
          backgroundColor: '#fafafa'
        }}>
          {/* Source Details */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem' }}>
              Source Details
            </h5>
            <dl style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '0.5rem 1rem',
              margin: 0,
              fontSize: '0.85rem'
            }}>
              {source.sourceUrl && (
                <>
                  <dt style={{ fontWeight: '500', color: '#6c757d' }}>Source URL</dt>
                  <dd style={{ margin: 0 }}>
                    <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {source.sourceUrl}
                    </a>
                  </dd>
                </>
              )}
              <dt style={{ fontWeight: '500', color: '#6c757d' }}>File Name</dt>
              <dd style={{ margin: 0 }}>{source.fileName}</dd>
              <dt style={{ fontWeight: '500', color: '#6c757d' }}>Update Frequency</dt>
              <dd style={{ margin: 0 }}>{source.updateFrequency}</dd>
              <dt style={{ fontWeight: '500', color: '#6c757d' }}>Data Lag</dt>
              <dd style={{ margin: 0 }}>{source.dataLag || 'Not specified'}</dd>
              <dt style={{ fontWeight: '500', color: '#6c757d' }}>Geographic Scope</dt>
              <dd style={{ margin: 0 }}>{source.geographicScope}</dd>
              <dt style={{ fontWeight: '500', color: '#6c757d' }}>Granularity</dt>
              <dd style={{ margin: 0 }}>{source.granularity}</dd>
              {source.historicalRange && (
                <>
                  <dt style={{ fontWeight: '500', color: '#6c757d' }}>Historical Range</dt>
                  <dd style={{ margin: 0 }}>{source.historicalRange}</dd>
                </>
              )}
            </dl>
          </div>

          {/* Used In Tabs */}
          {source.usedInTabs && source.usedInTabs.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Used In
              </h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {source.usedInTabs.map(tab => (
                  <span key={tab} style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#e7f1ff',
                    color: '#0d6efd',
                    borderRadius: '20px',
                    fontSize: '0.8rem'
                  }}>
                    {tab}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Known Limitations */}
          {source.knownLimitations && source.knownLimitations.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Known Limitations
              </h5>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#495057' }}>
                {source.knownLimitations.map((limitation, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>{limitation}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Incomplete Documentation Warning */}
          {!source.isFullyDocumented && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffecb5',
              borderRadius: '4px',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#664d03'
            }}>
              ⚠️ Field definitions incomplete - documentation in progress
            </div>
          )}

          {/* Fields Table */}
          <div>
            <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem' }}>
              Fields ({totalFieldsCount} total{totalFieldsCount > 0 && `, ${usedFieldsCount} used by SNFalyze`})
            </h5>
            <FieldsTable fields={source.fields} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceCard;
