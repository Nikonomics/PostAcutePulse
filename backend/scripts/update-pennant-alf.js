/**
 * Update ALF facilities with Pennant Group ownership
 *
 * This script matches Pennant facilities to existing database records
 * and updates the licensee field. For facilities not found, it logs
 * them for manual addition.
 *
 * Usage: MARKET_DATABASE_URL="..." node scripts/update-pennant-alf.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Pennant Group facilities from research
const pennantFacilities = [
  // Idaho (5 facilities)
  { name: 'Table Rock at Paramount', city: 'Meridian', state: 'ID', capacity: 50, searchTerms: ['paramount', 'table rock'] },
  { name: 'Table Rock at Park Place', city: 'Nampa', state: 'ID', capacity: 65, searchTerms: ['park place', 'table rock'] },
  { name: 'Table Rock at Barber Station', city: 'Boise', state: 'ID', capacity: 80, searchTerms: ['barber', 'table rock'] },
  { name: 'Heritage AL of Twin Falls', city: 'Twin Falls', state: 'ID', capacity: 78, searchTerms: ['heritage'] },
  { name: 'Twin Rivers Senior Living', city: 'Lewiston', state: 'ID', capacity: 55, searchTerms: ['twin rivers'] },

  // Utah (2 facilities)
  { name: 'Capitol Hill Senior Living', city: 'Salt Lake City', state: 'UT', capacity: 77, searchTerms: ['capitol hill'] },
  { name: 'Southgate Senior Living', city: 'St. George', state: 'UT', capacity: 75, searchTerms: ['southgate'] },

  // Nevada (4 facilities)
  { name: 'Park Place Assisted Living', city: 'Reno', state: 'NV', capacity: 60, searchTerms: ['park place'] },
  { name: 'Desert View Senior Living', city: 'Las Vegas', state: 'NV', capacity: null, searchTerms: ['desert view'] },
  { name: 'Desert Springs Senior Living', city: 'Las Vegas', state: 'NV', capacity: null, searchTerms: ['desert springs'] },
  { name: 'Villa Court Assisted Living', city: 'Las Vegas', state: 'NV', capacity: 48, searchTerms: ['villa court'] },

  // California (7 facilities)
  { name: 'Santa Maria Terrace', city: 'Santa Maria', state: 'CA', capacity: 140, searchTerms: ['santa maria terrace'] },
  { name: 'The Lexington Assisted Living', city: 'Ventura', state: 'CA', capacity: 125, searchTerms: ['lexington'] },
  { name: 'California Mission Inn', city: 'Rosemead', state: 'CA', capacity: 85, searchTerms: ['california mission', 'mission inn'] },
  { name: 'Whittier Glen Assisted Living', city: 'Whittier', state: 'CA', capacity: 93, searchTerms: ['whittier glen'] },
  { name: 'Citrus Hills Assisted Living', city: 'Orange', state: 'CA', capacity: 95, searchTerms: ['citrus hills'] },
  { name: 'Mainplace Senior Living', city: 'Orange', state: 'CA', capacity: 153, searchTerms: ['mainplace'] },
  { name: 'Lo-Har Senior Living', city: 'El Cajon', state: 'CA', capacity: 68, searchTerms: ['lo-har', 'lohar'] },

  // Arizona (6 facilities)
  { name: 'Las Fuentes Resort Village', city: 'Prescott', state: 'AZ', capacity: 84, searchTerms: ['las fuentes'] },
  { name: 'Rose Court Senior Living', city: 'Phoenix', state: 'AZ', capacity: 92, searchTerms: ['rose court'] },
  { name: 'Grand Court of Mesa', city: 'Mesa', state: 'AZ', capacity: 140, searchTerms: ['grand court'] },
  { name: 'Villages At Red Mountain', city: 'Mesa', state: 'AZ', capacity: 160, searchTerms: ['red mountain', 'villages'] },
  { name: 'Mountain View Retirement Village', city: 'Tucson', state: 'AZ', capacity: 99, searchTerms: ['mountain view'] },
  { name: 'Sherwood Village Living', city: 'Tucson', state: 'AZ', capacity: 160, searchTerms: ['sherwood'] },

  // Texas (14 facilities)
  { name: 'Wisteria Place Senior Living & MC', city: 'Abilene', state: 'TX', capacity: 123, searchTerms: ['wisteria'] },
  { name: 'Mesa Springs Retirement Village', city: 'Abilene', state: 'TX', capacity: 89, searchTerms: ['mesa springs'] },
  { name: 'Windsor Court Senior Living', city: 'Weatherford', state: 'TX', capacity: 23, searchTerms: ['windsor court'] },
  { name: 'Bridgewater Memory Care', city: 'Granbury', state: 'TX', capacity: 52, searchTerms: ['bridgewater'] },
  { name: 'Rockbrook Memory Care', city: 'Lewisville', state: 'TX', capacity: 52, searchTerms: ['rockbrook'] },
  { name: 'Deer Creek Senior Living', city: 'DeSoto', state: 'TX', capacity: 58, searchTerms: ['deer creek'] },
  { name: 'Cedar Hill Senior Living', city: 'Cedar Hill', state: 'TX', capacity: 50, searchTerms: ['cedar hill senior'] },
  { name: 'Meadow Creek Senior Living', city: 'Lancaster', state: 'TX', capacity: 50, searchTerms: ['meadow creek'] },
  { name: 'Lakeshore AL and Memory Care', city: 'Rockwall', state: 'TX', capacity: 46, searchTerms: ['lakeshore'] },
  { name: 'Paris Chalet Senior Living', city: 'Paris', state: 'TX', capacity: 60, searchTerms: ['paris chalet'] },
  { name: 'River Point of Kerrville', city: 'Kerrville', state: 'TX', capacity: 70, searchTerms: ['river point'] },
  { name: 'Canyon Creek Memory Care', city: 'Temple', state: 'TX', capacity: 50, searchTerms: ['canyon creek'] },
  { name: 'Harvest Home & Inwood Crossing', city: 'Tomball', state: 'TX', capacity: 38, searchTerms: ['harvest home', 'inwood'] },

  // Wisconsin (25 facilities)
  { name: 'Cranberry Court', city: 'Wisconsin Rapids', state: 'WI', capacity: 42, searchTerms: ['cranberry court'] },
  { name: 'Mountain Terrace', city: 'Wausau', state: 'WI', capacity: 35, searchTerms: ['mountain terrace'] },
  { name: 'Willow Brooke Point', city: 'Stevens Point', state: 'WI', capacity: 52, searchTerms: ['willow brooke'] },
  { name: 'Madison Pointe', city: 'Madison', state: 'WI', capacity: 47, searchTerms: ['madison pointe'] },
  { name: 'McFarland Villa', city: 'McFarland', state: 'WI', capacity: 36, searchTerms: ['mcfarland villa'] },
  { name: 'Stoughton Meadows', city: 'Stoughton', state: 'WI', capacity: 45, searchTerms: ['stoughton meadows'] },
  { name: 'Lakepoint Villa', city: 'Oshkosh', state: 'WI', capacity: 20, searchTerms: ['lakepoint'] },
  { name: 'Lotus Gardens', city: 'Appleton', state: 'WI', capacity: 40, searchTerms: ['lotus gardens'] },
  { name: 'Parkside', city: 'Neenah', state: 'WI', capacity: 20, searchTerms: ['parkside'] },
  { name: 'Maple Meadows', city: 'Fond du Lac', state: 'WI', capacity: 20, searchTerms: ['maple meadows'] },
  { name: 'Cottonwood Manor', city: 'Green Bay', state: 'WI', capacity: 35, searchTerms: ['cottonwood manor'] },
  { name: 'Blue Jay Springs', city: 'Green Bay', state: 'WI', capacity: 40, searchTerms: ['blue jay'] },
  { name: 'Autumn Embers', city: 'Green Bay', state: 'WI', capacity: 21, searchTerms: ['autumn embers'] },
  { name: 'Riverview Village', city: 'Menomonee Falls', state: 'WI', capacity: 48, searchTerms: ['riverview village'] },
  { name: 'Scandinavian Court', city: 'Denmark', state: 'WI', capacity: 20, searchTerms: ['scandinavian'] },
  { name: 'Sunrise Meadows', city: 'Brookfield', state: 'WI', capacity: 48, searchTerms: ['sunrise meadows'] },
  { name: 'Sunset Woods', city: 'New Berlin', state: 'WI', capacity: null, searchTerms: ['sunset woods'] },
  { name: 'Honey Creek Heights', city: 'West Allis', state: 'WI', capacity: 135, searchTerms: ['honey creek'] },
  { name: 'Brenwood Park', city: 'Franklin', state: 'WI', capacity: 46, searchTerms: ['brenwood'] },
  { name: 'Harbor View', city: 'Manitowoc', state: 'WI', capacity: 43, searchTerms: ['harbor view'] },
  { name: 'Shores of Sheboygan', city: 'Sheboygan', state: 'WI', capacity: 84, searchTerms: ['shores of sheboygan'] },
  { name: 'Meadow View', city: 'Two Rivers', state: 'WI', capacity: 28, searchTerms: ['meadow view'] },
  { name: 'Pleasant Point', city: 'Racine', state: 'WI', capacity: 40, searchTerms: ['pleasant point'] },
  { name: 'North Point', city: 'Kenosha', state: 'WI', capacity: 20, searchTerms: ['north point'] },
  { name: 'Kenosha Senior Living', city: 'Kenosha', state: 'WI', capacity: 40, searchTerms: ['kenosha senior'] },
];

async function findMatch(facility) {
  // Try exact city match first
  for (const term of facility.searchTerms) {
    const res = await pool.query(`
      SELECT id, facility_name, city, state, capacity, licensee, address, latitude, longitude
      FROM alf_facilities
      WHERE state = $1
      AND LOWER(city) LIKE LOWER($2)
      AND LOWER(facility_name) LIKE LOWER($3)
      LIMIT 1
    `, [facility.state, '%' + facility.city.split(' ')[0] + '%', '%' + term + '%']);

    if (res.rows.length > 0) {
      return res.rows[0];
    }
  }

  // Try state-wide search if city match failed
  for (const term of facility.searchTerms) {
    const res = await pool.query(`
      SELECT id, facility_name, city, state, capacity, licensee, address, latitude, longitude
      FROM alf_facilities
      WHERE state = $1
      AND LOWER(facility_name) LIKE LOWER($2)
      LIMIT 1
    `, [facility.state, '%' + term + '%']);

    if (res.rows.length > 0) {
      return res.rows[0];
    }
  }

  return null;
}

async function updatePennantFacilities() {
  console.log('🏥 Pennant Group ALF Facility Matcher\n');
  console.log('=' .repeat(70));

  const matched = [];
  const notFound = [];
  const updated = [];

  for (const facility of pennantFacilities) {
    const match = await findMatch(facility);

    if (match) {
      matched.push({ pennant: facility, db: match });

      // Update licensee to Pennant Group
      await pool.query(`
        UPDATE alf_facilities
        SET licensee = 'Pennant Group',
            ownership_type = 'For Profit'
            ${facility.capacity ? ', capacity = ' + facility.capacity : ''}
        WHERE id = $1
      `, [match.id]);

      updated.push(match.id);
      console.log(`✓ MATCHED & UPDATED: ${facility.name}`);
      console.log(`  → DB: ${match.facility_name} (${match.city}, ${match.state}) ID:${match.id}`);
    } else {
      notFound.push(facility);
      console.log(`✗ NOT FOUND: ${facility.name} (${facility.city}, ${facility.state})`);
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Pennant facilities: ${pennantFacilities.length}`);
  console.log(`   Matched & Updated: ${matched.length}`);
  console.log(`   Not Found: ${notFound.length}`);

  if (notFound.length > 0) {
    console.log(`\n⚠️  FACILITIES NOT FOUND (may need manual addition):`);
    notFound.forEach(f => {
      console.log(`   - ${f.name} | ${f.city}, ${f.state} | Cap: ${f.capacity || 'N/A'}`);
    });
  }

  await pool.end();
}

updatePennantFacilities().catch(console.error);
