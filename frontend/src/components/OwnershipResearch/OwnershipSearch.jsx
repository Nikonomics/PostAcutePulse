import { useState, useEffect } from 'react';
import { Search, Building2, MapPin, Star, ChevronRight, Loader } from 'lucide-react';
import { getTopChains, searchOwnership, getOwnerDetails } from '../../api/ownershipService';
import OwnerDetailsModal from './OwnerDetailsModal';
import './OwnershipSearch.css';

function OwnershipSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ownershipData, setOwnershipData] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [filters, setFilters] = useState({
    ownershipType: 'all',
    minFacilities: '',
    minBeds: '',
    sortBy: 'facilities'
  });
  const [topChains, setTopChains] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load top chains on mount
  useEffect(() => {
    loadTopChains();
  }, []);

  const loadTopChains = async () => {
    setInitialLoading(true);
    try {
      const response = await getTopChains(20);
      if (response.success) {
        setTopChains(response.data);
      }
    } catch (error) {
      console.error('Error loading top chains:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await searchOwnership({
        search: searchTerm,
        ...filters
      });
      if (response.success) {
        setOwnershipData(response.data);
      }
    } catch (error) {
      console.error('Error searching ownership:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOwnerDetails = async (ownerName) => {
    setLoadingDetails(true);
    try {
      const response = await getOwnerDetails(ownerName);
      if (response.success) {
        setSelectedOwner(response.data);
      }
    } catch (error) {
      console.error('Error loading owner details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getOwnershipTypeColor = (type) => {
    const typeLower = (type || '').toLowerCase();
    if (typeLower.includes('profit') && !typeLower.includes('non')) return '#f59e0b';
    if (typeLower.includes('non')) return '#10b981';
    if (typeLower.includes('government')) return '#3b82f6';
    return '#6b7280';
  };

  const handleChainClick = (chain) => {
    setSearchTerm(chain.ownership_chain);
    loadOwnerDetails(chain.ownership_chain);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setOwnershipData([]);
  };

  return (
    <div className="ownership-search">
      <div className="ownership-main">
        {/* Filters Sidebar */}
        <aside className="ownership-sidebar">
          {/* Search Bar */}
          <div className="search-section">
            <h3>Search</h3>
            <form onSubmit={handleSearch} className="ownership-search-form">
              <div className="ownership-search-bar">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search by chain name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button type="submit" disabled={loading || !searchTerm.trim()}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>
            {searchTerm && ownershipData.length > 0 && (
              <button className="clear-search-btn" onClick={handleClearSearch}>
                Clear Search
              </button>
            )}
          </div>

          <div className="filter-section">
            <h3>Filters</h3>

            <div className="filter-group">
              <label>Ownership Type</label>
              <select
                value={filters.ownershipType}
                onChange={(e) => setFilters({ ...filters, ownershipType: e.target.value })}
              >
                <option value="all">All Types</option>
                <option value="For profit">For Profit</option>
                <option value="Non-profit">Non-Profit</option>
                <option value="Government">Government</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Minimum Facilities</label>
              <input
                type="number"
                placeholder="e.g., 5"
                value={filters.minFacilities}
                onChange={(e) => setFilters({ ...filters, minFacilities: e.target.value })}
              />
            </div>

            <div className="filter-group">
              <label>Minimum Total Beds</label>
              <input
                type="number"
                placeholder="e.g., 100"
                value={filters.minBeds}
                onChange={(e) => setFilters({ ...filters, minBeds: e.target.value })}
              />
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              >
                <option value="facilities">Most Facilities</option>
                <option value="beds">Most Beds</option>
                <option value="rating">Highest Rating</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>

            <button
              className="filter-reset-btn"
              onClick={() => setFilters({
                ownershipType: 'all',
                minFacilities: '',
                minBeds: '',
                sortBy: 'facilities'
              })}
            >
              Reset Filters
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="ownership-content">
          {initialLoading ? (
            <div className="loading-state">
              <Loader className="spinning" size={48} />
              <p>Loading top chains...</p>
            </div>
          ) : (
            <>
              {/* Top Chains List - show when no search */}
              {!searchTerm && topChains.length > 0 && (
                <div className="top-chains-section">
                  <h2>Top 20 SNF Chains Nationwide</h2>
                  <div className="chains-list">
                    {topChains.map((chain, index) => (
                      <div
                        key={index}
                        className="chain-card"
                        onClick={() => handleChainClick(chain)}
                      >
                        <div className="chain-rank">#{chain.ranking || index + 1}</div>
                        <div className="chain-info">
                          <div className="chain-name">{chain.ownership_chain}</div>
                          <div className="chain-stats">
                            <span className="chain-stat">
                              <Building2 size={14} />
                              {chain.facility_count} facilities
                            </span>
                            <span className="chain-stat">
                              {parseInt(chain.total_beds || 0).toLocaleString()} beds
                            </span>
                            <span className="chain-stat">
                              <MapPin size={14} />
                              {chain.state_count} states
                            </span>
                            {chain.avg_rating && (
                              <span className="chain-stat">
                                <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                                {parseFloat(chain.avg_rating).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={20} className="chain-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Results */}
              {searchTerm && ownershipData.length > 0 && (
                <div className="search-results">
                  <h2>Search Results for "{searchTerm}"</h2>
                  <div className="results-list">
                    {ownershipData.map((owner, index) => (
                      <div
                        key={index}
                        className="owner-card"
                        onClick={() => loadOwnerDetails(owner.ownership_chain)}
                      >
                        <div className="owner-header">
                          <div className="owner-title-row">
                            <h3>{owner.ownership_chain}</h3>
                            {owner.ranking && (
                              <span className="owner-ranking">#{owner.ranking}</span>
                            )}
                          </div>
                          <span
                            className="ownership-type-badge"
                            style={{ backgroundColor: getOwnershipTypeColor(owner.ownership_type) }}
                          >
                            {owner.ownership_type}
                          </span>
                        </div>
                        <div className="owner-stats">
                          <div className="owner-stat">
                            <Building2 size={16} />
                            <span>{owner.facility_count} Facilities</span>
                          </div>
                          <div className="owner-stat">
                            <span>{parseInt(owner.total_beds || 0).toLocaleString()} Beds</span>
                          </div>
                          <div className="owner-stat">
                            <MapPin size={16} />
                            <span>{owner.state_count} States</span>
                          </div>
                          {owner.avg_rating && (
                            <div className="owner-stat">
                              <Star size={16} fill="#fbbf24" stroke="#fbbf24" />
                              <span>{parseFloat(owner.avg_rating || 0).toFixed(1)} Avg Rating</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {searchTerm && ownershipData.length === 0 && !loading && (
                <div className="empty-state">
                  <Search size={48} />
                  <h3>No results found</h3>
                  <p>Try adjusting your search term or filters</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Owner Details Modal */}
      {selectedOwner && (
        <OwnerDetailsModal
          owner={selectedOwner}
          onClose={() => setSelectedOwner(null)}
          loading={loadingDetails}
        />
      )}
    </div>
  );
}

export default OwnershipSearch;
