# SNFalyze Data Roadmap

## Version 1.0 - Current Implementation

### Data Sources
| Source | Files | Coverage | Update Frequency |
|--------|-------|----------|------------------|
| CMS Nursing Home Compare | NH_ProviderInfo, NH_QualityMsr_*, NH_Penalties, NH_Ownership | 15,000+ facilities | Monthly |
| CMS SNF QRP | Skilled_Nursing_Facility_Quality_Reporting_Program_Provider_Data | Quality measures | Quarterly |
| CMS SNF VBP | FY_XXXX_SNF_VBP_Facility_Performance | Value-based purchasing | Annual |
| US Census | ACS 5-year estimates | County demographics | Annual |
| OMB/Census | CBSA delineations | Market definitions | Periodic |
| CMS Wage Index | SNF PPS wage data | Labor market costs | Annual |
| BLS OEWS | Occupational wage estimates | Staff wage benchmarks | Annual |

### Historical Data Available
- 2020-2025 monthly CMS extracts (nested in yearly archives)
- Schema evolution tracked in Data Dictionary Table 16

### Metrics Available (V1.0)
- **Facility Profile**: Beds, occupancy, ownership, chain affiliation
- **Star Ratings**: Overall, Health Inspection, Quality Measures, Staffing
- **Quality Measures**: 40+ MDS/claims-based measures with Q1-Q4 granularity
- **Staffing**: Hours per resident day, turnover, administrator changes
- **Compliance**: Deficiencies, penalties, SFF status
- **Market Context**: CBSA, wage index, competitor counts

---

## Version 2.0 - Enhanced Analytics

### Priority 1: Hospital Referral Patterns

**Source**: CMS Inpatient Prospective Payment System (IPPS) / Medicare Claims
**Files**:
- MedPAR (Medicare Provider Analysis and Review)
- Post-Acute Care Transfer data

**What it enables**:
- Identify which hospitals discharge to which SNFs
- Map referral networks and market share
- Detect changes in hospital-SNF relationships
- Find underserved hospital markets

**Data points needed**:
- Hospital CCN
- Discharge counts by SNF destination
- Diagnosis/DRG patterns
- Length of stay before transfer
- Readmission rates by hospital-SNF pair

**Access method**: CMS Research Data Files (application required) or commercial vendors (LexisNexis, Definitive Healthcare)

---

### Priority 2: Payer Mix & Revenue Data

**Source**: Medicare Cost Reports (CMS Form 2540-10)
**Files**: HCRIS (Healthcare Cost Report Information System)

**What it enables**:
- Understand revenue composition (Medicare/Medicaid/Private)
- Calculate true financial performance
- Identify facilities with unfavorable payer mix
- Spot margin compression trends

**Data points needed**:
- Total patient days by payer
- Revenue by payer type
- Operating costs and margins
- Ancillary revenue
- Bad debt and charity care

**Access method**:
- CMS HCRIS downloads (public, ~6 month lag)
- Commercial: Definitive Healthcare, Trella Health

---

### Priority 3: Area Health Resource File (AHRF)

**Source**: HRSA Area Health Resource File
**Files**: County-level health resource data

**What it enables**:
- Healthcare workforce availability
- Provider-to-population ratios
- Healthcare infrastructure gaps
- Underserved area identification

**Data points needed**:
- Physicians per capita by specialty
- Hospital beds per capita
- Health professional shortage area (HPSA) status
- Medicare Advantage penetration
- Managed care enrollment

**Access method**: HRSA AHRF downloads (free, annual)

---

### Priority 4: Real Estate & Development Data

**Source**: Multiple (CoStar, county records, SEC filings)
**Files**: Property records, REIT filings

**What it enables**:
- Property ownership vs. operating company
- Rent obligations and lease terms
- New construction pipeline
- Market entry/exit barriers

**Data points needed**:
- Property owner (REIT, independent)
- Acquisition dates and prices
- Rent per bed
- CapEx investments
- Planned developments

**Access method**:
- CoStar (commercial, expensive)
- County assessor records (public, fragmented)
- SEC EDGAR filings for public REITs

---

