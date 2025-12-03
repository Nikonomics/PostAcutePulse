var express = require('express');
var DealController = require('../controller/DealController.js');
const requireAuthentication = require("../passport").authenticateUser;
var router = express.Router();

// AI Document Extraction (unified endpoint)
router.post('/extract', requireAuthentication, DealController.extractDealFromDocument);

router.post('/create-deals', requireAuthentication, DealController.createDeal);
router.get('/get-deals', requireAuthentication, DealController.getDeal);
router.get('/get-deal-stats', requireAuthentication, DealController.getDealStats);
router.get('/get-dashboard-data', requireAuthentication, DealController.getDashboardData);
router.get('/get-deal-by-id', DealController.getDealById);
router.put('/update-deal-status', requireAuthentication, DealController.updateDealStatus);
router.post('/update-deal', requireAuthentication, DealController.updateDeal);
router.delete('/delete-deal/:id', requireAuthentication, DealController.deleteDeal);
router.post('/add-deal-comment', requireAuthentication, DealController.addDealComment);
router.get('/get-deal-comments', requireAuthentication, DealController.getDealComments);
router.post('/add-deal-document', requireAuthentication, DealController.addDealDocument);
router.delete('/delete-deal-comment/:id', requireAuthentication, DealController.deleteDealComment);
router.get('/get-deal-documents', requireAuthentication, DealController.getDealDocuments);
router.get('/get-user-notifications', requireAuthentication, DealController.getUserNotifications);
router.post('/read-notification', requireAuthentication, DealController.markUserNotificationAsRead);
router.get('/get-deals-by-search', requireAuthentication, DealController.getActiveDeals);
router.get("/master-deals", requireAuthentication, DealController.getMasterDeals)
router.get("/get-master-deal", requireAuthentication, DealController.getParticularMasterDeal)
router.delete("/delete-master-deal/:id", requireAuthentication, DealController.deleteMasterDeal)
router.post("/update-master-deal", requireAuthentication, DealController.updateMasterDeal)

// Deal Calculator
router.get('/calculate/:dealId', requireAuthentication, DealController.calculateDealMetrics);
router.get('/calculate-portfolio/:masterDealId', requireAuthentication, DealController.calculatePortfolioMetrics);

module.exports = router
