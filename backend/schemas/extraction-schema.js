/**
 * CANONICAL EXTRACTION SCHEMA
 * ============================
 *
 * This file defines the single source of truth for all extraction data field names,
 * structures, and transformations. All backend services and frontend components
 * MUST conform to this schema.
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

const CONFIDENCE_LEVELS = {
  HIGH: 'high',           // Value explicitly stated in document
  MEDIUM: 'medium',       // Calculated from explicit data or strongly inferred
  LOW: 'low',             // Inferred from indirect evidence
  NOT_FOUND: 'not_found', // No data found in documents
  CONFLICT: 'conflict'    // Multiple conflicting values found
};

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
const MONTHLY_TREND_SCHEMA = {
  // Required fields
  month: { type: 'string', format: 'YYYY-MM', required: true },

  // Census metrics
  total_beds: { type: 'number', nullable: true },
  average_daily_census: { type: 'number', nullable: true },
  occupancy_pct: { type: 'number', nullable: true, unit: 'percent' },

  // Payer mix by census days
  medicaid_pct: { type: 'number', nullable: true, unit: 'percent' },
  medicare_pct: { type: 'number', nullable: true, unit: 'percent' },
  private_pay_pct: { type: 'number', nullable: true, unit: 'percent' },
  other_pct: { type: 'number', nullable: true, unit: 'percent' },

  // Payer days (absolute numbers)
  medicaid_days: { type: 'number', nullable: true },
  medicare_days: { type: 'number', nullable: true },
  private_pay_days: { type: 'number', nullable: true },
  total_patient_days: { type: 'number', nullable: true },

  // Financial metrics (monthly)
  total_revenue: { type: 'number', nullable: true, unit: 'currency' },
  total_expenses: { type: 'number', nullable: true, unit: 'currency' },
  ebitda: { type: 'number', nullable: true, unit: 'currency' },
  ebitdar: { type: 'number', nullable: true, unit: 'currency' }
};

// =============================================================================
// FLAT STORAGE SCHEMA (extraction_data in database)
// =============================================================================

/**
 * This is the canonical flat schema for storage.
 * All backend services should produce data in this format.
 */
