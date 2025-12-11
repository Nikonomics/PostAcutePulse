/**
 * Database Configuration
 *
 * Centralizes database configuration for both local and production environments.
 *
 * Production: Uses PostgreSQL via DATABASE_URL for all data
 * Local: Uses SQLite at ./database.sqlite for all data
 *
 * NOTE: ALF facilities table can be stored in either database. The import script
 * and facility matcher will automatically use the correct database.
 */

const path = require('path');
const { Sequelize } = require('sequelize');

/**
 * Get SQLite database path
 * Used for local development only
 */
const getSQLitePath = () => {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  // Check if persistent disk exists (Render deployment)
  const persistentDiskPath = '/var/data/uploads/database.sqlite';
  const fs = require('fs');

  try {
    if (fs.existsSync('/var/data/uploads')) {
      console.log('[Database Config] Using persistent disk for SQLite:', persistentDiskPath);
      return persistentDiskPath;
    }
  } catch (err) {
    // Fall through to local path
  }

  // Default: Local development path
  const localPath = path.join(__dirname, '..', 'database.sqlite');
  return localPath;
};

/**
 * Get database connection string
 * Returns either PostgreSQL URL or SQLite path
 */
const getConnectionString = () => {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL
    };
  }

  return {
    type: 'sqlite',
    path: getSQLitePath()
  };
};

/**
 * Create Sequelize instance for ALF facilities
 * Uses the same database as the main app (PostgreSQL in production, SQLite locally)
 */
const getSequelizeInstance = () => {
  const config = getConnectionString();
  console.log('[getSequelizeInstance] Database type:', config.type);

  if (config.type === 'postgres') {
    console.log('[getSequelizeInstance] Creating PostgreSQL connection');
    const isProduction = process.env.NODE_ENV === 'production';

    return new Sequelize(config.url, {
      dialect: 'postgres',
      protocol: 'postgres',
      logging: false,
      dialectOptions: {
        ...(isProduction ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        } : {})
      }
    });
  } else {
    console.log('[getSequelizeInstance] Creating SQLite connection:', config.path);
    return new Sequelize({
      dialect: 'sqlite',
      storage: config.path,
      logging: false
    });
  }
};

// Legacy export for backwards compatibility with SQLite-only code
const DB_PATH = getSQLitePath();

module.exports = {
  DB_PATH,
  getSQLitePath,
  getConnectionString,
  getSequelizeInstance
};
