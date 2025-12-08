import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Trash2, Plus, MapPin, FileText, X, Download, ChevronRight, ChevronDown, Upload, Loader } from "lucide-react";
import * as Yup from "yup";
// Google Places Autocomplete disabled - using manual input
// import GooglePlacesAutocomplete, {
//   geocodeByPlaceId,
//   getLatLng,
// } from "react-google-places-autocomplete";
import { createBatchDeals, extractDealEnhanced } from "../api/DealService";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { getActiveUsers } from "../api/authService";
// import LocationMultiSelect from "../components/ui/LocationMultiSelect";

// --- Validation Schema ---
const combinedValidationSchema = Yup.object().shape({
  deal_name: Yup.string()
    .required("Deal name is required")
    .min(2, "Deal name must be at least 2 characters"),
  // deal_type and priority_level are optional - no validation required
  deal_source: Yup.string(),
  // total_deal_amount is auto-calculated - no validation required
  primary_contact_name: Yup.string(),
  phone_number: Yup.string()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .matches(/^[\d\s\-\.\(\)\+]+$/, "Invalid phone number format"),
  email: Yup.string()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .email("Invalid email address"),
  target_close_date: Yup.date()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .typeError("Target close date must be a valid date"),
  dd_period_weeks: Yup.number()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .typeError("DD period must be a number")
    .min(1, "DD period must be at least 1 week"),
  title: Yup.string(),
  // status is optional - no validation required
  deal_lead_id: Yup.number()
    .required("Deal lead is required")
    .min(1, "Deal lead is required"),
  assistant_deal_lead_id: Yup.number()
    .transform((value, originalValue) => (originalValue === "" ? null : value))
    .nullable()
    .min(1, "Assistant deal lead must be valid"),
  deal_team_members: Yup.array(),
  deal_external_advisors: Yup.array(),
  notificationSettings: Yup.object().shape({
    email_notification_major_updates: Yup.boolean(),
    document_upload_notification: Yup.boolean(),
  }),
  // city and state are optional - no validation required
  // total_deal_amount is auto-calculated, no validation needed
  // deal_facilities validation removed - all fields are now optional
});

// --- Initial Data ---
const getInitialDealData = () => ({
  deal_name: "",
  deal_type: "Acquisition",
  priority_level: "High",
  deal_source: "",
  total_deal_amount: "",
  primary_contact_name: "",
  phone_number: "",
  email: "",
  target_close_date: "",
  dd_period_weeks: "",
  title: "",
  status: "pipeline",
  deal_lead_id: 1,
  assistant_deal_lead_id: 1,
  deal_team_members: [],
  deal_external_advisors: [],
  notificationSettings: {
    email_notification_major_updates: false,
    document_upload_notification: false,
  },
  // Location fields - now supports multiple locations
  locations: [],
  city: "", // Keep for backward compatibility
  state: "", // Keep for backward compatibility
  deal_facilities: [
    {
      facility_name: "",
      address: "",
      city: "",
      state: "",
      latitude: "",
      longitude: "",
      facility_type: ["Skilled Nursing"],
      no_of_beds: {
        skilled_nursing: "",
        assisted_living: "",
        memory_care: "",
        independent_living: "",
      },
      purchase_price: "",
      price_per_bed: "",
      down_payment: "",
      financing_amount: "",
      revenue_multiple: "",
      ebitda_multiple: "",
      current_occupancy: "",
      average_daily_rate: "",
      medicare_percentage: "",
      private_pay_percentage: "",
      target_irr_percentage: "",
      target_hold_period: "",
      projected_cap_rate_percentage: "",
      exit_multiple: "",
      annual_revenue: "",
      ebitda: "",
      // New financial parameters for backend
      t12m_revenue: "",
      t12m_occupancy: "",
      t12m_ebitdar: "",
      current_rent_lease_expense: "",
      t12m_ebitda: "",
      t12m_ebit: "",
      // Pro Forma Year fields
      proforma_year1_annual_revenue: "",
      proforma_year1_annual_ebitdar: "",
      proforma_year1_annual_rent: "",
      proforma_year1_annual_ebitda: "",
      proforma_year1_average_occupancy: "",
      proforma_year1_annual_ebit: "",
      proforma_year2_annual_revenue: "",
      proforma_year2_annual_ebitdar: "",
      proforma_year2_annual_rent: "",
      proforma_year2_annual_ebitda: "",
      proforma_year2_average_occupancy: "",
      proforma_year2_annual_ebit: "",
      proforma_year3_annual_revenue: "",
      proforma_year3_annual_ebitdar: "",
      proforma_year3_annual_rent: "",
      proforma_year3_annual_ebitda: "",
      proforma_year3_average_occupancy: "",
      proforma_year3_annual_ebit: "",
    },
  ],
});

// --- Helper: Recursively collect all errors from Yup ValidationError ---
function collectAllYupErrors(yupError) {
  const errors = {};
  if (yupError && yupError.inner && yupError.inner.length > 0) {
    yupError.inner.forEach((err) => {
      if (err.path && !errors[err.path]) {
        errors[err.path] = err.message;
      }
    });
  } else if (yupError && yupError.path) {
    errors[yupError.path] = yupError.message;
  }
  return errors;
}

