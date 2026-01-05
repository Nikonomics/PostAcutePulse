# Pennant Intelligence Dashboard - Handoff Document

## Overview

The **Pennant Intelligence** dashboard provides strategic analytics for The Pennant Group's portfolio across ALF (Assisted Living Facilities), HHA (Home Health Agencies), and Hospice segments. It includes geographic clustering analysis and hospice market scoring to identify partnership and expansion opportunities.

**Route:** `/pennant-dashboard`

---

## The 5 Tabs

| Tab | ID | Purpose |
|-----|-----|---------|
| **Overview** | `overview` | High-level portfolio summary with KPIs, segment breakdown, and lists |
| **Ecosystem Map** | `map` | Interactive Google Map showing all Pennant locations with layer filters |
| **Coverage Analysis** | `coverage` | State and CBSA-level coverage breakdown showing segment overlap |
| **Cluster Analysis** | `clusters` | Geographic clustering of locations with SNF proximity for partnership opportunities |
| **Market Scoring** | `scoring` | Hospice market opportunity scores with demand, competition, and fit metrics |

---

## File Locations

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/pages/PennantDashboard.jsx` | Main dashboard component (~2000+ lines, inline styles) |
| `frontend/src/api/pennantService.js` | API service with all endpoint functions |

### Backend
| File | Purpose |
|------|---------|
| `backend/routes/pennant.js` | All API endpoints (~1600 lines) |
| `backend/services/pennantClusterService.js` | Cluster analysis logic |
| `backend/services/hospiceMarketScoringService.js` | Market scoring calculations |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PennantDashboard.jsx                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Tab Navigation: Overview | Ecosystem Map | Coverage | Clusters | Scoring │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────┬──────────────┬────┴─────────┬────────────┬───────────┐  │
│  │  Overview   │ Ecosystem    │  Coverage    │  Cluster   │  Market   │  │
│  │  Tab        │ Map Tab      │  Analysis    │  Analysis  │  Scoring  │  │
│  │             │              │  Tab         │  Tab       │  Tab      │  │
│  │  - KPIs     │ - Google Map │ - State view │ - Clusters │ - Scores  │  │
│  │  - Lists    │ - Markers    │ - CBSA view  │ - SNF list │ - Grades  │  │
│  │  - Charts   │ - Layers     │ - Overlap    │ - Details  │ - Details │  │
│  └─────────────┴──────────────┴──────────────┴────────────┴───────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tab Details

### 1. Overview Tab

**Data Source:** `GET /api/v1/pennant/overview`

**Displays:**
- Portfolio KPIs (total locations, states, segments)
- ALF Summary (facility count, total capacity)
- HHA Summary (agency count, avg star rating, total episodes)
- Hospice Summary (agency count, states)
- Lists of ALF facilities, HHA agencies, Hospice agencies

**Key State Variables:**
- `overviewData` - Main overview response
- `alfData` - ALF facilities list
- `hhaAgenciesData` - HHA agencies list
- `hospiceAgenciesData` - Hospice agencies list

---

### 2. Ecosystem Map Tab

**Data Source:** `GET /api/v1/pennant/locations/geojson`

**Features:**
- Google Map with markers for all Pennant locations
- Layer toggles: ALF (blue), HHA (green), Hospice (pink)
- Click markers for info windows with details
- State filter dropdown

**Key State Variables:**
- `geoJsonData` - GeoJSON FeatureCollection
- `selectedMarker` - Currently clicked marker
- `layerVisibility` - `{ alf: true, hha: true, hospice: true }`
- `mapStateFilter` - Selected state filter

**Marker Colors:**
- ALF: `#3b82f6` (blue)
- HHA: `#22c55e` (green)
- Hospice: `#ec4899` (pink)

---

### 3. Coverage Analysis Tab

**Data Sources:**
- `GET /api/v1/pennant/coverage-by-state`
- `GET /api/v1/pennant/coverage-by-cbsa`

**Features:**
- Toggle between State and CBSA views
- Shows segment presence per geography
- Overlap indicators (has ALF + HHA + Hospice)
- Summary stats at top

**Key State Variables:**
- `coverageData` - State-level coverage
- `cbsaCoverageData` - CBSA-level coverage
- `coverageView` - `'state'` or `'cbsa'`

