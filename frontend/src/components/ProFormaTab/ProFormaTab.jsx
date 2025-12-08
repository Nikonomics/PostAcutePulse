import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Table, Form, Row, Col, Badge, Button, Spinner, InputGroup, Alert, Modal, Dropdown } from 'react-bootstrap';
import { TrendingUp, TrendingDown, AlertTriangle, Save, RotateCcw, Plus, FileText, Info, FolderOpen, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { debounce } from 'lodash';
import {
  calculateProforma as calculateProformaAPI,
  getProformaScenarios,
  createProformaScenario,
  deleteProformaScenario
} from '../../api/DealService';
import OpportunityWaterfall from './OpportunityWaterfall';
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters';
import './ProFormaTab.css';

const DEFAULT_BENCHMARKS = {
  occupancy_target: 85,
  private_pay_mix_target: 35,
  labor_pct_target: 55,
  agency_pct_of_labor_target: 2,
  food_cost_per_day_target: 10.50,
  revenue_per_occupied_bed_target: 115,  // $ per day
  management_fee_pct_target: 4,
  bad_debt_pct_target: 0.5,
  utilities_pct_target: 2.5,
  insurance_pct_target: 1.5,  // Updated from 3 to 1.5
  ebitda_margin_target: 9,
  ebitdar_margin_target: 23,
  // Department expense targets (% of revenue)
  direct_care_pct_target: 28,
  activities_pct_target: 1.5,
  culinary_pct_target: 8,
  housekeeping_pct_target: 4,
  maintenance_pct_target: 3,
  administration_pct_target: 6,
  general_pct_target: 5,
  property_pct_target: 8
};

/**
 * Get user-friendly error message based on error type
 * @param {Error} error - The error object
 * @param {string} defaultMessage - Default message if error type not recognized
 * @returns {string} User-friendly error message
 */
const getErrorMessage = (error, defaultMessage = 'An unexpected error occurred. Please try again.') => {
  // Network errors (no response from server)
  if (!error.response && error.message === 'Network Error') {
    return 'Network error. Check your connection and try again.';
  }

  // Axios errors with response
  if (error.response) {
    const { status } = error.response;

    switch (status) {
      case 404:
        return 'Pro Forma feature not available. Please contact support.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 422:
        return 'Invalid data provided. Please check your inputs and try again.';
      case 500:
      case 502:
      case 503:
        return 'Server error. Please try again later.';
      default:
        return defaultMessage;
    }
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please check your connection and try again.';
  }

  return defaultMessage;
};

// Status badge helper
const getStatusBadge = (status) => {
  const badges = {
    on_target: { variant: 'success', text: 'On Target' },
    above_target: { variant: 'warning', text: 'Above Target' },
    critical: { variant: 'danger', text: 'Critical' },
    below_target: { variant: 'info', text: 'Below Target' }
  };

  const badge = badges[status] || { variant: 'secondary', text: 'Unknown' };
  return <Badge bg={badge.variant}>{badge.text}</Badge>;
};

// Calculate variance status
const getVarianceStatus = (actual, benchmark, isReversed = false) => {
  if (!actual || !benchmark) return 'unknown';

  const variance = actual - benchmark;
  const pctVariance = (variance / benchmark) * 100;

  // For expenses, higher is worse (reversed logic)
  // For revenue/margins, higher is better
  if (isReversed) {
    if (pctVariance <= 0) return 'on_target';
    if (pctVariance <= 10) return 'above_target';
    return 'critical';
  } else {
    if (pctVariance >= 0) return 'on_target';
    if (pctVariance >= -10) return 'below_target';
    return 'critical';
  }
};

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, icon: Icon, trend, variant = 'primary', isLoading = false }) => (
  <Card className={`summary-card border-${variant}`}>
    <Card.Body>
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="text-muted small d-flex align-items-center">
            {title}
            {isLoading && (
              <Spinner animation="border" size="sm" className="ms-2" variant={variant} />
            )}
          </div>
          <h3 className={`mb-1 text-${variant}`} style={{ opacity: isLoading ? 0.6 : 1 }}>{value}</h3>
          {subtitle && <div className="text-muted small">{subtitle}</div>}
        </div>
        <div className={`summary-icon bg-${variant} bg-opacity-10`}>
          {Icon && <Icon size={24} className={`text-${variant}`} />}
        </div>
      </div>
      {trend && (
        <div className="mt-2">
          <Badge bg={trend > 0 ? 'success' : 'danger'}>
            {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {' '}{Math.abs(trend)}%
          </Badge>
        </div>
      )}
    </Card.Body>
  </Card>
);

// Section Header Component
const SectionHeader = ({ title, subtitle }) => (
  <tr className="section-header">
    <td colSpan="6" className="bg-light">
      <strong>{title}</strong>
      {subtitle && <span className="text-muted small ms-2">{subtitle}</span>}
    </td>
  </tr>
);

// Line Item Row Component
const LineItemRow = ({
  label,
  actual,
  actualPctOfRevenue,
  benchmark,
  benchmarkKey,
  onBenchmarkChange,
  unit = '%',
  benchmarkUnit = null,  // Optional: separate unit for benchmark (e.g., '%' when actual is '$')
  isEditable = false,
  isReversed = false,
  indent = 0,
  isBold = false,
  opportunity,
  isDisabled = false
}) => {
  // Use benchmarkUnit for benchmark/variance display if provided, otherwise use unit
  const displayBenchmarkUnit = benchmarkUnit || unit;

  // For variance calculation when units differ (e.g., actual is $ but benchmark is %),
  // we need to compare the % of revenue (actualPctOfRevenue) against the benchmark
  const varianceValue = benchmarkUnit && actualPctOfRevenue !== null && benchmark
    ? actualPctOfRevenue - benchmark
    : (actual && benchmark ? actual - benchmark : null);

  const varianceCompareValue = benchmarkUnit ? actualPctOfRevenue : actual;
  const varianceStatus = getVarianceStatus(varianceCompareValue, benchmark, isReversed);
  const isActualMissing = actual === null || actual === undefined;
  const inputDisabled = isActualMissing || isDisabled;

  const handleInputChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && onBenchmarkChange) {
      onBenchmarkChange(benchmarkKey, value);
    }
  };

  return (
    <tr className={`${isBold ? 'font-weight-bold' : ''} ${isActualMissing ? 'text-muted' : ''}`}>
      <td style={{ paddingLeft: `${1 + indent * 1.5}rem` }}>
        {label}
        {isActualMissing && <span className="ms-1 text-muted small">(N/A)</span>}
      </td>
      <td className="text-end">
        {isActualMissing ? (
          <span className="text-muted">N/A</span>
        ) : (
          unit === '$' ? formatCurrency(actual) :
          unit === '%' ? formatPercent(actual) :
          formatNumber(actual)
        )}
      </td>
      <td className="text-end text-muted">
        {actualPctOfRevenue ? formatPercent(actualPctOfRevenue) : '-'}
      </td>
      <td className="text-end">
        {isEditable ? (
          <InputGroup size="sm" style={{ width: '120px', marginLeft: 'auto' }}>
            <Form.Control
              type="number"
              step={displayBenchmarkUnit === '$' ? '0.01' : '0.1'}
              value={benchmark || ''}
              onChange={handleInputChange}
              className="text-end"
              disabled={inputDisabled}
              title={isActualMissing ? 'Actual value not available - benchmark editing disabled' : (isDisabled ? 'Calculation in progress...' : '')}
            />
            <InputGroup.Text className={inputDisabled ? 'text-muted' : ''}>{displayBenchmarkUnit}</InputGroup.Text>
          </InputGroup>
        ) : (
          <span>
            {displayBenchmarkUnit === '$' ? formatCurrency(benchmark) :
             displayBenchmarkUnit === '%' ? formatPercent(benchmark) :
             formatNumber(benchmark)}
          </span>
        )}
      </td>
      <td className="text-end">
        {varianceValue !== null ? (
          <span className={`variance variance-${varianceStatus}`}>
            {displayBenchmarkUnit === '$' ? formatCurrency(varianceValue) :
             displayBenchmarkUnit === '%' ? formatPercent(varianceValue) :
             formatNumber(varianceValue)}
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className="text-end">
        {opportunity ? (
          <strong className="text-success">{formatCurrency(opportunity)}</strong>
        ) : '-'}
      </td>
    </tr>
  );
};

const ProFormaTab = ({ deal, extractionData, onSaveScenario }) => {
  const [benchmarks, setBenchmarks] = useState(DEFAULT_BENCHMARKS);
  const [analysis, setAnalysis] = useState(null);
  const [scenarioName, setScenarioName] = useState('Base Case');
  const [isLoading, setIsLoading] = useState(true); // Initial data fetch
  const [isCalculating, setIsCalculating] = useState(false); // Recalculation in progress
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Scenario management state
  const [scenarios, setScenarios] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [scenarioNotes, setScenarioNotes] = useState('');
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Helper to extract value from nested extraction field
  const getValue = (field) => {
    if (!field) return null;
    // Handle both nested {value, confidence} and flat values
    return field?.value !== undefined ? field.value : field;
  };

  // Extract current financials from extraction data
  // Handles both nested structure (from AI extraction) and flat structure
  // NOTE: This must NOT depend on `analysis` to avoid infinite re-render loops
  // The expense_data from API is merged separately in displayFinancials
  const currentFinancials = useMemo(() => {
    if (!extractionData) return null;

    // Try nested structure first (financial_information_t12), then flat fields
    const fin = extractionData.financial_information_t12 || {};
    const census = extractionData.census_and_occupancy || {};
    const facility = extractionData.facility_information || {};

    // Get revenue - try nested, then flat
    const revenue = getValue(fin.total_revenue)
      || extractionData.annual_revenue
      || extractionData.t12m_revenue;

    // Get EBITDA/EBITDAR - try nested, then flat
    const ebitda = getValue(fin.ebitda)
      || extractionData.ebitda
      || extractionData.t12m_ebitda;
    const ebitdar = getValue(fin.ebitdar)
      || extractionData.ebitdar
      || extractionData.t12m_ebitdar;

    // Get occupancy and beds - using CANONICAL field names
    const occupancy = getValue(census.occupancy_pct)
      || getValue(census.occupancy_percentage)  // Legacy fallback
      || extractionData.occupancy_pct
      || extractionData.current_occupancy
      || extractionData.t12m_occupancy;
    const beds = getValue(facility.bed_count)
      || extractionData.bed_count
      || extractionData.no_of_beds;  // Legacy fallback

    // Get expense ratios from extraction data
    const expenseRatios = fin.expense_ratios || {};
    const labor_pct = getValue(expenseRatios.labor_pct_of_revenue)
      || extractionData.labor_pct_of_revenue
      || extractionData.labor_pct;
    const agency_pct = getValue(expenseRatios.agency_pct_of_labor)
      || extractionData.agency_pct_of_labor
      || extractionData.agency_pct;
    const food_cost = getValue(expenseRatios.food_cost_per_resident_day)
      || extractionData.food_cost_per_resident_day
      || extractionData.food_cost;
    const management_fee_pct = getValue(expenseRatios.management_fee_pct)
      || extractionData.management_fee_pct;
    const bad_debt_pct = getValue(expenseRatios.bad_debt_pct)
      || extractionData.bad_debt_pct;
    const utilities_pct = getValue(expenseRatios.utilities_pct_of_revenue)
      || extractionData.utilities_pct_of_revenue
      || extractionData.utilities_pct;
    const insurance_pct = getValue(expenseRatios.insurance_pct_of_revenue)
      || extractionData.insurance_pct_of_revenue
      || extractionData.insurance_pct;

    // Get dollar amounts from extraction data
    const total_labor_cost = getValue(expenseRatios.total_labor_cost)
      || extractionData.total_labor_cost;

    // Department expense totals from extraction
    const total_direct_care = extractionData.total_direct_care;
    const total_activities = extractionData.total_activities;
    const total_culinary = extractionData.total_culinary;
    const total_housekeeping = extractionData.total_housekeeping;
    const total_maintenance = extractionData.total_maintenance;
    const total_administration = extractionData.total_administration;
    const total_general = extractionData.total_general;
    const total_property = extractionData.total_property;

    return {
      revenue,
      ebitda,
      ebitdar,
      occupancy,
      beds,

      // Dollar amounts for expense categories
      total_labor_cost,
      raw_food_cost: getValue(fin.expense_breakdown?.culinary?.raw_food_cost) || extractionData.raw_food_cost,
      management_fees: getValue(fin.expense_breakdown?.administration?.management_fees) || extractionData.management_fees,
      utilities_total: getValue(fin.expense_breakdown?.maintenance?.utilities_total) || extractionData.utilities_total,

      // Expense ratios (percentages)
      labor_pct,
      agency_pct,
      food_cost,
      management_fee_pct,
      bad_debt_pct,
      utilities_pct,
      insurance_pct,

      // Margins (calculated)
      ebitda_margin: ebitda && revenue
        ? (ebitda / revenue) * 100
        : null,
      ebitdar_margin: ebitdar && revenue
        ? (ebitdar / revenue) * 100
        : null,

      // Department expense totals
      total_direct_care,
      total_activities,
      total_culinary,
      total_housekeeping,
      total_maintenance,
      total_administration,
      total_general,
      total_property
    };
  }, [extractionData]);

  // Merge currentFinancials with API expense_data for display purposes
  // This depends on analysis but does NOT trigger recalculation
  const displayFinancials = useMemo(() => {
    if (!currentFinancials) return null;

    // Get expense data from API response (analysis.expense_data) - takes priority for display
    const apiExpense = analysis?.expense_data || {};

    return {
      ...currentFinancials,
      // Override with API expense data where available
      total_labor_cost: apiExpense.total_labor_cost ?? currentFinancials.total_labor_cost,
      labor_pct: apiExpense.labor_pct_of_revenue ?? currentFinancials.labor_pct,
      agency_pct: apiExpense.agency_pct_of_labor ?? currentFinancials.agency_pct,
      food_cost: apiExpense.food_cost_per_resident_day ?? currentFinancials.food_cost,
      utilities_pct: apiExpense.utilities_pct_of_revenue ?? currentFinancials.utilities_pct,
      insurance_pct: apiExpense.insurance_pct_of_revenue ?? currentFinancials.insurance_pct,
      // Department expense totals - API takes priority
      total_direct_care: apiExpense.total_direct_care ?? currentFinancials.total_direct_care,
      total_activities: apiExpense.total_activities ?? currentFinancials.total_activities,
      total_culinary: apiExpense.total_culinary ?? currentFinancials.total_culinary,
      total_housekeeping: apiExpense.total_housekeeping ?? currentFinancials.total_housekeeping,
      total_maintenance: apiExpense.total_maintenance ?? currentFinancials.total_maintenance,
      total_administration: apiExpense.total_administration ?? currentFinancials.total_administration,
      total_general: apiExpense.total_general ?? currentFinancials.total_general,
      total_property: apiExpense.total_property ?? currentFinancials.total_property
    };
  }, [currentFinancials, analysis]);

  // Track if initial load has completed
  const hasInitialLoadCompleted = React.useRef(false);

  // Debounced calculation - always sets isCalculating, not isLoading
  // isLoading is only for the initial load before first API success
  const calculateProforma = useCallback(
    debounce(async (benchmarkValues) => {
      if (!deal?.id || !currentFinancials) {
        // Clear loading state if we can't make the call
        setIsLoading(false);
        return;
      }

      setIsCalculating(true);
      setError(null);

      try {
        const result = await calculateProformaAPI(deal.id, {
          ...benchmarkValues,
          current_financials: currentFinancials
        });
        setAnalysis(result);
        // Mark initial load as complete on first successful result
        if (!hasInitialLoadCompleted.current) {
          hasInitialLoadCompleted.current = true;
        }
      } catch (err) {
        console.error('Pro forma calculation error:', err);
        const message = getErrorMessage(err, 'Failed to calculate pro forma. Please try again.');
        setError(message);
        // Don't clear analysis - keep previous values for user reference
      } finally {
        // Always clear both loading states to ensure spinner stops
        setIsLoading(false);
        setIsCalculating(false);
      }
    }, 500),
    [deal?.id, currentFinancials]
  );

  // Recalculate when benchmarks change
  useEffect(() => {
    // If deal.id is missing, we can't make API calls - stop spinner
    if (!deal?.id) {
      setIsLoading(false);
      setError('Deal information unavailable. Please reload the page.');
      return;
    }

    if (currentFinancials) {
      calculateProforma(benchmarks);
    } else if (extractionData) {
      // extractionData exists but currentFinancials is null - stop loading spinner
      // This happens when extraction data structure doesn't match expected format
      setIsLoading(false);
      setError('Limited financial data available. Some Pro Forma features may not be available.');
    } else {
      // No extraction data at all - stop spinner (the empty state UI will handle the message)
      setIsLoading(false);
    }
  }, [benchmarks, calculateProforma, currentFinancials, extractionData, deal?.id]);

  // Handle benchmark change
  const handleBenchmarkChange = useCallback((key, value) => {
    setBenchmarks(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Request reset to defaults (shows confirmation if there are changes)
  const handleResetRequest = () => {
    if (hasUnsavedChanges || isDifferentFromDefaults) {
      setShowResetConfirm(true);
    } else {
      // No changes, just reset directly
      handleResetDefaults();
    }
  };

  // Actually reset to defaults
  const handleResetDefaults = () => {
    setBenchmarks(DEFAULT_BENCHMARKS);
    setSelectedScenarioId(null);
    setScenarioName('Base Case');
    setShowResetConfirm(false);
  };

  // Save scenario
  const handleSave = async () => {
    if (!scenarioName.trim()) {
      setError('Please enter a scenario name');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await onSaveScenario({
        scenario_name: scenarioName,
        benchmarks,
        analysis
      });
      setSuccessMessage(`Scenario "${scenarioName}" saved successfully!`);
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Save error:', err);
      const message = getErrorMessage(err, 'Failed to save scenario. Please try again.');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch saved scenarios on mount
  const fetchScenarios = useCallback(async () => {
    if (!deal?.id) return;

    setIsLoadingScenarios(true);
    try {
      const result = await getProformaScenarios(deal.id);
      // Ensure we always have an array
      setScenarios(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load scenarios:', err);
      setScenarios([]); // Reset to empty array on error
    } finally {
      setIsLoadingScenarios(false);
    }
  }, [deal?.id]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  // Load a saved scenario
  const handleLoadScenario = useCallback((scenario) => {
    if (!scenario) return;

    // Apply the benchmark overrides from the saved scenario
    const overrides = scenario.benchmark_overrides || {};
    setBenchmarks(prev => ({
      ...DEFAULT_BENCHMARKS,
      ...overrides
    }));

    setSelectedScenarioId(scenario.id);
    setScenarioName(scenario.scenario_name);
    setSuccessMessage(`Loaded scenario: "${scenario.scenario_name}"`);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  // Open save modal
  const handleOpenSaveModal = () => {
    setNewScenarioName(scenarioName || 'New Scenario');
    setScenarioNotes('');
    setShowSaveModal(true);
  };

  // Save scenario via modal
  const handleSaveScenario = async () => {
    if (!newScenarioName.trim()) {
      setError('Please enter a scenario name');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Calculate benchmark overrides (only non-default values)
      const overrides = {};
      Object.keys(benchmarks).forEach(key => {
        if (benchmarks[key] !== DEFAULT_BENCHMARKS[key]) {
          overrides[key] = benchmarks[key];
        }
      });

      const scenarioData = {
        scenario_name: newScenarioName,
        benchmark_overrides: overrides,
        notes: scenarioNotes || null,
        // Include calculated outputs for quick display
        stabilized_revenue: analysis?.stabilized_revenue,
        stabilized_ebitda: analysis?.stabilized_ebitda,
        stabilized_ebitdar: analysis?.stabilized_ebitdar,
        total_opportunity: analysis?.total_opportunity,
        opportunities: analysis?.opportunities
      };

      const result = await createProformaScenario(deal.id, scenarioData);

      setShowSaveModal(false);
      setSelectedScenarioId(result.id);
      setScenarioName(newScenarioName);
      setSuccessMessage(`Scenario "${newScenarioName}" saved successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Refresh scenarios list
      fetchScenarios();
    } catch (err) {
      console.error('Save scenario error:', err);
      const message = getErrorMessage(err, 'Failed to save scenario. Please try again.');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a scenario
  const handleDeleteScenario = async (scenarioId) => {
    setError(null);

    try {
      await deleteProformaScenario(deal.id, scenarioId);

      // If we deleted the currently loaded scenario, reset to defaults
      if (selectedScenarioId === scenarioId) {
        setSelectedScenarioId(null);
        setScenarioName('Base Case');
        setBenchmarks(DEFAULT_BENCHMARKS);
      }

      setDeleteConfirmId(null);
      setSuccessMessage('Scenario deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Refresh scenarios list
      fetchScenarios();
    } catch (err) {
      console.error('Delete scenario error:', err);
      const message = getErrorMessage(err, 'Failed to delete scenario. Please try again.');
      setError(message);
    }
  };

  // Reset to base case (alias for handleResetDefaults, used in dropdown)
  const handleResetToBase = handleResetDefaults;

  // Get the currently loaded scenario object
  const currentScenario = useMemo(() => {
    if (!selectedScenarioId) return null;
    return scenarios.find(s => s.id === selectedScenarioId);
  }, [selectedScenarioId, scenarios]);

  // Check if benchmarks have been modified from defaults or loaded scenario
  const hasUnsavedChanges = useMemo(() => {
    // Compare current benchmarks to either loaded scenario or defaults
    const compareTo = currentScenario?.benchmark_overrides
      ? { ...DEFAULT_BENCHMARKS, ...currentScenario.benchmark_overrides }
      : DEFAULT_BENCHMARKS;

    return Object.keys(DEFAULT_BENCHMARKS).some(key => {
      return benchmarks[key] !== compareTo[key];
    });
  }, [benchmarks, currentScenario]);

  // Check if current benchmarks differ from defaults (for reset button state)
  const isDifferentFromDefaults = useMemo(() => {
    return Object.keys(DEFAULT_BENCHMARKS).some(key => {
      return benchmarks[key] !== DEFAULT_BENCHMARKS[key];
    });
  }, [benchmarks]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!analysis || !currentFinancials) {
      return {
        totalOpportunity: 0,
        stabilizedEbitda: 0,
        stabilizedMargin: 0,
        issuesCount: 0
      };
    }

    return {
      totalOpportunity: analysis.total_opportunity || 0,
      stabilizedEbitda: analysis.stabilized_ebitda || 0,
      stabilizedMargin: analysis.stabilized_ebitda && analysis.stabilized_revenue
        ? (analysis.stabilized_ebitda / analysis.stabilized_revenue) * 100
        : 0,
      issuesCount: analysis.issues ? analysis.issues.length : 0
    };
  }, [analysis, currentFinancials]);

  // Check if expense ratio data is available (from either extraction or API)
  const hasExpenseRatios = useMemo(() => {
    // Use displayFinancials if available (includes API data), fall back to currentFinancials
    const financials = displayFinancials || currentFinancials;
    if (!financials) return false;
    const expenseFields = [
      financials.labor_pct,
      financials.agency_pct,
      financials.food_cost,
      financials.management_fee_pct,
      financials.bad_debt_pct,
      financials.utilities_pct,
      financials.insurance_pct
    ];
    // Count how many expense fields have values
    const populatedCount = expenseFields.filter(v => v !== null && v !== undefined).length;
    return populatedCount >= 2; // At least 2 expense metrics available
  }, [displayFinancials, currentFinancials]);

  // Count missing expense metrics for the note
  const missingExpenseCount = useMemo(() => {
    // Use displayFinancials if available (includes API data), fall back to currentFinancials
    const financials = displayFinancials || currentFinancials;
    if (!financials) return 7;
    const expenseFields = [
      financials.labor_pct,
      financials.agency_pct,
      financials.food_cost,
      financials.management_fee_pct,
      financials.bad_debt_pct,
      financials.utilities_pct,
      financials.insurance_pct
    ];
    return expenseFields.filter(v => v === null || v === undefined).length;
  }, [displayFinancials, currentFinancials]);

  // Empty state: No extraction data at all
  if (!extractionData) {
    return (
      <div className="proforma-empty-state">
        <Alert variant="info" className="d-flex align-items-start">
          <FileText size={24} className="me-3 flex-shrink-0 mt-1" />
          <div>
            <Alert.Heading className="h5 mb-2">Run AI Extraction First</Alert.Heading>
            <p className="mb-2">
              Pro Forma analysis requires extracted financial data from your deal documents.
            </p>
            <p className="mb-0 text-muted small">
              Upload financial statements (P&L, balance sheet, rent roll) and run the AI extraction
              to populate the financial metrics needed for Pro Forma modeling.
            </p>
          </div>
        </Alert>
      </div>
    );
  }

  // Empty state: Extraction exists but no core financial data
  if (!currentFinancials || (!currentFinancials.revenue && !currentFinancials.ebitda)) {
    return (
      <div className="proforma-empty-state">
        <Alert variant="warning" className="d-flex align-items-start">
          <AlertTriangle size={24} className="me-3 flex-shrink-0 mt-1" />
          <div>
            <Alert.Heading className="h5 mb-2">Financial Details Not Available</Alert.Heading>
            <p className="mb-2">
              The extracted data doesn't contain enough financial information for Pro Forma analysis.
            </p>
            <p className="mb-0 text-muted small">
              Re-run extraction with updated documents that include detailed P&L statements
              with revenue, expense breakdowns, and EBITDA figures.
            </p>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="proforma-tab">
      {/* Header Section */}
      <Row className="mb-4">
        <Col md={6}>
          <h4>Pro Forma Analysis</h4>
          <p className="text-muted mb-0">
            Adjust benchmark targets to calculate stabilization opportunity
          </p>
          {/* Currently loaded scenario indicator */}
          {currentScenario && (
            <div className="mt-2 d-flex align-items-center">
              <Badge bg={hasUnsavedChanges ? 'warning' : 'info'} className="me-2">
                <CheckCircle size={12} className="me-1" />
                {currentScenario.scenario_name}
                {hasUnsavedChanges && <span className="ms-1">*</span>}
              </Badge>
              <span className="text-muted small">
                {hasUnsavedChanges ? (
                  <span className="text-warning">Unsaved changes</span>
                ) : (
                  <>Saved {formatDate(currentScenario.created_at)}</>
                )}
              </span>
              <Button
                variant="link"
                size="sm"
                className="p-0 ms-2 text-muted"
                onClick={handleResetToBase}
                title="Clear and reset to Base Case"
              >
                <RotateCcw size={14} />
              </Button>
            </div>
          )}
          {/* Show unsaved changes indicator when not using a loaded scenario */}
          {!currentScenario && isDifferentFromDefaults && (
            <div className="mt-2">
              <Badge bg="warning" className="me-2">
                Modified *
              </Badge>
              <span className="text-muted small text-warning">
                Benchmarks modified from defaults
              </span>
            </div>
          )}
        </Col>
        <Col md={6} className="text-end">
          <div className="d-flex justify-content-end align-items-start gap-2 flex-wrap">
            {/* Load Scenario Dropdown */}
            <Dropdown>
              <Dropdown.Toggle
                variant="outline-secondary"
                size="sm"
                id="scenario-dropdown"
                disabled={isLoadingScenarios}
              >
                {isLoadingScenarios ? (
                  <Spinner animation="border" size="sm" className="me-1" />
                ) : (
                  <FolderOpen size={16} className="me-1" />
                )}
                Load Scenario
              </Dropdown.Toggle>
              <Dropdown.Menu align="end" style={{ minWidth: '280px' }}>
                {scenarios.length === 0 ? (
                  <Dropdown.ItemText className="text-muted small">
                    No saved scenarios yet
                  </Dropdown.ItemText>
                ) : (
                  <>
                    {scenarios.map((scenario) => (
                      <div key={scenario.id} className="d-flex align-items-center px-2 py-1">
                        <Dropdown.Item
                          onClick={() => handleLoadScenario(scenario)}
                          className="flex-grow-1 py-2"
                          active={selectedScenarioId === scenario.id}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <strong>{scenario.scenario_name}</strong>
                              <div className="text-muted small">
                                <Calendar size={10} className="me-1" />
                                {formatDate(scenario.created_at)}
                              </div>
                            </div>
                            {scenario.stabilized_ebitda && (
                              <span className="text-success small fw-bold ms-2">
                                {formatCurrency(scenario.stabilized_ebitda)}
                              </span>
                            )}
                          </div>
                        </Dropdown.Item>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-danger p-1 ms-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(scenario.id);
                          }}
                          title="Delete scenario"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleResetToBase} className="text-muted">
                      <RotateCcw size={14} className="me-2" />
                      Reset to Base Case
                    </Dropdown.Item>
                  </>
                )}
              </Dropdown.Menu>
            </Dropdown>

            {/* Reset to Defaults Button */}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleResetRequest}
              disabled={isCalculating || !isDifferentFromDefaults}
              title="Reset benchmarks to Cascadia defaults"
            >
              <RotateCcw size={16} className="me-1" /> Reset to Defaults
            </Button>

            {/* Save Scenario Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenSaveModal}
              disabled={isSaving || isCalculating}
            >
              {isSaving ? (
                <Spinner animation="border" size="sm" className="me-1" />
              ) : (
                <Save size={16} className="me-1" />
              )}
              Save Scenario
            </Button>
          </div>
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <SummaryCard
            title="Total Opportunity"
            value={formatCurrency(summaryMetrics.totalOpportunity)}
            subtitle="Annual improvement potential"
            icon={TrendingUp}
            variant="success"
            isLoading={isCalculating}
          />
        </Col>
        <Col md={3}>
          <SummaryCard
            title="Stabilized EBITDA"
            value={formatCurrency(summaryMetrics.stabilizedEbitda)}
            subtitle={`vs ${formatCurrency(displayFinancials?.ebitda ?? currentFinancials?.ebitda)} current`}
            icon={TrendingUp}
            variant="primary"
            isLoading={isCalculating}
          />
        </Col>
        <Col md={3}>
          <SummaryCard
            title="Stabilized Margin"
            value={formatPercent(summaryMetrics.stabilizedMargin)}
            subtitle={`Target: ${formatPercent(benchmarks.ebitda_margin_target)}`}
            icon={TrendingUp}
            variant="info"
            isLoading={isCalculating}
          />
        </Col>
        <Col md={3}>
          <SummaryCard
            title="Issues Found"
            value={summaryMetrics.issuesCount}
            subtitle="Areas above target"
            icon={AlertTriangle}
            variant={summaryMetrics.issuesCount > 0 ? 'warning' : 'success'}
            isLoading={isCalculating}
          />
        </Col>
      </Row>

      {/* Success Alert */}
      {successMessage && (
        <Alert variant="success" dismissible onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Warning for missing expense ratios */}
      {!hasExpenseRatios && (
        <Alert variant="warning" className="d-flex align-items-start mb-4">
          <Info size={20} className="me-2 flex-shrink-0 mt-1" />
          <div>
            <strong>Limited expense data available.</strong>{' '}
            <span className="text-muted">
              Re-run extraction with detailed P&L statements to enable full expense analysis and opportunity calculations.
            </span>
          </div>
        </Alert>
      )}

      {/* Initial Loading State */}
      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" size="lg" />
          <div className="mt-3 text-muted">Loading Pro Forma analysis...</div>
        </div>
      )}

      {/* Pro Forma Table */}
      {!isLoading && (
      <Card className="proforma-table-card">
        <Card.Body>
          <div style={{ opacity: isCalculating ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
          <Table hover responsive className="proforma-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Category</th>
                <th className="text-end" style={{ width: '15%' }}>Actual</th>
                <th className="text-end" style={{ width: '10%' }}>% Rev</th>
                <th className="text-end" style={{ width: '15%' }}>Benchmark</th>
                <th className="text-end" style={{ width: '15%' }}>Variance</th>
                <th className="text-end" style={{ width: '15%' }}>Opportunity</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue Section */}
              <SectionHeader title="Revenue & Occupancy" />
              <LineItemRow
                label="Annual Revenue"
                actual={currentFinancials.revenue}
                unit="$"
                benchmark={analysis?.stabilized_revenue}
                opportunity={analysis?.opportunities?.find(o => o.category === 'Revenue Growth')?.opportunity}
              />
              <LineItemRow
                label="Occupancy"
                actual={currentFinancials.occupancy}
                benchmark={benchmarks.occupancy_target}
                benchmarkKey="occupancy_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                indent={1}
              />
              <LineItemRow
                label="Revenue per Occupied Bed"
                actual={currentFinancials.revenue && currentFinancials.beds && currentFinancials.occupancy
                  ? currentFinancials.revenue / (currentFinancials.beds * (currentFinancials.occupancy / 100) * 365)
                  : null}
                unit="$"
                benchmark={benchmarks.revenue_per_occupied_bed_target}
                benchmarkKey="revenue_per_occupied_bed_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                indent={1}
              />

              {/* Labor Section */}
              <SectionHeader title="Labor Costs" subtitle="Largest expense category" />
              <LineItemRow
                label="Total Labor Cost"
                actual={displayFinancials?.labor_pct ?? currentFinancials.labor_pct}
                actualPctOfRevenue={displayFinancials?.labor_pct ?? currentFinancials.labor_pct}
                benchmark={benchmarks.labor_pct_target}
                benchmarkKey="labor_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                unit="%"
                isReversed={true}
                opportunity={(() => {
                  const actualPct = displayFinancials?.labor_pct ?? currentFinancials.labor_pct;
                  const variance = actualPct !== null && actualPct !== undefined ? actualPct - benchmarks.labor_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Agency Staffing Cost"
                actual={displayFinancials?.agency_pct ?? currentFinancials.agency_pct}
                actualPctOfRevenue={displayFinancials?.agency_pct ?? currentFinancials.agency_pct}
                benchmark={benchmarks.agency_pct_of_labor_target}
                benchmarkKey="agency_pct_of_labor_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                unit="%"
                isReversed={true}
                indent={1}
                opportunity={(() => {
                  const actualPct = displayFinancials?.agency_pct ?? currentFinancials.agency_pct;
                  const variance = actualPct !== null && actualPct !== undefined ? actualPct - benchmarks.agency_pct_of_labor_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />

              {/* Department Expense Totals Section */}
              <SectionHeader title="Department Expense Totals" subtitle="Annual amounts by category (benchmark = % of revenue)" />
              <LineItemRow
                label="Direct Care (Nursing)"
                actual={displayFinancials?.total_direct_care ?? currentFinancials.total_direct_care}
                actualPctOfRevenue={(displayFinancials?.total_direct_care ?? currentFinancials.total_direct_care) && currentFinancials.revenue
                  ? ((displayFinancials?.total_direct_care ?? currentFinancials.total_direct_care) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.direct_care_pct_target}
                benchmarkKey="direct_care_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_direct_care ?? currentFinancials.total_direct_care) && currentFinancials.revenue
                    ? ((displayFinancials?.total_direct_care ?? currentFinancials.total_direct_care) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.direct_care_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Activities"
                actual={displayFinancials?.total_activities ?? currentFinancials.total_activities}
                actualPctOfRevenue={(displayFinancials?.total_activities ?? currentFinancials.total_activities) && currentFinancials.revenue
                  ? ((displayFinancials?.total_activities ?? currentFinancials.total_activities) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.activities_pct_target}
                benchmarkKey="activities_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_activities ?? currentFinancials.total_activities) && currentFinancials.revenue
                    ? ((displayFinancials?.total_activities ?? currentFinancials.total_activities) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.activities_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Culinary (Dietary)"
                actual={displayFinancials?.total_culinary ?? currentFinancials.total_culinary}
                actualPctOfRevenue={(displayFinancials?.total_culinary ?? currentFinancials.total_culinary) && currentFinancials.revenue
                  ? ((displayFinancials?.total_culinary ?? currentFinancials.total_culinary) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.culinary_pct_target}
                benchmarkKey="culinary_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_culinary ?? currentFinancials.total_culinary) && currentFinancials.revenue
                    ? ((displayFinancials?.total_culinary ?? currentFinancials.total_culinary) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.culinary_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Housekeeping/Laundry"
                actual={displayFinancials?.total_housekeeping ?? currentFinancials.total_housekeeping}
                actualPctOfRevenue={(displayFinancials?.total_housekeeping ?? currentFinancials.total_housekeeping) && currentFinancials.revenue
                  ? ((displayFinancials?.total_housekeeping ?? currentFinancials.total_housekeeping) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.housekeeping_pct_target}
                benchmarkKey="housekeeping_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_housekeeping ?? currentFinancials.total_housekeeping) && currentFinancials.revenue
                    ? ((displayFinancials?.total_housekeeping ?? currentFinancials.total_housekeeping) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.housekeeping_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Maintenance"
                actual={displayFinancials?.total_maintenance ?? currentFinancials.total_maintenance}
                actualPctOfRevenue={(displayFinancials?.total_maintenance ?? currentFinancials.total_maintenance) && currentFinancials.revenue
                  ? ((displayFinancials?.total_maintenance ?? currentFinancials.total_maintenance) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.maintenance_pct_target}
                benchmarkKey="maintenance_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_maintenance ?? currentFinancials.total_maintenance) && currentFinancials.revenue
                    ? ((displayFinancials?.total_maintenance ?? currentFinancials.total_maintenance) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.maintenance_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Administration"
                actual={displayFinancials?.total_administration ?? currentFinancials.total_administration}
                actualPctOfRevenue={(displayFinancials?.total_administration ?? currentFinancials.total_administration) && currentFinancials.revenue
                  ? ((displayFinancials?.total_administration ?? currentFinancials.total_administration) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.administration_pct_target}
                benchmarkKey="administration_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_administration ?? currentFinancials.total_administration) && currentFinancials.revenue
                    ? ((displayFinancials?.total_administration ?? currentFinancials.total_administration) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.administration_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="General (G&A)"
                actual={displayFinancials?.total_general ?? currentFinancials.total_general}
                actualPctOfRevenue={(displayFinancials?.total_general ?? currentFinancials.total_general) && currentFinancials.revenue
                  ? ((displayFinancials?.total_general ?? currentFinancials.total_general) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.general_pct_target}
                benchmarkKey="general_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_general ?? currentFinancials.total_general) && currentFinancials.revenue
                    ? ((displayFinancials?.total_general ?? currentFinancials.total_general) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.general_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />
              <LineItemRow
                label="Property"
                actual={displayFinancials?.total_property ?? currentFinancials.total_property}
                actualPctOfRevenue={(displayFinancials?.total_property ?? currentFinancials.total_property) && currentFinancials.revenue
                  ? ((displayFinancials?.total_property ?? currentFinancials.total_property) / currentFinancials.revenue) * 100 : null}
                benchmark={benchmarks.property_pct_target}
                benchmarkKey="property_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                benchmarkUnit="%"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={(() => {
                  const actualPct = (displayFinancials?.total_property ?? currentFinancials.total_property) && currentFinancials.revenue
                    ? ((displayFinancials?.total_property ?? currentFinancials.total_property) / currentFinancials.revenue) * 100 : null;
                  const variance = actualPct !== null ? actualPct - benchmarks.property_pct_target : null;
                  return variance > 0 && currentFinancials.revenue ? (variance / 100) * currentFinancials.revenue : null;
                })()}
              />

              {/* Other Expenses Section */}
              <SectionHeader title="Other Operating Expenses" />
              <LineItemRow
                label="Food Cost per Resident Day"
                actual={displayFinancials?.food_cost ?? currentFinancials.food_cost}
                benchmark={benchmarks.food_cost_per_day_target}
                benchmarkKey="food_cost_per_day_target"
                onBenchmarkChange={handleBenchmarkChange}
                unit="$"
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={analysis?.opportunities?.find(o => o.category === 'Food Cost')?.opportunity}
              />
              <LineItemRow
                label="Management Fees % of Revenue"
                actual={currentFinancials.management_fee_pct}
                benchmark={benchmarks.management_fee_pct_target}
                benchmarkKey="management_fee_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                opportunity={analysis?.opportunities?.find(o => o.category === 'Management Fees')?.opportunity}
              />
              <LineItemRow
                label="Bad Debt % of Revenue"
                actual={currentFinancials.bad_debt_pct}
                benchmark={benchmarks.bad_debt_pct_target}
                benchmarkKey="bad_debt_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
              />
              <LineItemRow
                label="Utilities % of Revenue"
                actual={displayFinancials?.utilities_pct ?? currentFinancials.utilities_pct}
                benchmark={benchmarks.utilities_pct_target}
                benchmarkKey="utilities_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
              />
              <LineItemRow
                label="Insurance % of Revenue"
                actual={displayFinancials?.insurance_pct ?? currentFinancials.insurance_pct}
                benchmark={benchmarks.insurance_pct_target}
                benchmarkKey="insurance_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
              />

              {/* Profitability Section */}
              <SectionHeader title="Profitability Metrics" />
              <LineItemRow
                label="EBITDA"
                actual={currentFinancials.ebitda}
                actualPctOfRevenue={currentFinancials.ebitda_margin}
                benchmark={analysis?.stabilized_ebitda}
                unit="$"
                isBold={true}
                opportunity={summaryMetrics.totalOpportunity}
              />
              <LineItemRow
                label="EBITDA Margin %"
                actual={currentFinancials.ebitda_margin}
                benchmark={benchmarks.ebitda_margin_target}
                benchmarkKey="ebitda_margin_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                indent={1}
              />
              <LineItemRow
                label="EBITDAR"
                actual={currentFinancials.ebitdar}
                actualPctOfRevenue={currentFinancials.ebitdar_margin}
                benchmark={analysis?.stabilized_ebitdar}
                unit="$"
                isBold={true}
              />
              <LineItemRow
                label="EBITDAR Margin %"
                actual={currentFinancials.ebitdar_margin}
                benchmark={benchmarks.ebitdar_margin_target}
                benchmarkKey="ebitdar_margin_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                indent={1}
              />
            </tbody>
          </Table>

          {/* Note about missing metrics */}
          {missingExpenseCount > 0 && (
            <div className="mt-3 p-2 bg-light rounded small text-muted d-flex align-items-center">
              <Info size={14} className="me-2 flex-shrink-0" />
              <span>
                {missingExpenseCount === 7
                  ? 'All expense metrics unavailable - source documents may not contain detailed expense breakdowns.'
                  : `${missingExpenseCount} of 7 expense metrics unavailable - some opportunity calculations may be limited.`
                }
              </span>
            </div>
          )}
          </div>
        </Card.Body>
      </Card>
      )}

      {/* EBITDA Bridge Waterfall Chart */}
      {!isLoading && currentFinancials?.ebitda && (
        <Card className="mt-4" style={{ opacity: isCalculating ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
          <Card.Header>
            <h5 className="mb-0">EBITDA Bridge to Stabilization</h5>
          </Card.Header>
          <Card.Body>
            {Array.isArray(analysis?.opportunities) && analysis.opportunities.length > 0 ? (
              <OpportunityWaterfall
                currentEbitda={currentFinancials.ebitda}
                opportunities={analysis.opportunities.map(opp => ({
                  label: opp.category || opp.label || 'Opportunity',
                  value: opp.opportunity || opp.value || 0,
                  priority: opp.priority || 'medium'
                }))}
                stabilizedEbitda={analysis.stabilized_ebitda || currentFinancials.ebitda + summaryMetrics.totalOpportunity}
                height={350}
                showLabels={true}
              />
            ) : (
              // Simple fallback when no opportunities calculated
              <OpportunityWaterfall
                currentEbitda={currentFinancials.ebitda}
                opportunities={[{
                  label: 'Estimated Opportunity',
                  value: summaryMetrics.totalOpportunity || 0,
                  priority: 'medium'
                }]}
                stabilizedEbitda={summaryMetrics.stabilizedEbitda || currentFinancials.ebitda}
                height={300}
                showLabels={true}
                title={summaryMetrics.totalOpportunity > 0
                  ? 'EBITDA Bridge (Detailed breakdown unavailable)'
                  : 'Current EBITDA Overview'
                }
              />
            )}
            {(!Array.isArray(analysis?.opportunities) || analysis.opportunities.length === 0) && (
              <div className="mt-2 text-center text-muted small">
                <Info size={14} className="me-1" />
                Detailed opportunity breakdown requires complete expense ratio data.
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Opportunities Detail */}
      {!isLoading && Array.isArray(analysis?.opportunities) && analysis.opportunities.length > 0 && (
        <Card className="mt-4" style={{ opacity: isCalculating ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
          <Card.Header>
            <h5 className="mb-0">Opportunity Breakdown</h5>
          </Card.Header>
          <Card.Body>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-end">Current</th>
                  <th className="text-end">Target</th>
                  <th className="text-end">Annual Opportunity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {analysis.opportunities.map((opp, idx) => (
                  <tr key={idx}>
                    <td><strong>{opp.category}</strong></td>
                    <td className="text-end">
                      {opp.unit === '$' ? formatCurrency(opp.current) : formatPercent(opp.current)}
                    </td>
                    <td className="text-end">
                      {opp.unit === '$' ? formatCurrency(opp.target) : formatPercent(opp.target)}
                    </td>
                    <td className="text-end">
                      <strong className="text-success">{formatCurrency(opp.opportunity)}</strong>
                    </td>
                    <td className="text-muted">{opp.description}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Save Scenario Modal */}
      <Modal show={showSaveModal} onHide={() => setShowSaveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Save Pro Forma Scenario</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Scenario Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              placeholder="e.g., Conservative Case, Aggressive Turnaround"
              autoFocus
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Notes (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={scenarioNotes}
              onChange={(e) => setScenarioNotes(e.target.value)}
              placeholder="Assumptions, rationale, or comments about this scenario..."
            />
          </Form.Group>

          {/* Summary of what will be saved */}
          <div className="bg-light rounded p-3 small">
            <strong className="d-block mb-2">Scenario Summary:</strong>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">Stabilized EBITDA:</span>
              <span className="text-success fw-bold">{formatCurrency(analysis?.stabilized_ebitda)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">Total Opportunity:</span>
              <span className="text-success fw-bold">{formatCurrency(summaryMetrics.totalOpportunity)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Benchmark Overrides:</span>
              <span>{Object.keys(benchmarks).filter(k => benchmarks[k] !== DEFAULT_BENCHMARKS[k]).length} changes</span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowSaveModal(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveScenario} disabled={isSaving || !newScenarioName.trim()}>
            {isSaving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="me-2" />
                Save Scenario
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={!!deleteConfirmId} onHide={() => setDeleteConfirmId(null)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title>Delete Scenario</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this scenario? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => handleDeleteScenario(deleteConfirmId)}>
            <Trash2 size={16} className="me-1" />
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal show={showResetConfirm} onHide={() => setShowResetConfirm(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title>Reset to Defaults</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Reset all benchmarks to Cascadia defaults? Unsaved changes will be lost.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowResetConfirm(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={handleResetDefaults}>
            <RotateCcw size={16} className="me-1" />
            Reset to Defaults
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProFormaTab;
