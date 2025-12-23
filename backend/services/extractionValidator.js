/**
 * Extraction Data Validator
 *
 * Validates that extraction_data is in the correct flat structure (not nested Gemini format)
 * and provides sanitization utilities.
 */

// Nested category keys that indicate INVALID Gemini raw output format
const NESTED_CATEGORY_KEYS = [
  'facility_information',
  'financial_information_t12',
  'census_and_occupancy',
  'rate_structure',
  'rate_information',
  'staffing_information',
  'contact_information',
  'deal_information',
  'deal_metrics',
  'pro_forma_projections',
  'ytd_performance'
];

// Valid V7 schema keys (these are allowed as top-level objects)
const VALID_V7_KEYS = [
  'facility_snapshot',
  'ttm_financials',
  'census_snapshot',
  'rate_snapshot',
  'turnaround',
  'operating_trends',
  'source_citations'
];

// US State abbreviation mapping
const STATE_ABBREVIATIONS = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

// Reverse mapping for validation
const VALID_STATE_CODES = new Set(Object.values(STATE_ABBREVIATIONS));

/**
 * Check if an object has the nested {value, confidence} structure
 * @param {any} obj - Object to check
 * @returns {boolean}
 */
function hasNestedValueConfidence(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return obj.hasOwnProperty('value') && obj.hasOwnProperty('confidence');
}

/**
 * Validate that extraction_data is in flat structure (not nested Gemini format)
 *
 * @param {Object} extractionData - The extraction_data to validate
 * @returns {Object} - { isValid: boolean, errors: string[], warnings: string[] }
 */
