import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { getFacilityDeficiencies } from '../../../api/facilityService';
import DrillDownModal from './DrillDownModal';

// Scope/Severity descriptions from CMS
const SEVERITY_INFO = {
  'A': { level: 1, label: 'No actual harm, potential for minimal harm', color: '#22c55e' },
  'B': { level: 2, label: 'No actual harm, potential for minimal harm, pattern', color: '#22c55e' },
  'C': { level: 3, label: 'No actual harm, potential for minimal harm, widespread', color: '#84cc16' },
  'D': { level: 4, label: 'No actual harm, potential for more than minimal harm', color: '#eab308' },
  'E': { level: 5, label: 'No actual harm, potential for more than minimal harm, pattern', color: '#eab308' },
  'F': { level: 6, label: 'No actual harm, potential for more than minimal harm, widespread', color: '#f97316' },
  'G': { level: 7, label: 'Actual harm, isolated', color: '#f97316' },
  'H': { level: 8, label: 'Actual harm, pattern', color: '#ef4444' },
  'I': { level: 9, label: 'Actual harm, widespread', color: '#ef4444' },
  'J': { level: 10, label: 'Immediate jeopardy, isolated', color: '#dc2626' },
  'K': { level: 11, label: 'Immediate jeopardy, pattern', color: '#dc2626' },
  'L': { level: 12, label: 'Immediate jeopardy, widespread', color: '#991b1b' },
};

const DeficiencyDrillDown = ({ isOpen, onClose, ccn, facilityName, surveyDate = null }) => {
  const [deficiencies, setDeficiencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && ccn) {
      loadDeficiencies();
    }
  }, [isOpen, ccn, surveyDate]);

  const loadDeficiencies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFacilityDeficiencies(ccn);
      if (response.success) {
        let defs = response.deficiencies;
        // Filter to specific survey date if provided
        if (surveyDate) {
          const targetDate = new Date(surveyDate).toDateString();
          defs = defs.filter(d => new Date(d.survey_date).toDateString() === targetDate);
        }
        setDeficiencies(defs);
      } else {
        setError('Failed to load deficiencies');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityInfo = (code) => SEVERITY_INFO[code] || { level: 0, label: 'Unknown', color: '#9ca3af' };

  // Group deficiencies by survey date
  const groupedDeficiencies = deficiencies.reduce((acc, def) => {
    const date = def.survey_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(def);
    return acc;
  }, {});

  // Format title based on whether filtering by survey date
  const getTitle = () => {
    const name = facilityName || 'Facility';
    if (surveyDate) {
      const dateStr = new Date(surveyDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return `Survey Deficiencies - ${dateStr}`;
    }
    return `Deficiencies - ${name}`;
  };

  return (
    <DrillDownModal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      icon={AlertTriangle}
    >
      {loading ? (
        <div className="drilldown-loading">
          <Loader size={24} className="spinning" />
          <span>Loading deficiencies...</span>
        </div>
      ) : error ? (
        <div className="drilldown-error">{error}</div>
      ) : deficiencies.length === 0 ? (
        <div className="drilldown-empty">
          <CheckCircle size={32} style={{ color: '#22c55e' }} />
          <p>No deficiencies on record</p>
        </div>
      ) : (
        <>
          <div className="drilldown-summary">
            <span>{deficiencies.length} deficiencies from {Object.keys(groupedDeficiencies).length} surveys</span>
          </div>
          <div className="deficiency-list">
            {Object.entries(groupedDeficiencies)
              .sort(([a], [b]) => new Date(b) - new Date(a))
              .map(([date, defs]) => (
                <div key={date} className="survey-group">
                  <div className="survey-date-header">
                    Survey: {new Date(date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    <span className="survey-count">{defs.length} finding{defs.length !== 1 ? 's' : ''}</span>
                  </div>
                  {defs.map((def, index) => {
                    const severity = getSeverityInfo(def.scope_severity);
                    return (
                      <div
                        key={index}
                        className="deficiency-item"
                        style={{ borderLeftColor: severity.color }}
                      >
                        <div className="deficiency-header">
                          <span
                            className="deficiency-tag"
                            style={{ backgroundColor: severity.color }}
                          >
                            F{def.deficiency_tag}
                          </span>
                          <span className="deficiency-severity">
                            Severity: {def.scope_severity}
                          </span>
                          {def.is_corrected && (
                            <span className="deficiency-corrected">
                              <CheckCircle size={14} /> Corrected
                            </span>
                          )}
                        </div>
                        <p className="deficiency-text">{def.deficiency_text}</p>
                        <div className="deficiency-severity-desc">
                          {severity.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </>
      )}
    </DrillDownModal>
  );
};

export default DeficiencyDrillDown;
