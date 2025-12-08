/**
 * Parallel Document Extraction Service
 * Runs multiple focused extraction prompts in parallel for faster, more reliable extraction
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Model configuration
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 16384; // Large enough for 12+ months of detailed financial data

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
- Address (street, city, state, zip)
- Bed/unit count
- Contact information (name, title, phone, email)
- Deal name (if mentioned)
- Purchase price (if mentioned)

LOCATION EXTRACTION RULES:
- State agencies (e.g., "Oregon DHS") indicate the state
- Floor plans may have architect addresses - DO NOT use these as facility address
- Look for PROJECT NAME boxes for facility location
- If only city/state available, set street_address to null

Return JSON:
{
  "facility_name": {"value": string|null, "confidence": "high"|"medium"|"low"|"not_found", "source": "document | location | snippet"},
  "facility_type": {"value": string|null, "confidence": string, "source": string},
  "street_address": {"value": string|null, "confidence": string, "source": string},
  "city": {"value": string|null, "confidence": string, "source": string},
  "state": {"value": string|null, "confidence": string, "source": string},
  "zip_code": {"value": string|null, "confidence": string, "source": string},
  "bed_count": {"value": number|null, "confidence": string, "source": string, "method": "explicit"|"inferred"},
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
const OVERVIEW_PROMPT = `You are a healthcare M&A analyst generating a Stage 1 deal screening for an assisted living facility acquisition. Your analysis should enable an operator to make a go/no-go decision on pursuing diligence.

## CRITICAL: TTM FINANCIAL CONSTRUCTION

**This is the most important analytical step. Do not skip or shortcut this process.**

### Step 1: Identify All Financial Data Sources
List every document containing monthly financial data (revenue, expenses, P&L line items):
- Document name
- Period covered (start month/year to end month/year)
- Data granularity (monthly, quarterly, annual)

### Step 2: Determine the Freshest Possible TTM Period
Identify the most recent month with complete financial data across ALL documents. Then work backwards 12 months.

**Example:**
- T12 P&L covers: May 2024 - April 2025
- YTD I&E covers: March 2025 - September 2025
- **Freshest TTM:** October 2024 - September 2025
  - Oct 2024 - Feb 2025: Pull from T12 P&L
  - Mar 2025 - Sep 2025: Pull from YTD I&E

### Step 3: Construct Month-by-Month TTM
Build a 12-month table pulling from the appropriate source document for each month. Include:
- Revenue (by category if available)
- Total Expenses
- Net Income/Loss
- Key line items needed for EBITDAR calculation (Interest, Depreciation, Rent/Lease)

### Step 4: Calculate TTM Totals
Sum all 12 months for each metric. Show your work.

**NEVER use a pre-calculated T12 total when fresher monthly data is available from another document.**

---

## CRITICAL VALIDATION

Before proceeding to output, verify:
- EBITDAR >= EBITDA >= EBIT >= Net Income (less negative or more positive)
- Occupancy % = (Current Census / Licensed Beds) * 100
- Sum of payer mix percentages = 100%

If validation fails, recheck your calculations.

---

## IMPORTANT: MISSING DATA HANDLING

If critical data is missing (licensed beds, TTM revenue, occupancy), still generate the analysis with null values and flag the missing items prominently in the red_flags section. Do NOT refuse to generate output.

If market data (competitive set, market occupancy, demand indicators) is not provided in documents, flag as "Stage 2 Diligence Item" - do NOT attempt to infer or fabricate market data.

---

## OUTPUT FORMAT

Return your analysis as valid JSON with this structure:

{
  "data_completeness": {
    "licensed_beds": "available|partial|missing",
    "current_census": "available|partial|missing",
    "ttm_revenue": "available|partial|missing",
    "ttm_expenses": "available|partial|missing",
    "payer_mix": "available|partial|missing",
    "facility_type": "available|partial|missing",
    "location": "available|partial|missing",
    "building_info": "available|partial|missing"
  },
  "facility_snapshot": {
    "facility_name": "string|null",
    "facility_type": "ALF|Memory Care|ALF + MC|CCRC|null",
    "location": {
      "city": "string|null",
      "state": "string|null",
      "zip": "string|null"
    },
    "licensed_beds": number|null,
    "current_census": number|null,
    "current_occupancy_pct": number|null,
    "unit_mix": {
      "studio": number|null,
      "one_bedroom": number|null,
      "two_bedroom": number|null
    },
    "ownership_type": "Non-profit|For-profit|REIT|Private Equity|Family|Unknown",
    "specialty_focus": "string|null",
    "acuity_level_distribution": "string|null",
    "regulatory_status": "string"
  },
  "building_info": {
    "year_built": number|null,
    "last_major_renovation": {
      "year": number|null,
      "scope": "string|null"
    },
    "building_type": "Single-story|Multi-story|Campus|Unknown",
    "construction_type": "Wood frame|Steel|Concrete|Unknown",
    "square_footage": number|null,
    "architect_builder": "string|null",
    "notable_features": ["string"],
    "condition_notes": "string|null",
    "source_document": "string|null"
  },
  "ttm_financials": {
    "period_start": "YYYY-MM",
    "period_end": "YYYY-MM",
    "data_sources": [
      {
        "months": "YYYY-MM to YYYY-MM",
        "source_document": "string",
        "notes": "string|null"
      }
    ],
    "monthly_breakdown": [
      {
        "month": "YYYY-MM",
        "revenue": number|null,
        "expenses": number|null,
        "net_income": number|null,
        "interest": number|null,
        "depreciation": number|null,
        "rent_lease": number|null,
        "source_document": "string"
      }
    ],
    "summary_metrics": {
      "total_revenue": number|null,
      "total_expenses": number|null,
      "net_income": number|null,
      "ebitdar": number|null,
      "ebitdar_margin_pct": number|null,
      "ebitda": number|null,
      "ebitda_margin_pct": number|null,
      "ebit": number|null,
      "occupancy_pct": number|null
    },
    "ebitdar_calculation": {
      "net_income": number|null,
      "add_interest": number|null,
      "equals_ebit": number|null,
      "add_depreciation": number|null,
      "add_amortization": number|null,
      "equals_ebitda": number|null,
      "add_rent_lease": number|null,
      "equals_ebitdar": number|null
    },
    "benchmarks": {
      "ebitdar_margin_target": 23,
      "ebitda_margin_target": 9,
      "occupancy_target": 85,
      "ebitdar_margin_variance": number|null,
      "ebitda_margin_variance": number|null,
      "occupancy_variance": number|null
    },
    "unit_economics": {
      "revenue_per_occupied_bed_annual": number|null,
      "revenue_per_resident_day": number|null,
      "expense_per_resident_day": number|null,
      "labor_cost_pct_of_revenue": number|null,
      "direct_care_cost_pct_of_revenue": number|null,
      "agency_staffing_pct_of_direct_care": number|null
    },
    "revenue_by_payer": [
      {
        "payer": "Medicaid|Medicare|Private Pay|Other",
        "revenue": number|null,
        "pct_of_total": number|null,
        "census_days": number|null,
        "pct_of_census": number|null
      }
    ]
  },
  "operating_trends": {
    "comparison_period": "string",
    "metrics": [
      {
        "metric": "Revenue|Census|EBITDAR|Private Pay %",
        "prior_period_avg": number|null,
        "recent_3mo_avg": number|null,
        "change_pct": number|null,
        "trend": "UP|FLAT|DOWN"
      }
    ],
    "trend_drivers": {
      "census": "string",
      "payer_mix": "string",
      "staffing": "string|null",
      "quality": "string|null"
    },
    "overall_assessment": "Improving|Stable|Deteriorating"
  },
  "rate_structure": {
    "private_pay_rates": [
      {
        "unit_type": "string",
        "monthly_base": number|null,
        "care_level_range": "string"
      }
    ],
    "medicaid_rates": [
      {
        "care_level": "string",
        "monthly_rate": number|null,
        "daily_rate": number|null
      }
    ],
    "rate_gap_analysis": [
      {
        "care_level": "string",
        "private_pay_rate": number|null,
        "medicaid_rate": number|null,
        "monthly_gap": number|null,
        "annual_gap_per_resident": number|null
      }
    ],
    "implication": "string"
  },
  "market_position": {
    "competitive_set": "string or Stage 2 diligence item",
    "market_occupancy": "string or Stage 2 diligence item",
    "rate_positioning": "Premium|Mid-market|Commodity|Medicaid-focused|Unknown",
    "demand_indicators": "string or Stage 2 diligence item"
  },
  "red_flags": [
    {
      "issue": "string",
      "impact": "string (quantified)",
      "severity": "Critical|Significant|Moderate"
    }
  ],
  "strengths": [
    {
      "strength": "string",
      "value": "string (quantified)"
    }
  ],
  "valuation": {
    "as_is_value": {
      "income_approach_low": number|null,
      "income_approach_high": number|null,
      "per_bed_low": number|null,
      "per_bed_high": number|null,
      "basis": "string"
    },
    "stabilized_value": {
      "target_occupancy_pct": number|null,
      "target_occupancy_rationale": "string",
      "target_payer_mix": "string",
      "target_payer_mix_rationale": "string",
      "target_ebitdar_margin_pct": number|null,
      "target_ebitdar_margin_rationale": "string",
      "stabilized_ebitdar": number|null,
      "value_at_8pct_cap": number|null,
      "value_at_9pct_cap": number|null,
      "value_at_10pct_cap": number|null,
      "per_bed_at_8pct": number|null,
      "per_bed_at_9pct": number|null,
      "per_bed_at_10pct": number|null
    },
    "max_purchase_price": {
      "stabilized_value": number|null,
      "less_turnaround_investment": number|null,
      "less_return_buffer": number|null,
      "max_price": number|null,
      "max_price_per_bed": number|null
    }
  },
  "turnaround_or_optimization": {
    "type": "turnaround|optimization",
    "turnaround": {
      "stabilization_targets": {
        "current_occupancy_pct": number|null,
        "target_occupancy_pct": number|null,
        "occupancy_improvement_pts": number|null,
        "current_private_pay_pct": number|null,
        "target_private_pay_pct": number|null,
        "payer_mix_improvement_pts": number|null,
        "current_ebitdar_margin_pct": number|null,
        "target_ebitdar_margin_pct": number|null,
        "margin_improvement_pts": number|null,
        "current_ebitdar": number|null,
        "target_ebitdar": number|null,
        "ebitdar_improvement": number|null
      },
      "key_initiatives": [
        {
          "priority": 1|2|3,
          "initiative": "string",
          "estimated_annual_impact": number|null,
          "timeline_months": number|null,
          "difficulty": "High|Medium|Low"
        }
      ],
      "investment_required": {
        "operating_losses": number|null,
        "capex": number|null,
        "working_capital": number|null,
        "transition_costs": number|null,
        "contingency": number|null,
        "total": number|null
      },
      "risk_factors": ["string"],
      "timeline_to_stabilization_months": number|null
    },
    "optimization": {
      "opportunities": [
        {
          "opportunity": "string",
          "estimated_impact": "string (quantified)"
        }
      ],
      "risks_to_current_performance": ["string"]
    }
  },
  "open_diligence_items": [
    {
      "priority": 1|2|3|4|5,
      "item": "string",
      "why_it_matters": "string"
    }
  ],
  "recommendation": {
    "decision": "PURSUE|PURSUE_WITH_CAUTION|PASS",
    "rationale": "string (2-4 sentences explaining the recommendation, key value drivers, critical risks, and conditions for proceeding)"
  },
  "summary_1000_chars": "string (Executive summary in exactly the format specified, maximum 1000 characters)",
  "detailed_narrative_markdown": "string (Full markdown-formatted Stage 1 analysis report, 8000-15000 characters, following the format specified below)"
}

## SUMMARY FORMAT (for summary_1000_chars field)

Use this exact format, maximum 1000 characters:

**[Facility Name]** - [X]-bed [Type], [City, State] ([X]% occupied)

**TTM Performance ([Mon Year] - [Mon Year]):** Revenue $X.XM | EBITDAR $X | Margin X%

**Trends:** Revenue [UP/FLAT/DOWN] | Census [UP/FLAT/DOWN] | Margins [UP/FLAT/DOWN]

**Key Issues:**
- [Issue 1 - quantified]
- [Issue 2 - quantified]
- [Issue 3 - quantified]

**Upside:** [Key opportunity - quantified potential]

**Stabilized Potential:** $X EBITDAR at X% occ, X% margin

**Value:**
- As-Is: $X-XM ($XK-XK/bed)
- Stabilized: $X-XM ($XK-XK/bed)
- Turnaround investment: ~$X.XM (if applicable)
- Max purchase: ~$XM ($XK/bed)

**Recommendation: [PURSUE / PURSUE WITH CAUTION / PASS]** - [1 sentence rationale + key diligence items]

---

## DETAILED NARRATIVE FORMAT (for detailed_narrative_markdown field)

Generate a comprehensive markdown-formatted Stage 1 deal analysis report (8000-15000 characters) using this structure:

# STAGE 1 DEAL EVALUATION
## [Facility Name] Acquisition

---

## DATA COMPLETENESS CHECK

| Category | Status | Notes |
|----------|--------|-------|
| Licensed Beds | [Status with icon] | [Notes] |
| Current Census | [Status with icon] | [Notes] |
| TTM Revenue | [Status with icon] | [Notes] |
| TTM Operating Expenses | [Status with icon] | [Notes] |
| Payer Mix | [Status with icon] | [Notes] |
| Rate Schedules | [Status with icon] | [Notes] |
| Building Info | [Status with icon] | [Notes] |
| Asking Price | [Status with icon] | [Notes] |

Use: ✅ Available | ⚠️ Partial | ❌ Missing

---

## FACILITY SNAPSHOT

[Markdown table with all key facility information]

### BUILDING & STRUCTURE INFORMATION

[If building information available, create detailed table with Year Built, Last Renovation, Construction Type, Architect, etc.]

---

## TTM FINANCIAL PERFORMANCE
**Period: [Month Year] - [Month Year]**

### Data Source Documentation

[Table showing which months come from which documents]

### Monthly Build-Up Table

[Full 12-month table with Revenue, Expenses, Net Income, Interest, Depreciation, Rent, Source for each month]

### Summary Metrics

[Table comparing TTM actuals vs benchmarks with variance indicators]

### EBITDAR Calculation Detail

(Show calculation step-by-step in a formatted block)

### Unit Economics

Revenue per day, expense per day, loss per day if negative

---

## OPERATING TRENDS

[Compare recent 3-6 months vs prior periods. Include ASCII bar charts for census trends if declining]

Example format: Show monthly data with visual bar indicators using block characters, marking peak and current values

---

## RATE STRUCTURE ANALYSIS

[Tables for private pay rates and Medicaid rates. Include rate gap analysis]

---

## MARKET POSITION

[Table or bullet points on competitive position, market occupancy, rate positioning]

---

## RED FLAGS & STRENGTHS

### 🔴 [CRITICAL/SIGNIFICANT] (Quantified Issues)

> 🔴 **[Issue Title] — [Quantified impact] ([CRITICAL/SIGNIFICANT])**
> [2-3 sentences with specific numbers and business impact]

### 🟢 EXCEEDING (Quantified Strengths)

> 🟢 **[Strength Title] — [Quantified benefit]**
> [1-2 sentences explaining the advantage]

---

## VALUATION CONTEXT

### As-Is Value

[Table with different valuation approaches and $/bed]

### Stabilized Value

[Table with target metrics and stabilized valuations at different cap rates]

### Max Purchase Price Calculation

[Table showing stabilized value minus turnaround investment minus return buffer]

---

## TURNAROUND POTENTIAL (if needed)

### Stabilization Targets

[Current vs Stabilized comparison table]

### Key Initiatives

[Ranked table of initiatives with estimated annual impact, timeline, difficulty]

### Investment Required

[Detailed breakdown of capital needed]

### Risk Factors

[Numbered list of key execution risks]

---

## OPEN DILIGENCE ITEMS

[Priority-ranked table of Stage 2 diligence requirements with rationale]

---

## RECOMMENDATION

### **[PURSUE / PURSUE WITH CAUTION / PASS]** [with warning icons if caution/pass]

**Rationale:** [2-3 paragraphs explaining the decision with specific quantified reasoning]

---

## 1000-CHARACTER SUMMARY

[Same format as summary_1000_chars field - include for completeness]

---

**FORMATTING REQUIREMENTS:**
- Use markdown tables extensively (with | separators and --- headers)
- Use > blockquotes for red flags and strengths
- Use ** for bold emphasis on key numbers
- Use 🔴 🟢 ⚠️ ✅ ❌ icons appropriately (NO other emojis)
- Include ASCII bar charts for census trends if relevant
- Show all calculations in formatted code blocks
- Use horizontal rule separators between major sections
- Keep language direct and analytical (no marketing fluff)
- Quantify EVERYTHING - every claim needs a number
- Use "Stage 2 diligence item" for missing market data

---

## CRITICAL RULES

1. **Build the freshest TTM** - Combine multiple documents to get the most recent 12 months. Never use stale T12 totals when fresher monthly data exists.

2. **Show your math** - Include calculation details for EBITDAR, margins, trends. Include monthly breakdown for TTM.

3. **Quantify everything** - No issue or opportunity without a dollar/percentage impact.

4. **Flag missing data explicitly** - Use null for missing values and flag in red_flags if critical.

5. **Benchmark against targets:**
   - EBITDAR margin: 23%
   - EBITDA margin: 9%
   - Occupancy: 85%
   - Agency staffing: <5% of direct care

6. **Extract building information prominently** - Any structural details (year built, renovations, construction type) should be captured.

7. **Conditional turnaround section** - If EBITDAR margin <15%, populate "turnaround" object. If >=15%, populate "optimization" object. Set "type" field accordingly.

8. **Be direct** - State recommendation clearly; avoid hedging language.

9. **Separate fact from inference** - Use confidence levels and source attribution.

10. **Both outputs required** - Populate all JSON fields, generate 1000-char summary, AND generate detailed markdown narrative.

11. **TTM period must be stated** - Always include exact month range in period_start and period_end.

12. **Market data disclaimer** - If market competitive data not in documents, state "Stage 2 diligence item" - do not fabricate.

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
 * @returns {Promise<Object>} Extracted data
 */
