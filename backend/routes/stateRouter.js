var express = require("express");
var StateController = require("../controller/stateController");
const requireAuthentication = require("../passport").authenticateUser;
var router = express.Router();

router
  .route("/")
  .post(StateController.createState)
  .get(StateController.getStates)
  .put(StateController.updateState);

router
  .route("/:id")
  .delete(StateController.deleteState)
  .get(StateController.getParticularState);

module.exports = router;
