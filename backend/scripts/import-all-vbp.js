const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { parse } = require('csv-parse');
const { createReadStream } = require('fs');

const sequelize = new Sequelize('postgresql://localhost:5432/snf_platform', { logging: false });

const VBP_DIR = '/private/tmp/vbp_extract';

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
    default:
      return String(value).trim().slice(0, 500);
  }
}

async function importVBP(filePath) {
  const filename = path.basename(filePath);
  console.log(`\nImporting: ${filename}`);

  const fyMatch = filename.match(/FY_(\d{4})/);
  const fiscalYear = fyMatch ? parseInt(fyMatch[1]) : null;
  if (!fiscalYear) {
    console.log('  Could not determine fiscal year, skipping');
    return 0;
  }

  console.log(`  Fiscal Year: ${fiscalYear}`);

  const rows = await readCSV(filePath);
  console.log(`  Rows to process: ${rows.length.toLocaleString()}`);

  // Delete existing records for this fiscal year
  await sequelize.query('DELETE FROM vbp_scores WHERE fiscal_year = :fiscalYear', { replacements: { fiscalYear } });

  // Get column names from first row to handle different file formats
  const sampleRow = rows[0];
  const cols = Object.keys(sampleRow);

  // Find the CCN column
  const ccnCol = cols.find(c => c.includes('CCN') || c.includes('Certification'));
  const rankCol = cols.find(c => c.includes('Ranking'));
  const baselineCol = cols.find(c => c.includes('Baseline') && c.includes('Rate'));
  const perfRateCol = cols.find(c => c.includes('Performance') && c.includes('Rate') && !c.includes('Score'));
  const achieveCol = cols.find(c => c.includes('Achievement'));
  const improveCol = cols.find(c => c.includes('Improvement'));
  const perfScoreCol = cols.find(c => c.includes('Performance Score'));
  const multiplierCol = cols.find(c => c.includes('Multiplier'));

  let imported = 0;
  for (const row of rows) {
    const ccn = row[ccnCol];
    if (!ccn || ccn.length < 6) continue;

    try {
      await sequelize.query(`
        INSERT INTO vbp_scores (fiscal_year, ccn, vbp_ranking, baseline_readmission_rate,
          performance_readmission_rate, achievement_score, improvement_score, performance_score,
          incentive_payment_multiplier)
        VALUES (:fiscalYear, :ccn, :ranking, :baseline, :perfRate, :achieve, :improve, :perfScore, :multiplier)
        ON CONFLICT (fiscal_year, ccn) DO UPDATE SET
          vbp_ranking = EXCLUDED.vbp_ranking,
          incentive_payment_multiplier = EXCLUDED.incentive_payment_multiplier
      `, {
        replacements: {
          fiscalYear,
          ccn: ccn.trim(),
          ranking: parseValue(row[rankCol], 'int'),
          baseline: parseValue(row[baselineCol], 'decimal'),
          perfRate: parseValue(row[perfRateCol], 'decimal'),
          achieve: parseValue(row[achieveCol], 'decimal'),
          improve: parseValue(row[improveCol], 'decimal'),
          perfScore: parseValue(row[perfScoreCol], 'decimal'),
          multiplier: parseValue(row[multiplierCol], 'decimal')
        }
      });
      imported++;
      if (imported % 5000 === 0) process.stdout.write(`\r  Imported ${imported.toLocaleString()}...`);
    } catch (e) {
      // Skip duplicates/errors
    }
  }

  console.log(`\r  Imported ${imported.toLocaleString()} records for FY ${fiscalYear}`);
  return imported;
}

async function main() {
  console.log('='.repeat(50));
  console.log('IMPORTING ALL VBP FILES');
  console.log('='.repeat(50));

  const files = fs.readdirSync(VBP_DIR)
    .filter(f => f.includes('VBP_Facility') && f.endsWith('.csv'))
    .sort();

  console.log(`Found ${files.length} VBP files`);

  let total = 0;
  for (const file of files) {
    const count = await importVBP(path.join(VBP_DIR, file));
    total += count;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`TOTAL: ${total.toLocaleString()} VBP records imported`);

  // Show summary by fiscal year
  const [summary] = await sequelize.query(`
    SELECT fiscal_year, COUNT(*) as cnt
    FROM vbp_scores
    GROUP BY fiscal_year
    ORDER BY fiscal_year
  `);

  console.log('\nRecords by Fiscal Year:');
  summary.forEach(r => console.log(`  FY ${r.fiscal_year}: ${parseInt(r.cnt).toLocaleString()}`));

  await sequelize.close();
}

main().catch(console.error);
