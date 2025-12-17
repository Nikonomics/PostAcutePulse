import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const DrillDownModal = ({ isOpen, onClose, title, icon: Icon, children }) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="drilldown-overlay" onClick={onClose}>
      <div className="drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drilldown-header">
          {Icon && <Icon size={20} />}
          <h3>{title}</h3>
          <button className="drilldown-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="drilldown-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
