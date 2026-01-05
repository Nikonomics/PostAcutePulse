/**
 * marketGradingService.js
 *
 * API service layer for the Market Grading feature.
 * Handles all HTTP requests to the market grading backend endpoints.
 *
 * Toggle USE_MOCK to false when backend is ready.
 */

import axios from 'axios';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Toggle to false when backend is ready */
export const USE_MOCK = true;

/** Base API URL */
const API_BASE = '/api/v1/market-grading';

/** Mock delay range in ms */
const MOCK_DELAY_MIN = 200;
const MOCK_DELAY_MAX = 500;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simulate API delay for mock calls
 * @returns {Promise<void>}
 */
const mockDelay = () => {
  const delay = Math.floor(Math.random() * (MOCK_DELAY_MAX - MOCK_DELAY_MIN + 1)) + MOCK_DELAY_MIN;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Format a number as currency
 * @param {number} value - The value to format
 * @param {boolean} compact - Use compact notation (e.g., $1.2M)
 * @returns {string}
 */
export const formatCurrency = (value, compact = false) => {
  if (value === null || value === undefined) return 'N/A';

  if (compact) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Format a number as percentage
 * @param {number} value - The value to format (0.15 = 15%)
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Get color for a grade
 * @param {string} grade - Letter grade (A+, A, B+, B, C, D, F)
 * @returns {string} - CSS color value
 */
export const getGradeColor = (grade) => {
  const colors = {
    'A+': '#15803d', // Dark green
    'A': '#22c55e',  // Green
    'B+': '#2563eb', // Dark blue
    'B': '#3b82f6',  // Blue
    'C': '#eab308',  // Yellow
    'D': '#f97316',  // Orange
    'F': '#ef4444',  // Red
  };
  return colors[grade] || '#6b7280'; // Gray default
};

/**
 * Calculate grade from score
 * @param {number} score - Numeric score (0-100)
 * @returns {string} - Letter grade
 */
export const scoreToGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
};

// ============================================================================
// MOCK DATA
// ============================================================================

/** State data with markets */
const MOCK_STATES = {
  ID: {
    state_code: 'ID',
    state_name: 'Idaho',
    scores: { overall: 54.2, snf: 48.3, alf: 61.2, hha: 44.8 },
    grades: { overall: 'C', snf: 'D', alf: 'C', hha: 'D' },
    rankings: {
      overall: { rank: 28, total: 51 },
      snf: { rank: 35, total: 51 },
      alf: { rank: 18, total: 51 },
      hha: { rank: 38, total: 51 }
    },
    market_count: 14,
    total_tam: 890000000,
    pop_65_plus: 312000,
    archetype: 'Home-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    demographics: {
      pop_total: 1939033,
      pop_65_plus: 312000,
      pop_65_pct: 0.161,
      pop_85_plus: 38400,
      pop_65_growth_5yr: 0.182,
      median_household_income: 62750,
      median_home_value: 382000
    },
    snf: {
      facility_count: 78,
      total_beds: 5840,
      avg_occupancy: 0.72,
      avg_overall_rating: 3.2,
      beds_per_1k_65: 18.7,
      quadrant_distribution: { growth_competitive: 4, growth_concentrated: 2, stable_competitive: 5, stable_concentrated: 3 }
    },
    hha: {
      agency_count: 42,
      total_episodes: 28500,
      avg_quality_rating: 3.4,
      episodes_per_1k_65: 91.3
    },
    alf: {
      facility_count: 156,
      total_capacity: 8920,
      capacity_per_1k_65: 28.6,
      supply_gap: 0.12
    },
    competition: {
      snf: { hhi: 1850, level: 'Moderate', top3_share: 0.38, operator_count: 24 },
      hha: { hhi: 2100, level: 'Moderate', top3_share: 0.42, operator_count: 18 }
    },
    tam: {
      snf_medicare: 280000000,
      snf_medicaid: 320000000,
      hha_medicare: 145000000,
      alf_private: 145000000,
      total_pac: 890000000,
      rankings: { national: 38, total: 51 }
    },
    markets: [
      { cbsa_code: '14260', name: 'Boise City', rank: 1 },
      { cbsa_code: '26820', name: 'Idaho Falls', rank: 2 },
      { cbsa_code: '17660', name: 'Coeur d\'Alene', rank: 3 }
    ]
  },
  UT: {
    state_code: 'UT',
    state_name: 'Utah',
    scores: { overall: 62.8, snf: 58.4, alf: 68.2, hha: 55.6 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'C' },
    rankings: {
      overall: { rank: 15, total: 51 },
      snf: { rank: 22, total: 51 },
      alf: { rank: 12, total: 51 },
      hha: { rank: 28, total: 51 }
    },
    market_count: 10,
    total_tam: 1240000000,
    pop_65_plus: 398000,
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    demographics: {
      pop_total: 3337975,
      pop_65_plus: 398000,
      pop_65_pct: 0.119,
      pop_85_plus: 42100,
      pop_65_growth_5yr: 0.245,
      median_household_income: 74200,
      median_home_value: 478000
    },
    snf: {
      facility_count: 102,
      total_beds: 7240,
      avg_occupancy: 0.78,
      avg_overall_rating: 3.6,
      beds_per_1k_65: 18.2,
      quadrant_distribution: { growth_competitive: 5, growth_concentrated: 3, stable_competitive: 2, stable_concentrated: 0 }
    },
    hha: {
      agency_count: 68,
      total_episodes: 42800,
      avg_quality_rating: 3.8,
      episodes_per_1k_65: 107.5
    },
    alf: {
      facility_count: 198,
      total_capacity: 12400,
      capacity_per_1k_65: 31.2,
      supply_gap: 0.08
    },
    competition: {
      snf: { hhi: 1420, level: 'Low', top3_share: 0.32, operator_count: 34 },
      hha: { hhi: 1680, level: 'Moderate', top3_share: 0.36, operator_count: 28 }
    },
    tam: {
      snf_medicare: 380000000,
      snf_medicaid: 410000000,
      hha_medicare: 220000000,
      alf_private: 230000000,
      total_pac: 1240000000,
      rankings: { national: 28, total: 51 }
    },
    markets: [
      { cbsa_code: '41620', name: 'Salt Lake City', rank: 1 },
      { cbsa_code: '36260', name: 'Ogden-Clearfield', rank: 2 },
      { cbsa_code: '39340', name: 'Provo-Orem', rank: 3 }
    ]
  },
  CA: {
    state_code: 'CA',
    state_name: 'California',
    scores: { overall: 58.4, snf: 52.1, alf: 64.8, hha: 62.3 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'B' },
    rankings: {
      overall: { rank: 22, total: 51 },
      snf: { rank: 28, total: 51 },
      alf: { rank: 14, total: 51 },
      hha: { rank: 12, total: 51 }
    },
    market_count: 28,
    total_tam: 18500000000,
    pop_65_plus: 6120000,
    archetype: 'SNF-Heavy',
    primary_opportunity: 'HHA',
    secondary_opportunity: 'ALF',
    demographics: {
      pop_total: 39029342,
      pop_65_plus: 6120000,
      pop_65_pct: 0.157,
      pop_85_plus: 812000,
      pop_65_growth_5yr: 0.142,
      median_household_income: 84000,
      median_home_value: 746000
    },
    snf: {
      facility_count: 1198,
      total_beds: 112400,
      avg_occupancy: 0.81,
      avg_overall_rating: 3.1,
      beds_per_1k_65: 18.4,
      quadrant_distribution: { growth_competitive: 8, growth_concentrated: 6, stable_competitive: 10, stable_concentrated: 4 }
    },
    hha: {
      agency_count: 1420,
      total_episodes: 824000,
      avg_quality_rating: 3.5,
      episodes_per_1k_65: 134.6
    },
    alf: {
      facility_count: 7840,
      total_capacity: 186000,
      capacity_per_1k_65: 30.4,
      supply_gap: 0.05
    },
    competition: {
      snf: { hhi: 890, level: 'Low', top3_share: 0.18, operator_count: 342 },
      hha: { hhi: 720, level: 'Low', top3_share: 0.14, operator_count: 480 }
    },
    tam: {
      snf_medicare: 5800000000,
      snf_medicaid: 6200000000,
      hha_medicare: 3400000000,
      alf_private: 3100000000,
      total_pac: 18500000000,
      rankings: { national: 1, total: 51 }
    },
    markets: [
      { cbsa_code: '31080', name: 'Los Angeles-Long Beach-Anaheim', rank: 1 },
      { cbsa_code: '41860', name: 'San Francisco-Oakland-Berkeley', rank: 2 },
      { cbsa_code: '41740', name: 'San Diego-Chula Vista-Carlsbad', rank: 3 }
    ]
  },
  WA: {
    state_code: 'WA',
    state_name: 'Washington',
    scores: { overall: 61.2, snf: 55.8, alf: 66.4, hha: 58.2 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'C' },
    rankings: {
      overall: { rank: 18, total: 51 },
      snf: { rank: 24, total: 51 },
      alf: { rank: 13, total: 51 },
      hha: { rank: 22, total: 51 }
    },
    market_count: 12,
    total_tam: 3200000000,
    pop_65_plus: 1280000,
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    demographics: {
      pop_total: 7738692,
      pop_65_plus: 1280000,
      pop_65_pct: 0.165,
      pop_85_plus: 142000,
      pop_65_growth_5yr: 0.168,
      median_household_income: 82400,
      median_home_value: 564000
    },
    snf: {
      facility_count: 218,
      total_beds: 18200,
      avg_occupancy: 0.76,
      avg_overall_rating: 3.4,
      beds_per_1k_65: 14.2,
      quadrant_distribution: { growth_competitive: 5, growth_concentrated: 2, stable_competitive: 4, stable_concentrated: 1 }
    },
    hha: {
      agency_count: 186,
      total_episodes: 142000,
      avg_quality_rating: 3.6,
      episodes_per_1k_65: 110.9
    },
    alf: {
      facility_count: 524,
      total_capacity: 32400,
      capacity_per_1k_65: 25.3,
      supply_gap: 0.14
    },
    competition: {
      snf: { hhi: 1280, level: 'Low', top3_share: 0.28, operator_count: 68 },
      hha: { hhi: 1150, level: 'Low', top3_share: 0.24, operator_count: 82 }
    },
    tam: {
      snf_medicare: 980000000,
      snf_medicaid: 1050000000,
      hha_medicare: 620000000,
      alf_private: 550000000,
      total_pac: 3200000000,
      rankings: { national: 12, total: 51 }
    },
    markets: [
      { cbsa_code: '42660', name: 'Seattle-Tacoma-Bellevue', rank: 1 },
      { cbsa_code: '44060', name: 'Spokane-Spokane Valley', rank: 2 }
    ]
  },
  OR: {
    state_code: 'OR',
    state_name: 'Oregon',
    scores: { overall: 56.8, snf: 50.2, alf: 62.8, hha: 52.4 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: {
      overall: { rank: 25, total: 51 },
      snf: { rank: 30, total: 51 },
      alf: { rank: 16, total: 51 },
      hha: { rank: 32, total: 51 }
    },
    market_count: 8,
    total_tam: 1680000000,
    pop_65_plus: 782000,
    archetype: 'Home-Heavy',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'HHA',
    demographics: {
      pop_total: 4240137,
      pop_65_plus: 782000,
      pop_65_pct: 0.184,
      pop_85_plus: 98400,
      pop_65_growth_5yr: 0.156,
      median_household_income: 67100,
      median_home_value: 478000
    },
    snf: {
      facility_count: 128,
      total_beds: 8640,
      avg_occupancy: 0.74,
      avg_overall_rating: 3.2,
      beds_per_1k_65: 11.0,
      quadrant_distribution: { growth_competitive: 3, growth_concentrated: 2, stable_competitive: 2, stable_concentrated: 1 }
    },
    hha: {
      agency_count: 98,
      total_episodes: 68200,
      avg_quality_rating: 3.3,
      episodes_per_1k_65: 87.2
    },
    alf: {
      facility_count: 342,
      total_capacity: 21800,
      capacity_per_1k_65: 27.9,
      supply_gap: 0.09
    },
    competition: {
      snf: { hhi: 1580, level: 'Moderate', top3_share: 0.34, operator_count: 42 },
      hha: { hhi: 1420, level: 'Low', top3_share: 0.30, operator_count: 48 }
    },
    tam: {
      snf_medicare: 520000000,
      snf_medicaid: 560000000,
      hha_medicare: 310000000,
      alf_private: 290000000,
      total_pac: 1680000000,
      rankings: { national: 24, total: 51 }
    },
    markets: [
      { cbsa_code: '38900', name: 'Portland-Vancouver-Hillsboro', rank: 1 },
      { cbsa_code: '21660', name: 'Eugene-Springfield', rank: 2 }
    ]
  },
  TX: {
    state_code: 'TX',
    state_name: 'Texas',
    scores: { overall: 68.4, snf: 72.1, alf: 62.8, hha: 68.6 },
    grades: { overall: 'B', snf: 'B+', alf: 'B', hha: 'B' },
    rankings: {
      overall: { rank: 4, total: 51 },
      snf: { rank: 3, total: 51 },
      alf: { rank: 15, total: 51 },
      hha: { rank: 5, total: 51 }
    },
    market_count: 26,
    total_tam: 12800000000,
    pop_65_plus: 3840000,
    archetype: 'SNF-Heavy',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'HHA',
    demographics: {
      pop_total: 30029572,
      pop_65_plus: 3840000,
      pop_65_pct: 0.128,
      pop_85_plus: 412000,
      pop_65_growth_5yr: 0.218,
      median_household_income: 67320,
      median_home_value: 302000
    },
    snf: {
      facility_count: 1182,
      total_beds: 124600,
      avg_occupancy: 0.68,
      avg_overall_rating: 2.8,
      beds_per_1k_65: 32.4,
      quadrant_distribution: { growth_competitive: 10, growth_concentrated: 4, stable_competitive: 8, stable_concentrated: 4 }
    },
    hha: {
      agency_count: 2840,
      total_episodes: 682000,
      avg_quality_rating: 3.2,
      episodes_per_1k_65: 177.6
    },
    alf: {
      facility_count: 1840,
      total_capacity: 92400,
      capacity_per_1k_65: 24.1,
      supply_gap: 0.18
    },
    competition: {
      snf: { hhi: 680, level: 'Low', top3_share: 0.14, operator_count: 428 },
      hha: { hhi: 540, level: 'Low', top3_share: 0.12, operator_count: 1240 }
    },
    tam: {
      snf_medicare: 4200000000,
      snf_medicaid: 4800000000,
      hha_medicare: 2400000000,
      alf_private: 1400000000,
      total_pac: 12800000000,
      rankings: { national: 2, total: 51 }
    },
    markets: [
      { cbsa_code: '19100', name: 'Dallas-Fort Worth-Arlington', rank: 1 },
      { cbsa_code: '26420', name: 'Houston-The Woodlands-Sugar Land', rank: 2 },
      { cbsa_code: '41700', name: 'San Antonio-New Braunfels', rank: 3 }
    ]
  },
  FL: {
    state_code: 'FL',
    state_name: 'Florida',
    scores: { overall: 65.2, snf: 68.4, alf: 58.2, hha: 72.8 },
    grades: { overall: 'B', snf: 'B', alf: 'C', hha: 'B+' },
    rankings: {
      overall: { rank: 8, total: 51 },
      snf: { rank: 8, total: 51 },
      alf: { rank: 24, total: 51 },
      hha: { rank: 2, total: 51 }
    },
    market_count: 22,
    total_tam: 14200000000,
    pop_65_plus: 4820000,
    archetype: 'HHA-Heavy',
    primary_opportunity: 'HHA',
    secondary_opportunity: 'SNF',
    demographics: {
      pop_total: 22244823,
      pop_65_plus: 4820000,
      pop_65_pct: 0.217,
      pop_85_plus: 624000,
      pop_65_growth_5yr: 0.192,
      median_household_income: 61800,
      median_home_value: 392000
    },
    snf: {
      facility_count: 698,
      total_beds: 82400,
      avg_occupancy: 0.84,
      avg_overall_rating: 3.0,
      beds_per_1k_65: 17.1,
      quadrant_distribution: { growth_competitive: 8, growth_concentrated: 5, stable_competitive: 6, stable_concentrated: 3 }
    },
    hha: {
      agency_count: 1680,
      total_episodes: 924000,
      avg_quality_rating: 3.4,
      episodes_per_1k_65: 191.7
    },
    alf: {
      facility_count: 3120,
      total_capacity: 98400,
      capacity_per_1k_65: 20.4,
      supply_gap: 0.22
    },
    competition: {
      snf: { hhi: 920, level: 'Low', top3_share: 0.20, operator_count: 248 },
      hha: { hhi: 680, level: 'Low', top3_share: 0.16, operator_count: 680 }
    },
    tam: {
      snf_medicare: 4400000000,
      snf_medicaid: 4200000000,
      hha_medicare: 3800000000,
      alf_private: 1800000000,
      total_pac: 14200000000,
      rankings: { national: 3, total: 51 }
    },
    markets: [
      { cbsa_code: '33100', name: 'Miami-Fort Lauderdale-Pompano Beach', rank: 1 },
      { cbsa_code: '45300', name: 'Tampa-St. Petersburg-Clearwater', rank: 2 },
      { cbsa_code: '36740', name: 'Orlando-Kissimmee-Sanford', rank: 3 }
    ]
  },
  NY: {
    state_code: 'NY',
    state_name: 'New York',
    scores: { overall: 52.4, snf: 45.8, alf: 58.2, hha: 56.8 },
    grades: { overall: 'C', snf: 'D', alf: 'C', hha: 'C' },
    rankings: {
      overall: { rank: 32, total: 51 },
      snf: { rank: 38, total: 51 },
      alf: { rank: 23, total: 51 },
      hha: { rank: 25, total: 51 }
    },
    market_count: 14,
    total_tam: 12400000000,
    pop_65_plus: 3420000,
    archetype: 'SNF-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    demographics: {
      pop_total: 19677151,
      pop_65_plus: 3420000,
      pop_65_pct: 0.174,
      pop_85_plus: 468000,
      pop_65_growth_5yr: 0.124,
      median_household_income: 74300,
      median_home_value: 384000
    },
    snf: {
      facility_count: 624,
      total_beds: 112800,
      avg_occupancy: 0.88,
      avg_overall_rating: 2.9,
      beds_per_1k_65: 33.0,
      quadrant_distribution: { growth_competitive: 2, growth_concentrated: 3, stable_competitive: 5, stable_concentrated: 4 }
    },
    hha: {
      agency_count: 842,
      total_episodes: 524000,
      avg_quality_rating: 3.3,
      episodes_per_1k_65: 153.2
    },
    alf: {
      facility_count: 580,
      total_capacity: 52400,
      capacity_per_1k_65: 15.3,
      supply_gap: 0.28
    },
    competition: {
      snf: { hhi: 1840, level: 'Moderate', top3_share: 0.36, operator_count: 142 },
      hha: { hhi: 1420, level: 'Low', top3_share: 0.30, operator_count: 324 }
    },
    tam: {
      snf_medicare: 4800000000,
      snf_medicaid: 5200000000,
      hha_medicare: 1800000000,
      alf_private: 600000000,
      total_pac: 12400000000,
      rankings: { national: 4, total: 51 }
    },
    markets: [
      { cbsa_code: '35620', name: 'New York-Newark-Jersey City', rank: 1 },
      { cbsa_code: '15380', name: 'Buffalo-Cheektowaga', rank: 2 }
    ]
  },
  PA: {
    state_code: 'PA',
    state_name: 'Pennsylvania',
    scores: { overall: 55.8, snf: 51.2, alf: 60.4, hha: 54.2 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: {
      overall: { rank: 26, total: 51 },
      snf: { rank: 29, total: 51 },
      alf: { rank: 19, total: 51 },
      hha: { rank: 30, total: 51 }
    },
    market_count: 16,
    total_tam: 8200000000,
    pop_65_plus: 2580000,
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    demographics: {
      pop_total: 12972008,
      pop_65_plus: 2580000,
      pop_65_pct: 0.199,
      pop_85_plus: 348000,
      pop_65_growth_5yr: 0.138,
      median_household_income: 67570,
      median_home_value: 242000
    },
    snf: {
      facility_count: 692,
      total_beds: 84200,
      avg_occupancy: 0.82,
      avg_overall_rating: 3.1,
      beds_per_1k_65: 32.6,
      quadrant_distribution: { growth_competitive: 4, growth_concentrated: 3, stable_competitive: 6, stable_concentrated: 3 }
    },
    hha: {
      agency_count: 486,
      total_episodes: 328000,
      avg_quality_rating: 3.4,
      episodes_per_1k_65: 127.1
    },
    alf: {
      facility_count: 1240,
      total_capacity: 68400,
      capacity_per_1k_65: 26.5,
      supply_gap: 0.12
    },
    competition: {
      snf: { hhi: 1320, level: 'Low', top3_share: 0.28, operator_count: 186 },
      hha: { hhi: 1180, level: 'Low', top3_share: 0.26, operator_count: 218 }
    },
    tam: {
      snf_medicare: 2800000000,
      snf_medicaid: 3200000000,
      hha_medicare: 1400000000,
      alf_private: 800000000,
      total_pac: 8200000000,
      rankings: { national: 6, total: 51 }
    },
    markets: [
      { cbsa_code: '37980', name: 'Philadelphia-Camden-Wilmington', rank: 1 },
      { cbsa_code: '38300', name: 'Pittsburgh', rank: 2 }
    ]
  },
  OH: {
    state_code: 'OH',
    state_name: 'Ohio',
    scores: { overall: 58.2, snf: 54.8, alf: 62.4, hha: 55.8 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: {
      overall: { rank: 23, total: 51 },
      snf: { rank: 26, total: 51 },
      alf: { rank: 17, total: 51 },
      hha: { rank: 27, total: 51 }
    },
    market_count: 18,
    total_tam: 6400000000,
    pop_65_plus: 2120000,
    archetype: 'Balanced',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'ALF',
    demographics: {
      pop_total: 11756058,
      pop_65_plus: 2120000,
      pop_65_pct: 0.180,
      pop_85_plus: 278000,
      pop_65_growth_5yr: 0.142,
      median_household_income: 59850,
      median_home_value: 186000
    },
    snf: {
      facility_count: 948,
      total_beds: 88400,
      avg_occupancy: 0.79,
      avg_overall_rating: 3.2,
      beds_per_1k_65: 41.7,
      quadrant_distribution: { growth_competitive: 5, growth_concentrated: 4, stable_competitive: 6, stable_concentrated: 3 }
    },
    hha: {
      agency_count: 542,
      total_episodes: 284000,
      avg_quality_rating: 3.4,
      episodes_per_1k_65: 134.0
    },
    alf: {
      facility_count: 782,
      total_capacity: 42800,
      capacity_per_1k_65: 20.2,
      supply_gap: 0.16
    },
    competition: {
      snf: { hhi: 1120, level: 'Low', top3_share: 0.24, operator_count: 268 },
      hha: { hhi: 980, level: 'Low', top3_share: 0.22, operator_count: 286 }
    },
    tam: {
      snf_medicare: 2200000000,
      snf_medicaid: 2600000000,
      hha_medicare: 1000000000,
      alf_private: 600000000,
      total_pac: 6400000000,
      rankings: { national: 8, total: 51 }
    },
    markets: [
      { cbsa_code: '17460', name: 'Cleveland-Elyria', rank: 1 },
      { cbsa_code: '18140', name: 'Columbus', rank: 2 },
      { cbsa_code: '17140', name: 'Cincinnati', rank: 3 }
    ]
  }
};

/** Market data keyed by CBSA code */
const MOCK_MARKETS = {
  // Idaho Markets
  '14260': {
    cbsa_code: '14260',
    name: 'Boise City',
    state: 'ID',
    scores: { overall: 58.0, snf: 51.2, alf: 66.4, hha: 54.8 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 388, total: 879 }, state: { rank: 1, total: 14 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 234000000, formatted: '$234M', snf_medicare: 72000000, snf_medicaid: 84000000, hha_medicare: 42000000, alf_private: 36000000 },
    demographics: {
      pop_total: 764718,
      pop_65_plus: 118400,
      pop_65_pct: 0.155,
      pop_85_plus: 14200,
      pop_65_growth_5yr: 0.198,
      median_household_income: 68200,
      median_home_value: 428000
    },
    snf: {
      facility_count: 24,
      total_beds: 1840,
      avg_occupancy: 0.74,
      avg_overall_rating: 3.3,
      beds_per_1k_65: 15.5
    },
    hha: {
      agency_count: 14,
      total_episodes: 9200,
      avg_quality_rating: 3.5,
      episodes_per_1k_65: 77.7
    },
    alf: {
      facility_count: 48,
      total_capacity: 2840,
      capacity_per_1k_65: 24.0,
      supply_gap: 0.14
    },
    competition: {
      snf: { hhi: 1680, level: 'Moderate', top3_share: 0.36, operator_count: 12 },
      hha: { hhi: 1920, level: 'Moderate', top3_share: 0.40, operator_count: 8 }
    }
  },
  '26820': {
    cbsa_code: '26820',
    name: 'Idaho Falls',
    state: 'ID',
    scores: { overall: 52.4, snf: 46.8, alf: 58.2, hha: 48.2 },
    grades: { overall: 'C', snf: 'D', alf: 'C', hha: 'D' },
    rankings: { national: { rank: 524, total: 879 }, state: { rank: 2, total: 14 } },
    archetype: 'Home-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 86000000, formatted: '$86M', snf_medicare: 24000000, snf_medicaid: 28000000, hha_medicare: 18000000, alf_private: 16000000 },
    demographics: {
      pop_total: 156420,
      pop_65_plus: 24800,
      pop_65_pct: 0.159,
      pop_85_plus: 3100,
      pop_65_growth_5yr: 0.172,
      median_household_income: 58400,
      median_home_value: 324000
    },
    snf: { facility_count: 8, total_beds: 580, avg_occupancy: 0.71, avg_overall_rating: 3.1, beds_per_1k_65: 23.4 },
    hha: { agency_count: 5, total_episodes: 2400, avg_quality_rating: 3.2, episodes_per_1k_65: 96.8 },
    alf: { facility_count: 14, total_capacity: 720, capacity_per_1k_65: 29.0, supply_gap: 0.08 },
    competition: { snf: { hhi: 2240, level: 'Moderate', top3_share: 0.48, operator_count: 5 }, hha: { hhi: 2680, level: 'High', top3_share: 0.58, operator_count: 3 } }
  },
  '17660': {
    cbsa_code: '17660',
    name: 'Coeur d\'Alene',
    state: 'ID',
    scores: { overall: 54.8, snf: 48.4, alf: 62.8, hha: 46.2 },
    grades: { overall: 'C', snf: 'D', alf: 'B', hha: 'D' },
    rankings: { national: { rank: 486, total: 879 }, state: { rank: 3, total: 14 } },
    archetype: 'Home-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 124000000, formatted: '$124M', snf_medicare: 36000000, snf_medicaid: 42000000, hha_medicare: 24000000, alf_private: 22000000 },
    demographics: { pop_total: 178420, pop_65_plus: 38200, pop_65_pct: 0.214, pop_85_plus: 4800, pop_65_growth_5yr: 0.224, median_household_income: 62800, median_home_value: 486000 },
    snf: { facility_count: 10, total_beds: 720, avg_occupancy: 0.72, avg_overall_rating: 3.2, beds_per_1k_65: 18.8 },
    hha: { agency_count: 6, total_episodes: 3200, avg_quality_rating: 3.1, episodes_per_1k_65: 83.8 },
    alf: { facility_count: 22, total_capacity: 1280, capacity_per_1k_65: 33.5, supply_gap: 0.06 },
    competition: { snf: { hhi: 1980, level: 'Moderate', top3_share: 0.42, operator_count: 6 }, hha: { hhi: 2420, level: 'Moderate', top3_share: 0.52, operator_count: 4 } }
  },
  // Utah Markets
  '41620': {
    cbsa_code: '41620',
    name: 'Salt Lake City',
    state: 'UT',
    scores: { overall: 66.4, snf: 62.8, alf: 72.4, hha: 60.2 },
    grades: { overall: 'B', snf: 'B', alf: 'B+', hha: 'B' },
    rankings: { national: { rank: 142, total: 879 }, state: { rank: 1, total: 10 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 680000000, formatted: '$680M', snf_medicare: 210000000, snf_medicaid: 240000000, hha_medicare: 120000000, alf_private: 110000000 },
    demographics: { pop_total: 1257936, pop_65_plus: 142000, pop_65_pct: 0.113, pop_85_plus: 15800, pop_65_growth_5yr: 0.268, median_household_income: 78400, median_home_value: 524000 },
    snf: { facility_count: 42, total_beds: 3240, avg_occupancy: 0.79, avg_overall_rating: 3.7, beds_per_1k_65: 22.8 },
    hha: { agency_count: 28, total_episodes: 18400, avg_quality_rating: 3.9, episodes_per_1k_65: 129.6 },
    alf: { facility_count: 78, total_capacity: 5200, capacity_per_1k_65: 36.6, supply_gap: 0.04 },
    competition: { snf: { hhi: 1280, level: 'Low', top3_share: 0.28, operator_count: 18 }, hha: { hhi: 1520, level: 'Moderate', top3_share: 0.34, operator_count: 14 } }
  },
  '36260': {
    cbsa_code: '36260',
    name: 'Ogden-Clearfield',
    state: 'UT',
    scores: { overall: 62.8, snf: 58.2, alf: 68.4, hha: 56.8 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 218, total: 879 }, state: { rank: 2, total: 10 } },
    archetype: 'Balanced',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'HHA',
    tam: { total: 248000000, formatted: '$248M', snf_medicare: 78000000, snf_medicaid: 86000000, hha_medicare: 44000000, alf_private: 40000000 },
    demographics: { pop_total: 720842, pop_65_plus: 78400, pop_65_pct: 0.109, pop_85_plus: 8200, pop_65_growth_5yr: 0.242, median_household_income: 74200, median_home_value: 448000 },
    snf: { facility_count: 22, total_beds: 1580, avg_occupancy: 0.76, avg_overall_rating: 3.5, beds_per_1k_65: 20.2 },
    hha: { agency_count: 14, total_episodes: 8200, avg_quality_rating: 3.6, episodes_per_1k_65: 104.6 },
    alf: { facility_count: 42, total_capacity: 2680, capacity_per_1k_65: 34.2, supply_gap: 0.06 },
    competition: { snf: { hhi: 1480, level: 'Low', top3_share: 0.32, operator_count: 10 }, hha: { hhi: 1780, level: 'Moderate', top3_share: 0.38, operator_count: 8 } }
  },
  '39340': {
    cbsa_code: '39340',
    name: 'Provo-Orem',
    state: 'UT',
    scores: { overall: 60.2, snf: 55.4, alf: 66.8, hha: 54.2 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 286, total: 879 }, state: { rank: 3, total: 10 } },
    archetype: 'Home-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 186000000, formatted: '$186M', snf_medicare: 58000000, snf_medicaid: 64000000, hha_medicare: 34000000, alf_private: 30000000 },
    demographics: { pop_total: 648252, pop_65_plus: 52800, pop_65_pct: 0.081, pop_85_plus: 5400, pop_65_growth_5yr: 0.312, median_household_income: 72600, median_home_value: 482000 },
    snf: { facility_count: 16, total_beds: 1120, avg_occupancy: 0.78, avg_overall_rating: 3.6, beds_per_1k_65: 21.2 },
    hha: { agency_count: 12, total_episodes: 5800, avg_quality_rating: 3.7, episodes_per_1k_65: 109.8 },
    alf: { facility_count: 36, total_capacity: 2040, capacity_per_1k_65: 38.6, supply_gap: 0.02 },
    competition: { snf: { hhi: 1620, level: 'Moderate', top3_share: 0.36, operator_count: 8 }, hha: { hhi: 1940, level: 'Moderate', top3_share: 0.42, operator_count: 6 } }
  },
  // California Markets
  '31080': {
    cbsa_code: '31080',
    name: 'Los Angeles-Long Beach-Anaheim',
    state: 'CA',
    scores: { overall: 62.4, snf: 56.8, alf: 68.2, hha: 64.8 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'B' },
    rankings: { national: { rank: 198, total: 879 }, state: { rank: 1, total: 28 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'HHA',
    secondary_opportunity: 'ALF',
    tam: { total: 6200000000, formatted: '$6.2B', snf_medicare: 1920000000, snf_medicaid: 2080000000, hha_medicare: 1140000000, alf_private: 1060000000 },
    demographics: { pop_total: 12997353, pop_65_plus: 1840000, pop_65_pct: 0.142, pop_85_plus: 248000, pop_65_growth_5yr: 0.138, median_household_income: 76200, median_home_value: 824000 },
    snf: { facility_count: 384, total_beds: 38400, avg_occupancy: 0.82, avg_overall_rating: 3.0, beds_per_1k_65: 20.9 },
    hha: { agency_count: 486, total_episodes: 284000, avg_quality_rating: 3.4, episodes_per_1k_65: 154.3 },
    alf: { facility_count: 2480, total_capacity: 62400, capacity_per_1k_65: 33.9, supply_gap: 0.04 },
    competition: { snf: { hhi: 680, level: 'Low', top3_share: 0.14, operator_count: 142 }, hha: { hhi: 540, level: 'Low', top3_share: 0.12, operator_count: 186 } }
  },
  '41860': {
    cbsa_code: '41860',
    name: 'San Francisco-Oakland-Berkeley',
    state: 'CA',
    scores: { overall: 58.8, snf: 52.4, alf: 64.8, hha: 62.4 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'B' },
    rankings: { national: { rank: 368, total: 879 }, state: { rank: 2, total: 28 } },
    archetype: 'Balanced',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'HHA',
    tam: { total: 2400000000, formatted: '$2.4B', snf_medicare: 740000000, snf_medicaid: 820000000, hha_medicare: 440000000, alf_private: 400000000 },
    demographics: { pop_total: 4749008, pop_65_plus: 742000, pop_65_pct: 0.156, pop_85_plus: 98400, pop_65_growth_5yr: 0.128, median_household_income: 124800, median_home_value: 1180000 },
    snf: { facility_count: 148, total_beds: 14200, avg_occupancy: 0.84, avg_overall_rating: 3.2, beds_per_1k_65: 19.1 },
    hha: { agency_count: 182, total_episodes: 98400, avg_quality_rating: 3.6, episodes_per_1k_65: 132.6 },
    alf: { facility_count: 924, total_capacity: 24800, capacity_per_1k_65: 33.4, supply_gap: 0.06 },
    competition: { snf: { hhi: 920, level: 'Low', top3_share: 0.18, operator_count: 68 }, hha: { hhi: 780, level: 'Low', top3_share: 0.16, operator_count: 82 } }
  },
  '41740': {
    cbsa_code: '41740',
    name: 'San Diego-Chula Vista-Carlsbad',
    state: 'CA',
    scores: { overall: 60.4, snf: 54.2, alf: 66.8, hha: 62.8 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'B' },
    rankings: { national: { rank: 278, total: 879 }, state: { rank: 3, total: 28 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 1680000000, formatted: '$1.7B', snf_medicare: 520000000, snf_medicaid: 560000000, hha_medicare: 320000000, alf_private: 280000000 },
    demographics: { pop_total: 3286069, pop_65_plus: 482000, pop_65_pct: 0.147, pop_85_plus: 62400, pop_65_growth_5yr: 0.148, median_household_income: 88400, median_home_value: 842000 },
    snf: { facility_count: 98, total_beds: 9400, avg_occupancy: 0.80, avg_overall_rating: 3.2, beds_per_1k_65: 19.5 },
    hha: { agency_count: 124, total_episodes: 68200, avg_quality_rating: 3.5, episodes_per_1k_65: 141.5 },
    alf: { facility_count: 648, total_capacity: 16800, capacity_per_1k_65: 34.9, supply_gap: 0.05 },
    competition: { snf: { hhi: 1080, level: 'Low', top3_share: 0.22, operator_count: 42 }, hha: { hhi: 880, level: 'Low', top3_share: 0.18, operator_count: 54 } }
  },
  // Washington Markets
  '42660': {
    cbsa_code: '42660',
    name: 'Seattle-Tacoma-Bellevue',
    state: 'WA',
    scores: { overall: 64.8, snf: 58.4, alf: 70.2, hha: 62.8 },
    grades: { overall: 'B', snf: 'C', alf: 'B+', hha: 'B' },
    rankings: { national: { rank: 168, total: 879 }, state: { rank: 1, total: 12 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 1840000000, formatted: '$1.8B', snf_medicare: 560000000, snf_medicaid: 620000000, hha_medicare: 360000000, alf_private: 300000000 },
    demographics: { pop_total: 4018762, pop_65_plus: 584000, pop_65_pct: 0.145, pop_85_plus: 68400, pop_65_growth_5yr: 0.182, median_household_income: 102400, median_home_value: 724000 },
    snf: { facility_count: 108, total_beds: 9200, avg_occupancy: 0.78, avg_overall_rating: 3.5, beds_per_1k_65: 15.8 },
    hha: { agency_count: 92, total_episodes: 72400, avg_quality_rating: 3.7, episodes_per_1k_65: 124.0 },
    alf: { facility_count: 264, total_capacity: 16800, capacity_per_1k_65: 28.8, supply_gap: 0.12 },
    competition: { snf: { hhi: 1180, level: 'Low', top3_share: 0.26, operator_count: 42 }, hha: { hhi: 1040, level: 'Low', top3_share: 0.22, operator_count: 48 } }
  },
  '44060': {
    cbsa_code: '44060',
    name: 'Spokane-Spokane Valley',
    state: 'WA',
    scores: { overall: 56.2, snf: 50.8, alf: 62.4, hha: 52.4 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 448, total: 879 }, state: { rank: 2, total: 12 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'HHA',
    secondary_opportunity: 'ALF',
    tam: { total: 420000000, formatted: '$420M', snf_medicare: 132000000, snf_medicaid: 148000000, hha_medicare: 78000000, alf_private: 62000000 },
    demographics: { pop_total: 583328, pop_65_plus: 102400, pop_65_pct: 0.176, pop_85_plus: 12800, pop_65_growth_5yr: 0.162, median_household_income: 62800, median_home_value: 382000 },
    snf: { facility_count: 32, total_beds: 2840, avg_occupancy: 0.74, avg_overall_rating: 3.3, beds_per_1k_65: 27.7 },
    hha: { agency_count: 22, total_episodes: 12400, avg_quality_rating: 3.4, episodes_per_1k_65: 121.1 },
    alf: { facility_count: 68, total_capacity: 4200, capacity_per_1k_65: 41.0, supply_gap: 0.02 },
    competition: { snf: { hhi: 1520, level: 'Moderate', top3_share: 0.34, operator_count: 14 }, hha: { hhi: 1680, level: 'Moderate', top3_share: 0.38, operator_count: 10 } }
  },
  // Oregon Markets
  '38900': {
    cbsa_code: '38900',
    name: 'Portland-Vancouver-Hillsboro',
    state: 'OR',
    scores: { overall: 60.8, snf: 54.2, alf: 66.4, hha: 58.2 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 268, total: 879 }, state: { rank: 1, total: 8 } },
    archetype: 'Balanced',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'ALF',
    tam: { total: 980000000, formatted: '$980M', snf_medicare: 300000000, snf_medicaid: 340000000, hha_medicare: 180000000, alf_private: 160000000 },
    demographics: { pop_total: 2512859, pop_65_plus: 412000, pop_65_pct: 0.164, pop_85_plus: 52400, pop_65_growth_5yr: 0.168, median_household_income: 76400, median_home_value: 542000 },
    snf: { facility_count: 72, total_beds: 5200, avg_occupancy: 0.76, avg_overall_rating: 3.3, beds_per_1k_65: 12.6 },
    hha: { agency_count: 54, total_episodes: 38400, avg_quality_rating: 3.4, episodes_per_1k_65: 93.2 },
    alf: { facility_count: 186, total_capacity: 12400, capacity_per_1k_65: 30.1, supply_gap: 0.08 },
    competition: { snf: { hhi: 1420, level: 'Low', top3_share: 0.30, operator_count: 28 }, hha: { hhi: 1280, level: 'Low', top3_share: 0.28, operator_count: 32 } }
  },
  '21660': {
    cbsa_code: '21660',
    name: 'Eugene-Springfield',
    state: 'OR',
    scores: { overall: 52.8, snf: 46.4, alf: 58.8, hha: 48.2 },
    grades: { overall: 'C', snf: 'D', alf: 'C', hha: 'D' },
    rankings: { national: { rank: 512, total: 879 }, state: { rank: 2, total: 8 } },
    archetype: 'Home-Heavy',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'HHA',
    tam: { total: 248000000, formatted: '$248M', snf_medicare: 76000000, snf_medicaid: 84000000, hha_medicare: 46000000, alf_private: 42000000 },
    demographics: { pop_total: 382067, pop_65_plus: 72400, pop_65_pct: 0.190, pop_85_plus: 9200, pop_65_growth_5yr: 0.148, median_household_income: 54800, median_home_value: 386000 },
    snf: { facility_count: 18, total_beds: 1240, avg_occupancy: 0.72, avg_overall_rating: 3.1, beds_per_1k_65: 17.1 },
    hha: { agency_count: 14, total_episodes: 6800, avg_quality_rating: 3.2, episodes_per_1k_65: 93.9 },
    alf: { facility_count: 48, total_capacity: 2840, capacity_per_1k_65: 39.2, supply_gap: 0.04 },
    competition: { snf: { hhi: 1880, level: 'Moderate', top3_share: 0.40, operator_count: 10 }, hha: { hhi: 1720, level: 'Moderate', top3_share: 0.38, operator_count: 8 } }
  },
  // Texas Markets
  '19100': {
    cbsa_code: '19100',
    name: 'Dallas-Fort Worth-Arlington',
    state: 'TX',
    scores: { overall: 72.4, snf: 76.8, alf: 66.2, hha: 74.2 },
    grades: { overall: 'B+', snf: 'B+', alf: 'B', hha: 'B+' },
    rankings: { national: { rank: 48, total: 879 }, state: { rank: 1, total: 26 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'HHA',
    tam: { total: 3200000000, formatted: '$3.2B', snf_medicare: 1040000000, snf_medicaid: 1200000000, hha_medicare: 580000000, alf_private: 380000000 },
    demographics: { pop_total: 7759615, pop_65_plus: 924000, pop_65_pct: 0.119, pop_85_plus: 98400, pop_65_growth_5yr: 0.248, median_household_income: 74200, median_home_value: 342000 },
    snf: { facility_count: 298, total_beds: 32400, avg_occupancy: 0.70, avg_overall_rating: 2.9, beds_per_1k_65: 35.1 },
    hha: { agency_count: 724, total_episodes: 178000, avg_quality_rating: 3.3, episodes_per_1k_65: 192.6 },
    alf: { facility_count: 486, total_capacity: 24800, capacity_per_1k_65: 26.8, supply_gap: 0.16 },
    competition: { snf: { hhi: 580, level: 'Low', top3_share: 0.12, operator_count: 124 }, hha: { hhi: 420, level: 'Low', top3_share: 0.10, operator_count: 342 } }
  },
  '26420': {
    cbsa_code: '26420',
    name: 'Houston-The Woodlands-Sugar Land',
    state: 'TX',
    scores: { overall: 70.2, snf: 74.8, alf: 64.2, hha: 72.4 },
    grades: { overall: 'B+', snf: 'B+', alf: 'B', hha: 'B+' },
    rankings: { national: { rank: 68, total: 879 }, state: { rank: 2, total: 26 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 2840000000, formatted: '$2.8B', snf_medicare: 920000000, snf_medicaid: 1040000000, hha_medicare: 520000000, alf_private: 360000000 },
    demographics: { pop_total: 7122240, pop_65_plus: 782000, pop_65_pct: 0.110, pop_85_plus: 82400, pop_65_growth_5yr: 0.262, median_household_income: 71800, median_home_value: 298000 },
    snf: { facility_count: 262, total_beds: 28400, avg_occupancy: 0.68, avg_overall_rating: 2.8, beds_per_1k_65: 36.3 },
    hha: { agency_count: 648, total_episodes: 152000, avg_quality_rating: 3.2, episodes_per_1k_65: 194.4 },
    alf: { facility_count: 398, total_capacity: 19800, capacity_per_1k_65: 25.3, supply_gap: 0.18 },
    competition: { snf: { hhi: 620, level: 'Low', top3_share: 0.14, operator_count: 108 }, hha: { hhi: 480, level: 'Low', top3_share: 0.11, operator_count: 298 } }
  },
  '41700': {
    cbsa_code: '41700',
    name: 'San Antonio-New Braunfels',
    state: 'TX',
    scores: { overall: 68.4, snf: 72.2, alf: 62.8, hha: 70.4 },
    grades: { overall: 'B', snf: 'B+', alf: 'B', hha: 'B+' },
    rankings: { national: { rank: 98, total: 879 }, state: { rank: 3, total: 26 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 1480000000, formatted: '$1.5B', snf_medicare: 480000000, snf_medicaid: 540000000, hha_medicare: 280000000, alf_private: 180000000 },
    demographics: { pop_total: 2558143, pop_65_plus: 348000, pop_65_pct: 0.136, pop_85_plus: 38200, pop_65_growth_5yr: 0.228, median_household_income: 62400, median_home_value: 268000 },
    snf: { facility_count: 142, total_beds: 14800, avg_occupancy: 0.66, avg_overall_rating: 2.9, beds_per_1k_65: 42.5 },
    hha: { agency_count: 324, total_episodes: 72400, avg_quality_rating: 3.2, episodes_per_1k_65: 208.0 },
    alf: { facility_count: 224, total_capacity: 10800, capacity_per_1k_65: 31.0, supply_gap: 0.14 },
    competition: { snf: { hhi: 720, level: 'Low', top3_share: 0.16, operator_count: 58 }, hha: { hhi: 580, level: 'Low', top3_share: 0.14, operator_count: 142 } }
  },
  // Florida Markets
  '33100': {
    cbsa_code: '33100',
    name: 'Miami-Fort Lauderdale-Pompano Beach',
    state: 'FL',
    scores: { overall: 68.2, snf: 72.4, alf: 60.8, hha: 76.2 },
    grades: { overall: 'B', snf: 'B+', alf: 'B', hha: 'B+' },
    rankings: { national: { rank: 102, total: 879 }, state: { rank: 1, total: 22 } },
    archetype: 'HHA-Heavy',
    primary_opportunity: 'HHA',
    secondary_opportunity: 'SNF',
    tam: { total: 4200000000, formatted: '$4.2B', snf_medicare: 1280000000, snf_medicaid: 1220000000, hha_medicare: 1120000000, alf_private: 580000000 },
    demographics: { pop_total: 6091747, pop_65_plus: 1280000, pop_65_pct: 0.210, pop_85_plus: 168000, pop_65_growth_5yr: 0.178, median_household_income: 61200, median_home_value: 424000 },
    snf: { facility_count: 198, total_beds: 24800, avg_occupancy: 0.86, avg_overall_rating: 3.0, beds_per_1k_65: 19.4 },
    hha: { agency_count: 486, total_episodes: 284000, avg_quality_rating: 3.4, episodes_per_1k_65: 221.9 },
    alf: { facility_count: 842, total_capacity: 28400, capacity_per_1k_65: 22.2, supply_gap: 0.20 },
    competition: { snf: { hhi: 840, level: 'Low', top3_share: 0.18, operator_count: 82 }, hha: { hhi: 620, level: 'Low', top3_share: 0.14, operator_count: 198 } }
  },
  '45300': {
    cbsa_code: '45300',
    name: 'Tampa-St. Petersburg-Clearwater',
    state: 'FL',
    scores: { overall: 66.8, snf: 70.2, alf: 58.4, hha: 74.8 },
    grades: { overall: 'B', snf: 'B+', alf: 'C', hha: 'B+' },
    rankings: { national: { rank: 128, total: 879 }, state: { rank: 2, total: 22 } },
    archetype: 'HHA-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 2480000000, formatted: '$2.5B', snf_medicare: 760000000, snf_medicaid: 720000000, hha_medicare: 680000000, alf_private: 320000000 },
    demographics: { pop_total: 3175275, pop_65_plus: 724000, pop_65_pct: 0.228, pop_85_plus: 98200, pop_65_growth_5yr: 0.188, median_household_income: 58400, median_home_value: 348000 },
    snf: { facility_count: 124, total_beds: 14200, avg_occupancy: 0.84, avg_overall_rating: 3.1, beds_per_1k_65: 19.6 },
    hha: { agency_count: 298, total_episodes: 168000, avg_quality_rating: 3.5, episodes_per_1k_65: 232.0 },
    alf: { facility_count: 524, total_capacity: 16800, capacity_per_1k_65: 23.2, supply_gap: 0.22 },
    competition: { snf: { hhi: 980, level: 'Low', top3_share: 0.20, operator_count: 52 }, hha: { hhi: 720, level: 'Low', top3_share: 0.16, operator_count: 124 } }
  },
  '36740': {
    cbsa_code: '36740',
    name: 'Orlando-Kissimmee-Sanford',
    state: 'FL',
    scores: { overall: 64.2, snf: 66.8, alf: 56.4, hha: 72.4 },
    grades: { overall: 'B', snf: 'B', alf: 'C', hha: 'B+' },
    rankings: { national: { rank: 178, total: 879 }, state: { rank: 3, total: 22 } },
    archetype: 'HHA-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 1680000000, formatted: '$1.7B', snf_medicare: 520000000, snf_medicaid: 480000000, hha_medicare: 460000000, alf_private: 220000000 },
    demographics: { pop_total: 2691925, pop_65_plus: 462000, pop_65_pct: 0.172, pop_85_plus: 58400, pop_65_growth_5yr: 0.212, median_household_income: 62800, median_home_value: 368000 },
    snf: { facility_count: 86, total_beds: 9800, avg_occupancy: 0.82, avg_overall_rating: 3.0, beds_per_1k_65: 21.2 },
    hha: { agency_count: 198, total_episodes: 108000, avg_quality_rating: 3.4, episodes_per_1k_65: 233.8 },
    alf: { facility_count: 348, total_capacity: 10400, capacity_per_1k_65: 22.5, supply_gap: 0.24 },
    competition: { snf: { hhi: 1080, level: 'Low', top3_share: 0.22, operator_count: 38 }, hha: { hhi: 780, level: 'Low', top3_share: 0.18, operator_count: 86 } }
  },
  // New York Markets
  '35620': {
    cbsa_code: '35620',
    name: 'New York-Newark-Jersey City',
    state: 'NY',
    scores: { overall: 54.8, snf: 48.2, alf: 60.4, hha: 58.4 },
    grades: { overall: 'C', snf: 'D', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 482, total: 879 }, state: { rank: 1, total: 14 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 9800000000, formatted: '$9.8B', snf_medicare: 3800000000, snf_medicaid: 4200000000, hha_medicare: 1400000000, alf_private: 400000000 },
    demographics: { pop_total: 19261570, pop_65_plus: 2840000, pop_65_pct: 0.147, pop_85_plus: 398000, pop_65_growth_5yr: 0.118, median_household_income: 82400, median_home_value: 524000 },
    snf: { facility_count: 498, total_beds: 92400, avg_occupancy: 0.89, avg_overall_rating: 2.8, beds_per_1k_65: 32.5 },
    hha: { agency_count: 682, total_episodes: 428000, avg_quality_rating: 3.3, episodes_per_1k_65: 150.7 },
    alf: { facility_count: 424, total_capacity: 42800, capacity_per_1k_65: 15.1, supply_gap: 0.30 },
    competition: { snf: { hhi: 1680, level: 'Moderate', top3_share: 0.34, operator_count: 118 }, hha: { hhi: 1280, level: 'Low', top3_share: 0.28, operator_count: 268 } }
  },
  '15380': {
    cbsa_code: '15380',
    name: 'Buffalo-Cheektowaga',
    state: 'NY',
    scores: { overall: 50.2, snf: 44.8, alf: 56.2, hha: 52.8 },
    grades: { overall: 'C', snf: 'D', alf: 'C', hha: 'C' },
    rankings: { national: { rank: 568, total: 879 }, state: { rank: 2, total: 14 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 680000000, formatted: '$680M', snf_medicare: 268000000, snf_medicaid: 292000000, hha_medicare: 78000000, alf_private: 42000000 },
    demographics: { pop_total: 1166902, pop_65_plus: 212000, pop_65_pct: 0.182, pop_85_plus: 32400, pop_65_growth_5yr: 0.108, median_household_income: 58400, median_home_value: 198000 },
    snf: { facility_count: 68, total_beds: 12400, avg_occupancy: 0.86, avg_overall_rating: 2.9, beds_per_1k_65: 58.5 },
    hha: { agency_count: 42, total_episodes: 24800, avg_quality_rating: 3.2, episodes_per_1k_65: 117.0 },
    alf: { facility_count: 64, total_capacity: 4200, capacity_per_1k_65: 19.8, supply_gap: 0.24 },
    competition: { snf: { hhi: 2080, level: 'Moderate', top3_share: 0.42, operator_count: 24 }, hha: { hhi: 1820, level: 'Moderate', top3_share: 0.40, operator_count: 18 } }
  },
  // Pennsylvania Markets
  '37980': {
    cbsa_code: '37980',
    name: 'Philadelphia-Camden-Wilmington',
    state: 'PA',
    scores: { overall: 58.4, snf: 54.2, alf: 62.8, hha: 56.8 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 372, total: 879 }, state: { rank: 1, total: 16 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 3800000000, formatted: '$3.8B', snf_medicare: 1320000000, snf_medicaid: 1480000000, hha_medicare: 640000000, alf_private: 360000000 },
    demographics: { pop_total: 6228601, pop_65_plus: 1042000, pop_65_pct: 0.167, pop_85_plus: 142000, pop_65_growth_5yr: 0.132, median_household_income: 72800, median_home_value: 298000 },
    snf: { facility_count: 298, total_beds: 38400, avg_occupancy: 0.83, avg_overall_rating: 3.1, beds_per_1k_65: 36.9 },
    hha: { agency_count: 218, total_episodes: 148000, avg_quality_rating: 3.4, episodes_per_1k_65: 142.0 },
    alf: { facility_count: 524, total_capacity: 32400, capacity_per_1k_65: 31.1, supply_gap: 0.10 },
    competition: { snf: { hhi: 1180, level: 'Low', top3_share: 0.26, operator_count: 86 }, hha: { hhi: 1040, level: 'Low', top3_share: 0.24, operator_count: 98 } }
  },
  '38300': {
    cbsa_code: '38300',
    name: 'Pittsburgh',
    state: 'PA',
    scores: { overall: 54.2, snf: 50.8, alf: 58.4, hha: 52.4 },
    grades: { overall: 'C', snf: 'C', alf: 'C', hha: 'C' },
    rankings: { national: { rank: 498, total: 879 }, state: { rank: 2, total: 16 } },
    archetype: 'SNF-Heavy',
    primary_opportunity: 'HHA',
    secondary_opportunity: 'ALF',
    tam: { total: 1680000000, formatted: '$1.7B', snf_medicare: 580000000, snf_medicaid: 680000000, hha_medicare: 280000000, alf_private: 140000000 },
    demographics: { pop_total: 2370930, pop_65_plus: 478000, pop_65_pct: 0.202, pop_85_plus: 72400, pop_65_growth_5yr: 0.098, median_household_income: 62400, median_home_value: 186000 },
    snf: { facility_count: 168, total_beds: 22400, avg_occupancy: 0.81, avg_overall_rating: 3.0, beds_per_1k_65: 46.9 },
    hha: { agency_count: 108, total_episodes: 72400, avg_quality_rating: 3.3, episodes_per_1k_65: 151.5 },
    alf: { facility_count: 286, total_capacity: 16800, capacity_per_1k_65: 35.1, supply_gap: 0.08 },
    competition: { snf: { hhi: 1420, level: 'Low', top3_share: 0.30, operator_count: 54 }, hha: { hhi: 1340, level: 'Low', top3_share: 0.28, operator_count: 48 } }
  },
  // Ohio Markets
  '17460': {
    cbsa_code: '17460',
    name: 'Cleveland-Elyria',
    state: 'OH',
    scores: { overall: 56.8, snf: 52.4, alf: 62.2, hha: 54.2 },
    grades: { overall: 'C', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 428, total: 879 }, state: { rank: 1, total: 18 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'HHA',
    tam: { total: 1420000000, formatted: '$1.4B', snf_medicare: 480000000, snf_medicaid: 580000000, hha_medicare: 220000000, alf_private: 140000000 },
    demographics: { pop_total: 2048449, pop_65_plus: 378000, pop_65_pct: 0.185, pop_85_plus: 52400, pop_65_growth_5yr: 0.122, median_household_income: 58200, median_home_value: 178000 },
    snf: { facility_count: 168, total_beds: 18400, avg_occupancy: 0.80, avg_overall_rating: 3.2, beds_per_1k_65: 48.7 },
    hha: { agency_count: 98, total_episodes: 52400, avg_quality_rating: 3.4, episodes_per_1k_65: 138.6 },
    alf: { facility_count: 148, total_capacity: 8200, capacity_per_1k_65: 21.7, supply_gap: 0.18 },
    competition: { snf: { hhi: 1080, level: 'Low', top3_share: 0.22, operator_count: 58 }, hha: { hhi: 980, level: 'Low', top3_share: 0.20, operator_count: 52 } }
  },
  '18140': {
    cbsa_code: '18140',
    name: 'Columbus',
    state: 'OH',
    scores: { overall: 62.4, snf: 58.8, alf: 66.2, hha: 60.4 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'B' },
    rankings: { national: { rank: 208, total: 879 }, state: { rank: 2, total: 18 } },
    archetype: 'Balanced',
    primary_opportunity: 'SNF',
    secondary_opportunity: 'ALF',
    tam: { total: 1240000000, formatted: '$1.2B', snf_medicare: 420000000, snf_medicaid: 480000000, hha_medicare: 200000000, alf_private: 140000000 },
    demographics: { pop_total: 2138926, pop_65_plus: 298000, pop_65_pct: 0.139, pop_85_plus: 38400, pop_65_growth_5yr: 0.168, median_household_income: 66800, median_home_value: 248000 },
    snf: { facility_count: 142, total_beds: 14200, avg_occupancy: 0.78, avg_overall_rating: 3.4, beds_per_1k_65: 47.7 },
    hha: { agency_count: 86, total_episodes: 42400, avg_quality_rating: 3.6, episodes_per_1k_65: 142.3 },
    alf: { facility_count: 128, total_capacity: 7400, capacity_per_1k_65: 24.8, supply_gap: 0.14 },
    competition: { snf: { hhi: 1020, level: 'Low', top3_share: 0.22, operator_count: 52 }, hha: { hhi: 920, level: 'Low', top3_share: 0.20, operator_count: 42 } }
  },
  '17140': {
    cbsa_code: '17140',
    name: 'Cincinnati',
    state: 'OH',
    scores: { overall: 60.2, snf: 56.4, alf: 64.8, hha: 58.2 },
    grades: { overall: 'B', snf: 'C', alf: 'B', hha: 'C' },
    rankings: { national: { rank: 288, total: 879 }, state: { rank: 3, total: 18 } },
    archetype: 'Balanced',
    primary_opportunity: 'ALF',
    secondary_opportunity: 'SNF',
    tam: { total: 1180000000, formatted: '$1.2B', snf_medicare: 400000000, snf_medicaid: 460000000, hha_medicare: 190000000, alf_private: 130000000 },
    demographics: { pop_total: 2256884, pop_65_plus: 342000, pop_65_pct: 0.152, pop_85_plus: 44200, pop_65_growth_5yr: 0.148, median_household_income: 64200, median_home_value: 218000 },
    snf: { facility_count: 158, total_beds: 15800, avg_occupancy: 0.79, avg_overall_rating: 3.3, beds_per_1k_65: 46.2 },
    hha: { agency_count: 92, total_episodes: 48200, avg_quality_rating: 3.5, episodes_per_1k_65: 140.9 },
    alf: { facility_count: 138, total_capacity: 8400, capacity_per_1k_65: 24.6, supply_gap: 0.15 },
    competition: { snf: { hhi: 1120, level: 'Low', top3_share: 0.24, operator_count: 54 }, hha: { hhi: 1020, level: 'Low', top3_share: 0.22, operator_count: 46 } }
  }
};

/** Facility data for mock */
const MOCK_FACILITIES = {
  '14260': [
    { ccn: '131234', name: 'Boise Care & Rehabilitation', type: 'snf', overall_rating: 4, beds: 120, occupancy: 0.82, lat: 43.6150, lng: -116.2023, operator: 'Ensign Group' },
    { ccn: '131235', name: 'Cascadia Healthcare', type: 'snf', overall_rating: 3, beds: 98, occupancy: 0.75, lat: 43.5985, lng: -116.1892, operator: 'Cascadia Healthcare' },
    { ccn: '131236', name: 'Treasure Valley Manor', type: 'snf', overall_rating: 3, beds: 84, occupancy: 0.71, lat: 43.6042, lng: -116.2341, operator: 'Life Care Centers' },
    { ccn: 'HH1001', name: 'Boise Home Health Services', type: 'hha', quality_rating: 4, episodes: 1240, lat: 43.6187, lng: -116.2146, operator: 'Addus HomeCare' },
    { ccn: 'HH1002', name: 'Treasure Valley Home Care', type: 'hha', quality_rating: 3, episodes: 980, lat: 43.5923, lng: -116.1987, operator: 'Amedisys' },
    { ccn: 'ALF1001', name: 'Brookdale Boise', type: 'alf', capacity: 142, occupancy: 0.88, lat: 43.6234, lng: -116.2089, operator: 'Brookdale Senior Living' },
    { ccn: 'ALF1002', name: 'The Cottages of Boise', type: 'alf', capacity: 86, occupancy: 0.92, lat: 43.6078, lng: -116.2256, operator: 'Frontier Management' }
  ]
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get national map data with all states
 * @param {string} scoreType - 'overall' | 'snf' | 'alf' | 'hha'
 * @returns {Promise<{score_type, states, scale}>}
 */
export const getNationalMapData = async (scoreType = 'overall') => {
  if (USE_MOCK) {
    await mockDelay();

    const states = Object.values(MOCK_STATES).map(state => ({
      state_code: state.state_code,
      state_name: state.state_name,
      scores: state.scores,
      grades: state.grades,
      rankings: state.rankings,
      market_count: state.market_count,
      total_tam: state.total_tam,
      pop_65_plus: state.pop_65_plus
    }));

    // Add remaining states with generated data
    const additionalStates = [
      { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' }, { code: 'CO', name: 'Colorado' }, { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' }, { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' }, { code: 'OK', name: 'Oklahoma' }, { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
      { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
    ];

    let rankCounter = 11;
    additionalStates.forEach(s => {
      if (!MOCK_STATES[s.code]) {
        const overall = 38 + Math.random() * 30;
        states.push({
          state_code: s.code,
          state_name: s.name,
          scores: {
            overall: parseFloat(overall.toFixed(1)),
            snf: parseFloat((overall - 5 + Math.random() * 10).toFixed(1)),
            alf: parseFloat((overall + Math.random() * 8).toFixed(1)),
            hha: parseFloat((overall - 3 + Math.random() * 8).toFixed(1))
          },
          grades: {
            overall: scoreToGrade(overall),
            snf: scoreToGrade(overall - 5 + Math.random() * 10),
            alf: scoreToGrade(overall + Math.random() * 8),
            hha: scoreToGrade(overall - 3 + Math.random() * 8)
          },
          rankings: {
            overall: { rank: rankCounter, total: 51 },
            snf: { rank: Math.floor(Math.random() * 51) + 1, total: 51 },
            alf: { rank: Math.floor(Math.random() * 51) + 1, total: 51 },
            hha: { rank: Math.floor(Math.random() * 51) + 1, total: 51 }
          },
          market_count: Math.floor(Math.random() * 20) + 5,
          total_tam: Math.floor(Math.random() * 5000000000) + 500000000,
          pop_65_plus: Math.floor(Math.random() * 2000000) + 200000
        });
        rankCounter++;
      }
    });

    const scores = states.map(s => s.scores[scoreType]);

    return {
      score_type: scoreType,
      states,
      scale: {
        min: parseFloat(Math.min(...scores).toFixed(1)),
        max: parseFloat(Math.max(...scores).toFixed(1)),
        median: parseFloat((scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]).toFixed(1))
      },
      national_metrics: {
        beds_per_1k_65: 28.4,
        hha_per_1k_65: 4.2,
        avg_star_rating: 3.2,
        snf_tam: 98500000000, // $98.5B
        timely_initiation_pct: 0.876,
        pop_65_plus_pct: 0.167,
        total_facilities: 15234,
        total_markets: 879
      }
    };
  }

  const response = await axios.get(`${API_BASE}/national-map`, { params: { score_type: scoreType } });
  return response.data;
};

/**
 * Get state summary for hover card
 * @param {string} stateCode - Two-letter state code
 * @returns {Promise<object>}
 */
export const getStateSummary = async (stateCode) => {
  if (USE_MOCK) {
    await mockDelay();

    const state = MOCK_STATES[stateCode];

    // If state exists in detailed mock data, use it
    if (state) {
      const topMarket = state.markets?.[0]?.name || 'N/A';

      return {
        state_code: state.state_code,
        state_name: state.state_name,
        grades: {
          overall: { grade: state.grades.overall, score: state.scores.overall, rank: state.rankings.overall.rank, total: state.rankings.overall.total },
          snf: { grade: state.grades.snf, score: state.scores.snf, rank: state.rankings.snf.rank, total: state.rankings.snf.total },
          alf: { grade: state.grades.alf, score: state.scores.alf, rank: state.rankings.alf.rank, total: state.rankings.alf.total },
          hha: { grade: state.grades.hha, score: state.scores.hha, rank: state.rankings.hha.rank, total: state.rankings.hha.total }
        },
        highlights: {
          market_count: state.market_count,
          total_tam: formatCurrency(state.total_tam, true),
          top_market: topMarket,
          archetype_dominant: state.archetype
        }
      };
    }

    // Generate data for states not in MOCK_STATES
    const STATE_NAMES = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CO: 'Colorado',
      CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', GA: 'Georgia',
      HI: 'Hawaii', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
      KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
      MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
      NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
      NC: 'North Carolina', ND: 'North Dakota', OK: 'Oklahoma', RI: 'Rhode Island',
      SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', VT: 'Vermont',
      VA: 'Virginia', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
    };

    const stateName = STATE_NAMES[stateCode];
    if (!stateName) {
      throw new Error(`State not found: ${stateCode}`);
    }

    // Generate random but consistent scores based on state code
    const seed = stateCode.charCodeAt(0) + stateCode.charCodeAt(1);
    const overall = 35 + (seed % 35) + Math.random() * 10;
    const snfScore = overall - 5 + Math.random() * 10;
    const alfScore = overall + Math.random() * 8;
    const hhaScore = overall - 3 + Math.random() * 8;
    const rank = 11 + (seed % 40);

    return {
      state_code: stateCode,
      state_name: stateName,
      grades: {
        overall: { grade: scoreToGrade(overall), score: parseFloat(overall.toFixed(1)), rank: rank, total: 51 },
        snf: { grade: scoreToGrade(snfScore), score: parseFloat(snfScore.toFixed(1)), rank: Math.floor(Math.random() * 51) + 1, total: 51 },
        alf: { grade: scoreToGrade(alfScore), score: parseFloat(alfScore.toFixed(1)), rank: Math.floor(Math.random() * 51) + 1, total: 51 },
        hha: { grade: scoreToGrade(hhaScore), score: parseFloat(hhaScore.toFixed(1)), rank: Math.floor(Math.random() * 51) + 1, total: 51 }
      },
      highlights: {
        market_count: 5 + (seed % 20),
        total_tam: formatCurrency(500000000 + (seed * 50000000), true),
        top_market: `${stateName} Metro`,
        archetype_dominant: ['Balanced', 'SNF-Heavy', 'Home-Heavy'][seed % 3]
      }
    };
  }

  const response = await axios.get(`${API_BASE}/states/${stateCode}/summary`);
  return response.data;
};

/**
 * Get full state detail
 * @param {string} stateCode - Two-letter state code
 * @returns {Promise<object>}
 */
export const getStateDetail = async (stateCode) => {
  if (USE_MOCK) {
    await mockDelay();

    let state = MOCK_STATES[stateCode];

    // Generate mock state data for states not in MOCK_STATES
    if (!state) {
      const STATE_NAMES = {
        AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CO: 'Colorado',
        CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', GA: 'Georgia',
        HI: 'Hawaii', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
        KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
        MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
        NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
        NC: 'North Carolina', ND: 'North Dakota', OK: 'Oklahoma', RI: 'Rhode Island',
        SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', VT: 'Vermont',
        VA: 'Virginia', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
      };

      const stateName = STATE_NAMES[stateCode];
      if (!stateName) {
        throw new Error(`State not found: ${stateCode}`);
      }

      // Generate consistent random data based on state code
      const seed = stateCode.charCodeAt(0) + stateCode.charCodeAt(1);
      const overall = 35 + (seed % 35) + Math.random() * 10;
      const marketCount = 5 + (seed % 20);

      state = {
        state_code: stateCode,
        state_name: stateName,
        scores: {
          overall: parseFloat(overall.toFixed(1)),
          snf: parseFloat((overall - 5 + Math.random() * 10).toFixed(1)),
          alf: parseFloat((overall + Math.random() * 8).toFixed(1)),
          hha: parseFloat((overall - 3 + Math.random() * 8).toFixed(1))
        },
        grades: {
          overall: scoreToGrade(overall),
          snf: scoreToGrade(overall - 5 + Math.random() * 10),
          alf: scoreToGrade(overall + Math.random() * 8),
          hha: scoreToGrade(overall - 3 + Math.random() * 8)
        },
        rankings: {
          overall: { rank: 11 + (seed % 40), total: 51 },
          snf: { rank: Math.floor(Math.random() * 51) + 1, total: 51 },
          alf: { rank: Math.floor(Math.random() * 51) + 1, total: 51 },
          hha: { rank: Math.floor(Math.random() * 51) + 1, total: 51 }
        },
        market_count: marketCount,
        archetype: ['Balanced', 'SNF-Heavy', 'Home-Heavy'][seed % 3],
        primary_opportunity: ['ALF', 'SNF', 'HHA'][seed % 3],
        secondary_opportunity: ['SNF', 'HHA', 'ALF'][(seed + 1) % 3],
        demographics: {
          total_population: 1000000 + seed * 50000,
          pop_65_plus: 150000 + seed * 10000,
          pop_65_plus_pct: 0.14 + (seed % 10) / 100,
          pop_growth_rate: 0.005 + (seed % 20) / 1000,
          median_income: 50000 + seed * 500
        },
        snf: {
          facility_count: 50 + seed,
          total_beds: 5000 + seed * 100,
          beds_per_1k_65: 30 + (seed % 20),
          avg_occupancy: 0.75 + (seed % 15) / 100,
          avg_overall_rating: 3.0 + (seed % 20) / 10
        },
        hha: {
          agency_count: 30 + seed,
          total_patients: 10000 + seed * 200,
          timely_initiation_pct: 0.85 + (seed % 10) / 100
        },
        alf: {
          facility_count: 40 + seed,
          total_beds: 3000 + seed * 50
        },
        competition: {
          hhi: 1500 + seed * 30,
          top_5_share: 0.4 + (seed % 30) / 100
        },
        tam: {
          total: 500000000 + seed * 50000000,
          snf: 300000000 + seed * 30000000,
          hha: 150000000 + seed * 15000000,
          alf: 50000000 + seed * 5000000
        }
      };
    }

    // Build market data for map
    const stateMarkets = Object.values(MOCK_MARKETS).filter(m => m.state === stateCode);

    return {
      state_code: state.state_code,
      state_name: state.state_name,
      grades: state.grades,
      scores: state.scores,
      rankings: state.rankings,
      archetype: state.archetype,
      primary_opportunity: state.primary_opportunity,
      secondary_opportunity: state.secondary_opportunity,
      summary: {
        cbsa_count: state.market_count,
        non_cbsa_county_count: Math.floor(state.market_count * 0.3),
        grade_distribution: {
          'A+': Math.floor(state.market_count * 0.05),
          'A': Math.floor(state.market_count * 0.1),
          'B+': Math.floor(state.market_count * 0.15),
          'B': Math.floor(state.market_count * 0.2),
          'C': Math.floor(state.market_count * 0.3),
          'D': Math.floor(state.market_count * 0.15),
          'F': Math.floor(state.market_count * 0.05)
        },
        archetype_distribution: {
          'SNF-Heavy': Math.floor(state.market_count * 0.25),
          'HHA-Heavy': Math.floor(state.market_count * 0.2),
          'Home-Heavy': Math.floor(state.market_count * 0.25),
          'Balanced': Math.floor(state.market_count * 0.3)
        }
      },
      demographics: state.demographics,
      snf: state.snf,
      hha: state.hha,
      alf: state.alf,
      competition: state.competition,
      tam: state.tam,
      map_data: {
        cbsas: stateMarkets.length > 0
          ? stateMarkets.map(m => ({
              cbsa_code: m.cbsa_code,
              name: m.name,
              grade: m.grades.overall,
              score: m.scores.overall,
              lat: 40 + Math.random() * 10,
              lng: -120 + Math.random() * 30
            }))
          : // Generate mock CBSAs for states without MOCK_MARKETS data
            Array.from({ length: 3 + Math.floor(Math.random() * 5) }, (_, i) => {
              const score = 35 + Math.random() * 40;
              return {
                cbsa_code: `${stateCode}${10000 + i}`,
                name: `${state.state_name} Metro Area ${i + 1}`,
                grade: scoreToGrade(score),
                score: parseFloat(score.toFixed(1)),
                lat: 35 + Math.random() * 10,
                lng: -120 + Math.random() * 50
              };
            }),
        non_cbsa_counties: Array.from({ length: 2 + Math.floor(Math.random() * 4) }, (_, i) => {
          const score = 30 + Math.random() * 35;
          return {
            fips: `${stateCode}${20000 + i}`,
            name: `${state.state_name} Rural County ${i + 1}`,
            grade: scoreToGrade(score),
            score: parseFloat(score.toFixed(1)),
            lat: 35 + Math.random() * 10,
            lng: -120 + Math.random() * 50
          };
        })
      },
      top_markets: stateMarkets.slice(0, 5).map((m, i) => ({
        rank: i + 1,
        cbsa_code: m.cbsa_code,
        name: m.name,
        grade: m.grades.overall,
        score: m.scores.overall
      }))
    };
  }

  const response = await axios.get(`${API_BASE}/states/${stateCode}`);
  return response.data;
};

/**
 * Get full market detail
 * @param {string} cbsaCode - CBSA code
 * @returns {Promise<object>}
 */
export const getMarketDetail = async (cbsaCode) => {
  if (USE_MOCK) {
    await mockDelay();

    const market = MOCK_MARKETS[cbsaCode];
    if (!market) {
      throw new Error(`Market not found: ${cbsaCode}`);
    }

    return {
      cbsa_code: market.cbsa_code,
      name: market.name,
      state: market.state,
      grades: market.grades,
      scores: market.scores,
      rankings: market.rankings,
      archetype: market.archetype,
      primary_opportunity: market.primary_opportunity,
      secondary_opportunity: market.secondary_opportunity,
      tam: market.tam,
      demographics: market.demographics,
      snf: market.snf,
      hha: market.hha,
      alf: market.alf,
      competition: market.competition,
      score_breakdown: {
        demand: { score: market.scores.overall * 0.3, weight: 0.3, factors: ['pop_65_growth', 'utilization_rate'] },
        supply: { score: market.scores.overall * 0.25, weight: 0.25, factors: ['beds_per_1k', 'supply_gap'] },
        competition: { score: market.scores.overall * 0.25, weight: 0.25, factors: ['hhi', 'operator_count'] },
        economics: { score: market.scores.overall * 0.2, weight: 0.2, factors: ['median_income', 'reimbursement'] }
      },
      nearby_markets: Object.values(MOCK_MARKETS)
        .filter(m => m.state === market.state && m.cbsa_code !== cbsaCode)
        .slice(0, 3)
        .map(m => ({ cbsa_code: m.cbsa_code, name: m.name, grade: m.grades.overall, distance_miles: Math.floor(Math.random() * 100) + 20 }))
    };
  }

  const response = await axios.get(`${API_BASE}/markets/${cbsaCode}`);
  return response.data;
};

/**
 * Get paginated market list with filters
 * @param {object} params - Filter and pagination params
 * @returns {Promise<{total, limit, offset, data}>}
 */
export const getMarketList = async ({
  state = null,
  grade = null,
  archetype = null,
  minTam = null,
  sort = 'score',
  order = 'desc',
  limit = 50,
  offset = 0
} = {}) => {
  if (USE_MOCK) {
    await mockDelay();

    let markets = Object.values(MOCK_MARKETS).map(m => ({
      cbsa_code: m.cbsa_code,
      name: `${m.name}, ${m.state}`,
      state: m.state,
      grades: m.grades,
      scores: m.scores,
      tam: m.tam,
      archetype: m.archetype,
      primary_opportunity: m.primary_opportunity,
      rankings: m.rankings
    }));

    // Apply filters
    if (state) {
      markets = markets.filter(m => m.state === state);
    }
    if (grade) {
      markets = markets.filter(m => m.grades.overall === grade);
    }
    if (archetype) {
      markets = markets.filter(m => m.archetype === archetype);
    }
    if (minTam) {
      markets = markets.filter(m => m.tam.total >= minTam);
    }

    // Sort
    const sortKey = sort === 'score' ? 'scores' : sort === 'tam' ? 'tam' : 'scores';
    markets.sort((a, b) => {
      const aVal = sortKey === 'tam' ? a.tam.total : a.scores.overall;
      const bVal = sortKey === 'tam' ? b.tam.total : b.scores.overall;
      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    const total = markets.length;
    const data = markets.slice(offset, offset + limit);

    return { total, limit, offset, data };
  }

  const response = await axios.get(`${API_BASE}/markets`, {
    params: { state, grade, archetype, min_tam: minTam, sort, order, limit, offset }
  });
  return response.data;
};

/**
 * Search markets by name
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{query, results}>}
 */
export const searchMarkets = async (query, limit = 10) => {
  if (USE_MOCK) {
    await mockDelay();

    const lowerQuery = query.toLowerCase();
    const results = Object.values(MOCK_MARKETS)
      .filter(m => m.name.toLowerCase().includes(lowerQuery) || m.state.toLowerCase().includes(lowerQuery))
      .slice(0, limit)
      .map(m => ({
        cbsa_code: m.cbsa_code,
        name: `${m.name}, ${m.state}`,
        state: m.state,
        grade: m.grades.overall,
        score: m.scores.overall,
        match_type: m.name.toLowerCase().includes(lowerQuery) ? 'name' : 'state'
      }));

    return { query, results };
  }

  const response = await axios.get(`${API_BASE}/markets/search`, { params: { q: query, limit } });
  return response.data;
};

/**
 * Get facilities in a market
 * @param {string} cbsaCode - CBSA code
 * @param {string} type - 'all' | 'snf' | 'hha' | 'alf'
 * @param {string} sort - Sort field
 * @param {number} limit - Max results
 * @returns {Promise<array>}
 */
export const getMarketFacilities = async (cbsaCode, type = 'all', sort = 'name', limit = 100) => {
  if (USE_MOCK) {
    await mockDelay();

    let facilities = MOCK_FACILITIES[cbsaCode] || [];

    if (type !== 'all') {
      facilities = facilities.filter(f => f.type === type);
    }

    // Sort
    facilities.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'rating') return (b.overall_rating || b.quality_rating || 0) - (a.overall_rating || a.quality_rating || 0);
      return 0;
    });

    return facilities.slice(0, limit);
  }

  const response = await axios.get(`${API_BASE}/markets/${cbsaCode}/facilities`, {
    params: { type, sort, limit }
  });
  return response.data;
};

/**
 * Compare multiple markets side-by-side
 * @param {string[]} cbsaCodes - Array of CBSA codes (max 5)
 * @returns {Promise<array>}
 */
export const compareMarkets = async (cbsaCodes) => {
  if (USE_MOCK) {
    await mockDelay();

    const codes = cbsaCodes.slice(0, 5);
    const markets = codes.map(code => {
      const m = MOCK_MARKETS[code];
      if (!m) return null;
      return {
        cbsa_code: m.cbsa_code,
        name: `${m.name}, ${m.state}`,
        state: m.state,
        grades: m.grades,
        scores: m.scores,
        tam: m.tam,
        archetype: m.archetype,
        demographics: m.demographics,
        snf: m.snf,
        hha: m.hha,
        alf: m.alf,
        competition: m.competition
      };
    }).filter(Boolean);

    return markets;
  }

  const response = await axios.get(`${API_BASE}/markets/compare`, {
    params: { cbsa_codes: cbsaCodes.join(',') }
  });
  return response.data;
};

/**
 * Get filter options
 * @returns {Promise<object>}
 */
export const getFilterOptions = async () => {
  if (USE_MOCK) {
    await mockDelay();

    return {
      states: Object.values(MOCK_STATES).map(s => ({ code: s.state_code, name: s.state_name })),
      grades: ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'],
      archetypes: ['SNF-Heavy', 'HHA-Heavy', 'Home-Heavy', 'Balanced'],
      tam_ranges: [
        { label: 'Any', min: 0, max: null },
        { label: '$100M+', min: 100000000, max: null },
        { label: '$500M+', min: 500000000, max: null },
        { label: '$1B+', min: 1000000000, max: null }
      ]
    };
  }

  const response = await axios.get(`${API_BASE}/filters`);
  return response.data;
};

/**
 * Get top markets nationally or by state
 * @param {object} options
 * @returns {Promise<array>}
 */
export const getTopMarkets = async ({ limit = 10, state = null, scoreType = 'overall' } = {}) => {
  if (USE_MOCK) {
    await mockDelay();

    let markets = Object.values(MOCK_MARKETS);

    if (state) {
      markets = markets.filter(m => m.state === state);
    }

    markets.sort((a, b) => b.scores[scoreType] - a.scores[scoreType]);

    return markets.slice(0, limit).map((m, i) => ({
      rank: i + 1,
      cbsa_code: m.cbsa_code,
      name: `${m.name}, ${m.state}`,
      state: m.state,
      grade: m.grades[scoreType],
      score: m.scores[scoreType],
      tam: m.tam
    }));
  }

  const response = await axios.get(`${API_BASE}/top-markets`, {
    params: { limit, state, score_type: scoreType }
  });
  return response.data;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Config
  USE_MOCK,

  // Helpers
  formatCurrency,
  formatPercent,
  getGradeColor,
  scoreToGrade,

  // API Functions
  getNationalMapData,
  getStateSummary,
  getStateDetail,
  getMarketDetail,
  getMarketList,
  searchMarkets,
  getMarketFacilities,
  compareMarkets,
  getFilterOptions,
  getTopMarkets
};
