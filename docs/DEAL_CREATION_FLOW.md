# SNFalyze Deal Creation Flow - Complete Reference

> **Purpose:** Single source of truth for the upload-to-deal-profile pipeline.
> **Last Updated:** December 19, 2025

---

## Quick Reference

| Stage | What Happens | Key Files | Output |
|-------|--------------|-----------|--------|
| 1. Upload | User uploads PDF/Excel/Word | `CombinedDealForm.jsx` | Files in memory |
| 2. Detect | AI detects facilities in docs | `facilityMatcher.js` | Detected facilities |
| 3. Confirm | User confirms/edits facilities | `FacilityConfirmationList.jsx` | Confirmed facilities |
| 4. Parse | Extract text from documents | `extractionOrchestrator.js` | Plain text per doc |
| 5. Analyze | Determine optimal T12 period | `periodAnalyzer.js` | Period strategy |
| 6. Extract | 6 parallel Claude API calls | `parallelExtractor.js` | Structured JSON |
| 7. Reconcile | Merge results, dedupe | `parallelExtractor.js` | Single extraction object |
| 8. Validate | Check data quality | `extractionValidator.js` | Errors/warnings |
| 9. Match | Find facility in ALF/SNF databases | `facilityMatcher.js` | Top 5 matches |
| 10. Review | User reviews form, resolves conflicts | `CombinedDealForm.jsx` | Final form data |
| 11. Create | Save to database + time-series | `DealController.js` | Deal ID |
| 12. Confirm Match | User selects facility match | `FacilityMatchModal.jsx` | Updated deal |

---

## Deal Types

The system supports two deal types:

| Type | Description | Flow Differences |
|------|-------------|------------------|
| **Single Facility** | One facility per deal | Standard extraction, single overview |
| **Portfolio** | 2+ facilities per deal | Per-facility extraction + portfolio-level analysis |

Portfolio detection triggers automatically when:
- Document mentions "2-Pack", "3-Pack", "Portfolio"
- Multiple distinct facility names detected
- CIM/Offering Memorandum contains multiple properties

---

## Stage 1: Document Upload

**Frontend:** `CombinedDealForm.jsx`

User uploads one or more files. Supported formats:
- **PDF** → `pdf-parse` library (falls back to `pdf-to-img` for scanned docs)
- **Excel** (.xlsx, .xls) → `xlsx` library
- **Word** (.docx) → string extraction
- **Text** (.txt, .csv) → direct read

Files are held in browser memory until extraction is triggered.

---

## Stage 2: Facility Detection (NEW)

**Backend:** `facilityMatcher.js` → `detectFacilitiesFromText()`

AI-powered detection of facilities mentioned in documents:

```
Document Text → Claude API → Detected Facilities Array
                              └─ name, city, state, beds
                              └─ confidence (high/medium/low)
                              └─ is_deal_facility (vs competitor/benchmark)
```

**Key Features:**
- Distinguishes deal facilities from competitor/benchmark mentions
- Detects portfolio deals ("2-Pack", "3-Pack")
- Returns confidence scores for each detection

**Output:**
```javascript
[
  {
    name: "Big Horn Care Center",
    city: "Sheridan",
    state: "WY",
    beds: 124,
    confidence: "high",
    is_deal_facility: true,
    is_portfolio: false
  }
]
```

---

## Stage 3: Facility Confirmation

**Frontend:** `FacilityConfirmationList.jsx`

User reviews and confirms detected facilities:
- Edit facility name, city, state, beds
- Remove incorrectly detected facilities
- Add missing facilities manually
- Confirm selection before extraction proceeds

For portfolios, all facilities must be confirmed before extraction.

---

## Stage 4: Document Parsing

**Backend:** `extractionOrchestrator.js` → `extractTextFromFile()`

Each file is converted to plain text:

```
PDF → extractTextFromPDF()
      └─ If < 100 chars extracted → convert to images → Claude Vision

Excel → extractTextFromExcel()
        └─ Formats as "ROW 1: cell | cell | cell\nROW 2: ..."

Word → mammoth or direct extraction
```

**Output:** Array of `{ name: string, text: string }` objects

