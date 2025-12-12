import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    height: '100%',
  },
  panel: (type) => ({
    background: type === 'risks' ? '#fff5f5' : '#f0fff4',
    border: `1px solid ${type === 'risks' ? '#feb2b2' : '#9ae6b4'}`,
    borderRadius: '8px',
    padding: '12px',
  }),
  header: (type) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 600,
    color: type === 'risks' ? '#c53030' : '#276749',
    marginBottom: '8px',
    textTransform: 'uppercase',
  }),
  list: (type) => ({
    margin: 0,
    paddingLeft: '14px',
    color: type === 'risks' ? '#742a2a' : '#22543d',
    fontSize: '11px',
    lineHeight: 1.6,
  }),
  emptyText: {
    color: '#666',
    fontSize: '11px',
    fontStyle: 'italic',
  },
};

const RisksOpportunitiesPanel = ({ risks = [], opportunities = [] }) => {
  return (
    <div style={styles.container}>
      {/* Risks Panel */}
      <div style={styles.panel('risks')}>
        <div style={styles.header('risks')}>
          <AlertTriangle size={14} />
          Key Risks
        </div>
        {risks.length === 0 ? (
          <div style={styles.emptyText}>No significant risks identified</div>
        ) : (
          <ul style={styles.list('risks')}>
            {risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Opportunities Panel */}
      <div style={styles.panel('opportunities')}>
        <div style={styles.header('opportunities')}>
          <CheckCircle size={14} />
          Key Opportunities
        </div>
        {opportunities.length === 0 ? (
          <div style={styles.emptyText}>Limited opportunities identified</div>
        ) : (
          <ul style={styles.list('opportunities')}>
            {opportunities.map((opp, index) => (
              <li key={index}>{opp}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RisksOpportunitiesPanel;
