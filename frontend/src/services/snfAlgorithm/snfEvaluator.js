/**
 * SNF Deal Evaluation Algorithm
 * Based on Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm
 * Implements financial normalization, deal valuation, and market analysis
 */

// Cascadia benchmarks and targets
const CASCADIA_BENCHMARKS = {
  targetEBITDA: 0.09, // 9%
  targetEBITDAR: 0.23, // 23%
  maxBadDebt: 0.01, // <1%
  defaultCapRate: 0.125, // 12.5%
  publicREITYield: 0.09, // 9%
  privateREITYield: 0.10, // 10%
  minCoverageRatio: 1.4
};

// State-specific reimbursement rates (placeholder - would be from API)
const STATE_REIMBURSEMENT_RATES = {
  'WA': { medicare: 450, medicaid: 280 },
  'CA': { medicare: 480, medicaid: 320 },
  'TX': { medicare: 420, medicaid: 250 },
  'FL': { medicare: 440, medicaid: 270 },
  'NY': { medicare: 520, medicaid: 380 }
};

/**
 * Financial Normalizer - Maps raw financials to Cascadia's chart of accounts
 */
export class FinancialNormalizer {
  static normalizeFinancials(facility) {
    const totalBeds = this.getTotalBeds(facility);
    const t12mRevenue = facility.t12m_revenue || 0;
    const t12mEBITDA = this.calculateEBITDA(facility);
    const t12mEBITDAR = this.calculateEBITDAR(facility);
    const t12mOccupancy = this.calculateOccupancyRate(facility);
    const purchasePrice = facility.purchase_price || 0;

    const normalized = {
      ...facility,
      // Normalize to camelCase for consistency
      facilityId: facility.id,
      facilityName: facility.facility_name,
      facilityType: facility.facility_type,
      totalBeds,
      purchasePrice,
      // Revenue and financial metrics
      t12mRevenue,
      t12mEBITDA,
      t12mEBITDAR,
      t12mEBIT: this.calculateEBIT(facility),
      t12mOccupancy,
      // Calculated metrics
      pricePerBed: totalBeds > 0 ? purchasePrice / totalBeds : 0,
      occupancyRate: t12mOccupancy,
      revenuePerBed: totalBeds > 0 ? t12mRevenue / totalBeds : 0,
      // Performance comparison
      performance: {
        ebitdaVsTarget: t12mRevenue > 0 ? (t12mEBITDA / t12mRevenue) / CASCADIA_BENCHMARKS.targetEBITDA : 0,
        ebitdarVsTarget: t12mRevenue > 0 ? (t12mEBITDAR / t12mRevenue) / CASCADIA_BENCHMARKS.targetEBITDAR : 0,
        occupancyVsTarget: t12mOccupancy / 0.85,
        pricePerBedVsMarket: 1.0 // Placeholder - would compare to market
      },
      // Data quality flags
      hasActualData: !!(facility.t12m_ebitda && facility.t12m_ebitda !== 0),
      dataQuality: {
        ebitdaEstimated: !facility.t12m_ebitda || facility.t12m_ebitda === 0,
        ebitdarEstimated: !facility.t12m_ebitdar || facility.t12m_ebitdar === 0,
        occupancyEstimated: !facility.t12m_occupancy || facility.t12m_occupancy === 0,
        revenueEstimated: !facility.t12m_revenue || facility.t12m_revenue === 0
      },
      // Risk factors
      riskFactors: this.identifyRiskFactors(facility, t12mRevenue, t12mEBITDA, t12mOccupancy),
      // Proforma calculations
      proformaMetrics: this.calculateProformaMetrics(facility)
    };

    return normalized;
  }

  static identifyRiskFactors(facility, revenue, ebitda, occupancy) {
    const risks = [];

    // Negative EBITDA
    if (ebitda < 0) {
      risks.push({
        type: 'financial',
        severity: 'high',
        description: `Negative EBITDA ($${ebitda.toLocaleString()}) - facility is operating at a loss`
      });
    }

    // Low EBITDA margin
    if (revenue > 0 && ebitda > 0 && (ebitda / revenue) < CASCADIA_BENCHMARKS.targetEBITDA) {
      risks.push({
        type: 'financial',
        severity: 'medium',
        description: `EBITDA margin (${((ebitda / revenue) * 100).toFixed(1)}%) below target (${CASCADIA_BENCHMARKS.targetEBITDA * 100}%)`
      });
    }

    // Low occupancy
    if (occupancy < 0.75) {
      risks.push({
        type: 'operational',
        severity: 'high',
        description: `Low occupancy (${(occupancy * 100).toFixed(1)}%) - significant upside potential but operational risk`
      });
    } else if (occupancy < 0.85) {
      risks.push({
        type: 'operational',
        severity: 'medium',
        description: `Occupancy (${(occupancy * 100).toFixed(1)}%) below target (85%)`
      });
    }

    return risks;
  }

