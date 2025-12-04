'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

// Database configuration - PostgreSQL for production, SQLite for local development
let sequelize;

if (process.env.DATABASE_URL) {
  // Production: Use PostgreSQL via DATABASE_URL
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
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

// Run migrations before sync
const runMigrations = async () => {
  try {
    // Run no_of_beds type migration for PostgreSQL
    const { runMigration } = require('../migrations/fix-no-of-beds-type');
    await runMigration(sequelize);
  } catch (err) {
    console.log('Migration file not found or error:', err.message);
  }
};

// Sync database - creates new tables if they don't exist
// Note: alter:true will modify existing tables to match models
runMigrations()
  .then(() => db.sequelize.sync({ alter: true, force: false }))
  .then(() => {
    console.log('Database synced successfully');
  })
  .catch((err) => {
    console.error('Database sync error:', err);
  });

module.exports = db;
