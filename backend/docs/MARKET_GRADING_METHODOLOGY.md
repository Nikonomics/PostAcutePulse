# Market Grading Methodology

**Session Date:** 2025-12-30
**Status:** Documentation backup - needs consolidation into collector scripts

This document captures the methodology used to calculate market opportunity scores and grades for PostAcutePulse. The logic below was run via ad-hoc SQL and needs to be converted into reusable collector scripts.

---

## 1. HUD ZIP-to-CBSA Crosswalk

### Source Data
- File: `/Users/nikolashulewsky/Desktop/ZIP_CBSA_092025.xlsx`
- Source: HUD (Department of Housing and Urban Development)
- Contains: 47,634 ZIP-to-CBSA mappings with allocation ratios

### Table Creation

```sql
CREATE TABLE hud_zip_cbsa (
  zip5 VARCHAR(5) PRIMARY KEY,
  cbsa_code VARCHAR(5),
  city VARCHAR(100),
  state VARCHAR(2),
  ratio NUMERIC(10,6)
);
```

### Data Loading Logic
- For ZIPs that span multiple CBSAs, select the one with highest `TOT_RATIO`
- CBSA code `99999` = rural (no CBSA assignment) - stored as NULL
- **Result:** 39,482 unique ZIPs (30,501 with CBSA, 8,981 rural)

### Coverage
All 50 states + DC + PR + territories covered:
- CT: 402 ZIPs
- LA: 666 ZIPs
- PR: 167 ZIPs
- AK: 263 ZIPs
- DC: 236 ZIPs

---

## 2. Facility CBSA Assignment

All facility types assigned CBSA based on their headquarters ZIP code using the HUD crosswalk.

### SNF Facilities

```sql
UPDATE snf_facilities f
SET cbsa_code = h.cbsa_code
FROM hud_zip_cbsa h
WHERE LEFT(f.zip_code, 5) = h.zip5;
```

**Result:** 14,727 facilities updated, 922 unique CBSAs

### ALF Facilities

```sql
UPDATE alf_facilities f
SET cbsa_code = h.cbsa_code
FROM hud_zip_cbsa h
WHERE LEFT(f.zip_code, 5) = h.zip5;
```

**Result:** 42,374 facilities updated, 894 unique CBSAs

### HHA Providers

```sql
UPDATE hh_provider_snapshots h
SET cbsa_code = hud.cbsa_code
FROM hud_zip_cbsa hud
WHERE h.extract_id = 1
  AND LEFT(h.zip_code, 5) = hud.zip5;
```

**Result:** 12,143 providers updated, 787 unique CBSAs

---

## 3. Market Metrics Aggregation

### Table: `market_metrics`

Aggregates facility counts, capacity, and quality metrics per CBSA.

### SNF Metrics per CBSA

```sql
INSERT INTO market_metrics (geography_type, geography_id, snf_facility_count, snf_total_beds, ...)
SELECT
  'cbsa',
  cbsa_code,
  COUNT(*) as snf_facility_count,
  SUM(number_of_certified_beds) as snf_total_beds,
  ROUND(AVG(overall_rating), 2) as snf_avg_overall_rating,
  ROUND(AVG(rn_staffing_hours), 2) as snf_avg_rn_hours,
  ROUND(AVG(occupancy_rate), 2) as snf_avg_occupancy
FROM snf_facilities
WHERE cbsa_code IS NOT NULL
GROUP BY cbsa_code;
```

### ALF Metrics per CBSA

```sql
UPDATE market_metrics mm
SET
  alf_facility_count = agg.facility_count,
  alf_total_capacity = agg.total_capacity
FROM (
  SELECT cbsa_code, COUNT(*) as facility_count, SUM(capacity) as total_capacity
  FROM alf_facilities
  WHERE cbsa_code IS NOT NULL
  GROUP BY cbsa_code
) agg
WHERE mm.geography_id = agg.cbsa_code AND mm.geography_type = 'cbsa';
```

### HHA Metrics per CBSA (HQ-based)

