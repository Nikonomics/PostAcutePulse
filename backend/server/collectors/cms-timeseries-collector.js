/**
 * CMS Time-Series Collector
 *
 * Downloads historical CMS Provider Info data and populates:
 * - cms_extracts: Tracking which monthly files have been imported
 * - facility_snapshots: Point-in-time data for each facility per month
 * - facility_events: Detected changes (ownership changes, rating changes, etc.)
 *
 * CMS publishes monthly Provider Info files that can be used to track
 * ownership changes, rating changes, and other facility metrics over time.
 *
 * Data Source: CMS Provider Information dataset
 * URL Pattern: https://data.cms.gov/provider-data/dataset/4pq5-n9py
 * Archive URL: https://data.cms.gov/provider-data/archived-data/nursing-homes
 */

const axios = require('axios');
const { Pool } = require('pg');
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

// Database connection - always use SSL for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CMS Data URLs
const CMS_PROVIDER_INFO_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0';
const CMS_ARCHIVE_BASE = 'https://data.cms.gov/provider-data/sites/default/files/archive/';

// Column mappings from CMS API to our database schema
// These match the actual CMS API field names (snake_case)
const CMS_API_COLUMN_MAPPINGS = {
  'cms_certification_number_ccn': 'ccn',
  'provider_name': 'provider_name',
  'provider_address': 'address',
  'citytown': 'city',
  'state': 'state',
  'zip_code': 'zip_code',
  'countyparish': 'county',
  'telephone_number': 'phone',
  'latitude': 'latitude',
  'longitude': 'longitude',
  'ownership_type': 'ownership_type',
  'provider_type': 'provider_type',
  'number_of_certified_beds': 'certified_beds',
  'average_number_of_residents_per_day': 'average_residents_per_day',
  'provider_resides_in_hospital': 'is_hospital_based',
  'legal_business_name': 'legal_business_name',
  'date_first_approved_to_provide_medicare_and_medicaid_services': 'date_first_approved',

  // Chain Information
  'chain_name': 'chain_name',
  'chain_id': 'chain_id',
  'number_of_facilities_in_chain': 'facilities_in_chain',
  'chain_average_overall_5star_rating': 'chain_avg_overall_rating',
  'chain_average_health_inspection_rating': 'chain_avg_health_rating',
  'chain_average_staffing_rating': 'chain_avg_staffing_rating',
  'chain_average_qm_rating': 'chain_avg_qm_rating',

  // Special Designations
  'with_a_resident_and_family_council': 'has_resident_family_council',
  'automatic_sprinkler_systems_in_all_required_areas': 'has_sprinkler_system',
  'abuse_icon': 'has_abuse_icon',
  'special_focus_status': 'special_focus_status',
  'continuing_care_retirement_community': 'is_ccrc',
  'provider_changed_ownership_in_last_12_months': 'has_recent_ownership_change',

  // Star Ratings
  'overall_rating': 'overall_rating',
  'health_inspection_rating': 'health_inspection_rating',
  'qm_rating': 'qm_rating',
  'longstay_qm_rating': 'long_stay_qm_rating',
  'shortstay_qm_rating': 'short_stay_qm_rating',
  'staffing_rating': 'staffing_rating',

  // Staffing
  'reported_nurse_aide_staffing_hours_per_resident_per_day': 'reported_na_hrs',
  'reported_lpn_staffing_hours_per_resident_per_day': 'reported_lpn_hrs',
  'reported_rn_staffing_hours_per_resident_per_day': 'reported_rn_hrs',
  'reported_licensed_staffing_hours_per_resident_per_day': 'reported_licensed_hrs',
  'reported_total_nurse_staffing_hours_per_resident_per_day': 'reported_total_nurse_hrs',
  'total_number_of_nurse_staff_hours_per_resident_per_day_on_t_4a14': 'weekend_total_nurse_hrs',
  'registered_nurse_hours_per_resident_per_day_on_the_weekend': 'weekend_rn_hrs',
  'reported_physical_therapist_staffing_hours_per_resident_per_day': 'reported_pt_hrs',

  // Case-Mix Adjusted Staffing
  'nursing_casemix_index': 'case_mix_index',
  'casemix_nurse_aide_staffing_hours_per_resident_per_day': 'adjusted_na_hrs',
  'casemix_lpn_staffing_hours_per_resident_per_day': 'adjusted_lpn_hrs',
  'casemix_rn_staffing_hours_per_resident_per_day': 'adjusted_rn_hrs',
  'casemix_total_nurse_staffing_hours_per_resident_per_day': 'adjusted_total_nurse_hrs',

  // Turnover
  'total_nursing_staff_turnover': 'total_nursing_turnover',
  'registered_nurse_turnover': 'rn_turnover',
  'number_of_administrators_who_have_left_the_nursing_home': 'administrator_departures',

  // Survey/Inspection - Cycle 1
  'rating_cycle_1_standard_survey_health_date': 'cycle1_survey_date',
  'rating_cycle_1_total_number_of_health_deficiencies': 'cycle1_total_health_deficiencies',
  'rating_cycle_1_number_of_standard_health_deficiencies': 'cycle1_standard_deficiencies',
  'rating_cycle_1_number_of_complaint_health_deficiencies': 'cycle1_complaint_deficiencies',
  'rating_cycle_1_health_deficiency_score': 'cycle1_deficiency_score',
  'rating_cycle_1_number_of_health_revisits': 'cycle1_revisit_count',
  'rating_cycle_1_health_revisit_score': 'cycle1_revisit_score',
  'rating_cycle_1_total_health_score': 'cycle1_total_score',

  // Survey/Inspection - Cycle 2/3
  'rating_cycle_2_standard_health_survey_date': 'cycle2_survey_date',
  'rating_cycle_23_total_number_of_health_deficiencies': 'cycle2_total_health_deficiencies',
  'rating_cycle_2_number_of_standard_health_deficiencies': 'cycle2_standard_deficiencies',
  'rating_cycle_23_number_of_complaint_health_deficiencies': 'cycle2_complaint_deficiencies',
  'rating_cycle_23_health_deficiency_score': 'cycle2_deficiency_score',
  'rating_cycle_23_number_of_health_revisits': 'cycle2_revisit_count',
  'rating_cycle_23_health_revisit_score': 'cycle2_revisit_score',
  'rating_cycle_23_total_health_score': 'cycle2_total_score',

  // Survey weighted score
  'total_weighted_health_survey_score': 'total_weighted_health_score',

  // Incidents & Complaints
  'number_of_facility_reported_incidents': 'facility_reported_incidents',
  'number_of_substantiated_complaints': 'substantiated_complaints',
  'number_of_citations_from_infection_control_inspections': 'infection_control_citations',

  // Penalties
  'number_of_fines': 'fine_count',
  'total_amount_of_fines_in_dollars': 'fine_total_dollars',
  'number_of_payment_denials': 'payment_denial_count',
  'total_number_of_penalties': 'total_penalty_count',

  // Footnotes
  'overall_rating_footnote': 'overall_rating_fn',
  'health_inspection_rating_footnote': 'health_rating_fn',
  'qm_rating_footnote': 'qm_rating_fn',
  'staffing_rating_footnote': 'staffing_rating_fn',

  // Processing date
  'processing_date': 'cms_processing_date'
};

