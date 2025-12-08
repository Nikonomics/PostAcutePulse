/**
 * Extraction Reconciliation Service
 * Merges results from parallel extractions
 * Handles overlapping data from multiple documents
 * Calculates TTM and summary values
 */

const {
  normalizeToCanonical,
  normalizeMonthlyTrends,
  LEGACY_TO_CANONICAL,
  MONTHLY_TREND_FIELD_MAPPINGS
} = require('../schemas/extraction-schema');

/**
 * Merge multiple financial records for the same month
 * Combines data from different documents (e.g., P&L + revenue breakdown)
 */
function mergeFinancialRecords(records) {
  if (records.length === 1) return records[0];

  // Start with the most complete record as base
  const scored = records.map(r => ({
    record: r,
    score: scoreFinancialCompleteness(r)
  }));
  scored.sort((a, b) => b.score - a.score);

  const merged = { ...scored[0].record };

  // Fields to merge from other records
  const mergeFields = [
    'total_revenue', 'medicaid_revenue', 'medicare_revenue', 'private_pay_revenue', 'other_revenue',
    'total_expenses', 'operating_expenses', 'depreciation', 'amortization', 'interest_expense',
    'rent_expense', 'property_taxes', 'property_insurance', 'net_income', 'ebit', 'ebitda', 'ebitdar'
  ];

  // Merge data from all records
  for (const { record } of scored.slice(1)) {
    for (const field of mergeFields) {
      if ((merged[field] === null || merged[field] === undefined)
          && record[field] !== null && record[field] !== undefined) {
        merged[field] = record[field];
      }
    }
  }

  // Track sources
  const sources = [...new Set(records.map(r => r.source_document).filter(Boolean))];
  if (sources.length > 1) {
    merged.source_document = sources.join(', ');
    merged.merged_from_documents = sources;
  }

  return merged;
}


/**
 * Reconcile monthly financial data from multiple sources
 * IMPORTANT: Merges data from multiple documents for the same month
 * @param {Array} monthlyFinancials - Array of monthly financial records
 * @returns {Object} Reconciled monthly data and TTM summary
 */
function reconcileFinancials(monthlyFinancials) {
  if (!monthlyFinancials || !Array.isArray(monthlyFinancials)) {
    return { monthly: [], ttm: null };
  }

  // Group by month
  const byMonth = {};

  for (const record of monthlyFinancials) {
    const month = record.month;
    if (!month) continue;

    if (!byMonth[month]) {
      byMonth[month] = [];
    }
    byMonth[month].push(record);
  }

  // For each month, MERGE all records to combine data from different documents
  const reconciled = [];

  for (const month of Object.keys(byMonth).sort()) {
    const records = byMonth[month];
    // Merge all records for this month
    const merged = mergeFinancialRecords(records);
    reconciled.push(merged);
  }

  // Sort by month
  reconciled.sort((a, b) => a.month.localeCompare(b.month));

  // Calculate TTM from most recent 12 months
  const ttm = calculateTTM(reconciled);

  return {
    monthly: reconciled,
    ttm
  };
}


/**
 * Score financial record completeness
 */
function scoreFinancialCompleteness(record) {
  let score = 0;
  const fields = [
    'total_revenue', 'medicaid_revenue', 'medicare_revenue', 'private_pay_revenue',
    'total_expenses', 'operating_expenses', 'depreciation', 'interest_expense',
    'rent_expense', 'net_income', 'ebitda', 'ebitdar'
  ];

  for (const field of fields) {
    if (record[field] !== null && record[field] !== undefined) {
      score++;
    }
  }

  return score;
}


/**
 * Calculate TTM summary from monthly data
 */
function calculateTTM(monthlyData) {
  if (!monthlyData || monthlyData.length === 0) {
    return null;
  }

  // Get most recent 12 months
  const sorted = [...monthlyData].sort((a, b) => b.month.localeCompare(a.month));
  const recent12 = sorted.slice(0, 12);

  if (recent12.length === 0) {
    return null;
  }

  // Sum up the values
  const ttm = {
    period_start: recent12[recent12.length - 1].month,
    period_end: recent12[0].month,
    months_included: recent12.length,
    total_revenue: sumField(recent12, 'total_revenue'),
    medicaid_revenue: sumField(recent12, 'medicaid_revenue'),
    medicare_revenue: sumField(recent12, 'medicare_revenue'),
    private_pay_revenue: sumField(recent12, 'private_pay_revenue'),
    other_revenue: sumField(recent12, 'other_revenue'),
    total_expenses: sumField(recent12, 'total_expenses'),
    operating_expenses: sumField(recent12, 'operating_expenses'),
    depreciation: sumField(recent12, 'depreciation'),
    amortization: sumField(recent12, 'amortization'),
    interest_expense: sumField(recent12, 'interest_expense'),
    rent_expense: sumField(recent12, 'rent_expense'),
    property_taxes: sumField(recent12, 'property_taxes'),
    property_insurance: sumField(recent12, 'property_insurance'),
    net_income: sumField(recent12, 'net_income'),
    ebit: null,
    ebitda: null,
    ebitdar: null
  };

  // Calculate EBIT/EBITDA/EBITDAR if we have the components
  if (ttm.net_income !== null) {
    if (ttm.interest_expense !== null) {
      ttm.ebit = ttm.net_income + (ttm.interest_expense || 0);
    }
    if (ttm.ebit !== null && ttm.depreciation !== null) {
      ttm.ebitda = ttm.ebit + (ttm.depreciation || 0) + (ttm.amortization || 0);
    }
    if (ttm.ebitda !== null && ttm.rent_expense !== null) {
      ttm.ebitdar = ttm.ebitda + (ttm.rent_expense || 0);
    }
  }

  return ttm;
}


