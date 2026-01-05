/**
 * Pennant Intelligence API Routes
 *
 * Provides detailed analytics endpoints for The Pennant Group's portfolio
 * across ALF (Assisted Living) and HHA (Home Health Agency) segments.
 *
 * Database Strategy:
 * - Market DB (getMarketPool / MARKET_DATABASE_URL):
 *   alf_facilities, ownership_profiles, ownership_subsidiaries, hh_provider_snapshots
 *
 * Data Sources:
 * - ALF: 62 Pennant facilities in alf_facilities where licensee ILIKE '%pennant%'
 * - HHA: ~63 actual agencies in hh_provider_snapshots matched via DBA names
 * - Subsidiaries: 40 parent companies in ownership_subsidiaries
 * - Profile: ownership_profiles WHERE parent_organization = 'THE PENNANT GROUP'
 */

const express = require('express');
const router = express.Router();
const { getMarketPool } = require('../config/database');
const clusterService = require('../services/pennantClusterService');
const hospiceMarketScoringService = require('../services/hospiceMarketScoringService');

// Use Market DB for all Pennant queries
const getPoolInstance = () => {
  return getMarketPool();
};

// Simple in-memory cache for expensive queries (1 hour TTL)
// Pennant data sources (CMS snapshots, ownership profiles) update monthly at most
const cache = {
  data: {},
  ttl: 60 * 60 * 1000, // 1 hour
  get(key) {
    const item = this.data[key];
    if (!item) return null;
    if (Date.now() > item.expires) {
      delete this.data[key];
      return null;
    }
    return item.value;
  },
  set(key, value) {
    this.data[key] = { value, expires: Date.now() + this.ttl };
  }
};

/**
 * Helper function to get actual Pennant HHA agencies from hh_provider_snapshots
 * Matches by DBA names and subsidiary names with normalized matching
 * Uses caching to avoid expensive repeated queries
 * @param {Object} pool - Database connection pool
 * @param {string} stateFilter - Optional state filter
 * @returns {Promise<Array>} Array of HHA agency records
 */
async function getPennantHHAAgencies(pool, stateFilter = null) {
  const cacheKey = `hha_agencies_${stateFilter || 'all'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[Pennant] Using cached HHA agencies');
    return cached;
  }

  let query = `
    WITH pennant_dba AS (
      SELECT DISTINCT
        UPPER(TRIM(UNNEST(dba_names))) as dba_name,
        -- Normalized version without punctuation
        REGEXP_REPLACE(UPPER(TRIM(UNNEST(dba_names))), '[^A-Z0-9 ]', '', 'g') as dba_normalized
      FROM ownership_subsidiaries
      WHERE parent_canonical_name = 'THE PENNANT GROUP'
    ),
    pennant_states AS (
      SELECT UNNEST(all_states) as state
      FROM ownership_profiles
      WHERE parent_organization = 'THE PENNANT GROUP'
    )
    SELECT
      h.ccn,
      h.provider_name,
      h.address,
      h.city,
      h.state,
      h.zip_code,
      h.telephone,
      h.latitude,
      h.longitude,
      h.quality_star_rating,
      h.episode_count,
      h.cbsa_code,
      h.county_fips,
      c.cbsa_title as cbsa_name
    FROM hh_provider_snapshots h
    LEFT JOIN cbsas c ON h.cbsa_code = c.cbsa_code
    WHERE h.extract_id = 1
      AND h.state IN (SELECT state FROM pennant_states)
      AND EXISTS (
        SELECT 1 FROM pennant_dba pd
        WHERE UPPER(TRIM(h.provider_name)) = pd.dba_name
           OR UPPER(TRIM(h.provider_name)) LIKE pd.dba_name || ' LLC'
           OR UPPER(TRIM(h.provider_name)) LIKE pd.dba_name || ' INC'
           OR UPPER(TRIM(h.provider_name)) LIKE pd.dba_name || ' AGENCY'
           OR REGEXP_REPLACE(UPPER(TRIM(h.provider_name)), '[^A-Z0-9 ]', '', 'g') = pd.dba_normalized
           OR REGEXP_REPLACE(UPPER(TRIM(h.provider_name)), '[^A-Z0-9 ]', '', 'g') LIKE pd.dba_normalized || ' %'
      )
  `;

  const params = [];
  if (stateFilter) {
    query += ` AND h.state = $1`;
    params.push(stateFilter.toUpperCase());
  }

  query += ` ORDER BY h.state, h.provider_name`;

  console.log('[Pennant] Fetching HHA agencies from database...');
  const result = await pool.query(query, params);
  cache.set(cacheKey, result.rows);
  console.log(`[Pennant] Cached ${result.rows.length} HHA agencies`);
  return result.rows;
}

/**
 * Helper function to get Pennant hospice agencies from hospice_owners
 * Links to HHA enrollment data for location information where available
 * Falls back to hospice_providers for location data when no HHA match
 * Uses caching to avoid expensive repeated queries
 * @param {Object} pool - Database connection pool
 * @param {string} stateFilter - Optional state filter
 * @returns {Promise<Array>} Array of hospice agency records
 */
async function getPennantHospiceAgencies(pool, stateFilter = null) {
  const cacheKey = `hospice_agencies_${stateFilter || 'all'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[Pennant] Using cached hospice agencies');
    return cached;
  }

  // Get Pennant hospice subsidiaries from hospice_owners
  // Primary: Link to HHA enrollments and hh_provider_snapshots for location data (with lat/lng)
  // Fallback: Link to hospice_providers for location data (city/state only, no lat/lng)
  let query = `
    WITH pennant_hospice_subs AS (
      SELECT DISTINCT
        organization_name as subsidiary_name
      FROM hospice_owners
      WHERE organization_name_owner IN ('THE PENNANT GROUP INC', 'CORNERSTONE HEALTHCARE INC')
        AND type_owner = 'O'
        AND extract_id = (SELECT MAX(extract_id) FROM hospice_owners)
    ),
    hha_locations AS (
      SELECT DISTINCT ON (he.organization_name)
        he.organization_name,
        he.ccn as hha_ccn,
        he.city,
        he.state,
        he.zip_code,
        hp.latitude,
        hp.longitude,
        hp.cbsa_code,
        c.cbsa_title as cbsa_name
      FROM hha_enrollments he
      JOIN hh_provider_snapshots hp ON hp.ccn = he.ccn AND hp.extract_id = 1
      LEFT JOIN cbsas c ON hp.cbsa_code = c.cbsa_code
      WHERE he.extract_id = (SELECT MAX(extract_id) FROM hha_enrollments)
      ORDER BY he.organization_name, he.ccn
    ),
    -- Fallback: Match to hospice_providers by brand name pattern
    hospice_provider_locations AS (
      SELECT DISTINCT ON (phs.subsidiary_name)
        phs.subsidiary_name,
        hp.ccn as hospice_ccn,
        hp.facility_name as hospice_name_cms,
        hp.city,
        hp.state,
        hp.zip_code
      FROM pennant_hospice_subs phs
      JOIN hospice_providers hp ON
        hp.extract_id = (SELECT MAX(extract_id) FROM hospice_providers)
        AND (
          -- Match by core brand name (e.g., EMBLEM HEALTHCARE -> EMBLEM HOSPICE)
          UPPER(hp.facility_name) LIKE '%' || UPPER(SPLIT_PART(SPLIT_PART(phs.subsidiary_name, ' HEALTHCARE', 1), ',', 1)) || '%'
          OR UPPER(hp.facility_name) LIKE '%' || UPPER(REPLACE(REPLACE(phs.subsidiary_name, ' HEALTHCARE, INC.', ''), ' HEALTHCARE INC', '')) || '%HOSPICE%'
        )
      ORDER BY phs.subsidiary_name, hp.ccn
    )
    SELECT
      phs.subsidiary_name as hospice_name,
      COALESCE(hl.city, hpl.city, 'Unknown') as city,
      COALESCE(hl.state, hpl.state, 'XX') as state,
      COALESCE(hl.zip_code, hpl.zip_code) as zip_code,
      hl.latitude,
      hl.longitude,
      hl.cbsa_code,
      hl.cbsa_name,
      hl.hha_ccn,
      hpl.hospice_ccn,
      hpl.hospice_name_cms,
      CASE
        WHEN hl.hha_ccn IS NOT NULL THEN 'hha'
        WHEN hpl.hospice_ccn IS NOT NULL THEN 'hospice_provider'
        ELSE 'none'
      END as location_source
    FROM pennant_hospice_subs phs
    LEFT JOIN hha_locations hl ON UPPER(hl.organization_name) = UPPER(phs.subsidiary_name)
    LEFT JOIN hospice_provider_locations hpl ON UPPER(hpl.subsidiary_name) = UPPER(phs.subsidiary_name)
  `;

  const params = [];
  if (stateFilter) {
    query += ` WHERE COALESCE(hl.state, hpl.state, '') = $1 OR (hl.state IS NULL AND hpl.state IS NULL AND $1 = 'XX')`;
    params.push(stateFilter.toUpperCase());
  }

  query += ` ORDER BY phs.subsidiary_name`;

  console.log('[Pennant] Fetching hospice agencies from database...');
  const result = await pool.query(query, params);
  cache.set(cacheKey, result.rows);
  console.log(`[Pennant] Cached ${result.rows.length} hospice agencies`);
  return result.rows;
}

