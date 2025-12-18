import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Building2,
  MapPin,
  Star,
  ChevronDown,
  X,
  Loader2,
} from 'lucide-react';
import { searchFacilities } from '../../api/facilityService';
import SaveButton from '../common/SaveButton';

// US States for dropdown
const US_STATES = [
  { code: '', name: 'All States' },
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

const RATINGS = [
  { value: '', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

const RECENT_FACILITIES_KEY = 'snfalyze_recent_facilities';
const MAX_RECENT_FACILITIES = 5;

// Helper functions for recent facilities
const getRecentFacilities = () => {
  try {
    const stored = localStorage.getItem(RECENT_FACILITIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const addToRecentFacilities = (facility) => {
  if (!facility?.ccn) return;

  const recent = getRecentFacilities();
  // Remove if already exists
  const filtered = recent.filter(f => f.ccn !== facility.ccn);
  // Add to front
  const updated = [
    {
      ccn: facility.ccn,
      provider_name: facility.provider_name || facility.facility_name || facility.name,
      city: facility.city,
      state: facility.state,
      overall_rating: facility.overall_rating,
      certified_beds: facility.certified_beds || facility.beds
    },
    ...filtered
  ].slice(0, MAX_RECENT_FACILITIES);

  localStorage.setItem(RECENT_FACILITIES_KEY, JSON.stringify(updated));
};

const FacilitySelector = ({ selectedFacility, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [chainFilter, setChainFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recentFacilities, setRecentFacilities] = useState([]);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load recent facilities on mount
  useEffect(() => {
    setRecentFacilities(getRecentFacilities());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search facilities using facilityService API
  const handleSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Build params for facilityService.searchFacilities
      const params = {
        name: term,
        limit: 20,
      };

      if (stateFilter) {
        params.state = stateFilter;
      }

      if (ratingFilter) {
        params.minRating = parseInt(ratingFilter, 10);
        params.maxRating = parseInt(ratingFilter, 10);
      }

      const response = await searchFacilities(params);

      // Handle response structure - may be { facilities: [...] } or { data: [...] }
      let facilityResults = response.facilities || response.data || response || [];

      // Ensure it's an array
      if (!Array.isArray(facilityResults)) {
        facilityResults = [];
      }

      // Apply client-side chain filter if provided
      if (chainFilter) {
        facilityResults = facilityResults.filter((f) =>
          f.chain_name?.toLowerCase().includes(chainFilter.toLowerCase())
        );
      }

      setResults(facilityResults.slice(0, 20));
    } catch (err) {
      console.error('Facility search error:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [stateFilter, ratingFilter, chainFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        handleSearch(searchTerm);
        setShowDropdown(true);
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  const handleSelectFacility = (facility) => {
    // Add to recent facilities
    addToRecentFacilities(facility);
    setRecentFacilities(getRecentFacilities());

    onSelect(facility);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const handleClearSelection = () => {
    onSelect(null);
    setSearchTerm('');
  };

  const getRatingColor = (rating) => {
    const colors = {
      5: '#22c55e',
      4: '#84cc16',
      3: '#eab308',
      2: '#f97316',
      1: '#ef4444',
    };
    return colors[rating] || '#9ca3af';
  };

  // Get display name - handle different field names from CMS data
  const getFacilityName = (facility) => {
    return facility.provider_name || facility.facility_name || facility.name || 'Unknown Facility';
  };

  const getBedCount = (facility) => {
    return facility.certified_beds || facility.beds || facility.total_beds || 'N/A';
  };

  return (
    <div className="facility-selector">
      {/* Selected Facility Display */}
      {selectedFacility ? (
        <div className="selected-facility">
          <div className="selected-facility-info">
            <div
              className="facility-rating-badge"
              style={{ backgroundColor: getRatingColor(selectedFacility.overall_rating) }}
            >
              {selectedFacility.overall_rating || '?'}
            </div>
            <div className="selected-facility-details">
              <span className="selected-facility-name">
                {getFacilityName(selectedFacility)}
              </span>
              <span className="selected-facility-meta">
                <MapPin size={12} />
                {selectedFacility.city}, {selectedFacility.state}
                <span className="meta-separator">•</span>
                <Building2 size={12} />
                {getBedCount(selectedFacility)} beds
                {selectedFacility.ownership_type && (
                  <>
                    <span className="meta-separator">•</span>
                    {selectedFacility.ownership_type}
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="selected-facility-actions">
            <SaveButton
              itemType="cms_facility"
              ccn={selectedFacility.ccn}
              facilityName={getFacilityName(selectedFacility)}
              size="small"
            />
            <button className="clear-selection-btn" onClick={handleClearSelection}>
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="facility-search-container" ref={searchRef}>
            <div className="facility-search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="search"
                className="facility-search-input"
                placeholder="Search facilities by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => {
                  if (searchTerm.length >= 2) {
                    setShowDropdown(true);
                  } else if (recentFacilities.length > 0) {
                    // Show recent facilities when input is focused and empty
                    setShowDropdown(true);
                  }
                }}
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                name={`facility-search-${Date.now()}`}
              />
              {isLoading && <Loader2 size={18} className="loading-icon" />}
            </div>

            {/* Filter Toggle */}
            <button
              className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
              <ChevronDown size={16} className={showFilters ? 'rotated' : ''} />
            </button>
          </div>

          {/* Filters Row */}
          {showFilters && (
            <div className="facility-filters">
              <select
                className="facility-filter-select"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
              >
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="facility-filter-input"
                placeholder="Chain name..."
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value)}
              />

              <select
                className="facility-filter-select"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
              >
                {RATINGS.map((rating) => (
                  <option key={rating.value} value={rating.value}>
                    {rating.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Results Dropdown */}
          {showDropdown && (
            <div className="facility-search-dropdown" ref={dropdownRef}>
              {/* Show recent facilities when search is empty */}
              {searchTerm.length < 2 && recentFacilities.length > 0 ? (
                <>
                  <div className="dropdown-section-header">Recent Facilities</div>
                  {recentFacilities.map((facility) => (
                    <div
                      key={facility.ccn}
                      className="facility-search-result"
                      onClick={() => handleSelectFacility(facility)}
                    >
                      <div
                        className="result-rating"
                        style={{ backgroundColor: getRatingColor(facility.overall_rating) }}
                      >
                        {facility.overall_rating || '?'}
                      </div>
                      <div className="result-info">
                        <span className="result-name">
                          {facility.provider_name}
                        </span>
                        <span className="result-meta">
                          {facility.city}, {facility.state}
                          <span className="meta-separator">•</span>
                          {facility.certified_beds || 'N/A'} beds
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              ) : results.length === 0 && !isLoading ? (
                <div className="no-results">
                  No facilities found. Try a different search term.
                </div>
              ) : (
                results.map((facility) => (
                  <div
                    key={facility.ccn || facility.provider_id || facility.id}
                    className="facility-search-result"
                    onClick={() => handleSelectFacility(facility)}
                  >
                    <div
                      className="result-rating"
                      style={{ backgroundColor: getRatingColor(facility.overall_rating) }}
                    >
                      {facility.overall_rating || '?'}
                    </div>
                    <div className="result-info">
                      <span className="result-name">
                        {getFacilityName(facility)}
                      </span>
                      <span className="result-meta">
                        {facility.city}, {facility.state}
                        <span className="meta-separator">•</span>
                        {getBedCount(facility)} beds
                        {facility.ownership_type && (
                          <>
                            <span className="meta-separator">•</span>
                            {facility.ownership_type}
                          </>
                        )}
                      </span>
                    </div>
                    <Star
                      size={16}
                      className="result-star"
                      fill={facility.overall_rating >= 4 ? '#fbbf24' : 'none'}
                      stroke={facility.overall_rating >= 4 ? '#fbbf24' : '#d1d5db'}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FacilitySelector;
