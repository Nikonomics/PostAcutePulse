/**
 * Saved Items API Routes
 *
 * Provides CRUD operations for user's saved/bookmarked items
 * (deals, facilities, and markets)
 */
const express = require('express');
const router = express.Router();
const requireAuthentication = require("../passport").authenticateUser;
const db = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/v1/saved-items
 * Get all saved items for the current user
 * Query params:
 *   - type: 'deal' | 'facility' | 'market' (optional filter)
 */
router.get('/', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;

    const whereClause = { user_id: userId };
    if (type && ['deal', 'facility', 'market', 'ownership_group'].includes(type)) {
      whereClause.item_type = type;
    }

    const savedItems = await db.user_saved_items.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });

    // Group items by type and enrich with related data
    const deals = [];
    const facilities = [];
    const markets = [];
    const ownershipGroups = [];

    for (const item of savedItems) {
      const baseItem = {
        id: item.id,
        note: item.note,
        created_at: item.created_at,
        updated_at: item.updated_at
      };

      if (item.item_type === 'deal' && item.deal_id) {
        // Fetch deal details
        const deal = await db.deals.findByPk(item.deal_id, {
          attributes: ['id', 'deal_name', 'deal_type', 'deal_status', 'facility_name', 'city', 'state', 'purchase_price', 'bed_count']
        });
        deals.push({
          ...baseItem,
          deal_id: item.deal_id,
          deal: deal ? deal.toJSON() : { id: item.deal_id, deleted: true }
        });
      } else if (item.item_type === 'facility') {
        // Facility can be from deal_facilities or market database
        let facilityData = null;

        if (item.deal_facility_id) {
          const dealFacility = await db.deal_facilities.findByPk(item.deal_facility_id, {
            attributes: ['id', 'facility_name', 'facility_type', 'city', 'state', 'bed_count', 'deal_id']
          });
          facilityData = dealFacility ? {
            source: 'deal',
            ...dealFacility.toJSON()
          } : { id: item.deal_facility_id, deleted: true, source: 'deal' };
        } else if (item.market_facility_id && item.market_facility_type) {
          // Market facility - data comes from external market database
          facilityData = {
            source: 'market',
            facility_type: item.market_facility_type,
            facility_id: item.market_facility_id
            // Note: Full facility details would need to be fetched from market database
          };
        }

        facilities.push({
          ...baseItem,
          deal_facility_id: item.deal_facility_id,
          market_facility_type: item.market_facility_type,
          market_facility_id: item.market_facility_id,
          facility: facilityData
        });
      } else if (item.item_type === 'market') {
        markets.push({
          ...baseItem,
          market_state: item.market_state,
          market_county: item.market_county,
          market_cbsa_code: item.market_cbsa_code
        });
      } else if (item.item_type === 'ownership_group') {
        ownershipGroups.push({
          ...baseItem,
          ownership_group_name: item.ownership_group_name
        });
      }
    }

    res.json({
      success: true,
      data: { deals, facilities, markets, ownershipGroups },
      counts: {
        deals: deals.length,
        facilities: facilities.length,
        markets: markets.length,
        ownershipGroups: ownershipGroups.length,
        total: savedItems.length
      }
    });
  } catch (error) {
    console.error('Error fetching saved items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved items',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/saved-items
 * Save a new item
 * Body:
 *   - item_type: 'deal' | 'facility' | 'market' (required)
 *   - deal_id: number (for deals)
 *   - deal_facility_id: number (for deal facilities)
 *   - market_facility_type: 'SNF' | 'ALF' (for market facilities)
 *   - market_facility_id: number (for market facilities)
 *   - market_state: string (for markets)
 *   - market_county: string (for markets)
 *   - market_cbsa_code: string (optional, for markets)
 *   - note: string (optional)
 */
router.post('/', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      item_type,
      deal_id,
      deal_facility_id,
      market_facility_type,
      market_facility_id,
      market_state,
      market_county,
      market_cbsa_code,
      ownership_group_name,
      note
    } = req.body;

    // Validate item_type
    if (!item_type || !['deal', 'facility', 'market', 'ownership_group'].includes(item_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item_type. Must be deal, facility, market, or ownership_group.'
      });
    }

    // Validate required fields based on type
    if (item_type === 'deal' && !deal_id) {
      return res.status(400).json({
        success: false,
        message: 'deal_id is required for deal items'
      });
    }

    if (item_type === 'facility' && !deal_facility_id && !market_facility_id) {
      return res.status(400).json({
        success: false,
        message: 'Either deal_facility_id or market_facility_id is required for facility items'
      });
    }

    if (item_type === 'market' && (!market_state || !market_county)) {
      return res.status(400).json({
        success: false,
        message: 'market_state and market_county are required for market items'
      });
    }

    if (item_type === 'ownership_group' && !ownership_group_name) {
      return res.status(400).json({
        success: false,
        message: 'ownership_group_name is required for ownership group items'
      });
    }

    // Check for duplicates
    let existingItem = null;
    if (item_type === 'deal') {
      existingItem = await db.user_saved_items.findOne({
        where: { user_id: userId, deal_id }
      });
    } else if (item_type === 'facility' && deal_facility_id) {
      existingItem = await db.user_saved_items.findOne({
        where: { user_id: userId, deal_facility_id }
      });
    } else if (item_type === 'facility' && market_facility_id) {
      existingItem = await db.user_saved_items.findOne({
        where: {
          user_id: userId,
          market_facility_type,
          market_facility_id
        }
      });
    } else if (item_type === 'market') {
      existingItem = await db.user_saved_items.findOne({
        where: {
          user_id: userId,
          market_state,
          market_county
        }
      });
    } else if (item_type === 'ownership_group') {
      existingItem = await db.user_saved_items.findOne({
        where: {
          user_id: userId,
          ownership_group_name
        }
      });
    }

    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: 'Item is already saved',
        saved_item_id: existingItem.id
      });
    }

    // Create the saved item
    const savedItem = await db.user_saved_items.create({
      user_id: userId,
      item_type,
      deal_id: item_type === 'deal' ? deal_id : null,
      deal_facility_id: item_type === 'facility' ? deal_facility_id : null,
      market_facility_type: item_type === 'facility' ? market_facility_type : null,
      market_facility_id: item_type === 'facility' ? market_facility_id : null,
      market_state: item_type === 'market' ? market_state : null,
      market_county: item_type === 'market' ? market_county : null,
      market_cbsa_code: item_type === 'market' ? market_cbsa_code : null,
      ownership_group_name: item_type === 'ownership_group' ? ownership_group_name : null,
      note: note || null,
      created_at: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Item saved successfully',
      data: savedItem
    });
  } catch (error) {
    console.error('Error saving item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save item',
      error: error.message
    });
  }
});