/**
 * GET /api/v1/pennant/overview
 * Return high-level summary of Pennant's portfolio
 * @returns {Object} ALF count, ALF capacity, HHA agency count (actual), hospice agency count, states covered
 */
router.get('/overview', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'pennant_overview';
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached overview');
      return res.json({ success: true, data: cached });
    }

    const pool = getPoolInstance();

    // Get profile data from ownership_profiles
    const profileResult = await pool.query(`
      SELECT
        parent_organization,
        has_snf, has_alf, has_hha, has_hospice,
        care_types,
        is_diversified,
        alf_facility_count,
        alf_total_capacity,
        alf_states,
        hha_subsidiary_count,
        hha_agency_count,
        hha_states,
        hha_dba_brands,
        total_locations,
        total_states_operated,
        all_states,
        pe_backed,
        pe_investors,
        updated_at
      FROM ownership_profiles
      WHERE parent_organization = 'THE PENNANT GROUP'
    `);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pennant Group profile not found'
      });
    }

    const profile = profileResult.rows[0];

    // Get live ALF counts from alf_facilities
    const alfLiveResult = await pool.query(`
      SELECT
        COUNT(*) as facility_count,
        SUM(COALESCE(capacity, 0)) as total_capacity,
        COUNT(DISTINCT state) as state_count,
        ARRAY_AGG(DISTINCT state ORDER BY state) as states
      FROM alf_facilities
      WHERE licensee ILIKE '%pennant%'
    `);
    const alfLive = alfLiveResult.rows[0];

    // Get subsidiary count from ownership_subsidiaries
    const subsidiaryResult = await pool.query(`
      SELECT COUNT(*) as subsidiary_count
      FROM ownership_subsidiaries
      WHERE parent_canonical_name = 'THE PENNANT GROUP'
    `);
    const subsidiaryCount = parseInt(subsidiaryResult.rows[0].subsidiary_count) || 0;

    // Get actual HHA agency count from hh_provider_snapshots
    const hhaAgencies = await getPennantHHAAgencies(pool);
    const hhaAgencyCount = hhaAgencies.length;
    const hhaStates = [...new Set(hhaAgencies.map(a => a.state))].sort();

    // Get hospice agency count from hospice_owners
    const hospiceAgencies = await getPennantHospiceAgencies(pool);
    const hospiceAgencyCount = hospiceAgencies.length;
    const hospiceStates = [...new Set(hospiceAgencies.filter(a => a.state && a.state !== 'XX').map(a => a.state))].sort();
    const hospiceWithLocation = hospiceAgencies.filter(a => a.location_source !== 'none').length;
    const hospiceWithCoords = hospiceAgencies.filter(a => a.location_source === 'hha').length;

    // Combine all states
    const allStates = [...new Set([
      ...(alfLive.states || []),
      ...hhaStates,
      ...hospiceStates
    ])].sort();

    const responseData = {
      organization: 'THE PENNANT GROUP',
      profile: {
        has_snf: profile.has_snf,
        has_alf: profile.has_alf,
        has_hha: profile.has_hha,
        has_hospice: profile.has_hospice,
        care_types: profile.care_types,
        is_diversified: profile.is_diversified,
        pe_backed: profile.pe_backed,
        pe_investors: profile.pe_investors,
        last_updated: profile.updated_at
      },
      alf: {
        facility_count: parseInt(alfLive.facility_count) || 0,
        total_capacity: parseInt(alfLive.total_capacity) || 0,
        state_count: parseInt(alfLive.state_count) || 0,
        states: alfLive.states || []
      },
      hha: {
        subsidiary_count: subsidiaryCount,
        agency_count: hhaAgencyCount,
        state_count: hhaStates.length,
        states: hhaStates,
        dba_brands: profile.hha_dba_brands || []
      },
      hospice: {
        agency_count: hospiceAgencyCount,
        state_count: hospiceStates.length,
        states: hospiceStates,
        with_location_data: hospiceWithLocation,
        with_coordinates: hospiceWithCoords
      },
      totals: {
        total_locations: (parseInt(alfLive.facility_count) || 0) + hhaAgencyCount + hospiceAgencyCount,
        all_states: allStates,
        total_states_operated: allStates.length
      }
    };

    cache.set(cacheKey, responseData);
    console.log('[Pennant] Cached overview');
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Pennant Routes] overview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/locations
 * Return all Pennant locations (ALF + HHA + Hospice) with optional filtering
 * @query {string} type - Filter by type: 'alf', 'hha', 'hospice', or 'all' (default 'all')
 * @query {string} state - Filter by state code (e.g., 'CA', 'TX')
 */
