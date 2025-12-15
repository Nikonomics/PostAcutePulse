require('dotenv').config();
const { matchFacility, findFacilityMatches } = require('./services/facilityMatcher');

async function testALFSearch() {
  console.log('Testing ALF Facility Search...\n');

  try {
    // Test 1: Search for a facility in Oregon (matching a deal we have)
    console.log('Test 1: Searching for "Odd Fellows Home" in Oregon...');
    const match1 = await matchFacility('Odd Fellows Home of Oregon', null, 'Oregon', 0.6);
    if (match1) {
      console.log('✅ Found match:');
      console.log('  - Name:', match1.facilityname);
      console.log('  - City:', match1.city);
      console.log('  - State:', match1.state);
      console.log('  - Licensed Beds:', match1.licensed_beds);
      console.log('  - Match Score:', match1.similarity_score);
    } else {
      console.log('❌ No match found');
    }

    // Test 2: Find multiple matches
    console.log('\nTest 2: Finding top 3 matches for "Sunset Manor" in California...');
    const matches = await findFacilityMatches('Sunset Manor', null, 'California', 0.5, 3);
    console.log(`✅ Found ${matches.length} matches:`);
    matches.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.facilityname} (${m.city}, ${m.state}) - Score: ${m.similarity_score}`);
    });

    console.log('\n✅ ALF facility search is working with PostgreSQL!');
    process.exit(0);
  } catch (error) {
    console.error('❌ ALF search failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testALFSearch();
