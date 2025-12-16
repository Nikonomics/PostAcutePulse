/**
 * Test script to compare CIM extraction vs our current 6-prompt approach
 * Run with: node test_cim_extraction.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { runCIMExtraction, transformCIMToFrontendSchema, detectCIMDocument } = require('./services/cimExtractor');

// Path to Project Teton CIM
const CIM_PATH = '/Users/nikolashulewsky/Desktop/Deal Files/ESI_Offering_Memorandum___Project_Teton.pdf';

async function runTest() {
  console.log('='.repeat(60));
  console.log('CIM EXTRACTION TEST - Project Teton');
  console.log('='.repeat(60));
  console.log();

  // Check if file exists
  if (!fs.existsSync(CIM_PATH)) {
    console.log('CIM file not found at:', CIM_PATH);
    console.log('Please provide the path to the CIM PDF or text file.');

    // Try to find it in common locations
    const alternativePaths = [
      '/Users/nikolashulewsky/Desktop/Deal Files/project_teton_cim.txt',
      '/Users/nikolashulewsky/Desktop/Deal Files/Project Teton CIM.pdf',
    ];

    for (const altPath of alternativePaths) {
      if (fs.existsSync(altPath)) {
        console.log('Found alternative at:', altPath);
        break;
      }
    }
    return;
  }

  // Read and parse the document
  let documentText;

  if (CIM_PATH.endsWith('.pdf')) {
    console.log('PDF parsing not implemented in test script.');
    console.log('Please convert to text first or provide a .txt file.');
    console.log();
    console.log('You can use the extraction endpoint to process the PDF:');
    console.log('POST /api/v1/deal/extract-portfolio with the PDF file');
    return;
  } else {
    documentText = fs.readFileSync(CIM_PATH, 'utf-8');
  }

  console.log(`Document loaded: ${documentText.length.toLocaleString()} characters`);
  console.log();

  // Run CIM extraction
  console.log('Starting CIM extraction...');
  console.log();

  const result = await runCIMExtraction(documentText, 'Project Teton');

  if (!result.success) {
    console.log('Extraction failed:', result.error);
    if (result.rawResponse) {
      console.log('Raw response preview:', result.rawResponse);
    }
    return;
  }

  console.log();
  console.log('='.repeat(60));
  console.log('EXTRACTION RESULTS');
  console.log('='.repeat(60));
  console.log();

  const data = result.data;

  // Deal Overview
  console.log('DEAL OVERVIEW');
  console.log('-'.repeat(40));
  console.log(`Project Name: ${data.deal_overview?.project_name}`);
  console.log(`Asset Type: ${data.deal_overview?.asset_type}`);
  console.log(`Facilities: ${data.deal_overview?.facility_count}`);
  console.log(`Total Beds: ${data.deal_overview?.total_beds}`);
  console.log(`Locations: ${data.deal_overview?.locations_summary}`);
  console.log(`Asking Price: ${data.deal_overview?.asking_price}`);
  console.log(`Broker: ${data.deal_overview?.broker}`);
  console.log();

  // Ownership Narrative
  console.log('OWNERSHIP NARRATIVE');
  console.log('-'.repeat(40));
  console.log(`Owner: ${data.ownership_narrative?.current_owner}`);
  console.log(`Motivation: ${data.ownership_narrative?.seller_motivation}`);
  console.log(`Summary: ${data.ownership_narrative?.narrative_summary}`);
  console.log();

  // Per-Facility Financials
  console.log('PER-FACILITY FINANCIALS');
  console.log('-'.repeat(40));

  for (const facility of (data.facilities || [])) {
    console.log();
    console.log(`  ${facility.facility_name}`);
    console.log(`  ${'-'.repeat(35)}`);
    console.log(`  Location: ${facility.city}, ${facility.state}`);
    console.log(`  Beds: ${facility.licensed_beds} licensed / ${facility.functional_beds} functional`);
    console.log(`  Occupancy: ${facility.census_and_occupancy?.current_occupancy_pct}% (${facility.census_and_occupancy?.occupancy_trend})`);
    console.log(`  Star Rating: ${facility.quality_ratings?.cms_star_rating}`);
    console.log();
    console.log(`  FINANCIALS (${facility.financials?.reporting_period}):`);
    console.log(`    Revenue:  $${facility.financials?.total_revenue?.toLocaleString()}`);
    console.log(`    Expenses: $${facility.financials?.total_expenses?.toLocaleString()}`);
    console.log(`    NOI:      $${facility.financials?.noi?.toLocaleString()}`);
    console.log(`    Margin:   ${facility.financials?.noi_margin_pct}%`);
    console.log();
    console.log(`  PAYER MIX:`);
    console.log(`    Medicare:    ${facility.payer_mix?.medicare_pct}%`);
    console.log(`    Medicaid:    ${facility.payer_mix?.medicaid_pct}%`);
    console.log(`    Private Pay: ${facility.payer_mix?.private_pay_pct}%`);
  }
  console.log();

  // Portfolio Totals
  console.log('PORTFOLIO TOTALS');
  console.log('-'.repeat(40));
  console.log(`Combined Revenue:  $${data.portfolio_financials?.combined_revenue?.toLocaleString()}`);
  console.log(`Combined Expenses: $${data.portfolio_financials?.combined_expenses?.toLocaleString()}`);
  console.log(`Combined NOI:      $${data.portfolio_financials?.combined_noi?.toLocaleString()}`);
  console.log(`Blended Occupancy: ${data.portfolio_financials?.blended_occupancy_pct}%`);
  console.log();

  // NOI Bridge
  console.log('NOI BRIDGE');
  console.log('-'.repeat(40));
  console.log(`Current NOI:    $${data.noi_bridge?.current_noi?.toLocaleString()}`);

  if (data.noi_bridge?.day_1_adjustments) {
    console.log('Day 1 Adjustments:');
    for (const adj of data.noi_bridge.day_1_adjustments) {
      console.log(`  + ${adj.item}: $${adj.amount?.toLocaleString()}`);
    }
  }

  console.log(`Day 1 NOI:      $${data.noi_bridge?.day_1_noi?.toLocaleString()}`);

  if (data.noi_bridge?.stabilization_adjustments) {
    console.log('Stabilization Adjustments:');
    for (const adj of data.noi_bridge.stabilization_adjustments) {
      console.log(`  + ${adj.item}: $${adj.amount?.toLocaleString()}`);
    }
  }

  console.log(`Stabilized NOI: $${data.noi_bridge?.stabilized_noi?.toLocaleString()}`);
  console.log(`Timeline:       ${data.noi_bridge?.stabilization_timeline}`);
  console.log();

  // Risks
  console.log('DISCLOSED RISKS');
  console.log('-'.repeat(40));
  for (const risk of (data.risks_and_gaps?.disclosed_risks || [])) {
    console.log(`  - ${risk.risk}: ${risk.detail}`);
  }
  console.log();

  console.log('INFERRED RISKS');
  console.log('-'.repeat(40));
  for (const risk of (data.risks_and_gaps?.inferred_risks || [])) {
    console.log(`  - ${risk.risk}: ${risk.observation}`);
  }
  console.log();

  console.log('INFORMATION GAPS');
  console.log('-'.repeat(40));
  for (const gap of (data.risks_and_gaps?.information_gaps || [])) {
    console.log(`  - ${gap.gap}: ${gap.why_it_matters}`);
  }
  console.log();

  console.log('DUE DILIGENCE PRIORITIES');
  console.log('-'.repeat(40));
  for (const item of (data.risks_and_gaps?.due_diligence_priorities || [])) {
    console.log(`  ${item}`);
  }
  console.log();

  // Executive Summary
  console.log('EXECUTIVE SUMMARY');
  console.log('-'.repeat(40));
  console.log();
  console.log('THE STORY:');
  console.log(data.executive_summary?.the_story);
  console.log();
  console.log('THE OPPORTUNITY:');
  console.log(data.executive_summary?.the_opportunity);
  console.log();
  console.log('THE MARKET:');
  console.log(data.executive_summary?.the_market);
  console.log();
  console.log('THE DEAL:');
  console.log(data.executive_summary?.the_deal);
  console.log();

  // Summary Stats
  console.log('='.repeat(60));
  console.log('EXTRACTION STATS');
  console.log('='.repeat(60));
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Model: ${result.model}`);
  console.log(`Input: ${result.inputChars?.toLocaleString()} chars`);
  console.log();

  // Save full output
  const outputPath = path.join(__dirname, 'cim_extraction_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Full output saved to: ${outputPath}`);

  // Also save transformed output
  const transformed = transformCIMToFrontendSchema(data);
  const transformedPath = path.join(__dirname, 'cim_extraction_transformed.json');
  fs.writeFileSync(transformedPath, JSON.stringify(transformed, null, 2));
  console.log(`Transformed output saved to: ${transformedPath}`);
}

// Run the test
runTest().catch(console.error);
