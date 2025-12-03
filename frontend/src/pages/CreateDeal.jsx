import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Trash2,
  Plus,
  FileText,
  Users,
  Settings,
  CheckCircle,
} from "lucide-react";
import * as Yup from "yup";
import renderStep1 from "./renderStep1";
import renderStep2 from "./renderStep2";
import renderStep3 from "./renderStep3";
import renderStep4 from "./renderStep4";
import { createDeal } from "../api/DealService";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getActiveUsers } from "../api/authService";
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
  city: Yup.string().required("City is required"),
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

  price_per_bed: Yup.number()
  .typeError("Price per bed must be a number"),
  down_payment: Yup.number()
  .typeError("Down payment must be a number"),
  financing_amount: Yup.number()
  .typeError("Financing amount must be a number"),
  revenue_multiple: Yup.number()
  .typeError("Revenue multiple must be a number"),
  ebitda: Yup.number()
    .typeError("EBITDA must be a number")
    .required("EBITDA is required"),
  ebitda_multiple: Yup.number()
  .typeError("EBITDA multiple must be a number"),
  current_occupancy: Yup.number()
  .typeError("Current occupancy must be a number"),
  average_daily_rate: Yup.number()
  .typeError("Average daily rate must be a number"),
  medicare_percentage: Yup.number(),
  private_pay_percentage: Yup.number()
  .typeError("Private pay percentage must be a number"),
  target_irr_percentage: Yup.number()
  .typeError("Target IRR percentage must be a number"),
  target_hold_period: Yup.number()
  .typeError("Target hold period must be a number"),
  projected_cap_rate_percentage: Yup.number()
  .typeError("Projected cap rate percentage must be a number"),
  exit_multiple: Yup.number()
  .typeError("Exit multiple must be a number"),
  annual_revenue: Yup.number()
  .typeError("Annual revenue must be a number")
  .required("Annual revenue is required"),

});

const step3ValidationSchema = Yup.object().shape({
  deal_lead_id: Yup.number()
    .required("Deal lead id is required")
    .min(1, "Deal lead id is required"),
});

const step4ValidationSchema = Yup.object().shape({
  // Add any step 4 required fields here
});

// Initial form data for all steps
const initialFormData = {
  // Step 1 fields
  deal_name: "",
  deal_type: "Acquisition",
  priority_level: "High",
  deal_source: "",
  facility_name: "",
  facility_type: "Skilled Nursing",
  no_of_beds: "",
  street_address: "",
  country: "",
  city: "",
  state: "",
  zip_code: "",
  primary_contact_name: "",
  phone_number: "",
  email: "",
  target_close_date: "",
  dd_period_weeks: "",
  title: "",
  status: "pipeline",
  // Step 2 fields
  purchase_price: "",
  price_per_bed: "",
  down_payment: "",
  financing_amount: "",
  annual_revenue: "",
  revenue_multiple: "",
  ebitda: "",
  ebitda_multiple: "",
  current_occupancy: "",
  average_daily_rate: "",
  medicare_percentage: "",
  private_pay_percentage: "",
  target_irr_percentage: "",
  target_hold_period: "",
  projected_cap_rate_percentage: "",
  exit_multiple: "",
  // Step 3 fields
  deal_lead_id: 1,
  assistant_deal_lead_id: 1,
  deal_team_members: [
    // { name: 'Sarah Kern', role: 'Deal Manager', type: 'core', id: 1 },
    // { name: 'Mike Rodriguez', role: 'Analyst', type: 'core', id: 2 }
  ],
  deal_external_advisors: [
    // { name: 'Legal Counsel', assigned: false, id: 1 },
    // { name: 'Financial Advisor', assigned: false, id: 2 }
  ],
  notificationSettings: {
    email_notification_major_updates: false,
    weekly_progress_report: false,
    slack_integration_for_team_communication: false,
    document_upload_notification: false,
    calendar_integration: false,
    sms_alert_for_urgent_items: false,
  },
};

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

const CreateDeal = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(initialFormData);
  const [validationErrors, setValidationErrors] = useState({});
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);
  const [touched, setTouched] = useState({});
  const [selectedPlace, setSelectedPlace] = useState(null);
  const navigate = useNavigate();
  // Step 3: Team & Access
  const [loading, setLoading] = useState(false);
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
          ? { ...formData, deal_lead_id: Number(formData.deal_lead_id) }
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

  // Validate when form data or current step changes
  useEffect(() => {
    validateCurrentStep();
  }, [formData, currentStep, deal_lead_id]);

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
    }
  };

  const handleNotificationChange = (field) => {
    setNotificationSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleCreateDeal = async () => {
    try {
      setLoading(true);
      const response = await createDeal(formData);
      if (response.success === true) {
        toast.success(response.message);
        navigate("/Deals");
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error("Error creating deal:", error);
    } finally{
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="header-with-back">
          <button className="back-btn" onClick={handleBack}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>Create New Deal - Step {currentStep} of 4</h1>
            <p>
              {currentStep === 1
                ? "Basic facility information and deal overview"
                : currentStep === 2
                ? "Financial details and investment metrics"
                : currentStep === 3
                ? "Team assignment and access permissions"
                : "Review all information and create the deal"}
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
            className={`btn btn-primary ${
              !isCurrentStepValid ? "disabled" : ""
            }`}
            onClick={currentStep < 4 ? handleNext : handleCreateDeal}
            disabled={!isCurrentStepValid}
            style={{
              opacity: !isCurrentStepValid ? 0.5 : 1,
              cursor: !isCurrentStepValid ? "not-allowed" : "pointer",
            }}
          >
            {currentStep < 4 ? (
              "Next Step"
            ) : loading ? (
              <span
                className="spinner-border spinner-border-sm "
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Create Deal"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateDeal;
