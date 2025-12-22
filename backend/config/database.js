/**
 * Database Configuration
 *
 * SNFalyze uses TWO separate databases in production:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ DATABASE_URL (snfalyze_db) - Application Database                          │
 * │ ─────────────────────────────────────────────────────────────────────────── │
 * │ Purpose: User-generated and application-specific data                      │
 * │ Tables:  users, deals, deal_facilities, documents, saved_items,            │
 * │          notifications, extraction_history, benchmarks, pro_forma,         │
 * │          ownership_comments, ownership_change_logs (user-linked data)      │
 * │ Access:  getSequelizeInstance() or getMainPool() for raw SQL               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ MARKET_DATABASE_URL (snf_market_data) - Market/CMS Database                │
 * │ ─────────────────────────────────────────────────────────────────────────── │
 * │ Purpose: CMS data, facility info, ownership data, M&A transactions         │
 * │ Tables:  snf_facilities, ownership_profiles, ownership_contacts,           │
 * │          ma_transactions, cms_*, vbp_scores, etc.                          │
 * │ Access:  getMarketPool() - returns pg Pool instance                        │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * IMPORTANT: When adding new tables or features, determine which database
 * they belong to based on the data type:
 *   - User/deal/app data → DATABASE_URL (use Sequelize)
 *   - CMS/market/facility data → MARKET_DATABASE_URL (use getMarketPool)
 */

const path = require('path');
const { Sequelize } = require('sequelize');
const { Pool } = require('pg');

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

/**
 * Main Database Pool
 *
 * For app-specific tables (users, deals, notifications, comments, etc.)
 * Uses DATABASE_URL for the main application database.
 */
let mainPool = null;

const getMainPool = () => {
  if (!mainPool) {
    const connectionString = process.env.DATABASE_URL ||
                            'postgresql://localhost:5432/snf_platform';
    const isProduction = connectionString.includes('render.com');

    console.log('[Database Config] Main DB pool:',
      process.env.DATABASE_URL ? 'Using DATABASE_URL' : 'Using local default');

    mainPool = new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return mainPool;
};

/**
 * Market Database Pool
 *
 * For market data tables (snf_facilities, alf_facilities, demographics, etc.)
 * Uses MARKET_DATABASE_URL for the shared market database.
 * Falls back to DATABASE_URL for unified local development.
 */
let marketPool = null;

const getMarketPool = () => {
  if (!marketPool) {
    const connectionString = process.env.MARKET_DATABASE_URL ||
                            process.env.DATABASE_URL ||
                            'postgresql://localhost:5432/snf_platform';
    const isProduction = connectionString.includes('render.com');

    console.log('[Database Config] Market DB connection:',
      process.env.MARKET_DATABASE_URL ? 'Using MARKET_DATABASE_URL' :
      process.env.DATABASE_URL ? 'Using DATABASE_URL fallback' : 'Using local default');

    marketPool = new Pool({
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }
  return marketPool;
};

module.exports = {
  DB_PATH,
  getSQLitePath,
  getConnectionString,
  getSequelizeInstance,
  getMainPool,
  getMarketPool
};
