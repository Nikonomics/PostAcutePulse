const { query } = require("express");
const jwt = require("jsonwebtoken");
const jwtToken = process.env.JWT_SECRET;
const bcrypt = require("bcryptjs");
let helper = require("../config/helper");
const db = require("../models");
const sequelize = require("sequelize");
const Op = sequelize.Op;

// Helper function for cross-database date difference calculation
const getDateDiffLiteral = (col1, col2) => {
  const dialect = db.sequelize.getDialect();
  if (dialect === 'postgres') {
    // PostgreSQL: subtract dates and extract days
    return sequelize.literal(`EXTRACT(DAY FROM "${col1}" - "${col2}")`);
  } else {
    // SQLite: use julianday
    return sequelize.literal(`CAST(julianday("${col1}") - julianday("${col2}") AS INTEGER)`);
  }
};
const { sendBrevoEmail } = require("../config/sendMail");
const { extractDealFromDocument, extractFromMultipleDocuments } = require("../services/aiExtractor");
const { runFullExtraction, storeExtractionResults } = require("../services/extractionOrchestrator");
const { saveFiles, getFile, getDealFiles, UPLOAD_DIR } = require("../services/fileStorage");
const {
  matchFacility,
  detectFacilitiesFromText,
  matchFacilityToDatabase,
  searchFacilityByName,
  getDatabaseStats
} = require("../services/facilityMatcher");
const extractionMerger = require("../services/extractionMerger");
const {
  calculateDealMetrics: calcDealMetrics,
  calculatePortfolioMetrics: calcPortfolioMetrics,
  calculateEnhancedMetrics: calcEnhancedMetrics,
  calculateEnhancedPortfolioMetrics: calcEnhancedPortfolioMetrics
} = require("../services/calculatorService");
const {
  calculateProforma,
  generateYearlyProjections,
  normalizeBenchmarkConfig,
  DEFAULT_BENCHMARKS
} = require("../services/proformaService");
const { detectChanges, formatChangeSummary } = require("../services/dealChangeTracker");
const { isValidFlatFormat, sanitizeExtractionData } = require("../services/extractionValidator");
const { createNotification } = require("../services/notificationService");
const { detectChanges: detectFieldChanges, logFacilityChanges } = require("../services/changeLogService");
const User = db.users;
const Deal = db.deals;
const DealTeamMembers = db.deal_team_members;
const DealExternalAdvisors = db.deal_external_advisors;
const RecentActivity = db.recent_activities;
const DealComments = db.deal_comments;
const CommentMentions = db.comment_mentions;
const UserNotification = db.user_notifications;
const DealDocuments = db.deal_documents;
const MasterDeals = db.master_deals;
const DealFacilities = db.deal_facilities;
const BenchmarkConfigurations = db.benchmark_configurations;
const DealProformaScenarios = db.deal_proforma_scenarios;
// Time-series data models for enhanced extraction
const DealMonthlyFinancials = db.deal_monthly_financials;
const DealMonthlyCensus = db.deal_monthly_census;
const DealMonthlyExpenses = db.deal_monthly_expenses;
const DealRateSchedules = db.deal_rate_schedules;
const DealExpenseRatios = db.deal_expense_ratios;
const DealChangeLogs = db.deal_change_logs;
const DealUserViews = db.deal_user_views;
Deal.hasMany(DealTeamMembers, {
  foreignKey: "deal_id",
  as: "deal_team_members",
});
Deal.hasMany(DealExternalAdvisors, {
  foreignKey: "deal_id",
  as: "deal_external_advisors",
});
Deal.hasMany(DealFacilities, {
  foreignKey: "deal_id",
  as: "deal_facility",
  onDelete: 'CASCADE',
});
DealFacilities.belongsTo(Deal, {
  foreignKey: "deal_id",
  as: "deal",
});
Deal.belongsTo(MasterDeals, {
  foreignKey: "master_deal_id",
  as: "master_deal",
});
MasterDeals.hasMany(Deal, {
  foreignKey: "master_deal_id",
  as: "deals",
});
DealTeamMembers.belongsTo(User, { foreignKey: "user_id", as: "user" });
DealExternalAdvisors.belongsTo(User, { foreignKey: "user_id", as: "user" });
Deal.belongsTo(User, { foreignKey: "deal_lead_id", as: "deal_lead" });
Deal.belongsTo(User, {
  foreignKey: "assistant_deal_lead_id",
  as: "assistant_deal_lead",
});
Deal.belongsTo(User, {
  foreignKey: "last_activity_by",
  as: "last_activity_user",
});
DealChangeLogs.belongsTo(User, { foreignKey: "user_id", as: "user" });
DealComments.belongsTo(User, { foreignKey: "user_id", as: "user" });
DealDocuments.belongsTo(User, { foreignKey: "user_id", as: "user" });
CommentMentions.belongsTo(User, {
  foreignKey: "mentioned_user_id",
  as: "user",
});
DealComments.hasMany(DealComments, { as: "replies", foreignKey: "parent_id" });
DealComments.belongsToMany(User, {
  through: "comment_mentions",
  as: "mentioned_users",
  foreignKey: "comment_id",
  otherKey: "mentioned_user_id",
});
const ExtractionHistory = db.extraction_history;

/**
 * Record extraction data changes for audit trail
 *
 * @param {number} dealId - The deal ID
 * @param {Object} extractionData - The extraction data to store
 * @param {string} source - Source of change: 'ai_extraction', 'manual_edit', 'alf_match', 'facility_sync', 'bulk_import'
 * @param {Array} changedFields - Array of field names that changed
 * @param {string} createdBy - User email or system identifier
 * @param {Object} transaction - Optional Sequelize transaction
 */
async function recordExtractionHistory(dealId, extractionData, source, changedFields = [], createdBy = 'system', transaction = null) {
  try {
    const queryOptions = transaction ? { transaction } : {};

    // Ensure ExtractionHistory model exists (may not be loaded yet on first run)
    if (!ExtractionHistory) {
      console.log('[ExtractionHistory] Model not available, skipping history record');
      return null;
    }

    const historyRecord = await ExtractionHistory.create({
      deal_id: dealId,
      extraction_data: extractionData,
      source: source,
      changed_fields: changedFields,
      created_by: createdBy,
      created_at: new Date()
    }, queryOptions);

    console.log(`[ExtractionHistory] Recorded ${source} change for deal ${dealId} (${changedFields.length} fields)`);
    return historyRecord;
  } catch (err) {
    // Don't fail the main operation if history recording fails
    console.error('[ExtractionHistory] Failed to record history:', err.message);
    return null;
  }
}

/**
 * Centralized facility data sync across deals, deal_facilities, and extraction_data
 * Ensures all three data stores stay consistent when facility information changes.
 *
 * @param {number} dealId - The deal ID to sync
 * @param {Object} facilityData - Facility fields to sync
 * @param {string} facilityData.facility_name - Facility name
 * @param {string} facilityData.street_address - Street address
 * @param {string} facilityData.city - City
 * @param {string} facilityData.state - State
 * @param {string} facilityData.zip_code - ZIP code
 * @param {number} facilityData.bed_count - Number of beds
 * @param {number} facilityData.latitude - Latitude coordinate
 * @param {number} facilityData.longitude - Longitude coordinate
 * @param {string} facilityData.facility_type - Facility type (SNF, ALF, etc.)
 * @param {string} source - Source of the data: 'Manual Edit' | 'ALF Database' | 'AI Extraction'
 * @param {Object} transaction - Optional Sequelize transaction for atomic updates
 * @returns {Object} - { deal, facility } - Updated deal and facility records
 */
/**
 * Get available filter options for the map from both deals and Cascadia facilities
 */
async function getMapFilterOptions() {
  const CascadiaFacility = require('../models').CascadiaFacility;

  const filterOptions = {
    statuses: [
      { value: 'pipeline', label: 'Pipeline' },
      { value: 'due_diligence', label: 'Due Diligence' },
      { value: 'hold', label: 'Hold' },
      { value: 'current_operations', label: 'Current Operations' }
    ],
    serviceLines: [
      { value: 'SNF', label: 'SNF' },
      { value: 'ALF', label: 'ALF' },
      { value: 'ILF', label: 'ILF' },
      { value: 'Home Office', label: 'Home Office' }
    ],
    companies: [],
    teams: []
  };

  // Get unique companies and teams from Cascadia facilities
  if (CascadiaFacility) {
    try {
      const companies = await CascadiaFacility.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('company')), 'company']],
        where: { company: { [Op.ne]: null } },
        raw: true
      });
      filterOptions.companies = companies
        .map(c => c.company)
        .filter(Boolean)
        .sort()
        .map(c => ({ value: c, label: c }));

      const teams = await CascadiaFacility.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('team')), 'team']],
        where: { team: { [Op.ne]: null } },
        raw: true
      });
      filterOptions.teams = teams
        .map(t => t.team)
        .filter(Boolean)
        .sort()
        .map(t => ({ value: t, label: t }));
    } catch (err) {
      console.log('Could not fetch Cascadia filter options:', err.message);
    }
  }

  return filterOptions;
}

