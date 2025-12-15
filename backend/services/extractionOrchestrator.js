/**
 * Extraction Orchestrator Service
 * Coordinates the full extraction pipeline:
 * 1. Parse documents and extract text
 * 2. Run parallel focused extractions
 * 3. Reconcile results
 * 4. Calculate ratios and benchmarks
 * 5. Return unified result
 */

const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');

const { runParallelExtractions, prepareDocumentText } = require('./parallelExtractor');
const { reconcileExtractionResults } = require('./extractionReconciler');
const { analyzeRatios } = require('./ratioCalculator');
const { analyzeFinancialPeriods, generatePromptSection } = require('./periodAnalyzer');

// Minimum text length to consider extraction successful
const MIN_TEXT_LENGTH = 100;

// Maximum combined text length for extraction
// Claude's context limit is ~200K tokens. Documents with special chars/formatting
// tokenize at ~2.2 chars/token (not 4). We need ~50K tokens for prompts, leaving ~150K for docs.
// 150K tokens × 2.2 chars/token ≈ 330K chars. Using 350K with buffer.
const MAX_COMBINED_TEXT_LENGTH = 350000;

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    return null;
  }
}

/**
 * Extract text from Excel file buffer
 */
function extractTextFromExcel(buffer, fileName) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }

    return allText.join('\n\n');
  } catch (error) {
    console.error('Excel parsing error:', error);
    return null;
  }
}

/**
 * Extract text from any supported file type
 */
