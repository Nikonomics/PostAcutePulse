# Technical Debt Audit - SNFalyze

**Generated:** December 2024
**Audit Scope:** `backend/` and `frontend/src/`
**Total Issues Identified:** 20
**Critical Issues:** 4

---

## Quick Reference

| Priority | Issue | Status |
|----------|-------|--------|
| CRITICAL | Database connection pool leak | [ ] |
| CRITICAL | XSS via dangerouslySetInnerHTML | [ ] |
| CRITICAL | Hardcoded production credentials | [ ] |
| CRITICAL | O(n⁴) bellwether algorithm | [ ] |
| HIGH | Giant components (4900+ lines) | [ ] |
| HIGH | Missing input validation | [ ] |
| HIGH | SELECT * queries | [ ] |
| MEDIUM | Exposed API keys in frontend | [ ] |
| MEDIUM | Missing error boundaries | [ ] |
| MEDIUM | Error messages exposed to client | [ ] |

---

## CRITICAL ISSUES

### 1. Database Connection Pool Leak

**Status:** [ ] Not Started
**Priority:** CRITICAL
**Effort:** Medium (2-3 hours)
**Assignee:** _______________

#### Location
```
backend/routes/surveyIntelligence.js:19-25
backend/routes/markets.js:14-20
backend/routes/ownership.js
backend/routes/facilities.js
backend/routes/ma-analytics.js
backend/routes/market.js
backend/routes/dueDiligence.js
+ 8 more route files
```

#### Problem
Every route handler creates a NEW Pool instance via `getPool()`, then destroys it with `pool.end()` in finally blocks. This defeats connection pooling entirely.

```javascript
// CURRENT (BROKEN)
router.get('/endpoint', async (req, res) => {
  const pool = getPool();  // Creates NEW pool every request
  try {
    const result = await pool.query('SELECT ...');
    res.json(result.rows);
  } finally {
    await pool.end();  // Destroys entire pool
  }
});
```

#### Impact
- Memory leak under load
- Connection exhaustion (Render limit: ~97 connections)
- Application crashes during traffic spikes
- Each request creates/destroys ~5 connections

#### Fix
Create a singleton pool in `backend/config/database.js`:

```javascript
// backend/config/database.js
const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
      max: 20,  // Maximum connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
  }
  return pool;
};

module.exports = { getPool };
```

Then in routes, remove all `pool.end()` calls:

```javascript
// FIXED
const { getPool } = require('../config/database');

router.get('/endpoint', async (req, res) => {
  const pool = getPool();  // Returns singleton
  try {
    const result = await pool.query('SELECT ...');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
  // NO pool.end() - pool persists for app lifetime
});
```

#### Files to Update
- [ ] `backend/config/database.js` - Create singleton
- [ ] `backend/routes/surveyIntelligence.js` - Remove pool.end()
- [ ] `backend/routes/markets.js` - Remove pool.end()
- [ ] `backend/routes/ownership.js` - Remove pool.end()
- [ ] `backend/routes/facilities.js` - Remove pool.end()
- [ ] `backend/routes/ma-analytics.js` - Remove pool.end()
- [ ] `backend/routes/market.js` - Remove pool.end()
- [ ] `backend/routes/dueDiligence.js` - Remove sequelize.close()
- [ ] All other route files using getPool pattern

---

### 2. XSS Vulnerabilities via dangerouslySetInnerHTML

**Status:** [ ] Not Started
**Priority:** CRITICAL
**Effort:** Quick (1 hour)
**Assignee:** _______________

#### Location
```
frontend/src/components/SNFalyzePanel/SNFalyzePanel.jsx:743
frontend/src/pages/ChatInterfaceAI.jsx:455
frontend/src/pages/Dashboard.jsx:557
frontend/src/components/DocumentPreviewers.jsx:299
frontend/src/components/DealExtractionViewer/DealExtractionViewer.tsx:923
frontend/src/components/DealExtractionViewer/DealExtractionViewer.tsx:933
```

#### Problem
Rendering unsanitized HTML/Markdown from API responses without sanitization.

```jsx
// CURRENT (VULNERABLE)
<div dangerouslySetInnerHTML={{ __html: renderMarkdown(activity.message) }} />
```

#### Impact
- Cross-site scripting attacks possible
- Attackers can steal session tokens
- Malicious scripts via AI responses or user content

#### Fix
Install DOMPurify and sanitize all HTML:

```bash
cd frontend && npm install dompurify
```

```jsx
// FIXED
import DOMPurify from 'dompurify';

const sanitizeHTML = (html) => DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
});

<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(renderMarkdown(activity.message)) }} />
```

