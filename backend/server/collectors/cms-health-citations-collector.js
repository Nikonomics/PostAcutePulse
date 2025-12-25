/**
 * CMS Health Citations Collector
 *
 * Downloads health deficiency data from CMS and populates health_citations table.
 * This data includes health inspection violations from nursing home surveys.
 *
 * Data Source: CMS Health Deficiencies dataset
 * URL: https://data.cms.gov/provider-data/dataset/r5ix-sfxw
 * API: https://data.cms.gov/provider-data/api/1/datastore/query/r5ix-sfxw/0
 *
 * Usage:
 *   node cms-health-citations-collector.js           # Import all health citations
 *   node cms-health-citations-collector.js --count   # Just show record count
 */

const axios = require('axios');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CMS API endpoint for Health Deficiencies
const CMS_HEALTH_DEFICIENCIES_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query/r5ix-sfxw/0';

/**
 * Fetch health deficiency data from CMS API
 */
async function fetchHealthDeficiencyData(limit = 1000, offset = 0) {
  console.log(`Fetching health deficiency data (offset: ${offset}, limit: ${limit})...`);

  try {
    const response = await axios.post(CMS_HEALTH_DEFICIENCIES_URL, {
      limit: limit,
      offset: offset
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minute timeout
    });

    return {
      results: response.data.results || [],
      totalCount: response.data.count || 0
    };
  } catch (error) {
    console.error('Error fetching CMS health deficiency data:', error.message);
    throw error;
  }
}

/**
 * Parse a CMS health deficiency row into our database format
 */
function parseRow(row) {
  return {
    ccn: row.cms_certification_number_ccn,
    survey_date: row.survey_date ? new Date(row.survey_date).toISOString().split('T')[0] : null,
    survey_type: row.survey_type || 'Health',
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
    is_infection_control: row.infection_control_inspection_deficiency === 'Y',
    is_under_idr: row.citation_under_idr === 'Y',
    cms_processing_date: row.processing_date ? new Date(row.processing_date).toISOString().split('T')[0] : null
  };
}

/**
 * Get or create extract record for tracking imports
 */
async function getOrCreateExtract(extractDate) {
  const client = await pool.connect();
  try {
    // Check if extract exists
    const existing = await client.query(
      "SELECT extract_id, import_status FROM cms_extracts WHERE extract_date = $1 AND source_file = 'health_citations'",
      [extractDate]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new extract record
    const result = await client.query(
      `INSERT INTO cms_extracts (extract_date, source_file, import_status)
       VALUES ($1, 'health_citations', 'pending')
       RETURNING extract_id, import_status`,
      [extractDate]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Import health citations into the database
 */
async function importHealthCitations() {
  const client = await pool.connect();

  try {
    console.log('Starting health citations import...');
    console.log('='.repeat(60));

    // Fetch all data
    let allData = [];
    let offset = 0;
    const limit = 1000; // CMS API max is ~1000
    let totalCount = 0;

    while (true) {
      const { results, totalCount: count } = await fetchHealthDeficiencyData(limit, offset);
      totalCount = count;

      if (results.length === 0) break;

      allData = allData.concat(results);
      console.log(`Fetched ${allData.length} / ${totalCount} records...`);

      if (results.length < limit) break;
      offset += limit;
    }

    if (allData.length === 0) {
      console.log('No health deficiency data fetched from CMS API');
      return { success: false, count: 0 };
    }

    console.log(`\nTotal records to import: ${allData.length}`);

    // Determine extract date from processing date
    const firstRow = allData[0];
    const extractDate = firstRow.processing_date
      ? new Date(firstRow.processing_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    console.log(`Extract date: ${extractDate}`);

    // Clear existing health citations and re-import
    // This ensures we have the latest 3-year window of data
    console.log('\nClearing existing health citations...');
    await client.query('TRUNCATE health_citations RESTART IDENTITY');

    // Import in batches
    console.log('Importing health citations...');
    await client.query('BEGIN');

    let importedCount = 0;
    let errorCount = 0;

    for (const row of allData) {
      try {
        const parsed = parseRow(row);

        if (!parsed.ccn || !parsed.survey_date) {
          errorCount++;
          continue;
        }

        await client.query(
          `INSERT INTO health_citations (
            ccn, survey_date, survey_type,
            deficiency_prefix, deficiency_category, deficiency_tag,
            deficiency_description, scope_severity_code,
            deficiency_corrected, correction_date, inspection_cycle,
            is_standard_deficiency, is_complaint_deficiency,
            is_infection_control, is_under_idr,
            cms_processing_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            parsed.ccn,
            parsed.survey_date,
            parsed.survey_type,
            parsed.deficiency_prefix,
            parsed.deficiency_category,
            parsed.deficiency_tag,
            parsed.deficiency_description,
            parsed.scope_severity_code,
            parsed.deficiency_corrected,
            parsed.correction_date,
            parsed.inspection_cycle,
            parsed.is_standard_deficiency,
            parsed.is_complaint_deficiency,
            parsed.is_infection_control,
            parsed.is_under_idr,
            parsed.cms_processing_date
          ]
        );

        importedCount++;

        if (importedCount % 10000 === 0) {
          console.log(`  Imported ${importedCount} citations...`);
        }
      } catch (err) {
        errorCount++;
        if (errorCount <= 5) {
          console.error(`  Error importing row: ${err.message}`);
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log(`Import completed!`);
    console.log(`  Total imported: ${importedCount}`);
    console.log(`  Errors/skipped: ${errorCount}`);

    return { success: true, count: importedCount };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
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
        SUM(CASE WHEN scope_severity_code IN ('J', 'K', 'L') THEN 1 ELSE 0 END) as immediate_jeopardy_count,
        SUM(CASE WHEN is_infection_control = true THEN 1 ELSE 0 END) as infection_control_count
      FROM health_citations
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
      FROM health_citations
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

  console.log('CMS Health Citations Collector');
  console.log('='.repeat(60));

  try {
    if (args.includes('--count')) {
      // Just check record count from API
      const { totalCount } = await fetchHealthDeficiencyData(1, 0);
      console.log(`Total records available: ${totalCount}`);

      const summary = await getSummary();
      console.log('\nCurrent database stats:');
      console.table(summary);
      return;
    }

    if (args.includes('--summary')) {
      const summary = await getSummary();
      console.log('\nHealth Citations Summary:');
      console.table(summary);

      const byCategory = await getCitationsByCategory();
      console.log('\nCitations by Category:');
      console.table(byCategory);
      return;
    }

    // Default: import all data
    await importHealthCitations();

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
  importHealthCitations,
  getSummary,
  getCitationsByCategory
};

// Run if called directly
if (require.main === module) {
  main();
}
