import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, ExternalLink, Download, AlertCircle } from 'lucide-react';
import { DocumentViewerProps } from './types';
import { ExcelPreview, WordPreview } from '../DocumentPreviewers';

// Styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: '1rem',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  width: '100%',
  maxWidth: '900px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #e5e7eb',
  backgroundColor: '#f9fafb',
};

const titleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
  color: '#111827',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '1.5rem',
  minHeight: '400px',
};

const locationBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  backgroundColor: '#dbeafe',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  color: '#1e40af',
  marginBottom: '1rem',
};

const snippetStyle: React.CSSProperties = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fcd34d',
  borderRadius: '0.5rem',
  padding: '1rem',
  fontSize: '0.875rem',
  color: '#92400e',
  marginBottom: '1rem',
  fontFamily: 'monospace',
};

const iframeContainerStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  borderRadius: '0.5rem',
  overflow: 'hidden',
  border: '1px solid #e5e7eb',
  minHeight: '300px',
};

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const closeButtonStyle: React.CSSProperties = {
  padding: '0.5rem',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '0.25rem',
  cursor: 'pointer',
  color: '#6b7280',
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  isOpen,
  onClose,
  sourceRef,
  dealDocuments,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to normalize filename for comparison
  const normalizeFilename = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
      .replace(/\s+/g, '');       // Remove spaces
  };

  // Extract base filename without extension
  const getBaseName = (name: string): string => {
    const parts = name.split('.');
    if (parts.length > 1) {
      parts.pop(); // Remove extension
    }
    return parts.join('.');
  };

  // Find the matching document from the deal's documents
  const matchedDocument = useMemo(() => {
    if (!sourceRef || !dealDocuments || dealDocuments.length === 0) return null;

    const sourceDocName = sourceRef.document;
    const sourceNormalized = normalizeFilename(sourceDocName);
    const sourceBase = normalizeFilename(getBaseName(sourceDocName));

    // Try to find exact match first
    let doc = dealDocuments.find(d =>
      d.name.toLowerCase() === sourceDocName.toLowerCase()
    );

    // Try normalized match
    if (!doc) {
      doc = dealDocuments.find(d =>
        normalizeFilename(d.name) === sourceNormalized
      );
    }

    // Try base name match (without extension)
    if (!doc) {
      doc = dealDocuments.find(d => {
        const docBase = normalizeFilename(getBaseName(d.name));
        return docBase === sourceBase;
      });
    }

    // Try partial match - check if one contains the other
    if (!doc) {
      doc = dealDocuments.find(d => {
        const docNormalized = normalizeFilename(d.name);
        return docNormalized.includes(sourceNormalized) ||
               sourceNormalized.includes(docNormalized);
      });
    }

    // Try fuzzy match - significant overlap
    if (!doc) {
      doc = dealDocuments.find(d => {
        const docBase = normalizeFilename(getBaseName(d.name));
        // Check if they share at least 80% of characters
        const shorter = sourceBase.length < docBase.length ? sourceBase : docBase;
        const longer = sourceBase.length < docBase.length ? docBase : sourceBase;
        return longer.includes(shorter) || shorter.length > 10 && longer.includes(shorter.substring(0, 10));
      });
    }

    // Log for debugging
    if (!doc) {
      console.log('Document matching failed:', {
        sourceDocument: sourceDocName,
        sourceNormalized,
        availableDocuments: dealDocuments.map(d => ({
          name: d.name,
          normalized: normalizeFilename(d.name)
        }))
      });
    }

    return doc;
  }, [sourceRef, dealDocuments]);

  // Determine the file URL
  const fileUrl = useMemo(() => {
    if (!matchedDocument) return null;

    // Get the API base URL from environment
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    // Use the url field if already a complete path
    if (matchedDocument.url) {
      // If url already starts with /api or http, use it appropriately
      if (matchedDocument.url.startsWith('http')) {
        return matchedDocument.url;
      }
      // For relative URLs, prepend the API base URL (without /api/v1 since url already has it)
      const baseWithoutApi = apiBaseUrl.replace(/\/api\/v1$/, '');
      return `${baseWithoutApi}${matchedDocument.url}`;
    }

    if (matchedDocument.file_path) {
      // file_path is the relative path like "deal_123/filename.pdf"
      // Construct full URL using API base
      const baseWithoutApi = apiBaseUrl.replace(/\/api\/v1$/, '');
      return `${baseWithoutApi}/api/v1/files/${matchedDocument.file_path}`;
    }
    return null;
  }, [matchedDocument]);

  // Get file type for display
  const fileType = useMemo(() => {
    if (!matchedDocument) return 'unknown';
    const ext = matchedDocument.name.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['xlsx', 'xls'].includes(ext)) return 'excel';
    if (['docx', 'doc'].includes(ext)) return 'word';
    if (['csv'].includes(ext)) return 'csv';
    return 'unknown';
  }, [matchedDocument]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      // Simulate loading
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, sourceRef]);

  if (!isOpen) return null;

  const handleOpenInNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleDownload = () => {
    if (fileUrl && matchedDocument) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = matchedDocument.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>
            <FileText size={20} />
            {sourceRef?.document || 'Document Viewer'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {matchedDocument && (
              <>
                <button
                  onClick={handleOpenInNewTab}
                  style={{ ...buttonStyle, backgroundColor: '#6b7280' }}
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                  Open
                </button>
                <button
                  onClick={handleDownload}
                  style={buttonStyle}
                  title="Download file"
                >
                  <Download size={14} />
                  Download
                </button>
              </>
            )}
            <button onClick={onClose} style={closeButtonStyle} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Location info */}
          {sourceRef?.location && (
            <div style={locationBadgeStyle}>
              <span style={{ fontWeight: 600 }}>Location:</span>
              {sourceRef.location}
            </div>
          )}

          {/* Snippet if available */}
          {sourceRef?.snippet && (
            <div style={snippetStyle}>
              <div style={{ fontSize: '0.75rem', color: '#d97706', marginBottom: '0.25rem', fontWeight: 500 }}>
                Extracted text:
              </div>
              "{sourceRef.snippet}"
            </div>
          )}

          {/* Document viewer */}
          {!matchedDocument ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              backgroundColor: '#fef2f2',
              borderRadius: '0.5rem',
              border: '1px solid #fecaca',
            }}>
              <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontSize: '1rem' }}>
                Document Not Found
              </h4>
              <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.875rem', textAlign: 'center' }}>
                The source document "{sourceRef?.document}" could not be found in the deal's uploaded files.
              </p>
              <p style={{ margin: '0.5rem 0 0 0', color: '#9ca3af', fontSize: '0.75rem' }}>
                Available documents: {dealDocuments?.map(d => d.name).join(', ') || 'None'}
              </p>
            </div>
          ) : fileType === 'pdf' && fileUrl ? (
            <div style={iframeContainerStyle}>
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#6b7280' }}>
                  Loading document...
                </div>
              ) : (
                <iframe
                  src={`${fileUrl}#page=1`}
                  style={{ width: '100%', height: '500px', border: 'none' }}
                  title={matchedDocument.name}
                />
              )}
            </div>
          ) : fileType === 'excel' && fileUrl ? (
            <div style={{ ...iframeContainerStyle, minHeight: '400px' }}>
              <ExcelPreview url={fileUrl} fileName={matchedDocument.name} />
            </div>
          ) : fileType === 'word' && fileUrl ? (
            <div style={{ ...iframeContainerStyle, minHeight: '400px' }}>
              <WordPreview url={fileUrl} fileName={matchedDocument.name} />
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              backgroundColor: '#f3f4f6',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
            }}>
              <FileText size={48} style={{ color: '#6b7280', marginBottom: '1rem' }} />
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151', fontSize: '1rem' }}>
                {matchedDocument.name}
              </h4>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>
                {fileType === 'csv' && 'CSV files cannot be previewed directly. Click "Open" or "Download" to view.'}
                {fileType === 'unknown' && 'This file type cannot be previewed. Click "Open" or "Download" to view.'}
              </p>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleOpenInNewTab} style={{ ...buttonStyle, backgroundColor: '#6b7280' }}>
                  <ExternalLink size={14} />
                  Open in New Tab
                </button>
                <button onClick={handleDownload} style={buttonStyle}>
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation hint */}
        <div style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          fontSize: '0.75rem',
          color: '#9ca3af',
        }}>
          {sourceRef?.isCalculated ? (
            <span>This value was calculated from other extracted data.</span>
          ) : sourceRef?.location ? (
            <span>Navigate to: {sourceRef.location}</span>
          ) : (
            <span>Source document for extracted data</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
