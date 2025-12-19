import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import './TabStates.css';

/**
 * Reusable error state component for facility metric tabs
 *
 * @param {string} message - Error message to display
 * @param {function} onRetry - Optional retry callback function
 */
const TabError = ({
  message = 'Something went wrong. Please try again.',
  onRetry
}) => {
  return (
    <div className="tab-state tab-error">
      <div className="tab-state-icon error">
        <AlertCircle size={48} strokeWidth={1.5} />
      </div>
      <h3 className="tab-state-title">Error Loading Data</h3>
      <p className="tab-state-message">{message}</p>
      {onRetry && (
        <button
          className="tab-state-action retry"
          onClick={onRetry}
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      )}
    </div>
  );
};

export default TabError;
