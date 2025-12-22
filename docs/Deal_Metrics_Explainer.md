# Deal Metrics Data Consistency & Source Reference Guide

**Last Updated:** December 2025

---

## Executive Summary

This document explains how financial metrics are populated and displayed across the SNFalyze deal interface for both **portfolio deals** (multi-facility) and **single facility deals**. It serves as the single source of truth for ensuring data consistency across all UI components.

### Key Principles

| Deal Type | Primary Data Source | Key Metric |
|-----------|-------------------|------------|
| **Portfolio (with CIM)** | `cim_extraction.cim_facilities[]` | NOI (not EBITDA) |
| **Single Facility (no CIM)** | `deal_overview.ttm_financials` | Net Income |

---

## Data Sources in extraction_data

The `extraction_data` JSON blob contains multiple locations where financial data may exist:

| Field Path | Contains | Use Case |
|------------|----------|----------|
| `cim_extraction.cim_facilities[]` | Per-facility financials from CIM document | **PRIMARY SOURCE** for portfolio deals |
| `deal_overview.ttm_financials` | TTM financials calculated from P&L documents | **PRIMARY SOURCE** for single facility deals |
| `financial_information_t12` | Single-facility T12 financials | Legacy fallback |
| `portfolio_summary.aggregates` | Pre-calculated portfolio totals | Often empty - do not rely on |
| `t12_totals` | T12 summary totals | Single facility only |

---

## Part 1: Portfolio Deals (Multi-Facility with CIM)

### Data Flow Architecture

```
extraction_data.cim_extraction.cim_facilities[]
        │
        ▼
DealDetail.jsx
  └── getFacilitiesWithCIMData()
        └── Matches deal_facilities to cim_facilities by name
        └── Merges CIM financial data as primary source
              ├── annual_revenue ← cimFinancials.total_revenue
              ├── noi ← cimFinancials.noi
              ├── occupancy_rate ← cimCensus.current_occupancy_pct
              └── payer_mix ← cimPayerMix.*
        │
        ▼
FacilitiesSection.jsx
  └── Displays facility cards with CIM-merged data
  └── Blue ribbon aggregates SUM of all facilities
```

### CIM Facilities Data Structure

Each facility in `cim_extraction.cim_facilities[]` contains:

| Field | Example Value | Notes |
|-------|--------------|-------|
| `financials.total_revenue` | $10,987,759 | TTM revenue |
| `financials.total_expenses` | $7,931,043 | TTM expenses |
| `financials.noi` | $3,056,716 | Net Operating Income - **PRIMARY** |
| `financials.ebitda` | (often not_disclosed) | May be empty in CIM data |
| `ttm_revenue` | $10,987,759 | Alternative revenue field |
| `noi` | $3,056,716 | Alternative NOI field |
| `occupancy` | 60% | Current occupancy rate |
| `beds` / `bed_count` | 128 | Total beds |

### Portfolio Aggregation Logic

| Metric | Aggregation Method |
|--------|-------------------|
| Total Revenue | SUM of all facility revenues |
| Total NOI | SUM of all facility NOIs |
| Total Beds | SUM of all facility beds |
| Occupancy | Weighted average by bed count |

**Example Calculation:**
```
Occupancy = (Facility1_Beds × Facility1_Occ + Facility2_Beds × Facility2_Occ) / Total_Beds
         = (128 × 60% + 105 × 82%) / 233 = 69.9%
```

---

## Part 2: Single Facility Deals (No CIM)

### Data Flow Architecture

```
extraction_data.deal_overview.ttm_financials
        │
        ▼
DealDetail.jsx
  └── Passes extractionData prop to FacilitiesSection
        │
        ▼
FacilitiesSection.jsx
  └── applyTtmFallback()
        └── Checks: single facility + missing financials?
              ├── annual_revenue ← ttm_financials.revenue
              ├── noi ← ttm_financials.net_income
              └── occupancy_rate ← ttm_financials.occupancy_pct
```

### TTM Financials Data Structure

