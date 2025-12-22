import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Bed,
  MapPin,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader,
  AlertCircle,
  ExternalLink,
  BarChart3,
  X,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getSummary,
  getTopBuyers,
  getTopSellers,
  getByState,
  getVolume,
  getDateRange,
} from '../../api/maAnalyticsService';
import USMapChart from './USMapChart';
import { analytics } from '../../analytics';

const DATE_RANGE_OPTIONS = [
  { value: '12m', label: 'Last 12 Months' },
  { value: '24m', label: 'Last 24 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range...' },
];

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
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
  'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
  'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
  'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming', 'PR': 'Puerto Rico'
};

/**
 * Format large numbers with commas
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString();
};

/**
 * Format percentage with sign
 */
const formatPercent = (num) => {
  if (num === null || num === undefined) return '-';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
};

/**
 * Summary Stats Card Component
 */
const StatCard = ({ title, value, change, changeLabel, icon: Icon, loading }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="stat-card">
      {loading ? (
        <div className="stat-card-loading">
          <Loader size={24} className="spin" />
        </div>
      ) : (
        <>
          <div className="stat-card-header">
            <span className="stat-card-title">{title}</span>
            {Icon && <Icon size={18} className="stat-card-icon" />}
          </div>
          <div className="stat-card-value">{value}</div>
          {change !== undefined && change !== null && (
            <div className={`stat-card-change ${isPositive ? 'positive' : ''} ${isNegative ? 'negative' : ''}`}>
              {isPositive ? <ArrowUpRight size={14} /> : isNegative ? <ArrowDownRight size={14} /> : null}
              <span>{formatPercent(change)} {changeLabel || 'vs last year'}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Leaderboard Table Component
 */
const LeaderboardTable = ({ title, data, columns, loading, error, onRowClick, onViewAll }) => {
  return (
    <div className="leaderboard-card">
      <div className="leaderboard-header">
        <h3>{title}</h3>
        {onViewAll && (
          <button className="view-all-btn" onClick={onViewAll}>
            View All <ExternalLink size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="leaderboard-loading">
          <Loader size={24} className="spin" />
          <span>Loading...</span>
        </div>
      ) : error ? (
        <div className="leaderboard-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      ) : data.length === 0 ? (
        <div className="leaderboard-empty">
          <span>No data available</span>
        </div>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="rank-col">#</th>
              {columns.map((col) => (
                <th key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? 'clickable' : ''}
              >
                <td className="rank-col">{index + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

/**
 * Format month label for chart (2024-03 -> Mar '24)
 */
const formatMonthLabel = (month) => {
  if (!month) return '';
  const [year, m] = month.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(m) - 1]} '${year.slice(2)}`;
};

/**
 * Custom tooltip for the chart
 */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{formatMonthLabel(label)}</p>
      {payload.map((entry, index) => (
        <p key={index} className="tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
};

/**
 * Historical Trend Chart Component
 */
const HistoricalTrendChart = ({ data, loading, error, onBarClick }) => {
  return (
    <div className="trend-chart-card">
      <div className="trend-chart-header">
        <div className="trend-chart-title-section">
          <BarChart3 size={20} className="trend-chart-icon" />
          <h3>Ownership Changes & Beds Transferred Over Time</h3>
        </div>
      </div>

      <div className="trend-chart-content">
        {loading ? (
          <div className="trend-chart-loading">
            <Loader size={32} className="spin" />
            <span>Loading chart data...</span>
          </div>
        ) : error ? (
          <div className="trend-chart-error">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        ) : data.length === 0 ? (
          <div className="trend-chart-empty">
            <span>No data available for the selected period</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0] && onBarClick) {
                  onBarClick(e.activePayload[0].payload);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#e2e8f0' }}
                axisLine={{ stroke: '#e2e8f0' }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#e2e8f0' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(val) => val.toLocaleString()}
                label={{
                  value: 'Transactions',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 }
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={{ stroke: '#e2e8f0' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(val) => val.toLocaleString()}
                label={{
                  value: 'Beds',
                  angle: 90,
                  position: 'insideRight',
                  style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 }
                }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: '10px' }}
              />
              <Bar
                yAxisId="left"
                dataKey="transactions"
                fill="#4F46E5"
                name="Ownership Changes"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bedsChanged"
                stroke="#10B981"
                strokeWidth={2}
                name="Beds Transferred"
                dot={false}
                activeDot={{ r: 6, fill: '#10B981' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

/**
 * Market Overview Tab
 */
const MarketOverviewTab = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  // Date range state
  const initialRange = searchParams.get('range') || '12m';
  const [dateRange, setDateRange] = useState(initialRange);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 100, left: 100 });
  const triggerRef = useRef(null);

  // Custom date range state
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Filter state - can be null, { type: 'state', value: 'FL', label: 'Florida' },
  // or { type: 'operator', value: 'ENSIGN', label: 'Ensign Group' }
  const [activeFilter, setActiveFilter] = useState(null);

  // Close dropdown when clicking outside (but not when clicking the portaled menu)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = dropdownRef.current && dropdownRef.current.contains(event.target);
      const clickedMenu = dropdownMenuRef.current && dropdownMenuRef.current.contains(event.target);
      if (!clickedTrigger && !clickedMenu) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Data states
  const [summary, setSummary] = useState(null);
  const [topBuyers, setTopBuyers] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  const [topStates, setTopStates] = useState([]);
  const [allStatesData, setAllStatesData] = useState([]); // Full state data for map
  const [volumeData, setVolumeData] = useState([]);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingVolume, setLoadingVolume] = useState(true);

  // Error states
  const [errors, setErrors] = useState({});

  // Fetch all data
  const fetchData = useCallback(async () => {
    let startDate, endDate;

    // Handle custom date range
    if (dateRange === 'custom') {
      startDate = searchParams.get('startDate') || customStartDate;
      endDate = searchParams.get('endDate') || customEndDate;
      if (!startDate || !endDate) {
        console.log('[DEBUG] Custom range selected but no dates set yet');
        return;
      }
    } else {
      const dates = getDateRange(dateRange);
      startDate = dates.startDate;
      endDate = dates.endDate;
    }

    console.log('[DEBUG] fetchData called with dateRange:', dateRange, '-> dates:', startDate, 'to', endDate);

    // Build params including active filter
    const params = { startDate, endDate };
    if (activeFilter?.type === 'state') {
      params.state = activeFilter.value;
    } else if (activeFilter?.type === 'operator') {
      params.operator = activeFilter.value;
    }

    // Fetch summary
    setLoadingSummary(true);
    try {
      const summaryData = await getSummary(params);
      setSummary(summaryData);
      setErrors((prev) => ({ ...prev, summary: null }));
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setErrors((prev) => ({ ...prev, summary: 'Failed to load summary' }));
    } finally {
      setLoadingSummary(false);
    }

    // Fetch top buyers
    setLoadingBuyers(true);
    try {
      const buyersData = await getTopBuyers({ ...params, limit: 10 });
      setTopBuyers(buyersData.data || []);
      setErrors((prev) => ({ ...prev, buyers: null }));
    } catch (err) {
      console.error('Failed to fetch top buyers:', err);
      setErrors((prev) => ({ ...prev, buyers: 'Failed to load' }));
    } finally {
      setLoadingBuyers(false);
    }

    // Fetch top sellers
    setLoadingSellers(true);
    try {
      const sellersData = await getTopSellers({ ...params, limit: 10 });
      setTopSellers(sellersData.data || []);
      setErrors((prev) => ({ ...prev, sellers: null }));
    } catch (err) {
      console.error('Failed to fetch top sellers:', err);
      setErrors((prev) => ({ ...prev, sellers: 'Failed to load' }));
    } finally {
      setLoadingSellers(false);
    }

    // Fetch states
    setLoadingStates(true);
    try {
      const statesData = await getByState(params);
      // Sort by transactions
      const sortedStates = (statesData.data || [])
        .sort((a, b) => b.transactions - a.transactions);
      // Store all states for the map
      setAllStatesData(sortedStates);
      // Take top 10 for the leaderboard
      setTopStates(sortedStates.slice(0, 10));
      setErrors((prev) => ({ ...prev, states: null }));
    } catch (err) {
      console.error('Failed to fetch states:', err);
      setErrors((prev) => ({ ...prev, states: 'Failed to load' }));
    } finally {
      setLoadingStates(false);
    }

    // Fetch volume data for chart and peak month calculation
    setLoadingVolume(true);
    try {
      const volumeResult = await getVolume(params);
      setVolumeData(volumeResult.data || []);
      setErrors((prev) => ({ ...prev, volume: null }));
    } catch (err) {
      console.error('Failed to fetch volume:', err);
      setErrors((prev) => ({ ...prev, volume: 'Failed to load chart data' }));
    } finally {
      setLoadingVolume(false);
    }
  }, [dateRange, activeFilter, customStartDate, customEndDate, searchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle date range change
  const handleDateRangeChange = (value) => {
    console.log('[DEBUG] Date range changing from', dateRange, 'to', value);

    if (value === 'custom') {
      // Show custom date picker instead of changing immediately
      setShowCustomPicker(true);
      setDropdownOpen(false);
      return;
    }

    const { startDate, endDate } = getDateRange(value);
    console.log('[DEBUG] New date range:', startDate, 'to', endDate);
    setDateRange(value);
    setShowCustomPicker(false);
    setDropdownOpen(false);
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    newParams.set('range', value);
    newParams.delete('startDate');
    newParams.delete('endDate');
    setSearchParams(newParams, { replace: true });
  };

  // Handle custom date range apply
  const handleCustomDateApply = () => {
    if (!customStartDate || !customEndDate) {
      alert('Please select both start and end dates');
      return;
    }
    console.log('[DEBUG] Applying custom date range:', customStartDate, 'to', customEndDate);
    setDateRange('custom');
    setShowCustomPicker(false);
    // Update URL with custom dates
    const newParams = new URLSearchParams(searchParams);
    newParams.set('range', 'custom');
    newParams.set('startDate', customStartDate);
    newParams.set('endDate', customEndDate);
    setSearchParams(newParams, { replace: true });
  };

  // Calculate peak month from volume data
  const getPeakMonth = () => {
    if (!volumeData || volumeData.length === 0) return '-';
    const peak = volumeData.reduce((max, item) =>
      item.transactions > max.transactions ? item : max
    , volumeData[0]);
    // Format month (2024-03 -> Mar 2024)
    const [year, month] = peak.month.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Filter handlers - set filter to update all data on this page
  const handleBuyerClick = (buyer) => {
    setActiveFilter({ type: 'operator', value: buyer.name, label: buyer.name });
    analytics.maOperatorClicked(buyer.name, buyer.transactions);
  };

  const handleSellerClick = (seller) => {
    setActiveFilter({ type: 'operator', value: seller.name, label: seller.name });
    analytics.maOperatorClicked(seller.name, seller.transactions);
  };

  const handleStateClick = (stateData) => {
    const stateName = STATE_NAMES[stateData.state] || stateData.state;
    setActiveFilter({ type: 'state', value: stateData.state, label: stateName });
    analytics.maStateClicked(stateData.state, stateData.transactions);
  };

  // Clear filter and go back to full overview
  const handleClearFilter = () => {
    setActiveFilter(null);
  };

  // Navigation to Transaction Explorer with current filter
  const handleViewAllBuyers = () => {
    const params = new URLSearchParams({ tab: 'explorer', sortBy: 'newOperator' });
    if (activeFilter?.type === 'state') params.set('state', activeFilter.value);
    if (activeFilter?.type === 'operator') params.set('newOperator', activeFilter.value);
    navigate(`/ma-intelligence?${params.toString()}`);
  };

  const handleViewAllSellers = () => {
    const params = new URLSearchParams({ tab: 'explorer', sortBy: 'oldOperator' });
    if (activeFilter?.type === 'state') params.set('state', activeFilter.value);
    if (activeFilter?.type === 'operator') params.set('oldOperator', activeFilter.value);
    navigate(`/ma-intelligence?${params.toString()}`);
  };

  const handleViewAllStates = () => {
    const params = new URLSearchParams({ tab: 'explorer', sortBy: 'state' });
    if (activeFilter?.type === 'operator') params.set('newOperator', activeFilter.value);
    navigate(`/ma-intelligence?${params.toString()}`);
  };

  // Handle chart bar click to filter by month
  const handleChartClick = (data) => {
    if (data && data.month) {
      // Navigate to Transaction Explorer filtered by this month
      const [year, month] = data.month.split('-');
      const startDate = `${year}-${month}-01`;
      // Calculate end of month
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      navigate(`/ma-intelligence?tab=explorer&startDate=${startDate}&endDate=${endDate}`);
    }
  };

  // Table column definitions
  const buyerColumns = [
    { key: 'name', label: 'Buyer' },
    { key: 'acquisitions', label: 'Deals', align: 'right', render: (val) => formatNumber(val) },
    { key: 'totalBeds', label: 'Beds', align: 'right', render: (val) => formatNumber(val) },
    { key: 'bedsPerDeal', label: 'Beds/Deal', align: 'right', render: (val, row) => {
      const deals = row.acquisitions || 1;
      const beds = row.totalBeds || 0;
      return Math.round(beds / deals);
    }},
  ];

  const sellerColumns = [
    { key: 'name', label: 'Seller' },
    { key: 'divestitures', label: 'Deals', align: 'right', render: (val) => formatNumber(val) },
    { key: 'totalBeds', label: 'Beds', align: 'right', render: (val) => formatNumber(val) },
    { key: 'bedsPerDeal', label: 'Beds/Deal', align: 'right', render: (val, row) => {
      const deals = row.divestitures || 1;
      const beds = row.totalBeds || 0;
      return Math.round(beds / deals);
    }},
  ];

  const stateColumns = [
    { key: 'state', label: 'State' },
    { key: 'transactions', label: 'Transactions', align: 'right', render: (val) => formatNumber(val) },
    { key: 'bedsChanged', label: 'Beds', align: 'right', render: (val) => formatNumber(val) },
  ];

  return (
    <div className="market-overview-tab">
      {/* Date Range Filter + Active Filter Badge */}
      <div className="overview-controls">
        {activeFilter && (
          <div className="active-filter-badge">
            <span className="filter-badge-icon">
              {activeFilter.type === 'state' ? <MapPin size={14} /> : <Building2 size={14} />}
            </span>
            <span className="filter-badge-text">
              Showing: <strong>{activeFilter.label}</strong>
            </span>
            <button className="filter-badge-clear" onClick={handleClearFilter}>
              <X size={14} />
              <span>Back to Overview</span>
            </button>
          </div>
        )}
        <div className="date-range-dropdown" ref={dropdownRef}>
          <button
            ref={triggerRef}
            type="button"
            className={`dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!dropdownOpen && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                const pos = {
                  top: rect.bottom + 4,
                  left: rect.left
                };
                setDropdownPosition(pos);
              }
              setDropdownOpen(!dropdownOpen);
            }}
            style={dropdownOpen ? { borderColor: '#3b82f6', background: '#eff6ff' } : {}}
          >
            <Calendar size={16} />
            <span>
              {dateRange === 'custom'
                ? `${customStartDate || searchParams.get('startDate')} to ${customEndDate || searchParams.get('endDate')}`
                : DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label}
            </span>
            <ChevronDown size={16} className={dropdownOpen ? 'rotated' : ''} />
          </button>
          {dropdownOpen && ReactDOM.createPortal(
            <div
              ref={dropdownMenuRef}
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                zIndex: 99999,
                minWidth: '180px',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                padding: '4px',
              }}
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleDateRangeChange(option.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: dateRange === option.value ? '#3b82f6' : '#374151',
                    background: dateRange === option.value ? '#eff6ff' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: dateRange === option.value ? '500' : 'normal'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {showCustomPicker && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
          }}
          onClick={() => setShowCustomPicker(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              minWidth: '320px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
              Select Date Range
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCustomPicker(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCustomDateApply}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#3b82f6',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Summary Cards - Full Width */}
      <div className="summary-cards-grid">
        <StatCard
          title="Total CHOWs"
          value={formatNumber(summary?.totalTransactions)}
          change={summary?.yoyChange}
          icon={Building2}
          loading={loadingSummary}
        />
        <StatCard
          title="Beds Transferred"
          value={formatNumber(summary?.totalBedsChanged)}
          icon={Bed}
          loading={loadingSummary}
        />
        <StatCard
          title="Active Markets"
          value={formatNumber(summary?.activeMarkets)}
          icon={MapPin}
          loading={loadingSummary}
        />
        <StatCard
          title="Peak Month"
          value={getPeakMonth()}
          icon={TrendingUp}
          loading={loadingSummary}
        />
      </div>

      {/* Historical Trend Chart - Full Width */}
      <HistoricalTrendChart
        data={volumeData}
        loading={loadingVolume}
        error={errors.volume}
        onBarClick={handleChartClick}
      />

      {/* Map + Leaderboards Row */}
      <div className="map-leaderboards-row">
        {/* US Map - Left Side */}
        <div className="map-section">
          <USMapChart
            data={allStatesData.length > 0 ? allStatesData : []}
            loading={loadingStates}
            error={errors.states}
            activeFilter={activeFilter}
            dateRange={getDateRange(dateRange)}
            onStateClick={handleStateClick}
          />
        </div>

        {/* Leaderboards - Right Side */}
        <div className="leaderboards-section">
          <LeaderboardTable
            title="Top Buyers"
            data={topBuyers}
            columns={buyerColumns}
            loading={loadingBuyers}
            error={errors.buyers}
            onRowClick={handleBuyerClick}
            onViewAll={handleViewAllBuyers}
          />
          <LeaderboardTable
            title="Top Sellers"
            data={topSellers}
            columns={sellerColumns}
            loading={loadingSellers}
            error={errors.sellers}
            onRowClick={handleSellerClick}
            onViewAll={handleViewAllSellers}
          />
        </div>
      </div>
    </div>
  );
};

export default MarketOverviewTab;
