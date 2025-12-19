import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useWizard, WIZARD_STEPS } from '../WizardContext';
import ValidationAlerts from '../../../components/ValidationAlerts';

const DEAL_SOURCES = [
  { value: 'Broker', label: 'Broker' },
  { value: 'Off-market', label: 'Off-market' },
  { value: 'REIT', label: 'REIT' },
  { value: 'Other', label: 'Other' },
];

const STATUSES = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'due_diligence', label: 'Due Diligence' },
  { value: 'final_review', label: 'Final Review' },
  { value: 'closed', label: 'Closed' },
  { value: 'passed', label: 'Passed' },
];

const PRIORITY_LEVELS = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const DealBasics = () => {
  const {
    dealData,
    updateDealData,
    errors,
    validateStep,
    goToNextStep,
    goToPreviousStep,
    isExtracting,
    extractionProgress,
    extractionData,
    validationWarningsDismissed,
    setValidationWarningsDismissed,
  } = useWizard();

  // Get validation from extraction data
  const validation = extractionData?._validation;

  const handleChange = (field, value) => {
    updateDealData({ [field]: value });
  };

  const handleNext = () => {
    if (validateStep(WIZARD_STEPS.DEAL_BASICS)) {
      goToNextStep();
    }
  };

  return (
    <div className="step-container">
      {/* Extraction Progress (AI path only) */}
      {isExtracting && (
        <div className="extraction-progress">
          <div className="extraction-progress-spinner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <span className="extraction-progress-text">
            Analyzing documents... {Math.round(extractionProgress)}%
          </span>
          <div className="extraction-progress-bar">
            <div
              className="extraction-progress-fill"
              style={{ width: `${extractionProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Validation Alerts - Show errors and warnings from extraction */}
      {!isExtracting && validation && (
        <ValidationAlerts
          validation={validationWarningsDismissed
            ? { ...validation, warnings: [], allWarnings: [] }
            : validation
          }
          onDismissWarnings={() => setValidationWarningsDismissed(true)}
          className="mb-3"
        />
      )}

      <h2 className="step-title">Deal Basics</h2>

      {/* Deal Name */}
      <div className="form-group">
        <label className="form-label required">Deal Name</label>
        <input
          type="text"
          className={`form-input ${errors.deal_name ? 'error' : ''}`}
          placeholder="Enter a name for this deal"
          value={dealData.deal_name}
          onChange={(e) => handleChange('deal_name', e.target.value)}
        />
        {errors.deal_name && <span className="form-error">{errors.deal_name}</span>}
      </div>

      {/* Deal Source */}
      <div className="form-group">
        <label className="form-label required">Where did this deal come from?</label>
        <div className="radio-group">
          {DEAL_SOURCES.map((source) => (
            <label
              key={source.value}
              className={`radio-option ${dealData.deal_source === source.value ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="deal_source"
                value={source.value}
                checked={dealData.deal_source === source.value}
                onChange={(e) => handleChange('deal_source', e.target.value)}
              />
              <span className="radio-option-label">{source.label}</span>
            </label>
          ))}
        </div>
        {errors.deal_source && <span className="form-error">{errors.deal_source}</span>}
      </div>

      {/* Other Source (conditional) */}
      {dealData.deal_source === 'Other' && (
        <div className="form-group">
          <label className="form-label required">Please specify</label>
          <input
            type="text"
            className={`form-input ${errors.deal_source_other ? 'error' : ''}`}
            placeholder="Enter the source"
            value={dealData.deal_source_other}
            onChange={(e) => handleChange('deal_source_other', e.target.value)}
          />
          {errors.deal_source_other && <span className="form-error">{errors.deal_source_other}</span>}
        </div>
      )}

      {/* Contact Name */}
      <div className="form-group">
        <label className="form-label">Contact Name</label>
        <input
          type="text"
          className="form-input"
          placeholder="Who did you get this deal from?"
          value={dealData.contact_name}
          onChange={(e) => handleChange('contact_name', e.target.value)}
        />
      </div>

      {/* Status and Priority */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            className="form-select"
            value={dealData.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Priority Level</label>
          <select
            className="form-select"
            value={dealData.priority_level}
            onChange={(e) => handleChange('priority_level', e.target.value)}
          >
            {PRIORITY_LEVELS.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div className="step-navigation">
        <button className="btn btn-secondary" onClick={goToPreviousStep}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="btn btn-primary" onClick={handleNext}>
          Next
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default DealBasics;
