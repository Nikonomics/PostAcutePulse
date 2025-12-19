import React from 'react';
import { Shield } from 'lucide-react';
import RiskExplainerCard from './RiskExplainerCard';
import CompositeRiskScore from './CompositeRiskScore';
import RegulatoryRiskCard from './RegulatoryRiskCard';
import StaffingRiskCard from './StaffingRiskCard';
import FinancialRiskCard from './FinancialRiskCard';
import RiskTrendCard from './RiskTrendCard';
import SurveyHistory from './SurveyHistory';

const RiskAnalysisTab = ({ facility, benchmarks }) => {
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

      {/* Row 4: Survey History */}
      <SurveyHistory
        surveyDates={facility.surveyDates || []}
        ccn={facility.federal_provider_number}
        facilityName={facility.provider_name}
      />
    </div>
  );
};

export default RiskAnalysisTab;
