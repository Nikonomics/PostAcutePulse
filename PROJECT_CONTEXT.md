# SNFalyze Project Context

## Purpose
Healthcare M&A deal analysis platform for skilled nursing facilities (SNF), assisted living facilities (ALF), and senior housing acquisitions. Built for Cascadia Healthcare to streamline deal evaluation, document extraction, and investment analysis.

---

## Tech Stack

### Backend
- **Runtime**: Node.js + Express
- **ORM**: Sequelize
- **Database**: SQLite (local dev) / PostgreSQL (production)
- **AI Extraction**: Claude API (Anthropic) - claude-sonnet-4-20250514
- **Document Parsing**: pdf-parse (PDFs), XLSX (Excel), pdf-to-img (vision fallback)

### Frontend
- **Framework**: React 18
- **UI**: React Bootstrap + custom CSS
- **HTTP Client**: Axios
- **AI Chat**: Google Gemini 2.0 Flash API
- **Local Algorithm**: Custom SNF Deal Evaluator (no API)

---

## Folder Structure

```
snfalyze-local/
├── backend/
│   ├── app.js                        # Express app entry
│   ├── controller/
│   │   └── DealController.js         # Main API logic (~2500 lines)
│   ├── services/
│   │   ├── aiExtractor.js            # Claude AI extraction (~1550 lines)
│   │   └── calculatorService.js      # Deal metrics calculator
│   ├── models/
│   │   ├── deals.js                  # Main deals table
│   │   ├── deal_facilities.js        # Multi-facility support
│   │   ├── deal_documents.js         # Uploaded documents
│   │   ├── deal_comments.js          # Deal comments
│   │   └── users.js                  # User accounts
│   ├── routes/
│   │   ├── deal.js                   # Deal API routes
│   │   └── auth.js                   # Auth routes
│   └── database.sqlite               # Local SQLite database
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DealExtractionViewer/ # Extraction results UI (tabbed)
│   │   │   ├── DealCalculatorTab.jsx # Interactive calculator
│   │   │   └── FacilitiesSection.jsx # Multi-facility management
│   │   ├── pages/
│   │   │   ├── DealDetail.jsx        # Single deal view
│   │   │   ├── ChatInterfaceAI.jsx   # AI Assistant chat
│   │   │   └── Dashboard.jsx         # Main dashboard
│   │   ├── api/
│   │   │   ├── DealService.js        # Deal API functions
│   │   │   └── apiRoutes.js          # API endpoint URLs
│   │   └── services/
│   │       └── snfAlgorithm/
│   │           └── snfEvaluator.js   # Local SNF algorithm
│   └── .env                          # REACT_APP_GEMINI_API_KEY, etc.
│
└── PROJECT_CONTEXT.md                # This file
```

---

## Database Schema

### deals table (34 columns + JSON blob)

#### Identification
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| master_deal_id | INTEGER | Parent deal (portfolios) |
| user_id | INTEGER | Owner |
| deal_lead_id | INTEGER | Assigned lead |

#### Deal Info
| Field | Type | Description |
|-------|------|-------------|
| deal_name | STRING | Deal name |
| deal_type | STRING | Acquisition, Disposition |
| deal_status | STRING | pipeline, due_diligence, closed |
| priority_level | STRING | High, Medium, Low |
| deal_source | STRING | Broker, direct, etc. |
| target_close_date | DATE | Expected close |

#### Facility Info
| Field | Type | Description |
|-------|------|-------------|
| facility_name | STRING | Facility name |
| facility_type | STRING | SNF, ALF, Memory Care, CCRC |
| no_of_beds | INTEGER | Bed/unit count |
| street_address | STRING | Address |
| city | STRING | City |
| state | STRING | State |
| zip_code | STRING | ZIP |
| country | STRING | Country (default: USA) |

#### Contact Info
| Field | Type | Description |
|-------|------|-------------|
| primary_contact_name | STRING | Contact name |
| title | STRING | Contact title |
| phone_number | STRING | Phone |
| email | STRING | Email |

#### Financial Metrics
| Field | Type | Description |
|-------|------|-------------|
| purchase_price | FLOAT | Total price ($) |
| price_per_bed | FLOAT | Price per bed ($) |
| annual_revenue | FLOAT | T12 revenue ($) |
| revenue_multiple | FLOAT | Price / Revenue (x) |
| ebitda | FLOAT | T12 EBITDA ($) |
| ebitda_multiple | FLOAT | Price / EBITDA (x) |
| ebitda_margin | FLOAT | EBITDA / Revenue (%) |
| net_operating_income | FLOAT | NOI ($) |

#### Operational Metrics
| Field | Type | Description |
|-------|------|-------------|
| current_occupancy | FLOAT | Occupancy (%) |
| average_daily_rate | FLOAT | ADR ($) |
| medicare_percentage | FLOAT | Medicare mix (%) |
| private_pay_percentage | FLOAT | Private pay mix (%) |

#### Investment Targets
| Field | Type | Description |
|-------|------|-------------|
| target_irr_percentage | FLOAT | Target IRR (%) |
| target_hold_period | FLOAT | Hold period (years) |
| projected_cap_rate_percentage | FLOAT | Target cap rate (%) |
| exit_multiple | FLOAT | Exit multiple (x) |

#### AI Extraction Data
| Field | Type | Description |
|-------|------|-------------|
| extraction_data | TEXT/JSON | Full AI extraction response |

The `extraction_data` JSON contains extended fields not in columns:
- EBITDAR, EBIT, revenue breakdown by payer
- Rate schedules (private pay, Medicaid arrays)
- Pro forma projections (3 years)
- YTD performance data
- Confidence scores per field (`_confidenceMap`)
- Source citations per field (`_sourceMap`)
- Calculation verification details
- Data quality notes

