import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, FileText, Users, CheckCircle } from "lucide-react";
import * as Yup from "yup";
import renderStep1 from "./editrenderStep1";
import renderStep2 from "./editrenderStep2";
import renderStep3 from "./editrenderStep3";
import renderStep4 from "./editrenderStep4";
import { getDealById, updateDeal } from "../../api/DealService";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { getActiveUsers } from "../../api/authService";

// Validation schemas for each step
const step1ValidationSchema = Yup.object().shape({
  deal_name: Yup.string()
    .required("Deal name is required")
    .min(2, "Deal name must be at least 2 characters"),
  facility_name: Yup.string()
    .required("Facility name is required")
    .min(2, "Facility name must be at least 2 characters"),
  facility_type: Yup.string().required("Facility type is required"),
  no_of_beds: Yup.number()
    .typeError("Number of beds must be a number")
    .required("Number of beds is required"),
  street_address: Yup.string().required("Street address is required"),
  country: Yup.string().required("Country is required"),
  city: Yup.string()
    .required("City is required"),
  state: Yup.string().required("State is required"),
  zip_code: Yup.string()
    .required("Zip code is required"),
  phone_number: Yup.string().matches(
    /^\+?[1-9]\d{1,14}$/,
    "Invalid phone number format"
  ),
  email: Yup.string().email("Invalid email address"),
  target_close_date: Yup.date()
    .typeError("Target close date must be a date")
    .required("Target close date is required"),
});

const step2ValidationSchema = Yup.object().shape({
  purchase_price: Yup.number()
    .typeError("Purchase price must be a number")
    .required("Purchase price is required"),
  annual_revenue: Yup.number()
    .typeError("Annual revenue must be a number")
    .required("Annual revenue is required"),
  ebitda: Yup.number()
    .typeError("EBITDA must be a number")
    .required("EBITDA is required"),
});

const step3ValidationSchema = Yup.object().shape({
  deal_lead_id: Yup.number()
    .required("Deal lead id is required")
    .min(1, "Deal lead id is required"),
});

const step4ValidationSchema = Yup.object().shape({
  // Add any step 4 required fields here
});

// 4 steps only
const steps = [
  { id: 1, title: "Basic Info", icon: FileText },
  { id: 2, title: "Financial Info", icon: FileText },
  { id: 3, title: "Team & Access", icon: Users },
  { id: 4, title: "Templates & Review", icon: CheckCircle },
];

const permissionLabels = [
  "View",
  "Edit",
  "Upload",
  "Download",
  "Approve",
  "Admin",
];

