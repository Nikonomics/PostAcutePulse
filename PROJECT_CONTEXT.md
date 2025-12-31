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
