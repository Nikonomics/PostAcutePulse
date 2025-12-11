/**
 * Pro Forma Calculation Service
 *
 * Calculates stabilized metrics and improvement opportunities by comparing
 * actual deal performance against target benchmarks.
 *
 * @module services/proformaService
 */

const { extractExpenseRatios, extractRawExpenses, NORMALIZATION_TARGETS } = require('./normalizationService');

// Default benchmarks (used when user has no saved configuration)
const DEFAULT_BENCHMARKS = {
  // Operational
  occupancy_target: 85,
  private_pay_mix_target: 35,
  revenue_per_occupied_bed_target: 115,  // $ per day

  // Expense targets (as percentages)
  labor_pct_target: 55,
  agency_pct_of_labor_target: 2,
  food_cost_per_day_target: 10.50,
  management_fee_pct_target: 4,
  bad_debt_pct_target: 0.5,
  utilities_pct_target: 2.5,
  insurance_pct_target: 1.5,

  // Department expense targets (% of revenue)
  direct_care_pct_target: 28,
  activities_pct_target: 1.5,
  culinary_pct_target: 8,
  housekeeping_pct_target: 4,
  maintenance_pct_target: 3,
  administration_pct_target: 6,
  general_pct_target: 5,
  property_pct_target: 8,

  // Margin targets
  ebitda_margin_target: 9,
  ebitdar_margin_target: 23,

  // Stabilization timing
  stabilization_months: 18,
};

// Priority thresholds for opportunities (% of revenue)
const PRIORITY_THRESHOLDS = {
  high: 2,      // > 2% of revenue = high priority
  medium: 0.5,  // 0.5-2% = medium
  // < 0.5% = low
};

/**
 * Convert benchmark config from database format (decimals) to percentage format
 * @param {Object} config - Benchmark configuration from database
 * @returns {Object} Benchmarks in percentage format
 */
function normalizeBenchmarkConfig(config) {
  if (!config) return { ...DEFAULT_BENCHMARKS };

  // Convert decimal values to percentages where needed
  return {
    occupancy_target: (config.occupancy_target || 0.85) * 100,
    private_pay_mix_target: (config.private_pay_mix_target || 0.35) * 100,
    revenue_per_occupied_bed_target: config.revenue_per_occupied_bed_target || 115,
    labor_pct_target: (config.labor_pct_target || 0.55) * 100,
    agency_pct_of_labor_target: (config.agency_pct_of_labor_target || 0.02) * 100,
    food_cost_per_day_target: config.food_cost_per_day_target || 10.50,
    management_fee_pct_target: (config.management_fee_pct_target || 0.04) * 100,
    bad_debt_pct_target: (config.bad_debt_pct_target || 0.005) * 100,
    utilities_pct_target: (config.utilities_pct_target || 0.025) * 100,
    insurance_pct_target: (config.insurance_pct_target || 0.015) * 100,
    ebitda_margin_target: (config.ebitda_margin_target || 0.09) * 100,
    ebitdar_margin_target: (config.ebitdar_margin_target || 0.23) * 100,
    // Department expense targets (already stored as percentages in frontend)
    direct_care_pct_target: config.direct_care_pct_target || 28,
    activities_pct_target: config.activities_pct_target || 1.5,
    culinary_pct_target: config.culinary_pct_target || 8,
    housekeeping_pct_target: config.housekeeping_pct_target || 4,
    maintenance_pct_target: config.maintenance_pct_target || 3,
    administration_pct_target: config.administration_pct_target || 6,
    general_pct_target: config.general_pct_target || 5,
    property_pct_target: config.property_pct_target || 8,
    stabilization_months: config.stabilization_months || 18,
  };
}

/**
 * Extract actual metrics from deal data
 * @param {Object} deal - Deal object with extraction_data
 * @returns {Object} Actual metrics
 */
