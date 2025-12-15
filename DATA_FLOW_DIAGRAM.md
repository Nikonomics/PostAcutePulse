# SNFalyze Data Flow: Extraction → Storage → Display

## Visual Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. DOCUMENT UPLOAD                                 │
│                                                                              │
│  User uploads files via CombinedDealForm.jsx                                │
│  ├─ P&L.xlsx, Census.pdf, etc.                                              │
│  └─ Stored in: /backend/uploads/{deal_id}/                                  │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        2. AI EXTRACTION (Gemini)                             │
│                                                                              │
│  Backend: DealController.extractDealData()                                  │
│  ├─ Reads uploaded files                                                    │
│  ├─ Sends to Google Gemini API with extraction prompt                       │
│  └─ Receives structured JSON response                                       │
│                                                                              │
│  Gemini Output Structure (NESTED):                                          │
│  {                                                                           │
│    "facility_information": {                                                 │
│      "facility_name": { value: "...", confidence: 0.9, source: "..." },     │
│      "street_address": { value: "...", confidence: 0.9, source: "..." },    │
│      "city": { value: "...", confidence: 0.9, source: "..." },              │
│      "bed_count": { value: 115, confidence: 0.8, source: "..." }            │
│    },                                                                        │
│    "financial_information_t12": { ... },                                     │
│    "census_and_occupancy": { ... }                                           │
│  }                                                                           │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    3. DATA TRANSFORMATION (Backend)                          │
│                                                                              │
│  Backend: DealController.js - flattenExtractedData()                        │
│  Converts NESTED → FLAT structure for database storage                      │
│                                                                              │
│  BEFORE (Nested):                          AFTER (Flat):                    │
│  {                                         {                                │
│    facility_information: {                   facility_name: "Odd Fellows",  │
│      facility_name: {                        street_address: "3102 SE...",  │
│        value: "Odd Fellows",                 city: "Portland",              │
│        confidence: 0.9,                      state: "OR",                   │
│        source: "P&L.xlsx"                    zip_code: "97202",             │
│      },                                      bed_count: 115,                │
│      street_address: { ... }                 _confidenceMap: {              │
│    }                                           facility_name: "high",       │
│  }                                             street_address: "high",      │
│                                                ...                           │
│                                              },                              │
│                                              _sourceMap: {                   │
│                                                facility_name: "P&L.xlsx",   │
│                                                street_address: "P&L.xlsx",  │
│                                                ...                           │
│                                              }                               │
│                                            }                                 │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4. DATABASE STORAGE (SQLite)                              │
│                                                                              │
│  Tables: deals, deal_facilities, alf_facilities                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ TABLE: deals                                                        │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ id                    INTEGER PRIMARY KEY                           │    │
│  │ deal_name             TEXT                                          │    │
│  │ facility_name         TEXT  ← Populated from extraction OR ALF DB   │    │
│  │ street_address        TEXT  ← Populated from extraction OR ALF DB   │    │
│  │ city                  TEXT  ← Populated from extraction OR ALF DB   │    │
│  │ state                 TEXT  ← Populated from extraction OR ALF DB   │    │
│  │ zip_code              TEXT  ← Populated from extraction OR ALF DB   │    │
│  │ no_of_beds            TEXT  (legacy - bed type breakdown)           │    │
│  │ extraction_data       TEXT  ← JSON (FLAT structure) ⭐ KEY FIELD    │    │
│  │ enhanced_extraction_  TEXT  ← JSON (FLAT structure, optional)       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  extraction_data JSON structure (FLAT):                                     │
│  {                                                                           │
│    "facility_name": "Odd Fellows Home Of Oregon  The",                      │
│    "street_address": "3102 SE HOLGATE BLVD",                                │
│    "city": "Portland",                                                       │
│    "state": "OR",                                                            │
│    "zip_code": "97202",                                                      │
│    "bed_count": 115,                                                         │
│    "annual_revenue": 5000000,                                                │
│    "ebitda": 800000,                                                         │
│    "_confidenceMap": {                                                       │
│      "facility_name": "high",                                                │
│      "street_address": "high",                                               │
│      "city": "high",                                                         │
│      ...                                                                     │
│    },                                                                        │
│    "_sourceMap": {                                                           │
│      "facility_name": "P&L Statement.xlsx",                                 │
│      "street_address": "ALF Database",                                      │
│      "city": "ALF Database",                                                 │
│      ...                                                                     │
│    },                                                                        │
│    "deal_overview": { ... }  ← Nested object preserved                      │
│  }                                                                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ TABLE: deal_facilities                                              │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ id                    INTEGER PRIMARY KEY                           │    │
│  │ deal_id               INTEGER (FK → deals.id)                       │    │
│  │ facility_name         TEXT  ← From ALF DB when match selected       │    │
│  │ street_address        TEXT  ← From ALF DB when match selected       │    │
│  │ city                  TEXT  ← From ALF DB when match selected       │    │
│  │ state                 TEXT  ← From ALF DB when match selected       │    │
│  │ zip_code              TEXT  ← From ALF DB when match selected       │    │
│  │ total_beds            INTEGER ← From ALF DB (capacity field)        │    │
│  │ latitude              REAL  ← From ALF DB                           │    │
│  │ longitude             REAL  ← From ALF DB                           │    │
│  │ facility_type         TEXT  ← "SNF" or "ALF"                        │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ TABLE: alf_facilities (Reference Database - 44,625 facilities)      │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ facility_id           TEXT PRIMARY KEY                              │    │
│  │ facility_name         TEXT                                          │    │
│  │ address               TEXT                                          │    │
│  │ city                  TEXT                                          │    │
│  │ state                 TEXT                                          │    │
│  │ zip_code              TEXT                                          │    │
│  │ capacity              INTEGER (total licensed beds)                 │    │
│  │ latitude              REAL                                          │    │
│  │ longitude             REAL                                          │    │
│  │ facility_type         TEXT ("SNF" or "ALF")                         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  5. FACILITY MATCHING (Optional Enhancement)                 │
│                                                                              │
│  Service: /backend/services/facilityMatcher.js                              │
│  Triggered: After extraction completes                                      │
│                                                                              │
│  Process:                                                                    │
│  1. Extract facility_name from extraction_data                              │
│  2. Query alf_facilities table with fuzzy matching                          │
│     └─ Uses Levenshtein distance algorithm                                  │
│     └─ Filters by state if available                                        │
│  3. Return top 5 matches with confidence scores                             │
│                                                                              │
│  Match Result Structure:                                                    │
│  {                                                                           │
│    "matches": [                                                              │
│      {                                                                       │
│        "facility_id": "50R091",                                              │
│        "facility_name": "Odd Fellows Home Of Oregon  The",                  │
│        "address": "3102 SE HOLGATE BLVD",                                   │
│        "city": "Portland",                                                   │
│        "state": "OR",                                                        │
│        "zip_code": "97202",                                                  │
│        "capacity": 115,                                                      │
│        "latitude": 45.4900731,                                               │
│        "longitude": -122.6330152,                                            │
│        "match_score": 0.95,                                                  │
│        "match_confidence": "high"                                            │
│      }                                                                       │
│    ]                                                                         │
│  }                                                                           │
│                                                                              │
│  If user selects a match:                                                   │
│  ├─ Updates deal_facilities table                                           │
│  ├─ Updates deals table (flat fields)                                       │
│  └─ Updates extraction_data JSON (FLAT fields + maps) ⭐ CRITICAL           │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      6. FACILITY MATCH SELECTION                             │
│                                                                              │
│  API: POST /api/v1/deal/:dealId/select-facility-match                       │
│  Controller: DealController.selectFacilityMatch()                           │
│                                                                              │
│  Updates THREE locations with ALF database values:                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 1. deals table (flat columns)                                   │       │
│  │    UPDATE deals SET                                              │       │
│  │      facility_name = selectedMatch.facility_name,               │       │
│  │      street_address = selectedMatch.address,                    │       │
│  │      city = selectedMatch.city,                                 │       │
│  │      state = selectedMatch.state,                               │       │
│  │      zip_code = selectedMatch.zip_code,                         │       │
│  │      no_of_beds = selectedMatch.capacity                        │       │
│  │    WHERE id = dealId                                            │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 2. deal_facilities table                                         │       │
│  │    INSERT/UPDATE deal_facilities SET                            │       │
│  │      facility_name = selectedMatch.facility_name,               │       │
│  │      street_address = selectedMatch.address,                    │       │
│  │      city = selectedMatch.city,                                 │       │
│  │      state = selectedMatch.state,                               │       │
│  │      zip_code = selectedMatch.zip_code,                         │       │
│  │      total_beds = selectedMatch.capacity,                       │       │
│  │      latitude = selectedMatch.latitude,                         │       │
│  │      longitude = selectedMatch.longitude,                       │       │
│  │      facility_type = selectedMatch.facility_type                │       │
│  │    WHERE deal_id = dealId                                       │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 3. extraction_data JSON (FLAT structure) ⭐ CRITICAL FOR UI      │       │
│  │    extractionData.facility_name = selectedMatch.facility_name   │       │
│  │    extractionData.street_address = selectedMatch.address        │       │
│  │    extractionData.city = selectedMatch.city                     │       │
│  │    extractionData.state = selectedMatch.state                   │       │
│  │    extractionData.zip_code = selectedMatch.zip_code             │       │
│  │    extractionData.bed_count = selectedMatch.capacity            │       │
│  │                                                                  │       │
│  │    extractionData._confidenceMap = {                            │       │
│  │      facility_name: "high",                                     │       │
│  │      street_address: "high",                                    │       │
│  │      city: "high",                                              │       │
│  │      state: "high",                                             │       │
│  │      zip_code: "high",                                          │       │
│  │      bed_count: "high"                                          │       │
│  │    }                                                             │       │
│  │                                                                  │       │
│  │    extractionData._sourceMap = {                                │       │
│  │      facility_name: "ALF Database",                             │       │
│  │      street_address: "ALF Database",                            │       │
│  │      city: "ALF Database",                                      │       │
│  │      state: "ALF Database",                                     │       │
│  │      zip_code: "ALF Database",                                  │       │
│  │      bed_count: "ALF Database"                                  │       │
│  │    }                                                             │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      7. API DATA RETRIEVAL                                   │
│                                                                              │
│  Frontend: DealService.getDealById(dealId)                                  │
│  API: GET /api/v1/deal/get-deal-by-id?id={dealId}                           │
│  Backend: DealController.getDealById()                                      │
│                                                                              │
│  Query Structure:                                                            │
│  Deal.findByPk(dealId, {                                                    │
│    include: [                                                                │
│      {                                                                       │
│        model: DealFacilities,                                                │
│        as: "deal_facility"  ⭐ CRITICAL: Alias name                         │
│      },                                                                      │
│      { model: User, as: "deal_lead" },                                      │
│      { model: DealTeamMembers, as: "deal_team_members" },                   │
│      ...                                                                     │
│    ]                                                                         │
│  })                                                                          │
│                                                                              │
│  Response Structure:                                                         │
│  {                                                                           │
│    "data": {                                                                 │
│      "id": 10,                                                               │
│      "deal_name": "test2",                                                   │
│      "facility_name": "Odd Fellows Home Of Oregon  The",                    │
│      "street_address": "3102 SE HOLGATE BLVD",                              │
│      "city": "Portland",                                                     │
│      "state": "OR",                                                          │
│      "zip_code": "97202",                                                    │
│      "extraction_data": "{...FLAT JSON...}",  ⭐ String, needs parsing      │
│      "deal_facility": [  ⭐ CRITICAL: Array of facility objects             │
│        {                                                                     │
│          "id": 6,                                                            │
│          "deal_id": 10,                                                      │
│          "facility_name": "Odd Fellows Home Of Oregon  The",                │
│          "street_address": "3102 SE HOLGATE BLVD",                          │
│          "city": "Portland",                                                 │
│          "state": "OR",                                                      │
│          "zip_code": "97202",                                                │
│          "total_beds": 115,                                                  │
│          "latitude": 45.4900731,                                             │
│          "longitude": -122.6330152                                           │
│        }                                                                     │
│      ],                                                                      │
│      "deal_lead": { ... },                                                   │
│      "deal_team_members": [ ... ]                                            │
│    }                                                                         │
│  }                                                                           │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    8. FRONTEND DATA TRANSFORMATION                           │
│                                                                              │
│  Component: DealDetail.jsx                                                   │
│  Location: /frontend/src/pages/DealDetail.jsx                               │
│                                                                              │
│  Step 1: Parse JSON string                                                  │
│  const extractionData = JSON.parse(deal.extraction_data)                    │
│  // extractionData is now FLAT structure                                    │
│                                                                              │
│  Step 2: Transform FLAT → NESTED structure                                  │
│  Utility: unflattenExtractedData()                                          │
│  Location: /frontend/src/components/DealExtractionViewer/utils.ts           │
│                                                                              │
│  const unflattened = unflattenExtractedData(extractionData)                 │
│                                                                              │
│  Transformation Logic:                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ INPUT (FLAT):                                                    │       │
│  │ {                                                                │       │
│  │   facility_name: "Odd Fellows...",                              │       │
│  │   street_address: "3102 SE HOLGATE BLVD",                       │       │
│  │   city: "Portland",                                             │       │
│  │   state: "OR",                                                  │       │
│  │   zip_code: "97202",                                            │       │
│  │   bed_count: 115,                                               │       │
│  │   _confidenceMap: {                                             │       │
│  │     street_address: "high",                                     │       │
│  │     city: "high",                                               │       │
│  │     ...                                                          │       │
│  │   },                                                             │       │
│  │   _sourceMap: {                                                 │       │
│  │     street_address: "ALF Database",                             │       │
│  │     city: "ALF Database",                                       │       │
│  │     ...                                                          │       │
│  │   }                                                              │       │
│  │ }                                                                │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ OUTPUT (NESTED):                                                 │       │
│  │ {                                                                │       │
│  │   facility_information: {                                        │       │
│  │     facility_name: {                                             │       │
│  │       value: "Odd Fellows...",                                   │       │
│  │       confidence: "high",                                        │       │
│  │       source: "ALF Database"                                     │       │
│  │     },                                                            │       │
│  │     street_address: {                                            │       │
│  │       value: "3102 SE HOLGATE BLVD",                            │       │
│  │       confidence: "high",                                        │       │
│  │       source: "ALF Database"                                     │       │
│  │     },                                                            │       │
│  │     city: {                                                       │       │
│  │       value: "Portland",                                         │       │
│  │       confidence: "high",                                        │       │
│  │       source: "ALF Database"                                     │       │
│  │     },                                                            │       │
│  │     state: { value: "OR", confidence: "high", ... },            │       │
│  │     zip_code: { value: "97202", confidence: "high", ... },      │       │
│  │     bed_count: { value: 115, confidence: "high", ... }          │       │
│  │   },                                                              │       │
│  │   deal_information: { ... },                                     │       │
│  │   financial_information_t12: { ... },                            │       │
│  │   census_and_occupancy: { ... }                                  │       │
│  │ }                                                                │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  Key Transformation Functions:                                              │
│  - createField<T>(canonicalKey, ...legacyKeys): ExtractedField<T>          │
│    └─ Looks up value, confidence from _confidenceMap, source from           │
│       _sourceMap                                                             │
│  - Supports legacy field name mapping (e.g., no_of_beds → bed_count)       │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       9. COMPONENT RENDERING                                 │
│                                                                              │
│  DealDetail.jsx renders multiple sections:                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ TAB: General Info (DealExtractionViewer)                         │       │
│  │ Component: DealExtractionViewer.tsx                             │       │
│  │ Location: /frontend/src/components/DealExtractionViewer/        │       │
│  │                                                                  │       │
│  │ Props:                                                           │       │
│  │ <DealExtractionViewer                                           │       │
│  │   extractionData={unflattenExtractedData(deal.extraction_data)} │       │
│  │   ... />                                                         │       │
│  │                                                                  │       │
│  │ Facility Information Section Rendering:                         │       │
│  │ <FieldCell                                                       │       │
│  │   label="Facility Name"                                         │       │
│  │   field={extractionData.facility_information.facility_name}     │       │
│  │   format="text"                                                 │       │
│  │   ... />                                                         │       │
│  │                                                                  │       │
│  │ <FieldCell                                                       │       │
│  │   label="Street Address"                                        │       │
│  │   field={extractionData.facility_information.street_address}    │       │
│  │   format="text"                                                 │       │
│  │   ... />                                                         │       │
│  │                                                                  │       │
│  │ FieldCell Component renders:                                    │       │
│  │ ┌───────────────────────────────────────────┐                  │       │
│  │ │ Street Address                             │                  │       │
│  │ │ ─────────────────────────────────────────  │                  │       │
│  │ │ 3102 SE HOLGATE BLVD         [ALF Database]│ ← Source badge  │       │
│  │ │                              [●] ← High     │ ← Confidence    │       │
│  │ └───────────────────────────────────────────┘                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ SECTION: Facilities (FacilitiesSection)                          │       │
│  │ Component: FacilitiesSection.jsx                                │       │
│  │ Location: /frontend/src/components/FacilitiesSection.jsx        │       │
│  │                                                                  │       │
│  │ Props:                                                           │       │
│  │ <FacilitiesSection                                              │       │
│  │   dealId={deal.id}                                              │       │
│  │   facilities={deal.deal_facility || []}  ⭐ From Sequelize      │       │
│  │   ... />                                                         │       │
│  │                                                                  │       │
│  │ Displays:                                                        │       │
│  │ - List of facilities from deal_facilities table                 │       │
│  │ - Shows: name, address, city, state, zip, beds, coordinates    │       │
│  │ - "Add Facility" button to create multi-facility deals         │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ TAB: Pro Forma (ProFormaTab)                                    │       │
│  │ Component: ProFormaTab.jsx                                      │       │
│  │ Location: /frontend/src/components/ProFormaTab/                │       │
│  │                                                                  │       │
│  │ Data Sources:                                                    │       │
│  │ 1. extraction_data.financial_information_t12                    │       │
│  │ 2. extraction_data.census_and_occupancy                         │       │
│  │ 3. deal.deal_facility[0].total_beds  ← From deal_facilities    │       │
│  │ 4. deal_proforma_scenarios table (saved scenarios)              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ TAB: Market Dynamics (MarketDynamicsTab)                        │       │
│  │ Component: MarketDynamicsTab.jsx                                │       │
│  │ Location: /frontend/src/components/MarketDynamicsTab/          │       │
│  │                                                                  │       │
│  │ Data Sources:                                                    │       │
│  │ 1. deal.deal_facility[0].latitude/longitude                     │       │
│  │ 2. API: /api/market/competitors (queries alf_facilities)        │       │
│  │ 3. API: /api/market/metrics (county demographics)               │       │
│  │                                                                  │       │
│  │ Displays:                                                        │       │
│  │ - Interactive map with competitor locations                     │       │
│  │ - Supply scorecard (facility density, competition)              │       │
│  │ - Demographics panel (population 65+, income, etc.)             │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Field Name Mapping Reference

