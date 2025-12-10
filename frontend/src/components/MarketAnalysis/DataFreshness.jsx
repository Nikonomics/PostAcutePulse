/**
 * DataFreshness Component
 *
 * Displays CMS data freshness status with:
 * - Last update date for each dataset
 * - Days since last refresh
 * - Refresh needed indicator
 * - Manual refresh button (admin only)
 */

import React, { useState, useEffect } from 'react';
import { getDataStatus, triggerRefresh } from '../../api/marketService';

const styles = {
  container: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#495057',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusIcon: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  datasets: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap'
  },
  dataset: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  datasetName: {
    fontSize: '12px',
    color: '#6c757d',
    fontWeight: '500'
  },
  datasetInfo: {
    fontSize: '13px',
    color: '#212529'
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    marginLeft: '8px'
  },
  freshBadge: {
    backgroundColor: '#d4edda',
    color: '#155724'
  },
  staleBadge: {
    backgroundColor: '#fff3cd',
    color: '#856404'
  },
  runningBadge: {
    backgroundColor: '#cce5ff',
    color: '#004085'
  },
  refreshButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    border: '1px solid #0d6efd',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#0d6efd',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  refreshButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  collapsed: {
    fontSize: '13px',
    color: '#6c757d',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#0d6efd',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0
  },
  error: {
    color: '#dc3545',
    fontSize: '12px',
    marginTop: '4px'
  },
  loading: {
    fontSize: '13px',
    color: '#6c757d',
    fontStyle: 'italic'
  }
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Format duration
const formatDuration = (seconds) => {
  if (!seconds) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};

const DataFreshness = ({ compact = false, showRefreshButton = false }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    loadStatus();
    // Refresh status every 30 seconds if a refresh is running
    const interval = setInterval(() => {
      if (refreshing) {
        loadStatus();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshing]);

  const loadStatus = async () => {
    try {
      const result = await getDataStatus();
      setStatus(result);
      setError(null);

      // Check if any dataset is running
      const isRunning = Object.values(result.datasets || {}).some(ds => ds.status === 'running');
      setRefreshing(isRunning);
    } catch (err) {
      setError('Failed to load data status');
      console.error('DataFreshness load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await triggerRefresh('all');
      // Start polling for status
      setTimeout(loadStatus, 2000);
    } catch (err) {
      setError(err.message || 'Failed to start refresh');
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <span style={styles.loading}>Loading data status...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const { datasets } = status;
  const allFresh = datasets && Object.values(datasets).every(ds => !ds.needsRefresh);
  const anyRunning = datasets && Object.values(datasets).some(ds => ds.status === 'running');

  // Determine overall status
  let statusColor = '#28a745'; // green - fresh
  if (anyRunning) {
    statusColor = '#007bff'; // blue - running
  } else if (!allFresh) {
    statusColor = '#ffc107'; // yellow - needs refresh
  }

  // Compact view
  if (compact && !expanded) {
    return (
      <div style={styles.container}>
        <div style={styles.collapsed}>
          <span style={{ ...styles.statusIcon, backgroundColor: statusColor }} />
          <span>
            CMS Data: {anyRunning ? 'Refreshing...' : allFresh ? 'Up to date' : 'Update available'}
          </span>
          <button style={styles.toggleButton} onClick={() => setExpanded(true)}>
            Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>
          <span style={{ ...styles.statusIcon, backgroundColor: statusColor }} />
          CMS Data Status
          {compact && (
            <button style={styles.toggleButton} onClick={() => setExpanded(false)}>
              Collapse
            </button>
          )}
        </h4>
        {showRefreshButton && (
          <button
            style={{
              ...styles.refreshButton,
              ...(refreshing || anyRunning ? styles.refreshButtonDisabled : {})
            }}
            onClick={handleRefresh}
            disabled={refreshing || anyRunning}
          >
            {refreshing || anyRunning ? 'Refreshing...' : 'Refresh Data'}
          </button>
        )}
      </div>

      <div style={styles.datasets}>
        {datasets?.facilities && (
          <div style={styles.dataset}>
            <span style={styles.datasetName}>SNF Facilities</span>
            <span style={styles.datasetInfo}>
              {datasets.facilities.recordCount?.toLocaleString() || 0} records
              {datasets.facilities.lastRefresh && (
                <span
                  style={{
                    ...styles.badge,
                    ...(datasets.facilities.status === 'running'
                      ? styles.runningBadge
                      : datasets.facilities.needsRefresh
                      ? styles.staleBadge
                      : styles.freshBadge)
                  }}
                >
                  {datasets.facilities.status === 'running'
                    ? 'Updating...'
                    : `Updated ${formatDate(datasets.facilities.lastRefresh)}`}
                </span>
              )}
              {!datasets.facilities.lastRefresh && (
                <span style={{ ...styles.badge, ...styles.staleBadge }}>Never updated</span>
              )}
            </span>
          </div>
        )}

        {datasets?.deficiencies && (
          <div style={styles.dataset}>
            <span style={styles.datasetName}>Deficiencies</span>
            <span style={styles.datasetInfo}>
              {datasets.deficiencies.recordCount?.toLocaleString() || 0} records
              {datasets.deficiencies.lastRefresh && (
                <span
                  style={{
                    ...styles.badge,
                    ...(datasets.deficiencies.status === 'running'
                      ? styles.runningBadge
                      : datasets.deficiencies.needsRefresh
                      ? styles.staleBadge
                      : styles.freshBadge)
                  }}
                >
                  {datasets.deficiencies.status === 'running'
                    ? 'Updating...'
                    : `Updated ${formatDate(datasets.deficiencies.lastRefresh)}`}
                </span>
              )}
              {!datasets.deficiencies.lastRefresh && (
                <span style={{ ...styles.badge, ...styles.staleBadge }}>Never updated</span>
              )}
            </span>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
        CMS updates data monthly. Data is automatically refreshed every 30 days.
      </div>
    </div>
  );
};

export default DataFreshness;
