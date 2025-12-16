import React from 'react';
import { Check } from 'lucide-react';
import { useWizard } from '../WizardContext';

const StepIndicator = ({ labels }) => {
  const { getCurrentStepIndex } = useWizard();
  const currentIndex = getCurrentStepIndex();

  // Adjust index since path_select is step 0 but not shown in indicator
  // For AI path: document_upload is step 1 (index 0 in labels)
  // For Manual path: deal_basics is step 1 (index 0 in labels)
  const adjustedIndex = currentIndex - 1; // Subtract 1 to account for path_select

  return (
    <div className="step-indicator">
      {labels.map((label, index) => {
        const isCompleted = index < adjustedIndex;
        const isActive = index === adjustedIndex;
        const isPending = index > adjustedIndex;

        return (
          <div key={label} className="step-indicator-item">
            <div
              className={`step-circle ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
            >
              {isCompleted ? <Check size={16} /> : index + 1}
            </div>
            <span
              className={`step-label ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              {label}
            </span>
            {index < labels.length - 1 && (
              <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
