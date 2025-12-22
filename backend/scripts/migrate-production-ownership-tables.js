/**
 * Migration script to add missing ownership-related tables to production
 *
 * These tables belong in the MARKET database (snf_market_data), NOT the app database.
 * They extend ownership_profiles which is CMS/market data.
 *
 * Run with: MARKET_DATABASE_URL="your_market_db_url" node scripts/migrate-production-ownership-tables.js
 */

const { Pool } = require('pg');

const connectionString = process.env.MARKET_DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: MARKET_DATABASE_URL environment variable is required');
  console.error('   This migration adds tables to the market database (snf_market_data)');
  console.error('   Usage: MARKET_DATABASE_URL="postgresql://..." node scripts/migrate-production-ownership-tables.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('Starting ownership tables migration...\n');

    // 1. Create ownership_contacts table
    console.log('1. Creating ownership_contacts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ownership_contacts (
        id SERIAL PRIMARY KEY,
        ownership_profile_id INTEGER NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        title VARCHAR(150),
        email VARCHAR(255),
        phone VARCHAR(20),
        mobile VARCHAR(20),
        linkedin_url VARCHAR(500),
        contact_type VARCHAR(50) DEFAULT 'other',
        is_primary BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_by INTEGER,
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_ownership_contact_profile
          FOREIGN KEY (ownership_profile_id)
          REFERENCES ownership_profiles(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ownership_contacts_profile ON ownership_contacts(ownership_profile_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_contacts_type ON ownership_contacts(contact_type);
    `);
    console.log('   ✓ ownership_contacts created\n');

    // 2. Create ownership_comments table
    // NOTE: user_id references users table in APP database - no FK constraint (cross-database)
    console.log('2. Creating ownership_comments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ownership_comments (
        id SERIAL PRIMARY KEY,
        ownership_profile_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        parent_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_ownership_comment_profile
          FOREIGN KEY (ownership_profile_id)
          REFERENCES ownership_profiles(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ownership_comments_profile ON ownership_comments(ownership_profile_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_comments_user ON ownership_comments(user_id);
    `);
    console.log('   ✓ ownership_comments created\n');

    // 3. Create ownership_comment_mentions table
    // NOTE: mentioned_user_id references users table in APP database - no FK constraint
    console.log('3. Creating ownership_comment_mentions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ownership_comment_mentions (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL,
        mentioned_user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_ownership_mention_comment
          FOREIGN KEY (comment_id)
          REFERENCES ownership_comments(id)
          ON DELETE CASCADE,
        CONSTRAINT unique_ownership_comment_mention
          UNIQUE (comment_id, mentioned_user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ownership_mentions_comment ON ownership_comment_mentions(comment_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_mentions_user ON ownership_comment_mentions(mentioned_user_id);
    `);
    console.log('   ✓ ownership_comment_mentions created\n');

    // 4. Create ownership_change_logs table
    console.log('4. Creating ownership_change_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ownership_change_logs (
        id SERIAL PRIMARY KEY,
        ownership_profile_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_ownership_log_profile
          FOREIGN KEY (ownership_profile_id)
          REFERENCES ownership_profiles(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ownership_logs_profile ON ownership_change_logs(ownership_profile_id);
      CREATE INDEX IF NOT EXISTS idx_ownership_logs_type ON ownership_change_logs(change_type);
      CREATE INDEX IF NOT EXISTS idx_ownership_logs_date ON ownership_change_logs(created_at DESC);
    `);
    console.log('   ✓ ownership_change_logs created\n');

    // 5. Create facility_vbp_rankings table (also missing)
    console.log('5. Creating facility_vbp_rankings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS facility_vbp_rankings (
        id SERIAL PRIMARY KEY,
        federal_provider_number VARCHAR(20) NOT NULL,
        fiscal_year INTEGER NOT NULL,
        national_rank INTEGER,
        national_total INTEGER,
        national_percentile DECIMAL(5,2),
        state_rank INTEGER,
        state_total INTEGER,
        state_percentile DECIMAL(5,2),
        market_rank INTEGER,
        market_total INTEGER,
        market_percentile DECIMAL(5,2),
        chain_rank INTEGER,
        chain_total INTEGER,
        chain_percentile DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_vbp_ranking UNIQUE (federal_provider_number, fiscal_year)
      );

      CREATE INDEX IF NOT EXISTS idx_vbp_rankings_ccn ON facility_vbp_rankings(federal_provider_number);
      CREATE INDEX IF NOT EXISTS idx_vbp_rankings_year ON facility_vbp_rankings(fiscal_year);
    `);
    console.log('   ✓ facility_vbp_rankings created\n');

    console.log('✅ All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(console.error);
