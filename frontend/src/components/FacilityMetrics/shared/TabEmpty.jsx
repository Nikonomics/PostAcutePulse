import React from 'react';
import { FileX } from 'lucide-react';
import './TabStates.css';

/**
 * Reusable empty state component for facility metric tabs
 *
 * @param {ReactNode} icon - Lucide icon component to display
 * @param {string} title - Main heading text
 * @param {string} message - Descriptive subtitle text
 * @param {Object} action - Optional action button { label: string, onClick: function }
 */
const TabEmpty = ({
  icon,
  title = 'No Data Available',
  message = 'Data is not available for this facility.',
  action
}) => {
  return (
    <div className="tab-state tab-empty">
      <div className="tab-state-icon">
        {icon || <FileX size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="tab-state-title">{title}</h3>
      <p className="tab-state-message">{message}</p>
      {action && (
        <button
          className="tab-state-action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default TabEmpty;
