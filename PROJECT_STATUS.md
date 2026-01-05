# PostAcutePulse - Project Status

**Last Updated:** January 05, 2026
**Project:** Market Intelligence Platform (PostAcutePulse)
**Repository:** pac-advocate

---

## 📅 Recent Changes (Auto-Generated)

> This section is automatically updated on each commit.

### Last 7 Days

- **2025-12-30** - Add CMS quality measures ingestion scripts
- **2025-12-30** - Fix column name in rebuild-market-metrics.js
- **2025-12-30** - Add market scoring scripts and methodology documentation
- **2025-12-29** - Remove outdated SNFalyze docs after PostAcutePulse rebrand
- **2025-12-29** - Add multi-segment ownership profiles (SNF + ALF + HHA)

### Areas Modified (Last 20 Commits)

```
Backend:     99 files
Frontend:    162 files
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
backend/docs/MARKET_GRADING_METHODOLOGY.md
backend/docs/MARKET_SCORING_DATA_DICTIONARY.md
backend/migrations/20250101-create-watchlist-tables.js
backend/migrations/20250101-drop-deal-tables.js
backend/migrations/20251229-add-multi-segment-ownership-profiles.js
backend/migrations/20251229-create-ownership-hierarchy-tables.js
backend/migrations/add-custom-reports-table.js
backend/models/custom_reports.js
backend/models/watchlist.js
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
