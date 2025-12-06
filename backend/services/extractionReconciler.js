/**
 * Extraction Reconciliation Service
 * Merges results from parallel extractions
 * Handles overlapping data from multiple documents
 * Calculates TTM and summary values
 */

/**
 * Reconcile monthly financial data from multiple sources
 * For overlapping months, prefer the more recent document
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

  // For each month, pick the best record (prefer most complete data)
  const reconciled = [];

  for (const month of Object.keys(byMonth).sort()) {
    const records = byMonth[month];

    if (records.length === 1) {
      reconciled.push(records[0]);
    } else {
      // Score each record by completeness
      const scored = records.map(r => ({
        record: r,
        score: scoreFinancialCompleteness(r)
      }));

      scored.sort((a, b) => b.score - a.score);
      reconciled.push(scored[0].record);
    }
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
 * Reconcile monthly census data
 */
function reconcileCensus(monthlyCensus) {
  if (!monthlyCensus || !Array.isArray(monthlyCensus)) {
    return { monthly: [], summary: null };
  }

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

  // For each month, pick the best record
  const reconciled = [];

  for (const month of Object.keys(byMonth).sort()) {
    const records = byMonth[month];

    if (records.length === 1) {
      reconciled.push(records[0]);
    } else {
      // Score by completeness
      const scored = records.map(r => ({
        record: r,
        score: scoreCensusCompleteness(r)
      }));

      scored.sort((a, b) => b.score - a.score);
      reconciled.push(scored[0].record);
    }
  }

  // Sort by month
  reconciled.sort((a, b) => a.month.localeCompare(b.month));

  // Post-process: Calculate missing occupancy_percentage
  // Also handle cases where AI confused census and occupancy values
  let detectedBedCount = null;
  for (const record of reconciled) {
    if (record.total_beds && record.total_beds > 0) {
      detectedBedCount = record.total_beds;
      break;
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

    // Heuristic: If average_daily_census looks like a percentage (>100 or close to typical occupancy range 80-100)
    // and occupancy_percentage is null, the AI likely put occupancy in the wrong field
    if ((record.occupancy_percentage === null || record.occupancy_percentage === undefined)
        && record.average_daily_census !== null
        && record.average_daily_census > 0 && record.average_daily_census <= 100) {
      // Check if this looks more like a percentage than a census count
      // If beds are known and census > beds, it's likely a percentage
      const beds = record.total_beds || detectedBedCount;
      if (beds && record.average_daily_census > beds) {
        // This is likely occupancy percentage mistakenly in census field
        record.occupancy_percentage = record.average_daily_census;
        record.average_daily_census = null; // Clear the incorrect value
      }
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
 */
function reconcileExpenses(monthlyExpenses) {
  if (!monthlyExpenses || !Array.isArray(monthlyExpenses)) {
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

  // Reconcile - pick best record for each month+department
  const reconciled = [];

  for (const key of Object.keys(byMonthDept)) {
    const records = byMonthDept[key];
    if (records.length === 1) {
      reconciled.push(records[0]);
    } else {
      // Pick most complete
      const scored = records.map(r => ({
        record: r,
        score: scoreExpenseCompleteness(r)
      }));
      scored.sort((a, b) => b.score - a.score);
      reconciled.push(scored[0].record);
    }
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
  const reconciled = {
    facility: parallelResults.facility || {},
    financials: reconcileFinancials(parallelResults.financials?.monthly_financials),
    expenses: reconcileExpenses(parallelResults.expenses?.monthly_expenses),
    census: reconcileCensus(parallelResults.census?.monthly_census),
    rates: reconcileRates(parallelResults.rates),
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
 * Build flat summary data for deals table (backward compatibility)
 */
function buildFlatSummary(reconciled) {
  const facility = reconciled.facility || {};
  const ttm = reconciled.financials?.ttm || {};
  const censusSummary = reconciled.census?.summary || {};

  return {
    // Facility info
    facility_name: getValue(facility.facility_name),
    facility_type: getValue(facility.facility_type),
    street_address: getValue(facility.street_address),
    city: getValue(facility.city),
    state: getValue(facility.state),
    zip_code: getValue(facility.zip_code),
    no_of_beds: getValue(facility.bed_count),
    primary_contact_name: getValue(facility.contact_name),
    title: getValue(facility.contact_title),
    phone_number: getValue(facility.contact_phone),
    email: getValue(facility.contact_email),
    deal_name: getValue(facility.deal_name),
    purchase_price: getValue(facility.purchase_price),

    // Financial TTM
    annual_revenue: ttm.total_revenue,
    total_expenses: ttm.total_expenses,
    net_income: ttm.net_income,
    ebit: ttm.ebit,
    ebitda: ttm.ebitda,
    ebitdar: ttm.ebitdar,
    depreciation: ttm.depreciation,
    interest_expense: ttm.interest_expense,
    current_rent_lease_expense: ttm.rent_expense,
    financial_period_start: ttm.period_start,
    financial_period_end: ttm.period_end,

    // Revenue by payer
    medicaid_revenue: ttm.medicaid_revenue,
    medicare_revenue: ttm.medicare_revenue,
    private_pay_revenue: ttm.private_pay_revenue,

    // Census
    average_daily_census: censusSummary.average_daily_census,
    current_occupancy: censusSummary.average_occupancy,
    medicaid_percentage: censusSummary.medicaid_percentage,
    medicare_percentage: censusSummary.medicare_percentage,
    private_pay_percentage: censusSummary.private_pay_percentage
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


module.exports = {
  reconcileExtractionResults,
  reconcileFinancials,
  reconcileCensus,
  reconcileExpenses,
  reconcileRates,
  calculateTTM,
  buildFlatSummary
};
