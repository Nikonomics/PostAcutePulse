/**
 * Import supplementary CMS data (ownership, penalties, citations, VBP, surveys)
 * from the files in /private/tmp/cms_inventory/
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { parse } = require('csv-parse');
const { createReadStream } = require('fs');

const sequelize = new Sequelize('postgresql://localhost:5432/snf_platform', { logging: false });

const DATA_DIR = '/private/tmp/cms_inventory';
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

async function getOrCreateExtract(extractDate, sourceFile) {
  const [existing] = await sequelize.query(
    'SELECT extract_id FROM cms_extracts WHERE extract_date = :extractDate',
    { replacements: { extractDate }, type: Sequelize.QueryTypes.SELECT }
  );
  if (existing) return existing.extract_id;

  const [result] = await sequelize.query(
    `INSERT INTO cms_extracts (extract_date, source_file, import_started_at, import_status)
     VALUES (:extractDate, :sourceFile, CURRENT_TIMESTAMP, 'importing') RETURNING extract_id`,
    { replacements: { extractDate, sourceFile }, type: Sequelize.QueryTypes.INSERT }
  );
  return result[0].extract_id;
}

// ============================================================
// VBP Import
// ============================================================
async function importVBP(filePath, extractId) {
  console.log(`\nImporting VBP: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  const fyMatch = path.basename(filePath).match(/FY_(\d{4})/);
  const fiscalYear = fyMatch ? parseInt(fyMatch[1]) : 2024;

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await sequelize.query(`
        INSERT INTO vbp_scores (extract_id, fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
          performance_readmission_rate, achievement_score, improvement_score, performance_score,
          incentive_payment_multiplier)
        VALUES (:extractId, :fiscalYear, :ccn, :ranking, :baseline, :performance, :achievement, :improvement, :perfScore, :multiplier)
        ON CONFLICT (fiscal_year, ccn) DO UPDATE SET
          vbp_ranking = EXCLUDED.vbp_ranking,
          incentive_payment_multiplier = EXCLUDED.incentive_payment_multiplier
      `, {
        replacements: {
          extractId, fiscalYear, ccn,
          ranking: parseValue(row['SNF VBP Program Ranking'], 'int'),
          baseline: parseValue(row['Baseline Period: FY 2019 Risk-Standardized Readmission Rate'], 'decimal'),
          performance: parseValue(row['Performance Period: FY 2022 Risk-Standardized Readmission Rate'], 'decimal'),
          achievement: parseValue(row['Achievement Score'], 'decimal'),
          improvement: parseValue(row['Improvement Score'], 'decimal'),
          perfScore: parseValue(row['Performance Score'], 'decimal'),
          multiplier: parseValue(row['Incentive Payment Multiplier'], 'decimal')
        }
      });
      imported++;
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`  Imported ${imported.toLocaleString()} VBP records`);
  return imported;
}

// ============================================================
// Ownership Import
// ============================================================
async function importOwnership(filePath, extractId) {
  console.log(`\nImporting Ownership: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  // Clear existing records for this extract
  await sequelize.query('DELETE FROM ownership_records WHERE extract_id = :extractId', { replacements: { extractId } });

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await sequelize.query(`
        INSERT INTO ownership_records (extract_id, ccn, role_type, owner_type, owner_name,
          ownership_percentage, association_date, cms_processing_date)
        VALUES (:extractId, :ccn, :role, :ownerType, :ownerName, :pct, :assocDate, :procDate)
      `, {
        replacements: {
          extractId, ccn,
          role: parseValue(row['Role played by Owner or Manager in Facility']),
          ownerType: parseValue(row['Owner Type']),
          ownerName: parseValue(row['Owner Name']),
          pct: parseValue(row['Ownership Percentage'], 'decimal'),
          assocDate: parseValue(row['Association Date'], 'date'),
          procDate: parseValue(row['Processing Date'], 'date')
        }
      });
      imported++;
      if (imported % 10000 === 0) process.stdout.write(`\r  Imported ${imported.toLocaleString()} records...`);
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`\r  Imported ${imported.toLocaleString()} ownership records`);
  return imported;
}

// ============================================================
// Penalties Import
// ============================================================
async function importPenalties(filePath, extractId) {
  console.log(`\nImporting Penalties: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  // Clear existing records for this extract
  await sequelize.query('DELETE FROM penalty_records WHERE extract_id = :extractId', { replacements: { extractId } });

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await sequelize.query(`
        INSERT INTO penalty_records (extract_id, ccn, penalty_date, penalty_type, fine_amount,
          payment_denial_start_date, payment_denial_days, cms_processing_date)
        VALUES (:extractId, :ccn, :penaltyDate, :penaltyType, :fineAmount, :denialStart, :denialDays, :procDate)
      `, {
        replacements: {
          extractId, ccn,
          penaltyDate: parseValue(row['Penalty Date'], 'date'),
          penaltyType: parseValue(row['Penalty Type']),
          fineAmount: parseValue(row['Fine Amount'], 'decimal'),
          denialStart: parseValue(row['Payment Denial Start Date'], 'date'),
          denialDays: parseValue(row['Payment Denial Length in Days'], 'int'),
          procDate: parseValue(row['Processing Date'], 'date')
        }
      });
      imported++;
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`  Imported ${imported.toLocaleString()} penalty records`);
  return imported;
}

// ============================================================
// Health Citations Import
// ============================================================
async function importHealthCitations(filePath, extractId) {
  console.log(`\nImporting Health Citations: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  // Clear existing records for this extract
  await sequelize.query('DELETE FROM health_citations WHERE extract_id = :extractId', { replacements: { extractId } });

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await sequelize.query(`
        INSERT INTO health_citations (extract_id, ccn, survey_date, survey_type, deficiency_prefix,
          deficiency_category, deficiency_tag, deficiency_description, scope_severity_code,
          deficiency_corrected, correction_date, inspection_cycle, is_standard_deficiency,
          is_complaint_deficiency, is_infection_control, is_under_idr, cms_processing_date)
        VALUES (:extractId, :ccn, :surveyDate, :surveyType, :prefix, :category, :tag, :desc,
          :severity, :corrected, :correctionDate, :cycle, :isStandard, :isComplaint, :isInfection, :isIdr, :procDate)
      `, {
        replacements: {
          extractId, ccn,
          surveyDate: parseValue(row['Survey Date'], 'date'),
          surveyType: parseValue(row['Survey Type']),
          prefix: parseValue(row['Deficiency Prefix']),
          category: parseValue(row['Deficiency Category']),
          tag: parseValue(row['Deficiency Tag Number']),
          desc: parseValue(row['Deficiency Description']),
          severity: parseValue(row['Scope Severity Code']),
          corrected: parseValue(row['Deficiency Corrected'], 'bool'),
          correctionDate: parseValue(row['Correction Date'], 'date'),
          cycle: parseValue(row['Inspection Cycle'], 'int'),
          isStandard: parseValue(row['Standard Deficiency'], 'bool'),
          isComplaint: parseValue(row['Complaint Deficiency'], 'bool'),
          isInfection: parseValue(row['Infection Control Inspection Deficiency'], 'bool'),
          isIdr: parseValue(row['Citation under IDR'], 'bool'),
          procDate: parseValue(row['Processing Date'], 'date')
        }
      });
      imported++;
      if (imported % 10000 === 0) process.stdout.write(`\r  Imported ${imported.toLocaleString()} citations...`);
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`\r  Imported ${imported.toLocaleString()} health citations`);
  return imported;
}

// ============================================================
// Fire Safety Citations Import
// ============================================================
async function importFireSafetyCitations(filePath, extractId) {
  console.log(`\nImporting Fire Safety Citations: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  // Clear existing records for this extract
  await sequelize.query('DELETE FROM fire_safety_citations WHERE extract_id = :extractId', { replacements: { extractId } });

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await sequelize.query(`
        INSERT INTO fire_safety_citations (extract_id, ccn, survey_date, survey_type, deficiency_prefix,
          deficiency_category, deficiency_tag, deficiency_description, scope_severity_code,
          deficiency_corrected, correction_date, inspection_cycle, is_standard_deficiency,
          is_complaint_deficiency, cms_processing_date)
        VALUES (:extractId, :ccn, :surveyDate, :surveyType, :prefix, :category, :tag, :desc,
          :severity, :corrected, :correctionDate, :cycle, :isStandard, :isComplaint, :procDate)
      `, {
        replacements: {
          extractId, ccn,
          surveyDate: parseValue(row['Survey Date'], 'date'),
          surveyType: parseValue(row['Survey Type']),
          prefix: parseValue(row['Deficiency Prefix']),
          category: parseValue(row['Deficiency Category']),
          tag: parseValue(row['Deficiency Tag Number']),
          desc: parseValue(row['Deficiency Description']),
          severity: parseValue(row['Scope Severity Code']),
          corrected: parseValue(row['Deficiency Corrected'], 'bool'),
          correctionDate: parseValue(row['Correction Date'], 'date'),
          cycle: parseValue(row['Inspection Cycle'], 'int'),
          isStandard: parseValue(row['Standard Deficiency'], 'bool'),
          isComplaint: parseValue(row['Complaint Deficiency'], 'bool'),
          procDate: parseValue(row['Processing Date'], 'date')
        }
      });
      imported++;
      if (imported % 10000 === 0) process.stdout.write(`\r  Imported ${imported.toLocaleString()} citations...`);
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`\r  Imported ${imported.toLocaleString()} fire safety citations`);
  return imported;
}

// ============================================================
// Survey Dates Import
// ============================================================
async function importSurveyDates(filePath, extractId) {
  console.log(`\nImporting Survey Dates: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  // Clear existing records for this extract
  await sequelize.query('DELETE FROM survey_dates WHERE extract_id = :extractId', { replacements: { extractId } });

  let imported = 0;
  for (const row of rows) {
    const ccn = row['CMS Certification Number (CCN)'];
    if (!ccn) continue;

    try {
      await sequelize.query(`
        INSERT INTO survey_dates (extract_id, ccn, survey_date, survey_type, cms_processing_date)
        VALUES (:extractId, :ccn, :surveyDate, :surveyType, :procDate)
      `, {
        replacements: {
          extractId, ccn,
          surveyDate: parseValue(row['Survey Date'], 'date'),
          surveyType: parseValue(row['Survey Type']),
          procDate: parseValue(row['Processing Date'], 'date')
        }
      });
      imported++;
      if (imported % 10000 === 0) process.stdout.write(`\r  Imported ${imported.toLocaleString()} records...`);
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`\r  Imported ${imported.toLocaleString()} survey dates`);
  return imported;
}

// ============================================================
// Citation Descriptions Import
// ============================================================
async function importCitationDescriptions(filePath) {
  console.log(`\nImporting Citation Descriptions: ${path.basename(filePath)}...`);
  const rows = await readCSV(filePath);
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const tag = row['Deficiency Tag Number'] || row['Tag'];
    if (!tag) continue;

    try {
      await sequelize.query(`
        INSERT INTO citation_descriptions (deficiency_tag, tag_prefix, category, description)
        VALUES (:tag, :prefix, :category, :desc)
        ON CONFLICT (deficiency_tag) DO UPDATE SET
          description = EXCLUDED.description
      `, {
        replacements: {
          tag,
          prefix: tag.charAt(0),
          category: parseValue(row['Category'] || row['Deficiency Category']),
          desc: parseValue(row['Description'] || row['Deficiency Description'] || row['Tag Description'])
        }
      });
      imported++;
    } catch (e) {
      if (imported === 0) console.error('  Error:', e.message);
    }
  }
  console.log(`  Imported ${imported.toLocaleString()} citation descriptions`);
  return imported;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('='.repeat(60));
  console.log('IMPORTING SUPPLEMENTARY CMS DATA');
  console.log('='.repeat(60));
  console.log(`\nData directory: ${DATA_DIR}`);

  try {
    // Use October 2024 extract date for this data
    const extractDate = '2024-10-01';
    console.log(`\nUsing extract date: ${extractDate}`);

    const extractId = await getOrCreateExtract(extractDate, 'cms_inventory_oct2024');
    console.log(`Extract ID: ${extractId}`);

    // Import each data type
    const vbpFile = path.join(DATA_DIR, 'FY_2024_SNF_VBP_Facility_Performance.csv');
    if (fs.existsSync(vbpFile)) await importVBP(vbpFile, extractId);

    const ownershipFile = path.join(DATA_DIR, 'NH_Ownership_Oct2024.csv');
    if (fs.existsSync(ownershipFile)) await importOwnership(ownershipFile, extractId);

    const penaltiesFile = path.join(DATA_DIR, 'NH_Penalties_Oct2024.csv');
    if (fs.existsSync(penaltiesFile)) await importPenalties(penaltiesFile, extractId);

    const surveyDatesFile = path.join(DATA_DIR, 'NH_SurveyDates_Oct2024.csv');
    if (fs.existsSync(surveyDatesFile)) await importSurveyDates(surveyDatesFile, extractId);

    const healthCitationsFile = path.join(DATA_DIR, 'NH_HealthCitations_Oct2024.csv');
    if (fs.existsSync(healthCitationsFile)) await importHealthCitations(healthCitationsFile, extractId);

    const fireCitationsFile = path.join(DATA_DIR, 'NH_FireSafetyCitations_Oct2024.csv');
    if (fs.existsSync(fireCitationsFile)) await importFireSafetyCitations(fireCitationsFile, extractId);

    const citationDescFile = path.join(DATA_DIR, 'NH_CitationDescriptions_Oct2024.csv');
    if (fs.existsSync(citationDescFile)) await importCitationDescriptions(citationDescFile);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));

    const [counts] = await sequelize.query(`
      SELECT 'vbp_scores' as tbl, COUNT(*) as cnt FROM vbp_scores
      UNION ALL SELECT 'ownership_records', COUNT(*) FROM ownership_records
      UNION ALL SELECT 'penalty_records', COUNT(*) FROM penalty_records
      UNION ALL SELECT 'health_citations', COUNT(*) FROM health_citations
      UNION ALL SELECT 'fire_safety_citations', COUNT(*) FROM fire_safety_citations
      UNION ALL SELECT 'survey_dates', COUNT(*) FROM survey_dates
      UNION ALL SELECT 'citation_descriptions', COUNT(*) FROM citation_descriptions
      ORDER BY tbl
    `);

    console.log('\nRecords in database:');
    counts.forEach(r => console.log(`  ${r.tbl}: ${parseInt(r.cnt).toLocaleString()}`));

  } finally {
    await sequelize.close();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