/**
 * Sum a field across records, returning null if all null
 */
function sumField(records, field) {
  let sum = 0;
  let hasValue = false;

  for (const record of records) {
    if (record[field] !== null && record[field] !== undefined) {
      sum += record[field];
      hasValue = true;
    }
  }

  return hasValue ? sum : null;
}


/**
 * Get the number of days in a month from a YYYY-MM string
 * Handles leap years correctly
 */
function getDaysInMonth(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return 30; // Default fallback

  const parts = monthStr.split('-');
  if (parts.length < 2) return 30;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(year) || isNaN(month)) return 30;

  // JavaScript Date trick: day 0 of next month = last day of current month
  return new Date(year, month, 0).getDate();
}


/**
 * Merge multiple census records for the same month
 * Combines data from different documents (e.g., payer type reports + occupancy reports)
 * For conflicts, prefers non-null values and higher values for counts
 */
function mergeCensusRecords(records) {
  if (records.length === 1) return records[0];

  // Start with the most complete record as base
  const scored = records.map(r => ({
    record: r,
    score: scoreCensusCompleteness(r)
  }));
  scored.sort((a, b) => b.score - a.score);

  const merged = { ...scored[0].record };

  // Fields to merge from other records
  const mergeFields = [
    'total_beds', 'average_daily_census', 'occupancy_percentage',
    'total_census_days', 'medicaid_days', 'medicare_days', 'private_pay_days', 'other_payer_days',
    'medicaid_percentage', 'medicare_percentage', 'private_pay_percentage', 'other_percentage',
    'admissions', 'discharges'
  ];

  // Merge data from all records
  for (const { record } of scored.slice(1)) {
    for (const field of mergeFields) {
      // If merged doesn't have value but this record does, use it
      if ((merged[field] === null || merged[field] === undefined)
          && record[field] !== null && record[field] !== undefined) {
        merged[field] = record[field];
      }
    }
  }

  // Track sources for debugging
  const sources = [...new Set(records.map(r => r.source_document).filter(Boolean))];
  if (sources.length > 1) {
    merged.source_document = sources.join(', ');
    merged.merged_from_documents = sources;
  }

  return merged;
}


/**
 * Reconcile monthly census data
 * IMPORTANT: Merges data from multiple documents for the same month
 * @param {Array} monthlyCensus - Array of census records
 * @param {number} facilityBedCount - Bed count from facility extraction (fallback for occupancy calc)
 */
