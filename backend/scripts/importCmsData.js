/**
 * CMS Data Import Script
 * Imports NH_ProviderInfo CSV data into snf_facilities table
 *
 * Usage: node scripts/importCmsData.js [path-to-csv]
 *
 * If no path provided, defaults to:
 * ~/Desktop/Deal Files/nursing_homes_including_rehab_services_current_data/NH_ProviderInfo_Nov2025.csv
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection - enable SSL for remote connections
const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
const isRemote = connectionString.includes('render.com') || connectionString.includes('amazonaws.com');

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

// CSV parsing helper
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || null;
    });
    rows.push(row);
  }

  return { headers, rows };
}

// Map CSV columns to database columns
function mapRowToFacility(row) {
  // Helper to parse int safely
  const parseInt2 = (val) => {
    if (!val || val === '') return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  };

  // Helper to parse float safely
  const parseFloat2 = (val) => {
    if (!val || val === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  // Helper to parse boolean
  const parseBool = (val) => {
    if (!val || val === '') return null;
    return val === 'Y' || val === 'Yes' || val === 'TRUE' || val === '1';
  };

  // Calculate occupancy rate
  const beds = parseInt2(row['Number of Certified Beds']);
  const residents = parseFloat2(row['Average Number of Residents per Day']);
  const occupancyRate = (beds && residents) ? Math.round((residents / beds) * 100 * 100) / 100 : null;

  return {
    federal_provider_number: row['CMS Certification Number (CCN)'],
    cms_certification_number: row['CMS Certification Number (CCN)'],
    facility_name: row['Provider Name'],
    address: row['Provider Address'],
    city: row['City/Town'],
    state: row['State'],
    zip_code: row['ZIP Code'],
    county: row['County/Parish'],
    phone: row['Telephone Number'],
    latitude: parseFloat2(row['Latitude']),
    longitude: parseFloat2(row['Longitude']),
    ownership_type: row['Ownership Type'],
    provider_type: row['Provider Type'],
    certified_beds: beds,
    total_beds: beds,
    occupancy_rate: occupancyRate,
    legal_business_name: row['Legal Business Name'],
    ownership_chain: row['Chain Name'],
    multi_facility_chain: row['Chain ID'] ? true : false,
    overall_rating: parseInt2(row['Overall Rating']),
    health_inspection_rating: parseInt2(row['Health Inspection Rating']),
    quality_measure_rating: parseInt2(row['QM Rating']),
    staffing_rating: parseInt2(row['Staffing Rating']),
    rn_staffing_hours: parseFloat2(row['Reported RN Staffing Hours per Resident per Day']),
    total_nurse_staffing_hours: parseFloat2(row['Reported Total Nurse Staffing Hours per Resident per Day']),
    reported_cna_staffing_hours: parseFloat2(row['Reported Nurse Aide Staffing Hours per Resident per Day']),
    health_deficiencies: parseInt2(row['Rating Cycle 1 Total Number of Health Deficiencies']),
    fire_safety_deficiencies: parseInt2(row['Rating Cycle 1 Number of Complaint Health Deficiencies']),
    total_penalties_amount: parseFloat2(row['Total Amount of Fines in Dollars']),
    penalty_count: parseInt2(row['Total Number of Penalties']),
    special_focus_facility: parseBool(row['Special Focus Status']),
    abuse_icon: parseBool(row['Abuse Icon']),
    continuing_care_retirement_community: parseBool(row['Continuing Care Retirement Community']),
    date_certified: row['Date First Approved to Provide Medicare and Medicaid Services'] || null,
    last_cms_update: row['Processing Date'] || null,
  };
}

async function importData(csvPath) {
  console.log(`\n📂 Reading CSV: ${csvPath}`);

  const { rows } = parseCSV(csvPath);
  console.log(`📊 Found ${rows.length} facilities in CSV`);

  const client = await pool.connect();

  try {
    let updated = 0;
    let inserted = 0;
    let errors = 0;

    console.log('\n🔄 Importing facilities...');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const facility = mapRowToFacility(row);

      if (!facility.federal_provider_number) {
        errors++;
        continue;
      }

      try {
        // Upsert: Update if exists, insert if not
        const result = await client.query(`
          INSERT INTO snf_facilities (
            federal_provider_number, cms_certification_number, facility_name,
            address, city, state, zip_code, county, phone,
            latitude, longitude, ownership_type, provider_type,
            certified_beds, total_beds, occupancy_rate,
            legal_business_name, ownership_chain, multi_facility_chain,
            overall_rating, health_inspection_rating, quality_measure_rating, staffing_rating,
            rn_staffing_hours, total_nurse_staffing_hours, reported_cna_staffing_hours,
            health_deficiencies, fire_safety_deficiencies,
            total_penalties_amount, penalty_count,
            special_focus_facility, abuse_icon, continuing_care_retirement_community,
            date_certified, last_cms_update, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, CURRENT_TIMESTAMP
          )
          ON CONFLICT (federal_provider_number) DO UPDATE SET
            cms_certification_number = EXCLUDED.cms_certification_number,
            facility_name = EXCLUDED.facility_name,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip_code = EXCLUDED.zip_code,
            county = EXCLUDED.county,
            phone = EXCLUDED.phone,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            ownership_type = EXCLUDED.ownership_type,
            provider_type = EXCLUDED.provider_type,
            certified_beds = EXCLUDED.certified_beds,
            total_beds = EXCLUDED.total_beds,
            occupancy_rate = EXCLUDED.occupancy_rate,
            legal_business_name = EXCLUDED.legal_business_name,
            ownership_chain = EXCLUDED.ownership_chain,
            multi_facility_chain = EXCLUDED.multi_facility_chain,
            overall_rating = EXCLUDED.overall_rating,
            health_inspection_rating = EXCLUDED.health_inspection_rating,
            quality_measure_rating = EXCLUDED.quality_measure_rating,
            staffing_rating = EXCLUDED.staffing_rating,
            rn_staffing_hours = EXCLUDED.rn_staffing_hours,
            total_nurse_staffing_hours = EXCLUDED.total_nurse_staffing_hours,
            reported_cna_staffing_hours = EXCLUDED.reported_cna_staffing_hours,
            health_deficiencies = EXCLUDED.health_deficiencies,
            fire_safety_deficiencies = EXCLUDED.fire_safety_deficiencies,
            total_penalties_amount = EXCLUDED.total_penalties_amount,
            penalty_count = EXCLUDED.penalty_count,
            special_focus_facility = EXCLUDED.special_focus_facility,
            abuse_icon = EXCLUDED.abuse_icon,
            continuing_care_retirement_community = EXCLUDED.continuing_care_retirement_community,
            date_certified = EXCLUDED.date_certified,
            last_cms_update = EXCLUDED.last_cms_update,
            updated_at = CURRENT_TIMESTAMP
        `, [
          facility.federal_provider_number,
          facility.cms_certification_number,
          facility.facility_name,
          facility.address,
          facility.city,
          facility.state,
          facility.zip_code,
          facility.county,
          facility.phone,
          facility.latitude,
          facility.longitude,
          facility.ownership_type,
          facility.provider_type,
          facility.certified_beds,
          facility.total_beds,
          facility.occupancy_rate,
          facility.legal_business_name,
          facility.ownership_chain,
          facility.multi_facility_chain,
          facility.overall_rating,
          facility.health_inspection_rating,
          facility.quality_measure_rating,
          facility.staffing_rating,
          facility.rn_staffing_hours,
          facility.total_nurse_staffing_hours,
          facility.reported_cna_staffing_hours,
          facility.health_deficiencies,
          facility.fire_safety_deficiencies,
          facility.total_penalties_amount,
          facility.penalty_count,
          facility.special_focus_facility,
          facility.abuse_icon,
          facility.continuing_care_retirement_community,
          facility.date_certified,
          facility.last_cms_update
        ]);

        if (result.rowCount > 0) {
          updated++;
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error on ${facility.federal_provider_number}: ${err.message}`);
        }
      }

      // Progress update
      if ((i + 1) % 1000 === 0 || i === rows.length - 1) {
        const pct = Math.round(((i + 1) / rows.length) * 100);
        console.log(`  ${pct}% complete (${i + 1}/${rows.length})`);
      }
    }

    console.log('\n✅ Import complete!');
    console.log(`   Updated/Inserted: ${updated}`);
    console.log(`   Errors: ${errors}`);

    // Verify final count
    const countResult = await client.query(`
      SELECT COUNT(*) as total, MAX(last_cms_update) as latest_update
      FROM snf_facilities
    `);
    console.log(`\n📈 Database now has ${countResult.rows[0].total} facilities`);
    console.log(`   Latest CMS update: ${countResult.rows[0].latest_update}`);

  } finally {
    client.release();
  }
}

// Main execution
const csvPath = process.argv[2] || path.join(
  process.env.HOME,
  'Desktop/Deal Files/nursing_homes_including_rehab_services_current_data/NH_ProviderInfo_Nov2025.csv'
);

if (!fs.existsSync(csvPath)) {
  console.error(`❌ CSV file not found: ${csvPath}`);
  process.exit(1);
}

importData(csvPath)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Import failed:', err);
    process.exit(1);
  });
