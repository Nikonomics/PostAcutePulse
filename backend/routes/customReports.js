/**
 * Custom Reports API Routes
 *
 * CRUD operations for saved reports and query execution.
 */

const express = require('express');
const router = express.Router();
const { getMainPool } = require('../config/database');
const {
  executeQuery,
  getFieldsCatalog,
  getAggregationsForType,
  getDateTransforms,
  DATA_SOURCES
} = require('../services/reportQueryEngine');

// ============================================================================
// CATALOG ENDPOINTS (no auth required for reading field definitions)
// ============================================================================

/**
 * GET /api/v1/custom-reports/fields
 * Get available fields catalog for the report builder UI
 */
router.get('/fields', async (req, res) => {
  try {
    const catalog = getFieldsCatalog();
    const aggregations = {
      number: getAggregationsForType('number'),
      string: getAggregationsForType('string'),
      date: getAggregationsForType('date'),
      boolean: getAggregationsForType('boolean')
    };
    const dateTransforms = getDateTransforms();

    res.json({
      success: true,
      data: {
        sources: catalog,
        aggregations,
        dateTransforms,
        operators: ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN']
      }
    });
  } catch (error) {
    console.error('[CustomReports] Fields catalog error:', error);
    res.status(500).json({ success: false, error: 'Failed to load fields catalog' });
  }
});

/**
 * GET /api/v1/custom-reports/sources
 * Get list of available data sources
 */
router.get('/sources', async (req, res) => {
  try {
    const sources = Object.entries(DATA_SOURCES).map(([key, config]) => ({
      key,
      label: config.label,
      description: config.description,
      fieldCount: Object.keys(config.fields).length
    }));

    res.json({ success: true, data: sources });
  } catch (error) {
    console.error('[CustomReports] Sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to load sources' });
  }
});

// ============================================================================
// QUERY EXECUTION
// ============================================================================

/**
 * POST /api/v1/custom-reports/execute
 * Execute a report query and return results
 *
 * Body:
 * {
 *   source: 'facilities' | 'deficiencies' | 'vbp_performance' | 'ownership',
 *   dimensions: [{ field: 'state', transform?: 'year' }],
 *   metrics: [{ field: 'certified_beds', aggregation: 'SUM', alias?: 'total_beds' }],
 *   filters: {
 *     operator: 'AND' | 'OR',
 *     conditions: [{ field: 'state', operator: '=', value: 'CA' }]
 *   },
 *   orderBy: [{ field: 'total_beds', direction: 'DESC' }],
 *   limit: 100
 * }
 */
