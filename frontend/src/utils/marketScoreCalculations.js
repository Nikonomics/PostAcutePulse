// Market Score Calculations
// Based on CLAUDE_CODE_PROMPT_MarketAnalysis.md specifications

// National benchmarks for comparison
export const NATIONAL_BENCHMARKS = {
  bedsPerThousand65: 17.4,
  bedsPerThousand85: 95.2,
  medianIncome: 65000,
  medianHomeValue: 230000,
  povertyRate: 12.4,
  homeownershipRate: 65,
  growth65: 95.3,      // % growth to 2030 (8-year projection using state CAGRs)
  growth85: 66.2,      // % growth to 2030 (8-year projection using state CAGRs)
  cnaWage: 15.50,      // $/hr
  lpnWage: 23.00,      // $/hr
  rnWage: 36.00,       // $/hr
  snfOccupancy: 0.78,  // 78%
  snfRating: 3.2       // stars
};

// Alias for backwards compatibility
export const nationalBenchmarks = NATIONAL_BENCHMARKS;

// Letter grade mapping
export function calculateLetterGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}

// Grade color scheme
export function getGradeColor(grade) {
  if (grade.startsWith('A')) return { bg: '#d4edda', text: '#155724', accent: '#28a745' };
  if (grade.startsWith('B')) return { bg: '#d1ecf1', text: '#0c5460', accent: '#17a2b8' };
  if (grade.startsWith('C')) return { bg: '#fff3cd', text: '#856404', accent: '#ffc107' };
  if (grade.startsWith('D')) return { bg: '#ffe5d0', text: '#854027', accent: '#fd7e14' };
  return { bg: '#f8d7da', text: '#721c24', accent: '#dc3545' }; // F
}

// Percentile labels
export function getPercentileLabel(value, nationalBenchmark, higherIsBetter = true) {
  if (value == null || nationalBenchmark == null) return null;
  const ratio = value / nationalBenchmark;
  if (higherIsBetter) {
    if (ratio >= 2.0) return 'Top 1%';
    if (ratio >= 1.5) return 'Top 10%';
    if (ratio >= 1.2) return 'Top 25%';
    if (ratio >= 1.0) return 'Above avg';
    if (ratio >= 0.8) return 'Below avg';
    return 'Bottom 20%';
  } else { // Lower is better (e.g., poverty rate, wages)
    if (ratio <= 0.5) return 'Top 5%';
    if (ratio <= 0.7) return 'Top 20%';
    if (ratio <= 0.9) return 'Above avg';
    if (ratio <= 1.1) return 'Average';
    return 'Below avg';
  }
}

