/**
 * Pennant Cluster Analysis Service
 *
 * Provides geographic clustering of Pennant locations (ALF + HHA) with
 * SNF proximity analysis to identify strategic partnership opportunities.
 *
 * Key Features:
 * - Groups nearby Pennant locations into clusters
 * - Calculates SNF density around each cluster
 * - Identifies Ensign SNF presence for partnership potential
 * - Scores clusters by opportunity value
 */

const { getMarketPool } = require('../config/database');

// Cache for expensive cluster calculations (1 hour TTL)
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
  },
  clear() {
    this.data = {};
  }
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in miles
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate centroid of a set of coordinates
 * @param {Array} locations - Array of {latitude, longitude} objects
 * @returns {Object} {lat, lng} centroid
 */
function calculateCentroid(locations) {
  if (!locations.length) return { lat: 0, lng: 0 };

  const sum = locations.reduce((acc, loc) => ({
    lat: acc.lat + parseFloat(loc.latitude || 0),
    lng: acc.lng + parseFloat(loc.longitude || 0)
  }), { lat: 0, lng: 0 });

  return {
    lat: sum.lat / locations.length,
    lng: sum.lng / locations.length
  };
}

/**
 * Get all Pennant locations (ALF + HHA) with coordinates
 * @param {Object} pool - Database connection pool
 * @returns {Promise<Array>} Combined array of ALF and HHA locations
 */
async function getPennantLocationsWithCoordinates(pool) {
  // Get ALF facilities
  const alfResult = await pool.query(`
    SELECT
      id,
      facility_name as name,
      'alf' as type,
      address,
      city,
      state,
      zip_code,
      county,
      latitude,
      longitude,
      capacity,
      cbsa_code,
      cbsa_title as cbsa_name
    FROM alf_facilities
    WHERE licensee ILIKE '%pennant%'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
  `);

  // Get HHA agencies using the DBA matching logic
  const hhaResult = await pool.query(`
    WITH pennant_dba AS (
      SELECT DISTINCT
        UPPER(TRIM(UNNEST(dba_names))) as dba_name,
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
      h.ccn as id,
      h.provider_name as name,
      'hha' as type,
      h.address,
      h.city,
      h.state,
      h.zip_code,
      NULL as county,
      h.latitude,
      h.longitude,
      NULL as capacity,
      h.cbsa_code,
      c.cbsa_title as cbsa_name
    FROM hh_provider_snapshots h
    LEFT JOIN cbsas c ON h.cbsa_code = c.cbsa_code
    WHERE h.extract_id = 1
      AND h.latitude IS NOT NULL
      AND h.longitude IS NOT NULL
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
  `);

  return [...alfResult.rows, ...hhaResult.rows];
}

/**
 * Identify geographic clusters of Pennant locations
 * @param {number} radiusMiles - Maximum distance between cluster members (default 30)
 * @returns {Promise<Array>} Array of cluster objects
 */