router.post('/execute', async (req, res) => {
  try {
    const query = req.body;

    // Basic validation
    if (!query.source) {
      return res.status(400).json({ success: false, error: 'source is required' });
    }

    if (!DATA_SOURCES[query.source]) {
      return res.status(400).json({ success: false, error: `Invalid source: ${query.source}` });
    }

    if ((!query.dimensions || query.dimensions.length === 0) &&
        (!query.metrics || query.metrics.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'At least one dimension or metric is required'
      });
    }

    const result = await executeQuery(query);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[CustomReports] Execute error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/custom-reports/preview
 * Execute query with limit of 100 rows for preview
 */
router.post('/preview', async (req, res) => {
  try {
    const query = { ...req.body, limit: 100 };

    if (!query.source) {
      return res.status(400).json({ success: false, error: 'source is required' });
    }

    const result = await executeQuery(query);
    res.json(result);
  } catch (error) {
    console.error('[CustomReports] Preview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SAVED REPORTS CRUD (requires authentication)
// ============================================================================

/**
 * GET /api/v1/custom-reports
 * List user's saved reports
 */
router.get('/', async (req, res) => {
  try {
    // Get user from auth (if authenticated)
    const userId = req.user?.id;

    const pool = getMainPool();

    // Build query based on auth status
    let query, params;
    if (userId) {
      // Authenticated: show user's reports + public reports + templates
      query = `
        SELECT id, name, description, user_id, is_template, is_public, template_category,
               created_at, updated_at
        FROM custom_reports
        WHERE user_id = $1 OR is_public = true OR is_template = true
        ORDER BY
          CASE WHEN user_id = $1 THEN 0 ELSE 1 END,
          updated_at DESC NULLS LAST,
          created_at DESC
      `;
      params = [userId];
    } else {
      // Unauthenticated: show only templates
      query = `
        SELECT id, name, description, user_id, is_template, is_public, template_category,
               created_at, updated_at
        FROM custom_reports
        WHERE is_template = true
        ORDER BY template_category, name
      `;
      params = [];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('[CustomReports] List error:', error);
    res.status(500).json({ success: false, error: 'Failed to load reports' });
  }
});

/**
 * GET /api/v1/custom-reports/templates
 * List system templates
 */
router.get('/templates', async (req, res) => {
  try {
    const pool = getMainPool();
    const { category } = req.query;

    let query = `
      SELECT id, name, description, template_category, configuration,
             created_at, updated_at
      FROM custom_reports
      WHERE is_template = true
    `;
    const params = [];

    if (category) {
      query += ' AND template_category = $1';
      params.push(category);
    }

    query += ' ORDER BY template_category, name';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('[CustomReports] Templates error:', error);
    res.status(500).json({ success: false, error: 'Failed to load templates' });
  }
});

/**
 * GET /api/v1/custom-reports/:id
 * Get a single report by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const pool = getMainPool();

    const result = await pool.query(
      `SELECT * FROM custom_reports WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const report = result.rows[0];

    // Check access: owner, public, or template
    if (report.user_id !== userId && !report.is_public && !report.is_template) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('[CustomReports] Get error:', error);
    res.status(500).json({ success: false, error: 'Failed to load report' });
  }
});

/**
 * POST /api/v1/custom-reports
 * Create a new report
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { name, description, configuration, is_public } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    if (!configuration) {
      return res.status(400).json({ success: false, error: 'configuration is required' });
    }

    const pool = getMainPool();

    const result = await pool.query(
      `INSERT INTO custom_reports (name, description, user_id, configuration, is_public, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [name, description || null, userId, JSON.stringify(configuration), is_public || false]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Report created successfully'
    });
  } catch (error) {
    console.error('[CustomReports] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create report' });
  }
});

/**
 * PUT /api/v1/custom-reports/:id
 * Update an existing report
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const pool = getMainPool();

    // Check ownership
    const existing = await pool.query(
      'SELECT user_id FROM custom_reports WHERE id = $1',
      [id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    if (existing.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this report' });
    }

    const { name, description, configuration, is_public } = req.body;

    const result = await pool.query(
      `UPDATE custom_reports
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           configuration = COALESCE($3, configuration),
           is_public = COALESCE($4, is_public),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        name,
        description,
        configuration ? JSON.stringify(configuration) : null,
        is_public,
        id
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('[CustomReports] Update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update report' });
  }
});

/**
 * DELETE /api/v1/custom-reports/:id
 * Delete a report
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const pool = getMainPool();

    // Check ownership
    const existing = await pool.query(
      'SELECT user_id, is_template FROM custom_reports WHERE id = $1',
      [id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const report = existing.rows[0];

    if (report.is_template) {
      return res.status(403).json({ success: false, error: 'Cannot delete system templates' });
    }

    if (report.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this report' });
    }

    await pool.query('DELETE FROM custom_reports WHERE id = $1', [id]);

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('[CustomReports] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete report' });
  }
});

/**
 * POST /api/v1/custom-reports/:id/duplicate
 * Duplicate a report (creates a copy for the current user)
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const pool = getMainPool();

    // Get original report
    const original = await pool.query(
      'SELECT * FROM custom_reports WHERE id = $1',
      [id]
    );

    if (original.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const report = original.rows[0];

    // Check access
    if (report.user_id !== userId && !report.is_public && !report.is_template) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Create copy
    const newName = req.body.name || `${report.name} (Copy)`;

    const result = await pool.query(
      `INSERT INTO custom_reports (name, description, user_id, configuration, is_public, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())
       RETURNING *`,
      [newName, report.description, userId, report.configuration]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Report duplicated successfully'
    });
  } catch (error) {
    console.error('[CustomReports] Duplicate error:', error);
    res.status(500).json({ success: false, error: 'Failed to duplicate report' });
  }
});

module.exports = router;