const FLAT_STORAGE_SCHEMA = {
  // -------------------------------------------------------------------------
  // METADATA
  // -------------------------------------------------------------------------
  document_types_identified: { type: 'array', items: 'string' },
  extraction_timestamp: { type: 'string', format: 'ISO8601' },

  // -------------------------------------------------------------------------
  // FACILITY INFORMATION
  // -------------------------------------------------------------------------
  facility_name: { type: 'string', nullable: true },
  facility_type: { type: 'string', nullable: true }, // 'SNF', 'ALF', 'Memory Care', etc.
  street_address: { type: 'string', nullable: true },
  city: { type: 'string', nullable: true },
  state: { type: 'string', nullable: true },
  zip_code: { type: 'string', nullable: true },
  bed_count: { type: 'number', nullable: true }, // CANONICAL: bed_count (not no_of_beds)
  unit_mix: { type: 'object', nullable: true }, // { "Private": 50, "Semi-Private": 30 }

  // -------------------------------------------------------------------------
  // DEAL INFORMATION
  // -------------------------------------------------------------------------
  deal_name: { type: 'string', nullable: true },
  deal_type: { type: 'string', nullable: true },
  deal_source: { type: 'string', nullable: true },
  priority_level: { type: 'string', nullable: true },
  purchase_price: { type: 'number', nullable: true, unit: 'currency' },
  price_per_bed: { type: 'number', nullable: true, unit: 'currency' },

  // -------------------------------------------------------------------------
  // CONTACT INFORMATION
  // -------------------------------------------------------------------------
  primary_contact_name: { type: 'string', nullable: true },
  contact_title: { type: 'string', nullable: true },
  contact_phone: { type: 'string', nullable: true },
  contact_email: { type: 'string', nullable: true },

  // -------------------------------------------------------------------------
  // FINANCIAL PERIOD
  // -------------------------------------------------------------------------
  financial_period_start: { type: 'string', format: 'YYYY-MM-DD', nullable: true },
  financial_period_end: { type: 'string', format: 'YYYY-MM-DD', nullable: true },

  // -------------------------------------------------------------------------
  // T12 REVENUE (Trailing 12 Months)
  // -------------------------------------------------------------------------
  annual_revenue: { type: 'number', nullable: true, unit: 'currency' },

  // Revenue by payer source
  medicaid_revenue: { type: 'number', nullable: true, unit: 'currency' },
  medicare_revenue: { type: 'number', nullable: true, unit: 'currency' },
  private_pay_revenue: { type: 'number', nullable: true, unit: 'currency' },
  other_revenue: { type: 'number', nullable: true, unit: 'currency' },

  // Revenue by type
  room_and_board_revenue: { type: 'number', nullable: true, unit: 'currency' },
  care_level_revenue: { type: 'number', nullable: true, unit: 'currency' },
  ancillary_revenue: { type: 'number', nullable: true, unit: 'currency' },
  other_income: { type: 'number', nullable: true, unit: 'currency' },

  // -------------------------------------------------------------------------
  // T12 EXPENSES
  // -------------------------------------------------------------------------
  total_expenses: { type: 'number', nullable: true, unit: 'currency' },
  operating_expenses: { type: 'number', nullable: true, unit: 'currency' },

  // Department expense totals
  total_direct_care: { type: 'number', nullable: true, unit: 'currency' },
  total_activities: { type: 'number', nullable: true, unit: 'currency' },
  total_culinary: { type: 'number', nullable: true, unit: 'currency' },
  total_housekeeping: { type: 'number', nullable: true, unit: 'currency' },
  total_maintenance: { type: 'number', nullable: true, unit: 'currency' },
  total_administration: { type: 'number', nullable: true, unit: 'currency' },
  total_general: { type: 'number', nullable: true, unit: 'currency' },
  total_property: { type: 'number', nullable: true, unit: 'currency' },

  // Labor costs
  total_labor_cost: { type: 'number', nullable: true, unit: 'currency' },
  agency_labor_cost: { type: 'number', nullable: true, unit: 'currency' },

  // Other expenses
  raw_food_cost: { type: 'number', nullable: true, unit: 'currency' },
  management_fees: { type: 'number', nullable: true, unit: 'currency' },
  utilities_total: { type: 'number', nullable: true, unit: 'currency' },
  property_taxes: { type: 'number', nullable: true, unit: 'currency' },
  property_insurance: { type: 'number', nullable: true, unit: 'currency' },
  rent_lease_expense: { type: 'number', nullable: true, unit: 'currency' },
  depreciation: { type: 'number', nullable: true, unit: 'currency' },
  amortization: { type: 'number', nullable: true, unit: 'currency' },
  interest_expense: { type: 'number', nullable: true, unit: 'currency' },

  // -------------------------------------------------------------------------
  // EXPENSE RATIOS (percentages)
  // -------------------------------------------------------------------------
  labor_pct_of_revenue: { type: 'number', nullable: true, unit: 'percent' },
  agency_pct_of_labor: { type: 'number', nullable: true, unit: 'percent' },
  food_cost_per_resident_day: { type: 'number', nullable: true, unit: 'currency' },
  management_fee_pct: { type: 'number', nullable: true, unit: 'percent' },
  bad_debt_pct: { type: 'number', nullable: true, unit: 'percent' },
  utilities_pct_of_revenue: { type: 'number', nullable: true, unit: 'percent' },
  insurance_pct_of_revenue: { type: 'number', nullable: true, unit: 'percent' },

  // -------------------------------------------------------------------------
  // T12 EARNINGS
  // -------------------------------------------------------------------------
  ebitdar: { type: 'number', nullable: true, unit: 'currency' },
  ebitda: { type: 'number', nullable: true, unit: 'currency' },
  ebit: { type: 'number', nullable: true, unit: 'currency' },
  net_income: { type: 'number', nullable: true, unit: 'currency' },

  // -------------------------------------------------------------------------
  // CENSUS & OCCUPANCY (Current/Average)
  // -------------------------------------------------------------------------
  average_daily_census: { type: 'number', nullable: true },
  occupancy_pct: { type: 'number', nullable: true, unit: 'percent' }, // CANONICAL: occupancy_pct

  // Payer mix percentages (current/average)
  medicaid_pct: { type: 'number', nullable: true, unit: 'percent' }, // CANONICAL: medicaid_pct
  medicare_pct: { type: 'number', nullable: true, unit: 'percent' }, // CANONICAL: medicare_pct
  private_pay_pct: { type: 'number', nullable: true, unit: 'percent' }, // CANONICAL: private_pay_pct

  // -------------------------------------------------------------------------
  // MONTHLY TRENDS (Time-series array)
  // -------------------------------------------------------------------------
  monthly_trends: {
    type: 'array',
    items: MONTHLY_TREND_SCHEMA,
    description: 'Array of monthly data points following MONTHLY_TREND_SCHEMA'
  },

  // -------------------------------------------------------------------------
  // RATE INFORMATION
  // -------------------------------------------------------------------------
  private_pay_rates: {
    type: 'array',
    items: { unit_type: 'string', care_level: 'string', monthly_rate: 'number' },
    nullable: true
  },
  medicaid_rates: {
    type: 'array',
    items: { care_level: 'string', daily_rate: 'number' },
    nullable: true
  },
  average_daily_rate: { type: 'number', nullable: true, unit: 'currency' },

  // -------------------------------------------------------------------------
  // PRO FORMA PROJECTIONS
  // -------------------------------------------------------------------------
  proforma_year1_revenue: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year1_ebitdar: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year1_ebitda: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year1_ebit: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year1_occupancy_pct: { type: 'number', nullable: true, unit: 'percent' },

  proforma_year2_revenue: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year2_ebitdar: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year2_ebitda: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year2_ebit: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year2_occupancy_pct: { type: 'number', nullable: true, unit: 'percent' },

  proforma_year3_revenue: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year3_ebitdar: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year3_ebitda: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year3_ebit: { type: 'number', nullable: true, unit: 'currency' },
  proforma_year3_occupancy_pct: { type: 'number', nullable: true, unit: 'percent' },

  // -------------------------------------------------------------------------
  // DEAL METRICS
  // -------------------------------------------------------------------------
  revenue_multiple: { type: 'number', nullable: true },
  ebitda_multiple: { type: 'number', nullable: true },
  cap_rate_pct: { type: 'number', nullable: true, unit: 'percent' },
  target_irr_pct: { type: 'number', nullable: true, unit: 'percent' },
  hold_period_years: { type: 'number', nullable: true },

  // -------------------------------------------------------------------------
  // OBSERVATIONS & NOTES
  // -------------------------------------------------------------------------
  data_quality_notes: { type: 'array', items: 'string' },
  // key_observations now uses structured format with categories
  key_observations: {
    type: 'object',
    properties: {
      deal_strengths: { type: 'array', items: 'string', description: 'Positive aspects that make the deal attractive' },
      deal_risks: { type: 'array', items: 'string', description: 'Concerns or red flags identified' },
      missing_data: { type: 'array', items: 'string', description: 'Important information not found in documents' },
      calculation_notes: { type: 'array', items: 'string', description: 'How key metrics were derived' }
    }
  },
  // User-added observations (separate from AI-generated)
  reviewer_notes: { type: 'array', items: 'string', description: 'Manual notes added by reviewers' },

  // -------------------------------------------------------------------------
  // METADATA MAPS (for frontend ExtractedField construction)
  // -------------------------------------------------------------------------
  _confidenceMap: {
    type: 'object',
    description: 'Maps field names to confidence levels'
  },
  _sourceMap: {
    type: 'object',
    description: 'Maps field names to source citations'
  }
};

