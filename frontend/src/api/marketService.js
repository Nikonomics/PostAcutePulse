/**
 * Market Analysis API Service
 *
 * Provides API functions for the Market Analysis page.
 * Connects to the backend market endpoints.
 */

import { apiService } from './apiService';
import axios from 'axios';

// Create a dedicated axios instance for market endpoints
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api/v1',
  timeout: 30000,
});

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Base path for market endpoints (relative to apiService base URL which is /api/v1)
const MARKET_BASE = '/market';

/**
 * Get list of all states with facility counts
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Array>} Array of states with counts
 */
export const getStates = async (type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/states`, { type });
  return response.data;
};

/**
 * Get counties for a state with facility counts
 * @param {string} state - State code (e.g., 'CA')
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Array>} Array of counties with counts
 */
export const getCounties = async (state, type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/counties`, { state, type });
  return response.data;
};

/**
 * Search facilities by name (for autocomplete)
 * @param {string} query - Search query
 * @param {number} limit - Maximum results
 * @returns {Promise<Object>} Search results with data array
 */
export const searchFacilities = async (query, limit = 20) => {
  const response = await apiService.get(`${MARKET_BASE}/search`, { searchTerm: query, limit });
  return response.data;
};

/**
 * Get full facility details by CCN
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Full facility details
 */
export const getFacilityDetails = async (ccn) => {
  const response = await apiService.get(`${MARKET_BASE}/facility/${ccn}`);
  return response.data;
};

/**
 * Get state-level summary statistics
 * @param {string} stateCode - State code (e.g., 'ID', 'WA')
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Object>} State summary statistics
 */
export const getStateSummary = async (stateCode, type = 'SNF') => {
  try {
    // Uses apiClient to ensure /api/v1 prefix is applied automatically
    const response = await apiClient.get(`/market/state-summary/${stateCode}`, {
      params: { type }
    });
    console.log('State Summary API Response:', response.data); // DEBUG
    // The backend returns { success: true, data: { ... } }
    return response.data.data;
  } catch (error) {
    console.error('Error fetching state summary:', error);
    return null;
  }
};

/**
 * Get state-level market metrics (demographics, supply, competition)
 * @param {string} state - State code (e.g., 'ID', 'WA')
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Object>} State-level market metrics
 */
export const getStateMetrics = async (state, type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/state-metrics/${state}`, { type });
  return response.data;
};

/**
 * Get combined market metrics for a county
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Object>} Market metrics with demographics and supply data
 */
export const getMarketMetrics = async (state, county, type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/metrics`, { state, county, type });
  return response.data;
};

/**
 * Get facilities in a county (for map display)
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {string} type - 'SNF' or 'ALF'
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Array of facilities with coordinates
 */
export const getFacilitiesInCounty = async (state, county, type = 'SNF', limit = 100) => {
  const response = await apiService.get(`${MARKET_BASE}/facilities-in-county`, { state, county, type, limit });
  return response.data;
};

/**
 * Get county demographics
 * @param {string} state - State code
 * @param {string} county - County name
 * @returns {Promise<Object>} Demographics data
 */
export const getDemographics = async (state, county) => {
  const response = await apiService.get(`${MARKET_BASE}/demographics/${state}/${encodeURIComponent(county)}`);
  return response.data;
};

/**
 * Get supply summary for a county
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Object>} Supply statistics
 */
export const getSupplySummary = async (state, county, type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/supply-summary`, { state, county, type });
  return response.data;
};

/**
 * Get national benchmark statistics
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Object>} National benchmarks with beds/capacity per 1K population
 */
export const getNationalBenchmarks = async (type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/national-benchmarks`, { type });
  return response.data;
};

/**
 * Check market service health
 * @returns {Promise<Object>} Health status
 */
export const checkHealth = async () => {
  const response = await apiService.get(`${MARKET_BASE}/health`);
  return response.data;
};

/**
 * Get CMS data freshness status
 * @returns {Promise<Object>} Data status with last refresh dates and counts
 */
export const getDataStatus = async () => {
  const response = await apiService.get(`${MARKET_BASE}/data-status`);
  return response.data;
};

/**
 * Trigger CMS data refresh
 * @param {string} dataset - 'facilities', 'deficiencies', or 'all'
 * @returns {Promise<Object>} Refresh start confirmation
 */
export const triggerRefresh = async (dataset = 'all') => {
  const response = await apiService.post(`${MARKET_BASE}/refresh`, { dataset });
  return response.data;
};

/**
 * Get refresh history
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} Array of refresh log entries
 */
export const getRefreshHistory = async (limit = 10) => {
  const response = await apiService.get(`${MARKET_BASE}/refresh-history`, { limit });
  return response.data;
};

// ============================================================================
// GEO-SEARCH API (Map-based facility search)
// ============================================================================

/**
 * Get facilities within a radius of a point (for map view)
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radius - Search radius in miles
 * @param {string[]} types - Array of provider types (e.g., ['SNF', 'HHA'])
 * @returns {Promise<Object>} Facilities within radius
 */
