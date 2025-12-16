-- Migration: Create Facility Time-Series Tables (5-Layer Architecture)
-- Purpose: Enable historical tracking, event detection, and predictive analytics
-- Created: 2025-12-15

-- ============================================================
-- LAYER 0: EXTRACT TRACKING
-- Track which CMS data extracts have been imported
-- ============================================================

CREATE TABLE IF NOT EXISTS cms_extracts (
    extract_id SERIAL PRIMARY KEY,
    extract_date DATE NOT NULL UNIQUE,          -- The nominal date of the extract (e.g., 2025-11-01)
    source_file VARCHAR(255),                   -- Original filename/archive
    processing_date DATE,                       -- CMS processing date from file
    record_count INTEGER,                       -- Number of facilities in extract
    import_started_at TIMESTAMP,
    import_completed_at TIMESTAMP,
    import_status VARCHAR(20) DEFAULT 'pending', -- pending, importing, completed, failed
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extracts_date ON cms_extracts(extract_date);
CREATE INDEX IF NOT EXISTS idx_extracts_status ON cms_extracts(import_status);

-- ============================================================
-- LAYER 1: RAW SNAPSHOTS
-- Point-in-time data from each CMS extract
-- ============================================================

-- Core facility information at each extract point
CREATE TABLE IF NOT EXISTS facility_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,                   -- CMS Certification Number

    -- Basic Info
    provider_name VARCHAR(255),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    county VARCHAR(100),
    phone VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    -- Facility Characteristics
    ownership_type VARCHAR(50),
    provider_type VARCHAR(100),
    certified_beds INTEGER,
    average_residents_per_day DECIMAL(8,2),
    is_urban BOOLEAN,
    is_hospital_based BOOLEAN,
    legal_business_name VARCHAR(255),
    date_first_approved DATE,

    -- Chain/Portfolio Info
    chain_name VARCHAR(255),
    chain_id VARCHAR(20),
    facilities_in_chain INTEGER,
    chain_avg_overall_rating DECIMAL(3,2),
    chain_avg_health_rating DECIMAL(3,2),
    chain_avg_staffing_rating DECIMAL(3,2),
    chain_avg_qm_rating DECIMAL(3,2),

    -- Special Designations
    is_ccrc BOOLEAN DEFAULT FALSE,              -- Continuing Care Retirement Community
    special_focus_status VARCHAR(50),           -- SFF designation
    has_abuse_icon BOOLEAN DEFAULT FALSE,
    has_recent_ownership_change BOOLEAN DEFAULT FALSE,
    has_resident_family_council BOOLEAN,
    has_sprinkler_system BOOLEAN,

    -- Star Ratings (1-5)
    overall_rating INTEGER,
    health_inspection_rating INTEGER,
    qm_rating INTEGER,
    long_stay_qm_rating INTEGER,
    short_stay_qm_rating INTEGER,
    staffing_rating INTEGER,

    -- Staffing (Hours per Resident per Day)
    reported_na_hrs DECIMAL(6,3),
    reported_lpn_hrs DECIMAL(6,3),
    reported_rn_hrs DECIMAL(6,3),
    reported_licensed_hrs DECIMAL(6,3),
    reported_total_nurse_hrs DECIMAL(6,3),
    weekend_total_nurse_hrs DECIMAL(6,3),
    weekend_rn_hrs DECIMAL(6,3),
    reported_pt_hrs DECIMAL(6,3),

    -- Adjusted Staffing (Case-Mix Adjusted)
    case_mix_index DECIMAL(6,4),
    adjusted_na_hrs DECIMAL(6,3),
    adjusted_lpn_hrs DECIMAL(6,3),
    adjusted_rn_hrs DECIMAL(6,3),
    adjusted_total_nurse_hrs DECIMAL(6,3),

    -- Turnover
    total_nursing_turnover DECIMAL(6,2),
    rn_turnover DECIMAL(6,2),
    administrator_departures INTEGER,

    -- Survey/Inspection Results - Cycle 1
    cycle1_survey_date DATE,
    cycle1_total_health_deficiencies INTEGER,
    cycle1_standard_deficiencies INTEGER,
    cycle1_complaint_deficiencies INTEGER,
    cycle1_deficiency_score DECIMAL(8,2),
    cycle1_revisit_count INTEGER,
    cycle1_revisit_score DECIMAL(8,2),
    cycle1_total_score DECIMAL(8,2),

    -- Survey Results - Cycle 2/3
    cycle2_survey_date DATE,
    cycle2_total_health_deficiencies INTEGER,
    cycle2_standard_deficiencies INTEGER,
    cycle2_complaint_deficiencies INTEGER,
    cycle2_deficiency_score DECIMAL(8,2),
    cycle2_revisit_count INTEGER,
    cycle2_revisit_score DECIMAL(8,2),
    cycle2_total_score DECIMAL(8,2),

    -- Weighted Health Score
    total_weighted_health_score DECIMAL(8,2),

    -- Complaints & Incidents
    facility_reported_incidents INTEGER,
    substantiated_complaints INTEGER,
    infection_control_citations INTEGER,

    -- Penalties
    fine_count INTEGER,
    fine_total_dollars DECIMAL(12,2),
    payment_denial_count INTEGER,
    total_penalty_count INTEGER,

    -- Footnotes (data quality indicators)
    overall_rating_fn VARCHAR(10),
    health_rating_fn VARCHAR(10),
    qm_rating_fn VARCHAR(10),
    staffing_rating_fn VARCHAR(10),
    avg_residents_fn VARCHAR(10),

    -- Processing metadata
    cms_processing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(extract_id, ccn)
);

