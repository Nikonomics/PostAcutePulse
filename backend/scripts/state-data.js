import pool from './db.js'
import cache, { CACHE_TTL, CACHE_KEYS } from '../utils/cache.js'

/**
 * STATE DEMOGRAPHICS FUNCTIONS
 */

/**
 * Get demographic data for a specific state
 */
export async function getStateDemographics(stateCode) {
  const result = await pool.query(
    'SELECT * FROM state_demographics WHERE state_code = $1',
    [stateCode.toUpperCase()]
  )
  return result.rows[0] || null
}

/**
 * Get demographics for all states
 */
export async function getAllStateDemographics() {
  const result = await pool.query(
    'SELECT * FROM state_demographics ORDER BY state_name'
  )
  return result.rows
}

/**
 * Insert or update state demographic data
 */
export async function upsertStateDemographics(demographics) {
  const {
    stateCode,
    stateName,
    totalPopulation,
    population65Plus,
    population85Plus,
    percent65Plus,
    percent85Plus,
    projected65Plus2030,
    projected85Plus2030,
    growthRate65Plus,
    growthRate85Plus,
    dataSource,
    dataYear
  } = demographics

  const result = await pool.query(
    `INSERT INTO state_demographics (
      state_code, state_name, total_population, population_65_plus, population_85_plus,
      percent_65_plus, percent_85_plus, projected_65_plus_2030, projected_85_plus_2030,
      growth_rate_65_plus, growth_rate_85_plus, data_source, data_year
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (state_code) DO UPDATE SET
      state_name = EXCLUDED.state_name,
      total_population = EXCLUDED.total_population,
      population_65_plus = EXCLUDED.population_65_plus,
      population_85_plus = EXCLUDED.population_85_plus,
      percent_65_plus = EXCLUDED.percent_65_plus,
      percent_85_plus = EXCLUDED.percent_85_plus,
      projected_65_plus_2030 = EXCLUDED.projected_65_plus_2030,
      projected_85_plus_2030 = EXCLUDED.projected_85_plus_2030,
      growth_rate_65_plus = EXCLUDED.growth_rate_65_plus,
      growth_rate_85_plus = EXCLUDED.growth_rate_85_plus,
      data_source = EXCLUDED.data_source,
      data_year = EXCLUDED.data_year,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [stateCode, stateName, totalPopulation, population65Plus, population85Plus,
     percent65Plus, percent85Plus, projected65Plus2030, projected85Plus2030,
     growthRate65Plus, growthRate85Plus, dataSource, dataYear]
  )
  return result.rows[0]
}

/**
 * SNF FACILITIES FUNCTIONS
 */

/**
 * Get all facilities for a specific state
 */
export async function getFacilitiesByState(stateCode, options = {}) {
  const {
    active = true,
    minRating = null,
    ownershipType = null,
    chain = null,
    limit = 1000,
    offset = 0
  } = options

  // Join with deficiency summary to get actual deficiency counts from cms_facility_deficiencies
  let query = `
    SELECT
      f.*,
      COALESCE(ds.total_deficiencies, f.health_deficiencies, 0) as total_deficiencies,
      ds.serious_deficiencies,
      ds.uncorrected_deficiencies,
      ds.last_survey_date
    FROM snf_facilities f
    LEFT JOIN facility_deficiency_summary ds ON f.federal_provider_number = ds.federal_provider_number
    WHERE f.state = $1
  `
  const params = [stateCode.toUpperCase()]
  let paramIndex = 2

  if (active !== null) {
    query += ` AND f.active = $${paramIndex}`
    params.push(active)
    paramIndex++
  }

  if (minRating) {
    query += ` AND f.overall_rating >= $${paramIndex}`
    params.push(minRating)
    paramIndex++
  }

  if (ownershipType) {
    query += ` AND f.ownership_type = $${paramIndex}`
    params.push(ownershipType)
    paramIndex++
  }

  if (chain) {
    query += ` AND f.ownership_chain = $${paramIndex}`
    params.push(chain)
    paramIndex++
  }

  query += ` ORDER BY f.facility_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
  params.push(limit, offset)

  const result = await pool.query(query, params)
  return result.rows
}

/**
 * Get a single facility by federal provider number
 */
export async function getFacilityByProviderNumber(providerNumber) {
  const result = await pool.query(
    'SELECT * FROM snf_facilities WHERE federal_provider_number = $1',
    [providerNumber]
  )
  return result.rows[0] || null
}

/**
 * Search facilities by name or organization
 */
export async function searchFacilities(searchTerm, stateCode = null) {
  let query = `
    SELECT * FROM snf_facilities
    WHERE to_tsvector('english',
      COALESCE(facility_name, '') || ' ' || COALESCE(parent_organization, '')
    ) @@ plainto_tsquery('english', $1)
  `
  const params = [searchTerm]

  if (stateCode) {
    query += ' AND state = $2'
    params.push(stateCode.toUpperCase())
  }

  query += ' ORDER BY overall_rating DESC, facility_name LIMIT 50'

  const result = await pool.query(query, params)
  return result.rows
}

/**
 * Get facilities by chain/parent organization
 */
export async function getFacilitiesByChain(chainName, stateCode = null) {
  let query = 'SELECT * FROM snf_facilities WHERE ownership_chain = $1'
  const params = [chainName]

  if (stateCode) {
    query += ' AND state = $2'
    params.push(stateCode.toUpperCase())
  }

  query += ' ORDER BY state, facility_name'

  const result = await pool.query(query, params)
  return result.rows
}

/**
 * Get facilities within a geographic radius (requires lat/long)
 */
export async function getFacilitiesNearLocation(latitude, longitude, radiusMiles = 25) {
  // Using the Haversine formula for distance calculation
  const query = `
    SELECT *,
      (3959 * acos(
        cos(radians($1)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(latitude))
      )) AS distance_miles
    FROM snf_facilities
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND active = true
    HAVING distance_miles <= $3
    ORDER BY distance_miles
    LIMIT 100
  `

  const result = await pool.query(query, [latitude, longitude, radiusMiles])
  return result.rows
}

/**
 * Insert or update facility data
 */
export async function upsertFacility(facility) {
  const {
    federalProviderNumber,
    cmsCertificationNumber,
    facilityName,
    address,
    city,
    state,
    zipCode,
    county,
    phone,
    latitude,
    longitude,
    ownershipType,
    providerType,
    totalBeds,
    certifiedBeds,
    occupiedBeds,
    occupancyRate,
    legalBusinessName,
    parentOrganization,
    ownershipChain,
    multiFacilityChain,
    overallRating,
    healthInspectionRating,
    qualityMeasureRating,
    staffingRating,
    rnStaffingHours,
    totalNurseStaffingHours,
    reportedCnaStaffingHours,
    healthDeficiencies,
    fireSafetyDeficiencies,
    complaintDeficiencies,
    totalPenaltiesAmount,
    penaltyCount,
    acceptsMedicare,
    acceptsMedicaid,
    participatingInQrp,
    specialFocusFacility,
    abuseIcon,
    continuingCareRetirementCommunity,
    averageDailyRate,
    medicareRate,
    medicaidRate,
    active,
    dateCertified,
    dateClosed,
    certificationStatus,
    dataSource,
    lastCmsUpdate
  } = facility

  const result = await pool.query(
    `INSERT INTO snf_facilities (
      federal_provider_number, cms_certification_number, facility_name, address, city, state, zip_code, county, phone,
      latitude, longitude, ownership_type, provider_type, total_beds, certified_beds, occupied_beds, occupancy_rate,
      legal_business_name, parent_organization, ownership_chain, multi_facility_chain,
      overall_rating, health_inspection_rating, quality_measure_rating, staffing_rating,
      rn_staffing_hours, total_nurse_staffing_hours, reported_cna_staffing_hours,
      health_deficiencies, fire_safety_deficiencies, complaint_deficiencies,
      total_penalties_amount, penalty_count,
      accepts_medicare, accepts_medicaid, participating_in_qrp,
      special_focus_facility, abuse_icon, continuing_care_retirement_community,
      average_daily_rate, medicare_rate, medicaid_rate,
      active, date_certified, date_closed, certification_status, data_source, last_cms_update
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
      $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42,
      $43, $44, $45, $46, $47, $48
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
      total_beds = EXCLUDED.total_beds,
      certified_beds = EXCLUDED.certified_beds,
      occupied_beds = EXCLUDED.occupied_beds,
      occupancy_rate = EXCLUDED.occupancy_rate,
      legal_business_name = EXCLUDED.legal_business_name,
      parent_organization = EXCLUDED.parent_organization,
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
      complaint_deficiencies = EXCLUDED.complaint_deficiencies,
      total_penalties_amount = EXCLUDED.total_penalties_amount,
      penalty_count = EXCLUDED.penalty_count,
      accepts_medicare = EXCLUDED.accepts_medicare,
      accepts_medicaid = EXCLUDED.accepts_medicaid,
      participating_in_qrp = EXCLUDED.participating_in_qrp,
      special_focus_facility = EXCLUDED.special_focus_facility,
      abuse_icon = EXCLUDED.abuse_icon,
      continuing_care_retirement_community = EXCLUDED.continuing_care_retirement_community,
      average_daily_rate = EXCLUDED.average_daily_rate,
      medicare_rate = EXCLUDED.medicare_rate,
      medicaid_rate = EXCLUDED.medicaid_rate,
      active = EXCLUDED.active,
      date_certified = EXCLUDED.date_certified,
      date_closed = EXCLUDED.date_closed,
      certification_status = EXCLUDED.certification_status,
      data_source = EXCLUDED.data_source,
      last_cms_update = EXCLUDED.last_cms_update,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      federalProviderNumber, cmsCertificationNumber, facilityName, address, city, state, zipCode, county, phone,
      latitude, longitude, ownershipType, providerType, totalBeds, certifiedBeds, occupiedBeds, occupancyRate,
      legalBusinessName, parentOrganization, ownershipChain, multiFacilityChain,
      overallRating, healthInspectionRating, qualityMeasureRating, staffingRating,
      rnStaffingHours, totalNurseStaffingHours, reportedCnaStaffingHours,
      healthDeficiencies, fireSafetyDeficiencies, complaintDeficiencies,
      totalPenaltiesAmount, penaltyCount,
      acceptsMedicare, acceptsMedicaid, participatingInQrp,
      specialFocusFacility, abuseIcon, continuingCareRetirementCommunity,
      averageDailyRate, medicareRate, medicaidRate,
      active, dateCertified, dateClosed, certificationStatus, dataSource, lastCmsUpdate
    ]
  )
  return result.rows[0]
}

/**
 * STATE MARKET METRICS FUNCTIONS
 */

/**
 * Get market metrics for a specific state
 */
export async function getStateMarketMetrics(stateCode) {
  const result = await pool.query(
    'SELECT * FROM state_market_metrics WHERE state_code = $1',
    [stateCode.toUpperCase()]
  )
  return result.rows[0] || null
}

/**
 * Calculate and update market metrics for a state
 */
export async function calculateStateMarketMetrics(stateCode) {
  const upperStateCode = stateCode.toUpperCase()
  const query = `
    INSERT INTO state_market_metrics (
      state_code,
      total_facilities,
      for_profit_facilities,
      nonprofit_facilities,
      government_facilities,
      chain_owned_facilities,
      independent_facilities,
      total_beds,
      average_beds_per_facility,
      total_occupied_beds,
      average_occupancy_rate,
      avg_overall_rating,
      avg_health_inspection_rating,
      avg_staffing_rating,
      avg_rn_hours,
      avg_total_nurse_hours,
      avg_cna_hours,
      avg_health_deficiencies,
      facilities_with_penalties,
      total_penalties_amount,
      special_focus_facilities,
      facilities_with_abuse_icon,
      calculation_date
    )
    SELECT
      $1::text as state_code,
      COUNT(*) as total_facilities,
      COUNT(*) FILTER (WHERE ownership_type = 'For profit') as for_profit_facilities,
      COUNT(*) FILTER (WHERE ownership_type = 'Non-profit') as nonprofit_facilities,
      COUNT(*) FILTER (WHERE ownership_type = 'Government') as government_facilities,
      COUNT(*) FILTER (WHERE multi_facility_chain = true) as chain_owned_facilities,
      COUNT(*) FILTER (WHERE multi_facility_chain = false) as independent_facilities,
      SUM(total_beds) as total_beds,
      AVG(total_beds) as average_beds_per_facility,
      SUM(occupied_beds) as total_occupied_beds,
      AVG(occupancy_rate) as average_occupancy_rate,
      AVG(overall_rating) as avg_overall_rating,
      AVG(health_inspection_rating) as avg_health_inspection_rating,
      AVG(staffing_rating) as avg_staffing_rating,
      AVG(rn_staffing_hours) as avg_rn_hours,
      AVG(total_nurse_staffing_hours) as avg_total_nurse_hours,
      AVG(reported_cna_staffing_hours) as avg_cna_hours,
      AVG(health_deficiencies) as avg_health_deficiencies,
      COUNT(*) FILTER (WHERE penalty_count > 0) as facilities_with_penalties,
      SUM(total_penalties_amount) as total_penalties_amount,
      COUNT(*) FILTER (WHERE special_focus_facility = true) as special_focus_facilities,
      COUNT(*) FILTER (WHERE abuse_icon = true) as facilities_with_abuse_icon,
      CURRENT_DATE as calculation_date
    FROM snf_facilities
    WHERE state = $1 AND active = true
    ON CONFLICT (state_code) DO UPDATE SET
      total_facilities = EXCLUDED.total_facilities,
      for_profit_facilities = EXCLUDED.for_profit_facilities,
      nonprofit_facilities = EXCLUDED.nonprofit_facilities,
      government_facilities = EXCLUDED.government_facilities,
      chain_owned_facilities = EXCLUDED.chain_owned_facilities,
      independent_facilities = EXCLUDED.independent_facilities,
      total_beds = EXCLUDED.total_beds,
      average_beds_per_facility = EXCLUDED.average_beds_per_facility,
      total_occupied_beds = EXCLUDED.total_occupied_beds,
      average_occupancy_rate = EXCLUDED.average_occupancy_rate,
      avg_overall_rating = EXCLUDED.avg_overall_rating,
      avg_health_inspection_rating = EXCLUDED.avg_health_inspection_rating,
      avg_staffing_rating = EXCLUDED.avg_staffing_rating,
      avg_rn_hours = EXCLUDED.avg_rn_hours,
      avg_total_nurse_hours = EXCLUDED.avg_total_nurse_hours,
      avg_cna_hours = EXCLUDED.avg_cna_hours,
      avg_health_deficiencies = EXCLUDED.avg_health_deficiencies,
      facilities_with_penalties = EXCLUDED.facilities_with_penalties,
      total_penalties_amount = EXCLUDED.total_penalties_amount,
      special_focus_facilities = EXCLUDED.special_focus_facilities,
      facilities_with_abuse_icon = EXCLUDED.facilities_with_abuse_icon,
      calculation_date = EXCLUDED.calculation_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `

  const result = await pool.query(query, [stateCode.toUpperCase()])
  return result.rows[0]
}

/**
 * Get comprehensive state overview (demographics + market + facilities)
 */
export async function getStateOverview(stateCode) {
  const [demographics, metrics, facilities] = await Promise.all([
    getStateDemographics(stateCode),
    getStateMarketMetrics(stateCode),
    getFacilitiesByState(stateCode, { limit: 10, active: true }) // Top 10 for preview
  ])

  return {
    demographics,
    metrics,
    facilitiesPreview: facilities,
    facilitiesCount: metrics?.total_facilities || 0
  }
}

/**
 * UTILITY FUNCTIONS
 */

/**
 * Get facility statistics by ownership type for a state
 */
export async function getFacilityOwnershipBreakdown(stateCode) {
  const result = await pool.query(
    `SELECT
      ownership_type,
      COUNT(*) as count,
      AVG(overall_rating) as avg_rating,
      AVG(occupancy_rate) as avg_occupancy,
      SUM(total_beds) as total_beds
    FROM snf_facilities
    WHERE state = $1 AND active = true
    GROUP BY ownership_type
    ORDER BY count DESC`,
    [stateCode.toUpperCase()]
  )
  return result.rows
}

/**
 * Get top chains by market share in a state
 */
export async function getTopChainsByState(stateCode, limit = 10) {
  const result = await pool.query(
    `SELECT
      ownership_chain,
      COUNT(*) as facility_count,
      SUM(total_beds) as total_beds,
      AVG(overall_rating) as avg_rating,
      ROUND((COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER () * 100), 2) as market_share_pct
    FROM snf_facilities
    WHERE state = $1
      AND active = true
      AND ownership_chain IS NOT NULL
    GROUP BY ownership_chain
    ORDER BY facility_count DESC
    LIMIT $2`,
    [stateCode.toUpperCase(), limit]
  )
  return result.rows
}

/**
 * Advanced facility search with dynamic filters
 * Supports complex queries with multiple filter conditions
 */
export async function searchFacilitiesAdvanced(filters = {}) {
  const {
    states = [],
    counties = [],
    cities = [],
    ownershipTypes = [],
    ownershipChains = [],
    minBeds = null,
    maxBeds = null,
    minOccupancy = null,
    maxOccupancy = null,
    minOverallRating = null,
    maxOverallRating = null,
    minHealthRating = null,
    maxHealthRating = null,
    minStaffingRating = null,
    maxStaffingRating = null,
    maxDeficiencies = null,
    acceptsMedicare = null,
    acceptsMedicaid = null,
    specialFocusFacility = null,
    abuseIcon = null,
    multiFacilityChain = null,
    chainSizeMax = null, // Max number of facilities in chain
    chainSizeMin = null, // Min number of facilities in chain
    searchTerm = null,
    active = true,
    sortBy = 'facility_name',
    sortDirection = 'ASC',
    limit = 1000,
    offset = 0
  } = filters

  const conditions = []
  const params = []
  let paramIndex = 1

  // Active filter
  if (active !== null) {
    conditions.push(`active = $${paramIndex}`)
    params.push(active)
    paramIndex++
  }

  // Location filters
  if (states.length > 0) {
    conditions.push(`state = ANY($${paramIndex})`)
    params.push(states.map(s => s.toUpperCase()))
    paramIndex++
  }

  if (counties.length > 0) {
    conditions.push(`county = ANY($${paramIndex})`)
    params.push(counties)
    paramIndex++
  }

  if (cities.length > 0) {
    conditions.push(`LOWER(city) = ANY($${paramIndex})`)
    params.push(cities.map(c => c.toLowerCase()))
    paramIndex++
  }

  // Ownership filters
  if (ownershipTypes.length > 0) {
    conditions.push(`ownership_type = ANY($${paramIndex})`)
    params.push(ownershipTypes)
    paramIndex++
  }

  if (ownershipChains.length > 0) {
    conditions.push(`ownership_chain = ANY($${paramIndex})`)
    params.push(ownershipChains)
    paramIndex++
  }

  if (multiFacilityChain !== null) {
    conditions.push(`multi_facility_chain = $${paramIndex}`)
    params.push(multiFacilityChain)
    paramIndex++
  }

  // Chain size filters (requires subquery to count facilities per chain)
  if (chainSizeMax !== null || chainSizeMin !== null) {
    let chainSizeCondition = `ownership_chain IN (
      SELECT ownership_chain
      FROM snf_facilities
      WHERE ownership_chain IS NOT NULL
        AND active = true
      GROUP BY ownership_chain`

    const chainSizeFilters = []
    if (chainSizeMin !== null) {
      chainSizeFilters.push(`COUNT(*) >= $${paramIndex}`)
      params.push(chainSizeMin)
      paramIndex++
    }
    if (chainSizeMax !== null) {
      chainSizeFilters.push(`COUNT(*) <= $${paramIndex}`)
      params.push(chainSizeMax)
      paramIndex++
    }

    if (chainSizeFilters.length > 0) {
      chainSizeCondition += ` HAVING ${chainSizeFilters.join(' AND ')}`
    }
    chainSizeCondition += ')'
    conditions.push(chainSizeCondition)
  }

  // Bed size filters
  if (minBeds !== null) {
    conditions.push(`total_beds >= $${paramIndex}`)
    params.push(minBeds)
    paramIndex++
  }

  if (maxBeds !== null) {
    conditions.push(`total_beds <= $${paramIndex}`)
    params.push(maxBeds)
    paramIndex++
  }

  // Occupancy filters
  if (minOccupancy !== null) {
    conditions.push(`occupancy_rate >= $${paramIndex}`)
    params.push(minOccupancy)
    paramIndex++
  }

  if (maxOccupancy !== null) {
    conditions.push(`occupancy_rate <= $${paramIndex}`)
    params.push(maxOccupancy)
    paramIndex++
  }

  // Rating filters
  if (minOverallRating !== null) {
    conditions.push(`overall_rating >= $${paramIndex}`)
    params.push(minOverallRating)
    paramIndex++
  }

  if (maxOverallRating !== null) {
    conditions.push(`overall_rating <= $${paramIndex}`)
    params.push(maxOverallRating)
    paramIndex++
  }

  if (minHealthRating !== null) {
    conditions.push(`health_inspection_rating >= $${paramIndex}`)
    params.push(minHealthRating)
    paramIndex++
  }

  if (maxHealthRating !== null) {
    conditions.push(`health_inspection_rating <= $${paramIndex}`)
    params.push(maxHealthRating)
    paramIndex++
  }

  if (minStaffingRating !== null) {
    conditions.push(`staffing_rating >= $${paramIndex}`)
    params.push(minStaffingRating)
    paramIndex++
  }

  if (maxStaffingRating !== null) {
    conditions.push(`staffing_rating <= $${paramIndex}`)
    params.push(maxStaffingRating)
    paramIndex++
  }

  // Deficiency filter
  if (maxDeficiencies !== null) {
    conditions.push(`health_deficiencies <= $${paramIndex}`)
    params.push(maxDeficiencies)
    paramIndex++
  }

  // Medicare/Medicaid participation
  if (acceptsMedicare !== null) {
    conditions.push(`accepts_medicare = $${paramIndex}`)
    params.push(acceptsMedicare)
    paramIndex++
  }

  if (acceptsMedicaid !== null) {
    conditions.push(`accepts_medicaid = $${paramIndex}`)
    params.push(acceptsMedicaid)
    paramIndex++
  }

  // Special designations
  if (specialFocusFacility !== null) {
    conditions.push(`special_focus_facility = $${paramIndex}`)
    params.push(specialFocusFacility)
    paramIndex++
  }

  if (abuseIcon !== null) {
    conditions.push(`abuse_icon = $${paramIndex}`)
    params.push(abuseIcon)
    paramIndex++
  }

  // Text search
  if (searchTerm) {
    conditions.push(`(
      to_tsvector('english', COALESCE(facility_name, '') || ' ' || COALESCE(parent_organization, ''))
      @@ plainto_tsquery('english', $${paramIndex})
      OR facility_name ILIKE $${paramIndex + 1}
    )`)
    params.push(searchTerm, `%${searchTerm}%`)
    paramIndex += 2
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Validate sort field to prevent SQL injection
  const validSortFields = [
    'facility_name', 'state', 'county', 'city', 'total_beds', 'occupancy_rate',
    'overall_rating', 'health_inspection_rating', 'staffing_rating',
    'health_deficiencies', 'ownership_type', 'ownership_chain'
  ]
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'facility_name'
  const direction = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

  // Main query
  const query = `
    SELECT
      f.*,
      (SELECT COUNT(*) FROM snf_facilities sf
       WHERE sf.ownership_chain = f.ownership_chain
         AND sf.ownership_chain IS NOT NULL
         AND sf.active = true
      ) as chain_facility_count
    FROM snf_facilities f
    ${whereClause}
    ORDER BY ${sortField} ${direction}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `
  params.push(limit, offset)

  // Count query for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM snf_facilities f
    ${whereClause}
  `

  const [facilities, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, params.slice(0, -2)) // Exclude limit and offset for count
  ])

  return {
    facilities: facilities.rows,
    total: parseInt(countResult.rows[0].total),
    limit,
    offset,
    hasMore: offset + facilities.rows.length < parseInt(countResult.rows[0].total)
  }
}

/**
 * Get comprehensive state analysis data combining demographics, market metrics, and national comparisons
 */
export async function getComprehensiveStateAnalysis(stateCode) {
  const upperStateCode = stateCode.toUpperCase()

  // Check cache first
  const cacheKey = CACHE_KEYS.stateAnalysis(upperStateCode)
  const cached = cache.get(cacheKey)
  if (cached) {
    console.log(`✓ Cache hit for state analysis: ${upperStateCode}`)
    return cached
  }

  console.log(`⚡ Cache miss for state analysis: ${upperStateCode} - fetching from database`)

  // Get demographics
  const demographics = await getStateDemographics(upperStateCode)

  // Get market metrics
  const marketMetrics = await getStateMarketMetrics(upperStateCode)

  // Get star rating distributions
  const starDistribution = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE overall_rating = 5) as five_star_count,
      COUNT(*) FILTER (WHERE overall_rating = 1) as one_star_count,
      COUNT(*) as total_facilities
    FROM snf_facilities
    WHERE state = $1 AND active = true`,
    [upperStateCode]
  )

  // Get national averages for comparison
  const nationalAverages = await pool.query(
    `WITH national_totals AS (
      SELECT
        SUM(total_beds) as total_beds,
        AVG(occupancy_rate) as avg_occupancy,
        AVG(overall_rating) as avg_rating,
        AVG(health_deficiencies) as avg_deficiencies,
        AVG(total_beds) as avg_beds_per_facility,
        COUNT(*) FILTER (WHERE multi_facility_chain = true) as chain_facilities,
        COUNT(*) FILTER (WHERE overall_rating = 5) as five_star_facilities,
        COUNT(*) FILTER (WHERE overall_rating = 1) as one_star_facilities,
        COUNT(*) as total_facilities
      FROM snf_facilities
      WHERE active = true
    ),
    pop_totals AS (
      SELECT SUM(population_65_plus) as total_pop_65_plus
      FROM state_demographics
    )
    SELECT
      nt.avg_occupancy as national_avg_occupancy,
      nt.avg_rating as national_avg_rating,
      nt.avg_deficiencies as national_avg_deficiencies,
      nt.avg_beds_per_facility as national_avg_beds_per_facility,
      nt.total_beds::numeric / NULLIF(pt.total_pop_65_plus, 0) * 1000 as national_beds_per_1000_seniors,
      (nt.chain_facilities::numeric / nt.total_facilities * 100) as national_chain_ownership_percent,
      (nt.five_star_facilities::numeric / nt.total_facilities * 100) as national_five_star_percent,
      (nt.one_star_facilities::numeric / nt.total_facilities * 100) as national_one_star_percent
    FROM national_totals nt, pop_totals pt`
  )

  // Get regional averages for comparison
  const regionalAverages = await pool.query(
    `SELECT
      rs.cms_region,
      rs.cms_region_name,
      rs.avg_overall_rating as regional_avg_rating,
      rs.avg_occupancy_rate as regional_avg_occupancy,
      rs.avg_deficiencies as regional_avg_deficiencies,
      rs.beds_per_1000_seniors as regional_beds_per_1000_seniors
    FROM regional_market_stats rs
    JOIN state_demographics sd ON rs.cms_region = sd.cms_region
    WHERE sd.state_code = $1`,
    [upperStateCode]
  )

  // Get biggest operators by facilities
  const biggestByFacilities = await pool.query(
    `SELECT
      ownership_chain as operator_name,
      COUNT(*) as facility_count,
      SUM(total_beds) as total_beds
    FROM snf_facilities
    WHERE state = $1 AND active = true AND ownership_chain IS NOT NULL
    GROUP BY ownership_chain
    ORDER BY facility_count DESC
    LIMIT 1`,
    [upperStateCode]
  )

  // Get biggest operators by beds
  const biggestByBeds = await pool.query(
    `SELECT
      ownership_chain as operator_name,
      COUNT(*) as facility_count,
      SUM(total_beds) as total_beds
    FROM snf_facilities
    WHERE state = $1 AND active = true AND ownership_chain IS NOT NULL
    GROUP BY ownership_chain
    ORDER BY total_beds DESC
    LIMIT 1`,
    [upperStateCode]
  )

  const stats = starDistribution.rows[0]
  const national = nationalAverages.rows[0]
  const regional = regionalAverages.rows[0] || {}
  const topOperatorByFacilities = biggestByFacilities.rows[0] || null
  const topOperatorByBeds = biggestByBeds.rows[0] || null

  // Calculate percentages and comparisons
  const fiveStarPercent = stats.total_facilities > 0
    ? (stats.five_star_count / stats.total_facilities * 100)
    : 0

  const oneStarPercent = stats.total_facilities > 0
    ? (stats.one_star_count / stats.total_facilities * 100)
    : 0

  const chainOwnershipPercent = marketMetrics?.total_facilities > 0
    ? (marketMetrics.chain_owned_facilities / marketMetrics.total_facilities * 100)
    : 0

  // Calculate beds per 1000 seniors
  const bedsPerThousandSeniors = demographics?.population_65_plus > 0 && marketMetrics?.total_beds
    ? (marketMetrics.total_beds / demographics.population_65_plus * 1000)
    : 0

  const result = {
    stateCode: upperStateCode,
    stateName: demographics?.state_name,
    cmsRegion: demographics?.cms_region || null,
    cmsRegionName: demographics?.cms_region_name || null,

    demographics: {
      population65Plus: demographics?.population_65_plus || 0,
      population85Plus: demographics?.population_85_plus || 0,
      percent65Plus: demographics?.percent_65_plus || 0,
      percent85Plus: demographics?.percent_85_plus || 0,
      projected65Plus2030: demographics?.projected_65_plus_2030 || 0,
      projected85Plus2030: demographics?.projected_85_plus_2030 || 0
    },

    quality: {
      avgOverallRating: marketMetrics?.avg_overall_rating || 0,
      avgOverallRatingVsNational: marketMetrics?.avg_overall_rating
        ? ((marketMetrics.avg_overall_rating - national.national_avg_rating) / national.national_avg_rating * 100)
        : 0,
      avgOverallRatingVsRegional: marketMetrics?.avg_overall_rating && regional.regional_avg_rating
        ? ((marketMetrics.avg_overall_rating - regional.regional_avg_rating) / regional.regional_avg_rating * 100)
        : 0,
      nationalAvgRating: parseFloat(national.national_avg_rating) || 0,
      regionalAvgRating: parseFloat(regional.regional_avg_rating) || 0,

      avgDeficiencies: marketMetrics?.avg_health_deficiencies || 0,
      avgDeficienciesVsNational: marketMetrics?.avg_health_deficiencies
        ? ((marketMetrics.avg_health_deficiencies - national.national_avg_deficiencies) / national.national_avg_deficiencies * 100)
        : 0,
      avgDeficienciesVsRegional: marketMetrics?.avg_health_deficiencies && regional.regional_avg_deficiencies
        ? ((marketMetrics.avg_health_deficiencies - regional.regional_avg_deficiencies) / regional.regional_avg_deficiencies * 100)
        : 0,
      nationalAvgDeficiencies: parseFloat(national.national_avg_deficiencies) || 0,
      regionalAvgDeficiencies: parseFloat(regional.regional_avg_deficiencies) || 0,

      fiveStarPercent: fiveStarPercent,
      fiveStarCount: parseInt(stats.five_star_count) || 0,
      nationalFiveStarPercent: parseFloat(national.national_five_star_percent) || 0,

      oneStarPercent: oneStarPercent,
      oneStarCount: parseInt(stats.one_star_count) || 0,
      nationalOneStarPercent: parseFloat(national.national_one_star_percent) || 0,

      avgHealthInspectionRating: marketMetrics?.avg_health_inspection_rating || 0,
      avgStaffingRating: marketMetrics?.avg_staffing_rating || 0
    },

    market: {
      totalFacilities: marketMetrics?.total_facilities || 0,
      totalBeds: marketMetrics?.total_beds || 0,
      avgBedsPerFacility: marketMetrics?.total_facilities > 0
        ? (marketMetrics.total_beds / marketMetrics.total_facilities)
        : 0,
      nationalAvgBedsPerFacility: parseFloat(national.national_avg_beds_per_facility) || 0,
      avgBedsVsNational: marketMetrics?.total_facilities > 0 && national.national_avg_beds_per_facility
        ? (((marketMetrics.total_beds / marketMetrics.total_facilities) - national.national_avg_beds_per_facility) / national.national_avg_beds_per_facility * 100)
        : 0,

      avgOccupancyRate: marketMetrics?.average_occupancy_rate || 0,
      avgOccupancyVsNational: marketMetrics?.average_occupancy_rate
        ? ((marketMetrics.average_occupancy_rate - national.national_avg_occupancy) / national.national_avg_occupancy * 100)
        : 0,
      avgOccupancyVsRegional: marketMetrics?.average_occupancy_rate && regional.regional_avg_occupancy
        ? ((marketMetrics.average_occupancy_rate - regional.regional_avg_occupancy) / regional.regional_avg_occupancy * 100)
        : 0,
      nationalAvgOccupancy: parseFloat(national.national_avg_occupancy) || 0,
      regionalAvgOccupancy: parseFloat(regional.regional_avg_occupancy) || 0,

      bedsPerThousandSeniors: bedsPerThousandSeniors,
      bedsPerThousandSeniorsVsNational: bedsPerThousandSeniors && national.national_beds_per_1000_seniors
        ? ((bedsPerThousandSeniors - national.national_beds_per_1000_seniors) / national.national_beds_per_1000_seniors * 100)
        : 0,
      bedsPerThousandSeniorsVsRegional: bedsPerThousandSeniors && regional.regional_beds_per_1000_seniors
        ? ((bedsPerThousandSeniors - regional.regional_beds_per_1000_seniors) / regional.regional_beds_per_1000_seniors * 100)
        : 0,
      nationalBedsPerThousandSeniors: parseFloat(national.national_beds_per_1000_seniors) || 0,
      regionalBedsPerThousandSeniors: parseFloat(regional.regional_beds_per_1000_seniors) || 0,

      chainOwnershipPercent: chainOwnershipPercent,
      chainOwnershipPercentVsNational: chainOwnershipPercent && national.national_chain_ownership_percent
        ? ((chainOwnershipPercent - national.national_chain_ownership_percent) / national.national_chain_ownership_percent * 100)
        : 0,
      nationalChainOwnershipPercent: parseFloat(national.national_chain_ownership_percent) || 0,
      chainOwnedFacilities: marketMetrics?.chain_owned_facilities || 0,
      independentFacilities: marketMetrics?.independent_facilities || 0,

      topOperatorByFacilities: topOperatorByFacilities ? {
        name: topOperatorByFacilities.operator_name,
        facilityCount: parseInt(topOperatorByFacilities.facility_count),
        totalBeds: parseInt(topOperatorByFacilities.total_beds)
      } : null,

      topOperatorByBeds: topOperatorByBeds ? {
        name: topOperatorByBeds.operator_name,
        facilityCount: parseInt(topOperatorByBeds.facility_count),
        totalBeds: parseInt(topOperatorByBeds.total_beds)
      } : null,

      forProfitFacilities: marketMetrics?.for_profit_facilities || 0,
      nonprofitFacilities: marketMetrics?.nonprofit_facilities || 0,
      governmentFacilities: marketMetrics?.government_facilities || 0
    },

    staffing: {
      avgRnHours: marketMetrics?.avg_rn_hours || 0,
      avgTotalNurseHours: marketMetrics?.avg_total_nurse_hours || 0,
      avgCnaHours: marketMetrics?.avg_cna_hours || 0
    },

    compliance: {
      facilitiesWithPenalties: marketMetrics?.facilities_with_penalties || 0,
      totalPenaltiesAmount: marketMetrics?.total_penalties_amount || 0,
      specialFocusFacilities: marketMetrics?.special_focus_facilities || 0,
      facilitiesWithAbuseIcon: marketMetrics?.facilities_with_abuse_icon || 0
    }
  }

  // Cache the result before returning
  cache.set(cacheKey, result, CACHE_TTL.STATE_ANALYSIS)
  console.log(`✓ Cached state analysis for: ${upperStateCode} (TTL: 6 hours)`)

  return result
}

/**
 * Get all states with key metrics for comparison map
 */
export async function getAllStatesComparison(metric = 'overall') {
  const result = await pool.query(
    `SELECT
      sd.state_code,
      sd.state_name,
      sd.population_65_plus,
      sd.population_85_plus,
      smm.avg_overall_rating,
      smm.average_occupancy_rate,
      smm.total_facilities,
      smm.total_beds,
      smm.avg_health_deficiencies,
      smm.chain_owned_facilities,
      smm.total_facilities as total_fac,
      CASE
        WHEN sd.population_65_plus > 0
        THEN ROUND((smm.total_beds::numeric / sd.population_65_plus * 1000)::numeric, 2)
        ELSE 0
      END as beds_per_1000_seniors,
      ROUND((smm.chain_owned_facilities::numeric / NULLIF(smm.total_facilities, 0) * 100)::numeric, 1) as chain_ownership_percent
    FROM state_demographics sd
    LEFT JOIN state_market_metrics smm ON sd.state_code = smm.state_code
    ORDER BY sd.state_name`
  )
  return result.rows
}

/**
 * Get state rankings for various metrics
 */
export async function getStateRankings() {
  const result = await pool.query(
    `WITH state_data AS (
      SELECT
        sd.state_code,
        sd.state_name,
        sd.population_65_plus,
        smm.avg_overall_rating,
        smm.average_occupancy_rate,
        smm.total_facilities,
        smm.avg_health_deficiencies,
        CASE
          WHEN sd.population_65_plus > 0
          THEN (smm.total_beds::numeric / sd.population_65_plus * 1000)
          ELSE 0
        END as beds_per_1000_seniors
      FROM state_demographics sd
      LEFT JOIN state_market_metrics smm ON sd.state_code = smm.state_code
    ),
    rankings AS (
      SELECT
        state_code,
        state_name,
        avg_overall_rating,
        average_occupancy_rate,
        total_facilities,
        avg_health_deficiencies,
        beds_per_1000_seniors,
        RANK() OVER (ORDER BY avg_overall_rating DESC NULLS LAST) as quality_rank,
        RANK() OVER (ORDER BY avg_health_deficiencies ASC NULLS LAST) as deficiency_rank,
        RANK() OVER (ORDER BY average_occupancy_rate DESC NULLS LAST) as occupancy_rank,
        RANK() OVER (ORDER BY beds_per_1000_seniors DESC NULLS LAST) as capacity_rank
      FROM state_data
    )
    SELECT * FROM rankings ORDER BY quality_rank`
  )
  return result.rows
}

export default {
  // Demographics
  getStateDemographics,
  getAllStateDemographics,
  upsertStateDemographics,

  // Facilities
  getFacilitiesByState,
  getFacilityByProviderNumber,
  searchFacilities,
  getFacilitiesByChain,
  getFacilitiesNearLocation,
  upsertFacility,

  // Market Metrics
  getStateMarketMetrics,
  calculateStateMarketMetrics,
  getStateOverview,
  getComprehensiveStateAnalysis,
  getAllStatesComparison,
  getStateRankings,

  // Utilities
  getFacilityOwnershipBreakdown,
  getTopChainsByState
}

/**
 * CACHE MANAGEMENT FUNCTIONS
 */

/**
 * Clear all state analysis caches (call this when data is refreshed)
 */
export function clearStateAnalysisCache() {
  cache.clearPattern('state:*')
  cache.delete(CACHE_KEYS.nationalAverages())
  cache.clearPattern('regional:*')
  cache.delete(CACHE_KEYS.stateRankings())
  console.log('✓ Cleared all state analysis caches')
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cache.getStats()
}

/**
 * COUNTY DEMOGRAPHICS FUNCTIONS
 */

/**
 * Get demographic data for a specific county
 */
export async function getCountyDemographics(countyFips) {
  const result = await pool.query(
    'SELECT * FROM county_demographics WHERE county_fips = $1',
    [countyFips]
  )
  return result.rows[0] || null
}

/**
 * Get demographics for all counties in a state
 */
export async function getCountiesByState(stateCode) {
  const result = await pool.query(
    'SELECT * FROM county_demographics WHERE state_code = $1 ORDER BY county_name',
    [stateCode.toUpperCase()]
  )
  return result.rows
}

/**
 * Get demographics for all counties
 */
export async function getAllCountyDemographics() {
  const result = await pool.query(
    'SELECT * FROM county_demographics ORDER BY state_code, county_name'
  )
  return result.rows
}

/**
 * Insert or update county demographic data
 */
export async function upsertCountyDemographics(demographics) {
  const {
    stateCode,
    stateName,
    countyFips,
    countyName,
    totalPopulation,
    population65Plus,
    population85Plus,
    percent65Plus,
    percent85Plus,
    projected65Plus2030,
    projected85Plus2030,
    growthRate65Plus,
    growthRate85Plus,
    dataSource,
    dataYear
  } = demographics

  const result = await pool.query(
    `INSERT INTO county_demographics (
      state_code, state_name, county_fips, county_name, total_population, population_65_plus, population_85_plus,
      percent_65_plus, percent_85_plus, projected_65_plus_2030, projected_85_plus_2030,
      growth_rate_65_plus, growth_rate_85_plus, data_source, data_year
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (county_fips) DO UPDATE SET
      state_code = EXCLUDED.state_code,
      state_name = EXCLUDED.state_name,
      county_name = EXCLUDED.county_name,
      total_population = EXCLUDED.total_population,
      population_65_plus = EXCLUDED.population_65_plus,
      population_85_plus = EXCLUDED.population_85_plus,
      percent_65_plus = EXCLUDED.percent_65_plus,
      percent_85_plus = EXCLUDED.percent_85_plus,
      projected_65_plus_2030 = EXCLUDED.projected_65_plus_2030,
      projected_85_plus_2030 = EXCLUDED.projected_85_plus_2030,
      growth_rate_65_plus = EXCLUDED.growth_rate_65_plus,
      growth_rate_85_plus = EXCLUDED.growth_rate_85_plus,
      data_source = EXCLUDED.data_source,
      data_year = EXCLUDED.data_year,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      stateCode, stateName, countyFips, countyName, totalPopulation, population65Plus, population85Plus,
      percent65Plus, percent85Plus, projected65Plus2030, projected85Plus2030,
      growthRate65Plus, growthRate85Plus, dataSource, dataYear
    ]
  )

  return result.rows[0]
}

