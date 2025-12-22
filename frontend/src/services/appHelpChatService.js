/**
 * SNFalyze App Help Chat Service
 *
 * Provides a help chatbot that answers questions about SNFalyze features,
 * data sources, and calculations.
 * Features:
 * - Gemini AI integration (same as deal chat)
 * - Embedded knowledge base for all features
 * - Page context awareness
 * - Persistent conversation storage (IndexedDB)
 * - Quick actions for common help topics
 */

// =============================================================================
// CONFIGURATION
// =============================================================================
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_CHATBOT_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// =============================================================================
// IndexedDB PERSISTENCE (separate from deal conversations)
// =============================================================================
const DB_NAME = 'SNFalyzeHelpDB';
const DB_VERSION = 1;
const STORE_NAME = 'helpConversations';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveHelpConversation(messages) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: 'app-help', messages, lastUpdated: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error saving help conversation:', err);
  }
}

export async function loadHelpConversation() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('app-help');
      req.onsuccess = () => resolve(req.result ? req.result.messages : null);
      req.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error loading help conversation:', err);
    return null;
  }
}

export async function clearHelpConversation() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete('app-help');
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('Error clearing help conversation:', err);
  }
}

// =============================================================================
// QUICK ACTIONS CONFIGURATION
// =============================================================================
export const HELP_QUICK_ACTIONS = [
  { label: 'What is this page?', color: 'bg-blue-500', icon: '📍', action: 'explain_current_page' },
  { label: 'Data Sources', color: 'bg-green-500', icon: '📊', action: 'data_sources' },
  { label: 'Star Ratings', color: 'bg-yellow-500', icon: '⭐', action: 'star_ratings' },
  { label: 'VBP Explained', color: 'bg-purple-500', icon: '💰', action: 'vbp_explained' },
  { label: 'F-Tags & Deficiencies', color: 'bg-red-500', icon: '⚠️', action: 'ftags_explained' },
  { label: 'Staffing & Wages', color: 'bg-teal-500', icon: '👥', action: 'staffing_wages' },
  { label: 'SNF vs ALF Data', color: 'bg-orange-500', icon: '🏥', action: 'snf_alf_data' },
  { label: 'Update Schedule', color: 'bg-pink-500', icon: '🗓️', action: 'update_schedule' }
];

