/**
 * Pennant Intelligence API Service
 *
 * Provides API functions for the Pennant Group Intelligence Dashboard.
 * Connects to the backend Pennant endpoints for ALF, HHA, and Hospice data.
 */

import { apiService } from './apiService';

// Base path for Pennant endpoints (relative to apiService base URL which is /api/v1)
const PENNANT_BASE = '/pennant';

/**
 * Get Pennant Group portfolio overview
 * @returns {Promise<Object>} High-level summary with ALF/HHA counts, capacity, states
 */
export const getOverview = async () => {
  const response = await apiService.get(`${PENNANT_BASE}/overview`);
  return response.data;
};

/**
 * Get Pennant locations (ALF, HHA, and/or Hospice agencies)
 * @param {string} type - Filter: 'alf', 'hha', 'hospice', or 'all' (default 'all')
 * @param {string} state - Optional state filter (e.g., 'CA', 'TX')
 * @returns {Promise<Object>} Locations with count and location array
 */
export const getLocations = async (type = 'all', state = null) => {
  const params = { type };
  if (state) params.state = state;
  const response = await apiService.get(`${PENNANT_BASE}/locations`, params);
  return response.data;
};

/**
 * Get Pennant locations as GeoJSON for map rendering
 * Includes ALF, HHA, and Hospice locations with coordinates
 * @param {string} state - Optional state filter
 * @param {string} type - Filter: 'alf', 'hha', 'hospice', or 'all' (default 'all')
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export const getLocationsGeoJSON = async (state = null, type = 'all') => {
  const params = { type };
  if (state) params.state = state;
  const response = await apiService.get(`${PENNANT_BASE}/locations/geojson`, params);
  return response.data;
};

/**
 * Get state-level coverage breakdown
 * @returns {Promise<Object>} Coverage summary by state with segment overlap
 */
export const getCoverageByState = async () => {
  const response = await apiService.get(`${PENNANT_BASE}/coverage-by-state`);
  return response.data;
};

/**
 * Get CBSA-level coverage breakdown
 * @returns {Promise<Object>} Coverage summary by CBSA market with segment overlap
 */
export const getCoverageByCbsa = async () => {
  const response = await apiService.get(`${PENNANT_BASE}/coverage-by-cbsa`);
  return response.data;
};

/**
 * Get detailed ALF facility data
 * @param {string} state - Optional state filter
 * @param {string} sortBy - Sort by 'capacity', 'city', or 'state' (default 'state')
 * @returns {Promise<Object>} ALF facilities with summary
 */
export const getALFFacilities = async (state = null, sortBy = 'state') => {
  const params = { sortBy };
  if (state) params.state = state;
  const response = await apiService.get(`${PENNANT_BASE}/alf`, params);
  return response.data;
};

/**
 * Get single ALF facility details
 * @param {number} id - Facility ID
 * @returns {Promise<Object>} Facility details with demographics
 */
export const getALFFacility = async (id) => {
  const response = await apiService.get(`${PENNANT_BASE}/alf/${id}`);
  return response.data;
};

/**
 * Get all actual HHA agencies (from hh_provider_snapshots)
 * @param {string} state - Optional state filter
 * @returns {Promise<Object>} Agencies with summary including star ratings and episodes
 */
export const getHHAAgencies = async (state = null) => {
  const params = {};
  if (state) params.state = state;
  const response = await apiService.get(`${PENNANT_BASE}/hha/agencies`, params);
  return response.data;
};

/**
 * Get single HHA agency details
 * @param {string} ccn - Agency CCN
 * @returns {Promise<Object>} Agency details
 */
export const getHHAAgency = async (ccn) => {
  const response = await apiService.get(`${PENNANT_BASE}/hha/agencies/${ccn}`);
  return response.data;
};

/**
 * Get all HHA subsidiaries (parent companies)
 * @returns {Promise<Object>} Subsidiaries with summary
 */
export const getHHASubsidiaries = async () => {
  const response = await apiService.get(`${PENNANT_BASE}/hha/subsidiaries`);
  return response.data;
};

/**
 * Get single HHA subsidiary details
 * @param {number} id - Subsidiary ID
 * @returns {Promise<Object>} Subsidiary details
 */
export const getHHASubsidiary = async (id) => {
  const response = await apiService.get(`${PENNANT_BASE}/hha/subsidiaries/${id}`);
  return response.data;
};

// ============================================================================
// Hospice Endpoints
// ============================================================================