```sql
UPDATE market_metrics mm
SET
  hha_agency_count = agg.agency_count,
  hha_total_episodes = agg.total_episodes,
  hha_avg_star_rating = agg.avg_rating
FROM (
  SELECT
    cbsa_code,
    COUNT(*) as agency_count,
    SUM(total_episodes_fy) as total_episodes,
    ROUND(AVG(quality_of_patient_care_star_rating), 2) as avg_rating
  FROM hh_provider_snapshots
  WHERE extract_id = 1 AND cbsa_code IS NOT NULL
  GROUP BY cbsa_code
) agg
WHERE mm.geography_id = agg.cbsa_code AND mm.geography_type = 'cbsa';
```

### Demographics per CBSA

```sql
UPDATE market_metrics mm
SET
  pop_65_plus = cd.population_65_plus,
  pop_85_plus = cd.population_85_plus,
  median_household_income = cd.median_household_income,
  snf_beds_per_1k_65 = ROUND(mm.snf_total_beds::numeric / NULLIF(cd.population_65_plus, 0) * 1000, 2)
FROM county_demographics cd
WHERE mm.geography_id = cd.cbsa_code AND mm.geography_type = 'cbsa';
```

---

## 4. SNF Opportunity Score

### Methodology: Percentile-based

Higher scores = better opportunity (underserved, growing, quality gaps)

### Step 1: Calculate Percentiles

```sql
WITH pctls AS (
  SELECT
    geography_id,
    -- Lower beds per 1K = underserved = higher opportunity (invert)
    ROUND((1 - PERCENT_RANK() OVER (ORDER BY snf_beds_per_1k_65)) * 100::numeric, 1) as beds_pctl,
    -- Lower occupancy = room for growth = higher opportunity (invert)
    ROUND((1 - PERCENT_RANK() OVER (ORDER BY snf_avg_occupancy)) * 100::numeric, 1) as occupancy_pctl,
    -- Lower quality = improvement opportunity = higher opportunity (invert)
    ROUND((1 - PERCENT_RANK() OVER (ORDER BY snf_avg_overall_rating)) * 100::numeric, 1) as quality_pctl,
    -- Higher growth = better opportunity
    ROUND((PERCENT_RANK() OVER (ORDER BY projected_growth_65_2030)) * 100::numeric, 1) as growth_pctl
  FROM market_metrics
  WHERE geography_type = 'cbsa' AND snf_facility_count IS NOT NULL
)
UPDATE market_metrics mm
SET
  snf_beds_per_1k_65_pctl = p.beds_pctl,
  snf_occupancy_pctl = p.occupancy_pctl,
  snf_avg_rating_pctl = p.quality_pctl,
  pop_65_growth_pctl = p.growth_pctl
FROM pctls p
WHERE mm.geography_id = p.geography_id AND mm.geography_type = 'cbsa';
```

### Step 2: Calculate Opportunity Score

```sql
UPDATE market_metrics
SET snf_opportunity_score = ROUND(
  (COALESCE(snf_beds_per_1k_65_pctl, 50) * 0.3 +      -- 30% capacity gap
   COALESCE(snf_occupancy_pctl, 50) * 0.2 +           -- 20% occupancy opportunity
   COALESCE(snf_avg_rating_pctl, 50) * 0.2 +          -- 20% quality gap
   COALESCE(pop_65_growth_pctl, 50) * 0.3)::numeric,  -- 30% growth
  1
)
WHERE geography_type = 'cbsa';
```

**Weights:**
- Capacity gap (beds per 1K 65+): 30%
- Occupancy opportunity: 20%
- Quality improvement opportunity: 20%
- Population growth: 30%

---

## 5. ALF Opportunity Score

### Methodology: Percentile-based

```sql
WITH pctls AS (
  SELECT
    geography_id,
    -- Lower beds per 1K = underserved = higher opportunity (invert)
    ROUND((1 - PERCENT_RANK() OVER (ORDER BY alf_beds_per_1k_65)) * 100::numeric, 1) as underserved_pctl
  FROM market_metrics
  WHERE geography_type = 'cbsa' AND alf_facility_count IS NOT NULL
)
UPDATE market_metrics mm
SET alf_opportunity_score = ROUND(
  (p.underserved_pctl * 0.5 +                         -- 50% capacity gap
   COALESCE(mm.pop_65_growth_pctl, 50) * 0.3 +        -- 30% growth
   COALESCE(mm.private_pay_pctl, 50) * 0.2)::numeric, -- 20% affluence
  1
)
FROM pctls p
WHERE mm.geography_id = p.geography_id AND mm.geography_type = 'cbsa';
```

