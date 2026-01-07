# PostAcutePulse - Claude Code Onboarding Bundle

> **Auto-generated** - Do not edit manually
> Last updated: 2026-01-07 12:32:12
> Project: /Users/nikolashulewsky/Projects/pac-advocate

This bundle contains all essential project context for onboarding new Claude Code sessions.

---

## README.md

```markdown
# PACadvocate - Market Intelligence Platform

A Market Intelligence platform for skilled nursing facilities, forked from SNFalyze.

## Port Configuration

This project uses unique ports to run simultaneously with other projects:

| Service  | Port | URL                         |
|----------|------|-----------------------------|
| Frontend | 2026 | http://localhost:2026       |
| Backend  | 5002 | http://localhost:5002       |

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

Backend runs on http://localhost:5002

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

Frontend runs on http://localhost:2026

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

## Database Migrations (IMPORTANT!)

When you change database schema (add/remove columns, create tables), you need **both**:
1. Update the Sequelize model file (`backend/models/`)
2. Create a migration file (`backend/migrations/`)

### Why?
- **Code** (models, routes) deploys via GitHub → Render
- **Database schema** requires explicit SQL commands
- Migrations run automatically on app startup

### Quick Example
Adding a new column? Create `backend/migrations/20241223-add-my-column.js`:

```javascript
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('my_table', 'my_column', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  }
};
```

### Automatic Reminder
The pre-commit hook will warn you when model files change without a migration.

See **[backend/DATABASE_MIGRATIONS.md](backend/DATABASE_MIGRATIONS.md)** for the full guide.

---

## Troubleshooting

**"Cannot find module 'sqlite3'"**
```bash
cd backend && npm install sqlite3 --save
```

**"Port 5002 already in use"**
```bash
lsof -ti:5002 | xargs kill -9
```

**"CORS error"**
Make sure backend is running and frontend `.env` has correct API URL.

**Database errors after model changes**
Delete `database.sqlite` and re-run seed.
```

---

## PROJECT_CONTEXT.md

