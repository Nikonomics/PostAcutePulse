import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Table, Form, Row, Col, Badge, Button, Spinner, InputGroup, Alert, Modal, Dropdown } from 'react-bootstrap';
import { TrendingUp, TrendingDown, AlertTriangle, Save, RotateCcw, Plus, FileText, Info, FolderOpen, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { debounce } from 'lodash';
import {
  calculateProforma,
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
  management_fee_pct_target: 4,
  bad_debt_pct_target: 0.5,
  utilities_pct_target: 2.5,
  insurance_pct_target: 3,
  ebitda_margin_target: 9,
  ebitdar_margin_target: 23
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
  isEditable = false,
  isReversed = false,
  indent = 0,
  isBold = false,
  opportunity,
  isDisabled = false
}) => {
  const variance = actual && benchmark ? actual - benchmark : null;
  const varianceStatus = getVarianceStatus(actual, benchmark, isReversed);
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
              step={unit === '$' ? '0.01' : '0.1'}
              value={benchmark || ''}
              onChange={handleInputChange}
              className="text-end"
              disabled={inputDisabled}
              title={isActualMissing ? 'Actual value not available - benchmark editing disabled' : (isDisabled ? 'Calculation in progress...' : '')}
            />
            <InputGroup.Text className={inputDisabled ? 'text-muted' : ''}>{unit}</InputGroup.Text>
          </InputGroup>
        ) : (
          <span>
            {unit === '$' ? formatCurrency(benchmark) :
             unit === '%' ? formatPercent(benchmark) :
             formatNumber(benchmark)}
          </span>
        )}
      </td>
      <td className="text-end">
        {variance !== null ? (
          <span className={`variance variance-${varianceStatus}`}>
            {unit === '$' ? formatCurrency(variance) :
             unit === '%' ? formatPercent(variance) :
             formatNumber(variance)}
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

    // Get occupancy and beds
    const occupancy = getValue(census.occupancy_percentage)
      || extractionData.current_occupancy
      || extractionData.t12m_occupancy;
    const beds = getValue(facility.bed_count)
      || extractionData.no_of_beds;

    // Get expense ratios - try nested expense_ratios, then flat fields
    const expenseRatios = fin.expense_ratios || {};
    const labor_pct = getValue(expenseRatios.labor_pct_of_revenue)
      || extractionData.labor_pct_of_revenue;
    const agency_pct = getValue(expenseRatios.agency_pct_of_labor)
      || extractionData.agency_pct_of_labor;
    const food_cost = getValue(expenseRatios.food_cost_per_resident_day)
      || extractionData.food_cost_per_resident_day;
    const management_fee_pct = getValue(expenseRatios.management_fee_pct)
      || extractionData.management_fee_pct;
    const bad_debt_pct = getValue(expenseRatios.bad_debt_pct)
      || extractionData.bad_debt_pct;
    const utilities_pct = getValue(expenseRatios.utilities_pct_of_revenue)
      || extractionData.utilities_pct_of_revenue;
    const insurance_pct = getValue(expenseRatios.insurance_pct_of_revenue)
      || extractionData.insurance_pct_of_revenue;

    return {
      revenue,
      ebitda,
      ebitdar,
      occupancy,
      beds,

      // Expense ratios
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
        : null
    };
  }, [extractionData]);

  // Debounced calculation
  const calculateProforma = useCallback(
    debounce(async (benchmarkValues, isInitial = false) => {
      if (!deal?.id || !currentFinancials) return;

      // Use isLoading for initial load, isCalculating for recalculations
      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsCalculating(true);
      }
      setError(null);

      try {
        const result = await calculateProforma(deal.id, {
          ...benchmarkValues,
          current_financials: currentFinancials
        });
        setAnalysis(result);
      } catch (err) {
        console.error('Pro forma calculation error:', err);
        const message = getErrorMessage(err, 'Failed to calculate pro forma. Please try again.');
        setError(message);
        // Don't clear analysis - keep previous values for user reference
      } finally {
        if (isInitial) {
          setIsLoading(false);
        } else {
          setIsCalculating(false);
        }
      }
    }, 500),
    [deal?.id, currentFinancials]
  );

  // Track if this is the first calculation
  const isFirstCalculation = React.useRef(true);

  // Recalculate when benchmarks change
  useEffect(() => {
    if (currentFinancials) {
      calculateProforma(benchmarks, isFirstCalculation.current);
      isFirstCalculation.current = false;
    }
  }, [benchmarks, calculateProforma, currentFinancials]);

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

  // Check if expense ratio data is available
  const hasExpenseRatios = useMemo(() => {
    if (!currentFinancials) return false;
    const expenseFields = [
      currentFinancials.labor_pct,
      currentFinancials.agency_pct,
      currentFinancials.food_cost,
      currentFinancials.management_fee_pct,
      currentFinancials.bad_debt_pct,
      currentFinancials.utilities_pct,
      currentFinancials.insurance_pct
    ];
    // Count how many expense fields have values
    const populatedCount = expenseFields.filter(v => v !== null && v !== undefined).length;
    return populatedCount >= 2; // At least 2 expense metrics available
  }, [currentFinancials]);

  // Count missing expense metrics for the note
  const missingExpenseCount = useMemo(() => {
    if (!currentFinancials) return 7;
    const expenseFields = [
      currentFinancials.labor_pct,
      currentFinancials.agency_pct,
      currentFinancials.food_cost,
      currentFinancials.management_fee_pct,
      currentFinancials.bad_debt_pct,
      currentFinancials.utilities_pct,
      currentFinancials.insurance_pct
    ];
    return expenseFields.filter(v => v === null || v === undefined).length;
  }, [currentFinancials]);

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
            subtitle={`vs ${formatCurrency(currentFinancials.ebitda)} current`}
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
                benchmark={null}
                indent={1}
              />

              {/* Labor Section */}
              <SectionHeader title="Labor Costs" subtitle="Largest expense category" />
              <LineItemRow
                label="Total Labor Cost"
                actual={extractionData.total_labor_cost}
                actualPctOfRevenue={currentFinancials.labor_pct}
                benchmark={currentFinancials.revenue ? (currentFinancials.revenue * benchmarks.labor_pct_target / 100) : null}
                unit="$"
                isReversed={true}
                opportunity={analysis?.opportunities?.find(o => o.category === 'Labor Optimization')?.opportunity}
              />
              <LineItemRow
                label="Labor as % of Revenue"
                actual={currentFinancials.labor_pct}
                benchmark={benchmarks.labor_pct_target}
                benchmarkKey="labor_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                indent={1}
              />
              <LineItemRow
                label="Agency Staffing % of Labor"
                actual={currentFinancials.agency_pct}
                benchmark={benchmarks.agency_pct_of_labor_target}
                benchmarkKey="agency_pct_of_labor_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
                indent={1}
              />

              {/* Other Expenses Section */}
              <SectionHeader title="Other Operating Expenses" />
              <LineItemRow
                label="Food Cost per Resident Day"
                actual={currentFinancials.food_cost}
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
                actual={currentFinancials.utilities_pct}
                benchmark={benchmarks.utilities_pct_target}
                benchmarkKey="utilities_pct_target"
                onBenchmarkChange={handleBenchmarkChange}
                isEditable={true}
                isDisabled={isCalculating}
                isReversed={true}
              />
              <LineItemRow
                label="Insurance % of Revenue"
                actual={currentFinancials.insurance_pct}
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