// Calculate all category scores
export function calculateScores(marketData, facilityType, laborData = null) {
  if (!marketData) return null;

  const { supply, demographics } = marketData;
  const nat = NATIONAL_BENCHMARKS;

  // Get supply data based on facility type
  const beds = facilityType === 'SNF'
    ? (supply?.beds?.total || supply?.totalBeds || 0)
    : (supply?.totalCapacity || 0);
  const facilities = supply?.facilityCount || 0;
  const avgOccupancy = supply?.avgOccupancy ? parseFloat(supply.avgOccupancy) / 100 : null;
  const avgRating = supply?.avgRating ? parseFloat(supply.avgRating) : null;

  // Demographics data
  const pop65 = demographics?.population?.age65Plus || demographics?.populationAge65Plus || 0;
  const pop85 = demographics?.population?.age85Plus || demographics?.populationAge85Plus || 0;
  const medianIncome = demographics?.economics?.medianHouseholdIncome || demographics?.medianHouseholdIncome || 0;
  const medianHomeValue = demographics?.economics?.medianHomeValue || demographics?.medianHomeValue || 0;
  const povertyRate = demographics?.economics?.povertyRate || demographics?.povertyRate || 0;
  const homeownershipRate = demographics?.economics?.homeownershipRate || demographics?.homeownershipRate || 0;
  const growth65 = demographics?.projections?.growthRate65Plus || demographics?.growthRate65Plus || 0;
  const growth85 = demographics?.projections?.growthRate85Plus || demographics?.growthRate85Plus || 0;

  // Estimated AL/SNF need (use provided or estimate at 2.5% of 65+ pop)
  const totalNeed = demographics?.totalAlNeed || Math.round(pop65 * 0.025);

  // Labor data (use defaults if not provided)
  const labor = laborData || {
    state_cna_wage: 15.50,
    state_lpn_wage: 23.00,
    state_rn_wage: 36.00,
    cbsa_wage_index: 1.0,
    healthcare_unemployment: 3.0
  };

  // SNF Quality data
  const snfQuality = facilityType === 'SNF' ? {
    avg_health_inspection: avgRating || 3.0,
    total_deficiencies: supply?.totalDeficiencies || (facilities * 10),
    sff_count: supply?.sffCount || 0
  } : null;

  // New facilities since 2021 (estimate if not provided)
  const newSupply = supply?.newSince2021 || 0;

  // =====================
  // DEMAND SCORE (0-100)
  // =====================
  const pop65Score = Math.min(100, (pop65 / 50000) * 70);
  const pop85Score = Math.min(100, (pop85 / 8000) * 80);
  const needScore = Math.min(100, (totalNeed / 2000) * 75);
  const demandScore = (pop65Score * 0.3) + (pop85Score * 0.35) + (needScore * 0.35);

  // =====================
  // ABILITY TO PAY SCORE (0-100)
  // =====================
  const incomeScore = Math.min(100, (medianIncome / 120000) * 100);
  const homeValueScore = Math.min(100, (medianHomeValue / 500000) * 100);
  const povertyScore = Math.max(0, 100 - (povertyRate / 20) * 100);
  const ownershipScore = (homeownershipRate / 80) * 100;
  const abilityToPayScore = (incomeScore * 0.35) + (homeValueScore * 0.30) + (povertyScore * 0.20) + (ownershipScore * 0.15);

  // =====================
  // COMPETITION SCORE (0-100)
  // Key insight: LOWER supply relative to demand = BETTER for operators
  // =====================
  const bedsPerThousand65 = pop65 > 0 ? (beds / pop65) * 1000 : 0;
  const nationalAvgPenetration = 17.4;

  // Penetration score: below national avg = good (high score), above = bad (low score)
  const penetrationRatio = bedsPerThousand65 / nationalAvgPenetration;
  const penetrationScore = Math.max(0, Math.min(100, 120 - (penetrationRatio * 60)));

  // Need gap: positive = undersupplied = good
  const needGap = totalNeed - beds;
  const needGapPct = totalNeed > 0 ? (needGap / totalNeed) * 100 : 0;
  const gapScore = Math.min(100, Math.max(0, 50 + needGapPct));

  // Occupancy score (SNF only) - high occupancy = strong demand signal
  let occupancyScore = 50; // default for ALF
  if (facilityType === 'SNF' && avgOccupancy) {
    const occPct = avgOccupancy * 100;
    occupancyScore = Math.max(0, Math.min(100, (occPct - 50) * 2.5));
  }

  // New supply penalty
  const undersupplyFactor = Math.max(0, 1 - (needGapPct / 100));
  const newSupplyPenalty = newSupply * 5 * undersupplyFactor;

  let competitionScore;
  if (facilityType === 'SNF') {
    competitionScore = Math.max(0, Math.min(100,
      (penetrationScore * 0.30) + (gapScore * 0.35) + (occupancyScore * 0.25) - newSupplyPenalty
    ));
  } else {
    competitionScore = Math.max(0, Math.min(100,
      (penetrationScore * 0.40) + (gapScore * 0.50) - newSupplyPenalty
    ));
  }

  // =====================
  // GROWTH SCORE (0-100)
  // =====================
  const growth65Score = Math.min(100, (growth65 / 30) * 100);
  const growth85Score = Math.min(100, (growth85 / 35) * 100);
  const growthScore = (growth65Score * 0.3) + (growth85Score * 0.7);

  // =====================
  // LABOR MARKET SCORE (0-100)
  // =====================
  const localCNAWage = labor.state_cna_wage * labor.cbsa_wage_index;
  const wageScore = Math.max(0, 100 - ((localCNAWage / nat.cnaWage - 1) * 200));
  const unemploymentScore = Math.min(100, (labor.healthcare_unemployment / 2) * 100);
  const laborScore = (wageScore * 0.7) + (unemploymentScore * 0.3);

  // =====================
  // QUALITY SCORE (SNF only, 0-100)
  // =====================
  let qualityScore = null;
  if (facilityType === 'SNF' && snfQuality) {
    const ratingScore = (snfQuality.avg_health_inspection / 5) * 100;
    const defScore = facilities > 0
      ? Math.max(0, 100 - (snfQuality.total_deficiencies / facilities / 15) * 100)
      : 50;
    const sffPenalty = snfQuality.sff_count * 15;
    qualityScore = Math.max(0, (ratingScore * 0.6) + (defScore * 0.4) - sffPenalty);
  }

  return {
    demand: Math.round(demandScore),
    abilityToPay: Math.round(abilityToPayScore),
    competition: Math.round(competitionScore),
    growth: Math.round(growthScore),
    labor: Math.round(laborScore),
    quality: qualityScore ? Math.round(qualityScore) : null,
    // Raw values for display
    rawValues: {
      pop65,
      pop85,
      totalNeed,
      beds,
      bedsPerThousand65,
      needGap,
      needGapPct,
      medianIncome,
      medianHomeValue,
      povertyRate,
      homeownershipRate,
      growth65,
      growth85,
      localCNAWage,
      localLPNWage: labor.state_lpn_wage * labor.cbsa_wage_index,
      healthcareUnemployment: labor.healthcare_unemployment,
      avgOccupancy,
      avgRating,
      newSupply
    }
  };
}

