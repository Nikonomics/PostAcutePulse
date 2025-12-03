import React from 'react';

const StatusBadge = ({ status }) => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'Due Diligence':
        return 'status-due-diligence';
      case 'Final Review':
        return 'status-final-review';
      case 'Pipeline':
        return 'status-pipeline';
      case 'Closed':
        return 'status-closed';
      default:
        return 'status-pipeline';
    }
  };

  return (
    <span className={`status-badge ${getStatusClass(status)}`}>
      <div className="status-dot"></div>
      {status}
    </span>
  );
};

export default StatusBadge;