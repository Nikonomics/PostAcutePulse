import XLSX from 'xlsx';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/snf_platform' });

// State name to code mapping
const stateNameToCode = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
  'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
  'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
  'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

async function updateProjections() {
  const workbook = XLSX.readFile('/Users/nikolashulewsky/Desktop/CAGR.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const years = 8; // 2022 to 2030
  let totalUpdated = 0;

  console.log('Updating county demographics with state-level CAGRs...\n');

  for (const row of data.slice(1)) {
    const stateName = row[0];
    const cagr65 = row[7];
    const cagr85 = row[8];

    if (!stateName || cagr65 == null) continue;

    const stateCode = stateNameToCode[stateName];
    if (!stateCode) {
      console.log('Unknown state:', stateName);
      continue;
    }

    // Calculate total growth multiplier over 8 years
    const multiplier65 = Math.pow(1 + cagr65, years);
    const multiplier85 = Math.pow(1 + cagr85, years);

    // Calculate total growth rate percentage
    const totalGrowth65 = (multiplier65 - 1) * 100;
    const totalGrowth85 = (multiplier85 - 1) * 100;

    // Update all counties in this state
    const result = await pool.query(`
      UPDATE county_demographics
      SET
        projected_65_plus_2030 = ROUND(population_65_plus::numeric * $1::numeric),
        projected_85_plus_2030 = ROUND(population_85_plus::numeric * $2::numeric),
        growth_rate_65_plus = $3::numeric,
        growth_rate_85_plus = $4::numeric,
        updated_at = CURRENT_TIMESTAMP
      WHERE state_code = $5
    `, [multiplier65.toString(), multiplier85.toString(), totalGrowth65.toFixed(2), totalGrowth85.toFixed(2), stateCode]);

    totalUpdated += result.rowCount;
    console.log(`${stateCode}: Updated ${result.rowCount} counties (65+ growth: ${totalGrowth65.toFixed(1)}%, 85+ growth: ${totalGrowth85.toFixed(1)}%)`);
  }

  console.log(`\n✅ Total counties updated: ${totalUpdated}`);

  // Calculate new national averages
  const avgResult = await pool.query(`
    SELECT
      (SUM(projected_65_plus_2030::numeric) - SUM(population_65_plus::numeric)) / NULLIF(SUM(population_65_plus::numeric), 0) * 100 as national_growth_65,
      (SUM(projected_85_plus_2030::numeric) - SUM(population_85_plus::numeric)) / NULLIF(SUM(population_85_plus::numeric), 0) * 100 as national_growth_85
    FROM county_demographics
    WHERE population_65_plus IS NOT NULL AND projected_65_plus_2030 IS NOT NULL
  `);

  console.log('\n📊 New National Averages:');
  console.log(`   65+ Growth: ${parseFloat(avgResult.rows[0].national_growth_65).toFixed(1)}%`);
  console.log(`   85+ Growth: ${parseFloat(avgResult.rows[0].national_growth_85).toFixed(1)}%`);
  console.log('\n⚠️  Update NATIONAL_BENCHMARKS in frontend/src/utils/marketScoreCalculations.js with these values!');

  await pool.end();
}

updateProjections().catch(e => { console.error(e); process.exit(1); });
