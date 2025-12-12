import { useState, useEffect } from 'react';
import { Search, Loader, MapPin, Building2, Star, Users, AlertCircle, X } from 'lucide-react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { facilityNLSearch, getFacilityDeficiencies } from '../../api/ownershipService';
import DeficiencyModal from './DeficiencyModal';
import './FacilitySearch.css';

const GOOGLE_MAPS_LIBRARIES = ['places', 'geocoding'];

const mapStyles = [
  {
    featureType: 'all',
    elementType: 'labels',
    stylers: [{ visibility: 'on' }, { saturation: -100 }, { lightness: 40 }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ lightness: 100 }, { visibility: 'simplified' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#d4e9f7' }]
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }]
  },
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#c9c9c9' }, { weight: 1 }]
  }
];

function FacilitySearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedChains, setSelectedChains] = useState([]);
  const [availableChains, setAvailableChains] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [deficiencyModalFacility, setDeficiencyModalFacility] = useState(null);

  // Post-search filters
  const [minRating, setMinRating] = useState(0);
  const [maxBeds, setMaxBeds] = useState(1000);
  const [minBeds, setMinBeds] = useState(0);
  const [ownershipType, setOwnershipType] = useState('all');
  const [deficiencyFilter, setDeficiencyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');

  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const exampleQueries = [
    "Show me all skilled nursing facilities that are part of an ownership group of 10 or less in the Pacific Northwest",
    "Find high-rated facilities in California with more than 100 beds",
    "Independent non-profit facilities in the Midwest with 4+ star ratings",
    "Facilities in Texas that accept both Medicare and Medicaid with low deficiencies",
    "Large chain-owned facilities in Florida with high occupancy rates"
  ];

  // Load available chains when results change
  useEffect(() => {
    if (results && results.results) {
      const chains = [...new Set(
        results.results
          .map(f => f.ownership_chain)
          .filter(Boolean)
      )].sort();
      setAvailableChains(chains);
    }
  }, [results]);

  const handleSearch = async (searchQuery = query) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedChains([]);

    try {
      const data = await facilityNLSearch(searchQuery);

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search facilities');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery) => {
    setQuery(exampleQuery);
    handleSearch(exampleQuery);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleChain = (chain) => {
    setSelectedChains(prev =>
      prev.includes(chain)
        ? prev.filter(c => c !== chain)
        : [...prev, chain]
    );
  };

  const clearFilters = () => {
    setSelectedChains([]);
    setMinRating(0);
    setMinBeds(0);
    setMaxBeds(1000);
    setOwnershipType('all');
    setDeficiencyFilter('all');
    setSortBy('relevance');
  };

  const applyFilters = () => {
    if (!results) return results;

    let filtered = results.results;

    // Filter by selected chains
    if (selectedChains.length > 0) {
      filtered = filtered.filter(f => selectedChains.includes(f.ownership_chain));
    }

    // Filter by star rating
    filtered = filtered.filter(f => {
      const rating = f.overall_rating || 0;
      return rating >= minRating;
    });

    // Filter by bed count
    filtered = filtered.filter(f => {
      const beds = f.total_beds || 0;
      return beds >= minBeds && beds <= maxBeds;
    });

    // Filter by ownership type
    if (ownershipType !== 'all') {
      filtered = filtered.filter(f => {
        const type = (f.ownership_type || '').toLowerCase();
        if (ownershipType === 'for-profit') return type.includes('profit') && !type.includes('non');
        if (ownershipType === 'non-profit') return type.includes('non');
        if (ownershipType === 'government') return type.includes('government');
        return true;
      });
    }

    // Filter by deficiencies
    if (deficiencyFilter !== 'all') {
      filtered = filtered.filter(f => {
        const defCount = parseInt(f.health_deficiencies || 0);
        if (deficiencyFilter === 'none') return defCount === 0;
        if (deficiencyFilter === 'low') return defCount > 0 && defCount <= 5;
        if (deficiencyFilter === 'medium') return defCount > 5 && defCount <= 15;
        if (deficiencyFilter === 'high') return defCount > 15;
        return true;
      });
    }

    // Apply sorting
    if (sortBy !== 'relevance') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'rating') {
          return (b.overall_rating || 0) - (a.overall_rating || 0);
        }
        if (sortBy === 'rating-asc') {
          return (a.overall_rating || 0) - (b.overall_rating || 0);
        }
        if (sortBy === 'beds') {
          return (b.total_beds || 0) - (a.total_beds || 0);
        }
        if (sortBy === 'beds-asc') {
          return (a.total_beds || 0) - (b.total_beds || 0);
        }
        if (sortBy === 'name') {
          return (a.facility_name || '').localeCompare(b.facility_name || '');
        }
        return 0;
      });
    }

    return { ...results, results: filtered, total: filtered.length };
  };

  const filteredResults = applyFilters();

  // Group facilities by ownership chain
  const groupedFacilities = () => {
    if (!filteredResults || !filteredResults.results) return {};

    const groups = {};
    filteredResults.results.forEach(facility => {
      const chain = facility.ownership_chain || 'Independent / Other';
      if (!groups[chain]) {
        groups[chain] = [];
      }
      groups[chain].push(facility);
    });

    return Object.fromEntries(
      Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    );
  };

  // Get facilities with valid coordinates for mapping
  const getFacilitiesForMap = () => {
    if (!filteredResults || !filteredResults.results) return [];

    let facilities = filteredResults.results.filter(f => f.latitude && f.longitude);

    if (selectedChains.length > 0) {
      facilities = facilities.filter(f => {
        const chain = f.ownership_chain || 'Independent / Other';
        return selectedChains.includes(chain);
      });
    }

    return facilities.slice(0, 200); // Limit for performance
  };

  const getMarkerColor = (facility) => {
    const rating = facility.overall_rating;
    if (!rating) return '#9ca3af';
    if (rating >= 4) return '#22c55e';
    if (rating >= 3) return '#fbbf24';
    return '#ef4444';
  };

  const handleNewSearch = () => {
    setQuery('');
    setResults(null);
    setError(null);
    setSelectedChains([]);
    clearFilters();
  };

  const renderFacilityCard = (facility) => {
    const defCount = facility.health_deficiencies || 0;

    return (
      <div key={facility.id || facility.federal_provider_number} className="facility-card">
        <div className="facility-header">
          <div className="facility-name-section">
            <h3>{facility.facility_name}</h3>
            {facility.ownership_chain && (
              <span className="chain-badge">
                <Building2 size={14} />
                {facility.ownership_chain}
                {facility.chain_facility_count && ` (${facility.chain_facility_count} facilities)`}
              </span>
            )}
          </div>
          {facility.overall_rating && (
            <div className="rating-badge">
              <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
              <span>{facility.overall_rating}</span>
            </div>
          )}
        </div>

        <div className="facility-info">
          <div className="info-row">
            <MapPin size={16} />
            <span>{facility.city}, {facility.state} {facility.zip_code}</span>
          </div>

          {facility.county && (
            <div className="info-row">
              <span className="label">County:</span>
              <span>{facility.county}</span>
            </div>
          )}

          <div className="info-row">
            <span className="label">Ownership:</span>
            <span>{facility.ownership_type || 'Unknown'}</span>
          </div>

          {facility.total_beds && (
            <div className="info-row">
              <Users size={16} />
              <span>{facility.total_beds} beds</span>
              {facility.occupancy_rate && (
                <span className="occupancy">({parseFloat(facility.occupancy_rate).toFixed(1)}% occupied)</span>
              )}
            </div>
          )}

          <div className="ratings-grid">
            {facility.health_inspection_rating && (
              <div className="rating-item">
                <span className="rating-label">Health</span>
                <div className="rating-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      fill={i < facility.health_inspection_rating ? "#fbbf24" : "none"}
                      stroke={i < facility.health_inspection_rating ? "#fbbf24" : "#d1d5db"}
                    />
                  ))}
                </div>
              </div>
            )}
            {facility.staffing_rating && (
              <div className="rating-item">
                <span className="rating-label">Staffing</span>
                <div className="rating-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      fill={i < facility.staffing_rating ? "#fbbf24" : "none"}
                      stroke={i < facility.staffing_rating ? "#fbbf24" : "#d1d5db"}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {defCount > 0 && (
            <div
              className="deficiencies-badge clickable"
              onClick={() => setDeficiencyModalFacility(facility)}
            >
              <AlertCircle size={14} />
              {defCount} deficiencies
            </div>
          )}

          <div className="participation-badges">
            {facility.accepts_medicare && <span className="badge">Medicare</span>}
            {facility.accepts_medicaid && <span className="badge">Medicaid</span>}
            {facility.special_focus_facility && (
              <span className="badge warning">Special Focus</span>
            )}
          </div>
        </div>

        {facility.phone && (
          <div className="facility-footer">
            <span className="phone">{facility.phone}</span>
          </div>
        )}
      </div>
    );
  };

  const hasActiveFilters = selectedChains.length > 0 || minRating > 0 || minBeds > 0 || maxBeds < 1000 || ownershipType !== 'all' || deficiencyFilter !== 'all' || sortBy !== 'relevance';

  return (
    <div className="facility-search">
      {!results && !loading && (
        <div className="search-section">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="e.g., Show me all facilities in the Pacific Northwest with 4+ star ratings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              className="search-button"
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
            >
              {loading ? <Loader className="spinning" size={20} /> : 'Search'}
            </button>
          </div>

          <div className="examples-section">
            <h3>Try these examples:</h3>
            <div className="example-queries">
              {exampleQueries.map((example, index) => (
                <button
                  key={index}
                  className="example-query"
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {results && (
        <div className="results-section">
          <div className="results-layout">
            {/* Left Sidebar with Filters */}
            <aside className="search-sidebar">
              <button className="new-search-btn" onClick={handleNewSearch}>
                <Search size={16} />
                New Search
              </button>

              <div className="sidebar-results-info">
                <h3>
                  Found {filteredResults?.total?.toLocaleString() || 0} facilities
                  {results.hasMore && ' (showing first 1000)'}
                </h3>
              </div>

              {/* Applied AI Filters */}
              {results.filters && Object.keys(results.filters).length > 0 && (
                <div className="sidebar-applied-filters">
                  <span className="filter-label">AI Search filters:</span>
                  <div className="filter-tags">
                    {results.filters.states && results.filters.states.length > 0 && (
                      <span className="filter-tag">
                        States: {results.filters.states.join(', ')}
                      </span>
                    )}
                    {results.filters.chainSizeMax && (
                      <span className="filter-tag">
                        Chain size ≤ {results.filters.chainSizeMax}
                      </span>
                    )}
                    {results.filters.chainSizeMin && (
                      <span className="filter-tag">
                        Chain size ≥ {results.filters.chainSizeMin}
                      </span>
                    )}
                    {results.filters.minOverallRating && (
                      <span className="filter-tag">
                        Rating ≥ {results.filters.minOverallRating} stars
                      </span>
                    )}
                    {results.filters.minBeds && (
                      <span className="filter-tag">
                        Beds ≥ {results.filters.minBeds}
                      </span>
                    )}
                    {results.filters.maxBeds && (
                      <span className="filter-tag">
                        Beds ≤ {results.filters.maxBeds}
                      </span>
                    )}
                    {results.filters.multiFacilityChain === false && (
                      <span className="filter-tag">Independent</span>
                    )}
                    {results.filters.multiFacilityChain === true && (
                      <span className="filter-tag">Chain-owned</span>
                    )}
                  </div>
                </div>
              )}

              {/* Chain Filter */}
              {availableChains.length > 0 && (
                <div className="sidebar-chain-filter">
                  <h4>Filter by Chain/Owner</h4>
                  <div className="sidebar-chain-list">
                    {availableChains.slice(0, 20).map(chain => {
                      const facilityCount = results.results.filter(
                        f => f.ownership_chain === chain
                      ).length;
                      return (
                        <label key={chain} className="sidebar-chain-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedChains.includes(chain)}
                            onChange={() => toggleChain(chain)}
                          />
                          <span className="chain-name">
                            {chain}
                            <span className="chain-count">({facilityCount})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Star Rating Filter */}
              <div className="sidebar-filter-section">
                <h4>Star Rating</h4>
                <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                  <option value={0}>Any</option>
                  <option value={1}>1+</option>
                  <option value={2}>2+</option>
                  <option value={3}>3+</option>
                  <option value={4}>4+</option>
                  <option value={5}>5 Stars</option>
                </select>
              </div>

              {/* Bed Count Filter */}
              <div className="sidebar-filter-section">
                <h4>Bed Count</h4>
                <select value={`${minBeds}-${maxBeds}`} onChange={(e) => {
                  const [min, max] = e.target.value.split('-').map(Number);
                  setMinBeds(min);
                  setMaxBeds(max);
                }}>
                  <option value="0-1000">All Sizes</option>
                  <option value="0-50">Small (1-50)</option>
                  <option value="51-100">Medium (51-100)</option>
                  <option value="101-150">Large (101-150)</option>
                  <option value="151-1000">Very Large (151+)</option>
                </select>
              </div>

              {/* Deficiency Filter */}
              <div className="sidebar-filter-section">
                <h4>Deficiencies</h4>
                <select value={deficiencyFilter} onChange={(e) => setDeficiencyFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="none">No Deficiencies</option>
                  <option value="low">Low (1-5)</option>
                  <option value="medium">Medium (6-15)</option>
                  <option value="high">High (16+)</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="sidebar-filter-section">
                <h4>Sort By</h4>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="relevance">Relevance</option>
                  <option value="rating">Star Rating (High to Low)</option>
                  <option value="rating-asc">Star Rating (Low to High)</option>
                  <option value="beds">Bed Count (High to Low)</option>
                  <option value="beds-asc">Bed Count (Low to High)</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>

              {/* Ownership Type Filter */}
              <div className="sidebar-filter-section">
                <h4>Ownership Type</h4>
                <select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="for-profit">For Profit</option>
                  <option value="non-profit">Non-Profit</option>
                  <option value="government">Government</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={clearFilters}>
                  <X size={16} />
                  Clear All Filters
                </button>
              )}
            </aside>

            {/* Main Content */}
            <div className="main-results-content">
              {/* Map Section */}
              <div className="map-section">
                <div className="map-header">
                  <div className="map-legend">
                    <div className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: '#22c55e' }}></div>
                      <span>4-5 stars</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: '#fbbf24' }}></div>
                      <span>3 stars</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
                      <span>1-2 stars</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: '#9ca3af' }}></div>
                      <span>No rating</span>
                    </div>
                  </div>
                </div>
                {mapsLoaded && (
                  <div style={{ position: 'relative', height: '500px', width: '100%' }}>
                    <GoogleMap
                      key="facility-map"
                      mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '8px' }}
                      center={{ lat: 39.8283, lng: -98.5795 }}
                      zoom={4}
                      options={{
                        styles: mapStyles,
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: true,
                      }}
                    >
                      {getFacilitiesForMap().map((facility) => (
                        <Marker
                          key={facility.id || facility.federal_provider_number}
                          position={{ lat: parseFloat(facility.latitude), lng: parseFloat(facility.longitude) }}
                          onClick={() => setSelectedFacility(facility)}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: getMarkerColor(facility),
                            fillOpacity: 0.85,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                            scale: 7
                          }}
                        />
                      ))}

                      {selectedFacility && selectedFacility.latitude && selectedFacility.longitude && (
                        <InfoWindow
                          position={{
                            lat: parseFloat(selectedFacility.latitude),
                            lng: parseFloat(selectedFacility.longitude)
                          }}
                          onCloseClick={() => setSelectedFacility(null)}
                        >
                          <div style={{ padding: '0.5rem', maxWidth: '300px' }}>
                            <div style={{ marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                              <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{selectedFacility.facility_name}</strong>
                              {selectedFacility.overall_rating && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', color: '#fbbf24' }}>
                                  <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                                  <span>{selectedFacility.overall_rating} stars</span>
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                              <div style={{ marginBottom: '0.25rem' }}>{selectedFacility.city}, {selectedFacility.state}</div>
                              {selectedFacility.total_beds && (
                                <div style={{ marginBottom: '0.25rem' }}>{selectedFacility.total_beds} beds</div>
                              )}
                              {selectedFacility.ownership_chain && (
                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>
                                  {selectedFacility.ownership_chain}
                                </div>
                              )}
                            </div>
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  </div>
                )}
              </div>

              {/* Facilities by Ownership */}
              <div className="facilities-by-ownership">
                {Object.entries(groupedFacilities()).map(([chain, facilities]) => (
                  <div key={chain} className="ownership-group">
                    <div className="ownership-header">
                      <div className="ownership-info">
                        <Building2 size={20} />
                        <h3>{chain}</h3>
                        <span className="facility-count">{facilities.length} facilities</span>
                      </div>
                      {chain !== 'Independent / Other' && facilities[0]?.chain_facility_count && (
                        <span className="total-chain-size">
                          ({facilities[0].chain_facility_count} total in chain)
                        </span>
                      )}
                    </div>
                    <div className="facilities-scroll-container">
                      <div className="facilities-horizontal-grid">
                        {facilities.map(facility => renderFacilityCard(facility))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <Loader className="spinning" size={48} />
          <p>Searching facilities...</p>
        </div>
      )}

      {/* Deficiency Modal */}
      {deficiencyModalFacility && (
        <DeficiencyModal
          facility={deficiencyModalFacility}
          onClose={() => setDeficiencyModalFacility(null)}
        />
      )}
    </div>
  );
}

export default FacilitySearch;
