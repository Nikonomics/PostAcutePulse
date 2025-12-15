import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  ChevronUp,
  ChevronDown,
  MapPin,
  AlertTriangle,
  ExternalLink,
  Building2,
  Users,
  TrendingDown,
} from 'lucide-react';
import DataTooltip from './DataTooltip';

const styles = {
  container: {
    overflowX: 'auto',
    maxHeight: '400px',
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
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  thSortable: {
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
    padding: '0.75rem 0.5rem',
    borderBottom: '1px solid #e5e7eb',
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
  distanceBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    backgroundColor: '#e5e7eb',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
    color: '#374151',
  },
  starRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
  },
  ratingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'white',
  },
  occupancyBar: {
    width: '60px',
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  occupancyFill: {
    height: '100%',
    borderRadius: '3px',
  },
  occupancyText: {
    fontSize: '0.625rem',
    color: '#6b7280',
    marginTop: '0.125rem',
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
  staffingCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  staffingValue: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#111827',
  },
  staffingLabel: {
    fontSize: '0.5rem',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  turnoverBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    fontSize: '0.625rem',
    fontWeight: 500,
  },
  noData: {
    padding: '2rem',
    textAlign: 'center',
    color: '#9ca3af',
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

// Get staffing color based on total nurse hours per resident day
// CMS recommends 4.1+ hours total nursing per resident day
const getStaffingColor = (hours) => {
  if (!hours) return '#9ca3af';
  if (hours >= 4.1) return '#22c55e';  // Excellent
  if (hours >= 3.5) return '#84cc16';  // Good
  if (hours >= 3.0) return '#eab308';  // Fair
  return '#ef4444';  // Low
};

// Get turnover color (lower is better)
// National average is ~52%, under 40% is good, under 25% is excellent
const getTurnoverColor = (rate) => {
  if (!rate) return '#9ca3af';
  if (rate <= 25) return '#22c55e';   // Excellent (low turnover)
  if (rate <= 40) return '#84cc16';   // Good
  if (rate <= 52) return '#eab308';   // Average
  return '#ef4444';  // High turnover
};

const CompetitorTable = ({
  competitors = [],
  facilityType,
  selectedCompetitor,
  onCompetitorSelect,
}) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState({ key: 'distanceMiles', direction: 'asc' });
  const [hoveredRow, setHoveredRow] = useState(null);

  const handleOwnershipClick = (e, ownershipName) => {
    e.stopPropagation(); // Prevent row selection
    if (ownershipName && ownershipName !== '-') {
      navigate(`/ownership/${encodeURIComponent(ownershipName)}`);
    }
  };

  // Sort competitors
  const sortedCompetitors = useMemo(() => {
    const sorted = [...competitors];
    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'distanceMiles':
          aVal = parseFloat(a.distanceMiles) || 999;
          bVal = parseFloat(b.distanceMiles) || 999;
          break;
        case 'facilityName':
          aVal = a.facilityName?.toLowerCase() || '';
          bVal = b.facilityName?.toLowerCase() || '';
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
        case 'staffing':
          aVal = a.staffing?.totalNurseHours || 0;
          bVal = b.staffing?.totalNurseHours || 0;
          break;
        case 'turnover':
          aVal = a.turnover?.totalNursing || 999; // Sort null turnover last
          bVal = b.turnover?.totalNursing || 999;
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
    return sorted;
  }, [competitors, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleRowClick = (competitor) => {
    onCompetitorSelect(selectedCompetitor?.id === competitor.id ? null : competitor);
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={12} />
    ) : (
      <ChevronDown size={12} />
    );
  };

  const renderRating = (rating) => {
    if (!rating) return <span style={{ color: '#9ca3af' }}>-</span>;
    return (
      <span style={{ ...styles.ratingBadge, backgroundColor: getRatingColor(rating) }}>
        {rating}
      </span>
    );
  };

  const renderOccupancy = (rate) => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate)) return <span style={{ color: '#9ca3af' }}>-</span>;

    return (
      <div>
        <div style={styles.occupancyBar}>
          <div
            style={{
              ...styles.occupancyFill,
              width: `${Math.min(numRate, 100)}%`,
              backgroundColor: getOccupancyColor(numRate),
            }}
          />
        </div>
        <div style={styles.occupancyText}>{numRate.toFixed(0)}%</div>
      </div>
    );
  };

  const renderStaffing = (staffing) => {
    if (!staffing?.totalNurseHours) return <span style={{ color: '#9ca3af' }}>-</span>;

    const total = staffing.totalNurseHours;
    const color = getStaffingColor(total);

    return (
      <div style={styles.staffingCell} title={`RN: ${staffing.rnHours?.toFixed(2) || '-'} | LPN: ${staffing.lpnHours?.toFixed(2) || '-'} | CNA: ${staffing.cnaHours?.toFixed(2) || '-'}`}>
        <span style={{ ...styles.staffingValue, color }}>
          {total.toFixed(2)}
        </span>
        <span style={styles.staffingLabel}>hrs/res/day</span>
      </div>
    );
  };

  const renderTurnover = (turnover) => {
    if (!turnover?.totalNursing) return <span style={{ color: '#9ca3af' }}>-</span>;

    const rate = turnover.totalNursing;
    const color = getTurnoverColor(rate);
    const bgColor = color === '#22c55e' ? '#dcfce7' :
                    color === '#84cc16' ? '#ecfccb' :
                    color === '#eab308' ? '#fef9c3' : '#fef2f2';

    return (
      <span
        style={{
          ...styles.turnoverBadge,
          backgroundColor: bgColor,
          color: color,
        }}
        title={`RN Turnover: ${turnover.rn ? turnover.rn.toFixed(0) + '%' : '-'}`}
      >
        <TrendingDown size={10} />
        {rate.toFixed(0)}%
      </span>
    );
  };

  if (competitors.length === 0) {
    return (
      <div style={styles.noData}>
        <Building2 size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
        <div>No competitors found in the selected area</div>
        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
          Try increasing the search radius
        </div>
      </div>
    );
  }

  // SNF columns with tooltip definitions
  const snfColumns = [
    { key: 'facilityName', label: 'Facility', sortable: true },
    { key: 'distanceMiles', label: 'Distance', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true, tooltip: 'overall_rating' },
    { key: 'beds', label: 'Beds', sortable: true },
    { key: 'occupancy', label: 'Occupancy', sortable: true, tooltip: 'occupancy_rate' },
    { key: 'staffing', label: 'Staffing', sortable: true, tooltip: 'total_nurse_staffing_hours' },
    { key: 'turnover', label: 'Turnover', sortable: true, tooltip: 'total_nursing_turnover' },
    { key: 'city', label: 'City', sortable: false },
    { key: 'owner', label: 'Owner/Operator', sortable: false },
    { key: 'special', label: 'Flags', sortable: false, tooltip: 'special_focus_facility' },
  ];

  // ALF columns
  const alfColumns = [
    { key: 'facilityName', label: 'Facility', sortable: true },
    { key: 'distanceMiles', label: 'Distance', sortable: true },
    { key: 'beds', label: 'Capacity', sortable: true },
    { key: 'city', label: 'City', sortable: false },
    { key: 'owner', label: 'Licensee', sortable: false },
  ];

  const columns = facilityType === 'SNF' ? snfColumns : alfColumns;

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={styles.th}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span style={styles.thSortable}>
                  {col.tooltip ? (
                    <DataTooltip fieldName={col.tooltip} size={10}>
                      {col.label}
                    </DataTooltip>
                  ) : (
                    col.label
                  )}
                  {col.sortable && renderSortIcon(col.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedCompetitors.map((competitor) => {
            const isSelected = selectedCompetitor?.id === competitor.id;
            const isHovered = hoveredRow === competitor.id;

            return (
              <tr
                key={competitor.id}
                style={{
                  ...styles.tr,
                  ...(isSelected ? styles.trSelected : {}),
                  ...(isHovered && !isSelected ? styles.trHover : {}),
                }}
                onClick={() => handleRowClick(competitor)}
                onMouseEnter={() => setHoveredRow(competitor.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Facility Name */}
                <td style={styles.td}>
                  <div style={styles.facilityName} title={competitor.facilityName}>
                    {competitor.facilityName}
                  </div>
                </td>

                {/* Distance */}
                <td style={styles.td}>
                  <span style={styles.distanceBadge}>
                    {competitor.distanceMiles} mi
                  </span>
                </td>

                {facilityType === 'SNF' && (
                  <>
                    {/* Rating */}
                    <td style={styles.td}>
                      {renderRating(competitor.ratings?.overall)}
                    </td>

                    {/* Beds */}
                    <td style={styles.td}>
                      {competitor.beds?.total || '-'}
                    </td>

                    {/* Occupancy */}
                    <td style={styles.td}>
                      {renderOccupancy(competitor.occupancyRate)}
                    </td>

                    {/* Staffing */}
                    <td style={styles.td}>
                      {renderStaffing(competitor.staffing)}
                    </td>

                    {/* Turnover */}
                    <td style={styles.td}>
                      {renderTurnover(competitor.turnover)}
                    </td>

                    {/* City */}
                    <td style={styles.td}>
                      {competitor.city || '-'}
                    </td>

                    {/* Owner */}
                    <td style={styles.td}>
                      <div
                        style={{
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: competitor.ownership?.parentOrganization ? '#2563eb' : undefined,
                          cursor: competitor.ownership?.parentOrganization ? 'pointer' : undefined,
                        }}
                        title={competitor.ownership?.parentOrganization}
                        onClick={(e) => handleOwnershipClick(e, competitor.ownership?.parentOrganization)}
                      >
                        {competitor.ownership?.parentOrganization || '-'}
                      </div>
                    </td>

                    {/* Flags */}
                    <td style={styles.td}>
                      {competitor.specialFocusFacility && (
                        <span style={styles.specialFocus}>
                          <AlertTriangle size={10} />
                          SFF
                        </span>
                      )}
                    </td>
                  </>
                )}

                {facilityType === 'ALF' && (
                  <>
                    {/* Capacity */}
                    <td style={styles.td}>
                      {competitor.capacity || '-'}
                    </td>

                    {/* City */}
                    <td style={styles.td}>
                      {competitor.city || '-'}
                    </td>

                    {/* Licensee */}
                    <td style={styles.td}>
                      <div
                        style={{
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: competitor.ownership?.licensee ? '#2563eb' : undefined,
                          cursor: competitor.ownership?.licensee ? 'pointer' : undefined,
                        }}
                        title={competitor.ownership?.licensee}
                        onClick={(e) => handleOwnershipClick(e, competitor.ownership?.licensee)}
                      >
                        {competitor.ownership?.licensee || '-'}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CompetitorTable;