// =============================================================================
// KNOWLEDGE BASE
// =============================================================================
export const KNOWLEDGE_BASE = {
  pages: {
    '/dashboard': {
      name: 'Dashboard',
      description: 'Central hub for deal pipeline management',
      features: [
        'Kanban board with drag-and-drop deal status updates',
        'Deal stages: Initial Review, Due Diligence, Under LOI, Closing',
        'Recent activity feed showing team actions',
        'Map view with geographic facility distribution',
        'Quick stats showing deal counts and values by stage'
      ],
      dataSource: 'Internal deal database (user-created deals)'
    },
    '/facility-metrics': {
      name: 'Facility Metrics',
      description: 'Comprehensive CMS facility analysis with 9 sub-tabs',
      tabs: {
        snapshot: {
          description: 'At-a-glance health check of a facility',
          metrics: ['Star ratings (1-5 stars)', 'Staffing HPRD by role', 'Occupancy rate', 'Deficiency counts and severity'],
          dataSource: 'CMS Provider Information dataset, updated monthly'
        },
        trends: {
          description: '12-24 month historical performance tracking',
          metrics: ['Rating trajectory over time', 'Staffing trends', 'Occupancy patterns', 'Deficiency trends'],
          dataSource: 'CMS monthly snapshots (historical archive)'
        },
        benchmarks: {
          description: 'Comparison vs peers and benchmarks',
          metrics: ['State average comparison', 'National average comparison', 'Chain average comparison', 'Custom peer group analysis'],
          dataSource: 'Calculated from full CMS facility population'
        },
        risk: {
          description: 'Composite risk scoring and analysis',
          metrics: ['Health inspection risk', 'Regulatory risk', 'Staffing risk', 'Financial indicators'],
          dataSource: 'Derived from facility attributes and compliance history'
        },
        vbp: {
          description: 'Value-Based Purchasing performance and rankings',
          metrics: ['VBP performance score', 'National/state/chain rankings', 'Estimated dollar impact', '6-year historical trends'],
          calculation: 'VBP Score = 30% Readmission Measure + 70% Healthcare-Associated Infections. 2% of Medicare Part A payments at risk. Multiplier ranges 0.6x to 1.4x.',
          dataSource: 'CMS SNF VBP Program, updated annually in October'
        },
        ownership: {
          description: 'Chain and ownership information',
          metrics: ['Parent organization', 'Portfolio composition', 'Ownership type', 'Chain peer comparison'],
          dataSource: 'CMS ownership data'
        },
        competition: {
          description: 'Nearby competing facilities analysis',
          metrics: ['Facilities within radius', 'Distance-based rankings', 'Competitor ratings comparison'],
          dataSource: 'Geographic proximity query on CMS data'
        },
        reports: {
          description: 'Exportable PDF and Excel reports',
          metrics: ['Customizable report builder', 'Combined metrics export'],
          dataSource: 'Client-side generation from facility data'
        },
        survey: {
          description: 'CMS survey deficiency intelligence',
          metrics: ['F-tag citation history', 'Scope and severity breakdown', 'Survey dates and findings'],
          dataSource: 'CMS health citations, rolling 3-year window'
        }
      }
    },
    '/market-analysis': {
      name: 'Market Analysis',
      description: 'Market dynamics and competitive landscape analysis',
      features: [
        'County demographics (population, age, income, education)',
        'Competitor analysis within geographic radius',
        'Supply metrics (beds per capita, facility density)',
        'Market scoring with opportunity indicators',
        'State and national benchmarks'
      ],
      dataSource: 'US Census ACS 5-Year Estimates, CMS facility data'
    },
    '/ownership-research': {
      name: 'Ownership Research',
      description: 'Chain and ownership portfolio analysis',
      features: [
        'Top SNF chains nationwide rankings',
        'Ownership search with filters',
        'Portfolio composition by state',
        'Average ratings by ownership group',
        'Natural language facility search'
      ],
      dataSource: 'CMS ownership data, Market database'
    },
    '/survey-analytics': {
      name: 'Survey Analytics',
      description: 'National and state-level survey deficiency trends',
      features: [
        'Year-to-date survey statistics',
        'Monthly citation trends',
        'Top F-tag analysis',
        'State comparison charts',
        'Immediate Jeopardy rates'
      ],
      dataSource: 'CMS health citations database'
    },
    '/ma-intelligence': {
      name: 'M&A Intelligence',
      description: 'Market and acquisition intelligence dashboard',
      features: [
        'Transaction activity tracking',
        'Market opportunity identification',
        'Deal comparable analysis'
      ],
      dataSource: 'Internal deal database, market data'
    },
    '/data-dictionary': {
      name: 'Data Dictionary',
      description: 'Field definitions and data documentation',
      features: [
        'All CMS field definitions',
        'Data source explanations',
        'Update schedules'
      ],
      dataSource: 'CMS Data Dictionary documentation'
    }
  },

  concepts: {
    starRatings: {
      name: 'CMS Five-Star Quality Rating System',
      definition: 'A 1-5 star rating system used by CMS to help consumers compare nursing homes',
      components: {
        overall: 'Composite rating combining all three components with Health Inspection weighted most heavily',
        healthInspection: 'Based on deficiencies from last 3 standard surveys plus complaint surveys. Weighted most heavily in overall score.',
        staffing: 'Based on RN hours per resident day and total nursing hours. Adjusted for case mix.',
        qualityMeasures: 'Based on 15+ MDS-derived and claims-based quality measures'
      },
      calculation: 'Overall = weighted combination where Health Inspection has highest weight, followed by Staffing, then Quality',
      dataSource: 'CMS Nursing Home Compare',
      updateFrequency: 'Monthly'
    },
    hprd: {
      name: 'Hours Per Resident Day (HPRD)',
      definition: 'Staffing intensity measure showing total nursing hours divided by resident days',
      calculation: 'HPRD = Total nursing hours / Total resident days',
      categories: {
        total: 'All nursing staff combined (RN + LPN + CNA)',
        rn: 'Registered Nurses only',
        lpn: 'Licensed Practical/Vocational Nurses',
        cna: 'Certified Nursing Assistants'
      },
      benchmarks: {
        totalHPRD: '4.1 hours (recommended minimum)',
        rnHPRD: '0.75 hours (recommended minimum)',
        cnaHPRD: '2.5 hours'
      },
      dataSource: 'Payroll-Based Journal (PBJ) submissions',
      updateFrequency: 'Quarterly'
    },
    fTags: {
      name: 'Federal Tags (F-Tags)',
      definition: 'Regulatory codes identifying specific violations found during state surveys',
      format: 'F-XXX where XXX is a 3-digit code corresponding to a federal regulation',
      severityLevels: {
        'A-C': 'No actual harm - isolated instances or potential for minimal harm',
        'D-F': 'Minimal harm or potential for actual harm',
        'G-I': 'Actual harm that is not immediate jeopardy',
        'J-K-L': 'Immediate Jeopardy (IJ) - serious harm or death likely'
      },
      scopeCategories: {
        'Isolated': 'Affects one or a very limited number of residents',
        'Pattern': 'Affects more than a limited number of residents',
        'Widespread': 'Affects a large number of residents or pervasive problems'
      },
      dataSource: 'State Survey Agency inspections',
      updateFrequency: 'After each survey (rolling 3-year window displayed)'
    },
    vbp: {
      name: 'Value-Based Purchasing (VBP)',
      definition: 'CMS program that adjusts Medicare payments based on quality performance',
      measures: {
        snfrm: {
          name: 'SNF 30-Day All-Cause Readmission Measure (SNFRM)',
          weight: '30%',
          description: 'Risk-adjusted rate of unplanned hospital readmissions within 30 days of SNF discharge'
        },
        snfHai: {
          name: 'SNF Healthcare-Associated Infections (SNF HAI)',
          weight: '70%',
          description: 'Infections acquired during SNF stay that result in hospitalization'
        }
      },
      scoring: {
        achievement: 'Compare to 50th percentile threshold (baseline year)',
        improvement: 'Compare to facility\'s own baseline performance',
        finalScore: 'Higher of achievement or improvement score is used'
      },
      financialImpact: {
        atRisk: '2% of Medicare Part A payments',
        multiplierRange: '0.6x to 1.4x based on performance',
        incentivePool: 'Funded by 2% withhold from all SNFs'
      },
      reportingSchedule: 'Scores published annually in October, apply to following fiscal year (Oct-Sept)',
      dataSource: 'CMS SNF VBP Program'
    },
    occupancy: {
      name: 'Occupancy Rate',
      definition: 'Percentage of available beds that are occupied',
      calculation: 'Occupancy = (Residents / Licensed Beds) × 100',
      benchmarks: {
        cascadia: '85% (Cascadia Healthcare target)',
        national: 'Varies by market, typically 78-88%'
      },
      dataSource: 'CMS Provider Information',
      updateFrequency: 'Monthly'
    }
  },

  dataSources: {
    cmsProviderInfo: {
      name: 'CMS Provider Information Dataset',
      description: 'Core facility data from CMS Nursing Home Compare',
      coverage: '15,000+ SNF facilities nationwide',
      fields: ['Star ratings', 'Bed counts', 'Occupancy', 'Ownership', 'Chain affiliation', 'Certification status'],
      updateFrequency: 'Monthly',
      url: 'https://data.cms.gov/provider-data/topics/nursing-homes'
    },
    cmsPbj: {
      name: 'Payroll-Based Journal (PBJ)',
      description: 'Staffing data submitted directly by facilities',
      fields: ['Staffing hours by category (RN, LPN, CNA)', 'Turnover rates', 'Weekend staffing ratios', 'Administrator tenure'],
      updateFrequency: 'Quarterly (submitted daily by facilities)',
      notes: 'Required electronic submission since 2016'
    },
    cmsVbp: {
      name: 'SNF Value-Based Purchasing',
      description: 'Performance scores and payment adjustments',
      fields: ['Performance scores', 'National/state rankings', 'Incentive multipliers', 'Baseline vs performance comparison'],
      updateFrequency: 'Annual (published October)',
      fiscalYear: 'FY2025 scores apply Oct 2024 - Sept 2025'
    },
    cmsSurveys: {
      name: 'State Survey Deficiencies',
      description: 'Health inspection results and citations',
      fields: ['F-tags', 'Scope and severity codes', 'Survey dates', 'Correction status'],
      updateFrequency: 'Monthly (rolling 3-year window)',
      surveyTypes: ['Standard inspections', 'Complaint surveys', 'Infection control surveys']
    },
    alfFacilities: {
      name: 'Assisted Living Facilities Database',
      description: 'Reference database for ALF facilities',
      coverage: '44,625 ALF facilities across all 50 states',
      source: 'State licensing databases (2021 data)',
      fields: ['Facility name and address', 'Licensed bed capacity', 'Licensee/ownership', 'GPS coordinates', 'County demographics'],
      useCases: ['Auto-populate deal data', 'Geographic facility search', 'Market analysis'],
      updateFrequency: '2021 snapshot (update planned)',
      notes: 'Unlike SNF data, ALF data is not federally reported. This is compiled from state sources.'
    },
    blsOews: {
      name: 'BLS Occupational Employment and Wage Statistics (OEWS)',
      description: 'Labor market wage data for healthcare occupations',
      source: 'Bureau of Labor Statistics',
      coverage: 'All 50 states',
      occupations: [
        'Registered Nurses (29-1141)',
        'Licensed Practical Nurses (29-2061)',
        'Nursing Assistants (31-1131)',
        'Physical Therapists (29-1123)',
        'Physical Therapist Assistants (31-2021)',
        'Occupational Therapists (29-1122)',
        'Speech-Language Pathologists (29-1127)',
        'Medical/Health Services Managers (11-9111)'
      ],
      fields: ['Median hourly wage', 'Mean hourly wage', 'Employment count', 'Wage percentiles'],
      updateFrequency: 'Annual (May data, released in spring)',
      currentData: 'May 2024',
      useCases: ['Labor cost benchmarking', 'Market wage comparisons', 'Staffing cost modeling']
    },
    censusDemographics: {
      name: 'US Census ACS 5-Year Estimates',
      description: 'County-level demographic data',
      fields: ['Total population', 'Age distribution (esp. 65+)', 'Median household income', 'Education levels', 'Housing data'],
      updateFrequency: 'Annual',
      useCases: ['Market analysis', 'Demand projection', 'Competitor analysis context']
    },
    cmsWageIndex: {
      name: 'CMS SNF PPS Wage Index',
      description: 'Geographic wage adjustment factors for Medicare payments',
      fields: ['CBSA wage index', 'Rural floor adjustments'],
      updateFrequency: 'Annual',
      useCases: ['Medicare payment modeling', 'Labor market cost comparison']
    }
  },

  updateSchedule: {
    monthly: ['Star ratings', 'Provider information', 'Survey deficiencies'],
    quarterly: ['Staffing (PBJ)', 'Long-stay quality measures', 'Short-stay quality measures'],
    annual: ['VBP scores (October)', 'BLS wages (May data)', 'Census demographics', 'Wage index'],
    notes: 'CMS public data has 1-6 month lag depending on measure type'
  }
};

