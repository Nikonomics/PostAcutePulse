/**
 * Deal-Specific Extraction Prompts
 *
 * These prompts are optimized for extracting ONLY deal-specific data.
 * Facility basics (location, beds, ownership, CMS ratings) come from database match.
 *
 * This reduces:
 * - Token usage (shorter prompts, focused extraction)
 * - Hallucination risk (no guessing at data we already have)
 * - Processing time
 */

/**
 * Generate the system context for deal-specific extraction
 * @param {Object} matchedFacility - Facility data from database match
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {string} - System prompt context
 */
function generateSystemContext(matchedFacility, facilityType) {
  const facilityName = matchedFacility?.facility_name || 'Unknown Facility';
  const state = matchedFacility?.state || 'Unknown';
  const beds = matchedFacility?.total_beds || matchedFacility?.capacity || 'Unknown';

  return `You are extracting deal-specific financial data for a healthcare M&A transaction.

VERIFIED FACILITY (from ${facilityType === 'SNF' ? 'CMS' : 'state licensing'} database):
- Name: ${facilityName}
- Location: ${matchedFacility?.city || ''}, ${state}
- Beds/Units: ${beds}
- Type: ${facilityType}
${facilityType === 'SNF' ? `- CMS Rating: ${matchedFacility?.overall_rating || 'N/A'} stars` : ''}
${facilityType === 'SNF' ? `- Provider #: ${matchedFacility?.federal_provider_number || 'N/A'}` : ''}

CRITICAL INSTRUCTIONS:
1. DO NOT extract facility name, address, city, state, beds - we have this from database
2. DO NOT guess at CMS ratings, ownership, or licensing info - we have this
3. FOCUS ONLY on deal-specific data: financials, census trends, rates, payer mix
4. If data is unclear or not found, return null - do not estimate
5. Include confidence level and source citation for each extracted value`;
}

/**
 * Prompt for extracting T12 (Trailing 12 Month) financials
 */
function getT12FinancialsPrompt(matchedFacility, documentText) {
  const context = generateSystemContext(matchedFacility, 'SNF');

  return `${context}

TASK: Extract Trailing 12 Month (T12) Financial Data

Look for:
- P&L statements, income statements, financial summaries
- Period should be most recent 12 months available
- May be labeled as "TTM", "T12", "LTM", or show specific date range

EXTRACT THESE FIELDS:

{
  "t12_period": {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "source": "document name, page/section"
  },
  "revenue": {
    "total_revenue": null,
    "medicaid_revenue": null,
    "medicare_revenue": null,
    "private_pay_revenue": null,
    "other_revenue": null,
    "confidence": "high/medium/low",
    "source": "document name, page/section"
  },
  "expenses": {
    "total_expenses": null,
    "labor_cost": null,
    "food_cost": null,
    "utilities": null,
    "supplies": null,
    "management_fee": null,
    "insurance": null,
    "property_tax": null,
    "other_expenses": null,
    "confidence": "high/medium/low",
    "source": "document name, page/section"
  },
  "profitability": {
    "net_income": null,
    "ebit": null,
    "ebitda": null,
    "ebitdar": null,
    "noi": null,
    "confidence": "high/medium/low",
    "calculation_notes": "how you calculated EBITDA/EBITDAR if not explicit"
  }
}

CALCULATION RULES:
- EBIT = Net Income + Interest + Taxes
- EBITDA = EBIT + Depreciation + Amortization
- EBITDAR = EBITDA + Rent/Lease
- NOI = Revenue - Operating Expenses (excluding debt service)

Return ONLY valid JSON. All monetary values in raw numbers (no $ or commas).

DOCUMENT TEXT:
${documentText.substring(0, 40000)}`;
}

/**
 * Prompt for extracting monthly financial trends
 */
function getMonthlyFinancialsPrompt(matchedFacility, documentText) {
  const context = generateSystemContext(matchedFacility, 'SNF');

  return `${context}

TASK: Extract Monthly Financial Trends (12 months)

Look for:
- Monthly P&L breakdowns
- Trended financial reports
- Month-over-month comparisons

EXTRACT THIS STRUCTURE:

{
  "monthly_financials": [
    {
      "month": "YYYY-MM",
      "revenue": null,
      "expenses": null,
      "net_income": null,
      "source": "document, page"
    }
  ],
  "data_completeness": "12 of 12 months found",
  "trend_notes": "any notable trends observed"
}

Return array of 12 months if available. Partial data is acceptable - include what you find.
Return ONLY valid JSON.

DOCUMENT TEXT:
${documentText.substring(0, 40000)}`;
}

/**
 * Prompt for extracting census and occupancy data
 */
function getCensusPrompt(matchedFacility, documentText) {
  const context = generateSystemContext(matchedFacility, 'SNF');
  const licensedBeds = matchedFacility?.total_beds || matchedFacility?.capacity;

  return `${context}

TASK: Extract Census & Occupancy Data

KNOWN: Licensed beds/units = ${licensedBeds || 'Check documents'}

Look for:
- Census reports, occupancy summaries
- Monthly census trends
- Payer mix breakdowns (by census days, not just revenue)

EXTRACT THIS STRUCTURE:

{
  "current_census": {
    "average_daily_census": null,
    "occupancy_pct": null,
    "as_of_date": "YYYY-MM-DD",
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "payer_mix_by_census": {
    "medicaid_pct": null,
    "medicare_pct": null,
    "private_pay_pct": null,
    "other_pct": null,
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "monthly_census": [
    {
      "month": "YYYY-MM",
      "avg_daily_census": null,
      "occupancy_pct": null,
      "medicaid_days": null,
      "medicare_days": null,
      "private_days": null
    }
  ],
  "census_notes": "any observations about trends or anomalies"
}

CALCULATION:
- Occupancy % = (Average Daily Census / Licensed Beds) * 100
- Payer Mix % = (Payer Days / Total Days) * 100

Return ONLY valid JSON.

DOCUMENT TEXT:
${documentText.substring(0, 40000)}`;
}

/**
 * Prompt for extracting rate schedules
 */
function getRateSchedulePrompt(matchedFacility, facilityType, documentText) {
  const context = generateSystemContext(matchedFacility, facilityType);

  const typeSpecificInstructions = facilityType === 'ALF'
    ? `For ALF, look for:
- Base rent by unit type (Studio, 1BR, 2BR)
- Care level add-ons (Level 1, 2, 3, etc.)
- Community fees, second person fees
- Medicaid waiver rates if applicable`
    : `For SNF, look for:
- Medicare Part A rates (RUG or PDPM)
- Medicaid per diem rates
- Private pay daily rates
- Ancillary service rates`;

  return `${context}

TASK: Extract Rate Schedule Information

${typeSpecificInstructions}

EXTRACT THIS STRUCTURE:

{
  "private_pay_rates": {
    "rates": [
      {
        "unit_type": "Studio/1BR/2BR or Room Type",
        "base_rate": null,
        "rate_type": "daily/monthly",
        "care_levels": {
          "level_1": null,
          "level_2": null,
          "level_3": null
        }
      }
    ],
    "effective_date": "YYYY-MM-DD",
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "medicaid_rates": {
    "rates": [
      {
        "level_or_rug": "Level 1 / RUG category",
        "daily_rate": null
      }
    ],
    "effective_date": "YYYY-MM-DD",
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "medicare_rates": {
    "rates": [
      {
        "category": "PDPM category or description",
        "daily_rate": null
      }
    ],
    "effective_date": "YYYY-MM-DD",
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "other_fees": {
    "community_fee": null,
    "second_person_fee": null,
    "ancillary_rates": []
  }
}

Return ONLY valid JSON. All rates as raw numbers.

DOCUMENT TEXT:
${documentText.substring(0, 40000)}`;
}

/**
 * Prompt for extracting deal terms and pricing
 */
function getDealTermsPrompt(matchedFacility, facilityType, documentText) {
  const context = generateSystemContext(matchedFacility, facilityType);
  const beds = matchedFacility?.total_beds || matchedFacility?.capacity;

  return `${context}

TASK: Extract Deal Terms & Pricing

KNOWN: Beds/Units = ${beds || 'Unknown'}

Look for:
- Asking price, purchase price, or offer amount
- Price per bed/unit calculations
- Cap rate targets or implied cap rate
- Transaction structure details

EXTRACT THIS STRUCTURE:

{
  "pricing": {
    "asking_price": null,
    "purchase_price": null,
    "price_per_bed": null,
    "price_per_unit": null,
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "valuation_metrics": {
    "implied_cap_rate": null,
    "revenue_multiple": null,
    "ebitda_multiple": null,
    "ebitdar_multiple": null,
    "confidence": "high/medium/low",
    "calculation_notes": "how metrics were calculated or found"
  },
  "deal_structure": {
    "deal_type": "acquisition/disposition/lease",
    "transaction_type": "asset sale/stock sale/lease assignment",
    "real_estate_included": true/false,
    "operations_included": true/false,
    "source": "document, page"
  },
  "seller_info": {
    "seller_name": null,
    "seller_company": null,
    "broker_name": null,
    "broker_company": null,
    "contact_email": null,
    "contact_phone": null
  }
}

CALCULATION (if not explicit):
- Price per bed = Purchase Price / Total Beds
- Implied Cap Rate = NOI / Purchase Price * 100

Return ONLY valid JSON. All monetary values as raw numbers.

DOCUMENT TEXT:
${documentText.substring(0, 40000)}`;
}

/**
 * Prompt for extracting expense detail (for pro forma analysis)
 */
function getExpenseDetailPrompt(matchedFacility, documentText) {
  const context = generateSystemContext(matchedFacility, 'SNF');

  return `${context}

TASK: Extract Detailed Expense Breakdown (for benchmarking)

Look for detailed P&L with line item expenses. We need granular expense data to compare against industry benchmarks.

EXTRACT THIS STRUCTURE:

{
  "expense_detail": {
    "period": "T12 ending YYYY-MM-DD",

    "direct_care": {
      "nursing_salaries": null,
      "nursing_benefits": null,
      "agency_staffing": null,
      "medical_supplies": null,
      "pharmacy": null,
      "subtotal": null
    },

    "dietary": {
      "dietary_wages": null,
      "raw_food_cost": null,
      "dietary_supplies": null,
      "subtotal": null
    },

    "housekeeping_laundry": {
      "wages": null,
      "supplies": null,
      "laundry_linen": null,
      "subtotal": null
    },

    "maintenance": {
      "wages": null,
      "repairs": null,
      "grounds": null,
      "subtotal": null
    },

    "administration": {
      "admin_salaries": null,
      "management_fee": null,
      "professional_fees": null,
      "bad_debt": null,
      "subtotal": null
    },

    "utilities": {
      "electric": null,
      "gas": null,
      "water_sewer": null,
      "cable_phone": null,
      "subtotal": null
    },

    "property": {
      "property_tax": null,
      "insurance": null,
      "rent_lease": null,
      "depreciation": null,
      "interest": null,
      "subtotal": null
    },

    "confidence": "high/medium/low",
    "source": "document, page",
    "notes": "any observations about expense structure"
  },

  "expense_ratios": {
    "labor_pct_of_revenue": null,
    "agency_pct_of_labor": null,
    "food_cost_per_day": null,
    "management_fee_pct": null,
    "bad_debt_pct": null,
    "utilities_pct": null
  }
}

Return ONLY valid JSON. All values as raw numbers.

DOCUMENT TEXT:
${documentText.substring(0, 40000)}`;
}

/**
 * Prompt for deal-level portfolio summary (for multi-facility deals)
 */
function getPortfolioSummaryPrompt(facilities, documentText) {
  const facilityList = facilities.map(f =>
    `- ${f.facility_name || f.detected?.name || 'Unknown'} (${f.city || f.detected?.city || ''}, ${f.state || f.detected?.state || ''}) - ${f.total_beds || f.capacity || f.detected?.beds || '?'} beds`
  ).join('\n');

  return `You are extracting portfolio-level summary data for a multi-facility M&A deal.

CONFIRMED FACILITIES IN THIS PORTFOLIO:
${facilityList}

TASK: Extract Portfolio-Level Deal Information

Look for:
- Combined/aggregate pricing
- Portfolio-level metrics
- Deal rationale and strategy
- Pro forma projections for the combined portfolio

EXTRACT THIS STRUCTURE:

{
  "portfolio_summary": {
    "deal_name": null,
    "total_facilities": ${facilities.length},
    "total_beds": null,
    "total_purchase_price": null,
    "blended_price_per_bed": null,
    "confidence": "high/medium/low",
    "source": "document, page"
  },
  "combined_financials": {
    "total_revenue": null,
    "total_ebitda": null,
    "total_ebitdar": null,
    "blended_occupancy": null,
    "blended_payer_mix": {
      "medicaid_pct": null,
      "medicare_pct": null,
      "private_pay_pct": null
    }
  },
  "deal_rationale": {
    "investment_thesis": null,
    "synergy_opportunities": [],
    "key_risks": [],
    "source": "document, page"
  },
  "pro_forma": {
    "year_1_revenue": null,
    "year_1_ebitda": null,
    "stabilized_revenue": null,
    "stabilized_ebitda": null,
    "stabilization_timeline": null,
    "assumptions": []
  }
}

Return ONLY valid JSON.

DOCUMENT TEXT:
${documentText.substring(0, 50000)}`;
}

/**
 * Generate all prompts for a single facility extraction
 * Returns array of focused extraction tasks
 */
function generateFacilityExtractionPrompts(matchedFacility, facilityType, documentText) {
  return [
    {
      name: 't12_financials',
      prompt: getT12FinancialsPrompt(matchedFacility, documentText),
      priority: 1
    },
    {
      name: 'monthly_financials',
      prompt: getMonthlyFinancialsPrompt(matchedFacility, documentText),
      priority: 2
    },
    {
      name: 'census',
      prompt: getCensusPrompt(matchedFacility, documentText),
      priority: 1
    },
    {
      name: 'rate_schedule',
      prompt: getRateSchedulePrompt(matchedFacility, facilityType, documentText),
      priority: 2
    },
    {
      name: 'deal_terms',
      prompt: getDealTermsPrompt(matchedFacility, facilityType, documentText),
      priority: 1
    },
    {
      name: 'expense_detail',
      prompt: getExpenseDetailPrompt(matchedFacility, documentText),
      priority: 3
    }
  ];
}

/**
 * Build facility-specific extraction prompt that skips DB-matched fields
 */
function buildFacilityExtractionPrompt(confirmedFacility, documentText, skipFields = []) {
  const facilityName = confirmedFacility.matched?.facility_name || confirmedFacility.detected?.name || 'Unknown';
  const facilityType = confirmedFacility.detected?.facility_type || 'SNF';

  const skipFieldsNote = skipFields.length > 0
    ? `\n\nDO NOT EXTRACT these fields (already from database): ${skipFields.slice(0, 10).join(', ')}`
    : '';

  return `You are extracting deal-specific data for: ${facilityName}

FACILITY TYPE: ${facilityType}
LOCATION: ${confirmedFacility.matched?.city || confirmedFacility.detected?.city || ''}, ${confirmedFacility.matched?.state || confirmedFacility.detected?.state || ''}
BEDS: ${confirmedFacility.matched?.total_beds || confirmedFacility.matched?.capacity || confirmedFacility.detected?.beds || 'Unknown'}
${skipFieldsNote}

Focus on extracting financial data, census/occupancy, rates, and deal terms for THIS SPECIFIC FACILITY.

Return a JSON object with:
{
  "facility_name": "${facilityName}",
  "t12_revenue": null,
  "t12_expenses": null,
  "t12_ebitda": null,
  "t12_ebitdar": null,
  "average_daily_census": null,
  "occupancy_pct": null,
  "medicaid_pct": null,
  "medicare_pct": null,
  "private_pay_pct": null,
  "purchase_price": null,
  "price_per_bed": null,
  "monthly_trends": [],
  "rate_schedules": {},
  "expense_detail": {},
  "source_documents": []
}

Return ONLY valid JSON.

DOCUMENT TEXT:
${documentText.substring(0, 45000)}`;
}

module.exports = {
  // Context generation
  generateSystemContext,

  // Individual prompts
  getT12FinancialsPrompt,
  getMonthlyFinancialsPrompt,
  getCensusPrompt,
  getRateSchedulePrompt,
  getDealTermsPrompt,
  getExpenseDetailPrompt,
  getPortfolioSummaryPrompt,

  // Batch generation
  generateFacilityExtractionPrompts,
  buildFacilityExtractionPrompt
};