async function runFocusedExtraction(documentText, systemPrompt, extractionType) {
  const startTime = Date.now();

  try {
    console.log(`[${extractionType}] Starting extraction...`);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Extract the relevant information from these documents:\n\n${documentText}`
      }]
    });

    const responseText = response.content[0].text;

    // Parse JSON with repair logic
    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      console.log(`[${extractionType}] Initial parse failed, attempting repair...`);

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
    return {
      success: false,
      type: extractionType,
      error: error.message
    };
  }
}


/**
 * Run all extractions in parallel
 * @param {string} combinedDocumentText - Text from all documents, labeled
 * @returns {Promise<Object>} Combined extraction results
 */
async function runParallelExtractions(combinedDocumentText) {
  console.log('Starting parallel extractions...');
  const startTime = Date.now();

  // Run all 6 extractions in parallel
  const extractionPromises = [
    runFocusedExtraction(combinedDocumentText, FACILITY_PROMPT, 'facility'),
    runFocusedExtraction(combinedDocumentText, FINANCIALS_PROMPT, 'financials'),
    runFocusedExtraction(combinedDocumentText, EXPENSES_PROMPT, 'expenses'),
    runFocusedExtraction(combinedDocumentText, CENSUS_PROMPT, 'census'),
    runFocusedExtraction(combinedDocumentText, RATES_PROMPT, 'rates'),
    runFocusedExtraction(combinedDocumentText, OVERVIEW_PROMPT, 'overview')
  ];

  const results = await Promise.all(extractionPromises);

  const totalDuration = Date.now() - startTime;
  console.log(`All extractions completed in ${totalDuration}ms`);

  // Organize results by type
  const organized = {
    facility: null,
    financials: null,
    expenses: null,
    census: null,
    rates: null,
    overview: null,
    errors: [],
    metadata: {
      totalDuration,
      successCount: 0,
      failureCount: 0
    }
  };

  for (const result of results) {
    if (result.success) {
      organized[result.type] = result.data;
      organized.metadata.successCount++;
    } else {
      organized.errors.push({ type: result.type, error: result.error });
      organized.metadata.failureCount++;
    }
  }

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


module.exports = {
  runParallelExtractions,
  runFocusedExtraction,
  prepareDocumentText,
  // Export individual prompts for testing
  FACILITY_PROMPT,
  FINANCIALS_PROMPT,
  EXPENSES_PROMPT,
  CENSUS_PROMPT,
  RATES_PROMPT
};