#### Files to Update
- [ ] `frontend/src/utils/sanitize.js` - Create utility
- [ ] `frontend/src/components/SNFalyzePanel/SNFalyzePanel.jsx:743`
- [ ] `frontend/src/pages/ChatInterfaceAI.jsx:455`
- [ ] `frontend/src/pages/Dashboard.jsx:557`
- [ ] `frontend/src/components/DocumentPreviewers.jsx:299`
- [ ] `frontend/src/components/DealExtractionViewer/DealExtractionViewer.tsx:923,933`

---

### 3. Hardcoded Production Credentials

**Status:** [ ] Not Started
**Priority:** CRITICAL
**Effort:** Quick (30 minutes)
**Assignee:** _______________

#### Location
```
backend/app_snfalyze.js:50-68
backend/seed.js:20-26
```

#### Problem
```javascript
const adminEmail = 'admin@snfalyze.com';
const passwordHash = await bcrypt.hash('password123', 10);
console.log('Created default admin user: admin@snfalyze.com / password123');
```

#### Impact
- Anyone with code access knows admin credentials
- Credentials logged to console/log files
- Compliance violation (SOC2, HIPAA)

#### Fix
Move to environment variables:

```javascript
// FIXED
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.warn('Admin credentials not configured - skipping default user creation');
  return;
}

const passwordHash = await bcrypt.hash(adminPassword, 10);
// DO NOT log password
console.log(`Admin user configured: ${adminEmail}`);
```

Add to `.env.example`:
```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<generate-secure-password>
```

#### Files to Update
- [ ] `backend/app_snfalyze.js:50-68` - Use env vars
- [ ] `backend/seed.js:20-26` - Use env vars
- [ ] `backend/.env.example` - Document required vars
- [ ] Remove console.log of password

---

### 4. O(n⁴) Algorithm in Bellwether Calculation

**Status:** [ ] Not Started
**Priority:** CRITICAL
**Effort:** Large (4-6 hours)
**Assignee:** _______________

#### Location
```
backend/routes/surveyIntelligence.js:2538-2563
```

#### Problem
```javascript
for (let i = 0; i < facilityIds.length; i++) {        // O(n)
  for (let j = 0; j < facilityIds.length; j++) {      // O(n)
    for (const surveyB of surveysB) {                 // O(m)
      for (const surveyA of surveysA) {               // O(m)
        // date comparison
      }
    }
  }
}
```

With 636 California facilities: 636² × surveys² = billions of operations.

#### Impact
- API timeout on states with >100 facilities
- Server CPU spike blocks other requests
- Currently masked by small county-level queries

#### Fix
Use hash maps for O(n²m) complexity:

```javascript
// FIXED - Build survey index first
const surveyIndex = new Map();
for (const facility of facilities) {
  const surveys = await getSurveys(facility.id);
  surveyIndex.set(facility.id, surveys.sort((a, b) => a.date - b.date));
}

// Then single pass comparison
for (const [facilityA, surveysA] of surveyIndex) {
  for (const [facilityB, surveysB] of surveyIndex) {
    if (facilityA === facilityB) continue;

    // Use binary search instead of nested loop
    let precedenceCount = 0;
    for (const surveyA of surveysA) {
      const idx = binarySearchBefore(surveysB, surveyA.date, 14); // within 14 days
      if (idx >= 0) precedenceCount++;
    }

    if (precedenceCount >= minOccurrences) {
      // Record relationship
    }
  }
}
```

#### Files to Update
- [ ] `backend/routes/surveyIntelligence.js:2538-2563` - Refactor algorithm
- [ ] Consider moving to background job for large states

---

## HIGH PRIORITY ISSUES

### 5. Giant Components with 40+ useState Hooks

**Status:** [ ] Not Started
**Priority:** HIGH
**Effort:** Large (8+ hours)
**Assignee:** _______________

#### Location
```
frontend/src/pages/CombinedDealForm.jsx (4,908 lines, 44 useState hooks)
frontend/src/pages/EditCombinedDealForm.jsx (1,821 lines)
frontend/src/pages/EditCombinedDeatlForm1.jsx (3,415 lines) - note: typo in filename
```

#### Problem
Single component managing: form state, file uploads, AI extraction, facility matching, document analysis, and validation. Untestable, unmaintainable.

#### Impact
- Any change risks breaking unrelated features
- No unit testing possible
- Onboarding new developers takes weeks
- ~10K lines of duplicate form code across 3 files

#### Fix
Split into focused components with custom hooks:

```
CombinedDealForm/
├── index.jsx                    # Main orchestrator (~200 lines)
├── hooks/
│   ├── useDealForm.js          # Form state management
│   ├── useFileUpload.js        # Upload logic
│   ├── useExtraction.js        # AI extraction
│   └── useFacilityMatching.js  # Facility matching
├── sections/
│   ├── BasicInfoSection.jsx
│   ├── FacilitiesSection.jsx
│   ├── FinancialsSection.jsx
│   ├── DocumentsSection.jsx
│   └── ValidationSection.jsx
└── CombinedDealForm.css
```

