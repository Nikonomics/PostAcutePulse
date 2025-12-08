/**
 * Ratio Calculator Service
 * Calculates expense ratios and compares to industry benchmarks
 * Pure JavaScript - no AI needed, instant calculations
 */

/**
 * Industry Benchmarks for Skilled Nursing / Assisted Living
 * Based on typical industry performance metrics
 * "good" = top quartile, "average" = median, "poor" = bottom quartile
 */
const BENCHMARKS = {
  // Labor ratios
  labor_pct_of_revenue: {
    good: 42,
    average: 48,
    poor: 55,
    unit: '%',
    description: 'Total labor as percentage of revenue'
  },
  nursing_labor_pct_of_revenue: {
    good: 28,
    average: 32,
    poor: 38,
    unit: '%',
    description: 'Nursing/direct care labor as percentage of revenue'
  },
  agency_pct_of_labor: {
    good: 3,
    average: 8,
    poor: 15,
    unit: '%',
    description: 'Agency/contract labor as percentage of total labor'
  },
  agency_pct_of_direct_care: {
    good: 5,
    average: 12,
    poor: 20,
    unit: '%',
    description: 'Agency as percentage of direct care labor'
  },

  // Per resident day metrics
  labor_cost_per_resident_day: {
    good: 180,
    average: 220,
    poor: 280,
    unit: '$',
    description: 'Total labor cost per resident day'
  },
  total_cost_per_resident_day: {
    good: 280,
    average: 340,
    poor: 420,
    unit: '$',
    description: 'Total cost per resident day'
  },

  // Food/Dietary
  food_cost_per_resident_day: {
    good: 8,
    average: 11,
    poor: 15,
    unit: '$',
    description: 'Raw food cost per resident day'
  },
  food_pct_of_revenue: {
    good: 4,
    average: 5.5,
    poor: 7,
    unit: '%',
    description: 'Food cost as percentage of revenue'
  },
  dietary_labor_pct_of_revenue: {
    good: 4,
    average: 5.5,
    poor: 7,
    unit: '%',
    description: 'Dietary labor as percentage of revenue'
  },

  // Administrative
  admin_pct_of_revenue: {
    good: 8,
    average: 11,
    poor: 15,
    unit: '%',
    description: 'Administrative costs as percentage of revenue'
  },
  management_fee_pct: {
    good: 4,
    average: 5,
    poor: 7,
    unit: '%',
    description: 'Management fee as percentage of revenue'
  },
  bad_debt_pct: {
    good: 0.5,
    average: 1.5,
    poor: 3,
    unit: '%',
    description: 'Bad debt as percentage of revenue'
  },

  // Property/Facilities
  utilities_pct_of_revenue: {
    good: 2.5,
    average: 3.5,
    poor: 5,
    unit: '%',
    description: 'Utilities as percentage of revenue'
  },
  utilities_per_bed: {
    good: 150,
    average: 200,
    poor: 280,
    unit: '$/month',
    description: 'Monthly utilities cost per bed'
  },
  maintenance_pct_of_revenue: {
    good: 2,
    average: 3,
    poor: 4.5,
    unit: '%',
    description: 'Maintenance/repairs as percentage of revenue'
  },

  // Insurance
  insurance_pct_of_revenue: {
    good: 1.5,
    average: 2.5,
    poor: 4,
    unit: '%',
    description: 'Insurance as percentage of revenue'
  },
  insurance_per_bed: {
    good: 100,
    average: 150,
    poor: 250,
    unit: '$/month',
    description: 'Monthly insurance cost per bed'
  },

  // Housekeeping
  housekeeping_pct_of_revenue: {
    good: 2.5,
    average: 3.5,
    poor: 5,
    unit: '%',
    description: 'Housekeeping/laundry as percentage of revenue'
  },

  // Profitability
  ebitdar_margin: {
    good: 25,
    average: 18,
    poor: 10,
    unit: '%',
    description: 'EBITDAR margin (higher is better)'
  },
  ebitda_margin: {
    good: 20,
    average: 14,
    poor: 8,
    unit: '%',
    description: 'EBITDA margin (higher is better)'
  },
  operating_margin: {
    good: 12,
    average: 6,
    poor: 0,
    unit: '%',
    description: 'Operating margin (higher is better)'
  },

  // Occupancy
  occupancy: {
    good: 92,
    average: 85,
    poor: 75,
    unit: '%',
    description: 'Occupancy rate (higher is better)'
  }
};


