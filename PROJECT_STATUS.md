# SNFalyze Pro Forma Feature - Project Status

**Last Updated:** December 28, 2025
**Project:** Healthcare M&A Deal Management Platform (SNFalyze)
**Feature:** AI-Powered Pro Forma Analysis with Benchmark Comparisons

---

## 📅 Recent Changes (Auto-Generated)

> This section is automatically updated on each commit.

### Last 7 Days

- **2025-12-28** - Add state metrics, SPA routing, and View Profile navigation
- **2025-12-28** - Transform SNFalyze into PostAcutePulse market analysis platform
- **2025-12-25** - Fix CMS citation collectors to handle API limits and extract constraints
- **2025-12-25** - Add fire safety and health citations collectors with API endpoints
- **2025-12-23** - Update deal creation flow docs and add extraction docs checker script
- **2025-12-23** - Fix: Change occupancy >100% and ADC>beds from errors to warnings
- **2025-12-23** - Add missing columns from schema audit
- **2025-12-23** - Add comprehensive audit logging for deal operations
- **2025-12-23** - Add database migration reminder system
- **2025-12-23** - Add automatic migration runner on app startup
- **2025-12-22** - Add Custom Report Builder for drag-and-drop analytics
- **2025-12-22** - Add backend-level sorting for national regional hotspots
- **2025-12-22** - Add sortable columns and national view to Regional Hot Spots tab
- **2025-12-22** - Add Survey Patterns tab to Survey Analytics
- **2025-12-22** - Fix deficiency type filtering in Survey Analytics
- **2025-12-22** - Enable deficiency type filtering in Survey Analytics
- **2025-12-22** - Add state selector to Rating Thresholds State Trends view
- **2025-12-22** - Enhance Survey Analytics and Ownership Profile pages
- **2025-12-22** - Switch survey queries to Market DB for full deficiency dataset
- **2025-12-22** - Fix survey routes to use cms_facility_deficiencies table
- **2025-12-22** - Add period filtering to company survey analytics endpoint
- **2025-12-22** - Add Survey Analytics tab styles for OwnershipProfile
- **2025-12-22** - Add Survey Analytics tab to OwnershipProfile
- **2025-12-22** - Add survey analytics state to OwnershipProfile
- **2025-12-22** - Add company survey analytics and deal regulatory risk component
- **2025-12-22** - Add RegulatoryRiskCard component to facility profile
- **2025-12-22** - Add facility regulatory risk assessment API endpoint
- **2025-12-22** - Fix duplicate deal creation and add persistent logging
- **2025-12-22** - Add 'All Time' period option to Survey Analytics
- **2025-12-22** - Redesign comparison cards to compact two-row layout


### Areas Modified (Last 20 Commits)

```
Backend:     66 files
Frontend:    107 files
Routes:      6 files
Services:    10 files
Components:  51 files
Migrations:  17 files
```

### New Files Added (Last 20 Commits)

```
backend/DATABASE_MIGRATIONS.md
backend/controller/MarketController.js
backend/controller/WatchlistController.js
backend/migrations/20250101-create-watchlist-tables.js
backend/migrations/20250101-drop-deal-tables.js
backend/migrations/add-custom-reports-table.js
backend/models/custom_reports.js
backend/models/watchlist.js
backend/models/watchlist_item.js
backend/routes/customReports.js
backend/routes/hh-market.js
backend/routes/watchlist.js
backend/scripts/debug-search.js
backend/scripts/import-cutpoints.js
backend/scripts/reset-admin.js
```

---


## 📊 Executive Summary

### What We're Building
An intelligent pro forma analysis system that:
1. Extracts detailed P&L line items from financial documents using Claude AI
2. Calculates expense ratios and compares against industry benchmarks
3. Identifies improvement opportunities across labor, food, utilities, and management
4. Provides interactive scenario modeling with editable targets
5. Visualizes EBITDA bridge to stabilization with waterfall charts

### Current Completion Status
- **AI Extraction & Schema:** ✅ 100% Complete
- **Database Models:** ✅ 100% Complete
- **Frontend Components:** ✅ 95% Complete (missing 2 utility files)
- **Backend API Endpoints:** ❌ 0% Complete (needs full implementation)
- **Calculation Logic:** ❌ 0% Complete (needs implementation)
- **Integration & Testing:** ❌ Not started

**Overall Progress: ~45% Complete**

---

## ✅ What's Been Built

### 1. **AI Extraction System - COMPLETE**

#### A. Expense Detail Schema (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

Extracts detailed P&L line items into structured categories:
- **Direct Care:** Nursing salaries (RCC, RN, LPN, CMA), agency staffing, benefits, supplies
- **Culinary:** Wages, raw food cost, dietary supplies, equipment
- **Housekeeping:** Wages, supplies, laundry, linen
- **Maintenance:** Wages, building/equipment repair
- **Activities:** Wages, entertainment, transportation
- **Administrative:** Salaries, management fees, professional fees, bad debt
- **Utilities:** Electric, gas, water/sewer, cable
- **Property:** Taxes, insurance, grounds maintenance
- **Non-Operating:** Depreciation, amortization, interest, rent/lease

**Key Features:**
- Automatic line item mapping (e.g., "Salary & Wages - RCC" → `direct_care.nursing_salaries_rcc`)
- Source citation for every extracted value
- Confidence scoring (high, medium, low, not_found)
- Handles both text-based and vision-based PDF processing

#### B. Expense Ratio Calculations (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

Claude AI automatically calculates 13 key ratios:
- **Labor Metrics:** Total labor cost, labor % of revenue, agency % of labor
- **Food Metrics:** Food cost per resident day, food % of revenue
- **Admin Metrics:** Management fee %, admin % of revenue, bad debt %
- **Facility Metrics:** Utilities % of revenue, property cost per bed
- **Insurance:** Insurance % of revenue, insurance per bed

#### C. Benchmark Comparison Logic (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

Compares actuals against 6 key benchmarks with 3-tier thresholds:
1. **Labor %:** Target 55%, Max 62%, Critical >68%
2. **Agency % of Labor:** Target 2%, Max 5%, Critical >10%
3. **Food Cost/Day:** Target $10.50, Max $13.00, Critical >$16.00
4. **Management Fee %:** Target 4%, Max 5%, Critical >6%
5. **Bad Debt %:** Target 0.5%, Max 1.0%, Critical >2%
6. **Utilities %:** Target 2.5%, Max 3.5%, Critical >4.5%

Each comparison returns: `on_target`, `above_target`, or `critical`

#### D. Data Flattening & Storage (`backend/services/aiExtractor.js`)
**Status:** ✅ Fully implemented

- Flattens nested AI response to flat fields for database storage
- Stores full expense_detail object as JSON
- Stores expense_ratios and benchmark_comparison as JSON
- Extracts individual ratio fields for easy querying
- Handles type conversion (strings → numbers)

---

### 2. **Database Models - COMPLETE**

#### A. `benchmark_configurations` Table
**Status:** ✅ Fully implemented
**File:** `backend/models/benchmark_configurations.js`

**Schema:**
```sql
CREATE TABLE benchmark_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_name VARCHAR(100) DEFAULT 'Default',
  is_default BOOLEAN DEFAULT false,

  -- Operational Targets
  occupancy_target FLOAT DEFAULT 0.85,
  private_pay_mix_target FLOAT DEFAULT 0.35,

  -- Labor Benchmarks (with 3-tier thresholds)
  labor_pct_target FLOAT DEFAULT 0.55,
  labor_pct_max FLOAT DEFAULT 0.62,
  labor_pct_critical FLOAT DEFAULT 0.68,

  agency_pct_of_labor_target FLOAT DEFAULT 0.02,
  agency_pct_of_labor_max FLOAT DEFAULT 0.05,
  agency_pct_of_labor_critical FLOAT DEFAULT 0.10,

  -- Food Benchmarks
  food_cost_per_day_target FLOAT DEFAULT 10.50,
  food_cost_per_day_max FLOAT DEFAULT 13.00,
  food_cost_per_day_critical FLOAT DEFAULT 16.00,

  -- Management Fee Benchmarks
  management_fee_pct_target FLOAT DEFAULT 0.04,
  management_fee_pct_max FLOAT DEFAULT 0.05,
  management_fee_pct_critical FLOAT DEFAULT 0.06,

  -- Bad Debt Benchmarks
  bad_debt_pct_target FLOAT DEFAULT 0.005,
  bad_debt_pct_max FLOAT DEFAULT 0.01,
  bad_debt_pct_critical FLOAT DEFAULT 0.02,

  -- Utilities Benchmarks
  utilities_pct_target FLOAT DEFAULT 0.025,
  utilities_pct_max FLOAT DEFAULT 0.035,
  utilities_pct_critical FLOAT DEFAULT 0.045,

  -- Other Targets
  insurance_pct_target FLOAT DEFAULT 0.03,
  ebitda_margin_target FLOAT DEFAULT 0.09,
  ebitdar_margin_target FLOAT DEFAULT 0.23,
  stabilization_months INTEGER DEFAULT 18,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

**Indexes:**
- `idx_benchmark_config_user_id` on `user_id`
- `idx_benchmark_config_user_config_unique` UNIQUE on `(user_id, config_name)`
- `idx_benchmark_config_is_default` on `(user_id, is_default)`

**Associations:**
- `belongsTo` users (via `user_id`)

#### B. `deal_proforma_scenarios` Table
**Status:** ✅ Fully implemented
**File:** `backend/models/deal_proforma_scenarios.js`

**Schema:**
```sql
CREATE TABLE deal_proforma_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scenario_name VARCHAR(100) DEFAULT 'Base Case',

  -- Benchmark Overrides (JSON - only stores differences from defaults)
  benchmark_overrides TEXT,  -- JSON

  -- Cached Calculated Outputs
  stabilized_revenue FLOAT,
  stabilized_ebitda FLOAT,
  stabilized_ebitdar FLOAT,
  stabilized_noi FLOAT,
  total_opportunity FLOAT,
  total_opportunity_pct FLOAT,

  -- Stabilized Metrics
  stabilized_occupancy FLOAT,
  stabilized_private_pay_mix FLOAT,
  stabilized_labor_pct FLOAT,

  -- Detailed Breakdowns (JSON)
  opportunities TEXT,  -- JSON array of opportunity items
  yearly_projections TEXT,  -- JSON array of year-over-year projections

  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

