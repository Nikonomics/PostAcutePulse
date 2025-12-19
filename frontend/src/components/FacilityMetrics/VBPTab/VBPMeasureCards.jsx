import React, { useState } from 'react';
import { ChevronRight, Check, X } from 'lucide-react';

/**
 * Measure configuration for the 4 VBP measures
 */
const MEASURE_CONFIG = [
  {
    key: 'readmission',
    title: 'Readmission',
    baselineKey: 'baseline_rate',
    performanceKey: 'performance_rate',
    format: 'percent',
    lowerIsBetter: true,
    betterText: 'Lower readmission rates = better performance'
  },
  {
    key: 'hai',
    title: 'Healthcare-Associated Infections',
    shortTitle: 'HAI',
    baselineKey: 'baseline_rate',
    performanceKey: 'performance_rate',
    format: 'percent',
    lowerIsBetter: true,
    betterText: 'Lower infection rates = better performance'
  },
  {
    key: 'turnover',
    title: 'Staff Turnover',
    baselineKey: 'baseline_rate',
    performanceKey: 'performance_rate',
    format: 'percent',
    lowerIsBetter: true,
    betterText: 'Lower turnover rates = better performance'
  },
  {
    key: 'staffing',
    title: 'Staffing Hours',
    baselineKey: 'baseline_hours',
    performanceKey: 'performance_hours',
    format: 'hours',
    lowerIsBetter: false,
    betterText: 'Higher staffing hours = better performance'
  }
];

/**
 * Get color based on score value
 */
const getScoreColor = (score) => {
  if (score == null) return '#9ca3af';
  if (score >= 8) return '#22c55e';
  if (score >= 5) return '#eab308';
  return '#ef4444';
};

/**
 * Format a value based on measure type
 */
const formatValue = (value, format) => {
  if (value == null) return '—';
  if (format === 'percent') {
    return `${(parseFloat(value) * 100).toFixed(1)}%`;
  }
  if (format === 'hours') {
    return `${parseFloat(value).toFixed(2)} HPRD`;
  }
  return value;
};

/**
 * Format benchmark value (already in percentage form from API)
 */
const formatBenchmark = (value, format) => {
  if (value == null) return '—';
  if (format === 'percent') {
    return `${(parseFloat(value) * 100).toFixed(1)}%`;
  }
  if (format === 'hours') {
    return `${parseFloat(value).toFixed(2)} HPRD`;
  }
  return value;
};

/**
 * Calculate change between baseline and performance
 */
const calculateChange = (baseline, performance, lowerIsBetter, format) => {
  if (baseline == null || performance == null) return null;

  const baseVal = parseFloat(baseline);
  const perfVal = parseFloat(performance);

  // Handle edge case where baseline is 0 or very small
  if (Math.abs(baseVal) < 0.0001) return null;

  const change = perfVal - baseVal;
  const percentChange = (change / Math.abs(baseVal)) * 100;
  const improved = lowerIsBetter ? change < 0 : change > 0;

  // Don't show change if it's essentially zero
  if (Math.abs(change) < 0.0001) return null;

  let text;
  if (format === 'percent') {
    text = `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)} pp`;
  } else {
    text = `${change > 0 ? '+' : ''}${change.toFixed(2)} hrs`;
  }

  return {
    absolute: change,
    percent: percentChange,
    improved,
    text
  };
};

/**
 * Compare facility rate to benchmark
 */
const compareToAverage = (facilityRate, avgRate, lowerIsBetter) => {
  if (facilityRate == null || avgRate == null) return null;

  const facility = parseFloat(facilityRate);
  const avg = parseFloat(avgRate);
  const diff = facility - avg;
  const percentDiff = Math.abs((diff / avg) * 100);

  // Determine if better or worse
  const isBetter = lowerIsBetter ? diff < 0 : diff > 0;

  return {
    isBetter,
    percentDiff: percentDiff.toFixed(0)
  };
};

/**
 * Render a score bar with 10 segments
 */
const ScoreBar = ({ score, size = 'normal' }) => {
  const filledCount = score != null ? Math.round(parseFloat(score)) : 0;
  const color = getScoreColor(score);
  const segmentClass = size === 'mini' ? 'vbp-mini-score-segment' : 'vbp-score-segment';
  const barClass = size === 'mini' ? 'vbp-mini-score-bar' : 'vbp-score-bar';

  return (
    <div className={barClass} style={{ color }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className={`${segmentClass} ${i < filledCount ? 'filled' : ''}`}
        />
      ))}
    </div>
  );
};

/**
 * Benchmark comparison row
 */
const BenchmarkRow = ({ label, avgRate, facilityRate, format, lowerIsBetter }) => {
  const comparison = compareToAverage(facilityRate, avgRate, lowerIsBetter);

  return (
    <tr>
      <td className="vbp-benchmark-level">{label}</td>
      <td className="vbp-benchmark-avg">{formatBenchmark(avgRate, format)}</td>
      <td className="vbp-benchmark-compare">
        {comparison ? (
          <span className={`vbp-benchmark-result ${comparison.isBetter ? 'better' : 'worse'}`}>
            {comparison.isBetter ? (
              <Check size={14} />
            ) : (
              <X size={14} />
            )}
            {comparison.isBetter ? 'Better' : 'Worse'} by {comparison.percentDiff}%
          </span>
        ) : (
          <span className="vbp-benchmark-na">—</span>
        )}
      </td>
    </tr>
  );
};

/**
 * Individual measure card component
 */
