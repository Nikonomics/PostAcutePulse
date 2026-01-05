import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { useGoogleMaps } from '../context/GoogleMapsContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Building2,
  Home,
  MapPin,
  Users,
  Activity,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Target,
  X,
  Eye,
  TrendingUp,
  Heart,
  BarChart3,
  Filter,
  ChevronRight,
  Award,
} from 'lucide-react';
import {
  getOverview,
  getLocations,
  getLocationsGeoJSON,
  getCoverageByState,
  getCoverageByCbsa,
  getALFFacilities,
  getHHASubsidiaries,
  getHHAAgencies,
  getHospiceAgencies,
  getClusters,
  getClusterDetail,
  getHospiceMarketScores,
  getHospiceMarketScoreDetail,
  getHospiceMarketScoreSummary,
} from '../api/pennantService';

// ============================================================================
// STYLES - Dark theme consistent with PostAcutePulse
// ============================================================================
const styles = {
  container: {
    minHeight: 'calc(100vh - 60px)',
    backgroundColor: '#0f172a',
    padding: '1.5rem',
  },
  header: {
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#f8fafc',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  tabNav: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    borderBottom: '1px solid #334155',
    paddingBottom: '0.5rem',
  },
  tab: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: '#f8fafc',
    backgroundColor: '#1e40af',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  kpiCard: {
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    padding: '1rem',
    border: '1px solid #334155',
  },
  kpiLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginBottom: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  kpiValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  kpiSubtext: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.25rem',
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '0.875rem 1rem',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cardBody: {
    padding: '0',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '0.625rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94a3b8',
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155',
    position: 'sticky',
    top: 0,
    cursor: 'pointer',
  },
  td: {
    padding: '0.625rem 0.75rem',
    fontSize: '0.8125rem',
    color: '#e2e8f0',
    borderBottom: '1px solid #1e293b',
  },
  trHover: {
    transition: 'background-color 0.15s',
  },
  mapContainer: {
    height: '600px',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  mapControls: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  layerToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    color: '#e2e8f0',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  legend: {
    display: 'flex',
    gap: '1.5rem',
    marginLeft: 'auto',
    fontSize: '0.75rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: '#94a3b8',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#94a3b8',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '0.5rem',
    color: '#ef4444',
    fontSize: '0.875rem',
  },
  highlightRow: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  checkBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    color: 'white',
  },
  stateBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    backgroundColor: '#334155',
    borderRadius: '0.25rem',
    fontSize: '0.6875rem',
    marginRight: '0.25rem',
    marginBottom: '0.125rem',
  },
  chartContainer: {
    padding: '1rem',
    height: '300px',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#f8fafc',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  showAllButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  starRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: '#fbbf24',
  },
  // Cluster Analysis specific styles
  clusterKpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  radiusSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginLeft: 'auto',
  },
  radiusButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    color: '#94a3b8',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  radiusButtonActive: {
    color: '#f8fafc',
    backgroundColor: '#1e40af',
    borderColor: '#1e40af',
  },
  ensignBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    borderRadius: '0.25rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  topClusterRow: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  highEnsignBorder: {
    borderLeft: '3px solid #fbbf24',
  },
  opportunityScore: {
    fontWeight: 700,
    color: '#f8fafc',
    fontSize: '0.9375rem',
  },
  viewDetailsBtn: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: '1px solid #334155',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  // Cluster Detail Modal/Panel
  detailPanel: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '50%',
    maxWidth: '800px',
    height: '100vh',
    backgroundColor: '#1e293b',
    borderLeft: '1px solid #334155',
    zIndex: 1000,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
  },
  detailPanelBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  detailPanelHeader: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  detailPanelTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
  detailPanelClose: {
    padding: '0.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    borderRadius: '0.25rem',
  },
  detailPanelBody: {
    flex: 1,
    overflow: 'auto',
    padding: '1.25rem',
  },
  detailSection: {
    marginBottom: '1.5rem',
  },
  detailSectionTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
  },
  detailStat: {
    backgroundColor: '#0f172a',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: '1px solid #334155',
  },
  detailStatLabel: {
    fontSize: '0.6875rem',
    color: '#64748b',
    marginBottom: '0.25rem',
  },
  detailStatValue: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
  miniMap: {
    height: '250px',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #334155',
    marginBottom: '1rem',
  },
  locationList: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  locationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid #1e293b',
  },
  locationTypeBadge: {
    fontSize: '0.625rem',
    fontWeight: 600,
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    textTransform: 'uppercase',
  },
  // Market Scoring styles
  modeToggleContainer: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  modeToggleButton: {
    flex: 1,
    padding: '1.25rem',
    backgroundColor: '#1e293b',
    border: '2px solid #334155',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  },
  modeToggleButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  modeToggleTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#f8fafc',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  modeToggleSubtitle: {
    fontSize: '0.8125rem',
    color: '#94a3b8',
    marginBottom: '0.5rem',
  },
  modeToggleWeights: {
    fontSize: '0.6875rem',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  gradeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 700,
  },
  gradeDistributionContainer: {
    display: 'flex',
    height: '32px',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  gradeDistributionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'white',
    minWidth: '40px',
  },
  filterRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#1e293b',
    borderRadius: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontWeight: 500,
  },
  filterSelect: {
    padding: '0.375rem 0.75rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.25rem',
    color: '#e2e8f0',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  filterCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    cursor: 'pointer',
  },
  pennantPresenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.375rem',
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    color: '#ce93d8',
    borderRadius: '0.25rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  pennantPresenceRow: {
    backgroundColor: 'rgba(156, 39, 176, 0.08)',
  },
  scoreBar: {
    height: '8px',
    borderRadius: '4px',
    backgroundColor: '#334155',
    overflow: 'hidden',
    marginTop: '0.25rem',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  marketDetailModal: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '55%',
    maxWidth: '900px',
    height: '100vh',
    backgroundColor: '#1e293b',
    borderLeft: '1px solid #334155',
    zIndex: 1000,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
  },
  scoreBreakdownGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  scoreBreakdownCard: {
    backgroundColor: '#0f172a',
    borderRadius: '0.5rem',
    padding: '1rem',
    border: '1px solid #334155',
  },
  scoreBreakdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  scoreBreakdownLabel: {
    fontSize: '0.8125rem',
    color: '#94a3b8',
    fontWeight: 500,
  },
  scoreBreakdownValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
  },
  metricItem: {
    padding: '0.75rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.375rem',
    border: '1px solid #334155',
  },
  metricLabel: {
    fontSize: '0.6875rem',
    color: '#64748b',
    marginBottom: '0.25rem',
  },
  metricValue: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
};

// Map style - dark mode
const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions = {
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  ],
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
};

const defaultCenter = { lat: 39.5, lng: -98.35 }; // US center

// Marker icon URLs
const MARKER_ICONS = {
  alf: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  hha: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  hospice: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
};

