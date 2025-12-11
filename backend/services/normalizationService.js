/**
 * Normalization Service
 *
 * Adjusts raw extracted financials to reflect true operating performance
 * by stripping out one-time items and adjusting related-party transactions
 * to market rates.
 *
 * This is critical for accurate deal valuation - buyers care about
 * normalized/stabilized EBITDA, not reported numbers that may include
 * owner perks, related party excess, or one-time hits.
 *
 * Key adjustment categories:
 * 1. Related Party Transactions - Management fees, rent, consulting above market
 * 2. One-Time Items - PPP/COVID relief, legal settlements, restructuring
 * 3. Owner Benefits - Personal expenses run through the facility
 * 4. Above-Market Expenses - Insurance, bad debt, professional fees
 *
 * @module services/normalizationService
 */

const NORMALIZATION_CONFIG = {
  // Market benchmarks for normalization
  benchmarks: {
    management_fee_pct: 0.04,           // 4% is market rate for third-party management
    management_fee_max_pct: 0.05,       // 5% is high end of market
    property_insurance_per_bed: 1200,   // $1,200/bed annually is typical
    property_insurance_variance: 0.25,  // 25% variance before flagging
    admin_allocation_pct: 0.02,         // 2% reasonable corporate allocation
    admin_allocation_max_pct: 0.03,     // 3% is high end
    rent_pct_of_revenue: 0.08,          // 8% for triple-net lease
    rent_pct_max: 0.10,                 // 10% is high
    bad_debt_pct: 0.02,                 // 2% is normal
    bad_debt_spike_threshold: 0.04,     // >4% indicates unusual spike
    professional_fees_pct: 0.01,        // 1% typical
    professional_fees_max_pct: 0.02,    // 2% high
    dietary_cost_per_resident_day: 12,  // $12/resident day typical
    dietary_variance: 0.20,             // 20% variance before flagging
    agency_pct_of_labor: 0.02,          // 2% target agency staffing
    agency_pct_critical: 0.10,          // 10% is critical
    labor_pct_of_revenue: 0.55,         // 55% target labor
    labor_pct_max: 0.62,                // 62% is high
    utilities_pct: 0.03,                // 3% typical utilities
    utilities_pct_max: 0.05             // 5% is high
  },

  // Keywords indicating one-time/non-recurring items
  oneTimeKeywords: [
    'settlement', 'litigation', 'lawsuit', 'legal settlement',
    'ppp', 'paycheck protection', 'ertc', 'covid relief', 'cares act',
    'provider relief', 'stimulus', 'covid grant',
    'severance', 'restructuring', 'reorganization',
    'write-off', 'write off', 'writeoff', 'impairment',
    'gain on sale', 'loss on sale', 'disposition', 'asset sale',
    'prior year adjustment', 'prior period', 'restatement',
    'insurance recovery', 'insurance settlement', 'insurance proceeds',
    'one-time', 'one time', 'onetime', 'non-recurring', 'nonrecurring',
    'extraordinary', 'unusual', 'special charge',
    'startup cost', 'start-up', 'opening cost',
    'penalty', 'fine', 'citation fine',
    'bonus', 'retention bonus', 'signing bonus'
  ],

  // Keywords indicating related party transactions
  relatedPartyKeywords: [
    'allocated', 'allocation', 'intercompany', 'affiliate',
    'management fee', 'management company', 'parent company',
    'related party', 'related-party', 'owner', 'shareholder',
    'consulting - owner', 'family', 'spouse',
    'home office', 'corporate overhead', 'corporate allocation',
    'administrative allocation', 'shared services'
  ],

  // Line items commonly subject to related party excess
  relatedPartyLineItems: [
    'management_fees',
    'consulting_fees',
    'administrative_allocation',
    'corporate_overhead',
    'professional_fees',
    'rent_expense',
    'lease_expense',
    'property_management'
  ],

  // Owner benefit/perk categories to normalize
  ownerBenefitKeywords: [
    'auto', 'vehicle', 'car lease', 'car payment',
    'travel', 'entertainment', 'meals',
    'club membership', 'dues', 'subscription',
    'personal', 'owner draw', 'distribution'
  ]
};

/**
 * @typedef {Object} Adjustment
 * @property {string} category - Type of adjustment (management_fee, one_time, related_party, etc.)
 * @property {string} line_item - Path to the line item being adjusted
 * @property {string} description - Human-readable description of the adjustment
 * @property {number} current_value - Original/reported value
 * @property {number} market_value - Market-rate or normalized value
 * @property {number} adjustment - Dollar amount of adjustment (positive = adds to EBITDA)
 * @property {boolean} is_related_party - Whether this involves related party
 * @property {string} confidence - Confidence level: 'high', 'medium', 'low'
 * @property {string} rationale - Detailed explanation of the adjustment
 */

/**
 * @typedef {Object} NormalizationFlag
 * @property {string} type - Flag type (related_party, one_time, above_market, etc.)
 * @property {string} severity - 'high', 'medium', 'low'
 * @property {number} count - Number of items in this category
 * @property {number} total_impact - Total dollar impact
 * @property {string} message - Human-readable flag message
 */

/**
 * @typedef {Object} NormalizationResult
 * @property {Adjustment[]} adjustments - Array of all adjustments made
 * @property {Object} summary - Summary of normalized financials
 * @property {NormalizationFlag[]} flags - Flags for due diligence attention
 * @property {Object} details - Detailed breakdown by category
 */

class NormalizationService {

