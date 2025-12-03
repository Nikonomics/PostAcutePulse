var express = require('express');
var AuthenticationController = require('../controller/AuthenticationController.js');
const requireAuthentication = require("../passport").authenticateUser;
var router = express.Router();


router.post('/sign-up', AuthenticationController.signUp);
router.post('/login', AuthenticationController.Login);
router.get('/get-my-detail', requireAuthentication,AuthenticationController.getMydetail);
router.post('/create-user', AuthenticationController.createUser);
router.delete('/delete-user/:id', requireAuthentication, AuthenticationController.deleteUser);
router.get('/get-users', AuthenticationController.getUsers);
router.get('/get-user-stats', AuthenticationController.getuserStats);
router.get('/get-active-users', AuthenticationController.getactiveUsers);
router.post('/file-upload', AuthenticationController.fileUpload);
router.get('/user-recent-activity', requireAuthentication, AuthenticationController.getUserRecentActivity);
router.get('/team-recent-activity', requireAuthentication, AuthenticationController.getTeamRecentActivity);
module.exports = router
