/**
 * CIM Extractor - Comprehensive single-prompt extraction for CIMs/Offering Memorandums
 *
 * This approach differs from our parallel 6-prompt system:
 * 1. Single comprehensive prompt with full document context
 * 2. Per-facility structure is the DEFAULT, not an exception
 * 3. Explicit "Not disclosed" handling to prevent hallucination
 * 4. Built-in validation instructions
 * 5. Narrative synthesis (NOI bridge, executive summary, risks)
 * 6. CIM section-aware parsing
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 64000;

/**
 * Comprehensive CIM Extraction Prompt
 * Designed for Offering Memorandums / CIMs in healthcare M&A
 */
const CIM_EXTRACTION_PROMPT = `You are a healthcare M&A analyst extracting structured data from a Confidential Information Memorandum (CIM) or Offering Memorandum for skilled nursing or senior living facilities.

## CRITICAL RULES

1. **"Not disclosed" over guessing**: If information is not clearly stated, use "not_disclosed" - never guess or infer numbers
2. **Per-facility is default**: For portfolios, extract data FOR EACH FACILITY separately
3. **Distinguish actual vs pro-forma**: Current/TTM numbers vs broker projections must be clearly separated
4. **Subject vs competitor**: Only extract financials for SUBJECT properties being sold
5. **Validate your math**: Revenue components should sum to total, occupancy should match census/beds
6. **Date everything**: Include "as of" dates for occupancy, financials, census
7. **SEPARATE DATA FROM ANALYSIS**: Numbers and metrics go in structured fields (noi_bridge, cim_facilities, market_analysis, value_add_thesis). The executive_summary narratives (the_story, the_opportunity, the_market, the_deal) should contain ONLY qualitative analysis, context, and insights - NEVER repeat numbers that are already captured in data fields. If you're writing a dollar amount, percentage, or statistic in executive_summary, you're doing it wrong.
8. **SOURCE ATTRIBUTION IS MANDATORY**: For NOI bridge and value-add thesis:
   - Set "broker_provided": true ONLY if the CIM explicitly provides this analysis
   - Set "source": "cim_provided" if broker/seller explicitly states the information
   - Set "source": "calculated" if you derive it from other CIM data (e.g., calculating current NOI from revenue/expenses)
   - Set "source": "not_disclosed" if the information is not available at all
   - Always include "notes" explaining where the data came from

## HANDLING MISSING NOI BRIDGE / VALUE-ADD THESIS

**If the CIM does NOT include an explicit NOI bridge:**
- Set noi_bridge.source = "calculated" or "not_disclosed"
- Set noi_bridge.broker_provided = false
- If you CAN calculate current NOI from TTM financials, do so and note: "Current NOI calculated from TTM revenue minus expenses - no broker-provided NOI bridge"
- Leave day_1_adjustments and stabilization_adjustments as empty arrays []
- Set new_operator_day_1_noi and stabilized_noi to the same value as current_operator_noi if no pro-forma is provided
- In notes, clearly state: "NOI bridge not provided in CIM. Current NOI derived from TTM financials. Day 1 and stabilized projections require buyer's own underwriting."

**If the CIM does NOT include explicit value-add thesis:**
- Set value_add_thesis.source = "not_disclosed"
- Set value_add_thesis.broker_provided = false
- Leave opportunity arrays as empty: []
- In notes, state: "No explicit value-add thesis or upside opportunities identified in CIM. Buyer should develop own investment thesis based on market analysis and operational review."

**If the CIM DOES provide these sections:**
- Set source = "cim_provided"
- Set broker_provided = true
- Quote or closely paraphrase the broker's language
- In notes, reference the CIM section (e.g., "From 'Investment Highlights' section of CIM")

## DOCUMENT PARSING HINTS

Look for these common CIM section headers:
- "Executive Summary" / "Investment Summary" / "Transaction Overview"
- "Investment Highlights" / "Investment Considerations"
- "Portfolio Overview" / "Property Overview" / "Asset Summary"
- "Financial Overview" / "Financial Summary" / "Operating Performance"
- "Pro-Forma Analysis" / "Value-Add Opportunity" / "Upside Potential"
- "Market Overview" / "Demographics" / "Competition"
- "Reimbursement" / "Rate Analysis" / "Medicaid Overview"

## OUTPUT FORMAT

Return valid JSON with this exact structure:

{
  "deal_overview": {
    "project_name": "string or not_disclosed",
    "asset_type": "SNF|ALF|IL|Memory Care|CCRC|Mixed",
    "facility_count": "number",
    "total_beds": "number (licensed)",
    "total_functional_beds": "number (operational) or not_disclosed",
    "locations_summary": "string (e.g., 'Sheridan, WY and Cheyenne, WY')",
    "asking_price": "number or 'TBD by market' or not_disclosed",
    "price_per_bed": "number or not_disclosed",
    "transaction_structure": "Asset Sale|Stock Sale|Lease Assignment|Real Estate Only",
    "broker": "string or not_disclosed",
    "broker_contact": "string or not_disclosed",
    "bid_deadline": "string date or 'TBD' or not_disclosed"
  },

  "ownership_narrative": {
    "current_owner": "string or not_disclosed",
    "ownership_tenure": "string (how long owned) or not_disclosed",
    "acquisition_history": "string or not_disclosed",
    "seller_motivation": "string (why selling) or not_disclosed",
    "urgency_indicators": "string or not_disclosed",
    "transition_support": "string or not_disclosed",
    "narrative_summary": "string (2-3 sentences capturing the ownership story)"
  },

  "facilities": [
    {
      "facility_name": "string",
      "address": "string or not_disclosed",
      "city": "string",
      "state": "string (2-letter)",
      "zip_code": "string or not_disclosed",
      "facility_type": "SNF|ALF|IL|Memory Care",
      "licensed_beds": "number",
      "functional_beds": "number or not_disclosed",
      "year_built": "number or not_disclosed",
      "last_renovation": "string or not_disclosed",

      "census_and_occupancy": {
        "current_occupancy_pct": "number",
        "occupancy_date": "string (as of date)",
        "occupancy_trend": "Improving|Declining|Stable|Volatile",
        "census_low_point": "string or not_disclosed",
        "census_drivers": "string or not_disclosed"
      },

      "payer_mix": {
        "medicare_pct": "number or not_disclosed",
        "medicaid_pct": "number or not_disclosed",
        "medicaid_enhanced_pct": "number or not_disclosed",
        "private_pay_pct": "number or not_disclosed",
        "managed_care_pct": "number or not_disclosed",
        "va_pct": "number or not_disclosed",
        "hospice_pct": "number or not_disclosed"
      },

      "quality_ratings": {
        "cms_star_rating": "number (1-5) or not_disclosed",
        "health_inspection_rating": "number or not_disclosed",
        "staffing_rating": "number or not_disclosed",
        "survey_issues": "string or not_disclosed"
      },

      "staffing": {
        "administrator_tenure": "string or not_disclosed",
        "don_tenure": "string or not_disclosed",
        "mds_coordinator_status": "string or not_disclosed",
        "staffing_challenges": "string or not_disclosed",
        "hppd": "number or not_disclosed"
      },

      "financials": {
        "reporting_period": "string (e.g., 'TTM ending 7/31/2025')",
        "total_revenue": "number",
        "revenue_breakdown": {
          "medicare_revenue": "number or not_disclosed",
          "medicaid_revenue": "number or not_disclosed",
          "private_pay_revenue": "number or not_disclosed",
          "managed_care_revenue": "number or not_disclosed",
          "other_revenue": "number or not_disclosed",
          "ancillary_revenue": "number or not_disclosed",
          "upl_income": "number or not_disclosed"
        },
        "total_expenses": "number",
        "expense_breakdown": {
          "nursing_labor": "number or not_disclosed",
          "dietary": "number or not_disclosed",
          "rehab_therapy": "number or not_disclosed",
          "pharmacy": "number or not_disclosed",
          "admin_general": "number or not_disclosed",
          "payroll_taxes_benefits": "number or not_disclosed",
          "insurance": "number or not_disclosed",
          "property_tax": "number or not_disclosed",
          "bed_tax": "number or not_disclosed",
          "bad_debt": "number or not_disclosed",
          "management_fee": "number or not_disclosed",
          "utilities": "number or not_disclosed",
          "other": "number or not_disclosed"
        },
        "ebitdarm": "number or not_disclosed",
        "ebitdar": "number or not_disclosed",
        "noi": "number or not_disclosed",
        "noi_margin_pct": "number or not_disclosed"
      },

      "physical_plant": {
        "building_age_years": "number or not_disclosed",
        "private_rooms": "number or not_disclosed",
        "semi_private_rooms": "number or not_disclosed",
        "special_features": "string or not_disclosed",
        "deferred_maintenance": "string or not_disclosed",
        "capex_requirements": "string or not_disclosed"
      }
    }
  ],

  "portfolio_financials": {
    "reporting_period": "string",
    "combined_revenue": "number",
    "combined_expenses": "number",
    "combined_noi": "number",
    "combined_ebitdar": "number or not_disclosed",
    "blended_occupancy_pct": "number",
    "revenue_per_occupied_bed_day": "number or not_disclosed"
  },

  "value_add_thesis": {
    "source": "cim_provided | not_disclosed",
    "broker_provided": "boolean (true if explicitly stated in CIM, false if not present)",
    "reimbursement_opportunities": [
      {
        "opportunity": "string",
        "description": "string",
        "dollar_impact": "number or not_disclosed"
      }
    ],
    "expense_reduction_opportunities": [
      {
        "opportunity": "string",
        "description": "string",
        "dollar_impact": "number or not_disclosed"
      }
    ],
    "census_opportunities": [
      {
        "opportunity": "string",
        "description": "string",
        "dollar_impact": "number or not_disclosed"
      }
    ],
    "operational_improvements": ["string"],
    "notes": "string (any caveats about the source of this data)"
  },

  "noi_bridge": {
    "_extraction_guidance": "CRITICAL: CIMs show NOI at different stages. Extract the AS-IS actual performance AND the PRO-FORMA projected performance. Look for various label formats - CIMs use different terminology.",
    "source": "cim_provided | not_disclosed | calculated",
    "broker_provided": "boolean (true if broker explicitly provides NOI bridge, false if you calculated it from financials)",

    "current_noi": "number (The ACTUAL as-is NOI from current operations. Look for labels like: 'Current NOI', 'TTM NOI', 'Trailing 12 NOI', 'As-Is NOI', 'Current Operator NOI', 'Actual NOI', 'Historical NOI'. This represents real performance, not projections.)",
    "current_noi_label": "string (the exact label used in the CIM, e.g., 'Current Operator Adj NOI')",
    "current_noi_source": "string (where this number came from)",

    "day_1_adjustments": [
      {
        "item": "string (e.g., 'Management fee adjustment', 'UPL income increase', 'Insurance savings')",
        "amount": "number (positive = adds to NOI, negative = subtracts from NOI)",
        "source": "cim_stated | analyst_estimate"
      }
    ],

    "day_1_noi": "number (The PRO-FORMA Day 1 NOI after initial adjustments. Look for labels like: 'Day 1 NOI', 'Pro Forma NOI', 'Adjusted NOI', 'New Operator NOI', 'Post-Acquisition NOI', 'Year 1 NOI'. This equals current_noi + sum of day_1_adjustments.)",
    "day_1_noi_label": "string (the exact label used in the CIM, e.g., 'New Operator Day 1 Adj NOI After UPL')",
    "day_1_noi_source": "string (where this number came from)",

    "stabilization_adjustments": [
      {
        "item": "string (e.g., 'Census improvement to 90%', 'Rate increases', 'Expense reductions')",
        "amount": "number",
        "source": "cim_stated | analyst_estimate"
      }
    ],

    "stabilized_noi": "number (Fully stabilized NOI after all improvements - typically 18-36 months out. Look for: 'Stabilized NOI', 'Year 3 NOI', 'Target NOI', 'Pro Forma Stabilized'.)",
    "stabilized_noi_label": "string (the exact label used in the CIM)",
    "stabilization_timeline": "string or not_disclosed",
    "notes": "string (any caveats, e.g., 'NOI bridge not explicitly provided in CIM - current NOI calculated from TTM financials')"
  },

  "reimbursement_detail": {
    "state": "string",
    "medicaid_rate_system": "string (e.g., 'PDPM', 'Cost-based', 'Case-mix')",
    "current_medicaid_rates": {
      "base_rate": "number or not_disclosed",
      "enhanced_care_rate": "number or not_disclosed"
    },
    "case_mix_index": {
      "current": "number or not_disclosed",
      "state_average": "number or not_disclosed",
      "target": "number or not_disclosed"
    },
    "upl_program": {
      "participating": "boolean",
      "current_income": "number or not_disclosed",
      "current_split": "string (e.g., '70/30') or not_disclosed",
      "renegotiation_potential": "string or not_disclosed"
    },
    "medicare_rates": {
      "average_rate_per_day": "number or not_disclosed",
      "area_wage_index": "number or not_disclosed",
      "awi_change_pending": "string or not_disclosed"
    },
    "va_contract": {
      "has_contract": "boolean or not_disclosed",
      "va_opportunity": "string or not_disclosed"
    }
  },

  "market_analysis": {
    "markets": [
      {
        "market_name": "string",
        "population_15_mile": "number or not_disclosed",
        "age_65_plus_growth": "string or not_disclosed",
        "age_85_plus_growth": "string or not_disclosed"
      }
    ],
    "referral_sources": [
      {
        "hospital_name": "string",
        "distance_miles": "number",
        "beds": "number or not_disclosed",
        "annual_discharges": "number or not_disclosed",
        "medicare_patients": "number or not_disclosed"
      }
    ],
    "competitors": [
      {
        "facility_name": "string",
        "operator": "string or not_disclosed",
        "beds": "number",
        "year_built": "number or not_disclosed",
        "distance_miles": "number",
        "notes": "string or not_disclosed"
      }
    ],
    "total_competing_beds": "number or not_disclosed",
    "subject_market_share_pct": "number or not_disclosed",
    "barriers_to_entry": "string or not_disclosed"
  },

  "deal_mechanics": {
    "sale_type": "Asset Sale|Stock Sale|Real Estate Only",
    "whats_included": "string or not_disclosed",
    "whats_excluded": "string or not_disclosed",
    "assumable_debt": "boolean or not_disclosed",
    "seller_financing": "boolean or not_disclosed",
    "process_phase": "Marketing|LOI|Due Diligence|Closing",
    "earnest_money": "string or not_disclosed",
    "due_diligence_period": "string or not_disclosed"
  },

  "risks_and_gaps": {
    "disclosed_risks": [
      {
        "risk": "string",
        "detail": "string"
      }
    ],
    "inferred_risks": [
      {
        "risk": "string",
        "observation": "string (what you noticed that isn't explicitly stated)"
      }
    ],
    "information_gaps": [
      {
        "gap": "string",
        "why_it_matters": "string"
      }
    ],
    "due_diligence_priorities": ["string (top 5-7 items to verify)"]
  },

  "executive_summary": {
    "the_story": "string (1 paragraph QUALITATIVE ONLY: who's selling and why, operator history, strategic context. DO NOT include numbers like beds, occupancy, revenue - those are in separate data fields. Focus on the narrative: ownership transition reasons, operational challenges, seller motivations, and historical context that explains current performance)",
    "the_opportunity": "string (1 paragraph QUALITATIVE ANALYSIS ONLY: explain WHY the value-add thesis is achievable or risky, what operational execution is required, and the realistic path to improvement. DO NOT repeat NOI numbers, dollar amounts, or percentages - those are displayed in data tables. Focus on: execution complexity, operator capability requirements, timeline realism, and what could go wrong)",
    "the_market": "string (1 paragraph QUALITATIVE ONLY: competitive dynamics, referral relationship quality, demand drivers, and market positioning. DO NOT repeat population numbers, competitor bed counts, or growth percentages - those are in data tables. Focus on: why this market is favorable/unfavorable, competitive moats, referral source reliability, and demand sustainability)",
    "the_deal": "string (1 paragraph on KEY RISKS AND EXECUTION REQUIREMENTS: realistic assessment of what must go right for this deal to succeed. Include: execution risks, pro-forma assumptions that may be aggressive, operational challenges, capex requirements, and factors that could derail returns. This is the 'eyes wide open' section - be candid about risks)"
  }
}

## VALIDATION CHECKLIST (Apply Before Returning)

1. Per-facility revenues should sum to portfolio total (within 5%)
2. Payer mix percentages should sum to ~100% per facility
3. Occupancy % should align with census ÷ beds
4. Expense breakdown should sum to total expenses (within 5%)
5. NOI = Revenue - Expenses (verify the math)
6. NOI Bridge: Current NOI + Adjustments = Day 1 NOI (verify)
7. All dates are included for time-sensitive metrics
8. "not_disclosed" used for missing data, not null or empty strings

## FINAL INSTRUCTION

Extract ALL available information from the CIM. For portfolio deals, ensure each facility has its own complete data set. The output should enable an investment decision without referring back to the source document.

Return ONLY valid JSON, no markdown code blocks.`;


