/**
 * Extraction Merger Service
 *
 * Merges data from three sources into final extraction_data:
 * 1. Matched facility data (from SNF/ALF database)
 * 2. AI-extracted deal-specific data (financials, census, rates)
 * 3. Calculated fields (price per bed, margins, multiples)
 *
 * This ensures:
 * - No duplicate extraction of database fields
 * - Clear data provenance (source tracking)
 * - Consistent structure for frontend consumption
 */

/**
 * Merge all data sources into final extraction_data structure
 *
 * @param {Object} matchedFacility - Full facility record from database match
 * @param {Object} extractedData - AI-extracted deal-specific data
 * @param {string} facilityType - 'SNF' or 'ALF'
 * @returns {Object} - Complete extraction_data object
 */
function mergeExtractionData(matchedFacility, extractedData, facilityType) {
  // Start with base structure
  const merged = {
    // Metadata
    _meta: {
      extraction_version: '2.0',
      extraction_date: new Date().toISOString(),
      facility_type: facilityType,
      data_sources: {
        facility_info: matchedFacility ? 'database_match' : 'ai_extraction',
        financials: 'ai_extraction',
        census: 'ai_extraction',
        rates: 'ai_extraction',
        deal_terms: 'ai_extraction'
      }
    },

    // Facility Information (from database match)
    facility_information: buildFacilityInfo(matchedFacility, facilityType),

    // Deal Information (from AI extraction)
    deal_information: extractedData?.deal_terms || {},

    // T12 Financials (from AI extraction)
    financial_information_t12: extractedData?.t12_financials || {},

    // Monthly Financials (from AI extraction)
    monthly_financials: extractedData?.monthly_financials || [],

    // Census & Occupancy (from AI extraction)
    census_and_occupancy: extractedData?.census || {},

    // Rate Information (from AI extraction)
    rate_information: extractedData?.rate_schedule || {},

    // Expense Detail (from AI extraction)
    expense_detail: extractedData?.expense_detail || {},

    // Pro Forma (from AI extraction)
    pro_forma_projections: extractedData?.pro_forma || {},

    // Calculated fields (computed after merge)
    calculated_metrics: {},

    // Data quality notes
    data_quality_notes: [],

    // Key observations (from AI)
    key_observations: extractedData?.key_observations || []
  };

  // Add calculated metrics
  merged.calculated_metrics = calculateDerivedMetrics(merged);

  // Add data quality notes
  merged.data_quality_notes = assessDataQuality(merged);

  // Add confidence map
  merged._confidenceMap = buildConfidenceMap(matchedFacility, extractedData);

  // Add source map
  merged._sourceMap = buildSourceMap(matchedFacility, extractedData, facilityType);

  return merged;
}

/**
 * Merge extraction with matched facility (simpler version for API use)
 */
function mergeExtractionWithMatch(extractedData, matchedFacility, matchSource) {
  if (!matchedFacility) {
    return {
      ...extractedData,
      _data_sources: { extraction: true, database_match: false }
    };
  }

  const facilityType = matchSource === 'alf_facilities' ? 'ALF' : 'SNF';

  return {
    ...extractedData,
    // Overwrite with verified database fields
    facility_name: matchedFacility.facility_name,
    address: matchedFacility.address,
    city: matchedFacility.city,
    state: matchedFacility.state,
    zip_code: matchedFacility.zip_code,
    county: matchedFacility.county,
    total_beds: matchedFacility.total_beds || matchedFacility.capacity,
    ownership_type: matchedFacility.ownership_type,
    latitude: matchedFacility.latitude,
    longitude: matchedFacility.longitude,
    // SNF-specific
    ...(facilityType === 'SNF' ? {
      federal_provider_number: matchedFacility.federal_provider_number,
      overall_rating: matchedFacility.overall_rating,
      health_inspection_rating: matchedFacility.health_inspection_rating,
      staffing_rating: matchedFacility.staffing_rating,
      quality_measure_rating: matchedFacility.quality_measure_rating,
      rn_staffing_hours: matchedFacility.rn_staffing_hours,
      total_nurse_staffing_hours: matchedFacility.total_nurse_staffing_hours,
      accepts_medicare: matchedFacility.accepts_medicare,
      accepts_medicaid: matchedFacility.accepts_medicaid
    } : {}),
    // ALF-specific
    ...(facilityType === 'ALF' ? {
      license_number: matchedFacility.license_number,
      capacity: matchedFacility.capacity,
      licensee: matchedFacility.licensee
    } : {}),
    // Data source tracking
    _data_sources: {
      extraction: true,
      database_match: true,
      match_source: matchSource,
      facility_type: facilityType
    }
  };
}

