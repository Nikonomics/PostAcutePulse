/**
 * Geocode SNF Facilities using Census Bureau Batch Geocoder
 *
 * This script:
 * 1. Reads addresses from snf_facilities that are missing lat/lng
 * 2. Submits them to Census Bureau batch geocoder (free, no API key)
 * 3. Updates the database with the results
 *
 * Usage: node scripts/geocodeSNFFacilities.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform'
});

// Census Bureau Geocoder endpoint
const CENSUS_GEOCODER_URL = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';

/**
 * Create CSV content for Census batch geocoder
 * Format: Unique ID, Street address, City, State, ZIP (no header)
 */
function createBatchCSV(facilities) {
  return facilities.map(f =>
    `"${f.id}","${f.address}","${f.city}","${f.state}","${f.zip_code}"`
  ).join('\n');
}

/**
 * Submit batch to Census geocoder
 */
async function submitBatch(csvContent, batchNum) {
  return new Promise((resolve, reject) => {
    const FormData = require('form-data');
    const form = new FormData();

    // Create a temporary file for the batch
    const tempFile = `/tmp/geocode_batch_${batchNum}.csv`;
    fs.writeFileSync(tempFile, csvContent);

    form.append('addressFile', fs.createReadStream(tempFile));
    form.append('benchmark', 'Public_AR_Current');
    form.append('vintage', 'Current_Current');

    const options = {
      method: 'POST',
      hostname: 'geocoding.geo.census.gov',
      path: '/geocoder/locations/addressbatch',
      headers: form.getHeaders()
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fs.unlinkSync(tempFile); // Clean up temp file
        resolve(data);
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

/**
 * Parse Census geocoder response
 * Response format: "id","input_address","match_status","match_type","matched_address","coords","tiger_line_id","side"
 * coords format: "longitude,latitude"
 */
function parseGeocoderResponse(response) {
  const results = [];
  const lines = response.trim().split('\n');

  for (const line of lines) {
    // Parse CSV line (handle quoted fields)
    const fields = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    const cleanFields = fields.map(f => f.replace(/^"|"$/g, '').trim());

    const [id, inputAddr, matchStatus, matchType, matchedAddr, coords] = cleanFields;

    if (matchStatus === 'Match' && coords) {
      const [longitude, latitude] = coords.split(',').map(Number);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        results.push({ id, latitude, longitude, matchType });
      }
    }
  }

  return results;
}

/**
 * Update database with geocoded results
 */
async function updateDatabase(results) {
  let updated = 0;
  let errors = 0;

  for (const result of results) {
    try {
      await pool.query(
        `UPDATE snf_facilities
         SET latitude = $1, longitude = $2
         WHERE federal_provider_number = $3`,
        [result.latitude, result.longitude, result.id]
      );
      updated++;
    } catch (err) {
      console.error(`Error updating ${result.id}:`, err.message);
      errors++;
    }
  }

  return { updated, errors };
}

/**
 * Alternative: Use individual geocoding via Census API (slower but more reliable)
 */
async function geocodeIndividual(address, city, state, zip) {
  return new Promise((resolve, reject) => {
    const searchAddress = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${searchAddress}&benchmark=Public_AR_Current&format=json`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.result?.addressMatches?.length > 0) {
            const match = json.result.addressMatches[0];
            resolve({
              latitude: match.coordinates.y,
              longitude: match.coordinates.x
            });
          } else {
            resolve(null);
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Main function
 */
async function main() {
  console.log('=== SNF Facilities Geocoding Script ===\n');

  // Get facilities missing coordinates
  const { rows: facilities } = await pool.query(`
    SELECT federal_provider_number as id, address, city, state, zip_code
    FROM snf_facilities
    WHERE latitude IS NULL
      AND address IS NOT NULL
      AND address != ''
    ORDER BY federal_provider_number
  `);

  console.log(`Found ${facilities.length} facilities to geocode\n`);

  if (facilities.length === 0) {
    console.log('No facilities need geocoding!');
    await pool.end();
    return;
  }

  // Process in batches using individual geocoding (more reliable)
  const BATCH_SIZE = 100;
  let totalUpdated = 0;
  let totalMatched = 0;
  let totalProcessed = 0;

  for (let i = 0; i < facilities.length; i += BATCH_SIZE) {
    const batch = facilities.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(facilities.length / BATCH_SIZE);

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} facilities)...`);

    for (const facility of batch) {
      try {
        const result = await geocodeIndividual(
          facility.address,
          facility.city,
          facility.state,
          facility.zip_code
        );

        if (result) {
          await pool.query(
            `UPDATE snf_facilities
             SET latitude = $1, longitude = $2
             WHERE federal_provider_number = $3`,
            [result.latitude, result.longitude, facility.id]
          );
          totalMatched++;
          totalUpdated++;
        }
        totalProcessed++;

        // Rate limit: 1 request per second for Census API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`Error geocoding ${facility.id}:`, err.message);
        totalProcessed++;
      }
    }

    console.log(`  Batch ${batchNum} complete: ${totalMatched}/${totalProcessed} matched so far`);
  }

  console.log(`\n=== Geocoding Complete ===`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total matched: ${totalMatched}`);
  console.log(`Match rate: ${(100 * totalMatched / totalProcessed).toFixed(1)}%`);

  await pool.end();
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { geocodeIndividual, updateDatabase };