Consolidate Edit forms into single component with mode prop:
```jsx
<DealForm mode="create" />
<DealForm mode="edit" dealId={123} />
```

#### Files to Update
- [ ] Create `frontend/src/pages/CombinedDealForm/` directory structure
- [ ] Extract custom hooks
- [ ] Split into section components
- [ ] Delete duplicate `EditCombinedDealForm.jsx`
- [ ] Delete duplicate `EditCombinedDeatlForm1.jsx`
- [ ] Fix typo in filename

---

### 6. Missing Input Validation

**Status:** [ ] Not Started
**Priority:** HIGH
**Effort:** Quick (2 hours)
**Assignee:** _______________

#### Location
```
backend/routes/facilities.js:34-80
backend/routes/ownership.js
backend/routes/ma-analytics.js
backend/routes/surveyIntelligence.js
```

#### Problem
```javascript
if (minBeds) {
  params.push(parseInt(minBeds));  // NaN if "abc", no bounds
}
if (limit) {
  params.push(parseInt(limit));    // Could be 999999999
}
```

#### Fix
Create validation utility:

```javascript
// backend/utils/validation.js
const validateInt = (value, { min = 0, max = 10000, defaultVal = null } = {}) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultVal;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
};

const validateString = (value, { maxLength = 255, pattern = null } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLength);
  if (pattern && !pattern.test(trimmed)) return null;
  return trimmed;
};

module.exports = { validateInt, validateString };
```

Usage:
```javascript
const { validateInt } = require('../utils/validation');

const minBeds = validateInt(req.query.minBeds, { min: 0, max: 500, defaultVal: 0 });
const limit = validateInt(req.query.limit, { min: 1, max: 100, defaultVal: 20 });
```

#### Files to Update
- [ ] Create `backend/utils/validation.js`
- [ ] `backend/routes/facilities.js`
- [ ] `backend/routes/ownership.js`
- [ ] `backend/routes/ma-analytics.js`
- [ ] `backend/routes/surveyIntelligence.js`

---

### 7. SELECT * Queries

**Status:** [ ] Not Started
**Priority:** HIGH
**Effort:** Medium (3-4 hours)
**Assignee:** _______________

#### Location
```
backend/routes/ownership.js:764, 948
backend/routes/dueDiligence.js
backend/routes/facilities.js
+ 7 more files
```

#### Problem
```javascript
'SELECT * FROM ownership_profiles WHERE id = $1'
```

#### Impact
- Fetches 50+ columns when 5 needed
- Bandwidth waste, memory overhead
- Query plans can't optimize

#### Fix
Specify only needed columns:

```javascript
// BEFORE
'SELECT * FROM ownership_profiles WHERE id = $1'

// AFTER
`SELECT
  id, name, organization_type, hq_city, hq_state,
  total_facilities, total_beds, website
FROM ownership_profiles
WHERE id = $1`
```

#### Files to Update
- [ ] `backend/routes/ownership.js` - Audit all queries
- [ ] `backend/routes/dueDiligence.js`
- [ ] `backend/routes/facilities.js`
- [ ] `backend/routes/markets.js`
- [ ] `backend/routes/surveyIntelligence.js`

---

## MEDIUM PRIORITY ISSUES

### 8. Exposed API Keys in Frontend

**Status:** [ ] Not Started
**Priority:** MEDIUM
**Effort:** Medium (3 hours)
**Assignee:** _______________

#### Location
```
frontend/src/context/GoogleMapsContext.js
frontend/src/components/ (files using REACT_APP_GEMINI_API_KEY)
```

#### Problem
`REACT_APP_*` environment variables are bundled into JavaScript and visible in browser DevTools.

#### Fix
Move API calls to backend proxy:

```javascript
// backend/routes/maps.js
router.get('/geocode', async (req, res) => {
  const { address } = req.query;
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  );
  res.json(await response.json());
});
```

```javascript
// frontend - call backend instead
const geocode = async (address) => {
  const response = await fetch(`/api/v1/maps/geocode?address=${encodeURIComponent(address)}`);
  return response.json();
};
```

#### Files to Update
- [ ] Create `backend/routes/maps.js`
- [ ] Create `backend/routes/ai.js` for Gemini
- [ ] Update frontend to use backend endpoints
- [ ] Remove `REACT_APP_*` API key vars from frontend

---

### 9. Missing Error Boundaries

**Status:** [ ] Not Started
**Priority:** MEDIUM
**Effort:** Medium (2 hours)
**Assignee:** _______________

#### Location
```
frontend/src/components/ErrorBoundary.jsx (exists, only used at app root)
```

#### Problem
15+ complex feature components have no local error boundaries. One component crash takes down entire page.

