import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, BarChart3, DollarSign, Building2, TrendingUp, Users, Star } from 'lucide-react';
import { calculateLetterGrade, getGradeColor, getPercentileLabel, NATIONAL_BENCHMARKS } from '../../utils/marketScoreCalculations';

const styles = {
  grid: () => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  }),
  card: {
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  cardHeader: (colors, expanded) => ({
    background: colors.bg,
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    borderBottom: expanded ? '1px solid #dee2e6' : 'none',
    transition: 'all 0.15s',
  }),
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '16px',
  },
  title: (colors) => ({
    fontWeight: 600,
    color: colors.text,
    fontSize: '12px',
    textTransform: 'uppercase',
  }),
  helpButton: (colors) => ({
    background: 'rgba(0,0,0,0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: colors.text,
    padding: 0,
  }),
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  gradeBadge: (colors) => ({
    background: colors.accent,
    color: 'white',
    padding: '4px 12px',
    borderRadius: '4px',
    fontWeight: 700,
    fontSize: '15px',
  }),
  expandIcon: (colors) => ({
    color: colors.text,
    fontSize: '18px',
  }),
  cardBody: {
    padding: '12px 14px',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  metricLabel: {
    color: '#555',
    fontSize: '12px',
  },
  metricValueSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  metricValue: (highlight) => ({
    fontWeight: 600,
    fontSize: '13px',
    color: highlight ? '#2563eb' : '#222',
  }),
  percentileBadge: (color) => ({
    fontSize: '10px',
    color: color,
    background: `${color}15`,
    padding: '2px 6px',
    borderRadius: '3px',
  }),
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '400px',
    margin: '16px',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
  },
  modalDesc: {
    color: '#555',
    fontSize: '13px',
    marginBottom: '12px',
  },
  factorsList: {
    margin: '8px 0 0',
    paddingLeft: '18px',
    color: '#444',
    fontSize: '12px',
  },
};

const CATEGORY_ICONS = {
  demand: BarChart3,
  abilityToPay: DollarSign,
  competition: Building2,
  growth: TrendingUp,
  labor: Users,
  quality: Star,
};

const CATEGORY_LABELS = {
  demand: 'Demand',
  abilityToPay: 'Ability to Pay',
  competition: 'Competition',
  growth: 'Growth',
  labor: 'Labor Market',
  quality: 'Quality',
};

const EXPLANATIONS = {
  demand: {
    title: 'Demand Score',
    desc: 'Market size based on elderly population and care need estimates.',
    factors: ['65+ Population', '85+ Population', 'Need Population (disability-based)'],
  },
  abilityToPay: {
    title: 'Ability to Pay',
    desc: "Market's capacity to afford private-pay rates.",
    factors: ['Median Income (35%)', 'Home Value (30%)', 'Poverty Rate (20%)', 'Homeownership (15%)'],
  },
  competition: {
    title: 'Competition Score',
    desc: 'Market saturation and competitive dynamics. Lower supply = better for operators.',
    factors: ['Penetration rate (beds/1K seniors)', 'Need gap vs supply', 'Market occupancy (SNF only)', 'New facility openings'],
  },
  growth: {
    title: 'Growth Score',
    desc: 'Projected demand based on population forecasts.',
    factors: ['65+ growth to 2030 (30%)', '85+ growth to 2030 (70%)'],
  },
  labor: {
    title: 'Labor Market',
    desc: 'Staffing costs and availability (50-60% of operating costs).',
    factors: ['CNA/LPN wages (CBSA-adjusted)', 'Healthcare unemployment rate'],
  },
  quality: {
    title: 'Quality Score (SNF)',
    desc: 'CMS quality metrics for skilled nursing facilities.',
    factors: ['Average star ratings', 'Health inspection scores', 'Deficiency counts', 'Special Focus Facilities'],
  },
};

