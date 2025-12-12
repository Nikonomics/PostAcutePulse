import React from 'react';
import { Plus, Info } from 'lucide-react';
import { getGradeColor } from '../../utils/marketScoreCalculations';

const styles = {
  container: (colors) => ({
    background: colors.bg,
    border: `3px solid ${colors.accent}`,
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  }),
  leftSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  marketLabel: {
    fontSize: '12px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  marketName: {
    fontSize: '18px',
    color: '#333',
    fontWeight: 600,
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  compareButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #2563eb',
    background: 'white',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  compareButtonDisabled: {
    border: '1px solid #9ca3af',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  confidenceSection: {
    textAlign: 'right',
  },
  confidenceLabel: {
    fontSize: '10px',
    color: '#666',
  },
  confidenceValue: (confidence) => ({
    fontSize: '14px',
    fontWeight: 600,
    color: confidence > 85 ? '#28a745' : confidence > 70 ? '#ffc107' : '#dc3545',
  }),
  gradeBox: (colors) => ({
    background: colors.accent,
    color: 'white',
    padding: '12px 24px',
    borderRadius: '8px',
    textAlign: 'center',
    minWidth: '80px',
  }),
  gradeLabel: {
    fontSize: '10px',
    opacity: 0.9,
  },
  gradeValue: {
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: 1,
  },
};

const OverallGradeHeader = ({
  grade,
  confidence,
  countyName,
  stateName,
  facilityType,
  onAddCompare,
  isInComparison = false,
  comparisonFull = false,
}) => {
  const colors = getGradeColor(grade);
  const canCompare = !isInComparison && !comparisonFull;

  return (
    <div style={styles.container(colors)}>
      <div style={styles.leftSection}>
        <div style={styles.marketLabel}>
          Market Assessment • {facilityType === 'SNF' ? 'Skilled Nursing' : 'Assisted Living'}
        </div>
        <div style={styles.marketName}>{countyName}, {stateName}</div>
      </div>

      <div style={styles.rightSection}>
        <button
          style={{
            ...styles.compareButton,
            ...(canCompare ? {} : styles.compareButtonDisabled),
          }}
          onClick={onAddCompare}
          disabled={!canCompare}
        >
          <Plus size={14} />
          {isInComparison ? 'In Comparison' : 'Add to Compare'}
        </button>

        <div style={styles.confidenceSection}>
          <div style={styles.confidenceLabel}>Data Confidence</div>
          <div style={styles.confidenceValue(confidence)}>{confidence}%</div>
        </div>

        <div style={styles.gradeBox(colors)}>
          <div style={styles.gradeLabel}>MARKET GRADE</div>
          <div style={styles.gradeValue}>{grade}</div>
        </div>
      </div>
    </div>
  );
};

export default OverallGradeHeader;