async function identifyPennantClusters(radiusMiles = 30) {
  const cacheKey = `pennant_clusters_${radiusMiles}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[PennantCluster] Using cached clusters');
    return cached;
  }

  console.log(`[PennantCluster] Identifying clusters with ${radiusMiles} mile radius`);
  const pool = getMarketPool();
  const locations = await getPennantLocationsWithCoordinates(pool);

  console.log(`[PennantCluster] Found ${locations.length} Pennant locations with coordinates`);

  if (!locations.length) {
    return [];
  }

  const clusters = [];
  const assigned = new Set();
  let clusterNum = 1;

  // Sort locations by state then city for consistent clustering
  locations.sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    return (a.city || '').localeCompare(b.city || '');
  });

  for (let i = 0; i < locations.length; i++) {
    if (assigned.has(i)) continue;

    const seedLocation = locations[i];
    const clusterLocations = [seedLocation];
    assigned.add(i);

    // Find all locations within radius of any cluster member
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < locations.length; j++) {
        if (assigned.has(j)) continue;

        const candidate = locations[j];
        // Check if candidate is within radius of any cluster member
        for (const member of clusterLocations) {
          const distance = haversineDistance(
            parseFloat(member.latitude),
            parseFloat(member.longitude),
            parseFloat(candidate.latitude),
            parseFloat(candidate.longitude)
          );

          if (distance <= radiusMiles) {
            clusterLocations.push(candidate);
            assigned.add(j);
            changed = true;
            break;
          }
        }
      }
    }

    // Calculate cluster metrics
    const centroid = calculateCentroid(clusterLocations);
    const alfLocations = clusterLocations.filter(l => l.type === 'alf');
    const hhaLocations = clusterLocations.filter(l => l.type === 'hha');
    const states = [...new Set(clusterLocations.map(l => l.state))].sort();
    const cbsas = [...new Set(clusterLocations.map(l => l.cbsa_name).filter(Boolean))].sort();

    // Determine cluster name (use largest city or CBSA)
    const cityCounts = {};
    clusterLocations.forEach(l => {
      if (l.city) {
        cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
      }
    });
    const primaryCity = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    const clusterName = cbsas.length > 0
      ? cbsas[0].split(',')[0] // Use first part of CBSA name
      : `${primaryCity}, ${states[0]}`;

    clusters.push({
      cluster_id: `cluster_${clusterNum}`,
      cluster_name: clusterName,
      center_lat: centroid.lat,
      center_lng: centroid.lng,
      radius_miles: radiusMiles,
      locations: clusterLocations.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        address: l.address,
        city: l.city,
        state: l.state,
        zip_code: l.zip_code,
        latitude: parseFloat(l.latitude),
        longitude: parseFloat(l.longitude),
        capacity: l.capacity ? parseInt(l.capacity) : null,
        cbsa_code: l.cbsa_code,
        cbsa_name: l.cbsa_name
      })),
      alf_count: alfLocations.length,
      alf_capacity: alfLocations.reduce((sum, l) => sum + (parseInt(l.capacity) || 0), 0),
      hha_count: hhaLocations.length,
      states,
      cbsas
    });

    clusterNum++;
  }

  console.log(`[PennantCluster] Identified ${clusters.length} clusters`);
  cache.set(cacheKey, clusters);
  return clusters;
}

/**
 * Calculate SNF proximity data for a cluster center
 * @param {number} centerLat - Cluster center latitude
 * @param {number} centerLng - Cluster center longitude
 * @param {number} radiusMiles - Search radius (default 30)
 * @returns {Promise<Object>} SNF proximity data
 */
async function calculateSNFProximity(centerLat, centerLng, radiusMiles = 30) {
  const pool = getMarketPool();

  // Query SNFs within radius using Haversine formula in SQL
  const result = await pool.query(`
    WITH snf_distances AS (
      SELECT
        federal_provider_number as ccn,
        facility_name,
        address,
        city,
        state,
        zip_code,
        latitude,
        longitude,
        certified_beds,
        overall_rating,
        parent_organization,
        chain_name,
        cbsa_code,
        -- Haversine distance calculation
        3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude))
          ))
        ) as distance_miles,
        -- Check if Ensign
        CASE WHEN (
          parent_organization ILIKE '%ensign%' OR
          chain_name ILIKE '%ensign%' OR
          facility_name ILIKE '%ensign%'
        ) THEN true ELSE false END as is_ensign
      FROM snf_facilities
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN $1 - ($3 / 69.0) AND $1 + ($3 / 69.0)
        AND longitude BETWEEN $2 - ($3 / (69.0 * cos(radians($1)))) AND $2 + ($3 / (69.0 * cos(radians($1))))
    )
    SELECT *
    FROM snf_distances
    WHERE distance_miles <= $3
    ORDER BY distance_miles
  `, [centerLat, centerLng, radiusMiles]);

  const snfs = result.rows;
  const ensignSnfs = snfs.filter(s => s.is_ensign);
  const nonEnsignSnfs = snfs.filter(s => !s.is_ensign);

  // Calculate aggregate metrics
  const totalBeds = snfs.reduce((sum, s) => sum + (parseInt(s.certified_beds) || 0), 0);
  const ensignBeds = ensignSnfs.reduce((sum, s) => sum + (parseInt(s.certified_beds) || 0), 0);
  const nonEnsignBeds = nonEnsignSnfs.reduce((sum, s) => sum + (parseInt(s.certified_beds) || 0), 0);

  const ratedSnfs = snfs.filter(s => s.overall_rating != null);
  const avgRating = ratedSnfs.length > 0
    ? ratedSnfs.reduce((sum, s) => sum + parseFloat(s.overall_rating), 0) / ratedSnfs.length
    : null;

  return {
    total_snf_count: snfs.length,
    total_snf_beds: totalBeds,
    ensign_snf_count: ensignSnfs.length,
    ensign_snf_beds: ensignBeds,
    non_ensign_snf_count: nonEnsignSnfs.length,
    non_ensign_snf_beds: nonEnsignBeds,
    avg_quality_rating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
    snf_list: snfs.slice(0, 20).map(s => ({
      ccn: s.ccn,
      facility_name: s.facility_name,
      address: s.address,
      city: s.city,
      state: s.state,
      distance_miles: parseFloat(s.distance_miles.toFixed(2)),
      certified_beds: parseInt(s.certified_beds) || 0,
      overall_rating: s.overall_rating ? parseFloat(s.overall_rating) : null,
      is_ensign: s.is_ensign,
      parent_organization: s.parent_organization
    }))
  };
}

/**
 * Calculate opportunity score for a cluster
 * @param {Object} cluster - Cluster data
 * @param {Object} snfProximity - SNF proximity data
 * @returns {Object} Opportunity metrics
 */
function calculateClusterOpportunityScore(cluster, snfProximity) {
  // Opportunity score formula:
  // - ALF residents are prime candidates for HHA services and SNF transitions
  // - HHA presence indicates existing care coordination capability
  // - Ensign SNFs represent partnership potential (same parent company history)
  // - Non-Ensign SNFs are potential referral sources

  const alfValue = (cluster.alf_capacity || 0) * 0.5;
  const hhaValue = (cluster.hha_count || 0) * 20;
  const ensignValue = (snfProximity.ensign_snf_beds || 0) * 0.3;
  const otherSnfValue = (snfProximity.non_ensign_snf_beds || 0) * 0.1;

  const opportunityScore = Math.round(alfValue + hhaValue + ensignValue + otherSnfValue);

  // Ensign affinity: percentage of nearby SNF beds that are Ensign
  const ensignAffinity = snfProximity.total_snf_beds > 0
    ? parseFloat(((snfProximity.ensign_snf_beds / snfProximity.total_snf_beds) * 100).toFixed(1))
    : 0;

  // Market density: SNF beds per Pennant location
  const totalPennantLocations = (cluster.alf_count || 0) + (cluster.hha_count || 0);
  const marketDensity = totalPennantLocations > 0
    ? Math.round(snfProximity.total_snf_beds / totalPennantLocations)
    : 0;

  return {
    opportunity_score: opportunityScore,
    ensign_affinity: ensignAffinity,
    market_density: marketDensity,
    score_components: {
      alf_value: Math.round(alfValue),
      hha_value: Math.round(hhaValue),
      ensign_value: Math.round(ensignValue),
      other_snf_value: Math.round(otherSnfValue)
    }
  };
}

/**
 * Generate complete cluster analysis with SNF proximity
 * @param {number} radiusMiles - Clustering radius (default 30)
 * @returns {Promise<Object>} Complete cluster analysis
 */
async function generateAllClusters(radiusMiles = 30) {
  const cacheKey = `pennant_all_clusters_${radiusMiles}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[PennantCluster] Using cached full cluster analysis');
    return cached;
  }

  console.log(`[PennantCluster] Generating full cluster analysis (${radiusMiles} mile radius)`);

  // Get base clusters
  const clusters = await identifyPennantClusters(radiusMiles);

  // Enrich each cluster with SNF proximity data
  const enrichedClusters = [];
  let totalNearbySnfs = 0;
  let totalNearbySnfBeds = 0;
  let totalEnsignSnfs = 0;
  let totalEnsignBeds = 0;

  for (const cluster of clusters) {
    console.log(`[PennantCluster] Processing cluster: ${cluster.cluster_name}`);

    const snfProximity = await calculateSNFProximity(
      cluster.center_lat,
      cluster.center_lng,
      radiusMiles
    );

    const opportunityMetrics = calculateClusterOpportunityScore(cluster, snfProximity);

    // Accumulate totals
    totalNearbySnfs += snfProximity.total_snf_count;
    totalNearbySnfBeds += snfProximity.total_snf_beds;
    totalEnsignSnfs += snfProximity.ensign_snf_count;
    totalEnsignBeds += snfProximity.ensign_snf_beds;

    enrichedClusters.push({
      cluster_id: cluster.cluster_id,
      cluster_name: cluster.cluster_name,
      center_lat: cluster.center_lat,
      center_lng: cluster.center_lng,
      radius_miles: cluster.radius_miles,
      pennant_locations: {
        alf_count: cluster.alf_count,
        alf_capacity: cluster.alf_capacity,
        hha_count: cluster.hha_count,
        total: cluster.alf_count + cluster.hha_count
      },
      snf_proximity: {
        total_count: snfProximity.total_snf_count,
        total_beds: snfProximity.total_snf_beds,
        ensign_count: snfProximity.ensign_snf_count,
        ensign_beds: snfProximity.ensign_snf_beds,
        non_ensign_count: snfProximity.non_ensign_snf_count,
        non_ensign_beds: snfProximity.non_ensign_snf_beds,
        avg_quality: snfProximity.avg_quality_rating
      },
      opportunity_score: opportunityMetrics.opportunity_score,
      ensign_affinity: opportunityMetrics.ensign_affinity,
      market_density: opportunityMetrics.market_density,
      score_components: opportunityMetrics.score_components,
      states: cluster.states,
      cbsas: cluster.cbsas,
      // Store full location list for detail endpoint
      _locations: cluster.locations,
      _snf_list: snfProximity.snf_list
    });
  }

  // Sort by opportunity score descending
  enrichedClusters.sort((a, b) => b.opportunity_score - a.opportunity_score);

  // Calculate summary stats
  const totalPennantLocations = enrichedClusters.reduce(
    (sum, c) => sum + c.pennant_locations.total, 0
  );

  const result = {
    summary: {
      total_clusters: enrichedClusters.length,
      total_pennant_locations: totalPennantLocations,
      total_nearby_snfs: totalNearbySnfs,
      total_nearby_snf_beds: totalNearbySnfBeds,
      ensign_snf_count: totalEnsignSnfs,
      ensign_snf_beds: totalEnsignBeds,
      avg_opportunity_score: enrichedClusters.length > 0
        ? Math.round(enrichedClusters.reduce((sum, c) => sum + c.opportunity_score, 0) / enrichedClusters.length)
        : 0,
      top_cluster: enrichedClusters[0]?.cluster_name || null
    },
    clusters: enrichedClusters.map(c => {
      // Remove internal fields from public response
      const { _locations, _snf_list, ...publicCluster } = c;
      return publicCluster;
    })
  };

  console.log(`[PennantCluster] Analysis complete: ${result.summary.total_clusters} clusters`);
  cache.set(cacheKey, result);
  return result;
}

