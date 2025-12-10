/**
 * Market Analysis API Service
 *
 * Provides API functions for the Market Analysis page.
 * Connects to the backend market endpoints.
 */

import { apiService } from './apiService';

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
 * @param {string} type - 'SNF' or 'ALF'
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Array of matching facilities
 */
export const searchFacilities = async (query, type = 'SNF', limit = 20) => {
  const response = await apiService.get(`${MARKET_BASE}/facilities/search`, { q: query, type, limit });
  return response.data;
};

/**
 * Get state-level summary statistics
 * @param {string} state - State code
 * @param {string} type - 'SNF' or 'ALF'
 * @returns {Promise<Object>} State summary statistics
 */
export const getStateSummary = async (state, type = 'SNF') => {
  const response = await apiService.get(`${MARKET_BASE}/state-summary/${state}`, { type });
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
