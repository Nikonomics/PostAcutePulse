// Sample extraction data for testing DealExtractionViewer

import { ExtractedDealData } from './types';

export const sampleExtractionData: ExtractedDealData = {
  document_types_identified: ['P&L Statement', 'Census Report', 'Rate Schedule', 'Floor Plans'],
  extraction_timestamp: '2025-01-15T14:30:00Z',

  deal_information: {
    deal_name: { value: 'Odd Fellows Home of Oregon', confidence: 'high', source: 'P&L Header' },
    deal_type: { value: null, confidence: 'not_found' },
    deal_source: { value: null, confidence: 'not_found' },
    priority_level: { value: null, confidence: 'not_found' },
    purchase_price: { value: null, confidence: 'not_found' },
    price_per_bed: { value: null, confidence: 'not_found' },
  },

  facility_information: {
    facility_name: {
      value: 'Odd Fellows Home of Oregon',
      confidence: 'high',
      source: 'Multiple documents',
    },
    facility_type: {
      value: 'Assisted Living',
      confidence: 'high',
      source: 'Document terminology (ALF/RCF)',
    },
    street_address: {
      value: '208 S.W. Stark Street',
      confidence: 'medium',
      source: 'Floor Plans - Architect stamp',
    },
    city: { value: 'Portland', confidence: 'high', source: 'Floor Plans' },
    state: { value: 'OR', confidence: 'high', source: 'Rate Schedule - Oregon DHS' },
    zip_code: { value: '97204', confidence: 'medium', source: 'Floor Plans' },
    bed_count: {
      value: 100,
      confidence: 'medium',
      source: 'Inferred from census max (99)',
      calculated: true,
    },
    unit_mix: { value: null, confidence: 'not_found' },
  },

  contact_information: {
    primary_contact_name: {
      value: 'Mychael Dokka',
      confidence: 'medium',
      source: 'Report headers - user who generated',
    },
    title: { value: null, confidence: 'not_found' },
    phone: { value: null, confidence: 'not_found' },
    email: { value: null, confidence: 'not_found' },
  },

  financial_information_t12: {
    period: { start: '2024-05', end: '2025-04' },
    total_revenue: { value: 3933015, confidence: 'high', source: 'Trailing_12-Month_P&L.xlsx' },
    revenue_by_payer: {
      medicaid_revenue: { value: 2857241, confidence: 'high', source: 'P&L - Medicaid Revenue' },
      medicare_revenue: { value: 0, confidence: 'high', source: 'P&L - No Medicare (ALF)' },
      private_pay_revenue: { value: 934268, confidence: 'high', source: 'P&L - Private Pay Revenue' },
      other_revenue: { value: 141506, confidence: 'high', source: 'P&L - Other Revenue' },
    },
    revenue_breakdown: {
      room_and_board: { value: 3791509, confidence: 'high', source: 'P&L - Room & Board line' },
      care_level_revenue: { value: 107974, confidence: 'high', source: 'P&L - Care Levels' },
      ancillary_revenue: { value: null, confidence: 'not_found' },
      other_income: { value: 33532, confidence: 'high', source: 'P&L - Other Income' },
    },
    total_expenses: { value: 5035549, confidence: 'high', source: 'P&L' },
    operating_expenses: { value: 4300013, confidence: 'high', source: 'P&L - Operating Expenses' },
    total_labor_cost: { value: 2900000, confidence: 'high', source: 'P&L - Total Labor' },
    agency_labor_cost: { value: 320000, confidence: 'high', source: 'P&L - Agency Staffing' },
    ebitdar: {
      value: -366998,
      raw_value: 'Calculated',
      confidence: 'medium',
      calculated: true,
      source: 'Revenue - OpEx + D&A + Interest + Rent',
    },
    rent_lease_expense: { value: 48000, confidence: 'high', source: 'P&L - Land Lease' },
    ebitda: {
      value: -414998,
      confidence: 'medium',
      calculated: true,
      source: 'EBITDAR - Rent',
    },
    depreciation: { value: 255484, confidence: 'high', source: 'P&L' },
    amortization: { value: null, confidence: 'not_found' },
    interest_expense: { value: 127679, confidence: 'high', source: 'P&L - Bond Interest' },
    property_taxes: { value: 33105, confidence: 'high', source: 'P&L - Property Taxes' },
    property_insurance: { value: 142077, confidence: 'high', source: 'P&L - Property Insurance' },
    ebit: {
      value: -846856,
      confidence: 'medium',
      calculated: true,
      source: 'Net Income + Interest + Taxes',
    },
    net_income: { value: -1102534, confidence: 'high', source: 'P&L - Total Income (Loss)' },
  },

  ytd_performance: {
    period: { start: '2025-03', end: '2025-09' },
    total_revenue: { value: 2263424, confidence: 'high', source: 'YTD I&E Statement' },
    total_expenses: { value: 2912354, confidence: 'high', source: 'YTD I&E Statement' },
    net_income: { value: -648930, confidence: 'high', source: 'YTD I&E Statement' },
    average_daily_census: { value: 88.9, confidence: 'high', source: 'YTD Census Report' },
    medicaid_days: { value: 15395, confidence: 'high', source: 'YTD Census Report' },
    private_pay_days: { value: 3626, confidence: 'high', source: 'YTD Census Report' },
    total_census_days: { value: 19021, confidence: 'high', source: 'YTD Census Report' },
  },

  census_and_occupancy: {
    average_daily_census: { value: 94, confidence: 'high', source: 'Census Report' },
    occupancy_pct: {
      value: 94,
      confidence: 'medium',
      calculated: true,
      source: 'Avg Census (94) / Beds (100)',
    },
    payer_mix_by_census: {
      medicaid_pct: { value: 78, confidence: 'high', source: 'Census Report' },
      medicare_pct: { value: 0, confidence: 'high', source: 'Census Report - ALF no Medicare' },
      private_pay_pct: { value: 22, confidence: 'high', source: 'Census Report' },
    },
    payer_mix_by_revenue: {
      medicaid_pct: { value: 73, confidence: 'high', source: 'P&L - Medicaid R&B / Total R&B' },
      medicare_pct: { value: 0, confidence: 'high', source: 'P&L' },
      private_pay_pct: { value: 24, confidence: 'high', source: 'P&L' },
    },
  },

  rate_information: {
    private_pay_rates: {
      value: [
        { unit_type: 'Studio', monthly_rate: 4128 },
        { unit_type: '1 Bedroom', monthly_rate: 4992 },
        { unit_type: '1 BR w/Deck', monthly_rate: 5081 },
        { unit_type: '2 BR 1 BA w/Deck', monthly_rate: 5240 },
        { unit_type: '2 BR 2 BA w/Deck', monthly_rate: 5376 },
      ],
      confidence: 'high',
      source: 'ALF_Private_Pay_Rates_2024.docx',
    },
    medicaid_rates: {
      value: [
        { care_level: 'Level 1', monthly_rate: 1980 },
        { care_level: 'Level 2', monthly_rate: 2454 },
        { care_level: 'Level 3', monthly_rate: 3079 },
        { care_level: 'Level 4', monthly_rate: 3866 },
        { care_level: 'Level 5', monthly_rate: 4649 },
      ],
      confidence: 'high',
      source: 'Rate-schedule_July_2025.pdf',
    },
    average_daily_rate: { value: null, confidence: 'not_found' },
  },

  pro_forma_projections: {
    year_1: {
      revenue: { value: null, confidence: 'not_found' },
      ebitdar: { value: null, confidence: 'not_found' },
      ebitda: { value: null, confidence: 'not_found' },
      occupancy_pct: { value: null, confidence: 'not_found' },
      ebit: { value: null, confidence: 'not_found' },
    },
    year_2: {
      revenue: { value: null, confidence: 'not_found' },
      ebitdar: { value: null, confidence: 'not_found' },
      ebitda: { value: null, confidence: 'not_found' },
      occupancy_pct: { value: null, confidence: 'not_found' },
      ebit: { value: null, confidence: 'not_found' },
    },
    year_3: {
      revenue: { value: null, confidence: 'not_found' },
      ebitdar: { value: null, confidence: 'not_found' },
      ebitda: { value: null, confidence: 'not_found' },
      occupancy_pct: { value: null, confidence: 'not_found' },
      ebit: { value: null, confidence: 'not_found' },
    },
  },

  deal_metrics: {
    revenue_multiple: { value: null, confidence: 'not_found' },
    ebitda_multiple: { value: null, confidence: 'not_found' },
    cap_rate: { value: null, confidence: 'not_found' },
    target_irr: { value: null, confidence: 'not_found' },
    hold_period_years: { value: null, confidence: 'not_found' },
  },

  data_quality_notes: [
    'Operating losses: Facility showing consistent net losses (~$92K/month average)',
    'High agency staffing costs: ~$320K/year in agency CNA expenses',
    'Census trending down: 99 (Jul 2024) → 90 (Apr 2025)',
    'No purchase price or deal terms found - appears to be operational data only, not a broker package',
  ],

  key_observations: [
    'Heavy Medicaid concentration (~78% of census) creates reimbursement rate risk',
    'Private pay rates ($4,100-$5,400) significantly higher than Medicaid ($1,980-$3,079) - upside if payer mix shifts',
    'Fixed cost burden: Land lease ($48K) + insurance ($142K) + bond interest ($128K) = $318K fixed annually',
    'Labor intensive operation: Direct care + culinary = ~$2.9M annually (74% of operating expenses)',
  ],
};

