/**
 * Markets API Routes
 *
 * Provides market intelligence endpoints for CBSAs and CMS wage indexes.
 * Enables market-level analysis (metro/micro areas) beyond state-level.
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const getPool = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_news';
  return new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });
};

/**
 * GET /api/markets
 * List all CBSAs with summary stats
 *
 * Query params:
 * - state: Filter to CBSAs in a specific state
 * - type: Filter by 'Metropolitan' or 'Micropolitan'
 * - limit: Maximum results (default: 100)
 */
router.get('/', async (req, res) => {
  const pool = getPool();

  try {
    const { state, type, limit = 100 } = req.query;

    let query = `
      SELECT
        c.cbsa_code,
        c.cbsa_title,
        c.cbsa_type,
        c.csa_code,
        c.csa_title,
        STRING_AGG(DISTINCT cc.state_code, ', ' ORDER BY cc.state_code) as states,
        COUNT(DISTINCT cc.county_fips) as county_count,
        w.wage_index
      FROM cbsas c
      LEFT JOIN county_cbsa_crosswalk cc ON c.cbsa_code = cc.cbsa_code
      LEFT JOIN cms_wage_index w ON c.cbsa_code = w.cbsa_code AND w.is_urban = TRUE
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (state) {
      query += ` AND cc.state_code = $${paramIndex}`;
      params.push(state.toUpperCase());
      paramIndex++;
    }

    if (type) {
      query += ` AND c.cbsa_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += `
      GROUP BY c.cbsa_code, c.cbsa_title, c.cbsa_type, c.csa_code, c.csa_title, w.wage_index
      ORDER BY c.cbsa_title
      LIMIT $${paramIndex}
    `;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows.map(row => ({
        cbsa_code: row.cbsa_code,
        cbsa_title: row.cbsa_title,
        cbsa_type: row.cbsa_type,
        csa_code: row.csa_code,
        csa_title: row.csa_title,
        states: row.states,
        county_count: parseInt(row.county_count),
        wage_index: row.wage_index ? parseFloat(row.wage_index) : null
      }))
    });

  } catch (error) {
    console.error('[Markets API] list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/markets/:cbsaCode
 * Get detailed market info including counties and wage data
 */
router.get('/:cbsaCode', async (req, res) => {
  const pool = getPool();

  try {
    const { cbsaCode } = req.params;

    // Get CBSA details
    const cbsaResult = await pool.query(`
      SELECT
        c.cbsa_code,
        c.cbsa_title,
        c.cbsa_type,
        c.csa_code,
        c.csa_title,
        w.wage_index,
        w.fiscal_year
      FROM cbsas c
      LEFT JOIN cms_wage_index w ON c.cbsa_code = w.cbsa_code AND w.is_urban = TRUE
      WHERE c.cbsa_code = $1
    `, [cbsaCode]);

    if (cbsaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `CBSA not found: ${cbsaCode}`
      });
    }

    const market = cbsaResult.rows[0];

    // Get counties in this CBSA
    const countiesResult = await pool.query(`
      SELECT
        county_fips,
        county_name,
        state_code,
        is_central_county,
        metropolitan_division_code,
        metropolitan_division_title
      FROM county_cbsa_crosswalk
      WHERE cbsa_code = $1
      ORDER BY is_central_county DESC, state_code, county_name
    `, [cbsaCode]);

    res.json({
      success: true,
      market: {
        cbsa_code: market.cbsa_code,
        cbsa_title: market.cbsa_title,
        cbsa_type: market.cbsa_type,
        csa_code: market.csa_code,
        csa_title: market.csa_title,
        wage_index: market.wage_index ? parseFloat(market.wage_index) : null,
        fiscal_year: market.fiscal_year
      },
      counties: countiesResult.rows.map(row => ({
        county_fips: row.county_fips,
        county_name: row.county_name,
        state_code: row.state_code,
        is_central_county: row.is_central_county,
        metropolitan_division_code: row.metropolitan_division_code,
        metropolitan_division_title: row.metropolitan_division_title
      }))
    });

  } catch (error) {
    console.error('[Markets API] get by code error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/markets/state/:stateCode
 * Get all markets (CBSAs) that include counties from a state
 */
router.get('/state/:stateCode', async (req, res) => {
  const pool = getPool();

  try {
    const { stateCode } = req.params;

    const result = await pool.query(`
      SELECT
        c.cbsa_code,
        c.cbsa_title,
        c.cbsa_type,
        COUNT(DISTINCT cc.county_fips) as county_count,
        STRING_AGG(DISTINCT cc.county_name, ', ' ORDER BY cc.county_name) as counties,
        w.wage_index
      FROM cbsas c
      JOIN county_cbsa_crosswalk cc ON c.cbsa_code = cc.cbsa_code
      LEFT JOIN cms_wage_index w ON c.cbsa_code = w.cbsa_code AND w.is_urban = TRUE
      WHERE cc.state_code = $1
      GROUP BY c.cbsa_code, c.cbsa_title, c.cbsa_type, w.wage_index
      ORDER BY c.cbsa_type, c.cbsa_title
    `, [stateCode.toUpperCase()]);

    // Also get rural wage index for this state
    const ruralResult = await pool.query(`
      SELECT wage_index, area_name, fiscal_year
      FROM cms_wage_index
      WHERE state_code = $1 AND is_urban = FALSE
      ORDER BY fiscal_year DESC
      LIMIT 1
    `, [stateCode.toUpperCase()]);

    res.json({
      success: true,
      state_code: stateCode.toUpperCase(),
      rural_wage_index: ruralResult.rows.length > 0 ? {
        wage_index: parseFloat(ruralResult.rows[0].wage_index),
        area_name: ruralResult.rows[0].area_name,
        fiscal_year: ruralResult.rows[0].fiscal_year
      } : null,
      markets: result.rows.map(row => ({
        cbsa_code: row.cbsa_code,
        cbsa_title: row.cbsa_title,
        cbsa_type: row.cbsa_type,
        county_count: parseInt(row.county_count),
        counties: row.counties,
        wage_index: row.wage_index ? parseFloat(row.wage_index) : null
      }))
    });

  } catch (error) {
    console.error('[Markets API] state markets error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/markets/county/:countyFips
 * Get market info for a specific county
 */
router.get('/county/:countyFips', async (req, res) => {
  const pool = getPool();

  try {
    const { countyFips } = req.params;

    const result = await pool.query(`
      SELECT
        cc.county_fips,
        cc.county_name,
        cc.state_code,
        cc.state_fips,
        cc.cbsa_code,
        cc.cbsa_title,
        cc.is_central_county,
        c.cbsa_type,
        w.wage_index as urban_wage_index,
        rw.wage_index as rural_wage_index
      FROM county_cbsa_crosswalk cc
      LEFT JOIN cbsas c ON cc.cbsa_code = c.cbsa_code
      LEFT JOIN cms_wage_index w ON cc.cbsa_code = w.cbsa_code AND w.is_urban = TRUE
      LEFT JOIN cms_wage_index rw ON cc.state_code = rw.state_code AND rw.is_urban = FALSE
      WHERE cc.county_fips = $1
    `, [countyFips]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `County not found: ${countyFips}`
      });
    }

    const row = result.rows[0];

    res.json({
      success: true,
      county: {
        county_fips: row.county_fips,
        county_name: row.county_name,
        state_code: row.state_code,
        cbsa_code: row.cbsa_code,
        cbsa_title: row.cbsa_title,
        cbsa_type: row.cbsa_type,
        is_central_county: row.is_central_county,
        wage_index: row.urban_wage_index ? parseFloat(row.urban_wage_index) : parseFloat(row.rural_wage_index),
        is_urban: !!row.cbsa_code
      }
    });

  } catch (error) {
    console.error('[Markets API] county lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/markets/wage-index/:cbsaCode
 * Get CMS wage index for a specific CBSA
 */
router.get('/wage-index/:cbsaCode', async (req, res) => {
  const pool = getPool();

  try {
    const { cbsaCode } = req.params;

    const result = await pool.query(`
      SELECT
        cbsa_code,
        area_name,
        wage_index,
        fiscal_year
      FROM cms_wage_index
      WHERE cbsa_code = $1 AND is_urban = TRUE
      ORDER BY fiscal_year DESC
      LIMIT 1
    `, [cbsaCode]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Wage index not found for CBSA: ${cbsaCode}`
      });
    }

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        cbsa_code: row.cbsa_code,
        area_name: row.area_name,
        wage_index: parseFloat(row.wage_index),
        fiscal_year: row.fiscal_year,
        is_urban: true
      }
    });

  } catch (error) {
    console.error('[Markets API] wage index lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/markets/wage-index/rural/:stateCode
 * Get rural wage index for a state
 */
router.get('/wage-index/rural/:stateCode', async (req, res) => {
  const pool = getPool();

  try {
    const { stateCode } = req.params;

    const result = await pool.query(`
      SELECT
        state_code,
        area_name,
        wage_index,
        fiscal_year
      FROM cms_wage_index
      WHERE state_code = $1 AND is_urban = FALSE
      ORDER BY fiscal_year DESC
      LIMIT 1
    `, [stateCode.toUpperCase()]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Rural wage index not found for state: ${stateCode}`
      });
    }

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        state_code: row.state_code,
        area_name: row.area_name,
        wage_index: parseFloat(row.wage_index),
        fiscal_year: row.fiscal_year,
        is_urban: false
      }
    });

  } catch (error) {
    console.error('[Markets API] rural wage index error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/markets/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  const pool = getPool();

  try {
    const cbsaCount = await pool.query('SELECT COUNT(*) as count FROM cbsas');
    const countyCount = await pool.query('SELECT COUNT(*) as count FROM county_cbsa_crosswalk');
    const wageCount = await pool.query('SELECT COUNT(*) as count FROM cms_wage_index');

    res.json({
      success: true,
      message: 'Markets service is healthy',
      stats: {
        cbsas: parseInt(cbsaCount.rows[0].count),
        county_mappings: parseInt(countyCount.rows[0].count),
        wage_indexes: parseInt(wageCount.rows[0].count)
      }
    });

  } catch (error) {
    console.error('[Markets API] health error:', error);
    res.status(503).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

module.exports = router;
