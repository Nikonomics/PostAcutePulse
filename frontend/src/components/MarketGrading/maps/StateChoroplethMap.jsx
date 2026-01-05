/**
 * StateChoroplethMap.jsx
 *
 * A map showing CBSAs and counties within a single state, colored by score.
 *
 * Props:
 * - stateCode: string (required)
 * - cbsas: Array<{ cbsaCode, name, score, grade, countyFips[], center }> (required)
 * - nonCbsaCounties: Array<{ countyFips, countyName, score, grade, center }> (required)
 * - scoreType: 'overall' | 'snf' | 'alf' | 'hha' (required)
 * - onAreaClick: (code, type) => void (required)
 * - onAreaHover: (code | null, type | null) => void (required)
 * - className: string (optional)
 *
 * Usage:
 * <StateChoroplethMap
 *   stateCode="ID"
 *   cbsas={cbsaData}
 *   nonCbsaCounties={countyData}
 *   scoreType="overall"
 *   onAreaClick={(code, type) => navigate(`/markets/${type}/${code}`)}
 *   onAreaHover={handleHover}
 * />
 */

/* TODO: Replace with actual map using Google Maps + county GeoJSON
   - Load county boundaries for this state from Census Bureau TIGER/Line
   - Merge county polygons into CBSA regions using countyFips arrays
   - Color polygons by score using scoreToColor function
   - Add click/hover interactions for each polygon
   - Show CBSA labels at center points
   - Handle zoom levels to show/hide county boundaries
   - Consider using @react-google-maps/api or Google Maps JavaScript API

   Data sources:
   - County GeoJSON: https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html
   - CBSA definitions: https://www.census.gov/programs-surveys/metro-micro.html
*/

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { GradeBadge } from '../core';
import { GRADE_COLORS, getGradeFromScore } from '../constants';

/**
 * State names for display
 */
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

/**
 * Get background color for a score
 */
const getScoreBackgroundColor = (score, grade) => {
  const gradeColor = GRADE_COLORS[grade];
  if (gradeColor) {
    return `${gradeColor.bg}15`; // 15% opacity
  }
  return '#f3f4f6';
};

/**
 * Get border color for a score
 */
const getScoreBorderColor = (score, grade) => {
  const gradeColor = GRADE_COLORS[grade];
  if (gradeColor) {
    return `${gradeColor.bg}40`; // 40% opacity
  }
  return '#e5e7eb';
};

