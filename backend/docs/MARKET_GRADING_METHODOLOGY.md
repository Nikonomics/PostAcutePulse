# Market Grading Methodology

**Last Updated:** 2025-01-05
**Status:** Active - All scoring scripts implemented (including Hospice)

This document captures the methodology used to calculate market opportunity scores and grades for PostAcutePulse. All scoring logic has been consolidated into reusable collector scripts in `backend/scripts/`.

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

## 6. HHA Opportunity Score (Current Implementation)

**Script:** `backend/scripts/generate-hha-market-opportunity-scores.js`
**Output Table:** `hha_market_opportunity_scores`

### Methodology: Percentile-Based with 6 Components

All metrics are converted to percentiles (0-100) using `PERCENT_RANK()`, then weighted and combined.

### Component Weights

| Component | Weight | What It Measures |
|-----------|--------|------------------|
| Referral Opportunity | 30% | SNF discharges available per HHA agency |
| Supply Gap | 25% | Agencies per 100K 65+ population (inverse) |
| Capacity Strain | 20% | Timely care initiation rate (inverse) |
| Quality Gap | 10% | Average star ratings + % low-quality agencies |
| Market Dynamics | 10% | Net agency change over 12 months |
| Competition | 5% | Market concentration (HHI, inverse) |

### Percentile Direction

- **Direct percentile** (higher = more opportunity): `PERCENT_RANK() OVER (ORDER BY metric)`
- **Inverse percentile** (lower = more opportunity): `(1 - PERCENT_RANK() OVER (ORDER BY metric)) * 100`

| Metric | Percentile Direction | Rationale |
|--------|---------------------|-----------|
| SNF discharges per agency | Direct | More discharges = more referral opportunity |
| Throughput capture ratio | Inverse | Lower capture = unmet demand |
| HHA per 100K 65+ | Inverse | Fewer agencies = supply gap |
| Timely initiation rate | Inverse | Lower = agencies at capacity |
| Average star rating | Inverse | Lower = quality improvement opportunity |
| % 1-2 star agencies | Direct | More low-quality = opportunity to outperform |
| Net agency change | Direct | Growth signals market opportunity |
| HHI concentration | Inverse | Lower = easier market entry |

### Score Calculation

```javascript
// Component 1: Referral Opportunity (30%)
referralScore = (discharges_pctl * 0.50) + (capture_inv_pctl * 0.50)

// Component 2: Supply Gap (25%)
supplyGapScore = supply_gap_pctl

// Component 3: Capacity Strain (20%)
capacityStrainScore = timely_inv_pctl

// Component 4: Quality Gap (10%)
qualityGapScore = (rating_inv_pctl * 0.50) + (low_quality_pctl * 0.50)

// Component 5: Market Dynamics (10%)
marketDynamicsScore = dynamics_pctl

// Component 6: Competition (5%)
competitionScore = competition_pctl

// Final Score
finalScore = (referralScore * 0.30) +
             (supplyGapScore * 0.25) +
             (capacityStrainScore * 0.20) +
             (qualityGapScore * 0.10) +
             (marketDynamicsScore * 0.10) +
             (competitionScore * 0.05)
```

### Grading: Percentile-Based Distribution

Grades are assigned based on score distribution to achieve target percentages:

| Grade | Target Distribution | How Assigned |
|-------|---------------------|--------------|
| A | Top 10% | score >= 90th percentile of all scores |
| B | Next 20% | score >= 70th percentile |
| C | Middle 40% | score >= 30th percentile |
| D | Next 20% | score >= 10th percentile |
| F | Bottom 10% | score < 10th percentile |

### Result Statistics (926 CBSAs)

- Score range: 20.80 - 85.62
- Mean: 50.11, StdDev: 12.50
- Grade distribution: A=10%, B=20%, C=40%, D=20%, F=10%

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

## 9. Hospice Market Scoring (Pennant-Specific)

**Service:** `backend/services/hospiceMarketScoringService.js`

The hospice scoring methodology is the most sophisticated system, designed specifically for Pennant Group's strategic planning. It uses **two distinct scoring modes** depending on whether Pennant has existing presence in the market.

### Two Scoring Modes

| Mode | When Used | Primary Focus |
|------|-----------|---------------|
| **Footprint** | Pennant has existing presence | Leverage captive referral sources (75% weight) |
| **Greenfield** | New market entry | Market opportunity & demand (40%/40% weight) |

### Footprint Mode Weights

Used when Pennant already operates in the CBSA:

```javascript
{
  pennant_synergy: 0.75,  // Existing ecosystem leverage
  demand: 0.15,           // Market demand indicators
  quality_gap: 0.10       // Opportunity to outperform
}
```

### Greenfield Mode Weights

Used for new market entry analysis:

```javascript
{
  demand: 0.40,             // Market demand indicators
  market_opportunity: 0.40, // Supply gaps & dynamics
  quality_gap: 0.20         // Improvement opportunity
}
```

### Pennant Synergy Score Components

The synergy score measures the value of existing Ensign/Pennant infrastructure:

| Component | Weight | Max Value | Rationale |
|-----------|--------|-----------|-----------|
| Ensign LT Beds | 50% | 1,000 beds | Primary referral source (end-of-life transitions) |
| Pennant ALF Beds | 25% | 250 beds | Secondary referral source |
| Pennant HHA Agencies | 10% | 2 agencies | Coordination opportunity |
| Pennant Hospice | 15% | 3 agencies | Brand presence/scale |

**Calculation:**
```javascript
pennantSynergyScore =
  (min(ensignLTBeds / 1000, 1) * 0.50 +
   min(pennantALFBeds / 250, 1) * 0.25 +
   min(pennantHHACount / 2, 1) * 0.10 +
   min(pennantHospiceCount / 3, 1) * 0.15) * 100
```

### State-Calibrated LT Bed Estimation

Hospice scoring uses a sophisticated methodology to estimate long-term (custodial) beds from CMS Quality Measures data, calibrated by state:

**Formula:**
```javascript
// LS = Long-stay QM denominator, SS = Short-stay QM denominator
ratio = ls_denominator / ss_denominator;
long_term_pct = 0.40 + (ratio / (ratio + 1)) * 0.35;  // Bounded 40-75%
estimated_lt_beds = certified_beds * occupancy * long_term_pct;
```

This produces state-appropriate LT bed estimates that account for:
- High LT states (TX, LA, OK): 65-75% LT share
- Balanced states (CA, FL): 55-60% LT share
- Low LT states (AZ, NV): 45-55% LT share

### Demand Score Components

| Metric | Direction | Rationale |
|--------|-----------|-----------|
| Deaths per 1K 65+ | Higher = Better | Mortality = hospice demand |
| LT Bed Deaths/1K | Higher = Better | Captive referral opportunity |
| Pop 65+ Growth | Higher = Better | Future demand |

### Market Opportunity Components

| Metric | Direction | Rationale |
|--------|-----------|-----------|
| Hospice per 100K 65+ | Lower = Better | Less competition |
| HHI Concentration | Lower = Better | Fragmented market = opportunity |
| Net Agency Change | Higher = Better | Growing markets |

### Quality Gap Score

| Metric | Direction | Rationale |
|--------|-----------|-----------|
| Average Star Rating | Lower = Better | Quality improvement opportunity |
| % Low Quality (1-2 star) | Higher = Better | Chance to outperform |

### Example Score Calculation (Footprint Mode)

```javascript
// Phoenix-Mesa-Chandler, AZ (has Ensign SNFs, Pennant ALF/HHA)
pennantSynergyScore = 72.5  // (800 LT beds + 180 ALF beds + 2 HHA)
demandScore = 65.0          // Good mortality rates, growing pop
qualityGapScore = 55.0      // Moderate quality competition

// Footprint weights: 75% synergy, 15% demand, 10% quality
finalScore = (72.5 * 0.75) + (65.0 * 0.15) + (55.0 * 0.10)
           = 54.4 + 9.8 + 5.5
           = 69.7 (Grade: B-)
```

### Pennant Market Presence Table

The scoring relies on `pennant_market_presence` table which tracks:

| Field | Description |
|-------|-------------|
| `has_ensign_snf` | Whether Ensign operates SNFs in CBSA |
| `ensign_snf_count` | Number of Ensign SNFs |
| `ensign_snf_total_beds` | Total Ensign SNF beds |
| `has_pennant_alf` | Whether Pennant operates ALFs |
| `pennant_alf_count` | Number of Pennant ALFs |
| `has_pennant_hha` | Whether Pennant operates HHAs |
| `has_pennant_hospice` | Whether Pennant operates hospices |

---

## 10. Current State Summary (Generic PAC)

| Metric | Value |
|--------|-------|
| Total CBSAs in market_metrics | 928 |
| CBSAs with SNF data | 922 |
| CBSAs with ALF data | 890 |
| CBSAs with HHA data | 787 (HQ-based) / 935 (service-area) |
| CBSAs with all three | 758 |

---

## 10. Known Issues & TODOs

1. ~~**Methodology inconsistency:** SNF/ALF use percentile-based scoring, HHA uses absolute thresholds~~ ✅ RESOLVED: All now use percentile-based
2. ~~**Grade scale inconsistency:** SNF/ALF use simple A-F, HHA uses plus/minus~~ ✅ RESOLVED: HHA uses percentile-based grading
3. ~~**HHA methodology:** Service-area approach is more accurate than HQ-based~~ ✅ RESOLVED: Service-area approach implemented
4. ~~**Missing scripts:** Need to create reusable collector scripts~~ ✅ RESOLVED: All scripts created
5. **7 missing CBSAs:** 935 in `cbsas` table but only 928 in `market_grades` - minor data gap

---

## 12. Implemented Scripts

All scoring logic consolidated into these locations:

### Scripts (`backend/scripts/`)

