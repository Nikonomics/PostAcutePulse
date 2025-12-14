-- Ownership Profiles table
-- Pre-computed aggregates for SNF parent organizations with 2+ facilities
-- Refreshed periodically via script

CREATE TABLE IF NOT EXISTS ownership_profiles (
    id SERIAL PRIMARY KEY,
    parent_organization VARCHAR(255) NOT NULL UNIQUE,

    -- Facility counts
    facility_count INTEGER NOT NULL DEFAULT 0,
    total_beds INTEGER DEFAULT 0,
    total_certified_beds INTEGER DEFAULT 0,

    -- Geographic spread
    states_operated TEXT[],  -- Array of state codes
    state_count INTEGER DEFAULT 0,
    cbsa_count INTEGER DEFAULT 0,

    -- Ratings (averages across facilities)
    avg_overall_rating DECIMAL(3,2),
    avg_health_inspection_rating DECIMAL(3,2),
    avg_quality_measure_rating DECIMAL(3,2),
    avg_staffing_rating DECIMAL(3,2),

    -- Rating distribution
    five_star_count INTEGER DEFAULT 0,
    four_star_count INTEGER DEFAULT 0,
    three_star_count INTEGER DEFAULT 0,
    two_star_count INTEGER DEFAULT 0,
    one_star_count INTEGER DEFAULT 0,

    -- Occupancy
    avg_occupancy_rate DECIMAL(5,2),
    total_occupied_beds INTEGER DEFAULT 0,

    -- Staffing
    avg_rn_staffing_hours DECIMAL(6,2),
    avg_total_nurse_staffing_hours DECIMAL(6,2),

    -- Deficiencies (aggregated)
    total_health_deficiencies INTEGER DEFAULT 0,
    total_fire_safety_deficiencies INTEGER DEFAULT 0,
    avg_health_deficiencies_per_facility DECIMAL(5,2),

    -- Penalties
    total_penalties_amount DECIMAL(14,2) DEFAULT 0,
    total_penalty_count INTEGER DEFAULT 0,

    -- Ownership type breakdown
    for_profit_count INTEGER DEFAULT 0,
    non_profit_count INTEGER DEFAULT 0,
    government_count INTEGER DEFAULT 0,

    -- Metadata
    last_refreshed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ownership_facility_count ON ownership_profiles(facility_count DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_total_beds ON ownership_profiles(total_beds DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_avg_rating ON ownership_profiles(avg_overall_rating DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_state_count ON ownership_profiles(state_count DESC);

-- Full text search on organization name
CREATE INDEX IF NOT EXISTS idx_ownership_name_search ON ownership_profiles USING gin(to_tsvector('english', parent_organization));

COMMENT ON TABLE ownership_profiles IS 'Pre-computed aggregates for SNF parent organizations with 2+ facilities';
