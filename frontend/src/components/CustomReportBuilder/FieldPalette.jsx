/**
 * FieldPalette Component
 *
 * Left sidebar showing available fields grouped by category.
 * Fields can be dragged to dimensions or metrics areas.
 */
import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
} from 'lucide-react';

// Field type icons
const TYPE_ICONS = {
  number: Hash,
  string: Type,
  date: Calendar,
  boolean: ToggleLeft,
};

// Field type colors
const TYPE_COLORS = {
  number: '#3b82f6',
  string: '#10b981',
  date: '#f59e0b',
  boolean: '#8b5cf6',
};

/**
 * Draggable field item
 */
function DraggableField({ field, source }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${source}-${field.name}`,
    data: {
      type: 'field',
      field: field.name,
      label: field.label,
      fieldType: field.type,
      source,
    },
  });

  const TypeIcon = TYPE_ICONS[field.type] || Hash;
  const typeColor = TYPE_COLORS[field.type] || '#6b7280';

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`field-item ${isDragging ? 'dragging' : ''}`}
    >
      <TypeIcon size={14} style={{ color: typeColor }} />
      <span className="field-label">{field.label}</span>
      <span className="field-type">{field.type}</span>
    </div>
  );
}

/**
 * Category group with expandable fields
 */
function CategoryGroup({ category, fields, source, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="category-group">
      <button className="category-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{category}</span>
        <span className="field-count">{fields.length}</span>
      </button>

      {expanded && (
        <div className="category-fields">
          {fields.map((field) => (
            <DraggableField key={field.name} field={field} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Data source selector
 */
function SourceSelector({ sources, selectedSource, onSelectSource }) {
  return (
    <div className="source-selector">
      <label>
        <Database size={14} />
        <span>Data Source</span>
      </label>
      <select value={selectedSource} onChange={(e) => onSelectSource(e.target.value)}>
        {Object.entries(sources).map(([key, config]) => (
          <option key={key} value={key}>
            {config.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Main FieldPalette component
 */
export default function FieldPalette({ catalog, selectedSource, onSelectSource }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Get current source's fields grouped by category
  const sourceData = catalog?.sources?.[selectedSource];
  const categories = sourceData?.categories || {};

  // Filter fields by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(categories).forEach(([category, fields]) => {
      const matchingFields = fields.filter(
        (f) =>
          f.label.toLowerCase().includes(query) ||
          f.name.toLowerCase().includes(query)
      );
      if (matchingFields.length > 0) {
        filtered[category] = matchingFields;
      }
    });

    return filtered;
  }, [categories, searchQuery]);

  const totalFields = Object.values(filteredCategories).reduce(
    (sum, fields) => sum + fields.length,
    0
  );

  return (
    <div className="field-palette">
      <div className="palette-header">
        <h3>Fields</h3>
        <span className="field-total">{totalFields} fields</span>
      </div>

      {catalog?.sources && (
        <SourceSelector
          sources={catalog.sources}
          selectedSource={selectedSource}
          onSelectSource={onSelectSource}
        />
      )}

      <div className="search-box">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="palette-content">
        {Object.entries(filteredCategories).map(([category, fields], idx) => (
          <CategoryGroup
            key={category}
            category={category}
            fields={fields}
            source={selectedSource}
            defaultExpanded={idx < 2}
          />
        ))}

        {Object.keys(filteredCategories).length === 0 && (
          <div className="no-fields">
            {searchQuery ? 'No fields match your search' : 'No fields available'}
          </div>
        )}
      </div>
    </div>
  );
}
