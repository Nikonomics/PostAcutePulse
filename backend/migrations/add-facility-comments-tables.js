/**
 * Migration: Add Facility Comments Tables
 *
 * Creates facility_comments and facility_comment_mentions tables
 * for commenting on facility profiles (by CCN)
 */

const runMigration = async (sequelize) => {
  console.log('Migration: Adding facility comments tables...');

  try {
    // Check if facility_comments table exists
    const [facilityCommentsResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'facility_comments'
    `);
    const facilityCommentsExists = parseInt(facilityCommentsResult[0].count) > 0;

    if (!facilityCommentsExists) {
      await sequelize.query(`
        CREATE TABLE facility_comments (
          id SERIAL PRIMARY KEY,
          ccn VARCHAR(10) NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          comment TEXT NOT NULL,
          parent_id INTEGER REFERENCES facility_comments(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('Migration: Created facility_comments table');

      // Create indexes
      await sequelize.query('CREATE INDEX idx_facility_comments_ccn ON facility_comments(ccn)');
      await sequelize.query('CREATE INDEX idx_facility_comments_user_id ON facility_comments(user_id)');
      await sequelize.query('CREATE INDEX idx_facility_comments_parent_id ON facility_comments(parent_id)');
      await sequelize.query('CREATE INDEX idx_facility_comments_created_at ON facility_comments(created_at)');
      console.log('Migration: Created facility_comments indexes');
    } else {
      console.log('Migration: facility_comments table already exists, skipping');
    }

    // Check if facility_comment_mentions table exists
    const [facilityMentionsResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'facility_comment_mentions'
    `);
    const facilityMentionsExists = parseInt(facilityMentionsResult[0].count) > 0;

    if (!facilityMentionsExists) {
      await sequelize.query(`
        CREATE TABLE facility_comment_mentions (
          id SERIAL PRIMARY KEY,
          comment_id INTEGER NOT NULL REFERENCES facility_comments(id) ON DELETE CASCADE,
          mentioned_user_id INTEGER NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('Migration: Created facility_comment_mentions table');

      // Create indexes
      await sequelize.query('CREATE INDEX idx_facility_comment_mentions_comment_id ON facility_comment_mentions(comment_id)');
      await sequelize.query('CREATE INDEX idx_facility_comment_mentions_mentioned_user_id ON facility_comment_mentions(mentioned_user_id)');
      console.log('Migration: Created facility_comment_mentions indexes');
    } else {
      console.log('Migration: facility_comment_mentions table already exists, skipping');
    }

    console.log('Migration: Facility comments tables setup complete');
  } catch (error) {
    console.error('Migration error (facility comments tables):', error);
  }
};

module.exports = { runMigration };
