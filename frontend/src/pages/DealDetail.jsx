import React, { useState, useEffect } from "react";
import { Modal, Button } from "react-bootstrap";
import {
  Save,
  Download,
  Share,
  Trash2,
  Upload,
  MessageCircle,
  Tag,
  User,
  Calendar,
  MapPin,
  DollarSign,
  TrendingUp,
  FileText,
  Send,
  Paperclip,
  Plus,
  X,
  Eye,
  Download as DownloadIcon,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getDealById,
  addDealComment,
  getDealComments,
  addDealDocument,
  getDealDocuments,
  deleteDealDocument,
  deleteDeal,
  formatSimpleDate,
  deleteDealComment,
  updateExtractionData,
  updateDealStatus,
  markDealAsViewed,
} from "../api/DealService";
import { fileUpload } from "../api/authService";
import { getTeamRecentActivity } from "../api/DealService";
import * as yup from "yup";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import { DealExtractionViewer } from "../components/DealExtractionViewer";
import { unflattenExtractedData } from "../components/DealExtractionViewer/utils";
import { BarChart2, Building2 } from "lucide-react";
import FacilitiesSection from "../components/FacilitiesSection";
import { ExcelPreview, WordPreview } from "../components/DocumentPreviewers";

// CSS Styles
const styles = `
  .deal-detail-page {
    min-height: 100vh;
    background-color: #f9fafb;
  }

  .deal-header {
    background-color: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 1rem 1.5rem;
  }

  .deal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .deal-subtitle {
    color: #6b7280;
    margin: 0.25rem 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: #dbeafe;
    color: #1e40af;
  }

  .deal-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: #059669;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary { background-color: #2563eb; color: white; }
  .btn-primary:hover { background-color: #1d4ed8; }
  
  .btn-success { background-color: #059669; color: white; }
  .btn-success:hover { background-color: #047857; }
  
  .btn-secondary { background-color: #6b7280; color: white; }
  .btn-secondary:hover { background-color: #4b5563; }
  
  .btn-danger { background-color: #dc2626; color: white; }
  .btn-danger:hover { background-color: #b91c1c; }

  .card {
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    font-size: 0.875rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
  }

  .info-label {
    color: #6b7280;
  }

  .info-value {
    font-weight: 500;
    color: #111827;
  }

  .progress-bar {
    width: 100%;
    height: 0.5rem;
    background-color: #e5e7eb;
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: #2563eb;
    border-radius: 9999px;
    transition: width 0.3s ease;
  }

  .comment-form {
    margin-bottom: 1.5rem;
  }

  .comment-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db !important;
    border-radius: 0.5rem;
    resize: none;
    font-size: 0.875rem;
  }

  .comment-textarea:focus {
    outline: none;
    ring: 2px;
    ring-color: #2563eb;
    border-color: transparent;
  }

  .tag-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background-color: #dbeafe;
    color: #1e40af;
    border-radius: 0.375rem;
    font-size: 0.75rem;
  }

  .tag-button {
    background: none;
    border: none;
    padding: 0.125rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .tag-button:hover {
    background-color: #bfdbfe;
  }

  .comment-item {
    border-left: 4px solid #bfdbfe;
    padding-left: 1rem;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
  }

  .comment-avatar {
    width: 2rem;
    height: 2rem;
    background-color: #2563eb;
    color: white;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .upload-area {
    border: 2px dashed #d1d5db;
    border-radius: 0.5rem;
    padding: 1.5rem;
    text-align: center;
    transition: border-color 0.2s;
  }

  .upload-area:hover {
    border-color: #9ca3af;
  }

  .activity-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    margin-bottom: 1rem;
  }

  .activity-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .activity-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    margin-top: 0.5rem;
    flex-shrink: 0;
  }

  .activity-dot.upload { background-color: #2563eb; }
  .activity-dot.task { background-color: #059669; }
  .activity-dot.alert { background-color: #f59e0b; }

  .document-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    background-color: #f9fafb;
  }

  .document-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .document-icon {
    padding: 0.5rem;
    background-color: #dbeafe;
    border-radius: 0.375rem;
    color: #2563eb;
  }

  .document-actions {
    display: flex;
    gap: 0.5rem;
  }

  .document-btn {
    padding: 0.25rem 0.5rem;
    background-color: transparent;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .document-btn:hover {
    background-color: #f3f4f6;
    color: #374151;
  }

  .document-btn.delete-btn {
    border-color: #fca5a5;
    color: #dc2626;
  }

  .document-btn.delete-btn:hover {
    background-color: #fef2f2;
    border-color: #f87171;
    color: #b91c1c;
  }

  .document-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1rem 1.5rem;
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  .grid-cols-3 {
    grid-template-columns: 1fr;
  }

  .col-span-2 {
    grid-column: span 1;
  }

  @media (max-width: 1024px) {
    .grid-cols-3 {
      grid-template-columns: 1fr;
    }
    .col-span-2 {
      grid-column: span 1;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .upload-btn-inline {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #10b981;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .upload-btn-inline:hover {
    background-color: #059669;
  }

  .upload-btn-inline input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .comment-btn-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #8b5cf6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .comment-btn-inline:hover {
    background-color: #7c3aed;
  }

  .flex {
    display: flex;
  }

  .items-center {
    align-items: center;
  }

  .justify-between {
    justify-content: space-between;
  }

  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }

  .mb-2 { margin-bottom: 0.5rem; }
  .mb-4 { margin-bottom: 1rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-4 { margin-top: 1rem; }

  .text-sm { font-size: 0.875rem; }
  .text-xs { font-size: 0.75rem; }
  .text-gray-500 { color: #6b7280; }
  .text-gray-600 { color: #4b5563; }
  .text-gray-700 { color: #374151; }
  .text-gray-900 { color: #111827; }
  .text-blue-600 { color: #2563eb; }
  .text-green-600 { color: #059669; }
  .text-orange-600 { color: #ea580c; }

  .font-medium { font-weight: 500; }
  .font-semibold { font-weight: 600; }

  .hidden { display: none; }

  /* Document Preview Panel */
  .document-preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1050;
    display: flex;
    justify-content: flex-end;
  }

  .document-preview-panel {
    width: 100%;
    max-width: 800px;
    height: 100%;
    background: white;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    animation: slideInRight 0.3s ease-out;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .document-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
  }

  .document-preview-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: #111827;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .document-preview-header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .document-preview-close {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.5rem;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .document-preview-close:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .document-preview-download {
    background: #2563eb;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .document-preview-download:hover {
    background: #1d4ed8;
  }

  .document-preview-open {
    background: #10b981;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .document-preview-open:hover {
    background: #059669;
  }

  .document-preview-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .document-preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .document-preview-fallback {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: #6b7280;
  }

  .document-preview-fallback-icon {
    padding: 1.5rem;
    background: #f3f4f6;
    border-radius: 1rem;
    margin-bottom: 1.5rem;
  }

  .document-preview-fallback h4 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .document-preview-fallback p {
    margin-bottom: 1.5rem;
    max-width: 300px;
  }

  .document-preview-footer {
    padding: 0.75rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
`;