  static calculateEBITDA(facility) {
    // Use actual EBITDA if available (even if negative)
    if (facility.t12m_ebitda !== null && facility.t12m_ebitda !== undefined) {
      return facility.t12m_ebitda;
    }
    // Estimate EBITDA as 9% of revenue if not provided
    return facility.t12m_revenue ? facility.t12m_revenue * 0.09 : 0;
  }

  static calculateEBITDAR(facility) {
    // Use actual EBITDAR if available
    if (facility.t12m_ebitdar !== null && facility.t12m_ebitdar !== undefined && facility.t12m_ebitdar !== 0) {
      return facility.t12m_ebitdar;
    }
    // Estimate EBITDAR as 23% of revenue if not provided
    return facility.t12m_revenue ? facility.t12m_revenue * 0.23 : 0;
  }

  static calculateEBIT(facility) {
    // If EBIT is 0 or missing, estimate from EBITDA minus rent
    if (facility.t12m_ebit && facility.t12m_ebit !== 0) {
      return facility.t12m_ebit;
    }
    // Estimate EBIT as EBITDA minus rent expense
    const ebitda = this.calculateEBITDA(facility);
    const rent = facility.current_rent_lease_expense || 0;
    return ebitda - rent;
  }

  static calculateOccupancyRate(facility) {
    // Use actual occupancy if available
    if (facility.t12m_occupancy && facility.t12m_occupancy > 0) {
      return facility.t12m_occupancy;
    }
    // Default to 75% occupancy for analysis if not provided
    return 0.75;
  }

  static getTotalBeds(facility) {
    if (!facility.no_of_beds || !Array.isArray(facility.no_of_beds)) {
      return 0;
    }
    return facility.no_of_beds.reduce((total, bedType) => total + (bedType.count || 0), 0);
  }

  static calculateProformaMetrics(facility) {
    const years = [1, 2, 3];
    return years.map(year => ({
      year,
      revenue: facility[`proforma_year${year}_annual_revenue`] || 0,
      ebitdar: facility[`proforma_year${year}_annual_ebitdar`] || 0,
      ebitda: facility[`proforma_year${year}_annual_ebitda`] || 0,
      ebit: facility[`proforma_year${year}_annual_ebit`] || 0,
      occupancy: facility[`proforma_year${year}_average_occupancy`] || 0,
      rent: facility[`proforma_year${year}_annual_rent`] || 0
    }));
  }
}

/**
 * Deal Valuator - Computes deal value using EBITDA/cap rate or price per bed
 */
export class DealValuator {
  static evaluateDeal(deal, normalizedFacilities) {
    const evaluation = {
      dealId: deal.id,
      dealName: deal.deal_name,
      totalDealAmount: deal.total_deal_amount || 0,
      facilities: [],
      overallMetrics: {},
      riskAssessment: {},
      reitCompatibility: {},
      recommendations: []
    };

    // Evaluate each facility
    evaluation.facilities = normalizedFacilities.map(facility => 
      this.evaluateFacility(facility, deal)
    );

    // Calculate overall deal metrics
    evaluation.overallMetrics = this.calculateOverallMetrics(evaluation.facilities);
    
    // Risk assessment
    evaluation.riskAssessment = this.assessRisk(evaluation.facilities, deal);
    
    // REIT compatibility
    evaluation.reitCompatibility = this.assessREITCompatibility(evaluation.overallMetrics);
    
    // Generate recommendations
    evaluation.recommendations = this.generateRecommendations(evaluation);

    return evaluation;
  }

