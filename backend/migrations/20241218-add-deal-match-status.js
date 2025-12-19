/**
 * Migration: Add match_status column to deals table
 *
 * Purpose: Track facility match status for deals to filter out incomplete deals from analytics
 *
 * Possible values:
 * - 'no_match_needed': Deal doesn't require facility matching (default)
 * - 'pending_match': Facility matches found but user hasn't confirmed yet
 * - 'matched': User selected a facility match
 * - 'skipped': User chose "None of These"
 * - 'not_sure': User chose "Not Sure"
 */

const runMigration = async (sequelize) => {
  console.log('[Migration] Adding match_status column to deals table...');

  try {
    const dialect = sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.log('[Migration] Skipping - not PostgreSQL');
      return;
    }

    // Check if column already exists (idempotent)
    const [existing] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'match_status'
    `);

    if (existing.length > 0) {
      console.log('[Migration] match_status column already exists, skipping');
      return;
    }

    // Add match_status column with default value
    await sequelize.query(`
      ALTER TABLE deals
      ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) DEFAULT 'no_match_needed'
    `);

    console.log('[Migration] Added match_status column to deals table');

    // Add check constraint for valid values
    await sequelize.query(`
      ALTER TABLE deals
      ADD CONSTRAINT chk_match_status
      CHECK (match_status IN ('no_match_needed', 'pending_match', 'matched', 'skipped', 'not_sure'))
    `).catch(err => {
      // Constraint may already exist
      if (!err.message.includes('already exists')) {
        console.warn('[Migration] Could not add check constraint:', err.message);
      }
    });

    // Add index for filtering analytics queries
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_deals_match_status ON deals(match_status)
    `);

    console.log('[Migration] Added index for match_status filtering');

    // Update existing deals with pending facility matches to 'pending_match'
    // Check extraction_data for facility_matches with status 'pending_review'
    const [pendingDeals] = await sequelize.query(`
      SELECT id, extraction_data, enhanced_extraction_data
      FROM deals
      WHERE match_status = 'no_match_needed'
    `);

    let updatedCount = 0;
    for (const deal of pendingDeals) {
      let hasPendingMatch = false;

      // Check extraction_data
      if (deal.extraction_data) {
        try {
          const data = typeof deal.extraction_data === 'string'
            ? JSON.parse(deal.extraction_data)
            : deal.extraction_data;

          const facilityMatches = data?.overview?.facility_matches || data?.deal_overview?.facility_matches;
          if (facilityMatches?.status === 'pending_review') {
            hasPendingMatch = true;
          } else if (facilityMatches?.status === 'selected') {
            await sequelize.query(`UPDATE deals SET match_status = 'matched' WHERE id = ?`, {
              replacements: [deal.id]
            });
            updatedCount++;
            continue;
          } else if (facilityMatches?.status === 'skipped') {
            await sequelize.query(`UPDATE deals SET match_status = 'skipped' WHERE id = ?`, {
              replacements: [deal.id]
            });
            updatedCount++;
            continue;
          } else if (facilityMatches?.status === 'not_sure') {
            await sequelize.query(`UPDATE deals SET match_status = 'not_sure' WHERE id = ?`, {
              replacements: [deal.id]
            });
            updatedCount++;
            continue;
          }
        } catch (e) { /* ignore parse errors */ }
      }

      // Check enhanced_extraction_data
      if (deal.enhanced_extraction_data) {
        try {
          const data = typeof deal.enhanced_extraction_data === 'string'
            ? JSON.parse(deal.enhanced_extraction_data)
            : deal.enhanced_extraction_data;

          const facilityMatches = data?.extractedData?.overview?.facility_matches;
          if (facilityMatches?.status === 'pending_review') {
            hasPendingMatch = true;
          } else if (facilityMatches?.status === 'selected') {
            await sequelize.query(`UPDATE deals SET match_status = 'matched' WHERE id = ?`, {
              replacements: [deal.id]
            });
            updatedCount++;
            continue;
          } else if (facilityMatches?.status === 'skipped') {
            await sequelize.query(`UPDATE deals SET match_status = 'skipped' WHERE id = ?`, {
              replacements: [deal.id]
            });
            updatedCount++;
            continue;
          } else if (facilityMatches?.status === 'not_sure') {
            await sequelize.query(`UPDATE deals SET match_status = 'not_sure' WHERE id = ?`, {
              replacements: [deal.id]
            });
            updatedCount++;
            continue;
          }
        } catch (e) { /* ignore parse errors */ }
      }

      if (hasPendingMatch) {
        await sequelize.query(`UPDATE deals SET match_status = 'pending_match' WHERE id = ?`, {
          replacements: [deal.id]
        });
        updatedCount++;
      }
    }

    console.log(`[Migration] Updated ${updatedCount} existing deals with match_status`);
    console.log('[Migration] match_status column migration complete');

  } catch (error) {
    console.error('[Migration] Error adding match_status column:', error.message);
    throw error;
  }
};

module.exports = { runMigration };
