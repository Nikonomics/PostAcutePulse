/**
 * Period Analyzer Service
 *
 * Pre-processes uploaded financial documents to detect time periods and build
 * an optimal T12 (trailing 12 months) analysis using the freshest available data.
 *
 * Problem solved: Users upload multiple financial documents (T12 P&L, YTD P&L,
 * monthly reports) covering different periods. This service analyzes all documents
 * and determines which to use for each month to get the most current data.
 *
 * @module services/periodAnalyzer
 */

// Month name mappings for parsing
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

// Keywords that indicate financial documents
const FINANCIAL_DOCUMENT_KEYWORDS = [
  'p&l', 'p & l', 'profit and loss', 'profit & loss',
  'income statement', 'i&e', 'i & e', 'income and expense',
  'income & expense', 'operating statement', 'financial statement',
  't12', 't-12', 'trailing twelve', 'trailing 12',
  'ytd', 'year to date', 'year-to-date',
  'mtd', 'month to date', 'monthly', 'quarterly',
  'annual', 'revenue', 'expenses', 'ebitda'
];

// Period type patterns
const PERIOD_TYPE_PATTERNS = {
  T12: /t[-]?12|trailing\s*(12|twelve)/i,
  YTD: /ytd|year[\s-]?to[\s-]?date/i,
  MTD: /mtd|month[\s-]?to[\s-]?date/i,
  ANNUAL: /annual|yearly|fy\d{2,4}|fiscal\s*year/i,
  QUARTERLY: /q[1-4]|quarter|qtr/i
};

/**
 * Parses various month/year string formats into a Date object
 *
 * Supported formats:
 * - "Mar 2025", "March 2025"
 * - "2025-03", "2025/03"
 * - "03/2025", "03-2025"
 * - "Mar2025", "March2025"
 * - "2025 Mar", "2025 March"
 *
 * @param {string} str - String containing month and year
 * @returns {Date|null} Date object set to first of month, or null if unparseable
 */
function parseMonthYear(str) {
  if (!str || typeof str !== 'string') return null;

  const cleaned = str.trim().toLowerCase();

  // Try ISO format: 2025-03 or 2025/03
  const isoMatch = cleaned.match(/(\d{4})[-\/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]) - 1; // 0-indexed
    if (month >= 0 && month <= 11 && year >= 2000 && year <= 2100) {
      return new Date(year, month, 1);
    }
  }

  // Try reverse: 03/2025 or 03-2025
  const reverseMatch = cleaned.match(/(\d{1,2})[-\/](\d{4})/);
  if (reverseMatch) {
    const month = parseInt(reverseMatch[1]) - 1;
    const year = parseInt(reverseMatch[2]);
    if (month >= 0 && month <= 11 && year >= 2000 && year <= 2100) {
      return new Date(year, month, 1);
    }
  }

  // Try month name + year: "Mar 2025", "March 2025", "Mar2025"
  const monthNameFirst = cleaned.match(/([a-z]+)\s*(\d{4})/);
  if (monthNameFirst) {
    const monthName = monthNameFirst[1];
    const year = parseInt(monthNameFirst[2]);
    const month = MONTH_NAMES[monthName];
    if (month !== undefined && year >= 2000 && year <= 2100) {
      return new Date(year, month, 1);
    }
  }

  // Try year + month name: "2025 Mar", "2025 March"
  const yearFirst = cleaned.match(/(\d{4})\s*([a-z]+)/);
  if (yearFirst) {
    const year = parseInt(yearFirst[1]);
    const monthName = yearFirst[2];
    const month = MONTH_NAMES[monthName];
    if (month !== undefined && year >= 2000 && year <= 2100) {
      return new Date(year, month, 1);
    }
  }

  return null;
}

/**
 * Detects the period type and date range from a filename
 *
 * Handles patterns like:
 * - "T12_PL_May2024_Apr2025.xlsx"
 * - "YTD_Income_Statement_Mar2025-Sept2025.pdf"
 * - "Monthly_PL_September_2025.xlsx"
 * - "2024_Annual_Report.pdf"
 *
 * @param {string} filename - The document filename
 * @returns {Object} Period info with type, startDate, endDate
 */
function detectPeriodFromFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return { periodType: null, startDate: null, endDate: null, confidence: 'none' };
  }

  const result = {
    periodType: null,
    startDate: null,
    endDate: null,
    confidence: 'low'
  };

  // Detect period type from filename
  for (const [type, pattern] of Object.entries(PERIOD_TYPE_PATTERNS)) {
    if (pattern.test(filename)) {
      result.periodType = type;
      break;
    }
  }

  // Look for date range patterns: "May2024-Apr2025", "Mar2025_Sept2025", "May 2024 - April 2025"
  const rangePatterns = [
    // Month Year - Month Year (various separators)
    /([a-z]+)\s*(\d{4})\s*[-_to]+\s*([a-z]+)\s*(\d{4})/i,
    // Month-Year to Month-Year
    /([a-z]+)[-]?(\d{4})\s*[-_to]+\s*([a-z]+)[-]?(\d{4})/i,
    // Numeric: 2024-05 to 2025-04
    /(\d{4})[-\/](\d{1,2})\s*[-_to]+\s*(\d{4})[-\/](\d{1,2})/i
  ];

  for (const pattern of rangePatterns) {
    const match = filename.match(pattern);
    if (match) {
      // Check if it's month names or numeric
      if (isNaN(parseInt(match[1]))) {
        // Month name format
        const startMonth = MONTH_NAMES[match[1].toLowerCase()];
        const startYear = parseInt(match[2]);
        const endMonth = MONTH_NAMES[match[3].toLowerCase()];
        const endYear = parseInt(match[4]);

        if (startMonth !== undefined && endMonth !== undefined) {
          result.startDate = new Date(startYear, startMonth, 1);
          result.endDate = new Date(endYear, endMonth + 1, 0); // Last day of month
          result.confidence = 'high';
          break;
        }
      } else {
        // Numeric format
        const startYear = parseInt(match[1]);
        const startMonth = parseInt(match[2]) - 1;
        const endYear = parseInt(match[3]);
        const endMonth = parseInt(match[4]) - 1;

        result.startDate = new Date(startYear, startMonth, 1);
        result.endDate = new Date(endYear, endMonth + 1, 0);
        result.confidence = 'high';
        break;
      }
    }
  }

  // If no range found, look for single date (for monthly reports)
  if (!result.startDate) {
    const singleDate = parseMonthYear(filename);
    if (singleDate) {
      result.startDate = singleDate;
      result.endDate = new Date(singleDate.getFullYear(), singleDate.getMonth() + 1, 0);
      result.periodType = result.periodType || 'MTD';
      result.confidence = 'medium';
    }
  }

  // Infer period type if we have dates but no type
  if (result.startDate && result.endDate && !result.periodType) {
    const monthsDiff = getMonthsDifference(result.startDate, result.endDate);
    if (monthsDiff === 12) {
      result.periodType = 'T12';
    } else if (monthsDiff >= 1 && monthsDiff <= 11) {
      result.periodType = 'YTD';
    } else if (monthsDiff === 1) {
      result.periodType = 'MTD';
    } else if (monthsDiff === 3) {
      result.periodType = 'QUARTERLY';
    }
  }

  return result;
}

/**
 * Scans document text content to detect period information
 *
 * Looks for:
 * - Column headers with month/year labels
 * - Date range headers ("For the period ending...", "January 2024 - December 2024")
 * - Fiscal year indicators
 *
 * @param {string} textContent - Extracted text from the document
 * @returns {Object} Period info with type, startDate, endDate, hasMonthlyDetail
 */
