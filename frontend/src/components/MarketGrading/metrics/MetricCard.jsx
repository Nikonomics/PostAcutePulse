/**
 * MetricCard.jsx
 *
 * Reusable card component for displaying a single metric with
 * value, label, trend indicator, and optional comparison.
 *
 * Props:
 * - label: string
 * - value: number | string
 * - format: 'number' | 'percent' | 'currency' | 'score'
 * - trend: 'up' | 'down' | 'stable' | null
 * - trendValue: number (change amount)
 * - comparison: { value, label } - benchmark comparison
 * - icon: React component
 * - color: string - accent color
 *
 * Usage:
 * <MetricCard
 *   label="Population 65+"
 *   value={125000}
 *   format="number"
 *   trend="up"
 *   trendValue={5.2}
 * />
 */

import React from 'react';

const MetricCard = ({
  label,
  value,
  format = 'number',
  trend,
  trendValue,
  comparison,
  icon,
  color
}) => {
  // TODO: Implement metric card component
  return null;
};

export default MetricCard;