**Weights:**
- Capacity gap (beds per 1K 65+): 50%
- Population growth: 30%
- Private pay potential (income): 20%

---

## 6. HHA Opportunity Score (This Session - HQ Based)

**NOTE:** This was superseded by Chat 1's service-area methodology. See `backend/scripts/update-hha-opportunity-scores.js` for the preferred approach.

### Original HQ-based approach (deprecated):

```sql
UPDATE market_metrics
SET hha_opportunity_score = ROUND(
  (COALESCE(hha_agencies_per_100k_pctl, 50) * 0.4 +
   COALESCE(hha_quality_pctl, 50) * 0.3 +
   COALESCE(pop_65_growth_pctl, 50) * 0.3)::numeric, 1
)
WHERE geography_type = 'cbsa';
```

---

## 7. Grade Assignment

### This Session's Thresholds (Simple A-F)

```sql
UPDATE market_metrics
SET snf_grade = CASE
  WHEN snf_opportunity_score >= 80 THEN 'A'
  WHEN snf_opportunity_score >= 60 THEN 'B'
  WHEN snf_opportunity_score >= 40 THEN 'C'
  WHEN snf_opportunity_score >= 20 THEN 'D'
  ELSE 'F'
END
WHERE geography_type = 'cbsa' AND snf_opportunity_score IS NOT NULL;
```

### Chat 1's Thresholds (Plus/Minus Grades) - PREFERRED

```javascript
if (score >= 95) return 'A+';
if (score >= 90) return 'A';
if (score >= 85) return 'A-';
if (score >= 80) return 'B+';
if (score >= 75) return 'B';
if (score >= 70) return 'B-';
if (score >= 65) return 'C+';
if (score >= 60) return 'C';
if (score >= 55) return 'C-';
if (score >= 50) return 'D+';
if (score >= 45) return 'D';
if (score >= 40) return 'D-';
return 'F';
```

---

## 8. Overall PAC Score

```sql
UPDATE market_grades
SET overall_pac_score = ROUND(
  (COALESCE(snf_opportunity_score, 50) * 0.40) +
  (COALESCE(alf_opportunity_score, 50) * 0.30) +
  (COALESCE(hha_opportunity_score, 50) * 0.30)
, 2)
WHERE geography_type = 'cbsa';
```

**Weights:**
- SNF: 40%
- ALF: 30%
- HHA: 30%
- Missing scores default to 50

---

## 9. Current State Summary

| Metric | Value |
|--------|-------|
| Total CBSAs in market_metrics | 928 |
| CBSAs with SNF data | 922 |
| CBSAs with ALF data | 890 |
| CBSAs with HHA data | 787 (HQ-based) / 935 (service-area) |
| CBSAs with all three | 758 |

---

## 10. Known Issues & TODOs

1. **Methodology inconsistency:** SNF/ALF use percentile-based scoring, HHA uses absolute thresholds
2. **Grade scale inconsistency:** SNF/ALF use simple A-F, HHA uses plus/minus
3. **HHA methodology:** Service-area approach (Chat 1) is more accurate than HQ-based (this session)
4. **Missing scripts:** Need to create reusable collector scripts for SNF and ALF scoring
5. **7 missing CBSAs:** 935 in `cbsas` table but only 928 in `market_grades`

---

## 11. Recommended Consolidation

Create these collector scripts:
1. `rebuild-market-metrics.js` - Aggregate facility data per CBSA
2. `update-snf-opportunity-scores.js` - SNF scoring (match HHA pattern)
3. `update-alf-opportunity-scores.js` - ALF scoring (match HHA pattern)
4. `update-hha-opportunity-scores.js` - Already exists (Chat 1)
5. `calculate-overall-pac-scores.js` - Final weighted combination

All scripts should use consistent:
- Scoring methodology (absolute thresholds vs percentile)
- Grade scale (plus/minus)
- Default handling for missing data
