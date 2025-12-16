import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';

import { WizardProvider, useWizard, WIZARD_STEPS, WIZARD_PATHS } from './WizardContext';
import StepIndicator from './components/StepIndicator';
import PathSelector from './steps/PathSelector';
import DocumentUpload from './steps/DocumentUpload';
import DealBasics from './steps/DealBasics';
import FacilityEntry from './steps/FacilityEntry';
import DealInfo from './steps/DealInfo';
import TeamTimeline from './steps/TeamTimeline';

import { createBatchDeals } from '../../api/DealService';

import './CreateDealWizard.css';

const WizardContent = () => {
  const navigate = useNavigate();
  const {
    path,
    currentStep,
    dealData,
    extractionData,
    uploadedFiles,
    isSubmitting,
    setIsSubmitting,
    validateStep,
    goToNextStep,
    resetWizard,
  } = useWizard();

  // Handle final submission
  const handleSubmit = async () => {
    // Validate final step
    if (!validateStep(WIZARD_STEPS.TEAM_TIMELINE)) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // === EXTRACTION DATA AT SUBMIT TIME ===
      console.log('=== EXTRACTION DATA AT SUBMIT TIME ===');
      console.log('extractionData exists:', !!extractionData);
      console.log('extractionData keys:', extractionData ? Object.keys(extractionData) : 'none');
      console.log('extractionData.annual_revenue:', extractionData?.annual_revenue);
      console.log('extractionData.ebitda:', extractionData?.ebitda);
      console.log('extractionData.deal_overview:', extractionData?.deal_overview ? 'present' : 'missing');
      console.log('extractionData.monthlyFinancials count:', extractionData?.monthlyFinancials?.length || 0);
      console.log('extractionData.uploadedFiles count:', extractionData?.uploadedFiles?.length || 0);
      console.log('=== END EXTRACTION DATA ===');

      // Build payload - merge extraction data with form data like UploadDeal.jsx does
      const extracted = extractionData || {};

      const payload = {
        address: {
          street_address: dealData.facilities[0]?.address || extracted.street_address || '',
          city: dealData.facilities[0]?.city || extracted.city || '',
          state: dealData.facilities[0]?.state || extracted.state || '',
          zip_code: dealData.facilities[0]?.zip_code || extracted.zip_code || '',
          country: 'United States',
        },
        deals: dealData.facilities.map((facility) => {
          // Get matched facility data from SNF/ALF database (if available)
          const matched = facility.matched_facility || {};

          return {
            // Deal-level fields from form
            deal_name: dealData.deal_name,
            deal_type: extracted.deal_type || 'Acquisition',
            deal_source: dealData.deal_source === 'Other' ? dealData.deal_source_other : dealData.deal_source,
            primary_contact_name: dealData.contact_name || extracted.primary_contact_name || '',
            deal_status: dealData.status,
            priority_level: dealData.priority_level || extracted.priority_level || 'medium',
            deal_lead_id: dealData.deal_lead_id,
            assistant_deal_lead_id: dealData.assistant_deal_lead_id,
            deal_team_members: dealData.deal_team_members,
            target_close_date: dealData.target_close_date,

            // Facility fields - priority: matched DB data > form data > extraction
            facility_name: matched.facility_name || facility.facility_name || extracted.facility_name || '',
            facility_type: facility.facility_type || matched.facility_type || extracted.facility_type || 'SNF',
            street_address: matched.address || facility.address || extracted.street_address || '',
            city: matched.city || facility.city || extracted.city || '',
            state: matched.state || facility.state || extracted.state || '',
            zip_code: matched.zip_code || facility.zip_code || extracted.zip_code || '',
            county: matched.county || extracted.county || '',

            // Bed count from matched facility (total_beds for SNF, capacity for ALF)
            bed_count: matched.total_beds || matched.capacity || matched.bed_count || extracted.bed_count || null,

            // SNF-specific fields from CMS database
            federal_provider_number: matched.federal_provider_number || null,
            overall_rating: matched.overall_rating || null,
            health_inspection_rating: matched.health_inspection_rating || null,
            staffing_rating: matched.staffing_rating || null,
            quality_rating: matched.quality_rating || null,

            // Location coordinates
            latitude: matched.latitude || null,
            longitude: matched.longitude || null,

            // Financial fields from extraction (these populate the deal profile)
            purchase_price: parseFloat(dealData.purchase_price?.toString().replace(/,/g, '')) || extracted.purchase_price || 0,
            annual_revenue: extracted.annual_revenue || 0,
            ebitda: extracted.ebitda || 0,
            ebitda_margin: extracted.ebitda_margin || 0,
            ebitdar: extracted.ebitdar || 0,
            ebitdar_margin: extracted.ebitdar_margin || 0,
            net_operating_income: extracted.net_operating_income || 0,
            current_occupancy: extracted.occupancy_pct || extracted.current_occupancy || 0,
            average_daily_rate: extracted.average_daily_rate || 0,
            medicare_percentage: extracted.medicare_pct || extracted.medicare_percentage || 0,
            medicaid_percentage: extracted.medicaid_pct || extracted.medicaid_percentage || 0,
            private_pay_percentage: extracted.private_pay_pct || extracted.private_pay_percentage || 0,
            price_per_bed: extracted.price_per_bed || 0,
            revenue_multiple: extracted.revenue_multiple || 0,
            ebitda_multiple: extracted.ebitda_multiple || 0,
            target_irr_percentage: extracted.target_irr_percentage || 0,
            projected_cap_rate_percentage: extracted.projected_cap_rate_percentage || 0,
            target_hold_period: extracted.target_hold_period || 0,

            // Contact info from extraction
            title: extracted.contact_title || extracted.title || '',
            phone_number: matched.phone_number || extracted.contact_phone || extracted.phone_number || '',
            email: extracted.contact_email || extracted.email || '',

            // Matched facility reference
            matched_facility_id: matched.id || matched.federal_provider_number || null,
            match_source: facility.match_source,

            // Notification settings
            notificationSettings: {
              email_notification_major_updates: true,
              document_upload_notification: true,
            },
          };
        }),
      };

      // Include uploaded documents if AI path
      // Use extractionData.uploadedFiles which contains the saved file metadata from the API
      const savedFiles = extractionData?.uploadedFiles || [];
      if (path === WIZARD_PATHS.AI && savedFiles.length > 0) {
        payload.documents = savedFiles.map(file => ({
          filename: file.filename,
          original_name: file.originalName,
          file_path: file.url || `/api/v1/files/${file.filename}`,
          file_type: file.mimeType || 'application/octet-stream',
          file_size: file.size || 0,
        }));
      }

      // Include extraction data if available - format EXACTLY like UploadDeal.jsx
      if (extractionData) {
        payload.extraction_data = {
          ...extractionData,
          extraction_timestamp: new Date().toISOString(),
          // Time-series data with correct keys (snake_case for backend)
          monthly_financials: extractionData.monthlyFinancials || [],
          monthly_census: extractionData.monthlyCensus || [],
          monthly_expenses: extractionData.monthlyExpenses || [],
          rates: extractionData.rates || {},
          ttm_financials: extractionData.ttmFinancials || null,
          census_summary: extractionData.censusSummary || null,
          // Additional fields matching UploadDeal.jsx payload
          expenses_by_department: extractionData.expensesByDepartment || {},
          ratios: extractionData.ratios || {},
          benchmark_flags: extractionData.benchmarkFlags || {},
          potential_savings: extractionData.potentialSavings || {},
          insights: extractionData.insights || [],
        };
      }

      // === PAYLOAD TO BACKEND LOGGING ===
      console.log('=== PAYLOAD TO BACKEND ===');
      console.log(JSON.stringify(payload, null, 2));
      console.log('--- PAYLOAD SUMMARY ---');
      console.log('deals count:', payload.deals?.length || 0);
      console.log('deals[0] keys:', payload.deals?.[0] ? Object.keys(payload.deals[0]) : 'none');
      console.log('deals[0].annual_revenue:', payload.deals?.[0]?.annual_revenue);
      console.log('deals[0].ebitda:', payload.deals?.[0]?.ebitda);
      console.log('deals[0].current_occupancy:', payload.deals?.[0]?.current_occupancy);
      console.log('extraction_data keys:', payload.extraction_data ? Object.keys(payload.extraction_data) : 'none');
      console.log('extraction_data.monthly_financials count:', payload.extraction_data?.monthly_financials?.length || 0);
      console.log('extraction_data.monthly_census count:', payload.extraction_data?.monthly_census?.length || 0);
      console.log('extraction_data.monthly_expenses count:', payload.extraction_data?.monthly_expenses?.length || 0);
      console.log('extraction_data.deal_overview:', payload.extraction_data?.deal_overview ? 'present' : 'missing');
      console.log('extraction_data.ttm_financials:', payload.extraction_data?.ttm_financials ? 'present' : 'missing');
      console.log('documents count:', payload.documents?.length || 0);
      console.log('=== END PAYLOAD ===');

      const response = await createBatchDeals(payload);

      if (response.success && response.code === 200) {
        toast.success('Deal created successfully!');
        const createdDeals = response.body?.dealData || [];
        const firstDealId = createdDeals[0]?.id;

        if (firstDealId) {
          navigate(`/deals/deal-detail/${firstDealId}`);
        } else {
          navigate('/deals');
        }
      } else {
        toast.error(response.message || 'Failed to create deal');
      }
    } catch (error) {
      console.error('Error creating deal:', error);
      toast.error('Failed to create deal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case WIZARD_STEPS.PATH_SELECT:
        return <PathSelector />;
      case WIZARD_STEPS.DOCUMENT_UPLOAD:
        return <DocumentUpload />;
      case WIZARD_STEPS.DEAL_BASICS:
        return <DealBasics />;
      case WIZARD_STEPS.FACILITY_ENTRY:
        return <FacilityEntry />;
      case WIZARD_STEPS.DEAL_INFO:
        return <DealInfo />;
      case WIZARD_STEPS.TEAM_TIMELINE:
        return <TeamTimeline onSubmit={handleSubmit} />;
      default:
        return <PathSelector />;
    }
  };

  // Get step labels for indicator
  const getStepLabels = () => {
    if (path === WIZARD_PATHS.MANUAL) {
      return ['Deal Basics', 'Facility', 'Deal', 'Team'];
    }
    if (path === WIZARD_PATHS.AI) {
      return ['Upload', 'Deal Basics', 'Deal', 'Team'];
    }
    return [];
  };

  return (
    <div className="create-deal-wizard">
      {/* Header */}
      <div className="wizard-header">
        <button
          className="back-button"
          onClick={() => {
            if (currentStep === WIZARD_STEPS.PATH_SELECT) {
              navigate('/deals');
            } else {
              resetWizard();
            }
          }}
        >
          <ArrowLeft size={20} />
          <span>Back to Deals</span>
        </button>
        <h1 className="wizard-title">Create Deal</h1>
      </div>

      {/* Step Indicator - only show after path selection */}
      {path && currentStep !== WIZARD_STEPS.PATH_SELECT && (
        <StepIndicator labels={getStepLabels()} />
      )}

      {/* Step Content */}
      <div className="wizard-content">
        {renderStep()}
      </div>
    </div>
  );
};

const CreateDealWizard = () => {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
};

export default CreateDealWizard;
