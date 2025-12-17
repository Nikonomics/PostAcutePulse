import React, { useState, useEffect } from 'react';
import { Building2, User, Loader, Percent, Briefcase } from 'lucide-react';
import { getFacilityOwnership } from '../../../api/facilityService';
import DrillDownModal from './DrillDownModal';

const OwnershipDrillDown = ({ isOpen, onClose, ccn, facilityName }) => {
  const [ownership, setOwnership] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && ccn) {
      loadOwnership();
    }
  }, [isOpen, ccn]);

  const loadOwnership = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFacilityOwnership(ccn);
      if (response.success) {
        setOwnership(response.ownership);
      } else {
        setError('Failed to load ownership data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group by role type
  const groupedOwnership = ownership.reduce((acc, owner) => {
    const role = owner.role_type || 'Other';
    if (!acc[role]) acc[role] = [];
    acc[role].push(owner);
    return acc;
  }, {});

  const getRoleIcon = (role) => {
    if (role.includes('DIRECT') || role.includes('INDIRECT')) return Percent;
    if (role.includes('OFFICER') || role.includes('DIRECTOR')) return Briefcase;
    if (role.includes('MANAGING')) return User;
    return Building2;
  };

  const getRoleColor = (role) => {
    if (role.includes('DIRECT')) return '#3b82f6';
    if (role.includes('INDIRECT')) return '#8b5cf6';
    if (role.includes('OFFICER')) return '#f97316';
    if (role.includes('MANAGING')) return '#22c55e';
    return '#6b7280';
  };

  return (
    <DrillDownModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ownership Structure - ${facilityName || 'Facility'}`}
      icon={Building2}
    >
      {loading ? (
        <div className="drilldown-loading">
          <Loader size={24} className="spinning" />
          <span>Loading ownership data...</span>
        </div>
      ) : error ? (
        <div className="drilldown-error">{error}</div>
      ) : ownership.length === 0 ? (
        <div className="drilldown-empty">
          <Building2 size={32} style={{ color: '#9ca3af' }} />
          <p>No ownership data available</p>
        </div>
      ) : (
        <>
          <div className="drilldown-summary">
            <span>{ownership.length} ownership records</span>
          </div>

          <div className="ownership-groups">
            {Object.entries(groupedOwnership).map(([role, owners]) => {
              const Icon = getRoleIcon(role);
              const color = getRoleColor(role);
              return (
                <div key={role} className="ownership-group">
                  <div className="ownership-group-header" style={{ borderLeftColor: color }}>
                    <Icon size={16} style={{ color }} />
                    <span>{role}</span>
                    <span className="ownership-count">{owners.length}</span>
                  </div>
                  <div className="ownership-list">
                    {owners.map((owner, index) => (
                      <div key={index} className="ownership-item">
                        <div className="ownership-name">
                          {owner.owner_type === 'Individual' ? (
                            <User size={14} />
                          ) : (
                            <Building2 size={14} />
                          )}
                          <span>{owner.owner_name}</span>
                        </div>
                        <div className="ownership-details">
                          <span className="ownership-type">{owner.owner_type}</span>
                          {owner.ownership_percentage && (
                            <span className="ownership-pct">
                              {owner.ownership_percentage}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DrillDownModal>
  );
};

export default OwnershipDrillDown;
