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
const MAX_TOKENS = 4096;

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
 */
const EXPENSES_PROMPT = `You are extracting detailed expense breakdowns by department from P&L statements.

DEPARTMENTS TO EXTRACT:
- nursing (or direct_care): Nursing salaries, benefits, agency/contract labor
- dietary (or culinary): Food costs, dietary labor, supplies
- housekeeping: Housekeeping labor, laundry, supplies
- activities: Activities staff, supplies, programs
- social_services: Social worker costs
- plant_operations (or maintenance): Maintenance labor, repairs, utilities
- admin (or g_and_a): Administrative salaries, office, professional fees
- marketing: Marketing and advertising costs
- other: Any other categorized expenses

FOR EACH DEPARTMENT AND MONTH, EXTRACT:
- Salaries/wages
- Benefits
- Agency/contract labor
- Supplies
- Other department-specific costs
- Total for department

Return JSON:
{
  "monthly_expenses": [
    {
      "month": "YYYY-MM",
      "source_document": "filename",
      "department": "nursing",
      "salaries_wages": number|null,
      "benefits": number|null,
      "payroll_taxes": number|null,
      "agency_labor": number|null,
      "contract_labor": number|null,
      "supplies": number|null,
      "other_expenses": number|null,
      "total_department_expense": number|null
    }
  ],
  "summary": {
    "departments_found": ["nursing", "dietary", "admin"],
    "months_covered": ["2024-10", "2024-11"],
    "has_agency_detail": true|false,
    "has_benefit_detail": true|false
  }
}

Return ONLY valid JSON, no markdown.`;


/**
 * Prompt 4: Monthly Census and Occupancy
 */
const CENSUS_PROMPT = `You are extracting monthly census and occupancy data from census reports.

EXTRACT FOR EACH MONTH:
- Total beds/units available
- Average daily census
- Occupancy percentage
- Census days by payer type (Medicaid, Medicare, Private Pay, Other)
- Payer mix percentages
- Admissions and discharges (if available)

IMPORTANT:
- Extract ALL months found
- Census days should be actual resident days for the month
- Calculate payer mix as: (payer_days / total_days) * 100
- If bed count varies, note it

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
    "payer_mix_available": true|false
  }
}

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
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

        try {
          extractedData = JSON.parse(jsonStr);
          console.log(`[${extractionType}] JSON repair successful`);
        } catch (repairError) {
          console.error(`[${extractionType}] JSON repair failed:`, repairError.message);
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

  // Run all 5 extractions in parallel
  const extractionPromises = [
    runFocusedExtraction(combinedDocumentText, FACILITY_PROMPT, 'facility'),
    runFocusedExtraction(combinedDocumentText, FINANCIALS_PROMPT, 'financials'),
    runFocusedExtraction(combinedDocumentText, EXPENSES_PROMPT, 'expenses'),
    runFocusedExtraction(combinedDocumentText, CENSUS_PROMPT, 'census'),
    runFocusedExtraction(combinedDocumentText, RATES_PROMPT, 'rates')
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