**Indexes:**
- `idx_proforma_scenario_deal_id` on `deal_id`
- `idx_proforma_scenario_user_id` on `user_id`
- `idx_proforma_scenario_deal_scenario_unique` UNIQUE on `(deal_id, scenario_name)`

**Associations:**
- `belongsTo` deals (via `deal_id`)
- `belongsTo` users (via `user_id`)

#### C. Database Migrations
**Status:** ✅ Fully implemented
**File:** `backend/migrations/add-benchmark-and-proforma-tables.js`

- Auto-creates tables on first run
- Adds indexes for optimal query performance
- Adds unique constraints to prevent duplicates
- Runs after Sequelize sync completes

---

### 3. **Frontend Components - 95% COMPLETE**

#### A. ProFormaTab Component
**Status:** ✅ Fully implemented
**File:** `frontend/src/components/ProFormaTab/ProFormaTab.jsx` (733 lines)

**Key Features Implemented:**

1. **Summary Cards** (4 cards at top)
   - Total Opportunity
   - Stabilized EBITDA
   - Stabilized Margin
   - Issues Count

2. **Interactive Pro Forma Table**
   - 6 columns: Category, Actual, % Rev, Benchmark (editable), Variance, Opportunity
   - 4 sections: Revenue & Occupancy, Labor Costs, Other Expenses, Profitability
   - Color-coded variance cells (green/yellow/red/blue)
   - Editable benchmark inputs with debounced recalculation (500ms)
   - Disabled inputs when data unavailable or calculation in progress

3. **Scenario Management**
   - Save scenario modal with name and notes
   - Load scenario dropdown with list of saved scenarios
   - Delete scenario with confirmation
   - Reset to defaults with confirmation
   - Unsaved changes indicator
   - Currently loaded scenario badge

4. **EBITDA Bridge Waterfall Chart**
   - Visual representation of opportunity breakdown
   - Shows path from current to stabilized EBITDA
   - Integrated OpportunityWaterfall component

5. **Opportunity Breakdown Table**
   - Detailed list of all improvement opportunities
   - Shows current, target, opportunity, and description for each

6. **Error Handling & UX**
   - Loading states (initial load vs. recalculation)
   - Success/error alerts with auto-dismiss
   - Empty states for missing data
   - Warnings for limited expense data
   - Input validation

**Sub-Components:**
- `SummaryCard` - Metric display cards with icons
- `SectionHeader` - Table section headers
- `LineItemRow` - Table rows with editable inputs
- `getVarianceStatus()` - Color coding logic
- `getStatusBadge()` - Status badge helper
- `getErrorMessage()` - User-friendly error messages

#### B. ProFormaTab Styling
**Status:** ✅ Fully implemented
**File:** `frontend/src/components/ProFormaTab/ProFormaTab.css` (495 lines)

**Features:**
- Summary card hover effects and animations
- Professional table styling with zebra striping
- Color-coded variance indicators (4 states)
- Responsive design (mobile/tablet breakpoints)
- Print-friendly styles
- Smooth transitions on all interactions
- Accessibility focus styles
- Bootstrap integration

