/**
 * Census ACS Data Refresh Service
 *
 * Fetches county-level demographic and economic data from the Census Bureau
 * American Community Survey (ACS) 5-Year Estimates API.
 *
 * Data includes:
 * - Population by age (65+, 85+)
 * - Median household income
 * - Median home value
 * - Poverty rate
 * - Homeownership rate
 *
 * Also calculates county-specific growth rates from historical ACS data
 * and projects 2030 populations.
 */

const { Pool } = require('pg');

// Census ACS API base URL
const CENSUS_API_BASE = 'https://api.census.gov/data';

// ACS Variables we need
const ACS_VARIABLES = {
  // Economic indicators
  B19013_001E: 'median_household_income',
  B25077_001E: 'median_home_value',
  B17001_001E: 'poverty_universe',      // Total population for poverty calculation
  B17001_002E: 'poverty_below',         // Population below poverty level
  B25003_001E: 'housing_total',         // Total housing units
  B25003_002E: 'housing_owner',         // Owner-occupied units

  // Total population
  B01003_001E: 'total_population',

  // Male 65+ (B01001_020 = 65-66, 021 = 67-69, 022 = 70-74, 023 = 75-79, 024 = 80-84, 025 = 85+)
  B01001_020E: 'male_65_66',
  B01001_021E: 'male_67_69',
  B01001_022E: 'male_70_74',
  B01001_023E: 'male_75_79',
  B01001_024E: 'male_80_84',
  B01001_025E: 'male_85_plus',

  // Female 65+ (B01001_044 = 65-66, 045 = 67-69, 046 = 70-74, 047 = 75-79, 048 = 80-84, 049 = 85+)
  B01001_044E: 'female_65_66',
  B01001_045E: 'female_67_69',
  B01001_046E: 'female_70_74',
  B01001_047E: 'female_75_79',
  B01001_048E: 'female_80_84',
  B01001_049E: 'female_85_plus',

  // Education
  B15003_001E: 'education_total',       // Total population 25+
  B15003_022E: 'bachelors',             // Bachelor's degree
  B15003_023E: 'masters',               // Master's degree
  B15003_024E: 'professional',          // Professional school degree
  B15003_025E: 'doctorate',             // Doctorate degree

  // Unemployment (civilian labor force)
  B23025_003E: 'labor_force_civilian',  // Civilian labor force
  B23025_005E: 'unemployed',            // Unemployed
};

// State FIPS codes mapping
const STATE_FIPS = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'PR': '72',
  'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48',
  'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56'
};

// Reverse mapping: FIPS to state code
const FIPS_TO_STATE = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([state, fips]) => [fips, state])
);

