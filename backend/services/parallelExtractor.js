/**
 * Parallel Document Extraction Service
 * Runs multiple focused extraction prompts in parallel for faster, more reliable extraction
 */

const Anthropic = require('@anthropic-ai/sdk');
const { findFacilityMatches } = require('./facilityMatcher');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Model configuration
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 16384; // Large enough for 12+ months of detailed financial data
const MAX_TOKENS_OVERVIEW = 64000; // Desired max for overview (detailed markdown + 1000-char summary)
const CONTEXT_LIMIT = 200000; // Claude's context window limit
const TOKEN_BUFFER = 5000; // Safety buffer for system prompt overhead

/**
 * ===========================================
 * FOCUSED EXTRACTION PROMPTS
 * Each prompt extracts a specific category of data
 * ===========================================
 */

/**
 * Prompt 1: Facility & Deal Information
 */
const FACILITY_PROMPT = `You are extracting facility and deal information from healthcare M&A documents.

EXTRACT ONLY:
- Facility name
- Facility type (SNF, ALF, Memory Care, Independent Living, CCRC)
- State ONLY (for facility matching with ALF database)
- Contact information (name, title, phone, email)
- Deal name (if mentioned)
- Purchase price (if mentioned)

IMPORTANT - DO NOT EXTRACT:
- Street address, city, or zip code (will be auto-populated from ALF database)
- Bed/unit count (will be auto-populated from ALF database)

STATE EXTRACTION:
- Extract only the state where the facility is located
- State agencies (e.g., "Oregon DHS") indicate the state
- This will be used to match against the ALF database

Return JSON:
{
  "facility_name": {"value": string|null, "confidence": "high"|"medium"|"low"|"not_found", "source": "document | location | snippet"},
  "facility_type": {"value": string|null, "confidence": string, "source": string},
  "state": {"value": string|null, "confidence": string, "source": string},
  "contact_name": {"value": string|null, "confidence": string, "source": string},
  "contact_title": {"value": string|null, "confidence": string, "source": string},
  "contact_phone": {"value": string|null, "confidence": string, "source": string},
  "contact_email": {"value": string|null, "confidence": string, "source": string},
  "deal_name": {"value": string|null, "confidence": string, "source": string},
  "purchase_price": {"value": number|null, "confidence": string, "source": string}
}

Return ONLY valid JSON, no markdown.`;


/**
 * Prompt 2: Monthly Financial Data
 */
const FINANCIALS_PROMPT = `You are extracting monthly financial data from P&L statements and income/expense reports.

EXTRACT FOR EACH MONTH FOUND:
- Total revenue
- Revenue by payer (Medicaid, Medicare, Private Pay, Other)
- Total expenses
- Net income
- EBIT, EBITDA, EBITDAR (or components to calculate them)
- Depreciation, Interest expense, Rent/lease expense

IMPORTANT:
- Extract ALL months found in the documents
- Label each month clearly (YYYY-MM format, e.g., "2024-10")
- Include which document each value came from
- If a document covers multiple months, extract each month separately

CRITICAL MULTI-DOCUMENT HANDLING:
- Extract financial data from EVERY document that contains it (P&Ls, I&E reports, financial summaries)
- Include ALL months found across ALL documents (even if some overlap)
- Track which document each month's data came from via source_document field
- If a month appears in multiple documents, include BOTH records - they will be merged later
- Example: T12 P&L has Jun 2024-May 2025, YTD I&E has Mar 2025-Sep 2025 = extract all 16 months
- NEVER skip months from a newer document just because an older document covers the same period
- The reconciliation layer will intelligently merge overlapping data, so extract everything

Return JSON:
{
  "monthly_financials": [
    {
      "month": "YYYY-MM",
      "source_document": "filename",
      "source_location": "Sheet X, Row Y or Page Z",
      "total_revenue": number|null,
      "medicaid_revenue": number|null,
      "medicare_revenue": number|null,
      "private_pay_revenue": number|null,
      "other_revenue": number|null,
      "total_expenses": number|null,
      "operating_expenses": number|null,
      "depreciation": number|null,
      "amortization": number|null,
      "interest_expense": number|null,
      "rent_expense": number|null,
      "property_taxes": number|null,
      "property_insurance": number|null,
      "net_income": number|null,
      "ebit": number|null,
      "ebitda": number|null,
      "ebitdar": number|null
    }
  ],
  "period_summary": {
    "earliest_month": "YYYY-MM",
    "latest_month": "YYYY-MM",
    "total_months": number,
    "documents_analyzed": ["filename1", "filename2"]
  }
}

Return ONLY valid JSON, no markdown.`;


/**
 * Prompt 3: Monthly Expense Details by Department
 * CRITICAL: This prompt must extract MONTHLY data for ALL months found in the documents
 */
const EXPENSES_PROMPT = `You are extracting detailed MONTHLY expense breakdowns from P&L statements and financial reports.

CRITICAL PRIORITY: Extract data for EVERY MONTH found in the documents. This is essential for trend analysis and Pro Forma calculations.

STANDARD DEPARTMENT CATEGORIES (use exact names):
- direct_care: All nursing/direct care staff costs (RN, LPN, CNA wages, benefits, agency)
- activities: Activities staff, supplies, programs
- culinary: All dietary/food service (food costs, dietary labor, supplies)
- housekeeping: Housekeeping labor, laundry, supplies
- maintenance: Maintenance labor, repairs, utilities, plant operations
- administration: Administrative salaries, office expenses, professional fees
- general: G&A, marketing, insurance, other overhead
- property: Rent, property taxes, property insurance, depreciation

FOR EACH MONTH AND DEPARTMENT, EXTRACT:
- salaries_wages: Monthly salaries and wages
- benefits: Monthly benefits (health, retirement, etc.)
- payroll_taxes: Monthly payroll taxes
- agency_labor: Monthly agency/contract staffing costs
- contract_labor: Monthly contract labor costs
- supplies: Monthly supplies and materials
- food_cost: Food costs (for culinary department)
- utilities: Utility costs (for maintenance department)
- repairs_maintenance: Repair costs (for maintenance department)
- other_expenses: Other departmental expenses
- total_department_expense: Total for that department that month

ALSO EXTRACT OVERALL MONTHLY TOTALS (sum across all departments for each month):
- total_labor: All salaries + benefits + agency for the month
- total_agency: Total agency/contract labor for the month
- total_expenses: All expenses for the month

Return JSON:
{
  "monthly_expenses": [
    {
      "month": "YYYY-MM",
      "source_document": "filename",
      "department": "direct_care",
      "salaries_wages": number|null,
      "benefits": number|null,
      "payroll_taxes": number|null,
      "agency_labor": number|null,
      "contract_labor": number|null,
      "total_labor": number|null,
      "supplies": number|null,
      "food_cost": number|null,
      "utilities": number|null,
      "repairs_maintenance": number|null,
      "other_expenses": number|null,
      "total_department_expense": number|null
    }
  ],
  "monthly_totals": [
    {
      "month": "YYYY-MM",
      "total_labor": number|null,
      "total_agency": number|null,
      "raw_food_cost": number|null,
      "total_expenses": number|null,
      "source_document": "filename"
    }
  ],
  "department_totals": {
    "direct_care": {
      "total_salaries_wages": number|null,
      "total_benefits": number|null,
      "total_agency_labor": number|null,
      "total_supplies": number|null,
      "total_other": number|null,
      "department_total": number|null,
      "source_document": "filename"
    },
    "activities": { "department_total": number|null },
    "culinary": { "department_total": number|null, "raw_food_cost": number|null },
    "housekeeping": { "department_total": number|null },
    "maintenance": { "department_total": number|null, "utilities_total": number|null },
    "administration": { "department_total": number|null, "management_fees": number|null },
    "general": { "department_total": number|null, "insurance_total": number|null },
    "property": { "department_total": number|null, "rent_total": number|null }
  },
  "labor_summary": {
    "total_labor_cost": number|null,
    "total_agency_cost": number|null,
    "raw_food_cost": number|null,
    "utilities_total": number|null,
    "insurance_total": number|null,
    "management_fees": number|null,
    "period": "TTM"|"Annual"|"YTD",
    "months_of_data": number,
    "source_documents": ["filename1", "filename2"]
  },
  "summary": {
    "departments_found": ["direct_care", "culinary", "administration"],
    "months_covered": ["2024-10", "2024-11", "2024-12"],
    "total_months": number,
    "has_monthly_detail": true|false,
    "has_agency_detail": true|false
  }
}

CRITICAL MULTI-DOCUMENT HANDLING:
- Extract expense data from EVERY document that contains it (P&Ls, I&E reports, expense breakdowns)
- Include ALL months found across ALL documents (even if some overlap)
- Track which document each month's data came from via source_document field
- If a month appears in multiple documents, include BOTH records - they will be merged later
- Example: T12 P&L has Jun 2024-May 2025, YTD I&E has Mar 2025-Sep 2025 = extract all 16 months
- NEVER skip months from a newer document just because an older document covers the same period
- The reconciliation layer will intelligently merge overlapping data, so extract everything

IMPORTANT: Extract ALL months found in the documents. If a P&L covers Mar 2025 to Sep 2025, extract data for all 7 months.

Return ONLY valid JSON, no markdown.`;


