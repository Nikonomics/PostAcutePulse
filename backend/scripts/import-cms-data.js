#!/usr/bin/env node
/**
 * Master CMS Data Import Script
 *
 * Usage: node scripts/import-cms-data.js <folder-path>
 * Example: node scripts/import-cms-data.js "/Users/nikolashulewsky/Desktop/CMS_Dec2025/"
 *
 * Auto-detects and imports:
 * - NH_ProviderInfo_*.csv → snf_facilities
 * - NH_StateUSAverages_*.csv → cms_state_benchmarks
 * - FY_*_SNF_VBP_Facility_Performance.csv → snf_vbp_performance
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPTS_DIR = __dirname;

// File patterns to look for
const FILE_PATTERNS = [
  {
    pattern: /^NH_ProviderInfo.*\.csv$/i,
    script: 'import-cms-provider-info.js',
    name: 'Provider Info (snf_facilities)',
    priority: 1
  },
  {
    pattern: /^NH_StateUSAverages.*\.csv$/i,
    script: 'import-cms-state-benchmarks.js',
    name: 'State Benchmarks',
    priority: 2
  },
  {
    pattern: /^FY_\d+_SNF_VBP_Facility_Performance.*\.csv$/i,
    script: 'import-cms-vbp-performance.js',
    name: 'VBP Performance',
    priority: 3
  }
];

function findFiles(folderPath) {
  const files = fs.readdirSync(folderPath);
  const found = [];

  for (const fileConfig of FILE_PATTERNS) {
    const match = files.find(f => fileConfig.pattern.test(f));
    if (match) {
      found.push({
        ...fileConfig,
        filePath: path.join(folderPath, match),
        fileName: match
      });
    }
  }

  return found.sort((a, b) => a.priority - b.priority);
}

async function runImport(folderPath) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           CMS Data Import - Master Script                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Validate folder
  if (!fs.existsSync(folderPath)) {
    console.error(`ERROR: Folder not found: ${folderPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(folderPath);
  if (!stats.isDirectory()) {
    console.error(`ERROR: Path is not a directory: ${folderPath}`);
    process.exit(1);
  }

  console.log(`📁 Scanning: ${folderPath}\n`);

  // Find matching files
  const filesToImport = findFiles(folderPath);

  if (filesToImport.length === 0) {
    console.log('⚠️  No CMS data files found in this folder.\n');
    console.log('Looking for:');
    console.log('  - NH_ProviderInfo_*.csv');
    console.log('  - NH_StateUSAverages_*.csv');
    console.log('  - FY_*_SNF_VBP_Facility_Performance.csv');
    process.exit(1);
  }

  console.log(`Found ${filesToImport.length} file(s) to import:\n`);
  filesToImport.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.fileName}`);
    console.log(`     → ${f.name}`);
  });

  console.log('\n' + '─'.repeat(60) + '\n');

  // Run each import
  const results = [];
  for (const file of filesToImport) {
    console.log(`\n▶ Importing: ${file.name}`);
    console.log(`  File: ${file.fileName}`);
    console.log('─'.repeat(60));

    const scriptPath = path.join(SCRIPTS_DIR, file.script);
    const cmd = `node "${scriptPath}" "${file.filePath}"`;

    try {
      const output = execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large outputs
      });

      // Extract key stats from output
      const insertMatch = output.match(/Inserted:\s*(\d+)/);
      const updateMatch = output.match(/Updated:\s*(\d+)/);
      const totalMatch = output.match(/Total processed:\s*(\d+)/);

      results.push({
        name: file.name,
        status: 'success',
        inserted: insertMatch ? parseInt(insertMatch[1]) : 0,
        updated: updateMatch ? parseInt(updateMatch[1]) : 0,
        total: totalMatch ? parseInt(totalMatch[1]) : 0
      });

      console.log(output);

    } catch (err) {
      console.error(`\n❌ Error importing ${file.name}:`);
      console.error(err.stderr || err.message);
      results.push({
        name: file.name,
        status: 'failed',
        error: err.message
      });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('                    IMPORT SUMMARY');
  console.log('═'.repeat(60) + '\n');

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  if (successful.length > 0) {
    console.log('✅ Successful imports:');
    successful.forEach(r => {
      const stats = r.total > 0 ? `${r.total} records` :
                    r.updated > 0 ? `${r.updated} updated` :
                    r.inserted > 0 ? `${r.inserted} inserted` : '';
      console.log(`   • ${r.name} ${stats ? '(' + stats + ')' : ''}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed imports:');
    failed.forEach(r => {
      console.log(`   • ${r.name}`);
    });
  }

  console.log('\n' + '═'.repeat(60));

  if (failed.length > 0) {
    process.exit(1);
  }

  console.log('\n🎉 All imports completed successfully!\n');
}

// Get folder path from command line
const folderPath = process.argv[2];

if (!folderPath) {
  console.log(`
Usage: node scripts/import-cms-data.js <folder-path>

Example:
  node scripts/import-cms-data.js "/Users/nikolashulewsky/Desktop/CMS_Dec2025/"

This script auto-detects and imports CMS nursing home data files:
  • NH_ProviderInfo_*.csv       → snf_facilities (14,750 facilities)
  • NH_StateUSAverages_*.csv    → cms_state_benchmarks (54 states)
  • FY_*_SNF_VBP_*.csv          → snf_vbp_performance (VBP scores)
`);
  process.exit(1);
}

runImport(path.resolve(folderPath));
