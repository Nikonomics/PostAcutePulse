/**
 * SNFalyze Unified Chat Service
 *
 * Provides a shared chat experience across Calculator Tab and AI Assistant page.
 * Features:
 * - Gemini AI integration
 * - SNFDealEvaluator algorithm integration
 * - Calculator metrics integration
 * - Persistent conversation storage (IndexedDB)
 * - Quick actions support
 */

import { SNFDealEvaluator } from './snfAlgorithm/snfEvaluator';
import { calculateDealMetrics } from '../api/DealService';

// =============================================================================
// CONFIGURATION
// =============================================================================
// Use dedicated chatbot API key if available, otherwise fall back to main Gemini key
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_CHATBOT_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// =============================================================================
// IndexedDB PERSISTENCE (unified storage for all chat)
// =============================================================================
const DB_NAME = 'SNFalyzeChatDB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'dealId' });
      }
    };
  });
}

export async function saveConversation(dealId, messages) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ dealId, messages, lastUpdated: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error saving conversation:', err);
  }
}

export async function loadConversation(dealId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(dealId);
      req.onsuccess = () => resolve(req.result ? req.result.messages : null);
      req.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error loading conversation:', err);
    return null;
  }
}

export async function clearConversation(dealId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(dealId);
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error clearing conversation:', err);
  }
}

