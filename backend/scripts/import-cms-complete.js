import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform' });

const HISTORICAL_DIR = process.env.HOME + '/Desktop/cms_historical_data';
const CURRENT_DATA_DIR = process.env.HOME + '/Downloads/nursing_homes_including_rehab_services_12_2025';
const TEMP_DIR = '/tmp/cms_complete_import';

// Batch size for bulk inserts
const BATCH_SIZE = 1000;

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseValue(value, type = 'string') {
  if (value === null || value === undefined || value === '' || value === 'NULL') return null;

  switch (type) {
    case 'int':
      const i = parseInt(value, 10);
      return isNaN(i) ? null : i;
    case 'decimal':
      const f = parseFloat(value);
      return isNaN(f) ? null : f;
    case 'bool':
      const lower = String(value).toLowerCase();
      return lower === 'y' || lower === 'yes' || lower === 'true' || lower === '1';
    case 'date':
      if (!value) return null;
      if (/^\d{8}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      }
      const parts = value.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
      return value;
    default:
      return String(value).trim().slice(0, 500);
  }
}

function findFilesRecursive(dir, pattern) {
  const results = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...findFilesRecursive(fullPath, pattern));
      } else if (item.name.includes(pattern) && item.name.endsWith('.csv')) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

async function getOrCreateExtract(extractDate, sourceFile) {
  const existing = await pool.query('SELECT extract_id FROM cms_extracts WHERE extract_date = $1', [extractDate]);
  if (existing.rows.length > 0) return existing.rows[0].extract_id;

  const result = await pool.query(
    `INSERT INTO cms_extracts (extract_date, source_file, import_started_at, import_status)
     VALUES ($1, $2, CURRENT_TIMESTAMP, 'importing') RETURNING extract_id`,
    [extractDate, sourceFile]
  );
  return result.rows[0].extract_id;
}

