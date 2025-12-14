import { fileUpload } from "./authService";

// src/api/apiRoutes.js
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const apiRoutes = {
    login: `${BASE_URL}/auth/login`,
    signUp: `${BASE_URL}/auth/sign-up`,
    createDeal: `${BASE_URL}/deal/create-deals`,
    getDeals: `${BASE_URL}/deal/get-deals`,
    getDealStats: `${BASE_URL}/deal/get-deal-stats`,
    createUser: `${BASE_URL}/auth/create-user`,
    getUserById: `${BASE_URL}/auth/get-my-detail`,
    updateUser: `${BASE_URL}/auth/update-user`,
    deleteUser: `${BASE_URL}/auth/delete-user`,
    getRecentActivity: `${BASE_URL}/auth/user-recent-activity`,
    getTeamRecentActivity: `${BASE_URL}/auth/team-recent-activity`,
    getUsers: `${BASE_URL}/auth/get-users`,
    getUserStats: `${BASE_URL}/auth/get-user-stats`,
    getActiveUsers: `${BASE_URL}/auth/get-active-users`,
    fileUpload: `${BASE_URL}/auth/file-upload`,
    getDashboardData: `${BASE_URL}/deal/get-dashboard-data`,
    getDealById: `${BASE_URL}/deal/get-deal-by-id`,
    updateDeal: `${BASE_URL}/deal/update-deal`,
    updateExtractionData: `${BASE_URL}/deal`, // Usage: PUT `${updateExtractionData}/${dealId}/extraction-data`
    updateDealStatus: `${BASE_URL}/deal/update-deal-status`,
    updateDealPosition: `${BASE_URL}/deal/update-deal-position`,
    deleteDeal: `${BASE_URL}/deal/delete-deal`,
    bulkDeleteDeals: `${BASE_URL}/deal/bulk-delete-deals`,
    addDealComment: `${BASE_URL}/deal/add-deal-comment`,
    deleteDealComment: `${BASE_URL}/deal/delete-deal-comment`,
    getDealComments: `${BASE_URL}/deal/get-deal-comments`,
    addDealDocument: `${BASE_URL}/deal/add-deal-document`,
    getDealDocuments: `${BASE_URL}/deal/get-deal-documents`,
    deleteDealDocument: `${BASE_URL}/deal/delete-deal-document`,
    getDealsBySearch: `${BASE_URL}/deal/get-deals-by-search`,
    masterDeals: `${BASE_URL}/deal/master-deals`,
    getMasterDealById: `${BASE_URL}/deal/get-master-deal`,
    updateBatchDeals: `${BASE_URL}/deal/update-master-deal`,
    deleteMasterDeal: `${BASE_URL}/deal/delete-master-deal`,
    getSampleLocations: `${BASE_URL}/deal/get-deal-facilities-coordinates`,
    generateAccessToKen: `${BASE_URL}/auth/generate-access-token`,
    // Profile & User management
    updateProfile: `${BASE_URL}/auth/update-profile`,
    changePassword: `${BASE_URL}/auth/change-password`,
    pendingUsers: `${BASE_URL}/auth/pending-users`,
    approveUser: `${BASE_URL}/auth/approve-user`, // Usage: POST `${approveUser}/${userId}`
    rejectUser: `${BASE_URL}/auth/reject-user`, // Usage: POST `${rejectUser}/${userId}`
    // Notifications
    notifications: `${BASE_URL}/auth/notifications`,
    notificationCount: `${BASE_URL}/auth/notifications/count`,
    markNotificationsRead: `${BASE_URL}/auth/notifications/read`,
    extractDealFromDocument: `${BASE_URL}/deal/extract`,
    extractDealEnhanced: `${BASE_URL}/deal/extract-enhanced`,
    reExtractDeal: `${BASE_URL}/deal`, // Usage: POST `${reExtractDeal}/${dealId}/reextract`
    calculateDealMetrics: `${BASE_URL}/deal/calculate`,
    calculatePortfolioMetrics: `${BASE_URL}/deal/calculate-portfolio`,
    // Deal Facilities
    getDealFacilities: `${BASE_URL}/deal`, // Usage: `${getDealFacilities}/${dealId}/facilities`
    createFacility: `${BASE_URL}/deal`, // Usage: POST `${createFacility}/${dealId}/facilities`
    createBulkFacilities: `${BASE_URL}/deal`, // Usage: POST `${createBulkFacilities}/${dealId}/facilities/bulk`
    reorderFacilities: `${BASE_URL}/deal`, // Usage: PUT `${reorderFacilities}/${dealId}/facilities/reorder`
    getFacilityById: `${BASE_URL}/deal/facility`, // Usage: `${getFacilityById}/${facilityId}`
    updateFacility: `${BASE_URL}/deal/facility`, // Usage: PUT `${updateFacility}/${facilityId}`
    deleteFacility: `${BASE_URL}/deal/facility`, // Usage: DELETE `${deleteFacility}/${facilityId}`
    // Benchmark Configurations
    benchmarks: `${BASE_URL}/deal/benchmarks`, // GET, POST
    benchmarkById: `${BASE_URL}/deal/benchmarks`, // PUT, DELETE: `${benchmarkById}/${id}`
    setDefaultBenchmark: `${BASE_URL}/deal/benchmarks`, // POST: `${setDefaultBenchmark}/${id}/set-default`
    // Pro Forma Scenarios
    proforma: `${BASE_URL}/deal`, // Usage: `${proforma}/${dealId}/proforma`
    proformaCalculate: `${BASE_URL}/deal`, // Usage: POST `${proformaCalculate}/${dealId}/proforma/calculate`
    // Deal Activity Tracking
    getDealsWithActivity: `${BASE_URL}/deal/get-deals-with-activity`,
    markDealViewed: `${BASE_URL}/deal`, // Usage: POST `${markDealViewed}/${dealId}/mark-viewed`
    getDealChangeHistory: `${BASE_URL}/deal`, // Usage: GET `${getDealChangeHistory}/${dealId}/change-history`
    // Multi-Facility Portfolio Support
    detectFacilities: `${BASE_URL}/deal/detect-facilities`, // POST - AI detects facilities from document text
    matchFacility: `${BASE_URL}/deal/match-facility`, // POST - Match facility against SNF/ALF database
    searchFacilities: `${BASE_URL}/deal/search-facilities`, // GET - Manual facility search
    extractPortfolio: `${BASE_URL}/deal/extract-portfolio`, // POST - Extract portfolio with confirmed facilities
    facilityDbStats: `${BASE_URL}/deal/facility-db-stats`, // GET - Database statistics
    extractDocumentText: `${BASE_URL}/deal/extract-text`, // POST - Extract text from documents (no AI)
    // Saved Items
    savedItems: `${BASE_URL}/saved-items`, // GET, POST
    savedItemById: `${BASE_URL}/saved-items`, // Usage: PUT/DELETE `${savedItemById}/${id}`
    checkSavedItems: `${BASE_URL}/saved-items/check`, // GET - check if items are saved
    // User Activity Feed
    userActivityFeed: `${BASE_URL}/user/activity-feed`, // GET - get user's activity feed
    userAssociatedDeals: `${BASE_URL}/user/associated-deals`, // GET - get user's associated deals
    // User Notifications (existing via deal routes)
    getUserNotifications: `${BASE_URL}/deal/get-user-notifications`, // GET
    markNotificationRead: `${BASE_URL}/deal/read-notification`, // POST
};

export default apiRoutes;