/**
 * Prompt 4: Monthly Census and Occupancy
 */
const CENSUS_PROMPT = `You are extracting monthly census and occupancy data from ALL document types.

IMPORTANT: Census data appears in MULTIPLE document types - extract from ALL of them:
1. Dedicated Census Reports - detailed monthly census breakdowns
2. Income & Expense (I&E) Reports - often have "Payer Mix" or "Census Days" sections at the top
3. P&L Statements - may include census/occupancy summaries
4. Financial Summaries - often include Average Daily Census (ADC) data

LOOK FOR THESE SECTIONS IN ALL DOCUMENTS:
- "Payer Mix" with Medicaid/Private days
- "Census Days" breakdown by month
- "Average Daily Census" or "ADC" rows
- Any monthly columns with resident counts or patient days

EXTRACT FOR EACH MONTH:
1. total_beds: Total beds/units available (typically 30-200 for SNF/ALF)
2. average_daily_census: Average number of residents per day (must be <= total_beds)
3. occupancy_percentage: (average_daily_census / total_beds) * 100 - ALWAYS calculate this
4. Census days by payer type (Medicaid, Medicare, Private Pay, Other)
5. Payer mix percentages
6. Admissions and discharges (if available)

CRITICAL CALCULATION RULES - ALWAYS APPLY:
1. If you have total_census_days but NOT average_daily_census:
   - CALCULATE: average_daily_census = total_census_days / days_in_month
   - Days in month: Jan=31, Feb=28/29, Mar=31, Apr=30, May=31, Jun=30, Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31
   - Example: If June has total_census_days=2700, then ADC = 2700/30 = 90

2. If you have average_daily_census but NOT occupancy_percentage:
   - CALCULATE: occupancy_percentage = (average_daily_census / total_beds) * 100

3. If you have payer days (medicaid_days, medicare_days, etc.) but NOT total_census_days:
   - CALCULATE: total_census_days = medicaid_days + medicare_days + private_pay_days + other_payer_days
   - Then calculate ADC as above

CRITICAL DISTINCTIONS:
- average_daily_census is the NUMBER of residents (e.g., 85 residents)
- occupancy_percentage is the PERCENTAGE (e.g., 85% = 85.0)
- If you only have census numbers, calculate: occupancy_percentage = (census / beds) * 100
- If you only have percentages like "85%", that's occupancy_percentage not census

IMPORTANT:
- Extract ALL months found
- Census days should be actual resident days for the month
- Calculate payer mix as: (payer_days / total_days) * 100
- ALWAYS provide occupancy_percentage - calculate it if not directly stated
- ALWAYS calculate average_daily_census from total_census_days when ADC is not directly provided

Return JSON:
{
  "monthly_census": [
    {
      "month": "YYYY-MM",
      "source_document": "filename",
      "source_location": "Sheet X or Page Y",
      "total_beds": number|null,
      "average_daily_census": number|null,
      "occupancy_percentage": number|null,
      "total_census_days": number|null,
      "medicaid_days": number|null,
      "medicare_days": number|null,
      "private_pay_days": number|null,
      "other_payer_days": number|null,
      "medicaid_percentage": number|null,
      "medicare_percentage": number|null,
      "private_pay_percentage": number|null,
      "other_percentage": number|null,
      "admissions": number|null,
      "discharges": number|null
    }
  ],
  "summary": {
    "bed_count": number,
    "months_covered": number,
    "avg_occupancy": number,
    "payer_mix_available": true|false,
    "documents_analyzed": ["filename1", "filename2"]
  }
}

CRITICAL MULTI-DOCUMENT HANDLING:
- Extract census data from EVERY document that contains it
- Include ALL months found across ALL documents (even if some overlap)
- Track which document each month's data came from
- If a month appears in multiple documents, include BOTH records - they will be merged later
- Example: Census PDF has Jun 2024-May 2025, I&E XLS has Mar 2025-Sep 2025 = extract all 16 months

Return ONLY valid JSON, no markdown.`;


/**
 * Prompt 5: Rate Schedules
 */
const RATES_PROMPT = `You are extracting rate information from rate schedules and pricing documents.

EXTRACT:
1. PRIVATE PAY RATES:
   - Base rent by unit type (Studio, 1BR, 2BR, etc.)
   - Care level add-ons (Level 1, Level 2, etc.)
   - Second person/spouse fees
   - Effective dates if shown

2. MEDICAID RATES:
   - Rates by care level (Level 1 through Level 5)
   - Room and board components
   - State-specific rate information

3. MEDICARE RATES (if applicable):
   - Per diem rates
   - RUG/PDPM categories

Return JSON:
{
  "private_pay_rates": [
    {
      "unit_type": "Studio",
      "monthly_rate": number,
      "daily_rate": number|null,
      "care_levels": {
        "L1": number|null,
        "L2": number|null,
        "L3": number|null,
        "L4": number|null,
        "L5": number|null
      },
      "second_person_fee": number|null,
      "effective_date": "YYYY-MM-DD"|null,
      "source_document": "filename",
      "source_location": "Page X or specific location"
    }
  ],
  "medicaid_rates": [
    {
      "care_level": "Level 1",
      "monthly_rate": number|null,
      "daily_rate": number|null,
      "room_and_board": number|null,
      "effective_date": "YYYY-MM-DD"|null,
      "source_document": "filename",
      "source_location": "Page X"
    }
  ],
  "medicare_rates": [
    {
      "category": "string",
      "daily_rate": number|null,
      "source_document": "filename"
    }
  ],
  "summary": {
    "has_private_pay": true|false,
    "has_medicaid": true|false,
    "has_medicare": true|false,
    "rate_effective_date": "YYYY-MM-DD"|null
  }
}

Return ONLY valid JSON, no markdown.`;


