/**
 * Facility Matcher Service
 *
 * Provides facility detection and matching capabilities for multi-facility deals:
 * 1. detectFacilitiesFromText() - AI-powered facility detection from documents
 * 2. matchFacilityToDatabase() - Weighted matching against ALF/SNF databases
 * 3. searchFacilityByName() - Manual search for operator corrections
 *
 * Also includes legacy matching functions for backward compatibility.
 */

const { getSequelizeInstance } = require('../config/database');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * State name to 2-letter code mapping
 */
const STATE_CODES = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
  'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
  'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
  'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
};

// Reverse mapping for state codes to names
const STATE_NAMES = Object.fromEntries(
  Object.entries(STATE_CODES).map(([name, code]) => [code, name])
);

/**
 * Normalize state to 2-letter code
 */
function normalizeState(state) {
  if (!state) return null;
  const upper = state.toUpperCase().trim();
  // If already a 2-letter code
  if (upper.length === 2 && STATE_NAMES[upper]) return upper;
  // Convert full name to code
  return STATE_CODES[upper] || upper;
}

// ============================================================================
// NEW: Multi-Facility Detection & Matching Functions
// ============================================================================

/**
 * Detect facilities from document text using Claude AI
 *
 * @param {string} documentText - Combined text from all uploaded documents
 * @param {string[]} facilityTypes - Array of facility types: ['SNF'], ['ALF'], or ['SNF', 'ALF']
 * @returns {Promise<Array>} Array of detected facilities with confidence scores
 *
 * Example return:
 * [
 *   { name: "Big Horn Rehabilitation & Care Center", city: "Sheridan", state: "WY", beds: 124, confidence: 0.95 },
 *   { name: "Polaris Care & Rehabilitation", city: "Cheyenne", state: "WY", beds: 109, confidence: 0.92 }
 * ]
 */
