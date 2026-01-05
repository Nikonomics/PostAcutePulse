/**
 * USChoroplethMap.jsx
 *
 * An SVG-based choropleth map of the United States using real TopoJSON geographic data.
 * States are colored based on grade ranges with smooth interpolation.
 * Uses d3-geo for map projection and topojson-client for parsing TopoJSON.
 *
 * Props:
 * - data: Array<{ stateCode, score, grade }> (required)
 * - scoreType: 'overall' | 'snf' | 'alf' | 'hha' (required)
 * - scale: { min, max, median } (required)
 * - onStateClick: (stateCode) => void (required)
 * - onStateHover: (stateCode | null, event) => void (required)
 * - hoveredState: string | null (required)
 * - className: string (optional)
 *
 * Data source: /public/us-states-10m.json (TopoJSON from US Census Bureau)
 */

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { geoPath, geoAlbersUsa } from 'd3-geo';
import { feature } from 'topojson-client';

/**
 * FIPS code to state abbreviation mapping
 */
const FIPS_TO_STATE = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR'
};

/**
 * State full names lookup
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
 * Color stops for score interpolation
 * Maps grade ranges to colors (from F=red to A=green)
 */
const COLOR_STOPS = [
  { score: 0, color: { r: 239, g: 68, b: 68 } },    // Red (#ef4444)
  { score: 40, color: { r: 248, g: 113, b: 113 } }, // Light red/pink (#f87171)
  { score: 50, color: { r: 245, g: 158, b: 11 } },  // Orange (#f59e0b)
  { score: 55, color: { r: 234, g: 179, b: 8 } },   // Yellow (#eab308)
  { score: 65, color: { r: 132, g: 204, b: 22 } },  // Lime (#84cc16)
  { score: 75, color: { r: 34, g: 197, b: 94 } },   // Green (#22c55e)
  { score: 100, color: { r: 22, g: 163, b: 74 } }   // Dark green (#16a34a)
];

/**
 * Interpolate between two colors
 */
const lerpColor = (color1, color2, t) => ({
  r: Math.round(color1.r + (color2.r - color1.r) * t),
  g: Math.round(color1.g + (color2.g - color1.g) * t),
  b: Math.round(color1.b + (color2.b - color1.b) * t)
});

/**
 * Convert score to hex color using gradient interpolation
 */
const scoreToColor = (score) => {
  if (score === null || score === undefined) {
    return '#e5e7eb'; // Gray for no data
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  let lowerStop = COLOR_STOPS[0];
  let upperStop = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (clampedScore >= COLOR_STOPS[i].score && clampedScore <= COLOR_STOPS[i + 1].score) {
      lowerStop = COLOR_STOPS[i];
      upperStop = COLOR_STOPS[i + 1];
      break;
    }
  }

  const range = upperStop.score - lowerStop.score;
  const t = range === 0 ? 0 : (clampedScore - lowerStop.score) / range;
  const color = lerpColor(lowerStop.color, upperStop.color, t);

  return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
};

/**
 * Lighten a hex color for hover effect
 */
const lightenColor = (hex, amount = 0.2) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lighten = (c) => Math.min(255, Math.round(c + (255 - c) * amount));

  return `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`;
};

