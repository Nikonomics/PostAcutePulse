#!/usr/bin/env node
/**
 * Quick script to check deals in database
 * Usage: DATABASE_URL="your_connection_string" node scripts/check-deals.js
 */

const { Client } = require('pg');

async function checkDeals() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL not set');
    console.log('\nUsage:');
    console.log('  DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/check-deals.js');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check deals count
    const countResult = await client.query('SELECT COUNT(*) as count FROM deals');
    console.log(`Total deals: ${countResult.rows[0].count}`);

    // Check recent deals
    const dealsResult = await client.query(`
      SELECT id, deal_name, status, created_at, updated_at
      FROM deals
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (dealsResult.rows.length > 0) {
      console.log('\nRecent deals:');
      console.log('─'.repeat(80));
      dealsResult.rows.forEach(deal => {
        console.log(`  ID: ${deal.id} | ${deal.deal_name || 'Unnamed'} | Status: ${deal.status || 'N/A'} | Created: ${deal.created_at}`);
      });
    } else {
      console.log('\n⚠ No deals found in database');
    }

    // Check master_deals too
    const masterResult = await client.query('SELECT COUNT(*) as count FROM master_deals');
    console.log(`\nTotal master_deals: ${masterResult.rows[0].count}`);

    // Check users
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`Total users: ${usersResult.rows[0].count}`);

  } catch (err) {
    console.error('Database error:', err.message);
  } finally {
    await client.end();
  }
}

checkDeals();