/**
 * Build facility_information section from matched database record
 */
function buildFacilityInfo(matchedFacility, facilityType) {
  if (!matchedFacility) {
    return { _source: 'not_matched' };
  }

  const baseInfo = {
    facility_name: matchedFacility.facility_name,
    address: matchedFacility.address,
    city: matchedFacility.city,
    state: matchedFacility.state,
    zip_code: matchedFacility.zip_code || matchedFacility.zip,
    county: matchedFacility.county,
    phone: matchedFacility.phone || matchedFacility.phone_number,
    latitude: matchedFacility.latitude,
    longitude: matchedFacility.longitude,
    facility_type: facilityType,
    _source: 'database_match',
    _confidence: 'verified'
  };

  if (facilityType === 'SNF') {
    return {
      ...baseInfo,
      // Identifiers
      federal_provider_number: matchedFacility.federal_provider_number,
      cms_certification_number: matchedFacility.cms_certification_number,
      // Capacity
      total_beds: matchedFacility.total_beds,
      certified_beds: matchedFacility.certified_beds,
      // Ownership
      ownership_type: matchedFacility.ownership_type,
      legal_business_name: matchedFacility.legal_business_name,
      parent_organization: matchedFacility.parent_organization,
      ownership_chain: matchedFacility.ownership_chain,
      multi_facility_chain: matchedFacility.multi_facility_chain,
      // CMS Quality Ratings
      cms_ratings: {
        overall_rating: matchedFacility.overall_rating,
        health_inspection_rating: matchedFacility.health_inspection_rating,
        quality_measure_rating: matchedFacility.quality_measure_rating,
        staffing_rating: matchedFacility.staffing_rating,
        _source: 'CMS Care Compare',
        _as_of: matchedFacility.last_cms_update
      },
      // Staffing (from CMS)
      cms_staffing: {
        rn_hours_per_resident_day: matchedFacility.rn_staffing_hours,
        total_nurse_hours_per_resident_day: matchedFacility.total_nurse_staffing_hours,
        cna_hours_per_resident_day: matchedFacility.reported_cna_staffing_hours,
        _source: 'CMS Staffing Data'
      },
      // Deficiencies (from CMS)
      cms_deficiencies: {
        health_deficiencies: matchedFacility.health_deficiencies,
        fire_safety_deficiencies: matchedFacility.fire_safety_deficiencies,
        complaint_deficiencies: matchedFacility.complaint_deficiencies,
        total_penalties_amount: matchedFacility.total_penalties_amount,
        penalty_count: matchedFacility.penalty_count,
        _source: 'CMS Enforcement Data'
      },
      // Payer Acceptance
      payer_acceptance: {
        accepts_medicare: matchedFacility.accepts_medicare,
        accepts_medicaid: matchedFacility.accepts_medicaid,
        provider_type: matchedFacility.provider_type
      },
      // Special Flags
      special_flags: {
        special_focus_facility: matchedFacility.special_focus_facility,
        abuse_icon: matchedFacility.abuse_icon,
        ccrc: matchedFacility.continuing_care_retirement_community
      },
      // Geographic
      geographic: {
        county_fips: matchedFacility.county_fips,
        cbsa_code: matchedFacility.cbsa_code,
        cbsa_title: matchedFacility.cbsa_title,
        is_rural: matchedFacility.is_rural
      }
    };
  } else {
    // ALF structure
    return {
      ...baseInfo,
      // Identifiers
      license_number: matchedFacility.license_number,
      facility_id: matchedFacility.facility_id,
      licensee: matchedFacility.licensee,
      // Capacity
      capacity: matchedFacility.capacity,
      total_beds: matchedFacility.capacity, // Alias for consistency
      // Ownership
      ownership_type: matchedFacility.ownership_type,
      // Geographic
      geographic: {
        county_fips: matchedFacility.county_fips,
        cbsa_code: matchedFacility.cbsa_code,
        cbsa_title: matchedFacility.cbsa_title,
        is_rural: matchedFacility.is_rural
      },
      // Market Demographics (ALF-specific)
      market_demographics: {
        county_percent_65_plus: matchedFacility.county_percent_65_plus,
        county_median_age: matchedFacility.county_median_age,
        county_median_household_income: matchedFacility.county_median_household_income,
        total_county_al_need: matchedFacility.total_county_al_need,
        _source: 'Census/State Data'
      }
    };
  }
}

