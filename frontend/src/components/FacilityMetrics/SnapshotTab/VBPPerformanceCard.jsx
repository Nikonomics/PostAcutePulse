import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Award, Target, BarChart2 } from 'lucide-react';

const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined) return 'N/A';
  return `${parseFloat(value).toFixed(decimals)}%`;
};

const formatMultiplier = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const mult = parseFloat(value);
  const pct = ((mult - 1) * 100).toFixed(2);
  const prefix = mult >= 1 ? '+' : '';
  return `${prefix}${pct}%`;
};

const getMultiplierStatus = (value) => {
  if (value === null || value === undefined) return 'neutral';
  const mult = parseFloat(value);
  if (mult > 1.01) return 'bonus';
  if (mult >= 0.99) return 'neutral';
  return 'penalty';
};

const getScoreStatus = (score) => {
  if (score === null || score === undefined) return 'neutral';
  const s = parseFloat(score);
  if (s >= 70) return 'good';
  if (s >= 40) return 'moderate';
  return 'poor';
};

const ScoreBar = ({ label, value, maxValue = 100 }) => {
  const pct = value !== null && value !== undefined ? (parseFloat(value) / maxValue) * 100 : 0;
  const status = getScoreStatus(value);

  return (
    <div className="vbp-score-bar">
      <div className="vbp-score-label">
        <span>{label}</span>
        <span className={`vbp-score-value status-${status}`}>
          {value !== null && value !== undefined ? parseFloat(value).toFixed(1) : 'N/A'}
        </span>
      </div>
      <div className="vbp-bar-track">
        <div
          className={`vbp-bar-fill status-${status}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};

const VBPPerformanceCard = ({ facility }) => {
  const vbpScores = facility?.vbpScores || [];

  // Get most recent year's data
  const latestVbp = vbpScores.length > 0 ? vbpScores[0] : null;

  if (!latestVbp) {
    return (
      <div className="metrics-card vbp-performance-card">
        <div className="metrics-card-header">
          <DollarSign size={18} className="status-neutral" />
          <h4>Value-Based Purchasing</h4>
        </div>
        <div className="vbp-no-data">
          <p>VBP program data not available for this facility</p>
        </div>
      </div>
    );
  }

  const multiplierStatus = getMultiplierStatus(latestVbp.incentive_payment_multiplier);
  const multiplier = parseFloat(latestVbp.incentive_payment_multiplier);
  const isBonus = multiplier > 1;

  return (
    <div className="metrics-card vbp-performance-card">
      <div className="metrics-card-header">
        <DollarSign size={18} className="status-neutral" />
        <h4>Value-Based Purchasing</h4>
        <span className="vbp-fiscal-year">FY {latestVbp.fiscal_year}</span>
      </div>

      <div className="vbp-content">
        {/* Payment Multiplier - Main Focus */}
        <div className={`vbp-multiplier ${multiplierStatus}`}>
          <div className="vbp-multiplier-icon">
            {isBonus ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div className="vbp-multiplier-info">
            <span className="vbp-multiplier-value">
              {formatMultiplier(latestVbp.incentive_payment_multiplier)}
            </span>
            <span className="vbp-multiplier-label">
              Payment {isBonus ? 'Bonus' : 'Adjustment'}
            </span>
          </div>
          {latestVbp.vbp_ranking && (
            <div className="vbp-ranking">
              <Award size={14} />
              <span>Rank #{latestVbp.vbp_ranking}</span>
            </div>
          )}
        </div>

        {/* Scores Breakdown */}
        <div className="vbp-scores">
          <ScoreBar label="Achievement" value={latestVbp.achievement_score} />
          <ScoreBar label="Improvement" value={latestVbp.improvement_score} />
          <ScoreBar label="Performance" value={latestVbp.performance_score} />
        </div>

        {/* Readmission Rates */}
        {(latestVbp.baseline_readmission_rate || latestVbp.performance_readmission_rate) && (
          <div className="vbp-readmission">
            <div className="vbp-readmission-header">
              <Target size={14} />
              <span>Readmission Rate</span>
            </div>
            <div className="vbp-readmission-values">
              {latestVbp.baseline_readmission_rate && (
                <div className="vbp-readmission-item">
                  <span className="vbp-readmission-label">Baseline</span>
                  <span className="vbp-readmission-value">
                    {formatPercent(latestVbp.baseline_readmission_rate)}
                  </span>
                </div>
              )}
              {latestVbp.performance_readmission_rate && (
                <div className="vbp-readmission-item">
                  <span className="vbp-readmission-label">Performance</span>
                  <span className="vbp-readmission-value">
                    {formatPercent(latestVbp.performance_readmission_rate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VBPPerformanceCard;