// Calculate overall grade
export function calculateOverallGrade(scores, facilityType) {
  if (!scores) return 'N/A';

  let weighted;
  if (facilityType === 'SNF' && scores.quality !== null) {
    weighted =
      scores.demand * 0.15 +
      scores.abilityToPay * 0.20 +
      scores.competition * 0.15 +
      scores.growth * 0.15 +
      scores.labor * 0.20 +
      scores.quality * 0.15;
  } else { // ALF or SNF without quality
    weighted =
      scores.demand * 0.20 +
      scores.abilityToPay * 0.25 +
      scores.competition * 0.20 +
      scores.growth * 0.15 +
      scores.labor * 0.20;
  }
  return calculateLetterGrade(weighted);
}

// Calculate implied monthly revenue (per bed)
export function calculateImpliedMonthlyBudget(medianHouseholdIncome) {
  if (!medianHouseholdIncome) return 0;
  // Markets can typically support monthly rates around 7-8% of median annual income
  const raw = medianHouseholdIncome * 0.074;
  const capped = Math.min(raw, 8500); // Cap at $8,500/mo
  return Math.round(capped / 100) * 100;
}

// Calculate labor cost per bed (monthly)
export function calculateLaborCostPerBed(laborData) {
  const labor = laborData || {
    state_cna_wage: 15.50,
    state_lpn_wage: 23.00,
    state_rn_wage: 36.00,
    cbsa_wage_index: 1.0
  };

  const localCNA = labor.state_cna_wage * labor.cbsa_wage_index;
  const localLPN = labor.state_lpn_wage * labor.cbsa_wage_index;
  const localRN = labor.state_rn_wage * labor.cbsa_wage_index;
  const localAdmin = 28 * labor.cbsa_wage_index;
  const localSupport = 15 * labor.cbsa_wage_index;

  // Staffing ratios (FTE per bed for ~60 bed facility)
  const annualLaborPerBed = (
    (localCNA * 0.40 * 2080) +     // CNAs: ~24 FTEs / 60 beds
    (localLPN * 0.08 * 2080) +     // LPNs: ~5 FTEs / 60 beds
    (localRN * 0.017 * 2080) +     // RNs: ~1 FTE / 60 beds
    (localAdmin * 0.05 * 2080) +   // Admin: ~3 FTEs / 60 beds
    (localSupport * 0.10 * 2080)   // Support: ~6 FTEs / 60 beds
  );

  const withBenefits = annualLaborPerBed * 1.28; // 28% benefits load
  return Math.round(withBenefits / 12);
}

