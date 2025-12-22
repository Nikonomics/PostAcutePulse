import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * Metric sections configuration
 */
const METRIC_SECTIONS = [
  {
    key: 'overall',
    title: 'Overall',
    metrics: [
      { key: 'performance_score', label: 'Performance Score', format: 'number', decimals: 1 },
      { key: 'incentive_multiplier', label: 'Incentive Multiplier', format: 'multiplier' },
      { key: 'incentive_percentage', label: 'Incentive Percentage', format: 'signedPercent' }
    ]
  },
  {
    key: 'readmission',
    title: 'Readmission (SNFRM)',
    measureKey: 'readmission',
    metrics: [
      { key: 'baseline_rate', label: 'Baseline Rate', format: 'percent' },
      { key: 'performance_rate', label: 'Performance Rate', format: 'percent' },
      { key: 'achievement_score', label: 'Achievement Score', format: 'number', decimals: 2 },
      { key: 'improvement_score', label: 'Improvement Score', format: 'number', decimals: 2 },
      { key: 'measure_score', label: 'Measure Score', format: 'number', decimals: 2 }
    ]
  },
  {
    key: 'hai',
    title: 'Healthcare-Associated Infections (HAI)',
    measureKey: 'hai',
    metrics: [
      { key: 'baseline_rate', label: 'Baseline Rate', format: 'percent' },
      { key: 'performance_rate', label: 'Performance Rate', format: 'percent' },
      { key: 'achievement_score', label: 'Achievement Score', format: 'number', decimals: 2 },
      { key: 'improvement_score', label: 'Improvement Score', format: 'number', decimals: 2 },
      { key: 'measure_score', label: 'Measure Score', format: 'number', decimals: 2 }
    ]
  },
  {
    key: 'turnover',
    title: 'Staff Turnover (DCT)',
    measureKey: 'turnover',
    metrics: [
      { key: 'baseline_rate', label: 'Baseline Rate', format: 'percent' },
      { key: 'performance_rate', label: 'Performance Rate', format: 'percent' },
      { key: 'achievement_score', label: 'Achievement Score', format: 'number', decimals: 2 },
      { key: 'improvement_score', label: 'Improvement Score', format: 'number', decimals: 2 },
      { key: 'measure_score', label: 'Measure Score', format: 'number', decimals: 2 }
    ]
  },
  {
    key: 'staffing',
    title: 'Staffing Hours',
    measureKey: 'staffing',
    metrics: [
      { key: 'baseline_hours', label: 'Baseline Hours', format: 'hours' },
      { key: 'performance_hours', label: 'Performance Hours', format: 'hours' },
      { key: 'achievement_score', label: 'Achievement Score', format: 'number', decimals: 2 },
      { key: 'improvement_score', label: 'Improvement Score', format: 'number', decimals: 2 },
      { key: 'measure_score', label: 'Measure Score', format: 'number', decimals: 2 }
    ]
  }
];

/**
 * Format a value based on type
 */
const formatValue = (value, format, decimals = 2) => {
  if (value == null) return '—';

  switch (format) {
    case 'number':
      return parseFloat(value).toFixed(decimals);
    case 'percent':
      return `${(parseFloat(value) * 100).toFixed(1)}%`;
    case 'signedPercent':
      const pct = parseFloat(value);
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
    case 'multiplier':
      return `${parseFloat(value).toFixed(4)}x`;
    case 'hours':
      return `${parseFloat(value).toFixed(2)} HPRD`;
    default:
      return String(value);
  }
};

/**
 * Get value from data based on section and metric key
 */
const getValue = (current, section, metricKey) => {
  if (!current) return null;

  // Overall metrics are at the top level
  if (section.key === 'overall') {
    return current[metricKey];
  }

  // Measure metrics are nested under current.measures
  if (section.measureKey && current.measures) {
    return current.measures[section.measureKey]?.[metricKey];
  }

  return null;
};

/**
 * Single metric row
 */
