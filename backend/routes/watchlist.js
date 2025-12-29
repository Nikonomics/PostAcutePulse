/**
 * Watchlist API Routes
 *
 * Provides endpoints for managing user watchlists and watchlist items.
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();
const WatchlistController = require('../controller/WatchlistController');
const requireAuthentication = require("../passport").authenticateUser;

/**
 * GET /api/v1/watchlist
 * Get all watchlists for the current user
 */
router.get('/', requireAuthentication, WatchlistController.getWatchlists);

/**
 * POST /api/v1/watchlist
 * Create a new watchlist
 * Body: { name: string }
 */
router.post('/', requireAuthentication, WatchlistController.createWatchlist);

/**
 * GET /api/v1/watchlist/:id
 * Get a specific watchlist with all its items
 */
router.get('/:id', requireAuthentication, WatchlistController.getWatchlistDetails);

/**
 * PUT /api/v1/watchlist/:id
 * Update a watchlist (name, is_primary)
 * Body: { name?: string, is_primary?: boolean }
 */
router.put('/:id', requireAuthentication, WatchlistController.updateWatchlist);

/**
 * DELETE /api/v1/watchlist/:id
 * Delete a watchlist and all its items
 */
router.delete('/:id', requireAuthentication, WatchlistController.deleteWatchlist);

/**
 * POST /api/v1/watchlist/:id/items
 * Add a facility to a watchlist
 * Body: { ccn: string, provider_type: 'SNF'|'HHA'|'HOSPICE', notes?: string }
 */
router.post('/:id/items', requireAuthentication, WatchlistController.addItem);

/**
 * DELETE /api/v1/watchlist/items/:itemId
 * Remove an item from a watchlist
 */
router.delete('/items/:itemId', requireAuthentication, WatchlistController.removeItem);

module.exports = router;