// =============================================================================
// PAGE CONTEXT MAPPING
// =============================================================================
export const PAGE_CONTEXT_MAP = {
  '/dashboard': { name: 'Dashboard', helpTopics: ['deal_pipeline', 'kanban', 'activity'] },
  '/facility-metrics': { name: 'Facility Metrics', tabs: ['snapshot', 'trends', 'benchmarks', 'risk', 'vbp', 'ownership', 'competition', 'reports', 'survey'] },
  '/market-analysis': { name: 'Market Analysis', helpTopics: ['demographics', 'competition', 'supply'] },
  '/ownership-research': { name: 'Ownership Research', helpTopics: ['chains', 'search', 'portfolio'] },
  '/survey-analytics': { name: 'Survey Analytics', helpTopics: ['ftags', 'trends', 'states'] },
  '/ma-intelligence': { name: 'M&A Intelligence', helpTopics: ['transactions', 'opportunities'] },
  '/data-dictionary': { name: 'Data Dictionary', helpTopics: ['fields', 'sources'] }
};

// =============================================================================
// CONTEXT BUILDING
// =============================================================================
export function buildHelpContext(currentPage, currentTab) {
  const pagePath = currentPage?.startsWith('/facility-metrics') ? '/facility-metrics' : currentPage;
  const pageInfo = KNOWLEDGE_BASE.pages[pagePath];

  let context = `CURRENT USER LOCATION
=====================
Page: ${pageInfo?.name || currentPage || 'Unknown'}
${currentTab ? `Active Tab: ${currentTab}` : ''}

`;

  if (pageInfo) {
    context += `PAGE DESCRIPTION
================
${pageInfo.description}

`;
    if (pageInfo.features) {
      context += `KEY FEATURES:
${pageInfo.features.map(f => `- ${f}`).join('\n')}

Data Source: ${pageInfo.dataSource}
`;
    }
    if (pageInfo.tabs && currentTab && pageInfo.tabs[currentTab]) {
      const tabInfo = pageInfo.tabs[currentTab];
      context += `
CURRENT TAB: ${currentTab.toUpperCase()}
${tabInfo.description}

Metrics Shown:
${tabInfo.metrics.map(m => `- ${m}`).join('\n')}

${tabInfo.calculation ? `Calculation: ${tabInfo.calculation}\n` : ''}
Data Source: ${tabInfo.dataSource}
`;
    }
  }

  return context;
}

