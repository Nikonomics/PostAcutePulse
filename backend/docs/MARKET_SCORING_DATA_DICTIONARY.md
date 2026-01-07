# Market Scoring Data Dictionary

This document defines all columns in the `market_metrics` and `market_grades` tables.

---

## Table: `market_metrics`

Aggregated facility and demographic data per geographic unit (CBSA).

### Identifiers

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `geography_type` | VARCHAR | Geographic unit type: `'cbsa'` |
| `geography_id` | VARCHAR | CBSA code (5 digits) |

### SNF Metrics

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `snf_facility_count` | INTEGER | Number of SNFs in CBSA | `snf_facilities` |
| `snf_total_beds` | INTEGER | Total certified beds | `snf_facilities.number_of_certified_beds` |
| `snf_avg_overall_rating` | NUMERIC | Average CMS 5-star rating (1-5) | `snf_facilities.overall_rating` |
| `snf_avg_occupancy` | NUMERIC | Average occupancy rate (0-100) | `snf_facilities.occupancy_rate` |
| `snf_beds_per_1k_65` | NUMERIC | Beds per 1,000 population 65+ | Calculated |

### ALF Metrics

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `alf_facility_count` | INTEGER | Number of ALFs in CBSA | `alf_facilities` |
| `alf_total_capacity` | INTEGER | Total licensed capacity/beds | `alf_facilities.capacity` |
| `alf_beds_per_1k_65` | NUMERIC | Beds per 1,000 population 65+ | Calculated |

### HHA Metrics (Headquarters-Based)

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `hha_agency_count` | INTEGER | HHAs headquartered in CBSA | `hh_provider_snapshots` |
| `hha_total_episodes` | INTEGER | Total Medicare episodes/year | `hh_provider_snapshots.total_episodes_fy` |
| `hha_avg_star_rating` | NUMERIC | Average quality star rating | `hh_provider_snapshots.quality_of_patient_care_star_rating` |
| `hha_agencies_per_100k_65` | NUMERIC | Agencies per 100K pop 65+ | Calculated |

### Demographics

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `pop_65_plus` | INTEGER | Population age 65+ | `county_demographics` aggregated |
| `pop_85_plus` | INTEGER | Population age 85+ | `county_demographics` aggregated |
| `median_household_income` | NUMERIC | Median household income ($) | `county_demographics` average |
| `projected_growth_65_2030` | NUMERIC | Projected % growth in 65+ by 2030 | `county_demographics` |

### Percentile Rankings (0-100)

| Column | Type | Description |
|--------|------|-------------|
| `snf_beds_per_1k_65_pctl` | NUMERIC | Percentile rank for SNF capacity |
| `snf_occupancy_pctl` | NUMERIC | Percentile rank for occupancy |
| `snf_avg_rating_pctl` | NUMERIC | Percentile rank for quality |
| `pop_65_growth_pctl` | NUMERIC | Percentile rank for growth |
| `private_pay_pctl` | NUMERIC | Percentile rank for income/affluence |
| `hha_agencies_per_100k_pctl` | NUMERIC | Percentile rank for HHA density |
| `hha_quality_pctl` | NUMERIC | Percentile rank for HHA quality |

### Opportunity Scores (0-100)

| Column | Type | Description |
|--------|------|-------------|
| `snf_opportunity_score` | NUMERIC | SNF market opportunity (higher = better) |
| `alf_opportunity_score` | NUMERIC | ALF market opportunity (higher = better) |
| `hha_opportunity_score` | NUMERIC | HHA market opportunity (higher = better) |

### Grades

| Column | Type | Description |
|--------|------|-------------|
| `snf_grade` | VARCHAR | Letter grade (A+ to F) |
| `alf_grade` | VARCHAR | Letter grade (A+ to F) |
| `hha_grade` | VARCHAR | Letter grade (A+ to F) |

### CMS Geographic Variation Data

See [TAM_METHODOLOGY.md](./TAM_METHODOLOGY.md) for full methodology.

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `gv_ffs_benes` | NUMERIC | FFS Medicare beneficiaries | `medicare_gv_full` |
| `gv_snf_spend_m` | NUMERIC | Actual SNF Medicare spend ($M) | `medicare_gv_full` |
| `gv_hh_spend_m` | NUMERIC | Actual HH Medicare spend ($M) | `medicare_gv_full` |
| `gv_hospice_spend_m` | NUMERIC | Actual Hospice Medicare spend ($M) | `medicare_gv_full` |
| `gv_readmit_rate` | NUMERIC | Hospital readmission rate (%) | `medicare_gv_full` |