// Also keep CSV column mappings for historical file imports
const CMS_COLUMN_MAPPINGS = {
  'Federal Provider Number': 'ccn',
  'Provider Name': 'provider_name',
  'Provider Address': 'address',
  'Provider City': 'city',
  'Provider State': 'state',
  'Provider Zip Code': 'zip_code',
  'Provider County Name': 'county',
  'Provider Phone Number': 'phone',
  'Location': 'location', // Contains lat/lng
  'Ownership Type': 'ownership_type',
  'Provider Type': 'provider_type',
  'Number of Certified Beds': 'certified_beds',
  'Average Number of Residents per Day': 'average_residents_per_day',
  'Provider Resides in Hospital': 'is_hospital_based',
  'Legal Business Name': 'legal_business_name',
  'Date First Approved to Provide Medicare and Medicaid Services': 'date_first_approved',
  'With a Resident and Family Council': 'has_resident_family_council',
  'Automatic Sprinkler Systems in All Required Areas': 'has_sprinkler_system',
  'Most Recent Health Inspection More Than 2 Years Ago': 'health_survey_outdated',
  'Abuse Icon': 'has_abuse_icon',
  'Special Focus Facility': 'special_focus_status',
  'Continuing Care Retirement Community': 'is_ccrc',
  'Changed Ownership in Last 12 Months': 'has_recent_ownership_change',
  'Overall Rating': 'overall_rating',
  'Health Inspection Rating': 'health_inspection_rating',
  'QM Rating': 'qm_rating',
  'Long-Stay QM Rating': 'long_stay_qm_rating',
  'Short-Stay QM Rating': 'short_stay_qm_rating',
  'Staffing Rating': 'staffing_rating',
  'Reported Nurse Aide Staffing Hours per Resident per Day': 'reported_na_hrs',
  'Reported LPN Staffing Hours per Resident per Day': 'reported_lpn_hrs',
  'Reported RN Staffing Hours per Resident per Day': 'reported_rn_hrs',
  'Reported Licensed Staffing Hours per Resident per Day': 'reported_licensed_hrs',
  'Reported Total Nurse Staffing Hours per Resident per Day': 'reported_total_nurse_hrs',
  'Total number of nurse staff hours per resident per day on the weekend': 'weekend_total_nurse_hrs',
  'Registered Nurse hours per resident per day on the weekend': 'weekend_rn_hrs',
  'Reported Physical Therapist Staffing Hours per Resident Per Day': 'reported_pt_hrs',
  'Case-Mix RN Staffing Hours per Resident per Day': 'adjusted_rn_hrs',
  'Case-Mix Total Nurse Staffing Hours per Resident per Day': 'adjusted_total_nurse_hrs',
  'Total nursing staff turnover': 'total_nursing_turnover',
  'Registered Nurse turnover': 'rn_turnover',
  'Number of Administrator Departures': 'administrator_departures',
  'Most Recent Health Inspection Date': 'cycle1_survey_date',
  'Number of Health Deficiencies': 'cycle1_total_health_deficiencies',
  'Date of Cycle 2 Health Inspection': 'cycle2_survey_date',
  'Cycle 2 Number of Health Deficiencies': 'cycle2_total_health_deficiencies',
  'Total Weighted Health Survey Score': 'total_weighted_health_score',
  'Number of Facility Reported Incidents': 'facility_reported_incidents',
  'Number of Substantiated Complaints': 'substantiated_complaints',
  'Number of Citations from Infection Control Inspections': 'infection_control_citations',
  'Number of Fines': 'fine_count',
  'Total Amount of Fines in Dollars': 'fine_total_dollars',
  'Number of Payment Denials': 'payment_denial_count',
  'Total Number of Penalties': 'total_penalty_count',
  'Overall Rating Footnote': 'overall_rating_fn',
  'Health Inspection Rating Footnote': 'health_rating_fn',
  'QM Rating Footnote': 'qm_rating_fn',
  'Staffing Rating Footnote': 'staffing_rating_fn',
  'Processing Date': 'cms_processing_date'
};

