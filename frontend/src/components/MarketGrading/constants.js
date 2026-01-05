/**
 * constants.js
 *
 * Shared constants and helper functions for the Market Grading feature.
 * Contains color schemes, thresholds, and utility functions.
 */

// ============================================================================
// GRADE COLORS
// ============================================================================

/**
 * Color scheme for letter grades
 * Used in GradeBadge, map legends, and table cells
 */
export const GRADE_COLORS = {
  'A+': { bg: '#15803d', text: 'white', label: 'Exceptional' },
  A: { bg: '#22c55e', text: 'white', label: 'Excellent' },
  'B+': { bg: '#65a30d', text: 'white', label: 'Very Good' },
  B: { bg: '#84cc16', text: 'white', label: 'Good' },
  C: { bg: '#eab308', text: 'black', label: 'Average' },
  D: { bg: '#f97316', text: 'white', label: 'Below Average' },
  F: { bg: '#ef4444', text: 'white', label: 'Poor' }
};

// ============================================================================
// SCORE THRESHOLDS
// ============================================================================

/**
 * Thresholds for converting numeric scores to letter grades
 * Score ranges: A+ (90+), A (80-89), B+ (70-79), B (60-69), C (50-59), D (40-49), F (<40)
 */
export const SCORE_THRESHOLDS = {
  'A+': 90, // score >= 90
  A: 80,    // score >= 80
  'B+': 70, // score >= 70
  B: 60,    // score >= 60
  C: 50,    // score >= 50
  D: 40,    // score >= 40
  F: 0      // score < 40
};

// ============================================================================
// QUADRANT COLORS
// ============================================================================

/**
 * Colors for market quadrant analysis
 * Used in QuadrantDisplay component
 *
 * Quadrants based on growth + competition:
 * - CRISIS: Low growth, High competition (avoid)
 * - OPPORTUNITY: High growth, Low competition (target)
 * - DECLINING: Low growth, Low competition (cautious)
 * - STABLE: High growth, High competition (selective)
 */
export const QUADRANT_COLORS = {
  CRISIS: '#ef4444',      // Red - Low growth, High competition
  OPPORTUNITY: '#22c55e', // Green - High growth, Low competition
  DECLINING: '#f97316',   // Orange - Low growth, Low competition
  STABLE: '#3b82f6'       // Blue - High growth, High competition
};

/**
 * Quadrant labels and descriptions
 */
export const QUADRANT_INFO = {
  CRISIS: {
    color: '#ef4444',
    label: 'Crisis',
    description: 'Low growth, high competition - avoid or exit'
  },
  OPPORTUNITY: {
    color: '#22c55e',
    label: 'Opportunity',
    description: 'High growth, low competition - prime targets'
  },
  DECLINING: {
    color: '#f97316',
    label: 'Declining',
    description: 'Low growth, low competition - proceed with caution'
  },
  STABLE: {
    color: '#3b82f6',
    label: 'Stable',
    description: 'High growth, high competition - selective entry'
  }
};

// ============================================================================
// HHI (HERFINDAHL-HIRSCHMAN INDEX) LEVELS
// ============================================================================

/**
 * HHI concentration thresholds per DOJ/FTC guidelines
 * - Unconcentrated: HHI < 1500
 * - Moderate: 1500 <= HHI < 2500
 * - Concentrated: HHI >= 2500
 */
export const HHI_LEVELS = {
  UNCONCENTRATED: { max: 1500, color: '#22c55e', label: 'Unconcentrated' },
  MODERATE: { max: 2500, color: '#eab308', label: 'Moderate' },
  CONCENTRATED: { max: 10000, color: '#ef4444', label: 'Concentrated' }
};

// ============================================================================
// ARCHETYPES
// ============================================================================

/**
 * Market archetype definitions
 * Describes the dominant care delivery model in a market
 */
export const ARCHETYPES = {
  'Home-Heavy': {
    icon: '🏠',
    color: '#3b82f6',
    label: 'Home-Heavy',
    description: 'Higher home health utilization relative to institutional care'
  },
  'SNF-Heavy': {
    icon: '🏥',
    color: '#8b5cf6',
    label: 'SNF-Heavy',
    description: 'Higher skilled nursing utilization relative to home care'
  },
  'HHA-Heavy': {
    icon: '🏠',
    color: '#06b6d4',
    label: 'HHA-Heavy',
    description: 'Home health agency dominant market'
  },
  Institutional: {
    icon: '🏥',
    color: '#8b5cf6',
    label: 'Institutional',
    description: 'Facility-based care dominant'
  },
  Balanced: {
    icon: '⚖️',
    color: '#6b7280',
    label: 'Balanced',
    description: 'Relatively even mix of care settings'
  }
};

// ============================================================================
// CARE TYPES
// ============================================================================

/**
 * Post-acute care type definitions
 */
