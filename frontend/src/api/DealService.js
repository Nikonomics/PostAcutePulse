import { apiService } from "./apiService";
import apiRoutes from "./apiRoutes"; // Add your route string here if needed

export const createDeal = async (payload) => {
  const response = await apiService.post(`${apiRoutes.createDeal}`, payload);
  return response.data;
};

// Create multiple deals with a single address
export const createBatchDeals = async (payload) => {
  // payload should have structure: { address: {...}, deals: [...] }
  const response = await apiService.post(`${apiRoutes.createDeal}`, payload);
  return response.data;
};

export const getDeals = async (search, status, type, page) => {
  const response = await apiService.get(
    `${apiRoutes.getDeals}?search=${search}&status=${status}&type=${type}&page=${page}`
  );
  return response.data;
};

export const getDealStats = async () => {
  const response = await apiService.get(`${apiRoutes.getDealStats}`);
  return response.data;
};

export const getDashboardData = async () => {
  const response = await apiService.get(`${apiRoutes.getDashboardData}`);
  return response.data;
};

export const getRecentActivity = async () => {
  const response = await apiService.get(`${apiRoutes.getRecentActivity}`);
  return response.data;
};

export const getTeamRecentActivity = async () => {
  const response = await apiService.get(`${apiRoutes.getTeamRecentActivity}`);
  return response.data;
};

export const getDealById = async (id) => {
  const response = await apiService.get(`${apiRoutes.getDealById}?id=${id}`);
  return response.data;
};

export const updateDeal = async (payload) => {
  const response = await apiService.post(`${apiRoutes.updateDeal}`, payload);
  return response.data;
};

export const updateExtractionData = async (dealId, extractionData) => {
  const response = await apiService.put(
    `${apiRoutes.updateExtractionData}/${dealId}/extraction-data`,
    { extraction_data: extractionData }
  );
  return response.data;
};

export const deleteDeal = async (id) => {
  const response = await apiService.delete(`${apiRoutes.deleteDeal}/${id}`);
  return response.data;
};

export const bulkDeleteDeals = async (ids) => {
  const response = await apiService.post(apiRoutes.bulkDeleteDeals, { ids });
  return response.data;
};

export const formatSimpleDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const updateDealStatus = async (payload) => {
  const response = await apiService.put(
    `${apiRoutes.updateDealStatus}`,
    payload
  );
  return response.data;
};

export const addDealComment = async (payload) => {
  const response = await apiService.post(
    `${apiRoutes.addDealComment}`,
    payload
  );
  return response.data;
};

export const deleteDealComment = async (id) => {
  const response = await apiService.delete(
    `${apiRoutes.deleteDealComment}/${id}`
  );
  return response.data;
};

export const getDealComments = async (id) => {
  const response = await apiService.get(
    `${apiRoutes.getDealComments}?deal_id=${id}`
  );
  return response.data;
};

export const addDealDocument = async (payload) => {
  const response = await apiService.post(
    `${apiRoutes.addDealDocument}`,
    payload
  );
  return response.data;
};

export const getDealDocuments = async (id) => {
  const response = await apiService.get(
    `${apiRoutes.getDealDocuments}?deal_id=${id}`
  );
  return response.data;
};

export const deleteDealDocument = async (id) => {
  const response = await apiService.delete(
    `${apiRoutes.deleteDealDocument}/${id}`
  );
  return response.data;
};

// export const updateDealPosition = async (id, position) => {
//   const response = await apiService.put(`${apiRoutes.updateDealPosition.replace(':id', id)}`, { position });
//   return response.data;
// };

export const updateDealPositions = async (deals) => {
  const response = await apiService.put(`${apiRoutes.updateDealPosition}`, {
    deals,
  });
  return response.data;
};

export const getDealsBySearch = async (search, page, limit) => {
  const response = await apiService.get(
    `${apiRoutes.getDealsBySearch}?search=${search}&page=${page}&limit=${limit}`
  );
  return response.data;
};

export const getMasterDeals = async (search, page, limit) => {
  const response = await apiService.get(
    `${apiRoutes.masterDeals}?search=${search}&page=${page}&limit=${limit}`
  );
  return response.data;
};

