import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { FileText, AlertCircle, Loader } from 'lucide-react';

// Excel Preview Component
// eslint-disable-next-line no-unused-vars
export const ExcelPreview = ({ url, fileName }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    const fetchAndParseExcel = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        // Parse all sheets
        const sheets = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          return {
            name: sheetName,
            data: jsonData
          };
        });

        setData(sheets);
      } catch (err) {
        console.error('Excel parsing error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchAndParseExcel();
    }
  }, [url]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader size={32} style={styles.spinner} />
        <p>Loading Excel file...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <p>Failed to load Excel file: {error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={styles.errorContainer}>
        <FileText size={32} style={{ color: '#6b7280' }} />
        <p>No data found in Excel file</p>
      </div>
    );
  }

  const currentSheet = data[activeSheet];

  return (
    <div style={styles.excelContainer}>
      {/* Sheet tabs */}
      {data.length > 1 && (
        <div style={styles.sheetTabs}>
          {data.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              style={{
                ...styles.sheetTab,
                ...(activeSheet === index ? styles.sheetTabActive : {})
              }}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Data table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <tbody>
            {currentSheet.data.slice(0, 100).map((row, rowIndex) => (
              <tr key={rowIndex} style={rowIndex === 0 ? styles.headerRow : {}}>
                {row.map((cell, cellIndex) => (
                  rowIndex === 0 ? (
                    <th key={cellIndex} style={styles.headerCell}>
                      {cell !== undefined ? String(cell) : ''}
                    </th>
                  ) : (
                    <td key={cellIndex} style={styles.cell}>
                      {cell !== undefined ? String(cell) : ''}
                    </td>
                  )
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {currentSheet.data.length > 100 && (
          <div style={styles.truncatedNotice}>
            Showing first 100 rows of {currentSheet.data.length} total rows
          </div>
        )}
      </div>
    </div>
  );
};

// Word Preview Component
// eslint-disable-next-line no-unused-vars
export const WordPreview = ({ url, fileName }) => {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndParseWord = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (result.messages.length > 0) {
          console.log('Mammoth conversion messages:', result.messages);
        }

        setHtml(result.value);
      } catch (err) {
        console.error('Word parsing error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchAndParseWord();
    }
  }, [url]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader size={32} style={styles.spinner} />
        <p>Loading Word document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <p>Failed to load Word document: {error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={styles.errorContainer}>
        <FileText size={32} style={{ color: '#6b7280' }} />
        <p>No content found in Word document</p>
      </div>
    );
  }

  return (
    <div style={styles.wordContainer}>
      <div
        style={styles.wordContent}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

// Styles
const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#6b7280',
    height: '100%',
    minHeight: '300px',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
    color: '#3b82f6',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    backgroundColor: '#fef2f2',
    borderRadius: '0.5rem',
    color: '#991b1b',
    minHeight: '200px',
  },
  excelContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'white',
  },
  sheetTabs: {
    display: 'flex',
    gap: '0.25rem',
    padding: '0.5rem',
    backgroundColor: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    overflowX: 'auto',
  },
  sheetTab: {
    padding: '0.5rem 1rem',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderBottom: 'none',
    borderRadius: '0.375rem 0.375rem 0 0',
    fontSize: '0.875rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  sheetTabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6',
  },
  tableWrapper: {
    flex: 1,
    overflow: 'auto',
    padding: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
  },
  headerRow: {
    backgroundColor: '#f9fafb',
    position: 'sticky',
    top: 0,
  },
  headerCell: {
    padding: '0.5rem 0.75rem',
    borderBottom: '2px solid #e5e7eb',
    textAlign: 'left',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    backgroundColor: '#f9fafb',
  },
  cell: {
    padding: '0.375rem 0.75rem',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  truncatedNotice: {
    padding: '1rem',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '0.875rem',
    backgroundColor: '#f3f4f6',
    borderTop: '1px solid #e5e7eb',
  },
  wordContainer: {
    padding: '1.5rem',
    backgroundColor: 'white',
    height: '100%',
    overflow: 'auto',
  },
  wordContent: {
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'Georgia, "Times New Roman", serif',
    lineHeight: 1.6,
    color: '#1f2937',
  },
};

// Add CSS keyframes for spinner animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .word-preview-content h1, .word-preview-content h2, .word-preview-content h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .word-preview-content p {
    margin-bottom: 1rem;
  }
  .word-preview-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
  }
  .word-preview-content table td, .word-preview-content table th {
    border: 1px solid #d1d5db;
    padding: 0.5rem;
  }
`;
document.head.appendChild(styleSheet);

const DocumentPreviewers = { ExcelPreview, WordPreview };
export default DocumentPreviewers;