/**
 * Calculate derived metrics from merged data
 */
function calculateDerivedMetrics(merged) {
  const metrics = {};
  const facilityInfo = merged.facility_information || {};
  const financials = merged.financial_information_t12 || {};
  const dealInfo = merged.deal_information || {};
  const census = merged.census_and_occupancy || {};

  const beds = facilityInfo.total_beds || facilityInfo.capacity;
  const revenue = financials.revenue?.total_revenue;
  const ebitda = financials.profitability?.ebitda;
  const ebitdar = financials.profitability?.ebitdar;
  const noi = financials.profitability?.noi;
  const purchasePrice = dealInfo.pricing?.purchase_price || dealInfo.pricing?.asking_price;
  const avgCensus = census.current_census?.average_daily_census;

  // Price metrics
  if (purchasePrice && beds) {
    metrics.price_per_bed = Math.round(purchasePrice / beds);
  }

  // Revenue metrics
  if (revenue && beds) {
    metrics.revenue_per_bed = Math.round(revenue / beds);
  }

  if (revenue && avgCensus) {
    metrics.revenue_per_occupied_bed = Math.round(revenue / avgCensus);
    metrics.average_daily_rate = Math.round(revenue / avgCensus / 365);
  }

  // Margin metrics
  if (ebitda && revenue) {
    metrics.ebitda_margin = Math.round((ebitda / revenue) * 1000) / 10;
  }

  if (ebitdar && revenue) {
    metrics.ebitdar_margin = Math.round((ebitdar / revenue) * 1000) / 10;
  }

  // Valuation multiples
  if (purchasePrice && revenue) {
    metrics.revenue_multiple = Math.round((purchasePrice / revenue) * 100) / 100;
  }

  if (purchasePrice && ebitda && ebitda > 0) {
    metrics.ebitda_multiple = Math.round((purchasePrice / ebitda) * 100) / 100;
  }

  if (purchasePrice && ebitdar && ebitdar > 0) {
    metrics.ebitdar_multiple = Math.round((purchasePrice / ebitdar) * 100) / 100;
  }

  // Cap rate
  if (purchasePrice && noi && noi > 0) {
    metrics.implied_cap_rate = Math.round((noi / purchasePrice) * 1000) / 10;
  }

  // Occupancy (if not already calculated)
  if (avgCensus && beds && !census.current_census?.occupancy_pct) {
    metrics.calculated_occupancy = Math.round((avgCensus / beds) * 1000) / 10;
  }

  metrics._calculated_at = new Date().toISOString();

  return metrics;
}

/**
 * Assess data quality and generate notes
 */