// =============================================================================
// QUICK ACTION RESPONSE GENERATOR
// =============================================================================
export function generateQuickActionResponse(actionType, currentPage, currentTab) {
  switch (actionType) {
    case 'explain_current_page':
      const pagePath = currentPage?.startsWith('/facility-metrics') ? '/facility-metrics' : currentPage;
      const pageInfo = KNOWLEDGE_BASE.pages[pagePath];
      if (!pageInfo) {
        return `You're currently on ${currentPage || 'an unknown page'}. I don't have specific documentation for this page yet, but feel free to ask me any questions!`;
      }

      let response = `## ${pageInfo.name}\n\n${pageInfo.description}\n\n**Key Features:**\n`;
      if (pageInfo.features) {
        response += pageInfo.features.map(f => `- ${f}`).join('\n');
      } else if (pageInfo.tabs) {
        response += Object.entries(pageInfo.tabs).map(([tab, info]) => `- **${tab}**: ${info.description}`).join('\n');
      }
      response += `\n\n**Data Source:** ${pageInfo.dataSource || 'Various'}`;
      return response;

    case 'data_sources':
      return `## Data Sources in SNFalyze

**SNF Data (CMS Nursing Home Compare):**
- Provider Information: 15,000+ facilities, updated **monthly**
- Staffing (PBJ): Hours and turnover, updated **quarterly**
- Quality Measures: MDS-derived metrics, updated **quarterly**
- Survey Deficiencies: Rolling 3-year window, updated **monthly**
- VBP Scores: Performance rankings, updated **annually** (October)

**ALF Data:**
- Assisted Living Facilities: 44,625 facilities from state licensing databases
- Data vintage: 2021 (update planned)
- Includes: capacity, coordinates, county demographics

**Labor Market Data (BLS OEWS):**
- State-level wages for 8 healthcare occupations
- Includes: RN, LPN, CNA, PT, OT, SLP, Health Services Managers
- Current data: May 2024, updated **annually**

**Demographics (Census ACS):**
- County-level population, age, income, education
- Updated **annually**

*All CMS data has 1-6 month lag depending on measure type.*`;

    case 'star_ratings':
      const ratings = KNOWLEDGE_BASE.concepts.starRatings;
      return `## ${ratings.name}

${ratings.definition}

**Components:**
- **Overall Rating**: ${ratings.components.overall}
- **Health Inspection**: ${ratings.components.healthInspection}
- **Staffing**: ${ratings.components.staffing}
- **Quality Measures**: ${ratings.components.qualityMeasures}

**How It's Calculated:**
${ratings.calculation}

**Update Frequency:** ${ratings.updateFrequency}

*Source: ${ratings.dataSource}*`;

    case 'vbp_explained':
      const vbp = KNOWLEDGE_BASE.concepts.vbp;
      return `## ${vbp.name}

${vbp.definition}

**Measure Components:**
- **${vbp.measures.snfrm.name}** (${vbp.measures.snfrm.weight}): ${vbp.measures.snfrm.description}
- **${vbp.measures.snfHai.name}** (${vbp.measures.snfHai.weight}): ${vbp.measures.snfHai.description}

**Scoring Methodology:**
- Achievement: ${vbp.scoring.achievement}
- Improvement: ${vbp.scoring.improvement}
- Final: ${vbp.scoring.finalScore}

**Financial Impact:**
- ${vbp.financialImpact.atRisk} at risk
- Multiplier range: ${vbp.financialImpact.multiplierRange}

**Reporting Schedule:**
${vbp.reportingSchedule}

*Source: ${vbp.dataSource}*`;

    case 'ftags_explained':
      const ftags = KNOWLEDGE_BASE.concepts.fTags;
      return `## ${ftags.name}

${ftags.definition}

**Format:** ${ftags.format}

**Severity Levels:**
- **A-C**: ${ftags.severityLevels['A-C']}
- **D-F**: ${ftags.severityLevels['D-F']}
- **G-I**: ${ftags.severityLevels['G-I']}
- **J-K-L**: ${ftags.severityLevels['J-K-L']} *(Most serious)*

**Scope Categories:**
- **Isolated**: ${ftags.scopeCategories.Isolated}
- **Pattern**: ${ftags.scopeCategories.Pattern}
- **Widespread**: ${ftags.scopeCategories.Widespread}

**Update Frequency:** ${ftags.updateFrequency}

*Source: ${ftags.dataSource}*`;

    case 'staffing_wages':
      const hprd = KNOWLEDGE_BASE.concepts.hprd;
      const bls = KNOWLEDGE_BASE.dataSources.blsOews;
      return `## Staffing Metrics & Wage Data

### Hours Per Resident Day (HPRD)
${hprd.definition}

**Calculation:** ${hprd.calculation}

**Benchmarks:**
- Total HPRD: ${hprd.benchmarks.totalHPRD}
- RN HPRD: ${hprd.benchmarks.rnHPRD}
- CNA HPRD: ${hprd.benchmarks.cnaHPRD}

*Source: ${hprd.dataSource}, updated ${hprd.updateFrequency}*

---

### BLS Wage Data
${bls.description}

**Occupations Tracked:**
${bls.occupations.map(o => `- ${o}`).join('\n')}

**Current Data:** ${bls.currentData}
**Update Frequency:** ${bls.updateFrequency}

*Use Cases: ${bls.useCases.join(', ')}*`;

    case 'snf_alf_data':
      const snf = KNOWLEDGE_BASE.dataSources.cmsProviderInfo;
      const alf = KNOWLEDGE_BASE.dataSources.alfFacilities;
      return `## SNF vs ALF Data Comparison

### SNF (Skilled Nursing Facility) Data
**Source:** ${snf.name}
**Coverage:** ${snf.coverage}
**Update Frequency:** ${snf.updateFrequency}

**Fields Available:**
${snf.fields.map(f => `- ${f}`).join('\n')}

*Federally mandated reporting via CMS*

---

### ALF (Assisted Living Facility) Data
**Source:** ${alf.source}
**Coverage:** ${alf.coverage}
**Update Frequency:** ${alf.updateFrequency}

**Fields Available:**
${alf.fields.map(f => `- ${f}`).join('\n')}

**Use Cases:**
${alf.useCases.map(u => `- ${u}`).join('\n')}

**Note:** ${alf.notes}`;

    case 'update_schedule':
      const schedule = KNOWLEDGE_BASE.updateSchedule;
      return `## Data Update Schedule

**Monthly Updates:**
${schedule.monthly.map(s => `- ${s}`).join('\n')}

**Quarterly Updates:**
${schedule.quarterly.map(s => `- ${s}`).join('\n')}

**Annual Updates:**
${schedule.annual.map(s => `- ${s}`).join('\n')}

**Note:** ${schedule.notes}

---

**Key Dates:**
- VBP Scores: Published each October
- BLS Wages: May data released in spring
- Census: Annual estimates released December`;

    default:
      return 'I don\'t have a specific quick response for that action. Please ask me a question and I\'ll do my best to help!';
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
export function getWelcomeMessage() {
  return {
    id: Date.now(),
    role: 'assistant',
    title: 'SNFalyze Help',
    content: `Hi! I'm here to help you understand SNFalyze's features and data.

I can answer questions about:
- **Page Features**: What each tab shows and how to use it
- **Data Sources**: Where data comes from (CMS, BLS, Census)
- **Calculations**: How ratings, VBP scores, and metrics are computed
- **Update Schedules**: When data is refreshed

Use the quick action buttons above, or ask me anything!`,
    timestamp: new Date()
  };
}

// =============================================================================
// AI CHAT FUNCTIONS
// =============================================================================

// Rate limiting (shared pattern from snfalyzeChatService)
let lastRequestTime = 0;
let requestQueue = Promise.resolve();
const MIN_REQUEST_INTERVAL = 4000;

async function rateLimitedFetch(url, options, retries = 3) {
  const executeRequest = async () => {
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
          const waitTime = Math.pow(2, attempt) * 3000;
          console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastRequestTime = Date.now();
          continue;
        }

        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      } catch (err) {
        if (err.message.includes('Rate limit') || attempt === retries - 1) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
  };

  requestQueue = requestQueue.then(executeRequest).catch(executeRequest);
  return requestQueue;
}

function getHelpSystemPrompt(pageContext) {
  return `You are the SNFalyze Help Assistant, designed to help users understand the SNFalyze M&A Deal Analysis Platform.

${pageContext}

KNOWLEDGE BASE:
${JSON.stringify(KNOWLEDGE_BASE, null, 2)}

RESPONSE GUIDELINES:
1. Be concise and specific to the user's question
2. When explaining data, ALWAYS mention the SOURCE and UPDATE FREQUENCY
3. For calculations (like VBP, star ratings), provide the formula
4. Reference specific UI elements when helpful
5. If unsure, acknowledge limitations and suggest where to find more info
6. Use markdown formatting: ## headers, bullet points, **bold** for emphasis
7. Do NOT discuss specific deals or investment advice - redirect to the SNFalyze AI Assistant for that

TONE: Professional, helpful, educational

If the user asks about a feature that doesn't exist yet, acknowledge this honestly and suggest alternatives if possible.`;
}

export async function sendHelpMessage(userMessage, messages, currentPage, currentTab) {
  const pageContext = buildHelpContext(currentPage, currentTab);

  const conversationHistory = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  const systemPrompt = getHelpSystemPrompt(pageContext);
  const historyText = conversationHistory
    .map(m => `${m.role === 'user' ? 'User' : 'Help Assistant'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = `${systemPrompt}

Previous conversation:
${historyText}

User's question: ${userMessage}

Respond helpfully and specifically to the user's question. Use the knowledge base to provide accurate information about SNFalyze features, data sources, and calculations.`;

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

// =============================================================================
// MARKDOWN RENDERING (shared from snfalyzeChatService)
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
      html += `<h3 class="help-header">${line.substring(3)}</h3>`;
    } else if (line.startsWith('# ')) {
      html += `<h2 class="help-header-main">${line.substring(2)}</h2>`;
    } else if (line.startsWith('### ')) {
      html += `<h4 class="help-subheader">${line.substring(4)}</h4>`;
    } else if (line.startsWith('**') && line.endsWith('**')) {
      html += `<h4 class="help-bold-header">${line.slice(2, -2)}</h4>`;
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        html += '<ul class="help-list">';
        inList = true;
      }
      const content = line.trim().substring(2);
      html += `<li>${formatInlineMarkdown(content)}</li>`;
    } else if (/^\d+\.\s/.test(line.trim())) {
      if (!inOrderedList) {
        html += '<ol class="help-ordered-list">';
        inOrderedList = true;
      }
      const content = line.trim().replace(/^\d+\.\s/, '');
      html += `<li>${formatInlineMarkdown(content)}</li>`;
    } else if (line.trim() === '---') {
      html += '<hr class="help-divider" />';
    } else if (line.trim() === '') {
      html += '<div class="help-spacer"></div>';
    } else {
      html += `<p class="help-paragraph">${formatInlineMarkdown(line)}</p>`;
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
