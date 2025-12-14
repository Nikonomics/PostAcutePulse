-- Create ownership_contacts table
-- Stores key people/contacts for ownership organizations

CREATE TABLE IF NOT EXISTS ownership_contacts (
    id SERIAL PRIMARY KEY,
    ownership_profile_id INTEGER NOT NULL,

    -- Contact details
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    linkedin_url VARCHAR(500),

    -- Role classification
    contact_type VARCHAR(50) DEFAULT 'other',  -- 'executive', 'operations', 'finance', 'development', 'legal', 'other'
    is_primary BOOLEAN DEFAULT FALSE,

    -- Notes
    notes TEXT,

    -- Audit fields
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_ownership_contact_profile
        FOREIGN KEY (ownership_profile_id)
        REFERENCES ownership_profiles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ownership_contact_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_ownership_contact_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ownership_contacts_profile ON ownership_contacts(ownership_profile_id);
CREATE INDEX IF NOT EXISTS idx_ownership_contacts_type ON ownership_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_ownership_contacts_primary ON ownership_contacts(ownership_profile_id, is_primary) WHERE is_primary = TRUE;

-- Full name search index
CREATE INDEX IF NOT EXISTS idx_ownership_contacts_name ON ownership_contacts(last_name, first_name);

COMMENT ON TABLE ownership_contacts IS 'Key people and contacts for ownership organizations';
COMMENT ON COLUMN ownership_contacts.contact_type IS 'Role type: executive, operations, finance, development, legal, other';
COMMENT ON COLUMN ownership_contacts.is_primary IS 'Primary contact for this organization';
