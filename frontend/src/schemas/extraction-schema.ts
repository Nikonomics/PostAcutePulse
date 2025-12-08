/**
 * CANONICAL EXTRACTION SCHEMA (TypeScript)
 * =========================================
 *
 * This file defines the single source of truth for all extraction data field names,
 * structures, and transformations for the frontend.
 *
 * This must stay in sync with the backend version at:
 * backend/schemas/extraction-schema.js
 *
 * NAMING CONVENTIONS:
 * - Percentages: Use `_pct` suffix (e.g., occupancy_pct, medicaid_pct)
 * - Counts: Use descriptive names (e.g., bed_count, average_daily_census)
 * - Currency: No suffix, use descriptive names (e.g., annual_revenue, total_labor_cost)
 * - Booleans: Use `is_` or `has_` prefix
 *
 * STRUCTURE:
 * - Storage: Flat structure with _confidenceMap and _sourceMap
 * - API Response: Flat structure (same as storage)
 * - Frontend Display: Nested ExtractedField<T> structure via unflattenExtractedData()
 *
 * @version 2.0.0
 * @lastUpdated 2024-12-07
 */

// =============================================================================
// CONFIDENCE LEVELS
// =============================================================================

export const CONFIDENCE_LEVELS = {
  HIGH: 'high',           // Value explicitly stated in document
  MEDIUM: 'medium',       // Calculated from explicit data or strongly inferred
  LOW: 'low',             // Inferred from indirect evidence
  NOT_FOUND: 'not_found', // No data found in documents
  CONFLICT: 'conflict'    // Multiple conflicting values found
} as const;

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[keyof typeof CONFIDENCE_LEVELS];

// =============================================================================
// EXTRACTED FIELD WRAPPER
// =============================================================================

export interface SourceReference {
  document: string;
  location?: string;
  snippet?: string;
  isCalculated?: boolean;
}

export interface ExtractedField<T> {
  value: T | null;
  raw_value?: string;
  confidence: ConfidenceLevel;
  source?: string;
  source_ref?: SourceReference;
  calculated?: boolean;
  conflict_details?: string;
}

// =============================================================================
// KEY OBSERVATIONS (structured AI insights)
// =============================================================================

export interface KeyObservations {
  deal_strengths: string[];
  deal_risks: string[];
  missing_data: string[];
  calculation_notes: string[];
}

// =============================================================================
// MONTHLY TREND POINT SCHEMA
// =============================================================================

/**
 * Schema for monthly census/financial trend data points.
 * Used in time-series arrays for charts and analysis.
 *
 * CANONICAL FIELD NAMES (use these everywhere):
 * - month: "YYYY-MM" format
 * - occupancy_pct: NOT occupancy_percentage
 * - medicaid_pct: NOT medicaid_percentage
 * - medicare_pct: NOT medicare_percentage
 * - private_pay_pct: NOT private_pay_percentage
 */
export interface MonthlyTrendPoint {
  // Required
  month: string;  // Format: "YYYY-MM"

  // Census metrics
  total_beds?: number;
  average_daily_census?: number;
  occupancy_pct?: number;  // CANONICAL: Use _pct, NOT _percentage

  // Payer mix by census days (percentages)
  medicaid_pct?: number;   // CANONICAL: Use _pct, NOT _percentage
  medicare_pct?: number;   // CANONICAL: Use _pct, NOT _percentage
  private_pay_pct?: number; // CANONICAL: Use _pct, NOT _percentage
  other_pct?: number;

  // Payer days (absolute numbers)
  medicaid_days?: number;
  medicare_days?: number;
  private_pay_days?: number;
  total_patient_days?: number;

  // Financial metrics (monthly)
  total_revenue?: number;
  total_expenses?: number;
  ebitda?: number;
  ebitdar?: number;
}

// =============================================================================
// FLAT STORAGE SCHEMA (what comes from API)
// =============================================================================

/**
 * This is the canonical flat schema matching the database storage.
 * The API returns data in this format before transformation.
 */
export interface FlatExtractionData {
  // Metadata
  document_types_identified?: string[];
  extraction_timestamp?: string;

  // Facility Information
  facility_name?: string | null;
  facility_type?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  bed_count?: number | null;
  unit_mix?: Record<string, number> | null;

  // Deal Information
  deal_name?: string | null;
  deal_type?: string | null;
  deal_source?: string | null;
  priority_level?: string | null;
  purchase_price?: number | null;
  price_per_bed?: number | null;

  // Contact Information
  primary_contact_name?: string | null;
  contact_title?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;

  // Financial Period
  financial_period_start?: string | null;
  financial_period_end?: string | null;

