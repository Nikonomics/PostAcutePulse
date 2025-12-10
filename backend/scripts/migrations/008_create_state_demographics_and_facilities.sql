-- Migration 008: Create state demographics and SNF facilities tables
-- Created: 2025-10-13
-- Purpose: Store state demographic data and CMS facility information for state analysis

-- ============================================================
-- STATE DEMOGRAPHICS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS state_demographics (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL UNIQUE,
    state_name VARCHAR(100) NOT NULL,

    -- Population data
    total_population BIGINT,
    population_65_plus BIGINT,
    population_85_plus BIGINT,
    percent_65_plus DECIMAL(5,2), -- e.g., 18.5 for 18.5%
    percent_85_plus DECIMAL(5,2),

    -- Senior demographics growth projections
    projected_65_plus_2030 BIGINT,
    projected_85_plus_2030 BIGINT,
    growth_rate_65_plus DECIMAL(5,2), -- Annual growth rate percentage
    growth_rate_85_plus DECIMAL(5,2),

    -- Data source and freshness
    data_source VARCHAR(255) DEFAULT 'US Census Bureau',
    data_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_state_demographics_state ON state_demographics(state_code);
CREATE INDEX IF NOT EXISTS idx_state_demographics_65_plus ON state_demographics(population_65_plus DESC);
CREATE INDEX IF NOT EXISTS idx_state_demographics_85_plus ON state_demographics(population_85_plus DESC);

-- ============================================================
-- SNF FACILITIES TABLE (CMS Nursing Home Compare Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS snf_facilities (
    id SERIAL PRIMARY KEY,

    -- CMS Identifiers
    federal_provider_number VARCHAR(10) NOT NULL UNIQUE, -- CMS provider ID
    cms_certification_number VARCHAR(12),

    -- Basic Info
    facility_name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    county VARCHAR(100),
    phone VARCHAR(20),

    -- Location (for mapping)
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    -- Facility Characteristics
    ownership_type VARCHAR(50), -- 'For profit', 'Non-profit', 'Government'
    provider_type VARCHAR(100), -- 'Skilled Nursing Facility', 'Nursing Home', etc.
    total_beds INTEGER,
    certified_beds INTEGER,
    occupied_beds INTEGER,
    occupancy_rate DECIMAL(5,2), -- Percentage

    -- Corporate Ownership
    legal_business_name VARCHAR(255),
    parent_organization VARCHAR(255),
    ownership_chain VARCHAR(255), -- e.g., 'Genesis HealthCare', 'Brookdale'
    multi_facility_chain BOOLEAN DEFAULT false,

    -- Quality Ratings (1-5 stars)
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    health_inspection_rating INTEGER CHECK (health_inspection_rating BETWEEN 1 AND 5),
    quality_measure_rating INTEGER CHECK (quality_measure_rating BETWEEN 1 AND 5),
    staffing_rating INTEGER CHECK (staffing_rating BETWEEN 1 AND 5),

    -- Staffing Metrics (hours per resident day)
    rn_staffing_hours DECIMAL(6,2),
    total_nurse_staffing_hours DECIMAL(6,2),
    reported_cna_staffing_hours DECIMAL(6,2),

    -- Compliance & Penalties
    health_deficiencies INTEGER,
    fire_safety_deficiencies INTEGER,
    complaint_deficiencies INTEGER,
    total_penalties_amount DECIMAL(12,2),
    penalty_count INTEGER,

    -- Medicare/Medicaid Participation
    accepts_medicare BOOLEAN DEFAULT true,
    accepts_medicaid BOOLEAN DEFAULT true,
    participating_in_qrp BOOLEAN, -- Quality Reporting Program

    -- Special Programs
    special_focus_facility BOOLEAN DEFAULT false, -- SFF designation
    abuse_icon BOOLEAN DEFAULT false,
    continuing_care_retirement_community BOOLEAN DEFAULT false,

    -- Financial (if available)
    average_daily_rate DECIMAL(10,2), -- Private pay rate
    medicare_rate DECIMAL(10,2),
    medicaid_rate DECIMAL(10,2),

    -- Operational Status
    active BOOLEAN DEFAULT true,
    date_certified DATE,
    date_closed DATE,
    certification_status VARCHAR(50), -- 'Active', 'Closed', 'Pending'

    -- Data source and freshness
    data_source VARCHAR(100) DEFAULT 'CMS Nursing Home Compare',
    last_cms_update DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_facilities_state ON snf_facilities(state);
CREATE INDEX IF NOT EXISTS idx_facilities_county ON snf_facilities(state, county);
CREATE INDEX IF NOT EXISTS idx_facilities_ownership ON snf_facilities(ownership_type);
CREATE INDEX IF NOT EXISTS idx_facilities_chain ON snf_facilities(ownership_chain);
CREATE INDEX IF NOT EXISTS idx_facilities_overall_rating ON snf_facilities(overall_rating);
CREATE INDEX IF NOT EXISTS idx_facilities_beds ON snf_facilities(total_beds DESC);
CREATE INDEX IF NOT EXISTS idx_facilities_occupancy ON snf_facilities(occupancy_rate DESC);
CREATE INDEX IF NOT EXISTS idx_facilities_active ON snf_facilities(active);

-- Geospatial index for location-based queries
CREATE INDEX IF NOT EXISTS idx_facilities_location ON snf_facilities(latitude, longitude);

-- Full-text search index for facility names and organizations
CREATE INDEX IF NOT EXISTS idx_facilities_name_search ON snf_facilities USING GIN(
    to_tsvector('english', COALESCE(facility_name, '') || ' ' || COALESCE(parent_organization, ''))
);

-- ============================================================
-- STATE MARKET METRICS TABLE (Aggregated facility data per state)
-- ============================================================
CREATE TABLE IF NOT EXISTS state_market_metrics (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL UNIQUE,

    -- Facility Counts
    total_facilities INTEGER,
    for_profit_facilities INTEGER,
    nonprofit_facilities INTEGER,
    government_facilities INTEGER,
    chain_owned_facilities INTEGER,
    independent_facilities INTEGER,

    -- Capacity Metrics
    total_beds INTEGER,
    average_beds_per_facility DECIMAL(8,2),
    total_occupied_beds INTEGER,
    average_occupancy_rate DECIMAL(5,2),

    -- Quality Metrics (State Averages)
    avg_overall_rating DECIMAL(3,2),
    avg_health_inspection_rating DECIMAL(3,2),
    avg_staffing_rating DECIMAL(3,2),

    -- Staffing Metrics (State Averages)
    avg_rn_hours DECIMAL(6,2),
    avg_total_nurse_hours DECIMAL(6,2),
    avg_cna_hours DECIMAL(6,2),

    -- Market Dynamics
    beds_per_1000_seniors DECIMAL(8,2), -- Beds per 1,000 population 65+
    facilities_per_100k_seniors DECIMAL(8,2), -- Facilities per 100k seniors

    -- Compliance
    avg_health_deficiencies DECIMAL(6,2),
    facilities_with_penalties INTEGER,
    total_penalties_amount DECIMAL(15,2),

    -- Special Designations
    special_focus_facilities INTEGER,
    facilities_with_abuse_icon INTEGER,

    -- Data freshness
    calculation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX IF NOT EXISTS idx_state_metrics_state ON state_market_metrics(state_code);

-- ============================================================
-- VIEWS
-- ============================================================

-- Top-rated facilities by state
CREATE OR REPLACE VIEW top_rated_facilities_by_state AS
SELECT
    state,
    COUNT(*) as facility_count,
    AVG(overall_rating) as avg_rating,
    AVG(occupancy_rate) as avg_occupancy,
    AVG(total_beds) as avg_beds
FROM snf_facilities
WHERE overall_rating >= 4
    AND active = true
GROUP BY state
ORDER BY avg_rating DESC, facility_count DESC;

-- Chain market share by state
CREATE OR REPLACE VIEW chain_market_share AS
SELECT
    state,
    ownership_chain,
    COUNT(*) as facility_count,
    SUM(total_beds) as total_beds,
    ROUND((COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER (PARTITION BY state) * 100), 2) as market_share_pct
FROM snf_facilities
WHERE active = true
    AND ownership_chain IS NOT NULL
GROUP BY state, ownership_chain
ORDER BY state, facility_count DESC;

-- State demographic summary (combines demographics + facility data)
CREATE OR REPLACE VIEW state_overview AS
SELECT
    sd.state_code,
    sd.state_name,
    sd.population_65_plus,
    sd.population_85_plus,
    sd.percent_65_plus,
    sd.growth_rate_65_plus,
    sm.total_facilities,
    sm.total_beds,
    sm.average_occupancy_rate,
    sm.avg_overall_rating,
    sm.beds_per_1000_seniors,
    sm.facilities_per_100k_seniors
FROM state_demographics sd
LEFT JOIN state_market_metrics sm ON sd.state_code = sm.state_code
ORDER BY sd.population_65_plus DESC;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update triggers
DROP TRIGGER IF EXISTS update_state_demographics_updated_at ON state_demographics;
CREATE TRIGGER update_state_demographics_updated_at
    BEFORE UPDATE ON state_demographics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_snf_facilities_updated_at ON snf_facilities;
CREATE TRIGGER update_snf_facilities_updated_at
    BEFORE UPDATE ON snf_facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_state_market_metrics_updated_at ON state_market_metrics;
CREATE TRIGGER update_state_market_metrics_updated_at
    BEFORE UPDATE ON state_market_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
