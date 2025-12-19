/**
 * M&A Analytics API Service
 *
 * Provides API functions for the M&A Intelligence page.
 * Connects to the backend ma-analytics endpoints.
 */

import axios from 'axios';

// Create axios instance for M&A analytics (uses /api base, not /api/v1)
const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL?.replace('/api/v1', '/api') || '/api',
  timeout: 30000,
});

// Add auth token to requests
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Get summary statistics for M&A activity
 * @param {Object} params - Query parameters
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Summary stats
 */
export const getSummary = async (params = {}) => {
  const response = await API.get('/ma-analytics/summary', { params });
  return response.data;
};

/**
 * Get monthly transaction volume for charting
 * @param {Object} params - Query parameters
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Monthly volume data
 */
export const getVolume = async (params = {}) => {
  const response = await API.get('/ma-analytics/volume', { params });
  return response.data;
};

/**
 * Get transaction activity by state
 * @param {Object} params - Query parameters
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} State-level data
 */
export const getByState = async (params = {}) => {
  const response = await API.get('/ma-analytics/by-state', { params });
  return response.data;
};

/**
 * Get top buyers/acquirers
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Number of results (default 20)
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Top buyers data
 */
export const getTopBuyers = async (params = {}) => {
  const response = await API.get('/ma-analytics/top-buyers', { params });
  return response.data;
};

/**
 * Get top sellers/divestors
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Number of results (default 20)
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Top sellers data
 */
export const getTopSellers = async (params = {}) => {
  const response = await API.get('/ma-analytics/top-sellers', { params });
  return response.data;
};

/**
 * Get paginated transactions with filters
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 * @param {string[]} params.state - State filter(s)
 * @param {string[]} params.cbsa - CBSA filter(s)
 * @param {string} params.startDate - Start date
 * @param {string} params.endDate - End date
 * @param {string} params.oldOperator - Seller name search
 * @param {string} params.newOperator - Buyer name search
 * @param {number} params.minBeds - Minimum beds
 * @param {string} params.search - Facility name search
 * @param {string} params.sortBy - Sort field
 * @param {string} params.sortOrder - Sort direction
 * @returns {Promise<Object>} Transactions with pagination
 */
export const getTransactions = async (params = {}) => {
  const response = await API.get('/ma-analytics/transactions', { params });
  return response.data;
};

/**
 * Get filter options for dropdowns
 * @returns {Promise<Object>} Available states, CBSAs, and operators
 */
export const getFilterOptions = async () => {
  const response = await API.get('/ma-analytics/filter-options');
  return response.data;
};

/**
 * Get ownership history for a specific facility
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Facility info and ownership history
 */
export const getFacilityHistory = async (ccn) => {
  const response = await API.get(`/ma-analytics/facility/${ccn}/history`);
  return response.data;
};

/**
 * Health check endpoint
 * @returns {Promise<Object>} Service health status
 */
export const checkHealth = async () => {
  const response = await API.get('/ma-analytics/health');
  return response.data;
};

/**
 * Get facilities that transacted in a specific state
 * @param {Object} params - Query parameters
 * @param {string} params.state - State abbreviation (required, e.g., 'FL')
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Facilities with lat/lng for map plotting
 */
export const getStateFacilities = async (params = {}) => {
  const response = await API.get('/ma-analytics/state-facilities', { params });
  return response.data;
};

/**
 * Get facilities that an operator transacted (acquired or divested)
 * @param {Object} params - Query parameters
 * @param {string} params.operator - Operator name (required, partial match)
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Facilities with lat/lng and transaction types
 */
export const getOperatorFacilities = async (params = {}) => {
  const response = await API.get('/ma-analytics/operator-facilities', { params });
  return response.data;
};

/**
 * Get acquisition/divestiture history for a specific owner
 * @param {Object} params - Query parameters
 * @param {string} params.ownerName - Owner name to search for
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Owner history with summary, yearly breakdown, and recent transactions
 */
export const getOwnerHistory = async (params = {}) => {
  const response = await API.get('/ma-analytics/owner-history', { params });
  return response.data;
};

// Helper function to calculate date range from preset
export const getDateRange = (preset) => {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  let startDate;

  switch (preset) {
    case 'ytd':
      startDate = `${now.getFullYear()}-01-01`;
      break;
    case '12m':
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      startDate = oneYearAgo.toISOString().split('T')[0];
      break;
    case '24m':
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      startDate = twoYearsAgo.toISOString().split('T')[0];
      break;
    case 'all':
      startDate = '2020-01-01'; // Earliest data
      break;
    default:
      // Default to 12 months
      const defaultStart = new Date(now);
      defaultStart.setFullYear(defaultStart.getFullYear() - 1);
      startDate = defaultStart.toISOString().split('T')[0];
  }

  return { startDate, endDate };
};