  static evaluateFacility(normalizedFacility, deal) {
    // normalizedFacility already has all the normalized values from FinancialNormalizer
    // Just add valuation metrics that require deal-level context
    const capRate = this.calculateCapRate(normalizedFacility, deal);
    const ebitdaMultiple = this.calculateEBITDAMultiple(normalizedFacility.t12mEBITDA, normalizedFacility.purchasePrice);

    return {
      ...normalizedFacility,
      location: `${normalizedFacility.city || ''}, ${normalizedFacility.state || ''}`.trim().replace(/^,\s*/, ''),
      capRate,
      ebitdaMultiple
    };
  }

  static calculateCapRate(facility, deal) {
    // Use normalized values if available, otherwise calculate
    const ebitda = facility.t12mEBITDA !== undefined ? facility.t12mEBITDA : (facility.t12m_ebitda || 0);
    const purchasePrice = facility.purchasePrice !== undefined ? facility.purchasePrice : (facility.purchase_price || 0);

    if (purchasePrice > 0 && ebitda !== 0) {
      return ebitda / purchasePrice;
    }

    // Default cap rate with risk adjustments
    let capRate = CASCADIA_BENCHMARKS.defaultCapRate;

    // Adjust for state risk
    const stateRisk = this.getStateRiskAdjustment(facility.state);
    capRate += stateRisk;

    return capRate;
  }

  static calculateEBITDAMultiple(ebitda, purchasePrice) {
    return purchasePrice > 0 && ebitda > 0 ? purchasePrice / ebitda : 0;
  }

  static comparePricePerBedToMarket(pricePerBed, state) {
    // Placeholder - would integrate with NIC data
    const marketRates = {
      'WA': 180000,
      'CA': 220000,
      'TX': 160000,
      'FL': 170000,
      'NY': 250000
    };
    
    const marketRate = marketRates[state] || 180000;
    return pricePerBed / marketRate;
  }

  static getStateRiskAdjustment(state) {
    // Risk adjustments based on state-specific factors
    const riskAdjustments = {
      'CA': 0.02, // Higher regulatory risk
      'NY': 0.015, // High cost state
      'TX': -0.01, // Lower risk
      'FL': 0.005, // Moderate risk
      'WA': 0.01 // Moderate risk
    };
    
    return riskAdjustments[state] || 0.01;
  }

  static calculateOverallMetrics(facilities) {
    const totalBeds = facilities.reduce((sum, f) => sum + (f.totalBeds || 0), 0);
    const totalPurchasePrice = facilities.reduce((sum, f) => sum + (f.purchasePrice || 0), 0);
    const totalRevenue = facilities.reduce((sum, f) => sum + (f.t12mRevenue || 0), 0);
    const totalEBITDA = facilities.reduce((sum, f) => sum + (f.t12mEBITDA || 0), 0);
    const totalEBITDAR = facilities.reduce((sum, f) => sum + (f.t12mEBITDAR || 0), 0);

    return {
      totalBeds,
      totalPurchasePrice,
      totalRevenue,
      totalEBITDA,
      totalEBITDAR,
      weightedAverageCapRate: totalPurchasePrice > 0 && totalEBITDA !== 0 ? totalEBITDA / totalPurchasePrice : null,
      weightedAverageOccupancy: totalBeds > 0 ?
        facilities.reduce((sum, f) => sum + ((f.t12mOccupancy || 0) * (f.totalBeds || 0)), 0) / totalBeds : 0,
      averagePricePerBed: totalBeds > 0 ? totalPurchasePrice / totalBeds : 0
    };
  }

  static assessRisk(facilities, deal) {
    const allRisks = facilities.flatMap(f => f.riskFactors || []);
    const riskCounts = allRisks.reduce((acc, risk) => {
      acc[risk.severity] = (acc[risk.severity] || 0) + 1;
      return acc;
    }, {});
    
    let overallRisk = 'low';
    if (riskCounts.high > 2) {
      overallRisk = 'high';
    } else if (riskCounts.high > 0 || riskCounts.medium > 3) {
      overallRisk = 'medium';
    }
    
    return {
      overallRisk,
      riskCounts,
      topRisks: allRisks
        .filter(r => r.severity === 'high')
        .slice(0, 3)
    };
  }

  static assessREITCompatibility(overallMetrics) {
    const coverageRatio = overallMetrics.totalEBITDAR / (overallMetrics.totalPurchasePrice * 0.1); // Assuming 10% cost of capital
    
    return {
      publicREITYield: overallMetrics.weightedAverageCapRate,
      privateREITYield: overallMetrics.weightedAverageCapRate,
      coverageRatio,
      meetsPublicREITRequirements: overallMetrics.weightedAverageCapRate >= CASCADIA_BENCHMARKS.publicREITYield,
      meetsPrivateREITRequirements: overallMetrics.weightedAverageCapRate >= CASCADIA_BENCHMARKS.privateREITYield,
      meetsCoverageRatio: coverageRatio >= CASCADIA_BENCHMARKS.minCoverageRatio
    };
  }

