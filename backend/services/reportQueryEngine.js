/**
 * Report Query Engine
 *
 * Executes user-defined report queries safely with:
 * - Field whitelisting (only allowed fields can be queried)
 * - Parameterized queries (prevents SQL injection)
 * - Resource limits (max rows, timeout)
 * - Multi-database routing (main vs market)
 */

const { getMainPool, getMarketPool } = require('../config/database');

// ============================================================================
// DATA SOURCE CONFIGURATIONS
// ============================================================================

/**
 * Whitelisted data sources with their tables, fields, and database routing
 */
const DATA_SOURCES = {
  facilities: {
    database: 'market',
    table: 'snf_facilities',
    label: 'SNF Facilities',
    description: 'CMS-certified skilled nursing facilities',
    fields: {
      // Identifiers
      federal_provider_number: { type: 'string', label: 'CCN', category: 'Identifier' },
      provider_name: { type: 'string', label: 'Facility Name', category: 'Identifier' },

      // Location
      state: { type: 'string', label: 'State', category: 'Location' },
      county_name: { type: 'string', label: 'County', category: 'Location' },
      city: { type: 'string', label: 'City', category: 'Location' },
      zip: { type: 'string', label: 'ZIP Code', category: 'Location' },

      // Ownership
      ownership_type: { type: 'string', label: 'Ownership Type', category: 'Ownership' },
      provider_type: { type: 'string', label: 'Provider Type', category: 'Ownership' },

      // Capacity
      certified_beds: { type: 'number', label: 'Certified Beds', category: 'Capacity' },
      average_residents_per_day: { type: 'number', label: 'Avg Daily Census', category: 'Capacity' },
      occupancy_rate: { type: 'number', label: 'Occupancy Rate', category: 'Capacity' },

      // Ratings
      overall_rating: { type: 'number', label: 'Overall Rating', category: 'Ratings' },
      health_rating: { type: 'number', label: 'Health Rating', category: 'Ratings' },
      quality_rating: { type: 'number', label: 'Quality Rating', category: 'Ratings' },
      staffing_rating: { type: 'number', label: 'Staffing Rating', category: 'Ratings' },

      // Staffing
      total_nursing_hprd: { type: 'number', label: 'Total Nursing HPRD', category: 'Staffing' },
      rn_hprd: { type: 'number', label: 'RN HPRD', category: 'Staffing' },
      lpn_hprd: { type: 'number', label: 'LPN HPRD', category: 'Staffing' },
      cna_hprd: { type: 'number', label: 'CNA HPRD', category: 'Staffing' },
      rn_turnover: { type: 'number', label: 'RN Turnover %', category: 'Staffing' },
      total_staff_turnover: { type: 'number', label: 'Total Staff Turnover %', category: 'Staffing' },

      // Quality
      short_stay_rehospitalization_rate: { type: 'number', label: 'Short-Stay Rehosp Rate', category: 'Quality' },
      long_stay_pressure_ulcer_rate: { type: 'number', label: 'Long-Stay Pressure Ulcer Rate', category: 'Quality' },
    }
  },

  deficiencies: {
    database: 'market',
    table: 'cms_facility_deficiencies',
    label: 'Survey Deficiencies',
    description: 'CMS survey deficiency citations',
    fields: {
      // Identifiers
      federal_provider_number: { type: 'string', label: 'CCN', category: 'Identifier' },

      // Survey info
      survey_date: { type: 'date', label: 'Survey Date', category: 'Survey' },
      survey_type: { type: 'string', label: 'Survey Type', category: 'Survey' },
      deficiency_tag: { type: 'string', label: 'F-Tag', category: 'Survey' },
      deficiency_prefix: { type: 'string', label: 'Deficiency Prefix', category: 'Survey' },
      scope_severity: { type: 'string', label: 'Scope/Severity', category: 'Survey' },

      // Type flags
      is_standard_deficiency: { type: 'boolean', label: 'Is Standard', category: 'Type' },
      is_complaint_deficiency: { type: 'boolean', label: 'Is Complaint', category: 'Type' },
      is_infection_control: { type: 'boolean', label: 'Is Infection Control', category: 'Type' },
      is_corrected: { type: 'boolean', label: 'Is Corrected', category: 'Type' },

      // Dates
      correction_date: { type: 'date', label: 'Correction Date', category: 'Dates' },
    }
  },

  vbp_performance: {
    database: 'market',
    table: 'snf_vbp_performance',
    label: 'VBP Performance',
    description: 'SNF Value-Based Purchasing program scores',
    fields: {
      cms_certification_number: { type: 'string', label: 'CCN', category: 'Identifier' },
      provider_name: { type: 'string', label: 'Facility Name', category: 'Identifier' },
      state: { type: 'string', label: 'State', category: 'Location' },
      city: { type: 'string', label: 'City', category: 'Location' },

      fiscal_year: { type: 'number', label: 'Fiscal Year', category: 'Period' },
      vbp_ranking: { type: 'number', label: 'VBP Ranking', category: 'Score' },
      performance_score: { type: 'number', label: 'Performance Score', category: 'Score' },
      incentive_payment_multiplier: { type: 'number', label: 'Incentive Multiplier', category: 'Score' },
      incentive_percentage: { type: 'number', label: 'Incentive %', category: 'Score' },

      baseline_readmission_rate: { type: 'number', label: 'Baseline Readmission Rate', category: 'Readmissions' },
      performance_readmission_rate: { type: 'number', label: 'Performance Readmission Rate', category: 'Readmissions' },
      readmission_measure_score: { type: 'number', label: 'Readmission Score', category: 'Readmissions' },

      baseline_hai_rate: { type: 'number', label: 'Baseline HAI Rate', category: 'HAI' },
      performance_hai_rate: { type: 'number', label: 'Performance HAI Rate', category: 'HAI' },
      hai_measure_score: { type: 'number', label: 'HAI Score', category: 'HAI' },

      baseline_turnover_rate: { type: 'number', label: 'Baseline Turnover Rate', category: 'Turnover' },
      performance_turnover_rate: { type: 'number', label: 'Performance Turnover Rate', category: 'Turnover' },
      turnover_measure_score: { type: 'number', label: 'Turnover Score', category: 'Turnover' },

      baseline_staffing_hours: { type: 'number', label: 'Baseline Staffing Hours', category: 'Staffing' },
      performance_staffing_hours: { type: 'number', label: 'Performance Staffing Hours', category: 'Staffing' },
      staffing_measure_score: { type: 'number', label: 'Staffing Score', category: 'Staffing' },
    }
  },

  ownership: {
    database: 'market',
    table: 'ownership_profiles',
    label: 'Ownership Profiles',
    description: 'SNF ownership and operator information',
    fields: {
      id: { type: 'number', label: 'Profile ID', category: 'Identifier' },
      organization_name: { type: 'string', label: 'Organization Name', category: 'Identifier' },
      organization_type: { type: 'string', label: 'Organization Type', category: 'Type' },
      headquarters_state: { type: 'string', label: 'HQ State', category: 'Location' },
      headquarters_city: { type: 'string', label: 'HQ City', category: 'Location' },
      facility_count: { type: 'number', label: 'Facility Count', category: 'Portfolio' },
      total_beds: { type: 'number', label: 'Total Beds', category: 'Portfolio' },
      avg_overall_rating: { type: 'number', label: 'Avg Overall Rating', category: 'Performance' },
      avg_quality_rating: { type: 'number', label: 'Avg Quality Rating', category: 'Performance' },
      avg_staffing_rating: { type: 'number', label: 'Avg Staffing Rating', category: 'Performance' },
    }
  },
};

