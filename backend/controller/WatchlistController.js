/**
 * WatchlistController.js
 *
 * Handles watchlist operations for saving and organizing facilities.
 * Users can create multiple watchlists and add facilities by CCN.
 */

const helper = require("../config/helper");
const db = require("../models");

const Watchlist = db.watchlists;
const WatchlistItem = db.watchlist_items;

module.exports = {
  /**
   * Get all watchlists for the current user
   * GET /api/v1/watchlist
   */
  getWatchlists: async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      const watchlists = await Watchlist.findAll({
        where: { user_id: userId },
        include: [{
          model: WatchlistItem,
          as: 'items',
          attributes: ['id', 'ccn', 'provider_type', 'notes', 'created_at']
        }],
        order: [
          ['is_primary', 'DESC'],
          ['created_at', 'DESC']
        ]
      });

      return helper.success(res, "Watchlists fetched successfully", {
        watchlists: watchlists,
        total: watchlists.length
      });

    } catch (err) {
      console.error('[WatchlistController] getWatchlists error:', err);
      return helper.error(res, err.message || "Failed to fetch watchlists");
    }
  },

  /**
   * Create a new watchlist
   * POST /api/v1/watchlist
   * Body: { name: string }
   */
  createWatchlist: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { name } = req.body;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      if (!name || name.trim().length === 0) {
        return helper.error(res, "Watchlist name is required");
      }

      // Check if this is the user's first watchlist (make it primary)
      const existingCount = await Watchlist.count({ where: { user_id: userId } });
      const isPrimary = existingCount === 0;

      const watchlist = await Watchlist.create({
        name: name.trim(),
        user_id: userId,
        is_primary: isPrimary,
        created_at: new Date()
      });

      console.log(`[WatchlistController] Created watchlist "${name}" for user ${userId}`);

      return helper.success(res, "Watchlist created successfully", {
        watchlist: watchlist
      });

    } catch (err) {
      console.error('[WatchlistController] createWatchlist error:', err);
      return helper.error(res, err.message || "Failed to create watchlist");
    }
  },

  /**
   * Get a specific watchlist with all its items
   * GET /api/v1/watchlist/:id
   */
  getWatchlistDetails: async (req, res) => {
    try {
      const userId = req.user?.id;
      const watchlistId = req.params.id;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      const watchlist = await Watchlist.findOne({
        where: {
          id: watchlistId,
          user_id: userId
        },
        include: [{
          model: WatchlistItem,
          as: 'items',
          attributes: ['id', 'ccn', 'provider_type', 'notes', 'created_at', 'updated_at']
        }]
      });

      if (!watchlist) {
        return helper.error(res, "Watchlist not found");
      }

      return helper.success(res, "Watchlist details fetched successfully", {
        watchlist: watchlist
      });

    } catch (err) {
      console.error('[WatchlistController] getWatchlistDetails error:', err);
      return helper.error(res, err.message || "Failed to fetch watchlist details");
    }
  },

  /**
   * Add a facility to a watchlist
   * POST /api/v1/watchlist/:id/items
   * Body: { ccn: string, provider_type: 'SNF'|'HHA'|'HOSPICE', notes?: string }
   */
  addItem: async (req, res) => {
    try {
      const userId = req.user?.id;
      const watchlistId = req.params.id;
      const { ccn, provider_type, notes } = req.body;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      if (!ccn) {
        return helper.error(res, "CCN is required");
      }

      if (!provider_type || !['SNF', 'HHA', 'HOSPICE'].includes(provider_type)) {
        return helper.error(res, "Valid provider_type is required (SNF, HHA, or HOSPICE)");
      }

      // Verify watchlist belongs to user
      const watchlist = await Watchlist.findOne({
        where: {
          id: watchlistId,
          user_id: userId
        }
      });

      if (!watchlist) {
        return helper.error(res, "Watchlist not found");
      }

      // Check if item already exists in this watchlist
      const existingItem = await WatchlistItem.findOne({
        where: {
          watchlist_id: watchlistId,
          ccn: ccn
        }
      });

      if (existingItem) {
        return helper.error(res, "This facility is already in the watchlist");
      }

      const item = await WatchlistItem.create({
        watchlist_id: watchlistId,
        ccn: ccn,
        provider_type: provider_type,
        notes: notes || null,
        created_at: new Date()
      });

      console.log(`[WatchlistController] Added CCN ${ccn} to watchlist ${watchlistId}`);

      return helper.success(res, "Item added to watchlist successfully", {
        item: item
      });

    } catch (err) {
      console.error('[WatchlistController] addItem error:', err);
      return helper.error(res, err.message || "Failed to add item to watchlist");
    }
  },

  /**
   * Remove an item from a watchlist
   * DELETE /api/v1/watchlist/items/:itemId
   */
  removeItem: async (req, res) => {
    try {
      const userId = req.user?.id;
      const itemId = req.params.itemId;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      // Find the item and verify it belongs to a watchlist owned by the user
      const item = await WatchlistItem.findOne({
        where: { id: itemId },
        include: [{
          model: Watchlist,
          as: 'watchlist',
          where: { user_id: userId }
        }]
      });

      if (!item) {
        return helper.error(res, "Item not found or access denied");
      }

      await item.destroy();

      console.log(`[WatchlistController] Removed item ${itemId} from watchlist`);

      return helper.success(res, "Item removed from watchlist successfully", {
        deleted: true,
        itemId: itemId
      });

    } catch (err) {
      console.error('[WatchlistController] removeItem error:', err);
      return helper.error(res, err.message || "Failed to remove item from watchlist");
    }
  },

  /**
   * Delete a watchlist
   * DELETE /api/v1/watchlist/:id
   */
  deleteWatchlist: async (req, res) => {
    try {
      const userId = req.user?.id;
      const watchlistId = req.params.id;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      const watchlist = await Watchlist.findOne({
        where: {
          id: watchlistId,
          user_id: userId
        }
      });

      if (!watchlist) {
        return helper.error(res, "Watchlist not found");
      }

      // Delete all items first (cascade should handle this, but being explicit)
      await WatchlistItem.destroy({
        where: { watchlist_id: watchlistId }
      });

      await watchlist.destroy();

      console.log(`[WatchlistController] Deleted watchlist ${watchlistId}`);

      return helper.success(res, "Watchlist deleted successfully", {
        deleted: true,
        watchlistId: watchlistId
      });

    } catch (err) {
      console.error('[WatchlistController] deleteWatchlist error:', err);
      return helper.error(res, err.message || "Failed to delete watchlist");
    }
  },

  /**
   * Update a watchlist (name, is_primary)
   * PUT /api/v1/watchlist/:id
   * Body: { name?: string, is_primary?: boolean }
   */
  updateWatchlist: async (req, res) => {
    try {
      const userId = req.user?.id;
      const watchlistId = req.params.id;
      const { name, is_primary } = req.body;

      if (!userId) {
        return helper.error(res, "User not authenticated");
      }

      const watchlist = await Watchlist.findOne({
        where: {
          id: watchlistId,
          user_id: userId
        }
      });

      if (!watchlist) {
        return helper.error(res, "Watchlist not found");
      }

      const updateData = { updated_at: new Date() };

      if (name !== undefined) {
        updateData.name = name.trim();
      }

      if (is_primary !== undefined) {
        updateData.is_primary = is_primary;

        // If setting this as primary, unset other watchlists
        if (is_primary) {
          await Watchlist.update(
            { is_primary: false },
            { where: { user_id: userId, id: { [db.Sequelize.Op.ne]: watchlistId } } }
          );
        }
      }

      await watchlist.update(updateData);

      return helper.success(res, "Watchlist updated successfully", {
        watchlist: watchlist
      });

    } catch (err) {
      console.error('[WatchlistController] updateWatchlist error:', err);
      return helper.error(res, err.message || "Failed to update watchlist");
    }
  }
};
