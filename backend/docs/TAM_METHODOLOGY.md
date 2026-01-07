# TAM (Total Addressable Market) Methodology

## Overview

This document describes the methodology for calculating SNF, HHA, and Hospice TAM at the CBSA market level. The approach uses CMS Geographic Variation (GV) Public Use File data as the source of truth, calibrated with VBP/QRP provider data.

**Last Updated:** January 2026
**Data Source:** CMS Geographic Variation PUF 2023 (county-level)

---

## Data Sources

### Primary: CMS Geographic Variation PUF
- **Table:** `medicare_gv_full`
- **Years:** 2014-2023 (10 years)
- **Rows:** 33,639 (3,195-3,198 counties per year)
- **Columns:** 247 metrics per county
- **Key Fields:**
  - `snf_mdcr_pymt_amt` - SNF Medicare FFS payments
  - `snf_cvrd_days_per_1000_benes` - SNF covered days per 1,000 FFS beneficiaries
  - `hh_mdcr_pymt_amt` - Home Health Medicare FFS payments
  - `hh_episodes_per_1000_benes` - HH episodes per 1,000 FFS beneficiaries
  - `hospc_mdcr_pymt_amt` - Hospice Medicare FFS payments
  - `hospc_cvrd_days_per_1000_benes` - Hospice days per 1,000 FFS beneficiaries

### Secondary: VBP/QRP Provider Data
- **Table:** `snf_qrp_provider_data`
- **Purpose:** Short-term bed estimates, PPR volume for calibration
- **Key Field:** `s_004_01_ppr_pd_volume` - Medicare skilled stays (proxy)

---

## Key Concepts

### FFS vs Total Medicare
- **FFS (Fee-for-Service):** ~47% of Medicare beneficiaries (2023)
- **MA (Medicare Advantage):** ~53% of Medicare beneficiaries (2023)
- CMS GV data only includes FFS payments
- Total market potential requires adjustment for MA population

### Two TAM Views

| TAM Type | Description | Use Case |
|----------|-------------|----------|
| **FFS TAM** | Actual CMS FFS Medicare spend | Conservative, verifiable |
| **Total Market TAM** | Capacity-based (all payers) | Market potential analysis |

---

## Per-Day/Per-Episode Rate Calculation

### SNF Per-Day Rate by CBSA
```sql
-- Aggregate county GV data to CBSA level
SELECT
  cbsa_code,
  SUM(snf_mdcr_pymt_amt) / SUM(ffs_benes * snf_cvrd_days_per_1000 / 1000) as snf_per_day
FROM medicare_gv_full gv
JOIN county_cbsa_crosswalk cc ON gv.bene_geo_cd = cc.county_fips
WHERE year = 2023 AND bene_geo_lvl = 'County'
GROUP BY cbsa_code
```

### Rate Projections (MCR Increases)
| Year | SNF Rate Increase | Cumulative |
|------|-------------------|------------|
| 2023 | Baseline | 1.0000 |
| 2024 | +4.0% | 1.0400 |
| 2025 | +4.2% | 1.0837 |

---

## TAM Calculations

### SNF FFS TAM (Actual CMS Spend)
```
snf_ffs_tam_2023 = gv_snf_spend_m × 1,000,000
snf_ffs_tam_2025 = snf_ffs_tam_2023 × 1.0837
```
- **National Total (2023):** $21.25B
- **National Total (2025):** $23.03B

### SNF Total Market TAM (Capacity-Based)
```
snf_medicare_tam = ST_beds × 0.85 (occupancy) × 365 × per_day_rate
```
- **National Total (2023):** $85.0B
- **National Total (2025):** $92.1B

### HHA TAM
```
hha_medicare_tam = gv_hh_spend_m × rate_increase
```
- **National Total (2023):** $13.56B
- **National Total (2025):** $14.70B

---

## Geographic Variation in Rates

### SNF Per-Day Rate Distribution (2023)
| Percentile | Rate |
|------------|------|
| Min | $350 |
| P25 | $471 |
| Median | $506 |
| P75 | $583 |
| Max | $1,929 |
| Mean | $549 |

### Sample Markets (2023 → 2025)
| Market | SNF $/day | HH $/episode |
|--------|-----------|--------------|
| SF Bay Area | $925 → $1,002 | $3,172 |
| NY Metro | $691 → $749 | $2,546 |
| Los Angeles | $687 → $745 | $2,255 |
| Phoenix | $575 → $624 | $1,907 |
| Dallas | $513 → $556 | $1,758 |
| Miami | $502 → $544 | $1,911 |
| Detroit | $495 → $536 | $1,627 |
| Tampa | $491 → $532 | $1,784 |

---

## Database Columns in `market_metrics`

### Per-Day/Per-Episode Rates
| Column | Description |
|--------|-------------|
| `gv_snf_per_day_2023` | CBSA SNF per-day rate (2023) |
| `gv_snf_per_day_2024` | Projected (×1.04) |
| `gv_snf_per_day_2025` | Projected (×1.0837) |
| `gv_hh_per_episode_2023` | CBSA HH per-episode rate (2023) |
| `gv_hh_per_episode_2024` | Projected (×1.04) |
| `gv_hh_per_episode_2025` | Projected (×1.0837) |
| `gv_hospice_per_day_2023` | CBSA Hospice per-day rate (2023) |
| `gv_hospice_per_day_2024` | Projected (×1.04) |
| `gv_hospice_per_day_2025` | Projected (×1.0837) |