/**
 * PUT /api/v1/saved-items/:id
 * Update note on a saved item
 * Body:
 *   - note: string
 */
router.put('/:id', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { note } = req.body;

    const savedItem = await db.user_saved_items.findOne({
      where: { id, user_id: userId }
    });

    if (!savedItem) {
      return res.status(404).json({
        success: false,
        message: 'Saved item not found'
      });
    }

    await savedItem.update({
      note: note || null,
      updated_at: new Date()
    });

    res.json({
      success: true,
      message: 'Note updated successfully',
      data: savedItem
    });
  } catch (error) {
    console.error('Error updating saved item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update saved item',
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/saved-items/:id
 * Remove a saved item
 */
router.delete('/:id', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const savedItem = await db.user_saved_items.findOne({
      where: { id, user_id: userId }
    });

    if (!savedItem) {
      return res.status(404).json({
        success: false,
        message: 'Saved item not found'
      });
    }

    await savedItem.destroy();

    res.json({
      success: true,
      message: 'Item removed from saved items'
    });
  } catch (error) {
    console.error('Error removing saved item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove saved item',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/saved-items/check
 * Bulk check if items are saved
 * Query params:
 *   - type: 'deal' | 'facility' | 'market' (required)
 *   - ids: comma-separated IDs (for deals, deal_facilities)
 *   - markets: JSON array of {state, county} objects (for markets)
 * Returns map of id -> saved_item_id or null
 */
router.get('/check', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, ids, markets } = req.query;

    if (!type || !['deal', 'facility', 'market', 'ownership_group'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type parameter'
      });
    }

    const result = {};

    if (type === 'deal' && ids) {
      const idList = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      const savedItems = await db.user_saved_items.findAll({
        where: {
          user_id: userId,
          item_type: 'deal',
          deal_id: { [Op.in]: idList }
        },
        attributes: ['id', 'deal_id']
      });
      idList.forEach(id => {
        const found = savedItems.find(item => item.deal_id === id);
        result[id] = found ? found.id : null;
      });
    } else if (type === 'facility' && ids) {
      const idList = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      const savedItems = await db.user_saved_items.findAll({
        where: {
          user_id: userId,
          item_type: 'facility',
          deal_facility_id: { [Op.in]: idList }
        },
        attributes: ['id', 'deal_facility_id']
      });
      idList.forEach(id => {
        const found = savedItems.find(item => item.deal_facility_id === id);
        result[id] = found ? found.id : null;
      });
    } else if (type === 'market' && markets) {
      try {
        const marketList = JSON.parse(markets);
        for (const market of marketList) {
          const savedItem = await db.user_saved_items.findOne({
            where: {
              user_id: userId,
              item_type: 'market',
              market_state: market.state,
              market_county: market.county
            },
            attributes: ['id']
          });
          const key = `${market.state}-${market.county}`;
          result[key] = savedItem ? savedItem.id : null;
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid markets parameter - must be valid JSON array'
        });
      }
    } else if (type === 'ownership_group') {
      // Check ownership groups by name - expects names query param as JSON array
      const { names } = req.query;
      if (names) {
        try {
          const nameList = JSON.parse(names);
          for (const name of nameList) {
            const savedItem = await db.user_saved_items.findOne({
              where: {
                user_id: userId,
                item_type: 'ownership_group',
                ownership_group_name: name
              },
              attributes: ['id']
            });
            result[name] = savedItem ? savedItem.id : null;
          }
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Invalid names parameter - must be valid JSON array'
          });
        }
      }
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking saved items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check saved items',
      error: error.message
    });
  }
});

module.exports = router;
