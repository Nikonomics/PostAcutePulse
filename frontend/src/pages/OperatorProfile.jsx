/**
 * OperatorProfile.jsx
 *
 * Unified profile page for SNF and HHA providers.
 * Detects provider type from CCN and renders appropriate content.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { getProviderMetadata } from '../api/marketService';
import { Building2, Home, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { FacilityMetricsTab } from '../components/FacilityMetrics';
import HomeHealthAgency from './HomeHealthAgency';
import { useGoogleMaps } from '../context/GoogleMapsContext';
import './OperatorProfile.css';

// Mini map styles
const miniMapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '8px'
};

const miniMapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: 'none'
};

// Mini Map Component
const MiniMap = ({ latitude, longitude, providerType }) => {
  const { isLoaded } = useGoogleMaps();

  if (!latitude || !longitude) {
    return (
      <div className="operator-map-unavailable">
        <MapPin size={20} />
        <span>Location unavailable</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="operator-map-loading">
        <Loader2 size={16} className="spinning" />
      </div>
    );
  }

  const center = {
    lat: parseFloat(latitude),
    lng: parseFloat(longitude)
  };

  const markerColor = providerType === 'SNF' ? '#2563eb' : '#059669';

  return (
    <GoogleMap
      mapContainerStyle={miniMapContainerStyle}
      center={center}
      zoom={14}
      options={miniMapOptions}
    >
      <Marker
        position={center}
        icon={{
          path: window.google?.maps?.SymbolPath?.CIRCLE,
          scale: 10,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        }}
      />
    </GoogleMap>
  );
};

const OperatorProfile = () => {
  const { ccn } = useParams();
  const [providerType, setProviderType] = useState(null); // 'SNF' or 'HHA'
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!ccn) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await getProviderMetadata(ccn);
        // Backend helper.success returns { success, body } not { success, data }
        const providerData = response?.body || response?.data || response;

        if (response?.success && providerData?.type) {
          setProviderType(providerData.type);
          setMetadata(providerData);
        } else {
          setError(response?.message || 'Provider not found');
        }
      } catch (err) {
        console.error('[OperatorProfile] Error fetching metadata:', err);
        setError(err.message || 'Failed to load provider data');
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [ccn]);

  // Loading state
  if (loading) {
    return (
      <div className="operator-profile">
        <div className="operator-loading">
          <Loader2 size={32} className="spinning" />
          <span>Loading provider data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="operator-profile">
        <div className="operator-error">
          <AlertCircle size={48} strokeWidth={1.5} />
          <h3>Provider Not Found</h3>
          <p>{error}</p>
          <p className="error-ccn">CCN: {ccn}</p>
        </div>
      </div>
    );
  }

  // No CCN provided
  if (!ccn || !metadata) {
    return (
      <div className="operator-profile">
        <div className="operator-empty">
          <Building2 size={48} strokeWidth={1.5} />
          <h3>No Provider Selected</h3>
          <p>Please select a provider to view their profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="operator-profile">
      {/* Header */}
      <div className="operator-header">
        <div className="operator-header-icon">
          {providerType === 'SNF' ? (
            <Building2 size={32} />
          ) : (
            <Home size={32} />
          )}
        </div>
        <div className="operator-header-info">
          <div className="operator-header-title">
            <h1>{metadata.name}</h1>
            <span className={`operator-type-badge ${providerType?.toLowerCase()}`}>
              {providerType === 'SNF' ? 'Skilled Nursing Facility' : 'Home Health Agency'}
            </span>
          </div>
          <div className="operator-header-location">
            {metadata.city}, {metadata.state}
          </div>
          <div className="operator-header-ccn">
            CCN: {metadata.ccn}
          </div>
        </div>
        {metadata.overall_rating && (
          <div className="operator-header-rating">
            <span className="rating-value">{metadata.overall_rating}</span>
            <span className="rating-label">Star Rating</span>
          </div>
        )}
        {metadata.quality_star_rating && (
          <div className="operator-header-rating">
            <span className="rating-value">{metadata.quality_star_rating}</span>
            <span className="rating-label">Quality Rating</span>
          </div>
        )}
        {/* Mini Map */}
        <div className="operator-header-map">
          <MiniMap
            latitude={metadata.latitude}
            longitude={metadata.longitude}
            providerType={providerType}
          />
        </div>
      </div>

      {/* Body - Provider Type Specific Content */}
      <div className="operator-body">
        {providerType === 'SNF' ? (
          <div className="provider-content snf-content">
            <FacilityMetricsTab ccn={ccn} hideHeader={true} />
          </div>
        ) : (
          <div className="provider-content hha-content">
            <HomeHealthAgency ccn={ccn} hideHeader={true} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorProfile;
