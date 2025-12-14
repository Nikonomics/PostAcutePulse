-- Add user-editable fields to ownership_profiles table
-- These fields allow users to enrich ownership profiles with additional information

-- Add editable metadata fields
ALTER TABLE ownership_profiles
ADD COLUMN IF NOT EXISTS is_cms_sourced BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS headquarters_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS headquarters_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS headquarters_state CHAR(2),
ADD COLUMN IF NOT EXISTS headquarters_zip VARCHAR(10),
ADD COLUMN IF NOT EXISTS company_website VARCHAR(500),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
ADD COLUMN IF NOT EXISTS company_description TEXT,
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Add audit fields
ALTER TABLE ownership_profiles
ADD COLUMN IF NOT EXISTS created_by INTEGER,
ADD COLUMN IF NOT EXISTS last_edited_by INTEGER,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP;

-- Add foreign key constraints (separate statements for safety)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_ownership_created_by'
    ) THEN
        ALTER TABLE ownership_profiles
        ADD CONSTRAINT fk_ownership_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_ownership_last_edited_by'
    ) THEN
        ALTER TABLE ownership_profiles
        ADD CONSTRAINT fk_ownership_last_edited_by
        FOREIGN KEY (last_edited_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Index for finding user-created (non-CMS) profiles
CREATE INDEX IF NOT EXISTS idx_ownership_is_cms_sourced ON ownership_profiles(is_cms_sourced);

-- Update existing records to mark them as CMS-sourced
UPDATE ownership_profiles SET is_cms_sourced = TRUE WHERE is_cms_sourced IS NULL;

COMMENT ON COLUMN ownership_profiles.is_cms_sourced IS 'TRUE if auto-populated from CMS data, FALSE if user-created';
COMMENT ON COLUMN ownership_profiles.notes IS 'User notes about this ownership group (supports markdown)';
COMMENT ON COLUMN ownership_profiles.headquarters_city IS 'City where headquarters is located';
COMMENT ON COLUMN ownership_profiles.headquarters_state IS 'State code where headquarters is located';
COMMENT ON COLUMN ownership_profiles.company_description IS 'Brief description of the company';
