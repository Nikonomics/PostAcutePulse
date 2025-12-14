-- BLS OEWS State-level wages by occupation
-- Source: Bureau of Labor Statistics Occupational Employment and Wage Statistics
-- https://www.bls.gov/oes/

CREATE TABLE IF NOT EXISTS bls_state_wages (
    wage_id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(50) NOT NULL,
    occupation_code VARCHAR(10) NOT NULL,
    occupation_title VARCHAR(200) NOT NULL,
    employment INTEGER,
    hourly_mean_wage DECIMAL(8,2),
    hourly_10_pct DECIMAL(8,2),
    hourly_25_pct DECIMAL(8,2),
    hourly_median DECIMAL(8,2),
    hourly_75_pct DECIMAL(8,2),
    hourly_90_pct DECIMAL(8,2),
    annual_mean_wage INTEGER,
    data_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(state_code, occupation_code, data_year)
);

CREATE INDEX IF NOT EXISTS idx_bls_state ON bls_state_wages(state_code);
CREATE INDEX IF NOT EXISTS idx_bls_occupation ON bls_state_wages(occupation_code);
CREATE INDEX IF NOT EXISTS idx_bls_year ON bls_state_wages(data_year);

-- Add comment to table
COMMENT ON TABLE bls_state_wages IS 'BLS OEWS state-level wage data for healthcare occupations relevant to SNF operations';
