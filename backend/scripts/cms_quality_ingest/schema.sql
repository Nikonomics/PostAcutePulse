-- ============================================================================
-- CMS Quality Measures Schema for Marketplace Database
-- Target: snf_market_data (Render Postgres)
-- ============================================================================

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS gold;

-- ============================================================================
-- DROP EXISTING TABLES (for clean schema updates)
-- ============================================================================

DROP TABLE IF EXISTS staging.nh_quality_mds_raw CASCADE;
DROP TABLE IF EXISTS staging.nh_quality_claims_raw CASCADE;
DROP TABLE IF EXISTS gold.nh_quality_mds CASCADE;
DROP TABLE IF EXISTS gold.nh_quality_claims CASCADE;
DROP TABLE IF EXISTS gold.nh_quality_extracts CASCADE;
DROP TABLE IF EXISTS gold.nh_measure_definitions CASCADE;
DROP TABLE IF EXISTS gold.nh_ingest_log CASCADE;

-- ============================================================================
-- STAGING TABLES (Raw data, preserves original columns)
-- UNLOGGED for faster writes (no WAL overhead) - data can be rebuilt from CSVs
-- No UNIQUE constraints - using DELETE + COPY pattern for speed
-- ============================================================================

-- MDS Quality Measures (raw) - UNLOGGED for fast COPY
CREATE UNLOGGED TABLE staging.nh_quality_mds_raw (
    id SERIAL PRIMARY KEY,
    extract_id VARCHAR(6) NOT NULL,           -- YYYYMM format
    as_of_date DATE NOT NULL,                 -- First day of extract month
    source_file VARCHAR(255) NOT NULL,        -- Original filename

    -- Original CMS columns
    ccn VARCHAR(6) NOT NULL,                  -- CMS Certification Number (standardized, 6 chars)
    provider_name TEXT,
    provider_address TEXT,
    city TEXT,
    state VARCHAR(2),
    zip_code VARCHAR(10),
    measure_code VARCHAR(10) NOT NULL,
    measure_description TEXT,
    resident_type VARCHAR(20),                -- 'Long Stay' or 'Short Stay'
    q1_score NUMERIC(12,6),
    q1_footnote VARCHAR(50),
    q2_score NUMERIC(12,6),
    q2_footnote VARCHAR(50),
    q3_score NUMERIC(12,6),
    q3_footnote VARCHAR(50),
    q4_score NUMERIC(12,6),
    q4_footnote VARCHAR(50),
    four_quarter_avg NUMERIC(12,6),
    four_quarter_footnote VARCHAR(50),
    used_in_star_rating VARCHAR(1),           -- Y/N
    measure_period VARCHAR(50),               -- e.g., '2022Q4-2023Q3'
    location TEXT,
    processing_date DATE,

    created_at TIMESTAMP DEFAULT NOW()
    -- No UNIQUE constraint - using DELETE + COPY pattern for speed
);

-- Claims Quality Measures (raw) - UNLOGGED for fast COPY
CREATE UNLOGGED TABLE staging.nh_quality_claims_raw (
    id SERIAL PRIMARY KEY,
    extract_id VARCHAR(6) NOT NULL,           -- YYYYMM format
    as_of_date DATE NOT NULL,                 -- First day of extract month
    source_file VARCHAR(255) NOT NULL,        -- Original filename

    -- Original CMS columns
    ccn VARCHAR(6) NOT NULL,                  -- CMS Certification Number (standardized, 6 chars)
    provider_name TEXT,
    provider_address TEXT,
    city TEXT,
    state VARCHAR(2),
    zip_code VARCHAR(10),
    measure_code VARCHAR(10) NOT NULL,
    measure_description TEXT,
    resident_type VARCHAR(20),                -- 'Long Stay' or 'Short Stay'
    adjusted_score NUMERIC(12,6),
    observed_score NUMERIC(12,6),
    expected_score NUMERIC(12,6),
    footnote VARCHAR(50),
    used_in_star_rating VARCHAR(1),           -- Y/N
    measure_period VARCHAR(50),               -- e.g., '20220701-20230630'
    location TEXT,
    processing_date DATE,

    created_at TIMESTAMP DEFAULT NOW()
    -- No UNIQUE constraint - using DELETE + COPY pattern for speed
);

