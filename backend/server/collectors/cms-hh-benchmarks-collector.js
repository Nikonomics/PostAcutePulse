/**
 * CMS Home Health Benchmarks Collector
 *
 * Imports state and national benchmark data for home health quality measures
 *
 * Data Source: CMS Home Health Compare
 */

const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Market database connection
const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// State benchmark column mappings
const STATE_COLUMN_MAPPINGS = {
  'State': 'state',
  'Quality of Patient Care Star Rating': 'quality_star_avg',
  'Star Rating 1 Percentage': 'star_1_pct',
  'Star Rating 1.5 Percentage': 'star_1_5_pct',
  'Star Rating 2 Percentage': 'star_2_pct',
  'Star Rating 2.5 Percentage': 'star_2_5_pct',
  'Star Rating 3 Percentage': 'star_3_pct',
  'Star Rating 3.5 Percentage': 'star_3_5_pct',
  'Star Rating 4 Percentage': 'star_4_pct',
  'Star Rating 4.5 Percentage': 'star_4_5_pct',
  'Star Rating 5 Percentage': 'star_5_pct',
  'How often the home health team began their patients\' care in a timely manner': 'timely_initiation_pct',
  'How often the home health team determined whether patients received a flu shot for the current flu season': 'flu_shot_pct',
  'How often patients got better at walking or moving around': 'walking_improvement_pct',
  'How often patients got better at getting in and out of bed': 'bed_transfer_pct',
  'How often patients got better at bathing': 'bathing_improvement_pct',
  'How often patients\' breathing improved': 'breathing_improvement_pct',
  'How often patients got better at taking their drugs correctly by mouth': 'medication_compliance_pct',
  'Changes in Skin Integrity post-acute care: pressure ulcer/injury': 'pressure_ulcer_pct',
  'How often physician-recommended actions to address medication issues were completely timely': 'medication_actions_pct',
  'Percent of Residents Experiencing One or More Falls with Major Injury': 'falls_injury_pct',
  'Transfer of Health Information to the Provider': 'health_info_provider_pct',
  'Transfer of Health Information to the Patient': 'health_info_patient_pct',
  'How much Medicare spends on an episode of care by agencies in this state, compared to Medicare spending across all agencies nationally': 'medicare_spending_ratio'
};

// National benchmark column mappings
const NATIONAL_COLUMN_MAPPINGS = {
  'Country': 'country',
  'Quality of Patient Care Star Rating': 'quality_star_avg',
  'Star Rating 1 Percentage': 'star_1_pct',
  'Star Rating 1.5 Percentage': 'star_1_5_pct',
  'Star Rating 2 Percentage': 'star_2_pct',
  'Star Rating 2.5 Percentage': 'star_2_5_pct',
  'Star Rating 3 Percentage': 'star_3_pct',
  'Star Rating 3.5 Percentage': 'star_3_5_pct',
  'Star Rating 4 Percentage': 'star_4_pct',
  'Star Rating 4.5 Percentage': 'star_4_5_pct',
  'Star Rating 5 Percentage': 'star_5_pct',
  'How often the home health team began their patients\' care in a timely manner': 'timely_initiation_pct',
  'How often the home health team determined whether patients received a flu shot for the current flu season': 'flu_shot_pct',
  'How often patients got better at walking or moving around': 'walking_improvement_pct',
  'How often patients got better at getting in and out of bed': 'bed_transfer_pct',
  'How often patients got better at bathing': 'bathing_improvement_pct',
  'How often patients\' breathing improved': 'breathing_improvement_pct',
  'How often patients got better at taking their drugs correctly by mouth': 'medication_compliance_pct',
  'Changes in Skin Integrity post-acute care: pressure ulcer/injury': 'pressure_ulcer_pct',
  'How often physician-recommended actions to address medication issues were completely timely': 'medication_actions_pct',
  'Percent of Residents Experiencing One or More Falls with Major Injury': 'falls_injury_pct',
  'Transfer of Health Information to the Provider': 'health_info_provider_pct',
  'Transfer of Health Information to the Patient': 'health_info_patient_pct',
  'PPR Number of HHAs that Performed Better than the National Observed Rate': 'ppr_better_count',
  'PPR Number of HHAs that Performed No Different than the National Observed Rate': 'ppr_same_count',
  'PPR Number of HHAs that Performed Worse than the National Observed Rate': 'ppr_worse_count',
  'PPR Number of HHAs that Have Too Few Cases for Public Reporting': 'ppr_too_few_count',
  'PPR National Observed Rate': 'ppr_national_rate',
  'DTC Number of HHAs that Performed Better than the National Observed Rate': 'dtc_better_count',
  'DTC Number of HHAs that Performed No Different than the National Observed Rate': 'dtc_same_count',
  'DTC Number of HHAs that Performed Worse than the National Observed Rate': 'dtc_worse_count',
  'DTC Number of HHAs that Have Too Few Cases for Public Reporting': 'dtc_too_few_count',
  'DTC National Observed Rate': 'dtc_national_rate',
  'PPH Number of HHAs that Performed Better than the National Observed Rate': 'pph_better_count',
  'PPH Number of HHAs that Performed No Different than the National Observed Rate': 'pph_same_count',
  'PPH Number of HHAs that Performed Worse than the National Observed Rate': 'pph_worse_count',
  'PPH Number of HHAs that Have Too Few Cases for Public Reporting': 'pph_too_few_count',
  'PPH National Observed Rate': 'pph_national_rate',
  'How much Medicare spends on an episode of care at this agency, compared to Medicare spending across all agencies nationally': 'medicare_spending_ratio'
};

