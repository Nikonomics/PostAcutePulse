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
 * @param {string} sortBy - Sort by 'facilities' or 'beds' (default 'beds')
 * @returns {Promise<Array>} Array of top chains with stats
 */
export const getTopChains = async (limit = 20, sortBy = 'beds') => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/top-chains`, { limit, sortBy });
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

// ============================================================================
// STARRED ITEMS API
// Allow users to star/bookmark ownership chains and facilities
// ============================================================================

/**
 * Get all starred items for the current user
 * @param {string} type - Optional filter: 'ownership_chain' or 'facility'
 * @returns {Promise<Array>} Array of starred items
 */
export const getStarredItems = async (type = null) => {
  const params = type ? { type } : {};
  const response = await apiService.get(`${OWNERSHIP_BASE}/starred`, params);
  return response.data;
};

/**
 * Star an item (ownership chain or facility)
 * @param {string} itemType - 'ownership_chain' or 'facility'
 * @param {string} itemIdentifier - Chain name or federal_provider_number
 * @param {string} itemName - Display name for convenience
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Created starred item
 */
export const starItem = async (itemType, itemIdentifier, itemName = null, notes = null) => {
  const response = await apiService.post(`${OWNERSHIP_BASE}/starred`, {
    itemType,
    itemIdentifier,
    itemName,
    notes
  });
  return response.data;
};

/**
 * Unstar an item
 * @param {string} itemType - 'ownership_chain' or 'facility'
 * @param {string} itemIdentifier - Chain name or federal_provider_number
 * @returns {Promise<Object>} Deletion result
 */
export const unstarItem = async (itemType, itemIdentifier) => {
  const response = await apiService.delete(
    `${OWNERSHIP_BASE}/starred/${itemType}/${encodeURIComponent(itemIdentifier)}`
  );
  return response.data;
};

/**
 * Check if items are starred (batch check)
 * @param {Array} items - Array of {itemType, itemIdentifier}
 * @returns {Promise<Object>} Map of item keys to boolean
 */
export const checkStarredItems = async (items) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/starred/check`, {
    items: JSON.stringify(items)
  });
  return response.data;
};

// ============================================================================
// OWNERSHIP PROFILE EDITABLE API
// User-editable profile fields, contacts, comments
// ============================================================================

/**
 * Create a custom ownership profile (not from CMS)
 * @param {Object} profileData - Profile data
 * @returns {Promise<Object>} Created profile
 */
export const createOwnershipProfile = async (profileData) => {
  const response = await apiService.post(`${OWNERSHIP_BASE}/profiles`, profileData);
  return response.data;
};

/**
 * Update ownership profile editable fields
 * @param {number} profileId - Profile ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated profile
 */
export const updateOwnershipProfile = async (profileId, updates) => {
  const response = await apiService.put(`${OWNERSHIP_BASE}/profiles/${profileId}`, updates);
  return response.data;
};

// ============================================================================
// OWNERSHIP CONTACTS API
// ============================================================================

/**
 * Get contacts for an ownership profile
 * @param {number} profileId - Profile ID
 * @returns {Promise<Array>} Array of contacts
 */
export const getOwnershipContacts = async (profileId) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/profiles/${profileId}/contacts`);
  return response.data;
};

/**
 * Add a contact to an ownership profile
 * @param {number} profileId - Profile ID
 * @param {Object} contactData - Contact data
 * @returns {Promise<Object>} Created contact
 */
export const addOwnershipContact = async (profileId, contactData) => {
  const response = await apiService.post(`${OWNERSHIP_BASE}/profiles/${profileId}/contacts`, contactData);
  return response.data;
};

/**
 * Update a contact
 * @param {number} profileId - Profile ID
 * @param {number} contactId - Contact ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated contact
 */
export const updateOwnershipContact = async (profileId, contactId, updates) => {
  const response = await apiService.put(`${OWNERSHIP_BASE}/profiles/${profileId}/contacts/${contactId}`, updates);
  return response.data;
};

/**
 * Delete a contact
 * @param {number} profileId - Profile ID
 * @param {number} contactId - Contact ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteOwnershipContact = async (profileId, contactId) => {
  const response = await apiService.delete(`${OWNERSHIP_BASE}/profiles/${profileId}/contacts/${contactId}`);
  return response.data;
};

// ============================================================================
// OWNERSHIP COMMENTS API
// ============================================================================

/**
 * Get comments for an ownership profile (threaded)
 * @param {number} profileId - Profile ID
 * @returns {Promise<Array>} Array of threaded comments
 */
export const getOwnershipComments = async (profileId) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/profiles/${profileId}/comments`);
  return response.data;
};

/**
 * Add a comment to an ownership profile
 * @param {number} profileId - Profile ID
 * @param {Object} commentData - { comment, parentId?, mentions? }
 * @returns {Promise<Object>} Created comment
 */
export const addOwnershipComment = async (profileId, commentData) => {
  const response = await apiService.post(`${OWNERSHIP_BASE}/profiles/${profileId}/comments`, commentData);
  return response.data;
};

/**
 * Delete a comment
 * @param {number} profileId - Profile ID
 * @param {number} commentId - Comment ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteOwnershipComment = async (profileId, commentId) => {
  const response = await apiService.delete(`${OWNERSHIP_BASE}/profiles/${profileId}/comments/${commentId}`);
  return response.data;
};

// ============================================================================
// OWNERSHIP ACTIVITY API
// ============================================================================

/**
 * Get activity/change log for an ownership profile
 * @param {number} profileId - Profile ID
 * @param {Object} params - { limit, offset }
 * @returns {Promise<Object>} Activity feed
 */
export const getOwnershipActivity = async (profileId, params = {}) => {
  const response = await apiService.get(`${OWNERSHIP_BASE}/profiles/${profileId}/activity`, params);
  return response.data;
};
