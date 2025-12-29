import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '../context/GoogleMapsContext';
import {
  Search,
  Building2,
  Home,
  Star,
  Loader2,
  TrendingUp,
  Heart,
  Activity,
  Briefcase,
  ExternalLink,
  Users,
  DollarSign,
} from 'lucide-react';
import { getMarketMap, getMarketMetrics, getStateMetrics, getStateSummary } from '../api/marketService';
import StateAnalytics from '../components/MarketAnalysis/StateAnalytics';

// ============================================================================
// STYLES - High-Density Split Screen (65% Map / 35% Sidebar)
// ============================================================================
const styles = {
  // Main container - flex row
  container: {
    display: 'flex',
    flexDirection: 'row',
    height: 'calc(100vh - 60px)',
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },

  // ========== LEFT COLUMN (Map) ==========
  leftColumn: {
    flex: '0 0 65%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #334155',
  },
  mapHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    flexShrink: 0,
  },
  stateSelect: {
    padding: '0.5rem 0.625rem',
    fontSize: '0.8125rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    color: '#f8fafc',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '90px',
  },
  searchContainer: {
    position: 'relative',
    flex: '0 0 280px',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
    fontSize: '0.8125rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    color: '#f8fafc',
    outline: 'none',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.625rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#64748b',
  },
  filterGroup: {
    display: 'flex',
    gap: '0.75rem',
    flex: 1,
  },
  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    transition: 'opacity 0.15s',
  },
  filterCheckbox: {
    width: '12px',
    height: '12px',
    cursor: 'pointer',
  },
  snfFilter: { color: '#60a5fa' },
  hhaFilter: { color: '#34d399' },
  alfFilter: { color: '#a78bfa' },
  gradeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    marginLeft: 'auto',
  },
  gradeCircle: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.75rem',
    color: 'white',
  },
  gradeText: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  gradeLabel: {
    fontWeight: 600,
    color: '#f8fafc',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },

  // ========== RIGHT COLUMN (Sidebar) ==========
  rightColumn: {
    flex: '0 0 35%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  // Vitals Section
  vitalsSection: {
    flexShrink: 0,
    borderBottom: '1px solid #334155',
  },
  vitalsHeader: {
    display: 'flex',
    backgroundColor: '#0f172a',
  },
  vitalsTab: {
    flex: 1,
    padding: '0.5rem 0.5rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#64748b',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.25rem',
  },
  vitalsTabActive: {
    color: '#f8fafc',
    borderBottomColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  vitalsContent: {
    padding: '0.625rem',
    backgroundColor: '#1e293b',
  },
  vitalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  vitalItem: {
    padding: '0.5rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.25rem',
  },
  vitalLabel: {
    fontSize: '0.625rem',
    color: '#64748b',
    marginBottom: '0.125rem',
  },
  vitalValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
  vitalChange: {
    fontSize: '0.625rem',
    color: '#34d399',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },

  // Provider Grid Section
  providerSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  providerList: {
    flex: 1,
    overflow: 'auto',
  },
  // Excel-style table
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
  },
  th: {
    padding: '0.375rem 0.5rem',
    textAlign: 'left',
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  thRight: {
    textAlign: 'right',
  },
  thCenter: {
    textAlign: 'center',
  },
  td: {
    padding: '0.3rem 0.5rem',
    borderBottom: '1px solid #1e293b',
    color: '#e2e8f0',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  },
  tdRight: {
    textAlign: 'right',
  },
  tdCenter: {
    textAlign: 'center',
  },
  tr: {
    backgroundColor: '#1e293b',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  },
  trHover: {
    backgroundColor: '#334155',
  },
  trSelected: {
    backgroundColor: '#1e3a5f',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  nameLink: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.0625rem 0.375rem',
    fontSize: '0.5625rem',
    fontWeight: 600,
    borderRadius: '9999px',
  },
  snfBadge: { backgroundColor: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa' },
  hhaBadge: { backgroundColor: 'rgba(52, 211, 153, 0.2)', color: '#34d399' },
  alfBadge: { backgroundColor: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa' },
  ratingCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.125rem',
    color: '#fbbf24',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    color: '#64748b',
    textAlign: 'center',
    fontSize: '0.8125rem',
  },
};

// Map styles
const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 39.8283, lng: -98.5795 };
const defaultZoom = 4;

// Marker icons
const createMarkerIcon = (color) => ({
  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 1.5,
  anchor: { x: 12, y: 24 },
});
const SNF_MARKER = createMarkerIcon('#3b82f6');
const HHA_MARKER = createMarkerIcon('#10b981');
const ALF_MARKER = createMarkerIcon('#8b5cf6');

// City coordinates
const CITY_COORDINATES = {
  'boise': { lat: 43.6150, lng: -116.2023 },
  'boise, id': { lat: 43.6150, lng: -116.2023 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'seattle, wa': { lat: 47.6062, lng: -122.3321 },
  'portland': { lat: 45.5152, lng: -122.6784 },
  'portland, or': { lat: 45.5152, lng: -122.6784 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'denver, co': { lat: 39.7392, lng: -104.9903 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'phoenix, az': { lat: 33.4484, lng: -112.0740 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'new york, ny': { lat: 40.7128, lng: -74.0060 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'chicago, il': { lat: 41.8781, lng: -87.6298 },
};

// US States with coordinates and zoom levels
const US_STATES = [
  { code: '', name: 'Select State', lat: 39.8283, lng: -98.5795, zoom: 4 },
  { code: 'AZ', name: 'Arizona', lat: 34.0489, lng: -111.0937, zoom: 6 },
  { code: 'CA', name: 'California', lat: 36.7783, lng: -119.4179, zoom: 6 },
  { code: 'CO', name: 'Colorado', lat: 39.5501, lng: -105.7821, zoom: 7 },
  { code: 'ID', name: 'Idaho', lat: 44.0682, lng: -114.7420, zoom: 6 },
  { code: 'MT', name: 'Montana', lat: 46.8797, lng: -110.3626, zoom: 6 },
  { code: 'NV', name: 'Nevada', lat: 38.8026, lng: -116.4194, zoom: 6 },
  { code: 'NM', name: 'New Mexico', lat: 34.5199, lng: -105.8701, zoom: 6 },
  { code: 'OR', name: 'Oregon', lat: 43.8041, lng: -120.5542, zoom: 6 },
  { code: 'TX', name: 'Texas', lat: 31.9686, lng: -99.9018, zoom: 5 },
  { code: 'UT', name: 'Utah', lat: 39.3210, lng: -111.0937, zoom: 6 },
  { code: 'WA', name: 'Washington', lat: 47.7511, lng: -120.7401, zoom: 7 },
  { code: 'WY', name: 'Wyoming', lat: 43.0760, lng: -107.2903, zoom: 6 },
];

// Geocode helper
const geocodeSearch = async (query) => {
  const normalized = query.toLowerCase().trim();
  if (CITY_COORDINATES[normalized]) return CITY_COORDINATES[normalized];
  if (window.google?.maps?.Geocoder) {
    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          reject(new Error('Location not found'));
        }
      });
    });
  }
  throw new Error('Geocoding not available');
};

// ============================================================================
// COMPONENT
// ============================================================================
const MarketAnalysis = () => {
  const { isLoaded, loadError } = useGoogleMaps();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(defaultZoom);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [filters, setFilters] = useState({ snf: true, hha: true, alf: true });
  const [map, setMap] = useState(null);
  const [marketMetrics, setMarketMetrics] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('demand');
  const [selectedState, setSelectedState] = useState('');
  const [viewMode, setViewMode] = useState('city'); // 'city' or 'state'
  const [stateAnalytics, setStateAnalytics] = useState(null);

  // Helpers
  const formatNumber = (num) => {
    if (!num) return '--';
    const n = parseInt(num);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const formatCurrency = (num) => {
    if (!num) return '--';
    const n = parseInt(num);
    if (n >= 1000) return `$${Math.round(n / 1000)}K`;
    return `$${n}`;
  };

  // Compute grade
  const computeGrade = useMemo(() => {
    if (!marketMetrics) return { grade: '--', label: 'Search a market', color: '#64748b' };
    const { metrics, demographics } = marketMetrics;
    const growthRate = parseFloat(demographics?.projections?.growthRate65Plus) || 0;
    const competition = metrics?.marketCompetition;
    let score = 0;
    if (growthRate > 20) score += 3;
    else if (growthRate > 12) score += 2;
    else if (growthRate > 5) score += 1;
    if (competition === 'Low') score += 2;
    else if (competition === 'Medium') score += 1;
    if (score >= 4) return { grade: 'A', label: 'Strong Growth', color: '#10b981' };
    if (score >= 3) return { grade: 'B+', label: 'Good Opportunity', color: '#22c55e' };
    if (score >= 2) return { grade: 'B', label: 'Moderate Growth', color: '#059669' };
    if (score >= 1) return { grade: 'C', label: 'Stable Market', color: '#eab308' };
    return { grade: 'D', label: 'Challenging', color: '#f97316' };
  }, [marketMetrics]);

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => {
      if (f.type === 'SNF' && !filters.snf) return false;
      if (f.type === 'HHA' && !filters.hha) return false;
      if (f.type === 'ALF' && !filters.alf) return false;
      return true;
    });
  }, [facilities, filters]);

  const getTypes = useCallback(() => {
    const types = [];
    if (filters.snf) types.push('SNF');
    if (filters.hha) types.push('HHA');
    if (filters.alf) types.push('ALF');
    return types.length > 0 ? types : ['SNF'];
  }, [filters]);

  // Dynamic radius based on selected provider types
  // HHA serves regional markets (50mi), SNF/ALF are local (20mi)
  const getSearchRadius = useCallback(() => {
    if (filters.hha) return 50; // HHA needs wider radius
    return 20; // SNF/ALF are local
  }, [filters]);

  // Reverse geocode
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!window.google?.maps?.Geocoder) return null;
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          let state = null, county = null;
          for (const c of results[0].address_components) {
            if (c.types.includes('administrative_area_level_1')) state = c.short_name;
            if (c.types.includes('administrative_area_level_2')) county = c.long_name.replace(' County', '');
          }
          resolve({ state, county });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  // Handle state selection (State Mode)
  const handleStateChange = useCallback(async (e) => {
    const stateCode = e.target.value;
    setSelectedState(stateCode);

    if (!stateCode) {
      // Reset to default view
      setViewMode('city');
      setCenter(defaultCenter);
      setZoom(defaultZoom);
      setFacilities([]);
      setMarketMetrics(null);
      setSearchLocation(null);
      setStateAnalytics(null);
      return;
    }

    setLoading(true);
    setSelectedFacility(null);
    setSearchQuery(''); // Clear city search
    setViewMode('state');
    setStateAnalytics(null);

    try {
      const stateData = US_STATES.find(s => s.code === stateCode);
      if (stateData) {
        setCenter({ lat: stateData.lat, lng: stateData.lng });
        setZoom(stateData.zoom);
      }

      const types = getTypes();
      const [facilitiesResponse, metricsResponse, summaryData] = await Promise.all([
        getMarketMap(stateData.lat, stateData.lng, 300, types), // 300-mile radius for state
        getStateMetrics(stateCode),
        getStateSummary(stateCode, 'SNF') // Fetch state analytics (rating dist, top counties, etc.)
      ]);

      console.log('State Summary Data:', summaryData); // DEBUG

      if (facilitiesResponse.success) {
        setFacilities(facilitiesResponse.data || []);
      } else {
        setFacilities([]);
      }

      if (metricsResponse.success && metricsResponse.data) {
        setMarketMetrics(metricsResponse.data);
        setSearchLocation({ state: stateCode, county: null });
      }

      // Set state analytics - summaryData is already the data object (not wrapped)
      if (summaryData) {
        setStateAnalytics(summaryData);
      }
    } catch (err) {
      console.error('State search error:', err);
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [getTypes]);

  // Handle city search (City Mode)
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSelectedFacility(null);
    setMarketMetrics(null);
    setSearchLocation(null);
    setSelectedState(''); // Reset state dropdown
    setViewMode('city');
    setStateAnalytics(null); // Clear state analytics

    try {
      const coords = await geocodeSearch(searchQuery);
      setCenter(coords);
      setZoom(10);

      const types = getTypes();
      const radius = getSearchRadius(); // Dynamic: 50mi for HHA, 20mi for SNF/ALF
      const [response, locationInfo] = await Promise.all([
        getMarketMap(coords.lat, coords.lng, radius, types),
        reverseGeocode(coords.lat, coords.lng)
      ]);

      if (response.success) {
        setFacilities(response.data || []);
      } else {
        setFacilities([]);
      }

      if (locationInfo?.state && locationInfo?.county) {
        setSearchLocation(locationInfo);
        try {
          const metricsResponse = await getMarketMetrics(locationInfo.state, locationInfo.county);
          if (metricsResponse.success && metricsResponse.data) {
            setMarketMetrics(metricsResponse.data);
          }
        } catch (metricsErr) {
          console.warn('Could not load market metrics:', metricsErr.message);
        }
      }
    } catch (err) {
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, getTypes, getSearchRadius, reverseGeocode]);

  // Navigation - get profile URL for a facility
  const getProfileUrl = useCallback((facility) => {
    if (!facility) return null;
    if (facility.type === 'SNF') return `/facility-metrics/${facility.ccn}`;
    if (facility.type === 'HHA') return `/home-health/${facility.ccn}`;
    return null;
  }, []);

  // Map handlers
  const onMapLoad = useCallback((mapInstance) => setMap(mapInstance), []);
  const handleMarkerClick = useCallback((facility) => setSelectedFacility(facility), []);
  const handleRowClick = useCallback((facility) => {
    if (facility.latitude && facility.longitude) {
      const lat = parseFloat(facility.latitude);
      const lng = parseFloat(facility.longitude);
      setCenter({ lat, lng });
      setZoom(14);
      setSelectedFacility(facility);
      map?.panTo({ lat, lng });
    }
  }, [map]);

  const getMarkerIcon = useCallback((type) => {
    if (type === 'HHA') return HHA_MARKER;
    if (type === 'ALF') return ALF_MARKER;
    return SNF_MARKER;
  }, []);

  const getBadgeStyle = useCallback((type) => {
    if (type === 'HHA') return styles.hhaBadge;
    if (type === 'ALF') return styles.alfBadge;
    return styles.snfBadge;
  }, []);

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.loadingOverlay, position: 'relative', flex: 1 }}>
          <div style={{ textAlign: 'center', color: '#ef4444' }}>Failed to load Google Maps</div>
        </div>
      </div>
    );
  }

  // Vitals tab content
  const renderVitalsContent = () => {
    const demo = marketMetrics?.demographics;
    const supply = marketMetrics?.supply;
    const metrics = marketMetrics?.metrics;

    if (activeTab === 'demand') {
      return (
        <div style={styles.vitalsGrid}>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Total Pop</div>
            <div style={styles.vitalValue}>{formatNumber(demo?.population?.total)}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>65+ Pop</div>
            <div style={styles.vitalValue}>{formatNumber(demo?.population?.age65Plus)}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Growth</div>
            <div style={styles.vitalChange}>
              <TrendingUp size={10} />
              {demo?.projections?.growthRate65Plus || '--'}%
            </div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>75+ Pop</div>
            <div style={styles.vitalValue}>{formatNumber(demo?.population?.age75Plus)}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>85+ Pop</div>
            <div style={styles.vitalValue}>{formatNumber(demo?.population?.age85Plus)}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Proj 2030</div>
            <div style={styles.vitalValue}>{formatNumber(demo?.projections?.population65Plus2030)}</div>
          </div>
        </div>
      );
    }

    if (activeTab === 'competition') {
      return (
        <div style={styles.vitalsGrid}>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Facilities</div>
            <div style={styles.vitalValue}>{supply?.facilityCount || '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Total Beds</div>
            <div style={styles.vitalValue}>{formatNumber(supply?.totalBeds)}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Avg Rating</div>
            <div style={styles.vitalValue}>{supply?.avgRating || '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Beds/1K 65+</div>
            <div style={styles.vitalValue}>{metrics?.bedsPerThousand65Plus || '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Operators</div>
            <div style={styles.vitalValue}>{supply?.uniqueOperators || '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Competition</div>
            <div style={styles.vitalValue}>{metrics?.marketCompetition || '--'}</div>
          </div>
        </div>
      );
    }

    if (activeTab === 'labor') {
      return (
        <div style={styles.vitalsGrid}>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Med Income</div>
            <div style={styles.vitalValue}>{formatCurrency(demo?.economics?.medianHouseholdIncome)}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Avg Occupancy</div>
            <div style={styles.vitalValue}>{supply?.avgOccupancy ? `${supply.avgOccupancy}%` : '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>For Profit</div>
            <div style={styles.vitalValue}>{supply?.forProfitPct ? `${supply.forProfitPct}%` : '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Unemployment</div>
            <div style={styles.vitalValue}>{demo?.economics?.unemploymentRate ? `${demo.economics.unemploymentRate}%` : '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Poverty Rate</div>
            <div style={styles.vitalValue}>{demo?.economics?.povertyRate ? `${demo.economics.povertyRate}%` : '--'}</div>
          </div>
          <div style={styles.vitalItem}>
            <div style={styles.vitalLabel}>Pop Density</div>
            <div style={styles.vitalValue}>{demo?.density ? Math.round(demo.density) : '--'}/mi²</div>
          </div>
        </div>
      );
    }
  };

  return (
    <div style={styles.container}>
      {/* ================================================================== */}
      {/* LEFT COLUMN - Map */}
      {/* ================================================================== */}
      <div style={styles.leftColumn}>
        {/* Map Header */}
        <div style={styles.mapHeader}>
          {/* State Selector */}
          <select
            value={selectedState}
            onChange={handleStateChange}
            style={styles.stateSelect}
          >
            {US_STATES.map(state => (
              <option key={state.code} value={state.code}>{state.code || 'State'}</option>
            ))}
          </select>

          <form onSubmit={handleSearch} style={styles.searchContainer}>
            <Search size={14} style={styles.searchIcon} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city, zip, address..."
              style={styles.searchInput}
            />
          </form>

          <div style={styles.filterGroup}>
            <label style={{ ...styles.filterLabel, ...styles.snfFilter, opacity: filters.snf ? 1 : 0.5 }}>
              <input type="checkbox" checked={filters.snf} onChange={() => setFilters(p => ({ ...p, snf: !p.snf }))} style={styles.filterCheckbox} />
              <Building2 size={12} /> SNF
            </label>
            <label style={{ ...styles.filterLabel, ...styles.hhaFilter, opacity: filters.hha ? 1 : 0.5 }}>
              <input type="checkbox" checked={filters.hha} onChange={() => setFilters(p => ({ ...p, hha: !p.hha }))} style={styles.filterCheckbox} />
              <Home size={12} /> HHA
            </label>
            <label style={{ ...styles.filterLabel, ...styles.alfFilter, opacity: filters.alf ? 1 : 0.5 }}>
              <input type="checkbox" checked={filters.alf} onChange={() => setFilters(p => ({ ...p, alf: !p.alf }))} style={styles.filterCheckbox} />
              <Heart size={12} /> ALF
            </label>
          </div>

          {/* Compact Grade Badge */}
          <div style={styles.gradeBadge}>
            <div style={{ ...styles.gradeCircle, backgroundColor: computeGrade.color }}>
              {computeGrade.grade}
            </div>
            <div>
              <div style={styles.gradeLabel}>
                {viewMode === 'state' && selectedState
                  ? US_STATES.find(s => s.code === selectedState)?.name || selectedState
                  : searchLocation?.county
                    ? `${searchLocation.county}, ${searchLocation.state}`
                    : 'Grade'}
              </div>
              <div style={styles.gradeText}>{computeGrade.label}</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={styles.mapContainer}>
          {!isLoaded ? (
            <div style={styles.loadingOverlay}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={zoom}
              onLoad={onMapLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                zoomControl: true,
                styles: [
                  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
                  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
                  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
                  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
                  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
                ],
              }}
            >
              {filteredFacilities.map((facility) => {
                const lat = parseFloat(facility.latitude);
                const lng = parseFloat(facility.longitude);
                if (isNaN(lat) || isNaN(lng)) return null;
                return (
                  <Marker
                    key={facility.ccn}
                    position={{ lat, lng }}
                    icon={getMarkerIcon(facility.type)}
                    onClick={() => handleMarkerClick(facility)}
                  />
                );
              })}

              {selectedFacility && !isNaN(parseFloat(selectedFacility.latitude)) && (
                <InfoWindow
                  position={{ lat: parseFloat(selectedFacility.latitude), lng: parseFloat(selectedFacility.longitude) }}
                  onCloseClick={() => setSelectedFacility(null)}
                >
                  <div style={{ color: '#111', padding: '2px', minWidth: '160px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '2px' }}>{selectedFacility.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#666', marginBottom: '4px' }}>{selectedFacility.city}, {selectedFacility.state}</div>
                    <span style={{ ...styles.typeBadge, ...getBadgeStyle(selectedFacility.type), fontSize: '0.625rem' }}>{selectedFacility.type}</span>
                    {selectedFacility.type !== 'ALF' && getProfileUrl(selectedFacility) && (
                      <a
                        href={getProfileUrl(selectedFacility)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block', marginTop: '6px', color: '#2563eb', fontSize: '0.6875rem', textDecoration: 'none' }}
                      >
                        View Profile →
                      </a>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {loading && (
            <div style={styles.loadingOverlay}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT COLUMN - Sidebar */}
      {/* ================================================================== */}
      <div style={styles.rightColumn}>
        {/* Vitals Tabs */}
        <div style={styles.vitalsSection}>
          <div style={styles.vitalsHeader}>
            <div
              style={{ ...styles.vitalsTab, ...(activeTab === 'demand' ? styles.vitalsTabActive : {}) }}
              onClick={() => setActiveTab('demand')}
            >
              <TrendingUp size={10} /> Demand
            </div>
            <div
              style={{ ...styles.vitalsTab, ...(activeTab === 'competition' ? styles.vitalsTabActive : {}) }}
              onClick={() => setActiveTab('competition')}
            >
              <Activity size={10} /> Competition
            </div>
            <div
              style={{ ...styles.vitalsTab, ...(activeTab === 'labor' ? styles.vitalsTabActive : {}) }}
              onClick={() => setActiveTab('labor')}
            >
              <Briefcase size={10} /> Labor
            </div>
          </div>
          <div style={styles.vitalsContent}>
            {renderVitalsContent()}
          </div>
        </div>

        {/* Provider Grid OR State Analytics */}
        <div style={styles.providerSection}>
          {viewMode === 'state' && stateAnalytics ? (
            // State Mode: Show rich analytics
            <StateAnalytics
              stateData={stateAnalytics}
              stateName={US_STATES.find(s => s.code === selectedState)?.name}
            />
          ) : (
            // City Mode: Show provider table
            <div style={styles.providerList}>
              {facilities.length === 0 && !loading ? (
                <div style={styles.emptyState}>
                  <Search size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <div>Search to view providers</div>
                </div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Provider ({filteredFacilities.length})</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>Type</th>
                      <th style={{ ...styles.th, ...styles.thRight }}>Beds</th>
                      <th style={{ ...styles.th, ...styles.thCenter }}>★</th>
                      <th style={{ ...styles.th, ...styles.thRight }}>Dist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFacilities.map((facility) => (
                      <tr
                        key={facility.ccn}
                        style={{
                          ...styles.tr,
                          ...(hoveredRow === facility.ccn ? styles.trHover : {}),
                          ...(selectedFacility?.ccn === facility.ccn ? styles.trSelected : {}),
                        }}
                        onClick={() => handleRowClick(facility)}
                        onMouseEnter={() => setHoveredRow(facility.ccn)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td style={styles.td}>
                          <div style={styles.nameCell}>
                            {facility.type !== 'ALF' && getProfileUrl(facility) ? (
                              <a
                                href={getProfileUrl(facility)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={styles.nameLink}
                                title={facility.name}
                              >
                                {facility.name}
                              </a>
                            ) : (
                              <span style={{ color: '#e2e8f0' }} title={facility.name}>{facility.name}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...styles.td, ...styles.tdCenter }}>
                          <span style={{ ...styles.typeBadge, ...getBadgeStyle(facility.type) }}>
                            {facility.type}
                          </span>
                        </td>
                        <td style={{ ...styles.td, ...styles.tdRight, color: '#94a3b8' }}>{facility.total_beds || '--'}</td>
                        <td style={{ ...styles.td, ...styles.tdCenter }}>
                          {facility.overall_rating ? (
                            <span style={styles.ratingCell}>
                              {facility.overall_rating}
                            </span>
                          ) : (
                            <span style={{ color: '#475569' }}>--</span>
                          )}
                        </td>
                        <td style={{ ...styles.td, ...styles.tdRight, color: '#64748b', fontSize: '0.6875rem' }}>
                          {facility.distance_miles ? `${parseFloat(facility.distance_miles).toFixed(1)}` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketAnalysis;