// ============================================================================
// COMPONENT
// ============================================================================
const PennantDashboard = () => {
  const { isLoaded: mapsLoaded } = useGoogleMaps();

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [overviewData, setOverviewData] = useState(null);
  const [alfData, setAlfData] = useState(null);
  const [hhaData, setHhaData] = useState(null);
  const [hhaAgenciesData, setHhaAgenciesData] = useState(null);
  const [hospiceAgenciesData, setHospiceAgenciesData] = useState(null);
  const [coverageData, setCoverageData] = useState(null);
  const [cbsaCoverageData, setCbsaCoverageData] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);

  // Map state
  const [showALF, setShowALF] = useState(true);
  const [showHHA, setShowHHA] = useState(true);
  const [showHospice, setShowHospice] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Table sorting
  const [alfSort, setAlfSort] = useState({ field: 'state', dir: 'asc' });
  const [hhaSort, setHhaSort] = useState({ field: 'quality_star_rating', dir: 'desc' });
  const [cbsaSort, setCbsaSort] = useState({ field: 'total_locations', dir: 'desc' });

  // Show all toggle for CBSA table
  const [showAllCbsa, setShowAllCbsa] = useState(false);

  // Cluster Analysis state
  const [clusterData, setClusterData] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [clusterDetail, setClusterDetail] = useState(null);
  const [clusterRadius, setClusterRadius] = useState(30);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [showClusterDetail, setShowClusterDetail] = useState(false);
  const [showAllClusters, setShowAllClusters] = useState(false);
  const [clusterSort, setClusterSort] = useState({ field: 'opportunity_score', dir: 'desc' });
  const [showClusterLocations, setShowClusterLocations] = useState(true);
  const [selectedClusterCircle, setSelectedClusterCircle] = useState(null);

  // Market Scoring state
  const [marketScoringMode, setMarketScoringMode] = useState('footprint');
  const [marketScoringData, setMarketScoringData] = useState(null);
  const [marketScoringSummary, setMarketScoringSummary] = useState(null);
  const [marketScoringLoading, setMarketScoringLoading] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketDetail, setMarketDetail] = useState(null);
  const [showMarketDetail, setShowMarketDetail] = useState(false);
  const [marketSort, setMarketSort] = useState({ field: 'opportunity_score', dir: 'desc' });
  const [marketFilters, setMarketFilters] = useState({
    minPop65: 50000,
    grades: ['A', 'B', 'C', 'D', 'F'],
    pennantPresence: 'all', // 'all', 'with', 'without'
  });

  // Fetch overview data on mount
  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getOverview();
        if (result.success) {
          setOverviewData(result.data);
        } else {
          setError(result.error || 'Failed to load overview');
        }
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    const fetchTabData = async () => {
      try {
        if (activeTab === 'overview' && !alfData) {
          const [alfResult, hhaResult, hospiceResult] = await Promise.all([
            getALFFacilities(),
            getHHAAgencies(),
            getHospiceAgencies()
          ]);
          if (alfResult.success) setAlfData(alfResult.data);
          if (hhaResult.success) setHhaAgenciesData(hhaResult.data);
          if (hospiceResult.success) setHospiceAgenciesData(hospiceResult.data);
        } else if (activeTab === 'map' && !geoJsonData) {
          const result = await getLocationsGeoJSON();
          if (result.success) setGeoJsonData(result.data);
        } else if (activeTab === 'coverage') {
          // Fetch both state and CBSA coverage
          const promises = [];
          if (!coverageData) promises.push(getCoverageByState());
          if (!cbsaCoverageData) promises.push(getCoverageByCbsa());

          if (promises.length > 0) {
            const results = await Promise.all(promises);
            let resultIndex = 0;
            if (!coverageData && results[resultIndex]?.success) {
              setCoverageData(results[resultIndex].data);
              resultIndex++;
            }
            if (!cbsaCoverageData && results[resultIndex]?.success) {
              setCbsaCoverageData(results[resultIndex].data);
            }
          }
        } else if (activeTab === 'clusters') {
          // Fetch cluster data if not already loaded for this radius
          fetchClusterData();
          // Also fetch geoJSON data for showing locations on the cluster map
          if (!geoJsonData) {
            const result = await getLocationsGeoJSON();
            if (result.success) setGeoJsonData(result.data);
          }
        } else if (activeTab === 'scoring') {
          // Fetch market scoring data
          fetchMarketScoringData();
        }
      } catch (err) {
        console.error('Tab data fetch error:', err);
      }
    };
    fetchTabData();
  }, [activeTab, alfData, hhaAgenciesData, hospiceAgenciesData, geoJsonData, coverageData, cbsaCoverageData]);

  // Fetch cluster data
  const fetchClusterData = useCallback(async () => {
    try {
      setClusterLoading(true);
      const result = await getClusters(clusterRadius);
      if (result.success) {
        setClusterData(result.data);
      }
    } catch (err) {
      console.error('Cluster data fetch error:', err);
    } finally {
      setClusterLoading(false);
    }
  }, [clusterRadius]);

  // Refetch cluster data when radius changes
  useEffect(() => {
    if (activeTab === 'clusters') {
      fetchClusterData();
    }
  }, [clusterRadius, activeTab, fetchClusterData]);

  // Fetch market scoring data
  const fetchMarketScoringData = useCallback(async () => {
    try {
      setMarketScoringLoading(true);
      const [scoresResult, summaryResult] = await Promise.all([
        getHospiceMarketScores(marketScoringMode, 'cbsa', marketFilters.minPop65),
        getHospiceMarketScoreSummary(marketScoringMode, 'cbsa'),
      ]);
      if (scoresResult.success) {
        setMarketScoringData(scoresResult.data);
      }
      if (summaryResult.success) {
        setMarketScoringSummary(summaryResult.data);
      }
    } catch (err) {
      console.error('Market scoring data fetch error:', err);
    } finally {
      setMarketScoringLoading(false);
    }
  }, [marketScoringMode, marketFilters.minPop65]);

  // Refetch market scoring when mode or filters change
  useEffect(() => {
    if (activeTab === 'scoring') {
      fetchMarketScoringData();
    }
  }, [marketScoringMode, marketFilters.minPop65, activeTab, fetchMarketScoringData]);

  // Fetch market detail
  const handleViewMarketDetail = useCallback(async (market) => {
    try {
      setSelectedMarket(market);
      setShowMarketDetail(true);
      const result = await getHospiceMarketScoreDetail(market.geo_code, marketScoringMode, 'cbsa');
      if (result.success) {
        setMarketDetail(result.data);
      }
    } catch (err) {
      console.error('Market detail fetch error:', err);
    }
  }, [marketScoringMode]);

  // Fetch cluster detail when a cluster is selected
  const handleViewClusterDetail = useCallback(async (cluster) => {
    try {
      setSelectedCluster(cluster);
      setShowClusterDetail(true);
      const result = await getClusterDetail(cluster.cluster_id, clusterRadius);
      if (result.success) {
        setClusterDetail(result.data);
      }
    } catch (err) {
      console.error('Cluster detail fetch error:', err);
    }
  }, [clusterRadius]);

  // Sorted ALF facilities
  const sortedAlfFacilities = useMemo(() => {
    if (!alfData?.facilities) return [];
    return [...alfData.facilities].sort((a, b) => {
      const aVal = a[alfSort.field] || '';
      const bVal = b[alfSort.field] || '';
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return alfSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [alfData, alfSort]);

  // Sorted HHA agencies
  const sortedHhaAgencies = useMemo(() => {
    if (!hhaAgenciesData?.agencies) return [];
    return [...hhaAgenciesData.agencies].sort((a, b) => {
      const aVal = a[hhaSort.field] ?? '';
      const bVal = b[hhaSort.field] ?? '';
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return hhaSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [hhaAgenciesData, hhaSort]);

  // Sorted CBSA coverage
  const sortedCbsaCoverage = useMemo(() => {
    if (!cbsaCoverageData?.coverage) return [];
    return [...cbsaCoverageData.coverage].sort((a, b) => {
      const aVal = a[cbsaSort.field] ?? 0;
      const bVal = b[cbsaSort.field] ?? 0;
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return cbsaSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [cbsaCoverageData, cbsaSort]);

  // Chart data for coverage
  const chartData = useMemo(() => {
    if (!coverageData?.coverage) return [];
    return coverageData.coverage
      .filter(c => c.alf_facility_count > 0 || c.hha_agency_count > 0 || c.hospice_agency_count > 0)
      .map(c => ({
        state: c.state,
        ALF: c.alf_facility_count || 0,
        HHA: c.hha_agency_count || 0,
        Hospice: c.hospice_agency_count || 0,
      }))
      .sort((a, b) => (b.ALF + b.HHA + b.Hospice) - (a.ALF + a.HHA + a.Hospice));
  }, [coverageData]);

  // Sorted clusters
  const sortedClusters = useMemo(() => {
    if (!clusterData?.clusters) return [];
    return [...clusterData.clusters].sort((a, b) => {
      let aVal, bVal;
      switch (clusterSort.field) {
        case 'cluster_name':
          aVal = a.cluster_name || '';
          bVal = b.cluster_name || '';
          break;
        case 'alf_count':
          aVal = a.pennant_locations?.alf_count || 0;
          bVal = b.pennant_locations?.alf_count || 0;
          break;
        case 'alf_capacity':
          aVal = a.pennant_locations?.alf_capacity || 0;
          bVal = b.pennant_locations?.alf_capacity || 0;
          break;
        case 'hha_count':
          aVal = a.pennant_locations?.hha_count || 0;
          bVal = b.pennant_locations?.hha_count || 0;
          break;
        case 'hospice_count':
          aVal = a.pennant_locations?.hospice_count || 0;
          bVal = b.pennant_locations?.hospice_count || 0;
          break;
        case 'total_snfs':
          aVal = a.snf_proximity?.total_count || 0;
          bVal = b.snf_proximity?.total_count || 0;
          break;
        case 'total_beds':
          aVal = a.snf_proximity?.total_beds || 0;
          bVal = b.snf_proximity?.total_beds || 0;
          break;
        case 'ensign_count':
          aVal = a.snf_proximity?.ensign_count || 0;
          bVal = b.snf_proximity?.ensign_count || 0;
          break;
        case 'ensign_beds':
          aVal = a.snf_proximity?.ensign_beds || 0;
          bVal = b.snf_proximity?.ensign_beds || 0;
          break;
        case 'ensign_affinity':
          aVal = a.ensign_affinity || 0;
          bVal = b.ensign_affinity || 0;
          break;
        case 'opportunity_score':
        default:
          aVal = a.opportunity_score || 0;
          bVal = b.opportunity_score || 0;
          break;
      }
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return clusterSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [clusterData, clusterSort]);

  // Sorted and filtered market scores
  const filteredAndSortedMarkets = useMemo(() => {
    if (!marketScoringData?.markets) return [];

    let filtered = [...marketScoringData.markets];

    // Filter by grade
    if (marketFilters.grades.length < 5) {
      filtered = filtered.filter(m => marketFilters.grades.includes(m.grade));
    }

    // Filter by Pennant presence
    if (marketFilters.pennantPresence === 'with') {
      filtered = filtered.filter(m => m.pennant_hospice_count > 0);
    } else if (marketFilters.pennantPresence === 'without') {
      filtered = filtered.filter(m => !m.pennant_hospice_count || m.pennant_hospice_count === 0);
    }

    // Sort
    return filtered.sort((a, b) => {
      let aVal, bVal;
      switch (marketSort.field) {
        case 'geo_name':
          aVal = a.geo_name || '';
          bVal = b.geo_name || '';
          break;
        case 'pop_65_plus':
          aVal = a.pop_65_plus || 0;
          bVal = b.pop_65_plus || 0;
          break;
        case 'demand_score':
          aVal = a.demand_score || 0;
          bVal = b.demand_score || 0;
          break;
        case 'pennant_synergy_score':
          aVal = a.pennant_synergy_score || 0;
          bVal = b.pennant_synergy_score || 0;
          break;
        case 'market_opportunity_score':
          aVal = a.market_opportunity_score || 0;
          bVal = b.market_opportunity_score || 0;
          break;
        case 'quality_gap_score':
          aVal = a.quality_gap_score || 0;
          bVal = b.quality_gap_score || 0;
          break;
        case 'opportunity_score':
        default:
          aVal = a.opportunity_score || 0;
          bVal = b.opportunity_score || 0;
          break;
      }
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return marketSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [marketScoringData, marketSort, marketFilters]);

  // Grade colors helper
  const getGradeColor = (grade) => {
    const colors = {
      'A': '#22c55e', // green
      'B': '#3b82f6', // blue
      'C': '#eab308', // yellow
      'D': '#f97316', // orange
      'F': '#ef4444', // red
    };
    return colors[grade] || '#64748b';
  };

  // Handle market sort
  const handleMarketSort = (field) => {
    setMarketSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Filtered markers based on toggles
  const filteredMarkers = useMemo(() => {
    if (!geoJsonData?.features) return [];
    return geoJsonData.features.filter(f => {
      if (f.properties.type === 'alf' && !showALF) return false;
      if (f.properties.type === 'hha' && !showHHA) return false;
      if (f.properties.type === 'hospice' && !showHospice) return false;
      return true;
    });
  }, [geoJsonData, showALF, showHHA, showHospice]);

  const handleAlfSort = (field) => {
    setAlfSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleHhaSort = (field) => {
    setHhaSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCbsaSort = (field) => {
    setCbsaSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleClusterSort = (field) => {
    setClusterSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Get cluster circle color based on Ensign affinity
  const getClusterColor = (ensignAffinity) => {
    if (ensignAffinity >= 30) return { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e' }; // Green - High
    if (ensignAffinity >= 15) return { fill: 'rgba(59, 130, 246, 0.3)', stroke: '#3b82f6' }; // Blue - Moderate
    return { fill: 'rgba(148, 163, 184, 0.2)', stroke: '#64748b' }; // Gray - Low
  };

  // Calculate circle radius based on opportunity score
  const getClusterRadius = (score, maxScore) => {
    const minRadius = 15000; // 15km minimum
    const maxRadius = 50000; // 50km maximum
    const normalized = Math.min(score / (maxScore || 1), 1);
    return minRadius + (maxRadius - minRadius) * Math.sqrt(normalized);
  };

  const SortIcon = ({ field, sort }) => (
    field === sort.field ? (
      sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
    ) : null
  );

  // Render star rating
  const renderStarRating = (rating) => {
    if (!rating) return <span style={{ color: '#64748b' }}>-</span>;
    return (
      <span style={styles.starRating}>
        <Star size={12} fill="#fbbf24" />
        {rating.toFixed(1)}
      </span>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <Loader2 size={32} className="animate-spin" style={{ marginBottom: '0.5rem' }} />
          <span>Loading Pennant Intelligence...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Pennant Group Intelligence</h1>
        <p style={styles.subtitle}>
          Portfolio analytics for The Pennant Group - ALF, Home Health & Hospice operations across {overviewData?.totals?.total_states_operated || 0} states
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabNav}>
        {['overview', 'map', 'coverage', 'clusters', 'scoring'].map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? 'Overview' :
             tab === 'map' ? 'Ecosystem Map' :
             tab === 'coverage' ? 'Coverage Analysis' :
             tab === 'clusters' ? 'Cluster Analysis' :
             'Market Scoring'}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* OVERVIEW TAB */}
      {/* ================================================================== */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div style={styles.kpiRow}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>
                <MapPin size={14} /> Total Locations
              </div>
              <div style={styles.kpiValue}>
                {overviewData?.totals?.total_locations?.toLocaleString() || 0}
              </div>
              <div style={styles.kpiSubtext}>ALF + HHA + Hospice</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>
                <Building2 size={14} /> ALF Facilities
              </div>
              <div style={styles.kpiValue}>
                {overviewData?.alf?.facility_count?.toLocaleString() || 0}
              </div>
              <div style={styles.kpiSubtext}>{overviewData?.alf?.state_count || 0} states</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>
                <Users size={14} /> ALF Capacity
              </div>
              <div style={styles.kpiValue}>
                {overviewData?.alf?.total_capacity?.toLocaleString() || 0}
              </div>
              <div style={styles.kpiSubtext}>Total beds/units</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>
                <Home size={14} /> HHA Agencies
              </div>
              <div style={styles.kpiValue}>
                {overviewData?.hha?.agency_count || 0}
              </div>
              <div style={styles.kpiSubtext}>{overviewData?.hha?.subsidiary_count || 0} subsidiaries</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>
                <Heart size={14} style={{ color: '#9C27B0' }} /> Hospice Agencies
              </div>
              <div style={styles.kpiValue}>
                {overviewData?.hospice?.agency_count || 0}
              </div>
              <div style={styles.kpiSubtext}>{overviewData?.hospice?.state_count || 0} states</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>
                <Activity size={14} /> States Covered
              </div>
              <div style={styles.kpiValue}>
                {overviewData?.totals?.total_states_operated || 0}
              </div>
              <div style={styles.kpiSubtext}>Geographic footprint</div>
            </div>
          </div>

          {/* Three-column tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {/* ALF Facilities Table */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>
                  <Building2 size={16} style={{ color: '#22c55e' }} />
                  ALF Facilities ({alfData?.summary?.total_facilities || 0})
                </div>
              </div>
              <div style={styles.cardBody}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th} onClick={() => handleAlfSort('facility_name')}>
                        Facility <SortIcon field="facility_name" sort={alfSort} />
                      </th>
                      <th style={styles.th} onClick={() => handleAlfSort('city')}>
                        City <SortIcon field="city" sort={alfSort} />
                      </th>
                      <th style={styles.th} onClick={() => handleAlfSort('state')}>
                        ST <SortIcon field="state" sort={alfSort} />
                      </th>
                      <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleAlfSort('capacity')}>
                        Cap <SortIcon field="capacity" sort={alfSort} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAlfFacilities.map((f, i) => (
                      <tr key={f.id || i} style={styles.trHover}>
                        <td style={styles.td}>{f.facility_name}</td>
                        <td style={styles.td}>{f.city}</td>
                        <td style={styles.td}>{f.state}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{f.capacity || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HHA Agencies Table */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>
                  <Home size={16} style={{ color: '#3b82f6' }} />
                  HHA Agencies ({hhaAgenciesData?.summary?.total_agencies || 0})
                </div>
              </div>
              <div style={styles.cardBody}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th} onClick={() => handleHhaSort('provider_name')}>
                        Agency <SortIcon field="provider_name" sort={hhaSort} />
                      </th>
                      <th style={styles.th} onClick={() => handleHhaSort('city')}>
                        City <SortIcon field="city" sort={hhaSort} />
                      </th>
                      <th style={styles.th} onClick={() => handleHhaSort('state')}>
                        ST <SortIcon field="state" sort={hhaSort} />
                      </th>
                      <th style={{ ...styles.th, textAlign: 'center' }} onClick={() => handleHhaSort('quality_star_rating')}>
                        Stars <SortIcon field="quality_star_rating" sort={hhaSort} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHhaAgencies.map((a, i) => (
                      <tr key={a.ccn || i} style={styles.trHover}>
                        <td style={styles.td}>{a.provider_name}</td>
                        <td style={styles.td}>{a.city}</td>
                        <td style={styles.td}>{a.state}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {renderStarRating(a.quality_star_rating)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hospice Agencies Table */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>
                  <Heart size={16} style={{ color: '#9C27B0' }} />
                  Hospice Agencies ({hospiceAgenciesData?.summary?.total_agencies || 0})
                </div>
              </div>
              <div style={styles.cardBody}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Agency</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>ST</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospiceAgenciesData?.agencies?.map((a, i) => (
                      <tr key={a.id || i} style={styles.trHover}>
                        <td style={styles.td}>{a.name}</td>
                        <td style={styles.td}>{a.city || '-'}</td>
                        <td style={styles.td}>{a.state || '-'}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {a.has_location_data ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.125rem 0.375rem',
                              backgroundColor: 'rgba(34, 197, 94, 0.2)',
                              color: '#22c55e',
                              borderRadius: '0.25rem',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                            }}>Mapped</span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.125rem 0.375rem',
                              backgroundColor: 'rgba(100, 116, 139, 0.2)',
                              color: '#94a3b8',
                              borderRadius: '0.25rem',
                              fontSize: '0.6875rem',
                            }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* ECOSYSTEM MAP TAB */}
      {/* ================================================================== */}
      {activeTab === 'map' && (
        <>
          <div style={styles.mapControls}>
            <label style={styles.layerToggle}>
              <input
                type="checkbox"
                checked={showALF}
                onChange={(e) => setShowALF(e.target.checked)}
                style={styles.checkbox}
              />
              Show ALF ({geoJsonData?.metadata?.alf_count || 0})
            </label>
            <label style={styles.layerToggle}>
              <input
                type="checkbox"
                checked={showHHA}
                onChange={(e) => setShowHHA(e.target.checked)}
                style={styles.checkbox}
              />
              Show HHA ({geoJsonData?.metadata?.hha_count || 0})
            </label>
            <label style={styles.layerToggle}>
              <input
                type="checkbox"
                checked={showHospice}
                onChange={(e) => setShowHospice(e.target.checked)}
                style={styles.checkbox}
              />
              Show Hospice ({geoJsonData?.metadata?.hospice_count || 0})
            </label>
            <div style={styles.legend}>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, backgroundColor: '#22c55e' }} />
                ALF Facility
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }} />
                HHA Agency
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, backgroundColor: '#9C27B0' }} />
                Hospice Agency
              </div>
            </div>
          </div>

          <div style={styles.mapContainer}>
            {mapsLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={defaultCenter}
                zoom={4}
                options={mapOptions}
              >
                {/* Render all markers with appropriate icons based on type */}
                {filteredMarkers.map((feature, i) => {
                  const props = feature.properties;
                  const markerType = props.type || 'alf';

                  return (
                    <Marker
                      key={`${markerType}-${props.id || i}`}
                      position={{
                        lat: Number(feature.geometry.coordinates[1]),
                        lng: Number(feature.geometry.coordinates[0])
                      }}
                      icon={{
                        url: MARKER_ICONS[markerType] || MARKER_ICONS.alf,
                        scaledSize: mapsLoaded && window.google?.maps ? new window.google.maps.Size(32, 32) : undefined,
                      }}
                      onClick={() => setSelectedMarker({
                        type: markerType,
                        data: props,
                        position: {
                          lat: Number(feature.geometry.coordinates[1]),
                          lng: Number(feature.geometry.coordinates[0])
                        }
                      })}
                    />
                  );
                })}

                {/* Info Window */}
                {selectedMarker && (
                  <InfoWindow
                    position={selectedMarker.position}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div style={{ padding: '0.5rem', color: '#1e293b', minWidth: '200px' }}>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
                        {selectedMarker.data.name}
                      </h4>

                      {selectedMarker.data.address && (
                        <p style={{ fontSize: '0.8125rem', margin: '0 0 0.25rem' }}>
                          {selectedMarker.data.address}
                        </p>
                      )}

                      <p style={{ fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
                        {selectedMarker.data.city}, {selectedMarker.data.state} {selectedMarker.data.zip_code || ''}
                      </p>

                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                        {selectedMarker.type === 'alf' ? (
                          <>
                            {selectedMarker.data.capacity && (
                              <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                                <strong>Capacity:</strong> {selectedMarker.data.capacity} beds
                              </p>
                            )}
                            {selectedMarker.data.county && (
                              <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                                <strong>County:</strong> {selectedMarker.data.county}
                              </p>
                            )}
                          </>
                        ) : selectedMarker.type === 'hha' ? (
                          <>
                            {selectedMarker.data.ccn && (
                              <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                                <strong>CCN:</strong> {selectedMarker.data.ccn}
                              </p>
                            )}
                            {selectedMarker.data.quality_star_rating && (
                              <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                                <strong>Quality:</strong> {selectedMarker.data.quality_star_rating} stars
                              </p>
                            )}
                            {selectedMarker.data.episode_count && (
                              <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                                <strong>Episodes:</strong> {selectedMarker.data.episode_count.toLocaleString()}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {selectedMarker.data.location_source && (
                              <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                                <strong>Data Source:</strong> {selectedMarker.data.location_source === 'hha' ? 'HHA Link' : 'Hospice Provider'}
                              </p>
                            )}
                          </>
                        )}
                        {selectedMarker.data.cbsa_name && (
                          <p style={{ fontSize: '0.75rem', margin: '0.125rem 0', color: '#64748b' }}>
                            <strong>Market:</strong> {selectedMarker.data.cbsa_name}
                          </p>
                        )}
                      </div>

                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: selectedMarker.type === 'alf' ? '#dcfce7' : selectedMarker.type === 'hha' ? '#dbeafe' : '#f3e8ff',
                        borderRadius: '0.25rem',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: selectedMarker.type === 'alf' ? '#166534' : selectedMarker.type === 'hha' ? '#1e40af' : '#7c3aed',
                        display: 'inline-block'
                      }}>
                        {selectedMarker.type === 'alf' ? 'ALF Facility' : selectedMarker.type === 'hha' ? 'HHA Agency' : 'Hospice Agency'}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : (
              <div style={styles.loadingContainer}>
                <Loader2 size={24} className="animate-spin" />
                <span>Loading map...</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* COVERAGE ANALYSIS TAB */}
      {/* ================================================================== */}
      {activeTab === 'coverage' && (
        <div>
          {/* CBSA Market Coverage Section */}
          {cbsaCoverageData && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={styles.sectionTitle}>
                <MapPin size={18} /> CBSA Market Coverage
              </h2>

              {/* CBSA Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Total Markets</div>
                  <div style={styles.kpiValue}>{cbsaCoverageData.summary?.total_cbsas}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Markets with ALF</div>
                  <div style={styles.kpiValue}>{cbsaCoverageData.summary?.cbsas_with_alf}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Markets with HHA</div>
                  <div style={styles.kpiValue}>{cbsaCoverageData.summary?.cbsas_with_hha}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Markets with Hospice</div>
                  <div style={{ ...styles.kpiValue, color: '#9C27B0' }}>{cbsaCoverageData.summary?.cbsas_with_hospice || 0}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Markets with 2+</div>
                  <div style={styles.kpiValue}>{cbsaCoverageData.summary?.cbsas_with_both || 0}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>All 3 Segments</div>
                  <div style={{ ...styles.kpiValue, color: '#22c55e' }}>{cbsaCoverageData.summary?.cbsas_with_all_segments || 0}</div>
                </div>
              </div>

              {/* CBSA Coverage Table */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}>
                    Market Coverage Details
                  </div>
                  <button
                    style={styles.showAllButton}
                    onClick={() => setShowAllCbsa(!showAllCbsa)}
                  >
                    {showAllCbsa ? 'Show Top 20' : `Show All ${sortedCbsaCoverage.length}`}
                  </button>
                </div>
                <div style={{ ...styles.cardBody, maxHeight: '500px' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th} onClick={() => handleCbsaSort('cbsa_name')}>
                          Market Name <SortIcon field="cbsa_name" sort={cbsaSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleCbsaSort('alf_count')}>
                          ALF <SortIcon field="alf_count" sort={cbsaSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleCbsaSort('alf_capacity')}>
                          ALF Cap <SortIcon field="alf_capacity" sort={cbsaSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleCbsaSort('hha_count')}>
                          HHA <SortIcon field="hha_count" sort={cbsaSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleCbsaSort('hospice_count')}>
                          Hospice <SortIcon field="hospice_count" sort={cbsaSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleCbsaSort('total_locations')}>
                          Total <SortIcon field="total_locations" sort={cbsaSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'center' }}>All 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllCbsa ? sortedCbsaCoverage : sortedCbsaCoverage.slice(0, 20)).map((c, i) => (
                        <tr key={c.cbsa_code || i} style={c.has_all_segments ? styles.highlightRow : {}}>
                          <td style={styles.td}>
                            <strong>{c.cbsa_name || 'Unknown'}</strong>
                            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{c.cbsa_code}</div>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>{c.alf_count || '-'}</td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>{c.alf_capacity?.toLocaleString() || '-'}</td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>{c.hha_count || '-'}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: c.hospice_count ? '#9C27B0' : undefined }}>{c.hospice_count || '-'}</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{c.total_locations}</td>
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            {c.has_all_segments && (
                              <span style={styles.checkBadge}>
                                <Check size={12} />
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* State Coverage Section */}
          {coverageData && (
            <div>
              <h2 style={styles.sectionTitle}>
                <Activity size={18} /> State Coverage
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Coverage Table */}
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div style={styles.cardTitle}>
                      State Details ({coverageData.summary?.total_states} states)
                    </div>
                  </div>
                  <div style={styles.cardBody}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>State</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>ALF</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>ALF Cap</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>HHA</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Hospice</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>All 3</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverageData.coverage?.map((c, i) => (
                          <tr key={c.state} style={c.has_all_segments ? styles.highlightRow : {}}>
                            <td style={styles.td}><strong>{c.state}</strong></td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>{c.alf_facility_count || '-'}</td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>{c.alf_total_capacity?.toLocaleString() || '-'}</td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>{c.hha_agency_count || '-'}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: c.hospice_agency_count ? '#9C27B0' : undefined }}>{c.hospice_agency_count || '-'}</td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              {c.has_all_segments && (
                                <span style={styles.checkBadge}>
                                  <Check size={12} />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary + Chart */}
                <div>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>States with ALF</div>
                      <div style={styles.kpiValue}>{coverageData.summary?.states_with_alf}</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>States with HHA</div>
                      <div style={styles.kpiValue}>{coverageData.summary?.states_with_hha}</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>States with Hospice</div>
                      <div style={{ ...styles.kpiValue, color: '#9C27B0' }}>{coverageData.summary?.states_with_hospice || 0}</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>States with 2+</div>
                      <div style={styles.kpiValue}>{coverageData.summary?.states_with_both || 0}</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>All 3 Segments</div>
                      <div style={{ ...styles.kpiValue, color: '#22c55e' }}>{coverageData.summary?.states_with_all_segments || 0}</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Total HHA Episodes</div>
                      <div style={styles.kpiValue}>{coverageData.summary?.total_hha_episodes?.toLocaleString() || 0}</div>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div style={styles.cardTitle}>Facilities by State</div>
                    </div>
                    <div style={styles.chartContainer}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <YAxis dataKey="state" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem' }}
                            labelStyle={{ color: '#f8fafc' }}
                          />
                          <Legend />
                          <Bar dataKey="ALF" fill="#22c55e" name="ALF Facilities" />
                          <Bar dataKey="HHA" fill="#3b82f6" name="HHA Agencies" />
                          <Bar dataKey="Hospice" fill="#9C27B0" name="Hospice Agencies" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading state for coverage */}
          {!coverageData && !cbsaCoverageData && (
            <div style={styles.loadingContainer}>
              <Loader2 size={24} className="animate-spin" />
              <span>Loading coverage data...</span>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* CLUSTER ANALYSIS TAB */}
      {/* ================================================================== */}
      {activeTab === 'clusters' && (
        <div>
          {/* Loading state */}
          {clusterLoading && (
            <div style={styles.loadingContainer}>
              <Loader2 size={24} className="animate-spin" />
              <span>Analyzing clusters...</span>
            </div>
          )}

          {/* Cluster content */}
          {!clusterLoading && clusterData && (
            <>
              {/* Section 1: KPI Summary Row */}
              <div style={styles.clusterKpiRow}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Target size={14} /> Total Clusters
                  </div>
                  <div style={styles.kpiValue}>
                    {clusterData.summary?.total_clusters || 0}
                  </div>
                  <div style={styles.kpiSubtext}>Geographic groupings</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <MapPin size={14} /> Pennant Locations
                  </div>
                  <div style={styles.kpiValue}>
                    {clusterData.summary?.total_pennant_locations?.toLocaleString() || 0}
                  </div>
                  <div style={styles.kpiSubtext}>ALF + HHA + Hospice</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Building2 size={14} /> Nearby SNFs
                  </div>
                  <div style={styles.kpiValue}>
                    {clusterData.summary?.total_nearby_snfs?.toLocaleString() || 0}
                  </div>
                  <div style={styles.kpiSubtext}>Within {clusterRadius} mi</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Users size={14} /> Nearby SNF Beds
                  </div>
                  <div style={styles.kpiValue}>
                    {clusterData.summary?.total_nearby_snf_beds?.toLocaleString() || 0}
                  </div>
                  <div style={styles.kpiSubtext}>Total capacity</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Check size={14} style={{ color: '#22c55e' }} /> Ensign SNFs
                  </div>
                  <div style={{ ...styles.kpiValue, color: '#22c55e' }}>
                    {clusterData.summary?.ensign_snf_count?.toLocaleString() || 0}
                  </div>
                  <div style={styles.kpiSubtext}>{clusterData.summary?.ensign_snf_beds?.toLocaleString() || 0} beds</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <TrendingUp size={14} /> Ensign Bed Share
                  </div>
                  <div style={{ ...styles.kpiValue, color: '#22c55e' }}>
                    {clusterData.summary?.total_nearby_snf_beds > 0
                      ? ((clusterData.summary.ensign_snf_beds / clusterData.summary.total_nearby_snf_beds) * 100).toFixed(1)
                      : 0}%
                  </div>
                  <div style={styles.kpiSubtext}>Partnership potential</div>
                </div>
              </div>

              {/* Section 2: Cluster Map */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={styles.mapControls}>
                  <label style={styles.layerToggle}>
                    <input
                      type="checkbox"
                      checked={showClusterLocations}
                      onChange={(e) => setShowClusterLocations(e.target.checked)}
                      style={styles.checkbox}
                    />
                    Show Pennant Locations
                  </label>

                  <div style={styles.legend}>
                    <div style={styles.legendItem}>
                      <div style={{ ...styles.legendDot, backgroundColor: '#22c55e' }} />
                      High Ensign (&gt;30%)
                    </div>
                    <div style={styles.legendItem}>
                      <div style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }} />
                      Moderate (15-30%)
                    </div>
                    <div style={styles.legendItem}>
                      <div style={{ ...styles.legendDot, backgroundColor: '#64748b' }} />
                      Low (&lt;15%)
                    </div>
                  </div>

                  {/* Section 5: Radius Selector */}
                  <div style={styles.radiusSelector}>
                    <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Radius:</span>
                    {[15, 30, 45].map(r => (
                      <button
                        key={r}
                        style={{
                          ...styles.radiusButton,
                          ...(clusterRadius === r ? styles.radiusButtonActive : {})
                        }}
                        onClick={() => setClusterRadius(r)}
                      >
                        {r} mi
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.mapContainer}>
                  {mapsLoaded ? (
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={defaultCenter}
                      zoom={4}
                      options={mapOptions}
                    >
                      {/* Cluster circles */}
                      {clusterData.clusters?.map((cluster, i) => {
                        const colors = getClusterColor(cluster.ensign_affinity || 0);
                        const maxScore = clusterData.clusters[0]?.opportunity_score || 1;
                        return (
                          <Circle
                            key={cluster.cluster_id}
                            center={{
                              lat: cluster.center_lat,
                              lng: cluster.center_lng
                            }}
                            radius={getClusterRadius(cluster.opportunity_score, maxScore)}
                            options={{
                              fillColor: colors.fill,
                              fillOpacity: 0.6,
                              strokeColor: colors.stroke,
                              strokeWeight: 2,
                              clickable: true,
                            }}
                            onClick={() => setSelectedClusterCircle(cluster)}
                          />
                        );
                      })}

                      {/* Cluster info window */}
                      {selectedClusterCircle && (
                        <InfoWindow
                          position={{
                            lat: selectedClusterCircle.center_lat,
                            lng: selectedClusterCircle.center_lng
                          }}
                          onCloseClick={() => setSelectedClusterCircle(null)}
                        >
                          <div style={{ padding: '0.5rem', color: '#1e293b', minWidth: '220px' }}>
                            <h4 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
                              {selectedClusterCircle.cluster_name}
                            </h4>
                            <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                              <strong>Opportunity Score:</strong> {selectedClusterCircle.opportunity_score?.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              <p style={{ margin: '0.125rem 0' }}>
                                <strong>ALF:</strong> {selectedClusterCircle.pennant_locations?.alf_count} ({selectedClusterCircle.pennant_locations?.alf_capacity} beds)
                              </p>
                              <p style={{ margin: '0.125rem 0' }}>
                                <strong>HHA:</strong> {selectedClusterCircle.pennant_locations?.hha_count}
                              </p>
                              <p style={{ margin: '0.125rem 0', color: '#9C27B0' }}>
                                <strong>Hospice:</strong> {selectedClusterCircle.pennant_locations?.hospice_count || 0}
                              </p>
                              <p style={{ margin: '0.125rem 0' }}>
                                <strong>Nearby SNFs:</strong> {selectedClusterCircle.snf_proximity?.total_count} ({selectedClusterCircle.snf_proximity?.total_beds?.toLocaleString()} beds)
                              </p>
                              <p style={{ margin: '0.125rem 0' }}>
                                <strong>Ensign SNFs:</strong> {selectedClusterCircle.snf_proximity?.ensign_count} ({selectedClusterCircle.ensign_affinity?.toFixed(1)}%)
                              </p>
                            </div>
                            <button
                              style={{
                                marginTop: '0.5rem',
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#1e40af',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                handleViewClusterDetail(selectedClusterCircle);
                                setSelectedClusterCircle(null);
                              }}
                            >
                              View Details
                            </button>
                          </div>
                        </InfoWindow>
                      )}

                      {/* Show Pennant location markers if enabled */}
                      {showClusterLocations && geoJsonData?.features?.map((feature, i) => {
                        const props = feature.properties;
                        const markerType = props.type || 'alf';
                        return (
                          <Marker
                            key={`${markerType}-${props.id || i}`}
                            position={{
                              lat: Number(feature.geometry.coordinates[1]),
                              lng: Number(feature.geometry.coordinates[0])
                            }}
                            icon={{
                              url: MARKER_ICONS[markerType] || MARKER_ICONS.alf,
                              scaledSize: mapsLoaded && window.google?.maps ? new window.google.maps.Size(24, 24) : undefined,
                            }}
                          />
                        );
                      })}
                    </GoogleMap>
                  ) : (
                    <div style={styles.loadingContainer}>
                      <Loader2 size={24} className="animate-spin" />
                      <span>Loading map...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Cluster Rankings Table */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}>
                    <Target size={16} style={{ color: '#3b82f6' }} />
                    Cluster Rankings
                  </div>
                  <button
                    style={styles.showAllButton}
                    onClick={() => setShowAllClusters(!showAllClusters)}
                  >
                    {showAllClusters ? 'Show Top 20' : `Show All ${sortedClusters.length}`}
                  </button>
                </div>
                <div style={{ ...styles.cardBody, maxHeight: '600px' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: '40px' }}>#</th>
                        <th style={styles.th} onClick={() => handleClusterSort('cluster_name')}>
                          Cluster <SortIcon field="cluster_name" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('alf_count')}>
                          ALF <SortIcon field="alf_count" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('hha_count')}>
                          HHA <SortIcon field="hha_count" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('hospice_count')}>
                          Hospice <SortIcon field="hospice_count" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('total_snfs')}>
                          SNFs <SortIcon field="total_snfs" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('total_beds')}>
                          SNF Beds <SortIcon field="total_beds" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('ensign_count')}>
                          Ensign <SortIcon field="ensign_count" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('ensign_affinity')}>
                          Ensign % <SortIcon field="ensign_affinity" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleClusterSort('opportunity_score')}>
                          Score <SortIcon field="opportunity_score" sort={clusterSort} />
                        </th>
                        <th style={{ ...styles.th, width: '80px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllClusters ? sortedClusters : sortedClusters.slice(0, 20)).map((cluster, i) => {
                        const isTop10 = i < 10 && clusterSort.field === 'opportunity_score' && clusterSort.dir === 'desc';
                        const highEnsign = cluster.ensign_affinity >= 30;
                        return (
                          <tr
                            key={cluster.cluster_id}
                            style={{
                              ...(isTop10 ? styles.topClusterRow : {}),
                              ...(highEnsign ? styles.highEnsignBorder : {}),
                            }}
                          >
                            <td style={{ ...styles.td, color: '#64748b', fontSize: '0.75rem' }}>{i + 1}</td>
                            <td style={styles.td}>
                              <strong>{cluster.cluster_name}</strong>
                              <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                {cluster.states?.join(', ')}
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {cluster.pennant_locations?.alf_count || 0}
                              <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                {cluster.pennant_locations?.alf_capacity?.toLocaleString() || 0} beds
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {cluster.pennant_locations?.hha_count || 0}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', color: cluster.pennant_locations?.hospice_count ? '#9C27B0' : undefined }}>
                              {cluster.pennant_locations?.hospice_count || 0}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {cluster.snf_proximity?.total_count || 0}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {cluster.snf_proximity?.total_beds?.toLocaleString() || 0}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {cluster.snf_proximity?.ensign_count || 0}
                              <div style={{ fontSize: '0.6875rem', color: '#22c55e' }}>
                                {cluster.snf_proximity?.ensign_beds?.toLocaleString() || 0} beds
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {cluster.ensign_affinity >= 25 ? (
                                <span style={styles.ensignBadge}>
                                  {cluster.ensign_affinity?.toFixed(1)}%
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>
                                  {cluster.ensign_affinity?.toFixed(1) || 0}%
                                </span>
                              )}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <span style={styles.opportunityScore}>
                                {cluster.opportunity_score?.toLocaleString()}
                              </span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <button
                                style={styles.viewDetailsBtn}
                                onClick={() => handleViewClusterDetail(cluster)}
                              >
                                <Eye size={12} /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Section 4: Cluster Detail Panel */}
          {showClusterDetail && selectedCluster && (
            <>
              <div
                style={styles.detailPanelBackdrop}
                onClick={() => {
                  setShowClusterDetail(false);
                  setSelectedCluster(null);
                  setClusterDetail(null);
                }}
              />
              <div style={styles.detailPanel}>
                <div style={styles.detailPanelHeader}>
                  <div>
                    <div style={styles.detailPanelTitle}>{selectedCluster.cluster_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {selectedCluster.states?.join(', ')} • {clusterRadius} mile radius
                    </div>
                  </div>
                  <button
                    style={styles.detailPanelClose}
                    onClick={() => {
                      setShowClusterDetail(false);
                      setSelectedCluster(null);
                      setClusterDetail(null);
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={styles.detailPanelBody}>
                  {!clusterDetail ? (
                    <div style={styles.loadingContainer}>
                      <Loader2 size={24} className="animate-spin" />
                      <span>Loading cluster details...</span>
                    </div>
                  ) : (
                    <>
                      {/* Mini Map */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>Cluster Location</div>
                        <div style={styles.miniMap}>
                          {mapsLoaded && (
                            <GoogleMap
                              mapContainerStyle={mapContainerStyle}
                              center={{
                                lat: clusterDetail.center_lat,
                                lng: clusterDetail.center_lng
                              }}
                              zoom={8}
                              options={mapOptions}
                            >
                              {/* Cluster circle */}
                              <Circle
                                center={{
                                  lat: clusterDetail.center_lat,
                                  lng: clusterDetail.center_lng
                                }}
                                radius={clusterRadius * 1609.34} // Convert miles to meters
                                options={{
                                  fillColor: 'rgba(59, 130, 246, 0.2)',
                                  fillOpacity: 0.5,
                                  strokeColor: '#3b82f6',
                                  strokeWeight: 2,
                                }}
                              />
                              {/* Pennant location markers */}
                              {clusterDetail.pennant_locations?.locations?.map((loc, i) => (
                                <Marker
                                  key={`${loc.type}-${loc.id || i}`}
                                  position={{
                                    lat: loc.latitude,
                                    lng: loc.longitude
                                  }}
                                  icon={{
                                    url: MARKER_ICONS[loc.type] || MARKER_ICONS.alf,
                                    scaledSize: window.google?.maps ? new window.google.maps.Size(28, 28) : undefined,
                                  }}
                                />
                              ))}
                            </GoogleMap>
                          )}
                        </div>
                      </div>

                      {/* Opportunity Score Breakdown */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>Opportunity Score Breakdown</div>
                        <div style={styles.detailGrid}>
                          <div style={styles.detailStat}>
                            <div style={styles.detailStatLabel}>Total Score</div>
                            <div style={{ ...styles.detailStatValue, color: '#3b82f6' }}>
                              {clusterDetail.opportunity_score?.toLocaleString()}
                            </div>
                          </div>
                          <div style={styles.detailStat}>
                            <div style={styles.detailStatLabel}>Ensign Affinity</div>
                            <div style={{ ...styles.detailStatValue, color: '#22c55e' }}>
                              {clusterDetail.ensign_affinity?.toFixed(1)}%
                            </div>
                          </div>
                          <div style={styles.detailStat}>
                            <div style={styles.detailStatLabel}>Market Density</div>
                            <div style={styles.detailStatValue}>
                              {clusterDetail.market_density?.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div style={{ ...styles.detailGrid, marginTop: '0.5rem' }}>
                          <div style={styles.detailStat}>
                            <div style={styles.detailStatLabel}>ALF Value</div>
                            <div style={styles.detailStatValue}>
                              {clusterDetail.score_components?.alf_value?.toLocaleString() || 0}
                            </div>
                          </div>
                          <div style={styles.detailStat}>
                            <div style={styles.detailStatLabel}>HHA Value</div>
                            <div style={styles.detailStatValue}>
                              {clusterDetail.score_components?.hha_value?.toLocaleString() || 0}
                            </div>
                          </div>
                          <div style={styles.detailStat}>
                            <div style={styles.detailStatLabel}>Ensign Value</div>
                            <div style={{ ...styles.detailStatValue, color: '#22c55e' }}>
                              {clusterDetail.score_components?.ensign_value?.toLocaleString() || 0}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pennant Locations */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>
                          Pennant Locations ({clusterDetail.pennant_locations?.total || 0})
                        </div>
                        <div style={styles.locationList}>
                          {clusterDetail.pennant_locations?.locations?.map((loc, i) => {
                            const typeColors = {
                              alf: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
                              hha: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
                              hospice: { bg: 'rgba(156, 39, 176, 0.2)', color: '#9C27B0' },
                            };
                            const colorScheme = typeColors[loc.type] || typeColors.alf;
                            return (
                              <div key={`${loc.type}-${loc.id || i}`} style={styles.locationItem}>
                                <span
                                  style={{
                                    ...styles.locationTypeBadge,
                                    backgroundColor: colorScheme.bg,
                                    color: colorScheme.color,
                                  }}
                                >
                                  {loc.type}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.8125rem', color: '#e2e8f0' }}>{loc.name}</div>
                                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                    {loc.city}, {loc.state}
                                    {loc.capacity && ` • ${loc.capacity} beds`}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Top 20 Nearby SNFs */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>
                          Nearby SNFs ({clusterDetail.snf_proximity?.total_count || 0} total)
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Facility</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Distance</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Beds</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Rating</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Ensign</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clusterDetail.snf_proximity?.snf_list?.slice(0, 20).map((snf, i) => (
                                <tr key={snf.ccn || i}>
                                  <td style={styles.td}>
                                    <div style={{ fontSize: '0.8125rem' }}>{snf.facility_name}</div>
                                    <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                      {snf.city}, {snf.state}
                                    </div>
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'right' }}>
                                    {snf.distance_miles?.toFixed(1)} mi
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'right' }}>
                                    {snf.certified_beds?.toLocaleString()}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'center' }}>
                                    {snf.overall_rating ? (
                                      <span style={styles.starRating}>
                                        <Star size={12} fill="#fbbf24" />
                                        {snf.overall_rating}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'center' }}>
                                    {snf.is_ensign && (
                                      <span style={styles.ensignBadge}>
                                        <Check size={10} /> Ensign
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* MARKET SCORING TAB */}
      {/* ================================================================== */}
      {activeTab === 'scoring' && (
        <div>
          {/* Loading state */}
          {marketScoringLoading && (
            <div style={styles.loadingContainer}>
              <Loader2 size={24} className="animate-spin" />
              <span>Loading market scores...</span>
            </div>
          )}

          {/* Market Scoring content */}
          {!marketScoringLoading && (
            <>
              {/* Section 1: Mode Toggle */}
              <div style={styles.modeToggleContainer}>
                <button
                  style={{
                    ...styles.modeToggleButton,
                    ...(marketScoringMode === 'footprint' ? styles.modeToggleButtonActive : {})
                  }}
                  onClick={() => setMarketScoringMode('footprint')}
                >
                  <div style={styles.modeToggleTitle}>
                    <Target size={18} style={{ color: marketScoringMode === 'footprint' ? '#3b82f6' : '#94a3b8' }} />
                    Footprint Mode
                  </div>
                  <div style={styles.modeToggleSubtitle}>
                    Where to grow within existing Pennant presence
                  </div>
                  <div style={styles.modeToggleWeights}>
                    75% Synergy • 15% Demand • 10% Quality Gap
                  </div>
                </button>
                <button
                  style={{
                    ...styles.modeToggleButton,
                    ...(marketScoringMode === 'greenfield' ? styles.modeToggleButtonActive : {})
                  }}
                  onClick={() => setMarketScoringMode('greenfield')}
                >
                  <div style={styles.modeToggleTitle}>
                    <MapPin size={18} style={{ color: marketScoringMode === 'greenfield' ? '#3b82f6' : '#94a3b8' }} />
                    Greenfield Mode
                  </div>
                  <div style={styles.modeToggleSubtitle}>
                    Where to enter as a new player
                  </div>
                  <div style={styles.modeToggleWeights}>
                    40% Demand • 40% Market Opportunity • 20% Quality Gap
                  </div>
                </button>
              </div>

              {/* Section 2: Summary KPI Cards */}
              <div style={styles.clusterKpiRow}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <BarChart3 size={14} /> Total Markets
                  </div>
                  <div style={styles.kpiValue}>
                    {marketScoringSummary?.total_markets || filteredAndSortedMarkets.length || 0}
                  </div>
                  <div style={styles.kpiSubtext}>CBSA markets scored</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Award size={14} style={{ color: '#22c55e' }} /> Grade A Markets
                  </div>
                  <div style={{ ...styles.kpiValue, color: '#22c55e' }}>
                    {marketScoringSummary?.grade_distribution?.A || 0}
                  </div>
                  <div style={styles.kpiSubtext}>
                    {marketScoringSummary?.total_markets_scored > 0
                      ? `${((marketScoringSummary?.grade_distribution?.A || 0) / marketScoringSummary.total_markets_scored * 100).toFixed(1)}%`
                      : '0%'} of markets
                  </div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Award size={14} style={{ color: '#3b82f6' }} /> Grade B Markets
                  </div>
                  <div style={{ ...styles.kpiValue, color: '#3b82f6' }}>
                    {marketScoringSummary?.grade_distribution?.B || 0}
                  </div>
                  <div style={styles.kpiSubtext}>
                    {marketScoringSummary?.total_markets_scored > 0
                      ? `${((marketScoringSummary?.grade_distribution?.B || 0) / marketScoringSummary.total_markets_scored * 100).toFixed(1)}%`
                      : '0%'} of markets
                  </div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <TrendingUp size={14} /> Avg Score
                  </div>
                  <div style={styles.kpiValue}>
                    {marketScoringSummary?.avg_opportunity_score?.toFixed(1) || '-'}
                  </div>
                  <div style={styles.kpiSubtext}>Opportunity score</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Star size={14} /> Top Market
                  </div>
                  <div style={styles.kpiValue}>
                    {marketScoringSummary?.top_10_markets?.[0]?.opportunity_score?.toFixed(1) || '-'}
                  </div>
                  <div style={styles.kpiSubtext}>
                    {marketScoringSummary?.top_10_markets?.[0]?.geo_name?.substring(0, 25) || '-'}
                  </div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>
                    <Heart size={14} style={{ color: '#9C27B0' }} /> Pennant Markets
                  </div>
                  <div style={{ ...styles.kpiValue, color: '#9C27B0' }}>
                    {marketScoringData?.markets?.filter(m => m.pennant_hospice_count > 0).length || 0}
                  </div>
                  <div style={styles.kpiSubtext}>Markets with Pennant hospice</div>
                </div>
              </div>

              {/* Section 3: Grade Distribution */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}>
                    <BarChart3 size={16} style={{ color: '#3b82f6' }} />
                    Grade Distribution
                  </div>
                </div>
                <div style={{ padding: '1rem' }}>
                  <div style={styles.gradeDistributionContainer}>
                    {['A', 'B', 'C', 'D', 'F'].map(grade => {
                      const count = marketScoringSummary?.grade_distribution?.[grade] || 0;
                      const total = marketScoringSummary?.total_markets_scored || 1;
                      const pct = (count / total) * 100;
                      if (pct < 1) return null;
                      return (
                        <div
                          key={grade}
                          style={{
                            ...styles.gradeDistributionBar,
                            backgroundColor: getGradeColor(grade),
                            width: `${pct}%`,
                          }}
                        >
                          {pct >= 5 && `${grade}: ${count}`}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                    {['A', 'B', 'C', 'D', 'F'].map(grade => {
                      const count = marketScoringSummary?.grade_distribution?.[grade] || 0;
                      return (
                        <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            ...styles.gradeBadge,
                            backgroundColor: getGradeColor(grade),
                            color: 'white',
                            width: '24px',
                            height: '24px',
                            fontSize: '0.75rem',
                          }}>
                            {grade}
                          </div>
                          <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                            {count} ({((count / (marketScoringSummary?.total_markets_scored || 1)) * 100).toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 4: Filters */}
              <div style={styles.filterRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Filter size={16} style={{ color: '#94a3b8' }} />
                  <span style={{ fontSize: '0.8125rem', color: '#f8fafc', fontWeight: 500 }}>Filters:</span>
                </div>
                <div style={styles.filterGroup}>
                  <span style={styles.filterLabel}>Pop 65+:</span>
                  <select
                    style={styles.filterSelect}
                    value={marketFilters.minPop65}
                    onChange={(e) => setMarketFilters(prev => ({ ...prev, minPop65: parseInt(e.target.value) }))}
                  >
                    <option value={0}>All</option>
                    <option value={50000}>50k+</option>
                    <option value={100000}>100k+</option>
                    <option value={250000}>250k+</option>
                    <option value={500000}>500k+</option>
                  </select>
                </div>
                <div style={styles.filterGroup}>
                  <span style={styles.filterLabel}>Grades:</span>
                  {['A', 'B', 'C', 'D', 'F'].map(grade => (
                    <label key={grade} style={styles.filterCheckbox}>
                      <input
                        type="checkbox"
                        checked={marketFilters.grades.includes(grade)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMarketFilters(prev => ({ ...prev, grades: [...prev.grades, grade] }));
                          } else {
                            setMarketFilters(prev => ({ ...prev, grades: prev.grades.filter(g => g !== grade) }));
                          }
                        }}
                        style={{ width: '14px', height: '14px' }}
                      />
                      <span style={{
                        ...styles.gradeBadge,
                        backgroundColor: getGradeColor(grade),
                        color: 'white',
                        width: '20px',
                        height: '20px',
                        fontSize: '0.6875rem',
                      }}>
                        {grade}
                      </span>
                    </label>
                  ))}
                </div>
                <div style={styles.filterGroup}>
                  <span style={styles.filterLabel}>Pennant:</span>
                  <select
                    style={styles.filterSelect}
                    value={marketFilters.pennantPresence}
                    onChange={(e) => setMarketFilters(prev => ({ ...prev, pennantPresence: e.target.value }))}
                  >
                    <option value="all">All Markets</option>
                    <option value="with">With Pennant Hospice</option>
                    <option value="without">Without Pennant Hospice</option>
                  </select>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>
                  Showing {filteredAndSortedMarkets.length} markets
                </div>
              </div>

              {/* Section 5: Market Rankings Table */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardTitle}>
                    <Target size={16} style={{ color: '#3b82f6' }} />
                    Market Rankings
                  </div>
                </div>
                <div style={{ ...styles.cardBody, maxHeight: '600px' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: '40px' }}>#</th>
                        <th style={styles.th} onClick={() => handleMarketSort('geo_name')}>
                          Market <SortIcon field="geo_name" sort={marketSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleMarketSort('pop_65_plus')}>
                          Pop 65+ <SortIcon field="pop_65_plus" sort={marketSort} />
                        </th>
                        {marketScoringMode === 'footprint' ? (
                          <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleMarketSort('pennant_synergy_score')}>
                            Synergy <SortIcon field="pennant_synergy_score" sort={marketSort} />
                          </th>
                        ) : (
                          <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleMarketSort('market_opportunity_score')}>
                            Mkt Opp <SortIcon field="market_opportunity_score" sort={marketSort} />
                          </th>
                        )}
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleMarketSort('demand_score')}>
                          Demand <SortIcon field="demand_score" sort={marketSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleMarketSort('quality_gap_score')}>
                          Quality <SortIcon field="quality_gap_score" sort={marketSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleMarketSort('opportunity_score')}>
                          Score <SortIcon field="opportunity_score" sort={marketSort} />
                        </th>
                        <th style={{ ...styles.th, textAlign: 'center' }}>Grade</th>
                        <th style={{ ...styles.th, width: '80px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedMarkets.slice(0, 100).map((market, i) => {
                        const hasPennant = market.pennant_hospice_count > 0;
                        return (
                          <tr
                            key={market.geo_code}
                            style={hasPennant ? styles.pennantPresenceRow : {}}
                          >
                            <td style={{ ...styles.td, color: '#64748b', fontSize: '0.75rem' }}>{i + 1}</td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div>
                                  <strong>{market.geo_name}</strong>
                                  {hasPennant && (
                                    <span style={{ ...styles.pennantPresenceBadge, marginLeft: '0.5rem' }}>
                                      <Heart size={10} /> {market.pennant_hospice_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {market.pop_65_plus?.toLocaleString() || '-'}
                            </td>
                            {marketScoringMode === 'footprint' ? (
                              <td style={{ ...styles.td, textAlign: 'right' }}>
                                {market.pennant_synergy_score?.toFixed(1) || '-'}
                              </td>
                            ) : (
                              <td style={{ ...styles.td, textAlign: 'right' }}>
                                {market.market_opportunity_score?.toFixed(1) || '-'}
                              </td>
                            )}
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {market.demand_score?.toFixed(1) || '-'}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              {market.quality_gap_score?.toFixed(1) || '-'}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <span style={styles.opportunityScore}>
                                {market.opportunity_score?.toFixed(1)}
                              </span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <span style={{
                                ...styles.gradeBadge,
                                backgroundColor: getGradeColor(market.grade),
                                color: 'white',
                              }}>
                                {market.grade}
                              </span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <button
                                style={styles.viewDetailsBtn}
                                onClick={() => handleViewMarketDetail(market)}
                              >
                                <Eye size={12} /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Section 6: Market Detail Panel */}
          {showMarketDetail && selectedMarket && (
            <>
              <div
                style={styles.detailPanelBackdrop}
                onClick={() => {
                  setShowMarketDetail(false);
                  setSelectedMarket(null);
                  setMarketDetail(null);
                }}
              />
              <div style={styles.marketDetailModal}>
                <div style={styles.detailPanelHeader}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={styles.detailPanelTitle}>{selectedMarket.geo_name}</div>
                      <span style={{
                        ...styles.gradeBadge,
                        backgroundColor: getGradeColor(selectedMarket.grade),
                        color: 'white',
                        width: '32px',
                        height: '32px',
                        fontSize: '1rem',
                      }}>
                        {selectedMarket.grade}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                      {marketScoringMode === 'footprint' ? 'Footprint Mode' : 'Greenfield Mode'} • CBSA {selectedMarket.geo_code}
                    </div>
                  </div>
                  <button
                    style={styles.detailPanelClose}
                    onClick={() => {
                      setShowMarketDetail(false);
                      setSelectedMarket(null);
                      setMarketDetail(null);
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={styles.detailPanelBody}>
                  {!marketDetail ? (
                    <div style={styles.loadingContainer}>
                      <Loader2 size={24} className="animate-spin" />
                      <span>Loading market details...</span>
                    </div>
                  ) : (
                    <>
                      {/* Overall Score */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>Overall Opportunity Score</div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1rem',
                          backgroundColor: '#0f172a',
                          borderRadius: '0.5rem',
                          border: '1px solid #334155',
                        }}>
                          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: getGradeColor(marketDetail.grade) }}>
                            {marketDetail.opportunity_score?.toFixed(1)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={styles.scoreBar}>
                              <div style={{
                                ...styles.scoreBarFill,
                                backgroundColor: getGradeColor(marketDetail.grade),
                                width: `${marketDetail.opportunity_score}%`,
                              }} />
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                              out of 100 possible points
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>Score Components</div>
                        <div style={styles.scoreBreakdownGrid}>
                          {marketScoringMode === 'footprint' && (
                            <div style={styles.scoreBreakdownCard}>
                              <div style={styles.scoreBreakdownHeader}>
                                <span style={styles.scoreBreakdownLabel}>Pennant Synergy</span>
                                <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>75%</span>
                              </div>
                              <div style={styles.scoreBreakdownValue}>
                                {marketDetail.component_scores?.pennant_synergy_score?.toFixed(1) || '-'}
                              </div>
                              <div style={styles.scoreBar}>
                                <div style={{
                                  ...styles.scoreBarFill,
                                  backgroundColor: '#22c55e',
                                  width: `${marketDetail.component_scores?.pennant_synergy_score || 0}%`,
                                }} />
                              </div>
                            </div>
                          )}
                          <div style={styles.scoreBreakdownCard}>
                            <div style={styles.scoreBreakdownHeader}>
                              <span style={styles.scoreBreakdownLabel}>Demand Score</span>
                              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                {marketScoringMode === 'footprint' ? '15%' : '40%'}
                              </span>
                            </div>
                            <div style={styles.scoreBreakdownValue}>
                              {marketDetail.component_scores?.demand_score?.toFixed(1) || '-'}
                            </div>
                            <div style={styles.scoreBar}>
                              <div style={{
                                ...styles.scoreBarFill,
                                backgroundColor: '#3b82f6',
                                width: `${marketDetail.component_scores?.demand_score || 0}%`,
                              }} />
                            </div>
                          </div>
                          {marketScoringMode === 'greenfield' && (
                            <div style={styles.scoreBreakdownCard}>
                              <div style={styles.scoreBreakdownHeader}>
                                <span style={styles.scoreBreakdownLabel}>Market Opportunity</span>
                                <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>40%</span>
                              </div>
                              <div style={styles.scoreBreakdownValue}>
                                {marketDetail.component_scores?.market_opportunity_score?.toFixed(1) || '-'}
                              </div>
                              <div style={styles.scoreBar}>
                                <div style={{
                                  ...styles.scoreBarFill,
                                  backgroundColor: '#8b5cf6',
                                  width: `${marketDetail.component_scores?.market_opportunity_score || 0}%`,
                                }} />
                              </div>
                            </div>
                          )}
                          <div style={styles.scoreBreakdownCard}>
                            <div style={styles.scoreBreakdownHeader}>
                              <span style={styles.scoreBreakdownLabel}>Quality Gap</span>
                              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                {marketScoringMode === 'footprint' ? '10%' : '20%'}
                              </span>
                            </div>
                            <div style={styles.scoreBreakdownValue}>
                              {marketDetail.component_scores?.quality_gap_score?.toFixed(1) || '-'}
                            </div>
                            <div style={styles.scoreBar}>
                              <div style={{
                                ...styles.scoreBarFill,
                                backgroundColor: '#eab308',
                                width: `${marketDetail.component_scores?.quality_gap_score || 0}%`,
                              }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Key Metrics */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>Market Metrics</div>
                        <div style={styles.metricsGrid}>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Population 65+</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.population_65_plus?.toLocaleString() || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Population 85+</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.population_85_plus?.toLocaleString() || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>65+ Growth Rate</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.growth_rate_65_plus ? `${marketDetail.metrics.growth_rate_65_plus.toFixed(1)}%` : '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Hospice Providers</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.hospice_provider_count || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Hospice per 100k 65+</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.hospice_per_100k_65?.toFixed(1) || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Hospice HHI</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.hospice_hhi?.toLocaleString() || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Ensign LT Beds</div>
                            <div style={{ ...styles.metricValue, color: '#22c55e' }}>
                              {marketDetail.metrics?.ensign_lt_beds?.toLocaleString() || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Pennant ALF Beds</div>
                            <div style={{ ...styles.metricValue, color: '#22c55e' }}>
                              {marketDetail.metrics?.pennant_alf_beds?.toLocaleString() || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Pennant HHAs</div>
                            <div style={{ ...styles.metricValue, color: '#3b82f6' }}>
                              {marketDetail.metrics?.pennant_hha_count || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Pennant Hospice</div>
                            <div style={{ ...styles.metricValue, color: '#9C27B0' }}>
                              {marketDetail.metrics?.pennant_hospice_count || '0'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Pennant ADC</div>
                            <div style={{ ...styles.metricValue, color: '#9C27B0' }}>
                              {marketDetail.metrics?.pennant_hospice_adc?.toLocaleString() || '-'}
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Market Avg Stars</div>
                            <div style={styles.metricValue}>
                              {marketDetail.metrics?.hospice_avg_star_rating ? (
                                <span style={styles.starRating}>
                                  <Star size={14} fill="#fbbf24" />
                                  {marketDetail.metrics.hospice_avg_star_rating.toFixed(1)}
                                </span>
                              ) : '-'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Percentile Rankings */}
                      <div style={styles.detailSection}>
                        <div style={styles.detailSectionTitle}>Percentile Rankings</div>
                        <div style={styles.metricsGrid}>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Pop 85+ Percentile</div>
                            <div style={styles.metricValue}>
                              {marketDetail.percentiles?.pop_85_plus_pctl}th
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Growth Rate Percentile</div>
                            <div style={styles.metricValue}>
                              {marketDetail.percentiles?.growth_rate_65_pctl}th
                            </div>
                          </div>
                          <div style={styles.metricItem}>
                            <div style={styles.metricLabel}>Hospice Density Percentile</div>
                            <div style={styles.metricValue}>
                              {marketDetail.percentiles?.hospice_per_100k_pctl}th
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PennantDashboard;
