import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

/**
 * Improvement scenarios based on national percentile targets
 */
const IMPROVEMENT_SCENARIOS = [
  { percentile: 75, label: 'Good', multiplier: 1.0120, color: '#22c55e' },
  { percentile: 90, label: 'Great', multiplier: 1.0180, color: '#16a34a' },
  { percentile: 95, label: 'Excellent', multiplier: 1.0220, color: '#15803d' },
  { percentile: 99, label: 'Top', multiplier: 1.0280, color: '#166534' }
];

/**
 * Risk scenarios for performance decline
 */
const RISK_SCENARIOS = [
  { percentile: 50, label: 'Average', multiplier: 0.9980, color: '#eab308' },
  { percentile: 25, label: 'Below Average', multiplier: 0.9920, color: '#f97316' },
  { percentile: 10, label: 'Poor', multiplier: 0.9850, color: '#ef4444' }
];

/**
 * Estimate Medicare revenue based on facility bed count
 * FY2024 average: ~$450/day Medicare per-diem × 365 days × 60% occupancy
 */
const estimateMedicareRevenue = (bedCount) => {
  const avgDailyRate = 450;
  const avgOccupancy = 0.60;
  const medicarePatientMix = 0.25; // Assume 25% Medicare
  return bedCount * avgDailyRate * 365 * avgOccupancy * medicarePatientMix;
};

/**
 * Calculate dollar impact from multiplier change
 */
const calculateImpact = (baseRevenue, currentMultiplier, targetMultiplier) => {
  const currentAdjustment = (currentMultiplier - 1) * baseRevenue;
  const targetAdjustment = (targetMultiplier - 1) * baseRevenue;
  const change = targetAdjustment - currentAdjustment;
  return {
    current: currentAdjustment,
    target: targetAdjustment,
    change
  };
};

/**
 * Format currency
 */
const formatCurrency = (value, showSign = false) => {
  if (value == null) return '—';
  const absValue = Math.abs(value);
  const formatted = absValue >= 1000000
    ? `$${(absValue / 1000000).toFixed(2)}M`
    : absValue >= 1000
      ? `$${(absValue / 1000).toFixed(0)}K`
      : `$${absValue.toFixed(0)}`;

  if (showSign) {
    return value >= 0 ? `+${formatted}` : `-${formatted.substring(1)}`;
  }
  return value < 0 ? `-${formatted.substring(1)}` : formatted;
};

/**
 * Multiplier visualization bar
 */
const MultiplierBar = ({ multiplier, showMarker = true }) => {
  // Range: 0.96x to 1.04x, with 1.0 as center (break-even)
  const minMult = 0.96;
  const maxMult = 1.04;
  const range = maxMult - minMult;

  // Calculate position (0-100%)
  const position = multiplier != null
    ? Math.max(0, Math.min(100, ((multiplier - minMult) / range) * 100))
    : 50;

  // Break-even position
  const breakEvenPosition = ((1.0 - minMult) / range) * 100;

  // Color based on position relative to break-even
  const getBarColor = () => {
    if (multiplier == null) return '#9ca3af';
    if (multiplier >= 1.02) return '#22c55e';
    if (multiplier >= 1.0) return '#84cc16';
    if (multiplier >= 0.98) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="vbp-multiplier-bar-container">
      <div className="vbp-multiplier-bar">
        {/* Penalty zone (red) */}
        <div
          className="vbp-multiplier-zone penalty"
          style={{ width: `${breakEvenPosition}%` }}
        />
        {/* Bonus zone (green) */}
        <div
          className="vbp-multiplier-zone bonus"
          style={{ width: `${100 - breakEvenPosition}%` }}
        />
        {/* Break-even marker */}
        <div
          className="vbp-multiplier-breakeven"
          style={{ left: `${breakEvenPosition}%` }}
        />
        {/* Current position marker */}
        {showMarker && multiplier != null && (
          <div
            className="vbp-multiplier-marker"
            style={{
              left: `${position}%`,
              backgroundColor: getBarColor()
            }}
          />
        )}
      </div>
      <div className="vbp-multiplier-labels">
        <span>0.96x</span>
        <span className="vbp-multiplier-breakeven-label">1.00x</span>
        <span>1.04x</span>
      </div>
    </div>
  );
};

/**
 * Scenario row component
 */
const ScenarioRow = ({ scenario, impact, isImprovement }) => {
  const Icon = isImprovement ? TrendingUp : TrendingDown;

  return (
    <tr>
      <td>
        <div className="vbp-scenario-label">
          <span
            className="vbp-scenario-dot"
            style={{ backgroundColor: scenario.color }}
          />
          {scenario.label}
          <span className="vbp-scenario-percentile">
            ({scenario.percentile}th percentile)
          </span>
        </div>
      </td>
      <td className="vbp-scenario-multiplier">
        {scenario.multiplier.toFixed(4)}x
      </td>
      <td className={`vbp-scenario-impact ${impact.change >= 0 ? 'positive' : 'negative'}`}>
        <Icon size={14} />
        {formatCurrency(impact.change, true)}
      </td>
    </tr>
  );
};

