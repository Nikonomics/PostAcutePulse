#!/usr/bin/env node
/**
 * Test script for Facility Matcher
 *
 * Tests the facility matching functionality with sample data
 */

const {
  matchFacility,
  searchFacilities,
  getFacilitiesNearby,
  normalizeFacilityName,
  calculateSimilarity
} = require('../services/facilityMatcher');

console.log('🧪 Facility Matcher Test Suite');
console.log('================================\n');

async function testNormalization() {
  console.log('Test 1: Name Normalization');
  console.log('---------------------------');

  const testCases = [
    'Sunrise Senior Living, LLC',
    'Brookdale Assisted Living Inc.',
    'The Manor at Heritage Oaks',
    'GOLDEN YEARS RETIREMENT COMMUNITY',
    'Emerald Place Memory Care Facility'
  ];

  testCases.forEach(name => {
    const normalized = normalizeFacilityName(name);
    console.log(`  "${name}"`);
    console.log(`  → "${normalized}"\n`);
  });
}

async function testSimilarity() {
  console.log('\nTest 2: String Similarity');
  console.log('-------------------------');

  const pairs = [
    ['Sunrise Senior Living', 'Sunrise Senior Living'],
    ['Sunrise Senior Living', 'Sunrise Senior Living LLC'],
    ['Brookdale', 'Brookedale'],
    ['The Manor', 'Manor House'],
    ['Golden Years', 'Golden Year']
  ];

  pairs.forEach(([str1, str2]) => {
    const score = calculateSimilarity(
      normalizeFacilityName(str1),
      normalizeFacilityName(str2)
    );
    console.log(`  "${str1}" vs "${str2}"`);
    console.log(`  Similarity: ${(score * 100).toFixed(1)}%\n`);
  });
}

async function testMatching() {
  console.log('\nTest 3: Facility Matching');
  console.log('-------------------------');

  const testFacilities = [
    { name: 'American House Keene', city: 'Keene', state: 'NH' },
    { name: 'Artaban House', city: 'Greenfield', state: 'NH' },
    { name: 'Sunrise Senior Living', state: 'CA' },
    { name: 'Brookdale', state: 'FL' }
  ];

  for (const test of testFacilities) {
    console.log(`\n  Looking for: "${test.name}"`);
    if (test.city) console.log(`  City: ${test.city}, State: ${test.state}`);
    else console.log(`  State: ${test.state}`);

    try {
      const match = await matchFacility(test.name, test.city, test.state, 0.6);

      if (match) {
        console.log(`  ✅ MATCH FOUND (${(match.match_score * 100).toFixed(1)}% - ${match.match_confidence})`);
        console.log(`     Facility: ${match.facility_name}`);
        console.log(`     Address: ${match.address}, ${match.city}, ${match.state} ${match.zip_code}`);
        console.log(`     Capacity: ${match.capacity || 'N/A'} beds`);
        if (match.latitude && match.longitude) {
          console.log(`     Coordinates: (${match.latitude}, ${match.longitude})`);
        }
      } else {
        console.log(`  ❌ No match found`);
      }
    } catch (err) {
      console.error(`  ⚠️  Error:`, err.message);
    }
  }
}

async function testSearch() {
  console.log('\n\nTest 4: Facility Search');
  console.log('-----------------------');

  const searches = [
    { name: 'Sunrise', state: 'CA', limit: 3 },
    { city: 'Phoenix', state: 'AZ', limit: 5 },
    { state: 'NH', minCapacity: 50, limit: 3 }
  ];

  for (const criteria of searches) {
    console.log(`\n  Search criteria:`, JSON.stringify(criteria, null, 2));

    try {
      const results = await searchFacilities(criteria);
      console.log(`  Found ${results.length} facilities:`);

      results.forEach((facility, i) => {
        console.log(`\n    ${i + 1}. ${facility.facility_name}`);
        console.log(`       ${facility.city}, ${facility.state} - ${facility.capacity || 'N/A'} beds`);
      });
    } catch (err) {
      console.error(`  ⚠️  Error:`, err.message);
    }
  }
}

async function testNearby() {
  console.log('\n\nTest 5: Nearby Facilities');
  console.log('-------------------------');

  // Test coordinates (Los Angeles, CA)
  const lat = 34.0522;
  const lon = -118.2437;

  console.log(`\n  Finding facilities within 25 miles of (${lat}, ${lon})`);
  console.log(`  (Los Angeles, CA area)`);

  try {
    const facilities = await getFacilitiesNearby(lat, lon, 25, 5);
    console.log(`\n  Found ${facilities.length} facilities:\n`);

    facilities.forEach((facility, i) => {
      console.log(`    ${i + 1}. ${facility.facility_name}`);
      console.log(`       ${facility.city}, ${facility.state}`);
      console.log(`       Capacity: ${facility.capacity || 'N/A'} beds`);
      if (facility.distance_miles) {
        console.log(`       Distance: ${facility.distance_miles} miles`);
      }
      console.log();
    });
  } catch (err) {
    console.error(`  ⚠️  Error:`, err.message);
  }
}

async function runTests() {
  try {
    await testNormalization();
    await testSimilarity();
    await testMatching();
    await testSearch();
    await testNearby();

    console.log('\n✅ All tests completed!\n');
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  }
}

runTests();
