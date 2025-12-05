// TypeScript interfaces for DealExtractionViewer component

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'not_found' | 'conflict';

// Parsed source reference for clickable citations
export interface SourceReference {
  document: string;       // Filename (e.g., "Trailing_12-Month_P&L.xlsx")
  location?: string;      // Location in document (e.g., "Sheet 'Summary', Row 45")
  snippet?: string;       // Text snippet showing the value
  isCalculated?: boolean; // Whether this is a calculated value
}

export interface ExtractedField<T> {
  value: T | null;
  raw_value?: string;
  confidence: ConfidenceLevel;
  source?: string;                    // Raw source string from AI
  source_ref?: SourceReference;       // Parsed source reference for UI
  calculated?: boolean;
  conflict_details?: string;
}

export interface ProFormaYear {
  revenue: ExtractedField<number>;
  ebitdar: ExtractedField<number>;
  ebitda: ExtractedField<number>;
  occupancy_pct: ExtractedField<number>;
  ebit: ExtractedField<number>;
}

export interface RateItem {
  unit_type?: string;
  care_level?: string;
  monthly_rate: number;
}

// Monthly trend data point for T12 trendlines
export interface MonthlyTrendPoint {
  month: string;           // Format: "YYYY-MM" or "MMM YYYY"
  occupancy_pct?: number;
  average_daily_census?: number;
  medicaid_pct?: number;
  medicare_pct?: number;
  private_pay_pct?: number;
  total_revenue?: number;
  ebitda?: number;
}

export interface ExtractedDealData {
  document_types_identified: string[];
  extraction_timestamp: string;

  deal_information: {
    deal_name: ExtractedField<string>;
    deal_type: ExtractedField<string>;
    deal_source: ExtractedField<string>;
    priority_level: ExtractedField<string>;
    purchase_price: ExtractedField<number>;
    price_per_bed: ExtractedField<number>;
  };

  facility_information: {
    facility_name: ExtractedField<string>;
    facility_type: ExtractedField<string>;
    street_address: ExtractedField<string>;
    city: ExtractedField<string>;
    state: ExtractedField<string>;
    zip_code: ExtractedField<string>;
    bed_count: ExtractedField<number>;
    unit_mix: ExtractedField<Record<string, number>>;
  };

  contact_information: {
    primary_contact_name: ExtractedField<string>;
    title: ExtractedField<string>;
    phone: ExtractedField<string>;
    email: ExtractedField<string>;
  };

  financial_information_t12: {
    period: { start: string | null; end: string | null };
    total_revenue: ExtractedField<number>;
    // Revenue by payer source
    revenue_by_payer: {
      medicaid_revenue: ExtractedField<number>;
      medicare_revenue: ExtractedField<number>;
      private_pay_revenue: ExtractedField<number>;
      other_revenue: ExtractedField<number>;
    };
    // Revenue by type
    revenue_breakdown: {
      room_and_board: ExtractedField<number>;
      care_level_revenue: ExtractedField<number>;
      ancillary_revenue: ExtractedField<number>;
      other_income: ExtractedField<number>;
    };
    total_expenses: ExtractedField<number>;
    operating_expenses: ExtractedField<number>;
    ebitdar: ExtractedField<number>;
    rent_lease_expense: ExtractedField<number>;
    ebitda: ExtractedField<number>;
    depreciation: ExtractedField<number>;
    amortization: ExtractedField<number>;
    interest_expense: ExtractedField<number>;
    property_taxes: ExtractedField<number>;
    property_insurance: ExtractedField<number>;
    ebit: ExtractedField<number>;
    net_income: ExtractedField<number>;
  };

  // Year-to-Date Performance (current year)
  ytd_performance?: {
    period: { start: string | null; end: string | null };
    total_revenue: ExtractedField<number>;
    total_expenses: ExtractedField<number>;
    net_income: ExtractedField<number>;
    average_daily_census: ExtractedField<number>;
    medicaid_days: ExtractedField<number>;
    private_pay_days: ExtractedField<number>;
    total_census_days: ExtractedField<number>;
  };

  census_and_occupancy: {
    average_daily_census: ExtractedField<number>;
    occupancy_percentage: ExtractedField<number>;
    payer_mix_by_census: {
      medicaid_pct: ExtractedField<number>;
      medicare_pct: ExtractedField<number>;
      private_pay_pct: ExtractedField<number>;
    };
    payer_mix_by_revenue: {
      medicaid_pct: ExtractedField<number>;
      medicare_pct: ExtractedField<number>;
      private_pay_pct: ExtractedField<number>;
    };
    monthly_trends?: ExtractedField<MonthlyTrendPoint[]>;
  };

  rate_information: {
    private_pay_rates: ExtractedField<RateItem[]>;
    medicaid_rates: ExtractedField<RateItem[]>;
    average_daily_rate: ExtractedField<number>;
  };

  pro_forma_projections: {
    year_1: ProFormaYear;
    year_2: ProFormaYear;
    year_3: ProFormaYear;
  };

  deal_metrics: {
    revenue_multiple: ExtractedField<number>;
    ebitda_multiple: ExtractedField<number>;
    cap_rate: ExtractedField<number>;
    target_irr: ExtractedField<number>;
    hold_period_years: ExtractedField<number>;
  };

  data_quality_notes: string[];
  key_observations: string[];
}

export interface DealExtractionViewerProps {
  extractionData: ExtractedDealData | null;
  onFieldEdit?: (fieldPath: string, newValue: any) => void;
  showComparison?: boolean;
  expandedSections?: string[];
  isLoading?: boolean;
  dealDocuments?: DealDocument[];  // List of documents for source citations
  dealId?: number;   // Deal ID for calculator tab
  deal?: any;        // Full deal object for calculator tab
}

export interface SectionProps {
  id: string;
  title: string;
  headerColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  fieldsExtracted: number;
  totalFields: number;
  children: React.ReactNode;
}

export interface FieldCellProps {
  label: string;
  field: ExtractedField<any>;
  format?: 'currency' | 'percent' | 'number' | 'text';
  showComparison?: boolean;
  onEdit?: (newValue: any) => void;
  fieldPath?: string;
  onSourceClick?: (sourceRef: SourceReference) => void;  // Callback when source is clicked
}

// Props for the document viewer modal
export interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  sourceRef: SourceReference | null;
  dealDocuments: DealDocument[];  // List of documents for this deal
}

// Document info from the deal
export interface DealDocument {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  url?: string;
}

export interface ConfidenceIndicatorProps {
  confidence: ConfidenceLevel;
  calculated?: boolean;
  conflictDetails?: string;
  source?: string;
}

export interface PayerMixChartProps {
  medicaid: ExtractedField<number>;
  medicare: ExtractedField<number>;
  privatePay: ExtractedField<number>;
  title: string;
}

export interface RatesTableProps {
  rates: ExtractedField<RateItem[]>;
  type: 'private_pay' | 'medicaid';
}

export interface ProFormaTableProps {
  projections: {
    year_1: ProFormaYear;
    year_2: ProFormaYear;
    year_3: ProFormaYear;
  };
  showComparison?: boolean;
}

export interface SectionConfig {
  id: string;
  title: string;
  headerColor: string;
}
