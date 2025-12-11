import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Trash2,
  Plus,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as Yup from "yup";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { updateBatchDeals, getMasterDealById } from "../api/DealService";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { getActiveUsers } from "../api/authService";

// Validation schema for the combined form (without address fields)
const combinedValidationSchema = Yup.object().shape({
  deal_name: Yup.string()
    .required("Deal name is required")
    .min(2, "Deal name must be at least 2 characters"),
  facility_name: Yup.string()
    .required("Facility name is required")
    .min(2, "Facility name must be at least 2 characters"),
  facility_type: Yup.string().required("Facility type is required"),
  bed_count: Yup.number()
    .typeError("Number of beds must be a number")
    .required("Number of beds is required"),
  purchase_price: Yup.number()
    .typeError("Purchase price must be a number")
    .required("Purchase price is required"),
  annual_revenue: Yup.number()
    .typeError("Annual revenue must be a number")
    .required("Annual revenue is required"),
  ebitda: Yup.number()
    .typeError("EBITDA must be a number")
    .required("EBITDA is required"),
  // Optional numeric fields - allow empty values
  price_per_bed: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Price per bed must be a number"),
  down_payment: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Down payment must be a number")
    .min(0, "Down payment cannot be negative")
    .max(100, "Down payment cannot exceed 100%"),
  financing_amount: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Financing amount must be a number"),
  revenue_multiple: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Revenue multiple must be a number"),
  ebitda_multiple: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("EBITDA multiple must be a number"),
  current_occupancy: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Current occupancy must be a number")
    .min(0, "Occupancy cannot be negative")
    .max(100, "Occupancy cannot exceed 100%"),
  average_daily_rate: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Average daily rate must be a number"),
  medicare_percentage: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Medicare percentage must be a number")
    .min(0, "Percentage cannot be negative")
    .max(100, "Percentage cannot exceed 100%"),
  private_pay_percentage: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Private pay percentage must be a number")
    .min(0, "Percentage cannot be negative")
    .max(100, "Percentage cannot exceed 100%"),
  target_irr_percentage: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Target IRR percentage must be a number"),
  target_hold_period: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Target hold period must be a number"),
  projected_cap_rate_percentage: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Projected cap rate percentage must be a number"),
  exit_multiple: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Exit multiple must be a number"),
  deal_lead_id: Yup.number()
    .required("Deal lead is required")
    .min(1, "Deal lead is required"),
  // Optional string fields
  phone_number: Yup.string()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .matches(
      /^\+?[1-9]\d{1,14}$/,
      "Invalid phone number format"
    ),
  email: Yup.string()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .email("Invalid email address"),
  target_close_date: Yup.date()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("Target close date must be a valid date"),
  dd_period_weeks: Yup.number()
    .transform((value, originalValue) => originalValue === '' ? null : value)
    .nullable()
    .typeError("DD period must be a number")
    .min(1, "DD period must be at least 1 week"),
});

// Initial form data structure for a single deal (without address fields)
const getInitialDealData = () => ({
  deal_name: "",
  deal_type: "Acquisition",
  priority_level: "High",
  deal_source: "",
  facility_name: "",
  facility_type: "Skilled Nursing",
  bed_count: "",
  primary_contact_name: "",
  phone_number: "",
  email: "",
  target_close_date: "",
  dd_period_weeks: "",
  title: "",
  status: "pipeline",
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
  deal_lead_id: 1,
  assistant_deal_lead_id: 1,
  deal_team_members: [],
  deal_external_advisors: [],
  notificationSettings: {
    email_notification_major_updates: false,
    document_upload_notification: false,
  },
});

