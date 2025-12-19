import React from 'react';

const FACILITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All Facility Types' },
  { value: 'SNF', label: 'SNF Only' },
  { value: 'ALF', label: 'ALF Only' },
  { value: 'Both', label: 'SNF + ALF' }
];

const UPDATE_FREQUENCY_OPTIONS = [
  { value: 'all', label: 'All Frequencies' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Annually', label: 'Annually' },
  { value: 'Varies', label: 'Varies' },
  { value: 'Per Upload', label: 'Per Upload' }
];

const USAGE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'used', label: 'Used by SNFalyze' },
  { value: 'unused', label: 'Not Yet Used' }
];

const selectStyle = {
  padding: '0.375rem 0.75rem',
  border: '1px solid #dee2e6',
  borderRadius: '4px',
  backgroundColor: 'white',
  fontSize: '0.85rem',
  minWidth: '140px'
};

const labelStyle = {
  fontSize: '0.7rem',
  fontWeight: '600',
  color: '#6c757d',
  textTransform: 'uppercase',
  marginBottom: '0.25rem'
};

const FilterBar = ({ filters, onFilterChange }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap',
      marginTop: '1rem'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Facility Type</label>
        <select
          value={filters.facilityType}
          onChange={e => onFilterChange('facilityType', e.target.value)}
          style={selectStyle}
        >
          {FACILITY_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>Update Frequency</label>
        <select
          value={filters.updateFrequency}
          onChange={e => onFilterChange('updateFrequency', e.target.value)}
          style={selectStyle}
        >
          {UPDATE_FREQUENCY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>SNFalyze Usage</label>
        <select
          value={filters.usage}
          onChange={e => onFilterChange('usage', e.target.value)}
          style={selectStyle}
        >
          {USAGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default FilterBar;