const EditDeal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Initial form data for all steps
  const getInitialFormData = (dealData) => ({
    // Step 1 fields
    deal_name: dealData?.deal_name || "",
    user_id: dealData?.user_id,
    deal_type: dealData?.deal_type || "Acquisition",
    priority_level: dealData?.priority_level || "High",
    deal_source: dealData?.deal_source || "",
    facility_name: dealData?.facility_name || "",
    facility_type: dealData?.facility_type || "Skilled Nursing",
    no_of_beds: dealData?.no_of_beds || "",
    street_address: dealData?.street_address || "",
    country: dealData?.country || "",
    city: dealData?.city || "",
    state: dealData?.state || "",
    zip_code: dealData?.zip_code || "",
    primary_contact_name: dealData?.primary_contact_name || "",
    phone_number: dealData?.phone_number || "",
    email: dealData?.email || "",
    target_close_date: dealData?.target_close_date || "",
    dd_period_weeks: dealData?.dd_period_weeks || "",
    title: dealData?.title || "",
    deal_status: dealData?.deal_status || "pipeline",
    // Step 2 fields
    purchase_price: dealData?.purchase_price || "",
    price_per_bed: dealData?.price_per_bed || "",
    down_payment: dealData?.down_payment || "",
    financing_amount: dealData?.financing_amount || "",
    annual_revenue: dealData?.annual_revenue || "",
    revenue_multiple: dealData?.revenue_multiple || "",
    ebitda: dealData?.ebitda || "",
    ebitda_multiple: dealData?.ebitda_multiple || "",
    current_occupancy: dealData?.current_occupancy || "",
    average_daily_rate: dealData?.average_daily_rate || "",
    medicare_percentage: dealData?.medicare_percentage || "",
    private_pay_percentage: dealData?.private_pay_percentage || "",
    target_irr_percentage: dealData?.target_irr_percentage || "",
    target_hold_period: dealData?.target_hold_period || "",
    projected_cap_rate_percentage:
      dealData?.projected_cap_rate_percentage || "",
    exit_multiple: dealData?.exit_multiple || "",
    // Step 3 fields
    deal_lead_id: dealData?.deal_lead_id || 1,
    assistant_deal_lead_id: dealData?.assistant_deal_lead_id || 1,
    deal_team_members: dealData?.deal_team_members || [],
    deal_external_advisors: dealData?.deal_external_advisors || [],
    notificationSettings: {
      email_notification_major_updates:
        dealData?.email_notification_major_updates === "yes" ? true : false,
      weekly_progress_report:
        dealData?.weekly_progress_report === "yes" ? true : false,
      slack_integration_for_team_communication:
        dealData?.slack_integration_for_team_communication === "yes"
          ? true
          : false,
      document_upload_notification:
        dealData?.document_upload_notification === "yes" ? true : false,
      calendar_integration:
        dealData?.calendar_integration === "yes" ? true : false,
      sms_alert_for_urgent_items:
        dealData?.sms_alert_for_urgent_items === "yes" ? true : false,
    },
  });

  const [formData, setFormData] = useState(getInitialFormData(null));
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);
  const [touched, setTouched] = useState({});
  const [selectedPlace, setSelectedPlace] = useState(null);
  // Step 3: Team & Access
  const [deal_team_members, setdeal_team_members] = useState(
    formData.deal_team_members
  );
  const [deal_external_advisors, setdeal_external_advisors] = useState(
    formData.deal_external_advisors
  );
  const [deal_lead_id, setdeal_lead_id] = useState(formData.deal_lead_id);
  const [assistant_deal_lead_id, setassistant_deal_lead_id] = useState(
    formData.assistant_deal_lead_id
  );
  const [notificationSettings, setNotificationSettings] = useState(
    formData.notificationSettings
  );

  // Fetch deal data and set form data
  useEffect(() => {
    const fetchDeal = async () => {
      setLoading(true);
      try {
        const response = await getDealById(id);
        setDeal(response.body);
        setFormData(getInitialFormData(response.body));
        setdeal_team_members(response.body?.deal_team_members || []);
        setdeal_external_advisors(response.body?.deal_external_advisors || []);
        setdeal_lead_id(response.body?.deal_lead_id || 1);
        setassistant_deal_lead_id(response.body?.assistant_deal_lead_id || 1);
        if (response.body?.street_address) {
          setSelectedPlace({
            label: response.body?.street_address,
            value: {
              description: response.body?.street_address,
              place_id: ''
            }
          });
        }
        setNotificationSettings(
          response.body?.notificationSettings || {
            email_notification_major_updates: true,
            weekly_progress_report: true,
            slack_integration_for_team_communication: true,
            document_upload_notification: true,
            calendar_integration: true,
            comment: true,
          }
        );
      } catch (err) {
        toast.error("Failed to fetch deal data");
      } finally {
        setLoading(false);
      }
    };
    fetchDeal();
    // eslint-disable-next-line
  }, [id, location.search]);

  // Get validation schema for current step
  const getCurrentStepValidationSchema = () => {
    switch (currentStep) {
      case 1:
        return step1ValidationSchema;
      case 2:
        return step2ValidationSchema;
      case 3:
        return step3ValidationSchema;
      case 4:
        return step4ValidationSchema;
      default:
        return Yup.object().shape({});
    }
  };

  // Validate current step
  const validateCurrentStep = async () => {
    try {
      const schema = getCurrentStepValidationSchema();
      // For step 3, include deal_lead_id from state
      const dataToValidate =
        currentStep === 3
          ? { ...formData, deal_lead_id: Number(deal_lead_id) }
          : formData;
      await schema.validate(dataToValidate, { abortEarly: false });
      setValidationErrors({});
      setIsCurrentStepValid(true);
      return true;
    } catch (error) {
      if (error.inner) {
        const errors = {};
        error.inner.forEach((err) => {
          errors[err.path] = err.message;
        });
        setValidationErrors(errors);
      }
      setIsCurrentStepValid(false);
      return false;
    }
  };

  // Validate when form data or current step changes
  useEffect(() => {
    if (!loading) {
      validateCurrentStep();
    }
    // eslint-disable-next-line
  }, [formData, currentStep, deal_lead_id, loading]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
      setTouched({});
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setTouched({});
    } else {
      navigate("/Deals");
    }
  };

  const handleNotificationChange = (field) => {
    setNotificationSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleEditDeal = async () => {
    try {
      setUpdateLoading(true);
      // Compose the latest formData with team, advisors, lead, assistant, notificationSettings
      const payload = {
        id: id,
        ...formData,
      };
      const response = await updateDeal(payload);
      if (response.success === true) {
        toast.success(response.message);
        navigate("/Deals");
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error("Error updating deal");
      // Optionally log error
    } finally {
      setUpdateLoading(false);
    }
  };

  const [usersData, setUsersData] = useState([]);
  const hasFetched = useRef(false);

  const fetchData = async () => {
    try {
      const response = await getActiveUsers();
      setUsersData(response.body);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchData();
  }, []);

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

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="header-with-back">
          <button className="back-btn" onClick={handleBack}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>Edit Deal - Step {currentStep} of 4</h1>
            <p>
              {currentStep === 1
                ? "Basic facility information and deal overview"
                : currentStep === 2
                ? "Financial details and investment metrics"
                : currentStep === 3
                ? "Team assignment and access permissions"
                : "Review all information and update the deal"}
            </p>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="step-progress">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < currentStep - 1;
          const isActive = index === currentStep - 1;

          return (
            <div
              key={step.id}
              className={`step ${
                isCompleted ? "completed" : isActive ? "active" : ""
              }`}
            >
              <div className="step-circle">
                {isCompleted ? "✓" : <StepIcon size={16} />}
              </div>
              <span className="step-title">{step.title}</span>
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="step-form">
        <div className="step-content">
          {currentStep === 1 &&
            renderStep1(formData, handleInputChange, validationErrors, touched, selectedPlace, setSelectedPlace)}
          {currentStep === 2 &&
            renderStep2(formData, handleInputChange, validationErrors, touched)}
          {currentStep === 3 &&
            renderStep3(
              usersData,
              formData,
              handleInputChange,
              deal_team_members,
              setdeal_team_members,
              deal_external_advisors,
              setdeal_external_advisors,
              deal_lead_id,
              setdeal_lead_id,
              assistant_deal_lead_id,
              setassistant_deal_lead_id,
              notificationSettings,
              handleNotificationChange,
              validationErrors,
              touched
            )}
          {currentStep === 4 &&
            renderStep4(formData, handleInputChange, validationErrors, touched)}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="form-actions px-4">
        <button className="btn btn-outline" onClick={handleBack}>
          {currentStep > 1 ? "Previous" : "Cancel"}
        </button>
        <div className="action-group">
          <button
            className={`btn btn-primary${
              !isCurrentStepValid ? " disabled" : ""
            }`}
            onClick={currentStep < 4 ? handleNext : handleEditDeal}
            disabled={!isCurrentStepValid}
            style={{
              opacity: !isCurrentStepValid ? 0.5 : 1,
              cursor: !isCurrentStepValid ? "not-allowed" : "pointer",
            }}
          >
            {currentStep < 4 ? (
              "Next Step"
            ) : updateLoading ? (
              <span
                className="spinner-border spinner-border-sm "
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Update Deal"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditDeal;
