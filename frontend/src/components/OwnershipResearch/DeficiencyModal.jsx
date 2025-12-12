import { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, CheckCircle, ExternalLink, Info, Loader } from 'lucide-react';
import { getFacilityDeficiencies } from '../../api/ownershipService';
import './DeficiencyModal.css';

// Tag prefix information and CMS links
const TAG_INFO = {
  'F': {
    name: 'Quality of Care',
    description: 'Federal regulatory requirements for quality of care in nursing homes',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes'
  },
  'G': {
    name: 'Administration',
    description: 'Administrative requirements including governing body, medical director, and management',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes'
  },
  'K': {
    name: 'Life Safety Code',
    description: 'Life Safety Code requirements for building safety and fire protection',
    url: 'https://www.cms.gov/medicare/health-safety-standards/quality-safety-oversight-general-information/life-safety-code-informationl'
  },
  'E': {
    name: 'Environment',
    description: 'Physical environment requirements for nursing homes',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes'
  }
};

// Scope and Severity information
const SCOPE_SEVERITY_INFO = {
  'A': 'Isolated / No actual harm with potential for minimal harm',
  'B': 'Pattern / No actual harm with potential for minimal harm',
  'C': 'Widespread / No actual harm with potential for minimal harm',
  'D': 'Isolated / No actual harm with potential for more than minimal harm',
  'E': 'Pattern / No actual harm with potential for more than minimal harm',
  'F': 'Widespread / No actual harm with potential for more than minimal harm',
  'G': 'Isolated / Actual harm that is not immediate jeopardy',
  'H': 'Pattern / Actual harm that is not immediate jeopardy',
  'I': 'Widespread / Actual harm that is not immediate jeopardy',
  'J': 'Isolated / Immediate jeopardy to resident health or safety',
  'K': 'Pattern / Immediate jeopardy to resident health or safety',
  'L': 'Widespread / Immediate jeopardy to resident health or safety'
};

function DeficiencyModal({ facility, onClose }) {
  const [deficiencies, setDeficiencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeficiency, setExpandedDeficiency] = useState(null);
  const [prefixFilter, setPrefixFilter] = useState('all');
  const [availablePrefixes, setAvailablePrefixes] = useState([]);

  useEffect(() => {
    if (facility) {
      loadDeficiencies();
    }
  }, [facility]);

  const loadDeficiencies = async (prefix = 'all') => {
    setLoading(true);
    try {
      const providerId = facility.federal_provider_number;
      const response = await getFacilityDeficiencies(providerId, prefix, 3);

      if (response.success) {
        setDeficiencies(response.deficiencies || []);

        // Extract unique prefixes
        const prefixes = [...new Set(
          (response.deficiencies || [])
            .map(d => d.deficiency_prefix)
            .filter(Boolean)
        )];
        setAvailablePrefixes(prefixes.sort());
      }
    } catch (error) {
      console.error('Error loading deficiencies:', error);
      setDeficiencies([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrefixFilterChange = (newPrefix) => {
    setPrefixFilter(newPrefix);
    loadDeficiencies(newPrefix);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="deficiency-modal-overlay" onClick={onClose}>
      <div className="deficiency-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{facility.facility_name}</h3>
            <p className="modal-subtitle">Provider ID: {facility.federal_provider_number}</p>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close modal">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <Loader size={32} className="spinning" />
              <p>Loading deficiencies...</p>
            </div>
          ) : deficiencies.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={48} />
              <p>No deficiencies found for this facility in the last 3 years</p>
            </div>
          ) : (
            <>
              <div className="deficiency-summary">
                <div className="summary-row">
                  <p className="deficiency-count">
                    <strong>{deficiencies.length}</strong> deficiencies (last 3 years)
                  </p>
                  {availablePrefixes.length > 1 && (
                    <div className="prefix-filter">
                      <label htmlFor="prefix-select">Filter by type:</label>
                      <select
                        id="prefix-select"
                        value={prefixFilter}
                        onChange={(e) => handlePrefixFilterChange(e.target.value)}
                        className="prefix-select"
                      >
                        <option value="all">All Types</option>
                        {availablePrefixes.map(prefix => (
                          <option key={prefix} value={prefix}>{prefix}-Tag</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="deficiencies-list">
                {deficiencies.map((def, idx) => {
                  const tagInfo = TAG_INFO[def.deficiency_prefix];
                  const severityInfo = SCOPE_SEVERITY_INFO[def.scope_severity];
                  const fullTag = `${def.deficiency_prefix || ''}${def.deficiency_tag || ''}`;

                  return (
                    <div
                      key={def.id || idx}
                      className={`deficiency-item ${expandedDeficiency === (def.id || idx) ? 'expanded' : ''}`}
                    >
                      <div className="deficiency-header-row">
                        <div className="survey-info">
                          <span className="survey-type">{def.survey_type || 'Health'} Survey</span>
                          <span className="survey-date">{formatDate(def.survey_date)}</span>
                        </div>
                        <div className="status-badges">
                          {def.deficiency_tag && tagInfo && (
                            <a
                              href={tagInfo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="deficiency-tag clickable-tag"
                              onClick={(e) => e.stopPropagation()}
                              title={`${tagInfo.name}: ${tagInfo.description}`}
                            >
                              <span className="tag-code">{fullTag}</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {!tagInfo && def.deficiency_tag && (
                            <span className="deficiency-tag">Tag: {fullTag}</span>
                          )}
                          {def.is_corrected ? (
                            <span className="status-corrected">
                              <CheckCircle size={14} /> Corrected {formatDate(def.correction_date)}
                            </span>
                          ) : (
                            <span className="status-uncorrected">
                              <AlertTriangle size={14} /> Not Corrected
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tag and Severity Information */}
                      {(tagInfo || severityInfo) && (
                        <div className="deficiency-metadata">
                          {tagInfo && (
                            <div className="tag-info-row">
                              <Info size={14} className="info-icon" />
                              <span className="tag-category">{tagInfo.name}:</span>
                              <span className="tag-description">{tagInfo.description}</span>
                            </div>
                          )}
                          {severityInfo && (
                            <div className="severity-info-row">
                              <span className={`severity-badge severity-${(def.scope_severity || '').toLowerCase()}`}>
                                Severity: {def.scope_severity}
                              </span>
                              <span className="severity-description">{severityInfo}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        className="deficiency-text-container"
                        onClick={() => setExpandedDeficiency(
                          expandedDeficiency === (def.id || idx) ? null : (def.id || idx)
                        )}
                      >
                        <p className={`deficiency-text ${expandedDeficiency === (def.id || idx) ? '' : 'collapsed'}`}>
                          {def.deficiency_text}
                        </p>
                        {expandedDeficiency !== (def.id || idx) && (def.deficiency_text || '').length > 150 && (
                          <span className="expand-hint">Click to read more...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeficiencyModal;
