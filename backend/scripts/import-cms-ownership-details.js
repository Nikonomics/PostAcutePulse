/**
 * Import CMS NH_Ownership detailed ownership data
 *
 * This imports the detailed ownership records that show:
 * - Individual owners and their names
 * - Ownership percentages
 * - Owner types (Individual, Corporation, etc.)
 * - Association dates (when they became owners)
 *
 * Usage: DATABASE_URL=... node scripts/import-cms-ownership-details.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const pool = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
});

const HISTORICAL_DIR = process.env.HOME + '/Desktop/cms_historical_data';
const TEMP_DIR = '/tmp/cms_ownership_import';

// Column mappings for NH_Ownership file
const OWNERSHIP_COLUMN_MAP = {
  ccn: ['CMS Certification Number (CCN)', 'Federal Provider Number'],
  provider_name: ['Provider Name'],
  owner_role: ['Role played by Owner or Manager in Facility'],
  owner_type: ['Owner Type'],
  owner_name: ['Owner Name'],
  ownership_percentage: ['Ownership Percentage'],
  association_date_raw: ['Association Date'],
  processing_date: ['Processing Date']
};

function parseAssociationDate(raw) {
  if (!raw) return null;
  // Format: "since 01/25/2012"
  const match = raw.match(/since\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }
  return null;
}

function parseOwnershipPercentage(raw) {
  if (!raw) return null;
  // Strip % sign and parse number (e.g., "100%", "5%", "81%")
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

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

function findColumn(headers, possibleNames) {
  for (const name of possibleNames) {
    if (headers.includes(name)) return name;
  }
  return null;
}

function getExtractDate(filename) {
  // Match patterns like "Jan2024", "01_2024", etc.
  const monthMatch = filename.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i);
  if (monthMatch) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                     jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    return `${monthMatch[2]}-${months[monthMatch[1].toLowerCase()]}-01`;
  }

  const numMatch = filename.match(/(\d{2})_(\d{4})/);
  if (numMatch) {
    return `${numMatch[2]}-${numMatch[1]}-01`;
  }

  return null;
}

async function getExtractId(extractDate) {
  const result = await pool.query(
    'SELECT extract_id FROM cms_extracts WHERE extract_date = $1',
    [extractDate]
  );

  if (result.rows.length > 0) {
    return result.rows[0].extract_id;
  }

  // Create new extract if doesn't exist
  const insert = await pool.query(
    `INSERT INTO cms_extracts (extract_date, source_file, import_status)
     VALUES ($1, 'NH_Ownership', 'completed')
     RETURNING extract_id`,
    [extractDate]
  );

  return insert.rows[0].extract_id;
}

async function importOwnershipFile(csvPath, extractId) {
  console.log(`  Importing ownership from ${path.basename(csvPath)}...`);

  const rows = await readCSV(csvPath);
  if (rows.length === 0) {
    console.log('  Warning: No rows found');
    return 0;
  }

  const headers = Object.keys(rows[0]);

  // Find columns
  const ccnCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.ccn);
  const nameCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.provider_name);
  const roleCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.owner_role);
  const typeCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.owner_type);
  const ownerCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.owner_name);
  const pctCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.ownership_percentage);
  const dateCol = findColumn(headers, OWNERSHIP_COLUMN_MAP.association_date_raw);

  if (!ccnCol || !ownerCol) {
    console.log('  Warning: Required columns not found');
    return 0;
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const ccn = row[ccnCol];
    const ownerName = row[ownerCol];

    if (!ccn || !ownerName) {
      skipped++;
      continue;
    }

    const associationDateRaw = dateCol ? row[dateCol] : null;
    const associationDate = parseAssociationDate(associationDateRaw);
    const ownershipPct = pctCol ? parseOwnershipPercentage(row[pctCol]) : null;

    try {
      await pool.query(`
        INSERT INTO facility_ownership_details
          (extract_id, ccn, provider_name, owner_role, owner_type, owner_name,
           ownership_percentage, association_date, association_date_raw)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (extract_id, ccn, owner_name, owner_role) DO UPDATE SET
          ownership_percentage = EXCLUDED.ownership_percentage,
          association_date = EXCLUDED.association_date
      `, [
        extractId,
        ccn,
        nameCol ? row[nameCol] : null,
        roleCol ? row[roleCol] : null,
        typeCol ? row[typeCol] : null,
        ownerName,
        ownershipPct,
        associationDate,
        associationDateRaw
      ]);
      imported++;
    } catch (err) {
      if (skipped < 5) {
        console.error(`  Error: ${err.message}`);
      }
      skipped++;
    }

    if (imported % 10000 === 0) {
      console.log(`    Imported ${imported} records...`);
    }
  }

  console.log(`  Imported ${imported} ownership records (skipped ${skipped})`);
  return imported;
}

async function processMonthlyArchive(monthlyZipPath) {
  const filename = path.basename(monthlyZipPath);
  const extractDate = getExtractDate(filename);

  if (!extractDate) {
    console.log(`  Warning: Could not determine date from ${filename}`);
    return;
  }

  console.log(`\nProcessing: ${filename} (${extractDate})`);

  // Extract to temp dir
  const extractDir = path.join(TEMP_DIR, filename.replace('.zip', ''));
  if (fs.existsSync(extractDir)) {
    execSync(`rm -rf "${extractDir}"`);
  }
  fs.mkdirSync(extractDir, { recursive: true });

  execSync(`unzip -q -o "${monthlyZipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

  // Find ownership file
  const files = fs.readdirSync(extractDir);
  const ownershipFile = files.find(f => f.includes('NH_Ownership') && f.endsWith('.csv'));

  if (!ownershipFile) {
    console.log('  No NH_Ownership file found');
    return;
  }

  const extractId = await getExtractId(extractDate);
  await importOwnershipFile(path.join(extractDir, ownershipFile), extractId);

  // Cleanup
  execSync(`rm -rf "${extractDir}"`);
}

async function processYearlyArchive(yearlyZipPath) {
  const filename = path.basename(yearlyZipPath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing yearly archive: ${filename}`);
  console.log('='.repeat(60));

  // Extract yearly archive to get monthly zips
  const yearDir = path.join(TEMP_DIR, filename.replace('.zip', ''));
  if (fs.existsSync(yearDir)) {
    execSync(`rm -rf "${yearDir}"`);
  }
  fs.mkdirSync(yearDir, { recursive: true });

  execSync(`unzip -q -o "${yearlyZipPath}" -d "${yearDir}"`, { stdio: 'pipe' });

  // Find monthly archives
  const monthlyZips = fs.readdirSync(yearDir)
    .filter(f => f.endsWith('.zip'))
    .sort();

  console.log(`Found ${monthlyZips.length} monthly archives`);

  for (const monthlyZip of monthlyZips) {
    await processMonthlyArchive(path.join(yearDir, monthlyZip));
  }

  // Cleanup
  execSync(`rm -rf "${yearDir}"`);
}

async function detectOwnershipChanges() {
  console.log('\n' + '='.repeat(60));
  console.log('DETECTING OWNERSHIP CHANGES');
  console.log('='.repeat(60));

  // Get all extracts with ownership data
  const extracts = await pool.query(`
    SELECT DISTINCT e.extract_id, e.extract_date
    FROM cms_extracts e
    JOIN facility_ownership_details fod ON e.extract_id = fod.extract_id
    ORDER BY e.extract_date
  `);

  if (extracts.rows.length < 2) {
    console.log('Need at least 2 extracts to detect changes');
    return;
  }

  console.log(`Found ${extracts.rows.length} extracts with ownership data`);

  let totalChanges = 0;

  for (let i = 1; i < extracts.rows.length; i++) {
    const prev = extracts.rows[i - 1];
    const curr = extracts.rows[i];

    // Detect new owners (owner appeared that wasn't there before)
    const newOwners = await pool.query(`
      INSERT INTO facility_events (ccn, event_type, event_date, previous_extract_id, current_extract_id, new_value, state)
      SELECT DISTINCT
        curr.ccn,
        'OWNER_ADDED',
        $3::date,
        $1::integer,
        $2::integer,
        curr.owner_name || ' (' || COALESCE(curr.ownership_percentage::text, 'unknown') || '%)',
        (SELECT state FROM facility_snapshots fs WHERE fs.ccn = curr.ccn AND fs.extract_id = $2::integer LIMIT 1)
      FROM facility_ownership_details curr
      LEFT JOIN facility_ownership_details prev
        ON curr.ccn = prev.ccn
        AND curr.owner_name = prev.owner_name
        AND prev.extract_id = $1::integer
      WHERE curr.extract_id = $2::integer
        AND prev.ccn IS NULL
        AND curr.owner_role LIKE '%OWNERSHIP%'
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [prev.extract_id, curr.extract_id, curr.extract_date]);

    // Detect removed owners
    const removedOwners = await pool.query(`
      INSERT INTO facility_events (ccn, event_type, event_date, previous_extract_id, current_extract_id, previous_value, state)
      SELECT DISTINCT
        prev.ccn,
        'OWNER_REMOVED',
        $3::date,
        $1::integer,
        $2::integer,
        prev.owner_name || ' (' || COALESCE(prev.ownership_percentage::text, 'unknown') || '%)',
        (SELECT state FROM facility_snapshots fs WHERE fs.ccn = prev.ccn AND fs.extract_id = $1::integer LIMIT 1)
      FROM facility_ownership_details prev
      LEFT JOIN facility_ownership_details curr
        ON prev.ccn = curr.ccn
        AND prev.owner_name = curr.owner_name
        AND curr.extract_id = $2::integer
      WHERE prev.extract_id = $1::integer
        AND curr.ccn IS NULL
        AND prev.owner_role LIKE '%OWNERSHIP%'
      ON CONFLICT DO NOTHING
      RETURNING event_id
    `, [prev.extract_id, curr.extract_id, curr.extract_date]);

    const monthChanges = newOwners.rowCount + removedOwners.rowCount;
    if (monthChanges > 0) {
      console.log(`${prev.extract_date} → ${curr.extract_date}: +${newOwners.rowCount} owners, -${removedOwners.rowCount} owners`);
    }
    totalChanges += monthChanges;
  }

  console.log(`\nTotal ownership changes detected: ${totalChanges}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('CMS OWNERSHIP DETAILS IMPORT');
  console.log('='.repeat(60));

  if (fs.existsSync(TEMP_DIR)) {
    execSync(`rm -rf "${TEMP_DIR}"`);
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  try {
    // Get all yearly archives
    const archives = fs.readdirSync(HISTORICAL_DIR)
      .filter(f => f.endsWith('.zip') && f.includes('nursing_homes'))
      .sort();

    console.log(`\nFound ${archives.length} yearly archives in ${HISTORICAL_DIR}`);

    for (const archive of archives) {
      await processYearlyArchive(path.join(HISTORICAL_DIR, archive));
    }

    // Detect ownership changes
    await detectOwnershipChanges();

    // Summary
    const summary = await pool.query(`
      SELECT
        COUNT(DISTINCT extract_id) as extracts,
        COUNT(*) as total_records,
        COUNT(DISTINCT ccn) as facilities,
        COUNT(DISTINCT owner_name) as unique_owners
      FROM facility_ownership_details
    `);

    const eventSummary = await pool.query(`
      SELECT event_type, COUNT(*) as count
      FROM facility_events
      WHERE event_type IN ('OWNER_ADDED', 'OWNER_REMOVED', 'OWNERSHIP_CHANGE')
      GROUP BY event_type
      ORDER BY count DESC
    `);

    console.log('\n' + '='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`\nOwnership Details:`);
    console.log(`  Extracts: ${summary.rows[0].extracts}`);
    console.log(`  Total Records: ${summary.rows[0].total_records}`);
    console.log(`  Unique Facilities: ${summary.rows[0].facilities}`);
    console.log(`  Unique Owners: ${summary.rows[0].unique_owners}`);

    if (eventSummary.rows.length > 0) {
      console.log('\nOwnership Events:');
      for (const e of eventSummary.rows) {
        console.log(`  ${e.event_type}: ${e.count}`);
      }
    }

  } finally {
    execSync(`rm -rf "${TEMP_DIR}"`);
    await pool.end();
  }
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
