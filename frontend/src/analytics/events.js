import { posthog } from './posthog';

/**
 * Analytics event tracking helpers
 * Use these throughout the app to track key user actions
 */
export const analytics = {
  // ============= Deal Events =============

  /**
   * Track when a new deal is created
   */
  dealCreated: (dealId, dealType, bedCount) =>
    posthog.capture('deal_created', { dealId, dealType, bedCount }),

  /**
   * Track when a deal is viewed
   */
  dealViewed: (dealId, dealName) =>
    posthog.capture('deal_viewed', { dealId, dealName }),

  /**
   * Track when a deal is updated
   */
  dealUpdated: (dealId, fieldsChanged) =>
    posthog.capture('deal_updated', { dealId, fieldsChanged }),

  // ============= Document Extraction Events =============

  /**
   * Track document uploads
   */
  documentUploaded: (dealId, fileType, fileSize) =>
    posthog.capture('document_uploaded', { dealId, fileType, fileSize }),

  /**
   * Track when extraction process starts
   */
  extractionStarted: (dealId, documentCount) =>
    posthog.capture('extraction_started', { dealId, documentCount }),

  /**
   * Track when extraction completes
   */
  extractionCompleted: (dealId, duration, success) =>
    posthog.capture('extraction_completed', { dealId, duration, success }),

  // ============= Facility Research Events =============

  /**
   * Track facility searches
   */
  facilitySearched: (query, resultCount) =>
    posthog.capture('facility_searched', { query, resultCount }),

  /**
   * Track facility profile views
   */
  facilityViewed: (ccn, facilityName) =>
    posthog.capture('facility_viewed', { ccn, facilityName }),

  // ============= M&A Intelligence Events =============

  /**
   * Track when filters are applied in M&A Intelligence
   */
  maFilterApplied: (filterType, filterValue) =>
    posthog.capture('ma_filter_applied', { filterType, filterValue }),

  /**
   * Track state clicks on the M&A map
   */
  maStateClicked: (state, transactions) =>
    posthog.capture('ma_state_clicked', { state, transactions }),

  /**
   * Track operator clicks/selections
   */
  maOperatorClicked: (operator, transactionCount) =>
    posthog.capture('ma_operator_clicked', { operator, transactionCount }),

  /**
   * Track date range changes
   */
  maDateRangeChanged: (startDate, endDate, preset) =>
    posthog.capture('ma_date_range_changed', { startDate, endDate, preset }),

  // ============= Market Analysis Events =============

  /**
   * Track tab views in market analysis
   */
  marketTabViewed: (tabName) =>
    posthog.capture('market_tab_viewed', { tabName }),

  // ============= Ownership Research Events =============

  /**
   * Track ownership profile views
   */
  ownershipViewed: (ownerId, ownerName) =>
    posthog.capture('ownership_viewed', { ownerId, ownerName }),

  /**
   * Track ownership searches
   */
  ownershipSearched: (query, resultCount) =>
    posthog.capture('ownership_searched', { query, resultCount }),

  // ============= General User Actions =============

  /**
   * Track report exports
   */
  reportExported: (reportType, format) =>
    posthog.capture('report_exported', { reportType, format }),

  /**
   * Track generic feature usage
   */
  featureUsed: (featureName, details = {}) =>
    posthog.capture('feature_used', { featureName, ...details }),

  /**
   * Track search actions
   */
  searchPerformed: (searchType, query, resultCount) =>
    posthog.capture('search_performed', { searchType, query, resultCount }),

  /**
   * Track saved item actions
   */
  itemSaved: (itemType, itemId) =>
    posthog.capture('item_saved', { itemType, itemId }),

  itemUnsaved: (itemType, itemId) =>
    posthog.capture('item_unsaved', { itemType, itemId }),
};
