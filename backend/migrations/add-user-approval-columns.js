/**
 * Migration: Add user approval workflow columns
 *
 * Adds approval_status, approved_by, and approved_at columns to users table
 */

async function runMigration(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Migration: Adding user approval columns...');

    const usersColumns = await queryInterface.describeTable('users');

    if (!usersColumns.approval_status) {
      await queryInterface.addColumn('users', 'approval_status', {
        type: sequelize.Sequelize.STRING(20),
        allowNull: true,
        defaultValue: 'approved' // Existing users are auto-approved
      });
      console.log('Migration: Added approval_status column to users');
    }

    if (!usersColumns.approved_by) {
      await queryInterface.addColumn('users', 'approved_by', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true
      });
      console.log('Migration: Added approved_by column to users');
    }

    if (!usersColumns.approved_at) {
      await queryInterface.addColumn('users', 'approved_at', {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      });
      console.log('Migration: Added approved_at column to users');
    }

    // Ensure all admin users are always approved
    await sequelize.query(
      `UPDATE users SET approval_status = 'approved' WHERE role = 'admin' AND (approval_status IS NULL OR approval_status = 'pending')`,
      { type: sequelize.Sequelize.QueryTypes.UPDATE }
    );
    console.log('Migration: Ensured admin users are approved');

    // Also ensure existing users with NULL approval_status are set to approved
    await sequelize.query(
      `UPDATE users SET approval_status = 'approved' WHERE approval_status IS NULL`,
      { type: sequelize.Sequelize.QueryTypes.UPDATE }
    );
    console.log('Migration: Set existing users with NULL status to approved');

    console.log('Migration: User approval columns setup complete');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

module.exports = { runMigration };
