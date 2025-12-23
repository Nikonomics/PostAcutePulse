/**
 * CustomReportBuilder Page
 *
 * Drag-and-drop report builder for creating custom analytics reports.
 * Allows non-technical users to query facility, survey, and VBP data.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { BarChart2, Save, FolderOpen } from 'lucide-react';

import FieldPalette from '../components/CustomReportBuilder/FieldPalette';
import QueryBuilder from '../components/CustomReportBuilder/QueryBuilder';
import ResultsTable from '../components/CustomReportBuilder/ResultsTable';
import { getFieldsCatalog, previewQuery } from '../api/customReportsService';
import '../components/CustomReportBuilder/CustomReportBuilder.css';

/**
 * Dragging field overlay
 */
function DragOverlayContent({ active }) {
  if (!active) return null;

  const { label, fieldType } = active.data.current || {};

  return (
    <div className="field-item dragging">
      <span className="field-label">{label}</span>
      <span className="field-type">{fieldType}</span>
    </div>
  );
}

export default function CustomReportBuilder() {
  // Catalog state
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState('facilities');

  // Query state
  const [dimensions, setDimensions] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [filters, setFilters] = useState({ operator: 'AND', conditions: [] });
  const [orderBy, setOrderBy] = useState([]);
  const [limit, setLimit] = useState(100);

  // Results state
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);

  // Drag state
  const [activeField, setActiveField] = useState(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load fields catalog on mount
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const response = await getFieldsCatalog();
        if (response.success) {
          setCatalog(response.data);
        }
      } catch (err) {
        console.error('Failed to load fields catalog:', err);
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, []);

  // Clear query when source changes
  const handleSourceChange = (source) => {
    setSelectedSource(source);
    setDimensions([]);
    setMetrics([]);
    setFilters({ operator: 'AND', conditions: [] });
    setOrderBy([]);
    setResults(null);
    setResultsError(null);
  };

  // Handle drag start
  const handleDragStart = (event) => {
    setActiveField(event.active);
  };

  // Handle drag end - add field to appropriate zone
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveField(null);

    if (!over || !active.data.current) return;

    const fieldData = active.data.current;
    const dropZone = over.id;

    // Determine default aggregation based on field type
    const getDefaultAggregation = (type) => {
      switch (type) {
        case 'number': return 'SUM';
        case 'string': return 'COUNT_DISTINCT';
        default: return 'COUNT';
      }
    };

    if (dropZone === 'dimensions-drop') {
      // Check if already added
      const exists = dimensions.some(d => d.field === fieldData.field);
      if (!exists) {
        setDimensions([
          ...dimensions,
          {
            field: fieldData.field,
            label: fieldData.label,
            fieldType: fieldData.fieldType,
            transform: null,
          },
        ]);
      }
    } else if (dropZone === 'metrics-drop') {
      // Metrics can have same field with different aggregations
      setMetrics([
        ...metrics,
        {
          field: fieldData.field,
          label: fieldData.label,
          fieldType: fieldData.fieldType,
          aggregation: getDefaultAggregation(fieldData.fieldType),
        },
      ]);
    }
  };

  // Execute query
  const handleRunQuery = async () => {
    // Build query object
    const query = {
      source: selectedSource,
      dimensions: dimensions.map(d => ({
        field: d.field,
        transform: d.transform,
        alias: d.transform ? `${d.field}_${d.transform}` : undefined,
      })),
      metrics: metrics.map(m => ({
        field: m.field,
        aggregation: m.aggregation,
        alias: `${m.aggregation.toLowerCase()}_${m.field}`,
      })),
      filters: {
        operator: filters.operator,
        conditions: filters.conditions.filter(c => c.field && c.operator),
      },
      orderBy,
      limit,
    };

    setResultsLoading(true);
    setResultsError(null);

    try {
      const response = await previewQuery(query);

      if (response.success) {
        setResults(response.data);
        setExecutionTime(response.executionTimeMs);
      } else {
        setResultsError(response.error);
        setResults(null);
      }
    } catch (err) {
      console.error('Query failed:', err);
      setResultsError(err.message || 'Query execution failed');
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  };

  // Check if query is valid (has at least one dimension or metric)
  const queryValid = dimensions.length > 0 || metrics.length > 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="custom-report-builder">
        <div className="builder-header">
          <h1>
            <BarChart2 size={24} />
            Custom Report Builder
          </h1>

          <div className="builder-header-actions">
            <button className="save-btn">
              <Save size={16} />
              Save Report
            </button>
          </div>
        </div>

        <div className="builder-main">
          {/* Left: Field Palette */}
          <FieldPalette
            catalog={catalog}
            selectedSource={selectedSource}
            onSelectSource={handleSourceChange}
          />

          {/* Center: Query Builder */}
          <QueryBuilder
            dimensions={dimensions}
            metrics={metrics}
            filters={filters}
            orderBy={orderBy}
            limit={limit}
            onDimensionsChange={setDimensions}
            onMetricsChange={setMetrics}
            onFiltersChange={setFilters}
            onOrderByChange={setOrderBy}
            onLimitChange={setLimit}
            fieldCatalog={catalog}
            selectedSource={selectedSource}
          />

          {/* Right: Results */}
          <ResultsTable
            data={results}
            loading={resultsLoading}
            error={resultsError}
            executionTime={executionTime}
            onRunQuery={handleRunQuery}
            queryValid={queryValid}
          />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        <DragOverlayContent active={activeField} />
      </DragOverlay>
    </DndContext>
  );
}