export const CARE_TYPES = {
  SNF: {
    color: '#8b5cf6',
    bgLight: '#f3e8ff',
    label: 'Skilled Nursing',
    shortLabel: 'SNF',
    description: 'Skilled Nursing Facilities'
  },
  ALF: {
    color: '#06b6d4',
    bgLight: '#cffafe',
    label: 'Assisted Living',
    shortLabel: 'ALF',
    description: 'Assisted Living Facilities'
  },
  HHA: {
    color: '#f59e0b',
    bgLight: '#fef3c7',
    label: 'Home Health',
    shortLabel: 'HHA',
    description: 'Home Health Agencies'
  }
};

// ============================================================================
// MAP CONFIGURATION
// ============================================================================

/**
 * Color scale for choropleth maps
 * Gradient from red (low scores) to green (high scores)
 */
export const MAP_COLOR_SCALE = [
  { score: 0, color: '#ef4444' },   // Red
  { score: 40, color: '#f87171' },  // Light red/pink
  { score: 50, color: '#f59e0b' },  // Orange
  { score: 55, color: '#eab308' },  // Yellow
  { score: 65, color: '#84cc16' },  // Lime
  { score: 75, color: '#22c55e' },  // Green
  { score: 100, color: '#16a34a' }  // Dark green
];

/**
 * Default map center and zoom levels
 */
export const MAP_DEFAULTS = {
  US_CENTER: { lat: 39.8283, lng: -98.5795 },
  US_ZOOM: 4,
  STATE_ZOOM: 6,
  MARKET_ZOOM: 10
};

// ============================================================================
// RANKING TIERS
// ============================================================================

/**
 * Ranking tier definitions for markets
 */
export const RANKING_TIERS = {
  TOP_10: { label: 'Top 10', color: '#22c55e', icon: '🥇' },
  TOP_25: { label: 'Top 25', color: '#84cc16', icon: '🥈' },
  TOP_50: { label: 'Top 50', color: '#eab308', icon: '🥉' },
  TOP_100: { label: 'Top 100', color: '#f97316', icon: '' },
  OTHER: { label: '', color: '#6b7280', icon: '' }
};

// ============================================================================
// TAM (TOTAL ADDRESSABLE MARKET) TIERS
// ============================================================================

/**
 * TAM size tier definitions
 */
