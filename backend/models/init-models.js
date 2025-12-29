var DataTypes = require("sequelize").DataTypes;
var _users = require("./users");
var _states = require("./state")
var _comment_mentions = require("./comment_mentions")
var _user_notifications = require("./user_notifications")
var _benchmark_configurations = require("./benchmark_configurations")
var _ownership_contacts = require("./ownership_contacts")
var _ownership_comments = require("./ownership_comments")
var _ownership_comment_mentions = require("./ownership_comment_mentions")
var _ownership_change_logs = require("./ownership_change_logs")
var _user_change_logs = require("./user_change_logs")
var _facility_change_logs = require("./facility_change_logs")
var _facility_comments = require("./facility_comments")
var _facility_comment_mentions = require("./facility_comment_mentions")
var _market_comments = require("./market_comments")
var _market_comment_mentions = require("./market_comment_mentions")
var _watchlists = require("./watchlist")
var _watchlist_items = require("./watchlist_item")

function initModels(sequelize) {
  var users = _users(sequelize, DataTypes);
  var states = _states(sequelize, DataTypes)
  var comment_mentions = _comment_mentions(sequelize, DataTypes)
  var user_notifications = _user_notifications(sequelize, DataTypes)
  var benchmark_configurations = _benchmark_configurations(sequelize, DataTypes)
  var ownership_contacts = _ownership_contacts(sequelize, DataTypes)
  var ownership_comments = _ownership_comments(sequelize, DataTypes)
  var ownership_comment_mentions = _ownership_comment_mentions(sequelize, DataTypes)
  var ownership_change_logs = _ownership_change_logs(sequelize, DataTypes)
  var user_change_logs = _user_change_logs(sequelize, DataTypes)
  var facility_change_logs = _facility_change_logs(sequelize, DataTypes)
  var facility_comments = _facility_comments(sequelize, DataTypes)
  var facility_comment_mentions = _facility_comment_mentions(sequelize, DataTypes)
  var market_comments = _market_comments(sequelize, DataTypes)
  var market_comment_mentions = _market_comment_mentions(sequelize, DataTypes)
  var watchlists = _watchlists(sequelize, DataTypes)
  var watchlist_items = _watchlist_items(sequelize, DataTypes)

  return {
    users,
    states,
    comment_mentions,
    user_notifications,
    benchmark_configurations,
    ownership_contacts,
    ownership_comments,
    ownership_comment_mentions,
    ownership_change_logs,
    user_change_logs,
    facility_change_logs,
    facility_comments,
    facility_comment_mentions,
    market_comments,
    market_comment_mentions,
    watchlists,
    watchlist_items
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
