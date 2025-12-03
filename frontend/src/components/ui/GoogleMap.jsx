import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 37.7749, // San Francisco default
  lng: -122.4194
};

const GoogleMapComponent = ({ 
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

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE'
  });

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
        }}
      >
        {/* Render markers for each location */}
        {locations.map((location, index) => (
          <Marker
            key={`${location.lat}-${location.lng}-${index}`}
            position={{ lat: location.lat, lng: location.lng }}
            onClick={(marker) => handleMarkerClick(marker, location)}
            icon={customMarkerIcon}
            title={location.title || `Location ${index + 1}`}
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
              <div className="text-xs text-gray-500">
                <p>Lat: {selectedMarker.lat.toFixed(6)}</p>
                <p>Lng: {selectedMarker.lng.toFixed(6)}</p>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default GoogleMapComponent;
