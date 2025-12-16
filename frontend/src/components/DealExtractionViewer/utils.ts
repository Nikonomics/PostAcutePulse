// Utility functions for DealExtractionViewer

import {
  ConfidenceLevel,
  ExtractedField,
  SourceReference,
  normalizeMonthlyTrends,
  LEGACY_TO_CANONICAL
} from './types';

/**
 * Format a number as currency with proper handling of negatives
 */
export const formatCurrency = (value: number | null, showDollarSign: boolean = true): string => {
  if (value === null || value === undefined) return '—';
  const isNegative = value < 0;
  const formatted = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const prefix = showDollarSign ? '$' : '';
  return isNegative ? `(${prefix}${formatted})` : `${prefix}${formatted}`;
};

/**
 * Format a number as a percentage
 */
export const formatPercent = (value: number | null, decimals: number = 1): string => {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format a plain number with commas
 */
export const formatNumber = (value: number | null): string => {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-US');
};

/**
 * Format a multiplier (e.g., 2.5x)
 */
export const formatMultiple = (value: number | null): string => {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(2)}x`;
};

/**
 * Get the background/text color for confidence indicators
 */
export const getConfidenceColor = (confidence: ConfidenceLevel): string => {
  switch (confidence) {
    case 'high':
      return '#22c55e'; // green-500
    case 'medium':
      return '#eab308'; // yellow-500
    case 'low':
      return '#f97316'; // orange-500
    case 'not_found':
      return '#ef4444'; // red-500
    case 'conflict':
      return '#f97316'; // orange-500
    default:
      return '#9ca3af'; // gray-400
  }
};

/**
 * Get Tailwind class for confidence background
 */
export const getConfidenceBgClass = (confidence: ConfidenceLevel): string => {
  switch (confidence) {
    case 'high':
      return 'bg-green-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-orange-500';
    case 'not_found':
      return 'bg-red-500';
    case 'conflict':
      return 'bg-orange-500';
    default:
      return 'bg-gray-400';
  }
};

/**
 * Get human-readable confidence label
 */
export const getConfidenceLabel = (confidence: ConfidenceLevel): string => {
  switch (confidence) {
    case 'high':
      return 'High Confidence';
    case 'medium':
      return 'Medium Confidence';
    case 'low':
      return 'Low Confidence';
    case 'not_found':
      return 'Not Found';
    case 'conflict':
      return 'Conflict Detected';
    default:
      return 'Unknown';
  }
};

/**
 * Get confidence explanation
 */
export const getConfidenceExplanation = (confidence: ConfidenceLevel): string => {
  switch (confidence) {
    case 'high':
      return 'Value was explicitly stated in the document';
    case 'medium':
      return 'Value was calculated from explicit data or strongly inferred';
    case 'low':
      return 'Value was inferred from indirect evidence';
    case 'not_found':
      return 'No data found in the uploaded documents';
    case 'conflict':
      return 'Multiple conflicting values found across documents';
    default:
      return 'Unknown confidence level';
  }
};

/**
 * Format a date string for display
 */
export const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format period range (e.g., "May 2024 - April 2025")
 */
export const formatPeriod = (start: string | null, end: string | null): string => {
  if (!start && !end) return 'Period not specified';
  const startStr = start ? formatDate(start) : '—';
  const endStr = end ? formatDate(end) : '—';
  return `${startStr} - ${endStr}`;
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Count extracted fields in an object
 */
export const countExtractedFields = (
  obj: Record<string, ExtractedField<any> | any>,
  excludeKeys: string[] = []
): { extracted: number; total: number } => {
  let extracted = 0;
  let total = 0;

  const processField = (field: ExtractedField<any>) => {
    total++;
    if (field.value !== null && field.value !== undefined && field.confidence !== 'not_found') {
      extracted++;
    }
  };

  const processObject = (currentObj: Record<string, any>) => {
    for (const [key, value] of Object.entries(currentObj)) {
      if (excludeKeys.includes(key)) continue;

      if (value && typeof value === 'object') {
        if ('confidence' in value && 'value' in value) {
          // This is an ExtractedField
          processField(value as ExtractedField<any>);
        } else if (!Array.isArray(value)) {
          // This is a nested object, recurse
          processObject(value);
        }
      }
    }
  };

  processObject(obj);
  return { extracted, total };
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
};

/**
 * Format a value based on field type
 */
export const formatFieldValue = (
  value: any,
  format: 'currency' | 'percent' | 'number' | 'text' | 'multiple' = 'text'
): string => {
  if (value === null || value === undefined) return '—';

  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'number':
      return formatNumber(value);
    case 'multiple':
      return formatMultiple(value);
    case 'text':
    default:
      return String(value);
  }
};

/**
 * Get section header colors
 */
export const getSectionColors = (): Record<string, { bg: string; text: string }> => ({
  deal_information: { bg: 'bg-blue-800', text: 'text-white' },
  facility_information: { bg: 'bg-blue-800', text: 'text-white' },
  contact_information: { bg: 'bg-blue-800', text: 'text-white' },
  financial_information_t12: { bg: 'bg-green-800', text: 'text-white' },
  census_and_occupancy: { bg: 'bg-green-800', text: 'text-white' },
  rate_information: { bg: 'bg-purple-700', text: 'text-white' },
  pro_forma_projections: { bg: 'bg-purple-700', text: 'text-white' },
  deal_metrics: { bg: 'bg-orange-700', text: 'text-white' },
  data_quality_notes: { bg: 'bg-red-700', text: 'text-white' },
  key_observations: { bg: 'bg-gray-700', text: 'text-white' },
});

/**
 * Parse raw value for comparison display
 */
export const parseRawValue = (rawValue?: string): string => {
  if (!rawValue) return '—';
  return rawValue;
};

/**
 * Determine if a value should be shown in red (negative currency)
 */
export const isNegativeValue = (value: number | null): boolean => {
  return value !== null && value < 0;
};

/**
 * Parse a source string into a structured SourceReference object
 * Handles formats like:
 * - "Trailing_12-Month_P&L.xlsx | Sheet 'Summary', Row 45 | 'Total Revenue: $3,933,015'"
 * - "Census_Report.pdf | Page 2 | 'Average Daily Census: 94'"
 * - "P&L - Room & Board line" (legacy format)
 * - "Calculated | formula | Based on: fields"
 */
export const parseSourceReference = (source: string | undefined): SourceReference | null => {
  if (!source) return null;

  // Check if it's a calculated value
  if (source.toLowerCase().startsWith('calculated')) {
    const parts = source.split('|').map(s => s.trim());
    return {
      document: 'Calculated',
      location: parts[1] || undefined,
      snippet: parts[2] || undefined,
      isCalculated: true,
    };
  }

  // Try to parse the new structured format: "document | location | snippet"
  const pipeMatch = source.match(/^([^|]+)\s*\|\s*([^|]+)(?:\s*\|\s*(.+))?$/);
  if (pipeMatch) {
    return {
      document: pipeMatch[1].trim(),
      location: pipeMatch[2].trim(),
      snippet: pipeMatch[3]?.trim().replace(/^['"]|['"]$/g, ''),  // Remove quotes
      isCalculated: false,
    };
  }

  // Try to parse "Document - Location" format (legacy)
  const dashMatch = source.match(/^([^-]+\.(?:xlsx?|pdf|docx?|csv))\s*-\s*(.+)$/i);
  if (dashMatch) {
    return {
      document: dashMatch[1].trim(),
      location: dashMatch[2].trim(),
      isCalculated: false,
    };
  }

  // Try to extract just the document name if it has a file extension
  const fileMatch = source.match(/([^\s|]+\.(?:xlsx?|pdf|docx?|csv))/i);
  if (fileMatch) {
    const docName = fileMatch[1];
    const rest = source.replace(docName, '').replace(/^\s*[-|]\s*/, '').trim();
    return {
      document: docName,
      location: rest || undefined,
      isCalculated: false,
    };
  }

  // If no file extension found, treat the whole thing as a location description
  // This handles legacy sources like "P&L - Total Revenue line"
  return {
    document: source,
    isCalculated: false,
  };
};

/**
 * Get a short display version of the source for inline display
 */
export const getSourceDisplayText = (sourceRef: SourceReference | null): string => {
  if (!sourceRef) return '';

  if (sourceRef.isCalculated) {
    return 'Calculated';
  }

  // Show document name, truncated if too long
  const doc = sourceRef.document;
  if (doc.length > 25) {
    return doc.substring(0, 22) + '...';
  }
  return doc;
};

/**
 * Check if a source reference is clickable (has a real document)
 */
export const isSourceClickable = (sourceRef: SourceReference | null): boolean => {
  if (!sourceRef) return false;
  if (sourceRef.isCalculated) return false;

  // Accept any source with a document name that:
  // 1. Has a recognizable file extension (xlsx, pdf, docx, csv)
  // 2. OR has a meaningful document name (at least 3 chars, not just generic)
  const doc = sourceRef.document.trim();
  if (/\.(xlsx?|pdf|docx?|csv)$/i.test(doc)) {
    return true;
  }

  // Allow clicking on document references even without extension
  // (AI might output "P&L" or "Census Report" without the file extension)
  // Exclude very short or generic names
  const genericNames = ['file', 'document', 'source', 'data', 'input', 'unknown'];
  const isGeneric = genericNames.includes(doc.toLowerCase());

  return doc.length >= 3 && !isGeneric;
};

/**
 * Convert flattened extraction data back to the nested structure expected by DealExtractionViewer
 * This handles data that was flattened by the backend's flattenExtractedData() function
 *
 * IMPORTANT: This function now uses CANONICAL field names from extraction-schema.ts
 * Legacy field names are supported for backward compatibility but will be mapped to canonical names
 */
export const unflattenExtractedData = (flatData: any): any => {
  if (!flatData) return null;

  // Handle case where extraction_data is a JSON string from API
  if (typeof flatData === 'string') {
    try {
      flatData = JSON.parse(flatData);
    } catch (e) {
      console.error('Failed to parse extraction_data:', e);
      return null;
    }
  }

  // Ensure flatData is an object
  if (typeof flatData !== 'object' || flatData === null) {
    console.error('extraction_data is not an object:', typeof flatData);
    return null;
  }

  // Helper to get value from either canonical or legacy field name
  const getFieldValue = (canonicalKey: string, ...legacyKeys: string[]): any => {
    // Try canonical first
    if (canonicalKey in flatData) {
      return flatData[canonicalKey];
    }
    // Try legacy names
    for (const legacyKey of legacyKeys) {
      if (legacyKey in flatData) {
        return flatData[legacyKey];
      }
    }
    return undefined;
  };

  // Helper to create an ExtractedField from flattened data
  // Supports both canonical and legacy field names
  const createField = <T>(canonicalKey: string, ...legacyKeys: string[]): ExtractedField<T> => {
    const confidenceMap = flatData._confidenceMap || {};
    const sourceMap = flatData._sourceMap || {};

    // Try to get value from canonical or legacy keys
    const value = getFieldValue(canonicalKey, ...legacyKeys);
    const hasKey = canonicalKey in flatData || legacyKeys.some(k => k in flatData);

    // Find the key that was actually used for confidence/source lookup
    let usedKey = canonicalKey;
    if (!(canonicalKey in flatData)) {
      for (const legacyKey of legacyKeys) {
        if (legacyKey in flatData) {
          usedKey = legacyKey;
          break;
        }
      }
    }

    // Check if value is already in ExtractedField format (from backend time-series data)
    if (value && typeof value === 'object' && 'value' in value && ('confidence' in value || 'source' in value)) {
      return value as ExtractedField<T>;
    }

    // Determine confidence: use map if available, otherwise infer from value
    let confidence: ConfidenceLevel;
    if (confidenceMap[usedKey] || confidenceMap[canonicalKey]) {
      confidence = (confidenceMap[usedKey] || confidenceMap[canonicalKey]) as ConfidenceLevel;
    } else if (value !== null && value !== undefined) {
      confidence = 'high';
    } else if (hasKey) {
      confidence = 'not_found';
    } else {
      confidence = 'not_found';
    }

    return {
      value: value !== undefined ? value : null,
      confidence,
      source: sourceMap[usedKey] || sourceMap[canonicalKey] || undefined,
    };
  };

  // Helper to create monthly_trends field with normalization
  const createMonthlyTrendsField = (): ExtractedField<any[]> => {
    const rawTrends = flatData.monthly_trends;
    const confidenceMap = flatData._confidenceMap || {};
    const sourceMap = flatData._sourceMap || {};

    if (!rawTrends) {
      return {
        value: null,
        confidence: 'not_found',
      };
    }

    // Check if already in ExtractedField format
    if (rawTrends && typeof rawTrends === 'object' && 'value' in rawTrends) {
      // Normalize the value array if present
      const normalizedValue = rawTrends.value && Array.isArray(rawTrends.value)
        ? normalizeMonthlyTrends(rawTrends.value)
        : rawTrends.value;
      return {
        ...rawTrends,
        value: normalizedValue,
      };
    }

    // Raw array - normalize field names inside each item
    // This is the KEY FIX for the empty Occupancy Trend chart
    const normalizedTrends = Array.isArray(rawTrends)
      ? normalizeMonthlyTrends(rawTrends)
      : rawTrends;

    return {
      value: normalizedTrends,
      confidence: confidenceMap['monthly_trends'] || 'high',
      source: sourceMap['monthly_trends'] || undefined,
    };
  };

  // Build the nested structure using CANONICAL field names
  return {
    document_types_identified: flatData.document_types_identified || [],
    extraction_timestamp: flatData.extraction_timestamp || new Date().toISOString(),

    deal_information: {
      deal_name: createField<string>('deal_name'),
      deal_type: createField<string>('deal_type'),
      deal_source: createField<string>('deal_source'),
      priority_level: createField<string>('priority_level'),
      purchase_price: createField<number>('purchase_price'),
      price_per_bed: createField<number>('price_per_bed'),
    },

    facility_information: {
      facility_name: createField<string>('facility_name'),
      facility_type: createField<string>('facility_type'),
      street_address: createField<string>('street_address'),
      city: createField<string>('city'),
      state: createField<string>('state'),
      zip_code: createField<string>('zip_code'),
      // CANONICAL: bed_count (legacy: no_of_beds, number_of_beds, total_beds)
      bed_count: createField<number>('bed_count', 'no_of_beds', 'number_of_beds', 'total_beds'),
      unit_mix: createField<Record<string, number>>('unit_mix'),
    },

    contact_information: {
      primary_contact_name: createField<string>('primary_contact_name'),
      // CANONICAL: contact_title (legacy: title)
      title: createField<string>('contact_title', 'title'),
      // CANONICAL: contact_phone (legacy: phone_number)
      phone: createField<string>('contact_phone', 'phone_number'),
      // CANONICAL: contact_email (legacy: email)
      email: createField<string>('contact_email', 'email'),
    },

    financial_information_t12: {
      period: {
        start: flatData.financial_period_start || null,
        end: flatData.financial_period_end || null,
      },
      total_revenue: createField<number>('annual_revenue', 't12m_revenue', 'total_revenue'),
      // Revenue by payer source
      revenue_by_payer: {
        medicaid_revenue: createField<number>('medicaid_revenue'),
        medicare_revenue: createField<number>('medicare_revenue'),
        private_pay_revenue: createField<number>('private_pay_revenue'),
        other_revenue: createField<number>('other_revenue'),
      },
      // Revenue by type
      revenue_breakdown: {
        room_and_board: createField<number>('room_and_board_revenue', 'revenue_room_and_board'),
        care_level_revenue: createField<number>('care_level_revenue', 'revenue_care_level'),
        ancillary_revenue: createField<number>('ancillary_revenue', 'revenue_ancillary'),
        other_income: createField<number>('other_income', 'revenue_other_income'),
      },
      total_expenses: createField<number>('total_expenses'),
      operating_expenses: createField<number>('operating_expenses'),
      // Labor costs (needed for ProForma)
      total_labor_cost: createField<number>('total_labor_cost'),
      agency_labor_cost: createField<number>('agency_labor_cost'),
      ebitdar: createField<number>('ebitdar', 't12m_ebitdar'),
      // CANONICAL: rent_lease_expense (legacy: current_rent_lease_expense)
      rent_lease_expense: createField<number>('rent_lease_expense', 'current_rent_lease_expense'),
      ebitda: createField<number>('ebitda', 't12m_ebitda'),
      depreciation: createField<number>('depreciation'),
      amortization: createField<number>('amortization'),
      interest_expense: createField<number>('interest_expense'),
      property_taxes: createField<number>('property_taxes'),
      property_insurance: createField<number>('property_insurance'),
      ebit: createField<number>('ebit'),
      net_income: createField<number>('net_income'),
    },

    // Year-to-Date Performance
    ytd_performance: {
      period: {
        start: flatData.ytd_period_start || null,
        end: flatData.ytd_period_end || null,
      },
      total_revenue: createField<number>('ytd_revenue'),
      total_expenses: createField<number>('ytd_expenses'),
      net_income: createField<number>('ytd_net_income'),
      average_daily_census: createField<number>('ytd_average_daily_census'),
      medicaid_days: createField<number>('ytd_medicaid_days'),
      private_pay_days: createField<number>('ytd_private_pay_days'),
      total_census_days: createField<number>('ytd_total_census_days'),
    },

    census_and_occupancy: {
      average_daily_census: createField<number>('average_daily_census'),
      // CANONICAL: occupancy_pct (legacy: current_occupancy, occupancy_percentage, occupancy_rate)
      occupancy_pct: createField<number>('occupancy_pct', 'current_occupancy', 'occupancy_percentage', 'occupancy_rate'),
      payer_mix_by_census: {
        // CANONICAL: medicaid_pct (legacy: medicaid_percentage)
        medicaid_pct: createField<number>('medicaid_pct', 'medicaid_percentage'),
        medicare_pct: createField<number>('medicare_pct', 'medicare_percentage'),
        private_pay_pct: createField<number>('private_pay_pct', 'private_pay_percentage'),
      },
      payer_mix_by_revenue: {
        medicaid_pct: createField<number>('medicaid_pct', 'medicaid_percentage'),
        medicare_pct: createField<number>('medicare_pct', 'medicare_percentage'),
        private_pay_pct: createField<number>('private_pay_pct', 'private_pay_percentage'),
      },
      // Monthly trends with normalized field names
      monthly_trends: createMonthlyTrendsField(),
    },

    rate_information: {
      private_pay_rates: createField<any[]>('private_pay_rates'),
      medicaid_rates: createField<any[]>('medicaid_rates'),
      average_daily_rate: createField<number>('average_daily_rate'),
    },

    pro_forma_projections: {
      year_1: {
        // CANONICAL: proforma_year1_revenue (legacy: proforma_year1_annual_revenue)
        revenue: createField<number>('proforma_year1_revenue', 'proforma_year1_annual_revenue'),
        ebitdar: createField<number>('proforma_year1_ebitdar', 'proforma_year1_annual_ebitdar'),
        ebitda: createField<number>('proforma_year1_ebitda', 'proforma_year1_annual_ebitda'),
        ebit: createField<number>('proforma_year1_ebit', 'proforma_year1_annual_ebit'),
        occupancy_pct: createField<number>('proforma_year1_occupancy_pct', 'proforma_year1_average_occupancy'),
      },
      year_2: {
        revenue: createField<number>('proforma_year2_revenue', 'proforma_year2_annual_revenue'),
        ebitdar: createField<number>('proforma_year2_ebitdar', 'proforma_year2_annual_ebitdar'),
        ebitda: createField<number>('proforma_year2_ebitda', 'proforma_year2_annual_ebitda'),
        ebit: createField<number>('proforma_year2_ebit', 'proforma_year2_annual_ebit'),
        occupancy_pct: createField<number>('proforma_year2_occupancy_pct', 'proforma_year2_average_occupancy'),
      },
      year_3: {
        revenue: createField<number>('proforma_year3_revenue', 'proforma_year3_annual_revenue'),
        ebitdar: createField<number>('proforma_year3_ebitdar', 'proforma_year3_annual_ebitdar'),
        ebitda: createField<number>('proforma_year3_ebitda', 'proforma_year3_annual_ebitda'),
        ebit: createField<number>('proforma_year3_ebit', 'proforma_year3_annual_ebit'),
        occupancy_pct: createField<number>('proforma_year3_occupancy_pct', 'proforma_year3_average_occupancy'),
      },
    },

    deal_metrics: {
      revenue_multiple: createField<number>('revenue_multiple'),
      ebitda_multiple: createField<number>('ebitda_multiple'),
      // CANONICAL: cap_rate_pct (legacy: projected_cap_rate_percentage)
      cap_rate: createField<number>('cap_rate_pct', 'projected_cap_rate_percentage'),
      // CANONICAL: target_irr_pct (legacy: target_irr_percentage)
      target_irr: createField<number>('target_irr_pct', 'target_irr_percentage'),
      hold_period_years: createField<number>('hold_period_years', 'target_hold_period'),
    },

    data_quality_notes: flatData.data_quality_notes || [],
    key_observations: flatData.key_observations || [],

    // Stage 1 Deal Overview & Screening Analysis (6th parallel extraction)
    // Pass through as-is since it's already a nested object from the OVERVIEW_PROMPT
    deal_overview: flatData.deal_overview || null,

    // CIM Extraction Data - NOI bridge, value-add thesis, executive summary, etc.
    // Pass through as-is since it's already structured from the CIM extractor
    cim_extraction: flatData.cim_extraction || null,
    has_cim: flatData.has_cim || false,
    cim_files: flatData.cim_files || [],
  };
};

/**
 * Create Excel-compatible data from extraction data
 */
export const prepareExcelExport = (data: any): any[][] => {
  // This will be implemented to create a 2D array for Excel export
  const rows: any[][] = [];

  // Header row
  rows.push(['Field', 'Value', 'Confidence', 'Source']);

  // Helper to add section rows
  const addSection = (title: string, fields: Record<string, ExtractedField<any>>) => {
    rows.push([title, '', '', '']);
    for (const [key, field] of Object.entries(fields)) {
      if (field && typeof field === 'object' && 'value' in field) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        rows.push([
          `  ${label}`,
          field.value ?? '—',
          field.confidence,
          field.source ?? '',
        ]);
      }
    }
  };

  return rows;
};
