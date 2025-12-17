import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import RiskExplainerCard from './RiskExplainerCard';
import CompositeRiskScore from './CompositeRiskScore';
import RegulatoryRiskCard from './RegulatoryRiskCard';
import StaffingRiskCard from './StaffingRiskCard';
import FinancialRiskCard from './FinancialRiskCard';
import RiskTrendCard from './RiskTrendCard';
import { getFacilityBenchmarks } from '../../../api/facilityService';

const RiskAnalysisTab = ({ facility }) => {
  const [benchmarks, setBenchmarks] = useState(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      if (!facility?.ccn) {
        setBenchmarks(null);
        return;
      }

      setLoadingBenchmarks(true);
      try {
        const data = await getFacilityBenchmarks(facility.ccn);
        if (data.success) {
          setBenchmarks(data.benchmarks);
        }
      } catch (err) {
        console.error('Failed to fetch benchmarks:', err);
      } finally {
        setLoadingBenchmarks(false);
      }
    };

    fetchBenchmarks();
  }, [facility?.ccn]);

  if (!facility) {
    return (
      <div className="placeholder-tab">
        <Shield size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view risk analysis.</p>
      </div>
    );
  }

  return (
    <div className="risk-analysis-tab">
      {/* Explainer (collapsible) */}
      <RiskExplainerCard />

      {/* Row 1: Composite Risk Score */}
      <CompositeRiskScore facility={facility} />

      {/* Row 2: Three risk breakdown cards */}
      <div className="risk-cards-row">
        <RegulatoryRiskCard facility={facility} benchmarks={benchmarks} />
        <StaffingRiskCard facility={facility} benchmarks={benchmarks} />
        <FinancialRiskCard facility={facility} benchmarks={benchmarks} />
      </div>

      {/* Row 3: Risk Trend */}
      <RiskTrendCard facility={facility} snapshots={facility.snapshots || []} />
    </div>
  );
};

export default RiskAnalysisTab;