export const getMasterDealById = async (id) => {
  const response = await apiService.get(
    `${apiRoutes.getMasterDealById}?id=${id}`
  );
  return response.data;
};

export const updateBatchDeals = async (payload) => {
  const response = await apiService.post(
    `${apiRoutes.updateBatchDeals}`,
    payload
  );
  return response.data;
};

export const deleteMasterDeal = async (id) => {
  const response = await apiService.delete(
    `${apiRoutes.deleteMasterDeal}/${id}`
  );
  return response.data;
};

/**
 * Get facility locations for the dashboard map
 * @param {Object} filters - Filter options
 * @param {string[]} filters.status - Status filter (pipeline, due_diligence, hold, current_operations)
 * @param {string[]} filters.serviceLine - Service line filter (SNF, ALF, ILF, Home Office)
 * @param {string[]} filters.company - Company filter
 * @param {string[]} filters.team - Team filter
 */
export const getSampleLocations = async (filters = {}) => {
  let url = apiRoutes.getSampleLocations;
  const params = new URLSearchParams();

  // Handle legacy format (array of statuses passed directly)
  if (Array.isArray(filters)) {
    filters.forEach(status => params.append('status', status));
  } else if (typeof filters === 'string') {
    params.append('status', filters);
  } else if (filters && typeof filters === 'object') {
    // New format with filter object
    if (filters.status?.length) {
      filters.status.forEach(s => params.append('status', s));
    }
    if (filters.serviceLine?.length) {
      filters.serviceLine.forEach(s => params.append('service_line', s));
    }
    if (filters.company?.length) {
      filters.company.forEach(c => params.append('company', c));
    }
    if (filters.team?.length) {
      filters.team.forEach(t => params.append('team', t));
    }
  }

  const queryString = params.toString();
  if (queryString) {
    url = `${url}?${queryString}`;
  }

  const response = await apiService.get(url);
  return response.data;
};

/**
 * Get available filter options for the map
 */
export const getMapFilterOptions = async () => {
  const response = await apiService.get(apiRoutes.getMapFilterOptions);
  return response.data;
};

/**
 * Extract deal information from uploaded document(s) using AI
 * @param {File|File[]} files - Single file or array of files to process
 * @returns {Promise} - Extracted deal data
 */
