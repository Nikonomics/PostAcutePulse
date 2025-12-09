/**
 * Facility Matcher Service
 *
 * Matches facility names from deal documents against the ALF database
 * to auto-populate missing data (licensed beds, address, coordinates, etc.)
 */

const { getSequelizeInstance } = require('../config/database');

/**
 * Normalize facility name for matching
 * - Convert to lowercase
 * - Remove common suffixes/prefixes
 * - Remove special characters
 * - Trim whitespace
 */
function normalizeFacilityName(name) {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove common legal suffixes
  const suffixes = [
    'llc', 'inc', 'corp', 'corporation', 'limited', 'ltd',
    'company', 'co', 'l.l.c.', 'l.l.c', 'inc.', 'incorporated'
  ];

  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\b${suffix}\\b\\.?$`, 'gi');
    normalized = normalized.replace(regex, '').trim();
  });

  // Remove common facility type keywords (we'll match on core name)
  const facilityTypes = [
    'assisted living', 'memory care', 'senior living', 'retirement',
    'nursing home', 'skilled nursing', 'rehabilitation', 'rehab',
    'health center', 'care center', 'residence', 'manor', 'house',
    'village', 'community', 'estates', 'place', 'home', 'facility'
  ];

  facilityTypes.forEach(type => {
    const regex = new RegExp(`\\b${type}\\b`, 'gi');
    normalized = normalized.replace(regex, '').trim();
  });

  // Remove special characters but keep spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, '').trim();

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Match a facility name against the ALF database
 *
 * @param {string} facilityName - The facility name from the deal document
 * @param {string} city - Optional city to narrow search
 * @param {string} state - Optional state to narrow search
 * @param {number} minSimilarity - Minimum similarity score (0-1), default 0.7
 * @returns {Promise<Object|null>} - Best matching facility or null
 */
async function matchFacility(facilityName, city = null, state = null, minSimilarity = 0.7) {
  const sequelize = getSequelizeInstance();

  try {
    // Build query with optional filters
    let query = 'SELECT * FROM alf_facilities WHERE 1=1';
    const replacements = [];

    if (state) {
      query += ' AND state = ?';
      replacements.push(state.toUpperCase());
    }

    if (city) {
      query += ' AND city = ?';
      replacements.push(city);
    }

    query += ' LIMIT 1000'; // Limit search space for performance

    console.log('[Facility Match] Query:', query);
    console.log('[Facility Match] Replacements:', replacements);

    const [facilities] = await sequelize.query(query, { replacements });

    console.log('[Facility Match] Found', facilities?.length || 0, 'facilities');

    if (!facilities || facilities.length === 0) {
      await sequelize.close();
      return null;
    }

    // Normalize input name
    const normalizedInput = normalizeFacilityName(facilityName);

    // Find best match
    let bestMatch = null;
    let bestScore = 0;

    facilities.forEach(facility => {
      const normalizedDb = normalizeFacilityName(facility.facility_name);
      const similarity = calculateSimilarity(normalizedInput, normalizedDb);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = facility;
      }
    });

    await sequelize.close();

    // Return match if above threshold
    if (bestScore >= minSimilarity) {
      return {
        ...bestMatch,
        match_score: bestScore,
        match_confidence: bestScore >= 0.9 ? 'high' : bestScore >= 0.8 ? 'medium' : 'low'
      };
    }

    return null;
  } catch (err) {
    await sequelize.close();
    throw new Error(`Query failed: ${err.message}`);
  }
}

/**
 * Search facilities by multiple criteria
 *
 * @param {Object} criteria - Search criteria
 * @param {string} criteria.name - Facility name (partial match)
 * @param {string} criteria.city - City
 * @param {string} criteria.state - State (2-letter code)
 * @param {string} criteria.zipCode - Zip code
 * @param {number} criteria.minCapacity - Minimum bed capacity
 * @param {number} criteria.maxCapacity - Maximum bed capacity
 * @param {number} criteria.limit - Maximum results to return (default 50)
 * @returns {Promise<Array>} - Array of matching facilities
 */
async function searchFacilities(criteria) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(new Error(`Database connection failed: ${err.message}`));
      }
    });

    let query = 'SELECT * FROM alf_facilities WHERE 1=1';
    const params = [];

    if (criteria.name) {
      query += ' AND facility_name LIKE ?';
      params.push(`%${criteria.name}%`);
    }

    if (criteria.city) {
      query += ' AND city = ?';
      params.push(criteria.city);
    }

    if (criteria.state) {
      query += ' AND state = ?';
      params.push(criteria.state.toUpperCase());
    }

    if (criteria.zipCode) {
      query += ' AND zip_code = ?';
      params.push(criteria.zipCode);
    }

    if (criteria.minCapacity) {
      query += ' AND capacity >= ?';
      params.push(criteria.minCapacity);
    }

    if (criteria.maxCapacity) {
      query += ' AND capacity <= ?';
      params.push(criteria.maxCapacity);
    }

    query += ' ORDER BY facility_name';
    query += ` LIMIT ${criteria.limit || 50}`;

    db.all(query, params, (err, facilities) => {
      db.close();

      if (err) {
        return reject(new Error(`Query failed: ${err.message}`));
      }

      resolve(facilities || []);
    });
  });
}

/**
 * Get facilities within a geographic radius
 *
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radiusMiles - Radius in miles
 * @param {number} limit - Maximum results (default 50)
 * @returns {Promise<Array>} - Array of facilities with distance
 */
async function getFacilitiesNearby(latitude, longitude, radiusMiles = 25, limit = 50) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(new Error(`Database connection failed: ${err.message}`));
      }
    });

    // Haversine formula for calculating distance
    // Note: SQLite doesn't have built-in trig functions, so we use a rough approximation
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
      HAVING distance_miles <= ?
      ORDER BY distance_miles
      LIMIT ?
    `;

    db.all(query, [latitude, longitude, latitude, radiusMiles, limit], (err, facilities) => {
      db.close();

      if (err) {
        // If trig functions not available (standard SQLite), fall back to bounding box
        return getFacilitiesInBoundingBox(latitude, longitude, radiusMiles, limit)
          .then(resolve)
          .catch(reject);
      }

      resolve(facilities || []);
    });
  });
}

/**
 * Fallback method using bounding box approximation
 */
async function getFacilitiesInBoundingBox(latitude, longitude, radiusMiles, limit) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(new Error(`Database connection failed: ${err.message}`));
      }
    });

    // Approximate degrees per mile
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

    db.all(query, [minLat, maxLat, minLon, maxLon, limit], (err, facilities) => {
      db.close();

      if (err) {
        return reject(new Error(`Query failed: ${err.message}`));
      }

      resolve(facilities || []);
    });
  });
}

module.exports = {
  matchFacility,
  searchFacilities,
  getFacilitiesNearby,
  normalizeFacilityName,
  calculateSimilarity
};