**Response Fields per Geography:**
- `alf_count`, `alf_capacity`
- `hha_count`, `hha_episodes`
- `hospice_count`
- `has_alf`, `has_hha`, `has_hospice`
- `has_all_segments`

---

### 4. Cluster Analysis Tab

**Data Sources:**
- `GET /api/v1/pennant/clusters?radius={miles}`
- `GET /api/v1/pennant/clusters/:clusterId`
- `GET /api/v1/pennant/clusters/:clusterId/snfs`

**Features:**
- Groups nearby Pennant locations into clusters
- Shows SNF proximity analysis per cluster
- Identifies Ensign SNF presence (partnership potential)
- Opportunity scoring based on SNF density

**Key State Variables:**
- `clusterData` - All clusters with summary
- `selectedCluster` - Selected cluster ID
- `clusterDetail` - Full detail for selected cluster
- `clusterRadius` - Clustering radius (default 30 miles)
- `showClusterDetail` - Detail panel visibility

**Cluster Object:**
```javascript
{
  cluster_id: 'cluster_1',
  name: 'Los Angeles Area',
  centroid: { lat: 34.05, lng: -118.24 },
  radius_miles: 30,
  locations: [...],       // Pennant locations in cluster
  snf_count: 45,          // SNFs within radius
  ensign_snf_count: 12,   // Ensign SNFs within radius
  total_snf_beds: 4500,
  opportunity_score: 85
}
```

**Opportunity Score Factors:**
- SNF density (count within radius)
- Total SNF beds
- Ensign presence (synergy potential)
- Population demographics

---

### 5. Market Scoring Tab

**Data Sources:**
- `GET /api/v1/pennant/hospice/market-scores?mode={footprint|greenfield}`
- `GET /api/v1/pennant/hospice/market-scores/summary`
- `GET /api/v1/pennant/hospice/market-scores/:geoCode`

**Features:**
- Hospice market opportunity scoring
- Two modes: Footprint (existing presence) vs Greenfield (new markets)
- CBSA or State geography toggle
- Grade distribution (A through F)
- Detailed score breakdown on click

**Key State Variables:**
- `marketScoreData` - All scored markets
- `marketScoreSummary` - Grade distribution stats
- `selectedMarket` - Selected market for detail
- `marketScoreMode` - `'footprint'` or `'greenfield'`
- `marketGeoType` - `'cbsa'` or `'state'`

**Scoring Components (Footprint Mode):**
| Component | Weight | Factors |
|-----------|--------|---------|
| Pennant Synergy | 50% | Existing ALF/HHA/Ensign SNF presence |
| Demand | 30% | Population 85+, growth, SNF beds |
| Market Opportunity | 10% | Competition level, for-profit % |
| Quality Gap | 10% | Avg hospice star rating gaps |

**Scoring Components (Greenfield Mode):**
| Component | Weight | Factors |
|-----------|--------|---------|
| Demand | 40% | Population 85+, growth, SNF/ALF beds |
| Market Opportunity | 40% | Low competition, high for-profit % |
| Quality Gap | 20% | Provider quality gaps |

**Grade Thresholds:**
- A: Score >= 80
- B: Score >= 65
- C: Score >= 50
- D: Score >= 35
- F: Score < 35

---

## API Endpoints Reference

### Overview & Locations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/pennant/overview` | GET | Portfolio summary with all segments |
| `/api/v1/pennant/locations` | GET | All locations (filterable by type, state) |
| `/api/v1/pennant/locations/geojson` | GET | GeoJSON for map rendering |

### Segment-Specific
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/pennant/alf` | GET | ALF facilities with demographics |
| `/api/v1/pennant/alf/:id` | GET | Single ALF facility detail |
| `/api/v1/pennant/hha/agencies` | GET | HHA agencies from CMS data |
| `/api/v1/pennant/hha/agencies/:ccn` | GET | Single HHA agency detail |
| `/api/v1/pennant/hha/subsidiaries` | GET | HHA parent companies |
| `/api/v1/pennant/hospice/agencies` | GET | Hospice agencies |

### Coverage
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/pennant/coverage-by-state` | GET | State-level segment overlap |
| `/api/v1/pennant/coverage-by-cbsa` | GET | CBSA-level segment overlap |