/**
 * Parse a CMS row into our database format
 * @param {Object} row - The raw row from CMS data
 * @param {boolean} isApiData - Whether this is from the API (true) or CSV (false)
 */
function parseRow(row, isApiData = false) {
  const result = {};
  const mappings = isApiData ? CMS_API_COLUMN_MAPPINGS : CMS_COLUMN_MAPPINGS;

  for (const [cmsCol, dbCol] of Object.entries(mappings)) {
    let value = row[cmsCol];

    if (value === undefined || value === '' || value === null) {
      result[dbCol] = null;
      continue;
    }

    // Type conversions
    const intFields = ['certified_beds', 'overall_rating', 'health_inspection_rating', 'qm_rating',
         'long_stay_qm_rating', 'short_stay_qm_rating', 'staffing_rating',
         'cycle1_total_health_deficiencies', 'cycle2_total_health_deficiencies',
         'cycle1_standard_deficiencies', 'cycle1_complaint_deficiencies', 'cycle1_revisit_count',
         'cycle2_standard_deficiencies', 'cycle2_complaint_deficiencies', 'cycle2_revisit_count',
         'facility_reported_incidents', 'substantiated_complaints', 'infection_control_citations',
         'fine_count', 'payment_denial_count', 'total_penalty_count', 'administrator_departures',
         'facilities_in_chain'];

    const floatFields = ['average_residents_per_day', 'reported_na_hrs', 'reported_lpn_hrs', 'reported_rn_hrs',
              'reported_licensed_hrs', 'reported_total_nurse_hrs', 'weekend_total_nurse_hrs',
              'weekend_rn_hrs', 'reported_pt_hrs', 'adjusted_na_hrs', 'adjusted_lpn_hrs',
              'adjusted_rn_hrs', 'adjusted_total_nurse_hrs', 'case_mix_index',
              'total_nursing_turnover', 'rn_turnover', 'total_weighted_health_score',
              'fine_total_dollars', 'cycle1_deficiency_score', 'cycle1_revisit_score', 'cycle1_total_score',
              'cycle2_deficiency_score', 'cycle2_revisit_score', 'cycle2_total_score',
              'chain_avg_overall_rating', 'chain_avg_health_rating', 'chain_avg_staffing_rating',
              'chain_avg_qm_rating', 'latitude', 'longitude'];

    if (intFields.includes(dbCol)) {
      result[dbCol] = value ? parseInt(value, 10) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else if (floatFields.includes(dbCol)) {
      result[dbCol] = value ? parseFloat(value) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else if (['is_hospital_based', 'has_resident_family_council', 'has_sprinkler_system',
              'has_abuse_icon', 'is_ccrc', 'has_recent_ownership_change'].includes(dbCol)) {
      result[dbCol] = value === 'Y' || value === 'Yes' || value === 'TRUE' || value === '1';
    }
    else if (['cycle1_survey_date', 'cycle2_survey_date', 'date_first_approved', 'cms_processing_date'].includes(dbCol)) {
      // Parse date
      if (value) {
        const date = new Date(value);
        result[dbCol] = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      } else {
        result[dbCol] = null;
      }
    }
    else if (dbCol === 'location') {
      // Parse location string like "POINT (-87.12345 41.12345)"
      if (value && typeof value === 'string') {
        const match = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        if (match) {
          result['longitude'] = parseFloat(match[1]);
          result['latitude'] = parseFloat(match[2]);
        }
      }
    }
    else if (dbCol === 'special_focus_status') {
      // Clean up SFF status
      if (value === 'Y' || value === 'Yes' || value === 'SFF') {
        result[dbCol] = 'SFF';
      } else if (value === 'SFF Candidate') {
        result[dbCol] = 'SFF_CANDIDATE';
      } else {
        result[dbCol] = null;
      }
    }
    else {
      result[dbCol] = value;
    }
  }

  // Extract chain info from ownership - CMS sometimes includes this in the Legal Business Name
  // but actual chain_name/chain_id come from a separate file

  return result;
}

/**
 * Create or get extract record for a given date
 */
async function getOrCreateExtract(extractDate, sourceFile = null) {
  const client = await pool.connect();
  try {
    // Check if extract exists
    const existing = await client.query(
      'SELECT extract_id, import_status FROM cms_extracts WHERE extract_date = $1',
      [extractDate]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new extract record
    const result = await client.query(
      `INSERT INTO cms_extracts (extract_date, source_file, import_status)
       VALUES ($1, $2, 'pending')
       RETURNING extract_id, import_status`,
      [extractDate, sourceFile]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Update extract status
 */
async function updateExtractStatus(extractId, status, recordCount = null, processingDate = null) {
  const client = await pool.connect();
  try {
    const updates = ['import_status = $2'];
    const params = [extractId, status];
    let paramIdx = 3;

    if (recordCount !== null) {
      updates.push(`record_count = $${paramIdx}`);
      params.push(recordCount);
      paramIdx++;
    }

    if (processingDate !== null) {
      updates.push(`processing_date = $${paramIdx}`);
      params.push(processingDate);
      paramIdx++;
    }

    if (status === 'importing') {
      updates.push('import_started_at = NOW()');
    } else if (status === 'completed' || status === 'failed') {
      updates.push('import_completed_at = NOW()');
    }

    await client.query(
      `UPDATE cms_extracts SET ${updates.join(', ')} WHERE extract_id = $1`,
      params
    );
  } finally {
    client.release();
  }
}

/**
 * Import facility data from a CSV file or API response
 * @param {number} extractId - The extract ID to link to
 * @param {Array} data - Array of facility records
 * @param {string} extractDate - The date of this extract
 * @param {boolean} isApiData - Whether this is from the API (true) or CSV (false)
 */
async function importFacilityData(extractId, data, extractDate, isApiData = false) {
  const client = await pool.connect();
  let recordCount = 0;
  let processingDate = null;

  try {
    await client.query('BEGIN');

    for (const row of data) {
      const parsed = parseRow(row, isApiData);

      if (!parsed.ccn || !parsed.state) {
        continue; // Skip invalid rows
      }

      // Track processing date from first valid row
      if (!processingDate && parsed.cms_processing_date) {
        processingDate = parsed.cms_processing_date;
      }

      // Insert into facility_snapshots
      await client.query(
        `INSERT INTO facility_snapshots (
          extract_id, ccn, provider_name, address, city, state, zip_code, county, phone,
          latitude, longitude, ownership_type, provider_type, certified_beds,
          average_residents_per_day, is_hospital_based, legal_business_name, date_first_approved,
          is_ccrc, special_focus_status, has_abuse_icon, has_recent_ownership_change,
          has_resident_family_council, has_sprinkler_system,
          overall_rating, health_inspection_rating, qm_rating, long_stay_qm_rating,
          short_stay_qm_rating, staffing_rating,
          reported_na_hrs, reported_lpn_hrs, reported_rn_hrs, reported_licensed_hrs,
          reported_total_nurse_hrs, weekend_total_nurse_hrs, weekend_rn_hrs, reported_pt_hrs,
          adjusted_rn_hrs, adjusted_total_nurse_hrs,
          total_nursing_turnover, rn_turnover, administrator_departures,
          cycle1_survey_date, cycle1_total_health_deficiencies,
          cycle2_survey_date, cycle2_total_health_deficiencies,
          total_weighted_health_score,
          facility_reported_incidents, substantiated_complaints, infection_control_citations,
          fine_count, fine_total_dollars, payment_denial_count, total_penalty_count,
          overall_rating_fn, health_rating_fn, qm_rating_fn, staffing_rating_fn,
          cms_processing_date
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
          $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
          $51, $52, $53, $54, $55, $56, $57, $58, $59, $60
        )
        ON CONFLICT (extract_id, ccn) DO UPDATE SET
          provider_name = EXCLUDED.provider_name,
          ownership_type = EXCLUDED.ownership_type,
          overall_rating = EXCLUDED.overall_rating
        `,
        [
          extractId, parsed.ccn, parsed.provider_name, parsed.address, parsed.city,
          parsed.state, parsed.zip_code, parsed.county, parsed.phone,
          parsed.latitude, parsed.longitude, parsed.ownership_type, parsed.provider_type,
          parsed.certified_beds, parsed.average_residents_per_day, parsed.is_hospital_based,
          parsed.legal_business_name, parsed.date_first_approved,
          parsed.is_ccrc, parsed.special_focus_status, parsed.has_abuse_icon,
          parsed.has_recent_ownership_change, parsed.has_resident_family_council,
          parsed.has_sprinkler_system,
          parsed.overall_rating, parsed.health_inspection_rating, parsed.qm_rating,
          parsed.long_stay_qm_rating, parsed.short_stay_qm_rating, parsed.staffing_rating,
          parsed.reported_na_hrs, parsed.reported_lpn_hrs, parsed.reported_rn_hrs,
          parsed.reported_licensed_hrs, parsed.reported_total_nurse_hrs,
          parsed.weekend_total_nurse_hrs, parsed.weekend_rn_hrs, parsed.reported_pt_hrs,
          parsed.adjusted_rn_hrs, parsed.adjusted_total_nurse_hrs,
          parsed.total_nursing_turnover, parsed.rn_turnover, parsed.administrator_departures,
          parsed.cycle1_survey_date, parsed.cycle1_total_health_deficiencies,
          parsed.cycle2_survey_date, parsed.cycle2_total_health_deficiencies,
          parsed.total_weighted_health_score,
          parsed.facility_reported_incidents, parsed.substantiated_complaints,
          parsed.infection_control_citations,
          parsed.fine_count, parsed.fine_total_dollars, parsed.payment_denial_count,
          parsed.total_penalty_count,
          parsed.overall_rating_fn, parsed.health_rating_fn, parsed.qm_rating_fn,
          parsed.staffing_rating_fn, parsed.cms_processing_date
        ]
      );

      recordCount++;

      if (recordCount % 1000 === 0) {
        console.log(`  Imported ${recordCount} facilities...`);
      }
    }

    await client.query('COMMIT');
    return { recordCount, processingDate };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Detect ownership changes between two extracts
 */
async function detectOwnershipChanges(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting ownership changes between extracts ${previousExtractId} and ${currentExtractId}...`);

    // Find facilities where legal_business_name changed
    const result = await client.query(`
      INSERT INTO facility_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        previous_value, new_value, state, county
      )
      SELECT
        curr.ccn,
        'OWNERSHIP_CHANGE',
        $1,
        $2,
        $3,
        prev.legal_business_name,
        curr.legal_business_name,
        curr.state,
        curr.county
      FROM facility_snapshots curr
      JOIN facility_snapshots prev ON curr.ccn = prev.ccn
      WHERE curr.extract_id = $3
        AND prev.extract_id = $2
        AND (
          curr.legal_business_name IS DISTINCT FROM prev.legal_business_name
          OR curr.ownership_type IS DISTINCT FROM prev.ownership_type
        )
        AND curr.legal_business_name IS NOT NULL
        AND prev.legal_business_name IS NOT NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} ownership changes`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Detect rating changes between two extracts
 */
async function detectRatingChanges(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting rating changes between extracts ${previousExtractId} and ${currentExtractId}...`);

    const result = await client.query(`
      INSERT INTO facility_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        previous_value, new_value, change_magnitude, state, county
      )
      SELECT
        curr.ccn,
        'RATING_CHANGE',
        $1,
        $2,
        $3,
        prev.overall_rating::text,
        curr.overall_rating::text,
        (curr.overall_rating - prev.overall_rating)::decimal,
        curr.state,
        curr.county
      FROM facility_snapshots curr
      JOIN facility_snapshots prev ON curr.ccn = prev.ccn
      WHERE curr.extract_id = $3
        AND prev.extract_id = $2
        AND curr.overall_rating IS DISTINCT FROM prev.overall_rating
        AND curr.overall_rating IS NOT NULL
        AND prev.overall_rating IS NOT NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} rating changes`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Detect new facilities (appeared in current but not previous)
 */
async function detectNewFacilities(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting new facilities in extract ${currentExtractId}...`);

    const result = await client.query(`
      INSERT INTO facility_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        new_value, state, county
      )
      SELECT
        curr.ccn,
        'FACILITY_OPENED',
        $1,
        $2,
        $3,
        curr.provider_name,
        curr.state,
        curr.county
      FROM facility_snapshots curr
      LEFT JOIN facility_snapshots prev ON curr.ccn = prev.ccn AND prev.extract_id = $2
      WHERE curr.extract_id = $3
        AND prev.ccn IS NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} new facilities`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Detect closed facilities (in previous but not current)
 */
async function detectClosedFacilities(currentExtractId, previousExtractId, extractDate) {
  const client = await pool.connect();
  try {
    console.log(`Detecting closed facilities...`);

    const result = await client.query(`
      INSERT INTO facility_events (
        ccn, event_type, event_date, previous_extract_id, current_extract_id,
        previous_value, state, county
      )
      SELECT
        prev.ccn,
        'FACILITY_CLOSED',
        $1,
        $2,
        $3,
        prev.provider_name,
        prev.state,
        prev.county
      FROM facility_snapshots prev
      LEFT JOIN facility_snapshots curr ON prev.ccn = curr.ccn AND curr.extract_id = $3
      WHERE prev.extract_id = $2
        AND curr.ccn IS NULL
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [extractDate, previousExtractId, currentExtractId]);

    console.log(`  Found ${result.rowCount} closed facilities`);
    return result.rowCount;
  } finally {
    client.release();
  }
}

/**
 * Run all event detection between two extracts
 */
async function detectAllEvents(currentExtractId, previousExtractId, extractDate) {
  let totalEvents = 0;

  totalEvents += await detectOwnershipChanges(currentExtractId, previousExtractId, extractDate);
  totalEvents += await detectRatingChanges(currentExtractId, previousExtractId, extractDate);
  totalEvents += await detectNewFacilities(currentExtractId, previousExtractId, extractDate);
  totalEvents += await detectClosedFacilities(currentExtractId, previousExtractId, extractDate);

  console.log(`Total events detected: ${totalEvents}`);
  return totalEvents;
}

/**
 * Import from current snf_facilities table as the baseline snapshot
 */
async function importCurrentSnapshot() {
  const client = await pool.connect();
  try {
    console.log('Importing current snf_facilities data as baseline snapshot...');

    // Get the CMS update date from snf_facilities
    const dateResult = await client.query(
      'SELECT last_cms_update FROM snf_facilities WHERE last_cms_update IS NOT NULL LIMIT 1'
    );

    if (dateResult.rows.length === 0) {
      throw new Error('No CMS data found in snf_facilities table');
    }

    const extractDate = dateResult.rows[0].last_cms_update;
    console.log(`Using extract date: ${extractDate}`);

    // Create or get extract record
    const extract = await getOrCreateExtract(extractDate, 'snf_facilities');

    if (extract.import_status === 'completed') {
      console.log('Baseline snapshot already imported, skipping...');
      return extract.extract_id;
    }

    await updateExtractStatus(extract.extract_id, 'importing');

    // Copy data from snf_facilities to facility_snapshots
    const result = await client.query(`
      INSERT INTO facility_snapshots (
        extract_id, ccn, provider_name, address, city, state, zip_code, county, phone,
        latitude, longitude, ownership_type, provider_type, certified_beds,
        average_residents_per_day, is_hospital_based, legal_business_name, date_first_approved,
        is_ccrc, has_abuse_icon, has_recent_ownership_change,
        overall_rating, health_inspection_rating, qm_rating, staffing_rating,
        reported_na_hrs, reported_lpn_hrs, reported_rn_hrs, reported_licensed_hrs,
        reported_total_nurse_hrs, weekend_total_nurse_hrs, weekend_rn_hrs, reported_pt_hrs,
        total_nursing_turnover, rn_turnover, administrator_departures,
        fine_count, fine_total_dollars, payment_denial_count, total_penalty_count,
        cms_processing_date
      )
      SELECT
        $1,
        federal_provider_number,
        facility_name,
        address,
        city,
        state,
        zip_code,
        county,
        phone,
        latitude,
        longitude,
        ownership_type,
        provider_type,
        certified_beds,
        NULL, -- average_residents_per_day
        NULL, -- is_hospital_based
        legal_business_name,
        date_certified,
        continuing_care_retirement_community,
        abuse_icon,
        NULL, -- has_recent_ownership_change
        overall_rating,
        health_inspection_rating,
        quality_measure_rating,
        staffing_rating,
        reported_cna_staffing_hours,
        lpn_staffing_hours,
        rn_staffing_hours,
        licensed_staffing_hours,
        total_nurse_staffing_hours,
        weekend_total_nurse_hours,
        weekend_rn_hours,
        pt_staffing_hours,
        total_nursing_turnover,
        rn_turnover,
        admin_departures,
        penalty_count,
        total_penalties_amount,
        NULL, -- payment_denial_count
        penalty_count,
        last_cms_update
      FROM snf_facilities
      WHERE active = true
      ON CONFLICT (extract_id, ccn) DO NOTHING
      RETURNING snapshot_id
    `, [extract.extract_id]);

    console.log(`Imported ${result.rowCount} facilities as baseline`);

    await updateExtractStatus(extract.extract_id, 'completed', result.rowCount, extractDate);

    return extract.extract_id;
  } finally {
    client.release();
  }
}

/**
 * Fetch CMS Provider Info data from the API
 * The CMS API accepts a POST request with limit and offset parameters
 */
async function fetchCMSProviderData(limit = 50000, offset = 0) {
  console.log(`Fetching CMS Provider data (offset: ${offset}, limit: ${limit})...`);

  try {
    // CMS API requires just limit and offset in the body
    const response = await axios.post(CMS_PROVIDER_INFO_URL, {
      limit: limit,
      offset: offset
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minute timeout for large requests
    });

    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching CMS data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data).slice(0, 500));
    }
    throw error;
  }
}

