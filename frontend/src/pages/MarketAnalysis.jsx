import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  MapPin,
  Building2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Users,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { LocationSelector, StateSummary, MarketComparison, DataFreshness } from '../components/MarketAnalysis';
import MarketMap from '../components/MarketDynamicsTab/MarketMap';
import DemographicsPanel from '../components/MarketDynamicsTab/DemographicsPanel';
import SupplyScorecard from '../components/MarketDynamicsTab/SupplyScorecard';
import CompetitorTable from '../components/MarketDynamicsTab/CompetitorTable';
import StateBenchmarkPanel from '../components/MarketDynamicsTab/StateBenchmarkPanel';
import VBPPerformancePanel from '../components/MarketDynamicsTab/VBPPerformancePanel';
import {
  OverallGradeHeader,
  CategoryScorecard,
  OperatingMarginPanel,
  RisksOpportunitiesPanel,
} from '../components/MarketScorecard';
import {
  calculateScores,
  calculateOverallGrade,
  calculateImpliedMonthlyBudget,
  calculateLaborCostPerBed,
  generateRisksOpportunities,
  calculateDataConfidence,
} from '../utils/marketScoreCalculations';
import {
  getStateSummary,
  getMarketMetrics,
  getFacilitiesInCounty,
  getNationalBenchmarks,
} from '../api/marketService';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const styles = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    minHeight: 'calc(100vh - 60px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  facilityTypeToggle: {
    display: 'flex',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.5rem',
    padding: '0.25rem',
  },
  toggleButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  toggleButtonActive: {
    backgroundColor: 'white',
    color: '#111827',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  toggleButtonInactive: {
    backgroundColor: 'transparent',
    color: '#6b7280',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
    transition: 'all 0.15s',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
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
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '1.5rem',
    alignItems: 'stretch',
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
    marginBottom: '1.5rem',
  },
  noSelection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    color: '#9ca3af',
    textAlign: 'center',
    gap: '1rem',
  },
  noSelectionIcon: {
    opacity: 0.3,
  },
  noSelectionText: {
    fontSize: '1rem',
    fontWeight: 500,
  },
  noSelectionHint: {
    fontSize: '0.875rem',
  },
  compareButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  compareButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
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
  currentMarketHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  currentMarketTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  twoColumnUnequal: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
  },
};