### Cluster Analysis
| Endpoint | Method | Query Params |
|----------|--------|--------------|
| `/api/v1/pennant/clusters` | GET | `radius` (miles, default 30) |
| `/api/v1/pennant/clusters/:clusterId` | GET | `radius` |
| `/api/v1/pennant/clusters/:clusterId/snfs` | GET | `radius`, `sortBy`, `sortDir` |
| `/api/v1/pennant/snf-proximity-summary` | GET | `radius` |

### Market Scoring
| Endpoint | Method | Query Params |
|----------|--------|--------------|
| `/api/v1/pennant/hospice/market-scores` | GET | `mode`, `geoType`, `minPop65`, `limit` |
| `/api/v1/pennant/hospice/market-scores/summary` | GET | `mode`, `geoType` |
| `/api/v1/pennant/hospice/market-scores/:geoCode` | GET | `mode`, `geoType` |

---

## Database Tables Used

### Primary Data Sources
| Table | Purpose |
|-------|---------|
| `alf_facilities` | Pennant ALF locations (WHERE licensee ILIKE '%pennant%') |
| `hh_provider_snapshots` | CMS Home Health data (matched by DBA names) |
| `ownership_profiles` | Parent organization data |
| `ownership_subsidiaries` | HHA subsidiary companies |
| `hospice_owners` | Hospice ownership linkage |
| `hospice_providers` | CMS Hospice provider data |

### Supporting Tables
| Table | Purpose |
|-------|---------|
| `snf_facilities` | SNF data for proximity analysis |
| `cbsas` | CBSA code to name mapping |
| `county_demographics` | Population data |
| `hha_enrollments` | HHA enrollment data for location matching |

---

## Styling

The dashboard uses **inline styles** (not CSS files) with a dark theme:

| Element | Color |
|---------|-------|
| Background | `#0f172a` (slate-900) |
| Card Background | `#1e293b` (slate-800) |
| Border | `#334155` (slate-700) |
| Text Primary | `#f8fafc` (slate-50) |
| Text Secondary | `#94a3b8` (slate-400) |
| Tab Active | `#1e40af` (blue-800) |
| ALF Accent | `#3b82f6` (blue-500) |
| HHA Accent | `#22c55e` (green-500) |
| Hospice Accent | `#ec4899` (pink-500) |

---

## Caching

Both backend services implement in-memory caching:

| Service | Cache TTL | Purpose |
|---------|-----------|---------|
| `pennant.js` routes | 1 hour | Overview, coverage, locations |
| `pennantClusterService.js` | 1 hour | Cluster calculations |
| `hospiceMarketScoringService.js` | 10 minutes | Market scores |

---

## Dependencies

### Frontend
- `react` - Core framework
- `@react-google-maps/api` - Google Maps integration
- `recharts` - Charts (BarChart)
- `lucide-react` - Icons

### Backend
- `express` - Router
- `pg` - PostgreSQL client

---

## Known Limitations / Future Improvements

1. **Inline styles** - Dashboard uses inline styles instead of CSS file. Could be refactored for maintainability.

2. **Large component** - `PennantDashboard.jsx` is ~2000+ lines. Could be split into sub-components per tab.

3. **Hospice location data** - Some hospice agencies lack coordinates (linked via HHA enrollment or hospice_providers fallback).

4. **No real-time updates** - Data refreshes on tab change, not automatically.

5. **Single organization focus** - Currently hardcoded for "THE PENNANT GROUP". Could be parameterized.

6. **Map performance** - Large number of markers on map could benefit from clustering library.

---

## Testing Checklist

- [ ] Overview tab loads KPIs and lists
- [ ] Ecosystem Map shows all three segment markers
- [ ] Map layer toggles work correctly
- [ ] Coverage Analysis toggles between State/CBSA views
- [ ] Cluster Analysis shows clusters with correct SNF counts
- [ ] Cluster detail panel opens with SNF list
- [ ] Cluster radius slider updates results
- [ ] Market Scoring shows grade distribution
- [ ] Footprint/Greenfield mode toggle works
- [ ] Market detail panel shows score breakdown
- [ ] State filter works across all tabs
- [ ] Loading states display correctly
- [ ] Error states display correctly

---

## Contact

For questions about this feature, refer to the original implementation discussion or the development team.
