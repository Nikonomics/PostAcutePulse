/**
 * Add Missing Pennant ALF Facilities
 *
 * These facilities need to be either:
 * - Updated (if they exist under a different name at the same address)
 * - Inserted (if they don't exist in the database)
 *
 * Usage: MARKET_DATABASE_URL="..." node scripts/add-missing-pennant-alf.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Facilities that exist at the address but under different names (need UPDATE)
const facilitiesToUpdate = [
  {
    addressSearch: '2114 Vineyard',
    newName: 'Twin Rivers Senior Living',
    capacity: 55
  },
  {
    addressSearch: '2626 Finger',
    newName: 'Autumn Embers',
    capacity: 21
  },
  {
    addressSearch: '2900 S Moorland',
    newName: 'Sunset Woods',
    capacity: null
  }
];

// Facilities that don't exist in database (need INSERT)
const facilitiesToInsert = [
  {
    facility_name: 'Mesa Springs Retirement Village',
    address: '7171 Buffalo Gap Rd',
    city: 'Abilene',
    state: 'TX',
    zip_code: '79606',
    capacity: 89
  },
  {
    facility_name: 'Cedar Hill Senior Living',
    address: '602 E Belt Line Rd',
    city: 'Cedar Hill',
    state: 'TX',
    zip_code: '75104',
    capacity: 50
  },
  {
    facility_name: 'Meadow Creek Senior Living',
    address: '2400 W Pleasant Run Rd',
    city: 'Lancaster',
    state: 'TX',
    zip_code: '75146',
    capacity: 50
  },
  {
    facility_name: 'Lotus Gardens',
    address: '3201 W 1st Ave',
    city: 'Appleton',
    state: 'WI',
    zip_code: '54914',
    capacity: 40
  },
  {
    facility_name: 'Blue Jay Springs',
    address: '1006 N Military Ave',
    city: 'Green Bay',
    state: 'WI',
    zip_code: '54303',
    capacity: 40
  },
  {
    facility_name: 'Sunrise Meadows',
    address: '2800 N Calhoun Rd',
    city: 'Brookfield',
    state: 'WI',
    zip_code: '53005',
    capacity: 48
  },
  {
    facility_name: 'Honey Creek Heights',
    address: '7400 W Greenfield Ave',
    city: 'West Allis',
    state: 'WI',
    zip_code: '53214',
    capacity: 135
  }
];

// Simple geocoding using a free service (nominatim)
async function geocodeAddress(facility) {
  const address = `${facility.address}, ${facility.city}, ${facility.state} ${facility.zip_code}`;
  const encodedAddress = encodeURIComponent(address);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'PACadvocate-ALF-Update/1.0'
        }
      }
    );

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.log(`  ⚠ Geocoding failed for ${facility.facility_name}: ${error.message}`);
  }

  return { latitude: null, longitude: null };
}

// Add delay to respect Nominatim rate limits (1 request per second)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processFacilities() {
  console.log('🏥 Processing Missing Pennant ALF Facilities\n');
  console.log('='.repeat(70));

  const updated = [];
  const inserted = [];
  const errors = [];

  // PART 1: Update existing facilities that match by address
  console.log('\n📝 UPDATING EXISTING FACILITIES (by address match):\n');

  for (const f of facilitiesToUpdate) {
    const res = await pool.query(`
      SELECT id, facility_name, address, city, state FROM alf_facilities
      WHERE LOWER(address) LIKE LOWER($1)
      LIMIT 1
    `, [`%${f.addressSearch}%`]);

    if (res.rows.length > 0) {
      const existing = res.rows[0];
      console.log(`Found: ${existing.facility_name} (ID: ${existing.id})`);
      console.log(`  → Renaming to: ${f.newName}`);

      let updateQuery, params;
      if (f.capacity) {
        updateQuery = `UPDATE alf_facilities SET facility_name = $1, licensee = 'Pennant Group', ownership_type = 'For Profit', capacity = $2 WHERE id = $3`;
        params = [f.newName, f.capacity, existing.id];
      } else {
        updateQuery = `UPDATE alf_facilities SET facility_name = $1, licensee = 'Pennant Group', ownership_type = 'For Profit' WHERE id = $2`;
        params = [f.newName, existing.id];
      }
      await pool.query(updateQuery, params);
      updated.push({ oldName: existing.facility_name, newName: f.newName, id: existing.id });
      console.log(`  ✓ Updated\n`);
    } else {
      console.log(`⚠ Not found: ${f.addressSearch}\n`);
    }
  }

  // PART 2: Insert new facilities
  console.log('\n➕ INSERTING NEW FACILITIES:\n');

  for (const facility of facilitiesToInsert) {
    console.log(`Processing: ${facility.facility_name} (${facility.city}, ${facility.state})`);

    // Geocode the address
    console.log(`  📍 Geocoding...`);
    const coords = await geocodeAddress(facility);
    await delay(1100); // Respect Nominatim rate limit

    if (coords.latitude) {
      console.log(`  ✓ Found coordinates: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } else {
      console.log(`  ⚠ Could not geocode - will insert without coordinates`);
    }

    try {
      const result = await pool.query(`
        INSERT INTO alf_facilities (
          facility_name, address, city, state, zip_code,
          capacity, licensee, ownership_type,
          latitude, longitude
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        facility.facility_name,
        facility.address,
        facility.city,
        facility.state,
        facility.zip_code,
        facility.capacity,
        'Pennant Group',
        'For Profit',
        coords.latitude,
        coords.longitude
      ]);

      inserted.push({ ...facility, id: result.rows[0].id });
      console.log(`  ✓ INSERTED: ID ${result.rows[0].id}\n`);
    } catch (error) {
      errors.push({ facility, error: error.message });
      console.log(`  ✗ ERROR: ${error.message}\n`);
    }
  }

  console.log('='.repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Updated (renamed): ${updated.length}`);
  console.log(`   Inserted (new): ${inserted.length}`);
  console.log(`   Errors: ${errors.length}`);

  if (updated.length > 0) {
    console.log(`\n✅ UPDATED FACILITIES:`);
    updated.forEach(f => {
      console.log(`   - ${f.oldName} → ${f.newName} (ID: ${f.id})`);
    });
  }

  if (inserted.length > 0) {
    console.log(`\n✅ INSERTED FACILITIES:`);
    inserted.forEach(f => {
      console.log(`   - ${f.facility_name} (${f.city}, ${f.state}) - ID: ${f.id}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS:`);
    errors.forEach(e => {
      console.log(`   - ${e.facility.facility_name}: ${e.error}`);
    });
  }

  // Show final Pennant count
  const pennantCount = await pool.query(`
    SELECT COUNT(*) as count FROM alf_facilities WHERE licensee = 'Pennant Group'
  `);
  console.log(`\n📈 Total Pennant Group facilities in database: ${pennantCount.rows[0].count}`);

  await pool.end();
}

processFacilities().catch(console.error);