function detectPeriodFromContent(textContent) {
  if (!textContent || typeof textContent !== 'string') {
    return { periodType: null, startDate: null, endDate: null, hasMonthlyDetail: false, confidence: 'none' };
  }

  const result = {
    periodType: null,
    startDate: null,
    endDate: null,
    hasMonthlyDetail: false,
    detectedMonths: [],
    confidence: 'low'
  };

  // Normalize whitespace
  const content = textContent.replace(/\s+/g, ' ').toLowerCase();

  // Detect period type from content
  for (const [type, pattern] of Object.entries(PERIOD_TYPE_PATTERNS)) {
    if (pattern.test(content)) {
      result.periodType = type;
      break;
    }
  }

  // Look for "period ending" or "as of" patterns
  const periodEndingPatterns = [
    /(?:period|months?)\s+ending\s+([a-z]+)\s*(\d{1,2})?,?\s*(\d{4})/i,
    /as\s+of\s+([a-z]+)\s*(\d{1,2})?,?\s*(\d{4})/i,
    /through\s+([a-z]+)\s*(\d{1,2})?,?\s*(\d{4})/i,
    /for\s+the\s+(?:twelve|12)\s+months\s+end(?:ing|ed)\s+([a-z]+)\s*(\d{1,2})?,?\s*(\d{4})/i
  ];

  for (const pattern of periodEndingPatterns) {
    const match = content.match(pattern);
    if (match) {
      const monthName = match[1].toLowerCase();
      const year = parseInt(match[3] || match[2]);
      const month = MONTH_NAMES[monthName];

      if (month !== undefined && year >= 2000 && year <= 2100) {
        result.endDate = new Date(year, month + 1, 0); // Last day of month
        result.confidence = 'high';

        // If T12, calculate start date
        if (result.periodType === 'T12' || /twelve|t12|trailing/i.test(content)) {
          result.startDate = new Date(year, month - 11, 1);
          result.periodType = 'T12';
        }
        break;
      }
    }
  }

  // Look for date ranges in content
  const rangePattern = /([a-z]+)\s*(\d{4})\s*[-–—to]+\s*([a-z]+)\s*(\d{4})/gi;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(content)) !== null) {
    const startMonth = MONTH_NAMES[rangeMatch[1].toLowerCase()];
    const startYear = parseInt(rangeMatch[2]);
    const endMonth = MONTH_NAMES[rangeMatch[3].toLowerCase()];
    const endYear = parseInt(rangeMatch[4]);

    if (startMonth !== undefined && endMonth !== undefined) {
      result.startDate = new Date(startYear, startMonth, 1);
      result.endDate = new Date(endYear, endMonth + 1, 0);
      result.confidence = 'high';
      break;
    }
  }

  // Scan for individual month columns (indicates monthly detail)
  const monthColumnPattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*['"]?\d{2,4}/gi;
  const foundMonths = [];
  let monthMatch;

  while ((monthMatch = monthColumnPattern.exec(content)) !== null) {
    const parsed = parseMonthYear(monthMatch[0]);
    if (parsed) {
      foundMonths.push(parsed);
    }
  }

  if (foundMonths.length > 1) {
    result.hasMonthlyDetail = true;
    result.detectedMonths = foundMonths.sort((a, b) => a - b);

    // If we found monthly columns but no date range, derive from columns
    if (!result.startDate && foundMonths.length >= 2) {
      result.startDate = foundMonths[0];
      result.endDate = new Date(
        foundMonths[foundMonths.length - 1].getFullYear(),
        foundMonths[foundMonths.length - 1].getMonth() + 1,
        0
      );
      result.confidence = 'medium';
    }
  }

  // Infer period type from duration if not already set
  if (result.startDate && result.endDate && !result.periodType) {
    const monthsDiff = getMonthsDifference(result.startDate, result.endDate);
    if (monthsDiff >= 11 && monthsDiff <= 13) {
      result.periodType = 'T12';
    } else if (monthsDiff === 3) {
      result.periodType = 'QUARTERLY';
    } else if (monthsDiff === 1) {
      result.periodType = 'MTD';
    } else {
      result.periodType = 'YTD';
    }
  }

  return result;
}

/**
 * Calculate the number of months between two dates
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number} Number of months (inclusive)
 */
function getMonthsDifference(startDate, endDate) {
  return (endDate.getFullYear() - startDate.getFullYear()) * 12
    + (endDate.getMonth() - startDate.getMonth()) + 1;
}

/**
 * Formats a Date object to "YYYY-MM" string
 * @param {Date} date
 * @returns {string}
 */
function formatMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Checks if a document appears to be a financial document based on filename and content
 *
 * @param {Object} doc - Document object with filename and content
 * @returns {boolean}
 */
function isFinancialDocument(doc) {
  const searchText = `${doc.filename || ''} ${doc.content || ''}`.toLowerCase();
  return FINANCIAL_DOCUMENT_KEYWORDS.some(keyword => searchText.includes(keyword));
}

/**
 * Generates a list of all months covered by a date range
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string[]} Array of "YYYY-MM" strings
 */
