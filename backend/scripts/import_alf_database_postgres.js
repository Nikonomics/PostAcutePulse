#!/usr/bin/env node
/**
 * Import ALF Database (2021) into PostgreSQL or SQLite
 *
 * This script imports the 44,650 ALF facility records from the GitHub CSV
 * into an `alf_facilities` table. Automatically detects database type:
 * - PostgreSQL (production via DATABASE_URL)
 * - SQLite (local development)
 */

const fs = require('fs');
const readline = require('readline');
const https = require('https');
const { getSequelizeInstance, getConnectionString } = require('../config/database');

const CSV_PATH = '/tmp/alf_database.csv';
const CSV_URL = 'https://raw.githubusercontent.com/antonstengel/assisted-living-data/main/assisted-living-facilities.csv';

console.log('🏥 ALF Database Import Script');
console.log('================================\n');

// Get database configuration
const dbConfig = getConnectionString();
console.log(`📊 Database type: ${dbConfig.type}`);
if (dbConfig.type === 'postgres') {
  console.log(`📊 Using PostgreSQL (persistent across restarts)`);
} else {
  console.log(`📊 Using SQLite at: ${dbConfig.path}`);
}

// Create Sequelize instance
const sequelize = getSequelizeInstance();

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
  if (!value || value === '' || value === 'NA' || value === 'N/A') return null;

  // Remove quotes if present
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  return value;
}

