# SNFalyze Database Architecture

SNFalyze uses **two separate PostgreSQL databases** in production. This document explains which database to use when adding new features or tables.

---

## Overview

| Database | Env Variable | Render Name | Purpose |
|----------|--------------|-------------|---------|
| **App Database** | `DATABASE_URL` | `snfalyze_db` | User-generated data, authentication, deals |
| **Market Database** | `MARKET_DATABASE_URL` | `snf_market_data` | CMS data, facilities, ownership, M&A |

---

## App Database (`DATABASE_URL`)

**Purpose:** Stores all user-generated and application-specific data.

**Access Method:**
```javascript
const { getSequelizeInstance } = require('../config/database');
const sequelize = getSequelizeInstance();
```

**Tables include:**
- `users` - User accounts and authentication
- `deals` - Deal records created by users
- `deal_facilities` - Facilities linked to deals
- `documents` - Uploaded documents
- `extraction_history` - Document extraction records
- `saved_items` - User's bookmarked items
- `notifications` - User notifications
- `benchmarks` - Deal benchmarks
- `pro_forma` - Pro forma projections
- `expense_ratios` - Expense ratio data

**When to use:**
- User authentication/profiles
- Deal management
- Document uploads/extraction
- User preferences and saved items
- Any feature where data is created by users

---

## Market Database (`MARKET_DATABASE_URL`)

**Purpose:** Stores CMS data, facility information, and market intelligence data.

**Access Method:**
```javascript
const { getMarketPool } = require('../config/database');
const pool = getMarketPool();
const result = await pool.query('SELECT * FROM ...');
```

**Tables include:**
- `snf_facilities` - CMS facility data (15,000+ SNFs)
- `alf_facilities` - Assisted living facilities
- `ownership_profiles` - Ownership organization profiles
- `ownership_contacts` - Contacts for ownership orgs
- `ownership_comments` - Comments on ownership profiles
- `ownership_change_logs` - Audit trail for ownership edits
- `ma_transactions` - M&A transaction records
- `vbp_scores` - Value-Based Purchasing scores
- `facility_vbp_rankings` - VBP rankings by facility
- `cms_*` - Various CMS data tables
- `state_benchmarks` - State-level benchmarks
- `demographic_data` - Market demographics

**When to use:**
- CMS/government data
- Facility lookups and research
- Ownership information
- M&A intelligence
- Market analysis
- Any data that comes from external sources (CMS, etc.)

---

## Decision Guide

Ask yourself: **"Where does this data come from?"**

```
┌─────────────────────────────────────────────────────────┐
│                  Is this data...                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Created by users in the app?                          │
│   (deals, uploads, preferences, notes)                  │
│                         │                               │
│                         ▼                               │
│                   ┌─────────┐                           │
│                   │   YES   │ ──▶ DATABASE_URL          │
│                   └─────────┘     (App Database)        │
│                         │                               │
│                         ▼                               │
│                   ┌─────────┐                           │
│                   │   NO    │                           │
│                   └─────────┘                           │
│                         │                               │
│                         ▼                               │
│   From external sources? (CMS, market data, etc.)       │
│                         │                               │
│                         ▼                               │
│                   ┌─────────┐                           │
│                   │   YES   │ ──▶ MARKET_DATABASE_URL   │
│                   └─────────┘     (Market Database)     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Special Cases

### Ownership Comments/Contacts
Even though users create comments and contacts, they are **extensions of ownership_profiles** which is CMS data. Therefore, they belong in the **Market Database**.

### Saved Items
When a user saves a facility, the `saved_items` record goes in the **App Database** (it's user data), but it references a facility in the **Market Database**.

### Deal Facilities
When a deal is linked to a CMS facility:
- The `deal_facilities` junction table is in the **App Database**
- It references `snf_facilities` in the **Market Database** via CCN

---

## Local Development

Locally, both environment variables can point to the same database or different ones:

```bash
# Option 1: Single local database (simpler)
DATABASE_URL=postgresql://localhost:5432/snfalyze_local
MARKET_DATABASE_URL=postgresql://localhost:5432/snfalyze_local

# Option 2: Separate databases (mirrors production)
DATABASE_URL=postgresql://localhost:5432/snfalyze_app
MARKET_DATABASE_URL=postgresql://localhost:5432/snf_market_data
```

---

## Adding New Tables Checklist

Before creating a new table:

1. [ ] Determine which database it belongs to (see Decision Guide above)
2. [ ] Create migration in `backend/migrations/` or `backend/server/migrations/`
3. [ ] Add comment in migration indicating which database: `-- Database: MARKET_DATABASE_URL`
4. [ ] Run migration on correct database
5. [ ] Update this document's table list if adding a major new table
6. [ ] In routes, use correct pool: `getMarketPool()` or `getSequelizeInstance()`

---

## Common Mistakes

❌ **Wrong:** Assuming all tables are in `DATABASE_URL`
✅ **Right:** Check which pool the route file uses

❌ **Wrong:** Running migrations against `DATABASE_URL` for market tables
✅ **Right:** Use `MARKET_DATABASE_URL` for ownership/facility/CMS tables

❌ **Wrong:** Using Sequelize ORM for market database queries
✅ **Right:** Use `getMarketPool()` which returns a pg Pool instance