---

## Stage 5: Period Analysis

**Backend:** `periodAnalyzer.js` → `analyzeFinancialPeriods()`

When multiple financial documents exist (e.g., T12 P&L + YTD I&E), determines the optimal trailing 12 months:

**Example:**
- T12 file: May 2024 - April 2025
- YTD file: March 2025 - September 2025
- **Result:** Build Oct 2024 - Sept 2025 by combining both

**Key Functions:**
- `isFinancialDocument()` - Detects P&L, I&E, T12, YTD documents
- `extractPeriodInfo()` - Extracts start/end dates from filename and content
- `determineOptimalT12()` - Combines documents for freshest 12-month window
- `generatePromptSection()` - Creates mandatory period constraints for Claude

**Output:**
```javascript
{
  financial_documents: [...],
  recommended_t12: {
    start: "2024-10-01",
    end: "2025-09-30",
    source_map: { "2024-10": "filename.pdf", ... }
  },
  combination_needed: true,
  warnings: []
}
```

---

## Stage 6: Parallel Extraction

**Backend:** `parallelExtractor.js` → `runParallelExtractions()`

### Step 6a: Combine Documents

All document texts are concatenated with headers:

```
=== DOCUMENT: Trailing_12-Month_P&L.xlsx ===
ROW 1: Date | Revenue | Expenses...
ROW 2: Jan-24 | 450000 | 380000...
...

=== DOCUMENT: Census_Report.pdf ===
Monthly Census Summary
Average Daily Census: 94
...
```

### Step 6b: Run 6 Focused Extractions

The **same combined text** is sent to Claude 6 times with different prompts:

| # | Extraction | Prompt Constant | What It Extracts |
|---|------------|-----------------|------------------|
| 1 | Facility | `FACILITY_PROMPT` | Name, type, state, contacts, purchase price |
| 2 | Financials | `FINANCIALS_PROMPT` | Monthly revenue, expenses, net income, EBITDA |
| 3 | Expenses | `EXPENSES_PROMPT` | Departmental breakdown (8 categories) |
| 4 | Census | `CENSUS_PROMPT` | Occupancy, ADC, payer days, payer mix %, admissions |
| 5 | Rates | `RATES_PROMPT` | Private pay rates, Medicaid rates by care level |
| 6 | Overview | `OVERVIEW_PROMPT` | Deal summary, red flags, strengths, diligence items |

**Execution:**
- **Phase 1:** Extractions 1-5 run in parallel (`Promise.allSettled`)
- **Phase 2:** Extraction 6 (Overview) runs after, using condensed Phase 1 results

### Step 6c: Portfolio Deal Overview (NEW)

For portfolio deals, a 7th extraction (`DEAL_OVERVIEW_PROMPT`) runs:
- Uses pre-extracted per-facility data
- Generates portfolio-level investment thesis
- Identifies synergy opportunities
- Ranks facilities and identifies concentration risks

### Step 6d: CIM Extraction (NEW)

If a CIM/Offering Memorandum is detected:
- Extracts NOI bridge (broker-provided vs. calculated)
- Extracts value-add thesis
- Extracts executive summary, market analysis
- Returns per-facility data from CIM

---

## Stage 7: Result Reconciliation

**Backend:** `parallelExtractor.js` → `reconcileExtractionResults()`

Merges the 6 extraction results into one unified object:

