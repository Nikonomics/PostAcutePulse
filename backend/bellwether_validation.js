const { Client } = require('pg');

async function runValidation() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('=== VALIDATION QUERY 4: Train/Test Pattern Analysis ===\n');

  // Query 4: Simpler validation - check if frequently-surveyed facilities have consistent followers
  const validationQuery = `
    WITH all_survey_pairs AS (
      -- Find all A->B patterns across full dataset
      SELECT
        a.federal_provider_number as leader_ccn,
        b.federal_provider_number as follower_ccn,
        fa.county,
        fa.state,
        EXTRACT(YEAR FROM a.survey_date) as year,
        COUNT(*) as occurrences
      FROM cms_facility_deficiencies a
      JOIN cms_facility_deficiencies b ON TRUE
      JOIN snf_facilities fa ON a.federal_provider_number = fa.federal_provider_number
      JOIN snf_facilities fb ON b.federal_provider_number = fb.federal_provider_number
      WHERE fa.county = fb.county
        AND fa.state = fb.state
        AND a.federal_provider_number != b.federal_provider_number
        AND b.survey_date > a.survey_date
        AND b.survey_date <= a.survey_date + 14
        AND a.survey_date >= '2020-01-01'
        AND fa.county IS NOT NULL
      GROUP BY a.federal_provider_number, b.federal_provider_number, fa.county, fa.state, EXTRACT(YEAR FROM a.survey_date)
    ),
    -- Count patterns by year
    yearly_summary AS (
      SELECT
        year,
        COUNT(DISTINCT leader_ccn || '-' || follower_ccn) as unique_pairs,
        SUM(occurrences) as total_lead_events
      FROM all_survey_pairs
      GROUP BY year
      ORDER BY year
    )
    SELECT * FROM yearly_summary
  `;

  console.log('Yearly Summary of A->B Survey Patterns:');
  console.log('-'.repeat(50));

  const result = await client.query(validationQuery);
  result.rows.forEach(row => {
    console.log(`${row.year}: ${row.unique_pairs} unique A->B pairs, ${row.total_lead_events} total lead events`);
  });

  // Query 5: Sequential pattern test - specific facility pairs
  console.log('\n\n=== VALIDATION QUERY 5: Specific A->B Pattern Persistence ===\n');

  const persistenceQuery = `
    WITH pair_history AS (
      SELECT
        a.federal_provider_number as leader_ccn,
        b.federal_provider_number as follower_ccn,
        fa.county,
        fa.state,
        EXTRACT(YEAR FROM a.survey_date) as year,
        COUNT(*) as occurrences
      FROM cms_facility_deficiencies a
      JOIN cms_facility_deficiencies b ON TRUE
      JOIN snf_facilities fa ON a.federal_provider_number = fa.federal_provider_number
      JOIN snf_facilities fb ON b.federal_provider_number = fb.federal_provider_number
      WHERE fa.county = fb.county
        AND fa.state = fb.state
        AND a.federal_provider_number != b.federal_provider_number
        AND b.survey_date > a.survey_date
        AND b.survey_date <= a.survey_date + 14
        AND a.survey_date >= '2020-01-01'
        AND fa.county IS NOT NULL
      GROUP BY a.federal_provider_number, b.federal_provider_number, fa.county, fa.state, EXTRACT(YEAR FROM a.survey_date)
    ),
    pair_persistence AS (
      SELECT
        leader_ccn,
        follower_ccn,
        county,
        state,
        COUNT(DISTINCT year) as years_with_pattern,
        SUM(occurrences) as total_occurrences,
        ARRAY_AGG(DISTINCT year ORDER BY year) as years_present
      FROM pair_history
      GROUP BY leader_ccn, follower_ccn, county, state
      HAVING COUNT(DISTINCT year) >= 3  -- Pattern present in 3+ years
    )
    SELECT
      pp.leader_ccn,
      fl.facility_name as leader_name,
      pp.follower_ccn,
      ff.facility_name as follower_name,
      pp.county,
      pp.state,
      pp.years_with_pattern,
      pp.total_occurrences,
      pp.years_present
    FROM pair_persistence pp
    JOIN snf_facilities fl ON pp.leader_ccn = fl.federal_provider_number
    JOIN snf_facilities ff ON pp.follower_ccn = ff.federal_provider_number
    ORDER BY pp.years_with_pattern DESC, pp.total_occurrences DESC
    LIMIT 25
  `;

  const persistResult = await client.query(persistenceQuery);

  console.log('Top 25 Most Persistent A->B Pairs (appearing in 3+ years):');
  console.log('='.repeat(120));
  console.log('Leader                                  | Follower                                | County          | St | Years | Total');
  console.log('-'.repeat(120));

  persistResult.rows.forEach(row => {
    const leaderName = (row.leader_name || 'Unknown').substring(0, 38).padEnd(38);
    const followerName = (row.follower_name || 'Unknown').substring(0, 38).padEnd(38);
    const county = (row.county || '').substring(0, 15).padEnd(15);
    console.log(`${leaderName} | ${followerName} | ${county} | ${row.state} | ${String(row.years_with_pattern).padStart(5)} | ${String(row.total_occurrences).padStart(5)}`);
  });

  // Summary stats
  console.log('\n\n=== SUMMARY STATISTICS ===\n');

  const summaryQuery = `
    WITH pair_history AS (
      SELECT
        a.federal_provider_number as leader_ccn,
        b.federal_provider_number as follower_ccn,
        fa.county,
        EXTRACT(YEAR FROM a.survey_date) as year
      FROM cms_facility_deficiencies a
      JOIN cms_facility_deficiencies b ON TRUE
      JOIN snf_facilities fa ON a.federal_provider_number = fa.federal_provider_number
      JOIN snf_facilities fb ON b.federal_provider_number = fb.federal_provider_number
      WHERE fa.county = fb.county
        AND fa.state = fb.state
        AND a.federal_provider_number != b.federal_provider_number
        AND b.survey_date > a.survey_date
        AND b.survey_date <= a.survey_date + 14
        AND a.survey_date >= '2020-01-01'
        AND fa.county IS NOT NULL
    ),
    pair_years AS (
      SELECT
        leader_ccn,
        follower_ccn,
        COUNT(DISTINCT year) as years_present
      FROM pair_history
      GROUP BY leader_ccn, follower_ccn
    )
    SELECT
      years_present,
      COUNT(*) as pair_count
    FROM pair_years
    GROUP BY years_present
    ORDER BY years_present
  `;

  const summaryResult = await client.query(summaryQuery);

  console.log('Pattern Persistence Distribution:');
  console.log('-'.repeat(40));
  let totalPairs = 0;
  let persistentPairs = 0;
  summaryResult.rows.forEach(row => {
    totalPairs += parseInt(row.pair_count);
    if (row.years_present >= 3) persistentPairs += parseInt(row.pair_count);
    console.log(`${row.years_present} years: ${row.pair_count} pairs`);
  });

  console.log('-'.repeat(40));
  console.log(`Total unique A->B pairs: ${totalPairs}`);
  console.log(`Pairs appearing 3+ years: ${persistentPairs} (${(100 * persistentPairs / totalPairs).toFixed(1)}%)`);

  await client.end();
}

runValidation().catch(err => { console.error(err); process.exit(1); });
