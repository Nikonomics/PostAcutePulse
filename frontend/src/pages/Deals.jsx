import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Button, Table, Form, InputGroup, Badge, Card, Row, Col, Spinner } from "react-bootstrap";
import {
  Eye,
  Edit3,
  Search,
  Plus,
  Trash2,
  Upload,
  Building,
  DollarSign,
  MapPin,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getDealsWithActivity,
  getDealStats,
  updateDealStatus,
  deleteDeal,
  bulkDeleteDeals,
  formatSimpleDate,
  extractDealEnhanced,
} from "../api/DealService";
import { toast } from "react-toastify";
import ActivityBadge from "../components/ActivityBadge";
import LastActivityCell from "../components/LastActivityCell";

// CSS Styles matching original app design
const styles = `
  .deals-page {
    min-height: 100vh;
    background-color: #f8f9fa;
    padding: 1.5rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .page-subtitle {
    color: #6b7280;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-new-deal {
    background-color: #059669;
    border-color: #059669;
    color: white;
  }

  .btn-new-deal:hover {
    background-color: #047857;
    border-color: #047857;
    color: white;
  }

  .filters-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
  }

  .deals-table-card {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .deals-table {
    margin-bottom: 0;
  }

  .deals-table thead th {
    background-color: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
  }

  .deals-table tbody td {
    padding: 1rem;
    vertical-align: middle;
    border-bottom: 1px solid #f3f4f6;
  }

  .deals-table tbody tr:hover {
    background-color: #f9fafb;
  }

  .deal-name {
    font-weight: 600;
    color: #1f2937;
    cursor: pointer;
    transition: color 0.2s;
  }

  .deal-name:hover {
    color: #7c3aed;
  }

  .deal-info {
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.35rem 0.65rem;
    border-radius: 9999px;
  }

  .status-pipeline { background-color: #dbeafe; color: #1e40af; }
  .status-due_diligence { background-color: #fef3c7; color: #92400e; }
  .status-final_review { background-color: #ede9fe; color: #6b21a8; }
  .status-closed { background-color: #d1fae5; color: #065f46; }
  .status-hold { background-color: #f3f4f6; color: #374151; }

  .type-badge {
    font-size: 0.75rem;
    padding: 0.35rem 0.65rem;
    border-radius: 0.375rem;
    background-color: #f3f4f6;
    color: #374151;
  }

  .action-btn {
    padding: 0.375rem 0.5rem;
    border: none;
    background: transparent;
    border-radius: 0.375rem;
    color: #6b7280;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background-color: #f3f4f6;
  }

  .action-btn.view:hover { color: #7c3aed; }
  .action-btn.edit:hover { color: #2563eb; }
  .action-btn.delete:hover { color: #dc2626; }

  .stats-row {
    margin-top: 1.5rem;
  }

  .stat-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
  }

  .stat-value.green { color: #059669; }
  .stat-value.blue { color: #2563eb; }
  .stat-value.orange { color: #d97706; }

  .stat-label {
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .pagination-info {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .upload-zone {
    border: 2px dashed #d1d5db;
    border-radius: 0.5rem;
    padding: 2rem;
    text-align: center;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1.5rem;
  }

  .upload-zone:hover {
    border-color: #7c3aed;
    background: #f5f3ff;
  }

  .upload-zone.dragging {
    border-color: #7c3aed;
    background: #ede9fe;
  }

  .upload-zone-icon {
    color: #9ca3af;
    margin-bottom: 0.75rem;
  }

  .upload-zone-text {
    color: #374151;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .upload-zone-subtext {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  .empty-state-icon {
    color: #d1d5db;
    margin-bottom: 1rem;
  }

  .selection-bar {
    background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);
  }

  .selection-bar-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .selection-bar-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-clear-selection {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
  }

  .btn-clear-selection:hover {
    background: rgba(255, 255, 255, 0.3);
    color: white;
  }

  .btn-delete-selected {
    background: #dc2626;
    border-color: #dc2626;
    color: white;
  }

  .btn-delete-selected:hover {
    background: #b91c1c;
    border-color: #b91c1c;
  }

  .deal-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #7c3aed;
  }

  .checkbox-cell {
    width: 40px;
    text-align: center;
  }

  .deals-table tbody tr.selected {
    background-color: #f5f3ff;
  }

  .deals-table tbody tr.selected:hover {
    background-color: #ede9fe;
  }

  .drag-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(124, 58, 237, 0.1);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .drag-overlay-content {
    background: white;
    padding: 3rem;
    border-radius: 1rem;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 3px dashed #7c3aed;
  }
`;

