import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Download,
  FileText,
  AlertTriangle,
  Lightbulb,
  Building2,
  DollarSign,
  Users,
  BarChart3,
  Calculator,
  ClipboardList,
  Target,
  Brain,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Wrench,
  Plus,
  Trash2,
  MessageSquare,
  FolderOpen,
  RefreshCw,
  Upload,
  File,
  FileSpreadsheet,
  Image,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  ChevronUp,
  ChevronDown,
  Download as DownloadIcon,
} from 'lucide-react';
import SNFalyzePanel from '../SNFalyzePanel';
import {
  DealExtractionViewerProps,
  ExtractedDealData,
  SourceReference,
  DealDocument,
} from './types';
import DealCalculatorTab from '../DealCalculatorTab';
import ProFormaTab from '../ProFormaTab/ProFormaTab';
import { formatTimestamp, formatPeriod, countExtractedFields } from './utils';
import FieldCell from './FieldCell';
import PayerMixChart from './PayerMixChart';
import RatesTable from './RatesTable';
import ProFormaTable from './ProFormaTable';
import DocumentViewer from './DocumentViewer';
import CensusTrendCharts from './CensusTrendCharts';

// Tab configuration
const TAB_CONFIGS = [
  { id: 'overview', title: 'General Info', icon: Building2 },
  { id: 'deal_overview', title: 'Deal Overview', icon: Lightbulb },
  { id: 'financials', title: 'Financials', icon: DollarSign },
  { id: 'census', title: 'Census & Rates', icon: Users },
  { id: 'calculator', title: 'Calculator', icon: Calculator },
  { id: 'proforma', title: 'Pro Forma', icon: Target },
  { id: 'documents', title: 'Documents', icon: FolderOpen },
];

// Styles
const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #e5e7eb',
  backgroundColor: '#f9fafb',
  overflowX: 'auto',
};

const getTabStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: isActive ? 600 : 500,
  color: isActive ? '#1e40af' : '#6b7280',
  backgroundColor: isActive ? 'white' : 'transparent',
  borderBottom: isActive ? '2px solid #1e40af' : '2px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
  border: 'none',
});

const contentStyle: React.CSSProperties = {
  padding: '1.5rem',
  backgroundColor: 'white',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#111827',
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const subsectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.75rem',
  marginTop: '1.5rem',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem',
};

const periodBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.5rem 1rem',
  backgroundColor: '#f0fdf4',
  borderRadius: '0.5rem',
  border: '1px solid #bbf7d0',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#166534',
  marginBottom: '1rem',
};