```markdown
# PostAcutePulse (pac-advocate) Project Context

## Purpose

**PostAcutePulse** is a Market Intelligence Platform for the post-acute care sector, including skilled nursing facilities (SNF), assisted living facilities (ALF), and home health agencies (HHA). Built for Cascadia Healthcare to support market research, competitive analysis, and strategic planning.

**Key Distinction:** This is a **market intelligence** platform, NOT a deal analysis tool. It focuses on:
- Market composition and trends
- Facility/operator research and comparison
- Survey deficiency analytics and regulatory risk
- Watchlist management for tracking facilities of interest
- M&A activity monitoring (observation, not deal execution)

---

## Tech Stack

### Backend
- **Runtime**: Node.js + Express
- **ORM**: Sequelize
- **Database**: SQLite (local dev) / PostgreSQL (production on Render)
- **AI**: Claude API (Anthropic) for document analysis
- **Real-time**: Socket.io

### Frontend
- **Framework**: React 19
- **UI**: React Bootstrap + Material-UI + custom CSS
- **HTTP Client**: Axios
- **Maps**: Google Maps API (`@react-google-maps/api`)
- **Charts**: Recharts
- **Icons**: Lucide React

### Port Configuration
| Service  | Port | URL                    |
|----------|------|------------------------|
| Frontend | 2026 | http://localhost:2026  |
| Backend  | 5002 | http://localhost:5002  |

---

## Folder Structure

```
pac-advocate/
├── backend/
│   ├── app_snfalyze.js              # Express app entry point
│   ├── controller/
│   │   ├── AuthenticationController.js  # User management
│   │   ├── MarketController.js          # Market intelligence
│   │   ├── WatchlistController.js       # Watchlist management
│   │   └── SurveyIntelligenceController.js  # Survey analytics
│   ├── services/
│   │   ├── marketService.js         # Core market analytics (75KB)
│   │   ├── aiExtractor.js           # Claude AI extraction
│   │   └── notificationService.js   # User notifications
│   ├── models/
│   │   ├── users.js                 # User accounts
│   │   ├── watchlist.js             # Watchlist entries
│   │   ├── watchlist_item.js        # Saved facility/operator items
│   │   ├── user_saved_items.js      # User's saved items
│   │   ├── cascadia_facility.js     # Internal facility tracking
│   │   ├── facility_comments.js     # Notes on facilities
│   │   ├── ownership_comments.js    # Notes on operators
│   │   └── market_comments.js       # Notes on markets
│   ├── routes/
│   │   ├── market.js                # Market analysis API (44KB)
│   │   ├── ownership.js             # Ownership research API (68KB)
│   │   ├── surveyIntelligence.js    # Survey analytics API (105KB)
│   │   ├── facilities.js            # Facility search API (55KB)
│   │   ├── hh-market.js             # Home health market API
│   │   ├── savedItems.js            # Saved items API
│   │   └── watchlist.js             # Watchlist API
│   └── database.sqlite              # Local SQLite database
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Main dashboard
│   │   │   ├── MarketAnalysis.jsx   # Map-based market explorer (36KB)
│   │   │   ├── FacilityProfile.jsx  # SNF facility detail (71KB)
│   │   │   ├── OwnershipProfile.jsx # Operator profile (83KB)
│   │   │   ├── SurveyAnalytics.jsx  # Survey deficiency analytics (140KB)
│   │   │   ├── HomeHealthAgency.jsx # HHA detail view (38KB)
│   │   │   ├── SavedItems.jsx       # Watchlist/saved items
│   │   │   └── OperatorProfile.jsx  # Simplified operator view
│   │   ├── components/
│   │   │   ├── MarketAnalysis/      # Market analysis components
│   │   │   └── common/              # Shared UI components
│   │   ├── api/
│   │   │   ├── marketService.js     # Market API client
│   │   │   └── apiRoutes.js         # API endpoint definitions
│   │   └── context/
│   │       └── GoogleMapsContext.js # Google Maps provider
│   └── public/
│
├── PROJECT_CONTEXT.md               # This file
├── README.md                        # Quick start guide
└── docs/                            # Additional documentation
```

---

## Core Features

### 1. Market Analysis (MarketAnalysis.jsx)
Interactive map-based market explorer with:
- **State-level view**: Select a state to see all facilities, market metrics
- **City-level view**: Search by city/zip to see local market
- **Provider filtering**: Toggle SNF, HHA, ALF visibility
- **Market metrics**: Demographics, competition, labor market data
- **Provider table**: Sortable list with ratings, beds, distance

### 2. Facility Profile (FacilityProfile.jsx)
Deep-dive into individual SNF facilities:
- Quality ratings (CMS 5-star)
- Staffing metrics and trends
- Survey deficiency history
- Ownership information
- Geographic context

### 3. Ownership Research (OwnershipProfile.jsx)
Operator/ownership chain analysis:
- Portfolio composition (facilities owned)
- Geographic footprint
- Quality metrics across portfolio
- M&A transaction history
- Contact information

### 4. Survey Analytics (SurveyAnalytics.jsx)
CMS survey deficiency intelligence:
- National/state/county trends
- Top deficiency tags (F-tags)
- Seasonal and day-of-week patterns
- Facility risk forecasting
- Bellwether facility signals

### 5. Home Health Market (HomeHealthAgency.jsx)
Home health agency market data:
- Agency profiles and quality scores
- Service area coverage
- Medicare/Medicaid mix
- M&A activity in HHA sector

### 6. Watchlist/Saved Items (SavedItems.jsx)
Personal tracking system:
- Save facilities, operators, markets
- Add notes and comments
- Track changes over time
- Export watchlist data

---

## Database Schema

### Application Tables (SQLite/PostgreSQL)

#### users
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| email | STRING | Login email |
| password | STRING | Hashed password |
| first_name | STRING | First name |
| last_name | STRING | Last name |
| role | STRING | admin, analyst, user |
| status | STRING | active, inactive |

#### watchlist
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | FK to users |
| name | STRING | Watchlist name |

#### watchlist_item
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| watchlist_id | INTEGER | FK to watchlist |
| item_type | STRING | facility, operator, market |
| item_id | STRING | CCN or operator ID |

#### user_saved_items
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | FK to users |
| item_type | STRING | Type of saved item |
| ccn | STRING | Facility CCN (if applicable) |
| cms_facility_id | STRING | CMS facility ID |
| ownership_id | STRING | Operator ID (if applicable) |
| notes | TEXT | User notes |

#### facility_comments / ownership_comments / market_comments
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | FK to users |
| target_id | STRING | CCN, operator ID, or market key |
| comment | TEXT | Comment text |
| parent_id | INTEGER | For threaded comments |

#### cascadia_facility
| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| ccn | STRING | CMS Certification Number |
| name | STRING | Facility name |
| state | STRING | State code |
| company | STRING | Cascadia company assignment |
| team | STRING | Internal team |
| status | STRING | Tracking status |

### External Data Sources (PostgreSQL on Render)

#### snf_platform database
- **health_citations** (417K records) - Survey deficiency data
- **survey_dates** (151K records) - Survey visit records
- **snf_facilities** (14.6K records) - Facility details
- **citation_descriptions** - F-tag definitions

#### snf_market_data database
- **ownership_profiles** - Operator organizations
- **snf_ownership_data** - Facility-owner mappings
- **snf_vbp_performance** - Value-based purchasing scores
- **demographics** - County-level population data

---

## API Endpoints

### Market Intelligence (`/api/v1/markets`)
```
GET  /states                        List states with facility counts
GET  /states/:stateCode             State market summary
GET  /states/:stateCode/counties    Counties with metrics
GET  /states/:stateCode/summary     State analytics (rating dist, top counties)
GET  /map                           Facilities for map display
GET  /metrics                       Market metrics (demographics, competition)
```

### Facility Research (`/api/v1/facilities`)
```
GET  /search                        Search facilities by name/CCN
GET  /:ccn                          Facility detail
GET  /:ccn/quality                  Quality ratings
GET  /:ccn/staffing                 Staffing metrics
GET  /:ccn/citations                Survey deficiencies
GET  /:ccn/ownership                Ownership info
```

### Ownership Research (`/api/v1/ownership`)
```
GET  /profiles                      Search operators
GET  /profiles/:id                  Operator detail
GET  /profiles/:id/facilities       Facilities owned
GET  /profiles/:id/timeline         M&A history
GET  /chain/:ccn                    Ownership chain for facility
```

### Survey Intelligence (`/api/v1/survey-intelligence`)
```
GET  /national/summary              National YTD stats
GET  /national/trends               Monthly trends
GET  /states/:stateCode             State detail
GET  /ftags/top                     Top deficiency tags
GET  /patterns/day-of-week          Survey timing patterns
GET  /facilities/:ccn/forecast      Survey probability
GET  /facilities/:ccn/risk-profile  Risk assessment
GET  /bellwethers/:ccn              Bellwether relationships
```

### Home Health (`/api/v1/hh-market`)
```
GET  /agencies                      List agencies
GET  /agencies/:ccn                 Agency detail
GET  /market-summary                HHA market overview
```

### Watchlist (`/api/v1/saved-items`)
```
GET  /                              Get user's saved items
POST /                              Save new item
PUT  /:id                           Update saved item
DELETE /:id                         Remove saved item
```

### Authentication (`/api/v1/auth`)
```
POST /login                         User login
POST /sign-up                       Register
GET  /get-my-detail                 Current user info
POST /create-user                   Create user (admin)
GET  /get-users                     List users
```

---

## Key Differences from SNFalyze

| Aspect | SNFalyze | PostAcutePulse |
|--------|----------|----------------|
| **Purpose** | M&A deal evaluation | Market intelligence |
| **Primary User Action** | Upload documents, analyze deals | Search markets, research facilities |
| **Core Data** | Deal financials (P&L, census) | CMS data, demographics |
| **Key Models** | deals, deal_facilities | watchlist, user_saved_items |
| **Key Pages** | DealDetail, DealCalculator | MarketAnalysis, FacilityProfile |
| **Backend Port** | 5001 | 5002 |
| **Frontend Port** | 3000 | 2026 |

---

## Environment Variables

### Backend (.env)
```
# Server
APP_PORT=5002

