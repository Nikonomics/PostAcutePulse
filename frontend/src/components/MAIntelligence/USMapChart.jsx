import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleQuantize } from 'd3-scale';
import { Loader, AlertCircle, Map } from 'lucide-react';
import StateDetailMap from './StateDetailMap';
import USMapWithFacilityDots from './USMapWithFacilityDots';
import { getOperatorFacilities } from '../../api/maAnalyticsService';

// US TopoJSON URL (hosted by react-simple-maps)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// State FIPS code to abbreviation mapping
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

// State abbreviation to full name
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
  'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
  'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
  'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
  'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
  'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
  'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
  'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming', 'PR': 'Puerto Rico'
};

// Color scale - blues from light to dark
const COLOR_RANGE = ['#E0F2FE', '#BAE6FD', '#7DD3FC', '#38BDF8', '#0EA5E9', '#0284C7', '#0369A1'];

/**
 * Format number with commas
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString();
};

/**
 * Map Tooltip Component
 */
const MapTooltip = ({ data, position }) => {
  if (!data) return null;

  return (
    <div
      className="map-tooltip"
      style={{
        left: position.x + 10,
        top: position.y - 10,
      }}
    >
      <div className="map-tooltip-header">
        <span className="map-tooltip-state">{STATE_NAMES[data.state] || data.state}</span>
      </div>
      <div className="map-tooltip-stats">
        <div className="map-tooltip-stat">
          <span className="stat-label">Transactions:</span>
          <span className="stat-value">{formatNumber(data.transactions)}</span>
        </div>
        <div className="map-tooltip-stat">
          <span className="stat-label">Beds Changed:</span>
          <span className="stat-value">{formatNumber(data.bedsChanged)}</span>
        </div>
      </div>
      {data.topBuyers && data.topBuyers.length > 0 && (
        <div className="map-tooltip-section">
          <span className="section-label">Top Buyers:</span>
          <ul className="section-list">
            {data.topBuyers.slice(0, 3).map((buyer, i) => (
              <li key={i}>{i + 1}. {buyer}</li>
            ))}
          </ul>
        </div>
      )}
      {data.topSellers && data.topSellers.length > 0 && (
        <div className="map-tooltip-section">
          <span className="section-label">Top Sellers:</span>
          <ul className="section-list">
            {data.topSellers.slice(0, 3).map((seller, i) => (
              <li key={i}>{i + 1}. {seller}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="map-tooltip-footer">
        Click to view transactions
      </div>
    </div>
  );
};

/**
 * Color Legend Component
 */
const ColorLegend = ({ min, max }) => {
  return (
    <div className="map-legend">
      <span className="legend-label">Transactions</span>
      <div className="legend-scale">
        <div className="legend-gradient" />
        <div className="legend-labels">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * US Map Chart Component
 */
const USMapChart = ({ data, loading, error, activeFilter, dateRange, onStateClick }) => {
  const navigate = useNavigate();
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Operator facilities state for operator filter view
  const [operatorFacilities, setOperatorFacilities] = useState(null);
  const [operatorSummary, setOperatorSummary] = useState(null);
  const [loadingOperator, setLoadingOperator] = useState(false);
  const [operatorError, setOperatorError] = useState(null);

  // Fetch operator facilities when operator filter is active
  useEffect(() => {
    if (activeFilter?.type === 'operator') {
      setLoadingOperator(true);
      setOperatorError(null);
      getOperatorFacilities({
        operator: activeFilter.value,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate
      })
        .then(result => {
          setOperatorFacilities(result.facilities || []);
          setOperatorSummary(result.summary || null);
        })
        .catch(err => {
          console.error('Failed to fetch operator facilities:', err);
          setOperatorError('Failed to load operator locations');
        })
        .finally(() => {
          setLoadingOperator(false);
        });
    } else {
      // Clear operator data when filter is removed
      setOperatorFacilities(null);
      setOperatorSummary(null);
    }
  }, [activeFilter, dateRange?.startDate, dateRange?.endDate]);

  // Create data lookup by state abbreviation
  const dataByState = useMemo(() => {
    if (!data || !Array.isArray(data)) return {};
    return data.reduce((acc, item) => {
      acc[item.state] = item;
      return acc;
    }, {});
  }, [data]);

  // Calculate max transactions for color scale
  const maxTransactions = useMemo(() => {
    if (!data || data.length === 0) return 100;
    return Math.max(...data.map(d => d.transactions || 0));
  }, [data]);

  // Create color scale
  const colorScale = useMemo(() => {
    return scaleQuantize()
      .domain([0, maxTransactions])
      .range(COLOR_RANGE);
  }, [maxTransactions]);

  // Handle mouse enter on state
  const handleMouseEnter = (geo, event) => {
    const stateAbbr = FIPS_TO_STATE[geo.id];
    const stateData = dataByState[stateAbbr];

    if (stateData) {
      setTooltipData(stateData);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  // Handle mouse move
  const handleMouseMove = (event) => {
    if (tooltipData) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  // Handle click on state
  const handleClick = (geo) => {
    const stateAbbr = FIPS_TO_STATE[geo.id];
    if (stateAbbr) {
      const stateData = dataByState[stateAbbr];
      if (onStateClick && stateData) {
        // Use callback to set filter state in parent
        onStateClick(stateData);
      } else {
        // Fallback to navigation
        navigate(`/ma-intelligence?tab=explorer&state=${stateAbbr}`);
      }
    }
  };

  // If filtering by state, show the state detail map
  if (activeFilter?.type === 'state') {
    return (
      <div className="us-map-card">
        <StateDetailMap
          stateCode={activeFilter.value}
          stateName={activeFilter.label}
          dateRange={dateRange}
        />
      </div>
    );
  }

  // If filtering by operator, determine single-state or multi-state view
  if (activeFilter?.type === 'operator') {
    const uniqueStates = operatorSummary?.statesPresent || [];

    // Single state - show state detail map with operator's facilities
    if (uniqueStates.length === 1 && operatorFacilities && !loadingOperator) {
      return (
        <div className="us-map-card">
          <StateDetailMap
            stateCode={uniqueStates[0]}
            stateName={STATE_NAMES[uniqueStates[0]] || uniqueStates[0]}
            dateRange={dateRange}
            operatorFacilities={operatorFacilities}
            operatorName={activeFilter.label}
          />
        </div>
      );
    }

    // Multi-state or loading - show US map with facility dots
    return (
      <div className="us-map-card">
        <USMapWithFacilityDots
          facilities={operatorFacilities || []}
          loading={loadingOperator}
          error={operatorError}
          operatorName={activeFilter.label}
          summary={operatorSummary}
        />
      </div>
    );
  }

  return (
    <div className="us-map-card">
      <div className="us-map-header">
        <div className="us-map-title-section">
          <Map size={20} className="us-map-icon" />
          <h3>Transaction Activity by State</h3>
        </div>
      </div>

      <div className="us-map-content" onMouseMove={handleMouseMove}>
        {loading ? (
          <div className="us-map-loading">
            <Loader size={32} className="spin" />
            <span>Loading map data...</span>
          </div>
        ) : error ? (
          <div className="us-map-error">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            <ComposableMap
              projection="geoAlbersUsa"
              projectionConfig={{
                scale: 1000,
              }}
              style={{
                width: '100%',
                height: 'auto',
              }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const stateAbbr = FIPS_TO_STATE[geo.id];
                    const stateData = dataByState[stateAbbr];
                    const fillColor = stateData
                      ? colorScale(stateData.transactions)
                      : '#F1F5F9';

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fillColor}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
                        onMouseEnter={(event) => handleMouseEnter(geo, event)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(geo)}
                        style={{
                          default: {
                            outline: 'none',
                          },
                          hover: {
                            fill: '#F59E0B',
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: {
                            fill: '#D97706',
                            outline: 'none',
                          },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
            <ColorLegend min={0} max={formatNumber(maxTransactions)} />
            <MapTooltip data={tooltipData} position={tooltipPosition} />
          </>
        )}
      </div>
    </div>
  );
};

export default USMapChart;
