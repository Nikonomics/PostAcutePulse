import React, { useState } from 'react';

const FieldsTable = ({ fields }) => {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 10;

  if (!fields || fields.length === 0) {
    return (
      <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
        No field definitions available yet.
      </p>
    );
  }

  const displayFields = showAll ? fields : fields.slice(0, INITIAL_SHOW);

  return (
    <div className="fields-table-container">
      <table className="fields-table">
        <thead>
          <tr>
            <th style={{ width: '25%' }}>Field Name</th>
            <th style={{ width: '10%' }}>Type</th>
            <th style={{ width: '55%' }}>Description</th>
            <th style={{ width: '10%', textAlign: 'center' }}>Used</th>
          </tr>
        </thead>
        <tbody>
          {displayFields.map((field, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: field.usedBySNFalyze ? '#f8fff8' : 'transparent',
                opacity: field.usedBySNFalyze ? 1 : 0.7
              }}
            >
              <td className="field-name">
                <code style={{ fontSize: '0.85rem' }}>
                  {field.cmsColumnHeader || field.fieldName}
                </code>
                {field.cmsMeasureCode && (
                  <span style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    color: '#6c757d',
                    marginTop: '2px'
                  }}>
                    {field.cmsMeasureCode}
                  </span>
                )}
              </td>
              <td style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                {field.dataType}
              </td>
              <td style={{ fontSize: '0.85rem' }}>
                {field.hasDefinition !== false ? (
                  field.description
                ) : (
                  <span style={{
                    color: '#856404',
                    backgroundColor: '#fff3cd',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.8rem'
                  }}>
                    Definition needed
                  </span>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>
                {field.usedBySNFalyze ? (
                  <span style={{ color: '#198754', fontWeight: 'bold' }}>✓</span>
                ) : (
                  <span style={{ color: '#adb5bd' }}>–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {fields.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: '#0d6efd'
          }}
        >
          {showAll ? 'Show Less' : `Show All ${fields.length} Fields`}
        </button>
      )}
    </div>
  );
};

export default FieldsTable;