### Per-Day/Per-Episode Rates (CBSA-Level)

| Column | Type | Description |
|--------|------|-------------|
| `gv_snf_per_day_2023` | NUMERIC | SNF per-day rate ($) - 2023 actual |
| `gv_snf_per_day_2024` | NUMERIC | SNF per-day rate ($) - 2024 projected (+4%) |
| `gv_snf_per_day_2025` | NUMERIC | SNF per-day rate ($) - 2025 projected (+8.37%) |
| `gv_hh_per_episode_2023` | NUMERIC | HH per-episode rate ($) - 2023 actual |
| `gv_hh_per_episode_2024` | NUMERIC | HH per-episode rate ($) - 2024 projected |
| `gv_hh_per_episode_2025` | NUMERIC | HH per-episode rate ($) - 2025 projected |
| `gv_hospice_per_day_2023` | NUMERIC | Hospice per-day rate ($) - 2023 actual |
| `gv_hospice_per_day_2024` | NUMERIC | Hospice per-day rate ($) - 2024 projected |
| `gv_hospice_per_day_2025` | NUMERIC | Hospice per-day rate ($) - 2025 projected |

### TAM (Total Addressable Market)

| Column | Type | Description |
|--------|------|-------------|
| `snf_medicare_tam_2023` | NUMERIC | Total market TAM (capacity × rate) |
| `snf_medicare_tam_2024` | NUMERIC | Total market TAM - 2024 |
| `snf_medicare_tam_2025` | NUMERIC | Total market TAM - 2025 |
| `snf_ffs_tam_2023` | NUMERIC | FFS Medicare TAM (actual CMS spend) |
| `snf_ffs_tam_2025` | NUMERIC | FFS Medicare TAM - 2025 projected |
| `hha_medicare_tam_2023` | NUMERIC | HHA Medicare TAM |
| `hha_medicare_tam_2024` | NUMERIC | HHA Medicare TAM - 2024 |
| `hha_medicare_tam_2025` | NUMERIC | HHA Medicare TAM - 2025 |

### Timestamps

| Column | Type | Description |
|--------|------|-------------|
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## Table: `market_grades`

Final opportunity scores and grades per CBSA. This is the primary table for market comparisons.

### Identifiers

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `geography_type` | VARCHAR | Geographic unit type: `'cbsa'` |
| `geography_id` | VARCHAR | CBSA code (5 digits) |
| `geography_name` | VARCHAR | CBSA title (e.g., "Phoenix-Mesa-Chandler, AZ") |

### Opportunity Scores (0-100)

| Column | Type | Description | Calculation |
|--------|------|-------------|-------------|
| `snf_opportunity_score` | NUMERIC | SNF market opportunity | See SNF scoring methodology |
| `alf_opportunity_score` | NUMERIC | ALF market opportunity | See ALF scoring methodology |
| `hha_opportunity_score` | NUMERIC | HHA market opportunity | See HHA scoring methodology |
| `overall_pac_score` | NUMERIC | Combined PAC opportunity | 40% SNF + 30% ALF + 30% HHA |

### Letter Grades

| Column | Type | Description |
|--------|------|-------------|
| `snf_grade` | VARCHAR | SNF letter grade (A+ to F) |
| `alf_grade` | VARCHAR | ALF letter grade (A+ to F) |
| `hha_grade` | VARCHAR | HHA letter grade (A+ to F) |
| `overall_pac_grade` | VARCHAR | Overall PAC letter grade |

### Rankings

| Column | Type | Description |
|--------|------|-------------|
| `snf_score_state_rank` | INTEGER | SNF rank within state |
| `snf_score_national_rank` | INTEGER | SNF rank nationally |
| `alf_score_state_rank` | INTEGER | ALF rank within state |
| `alf_score_national_rank` | INTEGER | ALF rank nationally |
| `hha_score_state_rank` | INTEGER | HHA rank within state |
| `hha_score_national_rank` | INTEGER | HHA rank nationally |
| `overall_score_state_rank` | INTEGER | Overall rank within state |
| `overall_score_national_rank` | INTEGER | Overall rank nationally |

### Classification

| Column | Type | Description |
|--------|------|-------------|
| `market_archetype` | VARCHAR | Market type classification |

### Timestamps

| Column | Type | Description |
|--------|------|-------------|
| `calculated_at` | TIMESTAMP | When scores were last calculated |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## Score Interpretation

### Opportunity Score (0-100)

