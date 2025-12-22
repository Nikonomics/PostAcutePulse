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
 * Get national overview data - top F-tags, monthly volume, trends
 * @param {string} period - Time period: '30days', '90days', '12months'
 * @returns {Promise<Object>} National survey overview data
 */
export const getNationalOverview = async (period = '90days') => {
  const response = await apiService.get(`${SURVEY_BASE}/national-overview`, { period });
  return response.data;
};

/**
 * Get state-specific data compared to national averages
 * @param {string} stateCode - State code (e.g., "CA")
 * @param {string} period - Time period
 * @returns {Promise<Object>} State vs national comparison data
 */
export const getStateData = async (stateCode, period = '90days') => {
  const response = await apiService.get(`${SURVEY_BASE}/state/${stateCode}`, { period });
  return response.data;
};

/**
 * Get F-tag trend data over time
 * @param {string} period - Time period
 * @param {number} topN - Number of top F-tags to return
 * @returns {Promise<Object>} F-tag trend data
 */
export const getFTagTrends = async (period = '90days', topN = 10) => {
  const response = await apiService.get(`${SURVEY_BASE}/ftag-trends`, { period, topN });
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
 * Get regional hot spots data (counties with high activity)
 * @param {string} stateCode - State code
 * @param {string} period - Time period
 * @returns {Promise<Object>} Regional hot spots data with county breakdown
 */
export const getRegionalHotSpots = async (stateCode, period = '90days') => {
  const response = await apiService.get(`${SURVEY_BASE}/regional-hotspots/${stateCode}`, { period });
  return response.data;
};
