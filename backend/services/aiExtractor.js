/**
 * AI Document Extraction Service
 * Uses Claude to extract deal information from uploaded documents
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Period analyzer for detecting financial document time periods
const { analyzeFinancialPeriods, generatePromptSection, shouldAnalyzePeriods } = require('./periodAnalyzer');

// Extraction data validator for ensuring flat structure
const { validateFlatStructure, sanitizeExtractionData } = require('./extractionValidator');

// pdf-parse v1.x - simple function-based API that accepts buffers
const pdfParse = require('pdf-parse');
console.log('pdf-parse loaded:', typeof pdfParse === 'function' ? 'success' : 'failed');

// pdf-to-img for vision-based PDF processing (loaded dynamically as ESM)
let pdfToImg = null;
const MIN_TEXT_LENGTH = 100; // Minimum characters to consider text extraction successful
const MAX_PDF_PAGES = 10; // Maximum pages to process for vision

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Build the unified extraction + overview prompt for healthcare M&A documents
 * Version 7.0 - Net Income focus, mandatory period analysis compliance
 */
function buildExtractionPrompt() {
  return `You are an expert healthcare M&A analyst specializing in assisted living facilities (ALF) and skilled nursing facilities (SNF). You extract structured deal data and generate a Stage 1 deal screening from uploaded documents.

---

## STEP 1: DOCUMENT IDENTIFICATION

Identify what types of documents you're analyzing:
- P&L / Income Statement → Extract revenue, expenses, net income
- Census Report → Extract occupancy, payer mix, infer bed count
- Rent Roll → Extract unit mix, unit count, rental rates
- Rate Schedule → Extract pricing tiers by payer type
- Floor Plans → Extract location info, unit counts
- CIM/Offering Memo → Extract deal terms, pricing, contact info

---

## STEP 2: MANDATORY — FOLLOW PERIOD ANALYSIS

**If a "Target Period" and "Source Map" are provided in the FINANCIAL PERIOD ANALYSIS section, you MUST:**

1. Use EXACTLY the Target Period specified — do not calculate your own
2. Pull each month's data from the document specified in the Source Map
3. Report the period exactly as specified in \`ttm_financials.period\`

**DO NOT attempt to determine the TTM period yourself when guidance is provided.**

If NO period analysis is provided, then identify the freshest 12-month period by:
1. Finding the most recent month with complete financial data
2. Working backwards 12 months
3. Combining multiple documents if needed

**NEVER use a pre-calculated T12 total when fresher monthly data exists in another document.**

---

## STEP 3: EXTRACTION RULES

### Deal Name
- If explicit deal name in CIM, use it
- Otherwise: deal_name = facility_name + " Acquisition"

### Facility Type
- "ALF", "Assisted Living", "RCF", "Residential Care" → "ALF"
- "SNF", "Skilled Nursing", "Nursing Facility" → "SNF"
- "Memory Care", "MC", "Dementia Care" → "Memory Care"
- If document has Medicaid care levels L1-L5 (not RUG/PDPM), likely ALF

### Location (CRITICAL)
1. Extract STATE first from: rate schedules, document headers, addresses
2. Extract CITY from: architect stamps, letterheads, facility addresses
3. VALIDATION: City MUST exist in the identified state
4. If uncertain, return null — NEVER guess

### Licensed Beds/Units
- If explicit bed count found, use it
- Otherwise: beds = MAX(census values) rounded UP to nearest 5
- Mark source as "explicit" or "inferred"

### Financial Data — Net Income Focus
Extract these line items for each month in the TTM period:
- **Revenue** (total)
- **Expenses** (total)
- **Net Income** (Revenue - Expenses, or "Total Income/Loss" line)
- **Rent/Lease Expense** (extract separately)
- **Interest Expense** (extract separately)
- **Depreciation** (extract separately)

**DO NOT calculate EBITDAR.** Just report Net Income and the add-back components separately.

### Revenue by Payer
From P&L, extract dollar amounts:
- Medicaid revenue
- Private pay revenue
- Other revenue

### Payer Mix (Census-Based)
From Census Reports:
- Calculate: (payer_days / total_days) × 100
- Report Medicaid %, Private Pay %

### Operating Trends
Compare most recent 3 months vs prior period:
- Revenue trend: UP (>5% increase), FLAT (±5%), DOWN (>5% decrease)
- Census trend
- Net Income trend

---

## STEP 4: RED FLAGS & STRENGTHS

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

## STEP 5: OUTPUT FORMAT

Return valid JSON with this exact structure. Target 3000-5000 characters total.

\`\`\`json
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
\`\`\`

---

## SUMMARY FORMAT (summary_1000_chars)

Generate this FIRST. Maximum 1000 characters.

\`\`\`
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
\`\`\`

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

---

## OUTPUT

Return ONLY valid JSON. No markdown code blocks. No explanatory text.`;
}

