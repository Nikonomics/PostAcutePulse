import React, { useState, useEffect } from 'react';
import { calculateDealMetrics } from '../api/DealService';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Building2,
  Users,
  Percent,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Brain,
  X,
  Edit3,
  RotateCcw,
} from 'lucide-react';
import SNFalyzePanel from './SNFalyzePanel';

// =============================================================================
// VALUATION DRIVER OPTIONS
// =============================================================================
const DRIVER_OPTIONS = [
  { value: 'pricePerBed', label: 'Price Per Bed' },
  { value: 'revenueMultiple', label: 'Revenue Multiple' },
  { value: 'ebitdaMultiple', label: 'EBITDA Multiple' },
  { value: 'ebitdarMultiple', label: 'EBITDAR Multiple' },
  { value: 'capRate', label: 'Cap Rate (%)' },
];

// =============================================================================
// UTILITY FUNCTIONS - ACCOUNTING FORMAT (max 2 decimals, commas)
// =============================================================================

/**
 * Safe number parsing - returns null if invalid
 */
const safeParseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Format number with accounting style (commas, max 2 decimals)
 * @param {number} value - The number to format
 * @param {number} decimals - Max decimal places (default 2)
 * @returns {string} - Formatted number string
 */
const formatAccountingNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return null;

  // Round to max decimals
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // Format with commas and proper decimal places
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

/**
 * Display currency - Accounting format with $ prefix
 * @param {number} value - The number to format
 * @returns {string} - Formatted currency string (e.g., "$1,234,567.89")
 */
const fmtCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const formatted = formatAccountingNumber(value, 2);
  if (formatted === null) return 'N/A';
  // Handle negative numbers in accounting format
  if (value < 0) {
    return `($${formatAccountingNumber(Math.abs(value), 2)})`;
  }
  return `$${formatted}`;
};

/**
 * Display percentage - max 2 decimals with % suffix
 * @param {number} value - The percentage value
 * @returns {string} - Formatted percentage string (e.g., "12.34%")
 */
const fmtPercent = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const formatted = formatAccountingNumber(value, 2);
  if (formatted === null) return 'N/A';
  return `${formatted}%`;
};

/**
 * Display multiple - max 2 decimals with x suffix
 * @param {number} value - The multiple value
 * @returns {string} - Formatted multiple string (e.g., "5.25x")
 */
const fmtMultiple = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const formatted = formatAccountingNumber(value, 2);
  if (formatted === null) return 'N/A';
  return `${formatted}x`;
};

/**
 * Display plain number - max 2 decimals with commas
 * @param {number} value - The number to format
 * @returns {string} - Formatted number string (e.g., "1,234.56")
 */
const fmtNumber = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const formatted = formatAccountingNumber(value, 2);
  if (formatted === null) return 'N/A';
  return formatted;
};

// =============================================================================
// SCENARIO VALUATION COMPUTATION - NO ROUNDING
// =============================================================================

/**
 * Compute scenario valuation from a driver
 * @param {Object} editableMetrics - Current editable metrics state
 * @param {string} driverType - One of the DRIVER_OPTIONS values
 * @param {number|null} driverValue - The driver value entered by user
 * @returns {Object} - { impliedValue, impliedPricePerBed, impliedRevenueMultiple, impliedEbitdaMultiple, impliedEbitdarMultiple, impliedCapRate, error }
 */
