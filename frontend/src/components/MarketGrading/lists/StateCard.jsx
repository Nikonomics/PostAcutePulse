/**
 * StateCard.jsx
 *
 * Card component for state-level summary in the national view.
 * Shows state grade, market count, and top markets preview.
 *
 * Props:
 * - state: {
 *     code, name, grade, avgScore, marketCount,
 *     topMarkets, population65Plus
 *   }
 * - onClick: () => void
 * - showTopMarkets: boolean - show preview of top markets
 * - compact: boolean
 *
 * Usage:
 * <StateCard
 *   state={stateData}
 *   onClick={() => navigate(`/market-grading/state/${state.code}`)}
 * />
 */

import React from 'react';

const StateCard = ({
  state,
  onClick,
  showTopMarkets = true,
  compact = false
}) => {
  // TODO: Implement state card component
  return null;
};

export default StateCard;
