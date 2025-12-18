/**
 * Import MDS Quality Measures from QRP Provider Data file
 * Format: One row per facility-measure combination
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

async function importMDSQualityMeasures() {
  const client = await pool.connect();

  try {
    console.log('Importing MDS Quality Measures...\n');

    const dataDir = '/Users/nikolashulewsky/Desktop/Database Docs/Nursing Home Data/nursing_homes_including_rehab_services_current_data';
    const qrpFile = fs.readdirSync(dataDir).find(f => f.includes('Quality_Reporting_Program_Provider') && f.endsWith('.csv'));

    if (!qrpFile) {
      console.log('QRP file not found');
      return;
    }

    const filePath = path.join(dataDir, qrpFile);
    console.log(`Reading ${qrpFile}...`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    console.log('Headers:', headers);

    // Find column indexes
    const ccnIdx = headers.findIndex(h => /CCN|Certification/i.test(h));
    const measureCodeIdx = headers.findIndex(h => /Measure Code/i.test(h));
    const scoreIdx = headers.findIndex(h => /^Score$/i.test(h));
    const footnoteIdx = headers.findIndex(h => /Footnote/i.test(h));

    console.log(`Column indexes: ccn=${ccnIdx}, measureCode=${measureCodeIdx}, score=${scoreIdx}, footnote=${footnoteIdx}`);

    if (ccnIdx < 0 || measureCodeIdx < 0 || scoreIdx < 0) {
      console.log('Required columns not found');
      return;
    }

    // Group by CCN and measure code to aggregate
    const measureData = new Map();
    let processed = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const ccn = row[ccnIdx]?.replace(/[^0-9A-Z]/gi, '');
      const measureCode = row[measureCodeIdx];
      const score = row[scoreIdx];

      if (!ccn || ccn.length < 6 || !measureCode) continue;

      const key = `${ccn}|${measureCode}`;

      if (!measureData.has(key)) {
        const scoreNum = parseFloat(score?.replace(/[^0-9.-]/g, ''));
        measureData.set(key, {
          ccn,
          measureCode,
          score: isNaN(scoreNum) ? null : scoreNum,
          footnote: row[footnoteIdx] || null
        });
      }

      processed++;
      if (processed % 100000 === 0) {
        console.log(`  Processed ${processed} rows...`);
      }
    }

    console.log(`\nFound ${measureData.size} unique CCN-measure combinations`);

    // Insert into database
    let imported = 0;
    let errors = 0;

    for (const data of measureData.values()) {
      try {
        await client.query(`
          INSERT INTO mds_quality_measures (ccn, measure_code, four_quarter_score)
          VALUES ($1, $2, $3)
          ON CONFLICT (ccn, measure_code) DO UPDATE SET
            four_quarter_score = EXCLUDED.four_quarter_score
        `, [data.ccn, data.measureCode, data.score]);
        imported++;
      } catch (e) {
        errors++;
      }

      if (imported % 10000 === 0) {
        console.log(`  Imported ${imported} measures...`);
      }
    }

    console.log(`\n✓ Imported ${imported} quality measure records (${errors} errors)`);

    // Show summary
    const summary = await client.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT ccn) as unique_facilities,
        COUNT(DISTINCT measure_code) as unique_measures
      FROM mds_quality_measures
    `);
    console.log('\nSummary:');
    console.log(`  Total records: ${summary.rows[0].total_records}`);
    console.log(`  Unique facilities: ${summary.rows[0].unique_facilities}`);
    console.log(`  Unique measures: ${summary.rows[0].unique_measures}`);

  } finally {
    client.release();
    await pool.end();
  }
}

importMDSQualityMeasures().catch(console.error);
