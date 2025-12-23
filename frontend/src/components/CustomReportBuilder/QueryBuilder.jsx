/**
 * QueryBuilder Component
 *
 * Center panel for building report queries.
 * Shows selected dimensions, metrics, and filters.
 */
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  Layers,
  BarChart2,
  Filter,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from 'lucide-react';

// Aggregation options by field type
const AGGREGATIONS_BY_TYPE = {
  number: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  string: ['COUNT', 'COUNT_DISTINCT'],
  date: ['COUNT', 'MIN', 'MAX'],
  boolean: ['COUNT', 'SUM'],
};

// Filter operators
const OPERATORS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'at least' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'at most' },
  { value: 'LIKE', label: 'contains' },
  { value: 'IS NULL', label: 'is empty' },
  { value: 'IS NOT NULL', label: 'is not empty' },
];

// Date transforms
const DATE_TRANSFORMS = [
  { value: null, label: 'Full Date' },
  { value: 'year', label: 'Year' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
];

/**
 * Droppable zone for dimensions/metrics
 */
function DropZone({ id, label, icon: Icon, children, isEmpty }) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div className={`drop-zone ${isOver ? 'over' : ''}`} ref={setNodeRef}>
      <div className="drop-zone-header">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div className="drop-zone-content">
        {isEmpty ? (
          <div className="drop-placeholder">Drag fields here</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/**
 * Dimension chip with optional date transform
 */
function DimensionChip({ dimension, onRemove, onUpdate }) {
  const isDate = dimension.fieldType === 'date';

  return (
    <div className="field-chip dimension">
      <span className="chip-label">{dimension.label}</span>

      {isDate && (
        <select
          className="chip-select"
          value={dimension.transform || ''}
          onChange={(e) => onUpdate({ ...dimension, transform: e.target.value || null })}
        >
          {DATE_TRANSFORMS.map((t) => (
            <option key={t.value || 'null'} value={t.value || ''}>
              {t.label}
            </option>
          ))}
        </select>
      )}

      <button className="chip-remove" onClick={onRemove} title="Remove">
        <X size={12} />
      </button>
    </div>
  );
}

/**
 * Metric chip with aggregation selector
 */
function MetricChip({ metric, onRemove, onUpdate }) {
  const aggregations = AGGREGATIONS_BY_TYPE[metric.fieldType] || ['COUNT'];

  return (
    <div className="field-chip metric">
      <select
        className="chip-select agg"
        value={metric.aggregation}
        onChange={(e) => onUpdate({ ...metric, aggregation: e.target.value })}
      >
        {aggregations.map((agg) => (
          <option key={agg} value={agg}>
            {agg}
          </option>
        ))}
      </select>

      <span className="chip-label">{metric.label}</span>

      <button className="chip-remove" onClick={onRemove} title="Remove">
        <X size={12} />
      </button>
    </div>
  );
}

/**
 * Filter row component
 */
function FilterRow({ filter, index, fields, onUpdate, onRemove }) {
  const needsValue = !['IS NULL', 'IS NOT NULL'].includes(filter.operator);

  return (
    <div className="filter-row">
      <select
        className="filter-field"
        value={filter.field}
        onChange={(e) => {
          const field = fields.find((f) => f.name === e.target.value);
          onUpdate(index, { ...filter, field: e.target.value, label: field?.label });
        }}
      >
        <option value="">Select field...</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="filter-operator"
        value={filter.operator}
        onChange={(e) => onUpdate(index, { ...filter, operator: e.target.value })}
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {needsValue && (
        <input
          type="text"
          className="filter-value"
          placeholder="Value..."
          value={filter.value || ''}
          onChange={(e) => onUpdate(index, { ...filter, value: e.target.value })}
        />
      )}

      <button className="filter-remove" onClick={() => onRemove(index)} title="Remove filter">
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Sort configuration
 */
function SortConfig({ orderBy, dimensions, metrics, onUpdate }) {
  const allFields = [
    ...dimensions.map((d) => ({
      name: d.alias || d.field,
      label: d.label + (d.transform ? ` (${d.transform})` : ''),
    })),
    ...metrics.map((m) => ({
      name: m.alias || `${m.aggregation.toLowerCase()}_${m.field}`,
      label: `${m.aggregation}(${m.label})`,
    })),
  ];

  const handleAdd = () => {
    if (allFields.length === 0) return;
    onUpdate([...orderBy, { field: allFields[0].name, direction: 'DESC' }]);
  };

  const handleUpdate = (index, update) => {
    const newOrderBy = [...orderBy];
    newOrderBy[index] = { ...newOrderBy[index], ...update };
    onUpdate(newOrderBy);
  };

  const handleRemove = (index) => {
    onUpdate(orderBy.filter((_, i) => i !== index));
  };

  return (
    <div className="sort-config">
      <div className="section-header">
        <span>Sort By</span>
        <button className="add-btn" onClick={handleAdd} disabled={allFields.length === 0}>
          <Plus size={14} />
        </button>
      </div>

      {orderBy.map((sort, idx) => (
        <div key={idx} className="sort-row">
          <select
            value={sort.field}
            onChange={(e) => handleUpdate(idx, { field: e.target.value })}
          >
            {allFields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>

          <button
            className={`sort-dir ${sort.direction === 'DESC' ? 'active' : ''}`}
            onClick={() =>
              handleUpdate(idx, { direction: sort.direction === 'DESC' ? 'ASC' : 'DESC' })
            }
          >
            {sort.direction === 'DESC' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          </button>

          <button className="sort-remove" onClick={() => handleRemove(idx)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Main QueryBuilder component
 */
export default function QueryBuilder({
  dimensions,
  metrics,
  filters,
  orderBy,
  limit,
  onDimensionsChange,
  onMetricsChange,
  onFiltersChange,
  onOrderByChange,
  onLimitChange,
  fieldCatalog,
  selectedSource,
}) {
  // Get all fields for current source
  const sourceData = fieldCatalog?.sources?.[selectedSource];
  const allFields = sourceData
    ? Object.values(sourceData.categories).flat()
    : [];

  const handleAddFilter = () => {
    onFiltersChange({
      ...filters,
      conditions: [
        ...(filters.conditions || []),
        { field: '', operator: '=', value: '' },
      ],
    });
  };

  const handleUpdateFilter = (index, update) => {
    const newConditions = [...(filters.conditions || [])];
    newConditions[index] = update;
    onFiltersChange({ ...filters, conditions: newConditions });
  };

  const handleRemoveFilter = (index) => {
    onFiltersChange({
      ...filters,
      conditions: (filters.conditions || []).filter((_, i) => i !== index),
    });
  };

  const handleRemoveDimension = (index) => {
    onDimensionsChange(dimensions.filter((_, i) => i !== index));
  };

  const handleUpdateDimension = (index, update) => {
    const newDimensions = [...dimensions];
    newDimensions[index] = update;
    onDimensionsChange(newDimensions);
  };

  const handleRemoveMetric = (index) => {
    onMetricsChange(metrics.filter((_, i) => i !== index));
  };

  const handleUpdateMetric = (index, update) => {
    const newMetrics = [...metrics];
    newMetrics[index] = update;
    onMetricsChange(newMetrics);
  };

  return (
    <div className="query-builder">
      <div className="query-builder-header">
        <h3>Query Builder</h3>
      </div>

      <div className="query-builder-content">
        {/* Dimensions */}
        <DropZone
          id="dimensions-drop"
          label="Dimensions (Group By)"
          icon={Layers}
          isEmpty={dimensions.length === 0}
        >
          {dimensions.map((dim, idx) => (
            <DimensionChip
              key={`${dim.field}-${idx}`}
              dimension={dim}
              onRemove={() => handleRemoveDimension(idx)}
              onUpdate={(update) => handleUpdateDimension(idx, update)}
            />
          ))}
        </DropZone>

        {/* Metrics */}
        <DropZone
          id="metrics-drop"
          label="Metrics (Aggregations)"
          icon={BarChart2}
          isEmpty={metrics.length === 0}
        >
          {metrics.map((metric, idx) => (
            <MetricChip
              key={`${metric.field}-${idx}`}
              metric={metric}
              onRemove={() => handleRemoveMetric(idx)}
              onUpdate={(update) => handleUpdateMetric(idx, update)}
            />
          ))}
        </DropZone>

        {/* Filters */}
        <div className="filters-section">
          <div className="section-header">
            <Filter size={16} />
            <span>Filters</span>
            <button className="add-btn" onClick={handleAddFilter}>
              <Plus size={14} />
            </button>
          </div>

          {filters.conditions?.length > 0 && (
            <div className="filter-logic">
              <select
                value={filters.operator || 'AND'}
                onChange={(e) => onFiltersChange({ ...filters, operator: e.target.value })}
              >
                <option value="AND">Match ALL</option>
                <option value="OR">Match ANY</option>
              </select>
            </div>
          )}

          <div className="filters-list">
            {(filters.conditions || []).map((filter, idx) => (
              <FilterRow
                key={idx}
                filter={filter}
                index={idx}
                fields={allFields}
                onUpdate={handleUpdateFilter}
                onRemove={handleRemoveFilter}
              />
            ))}
          </div>
        </div>

        {/* Sort & Limit */}
        <div className="options-row">
          <SortConfig
            orderBy={orderBy}
            dimensions={dimensions}
            metrics={metrics}
            onUpdate={onOrderByChange}
          />

          <div className="limit-config">
            <label>Limit</label>
            <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
              <option value={100}>100 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1,000 rows</option>
              <option value={5000}>5,000 rows</option>
              <option value={10000}>10,000 rows</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
