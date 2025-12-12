/**
 * Ownership Research API Service
 *
 * Provides API functions for the Ownership Research page.
 * Connects to the backend ownership endpoints.
 */

import { apiService } from './apiService';

// Base path for ownership endpoints (relative to apiService base URL which is /api/v1)
const OWNERSHIP_BASE = '/ownership';

/**
 * Get top SNF chains nationwide
 * @param {number} limit - Maximum chains to return (default 20)
 * @returns {Promise<Array>} Array of top chains with stats
 */
export const getTopChains = async (limit = 20) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/top-chains`, { limit });
  return response.data;
};

/**
 * Get overall ownership statistics
 * @returns {Promise<Object>} Aggregated ownership stats
 */
export const getOwnershipStats = async () => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/stats`);
  return response.data;
};

/**
 * Search ownership chains with filters
 * @param {Object} params - Search parameters
 * @param {string} params.search - Search term for chain name
 * @param {string} params.ownershipType - 'all', 'For profit', 'Non-profit', 'Government'
 * @param {number} params.minFacilities - Minimum facility count
 * @param {number} params.minBeds - Minimum total beds
 * @param {string} params.sortBy - 'facilities', 'beds', 'rating', 'name'
 * @returns {Promise<Array>} Array of matching chains
 */
export const searchOwnership = async (params = {}) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/search`, params);
  return response.data;
};

/**
 * Get detailed information for a specific owner/chain
 * @param {string} ownerName - Name of the ownership chain
 * @returns {Promise<Object>} Owner details including facilities list
 */
export const getOwnerDetails = async (ownerName) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/${encodeURIComponent(ownerName)}/details`);
  return response.data;
};

/**
 * Natural language facility search using AI
 * @param {string} query - Natural language search query
 * @returns {Promise<Object>} Search results with parsed filters
 */
export const facilityNLSearch = async (query) => {
  const response = await apiService.post(`${OWNERSHIP_BASE}/facility-search`, { query });
  return response.data;
};

/**
 * Get deficiency records for a facility
 * @param {string} providerId - Federal provider number
 * @param {string} prefix - Deficiency prefix filter ('all', 'F', 'K', etc.)
 * @param {number} years - Number of years of history
 * @returns {Promise<Object>} Deficiency records
 */
export const getFacilityDeficiencies = async (providerId, prefix = 'all', years = 3) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/facilities/${providerId}/deficiencies`, { prefix, years });
  return response.data;
};

// ============================================================================
// OWNERSHIP PROFILES API
// Pre-computed aggregates for parent organizations with 2+ facilities
// ============================================================================

/**
 * Get ownership profile by ID or organization name
 * @param {string|number} idOrName - Profile ID or parent organization name
 * @returns {Promise<Object>} Ownership profile with facilities
 */
export const getOwnershipProfile = async (idOrName) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/profiles/${encodeURIComponent(idOrName)}`);
  return response.data;
};

/**
 * List ownership profiles with optional filtering
 * @param {Object} params - Query parameters
 * @param {string} params.search - Search term for organization name
 * @param {number} params.min_facilities - Minimum facility count (default 2)
 * @param {string} params.sort - Sort field (facility_count, total_beds, avg_overall_rating, state_count)
 * @param {string} params.order - Sort order (asc, desc)
 * @param {number} params.limit - Results per page (default 100)
 * @param {number} params.offset - Pagination offset
 * @returns {Promise<Object>} List of profiles with pagination info
 */
export const listOwnershipProfiles = async (params = {}) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/profiles`, params);
  return response.data;
};

/**
 * Get ownership profile statistics
 * @returns {Promise<Object>} Overall stats about ownership profiles
 */
export const getOwnershipProfileStats = async () => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/profiles/stats`);
  return response.data;
};
