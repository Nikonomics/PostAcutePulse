/**
 * CMS Fire Safety Citations Collector
 *
 * Downloads fire safety deficiency data from CMS and populates fire_safety_citations table.
 * This data includes life safety code (LSC) violations from nursing home inspections.
 *
 * Data Source: CMS Fire Safety Deficiencies dataset
 * URL: https://data.cms.gov/provider-data/dataset/ifjz-ge4w
 * API: https://data.cms.gov/provider-data/api/1/datastore/query/ifjz-ge4w/0
 *
 * Usage:
 *   node cms-fire-safety-collector.js           # Import all fire safety data
 *   node cms-fire-safety-collector.js --count   # Just show record count
 *   node cms-fire-safety-collector.js --resume  # Resume from where we left off (don't truncate)
 */

const axios = require('axios');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CMS API endpoint for Fire Safety Deficiencies
const CMS_FIRE_SAFETY_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query/ifjz-ge4w/0';

// Parallel fetch settings
const PARALLEL_FETCHES = 3;
const BATCH_SIZE = 1000;

/**
 * Fetch fire safety data from CMS API
 */
async function fetchFireSafetyData(limit = 1000, offset = 0) {
  try {
    const response = await axios.post(CMS_FIRE_SAFETY_URL, {
      limit: limit,
      offset: offset
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 1 minute timeout per request
    });

    return {
      results: response.data.results || [],
      totalCount: response.data.count || 0,
      offset: offset
    };
  } catch (error) {
    console.error(`Error fetching at offset ${offset}:`, error.message);
    throw error;
  }
}

/**
 * Parse a CMS fire safety row into our database format
 */
function parseRow(row) {
  return {
    ccn: row.cms_certification_number_ccn,
    survey_date: row.survey_date ? new Date(row.survey_date).toISOString().split('T')[0] : null,
    survey_type: row.survey_type || 'Fire Safety',
    deficiency_prefix: row.deficiency_prefix,
    deficiency_category: row.deficiency_category,
    deficiency_tag: row.deficiency_tag_number,
    deficiency_description: row.deficiency_description,
    scope_severity_code: row.scope_severity_code,
    deficiency_corrected: row.deficiency_corrected?.includes('correction') || false,
    correction_date: row.correction_date ? new Date(row.correction_date).toISOString().split('T')[0] : null,
    inspection_cycle: row.inspection_cycle ? parseInt(row.inspection_cycle, 10) : null,
    is_standard_deficiency: row.standard_deficiency === 'Y',
    is_complaint_deficiency: row.complaint_deficiency === 'Y',
    cms_processing_date: row.processing_date ? new Date(row.processing_date).toISOString().split('T')[0] : null
  };
}

/**
 * Escape a value for SQL (handles nulls, strings, booleans, numbers)
 */
function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  // Escape single quotes by doubling them
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Insert a batch of records using bulk INSERT
 */
async function insertBatchBulk(records) {
  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  // Parse and filter valid records
  const validRows = [];
  for (const row of records) {
    const parsed = parseRow(row);
    if (!parsed.ccn || !parsed.survey_date) {
      errors++;
      continue;
    }
    validRows.push(parsed);
  }

  if (validRows.length === 0) {
    client.release();
    return { inserted: 0, errors };
  }

  try {
    // Build bulk INSERT statement
    const valueRows = validRows.map(p =>
      `(${escapeSqlValue(p.ccn)}, ${escapeSqlValue(p.survey_date)}, ${escapeSqlValue(p.survey_type)}, ` +
      `${escapeSqlValue(p.deficiency_prefix)}, ${escapeSqlValue(p.deficiency_category)}, ${escapeSqlValue(p.deficiency_tag)}, ` +
      `${escapeSqlValue(p.deficiency_description)}, ${escapeSqlValue(p.scope_severity_code)}, ` +
      `${escapeSqlValue(p.deficiency_corrected)}, ${escapeSqlValue(p.correction_date)}, ${escapeSqlValue(p.inspection_cycle)}, ` +
      `${escapeSqlValue(p.is_standard_deficiency)}, ${escapeSqlValue(p.is_complaint_deficiency)}, ` +
      `${escapeSqlValue(p.cms_processing_date)})`
    );

    const sql = `INSERT INTO fire_safety_citations (
      ccn, survey_date, survey_type,
      deficiency_prefix, deficiency_category, deficiency_tag,
      deficiency_description, scope_severity_code,
      deficiency_corrected, correction_date, inspection_cycle,
      is_standard_deficiency, is_complaint_deficiency,
      cms_processing_date
    ) VALUES ${valueRows.join(',\n')}`;

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    inserted = validRows.length;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk insert error:', error.message);
    throw error;
  } finally {
    client.release();
  }

  return { inserted, errors };
}

/**
 * Import fire safety citations - fetches in parallel and bulk inserts
 */