function validateFlatStructure(extractionData) {
  const errors = [];
  const warnings = [];

  if (!extractionData || typeof extractionData !== 'object') {
    return { isValid: false, errors: ['extraction_data is null or not an object'], warnings: [] };
  }

  // Check for nested category structures (INVALID)
  for (const key of NESTED_CATEGORY_KEYS) {
    if (extractionData.hasOwnProperty(key)) {
      const value = extractionData[key];
      // Check if it's actually a nested structure (object with sub-properties)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Check if any sub-properties have {value, confidence} format
        const subKeys = Object.keys(value);
        const hasNestedFormat = subKeys.some(subKey => hasNestedValueConfidence(value[subKey]));

        if (hasNestedFormat) {
          errors.push(`Found nested structure with {value, confidence} format: ${key}`);
        } else if (!VALID_V7_KEYS.includes(key)) {
          // Still a nested structure even without {value, confidence}
          errors.push(`Found nested category structure: ${key} (should be flattened)`);
        }
      }
    }
  }

  // Check for any top-level values that have {value, confidence} structure
  for (const [key, value] of Object.entries(extractionData)) {
    if (hasNestedValueConfidence(value)) {
      errors.push(`Field "${key}" has nested {value, confidence} format - should be flattened`);
    }
  }

  // Check for _confidenceMap and _sourceMap
  if (!extractionData._confidenceMap) {
    warnings.push('Missing _confidenceMap at root level');
  } else if (typeof extractionData._confidenceMap !== 'object') {
    errors.push('_confidenceMap exists but is not an object');
  }

  if (!extractionData._sourceMap) {
    warnings.push('Missing _sourceMap at root level');
  } else if (typeof extractionData._sourceMap !== 'object') {
    errors.push('_sourceMap exists but is not an object');
  }

  // Check that key facility fields exist at flat level
  const expectedFlatFields = ['facility_name', 'city', 'state'];
  for (const field of expectedFlatFields) {
    if (!extractionData.hasOwnProperty(field)) {
      warnings.push(`Expected flat field "${field}" not found at root level`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Normalize state to 2-letter uppercase code
 * @param {string} state - State name or code
 * @returns {string|null} - Normalized state code or original if can't normalize
 */
function normalizeState(state) {
  if (!state || typeof state !== 'string') {
    return state;
  }

  const trimmed = state.trim();
  const upper = trimmed.toUpperCase();

  // Already a valid 2-letter code
  if (trimmed.length === 2 && VALID_STATE_CODES.has(upper)) {
    return upper;
  }

  // Try to convert full name to code
  const lower = trimmed.toLowerCase();
  if (STATE_ABBREVIATIONS[lower]) {
    return STATE_ABBREVIATIONS[lower];
  }

  // Return original if we can't normalize
  return trimmed;
}

/**
 * Normalize confidence value to consistent format
 * @param {string|number} confidence - Confidence value
 * @returns {string} - Normalized confidence ('high', 'medium', 'low', or 'unknown')
 */
function normalizeConfidence(confidence) {
  if (confidence === null || confidence === undefined) {
    return 'unknown';
  }

  if (typeof confidence === 'number') {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  const lower = String(confidence).toLowerCase().trim();
  if (['high', 'medium', 'low'].includes(lower)) {
    return lower;
  }

  return 'unknown';
}

/**
 * Sanitize extraction_data by cleaning up common issues
 *
 * @param {Object} extractionData - The extraction_data to sanitize
 * @returns {Object} - Sanitized extraction_data
 */
function sanitizeExtractionData(extractionData) {
  if (!extractionData || typeof extractionData !== 'object') {
    return extractionData;
  }

  const sanitized = { ...extractionData };

  // Ensure _confidenceMap exists
  if (!sanitized._confidenceMap || typeof sanitized._confidenceMap !== 'object') {
    sanitized._confidenceMap = {};
  }

  // Ensure _sourceMap exists
  if (!sanitized._sourceMap || typeof sanitized._sourceMap !== 'object') {
    sanitized._sourceMap = {};
  }

  // Normalize confidence values
  for (const [key, value] of Object.entries(sanitized._confidenceMap)) {
    sanitized._confidenceMap[key] = normalizeConfidence(value);
  }

  // Trim string values and normalize state
  const stringFields = [
    'facility_name', 'street_address', 'city', 'state', 'zip_code',
    'primary_contact_name', 'contact_title', 'contact_phone', 'contact_email',
    'deal_name', 'facility_type'
  ];

  for (const field of stringFields) {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitized[field].trim();
    }
  }

  // Normalize state to 2-letter uppercase
  if (sanitized.state) {
    sanitized.state = normalizeState(sanitized.state);
  }

  // Normalize ZIP code (remove extra spaces, ensure string)
  if (sanitized.zip_code) {
    const zip = String(sanitized.zip_code).trim();
    // Handle ZIP+4 format
    sanitized.zip_code = zip.replace(/\s+/g, '');
  }

  return sanitized;
}

/**
 * Quick validation check for use in syncFacilityData and other sync points
 * Returns true if data appears to be in valid flat format
 *
 * @param {Object} extractionData - The extraction_data to check
 * @returns {boolean}
 */
function isValidFlatFormat(extractionData) {
  if (!extractionData || typeof extractionData !== 'object') {
    return false;
  }

  // Quick check: if any nested category keys exist with sub-objects, it's invalid
  for (const key of NESTED_CATEGORY_KEYS) {
    if (extractionData[key] && typeof extractionData[key] === 'object' && !Array.isArray(extractionData[key])) {
      // Check for nested value/confidence pattern
      const subValues = Object.values(extractionData[key]);
      if (subValues.some(v => v && typeof v === 'object' && v.hasOwnProperty('value'))) {
        return false;
      }
    }
  }

  return true;
}

// ============================================
// DATA QUALITY VALIDATION
// ============================================

/**
 * Data Quality Validator
 *
 * Validates extracted data for errors and inconsistencies BEFORE saving to database.
 * Returns errors (blocking) and warnings (non-blocking but noteworthy).
 */
class ExtractionDataValidator {
  /**
   * Validate extracted data for quality and consistency
   * @param {Object} extractedData - The reconciled extraction data
   * @param {Object} options - Validation options
   * @param {boolean} options.isPortfolio - Whether this is a portfolio deal
   * @param {string} options.facilityName - Facility name for context in messages
   * @returns {Object} Validation result with errors, warnings, and summary
   */
  static validate(extractedData, options = {}) {
    const errors = [];   // Blocking issues - data should not be saved
    const warnings = []; // Non-blocking but noteworthy - flag for review

    if (!extractedData) {
      return {
        valid: false,
        errors: [{ field: 'extractedData', message: 'No extraction data provided' }],
        warnings: [],
        summary: '1 error, 0 warnings'
      };
    }

    const facilityContext = options.facilityName ? ` (${options.facilityName})` : '';

    // ============================================
    // REQUIRED FIELDS
    // ============================================

    if (!extractedData.facility_name && !extractedData.deal_name) {
      errors.push({
        field: 'facility_name',
        message: `Facility name or deal name is required${facilityContext}`
      });
    }

    if (!extractedData.state) {
      errors.push({
        field: 'state',
        message: `State is required${facilityContext}`
      });
    }

    // ============================================
    // BED COUNT SANITY
    // ============================================

    const bedCount = extractedData.bed_count || extractedData.total_beds;
    if (bedCount !== undefined && bedCount !== null) {
      if (bedCount < 1) {
        errors.push({
          field: 'bed_count',
          message: `Bed count (${bedCount}) must be at least 1${facilityContext}`
        });
      }
      if (bedCount > 2000) {
        errors.push({
          field: 'bed_count',
          message: `Bed count (${bedCount}) exceeds maximum of 2000${facilityContext}`
        });
      }
    }

    // ============================================
    // PERCENTAGE FIELD RANGE CHECKS (0-100)
    // ============================================

    const percentageFields = [
      { key: 'occupancy_percentage', label: 'Occupancy' },
      { key: 'occupancy', label: 'Occupancy' },
      { key: 'medicare_pct', label: 'Medicare %' },
      { key: 'medicare_percentage', label: 'Medicare %' },
      { key: 'medicaid_pct', label: 'Medicaid %' },
      { key: 'medicaid_percentage', label: 'Medicaid %' },
      { key: 'private_pay_pct', label: 'Private Pay %' },
      { key: 'private_pay_percentage', label: 'Private Pay %' },
      { key: 'ebitda_margin', label: 'EBITDA Margin' },
      { key: 'ebitdar_margin', label: 'EBITDAR Margin' },
      { key: 'labor_pct_of_revenue', label: 'Labor % of Revenue' },
      { key: 'agency_pct_of_labor', label: 'Agency % of Labor' },
      { key: 'food_pct_of_revenue', label: 'Food % of Revenue' },
      { key: 'management_fee_pct', label: 'Management Fee %' },
      { key: 'bad_debt_pct', label: 'Bad Debt %' },
      { key: 'utilities_pct_of_revenue', label: 'Utilities % of Revenue' },
      { key: 'insurance_pct_of_revenue', label: 'Insurance % of Revenue' }
    ];

    for (const field of percentageFields) {
      const value = extractedData[field.key];
      if (value !== undefined && value !== null) {
        if (value < 0) {
          errors.push({
            field: field.key,
            message: `${field.label} (${value}%) cannot be negative${facilityContext}`
          });
        }
        // Occupancy can exceed 100% (swing beds, overflow, different counting methods)
        // Other percentages exceeding 100% are just warnings
        if (value > 100) {
          warnings.push({
            field: field.key,
            message: `${field.label} (${value}%) exceeds 100% - verify this is correct${facilityContext}`
          });
        }
      }
    }

    // ============================================
    // FINANCIAL SANITY CHECKS
    // ============================================

    const totalRevenue = extractedData.total_revenue || extractedData.ttm_revenue || extractedData.annual_revenue;
    const totalExpenses = extractedData.total_expenses || extractedData.ttm_expenses;
    const ebitda = extractedData.ebitda || extractedData.ttm_ebitda;
    const ebitdar = extractedData.ebitdar || extractedData.ttm_ebitdar;
    const ebit = extractedData.ebit || extractedData.ttm_ebit;
    const netIncome = extractedData.net_income || extractedData.ttm_net_income;

    // Negative revenue is unusual - warn
    if (totalRevenue !== undefined && totalRevenue < 0) {
      warnings.push({
        field: 'total_revenue',
        message: `Revenue is negative ($${totalRevenue.toLocaleString()}) - verify this is correct${facilityContext}`
      });
    }

    // EBITDA exceeding revenue is impossible
    if (ebitda !== undefined && totalRevenue !== undefined && ebitda > totalRevenue && totalRevenue > 0) {
      warnings.push({
        field: 'ebitda',
        message: `EBITDA ($${ebitda.toLocaleString()}) exceeds total revenue ($${totalRevenue.toLocaleString()}) - verify calculations${facilityContext}`
      });
    }

    // Net income exceeding EBITDA is unusual
    if (netIncome !== undefined && ebitda !== undefined && netIncome > ebitda) {
      warnings.push({
        field: 'net_income',
        message: `Net income ($${netIncome.toLocaleString()}) exceeds EBITDA ($${ebitda.toLocaleString()}) - this is unusual, verify calculations${facilityContext}`
      });
    }

    // EBITDA hierarchy check: EBITDAR >= EBITDA >= EBIT >= Net Income
    if (ebitdar !== undefined && ebitda !== undefined && ebitdar < ebitda) {
      warnings.push({
        field: 'ebitdar',
        message: `EBITDAR ($${ebitdar.toLocaleString()}) is less than EBITDA ($${ebitda.toLocaleString()}) - verify rent expense${facilityContext}`
      });
    }

    if (ebitda !== undefined && ebit !== undefined && ebitda < ebit) {
      warnings.push({
        field: 'ebitda',
        message: `EBITDA ($${ebitda.toLocaleString()}) is less than EBIT ($${ebit.toLocaleString()}) - verify D&A${facilityContext}`
      });
    }

    if (ebit !== undefined && netIncome !== undefined && ebit < netIncome) {
      warnings.push({
        field: 'ebit',
        message: `EBIT ($${ebit.toLocaleString()}) is less than Net Income ($${netIncome.toLocaleString()}) - verify interest/taxes${facilityContext}`
      });
    }

    // ============================================
    // REVENUE PER BED SANITY CHECK
    // ============================================

    if (totalRevenue > 0 && bedCount > 0) {
      const revenuePerBed = totalRevenue / bedCount;
      const minRevenuePerBed = 30000;  // $30K minimum
      const maxRevenuePerBed = 150000; // $150K maximum

      if (revenuePerBed < minRevenuePerBed) {
        warnings.push({
          field: 'revenue_per_bed',
          message: `Revenue per bed ($${Math.round(revenuePerBed).toLocaleString()}) is below typical range ($30K-$150K) - verify revenue or bed count${facilityContext}`
        });
      }

      if (revenuePerBed > maxRevenuePerBed) {
        warnings.push({
          field: 'revenue_per_bed',
          message: `Revenue per bed ($${Math.round(revenuePerBed).toLocaleString()}) is above typical range ($30K-$150K) - verify revenue or bed count${facilityContext}`
        });
      }
    }

    // ============================================
    // LABOR % SANITY CHECK
    // ============================================

    const laborPct = extractedData.labor_pct_of_revenue;
    if (laborPct !== undefined && laborPct !== null) {
      if (laborPct < 40) {
        warnings.push({
          field: 'labor_pct_of_revenue',
          message: `Labor % (${laborPct.toFixed(1)}%) is below typical range (40-75%) - verify labor costs${facilityContext}`
        });
      }
      if (laborPct > 75) {
        warnings.push({
          field: 'labor_pct_of_revenue',
          message: `Labor % (${laborPct.toFixed(1)}%) is above typical range (40-75%) - may indicate staffing issues${facilityContext}`
        });
      }
    }

    // ============================================
    // CROSS-FIELD CONSISTENCY CHECKS
    // ============================================

    // Payer mix should sum to ~100%
    const medicaidPct = extractedData.medicaid_pct || extractedData.medicaid_percentage || 0;
    const medicarePct = extractedData.medicare_pct || extractedData.medicare_percentage || 0;
    const privatePayPct = extractedData.private_pay_pct || extractedData.private_pay_percentage || 0;
    const otherPayerPct = extractedData.other_payer_pct || extractedData.other_percentage || 0;

    const payerSum = medicaidPct + medicarePct + privatePayPct + otherPayerPct;

    // Only check if at least one payer type has data
    if (payerSum > 0 && Math.abs(payerSum - 100) > 5) {
      warnings.push({
        field: 'payer_mix',
        message: `Payer mix sums to ${payerSum.toFixed(1)}%, expected ~100%${facilityContext}`
      });
    }

    // Occupancy consistency check: ADC/Beds should match stated occupancy
    const adc = extractedData.average_daily_census;
    const statedOccupancy = extractedData.occupancy_percentage || extractedData.occupancy;

    if (bedCount > 0 && adc > 0) {
      const impliedOccupancy = (adc / bedCount) * 100;

      if (statedOccupancy && Math.abs(impliedOccupancy - statedOccupancy) > 5) {
        warnings.push({
          field: 'occupancy_percentage',
          message: `Stated occupancy (${statedOccupancy.toFixed(1)}%) doesn't match ADC/Beds calculation (${impliedOccupancy.toFixed(1)}%)${facilityContext}`
        });
      }
    }

    // ADC exceeding bed count is unusual but possible (swing beds, overflow, counting methods)
    if (adc > 0 && bedCount > 0 && adc > bedCount) {
      warnings.push({
        field: 'average_daily_census',
        message: `Average daily census (${adc}) exceeds bed count (${bedCount}) - verify this is correct${facilityContext}`
      });
    }

    // ============================================
    // EXPENSE CONSISTENCY CHECKS
    // ============================================

    // If we have total expenses and revenue, check EBITDA reasonableness
    if (totalRevenue > 0 && totalExpenses > 0 && ebitda !== undefined) {
      const impliedEbitda = totalRevenue - totalExpenses;
      const tolerance = Math.abs(totalRevenue * 0.15); // 15% tolerance

      if (Math.abs(ebitda - impliedEbitda) > tolerance && Math.abs(ebitda) > 100000) {
        warnings.push({
          field: 'ebitda',
          message: `EBITDA ($${ebitda.toLocaleString()}) differs significantly from Revenue - Expenses ($${impliedEbitda.toLocaleString()}) - verify D&A treatment${facilityContext}`
        });
      }
    }

    // ============================================
    // BUILD RESULT
    // ============================================

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length,
      summary: `${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate monthly time-series data
   * @param {Array} monthlyData - Array of monthly records
   * @param {string} dataType - Type of data ('financials', 'census', 'expenses')
   * @returns {Object} Validation result
   */
  static validateMonthlyData(monthlyData, dataType = 'financials') {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        summary: 'No monthly data to validate'
      };
    }

    // Check for duplicate months
    const months = monthlyData.map(m => m.month);
    const uniqueMonths = new Set(months);
    if (uniqueMonths.size !== months.length) {
      const duplicates = months.filter((m, i) => months.indexOf(m) !== i);
      errors.push({
        field: 'month',
        message: `Duplicate months found: ${[...new Set(duplicates)].join(', ')}`
      });
    }

    // Check month format (should be YYYY-MM)
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    const invalidMonths = months.filter(m => m && !monthRegex.test(m));
    if (invalidMonths.length > 0) {
      errors.push({
        field: 'month',
        message: `Invalid month format: ${invalidMonths.join(', ')} (expected YYYY-MM)`
      });
    }

    // Data type specific checks
    if (dataType === 'financials') {
      for (const record of monthlyData) {
        if (record.total_revenue !== undefined && record.total_revenue < 0) {
          warnings.push({
            field: 'total_revenue',
            message: `Negative revenue in ${record.month}: $${record.total_revenue.toLocaleString()}`
          });
        }
      }

      // Check for extreme variance (>3x difference between months)
      const revenues = monthlyData.filter(m => m.total_revenue > 0).map(m => m.total_revenue);
      if (revenues.length >= 2) {
        const maxRev = Math.max(...revenues);
        const minRev = Math.min(...revenues);
        if (maxRev > minRev * 3) {
          warnings.push({
            field: 'monthly_financials',
            message: `Large variance in monthly revenue (min: $${Math.round(minRev).toLocaleString()}, max: $${Math.round(maxRev).toLocaleString()})`
          });
        }
      }
    }

    if (dataType === 'census') {
      for (const record of monthlyData) {
        // Occupancy below 0 is invalid, but above 100 is possible (swing beds, overflow)
        if (record.occupancy_percentage !== undefined) {
          if (record.occupancy_percentage < 0) {
            errors.push({
              field: 'occupancy_percentage',
              message: `Invalid occupancy in ${record.month}: ${record.occupancy_percentage}%`
            });
          }
          if (record.occupancy_percentage > 100) {
            warnings.push({
              field: 'occupancy_percentage',
              message: `Invalid occupancy in ${record.month}: ${record.occupancy_percentage}%`
            });
          }
        }

        // ADC exceeding beds is unusual but possible (swing beds, overflow, counting methods)
        if (record.average_daily_census > record.total_beds && record.total_beds > 0) {
          warnings.push({
            field: 'average_daily_census',
            message: `ADC (${record.average_daily_census}) exceeds beds (${record.total_beds}) in ${record.month}`
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recordCount: monthlyData.length,
      summary: `${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`
    };
  }

  /**
   * Validate portfolio-level data against facility sum
   * @param {Object} portfolioData - Portfolio-level extracted data
   * @param {Array} facilityExtractions - Array of facility extraction results
   * @returns {Object} Validation result
   */
  static validatePortfolioConsistency(portfolioData, facilityExtractions) {
    const errors = [];
    const warnings = [];

    if (!portfolioData || !Array.isArray(facilityExtractions)) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        summary: 'Insufficient data for portfolio validation'
      };
    }

    // Sum facility-level metrics
    let facilityRevenue = 0;
    let facilityBeds = 0;
    let facilitiesWithRevenue = 0;

    for (const fe of facilityExtractions) {
      const data = fe.extraction_result?.extractedData || fe.extractedData || {};
      const rev = data.ttm_revenue || data.total_revenue || data.annual_revenue || 0;
      const beds = data.bed_count || data.total_beds || 0;

      if (rev > 0) {
        facilityRevenue += rev;
        facilitiesWithRevenue++;
      }
      if (beds > 0) {
        facilityBeds += beds;
      }
    }

    const portfolioRevenue = portfolioData.ttm_revenue || portfolioData.total_revenue || portfolioData.annual_revenue || 0;
    const portfolioBeds = portfolioData.bed_count || portfolioData.total_beds || 0;

    // Revenue consistency check
    if (portfolioRevenue > 0 && facilityRevenue > 0) {
      const revenueDiff = Math.abs(portfolioRevenue - facilityRevenue);
      const revenueVariance = (revenueDiff / portfolioRevenue) * 100;

      if (revenueVariance > 10) {
        warnings.push({
          field: 'portfolio_revenue',
          message: `Portfolio revenue ($${portfolioRevenue.toLocaleString()}) differs from facility sum ($${facilityRevenue.toLocaleString()}) by ${revenueVariance.toFixed(1)}%`
        });
      }
    }

    // Bed count consistency
    if (portfolioBeds > 0 && facilityBeds > 0) {
      if (Math.abs(portfolioBeds - facilityBeds) > 5) {
        warnings.push({
          field: 'portfolio_beds',
          message: `Portfolio beds (${portfolioBeds}) doesn't match facility sum (${facilityBeds})`
        });
      }
    }

    // Check for facilities missing financial data
    if (facilitiesWithRevenue < facilityExtractions.length && facilityExtractions.length > 0) {
      const missingCount = facilityExtractions.length - facilitiesWithRevenue;
      warnings.push({
        field: 'facility_data',
        message: `${missingCount} of ${facilityExtractions.length} facilities missing revenue data`
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      portfolioTotals: {
        revenue: portfolioRevenue,
        beds: portfolioBeds
      },
      facilityTotals: {
        revenue: facilityRevenue,
        beds: facilityBeds,
        facilitiesWithData: facilitiesWithRevenue
      },
      summary: `${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`
    };
  }
}

module.exports = {
  // Structure validation (existing)
  validateFlatStructure,
  sanitizeExtractionData,
  isValidFlatFormat,
  normalizeState,
  normalizeConfidence,
  NESTED_CATEGORY_KEYS,
  STATE_ABBREVIATIONS,
  VALID_STATE_CODES,

  // Data quality validation (new)
  ExtractionDataValidator
};
