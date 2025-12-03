// Main export file for DealExtractionViewer component

export { default as DealExtractionViewer } from './DealExtractionViewer';
export { default as FieldCell } from './FieldCell';
export { default as Section } from './Section';
export { default as ConfidenceIndicator } from './ConfidenceIndicator';
export { default as PayerMixChart } from './PayerMixChart';
export { default as RatesTable } from './RatesTable';
export { default as ProFormaTable } from './ProFormaTable';

// Export types
export * from './types';

// Export utilities
export * from './utils';

// Export mock data for testing
export { sampleExtractionData, sampleWithProForma, emptyExtractionData } from './mockData';

// Default export
export { default } from './DealExtractionViewer';
