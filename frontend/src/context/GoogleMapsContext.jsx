import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const GoogleMapsContext = createContext({
  isLoaded: false,
  loadError: undefined,
});

// Load all necessary libraries upfront
const GOOGLE_MAPS_LIBRARIES = ['places', 'geocoding'];

export const useGoogleMaps = () => {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within GoogleMapsProvider');
  }
  return context;
};

export const GoogleMapsProvider = ({ children }) => {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || 'NO_API_KEY',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Show loading state while Google Maps is loading
  if (loadError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>Error loading Google Maps</p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        padding: '2rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading Google Maps...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
};