/**
 * Prompt 6: Deal Overview & Stage 1 Screening
 */
/**
 * OVERVIEW_PROMPT - V7 Schema
 * Generates Stage 1 deal screening with Net Income focus (no EBITDAR calculation)
 * Must match buildExtractionPrompt() output in aiExtractor.js
 */
const OVERVIEW_PROMPT = `You are a healthcare M&A analyst generating a Stage 1 deal screening for an assisted living facility (ALF) or skilled nursing facility (SNF) acquisition.

---

## STEP 1: MANDATORY — FOLLOW PERIOD ANALYSIS

**If a "Target Period" and "Source Map" are provided in the FINANCIAL PERIOD ANALYSIS section, you MUST:**

1. Use EXACTLY the Target Period specified — do not calculate your own
2. Pull each month's data from the document specified in the Source Map
3. Report the period exactly as specified in \`ttm_financials.period\`

**DO NOT attempt to determine the TTM period yourself when guidance is provided.**

If NO period analysis is provided, then build the freshest TTM by:
1. Finding the most recent month with complete financial data
2. Working backwards 12 months
3. Combining multiple documents if needed

**NEVER use a pre-calculated T12 total when fresher monthly data exists in another document.**

---

## STEP 2: FINANCIAL EXTRACTION — NET INCOME FOCUS

Extract these line items for the TTM period:
- **Revenue** (total)
- **Expenses** (total)
- **Net Income** (Revenue - Expenses, or "Total Income/Loss" line)
- **Rent/Lease Expense** (extract separately as add-back)
- **Interest Expense** (extract separately as add-back)
- **Depreciation** (extract separately as add-back)

**DO NOT calculate EBITDAR.** Just report Net Income and the add-back components separately.

---

## STEP 3: RED FLAGS & STRENGTHS

Generate quantified issues and strengths.

**Red Flags** — Look for:
- Net Income margin below -5% (Critical)
- Occupancy below 80% (Critical if <75%, Significant if 75-80%)
- Agency staffing above 5% of direct care costs (Significant)
- Medicaid mix above 70% (Significant)
- Declining census trend (Significant)
- Missing critical data (Moderate)

**Strengths** — Look for:
- Occupancy above 90%
- Private pay mix above 40%
- Positive or improving net income trend
- Strong rate structure vs market
- Growth capacity (licensed beds > current census)

Every flag and strength MUST include a quantified impact (dollar amount or percentage).

---

## STEP 4: OUTPUT FORMAT

**Target: 3000-5000 characters total JSON output.**

Return valid JSON with this exact structure:

{
  "summary_1000_chars": "string (see format below)",

  "document_types_identified": ["P&L", "Census Report", "Rate Schedule"],

  "facility_snapshot": {
    "facility_name": "string|null",
    "facility_type": "ALF|SNF|Memory Care|null",
    "city": "string|null",
    "state": "string|null",
    "licensed_beds": "number|null",
    "beds_source": "explicit|inferred|null",
    "current_census": "number|null",
    "current_occupancy_pct": "number|null",
    "ownership_type": "string|null",
    "year_built": "number|null",
    "last_renovation": "string|null"
  },

  "ttm_financials": {
    "period": "string (e.g., 'Oct 2024 - Sep 2025')",
    "data_sources": "string (e.g., 'T12 P&L (Oct-Feb), YTD I&E (Mar-Sep)')",
    "revenue": "number",
    "expenses": "number",
    "net_income": "number",
    "net_income_margin_pct": "number",
    "rent_lease": "number",
    "interest": "number",
    "depreciation": "number",
    "avg_census": "number|null",
    "revenue_per_resident_day": "number|null"
  },

  "payer_mix": {
    "medicaid_pct": "number|null",
    "private_pay_pct": "number|null",
    "medicaid_revenue": "number|null",
    "private_pay_revenue": "number|null"
  },

  "operating_trends": {
    "period_comparison": "string (e.g., 'Jul-Sep 2025 vs Mar-Jun 2025')",
    "revenue_trend": "UP|FLAT|DOWN",
    "census_trend": "UP|FLAT|DOWN",
    "net_income_trend": "UP|FLAT|DOWN",
    "trend_summary": "string (1-2 sentences explaining key trends)"
  },

  "red_flags": [
    {
      "issue": "string (brief title)",
      "impact": "string (quantified, <50 chars)",
      "severity": "Critical|Significant|Moderate"
    }
  ],

  "strengths": [
    {
      "strength": "string (brief title)",
      "value": "string (quantified benefit)"
    }
  ],

  "turnaround": {
    "required": "boolean (true if net_income_margin_pct < -5%)",
    "top_initiatives": ["string (max 3, one line each)"],
    "investment_needed": "number|null",
    "timeline_months": "number|null",
    "key_risk": "string|null"
  },

  "diligence_items": ["string (max 5, prioritized)"],

  "rate_information": {
    "private_pay_rates": "string (summary of rate structure)",
    "medicaid_rates": "string (summary of state rates)",
    "rate_gap": "string|null (private vs medicaid gap)"
  },

  "source_citations": {
    "revenue_source": "string (document, location)",
    "census_source": "string (document, location)",
    "rates_source": "string (document, location)"
  }
}

---

## SUMMARY FORMAT (summary_1000_chars)

Generate this FIRST. Maximum 1000 characters.

**[Facility Name]** — [X]-bed [Type], [City, State] ([X]% occupied)

**TTM ([Mon Year - Mon Year]):** Revenue $X.XM | Net Income ($XK) | Margin X%

**Add-backs:** Rent $XK | Interest $XK | Depreciation $XK

**Trends:** Revenue [↑/→/↓] | Census [↑/→/↓] | Net Income [↑/→/↓]

**Issues:**
• [Issue 1 — quantified]
• [Issue 2 — quantified]
• [Issue 3 — quantified]

**Upside:** [Opportunity — quantified]

**Key Diligence:** [Top 1-2 items to verify]

Use ↑ ↓ → for trend arrows. Use • for bullet points.

---

## CRITICAL RULES

1. **FOLLOW PERIOD ANALYSIS** — If Target Period provided, use it exactly. Do not recalculate.

2. **Net Income is primary** — Pull from P&L. Show rent/interest/depreciation separately. DO NOT calculate EBITDAR.

3. **Quantify everything** — Every red flag and strength needs a dollar amount or percentage.

4. **Keep it lean:**
   - Max 5 red flags
   - Max 3 strengths
   - Max 3 turnaround initiatives
   - Max 5 diligence items

5. **Benchmarks for flags:**
   - Occupancy target: 85%
   - Agency staffing: <5% of direct care
   - Medicaid mix concern: >70%
   - Net Income margin concern: < -5%

6. **Missing data** — Use null, flag in red_flags if critical.

7. **Location validation** — If city doesn't match state, set city to null.

8. **Numeric values** — Return raw numbers only (no $, %, commas). Negative losses stay negative.

9. **Summary first** — Generate summary_1000_chars before other fields.

10. **No fabrication** — If data not in documents, use null or flag as diligence item.

Return ONLY valid JSON, no markdown.`;


