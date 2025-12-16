import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Building2,
  Users,
  TrendingUp,
  Star,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import axios from 'axios';
import MarketMap from './MarketMap';
import CompetitorTable from './CompetitorTable';
import DemographicsPanel from './DemographicsPanel';
import SupplyScorecard from './SupplyScorecard';
import StateBenchmarkPanel from './StateBenchmarkPanel';
import VBPPerformancePanel from './VBPPerformancePanel';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
    transition: 'all 0.15s',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cardBody: {
    padding: '1rem',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#6b7280',
    gap: '1rem',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    color: '#b91c1c',
  },
  noData: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#9ca3af',
    textAlign: 'center',
    gap: '0.5rem',
  },
  radiusSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  radiusLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  radiusSelect: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.25rem',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  facilityTypeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '9999px',
  },
  snfBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  alfBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
};

const MarketDynamicsTab = ({ deal, extractionData }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [resolvedCounty, setResolvedCounty] = useState(null);
  const [stateBenchmarks, setStateBenchmarks] = useState(null);
  const [nationalBenchmarks, setNationalBenchmarks] = useState(null);

  // Determine facility type from deal or extraction data
  const facilityType = useMemo(() => {
    // Check deal.deal_facility or extraction data for type
    if (deal?.deal_facility?.[0]?.facility_type) {
      const type = deal.deal_facility[0].facility_type.toUpperCase();
      if (type.includes('ALF') || type.includes('ASSISTED')) return 'ALF';
      return 'SNF';
    }
    // Default to SNF
    return 'SNF';
  }, [deal]);

  // Extract location from deal data
  const location = useMemo(() => {
    // Try to get from deal.deal_facility
    if (deal?.deal_facility?.[0]) {
      const fac = deal.deal_facility[0];
      return {
        latitude: parseFloat(fac.latitude) || null,
        longitude: parseFloat(fac.longitude) || null,
        state: fac.state,
        county: fac.county,
        city: fac.city,
        facilityName: fac.facility_name,
      };
    }
    // Try from extraction data (check multiple possible structures)
    const ed = extractionData;
    if (ed) {
      // Try property_details structure
      if (ed.property_details) {
        const pd = ed.property_details;
        return {
          latitude: null,
          longitude: null,
          state: pd.state?.value || pd.state,
          county: pd.county?.value || pd.county,
          city: pd.city?.value || pd.city,
          facilityName: pd.facility_name?.value || pd.facility_name,
        };
      }
      // Try flat extraction data structure
      return {
        latitude: null,
        longitude: null,
        state: ed.state?.value || ed.state,
        county: ed.county?.value || ed.county,
        city: ed.city?.value || ed.city,
        facilityName: ed.facility_name?.value || ed.facility_name,
      };
    }
    return null;
  }, [deal, extractionData]);

  // Resolve county from lat/lon if not provided
  useEffect(() => {
    const resolveCounty = async () => {
      // Already have county
      if (location?.county) {
        setResolvedCounty(location.county);
        return;
      }

      // Try to get county from lat/lon using reverse geocoding
      if (location?.latitude && location?.longitude) {
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&addressdetails=1`,
            { headers: { 'User-Agent': 'SNFalyze/1.0' } }
          );
          const county = response.data?.address?.county;
          if (county) {
            // Remove "County" suffix if present
            const cleanCounty = county.replace(/\s+County$/i, '').trim();
            setResolvedCounty(cleanCounty);
            console.log(`[MarketDynamics] Resolved county from coords: ${cleanCounty}`);
            return;
          }
        } catch (err) {
          console.warn('[MarketDynamics] Failed to reverse geocode for county:', err.message);
        }
      }

      // Try to get county from city/state using forward geocoding
      if (location?.city && location?.state) {
        try {
          const query = encodeURIComponent(`${location.city}, ${location.state}, USA`);
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&addressdetails=1&limit=1`,
            { headers: { 'User-Agent': 'SNFalyze/1.0' } }
          );
          if (response.data?.[0]?.address?.county) {
            const county = response.data[0].address.county;
            const cleanCounty = county.replace(/\s+County$/i, '').trim();
            setResolvedCounty(cleanCounty);
            console.log(`[MarketDynamics] Resolved county from city/state: ${cleanCounty}`);
            return;
          }
        } catch (err) {
          console.warn('[MarketDynamics] Failed to geocode for county:', err.message);
        }
      }

      setResolvedCounty(null);
    };

    if (location) {
      resolveCounty();
    }
  }, [location?.county, location?.latitude, location?.longitude, location?.city, location?.state]);

  // Fetch market data
  const fetchMarketData = async () => {
    const countyToUse = resolvedCounty || location?.county;

    if (!location?.state || !countyToUse) {
      setError('Location data (state and county) is required for market analysis. County could not be determined from the available data.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch market metrics
      const metricsResponse = await axios.get(`${API_BASE}/api/market/metrics`, {
        params: {
          state: location.state,
          county: countyToUse,
          type: facilityType,
        },
      });

      if (metricsResponse.data.success) {
        setMarketData(metricsResponse.data.data);
      }

      // Fetch competitors if we have coordinates
      if (location.latitude && location.longitude) {
        const competitorsResponse = await axios.get(`${API_BASE}/api/market/competitors`, {
          params: {
            lat: location.latitude,
            lon: location.longitude,
            radius: radiusMiles,
            type: facilityType,
            limit: 50,
          },
        });

        if (competitorsResponse.data.success) {
          setCompetitors(competitorsResponse.data.data);
        }
      } else {
        setCompetitors([]);
      }

      // Fetch state and national benchmarks for SNFs
      if (facilityType === 'SNF' && location.state) {
        try {
          const [stateResponse, nationalResponse] = await Promise.all([
            axios.get(`${API_BASE}/api/market/benchmarks/${location.state}`),
            axios.get(`${API_BASE}/api/market/benchmarks/NATION`)
          ]);
          if (stateResponse.data.success) {
            setStateBenchmarks(stateResponse.data.data);
          }
          if (nationalResponse.data.success) {
            setNationalBenchmarks(nationalResponse.data.data);
          }
        } catch (benchmarkErr) {
          console.warn('[MarketDynamics] Failed to fetch benchmarks:', benchmarkErr.message);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch market data');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for county resolution before fetching
    if (resolvedCounty || location?.county) {
      fetchMarketData();
    }
  }, [location?.state, location?.county, resolvedCounty, facilityType, radiusMiles]);

  const handleRefresh = () => {
    fetchMarketData();
  };

  const handleRadiusChange = (e) => {
    setRadiusMiles(parseInt(e.target.value));
  };

  const handleCompetitorSelect = (competitor) => {
    setSelectedCompetitor(competitor);
  };

  // Calculate market averages from competitors for benchmark comparison
  const marketAverages = useMemo(() => {
    if (!competitors || competitors.length === 0) return null;

    const validCompetitors = competitors.filter(c => c.staffing || c.ratings);
    if (validCompetitors.length === 0) return null;

    const avg = (arr) => {
      const valid = arr.filter(v => v != null && !isNaN(v));
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    return {
      // Staffing averages
      avgRnHours: avg(competitors.map(c => c.staffing?.rnHours)),
      avgLpnHours: avg(competitors.map(c => c.staffing?.lpnHours)),
      avgCnaHours: avg(competitors.map(c => c.staffing?.cnaHours)),
      avgTotalNurseHours: avg(competitors.map(c => c.staffing?.totalNurseHours)),
      avgPtHours: avg(competitors.map(c => c.staffing?.ptHours)),
      // Turnover averages
      avgTurnover: avg(competitors.map(c => c.turnover?.totalNursing)),
      avgRnTurnover: avg(competitors.map(c => c.turnover?.rn)),
      // Quality averages
      avgRating: avg(competitors.map(c => c.ratings?.overall)),
      avgHealthRating: avg(competitors.map(c => c.ratings?.healthInspection)),
      avgQualityRating: avg(competitors.map(c => c.ratings?.qualityMeasure)),
      avgStaffingRating: avg(competitors.map(c => c.ratings?.staffing)),
    };
  }, [competitors]);

  if (!location) {
    return (
      <div style={styles.noData}>
        <MapPin size={48} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '1rem', fontWeight: 500 }}>No Location Data Available</div>
        <div style={{ fontSize: '0.875rem' }}>
          Add facility location information to see market dynamics
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        <div>Loading market intelligence...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>
            <MapPin size={20} />
            Market Dynamics
            <span style={{
              ...styles.facilityTypeBadge,
              ...(facilityType === 'SNF' ? styles.snfBadge : styles.alfBadge),
            }}>
              {facilityType}
            </span>
          </div>
          <div style={styles.subtitle}>
            {location.facilityName ? `${location.facilityName} - ` : ''}
            {resolvedCounty || location.county || location.city}{location.state ? `, ${location.state}` : ''}
          </div>
        </div>
        <button style={styles.refreshButton} onClick={handleRefresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Supply Scorecard */}
      {marketData && (
        <SupplyScorecard
          marketData={marketData}
          facilityType={facilityType}
        />
      )}

      {/* State Benchmark Comparison - SNF only */}
      {facilityType === 'SNF' && stateBenchmarks && marketAverages && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <BarChart3 size={16} />
              Market vs State Benchmarks ({location?.state})
            </span>
            <span style={{
              fontSize: '0.625rem',
              color: '#6b7280',
            }}>
              Comparing {competitors.length} facilities within {radiusMiles} mi
            </span>
          </div>
          <div style={styles.cardBody}>
            <StateBenchmarkPanel
              benchmarks={stateBenchmarks}
              nationalBenchmarks={nationalBenchmarks}
              marketAverages={marketAverages}
              stateCode={location?.state}
            />
          </div>
        </div>
      )}

      {/* Map and Demographics Grid */}
      <div style={styles.twoColumn}>
        {/* Map Section */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <MapPin size={16} />
              Competitor Map
            </span>
            <div style={styles.radiusSelector}>
              <span style={styles.radiusLabel}>Radius:</span>
              <select
                style={styles.radiusSelect}
                value={radiusMiles}
                onChange={handleRadiusChange}
              >
                <option value="5">5 mi</option>
                <option value="10">10 mi</option>
                <option value="15">15 mi</option>
                <option value="25">25 mi</option>
                <option value="50">50 mi</option>
              </select>
            </div>
          </div>
          <div style={{ ...styles.cardBody, padding: 0, height: '350px' }}>
            {location.latitude && location.longitude ? (
              <MarketMap
                centerLat={location.latitude}
                centerLon={location.longitude}
                competitors={competitors}
                facilityType={facilityType}
                selectedCompetitor={selectedCompetitor}
                onCompetitorSelect={handleCompetitorSelect}
                facilityName={location.facilityName}
              />
            ) : (
              <div style={styles.noData}>
                <MapPin size={32} style={{ opacity: 0.3 }} />
                <div>No coordinates available for map display</div>
                <div style={{ fontSize: '0.75rem' }}>
                  Add latitude/longitude to see competitor locations
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Demographics Panel */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <Users size={16} />
              Market Demographics
              {marketData?.demographics?.cbsaCode && (
                <span style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.7rem',
                  padding: '0.125rem 0.5rem',
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: '9999px',
                  fontWeight: 400
                }}>
                  {marketData.demographics.countyCount} counties
                </span>
              )}
            </span>
          </div>
          <div style={styles.cardBody}>
            {marketData?.demographics ? (
              <DemographicsPanel demographics={marketData.demographics} />
            ) : (
              <div style={styles.noData}>
                <Users size={32} style={{ opacity: 0.3 }} />
                <div>No demographics data available</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Competitor Table */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>
            <Building2 size={16} />
            Nearby Competitors ({competitors.length})
          </span>
          {selectedCompetitor && (
            <span style={{
              fontSize: '0.75rem',
              color: '#2563eb',
              fontWeight: 500,
            }}>
              Selected: {selectedCompetitor.facilityName}
            </span>
          )}
        </div>
        <div style={{ ...styles.cardBody, padding: 0 }}>
          <CompetitorTable
            competitors={competitors}
            facilityType={facilityType}
            selectedCompetitor={selectedCompetitor}
            onCompetitorSelect={handleCompetitorSelect}
          />
        </div>

        {/* VBP Performance Panel - shown when SNF competitor selected */}
        {facilityType === 'SNF' && selectedCompetitor && (
          <div style={{ padding: '0 1rem 1rem 1rem' }}>
            <VBPPerformancePanel
              ccn={selectedCompetitor.federalProviderNumber}
              facilityName={selectedCompetitor.facilityName}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketDynamicsTab;
