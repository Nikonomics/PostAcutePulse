import React, { createContext, useContext, useState, useCallback } from 'react';

const WizardContext = createContext(null);

export const WIZARD_PATHS = {
  MANUAL: 'manual',
  AI: 'ai',
};

export const WIZARD_STEPS = {
  PATH_SELECT: 'path_select',
  DOCUMENT_UPLOAD: 'document_upload', // AI path only
  DEAL_BASICS: 'deal_basics',
  FACILITY_ENTRY: 'facility_entry', // Manual path only
  DEAL_INFO: 'deal_info',
  TEAM_TIMELINE: 'team_timeline',
};

// Step order for each path
export const MANUAL_STEPS = [
  WIZARD_STEPS.PATH_SELECT,
  WIZARD_STEPS.DEAL_BASICS,
  WIZARD_STEPS.FACILITY_ENTRY,
  WIZARD_STEPS.DEAL_INFO,
  WIZARD_STEPS.TEAM_TIMELINE,
];

export const AI_STEPS = [
  WIZARD_STEPS.PATH_SELECT,
  WIZARD_STEPS.DOCUMENT_UPLOAD,
  WIZARD_STEPS.DEAL_BASICS,
  WIZARD_STEPS.DEAL_INFO,
  WIZARD_STEPS.TEAM_TIMELINE,
];

const getInitialDealData = () => ({
  // Deal Basics
  deal_name: '',
  deal_source: '', // Broker, Off-market, REIT, Other
  deal_source_other: '', // Free text if "Other" selected
  contact_name: '', // Who they got it from
  status: 'pipeline',
  priority_level: 'Medium',

  // Facilities (array for multiple)
  facilities: [],

  // Deal Info
  purchase_price: '',

  // Team & Timeline
  deal_lead_id: null,
  assistant_deal_lead_id: null,
  deal_team_members: [],
  target_close_date: '',
});

