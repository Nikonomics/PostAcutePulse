import React, { useMemo } from 'react';
import { FileText, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Generate a natural language summary of the facility based on available data
 */
const generateSummary = (facility) => {
  const strengths = [];
  const concerns = [];

  // Overall rating assessment
  const overallRating = parseInt(facility.overall_rating);
  if (overallRating >= 4) {
    strengths.push(`a ${overallRating}-star overall rating`);
  } else if (overallRating <= 2) {
    concerns.push(`a below-average ${overallRating}-star overall rating`);
  }

  // Staffing analysis
  const staffingRating = parseInt(facility.staffing_rating);
  if (staffingRating >= 4) {
    strengths.push('strong staffing levels');
  } else if (staffingRating <= 2) {
    concerns.push('below-average staffing');
  }

  // Quality measures
  const qualityRating = parseInt(facility.quality_rating || facility.qm_rating);
  if (qualityRating >= 4) {
    strengths.push('excellent quality measure performance');
  } else if (qualityRating <= 2) {
    concerns.push('quality measure scores that need improvement');
  }

  // Deficiencies
  const totalDeficiencies = parseInt(facility.cycle1_total_health_deficiencies) || 0;
  if (totalDeficiencies === 0) {
    strengths.push('no health deficiencies in the most recent survey');
  } else if (totalDeficiencies > 10) {
    concerns.push(`${totalDeficiencies} health deficiencies from the last survey`);
  }

  // Turnover
  const rnTurnover = parseFloat(facility.rn_turnover);
  if (!isNaN(rnTurnover)) {
    if (rnTurnover <= 30) {
      strengths.push('low RN turnover');
    } else if (rnTurnover >= 60) {
      concerns.push(`high RN turnover (${rnTurnover.toFixed(0)}%)`);
    }
  }

  // Penalties
  const penaltyAmount = parseFloat(facility.fine_total_dollars) || 0;
  if (penaltyAmount > 50000) {
    concerns.push(`significant penalty history ($${(penaltyAmount / 1000).toFixed(0)}K in fines)`);
  }

  // SFF status
  if (facility.sff_or_candidate === 'SFF') {
    concerns.push('Special Focus Facility status (persistent quality issues)');
  } else if (facility.sff_or_candidate === 'Candidate') {
    concerns.push('SFF candidate status (at risk for special monitoring)');
  }

  // Build the narrative
  const narrativeParts = [];
  const facilityName = facility.provider_name || 'This facility';
  const state = facility.state;
  const beds = facility.certified_beds;

  // Opening sentence
  narrativeParts.push(
    `${facilityName} is a ${beds}-bed skilled nursing facility in ${facility.city}, ${state}.`
  );

  // Strengths
  if (strengths.length > 0) {
    const strengthsText = strengths.length === 1
      ? strengths[0]
      : strengths.slice(0, -1).join(', ') + ' and ' + strengths[strengths.length - 1];
    narrativeParts.push(`Notable strengths include ${strengthsText}.`);
  }

  // Concerns
  if (concerns.length > 0) {
    const concernsText = concerns.length === 1
      ? concerns[0]
      : concerns.slice(0, -1).join(', ') + ' and ' + concerns[concerns.length - 1];
    narrativeParts.push(`Areas to monitor include ${concernsText}.`);
  }

  // If no notable strengths or concerns
  if (strengths.length === 0 && concerns.length === 0) {
    narrativeParts.push(
      `The facility shows average performance across most metrics with no significant outliers.`
    );
  }

  return {
    narrative: narrativeParts.join(' '),
    strengths,
    concerns,
    hasStrengths: strengths.length > 0,
    hasConcerns: concerns.length > 0,
  };
};

const FacilitySummaryCard = ({ facility }) => {
  const summary = useMemo(() => {
    if (!facility) return null;
    return generateSummary(facility);
  }, [facility]);

  if (!facility || !summary) {
    return null;
  }

  const { narrative, strengths, concerns, hasStrengths, hasConcerns } = summary;

  return (
    <div className="metrics-card facility-summary-card">
      <div className="metrics-card-header">
        <FileText size={18} className="status-neutral" />
        <h4>Facility Summary</h4>
      </div>

      <div className="summary-content">
        <p className="summary-narrative">{narrative}</p>

        {(hasStrengths || hasConcerns) && (
          <div className="summary-highlights">
            {hasStrengths && (
              <div className="summary-section strengths">
                <div className="summary-section-header">
                  <CheckCircle size={14} className="status-good" />
                  <span>Strengths</span>
                </div>
                <ul className="summary-list">
                  {strengths.map((strength, idx) => (
                    <li key={idx}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasConcerns && (
              <div className="summary-section concerns">
                <div className="summary-section-header">
                  <AlertTriangle size={14} className="status-warning" />
                  <span>Areas to Monitor</span>
                </div>
                <ul className="summary-list">
                  {concerns.map((concern, idx) => (
                    <li key={idx}>{concern}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacilitySummaryCard;