// =============================================================================
// QUICK ACTIONS CONFIGURATION
// =============================================================================
export const QUICK_ACTIONS = [
  { label: 'SNF Algorithm Analysis', color: 'bg-purple-500', icon: '🧠', action: 'snf_analysis' },
  { label: 'Financial Performance', color: 'bg-green-500', icon: '💰', action: 'financial_performance' },
  { label: 'Risk Assessment', color: 'bg-red-500', icon: '⚠️', action: 'risk_assessment' },
  { label: 'REIT Compatibility', color: 'bg-blue-500', icon: '🏢', action: 'reit_compatibility' },
  { label: 'Market Analysis', color: 'bg-orange-500', icon: '📊', action: 'market_analysis' },
  { label: 'Investment Recommendation', color: 'bg-teal-500', icon: '🎯', action: 'investment_recommendation' },
  { label: 'Generate Report', color: 'bg-pink-500', icon: '📋', action: 'generate_report' }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getDealId(deal) {
  return deal?.id || deal?.deal_id || deal?.deal_name || deal?.name || 'default';
}

export function getWelcomeMessage(deal) {
  return {
    id: Date.now(),
    role: 'assistant',
    title: 'Ready to Analyze!',
    content: `I'm here to help you analyze "${deal?.deal_name || deal?.name || 'this deal'}" using Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm.

I can provide comprehensive analysis including:
• Financial performance vs Cascadia benchmarks
• Risk assessment and mitigation strategies
• REIT compatibility evaluation
• Market analysis and competitive positioning
• Investment recommendations

Use the quick action buttons to get started, or ask me any specific questions about this deal!`,
    timestamp: new Date()
  };
}

// =============================================================================
// SNF DEAL EVALUATOR INTEGRATION
// =============================================================================

export async function runSNFEvaluation(deal) {
  try {
    const evaluation = await SNFDealEvaluator.evaluateDeal(deal);
    return evaluation;
  } catch (error) {
    console.error('Error running SNF evaluation:', error);
    throw error;
  }
}

// =============================================================================
// CALCULATOR METRICS INTEGRATION
// =============================================================================

export async function fetchCalculatorMetrics(dealId) {
  try {
    const response = await calculateDealMetrics(dealId);
    if (response.success) {
      return response.body;
    }
    return null;
  } catch (err) {
    console.error('Error fetching calculator metrics:', err);
    return null;
  }
}

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

function formatBeds(beds) {
  if (!beds) return 'N/A';
  if (Array.isArray(beds)) {
    return beds.map(bed => `${bed.count} ${bed.type}`).join(', ') || 'N/A';
  }
  if (typeof beds === 'string') {
    try {
      const parsed = JSON.parse(beds);
      if (Array.isArray(parsed)) {
        return parsed.map(bed => `${bed.count} ${bed.type}`).join(', ');
      }
    } catch {
      return beds;
    }
  }
  return String(beds);
}

export function buildDealContext(deal, calculatorMetrics, dealEvaluation) {
  if (!deal) return '';

  // Parse extraction_data if it's a string
  let ext = {};
  if (deal.extraction_data) {
    if (typeof deal.extraction_data === 'string') {
      try {
        ext = JSON.parse(deal.extraction_data);
      } catch {
        ext = {};
      }
    } else {
      ext = deal.extraction_data;
    }
  }

  const val = (v) => (v !== null && v !== undefined) ? String(v) : 'N/A';

  // Helper to get value from deal or extraction_data
  const get = (dealField, extField) => deal[dealField] || ext[extField || dealField];

  // Calculate occupancy from ADC if needed
  const bedCount = deal.bed_count || ext.bed_count;
  let occupancy = deal.current_occupancy;
  if (!occupancy && ext.average_daily_census && bedCount) {
    occupancy = ((ext.average_daily_census / bedCount) * 100).toFixed(1);
  } else if (ext.occupancy_pct) {
    occupancy = ext.occupancy_pct;
  }

  let context = `DEAL INFORMATION
================
Deal Name: ${deal.deal_name || deal.name || 'Unknown'}
Deal Type: ${deal.deal_type || 'N/A'}
Status: ${deal.deal_status || deal.status || 'N/A'}
Priority: ${deal.priority_level || 'N/A'}
Deal Source: ${deal.deal_source || 'N/A'}
Target Close Date: ${deal.target_close_date || 'N/A'}

FACILITY INFORMATION
====================
Facility Name: ${ext.facility_name || deal.facility_name || 'N/A'}
Facility Type: ${ext.facility_type || deal.facility_type || 'N/A'}
Location: ${ext.city || deal.city || 'N/A'}, ${ext.state || deal.state || 'N/A'} ${ext.zip_code || deal.zip_code || ''}
Address: ${ext.street_address || deal.street_address || 'N/A'}
Number of Beds: ${formatBeds(bedCount)}

FINANCIAL METRICS
=================
Purchase Price: ${deal.purchase_price ? `$${deal.purchase_price.toLocaleString()}` : 'N/A'}
Price Per Bed: ${deal.price_per_bed ? `$${deal.price_per_bed.toLocaleString()}` : 'N/A'}
Annual Revenue: ${(deal.annual_revenue || ext.annual_revenue) ? `$${(deal.annual_revenue || ext.annual_revenue).toLocaleString()}` : 'N/A'}
Total Expenses: ${ext.total_expenses ? `$${ext.total_expenses.toLocaleString()}` : 'N/A'}
Net Income: ${ext.net_income ? `$${ext.net_income.toLocaleString()}` : 'N/A'}
EBITDA: ${(deal.ebitda || ext.ebitda) ? `$${(deal.ebitda || ext.ebitda).toLocaleString()}` : 'N/A'}
EBITDA Margin: ${deal.ebitda_margin ? `${deal.ebitda_margin}%` : 'N/A'}
Revenue Multiple: ${deal.revenue_multiple ? `${deal.revenue_multiple}x` : 'N/A'}
EBITDA Multiple: ${deal.ebitda_multiple ? `${deal.ebitda_multiple}x` : 'N/A'}
Net Operating Income: ${deal.net_operating_income ? `$${deal.net_operating_income.toLocaleString()}` : 'N/A'}

OPERATIONAL METRICS
===================
Current Occupancy: ${occupancy ? `${occupancy}%` : 'N/A'}
Average Daily Census: ${ext.average_daily_census ? ext.average_daily_census.toFixed(1) : 'N/A'}
Average Daily Rate: ${deal.average_daily_rate ? `$${deal.average_daily_rate.toLocaleString()}` : 'N/A'}

PAYER MIX
=========
Medicaid: ${ext.medicaid_pct ? `${ext.medicaid_pct}%` : (deal.medicaid_percentage ? `${deal.medicaid_percentage}%` : 'N/A')}
Medicare: ${deal.medicare_percentage ? `${deal.medicare_percentage}%` : 'N/A'}
Private Pay: ${ext.private_pay_pct ? `${ext.private_pay_pct}%` : (deal.private_pay_percentage ? `${deal.private_pay_percentage}%` : 'N/A')}

REVENUE BREAKDOWN
=================
Medicaid Revenue: ${ext.medicaid_revenue ? `$${ext.medicaid_revenue.toLocaleString()}` : 'N/A'}
Medicare Revenue: ${ext.medicare_revenue ? `$${ext.medicare_revenue.toLocaleString()}` : 'N/A'}
Private Pay Revenue: ${ext.private_pay_revenue ? `$${ext.private_pay_revenue.toLocaleString()}` : 'N/A'}

INVESTMENT TARGETS
==================
Target IRR: ${deal.target_irr_percentage ? `${deal.target_irr_percentage}%` : 'N/A'}
Target Hold Period: ${deal.target_hold_period ? `${deal.target_hold_period} years` : 'N/A'}
Projected Cap Rate: ${deal.projected_cap_rate_percentage ? `${deal.projected_cap_rate_percentage}%` : 'N/A'}
Exit Multiple: ${deal.exit_multiple ? `${deal.exit_multiple}x` : 'N/A'}`;

  // Add calculator metrics if available
  if (calculatorMetrics) {
    const { inputs, computed, dataQuality } = calculatorMetrics;

    context += `

CALCULATOR METRICS (computed)
=============================
Data Completeness: ${val(dataQuality?.completenessScore)}%
Has Revenue Data: ${dataQuality?.hasRevenueData ? 'Yes' : 'No'}
Has EBITDA Data: ${dataQuality?.hasEBITDAData ? 'Yes' : 'No'}
Has Occupancy Data: ${dataQuality?.hasOccupancyData ? 'Yes' : 'No'}
Has Payer Mix Data: ${dataQuality?.hasPayerMixData ? 'Yes' : 'No'}

COMPUTED METRICS
----------------
Price Per Bed: ${val(computed?.pricePerBed)}
Revenue Multiple: ${val(computed?.revenueMultiple)}
EBITDA Multiple: ${val(computed?.ebitdaMultiple)}
EBITDAR Multiple: ${val(computed?.ebitdarMultiple)}
Cap Rate: ${val(computed?.capRate)}
EBITDA Margin: ${val(computed?.ebitdaMargin)}
Revenue Per Bed: ${val(computed?.revenuePerBed)}
EBITDA Per Bed: ${val(computed?.ebitdaPerBed)}
Rent Coverage Ratio: ${val(computed?.rentCoverageRatio)}
Stabilized Cap Rate: ${val(computed?.stabilizedCapRate)}
Exit Value at Multiple: ${val(computed?.exitValueAtMultiple)}`;

    if (computed?.payerMix) {
      context += `

PAYER MIX (computed)
--------------------
Medicare: ${val(computed.payerMix.medicare)}%
Medicaid: ${val(computed.payerMix.medicaid)}%
Private Pay: ${val(computed.payerMix.privatePay)}%
Other: ${val(computed.payerMix.other)}%`;
    }
  }

  // Add SNF evaluation results if available
  if (dealEvaluation) {
    const { summary, overallMetrics, riskAssessment, reitCompatibility } = dealEvaluation;

    context += `

SNF ALGORITHM ANALYSIS
======================
Deal Score: ${summary?.dealScore || 'N/A'}/100
Investment Recommendation: ${summary?.investmentRecommendation || 'N/A'}
Overall Risk Level: ${riskAssessment?.overallRisk || 'N/A'}

Risk Counts:
- High Risk Factors: ${riskAssessment?.riskCounts?.high || 0}
- Medium Risk Factors: ${riskAssessment?.riskCounts?.medium || 0}
- Low Risk Factors: ${riskAssessment?.riskCounts?.low || 0}

REIT Compatibility:
- Public REIT Yield: ${reitCompatibility?.publicREITYield ? `${(reitCompatibility.publicREITYield * 100).toFixed(2)}%` : 'N/A'}
- Private REIT Yield: ${reitCompatibility?.privateREITYield ? `${(reitCompatibility.privateREITYield * 100).toFixed(2)}%` : 'N/A'}
- Meets Public REIT Requirements: ${reitCompatibility?.meetsPublicREITRequirements ? 'Yes' : 'No'}
- Meets Private REIT Requirements: ${reitCompatibility?.meetsPrivateREITRequirements ? 'Yes' : 'No'}
- Coverage Ratio: ${reitCompatibility?.coverageRatio?.toFixed(2) || 'N/A'}
- Meets Coverage Ratio: ${reitCompatibility?.meetsCoverageRatio ? 'Yes' : 'No'}

Key Strengths:
${summary?.keyStrengths?.map(s => `- ${s}`).join('\n') || '- None identified'}

Key Concerns:
${summary?.keyConcerns?.map(c => `- ${c}`).join('\n') || '- None identified'}

Next Steps:
${summary?.nextSteps?.map(s => `- ${s}`).join('\n') || '- None identified'}`;
  }

  return context;
}

// =============================================================================
// QUICK ACTION ANALYSIS GENERATOR
// =============================================================================

export function generateQuickActionAnalysis(actionType, evaluation) {
  if (!evaluation) {
    return 'Unable to generate analysis. Please try running the SNF Algorithm Analysis first.';
  }

  const { facilities, overallMetrics, riskAssessment, reitCompatibility, recommendations, marketAnalysis, summary } = evaluation;

  switch (actionType) {
    case 'snf_analysis':
      const hasEstimatedData = facilities?.some(f => !f.hasActualData);
      return `🎯 **Investment Recommendation: ${summary?.investmentRecommendation || 'N/A'}**
📊 **Deal Score: ${summary?.dealScore || 'N/A'}/100**
${hasEstimatedData ? '⚠️ **Note: Some financial data estimated based on industry benchmarks**' : ''}

**Key Metrics:**
• Total Deal Value: $${overallMetrics?.totalPurchasePrice?.toLocaleString() || 'N/A'}
• Total Beds: ${overallMetrics?.totalBeds || 'N/A'}
• Weighted Average Cap Rate: ${overallMetrics?.weightedAverageCapRate ? `${(overallMetrics.weightedAverageCapRate * 100).toFixed(2)}%` : 'N/A'}
• Average Occupancy: ${overallMetrics?.weightedAverageOccupancy ? `${(overallMetrics.weightedAverageOccupancy * 100).toFixed(1)}%` : 'N/A'}

**Risk Assessment: ${riskAssessment?.overallRisk?.toUpperCase() || 'N/A'}**
• High Risk Factors: ${riskAssessment?.riskCounts?.high || 0}
• Medium Risk Factors: ${riskAssessment?.riskCounts?.medium || 0}

**REIT Compatibility:**
• Public REIT Yield: ${reitCompatibility?.publicREITYield ? `${(reitCompatibility.publicREITYield * 100).toFixed(2)}%` : 'N/A'}
• Coverage Ratio: ${reitCompatibility?.coverageRatio?.toFixed(2) || 'N/A'}
• Meets Requirements: ${reitCompatibility?.meetsPublicREITRequirements ? '✅' : '❌'}

**Key Strengths:**
${summary?.keyStrengths?.map(s => `• ${s}`).join('\n') || '• None identified'}

**Key Concerns:**
${summary?.keyConcerns?.map(c => `• ${c}`).join('\n') || '• None identified'}

Use the other quick actions to dive deeper into specific areas of analysis.`;

    case 'financial_performance':
      return `💰 **Financial Performance Analysis**

**Overall Financial Metrics:**
• Total Revenue: $${overallMetrics?.totalRevenue?.toLocaleString() || 'N/A'}
• Total EBITDA: $${overallMetrics?.totalEBITDA?.toLocaleString() || 'N/A'}
• Total EBITDAR: $${overallMetrics?.totalEBITDAR?.toLocaleString() || 'N/A'}
• Weighted Average Cap Rate: ${overallMetrics?.weightedAverageCapRate ? `${(overallMetrics.weightedAverageCapRate * 100).toFixed(2)}%` : 'N/A'}
• Average Price per Bed: $${overallMetrics?.averagePricePerBed?.toLocaleString() || 'N/A'}

**Cascadia Benchmark Comparison:**
• EBITDA Margin Target: 9%
• EBITDAR Margin Target: 23%
• Occupancy Target: 85%

**Performance Analysis:**
${facilities?.map(f => `
**${f.facilityName || 'Facility'}:**
• EBITDA Margin: ${f.t12mRevenue > 0 ? ((f.t12mEBITDA / f.t12mRevenue) * 100).toFixed(1) : 'N/A'}%
• Revenue per Bed: $${f.t12mRevenue > 0 && f.totalBeds > 0 ? (f.t12mRevenue / f.totalBeds).toLocaleString() : 'N/A'}
• Performance vs Target: ${f.performance?.ebitdaVsTarget >= 0.8 ? '✅ Good' : '❌ Needs Improvement'}
`).join('') || 'No facility data available'}`;

    case 'risk_assessment':
      return `⚠️ **Risk Assessment Analysis**

**Overall Risk Level: ${riskAssessment?.overallRisk?.toUpperCase() || 'N/A'}**

**Risk Breakdown:**
• High Risk Factors: ${riskAssessment?.riskCounts?.high || 0}
• Medium Risk Factors: ${riskAssessment?.riskCounts?.medium || 0}
• Low Risk Factors: ${riskAssessment?.riskCounts?.low || 0}

**Top Risk Factors:**
${riskAssessment?.topRisks?.map(risk => `
• **${risk.type?.toUpperCase() || 'UNKNOWN'}** (${risk.severity}): ${risk.description}
`).join('') || '• No high-risk factors identified'}

**Facility-Specific Risks:**
${facilities?.map(f => `
**${f.facilityName || 'Facility'}:**
${f.riskFactors?.map(rf => `• ${rf.description} (${rf.severity})`).join('\n') || '• No significant risks identified'}
`).join('') || 'No facility data available'}`;

    case 'reit_compatibility':
      return `🏢 **REIT Compatibility Analysis**

**Public REIT Requirements:**
• Current Yield: ${reitCompatibility?.publicREITYield ? `${(reitCompatibility.publicREITYield * 100).toFixed(2)}%` : 'N/A'}
• Required Yield: 9.0%
• Meets Requirements: ${reitCompatibility?.meetsPublicREITRequirements ? '✅ YES' : '❌ NO'}

**Private REIT Requirements:**
• Current Yield: ${reitCompatibility?.privateREITYield ? `${(reitCompatibility.privateREITYield * 100).toFixed(2)}%` : 'N/A'}
• Required Yield: 10.0%
• Meets Requirements: ${reitCompatibility?.meetsPrivateREITRequirements ? '✅ YES' : '❌ NO'}

**Coverage Ratio Analysis:**
• Current Coverage Ratio: ${reitCompatibility?.coverageRatio?.toFixed(2) || 'N/A'}
• Required Coverage Ratio: 1.4+
• Meets Requirements: ${reitCompatibility?.meetsCoverageRatio ? '✅ YES' : '❌ NO'}

**REIT Optimization Recommendations:**
${reitCompatibility?.meetsPublicREITRequirements ? '• Deal structure is REIT-compatible' : '• Consider operational improvements to meet REIT yield requirements'}
${reitCompatibility?.meetsCoverageRatio ? '• Coverage ratio meets REIT standards' : '• Improve cash flow to meet coverage ratio requirements'}`;

    case 'market_analysis':
      return `📊 **Market Analysis**

**Market Overview:**
${marketAnalysis?.map(ma => `
**${ma.facilityId} - ${ma.marketAnalysis?.city || 'Unknown'}, ${ma.marketAnalysis?.state || 'Unknown'}:**
• Medicare Rate: $${ma.marketAnalysis?.reimbursementRates?.medicare || 'N/A'}
• Medicaid Rate: $${ma.marketAnalysis?.reimbursementRates?.medicaid || 'N/A'}
• Market Trends: ${ma.marketAnalysis?.marketTrends?.occupancyTrend || 'Unknown'}
• Competition Level: ${ma.marketAnalysis?.marketTrends?.competitionTrend || 'Unknown'}
`).join('') || 'No market data available'}

**Competitive Position:**
${marketAnalysis?.map(ma => `
**${ma.facilityId}:**
• Market Share: ${ma.marketAnalysis?.competitivePosition?.marketShare || 'Unknown'}
• Competitive Advantages: ${ma.marketAnalysis?.competitivePosition?.competitiveAdvantages?.join(', ') || 'None identified'}
• Competitive Threats: ${ma.marketAnalysis?.competitivePosition?.competitiveThreats?.join(', ') || 'None identified'}
`).join('') || 'No competitive data available'}`;

    case 'investment_recommendation':
      return `🎯 **Investment Recommendation**

**Overall Recommendation: ${summary?.investmentRecommendation || 'N/A'}**
**Deal Score: ${summary?.dealScore || 'N/A'}/100**

**Key Strengths:**
${summary?.keyStrengths?.map(s => `• ${s}`).join('\n') || '• None identified'}

**Key Concerns:**
${summary?.keyConcerns?.map(c => `• ${c}`).join('\n') || '• None identified'}

**Recommended Next Steps:**
${summary?.nextSteps?.map(step => `• ${step}`).join('\n') || '• No specific steps identified'}

**Action Items:**
${recommendations?.map(rec => `
• **${rec.title}** (${rec.priority} priority)
  ${rec.description}
`).join('') || '• No specific recommendations'}`;

    case 'generate_report':
      return `📋 **Comprehensive Deal Report**

**Executive Summary:**
This deal analysis was conducted using Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm. The analysis evaluates financial performance, risk factors, REIT compatibility, and market conditions.

**Investment Recommendation: ${summary?.investmentRecommendation || 'N/A'}**
**Deal Score: ${summary?.dealScore || 'N/A'}/100**

**Financial Summary:**
• Total Investment: $${overallMetrics?.totalPurchasePrice?.toLocaleString() || 'N/A'}
• Total Beds: ${overallMetrics?.totalBeds || 'N/A'}
• Weighted Average Cap Rate: ${overallMetrics?.weightedAverageCapRate ? `${(overallMetrics.weightedAverageCapRate * 100).toFixed(2)}%` : 'N/A'}
• Average Occupancy: ${overallMetrics?.weightedAverageOccupancy ? `${(overallMetrics.weightedAverageOccupancy * 100).toFixed(1)}%` : 'N/A'}

**Risk Assessment: ${riskAssessment?.overallRisk?.toUpperCase() || 'N/A'}**
• High Risk Factors: ${riskAssessment?.riskCounts?.high || 0}
• Medium Risk Factors: ${riskAssessment?.riskCounts?.medium || 0}

**REIT Compatibility:**
• Public REIT Compatible: ${reitCompatibility?.meetsPublicREITRequirements ? '✅ YES' : '❌ NO'}
• Coverage Ratio Met: ${reitCompatibility?.meetsCoverageRatio ? '✅ YES' : '❌ NO'}

**Key Strengths:**
${summary?.keyStrengths?.map(s => `• ${s}`).join('\n') || '• None identified'}

**Key Concerns:**
${summary?.keyConcerns?.map(c => `• ${c}`).join('\n') || '• None identified'}

**Recommendations:**
${recommendations?.map(rec => `• ${rec.title}: ${rec.description}`).join('\n') || '• No specific recommendations'}

*Report generated by SNFalyze.ai using Cascadia Healthcare's SNF Deal Evaluation Algorithm*`;

    default:
      return 'Analysis not available. Please try again.';
  }
}

// =============================================================================
// AI CHAT FUNCTIONS
// =============================================================================

// Rate limiting helper with request queue
let lastRequestTime = 0;
let requestQueue = Promise.resolve();
const MIN_REQUEST_INTERVAL = 4000; // Minimum 4 seconds between requests (Gemini free tier: 15 RPM = 1 per 4s)

async function rateLimitedFetch(url, options, retries = 3) {
  // Queue requests to prevent concurrent calls
  const executeRequest = async () => {
    // Enforce minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          return response;
        }

        if (response.status === 429) {
          // Rate limited - wait and retry with exponential backoff
          const waitTime = Math.pow(2, attempt) * 3000; // 3s, 6s, 12s
          console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastRequestTime = Date.now(); // Reset timer after waiting
          continue;
        }

        // For other errors, throw immediately
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      } catch (err) {
        if (err.message.includes('Rate limit') || attempt === retries - 1) {
          throw err;
        }
        // Network error - retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
  };

  // Chain request to queue to prevent concurrent calls
  requestQueue = requestQueue.then(executeRequest).catch(executeRequest);
  return requestQueue;
}

