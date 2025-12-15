const express = require('express');
const router = express.Router();
const { getSequelizeInstance } = require('../config/database');

// Helper to run queries
const runQuery = async (sql, params = []) => {
  const sequelize = getSequelizeInstance();
  try {
    const [results] = await sequelize.query(sql, { replacements: params });
    return results;
  } finally {
    await sequelize.close();
  }
};

const runQuerySingle = async (sql, params = []) => {
  const results = await runQuery(sql, params);
  return results[0] || null;
};

// ============================================
// FACILITIES
// ============================================

// GET /api/facilities - Get all facilities
router.get('/facilities', async (req, res) => {
  try {
    const facilities = await runQuery(`
      SELECT id, facility_id, facility_group, name, short_name, legal_name, line, city, state, address
      FROM facilities
      WHERE status = 1
      ORDER BY name
    `);

    res.json({
      success: true,
      body: {
        data: facilities,
        total: facilities.length
      }
    });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// FUNCTIONAL CATEGORIES
// ============================================

// GET /api/functional-categories - Get all functional categories
router.get('/functional-categories', async (req, res) => {
  try {
    const categories = await runQuery(`
      SELECT id, name, description, example_subcategories, sort_order
      FROM functional_categories
      WHERE status = 1
      ORDER BY sort_order, name
    `);

    res.json({
      success: true,
      body: {
        data: categories,
        total: categories.length
      }
    });
  } catch (error) {
    console.error('Error fetching functional categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SERVICE SUBCATEGORIES
// ============================================

// GET /api/service-subcategories - Get all service subcategories
router.get('/service-subcategories', async (req, res) => {
  try {
    const { category_id } = req.query;

    let sql = `
      SELECT s.id, s.name, s.department, s.sort_order, s.functional_category_id,
             f.name as category_name
      FROM service_subcategories s
      LEFT JOIN functional_categories f ON s.functional_category_id = f.id
      WHERE s.status = 1
    `;
    const params = [];

    if (category_id) {
      sql += ' AND s.functional_category_id = ?';
      params.push(category_id);
    }

    sql += ' ORDER BY f.sort_order, s.sort_order, s.name';

    const subcategories = await runQuery(sql, params);

    res.json({
      success: true,
      body: {
        data: subcategories,
        total: subcategories.length
      }
    });
  } catch (error) {
    console.error('Error fetching service subcategories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCUMENT TYPES (Contract Types)
// ============================================

// GET /api/contract-types - Get all document/contract types
router.get('/contract-types', async (req, res) => {
  try {
    const types = await runQuery(`
      SELECT id, name, primary_category, description, sort_order
      FROM document_types
      WHERE status = 1
      ORDER BY sort_order, name
    `);

    res.json({
      success: true,
      body: {
        data: types,
        total: types.length
      }
    });
  } catch (error) {
    console.error('Error fetching contract types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/document-types - Alias for contract-types
router.get('/document-types', async (req, res) => {
  try {
    const types = await runQuery(`
      SELECT id, name, primary_category, description, sort_order
      FROM document_types
      WHERE status = 1
      ORDER BY sort_order, name
    `);

    res.json({
      success: true,
      body: {
        data: types,
        total: types.length
      }
    });
  } catch (error) {
    console.error('Error fetching document types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DOCUMENT TAGS
// ============================================

// GET /api/document-tags - Get all document tags
router.get('/document-tags', async (req, res) => {
  try {
    const { group } = req.query;

    let sql = `
      SELECT id, name, tag_group, description
      FROM document_tags
      WHERE status = 1
    `;
    const params = [];

    if (group) {
      sql += ' AND tag_group = ?';
      params.push(group);
    }

    sql += ' ORDER BY tag_group, name';

    const tags = await runQuery(sql, params);

    // Group by tag_group for easier frontend use
    const grouped = tags.reduce((acc, tag) => {
      const group = tag.tag_group || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(tag);
      return acc;
    }, {});

    res.json({
      success: true,
      body: {
        data: tags,
        grouped: grouped,
        total: tags.length
      }
    });
  } catch (error) {
    console.error('Error fetching document tags:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/document-types/:id/tags - Get tags for a specific document type
router.get('/document-types/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;

    const tags = await runQuery(`
      SELECT t.id, t.name, t.tag_group, t.description
      FROM document_tags t
      JOIN document_type_tag_assignments a ON t.id = a.tag_id
      WHERE a.document_type_id = ? AND t.status = 1
      ORDER BY t.tag_group, t.name
    `, [id]);

    res.json({
      success: true,
      body: {
        data: tags,
        total: tags.length
      }
    });
  } catch (error) {
    console.error('Error fetching document type tags:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDORS
// ============================================

// GET /api/vendors - Get all vendors with search/filter
router.get('/vendors', async (req, res) => {
  try {
    const { search, type, page = 1, perPage = 50 } = req.query;
    const offset = (page - 1) * perPage;

    let countSql = 'SELECT COUNT(*) as total FROM vendors WHERE status = 1';
    let sql = `
      SELECT id, vendor_id, raw_name, canonical_name, vendor_type, cleaned_type, notes
      FROM vendors
      WHERE status = 1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const searchCondition = ' AND (canonical_name LIKE ? OR raw_name LIKE ?)';
      sql += searchCondition;
      countSql += searchCondition;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (type) {
      const typeCondition = ' AND cleaned_type = ?';
      sql += typeCondition;
      countSql += typeCondition;
      params.push(type);
      countParams.push(type);
    }

    sql += ' ORDER BY canonical_name LIMIT ? OFFSET ?';
    params.push(parseInt(perPage), parseInt(offset));

    const [vendors, countResult] = await Promise.all([
      runQuery(sql, params),
      runQuery(countSql, countParams)
    ]);

    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      body: {
        data: vendors,
        total: total,
        page: parseInt(page),
        perPage: parseInt(perPage),
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/vendors/types - Get unique vendor types
router.get('/vendors/types', async (req, res) => {
  try {
    const types = await runQuery(`
      SELECT DISTINCT cleaned_type as type, COUNT(*) as count
      FROM vendors
      WHERE status = 1 AND cleaned_type IS NOT NULL AND cleaned_type != ''
      GROUP BY cleaned_type
      ORDER BY cleaned_type
    `);

    res.json({
      success: true,
      body: {
        data: types,
        total: types.length
      }
    });
  } catch (error) {
    console.error('Error fetching vendor types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/vendors/search/:query - Quick search for autocomplete
router.get('/vendors/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    const vendors = await runQuery(`
      SELECT id, vendor_id, canonical_name, cleaned_type
      FROM vendors
      WHERE status = 1 AND canonical_name LIKE ?
      ORDER BY canonical_name
      LIMIT 20
    `, [`%${query}%`]);

    res.json({
      success: true,
      body: {
        data: vendors,
        total: vendors.length
      }
    });
  } catch (error) {
    console.error('Error searching vendors:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TAXONOMY SUMMARY
// ============================================

// GET /api/taxonomy/summary - Get counts for all taxonomy tables
router.get('/taxonomy/summary', async (req, res) => {
  try {
    const [facilities, categories, subcategories, docTypes, tags, vendors] = await Promise.all([
      runQuery('SELECT COUNT(*) as count FROM facilities WHERE status = 1'),
      runQuery('SELECT COUNT(*) as count FROM functional_categories WHERE status = 1'),
      runQuery('SELECT COUNT(*) as count FROM service_subcategories WHERE status = 1'),
      runQuery('SELECT COUNT(*) as count FROM document_types WHERE status = 1'),
      runQuery('SELECT COUNT(*) as count FROM document_tags WHERE status = 1'),
      runQuery('SELECT COUNT(*) as count FROM vendors WHERE status = 1'),
    ]);

    res.json({
      success: true,
      body: {
        facilities: facilities[0].count,
        functional_categories: categories[0].count,
        service_subcategories: subcategories[0].count,
        document_types: docTypes[0].count,
        document_tags: tags[0].count,
        vendors: vendors[0].count,
      }
    });
  } catch (error) {
    console.error('Error fetching taxonomy summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