const DealExtractionViewer: React.FC<DealExtractionViewerProps> = ({
  extractionData,
  onFieldEdit,
  showComparison: initialShowComparison = false,
  isLoading = false,
  dealDocuments = [],
  dealId,
  deal,
  onDocumentUpload,
  isUploading = false,
  onDocumentView,
  onDocumentDelete,
  onDocumentDownload,
  deleteLoadingId,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showComparison] = useState(initialShowComparison);

  // State for document viewer modal
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedSourceRef, setSelectedSourceRef] = useState<SourceReference | null>(null);

  // State for SNFalyze panel
  const [snfalyzePanelOpen, setSnfalyzePanelOpen] = useState(false);

  // State for reviewer notes (moved here to comply with Rules of Hooks)
  const [reviewerNotes, setReviewerNotes] = useState<string[]>(
    extractionData.reviewer_notes || []
  );
  const [newNote, setNewNote] = useState('');

  // State for documents tab (moved here to comply with Rules of Hooks)
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [reExtractionStatus, setReExtractionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [reExtractionMessage, setReExtractionMessage] = useState('');

  // State for collapsible sections in Deal Overview
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Handle source click to open document viewer
  const handleSourceClick = useCallback((sourceRef: SourceReference) => {
    setSelectedSourceRef(sourceRef);
    setDocumentViewerOpen(true);
  }, []);

  // Handle field edit
  const handleFieldEdit = useCallback(
    (fieldPath: string, newValue: any) => {
      if (onFieldEdit) {
        onFieldEdit(fieldPath, newValue);
      }
    },
    [onFieldEdit]
  );

  // Handle Excel export
  const handleExportExcel = useCallback(() => {
    if (!extractionData) return;

    const rows: string[][] = [];
    rows.push(['Field', 'Value', 'Confidence', 'Source']);

    const addFields = (prefix: string, obj: Record<string, any>, depth: number = 0) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') {
          if ('value' in value && 'confidence' in value) {
            const label = `${prefix}${key}`.replace(/_/g, ' ');
            let displayValue = '—';
            if (value.value !== null && value.value !== undefined) {
              if (Array.isArray(value.value)) {
                displayValue = value.value.map((item: any) => {
                  if (item.unit_type) return `${item.unit_type}: $${item.monthly_rate}`;
                  if (item.care_level) return `${item.care_level}: $${item.monthly_rate}`;
                  return JSON.stringify(item);
                }).join('; ');
              } else {
                displayValue = String(value.value);
              }
            }
            rows.push([label, displayValue, value.confidence, value.source || '']);
          } else if (depth < 2) {
            addFields(`${prefix}${key} - `, value, depth + 1);
          }
        }
      }
    };

    addFields('Deal: ', extractionData.deal_information);
    addFields('Facility: ', extractionData.facility_information);
    addFields('Contact: ', extractionData.contact_information);

    const fin = extractionData.financial_information_t12;
    rows.push(['Financial: period', fin.period?.start && fin.period?.end ? `${fin.period.start} to ${fin.period.end}` : '—', 'high', '']);
    addFields('Financial: ', { total_revenue: fin.total_revenue, total_expenses: fin.total_expenses, net_income: fin.net_income });
    if (fin.revenue_by_payer) addFields('Revenue by Payer: ', fin.revenue_by_payer);
    if (fin.revenue_breakdown) addFields('Revenue Type: ', fin.revenue_breakdown);
    addFields('Earnings: ', { ebitdar: fin.ebitdar, ebitda: fin.ebitda, ebit: fin.ebit });

    if (extractionData.ytd_performance) {
      const ytd = extractionData.ytd_performance;
      rows.push(['YTD: period', ytd.period?.start && ytd.period?.end ? `${ytd.period.start} to ${ytd.period.end}` : '—', 'high', '']);
      addFields('YTD: ', ytd);
    }

    addFields('Census: ', extractionData.census_and_occupancy);
    addFields('Rates: ', extractionData.rate_information);
    addFields('Metrics: ', extractionData.deal_metrics);

    if (extractionData.data_quality_notes?.length > 0) {
      extractionData.data_quality_notes.forEach((note: string, i: number) => {
        rows.push([`Data Quality Note ${i + 1}`, note, 'info', '']);
      });
    }
    if (Array.isArray(extractionData.key_observations) && extractionData.key_observations.length > 0) {
      extractionData.key_observations.forEach((obs: string, i: number) => {
        rows.push([`Key Observation ${i + 1}`, obs, 'info', '']);
      });
    }

    const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deal_extraction_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [extractionData]);

  // Calculate field counts
  const sectionFieldCounts = useMemo(() => {
    if (!extractionData) return {};
    const counts: Record<string, { extracted: number; total: number }> = {};
    counts.deal_information = countExtractedFields(extractionData.deal_information);
    counts.facility_information = countExtractedFields(extractionData.facility_information);
    counts.contact_information = countExtractedFields(extractionData.contact_information);
    counts.financial_information_t12 = countExtractedFields(extractionData.financial_information_t12, ['period', 'revenue_breakdown', 'revenue_by_payer']);
    counts.census_and_occupancy = countExtractedFields(extractionData.census_and_occupancy, ['payer_mix_by_census', 'payer_mix_by_revenue']);
    counts.rate_information = countExtractedFields(extractionData.rate_information);
    counts.deal_metrics = countExtractedFields(extractionData.deal_metrics);
    return counts;
  }, [extractionData]);

  // Handle save scenario for ProFormaTab - must be before early returns
  const handleSaveScenario = useCallback(async (scenarioData: any) => {
    if (!dealId) return;
    // This will be wired up to the API - for now just log
    console.log('Saving scenario:', scenarioData);
    // TODO: Call DealService.createProformaScenario(dealId, scenarioData)
  }, [dealId]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading extraction data...
      </div>
    );
  }

  if (!extractionData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        No extraction data available
      </div>
    );
  }

  // Render Overview Tab
  const renderOverviewTab = () => (
    <div>
      {/* Ask SNFalyze Button */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)',
        borderRadius: '0.75rem',
        border: '1px solid #c4b5fd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#5b21b6' }}>
            Get AI-Powered Deal Insights
          </h4>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#7c3aed' }}>
            Ask SNFalyze to analyze this deal's financial health, risks, and opportunities
          </p>
        </div>
        <button
          onClick={() => setSnfalyzePanelOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(124, 58, 237, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(124, 58, 237, 0.3)';
          }}
        >
          <Brain size={18} />
          Ask SNFalyze
        </button>
      </div>

      {/* Deal Information */}
      <h3 style={sectionHeaderStyle}>Deal Information</h3>
      <div style={gridStyle}>
        <FieldCell label="Deal Name" field={extractionData.deal_information.deal_name} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="deal_information.deal_name" onEdit={(value) => handleFieldEdit('deal_information.deal_name', value)} />
        <FieldCell label="Deal Type" field={extractionData.deal_information.deal_type} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="deal_information.deal_type" onEdit={(value) => handleFieldEdit('deal_information.deal_type', value)} />
        <FieldCell label="Deal Source" field={extractionData.deal_information.deal_source} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="deal_information.deal_source" onEdit={(value) => handleFieldEdit('deal_information.deal_source', value)} />
        <FieldCell label="Priority Level" field={extractionData.deal_information.priority_level} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="deal_information.priority_level" onEdit={(value) => handleFieldEdit('deal_information.priority_level', value)} />
        <FieldCell label="Purchase Price" field={extractionData.deal_information.purchase_price} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="deal_information.purchase_price" onEdit={(value) => handleFieldEdit('deal_information.purchase_price', value)} />
        <FieldCell label="Price Per Bed" field={extractionData.deal_information.price_per_bed} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="deal_information.price_per_bed" onEdit={(value) => handleFieldEdit('deal_information.price_per_bed', value)} />
      </div>

      {/* Facility Information */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2rem' }}>Facility Information</h3>
      <div style={gridStyle}>
        <FieldCell label="Facility Name" field={extractionData.facility_information.facility_name} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.facility_name" onEdit={(value) => handleFieldEdit('facility_information.facility_name', value)} />
        <FieldCell label="Facility Type" field={extractionData.facility_information.facility_type} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.facility_type" onEdit={(value) => handleFieldEdit('facility_information.facility_type', value)} />
        <FieldCell label="Street Address" field={extractionData.facility_information.street_address} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.street_address" onEdit={(value) => handleFieldEdit('facility_information.street_address', value)} />
        <FieldCell label="City" field={extractionData.facility_information.city} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.city" onEdit={(value) => handleFieldEdit('facility_information.city', value)} />
        <FieldCell label="State" field={extractionData.facility_information.state} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.state" onEdit={(value) => handleFieldEdit('facility_information.state', value)} />
        <FieldCell label="Zip Code" field={extractionData.facility_information.zip_code} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.zip_code" onEdit={(value) => handleFieldEdit('facility_information.zip_code', value)} />
        <FieldCell label="Bed Count" field={extractionData.facility_information.bed_count} format="number" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="facility_information.bed_count" onEdit={(value) => handleFieldEdit('facility_information.bed_count', value)} />
      </div>

      {/* Contact Information */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2rem' }}>Contact Information</h3>
      <div style={gridStyle}>
        <FieldCell label="Primary Contact" field={extractionData.contact_information.primary_contact_name} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="contact_information.primary_contact_name" onEdit={(value) => handleFieldEdit('contact_information.primary_contact_name', value)} />
        <FieldCell label="Title" field={extractionData.contact_information.title} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="contact_information.title" onEdit={(value) => handleFieldEdit('contact_information.title', value)} />
        <FieldCell label="Phone" field={extractionData.contact_information.phone} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="contact_information.phone" onEdit={(value) => handleFieldEdit('contact_information.phone', value)} />
        <FieldCell label="Email" field={extractionData.contact_information.email} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} fieldPath="contact_information.email" onEdit={(value) => handleFieldEdit('contact_information.email', value)} />
      </div>
    </div>
  );

  // Render Financials Tab
  const renderFinancialsTab = () => {
    const fin = extractionData.financial_information_t12;

    return (
      <div>
        {/* T12 Financial Information */}
        <h3 style={sectionHeaderStyle}>Trailing 12-Month Financial Performance</h3>
        <div style={periodBadgeStyle}>
          Period: {formatPeriod(fin.period.start, fin.period.end)}
        </div>

        <div style={gridStyle}>
          <FieldCell label="Total Revenue" field={fin.total_revenue} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Total Expenses" field={fin.total_expenses} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Net Income" field={fin.net_income} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
        </div>

        {/* Revenue by Payer */}
        <h4 style={subsectionHeaderStyle}>Revenue by Payer Source</h4>
        <div style={gridStyle}>
          <FieldCell label="Medicaid Revenue" field={fin.revenue_by_payer?.medicaid_revenue || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Medicare Revenue" field={fin.revenue_by_payer?.medicare_revenue || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Private Pay Revenue" field={fin.revenue_by_payer?.private_pay_revenue || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Other Revenue" field={fin.revenue_by_payer?.other_revenue || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
        </div>

        {/* Revenue by Type */}
        <h4 style={subsectionHeaderStyle}>Revenue by Type</h4>
        <div style={gridStyle}>
          <FieldCell label="Room & Board" field={fin.revenue_breakdown.room_and_board} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Care Level Revenue" field={fin.revenue_breakdown.care_level_revenue} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Ancillary Revenue" field={fin.revenue_breakdown.ancillary_revenue} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Other Income" field={fin.revenue_breakdown.other_income} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
        </div>

        {/* Expense Details */}
        <h4 style={subsectionHeaderStyle}>Expense Details</h4>
        <div style={gridStyle}>
          <FieldCell label="Operating Expenses" field={fin.operating_expenses || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Property Taxes" field={fin.property_taxes || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Property Insurance" field={fin.property_insurance || { value: null, confidence: 'not_found' }} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Rent/Lease Expense" field={fin.rent_lease_expense} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Depreciation" field={fin.depreciation} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="Interest Expense" field={fin.interest_expense} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
        </div>

        {/* Earnings Metrics */}
        <h4 style={subsectionHeaderStyle}>Earnings Metrics</h4>
        <div style={gridStyle}>
          <FieldCell label="EBITDAR" field={fin.ebitdar} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="EBITDA" field={fin.ebitda} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
          <FieldCell label="EBIT" field={fin.ebit} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
        </div>

      </div>
    );
  };

  // Render Census & Rates Tab
  const renderCensusTab = () => (
    <div>
      {/* Census & Occupancy Trend Charts */}
      <h3 style={sectionHeaderStyle}>Census & Occupancy Trends</h3>
      <CensusTrendCharts
        monthlyTrends={extractionData.census_and_occupancy.monthly_trends}
        currentOccupancy={extractionData.census_and_occupancy.occupancy_pct}
        currentADC={extractionData.census_and_occupancy.average_daily_census}
        currentPayerMix={extractionData.census_and_occupancy.payer_mix_by_census}
        bedCount={extractionData.facility_information.bed_count.value ?? undefined}
        onSourceClick={handleSourceClick}
      />

      {/* Payer Mix Charts - Keep as summary view */}
      <h4 style={subsectionHeaderStyle}>Payer Mix Summary</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <PayerMixChart
          title="Payer Mix by Census"
          medicaid={extractionData.census_and_occupancy.payer_mix_by_census.medicaid_pct}
          medicare={extractionData.census_and_occupancy.payer_mix_by_census.medicare_pct}
          privatePay={extractionData.census_and_occupancy.payer_mix_by_census.private_pay_pct}
        />
        <PayerMixChart
          title="Payer Mix by Revenue"
          medicaid={extractionData.census_and_occupancy.payer_mix_by_revenue.medicaid_pct}
          medicare={extractionData.census_and_occupancy.payer_mix_by_revenue.medicare_pct}
          privatePay={extractionData.census_and_occupancy.payer_mix_by_revenue.private_pay_pct}
        />
      </div>

      {/* Rate Information */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2.5rem' }}>Rate Information</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <RatesTable rates={extractionData.rate_information.private_pay_rates} type="private_pay" />
        <RatesTable rates={extractionData.rate_information.medicaid_rates} type="medicaid" />
      </div>
      <div style={{ maxWidth: '250px' }}>
        <FieldCell label="Average Daily Rate" field={extractionData.rate_information.average_daily_rate} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
      </div>
    </div>
  );

  // Render Calculator Tab
  const renderCalculatorTab = () => (
    <div>
      {dealId ? (
        <DealCalculatorTab dealId={dealId} deal={deal} />
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          <Calculator size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>Calculator requires deal information</p>
        </div>
      )}
    </div>
  );

  // Render Pro Forma Tab
  const renderProFormaTab = () => (
    <div>
      {dealId && extractionData ? (
        <ProFormaTab
          deal={deal}
          extractionData={extractionData}
          onSaveScenario={handleSaveScenario}
        />
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          <Target size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>Pro Forma analysis requires extraction data</p>
        </div>
      )}
    </div>
  );

  // Helper to check if key_observations is structured format
  const getStructuredObservations = () => {
    const obs = extractionData.key_observations;
    if (!obs) return null;
    // If it's an array, it's legacy format
    if (Array.isArray(obs)) return null;
    // Otherwise it's structured
    return obs as { deal_strengths: string[]; deal_risks: string[]; missing_data: string[]; calculation_notes: string[] };
  };

  const structuredObs = getStructuredObservations();
  const legacyObservations = Array.isArray(extractionData.key_observations) ? extractionData.key_observations : [];

  // Handle adding a reviewer note
  const handleAddNote = () => {
    if (newNote.trim()) {
      const updatedNotes = [...reviewerNotes, newNote.trim()];
      setReviewerNotes(updatedNotes);
      setNewNote('');
      // Save to backend via onFieldEdit if available
      if (onFieldEdit) {
        onFieldEdit('reviewer_notes', updatedNotes);
      }
    }
  };

  // Handle deleting a reviewer note
  const handleDeleteNote = (index: number) => {
    const updatedNotes = reviewerNotes.filter((_, i) => i !== index);
    setReviewerNotes(updatedNotes);
    if (onFieldEdit) {
      onFieldEdit('reviewer_notes', updatedNotes);
    }
  };

  // Observation section component
  const ObservationSection = ({
    title,
    icon: Icon,
    iconColor,
    items,
    bgColor,
    borderColor,
    textColor,
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    items: string[];
    bgColor: string;
    borderColor: string;
    textColor: string;
  }) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <h4 style={{
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Icon size={16} style={{ color: iconColor }} />
        {title}
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 400,
          color: '#9ca3af',
          marginLeft: '0.25rem'
        }}>
          ({items.length})
        </span>
      </h4>
      {items.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, index) => (
            <li key={index} style={{
              padding: '0.75rem 1rem',
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '0.5rem',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: textColor,
            }}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.875rem' }}>
          No {title.toLowerCase()} identified
        </p>
      )}
    </div>
  );

  // Helper function to parse markdown into individual sections
  const parseMarkdownSections = (markdown: string) => {
    const sections: Array<{ title: string; content: string }> = [];
    const lines = markdown.split('\n');
    let currentSection: { title: string; content: string } | null = null;

    for (const line of lines) {
      // Match ## headers (but not # or ###)
      if (line.match(/^## [^#]/)) {
        // Save previous section if it exists
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        currentSection = {
          title: line.replace(/^## /, '').trim(),
          content: ''
        };
      } else if (currentSection) {
        // Add line to current section
        currentSection.content += line + '\n';
      }
    }

    // Don't forget the last section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  };

  // Render Deal Overview Tab (Stage 1 Screening)
  const renderDealOverviewTab = () => {
    const overview = extractionData?.deal_overview;

    if (!overview) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Lightbulb size={48} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
            No deal screening data available.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
            Re-extract documents to generate Stage 1 deal screening analysis.
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* Recommendation Badge - Top Priority */}
        {overview.recommendation && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.5rem',
            background: overview.recommendation.decision === 'PURSUE'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : overview.recommendation.decision === 'PURSUE_WITH_CAUTION'
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '0.75rem',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9, marginBottom: '0.25rem' }}>
                RECOMMENDATION
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                {overview.recommendation.decision.replace(/_/g, ' ')}
              </div>
            </div>
            <Target size={32} style={{ opacity: 0.8 }} />
          </div>
        )}

        {/* Executive Summary - 1000 Character Summary */}
        {overview.summary_1000_chars && (
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f8fafc',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <FileText size={20} style={{ color: '#3b82f6' }} />
              Executive Summary
            </h3>
            <div style={{
              fontSize: '0.875rem',
              lineHeight: '1.6',
              color: '#334155',
              whiteSpace: 'pre-wrap',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {overview.summary_1000_chars}
            </div>
          </div>
        )}

        {/* Key Metrics Cards */}
        {overview.ttm_financials?.summary_metrics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>TTM Revenue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                ${overview.ttm_financials.summary_metrics.total_revenue
                  ? (overview.ttm_financials.summary_metrics.total_revenue / 1000000).toFixed(2) + 'M'
                  : 'N/A'}
              </div>
            </div>
            <div style={{
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>EBITDAR</div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: (overview.ttm_financials.summary_metrics.ebitdar || 0) >= 0 ? '#10b981' : '#ef4444'
              }}>
                ${overview.ttm_financials.summary_metrics.ebitdar
                  ? (overview.ttm_financials.summary_metrics.ebitdar / 1000).toFixed(0) + 'K'
                  : 'N/A'}
              </div>
            </div>
            <div style={{
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>EBITDAR Margin</div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: (overview.ttm_financials.summary_metrics.ebitdar_margin_pct || 0) >= 15 ? '#10b981' : '#ef4444'
              }}>
                {overview.ttm_financials.summary_metrics.ebitdar_margin_pct?.toFixed(1) || 'N/A'}%
              </div>
            </div>
            <div style={{
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Occupancy</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                {overview.facility_snapshot?.current_occupancy_pct?.toFixed(1) || 'N/A'}%
              </div>
            </div>
          </div>
        )}

        {/* Red Flags & Strengths Side by Side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Red Flags */}
          <div style={{
            padding: '1.25rem',
            backgroundColor: '#fef2f2',
            borderRadius: '0.75rem',
            border: '1px solid #fecaca'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#991b1b',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={20} style={{ color: '#ef4444' }} />
              Red Flags
            </h3>
            {overview.red_flags && overview.red_flags.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {overview.red_flags.map((flag, index) => (
                  <li key={index} style={{
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #fecaca'
                  }}>
                    <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.25rem' }}>
                      {flag.issue}
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        backgroundColor: '#fee2e2',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}>
                        {flag.severity}
                      </span>
                    </div>
                    <div style={{ color: '#7f1d1d' }}>{flag.impact}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#991b1b', fontSize: '0.875rem', fontStyle: 'italic' }}>No critical red flags identified</p>
            )}
          </div>

          {/* Strengths */}
          <div style={{
            padding: '1.25rem',
            backgroundColor: '#ecfdf5',
            borderRadius: '0.75rem',
            border: '1px solid #a7f3d0'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#065f46',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <TrendingUp size={20} style={{ color: '#10b981' }} />
              Strengths
            </h3>
            {overview.strengths && overview.strengths.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {overview.strengths.map((strength, index) => (
                  <li key={index} style={{
                    padding: '0.75rem',
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #a7f3d0'
                  }}>
                    <div style={{ fontWeight: 600, color: '#065f46', marginBottom: '0.25rem' }}>
                      {strength.strength}
                    </div>
                    <div style={{ color: '#047857' }}>{strength.value}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#065f46', fontSize: '0.875rem', fontStyle: 'italic' }}>No strengths identified</p>
            )}
          </div>
        </div>

        {/* Valuation Summary */}
        {overview.valuation && (
          <div style={{
            marginBottom: '2rem',
            padding: '1.25rem',
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <DollarSign size={20} style={{ color: '#3b82f6' }} />
              Valuation Analysis
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* As-Is Value */}
              {overview.valuation.as_is_value && (
                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>As-Is Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>
                    ${overview.valuation.as_is_value.income_approach_low
                      ? (overview.valuation.as_is_value.income_approach_low / 1000000).toFixed(2)
                      : '?'}M - ${overview.valuation.as_is_value.income_approach_high
                      ? (overview.valuation.as_is_value.income_approach_high / 1000000).toFixed(2)
                      : '?'}M
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    ${overview.valuation.as_is_value.per_bed_low
                      ? (overview.valuation.as_is_value.per_bed_low / 1000).toFixed(0)
                      : '?'}K - ${overview.valuation.as_is_value.per_bed_high
                      ? (overview.valuation.as_is_value.per_bed_high / 1000).toFixed(0)
                      : '?'}K per bed
                  </div>
                </div>
              )}

              {/* Stabilized Value */}
              {overview.valuation.stabilized_value && (
                <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>Stabilized Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem' }}>
                    ${overview.valuation.stabilized_value.value_at_9pct_cap
                      ? (overview.valuation.stabilized_value.value_at_9pct_cap / 1000000).toFixed(2) + 'M'
                      : 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    At {overview.valuation.stabilized_value.target_occupancy_pct || '?'}% occupancy, 9% cap
                  </div>
                </div>
              )}
            </div>

            {/* Max Purchase Price */}
            {overview.valuation.max_purchase_price && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#eff6ff',
                borderRadius: '0.5rem',
                border: '1px solid #93c5fd'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem', fontWeight: 600 }}>
                  MAX PURCHASE PRICE
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e40af' }}>
                  ${overview.valuation.max_purchase_price.max_price
                    ? (overview.valuation.max_purchase_price.max_price / 1000000).toFixed(2) + 'M'
                    : 'N/A'}
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, marginLeft: '0.5rem' }}>
                    (${overview.valuation.max_purchase_price.max_price_per_bed
                      ? (overview.valuation.max_purchase_price.max_price_per_bed / 1000).toFixed(0) + 'K/bed'
                      : 'N/A'})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendation Rationale */}
        {overview.recommendation?.rationale && (
          <div style={{
            padding: '1.25rem',
            backgroundColor: '#f8fafc',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <MessageSquare size={20} style={{ color: '#3b82f6' }} />
              Rationale
            </h3>
            <p style={{
              fontSize: '0.875rem',
              lineHeight: '1.6',
              color: '#334155',
              margin: 0
            }}>
              {overview.recommendation.rationale}
            </p>
          </div>
        )}

        {/* Individual Collapsible Sections for Markdown Content */}
        {overview.detailed_narrative_markdown && (
          <>
            {parseMarkdownSections(overview.detailed_narrative_markdown).map((section, index) => {
              const sectionKey = section.title.replace(/\s+/g, '-');
              const isExpanded = expandedSections[sectionKey] || false;

              return (
                <div key={sectionKey} style={{
                  marginBottom: '1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                  {/* Collapsible Header */}
                  <button
                    onClick={() => setExpandedSections(prev => ({ ...prev, [sectionKey]: !isExpanded }))}
                    style={{
                      width: '100%',
                      padding: '1rem 1.5rem',
                      backgroundColor: isExpanded ? '#f9fafb' : 'white',
                      border: 'none',
                      borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isExpanded ? '#f9fafb' : 'white'}
                  >
                    <h3 style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#1e293b',
                      margin: 0
                    }}>
                      {section.title}
                    </h3>
                    {isExpanded ? (
                      <ChevronUp size={20} style={{ color: '#6b7280', flexShrink: 0 }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: '#6b7280', flexShrink: 0 }} />
                    )}
                  </button>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div style={{
                      padding: '1.5rem',
                      backgroundColor: 'white',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      lineHeight: '1.6'
                    }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => (
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              marginBottom: '1rem',
                              fontSize: '0.875rem'
                            }} {...props} />
                          ),
                          thead: ({node, ...props}) => (
                            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }} {...props} />
                          ),
                          th: ({node, ...props}) => (
                            <th style={{
                              padding: '0.75rem',
                              textAlign: 'left',
                              fontWeight: 600,
                              borderBottom: '1px solid #e5e7eb'
                            }} {...props} />
                          ),
                          td: ({node, ...props}) => (
                            <td style={{
                              padding: '0.75rem',
                              borderBottom: '1px solid #f3f4f6'
                            }} {...props} />
                          ),
                          h1: ({node, ...props}) => (
                            <h1 style={{
                              fontSize: '1.75rem',
                              fontWeight: 700,
                              marginTop: '1.5rem',
                              marginBottom: '0.75rem',
                              color: '#111827'
                            }} {...props} />
                          ),
                          h2: ({node, ...props}) => (
                            <h2 style={{
                              fontSize: '1.35rem',
                              fontWeight: 600,
                              marginTop: '1.25rem',
                              marginBottom: '0.5rem',
                              color: '#1f2937'
                            }} {...props} />
                          ),
                          h3: ({node, ...props}) => (
                            <h3 style={{
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              marginTop: '1rem',
                              marginBottom: '0.5rem',
                              color: '#374151'
                            }} {...props} />
                          ),
                          blockquote: ({node, ...props}) => (
                            <blockquote style={{
                              borderLeft: '4px solid #3b82f6',
                              paddingLeft: '1rem',
                              marginLeft: 0,
                              marginBottom: '1rem',
                              color: '#4b5563',
                              fontStyle: 'italic'
                            }} {...props} />
                          ),
                          code: ({node, inline, ...props}: any) =>
                            inline ? (
                              <code style={{
                                backgroundColor: '#f3f4f6',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.875em',
                                fontFamily: 'monospace'
                              }} {...props} />
                            ) : (
                              <code style={{
                                display: 'block',
                                backgroundColor: '#1f2937',
                                color: '#f9fafb',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                overflowX: 'auto',
                                marginBottom: '1rem',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem'
                              }} {...props} />
                            ),
                          hr: ({node, ...props}) => (
                            <hr style={{
                              border: 'none',
                              borderTop: '1px solid #e5e7eb',
                              margin: '1.5rem 0'
                            }} {...props} />
                          ),
                        }}
                      >
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // Render Observations Tab (Legacy - keeping for backwards compatibility)
  const renderObservationsTab = () => (
    <div>
      {/* AI-Generated Insights Section */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '0.5rem',
        padding: '1.25rem',
        marginBottom: '2rem',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Brain size={20} style={{ color: '#8b5cf6' }} />
          AI-Generated Insights
        </h3>

        {structuredObs ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            <ObservationSection
              title="Deal Strengths"
              icon={TrendingUp}
              iconColor="#10b981"
              items={structuredObs.deal_strengths || []}
              bgColor="#ecfdf5"
              borderColor="#a7f3d0"
              textColor="#065f46"
            />
            <ObservationSection
              title="Deal Risks"
              icon={TrendingDown}
              iconColor="#ef4444"
              items={structuredObs.deal_risks || []}
              bgColor="#fef2f2"
              borderColor="#fecaca"
              textColor="#991b1b"
            />
            <ObservationSection
              title="Missing Data"
              icon={HelpCircle}
              iconColor="#f59e0b"
              items={structuredObs.missing_data || []}
              bgColor="#fffbeb"
              borderColor="#fcd34d"
              textColor="#92400e"
            />
            <ObservationSection
              title="Calculation Notes"
              icon={Wrench}
              iconColor="#6366f1"
              items={structuredObs.calculation_notes || []}
              bgColor="#eef2ff"
              borderColor="#c7d2fe"
              textColor="#3730a3"
            />
          </div>
        ) : legacyObservations.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {legacyObservations.map((observation, index) => (
              <li key={index} style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#eff6ff',
                border: '1px solid #93c5fd',
                borderRadius: '0.5rem',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                color: '#1e40af',
              }}>
                {observation}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
            No AI insights available. Re-extract documents to generate insights.
          </p>
        )}
      </div>

      {/* Data Quality Notes */}
      {extractionData.data_quality_notes && extractionData.data_quality_notes.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={sectionHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
              Data Quality Notes
            </span>
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {extractionData.data_quality_notes.map((note, index) => (
              <li key={index} style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: '0.5rem',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                color: '#92400e',
              }}>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reviewer Notes Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.25rem',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <MessageSquare size={20} style={{ color: '#3b82f6' }} />
          Reviewer Notes
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 400,
            color: '#9ca3af',
            marginLeft: '0.25rem'
          }}>
            (Add your own observations)
          </span>
        </h3>

        {/* Existing Notes */}
        {reviewerNotes.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
            {reviewerNotes.map((note, index) => (
              <li key={index} style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                color: '#374151',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}>
                <span style={{ flex: 1 }}>{note}</span>
                <button
                  onClick={() => handleDeleteNote(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: '#9ca3af',
                    flexShrink: 0,
                  }}
                  title="Delete note"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add New Note */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
            placeholder="Add a note about this deal..."
            style={{
              flex: 1,
              padding: '0.625rem 0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.625rem 1rem',
              backgroundColor: newNote.trim() ? '#3b82f6' : '#e5e7eb',
              color: newNote.trim() ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: newNote.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>
    </div>
  );

  // Handle re-extraction
  const handleReExtract = async () => {
    if (!dealId) return;

    setIsReExtracting(true);
    setReExtractionStatus('idle');
    setReExtractionMessage('');

    try {
      // Dynamically import to avoid circular dependencies
      const { reExtractDeal } = await import('../../api/DealService');
      const result = await reExtractDeal(dealId);

      if (result.success) {
        setReExtractionStatus('success');
        setReExtractionMessage(`Re-extraction complete! Processed ${result.body?.monthlyFinancials || 0} months of financial data.`);
        // Reload the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setReExtractionStatus('error');
        setReExtractionMessage(result.message || 'Re-extraction failed');
      }
    } catch (error: any) {
      setReExtractionStatus('error');
      setReExtractionMessage(error.response?.data?.message || error.message || 'Failed to re-extract documents');
    } finally {
      setIsReExtracting(false);
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    const type = fileType?.toLowerCase() || '';
    if (type.includes('pdf')) return <FileText size={20} style={{ color: '#ef4444' }} />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('xls')) return <FileSpreadsheet size={20} style={{ color: '#22c55e' }} />;
    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return <Image size={20} style={{ color: '#3b82f6' }} />;
    return <File size={20} style={{ color: '#6b7280' }} />;
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render Documents Tab
  const renderDocumentsTab = () => (
    <div>
      {/* Re-extraction Action Section */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <RefreshCw size={18} style={{ color: '#6366f1' }} />
              Re-run Document Extraction
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
              Re-analyze all uploaded documents to update financial data and AI insights.
              This will regenerate the Observations tab with the latest AI analysis.
            </p>
          </div>
          <button
            onClick={handleReExtract}
            disabled={isReExtracting || !dealId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: isReExtracting ? '#94a3b8' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: isReExtracting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {isReExtracting ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Re-extracting...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Re-extract All Documents
              </>
            )}
          </button>
        </div>

        {/* Status message */}
        {reExtractionStatus !== 'idle' && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: reExtractionStatus === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${reExtractionStatus === 'success' ? '#a7f3d0' : '#fecaca'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            {reExtractionStatus === 'success' ? (
              <CheckCircle size={16} style={{ color: '#10b981' }} />
            ) : (
              <XCircle size={16} style={{ color: '#ef4444' }} />
            )}
            <span style={{
              fontSize: '0.875rem',
              color: reExtractionStatus === 'success' ? '#065f46' : '#991b1b'
            }}>
              {reExtractionMessage}
            </span>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <FolderOpen size={18} style={{ color: '#3b82f6' }} />
          Uploaded Documents
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 400,
            color: '#9ca3af',
            marginLeft: '0.25rem'
          }}>
            ({dealDocuments.length} {dealDocuments.length === 1 ? 'file' : 'files'})
          </span>
        </h3>

        {dealDocuments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {dealDocuments.map((doc, index) => (
              <div
                key={doc.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#dbeafe',
                    borderRadius: '0.375rem',
                  }}>
                    {getFileIcon(doc.type || doc.file_type)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#111827',
                    }}>
                      {doc.document_name || doc.name}
                    </p>
                    <p style={{
                      margin: '0.25rem 0 0 0',
                      fontSize: '0.75rem',
                      color: '#6b7280',
                    }}>
                      {doc.size && `${doc.size} • `}
                      {doc.user && `Uploaded by ${doc.user.first_name} ${doc.user.last_name} • `}
                      {doc.created_at && doc.created_at.split('T')[0]}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* View Button */}
                  <button
                    onClick={() => onDocumentView?.(doc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Eye size={14} />
                    View
                  </button>
                  {/* Delete Button */}
                  <button
                    onClick={() => onDocumentDelete?.(doc.id)}
                    disabled={deleteLoadingId === doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #fca5a5',
                      borderRadius: '0.375rem',
                      color: '#dc2626',
                      cursor: deleteLoadingId === doc.id ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                      opacity: deleteLoadingId === doc.id ? 0.6 : 1,
                    }}
                  >
                    {deleteLoadingId === doc.id ? (
                      <>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        Delete
                      </>
                    )}
                  </button>
                  {/* Download Button */}
                  <button
                    onClick={() => onDocumentDownload?.(doc.document_url || doc.url || '')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    <DownloadIcon size={14} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem',
            border: '1px dashed #d1d5db',
          }}>
            <FolderOpen size={40} style={{ color: '#d1d5db', margin: '0 auto 1rem' }} />
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              No documents uploaded for this deal
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
              Documents uploaded during deal creation will appear here
            </p>
          </div>
        )}
      </div>

      {/* Upload New Documents Section */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '0.5rem',
        border: '1px solid #86efac',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <Upload size={20} style={{ color: '#16a34a', flexShrink: 0, marginTop: '0.125rem' }} />
            <div>
              <h4 style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#166534'
              }}>
                Add New Documents
              </h4>
              <p style={{
                margin: '0.375rem 0 0 0',
                fontSize: '0.8rem',
                color: '#15803d'
              }}>
                Upload additional documents to include in the deal analysis.
                After uploading, click "Re-extract All Documents" to process them.
              </p>
            </div>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              backgroundColor: isUploading ? '#94a3b8' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: isUploading || !onDocumentUpload ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                <Plus size={16} />
                Add Document
              </>
            )}
            <input
              type="file"
              accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              disabled={isUploading || !onDocumentUpload}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && onDocumentUpload) {
                  await onDocumentUpload(file);
                  e.target.value = ''; // Reset input
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'deal_overview':
        return renderDealOverviewTab();
      case 'financials':
        return renderFinancialsTab();
      case 'census':
        return renderCensusTab();
      case 'calculator':
        return renderCalculatorTab();
      case 'proforma':
        return renderProFormaTab();
      case 'documents':
        return renderDocumentsTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={20} style={{ color: '#3b82f6' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>AI Extraction Summary</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
              Extracted: {formatTimestamp(extractionData.extraction_timestamp)}
            </p>
          </div>
        </div>
        <button
          onClick={handleExportExcel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div style={tabContainerStyle}>
        {TAB_CONFIGS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={getTabStyle(activeTab === tab.id)}
            >
              <Icon size={16} />
              {tab.title}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={contentStyle}>
        {renderTabContent()}
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewer
        isOpen={documentViewerOpen}
        onClose={() => setDocumentViewerOpen(false)}
        sourceRef={selectedSourceRef}
        dealDocuments={dealDocuments}
      />

      {/* SNFalyze AI Panel */}
      <SNFalyzePanel
        isOpen={snfalyzePanelOpen}
        onClose={() => setSnfalyzePanelOpen(false)}
        dealId={dealId}
        deal={deal}
        autoAnalyze={false}
      />
    </div>
  );
};

export { DealExtractionViewer };
export default DealExtractionViewer;
