import { apiService } from "./apiService";
import apiRoutes from "./apiRoutes";

/**
 * Get all saved items for the current user
 * @param {string} type - Optional filter: 'deal', 'facility', or 'market'
 */
export const getSavedItems = async (type = null) => {
  try {
    const params = type ? `?type=${type}` : '';
    const response = await apiService.get(`${apiRoutes.savedItems}${params}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch saved items");
  }
};

/**
 * Save a new item
 * @param {Object} payload - Item to save
 * @param {string} payload.item_type - 'deal', 'facility', or 'market'
 * @param {number} payload.deal_id - For deal items
 * @param {number} payload.deal_facility_id - For deal facility items
 * @param {string} payload.market_facility_type - 'SNF' or 'ALF' for market facilities
 * @param {number} payload.market_facility_id - For market facility items
 * @param {string} payload.market_state - For market items
 * @param {string} payload.market_county - For market items
 * @param {string} payload.market_cbsa_code - Optional for market items
 * @param {string} payload.note - Optional note
 */
export const saveItem = async (payload) => {
  try {
    const response = await apiService.post(apiRoutes.savedItems, payload);
    return response.data;
  } catch (error) {
    // Handle duplicate save gracefully
    if (error.response?.status === 409) {
      return {
        success: false,
        alreadySaved: true,
        saved_item_id: error.response.data.saved_item_id,
        message: error.response.data.message
      };
    }
    throw new Error(error.response?.data?.message || "Failed to save item");
  }
};

/**
 * Update note on a saved item
 * @param {number} id - Saved item ID
 * @param {string} note - New note content
 */
export const updateSavedItemNote = async (id, note) => {
  try {
    const response = await apiService.put(`${apiRoutes.savedItemById}/${id}`, { note });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update note");
  }
};

/**
 * Remove a saved item
 * @param {number} id - Saved item ID
 */
export const removeSavedItem = async (id) => {
  try {
    const response = await apiService.delete(`${apiRoutes.savedItemById}/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to remove saved item");
  }
};

/**
 * Bulk check if items are saved
 * @param {string} type - 'deal', 'facility', 'market', 'ownership_group', or 'cms_facility'
 * @param {Object} options - Check options
 * @param {number[]} options.ids - Array of IDs (for deals and facilities)
 * @param {Array<{state: string, county: string}>} options.markets - Array of market objects
 * @param {string[]} options.names - Array of ownership group names
 * @param {string[]} options.ccns - Array of CCNs (for cms_facility)
 */
export const checkSavedItems = async (type, options) => {
  try {
    let params = `?type=${type}`;

    if (type === 'deal' || type === 'facility') {
      if (options.ids && options.ids.length > 0) {
        params += `&ids=${options.ids.join(',')}`;
      }
    } else if (type === 'market' && options.markets) {
      params += `&markets=${encodeURIComponent(JSON.stringify(options.markets))}`;
    } else if (type === 'ownership_group' && options.names) {
      params += `&names=${encodeURIComponent(JSON.stringify(options.names))}`;
    }

    const response = await apiService.get(`${apiRoutes.checkSavedItems}${params}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to check saved items");
  }
};

/**
 * Save a deal
 * @param {number} dealId - Deal ID to save
 * @param {string} note - Optional note
 */
export const saveDeal = async (dealId, note = null) => {
  return saveItem({
    item_type: 'deal',
    deal_id: dealId,
    note
  });
};

/**
 * Save a deal facility
 * @param {number} facilityId - Deal facility ID to save
 * @param {string} note - Optional note
 */
export const saveDealFacility = async (facilityId, note = null) => {
  return saveItem({
    item_type: 'facility',
    deal_facility_id: facilityId,
    note
  });
};

/**
 * Save a market facility (from SNF/ALF database)
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @param {number} facilityId - Facility ID from market database
 * @param {string} note - Optional note
 */
export const saveMarketFacility = async (facilityType, facilityId, note = null) => {
  return saveItem({
    item_type: 'facility',
    market_facility_type: facilityType,
    market_facility_id: facilityId,
    note
  });
};

/**
 * Save a market (state/county)
 * @param {string} state - State code (e.g., 'CA')
 * @param {string} county - County name
 * @param {string} cbsaCode - Optional CBSA code
 * @param {string} note - Optional note
 */
export const saveMarket = async (state, county, cbsaCode = null, note = null) => {
  return saveItem({
    item_type: 'market',
    market_state: state,
    market_county: county,
    market_cbsa_code: cbsaCode,
    note
  });
};

/**
 * Save an ownership group/chain
 * @param {string} ownershipGroupName - The name of the ownership group/chain
 * @param {string} note - Optional note
 */
export const saveOwnershipGroup = async (ownershipGroupName, note = null) => {
  return saveItem({
    item_type: 'ownership_group',
    ownership_group_name: ownershipGroupName,
    note
  });
};

/**
 * Save a CMS facility by CCN
 * @param {string} ccn - CMS Certification Number
 * @param {string} facilityName - Facility name for display
 * @param {string} note - Optional note
 */
export const saveFacility = async (ccn, facilityName, note = null) => {
  return saveItem({
    item_type: 'cms_facility',
    ccn: ccn,
    facility_name: facilityName,
    note
  });
};

/**
 * Get user's activity feed
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of items to fetch (default 50, max 100)
 * @param {number} options.offset - Offset for pagination
 * @param {string[]} options.types - Filter by change types
 */
export const getActivityFeed = async (options = {}) => {
  try {
    const params = new URLSearchParams();

    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    if (options.types && options.types.length > 0) {
      params.append('types', options.types.join(','));
    }

    const queryString = params.toString();
    const url = queryString
      ? `${apiRoutes.userActivityFeed}?${queryString}`
      : apiRoutes.userActivityFeed;

    const response = await apiService.get(url);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch activity feed");
  }
};

/**
 * Get user's associated deals
 */
export const getAssociatedDeals = async () => {
  try {
    const response = await apiService.get(apiRoutes.userAssociatedDeals);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch associated deals");
  }
};

/**
 * Get user notifications
 */
export const getUserNotifications = async () => {
  try {
    const response = await apiService.get(apiRoutes.getUserNotifications);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch notifications");
  }
};

/**
 * Mark notifications as read
 */
export const markNotificationsRead = async () => {
  try {
    const response = await apiService.post(apiRoutes.markNotificationRead);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to mark notifications as read");
  }
};
