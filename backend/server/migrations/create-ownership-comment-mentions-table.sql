-- Create ownership_comment_mentions table
-- Tracks @mentions in ownership profile comments for notifications

CREATE TABLE IF NOT EXISTS ownership_comment_mentions (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL,
    mentioned_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_ownership_mention_comment
        FOREIGN KEY (comment_id)
        REFERENCES ownership_comments(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ownership_mention_user
        FOREIGN KEY (mentioned_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Prevent duplicate mentions in the same comment
    CONSTRAINT unique_ownership_comment_mention
        UNIQUE (comment_id, mentioned_user_id)
);

-- Indexes for notification queries
CREATE INDEX IF NOT EXISTS idx_ownership_mentions_comment ON ownership_comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_ownership_mentions_user ON ownership_comment_mentions(mentioned_user_id);

COMMENT ON TABLE ownership_comment_mentions IS 'Tracks @mentions in ownership profile comments for notifications';