/**
 * Build the period analysis section to inject into the extraction prompt
 * This provides Claude with pre-analyzed period information to guide T12 extraction
 *
 * @param {Object} periodAnalysis - Result from analyzeDocumentPeriods()
 * @returns {string} Formatted prompt section for period analysis
 */
/**
 * Build the period analysis prompt section using the periodAnalyzer's generatePromptSection
 * This integrates the enhanced period detection and source mapping into Claude's prompt
 */
function buildPeriodAnalysisPrompt(periodAnalysis) {
  if (!periodAnalysis) {
    return '';
  }

  // Use the new generatePromptSection from periodAnalyzer for richer prompts
  return generatePromptSection(periodAnalysis);
}

/**
 * Extract text from PDF buffer
 * Uses pdf-parse v1.x simple function API
 */
async function extractTextFromPDF(buffer) {
  try {
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
/**
 * Helper to flatten a single facility object from the AI response
 */
function flattenFacility(facilityData) {
  if (!facilityData) return null;

  return {
    facility_name: getValue(facilityData.facility_name),
    facility_type: getValue(facilityData.facility_type),
    address: getValue(facilityData.street_address),
    city: getValue(facilityData.city),
    state: getValue(facilityData.state),
    zip_code: getValue(facilityData.zip_code),
    county: getValue(facilityData.county),
    bed_count: getValue(facilityData.total_beds || facilityData.bed_count),
    licensed_beds: getValue(facilityData.licensed_beds),
    certified_beds: getValue(facilityData.certified_beds),
    purchase_price: getValue(facilityData.purchase_price),
    annual_revenue: getValue(facilityData.annual_revenue),
    ebitda: getValue(facilityData.ebitda),
    ebitdar: getValue(facilityData.ebitdar),
    noi: getValue(facilityData.noi),
    annual_rent: getValue(facilityData.annual_rent),
    occupancy_rate: getValue(facilityData.occupancy_rate),
    medicare_mix: getValue(facilityData.medicare_mix),
    medicaid_mix: getValue(facilityData.medicaid_mix),
    private_pay_mix: getValue(facilityData.private_pay_mix),
    managed_care_mix: getValue(facilityData.managed_care_mix),
    notes: getValue(facilityData.notes),
    // Store original extraction data for reference
    extraction_data: facilityData,
  };
}

/**
 * Normalize key_observations to the new structured format
 * Handles both legacy array format and new structured object format
 * @param {Array|Object} observations - The key_observations from extraction
 * @returns {Object} Normalized structured observations
 */
function normalizeKeyObservations(observations) {
  const defaultStructure = {
    deal_strengths: [],
    deal_risks: [],
    missing_data: [],
    calculation_notes: []
  };

  if (!observations) {
    return defaultStructure;
  }

  // If it's already the new structured format, return it
  if (typeof observations === 'object' && !Array.isArray(observations)) {
    return {
      deal_strengths: observations.deal_strengths || [],
      deal_risks: observations.deal_risks || [],
      missing_data: observations.missing_data || [],
      calculation_notes: observations.calculation_notes || []
    };
  }

  // If it's the legacy array format, put all items in a general category
  // (treat them as observations that need to be categorized)
  if (Array.isArray(observations)) {
    // For legacy data, put all observations in deal_risks as they were typically warnings
    return {
      deal_strengths: [],
      deal_risks: observations,
      missing_data: [],
      calculation_notes: []
    };
  }

  return defaultStructure;
}

/**
 * Convert V7 schema red_flags/strengths to legacy key_observations format
 * This provides backward compatibility for existing frontend components
 * @param {Object} data - V7 extraction data with red_flags and strengths arrays
 * @returns {Object} Legacy key_observations structure
 */
function convertV7ToKeyObservations(data) {
  const result = {
    deal_strengths: [],
    deal_risks: [],
    missing_data: [],
    calculation_notes: []
  };

  // Convert strengths array to deal_strengths strings
  if (data.strengths && Array.isArray(data.strengths)) {
    result.deal_strengths = data.strengths.map(s => {
      if (typeof s === 'string') return s;
      return `${s.strength}: ${s.value}`;
    });
  }

  // Convert red_flags array to deal_risks strings
  if (data.red_flags && Array.isArray(data.red_flags)) {
    result.deal_risks = data.red_flags.map(rf => {
      if (typeof rf === 'string') return rf;
      const severity = rf.severity ? `[${rf.severity}] ` : '';
      return `${severity}${rf.issue}: ${rf.impact}`;
    });
  }

  // Add diligence items as missing_data (they often overlap conceptually)
  if (data.diligence_items && Array.isArray(data.diligence_items)) {
    result.missing_data = data.diligence_items.filter(item => typeof item === 'string');
  }

  // Add turnaround info as calculation notes if present
  if (data.turnaround && data.turnaround.required) {
    result.calculation_notes.push(`Turnaround required: ${data.turnaround.top_initiatives?.join(', ') || 'See turnaround details'}`);
  }

  return result;
}

function flattenExtractedData(data) {
  // Detect schema version: V7 uses facility_snapshot, older versions use facility_information
  const isV7Schema = !!data.facility_snapshot || !!data.ttm_financials;

  const flat = {
    // Document types identified
    document_types_identified: data.document_types_identified || [],

    // ============================================
    // V7 NEW FIELDS - Overview/Screening Data
    // ============================================

    // Summary (1000 chars max overview)
    summary_1000_chars: data.summary_1000_chars || null,

    // Red flags array - [{issue, impact, severity}]
    red_flags: data.red_flags || [],

    // Strengths array - [{strength, value}]
    strengths: data.strengths || [],

    // Turnaround info - {required, top_initiatives, investment_needed, timeline_months, key_risk}
    turnaround: data.turnaround || null,

    // Diligence items array - prioritized list of items to verify
    diligence_items: data.diligence_items || [],

    // Operating trends - {period_comparison, revenue_trend, census_trend, net_income_trend, trend_summary}
    operating_trends: data.operating_trends || null,

    // Source citations - {revenue_source, census_source, rates_source}
    source_citations: data.source_citations || null,

    // ============================================
    // FACILITY INFORMATION (V7: facility_snapshot, Legacy: facility_information)
    // ============================================
    facility_name: isV7Schema
      ? data.facility_snapshot?.facility_name
      : getValue(data.facility_information?.facility_name),
    facility_type: isV7Schema
      ? data.facility_snapshot?.facility_type
      : getValue(data.facility_information?.facility_type),
    city: isV7Schema
      ? data.facility_snapshot?.city
      : getValue(data.facility_information?.city),
    state: isV7Schema
      ? data.facility_snapshot?.state
      : getValue(data.facility_information?.state),
    bed_count: isV7Schema
      ? data.facility_snapshot?.licensed_beds
      : getValue(data.facility_information?.bed_count),
    bed_count_method: isV7Schema
      ? (data.facility_snapshot?.beds_source || 'explicit')
      : (data.facility_information?.bed_count?.method || 'explicit'),
    current_census: isV7Schema
      ? data.facility_snapshot?.current_census
      : getValue(data.census_and_occupancy?.average_daily_census),
    current_occupancy: isV7Schema
      ? data.facility_snapshot?.current_occupancy_pct
      : getValue(data.census_and_occupancy?.occupancy_percentage),
    ownership_type: isV7Schema
      ? data.facility_snapshot?.ownership_type
      : null,
    year_built: isV7Schema
      ? data.facility_snapshot?.year_built
      : null,
    last_renovation: isV7Schema
      ? data.facility_snapshot?.last_renovation
      : null,

    // Legacy facility fields (still support if present)
    street_address: getValue(data.facility_information?.street_address),
    zip_code: getValue(data.facility_information?.zip_code),
    unit_mix: getValue(data.facility_information?.unit_mix),

    // ============================================
    // TTM FINANCIALS (V7: ttm_financials, Legacy: financial_information_t12)
    // ============================================

    // Period info
    ttm_period: isV7Schema ? data.ttm_financials?.period : null,
    ttm_data_sources: isV7Schema ? data.ttm_financials?.data_sources : null,
    financial_period_start: data.financial_information_t12?.period?.start || null,
    financial_period_end: data.financial_information_t12?.period?.end || null,
    financial_period_note: data.financial_information_t12?.period?.note || null,

    // Core financials
    annual_revenue: isV7Schema
      ? data.ttm_financials?.revenue
      : getValue(data.financial_information_t12?.total_revenue),
    t12m_revenue: isV7Schema
      ? data.ttm_financials?.revenue
      : getValue(data.financial_information_t12?.total_revenue),
    total_expenses: isV7Schema
      ? data.ttm_financials?.expenses
      : getValue(data.financial_information_t12?.total_expenses),
    annual_expenses: isV7Schema
      ? data.ttm_financials?.expenses
      : getValue(data.financial_information_t12?.total_expenses),

    // Net Income (V7 primary metric)
    net_income: isV7Schema
      ? data.ttm_financials?.net_income
      : getValue(data.financial_information_t12?.net_income),
    net_income_margin: isV7Schema
      ? data.ttm_financials?.net_income_margin_pct
      : null,

    // Add-back components (V7 extracts these separately)
    rent_lease_expense: isV7Schema
      ? data.ttm_financials?.rent_lease
      : getValue(data.financial_information_t12?.rent_lease_expense),
    current_rent_lease_expense: isV7Schema
      ? data.ttm_financials?.rent_lease
      : getValue(data.financial_information_t12?.rent_lease_expense),
    interest_expense: isV7Schema
      ? data.ttm_financials?.interest
      : getValue(data.financial_information_t12?.interest_expense),
    depreciation: isV7Schema
      ? data.ttm_financials?.depreciation
      : getValue(data.financial_information_t12?.depreciation),

    // Census metrics from TTM
    average_daily_census: isV7Schema
      ? data.ttm_financials?.avg_census
      : getValue(data.census_and_occupancy?.average_daily_census),
    revenue_per_resident_day: isV7Schema
      ? data.ttm_financials?.revenue_per_resident_day
      : null,

    // Legacy EBITDAR/EBITDA/EBIT fields (may not be present in V7)
    ebit: getValue(data.financial_information_t12?.ebit),
    t12m_ebit: getValue(data.financial_information_t12?.ebit),
    ebitda: getValue(data.financial_information_t12?.ebitda),
    t12m_ebitda: getValue(data.financial_information_t12?.ebitda),
    ebitdar: getValue(data.financial_information_t12?.ebitdar),
    t12m_ebitdar: getValue(data.financial_information_t12?.ebitdar),
    amortization: getValue(data.financial_information_t12?.amortization),
    net_operating_income: getValue(data.financial_information_t12?.net_income),
    calculation_details: data.financial_information_t12?.calculation_details || null,

    // ============================================
    // PAYER MIX (V7: payer_mix, Legacy: census_and_occupancy)
    // ============================================
    medicaid_percentage: isV7Schema
      ? data.payer_mix?.medicaid_pct
      : (getValue(data.census_and_occupancy?.payer_mix_by_census?.medicaid_pct) ||
         getValue(data.census_and_occupancy?.payer_mix_by_revenue?.medicaid_pct)),
    private_pay_percentage: isV7Schema
      ? data.payer_mix?.private_pay_pct
      : (getValue(data.census_and_occupancy?.payer_mix_by_census?.private_pay_pct) ||
         getValue(data.census_and_occupancy?.payer_mix_by_revenue?.private_pay_pct)),
    medicaid_revenue: isV7Schema
      ? data.payer_mix?.medicaid_revenue
      : getValue(data.financial_information_t12?.revenue_by_payer?.medicaid_revenue),
    private_pay_revenue: isV7Schema
      ? data.payer_mix?.private_pay_revenue
      : getValue(data.financial_information_t12?.revenue_by_payer?.private_pay_revenue),

    // Legacy payer mix fields
    medicare_percentage: getValue(data.census_and_occupancy?.payer_mix_by_census?.medicare_pct) ||
                         getValue(data.census_and_occupancy?.payer_mix_by_revenue?.medicare_pct),
    other_payer_percentage: getValue(data.census_and_occupancy?.payer_mix_by_census?.other_pct) ||
                            getValue(data.census_and_occupancy?.payer_mix_by_revenue?.other_pct),
    medicare_revenue: getValue(data.financial_information_t12?.revenue_by_payer?.medicare_revenue),
    other_revenue: getValue(data.financial_information_t12?.revenue_by_payer?.other_revenue),
    payer_mix_census_source: data.census_and_occupancy?.payer_mix_by_census?.source || null,
    payer_mix_revenue_source: data.census_and_occupancy?.payer_mix_by_revenue?.source || null,

    // ============================================
    // RATE INFORMATION (V7: simplified strings, Legacy: arrays)
    // ============================================
    rate_information: isV7Schema ? data.rate_information : null,
    private_pay_rates: isV7Schema
      ? data.rate_information?.private_pay_rates
      : (getValue(data.rate_information?.private_pay_rates) ||
         data.rate_information?.private_pay_rates?.value ||
         data.rate_information?.private_pay_rates || []),
    medicaid_rates: isV7Schema
      ? data.rate_information?.medicaid_rates
      : (getValue(data.rate_information?.medicaid_rates) ||
         data.rate_information?.medicaid_rates?.value ||
         data.rate_information?.medicaid_rates || []),
    rate_gap: isV7Schema ? data.rate_information?.rate_gap : null,
    average_daily_rate: getValue(data.rate_information?.average_daily_rate),
    private_pay_rates_source: getSource(data.rate_information?.private_pay_rates),
    medicaid_rates_source: getSource(data.rate_information?.medicaid_rates),

    // ============================================
    // LEGACY FIELDS (for backward compatibility)
    // ============================================

    // Portfolio deal indicator
    is_portfolio_deal: data.is_portfolio_deal || false,
    facility_count: data.facility_count || 1,

    // Deal information (legacy)
    deal_name: getValue(data.deal_information?.deal_name),
    deal_name_derived_from: data.deal_information?.deal_name?.derived_from || null,
    deal_type: getValue(data.deal_information?.deal_type),
    deal_source: getValue(data.deal_information?.deal_source),
    priority_level: getValue(data.deal_information?.priority_level),
    purchase_price: getValue(data.deal_information?.purchase_price),
    price_per_bed: getValue(data.deal_information?.price_per_bed),

    // Contact information (legacy)
    primary_contact_name: getValue(data.contact_information?.primary_contact_name),
    title: getValue(data.contact_information?.title),
    phone_number: getValue(data.contact_information?.phone),
    email: getValue(data.contact_information?.email),

    // Revenue breakdown by type (legacy)
    revenue_room_and_board: getValue(data.financial_information_t12?.revenue_breakdown?.room_and_board),
    revenue_care_level: getValue(data.financial_information_t12?.revenue_breakdown?.care_level_revenue),
    revenue_ancillary: getValue(data.financial_information_t12?.revenue_breakdown?.ancillary_revenue),
    revenue_other_income: getValue(data.financial_information_t12?.revenue_breakdown?.other_income),

    // Expense details (legacy)
    operating_expenses: getValue(data.financial_information_t12?.operating_expenses),
    property_taxes: getValue(data.financial_information_t12?.property_taxes),
    property_insurance: getValue(data.financial_information_t12?.property_insurance),

    // Expense ratios (legacy)
    expense_ratios: data.financial_information_t12?.expense_ratios || null,
    total_labor_cost: getValue(data.financial_information_t12?.expense_ratios?.total_labor_cost),
    labor_pct_of_revenue: getValue(data.financial_information_t12?.expense_ratios?.labor_pct_of_revenue),
    agency_pct_of_direct_care: getValue(data.financial_information_t12?.expense_ratios?.agency_pct_of_direct_care),
    agency_pct_of_labor: getValue(data.financial_information_t12?.expense_ratios?.agency_pct_of_labor),
    food_cost_per_resident_day: getValue(data.financial_information_t12?.expense_ratios?.food_cost_per_resident_day),
    food_pct_of_revenue: getValue(data.financial_information_t12?.expense_ratios?.food_pct_of_revenue),
    management_fee_pct: getValue(data.financial_information_t12?.expense_ratios?.management_fee_pct),
    admin_pct_of_revenue: getValue(data.financial_information_t12?.expense_ratios?.admin_pct_of_revenue),
    bad_debt_pct: getValue(data.financial_information_t12?.expense_ratios?.bad_debt_pct),
    utilities_pct_of_revenue: getValue(data.financial_information_t12?.expense_ratios?.utilities_pct_of_revenue),
    property_cost_per_bed: getValue(data.financial_information_t12?.expense_ratios?.property_cost_per_bed),
    insurance_pct_of_revenue: getValue(data.financial_information_t12?.expense_ratios?.insurance_pct_of_revenue),
    insurance_per_bed: getValue(data.financial_information_t12?.expense_ratios?.insurance_per_bed),

    // Benchmark comparison (legacy)
    benchmark_comparison: data.financial_information_t12?.benchmark_comparison || null,

    // Expense detail (legacy)
    expense_detail: data.financial_information_t12?.expense_detail || null,

    // YTD Performance (legacy)
    ytd_period_start: data.ytd_performance?.period?.start || null,
    ytd_period_end: data.ytd_performance?.period?.end || null,
    ytd_revenue: getValue(data.ytd_performance?.total_revenue),
    ytd_expenses: getValue(data.ytd_performance?.total_expenses),
    ytd_net_income: getValue(data.ytd_performance?.net_income),
    ytd_average_daily_census: getValue(data.ytd_performance?.average_daily_census),
    ytd_medicaid_days: getValue(data.ytd_performance?.medicaid_days),
    ytd_private_pay_days: getValue(data.ytd_performance?.private_pay_days),
    ytd_total_census_days: getValue(data.ytd_performance?.total_census_days),

    // Occupancy (legacy aliases)
    t12m_occupancy: isV7Schema
      ? data.facility_snapshot?.current_occupancy_pct
      : getValue(data.census_and_occupancy?.occupancy_percentage),

    // Pro forma projections (legacy)
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

    // Deal metrics (legacy)
    revenue_multiple: getValue(data.deal_metrics?.revenue_multiple),
    ebitda_multiple: getValue(data.deal_metrics?.ebitda_multiple),
    projected_cap_rate_percentage: getValue(data.deal_metrics?.cap_rate),
    target_irr_percentage: getValue(data.deal_metrics?.target_irr),
    target_hold_period: getValue(data.deal_metrics?.hold_period_years),

    // Data quality and observations
    data_quality_notes: data.data_quality_notes || [],
    // key_observations - V7 uses red_flags/strengths instead, but keep for backward compat
    key_observations: isV7Schema
      ? convertV7ToKeyObservations(data)
      : normalizeKeyObservations(data.key_observations),

    // Set defaults
    country: 'USA'
  };

  // Process facilities array for multi-facility deals
  if (data.facilities && Array.isArray(data.facilities) && data.facilities.length > 0) {
    flat.extracted_facilities = data.facilities
      .map(f => flattenFacility(f))
      .filter(f => f !== null && f.facility_name !== null);
  } else {
    flat.extracted_facilities = [];
  }

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
    bed_count: getConfidence(data.facility_information?.bed_count),
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
    bed_count: getSource(data.facility_information?.bed_count),
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

  // Validate the flattened structure
  const validation = validateFlatStructure(flat);
  if (!validation.isValid) {
    console.error('[flattenExtractedData] Validation ERRORS:', validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.warn('[flattenExtractedData] Validation warnings:', validation.warnings);
  }

  // Sanitize and return
  return sanitizeExtractionData(flat);
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

    // Try to extract JSON from the response with robust repair logic
    let extractedData;
    try {
      // Try direct parse first
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      console.log('Initial JSON parse failed, attempting repair...');

      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
        || responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];

        // Common JSON repair patterns
        // 1. Remove trailing commas before } or ]
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        // 2. Fix unquoted property names (simple cases)
        jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        // 3. Remove control characters
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
        // 4. Fix single quotes to double quotes
        jsonStr = jsonStr.replace(/'/g, '"');

        try {
          extractedData = JSON.parse(jsonStr);
          console.log('JSON repair successful');
        } catch (repairError) {
          // Last resort: try to find the largest valid JSON object
          console.log('JSON repair failed, trying partial extraction...');
          const partialMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (partialMatch) {
            const sorted = partialMatch.sort((a, b) => b.length - a.length);
            for (const candidate of sorted) {
              try {
                extractedData = JSON.parse(candidate);
                console.log('Partial JSON extraction successful');
                break;
              } catch {
                continue;
              }
            }
          }

          if (!extractedData) {
            throw new Error(`Could not parse AI response as JSON: ${parseError.message}`);
          }
        }
      } else {
        throw new Error('Could not find JSON in AI response');
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
  if (!data.price_per_bed && data.purchase_price && data.bed_count) {
    data.price_per_bed = Math.round(data.purchase_price / data.bed_count);
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
    'bed_count', 'purchase_price', 'annual_revenue', 'ebitda', 'ebitda_margin',
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
    'proforma_year3_annual_ebit', 'proforma_year3_average_occupancy',
    // Expense ratios
    'total_labor_cost', 'labor_pct_of_revenue', 'agency_pct_of_direct_care',
    'agency_pct_of_labor', 'food_cost_per_resident_day', 'food_pct_of_revenue',
    'management_fee_pct', 'admin_pct_of_revenue', 'bad_debt_pct',
    'utilities_pct_of_revenue', 'property_cost_per_bed', 'insurance_pct_of_revenue',
    'insurance_per_bed'
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
    'deal_name', 'facility_name', 'facility_type', 'bed_count',
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

    // Step 2.5: Run period analysis on documents that have text content
    let periodAnalysis = null;
    const docsForPeriodAnalysis = processedFiles
      .filter(f => !f.error && f.contentType === 'text' && f.textContent)
      .map(f => ({
        filename: f.name,
        content: f.textContent,
        fileType: f.mimeType?.includes('spreadsheet') || f.name?.match(/\.xlsx?$/i) ? 'xlsx' : 'other'
      }));

    if (shouldAnalyzePeriods(docsForPeriodAnalysis)) {
      console.log(`Running period analysis on ${docsForPeriodAnalysis.length} text documents...`);
      periodAnalysis = analyzeFinancialPeriods(docsForPeriodAnalysis);
      console.log(`Period analysis complete: combination_needed=${periodAnalysis.combination_needed}, ` +
        `overlapping_months=${periodAnalysis.overlapping_months?.length || 0}`);

      if (periodAnalysis.combination_needed) {
        console.log(`  Recommended T12: ${periodAnalysis.recommended_t12?.start} to ${periodAnalysis.recommended_t12?.end}`);
      }
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

    // Build period analysis prompt section if analysis was performed
    const periodAnalysisPrompt = buildPeriodAnalysisPrompt(periodAnalysis);

    // Add the extraction instruction at the end
    content.push({
      type: 'text',
      text: `\n\n========== EXTRACTION INSTRUCTIONS ==========

You have been provided ${successfulFiles.length} documents above. Please extract deal information by analyzing ALL documents together.
${periodAnalysisPrompt}
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

    // Step 5: Parse the response with robust JSON repair
    const responseText = response.content[0].text;

    let extractedData;
    try {
      // Try direct parse first
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      console.log('Initial JSON parse failed in multi-doc extraction, attempting repair...');

      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
        || responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];

        // Common JSON repair patterns
        // 1. Remove trailing commas before } or ]
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        // 2. Fix unquoted property names (simple cases)
        jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        // 3. Remove control characters
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');
        // 4. Fix single quotes to double quotes
        jsonStr = jsonStr.replace(/'/g, '"');

        try {
          extractedData = JSON.parse(jsonStr);
          console.log('JSON repair successful in multi-doc extraction');
        } catch (repairError) {
          // Last resort: try to find the largest valid JSON object
          console.log('JSON repair failed, trying partial extraction...');
          const partialMatch = responseText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (partialMatch) {
            const sorted = partialMatch.sort((a, b) => b.length - a.length);
            for (const candidate of sorted) {
              try {
                extractedData = JSON.parse(candidate);
                console.log('Partial JSON extraction successful');
                break;
              } catch {
                continue;
              }
            }
          }

          if (!extractedData) {
            throw new Error(`Could not parse AI response as JSON: ${parseError.message}`);
          }
        }
      } else {
        throw new Error('Could not find JSON in AI response');
      }
    }

    // Flatten and post-process
    const flattenedData = flattenExtractedData(extractedData);
    const processedData = postProcessExtraction(flattenedData);

    // Add extraction metadata
    processedData._extractionMethod = 'combined-multi-doc';
    processedData._documentsProcessed = successfulFiles.map(f => f.name);

    // Add period analysis metadata if available
    if (periodAnalysis) {
      processedData._periodAnalysis = {
        combination_needed: periodAnalysis.combination_needed,
        overlapping_months: periodAnalysis.overlapping_months,
        recommended_t12: periodAnalysis.recommended_t12,
        documents_analyzed: periodAnalysis.financial_documents?.length || 0
      };
    }

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
      extractionMethod: 'combined',
      periodAnalysis: periodAnalysis // Include full period analysis for verification
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