async function extractTextFromFile(fileBuffer, mimeType, fileName) {
  const lowerFileName = fileName.toLowerCase();

  if (mimeType === 'application/pdf') {
    return await extractTextFromPDF(fileBuffer);
  } else if (mimeType.includes('text') || lowerFileName.endsWith('.txt') || lowerFileName.endsWith('.csv')) {
    return fileBuffer.toString('utf-8');
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    lowerFileName.endsWith('.xlsx') ||
    lowerFileName.endsWith('.xls')
  ) {
    return extractTextFromExcel(fileBuffer, fileName);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    lowerFileName.endsWith('.docx') ||
    lowerFileName.endsWith('.doc')
  ) {
    // Simple text extraction for Word
    try {
      const text = fileBuffer.toString('utf-8');
      const cleanText = text.replace(/<[^>]*>/g, ' ')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleanText.length > 100 ? cleanText : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Process multiple files and extract text from each
 */
async function processFiles(files) {
  const processedFiles = [];

  for (const file of files) {
    const fileInfo = {
      name: file.name,
      mimeType: file.mimetype,
      size: file.size,
      text: null,
      error: null
    };

    try {
      const text = await extractTextFromFile(file.data, file.mimetype, file.name);

      if (text && text.trim().length >= MIN_TEXT_LENGTH) {
        fileInfo.text = text;
        console.log(`[Orchestrator] Extracted ${text.length} chars from ${file.name}`);
      } else {
        fileInfo.error = 'Insufficient text extracted';
        console.log(`[Orchestrator] Insufficient text from ${file.name}`);
      }
    } catch (err) {
      fileInfo.error = err.message;
      console.error(`[Orchestrator] Error processing ${file.name}:`, err.message);
    }

    processedFiles.push(fileInfo);
  }

  return processedFiles;
}

/**
 * Main orchestration function - runs the full extraction pipeline
 * @param {Array} files - Array of file objects with { name, mimetype, data, size }
 * @returns {Object} Complete extraction result
 */
async function runFullExtraction(files) {
  const startTime = Date.now();
  console.log(`[Orchestrator] Starting full extraction for ${files.length} files...`);

  // Step 1: Process files and extract text
  console.log('[Orchestrator] Step 1: Extracting text from documents...');
  const processedFiles = await processFiles(files);

  // Filter to files with successful text extraction
  const successfulFiles = processedFiles.filter(f => f.text && !f.error);

  if (successfulFiles.length === 0) {
    return {
      success: false,
      error: 'Could not extract text from any uploaded documents',
      processedFiles
    };
  }

  console.log(`[Orchestrator] Successfully extracted text from ${successfulFiles.length}/${files.length} files`);

  // Check combined text size before proceeding
  const totalTextLength = successfulFiles.reduce((sum, f) => sum + (f.text?.length || 0), 0);
  console.log(`[Orchestrator] Total combined text length: ${totalTextLength.toLocaleString()} characters`);

  if (totalTextLength > MAX_COMBINED_TEXT_LENGTH) {
    const estimatedTokens = Math.round(totalTextLength / 4);
    const maxTokens = Math.round(MAX_COMBINED_TEXT_LENGTH / 4);
    console.error(`[Orchestrator] Combined document text exceeds limit: ${totalTextLength.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens) > ${MAX_COMBINED_TEXT_LENGTH.toLocaleString()} chars (~${maxTokens.toLocaleString()} tokens)`);

    // Sort files by text length to show largest contributors
    const filesBySize = [...successfulFiles].sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
    const topFiles = filesBySize.slice(0, 5).map(f => `${f.name}: ${(f.text?.length || 0).toLocaleString()} chars`);

    return {
      success: false,
      error: `Documents exceed maximum size for extraction. Combined text is ${(totalTextLength / 1000000).toFixed(1)}M characters (~${Math.round(totalTextLength / 4000)}K tokens), but the limit is ${(MAX_COMBINED_TEXT_LENGTH / 1000000).toFixed(1)}M characters (~${Math.round(MAX_COMBINED_TEXT_LENGTH / 4000)}K tokens). Please reduce the number of documents or use smaller files.`,
      errorCode: 'DOCUMENTS_TOO_LARGE',
      details: {
        totalCharacters: totalTextLength,
        estimatedTokens: estimatedTokens,
        maxCharacters: MAX_COMBINED_TEXT_LENGTH,
        maxTokens: maxTokens,
        largestFiles: topFiles
      },
      processedFiles: processedFiles.map(f => ({
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        textLength: f.text?.length || 0,
        success: !f.error,
        error: f.error
      }))
    };
  }

  // Step 2: Analyze document periods (for combining T12 + YTD data)
  console.log('[Orchestrator] Step 2: Analyzing financial document periods...');
  const periodDocuments = successfulFiles.map(f => ({
    filename: f.name,
    content: f.text,
    fileType: f.mimeType
  }));
  const periodAnalysis = analyzeFinancialPeriods(periodDocuments);
  const periodPromptSection = generatePromptSection(periodAnalysis);

  if (periodAnalysis.combination_needed) {
    console.log(`[Orchestrator] Period analysis: Combining ${periodAnalysis.financial_documents.length} documents for optimal T12`);
    console.log(`[Orchestrator] Target period: ${periodAnalysis.recommended_t12?.start} to ${periodAnalysis.recommended_t12?.end}`);
  } else {
    console.log(`[Orchestrator] Period analysis: ${periodAnalysis.financial_documents.length} financial documents identified`);
  }

  // Step 3: Prepare combined document text
  console.log('[Orchestrator] Step 3: Preparing documents for parallel extraction...');
  const documents = successfulFiles.map(f => ({
    name: f.name,
    text: f.text
  }));
  const combinedText = prepareDocumentText(documents);

  // Step 4: Run parallel extractions (with period analysis guidance)
  console.log('[Orchestrator] Step 4: Running parallel extractions...');
  const parallelResults = await runParallelExtractions(combinedText, periodPromptSection);

  // Step 5: Reconcile results
  console.log('[Orchestrator] Step 5: Reconciling extraction results...');
  const reconciledData = reconcileExtractionResults(parallelResults);

  // Step 6: Calculate ratios and benchmarks
  console.log('[Orchestrator] Step 6: Calculating ratios and benchmarks...');
  const ratioAnalysis = analyzeRatios(reconciledData);

  // Build final result
  const totalDuration = Date.now() - startTime;
  console.log(`[Orchestrator] Extraction complete in ${totalDuration}ms`);

  // Merge calculated expense ratios into extractedData for ProForma compatibility
  // These ratios are calculated from department totals and revenue by ratioCalculator
  const extractedDataWithRatios = {
    ...reconciledData.summary,
    // Expense ratio percentages (needed for ProForma opportunity calculations)
    labor_pct_of_revenue: ratioAnalysis.ratios.labor_pct_of_revenue,
    agency_pct_of_labor: ratioAnalysis.ratios.agency_pct_of_labor,
    food_cost_per_resident_day: ratioAnalysis.ratios.food_cost_per_resident_day,
    food_pct_of_revenue: ratioAnalysis.ratios.food_pct_of_revenue,
    management_fee_pct: ratioAnalysis.ratios.management_fee_pct,
    bad_debt_pct: ratioAnalysis.ratios.bad_debt_pct,
    utilities_pct_of_revenue: ratioAnalysis.ratios.utilities_pct_of_revenue,
    insurance_pct_of_revenue: ratioAnalysis.ratios.insurance_pct_of_revenue,
    // Additional ratios for ProForma
    ebitda_margin: ratioAnalysis.ratios.ebitda_margin,
    ebitdar_margin: ratioAnalysis.ratios.ebitdar_margin,
    occupancy: ratioAnalysis.ratios.occupancy
  };

  return {
    success: true,

    // Flat summary for backward compatibility with deals table
    // Now includes calculated expense ratios for ProForma
    extractedData: extractedDataWithRatios,

    // Full time-series data
    monthlyFinancials: reconciledData.financials?.monthly || [],
    monthlyCensus: reconciledData.census?.monthly || [],
    monthlyExpenses: reconciledData.expenses?.monthly || [],
    rates: reconciledData.rates,

    // TTM summaries
    ttmFinancials: reconciledData.financials?.ttm || null,
    censusSummary: reconciledData.census?.summary || null,
    expensesByDepartment: reconciledData.expenses?.byDepartment || {},

    // Ratios and benchmarks
    ratios: ratioAnalysis.ratios,
    benchmarkFlags: ratioAnalysis.benchmark_flags,
    potentialSavings: ratioAnalysis.potential_savings,
    insights: ratioAnalysis.insights,

    // Facility info
    facility: reconciledData.facility,

    // Metadata
    metadata: {
      totalDuration,
      filesProcessed: processedFiles.length,
      filesSuccessful: successfulFiles.length,
      extractionErrors: reconciledData.metadata?.extraction_errors || [],
      parallelExtractionDuration: parallelResults.metadata?.totalDuration
    },

    // File info
    processedFiles: processedFiles.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      textLength: f.text?.length || 0,
      success: !f.error,
      error: f.error
    }))
  };
}

