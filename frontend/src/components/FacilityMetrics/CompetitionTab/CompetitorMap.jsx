import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { Building2, Navigation, Star, Users } from 'lucide-react';
import { useGoogleMaps } from '../../../context/GoogleMapsContext';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.5rem'
};

const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795
};

const getRatingColor = (rating) => {
  const colors = {
    5: '#22c55e',
    4: '#84cc16',
    3: '#eab308',
    2: '#f97316',
    1: '#ef4444'
  };
  return colors[rating] || '#9ca3af';
};

const CompetitorMap = ({ facility, competitors, onCompetitorClick }) => {
  const { isLoaded } = useGoogleMaps();
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Set map center from facility coordinates
  useEffect(() => {
    if (facility?.latitude && facility?.longitude) {
      setMapCenter({
        lat: parseFloat(facility.latitude),
        lng: parseFloat(facility.longitude)
      });
    }
  }, [facility?.latitude, facility?.longitude]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  // Fit bounds to show all markers
  useEffect(() => {
    if (!map || !facility?.latitude || !window.google) return;

    const bounds = new window.google.maps.LatLngBounds();

    // Add main facility
    bounds.extend({
      lat: parseFloat(facility.latitude),
      lng: parseFloat(facility.longitude)
    });

    // Add competitors
    competitors.forEach(comp => {
      if (comp.latitude && comp.longitude) {
        bounds.extend({
          lat: parseFloat(comp.latitude),
          lng: parseFloat(comp.longitude)
        });
      }
    });

    if (competitors.length > 0) {
      map.fitBounds(bounds, { padding: 60 });
    } else {
      map.setCenter({
        lat: parseFloat(facility.latitude),
        lng: parseFloat(facility.longitude)
      });
      map.setZoom(13);
    }
  }, [map, facility, competitors]);

  // Handle clicking on a competitor in the info window
  const handleViewDetails = (competitor) => {
    setSelectedMarker(null);
    if (onCompetitorClick) {
      onCompetitorClick(competitor);
    }
  };

  if (!isLoaded) {
    return (
      <div className="map-loading">
        <div className="map-loading-spinner" />
        <span>Loading map...</span>
      </div>
    );
  }

  const hasCoordinates = facility?.latitude && facility?.longitude;

  if (!hasCoordinates) {
    return (
      <div className="map-no-location">
        <Building2 size={32} />
        <p>Location data not available for this facility</p>
      </div>
    );
  }

  return (
    <div className="competitor-map-container">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={12}
        onLoad={onMapLoad}
        options={{
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: window.google?.maps?.ControlPosition?.TOP_RIGHT
          },
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        }}
      >
        {/* Main facility marker - larger with border */}
        <Marker
          position={{
            lat: parseFloat(facility.latitude),
            lng: parseFloat(facility.longitude)
          }}
          icon={{
            path: window.google?.maps?.SymbolPath?.CIRCLE,
            scale: 14,
            fillColor: getRatingColor(facility.overall_rating),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 4
          }}
          onClick={() => setSelectedMarker({ ...facility, isMain: true })}
          zIndex={1000}
        />

        {/* Competitor markers */}
        {competitors.map((comp) => (
          comp.latitude && comp.longitude && (
            <Marker
              key={comp.ccn}
              position={{
                lat: parseFloat(comp.latitude),
                lng: parseFloat(comp.longitude)
              }}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE,
                scale: 9,
                fillColor: getRatingColor(comp.overall_rating),
                fillOpacity: 0.85,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }}
              onClick={() => setSelectedMarker(comp)}
              zIndex={100}
            />
          )
        ))}

        {/* Info window */}
        {selectedMarker && (
          <InfoWindow
            position={{
              lat: parseFloat(selectedMarker.latitude),
              lng: parseFloat(selectedMarker.longitude)
            }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="competitor-info-window">
              <div className="info-window-header">
                <div
                  className="info-rating-badge"
                  style={{ backgroundColor: getRatingColor(selectedMarker.overall_rating) }}
                >
                  <Star size={10} />
                  {selectedMarker.overall_rating || '?'}
                </div>
                <div className="info-window-title">
                  <span className="info-name">
                    {selectedMarker.provider_name || selectedMarker.facility_name}
                  </span>
                  {selectedMarker.isMain && (
                    <span className="info-selected-badge">Selected Facility</span>
                  )}
                  <span className="info-location">
                    {selectedMarker.city}, {selectedMarker.state}
                  </span>
                </div>
              </div>

              <div className="info-window-details">
                <div className="info-detail">
                  <Users size={12} />
                  <span>{selectedMarker.certified_beds || 'N/A'} beds</span>
                </div>
                {selectedMarker.distance_miles && !selectedMarker.isMain && (
                  <div className="info-detail">
                    <Navigation size={12} />
                    <span>{selectedMarker.distance_miles} mi away</span>
                  </div>
                )}
              </div>

              {!selectedMarker.isMain && (
                <button
                  className="info-view-button"
                  onClick={() => handleViewDetails(selectedMarker)}
                >
                  View Details
                </button>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <div
            className="legend-marker main"
            style={{ backgroundColor: getRatingColor(facility.overall_rating) }}
          />
          <span>Selected facility</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker competitor" />
          <span>Competitor</span>
        </div>
        <div className="legend-ratings">
          <span className="legend-label">Rating:</span>
          {[5, 4, 3, 2, 1].map((rating) => (
            <div
              key={rating}
              className="legend-rating-dot"
              style={{ backgroundColor: getRatingColor(rating) }}
              title={`${rating} star${rating !== 1 ? 's' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompetitorMap;
