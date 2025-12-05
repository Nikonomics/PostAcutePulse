/**
 * Shared formatting utilities for consistent number display across the application
 */

/**
 * Format a value as currency
 * @param {number|null|undefined} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted currency string, negative values in parentheses
 */
export function formatCurrency(value, decimals = 0) {
  if (value === null || value === undefined) return 'N/A';
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return value < 0 ? `(${formatted})` : formatted;
}

/**
 * Format a value as a percentage
 * @param {number|null|undefined} value - The value to format (e.g., 85 for 85%)
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with locale-aware separators
 * @param {number|null|undefined} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a large currency value in compact notation (K, M, B)
 * @param {number|null|undefined} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted compact currency string
 */
export function formatCompactCurrency(value, decimals = 1) {
  if (value === null || value === undefined) return 'N/A';

  const absValue = Math.abs(value);
  let formatted;

  if (absValue >= 1e9) {
    formatted = `$${(absValue / 1e9).toFixed(decimals)}B`;
  } else if (absValue >= 1e6) {
    formatted = `$${(absValue / 1e6).toFixed(decimals)}M`;
  } else if (absValue >= 1e3) {
    formatted = `$${(absValue / 1e3).toFixed(decimals)}K`;
  } else {
    formatted = `$${absValue.toFixed(decimals)}`;
  }

  return value < 0 ? `(${formatted})` : formatted;
}