function reconcileCensus(monthlyCensus, facilityBedCount = null) {
  if (!monthlyCensus || !Array.isArray(monthlyCensus)) {
    return { monthly: [], summary: null };
  }

  console.log(`[Reconciler] Processing ${monthlyCensus.length} census records from extraction`);

  // Group by month
  const byMonth = {};

  for (const record of monthlyCensus) {
    const month = record.month;
    if (!month) continue;

    if (!byMonth[month]) {
      byMonth[month] = [];
    }
    byMonth[month].push(record);
  }

  // Log which months have data from multiple documents
  const multiDocMonths = Object.entries(byMonth).filter(([_, records]) => records.length > 1);
  if (multiDocMonths.length > 0) {
    console.log(`[Reconciler] Merging data for ${multiDocMonths.length} months with multiple sources:`);
    for (const [month, records] of multiDocMonths) {
      const sources = records.map(r => r.source_document || 'unknown').join(', ');
      console.log(`  - ${month}: ${records.length} records from [${sources}]`);
    }
  }

  // For each month, MERGE all records to combine data from different documents
  const reconciled = [];

  for (const month of Object.keys(byMonth).sort()) {
    const records = byMonth[month];
    // Merge all records for this month (handles both single and multiple records)
    const merged = mergeCensusRecords(records);
    reconciled.push(merged);
  }

  console.log(`[Reconciler] Reconciled to ${reconciled.length} unique months`);

  // Sort by month
  reconciled.sort((a, b) => a.month.localeCompare(b.month));

  // Post-process: Calculate missing ADC from total_census_days
  // This is critical for payer mix reports that have census days but not ADC
  for (const record of reconciled) {
    // If we have total_census_days but no ADC, calculate it
    if ((record.average_daily_census === null || record.average_daily_census === undefined)
        && record.total_census_days !== null && record.total_census_days !== undefined
        && record.total_census_days > 0) {
      const daysInMonth = getDaysInMonth(record.month);
      if (daysInMonth > 0) {
        record.average_daily_census = Math.round((record.total_census_days / daysInMonth) * 10) / 10;
        console.log(`[Reconciler] Calculated ADC ${record.average_daily_census} from ${record.total_census_days} census days for ${record.month}`);
      }
    }

    // If we have payer days but no total_census_days, calculate total from components
    if ((record.total_census_days === null || record.total_census_days === undefined)
        && (record.medicaid_days || record.medicare_days || record.private_pay_days || record.other_payer_days)) {
      record.total_census_days = (record.medicaid_days || 0) + (record.medicare_days || 0)
                                + (record.private_pay_days || 0) + (record.other_payer_days || 0);

      // Now calculate ADC if still missing
      if ((record.average_daily_census === null || record.average_daily_census === undefined)
          && record.total_census_days > 0) {
        const daysInMonth = getDaysInMonth(record.month);
        if (daysInMonth > 0) {
          record.average_daily_census = Math.round((record.total_census_days / daysInMonth) * 10) / 10;
          console.log(`[Reconciler] Calculated ADC ${record.average_daily_census} from payer days total ${record.total_census_days} for ${record.month}`);
        }
      }
    }
  }

  // Post-process: Calculate missing occupancy_percentage
  // Also handle cases where AI confused census and occupancy values
  // PRIORITY: 1) from census records, 2) from facility extraction
  let detectedBedCount = null;
  for (const record of reconciled) {
    if (record.total_beds && record.total_beds > 0) {
      detectedBedCount = record.total_beds;
      break;
    }
  }
  // Fallback to facility bed count if no census records have beds
  if (!detectedBedCount && facilityBedCount && facilityBedCount > 0) {
    detectedBedCount = facilityBedCount;
    console.log(`[Reconciler] Using facility bed count ${detectedBedCount} for occupancy calculation`);
  }

  // Backfill total_beds in all records for consistency
  if (detectedBedCount) {
    for (const record of reconciled) {
      if (!record.total_beds) {
        record.total_beds = detectedBedCount;
      }
    }
  }

  for (const record of reconciled) {
    // If occupancy_percentage is missing but we have census and beds, calculate it
    if ((record.occupancy_percentage === null || record.occupancy_percentage === undefined)
        && record.average_daily_census !== null && record.average_daily_census !== undefined) {
      const beds = record.total_beds || detectedBedCount;
      if (beds && beds > 0) {
        record.occupancy_percentage = Math.round((record.average_daily_census / beds) * 10000) / 100;
      }
    }

    // Heuristic: If average_daily_census looks like a percentage and occupancy_percentage is null,
    // the AI likely put occupancy in the wrong field
    // ONLY apply this heuristic in very specific cases to avoid losing valid census data
    if ((record.occupancy_percentage === null || record.occupancy_percentage === undefined)
        && record.average_daily_census !== null
        && record.average_daily_census > 0 && record.average_daily_census <= 100) {
      const beds = record.total_beds || detectedBedCount;

      // Case 1: If beds are known and census > beds, it's definitely a percentage
      if (beds && record.average_daily_census > beds) {
        record.occupancy_percentage = record.average_daily_census;
        record.average_daily_census = null;
      }
      // Case 2: ONLY swap if we have strong evidence it's a percentage:
      // - Value has a decimal that looks like XX.X% (e.g., 92.5)
      // - AND there are NO census days fields populated (which would indicate this is real census data)
      else if (!beds
               && record.average_daily_census >= 80 && record.average_daily_census <= 100
               && String(record.average_daily_census).includes('.')
               && !record.total_census_days && !record.medicaid_days && !record.private_pay_days) {
        record.occupancy_percentage = record.average_daily_census;
        record.average_daily_census = null;
      }
      // Otherwise, PRESERVE the average_daily_census value even if bed count is unknown
      // It's more likely to be valid census data than a misplaced percentage
    }
  }

  // Calculate summary
  const summary = calculateCensusSummary(reconciled);

  return {
    monthly: reconciled,
    summary
  };
}


