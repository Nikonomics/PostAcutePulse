import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Badge } from 'react-bootstrap';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  DollarSign,
  Users,
  TrendingUp,
  GripVertical,
  Target,
  UserCheck,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getDealFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
  // reorderFacilities, // TODO: implement drag-and-drop reordering
} from '../api/DealService';

const styles = `
  .facilities-section {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    margin-bottom: 1rem;
  }

  .facilities-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .facilities-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .facilities-count {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .add-facility-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-facility-btn:hover {
    background: #1d4ed8;
  }

  .facilities-list {
    padding: 0;
  }

  .facility-card {
    border-bottom: 1px solid #f3f4f6;
    transition: background 0.2s;
  }

  .facility-card:last-child {
    border-bottom: none;
  }

  .facility-card:hover {
    background: #f9fafb;
  }

  .facility-header {
    display: flex;
    align-items: center;
    padding: 1rem 1.25rem;
    cursor: pointer;
    gap: 0.75rem;
  }

  .facility-drag-handle {
    color: #9ca3af;
    cursor: grab;
  }

  .facility-drag-handle:active {
    cursor: grabbing;
  }

  .facility-main-info {
    flex: 1;
    min-width: 0;
  }

  .facility-name {
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
    font-size: 0.9375rem;
  }

  .facility-location {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: #6b7280;
  }

  .facility-metrics {
    display: flex;
    gap: 1.5rem;
    margin-right: 1rem;
  }

  .facility-metric {
    text-align: right;
  }

  .facility-metric-label {
    font-size: 0.6875rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .facility-metric-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  .facility-metric-value.positive {
    color: #059669;
  }

  .facility-actions {
    display: flex;
    gap: 0.5rem;
  }

  .facility-action-btn {
    padding: 0.375rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .facility-action-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .facility-action-btn.delete:hover {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  .facility-expand-btn {
    padding: 0.375rem;
    background: transparent;
    border: none;
    color: #6b7280;
    cursor: pointer;
  }

  .facility-details {
    padding: 0 1.25rem 1rem 3rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .facility-detail-group {
    background: #f9fafb;
    padding: 0.75rem;
    border-radius: 0.375rem;
  }

  .facility-detail-group-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .facility-detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
    padding: 0.25rem 0;
  }

  .facility-detail-label {
    color: #6b7280;
  }

  .facility-detail-value {
    font-weight: 500;
    color: #111827;
  }

  .empty-facilities {
    padding: 3rem 1.25rem;
    text-align: center;
    color: #6b7280;
  }

  .empty-facilities-icon {
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 0.75rem;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .empty-facilities h4 {
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .empty-facilities p {
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .portfolio-summary {
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    color: white;
    padding: 1rem 1.25rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .portfolio-metric {
    text-align: center;
  }

  .portfolio-metric-value {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .portfolio-metric-label {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  .section-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }

  .section-divider.competitor {
    background: #fef3c7;
    color: #92400e;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 500;
    margin-left: 0.5rem;
  }

  .role-badge.subject {
    background: #dbeafe;
    color: #1e40af;
  }

  .role-badge.competitor {
    background: #fef3c7;
    color: #92400e;
  }

  .facility-card.competitor {
    background: #fffbeb;
  }

  .facility-card.competitor:hover {
    background: #fef3c7;
  }

  .competitor-note {
    font-size: 0.75rem;
    color: #92400e;
    font-style: italic;
    padding: 0.5rem 1.25rem 0.5rem 3rem;
    background: #fefce8;
    border-top: 1px dashed #fcd34d;
  }
`;

const formatCurrency = (value) => {
  if (!value && value !== 0) return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
};

const formatNumber = (value) => {
  if (!value && value !== 0) return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return num.toLocaleString();
};

const formatPercent = (value) => {
  if (!value && value !== 0) return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return `${num}%`;
};