/**
 * Calculate all expense ratios from reconciled data
 * @param {Object} reconciledData - Output from extractionReconciler
 * @returns {Object} Calculated ratios
 */
function calculateRatios(reconciledData) {
  const ttmFinancials = reconciledData.financials?.ttm || {};
  const ttmExpenses = reconciledData.expenses?.ttmTotals || {};
  const censusSummary = reconciledData.census?.summary || {};
  const facility = reconciledData.facility || {};

  // New department totals structure from AI extraction
  const departmentTotals = reconciledData.expenses?.departmentTotals || {};
  const laborSummary = reconciledData.expenses?.laborSummary || {};

  const revenue = ttmFinancials.total_revenue || 0;
  const beds = getValue(facility.bed_count) || 0;
  const totalCensusDays = censusSummary.total_census_days || 0;
  const avgOccupancy = censusSummary.average_occupancy || 0;

  // Calculate resident days if not available
  const residentDays = totalCensusDays || (beds * 365 * (avgOccupancy / 100));

  // Map between new department names and old ttmExpenses.by_department keys
  // ttmExpenses may use either old naming (nursing, dietary) or new naming (direct_care, culinary)
  const oldKeyMapping = {
    direct_care: 'nursing',
    activities: 'activities',
    culinary: 'dietary',
    housekeeping: 'housekeeping',
    maintenance: 'plant_operations',
    administration: 'admin',
    general: 'general',
    property: 'property'
  };

  // Helper to get department total from new structure, with fallback to TTM expenses
  const getDeptTotal = (dept) => {
    // First try departmentTotals from AI extraction
    if (departmentTotals[dept]?.department_total) {
      return departmentTotals[dept].department_total;
    }
    // Fallback to ttmExpenses.by_department (may use new or old naming)
    const byDept = ttmExpenses.by_department;
    if (byDept) {
      // Try new name first (direct_care, culinary, etc.)
      if (byDept[dept]?.total) {
        console.log(`[RatioCalculator] Using TTM fallback for ${dept}: ${byDept[dept].total}`);
        return byDept[dept].total;
      }
      // Try old name mapping (nursing, dietary, etc.)
      const oldKey = oldKeyMapping[dept];
      if (oldKey && byDept[oldKey]?.total) {
        console.log(`[RatioCalculator] Using TTM fallback (old key) for ${dept}: ${byDept[oldKey].total}`);
        return byDept[oldKey].total;
      }
    }
    return null;
  };

  const getDeptLabor = (dept) => {
    const d = departmentTotals[dept];
    if (d && (d.total_salaries_wages || d.total_benefits || d.total_agency_labor)) {
      return (d.total_salaries_wages || 0) + (d.total_benefits || 0) + (d.total_agency_labor || 0);
    }
    // Fallback to ttmExpenses (try new name, then old name)
    const byDept = ttmExpenses.by_department;
    if (byDept) {
      // Try new name first
      if (byDept[dept]) {
        const deptData = byDept[dept];
        return (deptData.salaries_wages || 0) + (deptData.benefits || 0) + (deptData.agency_labor || 0);
      }
      // Try old name mapping
      const oldKey = oldKeyMapping[dept];
      if (oldKey && byDept[oldKey]) {
        const deptData = byDept[oldKey];
        return (deptData.salaries_wages || 0) + (deptData.benefits || 0) + (deptData.agency_labor || 0);
      }
    }
    return null;
  };

  // Use new laborSummary if available, otherwise fall back to old structure
  const totalLaborCost = laborSummary.total_labor_cost || ttmExpenses.total_labor || null;
  const totalAgencyCost = laborSummary.total_agency_cost || ttmExpenses.total_agency || null;
  const rawFoodCost = laborSummary.raw_food_cost || ttmExpenses.by_department?.dietary?.supplies || null;

  // Direct care total (nursing labor)
  const directCareTotal = getDeptTotal('direct_care') || ttmExpenses.by_department?.nursing?.total || null;
  const directCareAgency = departmentTotals.direct_care?.total_agency_labor || ttmExpenses.by_department?.nursing?.agency_labor || null;

  const ratios = {
    period_end: ttmFinancials.period_end,

    // Labor ratios (calculated from raw dollar amounts)
    total_labor_cost: totalLaborCost,
    labor_pct_of_revenue: safePercent(totalLaborCost, revenue),
    nursing_labor_pct_of_revenue: safePercent(directCareTotal, revenue),
    agency_labor_total: totalAgencyCost,
    agency_pct_of_labor: safePercent(totalAgencyCost, totalLaborCost),
    agency_pct_of_direct_care: safePercent(directCareAgency, directCareTotal),

    // Per resident day metrics
    labor_cost_per_resident_day: safeDivide(totalLaborCost, residentDays),
    total_cost_per_resident_day: safeDivide(ttmFinancials.total_expenses, residentDays),

    // Food/Dietary (culinary department)
    food_cost_total: rawFoodCost,
    food_cost_per_resident_day: safeDivide(rawFoodCost, residentDays),
    food_pct_of_revenue: safePercent(rawFoodCost, revenue),
    dietary_labor_pct_of_revenue: safePercent(getDeptLabor('culinary'), revenue),
    culinary_pct_of_revenue: safePercent(getDeptTotal('culinary'), revenue),

    // Administrative
    admin_pct_of_revenue: safePercent(
      getDeptTotal('administration') || ttmExpenses.by_department?.admin?.total,
      revenue
    ),
    general_pct_of_revenue: safePercent(getDeptTotal('general'), revenue),
    management_fee_pct: null, // Would need specific line item
    bad_debt_pct: null, // Would need specific line item

    // Property/Facilities (maintenance department)
    maintenance_pct_of_revenue: safePercent(getDeptTotal('maintenance'), revenue),
    utilities_pct_of_revenue: safePercent(
      departmentTotals.maintenance?.total_other || ttmExpenses.by_department?.plant_operations?.utilities,
      revenue
    ),
    utilities_per_bed: safeDivide(
      departmentTotals.maintenance?.total_other || ttmExpenses.by_department?.plant_operations?.utilities,
      beds * 12
    ),
    property_pct_of_revenue: safePercent(getDeptTotal('property'), revenue),
    property_cost_per_bed: safeDivide(getDeptTotal('property'), beds),

    // Insurance
    insurance_pct_of_revenue: safePercent(ttmFinancials.property_insurance, revenue),
    insurance_per_bed: safeDivide(ttmFinancials.property_insurance, beds * 12),

    // Housekeeping
    housekeeping_pct_of_revenue: safePercent(
      getDeptTotal('housekeeping') || ttmExpenses.by_department?.housekeeping?.total,
      revenue
    ),

    // Activities
    activities_pct_of_revenue: safePercent(getDeptTotal('activities'), revenue),

    // Direct Care
    direct_care_pct_of_revenue: safePercent(directCareTotal, revenue),

    // Revenue metrics
    revenue_per_bed: safeDivide(revenue, beds),
    revenue_per_resident_day: safeDivide(revenue, residentDays),

    // Profitability margins
    ebitdar_margin: safePercent(ttmFinancials.ebitdar, revenue),
    ebitda_margin: safePercent(ttmFinancials.ebitda, revenue),
    operating_margin: safePercent(ttmFinancials.net_income, revenue),

    // Occupancy
    occupancy: avgOccupancy,

    // Department expense totals (raw dollar amounts for ProForma)
    total_direct_care: directCareTotal,
    total_activities: getDeptTotal('activities'),
    total_culinary: getDeptTotal('culinary'),
    total_housekeeping: getDeptTotal('housekeeping'),
    total_maintenance: getDeptTotal('maintenance'),
    total_administration: getDeptTotal('administration'),
    total_general: getDeptTotal('general'),
    total_property: getDeptTotal('property')
  };

  return ratios;
}


