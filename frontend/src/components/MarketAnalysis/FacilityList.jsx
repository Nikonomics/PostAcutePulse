import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  ChevronUp,
  ChevronDown,
  MapPin,
  AlertTriangle,
  Building2,
  TrendingUp,
  X,
  CheckCircle,
  Clock,
  ExternalLink,
  Info,
  Filter,
  Search,
} from 'lucide-react';
import { apiService } from '../../api/apiService';

// Tag prefix information and CMS links
const TAG_INFO = {
  'F': {
    name: 'Quality of Care',
    description: 'Federal regulatory requirements for quality of care in nursing homes',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes'
  },
  'G': {
    name: 'Administration',
    description: 'Administrative requirements including governing body, medical director, and management',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes'
  },
  'K': {
    name: 'Life Safety Code',
    description: 'Life Safety Code requirements for building safety and fire protection',
    url: 'https://www.cms.gov/medicare/health-safety-standards/quality-safety-oversight-general-information/life-safety-code-informationl'
  },
  'E': {
    name: 'Environment',
    description: 'Physical environment requirements for nursing homes',
    url: 'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes'
  }
};

// Scope and Severity information
const SCOPE_SEVERITY_INFO = {
  'A': 'Isolated / No actual harm with potential for minimal harm',
  'B': 'Pattern / No actual harm with potential for minimal harm',
  'C': 'Widespread / No actual harm with potential for minimal harm',
  'D': 'Isolated / No actual harm with potential for more than minimal harm',
  'E': 'Pattern / No actual harm with potential for more than minimal harm',
  'F': 'Widespread / No actual harm with potential for more than minimal harm',
  'G': 'Isolated / Actual harm that is not immediate jeopardy',
  'H': 'Pattern / Actual harm that is not immediate jeopardy',
  'I': 'Widespread / Actual harm that is not immediate jeopardy',
  'J': 'Isolated / Immediate jeopardy to resident health or safety',
  'K': 'Pattern / Immediate jeopardy to resident health or safety',
  'L': 'Widespread / Immediate jeopardy to resident health or safety'
};

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterRow: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    padding: '0.5rem 0.75rem',
    paddingLeft: '2rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    width: '200px',
    position: 'relative',
  },
  searchWrapper: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
  },
  filterSelect: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
    maxHeight: '500px',
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
  },
  thead: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#f9fafb',
    zIndex: 1,
  },
  th: {
    padding: '0.75rem 0.5rem',
    textAlign: 'left',
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  thSortable: {
    cursor: 'pointer',
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  },
  trSelected: {
    backgroundColor: '#eff6ff',
  },
  trHover: {
    backgroundColor: '#f9fafb',
  },
  td: {
    padding: '0.625rem 0.5rem',
    borderBottom: '1px solid #f3f4f6',
    color: '#111827',
    verticalAlign: 'middle',
  },
  facilityName: {
    fontWeight: 500,
    color: '#111827',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  facilityNameLink: {
    fontWeight: 500,
    color: '#2563eb',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  cityCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: '#6b7280',
  },
  ratingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'white',
  },
  starRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
    marginLeft: '0.25rem',
  },
  occupancyCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  occupancyBar: {
    width: '50px',
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  occupancyFill: {
    height: '100%',
    borderRadius: '2px',
  },
  occupancyText: {
    fontSize: '0.625rem',
    color: '#6b7280',
  },
  ownershipCell: {
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#2563eb',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  ownershipCellHover: {
    color: '#1e40af',
    textDecoration: 'underline',
  },
  typeBadge: {
    display: 'inline-flex',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 600,
  },
  snfBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  alfBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  deficiencyCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  deficiencyCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  defLow: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  defMedium: {
    backgroundColor: '#fef9c3',
    color: '#854d0e',
  },
  defHigh: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  specialFocus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.125rem',
    padding: '0.125rem 0.375rem',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
  },
  noData: {
    padding: '3rem',
    textAlign: 'center',
    color: '#9ca3af',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    borderTop: '1px solid #e5e7eb',
  },
  pageButton: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    backgroundColor: 'white',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  pageButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  pageInfo: {
    padding: '0.5rem 1rem',
    color: '#374151',
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    maxWidth: '800px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0.25rem',
  },
  modalBody: {
    padding: '1rem 1.5rem',
    overflowY: 'auto',
    flex: 1,
  },
  deficiencySummary: {
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deficiencyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  deficiencyItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    padding: '0.75rem',
    backgroundColor: '#f9fafb',
  },
  deficiencyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  surveyInfo: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    fontSize: '0.75rem',
  },
  surveyType: {
    fontWeight: 500,
    color: '#374151',
  },
  surveyDate: {
    color: '#6b7280',
  },
  statusBadges: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  tagBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    color: '#374151',
    textDecoration: 'none',
  },
  statusCorrected: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
  },
  statusUncorrected: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
  },
  deficiencyMetadata: {
    marginBottom: '0.5rem',
    fontSize: '0.75rem',
  },
  tagInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
  },
  severityBadge: {
    display: 'inline-flex',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    marginRight: '0.5rem',
  },
  deficiencyText: {
    fontSize: '0.75rem',
    color: '#374151',
    lineHeight: 1.5,
    cursor: 'pointer',
  },
  deficiencyTextCollapsed: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  expandHint: {
    fontSize: '0.625rem',
    color: '#3b82f6',
    marginTop: '0.25rem',
  },
  loadingState: {
    padding: '3rem',
    textAlign: 'center',
    color: '#6b7280',
  },
};