// ============================================================
// VBP Import
// ============================================================
async function importVBP(filePath, extractId) {
  console.log(`  Importing VBP: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  // Extract fiscal year from filename
  const fyMatch = path.basename(filePath).match(/FY_(\d{4})/);
  const fiscalYear = fyMatch ? parseInt(fyMatch[1]) : null;
  if (!fiscalYear) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await pool.query(`
        INSERT INTO vbp_scores (extract_id, fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
          performance_readmission_rate, achievement_score, improvement_score, performance_score,
          incentive_payment_multiplier)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (fiscal_year, ccn) DO UPDATE SET
          vbp_ranking = EXCLUDED.vbp_ranking,
          incentive_payment_multiplier = EXCLUDED.incentive_payment_multiplier
      `, [
        extractId, fiscalYear, ccn,
        parseValue(row['SNF VBP Program Ranking'], 'int'),
        parseValue(row['Baseline Period: FY 2019 Risk-Standardized Readmission Rate'] || row[Object.keys(row).find(k => k.includes('Baseline') && k.includes('Rate'))], 'decimal'),
        parseValue(row['Performance Period: FY 2022 Risk-Standardized Readmission Rate'] || row[Object.keys(row).find(k => k.includes('Performance Period') && k.includes('Rate'))], 'decimal'),
        parseValue(row['Achievement Score'], 'decimal'),
        parseValue(row['Improvement Score'], 'decimal'),
        parseValue(row['Performance Score'], 'decimal'),
        parseValue(row['Incentive Payment Multiplier'], 'decimal')
      ]);
      imported++;
    } catch (e) {
      if (imported === 0) console.error('    Error:', e.message);
    }
  }
  console.log(`    Imported ${imported} VBP records`);
  return imported;
}

// ============================================================
// Ownership Import
// ============================================================
async function importOwnership(filePath, extractId) {
  console.log(`  Importing Ownership: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await pool.query(`
        INSERT INTO ownership_records (extract_id, ccn, role_type, owner_type, owner_name,
          ownership_percentage, association_date, cms_processing_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        extractId, ccn,
        parseValue(row['Role played by Owner or Manager in Facility']),
        parseValue(row['Owner Type']),
        parseValue(row['Owner Name']),
        parseValue(row['Ownership Percentage'], 'decimal'),
        parseValue(row['Association Date'], 'date'),
        parseValue(row['Processing Date'], 'date')
      ]);
      imported++;
    } catch (e) {
      if (imported === 0) console.error('    Error:', e.message);
    }
  }
  console.log(`    Imported ${imported} ownership records`);
  return imported;
}

// ============================================================
// Penalties Import
// ============================================================
async function importPenalties(filePath, extractId) {
  console.log(`  Importing Penalties: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await pool.query(`
        INSERT INTO penalty_records (extract_id, ccn, penalty_date, penalty_type, fine_amount,
          payment_denial_start_date, payment_denial_days, cms_processing_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        extractId, ccn,
        parseValue(row['Penalty Date'], 'date'),
        parseValue(row['Penalty Type']),
        parseValue(row['Fine Amount'], 'decimal'),
        parseValue(row['Payment Denial Start Date'], 'date'),
        parseValue(row['Payment Denial Length in Days'], 'int'),
        parseValue(row['Processing Date'], 'date')
      ]);
      imported++;
    } catch (e) {
      if (imported === 0) console.error('    Error:', e.message);
    }
  }
  console.log(`    Imported ${imported} penalty records`);
  return imported;
}

// ============================================================
// Health Citations Import
// ============================================================
async function importHealthCitations(filePath, extractId) {
  console.log(`  Importing Health Citations: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  let batch = [];

  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    batch.push([
      extractId, ccn,
      parseValue(row['Survey Date'], 'date'),
      parseValue(row['Survey Type']),
      parseValue(row['Deficiency Prefix']),
      parseValue(row['Deficiency Category']),
      parseValue(row['Deficiency Tag Number']),
      parseValue(row['Deficiency Description']),
      parseValue(row['Scope Severity Code']),
      parseValue(row['Deficiency Corrected'], 'bool'),
      parseValue(row['Correction Date'], 'date'),
      parseValue(row['Inspection Cycle'], 'int'),
      parseValue(row['Standard Deficiency'], 'bool'),
      parseValue(row['Complaint Deficiency'], 'bool'),
      parseValue(row['Infection Control Inspection Deficiency'], 'bool'),
      parseValue(row['Citation under IDR'], 'bool'),
      parseValue(row['Processing Date'], 'date')
    ]);

    if (batch.length >= BATCH_SIZE) {
      await insertHealthCitationBatch(batch);
      imported += batch.length;
      batch = [];
      process.stdout.write(`\r    Imported ${imported} citations...`);
    }
  }

  if (batch.length > 0) {
    await insertHealthCitationBatch(batch);
    imported += batch.length;
  }

  console.log(`\r    Imported ${imported} health citations`);
  return imported;
}

async function insertHealthCitationBatch(batch) {
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const row of batch) {
    const rowPlaceholders = [];
    for (const val of row) {
      rowPlaceholders.push(`$${paramIndex}`);
      values.push(val);
      paramIndex++;
    }
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
  }

  await pool.query(`
    INSERT INTO health_citations (extract_id, ccn, survey_date, survey_type, deficiency_prefix,
      deficiency_category, deficiency_tag, deficiency_description, scope_severity_code,
      deficiency_corrected, correction_date, inspection_cycle, is_standard_deficiency,
      is_complaint_deficiency, is_infection_control, is_under_idr, cms_processing_date)
    VALUES ${placeholders.join(', ')}
  `, values);
}

// ============================================================
// Fire Safety Citations Import
// ============================================================
async function importFireSafetyCitations(filePath, extractId) {
  console.log(`  Importing Fire Safety Citations: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  let batch = [];

  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    batch.push([
      extractId, ccn,
      parseValue(row['Survey Date'], 'date'),
      parseValue(row['Survey Type']),
      parseValue(row['Deficiency Prefix']),
      parseValue(row['Deficiency Category']),
      parseValue(row['Deficiency Tag Number']),
      parseValue(row['Deficiency Description']),
      parseValue(row['Scope Severity Code']),
      parseValue(row['Deficiency Corrected'], 'bool'),
      parseValue(row['Correction Date'], 'date'),
      parseValue(row['Inspection Cycle'], 'int'),
      parseValue(row['Standard Deficiency'], 'bool'),
      parseValue(row['Complaint Deficiency'], 'bool'),
      parseValue(row['Processing Date'], 'date')
    ]);

    if (batch.length >= BATCH_SIZE) {
      await insertFireCitationBatch(batch);
      imported += batch.length;
      batch = [];
      process.stdout.write(`\r    Imported ${imported} citations...`);
    }
  }

  if (batch.length > 0) {
    await insertFireCitationBatch(batch);
    imported += batch.length;
  }

  console.log(`\r    Imported ${imported} fire safety citations`);
  return imported;
}

async function insertFireCitationBatch(batch) {
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const row of batch) {
    const rowPlaceholders = [];
    for (const val of row) {
      rowPlaceholders.push(`$${paramIndex}`);
      values.push(val);
      paramIndex++;
    }
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
  }

  await pool.query(`
    INSERT INTO fire_safety_citations (extract_id, ccn, survey_date, survey_type, deficiency_prefix,
      deficiency_category, deficiency_tag, deficiency_description, scope_severity_code,
      deficiency_corrected, correction_date, inspection_cycle, is_standard_deficiency,
      is_complaint_deficiency, cms_processing_date)
    VALUES ${placeholders.join(', ')}
  `, values);
}

// ============================================================
// Survey Dates Import
// ============================================================
async function importSurveyDates(filePath, extractId) {
  console.log(`  Importing Survey Dates: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await pool.query(`
        INSERT INTO survey_dates (extract_id, ccn, survey_date, survey_type, cms_processing_date)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        extractId, ccn,
        parseValue(row['Survey Date'], 'date'),
        parseValue(row['Survey Type']),
        parseValue(row['Processing Date'], 'date')
      ]);
      imported++;
    } catch (e) {}
  }
  console.log(`    Imported ${imported} survey dates`);
  return imported;
}

// ============================================================
// MDS Quality Measures Import
// ============================================================
async function importMDSQualityMeasures(filePath, extractId) {
  console.log(`  Importing MDS Quality Measures: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'] || row['Federal Provider Number'];
    const measureCode = row['Measure Code'] || row['Measure_Code'];
    if (!ccn || !measureCode) continue;

    try {
      await pool.query(`
        INSERT INTO mds_quality_measures (extract_id, ccn, measure_code, measure_description,
          q1_score, q2_score, q3_score, q4_score, four_quarter_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
          four_quarter_score = EXCLUDED.four_quarter_score
      `, [
        extractId, ccn, measureCode,
        parseValue(row['Measure Description']),
        parseValue(row['Q1 Measure Score'] || row['Q1_Score'], 'decimal'),
        parseValue(row['Q2 Measure Score'] || row['Q2_Score'], 'decimal'),
        parseValue(row['Q3 Measure Score'] || row['Q3_Score'], 'decimal'),
        parseValue(row['Q4 Measure Score'] || row['Q4_Score'], 'decimal'),
        parseValue(row['Four Quarter Average Score'] || row['Score'], 'decimal')
      ]);
      imported++;
    } catch (e) {}
  }
  console.log(`    Imported ${imported} MDS quality measures`);
  return imported;
}

// ============================================================
// Claims Quality Measures Import
// ============================================================
async function importClaimsQualityMeasures(filePath, extractId) {
  console.log(`  Importing Claims Quality Measures: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'] || row['Federal Provider Number'];
    const measureCode = row['Measure Code'] || row['Measure_Code'];
    if (!ccn || !measureCode) continue;

    try {
      await pool.query(`
        INSERT INTO claims_quality_measures (extract_id, ccn, measure_code, measure_description, score)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (extract_id, ccn, measure_code) DO UPDATE SET
          score = EXCLUDED.score
      `, [
        extractId, ccn, measureCode,
        parseValue(row['Measure Description']),
        parseValue(row['Score'] || row['Measure Score'], 'decimal')
      ]);
      imported++;
    } catch (e) {}
  }
  console.log(`    Imported ${imported} claims quality measures`);
  return imported;
}

// ============================================================
// State/National Averages Import
// ============================================================
async function importStateAverages(filePath, extractId) {
  console.log(`  Importing State/National Averages: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const state = row['State'] || row['STATE'];
    const measureCode = row['Measure Code'] || row['Attribute'];
    if (!measureCode) continue;

    try {
      await pool.query(`
        INSERT INTO state_national_averages (extract_id, state_code, measure_code, average_value)
        VALUES ($1, $2, $3, $4)
      `, [
        extractId,
        state === 'NATION' ? null : state,
        measureCode,
        parseValue(row['Score'] || row['Average'] || row['Value'], 'decimal')
      ]);
      imported++;
    } catch (e) {}
  }
  console.log(`    Imported ${imported} state/national averages`);
  return imported;
}

// ============================================================
// Citation Descriptions Import
// ============================================================
async function importCitationDescriptions(filePath) {
  console.log(`  Importing Citation Descriptions: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const tag = row['Deficiency Tag Number'] || row['Tag'];
    if (!tag) continue;

    try {
      await pool.query(`
        INSERT INTO citation_descriptions (deficiency_tag, tag_prefix, category, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (deficiency_tag) DO UPDATE SET
          description = EXCLUDED.description
      `, [
        tag,
        tag.charAt(0),
        parseValue(row['Category'] || row['Deficiency Category']),
        parseValue(row['Description'] || row['Deficiency Description'] || row['Tag Description'])
      ]);
      imported++;
    } catch (e) {}
  }
  console.log(`    Imported ${imported} citation descriptions`);
  return imported;
}

// ============================================================
// COVID Vaccination Import
// ============================================================
async function importCovidVaccination(filePath, extractId) {
  console.log(`  Importing COVID Vaccination: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'] || row['Federal Provider Number'] || row['Provider ID'];
    if (!ccn) continue;

    try {
      await pool.query(`
        INSERT INTO covid_vaccination (extract_id, ccn, staff_vaccination_rate, resident_vaccination_rate)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (extract_id, ccn) DO UPDATE SET
          staff_vaccination_rate = EXCLUDED.staff_vaccination_rate
      `, [
        extractId, ccn,
        parseValue(row['Percentage of Current Healthcare Personnel Up to Date with COVID-19 Vaccines'] || row['Staff Vaccination Rate'], 'decimal'),
        parseValue(row['Percentage of Current Residents Up to Date with COVID-19 Vaccines'] || row['Resident Vaccination Rate'], 'decimal')
      ]);
      imported++;
    } catch (e) {}
  }
  console.log(`    Imported ${imported} COVID vaccination records`);
  return imported;
}

// ============================================================
// Extract and Import All Files
// ============================================================
async function extractArchive(zipPath, targetDir) {
  if (fs.existsSync(targetDir)) execSync(`rm -rf "${targetDir}"`);
  fs.mkdirSync(targetDir, { recursive: true });
  execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`, { stdio: 'pipe' });

  const nestedZips = fs.readdirSync(targetDir).filter(f => f.endsWith('.zip'));
  if (nestedZips.length > 0) {
    const latestZip = nestedZips.sort().pop();
    const monthDir = path.join(targetDir, 'month');
    fs.mkdirSync(monthDir, { recursive: true });
    execSync(`unzip -q -o "${path.join(targetDir, latestZip)}" -d "${monthDir}"`, { stdio: 'pipe' });
    return monthDir;
  }
  return targetDir;
}

function getExtractDate(filename) {
  const monthMatch = filename.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i);
  if (monthMatch) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                     jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    return `${monthMatch[2]}-${months[monthMatch[1].toLowerCase()]}-01`;
  }
  const yearMatch = filename.match(/(\d{4})/);
  if (yearMatch) return `${yearMatch[1]}-12-01`;
  return null;
}

async function importAllFilesFromDir(dataDir, extractId) {
  const findFile = (pattern) => findFilesRecursive(dataDir, pattern).sort().pop();

  // VBP
  const vbpFile = findFile('VBP_Facility_Performance');
  if (vbpFile) await importVBP(vbpFile, extractId);

  // Ownership
  const ownershipFile = findFile('NH_Ownership');
  if (ownershipFile) await importOwnership(ownershipFile, extractId);

  // Penalties
  const penaltiesFile = findFile('NH_Penalties');
  if (penaltiesFile) await importPenalties(penaltiesFile, extractId);

  // Health Citations
  const healthCitationsFile = findFile('NH_HealthCitations');
  if (healthCitationsFile) await importHealthCitations(healthCitationsFile, extractId);

  // Fire Safety Citations
  const fireCitationsFile = findFile('NH_FireSafetyCitations');
  if (fireCitationsFile) await importFireSafetyCitations(fireCitationsFile, extractId);

  // Survey Dates
  const surveyDatesFile = findFile('NH_SurveyDates');
  if (surveyDatesFile) await importSurveyDates(surveyDatesFile, extractId);

  // MDS Quality Measures
  const mdsFile = findFile('NH_QualityMsr_MDS');
  if (mdsFile) await importMDSQualityMeasures(mdsFile, extractId);

  // Claims Quality Measures
  const claimsFile = findFile('NH_QualityMsr_Claims');
  if (claimsFile) await importClaimsQualityMeasures(claimsFile, extractId);

  // State Averages
  const stateAvgFile = findFile('NH_StateUSAverages');
  if (stateAvgFile) await importStateAverages(stateAvgFile, extractId);

  // Citation Descriptions (only need once)
  const citationDescFile = findFile('NH_CitationDescriptions');
  if (citationDescFile) await importCitationDescriptions(citationDescFile);

  // COVID Vaccination
  const covidFile = findFile('CovidVaxProvider');
  if (covidFile) await importCovidVaccination(covidFile, extractId);
}

async function main() {
  console.log('='.repeat(60));
  console.log('COMPLETE CMS DATA IMPORT');
  console.log('='.repeat(60));

  if (fs.existsSync(TEMP_DIR)) execSync(`rm -rf "${TEMP_DIR}"`);
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  try {
    // Historical archives
    const archives = fs.readdirSync(HISTORICAL_DIR)
      .filter(f => f.endsWith('.zip'))
      .sort()
      .map(f => path.join(HISTORICAL_DIR, f));

    console.log(`\nFound ${archives.length} historical archives\n`);

    for (const archive of archives) {
      const sourceName = path.basename(archive);
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Processing: ${sourceName}`);

      const extractDir = path.join(TEMP_DIR, sourceName.replace('.zip', ''));
      const dataDir = await extractArchive(archive, extractDir);

      const extractDate = getExtractDate(sourceName);
      if (!extractDate) continue;

      console.log(`  Extract date: ${extractDate}`);
      const extractId = await getOrCreateExtract(extractDate, sourceName);
      console.log(`  Extract ID: ${extractId}`);

      await importAllFilesFromDir(dataDir, extractId);
    }

    // Current data
    if (fs.existsSync(CURRENT_DATA_DIR)) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log('Processing: Current data (December 2025)');

      const extractDate = '2025-11-01';
      const extractId = await getOrCreateExtract(extractDate, 'nursing_homes_including_rehab_services_12_2025');
      console.log(`  Extract ID: ${extractId}`);

      await importAllFilesFromDir(CURRENT_DATA_DIR, extractId);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));

    const counts = await pool.query(`
      SELECT 'vbp_scores' as tbl, COUNT(*) as cnt FROM vbp_scores
      UNION ALL SELECT 'ownership_records', COUNT(*) FROM ownership_records
      UNION ALL SELECT 'penalty_records', COUNT(*) FROM penalty_records
      UNION ALL SELECT 'health_citations', COUNT(*) FROM health_citations
      UNION ALL SELECT 'fire_safety_citations', COUNT(*) FROM fire_safety_citations
      UNION ALL SELECT 'survey_dates', COUNT(*) FROM survey_dates
      UNION ALL SELECT 'mds_quality_measures', COUNT(*) FROM mds_quality_measures
      UNION ALL SELECT 'claims_quality_measures', COUNT(*) FROM claims_quality_measures
      UNION ALL SELECT 'citation_descriptions', COUNT(*) FROM citation_descriptions
      UNION ALL SELECT 'covid_vaccination', COUNT(*) FROM covid_vaccination
      ORDER BY tbl
    `);

    console.log('\nRecords imported:');
    counts.rows.forEach(r => console.log(`  ${r.tbl}: ${parseInt(r.cnt).toLocaleString()}`));

  } finally {
    execSync(`rm -rf "${TEMP_DIR}"`);
    await pool.end();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