/**
 * Store extraction results in database tables
 * @param {number} dealId - The deal ID
 * @param {Object} extractionResult - Result from runFullExtraction
 * @param {Object} db - Database models
 */
async function storeExtractionResults(dealId, extractionResult, db) {
  const {
    monthlyFinancials,
    monthlyCensus,
    monthlyExpenses,
    rates,
    ratios,
    benchmarkFlags,
    potentialSavings,
    processedFiles
  } = extractionResult;

  try {
    // Store monthly financials
    if (monthlyFinancials && monthlyFinancials.length > 0) {
      const DealMonthlyFinancials = db.deal_monthly_financials;
      if (DealMonthlyFinancials) {
        for (const record of monthlyFinancials) {
          await DealMonthlyFinancials.upsert({
            deal_id: dealId,
            month: record.month,
            source_document: record.source_document,
            source_location: record.source_location,
            total_revenue: record.total_revenue,
            medicaid_revenue: record.medicaid_revenue,
            medicare_revenue: record.medicare_revenue,
            private_pay_revenue: record.private_pay_revenue,
            other_revenue: record.other_revenue,
            total_expenses: record.total_expenses,
            operating_expenses: record.operating_expenses,
            depreciation: record.depreciation,
            amortization: record.amortization,
            interest_expense: record.interest_expense,
            rent_expense: record.rent_expense,
            property_taxes: record.property_taxes,
            property_insurance: record.property_insurance,
            net_income: record.net_income,
            ebit: record.ebit,
            ebitda: record.ebitda,
            ebitdar: record.ebitdar,
            updated_at: new Date()
          });
        }
        console.log(`[Storage] Stored ${monthlyFinancials.length} monthly financial records`);
      }
    }

    // Store monthly census
    if (monthlyCensus && monthlyCensus.length > 0) {
      const DealMonthlyCensus = db.deal_monthly_census;
      if (DealMonthlyCensus) {
        for (const record of monthlyCensus) {
          await DealMonthlyCensus.upsert({
            deal_id: dealId,
            month: record.month,
            source_document: record.source_document,
            source_location: record.source_location,
            total_beds: record.total_beds,
            average_daily_census: record.average_daily_census,
            occupancy_percentage: record.occupancy_percentage,
            total_census_days: record.total_census_days,
            medicaid_days: record.medicaid_days,
            medicare_days: record.medicare_days,
            private_pay_days: record.private_pay_days,
            other_payer_days: record.other_payer_days,
            medicaid_percentage: record.medicaid_percentage,
            medicare_percentage: record.medicare_percentage,
            private_pay_percentage: record.private_pay_percentage,
            other_payer_percentage: record.other_percentage,
            admissions: record.admissions,
            discharges: record.discharges,
            updated_at: new Date()
          });
        }
        console.log(`[Storage] Stored ${monthlyCensus.length} monthly census records`);
      }
    }

    // Store monthly expenses
    if (monthlyExpenses && monthlyExpenses.length > 0) {
      const DealMonthlyExpenses = db.deal_monthly_expenses;
      if (DealMonthlyExpenses) {
        for (const record of monthlyExpenses) {
          await DealMonthlyExpenses.upsert({
            deal_id: dealId,
            month: record.month,
            department: record.department,
            source_document: record.source_document,
            source_location: record.source_location,
            salaries_wages: record.salaries_wages,
            benefits: record.benefits,
            payroll_taxes: record.payroll_taxes,
            agency_labor: record.agency_labor,
            contract_labor: record.contract_labor,
            supplies: record.supplies,
            food_cost: record.food_cost,
            utilities: record.utilities,
            repairs_maintenance: record.repairs_maintenance,
            other_expenses: record.other_expenses,
            total_department_expense: record.total_department_expense,
            updated_at: new Date()
          });
        }
        console.log(`[Storage] Stored ${monthlyExpenses.length} monthly expense records`);
      }
    }

    // Store rate schedules
    if (rates) {
      const DealRateSchedules = db.deal_rate_schedules;
      if (DealRateSchedules) {
        // Store private pay rates
        if (rates.private_pay && rates.private_pay.length > 0) {
          for (const rate of rates.private_pay) {
            await DealRateSchedules.create({
              deal_id: dealId,
              payer_type: 'private_pay',
              rate_category: rate.unit_type,
              monthly_rate: rate.monthly_rate,
              daily_rate: rate.daily_rate,
              source_document: rate.source_document,
              source_location: rate.source_location,
              is_current: true
            });
          }
        }
        // Store medicaid rates
        if (rates.medicaid && rates.medicaid.length > 0) {
          for (const rate of rates.medicaid) {
            await DealRateSchedules.create({
              deal_id: dealId,
              payer_type: 'medicaid',
              rate_category: rate.care_level,
              monthly_rate: rate.monthly_rate,
              daily_rate: rate.daily_rate,
              source_document: rate.source_document,
              source_location: rate.source_location,
              is_current: true
            });
          }
        }
        console.log(`[Storage] Stored rate schedules`);
      }
    }

    // Store expense ratios
    if (ratios) {
      const DealExpenseRatios = db.deal_expense_ratios;
      if (DealExpenseRatios) {
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
          ebitdar_margin: ratios.ebitdar_margin,
          ebitda_margin: ratios.ebitda_margin,
          operating_margin: ratios.operating_margin,
          benchmark_flags: benchmarkFlags,
          potential_savings: potentialSavings,
          calculated_at: new Date(),
          updated_at: new Date()
        });
        console.log(`[Storage] Stored expense ratios and benchmarks`);
      }
    }

    // Store extracted text for re-analysis
    if (processedFiles && processedFiles.length > 0) {
      const DealExtractedText = db.deal_extracted_text;
      if (DealExtractedText) {
        for (const file of processedFiles) {
          if (file.success && file.textLength > 0) {
            await DealExtractedText.create({
              deal_id: dealId,
              filename: file.name,
              mime_type: file.mimeType,
              text_length: file.textLength
              // Note: Not storing full text to save space, can add later if needed
            });
          }
        }
        console.log(`[Storage] Stored extracted text metadata`);
      }
    }

    return { success: true };

  } catch (error) {
    console.error('[Storage] Error storing extraction results:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run extraction for multi-facility portfolio deals
 * @param {Array} files - Array of file objects with { name, mimetype, data, size }
 * @param {Array} confirmedFacilities - Array of confirmed facility objects
 * @returns {Object} Portfolio extraction result with per-facility data
 */
async function runPortfolioExtraction(files, confirmedFacilities) {
  const startTime = Date.now();
  const facilityCount = confirmedFacilities.length;

  console.log(`[PortfolioExtraction] Starting extraction for ${facilityCount} facilities...`);

  // Step 1: Process all files and extract text
  console.log('[PortfolioExtraction] Step 1: Extracting text from documents...');
  const processedFiles = await processFiles(files);
  const successfulFiles = processedFiles.filter(f => f.text && !f.error);

  if (successfulFiles.length === 0) {
    return {
      success: false,
      error: 'Could not extract text from any uploaded documents',
      processedFiles
    };
  }

  console.log(`[PortfolioExtraction] Successfully extracted text from ${successfulFiles.length}/${files.length} files`);

  // Step 2: Combine all document text with size check
  let combinedText = successfulFiles.map(f => {
    return `=== Document: ${f.name} ===\n${f.text}`;
  }).join('\n\n');

  // Check if combined text exceeds the limit and truncate if necessary
  const totalTextLength = combinedText.length;
  console.log(`[PortfolioExtraction] Combined text length: ${totalTextLength.toLocaleString()} characters`);

  if (totalTextLength > MAX_COMBINED_TEXT_LENGTH) {
    console.log(`[PortfolioExtraction] Text exceeds limit (${MAX_COMBINED_TEXT_LENGTH.toLocaleString()}), truncating...`);
    // Truncate to fit within limits, keeping document boundaries intact where possible
    combinedText = combinedText.substring(0, MAX_COMBINED_TEXT_LENGTH);
    // Try to end at a document boundary
    const lastDocMarker = combinedText.lastIndexOf('\n=== Document:');
    if (lastDocMarker > MAX_COMBINED_TEXT_LENGTH * 0.8) {
      combinedText = combinedText.substring(0, lastDocMarker);
    }
    console.log(`[PortfolioExtraction] Truncated to ${combinedText.length.toLocaleString()} characters`);
  }

  // Step 3: Run portfolio-level extraction first (NEW - n+1 approach)
  console.log('[PortfolioExtraction] Step 3: Running portfolio-level extraction...');
  const portfolioExtraction = await runFullExtraction(files);

  if (!portfolioExtraction.success) {
    console.error('[PortfolioExtraction] Portfolio-level extraction failed:', portfolioExtraction.error);
    return {
      success: false,
      error: 'Portfolio-level extraction failed: ' + portfolioExtraction.error,
      processedFiles
    };
  }

  console.log('[PortfolioExtraction] Portfolio-level extraction complete');
  console.log('[PortfolioExtraction] Portfolio totals:', {
    revenue: portfolioExtraction.extractedData?.ttm_revenue,
    ebitda: portfolioExtraction.extractedData?.ttm_ebitda,
    beds: portfolioExtraction.extractedData?.total_beds
  });

  // Step 4: Analyze document structure from portfolio extraction
  console.log('[PortfolioExtraction] Step 4: Analyzing document structure...');
  const documentStructure = analyzeDocumentStructure(portfolioExtraction, successfulFiles);

  // Step 5: Extract data for each facility with portfolio context
  // For portfolio deals, we need to guide the extraction to focus on each facility
  const facilityExtractions = [];

  for (let i = 0; i < confirmedFacilities.length; i++) {
    const facility = confirmedFacilities[i];
    const facilityName = facility.detected?.name || facility.matched?.facility_name || `Facility ${i + 1}`;

    console.log(`[PortfolioExtraction] Extracting data for facility ${i + 1}/${facilityCount}: ${facilityName}`);

    try {
      // Build facility context for the parallel extractors with portfolio context
      console.log(`[PortfolioExtraction] Calling runFacilityExtraction for ${facilityName}...`);
      const facilityResult = await runFacilityExtraction(
        combinedText,
        facility,
        facilityName,
        portfolioExtraction,  // Pass portfolio context
        documentStructure     // Pass document structure
      );
      console.log(`[PortfolioExtraction] Extraction result for ${facilityName}:`, facilityResult.success ? 'SUCCESS' : 'FAILED', facilityResult.error || '');

      facilityExtractions.push({
        facility_index: i,
        facility_name: facilityName,
        detected_info: facility.detected,
        matched_info: facility.matched,
        extraction_result: facilityResult,
        success: facilityResult.success
      });

    } catch (error) {
      console.error(`[PortfolioExtraction] Error extracting facility ${facilityName}:`, error.message);
      facilityExtractions.push({
        facility_index: i,
        facility_name: facilityName,
        detected_info: facility.detected,
        matched_info: facility.matched,
        extraction_result: null,
        success: false,
        error: error.message
      });
    }
  }

  // Step 6: Build portfolio summary by aggregating facility data
  console.log('[PortfolioExtraction] Step 6: Building portfolio summary...');
  const portfolioSummary = buildPortfolioSummary(facilityExtractions);

  // Step 7: Validate facility data against portfolio totals
  console.log('[PortfolioExtraction] Step 7: Validating facility data against portfolio totals...');
  const validation = validatePortfolioVsFacilities(portfolioExtraction, facilityExtractions);

  if (validation.warnings.length > 0) {
    console.warn('[PortfolioExtraction] Validation warnings:', validation.warnings);
  }

  const totalDuration = Date.now() - startTime;
  console.log(`[PortfolioExtraction] Portfolio extraction complete in ${totalDuration}ms`);

  return {
    success: true,
    is_portfolio: true,
    facility_count: facilityCount,
    facilities: facilityExtractions.map(fe => fe.extraction_result?.extractedData || {}),
    facility_details: facilityExtractions,
    portfolio_summary: portfolioSummary,
    portfolio_extraction: portfolioExtraction.extractedData,  // Include portfolio-level data
    validation: validation,  // Include validation results
    metadata: {
      totalDuration,
      filesProcessed: processedFiles.length,
      filesSuccessful: successfulFiles.length,
      facilitiesExtracted: facilityExtractions.filter(f => f.success).length,
      facilitiesFailed: facilityExtractions.filter(f => !f.success).length,
      portfolioExtractionDuration: portfolioExtraction.metadata?.totalDuration
    },
    processedFiles: processedFiles.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      textLength: f.text?.length || 0,
      success: !f.error,
      error: f.error
    }))
  };
}

