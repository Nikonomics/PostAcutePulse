/**
 * Migration to fix deal_expense_ratios unique constraint
 * The original schema incorrectly had UNIQUE on just period_end
 * It should be a composite unique on (deal_id, period_end)
 *
 * For SQLite, we need to recreate the table to fix the constraint
 */

async function runMigration(sequelize) {
  const dialect = sequelize.getDialect();

  try {
    console.log('Migration: Fixing deal_expense_ratios unique constraint...');

    // Check if table exists
    const [tables] = await sequelize.query(
      dialect === 'sqlite'
        ? "SELECT name FROM sqlite_master WHERE type='table' AND name='deal_expense_ratios'"
        : "SELECT table_name FROM information_schema.tables WHERE table_name='deal_expense_ratios'"
    );

    if (tables.length === 0) {
      console.log('Migration: deal_expense_ratios table does not exist yet, skipping');
      return;
    }

    if (dialect === 'sqlite') {
      // For SQLite, we need to check for and fix the constraint
      // First, check if there's a problematic unique constraint on just period_end
      const [indexInfo] = await sequelize.query(
        "SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='deal_expense_ratios'"
      );

      // Look for index that is UNIQUE only on period_end (not composite)
      let needsFix = false;
      for (const idx of indexInfo) {
        if (idx.sql && idx.sql.includes('UNIQUE') && idx.sql.includes('period_end')) {
          // Check if it's NOT a composite index (doesn't include deal_id)
          if (!idx.sql.includes('deal_id')) {
            needsFix = true;
            console.log('Migration: Found problematic unique constraint on period_end only:', idx.name);
          }
        }
      }

      // Also check for inline UNIQUE constraint in table definition
      const [tableInfo] = await sequelize.query(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='deal_expense_ratios'"
      );

      if (tableInfo.length > 0 && tableInfo[0].sql) {
        const tableSql = tableInfo[0].sql;
        // Check if period_end has UNIQUE constraint directly
        if (tableSql.includes('period_end') && tableSql.includes('UNIQUE')) {
          // Check if this is an inline UNIQUE (not a composite constraint)
          const periodEndMatch = tableSql.match(/`period_end`[^,]*UNIQUE/i);
          if (periodEndMatch) {
            needsFix = true;
            console.log('Migration: Found inline UNIQUE constraint on period_end');
          }
        }
      }

      if (needsFix) {
        console.log('Migration: Recreating deal_expense_ratios table to fix constraints...');

        // SQLite doesn't support dropping constraints, so we need to:
        // 1. Rename old table
        // 2. Create new table with correct constraints
        // 3. Copy data
        // 4. Drop old table

        // Start transaction
        await sequelize.query('BEGIN TRANSACTION');

        try {
          // Clear any existing data that would violate the new constraint
          // (keep only the latest record for each deal_id + period_end combination)
          await sequelize.query(`
            DELETE FROM deal_expense_ratios
            WHERE id NOT IN (
              SELECT MAX(id)
              FROM deal_expense_ratios
              GROUP BY deal_id, period_end
            )
          `);

          // Rename old table
          await sequelize.query('ALTER TABLE deal_expense_ratios RENAME TO deal_expense_ratios_old');

          // Create new table with correct structure (no inline UNIQUE on period_end)
          await sequelize.query(`
            CREATE TABLE deal_expense_ratios (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              deal_id INTEGER NOT NULL REFERENCES deals(id),
              period_end VARCHAR(7),
              total_labor_cost REAL,
              labor_pct_of_revenue REAL,
              nursing_labor_pct_of_revenue REAL,
              agency_labor_total REAL,
              agency_pct_of_labor REAL,
              agency_pct_of_direct_care REAL,
              labor_cost_per_resident_day REAL,
              total_cost_per_resident_day REAL,
              food_cost_total REAL,
              food_cost_per_resident_day REAL,
              food_pct_of_revenue REAL,
              dietary_labor_pct_of_revenue REAL,
              admin_pct_of_revenue REAL,
              management_fee_pct REAL,
              bad_debt_pct REAL,
              utilities_pct_of_revenue REAL,
              utilities_per_bed REAL,
              property_cost_per_bed REAL,
              maintenance_pct_of_revenue REAL,
              insurance_pct_of_revenue REAL,
              insurance_per_bed REAL,
              housekeeping_pct_of_revenue REAL,
              total_direct_care REAL,
              total_activities REAL,
              total_culinary REAL,
              total_housekeeping REAL,
              total_maintenance REAL,
              total_administration REAL,
              total_general REAL,
              total_property REAL,
              revenue_per_bed REAL,
              revenue_per_resident_day REAL,
              private_pay_rate_avg REAL,
              medicaid_rate_avg REAL,
              ebitdar_margin REAL,
              ebitda_margin REAL,
              operating_margin REAL,
              benchmark_flags TEXT,
              potential_savings TEXT,
              calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME
            )
          `);

          // Copy data from old table
          await sequelize.query(`
            INSERT INTO deal_expense_ratios
            SELECT * FROM deal_expense_ratios_old
          `);

          // Create the correct composite unique index (only if it doesn't exist)
          try {
            await sequelize.query(`
              CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_ratios_deal_period
              ON deal_expense_ratios (deal_id, period_end)
            `);
          } catch (err) {
            // Index might already exist - that's OK
            console.log('Migration: idx_expense_ratios_deal_period already exists');
          }

          // Create index on deal_id for performance (only if it doesn't exist)
          try {
            await sequelize.query(`
              CREATE INDEX IF NOT EXISTS idx_expense_ratios_deal_id
              ON deal_expense_ratios (deal_id)
            `);
          } catch (err) {
            // Index might already exist - that's OK
            console.log('Migration: idx_expense_ratios_deal_id already exists');
          }

          // Drop old table
          await sequelize.query('DROP TABLE deal_expense_ratios_old');

          await sequelize.query('COMMIT');
          console.log('Migration: Successfully recreated deal_expense_ratios with correct constraints');
        } catch (error) {
          await sequelize.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log('Migration: deal_expense_ratios constraints are correct, no changes needed');
      }
    } else {
      // PostgreSQL - simpler approach using ALTER TABLE
      try {
        // Drop any incorrect unique constraint on just period_end
        await sequelize.query(`
          ALTER TABLE deal_expense_ratios
          DROP CONSTRAINT IF EXISTS deal_expense_ratios_period_end_key
        `);
        console.log('Migration: Dropped incorrect period_end unique constraint (if existed)');
      } catch (err) {
        console.log('Migration: No period_end constraint to drop (this is fine)');
      }

      // Ensure composite unique constraint exists
      try {
        await sequelize.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_ratios_deal_period
          ON deal_expense_ratios (deal_id, period_end)
        `);
        console.log('Migration: Created composite unique index on (deal_id, period_end)');
      } catch (err) {
        console.log('Migration: Composite index already exists (this is fine)');
      }
    }

    console.log('Migration: deal_expense_ratios constraint fix complete');
  } catch (error) {
    console.error('Migration error fixing deal_expense_ratios:', error.message);
    // Don't throw - let the app continue
  }
}

module.exports = { runMigration };