export const extractDealFromDocument = async (files) => {
  const formData = new FormData();

  // Handle single file or multiple files
  if (Array.isArray(files)) {
    files.forEach((file) => {
      formData.append('document', file);
    });
  } else {
    formData.append('document', files);
  }

  const response = await apiService.post(
    `${apiRoutes.extractDealFromDocument}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Extract deal information using enhanced parallel extraction
 * Runs 5 focused AI calls in parallel for faster, more comprehensive extraction
 * @param {File|File[]} files - Single file or array of files to process
 * @returns {Promise} - Extracted data including:
 *   - extractedData: Flat summary for backward compatibility
 *   - monthlyFinancials: Time-series financial data
 *   - monthlyCensus: Time-series census data
 *   - monthlyExpenses: Expense breakdown by department
 *   - rates: Rate schedules by payer type
 *   - ratios: Calculated expense ratios
 *   - benchmarkFlags: Comparison to industry benchmarks
 *   - insights: AI-identified opportunities
 */
export const extractDealEnhanced = async (files) => {
  const formData = new FormData();

  if (Array.isArray(files)) {
    files.forEach((file) => {
      formData.append('document', file);
    });
  } else {
    formData.append('document', files);
  }

  const response = await apiService.post(
    `${apiRoutes.extractDealEnhanced}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Calculate underwriting metrics for a single deal
 * @param {number} dealId - The deal ID
 * @returns {Promise} - Calculated metrics
 */
export const calculateDealMetrics = async (dealId) => {
  const response = await apiService.get(
    `${apiRoutes.calculateDealMetrics}/${dealId}`
  );
  return response.data;
};

/**
 * Calculate portfolio-level metrics for a master deal with multiple facilities
 * @param {number} masterDealId - The master deal ID
 * @returns {Promise} - Portfolio metrics
 */
export const calculatePortfolioMetrics = async (masterDealId) => {
  const response = await apiService.get(
    `${apiRoutes.calculatePortfolioMetrics}/${masterDealId}`
  );
  return response.data;
};

// ============================================
// Deal Facilities CRUD Operations
// ============================================

/**
 * Get all facilities for a deal
 * @param {number} dealId - The deal ID
 * @returns {Promise} - Array of facilities
 */
export const getDealFacilities = async (dealId) => {
  const response = await apiService.get(
    `${apiRoutes.getDealFacilities}/${dealId}/facilities`
  );
  return response.data;
};

/**
 * Get a single facility by ID
 * @param {number} facilityId - The facility ID
 * @returns {Promise} - Facility data
 */
export const getFacilityById = async (facilityId) => {
  const response = await apiService.get(
    `${apiRoutes.getFacilityById}/${facilityId}`
  );
  return response.data;
};

/**
 * Create a new facility for a deal
 * @param {number} dealId - The deal ID
 * @param {Object} facilityData - The facility data
 * @returns {Promise} - Created facility
 */
export const createFacility = async (dealId, facilityData) => {
  const response = await apiService.post(
    `${apiRoutes.createFacility}/${dealId}/facilities`,
    facilityData
  );
  return response.data;
};

/**
 * Update an existing facility
 * @param {number} facilityId - The facility ID
 * @param {Object} facilityData - Updated facility data
 * @returns {Promise} - Updated facility
 */
export const updateFacility = async (facilityId, facilityData) => {
  const response = await apiService.put(
    `${apiRoutes.updateFacility}/${facilityId}`,
    facilityData
  );
  return response.data;
};

/**
 * Delete a facility
 * @param {number} facilityId - The facility ID
 * @returns {Promise} - Deletion result
 */
export const deleteFacility = async (facilityId) => {
  const response = await apiService.delete(
    `${apiRoutes.deleteFacility}/${facilityId}`
  );
  return response.data;
};

/**
 * Create multiple facilities for a deal at once
 * @param {number} dealId - The deal ID
 * @param {Array} facilities - Array of facility data objects
 * @returns {Promise} - Created facilities
 */
export const createBulkFacilities = async (dealId, facilities) => {
  const response = await apiService.post(
    `${apiRoutes.createBulkFacilities}/${dealId}/facilities/bulk`,
    { facilities }
  );
  return response.data;
};

/**
 * Reorder facilities for a deal
 * @param {number} dealId - The deal ID
 * @param {Array} facilityIds - Array of facility IDs in the desired order
 * @returns {Promise} - Reorder result
 */
export const reorderFacilities = async (dealId, facilityIds) => {
  const response = await apiService.put(
    `${apiRoutes.reorderFacilities}/${dealId}/facilities/reorder`,
    { facilityIds }
  );
  return response.data;
};

// ============================================
// Benchmark Configuration API
// ============================================

/**
 * Get all benchmark configurations for current user
 * @returns {Promise} - Array of configurations
 */
export const getBenchmarkConfigs = async () => {
  const response = await apiService.get(apiRoutes.benchmarks);
  return response.data;
};

/**
 * Create a new benchmark configuration
 * @param {Object} config - Benchmark configuration data
 * @returns {Promise} - Created configuration
 */
export const createBenchmarkConfig = async (config) => {
  const response = await apiService.post(apiRoutes.benchmarks, config);
  return response.data;
};

/**
 * Update an existing benchmark configuration
 * @param {number} id - Configuration ID
 * @param {Object} config - Updated configuration data
 * @returns {Promise} - Updated configuration
 */
export const updateBenchmarkConfig = async (id, config) => {
  const response = await apiService.put(
    `${apiRoutes.benchmarkById}/${id}`,
    config
  );
  return response.data;
};

/**
 * Delete a benchmark configuration
 * @param {number} id - Configuration ID
 * @returns {Promise} - Deletion result
 */
export const deleteBenchmarkConfig = async (id) => {
  const response = await apiService.delete(`${apiRoutes.benchmarkById}/${id}`);
  return response.data;
};

/**
 * Set a benchmark configuration as user's default
 * @param {number} id - Configuration ID to set as default
 * @returns {Promise} - Updated configuration
 */
export const setDefaultBenchmarkConfig = async (id) => {
  const response = await apiService.post(
    `${apiRoutes.setDefaultBenchmark}/${id}/set-default`
  );
  return response.data;
};

// ============================================
// Pro Forma Scenario API
// ============================================

/**
 * Get all pro forma scenarios for a deal
 * @param {number} dealId - The deal ID
 * @returns {Promise} - Array of scenarios
 */
export const getProformaScenarios = async (dealId) => {
  const response = await apiService.get(
    `${apiRoutes.proforma}/${dealId}/proforma`
  );
  // API returns { data: { scenarios: [...] } }
  return response.data?.data?.scenarios || response.data?.scenarios || [];
};

/**
 * Get a specific pro forma scenario with full details
 * @param {number} dealId - The deal ID
 * @param {number} scenarioId - The scenario ID
 * @returns {Promise} - Scenario with details
 */
export const getProformaScenario = async (dealId, scenarioId) => {
  const response = await apiService.get(
    `${apiRoutes.proforma}/${dealId}/proforma/${scenarioId}`
  );
  return response.data;
};

/**
 * Create a new pro forma scenario
 * @param {number} dealId - The deal ID
 * @param {Object} scenario - Scenario data { scenario_name, benchmark_overrides, notes }
 * @returns {Promise} - Created scenario with calculation results
 */
export const createProformaScenario = async (dealId, scenario) => {
  const response = await apiService.post(
    `${apiRoutes.proforma}/${dealId}/proforma`,
    scenario
  );
  return response.data;
};

/**
 * Update an existing pro forma scenario
 * @param {number} dealId - The deal ID
 * @param {number} scenarioId - The scenario ID
 * @param {Object} scenario - Updated scenario data
 * @returns {Promise} - Updated scenario with recalculated results
 */
export const updateProformaScenario = async (dealId, scenarioId, scenario) => {
  const response = await apiService.put(
    `${apiRoutes.proforma}/${dealId}/proforma/${scenarioId}`,
    scenario
  );
  return response.data;
};

/**
 * Delete a pro forma scenario
 * @param {number} dealId - The deal ID
 * @param {number} scenarioId - The scenario ID
 * @returns {Promise} - Deletion result
 */
export const deleteProformaScenario = async (dealId, scenarioId) => {
  const response = await apiService.delete(
    `${apiRoutes.proforma}/${dealId}/proforma/${scenarioId}`
  );
  return response.data;
};

/**
 * Calculate pro forma metrics WITHOUT saving (preview mode)
 * This is the main calculation endpoint for the frontend
 * @param {number} dealId - The deal ID
 * @param {Object} benchmarkOverrides - Optional benchmark overrides
 * @returns {Promise} - Calculated pro forma metrics
 *
 * Response structure:
 * {
 *   actuals: { revenue, ebitda, occupancy, labor_pct, agency_pct, ... },
 *   benchmarks: { occupancy_target, labor_pct_target, ... },
 *   variances: { occupancy, labor_pct, agency_pct, ... },
 *   opportunities: [{ category, label, value, priority }, ...],
 *   stabilized: { revenue, ebitda, ebitdar, ebitda_margin },
 *   total_opportunity: NUMBER,
 *   yearly_projections: [{ year, revenue, ebitda, progress_pct }, ...]
 * }
 */
export const calculateProforma = async (dealId, benchmarkOverrides = {}) => {
  const response = await apiService.post(
    `${apiRoutes.proformaCalculate}/${dealId}/proforma/calculate`,
    { benchmark_overrides: benchmarkOverrides }
  );
  // Backend returns {success, code, message, body} - extract body for frontend
  return response.data?.body || response.data;
};

/**
 * Re-run extraction for an existing deal using previously uploaded documents
 * This updates the deal's extraction data and generates new insights
 * @param {number} dealId - The deal ID
 * @returns {Promise} - Re-extraction result with updated data
 */
export const reExtractDeal = async (dealId) => {
  const response = await apiService.post(
    `${apiRoutes.reExtractDeal}/${dealId}/reextract`
  );
  return response.data;
};

// ============================================
// Deal Activity Tracking API
// ============================================

/**
 * Get deals list with activity tracking info (last activity, unread count)
 * @param {string} search - Search query
 * @param {string} status - Deal status filter
 * @param {string} type - Deal type filter
 * @param {number} page - Page number
 * @returns {Promise} - Deals with activity tracking info
 */
export const getDealsWithActivity = async (search = '', status = '', type = '', page = 1) => {
  const response = await apiService.get(
    `${apiRoutes.getDealsWithActivity}?search=${search}&status=${status}&type=${type}&page=${page}`
  );
  return response.data;
};

/**
 * Mark a deal as viewed by the current user
 * This resets the unread activity count for this deal/user
 * @param {number} dealId - The deal ID
 * @returns {Promise} - Mark viewed result
 */
export const markDealAsViewed = async (dealId) => {
  const response = await apiService.post(
    `${apiRoutes.markDealViewed}/${dealId}/mark-viewed`
  );
  return response.data;
};

/**
 * Get detailed change history/audit trail for a deal
 * @param {number} dealId - The deal ID
 * @param {number} page - Page number for pagination
 * @returns {Promise} - Paginated change history
 */
export const getDealChangeHistory = async (dealId, page = 1) => {
  const response = await apiService.get(
    `${apiRoutes.getDealChangeHistory}/${dealId}/change-history?page=${page}`
  );
  return response.data;
};

/**
 * Get facility matches from ALF database for a deal
 * @param {number} dealId - The deal ID
 * @returns {Promise} - Facility matches data
 */
export const getFacilityMatches = async (dealId) => {
  const response = await apiService.get(`/deal/${dealId}/facility-matches`);
  return response.data;
};

/**
 * Select a facility match for a deal
 * @param {number} dealId - The deal ID
 * @param {Object} payload - Selection payload
 * @param {string} payload.facility_id - The facility ID to select
 * @param {string} payload.action - Action: 'select' | 'skip' | 'not_sure'
 * @returns {Promise} - Result of selection
 */
export const selectFacilityMatch = async (dealId, payload) => {
  const response = await apiService.post(`/deal/${dealId}/select-facility-match`, payload);
  return response.data;
};

// ============================================
// Multi-Facility Portfolio Support API
// ============================================

/**
 * Detect facilities from document text using AI
 * This is step 1 of the portfolio workflow - identifies facility names, locations, and beds
 * @param {string} documentText - Combined text extracted from uploaded documents
 * @param {string[]} facilityTypes - Types to detect: ['SNF'], ['ALF'], or ['SNF', 'ALF']
 * @returns {Promise} - Detected facilities with confidence scores
 *
 * Response structure:
 * {
 *   detected_facilities: [
 *     { name, city, state, beds, facility_type, confidence, source_hint }
 *   ],
 *   is_portfolio: boolean,
 *   facility_count: number
 * }
 */
export const detectFacilities = async (documentText, facilityTypes = ['SNF', 'ALF']) => {
  const response = await apiService.post(apiRoutes.detectFacilities, {
    documentText,
    facilityTypes
  });
  return response.data;
};

/**
 * Match a detected facility against SNF/ALF database
 * This is step 2 - finds database records that match the detected facility
 * @param {Object} facilityInfo - Detected facility info { name, city, state, beds }
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Promise} - Top matches with scores and full facility records
 *
 * Response structure:
 * {
 *   matches: [
 *     {
 *       ...full facility record...,
 *       match_scores: { name, city, beds, address },
 *       weighted_score: number,
 *       match_confidence: 'high' | 'medium' | 'low'
 *     }
 *   ],
 *   best_match_confidence: 'high' | 'medium' | 'low' | 'none'
 * }
 */
export const matchFacility = async (facilityInfo, facilityType) => {
  const response = await apiService.post(apiRoutes.matchFacility, {
    facilityInfo,
    facilityType
  });
  return response.data;
};

/**
 * Search facilities by name in database
 * For manual facility lookup when auto-match doesn't find the right one
 * @param {string} searchTerm - Facility name to search for (min 2 chars)
 * @param {string} facilityType - 'SNF', 'ALF', or 'both'
 * @param {string} state - Optional state filter (e.g., 'WY')
 * @returns {Promise} - Search results with full facility records
 */
export const searchFacilities = async (searchTerm, facilityType, state = null) => {
  const params = { searchTerm, facilityType };
  if (state) params.state = state;

  const response = await apiService.get(apiRoutes.searchFacilities, { params });
  return response.data;
};

/**
 * Search facilities for matching against database
 * Used in manual facility entry to find potential matches
 * @param {Object} criteria - Search criteria
 * @param {string} criteria.name - Facility name
 * @param {string} criteria.address - Street address
 * @param {string} criteria.city - City
 * @param {string} criteria.state - State abbreviation
 * @param {string} criteria.zip - Zip code
 * @param {string} criteria.facility_type - SNF, ALF, ILF, or Other
 * @returns {Promise} - Matching facilities
 */
export const searchFacilitiesForMatch = async (criteria) => {
  const response = await apiService.post(apiRoutes.matchFacility, {
    facility_name: criteria.name,
    city: criteria.city,
    state: criteria.state,
    facility_type: criteria.facility_type,
  });
  return response.data;
};

/**
 * Extract portfolio deal with confirmed facilities
 * Final step - runs AI extraction with knowledge of which facilities to extract for
 * @param {File[]} files - Array of uploaded document files
 * @param {Object[]} confirmedFacilities - Array of confirmed facility objects
 * @returns {Promise} - Extraction result with per-facility data
 *
 * confirmedFacilities structure:
 * [
 *   {
 *     detected: { name, city, state, beds },
 *     matched: { ...full database record... } | null,
 *     match_source: 'snf_facilities' | 'alf_facilities' | null,
 *     user_confirmed: true,
 *     manual_entry: false
 *   }
 * ]
 *
 * Response structure:
 * {
 *   deal: {
 *     id: number,
 *     is_portfolio_deal: boolean,
 *     facility_count: number,
 *     facilities: [...merged facility data...],
 *     portfolio_summary: { ...aggregated metrics... },
 *     extraction_data: { ...full extraction result... }
 *   }
 * }
 */
export const extractPortfolio = async (files, confirmedFacilities, dealName = null) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('documents', file);
  });
  formData.append('confirmedFacilities', JSON.stringify(confirmedFacilities));
  if (dealName) {
    formData.append('deal_name', dealName);
  }

  const response = await apiService.post(apiRoutes.extractPortfolio, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Get facility database statistics
 * Returns counts and metadata for SNF and ALF databases
 * @returns {Promise} - Database stats
 *
 * Response structure:
 * {
 *   snf: { count, state_coverage, last_updated, source },
 *   alf: { count, state_coverage, last_updated, source }
 * }
 */
export const getFacilityDbStats = async () => {
  const response = await apiService.get(apiRoutes.facilityDbStats);
  return response.data;
};

/**
 * Batch match multiple facilities against database
 * Convenience function that calls matchFacility for each detected facility
 * @param {Object[]} detectedFacilities - Array from detectFacilities response
 * @returns {Promise} - Array of match results
 */
export const batchMatchFacilities = async (detectedFacilities) => {
  const results = await Promise.all(
    detectedFacilities.map(async (facility) => {
      try {
        const matchResult = await matchFacility(
          {
            name: facility.name,
            city: facility.city,
            state: facility.state,
            beds: facility.beds
          },
          facility.facility_type || 'SNF'
        );
        return {
          detected: facility,
          matches: matchResult.body?.matches || [],
          best_match_confidence: matchResult.body?.best_match_confidence || 'none',
          error: null
        };
      } catch (error) {
        return {
          detected: facility,
          matches: [],
          best_match_confidence: 'none',
          error: error.message
        };
      }
    })
  );
  return results;
};

/**
 * Extract text from uploaded documents (no AI processing)
 * Lightweight endpoint for portfolio detection workflow
 * @param {File[]} files - Array of uploaded document files
 * @returns {Promise} - Extracted text and file details
 *
 * Response structure:
 * {
 *   combined_text: string,
 *   total_characters: number,
 *   files_processed: number,
 *   files_successful: number,
 *   file_details: [{ name, success, characters, error }]
 * }
 */
export const extractDocumentText = async (files) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('documents', file);
  });

  const response = await apiService.post(apiRoutes.extractDocumentText, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};