export const getMarketMap = async (lat, lng, radius, types = ['SNF']) => {
  const response = await apiService.get(`${MARKET_BASE}/map`, {
    lat,
    lng,
    radius,
    types: types.join(',')
  });
  return response.data;
};

/**
 * Get facilities within map bounds (for viewport-based loading)
 * @param {number} north - Northern boundary latitude
 * @param {number} south - Southern boundary latitude
 * @param {number} east - Eastern boundary longitude
 * @param {number} west - Western boundary longitude
 * @param {string[]} types - Array of provider types (e.g., ['SNF', 'HHA'])
 * @returns {Promise<Object>} Facilities within bounds
 */
export const getMarketMapBounds = async (north, south, east, west, types = ['SNF']) => {
  const response = await apiService.get(`${MARKET_BASE}/map/bounds`, {
    north,
    south,
    east,
    west,
    types: types.join(',')
  });
  return response.data;
};

// ============================================================================
// MARKET COMMENTS API
// ============================================================================

/**
 * Get all comments for a market (state + county)
 * @param {string} state - State code (e.g., "CO")
 * @param {string} county - County name
 * @returns {Promise<Object>} Comments with replies and mentions
 */
export const getMarketComments = async (state, county) => {
  const response = await apiService.get(`${MARKET_BASE}/${state}/${encodeURIComponent(county)}/comments`);
  return response.data;
};

/**
 * Add a comment to a market
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {Object} commentData - Comment data
 * @param {string} commentData.comment - Comment text
 * @param {number} commentData.parent_id - Parent comment ID for replies (optional)
 * @param {number[]} commentData.mentioned_user_ids - IDs of mentioned users
 * @returns {Promise<Object>} Created comment
 */
export const addMarketComment = async (state, county, commentData) => {
  const response = await apiService.post(`${MARKET_BASE}/${state}/${encodeURIComponent(county)}/comments`, commentData);
  return response.data;
};

/**
 * Delete a market comment
 * @param {string} state - State code
 * @param {string} county - County name
 * @param {number} commentId - Comment ID to delete
 * @returns {Promise<Object>} Success response
 */
export const deleteMarketComment = async (state, county, commentId) => {
  const response = await apiService.delete(`${MARKET_BASE}/${state}/${encodeURIComponent(county)}/comments/${commentId}`);
  return response.data;
};

// ============================================================================
// WATCHLIST API
// ============================================================================

const WATCHLIST_BASE = '/watchlist';

/**
 * Get all watchlists for the current user
 * @returns {Promise<Object>} Watchlists with items
 */
export const getWatchlists = async () => {
  const response = await apiService.get(WATCHLIST_BASE);
  return response.data;
};

/**
 * Create a new watchlist
 * @param {string} name - Watchlist name
 * @returns {Promise<Object>} Created watchlist
 */
export const createWatchlist = async (name) => {
  const response = await apiService.post(WATCHLIST_BASE, { name });
  return response.data;
};

/**
 * Get details of a specific watchlist
 * @param {number} watchlistId - Watchlist ID
 * @returns {Promise<Object>} Watchlist with all items
 */
export const getWatchlistDetails = async (watchlistId) => {
  const response = await apiService.get(`${WATCHLIST_BASE}/${watchlistId}`);
  return response.data;
};

/**
 * Update a watchlist
 * @param {number} watchlistId - Watchlist ID
 * @param {Object} data - Update data { name?, is_primary? }
 * @returns {Promise<Object>} Updated watchlist
 */
export const updateWatchlist = async (watchlistId, data) => {
  const response = await apiService.put(`${WATCHLIST_BASE}/${watchlistId}`, data);
  return response.data;
};

/**
 * Delete a watchlist
 * @param {number} watchlistId - Watchlist ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteWatchlist = async (watchlistId) => {
  const response = await apiService.delete(`${WATCHLIST_BASE}/${watchlistId}`);
  return response.data;
};

/**
 * Add a facility to a watchlist
 * @param {number} watchlistId - Watchlist ID
 * @param {Object} facilityData - Facility data
 * @param {string} facilityData.ccn - Facility CCN (federal provider number)
 * @param {string} facilityData.provider_type - 'SNF', 'HHA', or 'HOSPICE'
 * @param {string} facilityData.notes - Optional notes
 * @returns {Promise<Object>} Created watchlist item
 */
export const addToWatchlist = async (watchlistId, facilityData) => {
  const response = await apiService.post(`${WATCHLIST_BASE}/${watchlistId}/items`, facilityData);
  return response.data;
};

/**
 * Remove an item from a watchlist
 * @param {number} itemId - Watchlist item ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const removeFromWatchlist = async (itemId) => {
  const response = await apiService.delete(`${WATCHLIST_BASE}/items/${itemId}`);
  return response.data;
};

// ============================================================================
// PROVIDER METADATA API (Unified SNF/HHA lookup)
// ============================================================================

/**
 * Get provider metadata by CCN (unified SNF/HHA lookup)
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Provider metadata including type (SNF or HHA)
 */
export const getProviderMetadata = async (ccn) => {
  const response = await apiService.get(`${MARKET_BASE}/provider/${ccn}/metadata`);
  return response.data;
};
