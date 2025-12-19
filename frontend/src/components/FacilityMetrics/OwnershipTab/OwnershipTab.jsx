import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  User,
  Users,
  Loader,
  Percent,
  Briefcase,
  Calendar,
  ExternalLink,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { getFacilityOwnership } from '../../../api/facilityService';
import './OwnershipTab.css';

// Role type display info
const ROLE_INFO = {
  'DIRECT OWNERSHIP': { label: 'Direct Ownership', color: '#3b82f6', icon: Percent },
  '5% OR GREATER DIRECT OWNERSHIP INTEREST': { label: 'Direct Owner (5%+)', color: '#3b82f6', icon: Percent },
  'INDIRECT OWNERSHIP': { label: 'Indirect Ownership', color: '#8b5cf6', icon: Building2 },
  '5% OR GREATER INDIRECT OWNERSHIP INTEREST': { label: 'Indirect Owner (5%+)', color: '#8b5cf6', icon: Building2 },
  'OFFICER/DIRECTOR': { label: 'Officer/Director', color: '#f97316', icon: Briefcase },
  'MANAGING EMPLOYEE': { label: 'Managing Employee', color: '#22c55e', icon: User },
  'OPERATIONAL/MANAGERIAL': { label: 'Operational/Managerial', color: '#22c55e', icon: Users },
};

const getRoleInfo = (roleType) => {
  if (!roleType) return { label: 'Other', color: '#6b7280', icon: Building2 };

  // Check for exact match first
  if (ROLE_INFO[roleType]) return ROLE_INFO[roleType];

  // Check for partial matches
  const upperRole = roleType.toUpperCase();
  if (upperRole.includes('DIRECT') && upperRole.includes('OWNERSHIP')) {
    return { label: 'Direct Owner', color: '#3b82f6', icon: Percent };
  }
  if (upperRole.includes('INDIRECT')) {
    return { label: 'Indirect Owner', color: '#8b5cf6', icon: Building2 };
  }
  if (upperRole.includes('OFFICER') || upperRole.includes('DIRECTOR')) {
    return { label: 'Officer/Director', color: '#f97316', icon: Briefcase };
  }
  if (upperRole.includes('MANAGING') || upperRole.includes('MANAGER')) {
    return { label: 'Managing Employee', color: '#22c55e', icon: User };
  }

  return { label: roleType, color: '#6b7280', icon: Building2 };
};

