/**
 * BLS Wage Data API Routes
 *
 * Provides wage data endpoints for healthcare workforce analysis.
 * Data sourced from BLS Occupational Employment and Wage Statistics (OEWS).
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const getPool = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';
  return new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });
};

/**
 * GET /api/wages/state/:stateCode
 * Get wage data for all healthcare occupations in a state
 *
 * Returns wage data with comparison to national average
 */
router.get('/state/:stateCode', async (req, res) => {
  const pool = getPool();

  try {
    const { stateCode } = req.params;
    const { year } = req.query;

    if (!stateCode || stateCode.length !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Valid 2-letter state code is required'
      });
    }

    // Get state data
    const stateResult = await pool.query(`
      SELECT
        occupation_code,
        occupation_title,
        employment,
        hourly_mean_wage,
        hourly_10_pct,
        hourly_25_pct,
        hourly_median,
        hourly_75_pct,
        hourly_90_pct,
        annual_mean_wage,
        data_year
      FROM bls_state_wages
      WHERE state_code = $1
        AND ($2::integer IS NULL OR data_year = $2)
      ORDER BY hourly_mean_wage DESC NULLS LAST
    `, [stateCode.toUpperCase(), year ? parseInt(year) : null]);

    if (stateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No wage data found for state: ${stateCode.toUpperCase()}`
      });
    }

    // Get national averages for comparison
    const nationalResult = await pool.query(`
      SELECT
        occupation_code,
        ROUND(AVG(hourly_mean_wage)::numeric, 2) as national_avg
      FROM bls_state_wages
      WHERE data_year = $1
      GROUP BY occupation_code
    `, [stateResult.rows[0].data_year]);

    const nationalMap = new Map(
      nationalResult.rows.map(r => [r.occupation_code, parseFloat(r.national_avg)])
    );

    // Add national comparison to results
    const data = stateResult.rows.map(row => {
      const nationalAvg = nationalMap.get(row.occupation_code);
      let vsNational = null;

      if (row.hourly_mean_wage && nationalAvg) {
        const diff = ((row.hourly_mean_wage - nationalAvg) / nationalAvg * 100);
        vsNational = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
      }

      return {
        occupation_code: row.occupation_code,
        occupation_title: row.occupation_title,
        employment: row.employment,
        hourly_mean_wage: row.hourly_mean_wage ? parseFloat(row.hourly_mean_wage) : null,
        hourly_10_pct: row.hourly_10_pct ? parseFloat(row.hourly_10_pct) : null,
        hourly_25_pct: row.hourly_25_pct ? parseFloat(row.hourly_25_pct) : null,
        hourly_median: row.hourly_median ? parseFloat(row.hourly_median) : null,
        hourly_75_pct: row.hourly_75_pct ? parseFloat(row.hourly_75_pct) : null,
        hourly_90_pct: row.hourly_90_pct ? parseFloat(row.hourly_90_pct) : null,
        annual_mean_wage: row.annual_mean_wage,
        national_avg: nationalAvg,
        vs_national: vsNational,
        data_year: row.data_year
      };
    });

    res.json({
      success: true,
      state_code: stateCode.toUpperCase(),
      count: data.length,
      data
    });

  } catch (error) {
    console.error('[Wages API] state/:stateCode error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/wages/compare
 * Compare wages across multiple states for one occupation
 *
 * Query params:
 * - states: Comma-separated state codes (e.g., "ID,WA,OR")
 * - occupation: SOC occupation code (e.g., "29-1141")
 * - year: Optional data year
 */
router.get('/compare', async (req, res) => {
  const pool = getPool();

  try {
    const { states, occupation, year } = req.query;

    if (!states || !occupation) {
      return res.status(400).json({
        success: false,
        error: 'Both states (comma-separated) and occupation code are required'
      });
    }

    const stateList = states.split(',').map(s => s.trim().toUpperCase());

    if (stateList.length === 0 || stateList.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Provide 1-10 state codes'
      });
    }

    const result = await pool.query(`
      SELECT
        state_code,
        state_name,
        occupation_code,
        occupation_title,
        employment,
        hourly_mean_wage,
        hourly_10_pct,
        hourly_25_pct,
        hourly_median,
        hourly_75_pct,
        hourly_90_pct,
        annual_mean_wage,
        data_year
      FROM bls_state_wages
      WHERE state_code = ANY($1)
        AND occupation_code = $2
        AND ($3::integer IS NULL OR data_year = $3)
      ORDER BY hourly_mean_wage DESC NULLS LAST
    `, [stateList, occupation, year ? parseInt(year) : null]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No wage data found for occupation ${occupation} in specified states`
      });
    }

    // Get national average
    const nationalResult = await pool.query(`
      SELECT
        ROUND(AVG(hourly_mean_wage)::numeric, 2) as national_avg,
        SUM(employment) as total_employment
      FROM bls_state_wages
      WHERE occupation_code = $1
        AND data_year = $2
    `, [occupation, result.rows[0].data_year]);

    const nationalAvg = parseFloat(nationalResult.rows[0].national_avg);

    const data = result.rows.map(row => ({
      state_code: row.state_code,
      state_name: row.state_name,
      employment: row.employment,
      hourly_mean_wage: row.hourly_mean_wage ? parseFloat(row.hourly_mean_wage) : null,
      hourly_median: row.hourly_median ? parseFloat(row.hourly_median) : null,
      annual_mean_wage: row.annual_mean_wage,
      vs_national: row.hourly_mean_wage
        ? `${((row.hourly_mean_wage - nationalAvg) / nationalAvg * 100) >= 0 ? '+' : ''}${((row.hourly_mean_wage - nationalAvg) / nationalAvg * 100).toFixed(1)}%`
        : null
    }));

    res.json({
      success: true,
      occupation_code: result.rows[0].occupation_code,
      occupation_title: result.rows[0].occupation_title,
      national_avg: nationalAvg,
      data_year: result.rows[0].data_year,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('[Wages API] compare error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/wages/occupations
 * List all available occupations with national averages
 */
router.get('/occupations', async (req, res) => {
  const pool = getPool();

  try {
    const { year } = req.query;

    const result = await pool.query(`
      SELECT
        occupation_code,
        MAX(occupation_title) as occupation_title,
        COUNT(DISTINCT state_code) as state_count,
        ROUND(AVG(hourly_mean_wage)::numeric, 2) as national_avg_wage,
        MIN(hourly_mean_wage) as min_state_wage,
        MAX(hourly_mean_wage) as max_state_wage,
        SUM(employment) as total_employment,
        MAX(data_year) as data_year
      FROM bls_state_wages
      WHERE ($1::integer IS NULL OR data_year = $1)
      GROUP BY occupation_code
      ORDER BY national_avg_wage DESC NULLS LAST
    `, [year ? parseInt(year) : null]);

    const data = result.rows.map(row => ({
      occupation_code: row.occupation_code,
      occupation_title: row.occupation_title,
      state_count: parseInt(row.state_count),
      national_avg_wage: row.national_avg_wage ? parseFloat(row.national_avg_wage) : null,
      wage_range: {
        min: row.min_state_wage ? parseFloat(row.min_state_wage) : null,
        max: row.max_state_wage ? parseFloat(row.max_state_wage) : null
      },
      total_employment: row.total_employment ? parseInt(row.total_employment) : null,
      data_year: row.data_year
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('[Wages API] occupations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/wages/rankings/:occupationCode
 * Get state rankings for a specific occupation
 */
router.get('/rankings/:occupationCode', async (req, res) => {
  const pool = getPool();

  try {
    const { occupationCode } = req.params;
    const { year, limit = 51 } = req.query;

    const result = await pool.query(`
      SELECT
        state_code,
        state_name,
        occupation_title,
        employment,
        hourly_mean_wage,
        hourly_median,
        annual_mean_wage,
        data_year,
        RANK() OVER (ORDER BY hourly_mean_wage DESC NULLS LAST) as rank
      FROM bls_state_wages
      WHERE occupation_code = $1
        AND ($2::integer IS NULL OR data_year = $2)
      ORDER BY hourly_mean_wage DESC NULLS LAST
      LIMIT $3
    `, [occupationCode, year ? parseInt(year) : null, parseInt(limit)]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No wage data found for occupation: ${occupationCode}`
      });
    }

    res.json({
      success: true,
      occupation_code: occupationCode,
      occupation_title: result.rows[0].occupation_title,
      data_year: result.rows[0].data_year,
      count: result.rows.length,
      data: result.rows.map(row => ({
        rank: parseInt(row.rank),
        state_code: row.state_code,
        state_name: row.state_name,
        hourly_mean_wage: row.hourly_mean_wage ? parseFloat(row.hourly_mean_wage) : null,
        hourly_median: row.hourly_median ? parseFloat(row.hourly_median) : null,
        annual_mean_wage: row.annual_mean_wage,
        employment: row.employment
      }))
    });

  } catch (error) {
    console.error('[Wages API] rankings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * GET /api/wages/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  const pool = getPool();

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT state_code) as states,
        COUNT(DISTINCT occupation_code) as occupations,
        MAX(data_year) as latest_year
      FROM bls_state_wages
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      message: 'BLS Wages service is healthy',
      stats: {
        total_records: parseInt(stats.total_records),
        states: parseInt(stats.states),
        occupations: parseInt(stats.occupations),
        latest_year: stats.latest_year
      }
    });

  } catch (error) {
    console.error('[Wages API] health error:', error);
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