function assessDataQuality(merged) {
  const notes = [];
  const facilityInfo = merged.facility_information || {};
  const financials = merged.financial_information_t12 || {};
  const census = merged.census_and_occupancy || {};
  const dealInfo = merged.deal_information || {};

  // Check facility match
  if (facilityInfo._source === 'database_match') {
    notes.push({
      type: 'info',
      message: 'Facility matched to database - location, beds, and regulatory data verified'
    });
  } else {
    notes.push({
      type: 'warning',
      message: 'Facility not matched to database - location and bed count from documents only'
    });
  }

  // Check financial completeness
  if (!financials.revenue?.total_revenue) {
    notes.push({
      type: 'warning',
      message: 'Revenue data not found - check for P&L or income statement'
    });
  }

  if (!financials.profitability?.ebitda) {
    notes.push({
      type: 'warning',
      message: 'EBITDA not found or calculated - may need additional financial documents'
    });
  }

  // Check census data
  if (!census.current_census?.average_daily_census) {
    notes.push({
      type: 'warning',
      message: 'Census data not found - occupancy calculations may be incomplete'
    });
  }

  // Check payer mix
  if (!census.payer_mix_by_census?.medicaid_pct) {
    notes.push({
      type: 'info',
      message: 'Payer mix by census days not found - check for census report'
    });
  }

  // Check deal terms
  if (!dealInfo.pricing?.purchase_price && !dealInfo.pricing?.asking_price) {
    notes.push({
      type: 'warning',
      message: 'Purchase/asking price not found - valuation metrics cannot be calculated'
    });
  }

  // Check monthly data
  if (!merged.monthly_financials || merged.monthly_financials.length < 12) {
    const count = merged.monthly_financials?.length || 0;
    notes.push({
      type: 'info',
      message: `Monthly financial data: ${count} of 12 months found`
    });
  }

  return notes;
}

/**
 * Build confidence map for all fields
 */
function buildConfidenceMap(matchedFacility, extractedData) {
  const confidenceMap = {};

  // Facility fields from database match are "verified"
  if (matchedFacility) {
    const verifiedFields = [
      'facility_name', 'address', 'city', 'state', 'zip_code', 'county',
      'total_beds', 'capacity', 'ownership_type', 'latitude', 'longitude'
    ];
    verifiedFields.forEach(field => {
      confidenceMap[field] = 'verified';
    });

    // CMS fields for SNF
    if (matchedFacility.federal_provider_number) {
      ['overall_rating', 'health_inspection_rating', 'staffing_rating',
        'rn_staffing_hours', 'health_deficiencies'].forEach(field => {
        confidenceMap[field] = 'verified';
      });
    }
  }

  // Extract confidence from AI responses
  if (extractedData) {
    Object.entries(extractedData).forEach(([section, data]) => {
      if (data && typeof data === 'object') {
        if (data.confidence) {
          confidenceMap[section] = data.confidence;
        }
        // Check nested confidence
        Object.entries(data).forEach(([key, value]) => {
          if (value && typeof value === 'object' && value.confidence) {
            confidenceMap[`${section}.${key}`] = value.confidence;
          }
        });
      }
    });
  }

  return confidenceMap;
}

/**
 * Build source map for data provenance
 */
function buildSourceMap(matchedFacility, extractedData, facilityType) {
  const sourceMap = {};

  // Database-sourced fields
  if (matchedFacility) {
    const dbSource = facilityType === 'SNF'
      ? 'CMS Care Compare Database'
      : 'State Licensing Database';

    sourceMap.facility_name = dbSource;
    sourceMap.address = dbSource;
    sourceMap.city = dbSource;
    sourceMap.state = dbSource;
    sourceMap.total_beds = dbSource;
    sourceMap.ownership_type = dbSource;

    if (facilityType === 'SNF') {
      sourceMap.cms_ratings = 'CMS Care Compare';
      sourceMap.cms_staffing = 'CMS Staffing Data';
      sourceMap.cms_deficiencies = 'CMS Enforcement Data';
    }
  }

  // AI-extracted fields
  if (extractedData) {
    Object.entries(extractedData).forEach(([section, data]) => {
      if (data && typeof data === 'object' && data.source) {
        sourceMap[section] = data.source;
      }
    });
  }

  return sourceMap;
}