const DealDetailPage = () => {
  const [newComment, setNewComment] = useState("");
  const [selectedTags, setSelectedTags] = useState([
    "high-priority",
    "due-diligence",
  ]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);

  const [comments, setComments] = useState([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");

  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // holds comment ID to confirm
  const [showModal, setShowModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);

  // Document preview panel state
  const [previewDocument, setPreviewDocument] = useState(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);

  // fetch recent activity data:
  const [teamActivity, setTeamActivity] = useState([]);
  const navigate = useNavigate();

  const fetchDeal = async () => {
    try {
      const [dealResponse, activityResponse] = await Promise.all([
        getDealById(id),
        getTeamRecentActivity(id),
      ]);

      setDeal(dealResponse.body);
      setTeamActivity(activityResponse.body);
    } catch (error) {
      console.error("Error fetching deal or activity:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeal();
  }, [id]);

  // Mark deal as viewed when user opens the page
  useEffect(() => {
    if (id) {
      markDealAsViewed(id).catch(err => {
        console.error('Failed to mark deal as viewed:', err);
      });
    }
  }, [id]);

  // Fetch comments from API
  const fetchComments = async () => {
    setCommentLoading(true);
    setCommentError("");
    try {
      const response = await getDealComments(id);
      setComments(response.body || []);
    } catch (error) {
      setCommentError("Failed to load comments");
    } finally {
      setCommentLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line
  }, [id]);

  const fetchDocuments = async () => {
    const response = await getDealDocuments(id);
    setUploadedDocuments(response.body);
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      setDeleteLoadingId(documentId);
      const response = await deleteDealDocument(documentId);

      if (response.success === true) {
        // Remove the deleted document from the state
        setUploadedDocuments((prev) =>
          prev.filter((doc) => doc.id !== documentId)
        );
        toast.success(response.message || "Document deleted successfully");
      } else {
        toast.error(response.message || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line
  }, [id]);

  // Mock data
  const dealData = {
    name: "Maple Grove SNF",
    subtitle: "120 Beds • Skilled Nursing Facility • Phoenix, AZ",
    status: "Due Diligence",
    value: "$15.2M",
    basicInfo: {
      facilityType: "Skilled Nursing",
      beds: 120,
      yearBuilt: 1995,
      renovated: 2018,
      location: "Phoenix, AZ",
      assigned: "Sarah K.",
    },
    financialMetrics: {
      purchasePrice: "$15.2M",
      annualRevenue: "$28.1M",
      ebitda: "$4.2M",
      capRate: "8.7%",
      roiProjection: "12.4%",
      paybackPeriod: "5.2 years",
    },
    timeline: {
      started: "June 15, 2025",
      dueDate: "August 25, 2025",
      daysRemaining: 38,
      progress: 65,
      nextMilestone: "Survey Review",
    },
  };

  const commentSchema = yup.object().shape({
    comment: yup.string().required("Comment is required"),
    tags: yup.array().of(yup.string()).required("At least one tag is required"),
  });

  const handleAddComment = async () => {
    setCommentError("");
    try {
      await commentSchema.validate({ comment: newComment, tags: selectedTags });
      const payload = {
        deal_id: id,
        comment: newComment,
      };
      const response = await addDealComment(payload);
      setComments((prev) => [response.body, ...prev]);
      setNewComment("");
    } catch (err) {
      if (err.name === "ValidationError") {
        setCommentError(err.message);
      } else {
        setCommentError("Failed to add comment");
      }
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag)) {
      setSelectedTags([...selectedTags, newTag]);
      setNewTag("");
      setShowTagInput(false);
    }
  };

  const removeTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const handleFileUpload = async (event) => {
    setUploading(true);
    const files = event.target.files;
    if (files.length > 0) {
      // Upload the file and get the URL
      const uploadRes = await fileUpload(files[0]);
      const fileUrl = uploadRes.body[0];
      console.log("fileUrl", fileUrl);
      if (fileUrl) {
        // When file upload gets URL, then call API addDealDocument
        const payload = {
          deal_id: id,
          document_name: files[0].name,
          document_url: fileUrl,
        };
        try {
          const response = await addDealDocument(payload);
          if (response.success === true) {
            setUploadedDocuments((prev) => [response.body, ...prev]);
            toast.success(response.message);
          } else {
            toast.error(response.message);
          }
        } catch (err) {
          console.error("Failed to add deal document", err);
        } finally {
          setUploading(false);
        }
      }
    }
  };

  // Handler for document upload from DealExtractionViewer (accepts File directly)
  const handleDocumentUpload = async (file) => {
    setUploading(true);
    try {
      // Upload the file and get the URL
      const uploadRes = await fileUpload(file);
      const fileUrl = uploadRes.body[0];
      if (fileUrl) {
        // When file upload gets URL, then call API addDealDocument
        const payload = {
          deal_id: id,
          document_name: file.name,
          document_url: fileUrl,
        };
        const response = await addDealDocument(payload);
        if (response.success === true) {
          setUploadedDocuments((prev) => [response.body, ...prev]);
          toast.success(response.message);
        } else {
          toast.error(response.message);
        }
      }
    } catch (err) {
      console.error("Failed to add deal document", err);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentView = (doc) => {
    // Set the document to preview and open the panel
    setPreviewDocument(doc);
    setShowDocumentPreview(true);
  };

  const closeDocumentPreview = () => {
    setShowDocumentPreview(false);
    setPreviewDocument(null);
  };

  // Handler for field edits from DealExtractionViewer
  // The DealExtractionViewer uses nested paths (e.g., 'deal_information.deal_name')
  // but extraction_data in the database is stored flat (e.g., 'deal_name')
  const handleFieldEdit = async (fieldPath, newValue) => {
    try {
      // Deep clone the extraction data to avoid mutation issues
      const currentExtractionData = JSON.parse(JSON.stringify(deal.extraction_data || {}));

      // Convert nested path to flat field name
      // e.g., 'deal_information.deal_name' -> 'deal_name'
      // e.g., 'facility_information.bed_count' -> 'bed_count'
      // e.g., 'contact_information.phone' -> 'contact_phone' (special case mapping)
      const pathParts = fieldPath.split('.');
      let flatKey = pathParts[pathParts.length - 1]; // Default: use last part of path

      // Handle special mappings for contact fields (canonical names differ from display names)
      const contactFieldMappings = {
        'title': 'contact_title',
        'phone': 'contact_phone',
        'email': 'contact_email'
      };

      // Check if this is a contact field that needs mapping
      if (pathParts[0] === 'contact_information' && contactFieldMappings[flatKey]) {
        flatKey = contactFieldMappings[flatKey];
      }

      // Update the flat extraction_data structure
      currentExtractionData[flatKey] = newValue;

      // Call the API that updates extraction_data
      const response = await updateExtractionData(deal.id, currentExtractionData);

      if (response.success) {
        // Update local state
        setDeal(prev => ({
          ...prev,
          extraction_data: currentExtractionData
        }));
        toast.success('Field updated successfully');
      } else {
        toast.error(response.message || 'Failed to update field');
      }
    } catch (err) {
      console.error("Failed to update field", err);
      toast.error("Failed to update field");
    }
  };

  // Handler for deal status change from DealExtractionViewer
  const handleDealStatusChange = async (newStatus) => {
    try {
      const response = await updateDealStatus({ id: deal.id, deal_status: newStatus });
      if (response.success) {
        setDeal(prev => ({
          ...prev,
          deal_status: newStatus
        }));
        toast.success(`Deal status updated to ${newStatus.replace('_', ' ')}`);
      } else {
        toast.error(response.message || 'Failed to update deal status');
        throw new Error(response.message);
      }
    } catch (err) {
      console.error("Failed to update deal status", err);
      toast.error("Failed to update deal status");
      throw err;
    }
  };

  // Get the full URL for document display
  const getDocumentUrl = (docUrl) => {
    if (!docUrl) return '';
    if (docUrl.startsWith('/api/')) {
      return `${process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '')}${docUrl}`;
    }
    return docUrl;
  };

  // Get file extension from document name or URL
  const getFileExtension = (doc) => {
    const name = doc.document_name || doc.name || doc.document_url || '';
    const ext = name.split('.').pop()?.toLowerCase();
    return ext;
  };

  // Check if document can be previewed in browser natively
  const canPreviewInBrowser = (doc) => {
    const ext = getFileExtension(doc);
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };

  // Check if document is an Excel file
  const isExcelFile = (doc) => {
    const ext = getFileExtension(doc);
    return ['xls', 'xlsx'].includes(ext);
  };

  // Check if document is a Word file
  const isWordFile = (doc) => {
    const ext = getFileExtension(doc);
    return ['doc', 'docx'].includes(ext);
  };

  const handleDocumentDownload = (docUrl) => {
    // Handle both local API files and external URLs
    if (docUrl.startsWith('/api/')) {
      window.open(`${process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '')}${docUrl}`, "_blank");
    } else {
      window.open(docUrl, "_blank");
    }
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case "pdf":
        return <FileText className="text-red-600" size={20} />;
      case "excel":
        return <FileText className="text-green-600" size={20} />;
      case "word":
        return <FileText className="text-blue-600" size={20} />;
      default:
        return <FileText className="text-gray-600" size={20} />;
    }
  };

  const getReadableStatus = (status) => {
    switch (status) {
      case "pipeline":
        return "Pipeline";
      case "due_diligence":
        return "Due Diligence";
      case "final_review":
        return "Final Review";
      case "closed":
        return "Closed";
      default:
        return status;
    }
  };

  const handleDeleteComment = async () => {
    if (!confirmDeleteId) return;

    setDeleteLoading(true);
    try {
      const response = await deleteDealComment(confirmDeleteId); // FIXED here

      if (response.success !== true) {
        toast.error(response.message);
        return;
      }

      toast.success(response.message);
      fetchComments(); // refresh comments
    } catch (error) {
      console.error("Failed to delete comment", error);
      toast.error("Something went wrong");
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteId(null); // close modal
      setShowModal(false);
    }
  };

  const handleShowModal = (id) => {
    setConfirmDeleteId(id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setConfirmDeleteId(null);
  };

  const handleShowDealModal = () => {
    setShowDealModal(true);
  };

  const handleCloseDealModal = () => {
    setShowDealModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span
          className="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true"
        ></span>
      </div>
    );
  }

  // handle delete deal
  const handleDeleteDeal = async () => {
    setDeleteLoading(true);
    try {
      const response = await deleteDeal(id);

      if (response.success !== true) {
        toast.error(response.message);
        return;
      }

      toast.success(response.message);
      navigate("/Deals");
    } catch (error) {
      console.error("Failed to delete deal", error);
    } finally {
      setDeleteLoading(false);
      setShowDealModal(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="deal-detail-page">
        {/* Header - Compact */}
        <div className="deal-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="deal-title">{deal.deal_name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="deal-subtitle" style={{ margin: 0 }}>{deal.deal_type}</span>
                  <span className="status-badge">{deal.deal_status}</span>
                  <span className="deal-value">
                    $
                    {deal.deal_facility && deal.deal_facility.length > 0
                      ? deal.deal_facility
                          .reduce(
                            (sum, facility) =>
                              sum + (parseFloat(facility.purchase_price) || 0),
                            0
                          )
                          .toLocaleString()
                      : (deal.purchase_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="header-actions">
              {/* Upload Documents Button */}
              <label className="upload-btn-inline">
                <Upload size={16} />
                {uploading ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  multiple={false}
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              {/* Comment Button */}
              <button
                className="comment-btn-inline"
                onClick={() => {
                  const commentsSection = document.getElementById('comments-section');
                  if (commentsSection) commentsSection.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <MessageCircle size={16} />
                Comment
              </button>
              <button className="btn btn-primary">
                <Download size={16} />
                Export
              </button>
              <button className="btn btn-secondary">
                <Share size={16} />
                Share
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleShowDealModal()}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="container">
          <div className="grid grid-cols-3">
            {/* Main Content */}
            <div className="col-span-2">
              {/* Deal Analysis / AI Extraction Viewer (includes Calculator tab) */}
              {deal.extraction_data && (
                <div style={{ marginBottom: '1rem' }}>
                  <DealExtractionViewer
                    extractionData={unflattenExtractedData(deal.extraction_data)}
                    showComparison={false}
                    dealDocuments={uploadedDocuments || []}
                    dealId={deal.id}
                    deal={deal}
                    onDocumentUpload={handleDocumentUpload}
                    isUploading={uploading}
                    onDocumentView={handleDocumentView}
                    onDocumentDelete={handleDeleteDocument}
                    onDocumentDownload={handleDocumentDownload}
                    deleteLoadingId={deleteLoadingId}
                    onFieldEdit={handleFieldEdit}
                    onDealStatusChange={handleDealStatusChange}
                  />
                </div>
              )}

              {/* Multi-Facility Management Section (new) */}
              <FacilitiesSection
                dealId={deal.id}
                facilities={deal.facilities || []}
              />

              {/* Legacy Facility Information (from flat deal structure - will be deprecated) */}
              {deal.deal_facility && deal.deal_facility.length > 0 &&
                deal.deal_facility.map((facility, index) => (
                  <>
                    <div className="card">
                      <div className="card">
                        <h2 className="card-title">
                          Facility {index + 1} {facility.facility_name}
                        </h2>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">Facility Name:</span>
                            <span className="info-value">
                              {facility.facility_name}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Facility Type:</span>
                            <span className="info-value">
                              {facility.facility_type}
                            </span>
                          </div>
                          {Array.isArray(facility.no_of_beds) &&
                          facility.no_of_beds.length > 0 ? (
                            facility.no_of_beds.map((bed, idx) => (
                              <div className="info-item" key={idx}>
                                <span className="info-label">
                                  Number of Beds {bed.type}:
                                </span>
                                <span className="info-value">{bed.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="info-item">
                              <span className="info-label">
                                Number of Beds:
                              </span>
                              <span className="info-value">N/A</span>
                            </div>
                          )}

                          <div className="info-item">
                            <span className="info-label">Address:</span>
                            <span className="info-value">
                              {facility.address}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">State:</span>
                            <span className="info-value">{facility.state}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">City:</span>
                            <span className="info-value">{facility.city}</span>
                          </div>
                          {/* facility info end */}
                        </div>
                      </div>
                      {/* <div className="card">
                        <h2 className="card-title">
                          Purchase Price & Structure
                        </h2>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">
                              Purchase Price(USD):
                            </span>
                            <span className="info-value text-green-600">
                              ${facility.purchase_price}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Price per Bed:</span>
                            <span className="info-value">
                              ${facility.price_per_bed}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Down Payment %:</span>
                            <span className="info-value">
                              {facility.down_payment}%
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              Financing Amount:
                            </span>
                            <span className="info-value">
                              {facility.financing_amount}
                            </span>
                          </div>
                        </div>
                      </div> */}
                      {/* Revenue Information */}
                      <div className="card">
                        <h2 className="card-title">Financial Information</h2>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">
                              Purchase Price (USD):
                            </span>
                            <span className="info-value">
                              ${facility.purchase_price || 0}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Price per Bed:</span>
                            <span className="info-value">
                              ${facility.price_per_bed || 0}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">T12M Revenue:</span>
                            <span className="info-value">
                              ${facility.t12m_revenue || 0}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              T12M Occupancy %:
                            </span>
                            <span className="info-value">
                              {facility.t12m_occupancy ||0}%
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">T12M EBITDAR:</span>
                            <span className="info-value">
                              {facility.t12m_ebitdar || 0}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              Current Rent/ Lease Expense:
                            </span>
                            <span className="info-value">
                              {facility.current_rent_lease_expense || 0}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">T12M EBITDA:</span>
                            <span className="info-value">
                              {facility.t12m_ebitda || 0}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">T12M EBIT:</span>
                            <span className="info-value">
                              {facility.t12m_ebit || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Operating Metrics */}
                      {/* <div className="card">
                        <h2 className="card-title">Operating Metrics</h2>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">
                              Current Occupancy%:
                            </span>
                            <span className="info-value">
                              {facility.current_occupancy}%
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              Average Daily Rate:
                            </span>
                            <span className="info-value">
                              ${facility.average_daily_rate}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Medicare %:</span>
                            <span className="info-value">
                              {facility.medicare_percentage}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Private Pay %:</span>
                            <span className="info-value">
                              {facility.private_pay_percentage}%
                            </span>
                          </div>
                        </div>
                      </div> */}

                      {/* Pro Forma Projections */}
                      <div className="card">
                        <h2 className="card-title">
                          <TrendingUp size={20} />
                          Pro Forma Projections
                        </h2>

                        <div className="row">
                          {/* Year 1 */}
                          <div className="col-md-4">
                            <h6 className="text-secondary mb-2">Year 1</h6>
                            <ul className="list-unstyled small">
                              <li>
                                <strong>Annual Revenue:</strong>{" "}
                                {facility.proforma_year1_annual_revenue
                                  ? `$${parseFloat(
                                      facility.proforma_year1_annual_revenue
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual EBITDAR:</strong>{" "}
                                {facility.proforma_year1_annual_ebitdar || 0
                                  ? `$${parseFloat(
                                      facility.proforma_year1_annual_ebitdar
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual Rent:</strong>{" "}
                                {facility.proforma_year1_annual_rent || 0
                                  ? `$${parseFloat(
                                      facility.proforma_year1_annual_rent
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual EBITDA:</strong>{" "}
                                {facility.proforma_year1_annual_ebitda
                                  ? `$${parseFloat(
                                      facility.proforma_year1_annual_ebitda
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Average Occupancy:</strong>{" "}
                                {facility.proforma_year1_average_occupancy || 0
                                  ? `${facility.proforma_year1_average_occupancy}%`
                                  : "0%"}
                              </li>
                              <li>
                                <strong>Annual EBIT:</strong>{" "}
                                {facility.proforma_year1_annual_ebit || 0
                                  ? `$${parseFloat(
                                      facility.proforma_year1_annual_ebit
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                            </ul>
                          </div>

                          {/* Year 2 */}
                          <div className="col-md-4">
                            <h6 className="text-secondary mb-2">Year 2</h6>
                            <ul className="list-unstyled small">
                              <li>
                                <strong>Annual Revenue:</strong>{" "}
                                {facility.proforma_year2_annual_revenue || 0
                                  ? `$${parseFloat(
                                      facility.proforma_year2_annual_revenue
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual EBITDAR:</strong>{" "}
                                {facility.proforma_year2_annual_ebitdar || 0
                                  ? `$${parseFloat(
                                      facility.proforma_year2_annual_ebitdar
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual Rent:</strong>{" "}
                                {facility.proforma_year2_annual_rent
                                  ? `$${parseFloat(
                                      facility.proforma_year2_annual_rent
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual EBITDA:</strong>{" "}
                                {facility.proforma_year2_annual_ebitda
                                  ? `$${parseFloat(
                                      facility.proforma_year2_annual_ebitda
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Average Occupancy:</strong>{" "}
                                {facility.proforma_year2_average_occupancy
                                  ? `${facility.proforma_year2_average_occupancy}%`
                                  : "0%"}
                              </li>
                              <li>
                                <strong>Annual EBIT:</strong>{" "}
                                {facility.proforma_year2_annual_ebit
                                  ? `$${parseFloat(
                                      facility.proforma_year2_annual_ebit
                                    ).toLocaleString()}`
                                  : "0%"}
                              </li>
                            </ul>
                          </div>

                          {/* Year 3 */}
                          <div className="col-md-4">
                            <h6 className="text-secondary mb-2">Year 3</h6>
                            <ul className="list-unstyled small">
                              <li>
                                <strong>Annual Revenue:</strong>{" "}
                                {facility.proforma_year3_annual_revenue
                                  ? `$${parseFloat(
                                      facility.proforma_year3_annual_revenue
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual EBITDAR:</strong>{" "}
                                {facility.proforma_year3_annual_ebitdar
                                  ? `$${parseFloat(
                                      facility.proforma_year3_annual_ebitdar
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual Rent:</strong>{" "}
                                {facility.proforma_year3_annual_rent
                                  ? `$${parseFloat(
                                      facility.proforma_year3_annual_rent
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Annual EBITDA:</strong>{" "}
                                {facility.proforma_year3_annual_ebitda
                                  ? `$${parseFloat(
                                      facility.proforma_year3_annual_ebitda
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                              <li>
                                <strong>Average Occupancy:</strong>{" "}
                                {facility.proforma_year3_average_occupancy
                                  ? `${facility.proforma_year3_average_occupancy}%`
                                  : "0%"}
                              </li>
                              <li>
                                <strong>Annual EBIT:</strong>{" "}
                                {facility.proforma_year3_annual_ebit
                                  ? `$${parseFloat(
                                      facility.proforma_year3_annual_ebit
                                    ).toLocaleString()}`
                                  : "$0"}
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Investment Return Targets */}
                      {/* <div className="card">
                        <h2 className="card-title">
                          Investment Return Targets
                        </h2>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="info-label">Target IRR%:</span>
                            <span className="info-value">
                              {facility.target_irr_percentage}%
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              Target Hold Period:
                            </span>
                            <span className="info-value">
                              ${facility.target_hold_period}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              Projected Cap Rate %:
                            </span>
                            <span className="info-value">
                              {facility.projected_cap_rate_percentage}%
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Exit Multiple:</span>
                            <span className="info-value">
                              {facility.exit_multiple}%
                            </span>
                          </div>
                        </div>
                      </div> */}
                    </div>
                  </>
                ))}

              {/* Uploaded Documents */}
              <div className="card ">
                <h2 className="card-title">
                  <FileText size={20} />
                  Uploaded Documents ({uploadedDocuments.length})
                </h2>

                {uploadedDocuments.length > 0 ? (
                  <div className="comment-wrapper">
                    {uploadedDocuments.map((doc) => (
                      <div key={doc.id} className="document-item">
                        <div className="document-info">
                          <div className="document-icon">
                            {getDocumentIcon(doc.type)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {doc.document_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {doc.size} • Uploaded by {doc.user.first_name}{" "}
                              {doc.user.last_name} •{" "}
                              {doc.created_at.split("T")[0]}
                            </div>
                          </div>
                        </div>
                        <div className="document-actions">
                          <button
                            onClick={() => handleDocumentView(doc)}
                            className="document-btn flex items-center gap-1"
                          >
                            <Eye size={14} />
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="document-btn delete-btn flex items-center gap-1"
                            disabled={deleteLoadingId === doc.id}
                          >
                            {deleteLoadingId === doc.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 size={14} />
                                Delete
                              </>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              handleDocumentDownload(doc.document_url)
                            }
                            className="document-btn flex items-center gap-1"
                          >
                            <DownloadIcon size={14} />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText
                      size={48}
                      className="mx-auto mb-2 text-gray-300"
                    />
                    <p>No documents uploaded yet</p>
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="card" id="comments-section">
                <h2 className="card-title">
                  <MessageCircle size={20} />
                  Comments & Discussion
                </h2>

                {/* Add Comment */}
                <div className="comment-form">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="comment-textarea"
                    rows={3}
                  />

                  {/* Tags Section */}
                  {/* <div className="mt-4">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Tag size={16} className="text-gray-400" />
                      <span className="text-gray-600">Tags:</span>
                    </div>
                    
                    <div className="tag-container">
                      {selectedTags.map(tag => (
                        <span key={tag} className="tag">
                          {tag}
                          <button 
                            onClick={() => removeTag(tag)}
                            className="tag-button"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      
                      {showTagInput ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                            placeholder="Add tag..."
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            style={{width: '100px'}}
                            autoFocus
                          />
                          <button onClick={handleAddTag} className="text-blue-600 hover:text-blue-800">
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowTagInput(true)}
                          className="flex items-center gap-1 px-2 py-1 border border-dashed border-gray-300 text-gray-500 rounded text-sm hover:border-gray-400"
                        >
                          <Plus size={12} />
                          Add tag
                        </button>
                      )}
                    </div>
                    
                    <div className="tag-container">
                      {availableTags.filter(tag => !selectedTags.includes(tag)).map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTags([...selectedTags, tag])}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div> */}

                  <div className="flex justify-between items-center mt-4">
                    {/* <label className="cursor-pointer flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                      <Paperclip size={16} />
                      Attach files
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                     */}
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="btn btn-primary"
                      style={{ opacity: !newComment.trim() ? 0.5 : 1 }}
                    >
                      <Send size={16} />
                      Post Comment
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="comment-wrapper">
                  {comments.map((comment) => (
                    <div key={comment.id} className="comment-item">
                      <div className="flex items-start gap-3">
                        <div className="comment-avatar">
                          {comment.user.profile_url ? (
                            <img
                              src={comment.user.profile_url}
                              alt="avatar"
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {comment.user.first_name} {comment.user.last_name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {(() => {
                                const dateObj = new Date(comment.created_at);
                                const day = dateObj.getDate();
                                const month = dateObj.toLocaleString(
                                  "default",
                                  { month: "short" }
                                );
                                const year = dateObj.getFullYear();
                                const hours = dateObj
                                  .getHours()
                                  .toString()
                                  .padStart(2, "0");
                                const minutes = dateObj
                                  .getMinutes()
                                  .toString()
                                  .padStart(2, "0");
                                return `${day} ${month} ${year} ${hours}:${minutes}`;
                              })()}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">
                            {comment.comment}
                          </p>
                        </div>
                        <div className="comment-actions">
                          <button
                            className="action-btn delete"
                            disabled={deleteLoadingId === comment.id}
                          >
                            <Trash2
                              size={16}
                              onClick={() => handleShowModal(comment.id)}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Delete Comment Modal */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this comment? This action cannot be
          undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteComment}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Delete"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Deal Modal */}
      <Modal show={showDealModal} onHide={handleCloseDealModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this deal? This action cannot be
          undone.
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
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Delete"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Document Preview Panel */}
      {showDocumentPreview && previewDocument && (
        <div className="document-preview-overlay" onClick={closeDocumentPreview}>
          <div className="document-preview-panel" onClick={(e) => e.stopPropagation()}>
            <div className="document-preview-header">
              <h3>
                <FileText size={20} />
                {previewDocument.document_name || previewDocument.name || 'Document'}
              </h3>
              <div className="document-preview-header-actions">
                <button
                  className="document-preview-open"
                  onClick={() => {
                    const url = getDocumentUrl(previewDocument.document_url || previewDocument.url);
                    window.open(url, '_blank');
                  }}
                  title="Open in new tab"
                >
                  <Eye size={16} />
                  Open
                </button>
                <button
                  className="document-preview-download"
                  onClick={() => handleDocumentDownload(previewDocument.document_url || previewDocument.url)}
                  title="Download document"
                >
                  <DownloadIcon size={16} />
                  Download
                </button>
                <button
                  className="document-preview-close"
                  onClick={closeDocumentPreview}
                  title="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="document-preview-content">
              {canPreviewInBrowser(previewDocument) ? (
                <iframe
                  className="document-preview-iframe"
                  src={getDocumentUrl(previewDocument.document_url || previewDocument.url)}
                  title={previewDocument.document_name || 'Document Preview'}
                />
              ) : isExcelFile(previewDocument) ? (
                <ExcelPreview
                  url={getDocumentUrl(previewDocument.document_url || previewDocument.url)}
                  fileName={previewDocument.document_name || previewDocument.name}
                />
              ) : isWordFile(previewDocument) ? (
                <WordPreview
                  url={getDocumentUrl(previewDocument.document_url || previewDocument.url)}
                  fileName={previewDocument.document_name || previewDocument.name}
                />
              ) : (
                <div className="document-preview-fallback">
                  <div className="document-preview-fallback-icon">
                    <FileText size={48} className="text-gray-400" />
                  </div>
                  <h4>Preview not available</h4>
                  <p>
                    This file type ({getFileExtension(previewDocument).toUpperCase()}) cannot be previewed in the browser.
                  </p>
                  <button
                    className="document-preview-download"
                    onClick={() => handleDocumentDownload(previewDocument.document_url || previewDocument.url)}
                  >
                    <DownloadIcon size={16} />
                    Download to View
                  </button>
                </div>
              )}
            </div>

            <div className="document-preview-footer">
              <span>File: {previewDocument.document_name || previewDocument.name}</span>
              {previewDocument.created_at && (
                <span>Uploaded: {previewDocument.created_at.split('T')[0]}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DealDetailPage;