// =============================================================================
// FIELD NAME MAPPINGS (for migration and compatibility)
// =============================================================================

/**
 * Maps legacy field names to canonical field names.
 * Use this when transforming old data to new format.
 */
const LEGACY_TO_CANONICAL = {
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
const MONTHLY_TREND_FIELD_MAPPINGS = {
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
 * @param {Object} data - Raw extraction data with potentially legacy field names
 * @returns {Object} - Normalized data with canonical field names
 */
function normalizeToCanonical(data) {
  if (!data) return null;

  const normalized = {};

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
      normalized[canonicalKey] = normalizeMonthlyTrends(value);
    } else {
      normalized[canonicalKey] = value;
    }
  }

  // Also normalize the confidence and source maps
  if (normalized._confidenceMap) {
    normalized._confidenceMap = normalizeMapKeys(normalized._confidenceMap);
  }
  if (normalized._sourceMap) {
    normalized._sourceMap = normalizeMapKeys(normalized._sourceMap);
  }

  return normalized;
}

/**
 * Normalizes monthly trend array items to use canonical field names.
 * @param {Array} trends - Array of monthly trend objects
 * @returns {Array} - Normalized array with canonical field names
 */
function normalizeMonthlyTrends(trends) {
  if (!Array.isArray(trends)) return trends;

  return trends.map(item => {
    const normalized = { ...item };

    for (const [legacyKey, canonicalKey] of Object.entries(MONTHLY_TREND_FIELD_MAPPINGS)) {
      if (legacyKey in normalized && !(canonicalKey in normalized)) {
        normalized[canonicalKey] = normalized[legacyKey];
        delete normalized[legacyKey];
      }
    }

    return normalized;
  });
}

/**
 * Normalizes map keys (for _confidenceMap and _sourceMap).
 * @param {Object} map - Map with potentially legacy keys
 * @returns {Object} - Map with canonical keys
 */
function normalizeMapKeys(map) {
  if (!map || typeof map !== 'object') return map;

  const normalized = {};
  for (const [key, value] of Object.entries(map)) {
    const canonicalKey = LEGACY_TO_CANONICAL[key] || key;
    normalized[canonicalKey] = value;
  }
  return normalized;
}

/**
 * Validates extraction data against the canonical schema.
 * @param {Object} data - Extraction data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateExtractionData(data) {
  const errors = [];

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
  for (const legacyKey of Object.keys(LEGACY_TO_CANONICAL)) {
    if (legacyKey in data && !(LEGACY_TO_CANONICAL[legacyKey] in data)) {
      errors.push(`Uses legacy field '${legacyKey}', should use '${LEGACY_TO_CANONICAL[legacyKey]}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  CONFIDENCE_LEVELS,

  // Schemas
  MONTHLY_TREND_SCHEMA,
  FLAT_STORAGE_SCHEMA,

  // Mappings
  LEGACY_TO_CANONICAL,
  MONTHLY_TREND_FIELD_MAPPINGS,

  // Utilities
  normalizeToCanonical,
  normalizeMonthlyTrends,
  normalizeMapKeys,
  validateExtractionData
};