const getOwnerTypeLabel = (type) => {
  if (!type) return 'Unknown';
  const t = type.toUpperCase();
  if (t.includes('INDIVIDUAL')) return 'Individual';
  if (t.includes('CORPORATION')) return 'Corporation';
  if (t.includes('LLC') || t.includes('LIMITED LIABILITY')) return 'LLC';
  if (t.includes('PARTNERSHIP')) return 'Partnership';
  if (t.includes('TRUST')) return 'Trust';
  if (t.includes('NON-PROFIT') || t.includes('NONPROFIT')) return 'Non-Profit';
  return type;
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const OwnershipTab = ({ facility }) => {
  const navigate = useNavigate();
  const [ownership, setOwnership] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (facility?.federal_provider_number || facility?.ccn) {
      loadOwnership();
    }
  }, [facility?.federal_provider_number, facility?.ccn]);

  const loadOwnership = async () => {
    const ccn = facility?.federal_provider_number || facility?.ccn;
    if (!ccn) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getFacilityOwnership(ccn);
      if (response.success) {
        setOwnership(response.ownership || []);
      } else {
        setError('Failed to load ownership data');
      }
    } catch (err) {
      setError(err.message || 'Unable to load ownership data.');
    } finally {
      setLoading(false);
    }
  };

  // Check if owner is an organization (not individual)
  const isOrganization = (owner) => {
    if (!owner.owner_type) return false;
    const type = owner.owner_type.toUpperCase();
    return !type.includes('INDIVIDUAL');
  };

  // Handle navigation to ownership research
  const handleOwnerClick = (owner) => {
    // Navigate to ownership research to search for this organization
    // Note: Not all owners have dedicated profiles - the search page handles this gracefully
    if (isOrganization(owner) && owner.owner_name) {
      navigate(`/ownership-research?owner=${encodeURIComponent(owner.owner_name)}`);
    }
  };

  // Show placeholder when no facility selected
  if (!facility) {
    return (
      <div className="placeholder-tab">
        <Building2 size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view ownership structure.</p>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="ownership-tab">
        <div className="ownership-loading">
          <Loader size={32} className="spinning" />
          <span>Loading ownership data...</span>
        </div>
      </div>
    );
  }

  // Show error state with retry
  if (error) {
    return (
      <div className="ownership-tab">
        <div className="ownership-error">
          <Building2 size={40} strokeWidth={1.5} />
          <h3>Unable to load ownership data</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={loadOwnership}>
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show empty state
  if (ownership.length === 0) {
    return (
      <div className="ownership-tab">
        <div className="ownership-empty">
          <Building2 size={48} strokeWidth={1.5} />
          <h3>No Ownership Records</h3>
          <p>No ownership records on file with CMS.</p>
        </div>
      </div>
    );
  }

  // Group ownership by role type for display
  const groupedByRole = ownership.reduce((acc, owner) => {
    const roleInfo = getRoleInfo(owner.role_type);
    const key = roleInfo.label;
    if (!acc[key]) {
      acc[key] = { info: roleInfo, owners: [] };
    }
    acc[key].owners.push(owner);
    return acc;
  }, {});

  // Sort groups: Direct owners first, then indirect, then officers, then others
  const sortedGroups = Object.entries(groupedByRole).sort(([a], [b]) => {
    const order = ['Direct Owner', 'Direct Ownership', 'Indirect Owner', 'Indirect Ownership', 'Officer/Director', 'Managing Employee'];
    const aIdx = order.findIndex(o => a.includes(o) || o.includes(a));
    const bIdx = order.findIndex(o => b.includes(o) || o.includes(b));
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // Get ownership chain from facility if available
  const ownershipChain = facility.ownership_chain;

  return (
    <div className="ownership-tab">
      {/* Summary Card */}
      <div className="ownership-summary-card">
        <div className="ownership-summary-header">
          <Building2 size={20} />
          <h3>Ownership Structure</h3>
          <span className="ownership-count">{ownership.length} records</span>
        </div>

        {ownershipChain && (
          <div className="ownership-chain-info">
            <span className="chain-label">Parent Chain:</span>
            <button
              className="chain-link"
              onClick={() => navigate(`/ownership-research?search=${encodeURIComponent(ownershipChain)}`)}
            >
              {ownershipChain}
              <ExternalLink size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Ownership Groups */}
      <div className="ownership-groups">
        {sortedGroups.map(([groupName, { info, owners }]) => {
          const Icon = info.icon;
          return (
            <div key={groupName} className="ownership-group-card">
              <div className="ownership-group-header" style={{ borderLeftColor: info.color }}>
                <Icon size={18} style={{ color: info.color }} />
                <span className="group-name">{groupName}</span>
                <span className="group-count">{owners.length}</span>
              </div>

              <div className="ownership-list">
                {owners.map((owner, idx) => {
                  const isClickable = isOrganization(owner);
                  return (
                    <div
                      key={idx}
                      className={`ownership-item ${isClickable ? 'clickable' : ''}`}
                      onClick={() => isClickable && handleOwnerClick(owner)}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onKeyDown={(e) => isClickable && e.key === 'Enter' && handleOwnerClick(owner)}
                    >
                      <div className="owner-main">
                        <div className="owner-icon">
                          {!isOrganization(owner) ? (
                            <User size={16} />
                          ) : (
                            <Building2 size={16} />
                          )}
                        </div>
                        <div className="owner-info">
                          <span className="owner-name">{owner.owner_name}</span>
                          <span className="owner-type">{getOwnerTypeLabel(owner.owner_type)}</span>
                        </div>
                        {isClickable && (
                          <ChevronRight size={16} className="owner-arrow" />
                        )}
                      </div>

                      <div className="owner-details">
                        {owner.ownership_percentage && (
                          <div className="owner-detail">
                            <Percent size={12} />
                            <span>{owner.ownership_percentage}% ownership</span>
                          </div>
                        )}
                        {owner.association_date && (
                          <div className="owner-detail">
                            <Calendar size={12} />
                            <span>Since {formatDate(owner.association_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Other Facilities Section - placeholder for future enhancement */}
      {ownershipChain && (
        <div className="related-facilities-section">
          <div className="related-facilities-header">
            <Users size={18} />
            <h4>Other Facilities Under Same Ownership</h4>
          </div>
          <p className="related-facilities-hint">
            View all facilities owned by {ownershipChain} in{' '}
            <button
              className="inline-link"
              onClick={() => navigate(`/ownership-research?search=${encodeURIComponent(ownershipChain)}`)}
            >
              Ownership Research
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

export default OwnershipTab;
