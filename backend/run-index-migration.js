/**
 * Run facility search indexes migration immediately
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to PostgreSQL\n');

    const { runMigration } = require('./migrations/add-facility-search-indexes');
    await runMigration(sequelize);

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
