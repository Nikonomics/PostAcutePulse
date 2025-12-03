import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Copy, Check, Pencil, ExternalLink, FileText } from 'lucide-react';
import { FieldCellProps, SourceReference } from './types';
import { formatFieldValue, copyToClipboard, isNegativeValue, parseSourceReference, isSourceClickable } from './utils';
import ConfidenceIndicator from './ConfidenceIndicator';

const FieldCell: React.FC<FieldCellProps> = ({
  label,
  field,
  format = 'text',
  showComparison = false,
  onEdit,
  fieldPath,
  onSourceClick,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = field.value !== null && field.value !== undefined && field.confidence !== 'not_found';
  const displayValue = formatFieldValue(field.value, format);
  const isNegative = typeof field.value === 'number' && isNegativeValue(field.value);

  // Parse the source reference for clickable citations
  const sourceRef = useMemo(() => parseSourceReference(field.source), [field.source]);
  const canClickSource = isSourceClickable(sourceRef) && onSourceClick;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCopy = async () => {
    const textToCopy = hasValue ? String(field.value) : '';
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartEdit = () => {
    if (onEdit) {
      setEditValue(hasValue ? String(field.value) : '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit && fieldPath) {
      let newValue: any = editValue;
      if (format === 'currency' || format === 'number' || format === 'percent') {
        newValue = parseFloat(editValue.replace(/[^0-9.-]/g, ''));
        if (isNaN(newValue)) newValue = null;
      }
      onEdit(newValue);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-150"
      tabIndex={0}
      role="gridcell"
    >
      {/* Header row with label and confidence */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <ConfidenceIndicator
          confidence={field.confidence}
          calculated={field.calculated}
          conflictDetails={field.conflict_details}
          source={field.source}
        />
      </div>

      {/* Value display or edit */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
          />
        </div>
      ) : showComparison && field.raw_value ? (
        // Comparison mode: show raw and normalized side by side
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded p-2">
            <span className="text-xs text-gray-400 block mb-1">Raw Value</span>
            <span className="text-sm text-gray-600">{field.raw_value}</span>
          </div>
          <div className="bg-blue-50 rounded p-2">
            <span className="text-xs text-gray-400 block mb-1">Normalized</span>
            <span
              className={`text-lg font-semibold ${
                isNegative ? 'text-red-600' : hasValue ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {displayValue}
            </span>
          </div>
        </div>
      ) : (
        // Normal mode: just show value
        <div className="flex items-center justify-between">
          <span
            className={`text-lg font-semibold ${
              isNegative ? 'text-red-600' : hasValue ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            {displayValue}
          </span>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasValue && (
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="Copy value"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            )}
            {onEdit && (
              <button
                onClick={handleStartEdit}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="Edit value"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Source line - clickable if we have a document reference */}
      {field.source && hasValue && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #f3f4f6',
        }}>
          {canClickSource ? (
            <button
              onClick={() => onSourceClick!(sourceRef!)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                color: '#3b82f6',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              title={`View source: ${sourceRef?.document}${sourceRef?.location ? ` (${sourceRef.location})` : ''}`}
            >
              <FileText size={12} />
              <span style={{ textDecoration: 'underline' }}>
                {sourceRef?.document}
              </span>
              {sourceRef?.location && (
                <span style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  {' '}• {sourceRef.location}
                </span>
              )}
              <ExternalLink size={10} style={{ marginLeft: '0.25rem', opacity: 0.7 }} />
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Source: <span style={{ color: '#6b7280' }}>{field.source}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldCell;
