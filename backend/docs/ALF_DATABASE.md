# ALF Database Integration

This document describes the ALF (Assisted Living Facility) reference database integration for SNFalyze.

## Overview

The ALF database contains **44,625 assisted living facilities** across the United States (2021 data). This data enables:

1. **Auto-population** of missing facility data in deal documents
2. **Facility name matching** to find licensed beds, addresses, coordinates
3. **Geographic search** to find nearby facilities
4. **Market analysis** using demographic data

## Database Schema

### Table: `alf_facilities`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `facility_id` | TEXT | Original facility ID from source |
| `facility_name` | TEXT | Facility name |
| `address` | TEXT | Street address |
| `city` | TEXT | City |
| `state` | TEXT | State (2-letter code) |
| `zip_code` | TEXT | ZIP code |
| `phone_number` | TEXT | Phone number |
| `county` | TEXT | County name |
| `licensee` | TEXT | License holder name |
| `state_facility_type_2` | TEXT | State-specific facility type |
| `state_facility_type_1` | TEXT | State-specific facility type |
| `date_accessed` | TEXT | Date data was accessed |
| `license_number` | TEXT | State license number |
| **`capacity`** | INTEGER | **Licensed bed count** |
| `email_address` | TEXT | Email address |
| `ownership_type` | TEXT | Ownership type |
| **`latitude`** | REAL | **GPS latitude** |
| **`longitude`** | REAL | **GPS longitude** |
| `county_fips` | TEXT | County FIPS code |
| `total_county_al_need` | REAL | Total county AL need |
| `pct_population_over_65` | REAL | % population over 65 |
| `median_age` | REAL | Median age |
| `pct_owner_occupied` | REAL | % owner-occupied housing |
| `pct_renter_occupied` | REAL | % renter-occupied housing |
| `pct_vacant` | REAL | % vacant housing |
| `median_home_value` | REAL | Median home value ($) |
| `avg_household_size` | REAL | Average household size |
| `avg_family_size` | REAL | Average family size |
| `median_household_income` | REAL | Median household income ($) |
| `poverty_rate` | REAL | Poverty rate (%) |
| `unemployment_rate` | REAL | Unemployment rate (%) |
| `pct_population_white` | REAL | % white population |
| `pct_population_black` | REAL | % black population |
| `pct_population_hispanic` | REAL | % hispanic population |
| `created_at` | DATETIME | Record creation timestamp |
| `updated_at` | DATETIME | Record update timestamp |

### Indexes

For optimal query performance, the following indexes are created:

- `idx_alf_facility_name` - Fast facility name lookups
- `idx_alf_city_state` - Fast city + state searches
- `idx_alf_state` - Fast state searches
- `idx_alf_zip` - Fast ZIP code searches
- `idx_alf_coords` - Fast coordinate-based searches

## Data Source

