import React from 'react';
import { BarChart3 } from 'lucide-react';

const BenchmarksTab = ({ facility, comparisonMode }) => {
  if (!facility) {
    return (
      <div className="placeholder-tab">
        <BarChart3 size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view benchmarks.</p>
      </div>
    );
  }

  return (
    <div className="placeholder-tab">
      <BarChart3 size={48} strokeWidth={1.5} />
      <h3>Coming soon: Benchmarks</h3>
      <p>Comparison to peer groups for {facility.provider_name || facility.facility_name}</p>
      <span className="comparison-indicator">Comparing to: {comparisonMode}</span>
    </div>
  );
};

export default BenchmarksTab;
