/**
 * Period Analyzer Service
 *
 * Analyzes uploaded financial documents to identify time periods and determine
 * the optimal strategy for extracting the freshest possible trailing 12 months.
 *
 * Solves the problem: User uploads T12 (May 2024 - April 2025) and YTD (Mar 2025 - Sept 2025)
 * We should combine these to get Oct 2024 - Sept 2025 (the freshest T12 possible)
 *
 * @module services/periodAnalyzer
 */

const MONTH_NAMES = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

/**
 * Keywords that indicate a document is a financial statement
 */
const FINANCIAL_DOC_KEYWORDS = [
  'income statement', 'p&l', 'p & l', 'profit and loss', 'profit & loss',
  'income expense', 'income & expense', 'i&e', 'i & e',
  'operating statement', 'financial statement', 'trailing 12', 't12', 'ttm',
  'year to date', 'ytd', 'monthly financial', 'rolling 12'
];

/**
 * Keywords that indicate period type
 */
const PERIOD_TYPE_PATTERNS = {
  T12: [/t[-]?12/i, /trailing.*12/i, /ttm/i, /rolling.*12/i, /twelve.*month/i],
  YTD: [/ytd/i, /year.*to.*date/i, /year-to-date/i],
  MTD: [/mtd/i, /month.*to.*date/i],
  QUARTERLY: [/q[1-4]/i, /quarter/i, /quarterly/i],
  ANNUAL: [/annual/i, /yearly/i, /full.*year/i, /fiscal.*year/i]
};

/**
 * Main entry point - analyzes all documents and returns period analysis
 *
 * @param {Array<Object>} documents - Array of document objects
 * @param {string} documents[].filename - Document filename
 * @param {string} documents[].content - Document text content (optional)
 * @param {string} documents[].fileType - File extension (xlsx, xls, pdf, etc.)
 * @returns {Object} Period analysis results
 */
function analyzeFinancialPeriods(documents) {
  const analysis = {
    financial_documents: [],
    non_financial_documents: [],
    freshest_month_available: null,
    recommended_t12: null,
    combination_needed: false,
    overlapping_months: [],
    warnings: []
  };

  // Step 1: Identify financial documents and extract their periods
  for (const doc of documents) {
    const isFinancial = isFinancialDocument(doc);

    if (isFinancial) {
      const periodInfo = extractPeriodInfo(doc);
      analysis.financial_documents.push({
        filename: doc.filename,
        fileType: doc.fileType || getFileExtension(doc.filename),
        ...periodInfo
      });
    } else {
      analysis.non_financial_documents.push(doc.filename);
    }
  }

  // Step 2: Sort by end date (most recent first)
  analysis.financial_documents.sort((a, b) => {
    if (!a.end_date || !b.end_date) return 0;
    return new Date(b.end_date) - new Date(a.end_date);
  });

  // Step 3: Determine if combination is needed and build optimal T12
  if (analysis.financial_documents.length > 0) {
    const result = determineOptimalT12(analysis.financial_documents);
    analysis.freshest_month_available = result.freshest_month;
    analysis.recommended_t12 = result.recommended_t12;
    analysis.combination_needed = result.combination_needed;
    analysis.overlapping_months = result.overlapping_months;
    analysis.warnings = result.warnings;
  }

  return analysis;
}

/**
 * Determines if a document is a financial statement
 *
 * @param {Object} doc - Document object with filename and optional content
 * @returns {boolean}
 */
function isFinancialDocument(doc) {
  const filename = (doc.filename || '').toLowerCase();
  const content = (doc.content || '').toLowerCase().substring(0, 2000); // Check first 2000 chars

  // Normalize filename: remove all spaces, special chars for comparison
  const normalizedFilename = filename.replace(/[\s&_\-\.]+/g, '');

  // Check filename against keywords
  for (const keyword of FINANCIAL_DOC_KEYWORDS) {
    const normalizedKeyword = keyword.replace(/[\s&_\-\.]+/g, '');
    // Check both normalized and original forms
    if (normalizedFilename.includes(normalizedKeyword) ||
        filename.includes(keyword) ||
        filename.includes(keyword.replace(/ /g, '_')) ||
        filename.includes(keyword.replace(/ /g, '-'))) {
      return true;
    }
  }

  // Also check for common abbreviations that might not match exactly
  // e.g., "I & E" = "Income & Expense" or "I&E" = "Income and Expense"
  if (/i\s*[&]\s*e/i.test(filename) || /income.*expense/i.test(filename)) {
    return true;
  }

  // Check content
  for (const keyword of FINANCIAL_DOC_KEYWORDS) {
    if (content.includes(keyword)) {
      return true;
    }
  }

  // Check for common P&L indicators in content
  const plIndicators = ['total income', 'total revenue', 'total expenses', 'net income', 'ebitda'];
  let matchCount = 0;
  for (const indicator of plIndicators) {
    if (content.includes(indicator)) matchCount++;
  }

  return matchCount >= 2;
}