#### Fix
Create feature-specific boundaries:

```jsx
// frontend/src/components/common/FeatureErrorBoundary.jsx
import React from 'react';

class FeatureErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h3>Something went wrong</h3>
          <p>This section couldn't load. Please refresh or try again.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap complex components:
```jsx
<FeatureErrorBoundary>
  <DealExtractionViewer />
</FeatureErrorBoundary>
```

#### Components to Wrap
- [ ] `DealExtractionViewer`
- [ ] `ProFormaTab`
- [ ] `DealCalculatorTab`
- [ ] `SurveyAnalytics` (each tab)
- [ ] `MarketAnalysis`
- [ ] `OwnershipProfile`
- [ ] `FacilityMetrics`

---

### 10. Error Messages Exposed to Client

**Status:** [ ] Not Started
**Priority:** MEDIUM
**Effort:** Quick (1 hour)
**Assignee:** _______________

#### Location
All backend route files

#### Problem
```javascript
res.status(500).json({
  success: false,
  error: error.message  // "relation 'users' does not exist"
});
```

#### Fix
Create error handler utility:

```javascript
// backend/utils/errorHandler.js
const sanitizeError = (error, context = '') => {
  // Log full error for debugging
  console.error(`[${context}]`, error);

  // Return safe message to client
  const safeMessages = {
    'ECONNREFUSED': 'Database connection error. Please try again.',
    'ETIMEDOUT': 'Request timed out. Please try again.',
    '23505': 'A record with this value already exists.',
    '23503': 'Referenced record not found.',
  };

  const code = error.code || '';
  return safeMessages[code] || 'An unexpected error occurred. Please try again.';
};

const handleError = (res, error, context = '') => {
  const message = sanitizeError(error, context);
  const status = error.status || 500;
  res.status(status).json({ success: false, error: message });
};

module.exports = { handleError, sanitizeError };
```

Usage:
```javascript
const { handleError } = require('../utils/errorHandler');

router.get('/endpoint', async (req, res) => {
  try {
    // ...
  } catch (error) {
    handleError(res, error, 'GET /endpoint');
  }
});
```

---

## LOWER PRIORITY ISSUES

### 11. Debug Code in Production

**Files:**
- `frontend/src/pages/UploadDeal.jsx:948-950` - DEBUG section in UI
- Multiple files with `console.log`

**Fix:** Remove debug UI, wrap console.log in environment check.

---

### 12. Duplicate Pool Creation Patterns

**Files:** 10+ route files have identical `getPool()` function

**Fix:** Already addressed in Issue #1 - centralize in `config/database.js`

---

### 13. Missing React Performance Optimizations

**Files:**
- `frontend/src/components/DealCalculatorTab.jsx` - No useMemo
- `frontend/src/components/ProFormaTab/ProFormaTab.jsx` - Inconsistent

**Fix:** Add useMemo for expensive calculations, useCallback for handlers.

---

### 14. Inline Styles Duplication

**Files:** 30+ components with inline styles

**Fix:** Create utility CSS classes, consolidate to CSS modules.

---

### 15. TODO Comments in Production

**Files:**
- `frontend/src/components/FacilitiesSection.jsx:26`
- `frontend/src/components/DealCalculatorTab.jsx:1789`

**Fix:** Move to GitHub Issues, remove from code.

---

## CHECKLIST BY EFFORT

### Quick Wins (< 1 hour each)
- [ ] Hardcoded credentials (#3)
- [ ] Error message sanitization (#10)
- [ ] Remove debug code (#11)
- [ ] Remove TODO comments (#15)

### Medium Effort (2-4 hours each)
- [ ] XSS sanitization (#2)
- [ ] Input validation (#6)
- [ ] Error boundaries (#9)
- [ ] API key migration (#8)

### Large Effort (4+ hours each)
- [ ] Connection pool refactor (#1)
- [ ] SELECT * audit (#7)
- [ ] Bellwether algorithm (#4)
- [ ] Component splitting (#5)

---

## TESTING VERIFICATION

After fixing each issue, verify:

### Connection Pool (#1)
```bash
# Load test with 50 concurrent requests
ab -n 100 -c 50 http://localhost:5001/api/v1/survey-intelligence/national/summary
# Should not see "too many connections" errors
```

### XSS (#2)
```javascript
// Test payload - should be escaped
const malicious = '<img src=x onerror="alert(1)">';
// Verify alert does NOT fire
```

### Input Validation (#6)
```bash
curl "http://localhost:5001/api/v1/facilities?minBeds=abc&limit=-1"
# Should return valid response with defaults, not error
```

---

## NOTES

- Audit performed: December 2024
- Codebase version: main branch
- Backend lines: ~50,000
- Frontend lines: ~80,000
- Total route files: 15+
- Total components: 100+

---

*Last updated: December 2024*