export const TAM_TIERS = {
  MEGA: { min: 5000000000, label: '$5B+', color: '#15803d' },
  LARGE: { min: 1000000000, label: '$1B+', color: '#22c55e' },
  MEDIUM: { min: 500000000, label: '$500M+', color: '#84cc16' },
  SMALL: { min: 100000000, label: '$100M+', color: '#eab308' },
  MICRO: { min: 0, label: '<$100M', color: '#f97316' }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get letter grade from numeric score
 * @param {number} score - Score from 0-100
 * @returns {string} Letter grade (A+, A, B+, B, C, D, F)
 */
export const getGradeFromScore = (score) => {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  if (score >= SCORE_THRESHOLDS['A+']) return 'A+';
  if (score >= SCORE_THRESHOLDS.A) return 'A';
  if (score >= SCORE_THRESHOLDS['B+']) return 'B+';
  if (score >= SCORE_THRESHOLDS.B) return 'B';
  if (score >= SCORE_THRESHOLDS.C) return 'C';
  if (score >= SCORE_THRESHOLDS.D) return 'D';
  return 'F';
};

/**
 * Get HHI level information from HHI value
 * @param {number} hhi - HHI value (0-10000)
 * @returns {{ level: string, color: string, label: string }}
 */
export const getHHILevel = (hhi) => {
  if (hhi === null || hhi === undefined || isNaN(hhi)) {
    return { level: 'UNKNOWN', color: '#6b7280', label: 'Unknown' };
  }
  if (hhi < HHI_LEVELS.UNCONCENTRATED.max) {
    return { level: 'UNCONCENTRATED', ...HHI_LEVELS.UNCONCENTRATED };
  }
  if (hhi < HHI_LEVELS.MODERATE.max) {
    return { level: 'MODERATE', ...HHI_LEVELS.MODERATE };
  }
  return { level: 'CONCENTRATED', ...HHI_LEVELS.CONCENTRATED };
};

/**
 * Get grade color configuration
 * @param {string} grade - Letter grade
 * @returns {{ bg: string, text: string, label: string }}
 */
export const getGradeColor = (grade) => {
  return GRADE_COLORS[grade] || { bg: '#6b7280', text: 'white', label: 'Unknown' };
};

/**
 * Get care type configuration
 * @param {string} type - Care type (SNF, ALF, HHA)
 * @returns {{ color: string, bgLight: string, label: string, shortLabel: string }}
 */
export const getCareTypeConfig = (type) => {
  return CARE_TYPES[type?.toUpperCase()] || {
    color: '#6b7280',
    bgLight: '#f3f4f6',
    label: type || 'Unknown',
    shortLabel: type || '?'
  };
};

/**
 * Get archetype configuration
 * @param {string} archetype - Market archetype
 * @returns {{ icon: string, color: string, label: string, description: string }}
 */
export const getArchetypeConfig = (archetype) => {
  return ARCHETYPES[archetype] || {
    icon: '❓',
    color: '#6b7280',
    label: archetype || 'Unknown',
    description: 'Unknown archetype'
  };
};

/**
 * Get quadrant information based on growth and competition metrics
 * @param {number} growth - Growth score (0-100, higher = more growth)
 * @param {number} competition - Competition score (0-100, higher = more competitive)
 * @returns {{ quadrant: string, color: string, label: string, description: string }}
 */
export const getQuadrant = (growth, competition) => {
  const highGrowth = growth >= 50;
  const highCompetition = competition >= 50;

  if (highGrowth && !highCompetition) {
    return { quadrant: 'OPPORTUNITY', ...QUADRANT_INFO.OPPORTUNITY };
  }
  if (highGrowth && highCompetition) {
    return { quadrant: 'STABLE', ...QUADRANT_INFO.STABLE };
  }
  if (!highGrowth && !highCompetition) {
    return { quadrant: 'DECLINING', ...QUADRANT_INFO.DECLINING };
  }
  return { quadrant: 'CRISIS', ...QUADRANT_INFO.CRISIS };
};

/**
 * Get ranking tier for a market
 * @param {number} rank - Market rank
 * @param {number} total - Total markets
 * @returns {{ label: string, color: string, icon: string }}
 */
export const getRankingTier = (rank, total) => {
  if (!rank || !total) return RANKING_TIERS.OTHER;
  const percentile = (rank / total) * 100;
  if (rank <= 10) return RANKING_TIERS.TOP_10;
  if (rank <= 25) return RANKING_TIERS.TOP_25;
  if (rank <= 50) return RANKING_TIERS.TOP_50;
  if (percentile <= 11.4) return RANKING_TIERS.TOP_100; // ~100/879
  return RANKING_TIERS.OTHER;
};

/**
 * Get TAM tier for a market
 * @param {number} tam - Total addressable market value
 * @returns {{ min: number, label: string, color: string }}
 */
export const getTAMTier = (tam) => {
  if (!tam || isNaN(tam)) return TAM_TIERS.MICRO;
  if (tam >= TAM_TIERS.MEGA.min) return TAM_TIERS.MEGA;
  if (tam >= TAM_TIERS.LARGE.min) return TAM_TIERS.LARGE;
  if (tam >= TAM_TIERS.MEDIUM.min) return TAM_TIERS.MEDIUM;
  if (tam >= TAM_TIERS.SMALL.min) return TAM_TIERS.SMALL;
  return TAM_TIERS.MICRO;
};

/**
 * Interpolate color from score using MAP_COLOR_SCALE
 * @param {number} score - Score from 0-100
 * @returns {string} Hex color
 */
export const getScoreColor = (score) => {
  if (score === null || score === undefined || isNaN(score)) return '#6b7280';

  // Clamp score to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Find surrounding colors
  let lower = MAP_COLOR_SCALE[0];
  let upper = MAP_COLOR_SCALE[MAP_COLOR_SCALE.length - 1];

  for (let i = 0; i < MAP_COLOR_SCALE.length - 1; i++) {
    if (clampedScore >= MAP_COLOR_SCALE[i].score && clampedScore <= MAP_COLOR_SCALE[i + 1].score) {
      lower = MAP_COLOR_SCALE[i];
      upper = MAP_COLOR_SCALE[i + 1];
      break;
    }
  }

  // If score matches exactly, return that color
  if (clampedScore === lower.score) return lower.color;
  if (clampedScore === upper.score) return upper.color;

  // Interpolate between colors
  const range = upper.score - lower.score;
  const ratio = (clampedScore - lower.score) / range;

  // Parse hex colors
  const lowerRGB = hexToRGB(lower.color);
  const upperRGB = hexToRGB(upper.color);

  // Interpolate RGB values
  const r = Math.round(lowerRGB.r + (upperRGB.r - lowerRGB.r) * ratio);
  const g = Math.round(lowerRGB.g + (upperRGB.g - lowerRGB.g) * ratio);
  const b = Math.round(lowerRGB.b + (upperRGB.b - lowerRGB.b) * ratio);

  return rgbToHex(r, g, b);
};

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color string
 * @returns {{ r: number, g: number, b: number }}
 */
const hexToRGB = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

/**
 * Convert RGB to hex color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string
 */
const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Colors
  GRADE_COLORS,
  QUADRANT_COLORS,
  QUADRANT_INFO,
  HHI_LEVELS,
  CARE_TYPES,
  ARCHETYPES,
  MAP_COLOR_SCALE,

  // Thresholds & Tiers
  SCORE_THRESHOLDS,
  RANKING_TIERS,
  TAM_TIERS,

  // Configuration
  MAP_DEFAULTS,

  // Helper Functions
  getGradeFromScore,
  getGradeColor,
  getHHILevel,
  getCareTypeConfig,
  getArchetypeConfig,
  getQuadrant,
  getRankingTier,
  getTAMTier,
  getScoreColor
};