// Database connection
const getPool = () => {
  const connectionString = process.env.SNF_NEWS_DATABASE_URL || 'postgresql://localhost:5432/snf_news';
  const isProduction = connectionString.includes('render.com');

  return new Pool({
    connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
};

let pool = null;
const getPoolInstance = () => {
  if (!pool) {
    pool = getPool();
  }
  return pool;
};

/**
 * Fetch ACS data for all counties from Census API
 * @param {number} year - ACS year (e.g., 2022 for 2022 5-year estimates)
 * @returns {Promise<Array>} Array of county data objects
 */
async function fetchACSData(year = 2022) {
  const variables = Object.keys(ACS_VARIABLES).join(',');
  const url = `${CENSUS_API_BASE}/${year}/acs/acs5?get=${variables},NAME&for=county:*&in=state:*`;

  console.log(`Fetching ACS ${year} data from Census API...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Census API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // First row is header
  const headers = data[0];
  const rows = data.slice(1);

  console.log(`Received ${rows.length} county records from Census API`);

  // Convert to objects
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * Process raw Census data into county demographics format
 * @param {Object} raw - Raw Census API response object
 * @returns {Object} Processed county data
 */
function processCountyData(raw) {
  // Parse numeric values (Census returns strings, -666666666 for missing)
  const parseNum = (val) => {
    const num = parseInt(val, 10);
    return (isNaN(num) || num < 0) ? null : num;
  };

  // Calculate 65+ population
  const pop65Plus = [
    'B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E',
    'B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E'
  ].reduce((sum, key) => sum + (parseNum(raw[key]) || 0), 0);

  // Calculate 85+ population
  const pop85Plus = (parseNum(raw['B01001_025E']) || 0) + (parseNum(raw['B01001_049E']) || 0);

  const totalPop = parseNum(raw['B01003_001E']);
  const povertyUniverse = parseNum(raw['B17001_001E']);
  const povertyBelow = parseNum(raw['B17001_002E']);
  const housingTotal = parseNum(raw['B25003_001E']);
  const housingOwner = parseNum(raw['B25003_002E']);
  const educationTotal = parseNum(raw['B15003_001E']);
  const collegeDegrees = (parseNum(raw['B15003_022E']) || 0) +
                         (parseNum(raw['B15003_023E']) || 0) +
                         (parseNum(raw['B15003_024E']) || 0) +
                         (parseNum(raw['B15003_025E']) || 0);
  const laborForce = parseNum(raw['B23025_003E']);
  const unemployed = parseNum(raw['B23025_005E']);

  // Parse county name from "County Name, State"
  const nameParts = raw['NAME'].split(', ');
  const countyName = nameParts[0].replace(/ County$| Parish$| Borough$| Census Area$| Municipality$| City and Borough$| city$/i, '');
  const stateName = nameParts[1] || '';

  return {
    state_code: FIPS_TO_STATE[raw['state']] || raw['state'],
    state_name: stateName,
    county_fips: raw['state'] + raw['county'],
    county_name: countyName,
    total_population: totalPop,
    population_65_plus: pop65Plus,
    population_85_plus: pop85Plus,
    percent_65_plus: totalPop ? ((pop65Plus / totalPop) * 100).toFixed(2) : null,
    percent_85_plus: totalPop ? ((pop85Plus / totalPop) * 100).toFixed(2) : null,
    median_household_income: parseNum(raw['B19013_001E']),
    median_home_value: parseNum(raw['B25077_001E']),
    poverty_rate: (povertyUniverse && povertyBelow) ? ((povertyBelow / povertyUniverse) * 100).toFixed(2) : null,
    homeownership_rate: (housingTotal && housingOwner) ? ((housingOwner / housingTotal) * 100).toFixed(2) : null,
    college_education_rate: (educationTotal && collegeDegrees) ? ((collegeDegrees / educationTotal) * 100).toFixed(2) : null,
    unemployment_rate: (laborForce && unemployed) ? ((unemployed / laborForce) * 100).toFixed(2) : null,
  };
}

/**
 * Calculate growth rates from historical data
 * Fetches both current and historical ACS data to compute county-specific growth rates
 * @param {number} currentYear - Current ACS year (default: 2022)
 * @param {number} historicalYear - Historical ACS year (default: 2018)
 * @returns {Promise<Map>} Map of county FIPS to growth data
 */
async function calculateGrowthRates(currentYear = 2022, historicalYear = 2018) {
  console.log(`Calculating growth rates: ${historicalYear} -> ${currentYear}`);

  // Simplified variables for historical comparison
  const growthVars = 'B01001_025E,B01001_049E,B01003_001E';

  // Fetch historical data
  const histUrl = `${CENSUS_API_BASE}/${historicalYear}/acs/acs5?get=${growthVars},NAME&for=county:*&in=state:*`;
  console.log(`Fetching ${historicalYear} historical data...`);
  const histResponse = await fetch(histUrl);

  if (!histResponse.ok) {
    console.warn(`Could not fetch ${historicalYear} data: ${histResponse.status}`);
    return new Map();
  }

  const histData = await histResponse.json();
  const histHeaders = histData[0];
  const histRows = histData.slice(1);

  // Build map of historical 85+ populations
  const historicalPop = new Map();
  histRows.forEach(row => {
    const obj = {};
    histHeaders.forEach((h, i) => obj[h] = row[i]);

    const fips = obj['state'] + obj['county'];
    const male85 = parseInt(obj['B01001_025E'], 10) || 0;
    const female85 = parseInt(obj['B01001_049E'], 10) || 0;
    const pop85 = male85 + female85;

    if (pop85 > 0) {
      historicalPop.set(fips, pop85);
    }
  });

  console.log(`Found ${historicalPop.size} counties with ${historicalYear} data`);
  return historicalPop;
}

/**
 * Update county_demographics table with Census data
 * @param {Array} counties - Processed county data array
 * @param {Map} historicalPop - Map of county FIPS to historical 85+ population
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Update statistics
 */
async function updateCountyDemographics(counties, historicalPop, progressCallback = null) {
  const db = getPoolInstance();
  const stats = { updated: 0, inserted: 0, errors: 0 };
  const currentYear = 2022;
  const historicalYear = 2018;
  const yearsBetween = currentYear - historicalYear;
  const yearsToProject = 2030 - currentYear;

  console.log(`Updating ${counties.length} counties in database...`);

  for (let i = 0; i < counties.length; i++) {
    const county = counties[i];

    try {
      // Calculate growth rate if we have historical data
      let growthRate85 = null;
      let projected85_2030 = null;

      if (historicalPop.has(county.county_fips) && county.population_85_plus > 0) {
        const histPop = historicalPop.get(county.county_fips);
        // CAGR formula: ((ending/beginning)^(1/years)) - 1
        const cagr = Math.pow(county.population_85_plus / histPop, 1 / yearsBetween) - 1;
        growthRate85 = (cagr * 100).toFixed(2);
        // Project to 2030
        projected85_2030 = Math.round(county.population_85_plus * Math.pow(1 + cagr, yearsToProject));
      }

      // Check if county exists
      const existing = await db.query(
        'SELECT id FROM county_demographics WHERE county_fips = $1',
        [county.county_fips]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await db.query(`
          UPDATE county_demographics SET
            total_population = COALESCE($1, total_population),
            population_65_plus = COALESCE($2, population_65_plus),
            population_85_plus = COALESCE($3, population_85_plus),
            percent_65_plus = COALESCE($4, percent_65_plus),
            percent_85_plus = COALESCE($5, percent_85_plus),
            median_household_income = COALESCE($6, median_household_income),
            median_home_value = COALESCE($7, median_home_value),
            poverty_rate = COALESCE($8, poverty_rate),
            homeownership_rate = COALESCE($9, homeownership_rate),
            college_education_rate = COALESCE($10, college_education_rate),
            unemployment_rate = COALESCE($11, unemployment_rate),
            growth_rate_85_plus = COALESCE($12, growth_rate_85_plus),
            projected_85_plus_2030 = COALESCE($13, projected_85_plus_2030),
            data_source = 'US Census Bureau ACS 5-Year Estimates',
            data_year = $14,
            updated_at = NOW()
          WHERE county_fips = $15
        `, [
          county.total_population,
          county.population_65_plus,
          county.population_85_plus,
          county.percent_65_plus,
          county.percent_85_plus,
          county.median_household_income,
          county.median_home_value,
          county.poverty_rate,
          county.homeownership_rate,
          county.college_education_rate,
          county.unemployment_rate,
          growthRate85,
          projected85_2030,
          currentYear,
          county.county_fips
        ]);
        stats.updated++;
      } else {
        // Insert new
        await db.query(`
          INSERT INTO county_demographics (
            state_code, state_name, county_fips, county_name,
            total_population, population_65_plus, population_85_plus,
            percent_65_plus, percent_85_plus,
            median_household_income, median_home_value, poverty_rate,
            homeownership_rate, college_education_rate, unemployment_rate,
            growth_rate_85_plus, projected_85_plus_2030,
            data_source, data_year, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
        `, [
          county.state_code,
          county.state_name,
          county.county_fips,
          county.county_name,
          county.total_population,
          county.population_65_plus,
          county.population_85_plus,
          county.percent_65_plus,
          county.percent_85_plus,
          county.median_household_income,
          county.median_home_value,
          county.poverty_rate,
          county.homeownership_rate,
          county.college_education_rate,
          county.unemployment_rate,
          growthRate85,
          projected85_2030,
          'US Census Bureau ACS 5-Year Estimates',
          currentYear
        ]);
        stats.inserted++;
      }

      // Progress callback
      if (progressCallback && (i + 1) % 100 === 0) {
        progressCallback({
          processed: i + 1,
          total: counties.length,
          percent: Math.round(((i + 1) / counties.length) * 100)
        });
      }

    } catch (error) {
      console.error(`Error processing ${county.county_name}, ${county.state_code}:`, error.message);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Log refresh to data_refresh_log table
 */
async function logRefresh(datasetName, status, stats, errorMessage = null) {
  const db = getPoolInstance();

  try {
    if (status === 'started') {
      const result = await db.query(`
        INSERT INTO data_refresh_log (dataset_name, refresh_type, status, started_at)
        VALUES ($1, 'full', 'running', NOW())
        RETURNING id
      `, [datasetName]);
      return result.rows[0].id;
    } else {
      await db.query(`
        UPDATE data_refresh_log SET
          status = $1,
          completed_at = NOW(),
          records_updated = $2,
          records_inserted = $3,
          error_count = $4,
          error_message = $5
        WHERE id = $6
      `, [
        status,
        stats?.updated || 0,
        stats?.inserted || 0,
        stats?.errors || 0,
        errorMessage,
        stats?.logId
      ]);
    }
  } catch (error) {
    console.error('Error logging refresh:', error.message);
  }
}

/**
 * Main refresh function - fetches Census data and updates database
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Refresh results
 */
async function refreshCensusData(progressCallback = null) {
  const startTime = Date.now();
  let logId;

  try {
    // Log start
    logId = await logRefresh('census_demographics', 'started');

    if (progressCallback) {
      progressCallback({ stage: 'fetching', message: 'Fetching current ACS data from Census API...' });
    }

    // Fetch current year data
    const currentData = await fetchACSData(2022);

    if (progressCallback) {
      progressCallback({ stage: 'fetching', message: 'Fetching historical ACS data for growth rates...' });
    }

    // Fetch historical data for growth calculations
    const historicalPop = await calculateGrowthRates(2022, 2018);

    if (progressCallback) {
      progressCallback({ stage: 'processing', message: 'Processing county data...' });
    }

    // Process all counties
    const processedCounties = currentData.map(processCountyData);

    if (progressCallback) {
      progressCallback({ stage: 'updating', message: `Updating ${processedCounties.length} counties in database...` });
    }

    // Update database
    const stats = await updateCountyDemographics(processedCounties, historicalPop, progressCallback);
    stats.logId = logId;

    // Log completion
    await logRefresh('census_demographics', 'completed', stats);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const result = {
      success: true,
      duration: `${duration}s`,
      counties_processed: processedCounties.length,
      updated: stats.updated,
      inserted: stats.inserted,
      errors: stats.errors,
      growth_rates_calculated: historicalPop.size
    };

    console.log('Census data refresh complete:', result);
    return result;

  } catch (error) {
    console.error('Census data refresh failed:', error);

    if (logId) {
      await logRefresh('census_demographics', 'failed', { logId }, error.message);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if Census data needs refresh (older than 90 days)
 * @returns {Promise<Object>} { needsRefresh: boolean, daysSinceRefresh: number }
 */
async function checkIfRefreshNeeded() {
  const db = getPoolInstance();
  const REFRESH_INTERVAL_DAYS = 90; // Quarterly check

  try {
    const result = await db.query(`
      SELECT completed_at
      FROM data_refresh_log
      WHERE dataset_name = 'census_demographics' AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return { needsRefresh: true, daysSinceRefresh: null, reason: 'No previous refresh found' };
    }

    const lastRefresh = new Date(result.rows[0].completed_at);
    const daysSinceRefresh = Math.floor((Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24));

    return {
      needsRefresh: daysSinceRefresh >= REFRESH_INTERVAL_DAYS,
      daysSinceRefresh,
      lastRefresh,
      reason: daysSinceRefresh >= REFRESH_INTERVAL_DAYS
        ? `Last refresh was ${daysSinceRefresh} days ago (threshold: ${REFRESH_INTERVAL_DAYS})`
        : `Data is current (${daysSinceRefresh} days old)`
    };
  } catch (error) {
    console.error('[Census] Error checking refresh status:', error.message);
    return { needsRefresh: false, error: error.message };
  }
}

/**
 * Auto-refresh Census data if older than 90 days
 * Called on server startup
 */
async function autoRefreshIfNeeded() {
  console.log('[Census] Checking if quarterly refresh is needed...');

  const check = await checkIfRefreshNeeded();
  console.log(`[Census] ${check.reason}`);

  if (check.needsRefresh) {
    console.log('[Census] Starting automatic quarterly refresh...');
    const result = await refreshCensusData((progress) => {
      if (progress.stage) {
        console.log(`[Census Auto-Refresh] ${progress.stage}: ${progress.message || ''}`);
      }
    });

    if (result.success) {
      console.log(`[Census] Auto-refresh complete: ${result.updated} updated, ${result.inserted} inserted`);
    } else {
      console.error(`[Census] Auto-refresh failed: ${result.error}`);
    }
    return result;
  }

  return { skipped: true, reason: check.reason };
}

/**
 * Get Census data refresh status
 */
async function getCensusRefreshStatus() {
  const db = getPoolInstance();

  try {
    // Get last successful refresh
    const lastRefresh = await db.query(`
      SELECT completed_at, records_updated, records_inserted
      FROM data_refresh_log
      WHERE dataset_name = 'census_demographics' AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    // Get county counts
    const countStats = await db.query(`
      SELECT
        COUNT(*) as total_counties,
        COUNT(median_household_income) as with_income,
        COUNT(growth_rate_85_plus) as with_growth_rate,
        MAX(data_year) as latest_data_year
      FROM county_demographics
    `);

    const stats = countStats.rows[0];

    return {
      dataset: 'census_demographics',
      source: 'US Census Bureau ACS 5-Year Estimates',
      last_refresh: lastRefresh.rows[0]?.completed_at || null,
      coverage: {
        total_counties: parseInt(stats.total_counties),
        with_economic_data: parseInt(stats.with_income),
        with_growth_rates: parseInt(stats.with_growth_rate),
        latest_data_year: stats.latest_data_year
      }
    };
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = {
  refreshCensusData,
  getCensusRefreshStatus,
  checkIfRefreshNeeded,
  autoRefreshIfNeeded,
  fetchACSData,
  calculateGrowthRates
};
