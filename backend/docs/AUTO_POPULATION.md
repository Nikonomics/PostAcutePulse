# Auto-Population from ALF Database

## Overview

The extraction pipeline now automatically matches facility names against the ALF database and populates missing data when a high-confidence match is found.

## How It Works

### 1. Extraction Phase

When you upload deal documents:

1. AI extracts facility information (name, city, state, beds, etc.)
2. All extraction runs complete in parallel
3. Results are organized

### 2. Auto-Population Phase (NEW)

After extraction completes:

1. **Check**: Does `facility_snapshot.facility_name` exist?
2. **Match**: Search ALF database for matching facility
   - Uses fuzzy name matching (Levenshtein distance)
   - Considers city/state if available to narrow search
   - Requires 85%+ similarity to consider a match
3. **Evaluate Confidence**:
   - **High (90%+)**: Auto-populate missing data ✅
   - **Medium (80-89%)**: Store match but don't auto-populate ⚠️
   - **Low (70-79%)**: Store match but don't auto-populate ⚠️
   - **None (<70%)**: Skip ❌
4. **Populate**: If high confidence, fill in missing fields:
   - `licensed_beds` (if missing or inferred)
   - `city` (if missing)
   - `state` (if missing)
   - `latitude` (new field, for mapping)
   - `longitude` (new field, for mapping)
   - `ownership_type` (if missing)
5. **Track**: Record what was auto-populated in `facility_match` object

## Console Output

You'll see this in the backend logs:

```
[Facility Match] Attempting to match: "American House Keene"
[Facility Match] Match found: "American House Keene" (100.0% - high)
[Facility Match] High confidence - auto-populating missing data...
  ✓ Licensed beds: 144
  ✓ Coordinates: (42.9298525, -72.2699189)
[Facility Match] ✅ Auto-populated 2 fields
```

## Data Structure

### New Fields in `extraction_data.overview`

#### `facility_match` Object

```json
{
  "matched": true,
  "confidence": "high",
  "score": 1.0,
  "auto_populated": true,
  "auto_populated_fields": ["licensed_beds", "coordinates"],
  "full_address": "197 WATER ST, Keene, NH 3431",
  "database_facility_name": "American House Keene",
  "database_capacity": 144
}
```

**Fields**:
- `matched` (boolean): Whether a match was found
- `confidence` (string): "high" | "medium" | "low"
- `score` (number): 0.0-1.0 similarity score
- `auto_populated` (boolean): Whether data was auto-filled
- `auto_populated_fields` (array): List of fields that were auto-filled
- `full_address` (string): Complete address from database
- `database_facility_name` (string): Exact name from database
- `database_capacity` (number): Licensed beds from database

#### Updated `facility_snapshot` Fields

When auto-populated:

```json
{
  "facility_name": "American House Keene",
  "city": "Keene",
  "state": "NH",
  "licensed_beds": 144,
  "beds_source": "alf_database",  // NEW: indicates source
  "latitude": 42.9298525,         // NEW: GPS coordinate
  "longitude": -72.2699189,       // NEW: GPS coordinate
  "ownership_type": "For-Profit"  // If available
}
```

## Confidence Levels

### High Confidence (90%+) ✅ AUTO-POPULATE

**Action**: Automatically fills in missing data

**Example**:
- Input: "American House Keene"
- Match: "American House Keene"
- Score: 100%
- Result: Auto-populate ✅

### Medium Confidence (80-89%) ⚠️ STORE ONLY

**Action**: Stores match data but does NOT auto-populate

**Why**: Could be correct, but not confident enough for automatic changes

**Example**:
- Input: "Sunrise Senior Living Beverly Hills"
- Match: "Sunrise of Beverly Hills"
- Score: 85%
- Result: Store match for manual review ⚠️

### Low Confidence (70-79%) ⚠️ STORE ONLY

**Action**: Stores match data but does NOT auto-populate

**Why**: Likely different facility, store for manual review

### No Match (<70%) ❌

**Action**: No match stored

**Why**: Not similar enough to be the same facility

## Where Data Shows Up

### 1. Deal Overview Tab (Frontend)