/**
 * Run extraction focused on a specific facility
 * @param {string} documentText - Combined document text
 * @param {Object} facilityInfo - Facility object with detected/matched info
 * @param {string} facilityName - Name of the facility
 * @param {Object} portfolioExtraction - Portfolio-level extraction result (optional)
 * @param {Object} documentStructure - Document structure analysis (optional)
 * @returns {Object} Extraction result for this facility
 */
async function runFacilityExtraction(documentText, facilityInfo, facilityName, portfolioExtraction = null, documentStructure = null) {
  console.log('[runFacilityExtraction] Starting extraction for:', facilityName);
  console.log('[runFacilityExtraction] documentText type:', typeof documentText, 'length:', documentText?.length || 'N/A');

  try {
    // Ensure documentText is a string (handle array or object cases)
    if (Array.isArray(documentText)) {
      documentText = documentText.join('\n');
    } else if (typeof documentText === 'object' && documentText !== null) {
      documentText = documentText.text || JSON.stringify(documentText);
    } else if (typeof documentText !== 'string') {
      documentText = String(documentText || '');
    }

    // Analyze periods for this facility
    const periodDocuments = [{
      filename: 'combined_documents',
      content: documentText,
      fileType: 'text/plain'
    }];
    const periodAnalysis = analyzeFinancialPeriods(periodDocuments);
    const periodPromptSection = generatePromptSection(periodAnalysis);

    // Build facility-specific context for the parallel extractors
    const facilityType = facilityInfo?.detected?.facility_type || facilityInfo?.matched?.facility_type || 'SNF';
    const facilityCity = facilityInfo?.matched?.city || facilityInfo?.detected?.city || '';
    const facilityState = facilityInfo?.matched?.state || facilityInfo?.detected?.state || '';
    const facilityBeds = facilityInfo?.matched?.total_beds || facilityInfo?.matched?.capacity || facilityInfo?.detected?.beds || '';

    // Build enhanced prompt with portfolio context
    let facilityScopedPrompt = `
=== MULTI-FACILITY PORTFOLIO EXTRACTION ===

CRITICAL INSTRUCTIONS - READ CAREFULLY:
This document contains data for MULTIPLE facilities in a portfolio deal.
You MUST extract data ONLY for the specific target facility listed below.

TARGET FACILITY (EXTRACT ONLY THIS FACILITY'S DATA):
- Name: ${facilityName}
- Type: ${facilityType}
- Location: ${facilityCity}, ${facilityState}
- Beds/Units: ${facilityBeds || 'Unknown'}
`;

    // Add portfolio context if available
    if (portfolioExtraction && portfolioExtraction.extractedData) {
      const portfolioData = portfolioExtraction.extractedData;
      facilityScopedPrompt += `
PORTFOLIO TOTALS (DO NOT USE THESE - THEY ARE COMBINED FOR ALL FACILITIES):
- Portfolio Total Revenue: $${(portfolioData.ttm_revenue || portfolioData.annual_revenue || 0).toLocaleString()}
- Portfolio Total Beds: ${portfolioData.total_beds || 'Unknown'}
- Portfolio Total EBITDA: $${(portfolioData.ttm_ebitda || portfolioData.ebitda || 0).toLocaleString()}

⚠️  WARNING: Your facility's revenue MUST be LESS than the portfolio total!
⚠️  If you extract revenue equal to the portfolio total, you are using COMBINED data (WRONG!)
`;
    }

    // Add document structure hints if available
    if (documentStructure && documentStructure.hints) {
      facilityScopedPrompt += `
DOCUMENT STRUCTURE HINTS:
${documentStructure.hints.map(hint => `- ${hint}`).join('\n')}
`;
    }

    facilityScopedPrompt += `
EXTRACTION RULES:
1. **LOOK FOR FACILITY-SPECIFIC DATA ONLY**:
   - Search for sections, sheets, tabs, or headers specifically labeled with "${facilityName}"
   - Look for per-facility breakdowns, not portfolio totals or combined summaries
   - Common labels: "Individual Property", "Property Detail", "${facilityName} P&L", etc.

2. **AVOID COMBINED/TOTAL DATA**:
   - DO NOT use data from sections labeled: "Portfolio Total", "Combined", "Aggregate", "Summary", "Total"
   - DO NOT use data from sheets like "Portfolio P&L", "Total", "Summary", "Overview"
   - If a financial statement shows multiple facilities, extract ONLY ${facilityName}'s row/column

3. **VALIDATION CHECKS**:
   - Your extracted revenue should be a PORTION of the portfolio total (not equal to it)
   - If you can't find facility-specific data, return null - DO NOT guess or use combined data
   - When in doubt, return null rather than using ambiguous data

4. **WHERE TO LOOK**:
   - Facility-specific Excel sheets or tabs (e.g., "${facilityName}" sheet)
   - Per-property sections in PDF offering memorandums
   - Individual facility financial statements
   - Property-specific P&L breakdowns

${periodPromptSection}
`;

    console.log('[runFacilityExtraction] Built enhanced facility context with portfolio validation for:', facilityName);

    // Run parallel extractions with facility context
    const { runParallelExtractions, prepareDocumentText } = require('./parallelExtractor');
    const documents = [{ name: 'portfolio_documents', text: documentText }];
    const preparedText = prepareDocumentText(documents);

    const parallelResults = await runParallelExtractions(preparedText, facilityScopedPrompt);

    // Reconcile results
    const { reconcileExtractionResults } = require('./extractionReconciler');
    const reconciledData = reconcileExtractionResults(parallelResults);

    // Calculate ratios
    const { analyzeRatios } = require('./ratioCalculator');
    const ratioAnalysis = analyzeRatios(reconciledData);

    // Build result with ratios merged in
    const extractedDataWithRatios = {
      ...reconciledData.summary,
      facility_name: facilityName,
      labor_pct_of_revenue: ratioAnalysis.ratios.labor_pct_of_revenue,
      agency_pct_of_labor: ratioAnalysis.ratios.agency_pct_of_labor,
      food_cost_per_resident_day: ratioAnalysis.ratios.food_cost_per_resident_day,
      food_pct_of_revenue: ratioAnalysis.ratios.food_pct_of_revenue,
      management_fee_pct: ratioAnalysis.ratios.management_fee_pct,
      bad_debt_pct: ratioAnalysis.ratios.bad_debt_pct,
      utilities_pct_of_revenue: ratioAnalysis.ratios.utilities_pct_of_revenue,
      insurance_pct_of_revenue: ratioAnalysis.ratios.insurance_pct_of_revenue,
      ebitda_margin: ratioAnalysis.ratios.ebitda_margin,
      ebitdar_margin: ratioAnalysis.ratios.ebitdar_margin,
      occupancy: ratioAnalysis.ratios.occupancy
    };

    return {
      success: true,
      extractedData: extractedDataWithRatios,
      monthlyFinancials: reconciledData.financials?.monthly || [],
      monthlyCensus: reconciledData.census?.monthly || [],
      monthlyExpenses: reconciledData.expenses?.monthly || [],
      rates: reconciledData.rates,
      ratios: ratioAnalysis.ratios,
      benchmarkFlags: ratioAnalysis.benchmark_flags,
      facility: reconciledData.facility
    };

  } catch (error) {
    console.error(`[FacilityExtraction] Error for ${facilityName}:`, error.message);
    return {
      success: false,
      error: error.message,
      extractedData: { facility_name: facilityName }
    };
  }
}