  // T12 Revenue
  annual_revenue?: number | null;
  medicaid_revenue?: number | null;
  medicare_revenue?: number | null;
  private_pay_revenue?: number | null;
  other_revenue?: number | null;
  room_and_board_revenue?: number | null;
  care_level_revenue?: number | null;
  ancillary_revenue?: number | null;
  other_income?: number | null;

  // T12 Expenses
  total_expenses?: number | null;
  operating_expenses?: number | null;
  total_direct_care?: number | null;
  total_activities?: number | null;
  total_culinary?: number | null;
  total_housekeeping?: number | null;
  total_maintenance?: number | null;
  total_administration?: number | null;
  total_general?: number | null;
  total_property?: number | null;
  total_labor_cost?: number | null;
  agency_labor_cost?: number | null;
  raw_food_cost?: number | null;
  management_fees?: number | null;
  utilities_total?: number | null;
  property_taxes?: number | null;
  property_insurance?: number | null;
  rent_lease_expense?: number | null;
  depreciation?: number | null;
  amortization?: number | null;
  interest_expense?: number | null;

  // Expense Ratios
  labor_pct_of_revenue?: number | null;
  agency_pct_of_labor?: number | null;
  food_cost_per_resident_day?: number | null;
  management_fee_pct?: number | null;
  bad_debt_pct?: number | null;
  utilities_pct_of_revenue?: number | null;
  insurance_pct_of_revenue?: number | null;

  // T12 Earnings
  ebitdar?: number | null;
  ebitda?: number | null;
  ebit?: number | null;
  net_income?: number | null;

  // Census & Occupancy
  average_daily_census?: number | null;
  occupancy_pct?: number | null;  // CANONICAL
  medicaid_pct?: number | null;   // CANONICAL
  medicare_pct?: number | null;   // CANONICAL
  private_pay_pct?: number | null; // CANONICAL

  // Monthly Trends
  monthly_trends?: MonthlyTrendPoint[];

  // Rate Information
  private_pay_rates?: Array<{ unit_type?: string; care_level?: string; monthly_rate: number }>;
  medicaid_rates?: Array<{ care_level?: string; daily_rate: number }>;
  average_daily_rate?: number | null;

  // Pro Forma Projections
  proforma_year1_revenue?: number | null;
  proforma_year1_ebitdar?: number | null;
  proforma_year1_ebitda?: number | null;
  proforma_year1_ebit?: number | null;
  proforma_year1_occupancy_pct?: number | null;
  proforma_year2_revenue?: number | null;
  proforma_year2_ebitdar?: number | null;
  proforma_year2_ebitda?: number | null;
  proforma_year2_ebit?: number | null;
  proforma_year2_occupancy_pct?: number | null;
  proforma_year3_revenue?: number | null;
  proforma_year3_ebitdar?: number | null;
  proforma_year3_ebitda?: number | null;
  proforma_year3_ebit?: number | null;
  proforma_year3_occupancy_pct?: number | null;

  // Deal Metrics
  revenue_multiple?: number | null;
  ebitda_multiple?: number | null;
  cap_rate_pct?: number | null;
  target_irr_pct?: number | null;
  hold_period_years?: number | null;

  // Observations & Notes
  data_quality_notes?: string[];
  // key_observations can be either legacy array format or new structured format
  key_observations?: string[] | KeyObservations;
  // User-added observations (separate from AI-generated)
  reviewer_notes?: string[];

  // Metadata Maps
  _confidenceMap?: Record<string, ConfidenceLevel>;
  _sourceMap?: Record<string, string>;
}

// =============================================================================
// NESTED DISPLAY SCHEMA (what components consume)
// =============================================================================

export interface ProFormaYear {
  revenue: ExtractedField<number>;
  ebitdar: ExtractedField<number>;
  ebitda: ExtractedField<number>;
  ebit: ExtractedField<number>;
  occupancy_pct: ExtractedField<number>;
}

export interface RateItem {
  unit_type?: string;
  care_level?: string;
  monthly_rate: number;
  daily_rate?: number;
}