The `deal_overview.ttm_financials` object contains AI-extracted TTM data from P&L documents:

```json
{
  "period": "Oct 2024 - Sep 2025",
  "revenue": 3886827.32,
  "net_income": -1119171.32,
  "expenses": 5005998.64,
  "interest": 12497.72,
  "rent_lease": 48000,
  "depreciation": 256556.11,
  "avg_census": 91,
  "net_income_margin_pct": -28.79,
  "revenue_per_resident_day": 118.4,
  "data_sources": "T12 P&L (Oct-Feb), YTD I&E (Mar-Sep)"
}
```

### Single Facility Fallback Logic

Located in `FacilitiesSection.jsx` - `applyTtmFallback()`:

```javascript
const applyTtmFallback = (facilitiesList) => {
  // Only apply for single facility deals
  if (facilitiesList.length !== 1) return facilitiesList;

  const ttmFinancials = extractionData?.deal_overview?.ttm_financials;
  if (!ttmFinancials) return facilitiesList;

  const facility = facilitiesList[0];
  const hasMissingFinancials = !facility.annual_revenue && !facility.noi;

  if (hasMissingFinancials) {
    return [{
      ...facility,
      annual_revenue: ttmFinancials.revenue || ttmFinancials.total_revenue,
      noi: ttmFinancials.net_income || ttmFinancials.noi,
      occupancy_rate: facility.occupancy_rate || ttmFinancials.occupancy_pct,
      _ttm_fallback_applied: true,
    }];
  }
  return facilitiesList;
};
```

---

## Part 3: Individual Facility View (Within Portfolio)

When viewing a single facility within a portfolio deal (via the view selector dropdown):

### Data Flow

```
DealDetail.jsx
  └── getCurrentViewData()
        └── Finds selected facility in deal.deal_facility
        └── Matches to CIM facility by normalized name
        └── Returns extraction data with single-facility CIM array
              └── cim_facilities: [matchedCimFacility]
```

This ensures that when viewing an individual facility within a portfolio:
- Deal Overview shows only that facility's metrics
- Financials tab shows only that facility's data
- All sections remain consistent

---

## UI Components & Data Mapping

### 1. Facilities Section (FacilitiesSection.jsx)

**Blue Ribbon (Portfolio Summary)**

| Metric | Source | Aggregation |
|--------|--------|-------------|
| Subject Properties | `facilities.length` | Count |
| Total Beds | `facilities[].bed_count` | SUM |
| Total Price | `facilities[].purchase_price` | SUM |
| Total Revenue | `facilities[].annual_revenue` | SUM |
| Total NOI | `facilities[].noi` | SUM |

**Facility Card Headers**

| Metric | Source | Notes |
|--------|--------|-------|
| BEDS | `facility.bed_count` | From deal_facilities table |
| PRICE | `facility.purchase_price` | May be N/A |
| REVENUE | `facility.annual_revenue` | From CIM or ttm_financials fallback |
| NOI | `facility.noi` | From CIM or ttm_financials fallback |

### 2. Deal Overview Tab

Displays Key Metrics from CIM data (portfolio) or ttm_financials (single facility).

| Metric | Portfolio Source | Single Facility Source |
|--------|-----------------|----------------------|
| TTM Revenue | SUM of `cim_facilities[].ttm_revenue` | `ttm_financials.revenue` |
| Net Income | SUM of `cim_facilities[].noi` | `ttm_financials.net_income` |
| Net Income Margin | Calculated | `ttm_financials.net_income_margin_pct` |
| Occupancy | Weighted AVG | `ttm_financials.occupancy_pct` |

### 3. Financials Tab (DealExtractionViewer.jsx)

| Metric | Portfolio Source | Single Facility Source |
|--------|-----------------|----------------------|
| Total Revenue | SUM of `cim_facilities[].financials.total_revenue` | `ttm_financials.revenue` |
| Total Expenses | SUM of `cim_facilities[].financials.total_expenses` | `ttm_financials.expenses` |
| Net Income | SUM of `cim_facilities[].financials.noi` | `ttm_financials.net_income` |

