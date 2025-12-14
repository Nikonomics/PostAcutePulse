-- CBSAs (Core Based Statistical Areas) - the market definitions
CREATE TABLE IF NOT EXISTS cbsas (
    cbsa_code VARCHAR(5) PRIMARY KEY,
    cbsa_title VARCHAR(255) NOT NULL,
    cbsa_type VARCHAR(20) NOT NULL,  -- 'Metropolitan' or 'Micropolitan'
    csa_code VARCHAR(5),              -- Combined Statistical Area (if part of larger metro complex)
    csa_title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- County-to-CBSA crosswalk - maps every county to its market
CREATE TABLE IF NOT EXISTS county_cbsa_crosswalk (
    county_fips VARCHAR(5) PRIMARY KEY,
    county_name VARCHAR(100) NOT NULL,
    state_fips VARCHAR(2) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    cbsa_code VARCHAR(5),              -- NULL for rural counties not in any CBSA
    cbsa_title VARCHAR(255),
    is_central_county BOOLEAN DEFAULT FALSE,
    metropolitan_division_code VARCHAR(5),
    metropolitan_division_title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_county_cbsa ON county_cbsa_crosswalk(cbsa_code);
CREATE INDEX IF NOT EXISTS idx_county_state ON county_cbsa_crosswalk(state_code);

-- CMS SNF PPS Wage Index by CBSA/State
CREATE TABLE IF NOT EXISTS cms_wage_index (
    wage_index_id SERIAL PRIMARY KEY,
    cbsa_code VARCHAR(5),              -- For urban areas
    state_code VARCHAR(2),             -- For rural areas (state-level rural index)
    area_name VARCHAR(255) NOT NULL,
    wage_index DECIMAL(6,4) NOT NULL,  -- e.g., 1.0234 = 2.34% above national
    is_urban BOOLEAN NOT NULL,         -- TRUE = urban CBSA, FALSE = rural state
    fiscal_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(cbsa_code, state_code, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_wage_cbsa ON cms_wage_index(cbsa_code);
CREATE INDEX IF NOT EXISTS idx_wage_state ON cms_wage_index(state_code);
CREATE INDEX IF NOT EXISTS idx_wage_fy ON cms_wage_index(fiscal_year);

-- Add comments
COMMENT ON TABLE cbsas IS 'Core Based Statistical Areas - Census Bureau market definitions';
COMMENT ON TABLE county_cbsa_crosswalk IS 'Mapping of US counties to their CBSA markets';
COMMENT ON TABLE cms_wage_index IS 'CMS SNF PPS wage index by market (urban CBSA or rural state)';
