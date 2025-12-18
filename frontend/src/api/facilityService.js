/**
 * Facility Profile API Service
 *
 * Provides API functions for the Facility Profile page.
 * Connects to the backend facilities endpoints for CMS data.
 */

import { apiService } from './apiService';

// Base path for facility endpoints (relative to apiService base URL which is /api/v1)
const FACILITIES_BASE = '/facilities';

/**
 * Get comprehensive facility profile by CCN
 * @param {string} ccn - CMS Certification Number (e.g., "065001")
 * @returns {Promise<Object>} Full facility profile with trends, citations, etc.
 */
export const getFacilityProfile = async (ccn) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}`);
  return response.data;
};

/**
 * Get nearby competing facilities
 * @param {string} ccn - CMS Certification Number
 * @param {number} radiusMiles - Search radius (default 25)
 * @param {number} limit - Max results (default 20)
 * @returns {Promise<Object>} Array of nearby facilities with distances
 */
export const getFacilityCompetitors = async (ccn, radiusMiles = 25, limit = 20) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}/competitors`, {
    radiusMiles,
    limit
  });
  return response.data;
};

/**
 * Search SNF facilities with filters
 * @param {Object} params - Search parameters
 * @param {string} params.name - Facility name (partial match)
 * @param {string} params.state - State code (e.g., "CO")
 * @param {string} params.city - City name (partial match)
 * @param {number} params.minBeds - Minimum bed count
 * @param {number} params.maxBeds - Maximum bed count
 * @param {number} params.minRating - Minimum overall rating (1-5)
 * @param {number} params.maxRating - Maximum overall rating (1-5)
 * @param {number} params.limit - Results per page (default 50)
 * @param {number} params.offset - Pagination offset
 * @returns {Promise<Object>} Search results with total count
 */
export const searchFacilities = async (params = {}) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/search`, params);
  return response.data;
};

/**
 * Match a facility name against the database (ALF)
 * @param {string} facilityName - Name to match
 * @param {string} city - Optional city filter
 * @param {string} state - Optional state filter
 * @param {number} minSimilarity - Minimum match score (default 0.7)
 * @returns {Promise<Object>} Best match result
 */
export const matchFacility = async (facilityName, city, state, minSimilarity = 0.7) => {
  const response = await apiService.post(`${FACILITIES_BASE}/match`, {
    facilityName,
    city,
    state,
    minSimilarity
  });
  return response.data;
};

/**
 * Search ALF facilities
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Object>} Search results
 */
export const searchALFFacilities = async (criteria) => {
  const response = await apiService.post(`${FACILITIES_BASE}/search`, criteria);
  return response.data;
};

/**
 * Get facilities near a location
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {number} radiusMiles - Search radius (default 25)
 * @param {number} limit - Max results (default 50)
 * @returns {Promise<Object>} Nearby facilities
 */
export const getFacilitiesNearby = async (latitude, longitude, radiusMiles = 25, limit = 50) => {
  const response = await apiService.post(`${FACILITIES_BASE}/nearby`, {
    latitude,
    longitude,
    radiusMiles,
    limit
  });
  return response.data;
};

/**
 * Get facility database statistics
 * @returns {Promise<Object>} Database stats
 */
export const getFacilityStats = async () => {
  const response = await apiService.get(`${FACILITIES_BASE}/stats`);
  return response.data;
};

/**
 * Get detailed deficiency records for a facility
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Deficiency records
 */
export const getFacilityDeficiencies = async (ccn) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}/deficiencies`);
  return response.data;
};

/**
 * Get penalty records for a facility
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Penalty records
 */
export const getFacilityPenalties = async (ccn) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}/penalties`);
  return response.data;
};

/**
 * Get ownership records for a facility
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Ownership records
 */
export const getFacilityOwnership = async (ccn) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}/ownership`);
  return response.data;
};

/**
 * Get benchmark comparisons (market, state, national) for a facility
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Benchmark data
 */
export const getFacilityBenchmarks = async (ccn) => {
  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}/benchmarks`);
  return response.data;
};

/**
 * Get percentile rankings for a facility compared to peers
 * @param {string} ccn - CMS Certification Number
 * @param {Object} options - Filter options
 * @param {string} options.scope - 'national' or 'state'
 * @param {string} options.state - State filter (optional)
 * @param {string} options.size - Size filter: 'small', 'medium', 'large' (optional)
 * @returns {Promise<Object>} Percentile data with distributions
 */
export const getFacilityPercentiles = async (ccn, options = {}) => {
  const params = {};
  if (options.scope) params.scope = options.scope;
  if (options.state) params.state = options.state;
  if (options.size) params.size = options.size;

  const response = await apiService.get(`${FACILITIES_BASE}/snf/${ccn}/percentiles`, params);
  return response.data;
};
