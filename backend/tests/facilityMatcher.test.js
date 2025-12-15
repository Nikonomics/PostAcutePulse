/**
 * Facility Matcher Test
 *
 * Tests the multi-facility detection and matching service using Project Teton data.
 * Project Teton is a 2-facility SNF portfolio in Wyoming:
 * - Big Horn Rehabilitation & Care Center (Sheridan, WY - 124 beds)
 * - Polaris Care & Rehabilitation (Cheyenne, WY - 109 beds)
 *
 * Run: node tests/facilityMatcher.test.js
 */

require('dotenv').config();
const {
  detectFacilitiesFromText,
  matchFacilityToDatabase,
  searchFacilityByName,
  batchMatchFacilities
} = require('../services/facilityMatcher');

// Sample document text from Project Teton that would be extracted from the offering memorandum
const PROJECT_TETON_DOCUMENT_TEXT = `
PROJECT TETON
Investment Memorandum - Confidential

EXECUTIVE SUMMARY
Evans Senior Investments is pleased to present Project Teton, a 233-bed skilled nursing facility
portfolio consisting of two facilities in Wyoming.

PORTFOLIO OVERVIEW

Facility 1: Big Horn Rehabilitation & Care Center
Location: Sheridan, Wyoming
Licensed Beds: 124
Current Occupancy: 60%
Year Built: 1963
The facility provides skilled nursing, rehabilitation, and long-term care services.

Facility 2: Polaris Care & Rehabilitation
Location: Cheyenne, Wyoming
Licensed Beds: 109
Current Occupancy: 82%
Year Built: 1978
The facility specializes in post-acute rehabilitation and memory care.

COMBINED PORTFOLIO METRICS
Total Licensed Beds: 233
Average Occupancy: 72%
TTM Revenue: $22,218,716
Net Income: ($9,894,000)
Payer Mix: Medicaid 65.7%, Medicare 21.5%, Private Pay 12.8%

CONTACT INFORMATION
Jeremy Stroiman, CEO
Evans Senior Investments
Phone: (773) 383-8449
Email: Jeremy.stroiman@evanssenior.com
`;

