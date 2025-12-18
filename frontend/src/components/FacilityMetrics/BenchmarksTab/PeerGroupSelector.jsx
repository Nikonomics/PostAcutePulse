import React from 'react';
import { Filter } from 'lucide-react';

const US_STATES = [
  { code: '', name: 'All States' },
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'DC' },
];

const PeerGroupSelector = ({ filters, onChange, peerGroup }) => {
  const handleScopeChange = (scope) => {
    onChange({ ...filters, scope, state: scope === 'national' ? '' : filters.state });
  };

  const handleStateChange = (state) => {
    onChange({ ...filters, state, scope: state ? 'state' : 'national' });
  };

  const handleSizeChange = (size) => {
    onChange({ ...filters, size });
  };

  return (
    <div className="peer-group-selector">
      <div className="peer-group-header">
        <Filter size={16} />
        <span>Compare Against</span>
      </div>

      <div className="peer-group-filters">
        <div className="filter-group">
          <label>Scope</label>
          <div className="scope-toggle">
            <button
              className={`scope-btn ${filters.scope === 'national' ? 'active' : ''}`}
              onClick={() => handleScopeChange('national')}
            >
              National
            </button>
            <button
              className={`scope-btn ${filters.scope === 'state' ? 'active' : ''}`}
              onClick={() => handleScopeChange('state')}
            >
              State
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>State</label>
          <select
            value={filters.state || ''}
            onChange={(e) => handleStateChange(e.target.value)}
            className="filter-select"
          >
            {US_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Facility Size</label>
          <select
            value={filters.size || ''}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Sizes</option>
            <option value="small">Small (&lt;60 beds)</option>
            <option value="medium">Medium (60-120 beds)</option>
            <option value="large">Large (&gt;120 beds)</option>
          </select>
        </div>

        {peerGroup && (
          <div className="peer-group-summary">
            <span className="peer-count">{peerGroup.facility_count?.toLocaleString()}</span>
            <span className="peer-label">facilities in peer group</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeerGroupSelector;