/**
 * Score census record completeness
 */
function scoreCensusCompleteness(record) {
  let score = 0;
  const fields = [
    'total_beds', 'average_daily_census', 'occupancy_percentage',
    'total_census_days', 'medicaid_days', 'medicare_days', 'private_pay_days',
    'medicaid_percentage', 'medicare_percentage', 'private_pay_percentage'
  ];

  for (const field of fields) {
    if (record[field] !== null && record[field] !== undefined) {
      score++;
    }
  }

  return score;
}


/**
 * Calculate census summary from monthly data
 */
function calculateCensusSummary(monthlyData) {
  if (!monthlyData || monthlyData.length === 0) {
    return null;
  }

  // Get most recent 12 months
  const sorted = [...monthlyData].sort((a, b) => b.month.localeCompare(a.month));
  const recent12 = sorted.slice(0, 12);

  // Calculate averages
  const avgOccupancy = averageField(recent12, 'occupancy_percentage');
  const avgCensus = averageField(recent12, 'average_daily_census');

  // Sum census days for payer mix calculation
  const totalDays = sumField(recent12, 'total_census_days');
  const medicaidDays = sumField(recent12, 'medicaid_days');
  const medicareDays = sumField(recent12, 'medicare_days');
  const privateDays = sumField(recent12, 'private_pay_days');

  // Calculate payer mix (rounded to 2 decimal places)
  let medicaidPct = null, medicarePct = null, privatePct = null;
  if (totalDays && totalDays > 0) {
    medicaidPct = medicaidDays ? Math.round((medicaidDays / totalDays) * 10000) / 100 : null;
    medicarePct = medicareDays ? Math.round((medicareDays / totalDays) * 10000) / 100 : null;
    privatePct = privateDays ? Math.round((privateDays / totalDays) * 10000) / 100 : null;
  }

  return {
    period_start: recent12[recent12.length - 1].month,
    period_end: recent12[0].month,
    months_included: recent12.length,
    bed_count: recent12[0].total_beds,
    average_occupancy: avgOccupancy,
    average_daily_census: avgCensus,
    total_census_days: totalDays,
    medicaid_days: medicaidDays,
    medicare_days: medicareDays,
    private_pay_days: privateDays,
    medicaid_percentage: medicaidPct,
    medicare_percentage: medicarePct,
    private_pay_percentage: privatePct
  };
}


/**
 * Average a field across records
 */
function averageField(records, field) {
  let sum = 0;
  let count = 0;

  for (const record of records) {
    if (record[field] !== null && record[field] !== undefined) {
      sum += record[field];
      count++;
    }
  }

  return count > 0 ? sum / count : null;
}


/**
 * Reconcile expense data by department and month
 * Handles both old structure (monthly_expenses array) and new structure (department_totals object)
 */
function reconcileExpenses(expensesData) {
  // Handle new structure with department_totals from AI extraction
  if (expensesData && typeof expensesData === 'object' && !Array.isArray(expensesData)) {
    const departmentTotals = expensesData.department_totals || {};
    const laborSummary = expensesData.labor_summary || {};
    const monthlyExpenses = expensesData.monthly_expenses || [];

    // Process monthly expenses if available
    const monthlyResult = reconcileMonthlyExpenses(monthlyExpenses);

    return {
      monthly: monthlyResult.monthly,
      byDepartment: monthlyResult.byDepartment,
      ttmTotals: monthlyResult.ttmTotals,
      // New structure: direct department totals from AI
      departmentTotals: departmentTotals,
      laborSummary: laborSummary
    };
  }

  // Handle old structure (just an array of monthly expenses)
  if (!expensesData || !Array.isArray(expensesData)) {
    return { monthly: [], byDepartment: {}, ttmTotals: null, departmentTotals: {}, laborSummary: {} };
  }

  return reconcileMonthlyExpenses(expensesData);
}

/**
 * Helper to reconcile monthly expense records
 */
