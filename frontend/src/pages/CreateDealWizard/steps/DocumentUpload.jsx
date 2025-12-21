import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Upload, FileText, X, CheckCircle, Search, Building2, Layers } from 'lucide-react';
import { toast } from 'react-toastify';
import { useWizard, DEAL_TYPES } from '../WizardContext';
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
    dealType,
    setDealType,
  } = useWizard();

  const [isDragging, setIsDragging] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectionStep, setDetectionStep] = useState('');
  const [localDetectedFacilities, setLocalDetectedFacilities] = useState([]);
  const [confirmedFacilities, setConfirmedFacilities] = useState([]);
  const [showFacilityConfirmation, setShowFacilityConfirmation] = useState(false);

  // Single facility extraction results
  const [extractionFacilityMatches, setExtractionFacilityMatches] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [showExtractionMatches, setShowExtractionMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

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

  // ==========================================
  // Deal Type Selection
  // ==========================================

  const handleDealTypeSelect = (type) => {
    setDealType(type);
    if (type === DEAL_TYPES.SINGLE) {
      // Start single facility extraction immediately
      handleSingleFacilityExtract();
    }
    // Portfolio flow will show "Detect Facilities" button
  };

  // ==========================================
  // SINGLE FACILITY FLOW: Extract first, then show matches
  // ==========================================

  const handleSingleFacilityExtract = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one document');
      return;
    }

    setIsExtracting(true);
    setExtractionProgress(10);
    setDetectionStep('Extracting deal information...');

    try {
      console.log('[DocumentUpload] Starting SINGLE FACILITY extraction with', uploadedFiles.length, 'files');

      setExtractionProgress(30);
      const response = await extractDealEnhanced(uploadedFiles);

      console.log('[DocumentUpload] Extraction response:', response);
      setExtractionProgress(80);

      if (response.success && response.body?.extractedData) {
        const extracted = response.body.extractedData;

        // Store the full extraction result
        setExtractionResult({
          ...extracted,
          deal_overview: response.body.deal_overview || null,
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
          uploadedFiles: response.body.uploadedFiles || [],
        });

        // Check for facility matches in the extraction result
        const facilityMatches = extracted.overview?.facility_matches
          || response.body.deal_overview?.facility_matches;

        console.log('[DocumentUpload] Facility matches from extraction:', facilityMatches);

        if (facilityMatches && facilityMatches.matches && facilityMatches.matches.length > 0) {
          // We have matches - show confirmation UI
          setExtractionFacilityMatches(facilityMatches);
          setShowExtractionMatches(true);
          setExtractionProgress(100);
          toast.success(`Extraction complete! Found ${facilityMatches.matches.length} potential facility matches.`);
        } else {
          // No matches found - still proceed but inform user
          setExtractionFacilityMatches(null);
          setShowExtractionMatches(true);
          setExtractionProgress(100);
          toast.success('Extraction complete! No database matches found - you can proceed with extracted data.');
        }
      } else {
        console.warn('Extraction returned no data:', response);
        setExtractionProgress(100);
        toast.warning('Extraction completed but no data was found. You can proceed with manual entry.');
        // Allow proceeding even without data
        setShowExtractionMatches(true);
      }
    } catch (error) {
      console.error('[DocumentUpload] Extraction error:', error);
      setExtractionProgress(100);
      toast.error(error.message || 'Failed to extract data from documents');
    } finally {
      setIsExtracting(false);
      setDetectionStep('');
    }
  };

  const handleSelectExtractionMatch = (match) => {
    setSelectedMatch(match);
    toast.success(`Selected: ${match.facility_name}`);
  };

  const handleConfirmExtractionAndContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Build facility data from extraction + selected match
      const extracted = extractionResult || {};
      const match = selectedMatch;

      const facilityData = {
        facility_type: extracted.facility_type || match?.facility_type || 'SNF',
        facility_name: match?.facility_name || extracted.facility_name || '',
        address: match?.address || extracted.street_address || '',
        city: match?.city || extracted.city || '',
        state: match?.state || extracted.state || '',
        zip_code: match?.zip_code || extracted.zip_code || '',
        matched: match || null,
        matched_facility: match || null,
        match_source: match?.federal_provider_number ? 'snf_facilities' : (match ? 'alf_facilities' : null),
        user_confirmed: !!match,
      };

      // Set facility in wizard context
      setFacilitiesFromAI([facilityData]);

      // Apply full extraction data to wizard context
      applyExtractionData(extractionResult);

      // If we have a selected match, store it in extraction data
      if (match && extractionResult) {
        const updatedExtraction = {
          ...extractionResult,
          overview: {
            ...extractionResult.overview,
            facility_matches: {
              ...extractionResult.overview?.facility_matches,
              status: 'selected',
              selected_facility_id: match.facility_id,
              selected_match: match,
            },
          },
        };
        applyExtractionData(updatedExtraction);
      }

      setExtractionProgress(100);
      toast.success('Facility confirmed! Proceeding to next step...');
      goToNextStep();
    } catch (error) {
      console.error('[DocumentUpload] Error confirming extraction:', error);
      toast.error('Failed to process. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipMatchAndContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Build facility data from extraction only (no match)
      const extracted = extractionResult || {};

      const facilityData = {
        facility_type: extracted.facility_type || 'SNF',
        facility_name: extracted.facility_name || '',
        address: extracted.street_address || '',
        city: extracted.city || '',
        state: extracted.state || '',
        zip_code: extracted.zip_code || '',
        matched: null,
        matched_facility: null,
        match_source: null,
        user_confirmed: false,
      };

      // Set facility in wizard context
      setFacilitiesFromAI([facilityData]);

      // Apply extraction data to wizard context
      applyExtractionData(extractionResult);

      toast.success('Proceeding with extracted data...');
      goToNextStep();
    } catch (error) {
      console.error('[DocumentUpload] Error skipping match:', error);
      toast.error('Failed to process. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // PORTFOLIO FLOW: Detect facilities first
  // ==========================================

  const handleDetectFacilities = async () => {
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
        toast.warning('No facilities detected. You can add them manually or try single facility mode.');
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
        selected: true,
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

  const handleConfirmPortfolioAndContinue = async () => {
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
      matched_facility: f.matched,
      match_source: f.match_source,
      user_confirmed: f.user_confirmed,
      detected: f.detected,
    }));

    setFacilitiesFromAI(facilitiesForContext);
    setDetectedFacilities(selectedFacilities);

    // Start extraction indicator
    setIsExtracting(true);
    setExtractionProgress(10);

    console.log('[DocumentUpload] Starting PORTFOLIO extraction with', uploadedFiles.length, 'files');
    console.log('[DocumentUpload] Confirmed facilities:', selectedFacilities.map(f => f.detected?.name || f.matched?.facility_name));

    setExtractionProgress(20);
    toast.info(`Extracting portfolio data for ${selectedFacilities.length} facilities in background...`);

    const portfolioDealName = dealData?.deal_name
      || selectedFacilities[0]?.detected?.name
      || selectedFacilities[0]?.matched?.facility_name
      || 'Portfolio Deal';

    // Move to next step immediately
    goToNextStep();

    // Run portfolio extraction in background
    extractPortfolio(uploadedFiles, selectedFacilities, portfolioDealName)
      .then(response => {
        console.log('[DocumentUpload] Portfolio extraction response:', response);

        if (response.success && response.body?.deal) {
          const createdDeal = response.body.deal;
          console.log('[DocumentUpload] Portfolio deal created:', createdDeal.id);

          if (createdDeal.extraction_data) {
            applyExtractionData({
              ...createdDeal.extraction_data,
              deal_overview: createdDeal.extraction_data.deal_overview || null,
              _portfolioDealId: createdDeal.id,
            });
          }

          setExtractionProgress(100);
          toast.success(`Portfolio extraction complete! ${selectedFacilities.length} facilities processed.`);
        } else {
          console.error('[DocumentUpload] Portfolio extraction failed:', response.message);
          setExtractionProgress(100);
          toast.warning(response.message || 'Portfolio extraction completed with issues.');
        }
      })
      .catch(error => {
        console.error('[DocumentUpload] Portfolio extraction error:', error);
        setExtractionProgress(100);
        toast.warning('Portfolio extraction failed. You can proceed with manual entry.');
      })
      .finally(() => {
        setTimeout(() => {
          setIsExtracting(false);
        }, 500);
      });
  };

  const handleSkipToManual = () => {
    goToNextStep();
  };

  const handleBackToDealType = () => {
    setDealType(null);
    setShowExtractionMatches(false);
    setExtractionFacilityMatches(null);
    setExtractionResult(null);
    setSelectedMatch(null);
    setShowFacilityConfirmation(false);
    setLocalDetectedFacilities([]);
    setConfirmedFacilities([]);
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="step-container" style={{ maxWidth: '600px' }}>
      <h2 className="step-title">Upload Documents</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Upload your deal documents (CIM, P&L, Census, etc.) and we'll extract the information.
      </p>

      {/* Upload Zone - show when no deal type selected yet OR when in portfolio detection mode */}
      {!dealType && !showFacilityConfirmation && !showExtractionMatches && (
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

          {/* Deal Type Selector - show after files uploaded */}
          {uploadedFiles.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontWeight: '500', color: '#1e293b', marginBottom: '12px', fontSize: '14px' }}>
                What type of deal is this?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleDealTypeSelect(DEAL_TYPES.SINGLE)}
                  disabled={isExtracting}
                  style={{
                    padding: '16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: isExtracting ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: isExtracting ? 0.6 : 1,
                  }}
                  onMouseOver={(e) => !isExtracting && (e.currentTarget.style.borderColor = '#7c3aed')}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <Building2 size={24} style={{ color: '#7c3aed', marginBottom: '8px' }} />
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>Single Facility</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    One facility in this deal
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDealTypeSelect(DEAL_TYPES.PORTFOLIO)}
                  disabled={isExtracting}
                  style={{
                    padding: '16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: isExtracting ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: isExtracting ? 0.6 : 1,
                  }}
                  onMouseOver={(e) => !isExtracting && (e.currentTarget.style.borderColor = '#7c3aed')}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <Layers size={24} style={{ color: '#7c3aed', marginBottom: '8px' }} />
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>Portfolio</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Multiple facilities in this deal
                  </div>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Single Facility: Extraction in Progress */}
      {dealType === DEAL_TYPES.SINGLE && isExtracting && !showExtractionMatches && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="extraction-progress-spinner" style={{ marginBottom: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>Extracting Deal Information...</h3>
          <p style={{ color: '#64748b', fontSize: '14px' }}>{detectionStep}</p>
        </div>
      )}

      {/* Single Facility: Show Extraction Results & Matches */}
      {dealType === DEAL_TYPES.SINGLE && showExtractionMatches && (
        <div>
          {/* Extraction Summary */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle size={20} style={{ color: '#22c55e' }} />
              <span style={{ fontWeight: '600', color: '#166534' }}>Extraction Complete</span>
            </div>
            <div style={{ fontSize: '14px', color: '#15803d' }}>
              {extractionResult?.facility_name && (
                <div>Facility: <strong>{extractionResult.facility_name}</strong></div>
              )}
              {extractionResult?.city && extractionResult?.state && (
                <div>Location: {extractionResult.city}, {extractionResult.state}</div>
              )}
              {extractionResult?.purchase_price && (
                <div>Purchase Price: ${Number(extractionResult.purchase_price).toLocaleString()}</div>
              )}
            </div>
          </div>

          {/* Facility Matches from Extraction */}
          {extractionFacilityMatches?.matches?.length > 0 ? (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                <Building2 size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Confirm Facility Match
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                We found {extractionFacilityMatches.matches.length} potential matches in our database.
                Select one to enrich your deal with additional data.
              </p>

              {extractionFacilityMatches.matches.map((match, idx) => (
                <div
                  key={match.facility_id || idx}
                  onClick={() => handleSelectExtractionMatch(match)}
                  style={{
                    padding: '12px 16px',
                    border: selectedMatch?.facility_id === match.facility_id
                      ? '2px solid #7c3aed'
                      : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: selectedMatch?.facility_id === match.facility_id ? '#f5f3ff' : 'white',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{match.facility_name}</div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {match.city}, {match.state} {match.zip_code}
                      </div>
                      {match.capacity && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {match.capacity} beds
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: match.match_confidence === 'high' ? '#dcfce7' :
                                  match.match_confidence === 'medium' ? '#fef9c3' : '#f3f4f6',
                      color: match.match_confidence === 'high' ? '#166534' :
                             match.match_confidence === 'medium' ? '#854d0e' : '#4b5563',
                    }}>
                      {Math.round((match.match_score || 0) * 100)}% match
                    </div>
                  </div>
                  {selectedMatch?.facility_id === match.facility_id && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', color: '#7c3aed', fontSize: '13px' }}>
                      <CheckCircle size={14} />
                      Selected
                    </div>
                  )}
                </div>
              ))}

              {/* Action Buttons */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleConfirmExtractionAndContinue}
                  disabled={!selectedMatch || isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Confirm & Continue'}
                  <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                </button>
              </div>
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
                onClick={handleSkipMatchAndContinue}
                disabled={isSubmitting}
              >
                Skip matching, use extracted data only
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
                  No database matches found for this facility. You can proceed with the extracted data.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSkipMatchAndContinue}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Continue with Extracted Data'}
                <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          )}

          <button
            type="button"
            style={{
              width: '100%',
              textAlign: 'center',
              marginTop: '16px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            onClick={handleBackToDealType}
          >
            ← Back to deal type selection
          </button>
        </div>
      )}

      {/* Portfolio: Detection in Progress */}
      {dealType === DEAL_TYPES.PORTFOLIO && isDetecting && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="extraction-progress-spinner" style={{ marginBottom: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>Detecting Facilities...</h3>
          <p style={{ color: '#64748b', fontSize: '14px' }}>{detectionStep}</p>
        </div>
      )}

      {/* Portfolio: Detect Button */}
      {dealType === DEAL_TYPES.PORTFOLIO && !isDetecting && !showFacilityConfirmation && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Layers size={48} style={{ color: '#7c3aed', marginBottom: '16px' }} />
          <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>Portfolio Deal</h3>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            We'll detect all facilities in your documents and let you confirm them.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ justifyContent: 'center' }}
            onClick={handleDetectFacilities}
          >
            <Search size={16} style={{ marginRight: '8px' }} />
            Detect Facilities
          </button>
          <button
            type="button"
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              marginTop: '16px',
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            onClick={handleBackToDealType}
          >
            ← Back to deal type selection
          </button>
        </div>
      )}

      {/* Portfolio: Facility Confirmation */}
      {dealType === DEAL_TYPES.PORTFOLIO && showFacilityConfirmation && (
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
            onClick={handleConfirmPortfolioAndContinue}
            disabled={isSubmitting || isExtracting}
          >
            {isSubmitting || isExtracting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Creating Portfolio Deal...
              </>
            ) : (
              <>
                Confirm & Continue
                <ArrowRight size={16} style={{ marginLeft: '8px' }} />
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
            ← Back to detection
          </button>
        </div>
      )}

      {/* Navigation - only show when in initial upload state */}
      {!dealType && !showFacilityConfirmation && !showExtractionMatches && (
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
