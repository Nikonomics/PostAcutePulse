import React, { useState, useMemo } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { FileText, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// Limits - based on extracted text character count, not file size
// Claude's context limit is ~200K tokens. Documents with special chars/formatting
// tokenize at ~2.2 chars/token. We need ~50K tokens for prompts, leaving ~150K for docs.
// 150K tokens × 2.2 chars/token ≈ 330K chars. Using 350K with some buffer.
const MAX_SELECTED_CHARS = 350000; // 350K characters
const MAX_SELECTED_FILES = 10; // Allow more files if they fit in char limit

// Legacy file size threshold (used as fallback if char counts not available)
const THRESHOLD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Check if document selector should be shown based on character counts
 * This should be called AFTER backend text extraction with characterCounts from /extract-text
 */
export const shouldShowDocumentSelectorByChars = (characterCounts) => {
  if (!characterCounts || characterCounts.length === 0) return false;
  const totalChars = characterCounts.reduce((sum, f) => sum + (f.characters || 0), 0);
  return totalChars > MAX_SELECTED_CHARS;
};

/**
 * Legacy check based on file size (fallback)
 */
export const shouldShowDocumentSelector = (files) => {
  if (!files || files.length === 0) return false;
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  return totalSize > THRESHOLD_SIZE_BYTES;
};

/**
 * Format character count to human readable
 */
const formatChars = (chars) => {
  if (chars < 1000) return `${chars} chars`;
  if (chars < 1000000) return `${(chars / 1000).toFixed(0)}K chars`;
  return `${(chars / 1000000).toFixed(1)}M chars`;
};

/**
 * Format bytes to human readable (for display alongside char count)
 */
const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * DocumentSelector - Modal for selecting subset of documents when content exceeds limit
 * Now uses character counts (extracted text size) instead of file size
 *
 * @param {Array} files - Original file objects (with .name, .size)
 * @param {Array} characterCounts - Array of {name, characters, success, error} from /extract-text endpoint
 */
const DocumentSelector = ({
  isOpen,
  onClose,
  files,
  characterCounts = [], // New: character counts from backend
  onConfirm,
}) => {
  const [selectedIndices, setSelectedIndices] = useState(new Set());

  // Merge file info with character counts
  const filesWithChars = useMemo(() => {
    if (!files) return [];
    return files.map((file, idx) => {
      const charInfo = characterCounts.find(c => c.name === file.name) || {};
      return {
        file,
        originalIndex: idx,
        characters: charInfo.characters || 0,
        extractionSuccess: charInfo.success !== false,
        extractionError: charInfo.error || null
      };
    });
  }, [files, characterCounts]);

  // Sort files by character count (largest first)
  const sortedFiles = useMemo(() => {
    return [...filesWithChars].sort((a, b) => b.characters - a.characters);
  }, [filesWithChars]);

  // Calculate totals
  const totalUploadedChars = useMemo(() => {
    return filesWithChars.reduce((sum, f) => sum + f.characters, 0);
  }, [filesWithChars]);

  const selectedFiles = useMemo(() => {
    return sortedFiles.filter((_, idx) => selectedIndices.has(idx));
  }, [sortedFiles, selectedIndices]);

  const selectedChars = useMemo(() => {
    return selectedFiles.reduce((sum, item) => sum + item.characters, 0);
  }, [selectedFiles]);

  const selectedCount = selectedIndices.size;

  // Validation based on character count
  const isTooManyFiles = selectedCount > MAX_SELECTED_FILES;
  const isTooLarge = selectedChars > MAX_SELECTED_CHARS;
  const isValid = selectedCount > 0 && !isTooManyFiles && !isTooLarge;

  // Status message
  const getStatusMessage = () => {
    if (selectedCount === 0) {
      return { text: 'Select at least 1 file', type: 'warning' };
    }
    if (isTooManyFiles) {
      return { text: `${selectedCount} files selected — max ${MAX_SELECTED_FILES} allowed`, type: 'error' };
    }
    if (isTooLarge) {
      return { text: `${selectedCount} files (${formatChars(selectedChars)}) — exceeds ${formatChars(MAX_SELECTED_CHARS)} limit`, type: 'error' };
    }
    return { text: `Selected: ${selectedCount} files (${formatChars(selectedChars)}) — within limits`, type: 'success' };
  };

  const status = getStatusMessage();

  const handleToggle = (index) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    // Select up to MAX_SELECTED_FILES, preferring smaller files to stay under character limit
    const byChars = [...sortedFiles].sort((a, b) => a.characters - b.characters);
    const newSelected = new Set();
    let runningChars = 0;

    for (const item of byChars) {
      const idx = sortedFiles.findIndex(s => s.originalIndex === item.originalIndex);
      if (newSelected.size < MAX_SELECTED_FILES && runningChars + item.characters <= MAX_SELECTED_CHARS) {
        newSelected.add(idx);
        runningChars += item.characters;
      }
    }
    setSelectedIndices(newSelected);
  };

  const handleClearAll = () => {
    setSelectedIndices(new Set());
  };

  const handleConfirm = () => {
    const selected = selectedFiles.map(item => item.file);
    onConfirm(selected);
  };

  return (
    <Modal show={isOpen} onHide={onClose} size="lg" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <AlertTriangle size={24} className="text-warning" />
          Too many documents to process at once
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="mb-3">
          You've uploaded <strong>{files?.length || 0} files</strong> with <strong>{formatChars(totalUploadedChars)}</strong> of extracted text.
          This exceeds the AI processing limit. Please select documents totaling under <strong>{formatChars(MAX_SELECTED_CHARS)}</strong>.
        </p>

        <div className="alert alert-info d-flex align-items-center gap-2 py-2">
          <Info size={18} />
          <small><strong>Tip:</strong> The CIM, P&L, and Rent Roll usually have what you need.</small>
        </div>

        {/* Status bar */}
        <div
          className={`p-2 mb-3 rounded d-flex align-items-center gap-2 ${
            status.type === 'success' ? 'bg-success bg-opacity-10 text-success' :
            status.type === 'error' ? 'bg-danger bg-opacity-10 text-danger' :
            'bg-warning bg-opacity-10 text-warning'
          }`}
        >
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="fw-medium">{status.text}</span>
        </div>

        {/* Quick actions */}
        <div className="d-flex gap-2 mb-3">
          <Button variant="outline-secondary" size="sm" onClick={handleSelectAll}>
            Auto-select (within limits)
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={handleClearAll}>
            Clear all
          </Button>
        </div>

        {/* File list */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }} className="border rounded">
          {sortedFiles.map((item, idx) => {
            const isSelected = selectedIndices.has(idx);
            const hasError = !item.extractionSuccess;
            return (
              <div
                key={item.originalIndex}
                className="d-flex align-items-center gap-3 p-3 border-bottom"
                style={{
                  backgroundColor: hasError ? '#fff5f5' : isSelected ? '#e7f1ff' : '#fff',
                  borderLeft: isSelected ? '4px solid #0d6efd' : hasError ? '4px solid #dc3545' : '4px solid transparent',
                  cursor: hasError ? 'not-allowed' : 'pointer',
                  opacity: hasError ? 0.6 : 1,
                }}
                onClick={() => !hasError && handleToggle(idx)}
              >
                <Form.Check
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(idx)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={hasError}
                />
                <FileText size={20} className={hasError ? "text-danger" : "text-muted"} style={{ flexShrink: 0 }} />
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="text-truncate fw-medium" style={{ maxWidth: '400px' }}>
                    {item.file.name}
                  </div>
                  <small className={hasError ? "text-danger" : "text-muted"}>
                    {hasError
                      ? `Failed to extract text: ${item.extractionError || 'Unknown error'}`
                      : `${formatChars(item.characters)}${item.file.size ? ` • ${formatSize(item.file.size)}` : ''}`
                    }
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!isValid}
        >
          Continue with {selectedCount} file{selectedCount !== 1 ? 's' : ''}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DocumentSelector;