```javascript
{
  // From Facility extraction
  facility_name: "Big Horn Care Center",
  facility_type: "Assisted Living",
  state: "WY",
  purchase_price: 15000000,

  // From Financials extraction
  monthly_financials: [
    { month: "2024-01", revenue: 450000, expenses: 380000, ... },
    { month: "2024-02", revenue: 460000, expenses: 385000, ... },
    ...
  ],
  t12_totals: {
    total_revenue: 5400000,
    total_expenses: 4600000,
    net_income: 800000,
    ebitda: 650000,
    ebitdar: 750000
  },

  // From Expenses extraction (8 departments)
  monthly_expenses: [
    { month: "2024-01", department: "nursing", salaries: 120000, ... },
    { month: "2024-01", department: "dietary", salaries: 25000, ... },
    ...
  ],

  // From Census extraction
  monthly_census: [
    {
      month: "2024-01",
      adc: 94,
      occupancy: 85.5,
      medicaid_days: 1800,
      admissions: 12,
      discharges: 10
    },
    ...
  ],

  // From Rates extraction
  rate_schedules: {
    private_pay: [
      { unit_type: "Studio", monthly_rate: 4128, care_levels: { L1: 676, L2: 889 } }
    ],
    medicaid: [
      { care_level: "Level 1", monthly_rate: 1980 }
    ]
  },

  // From Overview extraction
  overview: {
    screening_summary: "Turnaround opportunity with...",
    red_flags: ["High agency staffing costs"],
    strengths: ["Strong private pay mix"],
    diligence_items: ["Verify staffing levels"]
  },

  // Metadata
  _confidenceMap: { facility_name: "high", city: "medium", ... },
  _sourceMap: { facility_name: "P&L.xlsx | Page 1", ... }
}
```

**Deduplication Logic:**
- If same month appears in multiple docs, prefer the more recent source
- Handles overlapping T12 + YTD scenarios

---

## Stage 8: Data Validation (NEW)

**Backend:** `extractionValidator.js` → `ExtractionDataValidator.validate()`

Comprehensive validation of extracted data:

### Validation Checks

| Category | Checks |
|----------|--------|
| **Revenue** | Not zero, not negative, reasonable range |
| **Expenses** | Not negative, labor % reasonable |
| **Occupancy** | 0-100%, ADC <= total_beds |
| **Payer Mix** | Percentages sum to ~100% |
| **Bed Count** | Consistent across documents |
| **Monthly Data** | No gaps, 12 months present, no outliers |

### Portfolio-Specific Validation

- Portfolio totals vs. facility sum reconciliation
- Concentration risk identification
- Per-facility validation + aggregate

### Output

```javascript
{
  valid: boolean,
  errors: [{ field: "occupancy", message: "Exceeds 100%", severity: "error" }],
  warnings: [{ field: "agency_labor", message: "Unusually high", severity: "warning" }],
  errorCount: 2,
  warningCount: 3,
  summary: "2 errors, 3 warnings"
}
```

---

## Stage 9: Facility Matching

**Backend:** `facilityMatcher.js` → `matchFacilityToDatabase()`

Using extracted facility name, city, and state, searches two databases:

| Database | Records | Source | Updated |
|----------|---------|--------|---------|
| `alf_facilities` | 44,625 | State licensing agencies | 2021 |
| `snf_facilities` | ~15,000 | CMS Provider Information | Q4 2024 |

### Matching Algorithm (Weighted Scoring)

```
Score = (Name Similarity × 40%) +
        (City Match × 25%) +
        (Bed Count Match × 20%) +
        (Address Similarity × 15%)
```

| Score | Confidence | Action |
|-------|------------|--------|
| ≥ 0.8 | HIGH | Auto-apply recommended |
| ≥ 0.6 | MEDIUM | Show modal, user decides |
| < 0.6 | LOW | Show modal, `needs_review = true` |

**Output:** Up to 5 matches stored in `extraction_data.overview.facility_matches`

---

## Stage 10: User Review

**Frontend:** `CombinedDealForm.jsx`

Form is populated with extracted data. User can:
- Edit any field
- Add team members
- Upload additional documents
- Correct AI extraction errors
- Review and dismiss validation warnings
- Resolve conflicts between extracted and database values

### ValidationAlerts Component (NEW)

Displays extraction validation results:
- **Errors** (red) - Block deal creation, must be resolved
- **Warnings** (yellow) - Dismissible, informational

### Conflict Resolution (NEW)

When facility match has different values than extraction:

```
┌────────────────────────────────────────────────────────────┐
│ Bed Count Conflict                                          │
│                                                             │
│ ○ Use extracted value: 120 beds                            │
│ ● Use database value: 124 beds (recommended)               │
│ ○ Enter custom value: [___]                                │
└────────────────────────────────────────────────────────────┘
```

---

## Stage 11: Deal Creation

