# SNFalyze - Claude Code Onboarding Bundle

> **Auto-generated** - Do not edit manually
> Last updated: 2025-12-22 08:13:45

This bundle contains all essential project context for onboarding new Claude Code sessions.

---

## README.md

```markdown
# SNFalyze Local Development Environment

A local copy of the SNFalyze AI platform for exploration and development.

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Seed the Database

This creates the SQLite database with sample data:

```bash
npm run seed
```

You'll see test accounts created:
```
Admin:        admin@snfalyze.com / password123
Deal Manager: sarah@snfalyze.com / password123
Analyst:      michael@snfalyze.com / password123
Reviewer:     emily@snfalyze.com / password123
```

### 3. Start the Backend

```bash
npm start
```

Backend runs on http://localhost:5001

### 4. Install Frontend Dependencies (new terminal)

```bash
cd frontend
npm install --legacy-peer-deps
```

> Note: `--legacy-peer-deps` is needed due to React 19 compatibility with some packages.

### 5. Start the Frontend

```bash
npm start
```

Frontend runs on http://localhost:3000

---

## Project Structure

```
snfalyze-local/
├── backend/
│   ├── app_snfalyze.js      # Main Express server
│   ├── seed.js              # Database seeder
│   ├── database.sqlite      # SQLite database (created after seed)
│   ├── config/
│   │   ├── helper.js        # Utility functions
│   │   └── sendMail.js      # Email service (Brevo)
│   ├── controller/
│   │   ├── AuthenticationController.js
│   │   ├── DealController.js
│   │   └── stateController.js
│   ├── models/              # Sequelize models
│   │   ├── users.js
│   │   ├── deals.js
│   │   ├── master_deals.js
│   │   ├── deal_comments.js
│   │   ├── deal_documents.js
│   │   ├── deal_team_members.js
│   │   ├── deal_external_advisors.js
│   │   ├── user_notifications.js
│   │   ├── recent_activity.js
│   │   ├── comment_mentions.js
│   │   └── state.js
│   ├── routes/
│   │   ├── authentication.js
│   │   ├── deal.js
│   │   └── stateRouter.js
│   └── passport/            # JWT auth config
│
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main router
│   │   ├── api/             # API service layer
│   │   ├── components/      # Reusable components
│   │   ├── context/         # Auth context
│   │   ├── pages/           # Route pages
│   │   ├── services/        # Business logic (SNF Algorithm)
│   │   └── styles/          # CSS
│   └── public/
│
└── README.md
```

---

## Database Schema

### Users
- `id`, `role`, `first_name`, `last_name`, `email`, `password`
- `phone_number`, `department`, `status`, `profile_url`
- Roles: `admin`, `deal_manager`, `analyst`, `reviewer`, `user`

### Deals
Core deal info:
- `deal_name`, `deal_type`, `deal_status`, `priority_level`
- `facility_name`, `facility_type`, `no_of_beds`
- Location: `street_address`, `city`, `state`, `zip_code`

Financial metrics:
- `purchase_price`, `annual_revenue`, `ebitda`, `ebitda_margin`
- `price_per_bed`, `current_occupancy`
- `medicare_percentage`, `private_pay_percentage`

Team:
- `deal_lead_id`, `assistant_deal_lead_id`
- `user_id` (creator)

Status workflow: `pipeline` → `due_diligence` → `final_review` → `closed`

### Master Deals
Parent container for multi-property deals:
- `unique_id`, `user_id`
- Address fields

### Deal Team Members / External Advisors
Junction tables: `deal_id`, `user_id`

### Deal Comments
Threaded comments: `deal_id`, `user_id`, `comment`, `parent_id`

### Deal Documents
File references: `deal_id`, `document_url`, `document_name`

---

## API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Login with email/password |
| POST | `/sign-up` | Register new user |
| GET | `/get-my-detail` | Get current user (auth required) |
| POST | `/create-user` | Create user (admin) |
| GET | `/get-users` | List users (paginated) |
| DELETE | `/delete-user/:id` | Deactivate user |
| POST | `/file-upload` | Upload file to S3 |

### Deals (`/api/v1/deal`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-deals` | Create deal(s) |
| GET | `/get-deals` | List deals (paginated, filtered) |
| GET | `/get-deal-by-id` | Get deal details |
| POST | `/update-deal` | Update deal |
| PUT | `/update-deal-status` | Update status only |
| DELETE | `/delete-deal/:id` | Delete deal |
| GET | `/get-deal-stats` | Deal statistics |
| GET | `/get-dashboard-data` | Dashboard metrics |
| POST | `/add-deal-comment` | Add comment |
| GET | `/get-deal-comments` | Get comments (threaded) |
| POST | `/add-deal-document` | Add document |
| GET | `/master-deals` | List master deals |

---

## Key Files to Explore

### Backend

**Controllers (business logic):**
- `controller/DealController.js` - 2000+ lines, all deal operations
- `controller/AuthenticationController.js` - User management

**Models (database structure):**
- `models/deals.js` - 40+ fields for deal data
- `models/users.js` - User schema with roles

**Config:**
- `config/helper.js` - Validation, response formatting
- `passport/index.js` - JWT authentication

### Frontend

**Pages:**
- `pages/Dashboard.jsx` - Main dashboard with kanban
- `pages/Deals.jsx` - Deal list view
- `pages/DealDetail.jsx` - Single deal view
- `pages/CombinedDealForm.jsx` - Multi-step deal creation
- `pages/ChatInterfaceAI.jsx` - AI assistant chat

**API Layer:**
- `api/apiService.js` - Axios setup with interceptors
- `api/apiRoutes.js` - All endpoint definitions
- `api/DealService.js` - Deal API calls

**Components:**
- `components/common/Layout.jsx` - App wrapper
- `components/common/Sidebar.jsx` - Navigation
- `components/ui/GoogleMap.jsx` - Maps integration

**Services:**
- `services/snfAlgorithm/snfEvaluator.js` - SNF deal evaluation algorithm

---

## Sample Data Included

After running `npm run seed`, you get:

**Users:** 5 (1 admin, 1 deal manager, 2 analysts, 1 reviewer)

**Deals:** 6 deals across different statuses
- Pipeline: Evergreen Senior Care, Rose City Memory Care, Treasure Valley
- Due Diligence: Pacific Northwest Rehab
- Final Review: Columbia Valley SNF
- Closed: Mountain View Care Home

**Comments:** 8 threaded comments across deals

**Team Assignments:** 10 team member assignments

---

## Making Changes

### Reset Database
Delete `backend/database.sqlite` and run `npm run seed` again.

### Add More Seed Data
Edit `backend/seed.js` and re-run seed.

### Change Port
- Backend: Edit `backend/.env` → `APP_PORT`
- Frontend: Edit `frontend/.env` → `REACT_APP_API_BASE_URL`

---

## Optional Features

### Google Maps
Add your API key to `frontend/.env`:
```
REACT_APP_GOOGLE_MAPS_API_KEY=your-key
```

### AI Chat (Gemini)
Add your API key to `frontend/.env`:
```
REACT_APP_GEMINI_API_KEY=your-key
```

### File Uploads (S3)
Add AWS credentials to `backend/.env`:
```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket
```

---

## Production Databases (Render)

In production, the app uses PostgreSQL on Render with a two-database architecture:

- **Main DB** (`snfalyze_db`) - App data: users, deals, documents, historical snapshots
- **Market DB** (`snf_market_data`) - Shared reference data for multiple projects

See **[backend/scripts/README.md](backend/scripts/README.md)** for:
- Why two databases exist
- Database architecture diagram
- Sync commands and workflows
- Troubleshooting production database issues

---

## Troubleshooting

**"Cannot find module 'sqlite3'"**
```bash
cd backend && npm install sqlite3 --save
```

**"Port 5001 already in use"**
```bash
lsof -ti:5001 | xargs kill -9
```

**"CORS error"**
Make sure backend is running and frontend `.env` has correct API URL.

**Database errors after model changes**
Delete `database.sqlite` and re-run seed.
```

---

## PROJECT_CONTEXT.md

```markdown
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
common
DataDictionaryTab
DealExtractionViewer
FacilityCommentsSection
FacilityMetrics
MAIntelligence
MarketAnalysis
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
master_deals
ownership_change_logs
ownership_comment_mentions
ownership_comments
ownership_contacts
recent_activity
state
user_change_logs
user_notifications
user_saved_items
users
```

### Recent Migrations
```
backend/migrations/add-facility-comments-tables.js
backend/migrations/20241218-add-deal-match-status.js
backend/migrations/20241218-add-cms-facility-to-saved-items.js
backend/migrations/20241218-create-vbp-rankings-table.js
backend/migrations/20241218-add-ccn-to-deal-facilities.js
backend/migrations/add-deals-position-column.js
backend/migrations/add-cms-facility-saved-items.js
backend/migrations/create-cms-data-definitions.js
backend/migrations/create-snf-vbp-performance.js
backend/migrations/create-cms-state-benchmarks.js
```

---
```

---

## PROJECT_STATUS.md