### deal_facilities table (multi-facility support)

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| deal_id | INTEGER | FK to deals |
| facility_name | STRING | Facility name |
| facility_type | STRING | SNF, ALF, etc. |
| address, city, state, zip_code | STRING | Location |
| total_beds, licensed_beds | INTEGER | Bed counts |
| purchase_price | FLOAT | Individual price |
| annual_revenue | FLOAT | T12 revenue |
| ebitda, ebitdar, noi | FLOAT | Financials |
| occupancy_rate | FLOAT | Occupancy (%) |
| medicare_mix, medicaid_mix, private_pay_mix | FLOAT | Payer mix (%) |
| display_order | INTEGER | Sort order |
| extraction_data | TEXT/JSON | Raw extraction |

---

## API Endpoints

### Deal CRUD
```
POST   /api/v1/deal/create-deals          Create deal(s)
GET    /api/v1/deal/get-deals             List all deals
GET    /api/v1/deal/get-deal-by-id?id=X   Get single deal
POST   /api/v1/deal/update-deal           Update deal
DELETE /api/v1/deal/delete-deal/:id       Delete deal
```

### AI Extraction
```
POST   /api/v1/deal/extract               Extract from documents (Claude)
```

### Calculator
```
GET    /api/v1/deal/calculate/:dealId              Calculate deal metrics
GET    /api/v1/deal/calculate-portfolio/:masterId  Portfolio metrics
```

### Facilities
```
GET    /api/v1/deal/:dealId/facilities             List facilities
POST   /api/v1/deal/:dealId/facilities             Create facility
POST   /api/v1/deal/:dealId/facilities/bulk        Bulk create
PUT    /api/v1/deal/:dealId/facilities/reorder     Reorder
GET    /api/v1/deal/facility/:facilityId           Get facility
PUT    /api/v1/deal/facility/:facilityId           Update facility
DELETE /api/v1/deal/facility/:facilityId           Delete facility
```

### Documents
```
POST   /api/v1/deal/add-deal-document     Upload document
GET    /api/v1/deal/get-deal-documents    List documents
DELETE /api/v1/deal/delete-deal-document  Delete document
```

---

## Production Databases

SNFalyze uses THREE PostgreSQL databases on Render:

### 1. snf_platform (CMS Survey & Facility Data)
**Connection:** `DATABASE_URL` environment variable
**Purpose:** CMS survey citations, deficiencies, facility details

| Table | Records | Description |
|-------|---------|-------------|
| health_citations | 417K | Survey deficiency records (2017-present) |
| survey_dates | 151K | Survey visit dates by type |
| snf_facilities | 14.6K | Facility details (name, address, beds, lat/lng) |
| citation_descriptions | 551 | F-Tag descriptions |
| facility_bellwether_relationships | — | Predictive survey patterns |
| survey_alert_subscriptions | — | User alert preferences |
| survey_alerts | — | Generated alerts |

### 2. snf_market_data (Market Analytics)
**Connection:** `MARKET_DATABASE_URL` environment variable
**Purpose:** Market-level analytics, ownership chains, M&A activity

| Table | Description |
|-------|-------------|
| ownership_profiles | Parent organizations |
| snf_ownership_data | Facility-to-owner mappings |
| snf_vbp_performance | Value-Based Purchasing scores |
| market_comments | User comments on markets |

### 3. snfalyze_db (Application Data)
**Connection:** `DATABASE_URL` in production app
**Purpose:** Deals, users, documents, activity

| Table | Description |
|-------|-------------|
| deals | Deal records |
| deal_facilities | Multi-facility support |
| users | User accounts |
| facility_comments | User comments on facilities |

---

## Survey Intelligence API

**Base URL:** `/api/v1/survey-intelligence`
**Database:** snf_platform (Render PostgreSQL)
**Total Endpoints:** 26

### National & State Analytics
```
GET /national/summary              YTD national survey stats
GET /national/trends?months=12     Monthly trend data
GET /states                        All states summary (survey counts, citations)
GET /states/:stateCode             State detail with top facilities
GET /states/:stateCode/trends      State monthly trends
```

### F-Tag Analysis
```
GET /ftags/top?limit=20&state=CA   Top deficiency tags
GET /ftags/:ftagCode               F-Tag detail with trends
```

### Timing Patterns
```
GET /patterns/day-of-week          Survey distribution by day (Thu=peak)
GET /patterns/week-of-month        Distribution by week (Week 4=peak)
GET /patterns/seasonal             Monthly patterns (Aug-Oct=peak)
```

### Regional Activity
```
GET /regions/hotspots?days=30      Counties with most activity
GET /counties/:state/:county/activity  County survey detail
GET /nearby?lat=X&lng=Y&radius=10  Geographic proximity search
```

### Facility Forecasts
```
GET /facilities/:ccn/forecast      Survey probability prediction
GET /facilities/:ccn/history       Past survey results
GET /facilities/:ccn/regional-activity  Nearby facility surveys
GET /facilities/:ccn/risk-profile  Risk assessment with prep checklist
```

### Bellwether System
Identifies facilities consistently surveyed first in an area (predictive signals).

```
GET  /bellwethers/:ccn             Bellwether relationships for facility
GET  /bellwethers/:ccn/signals     Active signals (nearby bellwether surveyed)
POST /bellwethers/calculate        Calculate patterns for state/county
     Body: { state: "CA", county: "Los Angeles", min_occurrences: 3 }
POST /bellwethers/update-signals   Refresh signals after new survey data
```

### Alert System
```
GET    /alerts?user_id=X           User's survey alerts
POST   /alerts/subscribe           Subscribe to alerts
       Body: { user_id, federal_provider_number, alert_types: ["bellwether"] }
PUT    /alerts/:alertId/read       Mark alert as read
DELETE /alerts/subscribe/:id       Unsubscribe
```

### Metadata
```
GET /meta/freshness                Data recency (lag days, coverage)
```