// Sample with pro forma data for complete testing
export const sampleWithProForma: ExtractedDealData = {
  ...sampleExtractionData,
  deal_information: {
    ...sampleExtractionData.deal_information,
    purchase_price: { value: 8500000, confidence: 'high', source: 'CIM - Asking Price' },
    price_per_bed: {
      value: 85000,
      confidence: 'medium',
      calculated: true,
      source: 'Purchase Price / Bed Count',
    },
  },
  pro_forma_projections: {
    year_1: {
      revenue: { value: 4200000, confidence: 'medium', source: 'CIM Pro Forma' },
      ebitdar: { value: 420000, confidence: 'medium', source: 'CIM Pro Forma' },
      ebitda: { value: 372000, confidence: 'medium', source: 'CIM Pro Forma' },
      occupancy_pct: { value: 95, confidence: 'medium', source: 'CIM Pro Forma' },
      ebit: { value: 320000, confidence: 'medium', source: 'CIM Pro Forma' },
    },
    year_2: {
      revenue: { value: 4500000, confidence: 'medium', source: 'CIM Pro Forma' },
      ebitdar: { value: 540000, confidence: 'medium', source: 'CIM Pro Forma' },
      ebitda: { value: 492000, confidence: 'medium', source: 'CIM Pro Forma' },
      occupancy_pct: { value: 96, confidence: 'medium', source: 'CIM Pro Forma' },
      ebit: { value: 440000, confidence: 'medium', source: 'CIM Pro Forma' },
    },
    year_3: {
      revenue: { value: 4800000, confidence: 'medium', source: 'CIM Pro Forma' },
      ebitdar: { value: 672000, confidence: 'medium', source: 'CIM Pro Forma' },
      ebitda: { value: 624000, confidence: 'medium', source: 'CIM Pro Forma' },
      occupancy_pct: { value: 97, confidence: 'medium', source: 'CIM Pro Forma' },
      ebit: { value: 572000, confidence: 'medium', source: 'CIM Pro Forma' },
    },
  },
  deal_metrics: {
    revenue_multiple: { value: 2.16, confidence: 'medium', calculated: true, source: 'Purchase Price / Revenue' },
    ebitda_multiple: {
      value: 22.85,
      confidence: 'low',
      calculated: true,
      source: 'Purchase Price / EBITDA (negative, use absolute)',
    },
    cap_rate: { value: 7.5, confidence: 'medium', source: 'CIM' },
    target_irr: { value: 18, confidence: 'medium', source: 'CIM' },
    hold_period_years: { value: 5, confidence: 'medium', source: 'CIM' },
  },
};

// Empty state for testing
export const emptyExtractionData: ExtractedDealData | null = null;
