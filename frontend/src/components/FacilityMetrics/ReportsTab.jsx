import React from 'react';
import { FileText } from 'lucide-react';

const ReportsTab = ({ facility, comparisonMode }) => {
  if (!facility) {
    return (
      <div className="placeholder-tab">
        <FileText size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and generate reports.</p>
      </div>
    );
  }

  return (
    <div className="placeholder-tab">
      <FileText size={48} strokeWidth={1.5} />
      <h3>Coming soon: Reports</h3>
      <p>Exportable report builder for {facility.provider_name || facility.facility_name}</p>
      <span className="comparison-indicator">Comparing to: {comparisonMode}</span>
    </div>
  );
};

export default ReportsTab;