const computeScenarioValuation = (editableMetrics, driverType, driverValue) => {
  if (!editableMetrics || driverValue === null) {
    return { error: 'Enter a driver value to compute scenario' };
  }

  const { beds, t12mRevenue, t12mEbitda, t12mEbitdar, t12mNoi } = editableMetrics;

  let impliedValue = null;
  let error = null;

  // Compute implied Value based on selected driver - NO ROUNDING
  switch (driverType) {
    case 'pricePerBed':
      if (beds && beds > 0 && driverValue !== null) {
        impliedValue = driverValue * beds;
      } else {
        error = 'Requires valid beds count and driver value';
      }
      break;

    case 'revenueMultiple':
      if (t12mRevenue && t12mRevenue > 0 && driverValue !== null) {
        impliedValue = driverValue * t12mRevenue;
      } else {
        error = 'Requires valid T12M Revenue and driver value';
      }
      break;

    case 'ebitdaMultiple':
      if (t12mEbitda && t12mEbitda !== 0 && driverValue !== null) {
        impliedValue = driverValue * t12mEbitda;
      } else {
        error = 'Requires valid T12M EBITDA and driver value';
      }
      break;

    case 'ebitdarMultiple':
      if (t12mEbitdar && t12mEbitdar !== 0 && driverValue !== null) {
        impliedValue = driverValue * t12mEbitdar;
      } else {
        error = 'Requires valid T12M EBITDAR and driver value';
      }
      break;

    case 'capRate':
      // Cap Rate formula: Value = NOI / (capRate/100)
      if (t12mNoi && t12mNoi !== 0 && driverValue !== null && driverValue !== 0) {
        impliedValue = t12mNoi / (driverValue / 100);
      } else {
        error = 'Requires valid T12M NOI and non-zero cap rate';
      }
      break;

    default:
      error = 'Unknown driver type';
  }

  if (error) {
    return { error };
  }

  // Compute all other implied metrics from implied Value - NO ROUNDING
  const scenario = {
    impliedValue,
    impliedPricePerBed: beds && beds > 0 ? impliedValue / beds : null,
    impliedRevenueMultiple: t12mRevenue && t12mRevenue > 0 ? impliedValue / t12mRevenue : null,
    impliedEbitdaMultiple: t12mEbitda && t12mEbitda !== 0 ? impliedValue / t12mEbitda : null,
    impliedEbitdarMultiple: t12mEbitdar && t12mEbitdar !== 0 ? impliedValue / t12mEbitdar : null,
    impliedCapRate: t12mNoi && t12mNoi !== 0 && impliedValue !== 0 ? (t12mNoi / impliedValue) * 100 : null,
    error: null,
  };

  return scenario;
};

// =============================================================================
// FORMATTED INPUT COMPONENT
// =============================================================================

/**
 * FormattedCurrencyInput - Input that shows formatted currency when not focused
 * and allows raw number input when editing
 */
