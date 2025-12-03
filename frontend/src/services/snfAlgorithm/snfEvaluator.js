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
    const normalized = {
      ...facility,
      // Calculate key metrics
      t12mEBITDA: this.calculateEBITDA(facility),
      t12mEBITDAR: this.calculateEBITDAR(facility),
      t12mEBIT: this.calculateEBIT(facility),
      pricePerBed: this.calculatePricePerBed(facility),
      occupancyRate: this.calculateOccupancyRate(facility),
      revenuePerBed: this.calculateRevenuePerBed(facility),
      // Proforma calculations
      proformaMetrics: this.calculateProformaMetrics(facility)
    };

    return normalized;
  }

  static calculateEBITDA(facility) {
    // If EBITDA is 0 or missing, estimate from revenue (assuming 9% target)
    if (facility.t12m_ebitda && facility.t12m_ebitda > 0) {
      return facility.t12m_ebitda;
    }
    // Estimate EBITDA as 9% of revenue if not provided
    return facility.t12m_revenue ? facility.t12m_revenue * 0.09 : 0;
  }

  static calculateEBITDAR(facility) {
    // If EBITDAR is 0 or missing, estimate from revenue (assuming 23% target)
    if (facility.t12m_ebitdar && facility.t12m_ebitdar > 0) {
      return facility.t12m_ebitdar;
    }
    // Estimate EBITDAR as 23% of revenue if not provided
    return facility.t12m_revenue ? facility.t12m_revenue * 0.23 : 0;
  }

  static calculateEBIT(facility) {
    // If EBIT is 0 or missing, estimate from EBITDA minus rent
    if (facility.t12m_ebit && facility.t12m_ebit > 0) {
      return facility.t12m_ebit;
    }
    // Estimate EBIT as EBITDA minus rent expense
    const ebitda = this.calculateEBITDA(facility);
    const rent = facility.current_rent_lease_expense || 0;
    return Math.max(0, ebitda - rent);
  }

  static calculatePricePerBed(facility) {
    const totalBeds = this.getTotalBeds(facility);
    return totalBeds > 0 ? (facility.purchase_price || 0) / totalBeds : 0;
  }

  static calculateOccupancyRate(facility) {
    // If occupancy is 0 or missing, use a default assumption for analysis
    if (facility.t12m_occupancy && facility.t12m_occupancy > 0) {
      return facility.t12m_occupancy;
    }
    // Default to 75% occupancy for analysis if not provided
    return 0.75;
  }

  static calculateRevenuePerBed(facility) {
    const totalBeds = this.getTotalBeds(facility);
    return totalBeds > 0 ? (facility.t12m_revenue || 0) / totalBeds : 0;
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

  static evaluateFacility(facility, deal) {
    const totalBeds = FinancialNormalizer.getTotalBeds(facility);
    const pricePerBed = FinancialNormalizer.calculatePricePerBed(facility);
    const ebitda = FinancialNormalizer.calculateEBITDA(facility);
    const ebitdar = FinancialNormalizer.calculateEBITDAR(facility);
    const occupancy = FinancialNormalizer.calculateOccupancyRate(facility);
    
    // Track if data is estimated vs actual
    const dataQuality = {
      ebitdaEstimated: !facility.t12m_ebitda || facility.t12m_ebitda === 0,
      ebitdarEstimated: !facility.t12m_ebitdar || facility.t12m_ebitdar === 0,
      occupancyEstimated: !facility.t12m_occupancy || facility.t12m_occupancy === 0,
      revenueEstimated: !facility.t12m_revenue || facility.t12m_revenue === 0
    };

    // Calculate valuation metrics
    const capRate = this.calculateCapRate(facility, deal);
    const ebitdaMultiple = this.calculateEBITDAMultiple(ebitda, facility.purchase_price);
    
    // Performance vs benchmarks
    const performance = {
      ebitdaVsTarget: ebitda / (facility.t12m_revenue * CASCADIA_BENCHMARKS.targetEBITDA),
      ebitdarVsTarget: ebitdar / (facility.t12m_revenue * CASCADIA_BENCHMARKS.targetEBITDAR),
      occupancyVsTarget: occupancy / 0.85, // 85% target occupancy
      pricePerBedVsMarket: this.comparePricePerBedToMarket(pricePerBed, facility.state)
    };

    return {
      facilityId: facility.id,
      facilityName: facility.facility_name,
      facilityType: facility.facility_type,
      location: `${facility.city}, ${facility.state}`,
      totalBeds,
      pricePerBed,
      purchasePrice: facility.purchase_price || 0,
      t12mRevenue: facility.t12m_revenue || 0,
      t12mEBITDA: ebitda,
      t12mEBITDAR: ebitdar,
      t12mOccupancy: occupancy,
      capRate,
      ebitdaMultiple,
      performance,
      proformaMetrics: FinancialNormalizer.calculateProformaMetrics(facility),
      riskFactors: this.identifyRiskFactors(facility, performance),
      dataQuality,
      hasActualData: !dataQuality.ebitdaEstimated && !dataQuality.ebitdarEstimated && !dataQuality.occupancyEstimated
    };
  }

  static calculateCapRate(facility, deal) {
    const ebitda = FinancialNormalizer.calculateEBITDA(facility);
    const purchasePrice = facility.purchase_price || 0;
    
    if (purchasePrice > 0 && ebitda > 0) {
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

  static identifyRiskFactors(facility, performance) {
    const risks = [];
    
    if (performance.ebitdaVsTarget < 0.8) {
      risks.push({
        type: 'financial',
        severity: 'high',
        description: 'EBITDA significantly below target (9%)'
      });
    }
    
    if (performance.ebitdarVsTarget < 0.8) {
      risks.push({
        type: 'financial',
        severity: 'high',
        description: 'EBITDAR significantly below target (23%)'
      });
    }
    
    if (performance.occupancyVsTarget < 0.8) {
      risks.push({
        type: 'operational',
        severity: 'medium',
        description: 'Occupancy below target (85%)'
      });
    }
    
    if (performance.pricePerBedVsMarket > 1.2) {
      risks.push({
        type: 'valuation',
        severity: 'medium',
        description: 'Price per bed above market rate'
      });
    }
    
    return risks;
  }

  static calculateOverallMetrics(facilities) {
    const totalBeds = facilities.reduce((sum, f) => sum + f.totalBeds, 0);
    const totalPurchasePrice = facilities.reduce((sum, f) => sum + f.purchasePrice, 0);
    const totalRevenue = facilities.reduce((sum, f) => sum + f.t12mRevenue, 0);
    const totalEBITDA = facilities.reduce((sum, f) => sum + f.t12mEBITDA, 0);
    const totalEBITDAR = facilities.reduce((sum, f) => sum + f.t12mEBITDAR, 0);
    
    return {
      totalBeds,
      totalPurchasePrice,
      totalRevenue,
      totalEBITDA,
      totalEBITDAR,
      weightedAverageCapRate: totalPurchasePrice > 0 ? totalEBITDA / totalPurchasePrice : 0,
      weightedAverageOccupancy: totalBeds > 0 ? 
        facilities.reduce((sum, f) => sum + (f.t12mOccupancy * f.totalBeds), 0) / totalBeds : 0,
      averagePricePerBed: totalBeds > 0 ? totalPurchasePrice / totalBeds : 0
    };
  }

  static assessRisk(facilities, deal) {
    const allRisks = facilities.flatMap(f => f.riskFactors);
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
   */
  static convertDealToFacility(deal) {
    // Parse no_of_beds - could be string, JSON string, or array
    let parsedBeds = [];
    if (deal.no_of_beds) {
      if (Array.isArray(deal.no_of_beds)) {
        parsedBeds = deal.no_of_beds;
      } else if (typeof deal.no_of_beds === 'string') {
        try {
          const parsed = JSON.parse(deal.no_of_beds);
          parsedBeds = Array.isArray(parsed) ? parsed : [{ count: parseInt(deal.no_of_beds) || 0, type: 'Total' }];
        } catch {
          // If not JSON, treat as total bed count
          parsedBeds = [{ count: parseInt(deal.no_of_beds) || 0, type: 'Total' }];
        }
      }
    }

    return {
      id: deal.id,
      facility_name: deal.facility_name || deal.deal_name,
      facility_type: deal.facility_type || deal.deal_type,
      city: deal.city,
      state: deal.state,
      street_address: deal.street_address,
      zip_code: deal.zip_code,
      no_of_beds: parsedBeds,
      purchase_price: deal.purchase_price,
      price_per_bed: deal.price_per_bed,
      // Map deal fields to facility fields expected by algorithm
      t12m_revenue: deal.annual_revenue,
      t12m_ebitda: deal.ebitda,
      t12m_ebitdar: deal.ebitda ? deal.ebitda * 1.15 : null, // Estimate EBITDAR if not available
      t12m_occupancy: deal.current_occupancy ? deal.current_occupancy / 100 : null, // Convert from % to decimal
      current_rent_lease_expense: 0, // Not available in flat structure
      // Additional fields
      average_daily_rate: deal.average_daily_rate,
      medicare_percentage: deal.medicare_percentage,
      private_pay_percentage: deal.private_pay_percentage,
      ebitda_margin: deal.ebitda_margin,
      net_operating_income: deal.net_operating_income,
    };
  }

  static async evaluateDeal(deal) {
    try {
      // Check if deal has deal_facility array (multi-facility deal)
      // Otherwise, treat the deal itself as a single facility
      let facilities = [];

      if (deal.deal_facility && Array.isArray(deal.deal_facility) && deal.deal_facility.length > 0) {
        // Multi-facility deal - use deal_facility array
        facilities = deal.deal_facility;
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