// Download CSV from GitHub
async function downloadCSV() {
  // Check if CSV already exists
  if (fs.existsSync(CSV_PATH)) {
    console.log('✅ CSV file already exists at:', CSV_PATH);
    console.log('   Skipping download.\n');
    return;
  }

  console.log('📥 Downloading CSV from GitHub...');
  console.log('   URL:', CSV_URL);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(CSV_PATH);

    https.get(CSV_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}%`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n✅ CSV downloaded successfully\n');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(CSV_PATH, () => {});
      reject(new Error(`Download failed: ${err.message}`));
    });
  });
}

async function importData() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Download CSV from GitHub
    await downloadCSV();

    // Create table using Sequelize query
    console.log('📋 Creating alf_facilities table...');

    const isPostgres = dbConfig.type === 'postgres';

    // Create table SQL (adjusted for PostgreSQL vs SQLite)
    const createTableSQL = isPostgres ? `
      CREATE TABLE IF NOT EXISTS alf_facilities (
        id SERIAL PRIMARY KEY,
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
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        county_fips TEXT,
        total_county_al_need DOUBLE PRECISION,
        pct_population_over_65 DOUBLE PRECISION,
        median_age DOUBLE PRECISION,
        pct_owner_occupied DOUBLE PRECISION,
        pct_renter_occupied DOUBLE PRECISION,
        pct_vacant DOUBLE PRECISION,
        median_home_value DOUBLE PRECISION,
        avg_household_size DOUBLE PRECISION,
        avg_family_size DOUBLE PRECISION,
        median_household_income DOUBLE PRECISION,
        poverty_rate DOUBLE PRECISION,
        unemployment_rate DOUBLE PRECISION,
        pct_population_white DOUBLE PRECISION,
        pct_population_black DOUBLE PRECISION,
        pct_population_hispanic DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    ` : `
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

    await sequelize.query(createTableSQL);
    console.log('✅ Table created successfully\n');

    // Create indexes
    console.log('🔍 Creating indexes...');
    const createIndexesSQL = [
      `CREATE INDEX IF NOT EXISTS idx_alf_facility_name ON alf_facilities(facility_name);`,
      `CREATE INDEX IF NOT EXISTS idx_alf_city_state ON alf_facilities(city, state);`,
      `CREATE INDEX IF NOT EXISTS idx_alf_state ON alf_facilities(state);`,
      `CREATE INDEX IF NOT EXISTS idx_alf_zip ON alf_facilities(zip_code);`,
      `CREATE INDEX IF NOT EXISTS idx_alf_coords ON alf_facilities(latitude, longitude);`
    ];

    for (const indexSQL of createIndexesSQL) {
      await sequelize.query(indexSQL);
    }
    console.log('✅ Indexes created successfully\n');

    // Check if data already exists
    const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM alf_facilities');
    const count = countResult[0].count;

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
        await sequelize.close();
        process.exit(0);
      }

      await sequelize.query('DELETE FROM alf_facilities');
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
    const batchSize = 100;
    let batch = [];

    for await (const line of rl) {
      lineNumber++;

      if (lineNumber === 1) {
        headers = parseCSVLine(line);
        continue;
      }

      try {
        const values = parseCSVLine(line);

        // Map CSV columns to database fields (34 columns total)
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

        batch.push(record);

        // Insert in batches
        if (batch.length >= batchSize) {
          const placeholders = batch.map(() =>
            `(${Array(34).fill('?').join(', ')})`
          ).join(', ');

          const insertSQL = `
            INSERT INTO alf_facilities (
              facility_id, facility_name, address, city, state, zip_code, phone_number,
              county, licensee, state_facility_type_2, state_facility_type_1, date_accessed,
              license_number, capacity, email_address, ownership_type, latitude, longitude,
              county_fips, total_county_al_need, pct_population_over_65, median_age,
              pct_owner_occupied, pct_renter_occupied, pct_vacant, median_home_value,
              avg_household_size, avg_family_size, median_household_income, poverty_rate,
              unemployment_rate, pct_population_white, pct_population_black, pct_population_hispanic
            ) VALUES ${placeholders}
          `;

          const flattenedBatch = batch.flat();
          await sequelize.query(insertSQL, { replacements: flattenedBatch });

          importedCount += batch.length;
          batch = [];

          process.stdout.write(`\r   Imported: ${importedCount} records...`);
        }

      } catch (err) {
        errorCount++;
        if (errorCount <= 5) {
          console.error(`\n⚠️  Error on line ${lineNumber}:`, err.message);
        }
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      const placeholders = batch.map(() =>
        `(${Array(34).fill('?').join(', ')})`
      ).join(', ');

      const insertSQL = `
        INSERT INTO alf_facilities (
          facility_id, facility_name, address, city, state, zip_code, phone_number,
          county, licensee, state_facility_type_2, state_facility_type_1, date_accessed,
          license_number, capacity, email_address, ownership_type, latitude, longitude,
          county_fips, total_county_al_need, pct_population_over_65, median_age,
          pct_owner_occupied, pct_renter_occupied, pct_vacant, median_home_value,
          avg_household_size, avg_family_size, median_household_income, poverty_rate,
          unemployment_rate, pct_population_white, pct_population_black, pct_population_hispanic
        ) VALUES ${placeholders}
      `;

      const flattenedBatch = batch.flat();
      await sequelize.query(insertSQL, { replacements: flattenedBatch });

      importedCount += batch.length;
    }

    console.log(`\n\n✅ Import complete!`);
    console.log(`   Records imported: ${importedCount}`);
    console.log(`   Errors: ${errorCount}`);

    // Show sample records
    console.log('\n📊 Sample records from database:');
    const [samples] = await sequelize.query(
      'SELECT facility_name, city, state, capacity, latitude, longitude FROM alf_facilities LIMIT 3'
    );

    samples.forEach((row, i) => {
      console.log(`\n   ${i + 1}. ${row.facility_name}`);
      console.log(`      Location: ${row.city}, ${row.state}`);
      console.log(`      Capacity: ${row.capacity || 'N/A'} beds`);
      console.log(`      Coordinates: (${row.latitude}, ${row.longitude})`);
    });

    // Show summary by state
    console.log('\n📍 Facilities by state (top 10):');
    const [byState] = await sequelize.query(`
      SELECT state, COUNT(*) as count
      FROM alf_facilities
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY count DESC
      LIMIT 10
    `);

    byState.forEach((row) => {
      console.log(`   ${row.state}: ${row.count} facilities`);
    });

  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    console.error(err);
  } finally {
    await sequelize.close();
    console.log('\n👋 Database connection closed.');
  }
}

// Run import
importData();