### Key Probability Factors (from forecast endpoint)
```javascript
// Day-of-week factors (surveys rarely on weekends)
DOW_FACTORS = { Sun: 0.1, Mon: 1.0, Tue: 1.1, Wed: 1.4, Thu: 1.1, Fri: 0.3, Sat: 0.1 }

// Week-of-month factors (Week 4 highest)
WEEK_FACTORS = { 1: 0.9, 2: 1.0, 3: 0.9, 4: 1.3 }

// Seasonal factors (Aug-Oct peak, Dec low)
SEASONAL_FACTORS = { Jan: 0.8, ..., Aug: 1.1, Sep: 1.1, Oct: 1.1, Nov: 0.9, Dec: 0.7 }

// Federal maximum survey interval: 456 days (15 months)
```

---

## Market Analysis API

**Base URL:** `/api/v1/markets`
**Database:** snf_market_data

```
GET /states                        List states with facility counts
GET /states/:stateCode             State market summary
GET /states/:stateCode/counties    Counties in state with metrics
GET /counties/:stateCode/:county   County detail with facilities
GET /facilities/search             Search facilities by name/CCN
GET /facilities/:ccn               Facility detail with quality scores
```

---

## Ownership Research API

**Base URL:** `/api/v1/ownership`
**Database:** snf_market_data

```
GET /profiles                      Search ownership profiles
GET /profiles/:id                  Profile detail with facilities
GET /profiles/:id/facilities       Facilities owned by organization
GET /profiles/:id/timeline         Acquisition history
GET /chain/:ccn                    Ownership chain for facility
```

---

## M&A Intelligence API

**Base URL:** `/api/v1/ma-analytics`
**Database:** snf_market_data

```
GET /activity/recent               Recent M&A transactions
GET /activity/by-state             Transactions by state
GET /activity/by-operator          Transactions by buyer/seller
GET /targets/potential             Potential acquisition targets
GET /valuations/comparables        Comparable transaction analysis
```

---

## Facility Metrics API

**Base URL:** `/api/v1/facilities`
**Database:** snf_platform + snf_market_data

```
GET /:ccn/overview                 Facility summary (beds, occupancy, ratings)
GET /:ccn/quality                  Star ratings, health inspections
GET /:ccn/staffing                 Staffing hours, turnover
GET /:ccn/citations                Recent deficiencies
GET /:ccn/ownership                Current owner + history
GET /:ccn/financials               Cost report data (if available)
```

---

## Data Flow

### 1. Document Extraction (ONE TIME)
```
User uploads PDF/Excel
        ↓
Backend extracts text (pdf-parse, XLSX)
        ↓
If PDF text < 100 chars → Convert to images (pdf-to-img)
        ↓
Send to Claude API with extraction prompt
        ↓
Claude returns structured JSON with confidence scores
        ↓
Flatten response → Save to deals table
        ↓
Documents NOT re-scanned after this
```

### 2. Calculator (NO AI)
```
Frontend requests /calculate/:dealId
        ↓
Backend reads deal from database
        ↓
calculatorService.js computes metrics (pure JS math)
        ↓
Returns: price_per_bed, multiples, cap_rate, margins
        ↓
NO API CALLS - instant response
```

### 3. AI Assistant Chat (Gemini)
```
User types question
        ↓
Frontend builds dealContext from STORED deal data
        ↓
Includes SNF algorithm results if available
        ↓
Calls Gemini 2.0 Flash API
        ↓
Returns AI response
        ↓
Uses DATABASE fields, NOT original documents
```

### 4. SNF Algorithm (LOCAL - NO AI)
```
User clicks quick action button
        ↓
snfEvaluator.js runs in browser
        ↓
Compares deal against Cascadia benchmarks
        ↓
Returns scores, risks, recommendations
        ↓
NO API CALLS - runs entirely in browser
```

---

## AI Extraction Schema

Claude extracts and returns this structure:

```javascript
{
  // Document identification
  document_types_identified: ["P&L", "Census Report", "Rate Schedule"],
  is_portfolio_deal: false,
  facility_count: 1,

  // Deal information
  deal_information: {
    deal_name: { value: "...", confidence: "high", source: "CIM.pdf | Page 1" },
    purchase_price: { value: 15000000, confidence: "high", source: "..." },
    price_per_bed: { value: 150000, confidence: "medium", calculated: true }
  },

  // Facility information
  facility_information: {
    facility_name: { value: "...", confidence: "high", source: "..." },
    facility_type: { value: "Assisted Living", confidence: "high", source: "..." },
    city: { value: "Portland", confidence: "medium", source: "Floor_Plan.pdf | Page 1" },
    state: { value: "OR", confidence: "high", source: "Rate schedule header" },
    bed_count: { value: 100, confidence: "medium", method: "inferred_from_census" }
  },

  // T12 Financial information
  financial_information_t12: {
    period: { start: "2024-05-01", end: "2025-04-30" },
    total_revenue: { value: 3933015, confidence: "high", source: "P&L.xlsx | Sheet 'Summary'" },
    total_expenses: { value: 4018015, confidence: "high", source: "..." },
    net_income: { value: -85000, confidence: "high", source: "..." },
    ebit: { value: -60000, confidence: "medium", calculated: true },
    ebitda: { value: -25000, confidence: "medium", calculated: true },
    ebitdar: { value: 15000, confidence: "medium", calculated: true },
    revenue_by_payer: {
      medicaid_revenue: { value: 2500000, confidence: "high" },
      private_pay_revenue: { value: 1400000, confidence: "high" }
    },
    calculation_details: {
      net_income: -85000,
      interest_expense_addback: 25000,
      depreciation_addback: 35000,
      rent_expense_addback: 40000
    }
  },

  // Census and occupancy
  census_and_occupancy: {
    average_daily_census: { value: 85, confidence: "high", source: "Census.pdf" },
    occupancy_percentage: { value: 85, confidence: "medium", calculated: true },
    payer_mix_by_census: {
      medicaid_pct: { value: 65, confidence: "high" },
      private_pay_pct: { value: 35, confidence: "high" }
    }
  },

  // Rate information
  rate_information: {
    private_pay_rates: {
      value: [
        { unit_type: "Studio", monthly_rate: 4128, care_levels: { L1: 676, L2: 889 } },
        { unit_type: "1 Bedroom", monthly_rate: 4992 }
      ],
      confidence: "high",
      source: "Rate_Schedule.pdf | Page 1"
    },
    medicaid_rates: {
      value: [
        { care_level: "Level 1", monthly_rate: 1980 },
        { care_level: "Level 2", monthly_rate: 2454 }
      ],
      confidence: "high"
    }
  },

  // Pro forma projections
  pro_forma_projections: {
    year_1: { revenue: { value: 4200000 }, ebitdar: { value: 150000 } },
    year_2: { revenue: { value: 4500000 }, ebitdar: { value: 250000 } },
    year_3: { revenue: { value: 4800000 }, ebitdar: { value: 350000 } }
  },

  // Data quality
  data_quality_notes: ["City inferred from floor plan", "EBITDA calculated from line items"],
  key_observations: ["Operating at loss", "Turnaround opportunity", "Strong private pay mix"]
}
```