**GitHub Repository**: [antonstengel/assisted-living-data](https://github.com/antonstengel/assisted-living-data)

**CSV File**: `assisted-living-facilities.csv` (2021 data)

## Import Process

### 1. Import the Database

```bash
cd backend
node scripts/import_alf_database.js
```

This script:
- Creates the `alf_facilities` table
- Creates indexes for fast queries
- Imports all 44,625 records from CSV
- Handles malformed rows gracefully
- Reports import statistics

**Expected output**:
```
✅ Import complete!
   Records imported: 44625
   Errors: 24
```

### 2. Verify the Import

```bash
sqlite3 database.sqlite "SELECT COUNT(*) FROM alf_facilities;"
```

Should return: `44625`

## Usage

### Facility Matcher Service

The `facilityMatcher.js` service provides functions for matching and searching facilities.

#### 1. Match Facility by Name

```javascript
const { matchFacility } = require('./services/facilityMatcher');

const match = await matchFacility(
  'American House Keene',  // facility name
  'Keene',                 // city (optional)
  'NH',                    // state (optional)
  0.7                      // min similarity (optional, default 0.7)
);

if (match) {
  console.log(match.facility_name);     // "American House Keene"
  console.log(match.address);           // "197 WATER ST"
  console.log(match.capacity);          // 144
  console.log(match.latitude);          // 42.9298525
  console.log(match.longitude);         // -72.2699189
  console.log(match.match_score);       // 0.95 (95% similarity)
  console.log(match.match_confidence);  // "high"
}
```

**Match Confidence Levels**:
- `high`: 90%+ similarity
- `medium`: 80-89% similarity
- `low`: 70-79% similarity

#### 2. Search Facilities by Criteria

```javascript
const { searchFacilities } = require('./services/facilityMatcher');

const facilities = await searchFacilities({
  name: 'Sunrise',           // partial name match (optional)
  city: 'Phoenix',           // exact city match (optional)
  state: 'AZ',              // exact state match (optional)
  zipCode: '85001',         // exact ZIP match (optional)
  minCapacity: 50,          // minimum beds (optional)
  maxCapacity: 200,         // maximum beds (optional)
  limit: 50                 // max results (optional, default 50)
});

facilities.forEach(f => {
  console.log(`${f.facility_name} - ${f.capacity} beds`);
});
```

#### 3. Find Nearby Facilities

```javascript
const { getFacilitiesNearby } = require('./services/facilityMatcher');

const facilities = await getFacilitiesNearby(
  34.0522,    // latitude
  -118.2437,  // longitude
  25,         // radius in miles (optional, default 25)
  50          // limit (optional, default 50)
);

facilities.forEach(f => {
  console.log(`${f.facility_name} - ${f.distance_miles} miles away`);
});
```

### API Endpoints

#### POST `/api/facilities/match`

Match a facility name against the database.

**Request Body**:
```json
{
  "facilityName": "Sunrise Senior Living",
  "city": "Beverly Hills",
  "state": "CA",
  "minSimilarity": 0.7
}
```

**Response**:
```json
{
  "success": true,
  "match": {
    "facility_name": "Sunrise of Beverly Hills",
    "address": "123 Main St",
    "city": "Beverly Hills",
    "state": "CA",
    "zip_code": "90210",
    "capacity": 120,
    "latitude": 34.0736,
    "longitude": -118.4004,
    "match_score": 0.89,
    "match_confidence": "medium"
  }
}
```

#### POST `/api/facilities/search`

Search facilities by multiple criteria.

**Request Body**:
```json
{
  "name": "Sunrise",
  "state": "CA",
  "minCapacity": 50,
  "limit": 10
}
```

**Response**:
```json
{
  "success": true,
  "count": 10,
  "facilities": [...]
}
```

#### POST `/api/facilities/nearby`

Find facilities within a geographic radius.

**Request Body**:
```json
{
  "latitude": 34.0522,
  "longitude": -118.2437,
  "radiusMiles": 25,
  "limit": 50
}
```

**Response**:
```json
{
  "success": true,
  "count": 50,
  "facilities": [
    {
      "facility_name": "...",
      "distance_miles": "12.34",
      ...
    }
  ]
}
```

#### GET `/api/facilities/stats`

Get database statistics.

**Response**:
```json
{
  "success": true,
  "total_facilities": 44625,
  "facilities_by_state": [
    { "state": "CA", "count": 8042 },
    { "state": "MI", "count": 4591 },
    ...
  ]
}
```

## Testing

Run the test suite to verify functionality:

```bash
cd backend
node scripts/test_facility_matcher.js
```

This tests:
1. Name normalization
2. String similarity calculation
3. Facility matching
4. Multi-criteria search
5. Geographic search

## Name Matching Algorithm

The facility matcher uses **fuzzy string matching** with the Levenshtein distance algorithm:

### 1. Normalization

Facility names are normalized before comparison:

- Convert to lowercase
- Remove legal suffixes (LLC, Inc., Corp, Ltd, etc.)
- Remove facility type keywords (Assisted Living, Memory Care, etc.)
- Remove special characters
- Collapse multiple spaces

**Examples**:
```
"Sunrise Senior Living, LLC" → "sunrise"
"Brookdale Assisted Living Inc." → "brookdale"
"The Manor at Heritage Oaks" → "the at heritage oaks"
```

### 2. Similarity Calculation

The **Levenshtein distance** measures how many single-character edits (insertions, deletions, substitutions) are needed to change one string into another.

Similarity score = `(max_length - edit_distance) / max_length`

**Examples**:
```
"Brookdale" vs "Brookedale" → 90% (1 character difference)
"Golden Years" vs "Golden Year" → 91.7% (1 character difference)
```

### 3. Confidence Thresholds

- **High confidence**: 90%+ similarity
- **Medium confidence**: 80-89% similarity
- **Low confidence**: 70-79% similarity
- **No match**: <70% similarity (configurable)

## Future Enhancements

### 1. Auto-population During Extraction

Integrate facility matching into the extraction pipeline:

```javascript
// In parallelExtractor.js
const { matchFacility } = require('./facilityMatcher');

// After extracting facility_name from documents
if (overview.facility_snapshot.facility_name) {
  const match = await matchFacility(
    overview.facility_snapshot.facility_name,
    overview.facility_snapshot.city,
    overview.facility_snapshot.state
  );

  if (match && match.match_confidence === 'high') {
    // Auto-populate missing data
    overview.facility_snapshot.licensed_beds = match.capacity;
    overview.facility_snapshot.latitude = match.latitude;
    overview.facility_snapshot.longitude = match.longitude;
    // ... etc
  }
}
```

### 2. Mapping Interface

Build a React component to display facilities on a map:

```jsx
import { GoogleMap, Marker } from '@react-google-maps/api';

function FacilityMap({ facility, nearbyFacilities }) {
  return (
    <GoogleMap
      center={{ lat: facility.latitude, lng: facility.longitude }}
      zoom={12}
    >
      <Marker position={{ lat: facility.latitude, lng: facility.longitude }} />
      {nearbyFacilities.map(f => (
        <Marker key={f.id} position={{ lat: f.latitude, lng: f.longitude }} />
      ))}
    </GoogleMap>
  );
}
```

### 3. Market Analysis

Use demographic data for market analysis:

```javascript
// Get facilities in target market
const facilities = await getFacilitiesNearby(lat, lon, 25);

// Calculate market statistics
const avgCapacity = facilities.reduce((sum, f) => sum + f.capacity, 0) / facilities.length;
const avgMedianAge = facilities.reduce((sum, f) => sum + f.median_age, 0) / facilities.length;
const avgPctOver65 = facilities.reduce((sum, f) => sum + f.pct_population_over_65, 0) / facilities.length;

console.log(`Market Analysis (25-mile radius):`);
console.log(`  Facilities: ${facilities.length}`);
console.log(`  Avg Capacity: ${avgCapacity.toFixed(1)} beds`);
console.log(`  Median Age: ${avgMedianAge.toFixed(1)} years`);
console.log(`  Population 65+: ${avgPctOver65.toFixed(1)}%`);
```

### 4. Update to 2025 Data

The current database is from 2021. Consider updating with:
- State licensing databases
- CMS Provider of Services files
- Commercial data providers (e.g., A Place for Mom, Caring.com)

## Data Quality Notes

- **Coverage**: All 50 states + DC
- **Year**: 2021 (4 years old)
- **Completeness**: ~99.95% import success rate (24 errors out of 44,650)
- **Coordinates**: Most facilities have lat/lon for mapping
- **Demographics**: County-level demographic data included

## Top States by Facility Count

1. **California**: 8,042 facilities
2. **Michigan**: 4,591 facilities
3. **Wisconsin**: 4,061 facilities
4. **Florida**: 3,156 facilities
5. **Minnesota**: 2,557 facilities
6. **Arizona**: 2,113 facilities
7. **Texas**: 2,024 facilities
8. **Maryland**: 1,684 facilities
9. **Georgia**: 1,671 facilities
10. **Pennsylvania**: 1,159 facilities

## Support

For issues or questions about the ALF database integration:

1. Check the test suite output: `node scripts/test_facility_matcher.js`
2. Verify database import: `sqlite3 database.sqlite "SELECT COUNT(*) FROM alf_facilities;"`
3. Review API logs for matching errors
4. Adjust `minSimilarity` threshold if too few/many matches
