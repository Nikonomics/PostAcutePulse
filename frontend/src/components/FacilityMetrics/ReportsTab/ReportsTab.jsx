import React, { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import ReportBuilder from './ReportBuilder';
import ReportPreview from './ReportPreview';
import ExportButtons from './ExportButtons';
import { getFacilityBenchmarks, getFacilityDeficiencies, getFacilityPenalties } from '../../../api/facilityService';

const ALL_SECTIONS = ['overview', 'ratings', 'metrics', 'benchmarks', 'risk', 'trends', 'deficiencies', 'penalties'];

const ReportsTab = ({ facility }) => {
  const [selectedSections, setSelectedSections] = useState(['overview', 'ratings', 'metrics', 'risk']);
  const [benchmarks, setBenchmarks] = useState(null);
  const [deficiencies, setDeficiencies] = useState([]);
  const [penalties, setPenalties] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch benchmarks and drill-down data when facility changes
  useEffect(() => {
    const fetchData = async () => {
      if (!facility?.ccn) {
        setBenchmarks(null);
        setDeficiencies([]);
        setPenalties([]);
        return;
      }

      setLoading(true);
      try {
        // Fetch benchmarks
        const benchmarkResponse = await getFacilityBenchmarks(facility.ccn);
        if (benchmarkResponse.success) {
          setBenchmarks(benchmarkResponse.benchmarks);
        }

        // Fetch deficiencies
        try {
          const defResponse = await getFacilityDeficiencies(facility.ccn);
          if (defResponse.success) {
            setDeficiencies(defResponse.deficiencies || []);
          }
        } catch (err) {
          console.error('Failed to fetch deficiencies:', err);
        }

        // Fetch penalties
        try {
          const penResponse = await getFacilityPenalties(facility.ccn);
          if (penResponse.success) {
            setPenalties(penResponse.penalties || []);
          }
        } catch (err) {
          console.error('Failed to fetch penalties:', err);
        }
      } catch (err) {
        console.error('Failed to fetch report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facility?.ccn]);

  const handleSectionToggle = useCallback((sectionId) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSections(ALL_SECTIONS);
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedSections([]);
  }, []);

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
    <div className="reports-tab">
      <div className="reports-layout">
        {/* Left Column: Report Builder */}
        <div className="reports-sidebar">
          <ReportBuilder
            selectedSections={selectedSections}
            onSectionToggle={handleSectionToggle}
            onSelectAll={handleSelectAll}
            onClearAll={handleClearAll}
          />

          <ExportButtons
            facility={facility}
            benchmarks={benchmarks}
            deficiencies={deficiencies}
            penalties={penalties}
            selectedSections={selectedSections}
          />
        </div>

        {/* Right Column: Report Preview */}
        <div className="reports-preview-container">
          {loading ? (
            <div className="reports-loading">
              <div className="loading-spinner"></div>
              <span>Loading report data...</span>
            </div>
          ) : (
            <ReportPreview
              facility={facility}
              benchmarks={benchmarks}
              deficiencies={deficiencies}
              penalties={penalties}
              selectedSections={selectedSections}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
