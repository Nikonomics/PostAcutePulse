import React, { useState, useMemo, useCallback } from 'react';
import dataSources from './data/dataSources.json';
import ViewToggle from './components/ViewToggle';
import SearchBar from './components/SearchBar';
import FilterBar from './components/FilterBar';
import SourceGroup from './components/SourceGroup';
import FeedbackBox from './components/FeedbackBox';
import {
  getSourceStats,
  groupBySourceType,
  groupByTab,
  groupByCategory,
  applyFilters,
  searchSources,
  sortSources
} from './utils/dataHelpers';
import './DataDictionaryTab.css';

const DataDictionaryTab = () => {
  const [currentView, setCurrentView] = useState('source');
  const [expandedSources, setExpandedSources] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    facilityType: 'all',
    updateFrequency: 'all',
    usage: 'all'
  });

  // Apply filters and search
  const processedSources = useMemo(() => {
    let result = dataSources.sources;
    result = applyFilters(result, filters);
    result = searchSources(result, searchQuery);
    result = sortSources(result, 'name');
    return result;
  }, [filters, searchQuery]);

  // Group processed sources based on current view
  const groupedSources = useMemo(() => {
    switch (currentView) {
      case 'tab':
        return groupByTab(processedSources, dataSources.tabs);
      case 'category':
        return groupByCategory(processedSources, dataSources.categories);
      case 'source':
      default:
        return groupBySourceType(processedSources);
    }
  }, [currentView, processedSources]);

  const handleFilterChange = useCallback((filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  }, []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const toggleSource = (sourceId) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const totalStats = getSourceStats(dataSources.sources);

  const handleFeedbackSubmit = async (feedbackData) => {
    // For now, just log to console
    // Later this can be connected to an API endpoint
    console.log('Data Dictionary Feedback:', feedbackData);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  return (
    <div className="data-dictionary-tab">
      <div className="data-dictionary-header">
        <h2>Data Dictionary</h2>
        <p className="stats-summary">
          {totalStats.totalSources} sources • {totalStats.totalFields} fields
          ({totalStats.fieldsUsed} used by SNFalyze)
        </p>
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <ViewToggle
            currentView={currentView}
            onViewChange={setCurrentView}
          />
          <SearchBar onSearch={handleSearch} />
        </div>
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Results summary */}
      <div style={{
        padding: '0.5rem 0',
        color: '#6c757d',
        fontSize: '0.9rem',
        marginBottom: '0.5rem'
      }}>
        Showing {processedSources.length} of {dataSources.sources.length} sources
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Grouped Sources */}
      <div className="sources-container">
        {Object.keys(groupedSources).length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6c757d',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            No sources match your filters. Try adjusting your search or filters.
          </div>
        ) : (
          Object.entries(groupedSources).map(([groupName, sources]) => (
            <SourceGroup
              key={groupName}
              groupName={groupName}
              sources={sources}
              expandedSources={expandedSources}
              onToggleSource={toggleSource}
            />
          ))
        )}
      </div>

      {/* Feedback Section */}
      <div style={{
        marginTop: '2rem',
        paddingTop: '2rem',
        borderTop: '1px solid #dee2e6'
      }}>
        <FeedbackBox onSubmit={handleFeedbackSubmit} />
      </div>
    </div>
  );
};

export default DataDictionaryTab;