// ============================================================================
// WHITELIST VALIDATION
// ============================================================================

/**
 * Allowed SQL operators for filter conditions
 */
const ALLOWED_OPERATORS = {
  '=': '=',
  '!=': '!=',
  '<>': '<>',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  'LIKE': 'LIKE',
  'ILIKE': 'ILIKE',
  'IN': 'IN',
  'NOT IN': 'NOT IN',
  'IS NULL': 'IS NULL',
  'IS NOT NULL': 'IS NOT NULL',
  'BETWEEN': 'BETWEEN',
};

/**
 * Allowed aggregation functions
 */
const ALLOWED_AGGREGATIONS = {
  'COUNT': 'COUNT',
  'SUM': 'SUM',
  'AVG': 'AVG',
  'MIN': 'MIN',
  'MAX': 'MAX',
  'COUNT_DISTINCT': 'COUNT(DISTINCT %s)',
};

/**
 * Allowed date transforms
 */
const ALLOWED_DATE_TRANSFORMS = {
  'year': "TO_CHAR(%s, 'YYYY')",
  'month': "TO_CHAR(%s, 'YYYY-MM')",
  'quarter': "TO_CHAR(%s, 'YYYY-\"Q\"Q')",
  'week': "TO_CHAR(%s, 'IYYY-IW')",
  'day': "TO_CHAR(%s, 'YYYY-MM-DD')",
};

/**
 * Validate a field name against whitelist
 */