/**
 * Compare ratios to benchmarks and flag issues
 * @param {Object} ratios - Calculated ratios
 * @returns {Object} Benchmark comparison with flags
 */
function compareToBenchmarks(ratios) {
  const flags = {};
  const opportunities = {};

  for (const [metric, value] of Object.entries(ratios)) {
    if (value === null || value === undefined) continue;
    if (!BENCHMARKS[metric]) continue;

    const benchmark = BENCHMARKS[metric];
    let flag = 'normal';

    // For most metrics, lower is better
    // For profitability and occupancy, higher is better
    const higherIsBetter = ['ebitdar_margin', 'ebitda_margin', 'operating_margin', 'occupancy'];

    if (higherIsBetter.includes(metric)) {
      if (value >= benchmark.good) {
        flag = 'excellent';
      } else if (value >= benchmark.average) {
        flag = 'good';
      } else if (value >= benchmark.poor) {
        flag = 'below_average';
      } else {
        flag = 'critical';
      }
    } else {
      // Lower is better
      if (value <= benchmark.good) {
        flag = 'excellent';
      } else if (value <= benchmark.average) {
        flag = 'good';
      } else if (value <= benchmark.poor) {
        flag = 'below_average';
      } else {
        flag = 'critical';
      }
    }

    flags[metric] = {
      value,
      flag,
      benchmark: benchmark,
      variance_from_good: value - benchmark.good,
      variance_pct: safePercent(value - benchmark.good, benchmark.good)
    };

    // Calculate potential savings for poor performers
    if (flag === 'below_average' || flag === 'critical') {
      const targetValue = benchmark.average;
      const improvement = value - targetValue;

      if (metric.endsWith('_pct_of_revenue') && ratios.revenue_per_bed) {
        // Estimate dollar savings
        const totalRevenue = ratios.revenue_per_bed * (ratios.beds || 100);
        opportunities[metric] = {
          current: value,
          target: targetValue,
          improvement_pct: improvement,
          estimated_annual_savings: Math.round(totalRevenue * (improvement / 100)),
          description: benchmark.description
        };
      }
    }
  }

  return { flags, opportunities };
}