  static generateRecommendations(evaluation) {
    const recommendations = [];
    
    // Financial performance recommendations
    if (evaluation.overallMetrics.weightedAverageCapRate < CASCADIA_BENCHMARKS.defaultCapRate) {
      recommendations.push({
        category: 'financial',
        priority: 'high',
        title: 'Improve Financial Performance',
        description: 'Focus on operational improvements to achieve target 9% EBITDA and 23% EBITDAR margins'
      });
    }
    
    // Occupancy recommendations
    if (evaluation.overallMetrics.weightedAverageOccupancy < 0.85) {
      recommendations.push({
        category: 'operational',
        priority: 'medium',
        title: 'Increase Occupancy',
        description: 'Implement marketing and operational strategies to improve occupancy to 85%+'
      });
    }
    
    // Risk mitigation
    if (evaluation.riskAssessment.overallRisk === 'high') {
      recommendations.push({
        category: 'risk',
        priority: 'high',
        title: 'Risk Mitigation',
        description: 'Address high-risk factors before proceeding with deal'
      });
    }
    
    // REIT compatibility
    if (!evaluation.reitCompatibility.meetsPublicREITRequirements) {
      recommendations.push({
        category: 'reit',
        priority: 'medium',
        title: 'REIT Optimization',
        description: 'Optimize deal structure to meet REIT yield requirements'
      });
    }
    
    return recommendations;
  }
}

/**
 * Market Analyzer - Analyzes market data and competition
 */
export class MarketAnalyzer {
  static analyzeMarket(facilities) {
    return facilities.map(facility => ({
      facilityId: facility.id,
      marketAnalysis: {
        state: facility.state,
        city: facility.city,
        reimbursementRates: STATE_REIMBURSEMENT_RATES[facility.state] || { medicare: 400, medicaid: 250 },
        competitivePosition: this.assessCompetitivePosition(facility),
        marketTrends: this.getMarketTrends(facility.state)
      }
    }));
  }

  static assessCompetitivePosition(facility) {
    // Placeholder for competitive analysis
    return {
      marketShare: 'Unknown',
      competitiveAdvantages: [],
      competitiveThreats: []
    };
  }

  static getMarketTrends(state) {
    // Placeholder for market trend data
    return {
      occupancyTrend: 'stable',
      reimbursementTrend: 'increasing',
      competitionTrend: 'moderate'
    };
  }
}

/**
 * Main SNF Deal Evaluator
 */
