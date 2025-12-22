/**
 * Migration: Add user_invitations table
 * This table stores pending and completed user invitations
 */

const runMigration = async (sequelize) => {
  const isPostgres = sequelize.options.dialect === 'postgres';

  if (!isPostgres) {
    console.log('Skipping user_invitations migration for non-PostgreSQL database');
    return;
  }

  try {
    // Check if table already exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'user_invitations'
      );
    `);

    if (results[0].exists) {
      console.log('user_invitations table already exists');
      return;
    }

    // Create the table
    await sequelize.query(`
      CREATE TABLE user_invitations (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'analyst',
        invited_by INTEGER NOT NULL REFERENCES users(id),
        token VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await sequelize.query(`
      CREATE INDEX idx_user_invitations_email_status ON user_invitations(email, status);
    `);

    await sequelize.query(`
      CREATE INDEX idx_user_invitations_token ON user_invitations(token);
    `);

    console.log('user_invitations table created successfully');
  } catch (error) {
    console.error('Error creating user_invitations table:', error.message);
  }
};

module.exports = { runMigration };