/**
 * Get detailed cluster data including all locations and SNFs
 * @param {string} clusterId - Cluster ID
 * @param {number} radiusMiles - Search radius
 * @returns {Promise<Object|null>} Detailed cluster or null if not found
 */
async function getClusterDetail(clusterId, radiusMiles = 30) {
  const allData = await generateAllClusters(radiusMiles);

  // Find the cluster (with internal data)
  const clusters = await identifyPennantClusters(radiusMiles);
  const baseCluster = clusters.find(c => c.cluster_id === clusterId);

  if (!baseCluster) {
    return null;
  }

  // Get fresh SNF proximity data
  const snfProximity = await calculateSNFProximity(
    baseCluster.center_lat,
    baseCluster.center_lng,
    radiusMiles
  );

  const opportunityMetrics = calculateClusterOpportunityScore(baseCluster, snfProximity);

  return {
    cluster_id: baseCluster.cluster_id,
    cluster_name: baseCluster.cluster_name,
    center_lat: baseCluster.center_lat,
    center_lng: baseCluster.center_lng,
    radius_miles: baseCluster.radius_miles,
    pennant_locations: {
      alf_count: baseCluster.alf_count,
      alf_capacity: baseCluster.alf_capacity,
      hha_count: baseCluster.hha_count,
      total: baseCluster.alf_count + baseCluster.hha_count,
      locations: baseCluster.locations
    },
    snf_proximity: {
      total_count: snfProximity.total_snf_count,
      total_beds: snfProximity.total_snf_beds,
      ensign_count: snfProximity.ensign_snf_count,
      ensign_beds: snfProximity.ensign_snf_beds,
      non_ensign_count: snfProximity.non_ensign_snf_count,
      non_ensign_beds: snfProximity.non_ensign_snf_beds,
      avg_quality: snfProximity.avg_quality_rating,
      snf_list: snfProximity.snf_list
    },
    opportunity_score: opportunityMetrics.opportunity_score,
    ensign_affinity: opportunityMetrics.ensign_affinity,
    market_density: opportunityMetrics.market_density,
    score_components: opportunityMetrics.score_components,
    states: baseCluster.states,
    cbsas: baseCluster.cbsas
  };
}