### Priority 5: Claims-Based Outcomes

**Source**: CMS Medicare Claims (Part A & B)
**Files**: Research Identifiable Files (RIF)

**What it enables**:
- True patient outcomes beyond quality measures
- Complication rates
- Cost efficiency analysis
- Care pathway modeling

**Data points needed**:
- Episode costs
- Skilled days utilized
- Therapy utilization
- Readmission diagnoses
- Mortality rates

**Access method**:
- CMS Virtual Research Data Center (researcher access)
- Commercial: Trella Health, nHealth

---

## Version 2.0 Architecture Enhancements

### Additional Tables Required

```sql
-- Hospital referral patterns
CREATE TABLE hospital_snf_referrals (
  hospital_ccn VARCHAR(10),
  snf_ccn VARCHAR(10),
  period_start DATE,
  period_end DATE,
  discharge_count INTEGER,
  avg_los DECIMAL(6,2),
  readmit_rate DECIMAL(5,2),
  top_drgs JSONB
);

-- Financial/payer data from cost reports
CREATE TABLE facility_financials (
  ccn VARCHAR(10),
  fiscal_year INTEGER,
  medicare_days INTEGER,
  medicaid_days INTEGER,
  private_days INTEGER,
  total_revenue DECIMAL(15,2),
  operating_costs DECIMAL(15,2),
  operating_margin DECIMAL(6,4)
);

-- Market health resources
CREATE TABLE market_health_resources (
  cbsa_code VARCHAR(5),
  state VARCHAR(2),
  as_of_year INTEGER,
  physicians_per_capita DECIMAL(8,4),
  hospital_beds_per_capita DECIMAL(8,4),
  is_hpsa BOOLEAN,
  ma_penetration DECIMAL(5,2)
);
```

### Enhanced Feature Store (V2.0)

```sql
-- Add to facility_features
ALTER TABLE facility_features ADD COLUMN
  medicare_payer_pct DECIMAL(5,2),
  medicaid_payer_pct DECIMAL(5,2),
  top_referral_hospital_ccn VARCHAR(10),
  referral_concentration DECIMAL(6,4),  -- HHI of referral sources
  market_physician_supply DECIMAL(8,4),
  competitor_ma_penetration DECIMAL(5,2);
```

---

## Data Acquisition Costs

| Data Source | Access Type | Estimated Cost | Update Frequency |
|-------------|-------------|----------------|------------------|
| CMS Public Use Files | Free | $0 | Monthly/Annual |
| HRSA AHRF | Free | $0 | Annual |
| CMS Cost Reports (HCRIS) | Free | $0 | Annual |
| Definitive Healthcare | Subscription | $15-50K/year | Real-time |
| Trella Health | Subscription | $10-30K/year | Quarterly |
| CoStar (Real Estate) | Subscription | $20-50K/year | Real-time |
| CMS Research Files | Application | $10-20K + time | One-time |

---

## Implementation Timeline

### Phase 1 (Current): Foundation
- [x] 5-layer time-series schema
- [x] CMS historical import (2020-2025)
- [x] Event detection pipeline
- [ ] Market aggregation views

### Phase 2: Enhanced Analytics
- [ ] AHRF integration (free, high value)
- [ ] Cost report integration (HCRIS)
- [ ] Chain/portfolio analytics dashboard
- [ ] Facility comparison tools

### Phase 3: Competitive Intelligence
- [ ] Hospital referral data (vendor or research)
- [ ] Payer mix analysis
- [ ] Margin modeling
- [ ] Acquisition targeting scores

### Phase 4: Predictive Models
- [ ] Rating downgrade prediction
- [ ] Penalty risk scoring
- [ ] Market opportunity identification
- [ ] Competitive displacement modeling

---

## Notes

1. **Data Lag**: CMS public data has 1-24 month lag depending on measure type
2. **Research Data**: Claims-level data requires IRB and CMS DUA approval
3. **Commercial Vendors**: Faster access but significant cost
4. **Schema Evolution**: CMS changes column names/definitions yearly - import scripts handle this
5. **Privacy**: Some analyses require aggregation to avoid identifying beneficiaries