-- ============================================================================
-- GOLD TABLES (Cleaned, normalized, ready for analysis)
-- ============================================================================

-- Extract metadata table
CREATE TABLE gold.nh_quality_extracts (
    extract_id VARCHAR(6) PRIMARY KEY,        -- YYYYMM format
    as_of_date DATE NOT NULL,                 -- First day of extract month
    mds_row_count INTEGER,
    claims_row_count INTEGER,
    mds_facility_count INTEGER,
    claims_facility_count INTEGER,
    mds_source_file VARCHAR(255),
    claims_source_file VARCHAR(255),
    imported_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ingestion log for tracking runs
CREATE TABLE gold.nh_ingest_log (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(50) NOT NULL,              -- Unique run identifier
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running',     -- running, completed, failed
    files_processed INTEGER DEFAULT 0,
    mds_rows_inserted INTEGER DEFAULT 0,
    claims_rows_inserted INTEGER DEFAULT 0,
    errors TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Gold MDS Quality Measures
CREATE TABLE gold.nh_quality_mds (
    id SERIAL PRIMARY KEY,
    ccn VARCHAR(6) NOT NULL,
    extract_id VARCHAR(6) NOT NULL,
    as_of_date DATE NOT NULL,

    -- Measure identification
    measure_code VARCHAR(10) NOT NULL,
    measure_description TEXT,
    resident_type VARCHAR(20),                -- 'long_stay' or 'short_stay' (normalized)

    -- Quarterly scores
    q1_score NUMERIC(12,6),
    q2_score NUMERIC(12,6),
    q3_score NUMERIC(12,6),
    q4_score NUMERIC(12,6),
    four_quarter_avg NUMERIC(12,6),

    -- Footnotes (consolidated)
    footnotes JSONB,                          -- {"q1": "9", "q2": null, ...}
    has_suppression BOOLEAN DEFAULT FALSE,    -- True if any footnote indicates suppression

    -- Metadata
    used_in_star_rating BOOLEAN,
    measure_period VARCHAR(50),
    processing_date DATE,
    state VARCHAR(2),                         -- Derived from CCN prefix

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT gold_mds_unique UNIQUE (extract_id, ccn, measure_code)
);

-- Gold Claims Quality Measures
CREATE TABLE gold.nh_quality_claims (
    id SERIAL PRIMARY KEY,
    ccn VARCHAR(6) NOT NULL,
    extract_id VARCHAR(6) NOT NULL,
    as_of_date DATE NOT NULL,

    -- Measure identification
    measure_code VARCHAR(10) NOT NULL,
    measure_description TEXT,
    resident_type VARCHAR(20),                -- 'long_stay' or 'short_stay' (normalized)

    -- Scores
    adjusted_score NUMERIC(12,6),
    observed_score NUMERIC(12,6),
    expected_score NUMERIC(12,6),

    -- Footnotes
    footnote VARCHAR(50),
    has_suppression BOOLEAN DEFAULT FALSE,    -- True if footnote indicates suppression

    -- Metadata
    used_in_star_rating BOOLEAN,
    measure_period VARCHAR(50),
    processing_date DATE,
    state VARCHAR(2),                         -- Derived from CCN prefix

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT gold_claims_unique UNIQUE (extract_id, ccn, measure_code)
);

-- Measure definitions reference table
CREATE TABLE gold.nh_measure_definitions (
    measure_code VARCHAR(10) PRIMARY KEY,
    measure_type VARCHAR(10) NOT NULL,        -- 'mds' or 'claims'
    measure_description TEXT,
    resident_type VARCHAR(20),
    used_in_crid BOOLEAN DEFAULT FALSE,
    crid_weight NUMERIC(4,2),
    crid_component VARCHAR(20),               -- 'mds_composite' or 'claims_utilization'
    higher_is_worse BOOLEAN DEFAULT TRUE,     -- For interpretation
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

-- Staging indexes
CREATE INDEX idx_stg_mds_ccn ON staging.nh_quality_mds_raw(ccn);
CREATE INDEX idx_stg_mds_extract ON staging.nh_quality_mds_raw(extract_id);
CREATE INDEX idx_stg_mds_measure ON staging.nh_quality_mds_raw(measure_code);
CREATE INDEX idx_stg_mds_state ON staging.nh_quality_mds_raw(state);

CREATE INDEX idx_stg_claims_ccn ON staging.nh_quality_claims_raw(ccn);
CREATE INDEX idx_stg_claims_extract ON staging.nh_quality_claims_raw(extract_id);
CREATE INDEX idx_stg_claims_measure ON staging.nh_quality_claims_raw(measure_code);
CREATE INDEX idx_stg_claims_state ON staging.nh_quality_claims_raw(state);

-- Gold indexes
CREATE INDEX idx_gold_mds_ccn ON gold.nh_quality_mds(ccn);
CREATE INDEX idx_gold_mds_extract ON gold.nh_quality_mds(extract_id);
CREATE INDEX idx_gold_mds_measure ON gold.nh_quality_mds(measure_code);
CREATE INDEX idx_gold_mds_ccn_extract ON gold.nh_quality_mds(ccn, extract_id);
CREATE INDEX idx_gold_mds_state ON gold.nh_quality_mds(state);
CREATE INDEX idx_gold_mds_crid ON gold.nh_quality_mds(ccn, extract_id, measure_code)
    WHERE measure_code IN ('410', '453', '407', '409');

CREATE INDEX idx_gold_claims_ccn ON gold.nh_quality_claims(ccn);
CREATE INDEX idx_gold_claims_extract ON gold.nh_quality_claims(extract_id);
CREATE INDEX idx_gold_claims_measure ON gold.nh_quality_claims(measure_code);
CREATE INDEX idx_gold_claims_ccn_extract ON gold.nh_quality_claims(ccn, extract_id);
CREATE INDEX idx_gold_claims_state ON gold.nh_quality_claims(state);
CREATE INDEX idx_gold_claims_crid ON gold.nh_quality_claims(ccn, extract_id, measure_code)
    WHERE measure_code IN ('551', '552');

-- ============================================================================
-- REFERENCE DATA: Measure code definitions
-- ============================================================================

INSERT INTO gold.nh_measure_definitions (measure_code, measure_type, measure_description, resident_type, used_in_crid, crid_weight, crid_component, higher_is_worse) VALUES
-- MDS Measures used in CRID
('410', 'mds', 'Percentage of long-stay residents experiencing one or more falls with major injury', 'long_stay', TRUE, 0.35, 'mds_composite', TRUE),
('453', 'mds', 'Percentage of high risk long-stay residents with pressure ulcers', 'long_stay', TRUE, 0.30, 'mds_composite', TRUE),
('407', 'mds', 'Percentage of long-stay residents with a urinary tract infection', 'long_stay', TRUE, 0.20, 'mds_composite', TRUE),
('409', 'mds', 'Percentage of long-stay residents who were physically restrained', 'long_stay', TRUE, 0.15, 'mds_composite', TRUE),

-- Claims Measures used in CRID
('551', 'claims', 'Number of hospitalizations per 1000 long-stay resident days', 'long_stay', TRUE, 0.60, 'claims_utilization', TRUE),
('552', 'claims', 'Number of outpatient emergency department visits per 1000 long-stay resident days', 'long_stay', TRUE, 0.40, 'claims_utilization', TRUE),

-- Other MDS Measures (not in CRID)
('401', 'mds', 'Percentage of long-stay residents whose need for help with daily activities has increased', 'long_stay', FALSE, NULL, NULL, TRUE),
('404', 'mds', 'Percentage of long-stay residents who lose too much weight', 'long_stay', FALSE, NULL, NULL, TRUE),
('405', 'mds', 'Percentage of low risk long-stay residents who lose control of their bowels or bladder', 'long_stay', FALSE, NULL, NULL, TRUE),
('406', 'mds', 'Percentage of long-stay residents with a catheter inserted and left in their bladder', 'long_stay', FALSE, NULL, NULL, TRUE),
('408', 'mds', 'Percentage of long-stay residents who have depressive symptoms', 'long_stay', FALSE, NULL, NULL, TRUE),
('415', 'mds', 'Percentage of long-stay residents assessed and appropriately given the pneumococcal vaccine', 'long_stay', FALSE, NULL, NULL, FALSE),
('419', 'mds', 'Percentage of long-stay residents who received an antipsychotic medication', 'long_stay', FALSE, NULL, NULL, TRUE),
('430', 'mds', 'Percentage of short-stay residents assessed and appropriately given the pneumococcal vaccine', 'short_stay', FALSE, NULL, NULL, FALSE),
('434', 'mds', 'Percentage of short-stay residents who newly received an antipsychotic medication', 'short_stay', FALSE, NULL, NULL, TRUE),
('451', 'mds', 'Percentage of long-stay residents whose ability to move independently worsened', 'long_stay', FALSE, NULL, NULL, TRUE),
('452', 'mds', 'Percentage of long-stay residents who received an antianxiety or hypnotic medication', 'long_stay', FALSE, NULL, NULL, TRUE),
('454', 'mds', 'Percentage of long-stay residents assessed and appropriately given the seasonal influenza vaccine', 'long_stay', FALSE, NULL, NULL, FALSE),
('471', 'mds', 'Percentage of short-stay residents who made improvements in function', 'short_stay', FALSE, NULL, NULL, FALSE),
('472', 'mds', 'Percentage of short-stay residents who were assessed and appropriately given the seasonal influenza vaccine', 'short_stay', FALSE, NULL, NULL, FALSE),

-- Other Claims Measures (not in CRID)
('521', 'claims', 'Percentage of short-stay residents who were rehospitalized after a nursing home admission', 'short_stay', FALSE, NULL, NULL, TRUE),
('522', 'claims', 'Percentage of short-stay residents who had an outpatient emergency department visit', 'short_stay', FALSE, NULL, NULL, TRUE)
ON CONFLICT (measure_code) DO UPDATE SET
    measure_description = EXCLUDED.measure_description,
    used_in_crid = EXCLUDED.used_in_crid,
    crid_weight = EXCLUDED.crid_weight,
    crid_component = EXCLUDED.crid_component;

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================

COMMENT ON SCHEMA staging IS 'Raw data from CMS CSV files, minimal transformation';
COMMENT ON SCHEMA gold IS 'Cleaned and normalized data ready for analysis';

COMMENT ON TABLE staging.nh_quality_mds_raw IS 'Raw MDS quality measure data from CMS NH_QualityMsr_MDS_*.csv files';
COMMENT ON TABLE staging.nh_quality_claims_raw IS 'Raw Claims quality measure data from CMS NH_QualityMsr_Claims_*.csv files';
COMMENT ON TABLE gold.nh_quality_mds IS 'Cleaned MDS quality measures with normalized types and JSONB footnotes';
COMMENT ON TABLE gold.nh_quality_claims IS 'Cleaned Claims quality measures with normalized types';
COMMENT ON TABLE gold.nh_quality_extracts IS 'Metadata about each monthly CMS extract';
COMMENT ON TABLE gold.nh_ingest_log IS 'Log of ingestion runs for debugging and monitoring';
COMMENT ON TABLE gold.nh_measure_definitions IS 'Reference data for measure codes, including CRID weights';

COMMENT ON COLUMN gold.nh_quality_mds.footnotes IS 'JSONB object with footnotes: {"q1": "9", "q2": null, "q3": null, "q4": null, "avg": "9"}';
COMMENT ON COLUMN gold.nh_quality_mds.has_suppression IS 'True if any footnote code indicates data suppression (9, 10, 11, 12, 13, 14, 15)';
COMMENT ON COLUMN gold.nh_quality_mds.state IS 'State code derived from first 2 chars of CCN';
COMMENT ON COLUMN gold.nh_measure_definitions.crid_component IS 'Which CRID component this measure belongs to: mds_composite or claims_utilization';
