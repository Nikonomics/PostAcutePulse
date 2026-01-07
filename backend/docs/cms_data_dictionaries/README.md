# CMS Data Dictionaries

Official data dictionaries from CMS for all source datasets used in this project.

---

## Skilled Nursing Facility (SNF)

### Nursing Home Compare
- **File:** `NH_Data_Dictionary.pdf`
- **Tables:** `snf_facilities`, `snf_qrp_provider_data`, `snf_vbp_performance`
- **Source:** [CMS Nursing Home Compare](https://data.cms.gov/provider-data/dataset/4pq5-n9py)
- **Update Frequency:** Monthly

### Cost Reports
- **File:** `Skilled Nursing Facility Cost Report Data Dictionary_508.pdf`
- **Tables:** `snf_cost_reports_2023`
- **Source:** [CMS Cost Reports](https://data.cms.gov/provider-compliance/cost-report)
- **Update Frequency:** Annual

---

## Home Health Agency (HHA)

### Home Health Compare
- **File:** `HHS_Data_Dictionary.pdf`
- **Tables:** `hh_provider_snapshots`, `hh_cahps_snapshots`, `hh_vbp_scores`, `hh_service_areas`
- **Source:** [CMS Home Health Compare](https://data.cms.gov/provider-data/dataset/6jpm-sxkc)
- **Update Frequency:** Monthly

### Ownership Data
- **Tables:** `hha_owners`, `hha_enrollments`
- **Source:** CMS Provider Enrollment data
- **Update Frequency:** Quarterly

---

## Hospice

### Hospice Compare
- **File:** `HOSPICE_Data_Dictionary.pdf`
- **Tables:** `hospice_providers`, `hospice_quality_measures`, `hospice_cahps_snapshots`
- **Source:** [CMS Hospice Compare](https://data.cms.gov/provider-data/dataset/252m-zfp9)
- **Update Frequency:** Quarterly

### Ownership Data
- **Tables:** `hospice_owners`
- **Source:** CMS Provider Enrollment data
- **Update Frequency:** Quarterly

---

## Physician/Supplier

### Provider Data
- **File:** `MUP_PHY_RY25_20250312_DD_Prvdr_508.pdf`
- **Tables:** `physician_provider`
- **Source:** [Medicare Physician & Other Practitioners](https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners)
- **Update Frequency:** Annual

### Provider Services
- **File:** `MUP_PHY_RY25_20250312_DD_PRV_SVC_508.pdf`
- **Tables:** `physician_provider_service`
- **Source:** Same as above
- **Update Frequency:** Annual

### Geographic Summary
- **File:** `MUP_PHY_RY21_20211021_DD_Geo (1).pdf`
- **Tables:** `physician_geography_service`
- **Source:** Same as above
- **Update Frequency:** Annual

---

## Medicare Geographic Variation

### Geographic Variation Public Use File
- **File:** `2014-2023 Medicare FFS Geographic Variation by National_State_County Data Dictionary_0.pdf`
- **Tables:** `medicare_gv_full`
- **Source:** [CMS Geographic Variation PUF](https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-geographic-comparisons/medicare-geographic-variation-by-national-state-county)
- **Update Frequency:** Annual (~2 year lag)
- **Years Available:** 2014-2023
- **Columns:** 247 metrics per geography

---

## Key Column Naming Conventions

### SNF (Nursing Home)
- `federal_provider_number` / `ccn` - CMS Certification Number (6 digits)
- `overall_rating` - 5-star overall rating (1-5)
- `occupancy_rate` - Beds occupied / certified beds

### HHA (Home Health)
- `ccn` - CMS Certification Number
- `quality_star_rating` - Quality of Patient Care star rating
- `episode_count` / `total_episodes_fy` - Annual Medicare episodes

### Hospice
- `ccn` - CMS Certification Number
- `ownership_type` - For-profit, Non-profit, Government

### Physician
- `rndrng_npi` - Rendering provider NPI
- `hcpcs_cd` - HCPCS procedure code
- `tot_benes` - Total unique beneficiaries
- `avg_mdcr_pymt_amt` - Average Medicare payment

### Geographic Variation
- `bene_geo_lvl` - Geography level (National, State, County)
- `bene_geo_cd` - FIPS code or state abbreviation
- `benes_ffs_cnt` - FFS Medicare beneficiaries
- `ma_prtcptn_rate` - MA penetration rate (0-1)
- `snf_mdcr_pymt_amt` - SNF Medicare FFS payments ($)
- `snf_cvrd_days_per_1000_benes` - SNF days per 1,000 FFS beneficiaries

---

## Related Documentation

- [MARKET_SCORING_DATA_DICTIONARY.md](../MARKET_SCORING_DATA_DICTIONARY.md) - Derived market metrics
- [TAM_METHODOLOGY.md](../TAM_METHODOLOGY.md) - TAM calculation methodology
- [MARKET_GRADING_METHODOLOGY.md](../MARKET_GRADING_METHODOLOGY.md) - Market grading system
