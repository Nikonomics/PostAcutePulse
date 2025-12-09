var express = require('express');
var AuthenticationController = require('../controller/AuthenticationController.js');
const requireAuthentication = require("../passport").authenticateUser;
var router = express.Router();


router.post('/sign-up', AuthenticationController.signUp);
router.post('/login', AuthenticationController.Login);
router.get('/get-my-detail', requireAuthentication, AuthenticationController.getMydetail);
router.post('/create-user', AuthenticationController.createUser);
router.delete('/delete-user/:id', requireAuthentication, AuthenticationController.deleteUser);
router.get('/get-users', AuthenticationController.getUsers);
router.get('/get-user-stats', AuthenticationController.getuserStats);
router.get('/get-active-users', AuthenticationController.getactiveUsers);
router.post('/file-upload', AuthenticationController.fileUpload);
router.get('/user-recent-activity', requireAuthentication, AuthenticationController.getUserRecentActivity);
router.get('/team-recent-activity', requireAuthentication, AuthenticationController.getTeamRecentActivity);

// User approval routes (admin only)
router.get('/pending-users', requireAuthentication, AuthenticationController.getPendingUsers);
router.post('/approve-user/:id', requireAuthentication, AuthenticationController.approveUser);
router.post('/reject-user/:id', requireAuthentication, AuthenticationController.rejectUser);

// Profile management routes
router.put('/update-profile', requireAuthentication, AuthenticationController.updateProfile);
router.put('/change-password', requireAuthentication, AuthenticationController.changePassword);

// Notification routes
router.get('/notifications', requireAuthentication, AuthenticationController.getNotifications);
router.get('/notifications/count', requireAuthentication, AuthenticationController.getNotificationCount);
router.put('/notifications/read', requireAuthentication, AuthenticationController.markNotificationsRead);

module.exports = router