# Database (Production)
DATABASE_URL=postgresql://...          # Main app DB
MARKET_DATABASE_URL=postgresql://...   # Market data DB
CMS_DATABASE_URL=postgresql://...      # CMS survey data

# AI
ANTHROPIC_API_KEY=sk-ant-...

# AWS S3 (file storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=...
```

### Frontend (.env)
```
PORT=2026
REACT_APP_API_BASE_URL=http://localhost:5002/api/v1
REACT_APP_GOOGLE_MAPS_API_KEY=...
```

---

## Quick Start

### 1. Backend Setup
```bash
cd backend
npm install
npm run seed    # Create local SQLite with sample data
npm start       # Runs on http://localhost:5002
```

### 2. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm start       # Runs on http://localhost:2026
```

### 3. Test Accounts (after seed)
```
Admin:    admin@snfalyze.com / password123
Analyst:  michael@snfalyze.com / password123
```

---

## Data Flow

### Market Analysis Flow
```
User selects state or searches city
        ↓
Frontend calls /api/v1/markets/map + /metrics
        ↓
Backend queries snf_facilities + demographics
        ↓
Returns facility list + market metrics
        ↓
Frontend renders map markers + provider table
```

### Facility Research Flow
```
User clicks facility in map/table
        ↓
Frontend navigates to /facility-metrics/:ccn
        ↓
Backend queries snf_facilities + health_citations
        ↓
Returns facility detail + quality + survey history
        ↓
Frontend renders FacilityProfile page
```