/**
 * Import latest CMS data from API
 */
async function importLatestCMSData() {
  const client = await pool.connect();
  try {
    console.log('Importing latest CMS Provider Info data...');

    // Fetch all data (CMS API limits to 1500 per request)
    let allData = [];
    let offset = 0;
    const limit = 1500;

    while (true) {
      const batch = await fetchCMSProviderData(limit, offset);
      if (batch.length === 0) break;

      allData = allData.concat(batch);
      console.log(`Fetched ${allData.length} records so far...`);

      if (batch.length < limit) break;
      offset += limit;
    }

    if (allData.length === 0) {
      console.log('No data fetched from CMS API');
      return null;
    }

    // Determine extract date from processing date (API uses snake_case)
    const firstRow = allData[0];
    let extractDate;
    if (firstRow['processing_date'] || firstRow['Processing Date']) {
      const dateStr = firstRow['processing_date'] || firstRow['Processing Date'];
      extractDate = new Date(dateStr).toISOString().split('T')[0];
    } else {
      // Use first of current month
      const now = new Date();
      extractDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    console.log(`Extract date: ${extractDate}`);

    // Create extract record
    const extract = await getOrCreateExtract(extractDate, 'CMS API');

    if (extract.import_status === 'completed') {
      console.log('This extract has already been imported');
      return extract.extract_id;
    }

    await updateExtractStatus(extract.extract_id, 'importing');

    // Import the data (pass true for isApiData since this is from the API)
    const { recordCount, processingDate } = await importFacilityData(extract.extract_id, allData, extractDate, true);

    await updateExtractStatus(extract.extract_id, 'completed', recordCount, processingDate);

    console.log(`Import completed: ${recordCount} facilities`);

    // Get previous extract for event detection
    const prevResult = await client.query(`
      SELECT extract_id, extract_date
      FROM cms_extracts
      WHERE extract_date < $1 AND import_status = 'completed'
      ORDER BY extract_date DESC
      LIMIT 1
    `, [extractDate]);

    if (prevResult.rows.length > 0) {
      const prevExtract = prevResult.rows[0];
      console.log(`Detecting events against previous extract (${prevExtract.extract_date})...`);
      await detectAllEvents(extract.extract_id, prevExtract.extract_id, extractDate);
    }

    return extract.extract_id;
  } finally {
    client.release();
  }
}

/**
 * Import from a CSV file (for archived data)
 */
async function importFromCSV(filePath, extractDate) {
  console.log(`Importing from CSV: ${filePath}`);

  const extract = await getOrCreateExtract(extractDate, path.basename(filePath));

  if (extract.import_status === 'completed') {
    console.log('This extract has already been imported');
    return extract.extract_id;
  }

  await updateExtractStatus(extract.extract_id, 'importing');

  // Parse CSV
  const data = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', async () => {
        try {
          const { recordCount, processingDate } = await importFacilityData(extract.extract_id, data, extractDate);
          await updateExtractStatus(extract.extract_id, 'completed', recordCount, processingDate);

          console.log(`Import completed: ${recordCount} facilities`);
          resolve(extract.extract_id);
        } catch (error) {
          await updateExtractStatus(extract.extract_id, 'failed');
          reject(error);
        }
      })
      .on('error', async (error) => {
        await updateExtractStatus(extract.extract_id, 'failed');
        reject(error);
      });
  });
}

