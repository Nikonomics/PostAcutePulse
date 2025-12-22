var DataTypes = require("sequelize").DataTypes;
var _users = require("./users");
var _deals = require("./deals");
var _deal_team_members = require("./deal_team_members");
var _deal_external_advisors = require("./deal_external_advisors");
var _states = require("./state")
var _deal_comments = require("./deal_comments")
var _deal_documents = require("./deal_documents")
var _comment_mentions = require("./comment_mentions")
var _user_notifications = require("./user_notifications")
var _master_deals = require("./master_deals")
var _deal_facilities = require("./deal_facilities")
var _benchmark_configurations = require("./benchmark_configurations")
var _deal_proforma_scenarios = require("./deal_proforma_scenarios")
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

function initModels(sequelize) {
  var users = _users(sequelize, DataTypes);
  var deals = _deals(sequelize, DataTypes);
  var deal_team_members = _deal_team_members(sequelize, DataTypes);
  var deal_external_advisors = _deal_external_advisors(sequelize, DataTypes);
  var states = _states(sequelize, DataTypes)
  var deal_comments = _deal_comments(sequelize, DataTypes)
  var deal_documents = _deal_documents(sequelize, DataTypes)
  var comment_mentions = _comment_mentions(sequelize, DataTypes)
  var user_notifications = _user_notifications(sequelize, DataTypes)
  var master_deals = _master_deals(sequelize, DataTypes)
  var deal_facilities = _deal_facilities(sequelize, DataTypes)
  var benchmark_configurations = _benchmark_configurations(sequelize, DataTypes)
  var deal_proforma_scenarios = _deal_proforma_scenarios(sequelize, DataTypes)
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

  return {
    users,
    deals,
    deal_team_members,
    deal_external_advisors,
    states,
    deal_comments,
    deal_documents,
    comment_mentions,
    user_notifications,
    master_deals,
    deal_facilities,
    benchmark_configurations,
    deal_proforma_scenarios,
    ownership_contacts,
    ownership_comments,
    ownership_comment_mentions,
    ownership_change_logs,
    user_change_logs,
    facility_change_logs,
    facility_comments,
    facility_comment_mentions,
    market_comments,
    market_comment_mentions
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
