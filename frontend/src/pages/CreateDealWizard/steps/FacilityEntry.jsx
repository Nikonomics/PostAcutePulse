import React, { useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, Building2, CheckCircle, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useWizard, WIZARD_STEPS } from '../WizardContext';
import { searchFacilitiesForMatch } from '../../../api/DealService';

const FACILITY_TYPES = [
  { value: 'SNF', label: 'Skilled Nursing (SNF)' },
  { value: 'ALF', label: 'Assisted Living (ALF)' },
  { value: 'ILF', label: 'Independent Living (ILF)' },
  { value: 'Other', label: 'Other' },
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

const FacilityEntry = () => {
  const {
    dealData,
    addFacility,
    updateFacility,
    removeFacility,
    errors,
    validateStep,
    goToNextStep,
    goToPreviousStep,
  } = useWizard();

  const [searchingFacility, setSearchingFacility] = useState(null);
  const [matchResults, setMatchResults] = useState({});

  // Add first facility if none exist
  React.useEffect(() => {
    if (dealData.facilities.length === 0) {
      addFacility();
    }
  }, [dealData.facilities.length, addFacility]);

  const handleFacilityChange = (facilityId, field, value) => {
    updateFacility(facilityId, { [field]: value });

    // Clear match when location fields change
    if (['facility_name', 'address', 'city', 'state', 'zip_code'].includes(field)) {
      updateFacility(facilityId, {
        matched_facility: null,
        match_source: null,
        match_confirmed: false
      });
      setMatchResults(prev => ({ ...prev, [facilityId]: null }));
    }
  };

  const handleSearchDatabase = useCallback(async (facility) => {
    if (!facility.facility_name && !facility.city && !facility.state) {
      toast.error('Please enter at least a name, city, or state to search');
      return;
    }

    setSearchingFacility(facility.id);

    try {
      const response = await searchFacilitiesForMatch({
        name: facility.facility_name,
        address: facility.address,
        city: facility.city,
        state: facility.state,
        zip: facility.zip_code,
        facility_type: facility.facility_type,
      });

      if (response.success && response.body?.matches?.length > 0) {
        setMatchResults(prev => ({
          ...prev,
          [facility.id]: response.body.matches,
        }));
        toast.success(`Found ${response.body.matches.length} potential match(es)`);
      } else {
        setMatchResults(prev => ({
          ...prev,
          [facility.id]: [],
        }));
        toast.info('No matches found in database');
      }
    } catch (error) {
      console.error('Error searching facilities:', error);
      toast.error('Failed to search database');
    } finally {
      setSearchingFacility(null);
    }
  }, []);

  const handleSelectMatch = (facilityId, match) => {
    updateFacility(facilityId, {
      matched_facility: match,
      match_source: match.federal_provider_number ? 'snf_facilities' : 'alf_facilities',
      match_confirmed: true,
      // Optionally fill in any missing fields from the match
      facility_name: match.facility_name || dealData.facilities.find(f => f.id === facilityId)?.facility_name,
      city: match.city || dealData.facilities.find(f => f.id === facilityId)?.city,
      state: match.state || dealData.facilities.find(f => f.id === facilityId)?.state,
    });
    setMatchResults(prev => ({ ...prev, [facilityId]: null }));
    toast.success('Facility matched successfully');
  };

  const handleRejectMatch = (facilityId) => {
    setMatchResults(prev => ({ ...prev, [facilityId]: null }));
  };

  const handleAddAnotherFacility = () => {
    addFacility();
    toast.info('Added new facility');
  };

  const handleRemoveFacility = (facilityId) => {
    if (dealData.facilities.length <= 1) {
      toast.error('At least one facility is required');
      return;
    }
    removeFacility(facilityId);
    setMatchResults(prev => {
      const newResults = { ...prev };
      delete newResults[facilityId];
      return newResults;
    });
  };

  const handleNext = () => {
    if (dealData.facilities.length === 0) {
      toast.error('Please add at least one facility');
      return;
    }

    // Check that each facility has at least a type
    const incompleteFacility = dealData.facilities.find(f => !f.facility_type);
    if (incompleteFacility) {
      toast.error('Please select a facility type for all facilities');
      return;
    }

    if (validateStep(WIZARD_STEPS.FACILITY_ENTRY)) {
      goToNextStep();
    }
  };

  return (
    <div className="step-container" style={{ maxWidth: '600px' }}>
      <h2 className="step-title">Facility Information</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Add the facilities included in this deal. We'll try to match them to our database.
      </p>

      {dealData.facilities.map((facility, index) => (
        <div key={facility.id} className="facility-card">
          <div className="facility-card-header">
            <h3 className="facility-card-title">
              <Building2 size={18} style={{ marginRight: '8px', color: '#7c3aed' }} />
              Facility {index + 1}
              {facility.match_confirmed && (
                <CheckCircle size={16} style={{ marginLeft: '8px', color: '#22c55e' }} />
              )}
            </h3>
            {dealData.facilities.length > 1 && (
              <button
                type="button"
                className="facility-card-remove"
                onClick={() => handleRemoveFacility(facility.id)}
              >
                <Trash2 size={14} style={{ marginRight: '4px' }} />
                Remove
              </button>
            )}
          </div>

          {/* Facility Type */}
          <div className="form-group">
            <label className="form-label required">Facility Type</label>
            <div className="radio-group">
              {FACILITY_TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`radio-option ${facility.facility_type === type.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`facility_type_${facility.id}`}
                    value={type.value}
                    checked={facility.facility_type === type.value}
                    onChange={(e) => handleFacilityChange(facility.id, 'facility_type', e.target.value)}
                  />
                  <span className="radio-option-label">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Facility Name */}
          <div className="form-group">
            <label className="form-label">Facility Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter facility name"
              value={facility.facility_name}
              onChange={(e) => handleFacilityChange(facility.id, 'facility_name', e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter street address"
              value={facility.address}
              onChange={(e) => handleFacilityChange(facility.id, 'address', e.target.value)}
            />
          </div>

          {/* City, State, Zip */}
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                className="form-input"
                placeholder="City"
                value={facility.city}
                onChange={(e) => handleFacilityChange(facility.id, 'city', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <select
                className="form-select"
                value={facility.state}
                onChange={(e) => handleFacilityChange(facility.id, 'state', e.target.value)}
              >
                <option value="">--</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Zip</label>
              <input
                type="text"
                className="form-input"
                placeholder="Zip"
                maxLength={10}
                value={facility.zip_code}
                onChange={(e) => handleFacilityChange(facility.id, 'zip_code', e.target.value)}
              />
            </div>
          </div>

          {/* Search Database Button */}
          {!facility.match_confirmed && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              onClick={() => handleSearchDatabase(facility)}
              disabled={searchingFacility === facility.id}
            >
              {searchingFacility === facility.id ? (
                <>
                  <span className="extraction-progress-spinner" style={{ marginRight: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </span>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Search Database
                </>
              )}
            </button>
          )}

          {/* Match Results */}
          {matchResults[facility.id] && matchResults[facility.id].length > 0 && (
            <div className="facility-match" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
              <div className="facility-match-title" style={{ color: '#1d4ed8' }}>
                <Search size={14} />
                {matchResults[facility.id].length} potential match(es) found
              </div>
              {matchResults[facility.id].slice(0, 3).map((match, matchIndex) => (
                <div
                  key={matchIndex}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    marginTop: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div className="facility-match-name">{match.facility_name}</div>
                  <div className="facility-match-details">
                    {match.city}, {match.state} | {match.total_beds || match.capacity || '?'} beds
                    {match.federal_provider_number && ` | CMS: ${match.overall_rating || 'N/A'}-star`}
                  </div>
                  <div className="facility-match-actions">
                    <button
                      type="button"
                      className="facility-match-btn confirm"
                      onClick={() => handleSelectMatch(facility.id, match)}
                    >
                      Select This Facility
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="facility-match-btn reject"
                style={{ marginTop: '12px' }}
                onClick={() => handleRejectMatch(facility.id)}
              >
                <X size={14} style={{ marginRight: '4px' }} />
                None of these match
              </button>
            </div>
          )}

          {/* No Matches Found */}
          {matchResults[facility.id] && matchResults[facility.id].length === 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#92400e',
            }}>
              No matches found in database. The facility will be created as a new entry.
              <button
                type="button"
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#92400e',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onClick={() => handleRejectMatch(facility.id)}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Confirmed Match Display */}
          {facility.match_confirmed && facility.matched_facility && (
            <div className="facility-match">
              <div className="facility-match-title">
                <CheckCircle size={14} />
                Matched to database
              </div>
              <div className="facility-match-name">{facility.matched_facility.facility_name}</div>
              <div className="facility-match-details">
                {facility.matched_facility.city}, {facility.matched_facility.state} |
                {facility.matched_facility.total_beds || facility.matched_facility.capacity || '?'} beds
              </div>
              <button
                type="button"
                className="facility-match-btn reject"
                style={{ marginTop: '8px' }}
                onClick={() => {
                  updateFacility(facility.id, {
                    matched_facility: null,
                    match_source: null,
                    match_confirmed: false,
                  });
                }}
              >
                Remove Match
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add Another Facility */}
      <button
        type="button"
        className="add-facility-btn"
        onClick={handleAddAnotherFacility}
      >
        <Plus size={18} />
        Add Another Facility
      </button>

      {errors.facilities && (
        <span className="form-error" style={{ display: 'block', marginTop: '8px' }}>
          {errors.facilities}
        </span>
      )}

      {/* Navigation */}
      <div className="step-navigation">
        <button className="btn btn-secondary" onClick={goToPreviousStep}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="btn btn-primary" onClick={handleNext}>
          Next
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default FacilityEntry;
