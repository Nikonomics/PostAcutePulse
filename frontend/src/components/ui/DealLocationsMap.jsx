import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

// Default center for USA
const defaultCenter = {
  lat: 39.8283, // Center of USA
  lng: -98.5795
};

// Color palette for different deals
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
  onStatusFilterChange = null
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  // Remove tooltip-related state
  // const [hoveredMarker, setHoveredMarker] = useState(null);
  // const [hoverTooltipPos, setHoverTooltipPos] = useState(null);
  // const [hoverTimeout, setHoverTimeout] = useState(null);
  const [selectedDeals, setSelectedDeals] = useState(new Set());
  const [dealColors, setDealColors] = useState({});
  const [statusFilter, setStatusFilter] = useState(new Set());
  const mapRef = useRef(null);
  const shouldAutoSelectRef = useRef(false);

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

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'
  });

  // Assign colors to deals
  useEffect(() => {
    const colors = {};
    deals.forEach((deal, index) => {
      colors[deal.id] = DEAL_COLORS[index % DEAL_COLORS.length];
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

  // Memoize marker data to prevent unnecessary re-renders
  const markerData = useMemo(() => {
    const markers = [];
    deals.forEach(deal => {
      if (deal.deal_facility && Array.isArray(deal.deal_facility)) {
        deal.deal_facility.forEach(facility => {
          if (facility.latitude && facility.longitude &&
            !isNaN(facility.latitude) && !isNaN(facility.longitude) &&
            facility.latitude !== 0 && facility.longitude !== 0) {
            const marker = {
              id: `${deal.id}-${facility.id}`,
              lat: facility.latitude,
              lng: facility.longitude,
              title: facility.facility_name || `Facility ${facility.id}`,
              address: facility.address || '',
              city: facility.city || '',
              state: facility.state || '',
              dealId: deal.id,
              dealName: deal.deal_name,
              facilityId: facility.id,
              color: dealColors[deal.id] || DEAL_COLORS[0],
              type: 'facility'
            };
            markers.push(marker);
          }
        });
      } else {
        console.log('Deal has no facilities or invalid facility structure:', deal);
      }
    });

    console.log('Total markers created:', markers.length);
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
      minZoom: 3, // Allow zooming out to see entire USA
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

    // Add Google Maps specific options only when API is loaded
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
  }, []); // Remove isLoaded dependency as it's not needed

  const onLoad = useCallback((map) => {

    // Ensure Google Maps API is loaded
    if (!window.google?.maps) {
      console.warn('Google Maps API not fully loaded yet');
      return;
    }

    // Fit bounds if locations are provided with better zoom handling
    if (visibleMarkers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      visibleMarkers.forEach(marker => {
        bounds.extend({ lat: marker.lat, lng: marker.lng });
      });

      // Add some padding to the bounds for better visibility
      map.fitBounds(bounds);

      // Set a minimum zoom level to prevent over-zooming
      window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        // Add padding to bounds for better visibility
        const currentBounds = map.getBounds();
        if (currentBounds) {
          const ne = currentBounds.getNorthEast();
          const sw = currentBounds.getSouthWest();
          const latSpan = ne.lat() - sw.lat();
          const lngSpan = ne.lng() - sw.lng();

          // Add 20% padding
          const latPadding = latSpan * 0.2;
          const lngPadding = lngSpan * 0.2;

          const newBounds = new window.google.maps.LatLngBounds(
            { lat: sw.lat() - latPadding, lng: sw.lng() - lngPadding },
            { lat: ne.lat() + latPadding, lng: ne.lng() + lngPadding }
          );

          map.fitBounds(newBounds);

          // Set zoom limits after bounds are set
          window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            if (map.getZoom() > 15) {
              map.setZoom(15);
            }
            if (map.getZoom() < 3) {
              map.setZoom(3);
            }
          });
        }
      });
    } else {
      // If no locations, set a reasonable default zoom for USA view
      map.setZoom(zoom);
    }
  }, [visibleMarkers, zoom]);

  const onUnmount = useCallback(() => {
  }, []);

  // Remove tooltip cleanup effect
  // useEffect(() => {
  //   return () => {
  //     if (hoverTimeout) {
  //       clearTimeout(hoverTimeout);
  //     }
  //   };
  // }, [hoverTimeout]);

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

  // Remove tooltip handlers
  // const handleMarkerMouseOver = useCallback((location) => {
  //   if (hoverTimeout) {
  //     clearTimeout(hoverTimeout);
  //   }
  //   const timeout = setTimeout(() => {
  //     setHoveredMarker(location);
  //   }, 200);
  //   setHoverTimeout(timeout);
  // }, [hoverTimeout]);

  // const handleMarkerMouseOut = useCallback(() => {
  //   if (hoverTimeout) {
  //     clearTimeout(hoverTimeout);
  //   }
  //   setHoveredMarker(null);
  // }, [hoverTimeout]);

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

  const handleStatusFilterToggle = useCallback((status) => {
    const newStatusFilter = new Set(statusFilter);
    if (newStatusFilter.has(status)) {
      newStatusFilter.delete(status);
    } else {
      newStatusFilter.add(status);
    }
    setStatusFilter(newStatusFilter);
    
    // If filter becomes empty, clear selected deals
    if (newStatusFilter.size === 0) {
      setSelectedDeals(new Set());
      shouldAutoSelectRef.current = false;
    } else {
      // Set flag to auto-select all deals when they are loaded
      shouldAutoSelectRef.current = true;
    }
    
    // Notify parent component to fetch deals with new status(es)
    if (onStatusFilterChange) {
      onStatusFilterChange(newStatusFilter.size > 0 ? Array.from(newStatusFilter) : null);
    }
  }, [onStatusFilterChange, statusFilter]);

  const clearStatusFilter = useCallback(() => {
    setStatusFilter(new Set());
    // Clear selected deals when filter is cleared
    setSelectedDeals(new Set());
    shouldAutoSelectRef.current = false;
    if (onStatusFilterChange) {
      onStatusFilterChange(null);
    }
  }, [onStatusFilterChange]);

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

  // Additional check to ensure Google Maps API is fully available
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
      {/* Deals List Sidebar */}
      <div className="w-80 bg-white rounded-lg border border-gray-200 p-4 h-fit shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Deals</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllDeals}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              Select All
            </button>
            <button
              onClick={clearAllDeals}
              className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 active:bg-gray-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Status Filter Multiselect */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Filter by Status
            </label>
            {statusFilter.size > 0 && (
              <button
                onClick={clearStatusFilter}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-2 border border-gray-300 rounded-md p-2 bg-white">
            {[
              { value: 'pipeline', label: 'Pipeline' },
              { value: 'due_diligence', label: 'Due Diligence' },
              { value: 'hold', label: 'Hold' },
              { value: 'closed', label: 'Current Operations' }
            ].map((status) => (
              <label
                key={status.value}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={statusFilter.has(status.value)}
                  onChange={() => handleStatusFilterToggle(status.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <span className="text-sm text-gray-700 select-none">{status.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Scrollable deals list with proper styling */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {deals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600">No deals available</p>
              <p className="text-xs text-gray-400 mt-1">Deals will appear here when available</p>
            </div>
          ) : (
            deals.map((deal) => {
              const isSelected = selectedDeals.has(deal.id);
              const color = dealColors[deal.id] || DEAL_COLORS[0];
              const facilityCount = deal.deal_facility?.length || 0;

              return (
                <div
                  key={deal.id}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                  onClick={() => toggleDealSelection(deal.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {deal.deal_name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {facilityCount} facilit{facilityCount !== 1 ? 'ies' : 'y'}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="text-blue-600 flex-shrink-0">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Map Component */}
      <div className="flex-1 relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <GoogleMap
          mapContainerStyle={{ ...containerStyle, height }}
          center={center}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={mapOptions}
        >
          {/* Render markers for each visible facility */}
          {visibleMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={(markerElement) => handleMarkerClick(markerElement, marker)}
              // Remove tooltip handlers
              // onMouseOver={() => handleMarkerMouseOver(marker)}
              // onMouseOut={handleMarkerMouseOut}
              icon={createMarkerIcon(marker.color)}
              title={marker.title}
            />
          ))}

          {/* Info Window for selected marker */}
          {showInfoWindows && selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={handleInfoWindowClose}
            >
              <div className="p-2.5 max-w-xs">
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                  {selectedMarker.title}
                </h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedMarker.color }}
                    />
                    <span className="text-xs font-medium text-gray-700">
                      {selectedMarker.dealName}
                    </span>
                  </div>
                  {selectedMarker.address && (
                    <p className="text-xs text-gray-600">
                      📍 {selectedMarker.address}
                    </p>
                  )}
                  {selectedMarker.city && selectedMarker.state && (
                    <p className="text-xs text-gray-600">
                      🏙️ {selectedMarker.city}, {selectedMarker.state}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 space-y-0.5 bg-gray-50 p-1.5 rounded">
                    <div className="flex justify-between">
                      <span>Lat:</span>
                      <span className="font-mono">{selectedMarker.lat.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lng:</span>
                      <span className="font-mono">{selectedMarker.lng.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Hover Tooltip removed */}
      </div>
    </div>
  );
};

export default DealLocationsMap;
