/**
 * Home Health Market Data API Service
 *
 * Provides API calls for home health agency data, quality metrics,
 * benchmarks, and market analysis.
 */

import { apiService } from './apiService';

// Base path for home health endpoints (relative to apiService base URL /api/v1)
const HH_BASE = '/hh-market';

/**
 * Get summary statistics for home health market
 */
export const getHomeHealthStats = async () => {
  const response = await apiService.get(`${HH_BASE}/stats`);
  return response.data;
};

/**
 * Get list of home health agencies with filters
 */
export const getHomeHealthAgencies = async (params = {}) => {
  const response = await apiService.get(`${HH_BASE}/agencies`, { params });
  return response.data;
};

/**
 * Get single agency by CCN
 */
export const getAgencyByCCN = async (ccn) => {
  const response = await apiService.get(`${HH_BASE}/agencies/${ccn}`);
  return response.data;
};

/**
 * Get agency historical snapshots
 */
export const getAgencyHistory = async (ccn) => {
  const response = await apiService.get(`${HH_BASE}/agencies/${ccn}/history`);
  return response.data;
};

/**
 * Search home health agencies
 */
export const searchHomeHealthAgencies = async (params = {}) => {
  const response = await apiService.get(`${HH_BASE}/search`, { params });
  return response.data;
};

/**
 * Get state benchmark data
 */
export const getStateBenchmark = async (state) => {
  const response = await apiService.get(`${HH_BASE}/benchmarks/state/${state}`);
  return response.data;
};

/**
 * Get national benchmark data
 */
export const getNationalBenchmark = async () => {
  const response = await apiService.get(`${HH_BASE}/benchmarks/national`);
  return response.data;
};

/**
 * Compare multiple agencies
 */
export const compareAgencies = async (ccns) => {
  const ccnList = Array.isArray(ccns) ? ccns.join(',') : ccns;
  const response = await apiService.get(`${HH_BASE}/compare`, {
    params: { ccns: ccnList }
  });
  return response.data;
};

/**
 * Get recent events (rating changes, etc.)
 */
export const getRecentEvents = async (days = 30) => {
  const response = await apiService.get(`${HH_BASE}/events/recent`, {
    params: { days }
  });
  return response.data;
};

/**
 * Get agencies by state
 */
export const getAgenciesByState = async (state, limit = 100) => {
  const response = await apiService.get(`${HH_BASE}/agencies`, {
    params: { state, limit }
  });
  return response.data;
};

/**
 * Get top-rated agencies
 */
export const getTopRatedAgencies = async (state = null, limit = 10) => {
  const params = { limit, sortBy: 'quality_star_rating', sortDir: 'DESC' };
  if (state) params.state = state;
  const response = await apiService.get(`${HH_BASE}/agencies`, { params });
  return response.data;
};

/**
 * Get VBP scores for an agency
 */
export const getAgencyVBP = async (ccn) => {
  const response = await apiService.get(`${HH_BASE}/agencies/${ccn}/vbp`);
  return response.data;
};

/**
 * Get all states with agency counts
 */
export const getStatesWithCounts = async () => {
  const stats = await getHomeHealthStats();
  return stats.byState || [];
};

export default {
  getHomeHealthStats,
  getHomeHealthAgencies,
  getAgencyByCCN,
  getAgencyHistory,
  searchHomeHealthAgencies,
  getStateBenchmark,
  getNationalBenchmark,
  compareAgencies,
  getRecentEvents,
  getAgenciesByState,
  getTopRatedAgencies,
  getAgencyVBP,
  getStatesWithCounts,
};
