import React from 'react';
import { ArrowLeft, ArrowRight, DollarSign } from 'lucide-react';
import { useWizard, WIZARD_STEPS } from '../WizardContext';

// Format number with commas
const formatCurrency = (value) => {
  if (!value) return '';
  const numStr = value.toString().replace(/[^0-9]/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Parse formatted currency back to number
const parseCurrency = (value) => {
  if (!value) return '';
  return value.toString().replace(/,/g, '');
};

const DealInfo = () => {
  const {
    dealData,
    updateDealData,
    errors,
    validateStep,
    goToNextStep,
    goToPreviousStep,
    isExtracting,
    extractionProgress,
  } = useWizard();

  const handlePriceChange = (e) => {
    const rawValue = parseCurrency(e.target.value);
    updateDealData({ purchase_price: rawValue });
  };

  const handleNext = () => {
    if (validateStep(WIZARD_STEPS.DEAL_INFO)) {
      goToNextStep();
    }
  };

  // Calculate derived values if we have facility data
  const totalBeds = dealData.facilities.reduce((sum, f) => {
    const beds = f.matched_facility?.total_beds || f.matched_facility?.capacity || 0;
    return sum + beds;
  }, 0);

  const purchasePrice = parseFloat(parseCurrency(dealData.purchase_price)) || 0;
  const pricePerBed = totalBeds > 0 && purchasePrice > 0
    ? Math.round(purchasePrice / totalBeds)
    : null;

  return (
    <div className="step-container">
      {/* Extraction Progress (AI path) */}
      {isExtracting && (
        <div className="extraction-progress">
          <div className="extraction-progress-spinner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <span className="extraction-progress-text">
            Analyzing documents... {Math.round(extractionProgress)}%
          </span>
          <div className="extraction-progress-bar">
            <div
              className="extraction-progress-fill"
              style={{ width: `${extractionProgress}%` }}
            />
          </div>
        </div>
      )}

      <h2 className="step-title">Deal Information</h2>

      {/* Facilities Summary */}
      {dealData.facilities.length > 0 && (
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
            Facilities in this deal
          </div>
          {dealData.facilities.map((facility, index) => (
            <div
              key={facility.id || index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < dealData.facilities.length - 1 ? '1px solid #e2e8f0' : 'none',
              }}
            >
              <div>
                <div style={{ fontWeight: '500', color: '#1e293b' }}>
                  {facility.facility_name || `Facility ${index + 1}`}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {facility.city && facility.state ? `${facility.city}, ${facility.state}` : 'Location TBD'}
                  {' | '}
                  {facility.facility_type || 'Type TBD'}
                </div>
              </div>
              {(facility.matched_facility?.total_beds || facility.matched_facility?.capacity) && (
                <div style={{
                  fontSize: '13px',
                  color: '#7c3aed',
                  backgroundColor: '#ede9fe',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}>
                  {facility.matched_facility.total_beds || facility.matched_facility.capacity} beds
                </div>
              )}
            </div>
          ))}
          {totalBeds > 0 && (
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              <span>Total Beds</span>
              <span style={{ color: '#7c3aed' }}>{totalBeds}</span>
            </div>
          )}
        </div>
      )}

      {/* Purchase Price */}
      <div className="form-group">
        <label className="form-label required">Purchase Price</label>
        <div className="currency-input-wrapper">
          <span className="currency-symbol">$</span>
          <input
            type="text"
            className={`form-input ${errors.purchase_price ? 'error' : ''}`}
            placeholder="Enter purchase price"
            value={formatCurrency(dealData.purchase_price)}
            onChange={handlePriceChange}
          />
        </div>
        {errors.purchase_price && <span className="form-error">{errors.purchase_price}</span>}
      </div>

      {/* Price Per Bed (calculated, read-only) */}
      {pricePerBed && (
        <div className="form-group">
          <label className="form-label">Price Per Bed (calculated)</label>
          <div className="currency-input-wrapper">
            <span className="currency-symbol">$</span>
            <input
              type="text"
              className="form-input"
              value={formatCurrency(pricePerBed.toString())}
              disabled
              style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}
            />
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Based on ${formatCurrency(purchasePrice.toString())} / {totalBeds} beds
          </div>
        </div>
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

export default DealInfo;