function reconcileMonthlyExpenses(monthlyExpenses) {
  if (!monthlyExpenses || !Array.isArray(monthlyExpenses) || monthlyExpenses.length === 0) {
    return { monthly: [], byDepartment: {}, ttmTotals: null };
  }

  // Group by month + department
  const byMonthDept = {};

  for (const record of monthlyExpenses) {
    const key = `${record.month}|${record.department}`;
    if (!byMonthDept[key]) {
      byMonthDept[key] = [];
    }
    byMonthDept[key].push(record);
  }

  // Log which months have data from multiple documents
  const multiDocKeys = Object.entries(byMonthDept).filter(([_, records]) => records.length > 1);
  if (multiDocKeys.length > 0) {
    console.log(`[Reconciler] Merging expense data for ${multiDocKeys.length} month+department combinations with multiple sources:`);
    for (const [key, records] of multiDocKeys) {
      const sources = records.map(r => r.source_document || 'unknown').join(', ');
      console.log(`  - ${key}: ${records.length} records from [${sources}]`);
    }
  }

  // Reconcile - MERGE records for each month+department (not just pick best)
  const reconciled = [];

  for (const key of Object.keys(byMonthDept)) {
    const records = byMonthDept[key];
    // Use mergeExpenseRecords to combine data from multiple documents
    const merged = mergeExpenseRecords(records);
    reconciled.push(merged);
  }

  // Group by department for analysis
  const byDepartment = {};
  for (const record of reconciled) {
    if (!byDepartment[record.department]) {
      byDepartment[record.department] = [];
    }
    byDepartment[record.department].push(record);
  }

  // Calculate TTM totals by department
  const ttmTotals = calculateExpenseTTM(reconciled);

  return {
    monthly: reconciled,
    byDepartment,
    ttmTotals
  };
}


/**
 * Score expense record completeness
 */
function scoreExpenseCompleteness(record) {
  let score = 0;
  const fields = [
    'salaries_wages', 'benefits', 'payroll_taxes', 'agency_labor',
    'supplies', 'total_department_expense'
  ];

  for (const field of fields) {
    if (record[field] !== null && record[field] !== undefined) {
      score++;
    }
  }

  return score;
}


/**
 * Merge multiple expense records for the same month+department
 * Combines data from different documents (e.g., detailed expense report + P&L)
 * For conflicts, prefers non-null values
 */
function mergeExpenseRecords(records) {
  if (records.length === 1) return records[0];

  // Start with the most complete record as base
  const scored = records.map(r => ({
    record: r,
    score: scoreExpenseCompleteness(r)
  }));
  scored.sort((a, b) => b.score - a.score);

  const merged = { ...scored[0].record };

  // Fields to merge from other records
  const mergeFields = [
    'salaries_wages', 'benefits', 'payroll_taxes', 'agency_labor',
    'supplies', 'contract_services', 'other_expenses', 'total_department_expense',
    'fte_count', 'hours_worked', 'overtime_hours', 'overtime_cost'
  ];

  // Merge data from all records
  for (const { record } of scored.slice(1)) {
    for (const field of mergeFields) {
      // If merged doesn't have value but this record does, use it
      if ((merged[field] === null || merged[field] === undefined)
          && record[field] !== null && record[field] !== undefined) {
        merged[field] = record[field];
      }
    }
  }

  // Track sources for debugging
  const sources = [...new Set(records.map(r => r.source_document).filter(Boolean))];
  if (sources.length > 1) {
    merged.source_document = sources.join(', ');
    merged.merged_from_documents = sources;
  }

  return merged;
}


/**
 * Calculate TTM expense totals by department
 */
function calculateExpenseTTM(monthlyExpenses) {
  if (!monthlyExpenses || monthlyExpenses.length === 0) {
    return null;
  }

  // Get all unique months and sort
  const months = [...new Set(monthlyExpenses.map(r => r.month))].sort().reverse();
  const recent12Months = months.slice(0, 12);

  // Filter to recent 12 months
  const filtered = monthlyExpenses.filter(r => recent12Months.includes(r.month));

  // Sum by department
  const byDepartment = {};
  let totalLabor = 0;
  let totalAgency = 0;
  let totalExpenses = 0;

  for (const record of filtered) {
    const dept = record.department;
    if (!byDepartment[dept]) {
      byDepartment[dept] = {
        salaries_wages: 0,
        benefits: 0,
        agency_labor: 0,
        supplies: 0,
        total: 0
      };
    }

    byDepartment[dept].salaries_wages += record.salaries_wages || 0;
    byDepartment[dept].benefits += record.benefits || 0;
    byDepartment[dept].agency_labor += record.agency_labor || 0;
    byDepartment[dept].supplies += record.supplies || 0;
    byDepartment[dept].total += record.total_department_expense || 0;

    totalLabor += (record.salaries_wages || 0) + (record.benefits || 0) + (record.agency_labor || 0);
    totalAgency += record.agency_labor || 0;
    totalExpenses += record.total_department_expense || 0;
  }

  return {
    period_start: recent12Months[recent12Months.length - 1],
    period_end: recent12Months[0],
    months_included: recent12Months.length,
    by_department: byDepartment,
    total_labor: totalLabor,
    total_agency: totalAgency,
    total_expenses: totalExpenses
  };
}


/**
 * Reconcile rate schedules - keep all unique rates
 */
