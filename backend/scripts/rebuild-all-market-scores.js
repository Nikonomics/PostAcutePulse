/**
 * Rebuild All Market Scores (Master Orchestrator)
 *
 * Runs all market scoring scripts in the correct order:
 * 1. rebuild-market-metrics.js - Aggregate facility data per CBSA
 * 2. update-snf-opportunity-scores.js - SNF opportunity scores
 * 3. update-alf-opportunity-scores.js - ALF opportunity scores
 * 4. update-hha-opportunity-scores.js - HHA opportunity scores (service-area based)
 * 5. calculate-overall-pac-scores.js - Combined PAC scores
 *
 * This is the single command to regenerate all market scores from scratch.
 *
 * Prerequisites:
 * - hud_zip_cbsa table must be populated (HUD ZIP-to-CBSA crosswalk)
 * - snf_facilities, alf_facilities, hh_provider_snapshots must have data
 * - county_demographics must have population data
 *
 * Usage: MARKET_DATABASE_URL=<url> node scripts/rebuild-all-market-scores.js
 *
 * Options:
 *   --skip-metrics    Skip rebuilding market_metrics (use existing data)
 *   --snf-only        Only run SNF scoring
 *   --alf-only        Only run ALF scoring
 *   --hha-only        Only run HHA scoring
 *   --pac-only        Only recalculate overall PAC scores
 */

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = __dirname;

const SCRIPTS = [
  { name: 'Rebuild Market Metrics', file: 'rebuild-market-metrics.js', flag: 'metrics' },
  { name: 'Update SNF Scores', file: 'update-snf-opportunity-scores.js', flag: 'snf' },
  { name: 'Update ALF Scores', file: 'update-alf-opportunity-scores.js', flag: 'alf' },
  { name: 'Update HHA Scores', file: 'update-hha-opportunity-scores.js', flag: 'hha' },
  { name: 'Calculate Overall PAC', file: 'calculate-overall-pac-scores.js', flag: 'pac' },
];

function runScript(script) {
  const scriptPath = path.join(SCRIPTS_DIR, script.file);

  console.log('\n' + '='.repeat(60));
  console.log(`Running: ${script.name}`);
  console.log('='.repeat(60) + '\n');

  try {
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: process.env
    });
    console.log(`\n✓ ${script.name} completed successfully`);
    return true;
  } catch (error) {
    console.error(`\n✗ ${script.name} failed`);
    return false;
  }
}

function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PostAcutePulse Market Scoring Orchestrator         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);

  // Parse flags
  const skipMetrics = args.includes('--skip-metrics');
  const snfOnly = args.includes('--snf-only');
  const alfOnly = args.includes('--alf-only');
  const hhaOnly = args.includes('--hha-only');
  const pacOnly = args.includes('--pac-only');

  // Determine which scripts to run
  let scriptsToRun = [...SCRIPTS];

  if (skipMetrics) {
    scriptsToRun = scriptsToRun.filter(s => s.flag !== 'metrics');
    console.log('⚠ Skipping market metrics rebuild (--skip-metrics)');
  }

  if (snfOnly) {
    scriptsToRun = scriptsToRun.filter(s => s.flag === 'snf');
    console.log('⚠ Running SNF scoring only (--snf-only)');
  } else if (alfOnly) {
    scriptsToRun = scriptsToRun.filter(s => s.flag === 'alf');
    console.log('⚠ Running ALF scoring only (--alf-only)');
  } else if (hhaOnly) {
    scriptsToRun = scriptsToRun.filter(s => s.flag === 'hha');
    console.log('⚠ Running HHA scoring only (--hha-only)');
  } else if (pacOnly) {
    scriptsToRun = scriptsToRun.filter(s => s.flag === 'pac');
    console.log('⚠ Running PAC calculation only (--pac-only)');
  }

  // Check for MARKET_DATABASE_URL
  if (!process.env.MARKET_DATABASE_URL) {
    console.error('Error: MARKET_DATABASE_URL environment variable is required');
    console.error('Usage: MARKET_DATABASE_URL=<url> node scripts/rebuild-all-market-scores.js');
    process.exit(1);
  }

  console.log(`\nWill run ${scriptsToRun.length} scripts:`);
  scriptsToRun.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));

  const startTime = Date.now();
  let success = 0;
  let failed = 0;

  for (const script of scriptsToRun) {
    if (runScript(script)) {
      success++;
    } else {
      failed++;
      console.error(`\n⛔ Stopping due to failure in ${script.name}`);
      break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log('                    ORCHESTRATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`\nResults:`);
  console.log(`  ✓ Successful: ${success}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Time: ${elapsed}s`);

  if (failed > 0) {
    console.log('\n⚠ Some scripts failed. Check output above for details.');
    process.exit(1);
  } else {
    console.log('\n✓ All market scores rebuilt successfully!');
    console.log('\nNext steps:');
    console.log('  - Verify scores: SELECT * FROM market_grades ORDER BY overall_pac_score DESC LIMIT 20;');
    console.log('  - Check distribution: SELECT overall_pac_grade, COUNT(*) FROM market_grades GROUP BY 1 ORDER BY 1;');
  }
}

main();
