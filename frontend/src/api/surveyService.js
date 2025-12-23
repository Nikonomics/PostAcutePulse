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
 * Get national-level regional hot spots (top counties/CBSAs across all states)
 * @param {string} period - Time period: '30days', '90days', '12months'
 * @param {string} level - Geographic level: 'county' or 'cbsa'
 * @param {string} deficiencyType - Filter: 'all', 'standard', 'complaint', 'infection'
 * @param {string} sortBy - Sort by: 'deficiencies', 'surveys', 'avgDefsPerSurvey'
 * @returns {Promise<Object>} National hot spots data with state info
 */
export const getNationalHotSpots = async (period = '90days', level = 'county', deficiencyType = 'all', sortBy = 'deficiencies') => {
  const response = await apiService.get(`${SURVEY_BASE}/regional-hotspots/national`, { period, level, deficiencyType, sortBy });
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
 * @param {string} period - Time period: '30days', '90days', '12months', 'all'
 * @returns {Promise<Object>} Company survey analytics including summary, trends, facility breakdown, insights
 */
export const getCompanySurveyAnalytics = async (parentOrg, period = '12months') => {
  const response = await apiService.get(`${SURVEY_BASE}/company/${encodeURIComponent(parentOrg)}`, { period });
  return response.data;
};

/**
 * Get historical health inspection star rating cutpoints
 * @param {string} state - State code (optional, returns all states if not specified)
 * @param {string} startMonth - Start month YYYY-MM (optional)
 * @param {string} endMonth - End month YYYY-MM (optional)
 * @returns {Promise<Object>} Historical cutpoints data
 */
export const getCutpoints = async (state = null, startMonth = null, endMonth = null) => {
  const params = {};
  if (state) params.state = state;
  if (startMonth) params.startMonth = startMonth;
  if (endMonth) params.endMonth = endMonth;
  const response = await apiService.get(`${SURVEY_BASE}/cutpoints`, params);
  return response.data;
};

/**
 * Get cutpoint trends for a specific state
 * Shows how thresholds have changed and calculates trend direction
 * @param {string} state - State code (required)
 * @returns {Promise<Object>} Cutpoint trends with interpretation
 */
export const getCutpointTrends = async (state) => {
  const response = await apiService.get(`${SURVEY_BASE}/cutpoints/trends`, { state });
  return response.data;
};

/**
 * Compare cutpoints across all states for a specific month
 * @param {string} month - Month in YYYY-MM format (optional, defaults to latest)
 * @returns {Promise<Object>} State comparison data with national averages
 */
export const getCutpointComparison = async (month = null) => {
  const params = month ? { month } : {};
  const response = await apiService.get(`${SURVEY_BASE}/cutpoints/compare`, params);
  return response.data;
};

/**
 * Get heat map data for 5-star thresholds with deficiency averages
 * @returns {Promise<Object>} State data with thresholds and avg deficiencies per survey
 */
export const getCutpointHeatmap = async () => {
  const response = await apiService.get(`${SURVEY_BASE}/cutpoints/heatmap`);
  return response.data;
};

/**
 * Get survey type patterns by state (combined/standard-only/complaint-only)
 * Reveals how different states approach CMS enforcement
 * @param {string} period - '12months' | '24months' | 'all'
 * @returns {Promise<Object>} State breakdown of survey patterns
 */
export const getSurveyPatternsByState = async (period = '12months') => {
  const response = await apiService.get(`${SURVEY_BASE}/patterns/by-state`, { period });
  return response.data;
};

/**
 * Get survey pattern trends over time for a state
 * @param {string} state - State code or 'ALL' for national
 * @param {string} granularity - 'year' | 'quarter'
 * @returns {Promise<Object>} Survey pattern trends by period
 */
export const getSurveyPatternTrends = async (state = 'ALL', granularity = 'year') => {
  const response = await apiService.get(`${SURVEY_BASE}/patterns/trends`, { state, granularity });
  return response.data;
};