const USChoroplethMap = ({
  data,
  scoreType,
  scale,
  onStateClick,
  onStateHover,
  hoveredState,
  className = ''
}) => {
  const [statesGeoData, setStatesGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load TopoJSON data on mount
  useEffect(() => {
    fetch('/us-states-10m.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load map data');
        }
        return response.json();
      })
      .then(topology => {
        // Convert TopoJSON to GeoJSON features
        const geojson = feature(topology, topology.objects.states);
        setStatesGeoData(geojson.features);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading state map data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Create lookup map for state data
  const stateDataMap = useMemo(() => {
    const map = {};
    data.forEach(item => {
      map[item.stateCode] = item;
    });
    return map;
  }, [data]);

  // D3 projection and path generator
  const projection = geoAlbersUsa()
    .scale(1100)
    .translate([480, 300]);

  const pathGenerator = geoPath().projection(projection);

  // Get color for a state
  const getStateColor = (stateCode) => {
    const stateInfo = stateDataMap[stateCode];
    if (!stateInfo) {
      return '#e5e7eb'; // Gray for no data
    }
    return scoreToColor(stateInfo.score);
  };

  // Event handlers
  const handleMouseEnter = (stateCode, event) => {
    onStateHover(stateCode, event);
  };

  const handleMouseMove = (stateCode, event) => {
    if (hoveredState === stateCode) {
      onStateHover(stateCode, event);
    }
  };

  const handleMouseLeave = () => {
    onStateHover(null);
  };

  const handleClick = (stateCode) => {
    onStateClick(stateCode);
  };

  // Styles
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const svgStyle = {
    width: '100%',
    maxWidth: 1200,
    height: 'auto',
    display: 'block'
  };

  const loadingStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 400,
    color: '#6b7280',
    fontSize: 14
  };

  // Loading state
  if (loading) {
    return (
      <div style={containerStyle} className={className}>
        <div style={loadingStyle}>Loading map...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={containerStyle} className={className}>
        <div style={loadingStyle}>Error loading map: {error}</div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      <svg
        viewBox="0 0 960 600"
        style={svgStyle}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`US choropleth map showing ${scoreType} scores by state`}
      >
        {/* Glow filter for hover effect */}
        <defs>
          <filter id="stateGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="960" height="600" fill="#f8fafc" rx="8" />

        {/* State paths */}
        <g id="states">
          {statesGeoData && statesGeoData.map((stateFeature) => {
            const fipsCode = stateFeature.id;
            const stateCode = FIPS_TO_STATE[fipsCode];

            // Skip if no state code mapping or if projection fails (Alaska/Hawaii outlying areas)
            if (!stateCode) return null;

            const path = pathGenerator(stateFeature);
            // Skip if path couldn't be generated (outside projection bounds)
            if (!path) return null;

            const centroid = pathGenerator.centroid(stateFeature);
            const stateInfo = stateDataMap[stateCode];
            const hasData = !!stateInfo;
            const isHovered = hoveredState === stateCode;

            const baseColor = getStateColor(stateCode);
            const fillColor = isHovered ? lightenColor(baseColor, 0.25) : baseColor;

            // Check if centroid is valid (not NaN)
            const showLabel = centroid && !isNaN(centroid[0]) && !isNaN(centroid[1]);

            return (
              <g key={stateCode}>
                <path
                  d={path}
                  fill={fillColor}
                  stroke={isHovered ? '#374151' : '#ffffff'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{
                    cursor: hasData ? 'pointer' : 'default',
                    transition: 'fill 0.2s ease, stroke 0.2s ease'
                  }}
                  filter={isHovered ? 'url(#stateGlow)' : undefined}
                  onMouseEnter={(e) => hasData && handleMouseEnter(stateCode, e)}
                  onMouseMove={(e) => hasData && handleMouseMove(stateCode, e)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => hasData && handleClick(stateCode)}
                  role="button"
                  tabIndex={hasData ? 0 : -1}
                  aria-label={`${STATE_NAMES[stateCode] || stateCode}${stateInfo ? `: Score ${stateInfo.score.toFixed(1)}, Grade ${stateInfo.grade}` : ': No data'}`}
                  onKeyDown={(e) => {
                    if (hasData && (e.key === 'Enter' || e.key === ' ')) {
                      handleClick(stateCode);
                    }
                  }}
                />
                {/* State label */}
                {showLabel && (
                  <text
                    x={centroid[0]}
                    y={centroid[1]}
                    fontSize={isHovered ? 12 : 10}
                    fontWeight={isHovered ? 700 : 600}
                    fill={isHovered ? '#111827' : (hasData ? '#374151' : '#9ca3af')}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                    style={{
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      transition: 'font-size 0.2s ease'
                    }}
                  >
                    {stateCode}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Scale indicator */}
        <g transform="translate(750, 540)">
          <text x="0" y="0" fontSize="10" fill="#6b7280" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
            Score Range:
          </text>
          <text x="0" y="14" fontSize="11" fontWeight="600" fill="#374151" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
            {scale.min.toFixed(1)} - {scale.max.toFixed(1)}
          </text>
        </g>
      </svg>
    </div>
  );
};

USChoroplethMap.propTypes = {
  /** Array of state data with stateCode, score, grade */
  data: PropTypes.arrayOf(PropTypes.shape({
    stateCode: PropTypes.string.isRequired,
    score: PropTypes.number.isRequired,
    grade: PropTypes.string.isRequired
  })).isRequired,
  /** Which score type is being displayed */
  scoreType: PropTypes.oneOf(['overall', 'snf', 'alf', 'hha']).isRequired,
  /** Score scale for the data */
  scale: PropTypes.shape({
    min: PropTypes.number.isRequired,
    max: PropTypes.number.isRequired,
    median: PropTypes.number.isRequired
  }).isRequired,
  /** Callback when a state is clicked */
  onStateClick: PropTypes.func.isRequired,
  /** Callback when mouse enters/leaves a state */
  onStateHover: PropTypes.func.isRequired,
  /** Currently hovered state code */
  hoveredState: PropTypes.string,
  /** Additional CSS class names */
  className: PropTypes.string
};

USChoroplethMap.defaultProps = {
  hoveredState: null,
  className: ''
};

// Export helper for use in other components
export { scoreToColor };
export default USChoroplethMap;
