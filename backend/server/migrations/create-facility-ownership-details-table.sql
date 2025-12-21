-- Migration: Create facility_ownership_details table for ownership change tracking
-- This table stores ownership snapshots from each monthly CMS extract
-- Enables detection of ownership changes by comparing consecutive months
-- Created: 2025-12-19

-- ============================================================
-- FACILITY OWNERSHIP DETAILS (Monthly Snapshots)
-- ============================================================

CREATE TABLE IF NOT EXISTS facility_ownership_details (
    id SERIAL PRIMARY KEY,

    -- Link to CMS extract snapshot
    extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),

    -- Facility identifier
    ccn VARCHAR(10) NOT NULL,
    provider_name VARCHAR(255),

    -- Owner information
    owner_name VARCHAR(255) NOT NULL,
    owner_type VARCHAR(100),           -- Individual, Corporation, Partnership, etc.
    owner_role VARCHAR(100),           -- 5% OR GREATER DIRECT OWNERSHIP INTEREST, OFFICER, DIRECTOR, etc.
    ownership_percentage DECIMAL(6,2), -- Percentage of ownership (e.g., 100.00, 5.00)

    -- Association date (when owner became associated with facility)
    association_date DATE,             -- Parsed date
    association_date_raw VARCHAR(100), -- Raw value from CMS (e.g., "since 01/25/2012")

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Composite unique constraint to prevent duplicates within same extract
    UNIQUE(extract_id, ccn, owner_name, owner_role)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_fod_extract ON facility_ownership_details(extract_id);
CREATE INDEX IF NOT EXISTS idx_fod_ccn ON facility_ownership_details(ccn);
CREATE INDEX IF NOT EXISTS idx_fod_owner_name ON facility_ownership_details(owner_name);

-- For change detection queries (comparing consecutive extracts)
CREATE INDEX IF NOT EXISTS idx_fod_ccn_extract ON facility_ownership_details(ccn, extract_id);
CREATE INDEX IF NOT EXISTS idx_fod_ccn_owner ON facility_ownership_details(ccn, owner_name);

-- For filtering by ownership type
CREATE INDEX IF NOT EXISTS idx_fod_owner_role ON facility_ownership_details(owner_role);
CREATE INDEX IF NOT EXISTS idx_fod_owner_type ON facility_ownership_details(owner_type);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE facility_ownership_details IS
'Monthly snapshots of facility ownership from CMS NH_Ownership files. Each extract_id represents a monthly snapshot, enabling detection of ownership changes by comparing consecutive months.';

COMMENT ON COLUMN facility_ownership_details.extract_id IS 'Reference to cms_extracts table - identifies which monthly snapshot this record came from';
COMMENT ON COLUMN facility_ownership_details.ccn IS 'CMS Certification Number - unique facility identifier';
COMMENT ON COLUMN facility_ownership_details.owner_role IS 'Role of owner: 5% OR GREATER DIRECT OWNERSHIP INTEREST, 5% OR GREATER INDIRECT OWNERSHIP INTEREST, OFFICER, DIRECTOR, MANAGING EMPLOYEE, OPERATIONAL/MANAGERIAL CONTROL, etc.';
COMMENT ON COLUMN facility_ownership_details.owner_type IS 'Type of owner: Individual, Corporation, Partnership, Organization, etc.';
COMMENT ON COLUMN facility_ownership_details.ownership_percentage IS 'Percentage of ownership stake (NULL for non-ownership roles like OFFICER, DIRECTOR)';
COMMENT ON COLUMN facility_ownership_details.association_date IS 'Parsed date when owner became associated with facility';
COMMENT ON COLUMN facility_ownership_details.association_date_raw IS 'Raw date string from CMS file (e.g., "since 01/25/2012") - preserved for debugging';