const StateChoroplethMap = ({
  stateCode,
  cbsas,
  nonCbsaCounties,
  scoreType,
  onAreaClick,
  onAreaHover,
  className = ''
}) => {
  // Sort CBSAs and counties by score descending
  const sortedCbsas = useMemo(() => {
    return [...cbsas].sort((a, b) => b.score - a.score);
  }, [cbsas]);

  const sortedCounties = useMemo(() => {
    return [...nonCbsaCounties].sort((a, b) => b.score - a.score);
  }, [nonCbsaCounties]);

  const stateName = STATE_NAMES[stateCode] || stateCode;

  // Container styles
  const containerStyle = {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  };

  // Header styles
  const headerStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb'
  };

  const titleStyle = {
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    margin: 0
  };

  const subtitleStyle = {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4
  };

  // Placeholder notice styles
  const placeholderNoticeStyle = {
    padding: '12px 20px',
    backgroundColor: '#fef3c7',
    borderBottom: '1px solid #fcd34d',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#92400e'
  };

  // Section styles
  const sectionStyle = {
    padding: '16px 20px'
  };

  const sectionHeaderStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };

  const countBadgeStyle = {
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '2px 8px',
    borderRadius: 10
  };

  // Grid styles
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12
  };

  // Card styles
  const getCardStyle = (score, grade, isHovered) => ({
    padding: '12px 14px',
    backgroundColor: isHovered ? getScoreBorderColor(score, grade) : getScoreBackgroundColor(score, grade),
    border: `1px solid ${getScoreBorderColor(score, grade)}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  });

  const cardNameStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: '#111827',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const cardScoreContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  };

  const cardScoreStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151'
  };

  // Divider styles
  const dividerStyle = {
    height: 1,
    backgroundColor: '#e5e7eb',
    margin: '0 20px'
  };

  // Empty state styles
  const emptyStyle = {
    padding: '20px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13
  };

  // Render area card
  const renderAreaCard = (area, type) => {
    const code = type === 'cbsa' ? area.cbsaCode : area.countyFips;
    const name = type === 'cbsa' ? area.name : area.countyName;
    const grade = area.grade || getGradeFromScore(area.score);

    return (
      <div
        key={code}
        style={getCardStyle(area.score, grade, false)}
        onClick={() => onAreaClick(code, type)}
        onMouseEnter={() => onAreaHover(code, type)}
        onMouseLeave={() => onAreaHover(null, null)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onAreaClick(code, type);
          }
        }}
        aria-label={`${name}: Score ${area.score.toFixed(1)}, Grade ${grade}`}
      >
        <span style={cardNameStyle} title={name}>
          {name}
        </span>
        <div style={cardScoreContainerStyle}>
          <span style={cardScoreStyle}>{area.score.toFixed(1)}</span>
          <GradeBadge grade={grade} size="sm" />
        </div>
      </div>
    );
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>{stateName} Markets</h3>
        <p style={subtitleStyle}>
          {cbsas.length} CBSAs, {nonCbsaCounties.length} rural counties
          {scoreType !== 'overall' && ` • ${scoreType.toUpperCase()} scores`}
        </p>
      </div>

      {/* Placeholder notice */}
      <div style={placeholderNoticeStyle}>
        <span role="img" aria-label="construction">🚧</span>
        <span>
          <strong>Map View Coming Soon</strong> — This grid view will be replaced with an interactive map
        </span>
      </div>

      {/* CBSAs Section */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>Metropolitan & Micropolitan Areas (CBSAs)</span>
          <span style={countBadgeStyle}>{sortedCbsas.length}</span>
        </div>
        {sortedCbsas.length > 0 ? (
          <div style={gridStyle}>
            {sortedCbsas.map(cbsa => renderAreaCard(cbsa, 'cbsa'))}
          </div>
        ) : (
          <div style={emptyStyle}>No CBSAs in this state</div>
        )}
      </div>

      {/* Divider */}
      {nonCbsaCounties.length > 0 && <div style={dividerStyle} />}

      {/* Rural Counties Section */}
      {nonCbsaCounties.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <span>Rural Counties (Non-CBSA)</span>
            <span style={countBadgeStyle}>{sortedCounties.length}</span>
          </div>
          <div style={gridStyle}>
            {sortedCounties.map(county => renderAreaCard(county, 'county'))}
          </div>
        </div>
      )}
    </div>
  );
};

StateChoroplethMap.propTypes = {
  /** Two-letter state code */
  stateCode: PropTypes.string.isRequired,
  /** Array of CBSA data */
  cbsas: PropTypes.arrayOf(PropTypes.shape({
    cbsaCode: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    score: PropTypes.number.isRequired,
    grade: PropTypes.string,
    countyFips: PropTypes.arrayOf(PropTypes.string),
    center: PropTypes.shape({
      lat: PropTypes.number,
      lng: PropTypes.number
    })
  })).isRequired,
  /** Array of non-CBSA county data */
  nonCbsaCounties: PropTypes.arrayOf(PropTypes.shape({
    countyFips: PropTypes.string.isRequired,
    countyName: PropTypes.string.isRequired,
    score: PropTypes.number.isRequired,
    grade: PropTypes.string,
    center: PropTypes.shape({
      lat: PropTypes.number,
      lng: PropTypes.number
    })
  })).isRequired,
  /** Which score type is being displayed */
  scoreType: PropTypes.oneOf(['overall', 'snf', 'alf', 'hha']).isRequired,
  /** Callback when an area is clicked */
  onAreaClick: PropTypes.func.isRequired,
  /** Callback when mouse enters/leaves an area */
  onAreaHover: PropTypes.func.isRequired,
  /** Additional CSS class names */
  className: PropTypes.string
};

StateChoroplethMap.defaultProps = {
  className: ''
};

export default StateChoroplethMap;