### Confidence Levels
- **high**: Explicitly stated in document
- **medium**: Calculated or strongly inferred
- **low**: Inferred with uncertainty
- **not_found**: Field not found in any document

---

## Calculator Formulas

```javascript
// From calculatorService.js

// Price Metrics
pricePerBed = purchasePrice / numberOfBeds
revenueMultiple = purchasePrice / annualRevenue
ebitdaMultiple = purchasePrice / ebitda
ebitdarMultiple = purchasePrice / ebitdar

// Performance Metrics
capRate = (noi / purchasePrice) * 100
ebitdaMargin = (ebitda / annualRevenue) * 100
ebitdarMargin = (ebitdar / annualRevenue) * 100

// Per-Bed Metrics
revenuePerBed = annualRevenue / numberOfBeds
ebitdaPerBed = ebitda / numberOfBeds
revenuePerOccupiedBed = annualRevenue / (numberOfBeds * occupancy)

// Coverage & Projections
rentCoverageRatio = ebitdar / currentRentExpense
impliedValueAtTargetCap = noi / (targetCapRate / 100)
exitValueAtMultiple = ebitda * exitMultiple

// Stabilized (at 95% occupancy)
stabilizedRevenue = annualRevenue * (0.95 / currentOccupancy)
stabilizedNOI = stabilizedRevenue * currentMargin
stabilizedCapRate = (stabilizedNOI / purchasePrice) * 100
```

---

## SNF Algorithm Benchmarks (Cascadia Targets)

```javascript
// From snfEvaluator.js

EBITDA_MARGIN_TARGET: 0.09      // 9%
EBITDAR_MARGIN_TARGET: 0.23     // 23%
OCCUPANCY_TARGET: 0.85          // 85%
PUBLIC_REIT_YIELD: 0.09         // 9%
PRIVATE_REIT_YIELD: 0.10        // 10%
MIN_COVERAGE_RATIO: 1.5         // 1.5x rent coverage

// Risk thresholds
HIGH_RISK_OCCUPANCY: 0.75       // Below 75% = high risk
MEDIUM_RISK_OCCUPANCY: 0.80     // Below 80% = medium risk
HIGH_MEDICAID_MIX: 0.70         // Above 70% Medicaid = risk
```

---

## Environment Variables

### Backend (.env)
```
ANTHROPIC_API_KEY=sk-ant-...     # Claude API
DATABASE_URL=postgres://...       # Production DB (optional)
PORT=3001
```

### Frontend (.env)
```
REACT_APP_API_BASE_URL=http://localhost:3001/api/v1
REACT_APP_GEMINI_API_KEY=...     # Gemini API for chat
```

---

## Key Implementation Notes

1. **Extraction happens ONCE** - Documents are parsed when uploaded, data saved to DB, never re-scanned

2. **Calculator is pure JS** - No AI calls, uses stored DB values, instant response

3. **AI Assistant uses Gemini** - Reads from stored deal data, NOT original documents

4. **SNF Algorithm is local** - Runs entirely in browser, no API calls

5. **Multi-facility support** - deal_facilities table links multiple facilities to one deal

6. **Confidence tracking** - Every extracted field has confidence level and source citation

7. **Vision fallback** - PDFs with <100 chars text are converted to images for Claude vision

8. **Combined extraction** - Multiple documents sent in ONE Claude call for cross-referencing

---

## FULL AI EXTRACTION PROMPT

This is the complete prompt sent to Claude for document extraction (from `aiExtractor.js`):