/**
 * Parse a benchmark row
 */
function parseRow(row, columnMappings) {
  const result = {};

  for (const [csvCol, dbCol] of Object.entries(columnMappings)) {
    let value = row[csvCol];

    if (value === undefined || value === '' || value === '-' || value === null) {
      result[dbCol] = null;
      continue;
    }

    // Clean up values
    if (typeof value === 'string') {
      value = value.replace(/,/g, '').trim();
    }

    // Integer fields
    const intFields = [
      'ppr_better_count', 'ppr_same_count', 'ppr_worse_count', 'ppr_too_few_count',
      'dtc_better_count', 'dtc_same_count', 'dtc_worse_count', 'dtc_too_few_count',
      'pph_better_count', 'pph_same_count', 'pph_worse_count', 'pph_too_few_count'
    ];

    // Float fields (everything else that's numeric)
    const floatFields = [
      'quality_star_avg',
      'star_1_pct', 'star_1_5_pct', 'star_2_pct', 'star_2_5_pct',
      'star_3_pct', 'star_3_5_pct', 'star_4_pct', 'star_4_5_pct', 'star_5_pct',
      'timely_initiation_pct', 'flu_shot_pct', 'walking_improvement_pct',
      'bed_transfer_pct', 'bathing_improvement_pct', 'breathing_improvement_pct',
      'medication_compliance_pct', 'pressure_ulcer_pct', 'medication_actions_pct',
      'falls_injury_pct', 'health_info_provider_pct', 'health_info_patient_pct',
      'ppr_national_rate', 'dtc_national_rate', 'pph_national_rate',
      'medicare_spending_ratio'
    ];

    if (intFields.includes(dbCol)) {
      result[dbCol] = value ? parseInt(value, 10) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else if (floatFields.includes(dbCol)) {
      result[dbCol] = value ? parseFloat(value) : null;
      if (isNaN(result[dbCol])) result[dbCol] = null;
    }
    else {
      result[dbCol] = value;
    }
  }

  return result;
}

/**
 * Get extract ID for a date
 */
async function getExtractId(extractDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT extract_id FROM hh_extracts WHERE extract_date = $1',
      [extractDate]
    );

    if (result.rows.length === 0) {
      const insertResult = await client.query(
        `INSERT INTO hh_extracts (extract_date, source_file, import_status)
         VALUES ($1, 'benchmarks', 'pending')
         RETURNING extract_id`,
        [extractDate]
      );
      return insertResult.rows[0].extract_id;
    }

    return result.rows[0].extract_id;
  } finally {
    client.release();
  }
}

/**
 * Import state benchmarks from CSV
 */
