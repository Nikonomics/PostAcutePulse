import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = process.env.HOME + '/Desktop/cms_historical_data';
const TEMP_DIR = '/tmp/cms_analysis';

// Key files to analyze
const KEY_FILES = [
  'NH_ProviderInfo',
  'NH_QualityMsr_MDS',
  'NH_QualityMsr_Claims',
  'NH_Ownership',
  'NH_Penalties',
  'NH_StateUSAverages',
  'SNF_VBP'
];

async function analyzeHistoricalData() {
  console.log('='.repeat(80));
  console.log('CMS NURSING HOME DATA CONSISTENCY ANALYSIS');
  console.log('='.repeat(80));

  // Create temp directory
  if (fs.existsSync(TEMP_DIR)) {
    execSync(`rm -rf ${TEMP_DIR}`);
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  // Get all zip files
  const zipFiles = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.zip'))
    .sort();

  console.log(`\nFound ${zipFiles.length} yearly archives: ${zipFiles.map(f => f.match(/\d{4}/)?.[0]).join(', ')}\n`);

  const yearlyData = {};

  // Extract and analyze each year
  for (const zipFile of zipFiles) {
    const year = zipFile.match(/\d{4}/)?.[0];
    if (!year) continue;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Processing ${year}...`);

    const zipPath = path.join(DATA_DIR, zipFile);
    const extractDir = path.join(TEMP_DIR, year);
    fs.mkdirSync(extractDir, { recursive: true });

    // Extract outer zip
    execSync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

    // Check for nested zips (monthly archives)
    const nestedZips = fs.readdirSync(extractDir).filter(f => f.endsWith('.zip'));

    if (nestedZips.length > 0) {
      console.log(`  Found ${nestedZips.length} monthly archives`);

      // Just extract the first and last month for comparison
      const firstMonth = nestedZips.sort()[0];
      const lastMonth = nestedZips.sort()[nestedZips.length - 1];

      console.log(`  Analyzing: ${firstMonth.replace('.zip', '')} and ${lastMonth.replace('.zip', '')}`);

      // Extract last month for analysis (most recent)
      const monthExtractDir = path.join(extractDir, 'month');
      fs.mkdirSync(monthExtractDir, { recursive: true });
      execSync(`unzip -q -o "${path.join(extractDir, lastMonth)}" -d "${monthExtractDir}"`, { stdio: 'pipe' });

      // Now find CSVs
      var csvFiles = execSync(`find "${monthExtractDir}" -name "*.csv" -type f 2>/dev/null || true`, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(f => f);
    } else {
      // CSVs might be directly in the extract
      var csvFiles = execSync(`find "${extractDir}" -name "*.csv" -type f 2>/dev/null || true`, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(f => f);
    }

    yearlyData[year] = {
      files: {},
      fileList: [],
      monthCount: nestedZips.length || 1
    };

    console.log(`  Found ${csvFiles.length} CSV files in sample month`);

    // Categorize files
    for (const csvPath of csvFiles) {
      const fileName = path.basename(csvPath);
      yearlyData[year].fileList.push(fileName);

      // Get headers for key files
      for (const keyFile of KEY_FILES) {
        if (fileName.includes(keyFile)) {
          try {
            const headers = execSync(`head -1 "${csvPath}"`, { encoding: 'utf8' })
              .trim()
              .split(',')
              .map(h => h.replace(/"/g, '').trim());

            yearlyData[year].files[keyFile] = {
              fileName,
              headers,
              headerCount: headers.length
            };
          } catch (e) {
            console.log(`  Warning: Could not read ${fileName}`);
          }
        }
      }
    }

    console.log(`  Key files found: ${Object.keys(yearlyData[year].files).join(', ') || 'None'}`);
  }

  // Generate comparison report
  console.log('\n' + '='.repeat(80));
  console.log('COLUMN CONSISTENCY REPORT');
  console.log('='.repeat(80));

  const years = Object.keys(yearlyData).sort();

  for (const keyFile of KEY_FILES) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`FILE: ${keyFile}`);
    console.log('─'.repeat(60));

    // Check if file exists in all years
    const yearsWithFile = years.filter(y => yearlyData[y].files[keyFile]);
    if (yearsWithFile.length === 0) {
      console.log('  ⚠️  Not found in any year');
      continue;
    }

    console.log(`  Present in: ${yearsWithFile.join(', ')}`);

    // Compare column counts
    console.log('\n  Column counts by year:');
    for (const year of yearsWithFile) {
      const data = yearlyData[year].files[keyFile];
      console.log(`    ${year}: ${data.headerCount} columns (${data.fileName})`);
    }

    // Find common and different columns
    if (yearsWithFile.length > 1) {
      const firstYear = yearsWithFile[0];
      const lastYear = yearsWithFile[yearsWithFile.length - 1];

      const firstHeaders = new Set(yearlyData[firstYear].files[keyFile].headers);
      const lastHeaders = new Set(yearlyData[lastYear].files[keyFile].headers);

      const added = [...lastHeaders].filter(h => !firstHeaders.has(h));
      const removed = [...firstHeaders].filter(h => !lastHeaders.has(h));

      if (added.length > 0) {
        console.log(`\n  ➕ Columns ADDED since ${firstYear} (${added.length}):`);
        added.slice(0, 20).forEach(h => console.log(`      + ${h}`));
        if (added.length > 20) console.log(`      ... and ${added.length - 20} more`);
      }

      if (removed.length > 0) {
        console.log(`\n  ➖ Columns REMOVED since ${firstYear} (${removed.length}):`);
        removed.slice(0, 20).forEach(h => console.log(`      - ${h}`));
        if (removed.length > 20) console.log(`      ... and ${removed.length - 20} more`);
      }

      if (added.length === 0 && removed.length === 0) {
        console.log(`\n  ✅ Columns are IDENTICAL between ${firstYear} and ${lastYear}`);
      }
    }
  }

  // List all unique file types across years
  console.log('\n' + '='.repeat(80));
  console.log('ALL CSV FILES BY YEAR');
  console.log('='.repeat(80));

  const allFileTypes = new Map();
  for (const year of years) {
    yearlyData[year].fileList.forEach(f => {
      // Normalize file name (remove date suffix)
      const normalized = f
        .replace(/_[A-Za-z]{3}\d{4}\.csv$/i, '')
        .replace(/_\d{8}\.csv$/i, '')
        .replace(/_\d{4}\.csv$/i, '')
        .replace(/\d{4}\.csv$/i, '');

      if (!allFileTypes.has(normalized)) {
        allFileTypes.set(normalized, new Set());
      }
      allFileTypes.get(normalized).add(year);
    });
  }

  console.log('\nFile presence by year (✓ = present, - = missing):');
  console.log('─'.repeat(70));
  console.log('File'.padEnd(45) + years.map(y => y.slice(2).padStart(4)).join(' '));
  console.log('─'.repeat(70));

  for (const [fileType, presentYears] of [...allFileTypes.entries()].sort()) {
    const presence = years.map(y => presentYears.has(y) ? '  ✓ ' : '  - ').join('');
    console.log(fileType.slice(0, 44).padEnd(45) + presence);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  for (const year of years) {
    console.log(`${year}: ${yearlyData[year].monthCount} months, ${yearlyData[year].fileList.length} files/month`);
  }

  // Cleanup
  execSync(`rm -rf ${TEMP_DIR}`);

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

analyzeHistoricalData().catch(console.error);
