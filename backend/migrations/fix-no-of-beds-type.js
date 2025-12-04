/**
 * Migration to convert no_of_beds from VARCHAR to INTEGER in PostgreSQL
 * This needs to run before Sequelize sync because PostgreSQL can't auto-cast
 */

async function runMigration(sequelize) {
  // Only run for PostgreSQL
  if (sequelize.getDialect() !== 'postgres') {
    console.log('Migration: Skipping no_of_beds type fix (not PostgreSQL)');
    return;
  }

  const queryInterface = sequelize.getQueryInterface();

  try {
    // Check if the column exists and its current type
    const [results] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'no_of_beds'
    `);

    if (results.length === 0) {
      console.log('Migration: no_of_beds column does not exist yet, skipping');
      return;
    }

    const currentType = results[0].data_type;

    if (currentType === 'integer') {
      console.log('Migration: no_of_beds is already INTEGER, skipping');
      return;
    }

    console.log(`Migration: Converting no_of_beds from ${currentType} to INTEGER...`);

    // Convert the column with explicit cast, handling non-numeric values
    await sequelize.query(`
      ALTER TABLE deals
      ALTER COLUMN no_of_beds TYPE INTEGER
      USING CASE
        WHEN no_of_beds ~ '^[0-9]+$' THEN no_of_beds::INTEGER
        ELSE NULL
      END
    `);

    console.log('Migration: no_of_beds successfully converted to INTEGER');
  } catch (error) {
    // If the table doesn't exist yet, that's fine
    if (error.message && error.message.includes('does not exist')) {
      console.log('Migration: deals table does not exist yet, skipping migration');
      return;
    }
    console.error('Migration error:', error.message);
    // Don't throw - let the app continue
  }
}

module.exports = { runMigration };
