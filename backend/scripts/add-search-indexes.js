/**
 * Add database indexes for faster facility search
 * - GIN trigram index for fast ILIKE text search
 * - B-tree indexes on commonly filtered columns
 */

const { Pool } = require('pg');

const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
const pool = new Pool({ connectionString });

async function addSearchIndexes() {
  const client = await pool.connect();

  try {
    console.log('Adding search indexes to snf_facilities...\n');

    // Enable pg_trgm extension for trigram indexes (fast ILIKE)
    console.log('1. Enabling pg_trgm extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('   ✓ pg_trgm extension enabled');

    // Add GIN trigram index on facility_name for fast text search
    console.log('2. Adding GIN trigram index on facility_name...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_facility_name_trgm
      ON snf_facilities
      USING gin (facility_name gin_trgm_ops)
    `);
    console.log('   ✓ Trigram index on facility_name created');

    // Add GIN trigram index on city for fast city search
    console.log('3. Adding GIN trigram index on city...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_city_trgm
      ON snf_facilities
      USING gin (city gin_trgm_ops)
    `);
    console.log('   ✓ Trigram index on city created');

    // Add B-tree index on state (exact match)
    console.log('4. Adding B-tree index on state...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_state
      ON snf_facilities (state)
    `);
    console.log('   ✓ Index on state created');

    // Add B-tree index on overall_rating
    console.log('5. Adding B-tree index on overall_rating...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_overall_rating
      ON snf_facilities (overall_rating)
    `);
    console.log('   ✓ Index on overall_rating created');

    // Add B-tree index on certified_beds
    console.log('6. Adding B-tree index on certified_beds...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_certified_beds
      ON snf_facilities (certified_beds)
    `);
    console.log('   ✓ Index on certified_beds created');

    // Add composite index for common search patterns (state + name)
    console.log('7. Adding composite index on state + facility_name...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snf_state_name
      ON snf_facilities (state, facility_name)
    `);
    console.log('   ✓ Composite index on state + facility_name created');

    // Analyze table to update statistics
    console.log('8. Analyzing table to update statistics...');
    await client.query('ANALYZE snf_facilities');
    console.log('   ✓ Table analyzed');

    console.log('\n✓ All search indexes added successfully!');

    // Show index info
    const [indexes] = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'snf_facilities'
      ORDER BY indexname
    `);
    console.log('\nCurrent indexes on snf_facilities:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

  } catch (error) {
    console.error('Error adding indexes:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

addSearchIndexes();