export class SNFDealEvaluator {
  /**
   * Convert flat deal structure to facility format for algorithm
   * The deal data is stored flat on the deal object, not in a deal_facility array
   * Also handles extraction_data which may contain more detailed financials
   */
  static convertDealToFacility(deal) {
    // Parse extraction_data if it's a string
    let extractionData = {};
    if (deal.extraction_data) {
      if (typeof deal.extraction_data === 'string') {
        try {
          extractionData = JSON.parse(deal.extraction_data);
        } catch {
          extractionData = {};
        }
      } else {
        extractionData = deal.extraction_data;
      }
    }

    // For portfolio deals, actual metrics may be in portfolio_data or deal_overview
    let portfolioData = extractionData.portfolio_data || {};
    let dealOverview = extractionData.deal_overview || {};
    let ttmFinancials = dealOverview.ttm_financials || {};

    // Parse no_of_beds - could be string, JSON string, array, or use bed_count fallback
    let parsedBeds = [];
    // Check facility_snapshot in deal_overview for beds (portfolio deals)
    const facilitySnapshot = dealOverview.facility_snapshot || {};
    const bedSource = deal.no_of_beds
      || deal.bed_count
      || extractionData.bed_count
      || facilitySnapshot.licensed_beds
      || facilitySnapshot.total_beds
      || portfolioData.total_beds;
    if (bedSource) {
      if (Array.isArray(bedSource)) {
        parsedBeds = bedSource;
      } else if (typeof bedSource === 'string') {
        try {
          const parsed = JSON.parse(bedSource);
          parsedBeds = Array.isArray(parsed) ? parsed : [{ count: parseInt(bedSource) || 0, type: 'Total' }];
        } catch {
          // If not JSON, treat as total bed count
          parsedBeds = [{ count: parseInt(bedSource) || 0, type: 'Total' }];
        }
      } else if (typeof bedSource === 'number') {
        parsedBeds = [{ count: bedSource, type: 'Total' }];
      }
    }

    // Get revenue from multiple possible sources (including nested portfolio/deal_overview structures)
    const revenue = deal.annual_revenue
      || extractionData.annual_revenue
      || extractionData.t12m_revenue
      || ttmFinancials.total_revenue
      || ttmFinancials.revenue
      || portfolioData.total_revenue
      || 0;

    // Get EBITDA from multiple possible sources
    const ebitda = deal.ebitda
      || extractionData.ebitda
      || extractionData.t12m_ebitda
      || ttmFinancials.ebitda
      || ttmFinancials.net_income
      || portfolioData.total_ebitda
      || 0;

    // Get EBITDAR from multiple possible sources
    const ebitdar = deal.ebitdar || extractionData.ebitdar || (ebitda ? ebitda * 1.15 : null);

    // Get occupancy - try multiple sources
    let occupancy = null;
    if (deal.current_occupancy && deal.current_occupancy > 0) {
      occupancy = deal.current_occupancy / 100; // Convert from % to decimal
    } else if (extractionData.occupancy_pct && extractionData.occupancy_pct > 0) {
      occupancy = extractionData.occupancy_pct / 100;
    } else if (extractionData.average_daily_census && parsedBeds.length > 0) {
      // Calculate occupancy from ADC and bed count
      const totalBeds = parsedBeds.reduce((sum, b) => sum + (b.count || 0), 0);
      if (totalBeds > 0) {
        occupancy = extractionData.average_daily_census / totalBeds;
      }
    }

    return {
      id: deal.id,
      facility_name: extractionData.facility_name || deal.facility_name || deal.deal_name,
      facility_type: extractionData.facility_type || deal.facility_type || deal.deal_type,
      city: extractionData.city || deal.city,
      state: extractionData.state || deal.state,
      street_address: extractionData.street_address || deal.street_address,
      zip_code: extractionData.zip_code || deal.zip_code,
      no_of_beds: parsedBeds,
      purchase_price: deal.purchase_price || extractionData.purchase_price || 0,
      price_per_bed: deal.price_per_bed || extractionData.price_per_bed,
      // Map deal fields to facility fields expected by algorithm
      t12m_revenue: revenue,
      t12m_ebitda: ebitda,
      t12m_ebitdar: ebitdar,
      t12m_occupancy: occupancy,
      current_rent_lease_expense: extractionData.rent_lease_expense || 0,
      // Additional fields from extraction_data
      average_daily_rate: deal.average_daily_rate || extractionData.average_daily_rate,
      medicare_percentage: deal.medicare_percentage || extractionData.medicaid_pct, // Note: medicaid_pct in extraction
      private_pay_percentage: deal.private_pay_percentage || extractionData.private_pay_pct,
      ebitda_margin: deal.ebitda_margin,
      net_operating_income: deal.net_operating_income || extractionData.net_income,
      // Store extraction data for reference
      _extractionData: extractionData,
    };
  }

  static async evaluateDeal(deal) {
    try {
      // Check if deal has deal_facility array (multi-facility deal)
      // Otherwise, treat the deal itself as a single facility
      let facilities = [];

      if (deal.deal_facility && Array.isArray(deal.deal_facility) && deal.deal_facility.length > 0) {
        // Multi-facility deal - convert main deal since it has extraction_data
        // The deal_facility records may be empty placeholders
        const mainFacility = this.convertDealToFacility(deal);

        // Check if deal_facility has actual data or just placeholders
        const firstFacility = deal.deal_facility[0];
        const hasActualFacilityData = firstFacility.annual_revenue || firstFacility.ebitda || firstFacility.t12m_revenue;

        if (hasActualFacilityData) {
          facilities = deal.deal_facility;
        } else {
          // deal_facility is empty placeholders, use main deal data
          facilities = [mainFacility];
        }
      } else {
        // Single facility deal - convert flat deal to facility format
        facilities = [this.convertDealToFacility(deal)];
      }

      // Normalize financial data for all facilities
      const normalizedFacilities = facilities.map(facility =>
        FinancialNormalizer.normalizeFinancials(facility)
      );

      // Evaluate the deal
      const evaluation = DealValuator.evaluateDeal(deal, normalizedFacilities);

      // Add market analysis
      evaluation.marketAnalysis = MarketAnalyzer.analyzeMarket(normalizedFacilities);

      // Add summary insights
      evaluation.summary = this.generateSummary(evaluation);

      return evaluation;
    } catch (error) {
      console.error('Error evaluating deal:', error);
      throw new Error('Failed to evaluate deal: ' + error.message);
    }
  }