function extractActuals(deal) {
  const extractionData = deal.extraction_data || {};
  const expenseRatios = extractExpenseRatios(deal);
  const rawExpenses = extractRawExpenses(deal);

  // Get primary financial metrics
  const revenue = parseFloat(deal.annual_revenue) ||
                  parseFloat(extractionData.t12m_revenue) || 0;
  const ebitda = parseFloat(deal.ebitda) ||
                 parseFloat(extractionData.t12m_ebitda) || 0;
  const ebitdar = parseFloat(extractionData.t12m_ebitdar) ||
                  parseFloat(extractionData.ebitdar) || 0;
  const occupancy = parseFloat(deal.current_occupancy) ||
                    parseFloat(extractionData.occupancy_pct) ||  // Canonical field from reconciler
                    parseFloat(extractionData.current_occupancy) ||
                    parseFloat(extractionData.occupancy) || 0;
  const beds = parseInt(deal.bed_count) ||
               parseInt(extractionData.bed_count) || 0;
  const purchasePrice = parseFloat(deal.purchase_price) || 0;

  // Calculate EBITDA margin if not directly available
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : null;
  const ebitdarMargin = revenue > 0 ? (ebitdar / revenue) * 100 : null;

  // Payer mix
  const privatePayPct = parseFloat(deal.private_pay_percentage) ||
                        parseFloat(extractionData.private_pay_pct) ||  // Canonical field from reconciler
                        parseFloat(extractionData.private_pay_percentage) || null;

  // Calculate census days for food cost calculation
  const censusDays = beds * (occupancy / 100) * 365;

  // Department expense totals (from extraction data)
  const totalDirectCare = parseFloat(extractionData.total_direct_care) || null;
  const totalActivities = parseFloat(extractionData.total_activities) || null;
  const totalCulinary = parseFloat(extractionData.total_culinary) || null;
  const totalHousekeeping = parseFloat(extractionData.total_housekeeping) || null;
  const totalMaintenance = parseFloat(extractionData.total_maintenance) || null;
  const totalAdministration = parseFloat(extractionData.total_administration) || null;
  const totalGeneral = parseFloat(extractionData.total_general) || null;
  const totalProperty = parseFloat(extractionData.total_property) || null;

  // Calculate department expense percentages of revenue
  const directCarePct = revenue > 0 && totalDirectCare ? (totalDirectCare / revenue) * 100 : null;
  const activitiesPct = revenue > 0 && totalActivities ? (totalActivities / revenue) * 100 : null;
  const culinaryPct = revenue > 0 && totalCulinary ? (totalCulinary / revenue) * 100 : null;
  const housekeepingPct = revenue > 0 && totalHousekeeping ? (totalHousekeeping / revenue) * 100 : null;
  const maintenancePct = revenue > 0 && totalMaintenance ? (totalMaintenance / revenue) * 100 : null;
  const administrationPct = revenue > 0 && totalAdministration ? (totalAdministration / revenue) * 100 : null;
  const generalPct = revenue > 0 && totalGeneral ? (totalGeneral / revenue) * 100 : null;
  const propertyPct = revenue > 0 && totalProperty ? (totalProperty / revenue) * 100 : null;

  return {
    revenue,
    ebitda,
    ebitdar,
    occupancy,
    beds,
    purchase_price: purchasePrice,
    ebitda_margin: ebitdaMargin,
    ebitdar_margin: ebitdarMargin,
    private_pay_pct: privatePayPct,
    census_days: censusDays,

    // Expense ratios (already as percentages)
    labor_pct: expenseRatios.labor_pct,
    agency_pct: expenseRatios.agency_pct,
    food_cost_per_day: expenseRatios.food_cost_per_day,
    management_fee_pct: expenseRatios.management_fee_pct,
    bad_debt_pct: expenseRatios.bad_debt_pct,
    utilities_pct: expenseRatios.utilities_pct,

    // Department expense percentages (of revenue)
    direct_care_pct: directCarePct,
    activities_pct: activitiesPct,
    culinary_pct: culinaryPct,
    housekeeping_pct: housekeepingPct,
    maintenance_pct: maintenancePct,
    administration_pct: administrationPct,
    general_pct: generalPct,
    property_pct: propertyPct,

    // Raw expense amounts for calculating dollar opportunities
    raw_expenses: {
      total_labor: expenseRatios.total_labor_cost,
      agency_staffing: rawExpenses.agency_staffing,
      raw_food_cost: rawExpenses.raw_food_cost,
      management_fees: rawExpenses.management_fees,
      bad_debt: rawExpenses.bad_debt,
      utilities_total: rawExpenses.utilities_total,
      // Department totals
      total_direct_care: totalDirectCare,
      total_activities: totalActivities,
      total_culinary: totalCulinary,
      total_housekeeping: totalHousekeeping,
      total_maintenance: totalMaintenance,
      total_administration: totalAdministration,
      total_general: totalGeneral,
      total_property: totalProperty,
    },
  };
}