async function detectFacilitiesFromText(documentText, facilityTypes = ['SNF', 'ALF']) {
  console.log('[FacilityMatcher] Detecting facilities from document text...');
  console.log('[FacilityMatcher] Facility types to detect:', facilityTypes);
  console.log('[FacilityMatcher] Document text length:', documentText?.length || 0);

  if (!documentText || documentText.length < 100) {
    console.log('[FacilityMatcher] Document text too short for facility detection');
    return [];
  }

  // Truncate if too long (keep first 100k chars for detection)
  const truncatedText = documentText.length > 100000
    ? documentText.substring(0, 100000) + '\n...[truncated]...'
    : documentText;

  const facilityTypeDesc = facilityTypes.includes('SNF') && facilityTypes.includes('ALF')
    ? 'skilled nursing facilities (SNF) and/or assisted living facilities (ALF)'
    : facilityTypes.includes('SNF')
      ? 'skilled nursing facilities (SNF)'
      : 'assisted living facilities (ALF)';

  const prompt = `Extract ALL healthcare facility names from this document. Return ONLY valid JSON, no other text.

Document type: ${facilityTypeDesc}

CRITICAL INSTRUCTIONS:
- This is a PORTFOLIO deal - expect MULTIPLE facilities
- ANY name that looks like a facility name (e.g., "Big Horn", "Polaris", "Cedar Ridge" + "Care Center", "Rehabilitation", etc.) IS a separate facility
- Do NOT skip facilities because they appear in financial tables or subsidiary accounts - those ARE separate operating facilities
- Extract ALL facility names you find, even with incomplete info

WHERE TO LOOK:
- Document headers and titles
- Balance sheets (facility names appear in account names)
- P&L statements (revenue broken down by facility)
- Census/occupancy tables
- Property descriptions
- Any table with facility names in rows

WHAT TO EXTRACT for each facility:
- name: Full facility name (e.g., "Big Horn Rehabilitation and Care Center")
- city: City if known, or null
- state: 2-letter state code
- beds: Number if known, or null
- facility_type: "SNF" or "ALF"
- confidence: 0.0 to 1.0
- source_hint: Where you found it

RESPOND WITH ONLY THIS JSON FORMAT (no explanation, no markdown):
[{"name":"Facility One Name","city":"City","state":"XX","beds":100,"facility_type":"SNF","confidence":0.9,"source_hint":"found in header"},{"name":"Facility Two Name","city":"City","state":"XX","beds":80,"facility_type":"SNF","confidence":0.85,"source_hint":"found in table"}]

DOCUMENT:
${truncatedText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text.trim();
    console.log('[FacilityMatcher] Claude FULL response:');
    console.log('---BEGIN RESPONSE---');
    console.log(responseText);
    console.log('---END RESPONSE---');

    // Parse JSON response
    let facilities = [];
    try {
      // Try direct parse first
      facilities = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        facilities = JSON.parse(jsonMatch[0]);
      }
    }

    // Validate and normalize results
    const validatedFacilities = facilities
      .filter(f => f.name && typeof f.name === 'string' && f.name.length > 0)
      .map(f => ({
        name: f.name.trim(),
        city: f.city?.trim() || null,
        state: normalizeState(f.state),
        beds: parseInt(f.beds) || null,
        facility_type: (f.facility_type || 'SNF').toUpperCase(),
        confidence: parseFloat(f.confidence) || 0.5,
        source_hint: f.source_hint || null
      }));

    console.log('[FacilityMatcher] Detected', validatedFacilities.length, 'facilities');
    return validatedFacilities;

  } catch (error) {
    console.error('[FacilityMatcher] Error detecting facilities:', error);
    return [];
  }
}

/**
 * Match a detected facility against the appropriate database using weighted scoring
 *
 * @param {Object} facilityInfo - Detected facility info { name, city, state, beds }
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise<Array>} Top 3 matches with weighted scores
 *
 * Weighted scoring:
 * - 40% facility name similarity
 * - 25% city match
 * - 20% bed count match (within 10%)
 * - 15% address similarity
 */
async function matchFacilityToDatabase(facilityInfo, facilityType = 'SNF') {
  console.log('[FacilityMatcher] Matching facility to database:', facilityInfo);
  console.log('[FacilityMatcher] Facility type:', facilityType);

  const sequelize = getSequelizeInstance();
  const table = facilityType.toUpperCase() === 'ALF' ? 'alf_facilities' : 'snf_facilities';
  const bedsColumn = facilityType.toUpperCase() === 'ALF' ? 'capacity' : 'total_beds';

  try {
    // Build query to get candidates
    let query = `SELECT * FROM ${table} WHERE 1=1`;
    const replacements = [];

    // Filter by state if provided (significantly reduces search space)
    if (facilityInfo.state) {
      query += ' AND state = ?';
      replacements.push(normalizeState(facilityInfo.state));
    }

    // Limit search space
    query += ' LIMIT 5000';

    const [candidates] = await sequelize.query(query, { replacements });
    console.log('[FacilityMatcher] Found', candidates.length, 'candidates in', facilityInfo.state || 'all states');

    if (candidates.length === 0) {
      await sequelize.close();
      return [];
    }

    // Score each candidate
    console.log('[FacilityMatcher] Scoring candidates. Input name:', facilityInfo.name);
    console.log('[FacilityMatcher] Normalized input:', normalizeFacilityName(facilityInfo.name));

    const scoredMatches = candidates.map(candidate => {
      const scores = {
        name: calculateNameSimilarity(facilityInfo.name, candidate.facility_name),
        city: calculateCityMatch(facilityInfo.city, candidate.city),
        beds: calculateBedMatch(facilityInfo.beds, candidate[bedsColumn]),
        address: calculateAddressSimilarity(facilityInfo.address, candidate.address)
      };

      // Weighted total: 40% name, 25% city, 20% beds, 15% address
      const weightedScore =
        (scores.name * 0.40) +
        (scores.city * 0.25) +
        (scores.beds * 0.20) +
        (scores.address * 0.15);

      // Log high-scoring matches for debugging
      if (weightedScore > 0.5) {
        console.log('[FacilityMatcher] High score match:', {
          dbName: candidate.facility_name,
          normalizedDb: normalizeFacilityName(candidate.facility_name),
          scores,
          weightedScore: weightedScore.toFixed(3)
        });
      }

      return {
        ...candidate,
        match_scores: scores,
        weighted_score: weightedScore,
        match_confidence: weightedScore >= 0.8 ? 'high' : weightedScore >= 0.6 ? 'medium' : 'low'
      };
    });

    await sequelize.close();

    // Sort by weighted score and return top 3
    scoredMatches.sort((a, b) => b.weighted_score - a.weighted_score);
    const top3 = scoredMatches.slice(0, 3);

    console.log('[FacilityMatcher] Top matches:', top3.map(m => ({
      name: m.facility_name,
      score: m.weighted_score.toFixed(3),
      confidence: m.match_confidence
    })));

    return top3;

  } catch (error) {
    console.error('[FacilityMatcher] Error matching facility:', error);
    try { await sequelize.close(); } catch (e) {}
    throw error;
  }
}

/**
 * Search facility by name (for operator manual search)
 *
 * @param {string} searchTerm - Facility name to search for
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {string} state - Optional state filter (2-letter code)
 * @returns {Promise<Array>} Matching facilities
 */
async function searchFacilityByName(searchTerm, facilityType = 'SNF', state = null) {
  console.log('[FacilityMatcher] Searching for:', searchTerm, 'type:', facilityType, 'state:', state);

  const sequelize = getSequelizeInstance();
  const table = facilityType.toUpperCase() === 'ALF' ? 'alf_facilities' : 'snf_facilities';

  try {
    let query = `SELECT * FROM ${table} WHERE facility_name ILIKE ?`;
    const replacements = [`%${searchTerm}%`];

    if (state) {
      query += ' AND state = ?';
      replacements.push(normalizeState(state));
    }

    query += ' ORDER BY facility_name LIMIT 20';

    const [results] = await sequelize.query(query, { replacements });
    await sequelize.close();

    console.log('[FacilityMatcher] Found', results.length, 'results');
    return results;

  } catch (error) {
    console.error('[FacilityMatcher] Error searching:', error);
    try { await sequelize.close(); } catch (e) {}
    throw error;
  }
}

/**
 * Batch match multiple detected facilities
 *
 * @param {Array} detectedFacilities - Array from detectFacilitiesFromText()
 * @returns {Promise<Array>} Each detected facility with its top 3 matches
 */
async function batchMatchFacilities(detectedFacilities) {
  console.log('[FacilityMatcher] Batch matching', detectedFacilities.length, 'facilities');

  const results = [];

  for (const facility of detectedFacilities) {
    const matches = await matchFacilityToDatabase(facility, facility.facility_type);
    results.push({
      detected: facility,
      matches: matches,
      best_match: matches.length > 0 ? matches[0] : null,
      needs_review: matches.length === 0 || (matches[0]?.weighted_score || 0) < 0.6
    });
  }

  return results;
}

// ============================================================================
// Scoring Helper Functions
// ============================================================================

/**
 * Calculate name similarity using normalized Levenshtein distance
 */
function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;

  const n1 = normalizeFacilityName(name1);
  const n2 = normalizeFacilityName(name2);

  if (n1 === n2) return 1.0;
  if (n1.length === 0 || n2.length === 0) return 0;

  // Check for substring match (common in facility names)
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = n1.length < n2.length ? n1 : n2;
    const longer = n1.length < n2.length ? n2 : n1;
    return shorter.length / longer.length * 0.9; // 90% credit for substring match
  }

  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Calculate city match score
 */
function calculateCityMatch(city1, city2) {
  if (!city1 || !city2) return 0.5; // Neutral if missing

  const c1 = city1.toLowerCase().trim();
  const c2 = city2.toLowerCase().trim();

  if (c1 === c2) return 1.0;

  // Partial match (e.g., "South San Francisco" vs "San Francisco")
  if (c1.includes(c2) || c2.includes(c1)) return 0.8;

  // Levenshtein for typos
  const distance = levenshteinDistance(c1, c2);
  const maxLen = Math.max(c1.length, c2.length);
  const similarity = (maxLen - distance) / maxLen;

  return similarity > 0.8 ? similarity : 0;
}

/**
 * Calculate bed count match score (within 10% tolerance)
 */
function calculateBedMatch(beds1, beds2) {
  if (!beds1 || !beds2) return 0.5; // Neutral if missing

  const b1 = parseInt(beds1);
  const b2 = parseInt(beds2);

  if (isNaN(b1) || isNaN(b2)) return 0.5;
  if (b1 === b2) return 1.0;

  const diff = Math.abs(b1 - b2);
  const avg = (b1 + b2) / 2;
  const percentDiff = diff / avg;

  // Perfect match within 10%
  if (percentDiff <= 0.10) return 1.0;
  // Partial match within 25%
  if (percentDiff <= 0.25) return 0.7;
  // Some match within 50%
  if (percentDiff <= 0.50) return 0.4;

  return 0;
}

/**
 * Calculate address similarity
 */
function calculateAddressSimilarity(addr1, addr2) {
  if (!addr1 || !addr2) return 0.5; // Neutral if missing

  const a1 = normalizeAddress(addr1);
  const a2 = normalizeAddress(addr2);

  if (a1 === a2) return 1.0;

  // Extract street number and check
  const num1 = a1.match(/^\d+/);
  const num2 = a2.match(/^\d+/);

  if (num1 && num2 && num1[0] === num2[0]) {
    // Same street number, check street name
    const street1 = a1.replace(/^\d+\s*/, '');
    const street2 = a2.replace(/^\d+\s*/, '');

    if (street1 === street2) return 1.0;
    if (street1.includes(street2) || street2.includes(street1)) return 0.8;
  }

  // General similarity
  const distance = levenshteinDistance(a1, a2);
  const maxLen = Math.max(a1.length, a2.length);
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Normalize facility name for comparison
 */
function normalizeFacilityName(name) {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove common suffixes
  const suffixes = [
    'llc', 'inc', 'corp', 'corporation', 'limited', 'ltd',
    'company', 'co', 'l.l.c.', 'l.l.c', 'inc.', 'incorporated'
  ];
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\b${suffix}\\b\\.?$`, 'gi');
    normalized = normalized.replace(regex, '').trim();
  });

  // Remove common facility type keywords
  const facilityTypes = [
    'assisted living', 'memory care', 'senior living', 'retirement',
    'nursing home', 'skilled nursing', 'rehabilitation', 'rehab',
    'health center', 'care center', 'residence', 'manor', 'house',
    'village', 'community', 'estates', 'place', 'home', 'facility',
    'center', 'healthcare', 'health care', 'nursing'
  ];
  facilityTypes.forEach(type => {
    const regex = new RegExp(`\\b${type}\\b`, 'gi');
    normalized = normalized.replace(regex, '').trim();
  });

  // Remove special characters, collapse spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '').trim();
  normalized = normalized.replace(/^the\s+/i, '').replace(/\s+the$/i, '').trim();
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Normalize address for comparison
 */
