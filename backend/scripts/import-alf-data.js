import pg from 'pg';
import fs from 'fs';
import https from 'https';
import { parse } from 'csv-parse';

const { Client } = pg;
const localUrl = 'postgresql://localhost:5432/snf_news';

const CSV_URL = 'https://raw.githubusercontent.com/antonstengel/assisted-living-data/main/assisted-living-facilities.csv';
const CSV_FILE = '/tmp/alf-data.csv';

async function downloadCSV() {
  return new Promise((resolve, reject) => {
    console.log('📥 Downloading ALF CSV data...');
    const file = fs.createWriteStream(CSV_FILE);

    https.get(CSV_URL, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✓ Download complete\n');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(CSV_FILE, () => {});
      reject(err);
    });
  });
}

async function importData() {
  const client = new Client({ connectionString: localUrl });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Truncate table
    await client.query('TRUNCATE TABLE alf_facilities CASCADE');
    console.log('✓ Truncated alf_facilities table\n');

    // Parse and import CSV
    const parser = fs.createReadStream(CSV_FILE).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
    );

    let count = 0;
    let errors = 0;

    for await (const record of parser) {
      try {
        await client.query(
          `INSERT INTO alf_facilities (
            facility_id, facility_name, address, city, state, zip_code,
            phone_number, county, licensee, state_facility_type_2,
            state_facility_type_1, date_accessed, license_number, capacity,
            email_address, ownership_type, latitude, longitude, county_fips,
            total_county_al_need, county_percent_65_plus, county_median_age,
            county_homeownership_rate, county_college_education_rate,
            county_percent_black, county_median_home_value,
            county_percent_hispanic, county_percent_85_plus,
            county_median_household_income, county_unemployment_rate,
            county_less_than_hs_rate, county_percent_white,
            county_gender_ratio, county_poverty_rate
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34
          )`,
          [
            record['Facility ID'] || null,
            record['Facility Name'],
            record['Address'],
            record['City'],
            record['State'],
            record['Zip Code'],
            record['Phone Number'],
            record['County'],
            record['Licensee'],
            record['State Facility Type 2 Literal'],
            record['State Facility Type 1 Literal'],
            record['Date Accessed'] || null,
            record['License Number'],
            record['Capacity'] ? parseFloat(record['Capacity']) : null,
            record['Email Address'],
            record['Ownership Type'],
            record['Latitude'] ? parseFloat(record['Latitude']) : null,
            record['Longitude'] ? parseFloat(record['Longitude']) : null,
            record['County FIPS'],
            record['Total County AL Need'] ? parseFloat(record['Total County AL Need']) : null,
            record['County Percent of Population 65 or Older'] ? parseFloat(record['County Percent of Population 65 or Older']) : null,
            record['County Median Age'] ? parseFloat(record['County Median Age']) : null,
            record['County Homeownership Rate'] ? parseFloat(record['County Homeownership Rate']) : null,
            record['County College Education or Higher Rate'] ? parseFloat(record['County College Education or Higher Rate']) : null,
            record['County Percent Black Population'] ? parseFloat(record['County Percent Black Population']) : null,
            record['County Median Home Value of Owned Homes'] ? parseFloat(record['County Median Home Value of Owned Homes']) : null,
            record['County Percent Hispanic Population'] ? parseFloat(record['County Percent Hispanic Population']) : null,
            record['County Percent of Population 85 or Older'] ? parseFloat(record['County Percent of Population 85 or Older']) : null,
            record['County Median Household Income'] ? parseFloat(record['County Median Household Income']) : null,
            record['County Unemployment Rate'] ? parseFloat(record['County Unemployment Rate']) : null,
            record['County Less Than High School Diploma Rate'] ? parseFloat(record['County Less Than High School Diploma Rate']) : null,
            record['County Percent Whilte Population'] ? parseFloat(record['County Percent Whilte Population']) : null,
            record['County Gender Ratio'] ? parseFloat(record['County Gender Ratio']) : null,
            record['County Poverty Rate'] ? parseFloat(record['County Poverty Rate']) : null
          ]
        );

        count++;
        if (count % 1000 === 0) {
          process.stdout.write(`\r   Imported: ${count} facilities`);
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.log(`\n⚠️  Error importing record: ${err.message}`);
        }
      }
    }

    console.log(`\r   ✓ Imported ${count} facilities (${errors} errors)\n`);

    // Get counts by state
    const stateCounts = await client.query(`
      SELECT state, COUNT(*) as count
      FROM alf_facilities
      WHERE active = true
      GROUP BY state
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log('Top 10 states by ALF count:');
    stateCounts.rows.forEach(row => {
      console.log(`  ${row.state}: ${row.count} facilities`);
    });

    console.log('\n✅ ALF data import complete!');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    await downloadCSV();
    await importData();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