```
You are an expert healthcare M&A analyst specializing in skilled nursing facilities (SNF), assisted living facilities (ALF), and senior housing acquisitions. You extract structured deal data from CIMs, broker packages, P&L statements, census reports, rent rolls, and rate schedules.

## STEP 1: DOCUMENT IDENTIFICATION
First, identify what types of documents you're analyzing:
- P&L / Income Statement → Extract revenue, expenses, calculate EBITDAR/EBITDA
- Census Report → Extract occupancy, payer mix, infer bed count from max census
- Rent Roll → Extract unit mix, unit count, rental rates
- Rate Schedule → Extract pricing tiers by payer type
- Floor Plans → Extract location info, unit counts
- CIM/Offering Memo → Extract deal terms, pricing, contact info

## STEP 2: EXTRACTION RULES

### Deal Name:
- If explicit deal name found in CIM/Offering Memo, use it
- If no deal name found but facility_name exists: deal_name = facility_name + " Acquisition"
- Always populate deal_name if facility_name is available

### Facility Type Identification:
- "ALF", "Assisted Living", "RCF", "Residential Care" → "Assisted Living"
- "SNF", "Skilled Nursing", "Nursing Facility", "NF" → "SNF"
- "Memory Care", "MC", "Dementia Care" → "Memory Care"
- "IL", "Independent Living" → "Independent Living"
- "CCRC", "Continuing Care" → "CCRC"
- If document has Medicaid care levels L1-L5 (not RUG/PDPM), likely ALF

### Location Extraction (CRITICAL - READ CAREFULLY):
1. Extract STATE first from: rate schedules (e.g., "Oregon DHS" = OR), document headers, addresses, letterheads
2. Extract CITY from: architect stamps, letterheads, facility addresses, report headers
3. VALIDATION REQUIRED: City MUST exist in the identified state
   - If state = "OR" or "Oregon", valid cities include: Portland, Salem, Eugene, Bend, Medford, etc.
   - If state = "OR" or "Oregon", INVALID cities include: Phoenix, Tucson, Los Angeles, Seattle, etc.
   - If city appears inconsistent with state, set city to NULL and add to data_quality_notes
4. Common location sources:
   - Architect stamps on floor plans (e.g., "Portland, Oregon 97204")
   - State agency references (e.g., "Oregon Department of Human Services" = Oregon facility)
   - Rate schedules from state agencies
5. NEVER guess a city. If uncertain, return null rather than a wrong city.

### Bed/Unit Count:
- If explicit bed count found, use it
- Otherwise: bed_count = MAX(census values across all months) rounded up to nearest 5
- For ALF, may be called "units" not "beds"

### TTM Financial Calculations (CRITICAL):

When multiple financial documents are available (e.g., historical T12 + YTD):
1. IDENTIFY the most recent complete month across all documents
2. BUILD the freshest possible trailing 12 months by combining data sources
3. SPECIFY the exact period used in period.start and period.end

Example:
- T12 file covers: May 2024 - April 2025
- YTD file covers: March 2025 - September 2025
- CALCULATE: October 2024 - September 2025 (freshest T12)
  - Oct 2024 - Feb 2025: Pull from T12 file
  - Mar 2025 - Sep 2025: Pull from YTD file

### EBIT/EBITDA/EBITDAR Calculation (MUST FOLLOW EXACTLY):

Step 1: Find these SPECIFIC line items in the P&L and sum for the TTM period:
- DEPRECIATION: Look for "DEPRECIATION" in Property Related section (~$21K/month typical)
- INTEREST_EXPENSE: Look for "BOND INTEREST EXPENSE" or "INTEREST EXPENSE" (~$10.6K/month typical)
- RENT_EXPENSE: Look for "LAND LEASE" or "RENT EXPENSE" (~$4K/month typical)
- NET_INCOME: Look for "TOTAL INCOME (LOSS)" or "NET INCOME" at bottom of P&L

Step 2: Calculate in this EXACT order:
EBIT = NET_INCOME + INTEREST_EXPENSE
EBITDA = EBIT + DEPRECIATION
EBITDAR = EBITDA + RENT_EXPENSE

Step 3: Validate your math:
- EBITDAR should be LESS negative (or more positive) than EBITDA
- EBITDA should be LESS negative (or more positive) than EBIT
- EBIT should be LESS negative (or more positive) than NET_INCOME
- If this order is wrong, you made a calculation error

Step 4: Include calculation details in output:
"calculation_details": {
"net_income": [value],
"interest_expense_addback": [value],
"depreciation_addback": [value],
"rent_expense_addback": [value]
}

### Revenue by Payer Source (REQUIRED):
From P&L statements, extract DOLLAR AMOUNTS for each payer source:
- medicaid_revenue: Look for "Medicaid Revenue", "Title XIX", "Medicaid Room & Board"
- medicare_revenue: Look for "Medicare Revenue", "Title XVIII"
- private_pay_revenue: Look for "Private Pay Revenue", "Private Room & Board"
- other_revenue: Any other revenue sources (respite, ancillary, etc.)

Calculate percentage of total for each, but store the ACTUAL DOLLAR AMOUNTS.

### Payer Mix Percentages (REQUIRED):
From Census Reports:
1. Find total census days by payer type: Medicaid days, Private Pay days, Medicare days
2. Calculate percentages: (payer_days / total_days) * 100
3. Verify percentages sum to ~100%

From P&L Revenue:
1. Use the revenue_by_payer amounts above
2. Calculate percentages: (payer_revenue / total_revenue) * 100

ALWAYS extract both census-based AND revenue-based payer mix when data is available.

### Rate Schedule Extraction (REQUIRED):
Extract ALL rate information found:

Private Pay Rates - look for:
- Base rent by unit type (Studio, 1BR, 2BR, etc.)
- Care level add-ons (L1, L2, L3, etc.)
- Additional person/spouse fees

Medicaid Rates - look for:
- Rates by care level (Level 1 through Level 5)
- Room and board components
- State rate schedules

Format as arrays:
"private_pay_rates": [
{"unit_type": "Studio", "monthly_rate": 4128, "care_levels": {"L1": 676, "L2": 889, "L3": 1158}},
{"unit_type": "1 Bedroom", "monthly_rate": 4992}
]
"medicaid_rates": [
{"care_level": "Level 1", "monthly_rate": 1980},
{"care_level": "Level 2", "monthly_rate": 2454}
]

### Contact Information Extraction:
- Look for "User:", "Prepared by:", "Generated by:" in report headers
- Look for email patterns: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}
- Look for phone patterns: \\(?\\d{3}\\)?[-.\s]?\\d{3}[-.\s]?\\d{4}
- PointClickCare reports show "User: [Name]" - extract as contact if no other found

### Occupancy Calculation:
occupancy_pct = (average_daily_census / bed_count) * 100
Mark as calculated: true

## STEP 3: SOURCE CITATION FORMAT (CRITICAL)

For EVERY extracted value, provide detailed source citations that allow users to find the exact location in the original document:

### Source Reference Structure:
Each "source" field should include:
- **document**: The exact filename (e.g., "Trailing_12-Month_P&L.xlsx")
- **location**: Specific location within the document:
  - For Excel: "Sheet '[SheetName]', Row [X]" or "Sheet '[SheetName]', Cell [A1]"
  - For PDF: "Page [X]" or "Page [X], Section '[Header]'"
  - For Word/Text: "Page [X]" or "Section '[Header]'"
- **snippet**: A brief text snippet showing the exact text where the value was found (10-50 chars)

Example source formats:
- "Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45 | 'Total Revenue: $3,933,015'"
- "Census_Report.pdf | Page 2 | 'Average Daily Census: 94'"
- "Rate-schedule_July_2025.pdf | Page 1, Care Level Table | 'Level 1: $1,980/month'"

For calculated values, show the source as:
- "Calculated | [formula description] | Based on: [source fields]"

## STEP 4: MULTI-FACILITY DETECTION

If the documents contain data for MULTIPLE FACILITIES:
1. Look for multiple facility names, addresses, or distinct financial line items per facility
2. CIMs often list multiple properties in a portfolio deal
3. Separate P&L sheets per facility indicate multi-facility
4. If detected, populate the "facilities" array with individual facility data

If SINGLE FACILITY:
- Leave "facilities" array empty or omit it
- Populate the main facility_information section

## CRITICAL RULES:

1. **Numeric values**: Return raw numbers only (no $, %, commas). "15M" → 15000000, "85%" → 85

2. **Negative values**: Operating losses should be negative numbers

3. **Calculations**: Always show "calculated": true when you derived a value

4. **Confidence levels**:
   - "high" = explicitly stated in document
   - "medium" = calculated from explicit data or strongly inferred
   - "low" = inferred from indirect evidence
   - "not_found" = field not found in any document

5. **Location validation**: If city doesn't match state, set city to null and add note to data_quality_notes. NEVER return Phoenix for an Oregon facility.

6. **Facility type**: Use document terminology as evidence (ALF/RCF docs = "Assisted Living", not SNF)

7. **Deal name fallback**: If no explicit deal name, use: facility_name + " Acquisition"

8. **EBITDAR math validation**:
   - EBITDAR > EBITDA > EBIT > Net Income (in terms of being less negative or more positive)
   - If this doesn't hold, recheck your calculations

9. **Payer mix required**: Always extract payer mix from census data when available. Sum should be ~100%.

10. **Rate tables required**: Always extract rate information when rate schedules are provided.

11. **Source attribution**: Include source document name for key fields to enable verification.

12. **Return ONLY valid JSON**, no markdown code blocks, no explanatory text before or after.
```