/**
 * Get all Pennant hospice agencies
 * @param {string} state - Optional state filter
 * @returns {Promise<Object>} Agencies with summary including location data
 */
export const getHospiceAgencies = async (state = null) => {
  const params = {};
  if (state) params.state = state;
  const response = await apiService.get(`${PENNANT_BASE}/hospice/agencies`, params);
  return response.data;
};

// ============================================================================
// Cluster Analysis Endpoints
// ============================================================================

/**
 * Get all Pennant clusters with SNF proximity analysis
 * @param {number} radius - Clustering radius in miles (default 30)
 * @returns {Promise<Object>} Clusters with summary and SNF proximity data
 */
export const getClusters = async (radius = 30) => {
  const response = await apiService.get(`${PENNANT_BASE}/clusters?radius=${radius}`);
  return response.data;
};

/**
 * Get detailed data for a specific cluster
 * @param {string} clusterId - Cluster ID (e.g., 'cluster_1')
 * @param {number} radius - Clustering radius in miles (default 30)
 * @returns {Promise<Object>} Full cluster detail with locations and SNF list
 */
export const getClusterDetail = async (clusterId, radius = 30) => {
  const response = await apiService.get(`${PENNANT_BASE}/clusters/${clusterId}?radius=${radius}`);
  return response.data;
};

/**
 * Get SNF list for a specific cluster
 * @param {string} clusterId - Cluster ID
 * @param {string} sortBy - Sort by: 'distance', 'beds', 'rating' (default 'distance')
 * @param {string} sortOrder - Sort direction: 'asc', 'desc' (default 'asc')
 * @param {number} radius - Clustering radius in miles (default 30)
 * @returns {Promise<Object>} SNF list with cluster context
 */
export const getClusterSNFs = async (clusterId, sortBy = 'distance', sortOrder = 'asc', radius = 30) => {
  const response = await apiService.get(
    `${PENNANT_BASE}/clusters/${clusterId}/snfs?sortBy=${sortBy}&sortOrder=${sortOrder}&radius=${radius}`
  );
  return response.data;
};

/**
 * Get aggregate SNF proximity summary across all Pennant clusters
 * @param {number} radius - Clustering radius in miles (default 30)
 * @returns {Promise<Object>} Aggregate SNF proximity statistics
 */
export const getSNFProximitySummary = async (radius = 30) => {
  const response = await apiService.get(`${PENNANT_BASE}/snf-proximity-summary?radius=${radius}`);
  return response.data;
};

// ============================================================================
// Hospice Market Scoring Endpoints
// ============================================================================

/**
 * Get all hospice market scores
 * @param {string} mode - 'footprint' or 'greenfield' (default 'footprint')
 * @param {string} geoType - 'cbsa' or 'state' (default 'cbsa')
 * @param {number} minPop65 - Minimum population 65+ filter (default 50000)
 * @returns {Promise<Object>} Market scores with rankings
 */
export const getHospiceMarketScores = async (mode = 'footprint', geoType = 'cbsa', minPop65 = 50000) => {
  const response = await apiService.get(
    `${PENNANT_BASE}/hospice/market-scores?mode=${mode}&geoType=${geoType}&minPop65=${minPop65}`
  );
  return response.data;
};

/**
 * Get hospice market score for a specific geography
 * @param {string} geoCode - CBSA code or state code
 * @param {string} mode - 'footprint' or 'greenfield' (default 'footprint')
 * @param {string} geoType - 'cbsa' or 'state' (default 'cbsa')
 * @returns {Promise<Object>} Market score details with component scores
 */
export const getHospiceMarketScoreDetail = async (geoCode, mode = 'footprint', geoType = 'cbsa') => {
  const response = await apiService.get(
    `${PENNANT_BASE}/hospice/market-scores/${geoCode}?mode=${mode}&geoType=${geoType}`
  );
  return response.data;
};

/**
 * Get hospice market score summary with grade distribution
 * @param {string} mode - 'footprint' or 'greenfield' (default 'footprint')
 * @param {string} geoType - 'cbsa' or 'state' (default 'cbsa')
 * @returns {Promise<Object>} Summary with grade distribution and top/bottom markets
 */
export const getHospiceMarketScoreSummary = async (mode = 'footprint', geoType = 'cbsa') => {
  const response = await apiService.get(
    `${PENNANT_BASE}/hospice/market-scores/summary?mode=${mode}&geoType=${geoType}`
  );
  return response.data;
};