### Watchlist Flow
```
User clicks "Save" on facility/operator
        ↓
Frontend calls POST /api/v1/saved-items
        ↓
Backend creates user_saved_items record
        ↓
Item appears in SavedItems page
```

---

## Key Documentation

### Market Data & TAM Methodology
Located in `backend/docs/`:

| Document | Purpose | When to Reference |
|----------|---------|-------------------|
| **TAM_METHODOLOGY.md** | TAM calculation formulas, per-day rates, projections | Building financial models, market sizing |
| **COST_REPORT_CALIBRATION.md** | MA penetration multipliers (1.107-1.181x), Cost Report vs GV relationship | Converting FFS estimates to total Medicare |
| **MARKET_SCORING_DATA_DICTIONARY.md** | All columns in `market_metrics` and `market_grades` tables | Building market analytics features |
| **MARKET_GRADING_METHODOLOGY.md** | How A-F grades are calculated | Understanding market scores |

### CMS Data Dictionaries
Located in `backend/docs/cms_data_dictionaries/`:
- Official CMS data dictionaries for SNF, HHA, Hospice, Physician, Geographic Variation
- `README.md` maps each PDF to database tables
- Reference when working with raw CMS data fields

### Critical Business Logic (Don't Forget!)
1. **Cost Report vs GV**: GV = FFS only (~47%), Cost Reports = FFS + MA (total Medicare)
2. **Calibration Multipliers**: Low MA: 1.107x, Medium: 1.153x, High: 1.181x
3. **377 CBSAs** have validated Cost Report data, **923 CBSAs** have GV rates

---

## Related Projects

- **SNFalyze** (`/Users/nikolashulewsky/Projects/snfalyze`) - M&A deal analysis platform (parent project)
- **Cascadia Contract Management** - Contract management system
- **SNF News Aggregator** - Industry news aggregation

---

## Development Notes

1. **No deals functionality** - This platform does NOT have deal creation, document upload, or financial extraction. Those features are in SNFalyze.

2. **Read-only data** - Market data comes from external CMS sources; users can only add comments/notes, not edit facility data.

3. **Google Maps required** - MarketAnalysis page requires valid Google Maps API key.

4. **Production databases** - Three PostgreSQL databases on Render:
   - snfalyze_db (app data)
   - snf_market_data (market reference data)
   - snf_platform (CMS survey data)

5. **React 19** - Uses latest React with some legacy peer dependencies in frontend packages.








## Key Files (Auto-Updated)

> This section is automatically updated on each commit.

### Backend Routes
```
backend/routes/apiUsers.js
backend/routes/auth.js
backend/routes/authentication.js
backend/routes/contracts.js
backend/routes/customReports.js
backend/routes/database.js
backend/routes/dueDiligence.js
backend/routes/facilities.js
backend/routes/facilityRisk.js
backend/routes/hh-market.js
backend/routes/hha-ma-analytics.js
backend/routes/index.js
backend/routes/ma-analytics.js
backend/routes/market.js
backend/routes/markets.js
backend/routes/ownership.js
backend/routes/pennant.js
backend/routes/savedItems.js
backend/routes/stateRouter.js
backend/routes/survey.js
backend/routes/surveyIntelligence.js
backend/routes/taxonomy.js
backend/routes/user.js
backend/routes/users.js
backend/routes/wages.js
backend/routes/watchlist.js
```