### Backend → Frontend Transformation

| Database Column (deals)     | extraction_data (FLAT)      | Frontend (NESTED)                              | Display Label        |
|-----------------------------|----------------------------|------------------------------------------------|---------------------|
| `facility_name`             | `facility_name`            | `facility_information.facility_name.value`     | Facility Name       |
| `street_address`            | `street_address`           | `facility_information.street_address.value`    | Street Address      |
| `city`                      | `city`                     | `facility_information.city.value`              | City                |
| `state`                     | `state`                    | `facility_information.state.value`             | State               |
| `zip_code`                  | `zip_code`                 | `facility_information.zip_code.value`          | Zip Code            |
| `no_of_beds` (legacy)       | `bed_count`                | `facility_information.bed_count.value`         | Bed Count           |
| N/A                         | `annual_revenue`           | `financial_information_t12.total_revenue.value`| Total Revenue       |
| N/A                         | `ebitda`                   | `financial_information_t12.ebitda.value`       | EBITDA              |
| N/A                         | `occupancy_pct`            | `census_and_occupancy.occupancy_pct.value`     | Occupancy %         |

### Legacy Field Name Support

The `unflattenExtractedData()` function supports multiple legacy field names:

| Canonical Name    | Legacy Names Supported                            |
|------------------|--------------------------------------------------|
| `bed_count`      | `no_of_beds`, `number_of_beds`, `total_beds`     |
| `occupancy_pct`  | `current_occupancy`, `occupancy_percentage`      |
| `medicaid_pct`   | `medicaid_percentage`                            |
| `contact_title`  | `title`                                          |
| `contact_phone`  | `phone_number`                                   |
| `contact_email`  | `email`                                          |