/**
 * Analyze document structure from portfolio extraction
 * Identifies which documents/sheets contain combined vs per-facility data
 * @param {Object} portfolioExtraction - Result from runFullExtraction
 * @param {Array} successfulFiles - Array of processed file objects
 * @returns {Object} Document structure analysis
 */
function analyzeDocumentStructure(portfolioExtraction, successfulFiles) {
  const structure = {
    files: successfulFiles.map(f => f.name),
    hasExcelFiles: successfulFiles.some(f =>
      f.name.toLowerCase().endsWith('.xlsx') ||
      f.name.toLowerCase().endsWith('.xls')
    ),
    hasPDFs: successfulFiles.some(f =>
      f.name.toLowerCase().endsWith('.pdf')
    ),
    sourceMap: portfolioExtraction.extractedData?._sourceMap || {},
    hints: []
  };

  // Analyze source map to identify combined data sources
  const sourceMap = portfolioExtraction.extractedData?._sourceMap || {};
  const sourceCounts = {};

  // Count how many fields came from each source
  for (const [field, source] of Object.entries(sourceMap)) {
    if (typeof source === 'string') {
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }
  }

  // Identify likely combined/portfolio-level sources
  const sortedSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, fieldCount: count }));

  if (sortedSources.length > 0) {
    const primarySource = sortedSources[0];
    structure.hints.push(`Primary data source: "${primarySource.source}" (${primarySource.fieldCount} fields)`);

    // If there's an Excel file, likely has sheets
    if (structure.hasExcelFiles) {
      structure.hints.push('Excel files detected - look for facility-specific sheet names or tabs');
    }
  }

  return structure;
}

