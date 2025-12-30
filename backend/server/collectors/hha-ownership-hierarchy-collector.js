/**
 * HHA Ownership Hierarchy Collector
 *
 * Auto-populates ownership_subsidiaries table from PECOS HHA ownership data.
 *
 * PRIORITY SYSTEM:
 * This collector uses an ownership priority system to identify the correct
 * "ultimate operating parent" for each subsidiary:
 *
 *   Priority 1: INDIRECT ownership (100%) - NOT PE/REIT/Investment firm
 *               (This is the ultimate parent company, e.g., Pennant Group)
 *   Priority 2: DIRECT ownership - NOT PE/REIT/Investment firm
 *               (This is the immediate legal parent, e.g., Cornerstone Healthcare)
 *   Priority 3: OPERATIONAL/MANAGERIAL CONTROL - NOT PE/REIT
 *   Priority 4: Any other non-PE ownership
 *
 * PE/REIT/Investment firms are tracked separately in the pe_investors column
 * rather than being assigned as the parent company.
 *
 * Run: node server/collectors/hha-ownership-hierarchy-collector.js
 *
 * Data Flow:
 *   hha_owners (THE PENNANT GROUP INC - indirect owner)
 *     → hha_enrollments (MOHAVE HEALTHCARE INC)
 *       → ownership_subsidiaries (parent = THE PENNANT GROUP)
 */

const { Pool } = require('pg');

