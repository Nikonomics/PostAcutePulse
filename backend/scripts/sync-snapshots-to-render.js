#!/usr/bin/env node
/**
 * Sync facility_snapshots from local PostgreSQL to Render
 * Also syncs cms_extracts to satisfy foreign key constraint
 */

const { Client } = require('pg');

const LOCAL_URL = 'postgresql://localhost:5432/snf_platform';
const RENDER_URL = process.env.DATABASE_URL || 'postgresql://snfalyze_db_user:f0j8PFEmXBepKJXS2lwf7JXTte5mBWQs@dpg-d4oaisc9c44c73fb1um0-a.oregon-postgres.render.com/snfalyze_db?sslmode=require';

const BATCH_SIZE = 100; // Keep low due to 85 columns * 100 rows = 8500 params

async function main() {
  const localClient = new Client({ connectionString: LOCAL_URL });
  const renderClient = new Client({ connectionString: RENDER_URL });

  try {
    await localClient.connect();
    await renderClient.connect();
    console.log('Connected to both databases');

    // Step 1: Drop FK constraint temporarily
    console.log('\n=== Step 1: Drop FK constraint ===');
    try {
      await renderClient.query('ALTER TABLE facility_snapshots DROP CONSTRAINT IF EXISTS facility_snapshots_extract_id_fkey');
      console.log('✓ FK constraint dropped');
    } catch (err) {
      console.log('FK constraint may not exist, continuing...');
    }

    // Step 2: Sync cms_extracts
    console.log('\n=== Step 2: Sync cms_extracts ===');
    const localExtracts = await localClient.query('SELECT * FROM cms_extracts ORDER BY extract_id');
    const renderExtracts = await renderClient.query('SELECT extract_id FROM cms_extracts');
    const renderExtractIds = new Set(renderExtracts.rows.map(r => r.extract_id));

    console.log(`Local extracts: ${localExtracts.rows.length}`);
    console.log(`Render extracts: ${renderExtractIds.size}`);

    let extractsInserted = 0;
    for (const extract of localExtracts.rows) {
      if (!renderExtractIds.has(extract.extract_id)) {
        await renderClient.query(`
          INSERT INTO cms_extracts (extract_id, extract_date, processing_date, notes)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (extract_id) DO NOTHING
        `, [extract.extract_id, extract.extract_date, extract.processing_date, extract.notes]);
        extractsInserted++;
      }
    }
    console.log(`✓ Inserted ${extractsInserted} new extracts`);

    // Reset sequence
    const maxExtractId = await renderClient.query('SELECT MAX(extract_id) as max_id FROM cms_extracts');
    if (maxExtractId.rows[0].max_id) {
      await renderClient.query(`SELECT setval('cms_extracts_extract_id_seq', $1)`, [maxExtractId.rows[0].max_id]);
    }

    // Step 3: Sync facility_snapshots
    console.log('\n=== Step 3: Sync facility_snapshots ===');

    // Get dates from both
    const localDates = await localClient.query(`
      SELECT DISTINCT cms_processing_date
      FROM facility_snapshots
      WHERE cms_processing_date IS NOT NULL
      ORDER BY cms_processing_date
    `);

    const renderDates = await renderClient.query(`
      SELECT DISTINCT cms_processing_date
      FROM facility_snapshots
      WHERE cms_processing_date IS NOT NULL
      ORDER BY cms_processing_date
    `);

    const localDateSet = new Set(localDates.rows.map(r => r.cms_processing_date.toISOString().split('T')[0]));
    const renderDateSet = new Set(renderDates.rows.map(r => r.cms_processing_date.toISOString().split('T')[0]));

    console.log(`Local has ${localDateSet.size} dates`);
    console.log(`Render has ${renderDateSet.size} dates`);

    // Find missing dates
    const missingDates = [...localDateSet].filter(d => !renderDateSet.has(d)).sort();
    console.log(`Missing on Render: ${missingDates.length} dates`);

    if (missingDates.length === 0) {
      console.log('All dates already synced!');
    } else {
      // Get column names (excluding snapshot_id which is auto-generated)
      const columnsResult = await localClient.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'facility_snapshots'
        AND column_name != 'snapshot_id'
        ORDER BY ordinal_position
      `);
      const columns = columnsResult.rows.map(r => r.column_name);
      console.log(`Syncing columns: ${columns.length}`);

      let totalInserted = 0;
      // Process each missing date
      for (const dateStr of missingDates) {
        process.stdout.write(`Syncing ${dateStr} ... `);

        // Get all records for this date
        const records = await localClient.query(`
          SELECT ${columns.join(', ')}
          FROM facility_snapshots
          WHERE cms_processing_date = $1
        `, [dateStr]);

        if (records.rows.length === 0) {
          console.log('0 records');
          continue;
        }

        // Insert in batches
        let inserted = 0;
        for (let i = 0; i < records.rows.length; i += BATCH_SIZE) {
          const batch = records.rows.slice(i, i + BATCH_SIZE);

          // Build multi-row INSERT
          const placeholders = [];
          const values = [];
          let paramIndex = 1;

          for (const row of batch) {
            const rowPlaceholders = [];
            for (const col of columns) {
              rowPlaceholders.push(`$${paramIndex++}`);
              values.push(row[col]);
            }
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
          }

          const insertQuery = `
            INSERT INTO facility_snapshots (${columns.join(', ')})
            VALUES ${placeholders.join(', ')}
          `;

          await renderClient.query(insertQuery, values);
          inserted += batch.length;
          totalInserted += batch.length;
        }

        console.log(`${inserted} records`);
      }
      console.log(`\n✓ Total records inserted: ${totalInserted}`);
    }

    // Step 4: Re-add FK constraint
    console.log('\n=== Step 4: Re-add FK constraint ===');
    try {
      await renderClient.query(`
        ALTER TABLE facility_snapshots
        ADD CONSTRAINT facility_snapshots_extract_id_fkey
        FOREIGN KEY (extract_id) REFERENCES cms_extracts(extract_id)
      `);
      console.log('✓ FK constraint restored');
    } catch (err) {
      console.log('Warning: Could not restore FK constraint:', err.message);
    }

    // Final count
    const finalCount = await renderClient.query('SELECT COUNT(*) as total FROM facility_snapshots');
    const finalDates = await renderClient.query('SELECT COUNT(DISTINCT cms_processing_date) as dates FROM facility_snapshots WHERE cms_processing_date IS NOT NULL');
    console.log(`\n✓✓✓ Sync complete!`);
    console.log(`   Render now has ${finalCount.rows[0].total} records across ${finalDates.rows[0].dates} dates`);

  } catch (err) {
    console.error('\nError:', err.message);
    throw err;
  } finally {
    await localClient.end();
    await renderClient.end();
  }
}

main().catch(console.error);
