/**
 * Comprehensive CMS Data Import
 * - Updates snf_facilities with ALL available columns
 * - Imports historical VBP data (FY 2021-2026)
 * - Imports ownership records
 * - Imports penalty records
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
const pool = new Pool({ connectionString });

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

const parseNum = (val) => {
  if (!val || val === '' || val === 'N/A' || val === 'NA') return null;
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
};

const parseBool = (val) => {
  if (!val || val === '' || val === 'N/A') return null;
  return /^(Y|Yes|True|1)$/i.test(val);
};

const parseDate = (val) => {
  if (!val || val === '' || val === 'N/A') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

async function updateProviderInfo() {
  const client = await pool.connect();
  try {
    console.log('\n========================================');
    console.log('UPDATING PROVIDER INFO (ALL COLUMNS)');
    console.log('========================================\n');

    const dataDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data';
    const providerFile = path.join(dataDir, 'NH_ProviderInfo_Nov2025.csv');

    const content = fs.readFileSync(providerFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    // Create header index map
    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    let updated = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[h['CMS Certification Number (CCN)']]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          UPDATE snf_facilities SET
            -- Staffing Hours
            pt_staffing_hours = COALESCE($2, pt_staffing_hours),
            weekend_rn_hours = COALESCE($3, weekend_rn_hours),

            -- Turnover
            rn_turnover = COALESCE($4, rn_turnover),
            admin_departures = COALESCE($5, admin_departures),

            -- Case-Mix Index
            nursing_case_mix_index = COALESCE($6, nursing_case_mix_index),
            nursing_case_mix_ratio = COALESCE($7, nursing_case_mix_ratio),

            -- Case-Mix Adjusted Staffing
            case_mix_cna_hours = COALESCE($8, case_mix_cna_hours),
            case_mix_lpn_hours = COALESCE($9, case_mix_lpn_hours),
            case_mix_rn_hours = COALESCE($10, case_mix_rn_hours),
            case_mix_total_nurse_hours = COALESCE($11, case_mix_total_nurse_hours),
            case_mix_weekend_hours = COALESCE($12, case_mix_weekend_hours),

            -- Adjusted Staffing
            adjusted_cna_hours = COALESCE($13, adjusted_cna_hours),
            adjusted_lpn_hours = COALESCE($14, adjusted_lpn_hours),
            adjusted_rn_hours = COALESCE($15, adjusted_rn_hours),
            adjusted_total_nurse_hours = COALESCE($16, adjusted_total_nurse_hours),
            adjusted_weekend_hours = COALESCE($17, adjusted_weekend_hours),

            -- Survey/Inspection
            last_health_inspection_date = COALESCE($18, last_health_inspection_date),
            weighted_health_score = COALESCE($19, weighted_health_score),
            standard_health_deficiencies = COALESCE($20, standard_health_deficiencies),

            -- Compliance
            infection_control_citations = COALESCE($21, infection_control_citations),
            total_fines_amount = COALESCE($22, total_fines_amount),
            payment_denial_count = COALESCE($23, payment_denial_count),

            -- Flags
            is_urban = COALESCE($24, is_urban),
            in_hospital = COALESCE($25, in_hospital),
            has_resident_council = COALESCE($26, has_resident_council),
            has_sprinkler_system = COALESCE($27, has_sprinkler_system),
            ownership_changed_12mo = COALESCE($28, ownership_changed_12mo),
            inspection_over_2yrs_ago = COALESCE($29, inspection_over_2yrs_ago),

            -- Other
            average_residents_per_day = COALESCE($30, average_residents_per_day),
            cms_processing_date = COALESCE($31, cms_processing_date)
          WHERE federal_provider_number = $1
        `, [
          ccn,
          parseNum(row[h['Reported Physical Therapist Staffing Hours per Resident Per Day']]),
          parseNum(row[h['Registered Nurse hours per resident per day on the weekend']]),
          parseNum(row[h['Registered Nurse turnover']]),
          parseNum(row[h['Number of administrators who have left the nursing home']]),
          parseNum(row[h['Nursing Case-Mix Index']]),
          parseNum(row[h['Nursing Case-Mix Index Ratio']]),
          parseNum(row[h['Case-Mix Nurse Aide Staffing Hours per Resident per Day']]),
          parseNum(row[h['Case-Mix LPN Staffing Hours per Resident per Day']]),
          parseNum(row[h['Case-Mix RN Staffing Hours per Resident per Day']]),
          parseNum(row[h['Case-Mix Total Nurse Staffing Hours per Resident per Day']]),
          parseNum(row[h['Case-Mix Weekend Total Nurse Staffing Hours per Resident per Day']]),
          parseNum(row[h['Adjusted Nurse Aide Staffing Hours per Resident per Day']]),
          parseNum(row[h['Adjusted LPN Staffing Hours per Resident per Day']]),
          parseNum(row[h['Adjusted RN Staffing Hours per Resident per Day']]),
          parseNum(row[h['Adjusted Total Nurse Staffing Hours per Resident per Day']]),
          parseNum(row[h['Adjusted Weekend Total Nurse Staffing Hours per Resident per Day']]),
          parseDate(row[h['Rating Cycle 1 Standard Survey Health Date']]),
          parseNum(row[h['Total Weighted Health Survey Score']]),
          parseNum(row[h['Rating Cycle 1 Number of Standard Health Deficiencies']]),
          parseNum(row[h['Number of Citations from Infection Control Inspections']]),
          parseNum(row[h['Total Amount of Fines in Dollars']]),
          parseNum(row[h['Number of Payment Denials']]),
          parseBool(row[h['Urban']]),
          parseBool(row[h['Provider Resides in Hospital']]),
          parseBool(row[h['With a Resident and Family Council']]),
          parseBool(row[h['Automatic Sprinkler Systems in All Required Areas']]),
          parseBool(row[h['Provider Changed Ownership in Last 12 Months']]),
          parseBool(row[h['Most Recent Health Inspection More Than 2 Years Ago']]),
          parseNum(row[h['Average Number of Residents per Day']]),
          parseDate(row[h['Processing Date']])
        ]);
        updated++;
      } catch (e) {
        // Skip errors
      }

      if (updated % 2000 === 0) {
        console.log(`  Updated ${updated} facilities...`);
      }
    }
    console.log(`\n✓ Updated ${updated} facilities with complete data`);
  } finally {
    client.release();
  }
}

async function importHistoricalVBP() {
  const client = await pool.connect();
  try {
    console.log('\n========================================');
    console.log('IMPORTING HISTORICAL VBP DATA');
    console.log('========================================\n');

    const baseDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data';
    const years = ['2021', '2022', '2023', '2024', '2025'];

    for (const year of years) {
      const yearDir = path.join(baseDir, year);
      if (!fs.existsSync(yearDir)) continue;

      const files = fs.readdirSync(yearDir).filter(f =>
        f.includes('VBP') && f.includes('Facility') && f.endsWith('.csv')
      );

      for (const file of files) {
        const match = file.match(/FY_(\d{4})/);
        const fiscalYear = match ? parseInt(match[1]) : null;
        if (!fiscalYear) continue;

        // Check if already imported
        const existing = await client.query(
          'SELECT COUNT(*) FROM vbp_scores WHERE fiscal_year = $1',
          [fiscalYear]
        );
        if (parseInt(existing.rows[0].count) > 0) {
          console.log(`  FY ${fiscalYear}: Already imported, skipping`);
          continue;
        }

        console.log(`  Importing ${file} (FY ${fiscalYear})...`);
        const filePath = path.join(yearDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        const headers = parseCSVLine(lines[0]);

        const h = {};
        headers.forEach((header, idx) => { h[header] = idx; });

        // Find CCN column (varies by year)
        const ccnKey = Object.keys(h).find(k => /CCN|Certification|Provider.*ID/i.test(k));
        const rankKey = Object.keys(h).find(k => /Ranking/i.test(k));
        const baselineKey = Object.keys(h).find(k => /Baseline.*Rate/i.test(k));
        const perfRateKey = Object.keys(h).find(k => /Performance.*Rate/i.test(k));
        const achKey = Object.keys(h).find(k => /Achievement.*Score/i.test(k));
        const impKey = Object.keys(h).find(k => /Improvement.*Score/i.test(k));
        const perfScoreKey = Object.keys(h).find(k => /^Performance Score$/i.test(k) || /Performance Score(?!.*Rate)/i.test(k));
        const multKey = Object.keys(h).find(k => /Multiplier/i.test(k));

        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          const ccn = row[h[ccnKey]]?.replace(/[^0-9A-Z]/gi, '');
          if (!ccn || ccn.length < 6) continue;

          try {
            await client.query(`
              INSERT INTO vbp_scores (fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
                performance_readmission_rate, achievement_score, improvement_score,
                performance_score, incentive_payment_multiplier)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (fiscal_year, ccn) DO NOTHING
            `, [
              fiscalYear,
              ccn,
              parseNum(row[h[rankKey]]),
              parseNum(row[h[baselineKey]]),
              parseNum(row[h[perfRateKey]]),
              parseNum(row[h[achKey]]),
              parseNum(row[h[impKey]]),
              parseNum(row[h[perfScoreKey]]),
              parseNum(row[h[multKey]])
            ]);
            imported++;
          } catch (e) {
            // Skip
          }
        }
        console.log(`    ✓ Imported ${imported} records`);
      }
    }

    const summary = await client.query(`
      SELECT fiscal_year, COUNT(*) as count
      FROM vbp_scores
      GROUP BY fiscal_year
      ORDER BY fiscal_year
    `);
    console.log('\nVBP Summary by Year:');
    for (const row of summary.rows) {
      console.log(`  FY ${row.fiscal_year}: ${row.count} records`);
    }
  } finally {
    client.release();
  }
}

async function importOwnershipData() {
  const client = await pool.connect();
  try {
    console.log('\n========================================');
    console.log('IMPORTING OWNERSHIP DATA');
    console.log('========================================\n');

    // Look for ownership files
    const baseDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data';
    const currentDir = path.join(baseDir, 'nursing_homes_including_rehab_services_current_data');

    // Check current directory
    let ownershipFile = null;
    if (fs.existsSync(currentDir)) {
      const files = fs.readdirSync(currentDir);
      ownershipFile = files.find(f => /NH_Ownership/i.test(f) && f.endsWith('.csv'));
      if (ownershipFile) {
        ownershipFile = path.join(currentDir, ownershipFile);
      }
    }

    // Check yearly directories
    if (!ownershipFile) {
      for (const year of ['2025', '2024', '2023']) {
        const yearDir = path.join(baseDir, year);
        if (!fs.existsSync(yearDir)) continue;
        const files = fs.readdirSync(yearDir);
        const found = files.find(f => /NH_Ownership/i.test(f) && f.endsWith('.csv'));
        if (found) {
          ownershipFile = path.join(yearDir, found);
          break;
        }
      }
    }

    if (!ownershipFile) {
      console.log('No ownership file found');

      // List what files we do have
      console.log('\nAvailable files in current data:');
      if (fs.existsSync(currentDir)) {
        fs.readdirSync(currentDir).forEach(f => console.log(`  ${f}`));
      }
      return;
    }

    console.log(`Reading ${path.basename(ownershipFile)}...`);
    const content = fs.readFileSync(ownershipFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    console.log('Headers:', headers.slice(0, 10));

    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    const ccnKey = Object.keys(h).find(k => /CCN|Certification|Provider/i.test(k));
    const roleKey = Object.keys(h).find(k => /Role/i.test(k));
    const typeKey = Object.keys(h).find(k => /Type/i.test(k) && !/Role/i.test(k));
    const nameKey = Object.keys(h).find(k => /Name/i.test(k) && !/Provider/i.test(k));
    const pctKey = Object.keys(h).find(k => /Percent|Percentage/i.test(k));
    const dateKey = Object.keys(h).find(k => /Association.*Date|Date/i.test(k));

    if (!ccnKey) {
      console.log('CCN column not found');
      return;
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[h[ccnKey]]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          INSERT INTO ownership_records (ccn, role_type, owner_type, owner_name, ownership_percentage, association_date)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          ccn,
          row[h[roleKey]] || null,
          row[h[typeKey]] || null,
          row[h[nameKey]] || null,
          parseNum(row[h[pctKey]]),
          parseDate(row[h[dateKey]])
        ]);
        imported++;
      } catch (e) {
        // Skip duplicates/errors
      }

      if (imported % 10000 === 0 && imported > 0) {
        console.log(`  Imported ${imported} records...`);
      }
    }
    console.log(`\n✓ Imported ${imported} ownership records`);

    const summary = await client.query(`
      SELECT COUNT(*) as total, COUNT(DISTINCT ccn) as facilities
      FROM ownership_records
    `);
    console.log(`  Total records: ${summary.rows[0].total}`);
    console.log(`  Unique facilities: ${summary.rows[0].facilities}`);

  } finally {
    client.release();
  }
}

async function importPenaltyData() {
  const client = await pool.connect();
  try {
    console.log('\n========================================');
    console.log('IMPORTING PENALTY DATA');
    console.log('========================================\n');

    const baseDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data';
    const currentDir = path.join(baseDir, 'nursing_homes_including_rehab_services_current_data');

    let penaltyFile = null;
    if (fs.existsSync(currentDir)) {
      const files = fs.readdirSync(currentDir);
      penaltyFile = files.find(f => /NH_Penalty|NH_Penalt/i.test(f) && f.endsWith('.csv'));
      if (penaltyFile) {
        penaltyFile = path.join(currentDir, penaltyFile);
      }
    }

    if (!penaltyFile) {
      for (const year of ['2025', '2024', '2023']) {
        const yearDir = path.join(baseDir, year);
        if (!fs.existsSync(yearDir)) continue;
        const files = fs.readdirSync(yearDir);
        const found = files.find(f => /NH_Penalty|NH_Penalt/i.test(f) && f.endsWith('.csv'));
        if (found) {
          penaltyFile = path.join(yearDir, found);
          break;
        }
      }
    }

    if (!penaltyFile) {
      console.log('No penalty file found in current data');
      return;
    }

    console.log(`Reading ${path.basename(penaltyFile)}...`);
    const content = fs.readFileSync(penaltyFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    console.log('Headers:', headers);

    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    const ccnKey = Object.keys(h).find(k => /CCN|Certification|Provider/i.test(k));
    const dateKey = Object.keys(h).find(k => /Penalty.*Date|Date/i.test(k));
    const typeKey = Object.keys(h).find(k => /Type/i.test(k));
    const amountKey = Object.keys(h).find(k => /Amount|Fine/i.test(k));

    if (!ccnKey) {
      console.log('CCN column not found');
      return;
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[h[ccnKey]]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          INSERT INTO penalty_records (ccn, penalty_date, penalty_type, fine_amount)
          VALUES ($1, $2, $3, $4)
        `, [
          ccn,
          parseDate(row[h[dateKey]]),
          row[h[typeKey]] || null,
          parseNum(row[h[amountKey]])
        ]);
        imported++;
      } catch (e) {
        // Skip
      }

      if (imported % 5000 === 0 && imported > 0) {
        console.log(`  Imported ${imported} records...`);
      }
    }
    console.log(`\n✓ Imported ${imported} penalty records`);

  } finally {
    client.release();
  }
}

async function main() {
  console.log('====================================');
  console.log('COMPREHENSIVE CMS DATA IMPORT');
  console.log('====================================');

  try {
    await updateProviderInfo();
    await importHistoricalVBP();
    await importOwnershipData();
    await importPenaltyData();

    console.log('\n====================================');
    console.log('IMPORT COMPLETE - FINAL SUMMARY');
    console.log('====================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