```markdown
# SNFalyze Pro Forma Feature - Project Status

**Last Updated:** December 22, 2025
**Project:** Healthcare M&A Deal Management Platform (SNFalyze)
**Feature:** AI-Powered Pro Forma Analysis with Benchmark Comparisons

---

## 📅 Recent Changes (Auto-Generated)

> This section is automatically updated on each commit.

### Last 7 Days

- **2025-12-21** - Migrate market data routes to use shared Market DB connection
- **2025-12-21** - Add PostHog analytics and real-time notifications
- **2025-12-21** - Add ownership import utilities and deal creation documentation
- **2025-12-21** - Fix M&A Intelligence dropdown styling and add database check script
- **2025-12-19** - Add M&A Intelligence with state/operator map views and filtering
- **2025-12-19** - Update project documentation
- **2025-12-19** - Add auto-update script for project documentation
- **2025-12-18** - Add extraction validation, facility metrics tabs, and CMS data improvements
- **2025-12-18** - Add production database reference to main README
- **2025-12-18** - Add explanation of why two databases exist
- **2025-12-18** - Add database scripts documentation
- **2025-12-18** - Add market database sync script
- **2025-12-18** - Trigger redeploy for database schema refresh
- **2025-12-18** - Add CMS data sync scripts and saved items improvements
- **2025-12-17** - Fix deal detail tabs not showing when extraction_data is null
- **2025-12-17** - Fix market analysis - remove non-existent long_stay_qm_rating columns
- **2025-12-17** - Add position column migration for deals table
- **2025-12-17** - Fix Deals.jsx crash and add CMS production migration scripts
- **2025-12-17** - Improve facilities section UI and portfolio extraction flow
- **2025-12-17** - Add remaining missing FacilityMetrics components
- **2025-12-17** - Add missing ComparisonView component
- **2025-12-17** - Add missing SkeletonCard component
- **2025-12-17** - Add Benchmarks and Reports tabs to Facility Metrics
- **2025-12-17** - Add deal position ordering, fix portfolio extraction, and sync risk scores
- **2025-12-16** - Fix OwnershipProfile aggregate metrics display
- **2025-12-15** - Make CIM extraction the single source of truth for Deal Overview
- **2025-12-15** - Add ownership field to contact_information TypeScript schema
- **2025-12-15** - Improve Deal Overview page for portfolio deals
- **2025-12-15** - Add debug logging for deal edit issue
- **2025-12-15** - Fix deal edit navigation and add save button to deals

### Areas Modified (Last 20 Commits)

```
Backend:     63 files
Frontend:    133 files
Routes:      6 files
Services:    9 files
Components:  99 files
Migrations:  8 files
```

### New Files Added (Last 20 Commits)

```
backend/bellwether_validation.js
backend/controller/SurveyIntelligenceController.js
backend/migrations/20241218-add-ccn-to-deal-facilities.js
backend/migrations/20241218-add-cms-facility-to-saved-items.js
backend/migrations/20241218-add-deal-match-status.js
backend/migrations/20241218-create-vbp-rankings-table.js
backend/migrations/add-cms-facility-saved-items.js
backend/migrations/add-deals-position-column.js
backend/migrations/add-facility-comments-tables.js
backend/models/facility_change_logs.js
backend/models/facility_comment_mentions.js
backend/models/facility_comments.js
backend/models/user_change_logs.js
backend/routes/ma-analytics.js
backend/routes/surveyIntelligence.js
```

---


## 📊 Executive Summary

### What We're Building
An intelligent pro forma analysis system that:
1. Extracts detailed P&L line items from financial documents using Claude AI
2. Calculates expense ratios and compares against industry benchmarks
3. Identifies improvement opportunities across labor, food, utilities, and management
4. Provides interactive scenario modeling with editable targets
5. Visualizes EBITDA bridge to stabilization with waterfall charts

### Current Completion Status
- **AI Extraction & Schema:** ✅ 100% Complete
- **Database Models:** ✅ 100% Complete
- **Frontend Components:** ✅ 95% Complete (missing 2 utility files)
- **Backend API Endpoints:** ❌ 0% Complete (needs full implementation)
- **Calculation Logic:** ❌ 0% Complete (needs implementation)
- **Integration & Testing:** ❌ Not started

**Overall Progress: ~45% Complete**

---

## ✅ What's Been Built

### 1. **AI Extraction System - COMPLETE**

#### A. Expense Detail Schema (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

Extracts detailed P&L line items into structured categories:
- **Direct Care:** Nursing salaries (RCC, RN, LPN, CMA), agency staffing, benefits, supplies
- **Culinary:** Wages, raw food cost, dietary supplies, equipment
- **Housekeeping:** Wages, supplies, laundry, linen
- **Maintenance:** Wages, building/equipment repair
- **Activities:** Wages, entertainment, transportation
- **Administrative:** Salaries, management fees, professional fees, bad debt
- **Utilities:** Electric, gas, water/sewer, cable
- **Property:** Taxes, insurance, grounds maintenance
- **Non-Operating:** Depreciation, amortization, interest, rent/lease

**Key Features:**
- Automatic line item mapping (e.g., "Salary & Wages - RCC" → `direct_care.nursing_salaries_rcc`)
- Source citation for every extracted value
- Confidence scoring (high, medium, low, not_found)
- Handles both text-based and vision-based PDF processing

#### B. Expense Ratio Calculations (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

Claude AI automatically calculates 13 key ratios:
- **Labor Metrics:** Total labor cost, labor % of revenue, agency % of labor
- **Food Metrics:** Food cost per resident day, food % of revenue
- **Admin Metrics:** Management fee %, admin % of revenue, bad debt %
- **Facility Metrics:** Utilities % of revenue, property cost per bed
- **Insurance:** Insurance % of revenue, insurance per bed

#### C. Benchmark Comparison Logic (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

Compares actuals against 6 key benchmarks with 3-tier thresholds:
1. **Labor %:** Target 55%, Max 62%, Critical >68%
2. **Agency % of Labor:** Target 2%, Max 5%, Critical >10%
3. **Food Cost/Day:** Target $10.50, Max $13.00, Critical >$16.00
4. **Management Fee %:** Target 4%, Max 5%, Critical >6%
5. **Bad Debt %:** Target 0.5%, Max 1.0%, Critical >2%
6. **Utilities %:** Target 2.5%, Max 3.5%, Critical >4.5%

Each comparison returns: `on_target`, `above_target`, or `critical`

#### D. Data Flattening & Storage (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

- Flattens nested AI response to flat fields for database storage
- Stores full expense_detail object as JSON
- Stores expense_ratios and benchmark_comparison as JSON
- Extracts individual ratio fields for easy querying
- Handles type conversion (strings → numbers)

---

### 2. **Database Models - COMPLETE**

#### A. `benchmark_configurations` Table
**Status:** ✅ Fully implemented
**File:** `backend/models/benchmark_configurations.js`

**Schema:**
```sql
CREATE TABLE benchmark_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_name VARCHAR(100) DEFAULT 'Default',
  is_default BOOLEAN DEFAULT false,

  -- Operational Targets
  occupancy_target FLOAT DEFAULT 0.85,
  private_pay_mix_target FLOAT DEFAULT 0.35,

  -- Labor Benchmarks (with 3-tier thresholds)
  labor_pct_target FLOAT DEFAULT 0.55,
  labor_pct_max FLOAT DEFAULT 0.62,
  labor_pct_critical FLOAT DEFAULT 0.68,

  agency_pct_of_labor_target FLOAT DEFAULT 0.02,
  agency_pct_of_labor_max FLOAT DEFAULT 0.05,
  agency_pct_of_labor_critical FLOAT DEFAULT 0.10,

  -- Food Benchmarks
  food_cost_per_day_target FLOAT DEFAULT 10.50,
  food_cost_per_day_max FLOAT DEFAULT 13.00,
  food_cost_per_day_critical FLOAT DEFAULT 16.00,

  -- Management Fee Benchmarks
  management_fee_pct_target FLOAT DEFAULT 0.04,
  management_fee_pct_max FLOAT DEFAULT 0.05,
  management_fee_pct_critical FLOAT DEFAULT 0.06,

  -- Bad Debt Benchmarks
  bad_debt_pct_target FLOAT DEFAULT 0.005,
  bad_debt_pct_max FLOAT DEFAULT 0.01,
  bad_debt_pct_critical FLOAT DEFAULT 0.02,

  -- Utilities Benchmarks
  utilities_pct_target FLOAT DEFAULT 0.025,
  utilities_pct_max FLOAT DEFAULT 0.035,
  utilities_pct_critical FLOAT DEFAULT 0.045,

  -- Other Targets
  insurance_pct_target FLOAT DEFAULT 0.03,
  ebitda_margin_target FLOAT DEFAULT 0.09,
  ebitdar_margin_target FLOAT DEFAULT 0.23,
  stabilization_months INTEGER DEFAULT 18,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

**Indexes:**
- `idx_benchmark_config_user_id` on `user_id`
- `idx_benchmark_config_user_config_unique` UNIQUE on `(user_id, config_name)`
- `idx_benchmark_config_is_default` on `(user_id, is_default)`

**Associations:**
- `belongsTo` users (via `user_id`)

#### B. `deal_proforma_scenarios` Table
**Status:** ✅ Fully implemented
**File:** `backend/models/deal_proforma_scenarios.js`

**Schema:**
```sql
CREATE TABLE deal_proforma_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scenario_name VARCHAR(100) DEFAULT 'Base Case',

  -- Benchmark Overrides (JSON - only stores differences from defaults)
  benchmark_overrides TEXT,  -- JSON

  -- Cached Calculated Outputs
  stabilized_revenue FLOAT,
  stabilized_ebitda FLOAT,
  stabilized_ebitdar FLOAT,
  stabilized_noi FLOAT,
  total_opportunity FLOAT,
  total_opportunity_pct FLOAT,

  -- Stabilized Metrics
  stabilized_occupancy FLOAT,
  stabilized_private_pay_mix FLOAT,
  stabilized_labor_pct FLOAT,

  -- Detailed Breakdowns (JSON)
  opportunities TEXT,  -- JSON array of opportunity items
  yearly_projections TEXT,  -- JSON array of year-over-year projections

  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

**Indexes:**
- `idx_proforma_scenario_deal_id` on `deal_id`
- `idx_proforma_scenario_user_id` on `user_id`
- `idx_proforma_scenario_deal_scenario_unique` UNIQUE on `(deal_id, scenario_name)`

**Associations:**
- `belongsTo` deals (via `deal_id`)
- `belongsTo` users (via `user_id`)

#### C. Database Migrations
**Status:** ✅ Fully implemented
**File:** `backend/migrations/add-benchmark-and-proforma-tables.js`

- Auto-creates tables on first run
- Adds indexes for optimal query performance
- Adds unique constraints to prevent duplicates
- Runs after Sequelize sync completes

---

### 3. **Frontend Components - 95% COMPLETE**

#### A. ProFormaTab Component
**Status:** ✅ Fully implemented
**File:** `frontend/src/components/ProFormaTab/ProFormaTab.jsx` (733 lines)

**Key Features Implemented:**

1. **Summary Cards** (4 cards at top)
   - Total Opportunity
   - Stabilized EBITDA
   - Stabilized Margin
   - Issues Count

2. **Interactive Pro Forma Table**
   - 6 columns: Category, Actual, % Rev, Benchmark (editable), Variance, Opportunity
   - 4 sections: Revenue & Occupancy, Labor Costs, Other Expenses, Profitability
   - Color-coded variance cells (green/yellow/red/blue)
   - Editable benchmark inputs with debounced recalculation (500ms)
   - Disabled inputs when data unavailable or calculation in progress

3. **Scenario Management**
   - Save scenario modal with name and notes
   - Load scenario dropdown with list of saved scenarios
   - Delete scenario with confirmation
   - Reset to defaults with confirmation
   - Unsaved changes indicator
   - Currently loaded scenario badge

4. **EBITDA Bridge Waterfall Chart**
   - Visual representation of opportunity breakdown
   - Shows path from current to stabilized EBITDA
   - Integrated OpportunityWaterfall component

5. **Opportunity Breakdown Table**
   - Detailed list of all improvement opportunities
   - Shows current, target, opportunity, and description for each

6. **Error Handling & UX**
   - Loading states (initial load vs. recalculation)
   - Success/error alerts with auto-dismiss
   - Empty states for missing data
   - Warnings for limited expense data
   - Input validation

**Sub-Components:**
- `SummaryCard` - Metric display cards with icons
- `SectionHeader` - Table section headers
- `LineItemRow` - Table rows with editable inputs
- `getVarianceStatus()` - Color coding logic
- `getStatusBadge()` - Status badge helper
- `getErrorMessage()` - User-friendly error messages

#### B. ProFormaTab Styling
**Status:** ✅ Fully implemented
**File:** `frontend/src/components/ProFormaTab/ProFormaTab.css` (495 lines)

**Features:**
- Summary card hover effects and animations
- Professional table styling with zebra striping
- Color-coded variance indicators (4 states)
- Responsive design (mobile/tablet breakpoints)
- Print-friendly styles
- Smooth transitions on all interactions
- Accessibility focus styles
- Bootstrap integration

**Variance Color Scheme:**
- `on_target`: Green (#28a745) - Meeting or exceeding target
- `above_target`: Yellow (#ffc107) - 1-10% above target
- `below_target`: Blue (#17a2b8) - Below target (revenue/margins)
- `critical`: Red (#dc3545) - >10% above target or significantly below

#### C. Component Documentation
**Status:** ✅ Complete
**File:** `frontend/src/components/ProFormaTab/README.md` (550 lines)

Comprehensive documentation including:
- Feature descriptions and capabilities
- Props specifications with TypeScript-style definitions
- State management details
- API integration guide
- Expected API response formats
- Usage examples
- Styling customization guide
- Performance optimization notes
- Testing checklist
- Troubleshooting guide
- Future enhancement ideas

---

### 4. **AI Extraction Enhancements - COMPLETE**

#### A. Period Analyzer Integration
**Status:** ✅ Implemented (user made changes)
**File:** `backend/services/aiExtractor.js`

**Features:**
- Detects overlapping financial periods in multi-document uploads
- Recommends optimal T12 combination strategy
- Generates prompt sections for Claude to combine data correctly
- Handles YTD + Historical T12 combinations

**Functions:**
- `analyzeFinancialPeriods()` - Analyzes document periods
- `generatePromptSection()` - Creates prompt instructions for Claude
- `shouldAnalyzePeriods()` - Determines if period analysis needed
- `buildPeriodAnalysisPrompt()` - Integrates into main extraction prompt

#### B. Robust JSON Parsing
**Status:** ✅ Implemented (user made changes)
**File:** `backend/services/aiExtractor.js`

**Features:**
- Multiple fallback strategies for JSON parsing
- Handles markdown code blocks
- Repairs common JSON errors (trailing commas, unquoted keys, etc.)
- Extracts largest valid JSON object as last resort
- Detailed error logging for debugging

---

## ⚠️ What's Missing (Critical Path Items)

### 1. **Backend API Endpoints - NOT STARTED** ⚠️

#### A. Pro Forma Calculation Endpoint
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 4-6 hours

**Required Endpoint:**
```javascript
POST /api/deals/:id/proforma/calculate