// --- Helper: Format number with commas ---
function formatNumberWithCommas(value) {
  if (value === null || value === undefined || value === "") return "";
  // Remove all non-numeric except dot
  const cleaned = value.toString().replace(/,/g, "");
  if (cleaned === "" || isNaN(Number(cleaned))) return value;
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// --- Helper: Remove commas for storing raw value ---
function removeCommas(value) {
  if (typeof value === "string") {
    return value.replace(/,/g, "");
  }
  return value;
}

const CombinedDealForm = () => {
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [dealData, setDealData] = useState(getInitialDealData());
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [usersData, setUsersData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [facilityCount, setFacilityCount] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // AI extraction state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [aiExtractionConfidence, setAiExtractionConfidence] = useState(null);
  const [isFromAiExtraction, setIsFromAiExtraction] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [dataQualityNotes, setDataQualityNotes] = useState([]);
  const [keyObservations, setKeyObservations] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [extractionResponseData, setExtractionResponseData] = useState(null); // Store full extraction response

  // Upload & Analyze state
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Load Google Maps script if not already loaded
  // TEMPORARILY DISABLED - Google Maps autocomplete not needed for now
  // useEffect(() => {
  //   const loadGoogleMapsScript = () => {
  //     // Check if Google Maps is already loaded
  //     if (window.google && window.google.maps && window.google.maps.places) {
  //       setIsGoogleMapsLoaded(true);
  //       return;
  //     }

  //     // Check if script is already being loaded
  //     if (document.querySelector('script[src*="maps.googleapis.com"]')) {
  //       // Script is loading, wait for it
  //       const checkLoaded = setInterval(() => {
  //         if (window.google && window.google.maps && window.google.maps.places) {
  //           setIsGoogleMapsLoaded(true);
  //           clearInterval(checkLoaded);
  //         }
  //       }, 100);
  //       return;
  //     }

  //     // Load the script
  //     const script = document.createElement('script');
  //     script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
  //     script.async = true;
  //     script.defer = true;
  //     script.onload = () => setIsGoogleMapsLoaded(true);
  //     script.onerror = () => {
  //       console.error('Failed to load Google Maps script');
  //       toast.error('Failed to load Google Maps. Please refresh the page.');
  //     };
  //     document.head.appendChild(script);
  //   };

  //   loadGoogleMapsScript();
  // }, []);

  useEffect(() => {
    fetchUsers();
    // Calculate initial total deal amount
    updateTotalDealAmount();
  }, []);

  // Initialize selectedLocations from dealData
  useEffect(() => {
    if (dealData.locations && dealData.locations.length > 0) {
      setSelectedLocations(dealData.locations);
    }
  }, [dealData.locations]);

  // Process AI-extracted data from location.state
  useEffect(() => {
    if (location.state?.extractedData) {
      const extracted = location.state.extractedData;
      const uploadedFilesFromState = location.state.uploadedFiles || [];
      const confidence = location.state.confidence;

      setIsFromAiExtraction(true);
      setUploadedFiles(uploadedFilesFromState);
      setAiExtractionConfidence(confidence);

      // Store data quality notes and observations for display
      if (extracted.data_quality_notes) {
        setDataQualityNotes(extracted.data_quality_notes);
      }
      if (extracted.key_observations) {
        setKeyObservations(extracted.key_observations);
      }
      if (extracted.document_types_identified) {
        setDocumentTypes(extracted.document_types_identified);
      }

      // Map extracted data to form fields
      const initialData = getInitialDealData();

      // Deal level fields
      if (extracted.deal_name) initialData.deal_name = extracted.deal_name;
      if (extracted.deal_type) initialData.deal_type = extracted.deal_type;
      if (extracted.deal_source) initialData.deal_source = extracted.deal_source;
      if (extracted.priority_level) initialData.priority_level = extracted.priority_level;
      if (extracted.primary_contact_name) initialData.primary_contact_name = extracted.primary_contact_name;
      if (extracted.title) initialData.title = extracted.title;
      if (extracted.phone_number) initialData.phone_number = extracted.phone_number;
      if (extracted.email) initialData.email = extracted.email;

      // Facility level fields - populate the first facility
      const facility = initialData.deal_facilities[0];

      if (extracted.facility_name) facility.facility_name = extracted.facility_name;
      if (extracted.street_address) facility.address = extracted.street_address;
      if (extracted.city) {
        facility.city = extracted.city;
        initialData.city = extracted.city;
      }
      if (extracted.state) {
        facility.state = extracted.state;
        initialData.state = extracted.state;
      }

      // Map facility type - handle different formats
      if (extracted.facility_type) {
        const facilityTypeMap = {
          'SNF': 'Skilled Nursing',
          'Skilled Nursing': 'Skilled Nursing',
          'Skilled Nursing Facility': 'Skilled Nursing',
          'Assisted Living': 'Assisted Living',
          'AL': 'Assisted Living',
          'Memory Care': 'Memory Care',
          'MC': 'Memory Care',
          'Independent Living': 'Independent Living',
          'IL': 'Independent Living',
          'CCRC': 'CCRC',
          'Rehabilitation': 'Rehabilitation',
        };
        const mappedType = facilityTypeMap[extracted.facility_type] || 'Skilled Nursing';
        facility.facility_type = [mappedType];

        // Set bed count for the mapped type
        if (extracted.no_of_beds) {
          const bedKey = mappedType.toLowerCase().replace(' ', '_');
          facility.no_of_beds[bedKey] = extracted.no_of_beds.toString();
        }
      } else if (extracted.no_of_beds) {
        // Default to skilled nursing if facility type not specified
        facility.no_of_beds.skilled_nursing = extracted.no_of_beds.toString();
      }

      // Financial fields
      if (extracted.purchase_price) {
        facility.purchase_price = extracted.purchase_price.toString();
        initialData.total_deal_amount = extracted.purchase_price.toString();
      }
      if (extracted.price_per_bed) facility.price_per_bed = extracted.price_per_bed.toString();
      if (extracted.annual_revenue) facility.annual_revenue = extracted.annual_revenue.toString();
      if (extracted.ebitda) facility.ebitda = extracted.ebitda.toString();
      if (extracted.revenue_multiple) facility.revenue_multiple = extracted.revenue_multiple.toString();
      if (extracted.ebitda_multiple) facility.ebitda_multiple = extracted.ebitda_multiple.toString();
      if (extracted.current_occupancy) facility.current_occupancy = extracted.current_occupancy.toString();
      if (extracted.average_daily_rate) facility.average_daily_rate = extracted.average_daily_rate.toString();
      if (extracted.medicare_percentage) facility.medicare_percentage = extracted.medicare_percentage.toString();
      if (extracted.private_pay_percentage) facility.private_pay_percentage = extracted.private_pay_percentage.toString();
      if (extracted.target_irr_percentage) facility.target_irr_percentage = extracted.target_irr_percentage.toString();
      if (extracted.projected_cap_rate_percentage) facility.projected_cap_rate_percentage = extracted.projected_cap_rate_percentage.toString();
      if (extracted.target_hold_period) facility.target_hold_period = extracted.target_hold_period.toString();

      // T12 Financial fields
      if (extracted.t12m_revenue) facility.t12m_revenue = extracted.t12m_revenue.toString();
      if (extracted.t12m_occupancy) facility.t12m_occupancy = extracted.t12m_occupancy.toString();
      if (extracted.t12m_ebitdar) facility.t12m_ebitdar = extracted.t12m_ebitdar.toString();
      if (extracted.current_rent_lease_expense) facility.current_rent_lease_expense = extracted.current_rent_lease_expense.toString();
      if (extracted.t12m_ebitda) facility.t12m_ebitda = extracted.t12m_ebitda.toString();
      if (extracted.t12m_ebit) facility.t12m_ebit = extracted.t12m_ebit.toString();

      // Pro Forma Year 1
      if (extracted.proforma_year1_annual_revenue) facility.proforma_year1_annual_revenue = extracted.proforma_year1_annual_revenue.toString();
      if (extracted.proforma_year1_annual_ebitdar) facility.proforma_year1_annual_ebitdar = extracted.proforma_year1_annual_ebitdar.toString();
      if (extracted.proforma_year1_annual_rent) facility.proforma_year1_annual_rent = extracted.proforma_year1_annual_rent.toString();
      if (extracted.proforma_year1_annual_ebitda) facility.proforma_year1_annual_ebitda = extracted.proforma_year1_annual_ebitda.toString();
      if (extracted.proforma_year1_annual_ebit) facility.proforma_year1_annual_ebit = extracted.proforma_year1_annual_ebit.toString();
      if (extracted.proforma_year1_average_occupancy) facility.proforma_year1_average_occupancy = extracted.proforma_year1_average_occupancy.toString();

      // Pro Forma Year 2
      if (extracted.proforma_year2_annual_revenue) facility.proforma_year2_annual_revenue = extracted.proforma_year2_annual_revenue.toString();
      if (extracted.proforma_year2_annual_ebitdar) facility.proforma_year2_annual_ebitdar = extracted.proforma_year2_annual_ebitdar.toString();
      if (extracted.proforma_year2_annual_rent) facility.proforma_year2_annual_rent = extracted.proforma_year2_annual_rent.toString();
      if (extracted.proforma_year2_annual_ebitda) facility.proforma_year2_annual_ebitda = extracted.proforma_year2_annual_ebitda.toString();
      if (extracted.proforma_year2_annual_ebit) facility.proforma_year2_annual_ebit = extracted.proforma_year2_annual_ebit.toString();
      if (extracted.proforma_year2_average_occupancy) facility.proforma_year2_average_occupancy = extracted.proforma_year2_average_occupancy.toString();

      // Pro Forma Year 3
      if (extracted.proforma_year3_annual_revenue) facility.proforma_year3_annual_revenue = extracted.proforma_year3_annual_revenue.toString();
      if (extracted.proforma_year3_annual_ebitdar) facility.proforma_year3_annual_ebitdar = extracted.proforma_year3_annual_ebitdar.toString();
      if (extracted.proforma_year3_annual_rent) facility.proforma_year3_annual_rent = extracted.proforma_year3_annual_rent.toString();
      if (extracted.proforma_year3_annual_ebitda) facility.proforma_year3_annual_ebitda = extracted.proforma_year3_annual_ebitda.toString();
      if (extracted.proforma_year3_annual_ebit) facility.proforma_year3_annual_ebit = extracted.proforma_year3_annual_ebit.toString();
      if (extracted.proforma_year3_average_occupancy) facility.proforma_year3_average_occupancy = extracted.proforma_year3_average_occupancy.toString();

      setDealData(initialData);
      toast.success(`AI extracted ${confidence}% of key fields from your documents`);
    }
  }, [location.state]);

  const fetchUsers = async () => {
    try {
      const response = await getActiveUsers();
      setUsersData(response.body);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // --- Upload & Analyze Handlers ---
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
      handleExtractAndPopulate(validFiles);
    } else {
      toast.error("Please upload PDF, image, Excel, or Word files");
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      handleExtractAndPopulate(selectedFiles);
    }
  };

  const handleExtractAndPopulate = async (files) => {
    setIsExtracting(true);
    try {
      const response = await extractDealEnhanced(files);
      if (response.success) {
        const extracted = response.body.extractedData;
        const uploadedFilesFromResponse = response.body.uploadedFiles || [];
        const successRate = response.body.metadata?.successCount || 5;
        const calculatedConfidence = Math.round((successRate / 5) * 100);

        setIsFromAiExtraction(true);
        setUploadedFiles(uploadedFilesFromResponse);
        setAiExtractionConfidence(calculatedConfidence);
        // Store the full extraction response for later use when creating the deal
        setExtractionResponseData(response.body);

        // Store data quality notes and observations for display
        if (extracted.data_quality_notes) {
          setDataQualityNotes(extracted.data_quality_notes);
        }
        if (extracted.key_observations) {
          setKeyObservations(extracted.key_observations);
        }
        if (extracted.document_types_identified) {
          setDocumentTypes(extracted.document_types_identified);
        }

        // Map extracted data to form fields
        const initialData = getInitialDealData();

        // Deal level fields
        if (extracted.deal_name) initialData.deal_name = extracted.deal_name;
        if (extracted.deal_type) initialData.deal_type = extracted.deal_type;
        if (extracted.deal_source) initialData.deal_source = extracted.deal_source;
        if (extracted.priority_level) initialData.priority_level = extracted.priority_level;
        if (extracted.primary_contact_name) initialData.primary_contact_name = extracted.primary_contact_name;
        if (extracted.title) initialData.title = extracted.title;
        if (extracted.phone_number) initialData.phone_number = extracted.phone_number;
        if (extracted.email) initialData.email = extracted.email;

        // Facility level fields - populate the first facility
        const facility = initialData.deal_facilities[0];

        if (extracted.facility_name) facility.facility_name = extracted.facility_name;
        if (extracted.street_address) facility.address = extracted.street_address;
        if (extracted.city) {
          facility.city = extracted.city;
          initialData.city = extracted.city;
        }
        if (extracted.state) {
          facility.state = extracted.state;
          initialData.state = extracted.state;
        }

        // Map facility type - handle different formats
        if (extracted.facility_type) {
          const facilityTypeMap = {
            'SNF': 'Skilled Nursing',
            'Skilled Nursing': 'Skilled Nursing',
            'Skilled Nursing Facility': 'Skilled Nursing',
            'Assisted Living': 'Assisted Living',
            'AL': 'Assisted Living',
            'Memory Care': 'Memory Care',
            'MC': 'Memory Care',
            'Independent Living': 'Independent Living',
            'IL': 'Independent Living',
            'CCRC': 'CCRC',
            'Rehabilitation': 'Rehabilitation',
          };
          const mappedType = facilityTypeMap[extracted.facility_type] || 'Skilled Nursing';
          facility.facility_type = [mappedType];

          // Set bed count for the mapped type
          if (extracted.no_of_beds) {
            const bedKey = mappedType.toLowerCase().replace(' ', '_');
            facility.no_of_beds[bedKey] = extracted.no_of_beds.toString();
          }
        } else if (extracted.no_of_beds) {
          // Default to skilled nursing if facility type not specified
          facility.no_of_beds.skilled_nursing = extracted.no_of_beds.toString();
        }

        // Financial fields
        if (extracted.purchase_price) {
          facility.purchase_price = extracted.purchase_price.toString();
          initialData.total_deal_amount = extracted.purchase_price.toString();
        }
        if (extracted.price_per_bed) facility.price_per_bed = extracted.price_per_bed.toString();
        if (extracted.annual_revenue) facility.annual_revenue = extracted.annual_revenue.toString();
        if (extracted.ebitda) facility.ebitda = extracted.ebitda.toString();
        if (extracted.revenue_multiple) facility.revenue_multiple = extracted.revenue_multiple.toString();
        if (extracted.ebitda_multiple) facility.ebitda_multiple = extracted.ebitda_multiple.toString();
        if (extracted.current_occupancy) facility.current_occupancy = extracted.current_occupancy.toString();
        if (extracted.average_daily_rate) facility.average_daily_rate = extracted.average_daily_rate.toString();
        if (extracted.medicare_percentage) facility.medicare_percentage = extracted.medicare_percentage.toString();
        if (extracted.private_pay_percentage) facility.private_pay_percentage = extracted.private_pay_percentage.toString();
        if (extracted.target_irr_percentage) facility.target_irr_percentage = extracted.target_irr_percentage.toString();
        if (extracted.projected_cap_rate_percentage) facility.projected_cap_rate_percentage = extracted.projected_cap_rate_percentage.toString();
        if (extracted.target_hold_period) facility.target_hold_period = extracted.target_hold_period.toString();

        // T12 Financial fields
        if (extracted.t12m_revenue) facility.t12m_revenue = extracted.t12m_revenue.toString();
        if (extracted.t12m_occupancy) facility.t12m_occupancy = extracted.t12m_occupancy.toString();
        if (extracted.t12m_ebitdar) facility.t12m_ebitdar = extracted.t12m_ebitdar.toString();
        if (extracted.current_rent_lease_expense) facility.current_rent_lease_expense = extracted.current_rent_lease_expense.toString();
        if (extracted.t12m_ebitda) facility.t12m_ebitda = extracted.t12m_ebitda.toString();
        if (extracted.t12m_ebit) facility.t12m_ebit = extracted.t12m_ebit.toString();

        // Pro Forma Year 1
        if (extracted.proforma_year1_annual_revenue) facility.proforma_year1_annual_revenue = extracted.proforma_year1_annual_revenue.toString();
        if (extracted.proforma_year1_annual_ebitdar) facility.proforma_year1_annual_ebitdar = extracted.proforma_year1_annual_ebitdar.toString();
        if (extracted.proforma_year1_annual_rent) facility.proforma_year1_annual_rent = extracted.proforma_year1_annual_rent.toString();
        if (extracted.proforma_year1_annual_ebitda) facility.proforma_year1_annual_ebitda = extracted.proforma_year1_annual_ebitda.toString();
        if (extracted.proforma_year1_annual_ebit) facility.proforma_year1_annual_ebit = extracted.proforma_year1_annual_ebit.toString();
        if (extracted.proforma_year1_average_occupancy) facility.proforma_year1_average_occupancy = extracted.proforma_year1_average_occupancy.toString();

        // Pro Forma Year 2
        if (extracted.proforma_year2_annual_revenue) facility.proforma_year2_annual_revenue = extracted.proforma_year2_annual_revenue.toString();
        if (extracted.proforma_year2_annual_ebitdar) facility.proforma_year2_annual_ebitdar = extracted.proforma_year2_annual_ebitdar.toString();
        if (extracted.proforma_year2_annual_rent) facility.proforma_year2_annual_rent = extracted.proforma_year2_annual_rent.toString();
        if (extracted.proforma_year2_annual_ebitda) facility.proforma_year2_annual_ebitda = extracted.proforma_year2_annual_ebitda.toString();
        if (extracted.proforma_year2_annual_ebit) facility.proforma_year2_annual_ebit = extracted.proforma_year2_annual_ebit.toString();
        if (extracted.proforma_year2_average_occupancy) facility.proforma_year2_average_occupancy = extracted.proforma_year2_average_occupancy.toString();

        // Pro Forma Year 3
        if (extracted.proforma_year3_annual_revenue) facility.proforma_year3_annual_revenue = extracted.proforma_year3_annual_revenue.toString();
        if (extracted.proforma_year3_annual_ebitdar) facility.proforma_year3_annual_ebitdar = extracted.proforma_year3_annual_ebitdar.toString();
        if (extracted.proforma_year3_annual_rent) facility.proforma_year3_annual_rent = extracted.proforma_year3_annual_rent.toString();
        if (extracted.proforma_year3_annual_ebitda) facility.proforma_year3_annual_ebitda = extracted.proforma_year3_annual_ebitda.toString();
        if (extracted.proforma_year3_annual_ebit) facility.proforma_year3_annual_ebit = extracted.proforma_year3_annual_ebit.toString();
        if (extracted.proforma_year3_average_occupancy) facility.proforma_year3_average_occupancy = extracted.proforma_year3_average_occupancy.toString();

        setDealData(initialData);
        toast.success(`AI extracted ${calculatedConfidence}% of key fields from your documents`);
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

  // --- Facility Count Change ---
  const handleFacilityCountChange = (count) => {
    setFacilityCount(count);
    const newFacilities = [];
    for (let i = 0; i < count; i++) {
      if (dealData.deal_facilities[i]) {
        newFacilities.push(dealData.deal_facilities[i]);
      } else {
        newFacilities.push({
          facility_name: "",
          address: "",
          city: "",
          state: "",
          latitude: "",
          longitude: "",
          facility_type: ["Skilled Nursing"],
          no_of_beds: {
            skilled_nursing: "",
            assisted_living: "",
            memory_care: "",
            independent_living: "",
          },
          purchase_price: "",
          price_per_bed: "",
          down_payment: "",
          financing_amount: "",
          revenue_multiple: "",
          ebitda_multiple: "",
          current_occupancy: "",
          average_daily_rate: "",
          medicare_percentage: "",
          private_pay_percentage: "",
          target_irr_percentage: "",
          target_hold_period: "",
          projected_cap_rate_percentage: "",
          exit_multiple: "",
          annual_revenue: "",
          ebitda: "",
          // New financial parameters for backend
          t12m_revenue: "",
          t12m_occupancy: "",
          t12m_ebitdar: "",
          current_rent_lease_expense: "",
          t12m_ebitda: "",
          t12m_ebit: "",
          // Pro Forma Year fields
          proforma_year1_annual_revenue: "",
          proforma_year1_annual_ebitdar: "",
          proforma_year1_annual_rent: "",
          proforma_year1_annual_ebitda: "",
          proforma_year1_average_occupancy: "",
          proforma_year1_annual_ebit: "",
          proforma_year2_annual_revenue: "",
          proforma_year2_annual_ebitdar: "",
          proforma_year2_annual_rent: "",
          proforma_year2_annual_ebitda: "",
          proforma_year2_average_occupancy: "",
          proforma_year2_annual_ebit: "",
          proforma_year3_annual_revenue: "",
          proforma_year3_annual_ebitdar: "",
          proforma_year3_annual_rent: "",
          proforma_year3_annual_ebitda: "",
          proforma_year3_average_occupancy: "",
          proforma_year3_annual_ebit: "",
        });
      }
    }
    setDealData((prev) => ({
      ...prev,
      deal_facilities: newFacilities,
    }));
  };

  // --- Calculate Total Deal Amount ---
  const calculateTotalDealAmount = (facilities) => {
    return facilities.reduce((total, facility) => {
      const purchasePrice = Number(facility.purchase_price) || 0;
      return total + purchasePrice;
    }, 0);
  };

  // --- Update Total Deal Amount ---
  const updateTotalDealAmount = (facilities = null) => {
    const facilitiesToUse = facilities || dealData.deal_facilities;
    const total = calculateTotalDealAmount(facilitiesToUse);
    setDealData((prev) => ({
      ...prev,
      total_deal_amount: total.toString(),
    }));
  };

  // --- Add/Remove Facility ---
  const addFacility = () => {
    const newFacility = {
      facility_name: "",
      address: "",
      city: "",
      state: "",
      latitude: "",
      longitude: "",
      facility_type: ["Skilled Nursing"],
      no_of_beds: {
        skilled_nursing: "",
        assisted_living: "",
        memory_care: "",
        independent_living: "",
      },
      purchase_price: "",
      price_per_bed: "",
      down_payment: "",
      financing_amount: "",
      revenue_multiple: "",
      ebitda_multiple: "",
      current_occupancy: "",
      average_daily_rate: "",
      medicare_percentage: "",
      private_pay_percentage: "",
      target_irr_percentage: "",
      target_hold_period: "",
      projected_cap_rate_percentage: "",
      exit_multiple: "",
      annual_revenue: "",
      ebitda: "",
      // New financial parameters for backend
      t12m_revenue: "",
      t12m_occupancy: "",
      t12m_ebitdar: "",
      current_rent_lease_expense: "",
      t12m_ebitda: "",
      t12m_ebit: "",
      // Pro Forma Year fields
      proforma_year1_annual_revenue: "",
      proforma_year1_annual_ebitdar: "",
      proforma_year1_annual_rent: "",
      proforma_year1_annual_ebitda: "",
      proforma_year1_average_occupancy: "",
      proforma_year1_annual_ebit: "",
      proforma_year2_annual_revenue: "",
      proforma_year2_annual_ebitdar: "",
      proforma_year2_annual_rent: "",
      proforma_year2_annual_ebitda: "",
      proforma_year2_average_occupancy: "",
      proforma_year2_annual_ebit: "",
      proforma_year3_annual_revenue: "",
      proforma_year3_annual_ebitdar: "",
      proforma_year3_annual_rent: "",
      proforma_year3_annual_ebitda: "",
      proforma_year3_average_occupancy: "",
      proforma_year3_annual_ebit: "",
    };
    setDealData((prev) => {
      const newFacilities = [...prev.deal_facilities, newFacility];
      const total = calculateTotalDealAmount(newFacilities);
      return {
        ...prev,
        deal_facilities: newFacilities,
        total_deal_amount: total.toString(),
      };
    });
    setFacilityCount((prev) => prev + 1);
  };

  const removeFacility = (index) => {
    if (facilityCount > 1) {
      setDealData((prev) => {
        const newFacilities = prev.deal_facilities.filter(
          (_, i) => i !== index
        );
        const total = calculateTotalDealAmount(newFacilities);
        return {
          ...prev,
          deal_facilities: newFacilities,
          total_deal_amount: total.toString(),
        };
      });
      setFacilityCount((prev) => prev - 1);
    }
  };

  // --- Location Selection ---
  const handleLocationSelect = (place) => {
    if (place) {
      setSelectedLocation(place);
      const addressParts = place.label.split(", ");
      const address = {
        street_address: place.label,
        city: "",
        state: "",
        country: "",
        zip_code: "",
      };
      if (addressParts.length >= 2) {
        address.city = addressParts[0] || "";
        if (addressParts.length >= 3) {
          const statePart = addressParts[1].trim();
          const stateMatch = statePart.match(/^([A-Z]{2})\s*(\d{5})?/);
          if (stateMatch) {
            address.state = stateMatch[1] || "";
            address.zip_code = stateMatch[2] || "";
          } else {
            address.state = statePart;
          }
          address.country =
            addressParts[addressParts.length - 1] || "United States";
        } else if (addressParts.length === 2) {
          address.state = addressParts[1];
          address.country = "United States";
        }
      }

      setShowLocationForm(false);
    }
  };

  // --- Multiple Location Selection ---
  const handleLocationsChange = (locations) => {
    setSelectedLocations(locations);

    // Update dealData with the new locations
    setDealData((prev) => ({
      ...prev,
      locations: locations,
    }));

    // For backward compatibility, also update city and state if only one location is selected
    if (locations.length === 1) {
      const location = locations[0];
      setDealData((prev) => ({
        ...prev,
        city: location.city || "",
        state: location.state || "",
      }));
    } else if (locations.length === 0) {
      // Clear city and state if no locations
      setDealData((prev) => ({
        ...prev,
        city: "",
        state: "",
      }));
    }
  };

  // --- Input Change Handlers ---
  const handleInputChange = (field, value) => {
    // For amount fields, remove commas before storing
    let newValue = value;
    if (["total_deal_amount"].includes(field)) {
      newValue = removeCommas(value);
    }
    setDealData((prev) => {
      const newData = { ...prev, [field]: newValue };
      setTimeout(() => validateAllFields(newData), 0);
      return newData;
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // --- Facility Input Change with auto price per bed calculation ---
  const handleFacilityInputChange = (facilityIndex, field, value) => {
    // For amount fields, remove commas before storing
    const amountFields = [
      "purchase_price",
      "price_per_bed",
      "down_payment",
      "financing_amount",
      "annual_revenue",
      "revenue_multiple",
      "ebitda_multiple",
      "current_occupancy",
      "average_daily_rate",
      "medicare_percentage",
      "private_pay_percentage",
      "target_irr_percentage",
      "target_hold_period",
      "projected_cap_rate_percentage",
      "exit_multiple",
      "ebitda",
    ];
    let newValue = value;
    if (amountFields.includes(field)) {
      newValue = removeCommas(value);
    }

    setDealData((prev) => {
      const newFacilities = [...prev.deal_facilities];
      let updatedFacility = {
        ...newFacilities[facilityIndex],
        [field]: newValue,
      };

      // If purchase_price or no_of_beds changes, recalculate price_per_bed
      if (field === "purchase_price" || field === "no_of_beds") {
        const selectedTypes = updatedFacility.facility_type || [];
        let totalBeds = 0;
        if (selectedTypes.length > 0 && updatedFacility.no_of_beds) {
          for (let type of selectedTypes) {
            const key = type.toLowerCase().replace(" ", "_");
            const bedCount = Number(updatedFacility.no_of_beds[key]);
            if (!isNaN(bedCount) && bedCount > 0) {
              totalBeds += bedCount;
            }
          }
        }
        const purchasePrice = Number(
          field === "purchase_price" ? newValue : updatedFacility.purchase_price
        );
        let pricePerBed = "";
        if (purchasePrice > 0 && totalBeds > 0) {
          pricePerBed = Math.round(purchasePrice / totalBeds);
        }
        updatedFacility.price_per_bed = pricePerBed;
      }

      newFacilities[facilityIndex] = updatedFacility;

      // Update total deal amount immediately if purchase_price changed
      if (field === "purchase_price") {
        const total = calculateTotalDealAmount(newFacilities);
        return {
          ...prev,
          deal_facilities: newFacilities,
          total_deal_amount: total.toString(),
        };
      }

      return { ...prev, deal_facilities: newFacilities };
    });

    setTouched((prev) => ({
      ...prev,
      [`deal_facilities[${facilityIndex}].${field}`]: true,
    }));
    const newDealData = {
      ...dealData,
      deal_facilities: dealData.deal_facilities.map((f, i) =>
        i === facilityIndex ? { ...f, [field]: newValue } : f
      ),
    };
    validateAllFields(newDealData);
  };

  // --- Pro Forma Input Change Handler ---
  const handleProFormaInputChange = (facilityIndex, year, field, value) => {
    // For amount fields, remove commas before storing
    const amountFields = [
      "annual_revenue",
      "annual_ebitdar",
      "annual_rent",
      "annual_ebitda",
      "annual_ebit",
    ];

    let newValue = value;
    if (amountFields.includes(field)) {
      newValue = removeCommas(value);
    }

    setDealData((prev) => {
      const newFacilities = [...prev.deal_facilities];
      const updatedFacility = { ...newFacilities[facilityIndex] };

      // Initialize pro_forma structure if it doesn't exist
      if (!updatedFacility.pro_forma) {
        updatedFacility.pro_forma = {};
      }
      if (!updatedFacility.pro_forma[year]) {
        updatedFacility.pro_forma[year] = {};
      }

      // Update the specific field
      updatedFacility.pro_forma[year][field] = newValue;

      newFacilities[facilityIndex] = updatedFacility;

      return { ...prev, deal_facilities: newFacilities };
    });

    setTouched((prev) => ({
      ...prev,
      [`deal_facilities[${facilityIndex}].pro_forma.${year}.${field}`]: true,
    }));
  };

  // --- Facility Type Change (recalculate price per bed if needed) ---
  const handleFacilityTypeChange = (facilityIndex, selectedTypes) => {
    setDealData((prev) => {
      const newFacilities = [...prev.deal_facilities];
      let updatedFacility = {
        ...newFacilities[facilityIndex],
        facility_type: selectedTypes,
      };

      let totalBeds = 0;
      if (selectedTypes.length > 0 && updatedFacility.no_of_beds) {
        for (let type of selectedTypes) {
          const key = type.toLowerCase().replace(" ", "_");
          const bedCount = Number(updatedFacility.no_of_beds[key]);
          if (!isNaN(bedCount) && bedCount > 0) {
            totalBeds += bedCount;
          }
        }
      }
      const purchasePrice = Number(updatedFacility.purchase_price);
      let pricePerBed = "";
      if (purchasePrice > 0 && totalBeds > 0) {
        pricePerBed = Math.round(purchasePrice / totalBeds);
      }
      updatedFacility.price_per_bed = pricePerBed;

      newFacilities[facilityIndex] = updatedFacility;
      return { ...prev, deal_facilities: newFacilities };
    });
    setTouched((prev) => ({
      ...prev,
      [`deal_facilities[${facilityIndex}].facility_type`]: true,
    }));
    const newDealData = {
      ...dealData,
      deal_facilities: dealData.deal_facilities.map((f, i) =>
        i === facilityIndex ? { ...f, facility_type: selectedTypes } : f
      ),
    };
    validateAllFields(newDealData);
  };

  // --- Bed Count Change (recalculate price per bed if needed) ---
  const handleBedCountChange = (facilityIndex, bedType, value) => {
    // Remove commas for storing
    let newValue = removeCommas(value);

    setDealData((prev) => {
      const newFacilities = [...prev.deal_facilities];
      let updatedNoOfBeds = {
        ...newFacilities[facilityIndex].no_of_beds,
        [bedType]: newValue,
      };
      let updatedFacility = {
        ...newFacilities[facilityIndex],
        no_of_beds: updatedNoOfBeds,
      };

      const selectedTypes = updatedFacility.facility_type || [];
      let totalBeds = 0;
      if (selectedTypes.length > 0 && updatedFacility.no_of_beds) {
        for (let type of selectedTypes) {
          const key = type.toLowerCase().replace(" ", "_");
          const bedCount = Number(updatedFacility.no_of_beds[key]);
          if (!isNaN(bedCount) && bedCount > 0) {
            totalBeds += bedCount;
          }
        }
      }
      const purchasePrice = Number(updatedFacility.purchase_price);
      let pricePerBed = "";
      if (purchasePrice > 0 && totalBeds > 0) {
        pricePerBed = Math.round(purchasePrice / totalBeds);
      }
      updatedFacility.price_per_bed = pricePerBed;

      newFacilities[facilityIndex] = updatedFacility;
      
      // Debug logging
      // console.log("Updated facility no_of_beds:", updatedFacility.no_of_beds);
      
      return { ...prev, deal_facilities: newFacilities };
    });
    
    setTouched((prev) => ({
      ...prev,
      [`deal_facilities[${facilityIndex}].no_of_beds.${bedType}`]: true,
    }));
    
    // Validate the updated data after state update
    setTimeout(() => {
      validateAllFields(dealData);
    }, 100);
  };

  // --- Validation: Validate all fields and set errors for all inputs ---
  const validateAllFields = (data) => {
    try {
      combinedValidationSchema.validateSync(data, { abortEarly: false });
      setValidationErrors({});
    } catch (err) {
      setValidationErrors(collectAllYupErrors(err));
    }
  };

  // --- On Preview: Validate all, mark all as touched, show all errors ---
  const handlePreview = (e) => {
    e.preventDefault();

    setIsSubmitted(true);

    const newTouched = {};
    Object.keys(dealData).forEach((key) => {
      if (key !== "deal_facilities" && key !== "notificationSettings") {
        newTouched[key] = true;
      }
    });
    if (dealData.notificationSettings) {
      Object.keys(dealData.notificationSettings).forEach((key) => {
        newTouched[`notificationSettings.${key}`] = true;
      });
    }
    dealData.deal_facilities.forEach((facility, fIdx) => {
      Object.keys(facility).forEach((field) => {
        if (field === "no_of_beds") {
          Object.keys(facility.no_of_beds).forEach((bedType) => {
            newTouched[`deal_facilities[${fIdx}].no_of_beds.${bedType}`] = true;
          });
        } else {
          newTouched[`deal_facilities[${fIdx}].${field}`] = true;
        }
      });
    });
    setTouched(newTouched);

    try {
      combinedValidationSchema.validateSync(dealData, { abortEarly: false });
      setValidationErrors({});
      setPreviewData(dealData);
      setShowPreview(true);
    } catch (err) {
      setValidationErrors(collectAllYupErrors(err));
      toast.error("Please fix all validation errors before proceeding");
    }
  };

  // --- Map new financial parameters to old ones for backend compatibility ---
  const mapFinancialParameters = (facility) => {
    return {
      ...facility,
      // Map new parameters to old ones for backend
      annual_revenue: facility.t12m_revenue || facility.annual_revenue,
      current_occupancy: facility.t12m_occupancy || facility.current_occupancy,
      medicare_percentage:
        facility.t12m_ebitdar || facility.medicare_percentage,
      private_pay_percentage:
        facility.current_rent_lease_expense || facility.private_pay_percentage,
      target_irr_percentage:
        facility.t12m_ebitda || facility.target_irr_percentage,
      target_hold_period: facility.t12m_ebit || facility.target_hold_period,
    };
  };

  // --- Final Submit ---
  const handleFinalSubmit = async () => {
    setLoading(true);
    setShowPreview(false);

    try {
      // Get address from first facility if available, otherwise use dealData
      const firstFacility = dealData.deal_facilities[0] || {};

      const payload = {
        // Backend expects 'address' as a nested object
        address: {
          street_address: firstFacility.address || "",
          city: firstFacility.city || dealData.city || "",
          state: firstFacility.state || dealData.state || "",
          country: "United States",
          zip_code: "",
        },
        locations: selectedLocations || [],
        // Backend expects 'deals' array, not 'deal_facilities'
        deals: dealData.deal_facilities.map((facility) => {
          const facilityTypeString = Array.isArray(facility.facility_type)
            ? facility.facility_type.join(", ")
            : facility.facility_type || "";

          // Calculate total bed count from all facility types
          let totalBedCount = 0;
          if (Array.isArray(facility.facility_type) && facility.no_of_beds) {
            facility.facility_type.forEach((type) => {
              const key = type.toLowerCase().replace(" ", "_");
              const count = facility.no_of_beds[key];
              if (
                count !== undefined &&
                count !== null &&
                count !== "" &&
                !isNaN(Number(count))
              ) {
                totalBedCount += parseInt(count, 10);
              }
            });
          }
          // Convert to string for backend (database expects STRING)
          const noOfBedsStr = totalBedCount > 0 ? totalBedCount.toString() : "";

          // Remove commas from all amount fields before sending
          const amountFields = [
            "purchase_price",
            "price_per_bed",
            "down_payment",
            "financing_amount",
            "annual_revenue",
            "revenue_multiple",
            "ebitda_multiple",
            "current_occupancy",
            "average_daily_rate",
            "medicare_percentage",
            "private_pay_percentage",
            "target_irr_percentage",
            "target_hold_period",
            "projected_cap_rate_percentage",
            "exit_multiple",
            "ebitda",
            // New financial parameters
            "t12m_revenue",
            "t12m_occupancy",
            "t12m_ebitdar",
            "current_rent_lease_expense",
            "t12m_ebitda",
            "t12m_ebit",
            "proforma_year1_annual_revenue",
            "proforma_year1_annual_ebitdar",
            "proforma_year1_annual_rent",
            "proforma_year1_annual_ebitda",
            "proforma_year1_average_occupancy",
            "proforma_year1_annual_ebit",
            "proforma_year2_annual_revenue",
            "proforma_year2_annual_ebitdar",
            "proforma_year2_annual_rent",
            "proforma_year2_annual_ebitda",
            "proforma_year2_average_occupancy",
            "proforma_year2_annual_ebit",
            "proforma_year3_annual_revenue",
            "proforma_year3_annual_ebitdar",
            "proforma_year3_annual_rent",
            "proforma_year3_annual_ebitda",
            "proforma_year3_average_occupancy",
            "proforma_year3_annual_ebit",
          ];
          const cleanedFacility = { ...facility };
          amountFields.forEach((field) => {
            // Handle empty or falsy values by setting them to 0
            if (
              cleanedFacility[field] === undefined ||
              cleanedFacility[field] === null ||
              cleanedFacility[field] === "" ||
              cleanedFacility[field] === "0" ||
              Number(cleanedFacility[field]) === 0
            ) {
              cleanedFacility[field] = 0;
            } else {
              // Remove commas and convert to number
              const cleanedValue = removeCommas(cleanedFacility[field]);
              const numValue = Number(cleanedValue);
              cleanedFacility[field] = isNaN(numValue) ? 0 : numValue;
            }
          });

          return {
            // Deal-level fields (from dealData)
            deal_name: dealData.deal_name,
            deal_type: dealData.deal_type,
            priority_level: dealData.priority_level,
            deal_source: dealData.deal_source,
            primary_contact_name: dealData.primary_contact_name,
            phone_number: dealData.phone_number,
            email: dealData.email,
            target_close_date: dealData.target_close_date,
            dd_period_weeks: dealData.dd_period_weeks,
            title: dealData.title,
            deal_status: dealData.status,
            deal_lead_id: dealData.deal_lead_id,
            assistant_deal_lead_id: dealData.assistant_deal_lead_id,
            deal_team_members: dealData.deal_team_members,
            deal_external_advisors: dealData.deal_external_advisors,
            notificationSettings: dealData.notificationSettings,
            // Facility-specific fields
            ...cleanedFacility,
            // Apply financial parameter mapping for backend compatibility
            ...mapFinancialParameters(cleanedFacility),
            // Ensure facility_type is set as comma-separated string after mapping
            facility_type: facilityTypeString,
            // Set no_of_beds as total count string (backend expects STRING)
            no_of_beds: noOfBedsStr,
            // Include address fields on deal level (backend uses these for deal.street_address, deal.city, etc.)
            street_address: facility.address || "",
            city: facility.city || dealData.city || "",
            state: facility.state || dealData.state || "",
          };
        }),
      };

      // Include uploaded documents info in the payload
      if (uploadedFiles && uploadedFiles.length > 0) {
        payload.documents = uploadedFiles.map(file => ({
          filename: file.filename || file.name,
          original_name: file.originalName || file.name,
          file_path: file.url || `/api/v1/files/${file.filename}`,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size || 0
        }));
      }

      // Include raw extraction data for Deal Analysis view
      // Use extractionResponseData if available (from direct upload), otherwise check location.state (from redirect)
      const extractedData = extractionResponseData?.extractedData || location.state?.extractedData;
      if (isFromAiExtraction && extractedData) {
        payload.extraction_data = {
          ...extractedData,
          // Include deal_overview from the enhanced extraction response
          deal_overview: extractionResponseData?.extractedData?.deal_overview || location.state?.extractedData?.deal_overview,
          extraction_timestamp: new Date().toISOString(),
          confidence: aiExtractionConfidence,
          data_quality_notes: dataQualityNotes,
          key_observations: keyObservations,
          document_types_identified: documentTypes,
        };

        // Include enhanced time-series data if available
        // Use extractionResponseData if available (includes monthlyFinancials, monthlyCensus, etc.)
        const enhancedData = extractionResponseData || location.state?.enhancedData;
        if (enhancedData) {
          payload.enhanced_extraction_data = enhancedData;
        }
      }

      try {
        const response = await createBatchDeals(payload);
        if (response.success === true && response.code === 200) {
          toast.success(response.message || "Deal created successfully!");
          navigate("/deals");
        } else {
          toast.error(
            response.message || "Failed to create deal. Please try again."
          );
        }
      } catch (error) {
        console.error("Error creating deal:", error);
        toast.error("Failed to create deal. Please try again.");
      }
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Error creating deal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Back from Preview ---
  const handleBackFromPreview = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  const getFieldError = (field) => validationErrors[field];
  const isFieldTouched = (field) => touched[field] || isSubmitted;

  const isFacilityFieldTouched = (facilityIndex, field) =>
    touched[`deal_facilities[${facilityIndex}].${field}`] || isSubmitted;

  const MultiSelectDropdown = ({
    dealId,
    options,
    selectedValues,
    onSelectionChange,
    placeholder = "Select options...",
    label,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(
      (option) =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedValues.some(
          (selected) =>
            selected.id === option.id && selected.name === option.name
        )
    );

    const getOptionKey = (option) => option.id + "-" + option.name;

    const handleOptionClick = (option) => {
      if (
        !selectedValues.some(
          (selected) =>
            selected.id === option.id && selected.name === option.name
        )
      ) {
        const newSelected = [...selectedValues, option];
        onSelectionChange(dealId, newSelected);
      }
      setSearchTerm("");
      setIsOpen(false);
      if (inputRef.current) inputRef.current.blur();
    };

    const handleRemoveItem = (item) => {
      const newSelected = selectedValues.filter(
        (selected) => !(selected.id === item.id && selected.name === item.name)
      );
      onSelectionChange(dealId, newSelected);
    };

    const handleBlur = (e) => {
      setTimeout(() => {
        if (
          document.activeElement !== inputRef.current &&
          (!dropdownRef.current ||
            !dropdownRef.current.contains(document.activeElement))
        ) {
          setIsOpen(false);
        }
      }, 100);
    };

    return (
      <div className="multiselect-container" style={{ position: "relative" }}>
        <label className="form-label">{label}</label>
        {selectedValues.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "8px",
              padding: "8px",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            {selectedValues.map((item) => (
              <div
                key={getOptionKey(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <span>{item.name}</span>
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => handleRemoveItem(item)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    padding: "0",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            type="text"
            className="form-control"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={handleBlur}
            style={{ paddingRight: "30px" }}
            autoComplete="off"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (inputRef.current) inputRef.current.focus();
            }}
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
            aria-label="Toggle dropdown"
          >
            <Plus size={16} />
          </button>
        </div>

        {isOpen && (
          <div
            ref={dropdownRef}
            tabIndex={-1}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              zIndex: 1000,
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={getOptionKey(option)}
                  onClick={() => handleOptionClick(option)}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f1f5f9",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f8fafc")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "white")
                  }
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleOptionClick(option);
                    }
                  }}
                  aria-label={`Select ${option.name}`}
                >
                  <div style={{ fontWeight: "500", fontSize: "14px" }}>
                    {option.name}
                  </div>
                  {option.role && (
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {option.role}
                    </div>
                  )}
                  {option.email && (
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {option.email}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div
                style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}
              >
                No options available
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (showLocationForm) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="form-container">
              <div className="form-section text-center">
                <div className="mb-4">
                  <MapPin size={64} className="text-primary mb-3" />
                  <h2>Select Location</h2>
                  <p className="text-muted">
                    Choose a location to start creating deals for this area
                  </p>
                </div>
                <div className="form-group mb-4">
                  <label className="form-label">Enter location (City, State)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Los Angeles, CA"
                    value={selectedLocation?.label || ""}
                    onChange={(e) => setSelectedLocation(e.target.value ? { label: e.target.value, value: e.target.value } : null)}
                  />
                </div>
                <div className="text-center">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setShowLocationForm(false)}
                    disabled={!selectedLocation}
                  >
                    Continue to Deal Creation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getErrorCount = () => Object.keys(validationErrors).length;

  return (
    <div
      className="container-fluid"
      style={{
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
        padding: "20px 0",
      }}
    >
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate("/deals")}
          >
            <ArrowLeft size={16} className="me-2" />
            Back to Deals
          </button>
          <h2 className="mb-0">Create Deal</h2>
        </div>

        {/* Validation Summary */}
        {getErrorCount() > 0 && isSubmitted && (
          <div
            className="alert alert-warning mb-4 border-0 shadow-sm"
            role="alert"
          >
            <h5 className="alert-heading">Validation Issues</h5>
            <ul className="mb-0" style={{ paddingLeft: 20 }}>
              {Object.entries(validationErrors).map(([field, msg]) => (
                <li key={field}>
                  <strong>{msg}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <style>{`
          .form-section {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
            border: 1px solid #e9ecef;
          }
          .form-section h5 {
            color: #495057;
            font-weight: 600;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid #e9ecef;
          }
          .form-control {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            font-size: 0.95rem;
            transition: all 0.2s ease;
          }
          .form-control:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
          }
          .form-select {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            font-size: 0.95rem;
            transition: all 0.2s ease;
          }
          .form-select:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
          }
          .form-label {
            font-weight: 500;
            color: #495057;
            margin-bottom: 0.5rem;
          }
          .form-label.required::after {
            content: " *";
            color: #dc3545;
          }
          .card {
            border: none;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
            margin-bottom: 1.5rem;
          }
          .card-header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 1px solid #dee2e6;
            border-radius: 12px 12px 0 0 !important;
            padding: 1.25rem 1.5rem;
          }
          .card-body {
            padding: 1.5rem;
          }
          .btn {
            border-radius: 8px;
            padding: 0.75rem 1.5rem;
            font-weight: 500;
            transition: all 0.2s ease;
          }
          .btn-primary {
            background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
            border: none;
          }
          .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
          }
          .btn-outline-primary {
            border: 2px solid #0d6efd;
            color: #0d6efd;
          }
          .btn-outline-primary:hover {
            background: #0d6efd;
            transform: translateY(-1px);
          }
          .btn-outline-danger {
            border: 2px solid #dc3545;
            color: #dc3545;
          }
          .btn-outline-danger:hover {
            background: #dc3545;
            transform: translateY(-1px);
          }
          .invalid-feedback {
            font-size: 0.875rem;
            color: #dc3545;
            margin-top: 0.25rem;
          }
          .is-invalid {
            border-color: #dc3545;
          }
          .is-invalid:focus {
            border-color: #dc3545;
            box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.15);
          }
          .alert {
            border-radius: 10px;
            border: none;
          }
          .text-primary {
            color: #0d6efd !important;
          }
          .text-muted {
            color: #6c757d !important;
          }
          @media (max-width: 768px) {
            .container-fluid {
              padding: 10px 0;
            }
            .card-body {
              padding: 1rem;
            }
            .form-section {
              padding: 1.5rem;
            }
          }
          .ai-banner {
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            color: white;
            border-radius: 12px;
            padding: 1rem 1.5rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .ai-banner-content {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          .ai-banner-icon {
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            padding: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ai-banner-text h5 {
            margin: 0;
            font-weight: 600;
          }
          .ai-banner-text p {
            margin: 0;
            opacity: 0.9;
            font-size: 0.875rem;
          }
          .confidence-badge {
            background: rgba(255,255,255,0.2);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: 600;
          }
          .documents-panel {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
            border: 1px solid #e9ecef;
            position: sticky;
            top: 20px;
          }
          .document-viewer-right {
            position: sticky;
            top: 20px;
          }
          .document-viewer-right .document-viewer-content {
            height: calc(100vh - 200px);
            min-height: 600px;
          }
          .documents-list-section {
            margin-bottom: 1rem;
          }
          .documents-list-section .documents-panel {
            position: relative;
            top: 0;
          }
          .documents-panel-header {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
          }
          .documents-panel-header:hover {
            background: #f8f9fa;
          }
          .documents-panel-header h6 {
            margin: 0;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .documents-panel-content {
            padding: 1rem;
          }
          .document-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            border-radius: 8px;
            background: #f8f9fa;
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .document-item:hover {
            background: #e9ecef;
          }
          .document-item:last-child {
            margin-bottom: 0;
          }
          .document-icon {
            background: #7c3aed;
            color: white;
            border-radius: 8px;
            padding: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .document-info {
            flex: 1;
            min-width: 0;
          }
          .document-name {
            font-weight: 500;
            font-size: 0.875rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .document-size {
            font-size: 0.75rem;
            color: #6c757d;
          }
          .document-actions {
            display: flex;
            gap: 0.25rem;
          }
          .document-action-btn {
            background: transparent;
            border: none;
            padding: 0.25rem;
            border-radius: 4px;
            color: #6c757d;
            cursor: pointer;
          }
          .document-action-btn:hover {
            background: #dee2e6;
            color: #495057;
          }
          .document-item-selected {
            background: #e8defb !important;
            border: 2px solid #7c3aed;
          }
          .document-viewer-panel {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
            border: 1px solid #e9ecef;
            overflow: hidden;
          }
          .document-viewer-header {
            padding: 0.75rem 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .document-viewer-header h6 {
            font-size: 0.875rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .document-viewer-content {
            height: 500px;
            background: #f1f3f5;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .document-iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .document-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .document-unsupported {
            text-align: center;
            padding: 2rem;
          }
          .upload-zone {
            background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
            border: 2px dashed #7c3aed;
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 1.5rem;
          }
          .upload-zone:hover {
            background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
            border-color: #6d28d9;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
          }
          .upload-zone.dragging {
            background: linear-gradient(135deg, #e8edff 0%, #ddd6fe 100%);
            border-color: #6d28d9;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
          }
          .upload-zone-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
          }
          .upload-zone-icon svg {
            color: white;
          }
          .upload-zone h5 {
            color: #374151;
            margin-bottom: 0.5rem;
            font-weight: 600;
          }
          .upload-zone p {
            color: #6b7280;
            margin-bottom: 1rem;
          }
          .upload-zone .btn-upload {
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            border: none;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s ease;
          }
          .upload-zone .btn-upload:hover {
            background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
            transform: translateY(-1px);
          }
          .upload-zone .btn-upload:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }
          .upload-zone-divider {
            display: flex;
            align-items: center;
            margin: 1.5rem 0;
            color: #9ca3af;
          }
          .upload-zone-divider::before,
          .upload-zone-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #e5e7eb;
          }
          .upload-zone-divider span {
            padding: 0 1rem;
            font-size: 0.875rem;
          }
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Upload Zone - Show when not from AI extraction */}
        {!isFromAiExtraction && (
          <div
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isExtracting && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
              multiple
              style={{ display: 'none' }}
            />
            <div className="upload-zone-icon">
              {isExtracting ? <Loader size={28} className="spin" /> : <Upload size={28} />}
            </div>
            <h5>{isExtracting ? 'Analyzing Documents...' : 'Upload & Analyze with AI'}</h5>
            <p>
              {isExtracting
                ? 'Extracting deal information from your documents'
                : 'Drag and drop files here, or click to browse'}
            </p>
            <button
              className="btn-upload"
              disabled={isExtracting}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              {isExtracting ? (
                <>
                  <Loader size={16} className="spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Select Files
                </>
              )}
            </button>
            <p className="mt-3 mb-0" style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Supports PDF, images, Excel, and Word documents
            </p>
            <div className="upload-zone-divider">
              <span>or enter deal information manually below</span>
            </div>
          </div>
        )}

        {/* AI Extraction Banner */}
        {isFromAiExtraction && (
          <div className="ai-banner">
            <div className="ai-banner-content">
              <div className="ai-banner-icon">
                <FileText size={24} />
              </div>
              <div className="ai-banner-text">
                <h5>AI-Extracted Deal</h5>
                <p>Review and edit the extracted information below</p>
              </div>
            </div>
            {aiExtractionConfidence && (
              <div className="confidence-badge">
                {aiExtractionConfidence}% confidence
              </div>
            )}
          </div>
        )}

        {/* Documents List Section - Above the form */}
        {isFromAiExtraction && uploadedFiles.length > 0 && (
          <div className="documents-list-section mb-3">
            <div className="documents-panel">
              <div
                className="documents-panel-header"
                onClick={() => setDocumentsExpanded(!documentsExpanded)}
              >
                <h6>
                  <FileText size={18} />
                  Uploaded Documents ({uploadedFiles.length}) - Click to view
                </h6>
                {documentsExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>
              {documentsExpanded && (
                <div className="documents-panel-content">
                  <div className="d-flex flex-wrap gap-2">
                    {uploadedFiles.map((file, index) => {
                      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                      const fileUrl = file.url ? `${baseUrl}${file.url}` : `${baseUrl}/api/v1/files/${file.filename}`;
                      const isSelected = selectedDocument?.url === fileUrl;
                      const fileName = file.originalName || file.name || file.filename;

                      return (
                        <div
                          key={index}
                          className={`document-item ${isSelected ? 'document-item-selected' : ''}`}
                          style={{ width: 'calc(25% - 0.5rem)', minWidth: '200px' }}
                          onClick={() => {
                            setSelectedDocument({
                              url: fileUrl,
                              name: fileName,
                              mimeType: file.mimeType
                            });
                          }}
                        >
                          <div className="document-icon">
                            <FileText size={16} />
                          </div>
                          <div className="document-info">
                            <div className="document-name" title={fileName}>
                              {fileName}
                            </div>
                            <div className="document-size">
                              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Click to view'}
                            </div>
                          </div>
                          <div className="document-actions">
                            <button
                              type="button"
                              className="document-action-btn"
                              title="Download"
                              onClick={(e) => {
                                e.stopPropagation();
                                const link = document.createElement('a');
                                link.href = fileUrl;
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="row">
          {/* Main Form Column */}
          <div className={isFromAiExtraction && uploadedFiles.length > 0 && selectedDocument ? "col-lg-6" : "col-12"}>
            <form onSubmit={handlePreview}>
          {/* Deal Information Section */}
          <div className="form-section mb-4">
            <h5>Deal Information</h5>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label required">Deal Name</label>
                <input
                  type="text"
                  className={`form-control ${
                    isFieldTouched("deal_name") && getFieldError("deal_name")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.deal_name}
                  onChange={(e) =>
                    handleInputChange("deal_name", e.target.value)
                  }
                  placeholder="Enter deal name"
                />
                {isFieldTouched("deal_name") && getFieldError("deal_name") && (
                  <div className="invalid-feedback">
                    {getFieldError("deal_name")}
                  </div>
                )}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Deal Type</label>
                <select
                  className="form-select"
                  value={dealData.deal_type}
                  onChange={(e) =>
                    handleInputChange("deal_type", e.target.value)
                  }
                >
                  <option value="Acquisition">Acquisition</option>
                  <option value="Development">Development</option>
                  <option value="Refinance">Refinance</option>
                  <option value="Lease">Lease</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Priority Level</label>
                <select
                  className="form-select"
                  value={dealData.priority_level}
                  onChange={(e) =>
                    handleInputChange("priority_level", e.target.value)
                  }
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Deal Source</label>
                <input
                  type="text"
                  className="form-control"
                  value={dealData.deal_source}
                  onChange={(e) =>
                    handleInputChange("deal_source", e.target.value)
                  }
                  placeholder="Broker Network"
                />
              </div>
              {/* Total Deal Amount */}
              <div className="col-md-6 mb-3">
                <label className="form-label">
                  Total Deal Amount (Auto-calculated)
                </label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(dealData.total_deal_amount)}
                    readOnly
                    placeholder="Auto-calculated from facilities"
                    style={{
                      backgroundColor: "#f8f9fa",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Status</label>
                <select
                  className={`form-select ${
                    isFieldTouched("status") && getFieldError("status")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                >
                  <option value="pipeline">Pipeline</option>
                  <option value="due_diligence">Due Diligence</option>
                  <option value="final_review">Final Review</option>
                  <option value="closed">Closed</option>
                </select>
                {isFieldTouched("status") && getFieldError("status") && (
                  <div className="invalid-feedback">
                    {getFieldError("status")}
                  </div>
                )}
              </div>

              {/* Location Information */}
              {/* <div className="col-12 mb-3">
                <label className="form-label">Locations</label>
                <LocationMultiSelect
                  selectedLocations={selectedLocations}
                  onLocationsChange={handleLocationsChange}
                  placeholder="Search for states or cities..."
                  maxLocations={20}
                  showType={true}
                />
                <div className="form-text">
                  Select multiple states or cities where you want to create
                  deals. You can search for specific cities or entire states.
                </div>
              </div> */}
            </div>
          </div>

          {/* Facility Count Selector */}
          <div className="card mb-4 shadow-sm border-0">
            <div className="card-body">
              <h5 className="card-title text-primary mb-3">
                How many facilities do you want to add?
              </h5>
              <div className="d-flex align-items-center gap-3">
                <input
                  type="number"
                  className="form-control"
                  style={{ width: "100px" }}
                  min="1"
                  max="100"
                  value={facilityCount}
                  onChange={(e) =>
                    handleFacilityCountChange(parseInt(e.target.value) || 1)
                  }
                />
                <span className="text-muted">facilities</span>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={addFacility}
                >
                  <Plus size={16} className="me-2" />
                  Add Facility
                </button>
              </div>
            </div>
          </div>

          {/* Facilities Section */}
          {dealData.deal_facilities.map((facility, facilityIndex) => (
            <div key={facilityIndex} className="form-section mb-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0">Facility {facilityIndex + 1}</h5>
                {facilityCount > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => removeFacility(facilityIndex)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Facility Information */}
              <h6 className="text-primary mb-3">Facility Information</h6>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Facility Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={facility.facility_name}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "facility_name",
                        e.target.value
                      )
                    }
                    placeholder="Valley Care Center"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter facility address"
                    value={facility.address || ""}
                    onChange={(e) =>
                      handleFacilityInputChange(facilityIndex, "address", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Facility Location Details */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-control"
                    value={facility.city || ""}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "city",
                        e.target.value
                      )
                    }
                    placeholder="Phoenix"
                    style={{
                      backgroundColor: facility.city ? "#f9fafb" : "white",
                    }}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-control"
                    value={facility.state || ""}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "state",
                        e.target.value
                      )
                    }
                    placeholder="AZ"
                    style={{
                      backgroundColor: facility.state ? "#f9fafb" : "white",
                    }}
                  />
                </div>
              </div>

              {/* Facility Type Selection */}
              <div className="mb-4">
                <label className="form-label">Select Facility Type(s)</label>
                <div className="d-flex flex-wrap gap-3">
                  {[
                    { value: "Skilled Nursing", label: "Skilled Nursing" },
                    { value: "Assisted Living", label: "Assisted Living" },
                    { value: "Memory Care", label: "Memory Care" },
                    {
                      value: "Independent Living",
                      label: "Independent Living",
                    },
                  ].map((type) => (
                    <div key={type.value} className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`facility_${facilityIndex}_${type.value.replace(
                          " ",
                          "_"
                        )}`}
                        checked={facility.facility_type.includes(type.value)}
                        onChange={(e) => {
                          const currentTypes = facility.facility_type;
                          let newTypes;
                          if (e.target.checked) {
                            newTypes = [...currentTypes, type.value];
                          } else {
                            newTypes = currentTypes.filter(
                              (t) => t !== type.value
                            );
                          }
                          handleFacilityTypeChange(facilityIndex, newTypes);
                        }}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`facility_${facilityIndex}_${type.value.replace(
                          " ",
                          "_"
                        )}`}
                      >
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Number of Beds for Selected Types */}
              {facility.facility_type.length > 0 && (
                <div className="mb-4">
                  <h6 className="text-primary mb-3">Number of Beds</h6>
                  <div className="row">
                    {facility.facility_type.map((type) => {
                      const bedTypeKey = type.toLowerCase().replace(" ", "_");
                      return (
                        <div key={type} className="col-md-6 mb-3">
                          <label className="form-label">
                            Number of Beds for {type}
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={formatNumberWithCommas(
                              facility.no_of_beds[bedTypeKey] || ""
                            )}
                            onChange={(e) =>
                              handleBedCountChange(
                                facilityIndex,
                                bedTypeKey,
                                e.target.value.replace(/[^0-9.]/g, "")
                              )
                            }
                            placeholder={`Enter number of beds`}
                            min={0}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Purchase Price & Structure */}
              <h6 className="text-primary mb-3">Purchase Price & Structure</h6>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Purchase Price (USD)</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="text"
                      className="form-control"
                      value={formatNumberWithCommas(facility.purchase_price)}
                      onChange={(e) =>
                        handleFacilityInputChange(
                          facilityIndex,
                          "purchase_price",
                          e.target.value.replace(/[^0-9.]/g, "")
                        )
                      }
                      placeholder="Enter Purchase Price"
                      min={0}
                    />
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Price per Bed</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="text"
                      className="form-control"
                      value={formatNumberWithCommas(facility.price_per_bed)}
                      onChange={(e) =>
                        handleFacilityInputChange(
                          facilityIndex,
                          "price_per_bed",
                          e.target.value.replace(/[^0-9.]/g, "")
                        )
                      }
                      placeholder="Enter Price per Bed"
                      min={0}
                      readOnly // Always auto-calculated
                    />
                  </div>
                </div>
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">Down Payment %</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="text"
                      className="form-control"
                      value={formatNumberWithCommas(facility.down_payment)}
                      onChange={(e) => handleFacilityInputChange(facilityIndex, 'down_payment', e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="Enter Down Payment"
                      min={0}
                      max={100}
                    />
                  </div>
                </div> */}
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">Financing Amount</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="text"
                      className="form-control"
                      value={formatNumberWithCommas(facility.financing_amount)}
                      onChange={(e) => handleFacilityInputChange(facilityIndex, 'financing_amount', e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="Enter Financing Amount"
                      min={0}
                    />
                  </div>
                </div> */}
              </div>

              {/* Revenue Information */}
              <h6 className="text-primary mb-3">Financial Information</h6>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">T12M Revenue</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="text"
                      className="form-control"
                      value={formatNumberWithCommas(
                        facility.t12m_revenue || facility.annual_revenue
                      )}
                      onChange={(e) =>
                        handleFacilityInputChange(
                          facilityIndex,
                          "t12m_revenue",
                          e.target.value.replace(/[^0-9.]/g, "")
                        )
                      }
                      placeholder="Enter T12M Revenue"
                      min={0}
                    />
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">T12M Occupancy %</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(
                      facility.t12m_occupancy || facility.current_occupancy
                    )}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "t12m_occupancy",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter T12M Occupancy %"
                    min={0}
                    max={100}
                  />
                </div>
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">Revenue Multiple</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(facility.revenue_multiple)}
                    onChange={(e) => handleFacilityInputChange(facilityIndex, 'revenue_multiple', e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Enter Revenue Multiple"
                    min={0}
                    step="0.1"
                  />
                </div> */}
              </div>

              {/* Financial Metrics */}
              {/* <h6 className="text-primary mb-3">Financial Metrics</h6> */}
              <div className="row">
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">EBITDA Multiple</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(facility.ebitda_multiple)}
                    onChange={(e) => handleFacilityInputChange(facilityIndex, 'ebitda_multiple', e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Enter EBITDA Multiple"
                    min={0}
                    step="0.1"
                  />
                </div> */}
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">Current Occupancy %</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(facility.current_occupancy)}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "current_occupancy",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter Current Occupancy"
                    min={0}
                    max={100}
                  />
                </div> */}
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">Average Daily Rate</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="text"
                      className="form-control"
                      value={formatNumberWithCommas(facility.average_daily_rate)}
                      onChange={(e) => handleFacilityInputChange(facilityIndex, 'average_daily_rate', e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="Enter Average Daily Rate"
                      min={0}
                    />
                  </div>
                </div> */}
              </div>

              {/* Additional Financial Metrics */}
              {/* <h6 className="text-primary mb-3">
                Additional Financial Metrics
              </h6> */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">T12M EBITDAR</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                  <input
                    type="text"
                    className="form-control"
                      value={formatNumberWithCommas(
                        facility.t12m_ebitdar || facility.medicare_percentage
                      )}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "t12m_ebitdar",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter T12M EBITDAR"
                    min={0}
                  />
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Current Rent/ Lease Expense
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(
                        facility.current_rent_lease_expense ||
                          facility.private_pay_percentage
                    )}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "current_rent_lease_expense",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter Current Rent/Lease Expense"
                    min={0}
                  />
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">T12M EBITDA</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(
                      facility.t12m_ebitda || facility.ebitda
                    )}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "t12m_ebitda",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter T12M EBITDA"
                    min={0}
                  />
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="label">T12M EBIT</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                  <input
                    type="text"
                    className="form-control"
                      value={formatNumberWithCommas(
                        facility.t12m_ebit || facility.target_hold_period
                      )}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "t12m_ebit",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter T12M EBIT"
                    min={0}
                  />
                  </div>
                </div>
                {/* <div className="col-md-6 mb-3">
                  <label className="form-label">Projected Cap Rate %</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(
                      facility.projected_cap_rate_percentage
                    )}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "projected_cap_rate_percentage",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter Projected Cap Rate"
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Exit Multiple</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formatNumberWithCommas(facility.exit_multiple)}
                    onChange={(e) =>
                      handleFacilityInputChange(
                        facilityIndex,
                        "exit_multiple",
                        e.target.value.replace(/[^0-9.]/g, "")
                      )
                    }
                    placeholder="Enter Exit Multiple"
                    min={0}
                    step="0.1"
                  />
                </div> */}
              </div>

              {/*Pro Forma year code below */}
              <div className="mb-4">
                <h6 className="text-primary mb-3">Pro Forma Projections</h6>

                {/* Year 1 Tab */}
                <div
                  className="accordion mb-3"
                  id={`proFormaYear1_${facilityIndex}`}
                >
                  <div className="accordion-item">
                    <h2
                      className="accordion-header"
                      id={`headingYear1_${facilityIndex}`}
                    >
                      <button
                        className="accordion-button"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapseYear1_${facilityIndex}`}
                        aria-expanded="true"
                        aria-controls={`collapseYear1_${facilityIndex}`}
                      >
                        Pro Forma Year 1
                      </button>
                    </h2>
                    <div
                      id={`collapseYear1_${facilityIndex}`}
                      className="accordion-collapse collapse show"
                      aria-labelledby={`headingYear1_${facilityIndex}`}
                      data-bs-parent={`#proFormaYear1_${facilityIndex}`}
                    >
                      <div className="accordion-body">
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual Revenue Year 1</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year1_annual_revenue || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year1_annual_revenue",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual Revenue Year 1"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBITDAR Year 1</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year1_annual_ebitdar || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year1_annual_ebitdar",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBITDAR Year 1"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual Rent Year 1</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year1_annual_rent || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year1_annual_rent",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual Rent Year 1"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBITDA Year 1</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year1_annual_ebitda || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year1_annual_ebitda",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBITDA Year 1"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Average Occupancy % Year 1</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formatNumberWithCommas(facility.proforma_year1_average_occupancy || "")}
                              onChange={(e) =>
                                handleFacilityInputChange(
                                  facilityIndex,
                                  "proforma_year1_average_occupancy",
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              placeholder="Enter Average Occupancy % Year 1"
                              min={0}
                              max={100}
                            />
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBIT Year 1</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year1_annual_ebit || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year1_annual_ebit",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBIT Year 1"
                                min={0}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
              </div>
            </div>

                {/* Year 2 Tab */}
                <div
                  className="accordion mb-3"
                  id={`proFormaYear2_${facilityIndex}`}
                >
                  <div className="accordion-item">
                    <h2
                      className="accordion-header"
                      id={`headingYear2_${facilityIndex}`}
                    >
                      <button
                        className="accordion-button collapsed"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapseYear2_${facilityIndex}`}
                        aria-expanded="false"
                        aria-controls={`collapseYear2_${facilityIndex}`}
                      >
                        Pro Forma Year 2
                      </button>
                    </h2>
                    <div
                      id={`collapseYear2_${facilityIndex}`}
                      className="accordion-collapse collapse"
                      aria-labelledby={`headingYear2_${facilityIndex}`}
                      data-bs-parent={`#proFormaYear2_${facilityIndex}`}
                    >
                      <div className="accordion-body">
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual Revenue Year 2</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year2_annual_revenue || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year2_annual_revenue",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual Revenue Year 2"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBITDAR Year 2</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year2_annual_ebitdar || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year2_annual_ebitdar",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBITDAR Year 2"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual Rent Year 2</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year2_annual_rent || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year2_annual_rent",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual Rent Year 2"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBITDA Year 2</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year2_annual_ebitda || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year2_annual_ebitda",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBITDA Year 2"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Average Occupancy % Year 2</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formatNumberWithCommas(facility.proforma_year2_average_occupancy || "")}
                              onChange={(e) =>
                                handleFacilityInputChange(
                                  facilityIndex,
                                  "proforma_year2_average_occupancy",
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              placeholder="Enter Average Occupancy % Year 2"
                              min={0}
                              max={100}
                            />
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBIT Year 2</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year2_annual_ebit || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year2_annual_ebit",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBIT Year 2"
                                min={0}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Year 3 Tab */}
                <div
                  className="accordion mb-3"
                  id={`proFormaYear3_${facilityIndex}`}
                >
                  <div className="accordion-item">
                    <h2
                      className="accordion-header"
                      id={`headingYear3_${facilityIndex}`}
                    >
                      <button
                        className="accordion-button collapsed"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapseYear3_${facilityIndex}`}
                        aria-expanded="false"
                        aria-controls={`collapseYear3_${facilityIndex}`}
                      >
                        Pro Forma Year 3
                      </button>
                    </h2>
                    <div
                      id={`collapseYear3_${facilityIndex}`}
                      className="accordion-collapse collapse"
                      aria-labelledby={`headingYear3_${facilityIndex}`}
                      data-bs-parent={`#proFormaYear3_${facilityIndex}`}
                    >
                      <div className="accordion-body">
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual Revenue Year 3</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year3_annual_revenue || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year3_annual_revenue",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual Revenue Year 3"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBITDAR Year 3</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year3_annual_ebitdar || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year3_annual_ebitdar",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBITDAR Year 3"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual Rent Year 3</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year3_annual_rent || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year3_annual_rent",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual Rent Year 3"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBITDA Year 3</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year3_annual_ebitda || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year3_annual_ebitda",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBITDA Year 3"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Average Occupancy % Year 3</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formatNumberWithCommas(facility.proforma_year3_average_occupancy || "")}
                              onChange={(e) =>
                                handleFacilityInputChange(
                                  facilityIndex,
                                  "proforma_year3_average_occupancy",
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              placeholder="Enter Average Occupancy % Year 3"
                              min={0}
                              max={100}
                            />
                          </div>
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Annual EBIT Year 3</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control"
                                value={formatNumberWithCommas(facility.proforma_year3_annual_ebit || "")}
                                onChange={(e) =>
                                  handleFacilityInputChange(
                                    facilityIndex,
                                    "proforma_year3_annual_ebit",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                placeholder="Enter Annual EBIT Year 3"
                                min={0}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Contact Information */}
          <div className="form-section mb-4">
            <h5>Contact Information</h5>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Primary Contact Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={dealData.primary_contact_name}
                  onChange={(e) =>
                    handleInputChange("primary_contact_name", e.target.value)
                  }
                  placeholder="Enter Contact Name"
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={dealData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Administrator"
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className={`form-control ${
                    isFieldTouched("phone_number") &&
                    getFieldError("phone_number")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.phone_number}
                  onChange={(e) =>
                    handleInputChange("phone_number", e.target.value)
                  }
                  placeholder="(916) 555-0123"
                />
                {isFieldTouched("phone_number") &&
                  getFieldError("phone_number") && (
                    <div className="invalid-feedback">
                      {getFieldError("phone_number")}
                    </div>
                  )}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className={`form-control ${
                    isFieldTouched("email") && getFieldError("email")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="r.martinez@valleycare.com"
                />
                {isFieldTouched("email") && getFieldError("email") && (
                  <div className="invalid-feedback">
                    {getFieldError("email")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deal Timeline */}
          <div className="form-section mb-4">
            <h5>Deal Timeline</h5>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Target Close Date</label>
                <input
                  type="date"
                  className={`form-control ${
                    isFieldTouched("target_close_date") &&
                    getFieldError("target_close_date")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.target_close_date}
                  onChange={(e) =>
                    handleInputChange("target_close_date", e.target.value)
                  }
                />
                {isFieldTouched("target_close_date") &&
                  getFieldError("target_close_date") && (
                    <div className="invalid-feedback">
                      {getFieldError("target_close_date")}
                    </div>
                  )}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">DD Period (weeks)</label>
                <input
                  type="number"
                  className={`form-control ${
                    isFieldTouched("dd_period_weeks") &&
                    getFieldError("dd_period_weeks")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.dd_period_weeks}
                  onChange={(e) =>
                    handleInputChange("dd_period_weeks", e.target.value)
                  }
                  placeholder="8"
                  min="1"
                />
                {isFieldTouched("dd_period_weeks") &&
                  getFieldError("dd_period_weeks") && (
                    <div className="invalid-feedback">
                      {getFieldError("dd_period_weeks")}
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Team Assignment */}
          <div className="form-section mb-4">
            <h5>Team Assignment</h5>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label required">Deal Lead</label>
                <select
                  className={`form-select ${
                    isFieldTouched("deal_lead_id") &&
                    getFieldError("deal_lead_id")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.deal_lead_id || ""}
                  onChange={(e) =>
                    handleInputChange("deal_lead_id", e.target.value)
                  }
                >
                  <option value="">Select user</option>
                  {usersData.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
                {isFieldTouched("deal_lead_id") &&
                  getFieldError("deal_lead_id") && (
                    <div className="invalid-feedback">
                      {getFieldError("deal_lead_id")}
                    </div>
                  )}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Assistant Deal Lead</label>
                <select
                  className={`form-select ${
                    isFieldTouched("assistant_deal_lead_id") &&
                    getFieldError("assistant_deal_lead_id")
                      ? "is-invalid"
                      : ""
                  }`}
                  value={dealData.assistant_deal_lead_id || ""}
                  onChange={(e) =>
                    handleInputChange("assistant_deal_lead_id", e.target.value)
                  }
                >
                  <option value="">Select user</option>
                  {usersData.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
                {isFieldTouched("assistant_deal_lead_id") &&
                  getFieldError("assistant_deal_lead_id") && (
                    <div className="invalid-feedback">
                      {getFieldError("assistant_deal_lead_id")}
                    </div>
                  )}
              </div>
            </div>

            <div className="mb-3">
              <MultiSelectDropdown
                dealId={0}
                label="Core Team Members"
                options={usersData.map((user) => ({
                  id: user.id,
                  name: user.first_name + " " + user.last_name,
                  role: user.role,
                  email: user.email,
                }))}
                selectedValues={dealData.deal_team_members || []}
                onSelectionChange={(dealId, selectedMembers) => {
                  handleInputChange(
                    "deal_team_members",
                    selectedMembers.map((member) => ({
                      ...member,
                      type: "core",
                    }))
                  );
                }}
                placeholder="Search and select team members..."
              />
            </div>

            <div className="mb-3">
              <MultiSelectDropdown
                dealId={0}
                label="External Advisors"
                options={usersData.map((user) => ({
                  id: user.id,
                  name: user.first_name + " " + user.last_name,
                  role: user.role,
                  email: user.email,
                }))}
                selectedValues={dealData.deal_external_advisors || []}
                onSelectionChange={(dealId, selectedMembers) => {
                  handleInputChange(
                    "deal_external_advisors",
                    selectedMembers.map((advisor) => ({
                      ...advisor,
                      assigned: true,
                    }))
                  );
                }}
                placeholder="Search and select external advisors..."
              />
            </div>
          </div>

          {/* Notification Settings */}
          <div className="form-section mb-4">
            <h5>Notification Settings</h5>
            <div className="form-check mb-2">
              <input
                type="checkbox"
                className="form-check-input"
                id="email_notification_major_updates"
                checked={
                  dealData.notificationSettings
                    ?.email_notification_major_updates ?? false
                }
                onChange={() =>
                  handleInputChange("notificationSettings", {
                    ...dealData.notificationSettings,
                    email_notification_major_updates:
                      !dealData.notificationSettings
                        ?.email_notification_major_updates,
                  })
                }
              />
              <label
                className="form-check-label"
                htmlFor="email_notification_major_updates"
              >
                Email notifications for major updates
              </label>
            </div>
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="document_upload_notification"
                checked={
                  dealData.notificationSettings?.document_upload_notification ??
                  false
                }
                onChange={() =>
                  handleInputChange("notificationSettings", {
                    ...dealData.notificationSettings,
                    document_upload_notification:
                      !dealData.notificationSettings
                        ?.document_upload_notification,
                  })
                }
              />
              <label
                className="form-check-label"
                htmlFor="document_upload_notification"
              >
                Document upload notifications
              </label>
            </div>
          </div>

          <div className="text-center mt-4">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
            >
              {loading ? "Processing..." : "Preview Deal"}
            </button>
          </div>
            </form>
          </div>

          {/* Document Viewer Panel (right side) - Only shows when document is selected */}
          {isFromAiExtraction && uploadedFiles.length > 0 && selectedDocument && (
            <div className="col-lg-6">
              <div className="document-viewer-right">
                <div className="document-viewer-panel">
                  <div className="document-viewer-header">
                    <h6 className="mb-0">
                      <FileText size={16} className="me-2" />
                      {selectedDocument.name}
                    </h6>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setSelectedDocument(null)}
                      aria-label="Close"
                    />
                  </div>
                  <div className="document-viewer-content">
                    {selectedDocument.mimeType?.includes('pdf') || selectedDocument.url?.endsWith('.pdf') ? (
                      <iframe
                        src={selectedDocument.url}
                        title={selectedDocument.name}
                        className="document-iframe"
                      />
                    ) : selectedDocument.mimeType?.startsWith('image/') ||
                       /\.(png|jpg|jpeg|gif|webp)$/i.test(selectedDocument.url) ? (
                      <img
                        src={selectedDocument.url}
                        alt={selectedDocument.name}
                        className="document-image"
                      />
                    ) : /\.(xlsx?|xls|csv)$/i.test(selectedDocument.url) ||
                        selectedDocument.mimeType?.includes('spreadsheet') ||
                        selectedDocument.mimeType?.includes('excel') ? (
                      <div className="document-unsupported">
                        <div className="excel-icon mb-3" style={{ fontSize: '48px' }}>📊</div>
                        <h5 className="mb-2">{selectedDocument.name}</h5>
                        <p className="text-muted mb-3">
                          Excel/CSV files cannot be previewed in the browser.<br />
                          Download the file to view it in Excel or Google Sheets.
                        </p>
                        <a
                          href={selectedDocument.url}
                          download={selectedDocument.name}
                          className="btn btn-success btn-sm me-2"
                        >
                          <Download size={14} className="me-1" />
                          Download File
                        </a>
                        <a
                          href={selectedDocument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-secondary btn-sm"
                        >
                          Open in New Tab
                        </a>
                      </div>
                    ) : (
                      <div className="document-unsupported">
                        <FileText size={48} className="text-muted mb-3" />
                        <p className="text-muted mb-3">
                          Preview not available for this file type.
                        </p>
                        <a
                          href={selectedDocument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                        >
                          Open in New Tab
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title">Preview Deal Before Creation</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleBackFromPreview}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info mb-4">
                    <h5 className="alert-heading">Review Your Deal</h5>
                    <p className="mb-0">
                      Please review your deal below. Once you confirm, it will
                      be created in the system.
                    </p>
                  </div>
                  {/* Display the location */}
                  <div className="card bg-light mb-4">
                    <div className="card-body">
                      <h6 className="text-primary mb-2">
                        <MapPin
                          size={18}
                          className="me-2"
                          style={{ display: "inline" }}
                        />
                        Locations
                      </h6>
                      {selectedLocations && selectedLocations.length > 0 ? (
                        <div className="d-flex flex-wrap gap-2">
                          {selectedLocations.map((location, index) => (
                            <span
                              key={location.place_id}
                              className={`badge ${
                                location.type === "state"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              } px-3 py-2`}
                            >
                              <MapPin size={14} className="me-1" />
                              {location.type === "state"
                                ? location.state
                                : location.city && location.state
                                ? `${location.city}, ${location.state}`
                                : location.description}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-0 text-muted">
                          <strong>No locations selected</strong>
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Deal Information */}
                  <div className="card mb-4">
                    <div className="card-header bg-light">
                      <h5 className="mb-0">
                        Deal: {previewData?.deal_name || "Unnamed Deal"}
                      </h5>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <h6 className="text-primary mb-3">
                            Basic Information
                          </h6>
                          <ul className="list-unstyled">
                            <li>
                              <strong>Deal Name:</strong>{" "}
                              {previewData?.deal_name}
                            </li>
                            <li>
                              <strong>Deal Type:</strong>{" "}
                              {previewData?.deal_type}
                            </li>
                            <li>
                              <strong>Priority:</strong>{" "}
                              {previewData?.priority_level}
                            </li>
                            <li>
                              <strong>Status:</strong>{" "}
                              {previewData?.status || "pipeline"}
                            </li>
                            <li>
                              <strong>Source:</strong>{" "}
                              {previewData?.deal_source || "N/A"}
                            </li>
                            <li>
                              <strong>Total Deal Amount:</strong>{" "}
                              {formatNumberWithCommas(
                                previewData?.total_deal_amount
                              )}
                            </li>
                          </ul>
                        </div>
                        <div className="col-md-6">
                          <h6 className="text-primary mb-3">
                            Contact & Timeline
                          </h6>
                          <ul className="list-unstyled">
                            <li>
                              <strong>Primary Contact:</strong>{" "}
                              {previewData?.primary_contact_name || "N/A"}
                            </li>
                            <li>
                              <strong>Phone:</strong>{" "}
                              {previewData?.phone_number || "N/A"}
                            </li>
                            <li>
                              <strong>Email:</strong>{" "}
                              {previewData?.email || "N/A"}
                            </li>
                            <li>
                              <strong>Target Close Date:</strong>{" "}
                              {previewData?.target_close_date || "N/A"}
                            </li>
                            <li>
                              <strong>DD Period:</strong>{" "}
                              {previewData?.dd_period_weeks
                                ? `${previewData.dd_period_weeks} weeks`
                                : "N/A"}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Facilities Information */}
                  {previewData?.deal_facilities?.map((facility, index) => (
                    <div key={index} className="card mb-4">
                      <div className="card-header bg-light">
                        <h5 className="mb-0">
                          Facility {index + 1}: {facility.facility_name}
                        </h5>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <h6 className="text-primary mb-3">
                              Facility Information
                            </h6>
                            <ul className="list-unstyled">
                              <li>
                                <strong>Facility Name:</strong>{" "}
                                {facility.facility_name}
                              </li>
                              <li>
                                <strong>Address:</strong>{" "}
                                {facility.address || "N/A"}
                              </li>
                              <li>
                                <strong>City:</strong> {facility.city || "N/A"}
                              </li>
                              <li>
                                <strong>State:</strong>{" "}
                                {facility.state || "N/A"}
                              </li>
                              <li>
                                <strong>Facility Type:</strong>{" "}
                                {Array.isArray(facility.facility_type)
                                  ? facility.facility_type.join(", ")
                                  : facility.facility_type}
                              </li>
                              <li>
                                <strong>Bed Counts:</strong>
                                {Array.isArray(facility.no_of_beds)
                                  ? facility.no_of_beds
                                      .map((bed) => `${bed.type}: ${bed.count}`)
                                      .join(", ")
                                  : Object.entries(facility.no_of_beds)
                                      .filter(
                                        ([key, value]) => value && value !== ""
                                      )
                                      .map(
                                        ([type, count]) =>
                                          `${type
                                            .replace("_", " ")
                                            .replace(/\b\w/g, (l) =>
                                              l.toUpperCase()
                                            )}: ${formatNumberWithCommas(
                                            count
                                          )}`
                                      )
                                      .join(", ") || "N/A"}
                              </li>
                            </ul>
                          </div>
                          <div className="col-md-6">
                            <h6 className="text-primary mb-3">
                              Financial Information
                            </h6>
                            <ul className="list-unstyled">
                              <li>
                                <strong>Purchase Price:</strong>{" "}
                                {formatNumberWithCommas(
                                  facility.purchase_price
                                )}
                              </li>
                              <li>
                                <strong>Annual Revenue:</strong>{" "}
                                {formatNumberWithCommas(
                                  facility.annual_revenue
                                )}
                              </li>
                              <li>
                                <strong>EBITDA:</strong>{" "}
                                {formatNumberWithCommas(facility.ebitda)}
                              </li>
                              <li>
                                <strong>Price per Bed:</strong>{" "}
                                {facility.price_per_bed
                                  ? formatNumberWithCommas(
                                      facility.price_per_bed
                                    )
                                  : "N/A"}
                              </li>
                              <li>
                                <strong>Down Payment:</strong>{" "}
                                {facility.down_payment
                                  ? `${formatNumberWithCommas(
                                      facility.down_payment
                                    )}%`
                                  : "N/A"}
                              </li>
                              <li>
                                <strong>Financing Amount:</strong>{" "}
                                {facility.financing_amount
                                  ? formatNumberWithCommas(
                                      facility.financing_amount
                                    )
                                  : "N/A"}
                              </li>
                              <li>
                                <strong>Average Daily Rate:</strong>{" "}
                                {facility.average_daily_rate
                                  ? formatNumberWithCommas(
                                      facility.average_daily_rate
                                    )
                                  : "N/A"}
                              </li>
                            </ul>
                          </div>
                        </div>
                        
                        {/* Pro Forma Projections */}
                        <div className="row mt-4">
                          <div className="col-12">
                            <h6 className="text-primary mb-3">
                              Pro Forma Projections
                            </h6>
                            <div className="row">
                              {/* Year 1 */}
                              <div className="col-md-4">
                                <h6 className="text-secondary mb-2">Year 1</h6>
                                <ul className="list-unstyled small">
                                  <li>
                                    <strong>Annual Revenue:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year1_annual_revenue || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual EBITDAR:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year1_annual_ebitdar || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual Rent:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year1_annual_rent || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual EBITDA:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year1_annual_ebitda || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Average Occupancy:</strong>{" "}
                                    {facility.proforma_year1_average_occupancy
                                      ? `${formatNumberWithCommas(
                                          facility.proforma_year1_average_occupancy
                                        )}%`
                                      : "N/A"}
                                  </li>
                                  <li>
                                    <strong>Annual EBIT:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year1_annual_ebit || "N/A"
                                    )}
                                  </li>
                                </ul>
                              </div>
                              
                              {/* Year 2 */}
                              <div className="col-md-4">
                                <h6 className="text-secondary mb-2">Year 2</h6>
                                <ul className="list-unstyled small">
                                  <li>
                                    <strong>Annual Revenue:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year2_annual_revenue || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual EBITDAR:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year2_annual_ebitdar || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual Rent:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year2_annual_rent || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual EBITDA:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year2_annual_ebitda || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Average Occupancy:</strong>{" "}
                                    {facility.proforma_year2_average_occupancy
                                      ? `${formatNumberWithCommas(
                                          facility.proforma_year2_average_occupancy
                                        )}%`
                                      : "N/A"}
                                  </li>
                                  <li>
                                    <strong>Annual EBIT:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year2_annual_ebit || "N/A"
                                    )}
                                  </li>
                                </ul>
                              </div>
                              
                              {/* Year 3 */}
                              <div className="col-md-4">
                                <h6 className="text-secondary mb-2">Year 3</h6>
                                <ul className="list-unstyled small">
                                  <li>
                                    <strong>Annual Revenue:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year3_annual_revenue || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual EBITDAR:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year3_annual_ebitdar || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual Rent:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year3_annual_rent || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Annual EBITDA:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year3_annual_ebitda || "N/A"
                                    )}
                                  </li>
                                  <li>
                                    <strong>Average Occupancy:</strong>{" "}
                                    {facility.proforma_year3_average_occupancy
                                      ? `${formatNumberWithCommas(
                                          facility.proforma_year3_average_occupancy
                                        )}%`
                                      : "N/A"}
                                  </li>
                                  <li>
                                    <strong>Annual EBIT:</strong>{" "}
                                    {formatNumberWithCommas(
                                      facility.proforma_year3_annual_ebit || "N/A"
                                    )}
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    onClick={handleBackFromPreview}
                  >
                    <ArrowLeft size={16} className="me-2" />
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-lg"
                    onClick={handleFinalSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Creating Deal...
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="me-2" />
                        Create Deal
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CombinedDealForm;
