'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

// Database configuration - PostgreSQL for production, SQLite for local development
let sequelize;

if (process.env.DATABASE_URL) {
  // PostgreSQL: Use snfalyze schema with fallback to public
  const schema = process.env.PGSCHEMA || 'snfalyze';
  const isProduction = process.env.NODE_ENV === 'production';

  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    define: {
      schema: schema
    },
    dialectOptions: {
      ...(isProduction ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}),
      // Set search_path to use snfalyze schema first, then public for shared data
      options: `-c search_path=${schema},public`
    }
  });
} else {
  // Local development: Use SQLite
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'database.sqlite'),
    logging: false
  });
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Run migrations before sync (currently none needed)
const runMigrations = async () => {
  // Pre-sync migrations removed - deal tables no longer exist
};

const runPostSyncMigrations = async () => {
  try {
    // Add user approval workflow columns
    const { runMigration: runUserApprovalMigration } = require('../migrations/add-user-approval-columns');
    await runUserApprovalMigration(sequelize);
  } catch (err) {
    console.log('User approval columns migration error:', err.message);
  }

  try {
    // Add CMS staffing, turnover, and chain data columns
    const { runMigration: runCmsStaffingMigration } = require('../migrations/add-cms-staffing-columns');
    await runCmsStaffingMigration(sequelize);
  } catch (err) {
    console.log('CMS staffing columns migration error:', err.message);
  }

  try {
    // Create cms_state_benchmarks table for state/national averages
    const { runMigration: runStateBenchmarksMigration } = require('../migrations/create-cms-state-benchmarks');
    await runStateBenchmarksMigration(sequelize);
  } catch (err) {
    console.log('CMS state benchmarks migration error:', err.message);
  }

  try {
    // Create snf_vbp_performance table for Value-Based Purchasing data
    const { runMigration: runVbpMigration } = require('../migrations/create-snf-vbp-performance');
    await runVbpMigration(sequelize);
  } catch (err) {
    console.log('SNF VBP performance migration error:', err.message);
  }

  try {
    // Create cms_data_definitions table for tooltips/explanations
    const { runMigration: runDefinitionsMigration } = require('../migrations/create-cms-data-definitions');
    await runDefinitionsMigration(sequelize);
  } catch (err) {
    console.log('CMS data definitions migration error:', err.message);
  }

  try {
    // Add facility comments tables
    const { runMigration: runFacilityCommentsMigration } = require('../migrations/add-facility-comments-tables');
    await runFacilityCommentsMigration(sequelize);
  } catch (err) {
    console.log('Facility comments tables migration error:', err.message);
  }

  try {
    // Add market comments tables
    const { runMigration: runMarketCommentsMigration } = require('../migrations/add-market-comments-tables');
    await runMarketCommentsMigration(sequelize);
  } catch (err) {
    console.log('Market comments tables migration error:', err.message);
  }

  try {
    // Add user invitations table
    const { runMigration: runUserInvitationsMigration } = require('../migrations/add-user-invitations-table');
    await runUserInvitationsMigration(sequelize);
  } catch (err) {
    console.log('User invitations table migration error:', err.message);
  }
};

// Sync database - creates new tables if they don't exist
// Note: alter:true causes issues with SQLite due to backup tables and foreign keys
// Disabled alter:true for PostgreSQL since tables are already created via migration
const isPostgres = !!process.env.DATABASE_URL;
const syncOptions = {}; // No alter or force - tables already exist

runMigrations()
  .then(() => db.sequelize.sync(syncOptions))
  .then(() => {
    console.log('Database synced successfully');
    return runPostSyncMigrations();
  })
  .then(() => {
    console.log('Post-sync migrations completed');
  })
  .catch((err) => {
    console.error('Database sync error:', err);
  });

module.exports = db;
