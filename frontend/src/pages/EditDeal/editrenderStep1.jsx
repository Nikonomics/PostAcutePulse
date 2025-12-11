import React from 'react';
import { CheckCircle } from 'lucide-react';

const renderStep1 = (formData, handleInputChange, validationErrors = {}, touched = {}, selectedPlace, setSelectedPlace) => {
  console.log(selectedPlace, "selectedPlace");
  // Function to extract address components from Google Places result
  const extractAddressComponents = async (place) => {
    if (!place || !place.value.place_id) {
      handleInputChange('street_address', place.label);
      return;
    }

    try {
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));

      service.getDetails(
        {
          placeId: place.value.place_id,
          fields: ['address_components', 'formatted_address', 'geometry'],
        },
        (placeResult, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            placeResult
          ) {
            const components = placeResult.address_components;
            let streetNumber = '';
            let route = '';
            let city = '';
            let state = '';
            let country = '';
            let zipCode = '';

            components.forEach((component) => {
              const types = component.types;

              if (types.includes('street_number')) {
                streetNumber = component.long_name;
              }
              if (types.includes('route')) {
                route = component.long_name;
              }
              if (types.includes('locality') || types.includes('administrative_area_level_3')) {
                city = component.long_name;
              }
              if (types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
              if (types.includes('country')) {
                country = component.long_name;
              }
              if (types.includes('postal_code')) {
                zipCode = component.long_name;
              }
            });

            const fullAddress = `${streetNumber} ${route}`.trim();
            handleInputChange('street_address', fullAddress || placeResult.formatted_address);
            handleInputChange('city', city);
            handleInputChange('state', state);
            handleInputChange('country', country);
            handleInputChange('zip_code', zipCode);

            setSelectedPlace({
              label: fullAddress || placeResult.formatted_address,
              value: {
                description: fullAddress || placeResult.formatted_address,
                place_id: place.value.place_id,
              },
            });

          } else {
            handleInputChange('street_address', place.label);
            setSelectedPlace(place);
            parseAddressFromLabel(place.label);
          }
        }
      );
    } catch (error) {
      handleInputChange('street_address', place.label);
      setSelectedPlace(place);
      parseAddressFromLabel(place.label);
    }
  };

  const parseAddressFromLabel = (label) => {
    const parts = label.split(', ');
    if (parts.length >= 3) {
      const country = parts[parts.length - 1];
      handleInputChange('country', country);

      const stateZipPart = parts[parts.length - 2];
      const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s*(\d{5})?/);

      if (stateZipMatch) {
        handleInputChange('state', stateZipMatch[1]);
        if (stateZipMatch[2]) {
          handleInputChange('zip_code', stateZipMatch[2]);
        }
      }

      if (parts.length >= 3) {
        handleInputChange('city', parts[parts.length - 3]);
      }
    }
  };

  const handlePlaceSelect = (place) => {
    if (place) {
      handleInputChange('street_address', place.label);
      setSelectedPlace(place);
      extractAddressComponents(place);
    } else {
      handleInputChange('street_address', '');
      handleInputChange('city', '');
      handleInputChange('state', '');
      handleInputChange('country', '');
      handleInputChange('zip_code', '');
      setSelectedPlace(null);
    }
  };

  // Set initial selectedPlace if formData has address
  if (formData.street_address && !selectedPlace) {
    setSelectedPlace({
      label: formData.street_address,
      value: {
        description: formData.street_address,
        place_id: ''
      }
    });
  }

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      border: `1px solid ${touched?.street_address && validationErrors.street_address
        ? '#ef4444'
        : state.isFocused
          ? '#2563eb'
          : '#d1d5db'
        }`,
      borderRadius: '0.375rem',
      padding: '0.25rem 0.5rem',
      fontSize: '14px',
      minHeight: '38px',
      boxShadow: state.isFocused
        ? '0 0 0 3px rgba(37, 99, 235, 0.1)'
        : 'none',
      '&:hover': {
        border: `1px solid ${touched?.street_address && validationErrors.street_address
          ? '#ef4444'
          : '#9ca3af'
          }`,
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#9ca3af',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
      borderRadius: '0.375rem',
      border: '1px solid #e5e7eb',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
      color: '#374151',
      padding: '12px',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: '#f3f4f6',
      },
    }),
  };

  return (
    <div className='row'>
      <div className="col-lg-8">
        <div className="form-container">
          <div className="form-section">
            <h2>Deal Information</h2>

            {/* Basic Deal Information */}
            <h3 className='py-4'>Basic Deal Information</h3>
            <div className="form-row">
              <div className="form-group mb-3">
                <label className="form-label required">Deal Name</label>
                <input
                  type="text"
                  className={`form-input ${touched?.deal_name && validationErrors.deal_name ? 'error' : ''}`}
                  value={formData.deal_name}
                  onChange={e => handleInputChange('deal_name', e.target.value)}
                  placeholder="Enter deal name"
                />
                {touched?.deal_name && validationErrors.deal_name && (
                  <span className="error-message">{validationErrors.deal_name}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Deal Type</label>
                <select
                  className="form-select"
                  value={formData.deal_type}
                  onChange={e => handleInputChange('deal_type', e.target.value)}
                >
                  <option value="Acquisition">Acquisition</option>
                  <option value="Development">Development</option>
                  <option value="Refinance">Refinance</option>
                </select>
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Priority Level</label>
                <select
                  className="form-select"
                  value={formData.priority_level}
                  onChange={e => handleInputChange('priority_level', e.target.value)}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Deal Source</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.deal_source}
                  onChange={e => handleInputChange('deal_source', e.target.value)}
                  placeholder="Broker Network"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label ">Status</label>
                <select
                  className={`form-select ${touched?.deal_status && validationErrors.deal_status ? 'error' : ''}`}
                  value={formData.deal_status}
                  onChange={e => handleInputChange('deal_status', e.target.value)}
                >
                  <option value="pipeline">Pipeline</option>
                  <option value="due_diligence">Due Diligence</option>
                  <option value="final_review">Final Review</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Facility Information */}
            <h3 className='py-4'>Facility Information</h3>
            <div className="form-row">
              <div className="form-group mb-3">
                <label className="form-label required">Facility Name</label>
                <input
                  type="text"
                  className={`form-input ${touched?.facility_name && validationErrors.facility_name ? 'error' : ''}`}
                  value={formData.facility_name}
                  onChange={e => handleInputChange('facility_name', e.target.value)}
                  placeholder="Valley Care Center"
                />
                {touched?.facility_name && validationErrors.facility_name && (
                  <span className="error-message">{validationErrors.facility_name}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label required">Facility Type</label>
                <select
                  className={`form-select ${touched?.facility_type && validationErrors.facility_type ? 'error' : ''}`}
                  value={formData.facility_type}
                  onChange={e => handleInputChange('facility_type', e.target.value)}
                >
                  <option value="Skilled Nursing">Skilled Nursing</option>
                  <option value="Assisted Living">Assisted Living</option>
                  <option value="Memory Care">Memory Care</option>
                  <option value="Independent Living">Independent Living</option>
                </select>
                {touched?.facility_type && validationErrors.facility_type && (
                  <span className="error-message">{validationErrors.facility_type}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label required">Number of Beds</label>
                <input
                  type="text"
                  className={`form-input ${touched?.bed_count && validationErrors.bed_count ? 'error' : ''}`}
                  value={formData.bed_count}
                  onChange={e => handleInputChange('bed_count', e.target.value)}
                  placeholder="145"
                  min={0}
                />
                {touched?.bed_count && validationErrors.bed_count && (
                  <span className="error-message">{validationErrors.bed_count}</span>
                )}
              </div>
            </div>
            <h3 className="py-4">Address Information</h3>
            <div className="form-row">
              <div className="form-group mb-3 streetaddress " style={{ gridColumn: 'span 2' }}>
                <label className="form-label required">Street Address</label>
                <input
                  type="text"
                  className={`form-input ${touched?.street_address && validationErrors.street_address ? 'error' : ''}`}
                  value={formData.street_address || ''}
                  onChange={(e) => handleInputChange('street_address', e.target.value)}
                  placeholder="Enter street address"
                />
                {touched?.street_address && validationErrors.street_address && (
                  <span className="error-message">{validationErrors.street_address}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group mb-3">
                <label className="form-label required">Country</label>
                <input
                  type="text"
                  className={`form-input ${touched?.country && validationErrors.country ? 'error' : ''
                    }`}
                  value={formData.country || ''}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  placeholder="United States"
                  readOnly // Make it readonly since it's auto-filled
                  style={{ backgroundColor: '#f9fafb' }}
                />
                {touched?.country && validationErrors.country && (
                  <span className="error-message">{validationErrors.country}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label required">State</label>
                <input
                  type="text"
                  className={`form-input ${touched?.state && validationErrors.state ? 'error' : ''
                    }`}
                  value={formData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="AZ"
                  style={{ backgroundColor: formData.state ? '#f9fafb' : 'white' }}
                />
                {touched?.state && validationErrors.state && (
                  <span className="error-message">{validationErrors.state}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label required">City</label>
                <input
                  type="text"
                  className={`form-input ${touched?.city && validationErrors.city ? 'error' : ''
                    }`}
                  value={formData.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Phoenix"
                  style={{ backgroundColor: formData.city ? '#f9fafb' : 'white' }}
                />
                {touched?.city && validationErrors.city && (
                  <span className="error-message">{validationErrors.city}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label required">Zip Code</label>
                <input
                  type="text"
                  className={`form-input ${touched?.zip_code && validationErrors.zip_code ? 'error' : ''
                    }`}
                  value={formData.zip_code || ''}
                  onChange={(e) => handleInputChange('zip_code', e.target.value)}
                  placeholder="85001"
                  maxLength="5"
                  style={{ backgroundColor: formData.zip_code ? '#f9fafb' : 'white' }}
                />
                {touched?.zip_code && validationErrors.zip_code && (
                  <span className="error-message">{validationErrors.zip_code}</span>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <h3 className='py-4'>Contact Information</h3>
            <div className="form-row">
              <div className="form-group mb-3">
                <label className="form-label">Primary Contact Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.primary_contact_name}
                  onChange={e => handleInputChange('primary_contact_name', e.target.value)}
                  placeholder="Enter Contact Name"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={e => handleInputChange('title', e.target.value)}
                  placeholder="Administrator"
                />
              </div>
              <div className="form-group mb-3">
                <label className="form-label required">Phone Number</label>
                <input
                  type="text"
                  className={`form-input ${touched?.phone_number && validationErrors.phone_number ? 'error' : ''}`}
                  value={formData.phone_number}
                  onChange={e => handleInputChange('phone_number', e.target.value)}
                  placeholder="(916) 555-0123"
                />
                {touched?.phone_number && validationErrors.phone_number && (
                  <span className="error-message">{validationErrors.phone_number}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className={`form-input ${touched?.email && validationErrors.email ? 'error' : ''}`}
                  value={formData.email}
                  onChange={e => handleInputChange('email', e.target.value)}
                  placeholder="r.martinez@valleycare.com"
                />
                {touched?.email && validationErrors.email && (
                  <span className="error-message">{validationErrors.email}</span>
                )}
              </div>
            </div>

            {/* Deal Timeline */}
            <h3 className='py-4'>Deal Timeline</h3>
            <div className="form-row">
              <div className="form-group mb-3">
                <label className="form-label required">Target Close Date</label>
                <input
                  type="date"
                  className={`form-input ${touched?.target_close_date && validationErrors.target_close_date ? 'error' : ''}`}
                  value={formData.target_close_date}
                  onChange={e => handleInputChange('target_close_date', e.target.value)}
                />
                {touched?.target_close_date && validationErrors.target_close_date && (
                  <span className="error-message">{validationErrors.target_close_date}</span>
                )}
              </div>
              <div className="form-group mb-3">
                <label className="form-label">DD Period (weeks)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.dd_period_weeks}
                  onChange={e => handleInputChange('dd_period_weeks', e.target.value)}
                  placeholder="Enter DD Period (weeks)"
                />
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        {/* Export Preview Panel */}
        <div className="form-container">
          <div className="form-section">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: 0 }}>Export Preview</h3>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Preview Export
              </button>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: '#64748b',
                marginBottom: '16px',
              }}
            >
              Live preview of export data
            </p>
            <div style={{ marginBottom: '20px' }}>
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '12px',
                }}
              >
                Export Format
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary format-btn active"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Excel
                </button>
                <button
                  className="btn btn-outline format-btn"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  PDF
                </button>
                <button
                  className="btn btn-outline format-btn"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  JSON
                </button>
              </div>
            </div>

            <div>
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '12px',
                }}
              >
                Data to be Exported:
              </h4>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <CheckCircle
                    size={16}
                    style={{ color: '#10b981', marginRight: '8px' }}
                  />
                  <span>Basic Information</span>
                </div>
                <div
                  style={{
                    marginLeft: '24px',
                    color: '#64748b',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    • Deal Name: {formData.deal_name || 'Not provided'}
                  </div>
                  <div>• Deal Type: {formData.deal_type}</div>
                  <div>• Priority: {formData.priority_level}</div>
                  <div>
                    • Source: {formData.deal_source || 'Not provided'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <CheckCircle
                    size={16}
                    style={{ color: '#10b981', marginRight: '8px' }}
                  />
                  <span>Facility Information</span>
                </div>
                <div
                  style={{
                    marginLeft: '24px',
                    color: '#64748b',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    • Name: {formData.facility_name || 'Not provided'}
                  </div>
                  <div>• Type: {formData.facility_type}</div>
                  <div>
                    • Beds: {formData.bed_count || 'Not provided'}
                  </div>
                  <div>
                    • Location:{' '}
                    {formData.city && formData.state
                      ? `${formData.city}, ${formData.state}`
                      : 'Not provided'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <CheckCircle
                    size={16}
                    style={{ color: '#10b981', marginRight: '8px' }}
                  />
                  <span>Address Information</span>
                </div>
                <div style={{ marginLeft: '24px', color: '#64748b' }}>
                  <div>
                    • Street: {formData.street_address || 'Not provided'}
                  </div>
                  <div>
                    • City: {formData.city || 'Not provided'}
                  </div>
                  <div>
                    • State: {formData.state || 'Not provided'}
                  </div>
                  <div>
                    • ZIP: {formData.zip_code || 'Not provided'}
                  </div>
                  <div>
                    • Country: {formData.country || 'Not provided'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default renderStep1;