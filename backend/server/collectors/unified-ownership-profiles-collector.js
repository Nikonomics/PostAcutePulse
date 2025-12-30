/**
 * Unified Ownership Profiles Collector v2.0
 *
 * Enriches ownership_profiles with data from ALF and HHA segments.
 * Uses conservative matching to eliminate false positives.
 *
 * Matching Strategy:
 * 1. First check ownership_name_variants for manual mappings
 * 2. Then try exact/near-exact normalized name match
 * 3. Only use pattern matching for DISTINCTIVE company words (not generic healthcare terms)
 *
 * Also creates profiles for pure-play HHA/ALF operators that don't have SNF facilities.
 */

const path = require('path');
const { Pool } = require('pg');

// Connection string for market database
const MARKET_DATABASE_URL = process.env.MARKET_DATABASE_URL ||
  'postgresql://snf_market_data:2SZhgz49PmunxSNLXUBtd3BzuwgaFMh0@dpg-d4tmg6idbo4c73ae3nsg-a.oregon-postgres.render.com/snf_market_data?sslmode=require';

// Generic healthcare words that should NOT be used for pattern matching
const GENERIC_WORDS = new Set([
  // Generic healthcare terms
  'HEALTH', 'HEALTHCARE', 'HEALTHSERVICES', 'MEDICAL', 'MEDICINE',
  'CARE', 'CARING', 'CAREGIVING', 'HOMECARE', 'HOMEHEALTH',
  'SENIOR', 'SENIORS', 'ELDERLY', 'AGING', 'AGED',
  'LIVING', 'LIFE', 'LIFESTYLE',
  'NURSING', 'NURSE', 'NURSES',
  'REHAB', 'REHABILITATION', 'REHABILITATIVE', 'THERAPY',
  'HOME', 'HOMES', 'HOUSE', 'RESIDENCE', 'RESIDENTIAL',
  'HOSPITAL', 'HOSPITALS', 'HOSPICE', 'CLINIC', 'CLINICAL',
  'COMMUNITY', 'COMMUNITIES', 'CENTER', 'CENTERS', 'CENTRE',
  'SERVICES', 'SERVICE', 'SOLUTIONS', 'MANAGEMENT', 'CONSULTING',
  'PROFESSIONAL', 'QUALITY', 'PREMIER', 'ADVANCED', 'COMPLETE',
  // Legal/organizational terms
  'GROUP', 'GROUPS', 'HOLDINGS', 'HOLDING', 'ENTERPRISES', 'ENTERPRISE',
  'INC', 'LLC', 'CORP', 'CORPORATION', 'COMPANY', 'COMPANIES', 'CO',
  'LP', 'LLP', 'PARTNERS', 'PARTNERSHIP', 'ASSOCIATES', 'ASSOCIATION',
  // Government terms
  'STATE', 'COUNTY', 'CITY', 'DEPARTMENT', 'GOVERNMENT', 'FEDERAL',
  'VETERANS', 'AFFAIRS', 'ADMINISTRATION', 'OFFICE', 'COMPTROLLER',
  // Regional terms
  'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'REGIONAL', 'NATIONAL',
  'AMERICAN', 'MIDWEST', 'SOUTHERN', 'NORTHERN', 'EASTERN', 'WESTERN',
  // Common adjectives
  'NEW', 'GOLDEN', 'SUNRISE', 'SUNSET', 'MORNING', 'EVENING',
  'GOOD', 'GREAT', 'BEST', 'FIRST', 'LEGACY', 'HERITAGE', 'CLASSIC',
  'FAMILY', 'FRIENDLY', 'CARING', 'LOVING', 'COMPASSIONATE',
  // Facility types
  'FACILITY', 'FACILITIES', 'OPERATIONS', 'PROPERTIES', 'REAL', 'ESTATE'
]);

// Minimum word length to be considered distinctive
const MIN_DISTINCTIVE_WORD_LENGTH = 5;

/**
 * Normalize company name for matching
 */
