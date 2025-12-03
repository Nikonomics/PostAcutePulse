import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SectionProps } from './types';

// Map header color class names to actual colors
const headerColorMap: Record<string, string> = {
  'bg-blue-800': '#1e40af',
  'bg-green-800': '#166534',
  'bg-purple-700': '#7e22ce',
  'bg-orange-700': '#c2410c',
  'bg-red-700': '#b91c1c',
  'bg-gray-700': '#374151',
};

const Section: React.FC<SectionProps> = ({
  id,
  title,
  headerColor,
  isExpanded,
  onToggle,
  fieldsExtracted,
  totalFields,
  children,
}) => {
  const completionPercentage = totalFields > 0 ? Math.round((fieldsExtracted / totalFields) * 100) : 0;
  const bgColor = headerColorMap[headerColor] || '#1e40af';

  const containerStyle: React.CSSProperties = {
    marginBottom: '1rem',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    border: '1px solid #e5e7eb',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: bgColor,
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'white',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };

  const leftContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const rightContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  };

  const progressBarContainerStyle: React.CSSProperties = {
    width: '6rem',
    height: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '9999px',
    overflow: 'hidden',
  };

  const progressBarStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: '9999px',
    transition: 'width 0.3s',
    width: `${completionPercentage}%`,
  };

  const contentStyle: React.CSSProperties = {
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-in-out, opacity 0.15s ease-in-out',
    maxHeight: isExpanded ? '5000px' : '0',
    opacity: isExpanded ? 1 : 0,
  };

  const innerContentStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: 'white',
  };

  return (
    <div style={containerStyle}>
      {/* Section Header */}
      <button
        onClick={onToggle}
        style={buttonStyle}
        aria-expanded={isExpanded}
        aria-controls={`section-content-${id}`}
      >
        <div style={leftContentStyle}>
          {isExpanded ? (
            <ChevronDown size={20} />
          ) : (
            <ChevronRight size={20} />
          )}
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</span>
        </div>

        {/* Completion indicator */}
        <div style={rightContentStyle}>
          <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            {fieldsExtracted} of {totalFields} fields
          </span>
          {/* Progress bar */}
          <div style={progressBarContainerStyle}>
            <div style={progressBarStyle} />
          </div>
        </div>
      </button>

      {/* Section Content */}
      <div id={`section-content-${id}`} style={contentStyle}>
        <div style={innerContentStyle}>{children}</div>
      </div>
    </div>
  );
};

export default Section;