const FacilityFormModal = ({ show, onHide, facility, dealId, onSave }) => {
  const [formData, setFormData] = useState({
    facility_name: '',
    facility_type: 'Skilled Nursing Facility',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    county: '',
    bed_count: '',
    licensed_beds: '',
    certified_beds: '',
    purchase_price: '',
    annual_revenue: '',
    ebitda: '',
    ebitdar: '',
    noi: '',
    annual_rent: '',
    occupancy_rate: '',
    medicare_mix: '',
    medicaid_mix: '',
    private_pay_mix: '',
    managed_care_mix: '',
    labor_expense: '',
    other_expenses: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (facility) {
      setFormData({
        facility_name: facility.facility_name || '',
        facility_type: facility.facility_type || 'Skilled Nursing Facility',
        address: facility.address || '',
        city: facility.city || '',
        state: facility.state || '',
        zip_code: facility.zip_code || '',
        county: facility.county || '',
        bed_count: facility.bed_count || '',
        licensed_beds: facility.licensed_beds || '',
        certified_beds: facility.certified_beds || '',
        purchase_price: facility.purchase_price || '',
        annual_revenue: facility.annual_revenue || '',
        ebitda: facility.ebitda || '',
        ebitdar: facility.ebitdar || '',
        noi: facility.noi || '',
        annual_rent: facility.annual_rent || '',
        occupancy_rate: facility.occupancy_rate || '',
        medicare_mix: facility.medicare_mix || '',
        medicaid_mix: facility.medicaid_mix || '',
        private_pay_mix: facility.private_pay_mix || '',
        managed_care_mix: facility.managed_care_mix || '',
        labor_expense: facility.labor_expense || '',
        other_expenses: facility.other_expenses || '',
        notes: facility.notes || '',
      });
    } else {
      setFormData({
        facility_name: '',
        facility_type: 'Skilled Nursing Facility',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        county: '',
        bed_count: '',
        licensed_beds: '',
        certified_beds: '',
        purchase_price: '',
        annual_revenue: '',
        ebitda: '',
        ebitdar: '',
        noi: '',
        annual_rent: '',
        occupancy_rate: '',
        medicare_mix: '',
        medicaid_mix: '',
        private_pay_mix: '',
        managed_care_mix: '',
        labor_expense: '',
        other_expenses: '',
        notes: '',
      });
    }
  }, [facility, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (facility) {
        await updateFacility(facility.id, formData);
        toast.success('Facility updated successfully');
      } else {
        await createFacility(dealId, formData);
        toast.success('Facility created successfully');
      }
      onSave();
      onHide();
    } catch (error) {
      console.error('Error saving facility:', error);
      toast.error('Failed to save facility');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{facility ? 'Edit Facility' : 'Add New Facility'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Basic Info */}
          <h6 className="text-muted mb-3">Basic Information</h6>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Facility Name *</Form.Label>
                <Form.Control
                  type="text"
                  name="facility_name"
                  value={formData.facility_name}
                  onChange={handleChange}
                  required
                  placeholder="Enter facility name"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Facility Type</Form.Label>
                <Form.Select
                  name="facility_type"
                  value={formData.facility_type}
                  onChange={handleChange}
                >
                  <option>Skilled Nursing Facility</option>
                  <option>Assisted Living Facility</option>
                  <option>Independent Living</option>
                  <option>Memory Care</option>
                  <option>Continuing Care Retirement Community</option>
                  <option>Long-Term Acute Care Hospital</option>
                  <option>Inpatient Rehabilitation Facility</option>
                  <option>Other</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {/* Location */}
          <h6 className="text-muted mb-3 mt-4">Location</h6>
          <Row className="mb-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Address</Form.Label>
                <Form.Control
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>City</Form.Label>
                <Form.Control
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>State</Form.Label>
                <Form.Control
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>ZIP Code</Form.Label>
                <Form.Control
                  type="text"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          </Row>

          {/* Bed Information */}
          <h6 className="text-muted mb-3 mt-4">Bed Information</h6>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Total Beds</Form.Label>
                <Form.Control
                  type="number"
                  name="bed_count"
                  value={formData.bed_count}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Licensed Beds</Form.Label>
                <Form.Control
                  type="number"
                  name="licensed_beds"
                  value={formData.licensed_beds}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Certified Beds</Form.Label>
                <Form.Control
                  type="number"
                  name="certified_beds"
                  value={formData.certified_beds}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          </Row>

          {/* Financial Metrics */}
          <h6 className="text-muted mb-3 mt-4">Financial Metrics</h6>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Purchase Price ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="purchase_price"
                  value={formData.purchase_price}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>T12M Revenue ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="annual_revenue"
                  value={formData.annual_revenue}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>T12M EBITDA ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="ebitda"
                  value={formData.ebitda}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>T12M EBITDAR ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="ebitdar"
                  value={formData.ebitdar}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>T12M NOI ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="noi"
                  value={formData.noi}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Annual Rent ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="annual_rent"
                  value={formData.annual_rent}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
          </Row>

          {/* Operational Metrics */}
          <h6 className="text-muted mb-3 mt-4">Operational Metrics</h6>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Occupancy Rate (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  name="occupancy_rate"
                  value={formData.occupancy_rate}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Medicare Mix (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  name="medicare_mix"
                  value={formData.medicare_mix}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Medicaid Mix (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  name="medicaid_mix"
                  value={formData.medicaid_mix}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Private Pay Mix (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  name="private_pay_mix"
                  value={formData.private_pay_mix}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Managed Care Mix (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.1"
                  name="managed_care_mix"
                  value={formData.managed_care_mix}
                  onChange={handleChange}
                  placeholder="0"
                />
              </Form.Group>
            </Col>
          </Row>

          {/* Notes */}
          <h6 className="text-muted mb-3 mt-4">Notes</h6>
          <Row className="mb-3">
            <Col md={12}>
              <Form.Group>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Additional notes about this facility..."
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : facility ? 'Update Facility' : 'Add Facility'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

const FacilityCard = ({ facility, onEdit, onDelete, expanded, onToggleExpand, showRoleBadge = false }) => {
  const [deleting, setDeleting] = useState(false);
  const isCompetitor = facility.facility_role === 'competitor';

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this facility?')) return;

    setDeleting(true);
    try {
      await deleteFacility(facility.id);
      toast.success('Facility deleted successfully');
      onDelete();
    } catch (error) {
      console.error('Error deleting facility:', error);
      toast.error('Failed to delete facility');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`facility-card ${isCompetitor ? 'competitor' : ''}`}>
      <div className="facility-header" onClick={onToggleExpand}>
        <div className="facility-drag-handle">
          <GripVertical size={16} />
        </div>

        <div className="facility-main-info">
          <h4 className="facility-name">
            {facility.facility_name || 'Unnamed Facility'}
            {showRoleBadge && (
              <span className={`role-badge ${isCompetitor ? 'competitor' : 'subject'}`}>
                {isCompetitor ? (
                  <><UserCheck size={10} /> Competitor</>
                ) : (
                  <><Target size={10} /> Subject</>
                )}
              </span>
            )}
          </h4>
          <div className="facility-location">
            <MapPin size={12} />
            {[facility.city, facility.state].filter(Boolean).join(', ') || 'Location not specified'}
          </div>
        </div>

        <div className="facility-metrics">
          <div className="facility-metric">
            <div className="facility-metric-label">Beds</div>
            <div className="facility-metric-value">{formatNumber(facility.bed_count)}</div>
          </div>
          <div className="facility-metric">
            <div className="facility-metric-label">Price</div>
            <div className="facility-metric-value positive">{formatCurrency(facility.purchase_price)}</div>
          </div>
          <div className="facility-metric">
            <div className="facility-metric-label">Revenue</div>
            <div className="facility-metric-value">{formatCurrency(facility.annual_revenue)}</div>
          </div>
          <div className="facility-metric">
            <div className="facility-metric-label">EBITDA</div>
            <div className="facility-metric-value">{formatCurrency(facility.ebitda)}</div>
          </div>
        </div>

        <div className="facility-actions" onClick={(e) => e.stopPropagation()}>
          <button className="facility-action-btn" onClick={() => onEdit(facility)} title="Edit facility">
            <Edit2 size={14} />
          </button>
          <button
            className="facility-action-btn delete"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete facility"
          >
            {deleting ? (
              <div className="spinner-border spinner-border-sm" role="status" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>

        <button className="facility-expand-btn">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="facility-details">
          <div className="facility-detail-group">
            <div className="facility-detail-group-title">
              <Building2 size={12} /> Facility Info
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Type</span>
              <span className="facility-detail-value">{facility.facility_type || 'N/A'}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Address</span>
              <span className="facility-detail-value">{facility.address || 'N/A'}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">ZIP Code</span>
              <span className="facility-detail-value">{facility.zip_code || 'N/A'}</span>
            </div>
          </div>

          <div className="facility-detail-group">
            <div className="facility-detail-group-title">
              <Users size={12} /> Capacity
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Total Beds</span>
              <span className="facility-detail-value">{formatNumber(facility.bed_count)}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Licensed Beds</span>
              <span className="facility-detail-value">{formatNumber(facility.licensed_beds)}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Occupancy</span>
              <span className="facility-detail-value">{formatPercent(facility.occupancy_rate)}</span>
            </div>
          </div>

          <div className="facility-detail-group">
            <div className="facility-detail-group-title">
              <DollarSign size={12} /> Financials
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">EBITDAR</span>
              <span className="facility-detail-value">{formatCurrency(facility.ebitdar)}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">NOI</span>
              <span className="facility-detail-value">{formatCurrency(facility.noi)}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Annual Rent</span>
              <span className="facility-detail-value">{formatCurrency(facility.annual_rent)}</span>
            </div>
          </div>

          <div className="facility-detail-group">
            <div className="facility-detail-group-title">
              <TrendingUp size={12} /> Payer Mix
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Medicare</span>
              <span className="facility-detail-value">{formatPercent(facility.medicare_mix)}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Medicaid</span>
              <span className="facility-detail-value">{formatPercent(facility.medicaid_mix)}</span>
            </div>
            <div className="facility-detail-item">
              <span className="facility-detail-label">Private Pay</span>
              <span className="facility-detail-value">{formatPercent(facility.private_pay_mix)}</span>
            </div>
          </div>
        </div>
      )}
      {expanded && isCompetitor && (
        <div className="competitor-note">
          Competitor data is sourced from CMS database. No AI extraction performed.
        </div>
      )}
    </div>
  );
};

const FacilitiesSection = ({ dealId, facilities: initialFacilities = [] }) => {
  const [facilities, setFacilities] = useState(initialFacilities);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [expandedFacilities, setExpandedFacilities] = useState({});

  const fetchFacilities = async () => {
    setLoading(true);
    try {
      const response = await getDealFacilities(dealId);
      setFacilities(response.body || []);
    } catch (error) {
      console.error('Error fetching facilities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dealId && (!initialFacilities || initialFacilities.length === 0)) {
      fetchFacilities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const handleAddFacility = () => {
    setEditingFacility(null);
    setShowModal(true);
  };

  const handleEditFacility = (facility) => {
    setEditingFacility(facility);
    setShowModal(true);
  };

  const handleSave = () => {
    fetchFacilities();
  };

  const toggleExpand = (facilityId) => {
    setExpandedFacilities((prev) => ({
      ...prev,
      [facilityId]: !prev[facilityId],
    }));
  };

  // Separate facilities by role
  const subjectFacilities = facilities.filter(f => !f.facility_role || f.facility_role === 'subject');
  const competitorFacilities = facilities.filter(f => f.facility_role === 'competitor');
  const hasMultipleRoles = subjectFacilities.length > 0 && competitorFacilities.length > 0;

  // Calculate portfolio summary (only for subject properties)
  const portfolioSummary = {
    totalBeds: subjectFacilities.reduce((sum, f) => sum + (parseFloat(f.bed_count) || 0), 0),
    totalPrice: subjectFacilities.reduce((sum, f) => sum + (parseFloat(f.purchase_price) || 0), 0),
    totalRevenue: subjectFacilities.reduce((sum, f) => sum + (parseFloat(f.annual_revenue) || 0), 0),
    totalEbitda: subjectFacilities.reduce((sum, f) => sum + (parseFloat(f.ebitda) || 0), 0),
  };

  return (
    <>
      <style>{styles}</style>
      <div className="facilities-section">
        <div className="facilities-header">
          <h2 className="facilities-title">
            <Building2 size={20} />
            Facilities
            <span className="facilities-count">{facilities.length}</span>
            {hasMultipleRoles && (
              <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                ({subjectFacilities.length} subject{subjectFacilities.length !== 1 ? 's' : ''}, {competitorFacilities.length} competitor{competitorFacilities.length !== 1 ? 's' : ''})
              </span>
            )}
          </h2>
          <button className="add-facility-btn" onClick={handleAddFacility}>
            <Plus size={16} />
            Add Facility
          </button>
        </div>

        {subjectFacilities.length > 1 && (
          <div className="portfolio-summary">
            <div className="portfolio-metric">
              <div className="portfolio-metric-value">{subjectFacilities.length}</div>
              <div className="portfolio-metric-label">Subject Properties</div>
            </div>
            <div className="portfolio-metric">
              <div className="portfolio-metric-value">{formatNumber(portfolioSummary.totalBeds)}</div>
              <div className="portfolio-metric-label">Total Beds</div>
            </div>
            <div className="portfolio-metric">
              <div className="portfolio-metric-value">{formatCurrency(portfolioSummary.totalPrice)}</div>
              <div className="portfolio-metric-label">Total Price</div>
            </div>
            <div className="portfolio-metric">
              <div className="portfolio-metric-value">{formatCurrency(portfolioSummary.totalRevenue)}</div>
              <div className="portfolio-metric-label">Total Revenue</div>
            </div>
            <div className="portfolio-metric">
              <div className="portfolio-metric-value">{formatCurrency(portfolioSummary.totalEbitda)}</div>
              <div className="portfolio-metric-label">Total EBITDA</div>
            </div>
          </div>
        )}

        <div className="facilities-list">
          {loading ? (
            <div className="empty-facilities">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : facilities.length === 0 ? (
            <div className="empty-facilities">
              <div className="empty-facilities-icon">
                <Building2 size={32} className="text-gray-400" />
              </div>
              <h4>No Facilities Added</h4>
              <p>Add individual facilities to this deal to track detailed information for each location.</p>
              <button className="add-facility-btn" onClick={handleAddFacility}>
                <Plus size={16} />
                Add First Facility
              </button>
            </div>
          ) : (
            <>
              {/* Subject Properties Section */}
              {hasMultipleRoles && subjectFacilities.length > 0 && (
                <div className="section-divider">
                  <Target size={14} />
                  Subject Properties ({subjectFacilities.length})
                </div>
              )}
              {subjectFacilities.map((facility) => (
                <FacilityCard
                  key={facility.id}
                  facility={facility}
                  onEdit={handleEditFacility}
                  onDelete={fetchFacilities}
                  expanded={expandedFacilities[facility.id]}
                  onToggleExpand={() => toggleExpand(facility.id)}
                  showRoleBadge={hasMultipleRoles}
                />
              ))}

              {/* Competitors Section */}
              {competitorFacilities.length > 0 && (
                <>
                  <div className="section-divider competitor">
                    <UserCheck size={14} />
                    Competitors ({competitorFacilities.length})
                  </div>
                  {competitorFacilities.map((facility) => (
                    <FacilityCard
                      key={facility.id}
                      facility={facility}
                      onEdit={handleEditFacility}
                      onDelete={fetchFacilities}
                      expanded={expandedFacilities[facility.id]}
                      onToggleExpand={() => toggleExpand(facility.id)}
                      showRoleBadge={hasMultipleRoles}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <FacilityFormModal
        show={showModal}
        onHide={() => setShowModal(false)}
        facility={editingFacility}
        dealId={dealId}
        onSave={handleSave}
      />
    </>
  );
};

export default FacilitiesSection;