-- Indexes for facility_snapshots
CREATE INDEX IF NOT EXISTS idx_fs_extract ON facility_snapshots(extract_id);
CREATE INDEX IF NOT EXISTS idx_fs_ccn ON facility_snapshots(ccn);
CREATE INDEX IF NOT EXISTS idx_fs_state ON facility_snapshots(state);
CREATE INDEX IF NOT EXISTS idx_fs_chain ON facility_snapshots(chain_id);
CREATE INDEX IF NOT EXISTS idx_fs_county ON facility_snapshots(state, county);
CREATE INDEX IF NOT EXISTS idx_fs_ccn_extract ON facility_snapshots(ccn, extract_id);

-- Quality Measures (MDS-based) at each extract point
CREATE TABLE IF NOT EXISTS quality_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,
    measure_code VARCHAR(10) NOT NULL,

    -- Score can be percentage, rate, or count depending on measure
    score DECIMAL(10,4),
    footnote VARCHAR(20),

    -- Data collection period for this measure
    start_date DATE,
    end_date DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(extract_id, ccn, measure_code)
);

CREATE INDEX IF NOT EXISTS idx_qs_extract ON quality_snapshots(extract_id);
CREATE INDEX IF NOT EXISTS idx_qs_ccn ON quality_snapshots(ccn);
CREATE INDEX IF NOT EXISTS idx_qs_measure ON quality_snapshots(measure_code);
CREATE INDEX IF NOT EXISTS idx_qs_ccn_measure ON quality_snapshots(ccn, measure_code);

-- Penalty detail snapshots
CREATE TABLE IF NOT EXISTS penalty_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    -- Penalty Details
    penalty_date DATE,
    penalty_type VARCHAR(50),                   -- Fine, Payment Denial, etc.
    fine_amount DECIMAL(12,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ps_extract ON penalty_snapshots(extract_id);
CREATE INDEX IF NOT EXISTS idx_ps_ccn ON penalty_snapshots(ccn);
CREATE INDEX IF NOT EXISTS idx_ps_date ON penalty_snapshots(penalty_date);

-- Survey/Deficiency detail snapshots
CREATE TABLE IF NOT EXISTS deficiency_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),
    ccn VARCHAR(10) NOT NULL,

    survey_date DATE,
    survey_type VARCHAR(50),                    -- Standard, Complaint, Infection Control
    deficiency_tag VARCHAR(10),                 -- F-tag or K-tag
    deficiency_description TEXT,
    scope_severity VARCHAR(10),                 -- A-L scope/severity grid
    correction_date DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ds_extract ON deficiency_snapshots(extract_id);
CREATE INDEX IF NOT EXISTS idx_ds_ccn ON deficiency_snapshots(ccn);
CREATE INDEX IF NOT EXISTS idx_ds_survey_date ON deficiency_snapshots(survey_date);
CREATE INDEX IF NOT EXISTS idx_ds_tag ON deficiency_snapshots(deficiency_tag);