// Market database connection
const pool = new Pool({
  connectionString: process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Ownership priority levels (lower = higher priority)
 */
const OWNERSHIP_PRIORITY = {
  'INDIRECT_NON_PE': 1,      // Ultimate parent (Pennant, Ensign, etc.)
  'DIRECT_NON_PE': 2,        // Immediate legal parent (Cornerstone, etc.)
  'OPERATIONAL_NON_PE': 3,   // Management company
  'OTHER_NON_PE': 4,         // Other ownership types
  'PE_REIT_INVESTMENT': 99   // Excluded from parent assignment
};

/**
 * Normalize company name for consistent matching
 *
 * @param {string} name - Raw company name
 * @returns {object} { normalized: string, original: string }
 */
function normalizeCompanyName(name) {
  if (!name) return { normalized: '', original: '' };

  const original = name.trim();

  // Uppercase for comparison
  let normalized = original.toUpperCase();

  // Remove common suffixes with various punctuation patterns
  const suffixPatterns = [
    /,?\s*(LLC|L\.L\.C\.?|L L C)\.?$/i,
    /,?\s*(INC|INC\.|INCORPORATED)\.?$/i,
    /,?\s*(CORP|CORP\.|CORPORATION)\.?$/i,
    /,?\s*(LTD|LTD\.|LIMITED)\.?$/i,
    /,?\s*(LP|L\.P\.?|LIMITED PARTNERSHIP)\.?$/i,
    /,?\s*(LLP|L\.L\.P\.?)\.?$/i,
    /,?\s*(PC|P\.C\.?|PROFESSIONAL CORPORATION)\.?$/i,
    /,?\s*(PLLC|P\.L\.L\.C\.?)\.?$/i,
    /,?\s*(CO|CO\.|COMPANY)\.?$/i,
  ];

  for (const pattern of suffixPatterns) {
    normalized = normalized.replace(pattern, '');
  }

  // Normalize "THE " prefix - keep it but standardize
  normalized = normalized.replace(/^THE\s+/, 'THE ');

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove trailing punctuation
  normalized = normalized.replace(/[.,;:]+$/, '').trim();

  return { normalized, original };
}

/**
 * Detect PE/VC/Investment firms by name patterns
 * Many PE firms are not flagged in the database, so we detect by name
 */
function isPEByName(name) {
  if (!name) return false;
  const upper = name.toUpperCase();

  // Known PE/VC firm name patterns
  const pePatterns = [
    // Fund structures
    /\bFUND\s+[IVXLC]+\b/,           // FUND I, FUND II, FUND XI, etc.
    /\bFUND\s+\d+\b/,                 // FUND 1, FUND 2, etc.
    /\bLP\s*$/,                        // Ends in LP (Limited Partnership)
    /\bL\.P\.?\s*$/,                   // Ends in L.P.
    /\bLIMITED PARTNERSHIP\b/,
    /\bCO-INVEST/,                     // Co-investment funds
    /\bCO INVEST/,

    // Investment firm keywords
    /\bCAPITAL PARTNERS\b/,
    /\bPRIVATE EQUITY\b/,
    /\bVENTURE CAPITAL\b/,
    /\bHOLDINGS?\s+L\.?P\.?\b/,        // HOLDINGS LP
    /\bINVESTORS?\s+L\.?P\.?\b/,       // INVESTOR LP, INVESTORS LP
    /\bACQUISITION\b/,
    /\bAGGREGATOR\b/,

    // Specific well-known PE firms
    /^BAIN CAPITAL/,
    /^BLACKSTONE/,
    /^KKR\b/,
    /^CARLYLE/,
    /^WARBURG PINCUS/,
    /^ADVENT INTERNATIONAL/,
    /^TPG\b/,
    /^APOLLO/,
    /^VANGUARD/,
    /^BLACKROCK/,
    /^FIDELITY/,
    /^STATE STREET/,
    /^WELLINGTON/,
    /^HAMILTON LANE/,
    /^J\.?H\.? WHITNEY/,
    /^BLUE WOLF/,
    /^KELSO/,
    /^STEPSTONE/,
    /^TOWERBROOK/,
    /^NAUTIC PARTNERS/,
    /^DEERFIELD/,
    /^BCIP\b/,
    /^BCPE\b/,
    /^PEA\b.*HOLDINGS/,
    /^NUT TREE/,

    // Trust/pension patterns that indicate passive investors
    /\bPENSION\b/,
    /\bRETIREMENT SYSTEM\b/,
    /\bENDOWMENT\b/,
    /\bTRUST\b.*\bFUND\b/,
    /\bIRREVOCABLE TRUST\b/,
    /\bFAMILY TRUST\b/,
    /^YALE UNIVERSITY$/,
    /^HARVARD/,
    /^MIT\b/,
  ];

  return pePatterns.some(pattern => pattern.test(upper));
}

/**
 * Determine ownership priority based on role and PE/REIT flags
 */
function getOwnershipPriority(owner) {
  const flaggedAsPE = owner.private_equity_owner || owner.reit_owner || owner.investment_firm_owner;
  const detectedAsPE = isPEByName(owner.organization_name_owner);
  const isPE = flaggedAsPE || detectedAsPE;
  const role = owner.role_text_owner || '';

  if (isPE) {
    return OWNERSHIP_PRIORITY.PE_REIT_INVESTMENT;
  }

  if (role.includes('INDIRECT')) {
    return OWNERSHIP_PRIORITY.INDIRECT_NON_PE;
  }

  if (role.includes('DIRECT')) {
    return OWNERSHIP_PRIORITY.DIRECT_NON_PE;
  }

  if (role.includes('OPERATIONAL') || role.includes('MANAGERIAL')) {
    return OWNERSHIP_PRIORITY.OPERATIONAL_NON_PE;
  }

  return OWNERSHIP_PRIORITY.OTHER_NON_PE;
}

/**
 * Get the latest extract_id from hha_ownership_extracts
 */
async function getLatestExtractId() {
  const result = await pool.query(`
    SELECT extract_id, extract_date
    FROM hha_ownership_extracts
    WHERE import_status = 'completed'
    ORDER BY extract_date DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    throw new Error('No completed HHA ownership extracts found');
  }

  return result.rows[0];
}

/**
 * Get all unique subsidiaries (organization_name from hha_enrollments)
 * that have organizational owners
 */
async function getAllSubsidiaries(extractId) {
  console.log('\nFinding all subsidiaries with organizational owners...');

  const result = await pool.query(`
    SELECT DISTINCT
      e.organization_name AS subsidiary_name,
      COUNT(DISTINCT e.ccn) AS agency_count,
      ARRAY_AGG(DISTINCT e.enrollment_state ORDER BY e.enrollment_state) AS states,
      ARRAY_AGG(DISTINCT e.doing_business_as ORDER BY e.doing_business_as)
        FILTER (WHERE e.doing_business_as IS NOT NULL AND e.doing_business_as != '') AS dba_names
    FROM hha_enrollments e
    JOIN hha_owners o ON e.enrollment_id = o.enrollment_id AND e.extract_id = o.extract_id
    WHERE e.extract_id = $1
      AND o.type_owner = 'O'
      AND o.organization_name_owner IS NOT NULL
      AND o.organization_name_owner != ''
    GROUP BY e.organization_name
    ORDER BY agency_count DESC
  `, [extractId]);

  console.log(`Found ${result.rows.length} unique subsidiaries`);
  return result.rows;
}

/**
 * Get all organizational owners for a specific subsidiary
 */
async function getOwnersForSubsidiary(extractId, subsidiaryName) {
  const result = await pool.query(`
    SELECT DISTINCT
      o.organization_name_owner,
      o.role_text_owner,
      o.percentage_ownership,
      o.private_equity_owner,
      o.reit_owner,
      o.investment_firm_owner
    FROM hha_owners o
    JOIN hha_enrollments e ON o.enrollment_id = e.enrollment_id AND o.extract_id = e.extract_id
    WHERE o.extract_id = $1
      AND e.organization_name = $2
      AND o.type_owner = 'O'
      AND o.organization_name_owner IS NOT NULL
      AND o.organization_name_owner != ''
    ORDER BY o.percentage_ownership DESC NULLS LAST
  `, [extractId, subsidiaryName]);

  return result.rows;
}

/**
 * Select the best parent based on priority system
 * Also returns list of PE/REIT investors
 */
function selectBestParent(owners) {
  let bestParent = null;
  let bestPriority = 999;
  const peInvestors = [];

  for (const owner of owners) {
    const priority = getOwnershipPriority(owner);

    // Collect PE/REIT investors separately
    if (priority === OWNERSHIP_PRIORITY.PE_REIT_INVESTMENT) {
      peInvestors.push(owner.organization_name_owner);
      continue;
    }

    // Check if this is a better parent
    if (priority < bestPriority) {
      bestPriority = priority;
      bestParent = owner;
    } else if (priority === bestPriority && bestParent) {
      // Same priority - prefer higher ownership percentage
      const currentPct = bestParent.percentage_ownership || 0;
      const newPct = owner.percentage_ownership || 0;
      if (newPct > currentPct) {
        bestParent = owner;
      }
    }
  }

  return { bestParent, peInvestors };
}

/**
 * Upsert a subsidiary record with the best parent
 */
async function upsertSubsidiary(parentCanonical, subsidiary, peInvestors, extractId) {
  await pool.query(`
    INSERT INTO ownership_subsidiaries (
      parent_canonical_name,
      subsidiary_name,
      care_type,
      agency_count,
      states_operated,
      dba_names,
      pe_investors,
      verified,
      source,
      last_extract_id,
      updated_at
    ) VALUES ($1, $2, 'HHA', $3, $4, $5, $6, false, 'pecos_auto', $7, NOW())
    ON CONFLICT (subsidiary_name, care_type)
    DO UPDATE SET
      parent_canonical_name = EXCLUDED.parent_canonical_name,
      agency_count = EXCLUDED.agency_count,
      states_operated = EXCLUDED.states_operated,
      dba_names = EXCLUDED.dba_names,
      pe_investors = EXCLUDED.pe_investors,
      last_extract_id = EXCLUDED.last_extract_id,
      updated_at = NOW()
    WHERE ownership_subsidiaries.source = 'pecos_auto'
  `, [
    parentCanonical,
    subsidiary.subsidiary_name,
    subsidiary.agency_count,
    subsidiary.states || [],
    subsidiary.dba_names || [],
    peInvestors.length > 0 ? peInvestors : null,
    extractId
  ]);
}

/**
 * Upsert a name variant
 */
async function upsertNameVariant(canonicalName, variantName, sourceContext) {
  await pool.query(`
    INSERT INTO ownership_name_variants (canonical_name, variant_name, source_context)
    VALUES ($1, $2, $3)
    ON CONFLICT (variant_name, source_context) DO UPDATE SET
      canonical_name = EXCLUDED.canonical_name
  `, [canonicalName, variantName, sourceContext]);
}

/**
 * Main collector function
 */
async function collectHHAOwnershipHierarchy() {
  console.log('='.repeat(60));
  console.log('HHA Ownership Hierarchy Collector (Priority-Based)');
  console.log('='.repeat(60));
  console.log('\nPriority System:');
  console.log('  1. INDIRECT ownership (ultimate parent) - NOT PE/REIT');
  console.log('  2. DIRECT ownership (immediate parent) - NOT PE/REIT');
  console.log('  3. OPERATIONAL/MANAGERIAL control - NOT PE/REIT');
  console.log('  4. Other ownership - NOT PE/REIT');
  console.log('  X. PE/REIT/Investment firms -> stored in pe_investors column');

  try {
    // Get latest extract
    const { extract_id: extractId, extract_date: extractDate } = await getLatestExtractId();
    console.log(`\nUsing extract ID ${extractId} (${extractDate.toISOString().split('T')[0]})`);

    // Clear existing auto-detected records for fresh run
    console.log('\nClearing existing pecos_auto records...');
    await pool.query(`DELETE FROM ownership_subsidiaries WHERE source = 'pecos_auto' AND care_type = 'HHA'`);

    // Get all subsidiaries
    const subsidiaries = await getAllSubsidiaries(extractId);

    if (subsidiaries.length === 0) {
      console.log('No subsidiaries found');
      return;
    }

    // Stats tracking
    let processed = 0;
    let withParent = 0;
    let withPE = 0;
    let skipped = 0;
    const parentCounts = {};
    const allStates = new Set();

    // Process each subsidiary
    console.log('\nProcessing subsidiaries...\n');

    for (const subsidiary of subsidiaries) {
      processed++;

      // Get all owners for this subsidiary
      const owners = await getOwnersForSubsidiary(extractId, subsidiary.subsidiary_name);

      if (owners.length === 0) {
        skipped++;
        continue;
      }

      // Select best parent using priority system
      const { bestParent, peInvestors } = selectBestParent(owners);

      if (!bestParent) {
        // Only PE/REIT owners found - skip this subsidiary
        skipped++;
        continue;
      }

      const { normalized: parentCanonical, original: parentOriginal } =
        normalizeCompanyName(bestParent.organization_name_owner);

      // Upsert the subsidiary
      await upsertSubsidiary(parentCanonical, subsidiary, peInvestors, extractId);
      withParent++;

      if (peInvestors.length > 0) {
        withPE++;
      }

      // Track parent counts
      parentCounts[parentCanonical] = (parentCounts[parentCanonical] || 0) + 1;

      // Track states
      if (subsidiary.states) {
        subsidiary.states.forEach(s => allStates.add(s));
      }

      // Record name variants
      await upsertNameVariant(parentCanonical, parentOriginal, 'hha_pecos');
      const { normalized: subNormalized } = normalizeCompanyName(subsidiary.subsidiary_name);
      await upsertNameVariant(subNormalized, subsidiary.subsidiary_name, 'hha_pecos');

      // Progress indicator
      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${subsidiaries.length} subsidiaries...`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('COLLECTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Subsidiaries Processed: ${processed}`);
    console.log(`Assigned to Operating Parent: ${withParent}`);
    console.log(`With PE/REIT Investors:       ${withPE}`);
    console.log(`Skipped (PE-only or none):    ${skipped}`);
    console.log(`Unique Parent Companies:      ${Object.keys(parentCounts).length}`);
    console.log(`States Covered:               ${allStates.size} (${Array.from(allStates).sort().join(', ')})`);
    console.log(`Extract ID:                   ${extractId}`);
    console.log(`Extract Date:                 ${extractDate.toISOString().split('T')[0]}`);

    // Top 10 parents by subsidiary count
    console.log('\nTop 10 Parent Companies by Subsidiary Count:');
    const sortedParents = Object.entries(parentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [parent, count] of sortedParents) {
      console.log(`  ${count.toString().padStart(3)} subsidiaries: ${parent}`);
    }

    // Verify data was written
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT parent_canonical_name) as unique_parents,
        SUM(agency_count) as total_agencies,
        COUNT(*) FILTER (WHERE pe_investors IS NOT NULL) as with_pe
      FROM ownership_subsidiaries
      WHERE care_type = 'HHA' AND source = 'pecos_auto'
    `);

    console.log('\nDATABASE VERIFICATION');
    console.log('-'.repeat(40));
    console.log(`Records in ownership_subsidiaries: ${verifyResult.rows[0].total_records}`);
    console.log(`Unique parent companies:           ${verifyResult.rows[0].unique_parents}`);
    console.log(`Total agencies mapped:             ${verifyResult.rows[0].total_agencies}`);
    console.log(`Subsidiaries with PE investors:    ${verifyResult.rows[0].with_pe}`);

    const variantResult = await pool.query(`
      SELECT COUNT(*) as count FROM ownership_name_variants WHERE source_context = 'hha_pecos'
    `);
    console.log(`Name variants recorded:            ${variantResult.rows[0].count}`);

    console.log('\nCollection complete!');

  } catch (error) {
    console.error('Error in HHA ownership hierarchy collector:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  collectHHAOwnershipHierarchy()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { collectHHAOwnershipHierarchy, normalizeCompanyName, getOwnershipPriority, isPEByName };
