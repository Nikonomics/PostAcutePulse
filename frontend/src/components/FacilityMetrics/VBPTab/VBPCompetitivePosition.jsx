import React from 'react';

/**
 * Ranking configuration
 */
const RANKING_CONFIG = [
  { key: 'national', label: 'National' },
  { key: 'state', label: 'State', showState: true },
  { key: 'market', label: 'Market', sublabel: '(County)' },
  { key: 'chain', label: 'Chain', optional: true }
];

/**
 * Get color based on percentile
 */
const getPercentileColor = (percentile) => {
  if (percentile == null) return '#9ca3af';
  if (percentile >= 75) return '#22c55e';
  if (percentile >= 50) return '#eab308';
  return '#ef4444';
};

/**
 * Percentile bar component - 10 segments
 */
const PercentileBar = ({ percentile }) => {
  const filledSegments = percentile != null ? Math.round(percentile / 10) : 0;
  const color = getPercentileColor(percentile);

  return (
    <div className="vbp-percentile-bar" style={{ color }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className={`vbp-percentile-segment ${i < filledSegments ? 'filled' : ''}`}
        />
      ))}
    </div>
  );
};

/**
 * Format ordinal (1st, 2nd, 3rd, etc.)
 */
const formatOrdinal = (n) => {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Single ranking row component
 */
const RankingRow = ({ config, ranking, stateCode }) => {
  const hasData = ranking && ranking.rank != null && ranking.total != null;

  // Build the label
  let label = config.label;
  if (config.showState && stateCode) {
    label = `${config.label} (${stateCode})`;
  }

  // Handle N/A case for optional rankings (like chain)
  if (config.optional && !hasData) {
    return (
      <tr>
        <td data-label="Comparison">
          <div className="vbp-ranking-comparison">
            <span className="vbp-ranking-label">
              {label}
              {config.sublabel && (
                <span className="vbp-ranking-sublabel"> {config.sublabel}</span>
              )}
            </span>
          </div>
        </td>
        <td data-label="Rank" colSpan="2">
          <span className="vbp-ranking-na">N/A (Independent facility)</span>
        </td>
      </tr>
    );
  }

  // Handle missing data for required rankings
  if (!hasData) {
    return (
      <tr>
        <td data-label="Comparison">
          <div className="vbp-ranking-comparison">
            <span className="vbp-ranking-label">
              {label}
              {config.sublabel && (
                <span className="vbp-ranking-sublabel"> {config.sublabel}</span>
              )}
            </span>
          </div>
        </td>
        <td data-label="Rank" colSpan="2">
          <span className="vbp-ranking-na">No ranking data</span>
        </td>
      </tr>
    );
  }

  const percentile = ranking.percentile != null ? Math.round(ranking.percentile) : null;
  const color = getPercentileColor(percentile);

  return (
    <tr>
      <td data-label="Comparison">
        <div className="vbp-ranking-comparison">
          <span className="vbp-ranking-label">
            {label}
            {config.sublabel && (
              <span className="vbp-ranking-sublabel"> {config.sublabel}</span>
            )}
          </span>
        </div>
      </td>
      <td data-label="Rank">
        <span className="vbp-ranking-rank">#{ranking.rank.toLocaleString()}</span>
        <span className="vbp-ranking-total">of {ranking.total.toLocaleString()}</span>
      </td>
      <td data-label="Percentile">
        <div className="vbp-ranking-percentile-cell">
          <PercentileBar percentile={percentile} />
          <span className="vbp-ranking-percentile-text" style={{ color }}>
            {percentile != null ? formatOrdinal(percentile) : '—'}
          </span>
        </div>
      </td>
    </tr>
  );
};

/**
 * VBPCompetitivePosition - Shows how facility ranks against peers
 */
const VBPCompetitivePosition = ({ vbpData, facility }) => {
  const rankings = vbpData?.rankings || {};
  const stateCode = facility?.state;

  // Check if we have any ranking data
  const hasAnyData = RANKING_CONFIG.some(config => {
    const ranking = rankings[config.key];
    return ranking && ranking.rank != null;
  });

  if (!hasAnyData) {
    return (
      <div className="vbp-competitive-position">
        <h3>Competitive Position</h3>
        <div className="vbp-competitive-empty">
          <p>No competitive ranking data available for this facility.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vbp-competitive-position">
      <h3>Competitive Position</h3>

      <table className="vbp-rankings-table">
        <thead>
          <tr>
            <th>Comparison</th>
            <th>Rank</th>
            <th>Percentile</th>
          </tr>
        </thead>
        <tbody>
          {RANKING_CONFIG.map(config => (
            <RankingRow
              key={config.key}
              config={config}
              ranking={rankings[config.key]}
              stateCode={stateCode}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VBPCompetitivePosition;