const DealsList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [dealsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  const [totalDeals, setTotalDeals] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [dealStats, setDealStats] = useState({});
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [showDealModal, setShowDealModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Status update state
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // Multi-select state
  const [selectedDeals, setSelectedDeals] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const fetchDealsWithFilters = async (search, status, type, page) => {
    try {
      setLoading(true);
      const response = await getDealsWithActivity(search, status, type, page);
      setTotalDeals(response.body.total);
      setFilteredDeals(response.body.deals);
      setTotalPages(response.body.totalPages);
    } catch (error) {
      console.error("Error fetching filtered deals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealsWithFilters(searchTerm, statusFilter, typeFilter, currentPage);
    const fetchDealStats = async () => {
      const response = await getDealStats();
      setDealStats(response.body || {});
    };
    fetchDealStats();
  }, [searchTerm, statusFilter, typeFilter, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setTypeFilter("All");
    setCurrentPage(1);
    fetchDealsWithFilters("", "All", "All", 1);
  };

  const handleShowDealModal = (id) => {
    setShowDealModal(true);
    setDeleteLoadingId(id);
  };

  const handleCloseDealModal = () => {
    setShowDealModal(false);
    setDeleteLoadingId(null);
  };

  const handleDeleteDeal = async () => {
    setDeleteLoading(true);
    try {
      const response = await deleteDeal(deleteLoadingId);
      if (response.success !== true) {
        toast.error(response.message);
        return;
      }
      toast.success(response.message);
      fetchDealsWithFilters(searchTerm, statusFilter, typeFilter, currentPage);
    } catch (error) {
      console.error("Failed to delete deal", error);
    } finally {
      setDeleteLoading(false);
      setShowDealModal(false);
      setDeleteLoadingId(null);
    }
  };

  // Handle inline status change
  const handleStatusChange = async (dealId, newStatus) => {
    setStatusUpdatingId(dealId);
    try {
      const response = await updateDealStatus({ id: dealId, deal_status: newStatus });
      if (response.success) {
        // Update local state
        setFilteredDeals(prev => prev.map(deal =>
          deal.id === dealId ? { ...deal, deal_status: newStatus } : deal
        ));
        toast.success(`Status updated to ${getStatusLabel(newStatus)}`);
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update deal status', error);
      toast.error('Failed to update status');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Multi-select handlers
  const handleSelectDeal = (dealId) => {
    setSelectedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else {
        newSet.add(dealId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDeals.size === filteredDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(filteredDeals.map(deal => deal.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedDeals(new Set());
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const ids = Array.from(selectedDeals);
      const response = await bulkDeleteDeals(ids);
      if (response.success) {
        toast.success(response.message);
        setSelectedDeals(new Set());
        fetchDealsWithFilters(searchTerm, statusFilter, typeFilter, currentPage);
      } else {
        toast.error(response.message || 'Failed to delete deals');
      }
    } catch (error) {
      console.error('Failed to bulk delete deals', error);
      toast.error('Failed to delete deals');
    } finally {
      setBulkDeleteLoading(false);
      setShowBulkDeleteModal(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file =>
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel'
    );

    if (validFiles.length > 0) {
      handleExtractAndNavigate(validFiles);
    } else {
      toast.error("Please upload PDF, image, Excel, or Word files");
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      handleExtractAndNavigate(selectedFiles);
    }
  };

  const handleExtractAndNavigate = async (files) => {
    setIsExtracting(true);
    try {
      const response = await extractDealEnhanced(files);
      if (response.success) {
        // Calculate confidence from extraction metadata
        const successRate = response.body.metadata?.successCount || 5;
        const calculatedConfidence = Math.round((successRate / 5) * 100);

        // Navigate to the combined deal form with AI-extracted data
        navigate('/deals/combined-deal-form', {
          state: {
            extractedData: response.body.extractedData,
            confidence: calculatedConfidence,
            uploadedFiles: response.body.uploadedFiles,
            files: files,
            // Pass enhanced time-series data
            enhancedData: {
              monthlyFinancials: response.body.monthlyFinancials || [],
              monthlyCensus: response.body.monthlyCensus || [],
              monthlyExpenses: response.body.monthlyExpenses || [],
              rates: response.body.rates || {},
              ttmFinancials: response.body.ttmFinancials || null,
              censusSummary: response.body.censusSummary || null,
              expensesByDepartment: response.body.expensesByDepartment || {},
              ratios: response.body.ratios || {},
              benchmarkFlags: response.body.benchmarkFlags || {},
              potentialSavings: response.body.potentialSavings || {},
              insights: response.body.insights || [],
              facility: response.body.facility || {},
              metadata: response.body.metadata || {},
            }
          }
        });
      } else {
        toast.error(response.message || "Failed to extract data");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error(error.message || "Failed to extract data from document");
    } finally {
      setIsExtracting(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    return `status-badge status-${status}`;
  };

  const getStatusLabel = (status) => {
    const labelMap = {
      'pipeline': 'Pipeline',
      'due_diligence': 'Due Diligence',
      'final_review': 'Final Review',
      'closed': 'Closed',
      'hold': 'On Hold',
    };
    return labelMap[status] || status;
  };

  const formatCurrency = (value) => {
    if (!value) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <style>{styles}</style>
      <div
        className="deals-page"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              <Upload size={48} color="#7c3aed" style={{ marginBottom: '1rem' }} />
              <h4>Drop files here</h4>
              <p className="text-muted">Release to upload and analyze with AI</p>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">All Deals</h1>
            <p className="page-subtitle">Manage and track all M&A opportunities</p>
          </div>
          <div className="header-actions">
            <Button
              className="btn-new-deal d-flex align-items-center gap-2"
              onClick={() => navigate("/deals/combined-deal-form")}
            >
              <Plus size={16} />
              New Deal
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Upload Zone */}
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onClick={() => !isExtracting && fileInputRef.current?.click()}
        >
          <Upload size={40} className="upload-zone-icon" />
          <p className="upload-zone-text">
            Drag and drop deal documents here, or click to browse
          </p>
          <p className="upload-zone-subtext">
            AI will automatically extract deal information from PDFs, Excel, Word, and images
          </p>
        </div>

        {/* Filters */}
        <div className="filters-card">
          <Row className="align-items-center g-3">
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text>
                  <Search size={16} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search deals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={2}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="pipeline">Pipeline</option>
                <option value="due_diligence">Due Diligence</option>
                <option value="final_review">Final Review</option>
                <option value="closed">Closed</option>
                <option value="hold">On Hold</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="Acquisition">Acquisition</option>
                <option value="Development">Development</option>
                <option value="Refinance">Refinance</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button
                variant="outline-secondary"
                className="w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={handleClearFilters}
              >
                <RefreshCw size={14} />
                Clear
              </Button>
            </Col>
            <Col md={2} className="text-end">
              <span className="pagination-info">
                {totalDeals} deal{totalDeals !== 1 ? 's' : ''} found
              </span>
            </Col>
          </Row>
        </div>

        {/* Selection Bar */}
        {selectedDeals.size > 0 && (
          <div className="selection-bar">
            <div className="selection-bar-info">
              <span className="fw-semibold">
                {selectedDeals.size} deal{selectedDeals.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="selection-bar-actions">
              <Button
                size="sm"
                className="btn-clear-selection"
                onClick={handleClearSelection}
              >
                Clear Selection
              </Button>
              <Button
                size="sm"
                className="btn-delete-selected d-flex align-items-center gap-1"
                onClick={() => setShowBulkDeleteModal(true)}
              >
                <Trash2 size={14} />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Deals Table */}
        <div className="deals-table-card">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading deals...</p>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="empty-state">
              <Building size={48} className="empty-state-icon" />
              <h5>No deals found</h5>
              <p>Try adjusting your filters or create a new deal</p>
            </div>
          ) : (
            <Table className="deals-table" hover responsive>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      className="deal-checkbox"
                      checked={selectedDeals.size === filteredDeals.length && filteredDeals.length > 0}
                      onChange={handleSelectAll}
                      title="Select all"
                    />
                  </th>
                  <th>Deal Name</th>
                  <th>Location</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Last Updated</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className={selectedDeals.has(deal.id) ? 'selected' : ''}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        className="deal-checkbox"
                        checked={selectedDeals.has(deal.id)}
                        onChange={() => handleSelectDeal(deal.id)}
                      />
                    </td>
                    <td>
                      <div
                        className="deal-name"
                        onClick={() => navigate(`/deals/deal-detail/${deal.id}`)}
                      >
                        {deal.deal_name}
                      </div>
                      <div className="deal-info">
                        {deal.deal_facility?.[0]?.facility_type || 'SNF'} • {deal.deal_facility?.[0]?.bed_count || deal.bed_count || '—'} beds
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <MapPin size={14} className="text-muted" />
                        <span>
                          {deal.deal_facility?.[0]?.city && deal.deal_facility?.[0]?.state
                            ? `${deal.deal_facility[0].city}, ${deal.deal_facility[0].state}`
                            : '—'
                          }
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <DollarSign size={14} className="text-success" />
                        <span className="fw-medium">
                          {formatCurrency(deal.deal_facility?.[0]?.purchase_price || deal.purchase_price)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={deal.deal_status}
                        onChange={(e) => handleStatusChange(deal.id, e.target.value)}
                        disabled={statusUpdatingId === deal.id}
                        className={getStatusBadgeClass(deal.deal_status)}
                        style={{
                          width: 'auto',
                          minWidth: '130px',
                          cursor: statusUpdatingId === deal.id ? 'wait' : 'pointer',
                          opacity: statusUpdatingId === deal.id ? 0.7 : 1,
                        }}
                      >
                        <option value="pipeline">Pipeline</option>
                        <option value="due_diligence">Due Diligence</option>
                        <option value="final_review">Final Review</option>
                        <option value="closed">Closed</option>
                        <option value="hold">On Hold</option>
                      </Form.Select>
                    </td>
                    <td>
                      <span className="type-badge">
                        {deal.deal_type || 'Acquisition'}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <LastActivityCell
                          activityType={deal.last_activity_type}
                          activityUser={deal.last_activity_user}
                          activityAt={deal.last_activity_at || deal.updated_at || deal.created_at}
                        />
                        {deal.unread_count > 0 && (
                          <ActivityBadge count={deal.unread_count} />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button
                          className="action-btn view"
                          onClick={() => navigate(`/deals/deal-detail/${deal.id}`)}
                          title="View Deal"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn edit"
                          onClick={() => navigate(`/deals/edit-combined-deal/${deal.id}`)}
                          title="Edit Deal"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleShowDealModal(deal.id)}
                          title="Delete Deal"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="pagination-info">
              Showing {(currentPage - 1) * dealsPerPage + 1} - {Math.min(currentPage * dealsPerPage, totalDeals)} of {totalDeals}
            </span>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => (
                <Button
                  key={i + 1}
                  variant={currentPage === i + 1 ? "primary" : "outline-secondary"}
                  size="sm"
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <Row className="stats-row g-3">
          <Col md={3}>
            <div className="stat-card">
              <div className="stat-value">{dealStats.total_active_deals || 0}</div>
              <div className="stat-label">Active Deals</div>
            </div>
          </Col>
          <Col md={3}>
            <div className="stat-card">
              <div className="stat-value green">{dealStats.total_pipeline_value || '$0'}</div>
              <div className="stat-label">Pipeline Value</div>
            </div>
          </Col>
          <Col md={3}>
            <div className="stat-card">
              <div className="stat-value orange">{formatCurrency(dealStats.average_deal_size)}</div>
              <div className="stat-label">Avg Deal Size</div>
            </div>
          </Col>
          <Col md={3}>
            <div className="stat-card">
              <div className="stat-value blue">{dealStats.closing_this_month || 0}</div>
              <div className="stat-label">Closing This Month</div>
            </div>
          </Col>
        </Row>

        {/* Delete Confirmation Modal */}
        <Modal show={showDealModal} onHide={handleCloseDealModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>Confirm Deletion</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Are you sure you want to delete this deal? This action cannot be undone.
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseDealModal}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteDeal}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                "Delete"
              )}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Bulk Delete Confirmation Modal */}
        <Modal show={showBulkDeleteModal} onHide={() => setShowBulkDeleteModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Confirm Bulk Deletion</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to delete <strong>{selectedDeals.size} deal{selectedDeals.size !== 1 ? 's' : ''}</strong>?</p>
            <p className="text-danger mb-0">This action cannot be undone.</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBulkDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleBulkDelete}
              disabled={bulkDeleteLoading}
            >
              {bulkDeleteLoading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                `Delete ${selectedDeals.size} Deal${selectedDeals.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
};

export default DealsList;
