import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { Loader, AlertCircle, Building2, MapPin, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// US TopoJSON URL
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

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

/**
 * Facility Tooltip Component
 */
const FacilityTooltip = ({ facility, position }) => {
  if (!facility) return null;

  const isAcquired = facility.transactionType === 'acquired';
  const isDivested = facility.transactionType === 'divested';

  return (
    <div
      className="operator-facility-tooltip"
      style={{
        left: position.x + 10,
        top: position.y - 10,
      }}
    >
      <div className="operator-tooltip-header">
        <Building2 size={14} />
        <span className="operator-tooltip-name">{facility.facilityName}</span>
      </div>
      <div className="operator-tooltip-location">
        {facility.city}, {STATE_NAMES[facility.state] || facility.state}
      </div>
      <div className="operator-tooltip-details">
        <div className="tooltip-row">
          <span className="tooltip-label">Beds:</span>
          <span className="tooltip-value">{facility.beds || 'N/A'}</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Type:</span>
          <span className={`tooltip-value transaction-type ${facility.transactionType}`}>
            {isAcquired && <ArrowUpRight size={12} />}
            {isDivested && <ArrowDownRight size={12} />}
            {facility.transactionType === 'acquired' ? 'Acquired' :
             facility.transactionType === 'divested' ? 'Divested' : 'Involved'}
          </span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Date:</span>
          <span className="tooltip-value">
            {new Date(facility.transactionDate).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric'
            })}
          </span>
        </div>
      </div>
      <div className="operator-tooltip-footer">
        Click to view facility details
      </div>
    </div>
  );
};

/**
 * US Map with Facility Dots Component
 * Shows US map outline with dots for each facility
 */
const USMapWithFacilityDots = ({
  facilities,
  loading,
  error,
  operatorName,
  summary
}) => {
  const navigate = useNavigate();
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

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
    navigate(`/facility-metrics/${facility.ccn}`);
  };

  // Filter to only valid coordinates
  const validFacilities = facilities?.filter(f =>
    f.latitude && f.longitude &&
    !isNaN(f.latitude) && !isNaN(f.longitude)
  ) || [];

  // Count by transaction type
  const acquired = validFacilities.filter(f => f.transactionType === 'acquired').length;
  const divested = validFacilities.filter(f => f.transactionType === 'divested').length;

  return (
    <div className="operator-map-container">
      <div className="operator-map-header">
        <div className="operator-map-title">
          <MapPin size={18} />
          <h4>{operatorName} - Transaction Locations</h4>
        </div>
        <div className="operator-map-badges">
          {acquired > 0 && (
            <div className="transaction-badge acquired">
              <ArrowUpRight size={14} />
              <span>{acquired} acquired</span>
            </div>
          )}
          {divested > 0 && (
            <div className="transaction-badge divested">
              <ArrowDownRight size={14} />
              <span>{divested} divested</span>
            </div>
          )}
        </div>
      </div>

      <div className="operator-map-content" onMouseMove={handleFacilityMouseMove}>
        {loading ? (
          <div className="operator-map-loading">
            <Loader size={32} className="spin" />
            <span>Loading facility locations...</span>
          </div>
        ) : error ? (
          <div className="operator-map-error">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        ) : validFacilities.length === 0 ? (
          <div className="operator-map-empty">
            <MapPin size={32} />
            <span>No facilities with location data found</span>
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
                height: '100%',
              }}
            >
              <ZoomableGroup
                center={[-96, 38]}
                zoom={1}
                minZoom={0.5}
                maxZoom={4}
              >
                {/* US state boundaries - light gray */}
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#F3F4F6"
                        stroke="#D1D5DB"
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
                      className={`operator-facility-marker ${facility.transactionType}`}
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

      <div className="operator-map-legend">
        <div className="operator-legend-items">
          <div className="operator-legend-item">
            <span className="legend-dot acquired"></span>
            <span>Acquired</span>
          </div>
          <div className="operator-legend-item">
            <span className="legend-dot divested"></span>
            <span>Divested</span>
          </div>
        </div>
        <div className="operator-legend-summary">
          {summary?.statesPresent?.length > 0 && (
            <span>{summary.statesPresent.length} states • {validFacilities.length} facilities</span>
          )}
        </div>
        <span className="legend-hint">Scroll to zoom, drag to pan</span>
      </div>
    </div>
  );
};

export default USMapWithFacilityDots;
