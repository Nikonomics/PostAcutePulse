# pac-advocate - Claude Code Onboarding Bundle

> **Auto-generated** - Do not edit manually
> Last updated: 2025-12-31 09:42:36
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
backend/services/marketService.js
backend/services/migrationRunner.js
backend/services/normalizationService.js
backend/services/notificationService.js
backend/services/parallelExtractor.js
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

**Last Updated:** December 30, 2025
**Project:** Market Intelligence Platform (PostAcutePulse)
**Repository:** pac-advocate

---

## 📅 Recent Changes (Auto-Generated)

> This section is automatically updated on each commit.

### Last 7 Days

- **2025-12-30** - Fix column name in rebuild-market-metrics.js
- **2025-12-30** - Add market scoring scripts and methodology documentation
- **2025-12-29** - Remove outdated SNFalyze docs after PostAcutePulse rebrand
- **2025-12-29** - Add multi-segment ownership profiles (SNF + ALF + HHA)
- **2025-12-29** - Add HHA M&A Analytics API and extraction architecture planning
- **2025-12-28** - Fix provider metadata lookup from ownership analysis
- **2025-12-28** - Add state metrics, SPA routing, and View Profile navigation
- **2025-12-28** - Transform SNFalyze into PostAcutePulse market analysis platform
- **2025-12-25** - Fix CMS citation collectors to handle API limits and extract constraints
- **2025-12-25** - Add fire safety and health citations collectors with API endpoints

### Areas Modified (Last 20 Commits)

```
Backend:     92 files
Frontend:    109 files
Routes:      8 files
Services:    10 files
Components:  52 files
Migrations:  19 files
```

### New Files Added (Last 20 Commits)

```
CLAUDE_ONBOARDING_postacutepulse.md
backend/DATABASE_MIGRATIONS.md
backend/controller/MarketController.js
backend/controller/WatchlistController.js
backend/docs/MARKET_GRADING_METHODOLOGY.md
backend/docs/MARKET_SCORING_DATA_DICTIONARY.md
backend/migrations/20250101-create-watchlist-tables.js
backend/migrations/20250101-drop-deal-tables.js
backend/migrations/20251229-add-multi-segment-ownership-profiles.js
backend/migrations/20251229-create-ownership-hierarchy-tables.js
backend/migrations/add-custom-reports-table.js
backend/models/custom_reports.js
backend/models/watchlist.js
backend/models/watchlist_item.js
backend/routes/customReports.js
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

## backend/package.json

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

## frontend/package.json

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

## Project Structure

```
total 21352
drwxr-xr-x  19 nikolashulewsky  staff       608 Dec 31 09:42 .
drwxr-xr-x  11 nikolashulewsky  staff       352 Dec 29 10:37 ..
-rw-r--r--@  1 nikolashulewsky  staff      8196 Dec 29 12:43 .DS_Store
drwxr-xr-x  14 nikolashulewsky  staff       448 Dec 30 19:19 .git
-rw-------   1 nikolashulewsky  staff       518 Dec 28 20:32 .gitignore
drwxr-xr-x  49 nikolashulewsky  staff      1568 Dec 29 10:14 backend
-rw-r--r--   1 nikolashulewsky  staff     37423 Dec 31 09:42 CLAUDE_ONBOARDING_pac-advocate.md
-rw-r--r--   1 nikolashulewsky  staff     40399 Dec 30 19:19 CLAUDE_ONBOARDING_postacutepulse.md
-rw-r--r--   1 nikolashulewsky  staff  10754918 Dec 28 08:56 codebase_dump.txt
-rwx--x--x   1 nikolashulewsky  staff      1684 Dec 28 08:47 copy-market-tables.sh
drwx------   7 nikolashulewsky  staff       224 Dec 29 10:13 docs
drwxr-xr-x  15 nikolashulewsky  staff       480 Dec 28 20:01 frontend
-rw-------   1 nikolashulewsky  staff      4661 Dec 28 08:48 move-views-to-snf-news-schema.sql
-rw-r--r--   1 nikolashulewsky  wheel     18613 Dec 30 19:19 PROJECT_CONTEXT.md
-rw-r--r--   1 nikolashulewsky  wheel      5297 Dec 30 19:19 PROJECT_STATUS.md
-rw-------   1 nikolashulewsky  staff      9262 Dec 28 13:09 README.md
-rw-------   1 nikolashulewsky  staff      1962 Dec 28 08:48 reorganize-schemas.sql
drwx------   5 nikolashulewsky  staff       160 Dec 29 12:40 scripts
-rw-------   1 nikolashulewsky  staff     19187 Dec 28 08:48 TECHNICAL_DEBT.md

backend/:
alf_facilities.db
app_snfalyze.js
bellwether_validation.js
bin
check_extraction.js
config
controller
create-tables-and-migrate.js
DATABASE_ARCHITECTURE.md
DATABASE_MIGRATIONS.md
database.sqlite
database.sqlite3
db_snfalyze.sqlite
docs
fix-boolean-columns.sql
logs
migrate-to-postgres.js
migrations
models
node_modules

frontend/:
build
cascadia-contract-management-web
node_modules
package-lock.json
package.json
public
src
tsconfig.json

```
