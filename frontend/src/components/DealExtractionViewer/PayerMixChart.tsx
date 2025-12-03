import React from 'react';
import { PayerMixChartProps } from './types';
import { formatPercent } from './utils';

const PayerMixChart: React.FC<PayerMixChartProps> = ({
  medicaid,
  medicare,
  privatePay,
  title,
}) => {
  const medicaidVal = medicaid.value ?? 0;
  const medicareVal = medicare.value ?? 0;
  const privatePayVal = privatePay.value ?? 0;
  const total = medicaidVal + medicareVal + privatePayVal;

  // Normalize to 100% if values exist but don't sum to 100
  const medicaidPct = total > 0 ? (medicaidVal / total) * 100 : 0;
  const medicarePct = total > 0 ? (medicareVal / total) * 100 : 0;
  const privatePayPct = total > 0 ? (privatePayVal / total) * 100 : 0;

  const hasData = total > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>

      {hasData ? (
        <>
          {/* Stacked Bar Chart */}
          <div className="h-8 rounded-lg overflow-hidden flex mb-3">
            {medicaidPct > 0 && (
              <div
                className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
                style={{ width: `${medicaidPct}%` }}
                title={`Medicaid: ${formatPercent(medicaidVal)}`}
              >
                {medicaidPct >= 10 && `${medicaidVal}%`}
              </div>
            )}
            {medicarePct > 0 && (
              <div
                className="bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
                style={{ width: `${medicarePct}%` }}
                title={`Medicare: ${formatPercent(medicareVal)}`}
              >
                {medicarePct >= 10 && `${medicareVal}%`}
              </div>
            )}
            {privatePayPct > 0 && (
              <div
                className="bg-purple-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-300"
                style={{ width: `${privatePayPct}%` }}
                title={`Private Pay: ${formatPercent(privatePayVal)}`}
              >
                {privatePayPct >= 10 && `${privatePayVal}%`}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-gray-600">Medicaid</span>
              <span className="font-semibold text-gray-900">{formatPercent(medicaidVal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-600">Medicare</span>
              <span className="font-semibold text-gray-900">{formatPercent(medicareVal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-purple-500" />
              <span className="text-gray-600">Private Pay</span>
              <span className="font-semibold text-gray-900">{formatPercent(privatePayVal)}</span>
            </div>
          </div>

          {/* Source info */}
          {(medicaid.source || medicare.source || privatePay.source) && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Source:{' '}
                <span className="text-gray-500">
                  {medicaid.source || medicare.source || privatePay.source}
                </span>
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          No payer mix data available
        </div>
      )}
    </div>
  );
};

export default PayerMixChart;
