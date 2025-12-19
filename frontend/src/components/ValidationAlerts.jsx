/**
 * ValidationAlerts Component
 *
 * Displays extraction validation errors and warnings to users.
 * - Errors (red) are blocking and prevent deal creation
 * - Warnings (yellow) are informational and dismissible
 */

import React from 'react';
import { Alert } from 'react-bootstrap';

/**
 * @param {Object} props
 * @param {Object} props.validation - Validation result from extraction
 * @param {boolean} props.validation.valid - Whether data passed validation
 * @param {Array} props.validation.errors - Array of {field, message} error objects
 * @param {Array} props.validation.warnings - Array of {field, message} warning objects
 * @param {Array} props.validation.allErrors - Combined errors from all sources (for portfolio)
 * @param {Array} props.validation.allWarnings - Combined warnings from all sources (for portfolio)
 * @param {string} props.validation.summary - Summary string like "2 errors, 3 warnings"
 * @param {Function} props.onDismissWarnings - Callback when warnings are dismissed
 * @param {string} props.className - Optional additional class names
 */
const ValidationAlerts = ({ validation, onDismissWarnings, className = '' }) => {
  if (!validation) {
    return null;
  }

  // Support both flat (single facility) and combined (portfolio) validation structures
  const errors = validation.allErrors || validation.errors || [];
  const warnings = validation.allWarnings || validation.warnings || [];

  // Don't render if no errors or warnings
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  // Group errors by source for portfolio deals
  const groupedErrors = groupBySource(errors);
  const groupedWarnings = groupBySource(warnings);

  return (
    <div className={`validation-alerts ${className}`}>
      {errors.length > 0 && (
        <Alert variant="danger" className="mb-3">
          <Alert.Heading className="h6 mb-2">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            Extraction Errors ({errors.length})
          </Alert.Heading>
          {Object.keys(groupedErrors).length > 1 ? (
            // Multiple sources - show grouped
            Object.entries(groupedErrors).map(([source, sourceErrors]) => (
              <div key={source} className="mb-2">
                {source !== 'default' && (
                  <strong className="text-danger d-block mb-1">{formatSource(source)}:</strong>
                )}
                <ul className="mb-0 ps-3">
                  {sourceErrors.map((err, i) => (
                    <li key={i}>
                      <strong>{err.field}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            // Single source - show flat list
            <ul className="mb-2 ps-3">
              {errors.map((err, i) => (
                <li key={i}>
                  <strong>{err.field}:</strong> {err.message}
                </li>
              ))}
            </ul>
          )}
          <hr className="my-2" />
          <p className="mb-0 small">
            <strong>Please correct these issues before creating the deal.</strong>
          </p>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert
          variant="warning"
          className="mb-3"
          dismissible={!!onDismissWarnings}
          onClose={onDismissWarnings}
        >
          <Alert.Heading className="h6 mb-2">
            <i className="bi bi-info-circle-fill me-2"></i>
            Please Review ({warnings.length} item{warnings.length !== 1 ? 's' : ''})
          </Alert.Heading>
          {Object.keys(groupedWarnings).length > 1 ? (
            // Multiple sources - show grouped
            Object.entries(groupedWarnings).map(([source, sourceWarnings]) => (
              <div key={source} className="mb-2">
                {source !== 'default' && (
                  <strong className="text-warning d-block mb-1">{formatSource(source)}:</strong>
                )}
                <ul className="mb-0 ps-3">
                  {sourceWarnings.map((warn, i) => (
                    <li key={i}>
                      <strong>{warn.field}:</strong> {warn.message}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            // Single source - show flat list
            <ul className="mb-0 ps-3">
              {warnings.map((warn, i) => (
                <li key={i}>
                  <strong>{warn.field}:</strong> {warn.message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
    </div>
  );
};

/**
 * Group validation items by their source (for portfolio deals)
 */
function groupBySource(items) {
  const groups = {};
  for (const item of items) {
    const source = item.source || 'default';
    if (!groups[source]) {
      groups[source] = [];
    }
    groups[source].push(item);
  }
  return groups;
}

/**
 * Format source name for display
 */
function formatSource(source) {
  const labels = {
    monthly_financials: 'Monthly Financials',
    monthly_census: 'Monthly Census',
    monthly_expenses: 'Monthly Expenses',
    portfolio: 'Portfolio Level',
    default: 'General'
  };
  return labels[source] || source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Compact variant for inline display
 */
export const ValidationSummary = ({ validation, onClick }) => {
  if (!validation) return null;

  const errors = validation.allErrors || validation.errors || [];
  const warnings = validation.allWarnings || validation.warnings || [];

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <span className="text-success small">
        <i className="bi bi-check-circle me-1"></i>
        Validation passed
      </span>
    );
  }

  return (
    <span
      className={`small ${errors.length > 0 ? 'text-danger' : 'text-warning'}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {errors.length > 0 && (
        <>
          <i className="bi bi-exclamation-triangle me-1"></i>
          {errors.length} error{errors.length !== 1 ? 's' : ''}
        </>
      )}
      {errors.length > 0 && warnings.length > 0 && ', '}
      {warnings.length > 0 && (
        <>
          <i className="bi bi-info-circle me-1"></i>
          {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
        </>
      )}
    </span>
  );
};

export default ValidationAlerts;