const getInitialFacility = () => ({
  id: `facility-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  facility_type: '', // SNF, ALF, ILF, Other
  facility_name: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  // Database match info
  matched_facility: null, // The matched facility from DB
  match_source: null, // 'snf_facilities' or 'alf_facilities'
  match_confirmed: false,
});

export const DEAL_TYPES = {
  SINGLE: 'single',
  PORTFOLIO: 'portfolio',
};

export const WizardProvider = ({ children }) => {
  // Current path and step
  const [path, setPath] = useState(null); // 'manual' or 'ai'
  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.PATH_SELECT);

  // Deal data
  const [dealData, setDealData] = useState(getInitialDealData());

  // Deal type (single facility vs portfolio) - for AI path
  const [dealType, setDealType] = useState(null); // 'single' or 'portfolio'

  // AI extraction state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extractionData, setExtractionData] = useState(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [detectedFacilities, setDetectedFacilities] = useState([]);
  const [validationWarningsDismissed, setValidationWarningsDismissed] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});

  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get steps array based on current path
  const getSteps = useCallback(() => {
    if (path === WIZARD_PATHS.MANUAL) return MANUAL_STEPS;
    if (path === WIZARD_PATHS.AI) return AI_STEPS;
    return [WIZARD_STEPS.PATH_SELECT];
  }, [path]);

  // Get current step index
  const getCurrentStepIndex = useCallback(() => {
    const steps = getSteps();
    return steps.indexOf(currentStep);
  }, [currentStep, getSteps]);

  // Navigation
  const goToNextStep = useCallback(() => {
    const steps = getSteps();
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep, getSteps]);

  const goToPreviousStep = useCallback(() => {
    const steps = getSteps();
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep, getSteps]);

  const goToStep = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  // Select path (Manual or AI)
  const selectPath = useCallback((selectedPath) => {
    setPath(selectedPath);
    if (selectedPath === WIZARD_PATHS.MANUAL) {
      setCurrentStep(WIZARD_STEPS.DEAL_BASICS);
    } else if (selectedPath === WIZARD_PATHS.AI) {
      setCurrentStep(WIZARD_STEPS.DOCUMENT_UPLOAD);
    }
  }, []);

  // Update deal data
  const updateDealData = useCallback((updates) => {
    setDealData(prev => ({ ...prev, ...updates }));
  }, []);

  // Facility management
  const addFacility = useCallback((facilityData = {}) => {
    const newFacility = { ...getInitialFacility(), ...facilityData };
    setDealData(prev => ({
      ...prev,
      facilities: [...prev.facilities, newFacility],
    }));
    return newFacility.id;
  }, []);

  const updateFacility = useCallback((facilityId, updates) => {
    setDealData(prev => ({
      ...prev,
      facilities: prev.facilities.map(f =>
        f.id === facilityId ? { ...f, ...updates } : f
      ),
    }));
  }, []);

  const removeFacility = useCallback((facilityId) => {
    setDealData(prev => ({
      ...prev,
      facilities: prev.facilities.filter(f => f.id !== facilityId),
    }));
  }, []);

  // Set facilities from AI detection
  const setFacilitiesFromAI = useCallback((facilities) => {
    const formattedFacilities = facilities.map(f => ({
      ...getInitialFacility(),
      facility_type: f.facility_type || f.detected?.facility_type || '',
      facility_name: f.facility_name || f.detected?.name || '',
      address: f.address || f.detected?.address || '',
      city: f.city || f.detected?.city || '',
      state: f.state || f.detected?.state || '',
      zip_code: f.zip_code || f.detected?.zip || '',
      matched_facility: f.matched || null,
      match_source: f.match_source || null,
      match_confirmed: f.user_confirmed || false,
    }));
    setDealData(prev => ({
      ...prev,
      facilities: formattedFacilities,
    }));
  }, []);

  // Apply extraction data to deal
  const applyExtractionData = useCallback((extracted) => {
    setExtractionData(extracted);

    // Auto-fill fields from extraction
    const updates = {};

    if (extracted.deal_name) updates.deal_name = extracted.deal_name;
    if (extracted.purchase_price) updates.purchase_price = extracted.purchase_price.toString();

    if (Object.keys(updates).length > 0) {
      updateDealData(updates);
    }
  }, [updateDealData]);

  // Validation
  const validateStep = useCallback((step) => {
    const newErrors = {};

    switch (step) {
      case WIZARD_STEPS.DEAL_BASICS:
        if (!dealData.deal_name?.trim()) {
          newErrors.deal_name = 'Deal name is required';
        }
        if (!dealData.deal_source) {
          newErrors.deal_source = 'Deal source is required';
        }
        if (dealData.deal_source === 'Other' && !dealData.deal_source_other?.trim()) {
          newErrors.deal_source_other = 'Please specify the source';
        }
        break;

      case WIZARD_STEPS.FACILITY_ENTRY:
        if (dealData.facilities.length === 0) {
          newErrors.facilities = 'At least one facility is required';
        }
        break;

      case WIZARD_STEPS.DEAL_INFO:
        if (!dealData.purchase_price) {
          newErrors.purchase_price = 'Purchase price is required';
        }
        break;

      case WIZARD_STEPS.TEAM_TIMELINE:
        if (!dealData.deal_lead_id) {
          newErrors.deal_lead_id = 'Deal lead is required';
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [dealData]);

  // Reset wizard
  const resetWizard = useCallback(() => {
    setPath(null);
    setCurrentStep(WIZARD_STEPS.PATH_SELECT);
    setDealData(getInitialDealData());
    setDealType(null);
    setUploadedFiles([]);
    setExtractionData(null);
    setExtractionProgress(0);
    setIsExtracting(false);
    setDetectedFacilities([]);
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const value = {
    // Path and step state
    path,
    currentStep,
    selectPath,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    getSteps,
    getCurrentStepIndex,

    // Deal data
    dealData,
    updateDealData,

    // Deal type (single vs portfolio)
    dealType,
    setDealType,

    // Facility management
    addFacility,
    updateFacility,
    removeFacility,
    setFacilitiesFromAI,

    // AI extraction
    uploadedFiles,
    setUploadedFiles,
    extractionData,
    setExtractionData,
    extractionProgress,
    setExtractionProgress,
    isExtracting,
    setIsExtracting,
    detectedFacilities,
    setDetectedFacilities,
    applyExtractionData,
    validationWarningsDismissed,
    setValidationWarningsDismissed,

    // Validation
    errors,
    setErrors,
    validateStep,

    // Submission
    isSubmitting,
    setIsSubmitting,

    // Reset
    resetWizard,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};

export default WizardContext;