/**
 * Extracts period information from a document
 *
 * @param {Object} doc - Document object
 * @returns {Object} Period information
 */
function extractPeriodInfo(doc) {
  const info = {
    period_type: null,
    start_date: null,
    end_date: null,
    months_covered: 0,
    has_monthly_detail: false,
    confidence: 'low',
    detection_method: null
  };

  // Try filename first
  const filenameResult = detectPeriodFromFilename(doc.filename);
  if (filenameResult.confidence !== 'none') {
    Object.assign(info, filenameResult);
  }

  // Try content if available and filename didn't give high confidence
  if (doc.content && info.confidence !== 'high') {
    const contentResult = detectPeriodFromContent(doc.content);
    if (contentResult.confidence === 'high' ||
        (contentResult.confidence === 'medium' && info.confidence === 'low')) {
      Object.assign(info, contentResult);
    }
  }

  // Calculate months covered if we have both dates
  if (info.start_date && info.end_date) {
    info.months_covered = calculateMonthsBetween(info.start_date, info.end_date);
  }

  return info;
}

/**
 * Detects period information from filename
 *
 * @param {string} filename
 * @returns {Object} Period info with confidence
 */
function detectPeriodFromFilename(filename) {
  const result = {
    period_type: null,
    start_date: null,
    end_date: null,
    has_monthly_detail: false,
    confidence: 'none',
    detection_method: 'filename'
  };

  if (!filename) return result;

  const fn = filename.toLowerCase();

  // Detect period type
  for (const [type, patterns] of Object.entries(PERIOD_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(fn)) {
        result.period_type = type;
        break;
      }
    }
    if (result.period_type) break;
  }

  // Try to extract date range from filename
  // Pattern: Month Year - Month Year or MonthYear-MonthYear
  const dateRangePatterns = [
    // "Mar2025-Sept2025" or "Mar_2025-Sept_2025"
    /([a-z]{3,9})[\s_-]?(\d{4})[\s_-]+([a-z]{3,9})[\s_-]?(\d{4})/i,
    // "March 2025 - September 2025"
    /([a-z]{3,9})\s+(\d{4})\s*[-–—to]+\s*([a-z]{3,9})\s+(\d{4})/i,
    // "2024-05 - 2025-04" or "2024_05_2025_04"
    /(\d{4})[-_](\d{2}).*?(\d{4})[-_](\d{2})/,
    // "April 2025" (single month, likely end date)
    /([a-z]{3,9})[\s_-]?(\d{4})/i
  ];

  for (const pattern of dateRangePatterns) {
    const match = fn.match(pattern);
    if (match) {
      if (match.length >= 5) {
        // Full date range
        const startDate = parseMonthYear(match[1], match[2]);
        const endDate = parseMonthYear(match[3], match[4]);

        if (startDate && endDate) {
          result.start_date = startDate;
          result.end_date = endDate;
          result.confidence = 'high';
          break;
        }
      } else if (match.length >= 3) {
        // Single date - likely end date for T12
        const date = parseMonthYear(match[1], match[2]);
        if (date) {
          result.end_date = date;

          // If it's a T12, calculate start date
          if (result.period_type === 'T12' || fn.includes('t12') || fn.includes('trailing')) {
            result.start_date = subtractMonths(date, 11);
            result.period_type = 'T12';
          }

          result.confidence = 'medium';
          break;
        }
      }
    }
  }

  // Check for monthly detail indicators
  if (fn.includes('monthly') || fn.includes('by month') || fn.includes('detail')) {
    result.has_monthly_detail = true;
  }

  return result;
}