function normalizeAddress(addr) {
  if (!addr) return '';

  let normalized = addr.toLowerCase().trim();

  // Standardize common abbreviations
  const abbreviations = {
    'street': 'st', 'avenue': 'ave', 'boulevard': 'blvd', 'drive': 'dr',
    'road': 'rd', 'lane': 'ln', 'court': 'ct', 'circle': 'cir',
    'place': 'pl', 'north': 'n', 'south': 's', 'east': 'e', 'west': 'w',
    'northeast': 'ne', 'northwest': 'nw', 'southeast': 'se', 'southwest': 'sw'
  };

  Object.entries(abbreviations).forEach(([full, abbr]) => {
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    normalized = normalized.replace(regex, abbr);
  });

  // Remove punctuation and extra spaces
  normalized = normalized.replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate overall similarity (legacy function)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// ============================================================================
// Legacy Functions (for backward compatibility)
// ============================================================================

/**
 * Match a facility name against the ALF database (legacy)
 */
async function matchFacility(facilityName, city = null, state = null, minSimilarity = 0.7) {
  const matches = await findFacilityMatches(facilityName, city, state, minSimilarity, 1);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Find multiple facility matches (legacy)
 */
async function findFacilityMatches(facilityName, city = null, state = null, minSimilarity = 0.7, limit = 5) {
  const sequelize = getSequelizeInstance();

  try {
    let query = 'SELECT * FROM alf_facilities WHERE 1=1';
    const replacements = [];

    if (state) {
      const stateCode = normalizeState(state);
      query += ' AND state = ?';
      replacements.push(stateCode);
    }

    if (city) {
      query += ' AND city = ?';
      replacements.push(city);
    }

    query += ' LIMIT 1000';

    const [facilities] = await sequelize.query(query, { replacements });

    if (!facilities || facilities.length === 0) {
      await sequelize.close();
      return [];
    }

    const normalizedInput = normalizeFacilityName(facilityName);
    const scoredMatches = [];

    facilities.forEach(facility => {
      const normalizedDb = normalizeFacilityName(facility.facility_name);
      const similarity = calculateSimilarity(normalizedInput, normalizedDb);

      if (similarity >= minSimilarity) {
        scoredMatches.push({
          ...facility,
          match_score: similarity,
          match_confidence: similarity >= 0.9 ? 'high' : similarity >= 0.8 ? 'medium' : 'low'
        });
      }
    });

    await sequelize.close();

    scoredMatches.sort((a, b) => b.match_score - a.match_score);
    return scoredMatches.slice(0, limit);

  } catch (err) {
    await sequelize.close();
    throw new Error(`Query failed: ${err.message}`);
  }
}

/**
 * Search facilities by criteria (legacy)
 */
async function searchFacilities(criteria) {
  const sequelize = getSequelizeInstance();

  try {
    let query = 'SELECT * FROM alf_facilities WHERE 1=1';
    const replacements = [];

    if (criteria.name) {
      query += ' AND facility_name LIKE ?';
      replacements.push(`%${criteria.name}%`);
    }

    if (criteria.city) {
      query += ' AND city = ?';
      replacements.push(criteria.city);
    }

    if (criteria.state) {
      query += ' AND state = ?';
      replacements.push(normalizeState(criteria.state));
    }

    if (criteria.zipCode) {
      query += ' AND zip_code = ?';
      replacements.push(criteria.zipCode);
    }

    if (criteria.minCapacity) {
      query += ' AND capacity >= ?';
      replacements.push(criteria.minCapacity);
    }

    if (criteria.maxCapacity) {
      query += ' AND capacity <= ?';
      replacements.push(criteria.maxCapacity);
    }

    query += ' ORDER BY facility_name';
    query += ` LIMIT ${criteria.limit || 50}`;

    const [facilities] = await sequelize.query(query, { replacements });
    await sequelize.close();

    return facilities || [];
  } catch (err) {
    await sequelize.close();
    throw new Error(`Query failed: ${err.message}`);
  }
}

/**
 * Get facilities within a geographic radius (legacy)
 */
async function getFacilitiesNearby(latitude, longitude, radiusMiles = 25, limit = 50) {
  const sequelize = getSequelizeInstance();

  try {
    const query = `
      SELECT *,
        (
          3959 * acos(
            cos(radians(?)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(latitude))
          )
        ) AS distance_miles
      FROM alf_facilities
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
      HAVING (
        3959 * acos(
          cos(radians(?)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(latitude))
        )
      ) <= ?
      ORDER BY distance_miles
      LIMIT ?
    `;

    const [facilities] = await sequelize.query(query, {
      replacements: [latitude, longitude, latitude, latitude, longitude, latitude, radiusMiles, limit]
    });

    await sequelize.close();
    return facilities || [];
  } catch (err) {
    console.log('[Facility Nearby] Falling back to bounding box:', err.message);
    await sequelize.close();
    return getFacilitiesInBoundingBox(latitude, longitude, radiusMiles, limit);
  }
}

/**
 * Fallback bounding box search (legacy)
 */
async function getFacilitiesInBoundingBox(latitude, longitude, radiusMiles, limit) {
  const sequelize = getSequelizeInstance();

  try {
    const latDegPerMile = 1 / 69.0;
    const lonDegPerMile = 1 / (69.0 * Math.cos(latitude * Math.PI / 180));

    const minLat = latitude - (radiusMiles * latDegPerMile);
    const maxLat = latitude + (radiusMiles * latDegPerMile);
    const minLon = longitude - (radiusMiles * lonDegPerMile);
    const maxLon = longitude + (radiusMiles * lonDegPerMile);

    const query = `
      SELECT *
      FROM alf_facilities
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      LIMIT ?
    `;

    const [facilities] = await sequelize.query(query, {
      replacements: [minLat, maxLat, minLon, maxLon, limit]
    });

    await sequelize.close();
    return facilities || [];
  } catch (err) {
    await sequelize.close();
    throw new Error(`Query failed: ${err.message}`);
  }
}

/**
 * Get database statistics for SNF and ALF facility tables
 * @returns {Object} Stats about both databases
 */
async function getDatabaseStats() {
  const sequelize = getSequelizeInstance();

  try {
    // Get SNF stats
    const [snfStats] = await sequelize.query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(DISTINCT state) as state_count,
        MIN(created_at) as earliest_record,
        MAX(created_at) as latest_record
      FROM snf_facilities
    `);

    // Get ALF stats
    const [alfStats] = await sequelize.query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(DISTINCT state) as state_count,
        MIN(created_at) as earliest_record,
        MAX(created_at) as latest_record
      FROM alf_facilities
    `);

    await sequelize.close();

    return {
      snf: {
        count: parseInt(snfStats[0]?.total_count || 0),
        state_coverage: parseInt(snfStats[0]?.state_count || 0),
        last_updated: '2024-Q4',
        source: 'CMS Provider Information'
      },
      alf: {
        count: parseInt(alfStats[0]?.total_count || 0),
        state_coverage: parseInt(alfStats[0]?.state_count || 0),
        last_updated: '2021',
        source: 'State Licensing Data'
      }
    };
  } catch (err) {
    console.error('[getDatabaseStats] Error:', err.message);
    await sequelize.close();
    throw err;
  }
}

module.exports = {
  // New multi-facility functions
  detectFacilitiesFromText,
  matchFacilityToDatabase,
  searchFacilityByName,
  batchMatchFacilities,
  getDatabaseStats,

  // Legacy functions
  matchFacility,
  findFacilityMatches,
  searchFacilities,
  getFacilitiesNearby,

  // Utility functions
  normalizeFacilityName,
  normalizeState,
  calculateSimilarity,
  calculateNameSimilarity,
  calculateCityMatch,
  calculateBedMatch,
  calculateAddressSimilarity
};
