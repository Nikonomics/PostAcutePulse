-- Create ownership_change_logs table
-- Audit trail for all changes to ownership profiles

CREATE TABLE IF NOT EXISTS ownership_change_logs (
    id SERIAL PRIMARY KEY,
    ownership_profile_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    change_type VARCHAR(50) NOT NULL,  -- 'profile_created', 'profile_updated', 'contact_added', 'contact_updated', 'contact_deleted', 'comment_added', 'comment_deleted'
    field_name VARCHAR(100),  -- Specific field that was changed (for profile_updated)
    old_value TEXT,
    new_value TEXT,
    metadata JSONB,  -- Additional context (e.g., contact details, comment preview)
    created_at TIMESTAMP DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_ownership_log_profile
        FOREIGN KEY (ownership_profile_id)
        REFERENCES ownership_profiles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ownership_log_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ownership_logs_profile ON ownership_change_logs(ownership_profile_id);
CREATE INDEX IF NOT EXISTS idx_ownership_logs_user ON ownership_change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_logs_type ON ownership_change_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_ownership_logs_date ON ownership_change_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_logs_profile_date ON ownership_change_logs(ownership_profile_id, created_at DESC);

COMMENT ON TABLE ownership_change_logs IS 'Audit trail for changes to ownership profiles';
COMMENT ON COLUMN ownership_change_logs.change_type IS 'Type of change: profile_created, profile_updated, contact_added, contact_updated, contact_deleted, comment_added, comment_deleted';
COMMENT ON COLUMN ownership_change_logs.metadata IS 'Additional context as JSON (e.g., contact name, comment preview)';
