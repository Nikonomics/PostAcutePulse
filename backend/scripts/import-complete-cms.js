/**
 * Import ALL CMS data from May 2025 download
 * Includes: Ownership, Penalties, COVID Vax, Historical VBP
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
const pool = new Pool({ connectionString });

const DATA_DIR = '/Users/nikolashulewsky/Downloads/nursing_homes_including_rehab_services_05_2025';

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

const parseDate = (val) => {
  if (!val || val === '' || val === 'N/A') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

async function importOwnership() {
  const client = await pool.connect();
  try {
    console.log('\n=== IMPORTING OWNERSHIP DATA ===\n');

    const filePath = path.join(DATA_DIR, 'NH_Ownership_May2025.csv');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    console.log('Headers:', headers.slice(0, 8));

    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    // Clear existing data
    await client.query('TRUNCATE ownership_records');

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[0]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          INSERT INTO ownership_records (ccn, role_type, owner_type, owner_name, ownership_percentage, association_date)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          ccn,
          row[h['Role played by Owner or Manager in Facility']] || row[2] || null,
          row[h['Owner Type']] || row[3] || null,
          row[h['Owner Name']] || row[4] || null,
          parseNum(row[h['Ownership Percentage']] || row[5]),
          parseDate(row[h['Association Date']] || row[6])
        ]);
        imported++;
      } catch (e) {
        // Skip
      }

      if (imported % 50000 === 0) {
        console.log(`  Imported ${imported} records...`);
      }
    }

    console.log(`✓ Imported ${imported} ownership records`);

    const summary = await client.query(`
      SELECT COUNT(*) as total, COUNT(DISTINCT ccn) as facilities FROM ownership_records
    `);
    console.log(`  Total: ${summary.rows[0].total}, Facilities: ${summary.rows[0].facilities}`);

  } finally {
    client.release();
  }
}

async function importPenalties() {
  const client = await pool.connect();
  try {
    console.log('\n=== IMPORTING PENALTY DATA ===\n');

    const filePath = path.join(DATA_DIR, 'NH_Penalties_May2025.csv');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    console.log('Headers:', headers);

    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    // Clear existing
    await client.query('TRUNCATE penalty_records');

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[0]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          INSERT INTO penalty_records (ccn, penalty_date, penalty_type, fine_amount, payment_denial_start_date, payment_denial_days)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          ccn,
          parseDate(row[h['Penalty Date']] || row[2]),
          row[h['Penalty Type']] || row[3] || null,
          parseNum(row[h['Fine Amount']] || row[4]),
          parseDate(row[h['Payment Denial Start Date']] || row[5]),
          parseNum(row[h['Payment Denial Length in Days']] || row[6])
        ]);
        imported++;
      } catch (e) {
        // Skip
      }

      if (imported % 10000 === 0) {
        console.log(`  Imported ${imported} records...`);
      }
    }

    console.log(`✓ Imported ${imported} penalty records`);

  } finally {
    client.release();
  }
}

async function importCovidVax() {
  const client = await pool.connect();
  try {
    console.log('\n=== IMPORTING COVID VACCINATION DATA ===\n');

    const filePath = path.join(DATA_DIR, 'NH_CovidVaxProvider_20250511.csv');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    console.log('Headers:', headers);

    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    // Clear existing
    await client.query('TRUNCATE covid_vaccination');

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[0]?.replace(/[^0-9A-Z]/gi, '');
      if (!ccn || ccn.length < 6) continue;

      try {
        await client.query(`
          INSERT INTO covid_vaccination (ccn, staff_vaccination_rate, staff_up_to_date_rate, resident_vaccination_rate, resident_up_to_date_rate)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (ccn) DO UPDATE SET
            staff_vaccination_rate = EXCLUDED.staff_vaccination_rate,
            staff_up_to_date_rate = EXCLUDED.staff_up_to_date_rate,
            resident_vaccination_rate = EXCLUDED.resident_vaccination_rate,
            resident_up_to_date_rate = EXCLUDED.resident_up_to_date_rate
        `, [
          ccn,
          parseNum(row[h['Percentage of Current Healthcare Personnel Who Received a Completed COVID-19 Vaccination at Any Time']] || row[9]),
          parseNum(row[h['Percentage of Current Healthcare Personnel Up to Date with COVID-19 Vaccines']] || row[10]),
          parseNum(row[h['Percentage of Current Residents Who Received a Completed COVID-19 Vaccination at Any Time']] || row[11]),
          parseNum(row[h['Percentage of Current Residents Up to Date with COVID-19 Vaccines']] || row[12])
        ]);
        imported++;
      } catch (e) {
        // Skip
      }
    }

    console.log(`✓ Imported ${imported} COVID vaccination records`);

  } finally {
    client.release();
  }
}

async function importHistoricalVBP() {
  const client = await pool.connect();
  try {
    console.log('\n=== IMPORTING VBP FY 2025 ===\n');

    const filePath = path.join(DATA_DIR, 'FY_2025_SNF_VBP_Facility_Performance.csv');
    if (!fs.existsSync(filePath)) {
      console.log('FY 2025 VBP file not found');
      return;
    }

    // Check if already imported
    const existing = await client.query('SELECT COUNT(*) FROM vbp_scores WHERE fiscal_year = 2025');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('FY 2025 already imported, skipping');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    const h = {};
    headers.forEach((header, idx) => { h[header] = idx; });

    const ccnKey = Object.keys(h).find(k => /CCN|Certification/i.test(k));

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
          2025,
          ccn,
          parseNum(row[h['Ranking']] || row[3]),
          parseNum(row[h['Baseline Rate']] || row[4]),
          parseNum(row[h['Performance Rate']] || row[6]),
          parseNum(row[h['Achievement Score']] || row[8]),
          parseNum(row[h['Improvement Score']] || row[9]),
          parseNum(row[h['Performance Score']] || row[10]),
          parseNum(row[h['Incentive Payment Multiplier']] || row[11])
        ]);
        imported++;
      } catch (e) {
        // Skip
      }
    }

    console.log(`✓ Imported ${imported} VBP FY 2025 records`);

  } finally {
    client.release();
  }
}

async function main() {
  console.log('==========================================');
  console.log('IMPORTING COMPLETE CMS DATA (May 2025)');
  console.log('==========================================');

  try {
    await importOwnership();
    await importPenalties();
    await importCovidVax();
    await importHistoricalVBP();

    console.log('\n==========================================');
    console.log('IMPORT COMPLETE');
    console.log('==========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
