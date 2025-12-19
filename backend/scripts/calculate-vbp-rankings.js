#!/usr/bin/env node

/**
 * Calculate VBP Rankings
 *
 * Calculates and stores VBP rankings at 4 levels:
 * - National: All facilities in the US
 * - State: Facilities in the same state
 * - Market: Facilities in the same county
 * - Chain: Facilities under the same parent_organization
 *
 * Rankings are based on incentive_payment_multiplier (higher is better).
 * Percentile = (total - rank + 1) / total * 100
 *
 * Usage:
 *   node scripts/calculate-vbp-rankings.js              # Calculate all fiscal years
 *   node scripts/calculate-vbp-rankings.js --year 2024  # Calculate specific year
 */

const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/snf_platform';

async function calculateRankings(fiscalYear = null) {
  const sequelize = new Sequelize(connectionString, {
    logging: false,
    dialectOptions: connectionString.includes('render.com') ? { ssl: { rejectUnauthorized: false } } : {}
  });

  try {
    console.log('VBP Rankings Calculator');
    console.log('========================\n');

    // Get available fiscal years
    const [years] = await sequelize.query(`
      SELECT DISTINCT fiscal_year
      FROM vbp_scores
      WHERE incentive_payment_multiplier IS NOT NULL
      ORDER BY fiscal_year DESC
    `);

    const targetYears = fiscalYear
      ? years.filter(y => y.fiscal_year === parseInt(fiscalYear))
      : years;

    if (targetYears.length === 0) {
      console.log('No VBP data found for the specified year(s)');
      return;
    }

    console.log(`Processing ${targetYears.length} fiscal year(s): ${targetYears.map(y => y.fiscal_year).join(', ')}\n`);

    let totalInserted = 0;

    for (const { fiscal_year } of targetYears) {
      console.log(`\nCalculating rankings for FY ${fiscal_year}...`);

      // Use a single CTE query to calculate all rankings efficiently
      const rankingsQuery = `
        WITH facility_vbp AS (
          -- Join VBP scores with facility data for grouping columns
          SELECT
            v.ccn AS federal_provider_number,
            v.fiscal_year,
            v.incentive_payment_multiplier,
            f.state,
            f.county,
            f.parent_organization
          FROM vbp_scores v
          LEFT JOIN snf_facilities f ON v.ccn = f.federal_provider_number
          WHERE v.fiscal_year = :fiscal_year
            AND v.incentive_payment_multiplier IS NOT NULL
        ),
        national_rankings AS (
          -- National rankings (all facilities)
          SELECT
            federal_provider_number,
            fiscal_year,
            RANK() OVER (ORDER BY incentive_payment_multiplier DESC) AS national_rank,
            COUNT(*) OVER () AS national_total
          FROM facility_vbp
        ),
        state_rankings AS (
          -- State rankings (by state)
          SELECT
            federal_provider_number,
            fiscal_year,
            RANK() OVER (PARTITION BY state ORDER BY incentive_payment_multiplier DESC) AS state_rank,
            COUNT(*) OVER (PARTITION BY state) AS state_total
          FROM facility_vbp
          WHERE state IS NOT NULL
        ),
        market_rankings AS (
          -- Market rankings (by county)
          SELECT
            federal_provider_number,
            fiscal_year,
            RANK() OVER (PARTITION BY state, county ORDER BY incentive_payment_multiplier DESC) AS market_rank,
            COUNT(*) OVER (PARTITION BY state, county) AS market_total
          FROM facility_vbp
          WHERE county IS NOT NULL
        ),
        chain_rankings AS (
          -- Chain rankings (by parent_organization)
          SELECT
            federal_provider_number,
            fiscal_year,
            RANK() OVER (PARTITION BY parent_organization ORDER BY incentive_payment_multiplier DESC) AS chain_rank,
            COUNT(*) OVER (PARTITION BY parent_organization) AS chain_total
          FROM facility_vbp
          WHERE parent_organization IS NOT NULL AND parent_organization != ''
        )
        SELECT
          n.federal_provider_number,
          n.fiscal_year,
          -- National
          n.national_rank,
          n.national_total,
          ROUND(((n.national_total - n.national_rank + 1)::numeric / n.national_total * 100), 2) AS national_percentile,
          -- State
          s.state_rank,
          s.state_total,
          CASE WHEN s.state_total > 0
            THEN ROUND(((s.state_total - s.state_rank + 1)::numeric / s.state_total * 100), 2)
            ELSE NULL
          END AS state_percentile,
          -- Market
          m.market_rank,
          m.market_total,
          CASE WHEN m.market_total > 0
            THEN ROUND(((m.market_total - m.market_rank + 1)::numeric / m.market_total * 100), 2)
            ELSE NULL
          END AS market_percentile,
          -- Chain
          c.chain_rank,
          c.chain_total,
          CASE WHEN c.chain_total > 0
            THEN ROUND(((c.chain_total - c.chain_rank + 1)::numeric / c.chain_total * 100), 2)
            ELSE NULL
          END AS chain_percentile
        FROM national_rankings n
        LEFT JOIN state_rankings s ON n.federal_provider_number = s.federal_provider_number
        LEFT JOIN market_rankings m ON n.federal_provider_number = m.federal_provider_number
        LEFT JOIN chain_rankings c ON n.federal_provider_number = c.federal_provider_number
      `;

      const [rankings] = await sequelize.query(rankingsQuery, {
        replacements: { fiscal_year }
      });

      console.log(`  Found ${rankings.length.toLocaleString()} facilities with VBP scores`);

      if (rankings.length === 0) continue;

      // Delete existing rankings for this fiscal year
      await sequelize.query(
        'DELETE FROM facility_vbp_rankings WHERE fiscal_year = :fiscal_year',
        { replacements: { fiscal_year } }
      );

      // Batch insert rankings
      const batchSize = 1000;
      let inserted = 0;

      for (let i = 0; i < rankings.length; i += batchSize) {
        const batch = rankings.slice(i, i + batchSize);

        const values = batch.map(r => `(
          '${r.federal_provider_number}',
          ${r.fiscal_year},
          ${r.national_rank},
          ${r.national_total},
          ${r.national_percentile},
          ${r.state_rank || 'NULL'},
          ${r.state_total || 'NULL'},
          ${r.state_percentile || 'NULL'},
          ${r.market_rank || 'NULL'},
          ${r.market_total || 'NULL'},
          ${r.market_percentile || 'NULL'},
          ${r.chain_rank || 'NULL'},
          ${r.chain_total || 'NULL'},
          ${r.chain_percentile || 'NULL'},
          CURRENT_TIMESTAMP
        )`).join(',\n');

        await sequelize.query(`
          INSERT INTO facility_vbp_rankings (
            federal_provider_number,
            fiscal_year,
            national_rank,
            national_total,
            national_percentile,
            state_rank,
            state_total,
            state_percentile,
            market_rank,
            market_total,
            market_percentile,
            chain_rank,
            chain_total,
            chain_percentile,
            calculated_at
          ) VALUES ${values}
        `);

        inserted += batch.length;
        process.stdout.write(`\r  Inserted ${inserted.toLocaleString()} rankings...`);
      }

      console.log(`\n  Completed FY ${fiscal_year}: ${inserted.toLocaleString()} rankings`);
      totalInserted += inserted;

      // Print some stats
      const [stats] = await sequelize.query(`
        SELECT
          COUNT(DISTINCT federal_provider_number) as facilities,
          AVG(national_percentile)::numeric(5,2) as avg_national_pct,
          COUNT(DISTINCT CASE WHEN chain_rank IS NOT NULL THEN federal_provider_number END) as chain_facilities
        FROM facility_vbp_rankings
        WHERE fiscal_year = :fiscal_year
      `, { replacements: { fiscal_year } });

      if (stats[0]) {
        console.log(`  Stats: ${stats[0].facilities} facilities, avg percentile: ${stats[0].avg_national_pct}%, ${stats[0].chain_facilities} in chains`);
      }
    }

    console.log(`\n========================`);
    console.log(`Total rankings calculated: ${totalInserted.toLocaleString()}`);
    console.log('Done!');

  } catch (error) {
    console.error('\nError calculating rankings:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let fiscalYear = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--year' && args[i + 1]) {
    fiscalYear = args[i + 1];
  }
}

// Run if called directly
if (require.main === module) {
  calculateRankings(fiscalYear)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { calculateRankings };