// County-Level Content Component with Scorecard
const CountyLevelContent = ({
  marketData,
  facilityType,
  selectedState,
  selectedCounty,
  facilities,
  selectedFacility,
  setSelectedFacility,
  mapCenter,
  isInComparison,
  comparisonMarkets,
  handleAddToComparison,
  nationalBenchmarks,
  stateSummary,
  stateBenchmarks,
}) => {
  // Calculate scores using the market data
  const laborData = useMemo(() => {
    // Extract labor data from market data or use defaults
    const demographics = marketData?.demographics;
    return {
      state_cna_wage: marketData?.labor?.cnaWage || 15.50,
      state_lpn_wage: marketData?.labor?.lpnWage || 23.00,
      state_rn_wage: marketData?.labor?.rnWage || 36.00,
      cbsa_wage_index: marketData?.labor?.wageIndex || 1.0,
      healthcare_unemployment: marketData?.labor?.healthcareUnemployment || 3.0,
    };
  }, [marketData]);

  // Pass marketData directly - the CategoryScorecard handles the nested structure
  const preparedMarketData = useMemo(() => {
    if (!marketData) return null;
    // Return the marketData as-is since it already has the correct nested structure
    // (demographics.population.age65Plus, demographics.economics.medianHouseholdIncome, etc.)
    return marketData;
  }, [marketData]);

  const scores = useMemo(() => {
    return calculateScores(preparedMarketData, facilityType, laborData);
  }, [preparedMarketData, facilityType, laborData]);

  const overallGrade = useMemo(() => {
    return calculateOverallGrade(scores, facilityType);
  }, [scores, facilityType]);

  const dataConfidence = useMemo(() => {
    return calculateDataConfidence(preparedMarketData);
  }, [preparedMarketData]);

  const risksOpportunities = useMemo(() => {
    return generateRisksOpportunities(preparedMarketData, facilityType, scores, laborData);
  }, [preparedMarketData, facilityType, scores, laborData]);

  // Calculate market averages from facilities for benchmark comparison
  const marketAverages = useMemo(() => {
    if (!facilities || facilities.length === 0) return null;

    const avg = (arr) => {
      const valid = arr.filter(v => v != null && !isNaN(v));
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    return {
      // Staffing averages
      avgRnHours: avg(facilities.map(f => f.staffing?.rnHours || f.rn_staffing_hours)),
      avgLpnHours: avg(facilities.map(f => f.staffing?.lpnHours || f.lpn_staffing_hours)),
      avgCnaHours: avg(facilities.map(f => f.staffing?.cnaHours || f.reported_cna_staffing_hours)),
      avgTotalNurseHours: avg(facilities.map(f => f.staffing?.totalNurseHours || f.total_nurse_staffing_hours)),
      // Turnover averages
      avgTurnover: avg(facilities.map(f => f.turnover?.totalNursing || f.total_nursing_turnover)),
      avgRnTurnover: avg(facilities.map(f => f.turnover?.rn || f.rn_turnover)),
      // Quality averages
      avgRating: avg(facilities.map(f => f.ratings?.overall || f.overall_rating)),
      avgHealthRating: avg(facilities.map(f => f.ratings?.healthInspection || f.health_inspection_rating)),
      avgQualityRating: avg(facilities.map(f => f.ratings?.qualityMeasure || f.quality_measure_rating)),
      avgStaffingRating: avg(facilities.map(f => f.ratings?.staffing || f.staffing_rating)),
    };
  }, [facilities]);

  const impliedRevenue = useMemo(() => {
    const income = preparedMarketData?.demographics?.medianHouseholdIncome || 0;
    return calculateImpliedMonthlyBudget(income);
  }, [preparedMarketData]);

  const laborCost = useMemo(() => {
    return calculateLaborCostPerBed(laborData);
  }, [laborData]);

  return (
    <>
      {/* Overall Grade Header */}
      <OverallGradeHeader
        grade={overallGrade}
        confidence={dataConfidence}
        countyName={selectedCounty}
        stateName={selectedState}
        facilityType={facilityType}
        onAddCompare={handleAddToComparison}
        isInComparison={isInComparison}
        comparisonFull={comparisonMarkets.length >= 3}
      />

      {/* Main Layout: Map on left (50%), Scorecards in 2 columns on right (50%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '1rem',
      }}>
        {/* Left Column: Map */}
        <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', minHeight: '450px' }}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <MapPin size={16} />
              Facilities Map
            </span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {facilities.length} facilities
            </span>
          </div>
          <div style={{ ...styles.cardBody, padding: 0, flex: 1 }}>
            {mapCenter ? (
              <MarketMap
                centerLat={mapCenter.lat}
                centerLon={mapCenter.lon}
                competitors={facilities}
                facilityType={facilityType}
                selectedCompetitor={selectedFacility}
                onCompetitorSelect={setSelectedFacility}
                facilityName={null}
              />
            ) : (
              <div style={styles.noSelection}>
                <MapPin size={32} style={styles.noSelectionIcon} />
                <div>No facilities with coordinates</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scorecards in 2 columns */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Category Scorecards - 2 column grid */}
          {scores && (
            <CategoryScorecard
              scores={scores}
              marketData={preparedMarketData}
              facilityType={facilityType}
              laborData={laborData}
            />
          )}

          {/* Operating Margin and Risks side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <OperatingMarginPanel
              impliedRevenue={impliedRevenue}
              laborCost={laborCost}
            />
            <RisksOpportunitiesPanel
              risks={risksOpportunities.risks}
              opportunities={risksOpportunities.opportunities}
            />
          </div>
        </div>
      </div>

      {/* State Benchmark Comparison - SNF only */}
      {facilityType === 'SNF' && stateBenchmarks && marketAverages && (
        <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>
              <BarChart3 size={16} />
              County vs State Benchmarks ({selectedState})
            </span>
            <span style={{ fontSize: '0.625rem', color: '#6b7280' }}>
              Comparing {facilities.length} facilities in {selectedCounty} County
            </span>
          </div>
          <div style={styles.cardBody}>
            <StateBenchmarkPanel
              benchmarks={stateBenchmarks}
              marketAverages={marketAverages}
              stateCode={selectedState}
            />
          </div>
        </div>
      )}

      {/* Facilities Table - Enhanced with Staffing/Turnover */}
      <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>
            <Building2 size={16} />
            Facilities ({facilities.length})
          </span>
          {selectedFacility && (
            <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 500 }}>
              Selected: {selectedFacility.facilityName || selectedFacility.facility_name}
            </span>
          )}
        </div>
        <div style={{ ...styles.cardBody, padding: 0 }}>
          <CompetitorTable
            competitors={facilities}
            facilityType={facilityType}
            selectedCompetitor={selectedFacility}
            onCompetitorSelect={setSelectedFacility}
          />
        </div>

        {/* VBP Performance Panel - shown when SNF facility selected */}
        {facilityType === 'SNF' && selectedFacility && (
          <div style={{ padding: '0 1rem 1rem 1rem' }}>
            <VBPPerformancePanel
              ccn={selectedFacility.federalProviderNumber || selectedFacility.federal_provider_number}
              facilityName={selectedFacility.facilityName || selectedFacility.facility_name}
            />
          </div>
        )}
      </div>

      {/* Demographics Panel */}
      <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>
            <Users size={16} />
            Market Demographics
          </span>
        </div>
        <div style={styles.cardBody}>
          <DemographicsPanel demographics={marketData.demographics} />
        </div>
      </div>
    </>
  );
};