/**
 * Get SNF list for a specific cluster
 * @param {string} clusterId - Cluster ID
 * @param {number} radiusMiles - Search radius
 * @param {string} sortBy - Sort field: 'distance', 'beds', 'rating'
 * @param {string} sortDir - Sort direction: 'asc', 'desc'
 * @returns {Promise<Object|null>} SNF list or null if cluster not found
 */
async function getClusterSNFs(clusterId, radiusMiles = 30, sortBy = 'distance', sortDir = 'asc') {
  const clusters = await identifyPennantClusters(radiusMiles);
  const cluster = clusters.find(c => c.cluster_id === clusterId);

  if (!cluster) {
    return null;
  }

  const pool = getMarketPool();

  // Get all SNFs within radius (not limited to 20)
  const result = await pool.query(`
    WITH snf_distances AS (
      SELECT
        federal_provider_number as ccn,
        facility_name,
        address,
        city,
        state,
        zip_code,
        latitude,
        longitude,
        certified_beds,
        overall_rating,
        parent_organization,
        chain_name,
        cbsa_code,
        3959 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude))
          ))
        ) as distance_miles,
        CASE WHEN (
          parent_organization ILIKE '%ensign%' OR
          chain_name ILIKE '%ensign%' OR
          facility_name ILIKE '%ensign%'
        ) THEN true ELSE false END as is_ensign
      FROM snf_facilities
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude BETWEEN $1 - ($3 / 69.0) AND $1 + ($3 / 69.0)
        AND longitude BETWEEN $2 - ($3 / (69.0 * cos(radians($1)))) AND $2 + ($3 / (69.0 * cos(radians($1))))
    )
    SELECT *
    FROM snf_distances
    WHERE distance_miles <= $3
    ORDER BY distance_miles
  `, [cluster.center_lat, cluster.center_lng, radiusMiles]);

  let snfs = result.rows.map(s => ({
    ccn: s.ccn,
    facility_name: s.facility_name,
    address: s.address,
    city: s.city,
    state: s.state,
    zip_code: s.zip_code,
    distance_miles: parseFloat(s.distance_miles.toFixed(2)),
    certified_beds: parseInt(s.certified_beds) || 0,
    overall_rating: s.overall_rating ? parseFloat(s.overall_rating) : null,
    is_ensign: s.is_ensign,
    parent_organization: s.parent_organization
  }));

  // Apply sorting
  switch (sortBy) {
    case 'beds':
      snfs.sort((a, b) => sortDir === 'asc'
        ? a.certified_beds - b.certified_beds
        : b.certified_beds - a.certified_beds);
      break;
    case 'rating':
      snfs.sort((a, b) => {
        const aRating = a.overall_rating || 0;
        const bRating = b.overall_rating || 0;
        return sortDir === 'asc' ? aRating - bRating : bRating - aRating;
      });
      break;
    case 'distance':
    default:
      snfs.sort((a, b) => sortDir === 'asc'
        ? a.distance_miles - b.distance_miles
        : b.distance_miles - a.distance_miles);
  }

  return {
    cluster_id: cluster.cluster_id,
    cluster_name: cluster.cluster_name,
    center_lat: cluster.center_lat,
    center_lng: cluster.center_lng,
    radius_miles: radiusMiles,
    total_snfs: snfs.length,
    ensign_count: snfs.filter(s => s.is_ensign).length,
    snfs
  };
}

