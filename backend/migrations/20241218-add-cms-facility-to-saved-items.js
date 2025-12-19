/**
 * Migration: Add CCN and facility_name columns to user_saved_items
 *
 * Enables saving CMS facilities (SNFs) by CCN directly from facility profile pages.
 */

const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';

async function up() {
  const sequelize = new Sequelize(connectionString, {
    logging: false,
    dialectOptions: connectionString.includes('render.com') ? { ssl: { rejectUnauthorized: false } } : {}
  });

  try {
    console.log('Adding ccn and facility_name columns to user_saved_items...');

    // Add ccn column
    await sequelize.query(`
      ALTER TABLE user_saved_items
      ADD COLUMN IF NOT EXISTS ccn VARCHAR(10);
    `);

    // Add facility_name column for display
    await sequelize.query(`
      ALTER TABLE user_saved_items
      ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255);
    `);

    // Add unique index for cms_facility items
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_items_user_ccn_unique
      ON user_saved_items (user_id, ccn)
      WHERE ccn IS NOT NULL;
    `);

    console.log('Migration complete: ccn and facility_name columns added');

  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function down() {
  const sequelize = new Sequelize(connectionString, {
    logging: false,
    dialectOptions: connectionString.includes('render.com') ? { ssl: { rejectUnauthorized: false } } : {}
  });

  try {
    console.log('Removing ccn and facility_name columns...');
    await sequelize.query('DROP INDEX IF EXISTS idx_saved_items_user_ccn_unique;');
    await sequelize.query('ALTER TABLE user_saved_items DROP COLUMN IF EXISTS ccn;');
    await sequelize.query('ALTER TABLE user_saved_items DROP COLUMN IF EXISTS facility_name;');
    console.log('Rollback complete');
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'down') {
    down().catch(console.error);
  } else {
    up().catch(console.error);
  }
}

module.exports = { up, down };