function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/,?\s*(LLC|INC|CORP|CORPORATION|LP|LLP|HOLDINGS?|GROUP|ENTERPRISES?|COMPANIES|CO|COMPANY)\s*\.?$/gi, '')
    .replace(/[,.'"\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract distinctive words from a company name
 * Returns only words that are NOT generic healthcare/legal terms
 */
function getDistinctiveWords(name) {
  const normalized = normalizeCompanyName(name);
  const words = normalized.split(' ');

  return words.filter(word => {
    // Must be long enough
    if (word.length < MIN_DISTINCTIVE_WORD_LENGTH) return false;
    // Must not be a generic word
    if (GENERIC_WORDS.has(word)) return false;
    // Must not be all numbers
    if (/^\d+$/.test(word)) return false;
    return true;
  });
}

/**
 * Check if two company names likely refer to the same entity
 * Uses STRICT matching - requires significant overlap
 */
function isStrictMatch(sourceName, targetName) {
  const source = normalizeCompanyName(sourceName);
  const target = normalizeCompanyName(targetName);

  if (!source || !target) return false;

  // Exact match after normalization
  if (source === target) return true;

  // One is substring of other (handles "GENESIS" matching "GENESIS HEALTHCARE")
  if (source.includes(target) || target.includes(source)) {
    // But only if the shorter one has distinctive words
    const shorter = source.length < target.length ? source : target;
    const distinctiveWords = getDistinctiveWords(shorter);
    if (distinctiveWords.length >= 1) return true;
  }

  // Check distinctive word overlap
  const sourceDistinctive = new Set(getDistinctiveWords(source));
  const targetDistinctive = new Set(getDistinctiveWords(target));

  if (sourceDistinctive.size === 0 || targetDistinctive.size === 0) {
    return false; // Can't match if no distinctive words
  }

  let matches = 0;
  for (const word of sourceDistinctive) {
    if (targetDistinctive.has(word)) matches++;
  }

  // Require at least 1 distinctive word match AND that word represents significant portion
  if (matches >= 1) {
    const minSize = Math.min(sourceDistinctive.size, targetDistinctive.size);
    // If smaller name has only 1 distinctive word, 1 match is enough
    // If larger, need at least 50% overlap
    if (minSize === 1 || matches >= Math.ceil(minSize * 0.5)) {
      return true;
    }
  }

  return false;
}

/**
 * Get name variants for a company from ownership_name_variants table
 */
async function getNameVariants(pool, canonicalName, sourceContext) {
  const result = await pool.query(`
    SELECT variant_name
    FROM ownership_name_variants
    WHERE UPPER(canonical_name) = UPPER($1)
      AND (source_context = $2 OR source_context IS NULL)
  `, [canonicalName, sourceContext]);

  return result.rows.map(r => r.variant_name);
}

/**
 * Get canonical name for a variant from ownership_name_variants table
 */
async function getCanonicalFromVariant(pool, variantName, sourceContext) {
  const result = await pool.query(`
    SELECT canonical_name
    FROM ownership_name_variants
    WHERE UPPER(variant_name) = UPPER($1)
      AND (source_context = $2 OR source_context IS NULL)
    LIMIT 1
  `, [variantName, sourceContext]);

  return result.rows.length > 0 ? result.rows[0].canonical_name : null;
}

/**
 * Get ALF data for a company using conservative matching
 */
async function getALFData(pool, companyName) {
  // Step 1: Check for manual name variants
  const variants = await getNameVariants(pool, companyName, 'alf_licensee');
  const namesToSearch = [companyName, ...variants];

  // Step 2: Try exact/near-exact matches first
  for (const searchName of namesToSearch) {
    const normalized = normalizeCompanyName(searchName);

    // Try exact match
    const exactResult = await pool.query(`
      SELECT
        COUNT(*) as facility_count,
        COALESCE(SUM(CASE WHEN capacity IS NOT NULL THEN capacity ELSE 0 END), 0) as total_capacity,
        ARRAY_AGG(DISTINCT state ORDER BY state) as states,
        ARRAY_AGG(DISTINCT licensee) as licensee_names
      FROM alf_facilities
      WHERE UPPER(TRIM(licensee)) = $1
         OR UPPER(TRIM(REPLACE(REPLACE(licensee, ',', ''), '.', ''))) = $1
    `, [normalized]);

    if (exactResult.rows[0] && parseInt(exactResult.rows[0].facility_count) > 0) {
      return {
        facilityCount: parseInt(exactResult.rows[0].facility_count),
        totalCapacity: parseInt(exactResult.rows[0].total_capacity) || 0,
        states: exactResult.rows[0].states || [],
        matchType: 'exact',
        matchedNames: exactResult.rows[0].licensee_names || []
      };
    }
  }

  // Step 3: Try pattern matching with ONLY distinctive words
  const distinctiveWords = getDistinctiveWords(companyName);

  if (distinctiveWords.length === 0) {
    return null; // No distinctive words to match on
  }

  // Build conservative pattern: require first distinctive word
  const primaryWord = distinctiveWords[0];

  const patternResult = await pool.query(`
    SELECT
      COUNT(*) as facility_count,
      COALESCE(SUM(CASE WHEN capacity IS NOT NULL THEN capacity ELSE 0 END), 0) as total_capacity,
      ARRAY_AGG(DISTINCT state ORDER BY state) as states,
      ARRAY_AGG(DISTINCT licensee) as licensee_names
    FROM alf_facilities
    WHERE licensee ILIKE $1
  `, [`%${primaryWord}%`]);

  if (patternResult.rows[0] && parseInt(patternResult.rows[0].facility_count) > 0) {
    // Verify the matches are actually good
    const licenseeNames = patternResult.rows[0].licensee_names || [];
    const goodMatches = licenseeNames.filter(name => isStrictMatch(companyName, name));

    if (goodMatches.length > 0) {
      // Re-query for only the good matches
      const placeholders = goodMatches.map((_, i) => `$${i + 1}`).join(', ');
      const verifiedResult = await pool.query(`
        SELECT
          COUNT(*) as facility_count,
          COALESCE(SUM(CASE WHEN capacity IS NOT NULL THEN capacity ELSE 0 END), 0) as total_capacity,
          ARRAY_AGG(DISTINCT state ORDER BY state) as states,
          ARRAY_AGG(DISTINCT licensee) as licensee_names
        FROM alf_facilities
        WHERE licensee IN (${placeholders})
      `, goodMatches);

      if (verifiedResult.rows[0] && parseInt(verifiedResult.rows[0].facility_count) > 0) {
        return {
          facilityCount: parseInt(verifiedResult.rows[0].facility_count),
          totalCapacity: parseInt(verifiedResult.rows[0].total_capacity) || 0,
          states: verifiedResult.rows[0].states || [],
          matchType: 'distinctive_pattern',
          matchedNames: verifiedResult.rows[0].licensee_names || []
        };
      }
    }
  }

  return null;
}

/**
 * Get HHA data for a company using conservative matching
 */
async function getHHAData(pool, companyName) {
  // Step 1: Check for manual name variants
  const variants = await getNameVariants(pool, companyName, 'hha_parent');
  const namesToSearch = [companyName, ...variants];

  // Step 2: Try exact/near-exact matches first
  for (const searchName of namesToSearch) {
    const normalized = normalizeCompanyName(searchName);

    const exactResult = await pool.query(`
      SELECT
        COUNT(DISTINCT os.id) as subsidiary_count,
        COALESCE(SUM(os.agency_count), 0) as agency_count,
        ARRAY_AGG(DISTINCT s) FILTER (WHERE s IS NOT NULL) as states,
        ARRAY_AGG(DISTINCT dba) FILTER (WHERE dba IS NOT NULL) as dba_brands,
        ARRAY_AGG(DISTINCT os.parent_canonical_name) as parent_names,
        MAX(os.pe_investors) as pe_investors
      FROM ownership_subsidiaries os
      LEFT JOIN LATERAL unnest(COALESCE(os.states_operated, ARRAY[]::text[])) as s ON true
      LEFT JOIN LATERAL unnest(COALESCE(os.dba_names, ARRAY[]::text[])) as dba ON true
      WHERE os.care_type = 'HHA'
        AND (
          UPPER(TRIM(os.parent_canonical_name)) = $1
          OR UPPER(TRIM(REPLACE(REPLACE(os.parent_canonical_name, ',', ''), '.', ''))) = $1
        )
    `, [normalized]);

    if (exactResult.rows[0] && parseInt(exactResult.rows[0].subsidiary_count) > 0) {
      return {
        subsidiaryCount: parseInt(exactResult.rows[0].subsidiary_count),
        agencyCount: parseInt(exactResult.rows[0].agency_count) || 0,
        states: (exactResult.rows[0].states || []).filter(s => s),
        dbaBrands: (exactResult.rows[0].dba_brands || []).filter(b => b),
        peInvestors: exactResult.rows[0].pe_investors || [],
        matchType: 'exact'
      };
    }
  }

  // Step 3: Try pattern matching with ONLY distinctive words
  const distinctiveWords = getDistinctiveWords(companyName);

  if (distinctiveWords.length === 0) {
    return null;
  }

  const primaryWord = distinctiveWords[0];

  const patternResult = await pool.query(`
    SELECT DISTINCT parent_canonical_name
    FROM ownership_subsidiaries
    WHERE care_type = 'HHA'
      AND parent_canonical_name ILIKE $1
  `, [`%${primaryWord}%`]);

  // Verify matches
  const goodMatches = patternResult.rows
    .map(r => r.parent_canonical_name)
    .filter(name => isStrictMatch(companyName, name));

  if (goodMatches.length > 0) {
    const placeholders = goodMatches.map((_, i) => `$${i + 1}`).join(', ');
    const verifiedResult = await pool.query(`
      SELECT
        COUNT(DISTINCT os.id) as subsidiary_count,
        COALESCE(SUM(os.agency_count), 0) as agency_count,
        ARRAY_AGG(DISTINCT s) FILTER (WHERE s IS NOT NULL) as states,
        ARRAY_AGG(DISTINCT dba) FILTER (WHERE dba IS NOT NULL) as dba_brands,
        MAX(os.pe_investors) as pe_investors
      FROM ownership_subsidiaries os
      LEFT JOIN LATERAL unnest(COALESCE(os.states_operated, ARRAY[]::text[])) as s ON true
      LEFT JOIN LATERAL unnest(COALESCE(os.dba_names, ARRAY[]::text[])) as dba ON true
      WHERE os.care_type = 'HHA'
        AND os.parent_canonical_name IN (${placeholders})
    `, goodMatches);

    if (verifiedResult.rows[0] && parseInt(verifiedResult.rows[0].subsidiary_count) > 0) {
      return {
        subsidiaryCount: parseInt(verifiedResult.rows[0].subsidiary_count),
        agencyCount: parseInt(verifiedResult.rows[0].agency_count) || 0,
        states: (verifiedResult.rows[0].states || []).filter(s => s),
        dbaBrands: (verifiedResult.rows[0].dba_brands || []).filter(b => b),
        peInvestors: verifiedResult.rows[0].pe_investors || [],
        matchType: 'distinctive_pattern'
      };
    }
  }

  return null;
}

/**
 * Create profiles for pure-play HHA operators (no SNF)
 */
async function createPurePlayHHAProfiles(pool, minAgencies = 50) {
  console.log(`\n[Unified Profiles] Creating pure-play HHA profiles (>=${minAgencies} agencies)...`);

  // Find HHA parents with significant operations that don't have profiles
  const result = await pool.query(`
    SELECT
      os.parent_canonical_name,
      COUNT(DISTINCT os.id) as subsidiary_count,
      SUM(os.agency_count) as agency_count,
      ARRAY_AGG(DISTINCT s) FILTER (WHERE s IS NOT NULL) as states,
      ARRAY_AGG(DISTINCT dba) FILTER (WHERE dba IS NOT NULL) as dba_brands,
      MAX(os.pe_investors) as pe_investors
    FROM ownership_subsidiaries os
    LEFT JOIN LATERAL unnest(COALESCE(os.states_operated, ARRAY[]::text[])) as s ON true
    LEFT JOIN LATERAL unnest(COALESCE(os.dba_names, ARRAY[]::text[])) as dba ON true
    WHERE os.care_type = 'HHA'
      AND os.parent_canonical_name NOT IN (
        SELECT parent_organization FROM ownership_profiles
        UNION
        SELECT canonical_name FROM ownership_name_variants
      )
    GROUP BY os.parent_canonical_name
    HAVING SUM(os.agency_count) >= $1
    ORDER BY SUM(os.agency_count) DESC
  `, [minAgencies]);

  let created = 0;
  for (const row of result.rows) {
    try {
      // Check if a variant maps to an existing profile
      const canonical = await getCanonicalFromVariant(pool, row.parent_canonical_name, 'hha_parent');
      if (canonical) {
        // Map to existing profile instead of creating new
        continue;
      }

      const states = (row.states || []).filter(s => s);
      const dbaBrands = (row.dba_brands || []).filter(b => b).slice(0, 20);
      const peInvestors = row.pe_investors || [];

      await pool.query(`
        INSERT INTO ownership_profiles (
          parent_organization, facility_count, total_beds,
          has_snf, has_alf, has_hha,
          care_types, is_diversified,
          hha_subsidiary_count, hha_agency_count, hha_states, hha_dba_brands,
          total_locations, total_states_operated, all_states,
          pe_backed, pe_investors
        ) VALUES ($1, 0, 0, false, false, true,
          ARRAY['HHA'], false,
          $2, $3, $4, $5,
          $3, $6, $4,
          $7, $8
        )
        ON CONFLICT (parent_organization) DO UPDATE SET
          has_hha = true,
          care_types = ARRAY['HHA'],
          hha_subsidiary_count = $2,
          hha_agency_count = $3,
          hha_states = $4,
          hha_dba_brands = $5,
          total_locations = $3,
          total_states_operated = $6,
          all_states = $4,
          pe_backed = $7,
          pe_investors = $8,
          updated_at = NOW()
      `, [
        row.parent_canonical_name,
        parseInt(row.subsidiary_count),
        parseInt(row.agency_count),
        states,
        dbaBrands,
        states.length,
        peInvestors.length > 0,
        peInvestors
      ]);

      created++;
      console.log(`  Created: ${row.parent_canonical_name} (${row.agency_count} agencies)`);
    } catch (err) {
      console.error(`  Error creating ${row.parent_canonical_name}: ${err.message}`);
    }
  }

  console.log(`[Unified Profiles] Created ${created} pure-play HHA profiles`);
  return created;
}

/**
 * Create profiles for pure-play ALF operators (no SNF)
 */
async function createPurePlayALFProfiles(pool, minFacilities = 20) {
  console.log(`\n[Unified Profiles] Creating pure-play ALF profiles (>=${minFacilities} facilities)...`);

  // Find ALF licensees with significant operations that don't have profiles
  const result = await pool.query(`
    SELECT
      licensee,
      COUNT(*) as facility_count,
      COALESCE(SUM(capacity), 0) as total_capacity,
      ARRAY_AGG(DISTINCT state ORDER BY state) as states
    FROM alf_facilities
    WHERE licensee IS NOT NULL
      AND licensee != ''
      AND UPPER(TRIM(licensee)) NOT IN (
        SELECT UPPER(TRIM(parent_organization)) FROM ownership_profiles
        UNION
        SELECT UPPER(TRIM(canonical_name)) FROM ownership_name_variants
        UNION
        SELECT UPPER(TRIM(variant_name)) FROM ownership_name_variants
      )
    GROUP BY licensee
    HAVING COUNT(*) >= $1
    ORDER BY COUNT(*) DESC
  `, [minFacilities]);

  let created = 0;
  for (const row of result.rows) {
    try {
      // Check if this maps to an existing profile via variants
      const canonical = await getCanonicalFromVariant(pool, row.licensee, 'alf_licensee');
      if (canonical) {
        continue;
      }

      const states = row.states || [];

      await pool.query(`
        INSERT INTO ownership_profiles (
          parent_organization, facility_count, total_beds,
          has_snf, has_alf, has_hha,
          care_types, is_diversified,
          alf_facility_count, alf_total_capacity, alf_states,
          total_locations, total_states_operated, all_states
        ) VALUES ($1, 0, 0, false, true, false,
          ARRAY['ALF'], false,
          $2, $3, $4,
          $2, $5, $4
        )
        ON CONFLICT (parent_organization) DO UPDATE SET
          has_alf = true,
          care_types = ARRAY['ALF'],
          alf_facility_count = $2,
          alf_total_capacity = $3,
          alf_states = $4,
          total_locations = $2,
          total_states_operated = $5,
          all_states = $4,
          updated_at = NOW()
      `, [
        row.licensee,
        parseInt(row.facility_count),
        parseInt(row.total_capacity),
        states,
        states.length
      ]);

      created++;
      console.log(`  Created: ${row.licensee} (${row.facility_count} facilities)`);
    } catch (err) {
      console.error(`  Error creating ${row.licensee}: ${err.message}`);
    }
  }

  console.log(`[Unified Profiles] Created ${created} pure-play ALF profiles`);
  return created;
}

/**
 * Enrich ownership profiles with ALF and HHA data
 */
async function enrichOwnershipProfiles(pool, options = {}) {
  const { limit = null, minFacilities = 0, verbose = false } = options;

  console.log('[Unified Profiles] Starting enrichment...');
  const startTime = Date.now();

  // Get ALL profiles (including those with facility_count=0 for pure-play)
  let query = `
    SELECT id, parent_organization, facility_count, states_operated
    FROM ownership_profiles
    WHERE facility_count >= $1
    ORDER BY facility_count DESC
  `;
  const params = [minFacilities];

  if (limit) {
    query += ` LIMIT $2`;
    params.push(limit);
  }

  const profilesResult = await pool.query(query, params);
  const profiles = profilesResult.rows;

  console.log(`[Unified Profiles] Processing ${profiles.length} profiles...`);

  let enrichedCount = 0;
  let alfMatches = 0;
  let hhaMatches = 0;
  let diversifiedCount = 0;

  for (const profile of profiles) {
    try {
      const alfData = await getALFData(pool, profile.parent_organization);
      const hhaData = await getHHAData(pool, profile.parent_organization);

      // Calculate flags and totals
      const hasSnf = profile.facility_count > 0;
      const hasAlf = alfData !== null && alfData.facilityCount > 0;
      const hasHha = hhaData !== null && (hhaData.subsidiaryCount > 0 || hhaData.agencyCount > 0);

      const careTypes = [];
      if (hasSnf) careTypes.push('SNF');
      if (hasAlf) careTypes.push('ALF');
      if (hasHha) careTypes.push('HHA');

      const isDiversified = careTypes.length >= 2;

      // Calculate totals
      const snfCount = profile.facility_count || 0;
      const alfCount = alfData?.facilityCount || 0;
      const hhaAgencyCount = hhaData?.agencyCount || 0;

      const totalLocations = snfCount + alfCount + hhaAgencyCount;

      // Merge states from all sources
      const allStatesSet = new Set([
        ...(profile.states_operated || []),
        ...(alfData?.states || []),
        ...(hhaData?.states || [])
      ]);
      const allStates = Array.from(allStatesSet).sort();

      // PE tracking
      const peInvestors = hhaData?.peInvestors || [];
      const peBacked = peInvestors.length > 0;

      // Update the profile
      await pool.query(`
        UPDATE ownership_profiles
        SET
          has_snf = $2,
          has_alf = $3,
          has_hha = $4,
          care_types = $5,
          is_diversified = $6,
          alf_facility_count = $7,
          alf_total_capacity = $8,
          alf_states = $9,
          hha_subsidiary_count = $10,
          hha_agency_count = $11,
          hha_states = $12,
          hha_dba_brands = $13,
          total_locations = $14,
          total_states_operated = $15,
          all_states = $16,
          pe_backed = $17,
          pe_investors = $18,
          updated_at = NOW()
        WHERE id = $1
      `, [
        profile.id,
        hasSnf,
        hasAlf,
        hasHha,
        careTypes,
        isDiversified,
        alfData?.facilityCount || 0,
        alfData?.totalCapacity || 0,
        alfData?.states || [],
        hhaData?.subsidiaryCount || 0,
        hhaData?.agencyCount || 0,
        hhaData?.states || [],
        (hhaData?.dbaBrands || []).slice(0, 20),
        totalLocations,
        allStates.length,
        allStates,
        peBacked,
        peInvestors
      ]);

      enrichedCount++;
      if (hasAlf) alfMatches++;
      if (hasHha) hhaMatches++;
      if (isDiversified) diversifiedCount++;

      if (verbose && (hasAlf || hasHha)) {
        console.log(`  ${profile.parent_organization}:`);
        if (hasSnf) console.log(`    SNF: ${snfCount} facilities`);
        if (hasAlf) console.log(`    ALF: ${alfCount} facilities (${alfData.matchType})`);
        if (hasHha) console.log(`    HHA: ${hhaData.agencyCount} agencies (${hhaData.matchType})`);
      }

    } catch (err) {
      console.error(`  Error enriching ${profile.parent_organization}: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Unified Profiles] Enrichment complete in ${elapsed}s`);
  console.log(`  Profiles processed: ${enrichedCount}`);
  console.log(`  With ALF data: ${alfMatches}`);
  console.log(`  With HHA data: ${hhaMatches}`);
  console.log(`  Diversified (2+ segments): ${diversifiedCount}`);

  return { enrichedCount, alfMatches, hhaMatches, diversifiedCount };
}

/**
 * Print diversified operators summary
 */
async function printDiversifiedSummary(pool) {
  console.log('\n[Unified Profiles] === Diversified Operators ===\n');

  const result = await pool.query(`
    SELECT
      parent_organization,
      care_types,
      facility_count as snf_count,
      alf_facility_count as alf_count,
      hha_agency_count as hha_count,
      total_locations,
      total_states_operated,
      pe_backed
    FROM ownership_profiles
    WHERE is_diversified = true
    ORDER BY total_locations DESC
    LIMIT 20
  `);

  console.log('Organization                           | SNF  | ALF  | HHA  | Total | States | PE');
  console.log('---------------------------------------|------|------|------|-------|--------|----');

  for (const row of result.rows) {
    const name = row.parent_organization.substring(0, 38).padEnd(38);
    const snf = String(row.snf_count || 0).padStart(4);
    const alf = String(row.alf_count || 0).padStart(4);
    const hha = String(row.hha_count || 0).padStart(4);
    const total = String(row.total_locations || 0).padStart(5);
    const states = String(row.total_states_operated || 0).padStart(6);
    const pe = row.pe_backed ? 'Yes' : 'No ';

    console.log(`${name} | ${snf} | ${alf} | ${hha} | ${total} | ${states} | ${pe}`);
  }

  // Count by segment combination
  const combosResult = await pool.query(`
    SELECT
      care_types,
      COUNT(*) as count,
      SUM(total_locations) as total_locations
    FROM ownership_profiles
    WHERE is_diversified = true
    GROUP BY care_types
    ORDER BY count DESC
  `);

  console.log('\nBy care type combination:');
  for (const row of combosResult.rows) {
    const types = (row.care_types || []).join('+');
    console.log(`  ${types}: ${row.count} operators, ${row.total_locations} total locations`);
  }
}

/**
 * Show detailed profile for specific operators
 */
async function showOperatorDetails(pool, operatorNames) {
  console.log('\n[Unified Profiles] === Operator Details ===\n');

  for (const name of operatorNames) {
    const result = await pool.query(`
      SELECT *
      FROM ownership_profiles
      WHERE parent_organization ILIKE $1
      LIMIT 1
    `, [`%${name}%`]);

    if (result.rows.length === 0) {
      console.log(`${name}: Not found`);
      continue;
    }

    const p = result.rows[0];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${p.parent_organization}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Care Types: ${(p.care_types || []).join(', ')} ${p.is_diversified ? '(DIVERSIFIED)' : ''}`);
    console.log(`Total Locations: ${p.total_locations} across ${p.total_states_operated} states`);
    console.log(`States: ${(p.all_states || []).join(', ')}`);

    if (p.has_snf) {
      console.log(`\nSNF Segment:`);
      console.log(`  Facilities: ${p.facility_count}`);
      console.log(`  Total Beds: ${p.total_beds}`);
      console.log(`  Avg Rating: ${p.avg_overall_rating ? parseFloat(p.avg_overall_rating).toFixed(1) : 'N/A'}★`);
    }

    if (p.has_alf) {
      console.log(`\nALF Segment:`);
      console.log(`  Facilities: ${p.alf_facility_count}`);
      console.log(`  Total Capacity: ${p.alf_total_capacity}`);
      console.log(`  States: ${(p.alf_states || []).join(', ')}`);
    }

    if (p.has_hha) {
      console.log(`\nHHA Segment:`);
      console.log(`  Subsidiaries: ${p.hha_subsidiary_count}`);
      console.log(`  Agencies: ${p.hha_agency_count}`);
      console.log(`  States: ${(p.hha_states || []).join(', ')}`);
      if (p.hha_dba_brands && p.hha_dba_brands.length > 0) {
        console.log(`  DBA Brands: ${p.hha_dba_brands.slice(0, 5).join(', ')}${p.hha_dba_brands.length > 5 ? '...' : ''}`);
      }
    }

    if (p.pe_backed) {
      console.log(`\nPE/Investment: ${(p.pe_investors || []).join(', ')}`);
    }
  }
}

/**
 * Main function
 */
async function runCollector(options = {}) {
  console.log('='.repeat(60));
  console.log('[Unified Ownership Profiles Collector v2.0] Starting');
  console.log('='.repeat(60));

  const pool = new Pool({
    connectionString: MARKET_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query('SELECT 1');
    console.log('[Unified Profiles] Database connection successful');

    // Step 1: Create pure-play profiles for major HHA/ALF operators
    if (options.createPurePlay !== false) {
      await createPurePlayHHAProfiles(pool, options.minHHAAgencies || 50);
      await createPurePlayALFProfiles(pool, options.minALFFacilities || 20);
    }

    // Step 2: Enrich all profiles with ALF/HHA data
    const results = await enrichOwnershipProfiles(pool, {
      limit: options.limit || null,
      minFacilities: options.minFacilities || 0,
      verbose: options.verbose || false
    });

    // Step 3: Show summary
    await printDiversifiedSummary(pool);

    // Step 4: Show details for specific operators if requested
    if (options.showDetails) {
      await showOperatorDetails(pool, options.showDetails);
    }

    console.log('\n[Unified Profiles] Collection complete');
    return results;

  } catch (err) {
    console.error('[Unified Profiles] Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

  const args = process.argv.slice(2);
  const options = {
    limit: null,
    minFacilities: 0,
    verbose: args.includes('--verbose') || args.includes('-v'),
    showDetails: null,
    createPurePlay: !args.includes('--no-pure-play'),
    minHHAAgencies: 50,
    minALFFacilities: 20
  };

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    options.limit = parseInt(args[limitIdx + 1]);
  }

  const topIdx = args.indexOf('--top');
  if (topIdx !== -1 && args[topIdx + 1]) {
    options.limit = parseInt(args[topIdx + 1]);
  }

  const showIdx = args.indexOf('--show');
  if (showIdx !== -1) {
    options.showDetails = args.slice(showIdx + 1).filter(a => !a.startsWith('--'));
  }

  if (!options.showDetails) {
    options.showDetails = ['BROOKDALE', 'LHC', 'AMEDISYS', 'CENTERWELL', 'PENNANT', 'GENESIS'];
  }

  runCollector(options)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Collector failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runCollector,
  enrichOwnershipProfiles,
  createPurePlayHHAProfiles,
  createPurePlayALFProfiles,
  getALFData,
  getHHAData,
  normalizeCompanyName,
  getDistinctiveWords,
  isStrictMatch,
  GENERIC_WORDS
};