const MetricRow = ({ label, value, percentile, highlight }) => {
  let pColor = '#666';
  if (percentile) {
    if (percentile.includes('Top') || percentile.includes('Favorable') || percentile.includes('Strong') || percentile.includes('Opportunity')) {
      pColor = '#28a745';
    } else if (percentile.includes('Above') || percentile.includes('Moderate') || percentile.includes('Available')) {
      pColor = '#17a2b8';
    } else if (percentile.includes('Below') || percentile.includes('Bottom') || percentile.includes('Saturated') || percentile.includes('Weak') || percentile.includes('Tight') || percentile.includes('Warning') || percentile.includes('High')) {
      pColor = '#dc3545';
    }
  }

  return (
    <div style={styles.metricRow}>
      <span style={styles.metricLabel}>{label}</span>
      <div style={styles.metricValueSection}>
        <span style={styles.metricValue(highlight)}>{value}</span>
        {percentile && <span style={styles.percentileBadge(pColor)}>{percentile}</span>}
      </div>
    </div>
  );
};

const ExplanationModal = ({ category, onClose }) => {
  const exp = EXPLANATIONS[category];
  if (!exp) return null;

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{exp.title}</h3>
          <button style={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <p style={styles.modalDesc}>{exp.desc}</p>
        <div style={{ fontSize: '12px' }}>
          <strong>Factors:</strong>
          <ul style={styles.factorsList}>
            {exp.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const CategoryCard = ({ category, score, expanded, onToggle, onInfo, children }) => {
  const grade = calculateLetterGrade(score);
  const colors = getGradeColor(grade);
  const Icon = CATEGORY_ICONS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader(colors, expanded)} onClick={onToggle}>
        <div style={styles.headerLeft}>
          {Icon && <Icon size={16} color={colors.text} />}
          <span style={styles.title(colors)}>{label}</span>
          <button
            style={styles.helpButton(colors)}
            onClick={(e) => {
              e.stopPropagation();
              onInfo();
            }}
          >
            <HelpCircle size={12} />
          </button>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.gradeBadge(colors)}>{grade}</div>
          {expanded ? (
            <ChevronUp size={18} color={colors.text} />
          ) : (
            <ChevronDown size={18} color={colors.text} />
          )}
        </div>
      </div>
      {expanded && <div style={styles.cardBody}>{children}</div>}
    </div>
  );
};