const MeasureCard = ({ config, data, benchmarks, isExpanded, onToggle }) => {
  const hasData = data && (
    data.achievement_score != null ||
    data.improvement_score != null ||
    data.measure_score != null
  );

  const achievementScore = data?.achievement_score != null ? parseFloat(data.achievement_score) : null;
  const improvementScore = data?.improvement_score != null ? parseFloat(data.improvement_score) : null;
  const measureScore = data?.measure_score != null ? parseFloat(data.measure_score) : null;

  const baseline = data?.[config.baselineKey];
  const performance = data?.[config.performanceKey];
  const change = calculateChange(baseline, performance, config.lowerIsBetter, config.format);

  const displayTitle = config.shortTitle || config.title;

  // Get benchmarks for this measure
  const measureBenchmarks = benchmarks?.[config.key];
  const hasBenchmarks = measureBenchmarks && (
    measureBenchmarks.national != null ||
    measureBenchmarks.state != null ||
    measureBenchmarks.county != null
  );

  return (
    <div className={`vbp-measure-card ${isExpanded ? 'expanded' : ''}`}>
      {/* Collapsed Header */}
      <div className="vbp-measure-card-header" onClick={onToggle}>
        <ChevronRight
          size={18}
          className={`vbp-measure-card-chevron ${isExpanded ? 'expanded' : ''}`}
        />
        <span className="vbp-measure-card-title">{displayTitle}</span>

        {hasData ? (
          <>
            <div className="vbp-measure-card-scores">
              <span>Achievement: <strong>{achievementScore != null ? achievementScore.toFixed(0) : '—'}</strong></span>
              <span>Improvement: <strong>{improvementScore != null ? improvementScore.toFixed(0) : '—'}</strong></span>
              <span>Score: <strong>{measureScore != null ? measureScore.toFixed(1) : '—'}</strong></span>
            </div>
            <ScoreBar score={measureScore} size="mini" />
          </>
        ) : (
          <div className="vbp-measure-card-scores">
            <span style={{ color: '#9ca3af' }}>Data not available</span>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="vbp-measure-card-content">
          {hasData ? (
            <>
              {/* Your Rate Section */}
              {(baseline != null || performance != null) && (
                <div className="vbp-measure-comparison">
                  <div className="vbp-measure-comparison-box">
                    <h4>Baseline</h4>
                    <div className="vbp-measure-comparison-value">
                      {formatValue(baseline, config.format)}
                    </div>
                  </div>
                  <div className="vbp-measure-comparison-box">
                    <h4>Performance</h4>
                    <div className="vbp-measure-comparison-value">
                      {formatValue(performance, config.format)}
                    </div>
                  </div>
                  {change && (
                    <div className={`vbp-measure-change-inline ${change.improved ? 'improved' : 'declined'}`}>
                      {change.text} ({change.improved ? '↓' : '↑'} {Math.abs(change.percent).toFixed(0)}%)
                    </div>
                  )}
                </div>
              )}

              {/* Benchmark Comparison Section */}
              <div className="vbp-benchmark-section">
                <h4>How You Compare</h4>
                {hasBenchmarks ? (
                  <table className="vbp-benchmark-table">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>Avg Rate</th>
                        <th>vs You</th>
                      </tr>
                    </thead>
                    <tbody>
                      <BenchmarkRow
                        label="County"
                        avgRate={measureBenchmarks.county}
                        facilityRate={performance}
                        format={config.format}
                        lowerIsBetter={config.lowerIsBetter}
                      />
                      <BenchmarkRow
                        label="State"
                        avgRate={measureBenchmarks.state}
                        facilityRate={performance}
                        format={config.format}
                        lowerIsBetter={config.lowerIsBetter}
                      />
                      <BenchmarkRow
                        label="National"
                        avgRate={measureBenchmarks.national}
                        facilityRate={performance}
                        format={config.format}
                        lowerIsBetter={config.lowerIsBetter}
                      />
                    </tbody>
                  </table>
                ) : (
                  <div className="vbp-benchmark-placeholder">
                    Benchmark comparisons coming soon
                  </div>
                )}
              </div>

              {/* Info Note */}
              <div className="vbp-measure-note">
                {config.betterText}
              </div>
            </>
          ) : (
            <div className="vbp-measure-no-data">
              <p>No data available for this measure.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * VBPMeasureCards - Expandable cards showing detailed measure performance
 */
const VBPMeasureCards = ({ vbpData }) => {
  const [expandedCard, setExpandedCard] = useState(null);

  const measures = vbpData?.current?.measures || {};
  const benchmarks = vbpData?.benchmarks || {};

  // Check if we have any measure data at all
  const hasAnyData = MEASURE_CONFIG.some(config => {
    const data = measures[config.key];
    return data && (
      data.achievement_score != null ||
      data.improvement_score != null ||
      data.measure_score != null
    );
  });

  const handleToggle = (key) => {
    setExpandedCard(expandedCard === key ? null : key);
  };

  return (
    <div className="vbp-measure-cards">
      <h3>Measure Performance</h3>

      {!hasAnyData ? (
        <div className="vbp-measure-empty">
          <p>No measure performance data available for this facility.</p>
        </div>
      ) : (
        MEASURE_CONFIG.map(config => (
          <MeasureCard
            key={config.key}
            config={config}
            data={measures[config.key]}
            benchmarks={benchmarks}
            isExpanded={expandedCard === config.key}
            onToggle={() => handleToggle(config.key)}
          />
        ))
      )}
    </div>
  );
};

export default VBPMeasureCards;
