import React, { useState } from 'react';
import { Card, Button, Badge, Form, Collapse, Spinner, ButtonGroup } from 'react-bootstrap';
import {
  Building2,
  MapPin,
  CheckCircle,
  XCircle,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  AlertTriangle,
  Target,
  Users,
  EyeOff,
} from 'lucide-react';

// Facility role options
const FACILITY_ROLES = {
  subject: { label: 'Subject Property', icon: Target, color: 'primary', description: 'Full AI extraction' },
  competitor: { label: 'Competitor', icon: Users, color: 'info', description: 'Database info only' },
  exclude: { label: 'Exclude', icon: EyeOff, color: 'secondary', description: 'Ignore this facility' },
};

// US States for manual entry dropdown
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

/**
 * Get confidence badge color
 */
const getConfidenceBadge = (confidence) => {
  switch (confidence) {
    case 'high':
      return { bg: 'success', text: 'High Match' };
    case 'medium':
      return { bg: 'warning', text: 'Possible Match' };
    case 'low':
      return { bg: 'danger', text: 'Low Match' };
    default:
      return { bg: 'secondary', text: 'No Match' };
  }
};

/**
 * Single facility confirmation card
 */
const FacilityCard = ({
  facility,
  index,
  onConfirmMatch,
  onSearchDatabase,
  onManualEntry,
  onRemove,
  onRoleChange,
}) => {
  const currentRole = facility.role || 'subject';
  const isExcluded = currentRole === 'exclude';
  const [expanded, setExpanded] = useState(true);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(
    facility.matchCandidates?.length > 0 ? 0 : -1
  );
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({
    name: facility.detected?.name || '',
    city: facility.detected?.city || '',
    state: facility.detected?.state || '',
    beds: facility.detected?.beds || '',
    facility_type: facility.detected?.facility_type || 'SNF',
  });

  const confidenceBadge = getConfidenceBadge(facility.best_match_confidence);
  const isConfirmed = facility.user_confirmed;
  const hasMatches = facility.matchCandidates?.length > 0;

  const handleConfirm = () => {
    if (showManualForm) {
      // Manual entry confirmation
      onManualEntry(index, manualData);
    } else if (selectedMatchIndex >= 0 && hasMatches) {
      // Database match confirmation
      onConfirmMatch(index, facility.matchCandidates[selectedMatchIndex]);
    }
  };

  const handleManualChange = (field, value) => {
    setManualData(prev => ({ ...prev, [field]: value }));
  };

  const RoleIcon = FACILITY_ROLES[currentRole]?.icon || Target;
  const roleColor = FACILITY_ROLES[currentRole]?.color || 'primary';

  return (
    <Card
      className={`mb-3 ${isConfirmed && !isExcluded ? 'border-success' : ''} ${isExcluded ? 'border-secondary' : ''}`}
      style={isExcluded ? { opacity: 0.6, backgroundColor: '#f8f9fa' } : {}}
    >
      <Card.Header
        className="d-flex justify-content-between align-items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center gap-2">
          {isExcluded ? (
            <EyeOff size={20} className="text-muted" />
          ) : isConfirmed ? (
            <CheckCircle size={20} className="text-success" />
          ) : (
            <Building2 size={20} className="text-muted" />
          )}
          <div>
            <strong className={isExcluded ? 'text-muted' : ''}>
              Facility {index + 1}: {facility.detected?.name || 'Unknown'}
            </strong>
            <div className="text-muted small">
              <MapPin size={12} className="me-1" />
              {facility.detected?.city}, {facility.detected?.state}
              {facility.detected?.beds && ` • ${facility.detected.beds} beds`}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {/* Role badge */}
          {currentRole !== 'subject' && (
            <Badge bg={roleColor} className="me-1">
              <RoleIcon size={12} className="me-1" />
              {FACILITY_ROLES[currentRole]?.label}
            </Badge>
          )}
          {isConfirmed && !isExcluded ? (
            <Badge bg="success">Confirmed</Badge>
          ) : isExcluded ? (
            <Badge bg="secondary">Excluded</Badge>
          ) : (
            <Badge bg={confidenceBadge.bg}>{confidenceBadge.text}</Badge>
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </Card.Header>

      <Collapse in={expanded}>
        <div>
          <Card.Body>
            {/* Detected Info */}
            <div className="mb-3 p-3 bg-light rounded">
              <small className="text-muted d-block mb-2">
                <strong>Detected from documents:</strong>
              </small>
              <div className="row">
                <div className="col-md-6">
                  <small className="text-muted">Name:</small>
                  <div>{facility.detected?.name || '—'}</div>
                </div>
                <div className="col-md-3">
                  <small className="text-muted">Location:</small>
                  <div>{facility.detected?.city}, {facility.detected?.state}</div>
                </div>
                <div className="col-md-3">
                  <small className="text-muted">Beds:</small>
                  <div>{facility.detected?.beds || '—'}</div>
                </div>
              </div>
              {facility.detected?.confidence && (
                <div className="mt-2">
                  <small className="text-muted">
                    Detection confidence: {Math.round(facility.detected.confidence * 100)}%
                  </small>
                </div>
              )}
            </div>

            {/* Role Selector */}
            <div className="mb-3 p-3 border rounded bg-white">
              <small className="text-muted d-block mb-2">
                <strong>How should we handle this facility?</strong>
              </small>
              <ButtonGroup className="w-100">
                {Object.entries(FACILITY_ROLES).map(([roleKey, roleInfo]) => {
                  const RoleBtnIcon = roleInfo.icon;
                  const isActive = currentRole === roleKey;
                  return (
                    <Button
                      key={roleKey}
                      variant={isActive ? roleInfo.color : `outline-${roleInfo.color}`}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRoleChange(index, roleKey);
                      }}
                      className="d-flex flex-column align-items-center py-2"
                      style={{ flex: 1 }}
                    >
                      <RoleBtnIcon size={16} className="mb-1" />
                      <span style={{ fontSize: '0.75rem' }}>{roleInfo.label}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{roleInfo.description}</span>
                    </Button>
                  );
                })}
              </ButtonGroup>
            </div>

            {/* Match Candidates - only show if not excluded */}
            {!isExcluded && (
              <>
            {/* Match Candidates */}
            {!showManualForm && hasMatches && (
              <div className="mb-3">
                <small className="text-muted d-block mb-2">
                  <strong>Database matches found ({facility.matchCandidates.length}):</strong>
                </small>
                <div className="border rounded overflow-hidden">
                  {facility.matchCandidates.slice(0, 5).map((match, matchIdx) => {
                    const isSelected = selectedMatchIndex === matchIdx;
                    return (
                      <div
                        key={match.id || matchIdx}
                        className="p-3 border-bottom d-flex align-items-center gap-3"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#e7f1ff' : '#fff',
                          borderLeft: isSelected ? '4px solid #0d6efd' : '4px solid transparent',
                          transition: 'all 0.15s ease-in-out',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#fff';
                        }}
                        onClick={() => setSelectedMatchIndex(matchIdx)}
                      >
                        <Form.Check
                          type="radio"
                          name={`match-${index}`}
                          checked={isSelected}
                          onChange={() => setSelectedMatchIndex(matchIdx)}
                          style={{ accentColor: '#0d6efd' }}
                        />
                        <div className="flex-grow-1">
                          <div className="fw-semibold" style={{ color: '#212529' }}>
                            {match.facility_name}
                          </div>
                          <small style={{ color: '#6c757d' }}>
                            {match.address}, {match.city}, {match.state} {match.zip_code}
                          </small>
                          <div className="d-flex gap-3 mt-1">
                            <small style={{ color: '#495057' }}>
                              <strong>{match.total_beds || match.capacity || '?'}</strong> beds
                            </small>
                            {match.overall_rating && (
                              <small style={{ color: '#495057' }}>CMS Rating: {match.overall_rating}/5</small>
                            )}
                          </div>
                        </div>
                        <Badge
                          bg={match.match_confidence === 'high' ? 'success' :
                              match.match_confidence === 'medium' ? 'warning' : 'secondary'}
                        >
                          {Math.round((match.weighted_score || 0) * 100)}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No Matches Message */}
            {!showManualForm && !hasMatches && (
              <div className="mb-3 p-3 border rounded text-center">
                <AlertTriangle size={24} className="text-warning mb-2" />
                <div className="text-muted">
                  No matching facilities found in database.
                  <br />
                  <small>Search the database or enter facility details manually.</small>
                </div>
              </div>
            )}

            {/* Manual Entry Form */}
            {showManualForm && (
              <div className="mb-3 p-3 border rounded">
                <small className="text-muted d-block mb-3">
                  <strong>Enter facility details manually:</strong>
                </small>
                <div className="row g-3">
                  <div className="col-12">
                    <Form.Label className="small">Facility Name</Form.Label>
                    <Form.Control
                      size="sm"
                      value={manualData.name}
                      onChange={(e) => handleManualChange('name', e.target.value)}
                      placeholder="Enter facility name"
                    />
                  </div>
                  <div className="col-md-5">
                    <Form.Label className="small">City</Form.Label>
                    <Form.Control
                      size="sm"
                      value={manualData.city}
                      onChange={(e) => handleManualChange('city', e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="col-md-3">
                    <Form.Label className="small">State</Form.Label>
                    <Form.Select
                      size="sm"
                      value={manualData.state}
                      onChange={(e) => handleManualChange('state', e.target.value)}
                    >
                      <option value="">Select</option>
                      {US_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-2">
                    <Form.Label className="small">Beds</Form.Label>
                    <Form.Control
                      size="sm"
                      type="number"
                      value={manualData.beds}
                      onChange={(e) => handleManualChange('beds', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-md-2">
                    <Form.Label className="small">Type</Form.Label>
                    <Form.Select
                      size="sm"
                      value={manualData.facility_type}
                      onChange={(e) => handleManualChange('facility_type', e.target.value)}
                    >
                      <option value="SNF">SNF</option>
                      <option value="ALF">ALF</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isConfirmed && (
              <div className="d-flex flex-wrap gap-2">
                {(hasMatches || showManualForm) && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleConfirm}
                    disabled={!showManualForm && selectedMatchIndex < 0}
                  >
                    <CheckCircle size={14} className="me-1" />
                    {showManualForm ? 'Confirm Manual Entry' : 'Confirm Match'}
                  </Button>
                )}
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => onSearchDatabase(index)}
                >
                  <Search size={14} className="me-1" />
                  Search Database
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowManualForm(!showManualForm)}
                >
                  <Edit3 size={14} className="me-1" />
                  {showManualForm ? 'Show Matches' : 'Enter Manually'}
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 size={14} className="me-1" />
                  Remove
                </Button>
              </div>
            )}

            {/* Confirmed State */}
            {isConfirmed && (
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-success">
                  <CheckCircle size={16} className="me-1" />
                  {facility.manual_entry ? 'Manual entry confirmed' : 'Database match confirmed'}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted"
                  onClick={() => onRemove(index)}
                >
                  <XCircle size={14} className="me-1" />
                  Change
                </Button>
              </div>
            )}
              </>
            )}
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};

/**
 * FacilityConfirmationList - Shows detected facilities with match confirmation UI
 */
const FacilityConfirmationList = ({
  facilities,
  onConfirmMatch,
  onManualEntry,
  onSearchDatabase,
  onRemoveFacility,
  onAddFacility,
  onRoleChange,
}) => {
  const confirmedCount = facilities.filter(f => f.user_confirmed).length;

  return (
    <div className="facility-confirmation-list">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">
            <Building2 size={20} className="me-2" />
            Detected Facilities ({facilities.length})
          </h5>
          <small className="text-muted">
            {confirmedCount} of {facilities.length} confirmed
          </small>
        </div>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={onAddFacility}
        >
          <Plus size={14} className="me-1" />
          Add Facility
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="progress mb-4" style={{ height: '8px' }}>
        <div
          className="progress-bar bg-success"
          role="progressbar"
          style={{ width: `${(confirmedCount / facilities.length) * 100}%` }}
        />
      </div>

      {/* Facility Cards */}
      {facilities.map((facility, index) => (
        <FacilityCard
          key={facility.id || index}
          facility={facility}
          index={index}
          onConfirmMatch={onConfirmMatch}
          onSearchDatabase={onSearchDatabase}
          onManualEntry={onManualEntry}
          onRemove={onRemoveFacility}
          onRoleChange={onRoleChange}
        />
      ))}

      {/* Empty State */}
      {facilities.length === 0 && (
        <div className="text-center py-5">
          <Building2 size={48} className="text-muted mb-3" />
          <h5 className="text-muted">No facilities detected</h5>
          <p className="text-muted small mb-3">
            Click "Add Facility" to manually add facilities to this portfolio.
          </p>
          <Button variant="primary" onClick={onAddFacility}>
            <Plus size={16} className="me-1" />
            Add Facility
          </Button>
        </div>
      )}
    </div>
  );
};

export default FacilityConfirmationList;
