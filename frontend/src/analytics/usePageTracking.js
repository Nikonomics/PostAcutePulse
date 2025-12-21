import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { posthog } from './posthog';

/**
 * Custom hook to track page views in a React SPA
 * Add this hook in your main App component inside the Router
 */
export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Capture pageview with path and search params
    posthog.capture('$pageview', {
      path: location.pathname,
      search: location.search,
      // Extract meaningful page name from path
      pageName: getPageName(location.pathname)
    });
  }, [location.pathname, location.search]);
};

/**
 * Extract a readable page name from the pathname
 */
const getPageName = (pathname) => {
  const pathParts = pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) return 'Home';

  // Map common paths to readable names
  const pageNames = {
    'dashboard': 'Dashboard',
    'deals': 'Deals',
    'deals/create': 'Create Deal',
    'deals/new': 'New Deal Wizard',
    'user-management': 'User Management',
    'profile': 'Profile',
    'market-analysis': 'Market Analysis',
    'ownership-research': 'Ownership Research',
    'facility-metrics': 'Facility Metrics',
    'survey-analytics': 'Survey Analytics',
    'ma-intelligence': 'M&A Intelligence',
    'data-dictionary': 'Data Dictionary',
    'saved-items': 'Saved Items'
  };

  // Check for exact match first
  const fullPath = pathParts.join('/');
  if (pageNames[fullPath]) return pageNames[fullPath];

  // Check for partial match (first segment)
  if (pageNames[pathParts[0]]) return pageNames[pathParts[0]];

  // Default: capitalize first segment
  return pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1).replace(/-/g, ' ');
};

export default usePageTracking;
