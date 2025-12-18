# Database Scripts

This folder contains scripts for managing the snfalyze databases.

## Why Two Databases?

We maintain two separate databases for different purposes:

### Main DB (`snfalyze_db`)
- **Purpose:** Application-specific data for snfalyze
- **Contains:** User accounts, deals, documents, comments, historical snapshots
- **Access:** Only snfalyze application

### Market DB (`snf_market_data`)
- **Purpose:** Shared reference data across multiple projects
- **Contains:** Facility listings, demographics, deficiencies - data that doesn't change per-user
- **Access:** Multiple applications (snfalyze, future tools, analytics projects)

### Why not just one database?

1. **Shared data across projects** - Other tools/projects can connect to the market DB without accessing snfalyze's private user data, deals, or documents.

2. **Separation of concerns** - Market data (public CMS data) is kept separate from application data (user-generated content).

3. **Independent scaling** - Market DB can be optimized for read-heavy analytics queries; Main DB for transactional app operations.

4. **Data governance** - Easier to manage who has access to what. Market data is "public" CMS data; app data contains private business information.

### Why does Main DB also have market data?

The Main DB contains a **superset** of the Market DB data because:
- Faster queries (no cross-database joins)
- Historical snapshots link to facility data
- Single source of truth for the app
- Market DB is synced FROM Main DB (not the other way around)

**Think of it as:** Main DB is the "master" for snfalyze. Market DB is a "published copy" of just the shared tables for other projects to use.

## Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN DB (snfalyze_db)                        │
│                                                                 │
│  App-specific data:                                             │
│  - users, deals, documents, comments                            │
│  - facility_snapshots (925K+ historical records)                │
│  - vbp_scores, extraction_history                               │
│                                                                 │
│  + All market data (superset of market DB)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ sync-to-market-db.js
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 MARKET DB (snf_market_data)                     │
│                                                                 │
│  Shared across multiple projects:                               │
│  - snf_facilities (14,750 nursing homes)                        │
│  - alf_facilities (44,600 assisted living)                      │
│  - cms_facility_deficiencies (340K deficiencies)                │
│  - county_demographics, state_demographics                      │
│  - ownership_profiles, cbsas, wage indexes                      │
└─────────────────────────────────────────────────────────────────┘
```

## Connection Strings (Render Production)

| Database | Environment Variable | Purpose |
|----------|---------------------|---------|
| Main | `DATABASE_URL` | App data + all market data |
| Market | `MARKET_DATABASE_URL` | Shared market data only |

## Scripts

### sync-to-market-db.js

Syncs the 10 market tables from Main DB to Market DB.

```bash
# Preview changes (no modifications)
npm run db:sync:market:dry

# Sync all tables
npm run db:sync:market

# Sync specific table
node scripts/sync-to-market-db.js --table=snf_facilities
```

**When to run:**
- After CMS data refresh
- After schema changes to market tables
- Monthly maintenance

**Tables synced:**
1. `state_demographics`
2. `county_demographics`
3. `cbsas`
4. `county_cbsa_crosswalk`
5. `bls_state_wages`
6. `cms_wage_index`
7. `ownership_profiles`
8. `snf_facilities`
9. `alf_facilities`
10. `cms_facility_deficiencies`

---

### sync-snapshots-to-render.js

Syncs historical `facility_snapshots` from local to Render production.

```bash
node scripts/sync-snapshots-to-render.js
```

**When to run:**
- After importing new historical CMS data locally
- One-time bulk migrations

---

### migrate-cms-schema-production.js

Creates CMS-related tables on production (schema only, no data).

```bash
npm run db:migrate:cms
```

**Tables created:**
- cms_extracts, vbp_scores, mds_quality_measures
- covid_vaccination, survey_dates, ownership_records
- penalty_records, health_citations, fire_safety_citations
- claims_quality_measures, state_national_averages, etc.

---

### import-cms-to-production.js

Imports CMS data from local CSV files to production.

```bash
npm run db:import:cms
```

---

## Data Update Workflow

### When CMS Releases New Data

```
1. Download new CMS data files locally
           │
           ▼
2. Import to LOCAL database
   node scripts/import-cms-historical.js
           │
           ▼
3. Sync facility_snapshots to MAIN DB (Render)
   node scripts/sync-snapshots-to-render.js
           │
           ▼
4. Sync market tables to MARKET DB
   npm run db:sync:market
           │
           ▼
5. Verify on production
   - Check Facility Metrics trends
   - Check Market Analysis page
```

### Quick Reference

| Task | Command |
|------|---------|
| Sync market tables | `npm run db:sync:market` |
| Preview market sync | `npm run db:sync:market:dry` |
| Sync snapshots to Render | `node scripts/sync-snapshots-to-render.js` |
| Create CMS tables | `npm run db:migrate:cms` |
| Import CMS data | `npm run db:import:cms` |

## Troubleshooting

### "Column does not exist" errors on Market Analysis

The market DB schema is out of sync. Run:
```bash
npm run db:sync:market
```

### Missing historical data on Trends tab

Facility snapshots need syncing. Run:
```bash
node scripts/sync-snapshots-to-render.js
```

### Connection errors

Check Render environment variables:
- `DATABASE_URL` - points to snfalyze_db
- `MARKET_DATABASE_URL` - points to snf_market_data

Both should have `?sslmode=require` for Render connections.