function validateField(source, fieldName) {
  const sourceConfig = DATA_SOURCES[source];
  if (!sourceConfig) {
    throw new Error(`Invalid data source: ${source}`);
  }

  if (!sourceConfig.fields[fieldName]) {
    throw new Error(`Field '${fieldName}' not allowed for source '${source}'`);
  }

  return sourceConfig.fields[fieldName];
}

/**
 * Validate and return safe operator
 */
function validateOperator(operator) {
  const upper = operator.toUpperCase();
  if (!ALLOWED_OPERATORS[upper]) {
    throw new Error(`Operator '${operator}' not allowed`);
  }
  return ALLOWED_OPERATORS[upper];
}

/**
 * Validate and return safe aggregation
 */
function validateAggregation(aggregation) {
  const upper = aggregation.toUpperCase();
  if (!ALLOWED_AGGREGATIONS[upper]) {
    throw new Error(`Aggregation '${aggregation}' not allowed`);
  }
  return ALLOWED_AGGREGATIONS[upper];
}

// ============================================================================
// QUERY BUILDING
// ============================================================================

/**
 * Build a safe SELECT clause
 */
function buildSelectClause(source, dimensions, metrics) {
  const selectParts = [];
  const sourceConfig = DATA_SOURCES[source];

  // Add dimensions
  for (const dim of dimensions) {
    validateField(source, dim.field);
    const fieldInfo = sourceConfig.fields[dim.field];

    if (dim.transform && fieldInfo.type === 'date') {
      const transform = ALLOWED_DATE_TRANSFORMS[dim.transform];
      if (!transform) {
        throw new Error(`Date transform '${dim.transform}' not allowed`);
      }
      const transformedField = transform.replace('%s', dim.field);
      selectParts.push(`${transformedField} AS ${dim.alias || dim.field + '_' + dim.transform}`);
    } else {
      selectParts.push(`${dim.field}${dim.alias ? ' AS ' + dim.alias : ''}`);
    }
  }

  // Add metrics with aggregations
  for (const metric of metrics) {
    validateField(source, metric.field);
    const agg = validateAggregation(metric.aggregation);

    let aggExpr;
    if (agg.includes('%s')) {
      aggExpr = agg.replace('%s', metric.field);
    } else {
      aggExpr = `${agg}(${metric.field})`;
    }

    const alias = metric.alias || `${metric.aggregation.toLowerCase()}_${metric.field}`;
    selectParts.push(`${aggExpr} AS ${alias}`);
  }

  return selectParts.join(', ');
}

/**
 * Build a safe WHERE clause with parameterized values
 */
