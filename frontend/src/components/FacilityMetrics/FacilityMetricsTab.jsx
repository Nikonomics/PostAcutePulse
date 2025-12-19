import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Award,
  FileText,
  ArrowLeftRight,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Loader,
  MapPin,
  Building2,
  Users,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import FacilitySelector from './FacilitySelector';
import { SnapshotTab } from './SnapshotTab';
import TrendsTab from './TrendsTab';
import BenchmarksTab from './BenchmarksTab';
import RiskAnalysisTab from './RiskAnalysisTab';
import VBPTab from './VBPTab';
import OwnershipTab from './OwnershipTab';
import { CompetitionTab } from './CompetitionTab';
import ReportsTab from './ReportsTab';
import SurveyIntelligenceTab from './SurveyIntelligenceTab';
import { SkeletonFacilityMetrics } from './SkeletonCard';
import { ComparisonView } from './ComparisonView';
import AlertBanner from './AlertBanner';
import { getFacilityProfile, getFacilityBenchmarks } from '../../api/facilityService';
import { saveFacility, removeSavedItem, checkSavedItems } from '../../api/savedItemsService';
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
  { id: 'vbp', label: 'VBP', icon: Award },
  { id: 'ownership', label: 'Ownership', icon: Building2 },
  { id: 'competition', label: 'Competition', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'survey', label: 'Survey Intelligence', icon: ClipboardCheck },
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
  const validTabs = ['snapshot', 'trends', 'benchmarks', 'risk', 'vbp', 'ownership', 'competition', 'reports', 'survey'];
  const initialTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'snapshot';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('state');
  const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(!!urlCcn);
  const [showComparison, setShowComparison] = useState(false);
  const compareCcn = searchParams.get('compare');

  // Save/bookmark state
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState(null);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Back navigation - read 'from' param from URL
  const fromParam = searchParams.get('from');

  // Sync activeTab with URL when tab param changes (e.g., navigating from competitor)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    } else if (!tabParam && activeTab !== 'snapshot') {
      // No tab in URL means default to snapshot
      setActiveTab('snapshot');
    }
  }, [searchParams, urlCcn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get contextual back button label based on 'from' value
  const getBackLabel = () => {
    switch (fromParam) {
      case 'deal': return 'Back to Deal';
      case 'market': return 'Back to Market Analysis';
      case 'search': return 'Back to Search';
      case 'ownership': return 'Back to Ownership Profile';
      default: return 'Back';
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // Fallback if no history
      navigate('/ownership-research');
    }
  };

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

  // Check if facility is saved when facility changes
  useEffect(() => {
    const checkIfSaved = async () => {
      if (!selectedFacility?.ccn) {
        setIsSaved(false);
        setSavedItemId(null);
        return;
      }

      try {
        const result = await checkSavedItems('cms_facility', { ccns: [selectedFacility.ccn] });
        if (result.success && result.data) {
          // API returns { data: { "CCN123": saved_item_id_or_null } }
          const savedItemId = result.data[selectedFacility.ccn];
          if (savedItemId) {
            setIsSaved(true);
            setSavedItemId(savedItemId);
          } else {
            setIsSaved(false);
            setSavedItemId(null);
          }
        }
      } catch (error) {
        console.error('Error checking saved status:', error);
        // Don't show error to user - just default to not saved
        setIsSaved(false);
        setSavedItemId(null);
      }
    };

    checkIfSaved();
  }, [selectedFacility?.ccn]);

  // Toggle save/bookmark
  const handleToggleSave = async () => {
    if (!selectedFacility?.ccn) return;

    setSavingBookmark(true);
    try {
      if (isSaved && savedItemId) {
        await removeSavedItem(savedItemId);
        setIsSaved(false);
        setSavedItemId(null);
        toast.success('Removed from saved items');
      } else {
        const result = await saveFacility(
          selectedFacility.ccn,
          selectedFacility.provider_name || selectedFacility.facility_name
        );

        if (result.success) {
          setIsSaved(true);
          setSavedItemId(result.data?.id);
          toast.success('Added to saved items');
        } else if (result.alreadySaved) {
          setIsSaved(true);
          setSavedItemId(result.saved_item_id);
          toast.info('Facility is already in your saved items');
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Failed to update saved status');
    } finally {
      setSavingBookmark(false);
    }
  };

  // Load facility from URL on mount or when URL CCN changes
  useEffect(() => {
    // Only load if URL has CCN and it's different from current facility (or no facility loaded)
    const currentCcn = selectedFacility?.ccn || selectedFacility?.federal_provider_number;
    const shouldLoad = urlCcn && (!currentCcn || urlCcn !== currentCcn);

    if (shouldLoad) {
      setIsLoadingFromUrl(true);
      getFacilityProfile(urlCcn)
        .then((response) => {
          if (response.success && response.facility) {
            const normalizedFacility = normalizeFacilityData(response.facility);
            setSelectedFacility({
              ...normalizedFacility,
              snapshots: response.snapshots || [],
              covidData: response.covidData || null,
              vbpScores: response.vbpScores || [],
              surveyDates: response.surveyDates || [],
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
          vbpScores: response.vbpScores || [],
          surveyDates: response.surveyDates || [],
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
      case 'vbp':
        return <VBPTab {...props} />;
      case 'ownership':
        return <OwnershipTab {...props} />;
      case 'competition':
        return <CompetitionTab {...props} />;
      case 'reports':
        return <ReportsTab {...props} />;
      case 'survey':
        return <SurveyIntelligenceTab {...props} />;
      default:
        return <SnapshotTab {...props} />;
    }
  };

  return (
    <div className="facility-metrics">
      {/* Top Navigation Bar - Back, Facility Info, Save */}
      {selectedFacility && (
        <div className="facility-metrics-nav">
          {/* Left: Back Button */}
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={18} />
            <span>{getBackLabel()}</span>
          </button>

          {/* Center: Facility Info */}
          <div className="facility-info-header">
            <h1 className="facility-name">
              {selectedFacility.provider_name || selectedFacility.facility_name}
            </h1>
            <div className="facility-meta">
              <span className="facility-address">
                <MapPin size={14} />
                {selectedFacility.city}, {selectedFacility.state}
              </span>
              <span className="facility-ccn">
                CCN: {selectedFacility.ccn}
              </span>
              <span className="facility-beds">
                <Building2 size={14} />
                {selectedFacility.certified_beds || selectedFacility.total_beds || 0} Beds
              </span>
            </div>
          </div>

          {/* Right: Save Button */}
          <button
            className={`save-button ${isSaved ? 'saved' : ''}`}
            onClick={handleToggleSave}
            disabled={savingBookmark}
            title={isSaved ? 'Remove from saved items' : 'Save facility'}
          >
            {savingBookmark ? (
              <Loader size={18} className="spin" />
            ) : isSaved ? (
              <BookmarkCheck size={18} />
            ) : (
              <Bookmark size={18} />
            )}
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      )}

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

      {/* Alert Banners */}
      {selectedFacility && <AlertBanner facility={selectedFacility} />}

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