-- ============================================================
-- LAYER 2: DERIVED EVENTS
-- Changes detected between consecutive extracts
-- ============================================================

CREATE TABLE IF NOT EXISTS facility_events (
    event_id SERIAL PRIMARY KEY,
    ccn VARCHAR(10) NOT NULL,
    event_type VARCHAR(50) NOT NULL,            -- See event types below
    event_date DATE NOT NULL,                   -- Date event was detected

    -- Link to extracts where change was detected
    previous_extract_id INTEGER REFERENCES cms_extracts(extract_id),
    current_extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),

    -- Event details (flexible JSON for different event types)
    previous_value TEXT,
    new_value TEXT,
    change_magnitude DECIMAL(10,4),             -- For numeric changes

    -- Context
    state VARCHAR(2),
    county VARCHAR(100),
    chain_id VARCHAR(20),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event Types:
-- RATING_CHANGE: overall, health, staffing, qm rating went up/down
-- OWNERSHIP_CHANGE: facility changed hands
-- PENALTY_ISSUED: new fine or payment denial
-- SFF_DESIGNATED: became Special Focus Facility
-- SFF_GRADUATED: removed from SFF status
-- ABUSE_ICON_ADDED: abuse icon appeared
-- ABUSE_ICON_REMOVED: abuse icon removed
-- FACILITY_OPENED: new facility appeared in data
-- FACILITY_CLOSED: facility no longer in data
-- STAFFING_DROP: significant staffing decrease
-- STAFFING_IMPROVEMENT: significant staffing increase
-- SURVEY_COMPLETED: new survey on record
-- DEFICIENCY_SPIKE: unusual increase in deficiencies

CREATE INDEX IF NOT EXISTS idx_fe_ccn ON facility_events(ccn);
CREATE INDEX IF NOT EXISTS idx_fe_type ON facility_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fe_date ON facility_events(event_date);
CREATE INDEX IF NOT EXISTS idx_fe_state ON facility_events(state);
CREATE INDEX IF NOT EXISTS idx_fe_chain ON facility_events(chain_id);
CREATE INDEX IF NOT EXISTS idx_fe_ccn_type ON facility_events(ccn, event_type);

-- Market-level events (aggregated from facility events)
CREATE TABLE IF NOT EXISTS market_events (
    event_id SERIAL PRIMARY KEY,
    cbsa_code VARCHAR(5),                       -- NULL for rural/statewide
    state VARCHAR(2) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_date DATE NOT NULL,

    extract_id INTEGER NOT NULL REFERENCES cms_extracts(extract_id),

    -- Event details
    facility_count INTEGER,                     -- Facilities affected
    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market Event Types:
-- CAPACITY_CHANGE: net beds added/removed
-- CHAIN_ENTRY: new chain entered market
-- CHAIN_EXIT: chain left market
-- QUALITY_TREND: market average rating shift
-- PENALTY_CLUSTER: multiple facilities penalized

CREATE INDEX IF NOT EXISTS idx_me_cbsa ON market_events(cbsa_code);
CREATE INDEX IF NOT EXISTS idx_me_state ON market_events(state);
CREATE INDEX IF NOT EXISTS idx_me_type ON market_events(event_type);
CREATE INDEX IF NOT EXISTS idx_me_date ON market_events(event_date);

-- ============================================================
-- LAYER 3: AGGREGATED METRICS
-- Monthly/quarterly roll-ups for trending
-- ============================================================

-- Facility monthly metrics (derived from snapshots)
CREATE TABLE IF NOT EXISTS facility_monthly_metrics (
    metric_id SERIAL PRIMARY KEY,
    ccn VARCHAR(10) NOT NULL,
    month_date DATE NOT NULL,                   -- First of month (e.g., 2025-11-01)

    -- Ratings
    overall_rating INTEGER,
    health_rating INTEGER,
    staffing_rating INTEGER,
    qm_rating INTEGER,

    -- Staffing
    total_nurse_hrs DECIMAL(6,3),
    rn_hrs DECIMAL(6,3),
    case_mix_index DECIMAL(6,4),

    -- Operations
    occupancy_rate DECIMAL(5,2),
    certified_beds INTEGER,

    -- Quality (selected key measures)
    falls_with_major_injury_pct DECIMAL(6,2),
    pressure_ulcers_pct DECIMAL(6,2),
    rehospitalization_rate DECIMAL(6,2),

    -- Compliance
    total_deficiencies INTEGER,
    fines_ytd DECIMAL(12,2),

    -- Computed trends (vs prior month)
    rating_trend INTEGER,                       -- -1, 0, +1
    staffing_trend INTEGER,
    occupancy_trend INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ccn, month_date)
);