async function importStateBenchmarks(filePath, extractDate) {
  console.log(`Importing state benchmarks from: ${filePath}`);

  const extractId = await getExtractId(extractDate);
  const client = await pool.connect();
  let recordCount = 0;

  try {
    const data = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    await client.query('BEGIN');

    for (const row of data) {
      const parsed = parseRow(row, STATE_COLUMN_MAPPINGS);

      if (!parsed.state) {
        continue;
      }

      const columns = Object.keys(parsed).filter(k => parsed[k] !== undefined);
      const values = columns.map(k => parsed[k]);
      const placeholders = columns.map((_, i) => `$${i + 2}`);

      await client.query(
        `INSERT INTO hh_state_benchmarks (extract_id, ${columns.join(', ')})
         VALUES ($1, ${placeholders.join(', ')})
         ON CONFLICT (extract_id, state) DO UPDATE SET
           quality_star_avg = EXCLUDED.quality_star_avg,
           timely_initiation_pct = EXCLUDED.timely_initiation_pct`,
        [extractId, ...values]
      );

      recordCount++;
    }

    await client.query('COMMIT');
    console.log(`Imported ${recordCount} state benchmarks`);
    return recordCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Import national benchmarks from CSV
 */
async function importNationalBenchmarks(filePath, extractDate) {
  console.log(`Importing national benchmarks from: ${filePath}`);

  const extractId = await getExtractId(extractDate);
  const client = await pool.connect();

  try {
    const data = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    await client.query('BEGIN');

    // Should only be one row for national
    for (const row of data) {
      const parsed = parseRow(row, NATIONAL_COLUMN_MAPPINGS);

      // Remove 'country' field as it's not in the table
      delete parsed.country;

      const columns = Object.keys(parsed).filter(k => parsed[k] !== undefined);
      const values = columns.map(k => parsed[k]);
      const placeholders = columns.map((_, i) => `$${i + 2}`);

      await client.query(
        `INSERT INTO hh_national_benchmarks (extract_id, ${columns.join(', ')})
         VALUES ($1, ${placeholders.join(', ')})
         ON CONFLICT (extract_id) DO UPDATE SET
           quality_star_avg = EXCLUDED.quality_star_avg,
           timely_initiation_pct = EXCLUDED.timely_initiation_pct`,
        [extractId, ...values]
      );
    }

    await client.query('COMMIT');
    console.log(`Imported national benchmarks`);
    return 1;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
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

  console.log('CMS Home Health Benchmarks Collector');
  console.log('='.repeat(50));

  try {
    switch (command) {
      case 'state':
        const stateFile = args[1];
        const stateDate = args[2];
        if (!stateFile || !stateDate) {
          console.log('Usage: node cms-hh-benchmarks-collector.js state <file.csv> <YYYY-MM-DD>');
          break;
        }
        await importStateBenchmarks(stateFile, stateDate);
        break;

      case 'national':
        const nationalFile = args[1];
        const nationalDate = args[2];
        if (!nationalFile || !nationalDate) {
          console.log('Usage: node cms-hh-benchmarks-collector.js national <file.csv> <YYYY-MM-DD>');
          break;
        }
        await importNationalBenchmarks(nationalFile, nationalDate);
        break;

      case 'both':
        const baseDir = args[1];
        const bothDate = args[2];
        if (!baseDir || !bothDate) {
          console.log('Usage: node cms-hh-benchmarks-collector.js both <directory> <YYYY-MM-DD>');
          break;
        }
        // Look for state and national files
        const stateFiles = fs.readdirSync(baseDir).filter(f => f.startsWith('HH_State'));
        const nationalFiles = fs.readdirSync(baseDir).filter(f => f.startsWith('HH_National'));

        if (stateFiles.length > 0) {
          await importStateBenchmarks(path.join(baseDir, stateFiles[0]), bothDate);
        }
        if (nationalFiles.length > 0) {
          await importNationalBenchmarks(path.join(baseDir, nationalFiles[0]), bothDate);
        }
        break;

      case 'help':
      default:
        console.log(`
Usage: node cms-hh-benchmarks-collector.js <command> [options]

Commands:
  state <file> <date>       Import state benchmarks from CSV
  national <file> <date>    Import national benchmarks from CSV
  both <directory> <date>   Import both state and national from directory

Examples:
  node cms-hh-benchmarks-collector.js state ./HH_State_Oct2025.csv 2025-10-01
  node cms-hh-benchmarks-collector.js national ./HH_National_Oct2025.csv 2025-10-01
  node cms-hh-benchmarks-collector.js both ./data/ 2025-10-01
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
  importStateBenchmarks,
  importNationalBenchmarks
};

// Run if called directly
if (require.main === module) {
  main();
}
