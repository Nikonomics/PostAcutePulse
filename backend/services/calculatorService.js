/**
 * Deal Calculator Service
 * Computes underwriting metrics for SNF/ALF deals
 */

const { NormalizationService } = require('./normalizationService');

/**
 * Calculate all deal metrics from extraction data
 * @param {Object} deal - The deal object with extraction_data
 * @returns {Object} Computed metrics organized by facility
 */
function calculateDealMetrics(deal) {
  if (!deal) {
    throw new Error('Deal not found');
  }

  const extractionData = deal.extraction_data || {};

  // Use deal fields as primary source, fall back to extraction_data
  const metrics = {
    dealId: deal.id,
    dealName: deal.deal_name,
    facilityName: deal.facility_name,
    facilityType: deal.facility_type,

    // Input values
    inputs: {
      purchasePrice: parseFloat(deal.purchase_price) || 0,
      numberOfBeds: parseInt(deal.no_of_beds) || 0,
      annualRevenue: parseFloat(deal.annual_revenue) || parseFloat(extractionData.t12m_revenue) || 0,
      ebitda: parseFloat(deal.ebitda) || parseFloat(extractionData.t12m_ebitda) || 0,
      ebitdar: parseFloat(extractionData.t12m_ebitdar) || parseFloat(extractionData.ebitdar) || 0,
      ebit: parseFloat(extractionData.t12m_ebit) || parseFloat(extractionData.ebit) || 0,
      noi: parseFloat(deal.net_operating_income) || parseFloat(extractionData.net_income) || 0,
      currentOccupancy: parseFloat(deal.current_occupancy) || parseFloat(extractionData.current_occupancy) || 0,
      averageDailyRate: parseFloat(deal.average_daily_rate) || parseFloat(extractionData.average_daily_rate) || 0,

      // Payer mix
      medicarePercentage: parseFloat(deal.medicare_percentage) || parseFloat(extractionData.medicare_percentage) || 0,
      medicaidPercentage: parseFloat(extractionData.medicaid_percentage) || 0,
      privatePayPercentage: parseFloat(deal.private_pay_percentage) || parseFloat(extractionData.private_pay_percentage) || 0,

      // Rent/Lease
      currentRentExpense: parseFloat(extractionData.current_rent_lease_expense) || 0,

      // Target metrics
      targetIRR: parseFloat(deal.target_irr_percentage) || 15,
      targetHoldPeriod: parseFloat(deal.target_hold_period) || 5,
      projectedCapRate: parseFloat(deal.projected_cap_rate_percentage) || 0,
      exitMultiple: parseFloat(deal.exit_multiple) || 0,
    },

    // Computed metrics
    computed: {},

    // Per-facility breakdown (for multi-facility deals)
    facilities: [],

    // Summary
    summary: {},

    // Data quality indicators
    dataQuality: {
      hasRevenueData: false,
      hasEBITDAData: false,
      hasOccupancyData: false,
      hasPayerMixData: false,
      completenessScore: 0,
    }
  };

  const inputs = metrics.inputs;

  // Calculate computed metrics
  const computed = {};

  // Price Per Bed
  if (inputs.purchasePrice > 0 && inputs.numberOfBeds > 0) {
    computed.pricePerBed = Math.round(inputs.purchasePrice / inputs.numberOfBeds);
  }

  // Revenue Multiple
  if (inputs.purchasePrice > 0 && inputs.annualRevenue > 0) {
    computed.revenueMultiple = parseFloat((inputs.purchasePrice / inputs.annualRevenue).toFixed(2));
  }

  // EBITDA Multiple
  if (inputs.purchasePrice > 0 && inputs.ebitda !== 0) {
    computed.ebitdaMultiple = parseFloat((inputs.purchasePrice / inputs.ebitda).toFixed(2));
  }

  // EBITDAR Multiple
  if (inputs.purchasePrice > 0 && inputs.ebitdar !== 0) {
    computed.ebitdarMultiple = parseFloat((inputs.purchasePrice / inputs.ebitdar).toFixed(2));
  }

  // Cap Rate (NOI / Purchase Price)
  if (inputs.purchasePrice > 0 && inputs.noi !== 0) {
    computed.capRate = parseFloat(((inputs.noi / inputs.purchasePrice) * 100).toFixed(2));
  }

  // EBITDA Margin
  if (inputs.annualRevenue > 0 && inputs.ebitda !== 0) {
    computed.ebitdaMargin = parseFloat(((inputs.ebitda / inputs.annualRevenue) * 100).toFixed(2));
  }

  // EBITDAR Margin
  if (inputs.annualRevenue > 0 && inputs.ebitdar !== 0) {
    computed.ebitdarMargin = parseFloat(((inputs.ebitdar / inputs.annualRevenue) * 100).toFixed(2));
  }

  // Revenue Per Bed (annual)
  if (inputs.annualRevenue > 0 && inputs.numberOfBeds > 0) {
    computed.revenuePerBed = Math.round(inputs.annualRevenue / inputs.numberOfBeds);
  }

  // EBITDA Per Bed
  if (inputs.ebitda !== 0 && inputs.numberOfBeds > 0) {
    computed.ebitdaPerBed = Math.round(inputs.ebitda / inputs.numberOfBeds);
  }

  // Revenue Per Occupied Bed (using occupancy)
  if (inputs.annualRevenue > 0 && inputs.numberOfBeds > 0 && inputs.currentOccupancy > 0) {
    const occupiedBeds = inputs.numberOfBeds * (inputs.currentOccupancy / 100);
    computed.revenuePerOccupiedBed = Math.round(inputs.annualRevenue / occupiedBeds);
  }

  // Rent Coverage Ratio (EBITDAR / Rent Expense)
  if (inputs.ebitdar !== 0 && inputs.currentRentExpense > 0) {
    computed.rentCoverageRatio = parseFloat((inputs.ebitdar / inputs.currentRentExpense).toFixed(2));
  }

  // Implied Value at Target Cap Rate
  if (inputs.noi !== 0 && inputs.projectedCapRate > 0) {
    computed.impliedValueAtTargetCap = Math.round(inputs.noi / (inputs.projectedCapRate / 100));
  }

  // Exit Value at Target Multiple
  if (inputs.ebitda !== 0 && inputs.exitMultiple > 0) {
    computed.exitValueAtMultiple = Math.round(inputs.ebitda * inputs.exitMultiple);
  }

  // Stabilized NOI (at 95% occupancy)
  if (inputs.annualRevenue > 0 && inputs.currentOccupancy > 0 && inputs.ebitda !== 0) {
    const targetOccupancy = 0.95;
    const currentOccupancyDecimal = inputs.currentOccupancy / 100;

    // Simple linear projection - revenue increases proportionally with occupancy
    const revenueUplift = targetOccupancy / currentOccupancyDecimal;
    const stabilizedRevenue = inputs.annualRevenue * revenueUplift;

    // Assume margin stays constant for simplified calculation
    const currentMargin = inputs.ebitda / inputs.annualRevenue;
    computed.stabilizedNOI = Math.round(stabilizedRevenue * currentMargin);
    computed.stabilizedCapRate = inputs.purchasePrice > 0
      ? parseFloat(((computed.stabilizedNOI / inputs.purchasePrice) * 100).toFixed(2))
      : null;
  }

  // Payer Mix Analysis
  const payerMixTotal = inputs.medicarePercentage + inputs.medicaidPercentage + inputs.privatePayPercentage;
  if (payerMixTotal > 0) {
    computed.payerMix = {
      medicare: inputs.medicarePercentage,
      medicaid: inputs.medicaidPercentage,
      privatePay: inputs.privatePayPercentage,
      other: Math.max(0, 100 - payerMixTotal),
      isComplete: Math.abs(payerMixTotal - 100) < 5, // Within 5% of 100%
    };
  }

  metrics.computed = computed;

  // Data Quality Assessment
  metrics.dataQuality.hasRevenueData = inputs.annualRevenue > 0;
  metrics.dataQuality.hasEBITDAData = inputs.ebitda !== 0;
  metrics.dataQuality.hasOccupancyData = inputs.currentOccupancy > 0;
  metrics.dataQuality.hasPayerMixData = payerMixTotal > 0;

  // Completeness score (0-100)
  const requiredFields = [
    inputs.purchasePrice,
    inputs.numberOfBeds,
    inputs.annualRevenue,
    inputs.ebitda,
    inputs.currentOccupancy,
  ];
  const filledFields = requiredFields.filter(v => v && v !== 0).length;
  metrics.dataQuality.completenessScore = Math.round((filledFields / requiredFields.length) * 100);

  // Summary
  metrics.summary = {
    purchasePrice: formatCurrency(inputs.purchasePrice),
    pricePerBed: formatCurrency(computed.pricePerBed),
    revenueMultiple: computed.revenueMultiple ? `${computed.revenueMultiple}x` : 'N/A',
    ebitdaMultiple: computed.ebitdaMultiple ? `${computed.ebitdaMultiple}x` : 'N/A',
    capRate: computed.capRate ? `${computed.capRate}%` : 'N/A',
    occupancy: inputs.currentOccupancy ? `${inputs.currentOccupancy}%` : 'N/A',
    rentCoverage: computed.rentCoverageRatio ? `${computed.rentCoverageRatio}x` : 'N/A',
  };

  return metrics;
}

