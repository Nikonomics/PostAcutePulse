/**
 * AI Document Extraction Service
 * Uses Claude to extract deal information from uploaded documents
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Dynamic import for pdf-parse (handles both ESM and CJS)
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  // Check if it's a default export
  if (pdfParse && pdfParse.default) {
    pdfParse = pdfParse.default;
  }
} catch (e) {
  console.log('pdf-parse initial load failed, trying alternative...');
}

// pdf-to-img for vision-based PDF processing (loaded dynamically as ESM)
let pdfToImg = null;
const MIN_TEXT_LENGTH = 100; // Minimum characters to consider text extraction successful
const MAX_PDF_PAGES = 10; // Maximum pages to process for vision

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Build the enhanced extraction prompt for healthcare M&A documents
 */
function buildExtractionPrompt() {
  return `You are an expert healthcare M&A analyst specializing in skilled nursing facilities (SNF), assisted living facilities (ALF), and senior housing acquisitions. You extract structured deal data from CIMs, broker packages, P&L statements, census reports, rent rolls, and rate schedules.

## STEP 1: DOCUMENT IDENTIFICATION
First, identify what types of documents you're analyzing:
- P&L / Income Statement → Extract revenue, expenses, calculate EBITDAR/EBITDA
- Census Report → Extract occupancy, payer mix, infer bed count from max census
- Rent Roll → Extract unit mix, unit count, rental rates
- Rate Schedule → Extract pricing tiers by payer type
- Floor Plans → Extract location info, unit counts
- CIM/Offering Memo → Extract deal terms, pricing, contact info

## STEP 2: EXTRACTION RULES

### Deal Name:
- If explicit deal name found in CIM/Offering Memo, use it
- If no deal name found but facility_name exists: deal_name = facility_name + " Acquisition"
- Always populate deal_name if facility_name is available

### Facility Type Identification:
- "ALF", "Assisted Living", "RCF", "Residential Care" → "Assisted Living"
- "SNF", "Skilled Nursing", "Nursing Facility", "NF" → "SNF"
- "Memory Care", "MC", "Dementia Care" → "Memory Care"
- "IL", "Independent Living" → "Independent Living"
- "CCRC", "Continuing Care" → "CCRC"
- If document has Medicaid care levels L1-L5 (not RUG/PDPM), likely ALF

### Location Extraction (CRITICAL - READ CAREFULLY):
1. Extract STATE first from: rate schedules (e.g., "Oregon DHS" = OR), document headers, addresses, letterheads
2. Extract CITY from: architect stamps, letterheads, facility addresses, report headers
3. VALIDATION REQUIRED: City MUST exist in the identified state
   - If state = "OR" or "Oregon", valid cities include: Portland, Salem, Eugene, Bend, Medford, etc.
   - If state = "OR" or "Oregon", INVALID cities include: Phoenix, Tucson, Los Angeles, Seattle, etc.
   - If city appears inconsistent with state, set city to NULL and add to data_quality_notes
4. Common location sources:
   - Architect stamps on floor plans (e.g., "Portland, Oregon 97204")
   - State agency references (e.g., "Oregon Department of Human Services" = Oregon facility)
   - Rate schedules from state agencies
5. NEVER guess a city. If uncertain, return null rather than a wrong city.

### Bed/Unit Count:
- If explicit bed count found, use it
- Otherwise: bed_count = MAX(census values across all months) rounded up to nearest 5
- For ALF, may be called "units" not "beds"

### TTM Financial Calculations (CRITICAL):

When multiple financial documents are available (e.g., historical T12 + YTD):
1. IDENTIFY the most recent complete month across all documents
2. BUILD the freshest possible trailing 12 months by combining data sources
3. SPECIFY the exact period used in period.start and period.end

Example:
- T12 file covers: May 2024 - April 2025
- YTD file covers: March 2025 - September 2025
- CALCULATE: October 2024 - September 2025 (freshest T12)
  - Oct 2024 - Feb 2025: Pull from T12 file
  - Mar 2025 - Sep 2025: Pull from YTD file

### EBIT/EBITDA/EBITDAR Calculation (MUST FOLLOW EXACTLY):

Step 1: Find these SPECIFIC line items in the P&L and sum for the TTM period:
- DEPRECIATION: Look for "DEPRECIATION" in Property Related section (~$21K/month typical)
- INTEREST_EXPENSE: Look for "BOND INTEREST EXPENSE" or "INTEREST EXPENSE" (~$10.6K/month typical)
- RENT_EXPENSE: Look for "LAND LEASE" or "RENT EXPENSE" (~$4K/month typical)
- NET_INCOME: Look for "TOTAL INCOME (LOSS)" or "NET INCOME" at bottom of P&L

Step 2: Calculate in this EXACT order:
EBIT = NET_INCOME + INTEREST_EXPENSE
EBITDA = EBIT + DEPRECIATION
EBITDAR = EBITDA + RENT_EXPENSE

Step 3: Validate your math:
- EBITDAR should be LESS negative (or more positive) than EBITDA
- EBITDA should be LESS negative (or more positive) than EBIT
- EBIT should be LESS negative (or more positive) than NET_INCOME
- If this order is wrong, you made a calculation error

Step 4: Include calculation details in output:
"calculation_details": {
"net_income": [value],
"interest_expense_addback": [value],
"depreciation_addback": [value],
"rent_expense_addback": [value]
}

### Revenue by Payer Source (REQUIRED):
From P&L statements, extract DOLLAR AMOUNTS for each payer source:
- medicaid_revenue: Look for "Medicaid Revenue", "Title XIX", "Medicaid Room & Board"
- medicare_revenue: Look for "Medicare Revenue", "Title XVIII"
- private_pay_revenue: Look for "Private Pay Revenue", "Private Room & Board"
- other_revenue: Any other revenue sources (respite, ancillary, etc.)

Calculate percentage of total for each, but store the ACTUAL DOLLAR AMOUNTS.

### Payer Mix Percentages (REQUIRED):
From Census Reports:
1. Find total census days by payer type: Medicaid days, Private Pay days, Medicare days
2. Calculate percentages: (payer_days / total_days) * 100
3. Verify percentages sum to ~100%

From P&L Revenue:
1. Use the revenue_by_payer amounts above
2. Calculate percentages: (payer_revenue / total_revenue) * 100

ALWAYS extract both census-based AND revenue-based payer mix when data is available.

### Year-to-Date (YTD) Performance:
If documents contain YTD or partial-year data SEPARATE from the T12:
1. Extract the period covered (e.g., "March 2025 - September 2025")
2. Extract YTD totals: revenue, expenses, net income
3. Extract census days by payer type if available
4. This is SEPARATE from the T12 data - do not combine them

YTD data is often found in:
- I&E statements with "YTD" in the title
- Census reports showing current year totals
- Monthly reports that show cumulative figures

### Rate Schedule Extraction (REQUIRED):
Extract ALL rate information found:

Private Pay Rates - look for:
- Base rent by unit type (Studio, 1BR, 2BR, etc.)
- Care level add-ons (L1, L2, L3, etc.)
- Additional person/spouse fees

Medicaid Rates - look for:
- Rates by care level (Level 1 through Level 5)
- Room and board components
- State rate schedules

Format as arrays:
"private_pay_rates": [
{"unit_type": "Studio", "monthly_rate": 4128, "care_levels": {"L1": 676, "L2": 889, "L3": 1158}},
{"unit_type": "1 Bedroom", "monthly_rate": 4992}
]
"medicaid_rates": [
{"care_level": "Level 1", "monthly_rate": 1980},
{"care_level": "Level 2", "monthly_rate": 2454}
]

### Contact Information Extraction:
- Look for "User:", "Prepared by:", "Generated by:" in report headers
- Look for email patterns: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}
- Look for phone patterns: \\(?\\d{3}\\)?[-.\s]?\\d{3}[-.\s]?\\d{4}
- PointClickCare reports show "User: [Name]" - extract as contact if no other found

### Occupancy Calculation:
occupancy_pct = (average_daily_census / bed_count) * 100
Mark as calculated: true

## STEP 3: SOURCE CITATION FORMAT (CRITICAL)

For EVERY extracted value, provide detailed source citations that allow users to find the exact location in the original document:

### Source Reference Structure:
Each "source" field should include:
- **document**: The exact filename (e.g., "Trailing_12-Month_P&L.xlsx")
- **location**: Specific location within the document:
  - For Excel: "Sheet '[SheetName]', Row [X]" or "Sheet '[SheetName]', Cell [A1]"
  - For PDF: "Page [X]" or "Page [X], Section '[Header]'"
  - For Word/Text: "Page [X]" or "Section '[Header]'"
- **snippet**: A brief text snippet showing the exact text where the value was found (10-50 chars)

Example source formats:
- "Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45 | 'Total Revenue: $3,933,015'"
- "Census_Report.pdf | Page 2 | 'Average Daily Census: 94'"
- "Rate-schedule_July_2025.pdf | Page 1, Care Level Table | 'Level 1: $1,980/month'"

For calculated values, show the source as:
- "Calculated | [formula description] | Based on: [source fields]"

## STEP 4: OUTPUT FORMAT

Return a JSON object with this structure. Use null for fields not found. Include confidence scores and detailed sources.

{
  "document_types_identified": ["P&L", "Census Report", "Rate Schedule"],

  "deal_information": {
    "deal_name": {"value": null, "confidence": "not_found", "source": null, "derived_from": null},
    "deal_type": {"value": null, "confidence": "not_found", "source": null},
    "deal_source": {"value": null, "confidence": "not_found", "source": null},
    "priority_level": {"value": null, "confidence": "not_found", "source": null},
    "purchase_price": {"value": null, "confidence": "not_found", "source": null},
    "price_per_bed": {"value": null, "confidence": "not_found", "calculated": false, "source": null}
  },

  "facility_information": {
    "facility_name": {"value": null, "confidence": "not_found", "source": null},
    "facility_type": {"value": null, "confidence": "not_found", "source": null},
    "street_address": {"value": null, "confidence": "not_found", "source": null},
    "city": {"value": null, "confidence": "not_found", "source": null},
    "state": {"value": null, "confidence": "not_found", "source": null},
    "zip_code": {"value": null, "confidence": "not_found", "source": null},
    "bed_count": {"value": null, "confidence": "not_found", "method": "explicit|inferred_from_census", "source": null},
    "unit_mix": {"value": null, "confidence": "not_found", "source": null}
  },

  "contact_information": {
    "primary_contact_name": {"value": null, "confidence": "not_found", "source": null},
    "title": {"value": null, "confidence": "not_found", "source": null},
    "phone": {"value": null, "confidence": "not_found", "source": null},
    "email": {"value": null, "confidence": "not_found", "source": null}
  },

  "financial_information_t12": {
    "period": {"start": null, "end": null, "note": null},
    "total_revenue": {"value": null, "confidence": "not_found", "source": null},
    "revenue_by_payer": {
      "medicaid_revenue": {"value": null, "confidence": "not_found"},
      "medicare_revenue": {"value": null, "confidence": "not_found"},
      "private_pay_revenue": {"value": null, "confidence": "not_found"},
      "other_revenue": {"value": null, "confidence": "not_found"}
    },
    "revenue_breakdown": {
      "room_and_board": {"value": null, "confidence": "not_found"},
      "care_level_revenue": {"value": null, "confidence": "not_found"},
      "ancillary_revenue": {"value": null, "confidence": "not_found"},
      "other_income": {"value": null, "confidence": "not_found"}
    },
    "total_expenses": {"value": null, "confidence": "not_found", "source": null},
    "operating_expenses": {"value": null, "confidence": "not_found", "source": null},
    "depreciation": {"value": null, "confidence": "not_found", "source": null},
    "amortization": {"value": null, "confidence": "not_found", "source": null},
    "interest_expense": {"value": null, "confidence": "not_found", "source": null},
    "property_taxes": {"value": null, "confidence": "not_found", "source": null},
    "property_insurance": {"value": null, "confidence": "not_found", "source": null},
    "rent_lease_expense": {"value": null, "confidence": "not_found", "source": null},
    "net_income": {"value": null, "confidence": "not_found", "source": null},
    "ebit": {"value": null, "confidence": "not_found", "calculated": true},
    "ebitda": {"value": null, "confidence": "not_found", "calculated": true},
    "ebitdar": {"value": null, "confidence": "not_found", "calculated": true},
    "calculation_details": {
      "net_income": null,
      "interest_expense_addback": null,
      "depreciation_addback": null,
      "rent_expense_addback": null,
      "ebit_formula": "net_income + interest_expense",
      "ebitda_formula": "ebit + depreciation",
      "ebitdar_formula": "ebitda + rent_expense"
    }
  },

  "ytd_performance": {
    "period": {"start": null, "end": null},
    "total_revenue": {"value": null, "confidence": "not_found"},
    "total_expenses": {"value": null, "confidence": "not_found"},
    "net_income": {"value": null, "confidence": "not_found"},
    "average_daily_census": {"value": null, "confidence": "not_found"},
    "medicaid_days": {"value": null, "confidence": "not_found"},
    "private_pay_days": {"value": null, "confidence": "not_found"},
    "total_census_days": {"value": null, "confidence": "not_found"}
  },

  "census_and_occupancy": {
    "average_daily_census": {"value": null, "confidence": "not_found", "source": null},
    "occupancy_percentage": {"value": null, "confidence": "not_found", "calculated": false, "source": null},
    "payer_mix_by_census": {
      "medicaid_pct": {"value": null, "confidence": "not_found"},
      "medicare_pct": {"value": null, "confidence": "not_found"},
      "private_pay_pct": {"value": null, "confidence": "not_found"},
      "other_pct": {"value": null, "confidence": "not_found"},
      "source": null
    },
    "payer_mix_by_revenue": {
      "medicaid_pct": {"value": null, "confidence": "not_found"},
      "medicare_pct": {"value": null, "confidence": "not_found"},
      "private_pay_pct": {"value": null, "confidence": "not_found"},
      "other_pct": {"value": null, "confidence": "not_found"},
      "source": null
    }
  },

  "rate_information": {
    "private_pay_rates": {
      "value": [],
      "confidence": "not_found",
      "source": null
    },
    "medicaid_rates": {
      "value": [],
      "confidence": "not_found",
      "source": null
    },
    "average_daily_rate": {"value": null, "confidence": "not_found"}
  },

  "pro_forma_projections": {
    "year_1": {
      "revenue": {"value": null, "confidence": "not_found"},
      "ebitdar": {"value": null, "confidence": "not_found"},
      "rent_expense": {"value": null, "confidence": "not_found"},
      "ebitda": {"value": null, "confidence": "not_found"},
      "ebit": {"value": null, "confidence": "not_found"},
      "occupancy_pct": {"value": null, "confidence": "not_found"}
    },
    "year_2": {
      "revenue": {"value": null, "confidence": "not_found"},
      "ebitdar": {"value": null, "confidence": "not_found"},
      "rent_expense": {"value": null, "confidence": "not_found"},
      "ebitda": {"value": null, "confidence": "not_found"},
      "ebit": {"value": null, "confidence": "not_found"},
      "occupancy_pct": {"value": null, "confidence": "not_found"}
    },
    "year_3": {
      "revenue": {"value": null, "confidence": "not_found"},
      "ebitdar": {"value": null, "confidence": "not_found"},
      "rent_expense": {"value": null, "confidence": "not_found"},
      "ebitda": {"value": null, "confidence": "not_found"},
      "ebit": {"value": null, "confidence": "not_found"},
      "occupancy_pct": {"value": null, "confidence": "not_found"}
    }
  },

  "deal_metrics": {
    "revenue_multiple": {"value": null, "calculated": false},
    "ebitda_multiple": {"value": null, "calculated": false},
    "cap_rate": {"value": null, "confidence": "not_found"},
    "target_irr": {"value": null, "confidence": "not_found"},
    "hold_period_years": {"value": null, "confidence": "not_found"}
  },

  "data_quality_notes": [],

  "key_observations": []
}

## CRITICAL RULES:

1. **Numeric values**: Return raw numbers only (no $, %, commas). "15M" → 15000000, "85%" → 85

2. **Negative values**: Operating losses should be negative numbers

3. **Calculations**: Always show "calculated": true when you derived a value

4. **Confidence levels**:
   - "high" = explicitly stated in document
   - "medium" = calculated from explicit data or strongly inferred
   - "low" = inferred from indirect evidence
   - "not_found" = field not found in any document

5. **Location validation**: If city doesn't match state, set city to null and add note to data_quality_notes. NEVER return Phoenix for an Oregon facility.

6. **Facility type**: Use document terminology as evidence (ALF/RCF docs = "Assisted Living", not SNF)

7. **Deal name fallback**: If no explicit deal name, use: facility_name + " Acquisition"

8. **EBITDAR math validation**:
   - EBITDAR > EBITDA > EBIT > Net Income (in terms of being less negative or more positive)
   - If this doesn't hold, recheck your calculations

9. **Payer mix required**: Always extract payer mix from census data when available. Sum should be ~100%.

10. **Rate tables required**: Always extract rate information when rate schedules are provided.

11. **Source attribution**: Include source document name for key fields to enable verification.

12. **Return ONLY valid JSON**, no markdown code blocks, no explanatory text before or after.`;
}

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer) {
  try {
    // Ensure pdfParse is loaded
    if (!pdfParse) {
      const pdfParseModule = require('pdf-parse');
      pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule.default || pdfParseModule;
    }

    if (typeof pdfParse !== 'function') {
      console.error('pdfParse is not a function, type:', typeof pdfParse);
      throw new Error('PDF parser not properly loaded');
    }

    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF document');
  }
}