router.get('/locations', async (req, res) => {
  try {
    const { type = 'all', state } = req.query;
    const pool = getPoolInstance();

    const locations = [];

    // Get ALF locations
    if (type === 'all' || type === 'alf') {
      let alfQuery = `
        SELECT
          af.id,
          af.facility_name as name,
          'alf' as type,
          af.city,
          af.state,
          af.address,
          af.zip_code,
          af.county,
          af.latitude,
          af.longitude,
          af.capacity,
          af.cbsa_code,
          c.cbsa_title as cbsa_name,
          af.licensee
        FROM alf_facilities af
        LEFT JOIN cbsas c ON af.cbsa_code = c.cbsa_code
        WHERE af.licensee ILIKE '%pennant%'
      `;
      const alfParams = [];

      if (state) {
        alfQuery += ` AND af.state = $1`;
        alfParams.push(state.toUpperCase());
      }

      alfQuery += ` ORDER BY af.state, af.city`;

      const alfResult = await pool.query(alfQuery, alfParams);
      locations.push(...alfResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: 'alf',
        segment: 'ALF',
        city: row.city,
        state: row.state,
        address: row.address,
        zip_code: row.zip_code,
        county: row.county,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        capacity: parseInt(row.capacity) || null,
        cbsa_code: row.cbsa_code,
        cbsa_name: row.cbsa_name,
        quality_star_rating: null,
        episode_count: null,
        ccn: null
      })));
    }

    // Get HHA locations (actual agencies from hh_provider_snapshots)
    if (type === 'all' || type === 'hha') {
      const hhaAgencies = await getPennantHHAAgencies(pool, state);

      locations.push(...hhaAgencies.map(row => ({
        id: row.ccn, // Use CCN as ID for HHA
        name: row.provider_name,
        type: 'hha',
        segment: 'HHA',
        city: row.city,
        state: row.state,
        address: row.address,
        zip_code: row.zip_code,
        county: null, // HHA doesn't have county in our data
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        capacity: null,
        cbsa_code: row.cbsa_code,
        cbsa_name: row.cbsa_name,
        quality_star_rating: row.quality_star_rating ? parseFloat(row.quality_star_rating) : null,
        episode_count: row.episode_count ? parseInt(row.episode_count) : null,
        ccn: row.ccn
      })));
    }

    // Get Hospice locations
    if (type === 'all' || type === 'hospice') {
      const hospiceAgencies = await getPennantHospiceAgencies(pool, state);

      locations.push(...hospiceAgencies.map((row, index) => ({
        id: `hospice_${index}`, // Generate ID since hospice doesn't have CCN
        name: row.hospice_name,
        type: 'hospice',
        segment: 'Hospice',
        city: row.city,
        state: row.state !== 'XX' ? row.state : null,
        address: null,
        zip_code: row.zip_code,
        county: null,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        capacity: null,
        cbsa_code: row.cbsa_code,
        cbsa_name: row.cbsa_name,
        quality_star_rating: null,
        episode_count: null,
        ccn: row.hospice_ccn || null,
        location_source: row.location_source,
        has_location_data: row.location_source !== 'none',
        has_coordinates: row.location_source === 'hha'
      })));
    }

    res.json({
      success: true,
      data: {
        total: locations.length,
        alf_count: locations.filter(l => l.type === 'alf').length,
        hha_count: locations.filter(l => l.type === 'hha').length,
        hospice_count: locations.filter(l => l.type === 'hospice').length,
        filters: { type, state: state || null },
        locations
      }
    });
  } catch (error) {
    console.error('[Pennant Routes] locations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/locations/geojson
 * Return Pennant locations as GeoJSON FeatureCollection for map rendering
 * Includes ALF, HHA, and Hospice agencies with coordinates
 * @query {string} state - Filter by state code (e.g., 'CA', 'TX')
 * @query {string} type - Filter by type: 'alf', 'hha', 'hospice', or 'all' (default 'all')
 */
router.get('/locations/geojson', async (req, res) => {
  try {
    const { state, type = 'all' } = req.query;
    const pool = getPoolInstance();

    const features = [];

    // Get ALF locations with coordinates
    if (type === 'all' || type === 'alf') {
      let alfQuery = `
        SELECT
          af.id,
          af.facility_name as name,
          af.city,
          af.state,
          af.address,
          af.zip_code,
          af.county,
          af.latitude,
          af.longitude,
          af.capacity,
          af.cbsa_code,
          c.cbsa_title as cbsa_name
        FROM alf_facilities af
        LEFT JOIN cbsas c ON af.cbsa_code = c.cbsa_code
        WHERE af.licensee ILIKE '%pennant%'
          AND af.latitude IS NOT NULL
          AND af.longitude IS NOT NULL
      `;
      const alfParams = [];

      if (state) {
        alfQuery += ` AND af.state = $1`;
        alfParams.push(state.toUpperCase());
      }

      alfQuery += ` ORDER BY af.state, af.city`;

      const alfResult = await pool.query(alfQuery, alfParams);

      features.push(...alfResult.rows.map(row => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
        },
        properties: {
          id: row.id,
          name: row.name,
          type: 'alf',
          city: row.city,
          state: row.state,
          address: row.address,
          zip_code: row.zip_code,
          county: row.county,
          capacity: row.capacity,
          cbsa_code: row.cbsa_code,
          cbsa_name: row.cbsa_name,
          quality_star_rating: null,
          episode_count: null,
          ccn: null
        }
      })));
    }

    // Get HHA locations with coordinates
    if (type === 'all' || type === 'hha') {
      const hhaAgencies = await getPennantHHAAgencies(pool, state);

      // Only include agencies with valid coordinates
      const hhaWithCoords = hhaAgencies.filter(a => a.latitude && a.longitude);

      features.push(...hhaWithCoords.map(row => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
        },
        properties: {
          id: row.ccn,
          name: row.provider_name,
          type: 'hha',
          city: row.city,
          state: row.state,
          address: row.address,
          zip_code: row.zip_code,
          county: null,
          capacity: null,
          cbsa_code: row.cbsa_code,
          cbsa_name: row.cbsa_name,
          quality_star_rating: row.quality_star_rating ? parseFloat(row.quality_star_rating) : null,
          episode_count: row.episode_count ? parseInt(row.episode_count) : null,
          ccn: row.ccn
        }
      })));
    }

    // Get Hospice locations with coordinates
    if (type === 'all' || type === 'hospice') {
      const hospiceAgencies = await getPennantHospiceAgencies(pool, state);

      // Only include agencies with valid coordinates (from linked HHA data)
      const hospiceWithCoords = hospiceAgencies.filter(a => a.latitude && a.longitude);

      features.push(...hospiceWithCoords.map((row, index) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
        },
        properties: {
          id: `hospice_${index}`,
          name: row.hospice_name,
          type: 'hospice',
          city: row.city,
          state: row.state,
          address: null,
          zip_code: row.zip_code,
          county: null,
          capacity: null,
          cbsa_code: row.cbsa_code,
          cbsa_name: row.cbsa_name,
          quality_star_rating: null,
          episode_count: null,
          ccn: null
        }
      })));
    }

    const alfCount = features.filter(f => f.properties.type === 'alf').length;
    const hhaCount = features.filter(f => f.properties.type === 'hha').length;
    const hospiceCount = features.filter(f => f.properties.type === 'hospice').length;

    res.json({
      success: true,
      data: {
        type: 'FeatureCollection',
        features,
        metadata: {
          total: features.length,
          alf_count: alfCount,
          hha_count: hhaCount,
          hospice_count: hospiceCount,
          filter_state: state || null,
          filter_type: type
        }
      }
    });
  } catch (error) {
    console.error('[Pennant Routes] locations/geojson error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/alf
 * Return detailed ALF facility data for Pennant
 * @query {string} state - Filter by state code
 * @query {string} sortBy - Sort by 'capacity', 'city', 'state' (default 'state')
 */
router.get('/alf', async (req, res) => {
  try {
    const { state, sortBy = 'state' } = req.query;

    // Check cache first
    const cacheKey = `pennant_alf_${state || 'all'}_${sortBy}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached ALF data');
      return res.json({ success: true, data: cached });
    }

    const pool = getPoolInstance();

    let orderBy = 'state, city';
    switch (sortBy) {
      case 'capacity':
        orderBy = 'capacity DESC NULLS LAST';
        break;
      case 'city':
        orderBy = 'city, state';
        break;
      case 'state':
      default:
        orderBy = 'state, city';
    }

    let query = `
      SELECT
        af.id,
        af.facility_name,
        af.licensee,
        af.address,
        af.city,
        af.state,
        af.zip_code,
        af.county,
        af.phone_number,
        af.latitude,
        af.longitude,
        af.capacity,
        af.license_number,
        af.ownership_type,
        af.cbsa_code,
        af.cbsa_title,
        af.is_rural,
        af.created_at,
        af.updated_at,
        -- Join county demographics if available
        cd.population_65_plus as county_pop_65_plus,
        cd.median_household_income as county_median_income
      FROM alf_facilities af
      LEFT JOIN county_demographics cd ON af.county = cd.county_name AND af.state = cd.state_code
      WHERE af.licensee ILIKE '%pennant%'
    `;
    const params = [];

    if (state) {
      query += ` AND af.state = $1`;
      params.push(state.toUpperCase());
    }

    query += ` ORDER BY ${orderBy}`;

    const result = await pool.query(query, params);

    // Calculate summary stats
    const summary = {
      total_facilities: result.rows.length,
      total_capacity: result.rows.reduce((sum, r) => sum + (parseInt(r.capacity) || 0), 0),
      states: [...new Set(result.rows.map(r => r.state))].sort(),
      avg_capacity: result.rows.length > 0
        ? Math.round(result.rows.reduce((sum, r) => sum + (parseInt(r.capacity) || 0), 0) / result.rows.length)
        : 0
    };

    const responseData = { summary, facilities: result.rows };
    cache.set(cacheKey, responseData);
    console.log('[Pennant] Cached ALF data');
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Pennant Routes] alf error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hha/agencies
 * Return all actual HHA agencies (from hh_provider_snapshots)
 * @query {string} state - Filter by state code
 */
router.get('/hha/agencies', async (req, res) => {
  try {
    const { state } = req.query;

    // Check cache first
    const cacheKey = `pennant_hha_agencies_resp_${state || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached HHA agencies response');
      return res.json({ success: true, data: cached });
    }

    const pool = getPoolInstance();

    const agencies = await getPennantHHAAgencies(pool, state);

    // Calculate summary stats
    const summary = {
      total_agencies: agencies.length,
      total_episodes: agencies.reduce((sum, a) => sum + (parseInt(a.episode_count) || 0), 0),
      avg_star_rating: agencies.filter(a => a.quality_star_rating).length > 0
        ? (agencies.filter(a => a.quality_star_rating)
            .reduce((sum, a) => sum + parseFloat(a.quality_star_rating), 0) /
            agencies.filter(a => a.quality_star_rating).length).toFixed(1)
        : null,
      states: [...new Set(agencies.map(a => a.state))].sort()
    };

    const responseData = {
      summary,
      agencies: agencies.map(a => ({
        ccn: a.ccn,
        provider_name: a.provider_name,
        address: a.address,
        city: a.city,
        state: a.state,
        zip_code: a.zip_code,
        telephone: a.telephone,
        latitude: a.latitude ? parseFloat(a.latitude) : null,
        longitude: a.longitude ? parseFloat(a.longitude) : null,
        quality_star_rating: a.quality_star_rating ? parseFloat(a.quality_star_rating) : null,
        episode_count: a.episode_count ? parseInt(a.episode_count) : null,
        cbsa_code: a.cbsa_code,
        cbsa_name: a.cbsa_name
      }))
    };

    cache.set(cacheKey, responseData);
    console.log('[Pennant] Cached HHA agencies response');
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Pennant Routes] hha/agencies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hha/subsidiaries
 * Return all 40 HHA subsidiaries (parent companies) with their details
 */
router.get('/hha/subsidiaries', async (req, res) => {
  try {
    const pool = getPoolInstance();

    const result = await pool.query(`
      SELECT
        id,
        subsidiary_name,
        care_type,
        agency_count,
        states_operated,
        dba_names,
        verified,
        source,
        created_at,
        updated_at
      FROM ownership_subsidiaries
      WHERE parent_canonical_name = 'THE PENNANT GROUP'
      ORDER BY agency_count DESC NULLS LAST, subsidiary_name
    `);

    // Calculate summary stats
    const summary = {
      total_subsidiaries: result.rows.length,
      total_agencies: result.rows.reduce((sum, r) => sum + (parseInt(r.agency_count) || 1), 0),
      states: [...new Set(result.rows.flatMap(r => r.states_operated || []))].sort(),
      dba_brands: [...new Set(result.rows.flatMap(r => r.dba_names || []))].sort()
    };

    res.json({
      success: true,
      data: {
        summary,
        subsidiaries: result.rows
      }
    });
  } catch (error) {
    console.error('[Pennant Routes] hha/subsidiaries error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hospice/agencies
 * Return all Pennant hospice agencies from hospice_owners data
 * @query {string} state - Optional state filter
 */
router.get('/hospice/agencies', async (req, res) => {
  try {
    const { state } = req.query;
    const pool = getPoolInstance();

    // Check cache first
    const cacheKey = `pennant_hospice_agencies_${state || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached hospice agencies');
      return res.json({ success: true, data: cached });
    }

    const agencies = await getPennantHospiceAgencies(pool, state);

    // Calculate summary stats
    const summary = {
      total_agencies: agencies.length,
      with_location: agencies.filter(a => a.location_source !== 'none').length,
      with_coordinates: agencies.filter(a => a.location_source === 'hha').length,
      without_location: agencies.filter(a => a.location_source === 'none').length,
      states: [...new Set(agencies.filter(a => a.state && a.state !== 'XX').map(a => a.state))].sort()
    };

    const responseData = {
      summary,
      agencies: agencies.map((a, i) => ({
        id: `hospice_${i}`,
        name: a.hospice_name,
        cms_name: a.hospice_name_cms,
        city: a.city !== 'Unknown' ? a.city : null,
        state: a.state !== 'XX' ? a.state : null,
        zip_code: a.zip_code,
        latitude: a.latitude ? parseFloat(a.latitude) : null,
        longitude: a.longitude ? parseFloat(a.longitude) : null,
        cbsa_code: a.cbsa_code,
        cbsa_name: a.cbsa_name,
        location_source: a.location_source,
        has_location_data: a.location_source !== 'none',
        has_coordinates: a.location_source === 'hha',
        hospice_ccn: a.hospice_ccn,
        linked_hha_ccn: a.hha_ccn
      }))
    };

    cache.set(cacheKey, responseData);
    console.log('[Pennant] Cached hospice agencies response');
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Pennant Routes] hospice/agencies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/coverage-by-state
 * Return state-level summary of Pennant's coverage
 */
router.get('/coverage-by-state', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'pennant_coverage_by_state';
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached coverage-by-state');
      return res.json({ success: true, data: cached });
    }

    const pool = getPoolInstance();

    // Get ALF counts by state
    const alfResult = await pool.query(`
      SELECT
        state,
        COUNT(*) as alf_facility_count,
        SUM(COALESCE(capacity, 0)) as alf_total_capacity
      FROM alf_facilities
      WHERE licensee ILIKE '%pennant%'
      GROUP BY state
    `);
    const alfByState = new Map(alfResult.rows.map(r => [r.state, r]));

    // Get HHA agency counts by state (using actual agencies)
    const hhaAgencies = await getPennantHHAAgencies(pool);
    const hhaByState = new Map();
    for (const agency of hhaAgencies) {
      const existing = hhaByState.get(agency.state) || { agency_count: 0, total_episodes: 0 };
      existing.agency_count++;
      existing.total_episodes += parseInt(agency.episode_count) || 0;
      hhaByState.set(agency.state, existing);
    }

    // Get Hospice agency counts by state
    const hospiceAgencies = await getPennantHospiceAgencies(pool);
    const hospiceByState = new Map();
    for (const agency of hospiceAgencies) {
      if (agency.state && agency.state !== 'XX') {
        const existing = hospiceByState.get(agency.state) || { agency_count: 0 };
        existing.agency_count++;
        hospiceByState.set(agency.state, existing);
      }
    }

    // Combine all states
    const allStates = new Set([...alfByState.keys(), ...hhaByState.keys(), ...hospiceByState.keys()]);

    const coverage = Array.from(allStates).map(state => {
      const alf = alfByState.get(state) || { alf_facility_count: 0, alf_total_capacity: 0 };
      const hha = hhaByState.get(state) || { agency_count: 0, total_episodes: 0 };
      const hospice = hospiceByState.get(state) || { agency_count: 0 };

      const hasAlf = (parseInt(alf.alf_facility_count) || 0) > 0;
      const hasHha = hha.agency_count > 0;
      const hasHospice = hospice.agency_count > 0;

      return {
        state,
        alf_facility_count: parseInt(alf.alf_facility_count) || 0,
        alf_total_capacity: parseInt(alf.alf_total_capacity) || 0,
        hha_agency_count: hha.agency_count,
        hha_total_episodes: hha.total_episodes,
        hospice_agency_count: hospice.agency_count,
        has_alf: hasAlf,
        has_hha: hasHha,
        has_hospice: hasHospice,
        has_all_segments: hasAlf && hasHha && hasHospice,
        segment_count: (hasAlf ? 1 : 0) + (hasHha ? 1 : 0) + (hasHospice ? 1 : 0)
      };
    }).sort((a, b) => a.state.localeCompare(b.state));

    // Summary stats
    const summary = {
      total_states: coverage.length,
      states_with_alf: coverage.filter(c => c.has_alf).length,
      states_with_hha: coverage.filter(c => c.has_hha).length,
      states_with_hospice: coverage.filter(c => c.has_hospice).length,
      states_with_all: coverage.filter(c => c.has_all_segments).length,
      total_alf_facilities: coverage.reduce((sum, c) => sum + c.alf_facility_count, 0),
      total_alf_capacity: coverage.reduce((sum, c) => sum + c.alf_total_capacity, 0),
      total_hha_agencies: coverage.reduce((sum, c) => sum + c.hha_agency_count, 0),
      total_hha_episodes: coverage.reduce((sum, c) => sum + c.hha_total_episodes, 0),
      total_hospice_agencies: coverage.reduce((sum, c) => sum + c.hospice_agency_count, 0)
    };

    const responseData = { summary, coverage };
    cache.set(cacheKey, responseData);
    console.log('[Pennant] Cached coverage-by-state');
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Pennant Routes] coverage-by-state error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/coverage-by-cbsa
 * Return CBSA-level summary of Pennant's coverage
 * Shows markets where Pennant operates ALF, HHA, and/or Hospice
 */
router.get('/coverage-by-cbsa', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'pennant_coverage_by_cbsa';
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached coverage-by-cbsa');
      return res.json({ success: true, data: cached });
    }

    const pool = getPoolInstance();

    // Get ALF counts by CBSA
    const alfResult = await pool.query(`
      SELECT
        af.cbsa_code,
        COALESCE(c.cbsa_title, af.cbsa_title) as cbsa_name,
        COUNT(*) as alf_count,
        SUM(COALESCE(af.capacity, 0)) as alf_capacity
      FROM alf_facilities af
      LEFT JOIN cbsas c ON af.cbsa_code = c.cbsa_code
      WHERE af.licensee ILIKE '%pennant%'
        AND af.cbsa_code IS NOT NULL
      GROUP BY af.cbsa_code, COALESCE(c.cbsa_title, af.cbsa_title)
    `);
    const alfByCbsa = new Map(alfResult.rows.map(r => [r.cbsa_code, r]));

    // Get HHA counts by CBSA (using actual agencies)
    const hhaAgencies = await getPennantHHAAgencies(pool);
    const hhaByCbsa = new Map();
    for (const agency of hhaAgencies) {
      if (!agency.cbsa_code) continue;
      const existing = hhaByCbsa.get(agency.cbsa_code) || {
        cbsa_name: agency.cbsa_name,
        hha_count: 0,
        total_episodes: 0
      };
      existing.hha_count++;
      existing.total_episodes += parseInt(agency.episode_count) || 0;
      hhaByCbsa.set(agency.cbsa_code, existing);
    }

    // Get Hospice counts by CBSA
    const hospiceAgencies = await getPennantHospiceAgencies(pool);
    const hospiceByCbsa = new Map();
    for (const agency of hospiceAgencies) {
      if (!agency.cbsa_code) continue;
      const existing = hospiceByCbsa.get(agency.cbsa_code) || {
        cbsa_name: agency.cbsa_name,
        hospice_count: 0
      };
      existing.hospice_count++;
      hospiceByCbsa.set(agency.cbsa_code, existing);
    }

    // Combine all CBSAs
    const allCbsas = new Set([...alfByCbsa.keys(), ...hhaByCbsa.keys(), ...hospiceByCbsa.keys()]);

    const coverage = Array.from(allCbsas).map(cbsaCode => {
      const alf = alfByCbsa.get(cbsaCode) || { cbsa_name: null, alf_count: 0, alf_capacity: 0 };
      const hha = hhaByCbsa.get(cbsaCode) || { cbsa_name: null, hha_count: 0, total_episodes: 0 };
      const hospice = hospiceByCbsa.get(cbsaCode) || { cbsa_name: null, hospice_count: 0 };

      const hasAlf = (parseInt(alf.alf_count) || 0) > 0;
      const hasHha = hha.hha_count > 0;
      const hasHospice = hospice.hospice_count > 0;

      return {
        cbsa_code: cbsaCode,
        cbsa_name: alf.cbsa_name || hha.cbsa_name || hospice.cbsa_name,
        alf_count: parseInt(alf.alf_count) || 0,
        alf_capacity: parseInt(alf.alf_capacity) || 0,
        hha_count: hha.hha_count,
        hha_episodes: hha.total_episodes,
        hospice_count: hospice.hospice_count,
        has_alf: hasAlf,
        has_hha: hasHha,
        has_hospice: hasHospice,
        has_all_segments: hasAlf && hasHha && hasHospice,
        segment_count: (hasAlf ? 1 : 0) + (hasHha ? 1 : 0) + (hasHospice ? 1 : 0),
        total_locations: (parseInt(alf.alf_count) || 0) + hha.hha_count + hospice.hospice_count
      };
    }).sort((a, b) => b.total_locations - a.total_locations); // Sort by total descending

    // Summary stats
    const summary = {
      total_cbsas: coverage.length,
      cbsas_with_alf: coverage.filter(c => c.has_alf).length,
      cbsas_with_hha: coverage.filter(c => c.has_hha).length,
      cbsas_with_hospice: coverage.filter(c => c.has_hospice).length,
      cbsas_with_all: coverage.filter(c => c.has_all_segments).length,
      total_alf_facilities: coverage.reduce((sum, c) => sum + c.alf_count, 0),
      total_alf_capacity: coverage.reduce((sum, c) => sum + c.alf_capacity, 0),
      total_hha_agencies: coverage.reduce((sum, c) => sum + c.hha_count, 0),
      total_hospice_agencies: coverage.reduce((sum, c) => sum + c.hospice_count, 0)
    };

    const responseData = { summary, coverage };
    cache.set(cacheKey, responseData);
    console.log('[Pennant] Cached coverage-by-cbsa');
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[Pennant Routes] coverage-by-cbsa error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/alf/:id
 * Get detailed information for a specific Pennant ALF facility
 * @param {number} id - Facility ID
 */
router.get('/alf/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPoolInstance();

    const result = await pool.query(`
      SELECT
        af.*,
        cd.population_65_plus as county_pop_65_plus,
        cd.population_85_plus as county_pop_85_plus,
        cd.median_household_income as county_median_income,
        cd.growth_rate_65_plus as county_growth_rate,
        c.cbsa_title as cbsa_name
      FROM alf_facilities af
      LEFT JOIN county_demographics cd ON af.county = cd.county_name AND af.state = cd.state_code
      LEFT JOIN cbsas c ON af.cbsa_code = c.cbsa_code
      WHERE af.id = $1
        AND af.licensee ILIKE '%pennant%'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pennant facility not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[Pennant Routes] alf/:id error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hha/agencies/:ccn
 * Get detailed information for a specific Pennant HHA agency
 * @param {string} ccn - Agency CCN
 */
router.get('/hha/agencies/:ccn', async (req, res) => {
  try {
    const { ccn } = req.params;
    const pool = getPoolInstance();

    // Get the agency using the helper function and filter by CCN
    const allAgencies = await getPennantHHAAgencies(pool);
    const agency = allAgencies.find(a => a.ccn === ccn);

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'Pennant HHA agency not found'
      });
    }

    res.json({
      success: true,
      data: {
        ccn: agency.ccn,
        provider_name: agency.provider_name,
        address: agency.address,
        city: agency.city,
        state: agency.state,
        zip_code: agency.zip_code,
        telephone: agency.telephone,
        latitude: agency.latitude ? parseFloat(agency.latitude) : null,
        longitude: agency.longitude ? parseFloat(agency.longitude) : null,
        quality_star_rating: agency.quality_star_rating ? parseFloat(agency.quality_star_rating) : null,
        episode_count: agency.episode_count ? parseInt(agency.episode_count) : null,
        cbsa_code: agency.cbsa_code,
        cbsa_name: agency.cbsa_name
      }
    });
  } catch (error) {
    console.error('[Pennant Routes] hha/agencies/:ccn error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hha/subsidiaries/:id
 * Get detailed information for a specific Pennant HHA subsidiary
 * @param {number} id - Subsidiary ID
 */
router.get('/hha/subsidiaries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPoolInstance();

    const result = await pool.query(`
      SELECT *
      FROM ownership_subsidiaries
      WHERE id = $1
        AND parent_canonical_name = 'THE PENNANT GROUP'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pennant HHA subsidiary not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[Pennant Routes] hha/subsidiaries/:id error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// CLUSTER ANALYSIS ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/pennant/clusters
 * Get all Pennant clusters with SNF proximity analysis
 * @query {number} radius - Clustering radius in miles (default 30)
 */
router.get('/clusters', async (req, res) => {
  try {
    const radius = parseInt(req.query.radius) || 30;

    // Check cache first
    const cacheKey = `pennant_clusters_api_${radius}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached clusters');
      return res.json({ success: true, data: cached });
    }

    console.log(`[Pennant] Generating clusters with ${radius} mile radius`);
    const result = await clusterService.generateAllClusters(radius);

    cache.set(cacheKey, result);
    console.log('[Pennant] Cached clusters');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Pennant Routes] clusters error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/clusters/:clusterId
 * Get detailed information for a specific cluster
 * @param {string} clusterId - Cluster ID (e.g., 'cluster_1')
 * @query {number} radius - Clustering radius in miles (default 30)
 */
router.get('/clusters/:clusterId', async (req, res) => {
  try {
    const { clusterId } = req.params;
    const radius = parseInt(req.query.radius) || 30;

    const cluster = await clusterService.getClusterDetail(clusterId, radius);

    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: `Cluster '${clusterId}' not found`
      });
    }

    res.json({
      success: true,
      data: cluster
    });
  } catch (error) {
    console.error('[Pennant Routes] clusters/:clusterId error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/clusters/:clusterId/snfs
 * Get all SNFs within a cluster's radius
 * @param {string} clusterId - Cluster ID
 * @query {number} radius - Search radius in miles (default 30)
 * @query {string} sortBy - Sort field: 'distance', 'beds', 'rating' (default 'distance')
 * @query {string} sortDir - Sort direction: 'asc', 'desc' (default 'asc')
 */
router.get('/clusters/:clusterId/snfs', async (req, res) => {
  try {
    const { clusterId } = req.params;
    const radius = parseInt(req.query.radius) || 30;
    const sortBy = req.query.sortBy || 'distance';
    const sortDir = req.query.sortDir || 'asc';

    const result = await clusterService.getClusterSNFs(clusterId, radius, sortBy, sortDir);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Cluster '${clusterId}' not found`
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Pennant Routes] clusters/:clusterId/snfs error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/snf-proximity-summary
 * Get aggregate SNF proximity summary across all Pennant locations
 * @query {number} radius - Search radius in miles (default 30)
 */
router.get('/snf-proximity-summary', async (req, res) => {
  try {
    const radius = parseInt(req.query.radius) || 30;

    // Check cache first
    const cacheKey = `pennant_snf_summary_api_${radius}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('[Pennant] Returning cached SNF proximity summary');
      return res.json({ success: true, data: cached });
    }

    const result = await clusterService.getSNFProximitySummary(radius);

    cache.set(cacheKey, result);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Pennant Routes] snf-proximity-summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// HOSPICE MARKET SCORING ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/pennant/hospice/market-scores/summary
 * Get summary statistics for hospice market scores
 * @query {string} geoType - Geography type: 'cbsa' (default), 'state'
 * @query {string} mode - Scoring mode: 'footprint' (within Pennant presence) or 'greenfield' (new markets)
 */
router.get('/hospice/market-scores/summary', async (req, res) => {
  try {
    const geoType = req.query.geoType || 'cbsa';
    const mode = req.query.mode || 'footprint';

    // Validate mode
    if (!['footprint', 'greenfield'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid mode. Use 'footprint' (within Pennant presence) or 'greenfield' (new markets)"
      });
    }

    // Check cache first
    const cacheKey = `hospice_market_summary_${geoType}_${mode}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Pennant] Returning cached hospice market summary (${mode} mode)`);
      return res.json({ success: true, data: cached });
    }

    const result = await hospiceMarketScoringService.getMarketScoreSummary(geoType, mode);

    cache.set(cacheKey, result);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Pennant Routes] hospice/market-scores/summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hospice/market-scores
 * Get all hospice market scores
 * @query {string} geoType - Geography type: 'cbsa' (default), 'state'
 * @query {string} mode - Scoring mode: 'footprint' (within Pennant presence) or 'greenfield' (new markets)
 * @query {number} minPop65 - Minimum 65+ population (default 50000 for CBSA, 500000 for state)
 * @query {number} limit - Maximum results to return (default 100)
 */
router.get('/hospice/market-scores', async (req, res) => {
  try {
    const geoType = req.query.geoType || 'cbsa';
    const mode = req.query.mode || 'footprint';
    const defaultMinPop = geoType === 'state' ? 500000 : 50000;
    const minPop65 = parseInt(req.query.minPop65) || defaultMinPop;
    const limit = parseInt(req.query.limit) || 100;

    // Validate mode
    if (!['footprint', 'greenfield'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid mode. Use 'footprint' (within Pennant presence) or 'greenfield' (new markets)"
      });
    }

    // Check cache first
    const cacheKey = `hospice_market_scores_${geoType}_${mode}_${minPop65}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Pennant] Returning cached hospice market scores (${mode} mode)`);
      return res.json({ success: true, data: cached });
    }

    const allMarkets = await hospiceMarketScoringService.scoreAllMarkets(geoType, minPop65, mode);

    // Sort by opportunity score descending and limit
    const sortedMarkets = allMarkets
      .sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0))
      .slice(0, limit);

    const result = {
      geo_type: geoType,
      score_mode: mode,
      mode_description: mode === 'footprint'
        ? 'Markets where Pennant has existing ALF/HHA/Ensign presence'
        : 'All markets scored for new market entry opportunity',
      min_pop_65: minPop65,
      total_markets: allMarkets.length,
      returned: sortedMarkets.length,
      weights: mode === 'greenfield'
        ? { demand: '40%', market_opportunity: '40%', quality_gap: '20%' }
        : { pennant_synergy: '50%', demand: '30%', market_opportunity: '10%', quality_gap: '10%' },
      markets: sortedMarkets
    };

    cache.set(cacheKey, result);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Pennant Routes] hospice/market-scores error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/pennant/hospice/market-scores/:geoCode
 * Get detailed hospice market score for a single market
 * @param {string} geoCode - CBSA code or state abbreviation
 * @query {string} geoType - Geography type: 'cbsa' (default), 'state'
 * @query {string} mode - Scoring mode: 'footprint' (within Pennant presence) or 'greenfield' (new markets)
 */
router.get('/hospice/market-scores/:geoCode', async (req, res) => {
  try {
    const { geoCode } = req.params;
    const geoType = req.query.geoType || 'cbsa';
    const mode = req.query.mode || 'greenfield'; // Default to greenfield for single market lookup

    // Validate mode
    if (!['footprint', 'greenfield'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid mode. Use 'footprint' (within Pennant presence) or 'greenfield' (new markets)"
      });
    }

    // Check cache first
    const cacheKey = `hospice_market_score_${geoType}_${geoCode}_${mode}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Pennant] Returning cached hospice market score for ${geoCode} (${mode} mode)`);
      return res.json({ success: true, data: cached });
    }

    const result = await hospiceMarketScoringService.scoreMarket(geoType, geoCode, mode);

    if (!result) {
      // Different error messages based on mode
      const errorMsg = mode === 'footprint'
        ? `Market '${geoCode}' not found or has no Pennant presence (footprint mode requires ALF/HHA/Ensign presence)`
        : `Market '${geoCode}' not found for geo_type '${geoType}'`;
      return res.status(404).json({
        success: false,
        error: errorMsg
      });
    }

    cache.set(cacheKey, result);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Pennant Routes] hospice/market-scores/:geoCode error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
