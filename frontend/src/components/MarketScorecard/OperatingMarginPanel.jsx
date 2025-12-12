import React from 'react';
import { DollarSign } from 'lucide-react';

const styles = {
  container: {
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    padding: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
    marginBottom: '12px',
  },
  metricBox: {
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '10px',
    color: '#666',
  },
  metricValue: (color) => ({
    fontSize: '18px',
    fontWeight: 600,
    color: color || '#222',
  }),
  metricSubtext: {
    fontSize: '9px',
    color: '#999',
  },
  progressBar: {
    display: 'flex',
    height: '18px',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressSegment: (width, color) => ({
    width: `${width}%`,
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  progressLabel: {
    color: 'white',
    fontSize: '9px',
    fontWeight: 600,
  },
  assessmentBox: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: `${color}20`,
    borderRadius: '4px',
  }),
  assessmentLabel: (color) => ({
    fontWeight: 700,
    color: color,
    fontSize: '12px',
  }),
  assessmentText: {
    color: '#555',
    fontSize: '11px',
  },
};

const OperatingMarginPanel = ({ impliedRevenue, laborCost }) => {
  // Default values if not provided
  const revenue = impliedRevenue || 0;
  const labor = laborCost || 0;

  // Non-labor costs are typically ~27% of revenue (food, supplies, insurance, maintenance, admin)
  const nonLaborCost = Math.round(revenue * 0.27);

  // Calculate margin percentage
  const marginPct = revenue > 0 ? ((revenue - labor - nonLaborCost) / revenue) * 100 : 0;
  const laborPct = revenue > 0 ? (labor / revenue) * 100 : 0;
  const nonLaborPct = 27; // Fixed at 27%

  // Determine color and assessment based on margin
  let marginColor, assessment, assessmentText;
  if (marginPct >= 26) {
    marginColor = '#28a745';
    assessment = 'FAVORABLE';
    assessmentText = 'Labor costs in line with revenue';
  } else if (marginPct >= 20) {
    marginColor = '#ffc107';
    assessment = 'MODERATE';
    assessmentText = 'Margins achievable with efficiency';
  } else {
    marginColor = '#dc3545';
    assessment = 'CHALLENGING';
    assessmentText = 'Revenue may not support costs';
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <DollarSign size={14} />
        Operating Margin Potential
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricBox}>
          <div style={styles.metricLabel}>Implied Revenue</div>
          <div style={styles.metricValue()}>${revenue.toLocaleString()}</div>
          <div style={styles.metricSubtext}>per bed/mo</div>
        </div>

        <div style={styles.metricBox}>
          <div style={styles.metricLabel}>Labor Cost</div>
          <div style={styles.metricValue()}>${labor.toLocaleString()}</div>
          <div style={styles.metricSubtext}>{laborPct.toFixed(0)}% of revenue</div>
        </div>

        <div style={styles.metricBox}>
          <div style={styles.metricLabel}>Implied EBITDAR</div>
          <div style={styles.metricValue(marginColor)}>{marginPct.toFixed(0)}%</div>
          <div style={styles.metricSubtext}>vs 23% target</div>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div style={styles.progressSegment(laborPct, '#e74c3c')}>
          <span style={styles.progressLabel}>Labor</span>
        </div>
        <div style={styles.progressSegment(nonLaborPct, '#f39c12')}>
          <span style={styles.progressLabel}>Other</span>
        </div>
        <div style={styles.progressSegment(100 - laborPct - nonLaborPct, marginColor)}>
          <span style={styles.progressLabel}>Margin</span>
        </div>
      </div>

      <div style={styles.assessmentBox(marginColor)}>
        <span style={styles.assessmentLabel(marginColor)}>{assessment}</span>
        <span style={styles.assessmentText}>— {assessmentText}</span>
      </div>
    </div>
  );
};

export default OperatingMarginPanel;