/**
 * VBPFinancialImpact - Shows dollar impact of VBP performance
 */
const VBPFinancialImpact = ({ vbpData, facility }) => {
  const current = vbpData?.current;
  const estimatedImpact = vbpData?.estimated_impact;

  // Get current multiplier
  const currentMultiplier = current?.incentive_multiplier;

  // Estimate Medicare revenue (use facility beds or default to 120)
  const bedCount = facility?.number_of_certified_beds || 120;
  const estimatedRevenue = estimateMedicareRevenue(bedCount);

  // Use actual impact if available, otherwise calculate
  const actualImpact = estimatedImpact?.annual_impact;
  const displayImpact = actualImpact ?? (currentMultiplier
    ? (currentMultiplier - 1) * estimatedRevenue
    : null);

  // Calculate improvement scenarios
  const improvementScenarios = useMemo(() => {
    if (currentMultiplier == null) return [];
    return IMPROVEMENT_SCENARIOS.map(scenario => ({
      ...scenario,
      impact: calculateImpact(estimatedRevenue, currentMultiplier, scenario.multiplier)
    }));
  }, [currentMultiplier, estimatedRevenue]);

  // Calculate risk scenarios
  const riskScenarios = useMemo(() => {
    if (currentMultiplier == null) return [];
    return RISK_SCENARIOS.map(scenario => ({
      ...scenario,
      impact: calculateImpact(estimatedRevenue, currentMultiplier, scenario.multiplier)
    }));
  }, [currentMultiplier, estimatedRevenue]);

  // Check if facility is in penalty
  const isInPenalty = currentMultiplier != null && currentMultiplier < 1.0;

  // Empty state
  if (!current || currentMultiplier == null) {
    return (
      <div className="vbp-financial-impact">
        <h3>
          <DollarSign size={20} />
          Financial Impact
        </h3>
        <div className="vbp-financial-empty">
          <p>No financial impact data available for this facility.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vbp-financial-impact">
      <h3>
        <DollarSign size={20} />
        Financial Impact
      </h3>

      {/* Current Status */}
      <div className="vbp-financial-current">
        <div className="vbp-financial-current-header">
          <span className="vbp-financial-fy">FY{current.fiscal_year}</span>
          <span className="vbp-financial-status">
            {isInPenalty ? (
              <>
                <AlertTriangle size={16} className="penalty" />
                Payment Penalty
              </>
            ) : currentMultiplier > 1.0 ? (
              <>
                <TrendingUp size={16} className="bonus" />
                Payment Bonus
              </>
            ) : (
              'Break-even'
            )}
          </span>
        </div>

        <div className="vbp-financial-multiplier">
          <div className="vbp-financial-multiplier-value">
            {currentMultiplier.toFixed(4)}x
          </div>
          <MultiplierBar multiplier={currentMultiplier} />
        </div>

        <div className="vbp-financial-summary">
          <div className="vbp-financial-summary-item">
            <span className="vbp-financial-summary-label">Estimated Annual Impact</span>
            <span className={`vbp-financial-summary-value ${displayImpact >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(displayImpact, true)}
            </span>
          </div>
          <div className="vbp-financial-summary-item">
            <span className="vbp-financial-summary-label">Based on Est. Medicare Revenue</span>
            <span className="vbp-financial-summary-value">
              {formatCurrency(estimatedRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Improvement Scenarios */}
      {improvementScenarios.length > 0 && (
        <div className="vbp-financial-scenarios">
          <h4>
            <TrendingUp size={16} />
            Improvement Opportunities
          </h4>
          <table className="vbp-scenarios-table">
            <thead>
              <tr>
                <th>Target Performance</th>
                <th>Multiplier</th>
                <th>Additional Impact</th>
              </tr>
            </thead>
            <tbody>
              {improvementScenarios.map(scenario => (
                <ScenarioRow
                  key={scenario.percentile}
                  scenario={scenario}
                  impact={scenario.impact}
                  isImprovement={true}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Risk Scenarios */}
      {riskScenarios.length > 0 && (
        <div className="vbp-financial-scenarios risk">
          <h4>
            <TrendingDown size={16} />
            Performance Risk
          </h4>
          <table className="vbp-scenarios-table">
            <thead>
              <tr>
                <th>If Performance Declines To</th>
                <th>Multiplier</th>
                <th>Impact Change</th>
              </tr>
            </thead>
            <tbody>
              {riskScenarios.map(scenario => (
                <ScenarioRow
                  key={scenario.percentile}
                  scenario={scenario}
                  impact={scenario.impact}
                  isImprovement={false}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      <div className="vbp-financial-disclaimer">
        <AlertTriangle size={14} />
        <p>
          Estimates based on {bedCount} certified beds, 60% occupancy, and 25% Medicare patient mix.
          Actual impact varies based on facility-specific Medicare revenue and claims.
        </p>
      </div>
    </div>
  );
};

export default VBPFinancialImpact;
