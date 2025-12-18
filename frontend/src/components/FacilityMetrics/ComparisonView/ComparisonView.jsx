import React, { useState, useEffect } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import ComparisonTable from './ComparisonTable';
import { searchFacilities, getFacilityProfile } from '../../../api/facilityService';

const ComparisonView = ({ facilityA, compareCcn, onClose, onCompareFacilityChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [facilityB, setFacilityB] = useState(null);
  const [isLoadingFacilityB, setIsLoadingFacilityB] = useState(false);
  const [showSearch, setShowSearch] = useState(!compareCcn);

  // Load facility B from compareCcn if provided
  useEffect(() => {
    if (compareCcn && !facilityB) {
      setIsLoadingFacilityB(true);
      getFacilityProfile(compareCcn)
        .then(response => {
          if (response.success && response.facility) {
            setFacilityB(normalizeFacility(response.facility));
            setShowSearch(false);
          }
        })
        .catch(error => {
          console.error('Error loading comparison facility:', error);
        })
        .finally(() => {
          setIsLoadingFacilityB(false);
        });
    }
  }, [compareCcn]);

  // Normalize facility data
  const normalizeFacility = (raw) => {
    const beds = parseInt(raw.certified_beds) || 1;
    const residents = parseInt(raw.average_residents_per_day) || 0;
    return {
      ...raw,
      occupancy_rate: Math.round((residents / beds) * 100),
      total_nursing_hprd: parseFloat(raw.reported_total_nurse_hrs) || null,
      rn_hprd: parseFloat(raw.reported_rn_hrs) || null,
      rn_turnover_rate: parseFloat(raw.rn_turnover) || null,
      total_turnover_rate: parseFloat(raw.total_nursing_turnover) || null,
      total_deficiencies: parseInt(raw.cycle1_total_health_deficiencies) || 0,
      total_penalties_amount: parseFloat(raw.fine_total_dollars) || 0,
      quality_rating: raw.qm_rating || raw.quality_rating,
    };
  };

  // Search for facilities
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await searchFacilities({ name: searchTerm, limit: 10 });
        const results = response.facilities || response.data || response || [];
        // Filter out the current facility
        setSearchResults(results.filter(f => f.ccn !== facilityA?.ccn));
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, facilityA?.ccn]);

  const handleSelectFacilityB = async (facility) => {
    setIsLoadingFacilityB(true);
    setShowSearch(false);
    setSearchTerm('');
    setSearchResults([]);

    try {
      const response = await getFacilityProfile(facility.ccn);
      if (response.success && response.facility) {
        const normalized = normalizeFacility(response.facility);
        setFacilityB(normalized);
        onCompareFacilityChange(facility.ccn);
      }
    } catch (error) {
      console.error('Error loading facility:', error);
    } finally {
      setIsLoadingFacilityB(false);
    }
  };

  const handleClearFacilityB = () => {
    setFacilityB(null);
    setShowSearch(true);
    onCompareFacilityChange(null);
  };

  const getRatingColor = (rating) => {
    const colors = { 5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444' };
    return colors[rating] || '#9ca3af';
  };

  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <div className="comparison-title">
          <ArrowLeftRight size={20} />
          <h3>Facility Comparison</h3>
        </div>
        <button className="comparison-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="comparison-facilities">
        {/* Facility A (Primary - already selected) */}
        <div className="comparison-facility-card primary">
          <div className="facility-card-header">Primary Facility</div>
          <div className="facility-card-content">
            <div
              className="facility-rating-badge"
              style={{ backgroundColor: getRatingColor(facilityA?.overall_rating) }}
            >
              {facilityA?.overall_rating || '?'}
            </div>
            <div className="facility-info">
              <span className="facility-name">
                {facilityA?.provider_name || facilityA?.facility_name}
              </span>
              <span className="facility-location">
                {facilityA?.city}, {facilityA?.state}
              </span>
            </div>
          </div>
        </div>

        {/* Facility B (Comparison) */}
        <div className="comparison-facility-card">
          <div className="facility-card-header">
            Compare With
            {facilityB && (
              <button className="change-facility-btn" onClick={handleClearFacilityB}>
                Change
              </button>
            )}
          </div>
          {isLoadingFacilityB ? (
            <div className="facility-card-loading">Loading...</div>
          ) : facilityB ? (
            <div className="facility-card-content">
              <div
                className="facility-rating-badge"
                style={{ backgroundColor: getRatingColor(facilityB.overall_rating) }}
              >
                {facilityB.overall_rating || '?'}
              </div>
              <div className="facility-info">
                <span className="facility-name">
                  {facilityB.provider_name || facilityB.facility_name}
                </span>
                <span className="facility-location">
                  {facilityB.city}, {facilityB.state}
                </span>
              </div>
            </div>
          ) : (
            <div className="facility-search-wrapper">
              <input
                type="text"
                className="comparison-search-input"
                placeholder="Search for a facility to compare..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="comparison-search-results">
                  {searchResults.map(facility => (
                    <div
                      key={facility.ccn}
                      className="comparison-search-result"
                      onClick={() => handleSelectFacilityB(facility)}
                    >
                      <div
                        className="result-rating-mini"
                        style={{ backgroundColor: getRatingColor(facility.overall_rating) }}
                      >
                        {facility.overall_rating || '?'}
                      </div>
                      <div className="result-info">
                        <span className="result-name">
                          {facility.provider_name || facility.facility_name}
                        </span>
                        <span className="result-meta">
                          {facility.city}, {facility.state}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isSearching && <div className="search-loading">Searching...</div>}
            </div>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      {facilityB && (
        <ComparisonTable facilityA={facilityA} facilityB={facilityB} />
      )}
    </div>
  );
};

export default ComparisonView;
