import { fileUpload } from "./authService";

// src/api/apiRoutes.js
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const apiRoutes = {
    login: `${BASE_URL}/auth/login`,
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
    updateDealStatus: `${BASE_URL}/deal/update-deal-status`,
    updateDealPosition: `${BASE_URL}/deal/update-deal-position`,
    deleteDeal: `${BASE_URL}/deal/delete-deal`,
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
};

export default apiRoutes;
