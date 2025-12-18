/**
 * Import CMS Data to Production Database
 *
 * Reads CMS data from local CSV files and imports to the production database.
 * Run this from your local machine with DATABASE_URL pointing to production.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/import-cms-to-production.js
 *
 * Or using the npm script:
 *   DATABASE_URL="postgresql://..." npm run db:import:cms
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL="postgresql://..." node scripts/import-cms-to-production.js');
  process.exit(1);
}

const isRemote = connectionString.includes('render.com') || connectionString.includes('amazonaws.com');

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

// Local data directory
const DATA_DIR = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data';

// CSV parsing helper
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNum(val) {
  if (!val || val === '' || val === 'N/A') return null;
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}

function parseDate(val) {
  if (!val || val === '' || val === 'N/A') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

async function importVBPData(client) {
  console.log('\n========================================');
  console.log('IMPORTING VBP DATA');
  console.log('========================================\n');

  if (!fs.existsSync(DATA_DIR)) {
    console.log('Data directory not found:', DATA_DIR);
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.includes('VBP') && f.includes('Facility') && f.endsWith('.csv'));

  if (files.length === 0) {
    console.log('No VBP files found');
    return;
  }

  for (const file of files) {
    const match = file.match(/FY_(\d{4})/);
    const fiscalYear = match ? parseInt(match[1]) : null;
    if (!fiscalYear) continue;

    console.log(`Importing ${file} (FY ${fiscalYear})...`);

    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length < 2) continue;

    const headers = parseCSVLine(lines[0]);

    // Find column indexes
    const ccnIdx = headers.findIndex(h => /CCN|CMS Certification Number|Provider ID|Federal Provider/i.test(h));
    const rankIdx = headers.findIndex(h => /Ranking/i.test(h));
    const baselineIdx = headers.findIndex(h => /Baseline.*Rate/i.test(h));
    const perfIdx = headers.findIndex(h => /Performance.*Rate/i.test(h));
    const achIdx = headers.findIndex(h => /Achievement.*Score/i.test(h));
    const impIdx = headers.findIndex(h => /Improvement.*Score/i.test(h));
    const perfScoreIdx = headers.findIndex(h => /Performance Score/i.test(h) && !/Rate/i.test(h));
    const multiplierIdx = headers.findIndex(h => /Multiplier/i.test(h));

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row[ccnIdx]) continue;

      const ccn = row[ccnIdx].replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          INSERT INTO vbp_scores (fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
            performance_readmission_rate, achievement_score, improvement_score,
            performance_score, incentive_payment_multiplier)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (fiscal_year, ccn) DO UPDATE SET
            vbp_ranking = EXCLUDED.vbp_ranking,
            baseline_readmission_rate = EXCLUDED.baseline_readmission_rate,
            performance_readmission_rate = EXCLUDED.performance_readmission_rate,
            achievement_score = EXCLUDED.achievement_score,
            improvement_score = EXCLUDED.improvement_score,
            performance_score = EXCLUDED.performance_score,
            incentive_payment_multiplier = EXCLUDED.incentive_payment_multiplier
        `, [
          fiscalYear,
          ccn,
          parseNum(row[rankIdx]),
          parseNum(row[baselineIdx]),
          parseNum(row[perfIdx]),
          parseNum(row[achIdx]),
          parseNum(row[impIdx]),
          parseNum(row[perfScoreIdx]),
          parseNum(row[multiplierIdx])
        ]);
        imported++;
      } catch (e) {
        // Skip individual row errors
      }
    }
    console.log(`  ✓ Imported ${imported} records for FY ${fiscalYear}`);
  }
}

async function importSurveyDates(client) {
  console.log('\n========================================');
  console.log('IMPORTING SURVEY DATES');
  console.log('========================================\n');

  if (!fs.existsSync(DATA_DIR)) return;

  // Look for survey data file
  const surveyFile = fs.readdirSync(DATA_DIR).find(f =>
    (f.includes('Survey') || f.includes('Inspection')) && f.endsWith('.csv')
  );

  // If no dedicated survey file, extract from provider info
  const providerFile = fs.readdirSync(DATA_DIR).find(f => f.includes('ProviderInfo') && f.endsWith('.csv'));

  if (!surveyFile && !providerFile) {
    console.log('No survey data files found');
    return;
  }

  const file = surveyFile || providerFile;
  const filePath = path.join(DATA_DIR, file);
  console.log(`Reading survey dates from ${file}...`);

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  const ccnIdx = headers.findIndex(h => /CCN|Federal Provider Number/i.test(h));
  const healthSurveyIdx = headers.findIndex(h => /Health Inspection Date|Last.*Survey/i.test(h));
  const fireSurveyIdx = headers.findIndex(h => /Fire.*Inspection|Fire.*Survey/i.test(h));

  if (ccnIdx < 0) {
    console.log('CCN column not found');
    return;
  }

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const ccn = row[ccnIdx]?.replace(/[^0-9A-Z]/gi, '');
    if (!ccn || ccn.length < 6) continue;

    // Insert health survey date
    if (healthSurveyIdx >= 0) {
      const healthDate = parseDate(row[healthSurveyIdx]);
      if (healthDate) {
        try {
          await client.query(`
            INSERT INTO survey_dates (ccn, survey_date, survey_type)
            VALUES ($1, $2, 'Health')
            ON CONFLICT DO NOTHING
          `, [ccn, healthDate]);
          imported++;
        } catch (e) { }
      }
    }

    // Insert fire safety survey date
    if (fireSurveyIdx >= 0) {
      const fireDate = parseDate(row[fireSurveyIdx]);
      if (fireDate) {
        try {
          await client.query(`
            INSERT INTO survey_dates (ccn, survey_date, survey_type)
            VALUES ($1, $2, 'Fire Safety')
            ON CONFLICT DO NOTHING
          `, [ccn, fireDate]);
          imported++;
        } catch (e) { }
      }
    }
  }

  console.log(`  ✓ Imported ${imported} survey date records`);
}

async function importMDSQualityMeasures(client) {
  console.log('\n========================================');
  console.log('IMPORTING MDS QUALITY MEASURES');
  console.log('========================================\n');

  if (!fs.existsSync(DATA_DIR)) return;

  const qrpFile = fs.readdirSync(DATA_DIR).find(f =>
    f.includes('Quality_Reporting_Program_Provider') && f.endsWith('.csv')
  );

  if (!qrpFile) {
    console.log('QRP file not found, skipping MDS import');
    return;
  }

  const filePath = path.join(DATA_DIR, qrpFile);
  console.log(`Reading ${qrpFile}...`);

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  const ccnIdx = headers.findIndex(h => /CCN|CMS Certification Number|Federal Provider/i.test(h));
  if (ccnIdx < 0) {
    console.log('CCN column not found');
    return;
  }

  // Find measure columns
  const measureCols = headers.map((h, i) => {
    const match = h.match(/^(\d{3})\s*-\s*(.+)/);
    if (match) {
      return { idx: i, code: match[1], description: match[2].trim() };
    }
    return null;
  }).filter(Boolean);

  console.log(`Found ${measureCols.length} quality measure columns`);

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const ccn = row[ccnIdx]?.replace(/[^0-9A-Z]/gi, '');
    if (!ccn || ccn.length < 6) continue;

    for (const measure of measureCols) {
      const value = row[measure.idx];
      if (!value || value === '' || value === 'N/A') continue;

      const score = parseFloat(value.replace(/[^0-9.-]/g, ''));
      if (isNaN(score)) continue;

      try {
        await client.query(`
          INSERT INTO mds_quality_measures (ccn, measure_code, measure_description, four_quarter_score)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (ccn, measure_code) DO UPDATE SET
            four_quarter_score = EXCLUDED.four_quarter_score,
            measure_description = EXCLUDED.measure_description
        `, [ccn, measure.code, measure.description, score]);
        imported++;
      } catch (e) { }
    }

    if (i % 1000 === 0) {
      console.log(`  Processed ${i} of ${lines.length} facilities...`);
    }
  }

  console.log(`\n✓ Imported ${imported} quality measure records`);
}

async function importProviderInfo(client) {
  console.log('\n========================================');
  console.log('UPDATING PROVIDER INFO');
  console.log('========================================\n');

  if (!fs.existsSync(DATA_DIR)) return;

  const providerFile = fs.readdirSync(DATA_DIR).find(f => f.includes('ProviderInfo') && f.endsWith('.csv'));

  if (!providerFile) {
    console.log('Provider info file not found');
    return;
  }

  const filePath = path.join(DATA_DIR, providerFile);
  console.log(`Reading ${providerFile}...`);

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  const findCol = (patterns) => {
    for (const p of patterns) {
      const idx = headers.findIndex(h => p.test(h));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const cols = {
    ccn: findCol([/Federal Provider Number/i, /CCN/i]),
    lpnHrs: findCol([/LPN.*HPRD|Reported LPN/i]),
    ptHrs: findCol([/Physical Therapist.*HPRD|Reported PT/i]),
    weekendTotal: findCol([/Weekend Total.*Hours/i]),
    weekendRn: findCol([/Weekend RN.*Hours/i]),
    nursingTurnover: findCol([/Total Nursing Staff Turnover/i]),
    rnTurnover: findCol([/RN Turnover/i]),
    adminDepartures: findCol([/Administrator.*Departure/i]),
    caseMixIndex: findCol([/Case.*Mix.*Index/i]),
    longStayQm: findCol([/Long.*Stay.*QM.*Rating/i]),
    shortStayQm: findCol([/Short.*Stay.*QM.*Rating/i]),
    chainId: findCol([/Chain.*ID/i]),
    chainName: findCol([/Chain.*Name/i, /Chain Organization/i]),
    complaints: findCol([/Substantiated.*Complaint/i]),
    infections: findCol([/Infection.*Control.*Citation/i]),
    incidents: findCol([/Reported.*Incident/i]),
    fineCount: findCol([/Number.*Fine/i, /Fine.*Count/i]),
    totalFines: findCol([/Total.*Fine.*Amount/i]),
    isUrban: findCol([/Location.*Urban/i, /Urban.*Rural/i]),
    inspectionDate: findCol([/Health.*Inspection.*Date/i, /Last.*Survey.*Date/i])
  };

  let updated = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const ccn = row[cols.ccn]?.replace(/[^0-9A-Z]/gi, '');
    if (!ccn || ccn.length < 6) continue;

    const parseBool = (val) => {
      if (!val) return null;
      return /yes|true|y|urban/i.test(val);
    };

    try {
      await client.query(`
        UPDATE snf_facilities SET
          lpn_staffing_hours = COALESCE($2, lpn_staffing_hours),
          pt_staffing_hours = COALESCE($3, pt_staffing_hours),
          weekend_total_nurse_hours = COALESCE($4, weekend_total_nurse_hours),
          weekend_rn_hours = COALESCE($5, weekend_rn_hours),
          total_nursing_turnover = COALESCE($6, total_nursing_turnover),
          rn_turnover = COALESCE($7, rn_turnover),
          admin_departures = COALESCE($8, admin_departures),
          nursing_case_mix_index = COALESCE($9, nursing_case_mix_index),
          long_stay_qm_rating = COALESCE($10, long_stay_qm_rating),
          short_stay_qm_rating = COALESCE($11, short_stay_qm_rating),
          chain_id = COALESCE($12, chain_id),
          chain_name = COALESCE($13, chain_name),
          substantiated_complaints = COALESCE($14, substantiated_complaints),
          infection_control_citations = COALESCE($15, infection_control_citations),
          facility_reported_incidents = COALESCE($16, facility_reported_incidents),
          fine_count = COALESCE($17, fine_count),
          total_fines_amount = COALESCE($18, total_fines_amount),
          is_urban = COALESCE($19, is_urban),
          last_health_inspection_date = COALESCE($20, last_health_inspection_date)
        WHERE federal_provider_number = $1
      `, [
        ccn,
        parseNum(row[cols.lpnHrs]),
        parseNum(row[cols.ptHrs]),
        parseNum(row[cols.weekendTotal]),
        parseNum(row[cols.weekendRn]),
        parseNum(row[cols.nursingTurnover]),
        parseNum(row[cols.rnTurnover]),
        parseNum(row[cols.adminDepartures]),
        parseNum(row[cols.caseMixIndex]),
        parseNum(row[cols.longStayQm]),
        parseNum(row[cols.shortStayQm]),
        row[cols.chainId] || null,
        row[cols.chainName] || null,
        parseNum(row[cols.complaints]),
        parseNum(row[cols.infections]),
        parseNum(row[cols.incidents]),
        parseNum(row[cols.fineCount]),
        parseNum(row[cols.totalFines]),
        parseBool(row[cols.isUrban]),
        parseDate(row[cols.inspectionDate])
      ]);
      updated++;
    } catch (e) { }

    if (updated % 1000 === 0 && updated > 0) {
      console.log(`  Updated ${updated} facilities...`);
    }
  }

  console.log(`\n✓ Updated ${updated} facilities with additional data`);
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('\n====================================');
    console.log('CMS DATA IMPORT TO PRODUCTION');
    console.log('====================================\n');
    console.log('Target database:', connectionString.replace(/:[^:@]+@/, ':***@'));
    console.log('Data source:', DATA_DIR);

    if (!fs.existsSync(DATA_DIR)) {
      console.error('\nERROR: Data directory not found:', DATA_DIR);
      console.error('Please ensure CMS data files are available at this location.');
      process.exit(1);
    }

    await importVBPData(client);
    await importSurveyDates(client);
    await importMDSQualityMeasures(client);
    await importProviderInfo(client);

    // Final verification
    console.log('\n========================================');
    console.log('FINAL COUNTS');
    console.log('========================================\n');

    const tables = [
      'snf_facilities',
      'vbp_scores',
      'mds_quality_measures',
      'covid_vaccination',
      'survey_dates',
      'ownership_records',
      'penalty_records'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ${table}: ${result.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ${table}: error - ${e.message}`);
      }
    }

    console.log('\n====================================');
    console.log('IMPORT COMPLETE');
    console.log('====================================\n');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
