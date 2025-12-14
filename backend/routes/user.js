/**
 * User API Routes
 *
 * Provides user-specific endpoints for:
 * - Activity feed (deal updates for associated deals)
 */
const express = require('express');
const router = express.Router();
const requireAuthentication = require("../passport").authenticateUser;
const db = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/v1/user/activity-feed
 * Get activity for all deals the user is associated with
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
 *   - types: comma-separated change types (optional filter)
 *           Valid types: comment_added, document_added, field_update, status_change, team_member_added, team_member_removed
 */
router.get('/activity-feed', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    let { limit = 50, offset = 0, types } = req.query;

    // Parse and validate limit
    limit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    offset = Math.max(parseInt(offset) || 0, 0);

    // Get all deals the user is associated with
    // User can be associated via: deal_team_members, deal_lead, or assistant_deal_lead
    const teamMemberDeals = await db.deal_team_members.findAll({
      where: { user_id: userId },
      attributes: ['deal_id']
    });

    const directLeadDeals = await db.deals.findAll({
      where: {
        [Op.or]: [
          { deal_lead_id: userId },
          { assistant_deal_lead_id: userId }
        ]
      },
      attributes: ['id']
    });

    // Combine all deal IDs
    const dealIds = [
      ...new Set([
        ...teamMemberDeals.map(tm => tm.deal_id),
        ...directLeadDeals.map(d => d.id)
      ])
    ];

    if (dealIds.length === 0) {
      return res.json({
        success: true,
        data: {
          activities: [],
          total: 0,
          hasMore: false
        }
      });
    }

    // Build where clause for change logs
    const whereClause = {
      deal_id: { [Op.in]: dealIds }
    };

    // Filter by change types if specified
    if (types) {
      const typeList = types.split(',').map(t => t.trim()).filter(t => t);
      const validTypes = ['comment_added', 'document_added', 'field_update', 'status_change', 'team_member_added', 'team_member_removed'];
      const filteredTypes = typeList.filter(t => validTypes.includes(t));
      if (filteredTypes.length > 0) {
        whereClause.change_type = { [Op.in]: filteredTypes };
      }
    }

    // Get total count
    const total = await db.deal_change_logs.count({ where: whereClause });

    // Get change logs with pagination
    const changeLogs = await db.deal_change_logs.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // Get deal info for all deals in the results
    const resultDealIds = [...new Set(changeLogs.map(cl => cl.deal_id))];
    const deals = await db.deals.findAll({
      where: { id: { [Op.in]: resultDealIds } },
      attributes: ['id', 'deal_name', 'deal_status']
    });
    const dealMap = {};
    deals.forEach(d => { dealMap[d.id] = d.toJSON(); });

    // Get user info for all users who made changes
    const userIds = [...new Set(changeLogs.map(cl => cl.user_id))];
    const users = await db.users.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['id', 'first_name', 'last_name', 'email', 'profile_url']
    });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.toJSON(); });

    // Format activities
    const activities = changeLogs.map(log => {
      const deal = dealMap[log.deal_id];
      const user = userMap[log.user_id];

      // Build human-readable message
      let message = '';
      const userName = user ? `${user.first_name} ${user.last_name}` : 'Unknown user';

      switch (log.change_type) {
        case 'comment_added':
          message = `${userName} added a comment`;
          break;
        case 'document_added':
          message = `${userName} uploaded a document`;
          break;
        case 'field_update':
          message = `${userName} updated ${log.field_label || log.field_name || 'a field'}`;
          break;
        case 'status_change':
          message = `${userName} changed status from "${log.old_value}" to "${log.new_value}"`;
          break;
        case 'team_member_added':
          message = `${userName} added a team member`;
          break;
        case 'team_member_removed':
          message = `${userName} removed a team member`;
          break;
        default:
          message = `${userName} made a change`;
      }

      // Parse metadata if it exists
      let metadata = null;
      if (log.metadata) {
        try {
          metadata = JSON.parse(log.metadata);
        } catch (e) {
          metadata = { raw: log.metadata };
        }
      }

      return {
        id: log.id,
        deal_id: log.deal_id,
        deal_name: deal ? deal.deal_name : 'Unknown Deal',
        deal_status: deal ? deal.deal_status : null,
        change_type: log.change_type,
        field_name: log.field_name,
        field_label: log.field_label,
        old_value: log.old_value,
        new_value: log.new_value,
        user: user ? {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_url: user.profile_url
        } : null,
        message,
        metadata,
        created_at: log.created_at
      };
    });

    res.json({
      success: true,
      data: {
        activities,
        total,
        hasMore: offset + activities.length < total,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity feed',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/user/associated-deals
 * Get list of deals the user is associated with (for reference)
 */
router.get('/associated-deals', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get team member deals
    const teamMemberDeals = await db.deal_team_members.findAll({
      where: { user_id: userId },
      attributes: ['deal_id']
    });

    // Get direct lead deals
    const directLeadDeals = await db.deals.findAll({
      where: {
        [Op.or]: [
          { deal_lead_id: userId },
          { assistant_deal_lead_id: userId }
        ]
      },
      attributes: ['id', 'deal_name', 'deal_status']
    });

    // Combine and get full deal info
    const dealIds = [
      ...new Set([
        ...teamMemberDeals.map(tm => tm.deal_id),
        ...directLeadDeals.map(d => d.id)
      ])
    ];

    const deals = await db.deals.findAll({
      where: { id: { [Op.in]: dealIds } },
      attributes: ['id', 'deal_name', 'deal_type', 'deal_status', 'facility_name', 'city', 'state'],
      order: [['deal_name', 'ASC']]
    });

    res.json({
      success: true,
      data: deals,
      count: deals.length
    });
  } catch (error) {
    console.error('Error fetching associated deals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch associated deals',
      error: error.message
    });
  }
});

module.exports = router;
