/**
 * Migration: Add Market Comments Tables
 *
 * Creates market_comments and market_comment_mentions tables
 * for commenting on market analysis (by state + county)
 */

const runMigration = async (sequelize) => {
  console.log('Migration: Adding market comments tables...');

  try {
    // Check if market_comments table exists
    const [marketCommentsResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'market_comments'
    `);
    const marketCommentsExists = parseInt(marketCommentsResult[0].count) > 0;

    if (!marketCommentsExists) {
      await sequelize.query(`
        CREATE TABLE market_comments (
          id SERIAL PRIMARY KEY,
          state VARCHAR(2) NOT NULL,
          county VARCHAR(100) NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          comment TEXT NOT NULL,
          parent_id INTEGER REFERENCES market_comments(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('Migration: Created market_comments table');

      // Create indexes
      await sequelize.query('CREATE INDEX idx_market_comments_state_county ON market_comments(state, county)');
      await sequelize.query('CREATE INDEX idx_market_comments_user_id ON market_comments(user_id)');
      await sequelize.query('CREATE INDEX idx_market_comments_parent_id ON market_comments(parent_id)');
      await sequelize.query('CREATE INDEX idx_market_comments_created_at ON market_comments(created_at)');
      console.log('Migration: Created market_comments indexes');
    } else {
      console.log('Migration: market_comments table already exists, skipping');
    }

    // Check if market_comment_mentions table exists
    const [marketMentionsResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'market_comment_mentions'
    `);
    const marketMentionsExists = parseInt(marketMentionsResult[0].count) > 0;

    if (!marketMentionsExists) {
      await sequelize.query(`
        CREATE TABLE market_comment_mentions (
          id SERIAL PRIMARY KEY,
          comment_id INTEGER NOT NULL REFERENCES market_comments(id) ON DELETE CASCADE,
          mentioned_user_id INTEGER NOT NULL REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('Migration: Created market_comment_mentions table');

      // Create indexes
      await sequelize.query('CREATE INDEX idx_market_comment_mentions_comment_id ON market_comment_mentions(comment_id)');
      await sequelize.query('CREATE INDEX idx_market_comment_mentions_mentioned_user_id ON market_comment_mentions(mentioned_user_id)');
      console.log('Migration: Created market_comment_mentions indexes');
    } else {
      console.log('Migration: market_comment_mentions table already exists, skipping');
    }

    console.log('Migration: Market comments tables setup complete');
  } catch (error) {
    console.error('Migration error (market comments tables):', error);
  }
};

module.exports = { runMigration };