**Backend:** `DealController.js` → `createDeal()`

### API Endpoint
```
POST /api/v1/deal/create-deals
```

### Tables Created/Updated

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Create Master Deal Container                           │
│  ┌────────────────────┐                                         │
│  │ master_deals       │  ← 1 record                             │
│  │  • unique_id       │                                         │
│  │  • street_address  │                                         │
│  │  • city, state     │                                         │
│  └────────────────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│  STEP 2: Create Deal Record(s)                                   │
│  ┌────────────────────┐                                         │
│  │ deals              │  ← 1+ records                           │
│  │  • deal_name       │                                         │
│  │  • facility_name   │                                         │
│  │  • extraction_data │  ← FULL JSON blob                       │
│  │  • is_portfolio    │  ← NEW: portfolio flag                  │
│  │  • All flat fields │                                         │
│  └────────────────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│  STEP 3: Create Facility Record(s)                               │
│  ┌────────────────────┐                                         │
│  │ deal_facilities    │  ← 1+ records per deal                  │
│  │  • facility_name   │                                         │
│  │  • bed_count       │                                         │
│  │  • facility_id     │  ← FK to ALF/SNF database               │
│  │  • purchase_price  │                                         │
│  └────────────────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│  STEP 4: Create Team Assignments                                 │
│  ┌────────────────────┐  ┌─────────────────────────┐            │
│  │ deal_team_members  │  │ deal_external_advisors  │            │
│  │  • deal_id (FK)    │  │  • deal_id (FK)         │            │
│  │  • user_id (FK)    │  │  • user_id (FK)         │            │
│  └────────────────────┘  └─────────────────────────┘            │
│              │                                                   │
│              ▼                                                   │
│  STEP 5: Store Document References                               │
│  ┌────────────────────┐                                         │
│  │ deal_documents     │  ← 0+ records                           │
│  │  • deal_id (FK)    │                                         │
│  │  • document_url    │  ← S3 path                              │
│  │  • document_name   │                                         │
│  └────────────────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│  STEP 6: Store Time-Series Data (NEW)                            │
│  ┌──────────────────────────┐                                   │
│  │ deal_monthly_financials  │  ← 12+ records (one per month)    │
│  │  • month (YYYY-MM)       │                                   │
│  │  • total_revenue         │                                   │
│  │  • medicaid_revenue      │                                   │
│  │  • medicare_revenue      │                                   │
│  │  • private_pay_revenue   │                                   │
│  │  • ebitda, ebitdar       │                                   │
│  │  • source_document       │  ← NEW: attribution               │
│  └──────────────────────────┘                                   │
│  ┌──────────────────────────┐                                   │
│  │ deal_monthly_census      │  ← 12+ records (one per month)    │
│  │  • average_daily_census  │                                   │
│  │  • occupancy_percentage  │                                   │
│  │  • medicaid_days         │                                   │
│  │  • admissions, discharges│  ← NEW fields                     │
│  │  • payer mix percentages │                                   │
│  └──────────────────────────┘                                   │
│  ┌──────────────────────────┐                                   │
│  │ deal_monthly_expenses    │  ← 12+ × 8 departments            │
│  │  • department            │                                   │
│  │  • salaries_wages        │                                   │
│  │  • agency_labor          │                                   │
│  │  • food_cost, utilities  │                                   │
│  └──────────────────────────┘                                   │
│  ┌──────────────────────────┐                                   │
│  │ deal_rate_schedules      │  ← 1 per rate type                │
│  │  • payer_type            │                                   │
│  │  • rate_category         │                                   │
│  │  • daily/monthly_rate    │                                   │
│  └──────────────────────────┘                                   │
│  ┌──────────────────────────┐                                   │
│  │ deal_expense_ratios      │  ← 1 record (calculated)          │
│  │  • labor_pct_of_revenue  │                                   │
│  │  • agency_pct_of_labor   │                                   │
│  │  • food_cost_per_day     │                                   │
│  │  • benchmark_flags       │                                   │
│  └──────────────────────────┘                                   │
│              │                                                   │
│              ▼                                                   │
│  STEP 7: Record Extraction History (NEW)                         │
│  ┌────────────────────┐                                         │
│  │ extraction_history │  ← Audit trail                          │
│  │  • extraction_data │                                         │
│  │  • source          │                                         │
│  │  • changed_fields  │                                         │
│  └────────────────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│  STEP 8: Create Activity Log                                     │
│  ┌────────────────────┐                                         │
│  │ recent_activity    │  ← Notifications                        │
│  │  • "new_deal_created"                                        │
│  │  • "added_to_deal"                                           │
│  └────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stage 12: Facility Match Confirmation

