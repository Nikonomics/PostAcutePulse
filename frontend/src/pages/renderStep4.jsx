import React from 'react';
import { CheckCircle } from 'lucide-react';
    
const renderStep4 = (formData, handleInputChange) => (
  console.log(formData),
    <div className='row'>
      <div className="col-lg-8">
      <div className="form-container">
        <div className="form-section">
          <h2>Deal Summary Review</h2>
          
          {/* Basic Information */}
          <div className='py-1'>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0px' }}>
              <CheckCircle size={20} style={{ color: '#10b981', marginRight: '8px' }} />
              <h3 className='py-4'>Basic Information</h3>
            </div>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Deal:</strong> {formData.deal_name} | <strong>Type:</strong> {formData.deal_type} | <strong>Priority:</strong> {formData.priority_level}</div>
              <div><strong>Facility:</strong> {formData.facility_name} ({formData.facility_type}) | <strong>Beds:</strong> {formData.no_of_beds} | <strong>Location:</strong> {formData.city}, {formData.state}</div>
              <div><strong>Contact:</strong> {formData.primary_contact_name} | <strong>Target Close:</strong> {formData.target_close_date}</div>
            </div>
          </div>

          {/* Financial Information */}
          <div className='py-1'>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0px' }}>
              <CheckCircle size={20} style={{ color: '#10b981', marginRight: '8px' }} />
              <h3 className='py-4'>Financial Information</h3>
            </div>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Purchase Price:</strong> ${formData.purchase_price} | <strong>Price/Bed:</strong> ${formData.price_per_bed} | <strong>Down Payment:</strong> {formData.down_payment}%</div>
              <div><strong>Annual Revenue:</strong> ${formData.revenue} | <strong>EBITDA:</strong> ${formData.ebitda} | <strong>EBITDA Multiple:</strong> {formData.ebitda_multiple}x</div>
              <div><strong>current_occupancy:</strong> {formData.current_occupancy}% | <strong>ADR:</strong> ${formData.average_daily_rate} | <strong>Target IRR:</strong> {formData.irr}%</div>
            </div>
          </div>

          {/* Team & Access */}
          <div className='py-1'>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0px' }}>
              <CheckCircle size={20} style={{ color: '#10b981', marginRight: '8px' }} />
              <h3 className='py-4'>Team & Access</h3>
            </div>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.6' }}>
              <div><strong>Deal Lead:</strong> {formData.deal_lead_id} | <strong>Core Team:</strong> {formData.deal_team_members.map(member => member.name).join(', ')}</div>
              <div><strong>External Advisors:</strong> {formData.deal_external_advisors.map(advisor => advisor.name).join(', ')}</div>
              <div><strong>Security:</strong> 2FA Required, Audit Logging Enabled, Document Access Controls Configured</div>
            </div>
          </div>

   

          {/* Deal Creation Options */}
          <div style={{ marginBottom: '24px' }}>
            <h3 className='py-4'>Deal Creation Options</h3>
            <div className='notify-checkbox'>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={formData.notificationSettings.email_notification_major_updates} style={{ width: '16px', height: '16px' }}  readOnly/>
                <span style={{ fontSize: '14px' }}>Email notifications for major updates</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={formData.notificationSettings.document_upload_notification} style={{ width: '16px', height: '16px' }}  readOnly/>
                <span style={{ fontSize: '14px' }}>Document upload notifications</span>
              </label>
          
              
            </div>
          </div>

          {/* Pre-Creation Validation */}
          <div className="step-validation">
            <CheckCircle className="validation-icon" style={{ color: '#eab308' }} />
            <div className="validation-content">
              <div className="validation-title" style={{ color: '#a16207' }}>Pre-Creation Validation</div>
              <div className="validation-message" style={{ color: '#a16207' }}>
                <div>✓ All required fields completed</div>
                <div>✓ Team members available</div>
                <div>✓ Template configuration valid</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      <div className="col-lg-4">
      {/* Final Actions Panel */}
      <div className="form-container">
        <div className="form-section">
          <h3 className='py-4'>Final Actions</h3>
          
          {/* Create Deal */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Create Deal</h4>
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px 24px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#10b981', borderColor: '#10b981' }}>
              <CheckCircle size={20} />
              Create Deal
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }}>Save as Draft</button>
              <button className="btn btn-outline" style={{ flex: 1, fontSize: '12px' }}>Save Template</button>
            </div>
          </div>

          {/* Export Deal Package */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Export Deal Package</h4>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Export Format:</label>
              <div className='d-flex flex-wrap gap-3'>
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Excel</button>
                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>PDF</button>
                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>Word</button>
                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>JSON</button>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Include in Export:</label>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <input type="checkbox" defaultChecked style={{ width: '12px', height: '12px' }} />
                  Deal Information
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <input type="checkbox" defaultChecked style={{ width: '12px', height: '12px' }} />
                  Financial Data
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <input type="checkbox" defaultChecked style={{ width: '12px', height: '12px' }} />
                  Team Assignments
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <input type="checkbox" style={{ width: '12px', height: '12px' }} />
                  Checklist Items
                </label>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', fontSize: '12px', backgroundColor: '#0d9488', borderColor: '#0d9488' }}>
              Generate Export Package
            </button>
          </div>

          {/* AI Analysis Preview */}
          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', backgroundColor: '#7c3aed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>AI</span>
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#7c3aed' }}>AI Analysis Preview</h4>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '12px' }}>
              <div><strong>Deal Score:</strong> 8.2/10 (Strong Opportunity)</div>
              <div style={{ color: '#7c3aed' }}>✓ Financial metrics within target ranges</div>
              <div style={{ color: '#7c3aed' }}>✓ Strong current_occupancy and revenue performance</div>
              <div style={{ color: '#f59e0b' }}>⚠ Price per bed above market median</div>
              <div style={{ color: '#7c3aed' }}>✓ Regulatory compliance history clean</div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', fontSize: '12px', backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}>
              View Full Analysis
            </button>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Quick Actions:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <button className="btn btn-outline" style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', padding: '8px 12px' }}>
                📧 Email summary to team
              </button>
              <button className="btn btn-outline" style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', padding: '8px 12px' }}>
                📅 Schedule kickoff
              </button>
              <button className="btn btn-outline" style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', padding: '8px 12px' }}>
                🔍 Start due diligence
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
  export default renderStep4;