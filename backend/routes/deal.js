var express = require('express');
var DealController = require('../controller/DealController.js');
const requireAuthentication = require("../passport").authenticateUser;
var router = express.Router();

// AI Document Extraction (unified endpoint)
router.post('/extract', requireAuthentication, DealController.extractDealFromDocument);

// Enhanced parallel extraction (new - faster, more comprehensive)
router.post('/extract-enhanced', requireAuthentication, DealController.extractDealEnhanced);

// Re-extract existing deal and store time-series data
router.post('/:dealId/reextract', requireAuthentication, DealController.reExtractDeal);

// Select facility match from ALF database for a deal
router.post('/:dealId/select-facility-match', requireAuthentication, DealController.selectFacilityMatch);

// Get facility matches for a deal (for review modal)
router.get('/:dealId/facility-matches', requireAuthentication, DealController.getFacilityMatches);

router.post('/create-deals', requireAuthentication, DealController.createDeal);
router.get('/get-deals', requireAuthentication, DealController.getDeal);
router.get('/get-deal-stats', requireAuthentication, DealController.getDealStats);
router.get('/get-dashboard-data', requireAuthentication, DealController.getDashboardData);
router.get('/get-deal-facilities-coordinates', requireAuthentication, DealController.getDealFacilitiesCoordinates);
router.get('/get-deal-by-id', DealController.getDealById);
router.put('/update-deal-status', requireAuthentication, DealController.updateDealStatus);
router.put('/:id/extraction-data', requireAuthentication, DealController.updateExtractionData);
router.post('/update-deal', requireAuthentication, DealController.updateDeal);
router.delete('/delete-deal/:id', requireAuthentication, DealController.deleteDeal);
router.post('/bulk-delete-deals', requireAuthentication, DealController.bulkDeleteDeals);
router.post('/add-deal-comment', requireAuthentication, DealController.addDealComment);
router.get('/get-deal-comments', requireAuthentication, DealController.getDealComments);
router.post('/add-deal-document', requireAuthentication, DealController.addDealDocument);
router.delete('/delete-deal-comment/:id', requireAuthentication, DealController.deleteDealComment);
router.get('/get-deal-documents', requireAuthentication, DealController.getDealDocuments);
router.get('/get-user-notifications', requireAuthentication, DealController.getUserNotifications);
router.post('/read-notification', requireAuthentication, DealController.markUserNotificationAsRead);
router.get('/get-deals-by-search', requireAuthentication, DealController.getActiveDeals);

// Deal Activity Tracking
router.get('/get-deals-with-activity', requireAuthentication, DealController.getDealsWithActivity);
router.post('/:dealId/mark-viewed', requireAuthentication, DealController.markDealAsViewed);
router.get('/:dealId/change-history', requireAuthentication, DealController.getDealChangeHistory);

router.get("/master-deals", requireAuthentication, DealController.getMasterDeals)
router.get("/get-master-deal", requireAuthentication, DealController.getParticularMasterDeal)
router.delete("/delete-master-deal/:id", requireAuthentication, DealController.deleteMasterDeal)
router.post("/update-master-deal", requireAuthentication, DealController.updateMasterDeal)

// Deal Calculator
router.get('/calculate/:dealId', requireAuthentication, DealController.calculateDealMetrics);
router.get('/calculate-portfolio/:masterDealId', requireAuthentication, DealController.calculatePortfolioMetrics);

// Deal Facilities CRUD
router.get('/:dealId/facilities', requireAuthentication, DealController.getDealFacilities);
router.post('/:dealId/facilities', requireAuthentication, DealController.createFacility);
router.post('/:dealId/facilities/bulk', requireAuthentication, DealController.createBulkFacilities);
router.put('/:dealId/facilities/reorder', requireAuthentication, DealController.reorderFacilities);
router.get('/facility/:facilityId', requireAuthentication, DealController.getFacilityById);
router.put('/facility/:facilityId', requireAuthentication, DealController.updateFacility);
router.delete('/facility/:facilityId', requireAuthentication, DealController.deleteFacility);

// Benchmark Configurations
router.get('/benchmarks', requireAuthentication, DealController.getBenchmarkConfigs);
router.post('/benchmarks', requireAuthentication, DealController.createBenchmarkConfig);
router.put('/benchmarks/:id', requireAuthentication, DealController.updateBenchmarkConfig);
router.delete('/benchmarks/:id', requireAuthentication, DealController.deleteBenchmarkConfig);
router.post('/benchmarks/:id/set-default', requireAuthentication, DealController.setDefaultBenchmarkConfig);

// Pro Forma Scenarios
// Note: /calculate route must come before /:scenarioId to avoid conflict
router.post('/:dealId/proforma/calculate', requireAuthentication, DealController.calculateProformaPreview);
router.get('/:dealId/proforma', requireAuthentication, DealController.getProformaScenarios);
router.get('/:dealId/proforma/:scenarioId', requireAuthentication, DealController.getProformaScenarioById);
router.post('/:dealId/proforma', requireAuthentication, DealController.createProformaScenario);
router.put('/:dealId/proforma/:scenarioId', requireAuthentication, DealController.updateProformaScenario);
router.delete('/:dealId/proforma/:scenarioId', requireAuthentication, DealController.deleteProformaScenario);

// Extraction History (audit trail)
router.get('/:id/extraction-history', requireAuthentication, DealController.getExtractionHistory);
router.get('/:id/extraction-history/:historyId', requireAuthentication, DealController.getExtractionHistoryDetail);

module.exports = router
