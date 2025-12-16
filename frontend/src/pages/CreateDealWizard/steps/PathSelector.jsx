import React from 'react';
import { Upload, FileEdit } from 'lucide-react';
import { useWizard, WIZARD_PATHS } from '../WizardContext';

const PathSelector = () => {
  const { selectPath } = useWizard();

  return (
    <div className="path-selector">
      <h2 className="path-selector-title">How would you like to create this deal?</h2>
      <p className="path-selector-subtitle">
        Choose to upload documents for AI analysis or enter information manually
      </p>

      <div className="path-options">
        {/* AI Upload Option */}
        <div
          className="path-option"
          onClick={() => selectPath(WIZARD_PATHS.AI)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && selectPath(WIZARD_PATHS.AI)}
        >
          <div className="path-option-icon">
            <Upload size={28} />
          </div>
          <h3 className="path-option-title">Upload Documents</h3>
          <p className="path-option-description">
            Upload CIM, P&L, or other deal documents. AI will extract facility and financial data automatically.
          </p>
        </div>

        {/* Manual Entry Option */}
        <div
          className="path-option"
          onClick={() => selectPath(WIZARD_PATHS.MANUAL)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && selectPath(WIZARD_PATHS.MANUAL)}
        >
          <div className="path-option-icon">
            <FileEdit size={28} />
          </div>
          <h3 className="path-option-title">Manual Entry</h3>
          <p className="path-option-description">
            Enter deal information manually. Best when you don't have documents yet or prefer direct input.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PathSelector;