### TAM Columns
| Column | Description |
|--------|-------------|
| `snf_medicare_tam_2023/24/25` | Total market TAM (capacity × rate) |
| `snf_ffs_tam_2023/25` | FFS TAM (actual CMS spend) |
| `hha_medicare_tam_2023/24/25` | HHA Medicare TAM |

### GV Source Data
| Column | Description |
|--------|-------------|
| `gv_ffs_benes` | FFS beneficiaries in CBSA |
| `gv_snf_spend_m` | Actual SNF Medicare spend ($M) |
| `gv_hh_spend_m` | Actual HH Medicare spend ($M) |
| `gv_hospice_spend_m` | Actual Hospice Medicare spend ($M) |

---

## Calibration Ratios

From comparing VBP/QRP PPR volume to CMS GV FFS stays (2023):

| Ratio | Value | Use |
|-------|-------|-----|
| FFS-to-PPR | 0.7846 | Convert PPR to FFS stays |
| Total-to-PPR | 1.66 | Convert PPR to total stays (FFS + MA) |

### National Benchmarks (2023)
- PPR Volume (QRP): 1,949,716 stays
- FFS Stays (GV): 1,529,734 stays
- FFS Days (GV): 40.9M days
- Avg LOS: 26.7 days
- Per-Day Rate: $580 (national avg)
- Per-Stay Rate: $15,454

---

## Supporting Tables

### `tam_methodology`
Documentation table with formula definitions and sources.

### `snf_tam_calibration`
Year-over-year calibration data (2014-2023) showing:
- FFS beneficiaries
- MA penetration rate
- FFS stays and days
- Implied total stays

### `gv_pac_opportunity_2023`
CBSA-level PAC opportunity analysis with:
- FFS beneficiaries
- Actual spend by service type
- Utilization rates (per 1K)
- Gap analysis vs national averages

---

## Cost Report Validation (January 2026)

### Data Source: Medicare Cost Reports 2023
- **Table:** `snf_cost_reports_2023`
- **Facilities:** 14,933 SNFs with self-reported financials
- **Key Fields:**
  - `inpatient_pps_amount` - Medicare PPS payments (FFS + MA)
  - `snf_days_title_xviii` - Medicare days (Title XVIII)
  - `net_patient_revenue` - All-payer net revenue

### National Totals Comparison

| Source | Medicare Days | Medicare Spend | Per-Day Rate |
|--------|---------------|----------------|--------------|
| **Cost Report 2023** | 45.43M | $30.19B | $664 |
| **CMS GV 2023 (FFS)** | 40.75M | $23.61B | $579 |
| **Ratio (CR/GV)** | 1.11x | 1.28x | 1.15x |

Cost Reports include both FFS and MA Medicare payments, explaining the higher values.

### Calibration Multipliers by MA Penetration

| MA Penetration | Days Ratio | Spend Ratio | Rate Ratio |
|----------------|------------|-------------|------------|
| **National** | 1.050 | 1.212 | **1.158** |
| Low (<40%) | 0.721 | 0.831 | 1.107 |
| Medium (40-50%) | 1.130 | 1.314 | 1.153 |
| High (>50%) | 1.129 | 1.305 | **1.181** |

### Calibration Formulas

```sql
-- Convert GV FFS spend to Total Medicare spend
total_medicare_spend = gv_ffs_spend × rate_ratio

-- Where rate_ratio depends on MA penetration:
--   Low MA:    1.107
--   Medium MA: 1.153
--   High MA:   1.181
--   Default:   1.158

-- Alternatively, use market-specific Cost Report data:
total_medicare_spend = cr_medicare_pps_amount
```

### Database Columns Added

| Column | Description |
|--------|-------------|
| `cr_medicare_days` | Medicare days from Cost Reports |
| `cr_medicare_spend` | Medicare PPS payments from Cost Reports |
| `cr_per_day_rate` | Calculated per-day rate (spend/days) |
| `cr_net_patient_revenue` | All-payer net revenue |
| `snf_total_tam_calibrated` | Calibrated TAM from Cost Reports |

### Supporting Tables

- **`cost_report_cbsa_2023`** - CBSA-level Cost Report aggregations
- **`tam_calibration_summary`** - Side-by-side GV vs CR comparison with ratios

---

## Notes

1. **Small Market Volatility:** CBSAs with <5,000 FFS beneficiaries may have extreme per-day rates. Consider using regional or national rates for very small markets.

2. **MA Impact:** The 3:1 ratio between Total Market TAM and FFS TAM reflects both MA exclusion (~53%) and capacity vs utilization differences.

3. **Rate Updates:** MCR publishes SNF rate increases annually (typically July). Update projection multipliers accordingly.

4. **Data Lag:** CMS GV data is released ~2 years after the measurement period. Use VBP/QRP data for more current estimates, calibrated against latest GV release.

5. **Cost Report Calibration:** Cost Reports provide ground-truth validation. The ~1.15-1.18x rate premium over GV FFS rates captures MA payments and supplemental revenue not in claims data.