const EditCombinedDealForm = () => {
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const [deals, setDeals] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [usersData, setUsersData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDeals, setPreviewDeals] = useState([]);
  const [masterDealData, setMasterDealData] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      fetchMasterDeal();
      fetchUsers();
    }
  }, [id]);

  const fetchMasterDeal = async () => {
    try {
      setInitialLoading(true);
      const response = await getMasterDealById(id);
      
      if (response.success && response.body) {
        const masterDeal = response.body;
        setMasterDealData(masterDeal);

        // Set location data
        if (masterDeal.street_address || masterDeal.city || masterDeal.state) {
          const address = {
            street_address: masterDeal.street_address || '',
            city: masterDeal.city || '',
            state: masterDeal.state || '',
            country: masterDeal.country || 'United States',
            zip_code: masterDeal.zip_code || ''
          };
          setLocationAddress(address);
          
          // Create a location object for the Google Places component
          const locationLabel = [
            address.street_address,
            address.city,
            address.state,
            address.zip_code,
            address.country
          ].filter(Boolean).join(', ');
          
          setSelectedLocation({ label: locationLabel });
        }

        // Set deals data
        if (masterDeal.deals && masterDeal.deals.length > 0) {
          const formattedDeals = masterDeal.deals.map((deal, index) => ({
            id: deal.id || index + 1,
            data: {
              ...getInitialDealData(),
              ...deal,
              // Format date fields
              target_close_date: deal.target_close_date ? 
                new Date(deal.target_close_date).toISOString().split('T')[0] : '',
              // Ensure numeric fields are strings for form inputs
              bed_count: deal.bed_count?.toString() || '',
              purchase_price: deal.purchase_price?.toString() || '',
              annual_revenue: deal.annual_revenue?.toString() || '',
              ebitda: deal.ebitda?.toString() || '',
              price_per_bed: deal.price_per_bed?.toString() || '',
              down_payment: deal.down_payment?.toString() || '',
              financing_amount: deal.financing_amount?.toString() || '',
              revenue_multiple: deal.revenue_multiple?.toString() || '',
              ebitda_multiple: deal.ebitda_multiple?.toString() || '',
              current_occupancy: deal.current_occupancy?.toString() || '',
              average_daily_rate: deal.average_daily_rate?.toString() || '',
              medicare_percentage: deal.medicare_percentage?.toString() || '',
              private_pay_percentage: deal.private_pay_percentage?.toString() || '',
              target_irr_percentage: deal.target_irr_percentage?.toString() || '',
              target_hold_period: deal.target_hold_period?.toString() || '',
              projected_cap_rate_percentage: deal.projected_cap_rate_percentage?.toString() || '',
              exit_multiple: deal.exit_multiple?.toString() || '',
              dd_period_weeks: deal.dd_period_weeks?.toString() || '',
              // Handle team members - transform from API format to component format
              deal_team_members: deal.deal_team_members ? deal.deal_team_members.map(member => ({
                id: member.user_id || member.id,
                name: member.user ? `${member.user.first_name} ${member.user.last_name}` : 
                      `${member.first_name || ''} ${member.last_name || ''}`.trim(),
                type: "core"
              })) : [],
              // Handle external advisors - transform from API format to component format
              deal_external_advisors: deal.deal_external_advisors ? deal.deal_external_advisors.map(advisor => ({
                id: advisor.user_id || advisor.id,
                name: advisor.user ? `${advisor.user.first_name} ${advisor.user.last_name}` : 
                      `${advisor.first_name || ''} ${advisor.last_name || ''}`.trim(),
                assigned: true
              })) : [],
              // Handle notification settings
              notificationSettings: {
                email_notification_major_updates: deal.email_notification_major_updates === 'yes',
                document_upload_notification: deal.document_upload_notification === 'yes',
              },
            },
            isExpanded: index === 0 // Expand first deal by default
          }));
          
          setDeals(formattedDeals);
        } else {
          // If no deals, create one empty deal
          setDeals([{ id: 1, data: getInitialDealData(), isExpanded: true }]);
        }
      } else {
        toast.error("Failed to load master deal data");
        navigate("/deals");
      }
    } catch (error) {
      console.error("Error fetching master deal:", error);
      toast.error("Error loading master deal data");
      navigate("/deals");
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await getActiveUsers();
      setUsersData(response.body);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Handle location selection and extract address
  const handleLocationSelect = (place) => {
    if (place) {
      setSelectedLocation(place);

      // Extract address components from the selected location
      const addressParts = place.label.split(', ');
      const address = {
        street_address: place.label,
        city: '',
        state: '',
        country: '',
        zip_code: ''
      };

      // Parse address components based on typical format
      if (addressParts.length >= 2) {
        // Usually format is: "City, State, Country" or "City, State Zip, Country"
        address.city = addressParts[0] || '';

        if (addressParts.length >= 3) {
          // Check if second part contains state and zip
          const statePart = addressParts[1].trim();
          const stateMatch = statePart.match(/^([A-Z]{2})\s*(\d{5})?/);

          if (stateMatch) {
            address.state = stateMatch[1] || '';
            address.zip_code = stateMatch[2] || '';
          } else {
            address.state = statePart;
          }

          address.country = addressParts[addressParts.length - 1] || 'United States';
        } else if (addressParts.length === 2) {
          address.state = addressParts[1];
          address.country = 'United States';
        }
      }

      setLocationAddress(address);
      setShowLocationForm(false);
    }
  };

  // Validate a single field
  const validateField = (field, value) => {
    try {
      const fieldSchema = combinedValidationSchema.fields[field];
      if (fieldSchema) {
        // For optional fields, don't show error if empty
        if (value === '' || value === null || value === undefined) {
          // Check if field is required
          const isRequired = fieldSchema.tests?.some(test => test.OPTIONS?.name === 'required');
          if (!isRequired) {
            return null; // No error for empty optional fields
          }
        }
        fieldSchema.validateSync(value);
        return null;
      }
    } catch (error) {
      return error.message;
    }
    return null;
  };

  // Validate entire deal data
  const validateDealData = (dealData) => {
    const errors = {};
    try {
      combinedValidationSchema.validateSync(dealData, { abortEarly: false });
    } catch (validationError) {
      validationError.inner.forEach(error => {
        errors[error.path] = error.message;
      });
    }
    return errors;
  };

  // Handle input changes for a specific deal with real-time validation
  const handleInputChange = (dealId, field, value) => {
    // Update the deal data
    setDeals(prevDeals =>
      prevDeals.map(deal =>
        deal.id === dealId
          ? { ...deal, data: { ...deal.data, [field]: value } }
          : deal
      )
    );

    // Perform real-time validation
    const error = validateField(field, value);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      const errorKey = `${dealId}_${field}`;

      if (error) {
        newErrors[errorKey] = error;
      } else {
        delete newErrors[errorKey];
      }

      return newErrors;
    });

    // Mark field as touched
    setTouched(prev => ({ ...prev, [`${dealId}_${field}`]: true }));
  };

  // This function is no longer needed as we're removing individual address selection
  // Keeping empty for backward compatibility if referenced elsewhere

  // Add new deal
  const addNewDeal = () => {
    const newDealId = Math.max(...deals.map(d => d.id)) + 1;
    setDeals(prev => [...prev, {
      id: newDealId,
      data: getInitialDealData(),
      isExpanded: false
    }]);
  };

  // Remove deal
  const removeDeal = (dealId) => {
    if (deals.length > 1) {
      setDeals(prev => prev.filter(deal => deal.id !== dealId));
    }
  };

  // Toggle deal expansion
  const toggleDealExpansion = (dealId) => {
    setDeals(prev =>
      prev.map(deal =>
        deal.id === dealId
          ? { ...deal, isExpanded: !deal.isExpanded }
          : deal
      )
    );
  };

  // Handle preview before submission
  const handlePreview = (e) => {
    e.preventDefault();

    // Validate all deals
    const allErrors = {};
    let hasErrors = false;

    deals.forEach(deal => {
      const errors = validateDealData(deal.data);
      Object.entries(errors).forEach(([field, error]) => {
        allErrors[`${deal.id}_${field}`] = error;
        hasErrors = true;
      });
    });

    if (hasErrors) {
      setValidationErrors(allErrors);
      // Mark all fields as touched to show errors
      const newTouched = {};
      Object.keys(allErrors).forEach(key => {
        newTouched[key] = true;
      });
      setTouched(prev => ({ ...prev, ...newTouched }));

      toast.error("Please fix all validation errors before proceeding");

      // Expand all deals with errors
      const dealsWithErrors = new Set();
      Object.keys(allErrors).forEach(key => {
        const dealId = parseInt(key.split('_')[0]);
        dealsWithErrors.add(dealId);
      });

      setDeals(prevDeals =>
        prevDeals.map(deal =>
          dealsWithErrors.has(deal.id)
            ? { ...deal, isExpanded: true }
            : deal
        )
      );

      return;
    }

    // If validation passes, show preview
    setPreviewDeals(deals);
    setShowPreview(true);
  };

  // Handle final submission after preview confirmation
  const handleFinalSubmit = async () => {
    setLoading(true);
    setShowPreview(false);

    try {
      // Prepare the payload with single address and array of deals
      const payload = {
        master_deal_id: id,
        address: locationAddress || {
          street_address: selectedLocation?.label || '',
          city: '',
          state: '',
          country: 'United States',
          zip_code: ''
        },
        deals: deals.map(deal => ({
          ...deal.data,
          id: deal.data.id || undefined // Include ID for existing deals, undefined for new ones
        }))
      };

      // Submit the batch of deals with single address
      try {
        const response = await updateBatchDeals(payload);
        if (response.success === true && response.code === 200) {
          const updatedDealsData = response.body || response;

          // Check if response is an array or contains an array of deals
          const dealsArray = Array.isArray(updatedDealsData) ? updatedDealsData :
            updatedDealsData.deals ? updatedDealsData.deals :
              [updatedDealsData];

          toast.success(response.message || `All ${dealsArray.length} deals updated successfully!`);
          navigate("/deals");
        } else {
          toast.error(response.message || "Failed to update deals. Please try again.");
        }
      } catch (error) {
        console.error('Error updating deals:', error);
        toast.error('Failed to update deals. Please try again.');
      }
    } catch (error) {
      console.error("Error updating deals:", error);
      toast.error("Error updating deals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle going back from preview
  const handleBackFromPreview = () => {
    setShowPreview(false);
    setPreviewDeals([]);
  };

  // Get error for a specific field in a specific deal
  const getFieldError = (dealId, field) => {
    return validationErrors[`${dealId}_${field}`];
  };

  // Check if field is touched for a specific deal
  const isFieldTouched = (dealId, field) => {
    return touched[`${dealId}_${field}`];
  };

  // Mark field as touched and validate
  const markFieldAsTouched = (dealId, field) => {
    setTouched(prev => ({ ...prev, [`${dealId}_${field}`]: true }));

    // Find the deal and validate the field
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      const error = validateField(field, deal.data[field]);
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        const errorKey = `${dealId}_${field}`;

        if (error) {
          newErrors[errorKey] = error;
        } else {
          delete newErrors[errorKey];
        }

        return newErrors;
      });
    }
  };

  // MultiSelect Dropdown Component
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
          (selected) => selected.id === option.id && selected.name === option.name
        )
    );

    const getOptionKey = (option) => option.id + "-" + option.name;

    const handleOptionClick = (option) => {
      if (
        !selectedValues.some(
          (selected) => selected.id === option.id && selected.name === option.name
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
            className="form-input"
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

  // Show loading spinner while fetching data
  if (initialLoading) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-lg-8 text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading master deal data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Location Selection Form
  if (showLocationForm) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="form-container">
              <div className="form-section text-center">
                <div className="mb-4">
                  <MapPin size={64} className="text-primary mb-3" />
                  <h2>Update Location</h2>
                  <p className="text-muted">
                    Update the location for this master deal
                  </p>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label">Search for a location</label>
                  <GooglePlacesAutocomplete
                    apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
                    selectProps={{
                      value: selectedLocation,
                      onChange: handleLocationSelect,
                      placeholder: 'Search for a city, state, or region...',
                      isClearable: true,
                      className: 'form-input',
                    }}
                    autocompletionRequest={{
                      types: ['(cities)'],
                      componentRestrictions: {
                        country: ['us', 'ca'],
                      },
                    }}
                  />
                </div>

                <div className="text-center">
                  <button
                    className="btn btn-secondary me-3"
                    onClick={() => setShowLocationForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setShowLocationForm(false)}
                    disabled={!selectedLocation}
                  >
                    Update Location
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Count total validation errors
  const getErrorCount = () => {
    return Object.keys(validationErrors).length;
  };

  // Get errors for a specific deal
  const getDealErrorCount = (dealId) => {
    return Object.keys(validationErrors).filter(key => key.startsWith(`${dealId}_`)).length;
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate("/deals")}
        >
          <ArrowLeft size={16} className="me-2" />
          Back to Deals
        </button>
        <h2>Edit Master Deal - {selectedLocation?.label}</h2>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary"
            onClick={() => setShowLocationForm(true)}
          >
            <MapPin size={16} className="me-2" />
            Change Location
          </button>
          <button
            className="btn btn-primary"
            onClick={addNewDeal}
          >
            <Plus size={16} className="me-2" />
            Add More Deal
          </button>
        </div>
      </div>

      {/* Validation Summary */}
      {getErrorCount() > 0 && (
        <div className="alert alert-warning mb-4" role="alert">
          <h5 className="alert-heading">Validation Issues</h5>
          <p className="mb-0">
            There {getErrorCount() === 1 ? 'is' : 'are'} <strong>{getErrorCount()}</strong> validation
            {getErrorCount() === 1 ? 'error' : 'errors'} that need{getErrorCount() === 1 ? 's' : ''} to be fixed before you can proceed.
          </p>
          <div className="mt-2">
            {deals.map((deal, index) => {
              const dealErrors = getDealErrorCount(deal.id);
              if (dealErrors > 0) {
                return (
                  <span key={deal.id} className="badge bg-danger me-2">
                    Deal {index + 1}: {dealErrors} error{dealErrors !== 1 ? 's' : ''}
                  </span>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .deals-review-container {
          margin-top: 2rem;
        }
        
        .deal-review-card .card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .deal-review-card .card-header {
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 1rem;
        }
        
        .deal-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        
        .info-item {
          padding: 0.5rem;
          background-color: #f8fafc;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }
        
        .deal-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .form-input.error {
          border-color: #dc3545 !important;
          box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
        }
        
        .form-select.error {
          border-color: #dc3545 !important;
          box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
        }
        
        .error-message {
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          display: block;
        }
        
        .validation-success {
          color: #28a745;
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }
        
        .deal-header.has-errors {
          border-color: #dc3545 !important;
          background-color: #fff5f5 !important;
        }
        
        @media (max-width: 768px) {
          .deal-info-grid {
            grid-template-columns: 1fr;
          }
          
          .deal-actions {
            flex-direction: column;
          }
        }
      `}      </style>
      <form onSubmit={handlePreview}>
        {deals.map((deal, index) => (
          <div key={deal.id} className="deal-form-container mb-4">
            <div className={`deal-header ${getDealErrorCount(deal.id) > 0 ? 'has-errors' : ''}`} style={{
              backgroundColor: getDealErrorCount(deal.id) > 0 ? '#fff5f5' : '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              border: getDealErrorCount(deal.id) > 0 ? '1px solid #dc3545' : '1px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }} onClick={() => toggleDealExpansion(deal.id)}>
              <div className="d-flex align-items-center">
                <h4 className="mb-0 me-3">Deal {index + 1}</h4>
                {deal.data.deal_name && (
                  <span className="text-muted">- {deal.data.deal_name}</span>
                )}
                {getDealErrorCount(deal.id) > 0 && (
                  <span className="badge bg-danger ms-3">
                    {getDealErrorCount(deal.id)} error{getDealErrorCount(deal.id) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="d-flex align-items-center">
                {deal.isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                {deals.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm ms-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDeal(deal.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {deal.isExpanded && (
              <div className="deal-content" style={{
                padding: '24px',
                border: '1px solid #e2e8f0',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                backgroundColor: 'white'
              }}>
                <div className="row">
                  <div className="col-lg-8">
                    {/* Basic Deal Information */}
                    <h3 className="py-3">Basic Deal Information</h3>
                    <div className="form-row">
                      <div className="form-group mb-3">
                        <label className="form-label required">Deal Name</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'deal_name') && getFieldError(deal.id, 'deal_name') ? 'error' : ''
                            }`}
                          value={deal.data.deal_name}
                          onChange={(e) => handleInputChange(deal.id, 'deal_name', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'deal_name')}
                          placeholder="Enter deal name"
                        />
                        {isFieldTouched(deal.id, 'deal_name') && getFieldError(deal.id, 'deal_name') && (
                          <span className="error-message">{getFieldError(deal.id, 'deal_name')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Deal Type</label>
                        <select
                          className="form-select"
                          value={deal.data.deal_type}
                          onChange={(e) => handleInputChange(deal.id, 'deal_type', e.target.value)}
                        >
                          <option value="Acquisition">Acquisition</option>
                          <option value="Development">Development</option>
                          <option value="Refinance">Refinance</option>
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Priority Level</label>
                        <select
                          className="form-select"
                          value={deal.data.priority_level}
                          onChange={(e) => handleInputChange(deal.id, 'priority_level', e.target.value)}
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Deal Source</label>
                        <input
                          type="text"
                          className="form-input"
                          value={deal.data.deal_source}
                          onChange={(e) => handleInputChange(deal.id, 'deal_source', e.target.value)}
                          placeholder="Broker Network"
                        />
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Status</label>
                        <select
                          className={`form-select ${isFieldTouched(deal.id, 'deal_status') && getFieldError(deal.id, 'deal_status') ? 'error' : ''
                            }`}
                          value={deal.data.deal_status}
                          onChange={(e) => handleInputChange(deal.id, 'deal_status', e.target.value)}
                        >
                          <option value="pipeline">Pipeline</option>
                          <option value="due_diligence">Due Diligence</option>
                          <option value="final_review">Final Review</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    {/* Facility Information */}
                    <h3 className="py-3">Facility Information</h3>
                    <div className="form-row">
                      <div className="form-group mb-3">
                        <label className="form-label required">Facility Name</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'facility_name') && getFieldError(deal.id, 'facility_name') ? 'error' : ''
                            }`}
                          value={deal.data.facility_name}
                          onChange={(e) => handleInputChange(deal.id, 'facility_name', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'facility_name')}
                          placeholder="Valley Care Center"
                        />
                        {isFieldTouched(deal.id, 'facility_name') && getFieldError(deal.id, 'facility_name') && (
                          <span className="error-message">{getFieldError(deal.id, 'facility_name')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label required">Facility Type</label>
                        <select
                          className={`form-select ${isFieldTouched(deal.id, 'facility_type') && getFieldError(deal.id, 'facility_type') ? 'error' : ''
                            }`}
                          value={deal.data.facility_type}
                          onChange={(e) => handleInputChange(deal.id, 'facility_type', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'facility_type')}
                        >
                          <option value="Skilled Nursing">Skilled Nursing</option>
                          <option value="Assisted Living">Assisted Living</option>
                          <option value="Memory Care">Memory Care</option>
                          <option value="Independent Living">Independent Living</option>
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label required">Number of Beds</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'bed_count') && getFieldError(deal.id, 'bed_count') ? 'error' : ''
                            }`}
                          value={deal.data.bed_count}
                          onChange={(e) => handleInputChange(deal.id, 'bed_count', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'bed_count')}
                          placeholder="145"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'bed_count') && getFieldError(deal.id, 'bed_count') && (
                          <span className="error-message">{getFieldError(deal.id, 'bed_count')}</span>
                        )}
                      </div>
                    </div>



                    {/* Financial Information */}
                    <h3 className="py-3">Financial Information</h3>
                    <div className="form-row">
                      <div className="form-group mb-3">
                        <label className="form-label required">Purchase Price (USD)</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'purchase_price') && getFieldError(deal.id, 'purchase_price') ? 'error' : ''}`}
                          value={deal.data.purchase_price}
                          onChange={(e) => handleInputChange(deal.id, 'purchase_price', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'purchase_price')}
                          placeholder="Enter Purchase Price"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'purchase_price') && getFieldError(deal.id, 'purchase_price') && (
                          <span className="error-message">{getFieldError(deal.id, 'purchase_price')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label required">Annual Revenue (USD)</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'annual_revenue') && getFieldError(deal.id, 'annual_revenue') ? 'error' : ''}`}
                          value={deal.data.annual_revenue}
                          onChange={(e) => handleInputChange(deal.id, 'annual_revenue', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'annual_revenue')}
                          placeholder="Enter Annual Revenue"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'annual_revenue') && getFieldError(deal.id, 'annual_revenue') && (
                          <span className="error-message">{getFieldError(deal.id, 'annual_revenue')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label required">EBITDA (USD)</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'ebitda') && getFieldError(deal.id, 'ebitda') ? 'error' : ''}`}
                          value={deal.data.ebitda}
                          onChange={(e) => handleInputChange(deal.id, 'ebitda', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'ebitda')}
                          placeholder="Enter EBITDA"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'ebitda') && getFieldError(deal.id, 'ebitda') && (
                          <span className="error-message">{getFieldError(deal.id, 'ebitda')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Price per Bed</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'price_per_bed') && getFieldError(deal.id, 'price_per_bed') ? 'error' : ''}`}
                          value={deal.data.price_per_bed}
                          onChange={(e) => handleInputChange(deal.id, 'price_per_bed', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'price_per_bed')}
                          placeholder="Enter Price per Bed"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'price_per_bed') && getFieldError(deal.id, 'price_per_bed') && (
                          <span className="error-message">{getFieldError(deal.id, 'price_per_bed')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Down Payment %</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'down_payment') && getFieldError(deal.id, 'down_payment') ? 'error' : ''}`}
                          value={deal.data.down_payment}
                          onChange={(e) => handleInputChange(deal.id, 'down_payment', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'down_payment')}
                          placeholder="Enter Down Payment"
                          min={0}
                          max={100}
                        />
                        {isFieldTouched(deal.id, 'down_payment') && getFieldError(deal.id, 'down_payment') && (
                          <span className="error-message">{getFieldError(deal.id, 'down_payment')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Financing Amount</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'financing_amount') && getFieldError(deal.id, 'financing_amount') ? 'error' : ''}`}
                          value={deal.data.financing_amount}
                          onChange={(e) => handleInputChange(deal.id, 'financing_amount', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'financing_amount')}
                          placeholder="Enter Financing Amount"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'financing_amount') && getFieldError(deal.id, 'financing_amount') && (
                          <span className="error-message">{getFieldError(deal.id, 'financing_amount')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Revenue Multiple</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'revenue_multiple') && getFieldError(deal.id, 'revenue_multiple') ? 'error' : ''}`}
                          value={deal.data.revenue_multiple}
                          onChange={(e) => handleInputChange(deal.id, 'revenue_multiple', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'revenue_multiple')}
                          placeholder="Enter Revenue Multiple"
                          step="0.01"
                        />
                        {isFieldTouched(deal.id, 'revenue_multiple') && getFieldError(deal.id, 'revenue_multiple') && (
                          <span className="error-message">{getFieldError(deal.id, 'revenue_multiple')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">EBITDA Multiple</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'ebitda_multiple') && getFieldError(deal.id, 'ebitda_multiple') ? 'error' : ''}`}
                          value={deal.data.ebitda_multiple}
                          onChange={(e) => handleInputChange(deal.id, 'ebitda_multiple', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'ebitda_multiple')}
                          placeholder="Enter EBITDA Multiple"
                          step="0.01"
                        />
                        {isFieldTouched(deal.id, 'ebitda_multiple') && getFieldError(deal.id, 'ebitda_multiple') && (
                          <span className="error-message">{getFieldError(deal.id, 'ebitda_multiple')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Current Occupancy %</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'current_occupancy') && getFieldError(deal.id, 'current_occupancy') ? 'error' : ''}`}
                          value={deal.data.current_occupancy}
                          onChange={(e) => handleInputChange(deal.id, 'current_occupancy', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'current_occupancy')}
                          placeholder="Enter Current Occupancy"
                          min={0}
                          max={100}
                          step="0.1"
                        />
                        {isFieldTouched(deal.id, 'current_occupancy') && getFieldError(deal.id, 'current_occupancy') && (
                          <span className="error-message">{getFieldError(deal.id, 'current_occupancy')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Average Daily Rate</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'average_daily_rate') && getFieldError(deal.id, 'average_daily_rate') ? 'error' : ''}`}
                          value={deal.data.average_daily_rate}
                          onChange={(e) => handleInputChange(deal.id, 'average_daily_rate', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'average_daily_rate')}
                          placeholder="Enter Average Daily Rate"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'average_daily_rate') && getFieldError(deal.id, 'average_daily_rate') && (
                          <span className="error-message">{getFieldError(deal.id, 'average_daily_rate')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Medicare %</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'medicare_percentage') && getFieldError(deal.id, 'medicare_percentage') ? 'error' : ''}`}
                          value={deal.data.medicare_percentage}
                          onChange={(e) => handleInputChange(deal.id, 'medicare_percentage', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'medicare_percentage')}
                          placeholder="Enter Medicare %"
                          min={0}
                          max={100}
                          step="0.1"
                        />
                        {isFieldTouched(deal.id, 'medicare_percentage') && getFieldError(deal.id, 'medicare_percentage') && (
                          <span className="error-message">{getFieldError(deal.id, 'medicare_percentage')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Private Pay %</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'private_pay_percentage') && getFieldError(deal.id, 'private_pay_percentage') ? 'error' : ''}`}
                          value={deal.data.private_pay_percentage}
                          onChange={(e) => handleInputChange(deal.id, 'private_pay_percentage', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'private_pay_percentage')}
                          placeholder="Enter Private Pay"
                          min={0}
                          max={100}
                          step="0.1"
                        />
                        {isFieldTouched(deal.id, 'private_pay_percentage') && getFieldError(deal.id, 'private_pay_percentage') && (
                          <span className="error-message">{getFieldError(deal.id, 'private_pay_percentage')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Target IRR %</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'target_irr_percentage') && getFieldError(deal.id, 'target_irr_percentage') ? 'error' : ''}`}
                          value={deal.data.target_irr_percentage}
                          onChange={(e) => handleInputChange(deal.id, 'target_irr_percentage', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'target_irr_percentage')}
                          placeholder="Enter Target IRR"
                          min={0}
                          step="0.1"
                        />
                        {isFieldTouched(deal.id, 'target_irr_percentage') && getFieldError(deal.id, 'target_irr_percentage') && (
                          <span className="error-message">{getFieldError(deal.id, 'target_irr_percentage')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Target Hold Period</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'target_hold_period') && getFieldError(deal.id, 'target_hold_period') ? 'error' : ''}`}
                          value={deal.data.target_hold_period}
                          onChange={(e) => handleInputChange(deal.id, 'target_hold_period', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'target_hold_period')}
                          placeholder="Enter Target Hold Period"
                          min={0}
                        />
                        {isFieldTouched(deal.id, 'target_hold_period') && getFieldError(deal.id, 'target_hold_period') && (
                          <span className="error-message">{getFieldError(deal.id, 'target_hold_period')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Projected Cap Rate %</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'projected_cap_rate_percentage') && getFieldError(deal.id, 'projected_cap_rate_percentage') ? 'error' : ''}`}
                          value={deal.data.projected_cap_rate_percentage}
                          onChange={(e) => handleInputChange(deal.id, 'projected_cap_rate_percentage', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'projected_cap_rate_percentage')}
                          placeholder="Enter Projected Cap Rate"
                          min={0}
                          step="0.01"
                        />
                        {isFieldTouched(deal.id, 'projected_cap_rate_percentage') && getFieldError(deal.id, 'projected_cap_rate_percentage') && (
                          <span className="error-message">{getFieldError(deal.id, 'projected_cap_rate_percentage')}</span>
                        )}
                        </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Exit Multiple</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'exit_multiple') && getFieldError(deal.id, 'exit_multiple') ? 'error' : ''}`}
                          value={deal.data.exit_multiple}
                          onChange={(e) => handleInputChange(deal.id, 'exit_multiple', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'exit_multiple')}
                          placeholder="Enter Exit Multiple"
                          min={0}
                          step="0.01"
                        />
                        {isFieldTouched(deal.id, 'exit_multiple') && getFieldError(deal.id, 'exit_multiple') && (
                          <span className="error-message">{getFieldError(deal.id, 'exit_multiple')}</span>
                        )}
                      </div>
                    </div>

                    {/* Contact Information */}
                    <h3 className="py-3">Contact Information</h3>
                    <div className="form-row">
                      <div className="form-group mb-3">
                        <label className="form-label">Primary Contact Name</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'primary_contact_name') && getFieldError(deal.id, 'primary_contact_name') ? 'error' : ''}`}
                          value={deal.data.primary_contact_name}
                          onChange={(e) => handleInputChange(deal.id, 'primary_contact_name', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'primary_contact_name')}
                          placeholder="Enter Contact Name"
                        />
                        {isFieldTouched(deal.id, 'primary_contact_name') && getFieldError(deal.id, 'primary_contact_name') && (
                          <span className="error-message">{getFieldError(deal.id, 'primary_contact_name')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Title</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'title') && getFieldError(deal.id, 'title') ? 'error' : ''}`}
                          value={deal.data.title}
                          onChange={(e) => handleInputChange(deal.id, 'title', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'title')}
                          placeholder="Administrator"
                        />
                        {isFieldTouched(deal.id, 'title') && getFieldError(deal.id, 'title') && (
                          <span className="error-message">{getFieldError(deal.id, 'title')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className={`form-input ${isFieldTouched(deal.id, 'phone_number') && getFieldError(deal.id, 'phone_number') ? 'error' : ''}`}
                          value={deal.data.phone_number}
                          onChange={(e) => handleInputChange(deal.id, 'phone_number', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'phone_number')}
                          placeholder="(916) 555-0123"
                        />
                        {isFieldTouched(deal.id, 'phone_number') && getFieldError(deal.id, 'phone_number') && (
                          <span className="error-message">{getFieldError(deal.id, 'phone_number')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Email Address</label>
                        <input
                          type="email"
                          className={`form-input ${isFieldTouched(deal.id, 'email') && getFieldError(deal.id, 'email') ? 'error' : ''}`}
                          value={deal.data.email}
                          onChange={(e) => handleInputChange(deal.id, 'email', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'email')}
                          placeholder="r.martinez@valleycare.com"
                        />
                        {isFieldTouched(deal.id, 'email') && getFieldError(deal.id, 'email') && (
                          <span className="error-message">{getFieldError(deal.id, 'email')}</span>
                        )}
                      </div>
                    </div>

                    {/* Deal Timeline */}
                    <h3 className="py-3">Deal Timeline</h3>
                    <div className="form-row">
                      <div className="form-group mb-3">
                        <label className="form-label">Target Close Date</label>
                        <input
                          type="date"
                          className={`form-input ${isFieldTouched(deal.id, 'target_close_date') && getFieldError(deal.id, 'target_close_date') ? 'error' : ''}`}
                          value={deal.data.target_close_date}
                          onChange={(e) => handleInputChange(deal.id, 'target_close_date', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'target_close_date')}
                        />
                        {isFieldTouched(deal.id, 'target_close_date') && getFieldError(deal.id, 'target_close_date') && (
                          <span className="error-message">{getFieldError(deal.id, 'target_close_date')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">DD Period (weeks)</label>
                        <input
                          type="number"
                          className={`form-input ${isFieldTouched(deal.id, 'dd_period_weeks') && getFieldError(deal.id, 'dd_period_weeks') ? 'error' : ''}`}
                          value={deal.data.dd_period_weeks}
                          onChange={(e) => handleInputChange(deal.id, 'dd_period_weeks', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'dd_period_weeks')}
                          placeholder="8"
                          min="1"
                        />
                        {isFieldTouched(deal.id, 'dd_period_weeks') && getFieldError(deal.id, 'dd_period_weeks') && (
                          <span className="error-message">{getFieldError(deal.id, 'dd_period_weeks')}</span>
                        )}
                        </div>
                    </div>

                    {/* Team Assignment */}
                    <h3 className="py-3">Team Assignment</h3>
                    <div className="form-row">
                      <div className="form-group mb-3">
                        <label className="form-label required">Deal Lead</label>
                        <select
                          className={`form-select ${isFieldTouched(deal.id, 'deal_lead_id') && getFieldError(deal.id, 'deal_lead_id') ? 'error' : ''}`}
                          value={deal.data.deal_lead_id || ""}
                          onChange={(e) => handleInputChange(deal.id, 'deal_lead_id', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'deal_lead_id')}
                        >
                          <option value="">Select user</option>
                          {usersData.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.first_name} {user.last_name}
                            </option>
                          ))}
                        </select>
                        {isFieldTouched(deal.id, 'deal_lead_id') && getFieldError(deal.id, 'deal_lead_id') && (
                          <span className="error-message">{getFieldError(deal.id, 'deal_lead_id')}</span>
                        )}
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label">Assistant Deal Lead</label>
                        <select
                          className={`form-select ${isFieldTouched(deal.id, 'assistant_deal_lead_id') && getFieldError(deal.id, 'assistant_deal_lead_id') ? 'error' : ''}`}
                          value={deal.data.assistant_deal_lead_id || ""}
                          onChange={(e) => handleInputChange(deal.id, 'assistant_deal_lead_id', e.target.value)}
                          onBlur={() => markFieldAsTouched(deal.id, 'assistant_deal_lead_id')}
                        >
                          <option value="">Select user</option>
                          {usersData.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.first_name} {user.last_name}
                            </option>
                          ))}
                        </select>
                        {isFieldTouched(deal.id, 'assistant_deal_lead_id') && getFieldError(deal.id, 'assistant_deal_lead_id') && (
                          <span className="error-message">{getFieldError(deal.id, 'assistant_deal_lead_id')}</span>
                        )}
                        </div>
                    </div>

                    <div className="form-group mb-3">
                      <MultiSelectDropdown
                        dealId={deal.id}
                        label="Core Team Members"
                        options={usersData.map((user) => ({
                          id: user.id,
                          name: user.first_name + " " + user.last_name,
                          role: user.role,
                          email: user.email,
                        }))}
                        selectedValues={deal.data.deal_team_members || []}
                        onSelectionChange={(dealId, selectedMembers) => {
                          handleInputChange(dealId, 'deal_team_members', selectedMembers.map((member) => ({
                            ...member,
                            type: "core",
                          })));
                        }}
                        placeholder="Search and select team members..."
                      />
                      {isFieldTouched(deal.id, 'deal_team_members') && getFieldError(deal.id, 'deal_team_members') && (
                        <span className="error-message">{getFieldError(deal.id, 'deal_team_members')}</span>
                      )}
                    </div>

                    <div className="form-group mb-3">
                      <MultiSelectDropdown
                        dealId={deal.id}
                        label="External Advisors"
                        options={usersData.map((user) => ({
                          id: user.id,
                          name: user.first_name + " " + user.last_name,
                          role: user.role,
                          email: user.email,
                        }))}
                        selectedValues={deal.data.deal_external_advisors || []}
                        onSelectionChange={(dealId, selectedAdvisors) => {
                          handleInputChange(dealId, 'deal_external_advisors', selectedAdvisors.map((advisor) => ({
                            ...advisor,
                            assigned: true,
                          })));
                        }}
                        placeholder="Search and select external advisors..."
                      />
                      {isFieldTouched(deal.id, 'deal_external_advisors') && getFieldError(deal.id, 'deal_external_advisors') && (
                        <span className="error-message">{getFieldError(deal.id, 'deal_external_advisors')}</span>
                      )}
                    </div>

                    {/* Notification Settings */}
                    <h3 className="py-3">Notification Settings</h3>
                    <div className="notify-checkbox">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={deal.data.notificationSettings?.email_notification_major_updates ?? false}
                          onChange={() => handleInputChange(deal.id, 'notificationSettings', {
                            ...deal.data.notificationSettings,
                            email_notification_major_updates: !deal.data.notificationSettings?.email_notification_major_updates
                          })}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '14px' }}>Email notifications for major updates</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={deal.data.notificationSettings?.document_upload_notification ?? false}
                          onChange={() => handleInputChange(deal.id, 'notificationSettings', {
                            ...deal.data.notificationSettings,
                            document_upload_notification: !deal.data.notificationSettings?.document_upload_notification
                          })}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '14px' }}>Document upload notifications</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="text-center mt-4">
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Preview Changes'}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">Preview Deal Updates</h2>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleBackFromPreview}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info mb-4">
                  <h5 className="alert-heading">Review Your Changes</h5>
                  <p className="mb-0">
                    Please review all {previewDeals.length} deal{previewDeals.length !== 1 ? 's' : ''} below.
                    Once you confirm, these changes will be saved to the system.
                  </p>
                </div>

                {/* Display the common location for all deals */}
                <div className="card bg-light mb-4">
                  <div className="card-body">
                    <h6 className="text-primary mb-2">
                      <MapPin size={18} className="me-2" style={{ display: 'inline' }} />
                      Location for All Deals
                    </h6>
                    <p className="mb-0">
                      <strong>{selectedLocation?.label || 'No location selected'}</strong>
                    </p>
                    {locationAddress && (
                      <small className="text-muted">
                        {locationAddress.city && `${locationAddress.city}, `}
                        {locationAddress.state && `${locationAddress.state} `}
                        {locationAddress.zip_code && `${locationAddress.zip_code}, `}
                        {locationAddress.country}
                      </small>
                    )}
                  </div>
                </div>

                {previewDeals.map((deal, index) => (
                  <div key={deal.id} className="card mb-4">
                    <div className="card-header bg-light">
                      <h5 className="mb-0">Deal {index + 1}: {deal.data.deal_name || 'Unnamed Deal'}</h5>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <h6 className="text-primary mb-3">Basic Information</h6>
                          <ul className="list-unstyled">
                            <li><strong>Deal Name:</strong> {deal.data.deal_name}</li>
                            <li><strong>Deal Type:</strong> {deal.data.deal_type}</li>
                            <li><strong>Priority:</strong> {deal.data.priority_level}</li>
                            <li><strong>Status:</strong> {deal.data.status || 'pipeline'}</li>
                            <li><strong>Source:</strong> {deal.data.deal_source || 'N/A'}</li>
                          </ul>

                          <h6 className="text-primary mb-3 mt-4">Facility Information</h6>
                          <ul className="list-unstyled">
                            <li><strong>Facility Name:</strong> {deal.data.facility_name}</li>
                            <li><strong>Facility Type:</strong> {deal.data.facility_type}</li>
                            <li><strong>Number of Beds:</strong> {deal.data.bed_count}</li>
                          </ul>
                        </div>

                        <div className="col-md-6">
                          <h6 className="text-primary mb-3">Financial Information</h6>
                          <ul className="list-unstyled">
                            <li><strong>Purchase Price:</strong> ${Number(deal.data.purchase_price || 0).toLocaleString()}</li>
                            <li><strong>Annual Revenue:</strong> ${Number(deal.data.annual_revenue || 0).toLocaleString()}</li>
                            <li><strong>EBITDA:</strong> ${Number(deal.data.ebitda || 0).toLocaleString()}</li>
                            <li><strong>Price per Bed:</strong> {deal.data.price_per_bed ? `$${Number(deal.data.price_per_bed).toLocaleString()}` : 'N/A'}</li>
                            <li><strong>Down Payment:</strong> {deal.data.down_payment ? `${deal.data.down_payment}%` : 'N/A'}</li>
                          </ul>


                        </div>
                      </div>

                      <div className="row mt-3">
                        <div className="col-12">
                          <h6 className="text-primary mb-3">Contact & Timeline</h6>
                          <div className="row">
                            <div className="col-md-6">
                              <ul className="list-unstyled">
                                <li><strong>Primary Contact:</strong> {deal.data.primary_contact_name || 'N/A'}</li>
                                <li><strong>Phone:</strong> {deal.data.phone_number || 'N/A'}</li>
                                <li><strong>Email:</strong> {deal.data.email || 'N/A'}</li>
                              </ul>
                            </div>
                            <div className="col-md-6">
                              <ul className="list-unstyled">
                                <li><strong>Target Close Date:</strong> {deal.data.target_close_date || 'N/A'}</li>
                                <li><strong>DD Period:</strong> {deal.data.dd_period_weeks ? `${deal.data.dd_period_weeks} weeks` : 'N/A'}</li>
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
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Updating Deals...
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="me-2" />
                      Update {previewDeals.length} Deal{previewDeals.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

 
    </div>
  );
};

export default EditCombinedDealForm;
