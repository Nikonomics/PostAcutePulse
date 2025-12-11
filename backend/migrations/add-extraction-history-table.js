/**
 * Migration: Add extraction_history table for audit trail
 *
 * This table tracks all changes to extraction_data over time,
 * providing an audit trail for debugging AI extraction issues.
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  try {
    console.log('Migration: Creating extraction_history table...');

    // Check if table already exists
    const tables = await queryInterface.showAllTables();
    if (tables.includes('extraction_history')) {
      console.log('Migration: extraction_history table already exists, skipping');
      return;
    }

    if (dialect === 'sqlite') {
      // SQLite version
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS extraction_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          deal_id INTEGER NOT NULL,
          extraction_data TEXT NOT NULL,
          source VARCHAR(50) NOT NULL,
          changed_fields TEXT,
          created_by VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_extraction_history_deal_id
        ON extraction_history(deal_id)
      `);
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_extraction_history_created_at
        ON extraction_history(created_at)
      `);
    } else {
      // PostgreSQL version
      const schema = process.env.PGSCHEMA || 'snfalyze';

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.extraction_history (
          id SERIAL PRIMARY KEY,
          deal_id INTEGER NOT NULL REFERENCES ${schema}.deals(id) ON DELETE CASCADE,
          extraction_data JSONB NOT NULL,
          source VARCHAR(50) NOT NULL,
          changed_fields TEXT[],
          created_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_extraction_history_deal_id
        ON ${schema}.extraction_history(deal_id)
      `);
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_extraction_history_created_at
        ON ${schema}.extraction_history(created_at)
      `);
    }

    console.log('Migration: extraction_history table created successfully');
  } catch (error) {
    console.error('Migration error:', error.message);
    // Don't throw - let the app continue even if migration fails
  }
}

module.exports = { runMigration };