### Backend Services
```
backend/services/aiExtractor.js
backend/services/censusDataRefreshService.js
backend/services/changeLogService.js
backend/services/cimExtractor.js
backend/services/cmsDataRefreshService.js
backend/services/extractionMerger.js
backend/services/extractionOrchestrator.js
backend/services/extractionPrompts.js
backend/services/extractionReconciler.js
backend/services/extractionValidator.js
backend/services/facilityMatcher.js
backend/services/fileStorage.js
backend/services/hospiceMarketScoringService.js
backend/services/marketService.js
backend/services/migrationRunner.js
backend/services/normalizationService.js
backend/services/notificationService.js
backend/services/parallelExtractor.js
backend/services/pennantClusterService.js
backend/services/periodAnalyzer.js
backend/services/periodAnalyzer.test.js
backend/services/proformaService.js
backend/services/ratioCalculator.js
backend/services/reportQueryEngine.js
```

### Backend Controllers
```
backend/controller/AuthenticationController.js
backend/controller/MarketController.js
backend/controller/stateController.js
backend/controller/SurveyIntelligenceController.js
backend/controller/WatchlistController.js
```

### Frontend Pages
```
frontend/src/pages/AcceptInvite.jsx
frontend/src/pages/AgencyProfile.jsx
frontend/src/pages/AIAssistant.jsx
frontend/src/pages/ChatInterfaceAI.jsx
frontend/src/pages/CreateUser.jsx
frontend/src/pages/CustomReportBuilder.jsx
frontend/src/pages/Dashboard.jsx
frontend/src/pages/DatabaseExplorer.jsx
frontend/src/pages/EditUser.jsx
frontend/src/pages/FacilityMetrics.jsx
frontend/src/pages/FacilityProfile.jsx
frontend/src/pages/HomeHealth.jsx
frontend/src/pages/HomeHealthAgency.jsx
frontend/src/pages/LocationTest.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/MAIntelligence.jsx
frontend/src/pages/MarketAnalysis.jsx
frontend/src/pages/OperatorProfile.jsx
frontend/src/pages/OwnershipProfile.jsx
frontend/src/pages/OwnershipResearch.jsx
frontend/src/pages/PennantDashboard.jsx
frontend/src/pages/Profile.jsx
frontend/src/pages/renderStep1.jsx
frontend/src/pages/renderStep2.jsx
frontend/src/pages/renderStep3.jsx
frontend/src/pages/renderStep4.jsx
frontend/src/pages/SavedItems.jsx
frontend/src/pages/Signup.jsx
frontend/src/pages/SurveyAnalytics.jsx
frontend/src/pages/UserManagement.jsx
No pages found
```

### Frontend Components (Top Level)
```
AppHelpPanel
common
CustomReportBuilder
DataDictionaryTab
FacilityCommentsSection
FacilityMetrics
MAIntelligence
MarketAnalysis
MarketCommentsSection
MarketDynamicsTab
MarketGrading
MarketScorecard
NotificationCenter
OwnershipResearch
PartnershipOpportunity
RegulatoryRiskCard
ui
```

### Database Models
```
benchmark_configurations
cascadia_facility
comment_mentions
custom_reports
extraction_history
facility_change_logs
facility_comment_mentions
facility_comments
index
init-models
market_comment_mentions
market_comments
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
watchlist_item
watchlist
```

### Recent Migrations
```
backend/migrations/20251229-add-multi-segment-ownership-profiles.js
backend/migrations/20251229-create-ownership-hierarchy-tables.js
backend/migrations/20250101-create-watchlist-tables.js
backend/migrations/20250101-drop-deal-tables.js
backend/migrations/add-cms-staffing-columns.js
backend/migrations/20241218-create-vbp-rankings-table.js
backend/migrations/create-snf-vbp-performance.js
backend/migrations/add-market-comments-tables.js
backend/migrations/add-facility-comments-tables.js
backend/migrations/add-user-approval-columns.js
```

---
```

---

## PROJECT_STATUS.md

```markdown
# PostAcutePulse - Project Status

**Last Updated:** January 07, 2026
**Project:** Market Intelligence Platform (PostAcutePulse)
**Repository:** pac-advocate

---

## 📅 Recent Changes (Auto-Generated)

> This section is automatically updated on each commit.

### Last 7 Days

