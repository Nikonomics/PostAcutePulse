import React, { useState } from 'react';
import { Info, AlertTriangle, Calculator } from 'lucide-react';
import { ConfidenceIndicatorProps } from './types';
import {
  getConfidenceBgClass,
  getConfidenceLabel,
  getConfidenceExplanation,
} from './utils';

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  calculated = false,
  conflictDetails,
  source,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const isConflict = confidence === 'conflict';
  const bgClass = getConfidenceBgClass(confidence);

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Calculated badge */}
      {calculated && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
          title="Calculated from other fields"
        >
          <Calculator size={10} className="mr-0.5" />
          calc
        </span>
      )}

      {/* Confidence dot or warning icon */}
      {isConflict ? (
        <AlertTriangle
          size={14}
          className="text-orange-500 cursor-help"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        />
      ) : (
        <span
          className={`w-2.5 h-2.5 rounded-full ${bgClass} cursor-help`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        />
      )}

      {/* Info icon */}
      <Info
        size={14}
        className="text-gray-400 cursor-help hover:text-gray-600 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg"
          style={{ minWidth: '240px' }}
        >
          {/* Arrow */}
          <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45" />

          {/* Confidence level */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${bgClass}`} />
            <span className="font-semibold">{getConfidenceLabel(confidence)}</span>
          </div>

          {/* Explanation */}
          <p className="text-gray-300 mb-2">{getConfidenceExplanation(confidence)}</p>

          {/* Conflict details if applicable */}
          {isConflict && conflictDetails && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-orange-300 font-medium">Conflict Details:</p>
              <p className="text-gray-300">{conflictDetails}</p>
            </div>
          )}

          {/* Calculated explanation */}
          {calculated && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-blue-300 font-medium">Calculated Value</p>
              <p className="text-gray-300">This value was derived from other extracted fields.</p>
            </div>
          )}

          {/* Source */}
          {source && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-gray-400">
                Source: <span className="text-gray-200">{source}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfidenceIndicator;
