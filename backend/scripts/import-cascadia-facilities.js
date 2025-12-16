/**
 * Import Cascadia facilities from Excel file
 * Geocodes addresses to get lat/lon coordinates
 */

const XLSX = require('xlsx');
const axios = require('axios');
const path = require('path');

// Initialize database
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../models');

const EXCEL_FILE = '/Users/nikolashulewsky/Desktop/Cascadia Locations.xlsx';

// Rate limiter for Nominatim (1 request per second)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function geocodeAddress(address, city, state, zip) {
  try {
    const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
      { headers: { 'User-Agent': 'SNFalyze/1.0' } }
    );

    if (response.data && response.data.length > 0) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon)
      };
    }

    // Fallback: try city, state only
    const fallbackQuery = encodeURIComponent(`${city}, ${state}`);
    const fallbackResponse = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${fallbackQuery}&limit=1`,
      { headers: { 'User-Agent': 'SNFalyze/1.0' } }
    );

    if (fallbackResponse.data && fallbackResponse.data.length > 0) {
      console.log(`  Using city-level geocoding for ${city}, ${state}`);
      return {
        latitude: parseFloat(fallbackResponse.data[0].lat),
        longitude: parseFloat(fallbackResponse.data[0].lon)
      };
    }

    return { latitude: null, longitude: null };
  } catch (err) {
    console.error(`Geocoding error for ${address}, ${city}, ${state}:`, err.message);
    return { latitude: null, longitude: null };
  }
}

function parseDate(value) {
  if (!value) return null;

  // Handle Excel serial date number
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  // Handle string date
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

async function importFacilities() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} facilities to import`);

  // Wait for database to sync
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Ensure table exists
  await db.CascadiaFacility.sync({ alter: true });

  // Clear existing data
  await db.CascadiaFacility.destroy({ where: {} });
  console.log('Cleared existing Cascadia facilities');

  let imported = 0;
  let geocoded = 0;

  for (const row of data) {
    const facilityName = row['Facility Name'];
    const address = row['Address'];
    const city = row['City'];
    const state = row['State'];
    const zip = String(row['ZIP'] || '');

    console.log(`\nProcessing: ${facilityName}`);

    // Geocode the address
    const coords = await geocodeAddress(address, city, state, zip);
    if (coords.latitude) {
      geocoded++;
      console.log(`  Geocoded: ${coords.latitude}, ${coords.longitude}`);
    } else {
      console.log(`  Could not geocode`);
    }

    // Create the facility record
    await db.CascadiaFacility.create({
      facility_name: facilityName,
      type: row['Type'] || 'SNF',
      pcc_id: row['PCC ID'] || null,
      finance_id: row['Finance ID'] || null,
      paylocity_id: row['Paylocity ID'] || null,
      address: address,
      city: city,
      state: state,
      zip: zip,
      county: row['County'] || null,
      telephone: row['Telephone'] || null,
      fax: row['Fax'] || null,
      ar_start_date: parseDate(row['AR Start Date']),
      company: row['Company'] || null,
      team: row['Team'] || null,
      beds: row['Beds'] || null,
      npi: row['NPI'] ? String(row['NPI']) : null,
      ccn: row['CCN'] ? String(row['CCN']) : null,
      ein: row['EIN'] ? String(row['EIN']) : null,
      timezone_offset: row['TimeZone'] || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      status: 'current_operations'
    });

    imported++;

    // Rate limit for Nominatim
    await sleep(1100);
  }

  console.log(`\n========================================`);
  console.log(`Import complete!`);
  console.log(`  Total facilities: ${imported}`);
  console.log(`  Successfully geocoded: ${geocoded}`);
  console.log(`  Failed to geocode: ${imported - geocoded}`);
  console.log(`========================================`);

  process.exit(0);
}

importFacilities().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