---

## FULL SNF DEAL EVALUATOR ALGORITHM

This is the complete local algorithm (from `snfEvaluator.js`) that runs in the browser with NO API calls:

### Cascadia Benchmarks (Targets)

```javascript
const CASCADIA_BENCHMARKS = {
  targetEBITDA: 0.09,        // 9% EBITDA margin target
  targetEBITDAR: 0.23,       // 23% EBITDAR margin target
  maxBadDebt: 0.01,          // <1% bad debt
  defaultCapRate: 0.125,     // 12.5% cap rate
  publicREITYield: 0.09,     // 9% yield for public REIT
  privateREITYield: 0.10,    // 10% yield for private REIT
  minCoverageRatio: 1.4      // 1.4x minimum rent coverage
};
```

### State Reimbursement Rates

```javascript
const STATE_REIMBURSEMENT_RATES = {
  'WA': { medicare: 450, medicaid: 280 },
  'CA': { medicare: 480, medicaid: 320 },
  'TX': { medicare: 420, medicaid: 250 },
  'FL': { medicare: 440, medicaid: 270 },
  'NY': { medicare: 520, medicaid: 380 }
};
```

### Financial Normalizer Class

```javascript
class FinancialNormalizer {
  // Calculate EBITDA - use actual if available, otherwise estimate at 9% of revenue
  static calculateEBITDA(facility) {
    if (facility.t12m_ebitda && facility.t12m_ebitda > 0) {
      return facility.t12m_ebitda;
    }
    return facility.t12m_revenue ? facility.t12m_revenue * 0.09 : 0;
  }

  // Calculate EBITDAR - use actual if available, otherwise estimate at 23% of revenue
  static calculateEBITDAR(facility) {
    if (facility.t12m_ebitdar && facility.t12m_ebitdar > 0) {
      return facility.t12m_ebitdar;
    }
    return facility.t12m_revenue ? facility.t12m_revenue * 0.23 : 0;
  }

  // Calculate occupancy - default to 75% if not provided
  static calculateOccupancyRate(facility) {
    if (facility.t12m_occupancy && facility.t12m_occupancy > 0) {
      return facility.t12m_occupancy;
    }
    return 0.75; // Default assumption
  }

  // Price per bed
  static calculatePricePerBed(facility) {
    const totalBeds = this.getTotalBeds(facility);
    return totalBeds > 0 ? (facility.purchase_price || 0) / totalBeds : 0;
  }

  // Revenue per bed
  static calculateRevenuePerBed(facility) {
    const totalBeds = this.getTotalBeds(facility);
    return totalBeds > 0 ? (facility.t12m_revenue || 0) / totalBeds : 0;
  }
}
```

### Deal Valuator Class