/**
 * Run comprehensive CIM extraction
 * @param {string} documentText - Full CIM text content
 * @param {string} dealName - Optional deal name hint
 * @returns {Promise<Object>} Extracted data
 */
async function runCIMExtraction(documentText, dealName = null) {
  const startTime = Date.now();

  try {
    console.log('[CIMExtractor] Starting comprehensive CIM extraction...');
    console.log(`[CIMExtractor] Document length: ${documentText.length.toLocaleString()} characters`);

    // Truncate if necessary (Claude has ~200K context, but we want to leave room for output)
    const MAX_INPUT_CHARS = 150000;
    if (documentText.length > MAX_INPUT_CHARS) {
      console.log(`[CIMExtractor] Truncating from ${documentText.length} to ${MAX_INPUT_CHARS} chars`);
      documentText = documentText.substring(0, MAX_INPUT_CHARS);
    }

    let userPrompt = 'Extract all deal information from this CIM/Offering Memorandum:\n\n';
    if (dealName) {
      userPrompt += `Deal Name Hint: ${dealName}\n\n`;
    }
    userPrompt += documentText;

    // Use streaming to avoid timeout for long-running extractions
    console.log('[CIMExtractor] Starting streaming extraction...');
    let responseText = '';

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: CIM_EXTRACTION_PROMPT,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    // Collect streamed response
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        responseText += event.delta.text;
      }
    }

    console.log(`[CIMExtractor] Streaming complete, received ${responseText.length} chars`);
    const duration = Date.now() - startTime;
    console.log(`[CIMExtractor] Extraction completed in ${duration}ms`);

    // Parse JSON response
    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
      console.log('[CIMExtractor] JSON parsed successfully');
    } catch (parseError) {
      console.log('[CIMExtractor] Initial JSON parse failed, attempting repair...');

      // Try to extract JSON from response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
        || responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];
        // Clean common issues
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
        jsonStr = jsonStr.replace(/\\n/g, ' '); // Replace literal \n
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control chars

        try {
          extractedData = JSON.parse(jsonStr);
          console.log('[CIMExtractor] JSON repair successful');
        } catch (repairError) {
          console.error('[CIMExtractor] JSON repair failed:', repairError.message);
          return {
            success: false,
            error: `JSON parse error: ${repairError.message}`,
            rawResponse: responseText.substring(0, 1000)
          };
        }
      } else {
        return {
          success: false,
          error: 'No JSON found in response',
          rawResponse: responseText.substring(0, 1000)
        };
      }
    }

    // Log summary
    console.log('[CIMExtractor] Extraction summary:');
    console.log(`  - Deal: ${extractedData.deal_overview?.project_name}`);
    console.log(`  - Facilities: ${extractedData.facilities?.length}`);
    console.log(`  - Portfolio Revenue: $${extractedData.portfolio_financials?.combined_revenue?.toLocaleString()}`);
    console.log(`  - Portfolio NOI: $${extractedData.portfolio_financials?.combined_noi?.toLocaleString()}`);

    return {
      success: true,
      data: extractedData,
      duration,
      model: MODEL,
      inputChars: documentText.length
    };

  } catch (error) {
    console.error('[CIMExtractor] Extraction error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Transform CIM extraction to match our frontend schema
 * Maps the comprehensive CIM output to the structure DealExtractionViewer expects
 * @param {Object} cimData - Output from runCIMExtraction
 * @returns {Object} Transformed data matching frontend schema
 */
function transformCIMToFrontendSchema(cimData) {
  if (!cimData) return null;

  const facilities = cimData.facilities || [];
  const firstFacility = facilities[0] || {};

  return {
    // Deal Information (General Info tab)
    deal_information: {
      deal_name: { value: cimData.deal_overview?.project_name, confidence: 'high', source: 'CIM' },
      deal_type: { value: cimData.deal_overview?.asset_type, confidence: 'high', source: 'CIM' },
      deal_source: { value: cimData.deal_overview?.broker, confidence: 'high', source: 'CIM' },
      priority_level: { value: null, confidence: 'not_found' },
      purchase_price: {
        value: cimData.deal_overview?.asking_price === 'not_disclosed' ? null : cimData.deal_overview?.asking_price,
        confidence: cimData.deal_overview?.asking_price === 'not_disclosed' ? 'not_found' : 'high',
        source: 'CIM'
      },
      price_per_bed: {
        value: cimData.deal_overview?.price_per_bed === 'not_disclosed' ? null : cimData.deal_overview?.price_per_bed,
        confidence: cimData.deal_overview?.price_per_bed === 'not_disclosed' ? 'not_found' : 'high',
        source: 'CIM'
      }
    },

    // Contact Information
    contact_information: {
      primary_contact_name: { value: cimData.deal_overview?.broker_contact || null, confidence: cimData.deal_overview?.broker_contact ? 'medium' : 'not_found', source: 'CIM' },
      title: { value: null, confidence: 'not_found' },
      phone: { value: null, confidence: 'not_found' },
      email: { value: null, confidence: 'not_found' },
      ownership: { value: cimData.ownership_narrative?.current_owner || null, confidence: cimData.ownership_narrative?.current_owner ? 'high' : 'not_found', source: 'CIM' }
    },

    // Deal Overview (Deal Overview tab) - Portfolio level
    deal_overview: {
      summary_1000_chars: cimData.executive_summary ?
        `${cimData.executive_summary.the_story} ${cimData.executive_summary.the_opportunity}`.substring(0, 1000) : null,

      facility_snapshot: {
        facility_name: cimData.deal_overview?.project_name,
        facility_type: cimData.deal_overview?.asset_type,
        licensed_beds: cimData.deal_overview?.total_beds,
        current_occupancy_pct: cimData.portfolio_financials?.blended_occupancy_pct,
        city: cimData.deal_overview?.locations_summary,
        state: facilities.map(f => f.state).filter(Boolean).join(', ')
      },

      ttm_financials: {
        period: cimData.portfolio_financials?.reporting_period,
        revenue: cimData.portfolio_financials?.combined_revenue,
        expenses: cimData.portfolio_financials?.combined_expenses,
        net_income: cimData.portfolio_financials?.combined_noi,
        net_income_margin_pct: cimData.portfolio_financials?.combined_noi && cimData.portfolio_financials?.combined_revenue
          ? Math.round((cimData.portfolio_financials.combined_noi / cimData.portfolio_financials.combined_revenue) * 1000) / 10
          : null,
        rent_lease: null,
        interest: null,
        depreciation: null
      },

      payer_mix: {
        medicaid_pct: facilities.length > 0
          ? Math.round(facilities.reduce((sum, f) => sum + (f.payer_mix?.medicaid_pct || 0), 0) / facilities.length)
          : null,
        private_pay_pct: facilities.length > 0
          ? Math.round(facilities.reduce((sum, f) => sum + (f.payer_mix?.private_pay_pct || 0), 0) / facilities.length)
          : null,
        medicare_pct: facilities.length > 0
          ? Math.round(facilities.reduce((sum, f) => sum + (f.payer_mix?.medicare_pct || 0), 0) / facilities.length)
          : null
      },

      operating_trends: {
        revenue_trend: null,
        census_trend: facilities.some(f => f.census_and_occupancy?.occupancy_trend === 'Declining') ? 'DOWN' :
                      facilities.some(f => f.census_and_occupancy?.occupancy_trend === 'Improving') ? 'UP' : 'FLAT',
        net_income_trend: null
      },

      red_flags: cimData.risks_and_gaps?.disclosed_risks?.map(r => ({
        issue: r.risk,
        impact: r.detail,
        severity: 'Significant'
      })) || [],

      strengths: cimData.value_add_thesis?.reimbursement_opportunities?.map(o => ({
        strength: o.opportunity,
        value: o.dollar_impact ? `$${o.dollar_impact.toLocaleString()} potential` : o.description
      })) || [],

      turnaround: {
        required: (cimData.noi_bridge?.stabilized_noi || 0) > (cimData.noi_bridge?.current_noi || 0) * 1.2,
        top_initiatives: cimData.value_add_thesis?.operational_improvements || [],
        timeline_months: cimData.noi_bridge?.stabilization_timeline || 'not_disclosed'
      },

      diligence_items: cimData.risks_and_gaps?.due_diligence_priorities || []
    },

    // CIM extraction data - structured for frontend display
    cim_extraction: {
      // Deal overview for header badges
      deal_overview: {
        project_name: cimData.deal_overview?.project_name,
        facility_count: cimData.deal_overview?.facility_count || facilities.length,
        total_beds: cimData.deal_overview?.total_beds,
        locations_summary: cimData.deal_overview?.locations_summary,
        asset_type: cimData.deal_overview?.asset_type,
        asking_price: typeof cimData.deal_overview?.asking_price === 'number' ? cimData.deal_overview.asking_price : null,
        price_per_bed: typeof cimData.deal_overview?.price_per_bed === 'number' ? cimData.deal_overview.price_per_bed : null,
        broker: cimData.deal_overview?.broker !== 'not_disclosed' ? cimData.deal_overview?.broker : null,
        broker_company: null,
        transaction_structure: cimData.deal_overview?.transaction_structure,
        bid_deadline: cimData.deal_overview?.bid_deadline
      },

      // Facilities array for the table in "The Story" section
      cim_facilities: facilities.map(f => ({
        facility_name: f.facility_name,
        city: f.city,
        state: f.state,
        bed_count: f.licensed_beds,
        functional_beds: f.functional_beds !== 'not_disclosed' ? f.functional_beds : null,
        year_built: f.year_built !== 'not_disclosed' ? f.year_built : null,
        cms_rating: f.quality_ratings?.cms_star_rating !== 'not_disclosed' ? f.quality_ratings?.cms_star_rating : null,
        current_occupancy: f.census_and_occupancy?.current_occupancy_pct,
        license_type: f.facility_type
      })),

      // Executive summary sections
      executive_summary: cimData.executive_summary,

      // Ownership narrative
      ownership_narrative: cimData.ownership_narrative,

      // NOI Bridge with explicit source attribution
      noi_bridge: cimData.noi_bridge ? {
        ...cimData.noi_bridge,
        _display_label: cimData.noi_bridge.broker_provided
          ? 'NOI Bridge (From CIM)'
          : cimData.noi_bridge.source === 'calculated'
            ? 'NOI Bridge (Calculated from TTM Financials)'
            : 'NOI Bridge (Not Available)',
        _source_warning: !cimData.noi_bridge.broker_provided
          ? 'This NOI bridge was not explicitly provided by the broker. ' + (cimData.noi_bridge.notes || '')
          : null
      } : null,

      // Value-Add Thesis with explicit source attribution
      value_add_thesis: cimData.value_add_thesis ? {
        ...cimData.value_add_thesis,
        _display_label: cimData.value_add_thesis.broker_provided
          ? 'Value-Add Thesis (From CIM)'
          : 'Value-Add Thesis (Not Provided in CIM)',
        _source_warning: !cimData.value_add_thesis.broker_provided
          ? 'No explicit value-add thesis was provided in the CIM. ' + (cimData.value_add_thesis.notes || '')
          : null,
        _is_broker_thesis: cimData.value_add_thesis.broker_provided === true
      } : null,

      // Risks and gaps
      risks_and_gaps: {
        inferred_risks: cimData.risks_and_gaps?.inferred_risks || [],
        information_gaps: cimData.risks_and_gaps?.information_gaps || [],
        disclosed_risks: cimData.risks_and_gaps?.disclosed_risks || [],
        due_diligence_priorities: cimData.risks_and_gaps?.due_diligence_priorities || []
      },

      // Market analysis for "The Market" section
      market_analysis: cimData.market_analysis,

      // Deal mechanics for "Deal Process" section
      deal_mechanics: cimData.deal_mechanics,

      // Reimbursement details
      reimbursement_detail: cimData.reimbursement_detail
    },

    // Legacy _cim_extended for backward compatibility
    _cim_extended: {
      ownership_narrative: cimData.ownership_narrative,
      noi_bridge: cimData.noi_bridge,
      value_add_thesis: cimData.value_add_thesis,
      market_analysis: cimData.market_analysis,
      reimbursement_detail: cimData.reimbursement_detail,
      deal_mechanics: cimData.deal_mechanics,
      executive_summary: cimData.executive_summary,
      inferred_risks: cimData.risks_and_gaps?.inferred_risks,
      information_gaps: cimData.risks_and_gaps?.information_gaps
    },

    // Per-facility data for facility selector (detailed view)
    _facilities: facilities.map(f => ({
      facility_name: f.facility_name,
      city: f.city,
      state: f.state,
      address: f.address,
      facility_type: f.facility_type,
      licensed_beds: f.licensed_beds,
      functional_beds: f.functional_beds,
      year_built: f.year_built,

      // Census
      occupancy_pct: f.census_and_occupancy?.current_occupancy_pct,
      occupancy_trend: f.census_and_occupancy?.occupancy_trend,

      // Payer mix
      medicare_pct: f.payer_mix?.medicare_pct,
      medicaid_pct: f.payer_mix?.medicaid_pct,
      private_pay_pct: f.payer_mix?.private_pay_pct,

      // Quality
      cms_star_rating: f.quality_ratings?.cms_star_rating,

      // Financials
      revenue: f.financials?.total_revenue,
      expenses: f.financials?.total_expenses,
      noi: f.financials?.noi,
      ebitdar: f.financials?.ebitdar,
      noi_margin_pct: f.financials?.noi_margin_pct,

      // Full financials for detail view
      financials: f.financials,
      payer_mix: f.payer_mix,
      census_and_occupancy: f.census_and_occupancy,
      quality_ratings: f.quality_ratings,
      staffing: f.staffing,
      physical_plant: f.physical_plant
    }))
  };
}


/**
 * Detect if uploaded files contain a CIM
 * @param {Array} files - Array of file objects with name and text
 * @returns {Object} Detection result
 */
function detectCIMDocument(files) {
  const cimIndicators = [
    'confidential information memorandum',
    'offering memorandum',
    'investment summary',
    'investment highlights',
    'investment considerations',
    'executive summary',
    'transaction overview',
    'portfolio overview',
    'value-add opportunity',
    'process overview',
    'bid instructions'
  ];

  const cimFiles = [];
  const otherFiles = [];

  for (const file of files) {
    const fileName = (file.name || '').toLowerCase();
    const content = (file.text || '').toLowerCase().substring(0, 10000); // Check first 10K chars

    const isCIM =
      fileName.includes('cim') ||
      fileName.includes('offering') ||
      fileName.includes('memorandum') ||
      fileName.includes('om_') ||
      cimIndicators.filter(indicator => content.includes(indicator)).length >= 3;

    if (isCIM) {
      cimFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  }

  return {
    hasCIM: cimFiles.length > 0,
    cimFiles,
    otherFiles,
    cimFileNames: cimFiles.map(f => f.name)
  };
}


module.exports = {
  runCIMExtraction,
  transformCIMToFrontendSchema,
  detectCIMDocument,
  CIM_EXTRACTION_PROMPT
};
