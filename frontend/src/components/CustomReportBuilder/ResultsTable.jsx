/**
 * ResultsTable Component
 *
 * Displays query results in a scrollable table.
 * Supports sorting, formatting, and export.
 */
import React, { useState, useMemo } from 'react';
import {
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Loader2,
  Table as TableIcon,
  FileSpreadsheet,
} from 'lucide-react';

/**
 * Format cell value based on type
 */
function formatValue(value, columnName) {
  if (value === null || value === undefined) {
    return '—';
  }

  // Detect percentages
  if (columnName.toLowerCase().includes('rate') ||
      columnName.toLowerCase().includes('percent') ||
      columnName.toLowerCase().includes('pct')) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return `${num.toFixed(1)}%`;
    }
  }

  // Detect currency/large numbers
  if (columnName.toLowerCase().includes('revenue') ||
      columnName.toLowerCase().includes('income') ||
      columnName.toLowerCase().includes('cost')) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(num);
    }
  }

  // Numbers
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // Dates
  if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  }

  return String(value);
}

/**
 * Format column header from snake_case
 */
function formatHeader(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Export data to CSV
 */
function exportToCsv(data, columns, filename = 'report') {
  if (!data || data.length === 0) return;

  const headers = columns.join(',');
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Main ResultsTable component
 */
export default function ResultsTable({
  data,
  loading,
  error,
  executionTime,
  onRunQuery,
  queryValid,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Get columns from data
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!data || !sortColumn) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle nulls
      if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="results-table">
      <div className="results-header">
        <div className="results-title">
          <TableIcon size={16} />
          <h3>Results</h3>
          {data && (
            <span className="row-count">
              {data.length.toLocaleString()} rows
              {executionTime && <span className="exec-time">({executionTime}ms)</span>}
            </span>
          )}
        </div>

        <div className="results-actions">
          <button
            className="run-btn"
            onClick={onRunQuery}
            disabled={loading || !queryValid}
          >
            {loading ? <Loader2 size={14} className="spin" /> : null}
            {loading ? 'Running...' : 'Run Query'}
          </button>

          {data && data.length > 0 && (
            <button
              className="export-btn"
              onClick={() => exportToCsv(data, columns, 'custom_report')}
            >
              <FileSpreadsheet size={14} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="results-content">
        {loading && (
          <div className="results-loading">
            <Loader2 size={32} className="spin" />
            <span>Executing query...</span>
          </div>
        )}

        {error && (
          <div className="results-error">
            <AlertCircle size={20} />
            <div>
              <strong>Query Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="results-empty">
            <TableIcon size={32} />
            <p>Add dimensions or metrics and run your query to see results</p>
          </div>
        )}

        {!loading && !error && data && data.length === 0 && (
          <div className="results-empty">
            <AlertCircle size={32} />
            <p>Query returned no results. Try adjusting your filters.</p>
          </div>
        )}

        {!loading && !error && sortedData && sortedData.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col} onClick={() => handleSort(col)}>
                      <div className="th-content">
                        <span>{formatHeader(col)}</span>
                        {sortColumn === col ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ArrowUpDown size={12} className="sort-hint" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col}>{formatValue(row[col], col)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