/**
 * Repair truncated JSON by finding the last valid array element and properly closing
 * @param {string} jsonStr - Potentially truncated JSON string
 * @returns {string} Repaired JSON string
 */
function repairTruncatedJson(jsonStr) {
  let trimmed = jsonStr.trimEnd();

  // Strategy: Find the last complete object in the main array
  // Pattern for financial/expense/census data: {"monthly_xxx": [{...}, {...}, ...]}

  // First, check if we're in the middle of a string
  let inString = false;
  let escape = false;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escape) { escape = false; continue; }
    if (char === '\\' && inString) { escape = true; continue; }
    if (char === '"') { inString = !inString; }
  }

  // If truncated inside a string, cut back to last complete object
  if (inString) {
    console.log('[JSON Repair] Truncation inside string, finding last complete object...');
  }

  // Try progressively more aggressive truncation until valid JSON
  // Start from the end and find each "}," backwards
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    attempts++;

    // Find the last "}," which marks end of a complete array element
    let cutPoint = -1;
    let searchStart = trimmed.length;

    // Look for last "}," not inside a string
    for (let pos = trimmed.length - 1; pos > 0; pos--) {
      if (trimmed[pos] === ',' && trimmed[pos - 1] === '}') {
        // Check if this } is inside a string
        let insideStr = false;
        let esc = false;
        for (let j = 0; j < pos - 1; j++) {
          const c = trimmed[j];
          if (esc) { esc = false; continue; }
          if (c === '\\' && insideStr) { esc = true; continue; }
          if (c === '"') { insideStr = !insideStr; }
        }
        if (!insideStr) {
          cutPoint = pos - 1; // Position of the }
          break;
        }
      }
    }

    if (cutPoint <= 0) {
      // No more "}," found, try to just close what we have
      break;
    }

    // Cut at this point (keep the })
    let candidate = trimmed.slice(0, cutPoint + 1);

    // Count open/close to determine what closers we need
    let openBraces = 0, openBrackets = 0;
    inString = false;
    escape = false;

    for (let i = 0; i < candidate.length; i++) {
      const char = candidate[i];
      if (escape) { escape = false; continue; }
      if (char === '\\' && inString) { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    }

    // If we're still inside a string after processing, this cut point isn't valid
    if (inString) {
      // Try an earlier cut point
      trimmed = candidate.slice(0, -1); // Remove this } and try again
      continue;
    }

    // Close remaining open structures
    let closers = '';
    for (let i = 0; i < openBrackets; i++) closers += ']';
    for (let i = 0; i < openBraces; i++) closers += '}';

    const repaired = candidate + closers;

    // Test if it parses
    try {
      JSON.parse(repaired);
      console.log(`[JSON Repair] Success after ${attempts} attempts, cut ${trimmed.length - cutPoint} chars`);
      return repaired;
    } catch (e) {
      // This cut point didn't work, try earlier
      trimmed = candidate.slice(0, -1);
    }
  }

  // Fallback: aggressive repair - just close everything
  console.log('[JSON Repair] Using fallback repair strategy...');

  // Count current state
  let openBraces = 0, openBrackets = 0;
  inString = false;
  escape = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escape) { escape = false; continue; }
    if (char === '\\' && inString) { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
  }

  // If stuck in string, close it
  if (inString) {
    trimmed += '"';
  }

  // Remove trailing junk
  trimmed = trimmed.replace(/,\s*$/, '');
  trimmed = trimmed.replace(/:\s*$/, ':null');

  // Add closers
  for (let i = 0; i < openBrackets; i++) trimmed += ']';
  for (let i = 0; i < openBraces; i++) trimmed += '}';

  return trimmed;
}


/**
 * Run a single focused extraction
 * @param {string} documentText - Combined text from all documents
 * @param {string} systemPrompt - The focused extraction prompt
 * @param {string} extractionType - Name of extraction for logging
 * @param {number} maxTokens - Optional max tokens override (defaults to MAX_TOKENS)
 * @returns {Promise<Object>} Extracted data
 */