const MetricRow = ({ metric, value }) => {
  const formattedValue = formatValue(value, metric.format, metric.decimals);
  const hasValue = value != null;

  return (
    <div className="vbp-metrics-row">
      <span className="vbp-metrics-label">{metric.label}</span>
      <span className="vbp-metrics-value">{formattedValue}</span>
      <span className="vbp-metrics-status">
        <span className={`vbp-status-dot ${hasValue ? 'present' : 'missing'}`} />
      </span>
    </div>
  );
};

/**
 * Collapsible section
 */
const MetricSection = ({ section, current, searchTerm, expandedSections, onToggle }) => {
  const isExpanded = expandedSections[section.key];

  // Filter metrics by search term
  const filteredMetrics = useMemo(() => {
    if (!searchTerm) return section.metrics;
    return section.metrics.filter(m =>
      m.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [section.metrics, searchTerm]);

  // Don't render section if no metrics match search
  if (filteredMetrics.length === 0) return null;

  return (
    <div className="vbp-metrics-section">
      <div
        className="vbp-metrics-section-header"
        onClick={() => onToggle(section.key)}
      >
        <ChevronDown
          size={16}
          className={`vbp-metrics-section-chevron ${!isExpanded ? 'collapsed' : ''}`}
        />
        <span className="vbp-metrics-section-title">{section.title}</span>
        <span className="vbp-metrics-section-count">{filteredMetrics.length}</span>
      </div>

      {isExpanded && (
        <div className="vbp-metrics-rows">
          {filteredMetrics.map(metric => (
            <MetricRow
              key={metric.key}
              metric={metric}
              value={getValue(current, section, metric.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * VBPMetricsTable - Comprehensive searchable table of all VBP metrics
 */
const VBPMetricsTable = ({ vbpData, facility }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState(() => {
    // All sections collapsed by default
    const initial = {};
    METRIC_SECTIONS.forEach(s => { initial[s.key] = false; });
    return initial;
  });

  const current = vbpData?.current;

  // Toggle section expansion
  const handleToggle = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Check if any metrics match search
  const hasResults = useMemo(() => {
    if (!searchTerm) return true;
    return METRIC_SECTIONS.some(section =>
      section.metrics.some(m =>
        m.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm]);

  // Export to Excel
  const handleExport = () => {
    const exportData = [];

    METRIC_SECTIONS.forEach(section => {
      section.metrics.forEach(metric => {
        const value = getValue(current, section, metric.key);
        exportData.push({
          Section: section.title,
          Metric: metric.label,
          Value: formatValue(value, metric.format, metric.decimals),
          'Raw Value': value ?? ''
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VBP Metrics');

    const filename = `VBP_Metrics_${facility?.ccn || facility?.federal_provider_number || 'facility'}_FY${current?.fiscal_year || ''}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Empty state
  if (!current) {
    return (
      <div className="vbp-metrics-table-section">
        <div className="vbp-metrics-header">
          <h3>All VBP Metrics</h3>
        </div>
        <div className="vbp-metrics-no-results">
          <p>No VBP metrics data available for this facility.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vbp-metrics-table-section">
      {/* Header with Search */}
      <div className="vbp-metrics-header">
        <h3>All VBP Metrics</h3>
        <div className="vbp-metrics-search">
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Search metrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sections */}
      {hasResults ? (
        METRIC_SECTIONS.map(section => (
          <MetricSection
            key={section.key}
            section={section}
            current={current}
            searchTerm={searchTerm}
            expandedSections={expandedSections}
            onToggle={handleToggle}
          />
        ))
      ) : (
        <div className="vbp-metrics-no-results">
          <p>No metrics match your search "{searchTerm}"</p>
        </div>
      )}

      {/* Export Button */}
      <div className="vbp-metrics-export">
        <button onClick={handleExport}>
          <Download size={16} />
          Export to Excel
        </button>
      </div>
    </div>
  );
};

export default VBPMetricsTable;
