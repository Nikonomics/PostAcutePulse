import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '../../context/GoogleMapsContext';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '400px'
};

// Default center for USA
const defaultCenter = {
  lat: 39.8283, // Center of USA
  lng: -98.5795
};

// Color palette for different deals/companies
const DEAL_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
  '#6B7280', // Gray
];

// Status colors
const STATUS_COLORS = {
  pipeline: '#F59E0B', // Yellow
  due_diligence: '#3B82F6', // Blue
  hold: '#EF4444', // Red
  current_operations: '#10B981', // Green
};

// Service line colors (for Cascadia facilities)
const SERVICE_LINE_COLORS = {
  SNF: '#3B82F6', // Blue
  ALF: '#10B981', // Green
  ILF: '#8B5CF6', // Purple
  'Home Office': '#6B7280', // Gray
};

// Create custom marker icons for each color
const createMarkerIcon = (color) => ({
  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
  fillColor: color,
  fillOpacity: 0.95,
  strokeColor: '#FFFFFF',
  strokeWeight: 2,
  scale: 8,
});

const DealLocationsMap = ({
  deals = [],
  center = defaultCenter,
  zoom = 4,
  height = '500px',
  showInfoWindows = true,
  onMarkerClick = null,
  onFiltersChange = null,
  filterOptions = null
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedDeals, setSelectedDeals] = useState(new Set());
  const [dealColors, setDealColors] = useState({});
  const mapRef = useRef(null);
  const shouldAutoSelectRef = useRef(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState(new Set());
  const [serviceLineFilter, setServiceLineFilter] = useState(new Set());
  const [companyFilter, setCompanyFilter] = useState(new Set());
  const [teamFilter, setTeamFilter] = useState(new Set());

  // Collapsible filter sections
  const [expandedFilters, setExpandedFilters] = useState({
    status: true,
    serviceLine: false,
    company: false,
    team: false
  });

  // Custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f8fafc;
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 #f8fafc;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Use shared Google Maps context
  const { isLoaded, loadError } = useGoogleMaps();

  // Assign colors to deals
  useEffect(() => {
    const colors = {};
    deals.forEach((deal, index) => {
      // Use status color for status-based coloring, or cycle through colors
      colors[deal.id] = STATUS_COLORS[deal.deal_status] || DEAL_COLORS[index % DEAL_COLORS.length];
    });
    setDealColors(colors);
  }, [deals]);

  // Auto-select all deals when filter is applied and deals are updated
  useEffect(() => {
    if (shouldAutoSelectRef.current && deals.length > 0) {
      const allDealIds = new Set(deals.map(deal => deal.id));
      setSelectedDeals(allDealIds);
      shouldAutoSelectRef.current = false;
    }
  }, [deals]);

  // Notify parent when filters change
  const notifyFiltersChange = useCallback((newFilters) => {
    if (onFiltersChange) {
      // Set flag to auto-select all deals when they are loaded
      const hasAnyFilter = Object.values(newFilters).some(arr => arr.length > 0);
      shouldAutoSelectRef.current = hasAnyFilter;
      onFiltersChange(newFilters);
    }
  }, [onFiltersChange]);

  // Memoize marker data to prevent unnecessary re-renders
  const markerData = useMemo(() => {
    const markers = [];
    deals.forEach(deal => {
      if (deal.deal_facility && Array.isArray(deal.deal_facility)) {
        deal.deal_facility.forEach(facility => {
          if (facility.latitude && facility.longitude &&
            !isNaN(facility.latitude) && !isNaN(facility.longitude) &&
            facility.latitude !== 0 && facility.longitude !== 0) {
            // For Cascadia facilities (current_operations), use service line color
            // For deals, use status color
            let markerColor;
            if (deal.source === 'cascadia' || deal.deal_status === 'current_operations') {
              markerColor = SERVICE_LINE_COLORS[facility.type] || SERVICE_LINE_COLORS['SNF'];
            } else {
              markerColor = dealColors[deal.id] || STATUS_COLORS[deal.deal_status] || DEAL_COLORS[0];
            }

            const marker = {
              id: `${deal.id}-${facility.id}`,
              lat: parseFloat(facility.latitude),
              lng: parseFloat(facility.longitude),
              title: facility.facility_name || `Facility ${facility.id}`,
              address: facility.address || '',
              city: facility.city || '',
              state: facility.state || '',
              dealId: deal.id,
              dealName: deal.deal_name,
              dealStatus: deal.deal_status,
              facilityId: facility.id,
              color: markerColor,
              type: facility.type || 'SNF',
              company: facility.company,
              team: facility.team,
              beds: facility.beds,
              source: deal.source
            };
            markers.push(marker);
          }
        });
      }
    });
    return markers;
  }, [deals, dealColors]);

  // Filter markers based on selected deals
  const visibleMarkers = useMemo(() => {
    if (selectedDeals.size === 0) return [];
    return markerData.filter(marker => selectedDeals.has(marker.dealId));
  }, [markerData, selectedDeals]);

  // Memoize map options to prevent recreation on every render
  const mapOptions = useMemo(() => {
    const baseOptions = {
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: true,
      fullscreenControl: true,
      minZoom: 3,
      maxZoom: 18,
      gestureHandling: 'cooperative',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        },
        {
          featureType: 'transit',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    };

    if (window.google?.maps) {
      baseOptions.zoomControlOptions = {
        position: window.google.maps.ControlPosition.RIGHT_TOP
      };
      baseOptions.mapTypeControlOptions = {
        position: window.google.maps.ControlPosition.TOP_LEFT,
        style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU
      };
    }

    return baseOptions;
  }, []);

  const onLoad = useCallback((map) => {
    if (!window.google?.maps) return;

    if (visibleMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      visibleMarkers.forEach(marker => {
        bounds.extend({ lat: marker.lat, lng: marker.lng });
      });
      map.fitBounds(bounds);

      window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        if (map.getZoom() < 3) map.setZoom(3);
      });
    } else {
      map.setZoom(zoom);
    }
  }, [visibleMarkers, zoom]);

  const onUnmount = useCallback(() => {}, []);

  const handleMarkerClick = useCallback((marker, location) => {
    if (onMarkerClick) {
      onMarkerClick(marker, location);
    }
    if (showInfoWindows) {
      setSelectedMarker(location);
    }
  }, [onMarkerClick, showInfoWindows]);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  const toggleDealSelection = useCallback((dealId) => {
    const newSelectedDeals = new Set(selectedDeals);
    if (newSelectedDeals.has(dealId)) {
      newSelectedDeals.delete(dealId);
    } else {
      newSelectedDeals.add(dealId);
    }
    setSelectedDeals(newSelectedDeals);
  }, [selectedDeals]);

  const selectAllDeals = useCallback(() => {
    const allDealIds = new Set(deals.map(deal => deal.id));
    setSelectedDeals(allDealIds);
  }, [deals]);

  const clearAllDeals = useCallback(() => {
    setSelectedDeals(new Set());
  }, []);

  // Filter toggle handlers
  const handleFilterToggle = useCallback((filterType, value) => {
    const setters = {
      status: setStatusFilter,
      serviceLine: setServiceLineFilter,
      company: setCompanyFilter,
      team: setTeamFilter
    };
    const filters = {
      status: statusFilter,
      serviceLine: serviceLineFilter,
      company: companyFilter,
      team: teamFilter
    };

    const setter = setters[filterType];
    const currentFilter = filters[filterType];
    const newFilter = new Set(currentFilter);

    if (newFilter.has(value)) {
      newFilter.delete(value);
    } else {
      newFilter.add(value);
    }
    setter(newFilter);

    // Build updated filters object
    const updatedFilters = {
      status: filterType === 'status' ? Array.from(newFilter) : Array.from(statusFilter),
      serviceLine: filterType === 'serviceLine' ? Array.from(newFilter) : Array.from(serviceLineFilter),
      company: filterType === 'company' ? Array.from(newFilter) : Array.from(companyFilter),
      team: filterType === 'team' ? Array.from(newFilter) : Array.from(teamFilter)
    };

    notifyFiltersChange(updatedFilters);
  }, [statusFilter, serviceLineFilter, companyFilter, teamFilter, notifyFiltersChange]);

  const clearAllFilters = useCallback(() => {
    setStatusFilter(new Set());
    setServiceLineFilter(new Set());
    setCompanyFilter(new Set());
    setTeamFilter(new Set());
    setSelectedDeals(new Set());
    shouldAutoSelectRef.current = false;
    notifyFiltersChange({ status: [], serviceLine: [], company: [], team: [] });
  }, [notifyFiltersChange]);

  const toggleFilterSection = useCallback((section) => {
    setExpandedFilters(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const activeFilterCount = statusFilter.size + serviceLineFilter.size + companyFilter.size + teamFilter.size;

  // Filter section component
  const FilterSection = ({ title, filterKey, options, currentFilter }) => (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => toggleFilterSection(filterKey)}
        className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {title}
          {currentFilter.size > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
              {currentFilter.size}
            </span>
          )}
        </span>
        {expandedFilters[filterKey] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expandedFilters[filterKey] && (
        <div className="px-2 pb-1 space-y-0.5">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 py-0.5 px-1 rounded text-sm"
            >
              <input
                type="checkbox"
                checked={currentFilter.has(option.value)}
                onChange={() => handleFilterToggle(filterKey, option.value)}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-gray-700 select-none truncate">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  // Default filter options
  const defaultFilterOptions = {
    statuses: [
      { value: 'pipeline', label: 'Pipeline' },
      { value: 'due_diligence', label: 'Due Diligence' },
      { value: 'hold', label: 'Hold' },
      { value: 'current_operations', label: 'Current Operations' }
    ],
    serviceLines: [
      { value: 'SNF', label: 'SNF' },
      { value: 'ALF', label: 'ALF' },
      { value: 'ILF', label: 'ILF' },
      { value: 'Home Office', label: 'Home Office' }
    ],
    companies: [],
    teams: []
  };

  const options = filterOptions || defaultFilterOptions;

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600">Error loading Google Maps</p>
        <p className="text-red-500 text-sm">Please check your API key and internet connection</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading Google Maps...</p>
      </div>
    );
  }

  if (!window.google?.maps) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-600">Google Maps API is still initializing...</p>
        <p className="text-yellow-500 text-sm">Please wait a moment</p>
      </div>
    );
  }

  return (
    <div className="w-full flex gap-4">
      {/* Sidebar */}
      <div className="w-80 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden" style={{ height }}>
        {/* Header */}
        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Property Locations</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAllDeals}
              className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium"
            >
              Select All
            </button>
            <button
              onClick={clearAllDeals}
              className="flex-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Filters */}
          <div className="border-b border-gray-200">
            <div className="p-2 flex items-center justify-between bg-gray-50 sticky top-0 z-10">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  <X size={12} />
                  Clear All
                </button>
              )}
            </div>

            <FilterSection
              title="Status"
              filterKey="status"
              options={options.statuses}
              currentFilter={statusFilter}
            />
            <FilterSection
              title="Service Line"
              filterKey="serviceLine"
              options={options.serviceLines}
              currentFilter={serviceLineFilter}
            />
            {options.companies?.length > 0 && (
              <FilterSection
                title="Company"
                filterKey="company"
                options={options.companies}
                currentFilter={companyFilter}
              />
            )}
            {options.teams?.length > 0 && (
              <FilterSection
                title="Team"
                filterKey="team"
                options={options.teams}
                currentFilter={teamFilter}
              />
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 text-center flex-shrink-0">
          {visibleMarkers.length} markers on map
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <GoogleMap
          mapContainerStyle={{ ...containerStyle, height }}
          center={center}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {visibleMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={(markerElement) => handleMarkerClick(markerElement, marker)}
              icon={createMarkerIcon(marker.color)}
              title={marker.title}
            />
          ))}

          {showInfoWindows && selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={handleInfoWindowClose}
            >
              <div className="p-2 max-w-xs">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {selectedMarker.title}
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: selectedMarker.color }}
                    />
                    <span className="font-medium text-gray-700">
                      {selectedMarker.dealName}
                    </span>
                  </div>
                  {selectedMarker.type && (
                    <p className="text-gray-600">Type: {selectedMarker.type}</p>
                  )}
                  {selectedMarker.company && (
                    <p className="text-gray-600">Company: {selectedMarker.company}</p>
                  )}
                  {selectedMarker.team && (
                    <p className="text-gray-600">Team: {selectedMarker.team}</p>
                  )}
                  {selectedMarker.beds && (
                    <p className="text-gray-600">Beds: {selectedMarker.beds}</p>
                  )}
                  {selectedMarker.address && (
                    <p className="text-gray-600">{selectedMarker.address}</p>
                  )}
                  {selectedMarker.city && selectedMarker.state && (
                    <p className="text-gray-600">{selectedMarker.city}, {selectedMarker.state}</p>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
};

export default DealLocationsMap;