function reconcileRates(ratesData) {
  if (!ratesData) {
    return { private_pay: [], medicaid: [], medicare: [] };
  }

  return {
    private_pay: ratesData.private_pay_rates || [],
    medicaid: ratesData.medicaid_rates || [],
    medicare: ratesData.medicare_rates || [],
    summary: ratesData.summary || {}
  };
}


/**
 * Main reconciliation function - combines all parallel extraction results
 */
function reconcileExtractionResults(parallelResults) {
  // Extract facility bed count to pass to census reconciliation
  // Note: parallel extraction returns {value, confidence, source} objects, so extract .value
  const facilityBedCount = parallelResults.facility?.bed_count?.value || null;

  const reconciled = {
    facility: parallelResults.facility || {},
    financials: reconcileFinancials(parallelResults.financials?.monthly_financials),
    // Pass entire expenses object to preserve department_totals and labor_summary
    expenses: reconcileExpenses(parallelResults.expenses),
    // Pass facility bed count to calculate occupancy when census records lack total_beds
    census: reconcileCensus(parallelResults.census?.monthly_census, facilityBedCount),
    rates: reconcileRates(parallelResults.rates),
    // Stage 1 Deal Overview & Screening Analysis (6th parallel extraction)
    overview: parallelResults.overview || null,
    metadata: {
      extraction_errors: parallelResults.errors || [],
      extraction_duration: parallelResults.metadata?.totalDuration,
      success_count: parallelResults.metadata?.successCount,
      failure_count: parallelResults.metadata?.failureCount
    }
  };

  // Build flat summary for backward compatibility with deals table
  reconciled.summary = buildFlatSummary(reconciled);

  return reconciled;
}


/**
 * Build flat summary data for deals table
 * Uses CANONICAL field names from extraction-schema.js
 * CRITICAL: Calculates expense ratios needed for Pro Forma tab
 */
