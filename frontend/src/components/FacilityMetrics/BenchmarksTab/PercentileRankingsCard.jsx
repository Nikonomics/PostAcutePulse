import React from 'react';
import { TrendingUp, Star, Users, ClipboardCheck, Building, Activity } from 'lucide-react';

const METRIC_CONFIG = {
  overall_rating: {
    label: 'Overall Rating',
    icon: Star,
    format: 'rating',
    color: '#3b82f6',
  },
  quality_rating: {
    label: 'Quality Rating',
    icon: ClipboardCheck,
    format: 'rating',
    color: '#8b5cf6',
  },
  staffing_rating: {
    label: 'Staffing Rating',
    icon: Users,
    format: 'rating',
    color: '#06b6d4',
  },
  inspection_rating: {
    label: 'Inspection Rating',
    icon: ClipboardCheck,
    format: 'rating',
    color: '#f59e0b',
  },
  total_nursing_hprd: {
    label: 'Total HPRD',
    icon: Activity,
    format: 'decimal',
    color: '#10b981',
  },
  rn_hprd: {
    label: 'RN HPRD',
    icon: Activity,
    format: 'decimal',
    color: '#14b8a6',
  },
  rn_turnover: {
    label: 'RN Turnover',
    icon: TrendingUp,
    format: 'percent',
    color: '#ef4444',
    lowerIsBetter: true,
  },
  deficiency_count: {
    label: 'Deficiencies',
    icon: ClipboardCheck,
    format: 'number',
    color: '#f97316',
    lowerIsBetter: true,
  },
  occupancy: {
    label: 'Occupancy',
    icon: Building,
    format: 'percent',
    color: '#6366f1',
  },
};

const formatValue = (value, format) => {
  if (value == null) return '—';
  switch (format) {
    case 'rating':
      return `${value}★`;
    case 'percent':
      return `${Math.round(value)}%`;
    case 'decimal':
      return value.toFixed(2);
    case 'number':
      return Math.round(value).toString();
    default:
      return value;
  }
};

const getPercentileColor = (percentile) => {
  if (percentile >= 75) return '#22c55e';
  if (percentile >= 50) return '#84cc16';
  if (percentile >= 25) return '#f59e0b';
  return '#ef4444';
};

const PercentileRankingsCard = ({ metricKey, data }) => {
  const config = METRIC_CONFIG[metricKey];
  if (!config || !data) return null;

  const Icon = config.icon;
  const percentileColor = getPercentileColor(data.percentile);

  return (
    <div className="percentile-card">
      <div className="percentile-card-header">
        <Icon size={16} style={{ color: config.color }} />
        <span className="percentile-metric-label">{config.label}</span>
      </div>

      <div className="percentile-card-body">
        <div className="percentile-value-section">
          <span className="percentile-facility-value">
            {formatValue(data.value, config.format)}
          </span>
        </div>

        <div className="percentile-gauge-section">
          <div className="percentile-gauge">
            <div className="percentile-gauge-track">
              <div
                className="percentile-gauge-fill"
                style={{
                  width: `${data.percentile}%`,
                  backgroundColor: percentileColor,
                }}
              />
              <div
                className="percentile-gauge-marker"
                style={{ left: `${data.percentile}%` }}
              />
            </div>
            <div className="percentile-gauge-labels">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className="percentile-stats">
          <div className="percentile-rank">
            <span className="percentile-rank-value" style={{ color: percentileColor }}>
              {data.percentile}
            </span>
            <span className="percentile-rank-suffix">th</span>
            <span className="percentile-rank-label">percentile</span>
          </div>
          <div className="percentile-better-than">
            Better than <strong>{data.better_than?.toLocaleString()}</strong> facilities
          </div>
        </div>
      </div>
    </div>
  );
};

export default PercentileRankingsCard;