---

## Critical Data Structure Rules

### ✅ CORRECT: Flat Structure in extraction_data

```json
{
  "facility_name": "Odd Fellows Home",
  "street_address": "3102 SE HOLGATE BLVD",
  "city": "Portland",
  "bed_count": 115,
  "_confidenceMap": {
    "facility_name": "high",
    "street_address": "high"
  },
  "_sourceMap": {
    "facility_name": "ALF Database",
    "street_address": "ALF Database"
  }
}
```

### ❌ INCORRECT: Nested Structure in extraction_data

```json
{
  "facility_information": {
    "facility_name": { "value": "...", "confidence": "high" },
    "street_address": { "value": "...", "confidence": "high" }
  }
}
```
**Why wrong:** The `unflattenExtractedData()` function expects flat fields at the root level to transform them into nested structure.

---

## Key Files Reference

### Backend
- **Main Controller:** `/backend/controller/DealController.js`
  - `extractDealData()` - AI extraction orchestration
  - `getDealById()` - Retrieve deal with facilities
  - `selectFacilityMatch()` - Apply ALF database match

- **Facility Matching:** `/backend/services/facilityMatcher.js`
  - `findFacilityMatches()` - Fuzzy name matching
  - `calculateSimilarity()` - Levenshtein distance

- **Models:**
  - `/backend/models/deal.js` - Deal model with extraction_data
  - `/backend/models/deal_facilities.js` - Facility association
  - `/backend/models/alf_facilities.js` - Reference database