| Script | Purpose | Key Factors |
|--------|---------|-------------|
| `update-snf-opportunity-scores.js` | SNF opportunity scoring | Capacity (30%), Occupancy (20%), Quality (20%), Growth (30%) |
| `update-alf-opportunity-scores.js` | ALF opportunity scoring | Capacity (50%), Growth (30%), Affluence (20%) |
| `update-hha-opportunity-scores.js` | HHA opportunity scoring | HHAs per 10K 65+ population (service area based) |
| `calculate-overall-pac-scores.js` | Combined PAC score | SNF (40%) + ALF (30%) + HHA (30%) |
| `rebuild-market-metrics.js` | Aggregate facility data | Per CBSA/state/county |
| `rebuild-all-market-scores.js` | Master orchestrator | Runs all in sequence |

### Services (`backend/services/`)

| Service | Purpose | Key Features |
|---------|---------|--------------|
| `hospiceMarketScoringService.js` | Pennant-specific hospice scoring | Footprint/Greenfield modes, Pennant synergy, state-calibrated LT beds |

**Usage:**
```bash
# Run all market scores
MARKET_DATABASE_URL=<url> node scripts/rebuild-all-market-scores.js

# Run individual scorers
MARKET_DATABASE_URL=<url> node scripts/update-snf-opportunity-scores.js
MARKET_DATABASE_URL=<url> node scripts/update-alf-opportunity-scores.js
MARKET_DATABASE_URL=<url> node scripts/update-hha-opportunity-scores.js
MARKET_DATABASE_URL=<url> node scripts/calculate-overall-pac-scores.js
```

---

## 13. HHA Agency Counting Methodology

### Design Decision: Service-Area Based Counting

HHA agencies are counted per CBSA based on their **declared service areas** (ZIP codes they serve), not their headquarters location. This is intentional.

### Why Service-Area Counting?

1. **HHAs serve wide geographic areas** - Unlike SNFs (fixed location), HHAs actively serve patients across multiple markets
2. **Reflects actual competition** - A CBSA's competitive landscape includes all agencies serving that area, not just those headquartered there
3. **Better opportunity assessment** - Markets are scored based on actual provider availability to patients

### Implication: Agencies Count in Multiple CBSAs

An agency serving ZIPs across multiple CBSAs will be counted in each:

| Metric | Value |
|--------|-------|
| Unique HHA agencies (nationally) | 11,990 |
| Sum of agency counts across CBSAs | 29,165 |
| Average CBSAs per agency | 2.43 |

### Example: Multi-CBSA Agency

**HOME HEALTH CARE SOLUTIONS LLC** (CCN 157597) serves 33 CBSAs across Indiana, Ohio, and Michigan. This agency is counted in the agency count for all 33 markets.

### Distribution of CBSA Coverage

| CBSAs Served | Number of Agencies |
|--------------|-------------------|
| 1 (single market) | ~5,400 |
| 2 | 2,635 |
| 3 | 1,600 |
| 4 | 927 |
| 5+ | 1,400+ |
| 10+ | ~330 |
| 20+ | ~15 |
| 30+ | 3 |

### Impact on Scoring

- **Percentile rankings are unaffected** - All CBSAs are counted the same way
- **Agency counts are inflated** - CBSA-level counts > unique national count
- **This is intentional** - Reflects competitive reality for each market

---

## 14. Statistical Caveats

### Metric: "HHA per 100K 65+"

This metric can be calculated three ways with very different results:

| Method | Formula | Result | Use Case |
|--------|---------|--------|----------|
| **Mean of ratios** | `AVG(per_cbsa_rate)` | 121.9 | Per-CBSA percentile comparisons |
| **Aggregate (service-area)** | `SUM(cbsa_counts) / SUM(cbsa_pop)` | 56.6 | Market-level aggregate |
| **Aggregate (unique)** | `COUNT(DISTINCT ccn) / national_pop` | 22.1 | True national rate |

**Current implementation uses "mean of ratios"** for percentile calculations because each CBSA is compared to other CBSAs, not to a national aggregate.

### Right-Skewed Distribution

The HHA per 100K distribution is heavily right-skewed due to small Texas CBSAs with extreme ratios:

| Statistic | Value |
|-----------|-------|
| Minimum | 3.0 |
| 25th percentile | 40.6 |
| Median | 80.7 |
| Mean | 121.9 |
| 75th percentile | 152.0 |
| Maximum | 1,476.0 |

### Outlier Markets

Top 5 outliers (small Texas border CBSAs):

| CBSA | HHA per 100K | Pop 65+ | Note |
|------|--------------|---------|------|
| Zapata, TX | 1,476 | 1,897 | Border region |
| Raymondville, TX | 1,453 | 2,959 | Border region |
| Kingsville, TX | 1,061 | 4,052 | Border region |
| Beeville, TX | 1,053 | 3,895 | Border region |
| Bonham, TX | 903 | 6,535 | Small rural |

These outliers get **equal weight** to large markets (NYC, LA) in mean calculations, pulling the average up significantly above the median.

### Recommendation

When presenting national averages to users:
- Show **median (80.7)** as the typical rate
- Show **mean (121.9)** only with context about outlier influence
- For aggregate statistics, use unique agency counts (22.1 per 100K nationally)
