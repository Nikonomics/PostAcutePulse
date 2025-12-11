import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit3,
  Save,
} from "lucide-react";
import { toast } from "react-toastify";
import { extractDealEnhanced, createBatchDeals, addDealDocument, getFacilityMatches, selectFacilityMatch } from "../api/DealService";
import { getActiveUsers } from "../api/authService";
import FacilityMatchModal from "../components/FacilityMatchModal";

// Field display configuration
const FIELD_GROUPS = {
  "Basic Information": [
    { key: "deal_name", label: "Deal Name", type: "text" },
    { key: "deal_type", label: "Deal Type", type: "select", options: ["Acquisition", "Sale-Leaseback", "Merger", "Joint Venture", "Other"] },
    { key: "facility_name", label: "Facility Name", type: "text" },
    { key: "facility_type", label: "Facility Type", type: "select", options: ["SNF", "Assisted Living", "Memory Care", "Independent Living", "CCRC", "Rehabilitation", "Other"] },
    { key: "bed_count", label: "Number of Beds", type: "number" },
    { key: "deal_source", label: "Deal Source", type: "select", options: ["Broker", "Direct", "Referral", "Cold Call", "Other"] },
    { key: "priority_level", label: "Priority", type: "select", options: ["high", "medium", "low"] },
  ],
  "Location": [
    { key: "street_address", label: "Street Address", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "zip_code", label: "ZIP Code", type: "text" },
    { key: "country", label: "Country", type: "text" },
  ],
  "Contact Information": [
    { key: "primary_contact_name", label: "Contact Name", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "phone_number", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "email" },
  ],
  "Financial Metrics": [
    { key: "purchase_price", label: "Purchase Price", type: "currency" },
    { key: "annual_revenue", label: "Annual Revenue", type: "currency" },
    { key: "ebitda", label: "EBITDA", type: "currency" },
    { key: "ebitda_margin", label: "EBITDA Margin (%)", type: "percentage" },
    { key: "net_operating_income", label: "Net Operating Income", type: "currency" },
    { key: "price_per_bed", label: "Price per Bed", type: "currency" },
    { key: "revenue_multiple", label: "Revenue Multiple", type: "number" },
    { key: "ebitda_multiple", label: "EBITDA Multiple", type: "number" },
  ],
  "Operational Metrics": [
    { key: "current_occupancy", label: "Occupancy (%)", type: "percentage" },
    { key: "average_daily_rate", label: "Average Daily Rate", type: "currency" },
    { key: "medicare_percentage", label: "Medicare Mix (%)", type: "percentage" },
    { key: "private_pay_percentage", label: "Private Pay (%)", type: "percentage" },
  ],
  "Investment Metrics": [
    { key: "target_irr_percentage", label: "Target IRR (%)", type: "percentage" },
    { key: "projected_cap_rate_percentage", label: "Cap Rate (%)", type: "percentage" },
    { key: "target_hold_period", label: "Hold Period (years)", type: "number" },
  ],
};

