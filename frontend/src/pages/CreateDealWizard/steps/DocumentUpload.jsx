import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Upload, FileText, X, CheckCircle, Search, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useWizard } from '../WizardContext';
import {
  extractDocumentText,
  detectFacilities,
  batchMatchFacilities,
  extractDealEnhanced,
  extractPortfolio,
} from '../../../api/DealService';
import { useNavigate } from 'react-router-dom';

const DocumentUpload = () => {
  const navigate = useNavigate();
  const {
    uploadedFiles,
    setUploadedFiles,
    isExtracting,
    setIsExtracting,
    setExtractionProgress,
    setDetectedFacilities,
    setFacilitiesFromAI,
    applyExtractionData,
    goToNextStep,
    goToPreviousStep,
    dealData,
  } = useWizard();

  const [isDragging, setIsDragging] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-clicks
  const [detectionStep, setDetectionStep] = useState('');
  const [localDetectedFacilities, setLocalDetectedFacilities] = useState([]);
  const [confirmedFacilities, setConfirmedFacilities] = useState([]);
  const [showFacilityConfirmation, setShowFacilityConfirmation] = useState(false);
  const fileInputRef = useRef(null);

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
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword'
    );

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    } else {
      toast.error('Please upload PDF, image, Excel, or Word files');
    }
  }, [setUploadedFiles]);

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...selectedFiles]);
    }
    e.target.value = '';
  }, [setUploadedFiles]);

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAnalyzeDocuments = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one document');
      return;
    }

    setIsDetecting(true);
    setDetectionStep('Reading documents...');

    try {
      // Step 1: Extract text from documents
      const textResponse = await extractDocumentText(uploadedFiles);

      if (!textResponse.success || !textResponse.body?.combined_text) {
        throw new Error('Failed to extract text from documents');
      }

      const documentText = textResponse.body.combined_text;
      console.log(`[DocumentUpload] Extracted ${textResponse.body.total_characters} characters`);

      // Step 2: Detect facilities
      setDetectionStep('Detecting facilities...');
      const detectResponse = await detectFacilities(documentText, ['SNF', 'ALF', 'ILF']);

      if (!detectResponse.success) {
        throw new Error(detectResponse.message || 'Failed to detect facilities');
      }

      const detected = detectResponse.body?.detected_facilities || [];
      console.log(`[DocumentUpload] Detected ${detected.length} facilities`);

      if (detected.length === 0) {
        toast.warning('No facilities detected. You can proceed to enter facility information manually.');
        setShowFacilityConfirmation(false);
        setLocalDetectedFacilities([]);
        setIsDetecting(false);
        setDetectionStep('');
        return;
      }

      // Step 3: Match facilities against database
      setDetectionStep(`Matching ${detected.length} facilities to database...`);
      const matchResults = await batchMatchFacilities(detected);

      // Build confirmed facilities list
      const facilitiesWithMatches = matchResults.map((result, index) => ({
        id: `facility-${Date.now()}-${index}`,
        detected: result.detected,
        matched: result.matches?.[0] || null,
        match_source: result.matches?.[0]?.federal_provider_number ? 'snf_facilities' : 'alf_facilities',
        matchCandidates: result.matches || [],
        best_match_confidence: result.best_match_confidence || 'none',
        selected: true, // Default to selected
        user_confirmed: false,
      }));

      setLocalDetectedFacilities(facilitiesWithMatches);
      setConfirmedFacilities(facilitiesWithMatches);
      setShowFacilityConfirmation(true);
      toast.success(`Detected ${detected.length} facilities. Please confirm below.`);

    } catch (error) {
      console.error('Document analysis error:', error);
      toast.error(error.message || 'Failed to analyze documents');
    } finally {
      setIsDetecting(false);
      setDetectionStep('');
    }
  };

  const handleToggleFacility = (facilityId) => {
    setConfirmedFacilities(prev =>
      prev.map(f =>
        f.id === facilityId ? { ...f, selected: !f.selected } : f
      )
    );
  };

  const handleSelectMatch = (facilityId, match) => {
    setConfirmedFacilities(prev =>
      prev.map(f =>
        f.id === facilityId
          ? {
              ...f,
              matched: match,
              match_source: match.federal_provider_number ? 'snf_facilities' : 'alf_facilities',
              user_confirmed: true,
            }
          : f
      )
    );
    toast.success(`Selected match for ${match.facility_name}`);
  };

  const handleConfirmAndContinue = async () => {
    // Prevent double-clicks
    if (isSubmitting || isExtracting) {
      console.log('[DocumentUpload] Already submitting/extracting, ignoring click');
      return;
    }

    const selectedFacilities = confirmedFacilities.filter(f => f.selected);

    if (selectedFacilities.length === 0) {
      toast.error('Please select at least one facility');
      return;
    }

    setIsSubmitting(true);

    // Set facilities in wizard context
    const facilitiesForContext = selectedFacilities.map(f => ({
      facility_type: f.detected?.facility_type || 'SNF',
      facility_name: f.matched?.facility_name || f.detected?.name || '',
      address: f.matched?.address || f.detected?.address || '',
      city: f.matched?.city || f.detected?.city || '',
      state: f.matched?.state || f.detected?.state || '',
      zip_code: f.matched?.zip_code || f.detected?.zip || '',
      matched: f.matched,
      matched_facility: f.matched, // Also include as matched_facility for CreateDealWizard.jsx
      match_source: f.match_source,
      user_confirmed: f.user_confirmed,
      detected: f.detected,
    }));

    setFacilitiesFromAI(facilitiesForContext);
    setDetectedFacilities(selectedFacilities);

    // Start extraction indicator
    setIsExtracting(true);
    setExtractionProgress(10);

    // BRANCHING LOGIC: Single facility vs Portfolio (2+ facilities)
    const isPortfolio = selectedFacilities.length > 1;

    console.log(`[DocumentUpload] ${isPortfolio ? 'PORTFOLIO' : 'SINGLE FACILITY'} extraction mode`);
    console.log(`[DocumentUpload] Selected facilities: ${selectedFacilities.length}`);

    if (isPortfolio) {
      // === PORTFOLIO PATH: Use extract-portfolio which creates deal directly ===
      try {
        console.log('[DocumentUpload] Starting PORTFOLIO extraction with', uploadedFiles.length, 'files');
        console.log('[DocumentUpload] Confirmed facilities:', selectedFacilities.map(f => f.detected?.name || f.matched?.facility_name));

        setExtractionProgress(20);
        toast.info(`Extracting portfolio data for ${selectedFacilities.length} facilities...`);

        // Use deal name from wizard context, or generate from first facility name
        const portfolioDealName = dealData?.deal_name
          || selectedFacilities[0]?.detected?.name
          || selectedFacilities[0]?.matched?.facility_name
          || 'Portfolio Deal';

        const response = await extractPortfolio(uploadedFiles, selectedFacilities, portfolioDealName);
        console.log('[DocumentUpload] Portfolio extraction response:', response);

        if (response.success && response.body?.deal) {
          const createdDeal = response.body.deal;
          console.log('[DocumentUpload] Portfolio deal created:', createdDeal.id);
          console.log('[DocumentUpload] Deal extraction_data keys:', Object.keys(createdDeal.extraction_data || {}));

          setExtractionProgress(100);
          setIsExtracting(false);
          toast.success(`Portfolio deal created with ${selectedFacilities.length} facilities!`);

          // Navigate directly to the created deal detail page
          navigate(`/deals/deal-detail/${createdDeal.id}`);
          return; // Exit - don't continue wizard flow
        } else {
          console.error('[DocumentUpload] Portfolio extraction failed:', response.message);
          toast.error(response.message || 'Portfolio extraction failed');
          setIsExtracting(false);
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        console.error('[DocumentUpload] Portfolio extraction error:', error);
        toast.error(error.message || 'Failed to extract portfolio');
        setIsExtracting(false);
        setIsSubmitting(false);
        return;
      }
    }

    // === SINGLE FACILITY PATH: Continue with wizard flow ===
    // Move to next step immediately so user can fill in deal basics while extraction runs
    goToNextStep();

    // Run actual AI extraction in background
    try {
      console.log('[DocumentUpload] Starting SINGLE FACILITY extraction with', uploadedFiles.length, 'files');
      console.log('[DocumentUpload] Files:', uploadedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));

      const response = await extractDealEnhanced(uploadedFiles);
      console.log('[DocumentUpload] Extraction API response:', response);

      if (response.success && response.body?.extractedData) {
        const extracted = response.body.extractedData;

        // === EXTRACTION RESULT LOGGING ===
        console.log('=== EXTRACTION RESULT ===');
        console.log('response.body keys:', Object.keys(response.body));
        console.log('extractedData:', JSON.stringify(extracted, null, 2));
        console.log('monthlyFinancials count:', response.body.monthlyFinancials?.length || 0);
        console.log('monthlyCensus count:', response.body.monthlyCensus?.length || 0);
        console.log('monthlyExpenses count:', response.body.monthlyExpenses?.length || 0);
        console.log('ttmFinancials:', response.body.ttmFinancials);
        console.log('censusSummary:', response.body.censusSummary);
        console.log('ratios:', response.body.ratios);
        console.log('benchmarkFlags:', response.body.benchmarkFlags);
        console.log('potentialSavings:', response.body.potentialSavings);
        console.log('insights:', response.body.insights);
        console.log('expensesByDepartment:', response.body.expensesByDepartment);
        // deal_overview is at response.body level, not inside extractedData
        console.log('deal_overview:', response.body.deal_overview ? 'present' : 'missing');
        if (response.body.deal_overview) {
          console.log('deal_overview keys:', Object.keys(response.body.deal_overview));
        }
        console.log('uploadedFiles:', response.body.uploadedFiles);
        console.log('=== END EXTRACTION ===');

        // Apply extraction data to wizard context - capture ALL fields like UploadDeal.jsx
        applyExtractionData({
          ...extracted,
          // Deal overview for the Deal Overview tab (returned at response.body level)
          deal_overview: response.body.deal_overview || null,
          // Include enhanced time-series data
          monthlyFinancials: response.body.monthlyFinancials || [],
          monthlyCensus: response.body.monthlyCensus || [],
          monthlyExpenses: response.body.monthlyExpenses || [],
          rates: response.body.rates || {},
          ttmFinancials: response.body.ttmFinancials || null,
          censusSummary: response.body.censusSummary || null,
          // Additional fields that were missing (matching UploadDeal.jsx)
          expensesByDepartment: response.body.expensesByDepartment || {},
          ratios: response.body.ratios || {},
          benchmarkFlags: response.body.benchmarkFlags || {},
          potentialSavings: response.body.potentialSavings || {},
          insights: response.body.insights || [],
          facility: response.body.facility || {},
          metadata: response.body.metadata || {},
          // File info
          uploadedFiles: response.body.uploadedFiles || [],
        });

        setExtractionProgress(100);
        toast.success('Document analysis complete!');
      } else {
        console.warn('Extraction returned no data:', response);
        // Still set progress to 100 so user can proceed, but warn them
        setExtractionProgress(100);
        toast.warning('Document analysis completed but no financial data was extracted. You can proceed with manual entry.');
      }
    } catch (error) {
      console.error('[DocumentUpload] Background extraction error:', error);
      console.error('[DocumentUpload] Error details:', error.response?.data || error.message);
      // Set progress to 100 so user can proceed, but warn them
      setExtractionProgress(100);
      toast.warning('Document analysis failed. You can proceed with manual entry.');
    } finally {
      setTimeout(() => {
        setIsExtracting(false);
      }, 500);
    }
  };

  const handleSkipToManual = () => {
    // User wants to skip facility detection and enter manually
    // Just proceed to Deal Basics, facilities will be empty
    goToNextStep();
  };

  return (
    <div className="step-container" style={{ maxWidth: '600px' }}>
      <h2 className="step-title">Upload Documents</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Upload your deal documents (CIM, P&L, Census, etc.) and we'll automatically detect facilities.
      </p>

      {/* Upload Zone */}
      {!showFacilityConfirmation && (
        <>
          <div
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div className="upload-zone-icon">
              <Upload size={28} />
            </div>
            <div className="upload-zone-title">
              {isDragging ? 'Drop files here' : 'Drag and drop files here'}
            </div>
            <div className="upload-zone-subtitle">or click to browse</div>
            <div className="upload-zone-formats">
              Supports PDF, images, Excel, and Word documents
            </div>
          </div>

          {/* File List */}
          {uploadedFiles.length > 0 && (
            <div className="file-list">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-item-info">
                    <FileText size={20} className="file-item-icon" />
                    <div>
                      <div className="file-item-name">{file.name}</div>
                      <div className="file-item-size">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="file-item-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Analyze Button */}
          {uploadedFiles.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
              onClick={handleAnalyzeDocuments}
              disabled={isDetecting}
            >
              {isDetecting ? (
                <>
                  <span className="extraction-progress-spinner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </span>
                  {detectionStep}
                </>
              ) : (
                <>
                  <Search size={16} />
                  Analyze Documents
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* Facility Confirmation */}
      {showFacilityConfirmation && (
        <div className="detected-facilities">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>
            <Building2 size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Detected Facilities ({confirmedFacilities.filter(f => f.selected).length} selected)
          </h3>

          {confirmedFacilities.map((facility) => (
            <div
              key={facility.id}
              className={`detected-facility-item ${facility.selected ? 'confirmed' : ''}`}
            >
              <input
                type="checkbox"
                className="detected-facility-checkbox"
                checked={facility.selected}
                onChange={() => handleToggleFacility(facility.id)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div className="detected-facility-info">
                <div className="detected-facility-name">
                  {facility.matched?.facility_name || facility.detected?.name || 'Unknown Facility'}
                  <span className="detected-facility-type">
                    {facility.detected?.facility_type || 'Unknown'}
                  </span>
                </div>
                <div className="detected-facility-location">
                  {facility.matched?.city || facility.detected?.city}, {facility.matched?.state || facility.detected?.state}
                  {facility.detected?.beds && ` | ${facility.detected.beds} beds`}
                </div>
                {facility.matched && (
                  <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={12} />
                    Matched to database
                  </div>
                )}
                {!facility.matched && facility.matchCandidates.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '4px' }}>
                      {facility.matchCandidates.length} potential match(es) found
                    </div>
                    {facility.matchCandidates.slice(0, 2).map((match, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectMatch(facility.id, match)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px',
                          marginTop: '4px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        {match.facility_name} - {match.city}, {match.state}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
            onClick={handleConfirmAndContinue}
            disabled={isSubmitting || isExtracting}
          >
            {isSubmitting || isExtracting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {confirmedFacilities.filter(f => f.selected).length > 1
                  ? 'Creating Portfolio Deal...'
                  : 'Processing...'}
              </>
            ) : (
              <>
                Confirm & Continue
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            style={{
              width: '100%',
              textAlign: 'center',
              marginTop: '12px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            onClick={() => {
              setShowFacilityConfirmation(false);
              setLocalDetectedFacilities([]);
              setConfirmedFacilities([]);
            }}
          >
            ← Back to upload
          </button>
        </div>
      )}

      {/* Navigation */}
      {!showFacilityConfirmation && (
        <div className="step-navigation">
          <button className="btn btn-secondary" onClick={goToPreviousStep}>
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSkipToManual}
            style={{ marginLeft: 'auto' }}
          >
            Skip, enter manually
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
