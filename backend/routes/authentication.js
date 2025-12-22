var express = require('express');
var AuthenticationController = require('../controller/AuthenticationController.js');
const { authenticateUser: requireAuthentication, requireAdmin } = require("../passport");
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

// Token refresh route (no authentication required - uses refresh token in header)
router.get('/generate-access-token', AuthenticationController.generateAccessToken);

// Invitation routes
router.post('/invite', requireAuthentication, requireAdmin, AuthenticationController.sendInvitation);
router.get('/invite/:token', AuthenticationController.validateInvitation);  // Public - validates token
router.post('/accept-invite', AuthenticationController.acceptInvitation);   // Public - accepts invitation
router.get('/invitations', requireAuthentication, requireAdmin, AuthenticationController.getInvitations);
router.delete('/invite/:id', requireAuthentication, requireAdmin, AuthenticationController.cancelInvitation);
router.post('/invite/:id/resend', requireAuthentication, requireAdmin, AuthenticationController.resendInvitation);

// Role management routes
router.get('/roles', requireAuthentication, AuthenticationController.getRoles);
router.put('/user/:id/role', requireAuthentication, requireAdmin, AuthenticationController.updateUserRole);

module.exports = router