const MarketAnalysis = () => {
  // Location state
  const [selectedState, setSelectedState] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [facilityType, setFacilityType] = useState('SNF');

  // Data state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stateSummary, setStateSummary] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);

  // Comparison state
  const [comparisonMarkets, setComparisonMarkets] = useState([]);

  // National benchmarks state
  const [nationalBenchmarks, setNationalBenchmarks] = useState(null);

  // CMS State benchmarks for staffing/turnover comparison
  const [stateBenchmarks, setStateBenchmarks] = useState(null);

  // Fetch national benchmarks when facility type changes
  useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        const res = await getNationalBenchmarks(facilityType);
        if (res.success) {
          setNationalBenchmarks(res.data);
        }
      } catch (err) {
        console.error('Error fetching national benchmarks:', err);
      }
    };
    fetchBenchmarks();
  }, [facilityType]);

  // Fetch data when location changes
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedState) {
        setStateSummary(null);
        setMarketData(null);
        setFacilities([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch CMS state benchmarks for SNF (staffing/turnover data)
        if (facilityType === 'SNF' && selectedState) {
          try {
            const benchmarksRes = await axios.get(`${API_BASE}/api/market/benchmarks/${selectedState}`);
            if (benchmarksRes.data.success) {
              setStateBenchmarks(benchmarksRes.data.data);
            }
          } catch (benchmarkErr) {
            console.warn('[MarketAnalysis] Failed to fetch state benchmarks:', benchmarkErr.message);
            setStateBenchmarks(null);
          }
        } else {
          setStateBenchmarks(null);
        }

        if (selectedCounty) {
          // Fetch county-level data AND state summary for benchmarking
          const [metricsRes, facilitiesRes, stateSummaryRes] = await Promise.all([
            getMarketMetrics(selectedState, selectedCounty, facilityType),
            getFacilitiesInCounty(selectedState, selectedCounty, facilityType),
            getStateSummary(selectedState, facilityType),
          ]);

          if (metricsRes.success) {
            setMarketData(metricsRes.data);
          }
          if (facilitiesRes.success) {
            setFacilities(facilitiesRes.data);
          }
          // Keep state summary for county-level benchmarking
          if (stateSummaryRes.success) {
            setStateSummary(stateSummaryRes.data);
          }
        } else {
          // Fetch state-level summary only
          const summaryRes = await getStateSummary(selectedState, facilityType);
          if (summaryRes.success) {
            setStateSummary(summaryRes.data);
          }
          setMarketData(null);
          setFacilities([]);
        }
      } catch (err) {
        console.error('Error fetching market data:', err);
        setError(err.response?.data?.error || err.message || 'Failed to fetch market data');
      }

      setLoading(false);
    };

    fetchData();
  }, [selectedState, selectedCounty, facilityType]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    // Force re-fetch by toggling state
    const state = selectedState;
    const county = selectedCounty;
    setSelectedState('');
    setSelectedCounty('');
    setTimeout(() => {
      setSelectedState(state);
      setSelectedCounty(county);
    }, 0);
  }, [selectedState, selectedCounty]);

  // Handle facility selection from search
  const handleFacilitySelect = useCallback((facility) => {
    if (facility) {
      setSelectedState(facility.state);
      setSelectedCounty(facility.county);
    }
  }, []);

  // Handle facility type change
  const handleFacilityTypeChange = useCallback((type) => {
    setFacilityType(type);
    // Clear comparison when changing facility type
    setComparisonMarkets([]);
  }, []);

  // Add market to comparison
  const handleAddToComparison = useCallback(() => {
    if (!selectedCounty || !marketData) return;
    if (comparisonMarkets.length >= 3) {
      alert('Maximum 3 markets can be compared');
      return;
    }

    // Check if already in comparison
    const exists = comparisonMarkets.some(
      (m) => m.state === selectedState && m.county === selectedCounty
    );
    if (exists) {
      alert('This market is already in comparison');
      return;
    }

    setComparisonMarkets((prev) => [
      ...prev,
      {
        state: selectedState,
        county: selectedCounty,
        data: marketData,
      },
    ]);
  }, [selectedState, selectedCounty, marketData, comparisonMarkets]);

  // Remove market from comparison
  const handleRemoveFromComparison = useCallback((index) => {
    setComparisonMarkets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all comparison markets
  const handleClearComparison = useCallback(() => {
    setComparisonMarkets([]);
  }, []);

  // Calculate map center from facilities
  const mapCenter = useMemo(() => {
    if (facilities.length === 0) return null;
    const validFacilities = facilities.filter((f) => f.latitude && f.longitude);
    if (validFacilities.length === 0) return null;

    const avgLat = validFacilities.reduce((sum, f) => sum + f.latitude, 0) / validFacilities.length;
    const avgLon = validFacilities.reduce((sum, f) => sum + f.longitude, 0) / validFacilities.length;

    return { lat: avgLat, lon: avgLon };
  }, [facilities]);

  // Check if current market is in comparison
  const isInComparison = useMemo(() => {
    return comparisonMarkets.some(
      (m) => m.state === selectedState && m.county === selectedCounty
    );
  }, [comparisonMarkets, selectedState, selectedCounty]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <h1 style={styles.title}>
            <TrendingUp size={28} />
            Market Analysis
          </h1>
          <p style={styles.subtitle}>
            Explore market intelligence for skilled nursing and assisted living facilities across the US
          </p>
        </div>

        <div style={styles.controls}>
          {/* Facility Type Toggle */}
          <div style={styles.facilityTypeToggle}>
            <button
              style={{
                ...styles.toggleButton,
                ...(facilityType === 'SNF' ? styles.toggleButtonActive : styles.toggleButtonInactive),
              }}
              onClick={() => handleFacilityTypeChange('SNF')}
            >
              SNF
            </button>
            <button
              style={{
                ...styles.toggleButton,
                ...(facilityType === 'ALF' ? styles.toggleButtonActive : styles.toggleButtonInactive),
              }}
              onClick={() => handleFacilityTypeChange('ALF')}
            >
              ALF
            </button>
          </div>

          {/* Refresh Button */}
          {selectedState && (
            <button style={styles.refreshButton} onClick={handleRefresh}>
              <RefreshCw size={16} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Data Freshness Status */}
      <DataFreshness compact={true} showRefreshButton={false} />

      {/* Location Selector */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>
            <MapPin size={16} />
            Select Market
          </span>
          <span style={{
            ...styles.badge,
            ...(facilityType === 'SNF' ? styles.snfBadge : styles.alfBadge),
          }}>
            {facilityType === 'SNF' ? 'Skilled Nursing' : 'Assisted Living'}
          </span>
        </div>
        <div style={styles.cardBody}>
          <LocationSelector
            facilityType={facilityType}
            selectedState={selectedState}
            selectedCounty={selectedCounty}
            onStateChange={setSelectedState}
            onCountyChange={setSelectedCounty}
            onFacilitySelect={handleFacilitySelect}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={styles.loading}>
          <Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <div>Loading market intelligence...</div>
        </div>
      )}

      {/* No Selection State */}
      {!loading && !selectedState && (
        <div style={styles.card}>
          <div style={styles.noSelection}>
            <MapPin size={64} style={styles.noSelectionIcon} />
            <div style={styles.noSelectionText}>Select a Market to Begin</div>
            <div style={styles.noSelectionHint}>
              Choose a state and county from the dropdowns above, or search by facility name
            </div>
          </div>
        </div>
      )}

      {/* State Summary (when state selected but no county) */}
      {!loading && selectedState && !selectedCounty && stateSummary && (
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <StateSummary
              data={stateSummary}
              facilityType={facilityType}
              nationalBenchmarks={nationalBenchmarks}
            />
          </div>
        </div>
      )}

      {/* County-Level Content */}
      {!loading && selectedCounty && marketData && (
        <CountyLevelContent
          marketData={marketData}
          facilityType={facilityType}
          selectedState={selectedState}
          selectedCounty={selectedCounty}
          facilities={facilities}
          selectedFacility={selectedFacility}
          setSelectedFacility={setSelectedFacility}
          mapCenter={mapCenter}
          isInComparison={isInComparison}
          comparisonMarkets={comparisonMarkets}
          handleAddToComparison={handleAddToComparison}
          nationalBenchmarks={nationalBenchmarks}
          stateSummary={stateSummary}
          stateBenchmarks={stateBenchmarks}
        />
      )}

      {/* Market Comparison Panel */}
      {comparisonMarkets.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <MarketComparison
            markets={comparisonMarkets}
            facilityType={facilityType}
            onRemoveMarket={handleRemoveFromComparison}
            onClearAll={handleClearComparison}
          />
        </div>
      )}
    </div>
  );
};

export default MarketAnalysis;