  /**
   * Main normalization function - entry point for normalizing extracted financials
   *
   * @param {Object} extractedData - Raw extraction from Claude AI
   * @param {Object} dealInfo - Deal metadata for benchmarking
   * @param {number} [dealInfo.bed_count] - Number of licensed beds
   * @param {number} [dealInfo.current_census] - Current occupancy
   * @param {number} [dealInfo.total_revenue] - Override total revenue
   * @param {number} [dealInfo.market_rent_estimate] - External rent estimate
   * @returns {NormalizationResult} Complete normalization results
   */
  static normalize(extractedData, dealInfo = {}) {
    const adjustments = [];
    const flags = [];

    try {
      // Extract key metrics from the data
      const metrics = this.extractKeyMetrics(extractedData, dealInfo);

      if (!metrics.total_revenue || metrics.total_revenue <= 0) {
        return {
          adjustments: [],
          summary: {
            error: 'Cannot normalize without valid revenue figure',
            total_adjustments: 0
          },
          flags: [{
            type: 'data_quality',
            severity: 'high',
            count: 1,
            total_impact: 0,
            message: 'Missing or invalid revenue - normalization not possible'
          }],
          details: {}
        };
      }

      // 1. Normalize management fees
      const mgmtAdjustment = this.normalizeManagementFee(
        metrics.management_fees,
        metrics.total_revenue,
        this.detectRelatedParty(extractedData, 'management_fees')
      );
      if (mgmtAdjustment) adjustments.push(mgmtAdjustment);

      // 2. Normalize allocated overhead / corporate charges
      const overheadAdjustment = this.normalizeAllocatedOverhead(
        metrics.administrative_allocation,
        metrics.total_revenue,
        this.detectRelatedParty(extractedData, 'administrative_allocation')
      );
      if (overheadAdjustment) adjustments.push(overheadAdjustment);

      // 3. Normalize property insurance
      if (metrics.bed_count > 0) {
        const insuranceAdjustment = this.normalizePropertyInsurance(
          metrics.property_insurance,
          metrics.bed_count
        );
        if (insuranceAdjustment) adjustments.push(insuranceAdjustment);
      }

      // 4. Normalize rent expense (if related party or above market)
      const rentAdjustment = this.normalizeRentExpense(
        metrics.rent_expense,
        metrics.total_revenue,
        this.detectRelatedParty(extractedData, 'rent_expense'),
        metrics.market_rent_estimate
      );
      if (rentAdjustment) adjustments.push(rentAdjustment);

      // 5. Detect and adjust one-time items
      const oneTimeAdjustments = this.detectOneTimeItems(
        extractedData,
        metrics
      );
      adjustments.push(...oneTimeAdjustments);

      // 6. Normalize professional fees
      const profFeeAdjustment = this.normalizeProfessionalFees(
        metrics.professional_fees,
        metrics.total_revenue,
        this.detectRelatedParty(extractedData, 'professional_fees')
      );
      if (profFeeAdjustment) adjustments.push(profFeeAdjustment);

      // 7. Analyze bad debt
      const badDebtAdjustment = this.analyzeBadDebt(
        metrics.bad_debt,
        metrics.total_revenue
      );
      if (badDebtAdjustment) adjustments.push(badDebtAdjustment);

      // 8. Detect owner benefits/perks
      const ownerBenefits = this.detectOwnerBenefits(extractedData);
      adjustments.push(...ownerBenefits);

      // 9. Agency staffing adjustment
      const agencyAdjustment = this.normalizeAgencyStaffing(
        metrics.agency_staffing,
        metrics.total_labor_cost,
        metrics.total_revenue
      );
      if (agencyAdjustment) adjustments.push(agencyAdjustment);

      // Generate flags based on adjustments
      const generatedFlags = this.generateFlags(adjustments, metrics);
      flags.push(...generatedFlags);

      // Calculate summary
      const summary = this.calculateSummary(adjustments, metrics);

      // Build detailed breakdown
      const details = this.buildDetailedBreakdown(adjustments);

      return {
        adjustments,
        summary,
        flags,
        details
      };

    } catch (error) {
      console.error('Normalization error:', error);
      return {
        adjustments: [],
        summary: {
          error: `Normalization failed: ${error.message}`,
          total_adjustments: 0
        },
        flags: [{
          type: 'system_error',
          severity: 'high',
          count: 1,
          total_impact: 0,
          message: `Normalization processing error: ${error.message}`
        }],
        details: {}
      };
    }
  }

