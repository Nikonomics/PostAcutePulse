import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { MapPin, Star, Building2, Navigation } from 'lucide-react';
import { useGoogleMaps } from '../../../context/GoogleMapsContext';
import { getFacilityCompetitors } from '../../../api/facilityService';

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.375rem'
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

const FacilityMapCard = ({ facility }) => {
  const { isLoaded } = useGoogleMaps();
  const [competitors, setCompetitors] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [map, setMap] = useState(null);

  // Load competitors when facility changes
  useEffect(() => {
    if (!facility?.ccn) return;

    // Set map center from facility coordinates
    if (facility.latitude && facility.longitude) {
      setMapCenter({
        lat: parseFloat(facility.latitude),
        lng: parseFloat(facility.longitude)
      });
    }

    // Fetch competitors
    setIsLoading(true);
    getFacilityCompetitors(facility.ccn, 15, 15)
      .then(response => {
        if (response.success) {
          setCompetitors(response.competitors || []);
        }
      })
      .catch(error => {
        console.error('Error fetching competitors:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [facility?.ccn, facility?.latitude, facility?.longitude]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  // Fit bounds to show all markers
  useEffect(() => {
    if (!map || !facility?.latitude) return;

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
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [map, facility, competitors]);

  if (!facility) return null;

  const hasCoordinates = facility.latitude && facility.longitude;

  return (
    <div className="metrics-card facility-map-card">
      <div className="metrics-card-header">
        <MapPin size={18} className="status-neutral" />
        <h4>Location & Competitors</h4>
        {competitors.length > 0 && (
          <span className="competitor-count">{competitors.length} nearby</span>
        )}
      </div>

      {!isLoaded ? (
        <div className="map-loading">Loading map...</div>
      ) : !hasCoordinates ? (
        <div className="map-no-location">
          <MapPin size={24} />
          <p>Location data not available for this facility</p>
        </div>
      ) : (
        <div className="map-container">
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
              fullscreenControl: true
            }}
          >
            {/* Main facility marker */}
            <Marker
              position={{
                lat: parseFloat(facility.latitude),
                lng: parseFloat(facility.longitude)
              }}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE,
                scale: 12,
                fillColor: getRatingColor(facility.overall_rating),
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
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
                    scale: 8,
                    fillColor: getRatingColor(comp.overall_rating),
                    fillOpacity: 0.8,
                    strokeColor: '#ffffff',
                    strokeWeight: 2
                  }}
                  onClick={() => setSelectedMarker(comp)}
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
                <div className="map-info-window">
                  <div className="info-header">
                    <div
                      className="info-rating"
                      style={{ backgroundColor: getRatingColor(selectedMarker.overall_rating) }}
                    >
                      {selectedMarker.overall_rating || '?'}
                    </div>
                    <div className="info-title">
                      <span className="info-name">
                        {selectedMarker.provider_name || selectedMarker.facility_name}
                        {selectedMarker.isMain && <span className="info-badge">Selected</span>}
                      </span>
                      <span className="info-location">
                        {selectedMarker.city}, {selectedMarker.state}
                      </span>
                    </div>
                  </div>
                  <div className="info-details">
                    <div className="info-detail">
                      <Building2 size={12} />
                      <span>{selectedMarker.certified_beds || 'N/A'} beds</span>
                    </div>
                    {selectedMarker.distance_miles && (
                      <div className="info-detail">
                        <Navigation size={12} />
                        <span>{selectedMarker.distance_miles} mi away</span>
                      </div>
                    )}
                    {selectedMarker.ownership_type && (
                      <div className="info-detail ownership">
                        {selectedMarker.ownership_type}
                      </div>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Legend */}
          <div className="map-legend">
            <div className="legend-item">
              <div className="legend-marker main" style={{ backgroundColor: getRatingColor(facility.overall_rating) }} />
              <span>Selected facility</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker competitor" />
              <span>Competitor</span>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="map-loading-overlay">Loading competitors...</div>
      )}
    </div>
  );
};

export default FacilityMapCard;