| Range | Interpretation |
|-------|----------------|
| 80-100 | Excellent opportunity - underserved, growing, quality gaps |
| 60-79 | Good opportunity - moderate competition, solid fundamentals |
| 40-59 | Average market - balanced supply and demand |
| 20-39 | Limited opportunity - competitive, saturated |
| 0-19 | Challenging market - oversupplied, declining |

### Letter Grades

| Grade | Score Range | Meaning |
|-------|-------------|---------|
| A+ | 95-100 | Top tier opportunity |
| A | 90-94 | Excellent opportunity |
| A- | 85-89 | Very good opportunity |
| B+ | 80-84 | Good opportunity |
| B | 75-79 | Above average |
| B- | 70-74 | Slightly above average |
| C+ | 65-69 | Average (upper) |
| C | 60-64 | Average |
| C- | 55-59 | Average (lower) |
| D+ | 50-54 | Below average (upper) |
| D | 45-49 | Below average |
| D- | 40-44 | Below average (lower) |
| F | 0-39 | Poor opportunity |

---

## Data Sources

| Source | Tables Updated | Frequency |
|--------|----------------|-----------|
| CMS Nursing Home Compare | `snf_facilities` | Monthly |
| State ALF Licensing | `alf_facilities` | Varies by state |
| CMS Home Health Compare | `hh_provider_snapshots` | Monthly |
| CMS Provider Enrollment | `hh_service_areas` | Periodic |
| Census ACS | `county_demographics` | Annual |
| HUD Crosswalk | `hud_zip_cbsa` | Annual |
| CMS Geographic Variation PUF | `medicare_gv_full` | Annual (~2yr lag) |

---

## Related Tables

### `hud_zip_cbsa`

ZIP-to-CBSA crosswalk from HUD.

| Column | Type | Description |
|--------|------|-------------|
| `zip5` | VARCHAR(5) | 5-digit ZIP code (PK) |
| `cbsa_code` | VARCHAR(5) | CBSA code (NULL = rural) |
| `city` | VARCHAR | City name |
| `state` | VARCHAR(2) | State code |
| `ratio` | NUMERIC | Allocation ratio for multi-CBSA ZIPs |

### `cbsas`

CBSA reference data.

| Column | Type | Description |
|--------|------|-------------|
| `cbsa_code` | VARCHAR(5) | CBSA code (PK) |
| `cbsa_title` | VARCHAR | Full CBSA name |
| `cbsa_type` | VARCHAR | 'Metropolitan' or 'Micropolitan' |
| `csa_code` | VARCHAR | Combined Statistical Area code |
| `csa_title` | VARCHAR | CSA name |

### `hh_service_areas`

HHA service territories (which ZIPs each HHA serves).

| Column | Type | Description |
|--------|------|-------------|
| `ccn` | VARCHAR | CMS Certification Number |
| `zip_code` | VARCHAR | ZIP code served |
| `extract_id` | INTEGER | Data extract version |

### `medicare_gv_full`

CMS Geographic Variation Public Use File. 247 columns of Medicare utilization and spending by county.

| Column | Type | Description |
|--------|------|-------------|
| `year` | INTEGER | Data year (2014-2023) |
| `bene_geo_lvl` | VARCHAR | Geography level: 'National', 'State', 'County' |
| `bene_geo_cd` | VARCHAR | FIPS code (county) or state abbreviation |
| `bene_age_lvl` | VARCHAR | Age cohort: 'All', '<65', '65-74', '75-84', '85+' |
| `benes_ffs_cnt` | NUMERIC | FFS Medicare beneficiaries |
| `ma_prtcptn_rate` | NUMERIC | MA penetration rate (0-1) |
| `snf_mdcr_pymt_amt` | NUMERIC | SNF Medicare FFS payments ($) |
| `snf_cvrd_days_per_1000_benes` | NUMERIC | SNF days per 1,000 FFS benes |
| `hh_mdcr_pymt_amt` | NUMERIC | HH Medicare FFS payments ($) |
| `hh_episodes_per_1000_benes` | NUMERIC | HH episodes per 1,000 FFS benes |
| `hospc_mdcr_pymt_amt` | NUMERIC | Hospice Medicare FFS payments ($) |
| `hospc_cvrd_days_per_1000_benes` | NUMERIC | Hospice days per 1,000 FFS benes |
| `acute_hosp_readmsn_pct` | NUMERIC | Hospital readmission rate (%) |

See [TAM_METHODOLOGY.md](./TAM_METHODOLOGY.md) for usage details.
