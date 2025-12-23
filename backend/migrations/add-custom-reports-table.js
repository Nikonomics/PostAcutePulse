/**
 * Migration: Add custom_reports table
 *
 * Stores user-created report configurations for the drag-and-drop report builder.
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  // Check if table already exists
  const tables = await queryInterface.showAllTables();
  if (tables.includes('custom_reports')) {
    console.log('custom_reports table already exists, skipping creation');
    return;
  }

  console.log('Creating custom_reports table...');

  await sequelize.query(`
    CREATE TABLE custom_reports (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      configuration JSONB NOT NULL DEFAULT '{}',
      is_template BOOLEAN NOT NULL DEFAULT FALSE,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      template_category VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP
    );

    -- Indexes for common queries
    CREATE INDEX idx_custom_reports_user_id ON custom_reports(user_id);
    CREATE INDEX idx_custom_reports_is_template ON custom_reports(is_template);
    CREATE INDEX idx_custom_reports_is_public ON custom_reports(is_public);
    CREATE INDEX idx_custom_reports_template_category ON custom_reports(template_category);

    COMMENT ON TABLE custom_reports IS 'User-created report configurations for drag-and-drop report builder';
    COMMENT ON COLUMN custom_reports.configuration IS 'Full report definition: blocks, queries, visualizations';
    COMMENT ON COLUMN custom_reports.template_category IS 'Category for templates: survey, financial, screening, vbp';
  `);

  console.log('custom_reports table created successfully');
}

async function rollbackMigration(sequelize) {
  console.log('Dropping custom_reports table...');
  await sequelize.query('DROP TABLE IF EXISTS custom_reports CASCADE;');
  console.log('custom_reports table dropped');
}

module.exports = { runMigration, rollbackMigration };
