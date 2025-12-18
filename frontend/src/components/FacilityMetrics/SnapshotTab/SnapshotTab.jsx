import React from 'react';
import { Activity } from 'lucide-react';
import OverallHealthScoreCard from './OverallHealthScoreCard';
import StarRatingsCard from './StarRatingsCard';
import KeyMetricsComparisonCard from './KeyMetricsComparisonCard';
import FinancialIndicatorsCard from './FinancialIndicatorsCard';
import RiskFlagsCard from './RiskFlagsCard';
import OwnershipContextCard from './OwnershipContextCard';
import FacilityMapCard from './FacilityMapCard';
import CovidVaccinationCard from './CovidVaccinationCard';

const SnapshotTab = ({ facility, comparisonMode, benchmarks }) => {
  if (!facility) {
    return (
      <div className="placeholder-tab">
        <Activity size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view its snapshot.</p>
      </div>
    );
  }

  return (
    <div className="snapshot-tab">
      {/* Row 1: Overall Health Score + Star Ratings */}
      <div className="snapshot-row">
        <OverallHealthScoreCard facility={facility} />
        <StarRatingsCard facility={facility} />
      </div>

      {/* Row 2: Key Metrics Comparison */}
      <KeyMetricsComparisonCard facility={facility} comparisonMode={comparisonMode} benchmarks={benchmarks} />

      {/* Row 3: Financial Indicators + Risk Flags */}
      <div className="snapshot-row">
        <FinancialIndicatorsCard facility={facility} />
        <RiskFlagsCard facility={facility} />
      </div>

      {/* Row 4: COVID Vaccination + Ownership */}
      <div className="snapshot-row">
        <CovidVaccinationCard facility={facility} />
        <OwnershipContextCard facility={facility} />
      </div>

      {/* Row 5: Location Map with Competitors */}
      <FacilityMapCard facility={facility} />
    </div>
  );
};

export default SnapshotTab;