/**
 * Validate facility-level data against portfolio totals
 * @param {Object} portfolioExtraction - Portfolio-level extraction result
 * @param {Array} facilityExtractions - Array of facility extraction results
 * @returns {Object} Validation result with warnings
 */
function validatePortfolioVsFacilities(portfolioExtraction, facilityExtractions) {
  const warnings = [];
  const portfolioData = portfolioExtraction.extractedData || {};

  // Sum facility-level metrics
  const successfulFacilities = facilityExtractions.filter(f => f.success && f.extraction_result?.extractedData);

  const facilityTotals = {
    revenue: 0,
    expenses: 0,
    ebitda: 0,
    beds: 0,
    facilitiesWithData: 0
  };

  for (const facility of successfulFacilities) {
    const data = facility.extraction_result.extractedData;
    if (data.ttm_revenue || data.annual_revenue) {
      facilityTotals.revenue += parseFloat(data.ttm_revenue || data.annual_revenue) || 0;
      facilityTotals.facilitiesWithData++;
    }
    if (data.ttm_expenses || data.total_expenses) {
      facilityTotals.expenses += parseFloat(data.ttm_expenses || data.total_expenses) || 0;
    }
    if (data.ttm_ebitda || data.ebitda) {
      facilityTotals.ebitda += parseFloat(data.ttm_ebitda || data.ebitda) || 0;
    }
    if (data.total_beds || data.bed_count) {
      facilityTotals.beds += parseInt(data.total_beds || data.bed_count) || 0;
    }
  }

  // Compare with portfolio totals
  const portfolioRevenue = parseFloat(portfolioData.ttm_revenue || portfolioData.annual_revenue) || 0;
  const portfolioBeds = parseInt(portfolioData.total_beds) || 0;

  // Check revenue reconciliation (within 10% tolerance)
  if (portfolioRevenue > 0 && facilityTotals.revenue > 0) {
    const revenueDiff = Math.abs(portfolioRevenue - facilityTotals.revenue);
    const revenuePercent = (revenueDiff / portfolioRevenue) * 100;

    if (revenuePercent > 10) {
      warnings.push({
        type: 'revenue_mismatch',
        message: `Revenue mismatch: Portfolio total ($${portfolioRevenue.toLocaleString()}) vs Facility sum ($${facilityTotals.revenue.toLocaleString()}) - ${revenuePercent.toFixed(1)}% difference`,
        severity: 'high'
      });
    }
  }

  // Check for missing facility data
  if (facilityTotals.facilitiesWithData < successfulFacilities.length) {
    const missingCount = successfulFacilities.length - facilityTotals.facilitiesWithData;
    warnings.push({
      type: 'missing_data',
      message: `${missingCount} of ${successfulFacilities.length} facilities missing financial data`,
      severity: 'medium'
    });
  }

  // Check bed count
  if (portfolioBeds > 0 && facilityTotals.beds > 0) {
    if (Math.abs(portfolioBeds - facilityTotals.beds) > 5) {
      warnings.push({
        type: 'bed_count_mismatch',
        message: `Bed count mismatch: Portfolio (${portfolioBeds}) vs Facilities (${facilityTotals.beds})`,
        severity: 'low'
      });
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
    portfolioTotals: {
      revenue: portfolioRevenue,
      beds: portfolioBeds
    },
    facilityTotals
  };
}

/**
 * Build portfolio summary by aggregating data from all facilities
 * @param {Array} facilityExtractions - Array of facility extraction results
 * @returns {Object} Aggregated portfolio summary
 */
function buildPortfolioSummary(facilityExtractions) {
  const successfulExtractions = facilityExtractions.filter(f => f.success && f.extraction_result?.extractedData);

  if (successfulExtractions.length === 0) {
    return {
      total_facilities: facilityExtractions.length,
      facilities_extracted: 0,
      aggregates: null
    };
  }

  // Helper to safely sum numeric values
  const safeSum = (arr, key) => {
    return arr.reduce((sum, item) => {
      const value = item.extraction_result?.extractedData?.[key];
      return sum + (typeof value === 'number' && !isNaN(value) ? value : 0);
    }, 0);
  };

  // Helper to calculate weighted average
  const weightedAvg = (arr, valueKey, weightKey) => {
    let totalValue = 0;
    let totalWeight = 0;
    for (const item of arr) {
      const value = item.extraction_result?.extractedData?.[valueKey];
      const weight = item.extraction_result?.extractedData?.[weightKey] || 1;
      if (typeof value === 'number' && !isNaN(value)) {
        totalValue += value * weight;
        totalWeight += weight;
      }
    }
    return totalWeight > 0 ? totalValue / totalWeight : null;
  };

  // Aggregate key metrics
  const totalBeds = safeSum(successfulExtractions, 'total_beds');
  const totalRevenue = safeSum(successfulExtractions, 'ttm_revenue');
  const totalExpenses = safeSum(successfulExtractions, 'ttm_expenses');
  const totalEbitdar = safeSum(successfulExtractions, 'ttm_ebitdar');

  return {
    total_facilities: facilityExtractions.length,
    facilities_extracted: successfulExtractions.length,
    aggregates: {
      total_beds: totalBeds || null,
      combined_ttm_revenue: totalRevenue || null,
      combined_ttm_expenses: totalExpenses || null,
      combined_ttm_ebitdar: totalEbitdar || null,
      combined_net_income: safeSum(successfulExtractions, 'ttm_net_income') || null,
      average_occupancy: weightedAvg(successfulExtractions, 'occupancy', 'total_beds'),
      weighted_avg_payer_mix: {
        medicaid: weightedAvg(successfulExtractions, 'medicaid_pct', 'total_beds'),
        medicare: weightedAvg(successfulExtractions, 'medicare_pct', 'total_beds'),
        private_pay: weightedAvg(successfulExtractions, 'private_pay_pct', 'total_beds')
      },
      portfolio_ebitdar_margin: totalRevenue > 0 ? (totalEbitdar / totalRevenue * 100) : null
    },
    per_facility: successfulExtractions.map(fe => ({
      facility_name: fe.facility_name,
      beds: fe.extraction_result?.extractedData?.total_beds,
      revenue: fe.extraction_result?.extractedData?.ttm_revenue,
      occupancy: fe.extraction_result?.extractedData?.occupancy,
      ebitdar: fe.extraction_result?.extractedData?.ttm_ebitdar
    }))
  };
}

module.exports = {
  runFullExtraction,
  runPortfolioExtraction,
  storeExtractionResults,
  processFiles,
  extractTextFromFile
};