**Variance Color Scheme:**
- `on_target`: Green (#28a745) - Meeting or exceeding target
- `above_target`: Yellow (#ffc107) - 1-10% above target
- `below_target`: Blue (#17a2b8) - Below target (revenue/margins)
- `critical`: Red (#dc3545) - >10% above target or significantly below

#### C. Component Documentation
**Status:** ✅ Complete
**File:** `frontend/src/components/ProFormaTab/README.md` (550 lines)

Comprehensive documentation including:
- Feature descriptions and capabilities
- Props specifications with TypeScript-style definitions
- State management details
- API integration guide
- Expected API response formats
- Usage examples
- Styling customization guide
- Performance optimization notes
- Testing checklist
- Troubleshooting guide
- Future enhancement ideas

---

### 4. **AI Extraction Enhancements - COMPLETE**

#### A. Period Analyzer Integration
**Status:** ✅ Implemented (user made changes)
**File:** `backend/services/aiExtractor.js`

**Features:**
- Detects overlapping financial periods in multi-document uploads
- Recommends optimal T12 combination strategy
- Generates prompt sections for Claude to combine data correctly
- Handles YTD + Historical T12 combinations

**Functions:**
- `analyzeFinancialPeriods()` - Analyzes document periods
- `generatePromptSection()` - Creates prompt instructions for Claude
- `shouldAnalyzePeriods()` - Determines if period analysis needed
- `buildPeriodAnalysisPrompt()` - Integrates into main extraction prompt

#### B. Robust JSON Parsing
**Status:** ✅ Implemented (user made changes)
**File:** `backend/services/aiExtractor.js`

**Features:**
- Multiple fallback strategies for JSON parsing
- Handles markdown code blocks
- Repairs common JSON errors (trailing commas, unquoted keys, etc.)
- Extracts largest valid JSON object as last resort
- Detailed error logging for debugging

---

## ⚠️ What's Missing (Critical Path Items)

### 1. **Backend API Endpoints - NOT STARTED** ⚠️

#### A. Pro Forma Calculation Endpoint
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 4-6 hours

**Required Endpoint:**
```javascript
POST /api/deals/:id/proforma/calculate

Request Body:
{
  occupancy_target: 85,
  labor_pct_target: 55,
  agency_pct_of_labor_target: 2,
  food_cost_per_day_target: 10.50,
  management_fee_pct_target: 4,
  bad_debt_pct_target: 0.5,
  utilities_pct_target: 2.5,
  insurance_pct_target: 3,
  ebitda_margin_target: 9,
  ebitdar_margin_target: 23,
  current_financials: {
    revenue: 5000000,
    ebitda: 450000,
    occupancy: 82,
    labor_pct: 58.5,
    // ... other metrics
  }
}

Response:
{
  total_opportunity: 350000,
  stabilized_revenue: 5500000,
  stabilized_ebitda: 495000,
  stabilized_ebitdar: 1265000,
  opportunities: [
    {
      category: "Labor Optimization",
      current: 2925000,
      target: 2750000,
      opportunity: 175000,
      unit: "$",
      description: "Reduce labor to 55% of revenue from 58.5%"
    },
    // ... more opportunities
  ],
  issues: [
    {
      category: "Agency Staffing",
      actual: 8.2,
      benchmark: 2.0,
      status: "critical",
      message: "Agency staffing at 8.2% of labor (target: 2.0%)"
    }
  ]
}
```

**File to Create:** `backend/routes/proforma.js`

**Implementation Steps:**
1. Create route file with Express router
2. Add authentication middleware
3. Validate deal ownership
4. Parse request body and validate benchmarks
5. Call ProFormaCalculator service
6. Return calculated results
7. Handle errors gracefully

#### B. Scenario CRUD Endpoints
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 3-4 hours

**Required Endpoints:**

```javascript
// Get all scenarios for a deal
GET /api/deals/:id/proforma/scenarios

Response:
[
  {
    id: 1,
    scenario_name: "Base Case",
    stabilized_ebitda: 495000,
    total_opportunity: 350000,
    created_at: "2025-12-01T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z"
  },
  // ... more scenarios
]

// Create new scenario
POST /api/deals/:id/proforma/scenarios

Request Body:
{
  scenario_name: "Aggressive Turnaround",
  benchmark_overrides: {
    occupancy_target: 90,
    labor_pct_target: 52
  },
  notes: "Assumes full turnaround with new management",
  stabilized_revenue: 5800000,
  stabilized_ebitda: 580000,
  stabilized_ebitdar: 1350000,
  total_opportunity: 480000,
  opportunities: [...]
}

Response:
{
  id: 2,
  scenario_name: "Aggressive Turnaround",
  // ... full scenario data
}

// Get single scenario
GET /api/deals/:id/proforma/scenarios/:scenarioId

// Update scenario
PUT /api/deals/:id/proforma/scenarios/:scenarioId

// Delete scenario
DELETE /api/deals/:id/proforma/scenarios/:scenarioId
```

**File to Create:** `backend/routes/proforma.js` (same file as above)

#### C. Benchmark Configuration Endpoints
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 2-3 hours

**Required Endpoints:**

```javascript
// Get user's benchmark configurations
GET /api/users/:userId/benchmarks

// Get user's default benchmark
GET /api/users/:userId/benchmarks/default

// Create new benchmark configuration
POST /api/users/:userId/benchmarks

// Update benchmark configuration
PUT /api/users/:userId/benchmarks/:configId

// Delete benchmark configuration
DELETE /api/users/:userId/benchmarks/:configId

// Set as default
PUT /api/users/:userId/benchmarks/:configId/set-default
```

**File to Create:** `backend/routes/benchmarks.js`

---

### 2. **Backend Business Logic - NOT STARTED** ⚠️

#### A. ProFormaCalculator Service
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 6-8 hours

**File to Create:** `backend/services/ProFormaCalculator.js`

**Required Functions:**

```javascript
class ProFormaCalculator {
  /**
   * Calculate pro forma analysis
   * @param {object} currentFinancials - Current financial metrics
   * @param {object} benchmarks - Target benchmarks
   * @returns {object} Pro forma results
   */
  static calculate(currentFinancials, benchmarks) {
    // 1. Calculate stabilized revenue (based on occupancy target)
    // 2. Calculate stabilized expenses (based on benchmark targets)
    // 3. Calculate opportunities (current vs. target for each category)
    // 4. Calculate stabilized EBITDA/EBITDAR
    // 5. Identify issues (metrics above critical thresholds)
    // 6. Return structured results
  }

  /**
   * Calculate occupancy opportunity
   */
  static calculateOccupancyOpportunity(current, target, revenue, beds) {
    // ...
  }

  /**
   * Calculate labor optimization opportunity
   */
  static calculateLaborOpportunity(current, target, revenue) {
    // ...
  }

  /**
   * Calculate food cost opportunity
   */
  static calculateFoodOpportunity(current, target, averageCensus, beds) {
    // ...
  }

  /**
   * Calculate management fee opportunity
   */
  static calculateManagementFeeOpportunity(current, target, revenue) {
    // ...
  }

  /**
   * Identify issues (metrics above critical thresholds)
   */
  static identifyIssues(currentFinancials, benchmarks) {
    // ...
  }

  /**
   * Calculate stabilized metrics
   */
  static calculateStabilizedMetrics(opportunities, currentFinancials) {
    // ...
  }
}
```

**Calculation Logic Required:**

1. **Occupancy Opportunity:**
   ```
   Current Revenue = $5M
   Current Occupancy = 82%
   Target Occupancy = 85%

   Revenue per Occupied Bed = $5M / (120 beds × 82% × 365 days) = $139.78/day
   Additional Beds = 120 × (85% - 82%) = 3.6 beds
   Additional Revenue = 3.6 × 365 × $139.78 = $183,715
   ```

2. **Labor Optimization:**
   ```
   Current Labor = $2,925,000 (58.5% of revenue)
   Target Labor = 55% of revenue = $2,750,000
   Opportunity = $2,925,000 - $2,750,000 = $175,000
   ```

3. **Food Cost Optimization:**
   ```
   Current Food Cost/Day = $12.50
   Target Food Cost/Day = $10.50
   Average Daily Census = 98.4
   Opportunity = (12.50 - 10.50) × 98.4 × 365 = $71,838
   ```

4. **Management Fee Opportunity:**
   ```
   Current Fee = 5.5% of revenue = $275,000
   Target Fee = 4% of revenue = $200,000
   Opportunity = $275,000 - $200,000 = $75,000
   ```

5. **Total Opportunity:**
   ```
   Sum all opportunities = $505,553
   ```

6. **Stabilized EBITDA:**
   ```
   Current EBITDA = $450,000
   Stabilized EBITDA = $450,000 + $505,553 = $955,553
   Stabilized Margin = $955,553 / $5,183,715 = 18.4%
   ```

#### B. Benchmark Service
**Status:** ❌ NOT IMPLEMENTED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 2-3 hours

**File to Create:** `backend/services/BenchmarkService.js`

**Required Functions:**

```javascript
class BenchmarkService {
  /**
   * Get user's default benchmark configuration
   */
  static async getUserDefaultBenchmarks(userId) {
    // Query benchmark_configurations table
    // Return user's default config or system defaults
  }

  /**
   * Get all benchmark configurations for a user
   */
  static async getUserBenchmarks(userId) {
    // ...
  }

  /**
   * Create new benchmark configuration
   */
  static async createBenchmark(userId, config) {
    // Validate config values
    // Ensure no duplicate names
    // If is_default=true, unset other defaults
    // Insert into database
  }

  /**
   * Set benchmark as default
   */
  static async setAsDefault(userId, configId) {
    // Unset all other defaults for this user
    // Set this config as default
  }

  /**
   * Validate benchmark values
   */
  static validateBenchmarks(benchmarks) {
    // Ensure all required fields present
    // Ensure values in acceptable ranges
    // Ensure target <= max <= critical for thresholds
  }
}
```

---

### 3. **Frontend Utilities - PARTIALLY MISSING** ⚠️

#### A. Formatters Utility
**Status:** ⚠️ REFERENCED BUT NOT CREATED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 30 minutes

**File to Create:** `frontend/src/utils/formatters.js`

The ProFormaTab component imports these but the file doesn't exist:
```javascript
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters';
```

**Required Implementation:**

```javascript
/**
 * Format number as currency
 * @param {number} value - The number to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Format number as percentage
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format number with locale formatting
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date/time string
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};
```

#### B. OpportunityWaterfall Component
**Status:** ⚠️ REFERENCED BUT NOT CREATED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 3-4 hours

**File to Create:** `frontend/src/components/ProFormaTab/OpportunityWaterfall.jsx`

The ProFormaTab component imports this but it doesn't exist:
```javascript
import OpportunityWaterfall from './OpportunityWaterfall';
```

**Required Implementation:**

A React component that renders a waterfall chart showing:
- Current EBITDA (starting bar)
- Positive bars for each opportunity category
- Connector lines between bars
- Final stabilized EBITDA bar
- Labels and values on each bar
- Color coding by priority (high/medium/low)

**Suggested Approach:**
- Use a charting library (Recharts, Chart.js, or D3.js)
- Or create custom SVG-based waterfall chart

**Props Interface:**
```javascript
{
  currentEbitda: 450000,
  opportunities: [
    { label: 'Labor Optimization', value: 175000, priority: 'high' },
    { label: 'Occupancy Growth', value: 183715, priority: 'medium' },
    { label: 'Food Cost', value: 71838, priority: 'medium' },
    { label: 'Management Fees', value: 75000, priority: 'low' }
  ],
  stabilizedEbitda: 955553,
  height: 350,
  showLabels: true,
  title: 'EBITDA Bridge to Stabilization'
}
```

#### C. DealService API Methods
**Status:** ⚠️ PARTIALLY IMPLEMENTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 1 hour

**File to Update:** `frontend/src/api/DealService.js`

The ProFormaTab component imports these functions:
```javascript
import {
  calculateProforma,
  getProformaScenarios,
  createProformaScenario,
  deleteProformaScenario
} from '../../api/DealService';
```

**Required Implementation:**

```javascript
// Add to DealService.js or create separate ProformaService.js

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/**
 * Calculate pro forma analysis
 * @param {number} dealId - Deal ID
 * @param {object} params - Calculation parameters
 * @returns {Promise<object>} Pro forma results
 */
export const calculateProforma = async (dealId, params) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/calculate`,
      params,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Calculate proforma error:', error);
    throw error;
  }
};

/**
 * Get all proforma scenarios for a deal
 * @param {number} dealId - Deal ID
 * @returns {Promise<array>} Array of scenarios
 */
export const getProformaScenarios = async (dealId) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/scenarios`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Get scenarios error:', error);
    throw error;
  }
};

/**
 * Create a new proforma scenario
 * @param {number} dealId - Deal ID
 * @param {object} scenarioData - Scenario data
 * @returns {Promise<object>} Created scenario
 */
export const createProformaScenario = async (dealId, scenarioData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/scenarios`,
      scenarioData,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Create scenario error:', error);
    throw error;
  }
};

/**
 * Delete a proforma scenario
 * @param {number} dealId - Deal ID
 * @param {number} scenarioId - Scenario ID
 * @returns {Promise<void>}
 */
