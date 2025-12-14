-- Migration: Add CBSA columns to county_demographics, snf_facilities, and alf_facilities
-- This enables market-level analysis by linking facilities and demographics to CBSAs

-- ============================================================================
-- 1. county_demographics
-- ============================================================================

-- Add columns
ALTER TABLE county_demographics
ADD COLUMN IF NOT EXISTS cbsa_code VARCHAR(5),
ADD COLUMN IF NOT EXISTS cbsa_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_rural BOOLEAN DEFAULT FALSE;

-- Populate from crosswalk
UPDATE county_demographics d
SET
    cbsa_code = c.cbsa_code,
    cbsa_title = c.cbsa_title,
    is_rural = FALSE
FROM county_cbsa_crosswalk c
WHERE d.county_fips = c.county_fips;

-- Set rural flag for unmatched counties
UPDATE county_demographics
SET is_rural = TRUE
WHERE cbsa_code IS NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_county_demographics_cbsa ON county_demographics(cbsa_code);

-- ============================================================================
-- 2. snf_facilities
-- ============================================================================

-- Add columns
ALTER TABLE snf_facilities
ADD COLUMN IF NOT EXISTS cbsa_code VARCHAR(5),
ADD COLUMN IF NOT EXISTS cbsa_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_rural BOOLEAN DEFAULT FALSE;

-- Populate from crosswalk
UPDATE snf_facilities f
SET
    cbsa_code = c.cbsa_code,
    cbsa_title = c.cbsa_title,
    is_rural = FALSE
FROM county_cbsa_crosswalk c
WHERE f.county_fips = c.county_fips;

-- Set rural flag for unmatched facilities
UPDATE snf_facilities
SET is_rural = TRUE
WHERE cbsa_code IS NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_snf_facilities_cbsa ON snf_facilities(cbsa_code);

-- ============================================================================
-- 3. alf_facilities
-- ============================================================================

-- Add columns
ALTER TABLE alf_facilities
ADD COLUMN IF NOT EXISTS cbsa_code VARCHAR(5),
ADD COLUMN IF NOT EXISTS cbsa_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_rural BOOLEAN DEFAULT FALSE;

-- Populate from crosswalk
UPDATE alf_facilities f
SET
    cbsa_code = c.cbsa_code,
    cbsa_title = c.cbsa_title,
    is_rural = FALSE
FROM county_cbsa_crosswalk c
WHERE f.county_fips = c.county_fips;

-- Set rural flag for unmatched facilities
UPDATE alf_facilities
SET is_rural = TRUE
WHERE cbsa_code IS NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_alf_facilities_cbsa ON alf_facilities(cbsa_code);