---

## Validation Rules

Use these rules to verify data consistency across UI components:

### Portfolio Deals
1. Blue Ribbon Total Revenue = SUM of all Facility Card Revenue values
2. Blue Ribbon Total NOI = SUM of all Facility Card NOI values
3. Deal Overview TTM Revenue = Blue Ribbon Total Revenue
4. Deal Overview Net Income = Blue Ribbon Total NOI
5. Financials Tab Total Revenue = Blue Ribbon Total Revenue
6. Financials Tab Net Income = Blue Ribbon Total NOI

### Single Facility Deals
1. Facilities Section Revenue = Deal Overview Revenue = Financials Tab Revenue
2. Facilities Section NOI = Deal Overview Net Income = Financials Tab Net Income
3. All values should match `ttm_financials` when no CIM data exists

---

## Database Tables Reference

### deal_facilities Table

Stores per-facility data. For portfolio deals, there are multiple rows per deal.

| Column | Type | Notes |
|--------|------|-------|
| `facility_name` | VARCHAR | Facility name |
| `annual_revenue` | DECIMAL | TTM revenue (may be NULL for single facility) |
| `net_operating_income` | DECIMAL | NOI from CIM - **CORRECT VALUE** |
| `ebitda` | DECIMAL | May contain incorrect values - **DO NOT USE** |
| `bed_count` | INTEGER | Total beds |
| `occupancy_rate` | DECIMAL | Current occupancy % |

**Important:** The `ebitda` column in deal_facilities may contain incorrect values from Excel extraction. Always use `net_operating_income` (which maps to `noi` in the frontend) for profitability metrics.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `DealExtractionViewer.jsx` | Renders all extraction tabs including Financials, Deal Overview |
| `FacilitiesSection.jsx` | Renders blue ribbon and facility cards, applies ttm_financials fallback |
| `DealDetail.jsx` | Parent component, merges CIM data with deal_facilities, handles view selection |
| `DealController.js` | Backend - saves extraction data to database |

---

## Troubleshooting Guide

### Symptom: Single facility deal shows no financial data in Facilities Section
- **Check:** Does `extraction_data.deal_overview.ttm_financials` exist?
- **Check:** Is `deal_facilities.annual_revenue` NULL?
- **Fix:** The `applyTtmFallback()` function should populate from ttm_financials

### Symptom: Financials tab shows wrong/partial data
- **Check:** Is this a portfolio deal with CIM data?
- **Check:** Does `extraction_data.cim_extraction.cim_facilities` exist and have data?
- **Fix:** Ensure renderFinancialsTab checks for CIM facilities before falling back to financial_information_t12

### Symptom: Facility cards show wrong EBITDA
- **Check:** Is the UI displaying `facility.ebitda` instead of `facility.noi`?
- **Check:** Does the database have `net_operating_income` populated correctly?
- **Fix:** Display NOI instead of EBITDA; the `normalizeFacilityData` function maps `net_operating_income` to `noi`

### Symptom: Blue ribbon totals don't match facility sum
- **Check:** Are ribbon totals aggregating from the same source as facility cards?
- **Fix:** Both should use the facilities array with consistent field access (`noi`, not `ebitda`)

### Symptom: Individual facility view shows portfolio totals
- **Check:** Is `getCurrentViewData()` in DealDetail.jsx returning filtered data?
- **Fix:** The function should return only the selected facility's CIM data

---

## Summary

| Deal Type | Data Source | Profitability Metric | Aggregation |
|-----------|-------------|---------------------|-------------|
| Portfolio (with CIM) | `cim_extraction.cim_facilities[]` | NOI | SUM for revenue/NOI/beds, weighted AVG for occupancy |
| Single Facility (no CIM) | `deal_overview.ttm_financials` | Net Income | N/A (single facility) |
| Individual Facility View | Filtered `cim_facilities[matched]` | NOI | N/A (single facility from portfolio) |

**All UI sections must show consistent totals that reconcile.**