- **2026-01-07** - Add CMS data dictionaries and TAM calibration documentation
- **2026-01-05** - Add hospice scoring service and comprehensive market grading updates

### Areas Modified (Last 20 Commits)

```
Backend:     110 files
Frontend:    160 files
Routes:      10 files
Services:    12 files
Components:  93 files
Migrations:  19 files
```

### New Files Added (Last 20 Commits)

```
CLAUDE_ONBOARDING_pac-advocate.md
CLAUDE_ONBOARDING_postacutepulse.md
backend/.claude/BACKLOG.md
backend/DATABASE_MIGRATIONS.md
backend/controller/MarketController.js
backend/controller/WatchlistController.js
backend/docs/COST_REPORT_CALIBRATION.md
backend/docs/MARKET_GRADING_METHODOLOGY.md
backend/docs/MARKET_SCORING_DATA_DICTIONARY.md
backend/docs/TAM_METHODOLOGY.md
backend/docs/cms_data_dictionaries/2014-2023 Medicare FFS Geographic Variation by National_State_County Data Dictionary_0.pdf
backend/docs/cms_data_dictionaries/HHS_Data_Dictionary.pdf
backend/docs/cms_data_dictionaries/HOSPICE_Data_Dictionary.pdf
backend/docs/cms_data_dictionaries/MUP_PHY_RY21_20211021_DD_Geo (1).pdf
backend/docs/cms_data_dictionaries/MUP_PHY_RY25_20250312_DD_PRV_SVC_508.pdf
```

---


## 📊 Executive Summary

### What PostAcutePulse Does
A market intelligence platform for the post-acute care sector that provides:
1. **Market Analysis** - Interactive map-based exploration of SNF/ALF/HHA markets
2. **Facility Research** - Deep-dive profiles for skilled nursing facilities
3. **Ownership Intelligence** - Operator portfolio and M&A history analysis
4. **Survey Analytics** - CMS deficiency trends, risk forecasting, bellwether signals
5. **Watchlist Management** - Save and track facilities/operators of interest

### Current Status
- **Core Platform:** ✅ Fully functional
- **Market Analysis:** ✅ Complete with state/city views
- **Facility Profiles:** ✅ Complete with quality metrics
- **Ownership Research:** ✅ Complete with portfolio analysis
- **Survey Analytics:** ✅ Complete with forecasting
- **Home Health Module:** ✅ Complete
- **Watchlist/Saved Items:** ✅ Complete

---

## 🎯 Key Features

### Market Analysis Page
- State-level and city-level market views
- Interactive Google Maps with facility markers
- Provider filtering (SNF, HHA, ALF)
- Market metrics (demographics, competition, labor)
- Sortable provider table with ratings and beds

### Facility Profile Page
- CMS 5-star quality ratings
- Staffing metrics and trends
- Survey deficiency history
- Ownership information
- Geographic context

### Ownership Profile Page
- Portfolio composition (facilities owned)
- Geographic footprint visualization
- Quality metrics across portfolio
- M&A transaction history
- Contact information management

### Survey Analytics Page
- National/state/county deficiency trends
- Top F-tag analysis
- Seasonal and day-of-week patterns
- Facility risk forecasting
- Bellwether facility identification

---

## 🔗 Related Projects

| Project | Purpose | Port |
|---------|---------|------|
| **SNFalyze** | M&A Deal Analysis | 5001/3000 |
| **PostAcutePulse** (this) | Market Intelligence | 5002/2026 |
| **Cascadia Contract Management** | Contract Management | - |
| **SNF News Aggregator** | Industry News | - |

---

## 📁 Key Files

### Backend
- `app_snfalyze.js` - Express server entry point
- `routes/market.js` - Market analysis API
- `routes/ownership.js` - Ownership research API
- `routes/surveyIntelligence.js` - Survey analytics API
- `routes/facilities.js` - Facility search API
- `services/marketService.js` - Core market analytics

### Frontend
- `pages/MarketAnalysis.jsx` - Map-based market explorer
- `pages/FacilityProfile.jsx` - Facility detail view
- `pages/OwnershipProfile.jsx` - Operator profile
- `pages/SurveyAnalytics.jsx` - Survey deficiency dashboard
- `pages/SavedItems.jsx` - Watchlist management

---

## 🗄️ Databases