// Get rating badge color
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

// Get occupancy bar color
const getOccupancyColor = (rate) => {
  if (!rate) return '#9ca3af';
  if (rate >= 90) return '#22c55e';
  if (rate >= 80) return '#84cc16';
  if (rate >= 70) return '#eab308';
  return '#ef4444';
};

// Get deficiency style based on count
const getDeficiencyStyle = (count) => {
  if (count <= 5) return styles.defLow;
  if (count <= 15) return styles.defMedium;
  return styles.defHigh;
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Get severity color
const getSeverityColor = (severity) => {
  if (!severity) return { bg: '#e5e7eb', color: '#374151' };
  const level = severity.toUpperCase();
  if (['J', 'K', 'L'].includes(level)) return { bg: '#fee2e2', color: '#991b1b' };
  if (['G', 'H', 'I'].includes(level)) return { bg: '#fed7aa', color: '#9a3412' };
  if (['D', 'E', 'F'].includes(level)) return { bg: '#fef9c3', color: '#854d0e' };
  return { bg: '#dcfce7', color: '#166534' };
};

const FacilityList = ({
  facilities = [],
  facilityType,
  selectedFacility,
  onFacilitySelect,
}) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState({ key: 'beds', direction: 'desc' });
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredOwnership, setHoveredOwnership] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(30);

  // Deficiency modal state
  const [deficiencyModal, setDeficiencyModal] = useState(null);
  const [deficiencies, setDeficiencies] = useState([]);
  const [loadingDeficiencies, setLoadingDeficiencies] = useState(false);
  const [expandedDeficiency, setExpandedDeficiency] = useState(null);
  const [prefixFilter, setPrefixFilter] = useState('all');
  const [availablePrefixes, setAvailablePrefixes] = useState([]);

  // Get unique ownership types for filter
  const ownershipTypes = useMemo(() => {
    const types = new Set();
    facilities.forEach(f => {
      if (f.ownership?.type) types.add(f.ownership.type);
    });
    return Array.from(types).sort();
  }, [facilities]);

  // Filter and sort facilities
  const filteredFacilities = useMemo(() => {
    let filtered = [...facilities];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        f.facilityName?.toLowerCase().includes(term) ||
        f.city?.toLowerCase().includes(term) ||
        f.county?.toLowerCase().includes(term) ||
        f.ownership?.parentOrganization?.toLowerCase().includes(term)
      );
    }

    // Rating filter (SNF only)
    if (ratingFilter !== 'all' && facilityType === 'SNF') {
      const rating = parseInt(ratingFilter);
      filtered = filtered.filter(f => f.ratings?.overall === rating);
    }

    // Size filter
    if (sizeFilter !== 'all') {
      const beds = facilityType === 'SNF' ? 'beds' : 'capacity';
      filtered = filtered.filter(f => {
        const size = facilityType === 'SNF' ? f.beds?.total : f.capacity;
        if (!size) return false;
        switch (sizeFilter) {
          case 'small': return size <= 60;
          case 'medium': return size > 60 && size <= 120;
          case 'large': return size > 120;
          default: return true;
        }
      });
    }

    // Ownership filter - filter by ownership name (parent organization or licensee)
    if (ownershipFilter !== 'all') {
      filtered = filtered.filter(f => {
        const ownershipName = f.ownership?.parentOrganization || f.ownership?.licensee;
        return ownershipName === ownershipFilter;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'facilityName':
          aVal = a.facilityName?.toLowerCase() || '';
          bVal = b.facilityName?.toLowerCase() || '';
          break;
        case 'city':
          aVal = a.city?.toLowerCase() || '';
          bVal = b.city?.toLowerCase() || '';
          break;
        case 'county':
          aVal = a.county?.toLowerCase() || '';
          bVal = b.county?.toLowerCase() || '';
          break;
        case 'rating':
          aVal = a.ratings?.overall || 0;
          bVal = b.ratings?.overall || 0;
          break;
        case 'beds':
          aVal = a.beds?.total || a.capacity || 0;
          bVal = b.beds?.total || b.capacity || 0;
          break;
        case 'occupancy':
          aVal = parseFloat(a.occupancyRate) || 0;
          bVal = parseFloat(b.occupancyRate) || 0;
          break;
        case 'deficiencies':
          aVal = a.deficiencies?.total || 0;
          bVal = b.deficiencies?.total || 0;
          break;
        case 'owner':
          aVal = a.ownership?.parentOrganization?.toLowerCase() || '';
          bVal = b.ownership?.parentOrganization?.toLowerCase() || '';
          break;
        default:
          aVal = a[sortConfig.key];
          bVal = b[sortConfig.key];
      }

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [facilities, searchTerm, ratingFilter, sizeFilter, ownershipFilter, sortConfig, facilityType]);

  // Pagination
  const totalPages = Math.ceil(filteredFacilities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentFacilities = filteredFacilities.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleRowClick = (facility) => {
    onFacilitySelect(selectedFacility?.id === facility.id ? null : facility);
  };

  const handleOwnershipClick = (e, ownershipName) => {
    e.stopPropagation(); // Prevent row selection
    const ownership = ownershipName || '';
    if (ownership && ownership !== '-') {
      // Navigate to the ownership profile page
      navigate(`/ownership/${encodeURIComponent(ownership)}`);
    }
  };

  // Fetch deficiencies for a facility
  const fetchDeficiencies = async (facility, prefix = 'all') => {
    if (!facility.federalProviderNumber) {
      console.error('No federal provider number for facility');
      return;
    }

    setDeficiencyModal(facility);
    setLoadingDeficiencies(true);
    setDeficiencies([]);

    try {
      const response = await apiService.get(
        `/market/facilities/${facility.federalProviderNumber}/deficiencies`,
        { prefix, years: 3 }
      );

      if (response.data?.success) {
        setDeficiencies(response.data.deficiencies || []);
        // Extract unique prefixes
        const prefixes = [...new Set(
          (response.data.deficiencies || [])
            .map(d => d.deficiency_prefix)
            .filter(Boolean)
        )];
        setAvailablePrefixes(prefixes.sort());
      }
    } catch (error) {
      console.error('Error fetching deficiencies:', error);
      setDeficiencies([]);
    } finally {
      setLoadingDeficiencies(false);
    }
  };

  const handlePrefixFilterChange = (newPrefix) => {
    setPrefixFilter(newPrefix);
    if (deficiencyModal) {
      fetchDeficiencies(deficiencyModal, newPrefix);
    }
  };

  const closeModal = () => {
    setDeficiencyModal(null);
    setDeficiencies([]);
    setPrefixFilter('all');
    setExpandedDeficiency(null);
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={12} />
    ) : (
      <ChevronDown size={12} />
    );
  };

  const renderStars = (rating) => {
    if (!rating) return null;
    return (
      <div style={styles.starRating}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={10}
            fill={i <= rating ? getRatingColor(rating) : 'none'}
            stroke={i <= rating ? getRatingColor(rating) : '#d1d5db'}
          />
        ))}
      </div>
    );
  };

  const renderRating = (rating) => {
    if (!rating) return <span style={{ color: '#9ca3af' }}>-</span>;
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ ...styles.ratingBadge, backgroundColor: getRatingColor(rating) }}>
          {rating}
        </span>
        {renderStars(rating)}
      </div>
    );
  };

  const renderOccupancy = (rate) => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate)) return <span style={{ color: '#9ca3af' }}>-</span>;

    return (
      <div style={styles.occupancyCell}>
        <div style={styles.occupancyBar}>
          <div
            style={{
              ...styles.occupancyFill,
              width: `${Math.min(numRate, 100)}%`,
              backgroundColor: getOccupancyColor(numRate),
            }}
          />
        </div>
        <div style={styles.occupancyText}>{numRate.toFixed(1)}%</div>
      </div>
    );
  };

  if (facilities.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.noData}>
          <Building2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>No facilities found</div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Select a county to view facilities
          </div>
        </div>
      </div>
    );
  }

  // Column definitions
  const columns = [
    { key: 'facilityName', label: 'Facility Name', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'county', label: 'County', sortable: true },
    { key: 'owner', label: 'Ownership Company', sortable: true },
    ...(facilityType === 'SNF' ? [
      { key: 'rating', label: 'Rating', sortable: true },
    ] : []),
    { key: 'beds', label: facilityType === 'SNF' ? 'Beds' : 'Capacity', sortable: true },
    ...(facilityType === 'SNF' ? [
      { key: 'occupancy', label: 'Occupancy', sortable: true },
    ] : []),
    { key: 'type', label: 'Type', sortable: false },
    ...(facilityType === 'SNF' ? [
      { key: 'deficiencies', label: 'Deficiencies', sortable: true },
    ] : []),
  ];

  return (
    <div style={styles.container}>
      {/* Header with filters */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.title}>
            <Building2 size={16} />
            Facilities in {facilities[0]?.county || 'Selected Area'} ({filteredFacilities.length})
          </div>
        </div>
        <div style={styles.filterRow}>
          <div style={styles.searchWrapper}>
            <Search size={14} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={styles.searchInput}
            />
          </div>
          {facilityType === 'SNF' && (
            <select
              value={ratingFilter}
              onChange={(e) => { setRatingFilter(e.target.value); setCurrentPage(1); }}
              style={styles.filterSelect}
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Star</option>
              <option value="4">4 Star</option>
              <option value="3">3 Star</option>
              <option value="2">2 Star</option>
              <option value="1">1 Star</option>
            </select>
          )}
          <select
            value={sizeFilter}
            onChange={(e) => { setSizeFilter(e.target.value); setCurrentPage(1); }}
            style={styles.filterSelect}
          >
            <option value="all">All Sizes</option>
            <option value="small">Small (≤60 beds)</option>
            <option value="medium">Medium (61-120 beds)</option>
            <option value="large">Large (&gt;120 beds)</option>
          </select>
          {ownershipTypes.length > 1 && (
            <select
              value={ownershipFilter}
              onChange={(e) => { setOwnershipFilter(e.target.value); setCurrentPage(1); }}
              style={styles.filterSelect}
            >
              <option value="all">All Ownership Types</option>
              {ownershipTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    ...styles.th,
                    ...(col.sortable ? styles.thSortable : {}),
                  }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span style={styles.thContent}>
                    {col.label}
                    {col.sortable && renderSortIcon(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentFacilities.map((facility) => {
              const isSelected = selectedFacility?.id === facility.id;
              const isHovered = hoveredRow === facility.id;
              const totalDef = facility.deficiencies?.total || 0;

              return (
                <tr
                  key={facility.id}
                  style={{
                    ...styles.tr,
                    ...(isSelected ? styles.trSelected : {}),
                    ...(isHovered && !isSelected ? styles.trHover : {}),
                  }}
                  onClick={() => handleRowClick(facility)}
                  onMouseEnter={() => setHoveredRow(facility.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Facility Name */}
                  <td style={styles.td}>
                    {facility.federalProviderNumber ? (
                      <div
                        style={styles.facilityNameLink}
                        title={facility.facilityName}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/operator/${facility.federalProviderNumber}?from=market`);
                        }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {facility.facilityName}
                      </div>
                    ) : (
                      <div style={styles.facilityName} title={facility.facilityName}>
                        {facility.facilityName}
                      </div>
                    )}
                  </td>

                  {/* City */}
                  <td style={styles.td}>
                    <div style={styles.cityCell}>
                      <MapPin size={12} />
                      {facility.city || '-'}
                    </div>
                  </td>

                  {/* County */}
                  <td style={styles.td}>{facility.county || '-'}</td>

                  {/* Ownership Company */}
                  <td style={styles.td}>
                    <div
                      style={{
                        ...styles.ownershipCell,
                        ...(hoveredOwnership === facility.id ? styles.ownershipCellHover : {}),
                      }}
                      title={facility.ownership?.parentOrganization || facility.ownership?.licensee}
                      onClick={(e) => handleOwnershipClick(e, facility.ownership?.parentOrganization || facility.ownership?.licensee)}
                      onMouseEnter={() => setHoveredOwnership(facility.id)}
                      onMouseLeave={() => setHoveredOwnership(null)}
                    >
                      {facility.ownership?.parentOrganization || facility.ownership?.licensee || '-'}
                    </div>
                  </td>

                  {/* Rating (SNF only) */}
                  {facilityType === 'SNF' && (
                    <td style={styles.td}>
                      {renderRating(facility.ratings?.overall)}
                    </td>
                  )}

                  {/* Beds/Capacity */}
                  <td style={styles.td}>
                    {facilityType === 'SNF' ? (facility.beds?.total || '-') : (facility.capacity || '-')}
                  </td>

                  {/* Occupancy (SNF only) */}
                  {facilityType === 'SNF' && (
                    <td style={styles.td}>
                      {renderOccupancy(facility.occupancyRate)}
                    </td>
                  )}

                  {/* Type Badge */}
                  <td style={styles.td}>
                    <span style={{
                      ...styles.typeBadge,
                      ...(facilityType === 'SNF' ? styles.snfBadge : styles.alfBadge),
                    }}>
                      {facilityType}
                    </span>
                  </td>

                  {/* Deficiencies (SNF only) */}
                  {facilityType === 'SNF' && (
                    <td style={styles.td}>
                      <div style={styles.deficiencyCell}>
                        <span
                          style={{
                            ...styles.deficiencyCount,
                            ...getDeficiencyStyle(totalDef),
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (totalDef > 0 || facility.federalProviderNumber) {
                              fetchDeficiencies(facility);
                            }
                          }}
                          title="Click to view deficiency details"
                        >
                          {totalDef}
                        </span>
                        {facility.flags?.specialFocusFacility && (
                          <span style={styles.specialFocus}>
                            <AlertTriangle size={10} />
                            SFF
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={{
              ...styles.pageButton,
              ...(currentPage === 1 ? styles.pageButtonDisabled : {}),
            }}
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            style={{
              ...styles.pageButton,
              ...(currentPage === 1 ? styles.pageButtonDisabled : {}),
            }}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span style={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            style={{
              ...styles.pageButton,
              ...(currentPage === totalPages ? styles.pageButtonDisabled : {}),
            }}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          <button
            style={{
              ...styles.pageButton,
              ...(currentPage === totalPages ? styles.pageButtonDisabled : {}),
            }}
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}

      {/* Deficiency Modal */}
      {deficiencyModal && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>{deficiencyModal.facilityName}</div>
                <div style={styles.modalSubtitle}>
                  Provider ID: {deficiencyModal.federalProviderNumber}
                </div>
              </div>
              <button style={styles.closeButton} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              {loadingDeficiencies ? (
                <div style={styles.loadingState}>
                  <Clock size={32} style={{ marginBottom: '0.5rem' }} />
                  <div>Loading deficiencies...</div>
                </div>
              ) : deficiencies.length === 0 ? (
                <div style={styles.loadingState}>
                  <CheckCircle size={32} style={{ marginBottom: '0.5rem', color: '#22c55e' }} />
                  <div>No deficiencies found for this facility</div>
                </div>
              ) : (
                <>
                  <div style={styles.deficiencySummary}>
                    <div>
                      <strong>{deficiencies.length}</strong> deficiencies (last 3 years)
                    </div>
                    {availablePrefixes.length > 1 && (
                      <select
                        value={prefixFilter}
                        onChange={(e) => handlePrefixFilterChange(e.target.value)}
                        style={styles.filterSelect}
                      >
                        <option value="all">All Types</option>
                        {availablePrefixes.map(prefix => (
                          <option key={prefix} value={prefix}>{prefix}-Tag ({TAG_INFO[prefix]?.name || prefix})</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div style={styles.deficiencyList}>
                    {deficiencies.map((def, idx) => {
                      const tagInfo = TAG_INFO[def.deficiency_prefix];
                      const severityInfo = SCOPE_SEVERITY_INFO[def.scope_severity];
                      const fullTag = `${def.deficiency_prefix || ''}${def.deficiency_tag || ''}`;
                      const severityColors = getSeverityColor(def.scope_severity);
                      const isExpanded = expandedDeficiency === def.id;

                      return (
                        <div key={def.id || idx} style={styles.deficiencyItem}>
                          <div style={styles.deficiencyHeader}>
                            <div style={styles.surveyInfo}>
                              <span style={styles.surveyType}>
                                {def.survey_type || 'Health'} Survey
                              </span>
                              <span style={styles.surveyDate}>
                                {formatDate(def.survey_date)}
                              </span>
                            </div>
                            <div style={styles.statusBadges}>
                              {fullTag && tagInfo && (
                                <a
                                  href={tagInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={styles.tagBadge}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`${tagInfo.name}: ${tagInfo.description}`}
                                >
                                  {fullTag}
                                  <ExternalLink size={10} />
                                </a>
                              )}
                              {!tagInfo && fullTag && (
                                <span style={styles.tagBadge}>{fullTag}</span>
                              )}
                              {def.is_corrected ? (
                                <span style={styles.statusCorrected}>
                                  <CheckCircle size={12} />
                                  Corrected {formatDate(def.correction_date)}
                                </span>
                              ) : (
                                <span style={styles.statusUncorrected}>
                                  <AlertTriangle size={12} />
                                  Not Corrected
                                </span>
                              )}
                            </div>
                          </div>

                          {(tagInfo || severityInfo) && (
                            <div style={styles.deficiencyMetadata}>
                              {tagInfo && (
                                <div style={styles.tagInfoRow}>
                                  <Info size={12} />
                                  <span style={{ fontWeight: 500 }}>{tagInfo.name}:</span>
                                  <span>{tagInfo.description}</span>
                                </div>
                              )}
                              {severityInfo && (
                                <div style={{ marginTop: '0.25rem' }}>
                                  <span style={{
                                    ...styles.severityBadge,
                                    backgroundColor: severityColors.bg,
                                    color: severityColors.color,
                                  }}>
                                    Severity: {def.scope_severity}
                                  </span>
                                  <span style={{ fontSize: '0.625rem', color: '#6b7280' }}>
                                    {severityInfo}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            onClick={() => setExpandedDeficiency(isExpanded ? null : def.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <p style={{
                              ...styles.deficiencyText,
                              ...(isExpanded ? {} : styles.deficiencyTextCollapsed),
                            }}>
                              {def.deficiency_text}
                            </p>
                            {!isExpanded && def.deficiency_text?.length > 150 && (
                              <span style={styles.expandHint}>Click to read more...</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityList;
