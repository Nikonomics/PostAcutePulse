import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Building2,
  Loader,
  RefreshCw,
  ChevronRight,
  Map,
  List,
  Star,
  Users,
  AlertCircle,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import CompetitorMap from './CompetitorMap';
import { getFacilityCompetitors } from '../../../api/facilityService';
import './CompetitionTab.css';

const getRatingColor = (rating) => {
  const colors = {
    5: '#22c55e',
    4: '#84cc16',
    3: '#eab308',
    2: '#f97316',
    1: '#ef4444'
  };
  return colors[rating] || '#9ca3af';
};

const formatOccupancy = (beds, residents) => {
  if (!beds || beds === 0) return 'N/A';
  const rate = (residents / beds) * 100;
  return `${Math.round(rate)}%`;
};

const formatDistance = (miles) => {
  if (miles === null || miles === undefined) return 'N/A';
  return `${parseFloat(miles).toFixed(1)} mi`;
};

// Helper to get beds from API response
const getBeds = (comp) => {
  return comp.number_of_certified_beds || comp.certified_beds || comp.total_beds || null;
};

// Helper to get residents from API response
const getResidents = (comp) => {
  return comp.number_of_residents_in_certified_beds || comp.average_residents_per_day || null;
};

const CompetitionTab = ({ facility }) => {
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showMap, setShowMap] = useState(true);

  // Mobile detection for default map state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set initial map visibility based on device
  useEffect(() => {
    setShowMap(!isMobile);
  }, [isMobile]);

  // Load competitors when facility changes
  useEffect(() => {
    if (facility?.ccn) {
      loadCompetitors();
    }
  }, [facility?.ccn]);

  const loadCompetitors = async () => {
    const ccn = facility?.federal_provider_number || facility?.ccn;
    if (!ccn) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getFacilityCompetitors(ccn, 25, 25);
      if (response.success) {
        setCompetitors(response.competitors || []);
      } else {
        setError('Failed to load competitor data');
      }
    } catch (err) {
      setError(err.message || 'Unable to load competitor data.');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to competitor's facility metrics page (snapshot tab)
  const handleCompetitorClick = (competitor) => {
    navigate(`/facility-metrics/${competitor.ccn}?tab=snapshot&from=competition`);
  };

  // Show placeholder when no facility selected
  if (!facility) {
    return (
      <div className="placeholder-tab">
        <MapPin size={48} strokeWidth={1.5} />
        <h3>Select a Facility</h3>
        <p>Use the search above to select a facility and view nearby competitors.</p>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="competition-tab">
        <div className="competition-loading">
          <Loader size={32} className="spinning" />
          <span>Loading competitor data...</span>
        </div>
      </div>
    );
  }

  // Show error state with retry
  if (error) {
    return (
      <div className="competition-tab">
        <div className="competition-error">
          <AlertCircle size={40} strokeWidth={1.5} />
          <h3>Unable to load competitor data</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={loadCompetitors}>
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show empty state for rural facilities
  if (competitors.length === 0) {
    return (
      <div className="competition-tab">
        <div className="competition-empty">
          <MapPin size={48} strokeWidth={1.5} />
          <h3>No Nearby Competitors</h3>
          <p>
            No other skilled nursing facilities found within 25 miles.
            This facility may be in a rural area with limited competition.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="competition-tab">
      {/* Summary Card */}
      <div className="competition-summary-card">
        <div className="competition-summary-header">
          <MapPin size={20} />
          <h3>Nearby Competitors</h3>
          <span className="competitor-count">{competitors.length} within 25 miles</span>
        </div>

        <div className="competition-actions">
          {/* Market Analysis link */}
          <Link
            to={`/market-analysis?state=${facility.state}&county=${facility.county || ''}`}
            className="market-analysis-link"
          >
            <BarChart3 size={16} />
            View Market Analysis
            <ExternalLink size={14} />
          </Link>

          {/* Toggle for mobile */}
          {isMobile && (
            <button
              className="map-toggle-button"
              onClick={() => setShowMap(!showMap)}
            >
              {showMap ? <List size={16} /> : <Map size={16} />}
              {showMap ? 'Show List' : 'Show Map'}
            </button>
          )}
        </div>
      </div>

      {/* Map Section */}
      {showMap && (
        <div className="competition-map-section">
          <CompetitorMap
            facility={facility}
            competitors={competitors}
            onCompetitorClick={handleCompetitorClick}
          />
        </div>
      )}

      {/* Competitor Table */}
      <div className="competition-table-section">
        <div className="competition-table-header">
          <List size={18} />
          <h4>Competitor Details</h4>
        </div>

        <div className="competition-table-wrapper">
          <table className="competition-table">
            <thead>
              <tr>
                <th className="th-name">Facility Name</th>
                <th className="th-distance">Distance</th>
                <th className="th-beds">Beds</th>
                <th className="th-rating">Rating</th>
                <th className="th-occupancy">Occupancy</th>
                <th className="th-action"></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => {
                const beds = getBeds(comp);
                const residents = getResidents(comp);
                return (
                  <tr
                    key={comp.ccn}
                    className="competitor-row"
                    onClick={() => handleCompetitorClick(comp)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCompetitorClick(comp)}
                  >
                    <td className="td-name">
                      <div className="competitor-name-cell">
                        <Building2 size={16} className="facility-icon" />
                        <div className="competitor-info">
                          <span className="competitor-name">
                            {comp.facility_name || comp.provider_name}
                          </span>
                          <span className="competitor-location">
                            {comp.city}, {comp.state}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="td-distance">
                      {formatDistance(comp.distance_miles)}
                    </td>
                    <td className="td-beds">
                      {beds || 'N/A'}
                    </td>
                    <td className="td-rating">
                      <div
                        className="rating-badge"
                        style={{ backgroundColor: getRatingColor(comp.overall_rating) }}
                      >
                        <Star size={12} />
                        <span>{comp.overall_rating || '?'}</span>
                      </div>
                    </td>
                    <td className="td-occupancy">
                      {formatOccupancy(beds, residents)}
                    </td>
                    <td className="td-action">
                      <ChevronRight size={16} className="row-arrow" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Market summary */}
        <div className="competition-market-summary">
          <div className="market-stat">
            <span className="stat-label">Avg. Beds</span>
            <span className="stat-value">
              {Math.round(
                competitors.reduce((sum, c) => sum + (getBeds(c) || 0), 0) / competitors.length
              )}
            </span>
          </div>
          <div className="market-stat">
            <span className="stat-label">Avg. Rating</span>
            <span className="stat-value">
              {(
                competitors.reduce((sum, c) => sum + (c.overall_rating || 0), 0) / competitors.length
              ).toFixed(1)}
            </span>
          </div>
          <div className="market-stat">
            <span className="stat-label">Total Beds</span>
            <span className="stat-value">
              {competitors.reduce((sum, c) => sum + (getBeds(c) || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionTab;
