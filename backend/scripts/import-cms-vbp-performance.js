#!/usr/bin/env node
/**
 * Import CMS SNF VBP Performance data into snf_vbp_performance table
 *
 * Usage: node scripts/import-cms-vbp-performance.js <path-to-csv>
 * Example: node scripts/import-cms-vbp-performance.js "/path/to/FY_2026_SNF_VBP_Facility_Performance.csv"
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Column mapping
const COLUMN_MAP = {
  'SNF VBP Program Ranking': 'vbp_ranking',
  'CMS Certification Number (CCN)': 'cms_certification_number',
  'Provider Name': 'provider_name',
  'Provider Address': 'address',
  'City/Town': 'city',
  'State': 'state',
  'ZIP Code': 'zip_code',

  // Readmission
  'Baseline Period: FY 2022 Risk-Standardized Readmission Rate': 'baseline_readmission_rate',
  'Performance Period: FY 2024 Risk-Standardized Readmission Rate': 'performance_readmission_rate',
  'SNFRM Achievement Score': 'readmission_achievement_score',
  'SNFRM Improvement Score': 'readmission_improvement_score',
  'SNFRM Measure Score': 'readmission_measure_score',

  // HAI
  'Baseline Period: FY 2022 Risk-Standardized Healthcare-Associated Infection Rate': 'baseline_hai_rate',
  'Performance Period: FY 2024 Risk-Standardized Healthcare-Associated Infection Rate': 'performance_hai_rate',
  'SNF HAI Achievement Score': 'hai_achievement_score',
  'SNF HAI Improvement Score': 'hai_improvement_score',
  'SNF HAI Measure Score': 'hai_measure_score',

  // Turnover
  'Baseline Period: FY 2022 Total Nursing Staff Turnover Rate': 'baseline_turnover_rate',
  'Performance Period: FY 2024 Total Nursing Staff Turnover Rate': 'performance_turnover_rate',
  'Total Nursing Staff Turnover Achievement Score': 'turnover_achievement_score',
  'Total Nursing Staff Turnover Improvement Score': 'turnover_improvement_score',
  'Total Nursing Staff Turnover Measure Score': 'turnover_measure_score',

  // Staffing
  'Baseline Period: FY 2022 Adjusted Total Nursing Staff Hours per Resident Day': 'baseline_staffing_hours',
  'Performance Period: FY 2024 Adjusted Total Nursing Staff Hours per Resident Day': 'performance_staffing_hours',
  'Total Nurse Staffing Achievement Score': 'staffing_achievement_score',
  'Total Nurse Staffing Improvement Score': 'staffing_improvement_score',
  'Total Nurse Staffing Measure Score': 'staffing_measure_score',

  // Final
  'Performance Score': 'performance_score',
  'Incentive Payment Multiplier': 'incentive_payment_multiplier'
};

function parseValue(value, fieldName) {
  if (value === '' || value === '---' || value === null || value === undefined) {
    return null;
  }

  // String fields
  if (['cms_certification_number', 'provider_name', 'address', 'city', 'state', 'zip_code'].includes(fieldName)) {
    return String(value).trim();
  }

  // Integer
  if (fieldName === 'vbp_ranking') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  // Numeric
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

async function importVbpPerformance(csvPath) {
  console.log(`\n=== SNF VBP Performance Import ===`);
  console.log(`File: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: File not found: ${csvPath}`);
    process.exit(1);
  }

  // Extract fiscal year from filename (e.g., FY_2026_SNF_VBP...)
  const fyMatch = csvPath.match(/FY_(\d{4})/i);
  const fiscalYear = fyMatch ? parseInt(fyMatch[1], 10) : null;
  console.log(`Fiscal Year: ${fiscalYear || 'Unknown'}`);

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('Database connected');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} facility records`);

    // Clear existing data for this fiscal year
    if (fiscalYear) {
      await sequelize.query(`DELETE FROM snf_vbp_performance WHERE fiscal_year = :fy`,
        { replacements: { fy: fiscalYear } });
      console.log(`Cleared existing FY${fiscalYear} data`);
    }

    const BATCH_SIZE = 100;
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          const ccn = row['CMS Certification Number (CCN)'];
          if (!ccn) {
            skipped++;
            continue;
          }

          // Check if facility exists in snf_facilities (for FK constraint)
          const [exists] = await sequelize.query(
            `SELECT 1 FROM snf_facilities WHERE cms_certification_number = :ccn LIMIT 1`,
            { replacements: { ccn }, type: sequelize.QueryTypes.SELECT }
          );

          if (!exists) {
            skipped++;
            continue;
          }

          const data = { fiscal_year: fiscalYear };
          for (const [csvCol, dbField] of Object.entries(COLUMN_MAP)) {
            if (row[csvCol] !== undefined) {
              data[dbField] = parseValue(row[csvCol], dbField);
            }
          }

          // Calculate incentive percentage
          if (data.incentive_payment_multiplier) {
            data.incentive_percentage = (data.incentive_payment_multiplier - 1) * 100;
          }

          data.created_at = new Date();
          data.updated_at = new Date();

          const columns = Object.keys(data).join(', ');
          const placeholders = Object.keys(data).map(k => `:${k}`).join(', ');

          await sequelize.query(
            `INSERT INTO snf_vbp_performance (${columns}) VALUES (${placeholders})`,
            { replacements: data }
          );
          inserted++;

        } catch (err) {
          errors++;
          if (errors <= 3) console.error(`\nError: ${err.message}`);
        }
      }

      const pct = Math.round((i + batch.length) / records.length * 100);
      process.stdout.write(`\rProcessed: ${pct}% - Inserted: ${inserted}, Skipped: ${skipped}`);
    }

    console.log(`\n\n=== Import Complete ===`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped (no matching facility): ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Sample data
    const [sample] = await sequelize.query(`
      SELECT provider_name, state, vbp_ranking, performance_score,
             incentive_percentage, performance_readmission_rate
      FROM snf_vbp_performance
      ORDER BY vbp_ranking
      LIMIT 5
    `);

    console.log('\nTop 5 performers:');
    sample.forEach((s, i) => {
      const pct = s.incentive_percentage >= 0 ? `+${s.incentive_percentage.toFixed(2)}%` : `${s.incentive_percentage.toFixed(2)}%`;
      console.log(`  ${i+1}. ${s.provider_name} (${s.state}) - Score: ${s.performance_score}, Incentive: ${pct}`);
    });

    await sequelize.close();

  } catch (error) {
    console.error('Import failed:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.log('Usage: node scripts/import-cms-vbp-performance.js <path-to-csv>');
  process.exit(1);
}

importVbpPerformance(csvPath);
