import React from 'react';
import { Building2 } from 'lucide-react';

const formatTenure = (days) => {
  if (days == null) return 'N/A';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = (days / 365).toFixed(1);
  return `${years} years`;
};

const formatOwnership = (type) => {
  if (!type) return 'Unknown';
  // Simplify verbose CMS ownership types
  if (type.toLowerCase().includes('for profit')) return 'For-Profit';
  if (type.toLowerCase().includes('non profit') || type.toLowerCase().includes('nonprofit'))
    return 'Non-Profit';
  if (type.toLowerCase().includes('government')) return 'Government';
  return type;
};

const getOwnershipColor = (type) => {
  if (!type) return '#6b7280';
  if (type.toLowerCase().includes('for profit')) return '#3b82f6'; // blue
  if (type.toLowerCase().includes('non profit') || type.toLowerCase().includes('nonprofit'))
    return '#22c55e'; // green
  if (type.toLowerCase().includes('government')) return '#8b5cf6'; // purple
  return '#6b7280'; // gray
};

const getOwnershipSubtext = (type) => {
  if (!type) return null;
  if (type.toLowerCase().includes('corporation')) return 'Corporation';
  if (type.toLowerCase().includes('individual')) return 'Individual';
  if (type.toLowerCase().includes('partnership')) return 'Partnership';
  if (type.toLowerCase().includes('limited liability')) return 'LLC';
  return null;
};

const OwnershipContextCard = ({ facility }) => {
  if (!facility) return null;

  const ownershipType = formatOwnership(facility.ownership_type);
  const ownershipColor = getOwnershipColor(facility.ownership_type);
  const ownershipSubtext = getOwnershipSubtext(facility.ownership_type);

  const chainName = facility.chain_name || null;
  const isIndependent = !chainName;

  const tenureFormatted = formatTenure(facility.administrator_days_in_role);
  const tenureDays = facility.administrator_days_in_role;

  const beds = facility.certified_beds;
  const residents = facility.residents_total;
  const occupancy = facility.occupancy_rate;

  return (
    <div className="metrics-card ownership-context-card">
      <div className="metrics-card-header">
        <Building2 size={18} style={{ color: '#6b7280' }} />
        <h4>Ownership & Context</h4>
      </div>

      <div className="ownership-grid">
        {/* Ownership Type */}
        <div className="ownership-info-block">
          <span className="info-label">Ownership Type</span>
          <span className="info-value" style={{ color: ownershipColor }}>
            {ownershipType}
          </span>
          {ownershipSubtext && <span className="info-subtext">{ownershipSubtext}</span>}
        </div>

        {/* Chain Affiliation */}
        <div className="ownership-info-block">
          <span className="info-label">Chain Affiliation</span>
          <span className={`info-value ${isIndependent ? 'independent' : ''}`}>
            {chainName || 'Independent Facility'}
          </span>
          {isIndependent && <span className="info-subtext">Not part of a chain</span>}
        </div>

        {/* Administrator Tenure */}
        <div className="ownership-info-block">
          <span className="info-label">Administrator Tenure</span>
          <span className="info-value">{tenureFormatted}</span>
          {tenureDays != null && tenureDays >= 30 && (
            <span className="info-subtext">{tenureDays.toLocaleString()} days in role</span>
          )}
        </div>

        {/* Facility Size */}
        <div className="ownership-info-block">
          <span className="info-label">Facility Size</span>
          <span className="info-value">{beds != null ? `${beds} beds` : 'N/A'}</span>
          {(residents != null || occupancy != null) && (
            <span className="info-subtext">
              {residents != null ? `${residents} residents` : ''}
              {residents != null && occupancy != null ? ' · ' : ''}
              {occupancy != null ? `${occupancy}% occupancy` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnershipContextCard;