function buildWhereClause(source, filters, startParamIndex = 1) {
  if (!filters || !filters.conditions || filters.conditions.length === 0) {
    return { clause: '', params: [], nextParamIndex: startParamIndex };
  }

  const conditions = [];
  const params = [];
  let paramIndex = startParamIndex;

  for (const condition of filters.conditions) {
    validateField(source, condition.field);
    const operator = validateOperator(condition.operator);

    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      conditions.push(`${condition.field} ${operator}`);
    } else if (operator === 'IN' || operator === 'NOT IN') {
      if (!Array.isArray(condition.value)) {
        throw new Error(`${operator} requires an array value`);
      }
      const placeholders = condition.value.map((_, i) => `$${paramIndex + i}`).join(', ');
      conditions.push(`${condition.field} ${operator} (${placeholders})`);
      params.push(...condition.value);
      paramIndex += condition.value.length;
    } else if (operator === 'BETWEEN') {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        throw new Error('BETWEEN requires exactly 2 values');
      }
      conditions.push(`${condition.field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(condition.value[0], condition.value[1]);
      paramIndex += 2;
    } else if (operator === 'LIKE' || operator === 'ILIKE') {
      conditions.push(`${condition.field} ${operator} $${paramIndex}`);
      params.push(`%${condition.value}%`);
      paramIndex++;
    } else {
      conditions.push(`${condition.field} ${operator} $${paramIndex}`);
      params.push(condition.value);
      paramIndex++;
    }
  }

  const logic = filters.operator === 'OR' ? ' OR ' : ' AND ';
  return {
    clause: `WHERE ${conditions.join(logic)}`,
    params,
    nextParamIndex: paramIndex
  };
}

/**
 * Build GROUP BY clause
 */
function buildGroupByClause(source, dimensions) {
  if (!dimensions || dimensions.length === 0) {
    return '';
  }

  const groupParts = [];
  const sourceConfig = DATA_SOURCES[source];

  for (const dim of dimensions) {
    validateField(source, dim.field);
    const fieldInfo = sourceConfig.fields[dim.field];

    if (dim.transform && fieldInfo.type === 'date') {
      const transform = ALLOWED_DATE_TRANSFORMS[dim.transform];
      if (!transform) {
        throw new Error(`Date transform '${dim.transform}' not allowed`);
      }
      groupParts.push(transform.replace('%s', dim.field));
    } else {
      groupParts.push(dim.field);
    }
  }

  return `GROUP BY ${groupParts.join(', ')}`;
}

/**
 * Build ORDER BY clause
 */
function buildOrderByClause(source, orderBy) {
  if (!orderBy || orderBy.length === 0) {
    return '';
  }

  const orderParts = [];

  for (const order of orderBy) {
    // Allow ordering by aliases or original fields
    const direction = order.direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    orderParts.push(`${order.field} ${direction}`);
  }

  return `ORDER BY ${orderParts.join(', ')}`;
}

// ============================================================================
// QUERY EXECUTION
// ============================================================================

/**
 * Resource limits
 */
const MAX_ROWS = 10000;
const QUERY_TIMEOUT_MS = 30000;

/**
 * Execute a report query
 *
 * @param {Object} query - The query configuration
 * @param {string} query.source - Data source name (facilities, deficiencies, etc.)
 * @param {Array} query.dimensions - Dimension fields with optional transforms
 * @param {Array} query.metrics - Metric fields with aggregations
 * @param {Object} query.filters - Filter conditions
 * @param {Array} query.orderBy - Order by specifications
 * @param {number} query.limit - Row limit (max 10000)
 * @returns {Promise<Object>} Query results
 */
async function executeQuery(query) {
  const startTime = Date.now();

  // Validate source
  const sourceConfig = DATA_SOURCES[query.source];
  if (!sourceConfig) {
    throw new Error(`Invalid data source: ${query.source}`);
  }

  // Get appropriate database pool
  const pool = sourceConfig.database === 'main' ? getMainPool() : getMarketPool();

  // Build query parts
  const selectClause = buildSelectClause(
    query.source,
    query.dimensions || [],
    query.metrics || []
  );

  const { clause: whereClause, params } = buildWhereClause(
    query.source,
    query.filters
  );

  const groupByClause = query.metrics?.length > 0
    ? buildGroupByClause(query.source, query.dimensions || [])
    : '';

  const orderByClause = buildOrderByClause(query.source, query.orderBy);

  // Apply row limit
  const limit = Math.min(query.limit || MAX_ROWS, MAX_ROWS);

  // Build final SQL
  const sql = `
    SELECT ${selectClause}
    FROM ${sourceConfig.table}
    ${whereClause}
    ${groupByClause}
    ${orderByClause}
    LIMIT ${limit}
  `.trim();

  try {
    // Execute with timeout
    const result = await Promise.race([
      pool.query(sql, params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
      )
    ]);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      executionTimeMs: executionTime,
      query: {
        source: query.source,
        sql: sql.replace(/\s+/g, ' ').trim(),
        params: params.map((p, i) => `$${i + 1}: ${typeof p === 'string' ? `'${p}'` : p}`)
      }
    };
  } catch (error) {
    console.error('[ReportQueryEngine] Query error:', error.message);
    return {
      success: false,
      error: error.message,
      query: {
        source: query.source,
        sql: sql.replace(/\s+/g, ' ').trim()
      }
    };
  }
}

/**
 * Get available fields catalog for the UI
 */
function getFieldsCatalog() {
  const catalog = {};

  for (const [sourceName, sourceConfig] of Object.entries(DATA_SOURCES)) {
    const categories = {};

    for (const [fieldName, fieldInfo] of Object.entries(sourceConfig.fields)) {
      const category = fieldInfo.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({
        name: fieldName,
        label: fieldInfo.label,
        type: fieldInfo.type
      });
    }

    catalog[sourceName] = {
      label: sourceConfig.label,
      description: sourceConfig.description,
      categories
    };
  }

  return catalog;
}

/**
 * Get aggregation options for a field type
 */
function getAggregationsForType(fieldType) {
  switch (fieldType) {
    case 'number':
      return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
    case 'string':
      return ['COUNT', 'COUNT_DISTINCT'];
    case 'date':
      return ['COUNT', 'MIN', 'MAX'];
    case 'boolean':
      return ['COUNT', 'SUM'];
    default:
      return ['COUNT'];
  }
}

/**
 * Get date transform options
 */
function getDateTransforms() {
  return Object.keys(ALLOWED_DATE_TRANSFORMS);
}

module.exports = {
  DATA_SOURCES,
  ALLOWED_OPERATORS,
  ALLOWED_AGGREGATIONS,
  executeQuery,
  getFieldsCatalog,
  getAggregationsForType,
  getDateTransforms,
  validateField,
  validateOperator,
  validateAggregation
};
