#!/usr/bin/env node
/**
 * Import ALF Database (2021) into SQLite
 *
 * This script imports the 44,650 ALF facility records from the GitHub CSV
 * into a new `alf_facilities` table for facility matching and mapping.
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const CSV_PATH = '/tmp/alf_database.csv';

console.log('🏥 ALF Database Import Script');
console.log('================================\n');

// Open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database:', DB_PATH);
});

// Create the alf_facilities table
const createTableSQL = `
CREATE TABLE IF NOT EXISTS alf_facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_id TEXT,
  facility_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone_number TEXT,
  county TEXT,
  licensee TEXT,
  state_facility_type_2 TEXT,
  state_facility_type_1 TEXT,
  date_accessed TEXT,
  license_number TEXT,
  capacity INTEGER,
  email_address TEXT,
  ownership_type TEXT,
  latitude REAL,
  longitude REAL,
  county_fips TEXT,
  total_county_al_need REAL,
  pct_population_over_65 REAL,
  median_age REAL,
  pct_owner_occupied REAL,
  pct_renter_occupied REAL,
  pct_vacant REAL,
  median_home_value REAL,
  avg_household_size REAL,
  avg_family_size REAL,
  median_household_income REAL,
  poverty_rate REAL,
  unemployment_rate REAL,
  pct_population_white REAL,
  pct_population_black REAL,
  pct_population_hispanic REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// Create indexes for fast lookups
const createIndexesSQL = [
  `CREATE INDEX IF NOT EXISTS idx_alf_facility_name ON alf_facilities(facility_name);`,
  `CREATE INDEX IF NOT EXISTS idx_alf_city_state ON alf_facilities(city, state);`,
  `CREATE INDEX IF NOT EXISTS idx_alf_state ON alf_facilities(state);`,
  `CREATE INDEX IF NOT EXISTS idx_alf_zip ON alf_facilities(zip_code);`,
  `CREATE INDEX IF NOT EXISTS idx_alf_coords ON alf_facilities(latitude, longitude);`
];

// Parse CSV line handling commas inside quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// Convert value to appropriate type or null
function convertValue(value) {
  if (value === '' || value === 'NA' || value === 'N/A') return null;

  // Remove quotes if present
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  return value;
}

async function importData() {
  try {
    // Create table
    console.log('📋 Creating alf_facilities table...');
    await new Promise((resolve, reject) => {
      db.run(createTableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ Table created successfully\n');

    // Create indexes
    console.log('🔍 Creating indexes...');
    for (const indexSQL of createIndexesSQL) {
      await new Promise((resolve, reject) => {
        db.run(indexSQL, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    console.log('✅ Indexes created successfully\n');

    // Check if data already exists
    const count = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM alf_facilities', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (count > 0) {
      console.log(`⚠️  Table already contains ${count} records.`);
      console.log('   Delete existing records? This will clear ALL data.');
      const answer = await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('   Type "yes" to continue: ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase());
        });
      });

      if (answer !== 'yes') {
        console.log('❌ Import cancelled.');
        db.close();
        process.exit(0);
      }

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM alf_facilities', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ Existing records cleared\n');
    }

    // Read and import CSV
    console.log('📥 Importing CSV data...');
    console.log('   Source:', CSV_PATH);

    const fileStream = fs.createReadStream(CSV_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    let headers = [];
    let importedCount = 0;
    let errorCount = 0;

    const insertSQL = `
      INSERT INTO alf_facilities (
        facility_id, facility_name, address, city, state, zip_code, phone_number,
        county, licensee, state_facility_type_2, state_facility_type_1, date_accessed,
        license_number, capacity, email_address, ownership_type, latitude, longitude,
        county_fips, total_county_al_need, pct_population_over_65, median_age,
        pct_owner_occupied, pct_renter_occupied, pct_vacant, median_home_value,
        avg_household_size, avg_family_size, median_household_income, poverty_rate,
        unemployment_rate, pct_population_white, pct_population_black, pct_population_hispanic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Use transaction for faster bulk insert
    await new Promise((resolve) => db.run('BEGIN TRANSACTION', resolve));

    for await (const line of rl) {
      lineNumber++;

      if (lineNumber === 1) {
        headers = parseCSVLine(line);
        continue;
      }

      try {
        const values = parseCSVLine(line);

        // Map CSV columns to database fields (33 columns total)
        const record = [
          convertValue(values[0]),  // facility_id
          convertValue(values[1]),  // facility_name
          convertValue(values[2]),  // address
          convertValue(values[3]),  // city
          convertValue(values[4]),  // state
          convertValue(values[5]),  // zip_code
          convertValue(values[6]),  // phone_number
          convertValue(values[7]),  // county
          convertValue(values[8]),  // licensee
          convertValue(values[9]),  // state_facility_type_2
          convertValue(values[10]), // state_facility_type_1
          convertValue(values[11]), // date_accessed
          convertValue(values[12]), // license_number
          convertValue(values[13]) ? parseInt(values[13]) : null, // capacity
          convertValue(values[14]), // email_address
          convertValue(values[15]), // ownership_type
          convertValue(values[16]) ? parseFloat(values[16]) : null, // latitude
          convertValue(values[17]) ? parseFloat(values[17]) : null, // longitude
          convertValue(values[18]), // county_fips
          convertValue(values[19]) ? parseFloat(values[19]) : null, // total_county_al_need
          convertValue(values[20]) ? parseFloat(values[20]) : null, // pct_population_over_65
          convertValue(values[21]) ? parseFloat(values[21]) : null, // median_age
          convertValue(values[22]) ? parseFloat(values[22]) : null, // pct_owner_occupied
          convertValue(values[23]) ? parseFloat(values[23]) : null, // pct_renter_occupied
          convertValue(values[24]) ? parseFloat(values[24]) : null, // pct_vacant
          convertValue(values[25]) ? parseFloat(values[25]) : null, // median_home_value
          convertValue(values[26]) ? parseFloat(values[26]) : null, // avg_household_size
          convertValue(values[27]) ? parseFloat(values[27]) : null, // avg_family_size
          convertValue(values[28]) ? parseFloat(values[28]) : null, // median_household_income
          convertValue(values[29]) ? parseFloat(values[29]) : null, // poverty_rate
          convertValue(values[30]) ? parseFloat(values[30]) : null, // unemployment_rate
          convertValue(values[31]) ? parseFloat(values[31]) : null, // pct_population_white
          convertValue(values[32]) ? parseFloat(values[32]) : null, // pct_population_black
          convertValue(values[33]) ? parseFloat(values[33]) : null  // pct_population_hispanic
        ];

        await new Promise((resolve, reject) => {
          db.run(insertSQL, record, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        importedCount++;

        if (importedCount % 1000 === 0) {
          process.stdout.write(`\r   Imported: ${importedCount} records...`);
        }

      } catch (err) {
        errorCount++;
        if (errorCount <= 5) {
          console.error(`\n⚠️  Error on line ${lineNumber}:`, err.message);
        }
      }
    }

    await new Promise((resolve) => db.run('COMMIT', resolve));

    console.log(`\n\n✅ Import complete!`);
    console.log(`   Records imported: ${importedCount}`);
    console.log(`   Errors: ${errorCount}`);

    // Show sample records
    console.log('\n📊 Sample records from database:');
    const samples = await new Promise((resolve, reject) => {
      db.all('SELECT facility_name, city, state, capacity, latitude, longitude FROM alf_facilities LIMIT 3', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    samples.forEach((row, i) => {
      console.log(`\n   ${i + 1}. ${row.facility_name}`);
      console.log(`      Location: ${row.city}, ${row.state}`);
      console.log(`      Capacity: ${row.capacity || 'N/A'} beds`);
      console.log(`      Coordinates: (${row.latitude}, ${row.longitude})`);
    });

    // Show summary by state
    console.log('\n📍 Facilities by state (top 10):');
    const byState = await new Promise((resolve, reject) => {
      db.all(`
        SELECT state, COUNT(*) as count
        FROM alf_facilities
        WHERE state IS NOT NULL
        GROUP BY state
        ORDER BY count DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    byState.forEach((row) => {
      console.log(`   ${row.state}: ${row.count} facilities`);
    });

  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
  } finally {
    db.close(() => {
      console.log('\n👋 Database connection closed.');
    });
  }
}

// Run import
importData();