### Frontend
- **Data Transformation:** `/frontend/src/components/DealExtractionViewer/utils.ts`
  - `unflattenExtractedData()` - FLAT → NESTED converter
  - `createField()` - Creates ExtractedField objects

- **Components:**
  - `/frontend/src/pages/DealDetail.jsx` - Main deal profile page
  - `/frontend/src/components/DealExtractionViewer/DealExtractionViewer.tsx` - General Info tab
  - `/frontend/src/components/FacilitiesSection.jsx` - Multi-facility management
  - `/frontend/src/components/ProFormaTab/ProFormaTab.jsx` - Financial projections
  - `/frontend/src/components/MarketDynamicsTab/MarketDynamicsTab.jsx` - Market analysis

---

## Common Issues & Solutions

### Issue: Facility data shows "—" (dashes)

**Cause:** `extraction_data` JSON has nested structure instead of flat structure

**Solution:** Ensure `selectFacilityMatch()` saves flat fields:
```javascript
extractionData.street_address = selectedMatch.address;  // ✅ Correct
// NOT:
extractionData.facility_information.street_address = ...;  // ❌ Wrong
```

### Issue: Sequelize returns empty deal_facility array

**Cause:** Incorrect alias in `include` query

**Solution:** Use exact alias from model association:
```javascript
include: [{ model: DealFacilities, as: "deal_facility" }]  // ✅ Correct
// NOT:
include: [{ model: DealFacilities, as: "facilities" }]  // ❌ Wrong
```

### Issue: Frontend crashes with "Cannot read property 'value' of undefined"

**Cause:** Missing confidence/source maps or incorrect field structure

**Solution:** Ensure extraction_data has `_confidenceMap` and `_sourceMap` at root level

---

## Data Flow Summary

```
Documents → Gemini (NESTED) → flattenExtractedData() (FLAT) → Database (JSON string)
    ↓
ALF Match Selected → Update extraction_data (FLAT fields + maps)
    ↓
API Response (JSON string) → Parse → unflattenExtractedData() (NESTED)
    ↓
DealExtractionViewer renders nested structure with FieldCell components
```

**Key Insight:** Data flows through TWO transformations:
1. **Backend:** NESTED (Gemini) → FLAT (Database storage)
2. **Frontend:** FLAT (API) → NESTED (Component rendering)

This architecture allows:
- Efficient database storage (flat fields are easier to query)
- Flexible frontend display (nested structure matches component hierarchy)
- Legacy field name support (transformation layer handles renaming)