const CategoryScorecard = ({ scores, marketData, facilityType, laborData }) => {
  const [expandedCards, setExpandedCards] = useState({
    demand: true,
    abilityToPay: true,
    competition: true,
    growth: true,
    labor: true,
    quality: true,
  });
  const [showExplanation, setShowExplanation] = useState(null);

  const toggleCard = (key) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!scores || !marketData) return null;

  const { demographics, supply } = marketData;
  const supplyData = facilityType === 'SNF' ? supply : marketData.alfSupply || supply;
  const nat = NATIONAL_BENCHMARKS;

  // Extract population data from nested structure
  const pop65 = Number(demographics?.population?.age65Plus || demographics?.populationAge65Plus || 0);
  const pop85 = Number(demographics?.population?.age85Plus || demographics?.populationAge85Plus || 0);

  // Extract economic data from nested structure
  const medianIncome = Number(demographics?.economics?.medianHouseholdIncome || demographics?.medianHouseholdIncome || 0);
  const medianHomeValue = Number(demographics?.economics?.medianHomeValue || demographics?.medianHomeValue || 0);
  const povertyRate = Number(demographics?.economics?.povertyRate || demographics?.povertyRate || 0);
  const homeownershipRate = Number(demographics?.economics?.homeownershipRate || demographics?.homeownershipRate || 0);

  // Extract growth projections from nested structure
  const growth65 = Number(demographics?.projections?.growthRate65Plus || demographics?.growthRate65Plus || demographics?.seniorGrowthRate || 0);
  const growth85 = Number(demographics?.projections?.growthRate85Plus || demographics?.growthRate85Plus || 0);
  const projected65_2030 = Number(demographics?.projections?.age65Plus2030 || demographics?.projected65Plus2030 || 0);
  const projected85_2030 = Number(demographics?.projections?.age85Plus2030 || demographics?.projected85Plus2030 || 0);

  // Computed metrics
  const totalBeds = Number(supplyData?.beds?.total || supplyData?.totalBeds || supplyData?.beds || 0);
  const facilityCount = Number(supplyData?.facilityCount || supplyData?.facilities || 0);
  const avgOccupancy = Number(supplyData?.avgOccupancy || 0);
  const avgRating = Number(supplyData?.avgRating || 0);

  const bedsPerThousand65 = pop65 > 0 ? (totalBeds / pop65) * 1000 : 0;
  const bedsPerThousand85 = pop85 > 0 ? (totalBeds / pop85) * 1000 : 0;

  const needEstimate = Number(demographics?.totalAlNeed || (pop65 > 0 ? Math.round(pop65 * 0.03) : 0));
  const needGap = needEstimate - totalBeds;

  // Labor calculations
  const localCNAWage = laborData?.state_cna_wage && laborData?.cbsa_wage_index
    ? Number(laborData.state_cna_wage) * Number(laborData.cbsa_wage_index)
    : Number(laborData?.avgCNAWage || 15.50);
  const localLPNWage = laborData?.state_lpn_wage && laborData?.cbsa_wage_index
    ? Number(laborData.state_lpn_wage) * Number(laborData.cbsa_wage_index)
    : Number(laborData?.avgLPNWage || 23.00);

  // Implied budget calculation
  const impliedBudget = medianIncome > 0
    ? Math.min(Math.round((medianIncome * 0.074) / 100) * 100, 8500)
    : 0;

  // Labor cost per bed calculation
  const laborCost = laborData ? calculateLaborCostPerBedLocal(laborData) : 2500;

  function calculateLaborCostPerBedLocal(labor) {
    const cnaWage = labor.state_cna_wage && labor.cbsa_wage_index
      ? Number(labor.state_cna_wage) * Number(labor.cbsa_wage_index)
      : Number(labor.avgCNAWage || 15.50);
    const lpnWage = labor.state_lpn_wage && labor.cbsa_wage_index
      ? Number(labor.state_lpn_wage) * Number(labor.cbsa_wage_index)
      : Number(labor.avgLPNWage || 23.00);
    const rnWage = labor.state_rn_wage && labor.cbsa_wage_index
      ? Number(labor.state_rn_wage) * Number(labor.cbsa_wage_index)
      : Number(labor.avgRNWage || 34.00);
    const wageIndex = Number(labor.cbsa_wage_index || 1.0);
    const adminWage = 28 * wageIndex;
    const supportWage = 15 * wageIndex;

    const annualLaborPerBed = (
      (cnaWage * 0.40 * 2080) +
      (lpnWage * 0.08 * 2080) +
      (rnWage * 0.017 * 2080) +
      (adminWage * 0.05 * 2080) +
      (supportWage * 0.10 * 2080)
    );

    const withBenefits = annualLaborPerBed * 1.28;
    return Math.round(withBenefits / 12);
  }

  return (
    <>
      {showExplanation && (
        <ExplanationModal
          category={showExplanation}
          onClose={() => setShowExplanation(null)}
        />
      )}

      <div style={styles.grid(facilityType)}>
        {/* DEMAND */}
        <CategoryCard
          category="demand"
          score={scores.demand}
          expanded={expandedCards.demand}
          onToggle={() => toggleCard('demand')}
          onInfo={() => setShowExplanation('demand')}
        >
          <MetricRow
            label="65+ Population"
            value={pop65.toLocaleString()}
            percentile={getPercentileLabel(pop65, 50000)}
          />
          <MetricRow
            label="85+ Population"
            value={pop85.toLocaleString()}
            percentile={getPercentileLabel(pop85, 8000)}
          />
          {/* Need Population only applies to ALF - based on disability prevalence */}
          {facilityType === 'ALF' && (
            <MetricRow
              label="Need Population"
              value={needEstimate.toLocaleString()}
              percentile="Disability-based"
            />
          )}
          <MetricRow
            label="65+ Growth (2030)"
            value={`+${growth65.toFixed(1)}%`}
            percentile={getPercentileLabel(growth65, NATIONAL_BENCHMARKS.growth65)}
          />
        </CategoryCard>

        {/* ABILITY TO PAY */}
        <CategoryCard
          category="abilityToPay"
          score={scores.abilityToPay}
          expanded={expandedCards.abilityToPay}
          onToggle={() => toggleCard('abilityToPay')}
          onInfo={() => setShowExplanation('abilityToPay')}
        >
          <MetricRow
            label="Median Income"
            value={`$${(medianIncome / 1000).toFixed(0)}K`}
            percentile={getPercentileLabel(medianIncome, 65000)}
          />
          <MetricRow
            label="Median Home Value"
            value={`$${(medianHomeValue / 1000).toFixed(0)}K`}
            percentile={getPercentileLabel(medianHomeValue, 230000)}
          />
          <MetricRow
            label="Homeownership"
            value={`${homeownershipRate.toFixed(1)}%`}
            percentile={getPercentileLabel(homeownershipRate, 65)}
          />
          <MetricRow
            label="Poverty Rate"
            value={`${povertyRate.toFixed(1)}%`}
            percentile={getPercentileLabel(povertyRate, 12.4, false)}
          />
          <MetricRow
            label="Implied Monthly Budget"
            value={`$${impliedBudget.toLocaleString()}`}
            percentile="7.4% rule"
            highlight
          />
        </CategoryCard>

        {/* COMPETITION */}
        <CategoryCard
          category="competition"
          score={scores.competition}
          expanded={expandedCards.competition}
          onToggle={() => toggleCard('competition')}
          onInfo={() => setShowExplanation('competition')}
        >
          <MetricRow
            label="Facilities"
            value={facilityCount}
          />
          <MetricRow
            label="Total Beds"
            value={totalBeds.toLocaleString()}
          />
          <MetricRow
            label="Beds per 1K 65+"
            value={bedsPerThousand65.toFixed(1)}
            percentile={
              bedsPerThousand65 < 15 ? 'Favorable (low supply)' :
              bedsPerThousand65 < 22 ? 'Moderate' : 'Saturated'
            }
          />
          <MetricRow
            label="Beds per 1K 85+"
            value={bedsPerThousand85.toFixed(1)}
          />
          {facilityType === 'SNF' && avgOccupancy > 0 && (
            <MetricRow
              label="Avg Market Occupancy"
              value={`${avgOccupancy.toFixed(0)}%`}
              percentile={
                avgOccupancy >= 85 ? 'Strong demand' :
                avgOccupancy >= 78 ? 'Moderate' : 'Weak demand'
              }
              highlight={avgOccupancy >= 85}
            />
          )}
          {/* Need Gap only applies to ALF - based on disability-need population estimate */}
          {facilityType === 'ALF' && (
            <MetricRow
              label="Need Gap"
              value={needGap > 0 ? `+${needGap.toLocaleString()} under` : `${needGap.toLocaleString()} over`}
              percentile={needGap > 200 ? 'Opportunity' : 'Balanced'}
              highlight
            />
          )}
          <MetricRow
            label="New Since 2021"
            value={supplyData?.newSince2021 || 0}
          />
        </CategoryCard>

        {/* GROWTH */}
        <CategoryCard
          category="growth"
          score={scores.growth}
          expanded={expandedCards.growth}
          onToggle={() => toggleCard('growth')}
          onInfo={() => setShowExplanation('growth')}
        >
          <MetricRow
            label="65+ Growth (2030)"
            value={`+${growth65.toFixed(1)}%`}
            percentile={getPercentileLabel(growth65, NATIONAL_BENCHMARKS.growth65)}
          />
          <MetricRow
            label="85+ Growth (2030)"
            value={`+${growth85.toFixed(1)}%`}
            percentile={getPercentileLabel(growth85, NATIONAL_BENCHMARKS.growth85)}
          />
          <MetricRow
            label="Projected 65+ (2030)"
            value={projected65_2030.toLocaleString()}
          />
          <MetricRow
            label="Projected 85+ (2030)"
            value={projected85_2030.toLocaleString()}
          />
        </CategoryCard>

        {/* LABOR MARKET */}
        <CategoryCard
          category="labor"
          score={scores.labor}
          expanded={expandedCards.labor}
          onToggle={() => toggleCard('labor')}
          onInfo={() => setShowExplanation('labor')}
        >
          <MetricRow
            label="CNA Wage (adjusted)"
            value={`$${Number(localCNAWage).toFixed(2)}/hr`}
            percentile={getPercentileLabel(localCNAWage, nat.cnaWage, false)}
          />
          <MetricRow
            label="LPN Wage (adjusted)"
            value={`$${Number(localLPNWage).toFixed(2)}/hr`}
            percentile={getPercentileLabel(localLPNWage, nat.lpnWage, false)}
          />
          <MetricRow
            label="Healthcare Unemployment"
            value={`${laborData?.healthcare_unemployment || laborData?.healthcareUnemployment || 0}%`}
            percentile={
              (laborData?.healthcare_unemployment || laborData?.healthcareUnemployment || 0) < 2.5 ? 'Tight' :
              (laborData?.healthcare_unemployment || laborData?.healthcareUnemployment || 0) < 3.5 ? 'Moderate' : 'Available'
            }
          />
          <MetricRow
            label="CBSA Wage Index"
            value={Number(laborData?.cbsa_wage_index || 1.0).toFixed(2)}
            percentile={laborData?.cbsa || marketData?.cbsa || ''}
          />
          <MetricRow
            label="Labor Cost/Bed"
            value={`$${laborCost.toLocaleString()}/mo`}
            highlight
          />
        </CategoryCard>

        {/* QUALITY (SNF Only) */}
        {facilityType === 'SNF' && scores.quality !== null && (
          <CategoryCard
            category="quality"
            score={scores.quality}
            expanded={expandedCards.quality}
            onToggle={() => toggleCard('quality')}
            onInfo={() => setShowExplanation('quality')}
          >
            <MetricRow
              label="Avg Overall Rating"
              value={`${avgRating.toFixed(1)} ★`}
              percentile={getPercentileLabel(avgRating, nat.snfRating)}
            />
            <MetricRow
              label="Health Inspection"
              value={`${Number(supplyData?.avgHealthInspection || avgRating || 0).toFixed(1)} ★`}
            />
            <MetricRow
              label="Staffing Rating"
              value={`${Number(supplyData?.avgStaffing || 0).toFixed(1)} ★`}
            />
            <MetricRow
              label="Quality Measures"
              value={`${Number(supplyData?.avgQualityMeasures || 0).toFixed(1)} ★`}
            />
            <MetricRow
              label="Total Deficiencies"
              value={Number(supplyData?.totalDeficiencies || 0)}
              percentile={
                facilityCount > 0 && (Number(supplyData?.totalDeficiencies || 0) / facilityCount) > 12
                  ? 'High'
                  : 'Normal'
              }
            />
            {Number(supplyData?.sffCount || 0) > 0 && (
              <MetricRow
                label="Special Focus Facilities"
                value={`${supplyData.sffCount} 🚩`}
                percentile="Warning"
              />
            )}
          </CategoryCard>
        )}
      </div>
    </>
  );
};

export default CategoryScorecard;
