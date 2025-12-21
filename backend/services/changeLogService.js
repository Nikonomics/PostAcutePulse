/**
 * Change Log Service
 * Generic service for logging changes across different entities
 */

const db = require('../models');

// Field label mappings for human-readable display
const FIELD_LABELS = {
  // User fields
  first_name: 'First Name',
  last_name: 'Last Name',
  phone_number: 'Phone Number',
  department: 'Department',
  profile_url: 'Profile Photo',
  role: 'Role',
  status: 'Account Status',
  email: 'Email',

  // Facility fields
  facility_name: 'Facility Name',
  facility_type: 'Facility Type',
  bed_count: 'Bed Count',
  total_beds: 'Total Beds',
  street_address: 'Street Address',
  city: 'City',
  state: 'State',
  zip_code: 'ZIP Code',
  purchase_price: 'Purchase Price',
  annual_revenue: 'Annual Revenue',
  ebitda: 'EBITDA',
  ebitdar: 'EBITDAR',
  net_operating_income: 'Net Operating Income',
  current_occupancy: 'Current Occupancy',
  medicare_percentage: 'Medicare %',
  medicaid_percentage: 'Medicaid %',
  private_pay_percentage: 'Private Pay %',

  // Deal fields (already tracked but including for completeness)
  deal_name: 'Deal Name',
  deal_status: 'Deal Status',
  target_close_date: 'Target Close Date'
};

/**
 * Detect changes between two objects
 * @param {Object} oldData - Previous state
 * @param {Object} newData - New state
 * @param {Array} fieldsToTrack - Optional list of fields to track (tracks all if not provided)
 * @returns {Array} Array of changes with field_name, old_value, new_value
 */
function detectChanges(oldData, newData, fieldsToTrack = null) {
  const changes = [];
  const fields = fieldsToTrack || Object.keys(newData);

  for (const field of fields) {
    const oldValue = oldData?.[field];
    const newValue = newData?.[field];

    // Skip if both are null/undefined or equal
    if (oldValue === newValue) continue;
    if (oldValue == null && newValue == null) continue;

    // Convert to comparable strings
    const oldStr = oldValue != null ? String(oldValue) : null;
    const newStr = newValue != null ? String(newValue) : null;

    if (oldStr !== newStr) {
      changes.push({
        field_name: field,
        field_label: FIELD_LABELS[field] || formatFieldName(field),
        old_value: oldStr,
        new_value: newStr
      });
    }
  }

  return changes;
}

/**
 * Format field name to human-readable label
 * @param {string} fieldName - Field name in snake_case
 * @returns {string} Human-readable label
 */
function formatFieldName(fieldName) {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Log user profile changes
 * @param {number} userId - The user whose profile was changed
 * @param {number} changedByUserId - The user who made the change
 * @param {string} changeType - Type of change (profile_updated, password_changed, etc.)
 * @param {Array} changes - Array of change objects from detectChanges
 * @param {Object} metadata - Optional additional metadata
 */
async function logUserChanges(userId, changedByUserId, changeType, changes, metadata = null) {
  try {
    const logs = changes.map(change => ({
      user_id: userId,
      changed_by_user_id: changedByUserId,
      change_type: changeType,
      field_name: change.field_name,
      field_label: change.field_label,
      old_value: change.old_value,
      new_value: change.new_value,
      metadata: metadata
    }));

    if (logs.length > 0) {
      await db.user_change_logs.bulkCreate(logs);
      console.log(`[ChangeLog] Logged ${logs.length} user profile changes for user ${userId}`);
    }

    return logs;
  } catch (error) {
    console.error('[ChangeLog] Failed to log user changes:', error);
    throw error;
  }
}

/**
 * Log facility changes
 * @param {number} facilityId - The facility that was changed
 * @param {number} dealId - The deal this facility belongs to
 * @param {number} userId - The user who made the change
 * @param {string} changeType - Type of change
 * @param {Array} changes - Array of change objects from detectChanges
 * @param {Object} metadata - Optional additional metadata
 */
async function logFacilityChanges(facilityId, dealId, userId, changeType, changes, metadata = null) {
  try {
    const logs = changes.map(change => ({
      facility_id: facilityId,
      deal_id: dealId,
      user_id: userId,
      change_type: changeType,
      field_name: change.field_name,
      field_label: change.field_label,
      old_value: change.old_value,
      new_value: change.new_value,
      metadata: metadata
    }));

    if (logs.length > 0) {
      await db.facility_change_logs.bulkCreate(logs);
      console.log(`[ChangeLog] Logged ${logs.length} facility changes for facility ${facilityId}`);
    }

    return logs;
  } catch (error) {
    console.error('[ChangeLog] Failed to log facility changes:', error);
    throw error;
  }
}

/**
 * Get user change history
 * @param {number} userId - The user to get history for
 * @param {Object} options - Pagination options
 * @returns {Object} { logs, total }
 */
async function getUserChangeHistory(userId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  try {
    const { count, rows } = await db.user_change_logs.findAndCountAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: db.users,
          as: 'changedBy',
          attributes: ['id', 'first_name', 'last_name', 'profile_url']
        }
      ]
    });

    return { logs: rows, total: count };
  } catch (error) {
    console.error('[ChangeLog] Failed to get user change history:', error);
    throw error;
  }
}

/**
 * Get facility change history
 * @param {number} facilityId - The facility to get history for
 * @param {Object} options - Pagination options
 * @returns {Object} { logs, total }
 */
async function getFacilityChangeHistory(facilityId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  try {
    const { count, rows } = await db.facility_change_logs.findAndCountAll({
      where: { facility_id: facilityId },
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: db.users,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'profile_url']
        }
      ]
    });

    return { logs: rows, total: count };
  } catch (error) {
    console.error('[ChangeLog] Failed to get facility change history:', error);
    throw error;
  }
}

module.exports = {
  detectChanges,
  formatFieldName,
  logUserChanges,
  logFacilityChanges,
  getUserChangeHistory,
  getFacilityChangeHistory,
  FIELD_LABELS
};
