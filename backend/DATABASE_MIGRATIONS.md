# Database Migrations Guide

## When Do I Need a Migration?

**You need a migration when:**
- Adding a new column to an existing table
- Removing a column from an existing table
- Changing a column's data type or constraints
- Adding a new table
- Renaming a table or column
- Adding/removing indexes

**You DON'T need a migration when:**
- Adding new API routes
- Changing frontend code
- Updating queries that read/write data
- Fixing bugs in existing code

## Quick Reference

| What you're doing | Need migration? | Example |
|-------------------|-----------------|---------|
| Add column to model | YES | `federal_provider_number: { type: DataTypes.STRING(20) }` |
| Add new model file | YES | Creating `backend/models/new_table.js` |
| Change column type | YES | `INTEGER` to `STRING` |
| Add new API route | NO | New endpoint in routes/ |
| Update frontend | NO | Any .jsx/.css changes |
| Import data | NO | Running collector scripts |

## How to Create a Migration

1. Create a file in `backend/migrations/` with format: `YYYYMMDD-description.js`

2. Use this template:

```javascript
/**
 * Migration: [Description]
 * Date: YYYY-MM-DD
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add column example:
    await queryInterface.addColumn('table_name', 'column_name', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    // Create table example:
    await queryInterface.createTable('new_table', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse the changes (optional but recommended)
    await queryInterface.removeColumn('table_name', 'column_name');
  }
};
```

3. The migration runs automatically on next deploy!

## Common Migration Commands

```javascript
// Add column
await queryInterface.addColumn('users', 'phone', { type: Sequelize.STRING(20) });

// Remove column
await queryInterface.removeColumn('users', 'phone');

// Change column type
await queryInterface.changeColumn('deals', 'amount', { type: Sequelize.DECIMAL(12, 2) });

// Add index
await queryInterface.addIndex('facilities', ['state', 'county']);

// Create table
await queryInterface.createTable('new_table', { ... });

// Drop table
await queryInterface.dropTable('old_table');
```

## Existing Migrations

Check `backend/migrations/` for examples of real migrations in this project.

## How It Works

1. On app startup, `migrationRunner.js` checks which migrations have run
2. Migrations are tracked in the `_migrations` table
3. Only pending migrations execute (sorted by filename)
4. Each migration runs once, ever

## Troubleshooting

**Migration failed?**
- Check the Render logs for the error message
- Fix the migration file and redeploy
- Or manually run the SQL on the production database

**Column already exists?**
- The migration may have partially run
- Check if the column exists in production
- Mark the migration as complete if needed:
  ```sql
  INSERT INTO _migrations (name) VALUES ('20241218-your-migration.js');
  ```