function buildFlatSummary(reconciled) {
  const facility = reconciled.facility || {};
  const ttm = reconciled.financials?.ttm || {};
  const censusSummary = reconciled.census?.summary || {};
  const monthlyCensus = reconciled.census?.monthly || [];
  const monthlyFinancials = reconciled.financials?.monthly || [];
  const expenses = reconciled.expenses || {};
  const departmentTotals = expenses.departmentTotals || {};
  const laborSummary = expenses.laborSummary || {};

  // Build source and confidence maps from facility data
  const { sourceMap, confidenceMap } = buildMetadataMaps(facility);

  // Add financial field sources from monthly financials (TTM period data comes from these documents)
  if (monthlyFinancials.length > 0) {
    // Get the document sources that contribute to TTM
    const financialSources = [...new Set(monthlyFinancials.map(m => m.source_document).filter(Boolean))];
    const financialSource = financialSources.length > 0 ? financialSources.join(', ') : null;

    const financialFields = [
      'annual_revenue', 'total_expenses', 'net_income', 'ebit', 'ebitda', 'ebitdar',
      'depreciation', 'interest_expense', 'rent_lease_expense',
      'medicaid_revenue', 'medicare_revenue', 'private_pay_revenue'
    ];

    for (const field of financialFields) {
      if (financialSource) {
        sourceMap[field] = financialSource;
        confidenceMap[field] = 'calculated'; // TTM values are calculated from monthly data
      }
    }
  }

  // Add census field sources
  if (monthlyCensus.length > 0) {
    const censusSources = [...new Set(monthlyCensus.map(m => m.source_document).filter(Boolean))];
    const censusSource = censusSources.length > 0 ? censusSources.join(', ') : null;

    const censusFields = [
      'average_daily_census', 'occupancy_pct', 'medicaid_pct', 'medicare_pct', 'private_pay_pct'
    ];

    for (const field of censusFields) {
      if (censusSource) {
        sourceMap[field] = censusSource;
        confidenceMap[field] = 'calculated';
      }
    }
  }

  // Helper to get department total
  const getDeptTotal = (dept) => {
    const d = departmentTotals[dept];
    return d?.department_total || null;
  };

  // Get revenue for ratio calculations
  const annualRevenue = ttm.total_revenue || null;

  // Calculate total labor cost from department totals if not directly available
  let totalLaborCost = laborSummary.total_labor_cost || null;
  if (!totalLaborCost && Object.keys(departmentTotals).length > 0) {
    totalLaborCost = 0;
    for (const dept of Object.values(departmentTotals)) {
      if (dept.total_salaries_wages) totalLaborCost += dept.total_salaries_wages;
      if (dept.total_benefits) totalLaborCost += dept.total_benefits;
      if (dept.total_agency_labor) totalLaborCost += dept.total_agency_labor;
    }
    if (totalLaborCost === 0) totalLaborCost = null;
  }

  // Get agency cost
  const agencyLaborCost = laborSummary.total_agency_cost || null;

  // Get specific expense categories from department totals or labor summary
  const rawFoodCost = laborSummary.raw_food_cost
    || departmentTotals.culinary?.raw_food_cost
    || null;
  const utilitiesTotal = laborSummary.utilities_total
    || departmentTotals.maintenance?.utilities_total
    || null;
  const insuranceTotal = laborSummary.insurance_total
    || departmentTotals.general?.insurance_total
    || null;
  const managementFees = laborSummary.management_fees
    || departmentTotals.administration?.management_fees
    || null;

  // CALCULATE EXPENSE RATIOS for Pro Forma tab
  // These are the key fields the frontend reads
  let labor_pct_of_revenue = null;
  let agency_pct_of_labor = null;
  let utilities_pct_of_revenue = null;
  let insurance_pct_of_revenue = null;
  let management_fee_pct = null;
  let food_cost_per_resident_day = null;

  if (annualRevenue && annualRevenue > 0) {
    if (totalLaborCost) {
      labor_pct_of_revenue = Math.round((totalLaborCost / annualRevenue) * 10000) / 100;
      console.log(`[Reconciler] Calculated labor_pct_of_revenue: ${labor_pct_of_revenue}%`);
    }
    if (utilitiesTotal) {
      utilities_pct_of_revenue = Math.round((utilitiesTotal / annualRevenue) * 10000) / 100;
    }
    if (insuranceTotal) {
      insurance_pct_of_revenue = Math.round((insuranceTotal / annualRevenue) * 10000) / 100;
    }
    if (managementFees) {
      management_fee_pct = Math.round((managementFees / annualRevenue) * 10000) / 100;
    }
  }

  if (totalLaborCost && totalLaborCost > 0 && agencyLaborCost) {
    agency_pct_of_labor = Math.round((agencyLaborCost / totalLaborCost) * 10000) / 100;
    console.log(`[Reconciler] Calculated agency_pct_of_labor: ${agency_pct_of_labor}%`);
  }

  // Calculate food cost per resident day
  // Food cost per day = raw_food_cost / (ADC * 365)
  const adc = censusSummary.average_daily_census || null;
  if (rawFoodCost && adc && adc > 0) {
    const annualResidentDays = adc * 365;
    food_cost_per_resident_day = Math.round((rawFoodCost / annualResidentDays) * 100) / 100;
    console.log(`[Reconciler] Calculated food_cost_per_resident_day: $${food_cost_per_resident_day}`);
  }

  // Build monthly_trends array with CANONICAL field names
  // This is the key fix for the empty Occupancy Trend chart
  const monthly_trends = monthlyCensus.map(record => ({
    month: record.month,
    total_beds: record.total_beds || null,
    average_daily_census: record.average_daily_census || null,
    // CANONICAL: Use _pct suffix, NOT _percentage
    occupancy_pct: record.occupancy_percentage || record.occupancy_pct || null,
    medicaid_pct: record.medicaid_percentage || record.medicaid_pct || null,
    medicare_pct: record.medicare_percentage || record.medicare_pct || null,
    private_pay_pct: record.private_pay_percentage || record.private_pay_pct || null,
    // Include raw day counts
    medicaid_days: record.medicaid_days || null,
    medicare_days: record.medicare_days || null,
    private_pay_days: record.private_pay_days || null,
    total_patient_days: record.total_census_days || null
  }));

  return {
    // Facility info - using CANONICAL names
    facility_name: getValue(facility.facility_name),
    facility_type: getValue(facility.facility_type),
    street_address: getValue(facility.street_address),
    city: getValue(facility.city),
    state: getValue(facility.state),
    zip_code: getValue(facility.zip_code),
    bed_count: getValue(facility.bed_count),  // CANONICAL: bed_count (not no_of_beds)
    primary_contact_name: getValue(facility.contact_name),
    contact_title: getValue(facility.contact_title),  // CANONICAL: contact_title (not title)
    contact_phone: getValue(facility.contact_phone),  // CANONICAL: contact_phone (not phone_number)
    contact_email: getValue(facility.contact_email),  // CANONICAL: contact_email (not email)
    deal_name: getValue(facility.deal_name),
    purchase_price: getValue(facility.purchase_price),

    // Financial TTM
    annual_revenue: annualRevenue,
    total_expenses: ttm.total_expenses,
    net_income: ttm.net_income,
    ebit: ttm.ebit,
    ebitda: ttm.ebitda,
    ebitdar: ttm.ebitdar,
    depreciation: ttm.depreciation,
    interest_expense: ttm.interest_expense,
    rent_lease_expense: ttm.rent_expense,  // CANONICAL: rent_lease_expense
    financial_period_start: ttm.period_start,
    financial_period_end: ttm.period_end,

    // Revenue by payer
    medicaid_revenue: ttm.medicaid_revenue,
    medicare_revenue: ttm.medicare_revenue,
    private_pay_revenue: ttm.private_pay_revenue,

    // Census - using CANONICAL names (_pct suffix)
    average_daily_census: censusSummary.average_daily_census,
    occupancy_pct: censusSummary.average_occupancy,  // CANONICAL: occupancy_pct
    medicaid_pct: censusSummary.medicaid_percentage || censusSummary.medicaid_pct,  // CANONICAL
    medicare_pct: censusSummary.medicare_percentage || censusSummary.medicare_pct,  // CANONICAL
    private_pay_pct: censusSummary.private_pay_percentage || censusSummary.private_pay_pct,  // CANONICAL

    // Monthly trends array for charts - with CANONICAL field names
    monthly_trends: monthly_trends.length > 0 ? monthly_trends : null,

    // Department expense totals (for ProForma)
    total_direct_care: getDeptTotal('direct_care'),
    total_activities: getDeptTotal('activities'),
    total_culinary: getDeptTotal('culinary'),
    total_housekeeping: getDeptTotal('housekeeping'),
    total_maintenance: getDeptTotal('maintenance'),
    total_administration: getDeptTotal('administration'),
    total_general: getDeptTotal('general'),
    total_property: getDeptTotal('property'),

    // Labor summary (for ProForma ratios)
    total_labor_cost: totalLaborCost,
    agency_labor_cost: agencyLaborCost,  // CANONICAL: agency_labor_cost
    raw_food_cost: rawFoodCost,
    utilities_total: utilitiesTotal,
    insurance_total: insuranceTotal,
    management_fees: managementFees,

    // EXPENSE RATIOS for Pro Forma tab (CRITICAL for opportunity calculations)
    labor_pct_of_revenue: labor_pct_of_revenue,
    agency_pct_of_labor: agency_pct_of_labor,
    food_cost_per_resident_day: food_cost_per_resident_day,
    management_fee_pct: management_fee_pct,
    utilities_pct_of_revenue: utilities_pct_of_revenue,
    insurance_pct_of_revenue: insurance_pct_of_revenue,

    // Full department breakdown for detailed analysis
    department_totals: Object.keys(departmentTotals).length > 0 ? departmentTotals : null,

    // DEAL OVERVIEW (Stage 1 Screening Analysis from 6th parallel extraction)
    // This is the full JSON object from the OVERVIEW_PROMPT extraction
    deal_overview: reconciled.overview || null,

    // SOURCE AND CONFIDENCE METADATA MAPS
    // These allow the frontend to display citations for each field
    // Format: { fieldName: "document | location | snippet" }
    _sourceMap: Object.keys(sourceMap).length > 0 ? sourceMap : null,
    _confidenceMap: Object.keys(confidenceMap).length > 0 ? confidenceMap : null
  };
}