CREATE INDEX IF NOT EXISTS idx_fmm_ccn ON facility_monthly_metrics(ccn);
CREATE INDEX IF NOT EXISTS idx_fmm_month ON facility_monthly_metrics(month_date);
CREATE INDEX IF NOT EXISTS idx_fmm_ccn_month ON facility_monthly_metrics(ccn, month_date);

-- Market monthly metrics (CBSA or state level)
CREATE TABLE IF NOT EXISTS market_monthly_metrics (
    metric_id SERIAL PRIMARY KEY,
    cbsa_code VARCHAR(5),                       -- NULL for state-level rural aggregation
    state VARCHAR(2) NOT NULL,
    month_date DATE NOT NULL,

    -- Capacity
    total_facilities INTEGER,
    total_beds INTEGER,
    avg_occupancy DECIMAL(5,2),

    -- Quality Averages
    avg_overall_rating DECIMAL(3,2),
    avg_health_rating DECIMAL(3,2),
    avg_staffing_rating DECIMAL(3,2),
    pct_4_5_star DECIMAL(5,2),                  -- Percentage 4+ star
    pct_1_2_star DECIMAL(5,2),                  -- Percentage 1-2 star

    -- Staffing Averages
    avg_total_nurse_hrs DECIMAL(6,3),
    avg_rn_hrs DECIMAL(6,3),

    -- Compliance
    avg_deficiencies DECIMAL(6,2),
    facilities_with_fines INTEGER,
    total_fines DECIMAL(12,2),

    -- Competition
    chain_facility_count INTEGER,
    independent_count INTEGER,
    hhi_index DECIMAL(8,4),                     -- Market concentration

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(cbsa_code, state, month_date)
);

CREATE INDEX IF NOT EXISTS idx_mmm_cbsa ON market_monthly_metrics(cbsa_code);
CREATE INDEX IF NOT EXISTS idx_mmm_state ON market_monthly_metrics(state);
CREATE INDEX IF NOT EXISTS idx_mmm_month ON market_monthly_metrics(month_date);

-- ============================================================
-- LAYER 4: FEATURE STORE
-- Pre-computed features for ML models
-- ============================================================

