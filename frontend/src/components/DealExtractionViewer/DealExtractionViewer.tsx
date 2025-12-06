import React, { useState, useCallback, useMemo } from 'react';
import {
  Download,
  FileText,
  AlertTriangle,
  Lightbulb,
  Building2,
  DollarSign,
  Users,
  BarChart3,
  TrendingUp,
  Calculator,
  ClipboardList,
  Target,
  Brain,
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
  { id: 'overview', title: 'Overview', icon: Building2 },
  { id: 'financials', title: 'Financials', icon: DollarSign },
  { id: 'census', title: 'Census & Rates', icon: Users },
  { id: 'projections', title: 'Projections', icon: TrendingUp },
  { id: 'calculator', title: 'Calculator', icon: Calculator },
  { id: 'proforma', title: 'Pro Forma', icon: Target },
  { id: 'observations', title: 'Observations', icon: Lightbulb },
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
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showComparison] = useState(initialShowComparison);

  // State for document viewer modal
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedSourceRef, setSelectedSourceRef] = useState<SourceReference | null>(null);

  // State for SNFalyze panel
  const [snfalyzePanelOpen, setSnfalyzePanelOpen] = useState(false);

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
    if (extractionData.key_observations?.length > 0) {
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
        <FieldCell label="Deal Name" field={extractionData.deal_information.deal_name} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Deal Type" field={extractionData.deal_information.deal_type} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Deal Source" field={extractionData.deal_information.deal_source} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Priority Level" field={extractionData.deal_information.priority_level} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Purchase Price" field={extractionData.deal_information.purchase_price} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Price Per Bed" field={extractionData.deal_information.price_per_bed} format="currency" showComparison={showComparison} onSourceClick={handleSourceClick} />
      </div>

      {/* Facility Information */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2rem' }}>Facility Information</h3>
      <div style={gridStyle}>
        <FieldCell label="Facility Name" field={extractionData.facility_information.facility_name} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Facility Type" field={extractionData.facility_information.facility_type} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Street Address" field={extractionData.facility_information.street_address} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="City" field={extractionData.facility_information.city} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="State" field={extractionData.facility_information.state} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Zip Code" field={extractionData.facility_information.zip_code} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Bed Count" field={extractionData.facility_information.bed_count} format="number" showComparison={showComparison} onSourceClick={handleSourceClick} />
      </div>

      {/* Contact Information */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2rem' }}>Contact Information</h3>
      <div style={gridStyle}>
        <FieldCell label="Primary Contact" field={extractionData.contact_information.primary_contact_name} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Title" field={extractionData.contact_information.title} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Phone" field={extractionData.contact_information.phone} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Email" field={extractionData.contact_information.email} format="text" showComparison={showComparison} onSourceClick={handleSourceClick} />
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
        currentOccupancy={extractionData.census_and_occupancy.occupancy_percentage}
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

  // Render Projections Tab
  const renderProjectionsTab = () => (
    <div>
      {/* Pro Forma Projections */}
      <h3 style={sectionHeaderStyle}>Pro Forma Projections</h3>
      <ProFormaTable projections={extractionData.pro_forma_projections} showComparison={showComparison} />

      {/* Deal Metrics */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2.5rem' }}>Deal Metrics</h3>
      <div style={gridStyle}>
        <FieldCell label="Revenue Multiple" field={extractionData.deal_metrics.revenue_multiple} format="number" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="EBITDA Multiple" field={extractionData.deal_metrics.ebitda_multiple} format="number" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Cap Rate" field={extractionData.deal_metrics.cap_rate} format="percent" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Target IRR" field={extractionData.deal_metrics.target_irr} format="percent" showComparison={showComparison} onSourceClick={handleSourceClick} />
        <FieldCell label="Hold Period (Years)" field={extractionData.deal_metrics.hold_period_years} format="number" showComparison={showComparison} onSourceClick={handleSourceClick} />
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

  // Render Observations Tab
  const renderObservationsTab = () => (
    <div>
      {/* Data Quality Notes */}
      <h3 style={sectionHeaderStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
          Data Quality Notes
        </span>
      </h3>
      {extractionData.data_quality_notes && extractionData.data_quality_notes.length > 0 ? (
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
      ) : (
        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No data quality notes</p>
      )}

      {/* Key Observations */}
      <h3 style={{ ...sectionHeaderStyle, marginTop: '2rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lightbulb size={18} style={{ color: '#3b82f6' }} />
          Key Observations
        </span>
      </h3>
      {extractionData.key_observations && extractionData.key_observations.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {extractionData.key_observations.map((observation, index) => (
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
        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No key observations</p>
      )}
    </div>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'financials':
        return renderFinancialsTab();
      case 'census':
        return renderCensusTab();
      case 'projections':
        return renderProjectionsTab();
      case 'calculator':
        return renderCalculatorTab();
      case 'proforma':
        return renderProFormaTab();
      case 'observations':
        return renderObservationsTab();
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