**Frontend:** `FacilityMatchModal.jsx`

After deal creation, if matches are pending, modal appears:

```
┌─────────────────────────────────────────────────────────────┐
│                 Review Facility Matches                      │
│  We found 5 potential matches for "Big Horn Care Center"    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Big Horn Rehabilitation Center    [Best Match]      │    │
│  │ Assisted Living Facility          [92% Match] HIGH  │    │
│  │ 📍 123 Main St, Sheridan, WY 82801                  │    │
│  │ 🛏️ 124 Licensed Beds                                │    │
│  │ 📞 (307) 555-1234                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  [More matches...]                                          │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ CONFLICTS DETECTED                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Bed Count: Extracted (120) vs Database (124)        │    │
│  │ ○ Use extracted  ● Use database  ○ Custom           │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  [Not Sure]  [None of These]              [Confirm Selection]│
└─────────────────────────────────────────────────────────────┘
```

### User Actions

| Button | API Call | Result |
|--------|----------|--------|
| **Confirm Selection** | `POST /:dealId/select-facility-match` with `{facility_id, action: 'select', resolvedConflicts}` | Applies facility data → navigates to Deal Detail |
| **None of These** | `POST /:dealId/select-facility-match` with `{action: 'skip'}` | Marks as skipped → navigates to Deals list |
| **Not Sure** | `POST /:dealId/select-facility-match` with `{action: 'not_sure'}` | Marks for review → navigates to Deals list |

### Data Applied on Selection

**Backend:** `DealController.js` → `syncFacilityData()`

Three-way sync updates:

```
Selected Match Data + Resolved Conflicts
        ↓
┌───────────────────────────────────────────────────────────────┐
│                    syncFacilityData()                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. DEALS TABLE              2. DEAL_FACILITIES TABLE         │
│  ┌─────────────────────┐     ┌─────────────────────────┐     │
│  │ facility_name       │     │ facility_name           │     │
│  │ street_address      │     │ street_address          │     │
│  │ city                │     │ city                    │     │
│  │ state               │     │ state                   │     │
│  │ zip_code            │     │ zip_code                │     │
│  │ bed_count           │     │ bed_count               │     │
│  │ latitude            │     │ latitude                │     │
│  │ longitude           │     │ longitude               │     │
│  └─────────────────────┘     └─────────────────────────┘     │
│                                                               │
│  3. EXTRACTION_DATA JSON                                      │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ _sourceMap: { facility_name: "ALF Database", ... }    │   │
│  │ _confidenceMap: { facility_name: "high", ... }        │   │
│  │ overview.facility_matches.status: "selected"          │   │
│  │ overview.facility_matches.selected_facility_id: 123   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  4. EXTRACTION_HISTORY TABLE (audit trail)                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ source: "alf_match"                                   │   │
│  │ changed_fields: ["facility_name", "city", ...]        │   │
│  │ resolved_conflicts: { bed_count: "database", ... }    │   │
│  └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### What Gets Preserved vs Overwritten

| Data Type | Action |
|-----------|--------|
| Location (name, address, city, state, zip) | **RESOLVED** per user selection |
| Bed count | **RESOLVED** per user selection |
| Coordinates (lat/lng) | **OVERWRITTEN** with database values |
| Financial data (revenue, EBITDA, etc.) | **PRESERVED** - not touched |
| Census data (occupancy, payer mix) | **PRESERVED** - not touched |
| Monthly time-series | **PRESERVED** - not touched |
| Expense ratios | **PRESERVED** - not touched |

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER                                        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ Uploads files
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                         │
│  CombinedDealForm.jsx                                                    │
│    • File upload UI                                                      │
│    • Form fields (editable)                                              │
│    • Team member selection                                               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ POST /deal/detect-facilities (NEW)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FACILITY DETECTION SERVICE (NEW)                      │
│  facilityMatcher.js → detectFacilitiesFromText()                         │
│    └─ AI detection of facilities from document text                      │
│    └─ Returns detected facilities with confidence scores                 │
│    └─ Determines single vs portfolio deal type                           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ User confirms facilities
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTRACTION SERVICE                               │
│  extractionOrchestrator.js                                               │
│    │                                                                     │
│    ├── extractTextFromFile() ───────────────────┐                        │
│    │     PDF → pdf-parse (or pdf-to-img)        │                        │
│    │     Excel → xlsx                           │ Plain text             │
│    │     Word → mammoth                         │                        │
│    │                                            ▼                        │
│    ├── analyzeFinancialPeriods() ───────────────┐                        │
│    │     Determine optimal T12 from docs        │ Period strategy        │
│    │                                            ▼                        │
│    └── prepareDocumentText() ───────────────────┐                        │
│          Combine with headers                   │ Combined text          │
│                                                 ▼                        │
│  parallelExtractor.js                                                    │
│    │                                                                     │
│    ├── runFocusedExtraction(FACILITY_PROMPT) ───┐                        │
│    ├── runFocusedExtraction(FINANCIALS_PROMPT) ─┤                        │
│    ├── runFocusedExtraction(EXPENSES_PROMPT) ───┼── Claude API ×5        │
│    ├── runFocusedExtraction(CENSUS_PROMPT) ─────┤   (parallel)           │
│    ├── runFocusedExtraction(RATES_PROMPT) ──────┘                        │
│    │                            │                                        │
│    │                            ▼                                        │
│    ├── reconcileExtractionResults() ────────────┐                        │
│    │     Merge, dedupe, calculate ratios        │ Unified JSON           │
│    │                                            ▼                        │
│    └── runFocusedExtraction(OVERVIEW_PROMPT) ───┐                        │
│          Summary, red flags, strengths          │ + Overview             │
│                                                 ▼                        │
│  extractionValidator.js (NEW)                                            │
│    └── validate() ─────────────────────────────┐                         │
│          Check data quality                    │ Errors/Warnings         │
│          Validate monthly completeness         │                         │
│                                                ▼                        │
│  facilityMatcher.js                                                      │
│    └── matchFacilityToDatabase() ───────────────┐                        │
│          Search alf_facilities (44K)            │ Top 5 matches          │
│          Search snf_facilities (15K)            │                        │
└─────────────────────────────────────────────────┼────────────────────────┘
                                                  │ Returns extractedData + validation
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                         │
│  CombinedDealForm.jsx                                                    │
│    • Populates form with extracted data                                  │
│    • Shows ValidationAlerts (errors/warnings) (NEW)                      │
│    • User reviews/edits                                                  │
│    • User dismisses warnings or fixes errors                             │
│    • User clicks "Create Deal"                                           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ POST /deal/create-deals
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEAL CONTROLLER                                  │
│  DealController.js → createDeal()                                        │
│    │                                                                     │
│    ├── Create master_deals record                                        │
│    ├── Create deals record (with extraction_data JSON)                   │
│    ├── Create deal_facilities record(s)                                  │
│    ├── Create deal_team_members / deal_external_advisors                 │
│    ├── Create deal_documents                                             │
│    ├── storeTimeSeriesData() ───────────────────┐                        │
│    │     deal_monthly_financials                │                        │
│    │     deal_monthly_census                    │ Time-series tables     │
│    │     deal_monthly_expenses                  │                        │
│    │     deal_rate_schedules                    │                        │
│    │     deal_expense_ratios                    │                        │
│    ├── Create extraction_history (NEW)                                   │
│    └── Create recent_activity                                            │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ Returns deal ID
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                         │
│  CombinedDealForm.jsx                                                    │
│    │                                                                     │
│    └── GET /deal/:id/facility-matches                                    │
│          If matches pending → Show FacilityMatchModal                    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ User selects match + resolves conflicts
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEAL CONTROLLER                                  │
│  DealController.js → selectFacilityMatch()                               │
│    │                                                                     │
│    └── syncFacilityData() ──────────────────────┐                        │
│          Update deals table                     │                        │
│          Update deal_facilities table           │ Three-way sync         │
│          Update extraction_data JSON            │                        │
│          Apply resolved conflicts (NEW)         │                        │
│          Create extraction_history audit        │                        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
                          Navigate to Deal Detail
```

