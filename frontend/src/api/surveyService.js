/**
 * Survey Analytics API Service
 *
 * Provides API functions for the Survey Analytics page.
 * Connects to the backend survey endpoints for CMS deficiency data.
 */

import { apiService } from './apiService';

// Base path for survey endpoints
const SURVEY_BASE = '/survey';

/**
 * Deficiency types for filtering
 * - all: All deficiency types combined
 * - standard: Annual/standard health surveys only
 * - complaint: Complaint-driven surveys only
 * - infection: Infection control surveys only
 */
export const DEFICIENCY_TYPES = {
  ALL: 'all',
  STANDARD: 'standard',
  COMPLAINT: 'complaint',
  INFECTION: 'infection'
};

/**
 * Get national overview data - top F-tags, monthly volume, trends
 * @param {string} period - Time period: '30days', '90days', '12months'
 * @param {string} deficiencyType - Filter: 'all', 'standard', 'complaint', 'infection'
 * @returns {Promise<Object>} National survey overview data
 */
export const getNationalOverview = async (period = '90days', deficiencyType = 'all') => {
  const response = await apiService.get(`${SURVEY_BASE}/national-overview`, { period, deficiencyType });
  return response.data;
};

/**
 * Get state-specific data compared to national averages
 * @param {string} stateCode - State code (e.g., "CA")
 * @param {string} period - Time period
 * @param {string} deficiencyType - Filter: 'all', 'standard', 'complaint', 'infection'
 * @returns {Promise<Object>} State vs national comparison data
 */
export const getStateData = async (stateCode, period = '90days', deficiencyType = 'all') => {
  const response = await apiService.get(`${SURVEY_BASE}/state/${stateCode}`, { period, deficiencyType });
  return response.data;
};

/**
 * Get F-tag trend data over time
 * @param {string} period - Time period
 * @param {number} topN - Number of top F-tags to return
 * @param {string} deficiencyType - Filter: 'all', 'standard', 'complaint', 'infection'
 * @param {string} state - State code filter (optional, 'ALL' for national)
 * @returns {Promise<Object>} F-tag trend data
 */
export const getFTagTrends = async (period = '90days', topN = 10, deficiencyType = 'all', state = 'ALL') => {
  const response = await apiService.get(`${SURVEY_BASE}/ftag-trends`, { period, topN, deficiencyType, state });
  return response.data;
};

/**
 * Get facility-specific survey data
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Facility survey data
 */
export const getFacilitySurveyData = async (ccn) => {
  const response = await apiService.get(`${SURVEY_BASE}/facility/${ccn}`);
  return response.data;
};

/**
 * Get nearby survey activity
 * @param {string} ccn - CMS Certification Number (for geographic reference)
 * @param {number} radiusMiles - Search radius (default 25)
 * @returns {Promise<Object>} Nearby survey activity data
 */
export const getNearbySurveys = async (ccn, radiusMiles = 25) => {
  const response = await apiService.get(`${SURVEY_BASE}/nearby/${ccn}`, { radiusMiles });
  return response.data;
};

/**
 * Get regional hot spots data (counties or CBSAs with high activity)
 * @param {string} stateCode - State code
 * @param {string} period - Time period: '30days', '90days', '12months'
 * @param {string} level - Geographic level: 'county' or 'cbsa'
 * @param {string} deficiencyType - Filter: 'all', 'standard', 'complaint', 'infection'
 * @returns {Promise<Object>} Regional hot spots data with geographic breakdown
 */
export const getRegionalHotSpots = async (stateCode, period = '90days', level = 'county', deficiencyType = 'all') => {
  const response = await apiService.get(`${SURVEY_BASE}/regional-hotspots/${stateCode}`, { period, level, deficiencyType });
  return response.data;
};

/**
 * Get comprehensive facility intelligence data for Survey Intelligence tab
 * @param {string} ccn - CMS Certification Number
 * @returns {Promise<Object>} Full survey intelligence data including risk level,
 *                            survey window, nearby activity, prep priorities
 */
export const getFacilityIntelligence = async (ccn) => {
  const response = await apiService.get(`${SURVEY_BASE}/facility-intelligence/${ccn}`);
  return response.data;
};

/**
 * Get list of facilities surveyed in a state with their deficiency details
 * @param {string} stateCode - State code (e.g., "CA")
 * @param {string} period - Time period
 * @param {string} deficiencyType - Filter: 'all', 'standard', 'complaint', 'infection'
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of results per page
 * @returns {Promise<Object>} Paginated list of surveyed facilities
 */
export const getStateFacilities = async (stateCode, period = '90days', deficiencyType = 'all', page = 1, limit = 50) => {
  const response = await apiService.get(`${SURVEY_BASE}/state/${stateCode}/facilities`, {
    period,
    deficiencyType,
    page,
    limit
  });
  return response.data;
};

/**
 * Get deficiency tag description
 * @param {string} tag - F-tag code (e.g., "F0880" or "0880")
 * @returns {Promise<Object>} Deficiency description and category
 */
export const getDeficiencyDetails = async (tag) => {
  const response = await apiService.get(`${SURVEY_BASE}/deficiency/${tag}`);
  return response.data;
};

/**
 * Get aggregated survey analytics for a company/chain
 * @param {string} parentOrg - Parent organization name
 * @returns {Promise<Object>} Company survey analytics including summary, trends, facility breakdown
 */
export const getCompanySurveyAnalytics = async (parentOrg) => {
  const response = await apiService.get(`${SURVEY_BASE}/company/${encodeURIComponent(parentOrg)}`);
  return response.data;
};