```javascript
class DealValuator {
  // Main evaluation function
  static evaluateDeal(deal, normalizedFacilities) {
    return {
      dealId: deal.id,
      dealName: deal.deal_name,
      facilities: normalizedFacilities.map(f => this.evaluateFacility(f, deal)),
      overallMetrics: this.calculateOverallMetrics(facilities),
      riskAssessment: this.assessRisk(facilities, deal),
      reitCompatibility: this.assessREITCompatibility(overallMetrics),
      recommendations: this.generateRecommendations(evaluation)
    };
  }

  // Performance vs benchmarks
  static evaluateFacility(facility, deal) {
    const ebitda = FinancialNormalizer.calculateEBITDA(facility);
    const ebitdar = FinancialNormalizer.calculateEBITDAR(facility);
    const occupancy = FinancialNormalizer.calculateOccupancyRate(facility);

    return {
      performance: {
        ebitdaVsTarget: ebitda / (facility.t12m_revenue * 0.09),   // vs 9% target
        ebitdarVsTarget: ebitdar / (facility.t12m_revenue * 0.23), // vs 23% target
        occupancyVsTarget: occupancy / 0.85,                       // vs 85% target
        pricePerBedVsMarket: this.comparePricePerBedToMarket(pricePerBed, facility.state)
      },
      riskFactors: this.identifyRiskFactors(facility, performance)
    };
  }

  // Risk identification
  static identifyRiskFactors(facility, performance) {
    const risks = [];

    if (performance.ebitdaVsTarget < 0.8) {
      risks.push({ type: 'financial', severity: 'high', description: 'EBITDA significantly below target (9%)' });
    }

    if (performance.ebitdarVsTarget < 0.8) {
      risks.push({ type: 'financial', severity: 'high', description: 'EBITDAR significantly below target (23%)' });
    }

    if (performance.occupancyVsTarget < 0.8) {
      risks.push({ type: 'operational', severity: 'medium', description: 'Occupancy below target (85%)' });
    }

    if (performance.pricePerBedVsMarket > 1.2) {
      risks.push({ type: 'valuation', severity: 'medium', description: 'Price per bed above market rate' });
    }

    return risks;
  }

  // REIT compatibility assessment
  static assessREITCompatibility(overallMetrics) {
    const coverageRatio = overallMetrics.totalEBITDAR / (overallMetrics.totalPurchasePrice * 0.1);

    return {
      publicREITYield: overallMetrics.weightedAverageCapRate,
      privateREITYield: overallMetrics.weightedAverageCapRate,
      coverageRatio,
      meetsPublicREITRequirements: overallMetrics.weightedAverageCapRate >= 0.09,  // 9%
      meetsPrivateREITRequirements: overallMetrics.weightedAverageCapRate >= 0.10, // 10%
      meetsCoverageRatio: coverageRatio >= 1.4
    };
  }
}
```

### Deal Scoring System

```javascript
class SNFDealEvaluator {
  // Calculate overall deal score (0-100)
  static calculateDealScore(evaluation) {
    let score = 100;

    // Deduct for financial performance
    if (evaluation.overallMetrics.weightedAverageCapRate < 0.125) {
      score -= 20;
    }

    // Deduct for occupancy issues
    if (evaluation.overallMetrics.weightedAverageOccupancy < 0.85) {
      score -= 15;
    }

    // Deduct for risk factors
    if (evaluation.riskAssessment.overallRisk === 'high') {
      score -= 25;
    } else if (evaluation.riskAssessment.overallRisk === 'medium') {
      score -= 10;
    }

    // Deduct for REIT incompatibility
    if (!evaluation.reitCompatibility.meetsPublicREITRequirements) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Investment recommendation based on score
  static getInvestmentRecommendation(evaluation) {
    const score = this.calculateDealScore(evaluation);

    if (score >= 80) return 'STRONG BUY';
    if (score >= 65) return 'BUY';
    if (score >= 50) return 'HOLD';
    if (score >= 35) return 'SELL';
    return 'STRONG SELL';
  }
}
```

### Market Price Per Bed Benchmarks

```javascript
const marketRates = {
  'WA': 180000,  // Washington
  'CA': 220000,  // California
  'TX': 160000,  // Texas
  'FL': 170000,  // Florida
  'NY': 250000   // New York
};
```

### State Risk Adjustments

```javascript
const riskAdjustments = {
  'CA': 0.02,   // +2% (Higher regulatory risk)
  'NY': 0.015,  // +1.5% (High cost state)
  'TX': -0.01,  // -1% (Lower risk)
  'FL': 0.005,  // +0.5% (Moderate risk)
  'WA': 0.01    // +1% (Moderate risk)
};
```

---

## AI ASSISTANT CHAT PROMPT

The prompt sent to Gemini 2.0 Flash for free-form questions (from `ChatInterfaceAI.jsx`):

```
You are SNFalyze.ai, an advanced M&A deal analysis assistant specializing in Skilled Nursing Facility (SNF) deals. You use Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm to provide sophisticated analysis.

Here is the deal context:
[dealContext - populated from stored database fields]

Conversation so far:
[chat history]

Respond to the user's last message with actionable, insightful, and concise analysis based on SNF industry expertise and the algorithm results. Focus on:
- Financial performance vs Cascadia benchmarks (9% EBITDA, 23% EBITDAR, 85% occupancy)
- Risk assessment and mitigation strategies
- REIT compatibility and optimization opportunities
- Market analysis and competitive positioning
- Turnaround potential and operational improvements

If relevant, suggest next steps or offer to generate a comprehensive report.
```

