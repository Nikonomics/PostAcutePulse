import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { Loader, AlertCircle, MapPin, Building2 } from 'lucide-react';
import { getStateFacilities } from '../../api/maAnalyticsService';

// US TopoJSON URL
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// State abbreviation to FIPS code mapping (reverse of FIPS_TO_STATE)
const STATE_TO_FIPS = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
  'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
  'WY': '56', 'PR': '72'
};

// State center coordinates and scale for zooming
// Format: [longitude, latitude, scale]
const STATE_VIEW_CONFIG = {
  'AL': { center: [-86.9, 32.8], scale: 4500 },
  'AK': { center: [-154, 64], scale: 800 },
  'AZ': { center: [-111.9, 34.2], scale: 3500 },
  'AR': { center: [-92.4, 34.8], scale: 5000 },
  'CA': { center: [-119.5, 37.2], scale: 2200 },
  'CO': { center: [-105.5, 39], scale: 3500 },
  'CT': { center: [-72.7, 41.6], scale: 12000 },
  'DE': { center: [-75.5, 39], scale: 12000 },
  'DC': { center: [-77.02, 38.9], scale: 80000 },
  'FL': { center: [-82, 28.5], scale: 3500 },
  'GA': { center: [-83.5, 32.7], scale: 4000 },
  'HI': { center: [-157, 20.5], scale: 4000 },
  'ID': { center: [-114.5, 44.5], scale: 2800 },
  'IL': { center: [-89.2, 40], scale: 3500 },
  'IN': { center: [-86.2, 39.9], scale: 4500 },
  'IA': { center: [-93.5, 42], scale: 4500 },
  'KS': { center: [-98.5, 38.5], scale: 4000 },
  'KY': { center: [-85.7, 37.8], scale: 4500 },
  'LA': { center: [-91.8, 31], scale: 4500 },
  'ME': { center: [-69, 45.3], scale: 4000 },
  'MD': { center: [-76.8, 39.05], scale: 7000 },
  'MA': { center: [-71.8, 42.2], scale: 9000 },
  'MI': { center: [-85.5, 44.3], scale: 3000 },
  'MN': { center: [-94.5, 46.3], scale: 3000 },
  'MS': { center: [-89.7, 32.7], scale: 4000 },
  'MO': { center: [-92.5, 38.5], scale: 3800 },
  'MT': { center: [-109.5, 47], scale: 2800 },
  'NE': { center: [-99.8, 41.5], scale: 3500 },
  'NV': { center: [-116.6, 39], scale: 2800 },
  'NH': { center: [-71.5, 43.7], scale: 7000 },
  'NJ': { center: [-74.5, 40.1], scale: 8000 },
  'NM': { center: [-106, 34.5], scale: 3200 },
  'NY': { center: [-75.5, 43], scale: 3500 },
  'NC': { center: [-79.5, 35.5], scale: 4000 },
  'ND': { center: [-100.5, 47.5], scale: 4000 },
  'OH': { center: [-82.7, 40.2], scale: 5000 },
  'OK': { center: [-97.5, 35.5], scale: 4000 },
  'OR': { center: [-120.5, 44], scale: 3200 },
  'PA': { center: [-77.5, 41], scale: 4500 },
  'RI': { center: [-71.5, 41.7], scale: 18000 },
  'SC': { center: [-80.9, 33.9], scale: 5000 },
  'SD': { center: [-100, 44.5], scale: 3800 },
  'TN': { center: [-86, 35.8], scale: 4500 },
  'TX': { center: [-99.5, 31.5], scale: 2000 },
  'UT': { center: [-111.5, 39.3], scale: 3200 },
  'VT': { center: [-72.7, 44], scale: 7000 },
  'VA': { center: [-79, 37.5], scale: 4500 },
  'WA': { center: [-120.5, 47.4], scale: 3800 },
  'WV': { center: [-80.5, 38.9], scale: 5500 },
  'WI': { center: [-89.8, 44.5], scale: 4000 },
  'WY': { center: [-107.5, 43], scale: 3500 },
  'PR': { center: [-66.5, 18.2], scale: 8000 }
};

// Default config for unknown states
const DEFAULT_CONFIG = { center: [-98, 39], scale: 1000 };

/**
 * Facility Tooltip Component
 */
