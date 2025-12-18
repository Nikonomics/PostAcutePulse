import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  FileText,
  ArrowLeftRight,
} from 'lucide-react';
import FacilitySelector from './FacilitySelector';
import { SnapshotTab } from './SnapshotTab';
import TrendsTab from './TrendsTab';
import BenchmarksTab from './BenchmarksTab';
import RiskAnalysisTab from './RiskAnalysisTab';
import ReportsTab from './ReportsTab';
import { SkeletonFacilityMetrics } from './SkeletonCard';
import { ComparisonView } from './ComparisonView';
import { getFacilityProfile, getFacilityBenchmarks } from '../../api/facilityService';
import './FacilityMetrics.css';

/**
 * Normalize CMS field names to what UI components expect
 */
const normalizeFacilityData = (rawFacility) => {
  const beds = parseInt(rawFacility.certified_beds) || 1;
  const residents = parseInt(rawFacility.average_residents_per_day) || 0;

  return {
    ...rawFacility,
    // Calculated fields
    occupancy_rate: Math.round((residents / beds) * 100),
    // Staffing HPRD mappings
    total_nursing_hprd: parseFloat(rawFacility.reported_total_nurse_hrs) || null,
    rn_hprd: parseFloat(rawFacility.reported_rn_hrs) || null,
    lpn_hprd: parseFloat(rawFacility.reported_lpn_hrs) || null,
    cna_hprd: parseFloat(rawFacility.reported_na_hrs) || null,
    // Turnover mappings
    rn_turnover_rate: parseFloat(rawFacility.rn_turnover) || null,
    total_turnover_rate: parseFloat(rawFacility.total_nursing_turnover) || null,
    // Deficiency mappings
    total_deficiencies: parseInt(rawFacility.cycle1_total_health_deficiencies) || 0,
    health_deficiencies: parseInt(rawFacility.cycle1_standard_deficiencies) || 0,
    // Penalties
    total_penalties_amount: parseFloat(rawFacility.fine_total_dollars) || 0,
    // Census
    residents_total: residents,
    // Quality rating (qm_rating -> quality_rating)
    quality_rating: rawFacility.qm_rating || rawFacility.quality_rating,
  };
};

const TABS = [
  { id: 'snapshot', label: 'Snapshot', icon: Activity },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { id: 'risk', label: 'Risk Analysis', icon: AlertTriangle },
  { id: 'reports', label: 'Reports', icon: FileText },
];

const COMPARISON_MODES = [
  { id: 'state', label: 'State Avg' },
  { id: 'national', label: 'National' },
  { id: 'chain', label: 'Chain Avg' },
  { id: 'custom', label: 'Custom Group' },
];

