import React, { useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Star, MapPin, Building2 } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '350px',
};

// Color scheme for star ratings (SNF only)
const RATING_COLORS = {
  5: '#22c55e', // Green - Excellent
  4: '#84cc16', // Light green - Good
  3: '#eab308', // Yellow - Average
  2: '#f97316', // Orange - Below Average
  1: '#ef4444', // Red - Poor
  null: '#9ca3af', // Gray - No rating
};

// Get marker color based on rating
const getMarkerColor = (rating) => {
  return RATING_COLORS[rating] || RATING_COLORS[null];
};

const styles = {
  infoWindow: {
    padding: '0.5rem',
    minWidth: '200px',
  },
  infoTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '0.5rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
  },
  infoLabel: {
    fontWeight: 500,
  },
  infoValue: {
    color: '#111827',
  },
  starRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
  },
  distanceBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    color: '#374151',
    marginTop: '0.5rem',
  },
  legend: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: 'white',
    padding: '0.5rem',
    borderRadius: '0.375rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    fontSize: '0.625rem',
    zIndex: 1,
  },
  legendTitle: {
    fontWeight: 600,
    marginBottom: '0.25rem',
    fontSize: '0.75rem',
    color: '#374151',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginBottom: '0.125rem',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1px solid white',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
  },
};

const MarketMap = ({
  centerLat,
  centerLon,
  competitors = [],
  facilityType,
  selectedCompetitor,
  onCompetitorSelect,
  facilityName,
}) => {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  // Skip loading if no API key is configured
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || 'NO_API_KEY',
  });

  // Early return if no API key is configured
  if (!apiKey) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ textAlign: 'center' }}>
          <MapPin size={32} style={{ color: '#9ca3af', marginBottom: '0.5rem' }} />
          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Google Maps API key not configured</div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {competitors?.length || 0} facilities in this area
          </div>
        </div>
      </div>
    );
  }

  const center = useMemo(() => ({
    lat: centerLat,
    lng: centerLon,
  }), [centerLat, centerLon]);

  const onLoad = useCallback((map) => {
    // Fit bounds to include all markers
    if (competitors.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(center);
      competitors.forEach(c => {
        bounds.extend({ lat: c.latitude, lng: c.longitude });
      });
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [center, competitors]);

  const handleMarkerClick = (competitor) => {
    onCompetitorSelect(competitor);
  };

  const handleInfoClose = () => {
    onCompetitorSelect(null);
  };

  // Render star rating
  const renderStars = (rating) => {
    if (!rating) return <span style={{ color: '#9ca3af' }}>No rating</span>;
    return (
      <div style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={10}
            fill={star <= rating ? '#fbbf24' : 'none'}
            stroke={star <= rating ? '#fbbf24' : '#d1d5db'}
          />
        ))}
      </div>
    );
  };

  if (loadError) {
    return (
      <div style={styles.loadingContainer}>
        Error loading maps. Please check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={styles.loadingContainer}>
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {/* Subject facility marker (larger, different color) */}
        <Marker
          position={center}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#1d4ed8',
            strokeWeight: 3,
            scale: 12,
          }}
          title={facilityName || 'Subject Property'}
          zIndex={1000}
        />

        {/* Competitor markers */}
        {competitors.map((competitor) => {
          const rating = facilityType === 'SNF' ? competitor.ratings?.overall : null;
          const isSelected = selectedCompetitor?.id === competitor.id;

          return (
            <Marker
              key={competitor.id}
              position={{ lat: competitor.latitude, lng: competitor.longitude }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: getMarkerColor(rating),
                fillOpacity: 1,
                strokeColor: isSelected ? '#1e40af' : 'white',
                strokeWeight: isSelected ? 3 : 2,
                scale: isSelected ? 10 : 8,
              }}
              title={competitor.facilityName}
              onClick={() => handleMarkerClick(competitor)}
              zIndex={isSelected ? 999 : 1}
            />
          );
        })}

        {/* Info Window for selected competitor */}
        {selectedCompetitor && (
          <InfoWindow
            position={{ lat: selectedCompetitor.latitude, lng: selectedCompetitor.longitude }}
            onCloseClick={handleInfoClose}
          >
            <div style={styles.infoWindow}>
              <div style={styles.infoTitle}>{selectedCompetitor.facilityName}</div>

              {facilityType === 'SNF' ? (
                <>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Rating:</span>
                    {renderStars(selectedCompetitor.ratings?.overall)}
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Beds:</span>
                    <span style={styles.infoValue}>{selectedCompetitor.beds?.total || 'N/A'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Occupancy:</span>
                    <span style={styles.infoValue}>
                      {selectedCompetitor.occupancyRate ? `${selectedCompetitor.occupancyRate}%` : 'N/A'}
                    </span>
                  </div>
                </>
              ) : (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Capacity:</span>
                  <span style={styles.infoValue}>{selectedCompetitor.capacity || 'N/A'}</span>
                </div>
              )}

              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>City:</span>
                <span style={styles.infoValue}>{selectedCompetitor.city || selectedCompetitor.address?.split(',')[0] || 'N/A'}</span>
              </div>

              <span style={styles.distanceBadge}>
                {selectedCompetitor.distanceMiles} mi away
              </span>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend for SNF star ratings */}
      {facilityType === 'SNF' && (
        <div style={styles.legend}>
          <div style={styles.legendTitle}>Star Rating</div>
          {[5, 4, 3, 2, 1].map((rating) => (
            <div key={rating} style={styles.legendItem}>
              <div style={{ ...styles.legendDot, backgroundColor: RATING_COLORS[rating] }} />
              <span>{rating} Star</span>
            </div>
          ))}
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }} />
            <span>Subject</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketMap;
