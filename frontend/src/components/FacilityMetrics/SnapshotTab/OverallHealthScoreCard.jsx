import React, { useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Get color based on score threshold
 */
const getScoreColor = (score) => {
  if (score === null || score === undefined) return '#9ca3af'; // gray for N/A
  if (score >= 70) return '#22c55e'; // green
  if (score >= 40) return '#eab308'; // yellow
  return '#ef4444'; // red
};

/**
 * Get background color (lighter version) based on score
 */
const getScoreBgColor = (score) => {
  if (score === null || score === undefined) return '#f3f4f6';
  if (score >= 70) return '#dcfce7';
  if (score >= 40) return '#fef9c3';
  return '#fee2e2';
};

/**
 * Circular Progress Ring component
 */
const ProgressRing = ({ score, size = 140, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validScore = score !== null && score !== undefined ? score : 0;
  const progress = (validScore / 100) * circumference;
  const strokeDasharray = `${progress} ${circumference}`;
  const color = getScoreColor(score);

  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="progress-ring-content">
        <span className="progress-ring-score" style={{ color }}>
          {score !== null && score !== undefined ? score : 'N/A'}
        </span>
        <span className="progress-ring-label">/ 100</span>
      </div>
    </div>
  );
};

/**
 * Sub-score box component
 */
const SubScoreBox = ({ label, score, trend = 'stable' }) => {
  const color = getScoreColor(score);
  const bgColor = getScoreBgColor(score);

  const TrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={14} style={{ color: '#22c55e' }} />;
      case 'declining':
        return <TrendingDown size={14} style={{ color: '#ef4444' }} />;
      default:
        return <Minus size={14} style={{ color: '#9ca3af' }} />;
    }
  };

  return (
    <div className="sub-score-box" style={{ backgroundColor: bgColor }}>
      <span className="sub-score-label">{label}</span>
      <div className="sub-score-value-row">
        <span className="sub-score-value" style={{ color }}>
          {score !== null && score !== undefined ? score : 'N/A'}
        </span>
        <TrendIcon />
      </div>
    </div>
  );
};

/**
 * OverallHealthScoreCard - displays a composite health score with sub-scores
 */
const OverallHealthScoreCard = ({ facility }) => {
  // Calculate all scores
  const scores = useMemo(() => {
    if (!facility) return null;

    // Quality Score (0-100) - based on quality_rating (1-5 stars)
    const qualityScore = facility.quality_rating
      ? Math.round((facility.quality_rating / 5) * 100)
      : null;

    // Staffing Score (0-100) - based on staffing_rating and turnover
    const staffingScore = facility.staffing_rating
      ? Math.round(
          ((facility.staffing_rating / 5) * 50) +
          ((1 - Math.min(facility.total_turnover_rate || 50, 100) / 100) * 50)
        )
      : null;

    // Compliance Score (0-100) - inverse of deficiencies and penalties
    const complianceScore = Math.round(
      Math.max(0, 100 -
        ((facility.total_deficiencies || 0) * 5) -
        ((facility.total_penalties_amount || 0) / 10000)
      )
    );

    // Stability Score (0-100) - admin tenure and RN turnover
    const stabilityScore = Math.round(
      Math.min(100,
        ((facility.administrator_days_in_role || 365) / 730) * 50 +
        ((1 - (facility.rn_turnover_rate || 30) / 100) * 50)
      )
    );

    // Overall Health Score - weighted average
    const overallScore = Math.round(
      (qualityScore || 50) * 0.30 +
      (staffingScore || 50) * 0.25 +
      complianceScore * 0.25 +
      stabilityScore * 0.20
    );

    return {
      overall: overallScore,
      quality: qualityScore,
      staffing: staffingScore,
      compliance: complianceScore,
      stability: stabilityScore,
    };
  }, [facility]);

  if (!facility) {
    return (
      <div className="metrics-card health-score-card">
        <div className="metrics-card-header">
          <Activity size={18} />
          <h4>Overall Health Score</h4>
        </div>
        <div className="health-score-placeholder">
          <p>Select a facility to view health score</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-card health-score-card">
      <div className="metrics-card-header">
        <Activity size={18} />
        <h4>Overall Health Score</h4>
      </div>

      <div className="health-score-content">
        {/* Main circular progress ring */}
        <div className="health-score-ring-section">
          <ProgressRing score={scores?.overall} size={140} strokeWidth={12} />
        </div>

        {/* Sub-scores row */}
        <div className="sub-scores-row">
          <SubScoreBox
            label="Quality"
            score={scores?.quality}
            trend="stable"
          />
          <SubScoreBox
            label="Staffing"
            score={scores?.staffing}
            trend="stable"
          />
          <SubScoreBox
            label="Compliance"
            score={scores?.compliance}
            trend="stable"
          />
          <SubScoreBox
            label="Stability"
            score={scores?.stability}
            trend="stable"
          />
        </div>
      </div>
    </div>
  );
};

export default OverallHealthScoreCard;