  static generateSummary(evaluation) {
    const { overallMetrics, riskAssessment, reitCompatibility, recommendations } = evaluation;
    
    return {
      dealScore: this.calculateDealScore(evaluation),
      keyStrengths: this.identifyStrengths(evaluation),
      keyConcerns: this.identifyConcerns(evaluation),
      investmentRecommendation: this.getInvestmentRecommendation(evaluation),
      nextSteps: this.getNextSteps(evaluation)
    };
  }

  static calculateDealScore(evaluation) {
    let score = 100;
    
    // Deduct points for financial performance issues
    if (evaluation.overallMetrics.weightedAverageCapRate < CASCADIA_BENCHMARKS.defaultCapRate) {
      score -= 20;
    }
    
    // Deduct points for occupancy issues
    if (evaluation.overallMetrics.weightedAverageOccupancy < 0.85) {
      score -= 15;
    }
    
    // Deduct points for risk factors
    if (evaluation.riskAssessment.overallRisk === 'high') {
      score -= 25;
    } else if (evaluation.riskAssessment.overallRisk === 'medium') {
      score -= 10;
    }
    
    // Deduct points for REIT incompatibility
    if (!evaluation.reitCompatibility.meetsPublicREITRequirements) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  static identifyStrengths(evaluation) {
    const strengths = [];
    
    if (evaluation.overallMetrics.weightedAverageCapRate >= CASCADIA_BENCHMARKS.defaultCapRate) {
      strengths.push('Strong cap rate performance');
    }
    
    if (evaluation.overallMetrics.weightedAverageOccupancy >= 0.85) {
      strengths.push('Good occupancy levels');
    }
    
    if (evaluation.reitCompatibility.meetsPublicREITRequirements) {
      strengths.push('REIT-compatible structure');
    }
    
    if (evaluation.riskAssessment.overallRisk === 'low') {
      strengths.push('Low risk profile');
    }
    
    return strengths;
  }

  static identifyConcerns(evaluation) {
    const concerns = [];
    
    if (evaluation.overallMetrics.weightedAverageCapRate < CASCADIA_BENCHMARKS.defaultCapRate) {
      concerns.push('Below-target cap rate');
    }
    
    if (evaluation.overallMetrics.weightedAverageOccupancy < 0.85) {
      concerns.push('Occupancy below target');
    }
    
    if (evaluation.riskAssessment.overallRisk === 'high') {
      concerns.push('High risk factors present');
    }
    
    if (!evaluation.reitCompatibility.meetsCoverageRatio) {
      concerns.push('Insufficient coverage ratio for REIT');
    }
    
    return concerns;
  }

  static getInvestmentRecommendation(evaluation) {
    const score = this.calculateDealScore(evaluation);
    
    if (score >= 80) {
      return 'STRONG BUY';
    } else if (score >= 65) {
      return 'BUY';
    } else if (score >= 50) {
      return 'HOLD';
    } else if (score >= 35) {
      return 'SELL';
    } else {
      return 'STRONG SELL';
    }
  }

  static getNextSteps(evaluation) {
    const steps = [];
    
    if (evaluation.riskAssessment.overallRisk === 'high') {
      steps.push('Conduct detailed due diligence on high-risk factors');
    }
    
    if (evaluation.overallMetrics.weightedAverageCapRate < CASCADIA_BENCHMARKS.defaultCapRate) {
      steps.push('Develop operational improvement plan');
    }
    
    if (!evaluation.reitCompatibility.meetsPublicREITRequirements) {
      steps.push('Optimize deal structure for REIT compatibility');
    }
    
    steps.push('Prepare detailed financial model');
    steps.push('Schedule management meetings');
    
    return steps;
  }
}

export default SNFDealEvaluator;
