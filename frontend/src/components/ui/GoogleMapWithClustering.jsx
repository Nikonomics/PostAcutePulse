import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194
};

const GoogleMapWithClustering = ({ 
  locations = [], 
  center = defaultCenter, 
  zoom = 10,
  height = '400px',
  showInfoWindows = true,
  customMarkerIcon = null,
  onMarkerClick = null,
  clusterOptions = {},
  enableClustering = true
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);
  const clustererRef = useRef(null);
  const markersRef = useRef([]);

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

  const onLoad = useCallback((map) => {
    setMap(map);
    
    // Fit bounds if locations are provided
    if (locations.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(location => {
        bounds.extend({ lat: location.lat, lng: location.lng });
      });
      map.fitBounds(bounds);
    }
  }, [locations]);

  const onUnmount = useCallback(() => {
    setMap(null);
    // Clean up clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
  }, []);

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

  // Initialize clustering when map and locations are ready
  useEffect(() => {
    if (!map || !enableClustering || !window.google || locations.length === 0) {
      return;
    }

    // Clean up existing clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    // Create markers
    const markers = locations.map((location) => {
      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: location.title || 'Location',
        icon: customMarkerIcon,
        clickable: true
      });

      // Add click listener
      marker.addListener('click', () => {
        handleMarkerClick(marker, location);
      });

      return marker;
    });

    markersRef.current = markers;

    // Create clusterer
    try {
      // Dynamically import MarkerClusterer to avoid constructor issues
      import('@googlemaps/markerclusterer').then(({ MarkerClusterer }) => {
        if (map && markers.length > 0) {
          clustererRef.current = new MarkerClusterer({
            map,
            markers,
            renderer: {
              render: ({ count, position }) => {
                const div = document.createElement('div');
                div.style.backgroundColor = '#1976d2';
                div.style.borderRadius = '50%';
                div.style.color = 'white';
                div.style.fontSize = '14px';
                div.style.fontWeight = 'bold';
                div.style.height = '40px';
                div.style.lineHeight = '40px';
                div.style.textAlign = 'center';
                div.style.width = '40px';
                div.style.border = '2px solid white';
                div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
                div.textContent = count;

                // Add hover effect
                div.addEventListener('mouseenter', () => {
                  div.style.backgroundColor = '#1565c0';
                  div.style.transform = 'scale(1.1)';
                });

                div.addEventListener('mouseleave', () => {
                  div.style.backgroundColor = '#1976d2';
                  div.style.transform = 'scale(1)';
                });

                return div;
              }
            },
            ...clusterOptions
          });
        }
      }).catch(error => {
        console.warn('MarkerClusterer failed to load, falling back to regular markers:', error);
        // Fallback: show markers without clustering
        markers.forEach(marker => marker.setMap(map));
      });
    } catch (error) {
      console.warn('Failed to initialize clustering:', error);
      // Fallback: show markers without clustering
      markers.forEach(marker => marker.setMap(map));
    }

    // Cleanup function
    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markers.forEach(marker => marker.setMap(null));
    };
  }, [map, locations, enableClustering, customMarkerIcon, handleMarkerClick, clusterOptions]);

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

  return (
    <div className="w-full">
      <GoogleMap
        mapContainerStyle={{ ...containerStyle, height }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        }}
      >
        {/* Markers are handled by the clustering logic in useEffect */}
        
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
    </div>
  );
};

export default GoogleMapWithClustering;