/**
 * Detects period information from document content
 *
 * @param {string} content - Document text content
 * @returns {Object} Period info with confidence
 */
function detectPeriodFromContent(content) {
  const result = {
    period_type: null,
    start_date: null,
    end_date: null,
    has_monthly_detail: false,
    confidence: 'none',
    detection_method: 'content'
  };

  if (!content) return result;

  const text = content.toLowerCase();

  // Detect period type from content
  for (const [type, patterns] of Object.entries(PERIOD_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        result.period_type = type;
        break;
      }
    }
    if (result.period_type) break;
  }

  // Look for date headers or period statements
  const periodStatements = [
    // "Year to Date - March 2025 - September 2025"
    /year\s+to\s+date.*?([a-z]{3,9})\s+(\d{4}).*?([a-z]{3,9})\s+(\d{4})/i,
    // "Rolling T-12" followed by dates
    /rolling\s+t-?12.*?([a-z]{3,9})\s+(\d{4}).*?([a-z]{3,9})\s+(\d{4})/i,
    // "Period: May 2024 - April 2025"
    /period[:\s]+([a-z]{3,9})\s+(\d{4})\s*[-–—to]+\s*([a-z]{3,9})\s+(\d{4})/i,
    // "For the twelve months ended April 2025"
    /twelve\s+months\s+ended\s+([a-z]{3,9})\s+(\d{4})/i,
    // Column headers with months - detect monthly detail
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\/\-]?\d{2,4}/gi
  ];

  for (const pattern of periodStatements) {
    const match = text.match(pattern);
    if (match) {
      if (match.length >= 5) {
        // Full date range
        const startDate = parseMonthYear(match[1], match[2]);
        const endDate = parseMonthYear(match[3], match[4]);

        if (startDate && endDate) {
          result.start_date = startDate;
          result.end_date = endDate;
          result.confidence = 'high';
          result.has_monthly_detail = true;
          break;
        }
      } else if (match.length >= 3) {
        // Single end date (e.g., "twelve months ended April 2025")
        const endDate = parseMonthYear(match[1], match[2]);
        if (endDate) {
          result.end_date = endDate;
          result.start_date = subtractMonths(endDate, 11);
          result.period_type = 'T12';
          result.confidence = 'high';
          break;
        }
      }
    }
  }

  // Check for monthly column headers (indicates monthly detail)
  const monthMatches = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s\/\-]?\d{2,4}/gi);
  if (monthMatches && monthMatches.length >= 6) {
    result.has_monthly_detail = true;

    // Try to extract date range from column headers
    if (!result.start_date || !result.end_date) {
      const dates = monthMatches.map(m => {
        const parts = m.match(/([a-z]{3})[\s\/\-]?(\d{2,4})/i);
        if (parts) {
          let year = parts[2];
          if (year.length === 2) {
            year = parseInt(year) > 50 ? '19' + year : '20' + year;
          }
          return parseMonthYear(parts[1], year);
        }
        return null;
      }).filter(d => d);

      if (dates.length >= 2) {
        dates.sort((a, b) => new Date(a) - new Date(b));
        result.start_date = dates[0];
        result.end_date = dates[dates.length - 1];
        result.confidence = result.confidence === 'none' ? 'medium' : result.confidence;
      }
    }
  }

  return result;
}

/**
 * Parses month name and year into ISO date string
 *
 * @param {string} month - Month name or number
 * @param {string|number} year - Four digit year
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null
 */
function parseMonthYear(month, year) {
  if (!month || !year) return null;

  let monthNum;

  // Handle numeric month
  if (/^\d+$/.test(month)) {
    monthNum = parseInt(month) - 1;
  } else {
    // Handle month name
    const monthLower = month.toLowerCase().substring(0, 3);
    monthNum = MONTH_NAMES[monthLower];

    // Also check full month names
    if (monthNum === undefined) {
      monthNum = MONTH_NAMES[month.toLowerCase()];
    }
  }

  if (monthNum === undefined || monthNum < 0 || monthNum > 11) return null;

  const yearNum = parseInt(year);
  if (isNaN(yearNum)) return null;

  // Return first day of month
  const date = new Date(yearNum, monthNum, 1);
  return date.toISOString().split('T')[0];
}

