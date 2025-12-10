import fetch from 'node-fetch'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { upsertStateDemographics } from '../database/state-data.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

/**
 * Census Bureau Demographics Collector
 * Collects population data (65+, 85+) for all 50 states
 *
 * API Docs: https://www.census.gov/data/developers/data-sets/popest-popproj.html
 * Dataset: Population Estimates (PEP)
 */

const CENSUS_API_KEY = process.env.CENSUS_API_KEY
const CENSUS_BASE_URL = 'https://api.census.gov/data'
const CURRENT_YEAR = 2021 // Update annually - testing available year

// State FIPS codes mapping
const STATE_CODES = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY'
}

const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'District of Columbia',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois',
  'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana',
  'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
  'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota',
  'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia',
  'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}

/**
 * Fetch population data by age group for all states
 */
async function fetchCensusData() {
  if (!CENSUS_API_KEY) {
    throw new Error('CENSUS_API_KEY environment variable not set')
  }

  console.log(`\n📊 Fetching Census population data for ${CURRENT_YEAR}...\n`)

  // Census ACS API - American Community Survey 5-Year Estimates
  // Get age distribution data for all states
  const url = `${CENSUS_BASE_URL}/${CURRENT_YEAR}/acs/acs5?get=NAME,B01001_001E,B01001_020E,B01001_021E,B01001_022E,B01001_023E,B01001_024E,B01001_025E,B01001_044E,B01001_045E,B01001_046E,B01001_047E,B01001_048E,B01001_049E&for=state:*&key=${CENSUS_API_KEY}`

  console.log(`🌐 API URL: ${url}\n`)

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Census API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // First row is headers
  const headers = data[0]
  const rows = data.slice(1)

  console.log(`✓ Fetched ${rows.length} data points from Census API`)

  return { headers, rows }
}

/**
 * Process Census ACS data and calculate 65+, 85+ populations
 * ACS variables:
 * B01001_001E = Total population
 * B01001_020E-025E = Male 65+ age groups
 * B01001_044E-049E = Female 65+ age groups
 */
function processStateData(censusData) {
  const { headers, rows } = censusData

  // Find column indexes
  const nameIdx = headers.indexOf('NAME')
  const totalPopIdx = headers.indexOf('B01001_001E')
  const stateIdx = headers.indexOf('state')

  const stateData = {}

  for (const row of rows) {
    const stateFips = row[stateIdx]
    const stateCode = STATE_CODES[stateFips]

    if (!stateCode) continue // Skip if not a state (e.g., Puerto Rico)

    const stateName = STATE_NAMES[stateCode]
    const totalPopulation = parseInt(row[totalPopIdx])

    // Sum male 65+ (columns 2-7: ages 65-66, 67-69, 70-74, 75-79, 80-84, 85+)
    const male65_66 = parseInt(row[2]) || 0
    const male67_69 = parseInt(row[3]) || 0
    const male70_74 = parseInt(row[4]) || 0
    const male75_79 = parseInt(row[5]) || 0
    const male80_84 = parseInt(row[6]) || 0
    const male85Plus = parseInt(row[7]) || 0

    // Sum female 65+ (columns 8-13: same age groups)
    const female65_66 = parseInt(row[8]) || 0
    const female67_69 = parseInt(row[9]) || 0
    const female70_74 = parseInt(row[10]) || 0
    const female75_79 = parseInt(row[11]) || 0
    const female80_84 = parseInt(row[12]) || 0
    const female85Plus = parseInt(row[13]) || 0

    const population65Plus = male65_66 + male67_69 + male70_74 + male75_79 + male80_84 + male85Plus +
                             female65_66 + female67_69 + female70_74 + female75_79 + female80_84 + female85Plus

    const population85Plus = male85Plus + female85Plus

    stateData[stateCode] = {
      stateCode,
      stateName,
      totalPopulation,
      population65Plus,
      population85Plus,
      percent65Plus: (population65Plus / totalPopulation * 100).toFixed(2),
      percent85Plus: (population85Plus / totalPopulation * 100).toFixed(2)
    }
  }

  return Object.values(stateData)
}