/**
 * Helper to get value from confidence structure
 */
function getValue(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && 'value' in obj) return obj.value;
  return obj;
}

/**
 * Helper to get source from confidence structure
 */
function getSource(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && 'source' in obj) return obj.source;
  return null;
}

/**
 * Helper to get confidence from confidence structure
 */
function getConfidence(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && 'confidence' in obj) return obj.confidence;
  return null;
}

/**
 * Build source and confidence maps from facility data
 * These maps allow the frontend to display citations for each field
 */
function buildMetadataMaps(facility) {
  const sourceMap = {};
  const confidenceMap = {};

  // List of facility fields that have {value, confidence, source} structure
  const facilityFieldMappings = {
    'facility_name': 'facility_name',
    'facility_type': 'facility_type',
    'street_address': 'street_address',
    'city': 'city',
    'state': 'state',
    'zip_code': 'zip_code',
    'bed_count': 'bed_count',
    'contact_name': 'primary_contact_name',
    'contact_title': 'contact_title',
    'contact_phone': 'contact_phone',
    'contact_email': 'contact_email',
    'deal_name': 'deal_name',
    'purchase_price': 'purchase_price'
  };

  for (const [aiField, canonicalField] of Object.entries(facilityFieldMappings)) {
    const fieldData = facility[aiField];
    const source = getSource(fieldData);
    const confidence = getConfidence(fieldData);

    if (source) {
      sourceMap[canonicalField] = source;
    }
    if (confidence) {
      confidenceMap[canonicalField] = confidence;
    }
  }

  return { sourceMap, confidenceMap };
}


module.exports = {
  reconcileExtractionResults,
  reconcileFinancials,
  reconcileCensus,
  reconcileExpenses,
  reconcileRates,
  calculateTTM,
  buildFlatSummary
};