function getMonthsCovered(startDate, endDate) {
  const months = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    months.push(formatMonthKey(current));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Builds the source map determining which document to use for each month
 * Prioritizes fresher data (later documents preferred for overlapping months)
 *
 * @param {Array} analyzedDocs - Array of analyzed document objects
 * @returns {Object} Source map and analysis
 */
function buildSourceMap(analyzedDocs) {
  // Filter to only docs with valid date ranges
  const validDocs = analyzedDocs.filter(doc => doc.startDate && doc.endDate);

  if (validDocs.length === 0) {
    return {
      sourceMap: {},
      freshestMonth: null,
      allMonthsCovered: [],
      gaps: []
    };
  }

  // Create a map of all months and which docs cover them
  const monthCoverage = new Map();

  for (const doc of validDocs) {
    const months = getMonthsCovered(doc.startDate, doc.endDate);
    for (const month of months) {
      if (!monthCoverage.has(month)) {
        monthCoverage.set(month, []);
      }
      monthCoverage.get(month).push({
        filename: doc.filename,
        endDate: doc.endDate,
        hasMonthlyDetail: doc.hasMonthlyDetail,
        periodType: doc.periodType
      });
    }
  }

  // For each month, select the best source
  // Priority: 1) Fresher end date, 2) Has monthly detail, 3) More specific period type
  const sourceMap = {};
  const overlappingMonths = [];

  for (const [month, sources] of monthCoverage.entries()) {
    if (sources.length > 1) {
      overlappingMonths.push(month);
    }

    // Sort sources by preference
    sources.sort((a, b) => {
      // Prefer fresher end dates
      const dateDiff = b.endDate - a.endDate;
      if (dateDiff !== 0) return dateDiff;

      // Prefer docs with monthly detail
      if (a.hasMonthlyDetail !== b.hasMonthlyDetail) {
        return a.hasMonthlyDetail ? -1 : 1;
      }

      // Prefer more specific period types (MTD > YTD > T12)
      const typeOrder = { MTD: 0, QUARTERLY: 1, YTD: 2, T12: 3, ANNUAL: 4 };
      return (typeOrder[a.periodType] || 5) - (typeOrder[b.periodType] || 5);
    });

    sourceMap[month] = sources[0].filename;
  }

  // Find freshest month
  const allMonths = Array.from(monthCoverage.keys()).sort();
  const freshestMonth = allMonths[allMonths.length - 1];

  return {
    sourceMap,
    freshestMonth,
    allMonthsCovered: allMonths,
    overlappingMonths
  };
}

/**
 * Calculates the recommended T12 period based on available data
 *
 * @param {string} freshestMonth - The most recent month with data ("YYYY-MM")
 * @param {string[]} allMonthsCovered - All months that have data
 * @returns {Object} Recommended T12 start/end and any gaps
 */
function calculateRecommendedT12(freshestMonth, allMonthsCovered) {
  if (!freshestMonth || !allMonthsCovered.length) {
    return {
      start: null,
      end: null,
      complete: false,
      gaps: [],
      monthsAvailable: 0
    };
  }

  // Parse freshest month
  const [endYear, endMonth] = freshestMonth.split('-').map(Number);
  const endDate = new Date(endYear, endMonth - 1, 1);

  // Calculate ideal T12 start (12 months back)
  const startDate = new Date(endYear, endMonth - 12, 1);
  const start = formatMonthKey(startDate);

  // Check which months we have in the T12 range
  const neededMonths = getMonthsCovered(startDate, endDate);
  const availableSet = new Set(allMonthsCovered);

  const gaps = neededMonths.filter(m => !availableSet.has(m));
  const monthsAvailable = neededMonths.filter(m => availableSet.has(m)).length;

  return {
    start: `${start}-01`,
    end: `${freshestMonth}-${new Date(endYear, endMonth, 0).getDate()}`,
    complete: gaps.length === 0,
    gaps,
    monthsAvailable
  };
}

/**
 * Main function: Analyzes an array of documents to determine time periods
 * and build an optimal T12 using the freshest available data.
 *
 * @param {Array<Object>} documents - Array of document objects
 * @param {string} documents[].filename - Document filename
 * @param {string} documents[].content - Extracted text content
 * @param {string} [documents[].fileType] - File type (pdf, xlsx, etc.)
 * @returns {Object} Analysis result with source map and recommendations
 *
 * @example
 * const result = analyzeDocumentPeriods([
 *   { filename: 'T12_PL_May2024_Apr2025.xlsx', content: '...', fileType: 'xlsx' },
 *   { filename: 'YTD_IE_Mar2025_Sept2025.xlsx', content: '...', fileType: 'xlsx' }
 * ]);
 *
 * // Result:
 * // {
 * //   financial_documents: [...],
 * //   freshest_month_available: "2025-09-30",
 * //   recommended_t12: { start: "2024-10-01", end: "2025-09-30", source_map: {...} },
 * //   combination_needed: true,
 * //   overlapping_months: ["2025-03", "2025-04"]
 * // }
 */
function analyzeDocumentPeriods(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return {
      financial_documents: [],
      freshest_month_available: null,
      recommended_t12: null,
      combination_needed: false,
      overlapping_months: [],
      analysis_notes: ['No documents provided for analysis']
    };
  }

  const analysisNotes = [];
  const financialDocuments = [];

  // Analyze each document
  for (const doc of documents) {
    // Check if it's a financial document
    if (!isFinancialDocument(doc)) {
      analysisNotes.push(`Skipped non-financial document: ${doc.filename}`);
      continue;
    }

    // Extract period info from filename and content
    const filenameAnalysis = detectPeriodFromFilename(doc.filename);
    const contentAnalysis = detectPeriodFromContent(doc.content);

    // Merge results, preferring higher confidence
    const merged = {
      filename: doc.filename,
      fileType: doc.fileType || 'unknown',
      periodType: null,
      startDate: null,
      endDate: null,
      hasMonthlyDetail: contentAnalysis.hasMonthlyDetail,
      confidence: 'low'
    };

    // Use filename analysis if it has better confidence
    if (filenameAnalysis.confidence === 'high' ||
        (filenameAnalysis.confidence === 'medium' && contentAnalysis.confidence !== 'high')) {
      merged.startDate = filenameAnalysis.startDate;
      merged.endDate = filenameAnalysis.endDate;
      merged.periodType = filenameAnalysis.periodType;
      merged.confidence = filenameAnalysis.confidence;
    }

    // Override with content analysis if it's better
    if (contentAnalysis.confidence === 'high') {
      merged.startDate = contentAnalysis.startDate || merged.startDate;
      merged.endDate = contentAnalysis.endDate || merged.endDate;
      merged.periodType = contentAnalysis.periodType || merged.periodType;
      merged.confidence = contentAnalysis.confidence;
    }

    // Merge monthly detail from content
    if (contentAnalysis.hasMonthlyDetail) {
      merged.hasMonthlyDetail = true;
    }

    // Calculate months covered if we have dates
    if (merged.startDate && merged.endDate) {
      merged.monthsCovered = getMonthsCovered(merged.startDate, merged.endDate);
    } else {
      analysisNotes.push(`Could not determine date range for: ${doc.filename}`);
      merged.monthsCovered = [];
    }

    financialDocuments.push(merged);
  }

  // Build the source map
  const { sourceMap, freshestMonth, allMonthsCovered, overlappingMonths } = buildSourceMap(financialDocuments);

  // Calculate recommended T12
  const t12Analysis = calculateRecommendedT12(freshestMonth, allMonthsCovered);

  // Build T12 source map (subset of full source map)
  const t12SourceMap = {};
  if (t12Analysis.start && t12Analysis.end) {
    const startDate = new Date(t12Analysis.start);
    const endDate = new Date(t12Analysis.end);
    const t12Months = getMonthsCovered(startDate, endDate);

    for (const month of t12Months) {
      if (sourceMap[month]) {
        t12SourceMap[month] = sourceMap[month];
      }
    }
  }

  // Determine if combination is needed
  const uniqueSources = new Set(Object.values(t12SourceMap));
  const combinationNeeded = uniqueSources.size > 1;

  // Format output
  const result = {
    financial_documents: financialDocuments.map(doc => ({
      filename: doc.filename,
      file_type: doc.fileType,
      period_type: doc.periodType,
      start_date: doc.startDate ? doc.startDate.toISOString().split('T')[0] : null,
      end_date: doc.endDate ? doc.endDate.toISOString().split('T')[0] : null,
      months_covered: doc.monthsCovered.length,
      has_monthly_detail: doc.hasMonthlyDetail,
      confidence: doc.confidence
    })),
    freshest_month_available: freshestMonth ? `${freshestMonth}-${new Date(
      parseInt(freshestMonth.split('-')[0]),
      parseInt(freshestMonth.split('-')[1]),
      0
    ).getDate()}` : null,
    recommended_t12: t12Analysis.start ? {
      start: t12Analysis.start,
      end: t12Analysis.end,
      complete: t12Analysis.complete,
      months_available: t12Analysis.monthsAvailable,
      gaps: t12Analysis.gaps,
      source_map: t12SourceMap
    } : null,
    combination_needed: combinationNeeded,
    overlapping_months: overlappingMonths,
    full_coverage: {
      all_months: allMonthsCovered,
      source_map: sourceMap
    },
    analysis_notes: analysisNotes
  };

  return result;
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

module.exports = {
  analyzeDocumentPeriods,
  shouldAnalyzePeriods,
  // Export helpers for testing and potential reuse
  detectPeriodFromFilename,
  detectPeriodFromContent,
  parseMonthYear,
  buildSourceMap,
  isFinancialDocument,
  getMonthsCovered,
  formatMonthKey
};
