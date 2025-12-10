import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  ChevronDown,
  Search,
  X,
  Loader2,
  Building2,
} from 'lucide-react';
import { getStates, getCounties, searchFacilities } from '../../api/marketService';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    alignItems: 'flex-end',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    minWidth: '200px',
    flex: '1 1 200px',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  selectWrapper: {
    position: 'relative',
  },
  select: {
    width: '100%',
    padding: '0.625rem 2.5rem 0.625rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    backgroundColor: 'white',
    cursor: 'pointer',
    appearance: 'none',
    color: '#111827',
  },
  selectDisabled: {
    backgroundColor: '#f9fafb',
    cursor: 'not-allowed',
    color: '#9ca3af',
  },
  selectIcon: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: '#6b7280',
  },
  searchWrapper: {
    position: 'relative',
    flex: '2 1 300px',
  },
  searchInput: {
    width: '100%',
    padding: '0.625rem 2.5rem 0.625rem 2.5rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    backgroundColor: 'white',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
  },
  clearButton: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '0.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.25rem',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '0.25rem',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 50,
    maxHeight: '300px',
    overflowY: 'auto',
  },
  dropdownItem: {
    padding: '0.625rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemHover: {
    backgroundColor: '#f3f4f6',
  },
  dropdownItemName: {
    fontWeight: 500,
    color: '#111827',
  },
  dropdownItemMeta: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  facilityResult: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  facilityName: {
    fontWeight: 500,
    color: '#111827',
  },
  facilityLocation: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.125rem 0.5rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    borderRadius: '9999px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  clearAllButton: {
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    transition: 'all 0.15s',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    color: '#6b7280',
  },
  noResults: {
    padding: '1rem',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '0.875rem',
  },
};

const LocationSelector = ({
  facilityType,
  selectedState,
  selectedCounty,
  onStateChange,
  onCountyChange,
  onFacilitySelect,
}) => {
  const [states, setStates] = useState([]);
  const [counties, setCounties] = useState([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCounties, setLoadingCounties] = useState(false);

  // Facility search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  // Fetch states on mount and when facility type changes
  useEffect(() => {
    const fetchStates = async () => {
      setLoadingStates(true);
      try {
        const response = await getStates(facilityType);
        if (response.success) {
          setStates(response.data);
        }
      } catch (error) {
        console.error('Error fetching states:', error);
      }
      setLoadingStates(false);
    };

    fetchStates();
  }, [facilityType]);

  // Fetch counties when state changes
  useEffect(() => {
    const fetchCounties = async () => {
      if (!selectedState) {
        setCounties([]);
        return;
      }

      setLoadingCounties(true);
      try {
        const response = await getCounties(selectedState, facilityType);
        if (response.success) {
          setCounties(response.data);
        }
      } catch (error) {
        console.error('Error fetching counties:', error);
      }
      setLoadingCounties(false);
    };

    fetchCounties();
  }, [selectedState, facilityType]);

  // Debounced facility search
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setSearchResults([]);
        setShowSearchDropdown(false);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await searchFacilities(query, facilityType);
        if (response.success) {
          setSearchResults(response.data);
          setShowSearchDropdown(true);
        }
      } catch (error) {
        console.error('Error searching facilities:', error);
      }
      setSearchLoading(false);
    }, 300),
    [facilityType]
  );

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleFacilityClick = (facility) => {
    setSearchQuery('');
    setShowSearchDropdown(false);
    setSearchResults([]);
    if (onFacilitySelect) {
      onFacilitySelect(facility);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  const handleClearAll = () => {
    onStateChange('');
    onCountyChange('');
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        {/* State Selector */}
        <div style={styles.field}>
          <label style={styles.label}>State</label>
          <div style={styles.selectWrapper}>
            <select
              style={{
                ...styles.select,
                ...(loadingStates ? styles.selectDisabled : {}),
              }}
              value={selectedState}
              onChange={(e) => {
                onStateChange(e.target.value);
                onCountyChange(''); // Reset county when state changes
              }}
              disabled={loadingStates}
            >
              <option value="">Select a state</option>
              {states.map((state) => (
                <option key={state.stateCode} value={state.stateCode}>
                  {state.stateCode} ({state.facilityCount} facilities)
                </option>
              ))}
            </select>
            <div style={styles.selectIcon}>
              {loadingStates ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ChevronDown size={16} />
              )}
            </div>
          </div>
        </div>

        {/* County Selector */}
        <div style={styles.field}>
          <label style={styles.label}>County</label>
          <div style={styles.selectWrapper}>
            <select
              style={{
                ...styles.select,
                ...(!selectedState || loadingCounties ? styles.selectDisabled : {}),
              }}
              value={selectedCounty}
              onChange={(e) => onCountyChange(e.target.value)}
              disabled={!selectedState || loadingCounties}
            >
              <option value="">
                {!selectedState ? 'Select a state first' : 'All counties'}
              </option>
              {counties.map((county) => (
                <option key={county.countyName} value={county.countyName}>
                  {county.countyName} ({county.facilityCount})
                </option>
              ))}
            </select>
            <div style={styles.selectIcon}>
              {loadingCounties ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ChevronDown size={16} />
              )}
            </div>
          </div>
        </div>

        {/* Facility Search */}
        <div style={{ ...styles.field, ...styles.searchWrapper }}>
          <label style={styles.label}>Search by Facility Name</label>
          <div style={{ position: 'relative' }}>
            <div style={styles.searchIcon}>
              {searchLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
            </div>
            <input
              type="text"
              style={styles.searchInput}
              placeholder="Type facility name..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
            />
            {searchQuery && (
              <button style={styles.clearButton} onClick={handleClearSearch}>
                <X size={16} />
              </button>
            )}

            {/* Search Results Dropdown */}
            {showSearchDropdown && (
              <div style={styles.dropdown}>
                {searchLoading ? (
                  <div style={styles.loading}>
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={styles.noResults}>No facilities found</div>
                ) : (
                  searchResults.map((facility, index) => (
                    <div
                      key={facility.id}
                      style={{
                        ...styles.dropdownItem,
                        ...(hoveredIndex === index ? styles.dropdownItemHover : {}),
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(-1)}
                      onClick={() => handleFacilityClick(facility)}
                    >
                      <div style={styles.facilityResult}>
                        <div style={styles.facilityName}>
                          <Building2 size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                          {facility.facilityName}
                        </div>
                        <div style={styles.facilityLocation}>
                          {facility.city}, {facility.county}, {facility.state}
                        </div>
                      </div>
                      {facility.beds && (
                        <span style={styles.badge}>{facility.beds} beds</span>
                      )}
                      {facility.capacity && (
                        <span style={styles.badge}>{facility.capacity} capacity</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clear All Button */}
        {(selectedState || selectedCounty || searchQuery) && (
          <button style={styles.clearAllButton} onClick={handleClearAll}>
            <X size={14} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

// Debounce helper function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default LocationSelector;