---

## Portfolio Deal Flow (NEW)

For multi-facility deals, the flow has additional steps:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PORTFOLIO EXTRACTION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. FACILITY DETECTION                                                   │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │ detectFacilitiesFromText() → ["Facility A", "Facility B", ...]  │ │
│     │ User confirms facilities in FacilityConfirmationList            │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  2. PER-FACILITY EXTRACTION                                              │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │ For each confirmed facility:                                    │ │
│     │   runFacilityExtraction(docs, facilityInfo)                     │ │
│     │   → Individual financials, census, expenses, rates              │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  3. PORTFOLIO AGGREGATION                                                │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │ Combine facility data into portfolio_summary:                   │ │
│     │   total_revenue, total_beds, weighted_occupancy, etc.           │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  4. PORTFOLIO DEAL OVERVIEW                                              │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │ runFocusedExtraction(DEAL_OVERVIEW_PROMPT)                      │ │
│     │   → Investment thesis, synergies, facility rankings             │ │
│     │   → Concentration risks, diligence priorities                   │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│  5. PORTFOLIO VALIDATION                                                 │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │ validatePortfolioConsistency(portfolioData, facilities)         │ │
│     │   → Portfolio totals vs facility sum                            │ │
│     │   → Per-facility validation                                     │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key File Locations

### Backend

