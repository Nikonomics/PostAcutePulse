/**
 * Migration: Drop Deal Tables
 *
 * This migration removes all deal-related tables as part of the refactor
 * from "Deal CRM" to "Market Intelligence" platform.
 *
 * WARNING: This is a destructive migration that cannot be undone.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop tables in order to respect foreign key constraints
    // Child tables first, then parent tables

    const tablesToDrop = [
      'deal_comments',
      'deal_documents',
      'deal_facilities',
      'deal_team_members',
      'deal_change_logs',
      'deal_expense_ratios',
      'deal_external_advisors',
      'deal_extracted_text',
      'deal_monthly_census',
      'deal_monthly_expenses',
      'deal_monthly_financials',
      'deal_proforma_scenarios',
      'deal_rate_schedules',
      'deal_user_views',
      'deals',
      'master_deals'
    ];

    for (const table of tablesToDrop) {
      try {
        await queryInterface.dropTable(table, { cascade: true });
        console.log(`Dropped table: ${table}`);
      } catch (err) {
        // Table may not exist, that's fine
        console.log(`Table ${table} does not exist or already dropped: ${err.message}`);
      }
    }

    console.log('Deal tables migration complete.');
  },

  async down(queryInterface, Sequelize) {
    // This is a destructive migration - data cannot be recovered
    // The down function is intentionally empty
    console.log('This migration cannot be reversed. Deal data has been permanently removed.');
    return Promise.resolve();
  }
};
