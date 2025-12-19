/**
 * Runner script to add federal_provider_number column to deal_facilities
 * Run with: node run-ccn-migration.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/snfalyze',
  {
    dialect: 'postgres',
    logging: console.log,
  }
);

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected successfully.\n');

    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'deal_facilities'
      AND column_name = 'federal_provider_number'
    `);

    if (results.length > 0) {
      console.log('Column federal_provider_number already exists. Skipping.');
    } else {
      // Add the column
      console.log('Adding federal_provider_number column...');
      await sequelize.query(`
        ALTER TABLE deal_facilities
        ADD COLUMN federal_provider_number VARCHAR(10)
      `);
      console.log('Column added successfully.');
    }

    // Check if index exists
    const [indexResults] = await sequelize.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'deal_facilities'
      AND indexname = 'idx_deal_facilities_ccn'
    `);

    if (indexResults.length > 0) {
      console.log('Index idx_deal_facilities_ccn already exists. Skipping.');
    } else {
      // Add index
      console.log('Adding index on federal_provider_number...');
      await sequelize.query(`
        CREATE INDEX idx_deal_facilities_ccn
        ON deal_facilities(federal_provider_number)
        WHERE federal_provider_number IS NOT NULL
      `);
      console.log('Index added successfully.');
    }

    console.log('\nMigration complete!');
    console.log('The federal_provider_number column is now available in deal_facilities.');
    console.log('It will be populated when facilities are matched to CMS providers during deal creation.');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runMigration();