export const deleteProformaScenario = async (dealId, scenarioId) => {
  try {
    await axios.delete(
      `${API_BASE_URL}/api/deals/${dealId}/proforma/scenarios/${scenarioId}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
  } catch (error) {
    console.error('Delete scenario error:', error);
    throw error;
  }
};
```

---

## 🔧 Integration Requirements

### 1. **Backend Route Integration**
**Status:** ❌ NOT STARTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 30 minutes

**File to Update:** `backend/app_snfalyze.js`

Add the new pro forma routes:

```javascript
// Add near other route imports
const proformaRouter = require('./routes/proforma');
const benchmarkRouter = require('./routes/benchmarks');

// Add near other route registrations
app.use('/api/deals/:dealId/proforma', proformaRouter);
app.use('/api/users/:userId/benchmarks', benchmarkRouter);
```

### 2. **Frontend Component Integration**
**Status:** ❌ NOT STARTED
**Priority:** 🔴 CRITICAL
**Estimated Effort:** 30 minutes

**File to Update:** Deal detail page where ProFormaTab will be used

```javascript
import ProFormaTab from './components/ProFormaTab/ProFormaTab';

// In your deal detail component:
<ProFormaTab
  deal={deal}
  extractionData={deal.extraction_data}
  onSaveScenario={handleSaveScenario}
/>
```

---

## 🧪 Testing Requirements - NOT STARTED

### 1. **Backend Unit Tests**
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 4-6 hours

**Files to Create:**
- `backend/tests/services/ProFormaCalculator.test.js`
- `backend/tests/services/BenchmarkService.test.js`
- `backend/tests/routes/proforma.test.js`
- `backend/tests/routes/benchmarks.test.js`

**Test Cases Needed:**
- Pro forma calculation accuracy
- Opportunity calculation for each category
- Issue identification logic
- Benchmark validation
- CRUD operations for scenarios
- Error handling and edge cases

### 2. **Frontend Component Tests**
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 3-4 hours

**Files to Create:**
- `frontend/src/components/ProFormaTab/ProFormaTab.test.jsx`
- `frontend/src/components/ProFormaTab/OpportunityWaterfall.test.jsx`

**Test Cases Needed:**
- Component renders with valid data
- Benchmark inputs trigger recalculation
- Scenario save/load/delete functionality
- Empty states display correctly
- Error handling and user feedback
- Responsive design

### 3. **Integration Tests**
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 2-3 hours

**Test Scenarios:**
1. End-to-end: Upload documents → Extract → View Pro Forma → Adjust benchmarks → Save scenario
2. Multi-user: User A creates scenario, User B cannot access it
3. Performance: Large deal with many scenarios loads quickly
4. Data integrity: Scenario saves match what was calculated

---

## 📋 Implementation Checklist

### Phase 1: Core Backend (Critical Path) - 12-16 hours

- [ ] **1.1 ProFormaCalculator Service** (6-8 hours)
  - [ ] Create `backend/services/ProFormaCalculator.js`
  - [ ] Implement `calculate()` main function
  - [ ] Implement `calculateOccupancyOpportunity()`
  - [ ] Implement `calculateLaborOpportunity()`
  - [ ] Implement `calculateFoodOpportunity()`
  - [ ] Implement `calculateManagementFeeOpportunity()`
  - [ ] Implement `calculateBadDebtOpportunity()`
  - [ ] Implement `calculateUtilitiesOpportunity()`
  - [ ] Implement `identifyIssues()`
  - [ ] Implement `calculateStabilizedMetrics()`
  - [ ] Add comprehensive error handling
  - [ ] Add input validation

- [ ] **1.2 Pro Forma API Routes** (4-6 hours)
  - [ ] Create `backend/routes/proforma.js`
  - [ ] POST `/api/deals/:id/proforma/calculate`
  - [ ] GET `/api/deals/:id/proforma/scenarios`
  - [ ] POST `/api/deals/:id/proforma/scenarios`
  - [ ] GET `/api/deals/:id/proforma/scenarios/:scenarioId`
  - [ ] PUT `/api/deals/:id/proforma/scenarios/:scenarioId`
  - [ ] DELETE `/api/deals/:id/proforma/scenarios/:scenarioId`
  - [ ] Add authentication middleware
  - [ ] Add authorization checks (deal ownership)
  - [ ] Add request validation
  - [ ] Add error handling

- [ ] **1.3 Route Integration** (30 min)
  - [ ] Register routes in `backend/app_snfalyze.js`
  - [ ] Test route accessibility with Postman/curl

### Phase 2: Frontend Utilities (Critical Path) - 4-5 hours

- [ ] **2.1 Formatters Utility** (30 min)
  - [ ] Create `frontend/src/utils/formatters.js`
  - [ ] Implement `formatCurrency()`
  - [ ] Implement `formatPercent()`
  - [ ] Implement `formatNumber()`
  - [ ] Implement `formatDate()`
  - [ ] Implement `formatDateTime()`

- [ ] **2.2 OpportunityWaterfall Component** (3-4 hours)
  - [ ] Create `frontend/src/components/ProFormaTab/OpportunityWaterfall.jsx`
  - [ ] Research/choose charting library (Recharts recommended)
  - [ ] Implement waterfall chart rendering
  - [ ] Add bar labels and values
  - [ ] Add color coding by priority
  - [ ] Add responsive design
  - [ ] Add loading states
  - [ ] Create OpportunityWaterfall.css if needed

- [ ] **2.3 DealService API Methods** (1 hour)
  - [ ] Add or update `frontend/src/api/DealService.js`
  - [ ] Implement `calculateProforma()`
  - [ ] Implement `getProformaScenarios()`
  - [ ] Implement `createProformaScenario()`
  - [ ] Implement `deleteProformaScenario()`
  - [ ] Add proper error handling
  - [ ] Add request/response logging

### Phase 3: Secondary Features (Medium Priority) - 5-8 hours

- [ ] **3.1 Benchmark Service** (2-3 hours)
  - [ ] Create `backend/services/BenchmarkService.js`
  - [ ] Implement `getUserDefaultBenchmarks()`
  - [ ] Implement `getUserBenchmarks()`
  - [ ] Implement `createBenchmark()`
  - [ ] Implement `updateBenchmark()`
  - [ ] Implement `deleteBenchmark()`
  - [ ] Implement `setAsDefault()`
  - [ ] Implement `validateBenchmarks()`

- [ ] **3.2 Benchmark API Routes** (2-3 hours)
  - [ ] Create `backend/routes/benchmarks.js`
  - [ ] GET `/api/users/:userId/benchmarks`
  - [ ] GET `/api/users/:userId/benchmarks/default`
  - [ ] POST `/api/users/:userId/benchmarks`
  - [ ] PUT `/api/users/:userId/benchmarks/:configId`
  - [ ] DELETE `/api/users/:userId/benchmarks/:configId`
  - [ ] PUT `/api/users/:userId/benchmarks/:configId/set-default`
  - [ ] Add authentication/authorization
  - [ ] Register routes in app

- [ ] **3.3 Benchmark UI (Future)** (4-6 hours)
  - [ ] Create BenchmarkConfigModal component
  - [ ] Add benchmark selection dropdown to ProFormaTab
  - [ ] Add "Save as Template" functionality
  - [ ] Add benchmark comparison view

### Phase 4: Testing & Polish (Medium Priority) - 8-12 hours

- [ ] **4.1 Backend Tests** (4-6 hours)
  - [ ] Write ProFormaCalculator unit tests
  - [ ] Write BenchmarkService unit tests
  - [ ] Write API route integration tests
  - [ ] Test error handling and edge cases

- [ ] **4.2 Frontend Tests** (3-4 hours)
  - [ ] Write ProFormaTab component tests
  - [ ] Write OpportunityWaterfall tests
  - [ ] Write API service tests
  - [ ] Test responsive design

- [ ] **4.3 Integration Testing** (2-3 hours)
  - [ ] End-to-end user flow testing
  - [ ] Cross-browser testing
  - [ ] Performance testing
  - [ ] Data integrity testing

- [ ] **4.4 Documentation** (1 hour)
  - [ ] Update API documentation
  - [ ] Create user guide for Pro Forma feature
  - [ ] Document calculation formulas
  - [ ] Add inline code comments

### Phase 5: Deployment & Monitoring (Low Priority) - 2-4 hours

- [ ] **5.1 Database Migration** (1 hour)
  - [ ] Run migrations on production database
  - [ ] Verify tables created correctly
  - [ ] Create default benchmark configurations for existing users

- [ ] **5.2 Deployment** (1 hour)
  - [ ] Deploy backend changes
  - [ ] Deploy frontend changes
  - [ ] Run smoke tests in production

- [ ] **5.3 Monitoring** (1-2 hours)
  - [ ] Add logging for pro forma calculations
  - [ ] Add performance monitoring
  - [ ] Set up error alerts
  - [ ] Monitor API usage

---

## 🎯 Quick Start Guide (For Next Developer)

### Immediate Next Steps (In Order)

1. **Create Formatters Utility** (30 min)
   - File: `frontend/src/utils/formatters.js`
   - Copy implementation from section 3.A above
   - Test that ProFormaTab component no longer has import errors

2. **Create ProFormaCalculator Service** (6-8 hours)
   - File: `backend/services/ProFormaCalculator.js`
   - Start with the main `calculate()` function
   - Implement opportunity calculations one at a time
   - Test each calculation with known inputs/outputs

3. **Create Pro Forma API Routes** (4-6 hours)
   - File: `backend/routes/proforma.js`
   - Start with POST `/calculate` endpoint
   - Then implement scenario CRUD endpoints
   - Test each endpoint with Postman

4. **Create DealService API Methods** (1 hour)
   - File: `frontend/src/api/DealService.js`
   - Add the 4 required functions
   - Test by calling from browser console

5. **Create OpportunityWaterfall Component** (3-4 hours)
   - File: `frontend/src/components/ProFormaTab/OpportunityWaterfall.jsx`
   - Use Recharts library for easy waterfall chart
   - Test with sample data

6. **Integration & Testing** (2-3 hours)
   - Register routes in backend app
   - Test full flow: Upload docs → Extract → Pro Forma → Save scenario
   - Fix any bugs found

### Development Environment Setup

```bash
# Backend
cd backend
npm install
npm run seed  # If needed
npm start     # Should run on http://localhost:5001

# Frontend
cd frontend
npm install
npm start     # Should run on http://localhost:3000
```

### Testing the Feature

1. **Upload test documents** to a deal
2. **Run AI extraction** to populate financial data
3. **Navigate to Pro Forma tab** (needs to be added to deal detail page)
4. **Adjust benchmarks** and watch calculations update
5. **Save a scenario**
6. **Load the scenario** to verify it was saved correctly

---

## 📊 Data Flow Diagram

```
[User uploads P&L documents]
          ↓
[AI Extraction Service (aiExtractor.js)]
- Extracts expense line items
- Calculates expense ratios
- Compares against benchmarks
          ↓
[Stores in deals.extraction_data (JSON)]
          ↓
[User opens Pro Forma tab]
          ↓
[ProFormaTab component]
- Parses extraction_data
- Displays current financials
- Allows benchmark editing
          ↓
[User adjusts benchmarks]
          ↓
[API Call: POST /proforma/calculate]
          ↓
[ProFormaCalculator.calculate()]
- Calculates opportunities
- Identifies issues
- Calculates stabilized metrics
          ↓
[Returns results to frontend]
          ↓
[ProFormaTab displays]
- Updated opportunities
- EBITDA bridge waterfall
- Color-coded variances
          ↓
[User clicks "Save Scenario"]
          ↓
[API Call: POST /proforma/scenarios]
          ↓
[Saves to deal_proforma_scenarios table]
```

---

## 🔑 Key Technical Decisions Made

1. **AI-First Approach:** Using Claude AI to extract detailed expense line items rather than manual categorization
2. **JSON Storage:** Storing complex nested data (expense_detail, opportunities) as JSON in database for flexibility
3. **Debounced Recalculation:** 500ms debounce on benchmark changes to reduce API calls
4. **Benchmark Overrides:** Only storing differences from defaults to minimize data storage
5. **Three-Tier Thresholds:** Target/Max/Critical thresholds for each benchmark for nuanced analysis
6. **Scenario-Based Modeling:** Supporting multiple scenarios per deal for sensitivity analysis
7. **Cached Calculations:** Storing calculated results in scenario table for quick display without recalculation

---

## 📚 Key Files Reference

### Backend Files

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `services/aiExtractor.js` | ✅ Complete | ~1900 | AI extraction with expense details |
| `models/benchmark_configurations.js` | ✅ Complete | 192 | Benchmark config model |
| `models/deal_proforma_scenarios.js` | ✅ Complete | 150 | Scenario model |
| `migrations/add-benchmark-and-proforma-tables.js` | ✅ Complete | 170 | Database migration |
| `services/ProFormaCalculator.js` | ❌ Missing | ~400 | Pro forma calculation logic |
| `routes/proforma.js` | ❌ Missing | ~300 | Pro forma API endpoints |
| `routes/benchmarks.js` | ❌ Missing | ~200 | Benchmark API endpoints |
| `services/BenchmarkService.js` | ❌ Missing | ~200 | Benchmark business logic |

### Frontend Files

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `components/ProFormaTab/ProFormaTab.jsx` | ✅ Complete | 733 | Main pro forma component |
| `components/ProFormaTab/ProFormaTab.css` | ✅ Complete | 495 | Component styling |
| `components/ProFormaTab/README.md` | ✅ Complete | 550 | Component documentation |
| `utils/formatters.js` | ❌ Missing | ~100 | Number/currency formatting |
| `components/ProFormaTab/OpportunityWaterfall.jsx` | ❌ Missing | ~200 | Waterfall chart component |
| `api/DealService.js` | ⚠️ Partial | +100 | API service methods (needs 4 functions) |

---

## 💡 Tips for Implementation

### Pro Forma Calculation Logic

**Key Formula:**
```
Opportunity = Current Cost - Target Cost
Stabilized EBITDA = Current EBITDA + Sum(All Opportunities)
```

**Revenue Opportunity (Occupancy):**
```javascript
// Current: 82% occupancy, 120 beds, $5M revenue
// Target: 85% occupancy

const revenuePerOccupiedBed = currentRevenue / (beds * currentOccupancy / 100 * 365);
const additionalBeds = beds * (targetOccupancy - currentOccupancy) / 100;
const revenueOpportunity = additionalBeds * 365 * revenuePerOccupiedBed;
```

**Expense Opportunity (Labor, Food, etc.):**
```javascript
// Current: 58.5% labor, Target: 55% labor
// Revenue: $5M

const currentLaborCost = revenue * (currentLaborPct / 100);
const targetLaborCost = revenue * (targetLaborPct / 100);
const laborOpportunity = currentLaborCost - targetLaborCost;
```

**Issue Detection:**
```javascript
function getStatus(actual, target, max, critical) {
  if (actual <= target) return 'on_target';
  if (actual <= max) return 'above_target';
  return 'critical';
}
```

### Waterfall Chart Implementation

**Using Recharts (Recommended):**
```bash
npm install recharts
```

```javascript
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Transform opportunities into cumulative data
const cumulativeData = opportunities.reduce((acc, opp, idx) => {
  const lastValue = idx === 0 ? currentEbitda : acc[idx - 1].end;
  acc.push({
    name: opp.label,
    start: lastValue,
    end: lastValue + opp.value,
    value: opp.value
  });
  return acc;
}, []);

// Add starting and ending bars
const chartData = [
  { name: 'Current', value: currentEbitda, isTotal: true },
  ...cumulativeData,
  { name: 'Stabilized', value: stabilizedEbitda, isTotal: true }
];
```

---

## 🚀 Deployment Notes

### Environment Variables Needed

```bash
# Backend (.env)
DATABASE_URL=postgresql://...  # Production database
ANTHROPIC_API_KEY=sk-ant-...   # For AI extraction
JWT_SECRET=your-secret-key     # For authentication

# Frontend (.env)
REACT_APP_API_URL=https://api.snfalyze.com
```

### Database Migration Steps

```bash
# 1. Backup production database
pg_dump snfalyze_prod > backup_$(date +%Y%m%d).sql

# 2. Run migrations
npm run migrate

# 3. Verify tables created
psql snfalyze_prod -c "\dt"

# 4. Create default benchmarks for existing users
psql snfalyze_prod -c "
  INSERT INTO benchmark_configurations (user_id, config_name, is_default)
  SELECT id, 'Default', true FROM users;
"
```

### Performance Considerations

1. **Pro forma calculations are CPU-intensive** - Consider caching results
2. **Debounce user input** to reduce API calls (already implemented: 500ms)
3. **Index database** on frequently queried fields (already implemented)
4. **Paginate scenario lists** if users have >20 scenarios per deal
5. **Lazy load** OpportunityWaterfall chart library to reduce bundle size

---

## 📞 Questions & Support

### Common Questions

**Q: Why store expense_detail as JSON instead of normalized tables?**
A: Flexibility. Expense categories vary by facility type (SNF vs ALF). JSON allows easy schema evolution without migrations.

**Q: Why debounce benchmark changes instead of waiting for "Calculate" button?**
A: Better UX. Users can see results update in real-time as they adjust sliders/inputs.

**Q: Why store calculated results in scenario table?**
A: Performance. Listing scenarios in dropdown can show stabilized EBITDA without recalculating every scenario.

**Q: Should we validate benchmark values on frontend or backend?**
A: Both. Frontend for immediate user feedback, backend for security and data integrity.

**Q: How do we handle deals with no expense ratio data?**
A: Pro forma tab shows a warning and disables opportunity calculations. Users must re-extract with detailed P&L.

### Contact

- **Project Lead:** [Your Name]
- **Backend Developer:** [Assign]
- **Frontend Developer:** [Assign]
- **QA Engineer:** [Assign]

---

## 📅 Estimated Timeline

### Aggressive (Full-time developer)
- **Phase 1 (Backend Core):** 2-3 days
- **Phase 2 (Frontend Utils):** 1 day
- **Phase 3 (Secondary Features):** 1-2 days
- **Phase 4 (Testing):** 1-2 days
- **Phase 5 (Deployment):** 0.5 days
- **Total:** 5.5 - 8.5 days

### Realistic (Part-time/Interrupted work)
- **Phase 1 (Backend Core):** 4-5 days
- **Phase 2 (Frontend Utils):** 2 days
- **Phase 3 (Secondary Features):** 2-3 days
- **Phase 4 (Testing):** 2-3 days
- **Phase 5 (Deployment):** 1 day
- **Total:** 11 - 14 days

### Conservative (Including unknowns & revisions)
- Add 50% buffer for unknowns
- **Total:** 16 - 21 days

---

## 🎉 Success Criteria

The Pro Forma feature will be considered complete when:

1. ✅ User can upload P&L documents and see extracted expense ratios
2. ✅ User can view Pro Forma tab with current actuals vs. benchmarks
3. ✅ User can edit benchmark targets and see recalculated opportunities
4. ✅ User can see color-coded variance indicators (green/yellow/red)
5. ✅ User can view EBITDA bridge waterfall chart
6. ✅ User can save multiple scenarios per deal
7. ✅ User can load and compare saved scenarios
8. ✅ User can delete scenarios they no longer need
9. ✅ System correctly identifies issues (critical variances)
10. ✅ All calculations are mathematically accurate
11. ✅ API endpoints have proper authentication/authorization
12. ✅ Component handles missing data gracefully
13. ✅ Feature works on mobile/tablet devices
14. ✅ Feature is documented for future maintenance

---

## 📖 Additional Resources

### Industry Benchmarks Sources
- [AHCA Financial Benchmarks](https://www.ahcancal.org/)
- [NIC MAP Data](https://www.nic.org/)
- Cascadia internal benchmarks (55% labor, 2% agency, etc.)

### Calculation References
- EBITDA/EBITDAR calculations: Standard accounting definitions
- Occupancy opportunity: Revenue per bed × additional occupied days
- Labor opportunity: Revenue × (current % - target %)

### Similar Products (Inspiration)
- RealPage OpEx analytics
- Yardi Senior Living benchmarking
- NIC MAP Vision

---

---

## 🗂️ Platform-Wide Tab Reorganization Plan

### Current vs. Target Tab Structure

The Pro Forma feature is part of a larger platform reorganization. Here's the complete tab strategy:

| Tab | Purpose | Status | Priority |
|-----|---------|--------|----------|
| **Overview** | AI-generated deal summary at a glance | 🔄 IN PROGRESS | 🔴 HIGH |
| **Census & Revenue Analysis** | All revenue-related data (rename from "Census & Rates") | 🔄 EXPAND | 🟡 MEDIUM |
| **Expense Analysis** | Monthly trended expense data (12 columns for TTM) | ❌ NOT STARTED | 🔴 HIGH |
| **Calculator** | Valuation analysis (cap rate, multiples, price per bed) | ✅ EXISTS | - |
| **Pro Forma** | ROI projection with editable benchmarks | ✅ JUST BUILT | 🔴 HIGH (Testing) |
| **Observations** | AI insights + user comments (3 sections) | 🔄 EXPAND | 🟡 MEDIUM |
| ~~Projections~~ | *DELETE THIS TAB* | 🗑️ REMOVE | 🟡 MEDIUM |

---

## 📑 Detailed Tab Specifications

### 1. Overview Tab (IN PROGRESS)
**Status:** 🔄 Being built in separate Claude Code window
**Priority:** 🔴 CRITICAL - First thing users see
**File:** `frontend/src/components/OverviewTab/OverviewTab.jsx`

**Purpose:** AI-generated deal snapshot before diving into details

**Content to Display:**
- Deal location (city, state)
- Number of facilities involved
- Facility types (SNF, ALF, Memory Care, CCRC, etc.)
- Total bed count across all facilities
- TTM revenue (trailing 12 months)
- TTM net income / EBITDA
- Brief AI summary of what documents/data we have
- Data completeness indicator (e.g., "8 of 10 key metrics available")

**Implementation Notes:**
- Query extraction_data from deal
- Use Gemini 2.0 Flash to generate natural language summary
- Cache summary to avoid re-generating on every page load
- Add "Regenerate Summary" button
- Show extraction timestamp and which documents were analyzed

---

### 2. Census & Revenue Analysis Tab (EXPAND EXISTING)
**Status:** 🔄 Needs expansion (currently called "Census & Rates")
**Priority:** 🟡 MEDIUM
**Current File:** Needs identification

**Purpose:** Everything related to revenue streams

**Sections to Include:**
1. **Occupancy Trends**
   - Historical occupancy chart (12-month trend)
   - Current vs. target occupancy
   - Days to stabilization estimate

2. **Payer Mix Breakdown**
   - Medicare vs. Medicaid vs. Private Pay
   - Visual pie chart
   - Revenue by payer source (dollar amounts)
   - Compare census-based vs. revenue-based payer mix

3. **Rate Schedules**
   - Private pay rates by unit type and care level
   - Medicaid rates by care level
   - Rate comparison to market (if data available)

4. **Revenue Metrics**
   - Average Daily Rate (ADR)
   - Revenue Per Available Room (RevPAR)
   - Revenue per occupied bed
   - Ancillary revenue breakdown

5. **Census Data Over Time**
   - Monthly census trends
   - Seasonal patterns
   - Move-in/move-out rates (if available)

**Implementation Priority:** After Pro Forma testing complete

---

### 3. Expense Analysis Tab (NEW - HIGH PRIORITY)
**Status:** ❌ NOT STARTED
**Priority:** 🔴 HIGH - Supports both valuation and ROI analysis
**File to Create:** `frontend/src/components/ExpenseAnalysisTab/ExpenseAnalysisTab.jsx`

**Purpose:** Monthly trended expense analysis with variance detection

**Display Format:**
Table with 12 monthly columns + TTM total, grouped by expense category:

| Category | Line Items | Display |
|----------|------------|---------|
| **Direct Care** | Salary & Wages - Caregivers<br>Outside Services Agency - CNA<br>PTO, Payroll Taxes, Benefits<br>**TOTAL** | $ + % of Rev |
| **Activities** | Salary & Wages - Activities<br>Entertainment, Supplies<br>**TOTAL** | $ + % of Rev |
| **Culinary** | Salary & Wages - Dietary<br>Food (raw cost)<br>Supplies<br>**TOTAL** | $ + % of Rev |
| **Housekeeping/Laundry** | Salary & Wages - Housekeeping<br>Supplies, Laundry, Linen<br>**TOTAL** | $ + % of Rev |
| **Maintenance** | Salary & Wages - Maintenance<br>Outside Services<br>Equipment Maintenance & Repair<br>Building Repair<br>**TOTAL** | $ + % of Rev |
| **Administration** | Salary & Wages - Administration<br>Outside Services<br>Computer Maintenance Fees<br>Telephone<br>**TOTAL** | $ + % of Rev |
| **General** | Bad Debt<br>Cable TV<br>Light & Power<br>Natural Gas & Oil<br>Water/Garbage/Sewer<br>**TOTAL** | $ + % of Rev |
| **Property** | Interest Expense<br>Depreciation<br>Property Taxes<br>Property Insurance<br>Land Lease<br>**TOTAL** | $ + % of Rev |

**Visual Features:**
- Raw dollar amounts for each month
- % of revenue for each line item
- TTM totals in final column
- Trend indicators (⬆️ improving, ⬇️ worsening, ➡️ stable)
- Highlight cells with anomalies (>20% variance from average)
- Sparkline charts for quick trend visualization
- Expandable/collapsible sections

**Data Source:**
- Pull from `extraction_data.expense_detail` (if available)
- Fall back to aggregated expense categories
- Show warning if detailed line items not available

**Implementation Requirements:**
1. Parse expense_detail JSON from extraction_data
2. Pivot data to show months as columns
3. Calculate % of revenue for each cell
4. Identify anomalies (statistical outliers)
5. Generate trend indicators
6. Add export to Excel functionality

**Estimated Effort:** 8-12 hours

---

### 4. Calculator Tab (EXISTS - NO CHANGES NEEDED)
**Status:** ✅ Already exists and functional
**Purpose:** "What is this facility worth? Is the asking price fair?"

**Features:**
- Cap rate implied value
- Price per bed analysis
- Revenue & EBITDA multiples
- Market comparisons
- Purchase price recommendations

**No action needed** - This tab is complete and working.

---

### 5. Pro Forma Tab (JUST BUILT - NEEDS TESTING)
**Status:** ✅ Complete, awaiting testing
**Priority:** 🔴 HIGH - Validate and fix any issues
**File:** `frontend/src/components/ProFormaTab/ProFormaTab.jsx`

**Purpose:** "If we buy this, what's our return over 3-5 years?"

**Current Features (Built):**
- Interactive benchmark editing
- Real-time opportunity calculations
- EBITDA bridge waterfall chart
- Save/load/delete scenarios
- Color-coded variance indicators

**Still Missing:**
- [ ] IRR (Internal Rate of Return) calculation
- [ ] Equity multiple calculation
- [ ] Cash-on-cash return calculation
- [ ] Multi-year projection modeling (Years 1-5)
- [ ] Exit value estimation
- [ ] Returns waterfall chart (capital stack distribution)

**Next Steps:**
1. Test with real extraction data
2. Fix any bugs found
3. Validate calculation accuracy
4. Add returns modeling (IRR, etc.) - estimated 6-8 hours

---

### 6. Observations Tab (EXPAND EXISTING)
**Status:** 🔄 Needs expansion
**Priority:** 🟡 MEDIUM
**Current Status:** Basic observations exist, needs structure

**Purpose:** AI insights + user collaboration

**Three Sections (Each with AI + User Comments):**

#### Section A: Data Quality Notes
- What's missing that we need for better analysis?
- Which metrics are incomplete or unreliable?
- What additional documents should we request?

**Example:**
> AI: "Occupancy data only available for 6 of 12 months. Request full year census report for accurate trend analysis."
> User Comment: "Called seller - they're sending Q3/Q4 census reports tomorrow."

#### Section B: Key Observations
- Important findings from the data
- Notable trends or patterns
- Red flags or positive indicators

**Example:**
> AI: "Agency staffing costs are 17.9% of direct care - significantly above industry standard of 2-5%. This represents ~$250K annual opportunity."
> User Comment: "Spoke with ED - they've had trouble retaining CNAs due to low wages. New wage structure implemented in Sept should help."

#### Section C: Biggest Opportunities
- Top value-creation opportunities identified
- Ranked by impact (dollar amount)
- Feasibility assessment

**Example:**
> AI: "Top 3 opportunities: 1) Reduce agency staffing ($250K), 2) Increase occupancy 82%→85% ($184K), 3) Optimize food cost ($72K). Total opportunity: $506K annually."
> User Comment: "Agency reduction is aggressive but doable. Occupancy increase depends on staffing first. Food cost needs new dietary director."

**Implementation:**
- Each section has:
  - AI-generated content (stored in database, regenerates on demand)
  - User comments field (rich text editor)
  - Last updated timestamp
  - "Regenerate AI insights" button
- Comments saved to `deal_comments` table (already exists)
- UI: Collapsible cards, one per section

**Estimated Effort:** 4-6 hours

---

### 7. Projections Tab (DELETE)
**Status:** 🗑️ Mark for removal
**Priority:** 🟡 MEDIUM
**Reason:** Functionality replaced by Pro Forma tab

**Action Items:**
- [ ] Remove tab from navigation
- [ ] Archive component code (don't delete - may have useful logic)
- [ ] Redirect old links to Pro Forma tab
- [ ] Update any tutorials/documentation

**Estimated Effort:** 1 hour

---

## 🐛 Known Bugs and Issues

### 1. TTM Financials Bug - CRITICAL
**Status:** 🔄 IN PROGRESS (separate Claude Code window)
**Priority:** 🔴 CRITICAL
**Impact:** Foundation - everything depends on accurate data

**Description:**
Period analyzer is only pulling through August when September data is available.

**Expected Behavior:**
When YTD file has data through September and T12 file has May-April, should combine:
- Oct-Feb: From T12 file
- Mar-Sep: From YTD file
- Result: Oct 2024 - Sep 2025 (most recent 12 months)

**Actual Behavior:**
Stops at August, resulting in:
- Oct 2024 - Aug 2025 (only 11 months)

**Root Cause:**
Likely in `backend/services/periodAnalyzer.js` - off-by-one error in month parsing or date comparison logic.

**Files to Check:**
- `backend/services/periodAnalyzer.js` - Period detection logic
- `backend/services/aiExtractor.js` - How period analysis gets used

**Testing Data:**
Odd Fellows Home documents - has both T12 (May-Apr) and YTD (Mar-Sep) files

**Estimated Fix Time:** 2-3 hours

---

### 2. Pro Forma Data Flow Issues
**Status:** ⚠️ UNKNOWN - Needs testing
**Priority:** 🔴 HIGH

**Potential Issues:**
- Is extraction_data flowing correctly to Pro Forma tab?
- Are expense_detail fields populated?
- Are expense_ratios calculated and stored?
- Is the calculator API endpoint returning normalized_metrics?

**Testing Needed:**
1. Upload documents with detailed P&L
2. Run extraction
3. Verify extraction_data structure in database
4. Open Pro Forma tab
5. Check browser console for errors
6. Verify data displays in table
7. Test benchmark editing and recalculation

**Next Action:** Full integration test (see Testing Checklist section)

---

## 🚀 Additional Features (Beyond Pro Forma)

### 1. Source Citation with PDF Highlighting
**Status:** ❌ NOT STARTED
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 12-16 hours

**Description:**
Any populated data field should show its source. Clicking the source opens the PDF with highlighting at the exact location where data was found.

**Example:**
```
Annual Revenue: $5,000,000
Source: Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45
        [📄 View Source]
```

Clicking "[📄 View Source]" opens PDF viewer, scrolls to page, highlights relevant text.

**Implementation Requirements:**

1. **Store Location Data (Already Done)**
   - AI extraction already returns source citations:
     ```json
     {
       "value": 5000000,
       "source": "Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45 | 'Total Revenue: $3,933,015'"
     }
     ```

2. **Parse Source String**
   - Extract: document name, location (page/sheet/row), snippet
   - Map document name to file ID in database

3. **PDF Viewer Component**
   - Use PDF.js or react-pdf library
   - Navigate to specific page
   - Highlight search text

4. **Excel Viewer (Optional)**
   - Use SheetJS + highlighting library
   - Or screenshot the relevant sheet area

5. **UI Components**
   - Source citation badge/link on each data field
   - Modal or sidebar with document viewer
   - Highlight animation on open

**Dependencies:**
- PDF.js or react-pdf: `npm install react-pdf`
- SheetJS: `npm install xlsx` (already installed)

**Files to Create:**
- `frontend/src/components/DocumentViewer/DocumentViewer.jsx`
- `frontend/src/components/DocumentViewer/PDFViewer.jsx`
- `frontend/src/components/DocumentViewer/ExcelViewer.jsx`
- `frontend/src/components/SourceCitation/SourceCitation.jsx`

**Usage Example:**
```jsx
<SourceCitation
  source="Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45"
  documentId={doc.id}
  onViewSource={() => openDocumentViewer(doc.id, 'Sheet:Summary', 'row:45')}
/>
```

---

### 2. Comments System Integration
**Status:** 🔄 PARTIAL (backend exists, UI needed)
**Priority:** 🟡 MEDIUM
**Estimated Effort:** 6-8 hours

**Description:**
Users can add comments to deals. Backend table `deal_comments` already exists.

**Database Schema (Existing):**
```sql
CREATE TABLE deal_comments (
  id INTEGER PRIMARY KEY,
  deal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  comment_text TEXT,
  section VARCHAR(50),  -- 'data_quality', 'observations', 'opportunities', etc.
  created_at DATETIME,
  updated_at DATETIME
);
```

**Integration Points:**

1. **Observations Tab**
   - Add comment box to each of 3 sections
   - Save with section identifier
   - Display all comments for that section

2. **Global Comments**
   - "Comments" section at bottom of deal page
   - Shows all comments across all tabs/sections
   - Filter by section or show all

3. **Inline Comments (Future)**
   - Add comment icon next to any data field
   - Attach comment to specific metric
   - Store field name in section column

**UI Components Needed:**
- `CommentBox.jsx` - Input field + submit button
- `CommentList.jsx` - Display list of comments
- `CommentItem.jsx` - Single comment with edit/delete

**API Endpoints Needed:**
```javascript
GET /api/deals/:dealId/comments
GET /api/deals/:dealId/comments?section=data_quality
POST /api/deals/:dealId/comments
PUT /api/deals/:dealId/comments/:commentId
DELETE /api/deals/:dealId/comments/:commentId
```

**Files to Create:**
- `frontend/src/components/Comments/CommentBox.jsx`
- `frontend/src/components/Comments/CommentList.jsx`
- `frontend/src/components/Comments/CommentItem.jsx`
- `backend/routes/comments.js` (if not exists)

---

### 3. Pro Forma as Full Financial Modeling Tool
**Status:** 🔄 PARTIAL (benchmarks done, returns not done)
**Priority:** 🔴 HIGH
**Estimated Effort:** 8-12 hours

**Description:**
Expand Pro Forma beyond just benchmarks to full P&L modeling with IRR calculations.

**Additional Features Needed:**

#### A. Returns Modeling
Calculate investor returns based on:
- Purchase price
- Down payment %
- Loan terms (rate, amortization)
- Operating assumptions (occupancy ramp, expense improvements)
- Hold period (3, 5, 7 years)
- Exit cap rate

**Metrics to Calculate:**
- IRR (Internal Rate of Return)
- Equity Multiple (Cash out / Cash in)
- Cash-on-Cash Return (Annual CF / Equity invested)
- NPV (Net Present Value)
- Payback Period

**Implementation:**
```javascript
// backend/services/returnsCalculator.js

class ReturnsCalculator {
  static calculateIRR(cashFlows) {
    // Use Newton-Raphson method or npm package 'irr'
  }

  static calculateReturns(deal, assumptions) {
    // 1. Build cash flow projection (Years 0-5)
    // 2. Calculate annual NOI with ramp
    // 3. Calculate debt service
    // 4. Calculate distributable cash flow
    // 5. Calculate exit proceeds
    // 6. Run IRR calculation
    // 7. Calculate equity multiple
    // 8. Return all metrics
  }
}
```

**UI Additions:**
- "Returns" section in Pro Forma tab
- Inputs: Purchase price, down payment %, loan rate, hold period
- Display: IRR, Equity Multiple, Cash-on-Cash
- Chart: Cash flow waterfall over hold period

#### B. Multi-Year Projection
Currently shows stabilized state. Need year-by-year ramp:

| Year | Occupancy | Revenue | EBITDA | Cash Flow |
|------|-----------|---------|--------|-----------|
| 1 | 84% | $5.1M | $360K | $120K |
| 2 | 86% | $5.3M | $450K | $210K |
| 3 | 88% | $5.5M | $520K | $280K |
| 4 | 88% | $5.6M | $540K | $300K |
| 5 | 88% | $5.7M | $550K | $310K |

**Implementation:**
- Add ramp assumptions (months to stabilization)
- Calculate graduated improvements
- Store yearly_projections in scenario

#### C. Capital Stack Visualization
Show how returns are distributed:
- Preferred return to investors
- Promote to sponsor
- Remaining cash flow split

**Priority:** After core Pro Forma testing complete

---

### 4. Interactive SNFalyze Analyzer
**Status:** ❌ NOT STARTED
**Priority:** 🟢 LOW
**Estimated Effort:** 4-6 hours

**Description:**
Make the algorithm results interactive on deal page, not just static output.

**Current State:**
SNFalyze algorithm returns a deal score and recommendation, displayed as static text.

**Target State:**
- Users can adjust algorithm inputs (weights, thresholds)
- See how changes affect the deal score in real-time
- Visual sliders for key factors
- Compare multiple deals side-by-side

**Example:**
```
Current Score: 72/100 (STRONG BUY)

Adjust Weights:
[========] Location Quality (20%)
[==========] Financial Performance (30%)
[======] Payer Mix (15%)
[=====] Occupancy (10%)
[=====] Expense Efficiency (15%)
[====] Growth Potential (10%)

New Score: 68/100 (BUY)
```

**Implementation:**
- Load algorithm logic to frontend
- Add weight adjustment sliders
- Recalculate score on change
- Persist user's custom weights to profile

---

### 5. Cross-Deal AI Analysis
**Status:** ❌ NOT STARTED
**Priority:** 🟢 LOW
**Estimated Effort:** 12-16 hours

**Description:**
AI analyzes multiple deals at once, compares them, identifies best opportunities across portfolio.

**Use Cases:**
1. **Deal Comparison**
   - "Compare deals A, B, and C - which has the best returns?"
   - Side-by-side table with key metrics
   - AI recommendation with reasoning

2. **Portfolio Analysis**
   - "What are my top 5 deals by IRR?"
   - "Which deals have the highest risk?"
   - "Show me all Oregon ALF deals under $5M"

3. **Pattern Detection**
   - "Which region has the best margins?"
   - "Do larger facilities have better EBITDA margins?"
   - "Which seller brokers have the most accurate financials?"

**Implementation:**
```javascript
// New endpoint
POST /api/deals/analyze-multiple

Request:
{
  deal_ids: [1, 2, 3, 4, 5],
  analysis_type: "comparison" | "ranking" | "pattern_detection",
  criteria: ["irr", "ebitda_margin", "occupancy"]
}

Response:
{
  summary: "Deal #3 (Portland ALF) offers the best risk-adjusted return...",
  comparison_table: [...],
  recommendations: [...]
}
```

**UI:**
- Checkbox selection on deals list page
- "Analyze Selected" button
- New modal/page with comparison results
- Export comparison as PDF

---

## 🧪 Comprehensive Testing Checklist

### Backend Testing
- [ ] Backend starts without errors (`npm start`)
- [ ] Database syncs successfully (`npm run db:sync`)
- [ ] All migrations run without errors
- [ ] Existing extraction API still works
- [ ] New extraction includes expense_detail in response
- [ ] Calculator endpoint returns normalized_metrics
- [ ] Pro forma calculate endpoint returns opportunities
- [ ] Scenario save endpoint creates database record
- [ ] Scenario load endpoint returns saved data
- [ ] Scenario delete endpoint removes record

### Frontend Testing
- [ ] Frontend starts without errors (`npm start`)
- [ ] No console errors on page load
- [ ] Deal detail page renders all tabs
- [ ] Overview tab displays (once built)
- [ ] Pro Forma tab renders without errors
- [ ] Table displays current financial data
- [ ] Benchmark inputs are editable
- [ ] Editing a benchmark triggers recalculation (500ms debounce)
- [ ] Variance cells show correct colors (green/yellow/red)
- [ ] Waterfall chart renders
- [ ] Summary cards show correct totals
- [ ] Can open save scenario modal
- [ ] Can save a scenario with name
- [ ] Saved scenario appears in dropdown
- [ ] Can load a saved scenario
- [ ] Loading scenario updates benchmarks
- [ ] Can delete a scenario
- [ ] Reset to defaults button works
- [ ] Success/error messages display correctly

### Integration Testing
- [ ] Upload test documents to a deal
- [ ] Run AI extraction
- [ ] Verify extraction_data populated in database
- [ ] Open Pro Forma tab
- [ ] Verify data flows to component
- [ ] Adjust multiple benchmarks
- [ ] Verify calculations are accurate
- [ ] Save scenario
- [ ] Reload page
- [ ] Load saved scenario
- [ ] Verify benchmarks match saved values
- [ ] Navigate between tabs without losing data

### Regression Testing
- [ ] Calculator tab still works
- [ ] Document upload still works
- [ ] AI extraction quality unchanged
- [ ] User authentication still works
- [ ] Deal list page still works
- [ ] No performance degradation

---

## 🧪 Sample Test Data

Use **Odd Fellows Home of Oregon** for testing:

```javascript
{
  // Facility Info
  facility_name: "Odd Fellows Home of Oregon",
  facility_type: "Assisted Living",
  location: "Portland, OR",
  state: "OR",
  bed_count: 100,

  // T12 Financials (Oct 2024 - Sep 2025)
  total_revenue: 3933015,        // $3.9M
  total_expenses: 5035549,       // $5.0M
  net_income: -1102534,          // -$1.1M (LOSS)

  // Profitability (all negative)
  ebit: -1053534,
  ebitda: -706544,               // -$706K
  ebitdar: -658544,              // -$658K
  ebitda_margin: -18.0,          // -18% margin

  // Census & Occupancy
  avg_daily_census: 94,
  occupancy_pct: 94,             // 94% occupied

  // Payer Mix
  medicaid_pct: 78.5,            // Heavy Medicaid
  private_pay_pct: 21.5,         // Low private pay
  medicare_pct: 0,

  // Expense Issues (RED FLAGS)
  labor_pct: 73.2,               // 73% of revenue (Target: 55%)
  agency_staffing_total: 320108, // $320K agency costs
  agency_pct_of_labor: 17.9,     // 17.9% of labor (Target: 2%)
  food_cost_per_day: 12.80,      // $12.80/day (Target: $10.50)
  management_fee_pct: 5.5,       // 5.5% (Target: 4%)
  bad_debt_pct: 2.8,             // 2.8% (Target: 0.5%)

  // Department Totals
  total_direct_care: 1787943,
  total_activities: 85432,
  total_culinary: 398421,
  total_housekeeping: 142801,
  total_maintenance: 156293,
  total_administration: 312456,
  total_general: 189234,
  total_property: 963069
}
```

**Why This is Good Test Data:**
- ❌ **Currently Unprofitable** - Lots of improvement opportunities
- ❌ **Critical Issues** - Agency staffing at 17.9% (should be 2%)
- ❌ **High Labor** - 73% of revenue (should be 55%)
- ✅ **High Occupancy** - 94% (good)
- ⚠️ **Heavy Medicaid** - 78.5% (challenging payer mix)
- 💰 **Big Turnaround Opportunity** - $1M+ potential improvement

**Expected Pro Forma Results:**
```javascript
{
  opportunities: [
    { category: "Labor Optimization", opportunity: 718000 },      // 73% → 55%
    { category: "Agency Reduction", opportunity: 288000 },        // 17.9% → 2%
    { category: "Food Cost", opportunity: 79000 },                // $12.80 → $10.50
    { category: "Management Fee", opportunity: 59000 },           // 5.5% → 4%
    { category: "Bad Debt", opportunity: 90000 }                  // 2.8% → 0.5%
  ],
  total_opportunity: 1234000,                                     // $1.2M+
  stabilized_ebitda: 527456,                                      // From -$706K to +$527K
  stabilized_margin: 13.4                                         // From -18% to +13%
}
```

---

## 🚀 Deployment Specifics

### Platform: Render

**Repository:** GitHub
**Deployment Method:** Auto-deploy on push to `main` branch

**Services:**
1. **Backend Service** - Node.js + Express
   - Build Command: `npm install`
   - Start Command: `npm start` or `node app_snfalyze.js`
   - Environment Variables:
     - `DATABASE_URL` - PostgreSQL connection string (auto-set by Render)
     - `ANTHROPIC_API_KEY` - Claude AI key
     - `JWT_SECRET` - Authentication secret
     - `NODE_ENV=production`

2. **Frontend Service** - React
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`
   - Environment Variables:
     - `REACT_APP_API_URL` - Backend URL

3. **Database** - PostgreSQL
   - Managed by Render
   - Automatic backups
   - Connection string auto-injected as `DATABASE_URL`

### Deployment Workflow

```bash
# 1. Make changes locally
# 2. Test locally

# 3. Commit changes
git add .
git commit -m "Descriptive commit message"

# 4. Push to GitHub
git push origin main

# 5. Render auto-deploys on push
# Monitor deployment at: https://dashboard.render.com

# 6. Run database sync if schema changed
# Option A: Via Render Shell
# - Go to backend service → Shell
# - Run: npm run db:sync

# Option B: Add auto-sync to app.js
# Add this to backend/app_snfalyze.js:
const db = require('./models');
db.sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced successfully');
});
```

### Post-Deployment Verification

```bash
# Check backend health
curl https://snfalyze-backend.onrender.com/api/health

# Check frontend loads
curl https://snfalyze.onrender.com

# Test API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://snfalyze-backend.onrender.com/api/deals/1
```

### Database Migration Checklist

When deploying schema changes:
- [ ] Backup production database first
- [ ] Test migration on staging environment
- [ ] Run migration via Render Shell: `npm run db:sync`
- [ ] Verify tables created: `\dt` in psql
- [ ] Run seed data if needed: `npm run seed`
- [ ] Test API endpoints to verify schema
- [ ] Monitor error logs for 24 hours

---

## 🎯 Updated Priority Order

Based on business impact and dependencies:

| Priority | Item | Status | Estimated Effort | Business Impact |
|----------|------|--------|------------------|-----------------|
| **1** | Fix TTM Financials Bug | 🔄 IN PROGRESS | 2-3 hours | 🔴 CRITICAL - Blocks everything |
| **2** | Pro Forma Testing & Bug Fixes | ⚠️ NEEDS TESTING | 4-6 hours | 🔴 CRITICAL - Just built |
| **3** | Overview Tab | 🔄 IN PROGRESS | 6-8 hours | 🔴 HIGH - First impression |
| **4** | Expense Analysis Tab | ❌ NOT STARTED | 8-12 hours | 🔴 HIGH - Supports valuation |
| **5** | Returns Modeling (IRR, Equity Multiple) | ❌ NOT STARTED | 8-12 hours | 🔴 HIGH - Completes ROI |
| **6** | Observations Tab Expansion | ❌ NOT STARTED | 4-6 hours | 🟡 MEDIUM - User collaboration |
| **7** | Comments System Integration | 🔄 PARTIAL | 6-8 hours | 🟡 MEDIUM - Team collaboration |
| **8** | Census & Revenue Analysis Expansion | ❌ NOT STARTED | 6-8 hours | 🟡 MEDIUM - Enhanced analysis |
| **9** | Source Citation with PDF | ❌ NOT STARTED | 12-16 hours | 🟡 MEDIUM - Data verification |
| **10** | Delete Projections Tab | ❌ NOT STARTED | 1 hour | 🟡 MEDIUM - Cleanup |
| **11** | Interactive Analyzer | ❌ NOT STARTED | 4-6 hours | 🟢 LOW - Nice-to-have |
| **12** | Cross-Deal Analysis | ❌ NOT STARTED | 12-16 hours | 🟢 LOW - Portfolio feature |

### Why This Order?

1. **Fix TTM Bug First** - Everything depends on accurate data
2. **Test & Fix Pro Forma** - Just built, need to validate before moving on
3. **Overview Tab** - First thing users see, sets the tone
4. **Expense Analysis** - Supports both Calculator and Pro Forma tabs
5. **Returns Modeling** - Completes the "ROI" mission
6. **Everything Else** - Enhancements and nice-to-haves

---

## 📞 Questions & Decisions Needed

### Open Questions

1. **Overview Tab AI Model**
   - Using Gemini 2.0 Flash or Claude?
   - Cache summary or regenerate each time?

2. **Returns Modeling Assumptions**
   - What default loan terms? (80% LTV, 6% rate, 25-year amortization?)
   - Default hold period? (5 years?)
   - Exit cap rate? (Current cap + 100bps?)

3. **Expense Analysis Tab Data**
   - What if only aggregated totals available (no monthly breakdown)?
   - Show warning or hide tab entirely?

4. **Comments Permissions**
   - Can users edit other users' comments?
   - Role-based permissions (admin can delete any comment)?

5. **Deployment Timing**
   - Deploy Pro Forma immediately after testing?
   - Wait until all 6 tabs redesigned?

### Decisions Made

1. ✅ **Tab Structure** - Settled on 6-tab layout
2. ✅ **Benchmark Defaults** - Using Cascadia standards (55% labor, 2% agency, etc.)
3. ✅ **Database Schema** - benchmark_configurations and deal_proforma_scenarios tables approved
4. ✅ **Calculation Debounce** - 500ms debounce on benchmark changes
5. ✅ **Scenario Storage** - Store only overrides (differences from defaults)

---

## 📚 Additional Resources

### Cascadia Benchmarks (Reference)

| Metric | Target | Max Acceptable | Critical |
|--------|--------|----------------|----------|
| EBITDA Margin | 9% | - | - |
| EBITDAR Margin | 23% | - | - |
| Occupancy | 85% | - | - |
| Labor % of Revenue | 55% | 62% | >68% |
| Agency % of Labor | 2% | 5% | >10% |
| Food Cost Per Day | $10.50 | $13.00 | >$16.00 |
| Management Fee % | 4% | 5% | >6% |
| Bad Debt % | 0.5% | 1.0% | >2.0% |
| Utilities % | 2.5% | 3.5% | >4.5% |

### Calculation Formulas

**EBITDA:**
```
EBITDA = Net Income + Interest + Taxes + Depreciation + Amortization
```

**EBITDAR:**
```
EBITDAR = EBITDA + Rent/Lease Expense
```

**Occupancy:**
```
Occupancy % = (Average Daily Census / Total Beds) × 100
```

**Revenue Per Occupied Bed:**
```
RPB = Annual Revenue / (Beds × Occupancy % × 365)
```

**Labor Opportunity:**
```
Opportunity = Current Labor $ - (Revenue × Target Labor %)
```

**Occupancy Opportunity:**
```
Additional Beds = Total Beds × (Target Occ % - Current Occ %)
Additional Revenue = Additional Beds × 365 × Revenue Per Bed Per Day
```

**IRR (Simplified):**
```
NPV = Σ [CF_t / (1 + IRR)^t] = 0
Where CF_t = Cash Flow in year t
Solve for IRR using Newton-Raphson method
```

---

**End of Enhanced Project Status Document**

*This document consolidates the Pro Forma feature status with the broader platform roadmap. Update as work progresses.*