/**
 * Get aggregate SNF proximity summary across all Pennant locations
 * @param {number} radiusMiles - Search radius
 * @returns {Promise<Object>} Aggregate SNF proximity data
 */
async function getSNFProximitySummary(radiusMiles = 30) {
  const cacheKey = `snf_proximity_summary_${radiusMiles}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('[PennantCluster] Using cached SNF proximity summary');
    return cached;
  }

  const allData = await generateAllClusters(radiusMiles);

  // Calculate market breakdown
  const marketBreakdown = allData.clusters
    .map(c => ({
      cluster_name: c.cluster_name,
      cluster_id: c.cluster_id,
      snf_count: c.snf_proximity.total_count,
      snf_beds: c.snf_proximity.total_beds,
      ensign_count: c.snf_proximity.ensign_count,
      ensign_beds: c.snf_proximity.ensign_beds,
      ensign_affinity: c.ensign_affinity,
      pennant_locations: c.pennant_locations.total
    }))
    .sort((a, b) => b.snf_count - a.snf_count);

  const result = {
    radius_miles: radiusMiles,
    aggregate: {
      total_snfs: allData.summary.total_nearby_snfs,
      total_snf_beds: allData.summary.total_nearby_snf_beds,
      ensign_snf_count: allData.summary.ensign_snf_count,
      ensign_snf_beds: allData.summary.ensign_snf_beds,
      non_ensign_snf_count: allData.summary.total_nearby_snfs - allData.summary.ensign_snf_count,
      non_ensign_snf_beds: allData.summary.total_nearby_snf_beds - allData.summary.ensign_snf_beds,
      ensign_bed_share: allData.summary.total_nearby_snf_beds > 0
        ? parseFloat(((allData.summary.ensign_snf_beds / allData.summary.total_nearby_snf_beds) * 100).toFixed(1))
        : 0
    },
    top_markets_by_snf_density: marketBreakdown.slice(0, 10),
    markets_with_ensign_presence: marketBreakdown
      .filter(m => m.ensign_count > 0)
      .sort((a, b) => b.ensign_count - a.ensign_count)
      .slice(0, 10)
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Clear the cluster analysis cache
 */
function clearCache() {
  cache.clear();
  console.log('[PennantCluster] Cache cleared');
}

module.exports = {
  identifyPennantClusters,
  calculateSNFProximity,
  calculateClusterOpportunityScore,
  generateAllClusters,
  getClusterDetail,
  getClusterSNFs,
  getSNFProximitySummary,
  haversineDistance,
  clearCache
};
