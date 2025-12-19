/**
 * Data Dictionary Helper Functions
 */

// Get statistics about the data sources
export const getSourceStats = (sources) => {
  const totalSources = sources.length;
  const totalFields = sources.reduce((sum, s) => sum + (s.fields?.length || 0), 0);
  const fieldsUsed = sources.reduce((sum, s) =>
    sum + (s.fields?.filter(f => f.usedBySNFalyze)?.length || 0), 0
  );
  const sourcesDocumented = sources.filter(s => s.isFullyDocumented).length;

  return { totalSources, totalFields, fieldsUsed, sourcesDocumented };
};

// Group sources by source type (CMS, State, Federal, AI)
export const groupBySourceType = (sources) => {
  const groups = {
    'CMS Data': [],
    'State Licensing': [],
    'Federal Statistics': [],
    'AI & Internal': []
  };

  sources.forEach(source => {
    if (source.id.startsWith('cms_')) {
      groups['CMS Data'].push(source);
    } else if (source.id.includes('alf') || source.id.includes('state')) {
      groups['State Licensing'].push(source);
    } else if (source.sourceAgency?.includes('Census') || source.sourceAgency?.includes('BLS')) {
      groups['Federal Statistics'].push(source);
    } else {
      groups['AI & Internal'].push(source);
    }
  });

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, items]) => items.length > 0)
  );
};

// Group sources by which tabs use them
export const groupByTab = (sources, tabs) => {
  const groups = {};

  tabs.forEach(tab => {
    groups[tab] = sources.filter(source =>
      source.usedInTabs?.includes(tab)
    );
  });

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, items]) => items.length > 0)
  );
};

// Group sources by category
export const groupByCategory = (sources, categories) => {
  const groups = {};

  categories.forEach(category => {
    groups[category] = sources.filter(source =>
      source.category === category
    );
  });

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, items]) => items.length > 0)
  );
};

// Apply filters to sources
export const applyFilters = (sources, filters) => {
  return sources.filter(source => {
    // Facility type filter
    if (filters.facilityType !== 'all') {
      if (filters.facilityType === 'Both') {
        if (source.facilityType !== 'Both') return false;
      } else {
        if (source.facilityType !== filters.facilityType && source.facilityType !== 'Both') {
          return false;
        }
      }
    }

    // Update frequency filter
    if (filters.updateFrequency !== 'all' && source.updateFrequency !== filters.updateFrequency) {
      return false;
    }

    // Usage filter
    if (filters.usage === 'used' && !source.usedBySNFalyze) {
      return false;
    }
    if (filters.usage === 'unused' && source.usedBySNFalyze) {
      return false;
    }

    return true;
  });
};

// Search across sources and fields
export const searchSources = (sources, query) => {
  if (!query || query.trim() === '') {
    return sources;
  }

  const lowerQuery = query.toLowerCase();

  return sources.filter(source => {
    // Search in source name
    if (source.name.toLowerCase().includes(lowerQuery)) return true;

    // Search in source description
    if (source.description?.toLowerCase().includes(lowerQuery)) return true;

    // Search in field names and descriptions
    if (source.fields?.some(field =>
      field.fieldName?.toLowerCase().includes(lowerQuery) ||
      field.cmsColumnHeader?.toLowerCase().includes(lowerQuery) ||
      field.description?.toLowerCase().includes(lowerQuery) ||
      field.cmsMeasureCode?.toLowerCase().includes(lowerQuery)
    )) {
      return true;
    }

    return false;
  });
};

// Sort sources
export const sortSources = (sources, sortBy) => {
  const sorted = [...sources];

  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'frequency':
      const freqOrder = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Varies', 'Per Upload', 'As updated'];
      return sorted.sort((a, b) => {
        const aIdx = freqOrder.indexOf(a.updateFrequency) ?? 99;
        const bIdx = freqOrder.indexOf(b.updateFrequency) ?? 99;
        return aIdx - bIdx;
      });
    case 'fieldCount':
      return sorted.sort((a, b) => (b.fields?.length || 0) - (a.fields?.length || 0));
    default:
      return sorted;
  }
};
