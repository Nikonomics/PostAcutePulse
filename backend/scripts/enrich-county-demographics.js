import pg from 'pg';

const { Client } = pg;
const localUrl = 'postgresql://localhost:5432/snf_news';

async function enrichCountyDemographics() {
  const client = new Client({ connectionString: localUrl });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Step 1: Add new columns to county_demographics
    console.log('Step 1: Adding new columns to county_demographics...');

    const newColumns = [
      'median_age NUMERIC',
      'median_household_income NUMERIC',
      'median_home_value NUMERIC',
      'homeownership_rate NUMERIC',
      'college_education_rate NUMERIC',
      'less_than_hs_rate NUMERIC',
      'unemployment_rate NUMERIC',
      'poverty_rate NUMERIC',
      'percent_white NUMERIC',
      'percent_black NUMERIC',
      'percent_hispanic NUMERIC',
      'gender_ratio NUMERIC',
      'total_al_need NUMERIC'
    ];

    for (const column of newColumns) {
      try {
        await client.query(`ALTER TABLE county_demographics ADD COLUMN IF NOT EXISTS ${column}`);
      } catch (err) {
        // Column might already exist, that's okay
        if (!err.message.includes('already exists')) {
          console.log(`   ⚠️  ${column}: ${err.message}`);
        }
      }
    }

    console.log('✓ Columns added\n');

    // Step 2: Update county_demographics with ALF data
    console.log('Step 2: Updating county_demographics with ALF economic data...');

    const updateQuery = `
      UPDATE county_demographics cd
      SET
        median_age = alf.county_median_age,
        median_household_income = alf.county_median_household_income,
        median_home_value = alf.county_median_home_value,
        homeownership_rate = alf.county_homeownership_rate,
        college_education_rate = alf.county_college_education_rate,
        less_than_hs_rate = alf.county_less_than_hs_rate,
        unemployment_rate = alf.county_unemployment_rate,
        poverty_rate = alf.county_poverty_rate,
        percent_white = alf.county_percent_white,
        percent_black = alf.county_percent_black,
        percent_hispanic = alf.county_percent_hispanic,
        gender_ratio = alf.county_gender_ratio,
        total_al_need = alf.total_county_al_need,
        updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT DISTINCT ON (county_fips)
          CAST(CAST(county_fips AS NUMERIC) AS INTEGER)::TEXT as county_fips,
          county_median_age,
          county_median_household_income,
          county_median_home_value,
          county_homeownership_rate,
          county_college_education_rate,
          county_less_than_hs_rate,
          county_unemployment_rate,
          county_poverty_rate,
          county_percent_white,
          county_percent_black,
          county_percent_hispanic,
          county_gender_ratio,
          total_county_al_need
        FROM alf_facilities
        WHERE county_fips IS NOT NULL
          AND county_median_age IS NOT NULL
      ) alf
      WHERE cd.county_fips = alf.county_fips
    `;

    const result = await client.query(updateQuery);
    console.log(`✓ Updated ${result.rowCount} counties with economic data\n`);

    // Step 3: Show sample of enriched data
    console.log('Step 3: Sample of enriched data:\n');

    const sample = await client.query(`
      SELECT
        state_name,
        county_name,
        total_population,
        percent_65_plus,
        median_age,
        median_household_income,
        poverty_rate,
        unemployment_rate,
        total_al_need
      FROM county_demographics
      WHERE state_code = 'ID'
        AND median_household_income IS NOT NULL
      ORDER BY total_population DESC
      LIMIT 5
    `);

    sample.rows.forEach(row => {
      console.log(`${row.county_name}, ${row.state_name}:`);
      console.log(`  Population: ${row.total_population?.toLocaleString()}`);
      console.log(`  % 65+: ${row.percent_65_plus}%`);
      console.log(`  Median Age: ${row.median_age}`);
      console.log(`  Median Income: $${row.median_household_income?.toLocaleString()}`);
      console.log(`  Poverty Rate: ${row.poverty_rate}%`);
      console.log(`  Unemployment: ${row.unemployment_rate}%`);
      console.log(`  AL Need: ${row.total_al_need?.toLocaleString()}\n`);
    });

    // Step 4: Show statistics
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_counties,
        COUNT(median_household_income) as counties_with_economic_data,
        ROUND(100.0 * COUNT(median_household_income) / COUNT(*), 2) as coverage_percent
      FROM county_demographics
    `);

    console.log('Summary:');
    console.log(`  Total counties: ${stats.rows[0].total_counties}`);
    console.log(`  Counties with economic data: ${stats.rows[0].counties_with_economic_data}`);
    console.log(`  Coverage: ${stats.rows[0].coverage_percent}%`);

    console.log('\n✅ County demographics enrichment complete!');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

enrichCountyDemographics();
