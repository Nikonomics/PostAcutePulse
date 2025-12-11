/**
 * Deal Change Tracker Service
 * Detects and tracks field changes for audit trail
 */

// Human-readable field labels
const FIELD_LABELS = {
  // Basic Info
  deal_name: 'Deal Name',
  deal_type: 'Deal Type',
  deal_status: 'Status',
  priority_level: 'Priority Level',
  deal_source: 'Deal Source',

  // Facility Info
  facility_name: 'Facility Name',
  facility_type: 'Facility Type',
  bed_count: 'Number of Beds',
  street_address: 'Street Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  zip_code: 'Zip Code',

  // Contact Info
  primary_contact_name: 'Primary Contact Name',
  title: 'Title',
  phone_number: 'Phone Number',
  email: 'Email',

  // Timeline
  target_close_date: 'Target Close Date',
  dd_period_weeks: 'DD Period (Weeks)',

  // Financial
  purchase_price: 'Purchase Price',
  price_per_bed: 'Price Per Bed',
  down_payment: 'Down Payment',
  financing_amount: 'Financing Amount',
  annual_revenue: 'Annual Revenue',
  revenue_multiple: 'Revenue Multiple',
  ebitda: 'EBITDA',
  ebitda_multiple: 'EBITDA Multiple',
  ebitda_margin: 'EBITDA Margin',
  net_operating_income: 'Net Operating Income',

  // Operational
  current_occupancy: 'Current Occupancy',
  average_daily_rate: 'Average Daily Rate',
  medicare_percentage: 'Medicare %',
  private_pay_percentage: 'Private Pay %',

  // Investment
  target_irr_percentage: 'Target IRR %',
  target_hold_period: 'Target Hold Period',
  projected_cap_rate_percentage: 'Projected Cap Rate %',
  exit_multiple: 'Exit Multiple',

  // Team
  deal_lead_id: 'Deal Lead',
  assistant_deal_lead_id: 'Assistant Deal Lead',

  // Notifications
  email_notification_major_updates: 'Email Notifications',
  weekly_progress_report: 'Weekly Progress Report',
  slack_integration_for_team_communication: 'Slack Integration',
  calendar_integration: 'Calendar Integration',
  sms_alert_for_urgent_items: 'SMS Alerts',
  document_upload_notification: 'Document Upload Notifications'
};

// Fields to exclude from change tracking
const EXCLUDED_FIELDS = [
  'id',
  'master_deal_id',
  'user_id',
  'created_at',
  'updated_at',
  'extraction_data',
  'last_activity_at',
  'last_activity_by',
  'last_activity_type'
];

/**
 * Normalize a value for comparison
 */
function normalizeValue(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val.toString();
  if (val instanceof Date) return val.toISOString();
  return val.toString();
}

/**
 * Format a value for storage in the change log
 */
function formatValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return JSON.stringify(val);
  if (val instanceof Date) return val.toISOString();
  return val.toString();
}

/**
 * Convert field name to human-readable label
 */
function formatFieldName(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Compare old and new deal values, return array of changes
 * @param {Object} oldDeal - Original deal object
 * @param {Object} newData - New data being applied
 * @returns {Array} Array of change objects
 */
function detectChanges(oldDeal, newData) {
  const changes = [];

  for (const [field, newValue] of Object.entries(newData)) {
    // Skip excluded fields
    if (EXCLUDED_FIELDS.includes(field)) continue;

    // Skip if the field doesn't exist in the old deal (not a real field)
    if (!(field in oldDeal) && !FIELD_LABELS[field]) continue;

    const oldValue = oldDeal[field];

    // Compare normalized values
    if (normalizeValue(oldValue) !== normalizeValue(newValue)) {
      changes.push({
        field_name: field,
        field_label: FIELD_LABELS[field] || formatFieldName(field),
        old_value: formatValue(oldValue),
        new_value: formatValue(newValue)
      });
    }
  }

  return changes;
}

/**
 * Format changes into a human-readable summary
 * @param {Array} changes - Array of change objects
 * @param {number} maxFields - Maximum number of fields to show
 * @returns {string} Summary string like "Deal Name, Purchase Price, and 3 more"
 */
function formatChangeSummary(changes, maxFields = 3) {
  if (changes.length === 0) return null;

  const fieldLabels = changes.map(c => c.field_label);

  if (fieldLabels.length <= maxFields) {
    return fieldLabels.join(', ');
  }

  const shown = fieldLabels.slice(0, maxFields).join(', ');
  const remaining = fieldLabels.length - maxFields;
  return `${shown} and ${remaining} more field${remaining > 1 ? 's' : ''}`;
}

module.exports = {
  detectChanges,
  formatChangeSummary,
  FIELD_LABELS,
  EXCLUDED_FIELDS
};
