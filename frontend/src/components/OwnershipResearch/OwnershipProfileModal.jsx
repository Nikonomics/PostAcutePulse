import { useState } from 'react';
import { X, Building2, MapPin, Star, Users, AlertCircle, DollarSign, Loader } from 'lucide-react';
import './OwnershipProfileModal.css';

function OwnershipProfileModal({ profile, loading, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stateFilter, setStateFilter] = useState('all');

  if (loading) {
    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Loading Profile...</h3>
            <button onClick={onClose} className="close-btn" aria-label="Close modal">
              <X size={24} />
            </button>
          </div>
          <div className="modal-body loading-state">
            <Loader size={48} className="spinning" />
            <p>Loading ownership profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !profile.profile) {
    return null;
  }

  const { profile: data, facilities } = profile;

  // Get unique states for filter
  const states = [...new Set(facilities.map(f => f.state))].sort();

  // Filter facilities by state
  const filteredFacilities = stateFilter === 'all'
    ? facilities
    : facilities.filter(f => f.state === stateFilter);

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderStars = (rating) => {
    if (!rating) return <span className="no-rating">N/A</span>;
    return (
      <div className="stars-display">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={14}
            fill={i < Math.round(rating) ? "#fbbf24" : "none"}
            stroke={i < Math.round(rating) ? "#fbbf24" : "#d1d5db"}
          />
        ))}
        <span className="rating-number">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <Building2 size={24} />
            <div>
              <h3>{data.parent_organization}</h3>
              <p className="modal-subtitle">
                {data.facility_count} facilities across {data.state_count} states
              </p>
            </div>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close modal">
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'facilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('facilities')}
          >
            Facilities ({facilities.length})
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'overview' && (
            <div className="overview-content">
              {/* Key Metrics */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon">
                    <Building2 size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">{data.facility_count}</span>
                    <span className="metric-label">Facilities</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <Users size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">{data.total_beds?.toLocaleString()}</span>
                    <span className="metric-label">Total Beds</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <MapPin size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">{data.state_count}</span>
                    <span className="metric-label">States</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <Star size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">
                      {data.ratings?.avg_overall ? data.ratings.avg_overall.toFixed(1) : 'N/A'}
                    </span>
                    <span className="metric-label">Avg Rating</span>
                  </div>
                </div>
              </div>

              {/* Ratings Breakdown */}
              <div className="section-card">
                <h4>Quality Ratings</h4>
                <div className="ratings-breakdown">
                  <div className="rating-row">
                    <span className="rating-label">Overall</span>
                    {renderStars(data.ratings?.avg_overall)}
                  </div>
                  <div className="rating-row">
                    <span className="rating-label">Health Inspection</span>
                    {renderStars(data.ratings?.avg_health_inspection)}
                  </div>
                  <div className="rating-row">
                    <span className="rating-label">Quality Measures</span>
                    {renderStars(data.ratings?.avg_quality_measure)}
                  </div>
                  <div className="rating-row">
                    <span className="rating-label">Staffing</span>
                    {renderStars(data.ratings?.avg_staffing)}
                  </div>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="section-card">
                <h4>Rating Distribution</h4>
                <div className="distribution-bars">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = data.rating_distribution?.[
                      stars === 5 ? 'five_star' :
                      stars === 4 ? 'four_star' :
                      stars === 3 ? 'three_star' :
                      stars === 2 ? 'two_star' : 'one_star'
                    ] || 0;
                    const pct = data.facility_count ? (count / data.facility_count * 100) : 0;
                    return (
                      <div key={stars} className="distribution-row">
                        <span className="dist-label">{stars} star</span>
                        <div className="dist-bar-container">
                          <div
                            className="dist-bar"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="dist-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* States Operated */}
              <div className="section-card">
                <h4>States Operated</h4>
                <div className="states-list">
                  {data.states_operated?.map(state => (
                    <span key={state} className="state-badge">{state}</span>
                  ))}
                </div>
              </div>

              {/* Compliance & Penalties */}
              <div className="section-card">
                <h4>Compliance Summary</h4>
                <div className="compliance-grid">
                  <div className="compliance-item">
                    <AlertCircle size={18} className="icon-warning" />
                    <div>
                      <span className="compliance-value">{data.deficiencies?.total_health || 0}</span>
                      <span className="compliance-label">Health Deficiencies</span>
                    </div>
                  </div>
                  <div className="compliance-item">
                    <AlertCircle size={18} className="icon-warning" />
                    <div>
                      <span className="compliance-value">{data.deficiencies?.total_fire_safety || 0}</span>
                      <span className="compliance-label">Fire Safety Deficiencies</span>
                    </div>
                  </div>
                  <div className="compliance-item">
                    <DollarSign size={18} className="icon-penalty" />
                    <div>
                      <span className="compliance-value">{formatCurrency(data.penalties?.total_amount)}</span>
                      <span className="compliance-label">Total Penalties</span>
                    </div>
                  </div>
                  <div className="compliance-item">
                    <span className="compliance-value">{data.deficiencies?.avg_per_facility?.toFixed(1) || 0}</span>
                    <span className="compliance-label">Avg Deficiencies/Facility</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'facilities' && (
            <div className="facilities-content">
              {/* State Filter */}
              <div className="facilities-header">
                <span className="facilities-count">
                  Showing {filteredFacilities.length} of {facilities.length} facilities
                </span>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="state-filter-select"
                >
                  <option value="all">All States</option>
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              {/* Facilities Table */}
              <div className="facilities-table-container">
                <table className="facilities-table">
                  <thead>
                    <tr>
                      <th>Facility Name</th>
                      <th>Location</th>
                      <th>Beds</th>
                      <th>Rating</th>
                      <th>Deficiencies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFacilities.map(facility => (
                      <tr key={facility.id || facility.federal_provider_number}>
                        <td>
                          <div className="facility-name-cell">
                            {facility.facility_name}
                            {facility.is_rural && (
                              <span className="rural-badge">Rural</span>
                            )}
                          </div>
                        </td>
                        <td>{facility.city}, {facility.state}</td>
                        <td>{facility.total_beds || '-'}</td>
                        <td>
                          {facility.overall_rating ? (
                            <div className="rating-cell">
                              <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                              {facility.overall_rating}
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          {facility.health_deficiencies > 0 ? (
                            <span className="deficiency-count">{facility.health_deficiencies}</span>
                          ) : (
                            <span className="no-deficiencies">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OwnershipProfileModal;
