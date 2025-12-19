import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader,
  AlertCircle,
  Calendar,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { getTransactions, getFilterOptions } from '../../api/maAnalyticsService';

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// State abbreviation to full name mapping
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
  'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
  'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
  'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
  'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'PR': 'Puerto Rico',
  'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee',
  'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
  'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

/**
 * Format date for display (2025-11-01 -> Nov 1, 2025)
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Format number with commas
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
};

/**
 * MultiSelect Dropdown Component
 */
const MultiSelect = ({ label, options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => {
      const label = typeof opt === 'string' ? opt : opt.label;
      return label.toLowerCase().includes(term);
    });
  }, [options, searchTerm]);

  const handleToggle = (optValue) => {
    const newValue = value.includes(optValue)
      ? value.filter(v => v !== optValue)
      : [...value, optValue];
    onChange(newValue);
  };

  const displayText = value.length === 0
    ? placeholder || `Select ${label}`
    : value.length === 1
      ? (typeof options[0] === 'string' ? value[0] : options.find(o => o.value === value[0])?.label || value[0])
      : `${value.length} selected`;

  return (
    <div className="filter-dropdown">
      <label className="filter-label">{label}</label>
      <div className="dropdown-wrapper">
        <button
          type="button"
          className={`dropdown-button ${value.length > 0 ? 'has-value' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="dropdown-text">{displayText}</span>
          <ChevronDown size={16} className={isOpen ? 'rotated' : ''} />
        </button>
        {isOpen && (
          <div className="dropdown-panel">
            {options.length > 10 && (
              <div className="dropdown-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div className="dropdown-options">
              {filteredOptions.map((opt) => {
                const optValue = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                const isSelected = value.includes(optValue);
                return (
                  <label key={optValue} className={`dropdown-option ${isSelected ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(optValue)}
                    />
                    <span>{optLabel}</span>
                  </label>
                );
              })}
              {filteredOptions.length === 0 && (
                <div className="dropdown-empty">No matches</div>
              )}
            </div>
          </div>
        )}
      </div>
      {isOpen && <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

/**
 * Text Input Filter Component
 */
const TextFilter = ({ label, value, onChange, placeholder, icon: Icon }) => {
  return (
    <div className="filter-input">
      <label className="filter-label">{label}</label>
      <div className="input-wrapper">
        {Icon && <Icon size={16} className="input-icon" />}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {value && (
          <button className="input-clear" onClick={() => onChange('')}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Number Input Filter Component
 */
const NumberFilter = ({ label, value, onChange, placeholder }) => {
  return (
    <div className="filter-input filter-input-small">
      <label className="filter-label">{label}</label>
      <div className="input-wrapper">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min="0"
        />
        {value && (
          <button className="input-clear" onClick={() => onChange('')}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Date Range Filter Component
 */
const DateRangeFilter = ({ startDate, endDate, onStartChange, onEndChange }) => {
  return (
    <div className="filter-date-range">
      <label className="filter-label">Date Range</label>
      <div className="date-inputs">
        <div className="date-input-wrapper">
          <Calendar size={14} className="date-icon" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <span className="date-separator">to</span>
        <div className="date-input-wrapper">
          <Calendar size={14} className="date-icon" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Sortable Table Header Component
 */
const SortableHeader = ({ label, sortKey, currentSort, currentOrder, onSort, width }) => {
  const isActive = currentSort === sortKey;
  return (
    <th
      style={{ width }}
      className={`sortable-header ${isActive ? 'active' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      <span className="sort-icons">
        <ChevronUp size={12} className={isActive && currentOrder === 'asc' ? 'active' : ''} />
        <ChevronDown size={12} className={isActive && currentOrder === 'desc' ? 'active' : ''} />
      </span>
    </th>
  );
};

/**
 * Pagination Component
 */
const Pagination = ({ page, totalPages, totalRecords, onPageChange }) => {
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing page {page} of {formatNumber(totalPages)} ({formatNumber(totalRecords)} records)
      </div>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          title="First page"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="pagination-pages">
          {pageNumbers[0] > 1 && (
            <>
              <button className="pagination-page" onClick={() => onPageChange(1)}>1</button>
              {pageNumbers[0] > 2 && <span className="pagination-ellipsis">...</span>}
            </>
          )}
          {pageNumbers.map(num => (
            <button
              key={num}
              className={`pagination-page ${num === page ? 'active' : ''}`}
              onClick={() => onPageChange(num)}
            >
              {num}
            </button>
          ))}
          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="pagination-ellipsis">...</span>
              )}
              <button className="pagination-page" onClick={() => onPageChange(totalPages)}>
                {totalPages}
              </button>
            </>
          )}
        </div>
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
        <button
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          title="Last page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

/**
 * Transaction Explorer Tab
 */
const TransactionExplorerTab = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({ states: [], cbsas: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Filter values - initialize from URL params
  const [stateFilter, setStateFilter] = useState(() => {
    const param = searchParams.get('state');
    return param ? param.split(',') : [];
  });
  const [cbsaFilter, setCbsaFilter] = useState(() => {
    const param = searchParams.get('cbsa');
    return param ? param.split(',') : [];
  });
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [oldOperator, setOldOperator] = useState(searchParams.get('oldOperator') || '');
  const [newOperator, setNewOperator] = useState(searchParams.get('newOperator') || '');
  const [minBeds, setMinBeds] = useState(searchParams.get('minBeds') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Debounced search values
  const debouncedOldOperator = useDebounce(oldOperator, 300);
  const debouncedNewOperator = useDebounce(newOperator, 300);
  const debouncedSearch = useDebounce(search, 300);

  // Table state
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'date');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');

  // Fetch filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const options = await getFilterOptions();
        setFilterOptions({
          states: options.states || [],
          cbsas: (options.cbsas || []).map(c => ({ value: c.code, label: c.title }))
        });
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  // Fetch transactions
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: 50,
        sortBy,
        sortOrder,
      };

      if (stateFilter.length > 0) params.state = stateFilter.join(',');
      if (cbsaFilter.length > 0) params.cbsa = cbsaFilter.join(',');
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (debouncedOldOperator) params.oldOperator = debouncedOldOperator;
      if (debouncedNewOperator) params.newOperator = debouncedNewOperator;
      if (minBeds) params.minBeds = minBeds;
      if (debouncedSearch) params.search = debouncedSearch;

      const result = await getTransactions(params);
      setTransactions(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalRecords(result.pagination?.totalRecords || 0);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError('Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, stateFilter, cbsaFilter, startDate, endDate, debouncedOldOperator, debouncedNewOperator, minBeds, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', 'explorer');
    if (stateFilter.length > 0) params.set('state', stateFilter.join(','));
    if (cbsaFilter.length > 0) params.set('cbsa', cbsaFilter.join(','));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (oldOperator) params.set('oldOperator', oldOperator);
    if (newOperator) params.set('newOperator', newOperator);
    if (minBeds) params.set('minBeds', minBeds);
    if (search) params.set('search', search);
    if (sortBy !== 'date') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    setSearchParams(params, { replace: true });
  }, [stateFilter, cbsaFilter, startDate, endDate, oldOperator, newOperator, minBeds, search, sortBy, sortOrder, setSearchParams]);

  // Handle sort
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear all filters
  const clearFilters = () => {
    setStateFilter([]);
    setCbsaFilter([]);
    setStartDate('');
    setEndDate('');
    setOldOperator('');
    setNewOperator('');
    setMinBeds('');
    setSearch('');
    setPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = stateFilter.length > 0 || cbsaFilter.length > 0 || startDate || endDate || oldOperator || newOperator || minBeds || search;

  // Navigate to facility detail
  const handleFacilityClick = (ccn) => {
    navigate(`/facility-metrics/${ccn}`);
  };

  // Navigate to owner profile (placeholder - adjust route as needed)
  const handleOperatorClick = (operatorName) => {
    // Navigate to ownership research filtered by this operator
    navigate(`/ownership-research?search=${encodeURIComponent(operatorName)}`);
  };

  return (
    <div className="transaction-explorer-tab">
      {/* Filter Bar */}
      <div className="explorer-filter-bar">
        <div className="filter-row">
          <MultiSelect
            label="State"
            options={filterOptions.states}
            value={stateFilter}
            onChange={(val) => { setStateFilter(val); setPage(1); }}
            placeholder="All States"
          />
          <MultiSelect
            label="CBSA/Market"
            options={filterOptions.cbsas}
            value={cbsaFilter}
            onChange={(val) => { setCbsaFilter(val); setPage(1); }}
            placeholder="All Markets"
          />
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={(val) => { setStartDate(val); setPage(1); }}
            onEndChange={(val) => { setEndDate(val); setPage(1); }}
          />
        </div>
        <div className="filter-row">
          <TextFilter
            label="Old Operator"
            value={oldOperator}
            onChange={setOldOperator}
            placeholder="Search seller..."
            icon={Building2}
          />
          <TextFilter
            label="New Operator"
            value={newOperator}
            onChange={setNewOperator}
            placeholder="Search buyer..."
            icon={Building2}
          />
          <NumberFilter
            label="Min Beds"
            value={minBeds}
            onChange={(val) => { setMinBeds(val); setPage(1); }}
            placeholder="0"
          />
          <TextFilter
            label="Facility Search"
            value={search}
            onChange={setSearch}
            placeholder="Search by name or CCN..."
            icon={Search}
          />
          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              <X size={14} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="explorer-results-header">
        <div className="results-count">
          {loading ? (
            <span>Loading...</span>
          ) : (
            <span>{formatNumber(totalRecords)} transactions found</span>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="explorer-table-container">
        {loading ? (
          <div className="explorer-loading">
            <Loader size={32} className="spin" />
            <span>Loading transactions...</span>
          </div>
        ) : error ? (
          <div className="explorer-error">
            <AlertCircle size={24} />
            <span>{error}</span>
            <button onClick={fetchData}>Try Again</button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="explorer-empty">
            <Search size={48} strokeWidth={1.5} />
            <h3>No transactions found</h3>
            <p>Try adjusting your filters or search criteria</p>
            {hasActiveFilters && (
              <button onClick={clearFilters}>Clear All Filters</button>
            )}
          </div>
        ) : (
          <table className="explorer-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Date"
                  sortKey="date"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="100px"
                />
                <SortableHeader
                  label="CCN"
                  sortKey="ccn"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="80px"
                />
                <SortableHeader
                  label="Facility"
                  sortKey="facilityName"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="200px"
                />
                <SortableHeader
                  label="City"
                  sortKey="city"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="120px"
                />
                <SortableHeader
                  label="State"
                  sortKey="state"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="60px"
                />
                <SortableHeader
                  label="CBSA"
                  sortKey="cbsa"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="180px"
                />
                <SortableHeader
                  label="Beds"
                  sortKey="beds"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="60px"
                />
                <SortableHeader
                  label="Old Operator"
                  sortKey="oldOperator"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="180px"
                />
                <SortableHeader
                  label="New Operator"
                  sortKey="newOperator"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                  width="180px"
                />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr key={`${tx.ccn}-${tx.date}-${index}`}>
                  <td>{formatDate(tx.date)}</td>
                  <td className="ccn-cell">{tx.ccn}</td>
                  <td>
                    <button
                      className="link-cell"
                      onClick={() => handleFacilityClick(tx.ccn)}
                      title="View facility details"
                    >
                      {tx.facilityName}
                      <ExternalLink size={12} />
                    </button>
                  </td>
                  <td>{tx.city}</td>
                  <td>{tx.state}</td>
                  <td className="cbsa-cell" title={tx.cbsa}>{tx.cbsa}</td>
                  <td className="number-cell">{formatNumber(tx.beds)}</td>
                  <td>
                    <button
                      className="link-cell operator-cell"
                      onClick={() => handleOperatorClick(tx.oldOperator)}
                      title="View operator profile"
                    >
                      {tx.oldOperator}
                    </button>
                  </td>
                  <td>
                    <button
                      className="link-cell operator-cell"
                      onClick={() => handleOperatorClick(tx.newOperator)}
                      title="View operator profile"
                    >
                      {tx.newOperator}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && transactions.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

export default TransactionExplorerTab;
