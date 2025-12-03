import React from 'react';
import { ProFormaTableProps, ProFormaYear, ExtractedField } from './types';
import { formatCurrency, formatPercent, getConfidenceBgClass } from './utils';

interface RowData {
  label: string;
  year1: ExtractedField<number>;
  year2: ExtractedField<number>;
  year3: ExtractedField<number>;
  format: 'currency' | 'percent';
}

const ProFormaTable: React.FC<ProFormaTableProps> = ({ projections, showComparison = false }) => {
  const rows: RowData[] = [
    {
      label: 'Revenue',
      year1: projections.year_1.revenue,
      year2: projections.year_2.revenue,
      year3: projections.year_3.revenue,
      format: 'currency',
    },
    {
      label: 'EBITDAR',
      year1: projections.year_1.ebitdar,
      year2: projections.year_2.ebitdar,
      year3: projections.year_3.ebitdar,
      format: 'currency',
    },
    {
      label: 'EBITDA',
      year1: projections.year_1.ebitda,
      year2: projections.year_2.ebitda,
      year3: projections.year_3.ebitda,
      format: 'currency',
    },
    {
      label: 'EBIT',
      year1: projections.year_1.ebit,
      year2: projections.year_2.ebit,
      year3: projections.year_3.ebit,
      format: 'currency',
    },
    {
      label: 'Occupancy',
      year1: projections.year_1.occupancy_pct,
      year2: projections.year_2.occupancy_pct,
      year3: projections.year_3.occupancy_pct,
      format: 'percent',
    },
  ];

  const hasAnyData = rows.some(
    (row) =>
      row.year1.value !== null || row.year2.value !== null || row.year3.value !== null
  );

  const formatValue = (field: ExtractedField<number>, format: 'currency' | 'percent'): string => {
    if (field.value === null || field.value === undefined) return '—';
    return format === 'currency' ? formatCurrency(field.value) : formatPercent(field.value);
  };

  const getCellClasses = (field: ExtractedField<number>): string => {
    const hasValue = field.value !== null && field.confidence !== 'not_found';
    const isNegative = typeof field.value === 'number' && field.value < 0;
    return `px-4 py-3 whitespace-nowrap text-sm text-right ${
      isNegative ? 'text-red-600' : hasValue ? 'text-gray-900 font-medium' : 'text-gray-400'
    }`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Metric
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Year 1
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Year 2
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Year 3
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {hasAnyData ? (
              rows.map((row, index) => (
                <tr key={row.label} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {row.label}
                  </td>
                  <td className={getCellClasses(row.year1)}>
                    <div className="flex items-center justify-end gap-2">
                      {formatValue(row.year1, row.format)}
                      {row.year1.value !== null && (
                        <span
                          className={`w-2 h-2 rounded-full ${getConfidenceBgClass(row.year1.confidence)}`}
                          title={row.year1.confidence}
                        />
                      )}
                    </div>
                  </td>
                  <td className={getCellClasses(row.year2)}>
                    <div className="flex items-center justify-end gap-2">
                      {formatValue(row.year2, row.format)}
                      {row.year2.value !== null && (
                        <span
                          className={`w-2 h-2 rounded-full ${getConfidenceBgClass(row.year2.confidence)}`}
                          title={row.year2.confidence}
                        />
                      )}
                    </div>
                  </td>
                  <td className={getCellClasses(row.year3)}>
                    <div className="flex items-center justify-end gap-2">
                      {formatValue(row.year3, row.format)}
                      {row.year3.value !== null && (
                        <span
                          className={`w-2 h-2 rounded-full ${getConfidenceBgClass(row.year3.confidence)}`}
                          title={row.year3.confidence}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No pro forma projection data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {hasAnyData && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium">Confidence:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Not Found</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProFormaTable;