const FacilityMetricsTab = () => {
  const { ccn: urlCcn } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize activeTab from URL or default to 'snapshot'
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['snapshot', 'trends', 'benchmarks', 'risk', 'reports'];
  const initialTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'snapshot';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('state');
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(!!urlCcn);
  const [showComparison, setShowComparison] = useState(false);
  const compareCcn = searchParams.get('compare');

  // Fetch benchmarks when facility changes
  useEffect(() => {
    if (selectedFacility?.ccn) {
      getFacilityBenchmarks(selectedFacility.ccn)
        .then((response) => {
          if (response.success) {
            setBenchmarks(response.benchmarks);
          }
        })
        .catch((error) => {
          console.error('Error fetching benchmarks:', error);
        });
    } else {
      setBenchmarks(null);
    }
  }, [selectedFacility?.ccn]);

  // Load facility from URL on mount
  useEffect(() => {
    if (urlCcn && !selectedFacility) {
      setIsLoadingFromUrl(true);
      getFacilityProfile(urlCcn)
        .then((response) => {
          if (response.success && response.facility) {
            const normalizedFacility = normalizeFacilityData(response.facility);
            setSelectedFacility({
              ...normalizedFacility,
              snapshots: response.snapshots || [],
              covidData: response.covidData || null,
            });
          }
        })
        .catch((error) => {
          console.error('Error loading facility from URL:', error);
        })
        .finally(() => {
          setIsLoadingFromUrl(false);
        });
    }
  }, [urlCcn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when tab changes
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'snapshot') {
      // Remove tab param for default tab
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleFacilitySelect = useCallback(async (facility) => {
    if (!facility) {
      setSelectedFacility(null);
      // Navigate to base path without CCN
      navigate('/facility-metrics', { replace: true });
      return;
    }

    // Set basic info immediately for UI responsiveness
    setSelectedFacility(facility);

    // Update URL with selected facility CCN
    const tabParam = activeTab !== 'snapshot' ? `?tab=${activeTab}` : '';
    navigate(`/facility-metrics/${facility.ccn}${tabParam}`, { replace: true });

    try {
      // Fetch full details by CCN
      const response = await getFacilityProfile(facility.ccn);

      if (response.success && response.facility) {
        const normalizedFacility = normalizeFacilityData(response.facility);
        setSelectedFacility({
          ...normalizedFacility,
          snapshots: response.snapshots || [],
          covidData: response.covidData || null,
        });
      }
    } catch (error) {
      console.error('Error fetching facility details:', error);
      // Keep basic facility data if full fetch fails
    }
  }, [navigate, activeTab]);

  const handleComparisonChange = useCallback((mode) => {
    setComparisonMode(mode);
  }, []);

  // Handle opening/closing comparison view
  const handleToggleComparison = useCallback(() => {
    if (showComparison) {
      // Close comparison - remove compare param from URL
      searchParams.delete('compare');
      setSearchParams(searchParams, { replace: true });
    }
    setShowComparison(!showComparison);
  }, [showComparison, searchParams, setSearchParams]);

  // Handle compare facility change
  const handleCompareFacilityChange = useCallback((ccn) => {
    if (ccn) {
      searchParams.set('compare', ccn);
    } else {
      searchParams.delete('compare');
    }
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Open comparison view if compare param is in URL
  useEffect(() => {
    if (compareCcn && selectedFacility && !showComparison) {
      setShowComparison(true);
    }
  }, [compareCcn, selectedFacility]);

  const renderTabContent = () => {
    // Show skeleton while loading facility from URL
    if (isLoadingFromUrl) {
      return <SkeletonFacilityMetrics />;
    }

    const props = {
      facility: selectedFacility,
      comparisonMode,
      benchmarks,
    };

    switch (activeTab) {
      case 'snapshot':
        return <SnapshotTab {...props} />;
      case 'trends':
        return <TrendsTab {...props} />;
      case 'benchmarks':
        return <BenchmarksTab {...props} />;
      case 'risk':
        return <RiskAnalysisTab {...props} />;
      case 'reports':
        return <ReportsTab {...props} />;
      default:
        return <SnapshotTab {...props} />;
    }
  };

  return (
    <div className="facility-metrics">
      {/* Facility Selector */}
      <div className="facility-metrics-header">
        <FacilitySelector
          selectedFacility={selectedFacility}
          onSelect={handleFacilitySelect}
        />

        {/* Comparison Mode Toggle */}
        <div className="comparison-toggle">
          <span className="comparison-label">Compare to:</span>
          <div className="comparison-buttons">
            {COMPARISON_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`comparison-btn ${comparisonMode === mode.id ? 'active' : ''}`}
                onClick={() => handleComparisonChange(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compare Button - show when facility is selected */}
        {selectedFacility && (
          <button
            className={`compare-btn ${showComparison ? 'active' : ''}`}
            onClick={handleToggleComparison}
          >
            <ArrowLeftRight size={16} />
            Compare
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="facility-metrics-tabs">
        <div className="facility-metrics-tabs-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`facility-metrics-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison View */}
      {showComparison && selectedFacility && (
        <ComparisonView
          facilityA={selectedFacility}
          compareCcn={compareCcn}
          onClose={handleToggleComparison}
          onCompareFacilityChange={handleCompareFacilityChange}
        />
      )}

      {/* Tab Content */}
      <div className="facility-metrics-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default FacilityMetricsTab;