Request Body:
{
  occupancy_target: 85,
  labor_pct_target: 55,
  agency_pct_of_labor_target: 2,
  food_cost_per_day_target: 10.50,
  management_fee_pct_target: 4,
  bad_debt_pct_target: 0.5,
  utilities_pct_target: 2.5,
  insurance_pct_target: 3,
  ebitda_margin_target: 9,
  ebitdar_margin_target: 23,
  current_financials: {
    revenue: 5000000,
    ebitda: 450000,
    occupancy: 82,
    labor_pct: 58.5,
    // ... other metrics
  }
}

Response:
{
  total_opportunity: 350000,
  stabilized_revenue: 5500000,
  stabilized_ebitda: 495000,
  stabilized_ebitdar: 1265000,
  opportunities: [
    {
      category: "Labor Optimization",
      current: 2925000,
      target: 2750000,
      opportunity: 175000,
      unit: "$",
      description: "Reduce labor to 55% of revenue from 58.5%"
    },
    // ... more opportunities
  ],
  issues: [
    {
      category: "Agency Staffing",
      actual: 8.2,
      benchmark: 2.0,
      status: "critical",
      message: "Agency staffing at 8.2% of labor (target: 2.0%)"
    }
  ]
}
```

**File to Create:** `backend/routes/proforma.js`

**Implementation Steps:**
1. Create route file with Express router
2. Add authentication middleware
3. Validate deal ownership
4. Parse request body and validate benchmarks
5. Call ProFormaCalculator service
6. Return calculated results
7. Handle errors gracefully

#### B. Scenario CRUD Endpoints
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 3-4 hours

**Required Endpoints:**

```javascript
// Get all scenarios for a deal
GET /api/deals/:id/proforma/scenarios

Response:
[
  {
    id: 1,
    scenario_name: "Base Case",
    stabilized_ebitda: 495000,
    total_opportunity: 350000,
    created_at: "2025-12-01T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z"
  },
  // ... more scenarios
]

// Create new scenario
POST /api/deals/:id/proforma/scenarios

Request Body:
{
  scenario_name: "Aggressive Turnaround",
  benchmark_overrides: {
    occupancy_target: 90,
    labor_pct_target: 52
  },
  notes: "Assumes full turnaround with new management",
  stabilized_revenue: 5800000,
  stabilized_ebitda: 580000,
  stabilized_ebitdar: 1350000,
  total_opportunity: 480000,
  opportunities: [...]
}

Response:
{
  id: 2,
  scenario_name: "Aggressive Turnaround",
  // ... full scenario data
}

// Get single scenario
GET /api/deals/:id/proforma/scenarios/:scenarioId

// Update scenario
PUT /api/deals/:id/proforma/scenarios/:scenarioId

// Delete scenario
DELETE /api/deals/:id/proforma/scenarios/:scenarioId
```

**File to Create:** `backend/routes/proforma.js` (same file as above)

#### C. Benchmark Configuration Endpoints
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 2-3 hours

**Required Endpoints:**

```javascript
// Get user's benchmark configurations
GET /api/users/:userId/benchmarks

// Get user's default benchmark
GET /api/users/:userId/benchmarks/default

// Create new benchmark configuration
POST /api/users/:userId/benchmarks

// Update benchmark configuration
PUT /api/users/:userId/benchmarks/:configId

// Delete benchmark configuration
DELETE /api/users/:userId/benchmarks/:configId

// Set as default
PUT /api/users/:userId/benchmarks/:configId/set-default
```

**File to Create:** `backend/routes/benchmarks.js`

---

### 2. **Backend Business Logic - NOT STARTED** ⚠️

#### A. ProFormaCalculator Service
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 6-8 hours

**File to Create:** `backend/services/ProFormaCalculator.js`

**Required Functions:**

```javascript
class ProFormaCalculator {
  /**
   * Calculate pro forma analysis
   * @param {object} currentFinancials - Current financial metrics
   * @param {object} benchmarks - Target benchmarks
   * @returns {object} Pro forma results
   */
  static calculate(currentFinancials, benchmarks) {
    // 1. Calculate stabilized revenue (based on occupancy target)
    // 2. Calculate stabilized expenses (based on benchmark targets)
    // 3. Calculate opportunities (current vs. target for each category)
    // 4. Calculate stabilized EBITDA/EBITDAR
    // 5. Identify issues (metrics above critical thresholds)
    // 6. Return structured results
  }

  /**
   * Calculate occupancy opportunity
   */
  static calculateOccupancyOpportunity(current, target, revenue, beds) {
    // ...
  }

  /**
   * Calculate labor optimization opportunity
   */
  static calculateLaborOpportunity(current, target, revenue) {
    // ...
  }

  /**
   * Calculate food cost opportunity
   */
  static calculateFoodOpportunity(current, target, averageCensus, beds) {
    // ...
  }

  /**
   * Calculate management fee opportunity
   */
  static calculateManagementFeeOpportunity(current, target, revenue) {
    // ...
  }

  /**
   * Identify issues (metrics above critical thresholds)
   */
  static identifyIssues(currentFinancials, benchmarks) {
    // ...
  }

  /**
   * Calculate stabilized metrics
   */
  static calculateStabilizedMetrics(opportunities, currentFinancials) {
    // ...
  }
}
```

**Calculation Logic Required:**

1. **Occupancy Opportunity:**
   ```
   Current Revenue = $5M
   Current Occupancy = 82%
   Target Occupancy = 85%

   Revenue per Occupied Bed = $5M / (120 beds × 82% × 365 days) = $139.78/day
   Additional Beds = 120 × (85% - 82%) = 3.6 beds
   Additional Revenue = 3.6 × 365 × $139.78 = $183,715
   ```

2. **Labor Optimization:**
   ```
   Current Labor = $2,925,000 (58.5% of revenue)
   Target Labor = 55% of revenue = $2,750,000
   Opportunity = $2,925,000 - $2,750,000 = $175,000
   ```

3. **Food Cost Optimization:**
   ```
   Current Food Cost/Day = $12.50
   Target Food Cost/Day = $10.50
   Average Daily Census = 98.4
   Opportunity = (12.50 - 10.50) × 98.4 × 365 = $71,838
   ```

4. **Management Fee Opportunity:**
   ```
   Current Fee = 5.5% of revenue = $275,000
   Target Fee = 4% of revenue = $200,000
   Opportunity = $275,000 - $200,000 = $75,000
   ```

5. **Total Opportunity:**
   ```
   Sum all opportunities = $505,553
   ```

6. **Stabilized EBITDA:**
   ```
   Current EBITDA = $450,000
   Stabilized EBITDA = $450,000 + $505,553 = $955,553
   Stabilized Margin = $955,553 / $5,183,715 = 18.4%
   ```

#### B. Benchmark Service
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 2-3 hours

**File to Create:** `backend/services/BenchmarkService.js`

**Required Functions:**

```javascript
class BenchmarkService {
  /**
   * Get user's default benchmark configuration
   */
  static async getUserDefaultBenchmarks(userId) {
    // Query benchmark_configurations table
    // Return user's default config or system defaults
  }

  /**
   * Get all benchmark configurations for a user
   */
  static async getUserBenchmarks(userId) {
    // ...
  }

  /**
   * Create new benchmark configuration
   */
  static async createBenchmark(userId, config) {
    // Validate config values
    // Ensure no duplicate names
    // If is_default=true, unset other defaults
    // Insert into database
  }

  /**
   * Set benchmark as default
   */
  static async setAsDefault(userId, configId) {
    // Unset all other defaults for this user
    // Set this config as default
  }

  /**
   * Validate benchmark values
   */
  static validateBenchmarks(benchmarks) {
    // Ensure all required fields present
    // Ensure values in acceptable ranges
    // Ensure target <= max <= critical for thresholds
  }
}
```

---

### 3. **Frontend Utilities - PARTIALLY MISSING** ⚠️

#### A. Formatters Utility
**Status:** ⚠️ REFERENCED BUT NOT CREATED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 30 minutes

**File to Create:** `frontend/src/utils/formatters.js`

The ProFormaTab component imports these but the file doesn't exist:
```javascript
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters';
```

**Required Implementation:**

```javascript
/**
 * Format number as currency
 * @param {number} value - The number to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Format number as percentage
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format number with locale formatting
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date/time string
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};
```

#### B. OpportunityWaterfall Component
**Status:** ⚠️ REFERENCED BUT NOT CREATED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 3-4 hours

**File to Create:** `frontend/src/components/ProFormaTab/OpportunityWaterfall.jsx`

The ProFormaTab component imports this but it doesn't exist:
```javascript
import OpportunityWaterfall from './OpportunityWaterfall';
```

**Required Implementation:**

A React component that renders a waterfall chart showing:
- Current EBITDA (starting bar)
- Positive bars for each opportunity category
- Connector lines between bars
- Final stabilized EBITDA bar
- Labels and values on each bar
- Color coding by priority (high/medium/low)

**Suggested Approach:**
- Use a charting library (Recharts, Chart.js, or D3.js)
- Or create custom SVG-based waterfall chart

**Props Interface:**
```javascript
{
  currentEbitda: 450000,
  opportunities: [
    { label: 'Labor Optimization', value: 175000, priority: 'high' },
    { label: 'Occupancy Growth', value: 183715, priority: 'medium' },
    { label: 'Food Cost', value: 71838, priority: 'medium' },
    { label: 'Management Fees', value: 75000, priority: 'low' }
  ],
  stabilizedEbitda: 955553,
  height: 350,
  showLabels: true,
  title: 'EBITDA Bridge to Stabilization'
}
```

#### C. DealService API Methods
**Status:** ⚠️ PARTIALLY IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 1 hour

**File to Update:** `frontend/src/api/DealService.js`

The ProFormaTab component imports these functions:
```javascript
import {
  calculateProforma,
  getProformaScenarios,
  createProformaScenario,
  deleteProformaScenario
} from '../../api/DealService';
```

**Required Implementation:**

```javascript
// Add to DealService.js or create separate ProformaService.js

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/**
 * Calculate pro forma analysis
 * @param {number} dealId - Deal ID
 * @param {object} params - Calculation parameters
 * @returns {Promise<object>} Pro forma results
 */
