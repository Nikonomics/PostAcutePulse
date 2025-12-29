import React, { useState, useCallback } from 'react';
import { Modal, Button, Form, Table, Spinner, Badge, InputGroup } from 'react-bootstrap';
import { Search, MapPin, Building2, X, Bookmark, BookmarkCheck } from 'lucide-react';
import { searchFacilities } from '../api/marketService';
import { saveMarketFacility } from '../api/savedItemsService';
import { toast } from 'react-toastify';

// US States for dropdown
const US_STATES = [
  { code: '', name: 'All States' },
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

/**
 * FacilitySearchModal - Search and select facilities from SNF/ALF databases
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSelectFacility - Called with full facility object when user selects one
 * @param {string} initialFacilityType - Pre-selected facility type ('SNF' or 'ALF')
 * @param {string} initialState - Pre-selected state code (e.g., 'WY')
 * @param {string} initialSearchTerm - Pre-filled search term
 */
const FacilitySearchModal = ({
  isOpen,
  onClose,
  onSelectFacility,
  initialFacilityType = 'SNF',
  initialState = '',
  initialSearchTerm = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [facilityType, setFacilityType] = useState(initialFacilityType);
  const [state, setState] = useState(initialState);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const [savingFacilityId, setSavingFacilityId] = useState(null);
  const [savedFacilityIds, setSavedFacilityIds] = useState(new Set());

  // Reset state when modal opens with new initial values
  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm(initialSearchTerm);
      setFacilityType(initialFacilityType);
      setState(initialState);
      setResults([]);
      setHasSearched(false);
      setError(null);
    }
  }, [isOpen, initialSearchTerm, initialFacilityType, initialState]);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();

    if (!searchTerm || searchTerm.length < 2) {
      toast.warning('Please enter at least 2 characters to search');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await searchFacilities(searchTerm, facilityType, state || null);
      const facilityResults = response.body?.results || response.results || [];
      setResults(facilityResults);

      if (facilityResults.length === 0) {
        // No toast needed - UI shows "No results found"
      }
    } catch (err) {
      console.error('Facility search error:', err);
      setError(err.message || 'Failed to search facilities');
      toast.error('Failed to search facilities. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, facilityType, state]);

  const handleSelect = (facility) => {
    onSelectFacility(facility);
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    setResults([]);
    setHasSearched(false);
    setError(null);
    setSavedFacilityIds(new Set());
    onClose();
  };

  const handleSaveFacility = async (facility) => {
    const facilityId = facility.id || facility.facility_id;
    // Determine facility type - use the search facilityType, default to SNF if "both" was selected
    const saveFacilityType = facilityType === 'both' ? 'SNF' : facilityType;

    setSavingFacilityId(facilityId);

    try {
      const result = await saveMarketFacility(saveFacilityType, facilityId);

      if (result.success) {
        setSavedFacilityIds(prev => new Set([...prev, facilityId]));
        toast.success(`${facility.facility_name} saved to your items!`);
      } else if (result.alreadySaved) {
        toast.info('Facility is already in your saved items');
        setSavedFacilityIds(prev => new Set([...prev, facilityId]));
      }
    } catch (err) {
      console.error('Error saving facility:', err);
      toast.error('Failed to save facility. Please try again.');
    } finally {
      setSavingFacilityId(null);
    }
  };

  // Format bed count display
  const formatBeds = (facility) => {
    // SNF uses total_beds, ALF uses capacity
    return facility.total_beds || facility.capacity || '-';
  };

  return (
    <Modal show={isOpen} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <Building2 size={20} />
          Search Facility Database
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Search Form */}
        <Form onSubmit={handleSearch}>
          <div className="row g-3 mb-3">
            {/* Search Input */}
            <div className="col-12">
              <Form.Label className="fw-semibold">Facility Name</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <Search size={16} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Enter facility name (e.g., Sunrise, Big Horn)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searchTerm && (
                  <Button
                    variant="outline-secondary"
                    onClick={() => setSearchTerm('')}
                    title="Clear"
                  >
                    <X size={16} />
                  </Button>
                )}
              </InputGroup>
            </div>

            {/* Facility Type Dropdown */}
            <div className="col-md-6">
              <Form.Label className="fw-semibold">Facility Type</Form.Label>
              <Form.Select
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
              >
                <option value="SNF">SNF (Skilled Nursing)</option>
                <option value="ALF">ALF (Assisted Living)</option>
                <option value="both">Both SNF & ALF</option>
              </Form.Select>
            </div>

            {/* State Dropdown */}
            <div className="col-md-6">
              <Form.Label className="fw-semibold">State</Form.Label>
              <Form.Select
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>

          {/* Search Button */}
          <div className="d-grid">
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading || searchTerm.length < 2}
            >
              {isLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={16} className="me-2" />
                  Search Facilities
                </>
              )}
            </Button>
          </div>
        </Form>

        {/* Results Section */}
        <div className="mt-4">
          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Searching facility database...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {/* No Results */}
          {!isLoading && hasSearched && results.length === 0 && !error && (
            <div className="text-center py-5">
              <Building2 size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No facilities found</h5>
              <p className="text-muted small">
                Try adjusting your search term or filters.
                {state && ' Consider searching "All States".'}
              </p>
            </div>
          )}

          {/* Results Table */}
          {!isLoading && results.length > 0 && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small">
                  Found <strong>{results.length}</strong> facilit{results.length === 1 ? 'y' : 'ies'}
                </span>
                {results.length > 10 && (
                  <span className="text-muted small">Showing first 50 results</span>
                )}
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table hover responsive className="align-middle mb-0">
                  <thead className="bg-light sticky-top">
                    <tr>
                      <th>Facility Name</th>
                      <th>Location</th>
                      <th className="text-center">Beds</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 50).map((facility, index) => (
                      <tr key={facility.id || facility.facility_id || index}>
                        <td>
                          <div className="fw-semibold">
                            {facility.facility_name}
                          </div>
                          {facility.address && (
                            <small className="text-muted">{facility.address}</small>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1">
                            <MapPin size={14} className="text-muted" />
                            <span>{facility.city}, {facility.state}</span>
                          </div>
                          {facility.county && (
                            <small className="text-muted">{facility.county} County</small>
                          )}
                        </td>
                        <td className="text-center">
                          <Badge bg="secondary" pill>
                            {formatBeds(facility)}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <div className="d-flex gap-2 justify-content-end">
                            <Button
                              variant={savedFacilityIds.has(facility.id || facility.facility_id) ? "success" : "outline-secondary"}
                              size="sm"
                              onClick={() => handleSaveFacility(facility)}
                              disabled={savingFacilityId === (facility.id || facility.facility_id) || savedFacilityIds.has(facility.id || facility.facility_id)}
                              title={savedFacilityIds.has(facility.id || facility.facility_id) ? "Saved" : "Save to My Items"}
                            >
                              {savingFacilityId === (facility.id || facility.facility_id) ? (
                                <Spinner animation="border" size="sm" />
                              ) : savedFacilityIds.has(facility.id || facility.facility_id) ? (
                                <BookmarkCheck size={16} />
                              ) : (
                                <Bookmark size={16} />
                              )}
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleSelect(facility)}
                            >
                              Select
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}

          {/* Initial State - Before Search */}
          {!isLoading && !hasSearched && (
            <div className="text-center py-4 text-muted">
              <Search size={32} className="mb-2 opacity-50" />
              <p className="mb-0">Enter a facility name and click Search</p>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default FacilitySearchModal;
