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

// Minimum text length to consider extraction successful
const MIN_TEXT_LENGTH = 100;

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

  // Step 2: Prepare combined document text
  console.log('[Orchestrator] Step 2: Preparing documents for parallel extraction...');
  const documents = successfulFiles.map(f => ({
    name: f.name,
    text: f.text
  }));
  const combinedText = prepareDocumentText(documents);

  // Step 3: Run parallel extractions
  console.log('[Orchestrator] Step 3: Running parallel extractions...');
  const parallelResults = await runParallelExtractions(combinedText);

  // Step 4: Reconcile results
  console.log('[Orchestrator] Step 4: Reconciling extraction results...');
  const reconciledData = reconcileExtractionResults(parallelResults);

  // Step 5: Calculate ratios and benchmarks
  console.log('[Orchestrator] Step 5: Calculating ratios and benchmarks...');
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

module.exports = {
  runFullExtraction,
  storeExtractionResults,
  processFiles,
  extractTextFromFile
};
