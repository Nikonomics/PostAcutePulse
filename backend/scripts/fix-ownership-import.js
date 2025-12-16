const fs = require('fs');
const { Sequelize } = require('sequelize');
const { parse } = require('csv-parse');
const { createReadStream } = require('fs');

const sequelize = new Sequelize('postgresql://localhost:5432/snf_platform', { logging: false });
const extractId = 69;

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
      // Handle malformed dates like '2012-since 01-25'
      if (value.includes('since')) return null;
      if (/^\d{8}$/.test(value)) {
        return value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8);
      }
      const parts = value.split('/');
      if (parts.length === 3) {
        return parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
      }
      return value;
    default:
      return String(value).trim().slice(0, 500);
  }
}

async function importOwnership() {
  console.log('Re-importing Ownership with fixed date parser...');
  const filePath = '/private/tmp/cms_inventory/NH_Ownership_Oct2024.csv';
  const rows = await readCSV(filePath);
  console.log(`  Found ${rows.length.toLocaleString()} rows to process`);

  await sequelize.query('DELETE FROM ownership_records WHERE extract_id = :extractId', { replacements: { extractId } });
  console.log('  Cleared existing ownership records');

  let imported = 0;
  let skipped = 0;
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
      if (imported % 50000 === 0) console.log(`  Imported ${imported.toLocaleString()} records...`);
    } catch (e) {
      skipped++;
      if (skipped < 5) console.log('  Skip error:', e.message.substring(0, 100));
    }
  }
  console.log(`Imported ${imported.toLocaleString()} ownership records (skipped ${skipped})`);
}

importOwnership().then(() => sequelize.close()).catch(console.error);
