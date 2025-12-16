-- Migration: Complete CMS Data Tables
-- Adds all remaining CMS data tables we missed in initial import
-- Created: 2025-12-15

-- ============================================================
-- VBP (Value-Based Purchasing) SCORES
-- ============================================================

CREATE TABLE IF NOT EXISTS vbp_scores (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    fiscal_year INTEGER NOT NULL,           -- e.g., 2024, 2025, 2026
    ccn VARCHAR(10) NOT NULL,

    -- Ranking
    vbp_ranking INTEGER,

    -- Readmission Rates
    baseline_readmission_rate DECIMAL(8,4),
    baseline_period VARCHAR(50),            -- e.g., "FY 2019"
    performance_readmission_rate DECIMAL(8,4),
    performance_period VARCHAR(50),         -- e.g., "FY 2022"

    -- Scores
    achievement_score DECIMAL(8,4),
    improvement_score DECIMAL(8,4),
    performance_score DECIMAL(8,4),

    -- Payment Impact
    incentive_payment_multiplier DECIMAL(8,6),

    -- Footnotes
    ranking_footnote VARCHAR(20),
    baseline_footnote VARCHAR(20),
    performance_footnote VARCHAR(20),
    achievement_footnote VARCHAR(20),
    improvement_footnote VARCHAR(20),
    performance_score_footnote VARCHAR(20),
    multiplier_footnote VARCHAR(20),

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(fiscal_year, ccn)
);

