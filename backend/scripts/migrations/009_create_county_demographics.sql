-- Migration 009: Create County Demographics Table
-- Add county-level demographic data for more granular geographic analysis

CREATE TABLE IF NOT EXISTS county_demographics (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    county_fips VARCHAR(5) NOT NULL UNIQUE,
    county_name VARCHAR(100) NOT NULL,

    -- Population data
    total_population BIGINT,
    population_65_plus BIGINT,
    population_85_plus BIGINT,
    percent_65_plus DECIMAL(5,2),
    percent_85_plus DECIMAL(5,2),

    -- Growth projections (estimated)
    projected_65_plus_2030 BIGINT,
    projected_85_plus_2030 BIGINT,
    growth_rate_65_plus DECIMAL(5,2),
    growth_rate_85_plus DECIMAL(5,2),

    -- Metadata
    data_source VARCHAR(255) DEFAULT 'US Census Bureau',
    data_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_county_demographics_state_code ON county_demographics(state_code);
CREATE INDEX IF NOT EXISTS idx_county_demographics_county_fips ON county_demographics(county_fips);
CREATE INDEX IF NOT EXISTS idx_county_demographics_state_county ON county_demographics(state_code, county_name);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_county_demographics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER county_demographics_updated_at
    BEFORE UPDATE ON county_demographics
    FOR EACH ROW
    EXECUTE FUNCTION update_county_demographics_updated_at();

-- Add comment
COMMENT ON TABLE county_demographics IS 'County-level demographic data including senior population statistics';