The `dealContext` is built from stored database fields:
```
Deal Name: [deal.deal_name]
Type: [deal.deal_type]
Total Deal Amount: [deal.total_deal_amount]
Status: [deal.deal_status]

Facility Information:
- Facility Name: [deal.facility_name]
- Facility Type: [deal.facility_type]
- Location: [deal.city], [deal.state]
- Number of Beds: [deal.no_of_beds]

Financial Metrics:
- Purchase Price: [deal.purchase_price]
- Price Per Bed: [deal.price_per_bed]
- Annual Revenue: [deal.annual_revenue]
- EBITDA: [deal.ebitda]
- EBITDA Margin: [deal.ebitda_margin]
- Net Operating Income: [deal.net_operating_income]

Operational Metrics:
- Current Occupancy: [deal.current_occupancy]
- Average Daily Rate: [deal.average_daily_rate]

Payer Mix:
- Medicare: [deal.medicare_percentage]
- Private Pay: [deal.private_pay_percentage]

Investment Targets:
- Target IRR: [deal.target_irr_percentage]
- Target Hold Period: [deal.target_hold_period]
- Projected Cap Rate: [deal.projected_cap_rate_percentage]
- Exit Multiple: [deal.exit_multiple]

[If SNF algorithm already ran, include evaluation results]
```
























## Key Files (Auto-Updated)

> This section is automatically updated on each commit.

### Backend Routes
```
backend/routes/apiUsers.js
backend/routes/auth.js
backend/routes/authentication.js
backend/routes/contracts.js
backend/routes/deal.js
backend/routes/dueDiligence.js
backend/routes/facilities.js
backend/routes/index.js
backend/routes/ma-analytics.js
backend/routes/market.js
backend/routes/markets.js
backend/routes/ownership.js
backend/routes/savedItems.js
backend/routes/stateRouter.js
backend/routes/survey.js
backend/routes/surveyIntelligence.js
backend/routes/taxonomy.js
backend/routes/user.js
backend/routes/users.js
backend/routes/wages.js
```

### Backend Services
```
backend/services/aiExtractor.js
backend/services/calculatorService.js
backend/services/censusDataRefreshService.js
backend/services/changeLogService.js
backend/services/cimExtractor.js
backend/services/cmsDataRefreshService.js
backend/services/dealChangeTracker.js
backend/services/extractionMerger.js
backend/services/extractionOrchestrator.js
backend/services/extractionPrompts.js
backend/services/extractionReconciler.js
backend/services/extractionValidator.js
backend/services/facilityMatcher.js
backend/services/fileStorage.js
backend/services/marketService.js
backend/services/normalizationService.js
backend/services/notificationService.js
backend/services/parallelExtractor.js
backend/services/periodAnalyzer.js
backend/services/periodAnalyzer.test.js
backend/services/proformaService.js
backend/services/ratioCalculator.js
```

### Backend Controllers
```
backend/controller/AuthenticationController.js
backend/controller/DealController.js
backend/controller/stateController.js
backend/controller/SurveyIntelligenceController.js
```

### Frontend Pages
```
frontend/src/pages/AcceptInvite.jsx
frontend/src/pages/AIAssistant.jsx
frontend/src/pages/ChatInterfaceAI.jsx
frontend/src/pages/CombinedDealForm.jsx
frontend/src/pages/CreateDeal.jsx
frontend/src/pages/CreateDealChoice.jsx
frontend/src/pages/CreateUser.jsx
frontend/src/pages/Dashboard.jsx
frontend/src/pages/DealDetail.jsx
frontend/src/pages/Deals.jsx
frontend/src/pages/EditCombinedDealForm.jsx
frontend/src/pages/EditCombinedDeatlForm1.jsx
frontend/src/pages/EditUser.jsx
frontend/src/pages/FacilityMetrics.jsx
frontend/src/pages/FacilityProfile.jsx
frontend/src/pages/LocationTest.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/MAIntelligence.jsx
frontend/src/pages/MarketAnalysis.jsx
frontend/src/pages/OwnershipProfile.jsx
frontend/src/pages/OwnershipResearch.jsx
frontend/src/pages/Profile.jsx
frontend/src/pages/renderStep1.jsx
frontend/src/pages/renderStep2.jsx
frontend/src/pages/renderStep3.jsx
frontend/src/pages/renderStep4.jsx
frontend/src/pages/SavedItems.jsx
frontend/src/pages/Signup.jsx
frontend/src/pages/SurveyAnalytics.jsx
frontend/src/pages/UploadDeal.jsx
frontend/src/pages/UserManagement.jsx
No pages found
```

### Frontend Components (Top Level)
```
ActivityHistory
AppHelpPanel
common
DataDictionaryTab
DealExtractionViewer
FacilityCommentsSection
FacilityMetrics
MAIntelligence
MarketAnalysis
MarketCommentsSection
MarketDynamicsTab
MarketScorecard
NotificationCenter
OwnershipResearch
ProFormaTab
SNFalyzePanel
ui
```

### Database Models
```
benchmark_configurations
cascadia_facility
comment_mentions
deal_change_logs
deal_comments
deal_documents
deal_expense_ratios
deal_external_advisors
deal_extracted_text
deal_facilities
deal_monthly_census
deal_monthly_expenses
deal_monthly_financials
deal_proforma_scenarios
deal_rate_schedules
deal_team_members
deal_user_views
deals
extraction_history
facility_change_logs
facility_comment_mentions
facility_comments
index
init-models
market_comment_mentions
market_comments
master_deals
ownership_change_logs
ownership_comment_mentions
ownership_comments
ownership_contacts
recent_activity
state
user_change_logs
user_invitations
user_notifications
user_saved_items
users
```

### Recent Migrations
```
backend/migrations/add-user-invitations-table.js
backend/migrations/add-market-comments-tables.js
backend/migrations/add-facility-comments-tables.js
backend/migrations/20241218-add-deal-match-status.js
backend/migrations/20241218-add-cms-facility-to-saved-items.js
backend/migrations/20241218-create-vbp-rankings-table.js
backend/migrations/20241218-add-ccn-to-deal-facilities.js
backend/migrations/add-deals-position-column.js
backend/migrations/add-cms-facility-saved-items.js
backend/migrations/create-cms-data-definitions.js
```

---