async function syncFacilityData(dealId, facilityData, source, skipConflictDetection = false, transaction = null) {
  const queryOptions = transaction ? { transaction } : {};

  // Extract facility fields from incoming data (typically from database match)
  const {
    facility_name,
    street_address,
    city,
    state,
    zip_code,
    bed_count,
    latitude,
    longitude,
    facility_type
  } = facilityData;

  // 1. First, load the deal and existing extraction_data to check for conflicts
  const deal = await Deal.findByPk(dealId, queryOptions);
  if (!deal) {
    throw new Error(`Deal ${dealId} not found`);
  }

  // Parse existing extraction_data to get extracted values
  let extractionData = null;
  let useEnhanced = false;

  if (deal.enhanced_extraction_data) {
    try {
      extractionData = typeof deal.enhanced_extraction_data === 'string'
        ? JSON.parse(deal.enhanced_extraction_data)
        : deal.enhanced_extraction_data;
      useEnhanced = true;
    } catch (e) {
      console.error('[SYNC] Failed to parse enhanced_extraction_data:', e);
    }
  }

  if (!extractionData && deal.extraction_data) {
    try {
      extractionData = typeof deal.extraction_data === 'string'
        ? JSON.parse(deal.extraction_data)
        : deal.extraction_data;
    } catch (e) {
      console.error('[SYNC] Failed to parse extraction_data:', e);
    }
  }

  // Get the target data object (extractedData for enhanced, root for regular)
  const targetData = extractionData
    ? (useEnhanced && extractionData.extractedData ? extractionData.extractedData : extractionData)
    : {};

  // Helper to normalize strings for comparison
  const normalizeString = (s) => s ? s.toString().toLowerCase().trim().replace(/\s+/g, ' ') : '';

  // Helper to check if two strings are significantly different (not just formatting)
  const areSignificantlyDifferent = (a, b) => {
    const normA = normalizeString(a);
    const normB = normalizeString(b);
    if (!normA || !normB) return false; // Can't compare if one is empty
    // Remove common abbreviations and punctuation for comparison
    const cleanA = normA.replace(/[.,#-]/g, '').replace(/\b(st|rd|ave|blvd|dr|ln|ct|cir|way|pl)\b/g, '');
    const cleanB = normB.replace(/[.,#-]/g, '').replace(/\b(st|rd|ave|blvd|dr|ln|ct|cir|way|pl)\b/g, '');
    return cleanA !== cleanB;
  };

  // 2. CONFLICT DETECTION: Check for conflicts between extracted and database values
  const conflicts = [];
  const fieldsToSkip = new Set(); // Fields with conflicts - don't overwrite

  // Skip conflict detection if user already resolved conflicts (e.g., from FacilityMatchModal)
  if (skipConflictDetection) {
    console.log(`[SYNC] Skipping conflict detection - user already resolved conflicts`);
  }

  // Fields that require conflict detection (critical data that affects calculations)
  const conflictFields = skipConflictDetection ? [] : [
    {
      field: 'bed_count',
      extractedKey: 'bed_count', // Also check total_beds
      altExtractedKeys: ['total_beds'],
      databaseValue: bed_count,
      compare: (extracted, database) => {
        const extNum = parseInt(extracted);
        const dbNum = parseInt(database);
        // Only conflict if both are valid numbers and they differ
        return !isNaN(extNum) && !isNaN(dbNum) && extNum !== dbNum;
      }
    },
    {
      field: 'street_address',
      extractedKey: 'street_address',
      altExtractedKeys: ['address'],
      databaseValue: street_address,
      compare: (extracted, database) => areSignificantlyDifferent(extracted, database)
    },
    {
      field: 'city',
      extractedKey: 'city',
      altExtractedKeys: [],
      databaseValue: city,
      compare: (extracted, database) => {
        // City comparison: case-insensitive, but catch actual different cities
        const normExtracted = normalizeString(extracted);
        const normDatabase = normalizeString(database);
        return normExtracted && normDatabase && normExtracted !== normDatabase;
      }
    }
  ];

  for (const cf of conflictFields) {
    // Get extracted value (check primary key and alternates)
    let extractedValue = targetData[cf.extractedKey];
    if (extractedValue === undefined || extractedValue === null) {
      for (const altKey of cf.altExtractedKeys) {
        if (targetData[altKey] !== undefined && targetData[altKey] !== null) {
          extractedValue = targetData[altKey];
          break;
        }
      }
    }

    const databaseValue = cf.databaseValue;

    // Check if conflict exists
    if (extractedValue !== undefined && extractedValue !== null &&
        databaseValue !== undefined && databaseValue !== null &&
        cf.compare(extractedValue, databaseValue)) {

      // Get source info for the extracted value
      const extractedSource = targetData._sourceMap?.[cf.extractedKey] || 'AI Extraction';

      console.log(`[SYNC] CONFLICT DETECTED for ${cf.field}: extracted=${extractedValue} (from ${extractedSource}), database=${databaseValue} (from ${source})`);

      conflicts.push({
        field: cf.field,
        extracted_value: extractedValue,
        database_value: databaseValue,
        source_extracted: extractedSource,
        source_database: source,
        detected_at: new Date().toISOString(),
        resolved: false,
        resolved_value: null,
        resolved_by: null,
        resolved_at: null
      });

      // Mark this field to skip - keep extracted value
      fieldsToSkip.add(cf.field);
    }
  }

  // Log conflicts summary
  if (conflicts.length > 0) {
    console.log(`[SYNC] Deal ${dealId}: Found ${conflicts.length} conflict(s) - keeping extracted values for: ${Array.from(fieldsToSkip).join(', ')}`);
  }

  // 3. Update deals table flat columns (SKIP conflicted fields)
  const dealUpdateFields = {};
  if (facility_name !== undefined) dealUpdateFields.facility_name = facility_name;
  if (street_address !== undefined && !fieldsToSkip.has('street_address')) dealUpdateFields.street_address = street_address;
  if (city !== undefined && !fieldsToSkip.has('city')) dealUpdateFields.city = city;
  if (state !== undefined) dealUpdateFields.state = state;
  if (zip_code !== undefined) dealUpdateFields.zip_code = zip_code;
  if (bed_count !== undefined && !fieldsToSkip.has('bed_count')) dealUpdateFields.bed_count = bed_count;
  if (latitude !== undefined) dealUpdateFields.latitude = latitude;
  if (longitude !== undefined) dealUpdateFields.longitude = longitude;

  if (Object.keys(dealUpdateFields).length > 0) {
    await deal.update(dealUpdateFields, queryOptions);
  }

  // 4. Update deal_facilities record (SKIP conflicted fields)
  let facility = await DealFacilities.findOne({ where: { deal_id: dealId }, ...queryOptions });

  const facilityUpdateFields = {};
  if (facility_name !== undefined) facilityUpdateFields.facility_name = facility_name;
  if (street_address !== undefined && !fieldsToSkip.has('street_address')) facilityUpdateFields.street_address = street_address;
  if (city !== undefined && !fieldsToSkip.has('city')) facilityUpdateFields.city = city;
  if (state !== undefined) facilityUpdateFields.state = state;
  if (zip_code !== undefined) facilityUpdateFields.zip_code = zip_code;
  if (bed_count !== undefined && !fieldsToSkip.has('bed_count')) facilityUpdateFields.bed_count = bed_count;
  if (latitude !== undefined) facilityUpdateFields.latitude = latitude;
  if (longitude !== undefined) facilityUpdateFields.longitude = longitude;
  if (facility_type !== undefined) facilityUpdateFields.facility_type = facility_type;

  if (facility) {
    await facility.update(facilityUpdateFields, queryOptions);
  } else if (Object.keys(facilityUpdateFields).length > 0) {
    // Create facility record if it doesn't exist
    facility = await DealFacilities.create({
      deal_id: dealId,
      ...facilityUpdateFields
    }, queryOptions);
  }

  // 5. Update extraction_data JSON (SKIP conflicted fields, store conflicts)
  const confidenceLevel = 'high'; // All synced data is high confidence

  if (extractionData) {
    // Quick validation check - warn if data structure seems invalid
    if (!isValidFlatFormat(targetData)) {
      console.warn(`[SYNC] Deal ${dealId}: extraction_data may have nested structure - check data integrity`);
    }

    // Update flat field values (SKIP conflicted fields)
    if (facility_name !== undefined) targetData.facility_name = facility_name;
    if (street_address !== undefined && !fieldsToSkip.has('street_address')) targetData.street_address = street_address;
    if (city !== undefined && !fieldsToSkip.has('city')) targetData.city = city;
    if (state !== undefined) targetData.state = state;
    if (zip_code !== undefined) targetData.zip_code = zip_code;
    if (bed_count !== undefined && !fieldsToSkip.has('bed_count')) targetData.bed_count = bed_count;

    // Initialize maps if they don't exist
    if (!targetData._confidenceMap) targetData._confidenceMap = {};
    if (!targetData._sourceMap) targetData._sourceMap = {};

    // Update confidence and source maps for changed fields (SKIP conflicted)
    const fieldMappings = [
      { input: 'facility_name', extraction: 'facility_name' },
      { input: 'street_address', extraction: 'street_address' },
      { input: 'city', extraction: 'city' },
      { input: 'state', extraction: 'state' },
      { input: 'zip_code', extraction: 'zip_code' },
      { input: 'bed_count', extraction: 'bed_count' }
    ];

    fieldMappings.forEach(({ input, extraction }) => {
      if (facilityData[input] !== undefined && !fieldsToSkip.has(input)) {
        targetData._confidenceMap[extraction] = confidenceLevel;
        targetData._sourceMap[extraction] = source;
      }
    });

    // 6. STORE CONFLICTS in extraction_data for UI resolution
    if (conflicts.length > 0) {
      // Initialize conflicts array if it doesn't exist, or merge with existing
      if (!targetData._conflicts) {
        targetData._conflicts = [];
      }

      // Add new conflicts (avoid duplicates by checking field name)
      for (const newConflict of conflicts) {
        // Remove any existing unresolved conflict for the same field
        targetData._conflicts = targetData._conflicts.filter(
          c => c.field !== newConflict.field || c.resolved === true
        );
        // Add the new conflict
        targetData._conflicts.push(newConflict);
      }

      console.log(`[SYNC] Deal ${dealId}: Stored ${conflicts.length} conflict(s) in extraction_data._conflicts`);
    }

    // Save back to deal
    // Note: Model setters auto-stringify, don't double-encode
    if (useEnhanced) {
      deal.enhanced_extraction_data = extractionData;
    } else {
      deal.extraction_data = extractionData;
    }
    await deal.save(queryOptions);

    // Record extraction history for the changed fields (excluding conflicted)
    const changedFieldNames = fieldMappings
      .filter(({ input }) => facilityData[input] !== undefined && !fieldsToSkip.has(input))
      .map(({ extraction }) => extraction);

    if (changedFieldNames.length > 0) {
      await recordExtractionHistory(
        dealId,
        targetData,
        source === 'ALF Database' ? 'alf_match' : 'facility_sync',
        changedFieldNames,
        'system',
        transaction
      );
    }
  }

  const conflictSummary = conflicts.length > 0
    ? ` (${conflicts.length} conflict(s) detected - user review needed)`
    : '';
  console.log(`[SYNC] Deal ${dealId}: Updated facility data from ${source}${conflictSummary}`);

  return { deal, facility, conflicts };
}

/**
 * Helper function to store time-series data from enhanced extraction
 * @param {number} dealId - The deal ID
 * @param {Object} extractionData - The enhanced extraction data
 */
const storeTimeSeriesData = async (dealId, extractionData) => {
  console.log('[storeTimeSeriesData] Starting for deal', dealId);
  console.log('[storeTimeSeriesData] extractionData keys:', extractionData ? Object.keys(extractionData) : 'null');
  if (!extractionData) {
    console.log('[storeTimeSeriesData] No extraction data provided');
    return;
  }

  let recordCount = 0;

  // Store monthly financials (sequential for SQLite compatibility)
  if (extractionData.monthlyFinancials && Array.isArray(extractionData.monthlyFinancials)) {
    for (const financial of extractionData.monthlyFinancials) {
      if (financial.month) {
        await DealMonthlyFinancials.upsert({
          deal_id: dealId,
          month: financial.month,
          source_document: financial.source_document,
          source_location: financial.source_location,
          total_revenue: financial.total_revenue,
          medicaid_revenue: financial.medicaid_revenue,
          medicare_revenue: financial.medicare_revenue,
          private_pay_revenue: financial.private_pay_revenue,
          other_revenue: financial.other_revenue,
          room_and_board_revenue: financial.room_and_board_revenue,
          care_level_revenue: financial.care_level_revenue,
          ancillary_revenue: financial.ancillary_revenue,
          total_expenses: financial.total_expenses,
          operating_expenses: financial.operating_expenses,
          depreciation: financial.depreciation,
          amortization: financial.amortization,
          interest_expense: financial.interest_expense,
          rent_expense: financial.rent_expense,
          property_taxes: financial.property_taxes,
          property_insurance: financial.property_insurance,
          net_income: financial.net_income,
          ebit: financial.ebit,
          ebitda: financial.ebitda,
          ebitdar: financial.ebitdar,
          extraction_confidence: financial.extraction_confidence,
          updated_at: new Date()
        });
        recordCount++;
      }
    }
  }

  // Store monthly census (sequential for SQLite compatibility)
  if (extractionData.monthlyCensus && Array.isArray(extractionData.monthlyCensus)) {
    for (const census of extractionData.monthlyCensus) {
      if (census.month) {
        await DealMonthlyCensus.upsert({
          deal_id: dealId,
          month: census.month,
          source_document: census.source_document,
          source_location: census.source_location,
          total_beds: census.total_beds,
          average_daily_census: census.average_daily_census,
          occupancy_percentage: census.occupancy_percentage,
          total_census_days: census.total_census_days,
          medicaid_days: census.medicaid_days,
          medicare_days: census.medicare_days,
          private_pay_days: census.private_pay_days,
          other_payer_days: census.other_payer_days,
          medicaid_percentage: census.medicaid_percentage,
          medicare_percentage: census.medicare_percentage,
          private_pay_percentage: census.private_pay_percentage,
          other_payer_percentage: census.other_payer_percentage,
          admissions: census.admissions,
          discharges: census.discharges,
          extraction_confidence: census.extraction_confidence,
          updated_at: new Date()
        });
        recordCount++;
      }
    }
  }

  // Store monthly expenses (sequential for SQLite compatibility)
  if (extractionData.monthlyExpenses && Array.isArray(extractionData.monthlyExpenses)) {
    for (const expense of extractionData.monthlyExpenses) {
      if (expense.month && expense.department) {
        await DealMonthlyExpenses.upsert({
          deal_id: dealId,
          month: expense.month,
          department: expense.department,
          source_document: expense.source_document,
          source_location: expense.source_location,
          salaries_wages: expense.salaries_wages,
          benefits: expense.benefits,
          payroll_taxes: expense.payroll_taxes,
          agency_labor: expense.agency_labor,
          contract_labor: expense.contract_labor,
          total_labor: expense.total_labor,
          supplies: expense.supplies,
          food_cost: expense.food_cost,
          utilities: expense.utilities,
          repairs_maintenance: expense.repairs_maintenance,
          other_expenses: expense.other_expenses,
          total_department_expense: expense.total_department_expense,
          extraction_confidence: expense.extraction_confidence,
          updated_at: new Date()
        });
        recordCount++;
      }
    }
  }

  // Store rate schedules (sequential for SQLite compatibility)
  if (extractionData.rates && Array.isArray(extractionData.rates)) {
    for (const rate of extractionData.rates) {
      if (rate.payer_type) {
        await DealRateSchedules.create({
          deal_id: dealId,
          payer_type: rate.payer_type,
          rate_category: rate.rate_category,
          care_level: rate.care_level,
          source_document: rate.source_document,
          source_location: rate.source_location,
          daily_rate: rate.daily_rate,
          monthly_rate: rate.monthly_rate,
          annual_rate: rate.annual_rate,
          care_level_addon: rate.care_level_addon,
          second_person_fee: rate.second_person_fee,
          ancillary_fee: rate.ancillary_fee,
          effective_date: rate.effective_date,
          expiration_date: rate.expiration_date,
          is_current: rate.is_current !== false,
          extraction_confidence: rate.extraction_confidence,
          notes: rate.notes
        });
        recordCount++;
      }
    }
  }

  // Store expense ratios
  console.log('[storeTimeSeriesData] ratios check:', !!extractionData.ratios, 'ratios content:', extractionData.ratios ? Object.keys(extractionData.ratios) : 'null');
  if (extractionData.ratios) {
    const ratios = extractionData.ratios;
    await DealExpenseRatios.upsert({
      deal_id: dealId,
      period_end: ratios.period_end,
      total_labor_cost: ratios.total_labor_cost,
      labor_pct_of_revenue: ratios.labor_pct_of_revenue,
      nursing_labor_pct_of_revenue: ratios.nursing_labor_pct_of_revenue,
      agency_labor_total: ratios.agency_labor_total,
      agency_pct_of_labor: ratios.agency_pct_of_labor,
      agency_pct_of_direct_care: ratios.agency_pct_of_direct_care,
      labor_cost_per_resident_day: ratios.labor_cost_per_resident_day,
      total_cost_per_resident_day: ratios.total_cost_per_resident_day,
      food_cost_total: ratios.food_cost_total,
      food_cost_per_resident_day: ratios.food_cost_per_resident_day,
      food_pct_of_revenue: ratios.food_pct_of_revenue,
      dietary_labor_pct_of_revenue: ratios.dietary_labor_pct_of_revenue,
      admin_pct_of_revenue: ratios.admin_pct_of_revenue,
      management_fee_pct: ratios.management_fee_pct,
      bad_debt_pct: ratios.bad_debt_pct,
      utilities_pct_of_revenue: ratios.utilities_pct_of_revenue,
      utilities_per_bed: ratios.utilities_per_bed,
      property_cost_per_bed: ratios.property_cost_per_bed,
      maintenance_pct_of_revenue: ratios.maintenance_pct_of_revenue,
      insurance_pct_of_revenue: ratios.insurance_pct_of_revenue,
      insurance_per_bed: ratios.insurance_per_bed,
      housekeeping_pct_of_revenue: ratios.housekeeping_pct_of_revenue,
      revenue_per_bed: ratios.revenue_per_bed,
      revenue_per_resident_day: ratios.revenue_per_resident_day,
      private_pay_rate_avg: ratios.private_pay_rate_avg,
      medicaid_rate_avg: ratios.medicaid_rate_avg,
      ebitdar_margin: ratios.ebitdar_margin,
      ebitda_margin: ratios.ebitda_margin,
      operating_margin: ratios.operating_margin,
      benchmark_flags: extractionData.benchmarkFlags,
      potential_savings: ratios.potential_savings,
      // Department expense totals
      total_direct_care: ratios.total_direct_care,
      total_activities: ratios.total_activities,
      total_culinary: ratios.total_culinary,
      total_housekeeping: ratios.total_housekeeping,
      total_maintenance: ratios.total_maintenance,
      total_administration: ratios.total_administration,
      total_general: ratios.total_general,
      total_property: ratios.total_property,
      calculated_at: new Date(),
      updated_at: new Date()
    });
    recordCount++;
    console.log('[storeTimeSeriesData] Stored expense ratios successfully');
  }

  if (recordCount > 0) {
    console.log(`Stored ${recordCount} time-series records for deal ${dealId}`);
  }

  // Sync flat deal fields from extraction data
  // This ensures deal-level fields like current_occupancy are populated from extraction
  try {
    const flatFieldUpdates = {};

    // Sync occupancy from extraction_data (canonical: occupancy_pct)
    if (extractionData.occupancy_pct !== undefined && extractionData.occupancy_pct !== null) {
      flatFieldUpdates.current_occupancy = parseFloat(extractionData.occupancy_pct) || 0;
      console.log(`[storeTimeSeriesData] Syncing current_occupancy: ${flatFieldUpdates.current_occupancy}`);
    }

    // Sync private pay percentage (canonical: private_pay_pct)
    if (extractionData.private_pay_pct !== undefined && extractionData.private_pay_pct !== null) {
      flatFieldUpdates.private_pay_percentage = parseFloat(extractionData.private_pay_pct) || 0;
      console.log(`[storeTimeSeriesData] Syncing private_pay_percentage: ${flatFieldUpdates.private_pay_percentage}`);
    }

    // Sync revenue and EBITDA
    if (extractionData.t12m_revenue !== undefined && extractionData.t12m_revenue !== null) {
      flatFieldUpdates.revenue = parseFloat(extractionData.t12m_revenue) || 0;
    }
    if (extractionData.t12m_ebitda !== undefined && extractionData.t12m_ebitda !== null) {
      flatFieldUpdates.ebitda = parseFloat(extractionData.t12m_ebitda) || 0;
    }

    // Only update if we have fields to sync
    if (Object.keys(flatFieldUpdates).length > 0) {
      await Deal.update(flatFieldUpdates, { where: { id: dealId } });
      console.log(`[storeTimeSeriesData] Synced flat fields to deal ${dealId}:`, Object.keys(flatFieldUpdates));
    }
  } catch (syncError) {
    console.error('[storeTimeSeriesData] Error syncing flat fields:', syncError);
    // Don't fail the overall operation if sync fails
  }
};

module.exports = {
  createDeal: async (req, res) => {
    try {
      // Debug: Log incoming extraction data
      console.log('[createDeal] Received req.body.extraction_data:',
        req.body.extraction_data ? 'EXISTS (keys: ' + Object.keys(req.body.extraction_data).length + ')' : 'MISSING');
      console.log('[createDeal] Received req.body.enhanced_extraction_data:',
        req.body.enhanced_extraction_data ? 'EXISTS' : 'MISSING');

      const required = {
        user_id: req.user.id,
        address: req.body.address,
        deals: req.body.deals,
      };
      const nonrequired = {
        priority_level: req.body.priority_level,
        deal_source: req.body.deal_source,
        primary_contact_name: req.body.primary_contact_name,
        title: req.body.title,
        phone_number: req.body.phone_number,
        email: req.body.email,
        target_close_date: req.body.target_close_date,
        dd_period_weeks: req.body.dd_period_weeks,
        price_per_bed: req.body.price_per_bed ? req.body.price_per_bed : 0,
        down_payment: req.body.down_payment ? req.body.down_payment : 0,
        financing_amount: req.body.financing_amount
          ? req.body.financing_amount
          : 0,
        revenue_multiple: req.body.revenue_multiple
          ? req.body.revenue_multiple
          : 0,
        ebitda: req.body.ebitda ? req.body.ebitda : 0,
        ebitda_multiple: req.body.ebitda_multiple
          ? req.body.ebitda_multiple
          : 0,
        ebitda_margin: req.body.ebitda_margin ? req.body.ebitda_margin : 0,
        net_operating_income: req.body.net_operating_income
          ? req.body.net_operating_income
          : 0,
        current_occupancy: req.body.current_occupancy
          ? req.body.current_occupancy
          : 0,
        average_daily_rate: req.body.average_daily_rate
          ? req.body.average_daily_rate
          : 0,
        medicare_percentage: req.body.medicare_percentage
          ? req.body.medicare_percentage
          : 0,
        private_pay_percentage: req.body.private_pay_percentage
          ? req.body.private_pay_percentage
          : 0,
        target_irr_percentage: req.body.target_irr_percentage
          ? req.body.target_irr_percentage
          : 0,
        target_hold_period: req.body.target_hold_period
          ? req.body.target_hold_period
          : 0,
        projected_cap_rate_percentage: req.body.projected_cap_rate_percentage
          ? req.body.projected_cap_rate_percentage
          : 0,
        exit_multiple: req.body.exit_multiple ? req.body.exit_multiple : 0,
        assistant_deal_lead_id: req.body.assistant_deal_lead_id,
        deal_team_members: req.body.deal_team_members,
        deal_external_advisors: req.body.deal_external_advisors,
        deal_status: req.body.deal_status,
        documents: req.body.documents, // Array of uploaded documents from extraction
        extraction_data: req.body.extraction_data, // Raw AI extraction data for analysis view
        enhanced_extraction_data: req.body.enhanced_extraction_data, // Time-series data from enhanced extraction
        facilities: req.body.facilities, // Array of facilities for portfolio deals
      };
      const requiredData = await helper.validateObject(required, nonrequired);

      // Debug: Log deal creation structure
      console.log('[createDeal] Received payload structure:',
        'deals:', requiredData.deals?.length || 0,
        'facilities:', requiredData.facilities?.length || 0);

      // creating master deal:
      const masterDeal = await MasterDeals.create({
        unique_id: helper.generateUniqueId(),
        user_id: requiredData.user_id,
        street_address: requiredData.address.street_address,
        city: requiredData.address.city,
        state: requiredData.address.state,
        country: requiredData.address.country,
        zip_code: requiredData.address.zip_code,
      });

      let dealData = [];
      // creating multiple deal data:
      if (requiredData.deals && requiredData.deals.length > 0) {
        dealData = await Promise.all(
          requiredData.deals.map(async (deal) => {
            const allUserIds = new Set();
            deal.email_notification_major_updates =
              deal.notificationSettings?.email_notification_major_updates ===
              true
                ? "yes"
                : "no";
            deal.document_upload_notification =
              deal.notificationSettings?.document_upload_notification === true
                ? "yes"
                : "no";
            deal.target_close_date = deal.target_close_date
              ? deal.target_close_date
              : null;
            deal.price_per_bed = deal.price_per_bed ? deal.price_per_bed : 0;
            deal.down_payment = deal.down_payment ? deal.down_payment : 0;
            deal.financing_amount = deal.financing_amount
              ? deal.financing_amount
              : 0;
            deal.revenue_multiple = deal.revenue_multiple
              ? deal.revenue_multiple
              : 0;
            deal.ebitda = deal.ebitda ? deal.ebitda : 0;
            deal.ebitda_multiple = deal.ebitda_multiple
              ? deal.ebitda_multiple
              : 0;
            deal.ebitda_margin = deal.ebitda_margin ? deal.ebitda_margin : 0;
            deal.net_operating_income = deal.net_operating_income
              ? deal.net_operating_income
              : 0;
            deal.current_occupancy = deal.current_occupancy
              ? deal.current_occupancy
              : 0;
            deal.average_daily_rate = deal.average_daily_rate
              ? deal.average_daily_rate
              : 0;
            deal.medicare_percentage = deal.medicare_percentage
              ? deal.medicare_percentage
              : 0;
            deal.private_pay_percentage = deal.private_pay_percentage
              ? deal.private_pay_percentage
              : 0;
            deal.target_irr_percentage = deal.target_irr_percentage
              ? deal.target_irr_percentage
              : 0;
            deal.target_hold_period = deal.target_hold_period
              ? deal.target_hold_period
              : 0;
            deal.projected_cap_rate_percentage =
              deal.projected_cap_rate_percentage
                ? deal.projected_cap_rate_percentage
                : 0;
            deal.exit_multiple = deal.exit_multiple ? deal.exit_multiple : 0;

            // Sanitize integer fields - convert empty strings to null
            deal.bed_count = deal.bed_count === '' || deal.bed_count === undefined ? null : (parseInt(deal.bed_count) || null);
            deal.deal_lead_id = deal.deal_lead_id === '' || deal.deal_lead_id === undefined ? null : (parseInt(deal.deal_lead_id) || null);
            deal.assistant_deal_lead_id = deal.assistant_deal_lead_id === '' || deal.assistant_deal_lead_id === undefined ? null : (parseInt(deal.assistant_deal_lead_id) || null);

            // Note: Facility matching now happens during extraction (parallelExtractor.js)
            // and is reviewed manually via FacilityMatchModal. See selectFacilityMatch() endpoint.

            // create deal:
            // Get index to determine extraction_data handling
            const dealIndex = requiredData.deals.indexOf(deal);

            // Determine extraction_data for this deal
            // For portfolio deals with per-facility data, each deal gets its own extraction_data
            // For single deals, only the first deal stores extraction_data
            let dealExtractionData = null;
            const enhancedDataForDeal = requiredData.enhanced_extraction_data;

            if (enhancedDataForDeal?.facility_details && Array.isArray(enhancedDataForDeal.facility_details)) {
              // Portfolio deal: Find facility-specific extraction data
              const facilityName = deal.facility_name;
              const matchingFacility = enhancedDataForDeal.facility_details.find(fd => {
                const fdName = fd.facility_name || fd.extraction_result?.extractedData?.facility_name;
                return fdName && facilityName &&
                  (fdName.toLowerCase().includes(facilityName.toLowerCase()) ||
                   facilityName.toLowerCase().includes(fdName.toLowerCase()));
              });

              if (matchingFacility?.extraction_result?.extractedData) {
                // Store facility-specific extraction data
                dealExtractionData = matchingFacility.extraction_result.extractedData;
                console.log(`[createDeal] Deal ${dealIndex}: Using facility-specific extraction_data for "${facilityName}"`);
              } else if (dealIndex === 0) {
                // First deal in portfolio gets full extraction_data as fallback
                dealExtractionData = requiredData.extraction_data;
                console.log(`[createDeal] Deal ${dealIndex}: No matching facility found, using shared extraction_data`);
              }
            } else if (dealIndex === 0) {
              // Single deal or legacy: Only first deal stores extraction_data
              dealExtractionData = requiredData.extraction_data;
            }

            const dealCreated = await Deal.create({
              ...deal,
              user_id: requiredData.user_id,
              master_deal_id: masterDeal.id,
              extraction_data: dealExtractionData,
            });

            // Set match_status based on facility_matches in extraction data
            // Check if this deal has pending facility matches that need user review
            let matchStatus = 'no_match_needed';
            const extData = dealExtractionData || requiredData.extraction_data;
            const enhData = requiredData.enhanced_extraction_data;

            // Check enhanced_extraction_data first (newer format)
            const facilityMatches = enhData?.extractedData?.overview?.facility_matches
              || extData?.overview?.facility_matches
              || extData?.deal_overview?.facility_matches;

            if (facilityMatches?.status === 'pending_review' && facilityMatches?.matches?.length > 0) {
              matchStatus = 'pending_match';
              console.log(`[createDeal] Deal ${dealIndex}: Setting match_status to 'pending_match' (${facilityMatches.matches.length} matches found)`);
            } else if (facilityMatches?.status === 'selected') {
              matchStatus = 'matched';
            } else if (facilityMatches?.status === 'skipped') {
              matchStatus = 'skipped';
            } else if (facilityMatches?.status === 'not_sure') {
              matchStatus = 'not_sure';
            }

            if (matchStatus !== 'no_match_needed') {
              await dealCreated.update({ match_status: matchStatus });
            }

            // Store time-series data for EVERY deal (not just the first)
            // For portfolio deals, try to find facility-specific extraction data
            // Prefer enhanced_extraction_data if available (from parallel extraction)
            const enhancedData = requiredData.enhanced_extraction_data;
            const baseExtractionData = requiredData.extraction_data;

            // Determine the time-series source for this specific deal
            let timeSeriesSource = null;
            let timeSeriesSourceName = 'none';

            // For portfolio deals, check if we have per-facility extraction data
            if (enhancedData?.facility_details && Array.isArray(enhancedData.facility_details)) {
              // Portfolio deal: Find extraction data matching this facility
              const facilityName = deal.facility_name || dealCreated.facility_name;
              console.log(`[createDeal] Portfolio deal - looking for facility: "${facilityName}"`);

              const matchingFacility = enhancedData.facility_details.find(fd => {
                const fdName = fd.facility_name || fd.extraction_result?.extractedData?.facility_name;
                // Case-insensitive partial match
                return fdName && facilityName &&
                  (fdName.toLowerCase().includes(facilityName.toLowerCase()) ||
                   facilityName.toLowerCase().includes(fdName.toLowerCase()));
              });

              if (matchingFacility?.extraction_result) {
                timeSeriesSource = matchingFacility.extraction_result;
                timeSeriesSourceName = `facility_details[${matchingFacility.facility_name}]`;
                console.log(`[createDeal] Found matching facility extraction: ${matchingFacility.facility_name}`);
              } else {
                console.log(`[createDeal] No matching facility found for "${facilityName}", using portfolio-level data`);
                // Fall back to portfolio-level extraction for this facility
                timeSeriesSource = enhancedData;
                timeSeriesSourceName = 'enhanced_extraction_data (portfolio-level)';
              }
            } else if (enhancedData) {
              // Single facility deal with enhanced extraction data
              timeSeriesSource = enhancedData;
              timeSeriesSourceName = 'enhanced_extraction_data';
            } else if (baseExtractionData) {
              // Fall back to basic extraction data
              timeSeriesSource = baseExtractionData;
              timeSeriesSourceName = 'extraction_data';
            }

            console.log(`[createDeal] Deal ${dealIndex} (${deal.facility_name || 'unnamed'}) - Time-series data check:`,
              'source:', timeSeriesSourceName,
              'enhanced_extraction_data exists:', !!enhancedData,
              'extraction_data exists:', !!baseExtractionData);

            if (timeSeriesSource) {
              console.log(`[createDeal] Deal ${dealIndex} - Time-series source has:`,
                'monthlyFinancials:', Array.isArray(timeSeriesSource.monthlyFinancials) ? timeSeriesSource.monthlyFinancials.length : 'none',
                'monthlyCensus:', Array.isArray(timeSeriesSource.monthlyCensus) ? timeSeriesSource.monthlyCensus.length : 'none',
                'monthlyExpenses:', Array.isArray(timeSeriesSource.monthlyExpenses) ? timeSeriesSource.monthlyExpenses.length : 'none');
              try {
                console.log(`[createDeal] Deal ${dealIndex} - Storing time-series data from: ${timeSeriesSourceName}`);
                await storeTimeSeriesData(dealCreated.id, timeSeriesSource);
              } catch (timeSeriesError) {
                console.error(`Error storing time-series data for deal ${dealIndex}:`, timeSeriesError);
                // Don't fail deal creation if time-series storage fails
              }
            } else {
              console.log(`[createDeal] Deal ${dealIndex} - No time-series data source available`);
            }

            // Create deal_facilities records
            // If facilities array is provided (new portfolio structure), use it
            // Otherwise fall back to single facility from deal object (legacy)
            if (dealIndex === 0 && requiredData.facilities && requiredData.facilities.length > 0) {
              // New structure: multiple facilities in portfolio
              console.log(`[createDeal] Creating ${requiredData.facilities.length} facility records for deal ${dealCreated.id}`);
              for (const facility of requiredData.facilities) {
                try {
                  await DealFacilities.create({
                    deal_id: dealCreated.id,
                    facility_name: facility.facility_name || null,
                    facility_type: facility.facility_type || null,
                    federal_provider_number: facility.federal_provider_number || null,
                    street_address: facility.street_address || null,
                    city: facility.city || null,
                    state: facility.state || null,
                    zip_code: facility.zip_code || null,
                    county: facility.county || null,
                    bed_count: facility.bed_count || null,
                    display_order: facility.display_order || 0,
                    latitude: facility.latitude || null,
                    longitude: facility.longitude || null,
                  });
                  console.log(`[createDeal] Created facility: ${facility.facility_name} (CCN: ${facility.federal_provider_number || 'none'})`);
                } catch (facilityError) {
                  console.error('Error creating deal_facilities:', facilityError);
                }
              }
            } else if (deal.facility_name || deal.facility_type) {
              // Legacy: single facility from deal object
              try {
                await DealFacilities.create({
                  deal_id: dealCreated.id,
                  facility_name: deal.facility_name || null,
                  facility_type: deal.facility_type || null,
                  street_address: deal.street_address || null,
                  city: deal.city || null,
                  state: deal.state || null,
                  zip_code: deal.zip_code || null,
                  bed_count: deal.bed_count || null,
                  display_order: dealIndex,
                });
                console.log(`[createDeal] Created deal_facilities record for deal ${dealCreated.id}`);
              } catch (facilityError) {
                console.error('Error creating deal_facilities:', facilityError);
              }
            }

            // create recent activity for admin:
            const admin = await User.findByPk(1);
            const dealCreatedBy = await User.findByPk(requiredData.user_id);
            await RecentActivity.create({
              to_id: admin.id,
              from_id: dealCreated.user_id,
              subject_type: "deal",
              subject_id: dealCreated.id,
              action: "new_deal_created",
              message: `A new deal <strong>${dealCreated.deal_name}</strong> has been created by <strong>${dealCreatedBy.first_name} ${dealCreatedBy.last_name}</strong> on our platform.`,
              data: JSON.stringify({
                deal_id: dealCreated.id,
                deal_name: dealCreated.deal_name,
                to_id: admin.id,
                from_id: dealCreated.user_id,
              }),
            });

            // append all user to allUserIds:
            allUserIds.add(dealCreated?.deal_lead_id);
            allUserIds.add(dealCreated?.assistant_deal_lead_id);
            
            // Fixed: Create deal team members from the current deal's data
            if (deal.deal_team_members && deal.deal_team_members.length > 0) {
              await Promise.all(
                deal.deal_team_members.map(async (element) => {
                  const dealTeamMember = await DealTeamMembers.create({
                    deal_id: dealCreated.id,
                    user_id: element.id,
                  });
                  allUserIds.add(element.id);
                })
              );
            }
            
            // Fixed: Create deal external advisors from the current deal's data
            if (deal.deal_external_advisors && deal.deal_external_advisors.length > 0) {
              await Promise.all(
                deal.deal_external_advisors.map(async (element) => {
                  const dealExternalAdvisor = await DealExternalAdvisors.create({
                    deal_id: dealCreated.id,
                    user_id: element.id,
                  });
                  allUserIds.add(element.id);
                })
              );
            }

            // send email:
            await Promise.all(
              [...allUserIds].map(async (userId) => {
                const user = await User.findByPk(userId);
                if (user) {
                  await sendBrevoEmail({
                    receiver_email: user.email,
                    receiver_name: user.first_name + " " + user.last_name,
                    subject: "You've been added to a new deal",
                    htmlContent: `
      <p>Hi ${user.first_name} ${user.last_name},</p>
      <p>You've been added to the deal <strong>${deal.deal_name}</strong> on our platform.</p>
      <p>You can now collaborate, view details, and track progress in your dashboard.</p>
      <p>Best regards.</p>
    `,
                  });

                  // create recent activity:
                  await RecentActivity.create({
                    to_id: userId,
                    from_id: dealCreated.user_id,
                    subject_type: "deal",
                    subject_id: dealCreated.id,
                    action: "added_to_deal",
                    message: `You've been added to the deal <strong>${dealCreated.deal_name}</strong> on our platform.`,
                    data: JSON.stringify({
                      deal_id: dealCreated.id,
                      deal_name: dealCreated.deal_name,
                      to_id: userId,
                      from_id: dealCreated.user_id,
                    }),
                  });
                }
              })
            );

            return dealCreated;
          })
        );
      }

      // Save uploaded documents from extraction (associate with the first deal created)
      if (requiredData.documents && requiredData.documents.length > 0 && dealData.length > 0) {
        const firstDealId = dealData[0].id;
        await Promise.all(
          requiredData.documents.map(async (doc) => {
            await DealDocuments.create({
              deal_id: firstDealId,
              user_id: requiredData.user_id,
              document_url: doc.file_path || doc.url,
              document_name: doc.original_name || doc.filename,
            });
          })
        );
      }

      // Save extracted facilities from AI extraction (if present)
      if (req.body.extracted_facilities && req.body.extracted_facilities.length > 0 && dealData.length > 0) {
        const firstDealId = dealData[0].id;
        await Promise.all(
          req.body.extracted_facilities.map(async (facility, index) => {
            await DealFacilities.create({
              deal_id: firstDealId,
              facility_name: facility.facility_name,
              facility_type: facility.facility_type,
              federal_provider_number: facility.federal_provider_number || null,
              street_address: facility.address || facility.street_address,
              city: facility.city,
              state: facility.state,
              zip_code: facility.zip_code,
              county: facility.county,
              bed_count: facility.bed_count || facility.total_beds,
              licensed_beds: facility.licensed_beds,
              certified_beds: facility.certified_beds,
              purchase_price: facility.purchase_price,
              annual_revenue: facility.annual_revenue,
              ebitda: facility.ebitda,
              ebitdar: facility.ebitdar,
              noi: facility.noi,
              annual_rent: facility.annual_rent,
              occupancy_rate: facility.occupancy_rate,
              medicare_mix: facility.medicare_mix,
              medicaid_mix: facility.medicaid_mix,
              private_pay_mix: facility.private_pay_mix,
              managed_care_mix: facility.managed_care_mix,
              notes: facility.notes,
              extraction_data: facility.extraction_data || facility, // Model setter auto-stringifies
              display_order: index,
            });
          })
        );
      }

      // return the success response:
      return helper.success(res, "Deal created successfully", {
        masterDeal,
        dealData,
      });
    } catch (err) {
      return helper.error(res, err);
    }
  },
 
  updateMasterDeal: async (req, res) => {
    try {
      const required = {
        master_deal_id: req.body.master_deal_id,
      };
  
      const nonrequired = {
        deal_name: req.body.deal_name,
        deal_type: req.body.deal_type,
        deal_status: req.body.deal_status,
        priority_level: req.body.priority_level,
        deal_source: req.body.deal_source,
        primary_contact_name: req.body.primary_contact_name,
        title: req.body.title,
        phone_number: req.body.phone_number,
        email: req.body.email,
        target_close_date: req.body.target_close_date,
        dd_period_weeks: req.body.dd_period_weeks,
        price_per_bed: req.body.price_per_bed || 0,
        down_payment: req.body.down_payment || 0,
        financing_amount: req.body.financing_amount || 0,
        revenue_multiple: req.body.revenue_multiple || 0,
        ebitda: req.body.ebitda || 0,
        ebitda_multiple: req.body.ebitda_multiple || 0,
        ebitda_margin: req.body.ebitda_margin || 0,
        net_operating_income: req.body.net_operating_income || 0,
        current_occupancy: req.body.current_occupancy || 0,
        average_daily_rate: req.body.average_daily_rate || 0,
        medicare_percentage: req.body.medicare_percentage || 0,
        private_pay_percentage: req.body.private_pay_percentage || 0,
        target_irr_percentage: req.body.target_irr_percentage || 0,
        target_hold_period: req.body.target_hold_period || 0,
        projected_cap_rate_percentage: req.body.projected_cap_rate_percentage || 0,
        exit_multiple: req.body.exit_multiple || 0,
        deal_lead_id: req.body.deal_lead_id,
        assistant_deal_lead_id: req.body.assistant_deal_lead_id,
        email_notification_major_updates: req.body.email_notification_major_updates,
        document_upload_notification: req.body.document_upload_notification,
        address: req.body.address,
        deals: req.body.deals, // array of deals for update/create
      };
  
      const requiredData = await helper.validateObject(required, nonrequired);
  
      // Find master deal
      const existingMasterDeal = await MasterDeals.findByPk(requiredData.master_deal_id);
      if (!existingMasterDeal) {
        return helper.error(res, "Master deal not found");
      }
  
      // Prepare update payload
      const masterDealUpdateData = {
        deal_name: requiredData.deal_name,
        deal_type: requiredData.deal_type,
        deal_status: requiredData.deal_status,
        priority_level: requiredData.priority_level,
        deal_source: requiredData.deal_source,
        primary_contact_name: requiredData.primary_contact_name,
        title: requiredData.title,
        phone_number: requiredData.phone_number,
        email: requiredData.email,
        target_close_date: requiredData.target_close_date,
        dd_period_weeks: requiredData.dd_period_weeks,
        price_per_bed: requiredData.price_per_bed,
        down_payment: requiredData.down_payment,
        financing_amount: requiredData.financing_amount,
        revenue_multiple: requiredData.revenue_multiple,
        ebitda: requiredData.ebitda,
        ebitda_multiple: requiredData.ebitda_multiple,
        ebitda_margin: requiredData.ebitda_margin,
        net_operating_income: requiredData.net_operating_income,
        current_occupancy: requiredData.current_occupancy,
        average_daily_rate: requiredData.average_daily_rate,
        medicare_percentage: requiredData.medicare_percentage,
        private_pay_percentage: requiredData.private_pay_percentage,
        target_irr_percentage: requiredData.target_irr_percentage,
        target_hold_period: requiredData.target_hold_period,
        projected_cap_rate_percentage: requiredData.projected_cap_rate_percentage,
        exit_multiple: requiredData.exit_multiple,
        deal_lead_id: requiredData.deal_lead_id,
        assistant_deal_lead_id: requiredData.assistant_deal_lead_id,
        email_notification_major_updates: requiredData.email_notification_major_updates,
        document_upload_notification: requiredData.document_upload_notification,
      };
  
      // Add address fields if provided
      if (requiredData.address) {
        Object.assign(masterDealUpdateData, {
          street_address: requiredData.address.street_address,
          city: requiredData.address.city,
          state: requiredData.address.state,
          country: requiredData.address.country,
          zip_code: requiredData.address.zip_code,
        });
      }
  
      // Update master deal
      await MasterDeals.update(masterDealUpdateData, { where: { id: requiredData.master_deal_id } });
  
      // Handle deals (update existing or create new ones)
      if (requiredData.deals && requiredData.deals.length > 0) {
        await Promise.all(
          requiredData.deals.map(async (deal) => {
            const payload = {
              ...deal,
              email_notification_major_updates:
                deal.notificationSettings?.email_notification_major_updates ? "yes" : "no",
              document_upload_notification:
                deal.notificationSettings?.document_upload_notification ? "yes" : "no",
              target_close_date: deal.target_close_date || null,
              price_per_bed: deal.price_per_bed || 0,
              down_payment: deal.down_payment || 0,
              financing_amount: deal.financing_amount || 0,
              revenue_multiple: deal.revenue_multiple || 0,
              ebitda: deal.ebitda || 0,
              ebitda_multiple: deal.ebitda_multiple || 0,
              ebitda_margin: deal.ebitda_margin || 0,
              net_operating_income: deal.net_operating_income || 0,
              current_occupancy: deal.current_occupancy || 0,
              average_daily_rate: deal.average_daily_rate || 0,
              medicare_percentage: deal.medicare_percentage || 0,
              private_pay_percentage: deal.private_pay_percentage || 0,
              target_irr_percentage: deal.target_irr_percentage || 0,
              target_hold_period: deal.target_hold_period || 0,
              projected_cap_rate_percentage: deal.projected_cap_rate_percentage || 0,
              exit_multiple: deal.exit_multiple || 0,
            };
  
            if (deal.id) {
              // Update existing deal
              await Deal.update(payload, { where: { id: deal.id } });
              await DealTeamMembers.destroy({ where: { deal_id: deal.id } });
              await DealExternalAdvisors.destroy({ where: { deal_id: deal.id } });
            } else {
              // Create new deal under the master deal
              const createdDeal = await Deal.create({
                ...payload,
                master_deal_id: requiredData.master_deal_id,
                user_id: req.user.id,
              });
              deal.id = createdDeal.id;
            }
  
            // Add team members
            if (deal.deal_team_members?.length > 0) {
              await Promise.all(
                deal.deal_team_members.map((member) =>
                  DealTeamMembers.create({
                    deal_id: deal.id,
                    user_id: member.id || member.user_id,
                  })
                )
              );
            }
  
            // Add external advisors
            if (deal.deal_external_advisors?.length > 0) {
              await Promise.all(
                deal.deal_external_advisors.map((advisor) =>
                  DealExternalAdvisors.create({
                    deal_id: deal.id,
                    user_id: advisor.id || advisor.user_id,
                  })
                )
              );
            }
          })
        );
      }
  
      // Fetch updated master deal
      const updatedMasterDeal = await MasterDeals.findByPk(requiredData.master_deal_id, {
        include: [
          {
            model: Deal,
            as: "deals",
            include: [
              { model: User, as: "deal_lead", attributes: ["id", "first_name", "last_name", "profile_url"] },
              { model: User, as: "assistant_deal_lead", attributes: ["id", "first_name", "last_name", "profile_url"] },
              {
                model: DealTeamMembers,
                as: "deal_team_members",
                include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "profile_url"] }],
              },
              {
                model: DealExternalAdvisors,
                as: "deal_external_advisors",
                include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "profile_url"] }],
              },
            ],
          },
        ],
      });
  
      // Create recent activity log
      const updatedBy = await User.findByPk(req.user.id);
      await RecentActivity.create({
        to_id: existingMasterDeal.user_id,
        from_id: req.user.id,
        subject_type: "master_deal",
        subject_id: requiredData.master_deal_id,
        action: "master_deal_updated",
        message: `Master deal <strong>${updatedMasterDeal.deal_name}</strong> has been updated by <strong>${updatedBy.first_name} ${updatedBy.last_name}</strong>.`,
        data: JSON.stringify({
          master_deal_id: requiredData.master_deal_id,
          deal_name: updatedMasterDeal.deal_name,
          to_id: existingMasterDeal.user_id,
          from_id: req.user.id,
        }),
      });
  
      return helper.success(res, "Master deal updated successfully", updatedMasterDeal);
    } catch (err) {
      return helper.error(res, err);
    }
  },
  

  getDeal: async (req, res) => {
    try {
      const search = req.query.search;
      const status = req.query.status;
      const type = req.query.type;
      const date = req.query.date;
      const value = req.query.value;
      const page = req.query.page || 1;
      const limit = req.query.limit || 5;
      const offset = (page - 1) * limit;

      const whereClause = {};

      // role based filtering:
      const user = await User.findByPk(req.user.id);

      if (user.role !== "admin") {
        // fetch team member assigned deals:
        const teamMemberDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });

        const teamDealIds = teamMemberDeals.map((entry) => entry.deal_id);

        // fetch external advisor assigned deals:
        const externalAdvisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });
        const externalAdvisorDealIds = externalAdvisorDeals.map(
          (entry) => entry.deal_id
        );

        whereClause[Op.or] = [
          { user_id: user.id },
          { deal_lead_id: user.id },
          { assistant_deal_lead_id: user.id },
          { id: { [Op.in]: teamDealIds } },
          { id: { [Op.in]: externalAdvisorDealIds } },
        ];
      }

      // Apply search filters
      if (search) {
        whereClause.deal_name = {
          [Op.like]: `%${search}%`,
        };
      }

      if (status && status != "All") {
        whereClause.deal_status = status;
      }

      if (date && date != "All") {
        whereClause.target_close_date = date;
      }

      if (value && value != "All") {
        whereClause.purchase_price = value;
      }

      if (type && type != "All") {
        whereClause.deal_type = type;
      }

      const deal = await Deal.findAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "deal_lead" },
          { model: User, as: "assistant_deal_lead" },
        ],
      });

      const total = await Deal.count({ where: whereClause });
      const totalPages = Math.ceil(total / limit);

      const body = {
        deals: deal,
        total: total,
        totalPages: totalPages,
      };

      return helper.success(res, "Deal fetched successfully", body);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  //fetch master deals:
  getMasterDeals: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "" } = req.query;

      const user = await User.findByPk(req.user.id);

      const whereClause = {};

      if (user.role !== "admin") {
        whereClause.user_id = user.id;
      }

      if (search) {
        whereClause[Op.or] = [
          { street_address: { [Op.like]: `%${search}%` } },
          { zip_code: { [Op.like]: `%${search}%` } },
          { city: { [Op.like]: `%${search}%` } },
          { state: { [Op.like]: `%${search}%` } },
        ];
      }

      // fetch data:
      const masterDeals = await MasterDeals.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [["created_at", "DESC"]],
      });
      if (masterDeals.length > 0) {
        return helper.success(res, "Master deals fetched successfully", {
          masterDeals: [],
        });
      }
      const responseData = await Promise.all(
        masterDeals.rows.map(async (data) => {
          const deals = await Deal.count({
            where: {
              master_deal_id: data.id,
            },
          });
          return {
            ...data.dataValues,
            deals: deals,
          };
        })
      );

      const body = {
        deals: responseData,
        total: masterDeals.count,
        totalPages: Math.ceil(masterDeals.count / parseInt(limit)),
        currentPage: parseInt(page),
      };

      return helper.success(res, "Master deals fetched successfully", body);
    } catch (error) {
      return helper.error(res, error);
    }
  },

  // get master deal:
  getParticularMasterDeal: async (req, res) => {
    try {
      const required = {
        id: req.query.id,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const masterDeal = await MasterDeals.findOne({
        where: { id: requiredData.id },
        include: [
          {
            model: Deal,
            as: "deals",
            include: [
              {
                model: User,
                as: "deal_lead",
                attributes: [
                  "id",
                  "first_name",
                  "last_name",
                  "email",
                  "phone_number",
                ],
              },
              {
                model: User,
                as: "assistant_deal_lead",
                attributes: [
                  "id",
                  "first_name",
                  "last_name",
                  "email",
                  "phone_number",
                ],
              },
              {
                model: DealTeamMembers,
                as: "deal_team_members",
                include: [
                  {
                    model: User,
                    as: "user",
                    attributes: [
                      "id",
                      "first_name",
                      "last_name",
                      "profile_url",
                    ],
                  },
                ],
              },
              {
                model: DealExternalAdvisors,
                as: "deal_external_advisors",
                include: [
                  {
                    model: User,
                    as: "user",
                    attributes: [
                      "id",
                      "first_name",
                      "last_name",
                      "profile_url",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      return helper.success(
        res,
        "Master deal fetched successfully",
        masterDeal
      );
    } catch (error) {
      return helper.error(res, error);
    }
  },

  // delete master deals:
  deleteMasterDeal: async (req, res) => {
    try {
      const required = { id: req.params.id }; // master_deal_id
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // fetch the master deal:
      const masterDeal = await MasterDeals.findByPk(requiredData.id);
      if (!masterDeal) {
        return helper.error(res, "Master deal not found");
      }

      // fetch all deals under this master deal:
      const deals = await Deal.findAll({
        where: { master_deal_id: requiredData.id },
      });

      for (const deal of deals) {
        // delete deal comments:
        await DealComments.destroy({
          where: {
            deal_id: deal.id,
          },
        });

        // delete deal documents:
        await DealDocuments.destroy({ where: { deal_id: deal.id } });

        // delete deal team members:
        await DealTeamMembers.destroy({ where: { deal_id: deal.id } });

        // delete deal external advisors:
        await DealExternalAdvisors.destroy({ where: { deal_id: deal.id } });

        // finally delete deal itself
        await deal.destroy();
      }

      // delete master deal itself:
      await masterDeal.destroy();

      // return the success response:
      return helper.success(
        res,
        "Master deal and related deals deleted successfully",
        {
          id: requiredData.id,
        }
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  // update master deal:

  getDealStats: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      const whereClause = {
        [Op.not]: {
          deal_status: "closed",
        },
      };

      // Apply role-based filters for non-admin users
      if (user.role !== "admin") {
        // fetch team member assigned deals:
        const teamMemberDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });

        const teamDealIds = teamMemberDeals.map((entry) => entry.deal_id);

        // fetch external advisor assigned deals:
        const externalAdvisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });
        const externalAdvisorDealIds = externalAdvisorDeals.map(
          (entry) => entry.deal_id
        );

        whereClause[Op.and] = [
          {
            [Op.or]: [
              { user_id: user.id },
              { deal_lead_id: user.id },
              { assistant_deal_lead_id: user.id },
              { id: { [Op.in]: teamDealIds } },
              { id: { [Op.in]: externalAdvisorDealIds } },
            ],
          },
        ];
      }

      // Get total active deals
      const totalActiveDeals = await Deal.count({
        where: whereClause,
      });

      // Get total pipeline value (sum of purchase prices)
      const pipelineValue = await Deal.sum("purchase_price", {
        where: { ...whereClause, deal_status: "pipeline" },
      });

      // Get average deal size
      const avgDealSize = await Deal.findOne({
        attributes: [
          [sequelize.fn("AVG", sequelize.col("purchase_price")), "average"],
        ],
        where: whereClause,
      });

      // Get closing this month count
      const currentDate = new Date();
      const firstDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );

      const closingThisMonth = await Deal.count({
        where: {
          ...whereClause,
          target_close_date: {
            [Op.between]: [firstDayOfMonth, lastDayOfMonth],
          },
        },
      });

      // Calculate success rate
      const totalDeals = await Deal.count({
        where:
          user.role === "admin"
            ? {}
            : {
                [Op.or]: [
                  { user_id: user.id },
                  { deal_lead_id: user.id },
                  { assistant_deal_lead_id: user.id },
                ],
              },
      });

      const successRate =
        totalDeals > 0 ? ((totalActiveDeals / totalDeals) * 100).toFixed(0) : 0;

      const stats = {
        total_active_deals: totalActiveDeals,
        total_pipeline_value:
          pipelineValue && pipelineValue > 1000000
            ? `$${(pipelineValue / 1000000).toFixed(1)}M`
            : pipelineValue,
        average_deal_size:
          avgDealSize?.dataValues?.average &&
          avgDealSize?.dataValues?.average > 1000000
            ? `$${(avgDealSize.dataValues.average / 1000000).toFixed(1)}M`
            : avgDealSize?.dataValues?.average,
        closing_this_month: closingThisMonth,
        success_rate: `${successRate}%`,
      };

      return helper.success(res, "Deal statistics fetched successfully", stats);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  // Dashboard Api:
  getDashboardData: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      const isAdmin = user.role === "admin";

      let userDealIds = [];
      if (!isAdmin) {
        const userDeals = await Deal.findAll({
          attributes: ["id"],
          where: { user_id: userId },
        });
        const leadDeals = await Deal.findAll({
          attributes: ["id"],
          where: { deal_lead_id: userId },
        });
        const assistantDeals = await Deal.findAll({
          attributes: ["id"],
          where: { assistant_deal_lead_id: userId },
        });
        const teamDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: userId },
        });
        const advisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: userId },
        });
        userDealIds = [
          ...userDeals.map((d) => d.id),
          ...leadDeals.map((d) => d.id),
          ...assistantDeals.map((d) => d.id),
          ...teamDeals.map((d) => d.deal_id),
          ...advisorDeals.map((d) => d.deal_id),
        ];
        userDealIds = [...new Set(userDealIds)];
      }

      const whereClause = isAdmin ? {} : { id: { [Op.in]: userDealIds } };

      // Exclude deals with pending facility match or uncertain status from analytics
      // These deals may have incomplete/incorrect facility data
      const analyticsWhereClause = {
        ...whereClause,
        match_status: { [Op.notIn]: ['pending_match', 'not_sure'] }
      };

      const currentDate = new Date();

      const startOfWeek = new Date();
      startOfWeek.setUTCDate(
        currentDate.getUTCDate() - currentDate.getUTCDay()
      );
      startOfWeek.setUTCHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
      endOfWeek.setUTCHours(23, 59, 59, 999);

      const firstDayOfMonth = new Date(
        Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1)
      );
      const lastDayOfMonth = new Date(
        Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )
      );

      const thisQuarterRange = helper.getQuarterDateRangeUTC(0);
      const lastQuarterRange = helper.getQuarterDateRangeUTC(-1);

      // Run aggregate queries in parallel
      const [
        openDeals,
        weeklyDeals,
        totalPipelineRevenue,
        monthlyRevenue,
        dueDiligenceDeals,
        avgCloseAllDeals,
        thisQuarterAvg,
        lastQuarterAvg,
        allDealsGrouped,
        totalBeds,
        totalRevenue,
        avgOccupancy,
      ] = await Promise.all([
        Deal.count({
          where: { ...whereClause, deal_status: { [Op.not]: "closed" } },
        }),

        Deal.count({
          where: {
            ...whereClause,
            deal_status: { [Op.not]: "closed" },
            created_at: { [Op.between]: [startOfWeek, endOfWeek] },
          },
        }),

        Deal.sum("purchase_price", {
          where: { ...analyticsWhereClause, deal_status: "pipeline" },
        }),

        Deal.sum("annual_revenue", {
          where: {
            ...analyticsWhereClause,
            deal_status: "pipeline",
            created_at: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] },
          },
        }),

        Deal.count({ where: { ...whereClause, deal_status: "due_diligence" } }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn(
                "AVG",
                getDateDiffLiteral("target_close_date", "created_at")
              ),
              "average_days",
            ],
          ],
          where: { ...whereClause, deal_status: "closed" },
          raw: true,
        }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn(
                "AVG",
                getDateDiffLiteral("target_close_date", "created_at")
              ),
              "average_days",
            ],
          ],
          where: {
            ...whereClause,
            deal_status: "closed",
            created_at: {
              [Op.between]: [
                thisQuarterRange.startDate,
                thisQuarterRange.endDate,
              ],
            },
          },
          raw: true,
        }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn(
                "AVG",
                getDateDiffLiteral("target_close_date", "created_at")
              ),
              "average_days",
            ],
          ],
          where: {
            ...whereClause,
            deal_status: "closed",
            created_at: {
              [Op.between]: [
                lastQuarterRange.startDate,
                lastQuarterRange.endDate,
              ],
            },
          },
          raw: true,
        }),

        Deal.findAll({
          attributes: ["id", "deal_name", "deal_status", "position"],
          where: {
            ...whereClause,
            deal_status: {
              [Op.in]: ["closed", "due_diligence", "pipeline", "final_review"],
            },
          },
          order: [["position", "ASC"], ["created_at", "DESC"]],
          raw: true,
        }),

        // Use analyticsWhereClause for metrics to exclude deals with incomplete/uncertain facility data
        Deal.sum("bed_count", { where: { ...analyticsWhereClause } }),
        Deal.sum("annual_revenue", { where: { ...analyticsWhereClause } }),

        Deal.findOne({
          attributes: [
            [
              sequelize.fn("AVG", sequelize.col("current_occupancy")),
              "average_occupancy",
            ],
          ],
          where: { ...analyticsWhereClause },
          raw: true,
        }),
      ]);

      const thisAvg = thisQuarterAvg?.average_days
        ? parseFloat(thisQuarterAvg.average_days)
        : 0;
      const lastAvg = lastQuarterAvg?.average_days
        ? parseFloat(lastQuarterAvg.average_days)
        : 0;
      const difference = lastAvg - thisAvg;

      const groupedDeals = {
        closedDeals: allDealsGrouped
          .filter((d) => d.deal_status === "closed")
          .slice(0, 5),
        dueDiligenceDeals: allDealsGrouped
          .filter((d) => d.deal_status === "due_diligence")
          .slice(0, 5),
        pipelineDeals: allDealsGrouped
          .filter((d) => d.deal_status === "pipeline")
          .slice(0, 5),
        finalReviewDeals: allDealsGrouped
          .filter((d) => d.deal_status === "final_review")
          .slice(0, 5),
      };

      const averageRevenuePerBed = totalBeds > 0 ? totalRevenue / totalBeds : 0;

      const responseData = {
        total_deals: openDeals,
        weekly_deals: weeklyDeals,
        total_revenue:
          totalRevenue && totalRevenue > 1000000
            ? `$${(totalRevenue / 1000000).toFixed(1)}M`
            : totalRevenue,
        monthly_revenue: monthlyRevenue,
        due_diligence_deals: dueDiligenceDeals,
        average_deal_close_date: avgCloseAllDeals?.average_days ?? 0,
        average_deal_close_date_difference: difference,
        total_pipeline_revenue:
          totalPipelineRevenue && totalPipelineRevenue > 1000000
            ? `$${(totalPipelineRevenue / 1000000).toFixed(1)}M`
            : totalPipelineRevenue,
        total_beds: totalBeds,
        average_revenue_per_bed: averageRevenuePerBed,
        average_current_occupancy: avgOccupancy?.average_occupancy ?? 0,
        ...groupedDeals,
      };

      return helper.success(
        res,
        "Deal statistics fetched successfully",
        responseData
      );
    } catch (error) {
      console.error(error);
      return helper.error(res, error);
    }
  },

  getDealById: async (req, res) => {
    try {
      const required = {
        id: req.query.id,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);
      const deal = await Deal.findByPk(requiredData.id, {
        include: [
          {
            model: User,
            as: "deal_lead",
            attributes: [
              "id",
              "first_name",
              "last_name",
              "email",
              "phone_number",
            ],
          },
          {
            model: User,
            as: "assistant_deal_lead",
            attributes: [
              "id",
              "first_name",
              "last_name",
              "email",
              "phone_number",
            ],
          },
          {
            model: DealTeamMembers,
            as: "deal_team_members",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: DealExternalAdvisors,
            as: "deal_external_advisors",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: DealFacilities,
            as: "deal_facility",
            order: [['display_order', 'ASC'], ['created_at', 'ASC']]
          },
        ],
      });

      // Convert to plain object FIRST to allow modifications to be serialized properly
      // Sequelize model instances don't serialize modified properties correctly
      let dealResponse = deal ? deal.toJSON() : null;

      // Fetch time-series data and merge into extraction_data for frontend
      if (dealResponse && dealResponse.extraction_data) {
        try {
          // Parse extraction_data early to get bed_count for ADC calculation
          let extractionData = typeof dealResponse.extraction_data === 'string'
            ? JSON.parse(dealResponse.extraction_data)
            : dealResponse.extraction_data;

          // PORTFOLIO DEAL HANDLING
          // For portfolio deals, extraction_data has a nested structure:
          // { portfolio_data: {...}, portfolio_summary: {...}, is_portfolio_deal: true, ... }
          // We need to expose portfolio-level metrics at the root for easier frontend access
          if (extractionData.is_portfolio_deal && extractionData.portfolio_data) {
            // Add a convenience field with portfolio-level metrics
            extractionData.deal_level_data = extractionData.portfolio_data;

            // Also expose aggregated summary for quick access
            if (extractionData.portfolio_summary) {
              extractionData.aggregated_metrics = extractionData.portfolio_summary.aggregates;
            }
          }

          // Get bed_count for calculating ADC from occupancy
          const bedCount = extractionData.bed_count || null;

          // Fetch monthly census data for trends chart
          const monthlyCensus = await DealMonthlyCensus.findAll({
            where: { deal_id: requiredData.id },
            order: [['month', 'ASC']]
          });

          if (monthlyCensus && monthlyCensus.length > 0) {
            // Transform to frontend format for CensusTrendCharts
            // Apply same heuristic as extractionReconciler to fix misplaced occupancy data
            const monthlyTrendsArray = monthlyCensus.map(c => {
              let occupancy = c.occupancy_percentage;
              let census = c.average_daily_census;

              // SMART HEURISTIC: Determine if we should swap ADC<->occupancy or calculate occupancy from ADC
              // If bedCount is known AND average_daily_census makes sense as actual census (near or below bed count),
              // then calculate occupancy from ADC. Only swap if no bedCount and value looks like percentage.
              if ((occupancy === null || occupancy === undefined) && census !== null && census > 0) {
                if (bedCount && census <= bedCount * 1.1) {
                  // ADC makes sense as census (at or below 110% of bed count), calculate occupancy
                  occupancy = Math.round((census / bedCount) * 100 * 100) / 100;
                } else if (!bedCount && census >= 60 && census <= 100) {
                  // No bedCount and value is in typical occupancy percentage range (60-100%)
                  // Assume AI put occupancy in wrong field
                  occupancy = census;
                  census = null;
                }
              }

              // Calculate ADC from occupancy and bed_count when ADC is missing
              // ADC = (occupancy_pct / 100) * bed_count
              if ((census === null || census === undefined) && occupancy !== null && bedCount) {
                census = Math.round((occupancy / 100) * bedCount * 100) / 100;
              }

              return {
                month: c.month,
                average_daily_census: census,
                occupancy_pct: occupancy,
                medicaid_pct: c.medicaid_percentage,
                medicare_pct: c.medicare_percentage,
                private_pay_pct: c.private_pay_percentage
              };
            });

            // Wrap in ExtractedField format that frontend expects: { value: [...], source: "..." }
            extractionData.monthly_trends = {
              value: monthlyTrendsArray,
              source: "Monthly census data from time-series database",
              confidence: "high"
            };

            // CRITICAL: Also add to census_and_occupancy for frontend CensusTrendCharts
            // Frontend reads from extractionData.census_and_occupancy.monthly_trends
            if (!extractionData.census_and_occupancy) {
              extractionData.census_and_occupancy = {};
            }
            extractionData.census_and_occupancy.monthly_trends = monthlyTrendsArray;

            // Calculate and fix current_occupancy if it's missing but we have monthly data
            const validOccupancies = monthlyTrendsArray
              .filter(m => m.occupancy_pct !== null && m.occupancy_pct !== undefined)
              .map(m => m.occupancy_pct);

            if (validOccupancies.length > 0) {
              const avgOccupancy = validOccupancies.reduce((a, b) => a + b, 0) / validOccupancies.length;

              // If current_occupancy is null or zero, use the calculated average
              if (!extractionData.current_occupancy) {
                extractionData.current_occupancy = Math.round(avgOccupancy * 100) / 100;
                console.log(`[getDealById] Fixed current_occupancy to ${extractionData.current_occupancy}% from ${validOccupancies.length} monthly records`);
              }
            }

            // Update the response object with enhanced extraction_data
            dealResponse.extraction_data = extractionData;
            console.log(`[getDealById] Added ${monthlyTrendsArray.length} monthly trend records for deal ${requiredData.id}`);
          } else {
            // FALLBACK: Time-series table is empty, but extraction_data.monthly_trends may exist
            // Calculate ADC from occupancy for the existing monthly_trends data
            const existingTrends = extractionData.monthly_trends;
            if (existingTrends) {
              // Handle both { value: [...] } format and raw array format
              const trendsArray = existingTrends.value || (Array.isArray(existingTrends) ? existingTrends : null);

              if (trendsArray && Array.isArray(trendsArray) && trendsArray.length > 0) {
                console.log(`[getDealById] Processing ${trendsArray.length} existing monthly_trends records for ADC calculation`);

                const enhancedTrends = trendsArray.map(item => {
                  let occupancy = item.occupancy_pct;
                  let census = item.average_daily_census;

                  // Calculate ADC from occupancy and bed_count when ADC is missing
                  // ADC = (occupancy_pct / 100) * bed_count
                  if ((census === null || census === undefined) && occupancy !== null && bedCount) {
                    census = Math.round((occupancy / 100) * bedCount * 100) / 100;
                  }

                  // Calculate occupancy from ADC and bed_count when occupancy is missing
                  // occupancy_pct = (ADC / bed_count) * 100
                  if ((occupancy === null || occupancy === undefined) && census !== null && bedCount) {
                    occupancy = Math.round((census / bedCount) * 100 * 100) / 100;
                  }

                  return {
                    ...item,
                    average_daily_census: census,
                    occupancy_pct: occupancy
                  };
                });

                // Update monthly_trends with calculated ADC values
                if (existingTrends.value) {
                  extractionData.monthly_trends = {
                    ...existingTrends,
                    value: enhancedTrends
                  };
                } else {
                  extractionData.monthly_trends = {
                    value: enhancedTrends,
                    source: "Monthly census data from extraction",
                    confidence: "high"
                  };
                }

                // Also update census_and_occupancy.monthly_trends for frontend
                if (!extractionData.census_and_occupancy) {
                  extractionData.census_and_occupancy = {};
                }
                extractionData.census_and_occupancy.monthly_trends = enhancedTrends;

                dealResponse.extraction_data = extractionData;
                console.log(`[getDealById] Enhanced ${enhancedTrends.length} monthly_trends records with calculated ADC`);
              }
            }
          }

          // Fetch monthly financials for proforma
          const monthlyFinancials = await DealMonthlyFinancials.findAll({
            where: { deal_id: requiredData.id },
            order: [['month', 'ASC']]
          });

          if (monthlyFinancials && monthlyFinancials.length > 0) {
            // Use the same extractionData we parsed earlier (or parse if not yet parsed)
            if (!extractionData) {
              extractionData = typeof dealResponse.extraction_data === 'string'
                ? JSON.parse(dealResponse.extraction_data)
                : dealResponse.extraction_data;
            }

            extractionData.monthly_financials = monthlyFinancials.map(f => ({
              month: f.month,
              total_revenue: f.total_revenue,
              medicaid_revenue: f.medicaid_revenue,
              medicare_revenue: f.medicare_revenue,
              private_pay_revenue: f.private_pay_revenue,
              total_expenses: f.total_expenses,
              operating_expenses: f.operating_expenses,
              net_income: f.net_income,
              ebitda: f.ebitda,
              ebitdar: f.ebitdar
            }));

            dealResponse.extraction_data = extractionData;
          }

          // Fetch expense ratios for ProForma tab
          const expenseRatios = await DealExpenseRatios.findOne({
            where: { deal_id: requiredData.id }
          });

          if (expenseRatios) {
            // Use the same extractionData we parsed earlier (or parse if not yet parsed)
            if (!extractionData) {
              extractionData = typeof dealResponse.extraction_data === 'string'
                ? JSON.parse(dealResponse.extraction_data)
                : dealResponse.extraction_data;
            }

            // Add expense ratios as flat fields that ProFormaTab expects
            // These fields map to currentFinancials in ProFormaTab.jsx
            extractionData.labor_pct_of_revenue = expenseRatios.labor_pct_of_revenue;
            extractionData.agency_pct_of_labor = expenseRatios.agency_pct_of_labor;
            extractionData.food_cost_per_resident_day = expenseRatios.food_cost_per_resident_day;
            extractionData.management_fee_pct = expenseRatios.management_fee_pct;
            extractionData.bad_debt_pct = expenseRatios.bad_debt_pct;
            extractionData.utilities_pct_of_revenue = expenseRatios.utilities_pct_of_revenue;
            extractionData.insurance_pct_of_revenue = expenseRatios.insurance_pct_of_revenue;
            extractionData.total_labor_cost = expenseRatios.total_labor_cost;
            extractionData.agency_labor_total = expenseRatios.agency_labor_total;
            extractionData.revenue_per_resident_day = expenseRatios.revenue_per_resident_day;

            // Also store as nested structure for backward compatibility
            extractionData.expense_ratios = {
              labor_pct_of_revenue: expenseRatios.labor_pct_of_revenue,
              agency_pct_of_labor: expenseRatios.agency_pct_of_labor,
              food_cost_per_resident_day: expenseRatios.food_cost_per_resident_day,
              management_fee_pct: expenseRatios.management_fee_pct,
              bad_debt_pct: expenseRatios.bad_debt_pct,
              utilities_pct_of_revenue: expenseRatios.utilities_pct_of_revenue,
              insurance_pct_of_revenue: expenseRatios.insurance_pct_of_revenue,
              total_labor_cost: expenseRatios.total_labor_cost,
              agency_labor_total: expenseRatios.agency_labor_total,
              ebitda_margin: expenseRatios.ebitda_margin,
              ebitdar_margin: expenseRatios.ebitdar_margin,
              revenue_per_resident_day: expenseRatios.revenue_per_resident_day,
              occupancy: expenseRatios.occupancy
            };

            dealResponse.extraction_data = extractionData;
            console.log(`[getDealById] Added expense ratios for deal ${requiredData.id}`);
          }
        } catch (timeSeriesError) {
          console.error('Error fetching time-series data for deal:', timeSeriesError);
          // Don't fail the request if time-series fetch fails
        }
      }

      return helper.success(res, "Deal fetched successfully", dealResponse);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  deleteDeal: async (req, res) => {
    try {
      const required = { id: req.params.id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // fetch the deal:
      const deal = await Deal.findByPk(requiredData.id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // delete the deal comments:
      await DealComments.destroy({
        where: {
          deal_id: requiredData.id,
          parent_id: { [Op.ne]: null },
        },
      });
      await DealComments.destroy({
        where: {
          deal_id: requiredData.id,
          parent_id: null,
        },
      });

      // delete the deal documents:
      await DealDocuments.destroy({ where: { deal_id: requiredData.id } });

      // delete the deal team members:
      await DealTeamMembers.destroy({ where: { deal_id: requiredData.id } });

      // delete the deal external advisors:
      await DealExternalAdvisors.destroy({
        where: { deal_id: requiredData.id },
      });

      // delete the deal facilities:
      await DealFacilities.destroy({ where: { deal_id: requiredData.id } });

      // delete the time-series extraction data:
      await DealMonthlyFinancials.destroy({ where: { deal_id: requiredData.id } });
      await DealMonthlyCensus.destroy({ where: { deal_id: requiredData.id } });
      await DealMonthlyExpenses.destroy({ where: { deal_id: requiredData.id } });
      await DealRateSchedules.destroy({ where: { deal_id: requiredData.id } });
      await DealExpenseRatios.destroy({ where: { deal_id: requiredData.id } });

      // delete pro forma scenarios:
      await DealProformaScenarios.destroy({ where: { deal_id: requiredData.id } });

      // delete extracted text (if exists):
      if (db.deal_extracted_text) {
        await db.deal_extracted_text.destroy({ where: { deal_id: requiredData.id } });
      }

      // delete the deal:
      await deal.destroy();

      // return the success response:
      return helper.success(res, "Deal deleted successfully", {
        id: requiredData.id,
      });
    } catch (err) {
      console.error('[deleteDeal] Error:', err);
      return helper.error(res, err);
    }
  },

  // Bulk delete multiple deals
  bulkDeleteDeals: async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return helper.error(res, "Please provide an array of deal IDs to delete");
      }

      const deletedIds = [];
      const errors = [];

      for (const id of ids) {
        try {
          // Fetch the deal
          const deal = await Deal.findByPk(id);
          if (!deal) {
            errors.push({ id, error: "Deal not found" });
            continue;
          }

          // Delete all related records
          await DealComments.destroy({
            where: {
              deal_id: id,
              parent_id: { [Op.ne]: null },
            },
          });
          await DealComments.destroy({
            where: {
              deal_id: id,
              parent_id: null,
            },
          });
          await DealDocuments.destroy({ where: { deal_id: id } });
          await DealTeamMembers.destroy({ where: { deal_id: id } });
          await DealExternalAdvisors.destroy({ where: { deal_id: id } });
          await DealFacilities.destroy({ where: { deal_id: id } });
          await DealMonthlyFinancials.destroy({ where: { deal_id: id } });
          await DealMonthlyCensus.destroy({ where: { deal_id: id } });
          await DealMonthlyExpenses.destroy({ where: { deal_id: id } });
          await DealRateSchedules.destroy({ where: { deal_id: id } });
          await DealExpenseRatios.destroy({ where: { deal_id: id } });
          await DealProformaScenarios.destroy({ where: { deal_id: id } });

          if (db.deal_extracted_text) {
            await db.deal_extracted_text.destroy({ where: { deal_id: id } });
          }

          // Delete change logs and user views if they exist
          if (db.deal_change_logs) {
            await db.deal_change_logs.destroy({ where: { deal_id: id } });
          }
          if (db.deal_user_views) {
            await db.deal_user_views.destroy({ where: { deal_id: id } });
          }

          // Delete the deal
          await deal.destroy();
          deletedIds.push(id);
        } catch (err) {
          console.error(`[bulkDeleteDeals] Error deleting deal ${id}:`, err);
          errors.push({ id, error: err.message });
        }
      }

      return helper.success(res, `Successfully deleted ${deletedIds.length} deal(s)`, {
        deletedIds,
        errors,
        totalRequested: ids.length,
        totalDeleted: deletedIds.length,
      });
    } catch (err) {
      console.error('[bulkDeleteDeals] Error:', err);
      return helper.error(res, err);
    }
  },

  updateDeal: async (req, res) => {
    try {
      // Extract fields from request body
      const {
        id,
        deal_name,
        user_id,
        deal_type,
        facility_name,
        facility_type,
        bed_count,
        city,
        state,
        zip_code,
        purchase_price = 0,
        annual_revenue = 0,
        deal_lead_id,
        priority_level,
        deal_source,
        country,
        street_address,
        primary_contact_name,
        title,
        phone_number,
        email,
        target_close_date,
        dd_period_weeks,
        price_per_bed = 0,
        down_payment = 0,
        financing_amount = 0,
        revenue_multiple = 0,
        ebitda = 0,
        ebitda_multiple = 0,
        ebitda_margin = 0,
        net_operating_income = 0,
        current_occupancy = 0,
        average_daily_rate = 0,
        medicare_percentage = 0,
        private_pay_percentage = 0,
        target_irr_percentage = 0,
        target_hold_period = 0,
        projected_cap_rate_percentage = 0,
        exit_multiple = 0,
        assistant_deal_lead_id,
        deal_team_members,
        deal_external_advisors,
        deal_status,
        notificationSettings = {},
      } = req.body;

      // Compose required and nonrequired objects for validation
      const required = {
        id,
        deal_name,
        user_id,
        deal_type,
        facility_name,
        facility_type,
        bed_count,
        city,
        state,
        country,
        zip_code,
        street_address,
        purchase_price: purchase_price ? purchase_price : 0,
        annual_revenue: annual_revenue ? annual_revenue : 0,
        deal_lead_id,
      };
      const nonrequired = {
        priority_level,
        deal_source,
        primary_contact_name,
        title,
        phone_number,
        email,
        target_close_date,
        dd_period_weeks,
        price_per_bed: price_per_bed ? price_per_bed : 0,
        down_payment: down_payment ? down_payment : 0,
        financing_amount: financing_amount ? financing_amount : 0,
        revenue_multiple: revenue_multiple ? revenue_multiple : 0,
        ebitda: ebitda ? ebitda : 0,
        ebitda_multiple: ebitda_multiple ? ebitda_multiple : 0,
        ebitda_margin: ebitda_margin ? ebitda_margin : 0,
        net_operating_income: net_operating_income ? net_operating_income : 0,
        current_occupancy: current_occupancy ? current_occupancy : 0,
        average_daily_rate: average_daily_rate ? average_daily_rate : 0,
        medicare_percentage: medicare_percentage ? medicare_percentage : 0,
        private_pay_percentage: private_pay_percentage
          ? private_pay_percentage
          : 0,
        target_irr_percentage: target_irr_percentage
          ? target_irr_percentage
          : 0,
        target_hold_period: target_hold_period ? target_hold_period : 0,
        projected_cap_rate_percentage: projected_cap_rate_percentage
          ? projected_cap_rate_percentage
          : 0,
        exit_multiple: exit_multiple ? exit_multiple : 0,
        assistant_deal_lead_id,
        deal_team_members,
        deal_external_advisors,
        deal_status,
      };

      const requiredData = await helper.validateObject(required, nonrequired);

      // Convert notification settings to 'yes'/'no'
      requiredData.email_notification_major_updates =
        notificationSettings.email_notification_major_updates === true
          ? "yes"
          : "no";
      requiredData.weekly_progress_report =
        notificationSettings.weekly_progress_report === true ? "yes" : "no";
      requiredData.slack_integration_for_team_communication =
        notificationSettings.slack_integration_for_team_communication === true
          ? "yes"
          : "no";
      requiredData.calendar_integration =
        notificationSettings.calendar_integration === true ? "yes" : "no";
      requiredData.sms_alert_for_urgent_items =
        notificationSettings.sms_alert_for_urgent_items === true ? "yes" : "no";
      requiredData.document_upload_notification =
        notificationSettings.document_upload_notification === true
          ? "yes"
          : "no";

      // Find the deal to update
      const deal = await Deal.findByPk(requiredData.id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Store original values before update for change tracking
      const originalDeal = deal.toJSON();

      const userData = await User.findByPk(requiredData.user_id);

      // create user set:
      const allUserIds = new Set();
      allUserIds.add(deal.deal_lead_id);
      allUserIds.add(deal.assistant_deal_lead_id);
      allUserIds.add(deal.user_id);

      // Attempt facility matching to auto-populate missing data
      // Run if: (1) no beds, (2) beds is 0, OR (3) facility name changed and beds <= 0
      const shouldMatch = requiredData.facility_name && (
        !requiredData.bed_count ||
        requiredData.bed_count === null ||
        requiredData.bed_count === 0 ||
        (originalDeal.facility_name !== requiredData.facility_name && requiredData.bed_count <= 0)
      );

      // Note: Facility matching removed from updateDeal - it should only happen during extraction
      // Manual facility selection via FacilityMatchModal is handled by selectFacilityMatch() endpoint

      // Check if any facility fields are being updated - if so, use three-way sync
      const facilityFields = ['facility_name', 'street_address', 'city', 'state', 'zip_code', 'bed_count'];
      const hasFacilityChanges = facilityFields.some(field =>
        requiredData[field] !== undefined && requiredData[field] !== originalDeal[field]
      );

      if (hasFacilityChanges) {
        // Use syncFacilityData for three-way sync (deals, deal_facilities, extraction_data)
        await syncFacilityData(deal.id, {
          facility_name: requiredData.facility_name,
          street_address: requiredData.street_address,
          city: requiredData.city,
          state: requiredData.state,
          zip_code: requiredData.zip_code,
          bed_count: requiredData.bed_count,
          facility_type: requiredData.facility_type
        }, 'Manual Edit');
      }

      // Update the deal (all fields including non-facility fields)
      await deal.update(requiredData);

      // Detect and log field changes
      const changes = detectChanges(originalDeal, requiredData);

      if (changes.length > 0) {
        // Log each change to deal_change_logs
        await Promise.all(changes.map(change =>
          DealChangeLogs.create({
            deal_id: deal.id,
            user_id: userData.id,
            change_type: change.field_name === 'deal_status' ? 'status_change' : 'field_update',
            field_name: change.field_name,
            field_label: change.field_label,
            old_value: change.old_value,
            new_value: change.new_value
          })
        ));

        // Update last activity on deal
        await deal.update({
          last_activity_at: new Date(),
          last_activity_by: userData.id,
          last_activity_type: 'edited'
        });
      }

      // fetch all users who are mentioned in the comment:
      if (deal_team_members) {
        await DealTeamMembers.destroy({ where: { deal_id: requiredData.id } });
        deal_team_members.forEach(async (member) => {
          await DealTeamMembers.create({
            deal_id: requiredData.id,
            user_id: member.user_id ? member.user_id : member.id,
          });
          allUserIds.add(member.user_id);
        });
      }

      if (deal_external_advisors) {
        await DealExternalAdvisors.destroy({
          where: { deal_id: requiredData.id },
        });
        deal_external_advisors.forEach(async (advisor) => {
          await DealExternalAdvisors.create({
            deal_id: requiredData.id,
            user_id: advisor.user_id ? advisor.user_id : advisor.id,
          });
          allUserIds.add(advisor.user_id);
        });
      }

      // create recent activity with improved message showing what changed:
      const changeSummary = formatChangeSummary(changes);
      const activityMessage = changeSummary
        ? `<strong>${userData.first_name} ${userData.last_name}</strong> updated ${changeSummary} on deal <strong>${deal.deal_name}</strong>.`
        : `The deal <strong>${deal.deal_name}</strong> has been updated by <strong>${userData.first_name} ${userData.last_name}</strong>.`;

      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          if (userId !== userData.id) {
            await RecentActivity.create({
              to_id: userId,
              from_id: userData.id,
              action: "deal_updated",
              subject_type: "deal",
              subject_id: requiredData.id,
              is_team: true,
              message: activityMessage,
              data: JSON.stringify({
                deal_id: deal.id,
                deal_name: deal.deal_name,
                to_id: userId,
                from_id: userData.id,
                changes: changes.length > 0 ? changes : null,
              }),
            });
          }
        })
      );

      const updatedDeal = await Deal.findByPk(requiredData.id, {
        include: [
          {
            model: DealTeamMembers,
            as: "deal_team_members",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: DealExternalAdvisors,
            as: "deal_external_advisors",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
        ],
      });

      return helper.success(res, "Deal updated successfully", updatedDeal);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to update the deal status:
  Method: PUT
  URL: /api/v1/deal/update-deal-status
  */
  updateDealStatus: async (req, res) => {
    try {
      const required = { id: req.body.id, deal_status: req.body.deal_status };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // update the deal status:
      const deal = await Deal.findByPk(requiredData.id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // update the deal status:
      await deal.update({ deal_status: requiredData.deal_status });

      // return the success response:
      return helper.success(res, "Deal status updated successfully", deal);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will update deal positions for reordering within a status column
  Method: PUT
  URL: /api/v1/deal/update-deal-position
  Body: { deals: [{ id, position }, ...] }
  */
  updateDealPositions: async (req, res) => {
    try {
      const { deals } = req.body;

      if (!deals || !Array.isArray(deals) || deals.length === 0) {
        return helper.error(res, "Deals array is required");
      }

      // Validate all deals have id and position
      for (const deal of deals) {
        if (!deal.id || typeof deal.position !== 'number') {
          return helper.error(res, "Each deal must have an id and position");
        }
      }

      // Update positions in a transaction
      const updatedDeals = [];
      for (const dealData of deals) {
        const deal = await Deal.findByPk(dealData.id);
        if (deal) {
          await deal.update({ position: dealData.position });
          updatedDeals.push({ id: deal.id, position: dealData.position });
        }
      }

      return helper.success(res, "Deal positions updated successfully", { updated: updatedDeals });
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to update the deal extraction data:
  Method: PUT
  URL: /api/v1/deal/:id/extraction-data
  */
  updateExtractionData: async (req, res) => {
    try {
      const { id } = req.params;
      const { extraction_data } = req.body;

      if (!id) {
        return helper.error(res, "Deal ID is required");
      }

      if (!extraction_data) {
        return helper.error(res, "Extraction data is required");
      }

      // Find the deal
      const deal = await Deal.findByPk(id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get existing extraction data to detect changed fields
      let oldExtractionData = {};
      if (deal.extraction_data) {
        try {
          oldExtractionData = typeof deal.extraction_data === 'string'
            ? JSON.parse(deal.extraction_data)
            : deal.extraction_data;
        } catch (e) { /* ignore */ }
      }

      // Parse new extraction data
      const newExtractionData = typeof extraction_data === 'string'
        ? JSON.parse(extraction_data)
        : extraction_data;

      // Detect changed fields
      const changedFields = Object.keys(newExtractionData).filter(key => {
        const oldVal = JSON.stringify(oldExtractionData[key]);
        const newVal = JSON.stringify(newExtractionData[key]);
        return oldVal !== newVal;
      });

      // Build update object - always update extraction_data
      const updateData = { extraction_data: extraction_data };

      // Also sync key fields to deal's core columns for consistency
      // This ensures the deal_name shown in lists matches the extraction view
      if (newExtractionData.deal_name !== undefined) {
        updateData.deal_name = newExtractionData.deal_name;
      }
      if (newExtractionData.facility_name !== undefined) {
        updateData.facility_name = newExtractionData.facility_name;
      }

      // Update the deal
      await deal.update(updateData);

      // Record extraction history for audit trail
      if (changedFields.length > 0) {
        await recordExtractionHistory(
          id,
          newExtractionData,
          'manual_edit',
          changedFields,
          req.user?.email || 'system'
        );
      }

      // Return the updated deal
      return helper.success(res, "Extraction data updated successfully", {
        id: deal.id,
        extraction_data: deal.extraction_data
      });
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to add a deal comment:
  METHOD: POST
  */
  addDealComment: async (req, res) => {
    try {
      const required = {
        deal_id: req.body.deal_id,
        user_id: req.user.id,
        comment: req.body.comment,
      };

      const nonrequired = {
        mentioned_user_ids: req.body.mentioned_user_ids || [],
        parent_id: req.body.parent_id || null,
      };

      const validatedData = await helper.validateObject(required, nonrequired);

      // fetch user:
      const userDetails = await User.findByPk(validatedData.user_id);

      // Create the comment
      const dealComment = await DealComments.create({
        deal_id: validatedData.deal_id,
        user_id: validatedData.user_id,
        comment: validatedData.comment,
        parent_id: validatedData.parent_id,
      });

      const allUserIds = new Set();

      // fetch deal data
      const deal = await Deal.findByPk(validatedData.deal_id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Log comment as activity in change logs
      await DealChangeLogs.create({
        deal_id: validatedData.deal_id,
        user_id: validatedData.user_id,
        change_type: 'comment_added',
        metadata: JSON.stringify({ comment_id: dealComment.id })
      });

      // Update last activity on deal
      await deal.update({
        last_activity_at: new Date(),
        last_activity_by: validatedData.user_id,
        last_activity_type: 'commented'
      });

      allUserIds.add(deal.deal_lead_id);
      allUserIds.add(deal.assistant_deal_lead_id);

      // Save mentions and send notifications:
      if (
        Array.isArray(validatedData.mentioned_user_ids) &&
        validatedData.mentioned_user_ids.length > 0
      ) {
        const mentionData = validatedData.mentioned_user_ids.map((user_id) => ({
          comment_id: dealComment.id,
          mentioned_user_id: user_id,
        }));
        await CommentMentions.bulkCreate(mentionData);

        for (const user_id of validatedData.mentioned_user_ids) {
          if (user_id !== req.user.id) {
            await createNotification({
              to_id: user_id,
              from_id: userDetails.id,
              notification_type: "comment",
              title: "You were mentioned in a comment",
              content: `${userDetails.first_name} ${userDetails.last_name} mentioned you in a comment on deal ${deal.deal_name}`,
              ref_id: dealComment.id,
              ref_type: "deal"
            });
            allUserIds.add(user_id);
          }
        }
      }

      // fetch all users who are mentioned in the comment:
      const dealTeamMembers = await DealTeamMembers.findAll({
        where: {
          deal_id: validatedData.deal_id,
        },
      });
      dealTeamMembers.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      const dealExternalAdvisors = await DealExternalAdvisors.findAll({
        where: {
          deal_id: validatedData.deal_id,
        },
      });
      dealExternalAdvisors.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      // create recent activity:
      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          if (userId !== userDetails.id) {
            await RecentActivity.create({
              to_id: userId,
              from_id: userDetails.id,
              action: "mentioned_in_comment",
              subject_type: "deal_comment",
              subject_id: dealComment.id,
              message: `<strong>${userDetails.first_name} ${userDetails.last_name}</strong> mentioned you in a comment on deal <strong>${deal.deal_name}</strong>.`,
              data: JSON.stringify({
                deal_id: deal.id,
                deal_name: deal.deal_name,
                comment_id: dealComment.id,
                to_id: userId,
                from_id: userDetails.id,
              }),
            });
          }
        })
      );

      // If it's a reply, send a notification to the original commenter
      if (validatedData.parent_id) {
        const parentComment = await DealComments.findByPk(
          validatedData.parent_id
        );
        if (parentComment && parentComment.user_id !== req.user.id) {
          await createNotification({
            to_id: parentComment.user_id,
            from_id: userDetails.id,
            notification_type: "reply",
            title: "New reply on your comment",
            content: `${userDetails.first_name} ${userDetails.last_name} replied to your comment on deal #${validatedData.deal_id}`,
            ref_id: dealComment.id,
            ref_type: "comment"
          });
        }
      }

      // Return with user details
      const dealCommentData = await DealComments.findByPk(dealComment.id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
        ],
      });

      return helper.success(
        res,
        "Deal comment added successfully",
        dealCommentData
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to fetch all deal comments:
  Method: GET
  URL: /api/v1/deal/get-deal-comments
  */
  getDealComments: async (req, res) => {
    try {
      const required = { deal_id: req.query.deal_id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const dealComments = await DealComments.findAll({
        where: {
          deal_id: requiredData.deal_id,
          parent_id: null,
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
          {
            model: DealComments,
            as: "replies",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
              {
                model: User,
                as: "mentioned_users",
                attributes: ["id", "first_name", "last_name", "profile_url"],
              },
            ],
          },
          {
            model: User,
            as: "mentioned_users",
            attributes: ["id", "first_name", "last_name"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      return helper.success(
        res,
        "Deal comments fetched successfully",
        dealComments
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to delete a deal comment:
  Method: DELETE
  URL: /api/v1/deal/delete-deal-comment
  */
  deleteDealComment: async (req, res) => {
    try {
      const required = { id: req.params.id };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      const dealComment = await DealComments.findByPk(requiredData.id);
      if (!dealComment) {
        return helper.error(res, "Deal comment not found");
      }

      // If it's a parent comment
      if (dealComment.parent_id === null) {
        // First delete all replies
        await DealComments.destroy({
          where: { parent_id: dealComment.id },
        });
      }

      // Delete the comment itself
      await dealComment.destroy();

      // return the success response:
      return helper.success(res, "Deal comment deleted successfully", {
        id: dealComment.id,
      });
    } catch (err) {
      return helper.error(res, err);
    }
  },

  addDealDocument: async (req, res) => {
    try {
      const required = {
        deal_id: req.body.deal_id,
        user_id: req.user.id,
        document_url: req.body.document_url,
        document_name: req.body.document_name,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);

      // fetch deal:
      const deal = await Deal.findByPk(requiredData.deal_id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // create user set:
      const allUserIds = new Set();
      allUserIds.add(deal.deal_lead_id);
      allUserIds.add(deal.assistant_deal_lead_id);
      allUserIds.add(deal.user_id);

      // fetch all users who are mentioned in the comment:
      const dealTeamMembers = await DealTeamMembers.findAll({
        where: {
          deal_id: requiredData.deal_id,
        },
      });
      dealTeamMembers.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      const dealExternalAdvisors = await DealExternalAdvisors.findAll({
        where: {
          deal_id: requiredData.deal_id,
        },
      });
      dealExternalAdvisors.forEach((member) => {
        allUserIds.add(member.user_id);
      });

      // create deal document:
      const dealDocument = await DealDocuments.create(requiredData);

      // create recent activity:
      const userData = await User.findByPk(requiredData.user_id);
      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          if (userId !== requiredData.user_id) {
            await RecentActivity.create({
              to_id: userId,
              from_id: requiredData.user_id,
              action: "new_deal_document_added",
              subject_type: "deal_document",
              subject_id: dealDocument.id,
              is_team: true,
              message: `A new document <strong>${dealDocument.document_name}</strong> has been added by <strong>${userData.first_name} ${userData.last_name}</strong> to the deal <strong>${deal.deal_name}</strong> on our platform.`,
              data: JSON.stringify({
                deal_id: deal.id,
                deal_name: deal.deal_name,
                document_id: dealDocument.id,
                to_id: userId,
                from_id: requiredData.user_id,
              }),
            });
          }
        })
      );

      // fetch deal document:
      const dealDocumentData = await DealDocuments.findByPk(dealDocument.id, {
        include: [{ model: User, as: "user" }],
      });
      return helper.success(
        res,
        "Deal document added successfully",
        dealDocumentData
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  getDealDocuments: async (req, res) => {
    try {
      const required = {
        deal_id: req.query.deal_id,
      };
      const nonrequired = {};
      const requiredData = await helper.validateObject(required, nonrequired);
      const dealDocuments = await DealDocuments.findAll({
        where: { deal_id: requiredData.deal_id },
        include: [{ model: User, as: "user" }],
        order: [["created_at", "DESC"]],
      });
      return helper.success(
        res,
        "Deal documents fetched successfully",
        dealDocuments
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /* 
  This function will help to fetch all user notifications:
  Method: GET
  URL: /api/v1/deal/get-user-notifications
  */
  getUserNotifications: async (req, res) => {
    try {
      // fetch user notifications:
      const userNotifications = await UserNotification.findAll({
        where: { to_id: req.user.id },
        order: [["createdAt", "DESC"]],
      });
      if (userNotifications.length === 0) {
        return helper.success(res, "No user notifications found", []);
      }

      // return the success response:
      return helper.success(
        res,
        "User notifications fetched successfully",
        userNotifications
      );
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /*
  This function will help to mark a user notification as read:
  Method: POST
  URL: /api/v1/deal/read-notification
  */
  markUserNotificationAsRead: async (req, res) => {
    try {
      // Mark all user notifications as read for this user
      await UserNotification.update(
        { is_read: true },
        {
          where: {
            status: 1,
            to_id: req.user.id,
          },
        }
      );

      return helper.success(res, "User notifications marked as read");
    } catch (err) {
      return helper.error(res, err);
    }
  },

  getActiveDeals: async (req, res) => {
    try {
      const search = req.query.search;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const user = await User.findByPk(req.user.id);

      const baseWhere = {
        deal_status: { [Op.not]: "closed" },
      };

      if (search) {
        baseWhere.deal_name = {
          [Op.like]: `%${search}%`,
        };
      }

      // For non-admin users, restrict results to associated deals
      if (user.role !== "admin") {
        // Fetch deal IDs from deal_team_members table
        const teamMemberDeals = await DealTeamMembers.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });

        const teamDealIds = teamMemberDeals.map((d) => d.deal_id);

        // fetch external advisor assigned deals:
        const externalAdvisorDeals = await DealExternalAdvisors.findAll({
          attributes: ["deal_id"],
          where: { user_id: user.id },
        });
        const externalAdvisorDealIds = externalAdvisorDeals.map(
          (entry) => entry.deal_id
        );

        baseWhere[Op.or] = [
          { user_id: user.id },
          { deal_lead_id: user.id },
          { assistant_deal_lead_id: user.id },
          { id: { [Op.in]: teamDealIds } },
          { id: { [Op.in]: externalAdvisorDealIds } },
        ];
      }

      const deal = await Deal.findAll({
        where: baseWhere,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        include: [
          {
            model: User,
            as: "deal_lead",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
          {
            model: User,
            as: "assistant_deal_lead",
            attributes: ["id", "first_name", "last_name", "profile_url"],
          },
        ],
      });

      const total = await Deal.count({ where: baseWhere });
      const totalPages = Math.ceil(total / limit);

      const body = {
        deals: deal,
        total,
        totalPages,
      };

      return helper.success(res, "Deals fetched successfully", body);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /**
   * Extract deal information from uploaded document(s) using AI
   * POST /api/v1/deal/extract-from-document
   */
  extractDealFromDocument: async (req, res) => {
    try {
      // Check if files were uploaded
      if (!req.files || !req.files.document) {
        return helper.error(res, "No document uploaded. Please upload a PDF, image, or text file.");
      }

      const uploadedFiles = req.files.document;

      // Handle single or multiple files
      const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

      // Validate file types
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];

      for (const file of files) {
        if (!allowedTypes.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
          return helper.error(res, `Unsupported file type: ${file.mimetype}. Please upload PDF, images, Excel, Word, or text files.`);
        }
      }

      // Check file size (max 20MB per file)
      const maxSize = 20 * 1024 * 1024; // 20MB
      for (const file of files) {
        if (file.size > maxSize) {
          return helper.error(res, `File ${file.name} exceeds maximum size of 20MB`);
        }
      }

      // Save files to local storage (temporarily without deal ID, will be moved after deal creation)
      const savedFiles = await saveFiles(files);
      const successfullySavedFiles = savedFiles.filter(f => f.success);

      let result;

      if (files.length === 1) {
        // Single file extraction
        result = await extractDealFromDocument(files[0].data, files[0].mimetype, files[0].name);

        if (!result.success) {
          return helper.error(res, result.error || "Failed to extract data from document");
        }

        return helper.success(res, "Deal data extracted successfully", {
          extractedData: result.data,
          confidence: result.confidence,
          fileName: files[0].name,
          uploadedFiles: successfullySavedFiles.map(f => ({
            filename: f.filename,
            originalName: f.originalName,
            url: f.url,
            mimeType: f.mimeType,
            size: f.size
          }))
        });
      } else {
        // Multiple files - merge results
        result = await extractFromMultipleDocuments(files);

        if (!result.success) {
          return helper.error(res, "Failed to extract data from documents");
        }

        return helper.success(res, "Deal data extracted from multiple documents", {
          extractedData: result.mergedData,
          confidence: result.confidence,
          individualResults: result.individualResults.map(r => ({
            fileName: r.fileName,
            success: r.success,
            confidence: r.confidence
          })),
          uploadedFiles: successfullySavedFiles.map(f => ({
            filename: f.filename,
            originalName: f.originalName,
            url: f.url,
            mimeType: f.mimeType,
            size: f.size
          }))
        });
      }
    } catch (err) {
      console.error("Document extraction error:", err);
      return helper.error(res, err.message || "Failed to process document");
    }
  },

  /**
   * Extract deal information using parallel extraction (new enhanced method)
   * Runs 5 focused extractions in parallel for faster, more comprehensive data
   * POST /api/v1/deal/extract-enhanced
   */
  extractDealEnhanced: async (req, res) => {
    try {
      // Check if files were uploaded
      if (!req.files || !req.files.document) {
        return helper.error(res, "No document uploaded. Please upload PDF, Excel, or text files.");
      }

      const uploadedFiles = req.files.document;
      const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

      // Validate file types
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];

      for (const file of files) {
        if (!allowedTypes.includes(file.mimetype) && !file.mimetype.startsWith('image/')) {
          return helper.error(res, `Unsupported file type: ${file.mimetype}`);
        }
      }

      // Check file size (max 20MB per file)
      const maxSize = 20 * 1024 * 1024;
      for (const file of files) {
        if (file.size > maxSize) {
          return helper.error(res, `File ${file.name} exceeds maximum size of 20MB`);
        }
      }

      console.log(`[Enhanced Extraction] Processing ${files.length} files...`);

      // Save files to local storage
      const savedFiles = await saveFiles(files);
      const successfullySavedFiles = savedFiles.filter(f => f.success);

      // Run the full parallel extraction pipeline
      const result = await runFullExtraction(files);

      if (!result.success) {
        return helper.error(res, result.error || "Failed to extract data from documents");
      }

      // Return comprehensive extraction result
      return helper.success(res, "Deal data extracted successfully using enhanced extraction", {
        // Backward compatible flat data
        extractedData: result.extractedData,

        // Deal overview (from OVERVIEW_PROMPT extraction)
        deal_overview: result.deal_overview || null,

        // Time-series data
        monthlyFinancials: result.monthlyFinancials,
        monthlyCensus: result.monthlyCensus,
        monthlyExpenses: result.monthlyExpenses,
        rates: result.rates,

        // TTM summaries
        ttmFinancials: result.ttmFinancials,
        censusSummary: result.censusSummary,
        expensesByDepartment: result.expensesByDepartment,

        // Analysis
        ratios: result.ratios,
        benchmarkFlags: result.benchmarkFlags,
        potentialSavings: result.potentialSavings,
        insights: result.insights,

        // Facility info
        facility: result.facility,

        // Metadata
        metadata: result.metadata,

        // File info
        uploadedFiles: successfullySavedFiles.map(f => ({
          filename: f.filename,
          originalName: f.originalName,
          url: f.url,
          mimeType: f.mimeType,
          size: f.size
        })),
        processedFiles: result.processedFiles
      });

    } catch (err) {
      console.error("Enhanced extraction error:", err);
      return helper.error(res, err.message || "Failed to process documents");
    }
  },

  /**
   * Serve uploaded files
   * GET /api/v1/files/:path
   */
  serveFile: async (req, res) => {
    try {
      const filePath = req.params[0]; // Capture the full path
      const file = getFile(filePath);

      if (!file) {
        return res.status(404).json({ success: false, message: "File not found" });
      }

      // Determine content type
      const ext = filePath.split('.').pop().toLowerCase();
      const mimeTypes = {
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`);
      res.send(file.buffer);
    } catch (err) {
      console.error("File serve error:", err);
      return res.status(500).json({ success: false, message: "Failed to serve file" });
    }
  },

  /**
   * Get all uploaded files for a deal
   * GET /api/v1/deal/get-uploaded-files/:dealId
   */
  getUploadedFiles: async (req, res) => {
    try {
      const dealId = req.params.dealId;
      const files = getDealFiles(dealId);
      return helper.success(res, "Files retrieved successfully", files);
    } catch (err) {
      return helper.error(res, err);
    }
  },

  /**
   * Calculate deal metrics for underwriting
   * GET /api/v1/deal/calculate/:dealId
   */
  calculateDealMetrics: async (req, res) => {
    try {
      const { dealId } = req.params;

      // Fetch the deal with all necessary data including facilities
      const deal = await Deal.findByPk(dealId, {
        include: [{
          model: DealFacilities,
          as: 'deal_facility',
          order: [['display_order', 'ASC']]
        }]
      });

      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // If deal has facilities, aggregate their data for calculation
      const dealData = deal.toJSON();
      if (dealData.facilities && dealData.facilities.length > 0) {
        // Aggregate facility data for multi-facility deals
        const aggregated = dealData.facilities.reduce((acc, facility) => {
          acc.total_beds += parseFloat(facility.bed_count) || 0;
          acc.total_revenue += parseFloat(facility.annual_revenue) || 0;
          acc.total_ebitda += parseFloat(facility.ebitda) || 0;
          acc.total_ebitdar += parseFloat(facility.ebitdar) || 0;
          acc.total_noi += parseFloat(facility.noi) || 0;
          acc.total_rent += parseFloat(facility.annual_rent) || 0;
          acc.total_purchase_price += parseFloat(facility.purchase_price) || 0;
          acc.facility_count += 1;
          return acc;
        }, {
          total_beds: 0,
          total_revenue: 0,
          total_ebitda: 0,
          total_ebitdar: 0,
          total_noi: 0,
          total_rent: 0,
          total_purchase_price: 0,
          facility_count: 0
        });

        // Override deal fields with aggregated values if not already set or if aggregated is higher
        if (aggregated.total_beds > 0) {
          dealData.bed_count = dealData.bed_count || aggregated.total_beds;
        }
        if (aggregated.total_revenue > 0) {
          dealData.annual_revenue = dealData.annual_revenue || aggregated.total_revenue;
        }
        if (aggregated.total_ebitda !== 0) {
          dealData.ebitda = dealData.ebitda || aggregated.total_ebitda;
        }
        if (aggregated.total_ebitdar !== 0) {
          dealData.ebitdar = dealData.ebitdar || aggregated.total_ebitdar;
        }
        if (aggregated.total_noi !== 0) {
          dealData.net_operating_income = dealData.net_operating_income || aggregated.total_noi;
        }
        if (aggregated.total_rent > 0) {
          dealData.annual_rent = dealData.annual_rent || aggregated.total_rent;
        }
        // Use aggregated purchase price if deal total_deal_amount is not set
        if (aggregated.total_purchase_price > 0 && !dealData.total_deal_amount) {
          dealData.total_deal_amount = aggregated.total_purchase_price;
        }

        // Add facility metrics to the response
        dealData.facility_metrics = {
          facility_count: aggregated.facility_count,
          aggregated_beds: aggregated.total_beds,
          aggregated_revenue: aggregated.total_revenue,
          aggregated_ebitda: aggregated.total_ebitda,
          aggregated_ebitdar: aggregated.total_ebitdar,
          aggregated_noi: aggregated.total_noi,
          aggregated_rent: aggregated.total_rent,
          aggregated_purchase_price: aggregated.total_purchase_price
        };
      }

      // Calculate enhanced metrics using the service (includes normalized values and benchmarks)
      const metrics = calcEnhancedMetrics(dealData);

      // Add facility info to response
      if (dealData.facility_metrics) {
        metrics.facilityMetrics = dealData.facility_metrics;
        metrics.hasFacilities = true;
      } else {
        metrics.hasFacilities = false;
      }

      return helper.success(res, "Deal metrics calculated successfully", metrics);
    } catch (err) {
      console.error("Calculator error:", err);
      return helper.error(res, err.message || "Failed to calculate deal metrics");
    }
  },

  /**
   * Calculate portfolio metrics for multiple deals under a master deal
   * GET /api/v1/deal/calculate-portfolio/:masterDealId
   */
  calculatePortfolioMetrics: async (req, res) => {
    try {
      const { masterDealId } = req.params;

      // Fetch all deals under this master deal
      const deals = await Deal.findAll({
        where: { master_deal_id: masterDealId }
      });

      if (!deals || deals.length === 0) {
        return helper.error(res, "No deals found for this portfolio");
      }

      // Calculate enhanced portfolio metrics using the service (includes normalized values)
      const metrics = calcEnhancedPortfolioMetrics(deals);

      return helper.success(res, "Portfolio metrics calculated successfully", metrics);
    } catch (err) {
      console.error("Portfolio calculator error:", err);
      return helper.error(res, err.message || "Failed to calculate portfolio metrics");
    }
  },

  // ============================================================================
  // FACILITY CRUD OPERATIONS
  // ============================================================================

  /**
   * Get all facilities for a deal
   * GET /api/v1/deal/:dealId/facilities
   */
  getDealFacilities: async (req, res) => {
    try {
      const { dealId } = req.params;

      // Verify deal exists
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get all facilities for this deal
      const facilities = await DealFacilities.findAll({
        where: { deal_id: dealId },
        order: [['display_order', 'ASC'], ['created_at', 'ASC']]
      });

      // Transform data to match frontend expected field names
      const transformedFacilities = facilities.map(f => {
        const facility = f.toJSON();
        return {
          ...facility,
          // Alias fields to match frontend expectations
          address: facility.street_address || facility.address,
          occupancy_rate: facility.current_occupancy || facility.occupancy_rate,
          medicare_mix: facility.medicare_percentage || facility.medicare_mix,
          medicaid_mix: facility.medicaid_percentage || facility.medicaid_mix,
          private_pay_mix: facility.private_pay_percentage || facility.private_pay_mix,
          noi: facility.net_operating_income || facility.noi,
          // Keep original fields too for compatibility
          street_address: facility.street_address,
          current_occupancy: facility.current_occupancy,
          medicare_percentage: facility.medicare_percentage,
          medicaid_percentage: facility.medicaid_percentage,
          private_pay_percentage: facility.private_pay_percentage,
          net_operating_income: facility.net_operating_income,
        };
      });

      return helper.success(res, "Facilities fetched successfully", transformedFacilities);
    } catch (err) {
      console.error("Get facilities error:", err);
      return helper.error(res, err.message || "Failed to fetch facilities");
    }
  },

  /**
   * Get a single facility by ID
   * GET /api/v1/deal/facility/:facilityId
   */
  getFacilityById: async (req, res) => {
    try {
      const { facilityId } = req.params;

      const facility = await DealFacilities.findByPk(facilityId, {
        include: [{
          model: Deal,
          as: 'deal',
          attributes: ['id', 'deal_name', 'deal_status']
        }]
      });

      if (!facility) {
        return helper.error(res, "Facility not found");
      }

      return helper.success(res, "Facility fetched successfully", facility);
    } catch (err) {
      console.error("Get facility error:", err);
      return helper.error(res, err.message || "Failed to fetch facility");
    }
  },

  /**
   * Create a new facility for a deal
   * POST /api/v1/deal/:dealId/facilities
   */
  createFacility: async (req, res) => {
    try {
      const { dealId } = req.params;
      const facilityData = req.body;

      // Verify deal exists
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get the next display order
      const maxOrder = await DealFacilities.max('display_order', {
        where: { deal_id: dealId }
      });

      // Create the facility
      const facility = await DealFacilities.create({
        deal_id: dealId,
        facility_name: facilityData.facility_name,
        facility_type: facilityData.facility_type,
        federal_provider_number: facilityData.federal_provider_number || null,
        street_address: facilityData.street_address,
        city: facilityData.city,
        state: facilityData.state,
        country: facilityData.country || 'USA',
        zip_code: facilityData.zip_code,
        latitude: facilityData.latitude,
        longitude: facilityData.longitude,
        bed_count: facilityData.bed_count || facilityData.total_beds,
        purchase_price: facilityData.purchase_price,
        price_per_bed: facilityData.price_per_bed,
        annual_revenue: facilityData.annual_revenue,
        revenue_multiple: facilityData.revenue_multiple,
        ebitda: facilityData.ebitda,
        ebitda_multiple: facilityData.ebitda_multiple,
        ebitda_margin: facilityData.ebitda_margin,
        ebitdar: facilityData.ebitdar,
        ebitdar_margin: facilityData.ebitdar_margin,
        net_operating_income: facilityData.net_operating_income,
        current_occupancy: facilityData.current_occupancy,
        average_daily_rate: facilityData.average_daily_rate,
        average_daily_census: facilityData.average_daily_census,
        medicare_percentage: facilityData.medicare_percentage,
        medicaid_percentage: facilityData.medicaid_percentage,
        private_pay_percentage: facilityData.private_pay_percentage,
        other_payer_percentage: facilityData.other_payer_percentage,
        medicare_revenue: facilityData.medicare_revenue,
        medicaid_revenue: facilityData.medicaid_revenue,
        private_pay_revenue: facilityData.private_pay_revenue,
        other_revenue: facilityData.other_revenue,
        total_expenses: facilityData.total_expenses,
        operating_expenses: facilityData.operating_expenses,
        rent_lease_expense: facilityData.rent_lease_expense,
        property_taxes: facilityData.property_taxes,
        property_insurance: facilityData.property_insurance,
        depreciation: facilityData.depreciation,
        amortization: facilityData.amortization,
        interest_expense: facilityData.interest_expense,
        rate_information: facilityData.rate_information,
        pro_forma_projections: facilityData.pro_forma_projections,
        extraction_data: facilityData.extraction_data,
        notes: facilityData.notes,
        display_order: (maxOrder || 0) + 1,
        created_at: new Date(),
        updated_at: new Date()
      });

      return helper.success(res, "Facility created successfully", facility);
    } catch (err) {
      console.error("Create facility error:", err);
      return helper.error(res, err.message || "Failed to create facility");
    }
  },

  /**
   * Update a facility
   * PUT /api/v1/deal/facility/:facilityId
   */
  updateFacility: async (req, res) => {
    try {
      const { facilityId } = req.params;
      const facilityData = req.body;
      const userId = req.user?.id;

      const facility = await DealFacilities.findByPk(facilityId);
      if (!facility) {
        return helper.error(res, "Facility not found");
      }

      // Capture old values for change logging
      const oldData = facility.toJSON();

      // Update the facility
      await facility.update({
        facility_name: facilityData.facility_name ?? facility.facility_name,
        facility_type: facilityData.facility_type ?? facility.facility_type,
        street_address: facilityData.street_address ?? facility.street_address,
        city: facilityData.city ?? facility.city,
        state: facilityData.state ?? facility.state,
        country: facilityData.country ?? facility.country,
        zip_code: facilityData.zip_code ?? facility.zip_code,
        latitude: facilityData.latitude ?? facility.latitude,
        longitude: facilityData.longitude ?? facility.longitude,
        bed_count: facilityData.bed_count ?? facilityData.total_beds ?? facility.bed_count,
        purchase_price: facilityData.purchase_price ?? facility.purchase_price,
        price_per_bed: facilityData.price_per_bed ?? facility.price_per_bed,
        annual_revenue: facilityData.annual_revenue ?? facility.annual_revenue,
        revenue_multiple: facilityData.revenue_multiple ?? facility.revenue_multiple,
        ebitda: facilityData.ebitda ?? facility.ebitda,
        ebitda_multiple: facilityData.ebitda_multiple ?? facility.ebitda_multiple,
        ebitda_margin: facilityData.ebitda_margin ?? facility.ebitda_margin,
        ebitdar: facilityData.ebitdar ?? facility.ebitdar,
        ebitdar_margin: facilityData.ebitdar_margin ?? facility.ebitdar_margin,
        net_operating_income: facilityData.net_operating_income ?? facility.net_operating_income,
        current_occupancy: facilityData.current_occupancy ?? facility.current_occupancy,
        average_daily_rate: facilityData.average_daily_rate ?? facility.average_daily_rate,
        average_daily_census: facilityData.average_daily_census ?? facility.average_daily_census,
        medicare_percentage: facilityData.medicare_percentage ?? facility.medicare_percentage,
        medicaid_percentage: facilityData.medicaid_percentage ?? facility.medicaid_percentage,
        private_pay_percentage: facilityData.private_pay_percentage ?? facility.private_pay_percentage,
        other_payer_percentage: facilityData.other_payer_percentage ?? facility.other_payer_percentage,
        medicare_revenue: facilityData.medicare_revenue ?? facility.medicare_revenue,
        medicaid_revenue: facilityData.medicaid_revenue ?? facility.medicaid_revenue,
        private_pay_revenue: facilityData.private_pay_revenue ?? facility.private_pay_revenue,
        other_revenue: facilityData.other_revenue ?? facility.other_revenue,
        total_expenses: facilityData.total_expenses ?? facility.total_expenses,
        operating_expenses: facilityData.operating_expenses ?? facility.operating_expenses,
        rent_lease_expense: facilityData.rent_lease_expense ?? facility.rent_lease_expense,
        property_taxes: facilityData.property_taxes ?? facility.property_taxes,
        property_insurance: facilityData.property_insurance ?? facility.property_insurance,
        depreciation: facilityData.depreciation ?? facility.depreciation,
        amortization: facilityData.amortization ?? facility.amortization,
        interest_expense: facilityData.interest_expense ?? facility.interest_expense,
        rate_information: facilityData.rate_information ?? facility.rate_information,
        pro_forma_projections: facilityData.pro_forma_projections ?? facility.pro_forma_projections,
        extraction_data: facilityData.extraction_data ?? facility.extraction_data,
        notes: facilityData.notes ?? facility.notes,
        display_order: facilityData.display_order ?? facility.display_order,
        updated_at: new Date()
      });

      // Log changes
      if (userId) {
        const trackableFields = [
          'facility_name', 'facility_type', 'bed_count', 'street_address', 'city', 'state', 'zip_code',
          'purchase_price', 'annual_revenue', 'ebitda', 'ebitdar', 'net_operating_income',
          'current_occupancy', 'medicare_percentage', 'medicaid_percentage', 'private_pay_percentage'
        ];
        const newData = facility.toJSON();
        const changes = detectFieldChanges(oldData, newData, trackableFields);
        if (changes.length > 0) {
          await logFacilityChanges(
            facility.id,
            facility.deal_id,
            userId,
            'field_update',
            changes,
            { facility_name: facility.facility_name }
          );
        }
      }

      return helper.success(res, "Facility updated successfully", facility);
    } catch (err) {
      console.error("Update facility error:", err);
      return helper.error(res, err.message || "Failed to update facility");
    }
  },

  /**
   * Delete a facility
   * DELETE /api/v1/deal/facility/:facilityId
   */
  deleteFacility: async (req, res) => {
    try {
      const { facilityId } = req.params;

      const facility = await DealFacilities.findByPk(facilityId);
      if (!facility) {
        return helper.error(res, "Facility not found");
      }

      await facility.destroy();

      return helper.success(res, "Facility deleted successfully");
    } catch (err) {
      console.error("Delete facility error:", err);
      return helper.error(res, err.message || "Failed to delete facility");
    }
  },

  /**
   * Bulk create facilities for a deal (useful for AI extraction)
   * POST /api/v1/deal/:dealId/facilities/bulk
   */
  createBulkFacilities: async (req, res) => {
    try {
      const { dealId } = req.params;
      const { facilities } = req.body;

      if (!Array.isArray(facilities) || facilities.length === 0) {
        return helper.error(res, "No facilities provided");
      }

      // Verify deal exists
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get the current max display order
      const maxOrder = await DealFacilities.max('display_order', {
        where: { deal_id: dealId }
      }) || 0;

      // Create facilities with sequential display order
      const createdFacilities = await Promise.all(
        facilities.map((facilityData, index) =>
          DealFacilities.create({
            deal_id: dealId,
            ...facilityData,
            display_order: maxOrder + index + 1,
            created_at: new Date(),
            updated_at: new Date()
          })
        )
      );

      return helper.success(res, `${createdFacilities.length} facilities created successfully`, createdFacilities);
    } catch (err) {
      console.error("Bulk create facilities error:", err);
      return helper.error(res, err.message || "Failed to create facilities");
    }
  },

  /**
   * Update facility display order (for drag-and-drop reordering)
   * PUT /api/v1/deal/:dealId/facilities/reorder
   */
  reorderFacilities: async (req, res) => {
    try {
      const { dealId } = req.params;
      const { facilityIds } = req.body; // Array of facility IDs in new order

      if (!Array.isArray(facilityIds)) {
        return helper.error(res, "facilityIds must be an array");
      }

      // Update display_order for each facility
      await Promise.all(
        facilityIds.map((facilityId, index) =>
          DealFacilities.update(
            { display_order: index + 1, updated_at: new Date() },
            { where: { id: facilityId, deal_id: dealId } }
          )
        )
      );

      return helper.success(res, "Facilities reordered successfully");
    } catch (err) {
      console.error("Reorder facilities error:", err);
      return helper.error(res, err.message || "Failed to reorder facilities");
    }
  },

  // ============================================================================
  // BENCHMARK CONFIGURATION ENDPOINTS
  // ============================================================================

  /**
   * Get all benchmark configurations for current user
   * GET /api/v1/deal/benchmarks
   */
  getBenchmarkConfigs: async (req, res) => {
    try {
      const userId = req.user.id;

      const configs = await BenchmarkConfigurations.findAll({
        where: { user_id: userId },
        order: [['is_default', 'DESC'], ['created_at', 'DESC']]
      });

      // If no configs, return default benchmarks as a suggestion
      if (configs.length === 0) {
        return helper.success(res, "No saved configurations", {
          configs: [],
          default_benchmarks: DEFAULT_BENCHMARKS
        });
      }

      return helper.success(res, "Benchmark configurations retrieved", { configs });
    } catch (err) {
      console.error("Get benchmark configs error:", err);
      return helper.error(res, err.message || "Failed to get benchmark configurations");
    }
  },

  /**
   * Create a new benchmark configuration
   * POST /api/v1/deal/benchmarks
   */
  createBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { config_name, is_default, ...benchmarkValues } = req.body;

      // If setting as default, unset other defaults
      if (is_default) {
        await BenchmarkConfigurations.update(
          { is_default: false },
          { where: { user_id: userId } }
        );
      }

      const config = await BenchmarkConfigurations.create({
        user_id: userId,
        config_name: config_name || 'Custom',
        is_default: is_default || false,
        ...benchmarkValues,
        created_at: new Date()
      });

      return helper.success(res, "Benchmark configuration created", config);
    } catch (err) {
      console.error("Create benchmark config error:", err);
      return helper.error(res, err.message || "Failed to create benchmark configuration");
    }
  },

  /**
   * Update a benchmark configuration
   * PUT /api/v1/deal/benchmarks/:id
   */
  updateBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { config_name, is_default, ...benchmarkValues } = req.body;

      const config = await BenchmarkConfigurations.findOne({
        where: { id, user_id: userId }
      });

      if (!config) {
        return helper.error(res, "Benchmark configuration not found");
      }

      // If setting as default, unset other defaults
      if (is_default) {
        await BenchmarkConfigurations.update(
          { is_default: false },
          { where: { user_id: userId, id: { [Op.ne]: id } } }
        );
      }

      await config.update({
        config_name: config_name !== undefined ? config_name : config.config_name,
        is_default: is_default !== undefined ? is_default : config.is_default,
        ...benchmarkValues,
        updated_at: new Date()
      });

      return helper.success(res, "Benchmark configuration updated", config);
    } catch (err) {
      console.error("Update benchmark config error:", err);
      return helper.error(res, err.message || "Failed to update benchmark configuration");
    }
  },

  /**
   * Delete a benchmark configuration
   * DELETE /api/v1/deal/benchmarks/:id
   */
  deleteBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const config = await BenchmarkConfigurations.findOne({
        where: { id, user_id: userId }
      });

      if (!config) {
        return helper.error(res, "Benchmark configuration not found");
      }

      await config.destroy();

      return helper.success(res, "Benchmark configuration deleted");
    } catch (err) {
      console.error("Delete benchmark config error:", err);
      return helper.error(res, err.message || "Failed to delete benchmark configuration");
    }
  },

  /**
   * Set a benchmark configuration as default
   * POST /api/v1/deal/benchmarks/:id/set-default
   */
  setDefaultBenchmarkConfig: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const config = await BenchmarkConfigurations.findOne({
        where: { id, user_id: userId }
      });

      if (!config) {
        return helper.error(res, "Benchmark configuration not found");
      }

      // Unset all other defaults
      await BenchmarkConfigurations.update(
        { is_default: false },
        { where: { user_id: userId } }
      );

      // Set this one as default
      await config.update({ is_default: true, updated_at: new Date() });

      return helper.success(res, "Default benchmark configuration set", config);
    } catch (err) {
      console.error("Set default benchmark config error:", err);
      return helper.error(res, err.message || "Failed to set default benchmark configuration");
    }
  },

  // ============================================================================
  // PRO FORMA SCENARIO ENDPOINTS
  // ============================================================================

  /**
   * Get all pro forma scenarios for a deal
   * GET /api/v1/deal/:dealId/proforma
   */
  getProformaScenarios: async (req, res) => {
    try {
      const { dealId } = req.params;

      const scenarios = await DealProformaScenarios.findAll({
        where: { deal_id: dealId },
        order: [['created_at', 'DESC']]
      });

      return helper.success(res, "Pro forma scenarios retrieved", { scenarios });
    } catch (err) {
      console.error("Get proforma scenarios error:", err);
      return helper.error(res, err.message || "Failed to get pro forma scenarios");
    }
  },

  /**
   * Get a specific pro forma scenario with full details
   * GET /api/v1/deal/:dealId/proforma/:scenarioId
   */
  getProformaScenarioById: async (req, res) => {
    try {
      const { dealId, scenarioId } = req.params;

      const scenario = await DealProformaScenarios.findOne({
        where: { id: scenarioId, deal_id: dealId }
      });

      if (!scenario) {
        return helper.error(res, "Pro forma scenario not found");
      }

      // Get deal data for recalculation if needed
      const deal = await Deal.findByPk(dealId);

      return helper.success(res, "Pro forma scenario retrieved", {
        scenario,
        deal_name: deal?.deal_name,
        facility_name: deal?.facility_name
      });
    } catch (err) {
      console.error("Get proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to get pro forma scenario");
    }
  },

  /**
   * Create a new pro forma scenario
   * POST /api/v1/deal/:dealId/proforma
   */
  createProformaScenario: async (req, res) => {
    try {
      const userId = req.user.id;
      const { dealId } = req.params;
      const { scenario_name, benchmark_overrides, notes } = req.body;

      // Get the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get user's default benchmark config
      const defaultConfig = await BenchmarkConfigurations.findOne({
        where: { user_id: userId, is_default: true }
      });

      // Normalize benchmarks and apply overrides
      const benchmarks = normalizeBenchmarkConfig(defaultConfig);
      const finalBenchmarks = { ...benchmarks, ...(benchmark_overrides || {}) };

      // Calculate pro forma
      const proformaResult = calculateProforma(deal.toJSON(), finalBenchmarks);
      const yearlyProjections = generateYearlyProjections(proformaResult);

      // Create scenario
      const scenario = await DealProformaScenarios.create({
        deal_id: dealId,
        user_id: userId,
        scenario_name: scenario_name || 'Base Case',
        benchmark_overrides: benchmark_overrides || {},
        stabilized_revenue: proformaResult.stabilized.revenue,
        stabilized_ebitda: proformaResult.stabilized.ebitda,
        stabilized_ebitdar: proformaResult.stabilized.ebitdar,
        stabilized_noi: proformaResult.stabilized.ebitda, // Using EBITDA as proxy
        total_opportunity: proformaResult.total_opportunity,
        total_opportunity_pct: proformaResult.total_opportunity_pct,
        stabilized_occupancy: proformaResult.stabilized.occupancy,
        stabilized_labor_pct: finalBenchmarks.labor_pct_target,
        opportunities: proformaResult.opportunities,
        yearly_projections: yearlyProjections,
        notes: notes || null,
        created_at: new Date()
      });

      return helper.success(res, "Pro forma scenario created", {
        scenario,
        calculation: proformaResult
      });
    } catch (err) {
      console.error("Create proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to create pro forma scenario");
    }
  },

  /**
   * Update a pro forma scenario
   * PUT /api/v1/deal/:dealId/proforma/:scenarioId
   */
  updateProformaScenario: async (req, res) => {
    try {
      const userId = req.user.id;
      const { dealId, scenarioId } = req.params;
      const { scenario_name, benchmark_overrides, notes } = req.body;

      const scenario = await DealProformaScenarios.findOne({
        where: { id: scenarioId, deal_id: dealId }
      });

      if (!scenario) {
        return helper.error(res, "Pro forma scenario not found");
      }

      // Get the deal for recalculation
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get user's default benchmark config
      const defaultConfig = await BenchmarkConfigurations.findOne({
        where: { user_id: userId, is_default: true }
      });

      // Normalize benchmarks and apply new overrides
      const benchmarks = normalizeBenchmarkConfig(defaultConfig);
      const newOverrides = benchmark_overrides !== undefined ? benchmark_overrides : scenario.benchmark_overrides;
      const finalBenchmarks = { ...benchmarks, ...newOverrides };

      // Recalculate pro forma
      const proformaResult = calculateProforma(deal.toJSON(), finalBenchmarks);
      const yearlyProjections = generateYearlyProjections(proformaResult);

      // Update scenario
      await scenario.update({
        scenario_name: scenario_name !== undefined ? scenario_name : scenario.scenario_name,
        benchmark_overrides: newOverrides,
        stabilized_revenue: proformaResult.stabilized.revenue,
        stabilized_ebitda: proformaResult.stabilized.ebitda,
        stabilized_ebitdar: proformaResult.stabilized.ebitdar,
        stabilized_noi: proformaResult.stabilized.ebitda,
        total_opportunity: proformaResult.total_opportunity,
        total_opportunity_pct: proformaResult.total_opportunity_pct,
        stabilized_occupancy: proformaResult.stabilized.occupancy,
        stabilized_labor_pct: finalBenchmarks.labor_pct_target,
        opportunities: proformaResult.opportunities,
        yearly_projections: yearlyProjections,
        notes: notes !== undefined ? notes : scenario.notes,
        updated_at: new Date()
      });

      return helper.success(res, "Pro forma scenario updated", {
        scenario,
        calculation: proformaResult
      });
    } catch (err) {
      console.error("Update proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to update pro forma scenario");
    }
  },

  /**
   * Delete a pro forma scenario
   * DELETE /api/v1/deal/:dealId/proforma/:scenarioId
   */
  deleteProformaScenario: async (req, res) => {
    try {
      const { dealId, scenarioId } = req.params;

      const scenario = await DealProformaScenarios.findOne({
        where: { id: scenarioId, deal_id: dealId }
      });

      if (!scenario) {
        return helper.error(res, "Pro forma scenario not found");
      }

      await scenario.destroy();

      return helper.success(res, "Pro forma scenario deleted");
    } catch (err) {
      console.error("Delete proforma scenario error:", err);
      return helper.error(res, err.message || "Failed to delete pro forma scenario");
    }
  },

  /**
   * Calculate pro forma metrics WITHOUT saving (preview mode)
   * POST /api/v1/deal/:dealId/proforma/calculate
   */
  calculateProformaPreview: async (req, res) => {
    try {
      const userId = req.user.id;
      const { dealId } = req.params;
      const { benchmark_overrides } = req.body;

      // Get the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Get the latest expense ratios from the database (calculated during extraction)
      const expenseRatiosRecord = await DealExpenseRatios.findOne({
        where: { deal_id: dealId },
        order: [['period_end', 'DESC']]
      });

      // Fallback: If department totals are missing, calculate from deal_monthly_expenses
      let deptTotalsFromMonthly = null;
      if (!expenseRatiosRecord?.total_direct_care) {
        console.log(`[ProForma] Department totals missing for deal ${dealId}, calculating from monthly expenses...`);
        const monthlyExpenses = await DealMonthlyExpenses.findAll({
          where: { deal_id: dealId }
        });

        if (monthlyExpenses && monthlyExpenses.length > 0) {
          deptTotalsFromMonthly = {};
          for (const record of monthlyExpenses) {
            const dept = record.department;
            if (!deptTotalsFromMonthly[dept]) {
              deptTotalsFromMonthly[dept] = 0;
            }
            deptTotalsFromMonthly[dept] += record.total_department_expense || 0;
          }
          console.log(`[ProForma] Calculated department totals from ${monthlyExpenses.length} monthly records:`, deptTotalsFromMonthly);
        }
      }

      // Get user's default benchmark config
      const defaultConfig = await BenchmarkConfigurations.findOne({
        where: { user_id: userId, is_default: true }
      });

      // Normalize benchmarks and apply overrides
      const benchmarks = normalizeBenchmarkConfig(defaultConfig);
      const finalBenchmarks = { ...benchmarks, ...(benchmark_overrides || {}) };

      // Calculate pro forma
      const proformaResult = calculateProforma(deal.toJSON(), finalBenchmarks);
      const yearlyProjections = generateYearlyProjections(proformaResult);

      // Extract expense data from DB record to supplement the proforma result
      const expenseData = expenseRatiosRecord ? {
        // Labor metrics from database
        total_labor_cost: expenseRatiosRecord.total_labor_cost,
        labor_pct_of_revenue: expenseRatiosRecord.labor_pct_of_revenue,
        agency_pct_of_labor: expenseRatiosRecord.agency_pct_of_labor,
        agency_labor_total: expenseRatiosRecord.agency_labor_total,
        // Department expense totals (with fallback from monthly expenses)
        total_direct_care: expenseRatiosRecord.total_direct_care || deptTotalsFromMonthly?.direct_care || null,
        total_activities: expenseRatiosRecord.total_activities || deptTotalsFromMonthly?.activities || null,
        total_culinary: expenseRatiosRecord.total_culinary || deptTotalsFromMonthly?.culinary || null,
        total_housekeeping: expenseRatiosRecord.total_housekeeping || deptTotalsFromMonthly?.housekeeping || null,
        total_maintenance: expenseRatiosRecord.total_maintenance || deptTotalsFromMonthly?.maintenance || null,
        total_administration: expenseRatiosRecord.total_administration || deptTotalsFromMonthly?.administration || null,
        total_general: expenseRatiosRecord.total_general || deptTotalsFromMonthly?.general || null,
        total_property: expenseRatiosRecord.total_property || deptTotalsFromMonthly?.property || null,
        // Other expense metrics
        food_cost_total: expenseRatiosRecord.food_cost_total,
        food_cost_per_resident_day: expenseRatiosRecord.food_cost_per_resident_day,
        food_pct_of_revenue: expenseRatiosRecord.food_pct_of_revenue,
        admin_pct_of_revenue: expenseRatiosRecord.admin_pct_of_revenue,
        maintenance_pct_of_revenue: expenseRatiosRecord.maintenance_pct_of_revenue,
        housekeeping_pct_of_revenue: expenseRatiosRecord.housekeeping_pct_of_revenue,
        insurance_pct_of_revenue: expenseRatiosRecord.insurance_pct_of_revenue,
        insurance_per_bed: expenseRatiosRecord.insurance_per_bed,
        utilities_pct_of_revenue: expenseRatiosRecord.utilities_pct_of_revenue,
        utilities_per_bed: expenseRatiosRecord.utilities_per_bed,
        // Revenue metrics
        revenue_per_bed: expenseRatiosRecord.revenue_per_bed,
        revenue_per_resident_day: expenseRatiosRecord.revenue_per_resident_day,
        // Margins
        ebitda_margin: expenseRatiosRecord.ebitda_margin,
        ebitdar_margin: expenseRatiosRecord.ebitdar_margin,
        operating_margin: expenseRatiosRecord.operating_margin,
        // Benchmark flags (JSON from extraction)
        benchmark_flags: expenseRatiosRecord.benchmark_flags,
        period_end: expenseRatiosRecord.period_end
      } : null;

      return helper.success(res, "Pro forma calculated", {
        ...proformaResult,
        expense_data: expenseData,
        yearly_projections: yearlyProjections,
        deal_name: deal.deal_name,
        facility_name: deal.facility_name
      });
    } catch (err) {
      console.error("Calculate proforma preview error:", err);
      return helper.error(res, err.message || "Failed to calculate pro forma");
    }
  },

  /**
   * Re-run extraction for existing deal using uploaded documents
   * Stores time-series data to the database
   * POST /api/v1/deal/:dealId/reextract
   */
  reExtractDeal: async (req, res) => {
    try {
      const { dealId } = req.params;

      // Find the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Mark extraction as started
      await deal.update({
        extraction_status: 'processing',
        extraction_started_at: new Date(),
        extraction_error: null
      });

      // Get uploaded files from deal_documents table (more reliable than getDealFiles)
      const dealDocuments = await DealDocuments.findAll({
        where: { deal_id: dealId },
        order: [['id', 'ASC']]
      });

      if (!dealDocuments || dealDocuments.length === 0) {
        return helper.error(res, "No uploaded files found for this deal. Please upload documents first.");
      }

      console.log(`[reExtractDeal] Re-extracting deal ${dealId} with ${dealDocuments.length} documents from database...`);

      // Read files from disk based on document_url paths
      const fileBuffers = [];
      for (const doc of dealDocuments) {
        try {
          // Extract the filename from the document_url (e.g., /api/v1/files/filename.pdf)
          const urlPath = doc.document_url || '';
          const filename = urlPath.replace('/api/v1/files/', '');

          if (!filename) {
            console.log(`[reExtractDeal] Skipping document ${doc.id} - no valid URL`);
            continue;
          }

          // Use getFile to read the file
          const fileData = getFile(filename);
          if (!fileData || !fileData.buffer) {
            console.log(`[reExtractDeal] Could not read file: ${filename}`);
            continue;
          }

          // Determine mimetype from filename
          const ext = filename.split('.').pop()?.toLowerCase() || '';
          let mimetype = 'application/octet-stream';
          if (ext === 'pdf') mimetype = 'application/pdf';
          else if (ext === 'xlsx') mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          else if (ext === 'xls') mimetype = 'application/vnd.ms-excel';
          else if (ext === 'csv') mimetype = 'text/csv';
          else if (ext === 'docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (ext === 'doc') mimetype = 'application/msword';
          else if (ext === 'txt') mimetype = 'text/plain';

          fileBuffers.push({
            name: doc.document_name || filename,
            mimetype: mimetype,
            size: fileData.buffer.length,
            data: fileData.buffer
          });

          console.log(`[reExtractDeal] Loaded: ${doc.document_name} (${fileData.buffer.length} bytes)`);
        } catch (fileErr) {
          console.error(`[reExtractDeal] Error loading file ${doc.document_name}:`, fileErr.message);
        }
      }

      if (fileBuffers.length === 0) {
        await deal.update({
          extraction_status: 'failed',
          extraction_error: 'Could not read any document files. Files may have been moved or deleted.'
        });
        return helper.error(res, "Could not read any document files. Files may have been moved or deleted.");
      }

      console.log(`[reExtractDeal] Successfully loaded ${fileBuffers.length} files for extraction`);

      // Run extraction
      const result = await runFullExtraction(fileBuffers);

      if (!result.success) {
        await deal.update({
          extraction_status: 'failed',
          extraction_error: result.error || 'Extraction failed'
        });
        return helper.error(res, result.error || "Extraction failed");
      }

      // Store time-series data
      console.log(`[reExtractDeal] Storing time-series data...`);
      await storeTimeSeriesData(dealId, result);

      // Update deal's extraction_data and mark as completed
      // Include deal_overview in extraction_data for the Deal Overview tab
      const fullExtractionData = {
        ...result.extractedData,
        deal_overview: result.deal_overview || null
      };
      await Deal.update(
        {
          extraction_data: JSON.stringify(fullExtractionData),
          extraction_status: 'completed',
          extraction_completed_at: new Date(),
          extraction_error: null,
          updated_at: new Date()
        },
        { where: { id: dealId } }
      );

      // Record extraction history for audit trail
      const extractedFields = Object.keys(result.extractedData || {}).filter(
        key => result.extractedData[key] !== null && result.extractedData[key] !== undefined
      );
      await recordExtractionHistory(
        dealId,
        result.extractedData,
        'ai_extraction',
        extractedFields,
        req.user?.email || 'system'
      );

      console.log(`[reExtractDeal] Re-extraction complete for deal ${dealId}`);

      return helper.success(res, "Deal re-extracted successfully", {
        monthlyFinancials: result.monthlyFinancials?.length || 0,
        monthlyCensus: result.monthlyCensus?.length || 0,
        monthlyExpenses: result.monthlyExpenses?.length || 0,
        extractedData: result.extractedData,
        deal_overview: result.deal_overview || null
      });

    } catch (err) {
      console.error("Re-extract deal error:", err);

      // Mark extraction as failed
      const { dealId } = req.params;
      if (dealId) {
        try {
          await Deal.update(
            {
              extraction_status: 'failed',
              extraction_error: err.message || "Unknown error"
            },
            { where: { id: dealId } }
          );
        } catch (updateErr) {
          console.error("Failed to update extraction status:", updateErr);
        }
      }

      return helper.error(res, err.message || "Failed to re-extract deal");
    }
  },

  /**
   * Get all deals with their facilities and coordinates for map display
   * Also includes Cascadia facilities (current operations)
   * Used by Dashboard to show deal locations on map
   *
   * Query params:
   * - status: filter by status (pipeline, due_diligence, hold, current_operations)
   * - service_line: filter by type (SNF, ALF, ILF, Home Office)
   * - company: filter by company name
   * - team: filter by team name
   */
  getDealFacilitiesCoordinates: async (req, res) => {
    try {
      // Get filter parameters
      const statuses = req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : null;
      const serviceLines = req.query.service_line ? (Array.isArray(req.query.service_line) ? req.query.service_line : [req.query.service_line]) : null;
      const companies = req.query.company ? (Array.isArray(req.query.company) ? req.query.company : [req.query.company]) : null;
      const teams = req.query.team ? (Array.isArray(req.query.team) ? req.query.team : [req.query.team]) : null;

      // Legacy support for deal_status param
      const dealStatuses = req.query.deal_status ? (Array.isArray(req.query.deal_status) ? req.query.deal_status : [req.query.deal_status]) : null;
      const effectiveStatuses = statuses || dealStatuses;

      const result = [];

      // Determine which data sources to include based on status filter
      const includeDeals = !effectiveStatuses || effectiveStatuses.some(s => ['pipeline', 'due_diligence', 'hold'].includes(s));
      const includeCascadia = !effectiveStatuses || effectiveStatuses.includes('current_operations');

      // Get deals with facilities (pipeline, due_diligence, hold)
      if (includeDeals) {
        const dealWhere = {};
        if (effectiveStatuses) {
          const dealOnlyStatuses = effectiveStatuses.filter(s => s !== 'current_operations');
          if (dealOnlyStatuses.length > 0) {
            dealWhere.deal_status = { [Op.in]: dealOnlyStatuses };
          }
        }

        // Build facility where clause
        const facilityWhere = {
          [Op.and]: [
            { latitude: { [Op.ne]: null } },
            { longitude: { [Op.ne]: null } }
          ]
        };

        // Add service line filter (facility_type in deal_facilities)
        if (serviceLines) {
          facilityWhere.facility_type = { [Op.overlap]: serviceLines };
        }

        const deals = await Deal.findAll({
          where: dealWhere,
          attributes: ['id', 'deal_name', 'deal_status'],
          include: [{
            model: DealFacilities,
            as: 'deal_facility',
            attributes: [
              'id',
              'facility_name',
              ['street_address', 'address'],
              'city',
              'state',
              'latitude',
              'longitude',
              'facility_type'
            ],
            where: facilityWhere,
            required: false
          }],
          order: [['id', 'DESC']]
        });

        // Transform deals to result format
        deals.forEach(deal => {
          if (deal.deal_facility && deal.deal_facility.length > 0) {
            result.push({
              id: `deal-${deal.id}`,
              deal_name: deal.deal_name,
              deal_status: deal.deal_status,
              source: 'deal',
              deal_facility: deal.deal_facility.map(f => ({
                id: f.id,
                facility_name: f.facility_name,
                address: f.dataValues.address || f.street_address,
                city: f.city,
                state: f.state,
                latitude: parseFloat(f.latitude),
                longitude: parseFloat(f.longitude),
                type: Array.isArray(f.facility_type) ? f.facility_type[0] : f.facility_type,
                company: null,
                team: null
              }))
            });
          }
        });
      }

      // Get Cascadia facilities (current operations)
      if (includeCascadia) {
        const CascadiaFacility = require('../models').CascadiaFacility;

        if (CascadiaFacility) {
          const cascadiaWhere = {
            latitude: { [Op.ne]: null },
            longitude: { [Op.ne]: null }
          };

          // Apply filters
          if (serviceLines) {
            cascadiaWhere.type = { [Op.in]: serviceLines };
          }
          if (companies) {
            cascadiaWhere.company = { [Op.in]: companies };
          }
          if (teams) {
            cascadiaWhere.team = { [Op.in]: teams };
          }

          const cascadiaFacilities = await CascadiaFacility.findAll({
            where: cascadiaWhere,
            order: [['facility_name', 'ASC']]
          });

          // Group Cascadia facilities by company for display
          const companiesMap = {};
          cascadiaFacilities.forEach(facility => {
            const companyName = facility.company || 'Cascadia Healthcare';
            if (!companiesMap[companyName]) {
              companiesMap[companyName] = {
                id: `cascadia-${companyName.toLowerCase().replace(/\s+/g, '-')}`,
                deal_name: companyName,
                deal_status: 'current_operations',
                source: 'cascadia',
                deal_facility: []
              };
            }
            companiesMap[companyName].deal_facility.push({
              id: facility.id,
              facility_name: facility.facility_name,
              address: facility.address,
              city: facility.city,
              state: facility.state,
              latitude: parseFloat(facility.latitude),
              longitude: parseFloat(facility.longitude),
              type: facility.type,
              company: facility.company,
              team: facility.team,
              beds: facility.beds
            });
          });

          result.push(...Object.values(companiesMap));
        }
      }

      // Also return filter options for the frontend
      const filterOptions = await getMapFilterOptions();

      return helper.success(res, "Facilities coordinates fetched successfully", {
        locations: result,
        filterOptions
      });

    } catch (err) {
      console.error("Get deal facilities coordinates error:", err);
      return helper.error(res, err.message || "Failed to fetch deal facilities coordinates");
    }
  },

  /**
   * Get available filter options for the map
   */
  getMapFilterOptions: async (req, res) => {
    try {
      const filterOptions = await getMapFilterOptions();
      return helper.success(res, "Filter options fetched successfully", filterOptions);
    } catch (err) {
      console.error("Get map filter options error:", err);
      return helper.error(res, err.message || "Failed to fetch filter options");
    }
  },

  /**
   * Mark a deal as viewed by the current user
   * POST /api/v1/deal/:dealId/mark-viewed
   */
  markDealAsViewed: async (req, res) => {
    try {
      const dealId = req.params.dealId;
      const userId = req.user.id;

      // Upsert the view record
      const existingView = await DealUserViews.findOne({
        where: { deal_id: dealId, user_id: userId }
      });

      if (existingView) {
        await existingView.update({ last_viewed_at: new Date() });
      } else {
        await DealUserViews.create({
          deal_id: dealId,
          user_id: userId,
          last_viewed_at: new Date()
        });
      }

      return helper.success(res, "Deal marked as viewed");
    } catch (err) {
      console.error("Mark deal as viewed error:", err);
      return helper.error(res, err.message || "Failed to mark deal as viewed");
    }
  },

  /**
   * Get deals list with last activity and unread count for current user
   * GET /api/v1/deal/get-deals-with-activity
   */
  getDealsWithActivity: async (req, res) => {
    try {
      const userId = req.user.id;
      const { search, status, type, page = 1 } = req.query;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Build where clause
      const where = {};
      if (search) {
        where[Op.or] = [
          { deal_name: { [Op.like]: `%${search}%` } },
          { facility_name: { [Op.like]: `%${search}%` } }
        ];
      }
      if (status && status !== 'All' && status !== '') {
        where.deal_status = status;
      }
      if (type && type !== 'All' && type !== '') {
        where.deal_type = type;
      }

      // Fetch deals with last activity user
      const deals = await Deal.findAll({
        where,
        include: [
          {
            model: User,
            as: 'last_activity_user',
            attributes: ['id', 'first_name', 'last_name'],
            required: false
          },
          {
            model: DealFacilities,
            as: 'deal_facility',
            attributes: ['id', 'facility_type', 'bed_count', 'city', 'state', 'purchase_price'],
            required: false
          }
        ],
        order: [['last_activity_at', 'DESC NULLS LAST'], ['created_at', 'DESC']],
        limit,
        offset
      });

      // Get user's last view timestamps for these deals
      const dealIds = deals.map(d => d.id);
      const userViews = await DealUserViews.findAll({
        where: {
          deal_id: { [Op.in]: dealIds },
          user_id: userId
        }
      });
      const viewMap = new Map(userViews.map(v => [v.deal_id, v.last_viewed_at]));

      // Get unread counts (activities since last view)
      const unreadCounts = await Promise.all(dealIds.map(async (dealId) => {
        const lastViewed = viewMap.get(dealId) || new Date(0);
        const count = await DealChangeLogs.count({
          where: {
            deal_id: dealId,
            user_id: { [Op.ne]: userId }, // Don't count user's own changes
            created_at: { [Op.gt]: lastViewed }
          }
        });
        return { dealId, count };
      }));
      const unreadMap = new Map(unreadCounts.map(u => [u.dealId, u.count]));

      // Format response
      const dealsWithActivity = deals.map(deal => {
        const d = deal.toJSON();
        return {
          ...d,
          last_activity: {
            type: d.last_activity_type,
            at: d.last_activity_at,
            by: d.last_activity_user ?
              `${d.last_activity_user.first_name} ${d.last_activity_user.last_name}` :
              null
          },
          unread_count: unreadMap.get(d.id) || 0,
          // Include deal_facility for compatibility with existing frontend
          deal_facility: d.facilities || []
        };
      });

      const total = await Deal.count({ where });

      return helper.success(res, "Deals fetched successfully", {
        deals: dealsWithActivity,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (err) {
      console.error("Get deals with activity error:", err);
      return helper.error(res, err.message || "Failed to fetch deals with activity");
    }
  },

  /**
   * Get complete change history for a deal
   * GET /api/v1/deal/:dealId/change-history
   */
  getDealChangeHistory: async (req, res) => {
    try {
      const dealId = req.params.dealId;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * parseInt(limit);

      const changes = await DealChangeLogs.findAll({
        where: { deal_id: dealId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'profile_url']
        }],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      const total = await DealChangeLogs.count({ where: { deal_id: dealId } });

      return helper.success(res, "Change history fetched", {
        changes,
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (err) {
      console.error("Get deal change history error:", err);
      return helper.error(res, err.message || "Failed to fetch change history");
    }
  },

  /**
   * Get facility matches for a deal (for review modal)
   * Returns matches stored in extraction_data from ALF database matching
   */
  getFacilityMatches: async (req, res) => {
    try {
      const dealId = req.params.dealId;
      console.log(`[getFacilityMatches] Fetching matches for deal ${dealId}`);

      // Find the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        console.log(`[getFacilityMatches] Deal ${dealId} not found`);
        return helper.error(res, "Deal not found", 404);
      }

      // Parse extraction data
      let extractionData = {};
      if (deal.extraction_data) {
        try {
          extractionData = typeof deal.extraction_data === 'string'
            ? JSON.parse(deal.extraction_data)
            : deal.extraction_data;
        } catch (parseErr) {
          console.error('[getFacilityMatches] Failed to parse extraction_data:', parseErr);
        }
      }

      // Check for enhanced extraction data (newer format)
      let enhancedData = {};
      if (deal.enhanced_extraction_data) {
        try {
          enhancedData = typeof deal.enhanced_extraction_data === 'string'
            ? JSON.parse(deal.enhanced_extraction_data)
            : deal.enhanced_extraction_data;
        } catch (parseErr) {
          console.error('[getFacilityMatches] Failed to parse enhanced_extraction_data:', parseErr);
        }
      }

      // Try enhanced data first, fall back to extraction_data
      const facilityMatches = enhancedData?.extractedData?.overview?.facility_matches
        || extractionData?.deal_overview?.facility_matches
        || extractionData?.overview?.facility_matches;

      console.log(`[getFacilityMatches] Found facility matches:`, facilityMatches ? 'YES' : 'NO');
      console.log(`[getFacilityMatches] Status:`, facilityMatches?.status || 'N/A');
      console.log(`[getFacilityMatches] Match count:`, facilityMatches?.matches?.length || 0);

      if (!facilityMatches) {
        console.log(`[getFacilityMatches] No facility matches in extraction data for deal ${dealId}`);
        return helper.success(res, "No facility matches found", {
          status: 'no_matches',
          matches: [],
          conflicts: []
        });
      }

      // Include conflicts from extraction_data._conflicts
      const conflicts = extractionData?._conflicts || enhancedData?.extractedData?._conflicts || [];
      console.log(`[getFacilityMatches] Found ${conflicts.length} conflicts`);

      console.log(`[getFacilityMatches] ✅ Returning ${facilityMatches.matches?.length || 0} matches with status: ${facilityMatches.status}`);
      return helper.success(res, "Facility matches retrieved", {
        ...facilityMatches,
        conflicts: conflicts.filter(c => !c.resolved) // Only return unresolved conflicts
      });

    } catch (err) {
      console.error('[getFacilityMatches] Error:', err);
      return helper.error(res, err.message || "Failed to get facility matches");
    }
  },

  /**
   * Select a facility match from ALF database for a deal
   * Populates facility data (address, beds, etc.) from selected match
   */
  selectFacilityMatch: async (req, res) => {
    try {
      const dealId = req.params.dealId;
      const { facility_id, action, resolved_conflicts } = req.body; // action: 'select' | 'skip' | 'not_sure'

      console.log(`[selectFacilityMatch] Deal ${dealId}, Facility ${facility_id}, Action: ${action}`);
      if (resolved_conflicts) {
        console.log(`[selectFacilityMatch] Resolved conflicts:`, Object.keys(resolved_conflicts));
      }

      // Find the deal
      const deal = await Deal.findByPk(dealId);
      if (!deal) {
        return helper.error(res, "Deal not found", 404);
      }

      // Parse extraction data to get the matches
      let extractionData = {};
      if (deal.extraction_data) {
        try {
          extractionData = typeof deal.extraction_data === 'string'
            ? JSON.parse(deal.extraction_data)
            : deal.extraction_data;
        } catch (parseErr) {
          console.error('[selectFacilityMatch] Failed to parse extraction_data:', parseErr);
        }
      }

      // Check for enhanced extraction data
      let enhancedData = {};
      if (deal.enhanced_extraction_data) {
        try {
          enhancedData = typeof deal.enhanced_extraction_data === 'string'
            ? JSON.parse(deal.enhanced_extraction_data)
            : deal.enhanced_extraction_data;
        } catch (parseErr) {
          console.error('[selectFacilityMatch] Failed to parse enhanced_extraction_data:', parseErr);
        }
      }

      // Get facility matches
      const facilityMatches = enhancedData?.extractedData?.overview?.facility_matches
        || extractionData?.deal_overview?.facility_matches
        || extractionData?.overview?.facility_matches;

      if (!facilityMatches || !facilityMatches.matches) {
        return helper.error(res, "No facility matches found for this deal", 404);
      }

      // Handle different actions
      if (action === 'skip' || action === 'not_sure') {
        // User chose to skip or is not sure - mark as reviewed but don't populate
        // Note: Model setters auto-stringify, don't double-encode
        if (enhancedData?.extractedData?.overview?.facility_matches) {
          enhancedData.extractedData.overview.facility_matches.status = action === 'skip' ? 'skipped' : 'not_sure';
          deal.enhanced_extraction_data = enhancedData;
        } else if (extractionData?.overview?.facility_matches) {
          extractionData.overview.facility_matches.status = action === 'skip' ? 'skipped' : 'not_sure';
          deal.extraction_data = extractionData;
        }

        // Update match_status column
        deal.match_status = action === 'skip' ? 'skipped' : 'not_sure';
        console.log(`[selectFacilityMatch] Setting match_status to '${deal.match_status}'`);

        await deal.save();

        return helper.success(res, `Facility matching ${action === 'skip' ? 'skipped' : 'marked as unsure'}`, {
          action,
          status: action === 'skip' ? 'skipped' : 'not_sure'
        });
      }

      // Find the selected match
      const selectedMatch = facilityMatches.matches.find(m => m.facility_id === facility_id);
      if (!selectedMatch) {
        return helper.error(res, "Selected facility not found in matches", 404);
      }

      console.log(`[selectFacilityMatch] Selected: ${selectedMatch.facility_name} (${selectedMatch.match_confidence})`);

      // If city is missing but we have zip code, try to derive city from the ALF database
      // by finding another facility with the same zip code that has a city
      if (!selectedMatch.city && selectedMatch.zip_code) {
        try {
          const [result] = await db.sequelize.query(
            'SELECT city FROM alf_facilities WHERE zip_code = ? AND city IS NOT NULL AND city != \'\' LIMIT 1',
            { replacements: [selectedMatch.zip_code], type: db.sequelize.QueryTypes.SELECT }
          );
          if (result && result.city) {
            selectedMatch.city = result.city;
            console.log(`[selectFacilityMatch] Derived city from zip code: ${result.city}`);
          }
        } catch (err) {
          console.error('[selectFacilityMatch] Failed to derive city from zip code:', err);
        }
      }

      // Build facility data, applying resolved conflicts where user chose a different value
      const facilityData = {
        facility_name: selectedMatch.facility_name,
        street_address: resolved_conflicts?.street_address ?? selectedMatch.address,
        city: resolved_conflicts?.city ?? selectedMatch.city,
        state: selectedMatch.state,
        zip_code: selectedMatch.zip_code,
        bed_count: resolved_conflicts?.bed_count ?? selectedMatch.capacity,
        latitude: selectedMatch.latitude,
        longitude: selectedMatch.longitude,
        facility_type: selectedMatch.facility_type
      };

      console.log(`[selectFacilityMatch] Applying facility data:`, {
        bed_count: facilityData.bed_count,
        street_address: facilityData.street_address,
        city: facilityData.city,
        used_resolved_conflicts: !!resolved_conflicts
      });

      // Use centralized syncFacilityData for three-way sync (deals, deal_facilities, extraction_data)
      // Pass skipConflictDetection=true since user already resolved conflicts
      const { facility } = await syncFacilityData(dealId, facilityData, 'ALF Database', resolved_conflicts ? true : false);

      // Additionally update facility_matches status in extraction_data (specific to this endpoint)
      // Re-fetch deal to get updated extraction_data from syncFacilityData
      await deal.reload();

      let updatedEnhancedData = null;
      let updatedExtractionData = null;

      if (deal.enhanced_extraction_data) {
        try {
          updatedEnhancedData = typeof deal.enhanced_extraction_data === 'string'
            ? JSON.parse(deal.enhanced_extraction_data)
            : deal.enhanced_extraction_data;
        } catch (e) { /* ignore */ }
      }
      if (deal.extraction_data) {
        try {
          updatedExtractionData = typeof deal.extraction_data === 'string'
            ? JSON.parse(deal.extraction_data)
            : deal.extraction_data;
        } catch (e) { /* ignore */ }
      }

      // Mark facility_matches as selected and resolve any conflicts
      if (updatedEnhancedData?.extractedData?.overview?.facility_matches) {
        updatedEnhancedData.extractedData.overview.facility_matches.status = 'selected';
        updatedEnhancedData.extractedData.overview.facility_matches.selected_facility_id = facility_id;
        updatedEnhancedData.extractedData.overview.facility_matches.selected_match = selectedMatch;

        // Mark conflicts as resolved if user provided resolutions
        if (resolved_conflicts && updatedEnhancedData.extractedData._conflicts) {
          for (const conflict of updatedEnhancedData.extractedData._conflicts) {
            if (resolved_conflicts.hasOwnProperty(conflict.field) && !conflict.resolved) {
              conflict.resolved = true;
              conflict.resolved_value = resolved_conflicts[conflict.field];
              conflict.resolved_by = 'user';
              conflict.resolved_at = new Date().toISOString();
              console.log(`[selectFacilityMatch] Marked conflict resolved: ${conflict.field} = ${conflict.resolved_value}`);
            }
          }
        }

        deal.enhanced_extraction_data = updatedEnhancedData; // Model setter auto-stringifies
        deal.match_status = 'matched'; // Update match_status column
        console.log(`[selectFacilityMatch] Setting match_status to 'matched'`);
        await deal.save();
      } else if (updatedExtractionData?.overview?.facility_matches) {
        updatedExtractionData.overview.facility_matches.status = 'selected';
        updatedExtractionData.overview.facility_matches.selected_facility_id = facility_id;
        updatedExtractionData.overview.facility_matches.selected_match = selectedMatch;

        // Mark conflicts as resolved if user provided resolutions
        if (resolved_conflicts && updatedExtractionData._conflicts) {
          for (const conflict of updatedExtractionData._conflicts) {
            if (resolved_conflicts.hasOwnProperty(conflict.field) && !conflict.resolved) {
              conflict.resolved = true;
              conflict.resolved_value = resolved_conflicts[conflict.field];
              conflict.resolved_by = 'user';
              conflict.resolved_at = new Date().toISOString();
              console.log(`[selectFacilityMatch] Marked conflict resolved: ${conflict.field} = ${conflict.resolved_value}`);
            }
          }
        }

        deal.extraction_data = updatedExtractionData; // Model setter auto-stringifies
        deal.match_status = 'matched'; // Update match_status column
        console.log(`[selectFacilityMatch] Setting match_status to 'matched'`);
        await deal.save();
      }

      console.log(`[selectFacilityMatch] ✅ Applied facility data for deal ${dealId}`);

      return helper.success(res, "Facility match applied successfully", {
        facility: {
          id: facility.id,
          facility_name: facility.facility_name,
          address: facility.street_address,
          city: facility.city,
          state: facility.state,
          zip_code: facility.zip_code,
          capacity: facility.bed_count,
          match_score: selectedMatch.match_score,
          match_confidence: selectedMatch.match_confidence
        }
      });

    } catch (err) {
      console.error('[selectFacilityMatch] Error:', err);
      return helper.error(res, err.message || "Failed to apply facility match");
    }
  },

  /**
   * Get extraction history for a deal
   * GET /api/deals/:id/extraction-history
   * Returns array of history records ordered by created_at DESC
   */
  getExtractionHistory: async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!id) {
        return helper.error(res, "Deal ID is required");
      }

      // Verify deal exists
      const deal = await Deal.findByPk(id);
      if (!deal) {
        return helper.error(res, "Deal not found");
      }

      // Check if ExtractionHistory model is available
      if (!ExtractionHistory) {
        return helper.error(res, "Extraction history not available");
      }

      // Fetch history records
      const history = await ExtractionHistory.findAll({
        where: { deal_id: id },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      // Get total count for pagination
      const totalCount = await ExtractionHistory.count({
        where: { deal_id: id }
      });

      return helper.success(res, "Extraction history retrieved successfully", {
        deal_id: id,
        history: history.map(record => ({
          id: record.id,
          source: record.source,
          changed_fields: record.changed_fields,
          created_by: record.created_by,
          created_at: record.created_at,
          // Only include extraction_data summary to avoid large payloads
          extraction_data_summary: {
            field_count: Object.keys(record.extraction_data || {}).length,
            has_facility_info: !!(record.extraction_data?.facility_name),
            has_financial_info: !!(record.extraction_data?.annual_revenue || record.extraction_data?.purchase_price),
            has_census_info: !!(record.extraction_data?.bed_count || record.extraction_data?.current_occupancy)
          }
        })),
        total_count: totalCount,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });
    } catch (err) {
      console.error('[getExtractionHistory] Error:', err);
      return helper.error(res, err.message || "Failed to retrieve extraction history");
    }
  },

  /**
   * Get a specific extraction history record with full extraction data
   * GET /api/deals/:id/extraction-history/:historyId
   */
  getExtractionHistoryDetail: async (req, res) => {
    try {
      const { id, historyId } = req.params;

      if (!id || !historyId) {
        return helper.error(res, "Deal ID and History ID are required");
      }

      // Check if ExtractionHistory model is available
      if (!ExtractionHistory) {
        return helper.error(res, "Extraction history not available");
      }

      const record = await ExtractionHistory.findOne({
        where: {
          id: historyId,
          deal_id: id
        }
      });

      if (!record) {
        return helper.error(res, "History record not found");
      }

      return helper.success(res, "Extraction history detail retrieved successfully", {
        id: record.id,
        deal_id: record.deal_id,
        source: record.source,
        changed_fields: record.changed_fields,
        created_by: record.created_by,
        created_at: record.created_at,
        extraction_data: record.extraction_data
      });
    } catch (err) {
      console.error('[getExtractionHistoryDetail] Error:', err);
      return helper.error(res, err.message || "Failed to retrieve extraction history detail");
    }
  },

  // ============================================================================
  // MULTI-FACILITY PORTFOLIO DEAL SUPPORT ENDPOINTS
  // ============================================================================

  /**
   * Detect facilities from uploaded document text
   * POST /api/v1/deal/detect-facilities
   */
  detectFacilities: async (req, res) => {
    try {
      const { documentText, facilityTypes } = req.body;

      if (!documentText || documentText.length < 100) {
        return helper.error(res, 'Document text is required and must be substantial');
      }

      const typesToCheck = facilityTypes || ['SNF', 'ALF'];

      console.log(`[detectFacilities] Scanning documents for ${typesToCheck.join('/')} facilities...`);

      const detectedFacilities = await detectFacilitiesFromText(documentText, typesToCheck);
      const isPortfolio = detectedFacilities.length > 1;

      console.log(`[detectFacilities] Found ${detectedFacilities.length} facilities (portfolio: ${isPortfolio})`);

      return helper.success(res, 'Facilities detected successfully', {
        detected_facilities: detectedFacilities,
        is_portfolio: isPortfolio,
        facility_count: detectedFacilities.length
      });

    } catch (err) {
      console.error('[detectFacilities] Error:', err);
      return helper.error(res, err.message || 'Failed to detect facilities from documents');
    }
  },

  /**
   * Match a detected facility against SNF/ALF database
   * POST /api/v1/deal/match-facility
   */
  matchFacilityEndpoint: async (req, res) => {
    try {
      const { facilityInfo, facilityType } = req.body;

      if (!facilityInfo || !facilityInfo.name) {
        return helper.error(res, 'Facility info with name is required');
      }

      if (!facilityType || !['SNF', 'ALF'].includes(facilityType.toUpperCase())) {
        return helper.error(res, 'facilityType must be either "SNF" or "ALF"');
      }

      console.log(`[matchFacility] Matching "${facilityInfo.name}" against ${facilityType} database...`);

      const matches = await matchFacilityToDatabase(facilityInfo, facilityType.toUpperCase());

      // Determine confidence level based on top score
      let confidence = 'none';
      if (matches.length > 0) {
        const topScore = matches[0].weighted_score || matches[0].score || 0;
        if (topScore >= 0.80) confidence = 'high';
        else if (topScore >= 0.60) confidence = 'medium';
        else if (topScore >= 0.40) confidence = 'low';
      }

      console.log(`[matchFacility] Found ${matches.length} matches, confidence: ${confidence}`);

      return helper.success(res, 'Facility matched successfully', {
        matches: matches,
        best_match_confidence: confidence
      });

    } catch (err) {
      console.error('[matchFacility] Error:', err);
      return helper.error(res, err.message || 'Failed to match facility');
    }
  },

  /**
   * Search facilities by name in database
   * GET /api/v1/deal/search-facilities
   */
  searchFacilitiesEndpoint: async (req, res) => {
    try {
      const { searchTerm, facilityType, state } = req.query;

      if (!searchTerm || searchTerm.length < 2) {
        return helper.error(res, 'Search term must be at least 2 characters');
      }

      if (!facilityType || !['SNF', 'ALF', 'both'].includes(facilityType.toUpperCase())) {
        return helper.error(res, 'facilityType must be "SNF", "ALF", or "both"');
      }

      console.log(`[searchFacilities] Searching for "${searchTerm}" in ${facilityType} (state: ${state || 'any'})...`);

      const results = await searchFacilityByName(
        searchTerm,
        facilityType.toUpperCase(),
        state || null
      );

      console.log(`[searchFacilities] Found ${results.length} results`);

      return helper.success(res, 'Search completed successfully', {
        results: results,
        total_count: results.length
      });

    } catch (err) {
      console.error('[searchFacilities] Error:', err);
      return helper.error(res, err.message || 'Failed to search facilities');
    }
  },

  /**
   * Extract portfolio deal with confirmed facilities
   * POST /api/v1/deal/extract-portfolio
   */
  extractPortfolio: async (req, res) => {
    try {
      // Get uploaded files (express-fileupload puts them in req.files.documents)
      if (!req.files || !req.files.documents) {
        return helper.error(res, 'At least one document is required');
      }
      const uploadedFiles = req.files.documents;
      const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
      const confirmedFacilities = JSON.parse(req.body.confirmedFacilities || '[]');
      const userId = req.body.user_id || req.user?.id;
      const dealName = req.body.deal_name || 'Portfolio Deal';

      if (!files || files.length === 0) {
        return helper.error(res, 'At least one document is required');
      }

      if (!confirmedFacilities || confirmedFacilities.length === 0) {
        return helper.error(res, 'At least one confirmed facility is required');
      }

      // Separate facilities by role
      const subjectFacilities = confirmedFacilities.filter(f => !f.facility_role || f.facility_role === 'subject');
      const competitorFacilities = confirmedFacilities.filter(f => f.facility_role === 'competitor');

      console.log(`[extractPortfolio] Starting portfolio extraction...`);
      console.log(`[extractPortfolio] confirmedFacilities received: ${confirmedFacilities.length}`);
      console.log(`[extractPortfolio] Subject properties: ${subjectFacilities.length}`);
      console.log(`[extractPortfolio] Competitors: ${competitorFacilities.length}`);
      console.log(`[extractPortfolio] Processing ${files.length} documents...`);
      console.log(`[extractPortfolio] Deal name: ${dealName}, User ID: ${userId}`);

      // Import the orchestrator function
      const { runPortfolioExtraction } = require('../services/extractionOrchestrator');

      // Run AI extraction ONLY for subject facilities
      let extractionResult = { facilities: [], deal_id: null };
      if (subjectFacilities.length > 0) {
        extractionResult = await runPortfolioExtraction(files, subjectFacilities);
      }

      // Merge matched data with extracted data for subject facilities
      const mergedFacilities = [];

      // Get CIM-extracted facility data if available
      const cimFacilities = extractionResult.cim_extraction?.cim_facilities || [];
      console.log(`[extractPortfolio] CIM facilities available: ${cimFacilities.length}`);

      for (let i = 0; i < subjectFacilities.length; i++) {
        const confirmed = subjectFacilities[i];
        let extracted = extractionResult.facilities?.[i] || {};

        // Try to match CIM facility data by name or index
        const facilityName = confirmed.detected?.name || confirmed.matched?.facility_name || '';
        const cimFacility = cimFacilities.find(cf =>
          cf.facility_name?.toLowerCase().includes(facilityName.toLowerCase().split(' ')[0]) ||
          facilityName.toLowerCase().includes(cf.facility_name?.toLowerCase().split(' ')[0])
        ) || cimFacilities[i];

        // Merge CIM facility data (flatten nested structures)
        if (cimFacility) {
          console.log(`[extractPortfolio] Merging CIM data for: ${facilityName}`);
          extracted = {
            ...extracted,
            // Basic info from CIM
            facility_name: cimFacility.facility_name || extracted.facility_name,
            facility_type: cimFacility.facility_type || extracted.facility_type,
            city: cimFacility.city || extracted.city,
            state: cimFacility.state || extracted.state,
            address: cimFacility.address || extracted.address,
            zip_code: cimFacility.zip_code || extracted.zip_code,
            // Beds - flatten from CIM
            bed_count: cimFacility.licensed_beds || cimFacility.bed_count || extracted.bed_count,
            total_beds: cimFacility.licensed_beds || cimFacility.functional_beds || extracted.total_beds,
            functional_beds: cimFacility.functional_beds || extracted.functional_beds,
            year_built: cimFacility.year_built || extracted.year_built,
            // Occupancy - flatten from nested structure
            occupancy_pct: cimFacility.census_and_occupancy?.current_occupancy_pct || cimFacility.current_occupancy || extracted.occupancy_pct,
            current_occupancy: cimFacility.census_and_occupancy?.current_occupancy_pct || cimFacility.current_occupancy || extracted.current_occupancy,
            // Payer mix - flatten from nested structure
            medicare_pct: cimFacility.payer_mix?.medicare_pct || extracted.medicare_pct,
            medicaid_pct: cimFacility.payer_mix?.medicaid_pct || extracted.medicaid_pct,
            private_pay_pct: cimFacility.payer_mix?.private_pay_pct || extracted.private_pay_pct,
            // Financials - flatten from nested structure
            total_revenue: cimFacility.financials?.total_revenue || extracted.total_revenue,
            annual_revenue: cimFacility.financials?.total_revenue || extracted.annual_revenue,
            total_expenses: cimFacility.financials?.total_expenses || extracted.total_expenses,
            noi: cimFacility.financials?.noi || extracted.noi,
            net_operating_income: cimFacility.financials?.noi || extracted.net_operating_income,
            ebitdar: cimFacility.financials?.ebitdar || extracted.ebitdar,
            ebitdarm: cimFacility.financials?.ebitdarm || extracted.ebitdarm,
            noi_margin_pct: cimFacility.financials?.noi_margin_pct || extracted.noi_margin_pct,
            // Quality ratings
            cms_star_rating: cimFacility.quality_ratings?.cms_star_rating || extracted.cms_star_rating,
            // Flag that CIM data was merged
            _cim_data_merged: true
          };
        }

        let merged;
        if (confirmed.matched) {
          // Facility was matched to database - merge the data
          merged = extractionMerger.mergeExtractionWithMatch(
            extracted,
            confirmed.matched,
            confirmed.match_source
          );
        } else {
          // No database match - use extracted data only
          merged = {
            ...extracted,
            _data_sources: {
              extraction: true,
              database_match: false
            }
          };
        }
        merged.facility_role = 'subject';
        merged._confirmed = confirmed; // Keep reference for database save
        mergedFacilities.push(merged);
      }

      // For competitors, use database data only (no AI extraction)
      for (const competitor of competitorFacilities) {
        if (competitor.matched) {
          const competitorData = extractionMerger.mergeExtractionWithMatch(
            {}, // No AI extraction data
            competitor.matched,
            competitor.match_source
          );
          competitorData.facility_role = 'competitor';
          competitorData._data_sources = {
            extraction: false,
            database_match: true,
            competitor_only: true
          };
          competitorData._confirmed = competitor;
          mergedFacilities.push(competitorData);
        } else if (competitor.manual_entry) {
          // Manual entry competitor
          mergedFacilities.push({
            facility_name: competitor.detected?.name || 'Unknown',
            city: competitor.detected?.city,
            state: competitor.detected?.state,
            bed_count: competitor.detected?.beds,
            facility_type: competitor.detected?.facility_type,
            facility_role: 'competitor',
            _data_sources: {
              extraction: false,
              database_match: false,
              manual_entry: true,
              competitor_only: true
            },
            _confirmed: competitor
          });
        }
      }

      // ============================================
      // PERSIST TO DATABASE
      // ============================================

      console.log(`[extractPortfolio] PERSIST: mergedFacilities count: ${mergedFacilities.length}`);
      console.log(`[extractPortfolio] PERSIST: files count: ${files.length}`);
      if (mergedFacilities.length > 0) {
        console.log(`[extractPortfolio] PERSIST: First facility:`, JSON.stringify(mergedFacilities[0], null, 2).substring(0, 500));
      }

      // Get first subject facility for deal-level info
      const primaryFacility = subjectFacilities[0] || confirmedFacilities[0];
      const primaryLocation = primaryFacility?.matched || primaryFacility?.detected || {};

      // 1. Create master deal
      const masterDeal = await MasterDeals.create({
        unique_id: helper.generateUniqueId(),
        user_id: userId,
        street_address: primaryLocation.address || primaryLocation.street_address || '',
        city: primaryLocation.city || '',
        state: primaryLocation.state || '',
        country: 'USA',
        zip_code: primaryLocation.zip_code || '',
      });

      console.log(`[extractPortfolio] Created master deal: ${masterDeal.id}`);

      // 2. Create deal record
      // For portfolio deals, store PORTFOLIO-LEVEL data (not individual facility data)
      // Individual facility data goes in deal_facilities table

      const dealExtractionData = {
        // Store portfolio-level extracted data (combined totals)
        portfolio_data: extractionResult.portfolio_extraction || null,
        // Portfolio metadata
        is_portfolio_deal: mergedFacilities.length > 1,
        facility_count: mergedFacilities.length,
        subject_count: subjectFacilities.length,
        competitor_count: competitorFacilities.length,
        // Store portfolio summary (aggregated from facilities)
        portfolio_summary: extractionResult.portfolio_summary || null,
        // HOLISTIC DEAL OVERVIEW - Portfolio-level analysis from DEAL_OVERVIEW_PROMPT
        // This is the "Deal Overview" tab content for portfolio view
        deal_overview: extractionResult.deal_overview || null,
        // Validation results
        validation: extractionResult.validation || null,
        // Extraction metadata
        extraction_metadata: extractionResult.metadata || null,
        // Document structure info
        document_structure: extractionResult.document_structure || null,

        // CIM EXTRACTION DATA - Comprehensive extraction from Offering Memorandum
        // Includes NOI bridge, value-add thesis, executive summary, ownership narrative
        cim_extraction: extractionResult.cim_extraction || null,
        has_cim: extractionResult.has_cim || false,
        cim_files: extractionResult.cim_files || [],
      };

      const deal = await Deal.create({
        user_id: userId,
        master_deal_id: masterDeal.id,
        deal_name: dealName,
        deal_status: 'pipeline',
        // Use primary facility for deal-level location
        facility_name: primaryLocation.facility_name || primaryLocation.name || dealName,
        street_address: primaryLocation.address || primaryLocation.street_address || '',
        city: primaryLocation.city || '',
        state: primaryLocation.state || '',
        zip_code: primaryLocation.zip_code || '',
        // Store extraction data (proper structure, not spread array)
        // Model setter auto-stringifies via create()
        extraction_data: dealExtractionData,
        // Aggregate bed count from subject facilities
        bed_count: mergedFacilities
          .filter(f => f.facility_role === 'subject')
          .reduce((sum, f) => sum + (parseInt(f.bed_count || f.total_beds) || 0), 0),
      });

      console.log(`[extractPortfolio] Created deal: ${deal.id}`);

      // 3. Save each facility to deal_facilities
      let savedFacilityCount = 0;
      for (let i = 0; i < mergedFacilities.length; i++) {
        const facility = mergedFacilities[i];
        const confirmed = facility._confirmed || {};
        const matched = confirmed.matched || {};
        const detected = confirmed.detected || {};

        try {
          const facilityData = {
            deal_id: deal.id,
            facility_name: facility.facility_name || matched.facility_name || detected.name || `Facility ${i + 1}`,
            facility_type: facility.facility_type || matched.facility_type || detected.facility_type || 'SNF',
            facility_role: facility.facility_role || 'subject',
            street_address: facility.address || facility.street_address || matched.address || '',
            city: facility.city || matched.city || detected.city || '',
            state: facility.state || matched.state || detected.state || '',
            zip_code: facility.zip_code || matched.zip_code || '',
            county: facility.county || matched.county || '',
            bed_count: parseInt(facility.bed_count || facility.total_beds || matched.total_beds || detected.beds) || null,
            // Financial metrics (from AI extraction for subjects)
            // Check both flat fields and nested ttm_financials structure
            purchase_price: parseFloat(facility.purchase_price) || null,
            annual_revenue: parseFloat(facility.annual_revenue || facility.total_revenue || facility.ttm_revenue) || null,
            ebitda: parseFloat(facility.ebitda || facility.ttm_ebitda) || null,
            ebitdar: parseFloat(facility.ebitdar || facility.ttm_ebitdar) || null,
            net_operating_income: parseFloat(facility.noi || facility.net_operating_income || facility.ttm_net_income) || null,
            // Operational metrics - check all naming conventions
            // Extraction uses: occupancy_pct, medicaid_pct, medicare_pct, private_pay_pct
            current_occupancy: parseFloat(
              facility.occupancy_pct || facility.occupancy_rate || facility.current_occupancy ||
              facility.occupancy_percentage || matched.occupancy_rate
            ) || null,
            medicare_percentage: parseFloat(
              facility.medicare_pct || facility.medicare_mix || facility.medicare_percentage
            ) || null,
            medicaid_percentage: parseFloat(
              facility.medicaid_pct || facility.medicaid_mix || facility.medicaid_percentage
            ) || null,
            private_pay_percentage: parseFloat(
              facility.private_pay_pct || facility.private_pay_mix || facility.private_pay_percentage
            ) || null,
            // CMS data from matched facility
            federal_provider_number: matched.federal_provider_number || null,
            latitude: matched.latitude || null,
            longitude: matched.longitude || null,
            // Store full extraction data (model setter auto-stringifies via create())
            extraction_data: {
              ...facility,
              _confirmed: undefined,
              matched_facility_id: matched.id || matched.federal_provider_number || null,
              match_source: confirmed.match_source || null
            },
            display_order: i,
          };
          console.log(`[extractPortfolio] Creating facility ${i + 1}:`, facilityData.facility_name);
          const created = await DealFacilities.create(facilityData);
          console.log(`[extractPortfolio] Successfully created facility id: ${created.id}`);
          savedFacilityCount++;
        } catch (facilityErr) {
          console.error(`[extractPortfolio] ERROR creating facility ${i + 1}:`, facilityErr.message);
          console.error(`[extractPortfolio] Facility error details:`, facilityErr);
        }
      }

      console.log(`[extractPortfolio] Saved ${savedFacilityCount}/${mergedFacilities.length} facilities to deal_facilities`);

      // 4. Save uploaded documents to deal_documents
      const path = require('path');
      const fs = require('fs');
      // Use UPLOAD_DIR from fileStorage for persistent disk support on Render
      const uploadsDir = path.join(UPLOAD_DIR, 'deals', deal.id.toString());

      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      console.log(`[extractPortfolio] Using upload directory: ${uploadsDir}`);

      let savedDocumentCount = 0;
      for (const file of files) {
        try {
          // Save file to disk
          const fileName = `${Date.now()}_${file.name}`;
          const filePath = path.join(uploadsDir, fileName);
          console.log(`[extractPortfolio] Saving file ${file.name} to ${filePath}`);
          await file.mv(filePath);

          // Create document record
          const docData = {
            deal_id: deal.id,
            user_id: userId,
            document_name: file.name,
            document_url: `/uploads/deals/${deal.id}/${fileName}`,
          };
          console.log(`[extractPortfolio] Creating document record:`, docData);
          const created = await DealDocuments.create(docData);
          console.log(`[extractPortfolio] Successfully created document id: ${created.id}`);
          savedDocumentCount++;
        } catch (docErr) {
          console.error(`[extractPortfolio] ERROR saving document ${file.name}:`, docErr.message);
          console.error(`[extractPortfolio] Document error details:`, docErr);
        }
      }

      console.log(`[extractPortfolio] Saved ${savedDocumentCount}/${files.length} documents to deal_documents`);

      // Build final response
      const portfolioResult = {
        id: deal.id,
        master_deal_id: masterDeal.id,
        is_portfolio_deal: mergedFacilities.length > 1,
        facility_count: mergedFacilities.length,
        subject_count: subjectFacilities.length,
        competitor_count: competitorFacilities.length,
        facilities: mergedFacilities.map(f => {
          const { _confirmed, ...rest } = f;
          return rest;
        }),
        portfolio_summary: extractionResult.portfolio_summary || null,
      };

      console.log(`[extractPortfolio] Extraction complete. Deal ID: ${portfolioResult.id}`);
      console.log(`[extractPortfolio] Total facilities: ${mergedFacilities.length} (${subjectFacilities.length} subjects, ${competitorFacilities.length} competitors)`);

      return helper.success(res, 'Portfolio extraction completed successfully', {
        deal: portfolioResult
      });

    } catch (err) {
      console.error('[extractPortfolio] Error:', err);
      return helper.error(res, err.message || 'Failed to extract portfolio deal');
    }
  },

  /**
   * Get facility database statistics
   * GET /api/v1/deal/facility-db-stats
   */
  getFacilityDatabaseStats: async (req, res) => {
    try {
      const stats = await getDatabaseStats();

      return helper.success(res, 'Database stats retrieved successfully', stats);

    } catch (err) {
      console.error('[getFacilityDatabaseStats] Error:', err);
      return helper.error(res, err.message || 'Failed to get database stats');
    }
  },

  /**
   * Extract text from uploaded documents (lightweight - no AI processing)
   * POST /api/v1/deal/extract-text
   * Used for portfolio detection workflow
   */
  extractDocumentText: async (req, res) => {
    try {
      // Get uploaded files (express-fileupload puts them in req.files.documents)
      if (!req.files || !req.files.documents) {
        return helper.error(res, 'At least one document is required');
      }
      const uploadedFiles = req.files.documents;
      const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

      if (!files || files.length === 0) {
        return helper.error(res, 'At least one document is required');
      }

      console.log(`[extractDocumentText] Processing ${files.length} files for text extraction...`);

      const { processFiles } = require('../services/extractionOrchestrator');
      const processedFiles = await processFiles(files);

      // Combine all extracted text
      const successfulFiles = processedFiles.filter(f => f.text && !f.error);
      const combinedText = successfulFiles.map(f => {
        return `=== Document: ${f.name} ===\n${f.text}`;
      }).join('\n\n');

      const totalChars = successfulFiles.reduce((sum, f) => sum + (f.text?.length || 0), 0);

      console.log(`[extractDocumentText] Extracted ${totalChars} chars from ${successfulFiles.length}/${files.length} files`);

      return helper.success(res, 'Text extracted successfully', {
        combined_text: combinedText,
        total_characters: totalChars,
        files_processed: files.length,
        files_successful: successfulFiles.length,
        file_details: processedFiles.map(f => ({
          name: f.name,
          success: !f.error,
          characters: f.text?.length || 0,
          error: f.error || null
        }))
      });

    } catch (err) {
      console.error('[extractDocumentText] Error:', err);
      return helper.error(res, err.message || 'Failed to extract text from documents');
    }
  },
};
