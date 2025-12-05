/**
 * Database Sync Script
 *
 * Syncs all Sequelize models with the database.
 * Uses alter: true to add new columns/tables without dropping existing data.
 *
 * Usage: npm run db:sync
 */

require('dotenv').config();

const db = require('../models');

console.log('Starting database sync...');
console.log('Database:', process.env.DATABASE_URL ? 'PostgreSQL (Production)' : 'SQLite (Local)');

db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced successfully');
    console.log('\nTables synced:');
    Object.keys(db).forEach(modelName => {
      if (modelName !== 'sequelize' && modelName !== 'Sequelize') {
        console.log(`  - ${modelName}`);
      }
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Database sync failed:', err);
    process.exit(1);
  });