/**
 * Generate summary insights from ratio analysis
 */
function generateInsights(ratios, benchmarkResults) {
  const insights = [];
  const { flags, opportunities } = benchmarkResults;

  // Find critical issues
  const criticalMetrics = Object.entries(flags)
    .filter(([_, data]) => data.flag === 'critical')
    .map(([metric, data]) => ({
      metric,
      ...data
    }));

  if (criticalMetrics.length > 0) {
    insights.push({
      type: 'critical',
      title: 'Critical Issues Identified',
      items: criticalMetrics.map(m => ({
        metric: m.metric,
        message: `${m.benchmark.description}: ${m.value.toFixed(1)}${m.benchmark.unit} vs ${m.benchmark.average}${m.benchmark.unit} benchmark`,
        severity: 'high'
      }))
    });
  }

  // Find opportunities
  const topOpportunities = Object.entries(opportunities)
    .sort((a, b) => (b[1].estimated_annual_savings || 0) - (a[1].estimated_annual_savings || 0))
    .slice(0, 5);

  if (topOpportunities.length > 0) {
    insights.push({
      type: 'opportunity',
      title: 'Top Improvement Opportunities',
      items: topOpportunities.map(([metric, data]) => ({
        metric,
        message: `Reduce ${data.description} from ${data.current.toFixed(1)}% to ${data.target.toFixed(1)}%`,
        potential_savings: data.estimated_annual_savings,
        severity: 'medium'
      }))
    });
  }

  // Highlight strengths
  const excellentMetrics = Object.entries(flags)
    .filter(([_, data]) => data.flag === 'excellent')
    .map(([metric, data]) => metric);

  if (excellentMetrics.length > 0) {
    insights.push({
      type: 'strength',
      title: 'Areas of Excellence',
      items: excellentMetrics.map(metric => ({
        metric,
        message: `${BENCHMARKS[metric]?.description || metric} is performing above industry best practices`,
        severity: 'positive'
      }))
    });
  }

  return insights;
}


/**
 * Full ratio analysis - calculate, compare, and generate insights
 */
function analyzeRatios(reconciledData) {
  const ratios = calculateRatios(reconciledData);
  const benchmarkResults = compareToBenchmarks(ratios);
  const insights = generateInsights(ratios, benchmarkResults);

  return {
    ratios,
    benchmark_flags: benchmarkResults.flags,
    potential_savings: benchmarkResults.opportunities,
    insights,
    calculated_at: new Date().toISOString()
  };
}


// Helper functions
function getValue(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && 'value' in obj) return obj.value;
  return obj;
}

function safeDivide(numerator, denominator) {
  if (!numerator || !denominator || denominator === 0) return null;
  return numerator / denominator;
}

function safePercent(part, whole) {
  if (!part || !whole || whole === 0) return null;
  return (part / whole) * 100;
}


module.exports = {
  calculateRatios,
  compareToBenchmarks,
  generateInsights,
  analyzeRatios,
  BENCHMARKS
};