/**
 * Nested display structure that components consume.
 * Created by unflattenExtractedData() from FlatExtractionData.
 */
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
    revenue_by_payer: {
      medicaid_revenue: ExtractedField<number>;
      medicare_revenue: ExtractedField<number>;
      private_pay_revenue: ExtractedField<number>;
      other_revenue: ExtractedField<number>;
    };
    revenue_breakdown: {
      room_and_board: ExtractedField<number>;
      care_level_revenue: ExtractedField<number>;
      ancillary_revenue: ExtractedField<number>;
      other_income: ExtractedField<number>;
    };
    // Expense breakdown by department
    expense_breakdown?: {
      total_direct_care: ExtractedField<number>;
      total_activities: ExtractedField<number>;
      total_culinary: ExtractedField<number>;
      total_housekeeping: ExtractedField<number>;
      total_maintenance: ExtractedField<number>;
      total_administration: ExtractedField<number>;
      total_general: ExtractedField<number>;
      total_property: ExtractedField<number>;
    };
    // Expense ratios
    expense_ratios?: {
      labor_pct_of_revenue: ExtractedField<number>;
      agency_pct_of_labor: ExtractedField<number>;
      food_cost_per_resident_day: ExtractedField<number>;
      management_fee_pct: ExtractedField<number>;
      bad_debt_pct: ExtractedField<number>;
      utilities_pct_of_revenue: ExtractedField<number>;
      insurance_pct_of_revenue: ExtractedField<number>;
    };
    total_expenses: ExtractedField<number>;
    operating_expenses: ExtractedField<number>;
    total_labor_cost: ExtractedField<number>;
    agency_labor_cost: ExtractedField<number>;
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
    occupancy_pct: ExtractedField<number>;  // CANONICAL: Use occupancy_pct
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
  // key_observations can be legacy array or new structured format
  key_observations: string[] | KeyObservations;
  // User-added observations
  reviewer_notes?: string[];
}

// =============================================================================
// FIELD NAME MAPPINGS (for migration and compatibility)
// =============================================================================

/**
 * Maps legacy field names to canonical field names.
 * Use this when transforming old data to new format.
 */
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  // Bed count variations
  'no_of_beds': 'bed_count',
  'number_of_beds': 'bed_count',
  'total_beds': 'bed_count',

  // Occupancy variations
  'current_occupancy': 'occupancy_pct',
  'occupancy_percentage': 'occupancy_pct',
  'occupancy_rate': 'occupancy_pct',
  't12m_occupancy': 'occupancy_pct',

  // Payer mix variations (CRITICAL - these cause the chart bug)
  'medicaid_percentage': 'medicaid_pct',
  'medicare_percentage': 'medicare_pct',
  'private_pay_percentage': 'private_pay_pct',

  // Revenue variations
  't12m_revenue': 'annual_revenue',
  'total_revenue': 'annual_revenue',

  // EBITDA variations
  't12m_ebitda': 'ebitda',
  't12m_ebitdar': 'ebitdar',

  // Contact variations
  'phone_number': 'contact_phone',
  'email': 'contact_email',
  'title': 'contact_title',

  // Pro forma variations
  'proforma_year1_annual_revenue': 'proforma_year1_revenue',
  'proforma_year1_annual_ebitdar': 'proforma_year1_ebitdar',
  'proforma_year1_annual_ebitda': 'proforma_year1_ebitda',
  'proforma_year1_annual_ebit': 'proforma_year1_ebit',
  'proforma_year1_average_occupancy': 'proforma_year1_occupancy_pct',
  'proforma_year2_annual_revenue': 'proforma_year2_revenue',
  'proforma_year2_annual_ebitdar': 'proforma_year2_ebitdar',
  'proforma_year2_annual_ebitda': 'proforma_year2_ebitda',
  'proforma_year2_annual_ebit': 'proforma_year2_ebit',
  'proforma_year2_average_occupancy': 'proforma_year2_occupancy_pct',
  'proforma_year3_annual_revenue': 'proforma_year3_revenue',
  'proforma_year3_annual_ebitdar': 'proforma_year3_ebitdar',
  'proforma_year3_annual_ebitda': 'proforma_year3_ebitda',
  'proforma_year3_annual_ebit': 'proforma_year3_ebit',
  'proforma_year3_average_occupancy': 'proforma_year3_occupancy_pct',

  // Deal metrics variations
  'projected_cap_rate_percentage': 'cap_rate_pct',
  'target_irr_percentage': 'target_irr_pct',
  'target_hold_period': 'hold_period_years'
};

/**
 * Maps fields in monthly trend arrays (legacy -> canonical).
 * This is specifically for the occupancy chart bug.
 */
export const MONTHLY_TREND_FIELD_MAPPINGS: Record<string, string> = {
  'occupancy_percentage': 'occupancy_pct',
  'medicaid_percentage': 'medicaid_pct',
  'medicare_percentage': 'medicare_pct',
  'private_pay_percentage': 'private_pay_pct'
};

// =============================================================================
// TRANSFORMATION UTILITIES
// =============================================================================