// Generate risks and opportunities
export function generateRisksOpportunities(marketData, facilityType, scores, laborData = null) {
  if (!marketData || !scores) return { risks: [], opportunities: [] };

  const { supply } = marketData;
  const rawValues = scores.rawValues || {};
  const risks = [];
  const opportunities = [];

  const needGap = rawValues.needGap || 0;
  const bedsPerThousand65 = rawValues.bedsPerThousand65 || 0;
  const medianIncome = rawValues.medianIncome || 0;
  const povertyRate = rawValues.povertyRate || 0;
  const homeownershipRate = rawValues.homeownershipRate || 0;
  const growth65 = rawValues.growth65 || 0;
  const growth85 = rawValues.growth85 || 0;
  const avgOccupancy = rawValues.avgOccupancy || 0;
  const avgRating = rawValues.avgRating || 0;
  const newSupply = rawValues.newSupply || 0;

  const labor = laborData || {
    state_cna_wage: 15.50,
    cbsa_wage_index: 1.0,
    healthcare_unemployment: 3.0
  };
  const localCNAWage = labor.state_cna_wage * labor.cbsa_wage_index;

  const impliedRevenue = calculateImpliedMonthlyBudget(medianIncome);
  const laborCost = calculateLaborCostPerBed(labor);
  const laborPct = impliedRevenue > 0 ? (laborCost / impliedRevenue) * 100 : 0;

  // RISKS
  if (medianIncome > 100000)
    risks.push("High-income market attracts institutional operators");
  if (newSupply >= 2)
    risks.push(`${newSupply} new facilities opened since 2021`);
  if (needGap < 0)
    risks.push(`Market oversupplied by ${Math.abs(needGap).toLocaleString()} beds`);
  if (labor.healthcare_unemployment < 2.5)
    risks.push("Tight labor market may create staffing challenges");
  if (localCNAWage > NATIONAL_BENCHMARKS.cnaWage * 1.15)
    risks.push(`Elevated CNA wages ($${localCNAWage.toFixed(2)}/hr)`);
  if (laborPct > 52)
    risks.push("Labor costs exceed 52% of implied revenue");
  if (growth65 < 10)
    risks.push("Below-average population growth");
  if (bedsPerThousand65 > 25)
    risks.push("High bed penetration (saturated market)");

  // SNF-specific risks
  if (facilityType === 'SNF') {
    if (avgOccupancy && avgOccupancy < 0.75)
      risks.push(`Low market occupancy (${(avgOccupancy * 100).toFixed(0)}%) signals weak demand`);
    if (supply?.sffCount > 0)
      risks.push(`${supply.sffCount} Special Focus Facility in market`);
    if (avgRating && avgRating < 3.0)
      risks.push("Below-average quality ratings in market");
  }

  // OPPORTUNITIES
  if (growth65 > 20)
    opportunities.push(`Strong 65+ growth (+${growth65}%)`);
  if (growth85 > growth65)
    opportunities.push("85+ growth outpacing 65+ (higher acuity)");
  if (medianIncome > 80000)
    opportunities.push(`Pricing power (~$${(impliedRevenue / 1000).toFixed(1)}K/mo)`);
  if (needGap > 200)
    opportunities.push(`${needGap.toLocaleString()} bed undersupply`);
  if (povertyRate < 8)
    opportunities.push("Low poverty expands addressable market");
  if (localCNAWage < NATIONAL_BENCHMARKS.cnaWage)
    opportunities.push("Below-average labor costs");
  if (labor.healthcare_unemployment > 3.0)
    opportunities.push("Better labor availability than average");
  if (homeownershipRate > 70)
    opportunities.push("High homeownership (payment source)");
  if (bedsPerThousand65 < 14)
    opportunities.push("Low bed penetration (supply-constrained)");

  // SNF-specific opportunities
  if (facilityType === 'SNF' && avgOccupancy && avgOccupancy > 0.85) {
    opportunities.push(`Strong market occupancy (${(avgOccupancy * 100).toFixed(0)}%) signals demand`);
  }

  return {
    risks: risks.slice(0, 4),
    opportunities: opportunities.slice(0, 4)
  };
}

// Calculate data confidence percentage
export function calculateDataConfidence(marketData) {
  if (!marketData) return 0;

  let score = 0;
  const { supply, demographics, metrics } = marketData;

  // Supply data (30 points)
  if (supply?.facilityCount) score += 10;
  if (supply?.beds?.total || supply?.totalCapacity) score += 10;
  if (supply?.avgOccupancy) score += 5;
  if (supply?.avgRating) score += 5;

  // Demographics (40 points)
  if (demographics?.population?.age65Plus || demographics?.populationAge65Plus) score += 10;
  if (demographics?.population?.age85Plus || demographics?.populationAge85Plus) score += 10;
  if (demographics?.economics?.medianHouseholdIncome || demographics?.medianHouseholdIncome) score += 10;
  if (demographics?.projections?.growthRate65Plus || demographics?.growthRate65Plus) score += 10;

  // Metrics (30 points)
  if (metrics?.bedsPerThousand65Plus || metrics?.capacityPerThousand65Plus) score += 15;
  if (metrics?.growthOutlook) score += 15;

  return score;
}
