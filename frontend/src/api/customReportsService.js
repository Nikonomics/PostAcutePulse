/**
 * Custom Reports API Service
 *
 * API functions for the drag-and-drop report builder.
 * Handles field catalog, query execution, and saved reports CRUD.
 */

import { apiService } from './apiService';

const REPORTS_BASE = '/custom-reports';

/**
 * Get available fields catalog for the report builder
 * Returns all data sources with their fields, grouped by category
 */
export const getFieldsCatalog = async () => {
  const response = await apiService.get(`${REPORTS_BASE}/fields`);
  return response.data;
};

/**
 * Get list of available data sources
 */
export const getDataSources = async () => {
  const response = await apiService.get(`${REPORTS_BASE}/sources`);
  return response.data;
};

/**
 * Execute a report query
 * @param {Object} query - Query configuration
 * @param {string} query.source - Data source name
 * @param {Array} query.dimensions - Dimension fields with optional transforms
 * @param {Array} query.metrics - Metric fields with aggregations
 * @param {Object} query.filters - Filter conditions
 * @param {Array} query.orderBy - Order by specifications
 * @param {number} query.limit - Row limit
 */
export const executeQuery = async (query) => {
  const response = await apiService.post(`${REPORTS_BASE}/execute`, query);
  return response.data;
};

/**
 * Execute query with preview limit (100 rows)
 */
export const previewQuery = async (query) => {
  const response = await apiService.post(`${REPORTS_BASE}/preview`, query);
  return response.data;
};

/**
 * Get user's saved reports
 */
export const getReports = async () => {
  const response = await apiService.get(REPORTS_BASE);
  return response.data;
};

/**
 * Get system templates
 * @param {string} category - Optional category filter
 */
export const getTemplates = async (category = null) => {
  const params = category ? { category } : {};
  const response = await apiService.get(`${REPORTS_BASE}/templates`, params);
  return response.data;
};

/**
 * Get a single report by ID
 * @param {number} id - Report ID
 */
export const getReport = async (id) => {
  const response = await apiService.get(`${REPORTS_BASE}/${id}`);
  return response.data;
};

/**
 * Create a new report
 * @param {Object} report - Report data
 * @param {string} report.name - Report name
 * @param {string} report.description - Report description
 * @param {Object} report.configuration - Report configuration
 * @param {boolean} report.is_public - Public visibility
 */
export const createReport = async (report) => {
  const response = await apiService.post(REPORTS_BASE, report);
  return response.data;
};

/**
 * Update an existing report
 * @param {number} id - Report ID
 * @param {Object} updates - Fields to update
 */
export const updateReport = async (id, updates) => {
  const response = await apiService.put(`${REPORTS_BASE}/${id}`, updates);
  return response.data;
};

/**
 * Delete a report
 * @param {number} id - Report ID
 */
export const deleteReport = async (id) => {
  const response = await apiService.delete(`${REPORTS_BASE}/${id}`);
  return response.data;
};

/**
 * Duplicate a report
 * @param {number} id - Report ID to duplicate
 * @param {string} name - Optional new name
 */
export const duplicateReport = async (id, name = null) => {
  const response = await apiService.post(`${REPORTS_BASE}/${id}/duplicate`, { name });
  return response.data;
};