/**
 * Extract text from Excel file buffer
 */
function extractTextFromExcel(buffer, fileName) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = [];

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Convert to CSV for easy text extraction
      const csv = XLSX.utils.sheet_to_csv(sheet);
      allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }

    return allText.join('\n\n');
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error('Failed to parse Excel document');
  }
}

/**
 * Extract text from Word document buffer
 */
async function extractTextFromWord(buffer, fileName) {
  // For Word docs, we'll convert to text in a simple way
  // or rely on Claude's vision for complex docs
  try {
    // Simple text extraction - works for basic docx
    const text = buffer.toString('utf-8');
    // Filter out non-printable characters and XML tags
    const cleanText = text.replace(/<[^>]*>/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleanText.length > 100 ? cleanText : null;
  } catch (error) {
    console.error('Word parsing error:', error);
    return null; // Fall back to vision-based extraction
  }
}

/**
 * Convert PDF pages to base64 images for vision-based extraction
 * Uses pdf-to-img library (ESM module, dynamically imported)
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<Array<{base64: string, pageNumber: number}>>} Array of base64 encoded page images
 */
async function convertPdfToImages(pdfBuffer) {
  try {
    // Dynamic import of pdf-to-img (ESM module)
    if (!pdfToImg) {
      pdfToImg = await import('pdf-to-img');
    }

    const { pdf } = pdfToImg;
    const images = [];
    let pageNumber = 0;

    // pdf-to-img's pdf() function returns an async generator
    // Scale 3.0 for high-res images - needed to read small text in title blocks/architect stamps
    const pdfDocument = await pdf(pdfBuffer, { scale: 3.0 });

    for await (const page of pdfDocument) {
      pageNumber++;
      if (pageNumber > MAX_PDF_PAGES) {
        console.log(`Limiting PDF processing to first ${MAX_PDF_PAGES} pages`);
        break;
      }

      // page is a Buffer containing the PNG image
      const base64 = page.toString('base64');
      images.push({
        base64,
        pageNumber,
        mediaType: 'image/png'
      });
    }

    console.log(`Converted ${images.length} PDF pages to images for vision processing`);
    return images;
  } catch (error) {
    console.error('PDF to image conversion error:', error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}

/**
 * Extract text from various file types
 */
async function extractTextFromFile(fileBuffer, mimeType, fileName) {
  const lowerFileName = fileName.toLowerCase();

  if (mimeType === 'application/pdf') {
    return await extractTextFromPDF(fileBuffer);
  } else if (mimeType.includes('text') || lowerFileName.endsWith('.txt') || lowerFileName.endsWith('.csv')) {
    return fileBuffer.toString('utf-8');
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    lowerFileName.endsWith('.xlsx') ||
    lowerFileName.endsWith('.xls')
  ) {
    return extractTextFromExcel(fileBuffer, fileName);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    lowerFileName.endsWith('.docx') ||
    lowerFileName.endsWith('.doc')
  ) {
    return await extractTextFromWord(fileBuffer, fileName);
  } else {
    // For images and other files, we'll send directly to Claude's vision
    return null;
  }
}

/**
 * Helper to safely get value from nested confidence structure
 * Handles both new schema (with value/confidence objects) and old schema (direct values)
 */
function getValue(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && 'value' in obj) return obj.value;
  return obj;
}

/**
 * Helper to get confidence from nested structure
 */
function getConfidence(obj) {
  if (obj === null || obj === undefined) return 'not_found';
  if (typeof obj === 'object' && 'confidence' in obj) return obj.confidence;
  return 'medium';
}

/**
 * Helper to get source from nested structure
 */
function getSource(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'object' && 'source' in obj) return obj.source;
  return null;
}

/**
 * Flatten the nested AI response to a simple flat structure for the frontend
 * Updated to handle the new schema with value/confidence objects throughout
 */
function flattenExtractedData(data) {
  const flat = {
    // Document types identified
    document_types_identified: data.document_types_identified || [],

    // Deal information
    deal_name: getValue(data.deal_information?.deal_name),
    deal_name_derived_from: data.deal_information?.deal_name?.derived_from || null,
    deal_type: getValue(data.deal_information?.deal_type),
    deal_source: getValue(data.deal_information?.deal_source),
    priority_level: getValue(data.deal_information?.priority_level),
    purchase_price: getValue(data.deal_information?.purchase_price),
    price_per_bed: getValue(data.deal_information?.price_per_bed),

    // Facility information
    facility_name: getValue(data.facility_information?.facility_name),
    facility_type: getValue(data.facility_information?.facility_type),
    street_address: getValue(data.facility_information?.street_address),
    city: getValue(data.facility_information?.city),
    state: getValue(data.facility_information?.state),
    zip_code: getValue(data.facility_information?.zip_code),
    no_of_beds: getValue(data.facility_information?.bed_count),
    bed_count_method: data.facility_information?.bed_count?.method || 'explicit',
    unit_mix: getValue(data.facility_information?.unit_mix),

    // Contact information
    primary_contact_name: getValue(data.contact_information?.primary_contact_name),
    title: getValue(data.contact_information?.title),
    phone_number: getValue(data.contact_information?.phone),
    email: getValue(data.contact_information?.email),

    // Financial information (T12) - period info
    financial_period_start: data.financial_information_t12?.period?.start || null,
    financial_period_end: data.financial_information_t12?.period?.end || null,
    financial_period_note: data.financial_information_t12?.period?.note || null,

    // Financial information (T12) - main fields
    annual_revenue: getValue(data.financial_information_t12?.total_revenue),
    t12m_revenue: getValue(data.financial_information_t12?.total_revenue),
    total_expenses: getValue(data.financial_information_t12?.total_expenses),

    // Revenue by payer source - NEW
    medicaid_revenue: getValue(data.financial_information_t12?.revenue_by_payer?.medicaid_revenue),
    medicare_revenue: getValue(data.financial_information_t12?.revenue_by_payer?.medicare_revenue),
    private_pay_revenue: getValue(data.financial_information_t12?.revenue_by_payer?.private_pay_revenue),
    other_revenue: getValue(data.financial_information_t12?.revenue_by_payer?.other_revenue),

    // Revenue breakdown by type
    revenue_room_and_board: getValue(data.financial_information_t12?.revenue_breakdown?.room_and_board),
    revenue_care_level: getValue(data.financial_information_t12?.revenue_breakdown?.care_level_revenue),
    revenue_ancillary: getValue(data.financial_information_t12?.revenue_breakdown?.ancillary_revenue),
    revenue_other_income: getValue(data.financial_information_t12?.revenue_breakdown?.other_income),

    // Expense details - NEW
    operating_expenses: getValue(data.financial_information_t12?.operating_expenses),
    property_taxes: getValue(data.financial_information_t12?.property_taxes),
    property_insurance: getValue(data.financial_information_t12?.property_insurance),

    // EBITDAR/EBITDA/EBIT
    depreciation: getValue(data.financial_information_t12?.depreciation),
    amortization: getValue(data.financial_information_t12?.amortization),
    interest_expense: getValue(data.financial_information_t12?.interest_expense),
    current_rent_lease_expense: getValue(data.financial_information_t12?.rent_lease_expense),
    net_income: getValue(data.financial_information_t12?.net_income),
    net_operating_income: getValue(data.financial_information_t12?.net_income),

    ebit: getValue(data.financial_information_t12?.ebit),
    t12m_ebit: getValue(data.financial_information_t12?.ebit),
    ebitda: getValue(data.financial_information_t12?.ebitda),
    t12m_ebitda: getValue(data.financial_information_t12?.ebitda),
    ebitdar: getValue(data.financial_information_t12?.ebitdar),
    t12m_ebitdar: getValue(data.financial_information_t12?.ebitdar),

    // Calculation details for verification
    calculation_details: data.financial_information_t12?.calculation_details || null,

    // YTD Performance - NEW
    ytd_period_start: data.ytd_performance?.period?.start || null,
    ytd_period_end: data.ytd_performance?.period?.end || null,
    ytd_revenue: getValue(data.ytd_performance?.total_revenue),
    ytd_expenses: getValue(data.ytd_performance?.total_expenses),
    ytd_net_income: getValue(data.ytd_performance?.net_income),
    ytd_average_daily_census: getValue(data.ytd_performance?.average_daily_census),
    ytd_medicaid_days: getValue(data.ytd_performance?.medicaid_days),
    ytd_private_pay_days: getValue(data.ytd_performance?.private_pay_days),
    ytd_total_census_days: getValue(data.ytd_performance?.total_census_days),

    // Census and occupancy
    average_daily_census: getValue(data.census_and_occupancy?.average_daily_census),
    current_occupancy: getValue(data.census_and_occupancy?.occupancy_percentage),
    t12m_occupancy: getValue(data.census_and_occupancy?.occupancy_percentage),

    // Payer mix by census - handle new nested structure
    medicare_percentage: getValue(data.census_and_occupancy?.payer_mix_by_census?.medicare_pct) ||
                         getValue(data.census_and_occupancy?.payer_mix_by_revenue?.medicare_pct),
    medicaid_percentage: getValue(data.census_and_occupancy?.payer_mix_by_census?.medicaid_pct) ||
                         getValue(data.census_and_occupancy?.payer_mix_by_revenue?.medicaid_pct),
    private_pay_percentage: getValue(data.census_and_occupancy?.payer_mix_by_census?.private_pay_pct) ||
                            getValue(data.census_and_occupancy?.payer_mix_by_revenue?.private_pay_pct),
    other_payer_percentage: getValue(data.census_and_occupancy?.payer_mix_by_census?.other_pct) ||
                            getValue(data.census_and_occupancy?.payer_mix_by_revenue?.other_pct),

    // Payer mix sources
    payer_mix_census_source: data.census_and_occupancy?.payer_mix_by_census?.source || null,
    payer_mix_revenue_source: data.census_and_occupancy?.payer_mix_by_revenue?.source || null,

    // Rate information - handle new wrapped structure
    average_daily_rate: getValue(data.rate_information?.average_daily_rate),
    private_pay_rates: getValue(data.rate_information?.private_pay_rates) ||
                       data.rate_information?.private_pay_rates?.value ||
                       data.rate_information?.private_pay_rates || [],
    medicaid_rates: getValue(data.rate_information?.medicaid_rates) ||
                    data.rate_information?.medicaid_rates?.value ||
                    data.rate_information?.medicaid_rates || [],
    private_pay_rates_source: getSource(data.rate_information?.private_pay_rates),
    medicaid_rates_source: getSource(data.rate_information?.medicaid_rates),

    // Pro forma projections - handle new value/confidence structure
    proforma_year1_annual_revenue: getValue(data.pro_forma_projections?.year_1?.revenue),
    proforma_year1_annual_ebitdar: getValue(data.pro_forma_projections?.year_1?.ebitdar),
    proforma_year1_annual_rent: getValue(data.pro_forma_projections?.year_1?.rent_expense),
    proforma_year1_annual_ebitda: getValue(data.pro_forma_projections?.year_1?.ebitda),
    proforma_year1_annual_ebit: getValue(data.pro_forma_projections?.year_1?.ebit),
    proforma_year1_average_occupancy: getValue(data.pro_forma_projections?.year_1?.occupancy_pct),

    proforma_year2_annual_revenue: getValue(data.pro_forma_projections?.year_2?.revenue),
    proforma_year2_annual_ebitdar: getValue(data.pro_forma_projections?.year_2?.ebitdar),
    proforma_year2_annual_rent: getValue(data.pro_forma_projections?.year_2?.rent_expense),
    proforma_year2_annual_ebitda: getValue(data.pro_forma_projections?.year_2?.ebitda),
    proforma_year2_annual_ebit: getValue(data.pro_forma_projections?.year_2?.ebit),
    proforma_year2_average_occupancy: getValue(data.pro_forma_projections?.year_2?.occupancy_pct),

    proforma_year3_annual_revenue: getValue(data.pro_forma_projections?.year_3?.revenue),
    proforma_year3_annual_ebitdar: getValue(data.pro_forma_projections?.year_3?.ebitdar),
    proforma_year3_annual_rent: getValue(data.pro_forma_projections?.year_3?.rent_expense),
    proforma_year3_annual_ebitda: getValue(data.pro_forma_projections?.year_3?.ebitda),
    proforma_year3_annual_ebit: getValue(data.pro_forma_projections?.year_3?.ebit),
    proforma_year3_average_occupancy: getValue(data.pro_forma_projections?.year_3?.occupancy_pct),

    // Deal metrics
    revenue_multiple: getValue(data.deal_metrics?.revenue_multiple),
    ebitda_multiple: getValue(data.deal_metrics?.ebitda_multiple),
    projected_cap_rate_percentage: getValue(data.deal_metrics?.cap_rate),
    target_irr_percentage: getValue(data.deal_metrics?.target_irr),
    target_hold_period: getValue(data.deal_metrics?.hold_period_years),

    // Data quality and observations
    data_quality_notes: data.data_quality_notes || [],
    key_observations: data.key_observations || [],

    // Set defaults
    country: 'USA'
  };

  // Ensure rate arrays are actually arrays
  if (!Array.isArray(flat.private_pay_rates)) {
    flat.private_pay_rates = [];
  }
  if (!Array.isArray(flat.medicaid_rates)) {
    flat.medicaid_rates = [];
  }

  // Build confidence map for UI highlighting - comprehensive list of all extraction fields
  flat._confidenceMap = {
    // Deal information
    deal_name: getConfidence(data.deal_information?.deal_name),
    deal_type: getConfidence(data.deal_information?.deal_type),
    deal_source: getConfidence(data.deal_information?.deal_source),
    priority_level: getConfidence(data.deal_information?.priority_level),
    purchase_price: getConfidence(data.deal_information?.purchase_price),
    price_per_bed: getConfidence(data.deal_information?.price_per_bed),

    // Facility information
    facility_name: getConfidence(data.facility_information?.facility_name),
    facility_type: getConfidence(data.facility_information?.facility_type),
    street_address: getConfidence(data.facility_information?.street_address),
    city: getConfidence(data.facility_information?.city),
    state: getConfidence(data.facility_information?.state),
    zip_code: getConfidence(data.facility_information?.zip_code),
    no_of_beds: getConfidence(data.facility_information?.bed_count),
    unit_mix: getConfidence(data.facility_information?.unit_mix),

    // Contact information
    primary_contact_name: getConfidence(data.contact_information?.primary_contact_name),
    title: getConfidence(data.contact_information?.title),
    phone_number: getConfidence(data.contact_information?.phone),
    email: getConfidence(data.contact_information?.email),

    // Financial information T12
    annual_revenue: getConfidence(data.financial_information_t12?.total_revenue),
    total_expenses: getConfidence(data.financial_information_t12?.total_expenses),
    operating_expenses: getConfidence(data.financial_information_t12?.operating_expenses),
    depreciation: getConfidence(data.financial_information_t12?.depreciation),
    amortization: getConfidence(data.financial_information_t12?.amortization),
    interest_expense: getConfidence(data.financial_information_t12?.interest_expense),
    current_rent_lease_expense: getConfidence(data.financial_information_t12?.rent_lease_expense),
    property_taxes: getConfidence(data.financial_information_t12?.property_taxes),
    property_insurance: getConfidence(data.financial_information_t12?.property_insurance),
    net_income: getConfidence(data.financial_information_t12?.net_income),
    ebit: getConfidence(data.financial_information_t12?.ebit),
    ebitda: getConfidence(data.financial_information_t12?.ebitda),
    ebitdar: getConfidence(data.financial_information_t12?.ebitdar),

    // Revenue by payer
    medicaid_revenue: getConfidence(data.financial_information_t12?.revenue_by_payer?.medicaid_revenue),
    medicare_revenue: getConfidence(data.financial_information_t12?.revenue_by_payer?.medicare_revenue),
    private_pay_revenue: getConfidence(data.financial_information_t12?.revenue_by_payer?.private_pay_revenue),
    other_revenue: getConfidence(data.financial_information_t12?.revenue_by_payer?.other_revenue),

    // Revenue breakdown
    revenue_room_and_board: getConfidence(data.financial_information_t12?.revenue_breakdown?.room_and_board),
    revenue_care_level: getConfidence(data.financial_information_t12?.revenue_breakdown?.care_level_revenue),
    revenue_ancillary: getConfidence(data.financial_information_t12?.revenue_breakdown?.ancillary_revenue),
    revenue_other_income: getConfidence(data.financial_information_t12?.revenue_breakdown?.other_income),

    // Census and occupancy
    average_daily_census: getConfidence(data.census_and_occupancy?.average_daily_census),
    current_occupancy: getConfidence(data.census_and_occupancy?.occupancy_percentage),
    medicaid_percentage: getConfidence(data.census_and_occupancy?.payer_mix_by_census?.medicaid_pct),
    medicare_percentage: getConfidence(data.census_and_occupancy?.payer_mix_by_census?.medicare_pct),
    private_pay_percentage: getConfidence(data.census_and_occupancy?.payer_mix_by_census?.private_pay_pct),

    // Rate information
    private_pay_rates: getConfidence(data.rate_information?.private_pay_rates),
    medicaid_rates: getConfidence(data.rate_information?.medicaid_rates),
    average_daily_rate: getConfidence(data.rate_information?.average_daily_rate),

    // Deal metrics
    revenue_multiple: getConfidence(data.deal_metrics?.revenue_multiple),
    ebitda_multiple: getConfidence(data.deal_metrics?.ebitda_multiple),
    projected_cap_rate_percentage: getConfidence(data.deal_metrics?.cap_rate),
    target_irr_percentage: getConfidence(data.deal_metrics?.target_irr),
    target_hold_period: getConfidence(data.deal_metrics?.hold_period_years),

    // Pro forma projections
    proforma_year1_annual_revenue: getConfidence(data.pro_forma_projections?.year_1?.revenue),
    proforma_year1_annual_ebitdar: getConfidence(data.pro_forma_projections?.year_1?.ebitdar),
    proforma_year1_annual_ebitda: getConfidence(data.pro_forma_projections?.year_1?.ebitda),
    proforma_year1_average_occupancy: getConfidence(data.pro_forma_projections?.year_1?.occupancy_pct),
    proforma_year2_annual_revenue: getConfidence(data.pro_forma_projections?.year_2?.revenue),
    proforma_year2_annual_ebitdar: getConfidence(data.pro_forma_projections?.year_2?.ebitdar),
    proforma_year2_annual_ebitda: getConfidence(data.pro_forma_projections?.year_2?.ebitda),
    proforma_year2_average_occupancy: getConfidence(data.pro_forma_projections?.year_2?.occupancy_pct),
    proforma_year3_annual_revenue: getConfidence(data.pro_forma_projections?.year_3?.revenue),
    proforma_year3_annual_ebitdar: getConfidence(data.pro_forma_projections?.year_3?.ebitdar),
    proforma_year3_annual_ebitda: getConfidence(data.pro_forma_projections?.year_3?.ebitda),
    proforma_year3_average_occupancy: getConfidence(data.pro_forma_projections?.year_3?.occupancy_pct),
  };

  // Build source map for UI display - comprehensive list of all extraction fields
  flat._sourceMap = {
    // Deal information
    deal_name: getSource(data.deal_information?.deal_name),
    deal_type: getSource(data.deal_information?.deal_type),
    deal_source: getSource(data.deal_information?.deal_source),
    priority_level: getSource(data.deal_information?.priority_level),
    purchase_price: getSource(data.deal_information?.purchase_price),
    price_per_bed: getSource(data.deal_information?.price_per_bed),

    // Facility information
    facility_name: getSource(data.facility_information?.facility_name),
    facility_type: getSource(data.facility_information?.facility_type),
    street_address: getSource(data.facility_information?.street_address),
    city: getSource(data.facility_information?.city),
    state: getSource(data.facility_information?.state),
    zip_code: getSource(data.facility_information?.zip_code),
    no_of_beds: getSource(data.facility_information?.bed_count),
    unit_mix: getSource(data.facility_information?.unit_mix),

    // Contact information
    primary_contact_name: getSource(data.contact_information?.primary_contact_name),
    title: getSource(data.contact_information?.title),
    phone_number: getSource(data.contact_information?.phone),
    email: getSource(data.contact_information?.email),

    // Financial information T12
    annual_revenue: getSource(data.financial_information_t12?.total_revenue),
    total_expenses: getSource(data.financial_information_t12?.total_expenses),
    operating_expenses: getSource(data.financial_information_t12?.operating_expenses),
    depreciation: getSource(data.financial_information_t12?.depreciation),
    amortization: getSource(data.financial_information_t12?.amortization),
    interest_expense: getSource(data.financial_information_t12?.interest_expense),
    current_rent_lease_expense: getSource(data.financial_information_t12?.rent_lease_expense),
    property_taxes: getSource(data.financial_information_t12?.property_taxes),
    property_insurance: getSource(data.financial_information_t12?.property_insurance),
    net_income: getSource(data.financial_information_t12?.net_income),
    ebit: getSource(data.financial_information_t12?.ebit),
    ebitda: getSource(data.financial_information_t12?.ebitda),
    ebitdar: getSource(data.financial_information_t12?.ebitdar),

    // Revenue by payer
    medicaid_revenue: getSource(data.financial_information_t12?.revenue_by_payer?.medicaid_revenue),
    medicare_revenue: getSource(data.financial_information_t12?.revenue_by_payer?.medicare_revenue),
    private_pay_revenue: getSource(data.financial_information_t12?.revenue_by_payer?.private_pay_revenue),
    other_revenue: getSource(data.financial_information_t12?.revenue_by_payer?.other_revenue),

    // Revenue breakdown
    revenue_room_and_board: getSource(data.financial_information_t12?.revenue_breakdown?.room_and_board),
    revenue_care_level: getSource(data.financial_information_t12?.revenue_breakdown?.care_level_revenue),
    revenue_ancillary: getSource(data.financial_information_t12?.revenue_breakdown?.ancillary_revenue),
    revenue_other_income: getSource(data.financial_information_t12?.revenue_breakdown?.other_income),

    // Census and occupancy
    average_daily_census: getSource(data.census_and_occupancy?.average_daily_census),
    current_occupancy: getSource(data.census_and_occupancy?.occupancy_percentage),
    medicaid_percentage: getSource(data.census_and_occupancy?.payer_mix_by_census?.medicaid_pct),
    medicare_percentage: getSource(data.census_and_occupancy?.payer_mix_by_census?.medicare_pct),
    private_pay_percentage: getSource(data.census_and_occupancy?.payer_mix_by_census?.private_pay_pct),

    // Rate information
    private_pay_rates: getSource(data.rate_information?.private_pay_rates),
    medicaid_rates: getSource(data.rate_information?.medicaid_rates),
    average_daily_rate: getSource(data.rate_information?.average_daily_rate),

    // Deal metrics
    revenue_multiple: getSource(data.deal_metrics?.revenue_multiple),
    ebitda_multiple: getSource(data.deal_metrics?.ebitda_multiple),
    projected_cap_rate_percentage: getSource(data.deal_metrics?.cap_rate),
    target_irr_percentage: getSource(data.deal_metrics?.target_irr),
    target_hold_period: getSource(data.deal_metrics?.hold_period_years),

    // Pro forma projections
    proforma_year1_annual_revenue: getSource(data.pro_forma_projections?.year_1?.revenue),
    proforma_year1_annual_ebitdar: getSource(data.pro_forma_projections?.year_1?.ebitdar),
    proforma_year1_annual_ebitda: getSource(data.pro_forma_projections?.year_1?.ebitda),
    proforma_year1_average_occupancy: getSource(data.pro_forma_projections?.year_1?.occupancy_pct),
    proforma_year2_annual_revenue: getSource(data.pro_forma_projections?.year_2?.revenue),
    proforma_year2_annual_ebitdar: getSource(data.pro_forma_projections?.year_2?.ebitdar),
    proforma_year2_annual_ebitda: getSource(data.pro_forma_projections?.year_2?.ebitda),
    proforma_year2_average_occupancy: getSource(data.pro_forma_projections?.year_2?.occupancy_pct),
    proforma_year3_annual_revenue: getSource(data.pro_forma_projections?.year_3?.revenue),
    proforma_year3_annual_ebitdar: getSource(data.pro_forma_projections?.year_3?.ebitdar),
    proforma_year3_annual_ebitda: getSource(data.pro_forma_projections?.year_3?.ebitda),
    proforma_year3_average_occupancy: getSource(data.pro_forma_projections?.year_3?.occupancy_pct),
  };

  return flat;
}

/**
 * Extract deal information from document using Claude
 * Supports text-based extraction with vision fallback for scanned PDFs
 */
async function extractDealFromDocument(fileBuffer, mimeType, fileName) {
  try {
    let messages = [];
    const systemPrompt = buildExtractionPrompt();
    let extractionMethod = 'text';

    // Try to extract text first
    let extractedText = null;
    try {
      extractedText = await extractTextFromFile(fileBuffer, mimeType, fileName);
    } catch (textError) {
      console.log(`Text extraction failed for ${fileName}: ${textError.message}`);
    }

    // Check if text extraction was successful (enough meaningful text)
    const hasGoodText = extractedText && extractedText.trim().length >= MIN_TEXT_LENGTH;

    if (hasGoodText) {
      // Text-based extraction (for regular PDFs, Excel, etc.)
      console.log(`Using text extraction for ${fileName} (${extractedText.length} chars)`);
      messages = [{
        role: 'user',
        content: `Please extract deal information from this document:\n\n${extractedText.substring(0, 100000)}` // Limit text length
      }];
    } else if (mimeType === 'application/pdf') {
      // PDF with insufficient text - use vision-based extraction
      console.log(`PDF has insufficient text (${extractedText?.length || 0} chars), using vision extraction for ${fileName}`);
      extractionMethod = 'vision-pdf';

      try {
        const pageImages = await convertPdfToImages(fileBuffer);

        if (pageImages.length === 0) {
          throw new Error('No pages could be converted from PDF');
        }

        // Build message content with all page images
        const content = [];

        // Add instruction text first
        content.push({
          type: 'text',
          text: `Please extract deal information from this ${pageImages.length}-page PDF document. Analyze all pages carefully - they may contain floor plans, rate schedules, census data, or financial information.

IMPORTANT FOR FLOOR PLANS - DISTINGUISH ARCHITECT vs FACILITY ADDRESS:
Floor plans contain TWO types of addresses - DO NOT confuse them:
1. **ARCHITECT/ENGINEER FIRM ADDRESS** - The design firm's office (e.g., "CHILLESS NIELSEN ARCHITECTS, 208 S.W. Stark Street, Portland, OR 97204"). DO NOT use this as facility address.
2. **PROJECT/FACILITY ADDRESS** - The actual building location in the PROJECT NAME box (e.g., "ODD FELLOWS/REBEKAHS HOLGATE CENTER, PORTLAND, OR").

Look for facility location in:
- PROJECT NAME boxes showing "PROJECT NAME, CITY, STATE" format
- "Site:", "Location:", "Project Address:" labels
- Title block PROJECT section (separate from architect info)

If only city/state shown (no street address):
- Extract city and state with HIGH confidence
- Set street_address to NULL
- NEVER use the architect's street address as the facility address`
        });

        // Add each page as an image
        for (const page of pageImages) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: page.mediaType,
              data: page.base64
            }
          });
        }

        messages = [{
          role: 'user',
          content: content
        }];

      } catch (pdfConvertError) {
        console.error(`PDF to image conversion failed: ${pdfConvertError.message}`);
        throw new Error(`Could not process PDF: ${pdfConvertError.message}`);
      }

    } else if (mimeType.startsWith('image/')) {
      // Direct image-based extraction
      extractionMethod = 'vision-image';
      console.log(`Using vision extraction for image: ${fileName}`);
      const base64Image = fileBuffer.toString('base64');
      messages = [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: 'Please extract deal information from this document image.'
          }
        ]
      }];
    } else {
      throw new Error(`Unsupported file type: ${mimeType}. Could not extract text or use vision.`);
    }

    // Call Claude API
    console.log(`Calling Claude API with ${extractionMethod} extraction for ${fileName}...`);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages
    });

    // Parse the response
    const responseText = response.content[0].text;

    // Try to extract JSON from the response
    let extractedData;
    try {
      // Try direct parse first
      extractedData = JSON.parse(responseText);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Store the raw structured response for debugging/advanced use
    const rawStructuredData = extractedData;

    // Flatten for frontend compatibility
    const flattenedData = flattenExtractedData(extractedData);

    // Post-process and calculate derived fields
    const processedData = postProcessExtraction(flattenedData);

    // Add extraction method to metadata
    processedData._extractionMethod = extractionMethod;

    return {
      success: true,
      data: processedData,
      rawData: rawStructuredData,
      confidence: calculateConfidence(processedData),
      extractionMethod: extractionMethod
    };

  } catch (error) {
    console.error('AI extraction error:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Post-process extracted data and calculate derived fields
 */
function postProcessExtraction(data) {
  // Calculate price_per_bed if missing
  if (!data.price_per_bed && data.purchase_price && data.no_of_beds) {
    data.price_per_bed = Math.round(data.purchase_price / data.no_of_beds);
  }

  // Calculate EBITDA margin if missing
  if (!data.ebitda_margin && data.ebitda && data.annual_revenue) {
    data.ebitda_margin = Math.round((data.ebitda / data.annual_revenue) * 100 * 10) / 10;
  }

  // Calculate revenue multiple if missing
  if (!data.revenue_multiple && data.purchase_price && data.annual_revenue) {
    data.revenue_multiple = Math.round((data.purchase_price / data.annual_revenue) * 100) / 100;
  }

  // Calculate EBITDA multiple if missing
  if (!data.ebitda_multiple && data.purchase_price && data.ebitda) {
    data.ebitda_multiple = Math.round((data.purchase_price / data.ebitda) * 100) / 100;
  }

  // Set defaults
  if (!data.country) data.country = 'USA';
  if (!data.deal_type) data.deal_type = 'Acquisition';
  if (!data.priority_level) data.priority_level = 'Medium';

  // Clean up any string numbers
  const numericFields = [
    'no_of_beds', 'purchase_price', 'annual_revenue', 'ebitda', 'ebitda_margin',
    'net_operating_income', 'current_occupancy', 'average_daily_rate',
    'medicare_percentage', 'medicaid_percentage', 'private_pay_percentage',
    'other_payer_percentage', 'price_per_bed',
    'revenue_multiple', 'ebitda_multiple', 'target_irr_percentage',
    'projected_cap_rate_percentage', 'target_hold_period',
    't12m_revenue', 't12m_occupancy', 't12m_ebitdar', 't12m_ebitda', 't12m_ebit',
    'current_rent_lease_expense', 'ebitdar', 'ebit', 'depreciation', 'interest_expense',
    'net_income', 'total_expenses',
    'revenue_room_and_board', 'revenue_care_level', 'revenue_ancillary', 'revenue_other_income',
    'proforma_year1_annual_revenue', 'proforma_year1_annual_ebitdar',
    'proforma_year1_annual_rent', 'proforma_year1_annual_ebitda',
    'proforma_year1_annual_ebit', 'proforma_year1_average_occupancy',
    'proforma_year2_annual_revenue', 'proforma_year2_annual_ebitdar',
    'proforma_year2_annual_rent', 'proforma_year2_annual_ebitda',
    'proforma_year2_annual_ebit', 'proforma_year2_average_occupancy',
    'proforma_year3_annual_revenue', 'proforma_year3_annual_ebitdar',
    'proforma_year3_annual_rent', 'proforma_year3_annual_ebitda',
    'proforma_year3_annual_ebit', 'proforma_year3_average_occupancy'
  ];

  for (const field of numericFields) {
    if (data[field] && typeof data[field] === 'string') {
      const parsed = parseFloat(data[field].replace(/[^0-9.-]/g, ''));
      data[field] = isNaN(parsed) ? null : parsed;
    }
  }

  return data;
}

/**
 * Calculate confidence score based on how many fields were extracted
 */
function calculateConfidence(data) {
  const importantFields = [
    'deal_name', 'facility_name', 'facility_type', 'no_of_beds',
    'city', 'state', 'purchase_price', 'annual_revenue', 'ebitda',
    'current_occupancy', 'medicaid_percentage', 'private_pay_percentage'
  ];

  let filledCount = 0;
  for (const field of importantFields) {
    if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
      filledCount++;
    }
  }

  return Math.round((filledCount / importantFields.length) * 100);
}

/**
 * Estimate token count for content (rough approximation)
 * ~4 chars per token for text, ~1500 tokens per image
 */
function estimateTokenCount(textContent, imageCount) {
  const textTokens = Math.ceil(textContent.length / 4);
  const imageTokens = imageCount * 1500; // Conservative estimate per image
  return textTokens + imageTokens;
}

/**
 * Extract from multiple documents in a SINGLE API call
 * This allows Claude to cross-reference between documents (e.g., address from floor plan + financials from P&L)
 */
async function extractFromMultipleDocuments(files) {
  const MAX_COMBINED_TOKENS = 150000; // Safety limit for combined content

  try {
    console.log(`Processing ${files.length} documents in combined extraction mode...`);

    // Step 1: Pre-process all files to get their content
    const processedFiles = [];
    let totalTextLength = 0;
    let totalImageCount = 0;

    for (const file of files) {
      const fileInfo = {
        name: file.name,
        mimeType: file.mimetype,
        contentType: null, // 'text' or 'images'
        textContent: null,
        images: [],
        error: null
      };

      try {
        // Try text extraction first
        let extractedText = null;
        try {
          extractedText = await extractTextFromFile(file.data, file.mimetype, file.name);
        } catch (textError) {
          console.log(`Text extraction failed for ${file.name}: ${textError.message}`);
        }

        const hasGoodText = extractedText && extractedText.trim().length >= MIN_TEXT_LENGTH;

        if (hasGoodText) {
          // Use text content
          fileInfo.contentType = 'text';
          fileInfo.textContent = extractedText.substring(0, 80000); // Limit per file
          totalTextLength += fileInfo.textContent.length;
          console.log(`  ${file.name}: text extraction (${fileInfo.textContent.length} chars)`);

        } else if (file.mimetype === 'application/pdf') {
          // PDF with insufficient text - convert to images
          console.log(`  ${file.name}: converting PDF to images for vision...`);
          const pageImages = await convertPdfToImages(file.data);

          if (pageImages.length > 0) {
            fileInfo.contentType = 'images';
            fileInfo.images = pageImages;
            totalImageCount += pageImages.length;
            console.log(`  ${file.name}: ${pageImages.length} page images`);
          } else {
            fileInfo.error = 'Could not extract content from PDF';
          }

        } else if (file.mimetype.startsWith('image/')) {
          // Direct image
          fileInfo.contentType = 'images';
          fileInfo.images = [{
            base64: file.data.toString('base64'),
            pageNumber: 1,
            mediaType: file.mimetype
          }];
          totalImageCount += 1;
          console.log(`  ${file.name}: image file`);

        } else {
          fileInfo.error = `Unsupported file type: ${file.mimetype}`;
        }

      } catch (fileError) {
        fileInfo.error = fileError.message;
        console.error(`Error processing ${file.name}:`, fileError.message);
      }

      processedFiles.push(fileInfo);
    }

    // Step 2: Check if we exceed token limits
    const estimatedTokens = estimateTokenCount(totalTextLength, totalImageCount);
    console.log(`Estimated tokens: ${estimatedTokens} (text: ${totalTextLength} chars, images: ${totalImageCount})`);

    if (estimatedTokens > MAX_COMBINED_TOKENS) {
      console.log(`Content exceeds ${MAX_COMBINED_TOKENS} tokens, falling back to sequential processing...`);
      return await extractFromMultipleDocumentsSequential(files);
    }

    // Step 3: Build combined content array for single API call
    const content = [];
    const systemPrompt = buildExtractionPrompt();
    const successfulFiles = processedFiles.filter(f => !f.error);

    if (successfulFiles.length === 0) {
      return {
        success: false,
        error: 'No documents could be processed',
        mergedData: {},
        individualResults: processedFiles.map(f => ({ fileName: f.name, success: false, error: f.error }))
      };
    }

    // Add each document's content with clear labeling
    for (const fileInfo of successfulFiles) {
      // Add document separator/label
      content.push({
        type: 'text',
        text: `\n\n========== DOCUMENT: ${fileInfo.name} ==========\n`
      });

      if (fileInfo.contentType === 'text') {
        content.push({
          type: 'text',
          text: fileInfo.textContent
        });
      } else if (fileInfo.contentType === 'images') {
        // Add all page images for this document
        for (const image of fileInfo.images) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mediaType,
              data: image.base64
            }
          });
        }
      }
    }

    // Add the extraction instruction at the end
    content.push({
      type: 'text',
      text: `\n\n========== EXTRACTION INSTRUCTIONS ==========

You have been provided ${successfulFiles.length} documents above. Please extract deal information by analyzing ALL documents together.

**CRITICAL - FLOOR PLAN ADDRESS EXTRACTION:**

**IMPORTANT: DISTINGUISH BETWEEN ARCHITECT ADDRESS vs FACILITY ADDRESS**
Floor plans contain TWO types of addresses - DO NOT confuse them:
1. **ARCHITECT/ENGINEER FIRM ADDRESS** - This is the design firm's office address (e.g., "208 S.W. Stark Street, Portland, OR 97204"). DO NOT use this as the facility address.
2. **PROJECT/FACILITY ADDRESS** - This is the actual building location. This is what we need.

**How to identify the FACILITY address (in priority order):**
1. **PROJECT NAME BOX** - Look for "PROJECT:", "SITE:", "LOCATION:" labels followed by facility name AND city/state
   - Example: "ODD FELLOWS/REBEKAHS HOLGATE CENTER, PORTLAND, OR" → city=Portland, state=OR
2. **SITE ADDRESS LINE** - Some plans have explicit "Site Address:" or "Project Address:" line
3. **TITLE BLOCK PROJECT SECTION** - Separate from architect info, shows project location
4. **COVER SHEET** - First page often has full project address prominently displayed

**If only CITY and STATE are shown (no street address):**
- Extract city and state with HIGH confidence
- Set street_address to NULL (do not use architect's street address)
- Add note: "Street address not found on floor plans - only city/state available"

**NEVER use the architect/engineer firm's street address as the facility address.**

The address format is typically: Street Address, City, State ZIP (e.g., "123 Main St, Portland, OR 97204")

CROSS-REFERENCE between documents:
- Floor plans → ADDRESS (street, city, state, zip)
- P&L statements → FINANCIALS (revenue, EBITDA, expenses)
- Census reports → OCCUPANCY and PAYER MIX percentages
- Rate schedules → PRICING by payer type
- The facility name may appear in headers/footers of ANY document

Extract a SINGLE combined dataset. If address is found in floor plans, it MUST be included in the output even if other documents don't mention it.

Documents analyzed: ${successfulFiles.map(f => f.name).join(', ')}`
    });

    // Step 4: Make single API call with all content
    console.log(`Calling Claude API with ${successfulFiles.length} documents combined...`);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: content
      }]
    });

    // Step 5: Parse the response
    const responseText = response.content[0].text;

    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Flatten and post-process
    const flattenedData = flattenExtractedData(extractedData);
    const processedData = postProcessExtraction(flattenedData);

    // Add extraction metadata
    processedData._extractionMethod = 'combined-multi-doc';
    processedData._documentsProcessed = successfulFiles.map(f => f.name);

    return {
      success: true,
      mergedData: processedData,
      individualResults: processedFiles.map(f => ({
        fileName: f.name,
        success: !f.error,
        error: f.error,
        contentType: f.contentType
      })),
      confidence: calculateConfidence(processedData),
      extractionMethod: 'combined'
    };

  } catch (error) {
    console.error('Combined extraction error:', error);
    console.log('Falling back to sequential extraction...');
    return await extractFromMultipleDocumentsSequential(files);
  }
}