The auto-populated data appears in:
- **Facility Snapshot**: Shows facility name, city, state, beds
- **Executive Summary**: Uses bed count in metrics
- **Key Metrics**: May show bed-based calculations

### 2. Deal Profile Page

- Facility information fields are pre-filled
- No manual data entry needed for matched facilities

### 3. Database (`deals` table)

Stored in `extraction_data` JSON field:
```sql
SELECT
  json_extract(extraction_data, '$.overview.facility_match') as facility_match,
  json_extract(extraction_data, '$.overview.facility_snapshot.licensed_beds') as beds,
  json_extract(extraction_data, '$.overview.facility_snapshot.beds_source') as beds_source
FROM deals
WHERE id = 123;
```

## Testing Auto-Population

### Test with Known Facility

1. Upload a deal with a known facility (e.g., "American House Keene" in NH)
2. Check backend logs for facility match output
3. View Deal Overview tab to see auto-populated data

### Check Match Quality

Query the database to see matches:

```sql
SELECT
  deal_name,
  json_extract(extraction_data, '$.overview.facility_snapshot.facility_name') as facility_name,
  json_extract(extraction_data, '$.overview.facility_match.confidence') as match_confidence,
  json_extract(extraction_data, '$.overview.facility_match.score') as match_score,
  json_extract(extraction_data, '$.overview.facility_match.auto_populated') as auto_populated,
  json_extract(extraction_data, '$.overview.facility_match.auto_populated_fields') as filled_fields
FROM deals
WHERE json_extract(extraction_data, '$.overview.facility_match') IS NOT NULL
ORDER BY id DESC
LIMIT 10;
```

## Troubleshooting

### No Match Found

**Possible reasons**:
1. Facility not in 2021 ALF database
2. Name doesn't match closely enough (<85% similarity)
3. Wrong state extracted (narrows search incorrectly)

**Solution**:
- Check facility_match object to see if match was attempted
- Try manual lookup: `POST /api/facilities/match` with facility name
- May need to manually enter data for this facility

### Medium/Low Confidence Match

**What happens**:
- Match is stored but data NOT auto-populated
- You can review the match manually

**How to review**:
```sql
SELECT
  json_extract(extraction_data, '$.overview.facility_match')
FROM deals
WHERE id = 123;
```

**Decision**:
- If match looks correct: Manually copy data from `facility_match` object
- If match is wrong: Ignore and manually enter correct data

### Wrong Data Auto-Populated

**Very rare** (only if high-confidence match is actually wrong)

**Solution**:
1. Check `facility_match` object to see what was filled
2. Manually correct the incorrect fields
3. Report the issue so we can improve matching algorithm

## Future Enhancements

### 1. Manual Match Review UI

Add button in Deal Overview tab:
```
Facility Match: 85% confidence (medium)
[Review Match] button
```

Clicking shows:
- Extracted facility name
- Matched database facility
- Match confidence
- Option to accept/reject match

### 2. Match History

Track all matches over time:
- Which facilities match frequently
- Match accuracy rates
- User corrections (to improve algorithm)

### 3. Nearby Competitors

Once GPS coordinates are populated:
- Show map with facility location
- Display nearby ALF facilities (within 25 miles)
- Competitive analysis

### 4. Database Updates

- Refresh ALF database with 2024/2025 data
- Add more facility types (SNF, Memory Care, etc.)
- Include more fields (ratings, reviews, financial metrics)

## Configuration

Current matching thresholds (in `parallelExtractor.js`):

```javascript
const match = await matchFacility(
  facilityName,
  city,
  state,
  0.85  // Require 85%+ similarity
);

// Only auto-populate if 90%+ (high confidence)
if (match.match_confidence !== 'high') {
  // Store but don't populate
}
```

To adjust:
- **Lower threshold** (e.g., 0.75): More matches, less accurate
- **Higher threshold** (e.g., 0.90): Fewer matches, more accurate
- **Auto-populate at medium**: More automation, slightly riskier

## Support

For issues with auto-population:

1. Check backend logs for `[Facility Match]` messages
2. Query `facility_match` object in database
3. Test match manually: `POST /api/facilities/match`
4. Review `docs/ALF_DATABASE.md` for matching algorithm details