/**
 * Normalizes a flat extraction data object to use canonical field names.
 * @param data - Raw extraction data with potentially legacy field names
 * @returns Normalized data with canonical field names
 */
export function normalizeToCanonical<T extends Record<string, unknown>>(data: T | null): T | null {
  if (!data) return null;

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip metadata fields
    if (key.startsWith('_')) {
      normalized[key] = value;
      continue;
    }

    // Map legacy field name to canonical, or keep as-is
    const canonicalKey = LEGACY_TO_CANONICAL[key] || key;

    // Handle monthly_trends array specially
    if (canonicalKey === 'monthly_trends' && Array.isArray(value)) {
      normalized[canonicalKey] = normalizeMonthlyTrends(value as MonthlyTrendPoint[]);
    } else {
      normalized[canonicalKey] = value;
    }
  }

  // Also normalize the confidence and source maps
  if (normalized._confidenceMap) {
    normalized._confidenceMap = normalizeMapKeys(normalized._confidenceMap as Record<string, unknown>);
  }
  if (normalized._sourceMap) {
    normalized._sourceMap = normalizeMapKeys(normalized._sourceMap as Record<string, unknown>);
  }

  return normalized as T;
}

/**
 * Normalizes monthly trend array items to use canonical field names.
 * @param trends - Array of monthly trend objects
 * @returns Normalized array with canonical field names
 */
export function normalizeMonthlyTrends(trends: MonthlyTrendPoint[]): MonthlyTrendPoint[] {
  if (!Array.isArray(trends)) return trends;

  return trends.map(item => {
    // Create a mutable copy to work with
    const normalized = { ...item } as Record<string, unknown>;

    for (const [legacyKey, canonicalKey] of Object.entries(MONTHLY_TREND_FIELD_MAPPINGS)) {
      if (legacyKey in normalized && !(canonicalKey in normalized)) {
        normalized[canonicalKey] = normalized[legacyKey];
        delete normalized[legacyKey];
      }
    }

    // Type assertion is safe here because we only renamed fields, not changed types
    return normalized as unknown as MonthlyTrendPoint;
  });
}

/**
 * Normalizes map keys (for _confidenceMap and _sourceMap).
 * @param map - Map with potentially legacy keys
 * @returns Map with canonical keys
 */
export function normalizeMapKeys<T>(map: Record<string, T> | null): Record<string, T> | null {
  if (!map || typeof map !== 'object') return map;

  const normalized: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    const canonicalKey = LEGACY_TO_CANONICAL[key] || key;
    normalized[canonicalKey] = value;
  }
  return normalized;
}

/**
 * Creates an ExtractedField wrapper for a value.
 * @param value - The value to wrap
 * @param confidence - Confidence level (defaults to 'not_found' if null)
 * @param source - Optional source citation
 */
export function createExtractedField<T>(
  value: T | null,
  confidence: ConfidenceLevel = value !== null && value !== undefined ? 'medium' : 'not_found',
  source?: string
): ExtractedField<T> {
  return {
    value,
    confidence,
    source
  };
}

/**
 * Validates extraction data and returns any schema violations.
 * @param data - Extraction data to validate
 * @returns Object with valid boolean and errors array
 */
export function validateExtractionData(data: FlatExtractionData | null): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data) {
    return { valid: false, errors: ['Data is null or undefined'] };
  }

  // Check for required metadata
  if (!data.extraction_timestamp) {
    errors.push('Missing extraction_timestamp');
  }

  // Check monthly_trends format if present
  if (data.monthly_trends && Array.isArray(data.monthly_trends)) {
    data.monthly_trends.forEach((item, index) => {
      if (!item.month) {
        errors.push(`monthly_trends[${index}]: Missing required 'month' field`);
      }
      // Check for legacy field names that should be canonical
      if ('occupancy_percentage' in item) {
        errors.push(`monthly_trends[${index}]: Uses legacy 'occupancy_percentage', should use 'occupancy_pct'`);
      }
      if ('medicaid_percentage' in item) {
        errors.push(`monthly_trends[${index}]: Uses legacy 'medicaid_percentage', should use 'medicaid_pct'`);
      }
    });
  }

  // Check for legacy top-level field names
  const dataRecord = data as Record<string, unknown>;
  for (const legacyKey of Object.keys(LEGACY_TO_CANONICAL)) {
    if (legacyKey in dataRecord && !(LEGACY_TO_CANONICAL[legacyKey] in dataRecord)) {
      errors.push(`Uses legacy field '${legacyKey}', should use '${LEGACY_TO_CANONICAL[legacyKey]}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// EXPORTS (all types and functions are already exported inline)
// =============================================================================