async function importFireSafetyCitations(resume = false) {
  console.log('CMS Fire Safety Citations Collector (OPTIMIZED)');
  console.log('='.repeat(60));
  console.log('Starting fire safety citations import...');
  console.log('Mode:', resume ? 'RESUME (keeping existing data)' : 'FULL REFRESH');
  console.log(`Parallel fetches: ${PARALLEL_FETCHES}, Batch size: ${BATCH_SIZE}`);
  console.log('='.repeat(60));

  // Get initial count from API
  const { totalCount } = await fetchFireSafetyData(1, 0);
  console.log(`\nTotal records available from CMS: ${totalCount.toLocaleString()}`);

  // Clear table if not resuming, or get current count to resume from
  let offset = 0;
  let totalImported = 0;

  if (!resume) {
    console.log('\nClearing existing fire safety citations...');
    const client = await pool.connect();
    try {
      await client.query('TRUNCATE fire_safety_citations RESTART IDENTITY');
    } finally {
      client.release();
    }
  } else {
    // Get current count to resume from
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT COUNT(*) as count FROM fire_safety_citations');
      const currentCount = parseInt(result.rows[0].count, 10);
      offset = currentCount;
      totalImported = currentCount;
      console.log(`\nResuming from offset ${offset} (${currentCount.toLocaleString()} records already imported)`);
    } finally {
      client.release();
    }
  }

  let totalErrors = 0;
  const startTime = Date.now();

  console.log(`\nFetching ${PARALLEL_FETCHES} batches in parallel, bulk inserting...`);
  console.log('Each batch is committed immediately (crash-safe).\n');

  while (offset < totalCount) {
    try {
      // Fetch multiple batches in parallel
      const fetchPromises = [];
      for (let i = 0; i < PARALLEL_FETCHES && (offset + i * BATCH_SIZE) < totalCount; i++) {
        const batchOffset = offset + i * BATCH_SIZE;
        fetchPromises.push(fetchFireSafetyData(BATCH_SIZE, batchOffset));
      }

      const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
      process.stdout.write(`Batches ${batchNum}-${batchNum + fetchPromises.length - 1}: Fetching ${fetchPromises.length} batches...`);

      const results = await Promise.all(fetchPromises);

      // Insert each batch (in order to maintain crash-safety)
      let batchInserted = 0;
      let batchErrors = 0;

      for (const result of results) {
        if (result.results.length === 0) continue;
        const { inserted, errors } = await insertBatchBulk(result.results);
        batchInserted += inserted;
        batchErrors += errors;
      }

      totalImported += batchInserted;
      totalErrors += batchErrors;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = Math.round(totalImported / (elapsed || 1) * 60);

      console.log(` +${batchInserted}, Total: ${totalImported.toLocaleString()}/${totalCount.toLocaleString()} (${Math.round(totalImported/totalCount*100)}%) [${rate}/min]`);

      offset += PARALLEL_FETCHES * BATCH_SIZE;

      // Small delay between parallel batches
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      console.error(`\n\nError at offset ${offset}: ${error.message}`);
      console.log(`\nPartial import saved: ${totalImported.toLocaleString()} records`);
      console.log('Run with --resume to continue from here.');
      throw error;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('Import completed!');
  console.log(`  Total imported: ${totalImported.toLocaleString()}`);
  console.log(`  Errors/skipped: ${totalErrors.toLocaleString()}`);
  console.log(`  Time: ${totalTime} minutes`);
  console.log('='.repeat(60));

  return { success: true, count: totalImported };
}

/**
 * Get summary statistics
 */
async function getSummary() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        COUNT(*) as total_citations,
        COUNT(DISTINCT ccn) as facilities_with_citations,
        MIN(survey_date) as earliest_survey,
        MAX(survey_date) as latest_survey,
        COUNT(DISTINCT deficiency_tag) as unique_tags,
        SUM(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 ELSE 0 END) as immediate_jeopardy_count
      FROM fire_safety_citations
    `);

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get citations by category
 */
async function getCitationsByCategory() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        deficiency_category,
        COUNT(*) as citation_count,
        COUNT(DISTINCT ccn) as facilities_affected
      FROM fire_safety_citations
      WHERE deficiency_category IS NOT NULL
      GROUP BY deficiency_category
      ORDER BY citation_count DESC
      LIMIT 20
    `);

    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--count')) {
      const { totalCount } = await fetchFireSafetyData(1, 0);
      console.log(`Total records available from CMS: ${totalCount.toLocaleString()}`);

      const summary = await getSummary();
      console.log('\nCurrent database stats:');
      console.table(summary);
      return;
    }

    if (args.includes('--summary')) {
      const summary = await getSummary();
      console.log('\nFire Safety Citations Summary:');
      console.table(summary);

      const byCategory = await getCitationsByCategory();
      console.log('\nCitations by Category:');
      console.table(byCategory);
      return;
    }

    // Import with optional resume mode
    const resume = args.includes('--resume');
    await importFireSafetyCitations(resume);

    // Show summary after import
    const summary = await getSummary();
    console.log('\nPost-import Summary:');
    console.table(summary);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export for use as module
module.exports = {
  importFireSafetyCitations,
  getSummary,
  getCitationsByCategory
};

// Run if called directly
if (require.main === module) {
  main();
}
