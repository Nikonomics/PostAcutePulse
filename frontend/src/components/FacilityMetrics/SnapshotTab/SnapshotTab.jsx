import React from 'react';
import { Activity } from 'lucide-react';
import OverallHealthScoreCard from './OverallHealthScoreCard';
import StarRatingsCard from './StarRatingsCard';
import KeyMetricsComparisonCard from './KeyMetricsComparisonCard';
import FinancialIndicatorsCard from './FinancialIndicatorsCard';
import RiskFlagsCard from './RiskFlagsCard';
import OwnershipContextCard from './OwnershipContextCard';

const SnapshotTab = ({ facility }) => {
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
      <KeyMetricsComparisonCard facility={facility} />

      {/* Row 3: Financial Indicators + Risk Flags */}
      <div className="snapshot-row">
        <FinancialIndicatorsCard facility={facility} />
        <RiskFlagsCard facility={facility} />
      </div>

      {/* Row 4: Ownership & Context (full width) */}
      <OwnershipContextCard facility={facility} />
    </div>
  );
};

export default SnapshotTab;