const FormattedCurrencyInput = ({ value, onChange, onReset, isModified, placeholder = 'N/A', isCurrency = true }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Update inputValue when value changes externally
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value ?? '');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(value ?? '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Commit the value on blur
    onChange(inputValue);
  };

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  // Format the display value when not focused
  const getDisplayValue = () => {
    if (isFocused) {
      return inputValue;
    }
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (isCurrency) {
      return fmtCurrency(value);
    }
    return fmtNumber(value);
  };

  return (
    <input
      type={isFocused ? 'number' : 'text'}
      className={`metric-input ${isModified ? 'modified' : ''}`}
      value={getDisplayValue()}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * DealCalculatorTab - Displays calculated underwriting metrics for a deal
 * with interactive what-if functionality for scenario valuation
 */
const DealCalculatorTab = ({ dealId, deal }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ==========================================================================
  // EDITABLE METRICS STATE
  // originalMetrics: Read-only from API
  // editableMetrics: User-modifiable deep copy for what-if
  // ==========================================================================
  const [originalMetrics, setOriginalMetrics] = useState(null);
  const [editableMetrics, setEditableMetrics] = useState(null);

  // ==========================================================================
  // SCENARIO VALUATION STATE
  // ==========================================================================
  const [scenarioState, setScenarioState] = useState({
    driverType: 'pricePerBed',
    driverValue: '',
    scenario: null,
  });

  // SNFalyze panel state (using unified component)
  const [showSNFalyzePanel, setShowSNFalyzePanel] = useState(false);

  // ==========================================================================
  // FETCH METRICS FROM API
  // ==========================================================================
  const fetchMetrics = async () => {
    if (!dealId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await calculateDealMetrics(dealId);
      if (response.success) {
        setMetrics(response.body);

        // Extract base metrics for editing - NO ROUNDING
        const { inputs, computed } = response.body;
        const baseMetrics = {
          beds: inputs?.numberOfBeds ?? null,
          t12mRevenue: inputs?.annualRevenue ?? null,
          t12mEbitda: inputs?.ebitda ?? null,
          t12mEbitdar: inputs?.ebitdar ?? null,
          t12mNoi: computed?.noi ?? inputs?.noi ?? null, // NOI for cap rate calculation
          annualRent: inputs?.annualRent ?? null,
        };

        // Store original (read-only) and create editable copy
        setOriginalMetrics({ ...baseMetrics });
        setEditableMetrics({ ...baseMetrics });

        // Reset scenario when new data loads
        setScenarioState({
          driverType: 'pricePerBed',
          driverValue: '',
          scenario: null,
        });
      } else {
        setError(response.message || 'Failed to calculate metrics');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while calculating metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [dealId]);

  // ==========================================================================
  // EDITABLE METRIC HANDLERS
  // ==========================================================================

  /**
   * Handle editable metric input change
   * Parses input and updates editableMetrics state
   * Empty string -> null, unparseable -> keep previous value
   */
  const handleMetricChange = (field, rawValue) => {
    setEditableMetrics((prev) => {
      if (!prev) return prev;

      // Empty input -> null
      if (rawValue === '') {
        return { ...prev, [field]: null };
      }

      // Try to parse
      const parsed = safeParseNumber(rawValue);
      if (parsed === null) {
        // Unparseable - ignore (keep previous value)
        return prev;
      }

      // Valid number - update with NO ROUNDING
      return { ...prev, [field]: parsed };
    });

    // Clear existing scenario when metrics change
    setScenarioState((prev) => ({ ...prev, scenario: null }));
  };

  /**
   * Reset a single metric to original value
   */
  const resetMetric = (field) => {
    if (!originalMetrics) return;
    setEditableMetrics((prev) => ({
      ...prev,
      [field]: originalMetrics[field],
    }));
    // Clear scenario
    setScenarioState((prev) => ({ ...prev, scenario: null }));
  };

  /**
   * Reset all metrics to original values
   */
  const resetAllMetrics = () => {
    if (!originalMetrics) return;
    setEditableMetrics({ ...originalMetrics });
    setScenarioState({
      driverType: 'pricePerBed',
      driverValue: '',
      scenario: null,
    });
  };

  /**
   * Check if a metric has been modified from original
   */
  const isMetricModified = (field) => {
    if (!originalMetrics || !editableMetrics) return false;
    return editableMetrics[field] !== originalMetrics[field];
  };

  /**
   * Check if any metric has been modified
   */
  const hasAnyModification = () => {
    if (!originalMetrics || !editableMetrics) return false;
    return Object.keys(originalMetrics).some((key) => isMetricModified(key));
  };

  // ==========================================================================
  // SCENARIO VALUATION HANDLERS
  // ==========================================================================

  const handleDriverTypeChange = (e) => {
    setScenarioState((prev) => ({
      ...prev,
      driverType: e.target.value,
      scenario: null, // Clear scenario when driver changes
    }));
  };

  const handleDriverValueChange = (e) => {
    setScenarioState((prev) => ({
      ...prev,
      driverValue: e.target.value,
      scenario: null, // Clear scenario when value changes
    }));
  };

  const handleApplyScenario = () => {
    const parsedValue = safeParseNumber(scenarioState.driverValue);
    const scenario = computeScenarioValuation(editableMetrics, scenarioState.driverType, parsedValue);
    setScenarioState((prev) => ({
      ...prev,
      scenario,
    }));
  };

  const handleClearScenario = () => {
    setScenarioState({
      driverType: 'pricePerBed',
      driverValue: '',
      scenario: null,
    });
  };

  // ==========================================================================
  // COMPUTED VALUES FROM EDITABLE METRICS - NO ROUNDING
  // ==========================================================================

  const computedFromEditable = {
    pricePerBed: editableMetrics?.beds && editableMetrics.beds > 0 && metrics?.inputs?.purchasePrice
      ? metrics.inputs.purchasePrice / editableMetrics.beds
      : null,
    revenueMultiple: editableMetrics?.t12mRevenue && editableMetrics.t12mRevenue > 0 && metrics?.inputs?.purchasePrice
      ? metrics.inputs.purchasePrice / editableMetrics.t12mRevenue
      : null,
    ebitdaMultiple: editableMetrics?.t12mEbitda && editableMetrics.t12mEbitda !== 0 && metrics?.inputs?.purchasePrice
      ? metrics.inputs.purchasePrice / editableMetrics.t12mEbitda
      : null,
    ebitdarMultiple: editableMetrics?.t12mEbitdar && editableMetrics.t12mEbitdar !== 0 && metrics?.inputs?.purchasePrice
      ? metrics.inputs.purchasePrice / editableMetrics.t12mEbitdar
      : null,
    capRate: editableMetrics?.t12mNoi && editableMetrics.t12mNoi !== 0 && metrics?.inputs?.purchasePrice && metrics.inputs.purchasePrice !== 0
      ? (editableMetrics.t12mNoi / metrics.inputs.purchasePrice) * 100
      : null,
    revenuePerBed: editableMetrics?.t12mRevenue && editableMetrics?.beds && editableMetrics.beds > 0
      ? editableMetrics.t12mRevenue / editableMetrics.beds
      : null,
    ebitdaPerBed: editableMetrics?.t12mEbitda && editableMetrics?.beds && editableMetrics.beds > 0
      ? editableMetrics.t12mEbitda / editableMetrics.beds
      : null,
    ebitdaMargin: editableMetrics?.t12mEbitda && editableMetrics?.t12mRevenue && editableMetrics.t12mRevenue !== 0
      ? (editableMetrics.t12mEbitda / editableMetrics.t12mRevenue) * 100
      : null,
    rentCoverageRatio: editableMetrics?.t12mEbitdar && editableMetrics?.annualRent && editableMetrics.annualRent !== 0
      ? editableMetrics.t12mEbitdar / editableMetrics.annualRent
      : null,
  };

  // ==========================================================================
  // LOADING / ERROR STATES
  // ==========================================================================

  if (loading) {
    return (
      <div className="calculator-loading">
        <RefreshCw className="spin" size={32} />
        <p>Calculating metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calculator-error">
        <AlertCircle size={32} color="#dc2626" />
        <p>{error}</p>
        <button onClick={fetchMetrics} className="btn btn-primary">
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="calculator-empty">
        <Calculator size={48} color="#9ca3af" />
        <p>No metrics available</p>
      </div>
    );
  }

  const { inputs, computed, summary, dataQuality } = metrics;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="deal-calculator">
      <style>{`
        .deal-calculator {
          padding: 1.5rem;
          position: relative;
        }

        .calculator-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .calculator-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }

        .header-buttons {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          background-color: #e5e7eb;
        }

        .reset-all-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #92400e;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reset-all-btn:hover {
          background-color: #fde68a;
        }

        .snfalyze-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .snfalyze-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .snfalyze-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .metrics-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .metrics-card.scenario-card {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 2px solid #0ea5e9;
        }

        .metrics-card-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #f3f4f6;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f9fafb;
        }

        .metric-row:last-child {
          border-bottom: none;
        }

        .metric-label {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .metric-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #111827;
        }

        .metric-value.positive {
          color: #059669;
        }

        .metric-value.negative {
          color: #dc2626;
        }

        .metric-value.warning {
          color: #d97706;
        }

        /* Editable metric input styling */
        .editable-metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f9fafb;
        }

        .editable-metric-row:last-child {
          border-bottom: none;
        }

        .metric-input-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .metric-input {
          width: 120px;
          padding: 0.375rem 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          text-align: right;
          transition: border-color 0.2s;
        }

        .metric-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .metric-input.modified {
          border-color: #f59e0b;
          background-color: #fffbeb;
        }

        .reset-metric-btn {
          padding: 0.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .reset-metric-btn:hover {
          color: #f59e0b;
        }

        .reset-metric-btn.hidden {
          visibility: hidden;
        }

        /* Scenario controls */
        .scenario-controls {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin-top: 1.5rem;
        }

        .scenario-controls-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: #0369a1;
          margin-bottom: 1rem;
        }

        .scenario-controls-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .driver-select {
          padding: 0.5rem 1rem;
          border: 1px solid #7dd3fc;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: #0c4a6e;
          min-width: 180px;
        }

        .driver-select:focus {
          outline: none;
          border-color: #0ea5e9;
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
        }

        .driver-value-input {
          padding: 0.5rem 1rem;
          border: 1px solid #7dd3fc;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: #0c4a6e;
          width: 150px;
          text-align: right;
        }

        .driver-value-input:focus {
          outline: none;
          border-color: #0ea5e9;
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
        }

        .apply-scenario-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.25rem;
          background: #0ea5e9;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: white;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .apply-scenario-btn:hover {
          background: #0284c7;
        }

        .apply-scenario-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .clear-scenario-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid #94a3b8;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-scenario-btn:hover {
          background: #f1f5f9;
        }

        /* Scenario results */
        .scenario-results {
          margin-top: 1.5rem;
        }

        .scenario-error {
          color: #dc2626;
          font-size: 0.875rem;
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.5rem;
          margin-top: 1rem;
        }

        .data-quality-section {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 0.5rem;
        }

        .quality-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.75rem;
        }

        .quality-items {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .quality-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8rem;
          color: #6b7280;
        }

        .quality-item.success {
          color: #059669;
        }

        .quality-item.error {
          color: #dc2626;
        }

        .progress-bar-container {
          width: 100%;
          height: 8px;
          background-color: #e5e7eb;
          border-radius: 4px;
          margin-top: 0.5rem;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .calculator-loading,
        .calculator-error,
        .calculator-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
          color: #6b7280;
        }

        .calculator-loading p,
        .calculator-error p,
        .calculator-empty p {
          margin-top: 1rem;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .payer-mix-bar {
          display: flex;
          height: 24px;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 0.5rem;
        }

        .payer-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 600;
          color: white;
        }

        .payer-medicare {
          background-color: #3b82f6;
        }

        .payer-medicaid {
          background-color: #8b5cf6;
        }

        .payer-private {
          background-color: #10b981;
        }

        .payer-other {
          background-color: #6b7280;
        }

        .payer-legend {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
          font-size: 0.75rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }

        /* SNFalyze Side Panel */
        .snfalyze-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }

        .snfalyze-panel {
          width: 100%;
          max-width: 600px;
          height: 100%;
          background: white;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .snfalyze-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
          color: white;
        }

        .snfalyze-panel-header h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .snfalyze-panel-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 0.5rem;
          padding: 0.5rem;
          cursor: pointer;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .snfalyze-panel-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .snfalyze-panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .snfalyze-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 1rem;
        }

        .snfalyze-loading-dots {
          display: flex;
          gap: 0.5rem;
        }

        .snfalyze-loading-dots span {
          width: 10px;
          height: 10px;
          background: #7c3aed;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .snfalyze-loading-dots span:nth-child(1) {
          animation-delay: 0s;
        }

        .snfalyze-loading-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .snfalyze-loading-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .snfalyze-response {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #374151;
        }

        .snfalyze-response strong {
          color: #111827;
          font-weight: 600;
        }

        .snfalyze-response .snf-header-main {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
          margin: 1.5rem 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .snfalyze-response .snf-header {
          font-size: 1.05rem;
          font-weight: 600;
          color: #1f2937;
          margin: 1.75rem 0 0.75rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f3f4f6;
        }

        .snfalyze-response .snf-header:first-child {
          margin-top: 0;
        }

        .snfalyze-response .snf-subheader {
          font-size: 0.95rem;
          font-weight: 600;
          color: #374151;
          margin: 1rem 0 0.5rem 0;
        }

        .snfalyze-response .snf-paragraph {
          margin: 0.5rem 0;
          line-height: 1.7;
        }

        .snfalyze-response .snf-list {
          margin: 0.75rem 0;
          padding-left: 1.25rem;
        }

        .snfalyze-response .snf-list li {
          margin: 0.5rem 0;
          line-height: 1.6;
          position: relative;
        }

        .snfalyze-response .snf-list li::marker {
          color: #7c3aed;
        }

        .snfalyze-response .snf-ordered-list {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        .snfalyze-response .snf-ordered-list li {
          margin: 0.75rem 0;
          line-height: 1.6;
          padding-left: 0.25rem;
        }

        .snfalyze-response .snf-ordered-list li::marker {
          color: #7c3aed;
          font-weight: 600;
        }

        .snfalyze-response .snf-spacer {
          height: 0.5rem;
        }

        .snfalyze-response em {
          font-style: italic;
          color: #4b5563;
        }

        .snfalyze-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: #dc2626;
        }

        .snfalyze-error p {
          margin-top: 1rem;
        }

        .snfalyze-panel-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: #6b7280;
        }
      `}</style>

      <div className="calculator-header">
        <div className="calculator-title">
          <Calculator size={24} />
          Deal Calculator
          {hasAnyModification() && (
            <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginLeft: '0.5rem' }}>
              (Modified)
            </span>
          )}
        </div>
        <div className="header-buttons">
          {hasAnyModification() && (
            <button onClick={resetAllMetrics} className="reset-all-btn">
              <RotateCcw size={16} />
              Reset All
            </button>
          )}
          <button
            onClick={() => setShowSNFalyzePanel(true)}
            className="snfalyze-btn"
            disabled={!metrics}
          >
            <Brain size={18} />
            Ask SNFalyze about this deal
          </button>
          <button onClick={fetchMetrics} className="refresh-btn">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Editable Base Metrics */}
        <div className="metrics-card">
          <div className="metrics-card-title">
            <Edit3 size={18} />
            Editable Base Metrics
          </div>

          {/* Beds */}
          <div className="editable-metric-row">
            <span className="metric-label">Number of Beds</span>
            <div className="metric-input-wrapper">
              <FormattedCurrencyInput
                value={editableMetrics?.beds}
                onChange={(val) => handleMetricChange('beds', val)}
                isModified={isMetricModified('beds')}
                isCurrency={false}
              />
              <button
                className={`reset-metric-btn ${!isMetricModified('beds') ? 'hidden' : ''}`}
                onClick={() => resetMetric('beds')}
                title="Reset to original"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* T12M Revenue */}
          <div className="editable-metric-row">
            <span className="metric-label">T12M Revenue</span>
            <div className="metric-input-wrapper">
              <FormattedCurrencyInput
                value={editableMetrics?.t12mRevenue}
                onChange={(val) => handleMetricChange('t12mRevenue', val)}
                isModified={isMetricModified('t12mRevenue')}
                isCurrency={true}
              />
              <button
                className={`reset-metric-btn ${!isMetricModified('t12mRevenue') ? 'hidden' : ''}`}
                onClick={() => resetMetric('t12mRevenue')}
                title="Reset to original"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* T12M EBITDA */}
          <div className="editable-metric-row">
            <span className="metric-label">T12M EBITDA</span>
            <div className="metric-input-wrapper">
              <FormattedCurrencyInput
                value={editableMetrics?.t12mEbitda}
                onChange={(val) => handleMetricChange('t12mEbitda', val)}
                isModified={isMetricModified('t12mEbitda')}
                isCurrency={true}
              />
              <button
                className={`reset-metric-btn ${!isMetricModified('t12mEbitda') ? 'hidden' : ''}`}
                onClick={() => resetMetric('t12mEbitda')}
                title="Reset to original"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* T12M EBITDAR */}
          <div className="editable-metric-row">
            <span className="metric-label">T12M EBITDAR</span>
            <div className="metric-input-wrapper">
              <FormattedCurrencyInput
                value={editableMetrics?.t12mEbitdar}
                onChange={(val) => handleMetricChange('t12mEbitdar', val)}
                isModified={isMetricModified('t12mEbitdar')}
                isCurrency={true}
              />
              <button
                className={`reset-metric-btn ${!isMetricModified('t12mEbitdar') ? 'hidden' : ''}`}
                onClick={() => resetMetric('t12mEbitdar')}
                title="Reset to original"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* T12M NOI */}
          <div className="editable-metric-row">
            <span className="metric-label">T12M NOI</span>
            <div className="metric-input-wrapper">
              <FormattedCurrencyInput
                value={editableMetrics?.t12mNoi}
                onChange={(val) => handleMetricChange('t12mNoi', val)}
                isModified={isMetricModified('t12mNoi')}
                isCurrency={true}
              />
              <button
                className={`reset-metric-btn ${!isMetricModified('t12mNoi') ? 'hidden' : ''}`}
                onClick={() => resetMetric('t12mNoi')}
                title="Reset to original"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Annual Rent */}
          <div className="editable-metric-row">
            <span className="metric-label">Annual Rent</span>
            <div className="metric-input-wrapper">
              <FormattedCurrencyInput
                value={editableMetrics?.annualRent}
                onChange={(val) => handleMetricChange('annualRent', val)}
                isModified={isMetricModified('annualRent')}
                isCurrency={true}
              />
              <button
                className={`reset-metric-btn ${!isMetricModified('annualRent') ? 'hidden' : ''}`}
                onClick={() => resetMetric('annualRent')}
                title="Reset to original"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Valuation Metrics (computed from editable metrics) */}
        <div className="metrics-card">
          <div className="metrics-card-title">
            <DollarSign size={18} />
            Valuation Metrics
          </div>
          <div className="metric-row">
            <span className="metric-label">Purchase Price</span>
            <span className="metric-value">{fmtCurrency(inputs.purchasePrice)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Price Per Bed</span>
            <span className="metric-value">
              {fmtCurrency(computedFromEditable.pricePerBed)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Revenue Multiple</span>
            <span className="metric-value">
              {fmtMultiple(computedFromEditable.revenueMultiple)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EBITDA Multiple</span>
            <span className={`metric-value ${computedFromEditable.ebitdaMultiple > 8 ? 'warning' : ''}`}>
              {fmtMultiple(computedFromEditable.ebitdaMultiple)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EBITDAR Multiple</span>
            <span className="metric-value">
              {fmtMultiple(computedFromEditable.ebitdarMultiple)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Cap Rate</span>
            <span className={`metric-value ${computedFromEditable.capRate !== null && computedFromEditable.capRate < 6 ? 'warning' : 'positive'}`}>
              {fmtPercent(computedFromEditable.capRate)}
            </span>
          </div>
        </div>

        {/* Financial Performance (computed from editable metrics) */}
        <div className="metrics-card">
          <div className="metrics-card-title">
            <TrendingUp size={18} />
            Financial Performance
          </div>
          <div className="metric-row">
            <span className="metric-label">Annual Revenue</span>
            <span className="metric-value">
              {fmtCurrency(editableMetrics?.t12mRevenue)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EBITDA</span>
            <span className={`metric-value ${editableMetrics?.t12mEbitda !== null && editableMetrics.t12mEbitda < 0 ? 'negative' : ''}`}>
              {fmtCurrency(editableMetrics?.t12mEbitda)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EBITDAR</span>
            <span className="metric-value">
              {fmtCurrency(editableMetrics?.t12mEbitdar)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EBITDA Margin</span>
            <span className={`metric-value ${computedFromEditable.ebitdaMargin !== null && computedFromEditable.ebitdaMargin < 10 ? 'warning' : 'positive'}`}>
              {fmtPercent(computedFromEditable.ebitdaMargin)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Revenue Per Bed</span>
            <span className="metric-value">
              {fmtCurrency(computedFromEditable.revenuePerBed)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">EBITDA Per Bed</span>
            <span className="metric-value">
              {fmtCurrency(computedFromEditable.ebitdaPerBed)}
            </span>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="metrics-card">
          <div className="metrics-card-title">
            <Building2 size={18} />
            Operational Metrics
          </div>
          <div className="metric-row">
            <span className="metric-label">Number of Beds</span>
            <span className="metric-value">{fmtNumber(editableMetrics?.beds)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Current Occupancy</span>
            <span className={`metric-value ${inputs.currentOccupancy < 85 ? 'warning' : 'positive'}`}>
              {fmtPercent(inputs.currentOccupancy)}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Average Daily Rate</span>
            <span className="metric-value">{fmtCurrency(inputs.averageDailyRate)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Rent Coverage Ratio</span>
            <span className={`metric-value ${computedFromEditable.rentCoverageRatio !== null && computedFromEditable.rentCoverageRatio < 1.2 ? 'negative' : 'positive'}`}>
              {fmtMultiple(computedFromEditable.rentCoverageRatio)}
            </span>
          </div>
          {computed.stabilizedCapRate && (
            <div className="metric-row">
              <span className="metric-label">Stabilized Cap Rate (95% Occ.)</span>
              <span className="metric-value positive">{fmtPercent(computed.stabilizedCapRate)}</span>
            </div>
          )}
        </div>

        {/* Payer Mix */}
        <div className="metrics-card">
          <div className="metrics-card-title">
            <Users size={18} />
            Payer Mix
          </div>
          {computed.payerMix ? (
            <>
              <div className="metric-row">
                <span className="metric-label">Medicare</span>
                <span className="metric-value">{fmtPercent(computed.payerMix.medicare)}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Medicaid</span>
                <span className="metric-value">{fmtPercent(computed.payerMix.medicaid)}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Private Pay</span>
                <span className="metric-value positive">{fmtPercent(computed.payerMix.privatePay)}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Other</span>
                <span className="metric-value">{fmtPercent(computed.payerMix.other)}</span>
              </div>
              <div className="payer-mix-bar">
                {computed.payerMix.medicare > 0 && (
                  <div
                    className="payer-segment payer-medicare"
                    style={{ width: `${computed.payerMix.medicare}%` }}
                  >
                    {computed.payerMix.medicare > 10 ? `${computed.payerMix.medicare.toFixed(0)}%` : ''}
                  </div>
                )}
                {computed.payerMix.medicaid > 0 && (
                  <div
                    className="payer-segment payer-medicaid"
                    style={{ width: `${computed.payerMix.medicaid}%` }}
                  >
                    {computed.payerMix.medicaid > 10 ? `${computed.payerMix.medicaid.toFixed(0)}%` : ''}
                  </div>
                )}
                {computed.payerMix.privatePay > 0 && (
                  <div
                    className="payer-segment payer-private"
                    style={{ width: `${computed.payerMix.privatePay}%` }}
                  >
                    {computed.payerMix.privatePay > 10 ? `${computed.payerMix.privatePay.toFixed(0)}%` : ''}
                  </div>
                )}
                {computed.payerMix.other > 0 && (
                  <div
                    className="payer-segment payer-other"
                    style={{ width: `${computed.payerMix.other}%` }}
                  >
                    {computed.payerMix.other > 10 ? `${computed.payerMix.other.toFixed(0)}%` : ''}
                  </div>
                )}
              </div>
              <div className="payer-legend">
                <div className="legend-item">
                  <div className="legend-dot payer-medicare"></div>
                  Medicare
                </div>
                <div className="legend-item">
                  <div className="legend-dot payer-medicaid"></div>
                  Medicaid
                </div>
                <div className="legend-item">
                  <div className="legend-dot payer-private"></div>
                  Private
                </div>
                <div className="legend-item">
                  <div className="legend-dot payer-other"></div>
                  Other
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No payer mix data available</p>
          )}
        </div>

        {/* Target Returns */}
        <div className="metrics-card">
          <div className="metrics-card-title">
            <Percent size={18} />
            Target Returns
          </div>
          <div className="metric-row">
            <span className="metric-label">Target IRR</span>
            <span className="metric-value">{fmtPercent(inputs.targetIRR)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Hold Period (Years)</span>
            <span className="metric-value">{fmtNumber(inputs.targetHoldPeriod)}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Exit Multiple</span>
            <span className="metric-value">{fmtMultiple(inputs.exitMultiple)}</span>
          </div>
          {computed.exitValueAtMultiple && (
            <div className="metric-row">
              <span className="metric-label">Exit Value at Multiple</span>
              <span className="metric-value positive">{fmtCurrency(computed.exitValueAtMultiple)}</span>
            </div>
          )}
          {computed.impliedValueAtTargetCap && (
            <div className="metric-row">
              <span className="metric-label">Implied Value at Target Cap</span>
              <span className="metric-value">{fmtCurrency(computed.impliedValueAtTargetCap)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scenario Valuation Controls */}
      <div className="scenario-controls">
        <div className="scenario-controls-title">
          <TrendingUp size={18} />
          Scenario Valuation (What-If)
        </div>
        <div className="scenario-controls-row">
          <select
            className="driver-select"
            value={scenarioState.driverType}
            onChange={handleDriverTypeChange}
          >
            {DRIVER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="driver-value-input"
            value={scenarioState.driverValue}
            onChange={handleDriverValueChange}
            placeholder="Enter value"
          />
          <button
            className="apply-scenario-btn"
            onClick={handleApplyScenario}
            disabled={!scenarioState.driverValue}
          >
            Apply
          </button>
          {scenarioState.scenario && (
            <button
              className="clear-scenario-btn"
              onClick={handleClearScenario}
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Scenario Results */}
        {scenarioState.scenario && (
          <div className="scenario-results">
            {scenarioState.scenario.error ? (
              <div className="scenario-error">
                {scenarioState.scenario.error}
              </div>
            ) : (
              <div className="metrics-grid" style={{ marginTop: '1rem' }}>
                <div className="metrics-card scenario-card">
                  <div className="metrics-card-title">
                    <DollarSign size={18} />
                    Scenario Implied Valuation
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Implied Value</span>
                    <span className="metric-value positive">
                      {fmtCurrency(scenarioState.scenario.impliedValue)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Implied Price Per Bed</span>
                    <span className="metric-value">
                      {fmtCurrency(scenarioState.scenario.impliedPricePerBed)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Implied Revenue Multiple</span>
                    <span className="metric-value">
                      {fmtMultiple(scenarioState.scenario.impliedRevenueMultiple)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Implied EBITDA Multiple</span>
                    <span className="metric-value">
                      {fmtMultiple(scenarioState.scenario.impliedEbitdaMultiple)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Implied EBITDAR Multiple</span>
                    <span className="metric-value">
                      {fmtMultiple(scenarioState.scenario.impliedEbitdarMultiple)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Implied Cap Rate</span>
                    <span className="metric-value">
                      {fmtPercent(scenarioState.scenario.impliedCapRate)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data Quality Section */}
      <div className="data-quality-section">
        <div className="quality-title">
          <AlertCircle size={16} />
          Data Completeness: {dataQuality.completenessScore}%
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${dataQuality.completenessScore}%`,
              backgroundColor:
                dataQuality.completenessScore >= 80
                  ? '#059669'
                  : dataQuality.completenessScore >= 50
                  ? '#d97706'
                  : '#dc2626',
            }}
          />
        </div>
        <div className="quality-items" style={{ marginTop: '0.75rem' }}>
          <div className={`quality-item ${dataQuality.hasRevenueData ? 'success' : 'error'}`}>
            {dataQuality.hasRevenueData ? <CheckCircle size={14} /> : <XCircle size={14} />}
            Revenue Data
          </div>
          <div className={`quality-item ${dataQuality.hasEBITDAData ? 'success' : 'error'}`}>
            {dataQuality.hasEBITDAData ? <CheckCircle size={14} /> : <XCircle size={14} />}
            EBITDA Data
          </div>
          <div className={`quality-item ${dataQuality.hasOccupancyData ? 'success' : 'error'}`}>
            {dataQuality.hasOccupancyData ? <CheckCircle size={14} /> : <XCircle size={14} />}
            Occupancy Data
          </div>
          <div className={`quality-item ${dataQuality.hasPayerMixData ? 'success' : 'error'}`}>
            {dataQuality.hasPayerMixData ? <CheckCircle size={14} /> : <XCircle size={14} />}
            Payer Mix Data
          </div>
        </div>
      </div>

      {/* SNFalyze Panel (Unified Component) */}
      <SNFalyzePanel
        isOpen={showSNFalyzePanel}
        onClose={() => setShowSNFalyzePanel(false)}
        dealId={dealId}
        deal={deal}
        autoAnalyze={true}
      />
    </div>
  );
};

export default DealCalculatorTab;

// =============================================================================
// FUTURE EXTENSION: Apply to All Facilities
// =============================================================================
// TODO: When multi-facility deals are supported, add a "Apply to All Facilities"
// button that copies the current scenarioState.driverValue to all facility rows
// and recomputes their individual scenario valuations.
