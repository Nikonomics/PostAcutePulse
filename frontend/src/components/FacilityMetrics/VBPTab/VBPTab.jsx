import React, { useState, useEffect, useCallback } from 'react';
import { Award } from 'lucide-react';
import { TabEmpty, TabError, TabSkeleton } from '../shared';
import { getFacilityVBP } from '../../../api/facilityService';
import VBPPerformanceSummary from './VBPPerformanceSummary';
import VBPMeasureCards from './VBPMeasureCards';
import VBPTrendChart from './VBPTrendChart';
import VBPCompetitivePosition from './VBPCompetitivePosition';
import VBPMetricsTable from './VBPMetricsTable';
import VBPFinancialImpact from './VBPFinancialImpact';
import './VBPTab.css';

const VBPTab = ({ facility }) => {
  const [vbpData, setVbpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get CCN from facility object
  const ccn = facility?.federal_provider_number || facility?.ccn;

  const fetchVBPData = useCallback(async () => {
    if (!ccn) {
      setVbpData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getFacilityVBP(ccn);
      console.log('[VBPTab] Fetched VBP data:', response);

      if (response.success) {
        setVbpData(response.data);
      } else {
        setError('Failed to load VBP data');
      }
    } catch (err) {
      console.error('[VBPTab] Error fetching VBP data:', err);
      setError(err.message || 'Failed to load VBP data');
    } finally {
      setLoading(false);
    }
  }, [ccn]);

  useEffect(() => {
    fetchVBPData();
  }, [fetchVBPData]);

  // No facility selected
  if (!facility) {
    return (
      <div className="vbp-tab">
        <TabEmpty
          icon={<Award size={48} strokeWidth={1.5} />}
          title="Select a Facility"
          message="Use the search above to select a facility and view VBP performance."
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="vbp-tab">
        <TabSkeleton variant="mixed" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="vbp-tab">
        <TabError
          message={error}
          onRetry={fetchVBPData}
        />
      </div>
    );
  }

  // Empty state - no VBP data for this facility
  if (!vbpData || (!vbpData.current && (!vbpData.history || vbpData.history.length === 0))) {
    return (
      <div className="vbp-tab">
        <TabEmpty
          icon={<Award size={48} strokeWidth={1.5} />}
          title="No VBP Data Available"
          message="This facility does not participate in the SNF Value-Based Purchasing Program, or VBP data is not yet available."
        />
      </div>
    );
  }

  return (
    <div className="vbp-tab">
      <VBPPerformanceSummary vbpData={vbpData} facility={facility} />
      <VBPMeasureCards vbpData={vbpData} facility={facility} />
      <VBPTrendChart vbpData={vbpData} facility={facility} />
      <VBPCompetitivePosition vbpData={vbpData} facility={facility} />
      <VBPMetricsTable vbpData={vbpData} facility={facility} />
      <VBPFinancialImpact vbpData={vbpData} facility={facility} />
    </div>
  );
};

export default VBPTab;