/**
 * Calculate growth rate based on historical trends
 * Note: This is a simplified calculation. For production, fetch actual projection data
 */
function estimateGrowthProjections(currentData) {
  // Average annual growth rates for senior populations (national averages)
  const GROWTH_RATE_65_PLUS = 2.5 // 2.5% annual growth
  const GROWTH_RATE_85_PLUS = 3.8 // 3.8% annual growth (faster growing segment)
  const YEARS_TO_PROJECT = 5 // Project to 2030 (7 years from 2023)

  return currentData.map(state => ({
    ...state,
    projected65Plus2030: Math.round(state.population65Plus * Math.pow(1 + GROWTH_RATE_65_PLUS / 100, YEARS_TO_PROJECT)),
    projected85Plus2030: Math.round(state.population85Plus * Math.pow(1 + GROWTH_RATE_85_PLUS / 100, YEARS_TO_PROJECT)),
    growthRate65Plus: GROWTH_RATE_65_PLUS,
    growthRate85Plus: GROWTH_RATE_85_PLUS
  }))
}

/**
 * Main collection function
 */
export async function collectCensusDemographics() {
  try {
    console.log('======================================================================')
    console.log('  CENSUS BUREAU DEMOGRAPHICS COLLECTOR')
    console.log('======================================================================')
    console.log(`  Year: ${CURRENT_YEAR}`)
    console.log(`  API Key: ${CENSUS_API_KEY ? 'Set ✓' : 'Missing ✗'}`)
    console.log('======================================================================\n')

    if (!CENSUS_API_KEY) {
      console.error('❌ CENSUS_API_KEY not found in environment variables')
      console.log('\n💡 Get a free API key at: https://api.census.gov/data/key_signup.html\n')
      return
    }

    // Step 1: Fetch data from Census API
    const censusData = await fetchCensusData()

    // Step 2: Process and aggregate by state
    console.log('\n📊 Processing state-level aggregations...')
    const stateData = processStateData(censusData)
    console.log(`✓ Processed ${stateData.length} states\n`)

    // Step 3: Add growth projections
    console.log('📈 Calculating growth projections to 2030...')
    const stateDataWithProjections = estimateGrowthProjections(stateData)
    console.log('✓ Growth projections calculated\n')

    // Step 4: Save to database
    console.log('💾 Saving to database...\n')
    let savedCount = 0
    let errorCount = 0

    for (const state of stateDataWithProjections) {
      try {
        await upsertStateDemographics({
          stateCode: state.stateCode,
          stateName: state.stateName,
          totalPopulation: state.totalPopulation,
          population65Plus: state.population65Plus,
          population85Plus: state.population85Plus,
          percent65Plus: parseFloat(state.percent65Plus),
          percent85Plus: parseFloat(state.percent85Plus),
          projected65Plus2030: state.projected65Plus2030,
          projected85Plus2030: state.projected85Plus2030,
          growthRate65Plus: state.growthRate65Plus,
          growthRate85Plus: state.growthRate85Plus,
          dataSource: 'US Census Bureau Population Estimates',
          dataYear: CURRENT_YEAR
        })

        savedCount++
        console.log(`  ✓ ${state.stateCode}: ${state.stateName}`)
        console.log(`     Population 65+: ${state.population65Plus.toLocaleString()} (${state.percent65Plus}%)`)
        console.log(`     Population 85+: ${state.population85Plus.toLocaleString()} (${state.percent85Plus}%)`)
      } catch (error) {
        errorCount++
        console.error(`  ✗ ${state.stateCode}: ${error.message}`)
        console.error(`     Full error:`, error)
      }
    }

    console.log('\n======================================================================')
    console.log('  COLLECTION SUMMARY')
    console.log('======================================================================')
    console.log(`  Successfully saved: ${savedCount}`)
    console.log(`  Errors: ${errorCount}`)
    console.log('======================================================================\n')

    console.log('✅ Census demographics collection complete!\n')

    return {
      success: true,
      savedCount,
      errorCount,
      states: stateDataWithProjections
    }

  } catch (error) {
    console.error('❌ Error collecting Census demographics:', error)
    throw error
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectCensusDemographics()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export default { collectCensusDemographics }
