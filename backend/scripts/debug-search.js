#!/usr/bin/env node
/**
 * Debug script to test MarketController search logic
 *
 * Usage: node scripts/debug-search.js
 *
 * This script simulates the exact query logic from MarketController.searchFacilities
 * to help diagnose why searches return 0 results.
 */

const { Pool } = require('pg');

// Use the EXACT same connection logic as config/database.js
const connectionString = process.env.MARKET_DATABASE_URL ||
                        process.env.DATABASE_URL ||
                        'postgresql://localhost:5432/snf_platform';

const isProduction = connectionString.includes('render.com');

console.log('='.repeat(60));
console.log('DEBUG SEARCH SCRIPT');
console.log('='.repeat(60));
console.log('');
console.log('Connection Info:');
console.log('  MARKET_DATABASE_URL set:', !!process.env.MARKET_DATABASE_URL);
console.log('  DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('  Using connection:', connectionString.substring(0, 50) + '...');
console.log('  SSL enabled:', isProduction);
console.log('');

const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function runDebug() {
  const searchTerm = 'Amed';
  const searchPattern = `%${searchTerm}%`;
  const halfLimit = 10;

  try {
    // Step 1: Check if hh_provider_snapshots table exists
    console.log('Step 1: Checking if hh_provider_snapshots table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'hh_provider_snapshots'
      );
    `);
    console.log('  Table exists:', tableCheck.rows[0].exists);
    console.log('');

    if (!tableCheck.rows[0].exists) {
      console.log('❌ PROBLEM FOUND: hh_provider_snapshots table does NOT exist in this database!');
      console.log('   This means the pool is connecting to the wrong database.');
      console.log('');

      // Show what tables DO exist
      const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name LIMIT 20;
      `);
      console.log('   Tables that DO exist in this database:');
      tables.rows.forEach(row => console.log('     -', row.table_name));

      await pool.end();
      return;
    }

    // Step 2: Count total records
    console.log('Step 2: Counting total HHA records...');
    const countResult = await pool.query('SELECT COUNT(*) FROM hh_provider_snapshots');
    console.log('  Total records:', countResult.rows[0].count);
    console.log('');

    // Step 3: Run the EXACT query from MarketController.searchFacilities
    console.log(`Step 3: Running search for "${searchTerm}"...`);
    console.log('  Query pattern:', searchPattern);
    console.log('');

    const hhaResult = await pool.query(`
      SELECT DISTINCT ON (ccn)
        ccn,
        provider_name as name,
        city,
        state,
        quality_star_rating as overall_rating,
        NULL as certified_beds,
        'HHA' as type
      FROM hh_provider_snapshots
      WHERE
        provider_name ILIKE $1
        OR city ILIKE $1
        OR ccn ILIKE $1
      ORDER BY ccn, extract_id DESC
      LIMIT $2
    `, [searchPattern, halfLimit]);

    console.log('  Results found:', hhaResult.rows.length);
    console.log('');

    if (hhaResult.rows.length > 0) {
      console.log('  First result:');
      console.log('    CCN:', hhaResult.rows[0].ccn);
      console.log('    Name:', hhaResult.rows[0].name);
      console.log('    City:', hhaResult.rows[0].city);
      console.log('    State:', hhaResult.rows[0].state);
      console.log('    Rating:', hhaResult.rows[0].overall_rating);
    } else {
      console.log('❌ PROBLEM: No results found!');

      // Try a simple query without DISTINCT ON
      console.log('');
      console.log('Step 4: Trying simpler query without DISTINCT ON...');
      const simpleResult = await pool.query(`
        SELECT provider_name, ccn, city, state
        FROM hh_provider_snapshots
        WHERE provider_name ILIKE $1
        LIMIT 5
      `, [searchPattern]);

      console.log('  Simple query results:', simpleResult.rows.length);
      if (simpleResult.rows.length > 0) {
        console.log('  First match:', simpleResult.rows[0].provider_name);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('DEBUG COMPLETE');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error('');
    console.error('Full error:', err);
  } finally {
    await pool.end();
  }
}

runDebug();
