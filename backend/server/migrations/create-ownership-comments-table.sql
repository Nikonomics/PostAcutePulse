-- Create ownership_comments table
-- Stores discussion comments on ownership profiles with threading support

CREATE TABLE IF NOT EXISTS ownership_comments (
    id SERIAL PRIMARY KEY,
    ownership_profile_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    parent_id INTEGER,  -- For threaded replies
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_ownership_comment_profile
        FOREIGN KEY (ownership_profile_id)
        REFERENCES ownership_profiles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ownership_comment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ownership_comment_parent
        FOREIGN KEY (parent_id)
        REFERENCES ownership_comments(id)
        ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ownership_comments_profile ON ownership_comments(ownership_profile_id);
CREATE INDEX IF NOT EXISTS idx_ownership_comments_user ON ownership_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_comments_parent ON ownership_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_ownership_comments_created ON ownership_comments(ownership_profile_id, created_at DESC);

COMMENT ON TABLE ownership_comments IS 'Discussion comments on ownership profiles';
COMMENT ON COLUMN ownership_comments.parent_id IS 'Parent comment ID for threaded replies (NULL for top-level comments)';
