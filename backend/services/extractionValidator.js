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

module.exports = {
  validateFlatStructure,
  sanitizeExtractionData,
  isValidFlatFormat,
  normalizeState,
  normalizeConfidence,
  NESTED_CATEGORY_KEYS,
  STATE_ABBREVIATIONS,
  VALID_STATE_CODES
};
