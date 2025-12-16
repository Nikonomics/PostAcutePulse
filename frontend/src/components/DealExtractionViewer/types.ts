// TypeScript interfaces for DealExtractionViewer component
//
// NOTE: Core types are now defined in the canonical schema at:
// src/schemas/extraction-schema.ts
//
// This file re-exports those types and adds component-specific types.

// Import types we need for component-specific interfaces (must be at top)
import type {
  ConfidenceLevel,
  ExtractedField,
  SourceReference,
  RateItem,
  ProFormaYear,
  ExtractedDealData
} from '../../schemas/extraction-schema';

// Re-export canonical types from schema
export type {
  ConfidenceLevel,
  ExtractedField,
  SourceReference,
  MonthlyTrendPoint,
  ProFormaYear,
  RateItem,
  FlatExtractionData,
  ExtractedDealData,
} from '../../schemas/extraction-schema';

// Re-export transformation utilities
export {
  CONFIDENCE_LEVELS,
  LEGACY_TO_CANONICAL,
  MONTHLY_TREND_FIELD_MAPPINGS,
  normalizeToCanonical,
  normalizeMonthlyTrends,
  normalizeMapKeys,
  createExtractedField,
  validateExtractionData,
} from '../../schemas/extraction-schema';

// =============================================================================
// COMPONENT-SPECIFIC TYPES (not part of the canonical schema)
// =============================================================================

export interface DealExtractionViewerProps {
  extractionData: ExtractedDealData | null;
  onFieldEdit?: (fieldPath: string, newValue: any) => void;
  showComparison?: boolean;
  expandedSections?: string[];
  isLoading?: boolean;
  dealDocuments?: DealDocument[];  // List of documents for source citations
  dealId?: number;   // Deal ID for calculator tab
  deal?: any;        // Full deal object for calculator tab
  onDocumentUpload?: (file: File) => Promise<void>;  // Callback for document upload
  isUploading?: boolean;  // Whether a document is currently being uploaded
  onDocumentView?: (doc: DealDocument) => void;  // Callback to view document
  onDocumentDelete?: (docId: number) => void;  // Callback to delete document
  onDocumentDownload?: (docUrl: string) => void;  // Callback to download document
  deleteLoadingId?: number | null;  // ID of document currently being deleted
  onDealStatusChange?: (newStatus: string) => Promise<void>;  // Callback to change deal status
  isFacilityView?: boolean;  // True when viewing a specific facility (changes tab titles)
}

export interface SectionProps {
  id: string;
  title: string;
  headerColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  fieldsExtracted: number;
  totalFields: number;
  children: React.ReactNode;
}

export interface FieldCellProps {
  label: string;
  field: ExtractedField<any>;
  format?: 'currency' | 'percent' | 'number' | 'text';
  showComparison?: boolean;
  onEdit?: (newValue: any) => void;
  fieldPath?: string;
  onSourceClick?: (sourceRef: SourceReference) => void;  // Callback when source is clicked
}

// Props for the document viewer modal
export interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  sourceRef: SourceReference | null;
  dealDocuments: DealDocument[];  // List of documents for this deal
}

// Document info from the deal - matches API response schema
// Supports both API response format (document_name, document_url, type)
// and legacy/alternative formats (name, url, file_type)
export interface DealDocument {
  id: number;
  // Primary API format fields
  document_name?: string;
  document_url?: string;
  type?: string;  // 'pdf', 'excel', 'word', etc.
  size?: string;
  created_at?: string;
  user?: {
    first_name: string;
    last_name: string;
  };
  // Alternative/legacy field names for backward compatibility
  name?: string;
  file_path?: string;
  file_type?: string;
  url?: string;
}

export interface ConfidenceIndicatorProps {
  confidence: ConfidenceLevel;
  calculated?: boolean;
  conflictDetails?: string;
  source?: string;
}

export interface PayerMixChartProps {
  medicaid: ExtractedField<number>;
  medicare: ExtractedField<number>;
  privatePay: ExtractedField<number>;
  title: string;
}

export interface RatesTableProps {
  rates: ExtractedField<RateItem[]>;
  type: 'private_pay' | 'medicaid';
}

export interface ProFormaTableProps {
  projections: {
    year_1: ProFormaYear;
    year_2: ProFormaYear;
    year_3: ProFormaYear;
  };
  showComparison?: boolean;
}

export interface SectionConfig {
  id: string;
  title: string;
  headerColor: string;
}
