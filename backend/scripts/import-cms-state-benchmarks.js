#!/usr/bin/env node
/**
 * Import CMS NH_StateUSAverages data into cms_state_benchmarks table
 *
 * Usage: node scripts/import-cms-state-benchmarks.js <path-to-csv>
 * Example: node scripts/import-cms-state-benchmarks.js "/path/to/NH_StateUSAverages_Nov2025.csv"
 *
 * This script:
 * - Reads the CMS NH_StateUSAverages CSV file
 * - Maps all 51 columns to database fields
 * - Upserts records based on state_code
 * - Handles national average (NATION row) specially
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Column mapping: CSV column name -> database field name
const COLUMN_MAP = {
  'State or Nation': 'state_code',

  // Star Ratings
  'Overall Rating': 'avg_overall_rating',
  'Health Inspection Rating': 'avg_health_inspection_rating',
  'QM Rating': 'avg_qm_rating',
  'Staffing Rating': 'avg_staffing_rating',

  // Deficiency Counts
  'Cycle 1 Total Number of Health Deficiencies': 'cycle1_health_deficiencies',
  'Cycle 1 Total Number of Fire Safety Deficiencies': 'cycle1_fire_safety_deficiencies',
  'Cycle 2 Total Number of Health Deficiencies': 'cycle2_health_deficiencies',
  'Cycle 2 Total Number of Fire Safety Deficiencies': 'cycle2_fire_safety_deficiencies',
  'Cycle 3 Total Number of Health Deficiencies': 'cycle3_health_deficiencies',
  'Cycle 3 Total Number of Fire Safety Deficiencies': 'cycle3_fire_safety_deficiencies',

  // Census
  'Average Number of Residents per Day': 'avg_residents_per_day',

  // Staffing Hours
  'Reported Nurse Aide Staffing Hours per Resident per Day': 'avg_cna_hours',
  'Reported LPN Staffing Hours per Resident per Day': 'avg_lpn_hours',
  'Reported RN Staffing Hours per Resident per Day': 'avg_rn_hours',
  'Reported Licensed Staffing Hours per Resident per Day': 'avg_licensed_hours',
  'Reported Total Nurse Staffing Hours per Resident per Day': 'avg_total_nurse_hours',
  'Total number of nurse staff hours per resident per day on the weekend': 'avg_weekend_total_hours',
  'Registered Nurse hours per resident per day on the weekend': 'avg_weekend_rn_hours',
  'Reported Physical Therapist Staffing Hours per Resident Per Day': 'avg_pt_hours',

  // Turnover
  'Total nursing staff turnover': 'avg_total_nursing_turnover',
  'Registered Nurse turnover': 'avg_rn_turnover',
  'Number of administrators who have left the nursing home': 'avg_admin_departures',

  // Case-Mix
  'Nursing Case-Mix Index': 'avg_case_mix_index',
  'Case-Mix RN Staffing Hours per Resident per Day': 'avg_case_mix_rn_hours',
  'Case-Mix Total Nurse Staffing Hours per Resident per Day': 'avg_case_mix_total_hours',
  'Case-Mix Weekend Total Nurse Staffing Hours per Resident per Day': 'avg_case_mix_weekend_hours',

  // Penalties
  'Number of Fines': 'avg_fine_count',
  'Fine Amount in Dollars': 'avg_fine_amount',

  // Quality Measures - Long Stay
  'Percentage of long stay residents whose need for help with daily activities has increased': 'qm_ls_adl_decline',
  'Percentage of long stay residents who lose too much weight': 'qm_ls_weight_loss',
  'Percentage of long stay residents with a catheter inserted and left in their bladder': 'qm_ls_catheter',
  'Percentage of long stay residents with a urinary tract infection': 'qm_ls_uti',
  'Percentage of long stay residents who have depressive symptoms': 'qm_ls_depressive_symptoms',
  'Percentage of long stay residents who were physically restrained': 'qm_ls_physical_restraints',
  'Percentage of long stay residents experiencing one or more falls with major injury': 'qm_ls_falls_major_injury',
  'Percentage of long stay residents assessed and appropriately given the pneumococcal vaccine': 'qm_ls_pneumococcal_vaccine',
  'Percentage of long stay residents who received an antipsychotic medication': 'qm_ls_antipsychotic',
  'Percentage of long stay residents whose ability to walk independently worsened': 'qm_ls_walking_decline',
  'Percentage of long stay residents who received an antianxiety or hypnotic medication': 'qm_ls_antianxiety_hypnotic',
  'Percentage of long stay residents assessed and appropriately given the seasonal influenza vaccine': 'qm_ls_flu_vaccine',
  'Percentage of long stay residents with pressure ulcers': 'qm_ls_pressure_ulcers',
  'Percentage of long stay residents with new or worsened bowel or bladder incontinence': 'qm_ls_incontinence',

  // Quality Measures - Short Stay
  'Percentage of short stay residents assessed and appropriately given the pneumococcal vaccine': 'qm_ss_pneumococcal_vaccine',
  'Percentage of short stay residents who newly received an antipsychotic medication': 'qm_ss_antipsychotic',
  'Percentage of short stay residents who were rehospitalized after a nursing home admission': 'qm_ss_rehospitalized',
  'Percentage of short stay residents who had an outpatient emergency department visit': 'qm_ss_ed_visit',

  // Utilization
  'Number of hospitalizations per 1000 long-stay resident days': 'hospitalizations_per_1000_days',
  'Number of outpatient emergency department visits per 1000 long-stay resident days': 'ed_visits_per_1000_days',

  // Metadata
  'Processing Date': 'processing_date'
};

// Parse value based on field type
function parseValue(value, fieldName) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  // Date field
  if (fieldName === 'processing_date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    if (/^\d{8}$/.test(value)) {
      return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
    }
    return null;
  }

  // State code - keep as string
  if (fieldName === 'state_code') {
    return String(value).trim();
  }

  // All other fields are numeric
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

async function importStateBenchmarks(csvPath) {
  console.log(`\n=== CMS State Benchmarks Import ===`);
  console.log(`File: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: File not found: ${csvPath}`);
    process.exit(1);
  }

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

    console.log(`Found ${records.length} state/national records`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const row of records) {
      try {
        const stateCode = row['State or Nation'];
        if (!stateCode) {
          errors++;
          continue;
        }

        // Build data object
        const data = {};
        for (const [csvCol, dbField] of Object.entries(COLUMN_MAP)) {
          if (row[csvCol] !== undefined) {
            data[dbField] = parseValue(row[csvCol], dbField);
          }
        }

        // Set is_national flag
        data.is_national = stateCode === 'NATION';
        data.updated_at = new Date();

        // Check if exists
        const [existing] = await sequelize.query(
          `SELECT id FROM cms_state_benchmarks WHERE state_code = :state_code`,
          { replacements: { state_code: stateCode }, type: sequelize.QueryTypes.SELECT }
        );

        if (existing) {
          // Update
          const setClauses = Object.keys(data)
            .filter(k => k !== 'state_code')
            .map(k => `${k} = :${k}`)
            .join(', ');

          await sequelize.query(
            `UPDATE cms_state_benchmarks SET ${setClauses} WHERE state_code = :state_code`,
            { replacements: data }
          );
          updated++;
        } else {
          // Insert
          data.created_at = new Date();
          const columns = Object.keys(data).join(', ');
          const placeholders = Object.keys(data).map(k => `:${k}`).join(', ');

          await sequelize.query(
            `INSERT INTO cms_state_benchmarks (${columns}) VALUES (${placeholders})`,
            { replacements: data }
          );
          inserted++;
        }

        // Progress indicator
        const name = data.is_national ? 'NATIONAL' : stateCode;
        process.stdout.write(`\rProcessed: ${name.padEnd(10)}`);

      } catch (err) {
        errors++;
        console.error(`\nError processing row: ${err.message}`);
      }
    }

    console.log(`\n\n=== Import Complete ===`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);

    // Show sample data
    const [sample] = await sequelize.query(`
      SELECT state_code, avg_overall_rating, avg_total_nurse_hours,
             avg_total_nursing_turnover, qm_ls_falls_major_injury
      FROM cms_state_benchmarks
      WHERE state_code IN ('NATION', 'CA', 'TX', 'FL', 'NY')
      ORDER BY CASE WHEN state_code = 'NATION' THEN 0 ELSE 1 END, state_code
    `);

    console.log('\nSample benchmarks (staffing hours, turnover, falls):');
    sample.forEach(s => {
      const label = s.state_code === 'NATION' ? 'NATIONAL' : s.state_code;
      console.log(`  ${label.padEnd(10)} Rating: ${s.avg_overall_rating}, Nurse Hrs: ${s.avg_total_nurse_hours}, Turnover: ${s.avg_total_nursing_turnover}%, Falls: ${s.qm_ls_falls_major_injury}%`);
    });

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
  console.log('Usage: node scripts/import-cms-state-benchmarks.js <path-to-csv>');
  console.log('Example: node scripts/import-cms-state-benchmarks.js "/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data/NH_StateUSAverages_Nov2025.csv"');
  process.exit(1);
}

importStateBenchmarks(csvPath);