| File | Purpose | Key Functions |
|------|---------|---------------|
| `backend/services/extractionOrchestrator.js` | Orchestrates extraction | `runFullExtraction()`, `runPortfolioExtraction()` |
| `backend/services/parallelExtractor.js` | Parallel Claude calls | `runParallelExtractions()`, `reconcileExtractionResults()` |
| `backend/services/periodAnalyzer.js` | T12 period detection | `analyzeFinancialPeriods()` |
| `backend/services/facilityMatcher.js` | Database matching | `detectFacilitiesFromText()`, `matchFacilityToDatabase()` |
| `backend/services/extractionValidator.js` | Data validation (NEW) | `ExtractionDataValidator.validate()` |
| `backend/controller/DealController.js` | Deal CRUD | `createDeal()`, `selectFacilityMatch()`, `syncFacilityData()` |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/pages/CombinedDealForm.jsx` | Main form, upload, submission |
| `frontend/src/components/FacilityMatchModal.jsx` | Match selection + conflict resolution |
| `frontend/src/components/ValidationAlerts.jsx` | Error/warning display (NEW) |
| `frontend/src/components/FacilityConfirmationList.jsx` | Portfolio facility selection (NEW) |
| `frontend/src/api/DealService.js` | API calls |

### Prompts

All extraction prompts are in `backend/services/parallelExtractor.js`:
- `FACILITY_PROMPT` - Facility info extraction
- `FINANCIALS_PROMPT` - Monthly revenue/expenses
- `EXPENSES_PROMPT` - Department-level expenses (8 categories)
- `CENSUS_PROMPT` - Occupancy, patient days, admissions
- `RATES_PROMPT` - Private pay, Medicaid, Medicare rates
- `OVERVIEW_PROMPT` - Deal screening summary
- `DEAL_OVERVIEW_PROMPT` - Portfolio-level analysis (NEW)

---

## Database Tables Summary

### Created During Deal Flow

| Table | Records Per Deal | Data Source |
|-------|------------------|-------------|
| `master_deals` | 1 | Form input |
| `deals` | 1+ | Form + AI extraction |
| `deal_facilities` | 1+ | Form + AI extraction + DB match |
| `deal_team_members` | 0+ | User selection |
| `deal_external_advisors` | 0+ | User selection |
| `deal_documents` | 0+ | S3 upload paths |
| `deal_monthly_financials` | 12+ | AI extraction |
| `deal_monthly_census` | 12+ | AI extraction |
| `deal_monthly_expenses` | 12+ × 8 depts | AI extraction |
| `deal_rate_schedules` | 1+ per payer | AI extraction |
| `deal_expense_ratios` | 1 | Calculated |
| `extraction_history` | 1+ | Audit trail (NEW) |
| `recent_activity` | 1+ | Auto-generated |

### Pre-Populated Reference Tables

| Table | Records | Source | Used For |
|-------|---------|--------|----------|
| `alf_facilities` | 44,625 | State licensing (2021) | Facility matching |
| `snf_facilities` | ~15,000 | CMS Provider Info (Q4 2024) | Facility matching + CMS metrics |

---

## Expense Department Categories

The system extracts expenses across 8 standard departments:

| Department | What's Included |
|------------|-----------------|
| `nursing` | RN, LPN, CNA wages, benefits, agency |
| `dietary` | Kitchen staff, food costs |
| `housekeeping` | Cleaning staff, supplies |
| `laundry` | Laundry services, linens |
| `maintenance` | Repairs, building upkeep |
| `activities` | Recreation, therapy staff |
| `social_services` | Social workers, case management |
| `administration` | Management, office, corporate |

---

## Common Issues & Debugging

### Extraction Quality Issues

1. **PDF text extraction fails**
   - Check if scanned PDF → falls back to vision
   - Look for "< 100 chars extracted" in logs

2. **Wrong T12 period calculated**
   - Check `periodAnalyzer.js` logs
   - Verify document date headers are parseable
   - Check for UTC timezone handling

3. **Facility not matched**
   - ALF database is from 2021 → may be outdated
   - Check name similarity threshold (0.6)
   - Verify state is correct in extraction

4. **Validation errors blocking creation**
   - Check `_validation` in extraction response
   - Review specific field errors
   - May need manual data correction

### Data Flow Issues

1. **Time-series not saved**
   - Check `storeTimeSeriesData()` was called
   - Verify monthly_financials array exists

2. **Facility match data not applied**
   - Check `syncFacilityData()` was called
   - Verify `extraction_history` audit record created
   - Check conflict resolution was completed

3. **Form fields not populating**
   - Check `extractedData` structure matches expected
   - Verify `_confidenceMap` fields exist

4. **Portfolio facilities not separated**
   - Check facility detection ran
   - Verify user confirmed all facilities
   - Check per-facility extraction completed

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/deal/detect-facilities` | POST | AI facility detection (NEW) |
| `/api/v1/deal/extract-enhanced` | POST | Single facility extraction |
| `/api/v1/deal/extract-portfolio` | POST | Portfolio extraction (NEW) |
| `/api/v1/deal/create-deals` | POST | Create deal with all data |
| `/api/v1/deal/:id/facility-matches` | GET | Get pending facility matches |
| `/api/v1/deal/:id/select-facility-match` | POST | Confirm/skip facility match |
| `/api/v1/deal/:id` | GET | Get deal with extraction data |

---

## Changelog from Previous Version

| Feature | Previous | Current |
|---------|----------|---------|
| Deal Types | Single only | Single + Portfolio |
| Facility Detection | Manual | AI-powered |
| Period Analysis | Basic | Full T12 combining |
| Validation | Minimal | Comprehensive |
| Conflict Resolution | None | Interactive UI |
| Time-Series Storage | None | Monthly tables |
| Audit Trail | None | extraction_history |
| CIM Extraction | None | Full support |
| Expense Departments | Limited | 8 categories |

---

## Future Improvements

1. **Real-time extraction progress** - Stream Claude responses
2. **Document classification** - Auto-detect doc types before extraction
3. **SNF enrichment** - Auto-pull CMS quality metrics when matched
4. **Re-extraction** - Allow re-running extraction with different parameters
5. **Extraction templates** - Custom prompts for different deal types
6. **Multi-deal comparison** - Side-by-side portfolio facility analysis