/**
 * Get ownership change summary
 */
async function getOwnershipChangeSummary(months = 12) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        DATE_TRUNC('month', event_date) as month,
        COUNT(*) as change_count,
        COUNT(DISTINCT state) as states_affected
      FROM facility_events
      WHERE event_type = 'OWNERSHIP_CHANGE'
        AND event_date >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', event_date)
      ORDER BY month DESC
    `);

    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('CMS Time-Series Collector');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case 'baseline':
        // Import current snf_facilities as baseline
        await importCurrentSnapshot();
        break;

      case 'latest':
        // Fetch and import latest from CMS API
        await importLatestCMSData();
        break;

      case 'csv':
        // Import from CSV file
        const csvPath = args[1];
        const csvDate = args[2];
        if (!csvPath || !csvDate) {
          console.log('Usage: node cms-timeseries-collector.js csv <file.csv> <YYYY-MM-DD>');
          break;
        }
        await importFromCSV(csvPath, csvDate);
        break;

      case 'detect':
        // Detect events between two extracts
        const currId = parseInt(args[1]);
        const prevId = parseInt(args[2]);
        const eventDate = args[3];
        if (!currId || !prevId || !eventDate) {
          console.log('Usage: node cms-timeseries-collector.js detect <current_extract_id> <previous_extract_id> <date>');
          break;
        }
        await detectAllEvents(currId, prevId, eventDate);
        break;

      case 'summary':
        // Show ownership change summary
        const summary = await getOwnershipChangeSummary();
        console.log('\nOwnership Changes by Month:');
        console.table(summary);
        break;

      case 'help':
      default:
        console.log(`
Usage: node cms-timeseries-collector.js <command> [options]

Commands:
  baseline              Import current snf_facilities as baseline snapshot
  latest                Fetch and import latest data from CMS API
  csv <file> <date>     Import from CSV file with extract date (YYYY-MM-DD)
  detect <cur> <prev> <date>  Detect events between two extracts
  summary               Show ownership change summary

Examples:
  node cms-timeseries-collector.js baseline
  node cms-timeseries-collector.js latest
  node cms-timeseries-collector.js csv ./data/provider_info_oct_2024.csv 2024-10-01
  node cms-timeseries-collector.js summary
        `);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for use as module
module.exports = {
  importCurrentSnapshot,
  importLatestCMSData,
  importFromCSV,
  detectAllEvents,
  getOwnershipChangeSummary
};

// Run if called directly
if (require.main === module) {
  main();
}