CREATE TABLE IF NOT EXISTS facility_features (
    feature_id SERIAL PRIMARY KEY,
    ccn VARCHAR(10) NOT NULL,
    as_of_date DATE NOT NULL,                   -- Feature snapshot date

    -- Trend Features (6-month lookback)
    rating_momentum_6m DECIMAL(6,3),            -- Average rating change
    staffing_stability_6m DECIMAL(6,3),         -- Staffing volatility
    deficiency_trend_6m DECIMAL(6,3),           -- Deficiency trajectory

    -- Leading Indicators
    admin_turnover_12m INTEGER,
    ownership_changes_24m INTEGER,
    sff_history BOOLEAN,                        -- Ever been SFF

    -- Market Position
    rating_vs_market DECIMAL(6,3),              -- Deviation from market avg
    staffing_vs_market DECIMAL(6,3),
    market_share_pct DECIMAL(6,3),

    -- Chain Features
    chain_size INTEGER,
    chain_avg_rating DECIMAL(3,2),
    chain_geographic_spread INTEGER,            -- States present

    -- Risk Signals
    recent_penalties_12m INTEGER,
    complaint_trend DECIMAL(6,3),
    infection_control_issues BOOLEAN,

    -- Demographic Context
    county_senior_growth_rate DECIMAL(6,2),
    market_beds_per_1000_seniors DECIMAL(8,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ccn, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_ff_ccn ON facility_features(ccn);
CREATE INDEX IF NOT EXISTS idx_ff_date ON facility_features(as_of_date);

-- ============================================================
-- LAYER 5: PREDICTIONS & INSIGHTS
-- Model outputs and actionable insights
-- ============================================================

-- Facility risk/opportunity scores
CREATE TABLE IF NOT EXISTS facility_predictions (
    prediction_id SERIAL PRIMARY KEY,
    ccn VARCHAR(10) NOT NULL,
    prediction_date DATE NOT NULL,
    model_version VARCHAR(20),

    -- Risk Scores (0-100)
    downgrade_risk_score INTEGER,               -- Risk of rating drop
    penalty_risk_score INTEGER,                 -- Risk of new penalties
    closure_risk_score INTEGER,                 -- Risk of facility closure

    -- Opportunity Scores (0-100)
    improvement_potential INTEGER,              -- Potential for rating improvement
    acquisition_attractiveness INTEGER,         -- M&A target score

    -- Confidence
    confidence_level DECIMAL(4,2),

    -- Key Drivers (JSON array of top factors)
    risk_drivers JSONB,
    opportunity_drivers JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ccn, prediction_date, model_version)
);

CREATE INDEX IF NOT EXISTS idx_fp_ccn ON facility_predictions(ccn);
CREATE INDEX IF NOT EXISTS idx_fp_date ON facility_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_fp_risk ON facility_predictions(downgrade_risk_score DESC);

-- Market opportunities
CREATE TABLE IF NOT EXISTS market_opportunities (
    opportunity_id SERIAL PRIMARY KEY,
    cbsa_code VARCHAR(5),
    state VARCHAR(2) NOT NULL,
    identified_date DATE NOT NULL,

    opportunity_type VARCHAR(50),               -- UNDERSERVED, CONSOLIDATION, QUALITY_GAP
    score INTEGER,                              -- 0-100 opportunity score

    -- Details
    description TEXT,
    supporting_metrics JSONB,

    -- Expiry (opportunities may become stale)
    valid_until DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mo_cbsa ON market_opportunities(cbsa_code);
CREATE INDEX IF NOT EXISTS idx_mo_state ON market_opportunities(state);
CREATE INDEX IF NOT EXISTS idx_mo_type ON market_opportunities(opportunity_type);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Latest facility data (most recent snapshot)
CREATE OR REPLACE VIEW current_facility_data AS
SELECT fs.*
FROM facility_snapshots fs
INNER JOIN (
    SELECT ccn, MAX(extract_id) as max_extract_id
    FROM facility_snapshots
    GROUP BY ccn
) latest ON fs.ccn = latest.ccn AND fs.extract_id = latest.max_extract_id;

-- Facility timeline (all snapshots for a facility)
CREATE OR REPLACE VIEW facility_timeline AS
SELECT
    fs.ccn,
    e.extract_date,
    fs.provider_name,
    fs.overall_rating,
    fs.health_inspection_rating,
    fs.staffing_rating,
    fs.qm_rating,
    fs.reported_total_nurse_hrs,
    fs.fine_total_dollars,
    fs.total_penalty_count,
    fs.chain_name,
    fs.special_focus_status
FROM facility_snapshots fs
JOIN cms_extracts e ON fs.extract_id = e.extract_id
ORDER BY fs.ccn, e.extract_date;

-- Recent facility events
CREATE OR REPLACE VIEW recent_facility_events AS
SELECT
    fe.*,
    fs.provider_name,
    fs.overall_rating as current_rating
FROM facility_events fe
JOIN current_facility_data fs ON fe.ccn = fs.ccn
WHERE fe.event_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY fe.event_date DESC;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE cms_extracts IS 'Tracks imported CMS data extracts for data lineage';
COMMENT ON TABLE facility_snapshots IS 'Point-in-time facility data from each CMS extract';
COMMENT ON TABLE quality_snapshots IS 'MDS quality measure scores from each extract';
COMMENT ON TABLE facility_events IS 'Detected changes between consecutive extracts';
COMMENT ON TABLE facility_monthly_metrics IS 'Monthly aggregated facility metrics for trending';
COMMENT ON TABLE market_monthly_metrics IS 'Monthly market-level metrics by CBSA or state';
COMMENT ON TABLE facility_features IS 'Pre-computed ML features for each facility';
COMMENT ON TABLE facility_predictions IS 'Model predictions and risk/opportunity scores';
COMMENT ON TABLE market_opportunities IS 'Identified market opportunities for M&A';
