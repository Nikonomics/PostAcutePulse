/**
 * MarketListPage.jsx
 *
 * Analyst view for filtering, sorting, and comparing markets.
 *
 * Features:
 * - Filterable market list with state, grade, archetype, TAM filters
 * - Sortable by score, TAM, or name
 * - Search functionality with debounce
 * - Multi-select for market comparison (max 5)
 * - Pagination
 *
 * Route: /market-grading/list
 *
 * API calls:
 * - getMarketList({ filters, sort, pagination })
 * - getFilterOptions()
 * - searchMarkets(query)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Spinner,
  Alert,
  Button,
  Form,
  InputGroup,
  Pagination,
  Badge
} from 'react-bootstrap';
import {
  MarketCard,
  GradeBadge
} from '../../components/MarketGrading';
import {
  getMarketList,
  getFilterOptions,
  searchMarkets
} from '../../api/marketGradingService';

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// TAM filter options
const TAM_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '$50M+', value: 50000000 },
  { label: '$100M+', value: 100000000 },
  { label: '$250M+', value: 250000000 },
  { label: '$500M+', value: 500000000 },
  { label: '$1B+', value: 1000000000 }
];

const MarketListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    states: [],
    grades: [],
    archetypes: []
  });

  // Markets data
  const [markets, setMarkets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filters
  const [filters, setFilters] = useState({
    state: searchParams.get('state') || '',
    grade: searchParams.get('grade') || '',
    archetype: searchParams.get('archetype') || '',
    minTam: parseInt(searchParams.get('minTam')) || 0
  });

  // Sort
  const [sortField, setSortField] = useState(searchParams.get('sort') || 'score');
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'desc');

  // Pagination
  const [page, setPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [limit] = useState(20);

  // Selection for comparison
  const [selectedMarkets, setSelectedMarkets] = useState([]);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const options = await getFilterOptions();
        setFilterOptions(options);
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchFilters();
  }, []);

  // Fetch markets when filters/sort/page change
  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getMarketList({
        state: filters.state || null,
        grade: filters.grade || null,
        archetype: filters.archetype || null,
        minTam: filters.minTam || null,
        sort: sortField,
        order: sortOrder,
        limit,
        offset: (page - 1) * limit
      });

      setMarkets(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      setError(err.message || 'Failed to load markets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, sortField, sortOrder, page, limit]);

  useEffect(() => {
    // Only fetch if not in search mode
    if (!debouncedSearch) {
      fetchMarkets();
    }
  }, [fetchMarkets, debouncedSearch]);

  // Handle search
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const result = await searchMarkets(debouncedSearch, 50);
        setSearchResults(result.results || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearch]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.state) params.set('state', filters.state);
    if (filters.grade) params.set('grade', filters.grade);
    if (filters.archetype) params.set('archetype', filters.archetype);
    if (filters.minTam) params.set('minTam', filters.minTam.toString());
    if (sortField !== 'score') params.set('sort', sortField);
    if (sortOrder !== 'desc') params.set('order', sortOrder);
    if (page > 1) params.set('page', page.toString());
    if (searchQuery) params.set('q', searchQuery);

    setSearchParams(params, { replace: true });
  }, [filters, sortField, sortOrder, page, searchQuery, setSearchParams]);

  // Handlers
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ state: '', grade: '', archetype: '', minTam: 0 });
    setSearchQuery('');
    setPage(1);
  };

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleMarketClick = (cbsaCode) => {
    navigate(`/market-grading/market/${cbsaCode}`);
  };

  const handleMarketSelect = (cbsaCode, selected) => {
    if (selected) {
      if (selectedMarkets.length < 5) {
        setSelectedMarkets(prev => [...prev, cbsaCode]);
      }
    } else {
      setSelectedMarkets(prev => prev.filter(code => code !== cbsaCode));
    }
  };

  const handleCompare = () => {
    if (selectedMarkets.length >= 2) {
      navigate(`/market-grading/compare?ids=${selectedMarkets.join(',')}`);
    }
  };

  const handleRetry = () => {
    fetchMarkets();
  };

  // Calculate pagination
  const totalPages = Math.ceil(total / limit);

  const paginationItems = useMemo(() => {
    const items = [];
    const maxVisible = 5;

    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => setPage(1)}>1</Pagination.Item>
      );
      if (start > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
      }
    }

    for (let i = start; i <= end; i++) {
      items.push(
        <Pagination.Item key={i} active={i === page} onClick={() => setPage(i)}>
          {i}
        </Pagination.Item>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
      }
      items.push(
        <Pagination.Item key={totalPages} onClick={() => setPage(totalPages)}>
          {totalPages}
        </Pagination.Item>
      );
    }

    return items;
  }, [page, totalPages]);

  // Determine which markets to display
  const displayMarkets = debouncedSearch ? searchResults : markets;
  const displayCount = debouncedSearch ? searchResults.length : total;

  // Check if any filters are active
  const hasActiveFilters = filters.state || filters.grade || filters.archetype || filters.minTam > 0;

  // Styles
  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    paddingTop: 24,
    paddingBottom: 48
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  };

  const titleStyle = {
    fontSize: 28,
    fontWeight: 700,
    color: '#111827',
    margin: 0
  };

  const filtersContainerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 16,
    marginBottom: 20
  };

  const filterRowStyle = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  };

  const sortContainerStyle = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: '12px 16px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12
  };

  const sortButtonStyle = (isActive) => ({
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    backgroundColor: isActive ? '#3b82f6' : '#ffffff',
    color: isActive ? '#ffffff' : '#374151',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  });

  const resultsHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  };

  const resultsCountStyle = {
    fontSize: 14,
    color: '#6b7280'
  };

  const marketListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  };

  const loadingContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    gap: 16
  };

  const paginationContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 24
  };

  const emptyStateStyle = {
    textAlign: 'center',
    padding: 60,
    color: '#9ca3af'
  };

  return (
    <div style={pageStyle}>
      <Container>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>Market Analysis</h1>
          <InputGroup style={{ maxWidth: 300 }}>
            <Form.Control
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroup.Text>
              {isSearching ? <Spinner animation="border" size="sm" /> : '🔍'}
            </InputGroup.Text>
          </InputGroup>
        </div>

        {/* Filters */}
        <div style={filtersContainerStyle}>
          <div style={filterRowStyle}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Filters:</span>

            <Form.Select
              size="sm"
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">All States</option>
              {filterOptions.states?.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </Form.Select>

            <Form.Select
              size="sm"
              value={filters.grade}
              onChange={(e) => handleFilterChange('grade', e.target.value)}
              style={{ width: 120 }}
            >
              <option value="">All Grades</option>
              {filterOptions.grades?.map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </Form.Select>

            <Form.Select
              size="sm"
              value={filters.archetype}
              onChange={(e) => handleFilterChange('archetype', e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">All Archetypes</option>
              {filterOptions.archetypes?.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Form.Select>

            <Form.Select
              size="sm"
              value={filters.minTam}
              onChange={(e) => handleFilterChange('minTam', parseInt(e.target.value))}
              style={{ width: 130 }}
            >
              {TAM_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>TAM: {opt.label}</option>
              ))}
            </Form.Select>

            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                onClick={handleClearFilters}
                style={{ color: '#6b7280', textDecoration: 'none' }}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Sort Controls */}
        <div style={sortContainerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Sort by:</span>
            <button
              style={sortButtonStyle(sortField === 'score')}
              onClick={() => handleSortChange('score')}
            >
              Score {sortField === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              style={sortButtonStyle(sortField === 'tam')}
              onClick={() => handleSortChange('tam')}
            >
              TAM {sortField === 'tam' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              style={sortButtonStyle(sortField === 'name')}
              onClick={() => handleSortChange('name')}
            >
              Name {sortField === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Order:</span>
            <button
              style={sortButtonStyle(sortOrder === 'desc')}
              onClick={() => setSortOrder('desc')}
            >
              Desc
            </button>
            <button
              style={sortButtonStyle(sortOrder === 'asc')}
              onClick={() => setSortOrder('asc')}
            >
              Asc
            </button>
          </div>
        </div>

        {/* Results header */}
        <div style={resultsHeaderStyle}>
          <span style={resultsCountStyle}>
            {debouncedSearch
              ? `${displayCount} results for "${debouncedSearch}"`
              : `Showing ${displayCount} markets`
            }
          </span>
          <Button
            variant={selectedMarkets.length >= 2 ? 'primary' : 'outline-secondary'}
            size="sm"
            disabled={selectedMarkets.length < 2}
            onClick={handleCompare}
          >
            Compare Selected ({selectedMarkets.length})
            {selectedMarkets.length >= 5 && ' - Max'}
          </Button>
        </div>

        {/* Loading state */}
        {loading && !debouncedSearch && (
          <div style={loadingContainerStyle}>
            <Spinner animation="border" variant="primary" />
            <span style={{ fontSize: 14, color: '#6b7280' }}>Loading markets...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={loadingContainerStyle}>
            <Alert variant="danger" className="mb-3">
              <Alert.Heading>Error Loading Data</Alert.Heading>
              <p className="mb-0">{error}</p>
            </Alert>
            <Button variant="primary" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        )}

        {/* Markets list */}
        {!loading && !error && (
          <>
            {displayMarkets.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                  No markets found
                </div>
                <div style={{ fontSize: 14 }}>
                  Try adjusting your filters or search query
                </div>
              </div>
            ) : (
              <div style={marketListStyle}>
                {displayMarkets.map((market, idx) => {
                  // Handle both search results and full market data
                  const cbsaCode = market.cbsa_code;
                  const isSelected = selectedMarkets.includes(cbsaCode);

                  // Search results have a simpler structure
                  if (debouncedSearch) {
                    return (
                      <div
                        key={cbsaCode}
                        onClick={() => handleMarketClick(cbsaCode)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          backgroundColor: '#ffffff',
                          borderRadius: 10,
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                            {market.name}
                          </div>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>
                            Score: {market.score?.toFixed(1)}
                          </div>
                        </div>
                        <GradeBadge grade={market.grade} size="md" />
                      </div>
                    );
                  }

                  // Full market card for list view
                  return (
                    <MarketCard
                      key={cbsaCode}
                      rank={(page - 1) * limit + idx + 1}
                      cbsaCode={cbsaCode}
                      name={market.name?.split(',')[0] || market.name}
                      state={market.state}
                      grades={{
                        overall: market.grades?.overall || 'C',
                        snf: market.grades?.snf || 'C',
                        alf: market.grades?.alf || 'C',
                        hha: market.grades?.hha || 'C'
                      }}
                      scores={{
                        overall: market.scores?.overall || 50,
                        snf: market.scores?.snf || 50,
                        alf: market.scores?.alf || 50,
                        hha: market.scores?.hha || 50
                      }}
                      tam={{
                        total: market.tam?.total || 0,
                        formatted: market.tam?.formatted || '$0'
                      }}
                      archetype={market.archetype || 'Balanced'}
                      isSelected={isSelected}
                      onSelect={(selected) => handleMarketSelect(cbsaCode, selected)}
                      onClick={() => handleMarketClick(cbsaCode)}
                    />
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!debouncedSearch && totalPages > 1 && (
              <div style={paginationContainerStyle}>
                <Pagination>
                  <Pagination.Prev
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  />
                  {paginationItems}
                  <Pagination.Next
                    disabled={page === totalPages}
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  />
                </Pagination>
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
};

export default MarketListPage;