### Production (Render PostgreSQL)
1. **snfalyze_db** - Application data (users, watchlists, comments)
2. **snf_market_data** - Market reference data (ownership, demographics)
3. **snf_platform** - CMS survey data (citations, facilities)

### Local Development
- SQLite (`database.sqlite`) - Mirrors production schema

---

## 📝 Development Notes

1. This is a **market intelligence** platform, NOT a deal analysis tool
2. No document upload or AI extraction features (those are in SNFalyze)
3. Google Maps API key required for MarketAnalysis page
4. React 19 with some legacy peer dependencies
5. Runs on ports 5002 (backend) and 2026 (frontend)
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
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
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
    "d3-geo": "^3.1.1",
    "d3-scale": "^4.0.2",
    "date-fns": "^4.1.0",
    "jspdf": "^3.0.4",
    "jspdf-autotable": "^5.0.2",
    "lucide-react": "^0.525.0",
    "mammoth": "^1.11.0",
    "posthog-js": "^1.309.1",
    "prop-types": "^15.8.1",
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
    "topojson-client": "^3.1.0",
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

## TAM_METHODOLOGY.md

```markdown
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
```

---

## COST_REPORT_CALIBRATION.md

```markdown
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
backend/routes/customReports.js
backend/routes/database.js
backend/routes/dueDiligence.js
backend/routes/facilities.js
backend/routes/facilityRisk.js
backend/routes/hh-market.js
backend/routes/hha-ma-analytics.js
backend/routes/index.js
backend/routes/ma-analytics.js
backend/routes/market.js
backend/routes/markets.js
backend/routes/ownership.js
backend/routes/pennant.js
backend/routes/savedItems.js
backend/routes/stateRouter.js
backend/routes/survey.js
backend/routes/surveyIntelligence.js
backend/routes/taxonomy.js
backend/routes/user.js
backend/routes/users.js
backend/routes/wages.js
backend/routes/watchlist.js

Backend Services:
backend/services/aiExtractor.js
backend/services/censusDataRefreshService.js
backend/services/changeLogService.js
backend/services/cimExtractor.js
backend/services/cmsDataRefreshService.js
backend/services/extractionMerger.js
backend/services/extractionOrchestrator.js
backend/services/extractionPrompts.js
backend/services/extractionReconciler.js
backend/services/extractionValidator.js
backend/services/facilityMatcher.js
backend/services/fileStorage.js
backend/services/hospiceMarketScoringService.js
backend/services/marketService.js
backend/services/migrationRunner.js
backend/services/normalizationService.js
backend/services/notificationService.js
backend/services/parallelExtractor.js
backend/services/pennantClusterService.js
backend/services/periodAnalyzer.js
backend/services/periodAnalyzer.test.js
backend/services/proformaService.js
backend/services/ratioCalculator.js
backend/services/reportQueryEngine.js

Frontend Pages:
frontend/src/pages/AcceptInvite.jsx
frontend/src/pages/AgencyProfile.jsx
frontend/src/pages/AIAssistant.jsx
frontend/src/pages/ChatInterfaceAI.jsx
frontend/src/pages/CreateUser.jsx
frontend/src/pages/CustomReportBuilder.jsx
frontend/src/pages/Dashboard.jsx
frontend/src/pages/DatabaseExplorer.jsx
frontend/src/pages/EditUser.jsx
frontend/src/pages/FacilityMetrics.jsx
frontend/src/pages/FacilityProfile.jsx
frontend/src/pages/HomeHealth.jsx
frontend/src/pages/HomeHealthAgency.jsx
frontend/src/pages/LocationTest.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/MAIntelligence.jsx
frontend/src/pages/MarketAnalysis.jsx
frontend/src/pages/OperatorProfile.jsx
frontend/src/pages/OwnershipProfile.jsx
frontend/src/pages/OwnershipResearch.jsx
frontend/src/pages/PennantDashboard.jsx
frontend/src/pages/Profile.jsx
frontend/src/pages/renderStep1.jsx
frontend/src/pages/renderStep2.jsx
frontend/src/pages/renderStep3.jsx
frontend/src/pages/renderStep4.jsx
frontend/src/pages/SavedItems.jsx
frontend/src/pages/Signup.jsx
frontend/src/pages/SurveyAnalytics.jsx
frontend/src/pages/UserManagement.jsx
```