  /**
   * Extract key financial metrics from extracted data
   * @private
   * @param {Object} extractedData - Raw extracted data
   * @param {Object} dealInfo - Deal metadata overrides
   * @returns {Object} Extracted metrics
   */
  static extractKeyMetrics(extractedData, dealInfo) {
    const data = extractedData || {};

    // Helper to safely get numeric value from nested paths
    const getNum = (path, defaultVal = 0) => {
      const parts = path.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined || value === null) return defaultVal;
      }
      // Handle object with 'value' property
      if (typeof value === 'object' && value !== null && 'value' in value) {
        value = value.value;
      }
      return typeof value === 'number' ? value : parseFloat(String(value).replace(/[,$]/g, '')) || defaultVal;
    };

    // Try multiple paths for each metric
    const totalRevenue = dealInfo.total_revenue ||
      getNum('total_revenue') ||
      getNum('revenue.total') ||
      getNum('income.total_revenue') ||
      getNum('t12_total_revenue') ||
      getNum('t12m_revenue') || 0;

    const operatingExpenses = getNum('total_operating_expenses') ||
      getNum('expenses.total_operating') ||
      getNum('operating_expenses.total') || 0;

    return {
      total_revenue: totalRevenue,
      operating_expenses: operatingExpenses,
      bed_count: dealInfo.bed_count || getNum('licensed_beds') || getNum('bed_count') || getNum('no_of_beds') || 0,
      current_census: dealInfo.current_census || getNum('current_census') || getNum('average_census') || 0,

      // Specific line items - try multiple paths
      management_fees: getNum('administrative.management_fees') ||
        getNum('expense_detail.administrative.management_fees') ||
        getNum('expenses.management_fees') ||
        getNum('management_fee') || 0,

      administrative_allocation: getNum('administrative.corporate_allocation') ||
        getNum('administrative.allocated_overhead') ||
        getNum('expense_detail.administrative.corporate_allocation') ||
        getNum('expenses.corporate_overhead') || 0,

      property_insurance: getNum('fixed_costs.property_insurance') ||
        getNum('expense_detail.plant_operations.insurance') ||
        getNum('expenses.insurance') ||
        getNum('insurance_expense') || 0,

      rent_expense: getNum('fixed_costs.rent_expense') ||
        getNum('current_rent_lease_expense') ||
        getNum('expenses.rent') ||
        getNum('rent') || 0,

      professional_fees: getNum('administrative.professional_fees') ||
        getNum('expense_detail.administrative.professional_fees') ||
        getNum('expenses.professional_fees') ||
        getNum('legal_accounting') || 0,

      bad_debt: getNum('administrative.bad_debt') ||
        getNum('expense_detail.administrative.bad_debt') ||
        getNum('expenses.bad_debt') ||
        getNum('bad_debt_expense') || 0,

      agency_staffing: getNum('direct_care.agency_staffing') ||
        getNum('expense_detail.direct_care.agency_staffing') ||
        getNum('expenses.agency_staffing') || 0,

      total_labor_cost: getNum('expense_ratios.total_labor_cost') ||
        getNum('total_labor_cost') ||
        getNum('direct_care.total') || 0,

      depreciation: getNum('fixed_costs.depreciation') ||
        getNum('expense_detail.non_operating.depreciation') ||
        getNum('expenses.depreciation') || 0,

      amortization: getNum('fixed_costs.amortization') ||
        getNum('expense_detail.non_operating.amortization') ||
        getNum('expenses.amortization') || 0,

      interest: getNum('fixed_costs.interest_expense') ||
        getNum('expense_detail.non_operating.interest_expense') ||
        getNum('expenses.interest') || 0,

      net_income: getNum('net_income') ||
        getNum('net_operating_income') || 0,

      ebitda: getNum('ebitda') ||
        getNum('t12m_ebitda') || 0,

      ebitdar: getNum('ebitdar') ||
        getNum('t12m_ebitdar') || 0,

      // Quality notes for one-time detection
      data_quality_notes: data.data_quality_notes || [],
      key_observations: data.key_observations || [],

      // Expense ratios if available
      expense_ratios: data.expense_ratios || {},

      // Market estimate for rent (if available)
      market_rent_estimate: dealInfo.market_rent_estimate || null
    };
  }

  /**
   * Normalize management fees to market rate
   *
   * @param {number} currentFee - Current management fee expense
   * @param {number} revenue - Total revenue for percentage calculation
   * @param {boolean} isRelatedParty - Whether fee is to related party
   * @returns {Adjustment|null} Adjustment object or null if no adjustment needed
   */
  static normalizeManagementFee(currentFee, revenue, isRelatedParty) {
    if (!currentFee || currentFee <= 0 || !revenue || revenue <= 0) {
      return null;
    }

    const currentPct = currentFee / revenue;
    const marketPct = NORMALIZATION_CONFIG.benchmarks.management_fee_pct;
    const maxPct = NORMALIZATION_CONFIG.benchmarks.management_fee_max_pct;
    const marketValue = revenue * marketPct;

    // Only adjust if above market AND (related party OR significantly above market)
    if (currentPct <= maxPct && !isRelatedParty) {
      return null;
    }

    if (currentPct <= marketPct) {
      return null;
    }

    const adjustment = currentFee - marketValue;

    // Determine confidence level
    let confidence = 'medium';
    if (isRelatedParty && currentPct > maxPct) {
      confidence = 'high';
    } else if (currentPct > 0.07) {
      confidence = 'high'; // >7% is clearly above market
    }

    return {
      category: 'management_fee',
      line_item: 'administrative.management_fees',
      description: isRelatedParty
        ? 'Related party management fee adjusted to market rate'
        : 'Management fee adjusted to market rate',
      current_value: currentFee,
      market_value: marketValue,
      adjustment: Math.round(adjustment),
      is_related_party: isRelatedParty,
      confidence,
      rationale: `Current: ${(currentPct * 100).toFixed(1)}% of revenue ($${currentFee.toLocaleString()}) ` +
        `vs Market: ${(marketPct * 100).toFixed(1)}% ($${Math.round(marketValue).toLocaleString()}). ` +
        `${isRelatedParty ? 'Related party transaction requires market rate adjustment.' : 'Above-market fee normalized.'}`
    };
  }

  /**
   * Normalize allocated corporate overhead
   *
   * @param {number} currentValue - Current allocated overhead
   * @param {number} revenue - Total revenue
   * @param {boolean} isRelatedParty - Whether allocation is from related party
   * @returns {Adjustment|null}
   */
  static normalizeAllocatedOverhead(currentValue, revenue, isRelatedParty) {
    if (!currentValue || currentValue <= 0 || !revenue || revenue <= 0) {
      return null;
    }

    const currentPct = currentValue / revenue;
    const marketPct = NORMALIZATION_CONFIG.benchmarks.admin_allocation_pct;
    const maxPct = NORMALIZATION_CONFIG.benchmarks.admin_allocation_max_pct;

    // Only flag if above threshold and related party
    if (currentPct <= maxPct && !isRelatedParty) {
      return null;
    }

    if (currentPct <= marketPct) {
      return null;
    }

    const marketValue = revenue * marketPct;
    const adjustment = currentValue - marketValue;

    return {
      category: 'corporate_allocation',
      line_item: 'administrative.corporate_allocation',
      description: 'Corporate/administrative allocation adjusted to market rate',
      current_value: currentValue,
      market_value: marketValue,
      adjustment: Math.round(adjustment),
      is_related_party: isRelatedParty,
      confidence: isRelatedParty ? 'high' : 'medium',
      rationale: `Current allocation: ${(currentPct * 100).toFixed(1)}% of revenue ($${currentValue.toLocaleString()}) ` +
        `vs Market benchmark: ${(marketPct * 100).toFixed(1)}% ($${Math.round(marketValue).toLocaleString()}). ` +
        `${isRelatedParty ? 'Related party allocation normalized to third-party equivalent.' : ''}`
    };
  }

  /**
   * Normalize property insurance to per-bed benchmark
   *
   * @param {number} currentValue - Current insurance expense
   * @param {number} bedCount - Number of licensed beds
   * @returns {Adjustment|null}
   */
  static normalizePropertyInsurance(currentValue, bedCount) {
    if (!currentValue || currentValue <= 0 || !bedCount || bedCount <= 0) {
      return null;
    }

    const benchmarkPerBed = NORMALIZATION_CONFIG.benchmarks.property_insurance_per_bed;
    const varianceThreshold = NORMALIZATION_CONFIG.benchmarks.property_insurance_variance;
    const marketValue = bedCount * benchmarkPerBed;
    const currentPerBed = currentValue / bedCount;

    const variance = (currentValue - marketValue) / marketValue;

    // Only adjust if significantly above benchmark
    if (variance <= varianceThreshold) {
      return null;
    }

    const adjustment = currentValue - marketValue;

    return {
      category: 'property_insurance',
      line_item: 'fixed_costs.property_insurance',
      description: 'Property insurance adjusted to market per-bed rate',
      current_value: currentValue,
      market_value: marketValue,
      adjustment: Math.round(adjustment),
      is_related_party: false,
      confidence: variance > 0.5 ? 'high' : 'medium',
      rationale: `Current: $${Math.round(currentPerBed).toLocaleString()}/bed ($${currentValue.toLocaleString()} total) ` +
        `vs Market: $${benchmarkPerBed.toLocaleString()}/bed ($${Math.round(marketValue).toLocaleString()} total). ` +
        `${(variance * 100).toFixed(0)}% above benchmark for ${bedCount} beds.`
    };
  }

  /**
   * Normalize rent expense for related party or above-market situations
   *
   * @param {number} currentRent - Current rent expense
   * @param {number} revenue - Total revenue
   * @param {boolean} isRelatedParty - Whether rent is to related party
   * @param {number|null} marketEstimate - External market rent estimate if available
   * @returns {Adjustment|null}
   */
  static normalizeRentExpense(currentRent, revenue, isRelatedParty, marketEstimate = null) {
    if (!currentRent || currentRent <= 0 || !revenue || revenue <= 0) {
      return null;
    }

    const currentPct = currentRent / revenue;
    const marketPct = NORMALIZATION_CONFIG.benchmarks.rent_pct_of_revenue;
    const maxPct = NORMALIZATION_CONFIG.benchmarks.rent_pct_max;

    // Use market estimate if provided, otherwise use percentage benchmark
    let marketValue = marketEstimate || (revenue * marketPct);

    // Determine if adjustment is needed
    const needsAdjustment = (isRelatedParty && currentPct > marketPct) ||
                           (currentPct > maxPct);

    if (!needsAdjustment) {
      return null;
    }

    // If no market estimate and it's related party, use market percentage
    if (!marketEstimate && isRelatedParty) {
      marketValue = revenue * marketPct;
    }

    const adjustment = currentRent - marketValue;

    if (adjustment <= 0) {
      return null;
    }

    return {
      category: 'rent_expense',
      line_item: 'fixed_costs.rent_expense',
      description: isRelatedParty
        ? 'Related party rent adjusted to market rate'
        : 'Above-market rent expense normalized',
      current_value: currentRent,
      market_value: marketValue,
      adjustment: Math.round(adjustment),
      is_related_party: isRelatedParty,
      confidence: marketEstimate ? 'high' : 'medium',
      rationale: `Current rent: ${(currentPct * 100).toFixed(1)}% of revenue ($${currentRent.toLocaleString()}) ` +
        `vs ${marketEstimate ? 'Market estimate' : 'Benchmark'}: ${(marketValue / revenue * 100).toFixed(1)}% ` +
        `($${Math.round(marketValue).toLocaleString()}). ` +
        `${isRelatedParty ? 'Related party lease requires market adjustment for buyer.' : ''}`
    };
  }

  /**
   * Detect and quantify one-time/non-recurring items
   *
   * @param {Object} extractedData - Full extracted data
   * @param {Object} metrics - Extracted metrics
   * @returns {Adjustment[]} Array of one-time item adjustments
   */
  static detectOneTimeItems(extractedData, metrics) {
    const adjustments = [];
    const keywords = NORMALIZATION_CONFIG.oneTimeKeywords;

    // Check data quality notes for one-time mentions
    const notes = [
      ...(metrics.data_quality_notes || []),
      ...(metrics.key_observations || [])
    ];

    const processedNotes = new Set(); // Avoid duplicates

    for (const note of notes) {
      if (!note || processedNotes.has(note)) continue;
      processedNotes.add(note);

      const noteLower = (note || '').toLowerCase();

      for (const keyword of keywords) {
        if (noteLower.includes(keyword)) {
          // Try to extract amount from the note
          const amountMatch = note.match(/\$?([\d,]+(?:\.\d{2})?)/);
          let amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

          // Categorize the one-time item
          let category = 'one_time_other';
          let description = 'One-time item identified';

          if (noteLower.includes('ppp') || noteLower.includes('paycheck protection') ||
              noteLower.includes('covid') || noteLower.includes('ertc') ||
              noteLower.includes('relief') || noteLower.includes('cares')) {
            category = 'one_time_covid_relief';
            description = 'COVID-related relief/grant income';
            // COVID relief is income, so adjustment reduces EBITDA
            if (amount) amount = -amount;
          } else if (noteLower.includes('settlement') || noteLower.includes('litigation') ||
                     noteLower.includes('lawsuit')) {
            category = 'one_time_legal';
            description = 'Legal settlement/litigation expense';
          } else if (noteLower.includes('severance') || noteLower.includes('restructuring')) {
            category = 'one_time_restructuring';
            description = 'Restructuring/severance expense';
          } else if (noteLower.includes('gain on sale') || noteLower.includes('loss on sale')) {
            category = 'one_time_asset_sale';
            description = 'Gain/loss on asset disposition';
            // Gain would be negative adjustment, loss positive
          } else if (noteLower.includes('insurance recovery')) {
            category = 'one_time_insurance';
            description = 'Insurance recovery (non-recurring)';
            if (amount) amount = -amount; // Recovery is income
          }

          if (amount && Math.abs(amount) > 1000) { // Only include material items
            adjustments.push({
              category,
              line_item: 'one_time_items',
              description,
              current_value: Math.abs(amount),
              market_value: 0,
              adjustment: Math.round(amount),
              is_related_party: false,
              confidence: 'medium',
              rationale: `Identified from notes: "${note.substring(0, 100)}${note.length > 100 ? '...' : ''}". ` +
                `Non-recurring item should be excluded from normalized operations.`
            });
          }

          break; // Only match first keyword per note
        }
      }
    }

    // Check for PPP/COVID in revenue specifically
    const pppIncome = this.findValue(extractedData, ['ppp_income', 'covid_relief', 'ertc_credit', 'provider_relief']);
    if (pppIncome && pppIncome > 0) {
      // Check we haven't already captured this
      const alreadyCaptured = adjustments.some(a =>
        a.category === 'one_time_covid_relief' && Math.abs(a.current_value - pppIncome) < 100
      );

      if (!alreadyCaptured) {
        adjustments.push({
          category: 'one_time_covid_relief',
          line_item: 'revenue.covid_relief',
          description: 'COVID relief/PPP income (non-recurring)',
          current_value: pppIncome,
          market_value: 0,
          adjustment: Math.round(-pppIncome), // Negative because it inflates EBITDA
          is_related_party: false,
          confidence: 'high',
          rationale: `PPP/ERTC/Provider Relief income of $${pppIncome.toLocaleString()} is one-time ` +
            `government assistance that will not recur. Normalizing to show sustainable operations.`
        });
      }
    }

    return adjustments;
  }

  /**
   * Normalize professional fees
   *
   * @param {number} currentValue - Current professional fees
   * @param {number} revenue - Total revenue
   * @param {boolean} isRelatedParty - Whether fees go to related party
   * @returns {Adjustment|null}
   */
  static normalizeProfessionalFees(currentValue, revenue, isRelatedParty) {
    if (!currentValue || currentValue <= 0 || !revenue || revenue <= 0) {
      return null;
    }

    const currentPct = currentValue / revenue;
    const marketPct = NORMALIZATION_CONFIG.benchmarks.professional_fees_pct;
    const maxPct = NORMALIZATION_CONFIG.benchmarks.professional_fees_max_pct;

    // Only adjust if significantly above market or related party
    if (currentPct <= maxPct && !isRelatedParty) {
      return null;
    }

    if (currentPct <= marketPct) {
      return null;
    }

    const marketValue = revenue * marketPct;
    const adjustment = currentValue - marketValue;

    return {
      category: 'professional_fees',
      line_item: 'administrative.professional_fees',
      description: isRelatedParty
        ? 'Related party professional fees adjusted to market'
        : 'Above-market professional fees normalized',
      current_value: currentValue,
      market_value: marketValue,
      adjustment: Math.round(adjustment),
      is_related_party: isRelatedParty,
      confidence: 'medium',
      rationale: `Current: ${(currentPct * 100).toFixed(2)}% of revenue ($${currentValue.toLocaleString()}) ` +
        `vs Market: ${(marketPct * 100).toFixed(2)}% ($${Math.round(marketValue).toLocaleString()}). ` +
        `${isRelatedParty ? 'Related party consulting/professional services normalized.' : ''}`
    };
  }

  /**
   * Analyze bad debt for unusual spikes
   *
   * @param {number} badDebt - Bad debt expense
   * @param {number} revenue - Total revenue
   * @returns {Adjustment|null}
   */
  static analyzeBadDebt(badDebt, revenue) {
    if (!badDebt || badDebt <= 0 || !revenue || revenue <= 0) {
      return null;
    }

    const currentPct = badDebt / revenue;
    const normalPct = NORMALIZATION_CONFIG.benchmarks.bad_debt_pct;
    const spikePct = NORMALIZATION_CONFIG.benchmarks.bad_debt_spike_threshold;

    // Only flag if above spike threshold
    if (currentPct <= spikePct) {
      return null;
    }

    const normalValue = revenue * normalPct;
    const adjustment = badDebt - normalValue;

    return {
      category: 'bad_debt_spike',
      line_item: 'administrative.bad_debt',
      description: 'Unusual bad debt spike normalized to historical average',
      current_value: badDebt,
      market_value: normalValue,
      adjustment: Math.round(adjustment),
      is_related_party: false,
      confidence: currentPct > 0.06 ? 'high' : 'medium',
      rationale: `Current bad debt: ${(currentPct * 100).toFixed(1)}% of revenue ($${badDebt.toLocaleString()}) ` +
        `vs Normal: ${(normalPct * 100).toFixed(1)}% ($${Math.round(normalValue).toLocaleString()}). ` +
        `Elevated bad debt may be temporary and not reflective of go-forward operations.`
    };
  }

  /**
   * Normalize agency staffing costs
   *
   * @param {number} agencyStaffing - Current agency staffing expense
   * @param {number} totalLabor - Total labor cost
   * @param {number} revenue - Total revenue
   * @returns {Adjustment|null}
   */
  static normalizeAgencyStaffing(agencyStaffing, totalLabor, revenue) {
    if (!agencyStaffing || agencyStaffing <= 0) {
      return null;
    }

    // Calculate as percentage of labor or revenue
    let currentPct, targetPct, marketValue;

    if (totalLabor && totalLabor > 0) {
      currentPct = agencyStaffing / totalLabor;
      targetPct = NORMALIZATION_CONFIG.benchmarks.agency_pct_of_labor;
      marketValue = totalLabor * targetPct;
    } else if (revenue && revenue > 0) {
      // Fall back to revenue-based calculation
      currentPct = agencyStaffing / revenue;
      targetPct = 0.02; // 2% of revenue as fallback
      marketValue = revenue * targetPct;
    } else {
      return null;
    }

    const criticalPct = NORMALIZATION_CONFIG.benchmarks.agency_pct_critical;

    // Only adjust if above critical threshold
    if (currentPct <= criticalPct) {
      return null;
    }

    const adjustment = agencyStaffing - marketValue;

    if (adjustment <= 0) {
      return null;
    }

    return {
      category: 'agency_staffing',
      line_item: 'direct_care.agency_staffing',
      description: 'Excessive agency staffing normalized to target rate',
      current_value: agencyStaffing,
      market_value: marketValue,
      adjustment: Math.round(adjustment),
      is_related_party: false,
      confidence: currentPct > 0.15 ? 'high' : 'medium',
      rationale: `Current agency: ${(currentPct * 100).toFixed(1)}% of ${totalLabor > 0 ? 'labor' : 'revenue'} ` +
        `($${agencyStaffing.toLocaleString()}) vs Target: ${(targetPct * 100).toFixed(1)}% ` +
        `($${Math.round(marketValue).toLocaleString()}). High agency indicates staffing instability ` +
        `that should stabilize under new management.`
    };
  }

  /**
   * Detect owner benefits and perks
   *
   * @param {Object} extractedData - Full extracted data
   * @returns {Adjustment[]}
   */
  static detectOwnerBenefits(extractedData) {
    const adjustments = [];
    const keywords = NORMALIZATION_CONFIG.ownerBenefitKeywords;

    // Look for owner-related expenses in data quality notes
    const notes = [
      ...(extractedData.data_quality_notes || []),
      ...(extractedData.key_observations || [])
    ];

    for (const note of notes) {
      const noteLower = (note || '').toLowerCase();

      for (const keyword of keywords) {
        if (noteLower.includes(keyword) &&
            (noteLower.includes('owner') || noteLower.includes('personal'))) {

          const amountMatch = note.match(/\$?([\d,]+(?:\.\d{2})?)/);
          const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

          if (amount && amount > 500) {
            adjustments.push({
              category: 'owner_benefit',
              line_item: 'administrative.owner_benefits',
              description: `Owner benefit/perk: ${keyword}`,
              current_value: amount,
              market_value: 0,
              adjustment: Math.round(amount),
              is_related_party: true,
              confidence: 'medium',
              rationale: `Owner benefit identified: "${note.substring(0, 80)}${note.length > 80 ? '...' : ''}". ` +
                `Personal expenses run through facility should be added back to normalized EBITDA.`
            });
            break;
          }
        }
      }
    }

    return adjustments;
  }

  /**
   * Generate flags for due diligence attention
   *
   * @param {Adjustment[]} adjustments - All adjustments made
   * @param {Object} metrics - Financial metrics
   * @returns {NormalizationFlag[]}
   */
  static generateFlags(adjustments, metrics) {
    const flags = [];

    // Related party flag
    const relatedPartyAdj = adjustments.filter(a => a.is_related_party);
    if (relatedPartyAdj.length > 0) {
      const total = relatedPartyAdj.reduce((sum, a) => sum + a.adjustment, 0);
      const pctOfRevenue = metrics.total_revenue > 0 ? (total / metrics.total_revenue * 100) : 0;

      flags.push({
        type: 'related_party',
        severity: total > 100000 || pctOfRevenue > 2 ? 'high' : 'medium',
        count: relatedPartyAdj.length,
        total_impact: Math.round(total),
        message: `${relatedPartyAdj.length} related party transaction(s) totaling ` +
          `$${Math.round(total).toLocaleString()} (${pctOfRevenue.toFixed(1)}% of revenue) require market rate adjustment.`
      });
    }

    // One-time items flag
    const oneTimeAdj = adjustments.filter(a => a.category.startsWith('one_time'));
    if (oneTimeAdj.length > 0) {
      const total = oneTimeAdj.reduce((sum, a) => sum + Math.abs(a.adjustment), 0);

      flags.push({
        type: 'one_time_items',
        severity: total > 50000 ? 'high' : 'medium',
        count: oneTimeAdj.length,
        total_impact: Math.round(total),
        message: `${oneTimeAdj.length} one-time/non-recurring item(s) with ` +
          `$${Math.round(total).toLocaleString()} total impact on normalized EBITDA.`
      });
    }

    // COVID relief specific flag
    const covidAdj = adjustments.filter(a => a.category === 'one_time_covid_relief');
    if (covidAdj.length > 0) {
      const total = covidAdj.reduce((sum, a) => sum + Math.abs(a.adjustment), 0);

      flags.push({
        type: 'covid_relief',
        severity: 'high',
        count: covidAdj.length,
        total_impact: Math.round(total),
        message: `COVID relief income of $${Math.round(total).toLocaleString()} identified. ` +
          `This government assistance will not recur and materially impacts normalized performance.`
      });
    }

    // Above-market expenses flag
    const aboveMarket = adjustments.filter(a =>
      !a.is_related_party && !a.category.startsWith('one_time') && a.adjustment > 0
    );
    if (aboveMarket.length > 0) {
      const total = aboveMarket.reduce((sum, a) => sum + a.adjustment, 0);

      flags.push({
        type: 'above_market',
        severity: total > 75000 ? 'high' : 'low',
        count: aboveMarket.length,
        total_impact: Math.round(total),
        message: `${aboveMarket.length} expense category(ies) running above market benchmarks. ` +
          `Potential for $${Math.round(total).toLocaleString()} in operational improvements.`
      });
    }

    // Total adjustment magnitude flag
    const totalAdjustment = adjustments.reduce((sum, a) => sum + a.adjustment, 0);
    if (metrics.total_revenue > 0) {
      const pctOfRevenue = Math.abs(totalAdjustment) / metrics.total_revenue * 100;

      if (pctOfRevenue > 5) {
        flags.push({
          type: 'high_adjustment_magnitude',
          severity: pctOfRevenue > 10 ? 'high' : 'medium',
          count: adjustments.length,
          total_impact: Math.round(Math.abs(totalAdjustment)),
          message: `Total normalizing adjustments of $${Math.round(Math.abs(totalAdjustment)).toLocaleString()} ` +
            `represent ${pctOfRevenue.toFixed(1)}% of revenue. Significant difference between reported and normalized performance.`
        });
      }
    }

    return flags;
  }

  /**
   * Calculate summary metrics
   *
   * @param {Adjustment[]} adjustments - All adjustments
   * @param {Object} metrics - Financial metrics
   * @returns {Object} Summary object
   */
  static calculateSummary(adjustments, metrics) {
    const totalAdjustments = adjustments.reduce((sum, a) => sum + a.adjustment, 0);

    // Calculate current EBITDA
    const depreciation = metrics.depreciation || 0;
    const amortization = metrics.amortization || 0;
    const interest = metrics.interest || 0;
    const netIncome = metrics.net_income || 0;

    // Use provided EBITDA if available, otherwise calculate
    let currentEbitda = metrics.ebitda;
    if (!currentEbitda || currentEbitda === 0) {
      if (metrics.operating_expenses > 0 && metrics.total_revenue > 0) {
        currentEbitda = metrics.total_revenue - metrics.operating_expenses + depreciation + amortization;
      } else {
        currentEbitda = netIncome + interest + depreciation + amortization;
      }
    }

    const normalizedEbitda = currentEbitda + totalAdjustments;

    // EBITDAR adds back rent
    const rentExpense = metrics.rent_expense || 0;
    const rentAdjustment = adjustments.find(a => a.category === 'rent_expense')?.adjustment || 0;

    // Use provided EBITDAR if available
    let currentEbitdar = metrics.ebitdar;
    if (!currentEbitdar || currentEbitdar === 0) {
      currentEbitdar = currentEbitda + rentExpense;
    }

    const normalizedEbitdar = normalizedEbitda + (rentExpense - rentAdjustment);

    // Margins
    const currentEbitdaMargin = metrics.total_revenue > 0
      ? (currentEbitda / metrics.total_revenue * 100) : 0;
    const normalizedEbitdaMargin = metrics.total_revenue > 0
      ? (normalizedEbitda / metrics.total_revenue * 100) : 0;

    // Categorize adjustments
    const relatedPartyTotal = adjustments
      .filter(a => a.is_related_party)
      .reduce((sum, a) => sum + a.adjustment, 0);

    const oneTimeTotal = adjustments
      .filter(a => a.category.startsWith('one_time'))
      .reduce((sum, a) => sum + a.adjustment, 0);

    const otherTotal = adjustments
      .filter(a => !a.is_related_party && !a.category.startsWith('one_time'))
      .reduce((sum, a) => sum + a.adjustment, 0);

    return {
      total_adjustments: Math.round(totalAdjustments),
      adjustment_count: adjustments.length,

      current_ebitda: Math.round(currentEbitda),
      normalized_ebitda: Math.round(normalizedEbitda),
      ebitda_improvement: Math.round(totalAdjustments),

      current_ebitdar: Math.round(currentEbitdar),
      normalized_ebitdar: Math.round(normalizedEbitdar),

      current_ebitda_margin: parseFloat(currentEbitdaMargin.toFixed(1)),
      normalized_ebitda_margin: parseFloat(normalizedEbitdaMargin.toFixed(1)),
      margin_improvement: parseFloat((normalizedEbitdaMargin - currentEbitdaMargin).toFixed(1)),

      // Breakdown by category
      related_party_adjustments: Math.round(relatedPartyTotal),
      one_time_adjustments: Math.round(oneTimeTotal),
      other_adjustments: Math.round(otherTotal),

      // Reference metrics
      total_revenue: Math.round(metrics.total_revenue),
      bed_count: metrics.bed_count
    };
  }

  /**
   * Build detailed breakdown by adjustment category
   *
   * @param {Adjustment[]} adjustments
   * @returns {Object}
   */
  static buildDetailedBreakdown(adjustments) {
    const breakdown = {
      related_party: [],
      one_time: [],
      above_market: [],
      owner_benefits: []
    };

    for (const adj of adjustments) {
      if (adj.category === 'owner_benefit') {
        breakdown.owner_benefits.push({
          item: adj.description,
          amount: adj.adjustment,
          rationale: adj.rationale
        });
      } else if (adj.is_related_party) {
        breakdown.related_party.push({
          item: adj.description,
          current: adj.current_value,
          normalized: adj.market_value,
          adjustment: adj.adjustment,
          rationale: adj.rationale
        });
      } else if (adj.category.startsWith('one_time')) {
        breakdown.one_time.push({
          item: adj.description,
          amount: Math.abs(adj.adjustment),
          direction: adj.adjustment > 0 ? 'add_back' : 'subtract',
          rationale: adj.rationale
        });
      } else {
        breakdown.above_market.push({
          item: adj.description,
          current: adj.current_value,
          benchmark: adj.market_value,
          savings: adj.adjustment,
          rationale: adj.rationale
        });
      }
    }

    return breakdown;
  }

  /**
   * Detect if a line item involves related party
   *
   * @param {Object} extractedData - Full extracted data
   * @param {string} lineItem - Line item to check
   * @returns {boolean}
   */
  static detectRelatedParty(extractedData, lineItem) {
    const keywords = NORMALIZATION_CONFIG.relatedPartyKeywords;
    const notes = [
      ...(extractedData.data_quality_notes || []),
      ...(extractedData.key_observations || [])
    ];

    // Check notes for related party mentions
    for (const note of notes) {
      const noteLower = (note || '').toLowerCase();
      const lineItemLower = lineItem.toLowerCase();

      // If note mentions this line item and has related party keyword
      if (noteLower.includes(lineItemLower.replace(/_/g, ' ')) ||
          noteLower.includes(lineItemLower.replace(/_/g, ''))) {
        for (const keyword of keywords) {
          if (noteLower.includes(keyword)) {
            return true;
          }
        }
      }

      // Check for explicit related party mention
      if (noteLower.includes('related party') || noteLower.includes('related-party') ||
          noteLower.includes('intercompany') || noteLower.includes('affiliate')) {
        if (noteLower.includes('management') && lineItem.includes('management')) return true;
        if (noteLower.includes('rent') && lineItem.includes('rent')) return true;
        if (noteLower.includes('allocation') && lineItem.includes('allocation')) return true;
      }
    }

    // Check for allocated keyword in the line item itself
    if (lineItem.toLowerCase().includes('allocated') ||
        lineItem.toLowerCase().includes('intercompany')) {
      return true;
    }

    return false;
  }

  /**
   * Helper to find a value in nested object by multiple possible paths
   *
   * @param {Object} data - Data object to search
   * @param {string[]} paths - Array of possible paths/keys
   * @returns {number|null}
   */
  static findValue(data, paths) {
    for (const path of paths) {
      const parts = path.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (typeof value === 'number' && value > 0) return value;
      if (typeof value === 'string') {
        const num = parseFloat(value.replace(/[,$]/g, ''));
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return null;
  }

  /**
   * Generate a human-readable normalization report
   *
   * @param {NormalizationResult} result - Normalization result
   * @returns {string} Formatted report
   */
  static generateReport(result) {
    if (!result || !result.summary) {
      return 'Normalization not performed or no results available.';
    }

    const { summary, adjustments, flags } = result;
    let report = '=== NORMALIZATION SUMMARY ===\n\n';

    // Summary section
    report += `Total Revenue: $${summary.total_revenue?.toLocaleString() || 'N/A'}\n`;
    report += `Beds: ${summary.bed_count || 'N/A'}\n\n`;

    report += `Current EBITDA: $${summary.current_ebitda?.toLocaleString() || 'N/A'} `;
    report += `(${summary.current_ebitda_margin}% margin)\n`;
    report += `Normalized EBITDA: $${summary.normalized_ebitda?.toLocaleString() || 'N/A'} `;
    report += `(${summary.normalized_ebitda_margin}% margin)\n`;
    report += `Improvement: $${summary.ebitda_improvement?.toLocaleString() || 'N/A'} `;
    report += `(+${summary.margin_improvement}% margin)\n\n`;

    // Adjustments breakdown
    if (adjustments && adjustments.length > 0) {
      report += `=== ADJUSTMENTS (${adjustments.length} items) ===\n\n`;

      for (const adj of adjustments) {
        report += `${adj.description}\n`;
        report += `  Current: $${adj.current_value?.toLocaleString()}\n`;
        report += `  Market: $${adj.market_value?.toLocaleString()}\n`;
        report += `  Adjustment: $${adj.adjustment?.toLocaleString()}\n`;
        report += `  Confidence: ${adj.confidence}\n`;
        report += `  ${adj.rationale}\n\n`;
      }
    }

    // Flags
    if (flags && flags.length > 0) {
      report += '=== FLAGS FOR DUE DILIGENCE ===\n\n';
      for (const flag of flags) {
        report += `[${flag.severity.toUpperCase()}] ${flag.type}: ${flag.message}\n`;
      }
    }

    return report;
  }
}

// ============================================================================
// LEGACY API COMPATIBILITY
// ============================================================================
// The following functions maintain backward compatibility with existing code
// that uses the old functional API

/**
 * Legacy: Calculate normalized metrics for a deal
 * @param {Object} deal - Deal object with extraction_data
 * @returns {Object} Normalized metrics
 * @deprecated Use NormalizationService.normalize() instead
 */
function calculateNormalizedMetrics(deal) {
  const extractionData = deal.extraction_data || {};

  // Call new service
  const result = NormalizationService.normalize(extractionData, {
    bed_count: parseInt(deal.bed_count) || 0,
    total_revenue: parseFloat(deal.annual_revenue) || parseFloat(extractionData.t12m_revenue) || 0
  });

  // Map to legacy format
  const revenue = parseFloat(deal.annual_revenue) || parseFloat(extractionData.t12m_revenue) || 0;
  const purchasePrice = parseFloat(deal.purchase_price) || 0;

  return {
    reported_ebitda: result.summary.current_ebitda,
    reported_ebitdar: result.summary.current_ebitdar,
    ebitda: result.summary.normalized_ebitda,
    ebitdar: result.summary.normalized_ebitdar,
    ebitda_margin: result.summary.normalized_ebitda_margin,
    ebitdar_margin: revenue > 0 ? parseFloat((result.summary.normalized_ebitdar / revenue * 100).toFixed(2)) : null,
    ebitda_multiple: result.summary.normalized_ebitda > 0 && purchasePrice > 0
      ? parseFloat((purchasePrice / result.summary.normalized_ebitda).toFixed(2))
      : null,
    ebitdar_multiple: result.summary.normalized_ebitdar > 0 && purchasePrice > 0
      ? parseFloat((purchasePrice / result.summary.normalized_ebitdar).toFixed(2))
      : null,
    cap_rate: result.summary.normalized_ebitda > 0 && purchasePrice > 0
      ? parseFloat((result.summary.normalized_ebitda / purchasePrice * 100).toFixed(2))
      : null,
    adjustments: result.adjustments.map(adj => ({
      name: adj.description,
      description: adj.rationale,
      current_value: Math.round(adj.current_value),
      target_value: Math.round(adj.market_value),
      adjustment_amount: Math.round(adj.adjustment),
      current_pct: null,
      target_pct: null
    })),
    total_adjustment: result.summary.total_adjustments,
    adjustment_pct_of_revenue: revenue > 0
      ? parseFloat((result.summary.total_adjustments / revenue * 100).toFixed(2))
      : null,
    adjustment_count: result.summary.adjustment_count
  };
}

/**
 * Legacy: Generate benchmark flags
 * @param {Object} deal - Deal object
 * @returns {Array} Benchmark flags
 * @deprecated Use NormalizationService.normalize().flags instead
 */
function generateBenchmarkFlags(deal) {
  const extractionData = deal.extraction_data || {};
  const result = NormalizationService.normalize(extractionData, {
    bed_count: parseInt(deal.bed_count) || 0,
    total_revenue: parseFloat(deal.annual_revenue) || 0
  });

  return result.flags.map(flag => ({
    metric: flag.type,
    label: flag.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    actual: flag.total_impact,
    target: 0,
    status: flag.severity === 'high' ? 'critical' : flag.severity === 'medium' ? 'warning' : 'good',
    variance: flag.total_impact,
    message: flag.message
  }));
}

/**
 * Legacy: Format expense ratios
 * @param {Object} deal - Deal object
 * @returns {Object} Formatted ratios
 */
function formatExpenseRatios(deal) {
  const ratios = extractExpenseRatios(deal);
  return {
    labor_pct: ratios.labor_pct !== null ? parseFloat(ratios.labor_pct.toFixed(1)) : null,
    agency_pct: ratios.agency_pct !== null ? parseFloat(ratios.agency_pct.toFixed(1)) : null,
    food_cost_per_day: ratios.food_cost_per_day !== null ? parseFloat(ratios.food_cost_per_day.toFixed(2)) : null,
    management_fee_pct: ratios.management_fee_pct !== null ? parseFloat(ratios.management_fee_pct.toFixed(1)) : null,
    bad_debt_pct: ratios.bad_debt_pct !== null ? parseFloat(ratios.bad_debt_pct.toFixed(1)) : null,
    utilities_pct: ratios.utilities_pct !== null ? parseFloat(ratios.utilities_pct.toFixed(1)) : null,
  };
}

/**
 * Legacy: Extract expense ratios from deal
 * Checks both nested expense_ratios object AND flat extraction_data fields
 * @param {Object} deal - Deal object
 * @returns {Object} Expense ratios
 */
function extractExpenseRatios(deal) {
  const extractionData = deal.extraction_data || {};
  const expenseRatios = extractionData.expense_ratios || {};

  // Helper to get value from nested OR flat structure
  const getValue = (nestedKey, flatKey) => {
    // Try nested first (legacy), then flat (current extraction)
    return expenseRatios[nestedKey] || extractionData[flatKey || nestedKey] || null;
  };

  return {
    labor_pct: getValue('labor_pct_of_revenue', 'labor_pct_of_revenue'),
    total_labor_cost: getValue('total_labor_cost', 'total_labor_cost'),
    agency_pct: getValue('agency_pct_of_labor', 'agency_pct_of_labor'),
    agency_pct_of_direct_care: getValue('agency_pct_of_direct_care', 'agency_pct_of_direct_care'),
    food_cost_per_day: getValue('food_cost_per_resident_day', 'food_cost_per_resident_day'),
    food_pct: getValue('food_pct_of_revenue', 'food_pct_of_revenue'),
    management_fee_pct: getValue('management_fee_pct', 'management_fee_pct'),
    bad_debt_pct: getValue('bad_debt_pct', 'bad_debt_pct'),
    utilities_pct: getValue('utilities_pct_of_revenue', 'utilities_pct_of_revenue'),
    property_cost_per_bed: getValue('property_cost_per_bed', 'property_cost_per_bed'),
    insurance_pct: getValue('insurance_pct_of_revenue', 'insurance_pct_of_revenue'),
  };
}

/**
 * Legacy: Extract raw expense amounts
 * Checks both nested expense_detail object AND flat extraction_data fields
 * @param {Object} deal - Deal object
 * @returns {Object} Raw expenses
 */
function extractRawExpenses(deal) {
  const extractionData = deal.extraction_data || {};
  const expenseDetail = extractionData.expense_detail || {};

  const getValue = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'object' && 'value' in obj) return obj.value;
    return obj;
  };

  // Helper to get from nested OR flat structure
  const getExpenseValue = (nestedPath, flatKey) => {
    // Try nested first (legacy), then flat (current extraction)
    const nestedValue = getValue(nestedPath);
    if (nestedValue !== null) return nestedValue;
    return extractionData[flatKey] || null;
  };

  return {
    agency_staffing: getExpenseValue(expenseDetail.direct_care?.agency_staffing, 'agency_staffing'),
    direct_care_total: getExpenseValue(expenseDetail.direct_care?.total, 'direct_care_total'),
    nursing_wages: getExpenseValue(expenseDetail.direct_care?.nursing_wages, 'nursing_wages'),
    cna_wages: getExpenseValue(expenseDetail.direct_care?.cna_wages, 'cna_wages'),
    raw_food_cost: getExpenseValue(expenseDetail.culinary?.raw_food_cost, 'raw_food_cost'),
    dietary_wages: getExpenseValue(expenseDetail.culinary?.dietary_wages, 'dietary_wages'),
    culinary_total: getExpenseValue(expenseDetail.culinary?.total, 'culinary_total'),
    management_fees: getExpenseValue(expenseDetail.administrative?.management_fees, 'management_fees'),
    bad_debt: getExpenseValue(expenseDetail.administrative?.bad_debt, 'bad_debt'),
    admin_wages: getExpenseValue(expenseDetail.administrative?.admin_wages, 'admin_wages'),
    admin_total: getExpenseValue(expenseDetail.administrative?.total, 'admin_total'),
    utilities_total: getExpenseValue(expenseDetail.utilities?.total, 'utilities_total'),
    property_insurance: getExpenseValue(expenseDetail.plant_operations?.insurance, 'property_insurance'),
    repairs_maintenance: getExpenseValue(expenseDetail.plant_operations?.repairs_maintenance, 'repairs_maintenance'),
    interest_expense: getExpenseValue(expenseDetail.non_operating?.interest_expense, 'interest_expense'),
    depreciation: getExpenseValue(expenseDetail.non_operating?.depreciation, 'depreciation'),
  };
}

// Normalization targets for legacy compatibility
const NORMALIZATION_TARGETS = {
  labor_pct_of_revenue: 55,
  agency_pct_of_labor: 2,
  agency_pct_of_direct_care: 5,
  management_fee_pct: 4,
  bad_debt_pct: 1.5,
  utilities_pct: 3,
  food_cost_per_day: 10.50,
  food_pct_of_revenue: 4,
  rent_pct_of_revenue: 10,
};

const STATUS_THRESHOLDS = {
  labor_pct: { warning: 58, critical: 62 },
  agency_pct: { warning: 5, critical: 10 },
  management_fee_pct: { warning: 5, critical: 6 },
  bad_debt_pct: { warning: 2, critical: 3 },
  utilities_pct: { warning: 4, critical: 5 },
  food_cost_per_day: { warning: 12, critical: 15 },
};

module.exports = {
  // New class-based API
  NormalizationService,
  NORMALIZATION_CONFIG,

  // Legacy functional API
  calculateNormalizedMetrics,
  generateBenchmarkFlags,
  formatExpenseRatios,
  extractExpenseRatios,
  extractRawExpenses,
  NORMALIZATION_TARGETS,
  STATUS_THRESHOLDS,
};