/**
 * Fallback: Sequential extraction for when combined approach fails or content is too large
 */
async function extractFromMultipleDocumentsSequential(files) {
  console.log(`Processing ${files.length} documents sequentially (fallback mode)...`);

  const results = [];
  let mergedData = {};
  let allDocumentTypes = [];
  let allQualityNotes = [];
  let allObservations = [];

  for (const file of files) {
    const result = await extractDealFromDocument(file.data, file.mimetype, file.name);
    results.push({
      fileName: file.name,
      ...result
    });

    // Merge non-null values (later documents override earlier ones)
    if (result.success && result.data) {
      for (const [key, value] of Object.entries(result.data)) {
        // Skip internal fields and arrays that need special handling
        if (key.startsWith('_') || key === 'document_types_identified' ||
            key === 'data_quality_notes' || key === 'key_observations' ||
            key === 'private_pay_rates' || key === 'medicaid_rates') {
          continue;
        }
        if (value !== null && value !== undefined && value !== '') {
          mergedData[key] = value;
        }
      }

      // Merge rate arrays (combine unique entries)
      if (result.data.private_pay_rates && result.data.private_pay_rates.length > 0) {
        mergedData.private_pay_rates = mergedData.private_pay_rates || [];
        mergedData.private_pay_rates = [...mergedData.private_pay_rates, ...result.data.private_pay_rates];
      }
      if (result.data.medicaid_rates && result.data.medicaid_rates.length > 0) {
        mergedData.medicaid_rates = mergedData.medicaid_rates || [];
        mergedData.medicaid_rates = [...mergedData.medicaid_rates, ...result.data.medicaid_rates];
      }

      // Collect document types, quality notes, and observations
      if (result.data.document_types_identified) {
        allDocumentTypes = [...new Set([...allDocumentTypes, ...result.data.document_types_identified])];
      }
      if (result.data.data_quality_notes) {
        allQualityNotes = [...allQualityNotes, ...result.data.data_quality_notes];
      }
      if (result.data.key_observations) {
        allObservations = [...allObservations, ...result.data.key_observations];
      }
    }
  }

  // Add collected arrays to merged data
  mergedData.document_types_identified = allDocumentTypes;
  mergedData.data_quality_notes = [...new Set(allQualityNotes)]; // Dedupe notes
  mergedData.key_observations = [...new Set(allObservations)]; // Dedupe observations
  mergedData._extractionMethod = 'sequential-multi-doc';

  // Ensure rate arrays exist
  mergedData.private_pay_rates = mergedData.private_pay_rates || [];
  mergedData.medicaid_rates = mergedData.medicaid_rates || [];

  return {
    success: results.some(r => r.success),
    mergedData: postProcessExtraction(mergedData),
    individualResults: results,
    confidence: calculateConfidence(mergedData),
    extractionMethod: 'sequential'
  };
}

module.exports = {
  extractDealFromDocument,
  extractFromMultipleDocuments,
  flattenExtractedData
};