function getSystemPrompt(dealContext) {
  return `You are SNFalyze.ai, an advanced M&A deal analysis assistant specializing in Skilled Nursing Facility (SNF) deals. You use Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm to provide sophisticated analysis.

Here is the complete deal data:

${dealContext}

Respond with actionable, insightful, and concise analysis based on SNF industry expertise. Focus on:
- Financial performance vs Cascadia benchmarks (9% EBITDA margin, 23% EBITDAR margin, 85% occupancy)
- Risk assessment and mitigation strategies
- REIT compatibility and optimization opportunities (9% public REIT yield, 10% private REIT yield, 1.4 coverage ratio)
- Market analysis and competitive positioning
- Turnaround potential and operational improvements
- Key performance indicators (KPIs) relevant to the question

Format your response with proper markdown using ## for headers when appropriate, bullet points (-) for lists, and bold (**text**) for emphasis. Be specific with numbers and percentages when available.`;
}

export async function sendChatMessage(userMessage, messages, deal, calculatorMetrics, dealEvaluation) {
  const dealContext = buildDealContext(deal, calculatorMetrics, dealEvaluation);

  // Build conversation history
  const conversationHistory = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  // Build full prompt
  const systemPrompt = getSystemPrompt(dealContext);
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'User' : 'SNFalyze'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = `${systemPrompt}

Previous conversation:
${historyText}

User's question: ${userMessage}

Respond helpfully and specifically to the user's question, referencing the deal data and analysis above.`;

  const response = await rateLimitedFetch(
    `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      })
    }
  );

  const data = await response.json();
  const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!aiText) {
    throw new Error('Invalid response format from Gemini API');
  }

  return aiText;
}

export async function generateInitialAnalysis(deal, calculatorMetrics, dealEvaluation) {
  const dealContext = buildDealContext(deal, calculatorMetrics, dealEvaluation);

  const prompt = `You are SNFalyze.ai, an advanced M&A deal analysis assistant specializing in Skilled Nursing Facility (SNF) deals. You use Cascadia Healthcare's proprietary SNF Deal Evaluation Algorithm to provide sophisticated analysis.

Here is the complete deal data:

${dealContext}

Please analyze this deal and provide a well-formatted comprehensive analysis with the following sections. Use clear headers, spacing, and bullet points for readability:

## 1. Financial Health Assessment
Provide a concise 2-3 sentence assessment of the deal's overall financial health.

## 2. Key Strengths
List 2-4 strengths as bullet points, each with a brief explanation.

## 3. Key Concerns & Red Flags
List 2-4 concerns as bullet points, each with a brief explanation of why it matters.

## 4. Benchmark Comparison
Compare key metrics to Cascadia benchmarks in a clear format:
- EBITDA Margin: [deal value] vs 9% benchmark
- EBITDAR Margin: [deal value] vs 23% benchmark
- Occupancy: [deal value] vs 85% benchmark

## 5. Recommended Next Steps
Provide 4-6 actionable next steps as numbered items, each on its own line.

## Summary
End with a 2-3 sentence overall recommendation.

Format your response with proper markdown using ## for headers, bullet points (-) for lists, and numbered lists (1. 2. 3.) for sequential steps. Include blank lines between sections for readability.`;

  const response = await rateLimitedFetch(
    `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await response.json();
  const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!aiText) {
    throw new Error('Invalid response format from Gemini API');
  }

  return aiText;
}

// =============================================================================
// MARKDOWN RENDERING
// =============================================================================

export function renderMarkdown(text) {
  if (!text) return '';

  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let inOrderedList = false;

  lines.forEach((line) => {
    if (inList && !line.trim().startsWith('-') && !line.trim().startsWith('*')) {
      html += '</ul>';
      inList = false;
    }
    if (inOrderedList && !/^\d+\./.test(line.trim())) {
      html += '</ol>';
      inOrderedList = false;
    }

    if (line.startsWith('## ')) {
      html += `<h3 class="snf-header">${line.substring(3)}</h3>`;
    } else if (line.startsWith('# ')) {
      html += `<h2 class="snf-header-main">${line.substring(2)}</h2>`;
    } else if (line.startsWith('**') && line.endsWith('**')) {
      html += `<h4 class="snf-subheader">${line.slice(2, -2)}</h4>`;
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        html += '<ul class="snf-list">';
        inList = true;
      }
      const content = line.trim().substring(2);
      html += `<li>${formatInlineMarkdown(content)}</li>`;
    } else if (/^\d+\.\s/.test(line.trim())) {
      if (!inOrderedList) {
        html += '<ol class="snf-ordered-list">';
        inOrderedList = true;
      }
      const content = line.trim().replace(/^\d+\.\s/, '');
      html += `<li>${formatInlineMarkdown(content)}</li>`;
    } else if (line.trim() === '') {
      html += '<div class="snf-spacer"></div>';
    } else {
      html += `<p class="snf-paragraph">${formatInlineMarkdown(line)}</p>`;
    }
  });

  if (inList) html += '</ul>';
  if (inOrderedList) html += '</ol>';

  return html;
}

function formatInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}
