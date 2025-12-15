#!/usr/bin/env node
/**
 * Import CMS NH_ProviderInfo data into snf_facilities table
 *
 * Usage: node scripts/import-cms-provider-info.js <path-to-csv>
 * Example: node scripts/import-cms-provider-info.js "/path/to/NH_ProviderInfo_Nov2025.csv"
 *
 * This script:
 * - Reads the CMS NH_ProviderInfo CSV file
 * - Maps all 101 columns to database fields
 * - Upserts records based on CCN (CMS Certification Number)
 * - Handles null values and data type conversions
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Column mapping: CSV column name -> database field name
const COLUMN_MAP = {
  // Basic facility info
  'CMS Certification Number (CCN)': 'cms_certification_number',
  'Provider Name': 'facility_name',
  'Provider Address': 'address',
  'City/Town': 'city',
  'State': 'state',
  'ZIP Code': 'zip_code',
  'Telephone Number': 'phone',
  'County/Parish': 'county',
  'Urban': 'is_urban',
  'Ownership Type': 'ownership_type',
  'Number of Certified Beds': 'certified_beds',
  'Average Number of Residents per Day': 'average_residents_per_day',
  'Provider Type': 'provider_type',
  'Provider Resides in Hospital': 'in_hospital',
  'Legal Business Name': 'legal_business_name',
  'Date First Approved to Provide Medicare and Medicaid Services': 'date_certified',

  // Chain data
  'Chain Name': 'chain_name',
  'Chain ID': 'chain_id',
  'Number of Facilities in Chain': 'chain_facility_count',
  'Chain Average Overall 5-star Rating': 'chain_avg_overall_rating',
  'Chain Average Health Inspection Rating': 'chain_avg_health_rating',
  'Chain Average Staffing Rating': 'chain_avg_staffing_rating',
  'Chain Average QM Rating': 'chain_avg_qm_rating',

  // Facility flags
  'Continuing Care Retirement Community': 'continuing_care_retirement_community',
  'Special Focus Status': 'special_focus_facility',
  'Abuse Icon': 'abuse_icon',
  'Most Recent Health Inspection More Than 2 Years Ago': 'inspection_over_2yrs_ago',
  'Provider Changed Ownership in Last 12 Months': 'ownership_changed_12mo',
  'With a Resident and Family Council': 'has_resident_council',
  'Automatic Sprinkler Systems in All Required Areas': 'has_sprinkler_system',

  // Ratings
  'Overall Rating': 'overall_rating',
  'Health Inspection Rating': 'health_inspection_rating',
  'QM Rating': 'quality_measure_rating',
  'Long-Stay QM Rating': 'long_stay_qm_rating',
  'Short-Stay QM Rating': 'short_stay_qm_rating',
  'Staffing Rating': 'staffing_rating',

  // Reported Staffing Hours (per resident per day)
  'Reported Nurse Aide Staffing Hours per Resident per Day': 'reported_cna_staffing_hours',
  'Reported LPN Staffing Hours per Resident per Day': 'lpn_staffing_hours',
  'Reported RN Staffing Hours per Resident per Day': 'rn_staffing_hours',
  'Reported Licensed Staffing Hours per Resident per Day': 'licensed_staffing_hours',
  'Reported Total Nurse Staffing Hours per Resident per Day': 'total_nurse_staffing_hours',
  'Total number of nurse staff hours per resident per day on the weekend': 'weekend_total_nurse_hours',
  'Registered Nurse hours per resident per day on the weekend': 'weekend_rn_hours',
  'Reported Physical Therapist Staffing Hours per Resident Per Day': 'pt_staffing_hours',

  // Turnover
  'Total nursing staff turnover': 'total_nursing_turnover',
  'Registered Nurse turnover': 'rn_turnover',
  'Number of administrators who have left the nursing home': 'admin_departures',

  // Case-Mix Index
  'Nursing Case-Mix Index': 'nursing_case_mix_index',
  'Nursing Case-Mix Index Ratio': 'nursing_case_mix_ratio',

  // Case-Mix Adjusted Staffing
  'Case-Mix Nurse Aide Staffing Hours per Resident per Day': 'case_mix_cna_hours',
  'Case-Mix LPN Staffing Hours per Resident per Day': 'case_mix_lpn_hours',
  'Case-Mix RN Staffing Hours per Resident per Day': 'case_mix_rn_hours',
  'Case-Mix Total Nurse Staffing Hours per Resident per Day': 'case_mix_total_nurse_hours',
  'Case-Mix Weekend Total Nurse Staffing Hours per Resident per Day': 'case_mix_weekend_hours',

  // Adjusted Staffing
  'Adjusted Nurse Aide Staffing Hours per Resident per Day': 'adjusted_cna_hours',
  'Adjusted LPN Staffing Hours per Resident per Day': 'adjusted_lpn_hours',
  'Adjusted RN Staffing Hours per Resident per Day': 'adjusted_rn_hours',
  'Adjusted Total Nurse Staffing Hours per Resident per Day': 'adjusted_total_nurse_hours',
  'Adjusted Weekend Total Nurse Staffing Hours per Resident per Day': 'adjusted_weekend_hours',

  // Survey/Inspection Data
  'Rating Cycle 1 Standard Survey Health Date': 'last_health_inspection_date',
  'Rating Cycle 1 Total Number of Health Deficiencies': 'health_deficiencies',
  'Rating Cycle 1 Number of Standard Health Deficiencies': 'standard_health_deficiencies',
  'Rating Cycle 1 Number of Complaint Health Deficiencies': 'complaint_deficiencies',
  'Total Weighted Health Survey Score': 'weighted_health_score',

  // Complaints and Penalties
  'Number of Facility Reported Incidents': 'facility_reported_incidents',
  'Number of Substantiated Complaints': 'substantiated_complaints',
  'Number of Citations from Infection Control Inspections': 'infection_control_citations',
  'Number of Fines': 'fine_count',
  'Total Amount of Fines in Dollars': 'total_fines_amount',
  'Number of Payment Denials': 'payment_denial_count',
  'Total Number of Penalties': 'penalty_count',

  // Location
  'Latitude': 'latitude',
  'Longitude': 'longitude',

  // Processing date
  'Processing Date': 'cms_processing_date'
};

// Parse value based on expected type
function parseValue(value, fieldName) {
  // Handle empty/null values
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  // Boolean fields
  const booleanFields = [
    'is_urban', 'in_hospital', 'continuing_care_retirement_community',
    'special_focus_facility', 'abuse_icon', 'inspection_over_2yrs_ago',
    'ownership_changed_12mo', 'has_resident_council', 'has_sprinkler_system'
  ];

  if (booleanFields.includes(fieldName)) {
    return value === 'Y' || value === 'Yes' || value === 'TRUE' || value === true;
  }

  // Integer fields
  const integerFields = [
    'certified_beds', 'overall_rating', 'health_inspection_rating',
    'quality_measure_rating', 'long_stay_qm_rating', 'short_stay_qm_rating',
    'staffing_rating', 'admin_departures', 'chain_facility_count',
    'health_deficiencies', 'standard_health_deficiencies', 'complaint_deficiencies',
    'facility_reported_incidents', 'substantiated_complaints', 'infection_control_citations',
    'fine_count', 'payment_denial_count', 'penalty_count'
  ];

  if (integerFields.includes(fieldName)) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  // Numeric/decimal fields
  const numericFields = [
    'average_residents_per_day', 'rn_staffing_hours', 'total_nurse_staffing_hours',
    'reported_cna_staffing_hours', 'lpn_staffing_hours', 'licensed_staffing_hours',
    'pt_staffing_hours', 'weekend_total_nurse_hours', 'weekend_rn_hours',
    'total_nursing_turnover', 'rn_turnover',
    'nursing_case_mix_index', 'nursing_case_mix_ratio',
    'case_mix_cna_hours', 'case_mix_lpn_hours', 'case_mix_rn_hours',
    'case_mix_total_nurse_hours', 'case_mix_weekend_hours',
    'adjusted_cna_hours', 'adjusted_lpn_hours', 'adjusted_rn_hours',
    'adjusted_total_nurse_hours', 'adjusted_weekend_hours',
    'chain_avg_overall_rating', 'chain_avg_health_rating',
    'chain_avg_staffing_rating', 'chain_avg_qm_rating',
    'weighted_health_score', 'total_fines_amount',
    'latitude', 'longitude'
  ];

  if (numericFields.includes(fieldName)) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  // Date fields
  const dateFields = ['date_certified', 'last_health_inspection_date', 'cms_processing_date'];

  if (dateFields.includes(fieldName)) {
    // Handle various date formats
    if (/^\d{8}$/.test(value)) {
      // YYYYMMDD format
      return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
    }
    // Already in valid format or ISO date
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : value;
  }

  // String fields - trim whitespace
  return String(value).trim();
}

// Calculate occupancy rate if we have the data
function calculateOccupancy(row) {
  const beds = parseValue(row['Number of Certified Beds'], 'certified_beds');
  const residents = parseValue(row['Average Number of Residents per Day'], 'average_residents_per_day');

  if (beds && residents && beds > 0) {
    return (residents / beds) * 100;
  }
  return null;
}

async function importProviderInfo(csvPath) {
  console.log(`\n=== CMS Provider Info Import ===`);
  console.log(`File: ${csvPath}`);

  // Verify file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: File not found: ${csvPath}`);
    process.exit(1);
  }

  // Connect to database
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    // Read and parse CSV
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} facilities in CSV`);

    // Process in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          const ccn = row['CMS Certification Number (CCN)'];
          if (!ccn) {
            errors++;
            continue;
          }

          // Build update object from column mapping
          const updateData = {};

          for (const [csvCol, dbField] of Object.entries(COLUMN_MAP)) {
            if (row[csvCol] !== undefined) {
              updateData[dbField] = parseValue(row[csvCol], dbField);
            }
          }

          // Also set federal_provider_number to CCN (they're the same)
          updateData.federal_provider_number = ccn;

          // Calculate occupancy rate
          const occupancy = calculateOccupancy(row);
          if (occupancy !== null) {
            updateData.occupancy_rate = occupancy;
            updateData.occupied_beds = parseValue(row['Average Number of Residents per Day'], 'average_residents_per_day');
          }

          // Set total_beds same as certified_beds
          if (updateData.certified_beds) {
            updateData.total_beds = updateData.certified_beds;
          }

          // Set data source and timestamp
          updateData.data_source = 'CMS';
          updateData.last_cms_update = new Date();
          updateData.updated_at = new Date();
          updateData.active = true;

          // Check if facility exists
          const [existing] = await sequelize.query(
            `SELECT id FROM snf_facilities WHERE cms_certification_number = :ccn`,
            { replacements: { ccn }, type: sequelize.QueryTypes.SELECT }
          );

          if (existing) {
            // Update existing
            const setClauses = Object.keys(updateData)
              .filter(k => k !== 'cms_certification_number')
              .map(k => `${k} = :${k}`)
              .join(', ');

            await sequelize.query(
              `UPDATE snf_facilities SET ${setClauses} WHERE cms_certification_number = :cms_certification_number`,
              { replacements: updateData }
            );
            updated++;
          } else {
            // Insert new
            updateData.created_at = new Date();

            const columns = Object.keys(updateData).join(', ');
            const placeholders = Object.keys(updateData).map(k => `:${k}`).join(', ');

            await sequelize.query(
              `INSERT INTO snf_facilities (${columns}) VALUES (${placeholders})`,
              { replacements: updateData }
            );
            inserted++;
          }

          processed++;
        } catch (err) {
          errors++;
          if (errors <= 5) {
            console.error(`Error processing row: ${err.message}`);
          }
        }
      }

      // Progress update
      const pct = Math.round((i + batch.length) / records.length * 100);
      process.stdout.write(`\rProcessed: ${processed} (${pct}%) - Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);
    }

    console.log(`\n\n=== Import Complete ===`);
    console.log(`Total processed: ${processed}`);
    console.log(`New facilities: ${inserted}`);
    console.log(`Updated facilities: ${updated}`);
    console.log(`Errors: ${errors}`);

    // Verify some data
    const [sample] = await sequelize.query(`
      SELECT facility_name, state, lpn_staffing_hours, total_nursing_turnover, chain_name
      FROM snf_facilities
      WHERE lpn_staffing_hours IS NOT NULL
      LIMIT 3
    `);

    if (sample.length > 0) {
      console.log('\nSample of imported data:');
      sample.forEach(f => {
        console.log(`  ${f.facility_name} (${f.state}): LPN=${f.lpn_staffing_hours}hrs, Turnover=${f.total_nursing_turnover}%, Chain=${f.chain_name || 'N/A'}`);
      });
    }

    await sequelize.close();

  } catch (error) {
    console.error('Import failed:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

// Get CSV path from command line
const csvPath = process.argv[2];

if (!csvPath) {
  console.log('Usage: node scripts/import-cms-provider-info.js <path-to-csv>');
  console.log('Example: node scripts/import-cms-provider-info.js "/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data/NH_ProviderInfo_Nov2025.csv"');
  process.exit(1);
}

importProviderInfo(csvPath);
