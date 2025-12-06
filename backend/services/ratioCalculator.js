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

  const revenue = ttmFinancials.total_revenue || 0;
  const beds = getValue(facility.bed_count) || 0;
  const totalCensusDays = censusSummary.total_census_days || 0;
  const avgOccupancy = censusSummary.average_occupancy || 0;

  // Calculate resident days if not available
  const residentDays = totalCensusDays || (beds * 365 * (avgOccupancy / 100));

  const ratios = {
    period_end: ttmFinancials.period_end,

    // Labor ratios
    total_labor_cost: ttmExpenses.total_labor || null,
    labor_pct_of_revenue: safePercent(ttmExpenses.total_labor, revenue),
    nursing_labor_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.nursing?.total,
      revenue
    ),
    agency_labor_total: ttmExpenses.total_agency || null,
    agency_pct_of_labor: safePercent(ttmExpenses.total_agency, ttmExpenses.total_labor),
    agency_pct_of_direct_care: safePercent(
      ttmExpenses.by_department?.nursing?.agency_labor,
      ttmExpenses.by_department?.nursing?.total
    ),

    // Per resident day metrics
    labor_cost_per_resident_day: safeDivide(ttmExpenses.total_labor, residentDays),
    total_cost_per_resident_day: safeDivide(ttmFinancials.total_expenses, residentDays),

    // Food/Dietary
    food_cost_total: ttmExpenses.by_department?.dietary?.supplies || null,
    food_cost_per_resident_day: safeDivide(
      ttmExpenses.by_department?.dietary?.supplies,
      residentDays
    ),
    food_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.dietary?.supplies,
      revenue
    ),
    dietary_labor_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.dietary?.salaries_wages,
      revenue
    ),

    // Administrative
    admin_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.admin?.total,
      revenue
    ),
    management_fee_pct: null, // Would need specific line item
    bad_debt_pct: null, // Would need specific line item

    // Property/Facilities
    utilities_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.plant_operations?.utilities,
      revenue
    ),
    utilities_per_bed: safeDivide(
      ttmExpenses.by_department?.plant_operations?.utilities,
      beds * 12
    ),
    property_cost_per_bed: safeDivide(
      (ttmFinancials.property_taxes || 0) + (ttmFinancials.property_insurance || 0),
      beds
    ),
    maintenance_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.plant_operations?.repairs_maintenance,
      revenue
    ),

    // Insurance
    insurance_pct_of_revenue: safePercent(ttmFinancials.property_insurance, revenue),
    insurance_per_bed: safeDivide(ttmFinancials.property_insurance, beds * 12),

    // Housekeeping
    housekeeping_pct_of_revenue: safePercent(
      ttmExpenses.by_department?.housekeeping?.total,
      revenue
    ),

    // Revenue metrics
    revenue_per_bed: safeDivide(revenue, beds),
    revenue_per_resident_day: safeDivide(revenue, residentDays),

    // Profitability margins
    ebitdar_margin: safePercent(ttmFinancials.ebitdar, revenue),
    ebitda_margin: safePercent(ttmFinancials.ebitda, revenue),
    operating_margin: safePercent(ttmFinancials.net_income, revenue),

    // Occupancy
    occupancy: avgOccupancy
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