/**
 * COUNTY-BASED FACILITY QUERIES
 */

/**
 * Get facilities by county
 */
export async function getFacilitiesByCounty(stateCode, countyName) {
  const result = await pool.query(
    `SELECT * FROM snf_facilities
     WHERE state = $1 AND county = $2 AND active = true
     ORDER BY facility_name`,
    [stateCode.toUpperCase(), countyName]
  )
  return result.rows
}

/**
 * Get facilities by county FIPS code
 */
export async function getFacilitiesByCountyFips(countyFips) {
  const result = await pool.query(
    `SELECT * FROM snf_facilities
     WHERE county_fips = $1 AND active = true
     ORDER BY facility_name`,
    [countyFips]
  )
  return result.rows
}

/**
 * Get facility summary for a county with demographics
 */
export async function getCountyFacilitySummary(countyFips) {
  const result = await pool.query(
    'SELECT * FROM county_facility_summary WHERE county_fips = $1',
    [countyFips]
  )
  return result.rows[0] || null
}

/**
 * Get all county facility summaries for a state
 */
export async function getStateCountyFacilitySummaries(stateCode) {
  const result = await pool.query(
    `SELECT * FROM county_facility_summary
     WHERE state_code = $1
     ORDER BY county_name`,
    [stateCode.toUpperCase()]
  )
  return result.rows
}

/**
 * Get facilities with enriched county demographic data
 */
export async function getFacilitiesWithCountyDemographics(stateCode = null, limit = 100) {
  let query = `SELECT * FROM facilities_with_county_demographics WHERE active = true`
  const params = []

  if (stateCode) {
    query += ` AND state = $1`
    params.push(stateCode.toUpperCase())
  }

  query += ` ORDER BY facility_name LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await pool.query(query, params)
  return result.rows
}
