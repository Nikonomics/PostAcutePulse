/**
 * Batch Geocode SNF Facilities using Census Bureau Batch Geocoder
 *
 * This script uses the Census Bureau's batch geocoding service which can
 * process up to 10,000 addresses at once.
 *
 * Usage: node scripts/geocodeSNFBatch.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const https = require('https');
const FormData = require('form-data');

// Database connection
const getPool = () => {
  const connectionString = process.env.MARKET_DATABASE_URL ||
                          process.env.DATABASE_URL ||
                          'postgresql://localhost:5432/snf_platform';
  return new Pool({ connectionString });
};

/**
 * Submit batch to Census geocoder
 */
async function submitBatch(csvFilePath) {
  return new Promise((resolve, reject) => {
    const form = new FormData();

    form.append('addressFile', fs.createReadStream(csvFilePath));
    form.append('benchmark', 'Public_AR_Current');
    form.append('vintage', 'Current_Current');

    const options = {
      method: 'POST',
      hostname: 'geocoding.geo.census.gov',
      path: '/geocoder/locations/addressbatch',
      headers: form.getHeaders(),
      timeout: 300000 // 5 minute timeout
    };

    console.log('Submitting to Census Bureau batch geocoder...');

    const req = https.request(options, (res) => {
      let data = '';
      let received = 0;

      res.on('data', chunk => {
        data += chunk;
        received += chunk.length;
        process.stdout.write(`\rReceived ${(received / 1024).toFixed(0)} KB...`);
      });

      res.on('end', () => {
        console.log('\nResponse received!');
        resolve(data);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    form.pipe(req);
  });
}

/**
 * Parse Census geocoder response
 * Response format: "id","input_address","match_status","match_type","matched_address","coords","tiger_line_id","side"
 */
function parseGeocoderResponse(response) {
  const results = [];
  const lines = response.trim().split('\n');

  let matched = 0;
  let noMatch = 0;
  let tie = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse CSV - handle quoted fields properly
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim()); // Last field

    const [id, inputAddr, matchStatus, matchType, matchedAddr, coords] = fields;

    if (matchStatus === 'Match' && coords) {
      const coordParts = coords.split(',');
      if (coordParts.length === 2) {
        const longitude = parseFloat(coordParts[0]);
        const latitude = parseFloat(coordParts[1]);

        if (!isNaN(latitude) && !isNaN(longitude)) {
          results.push({ id, latitude, longitude, matchType });
          matched++;
        }
      }
    } else if (matchStatus === 'No_Match') {
      noMatch++;
    } else if (matchStatus === 'Tie') {
      tie++;
    }
  }

  console.log(`\nParsing results:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  No Match: ${noMatch}`);
  console.log(`  Tie: ${tie}`);

  return results;
}

/**
 * Update database with geocoded results
 */
async function updateDatabase(pool, results) {
  console.log(`\nUpdating database with ${results.length} results...`);

  let updated = 0;
  let errors = 0;

  // Use a transaction for better performance
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const result of results) {
      try {
        const res = await client.query(
          `UPDATE snf_facilities
           SET latitude = $1, longitude = $2
           WHERE federal_provider_number = $3
           AND latitude IS NULL`,
          [result.latitude, result.longitude, result.id]
        );
        if (res.rowCount > 0) updated++;
      } catch (err) {
        errors++;
      }

      if ((updated + errors) % 1000 === 0) {
        process.stdout.write(`\rUpdated ${updated} records...`);
      }
    }

    await client.query('COMMIT');
    console.log(`\nDatabase update complete: ${updated} updated, ${errors} errors`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { updated, errors };
}

/**
 * Main function
 */
async function main() {
  console.log('=== SNF Facilities Batch Geocoding ===\n');

  const pool = getPool();

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

  // Census batch geocoder accepts max 10,000 at a time
  const BATCH_SIZE = 10000;
  let totalUpdated = 0;

  for (let i = 0; i < facilities.length; i += BATCH_SIZE) {
    const batch = facilities.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(facilities.length / BATCH_SIZE);

    console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} addresses) ---`);

    // Create CSV file for this batch (no header, specific format)
    const csvContent = batch.map(f =>
      `"${f.id}","${(f.address || '').replace(/"/g, '')}","${f.city}","${f.state}","${f.zip_code}"`
    ).join('\n');

    const csvFile = `/tmp/snf_geocode_batch_${batchNum}.csv`;
    fs.writeFileSync(csvFile, csvContent);
    console.log(`Created CSV: ${csvFile} (${batch.length} rows)`);

    // Submit to Census geocoder
    const response = await submitBatch(csvFile);

    // Save raw response for debugging
    fs.writeFileSync(`/tmp/snf_geocode_response_${batchNum}.csv`, response);

    // Parse results
    const results = parseGeocoderResponse(response);

    // Update database
    const { updated } = await updateDatabase(pool, results);
    totalUpdated += updated;

    // Clean up
    fs.unlinkSync(csvFile);
  }

  // Final stats
  const { rows: [stats] } = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE latitude IS NOT NULL) as geocoded,
      COUNT(*) FILTER (WHERE latitude IS NULL) as missing
    FROM snf_facilities
  `);

  console.log(`\n=== Final Results ===`);
  console.log(`Total facilities: ${stats.total}`);
  console.log(`Geocoded: ${stats.geocoded} (${(100 * stats.geocoded / stats.total).toFixed(1)}%)`);
  console.log(`Still missing: ${stats.missing}`);

  await pool.end();
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
