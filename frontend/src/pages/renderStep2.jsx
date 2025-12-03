import React from 'react';
import { CheckCircle } from 'lucide-react';

const renderStep2 = (formData, handleInputChange,validationErrors = {}, touched = {}) => (
    <div className='row'>
       <div className="col-lg-8">
      <div className="form-container">
        <div className="form-section">
          <h2>Financial Information</h2>
          
          {/* Purchase Price & Structure */}
          <h3 className='py-4'>Purchase Price & Structure</h3>
          <div className="form-row">
            <div className="form-group mb-3">
              <label className="form-label required">Purchase Price (USD)</label>
              <input
                type="text"
                className={`form-input ${touched?.purchase_price && validationErrors.purchase_price ? 'error' : ''}`}
                value={formData.purchase_price}
                onChange={e => handleInputChange('purchase_price', e.target.value)}
                placeholder="Enter Purchase Price"
                min={0}
              />
              {touched?.purchase_price && validationErrors.purchase_price && (
                <span className="error-message">{validationErrors.purchase_price}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Price per Bed</label>
              <input
                type="text"
                className={`form-input ${touched?.price_per_bed && validationErrors.price_per_bed ? 'error' : ''}`}
                value={formData.price_per_bed}
                onChange={e => handleInputChange('price_per_bed', e.target.value)}
                placeholder="Enter Price per Bed"
                min={0}
              />
              {touched?.price_per_bed && validationErrors.price_per_bed && (
                <span className="error-message">{validationErrors.price_per_bed}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Down Payment %</label>
              <input
                type="text"
                className={`form-input ${touched?.down_payment && validationErrors.down_payment ? 'error' : ''}`}
                value={formData.down_payment}
                onChange={e => handleInputChange('down_payment', e.target.value)}
                placeholder="Enter Down Payment"
                min={0}
                max={100}
              />
              {touched?.down_payment && validationErrors.down_payment && (
                <span className="error-message">{validationErrors.down_payment}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Financing Amount</label>
              <input
                type="text"
                className={`form-input ${touched?.financing_amount && validationErrors.financing_amount ? 'error' : ''}`}
                value={formData.financing_amount}
                onChange={e => handleInputChange('financing_amount', e.target.value)}
                placeholder="Enter Financing Amount"
                // readOnly
                // style={{ backgroundColor: '#f9fafb' }}

              />
              {touched?.financing_amount && validationErrors.financing_amount && (
                <span className="error-message">{validationErrors.financing_amount}</span>
              )}
            </div>
          </div>

          {/* Revenue Information */}
          <h3 className='py-4'>Revenue Information</h3>
          <div className="form-row">
            <div className="form-group mb-3">
              <label className="form-label required">Annual Revenue (USD)</label>
              <input
                type="text"
                className={`form-input ${touched?.annual_revenue && validationErrors.annual_revenue ? 'error' : ''}`}
                value={formData.annual_revenue}
                onChange={e => handleInputChange('annual_revenue', e.target.value)}
                placeholder="Enter Annual Revenue"
                min={0}
              />
              {touched?.annual_revenue && validationErrors.annual_revenue && (
                <span className="error-message">{validationErrors.annual_revenue}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Revenue Multiple</label>
              <input
                type="text"
                className={`form-input ${touched?.revenue_multiple && validationErrors.revenue_multiple ? 'error' : ''}`}
                value={formData.revenue_multiple}
                onChange={e => handleInputChange('revenue_multiple', e.target.value)}
                placeholder="Enter Revenue Multiple"
                step="0.01"
              />
              {touched?.revenue_multiple && validationErrors.revenue_multiple && (
                <span className="error-message">{validationErrors.revenue_multiple}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label required">EBITDA (USD)</label>
              <input
                type="text"
                className={`form-input ${touched?.ebitda && validationErrors.ebitda ? 'error' : ''}`}
                value={formData.ebitda}
                onChange={e => handleInputChange('ebitda', e.target.value)}
                placeholder="Enter EBITDA"
                min={0}
              />
              {touched?.ebitda && validationErrors.ebitda && (
                <span className="error-message">{validationErrors.ebitda}</span>
              )}
                </div>
            <div className="form-group mb-3">
              <label className="form-label">EBITDA Multiple</label>
              <input
                type="text"
                className={`form-input ${touched?.ebitda_multiple && validationErrors.ebitda_multiple ? 'error' : ''}`}
                value={formData.ebitda_multiple}
                onChange={e => handleInputChange('ebitda_multiple', e.target.value)}
                placeholder="Enter EBITDA Multiple"
                step="0.01"
              />
              {touched?.ebitda_multiple && validationErrors.ebitda_multiple && (
                <span className="error-message">{validationErrors.ebitda_multiple}</span>
              )}
            </div>
          </div>

          {/* Operating Metrics */}
          <h3 className='py-4'>Operating Metrics</h3>
          <div className="form-row">
            <div className="form-group mb-3">
              <label className="form-label">Current Occupancy %</label>
              <input
                type="text"
                className={`form-input ${touched?.current_occupancy && validationErrors.current_occupancy ? 'error' : ''}`}
                value={formData.current_occupancy}
                onChange={e => handleInputChange('current_occupancy', e.target.value)}
                placeholder="Enter Current Occupancy"
                min={0}
                max={100}
                step="0.1"
              />
              {touched?.current_occupancy && validationErrors.current_occupancy && (
                <span className="error-message">{validationErrors.current_occupancy}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Average Daily Rate</label>
              <input
                type="text"
                className={`form-input ${touched?.average_daily_rate && validationErrors.average_daily_rate ? 'error' : ''}`}
                value={formData.average_daily_rate}
                onChange={e => handleInputChange('average_daily_rate', e.target.value)}
                placeholder="Enter Average Daily Rate"
                min={0}
              />
              {touched?.average_daily_rate && validationErrors.average_daily_rate && (
                <span className="error-message">{validationErrors.average_daily_rate}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Medicare %</label>
              <input
                type="text"
                className={`form-input ${touched?.medicare_percentage && validationErrors.medicare_percentage ? 'error' : ''}`}
                value={formData.medicare_percentage}
                onChange={e => handleInputChange('medicare_percentage', e.target.value)}
                  placeholder="Enter Medicare %"
                min={0}
                max={100}
                step="0.1"
              />
              {touched?.medicare_percentage && validationErrors.medicare_percentage && (
                <span className="error-message">{validationErrors.medicare_percentage}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Private Pay %</label>
              <input
                type="text"
                className={`form-input ${touched?.private_pay_percentage && validationErrors.private_pay_percentage ? 'error' : ''}`}
                value={formData.private_pay_percentage}
                onChange={e => handleInputChange('private_pay_percentage', e.target.value)}
                placeholder="Enter Private Pay"
                min={0}
                max={100}
                step="0.1"
              />
              {touched?.private_pay_percentage && validationErrors.private_pay_percentage && (
                <span className="error-message">{validationErrors.private_pay_percentage}</span>
              )}
            </div>
            
          </div>

          {/* Investment Return Targets */}
          <h3 className='py-4'>Investment Return Targets</h3>
          <div className="form-row">
            <div className="form-group mb-3">
              <label className="form-label">Target IRR %</label>
              <input
                type="text"
                className={`form-input ${touched?.target_irr_percentage && validationErrors.target_irr_percentage ? 'error' : ''}`}
                value={formData.target_irr_percentage}
                onChange={e => handleInputChange('target_irr_percentage', e.target.value)}
                placeholder="Enter Target IRR"
                min={0}
                step="0.1"
              />
              {touched?.target_irr_percentage && validationErrors.target_irr_percentage && (
                <span className="error-message">{validationErrors.target_irr_percentage}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Target Hold Period</label>
              <input
                type="text"
                className={`form-input ${touched?.target_hold_period && validationErrors.target_hold_period ? 'error' : ''}`}
                value={formData.target_hold_period}
                onChange={e => handleInputChange('target_hold_period', e.target.value)}
                placeholder="Enter Target Hold Period"
                min={0}
              />
              {touched?.target_hold_period && validationErrors.target_hold_period && (
                <span className="error-message">{validationErrors.target_hold_period}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Projected Cap Rate %</label>
              <input
                type="text"
                className={`form-input ${touched?.projected_cap_rate_percentage && validationErrors.projected_cap_rate_percentage ? 'error' : ''}`}
                value={formData.projected_cap_rate_percentage}
                onChange={e => handleInputChange('projected_cap_rate_percentage', e.target.value)}
                placeholder="Enter Projected Cap Rate"
                min={0}
                step="0.01"
              />
              {touched?.projected_cap_rate_percentage && validationErrors.projected_cap_rate_percentage && (
                <span className="error-message">{validationErrors.projected_cap_rate_percentage}</span>
              )}
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Exit Multiple</label>
              <input
                type="text"
                className={`form-input ${touched?.exit_multiple && validationErrors.exit_multiple ? 'error' : ''}`}
                value={formData.exit_multiple}
                onChange={e => handleInputChange('exit_multiple', e.target.value)}
                placeholder="Enter Exit Multiple"
                min={0}
                step="0.01"
              />
              {touched?.exit_multiple && validationErrors.exit_multiple && (
                <span className="error-message">{validationErrors.exit_multiple}</span>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="step-validation mt-3">
            <CheckCircle className="validation-icon" style={{ color: '#10b981' }} />
            <div className="validation-content">
              <div className="validation-title">AI Analysis</div>
              <div className="validation-message">
                Strong financial metrics. EBITDA multiple within market range. current_occupancy above average.
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Live Financial Analysis Panel */}
      <div className="col-lg-4">
      <div className="form-container" style={{ width: '384px', flexShrink: 0 }}>
        <div className="form-section">
          <h2 className='py-4'>Live Financial Analysis</h2>
          
          {/* Key Investment Metrics */}
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Key Investment Metrics</h4>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div className="metric-card" style={{ textAlign: 'center', padding: '16px' }}>
              <div className="metric-value" style={{ color: '#10b981', fontSize: '20px' }}>21.0%</div>
              <div className="metric-label">Cap Rate</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>vs 8.3% target</div>
            </div>
            <div className="metric-card" style={{ textAlign: 'center', padding: '16px' }}>
              <div className="metric-value" style={{ color: '#3b82f6', fontSize: '20px' }}>4.28x</div>
              <div className="metric-label">EBITDA Multiple</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Market: 3.5-5.0x</div>
            </div>
            <div className="metric-card" style={{ textAlign: 'center', padding: '16px' }}>
              <div className="metric-value" style={{ color: '#f59e0b', fontSize: '20px' }}>0.64x</div>
              <div className="metric-label">Price/Revenue</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Market: 0.5-0.8x</div>
            </div>
            <div className="metric-card" style={{ textAlign: 'center', padding: '16px' }}>
              <div className="metric-value" style={{ color: '#3b82f6', fontSize: '20px' }}>$189,655</div>
              <div className="metric-label">Price per Bed</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Market: $180-220k</div>
            </div>
          </div>

          {/* 5-Year Financial Projections */}
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>5-Year Financial Projections</h4>
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', height: '128px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '14px' }}>Revenue Growth: 3.2% annually</div>
              <div style={{ fontSize: '14px' }}>EBITDA Growth: 4.1% annually</div>
              <div style={{ fontSize: '14px' }}>NOI Growth: 3.8% annually</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '24px' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%', marginRight: '4px' }}></span>
              Revenue
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', marginRight: '4px' }}></span>
              EBITDA
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '4px' }}></span>
              Cash Flow
            </span>
          </div>

          {/* Market Comparison */}
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', marginBottom: '12px' }}>Market Comparison</h4>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', color: '#a16207', marginBottom: '4px' }}>Price per Bed Percentile:</div>
              <div style={{ width: '100%', backgroundColor: '#fed7aa', borderRadius: '4px', height: '8px' }}>
                <div style={{ backgroundColor: '#d97706', height: '8px', borderRadius: '4px', width: '70%' }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>70th percentile</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#a16207', marginBottom: '4px' }}>EBITDA Multiple vs Market:</div>
              <div style={{ width: '100%', backgroundColor: '#bbf7d0', borderRadius: '4px', height: '8px' }}>
                <div style={{ backgroundColor: '#059669', height: '8px', borderRadius: '4px', width: '85%' }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>Within range</div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#991b1b', marginBottom: '12px' }}>Risk Assessment</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', color: '#a16207' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '50%', marginRight: '8px' }}></span>
                Financial Risk: Medium (Price above median)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: '#1d4ed8' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%', marginRight: '8px' }}></span>
                Market Risk: Low (Strong fundamentals)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: '#047857' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', marginRight: '8px' }}></span>
                Regulatory Risk: Low (Clean compliance record)
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
  export default renderStep2;