const UploadDeal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [editingField, setEditingField] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [uploadedFileInfo, setUploadedFileInfo] = useState([]);
  // Enhanced extraction data
  const [enhancedData, setEnhancedData] = useState(null);
  // Facility matching modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [facilityMatches, setFacilityMatches] = useState([]);
  const [matchSearchName, setMatchSearchName] = useState('');
  const [createdDealId, setCreatedDealId] = useState(null);

  // Check if we have pre-extracted data from Deals page
  useEffect(() => {
    if (location.state?.extractedData) {
      setExtractedData(location.state.extractedData);
      setConfidence(location.state.confidence || 0);
      if (location.state.uploadedFiles) {
        setUploadedFileInfo(location.state.uploadedFiles);
      }
    }
  }, [location.state]);

  // Load active users for deal lead selection
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await getActiveUsers();
        if (response.code === 200) {
          setActiveUsers(response.body || []);
        }
      } catch (error) {
        console.error("Error loading users:", error);
      }
    };
    loadUsers();
  }, []);

  // Handle drag events
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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
    addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles) => {
    // Filter valid file types
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    const validFiles = newFiles.filter((file) => {
      if (!validTypes.includes(file.type) && !file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a supported file type`);
        return false;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 20MB limit`);
        return false;
      }
      return true;
    });

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
    e.target.value = ""; // Reset input
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one document");
      return;
    }

    setIsExtracting(true);

    try {
      const response = await extractDealEnhanced(files);

      if (response.success) {
        // Set flat extracted data for backward compatibility
        setExtractedData(response.body.extractedData);

        // Store the full enhanced data (time-series, ratios, etc.)
        setEnhancedData({
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
        });

        // Calculate confidence based on extraction metadata
        const successRate = response.body.metadata?.successCount || 5;
        const calculatedConfidence = Math.round((successRate / 5) * 100);
        setConfidence(calculatedConfidence);

        // Store uploaded file info for linking to deal later
        if (response.body.uploadedFiles) {
          setUploadedFileInfo(response.body.uploadedFiles);
        }

        const duration = response.body.metadata?.totalDuration
          ? `${(response.body.metadata.totalDuration / 1000).toFixed(1)}s`
          : '';
        toast.success(`Data extracted successfully${duration ? ` in ${duration}` : ''}`);
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

  const handleFieldChange = (key, value) => {
    setExtractedData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const formatValue = (value, type) => {
    if (value === null || value === undefined || value === "") return "—";

    switch (type) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value);
      case "percentage":
        return `${value}%`;
      case "number":
        return new Intl.NumberFormat("en-US").format(value);
      default:
        return value;
    }
  };

  const handleSave = async () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 UPLOADDEAL.JSX v2.0 - FACILITY MATCHING REVIEW ENABLED');
    console.log('═══════════════════════════════════════════════════════════');

    if (!extractedData) return;

    // Validate required fields
    if (!extractedData.deal_name) {
      toast.error("Deal name is required");
      return;
    }

    setIsSaving(true);

    try {
      // Prepare the deal data for the API
      const dealPayload = {
        address: {
          street_address: extractedData.street_address || "",
          city: extractedData.city || "",
          state: extractedData.state || "",
          zip_code: extractedData.zip_code || "",
          country: extractedData.country || "USA",
        },
        deals: [
          {
            deal_name: extractedData.deal_name,
            deal_type: extractedData.deal_type || "Acquisition",
            facility_name: extractedData.facility_name || extractedData.deal_name,
            facility_type: extractedData.facility_type || "SNF",
            bed_count: extractedData.bed_count || 0,
            deal_status: "pipeline",
            priority_level: extractedData.priority_level || "medium",
            deal_source: extractedData.deal_source || "",
            primary_contact_name: extractedData.primary_contact_name || "",
            title: extractedData.title || "",
            phone_number: extractedData.phone_number || "",
            email: extractedData.email || "",
            purchase_price: extractedData.purchase_price || 0,
            annual_revenue: extractedData.annual_revenue || 0,
            ebitda: extractedData.ebitda || 0,
            ebitda_margin: extractedData.ebitda_margin || 0,
            net_operating_income: extractedData.net_operating_income || 0,
            current_occupancy: extractedData.current_occupancy || 0,
            average_daily_rate: extractedData.average_daily_rate || 0,
            medicare_percentage: extractedData.medicare_percentage || 0,
            private_pay_percentage: extractedData.private_pay_percentage || 0,
            price_per_bed: extractedData.price_per_bed || 0,
            revenue_multiple: extractedData.revenue_multiple || 0,
            ebitda_multiple: extractedData.ebitda_multiple || 0,
            target_irr_percentage: extractedData.target_irr_percentage || 0,
            projected_cap_rate_percentage: extractedData.projected_cap_rate_percentage || 0,
            target_hold_period: extractedData.target_hold_period || 0,
            deal_lead_id: activeUsers[0]?.id || 1,
            // Default notification settings for AI-extracted deals
            notificationSettings: {
              email_notification_major_updates: true,
              document_upload_notification: true,
            },
          },
        ],
        // Include raw extraction data for Deal Analyzer view
        extraction_data: {
          ...extractedData,
          extraction_timestamp: new Date().toISOString(),
          confidence: confidence,
          // Include enhanced extraction data for time-series storage
          ...(enhancedData && {
            monthly_financials: enhancedData.monthlyFinancials,
            monthly_census: enhancedData.monthlyCensus,
            monthly_expenses: enhancedData.monthlyExpenses,
            rates: enhancedData.rates,
            ttm_financials: enhancedData.ttmFinancials,
            census_summary: enhancedData.censusSummary,
            expenses_by_department: enhancedData.expensesByDepartment,
            ratios: enhancedData.ratios,
            benchmark_flags: enhancedData.benchmarkFlags,
            potential_savings: enhancedData.potentialSavings,
            insights: enhancedData.insights,
          }),
        },
        // Include uploaded documents
        documents: uploadedFileInfo,
      };

      const response = await createBatchDeals(dealPayload);

      if (response.success || response.code === 200) {
        // Link uploaded documents to the created deal
        const createdDealId = response.body?.dealData?.[0]?.id;
        if (createdDealId && uploadedFileInfo.length > 0) {
          // Add each uploaded file as a deal document
          for (const fileInfo of uploadedFileInfo) {
            try {
              await addDealDocument({
                deal_id: createdDealId,
                document_url: fileInfo.url,
                document_name: fileInfo.originalName,
              });
            } catch (docError) {
              console.error("Error adding document:", docError);
            }
          }
        }

        toast.success("Deal created successfully!");

        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 CHECKING FOR FACILITY MATCHES (NEW CODE)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');

        // MANDATORY: Check for facility matches that need review
        if (createdDealId) {
          console.log(`[UploadDeal] ✅ Created deal ID: ${createdDealId}`);
          console.log(`[UploadDeal] Fetching facility matches from API...`);

          try {
            const matchesResponse = await getFacilityMatches(createdDealId);
            console.log('[UploadDeal] Facility matches response:', matchesResponse);

            if (matchesResponse.code === 200 && matchesResponse.body) {
              const matchData = matchesResponse.body;
              console.log('[UploadDeal] Match data status:', matchData.status);
              console.log('[UploadDeal] Number of matches:', matchData.matches?.length || 0);

              // Show modal if there are matches pending review
              if (matchData.status === 'pending_review' && matchData.matches && matchData.matches.length > 0) {
                console.log(`[UploadDeal] ✅ SHOWING MODAL with ${matchData.matches.length} matches`);
                setCreatedDealId(createdDealId);
                setFacilityMatches(matchData.matches);
                setMatchSearchName(matchData.search_name || 'this facility');
                setShowMatchModal(true);
                return; // CRITICAL: Don't navigate yet - wait for user to review matches
              } else {
                console.log('[UploadDeal] No matches found or already reviewed - navigating to deals');
              }
            } else {
              console.warn('[UploadDeal] Unexpected response code:', matchesResponse.code);
            }
          } catch (matchError) {
            console.error("[UploadDeal] Error fetching facility matches:", matchError);
            console.error("[UploadDeal] Error details:", matchError.message);
            // Continue to navigate on error (don't block user)
          }
        } else {
          console.warn('[UploadDeal] No createdDealId - cannot check facility matches');
        }

        // No matches to review, already reviewed, or error occurred - navigate to deals
        console.log('[UploadDeal] Navigating to /deals');
        navigate("/deals");
      } else {
        toast.error(response.message || "Failed to create deal");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save deal");
    } finally {
      setIsSaving(false);
    }
  };

  // Facility match modal handlers
  const handleSelectFacilityMatch = async (facilityId) => {
    try {
      const response = await selectFacilityMatch(createdDealId, {
        facility_id: facilityId,
        action: 'select'
      });

      if (response.code === 200) {
        toast.success("Facility data applied successfully!");
        setShowMatchModal(false);
        navigate("/deals");
      } else {
        toast.error(response.message || "Failed to apply facility match");
      }
    } catch (error) {
      console.error("Error selecting facility match:", error);
      toast.error(error.message || "Failed to apply facility match");
    }
  };

  const handleSkipFacilityMatch = async () => {
    try {
      await selectFacilityMatch(createdDealId, {
        action: 'skip'
      });
      setShowMatchModal(false);
      navigate("/deals");
    } catch (error) {
      console.error("Error skipping facility match:", error);
      // Navigate anyway
      setShowMatchModal(false);
      navigate("/deals");
    }
  };

  const handleNotSureFacilityMatch = async () => {
    try {
      await selectFacilityMatch(createdDealId, {
        action: 'not_sure'
      });
      setShowMatchModal(false);
      navigate("/deals");
    } catch (error) {
      console.error("Error marking facility match as not sure:", error);
      // Navigate anyway
      setShowMatchModal(false);
      navigate("/deals");
    }
  };

  const renderField = (field) => {
    const value = extractedData?.[field.key];
    const isEditing = editingField === field.key;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {field.type === "select" ? (
            <select
              value={value || ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "currency" || field.type === "percentage" ? "number" : field.type}
              value={value || ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          )}
          <button
            onClick={() => setEditingField(null)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
          >
            <CheckCircle size={18} />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between group">
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {formatValue(value, field.type)}
        </span>
        <button
          onClick={() => setEditingField(field.key)}
          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit3 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/deals/create")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Document Upload</h1>
            <p className="text-gray-600">
              Upload documents and let AI extract deal information
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          {/* Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-purple-500 bg-purple-50"
                : "border-gray-300 hover:border-purple-400 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload
              className={`w-12 h-12 mx-auto mb-4 ${
                isDragging ? "text-purple-500" : "text-gray-400"
              }`}
            />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse
            </p>
            <p className="text-xs text-gray-400">
              PDF, Images, Excel, CSV (max 20MB per file)
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                Uploaded Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Extract Button */}
              <button
                onClick={handleExtract}
                disabled={isExtracting || files.length === 0}
                className={`w-full mt-4 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  isExtracting
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 text-white hover:bg-purple-700"
                }`}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Extracting with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Extract Deal Information
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Extracted Data Review Section */}
        <div className="space-y-6">
          {extractedData ? (
            <>
              {/* Confidence Score */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Extraction Confidence
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      confidence >= 70
                        ? "text-green-600"
                        : confidence >= 40
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {confidence}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      confidence >= 70
                        ? "bg-green-500"
                        : confidence >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {confidence >= 70
                    ? "High confidence - review and save"
                    : confidence >= 40
                    ? "Medium confidence - please verify key fields"
                    : "Low confidence - manual review recommended"}
                </p>
              </div>

              {/* Field Groups */}
              <div className="space-y-4">
                {Object.entries(FIELD_GROUPS).map(([groupName, fields]) => (
                  <div
                    key={groupName}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">{groupName}</h3>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 gap-4">
                        {fields.map((field) => (
                          <div key={field.key} className="flex justify-between items-start">
                            <label className="text-sm text-gray-600 min-w-[140px]">
                              {field.label}
                            </label>
                            <div className="flex-1 ml-4">{renderField(field)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full py-4 px-6 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  isSaving
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving Deal...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Deal
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Data Extracted Yet
              </h3>
              <p className="text-gray-500">
                Upload documents and click "Extract Deal Information" to see extracted data here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Facility Match Review Modal */}
      <FacilityMatchModal
        open={showMatchModal}
        matches={facilityMatches}
        searchName={matchSearchName}
        onSelect={handleSelectFacilityMatch}
        onSkip={handleSkipFacilityMatch}
        onNotSure={handleNotSureFacilityMatch}
      />
    </div>
  );
};

export default UploadDeal;