async function runTests() {
  console.log('='.repeat(60));
  console.log('FACILITY MATCHER TEST - PROJECT TETON');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Detect facilities from document text
  console.log('TEST 1: Detect Facilities from Document Text');
  console.log('-'.repeat(60));

  try {
    const detectedFacilities = await detectFacilitiesFromText(PROJECT_TETON_DOCUMENT_TEXT, ['SNF']);

    console.log(`\nDetected ${detectedFacilities.length} facilities:`);
    detectedFacilities.forEach((facility, i) => {
      console.log(`\n  Facility ${i + 1}:`);
      console.log(`    Name: ${facility.name}`);
      console.log(`    City: ${facility.city}`);
      console.log(`    State: ${facility.state}`);
      console.log(`    Beds: ${facility.beds}`);
      console.log(`    Type: ${facility.facility_type}`);
      console.log(`    Confidence: ${facility.confidence}`);
    });

    // Verify Big Horn and Polaris were detected
    const bigHornDetected = detectedFacilities.some(f =>
      f.name.toLowerCase().includes('big horn'));
    const polarisDetected = detectedFacilities.some(f =>
      f.name.toLowerCase().includes('polaris'));

    console.log('\n  Detection Results:');
    console.log(`    Big Horn found: ${bigHornDetected ? '✓ YES' : '✗ NO'}`);
    console.log(`    Polaris found: ${polarisDetected ? '✓ YES' : '✗ NO'}`);

    if (bigHornDetected && polarisDetected) {
      console.log('\n  ✓ TEST 1 PASSED: Both facilities detected!');
    } else {
      console.log('\n  ✗ TEST 1 FAILED: Not all facilities detected');
    }

    // Test 2: Match detected facilities against SNF database
    console.log('\n\nTEST 2: Match Facilities to Database');
    console.log('-'.repeat(60));

    const matchResults = await batchMatchFacilities(detectedFacilities);

    matchResults.forEach((result, i) => {
      console.log(`\n  Facility ${i + 1}: ${result.detected.name}`);
      console.log(`    Best Match: ${result.best_match?.facility_name || 'NO MATCH'}`);
      console.log(`    Score: ${result.best_match?.weighted_score?.toFixed(3) || 'N/A'}`);
      console.log(`    Confidence: ${result.best_match?.match_confidence || 'N/A'}`);
      console.log(`    Needs Review: ${result.needs_review ? 'YES' : 'NO'}`);

      if (result.matches.length > 1) {
        console.log('    Alternative Matches:');
        result.matches.slice(1, 3).forEach((match, j) => {
          console.log(`      ${j + 2}. ${match.facility_name} (${match.weighted_score?.toFixed(3)})`);
        });
      }
    });

    // Check if matches are reasonable
    const goodMatches = matchResults.filter(r =>
      r.best_match && r.best_match.weighted_score >= 0.6);

    console.log(`\n  Match Summary: ${goodMatches.length}/${matchResults.length} facilities matched with high confidence`);

    if (goodMatches.length === detectedFacilities.length) {
      console.log('  ✓ TEST 2 PASSED: All facilities matched!');
    } else {
      console.log('  ! TEST 2 PARTIAL: Some facilities need manual review');
    }

  } catch (error) {
    console.error('  ✗ TEST FAILED:', error.message);
  }

  // Test 3: Manual search function
  console.log('\n\nTEST 3: Manual Facility Search');
  console.log('-'.repeat(60));

  try {
    console.log('\n  Searching for "Big Horn" in Wyoming SNF database...');
    const bigHornResults = await searchFacilityByName('Big Horn', 'SNF', 'WY');
    console.log(`  Found ${bigHornResults.length} results:`);
    bigHornResults.slice(0, 3).forEach((f, i) => {
      console.log(`    ${i + 1}. ${f.facility_name} - ${f.city}, ${f.state}`);
    });

    console.log('\n  Searching for "Polaris" in Wyoming SNF database...');
    const polarisResults = await searchFacilityByName('Polaris', 'SNF', 'WY');
    console.log(`  Found ${polarisResults.length} results:`);
    polarisResults.slice(0, 3).forEach((f, i) => {
      console.log(`    ${i + 1}. ${f.facility_name} - ${f.city}, ${f.state}`);
    });

    // If no direct results, search without state filter
    if (polarisResults.length === 0) {
      console.log('\n  Expanding search for "Polaris" without state filter...');
      const polarisAllStates = await searchFacilityByName('Polaris', 'SNF', null);
      console.log(`  Found ${polarisAllStates.length} results nationwide:`);
      polarisAllStates.slice(0, 5).forEach((f, i) => {
        console.log(`    ${i + 1}. ${f.facility_name} - ${f.city}, ${f.state}`);
      });
    }

    console.log('\n  ✓ TEST 3 COMPLETED');

  } catch (error) {
    console.error('  ✗ TEST 3 FAILED:', error.message);
  }

  // Test 4: Direct matching with known facility info
  console.log('\n\nTEST 4: Direct Match with Known Facility Info');
  console.log('-'.repeat(60));

  try {
    // Match Big Horn with known details
    const bigHornInfo = {
      name: 'Big Horn Rehabilitation & Care Center',
      city: 'Sheridan',
      state: 'WY',
      beds: 124
    };

    console.log('\n  Matching Big Horn with explicit details...');
    const bigHornMatches = await matchFacilityToDatabase(bigHornInfo, 'SNF');

    if (bigHornMatches.length > 0) {
      const best = bigHornMatches[0];
      console.log(`    Best Match: ${best.facility_name}`);
      console.log(`    Address: ${best.address}, ${best.city}, ${best.state}`);
      console.log(`    Beds in DB: ${best.total_beds || best.capacity}`);
      console.log(`    Weighted Score: ${best.weighted_score.toFixed(3)}`);
      console.log('    Score Breakdown:');
      console.log(`      Name: ${(best.match_scores.name * 100).toFixed(1)}%`);
      console.log(`      City: ${(best.match_scores.city * 100).toFixed(1)}%`);
      console.log(`      Beds: ${(best.match_scores.beds * 100).toFixed(1)}%`);
      console.log(`      Address: ${(best.match_scores.address * 100).toFixed(1)}%`);
    }

    // Match Polaris with known details
    const polarisInfo = {
      name: 'Polaris Care & Rehabilitation',
      city: 'Cheyenne',
      state: 'WY',
      beds: 109
    };

    console.log('\n  Matching Polaris with explicit details...');
    const polarisMatches = await matchFacilityToDatabase(polarisInfo, 'SNF');

    if (polarisMatches.length > 0) {
      const best = polarisMatches[0];
      console.log(`    Best Match: ${best.facility_name}`);
      console.log(`    Address: ${best.address}, ${best.city}, ${best.state}`);
      console.log(`    Beds in DB: ${best.total_beds || best.capacity}`);
      console.log(`    Weighted Score: ${best.weighted_score.toFixed(3)}`);
      console.log('    Score Breakdown:');
      console.log(`      Name: ${(best.match_scores.name * 100).toFixed(1)}%`);
      console.log(`      City: ${(best.match_scores.city * 100).toFixed(1)}%`);
      console.log(`      Beds: ${(best.match_scores.beds * 100).toFixed(1)}%`);
      console.log(`      Address: ${(best.match_scores.address * 100).toFixed(1)}%`);
    } else {
      console.log('    No direct match found - facility may not be in CMS database');
    }

    console.log('\n  ✓ TEST 4 COMPLETED');

  } catch (error) {
    console.error('  ✗ TEST 4 FAILED:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUITE COMPLETED');
  console.log('='.repeat(60));
  console.log();

  process.exit(0);
}

// Run tests
runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
