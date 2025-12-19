const fs = require('fs');
const path = require('path');

const dataDir = __dirname;

// Source configurations
const sourceConfigs = [
  {
    id: "cms_provider_info",
    name: "CMS Provider Information",
    description: "General information on currently active nursing homes, including certified beds, star ratings, staffing data, and Five-Star Rating System inputs.",
    facilityType: "SNF",
    category: "Facility & Operational",
    usedInTabs: ["Facility Metrics", "Overview", "Market Dynamics"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_ProviderInfo_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "2018-present",
    geographicScope: "National",
    granularity: "Facility-level",
    knownLimitations: ["Does not include non-Medicare-certified SNFs"],
    isFullyDocumented: true,
    fieldsFile: "cms_provider_info_fields.json"
  },
  {
    id: "cms_health_deficiencies",
    name: "CMS Health Deficiencies",
    description: "Health citations from standard and complaint inspections in the last three survey cycles.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Risk Analysis"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/r5ix-sfxw",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_HealthCitations_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "Last 3 inspection cycles",
    geographicScope: "National",
    granularity: "Citation-level",
    knownLimitations: ["Includes citations under IDR/IIDR dispute"],
    isFullyDocumented: true,
    fieldsFile: "cms_health_deficiencies_fields.json"
  },
  {
    id: "cms_fire_safety",
    name: "CMS Fire Safety Deficiencies",
    description: "Fire safety and life safety code citations from inspections in the last three survey cycles.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Risk Analysis"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/ifjz-ge4w",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_FireSafetyCitations_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "Last 3 inspection cycles",
    geographicScope: "National",
    granularity: "Citation-level",
    knownLimitations: ["K-tags and E-tags have different version dates"],
    isFullyDocumented: true,
    fieldsFile: "cms_fire_safety_fields.json"
  },
  {
    id: "cms_survey_summary",
    name: "CMS Survey Summary",
    description: "Summary counts of health and fire safety deficiencies by category for each inspection cycle.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Overview"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/tbry-pc2d",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_InspectionsSummary_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "Last 3 inspection cycles",
    geographicScope: "National",
    granularity: "Facility-cycle level",
    knownLimitations: [],
    isFullyDocumented: true,
    fieldsFile: "cms_survey_summary_fields.json"
  },
  {
    id: "cms_mds_quality",
    name: "CMS MDS Quality Measures",
    description: "MDS-based quality measures including quarterly scores for long-stay and short-stay residents.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Quality Analysis"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/djen-97ju",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_QualityMsr_MDS_MonYYYY.csv",
    updateFrequency: "Quarterly",
    lastUpdated: null,
    dataLag: "~3 months",
    historicalRange: "4 quarters rolling",
    geographicScope: "National",
    granularity: "Facility-measure level",
    knownLimitations: ["Some measures suppressed for small sample sizes"],
    isFullyDocumented: true,
    fieldsFile: "cms_mds_quality_fields.json"
  },
  {
    id: "cms_claims_quality",
    name: "CMS Claims-Based Quality Measures",
    description: "Quality measures derived from Medicare claims data including rehospitalization and ED visits.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Quality Analysis"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/xcdc-v8bm",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_QualityMsr_Claims_MonYYYY.csv",
    updateFrequency: "Quarterly",
    lastUpdated: null,
    dataLag: "~6 months",
    historicalRange: "Rolling measurement period",
    geographicScope: "National",
    granularity: "Facility-measure level",
    knownLimitations: ["Based on fee-for-service Medicare claims only"],
    isFullyDocumented: true,
    fieldsFile: "cms_claims_quality_fields.json"
  },
  {
    id: "cms_state_averages",
    name: "CMS State & National Averages",
    description: "State and national averages for star ratings, staffing, quality measures, and penalties.",
    facilityType: "SNF",
    category: "Market & Demographics",
    usedInTabs: ["Market Dynamics", "Benchmarking"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/xcdc-v8bm",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_StateAverages_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "Current period",
    geographicScope: "State and National",
    granularity: "State/Nation level",
    knownLimitations: [],
    isFullyDocumented: true,
    fieldsFile: "cms_state_averages_fields.json"
  },
  {
    id: "cms_ownership",
    name: "CMS Ownership Data",
    description: "Ownership and management information including individual and organizational owners with 5%+ interest.",
    facilityType: "SNF",
    category: "Facility & Operational",
    usedInTabs: ["Overview", "Ownership Analysis"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/y2hd-n93e",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_Ownership_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "Current ownership",
    geographicScope: "National",
    granularity: "Owner-facility level",
    knownLimitations: ["Only includes owners with 5%+ interest", "Self-reported data"],
    isFullyDocumented: true,
    fieldsFile: "cms_ownership_fields.json"
  },
  {
    id: "cms_penalties",
    name: "CMS Penalties",
    description: "Federal penalties including fines and payment denials imposed on nursing homes.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Risk Analysis"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/g6vv-u9sr",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "NH_Penalties_MonYYYY.csv",
    updateFrequency: "Monthly",
    lastUpdated: null,
    dataLag: "~2-4 weeks",
    historicalRange: "Last 3 years",
    geographicScope: "National",
    granularity: "Penalty-level",
    knownLimitations: ["Does not include state-only penalties"],
    isFullyDocumented: true,
    fieldsFile: "cms_penalties_fields.json"
  },
  {
    id: "cms_snf_qrp",
    name: "CMS SNF Quality Reporting Program (Provider)",
    description: "SNF QRP provider-level quality measures required under the IMPACT Act, including readmissions, discharge to community, and functional outcomes.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Quality Analysis", "Value-Based Purchasing"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/ryvq-mtab",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "SNF_QRP_Provider_MonYYYY.csv",
    updateFrequency: "Quarterly",
    lastUpdated: null,
    dataLag: "~3-6 months",
    historicalRange: "Current reporting period",
    geographicScope: "National",
    granularity: "Facility-measure level",
    knownLimitations: ["Some measures have minimum case thresholds"],
    isFullyDocumented: true,
    fieldsFile: "cms_snf_qrp_provider_fields.json"
  },
  {
    id: "cms_snf_qrp_national",
    name: "CMS SNF Quality Reporting Program (National)",
    description: "National benchmark data for SNF QRP measures including national averages and performance distributions.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Benchmarking", "Value-Based Purchasing"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/ryvq-mtab",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "SNF_QRP_National_MonYYYY.csv",
    updateFrequency: "Quarterly",
    lastUpdated: null,
    dataLag: "~3-6 months",
    historicalRange: "Current reporting period",
    geographicScope: "National",
    granularity: "National aggregate",
    knownLimitations: [],
    isFullyDocumented: true,
    fieldsFile: "cms_snf_qrp_national_fields.json"
  },
  {
    id: "cms_snf_vbp",
    name: "CMS SNF Value-Based Purchasing (Facility)",
    description: "SNF VBP program facility-level performance scores, rankings, and incentive payment multipliers.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Facility Metrics", "Value-Based Purchasing", "Pro Forma"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/jh4p-r8ce",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "SNF_VBP_Facility_YYYY.csv",
    updateFrequency: "Annual (October)",
    lastUpdated: null,
    dataLag: "~1 year",
    historicalRange: "FY 2019 baseline, current performance year",
    geographicScope: "National",
    granularity: "Facility-level",
    knownLimitations: ["Based on 30-day all-cause readmission measure only"],
    isFullyDocumented: true,
    fieldsFile: "cms_snf_vbp_facility_fields.json"
  },
  {
    id: "cms_snf_vbp_aggregate",
    name: "CMS SNF Value-Based Purchasing (Aggregate)",
    description: "National aggregate performance data for the SNF VBP program including thresholds, benchmarks, and payment distributions.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Benchmarking", "Value-Based Purchasing"],
    sourceUrl: "https://data.cms.gov/provider-data/dataset/jh4p-r8ce",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "SNF_VBP_Aggregate_YYYY.csv",
    updateFrequency: "Annual (October)",
    lastUpdated: null,
    dataLag: "~1 year",
    historicalRange: "Current fiscal year",
    geographicScope: "National",
    granularity: "National aggregate",
    knownLimitations: [],
    isFullyDocumented: true,
    fieldsFile: "cms_snf_vbp_aggregate_fields.json"
  },
  {
    id: "cms_citation_codes",
    name: "CMS Citation Code Reference",
    description: "Reference table of deficiency tag codes (F-tags, K-tags, E-tags) with descriptions and categories.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Reference"],
    sourceUrl: "https://data.cms.gov/provider-data/",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "Reference data",
    updateFrequency: "As needed",
    lastUpdated: null,
    dataLag: "N/A",
    historicalRange: "Current codes",
    geographicScope: "National",
    granularity: "Code-level",
    knownLimitations: [],
    isFullyDocumented: true,
    fieldsFile: "cms_citation_codes_fields.json"
  },
  {
    id: "cms_footnotes",
    name: "CMS Footnote Reference",
    description: "Reference table of footnote codes used across CMS nursing home datasets.",
    facilityType: "SNF",
    category: "Quality & Compliance",
    usedInTabs: ["Reference"],
    sourceUrl: "https://data.cms.gov/provider-data/",
    sourceAgency: "Centers for Medicare & Medicaid Services",
    fileName: "Reference data",
    updateFrequency: "As needed",
    lastUpdated: null,
    dataLag: "N/A",
    historicalRange: "Current codes",
    geographicScope: "National",
    granularity: "Code-level",
    knownLimitations: [],
    isFullyDocumented: true,
    fieldsFile: "cms_footnotes_fields.json"
  }
];

// Placeholder sources (no fields files, empty fields arrays)
const placeholderSources = [
  {
    id: "state_alf_licensing",
    name: "State ALF Licensing Agencies",
    description: "Facility listings, capacity, and ownership information from state licensing agencies. Data format and availability varies by state.",
    facilityType: "ALF",
    category: "Facility & Operational",
    usedInTabs: ["Facility Metrics", "Market Dynamics"],
    sourceUrl: null,
    sourceAgency: "Various State Agencies",
    fileName: "Varies by state",
    updateFrequency: "Varies",
    lastUpdated: null,
    dataLag: "Varies by state",
    historicalRange: "Varies",
    geographicScope: "National (50 states + DC)",
    granularity: "Facility-level",
    knownLimitations: [
      "Data format varies significantly by state",
      "Some states required FOIA requests for data access",
      "Update schedules inconsistent across states"
    ],
    isFullyDocumented: false,
    usedBySNFalyze: true,
    fields: []
  },
  {
    id: "census_bureau",
    name: "US Census Bureau",
    description: "Demographics, population estimates, and projections for market analysis including 65+ and 85+ populations.",
    facilityType: "Both",
    category: "Market & Demographics",
    usedInTabs: ["Market Dynamics"],
    sourceUrl: "https://www.census.gov/programs-surveys/acs",
    sourceAgency: "US Census Bureau",
    fileName: "Various ACS tables",
    updateFrequency: "Annually",
    lastUpdated: null,
    dataLag: "~1-2 years",
    historicalRange: "2015-present",
    geographicScope: "National",
    granularity: "County-level",
    knownLimitations: [
      "Population projections are estimates with uncertainty",
      "Data lags real-world by 1-2 years"
    ],
    isFullyDocumented: false,
    usedBySNFalyze: true,
    fields: []
  },
  {
    id: "bls_oews",
    name: "BLS Occupational Employment & Wage Statistics",
    description: "Wage data for healthcare workers including RNs, LPNs, CNAs, physical therapists, and administrative staff.",
    facilityType: "Both",
    category: "Staffing & Workforce",
    usedInTabs: ["Market Dynamics"],
    sourceUrl: "https://www.bls.gov/oes/",
    sourceAgency: "Bureau of Labor Statistics",
    fileName: "OEWS data files by state",
    updateFrequency: "Annually",
    lastUpdated: null,
    dataLag: "~6-12 months",
    historicalRange: "Historical available",
    geographicScope: "National",
    granularity: "State-level",
    knownLimitations: [
      "Industry-specific wages (NAICS 623110) may have small sample sizes in some states"
    ],
    isFullyDocumented: false,
    usedBySNFalyze: true,
    fields: []
  },
  {
    id: "ai_extracted",
    name: "AI-Extracted Deal Data",
    description: "Financial and operational data extracted from uploaded deal documents (CIMs, P&Ls, census reports, rate schedules) using Claude AI.",
    facilityType: "Both",
    category: "AI-Extracted Deal Data",
    usedInTabs: ["Overview", "Calculator", "Pro Forma", "Census & Revenue"],
    sourceUrl: null,
    sourceAgency: "SNFalyze AI Extraction",
    fileName: "User-uploaded documents",
    updateFrequency: "Per Upload",
    lastUpdated: null,
    dataLag: "Real-time",
    historicalRange: "N/A",
    geographicScope: "Per deal",
    granularity: "Facility-level",
    knownLimitations: [
      "Quality depends on source document quality",
      "Confidence scores indicate extraction certainty",
      "Some fields may require manual verification"
    ],
    isFullyDocumented: true,
    usedBySNFalyze: true,
    fields: []
  },
  {
    id: "cascadia_benchmarks",
    name: "Cascadia Benchmarks",
    description: "Internal operational benchmarks and targets used for Pro Forma analysis and deal evaluation.",
    facilityType: "Both",
    category: "Financial & Payer Mix",
    usedInTabs: ["Pro Forma", "Calculator"],
    sourceUrl: null,
    sourceAgency: "Cascadia Healthcare (Internal)",
    fileName: "N/A - Internal",
    updateFrequency: "As updated",
    lastUpdated: null,
    dataLag: "N/A",
    historicalRange: "N/A",
    geographicScope: "N/A",
    granularity: "N/A",
    knownLimitations: [
      "Internal targets - not public benchmarks"
    ],
    isFullyDocumented: false,
    usedBySNFalyze: true,
    fields: []
  }
];

const categories = [
  "Facility & Operational",
  "Financial & Payer Mix",
  "Quality & Compliance",
  "Staffing & Workforce",
  "Market & Demographics",
  "Regulatory Environment",
  "AI-Extracted Deal Data"
];

const tabs = [
  "Overview",
  "Facility Metrics",
  "Market Dynamics",
  "Calculator",
  "Pro Forma",
  "Value-Based Purchasing",
  "Census & Revenue",
  "Quality Analysis",
  "Risk Analysis",
  "Ownership Analysis",
  "Benchmarking",
  "Reference"
];

// Build the sources array from CMS configs
const cmsSources = sourceConfigs.map(config => {
  const { fieldsFile, ...sourceData } = config;

  // Read the fields file
  const fieldsPath = path.join(dataDir, fieldsFile);
  let fields = [];

  try {
    const fileContent = fs.readFileSync(fieldsPath, 'utf8');
    fields = JSON.parse(fileContent);
    // Add usedBySNFalyze: false to each field
    fields = fields.map(field => ({ ...field, usedBySNFalyze: false }));
  } catch (err) {
    console.error(`Error reading ${fieldsFile}:`, err.message);
  }

  return {
    ...sourceData,
    usedBySNFalyze: false,
    fields
  };
});

// Combine CMS sources with placeholder sources
const sources = [...cmsSources, ...placeholderSources];

// Create the final structure
const dataSources = {
  sources,
  categories,
  tabs
};

// Write the output file
const outputPath = path.join(dataDir, 'dataSources.json');
fs.writeFileSync(outputPath, JSON.stringify(dataSources, null, 2));

// Print summary
console.log('\n=== Data Sources Build Complete ===\n');
console.log(`Total sources: ${sources.length}`);

let totalFields = 0;
sources.forEach(source => {
  console.log(`  ${source.id}: ${source.fields.length} fields`);
  totalFields += source.fields.length;
});

console.log(`\nTotal fields: ${totalFields}`);
console.log(`\nOutput: ${outputPath}`);