/**
 * Subtracts months from a date string
 *
 * @param {string} dateStr - ISO date string
 * @param {number} months - Number of months to subtract
 * @returns {string} New ISO date string
 */
function subtractMonths(dateStr, months) {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

/**
 * Adds months to a date string
 *
 * @param {string} dateStr - ISO date string
 * @param {number} months - Number of months to add
 * @returns {string} New ISO date string
 */
function addMonths(dateStr, months) {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

/**
 * Calculates the number of months between two dates (inclusive)
 *
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {number} Number of months
 */
function calculateMonthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return (end.getFullYear() - start.getFullYear()) * 12 +
         (end.getMonth() - start.getMonth()) + 1;
}

/**
 * Gets file extension from filename
 *
 * @param {string} filename
 * @returns {string}
 */
function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Generates a list of months between two dates
 *
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Array<string>} Array of YYYY-MM strings
 */
function generateMonthList(startDate, endDate) {
  const months = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Determines the optimal T12 period by combining available documents
 *
 * @param {Array<Object>} financialDocs - Sorted array of financial documents (most recent first)
 * @returns {Object} Optimal T12 recommendation
 */
function determineOptimalT12(financialDocs) {
  const result = {
    freshest_month: null,
    recommended_t12: null,
    combination_needed: false,
    overlapping_months: [],
    warnings: []
  };

  if (financialDocs.length === 0) return result;

  // Find the freshest end date across all documents
  let freshestEndDate = null;
  for (const doc of financialDocs) {
    if (doc.end_date) {
      if (!freshestEndDate || new Date(doc.end_date) > new Date(freshestEndDate)) {
        freshestEndDate = doc.end_date;
      }
    }
  }

  if (!freshestEndDate) {
    result.warnings.push('Could not determine end dates for any financial documents');
    return result;
  }

  result.freshest_month = freshestEndDate;

  // Calculate optimal T12 period
  const optimalStart = subtractMonths(freshestEndDate, 11);
  const optimalEnd = freshestEndDate;
  const optimalMonths = generateMonthList(optimalStart, optimalEnd);

  // Build source map - determine which document to use for each month
  const sourceMap = {};
  const monthCoverage = {};

  for (const month of optimalMonths) {
    monthCoverage[month] = [];
  }

  // Map each document's coverage
  for (const doc of financialDocs) {
    if (doc.start_date && doc.end_date) {
      const docMonths = generateMonthList(doc.start_date, doc.end_date);
      for (const month of docMonths) {
        if (monthCoverage[month]) {
          monthCoverage[month].push({
            filename: doc.filename,
            period_type: doc.period_type,
            end_date: doc.end_date
          });
        }
      }
    }
  }

  // Assign source for each month (prefer more recent documents)
  const overlappingMonths = [];
  const uncoveredMonths = [];

  for (const month of optimalMonths) {
    const sources = monthCoverage[month];

    if (sources.length === 0) {
      uncoveredMonths.push(month);
      sourceMap[month] = null;
    } else if (sources.length === 1) {
      sourceMap[month] = sources[0].filename;
    } else {
      // Multiple sources - prefer YTD over T12 for overlapping months
      // (YTD is typically more recent even if end date is same)
      overlappingMonths.push(month);

      const ytdSource = sources.find(s => s.period_type === 'YTD');
      const mostRecent = sources.sort((a, b) =>
        new Date(b.end_date) - new Date(a.end_date)
      )[0];

      sourceMap[month] = ytdSource ? ytdSource.filename : mostRecent.filename;
    }
  }

  result.overlapping_months = overlappingMonths;

  // Check if combination is actually needed
  const uniqueSources = [...new Set(Object.values(sourceMap).filter(v => v))];
  result.combination_needed = uniqueSources.length > 1;

  // Add warnings for uncovered months
  if (uncoveredMonths.length > 0) {
    result.warnings.push(`Missing data for months: ${uncoveredMonths.join(', ')}`);
  }

  // Build the recommendation
  result.recommended_t12 = {
    start: optimalStart,
    end: optimalEnd,
    months_count: 12,
    source_map: sourceMap,
    sources_used: uniqueSources,
    coverage_complete: uncoveredMonths.length === 0
  };

  // Add summary of which months come from which document
  if (result.combination_needed) {
    const sourceBreakdown = {};
    for (const [month, source] of Object.entries(sourceMap)) {
      if (source) {
        if (!sourceBreakdown[source]) {
          sourceBreakdown[source] = [];
        }
        sourceBreakdown[source].push(month);
      }
    }
    result.recommended_t12.source_breakdown = sourceBreakdown;
  }

  return result;
}

/**
 * Generates prompt text to include in Claude extraction prompt
 *
 * @param {Object} analysis - Output from analyzeFinancialPeriods()
 * @returns {string} Prompt text
 */
function generatePromptSection(analysis) {
  if (!analysis || analysis.financial_documents.length === 0) {
    return `
## FINANCIAL PERIOD ANALYSIS

No financial documents were identified for period analysis.
Extract financial data from available documents using standard procedures.
`;
  }

  let prompt = `
## FINANCIAL PERIOD ANALYSIS

### Documents Identified
${analysis.financial_documents.map(doc => `
- **${doc.filename}**
  - Type: ${doc.period_type || 'Unknown'}
  - Period: ${doc.start_date || '?'} to ${doc.end_date || '?'}
  - Monthly Detail: ${doc.has_monthly_detail ? 'Yes' : 'No'}
  - Confidence: ${doc.confidence}
`).join('')}
`;

  if (analysis.combination_needed && analysis.recommended_t12) {
    const t12 = analysis.recommended_t12;

    prompt += `
### ⚠️ COMBINATION REQUIRED

Multiple financial documents cover different periods. Combine them to extract the **freshest possible T12**.

**Target Period**: ${t12.start} to ${t12.end}

**Source Map** (which document to use for each month):
${Object.entries(t12.source_map).map(([month, source]) =>
  `- ${month}: ${source || '⚠️ NO DATA'}`
).join('\n')}

**Instructions**:
1. For each month listed above, pull data from the specified document
2. Sum monthly values to get T12 totals
3. For overlapping months (${analysis.overlapping_months.join(', ')}), use the source specified above (more recent document preferred)
4. If values in overlapping months differ by >5%, flag in data_quality_notes

**Include in your output**:
\`\`\`json
"financial_period_analysis": {
  "period_extracted": {
    "start": "${t12.start}",
    "end": "${t12.end}"
  },
  "is_combined": true,
  "sources_used": ${JSON.stringify(t12.sources_used)},
  "overlapping_months_handled": ${JSON.stringify(analysis.overlapping_months)}
}
\`\`\`
`;
  } else if (analysis.financial_documents.length > 0) {
    const primaryDoc = analysis.financial_documents[0];

    prompt += `
### Single Document Period

Extract financials for the period: ${primaryDoc.start_date || 'start'} to ${primaryDoc.end_date || 'end'}

**Include in your output**:
\`\`\`json
"financial_period_analysis": {
  "period_extracted": {
    "start": "${primaryDoc.start_date}",
    "end": "${primaryDoc.end_date}"
  },
  "is_combined": false,
  "source_document": "${primaryDoc.filename}"
}
\`\`\`
`;
  }

  if (analysis.warnings.length > 0) {
    prompt += `
### Warnings
${analysis.warnings.map(w => `- ⚠️ ${w}`).join('\n')}
`;
  }

  return prompt;
}

/**
 * Lightweight check to determine if documents need period analysis
 * Call this before full analysis to avoid unnecessary processing
 *
 * @param {Array<Object>} documents - Array of document objects
 * @returns {boolean} True if period analysis would be beneficial
 */
function shouldAnalyzePeriods(documents) {
  if (!Array.isArray(documents)) return false;

  const financialDocs = documents.filter(doc => isFinancialDocument(doc));

  // Worth analyzing if we have 2+ financial documents
  return financialDocs.length >= 2;
}

// Export functions
module.exports = {
  analyzeFinancialPeriods,
  generatePromptSection,
  shouldAnalyzePeriods,
  isFinancialDocument,
  detectPeriodFromFilename,
  detectPeriodFromContent,
  parseMonthYear,
  subtractMonths,
  addMonths,
  calculateMonthsBetween,
  generateMonthList,
  determineOptimalT12
};
