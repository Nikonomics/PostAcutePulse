/**
 * Test script for Period Analyzer
 *
 * Run with: node services/periodAnalyzer.test.js
 *
 * Tests the timezone fix that was causing September data to be cut off at August
 */

const {
  analyzeFinancialPeriods,
  parseMonthYear,
  subtractMonths,
  addMonths,
  generateMonthList,
  calculateMonthsBetween
} = require('./periodAnalyzer');

console.log('=== PERIOD ANALYZER TESTS ===\n');

// Test 1: parseMonthYear should handle September correctly
console.log('TEST 1: parseMonthYear timezone handling');
const sept2025 = parseMonthYear('sep', '2025');
const sept2025Full = parseMonthYear('september', '2025');
console.log(`  sep 2025 -> ${sept2025} (expected: 2025-09-01)`);
console.log(`  september 2025 -> ${sept2025Full} (expected: 2025-09-01)`);
console.log(`  PASS: ${sept2025 === '2025-09-01' && sept2025Full === '2025-09-01' ? '✓' : '✗ FAIL'}\n`);

// Test 2: subtractMonths should work correctly
console.log('TEST 2: subtractMonths from September');
const oct2024 = subtractMonths('2025-09-01', 11);
console.log(`  2025-09-01 - 11 months -> ${oct2024} (expected: 2024-10-01)`);
console.log(`  PASS: ${oct2024 === '2024-10-01' ? '✓' : '✗ FAIL'}\n`);

// Test 3: generateMonthList should include September
console.log('TEST 3: generateMonthList from Oct 2024 to Sep 2025');
const months = generateMonthList('2024-10-01', '2025-09-01');
console.log(`  Generated ${months.length} months`);
console.log(`  First: ${months[0]}, Last: ${months[months.length - 1]}`);
console.log(`  Expected: 12 months, Oct 2024 to Sep 2025`);
const hasAllMonths = months.length === 12 &&
  months[0] === '2024-10' &&
  months[months.length - 1] === '2025-09';
console.log(`  PASS: ${hasAllMonths ? '✓' : '✗ FAIL'}`);
if (!hasAllMonths) {
  console.log('  Full list:', months);
}
console.log();

// Test 4: Full scenario - T12 + YTD combination
console.log('TEST 4: Full T12 + YTD combination scenario');
console.log('  T12 file: May 2024 - April 2025');
console.log('  YTD file: March 2025 - September 2025');
console.log('  Expected freshest T12: October 2024 - September 2025\n');

const testDocs = [
  {
    filename: 'T12_May2024-April2025.xlsx',
    content: 'Income Statement Trailing 12 months May 2024 April 2025'
  },
  {
    filename: 'YTD_Mar2025-Sept2025.xlsx',
    content: 'Year to Date Income Statement March 2025 September 2025'
  }
];

const analysis = analyzeFinancialPeriods(testDocs);

console.log('\nRESULTS:');
// Note: The property is freshest_month_available, not freshest_month
console.log(`  Freshest month: ${analysis.freshest_month_available}`);
console.log(`  Expected: 2025-09-01`);
console.log(`  PASS: ${analysis.freshest_month_available === '2025-09-01' ? '✓' : '✗ FAIL'}`);

if (analysis.recommended_t12) {
  console.log(`\n  Recommended T12: ${analysis.recommended_t12.start} to ${analysis.recommended_t12.end}`);
  console.log(`  Expected: 2024-10-01 to 2025-09-01`);
  const correctT12 = analysis.recommended_t12.start === '2024-10-01' &&
                     analysis.recommended_t12.end === '2025-09-01';
  console.log(`  PASS: ${correctT12 ? '✓' : '✗ FAIL'}`);

  console.log(`\n  Combination needed: ${analysis.combination_needed}`);
  console.log(`  Sources used: ${analysis.recommended_t12.sources_used?.join(', ')}`);
}

console.log('\n=== END TESTS ===');
