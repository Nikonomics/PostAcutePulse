import { useState, useEffect } from 'react';
import { Building2, MapPin, Star, TrendingUp, AlertTriangle, X, Search } from 'lucide-react';
import { starItem, unstarItem, getStarredItems } from '../../api/ownershipService';
import './OwnerDetailsModal.css';

function OwnerDetailsModal({ owner, onClose, loading, onDeepResearch }) {
  const [isStarred, setIsStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  useEffect(() => {
    checkIfStarred();
  }, [owner?.chainName]);

  const checkIfStarred = async () => {
    if (!owner?.chainName) return;
    try {
      const response = await getStarredItems('ownership_chain');
      if (response.success) {
        const starred = response.data.some(item => item.item_identifier === owner.chainName);
        setIsStarred(starred);
      }
    } catch (error) {
      console.error('Error checking starred status:', error);
    }
  };

  const handleToggleStar = async () => {
    if (!owner?.chainName) return;
    setStarLoading(true);
    try {
      if (isStarred) {
        await unstarItem('ownership_chain', owner.chainName);
        setIsStarred(false);
      } else {
        await starItem('ownership_chain', owner.chainName, owner.chainName);
        setIsStarred(true);
      }
    } catch (error) {
      console.error('Error toggling star:', error);
    } finally {
      setStarLoading(false);
    }
  };

  if (!owner) return null;

  const getOwnershipTypeColor = (type) => {
    const typeLower = (type || '').toLowerCase();
    if (typeLower.includes('profit') && !typeLower.includes('non')) return '#f59e0b';
    if (typeLower.includes('non')) return '#10b981';
    if (typeLower.includes('government')) return '#3b82f6';
    return '#6b7280';
  };

  return (
    <div className="owner-details-modal" onClick={onClose}>
      <div className="owner-details-content" onClick={(e) => e.stopPropagation()}>
        <div className="owner-details-header">
          <div className="owner-details-title">
            <h2>{owner.chainName}</h2>
            <span
              className="ownership-type-badge large"
              style={{ backgroundColor: getOwnershipTypeColor(owner.ownershipType) }}
            >
              {owner.ownershipType}
            </span>
          </div>
          <div className="owner-details-actions">
            <button
              className={`modal-star-btn ${isStarred ? 'starred' : ''}`}
              onClick={handleToggleStar}
              disabled={starLoading}
              title={isStarred ? 'Remove from starred' : 'Add to starred'}
            >
              <Star size={18} fill={isStarred ? '#fbbf24' : 'none'} stroke={isStarred ? '#fbbf24' : 'currentColor'} />
              {isStarred ? 'Starred' : 'Star'}
            </button>
            <button
              className="deep-research-btn"
              onClick={() => onDeepResearch?.(owner)}
              title="Run deep research on this organization"
            >
              <Search size={18} />
              Deep Research
            </button>
            <button className="close-details-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="owner-details-grid">
          <div className="detail-card">
            <Building2 size={20} />
            <div>
              <div className="detail-label">Total Facilities</div>
              <div className="detail-value">{owner.facilityCount}</div>
            </div>
          </div>
          <div className="detail-card">
            <div className="detail-icon beds-icon">Beds</div>
            <div>
              <div className="detail-label">Total Beds</div>
              <div className="detail-value">{(owner.totalBeds || 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="detail-card">
            <MapPin size={20} />
            <div>
              <div className="detail-label">States Present</div>
              <div className="detail-value">{owner.stateCount}</div>
            </div>
          </div>
          <div className="detail-card">
            <Star size={20} />
            <div>
              <div className="detail-label">Avg Rating</div>
              <div className="detail-value">{(owner.avgRating || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="detail-card">
            <TrendingUp size={20} />
            <div>
              <div className="detail-label">Avg Occupancy</div>
              <div className="detail-value">{(owner.avgOccupancy || 0).toFixed(1)}%</div>
            </div>
          </div>
          <div className="detail-card">
            <AlertTriangle size={20} />
            <div>
              <div className="detail-label">Avg Deficiencies</div>
              <div className="detail-value">{(owner.avgDeficiencies || 0).toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* State Breakdown */}
        {owner.stateBreakdown && owner.stateBreakdown.length > 0 && (
          <div className="state-breakdown-section">
            <h3>State Breakdown</h3>
            <div className="state-breakdown-list">
              {owner.stateBreakdown.map((state, index) => (
                <div key={index} className="state-breakdown-item">
                  <div className="state-name">{state.state}</div>
                  <div className="state-metrics">
                    <span>{state.facility_count} facilities</span>
                    <span>{parseInt(state.total_beds || 0).toLocaleString()} beds</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Facilities List */}
        {owner.facilities && owner.facilities.length > 0 && (
          <div className="facilities-list-section">
            <h3>Facilities ({owner.facilities.length})</h3>
            <div className="facilities-table">
              <table>
                <thead>
                  <tr>
                    <th>Facility Name</th>
                    <th>Location</th>
                    <th>Beds</th>
                    <th>Rating</th>
                    <th>Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {owner.facilities.slice(0, 50).map((facility, index) => (
                    <tr key={index}>
                      <td className="facility-name">{facility.facility_name}</td>
                      <td>{facility.city}, {facility.state}</td>
                      <td>{facility.total_beds}</td>
                      <td>
                        <span className="rating-badge">
                          <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                          {facility.overall_rating || 'N/A'}
                        </span>
                      </td>
                      <td>{parseFloat(facility.occupancy_rate || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {owner.facilities.length > 50 && (
                <div className="table-footer">
                  Showing 50 of {owner.facilities.length} facilities
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OwnerDetailsModal;
