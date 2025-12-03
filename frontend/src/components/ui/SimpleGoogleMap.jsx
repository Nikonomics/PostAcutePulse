import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194
};

const SimpleGoogleMap = ({ 
  locations = [], 
  center = defaultCenter, 
  zoom = 10,
  height = '400px',
  showInfoWindows = true,
  customMarkerIcon = null,
  onMarkerClick = null
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'
  });

  // Memoize marker data to prevent unnecessary re-renders
  const markerData = useMemo(() => {
    return locations.map((location, index) => ({
      ...location,
      markerId: `${location.lat}-${location.lng}-${index}`
    }));
  }, [locations]);

  // Memoize map options to prevent recreation on every render
  const mapOptions = useMemo(() => {
    const baseOptions = {
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: true,
      fullscreenControl: true,
      minZoom: 8,
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
  }, [isLoaded]); // Add isLoaded dependency to recalculate when API loads

  const onLoad = useCallback((map) => {
    setMap(map);
    
    // Ensure Google Maps API is loaded
    if (!window.google?.maps) {
      console.warn('Google Maps API not fully loaded yet');
      return;
    }
    
    // Fit bounds if locations are provided with better zoom handling
    if (locations.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(location => {
        bounds.extend({ lat: location.lat, lng: location.lng });
      });
      
      // Add some padding to the bounds for better visibility
      map.fitBounds(bounds);
      
      // Set a minimum zoom level to prevent over-zooming
      const listener = window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
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
            if (map.getZoom() < 8) {
              map.setZoom(8);
            }
          });
        }
      });
    } else {
      // If no locations, set a reasonable default zoom
      map.setZoom(zoom);
    }
  }, [locations, zoom]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

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

  const handleMarkerMouseOver = useCallback((location) => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Set a small delay to prevent flickering
    const timeout = setTimeout(() => {
      setHoveredMarker(location);
    }, 200);
    
    setHoverTimeout(timeout);
  }, [hoverTimeout]);

  const handleMarkerMouseOut = useCallback(() => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Hide tooltip immediately on mouse out
    setHoveredMarker(null);
  }, [hoverTimeout]);

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
    <div className="w-full relative">
      <GoogleMap
        mapContainerStyle={{ ...containerStyle, height }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Render markers for each location */}
        {markerData.map((location) => (
          <Marker
            key={location.markerId}
            position={{ lat: location.lat, lng: location.lng }}
            onClick={(marker) => handleMarkerClick(marker, location)}
            onMouseOver={() => handleMarkerMouseOver(location)}
            onMouseOut={handleMarkerMouseOut}
            icon={customMarkerIcon}
            title={location.title || `Location`}
          />
        ))}

        {/* Info Window for selected marker */}
        {showInfoWindows && selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2">
              <h3 className="font-semibold text-gray-900 mb-1">
                {selectedMarker.title || 'Location'}
              </h3>
              {selectedMarker.description && (
                <p className="text-gray-600 text-sm mb-2">
                  {selectedMarker.description}
                </p>
              )}
              {selectedMarker.value && (
                <p className="text-sm font-medium text-green-600 mb-2">
                  {selectedMarker.value}
                </p>
              )}
              <div className="text-xs text-gray-500">
                <p>Lat: {selectedMarker.lat.toFixed(6)}</p>
                <p>Lng: {selectedMarker.lng.toFixed(6)}</p>
                {selectedMarker.status && (
                  <p className="mt-1">
                    Status: <span className="capitalize">{selectedMarker.status.replace('_', ' ')}</span>
                  </p>
                )}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Hover Tooltip */}
      {hoveredMarker && (
        <div 
          className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-xl p-3 max-w-xs pointer-events-none backdrop-blur-sm bg-white/95"
          style={{
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            maxWidth: '280px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          {/* Arrow pointing to marker */}
          <div 
            className="absolute w-3 h-3 bg-white border-l border-t border-gray-200 transform rotate-45"
            style={{
              left: '50%',
              top: '-6px',
              transform: 'translateX(-50%) rotate(45deg)'
            }}
          />
          
          <div className="text-sm font-semibold text-gray-900 mb-2 truncate border-b border-gray-100 pb-1">
            {hoveredMarker.title || 'Location'}
          </div>
          {hoveredMarker.address && (
            <div className="text-xs text-gray-600 mb-2 truncate">
              📍 {hoveredMarker.address}
            </div>
          )}
          {hoveredMarker.city && hoveredMarker.state && (
            <div className="text-xs text-gray-600 mb-2">
              🏙️ {hoveredMarker.city}, {hoveredMarker.state}
            </div>
          )}
          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded">
            <div className="flex justify-between">
              <span>Latitude:</span>
              <span className="font-mono">{hoveredMarker.lat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Longitude:</span>
              <span className="font-mono">{hoveredMarker.lng.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleGoogleMap;
