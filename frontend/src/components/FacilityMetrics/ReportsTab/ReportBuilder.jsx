import React from 'react';
import { Building2, Star, BarChart3, Target, AlertTriangle, FileWarning, DollarSign, TrendingUp } from 'lucide-react';

const REPORT_SECTIONS = {
  performance: {
    label: 'Performance',
    sections: [
      { id: 'overview', label: 'Facility Overview', icon: Building2, description: 'Name, address, CCN, beds, ownership' },
      { id: 'ratings', label: 'Star Ratings Summary', icon: Star, description: '4 ratings with national comparison' },
      { id: 'metrics', label: 'Key Metrics Table', icon: BarChart3, description: 'Staffing, turnover, occupancy, deficiencies' },
      { id: 'benchmarks', label: 'Benchmark Comparison', icon: Target, description: 'Facility vs market/state/national' },
    ],
  },
  risk: {
    label: 'Risk Assessment',
    sections: [
      { id: 'risk', label: 'Risk Assessment', icon: AlertTriangle, description: 'Composite score + breakdown' },
      { id: 'trends', label: 'Trends Summary', icon: TrendingUp, description: '6-month performance direction' },
    ],
  },
  history: {
    label: 'History',
    sections: [
      { id: 'deficiencies', label: 'Deficiency History', icon: FileWarning, description: 'Recent deficiencies with severity' },
      { id: 'penalties', label: 'Penalty History', icon: DollarSign, description: 'Fines and payment denials' },
    ],
  },
};

const ReportBuilder = ({ selectedSections, onSectionToggle, onSelectAll, onClearAll }) => {
  const allSections = Object.values(REPORT_SECTIONS).flatMap(group => group.sections);
  const allSelected = allSections.every(s => selectedSections.includes(s.id));
  const noneSelected = selectedSections.length === 0;

  return (
    <div className="report-builder">
      <div className="report-builder-header">
        <h3>Report Sections</h3>
        <div className="report-builder-actions">
          <button
            className="report-action-btn"
            onClick={onSelectAll}
            disabled={allSelected}
          >
            Select All
          </button>
          <button
            className="report-action-btn"
            onClick={onClearAll}
            disabled={noneSelected}
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="report-builder-groups">
        {Object.entries(REPORT_SECTIONS).map(([groupKey, group]) => (
          <div key={groupKey} className="report-section-group">
            <div className="report-group-label">{group.label}</div>
            <div className="report-section-list">
              {group.sections.map((section) => {
                const Icon = section.icon;
                const isSelected = selectedSections.includes(section.id);
                return (
                  <label
                    key={section.id}
                    className={`report-section-item ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSectionToggle(section.id)}
                    />
                    <div className="section-checkbox-mark">
                      {isSelected && (
                        <svg viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <Icon size={16} className="section-icon" />
                    <div className="section-info">
                      <span className="section-label">{section.label}</span>
                      <span className="section-description">{section.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="report-builder-summary">
        <span className="sections-count">
          {selectedSections.length} of {allSections.length} sections selected
        </span>
      </div>
    </div>
  );
};

export default ReportBuilder;