const FacilityTooltip = ({ facility, position }) => {
  if (!facility) return null;

  return (
    <div
      className="facility-tooltip"
      style={{
        left: position.x + 10,
        top: position.y - 10,
      }}
    >
      <div className="facility-tooltip-header">
        <Building2 size={14} />
        <span className="facility-tooltip-name">{facility.facilityName}</span>
      </div>
      <div className="facility-tooltip-details">
        <div className="tooltip-row">
          <span className="tooltip-label">City:</span>
          <span className="tooltip-value">{facility.city}</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Beds:</span>
          <span className="tooltip-value">{facility.beds || 'N/A'}</span>
        </div>
        {facility.newOperator && (
          <div className="tooltip-row">
            <span className="tooltip-label">New Owner:</span>
            <span className="tooltip-value">{facility.newOperator}</span>
          </div>
        )}
        {facility.oldOperator && (
          <div className="tooltip-row">
            <span className="tooltip-label">Previous:</span>
            <span className="tooltip-value">{facility.oldOperator}</span>
          </div>
        )}
      </div>
      <div className="facility-tooltip-footer">
        Click to view facility details
      </div>
    </div>
  );
};

/**
 * State Detail Map Component
 * Shows a zoomed-in view of a single state with facility markers
 *
 * Props:
 * - stateCode: State abbreviation (e.g., 'FL')
 * - stateName: Full state name for display
 * - dateRange: { startDate, endDate } for filtering
 * - operatorFacilities: Optional pre-filtered facilities (for operator single-state view)
 * - operatorName: Optional operator name for header (when showing operator's facilities)
 */
const StateDetailMap = ({ stateCode, stateName, dateRange, operatorFacilities, operatorName }) => {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Get state view configuration
  const viewConfig = STATE_VIEW_CONFIG[stateCode] || DEFAULT_CONFIG;
  const stateFips = STATE_TO_FIPS[stateCode];

  // Fetch facilities data (only if operatorFacilities not provided)
  useEffect(() => {
    // If operatorFacilities is provided, use those instead of fetching
    if (operatorFacilities) {
      setFacilities(operatorFacilities);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getStateFacilities({
          state: stateCode,
          startDate: dateRange?.startDate,
          endDate: dateRange?.endDate
        });
        setFacilities(result.facilities || []);
      } catch (err) {
        console.error('Failed to fetch state facilities:', err);
        setError('Failed to load facility locations');
      } finally {
        setLoading(false);
      }
    };

    if (stateCode) {
      fetchData();
    }
  }, [stateCode, dateRange?.startDate, dateRange?.endDate, operatorFacilities]);

  // Handle mouse events for facility dots
  const handleFacilityMouseEnter = (facility, event) => {
    setTooltipData(facility);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleFacilityMouseMove = (event) => {
    if (tooltipData) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleFacilityMouseLeave = () => {
    setTooltipData(null);
  };

  // Handle click on facility dot
  const handleFacilityClick = (facility) => {
    navigate(`/operator/${facility.ccn}`);
  };

  // Filter to only show valid coordinates
  const validFacilities = useMemo(() => {
    return facilities.filter(f =>
      f.latitude && f.longitude &&
      !isNaN(f.latitude) && !isNaN(f.longitude)
    );
  }, [facilities]);

  // Build header title based on whether it's an operator filter or state filter
  const headerTitle = operatorName
    ? `${operatorName} in ${stateName}`
    : `${stateName} - Transaction Locations`;

  return (
    <div className="state-detail-map">
      <div className="state-map-header">
        <div className="state-map-title">
          <MapPin size={18} />
          <h4>{headerTitle}</h4>
        </div>
        <div className="facility-count-badge">
          {loading ? (
            <span>Loading...</span>
          ) : (
            <span>{validFacilities.length} facilities</span>
          )}
        </div>
      </div>

      <div className="state-map-content" onMouseMove={handleFacilityMouseMove}>
        {loading ? (
          <div className="state-map-loading">
            <Loader size={32} className="spin" />
            <span>Loading facility locations...</span>
          </div>
        ) : error ? (
          <div className="state-map-error">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                center: viewConfig.center,
                scale: viewConfig.scale
              }}
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              <ZoomableGroup
                center={viewConfig.center}
                zoom={1}
                minZoom={0.5}
                maxZoom={4}
              >
                {/* State boundary */}
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies
                      .filter(geo => geo.id === stateFips)
                      .map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="#E2E8F0"
                          stroke="#94A3B8"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      ))
                  }
                </Geographies>

                {/* Facility markers */}
                {validFacilities.map((facility) => (
                  <Marker
                    key={facility.ccn}
                    coordinates={[facility.longitude, facility.latitude]}
                  >
                    <circle
                      r={5}
                      className="facility-marker"
                      onMouseEnter={(e) => handleFacilityMouseEnter(facility, e)}
                      onMouseLeave={handleFacilityMouseLeave}
                      onClick={() => handleFacilityClick(facility)}
                    />
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            <FacilityTooltip facility={tooltipData} position={tooltipPosition} />
          </>
        )}
      </div>

      <div className="state-map-legend">
        <div className="legend-item">
          <span className="legend-dot"></span>
          <span>Facility with ownership change</span>
        </div>
        <span className="legend-hint">Scroll to zoom, drag to pan</span>
      </div>
    </div>
  );
};

export default StateDetailMap;
