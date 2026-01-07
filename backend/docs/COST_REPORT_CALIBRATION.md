# Cost Report Calibration Context

## Overview

This document captures the methodology for calibrating TAM estimates using Medicare Cost Report data. This was developed in January 2026 by comparing CMS Geographic Variation (GV) FFS-only data against facility-reported Cost Report totals.

**Key Insight:** CMS Geographic Variation data only includes Fee-for-Service (FFS) Medicare payments (~47% of beneficiaries). Cost Reports include BOTH FFS and Medicare Advantage (MA) payments, providing ground truth for total Medicare spend.

---

## Data Sources

### CMS Geographic Variation PUF (2023)
- **Table:** `medicare_gv_full`
- **Scope:** FFS Medicare only
- **Key Fields:** `snf_mdcr_pymt_amt`, `snf_cvrd_days_per_1000_benes`

### Medicare Cost Reports (2023)
- **Table:** `snf_cost_reports_2023`
- **Scope:** All Medicare (FFS + MA)
- **Key Fields:** `inpatient_pps_amount`, `snf_days_title_xviii`
- **Facilities:** 14,933 SNFs with self-reported financials

---

## National Totals Comparison (2023)

| Source | Medicare Days | Medicare Spend | Per-Day Rate |
|--------|---------------|----------------|--------------|
| **Cost Report** | 45.43M | $30.19B | $664 |
| **CMS GV (FFS)** | 40.75M | $23.61B | $579 |
| **Ratio (CR/GV)** | 1.11x | 1.28x | **1.15x** |

---

## Calibration Multipliers by MA Penetration

The rate premium (Cost Report / GV) varies by market MA penetration:

| MA Penetration | Rate Ratio | Use Case |
|----------------|------------|----------|
| Low (<40%) | **1.107** | Low-MA markets (rural, traditional Medicare) |
| Medium (40-50%) | **1.153** | Average markets |
| High (>50%) | **1.181** | High-MA markets (FL, CA, urban) |
| National Default | **1.158** | When MA rate unknown |

### Why This Matters
- Higher MA penetration = more non-FFS Medicare revenue captured in Cost Reports
- GV underestimates total Medicare spend by 15-18% depending on market
- Use these multipliers to convert GV FFS spend to total Medicare TAM

---

## Database Tables

### `cost_report_cbsa_2023` (494 rows)
CBSA-level aggregation of Cost Report data.
```sql
-- Key columns
cbsa_code, cbsa_title, facility_count, total_beds,
cr_medicare_days, cr_medicare_spend, cr_per_day_rate,
cr_net_patient_revenue, total_patient_revenue
```

### `tam_calibration_summary` (377 rows)
Side-by-side comparison of GV vs Cost Report by CBSA.
```sql
-- Key columns
cbsa_code,
gv_snf_spend, gv_snf_days, gv_per_day_rate,
cr_snf_spend, cr_snf_days, cr_per_day_rate,
spend_ratio, days_ratio, rate_ratio
```

### `market_metrics` Calibration Columns
```sql
cr_medicare_days      -- Medicare days from Cost Reports
cr_medicare_spend     -- Medicare PPS payments from Cost Reports
cr_per_day_rate       -- Calculated per-day rate (spend/days)
cr_net_patient_revenue -- All-payer net revenue
snf_total_tam_calibrated -- TAM using Cost Report rates
```

---

## Formulas

### Convert GV FFS to Total Medicare Spend
```sql
-- Using MA-adjusted multiplier
total_medicare_spend = gv_ffs_spend *
  CASE
    WHEN ma_penetration < 0.40 THEN 1.107
    WHEN ma_penetration < 0.50 THEN 1.153
    ELSE 1.181
  END

-- Or using market-specific Cost Report data (preferred when available)
total_medicare_spend = cr_medicare_pps_amount
```

### Calculate Per-Day Rate from GV
```sql
-- Aggregate county GV data to CBSA level
SELECT
  cbsa_code,
  SUM(snf_mdcr_pymt_amt) /
  SUM(ffs_benes * snf_cvrd_days_per_1000 / 1000) as snf_per_day_rate
FROM medicare_gv_full gv
JOIN county_cbsa_crosswalk cc ON gv.bene_geo_cd = cc.county_fips
WHERE year = 2023 AND bene_geo_lvl = 'County'
GROUP BY cbsa_code
```

---

## Coverage

- **377 CBSAs** have both GV and Cost Report data for calibration
- **923 CBSAs** have GV data (per-day rates calculated)
- **494 CBSAs** have Cost Report aggregates

Small markets may lack Cost Report data due to:
- Few facilities (<3 SNFs)
- Data suppression for privacy
- Facilities not filing cost reports

---

## Related Documentation

- [TAM_METHODOLOGY.md](./TAM_METHODOLOGY.md) - Full TAM calculation methodology
- [MARKET_SCORING_DATA_DICTIONARY.md](./MARKET_SCORING_DATA_DICTIONARY.md) - Column definitions
- [cms_data_dictionaries/README.md](./cms_data_dictionaries/README.md) - CMS source data dictionaries

---

## Changelog

- **January 2026:** Initial creation from Cost Report validation analysis