/**
 * Merge multiple facility extractions for portfolio deals
 */
function mergePortfolioExtraction(facilityExtractions, portfolioSummary) {
  return {
    _meta: {
      extraction_version: '2.0',
      extraction_date: new Date().toISOString(),
      is_portfolio: true,
      facility_count: facilityExtractions.length
    },

    // Portfolio-level summary
    portfolio_summary: portfolioSummary || {},

    // Individual facility extractions
    facilities: facilityExtractions.map((extraction, index) => ({
      facility_index: index + 1,
      ...extraction
    })),

    // Combined metrics
    combined_metrics: calculateCombinedMetrics(facilityExtractions),

    // Rollup financials
    combined_financials: rollupFinancials(facilityExtractions)
  };
}

/**
 * Calculate combined metrics for portfolio
 */
function calculateCombinedMetrics(facilityExtractions) {
  let totalBeds = 0;
  let totalRevenue = 0;
  let totalEbitda = 0;
  let totalPrice = 0;
  let occupancySum = 0;
  let occupancyCount = 0;

  facilityExtractions.forEach(extraction => {
    const beds = extraction.facility_information?.total_beds ||
                 extraction.total_beds ||
                 extraction.beds || 0;
    const revenue = extraction.financial_information_t12?.revenue?.total_revenue ||
                    extraction.t12_revenue || 0;
    const ebitda = extraction.financial_information_t12?.profitability?.ebitda ||
                   extraction.t12_ebitda || 0;
    const price = extraction.deal_information?.pricing?.purchase_price ||
                  extraction.purchase_price || 0;
    const occupancy = extraction.census_and_occupancy?.current_census?.occupancy_pct ||
                      extraction.occupancy_pct;

    totalBeds += beds;
    totalRevenue += revenue;
    totalEbitda += ebitda;
    totalPrice += price;

    if (occupancy) {
      occupancySum += occupancy * beds; // Weight by beds
      occupancyCount += beds;
    }
  });

  return {
    total_beds: totalBeds,
    total_revenue: totalRevenue,
    total_ebitda: totalEbitda,
    total_purchase_price: totalPrice,
    blended_price_per_bed: totalBeds > 0 ? Math.round(totalPrice / totalBeds) : null,
    blended_occupancy: occupancyCount > 0 ? Math.round(occupancySum / occupancyCount * 10) / 10 : null,
    blended_ebitda_margin: totalRevenue > 0 ? Math.round(totalEbitda / totalRevenue * 1000) / 10 : null,
    facility_count: facilityExtractions.length
  };
}

/**
 * Roll up monthly financials from all facilities
 */
function rollupFinancials(facilityExtractions) {
  // Create month-keyed rollup
  const monthlyRollup = {};

  facilityExtractions.forEach(extraction => {
    const monthly = extraction.monthly_financials || extraction.monthly_trends || [];
    monthly.forEach(month => {
      const key = month.month;
      if (!monthlyRollup[key]) {
        monthlyRollup[key] = { month: key, revenue: 0, expenses: 0, net_income: 0 };
      }
      monthlyRollup[key].revenue += month.revenue || 0;
      monthlyRollup[key].expenses += month.expenses || 0;
      monthlyRollup[key].net_income += month.net_income || 0;
    });
  });

  // Convert to sorted array
  return Object.values(monthlyRollup).sort((a, b) => a.month.localeCompare(b.month));
}

module.exports = {
  mergeExtractionData,
  mergeExtractionWithMatch,
  mergePortfolioExtraction,
  buildFacilityInfo,
  calculateDerivedMetrics,
  assessDataQuality,
  calculateCombinedMetrics,
  rollupFinancials
};