/**
 * Format number as currency
 */
function formatCurrency(value) {
  if (!value || value === 0) return 'N/A';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Calculate metrics for multiple facilities in a portfolio
 * @param {Array} deals - Array of deal objects
 * @returns {Object} Portfolio-level metrics
 */
function calculatePortfolioMetrics(deals) {
  if (!deals || deals.length === 0) {
    return null;
  }

  const facilityMetrics = deals.map(deal => calculateDealMetrics(deal));

  // Aggregate totals
  const totals = {
    totalPurchasePrice: 0,
    totalBeds: 0,
    totalRevenue: 0,
    totalEBITDA: 0,
    totalEBITDAR: 0,
    weightedOccupancy: 0,
  };

  facilityMetrics.forEach(fm => {
    totals.totalPurchasePrice += fm.inputs.purchasePrice;
    totals.totalBeds += fm.inputs.numberOfBeds;
    totals.totalRevenue += fm.inputs.annualRevenue;
    totals.totalEBITDA += fm.inputs.ebitda;
    totals.totalEBITDAR += fm.inputs.ebitdar;
    // Weight occupancy by bed count
    totals.weightedOccupancy += fm.inputs.currentOccupancy * fm.inputs.numberOfBeds;
  });

  // Calculate portfolio-level metrics
  const portfolioMetrics = {
    facilityCount: deals.length,
    totals: {
      purchasePrice: totals.totalPurchasePrice,
      numberOfBeds: totals.totalBeds,
      annualRevenue: totals.totalRevenue,
      ebitda: totals.totalEBITDA,
      ebitdar: totals.totalEBITDAR,
    },
    computed: {
      avgPricePerBed: totals.totalBeds > 0
        ? Math.round(totals.totalPurchasePrice / totals.totalBeds)
        : 0,
      portfolioRevenueMultiple: totals.totalRevenue > 0
        ? parseFloat((totals.totalPurchasePrice / totals.totalRevenue).toFixed(2))
        : null,
      portfolioEBITDAMultiple: totals.totalEBITDA !== 0
        ? parseFloat((totals.totalPurchasePrice / totals.totalEBITDA).toFixed(2))
        : null,
      avgOccupancy: totals.totalBeds > 0
        ? parseFloat((totals.weightedOccupancy / totals.totalBeds).toFixed(1))
        : 0,
    },
    facilities: facilityMetrics,
  };

  return portfolioMetrics;
}

/**
 * Calculate enhanced deal metrics including normalized values and benchmarks
 * This is the main function to use for the /calculate endpoint
 * @param {Object} deal - The deal object with extraction_data
 * @returns {Object} Complete metrics with normalized values and benchmark flags
 */
function calculateEnhancedMetrics(deal) {
  // Get base metrics
  const baseMetrics = calculateDealMetrics(deal);
  const extractionData = deal.extraction_data || {};

  // Build raw metrics from base calculation
  const rawMetrics = {
    ebitda: baseMetrics.inputs.ebitda,
    ebitda_margin: baseMetrics.computed.ebitdaMargin || null,
    ebitdar: baseMetrics.inputs.ebitdar,
    ebitdar_margin: baseMetrics.computed.ebitdarMargin || null,
  };

  // Check if we have extraction_data with expense_detail for normalization
  const hasExpenseDetail = extractionData &&
    (extractionData.expense_detail || extractionData.financial_information_t12?.expense_detail);

  let normalizedMetrics = null;
  let normalizationDetails = null;

  if (hasExpenseDetail || extractionData.t12m_ebitda || extractionData.ebitda) {
    // Call NormalizationService.normalize() with extraction data and deal info
    const normalizationResult = NormalizationService.normalize(extractionData, {
      bed_count: baseMetrics.inputs.numberOfBeds,
      total_revenue: baseMetrics.inputs.annualRevenue,
      current_census: baseMetrics.inputs.currentOccupancy * baseMetrics.inputs.numberOfBeds / 100
    });

    // Build normalized metrics from result
    if (normalizationResult && normalizationResult.summary) {
      const purchasePrice = baseMetrics.inputs.purchasePrice;

      normalizedMetrics = {
        ebitda: normalizationResult.summary.normalized_ebitda,
        ebitda_margin: normalizationResult.summary.normalized_ebitda_margin,
        ebitdar: normalizationResult.summary.normalized_ebitdar,
        ebitdar_margin: normalizationResult.summary.total_revenue > 0
          ? parseFloat((normalizationResult.summary.normalized_ebitdar / normalizationResult.summary.total_revenue * 100).toFixed(2))
          : null,
        total_adjustments: normalizationResult.summary.total_adjustments,
        // Calculated multiples based on normalized values
        ebitda_multiple: normalizationResult.summary.normalized_ebitda > 0 && purchasePrice > 0
          ? parseFloat((purchasePrice / normalizationResult.summary.normalized_ebitda).toFixed(2))
          : null,
        ebitdar_multiple: normalizationResult.summary.normalized_ebitdar > 0 && purchasePrice > 0
          ? parseFloat((purchasePrice / normalizationResult.summary.normalized_ebitdar).toFixed(2))
          : null,
        cap_rate: normalizationResult.summary.normalized_ebitda > 0 && purchasePrice > 0
          ? parseFloat((normalizationResult.summary.normalized_ebitda / purchasePrice * 100).toFixed(2))
          : null,
      };

      normalizationDetails = {
        adjustments: normalizationResult.adjustments || [],
        flags: normalizationResult.flags || [],
        summary: {
          adjustment_count: normalizationResult.summary.adjustment_count,
          related_party_adjustments: normalizationResult.summary.related_party_adjustments,
          one_time_adjustments: normalizationResult.summary.one_time_adjustments,
          other_adjustments: normalizationResult.summary.other_adjustments,
          margin_improvement: normalizationResult.summary.margin_improvement,
        },
        details: normalizationResult.details || {}
      };
    }
  }

  // Build enhanced response
  return {
    ...baseMetrics,

    // Flat metrics for easy access
    price_per_bed: baseMetrics.computed.pricePerBed || null,
    revenue_multiple: baseMetrics.computed.revenueMultiple || null,
    ebitda_multiple: baseMetrics.computed.ebitdaMultiple || null,
    ebitdar_multiple: baseMetrics.computed.ebitdarMultiple || null,
    cap_rate: baseMetrics.computed.capRate || null,

    // Raw metrics (before normalization)
    raw_metrics: rawMetrics,

    // Normalized metrics (after adjustments)
    normalized_metrics: normalizedMetrics,

    // Full normalization details
    normalization_details: normalizationDetails,

    // Summary of normalization impact
    normalization_summary: normalizedMetrics ? {
      has_adjustments: (normalizationDetails?.summary?.adjustment_count || 0) > 0,
      adjustment_count: normalizationDetails?.summary?.adjustment_count || 0,
      total_adjustments: normalizedMetrics.total_adjustments || 0,
      ebitda_uplift_pct: rawMetrics.ebitda && rawMetrics.ebitda !== 0 && normalizedMetrics.ebitda
        ? parseFloat((((normalizedMetrics.ebitda - rawMetrics.ebitda) / Math.abs(rawMetrics.ebitda)) * 100).toFixed(1))
        : null,
      margin_improvement: normalizationDetails?.summary?.margin_improvement || 0,
      critical_flags: (normalizationDetails?.flags || []).filter(f => f.severity === 'high').length,
      warning_flags: (normalizationDetails?.flags || []).filter(f => f.severity === 'medium').length,
    } : null,
  };
}

/**
 * Calculate enhanced metrics for a portfolio
 * @param {Array} deals - Array of deal objects
 * @returns {Object} Portfolio metrics with normalized values
 */
function calculateEnhancedPortfolioMetrics(deals) {
  if (!deals || deals.length === 0) {
    return null;
  }

  // Get base portfolio metrics
  const basePortfolio = calculatePortfolioMetrics(deals);

  // Calculate enhanced metrics for each facility
  const enhancedFacilities = deals.map(deal => calculateEnhancedMetrics(deal));

  // Aggregate raw totals
  const rawTotals = {
    totalEbitda: 0,
    totalEbitdar: 0,
  };

  // Aggregate normalized totals
  const normalizedTotals = {
    totalNormalizedEbitda: 0,
    totalNormalizedEbitdar: 0,
    totalAdjustment: 0,
    allFlags: [],
    adjustmentCount: 0,
  };

  enhancedFacilities.forEach(fm => {
    // Raw totals
    rawTotals.totalEbitda += fm.raw_metrics?.ebitda || 0;
    rawTotals.totalEbitdar += fm.raw_metrics?.ebitdar || 0;

    // Normalized totals
    normalizedTotals.totalNormalizedEbitda += fm.normalized_metrics?.ebitda || 0;
    normalizedTotals.totalNormalizedEbitdar += fm.normalized_metrics?.ebitdar || 0;
    normalizedTotals.totalAdjustment += fm.normalized_metrics?.total_adjustments || 0;
    normalizedTotals.adjustmentCount += fm.normalization_summary?.adjustment_count || 0;

    // Collect all flags
    if (fm.normalization_details?.flags) {
      normalizedTotals.allFlags.push(...fm.normalization_details.flags);
    }
  });

  // Calculate portfolio-level metrics
  const portfolioPrice = basePortfolio.totals.purchasePrice;
  const portfolioRevenue = basePortfolio.totals.annualRevenue;

  return {
    ...basePortfolio,
    facilities: enhancedFacilities,

    // Portfolio raw metrics
    portfolio_raw_metrics: {
      ebitda: rawTotals.totalEbitda,
      ebitda_margin: portfolioRevenue > 0
        ? parseFloat((rawTotals.totalEbitda / portfolioRevenue * 100).toFixed(2))
        : null,
      ebitdar: rawTotals.totalEbitdar,
      ebitdar_margin: portfolioRevenue > 0
        ? parseFloat((rawTotals.totalEbitdar / portfolioRevenue * 100).toFixed(2))
        : null,
    },

    // Portfolio normalized metrics
    portfolio_normalized_metrics: normalizedTotals.totalNormalizedEbitda > 0 ? {
      ebitda: normalizedTotals.totalNormalizedEbitda,
      ebitda_margin: portfolioRevenue > 0
        ? parseFloat((normalizedTotals.totalNormalizedEbitda / portfolioRevenue * 100).toFixed(2))
        : null,
      ebitdar: normalizedTotals.totalNormalizedEbitdar,
      ebitdar_margin: portfolioRevenue > 0
        ? parseFloat((normalizedTotals.totalNormalizedEbitdar / portfolioRevenue * 100).toFixed(2))
        : null,
      ebitda_multiple: portfolioPrice > 0
        ? parseFloat((portfolioPrice / normalizedTotals.totalNormalizedEbitda).toFixed(2))
        : null,
      ebitdar_multiple: normalizedTotals.totalNormalizedEbitdar > 0 && portfolioPrice > 0
        ? parseFloat((portfolioPrice / normalizedTotals.totalNormalizedEbitdar).toFixed(2))
        : null,
      total_adjustments: normalizedTotals.totalAdjustment,
    } : null,

    // Portfolio normalization summary
    portfolio_normalization_summary: {
      has_adjustments: normalizedTotals.adjustmentCount > 0,
      total_adjustment_count: normalizedTotals.adjustmentCount,
      total_adjustments: normalizedTotals.totalAdjustment,
      critical_flags: normalizedTotals.allFlags.filter(f => f.severity === 'high').length,
      warning_flags: normalizedTotals.allFlags.filter(f => f.severity === 'medium').length,
      facilities_with_adjustments: enhancedFacilities.filter(f =>
        f.normalization_summary?.has_adjustments
      ).length,
    },
  };
}

module.exports = {
  calculateDealMetrics,
  calculatePortfolioMetrics,
  calculateEnhancedMetrics,
  calculateEnhancedPortfolioMetrics,
  formatCurrency,
};