async function runFocusedExtraction(documentText, systemPrompt, extractionType, maxTokens = MAX_TOKENS) {
  const startTime = Date.now();

  try {
    // Estimate input tokens (rough estimate: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil((documentText?.length || 0) / 4);

    // Calculate available tokens for output, ensuring we don't exceed context limit
    const availableForOutput = CONTEXT_LIMIT - estimatedInputTokens - TOKEN_BUFFER;
    const effectiveMaxTokens = Math.min(maxTokens, Math.max(availableForOutput, 8000)); // Minimum 8000 tokens

    console.log(`[${extractionType}] Starting extraction...`);
    console.log(`[${extractionType}] Document text length: ${documentText?.length || 0} chars (~${estimatedInputTokens} tokens)`);
    console.log(`[${extractionType}] Requested max_tokens: ${maxTokens}, Effective max_tokens: ${effectiveMaxTokens}`);

    let responseText = '';

    // Use streaming for large token requests (>20k) to avoid 10-minute timeout
    if (effectiveMaxTokens > 20000) {
      console.log(`[${extractionType}] Using streaming due to high token count...`);

      const stream = await anthropic.messages.stream({
        model: MODEL,
        max_tokens: effectiveMaxTokens,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Extract the relevant information from these documents:\n\n${documentText}`
        }]
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          responseText += chunk.delta.text;
        }
      }
      console.log(`[${extractionType}] Streaming complete. Response length: ${responseText.length} chars`);
      if (extractionType === 'overview') {
        console.log(`[overview] Raw response preview (first 500 chars): ${responseText.substring(0, 500)}`);
      }
    } else {
      // Use regular (non-streaming) for smaller requests
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: effectiveMaxTokens,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Extract the relevant information from these documents:\n\n${documentText}`
        }]
      });

      responseText = response.content[0].text;
    }

    // Parse JSON with repair logic
    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
      if (extractionType === 'overview') {
        console.log(`[overview] Parse successful. Keys: ${Object.keys(extractedData).join(', ')}`);
      }
    } catch (parseError) {
      console.log(`[${extractionType}] Initial parse failed: ${parseError.message}`);
      if (extractionType === 'overview') {
        console.log(`[overview] Failed response (first 1000 chars): ${responseText.substring(0, 1000)}`);
      }

      // Try to extract JSON from response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
        || responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];

        // Repair common JSON issues
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control chars

        // Try to repair truncated JSON
        jsonStr = repairTruncatedJson(jsonStr);

        try {
          extractedData = JSON.parse(jsonStr);
          console.log(`[${extractionType}] JSON repair successful`);
        } catch (repairError) {
          console.error(`[${extractionType}] JSON repair failed:`, repairError.message);
          // Log the problematic section for debugging
          const errorPos = parseInt(repairError.message.match(/position (\d+)/)?.[1] || 0);
          if (errorPos > 0) {
            console.error(`[${extractionType}] Context around error: ...${jsonStr.slice(Math.max(0, errorPos - 50), errorPos + 50)}...`);
          }
          return { success: false, error: `JSON parse error: ${repairError.message}`, type: extractionType };
        }
      } else {
        return { success: false, error: 'No JSON found in response', type: extractionType };
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[${extractionType}] Completed in ${duration}ms`);

    return {
      success: true,
      type: extractionType,
      data: extractedData,
      duration
    };

  } catch (error) {
    console.error(`[${extractionType}] Extraction error:`, error.message);
    if (extractionType === 'overview') {
      console.error(`[overview] Full error:`, error);
      console.error(`[overview] Error stack:`, error.stack);
    }
    return {
      success: false,
      type: extractionType,
      error: error.message
    };
  }
}


/**
 * Find facility matches from ALF database (does NOT auto-populate)
 * Stores matches for user review and selection
 * @param {Object} organized - Organized extraction results
 */
async function enrichFacilityData(organized) {
  try {
    // Check if we have overview data with facility info
    if (!organized.overview || !organized.overview.facility_snapshot) {
      console.log('[Facility Match] No facility snapshot in overview, skipping matching');
      return;
    }

    const facility = organized.overview.facility_snapshot;
    const facilityName = facility.facility_name;

    // Need at least a facility name to attempt matching
    if (!facilityName) {
      console.log('[Facility Match] No facility name found, skipping matching');
      return;
    }

    console.log(`[Facility Match] Searching for matches: "${facilityName}"`);
    console.log(`[Facility Match] Search params - State: ${facility.state || 'null'}`);

    // Find top 5 matches from ALF database (70% threshold for broader search)
    const matches = await findFacilityMatches(
      facilityName,
      null, // Don't filter by city - AI might extract it wrong
      facility.state || null,
      0.70, // Lower threshold to show more potential matches
      5 // Top 5 matches
    );

    if (!matches || matches.length === 0) {
      console.log('[Facility Match] No matches found in ALF database');
      organized.overview.facility_matches = {
        status: 'no_matches',
        search_name: facilityName,
        search_state: facility.state
      };
      return;
    }

    console.log(`[Facility Match] Found ${matches.length} potential matches`);
    matches.forEach((match, idx) => {
      console.log(`  ${idx + 1}. ${match.facility_name} - ${match.city}, ${match.state} (${(match.match_score * 100).toFixed(1)}% - ${match.match_confidence})`);
    });

    // Store ALL matches for user review (no auto-population)
    organized.overview.facility_matches = {
      status: 'pending_review',
      search_name: facilityName,
      search_state: facility.state,
      matches: matches.map(match => ({
        facility_id: match.facility_id,
        facility_name: match.facility_name,
        address: match.address,
        city: match.city,
        state: match.state,
        zip_code: match.zip_code,
        capacity: match.capacity,
        facility_type: match.facility_type,
        ownership_type: match.ownership_type,
        phone: match.phone,
        latitude: match.latitude,
        longitude: match.longitude,
        match_score: match.match_score,
        match_confidence: match.match_confidence
      })),
      total_matches: matches.length
    };

    console.log(`[Facility Match] ✅ Stored ${matches.length} matches for user review`);

  } catch (error) {
    console.error('[Facility Match] Error during matching:', error.message);
    // Don't fail the entire extraction if matching fails
    if (organized.overview) {
      organized.overview.facility_matches = {
        status: 'error',
        error: error.message
      };
    }
  }
}


/**
 * Run all extractions in parallel
 * @param {string} combinedDocumentText - Text from all documents, labeled
 * @param {string} contextSection - Optional context guidance (period analysis or facility context for portfolios)
 * @returns {Promise<Object>} Combined extraction results
 */
async function runParallelExtractions(combinedDocumentText, contextSection = '', documents = null) {
  console.log('Starting parallel extractions (two-phase approach)...');
  const startTime = Date.now();

  // If context provided (period analysis or portfolio facility context), prepend it to financial prompts
  // This guides Claude to use the correct periods and/or extract for the correct facility
  // NOTE: FACILITY_PROMPT should NOT have period context - facility extraction should find ALL facilities
  // mentioned in the document, regardless of time period. Period constraints only apply to financial data.
  const facilityPromptWithContext = FACILITY_PROMPT;  // No period constraint for facility extraction

  const financialsPromptWithContext = contextSection
    ? `${contextSection}\n\n${FINANCIALS_PROMPT}`
    : FINANCIALS_PROMPT;

  const expensesPromptWithContext = contextSection
    ? `${contextSection}\n\n${EXPENSES_PROMPT}`
    : EXPENSES_PROMPT;

  const censusPromptWithContext = contextSection
    ? `${contextSection}\n\n${CENSUS_PROMPT}`
    : CENSUS_PROMPT;

  const ratesPromptWithContext = contextSection
    ? `${contextSection}\n\n${RATES_PROMPT}`
    : RATES_PROMPT;

  const overviewPromptWithContext = contextSection
    ? `${contextSection}\n\n${OVERVIEW_PROMPT}`
    : OVERVIEW_PROMPT;

  if (contextSection) {
    console.log('[ParallelExtractor] Context section added to financial extraction prompts (NOT facility)');
    // Log period constraint details for verification
    const periodMatch = contextSection.match(/AUTHORIZED EXTRACTION PERIOD:\s*(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/);
    if (periodMatch) {
      console.log(`[ParallelExtractor] ✓ PERIOD CONSTRAINT ENFORCED: ${periodMatch[1]} to ${periodMatch[2]}`);
      console.log('[ParallelExtractor] Period applies to: financials, expenses, census, rates, overview');
      console.log('[ParallelExtractor] Period does NOT apply to: facility (extracts all facilities regardless of period)');
    }
    console.log(`[ParallelExtractor] Context section length: ${contextSection.length} chars`);
  }

  // Initialize organized results object
  const organized = {
    facility: null,
    financials: null,
    expenses: null,
    census: null,
    rates: null,
    overview: null,
    errors: [],
    metadata: {
      totalDuration: 0,
      successCount: 0,
      failureCount: 0,
      phase1Duration: 0,
      phase2Duration: 0
    }
  };

  // ============================================
  // PHASE 1: Run 5 data extractions in parallel
  // ============================================
  console.log('[ParallelExtractor] Phase 1: Running facility, financials, expenses, census, rates extractions...');
  const phase1Start = Date.now();

  const phase1Promises = [
    runFocusedExtraction(combinedDocumentText, facilityPromptWithContext, 'facility'),
    runFocusedExtraction(combinedDocumentText, financialsPromptWithContext, 'financials'),
    runFocusedExtraction(combinedDocumentText, expensesPromptWithContext, 'expenses'),
    runFocusedExtraction(combinedDocumentText, censusPromptWithContext, 'census'),
    runFocusedExtraction(combinedDocumentText, ratesPromptWithContext, 'rates')
  ];

  const phase1Results = await Promise.allSettled(phase1Promises);
  organized.metadata.phase1Duration = Date.now() - phase1Start;
  console.log(`[ParallelExtractor] Phase 1 completed in ${organized.metadata.phase1Duration}ms`);

  // Process Phase 1 results
  for (const result of phase1Results) {
    if (result.status === 'fulfilled') {
      const extractionResult = result.value;
      if (extractionResult.success) {
        organized[extractionResult.type] = extractionResult.data;
        organized.metadata.successCount++;
        console.log(`[ParallelExtractor] ${extractionResult.type}: SUCCESS (${extractionResult.duration}ms)`);
      } else {
        organized.errors.push({ type: extractionResult.type, error: extractionResult.error });
        organized.metadata.failureCount++;
        console.log(`[ParallelExtractor] ${extractionResult.type}: FAILED - ${extractionResult.error}`);
      }
    } else {
      console.error(`[Extraction] Promise rejected:`, result.reason);
      organized.errors.push({ type: 'unknown', error: result.reason?.message || 'Promise rejected' });
      organized.metadata.failureCount++;
    }
  }

  // ============================================
  // PHASE 2: Run overview with condensed input
  // ============================================
  console.log('[ParallelExtractor] Phase 2: Running overview extraction with condensed input...');
  const phase2Start = Date.now();

  // Build condensed input for overview if we have documents array
  // Otherwise fall back to full text (backwards compatibility)
  let overviewInputText;
  if (documents && documents.length > 0) {
    overviewInputText = buildOverviewInput(documents, organized);
    console.log(`[ParallelExtractor] Overview input reduced from ${combinedDocumentText.length} to ${overviewInputText.length} chars`);
  } else {
    overviewInputText = combinedDocumentText;
    console.log(`[ParallelExtractor] No documents array provided, using full text for overview`);
  }

  const overviewResult = await runFocusedExtraction(
    overviewInputText,
    overviewPromptWithContext,
    'overview',
    MAX_TOKENS_OVERVIEW
  );

  organized.metadata.phase2Duration = Date.now() - phase2Start;
  console.log(`[ParallelExtractor] Phase 2 completed in ${organized.metadata.phase2Duration}ms`);

  // Process overview result
  if (overviewResult.success) {
    organized.overview = overviewResult.data;
    organized.metadata.successCount++;
    console.log(`[ParallelExtractor] overview: SUCCESS (${overviewResult.duration}ms)`);
  } else {
    organized.errors.push({ type: 'overview', error: overviewResult.error });
    organized.metadata.failureCount++;
    console.log(`[ParallelExtractor] overview: FAILED - ${overviewResult.error}`);
  }

  const totalDuration = Date.now() - startTime;
  organized.metadata.totalDuration = totalDuration;
  console.log(`[ParallelExtractor] All extractions completed in ${totalDuration}ms (Phase 1: ${organized.metadata.phase1Duration}ms, Phase 2: ${organized.metadata.phase2Duration}ms)`);

  // Log overview status specifically
  console.log(`[ParallelExtractor] Overview data present: ${organized.overview !== null}`);
  if (organized.overview) {
    console.log(`[ParallelExtractor] Overview keys: ${Object.keys(organized.overview).join(', ')}`);
  }

  // Auto-populate facility data from ALF database
  await enrichFacilityData(organized);

  return organized;
}


/**
 * Prepare document text for extraction
 * Combines multiple documents with clear labels
 * @param {Array} documents - Array of { name, text } objects
 * @returns {string} Combined document text
 */
function prepareDocumentText(documents) {
  const sections = documents.map(doc => {
    return `\n========== DOCUMENT: ${doc.name} ==========\n${doc.text}\n`;
  });

  return sections.join('\n');
}

/**
 * Check if a document is a spreadsheet based on filename
 * @param {string} filename - Document filename
 * @returns {boolean} True if document is Excel/CSV
 */
function isSpreadsheetDocument(filename) {
  const spreadsheetExtensions = ['.xlsx', '.xls', '.csv', '.xlsm', '.xlsb'];
  const lowerName = filename.toLowerCase();
  return spreadsheetExtensions.some(ext => lowerName.endsWith(ext));
}

/**
 * Build condensed overview input
 * Keeps full PDF/CIM text but replaces Excel data with extraction summaries
 * @param {Array} documents - Array of { name, text } objects
 * @param {Object} extractionResults - Results from Phase 1 extractions
 * @returns {string} Condensed document text for overview extraction
 */
function buildOverviewInput(documents, extractionResults) {
  const sections = [];

  // Separate PDF/narrative documents from spreadsheets
  const pdfDocs = documents.filter(doc => !isSpreadsheetDocument(doc.name));
  const spreadsheetDocs = documents.filter(doc => isSpreadsheetDocument(doc.name));

  console.log(`[buildOverviewInput] PDF documents: ${pdfDocs.length}, Spreadsheet documents: ${spreadsheetDocs.length}`);

  // Include full text from PDF/narrative documents
  for (const doc of pdfDocs) {
    sections.push(`\n========== DOCUMENT: ${doc.name} ==========\n${doc.text}\n`);
  }

  // For spreadsheets, include condensed extraction summaries instead of raw text
  if (spreadsheetDocs.length > 0) {
    const spreadsheetNames = spreadsheetDocs.map(d => d.name).join(', ');

    sections.push(`\n========== EXTRACTED DATA FROM SPREADSHEETS (${spreadsheetNames}) ==========\n`);

    // Add TTM Financial Summary from financials extraction
    if (extractionResults.financials) {
      const fin = extractionResults.financials;
      const ttm = fin.ttm_summary || {};
      sections.push(`
--- TTM FINANCIAL SUMMARY ---
Period: ${ttm.period_start || 'N/A'} to ${ttm.period_end || 'N/A'}
Total Revenue: $${(ttm.total_revenue || 0).toLocaleString()}
Total Expenses: $${(ttm.total_expenses || 0).toLocaleString()}
Net Income: $${(ttm.net_income || 0).toLocaleString()}
EBITDA: $${(ttm.ebitda || 0).toLocaleString()}
EBITDAR: $${(ttm.ebitdar || 0).toLocaleString()}

Revenue Breakdown:
- Medicare Revenue: $${(ttm.medicare_revenue || 0).toLocaleString()}
- Medicaid Revenue: $${(ttm.medicaid_revenue || 0).toLocaleString()}
- Private Pay Revenue: $${(ttm.private_pay_revenue || 0).toLocaleString()}
- Other Revenue: $${(ttm.other_revenue || 0).toLocaleString()}
`);

      // Add monthly trend summary (condensed)
      if (fin.monthly_financials && fin.monthly_financials.length > 0) {
        sections.push(`\nMonthly Trend (${fin.monthly_financials.length} months):`);
        for (const month of fin.monthly_financials.slice(-6)) { // Last 6 months
          sections.push(`  ${month.month}: Revenue $${(month.total_revenue || 0).toLocaleString()}, Net Income $${(month.net_income || 0).toLocaleString()}`);
        }
      }
    }

    // Add Census Summary from census extraction
    if (extractionResults.census) {
      const census = extractionResults.census;
      const summary = census.census_summary || {};
      sections.push(`
--- CENSUS SUMMARY ---
Licensed Beds: ${summary.licensed_beds || 'N/A'}
Average Daily Census: ${summary.average_daily_census || 'N/A'}
Average Occupancy: ${summary.average_occupancy_pct || 'N/A'}%

Payer Mix (by patient days):
- Medicare: ${summary.medicare_pct || 'N/A'}%
- Medicaid: ${summary.medicaid_pct || 'N/A'}%
- Private Pay: ${summary.private_pay_pct || 'N/A'}%
- Other: ${summary.other_pct || 'N/A'}%
`);
    }

    // Add Expense Summary from expenses extraction
    if (extractionResults.expenses) {
      const exp = extractionResults.expenses;
      if (exp.department_totals) {
        sections.push(`\n--- EXPENSE SUMMARY BY DEPARTMENT ---`);
        const depts = exp.department_totals;
        if (depts.direct_care) sections.push(`Direct Care: $${depts.direct_care.toLocaleString()}`);
        if (depts.dietary) sections.push(`Dietary/Culinary: $${depts.dietary.toLocaleString()}`);
        if (depts.housekeeping) sections.push(`Housekeeping: $${depts.housekeeping.toLocaleString()}`);
        if (depts.maintenance) sections.push(`Maintenance: $${depts.maintenance.toLocaleString()}`);
        if (depts.administration) sections.push(`Administration: $${depts.administration.toLocaleString()}`);
        if (depts.activities) sections.push(`Activities: $${depts.activities.toLocaleString()}`);
      }
    }

    // Add Rates Summary from rates extraction
    if (extractionResults.rates) {
      const rates = extractionResults.rates;
      if (rates.current_rates) {
        sections.push(`\n--- RATE INFORMATION ---`);
        const r = rates.current_rates;
        if (r.medicare_rate) sections.push(`Medicare Rate: $${r.medicare_rate}/day`);
        if (r.medicaid_rate) sections.push(`Medicaid Rate: $${r.medicaid_rate}/day`);
        if (r.private_pay_rate) sections.push(`Private Pay Rate: $${r.private_pay_rate}/day`);
      }
    }

    // Add Facility Info from facility extraction
    if (extractionResults.facility) {
      const fac = extractionResults.facility;
      sections.push(`\n--- FACILITY INFORMATION ---`);
      if (fac.facility_name) sections.push(`Facility Name: ${fac.facility_name}`);
      if (fac.facility_type) sections.push(`Facility Type: ${fac.facility_type}`);
      if (fac.licensed_beds) sections.push(`Licensed Beds: ${fac.licensed_beds}`);
      if (fac.city && fac.state) sections.push(`Location: ${fac.city}, ${fac.state}`);
    }

    sections.push(`\n========== END EXTRACTED DATA ==========\n`);
  }

  const result = sections.join('\n');
  console.log(`[buildOverviewInput] Final input length: ${result.length} chars (reduced from full text)`);

  return result;
}


/**
 * Prompt 7: Deal Overview (Portfolio-Level Holistic Analysis)
 * This prompt analyzes AGGREGATED facility data to generate a portfolio-level deal screening.
 * Unlike OVERVIEW_PROMPT which extracts from documents, this receives pre-extracted facility summaries.
 */
const DEAL_OVERVIEW_PROMPT = `You are a healthcare M&A analyst generating a portfolio-level deal screening for a multi-facility acquisition.

You will receive PRE-EXTRACTED data from individual facility analyses. Your job is to:
1. Aggregate and synthesize the data across all facilities
2. Identify portfolio-level patterns, risks, and opportunities
3. Generate a holistic investment thesis

---

## INPUT DATA FORMAT

You will receive a JSON object with:
- \`deal_name\`: Name of the deal
- \`facility_count\`: Number of facilities in the portfolio
- \`facilities\`: Array of facility summaries, each containing:
  - facility_name, facility_type, state, beds, occupancy
  - ttm_revenue, ttm_expenses, ttm_net_income, net_income_margin
  - payer_mix (medicaid_pct, private_pay_pct)
  - red_flags and strengths from individual analysis

---

## OUTPUT FORMAT

Return valid JSON with this exact structure:

{
  "portfolio_summary_1000_chars": "string (executive summary - see format below)",

  "portfolio_snapshot": {
    "deal_name": "string",
    "facility_count": "number",
    "total_beds": "number (sum of all facilities)",
    "weighted_avg_occupancy_pct": "number (weighted by beds)",
    "geographic_footprint": "string (e.g., '3 states: OR, WA, CA')",
    "facility_type_mix": "string (e.g., '4 ALF, 1 SNF')",
    "largest_facility": "string (name and beds)",
    "smallest_facility": "string (name and beds)"
  },

  "portfolio_financials": {
    "period": "string (e.g., 'TTM Oct 2024 - Sep 2025')",
    "total_revenue": "number",
    "total_expenses": "number",
    "total_net_income": "number",
    "portfolio_net_income_margin_pct": "number",
    "revenue_per_bed": "number",
    "revenue_concentration": "string (e.g., 'Top facility = 35% of revenue')",
    "best_performing_facility": "string (name and margin)",
    "worst_performing_facility": "string (name and margin)"
  },

  "portfolio_payer_mix": {
    "weighted_medicaid_pct": "number",
    "weighted_private_pay_pct": "number",
    "weighted_medicare_pct": "number|null",
    "payer_mix_variance": "string (e.g., 'Medicaid ranges 45-78% across facilities')"
  },

  "portfolio_trends": {
    "overall_revenue_trend": "UP|FLAT|DOWN",
    "overall_census_trend": "UP|FLAT|DOWN",
    "overall_margin_trend": "UP|FLAT|DOWN",
    "trend_summary": "string (2-3 sentences on portfolio trajectory)"
  },

  "portfolio_red_flags": [
    {
      "issue": "string (brief title)",
      "impact": "string (quantified portfolio-level impact)",
      "severity": "Critical|Significant|Moderate",
      "facilities_affected": "number or 'all'"
    }
  ],

  "portfolio_strengths": [
    {
      "strength": "string (brief title)",
      "value": "string (quantified benefit)",
      "facilities_contributing": "number or 'all'"
    }
  ],

  "concentration_risks": {
    "geographic": "string|null (e.g., '80% of beds in Oregon')",
    "revenue": "string|null (e.g., 'Top 2 facilities = 60% of revenue')",
    "payer": "string|null (e.g., 'Heavy Medicaid dependence across portfolio')",
    "operational": "string|null (e.g., '3 facilities share management')"
  },

  "synergy_opportunities": [
    {
      "opportunity": "string",
      "estimated_impact": "string (quantified if possible)",
      "complexity": "Low|Medium|High"
    }
  ],

  "investment_thesis": {
    "recommendation": "Pursue|Pursue with Caution|Pass",
    "thesis_summary": "string (3-4 sentences on why to invest or not)",
    "key_value_drivers": ["string (max 3)"],
    "key_risks": ["string (max 3)"],
    "suggested_purchase_price_range": "string|null (if enough data)"
  },

  "portfolio_diligence_items": [
    "string (max 7 prioritized items for entire portfolio)"
  ],

  "facility_ranking": [
    {
      "rank": "number",
      "facility_name": "string",
      "score_rationale": "string (why ranked here)"
    }
  ]
}

---

## SUMMARY FORMAT (portfolio_summary_1000_chars)

Generate this FIRST. Maximum 1000 characters.

**[Deal Name]** — [X]-facility portfolio, [Total Beds] beds across [States]

**TTM Financials:** Revenue $X.XM | Net Income $XK | Margin X.X%

**Portfolio Mix:** [X]% Medicaid | [X]% Private Pay | Occupancy [X]%

**Top Performer:** [Facility] (+X% margin)
**Underperformer:** [Facility] (-X% margin)

**Key Risks:**
• [Risk 1 — quantified]
• [Risk 2 — quantified]

**Key Opportunities:**
• [Opportunity — quantified upside]

**Verdict:** [Pursue/Pursue with Caution/Pass] — [One sentence why]

---

## ANALYSIS GUIDELINES

1. **Aggregate Correctly:**
   - Total revenue/expenses/net income = SUM of all facilities
   - Weighted averages for occupancy, payer mix (weight by beds)
   - Identify outliers that skew portfolio metrics

2. **Portfolio-Level Red Flags:**
   - Issues affecting multiple facilities (systemic problems)
   - Concentration risks (geographic, revenue, payer)
   - Portfolio-wide margin concerns
   - Regulatory risks spanning facilities

3. **Portfolio-Level Strengths:**
   - Diversification benefits
   - Operational synergies potential
   - Strong performers that can subsidize turnarounds
   - Geographic/market advantages

4. **Synergy Opportunities:**
   - Shared services potential
   - Purchasing power consolidation
   - Management efficiency gains
   - Cross-facility staffing

5. **Investment Thesis:**
   - Be direct about recommendation
   - Quantify upside potential
   - Acknowledge key risks
   - Consider portfolio as single investment

6. **Facility Ranking:**
   - Rank all facilities from best to worst investment
   - Consider: margin, occupancy, trends, location, payer mix

---

## CRITICAL RULES

1. **Use ONLY the provided facility data** — Do not invent numbers
2. **Aggregate accurately** — Double-check your math
3. **Be specific** — Every flag/strength needs quantification
4. **Portfolio perspective** — Think like a portfolio investor, not facility-by-facility
5. **Actionable insights** — Focus on what matters for investment decision
6. **Rank facilities honestly** — Identify which to prioritize vs divest

Return ONLY valid JSON, no markdown.`;


/**
 * Run the Deal Overview extraction for portfolio-level holistic analysis
 * This takes pre-extracted facility data, NOT raw documents
 *
 * @param {Object} portfolioData - Aggregated facility data
 * @param {string} portfolioData.deal_name - Name of the deal
 * @param {number} portfolioData.facility_count - Number of facilities
 * @param {Array} portfolioData.facilities - Array of facility summaries
 * @returns {Promise<Object>} Portfolio-level deal overview
 */
async function runDealOverviewExtraction(portfolioData) {
  const startTime = Date.now();

  try {
    console.log('[DealOverview] Starting portfolio-level analysis...');
    console.log(`[DealOverview] Analyzing ${portfolioData.facility_count} facilities`);

    // Format the facility data as input for the prompt
    const inputData = JSON.stringify(portfolioData, null, 2);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: DEAL_OVERVIEW_PROMPT,
      messages: [{
        role: 'user',
        content: `Analyze this portfolio and generate a holistic deal overview:\n\n${inputData}`
      }]
    });

    const responseText = response.content[0].text;

    // Parse JSON response
    let dealOverview;
    try {
      dealOverview = JSON.parse(responseText);
    } catch (parseError) {
      console.log('[DealOverview] Initial parse failed, attempting repair...');

      // Try to extract JSON from response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
        || responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        jsonStr = repairTruncatedJson(jsonStr);

        try {
          dealOverview = JSON.parse(jsonStr);
          console.log('[DealOverview] JSON repair successful');
        } catch (repairError) {
          console.error('[DealOverview] JSON repair failed:', repairError.message);
          return { success: false, error: `JSON parse error: ${repairError.message}` };
        }
      } else {
        return { success: false, error: 'No JSON found in response' };
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[DealOverview] Portfolio analysis completed in ${duration}ms`);

    return {
      success: true,
      data: dealOverview,
      duration
    };

  } catch (error) {
    console.error('[DealOverview] Extraction error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Prepare facility data for Deal Overview prompt
 * Transforms raw facility extractions into the format expected by DEAL_OVERVIEW_PROMPT
 *
 * @param {string} dealName - Name of the deal
 * @param {Array} facilityExtractions - Array of facility extraction results
 * @returns {Object} Formatted portfolio data for Deal Overview
 */
function prepareDealOverviewInput(dealName, facilityExtractions) {
  const facilities = facilityExtractions
    .filter(fe => fe.success && fe.extraction_result?.extractedData)
    .map(fe => {
      const data = fe.extraction_result.extractedData;
      const overview = data.deal_overview || {};
      const facilitySnapshot = overview.facility_snapshot || {};
      const ttmFinancials = overview.ttm_financials || data.ttm_financials || {};
      const payerMix = overview.payer_mix || {};

      return {
        facility_name: fe.facility_name || facilitySnapshot.facility_name || 'Unknown',
        facility_type: facilitySnapshot.facility_type || data.facility_type || null,
        state: facilitySnapshot.state || data.state || null,
        city: facilitySnapshot.city || data.city || null,
        beds: facilitySnapshot.licensed_beds || data.total_beds || null,
        occupancy_pct: facilitySnapshot.current_occupancy_pct || data.occupancy_pct || null,

        // Financials - with comprehensive fallbacks for different field names
        ttm_revenue: ttmFinancials.revenue || data.ttm_revenue || data.total_revenue || data.annual_revenue || null,
        ttm_expenses: ttmFinancials.expenses || data.ttm_expenses || data.total_expenses || null,
        ttm_net_income: ttmFinancials.net_income || data.ttm_net_income || data.net_income || null,
        net_income_margin_pct: ttmFinancials.net_income_margin_pct || null,
        ebitda: data.ebitda || null,
        ebitdar: data.ebitdar || null,

        // Add-backs
        rent_expense: ttmFinancials.rent_lease || data.rent_lease_expense || null,
        interest_expense: ttmFinancials.interest || data.interest_expense || null,
        depreciation: ttmFinancials.depreciation || data.depreciation || null,

        // Payer mix
        medicaid_pct: payerMix.medicaid_pct || data.medicaid_pct || null,
        private_pay_pct: payerMix.private_pay_pct || data.private_pay_pct || null,
        medicare_pct: payerMix.medicare_pct || data.medicare_pct || null,

        // Trends
        revenue_trend: overview.operating_trends?.revenue_trend || null,
        census_trend: overview.operating_trends?.census_trend || null,
        net_income_trend: overview.operating_trends?.net_income_trend || null,

        // Issues and strengths from facility-level analysis
        red_flags: overview.red_flags || [],
        strengths: overview.strengths || []
      };
    });

  return {
    deal_name: dealName,
    facility_count: facilities.length,
    facilities
  };
}


module.exports = {
  runParallelExtractions,
  runFocusedExtraction,
  prepareDocumentText,
  runDealOverviewExtraction,
  prepareDealOverviewInput,
  // Export individual prompts for testing
  FACILITY_PROMPT,
  FINANCIALS_PROMPT,
  EXPENSES_PROMPT,
  CENSUS_PROMPT,
  RATES_PROMPT,
  DEAL_OVERVIEW_PROMPT
};