/**
 * Calculate variance between actual and target
 * @param {number} actual - Actual value
 * @param {number} target - Target value
 * @returns {number|null} Variance (positive = above target, negative = below)
 */
function calculateVariance(actual, target) {
  if (actual === null || target === null) return null;
  return parseFloat((actual - target).toFixed(2));
}

/**
 * Determine priority based on opportunity size relative to revenue
 * @param {number} opportunityValue - Dollar value of opportunity
 * @param {number} revenue - Annual revenue
 * @returns {string} 'high' | 'medium' | 'low'
 */
function getPriority(opportunityValue, revenue) {
  if (!revenue || revenue <= 0) return 'low';
  const pctOfRevenue = (opportunityValue / revenue) * 100;

  if (pctOfRevenue >= PRIORITY_THRESHOLDS.high) return 'high';
  if (pctOfRevenue >= PRIORITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Calculate pro forma metrics comparing actuals to benchmarks
 * @param {Object} deal - Deal object with extraction_data
 * @param {Object} benchmarks - Target benchmarks (in percentage format)
 * @param {Object} overrides - Optional benchmark overrides
 * @returns {Object} Pro forma calculation results
 */
function calculateProforma(deal, benchmarks = null, overrides = {}) {
  // Use provided benchmarks or defaults
  const targets = { ...(benchmarks || DEFAULT_BENCHMARKS), ...overrides };

  // Extract actual metrics from deal
  const actuals = extractActuals(deal);

  // Calculate variances for each metric
  const variances = {
    occupancy: calculateVariance(actuals.occupancy, targets.occupancy_target),
    private_pay_pct: calculateVariance(actuals.private_pay_pct, targets.private_pay_mix_target),
    labor_pct: calculateVariance(actuals.labor_pct, targets.labor_pct_target),
    agency_pct: calculateVariance(actuals.agency_pct, targets.agency_pct_of_labor_target),
    food_cost_per_day: calculateVariance(actuals.food_cost_per_day, targets.food_cost_per_day_target),
    management_fee_pct: calculateVariance(actuals.management_fee_pct, targets.management_fee_pct_target),
    bad_debt_pct: calculateVariance(actuals.bad_debt_pct, targets.bad_debt_pct_target),
    utilities_pct: calculateVariance(actuals.utilities_pct, targets.utilities_pct_target),
    ebitda_margin: calculateVariance(actuals.ebitda_margin, targets.ebitda_margin_target),
    ebitdar_margin: calculateVariance(actuals.ebitdar_margin, targets.ebitdar_margin_target),
    // Department expense variances
    direct_care_pct: calculateVariance(actuals.direct_care_pct, targets.direct_care_pct_target),
    activities_pct: calculateVariance(actuals.activities_pct, targets.activities_pct_target),
    culinary_pct: calculateVariance(actuals.culinary_pct, targets.culinary_pct_target),
    housekeeping_pct: calculateVariance(actuals.housekeeping_pct, targets.housekeeping_pct_target),
    maintenance_pct: calculateVariance(actuals.maintenance_pct, targets.maintenance_pct_target),
    administration_pct: calculateVariance(actuals.administration_pct, targets.administration_pct_target),
    general_pct: calculateVariance(actuals.general_pct, targets.general_pct_target),
    property_pct: calculateVariance(actuals.property_pct, targets.property_pct_target),
  };

  // Calculate opportunities (only for positive variances - i.e., above-target expenses)
  const opportunities = [];
  let totalOpportunity = 0;

  // Labor opportunity
  if (variances.labor_pct !== null && variances.labor_pct > 0 && actuals.revenue > 0) {
    const laborOpportunity = (variances.labor_pct / 100) * actuals.revenue;
    opportunities.push({
      category: 'labor',
      label: 'Labor Efficiency',
      description: `Reduce labor from ${actuals.labor_pct?.toFixed(1)}% to ${targets.labor_pct_target}% of revenue`,
      actual_pct: actuals.labor_pct,
      target_pct: targets.labor_pct_target,
      variance_pct: variances.labor_pct,
      value: Math.round(laborOpportunity),
      priority: getPriority(laborOpportunity, actuals.revenue),
    });
    totalOpportunity += laborOpportunity;
  }

  // Agency opportunity
  if (variances.agency_pct !== null && variances.agency_pct > 0 && actuals.raw_expenses.total_labor > 0) {
    const agencyOpportunity = (variances.agency_pct / 100) * actuals.raw_expenses.total_labor;
    opportunities.push({
      category: 'agency',
      label: 'Agency Staffing',
      description: `Reduce agency from ${actuals.agency_pct?.toFixed(1)}% to ${targets.agency_pct_of_labor_target}% of labor`,
      actual_pct: actuals.agency_pct,
      target_pct: targets.agency_pct_of_labor_target,
      variance_pct: variances.agency_pct,
      value: Math.round(agencyOpportunity),
      priority: getPriority(agencyOpportunity, actuals.revenue),
    });
    totalOpportunity += agencyOpportunity;
  }

  // Food cost opportunity
  if (variances.food_cost_per_day !== null && variances.food_cost_per_day > 0 && actuals.census_days > 0) {
    const foodOpportunity = variances.food_cost_per_day * actuals.census_days;
    opportunities.push({
      category: 'food',
      label: 'Food Costs',
      description: `Reduce food cost from $${actuals.food_cost_per_day?.toFixed(2)}/day to $${targets.food_cost_per_day_target}/day`,
      actual_value: actuals.food_cost_per_day,
      target_value: targets.food_cost_per_day_target,
      variance_value: variances.food_cost_per_day,
      value: Math.round(foodOpportunity),
      priority: getPriority(foodOpportunity, actuals.revenue),
    });
    totalOpportunity += foodOpportunity;
  }

  // Management fee opportunity
  if (variances.management_fee_pct !== null && variances.management_fee_pct > 0 && actuals.revenue > 0) {
    const mgmtOpportunity = (variances.management_fee_pct / 100) * actuals.revenue;
    opportunities.push({
      category: 'management_fee',
      label: 'Management Fee',
      description: `Reduce management fee from ${actuals.management_fee_pct?.toFixed(1)}% to ${targets.management_fee_pct_target}% of revenue`,
      actual_pct: actuals.management_fee_pct,
      target_pct: targets.management_fee_pct_target,
      variance_pct: variances.management_fee_pct,
      value: Math.round(mgmtOpportunity),
      priority: getPriority(mgmtOpportunity, actuals.revenue),
    });
    totalOpportunity += mgmtOpportunity;
  }

  // Bad debt opportunity
  if (variances.bad_debt_pct !== null && variances.bad_debt_pct > 0 && actuals.revenue > 0) {
    const badDebtOpportunity = (variances.bad_debt_pct / 100) * actuals.revenue;
    opportunities.push({
      category: 'bad_debt',
      label: 'Bad Debt',
      description: `Reduce bad debt from ${actuals.bad_debt_pct?.toFixed(1)}% to ${targets.bad_debt_pct_target}% of revenue`,
      actual_pct: actuals.bad_debt_pct,
      target_pct: targets.bad_debt_pct_target,
      variance_pct: variances.bad_debt_pct,
      value: Math.round(badDebtOpportunity),
      priority: getPriority(badDebtOpportunity, actuals.revenue),
    });
    totalOpportunity += badDebtOpportunity;
  }

  // Utilities opportunity
  if (variances.utilities_pct !== null && variances.utilities_pct > 0 && actuals.revenue > 0) {
    const utilitiesOpportunity = (variances.utilities_pct / 100) * actuals.revenue;
    opportunities.push({
      category: 'utilities',
      label: 'Utilities',
      description: `Reduce utilities from ${actuals.utilities_pct?.toFixed(1)}% to ${targets.utilities_pct_target}% of revenue`,
      actual_pct: actuals.utilities_pct,
      target_pct: targets.utilities_pct_target,
      variance_pct: variances.utilities_pct,
      value: Math.round(utilitiesOpportunity),
      priority: getPriority(utilitiesOpportunity, actuals.revenue),
    });
    totalOpportunity += utilitiesOpportunity;
  }

  // Department expense opportunities
  const deptExpenseCategories = [
    { key: 'direct_care_pct', label: 'Direct Care (Nursing)', targetKey: 'direct_care_pct_target' },
    { key: 'activities_pct', label: 'Activities', targetKey: 'activities_pct_target' },
    { key: 'culinary_pct', label: 'Culinary (Dietary)', targetKey: 'culinary_pct_target' },
    { key: 'housekeeping_pct', label: 'Housekeeping/Laundry', targetKey: 'housekeeping_pct_target' },
    { key: 'maintenance_pct', label: 'Maintenance', targetKey: 'maintenance_pct_target' },
    { key: 'administration_pct', label: 'Administration', targetKey: 'administration_pct_target' },
    { key: 'general_pct', label: 'General (G&A)', targetKey: 'general_pct_target' },
    { key: 'property_pct', label: 'Property', targetKey: 'property_pct_target' },
  ];

  for (const dept of deptExpenseCategories) {
    const variance = variances[dept.key];
    const actualPct = actuals[dept.key];
    const targetPct = targets[dept.targetKey];

    if (variance !== null && variance > 0 && actuals.revenue > 0) {
      const deptOpportunity = (variance / 100) * actuals.revenue;
      opportunities.push({
        category: dept.key.replace('_pct', ''),
        label: dept.label,
        description: `Reduce ${dept.label.toLowerCase()} from ${actualPct?.toFixed(1)}% to ${targetPct}% of revenue`,
        actual_pct: actualPct,
        target_pct: targetPct,
        variance_pct: variance,
        value: Math.round(deptOpportunity),
        priority: getPriority(deptOpportunity, actuals.revenue),
      });
      totalOpportunity += deptOpportunity;
    }
  }

  // Sort opportunities by value (highest first)
  opportunities.sort((a, b) => b.value - a.value);

  // Calculate stabilized metrics
  // 1. Revenue uplift from occupancy improvement
  let stabilizedRevenue = actuals.revenue;
  let occupancyUplift = 0;

  if (actuals.occupancy > 0 && actuals.occupancy < targets.occupancy_target) {
    const occupancyMultiplier = targets.occupancy_target / actuals.occupancy;
    stabilizedRevenue = actuals.revenue * occupancyMultiplier;
    occupancyUplift = stabilizedRevenue - actuals.revenue;

    // Add occupancy as an opportunity
    opportunities.unshift({
      category: 'occupancy',
      label: 'Occupancy Improvement',
      description: `Increase occupancy from ${actuals.occupancy?.toFixed(1)}% to ${targets.occupancy_target}%`,
      actual_pct: actuals.occupancy,
      target_pct: targets.occupancy_target,
      variance_pct: targets.occupancy_target - actuals.occupancy,
      value: Math.round(occupancyUplift),
      priority: getPriority(occupancyUplift, actuals.revenue),
      type: 'revenue_uplift',
    });
    totalOpportunity += occupancyUplift;
  }

  // 2. EBITDA improvement from expense optimization
  const stabilizedEbitda = actuals.ebitda + totalOpportunity;
  const stabilizedEbitdaMargin = stabilizedRevenue > 0
    ? (stabilizedEbitda / stabilizedRevenue) * 100
    : null;

  // 3. EBITDAR (assuming rent stays constant)
  const rent = actuals.ebitdar - actuals.ebitda;
  const stabilizedEbitdar = stabilizedEbitda + rent;
  const stabilizedEbitdarMargin = stabilizedRevenue > 0
    ? (stabilizedEbitdar / stabilizedRevenue) * 100
    : null;

  // Calculate valuation impact
  const impliedValueAtTargetMargin = stabilizedEbitda > 0 && actuals.purchase_price > 0
    ? {
        at_current_multiple: actuals.ebitda > 0
          ? Math.round(stabilizedEbitda * (actuals.purchase_price / actuals.ebitda))
          : null,
        implied_discount: actuals.ebitda > 0
          ? Math.round(((stabilizedEbitda / actuals.ebitda) - 1) * 100)
          : null,
      }
    : null;

  return {
    // Actuals from the deal
    actuals: {
      revenue: actuals.revenue,
      ebitda: actuals.ebitda,
      ebitdar: actuals.ebitdar,
      ebitda_margin: actuals.ebitda_margin !== null ? parseFloat(actuals.ebitda_margin.toFixed(2)) : null,
      ebitdar_margin: actuals.ebitdar_margin !== null ? parseFloat(actuals.ebitdar_margin.toFixed(2)) : null,
      occupancy: actuals.occupancy,
      private_pay_pct: actuals.private_pay_pct,
      beds: actuals.beds,
      purchase_price: actuals.purchase_price,

      // Expense metrics
      labor_pct: actuals.labor_pct !== null ? parseFloat(actuals.labor_pct.toFixed(1)) : null,
      agency_pct: actuals.agency_pct !== null ? parseFloat(actuals.agency_pct.toFixed(1)) : null,
      food_cost_per_day: actuals.food_cost_per_day !== null ? parseFloat(actuals.food_cost_per_day.toFixed(2)) : null,
      management_fee_pct: actuals.management_fee_pct !== null ? parseFloat(actuals.management_fee_pct.toFixed(1)) : null,
      bad_debt_pct: actuals.bad_debt_pct !== null ? parseFloat(actuals.bad_debt_pct.toFixed(1)) : null,
      utilities_pct: actuals.utilities_pct !== null ? parseFloat(actuals.utilities_pct.toFixed(1)) : null,

      // Department expense metrics (% of revenue)
      direct_care_pct: actuals.direct_care_pct !== null ? parseFloat(actuals.direct_care_pct.toFixed(1)) : null,
      activities_pct: actuals.activities_pct !== null ? parseFloat(actuals.activities_pct.toFixed(1)) : null,
      culinary_pct: actuals.culinary_pct !== null ? parseFloat(actuals.culinary_pct.toFixed(1)) : null,
      housekeeping_pct: actuals.housekeeping_pct !== null ? parseFloat(actuals.housekeeping_pct.toFixed(1)) : null,
      maintenance_pct: actuals.maintenance_pct !== null ? parseFloat(actuals.maintenance_pct.toFixed(1)) : null,
      administration_pct: actuals.administration_pct !== null ? parseFloat(actuals.administration_pct.toFixed(1)) : null,
      general_pct: actuals.general_pct !== null ? parseFloat(actuals.general_pct.toFixed(1)) : null,
      property_pct: actuals.property_pct !== null ? parseFloat(actuals.property_pct.toFixed(1)) : null,
    },

    // Benchmark targets used
    benchmarks: {
      occupancy_target: targets.occupancy_target,
      private_pay_mix_target: targets.private_pay_mix_target,
      revenue_per_occupied_bed_target: targets.revenue_per_occupied_bed_target,
      labor_pct_target: targets.labor_pct_target,
      agency_pct_of_labor_target: targets.agency_pct_of_labor_target,
      food_cost_per_day_target: targets.food_cost_per_day_target,
      management_fee_pct_target: targets.management_fee_pct_target,
      bad_debt_pct_target: targets.bad_debt_pct_target,
      utilities_pct_target: targets.utilities_pct_target,
      insurance_pct_target: targets.insurance_pct_target,
      ebitda_margin_target: targets.ebitda_margin_target,
      ebitdar_margin_target: targets.ebitdar_margin_target,
      // Department expense targets
      direct_care_pct_target: targets.direct_care_pct_target,
      activities_pct_target: targets.activities_pct_target,
      culinary_pct_target: targets.culinary_pct_target,
      housekeeping_pct_target: targets.housekeeping_pct_target,
      maintenance_pct_target: targets.maintenance_pct_target,
      administration_pct_target: targets.administration_pct_target,
      general_pct_target: targets.general_pct_target,
      property_pct_target: targets.property_pct_target,
      stabilization_months: targets.stabilization_months,
    },

    // Variances (positive = above target/needs improvement)
    variances: {
      occupancy: variances.occupancy !== null ? parseFloat(variances.occupancy.toFixed(1)) : null,
      labor_pct: variances.labor_pct !== null ? parseFloat(variances.labor_pct.toFixed(1)) : null,
      agency_pct: variances.agency_pct !== null ? parseFloat(variances.agency_pct.toFixed(1)) : null,
      food_cost_per_day: variances.food_cost_per_day !== null ? parseFloat(variances.food_cost_per_day.toFixed(2)) : null,
      management_fee_pct: variances.management_fee_pct !== null ? parseFloat(variances.management_fee_pct.toFixed(1)) : null,
      bad_debt_pct: variances.bad_debt_pct !== null ? parseFloat(variances.bad_debt_pct.toFixed(1)) : null,
      utilities_pct: variances.utilities_pct !== null ? parseFloat(variances.utilities_pct.toFixed(1)) : null,
      ebitda_margin: variances.ebitda_margin !== null ? parseFloat(variances.ebitda_margin.toFixed(1)) : null,
      ebitdar_margin: variances.ebitdar_margin !== null ? parseFloat(variances.ebitdar_margin.toFixed(1)) : null,
      // Department expense variances
      direct_care_pct: variances.direct_care_pct !== null ? parseFloat(variances.direct_care_pct.toFixed(1)) : null,
      activities_pct: variances.activities_pct !== null ? parseFloat(variances.activities_pct.toFixed(1)) : null,
      culinary_pct: variances.culinary_pct !== null ? parseFloat(variances.culinary_pct.toFixed(1)) : null,
      housekeeping_pct: variances.housekeeping_pct !== null ? parseFloat(variances.housekeeping_pct.toFixed(1)) : null,
      maintenance_pct: variances.maintenance_pct !== null ? parseFloat(variances.maintenance_pct.toFixed(1)) : null,
      administration_pct: variances.administration_pct !== null ? parseFloat(variances.administration_pct.toFixed(1)) : null,
      general_pct: variances.general_pct !== null ? parseFloat(variances.general_pct.toFixed(1)) : null,
      property_pct: variances.property_pct !== null ? parseFloat(variances.property_pct.toFixed(1)) : null,
    },

    // Improvement opportunities (sorted by value)
    opportunities,

    // Stabilized projections
    stabilized: {
      revenue: Math.round(stabilizedRevenue),
      ebitda: Math.round(stabilizedEbitda),
      ebitdar: Math.round(stabilizedEbitdar),
      ebitda_margin: stabilizedEbitdaMargin !== null ? parseFloat(stabilizedEbitdaMargin.toFixed(1)) : null,
      ebitdar_margin: stabilizedEbitdarMargin !== null ? parseFloat(stabilizedEbitdarMargin.toFixed(1)) : null,
      occupancy: targets.occupancy_target,
      months_to_stabilize: targets.stabilization_months,
    },

    // Summary
    total_opportunity: Math.round(totalOpportunity),
    total_opportunity_pct: actuals.revenue > 0
      ? parseFloat(((totalOpportunity / actuals.revenue) * 100).toFixed(1))
      : null,
    high_priority_count: opportunities.filter(o => o.priority === 'high').length,
    valuation_impact: impliedValueAtTargetMargin,
  };
}

/**
 * Generate yearly projections for the stabilization period
 * @param {Object} proformaResult - Result from calculateProforma
 * @param {number} years - Number of years to project (default 3)
 * @returns {Array} Yearly projections
 */
function generateYearlyProjections(proformaResult, years = 3) {
  const { actuals, stabilized, benchmarks } = proformaResult;

  if (!actuals.revenue || !stabilized.revenue) return [];

  const monthsToStabilize = benchmarks.stabilization_months || 18;
  const projections = [];

  for (let year = 1; year <= years; year++) {
    // Calculate progress toward stabilization
    const monthsElapsed = year * 12;
    const progress = Math.min(monthsElapsed / monthsToStabilize, 1);

    // Interpolate values
    const revenue = actuals.revenue + (stabilized.revenue - actuals.revenue) * progress;
    const ebitda = actuals.ebitda + (stabilized.ebitda - actuals.ebitda) * progress;
    const ebitdar = actuals.ebitdar + (stabilized.ebitdar - actuals.ebitdar) * progress;
    const occupancy = actuals.occupancy + (stabilized.occupancy - actuals.occupancy) * progress;

    projections.push({
      year,
      revenue: Math.round(revenue),
      ebitda: Math.round(ebitda),
      ebitdar: Math.round(ebitdar),
      ebitda_margin: revenue > 0 ? parseFloat(((ebitda / revenue) * 100).toFixed(1)) : null,
      ebitdar_margin: revenue > 0 ? parseFloat(((ebitdar / revenue) * 100).toFixed(1)) : null,
      occupancy: parseFloat(occupancy.toFixed(1)),
      progress_pct: Math.round(progress * 100),
    });
  }

  return projections;
}

module.exports = {
  calculateProforma,
  generateYearlyProjections,
  normalizeBenchmarkConfig,
  extractActuals,
  DEFAULT_BENCHMARKS,
};