CREATE INDEX IF NOT EXISTS idx_vbp_ccn ON vbp_scores(ccn);
CREATE INDEX IF NOT EXISTS idx_vbp_fy ON vbp_scores(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_vbp_ranking ON vbp_scores(vbp_ranking);

-- ============================================================
-- OWNERSHIP DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS ownership_records (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    -- Owner/Manager Info
    role_type VARCHAR(100),                 -- "Owner", "Manager", "Managing Employee", etc.
    owner_type VARCHAR(100),                -- "Individual", "Corporation", "Partnership", etc.
    owner_name VARCHAR(255),
    ownership_percentage DECIMAL(6,2),
    association_date DATE,

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ownership_ccn ON ownership_records(ccn);
CREATE INDEX IF NOT EXISTS idx_ownership_name ON ownership_records(owner_name);
CREATE INDEX IF NOT EXISTS idx_ownership_type ON ownership_records(owner_type);
CREATE INDEX IF NOT EXISTS idx_ownership_extract ON ownership_records(extract_id);

-- ============================================================
-- PENALTIES (Detailed)
-- ============================================================

CREATE TABLE IF NOT EXISTS penalty_records (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    penalty_date DATE,
    penalty_type VARCHAR(100),              -- "Fine", "Payment Denial", etc.
    fine_amount DECIMAL(12,2),
    payment_denial_start_date DATE,
    payment_denial_days INTEGER,

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penalty_ccn ON penalty_records(ccn);
CREATE INDEX IF NOT EXISTS idx_penalty_date ON penalty_records(penalty_date);
CREATE INDEX IF NOT EXISTS idx_penalty_type ON penalty_records(penalty_type);
CREATE INDEX IF NOT EXISTS idx_penalty_extract ON penalty_records(extract_id);

-- ============================================================
-- HEALTH CITATIONS (F-Tags)
-- ============================================================

CREATE TABLE IF NOT EXISTS health_citations (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    survey_date DATE,
    survey_type VARCHAR(100),               -- "Standard", "Complaint", etc.
    deficiency_prefix VARCHAR(10),          -- "F" for health
    deficiency_category VARCHAR(255),
    deficiency_tag VARCHAR(10),             -- e.g., "F686"
    deficiency_description TEXT,
    scope_severity_code VARCHAR(5),         -- A-L grid

    deficiency_corrected BOOLEAN,
    correction_date DATE,
    inspection_cycle INTEGER,

    is_standard_deficiency BOOLEAN,
    is_complaint_deficiency BOOLEAN,
    is_infection_control BOOLEAN,
    is_under_idr BOOLEAN,                   -- Independent Dispute Resolution

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hcite_ccn ON health_citations(ccn);
CREATE INDEX IF NOT EXISTS idx_hcite_date ON health_citations(survey_date);
CREATE INDEX IF NOT EXISTS idx_hcite_tag ON health_citations(deficiency_tag);
CREATE INDEX IF NOT EXISTS idx_hcite_severity ON health_citations(scope_severity_code);
CREATE INDEX IF NOT EXISTS idx_hcite_extract ON health_citations(extract_id);

-- ============================================================
-- FIRE SAFETY CITATIONS (K-Tags)
-- ============================================================

CREATE TABLE IF NOT EXISTS fire_safety_citations (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    survey_date DATE,
    survey_type VARCHAR(100),
    deficiency_prefix VARCHAR(10),          -- "K" for fire safety
    deficiency_category VARCHAR(255),
    deficiency_tag VARCHAR(10),             -- e.g., "K211"
    deficiency_description TEXT,
    scope_severity_code VARCHAR(5),

    deficiency_corrected BOOLEAN,
    correction_date DATE,
    inspection_cycle INTEGER,

    is_standard_deficiency BOOLEAN,
    is_complaint_deficiency BOOLEAN,

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fscite_ccn ON fire_safety_citations(ccn);
CREATE INDEX IF NOT EXISTS idx_fscite_date ON fire_safety_citations(survey_date);
CREATE INDEX IF NOT EXISTS idx_fscite_tag ON fire_safety_citations(deficiency_tag);
CREATE INDEX IF NOT EXISTS idx_fscite_extract ON fire_safety_citations(extract_id);

-- ============================================================
-- SURVEY DATES
-- ============================================================

CREATE TABLE IF NOT EXISTS survey_dates (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    survey_date DATE,
    survey_type VARCHAR(100),               -- "Health", "Fire Safety", "Complaint", etc.

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_survdate_ccn ON survey_dates(ccn);
CREATE INDEX IF NOT EXISTS idx_survdate_date ON survey_dates(survey_date);
CREATE INDEX IF NOT EXISTS idx_survdate_type ON survey_dates(survey_type);

-- ============================================================
-- MDS QUALITY MEASURES (Quarterly)
-- ============================================================

CREATE TABLE IF NOT EXISTS mds_quality_measures (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    measure_code VARCHAR(20) NOT NULL,
    measure_description TEXT,

    -- Quarterly scores
    q1_score DECIMAL(10,4),
    q2_score DECIMAL(10,4),
    q3_score DECIMAL(10,4),
    q4_score DECIMAL(10,4),

    -- Four-quarter average
    four_quarter_score DECIMAL(10,4),

    -- Footnotes
    q1_footnote VARCHAR(20),
    q2_footnote VARCHAR(20),
    q3_footnote VARCHAR(20),
    q4_footnote VARCHAR(20),

    -- Comparison data
    state_average DECIMAL(10,4),
    national_average DECIMAL(10,4),

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(extract_id, ccn, measure_code)
);

CREATE INDEX IF NOT EXISTS idx_mdsqm_ccn ON mds_quality_measures(ccn);
CREATE INDEX IF NOT EXISTS idx_mdsqm_measure ON mds_quality_measures(measure_code);
CREATE INDEX IF NOT EXISTS idx_mdsqm_extract ON mds_quality_measures(extract_id);

-- ============================================================
-- CLAIMS QUALITY MEASURES
-- ============================================================

CREATE TABLE IF NOT EXISTS claims_quality_measures (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    measure_code VARCHAR(20) NOT NULL,
    measure_description TEXT,

    score DECIMAL(10,4),
    footnote VARCHAR(20),

    -- Comparison data
    state_average DECIMAL(10,4),
    national_average DECIMAL(10,4),

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(extract_id, ccn, measure_code)
);

CREATE INDEX IF NOT EXISTS idx_claimsqm_ccn ON claims_quality_measures(ccn);
CREATE INDEX IF NOT EXISTS idx_claimsqm_measure ON claims_quality_measures(measure_code);

-- ============================================================
-- STATE/NATIONAL AVERAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS state_national_averages (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),

    state_code VARCHAR(2),                  -- NULL for national
    measure_code VARCHAR(50) NOT NULL,
    measure_description TEXT,

    average_value DECIMAL(10,4),

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sna_state ON state_national_averages(state_code);
CREATE INDEX IF NOT EXISTS idx_sna_measure ON state_national_averages(measure_code);

-- ============================================================
-- CITATION DESCRIPTIONS (Reference Table)
-- ============================================================

CREATE TABLE IF NOT EXISTS citation_descriptions (
    id SERIAL PRIMARY KEY,

    deficiency_tag VARCHAR(10) NOT NULL UNIQUE,  -- e.g., "F686", "K211"
    tag_prefix VARCHAR(5),                        -- "F" or "K"
    category VARCHAR(255),
    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citedesc_tag ON citation_descriptions(deficiency_tag);
CREATE INDEX IF NOT EXISTS idx_citedesc_prefix ON citation_descriptions(tag_prefix);

-- ============================================================
-- COVID VACCINATION DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS covid_vaccination (
    id SERIAL PRIMARY KEY,
    extract_id INTEGER REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    -- Staff vaccination
    staff_vaccination_rate DECIMAL(6,2),
    staff_up_to_date_rate DECIMAL(6,2),

    -- Resident vaccination
    resident_vaccination_rate DECIMAL(6,2),
    resident_up_to_date_rate DECIMAL(6,2),

    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(extract_id, ccn)
);

CREATE INDEX IF NOT EXISTS idx_covid_ccn ON covid_vaccination(ccn);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE vbp_scores IS 'SNF Value-Based Purchasing program scores and payment multipliers';
COMMENT ON TABLE ownership_records IS 'Facility ownership structure - individuals, corporations, managers';
COMMENT ON TABLE penalty_records IS 'Detailed penalty records with dates and amounts';
COMMENT ON TABLE health_citations IS 'Health deficiency citations (F-tags) from surveys';
COMMENT ON TABLE fire_safety_citations IS 'Fire safety deficiency citations (K-tags) from surveys';
COMMENT ON TABLE survey_dates IS 'All survey dates by type for each facility';
COMMENT ON TABLE mds_quality_measures IS 'MDS-based quality measures with quarterly scores';
COMMENT ON TABLE claims_quality_measures IS 'Claims-based quality measures';
COMMENT ON TABLE state_national_averages IS 'State and national benchmark averages';
COMMENT ON TABLE citation_descriptions IS 'Reference table for F-tag and K-tag descriptions';
COMMENT ON TABLE covid_vaccination IS 'Staff and resident COVID-19 vaccination rates';