export const calculateProforma = async (dealId, params) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/calculate`,
      params,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Calculate proforma error:', error);
    throw error;
  }
};

/**
 * Get all proforma scenarios for a deal
 * @param {number} dealId - Deal ID
 * @returns {Promise<array>} Array of scenarios
 */
export const getProformaScenarios = async (dealId) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/scenarios`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Get scenarios error:', error);
    throw error;
  }
};

/**
 * Create a new proforma scenario
 * @param {number} dealId - Deal ID
 * @param {object} scenarioData - Scenario data
 * @returns {Promise<object>} Created scenario
 */
export const createProformaScenario = async (dealId, scenarioData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/scenarios`,
      scenarioData,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Create scenario error:', error);
    throw error;
  }
};

/**
 * Delete a proforma scenario
 * @param {number} dealId - Deal ID
 * @param {number} scenarioId - Scenario ID
 * @returns {Promise<void>}
 */
export const deleteProformaScenario = async (dealId, scenarioId) => {
  try {
    await axios.delete(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/scenarios/${scenarioId}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
  } catch (error) {
    console.error('Delete scenario error:', error);
    throw error;
  }
};
```

---

## 🔧 Integration Requirements

### 1. **Backend Route Integration**
**Status:** ❌ NOT STARTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 30 minutes

**File to Update:** `backend/app_snfalyze.js`

Add the new pro forma routes:

```javascript
// Add near other route imports
const proformaRouter = require('./routes/proforma');
const benchmarkRouter = require('./routes/benchmarks');

// Add near other route registrations
app.use('/api/deals/:dealId/proforma', proformaRouter);
app.use('/api/users/:userId/benchmarks', benchmarkRouter);
```

### 2. **Frontend Component Integration**
**Status:** ❌ NOT STARTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 30 minutes

**File to Update:** Deal detail page where ProFormaTab will be used

```javascript
import ProFormaTab from './components/ProFormaTab/ProFormaTab';

// In your deal detail component:
<ProFormaTab
  deal={deal}
  extractionData={deal.extraction_data}
  onSaveScenario={handleSaveScenario}
/>
```

---

## 🧪 Testing Requirements - NOT STARTED

### 1. **Backend Unit Tests**
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 4-6 hours

**Files to Create:**
- `backend/tests/services/ProFormaCalculator.test.js`
- `backend/tests/services/BenchmarkService.test.js`
- `backend/tests/routes/proforma.test.js`
- `backend/tests/routes/benchmarks.test.js`

**Test Cases Needed:**
- Pro forma calculation accuracy
- Opportunity calculation for each category
- Issue identification logic
- Benchmark validation
- CRUD operations for scenarios
- Error handling and edge cases

### 2. **Frontend Component Tests**
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 3-4 hours

**Files to Create:**
- `frontend/src/components/ProFormaTab/ProFormaTab.test.jsx`
- `frontend/src/components/ProFormaTab/OpportunityWaterfall.test.jsx`

**Test Cases Needed:**
- Component renders with valid data
- Benchmark inputs trigger recalculation
- Scenario save/load/delete functionality
- Empty states display correctly
- Error handling and user feedback
- Responsive design

### 3. **Integration Tests**
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 2-3 hours

**Test Scenarios:**
1. End-to-end: Upload documents → Extract → View Pro Forma → Adjust benchmarks → Save scenario
2. Multi-user: User A creates scenario, User B cannot access it
3. Performance: Large deal with many scenarios loads quickly
4. Data integrity: Scenario saves match what was calculated

---

## 📋 Implementation Checklist

### Phase 1: Core Backend (Critical Path) - 12-16 hours

- [ ] **1.1 ProFormaCalculator Service** (6-8 hours)
  - [ ] Create `backend/services/ProFormaCalculator.js`
  - [ ] Implement `calculate()` main function
  - [ ] Implement `calculateOccupancyOpportunity()`
  - [ ] Implement `calculateLaborOpportunity()`
  - [ ] Implement `calculateFoodOpportunity()`
  - [ ] Implement `calculateManagementFeeOpportunity()`
  - [ ] Implement `calculateBadDebtOpportunity()`
  - [ ] Implement `calculateUtilitiesOpportunity()`
  - [ ] Implement `identifyIssues()`
  - [ ] Implement `calculateStabilizedMetrics()`
  - [ ] Add comprehensive error handling
  - [ ] Add input validation

- [ ] **1.2 Pro Forma API Routes** (4-6 hours)
  - [ ] Create `backend/routes/proforma.js`
  - [ ] POST `/api/deals/:id/proforma/calculate`
  - [ ] GET `/api/deals/:id/proforma/scenarios`
  - [ ] POST `/api/deals/:id/proforma/scenarios`
  - [ ] GET `/api/deals/:id/proforma/scenarios/:scenarioId`
  - [ ] PUT `/api/deals/:id/proforma/scenarios/:scenarioId`
  - [ ] DELETE `/api/deals/:id/proforma/scenarios/:scenarioId`
  - [ ] Add authentication middleware
  - [ ] Add authorization checks (deal ownership)
  - [ ] Add request validation
  - [ ] Add error handling

- [ ] **1.3 Route Integration** (30 min)
  - [ ] Register routes in `backend/app_snfalyze.js`
  - [ ] Test route accessibility with Postman/curl

### Phase 2: Frontend Utilities (Critical Path) - 4-5 hours

- [ ] **2.1 Formatters Utility** (30 min)
  - [ ] Create `frontend/src/utils/formatters.js`
  - [ ] Implement `formatCurrency()`
  - [ ] Implement `formatPercent()`
  - [ ] Implement `formatNumber()`
  - [ ] Implement `formatDate()`
  - [ ] Implement `formatDateTime()`

- [ ] **2.2 OpportunityWaterfall Component** (3-4 hours)
  - [ ] Create `frontend/src/components/ProFormaTab/OpportunityWaterfall.jsx`
  - [ ] Research/choose charting library (Recharts recommended)
  - [ ] Implement waterfall chart rendering
  - [ ] Add bar labels and values
  - [ ] Add color coding by priority
  - [ ] Add responsive design
  - [ ] Add loading states
  - [ ] Create OpportunityWaterfall.css if needed

- [ ] **2.3 DealService API Methods** (1 hour)
  - [ ] Add or update `frontend/src/api/DealService.js`
  - [ ] Implement `calculateProforma()`
  - [ ] Implement `getProformaScenarios()`
  - [ ] Implement `createProformaScenario()`
  - [ ] Implement `deleteProformaScenario()`
  - [ ] Add proper error handling
  - [ ] Add request/response logging

### Phase 3: Secondary Features (Medium Priority) - 5-8 hours

- [ ] **3.1 Benchmark Service** (2-3 hours)
  - [ ] Create `backend/services/BenchmarkService.js`
  - [ ] Implement `getUserDefaultBenchmarks()`
  - [ ] Implement `getUserBenchmarks()`
  - [ ] Implement `createBenchmark()`
  - [ ] Implement `updateBenchmark()`
  - [ ] Implement `deleteBenchmark()`
  - [ ] Implement `setAsDefault()`
  - [ ] Implement `validateBenchmarks()`

- [ ] **3.2 Benchmark API Routes** (2-3 hours)
  - [ ] Create `backend/routes/benchmarks.js`
  - [ ] GET `/api/users/:userId/benchmarks`
  - [ ] GET `/api/users/:userId/benchmarks/default`
  - [ ] POST `/api/users/:userId/benchmarks`
  - [ ] PUT `/api/users/:userId/benchmarks/:configId`
  - [ ] DELETE `/api/users/:userId/benchmarks/:configId`
  - [ ] PUT `/api/users/:userId/benchmarks/:configId/set-default`
  - [ ] Add authentication/authorization
  - [ ] Register routes in app

- [ ] **3.3 Benchmark UI (Future)** (4-6 hours)
  - [ ] Create BenchmarkConfigModal component
  - [ ] Add benchmark selection dropdown to ProFormaTab
  - [ ] Add "Save as Template" functionality
  - [ ] Add benchmark comparison view

### Phase 4: Testing & Polish (Medium Priority) - 8-12 hours

- [ ] **4.1 Backend Tests** (4-6 hours)
  - [ ] Write ProFormaCalculator unit tests
  - [ ] Write BenchmarkService unit tests
  - [ ] Write API route integration tests
  - [ ] Test error handling and edge cases

- [ ] **4.2 Frontend Tests** (3-4 hours)
  - [ ] Write ProFormaTab component tests
  - [ ] Write OpportunityWaterfall tests
  - [ ] Write API service tests
  - [ ] Test responsive design

- [ ] **4.3 Integration Testing** (2-3 hours)
  - [ ] End-to-end user flow testing
  - [ ] Cross-browser testing
  - [ ] Performance testing
  - [ ] Data integrity testing

- [ ] **4.4 Documentation** (1 hour)
  - [ ] Update API documentation
  - [ ] Create user guide for Pro Forma feature
  - [ ] Document calculation formulas
  - [ ] Add inline code comments

### Phase 5: Deployment & Monitoring (Low Priority) - 2-4 hours

- [ ] **5.1 Database Migration** (1 hour)
  - [ ] Run migrations on production database
  - [ ] Verify tables created correctly
  - [ ] Create default benchmark configurations for existing users

- [ ] **5.2 Deployment** (1 hour)
  - [ ] Deploy backend changes
  - [ ] Deploy frontend changes
  - [ ] Run smoke tests in production

- [ ] **5.3 Monitoring** (1-2 hours)
  - [ ] Add logging for pro forma calculations
  - [ ] Add performance monitoring
  - [ ] Set up error alerts
  - [ ] Monitor API usage

---

## 🎯 Quick Start Guide (For Next Developer)

### Immediate Next Steps (In Order)

1. **Create Formatters Utility** (30 min)
   - File: `frontend/src/utils/formatters.js`
   - Copy implementation from section 3.A above
   - Test that ProFormaTab component no longer has import errors

2. **Create ProFormaCalculator Service** (6-8 hours)
   - File: `backend/services/ProFormaCalculator.js`
   - Start with the main `calculate()` function
   - Implement opportunity calculations one at a time
   - Test each calculation with known inputs/outputs

3. **Create Pro Forma API Routes** (4-6 hours)
   - File: `backend/routes/proforma.js`
   - Start with POST `/calculate` endpoint
   - Then implement scenario CRUD endpoints
   - Test each endpoint with Postman

4. **Create DealService API Methods** (1 hour)
   - File: `frontend/src/api/DealService.js`
   - Add the 4 required functions
   - Test by calling from browser console

5. **Create OpportunityWaterfall Component** (3-4 hours)
   - File: `frontend/src/components/ProFormaTab/OpportunityWaterfall.jsx`
   - Use Recharts library for easy waterfall chart
   - Test with sample data

6. **Integration & Testing** (2-3 hours)
   - Register routes in backend app
   - Test full flow: Upload docs → Extract → Pro Forma → Save scenario
   - Fix any bugs found

### Development Environment Setup

```bash
# Backend
cd backend
npm install
npm run seed  # If needed
npm start     # Should run on http://localhost:5001

# Frontend
cd frontend
npm install
npm start     # Should run on http://localhost:3000
```

### Testing the Feature

1. **Upload test documents** to a deal
2. **Run AI extraction** to populate financial data
3. **Navigate to Pro Forma tab** (needs to be added to deal detail page)
4. **Adjust benchmarks** and watch calculations update
5. **Save a scenario**
6. **Load the scenario** to verify it was saved correctly

---

## 📊 Data Flow Diagram

```
[User uploads P&L documents]
          ↓
[AI Extraction Service (aiExtractor.js)]
- Extracts expense line items
- Calculates expense ratios
- Compares against benchmarks
          ↓
[Stores in deals.extraction_data (JSON)]
          ↓
[User opens Pro Forma tab]
          ↓
[ProFormaTab component]
- Parses extraction_data
- Displays current financials
- Allows benchmark editing
          ↓
[User adjusts benchmarks]
          ↓
[API Call: POST /proforma/calculate]
          ↓
[ProFormaCalculator.calculate()]
- Calculates opportunities
- Identifies issues
- Calculates stabilized metrics
          ↓
[Returns results to frontend]
          ↓
[ProFormaTab displays]
- Updated opportunities
- EBITDA bridge waterfall
- Color-coded variances
          ↓
[User clicks "Save Scenario"]
          ↓
[API Call: POST /proforma/scenarios]
          ↓
[Saves to deal_proforma_scenarios table]
```

---

## 🔑 Key Technical Decisions Made

1. **AI-First Approach:** Using Claude AI to extract detailed expense line items rather than manual categorization
2. **JSON Storage:** Storing complex nested data (expense_detail, opportunities) as JSON in database for flexibility
3. **Debounced Recalculation:** 500ms debounce on benchmark changes to reduce API calls
4. **Benchmark Overrides:** Only storing differences from defaults to minimize data storage
5. **Three-Tier Thresholds:** Target/Max/Critical thresholds for each benchmark for nuanced analysis
6. **Scenario-Based Modeling:** Supporting multiple scenarios per deal for sensitivity analysis
7. **Cached Calculations:** Storing calculated results in scenario table for quick display without recalculation

---

## 📚 Key Files Reference

### Backend Files

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `services/aiExtractor.js` | ✅ Complete | ~1900 | AI extraction with expense details |
| `models/benchmark_configurations.js` | ✅ Complete | 192 | Benchmark config model |
| `models/deal_proforma_scenarios.js` | ✅ Complete | 150 | Scenario model |
| `migrations/add-benchmark-and-proforma-tables.js` | ✅ Complete | 170 | Database migration |
| `services/ProFormaCalculator.js` | ❌ Missing | ~400 | Pro forma calculation logic |
| `routes/proforma.js` | ❌ Missing | ~300 | Pro forma API endpoints |
| `routes/benchmarks.js` | ❌ Missing | ~200 | Benchmark API endpoints |
| `services/BenchmarkService.js` | ❌ Missing | ~200 | Benchmark business logic |

### Frontend Files

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `components/ProFormaTab/ProFormaTab.jsx` | ✅ Complete | 733 | Main pro forma component |
| `components/ProFormaTab/ProFormaTab.css` | ✅ Complete | 495 | Component styling |
| `components/ProFormaTab/README.md` | ✅ Complete | 550 | Component documentation |
| `utils/formatters.js` | ❌ Missing | ~100 | Number/currency formatting |
| `components/ProFormaTab/OpportunityWaterfall.jsx` | ❌ Missing | ~200 | Waterfall chart component |
| `api/DealService.js` | ⚠️ Partial | +100 | API service methods (needs 4 functions) |

---

## 💡 Tips for Implementation

### Pro Forma Calculation Logic

**Key Formula:**
```
Opportunity = Current Cost - Target Cost
Stabilized EBITDA = Current EBITDA + Sum(All Opportunities)
```

**Revenue Opportunity (Occupancy):**
```javascript
// Current: 82% occupancy, 120 beds, $5M revenue
// Target: 85% occupancy

const revenuePerOccupiedBed = currentRevenue / (beds * currentOccupancy / 100 * 365);
const additionalBeds = beds * (targetOccupancy - currentOccupancy) / 100;
const revenueOpportunity = additionalBeds * 365 * revenuePerOccupiedBed;
```

**Expense Opportunity (Labor, Food, etc.):**
```javascript
// Current: 58.5% labor, Target: 55% labor
// Revenue: $5M

const currentLaborCost = revenue * (currentLaborPct / 100);
const targetLaborCost = revenue * (targetLaborPct / 100);
const laborOpportunity = currentLaborCost - targetLaborCost;
```

**Issue Detection:**
```javascript
function getStatus(actual, target, max, critical) {
  if (actual <= target) return 'on_target';
  if (actual <= max) return 'above_target';
  return 'critical';
}
```

### Waterfall Chart Implementation

**Using Recharts (Recommended):**
```bash
npm install recharts
```

```javascript
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Transform opportunities into cumulative data
const cumulativeData = opportunities.reduce((acc, opp, idx) => {
  const lastValue = idx === 0 ? currentEbitda : acc[idx - 1].end;
  acc.push({
    name: opp.label,
    start: lastValue,
    end: lastValue + opp.value,
    value: opp.value
  });
  return acc;
}, []);

// Add starting and ending bars
const chartData = [
  { name: 'Current', value: currentEbitda, isTotal: true },
  ...cumulativeData,
  { name: 'Stabilized', value: stabilizedEbitda, isTotal: true }
];
```

---

## 🚀 Deployment Notes

### Environment Variables Needed

```bash
# Backend (.env)
DATABASE_URL=postgresql://...  # Production database
ANTHROPIC_API_KEY=sk-ant-...   # For AI extraction
JWT_SECRET=your-secret-key     # For authentication

# Frontend (.env)
REACT_APP_API_URL=https://api.snfalyze.com
```

### Database Migration Steps

```bash
# 1. Backup production database
pg_dump snfalyze_prod > backup_$(date +%Y%m%d).sql

# 2. Run migrations
npm run migrate

# 3. Verify tables created
psql snfalyze_prod -c "\dt"

# 4. Create default benchmarks for existing users
psql snfalyze_prod -c "
  INSERT INTO benchmark_configurations (user_id, config_name, is_default)
  SELECT id, 'Default', true FROM users;
"
```

### Performance Considerations

1. **Pro forma calculations are CPU-intensive** - Consider caching results
2. **Debounce user input** to reduce API calls (already implemented: 500ms)
3. **Index database** on frequently queried fields (already implemented)
4. **Paginate scenario lists** if users have >20 scenarios per deal
5. **Lazy load** OpportunityWaterfall chart library to reduce bundle size

---

## 📞 Questions & Support

### Common Questions

**Q: Why store expense_detail as JSON instead of normalized tables?**
A: Flexibility. Expense categories vary by facility type (SNF vs ALF). JSON allows easy schema evolution without migrations.

**Q: Why debounce benchmark changes instead of waiting for "Calculate" button?**
A: Better UX. Users can see results update in real-time as they adjust sliders/inputs.

**Q: Why store calculated results in scenario table?**
A: Performance. Listing scenarios in dropdown can show stabilized EBITDA without recalculating every scenario.

**Q: Should we validate benchmark values on frontend or backend?**
A: Both. Frontend for immediate user feedback, backend for security and data integrity.

**Q: How do we handle deals with no expense ratio data?**
A: Pro forma tab shows a warning and disables opportunity calculations. Users must re-extract with detailed P&L.

### Contact

- **Project Lead:** [Your Name]
- **Backend Developer:** [Assign]
- **Frontend Developer:** [Assign]
- **QA Engineer:** [Assign]

---

## 📅 Estimated Timeline

### Aggressive (Full-time developer)
- **Phase 1 (Backend Core):** 2-3 days
- **Phase 2 (Frontend Utils):** 1 day
- **Phase 3 (Secondary Features):** 1-2 days
- **Phase 4 (Testing):** 1-2 days
- **Phase 5 (Deployment):** 0.5 days
- **Total:** 5.5 - 8.5 days

### Realistic (Part-time/Interrupted work)
- **Phase 1 (Backend Core):** 4-5 days
- **Phase 2 (Frontend Utils):** 2 days
- **Phase 3 (Secondary Features):** 2-3 days
- **Phase 4 (Testing):** 2-3 days
- **Phase 5 (Deployment):** 1 day
- **Total:** 11 - 14 days

### Conservative (Including unknowns & revisions)
- Add 50% buffer for unknowns
- **Total:** 16 - 21 days

---

## 🎉 Success Criteria

The Pro Forma feature will be considered complete when:

1. ✅ User can upload P&L documents and see extracted expense ratios
2. ✅ User can view Pro Forma tab with current actuals vs. benchmarks
3. ✅ User can edit benchmark targets and see recalculated opportunities
4. ✅ User can see color-coded variance indicators (green/yellow/red)
5. ✅ User can view EBITDA bridge waterfall chart
6. ✅ User can save multiple scenarios per deal
7. ✅ User can load and compare saved scenarios
8. ✅ User can delete scenarios they no longer need
9. ✅ System correctly identifies issues (critical variances)
10. ✅ All calculations are mathematically accurate
11. ✅ API endpoints have proper authentication/authorization
12. ✅ Component handles missing data gracefully
13. ✅ Feature works on mobile/tablet devices
14. ✅ Feature is documented for future maintenance

---

## 📖 Additional Resources

### Industry Benchmarks Sources
- [AHCA Financial Benchmarks](https://www.ahcancal.org/)
- [NIC MAP Data](https://www.nic.org/)
- Cascadia internal benchmarks (55% labor, 2% agency, etc.)

### Calculation References
- EBITDA/EBITDAR calculations: Standard accounting definitions
- Occupancy opportunity: Revenue per bed × additional occupied days
- Labor opportunity: Revenue × (current % - target %)

### Similar Products (Inspiration)
- RealPage OpEx analytics
- Yardi Senior Living benchmarking
- NIC MAP Vision

---

---

## 🗂️ Platform-Wide Tab Reorganization Plan

### Current vs. Target Tab Structure

The Pro Forma feature is part of a larger platform reorganization. Here's the complete tab strategy:

| Tab | Purpose | Status | Priority |
|-----|---------|--------|----------|
| **Overview** | AI-generated deal summary at a glance | 🔄 IN PROGRESS | 🔴 HIGH |
| **Census & Revenue Analysis** | All revenue-related data (rename from "Census & Rates") | 🔄 EXPAND | 🟡 MEDIUM |
| **Expense Analysis** | Monthly trended expense data (12 columns for TTM) | ❌ NOT STARTED | 🔴 HIGH |
| **Calculator** | Valuation analysis (cap rate, multiples, price per bed) | ✅ EXISTS | - |
| **Pro Forma** | ROI projection with editable benchmarks | ✅ JUST BUILT | 🔴 HIGH (Testing) |
| **Observations** | AI insights + user comments (3 sections) | 🔄 EXPAND | 🟡 MEDIUM |
| ~~Projections~~ | *DELETE THIS TAB* | 🗑️ REMOVE | 🟡 MEDIUM |

---

## 📑 Detailed Tab Specifications

### 1. Overview Tab (IN PROGRESS)
**Status:** 🔄 Being built in separate Claude Code window
**Priority:** 🔴 CRITICAL - First thing users see
**File:** `frontend/src/components/OverviewTab/OverviewTab.jsx`

**Purpose:** AI-generated deal snapshot before diving into details

**Content to Display:**
- Deal location (city, state)
- Number of facilities involved
- Facility types (SNF, ALF, Memory Care, CCRC, etc.)
- Total bed count across all facilities
- TTM revenue (trailing 12 months)
- TTM net income / EBITDA
- Brief AI summary of what documents/data we have
- Data completeness indicator (e.g., "8 of 10 key metrics available")

**Implementation Notes:**
- Query extraction_data from deal
- Use Gemini 2.0 Flash to generate natural language summary
- Cache summary to avoid re-generating on every page load
- Add "Regenerate Summary" button
- Show extraction timestamp and which documents were analyzed

---

### 2. Census & Revenue Analysis Tab (EXPAND EXISTING)
**Status:** 🔄 Needs expansion (currently called "Census & Rates")
**Priority:** 🟡 MEDIUM
**Current File:** Needs identification

**Purpose:** Everything related to revenue streams

**Sections to Include:**
1. **Occupancy Trends**
   - Historical occupancy chart (12-month trend)
   - Current vs. target occupancy
   - Days to stabilization estimate

2. **Payer Mix Breakdown**
   - Medicare vs. Medicaid vs. Private Pay
   - Visual pie chart
   - Revenue by payer source (dollar amounts)
   - Compare census-based vs. revenue-based payer mix

3. **Rate Schedules**
   - Private pay rates by unit type and care level
   - Medicaid rates by care level
   - Rate comparison to market (if data available)

4. **Revenue Metrics**
   - Average Daily Rate (ADR)
   - Revenue Per Available Room (RevPAR)
   - Revenue per occupied bed
   - Ancillary revenue breakdown

5. **Census Data Over Time**
   - Monthly census trends
   - Seasonal patterns
   - Move-in/move-out rates (if available)

**Implementation Priority:** After Pro Forma testing complete

---

### 3. Expense Analysis Tab (NEW - HIGH PRIORITY)
**Status:** ❌ NOT STARTED
**Priority:** 🔴 HIGH - Supports both valuation and ROI analysis
**File to Create:** `frontend/src/components/ExpenseAnalysisTab/ExpenseAnalysisTab.jsx`

**Purpose:** Monthly trended expense analysis with variance detection

**Display Format:**
Table with 12 monthly columns + TTM total, grouped by expense category:

| Category | Line Items | Display |
|----------|------------|---------|
| **Direct Care** | Salary & Wages - Caregivers<br>Outside Services Agency - CNA<br>PTO, Payroll Taxes, Benefits<br>**TOTAL** | $ + % of Rev |
| **Activities** | Salary & Wages - Activities<br>Entertainment, Supplies<br>**TOTAL** | $ + % of Rev |
| **Culinary** | Salary & Wages - Dietary<br>Food (raw cost)<br>Supplies<br>**TOTAL** | $ + % of Rev |
| **Housekeeping/Laundry** | Salary & Wages - Housekeeping<br>Supplies, Laundry, Linen<br>**TOTAL** | $ + % of Rev |
| **Maintenance** | Salary & Wages - Maintenance<br>Outside Services<br>Equipment Maintenance & Repair<br>Building Repair<br>**TOTAL** | $ + % of Rev |
| **Administration** | Salary & Wages - Administration<br>Outside Services<br>Computer Maintenance Fees<br>Telephone<br>**TOTAL** | $ + % of Rev |
| **General** | Bad Debt<br>Cable TV<br>Light & Power<br>Natural Gas & Oil<br>Water/Garbage/Sewer<br>**TOTAL** | $ + % of Rev |
| **Property** | Interest Expense<br>Depreciation<br>Property Taxes<br>Property Insurance<br>Land Lease<br>**TOTAL** | $ + % of Rev |

**Visual Features:**
- Raw dollar amounts for each month
- % of revenue for each line item
- TTM totals in final column
- Trend indicators (⬆️ improving, ⬇️ worsening, ➡️ stable)
- Highlight cells with anomalies (>20% variance from average)
- Sparkline charts for quick trend visualization
- Expandable/collapsible sections

**Data Source:**
- Pull from `extraction_data.expense_detail` (if available)
- Fall back to aggregated expense categories
- Show warning if detailed line items not available

**Implementation Requirements:**
1. Parse expense_detail JSON from extraction_data
2. Pivot data to show months as columns
3. Calculate % of revenue for each cell
4. Identify anomalies (statistical outliers)
5. Generate trend indicators
6. Add export to Excel functionality

**Estimated Effort:** 8-12 hours

---

### 4. Calculator Tab (EXISTS - NO CHANGES NEEDED)
**Status:** ✅ Already exists and functional
**Purpose:** "What is this facility worth? Is the asking price fair?"

**Features:**
- Cap rate implied value
- Price per bed analysis
- Revenue & EBITDA multiples
- Market comparisons
- Purchase price recommendations

**No action needed** - This tab is complete and working.

---

### 5. Pro Forma Tab (JUST BUILT - NEEDS TESTING)
**Status:** ✅ Complete, awaiting testing
**Priority:** 🔴 HIGH - Validate and fix any issues
**File:** `frontend/src/components/ProFormaTab/ProFormaTab.jsx`

**Purpose:** "If we buy this, what's our return over 3-5 years?"

**Current Features (Built):**
- Interactive benchmark editing
- Real-time opportunity calculations
- EBITDA bridge waterfall chart
- Save/load/delete scenarios
- Color-coded variance indicators

**Still Missing:**
- [ ] IRR (Internal Rate of Return) calculation
- [ ] Equity multiple calculation
- [ ] Cash-on-cash return calculation
- [ ] Multi-year projection modeling (Years 1-5)
- [ ] Exit value estimation
- [ ] Returns waterfall chart (capital stack distribution)

**Next Steps:**
1. Test with real extraction data
2. Fix any bugs found
3. Validate calculation accuracy
4. Add returns modeling (IRR, etc.) - estimated 6-8 hours

---

### 6. Observations Tab (EXPAND EXISTING)
**Status:** 🔄 Needs expansion
**Priority:** 🟡 MEDIUM
**Current Status:** Basic observations exist, needs structure

**Purpose:** AI insights + user collaboration

**Three Sections (Each with AI + User Comments):**

#### Section A: Data Quality Notes
- What's missing that we need for better analysis?
- Which metrics are incomplete or unreliable?
- What additional documents should we request?

**Example:**
> AI: "Occupancy data only available for 6 of 12 months. Request full year census report for accurate trend analysis."
> User Comment: "Called seller - they're sending Q3/Q4 census reports tomorrow."

#### Section B: Key Observations
- Important findings from the data
- Notable trends or patterns
- Red flags or positive indicators

**Example:**
> AI: "Agency staffing costs are 17.9% of direct care - significantly above industry standard of 2-5%. This represents ~$250K annual opportunity."
> User Comment: "Spoke with ED - they've had trouble retaining CNAs due to low wages. New wage structure implemented in Sept should help."

#### Section C: Biggest Opportunities
- Top value-creation opportunities identified
- Ranked by impact (dollar amount)
- Feasibility assessment

**Example:**
> AI: "Top 3 opportunities: 1) Reduce agency staffing ($250K), 2) Increase occupancy 82%→85% ($184K), 3) Optimize food cost ($72K). Total opportunity: $506K annually."
> User Comment: "Agency reduction is aggressive but doable. Occupancy increase depends on staffing first. Food cost needs new dietary director."

**Implementation:**
- Each section has:
  - AI-generated content (stored in database, regenerates on demand)
  - User comments field (rich text editor)
  - Last updated timestamp
  - "Regenerate AI insights" button
- Comments saved to `deal_comments` table (already exists)
- UI: Collapsible cards, one per section

**Estimated Effort:** 4-6 hours

---

### 7. Projections Tab (DELETE)
**Status:** 🗑️ Mark for removal
**Priority:** 🟡 MEDIUM
**Reason:** Functionality replaced by Pro Forma tab

**Action Items:**
- [ ] Remove tab from navigation
- [ ] Archive component code (don't delete - may have useful logic)
- [ ] Redirect old links to Pro Forma tab
- [ ] Update any tutorials/documentation

**Estimated Effort:** 1 hour

---

## 🐛 Known Bugs and Issues

### 1. TTM Financials Bug - CRITICAL
**Status:** 🔄 IN PROGRESS (separate Claude Code window)
**Priority:** 🔴 CRITICAL
**Impact:** Foundation - everything depends on accurate data

**Description:**
Period analyzer is only pulling through August when September data is available.

**Expected Behavior:**
When YTD file has data through September and T12 file has May-April, should combine:
- Oct-Feb: From T12 file
- Mar-Sep: From YTD file
- Result: Oct 2024 - Sep 2025 (most recent 12 months)

**Actual Behavior:**
Stops at August, resulting in:
- Oct 2024 - Aug 2025 (only 11 months)

**Root Cause:**
Likely in `backend/services/periodAnalyzer.js` - off-by-one error in month parsing or date comparison logic.

**Files to Check:**
- `backend/services/periodAnalyzer.js` - Period detection logic
- `backend/services/aiExtractor.js` - How period analysis gets used

**Testing Data:**
Odd Fellows Home documents - has both T12 (May-Apr) and YTD (Mar-Sep) files

**Estimated Fix Time:** 2-3 hours

---

### 2. Pro Forma Data Flow Issues
**Status:** ⚠️ UNKNOWN - Needs testing
**Priority:** 🔴 HIGH

**Potential Issues:**
- Is extraction_data flowing correctly to Pro Forma tab?
- Are expense_detail fields populated?
- Are expense_ratios calculated and stored?
- Is the calculator API endpoint returning normalized_metrics?

**Testing Needed:**
1. Upload documents with detailed P&L
2. Run extraction
3. Verify extraction_data structure in database
4. Open Pro Forma tab
5. Check browser console for errors
6. Verify data displays in table
7. Test benchmark editing and recalculation

**Next Action:** Full integration test (see Testing Checklist section)

---

## 🚀 Additional Features (Beyond Pro Forma)

### 1. Source Citation with PDF Highlighting
**Status:** ❌ NOT STARTED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 12-16 hours

**Description:**
Any populated data field should show its source. Clicking the source opens the PDF with highlighting at the exact location where data was found.

**Example:**
```
Annual Revenue: $5,000,000
Source: Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45
        [📄 View Source]
```

Clicking "[📄 View Source]" opens PDF viewer, scrolls to page, highlights relevant text.

**Implementation Requirements:**

1. **Store Location Data (Already Done)**
   - AI extraction already returns source citations:
     ```json
     {
       "value": 5000000,
       "source": "Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45 | 'Total Revenue: $3,933,015'"
     }
     ```

2. **Parse Source String**
   - Extract: document name, location (page/sheet/row), snippet
   - Map document name to file ID in database

3. **PDF Viewer Component**
   - Use PDF.js or react-pdf library
   - Navigate to specific page
   - Highlight search text

4. **Excel Viewer (Optional)**
   - Use SheetJS + highlighting library
   - Or screenshot the relevant sheet area

5. **UI Components**
   - Source citation badge/link on each data field
   - Modal or sidebar with document viewer
   - Highlight animation on open

**Dependencies:**
- PDF.js or react-pdf: `npm install react-pdf`
- SheetJS: `npm install xlsx` (already installed)

**Files to Create:**
- `frontend/src/components/DocumentViewer/DocumentViewer.jsx`
- `frontend/src/components/DocumentViewer/PDFViewer.jsx`
- `frontend/src/components/DocumentViewer/ExcelViewer.jsx`
- `frontend/src/components/SourceCitation/SourceCitation.jsx`

**Usage Example:**
```jsx
<SourceCitation
  source="Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45"
  documentId={doc.id}
  onViewSource={() => openDocumentViewer(doc.id, 'Sheet:Summary', 'row:45')}
/>
```

---

### 2. Comments System Integration
**Status:** 🔄 PARTIAL (backend exists, UI needed)
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 6-8 hours

**Description:**
Users can add comments to deals. Backend table `deal_comments` already exists.

**Database Schema (Existing):**
```sql
CREATE TABLE deal_comments (
  id INTEGER PRIMARY KEY,
  deal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  comment_text TEXT,
  section VARCHAR(50),  -- 'data_quality', 'observations', 'opportunities', etc.
  created_at DATETIME,
  updated_at DATETIME
);
```

**Integration Points:**

1. **Observations Tab**
   - Add comment box to each of 3 sections
   - Save with section identifier
   - Display all comments for that section

2. **Global Comments**
   - "Comments" section at bottom of deal page
   - Shows all comments across all tabs/sections
   - Filter by section or show all

3. **Inline Comments (Future)**
   - Add comment icon next to any data field
   - Attach comment to specific metric
   - Store field name in section column

**UI Components Needed:**
- `CommentBox.jsx` - Input field + submit button
- `CommentList.jsx` - Display list of comments
- `CommentItem.jsx` - Single comment with edit/delete

**API Endpoints Needed:**
```javascript
GET /api/deals/:dealId/comments
GET /api/deals/:dealId/comments?section=data_quality
POST /api/deals/:dealId/comments
PUT /api/deals/:dealId/comments/:commentId
DELETE /api/deals/:dealId/comments/:commentId
```

**Files to Create:**
- `frontend/src/components/Comments/CommentBox.jsx`
- `frontend/src/components/Comments/CommentList.jsx`
- `frontend/src/components/Comments/CommentItem.jsx`
- `backend/routes/comments.js` (if not exists)

---

### 3. Pro Forma as Full Financial Modeling Tool
**Status:** 🔄 PARTIAL (benchmarks done, returns not done)
**Priority:** 🔴 HIGH
**Estimated Effort:** 8-12 hours

**Description:**
Expand Pro Forma beyond just benchmarks to full P&L modeling with IRR calculations.

**Additional Features Needed:**

#### A. Returns Modeling
Calculate investor returns based on:
- Purchase price
- Down payment %
- Loan terms (rate, amortization)
- Operating assumptions (occupancy ramp, expense improvements)
- Hold period (3, 5, 7 years)
- Exit cap rate

**Metrics to Calculate:**
- IRR (Internal Rate of Return)
- Equity Multiple (Cash out / Cash in)
- Cash-on-Cash Return (Annual CF / Equity invested)
- NPV (Net Present Value)
- Payback Period

**Implementation:**
```javascript
// backend/services/returnsCalculator.js

class ReturnsCalculator {
  static calculateIRR(cashFlows) {
    // Use Newton-Raphson method or npm package 'irr'
  }

  static calculateReturns(deal, assumptions) {
    // 1. Build cash flow projection (Years 0-5)
    // 2. Calculate annual NOI with ramp
    // 3. Calculate debt service
    // 4. Calculate distributable cash flow
    // 5. Calculate exit proceeds
    // 6. Run IRR calculation
    // 7. Calculate equity multiple
    // 8. Return all metrics
  }
}
```

**UI Additions:**
- "Returns" section in Pro Forma tab
- Inputs: Purchase price, down payment %, loan rate, hold period
- Display: IRR, Equity Multiple, Cash-on-Cash
- Chart: Cash flow waterfall over hold period

#### B. Multi-Year Projection
Currently shows stabilized state. Need year-by-year ramp:

| Year | Occupancy | Revenue | EBITDA | Cash Flow |
|------|-----------|---------|--------|-----------|
| 1 | 84% | $5.1M | $360K | $120K |
| 2 | 86% | $5.3M | $450K | $210K |
| 3 | 88% | $5.5M | $520K | $280K |
| 4 | 88% | $5.6M | $540K | $300K |
| 5 | 88% | $5.7M | $550K | $310K |

**Implementation:**
- Add ramp assumptions (months to stabilization)
- Calculate graduated improvements
- Store yearly_projections in scenario

#### C. Capital Stack Visualization
Show how returns are distributed:
- Preferred return to investors
- Promote to sponsor
- Remaining cash flow split

**Priority:** After core Pro Forma testing complete

---

### 4. Interactive SNFalyze Analyzer
**Status:** ❌ NOT STARTED
**Priority:** 🟢 LOW
**Estimated Effort:** 4-6 hours

**Description:**
Make the algorithm results interactive on deal page, not just static output.

**Current State:**
SNFalyze algorithm returns a deal score and recommendation, displayed as static text.

**Target State:**
- Users can adjust algorithm inputs (weights, thresholds)
- See how changes affect the deal score in real-time
- Visual sliders for key factors
- Compare multiple deals side-by-side

**Example:**
```
Current Score: 72/100 (STRONG BUY)

Adjust Weights:
[========] Location Quality (20%)
[==========] Financial Performance (30%)
[======] Payer Mix (15%)
[=====] Occupancy (10%)
[=====] Expense Efficiency (15%)
[====] Growth Potential (10%)

New Score: 68/100 (BUY)
```

**Implementation:**
- Load algorithm logic to frontend
- Add weight adjustment sliders
- Recalculate score on change
- Persist user's custom weights to profile

---

### 5. Cross-Deal AI Analysis
**Status:** ❌ NOT STARTED
**Priority:** 🟢 LOW
**Estimated Effort:** 12-16 hours

**Description:**
AI analyzes multiple deals at once, compares them, identifies best opportunities across portfolio.

**Use Cases:**
1. **Deal Comparison**
   - "Compare deals A, B, and C - which has the best returns?"
   - Side-by-side table with key metrics
   - AI recommendation with reasoning

2. **Portfolio Analysis**
   - "What are my top 5 deals by IRR?"
   - "Which deals have the highest risk?"
   - "Show me all Oregon ALF deals under $5M"

3. **Pattern Detection**
   - "Which region has the best margins?"
   - "Do larger facilities have better EBITDA margins?"
   - "Which seller brokers have the most accurate financials?"

**Implementation:**
```javascript
// New endpoint
POST /api/deals/analyze-multiple

Request:
{
  deal_ids: [1, 2, 3, 4, 5],
  analysis_type: "comparison" | "ranking" | "pattern_detection",
  criteria: ["irr", "ebitda_margin", "occupancy"]
}

Response:
{
  summary: "Deal #3 (Portland ALF) offers the best risk-adjusted return...",
  comparison_table: [...],
  recommendations: [...]
}
```

**UI:**
- Checkbox selection on deals list page
- "Analyze Selected" button
- New modal/page with comparison results
- Export comparison as PDF

---

## 🧪 Comprehensive Testing Checklist

### Backend Testing
- [ ] Backend starts without errors (`npm start`)
- [ ] Database syncs successfully (`npm run db:sync`)
- [ ] All migrations run without errors
- [ ] Existing extraction API still works
- [ ] New extraction includes expense_detail in response
- [ ] Calculator endpoint returns normalized_metrics
- [ ] Pro forma calculate endpoint returns opportunities
- [ ] Scenario save endpoint creates database record
- [ ] Scenario load endpoint returns saved data
- [ ] Scenario delete endpoint removes record

### Frontend Testing
- [ ] Frontend starts without errors (`npm start`)
- [ ] No console errors on page load
- [ ] Deal detail page renders all tabs
- [ ] Overview tab displays (once built)
- [ ] Pro Forma tab renders without errors
- [ ] Table displays current financial data
- [ ] Benchmark inputs are editable
- [ ] Editing a benchmark triggers recalculation (500ms debounce)
- [ ] Variance cells show correct colors (green/yellow/red)
- [ ] Waterfall chart renders
- [ ] Summary cards show correct totals
- [ ] Can open save scenario modal
- [ ] Can save a scenario with name
- [ ] Saved scenario appears in dropdown
- [ ] Can load a saved scenario
- [ ] Loading scenario updates benchmarks
- [ ] Can delete a scenario
- [ ] Reset to defaults button works
- [ ] Success/error messages display correctly

### Integration Testing
- [ ] Upload test documents to a deal
- [ ] Run AI extraction
- [ ] Verify extraction_data populated in database
- [ ] Open Pro Forma tab
- [ ] Verify data flows to component
- [ ] Adjust multiple benchmarks
- [ ] Verify calculations are accurate
- [ ] Save scenario
- [ ] Reload page
- [ ] Load saved scenario
- [ ] Verify benchmarks match saved values
- [ ] Navigate between tabs without losing data

### Regression Testing
- [ ] Calculator tab still works
- [ ] Document upload still works
- [ ] AI extraction quality unchanged
- [ ] User authentication still works
- [ ] Deal list page still works
- [ ] No performance degradation

---

## 🧪 Sample Test Data

Use **Odd Fellows Home of Oregon** for testing:

```javascript
{
  // Facility Info
  facility_name: "Odd Fellows Home of Oregon",
  facility_type: "Assisted Living",
  location: "Portland, OR",
  state: "OR",
  bed_count: 100,

  // T12 Financials (Oct 2024 - Sep 2025)
  total_revenue: 3933015,        // $3.9M
  total_expenses: 5035549,       // $5.0M
  net_income: -1102534,          // -$1.1M (LOSS)

  // Profitability (all negative)
  ebit: -1053534,
  ebitda: -706544,               // -$706K
  ebitdar: -658544,              // -$658K
  ebitda_margin: -18.0,          // -18% margin

  // Census & Occupancy
  avg_daily_census: 94,
  occupancy_pct: 94,             // 94% occupied

  // Payer Mix
  medicaid_pct: 78.5,            // Heavy Medicaid
  private_pay_pct: 21.5,         // Low private pay
  medicare_pct: 0,

  // Expense Issues (RED FLAGS)
  labor_pct: 73.2,               // 73% of revenue (Target: 55%)
  agency_staffing_total: 320108, // $320K agency costs
  agency_pct_of_labor: 17.9,     // 17.9% of labor (Target: 2%)
  food_cost_per_day: 12.80,      // $12.80/day (Target: $10.50)
  management_fee_pct: 5.5,       // 5.5% (Target: 4%)
  bad_debt_pct: 2.8,             // 2.8% (Target: 0.5%)

  // Department Totals
  total_direct_care: 1787943,
  total_activities: 85432,
  total_culinary: 398421,
  total_housekeeping: 142801,
  total_maintenance: 156293,
  total_administration: 312456,
  total_general: 189234,
  total_property: 963069
}
```

**Why This is Good Test Data:**
- ❌ **Currently Unprofitable** - Lots of improvement opportunities
- ❌ **Critical Issues** - Agency staffing at 17.9% (should be 2%)
- ❌ **High Labor** - 73% of revenue (should be 55%)
- ✅ **High Occupancy** - 94% (good)
- ⚠️ **Heavy Medicaid** - 78.5% (challenging payer mix)
- 💰 **Big Turnaround Opportunity** - $1M+ potential improvement

**Expected Pro Forma Results:**
```javascript
{
  opportunities: [
    { category: "Labor Optimization", opportunity: 718000 },      // 73% → 55%
    { category: "Agency Reduction", opportunity: 288000 },        // 17.9% → 2%
    { category: "Food Cost", opportunity: 79000 },                // $12.80 → $10.50
    { category: "Management Fee", opportunity: 59000 },           // 5.5% → 4%
    { category: "Bad Debt", opportunity: 90000 }                  // 2.8% → 0.5%
  ],
  total_opportunity: 1234000,                                     // $1.2M+
  stabilized_ebitda: 527456,                                      // From -$706K to +$527K
  stabilized_margin: 13.4                                         // From -18% to +13%
}
```

---

## 🚀 Deployment Specifics

### Platform: Render

**Repository:** GitHub
**Deployment Method:** Auto-deploy on push to `main` branch

**Services:**
1. **Backend Service** - Node.js + Express
   - Build Command: `npm install`
   - Start Command: `npm start` or `node app_snfalyze.js`
   - Environment Variables:
     - `DATABASE_URL` - PostgreSQL connection string (auto-set by Render)
     - `ANTHROPIC_API_KEY` - Claude AI key
     - `JWT_SECRET` - Authentication secret
     - `NODE_ENV=production`

2. **Frontend Service** - React
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`
   - Environment Variables:
     - `REACT_APP_API_URL` - Backend URL

3. **Database** - PostgreSQL
   - Managed by Render
   - Automatic backups
   - Connection string auto-injected as `DATABASE_URL`

### Deployment Workflow

```bash
# 1. Make changes locally
# 2. Test locally

# 3. Commit changes
git add .
git commit -m "Descriptive commit message"

# 4. Push to GitHub
git push origin main

# 5. Render auto-deploys on push
# Monitor deployment at: https://dashboard.render.com

# 6. Run database sync if schema changed
# Option A: Via Render Shell
# - Go to backend service → Shell
# - Run: npm run db:sync

# Option B: Add auto-sync to app.js
# Add this to backend/app_snfalyze.js:
const db = require('./models');
db.sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced successfully');
});
```

### Post-Deployment Verification

```bash
# Check backend health
curl https://snfalyze-backend.onrender.com/api/health

# Check frontend loads
curl https://snfalyze.onrender.com

# Test API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://snfalyze-backend.onrender.com/api/deals/1
```

### Database Migration Checklist

When deploying schema changes:
- [ ] Backup production database first
- [ ] Test migration on staging environment
- [ ] Run migration via Render Shell: `npm run db:sync`
- [ ] Verify tables created: `\dt` in psql
- [ ] Run seed data if needed: `npm run seed`
- [ ] Test API endpoints to verify schema
- [ ] Monitor error logs for 24 hours

---

## 🎯 Updated Priority Order

Based on business impact and dependencies:

| Priority | Item | Status | Estimated Effort | Business Impact |
|----------|------|--------|------------------|-----------------|
| **1** | Fix TTM Financials Bug | 🔄 IN PROGRESS | 2-3 hours | 🔴 CRITICAL - Blocks everything |
| **2** | Pro Forma Testing & Bug Fixes | ⚠️ NEEDS TESTING | 4-6 hours | 🔴 CRITICAL - Just built |
| **3** | Overview Tab | 🔄 IN PROGRESS | 6-8 hours | 🔴 HIGH - First impression |
| **4** | Expense Analysis Tab | ❌ NOT STARTED | 8-12 hours | 🔴 HIGH - Supports valuation |
| **5** | Returns Modeling (IRR, Equity Multiple) | ❌ NOT STARTED | 8-12 hours | 🔴 HIGH - Completes ROI |
| **6** | Observations Tab Expansion | ❌ NOT STARTED | 4-6 hours | 🟡 MEDIUM - User collaboration |
| **7** | Comments System Integration | 🔄 PARTIAL | 6-8 hours | 🟡 MEDIUM - Team collaboration |
| **8** | Census & Revenue Analysis Expansion | ❌ NOT STARTED | 6-8 hours | 🟡 MEDIUM - Enhanced analysis |
| **9** | Source Citation with PDF | ❌ NOT STARTED | 12-16 hours | 🟡 MEDIUM - Data verification |
| **10** | Delete Projections Tab | ❌ NOT STARTED | 1 hour | 🟡 MEDIUM - Cleanup |
| **11** | Interactive Analyzer | ❌ NOT STARTED | 4-6 hours | 🟢 LOW - Nice-to-have |
| **12** | Cross-Deal Analysis | ❌ NOT STARTED | 12-16 hours | 🟢 LOW - Portfolio feature |

### Why This Order?

1. **Fix TTM Bug First** - Everything depends on accurate data
2. **Test & Fix Pro Forma** - Just built, need to validate before moving on
3. **Overview Tab** - First thing users see, sets the tone
4. **Expense Analysis** - Supports both Calculator and Pro Forma tabs
5. **Returns Modeling** - Completes the "ROI" mission
6. **Everything Else** - Enhancements and nice-to-haves

---

## 📞 Questions & Decisions Needed

### Open Questions

1. **Overview Tab AI Model**
   - Using Gemini 2.0 Flash or Claude?
   - Cache summary or regenerate each time?

2. **Returns Modeling Assumptions**
   - What default loan terms? (80% LTV, 6% rate, 25-year amortization?)
   - Default hold period? (5 years?)
   - Exit cap rate? (Current cap + 100bps?)

3. **Expense Analysis Tab Data**
   - What if only aggregated totals available (no monthly breakdown)?
   - Show warning or hide tab entirely?

4. **Comments Permissions**
   - Can users edit other users' comments?
   - Role-based permissions (admin can delete any comment)?

5. **Deployment Timing**
   - Deploy Pro Forma immediately after testing?
   - Wait until all 6 tabs redesigned?

### Decisions Made

1. ✅ **Tab Structure** - Settled on 6-tab layout
2. ✅ **Benchmark Defaults** - Using Cascadia standards (55% labor, 2% agency, etc.)
3. ✅ **Database Schema** - benchmark_configurations and deal_proforma_scenarios tables approved
4. ✅ **Calculation Debounce** - 500ms debounce on benchmark changes
5. ✅ **Scenario Storage** - Store only overrides (differences from defaults)

---

## 📚 Additional Resources

### Cascadia Benchmarks (Reference)

| Metric | Target | Max Acceptable | Critical |
|--------|--------|----------------|----------|
| EBITDA Margin | 9% | - | - |
| EBITDAR Margin | 23% | - | - |
| Occupancy | 85% | - | - |
| Labor % of Revenue | 55% | 62% | >68% |
| Agency % of Labor | 2% | 5% | >10% |
| Food Cost Per Day | $10.50 | $13.00 | >$16.00 |
| Management Fee % | 4% | 5% | >6% |
| Bad Debt % | 0.5% | 1.0% | >2.0% |
| Utilities % | 2.5% | 3.5% | >4.5% |

### Calculation Formulas

**EBITDA:**
```
EBITDA = Net Income + Interest + Taxes + Depreciation + Amortization
```

**EBITDAR:**
```
EBITDAR = EBITDA + Rent/Lease Expense
```

**Occupancy:**
```
Occupancy % = (Average Daily Census / Total Beds) × 100
```

**Revenue Per Occupied Bed:**
```
RPB = Annual Revenue / (Beds × Occupancy % × 365)
```

**Labor Opportunity:**
```
Opportunity = Current Labor $ - (Revenue × Target Labor %)
```

**Occupancy Opportunity:**
```
Additional Beds = Total Beds × (Target Occ % - Current Occ %)
Additional Revenue = Additional Beds × 365 × Revenue Per Bed Per Day
```

**IRR (Simplified):**
```
NPV = Σ [CF_t / (1 + IRR)^t] = 0
Where CF_t = Cash Flow in year t
Solve for IRR using Newton-Raphson method
```

---

**End of Enhanced Project Status Document**

*This document consolidates the Pro Forma feature status with the broader platform roadmap. Update as work progresses.*
```

---

## Backend Dependencies (package.json)

```json
{
  "name": "snfalyze-local-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "nodemon app_snfalyze.js",
    "seed": "node seed.js",
    "db:sync": "node scripts/syncDatabase.js",
    "db:migrate:cms": "node scripts/migrate-cms-schema-production.js",
    "db:import:cms": "node scripts/import-cms-to-production.js",
    "db:sync:market": "node scripts/sync-to-market-db.js",
    "db:sync:market:dry": "node scripts/sync-to-market-db.js --dry-run",
    "test:proforma": "node scripts/testProforma.js",
    "context": "cd .. && ./scripts/generate-context-bundle.sh"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.71.0",
    "@aws-sdk/client-s3": "^3.947.0",
    "@aws-sdk/s3-request-presigner": "^3.947.0",
    "@google/generative-ai": "^0.24.1",
    "adm-zip": "^0.5.16",
    "aws-sdk": "^2.1692.0",
    "axios": "^1.11.0",
    "bcryptjs": "^3.0.2",
    "body-parser": "^2.2.0",
    "cookie-parser": "~1.4.4",
    "cors": "^2.8.5",
    "csv-parse": "^6.1.0",
    "csv-parser": "^3.2.0",
    "debug": "~2.6.9",
    "dotenv": "^17.2.0",
    "ejs": "~2.6.1",
    "express": "~4.16.1",
    "express-fileupload": "^1.5.2",
    "http-errors": "~1.6.3",
    "jsonwebtoken": "^9.0.2",
    "morgan": "~1.9.1",
    "multer": "^1.4.5-lts.1",
    "nodemon": "^3.1.10",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "path": "^0.12.7",
    "pdf-parse": "^1.1.1",
    "pdf-to-img": "^5.0.0",
    "pg": "^8.11.3",
    "pg-hstore": "^2.3.4",
    "posthog-js": "^1.309.1",
    "randomstring": "^1.3.1",
    "sequelize": "^6.37.7",
    "socket.io": "^4.8.1",
    "sqlite3": "^5.1.7",
    "xlsx": "^0.18.5"
  }
}
```

---

## Frontend Dependencies (package.json)

```json
{
  "name": "snfalyze-dashboard",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@hookform/resolvers": "^5.1.1",
    "@mui/icons-material": "^5.18.0",
    "@mui/material": "^5.18.0",
    "@react-google-maps/api": "^2.20.7",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^13.2.1",
    "ajv": "^8.17.1",
    "axios": "^1.10.0",
    "d3-scale": "^4.0.2",
    "date-fns": "^4.1.0",
    "jspdf": "^3.0.4",
    "jspdf-autotable": "^5.0.2",
    "lucide-react": "^0.525.0",
    "mammoth": "^1.11.0",
    "posthog-js": "^1.309.1",
    "react": "^19.1.0",
    "react-bootstrap": "^2.10.10",
    "react-dom": "^19.1.0",
    "react-google-places-autocomplete": "^4.1.0",
    "react-hook-form": "^7.60.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.7.0",
    "react-scripts": "5.0.1",
    "react-simple-maps": "^3.0.0",
    "react-toastify": "^11.0.5",
    "recharts": "^3.5.1",
    "remark-gfm": "^4.0.1",
    "socket.io-client": "^4.8.1",
    "web-vitals": "^2.1.0",
    "xlsx": "^0.18.5",
    "yup": "^1.6.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "CI=false react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@types/recharts": "^1.8.29",
    "typescript": "^5.9.3"
  }
}
```

---

## Key File Structure

```
Backend:
backend/app_snfalyze.js
backend/bellwether_validation.js
backend/check_extraction.js
backend/create-tables-and-migrate.js
backend/migrate-to-postgres.js
backend/run-ccn-migration.js
backend/run-index-migration.js
backend/seed.js
backend/test_cim_extraction.js
backend/test-alf-search.js
backend/test-deals-endpoint.js
backend/test-facilities-endpoint.js

Backend Routes:
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
backend/routes/surveyIntelligence.js
backend/routes/taxonomy.js
backend/routes/user.js
backend/routes/users.js
backend/routes/wages.js

Backend Services:
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

Frontend Pages:
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
```

