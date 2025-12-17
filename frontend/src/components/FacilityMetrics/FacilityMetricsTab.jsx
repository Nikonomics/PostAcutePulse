import React, { useState, useCallback } from 'react';
import {
  Activity,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import FacilitySelector from './FacilitySelector';
import { SnapshotTab } from './SnapshotTab';
import TrendsTab from './TrendsTab';
import BenchmarksTab from './BenchmarksTab';
import RiskAnalysisTab from './RiskAnalysisTab';
import ReportsTab from './ReportsTab';
import { getFacilityProfile } from '../../api/facilityService';
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
  const [activeTab, setActiveTab] = useState('snapshot');
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('state');

  const handleFacilitySelect = useCallback(async (facility) => {
    if (!facility) {
      setSelectedFacility(null);
      return;
    }

    // Set basic info immediately for UI responsiveness
    setSelectedFacility(facility);

    try {
      // Fetch full details by CCN
      const response = await getFacilityProfile(facility.ccn);

      if (response.success && response.facility) {
        const normalizedFacility = normalizeFacilityData(response.facility);
        setSelectedFacility({
          ...normalizedFacility,
          snapshots: response.snapshots || [], // Include historical snapshots for Trends tab
        });
      }
    } catch (error) {
      console.error('Error fetching facility details:', error);
      // Keep basic facility data if full fetch fails
    }
  }, []);

  const handleComparisonChange = useCallback((mode) => {
    setComparisonMode(mode);
  }, []);

  const renderTabContent = () => {
    const props = {
      facility: selectedFacility,
      comparisonMode,
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
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="facility-metrics-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default FacilityMetricsTab;
