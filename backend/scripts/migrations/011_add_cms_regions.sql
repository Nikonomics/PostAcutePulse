-- Migration 011: Add CMS Regions
-- Maps states to CMS regions for regional comparisons

-- Add region columns to state tables
ALTER TABLE state_demographics
ADD COLUMN IF NOT EXISTS cms_region INTEGER,
ADD COLUMN IF NOT EXISTS cms_region_name VARCHAR(50);

-- CMS Region Mapping (based on CMS regional office structure)
-- Region 1: Boston (CT, MA, ME, NH, RI, VT)
UPDATE state_demographics SET cms_region = 1, cms_region_name = 'Boston' WHERE state_code IN ('CT', 'MA', 'ME', 'NH', 'RI', 'VT');

-- Region 2: New York (NJ, NY)
UPDATE state_demographics SET cms_region = 2, cms_region_name = 'New York' WHERE state_code IN ('NJ', 'NY');

-- Region 3: Philadelphia (DE, DC, MD, PA, VA, WV)
UPDATE state_demographics SET cms_region = 3, cms_region_name = 'Philadelphia' WHERE state_code IN ('DE', 'DC', 'MD', 'PA', 'VA', 'WV');

-- Region 4: Atlanta (AL, FL, GA, KY, MS, NC, SC, TN)
UPDATE state_demographics SET cms_region = 4, cms_region_name = 'Atlanta' WHERE state_code IN ('AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN');

-- Region 5: Chicago (IL, IN, MI, MN, OH, WI)
UPDATE state_demographics SET cms_region = 5, cms_region_name = 'Chicago' WHERE state_code IN ('IL', 'IN', 'MI', 'MN', 'OH', 'WI');

-- Region 6: Dallas (AR, LA, NM, OK, TX)
UPDATE state_demographics SET cms_region = 6, cms_region_name = 'Dallas' WHERE state_code IN ('AR', 'LA', 'NM', 'OK', 'TX');

-- Region 7: Kansas City (IA, KS, MO, NE)
UPDATE state_demographics SET cms_region = 7, cms_region_name = 'Kansas City' WHERE state_code IN ('IA', 'KS', 'MO', 'NE');

-- Region 8: Denver (CO, MT, ND, SD, UT, WY)
UPDATE state_demographics SET cms_region = 8, cms_region_name = 'Denver' WHERE state_code IN ('CO', 'MT', 'ND', 'SD', 'UT', 'WY');

-- Region 9: San Francisco (AZ, CA, HI, NV)
UPDATE state_demographics SET cms_region = 9, cms_region_name = 'San Francisco' WHERE state_code IN ('AZ', 'CA', 'HI', 'NV');

-- Region 10: Seattle (AK, ID, OR, WA)
UPDATE state_demographics SET cms_region = 10, cms_region_name = 'Seattle' WHERE state_code IN ('AK', 'ID', 'OR', 'WA');

-- Create index for regional queries
CREATE INDEX IF NOT EXISTS idx_state_demographics_cms_region ON state_demographics(cms_region);

-- Create view for regional statistics
CREATE OR REPLACE VIEW regional_market_stats AS
SELECT
  sd.cms_region,
  sd.cms_region_name,
  COUNT(DISTINCT sd.state_code) as states_in_region,
  SUM(sd.population_65_plus) as total_population_65_plus,
  SUM(sd.population_85_plus) as total_population_85_plus,
  SUM(smm.total_facilities) as total_facilities,
  SUM(smm.total_beds) as total_beds,
  AVG(smm.avg_overall_rating) as avg_overall_rating,
  AVG(smm.average_occupancy_rate) as avg_occupancy_rate,
  AVG(smm.avg_health_deficiencies) as avg_deficiencies,
  ROUND(SUM(smm.total_beds)::numeric / NULLIF(SUM(sd.population_65_plus), 0) * 1000, 2) as beds_per_1000_seniors
FROM state_demographics sd
LEFT JOIN state_market_metrics smm ON sd.state_code = smm.state_code
WHERE sd.cms_region IS NOT NULL
GROUP BY sd.cms_region, sd.cms_region_name
ORDER BY sd.cms_region;

COMMENT ON VIEW regional_market_stats IS 'Regional aggregation of SNF market metrics by CMS region';
