import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { HelpCircle } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Cache for definitions to avoid repeated API calls
const definitionsCache = {};

const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    position: 'relative',
  },
  icon: {
    cursor: 'help',
    color: '#9ca3af',
    marginLeft: '0.25rem',
    transition: 'color 0.15s',
  },
  iconHover: {
    color: '#6b7280',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '0.5rem',
    padding: '0.75rem',
    backgroundColor: '#1e293b',
    color: 'white',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    lineHeight: 1.4,
    minWidth: '200px',
    maxWidth: '300px',
    zIndex: 1000,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  tooltipArrow: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #1e293b',
  },
  title: {
    fontWeight: 600,
    marginBottom: '0.375rem',
    fontSize: '0.8125rem',
  },
  description: {
    color: '#e2e8f0',
  },
  source: {
    marginTop: '0.5rem',
    paddingTop: '0.375rem',
    borderTop: '1px solid #475569',
    fontSize: '0.625rem',
    color: '#94a3b8',
  },
  loading: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
};

const DataTooltip = ({
  fieldName,
  category = null,
  children,
  inline = false,
  size = 12,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  // Fetch definition when tooltip becomes visible
  useEffect(() => {
    if (isVisible && !definition && !definitionsCache[fieldName]) {
      setLoading(true);

      const params = { fields: fieldName };
      if (category) params.category = category;

      axios.get(`${API_BASE}/api/market/definitions`, { params })
        .then(response => {
          if (response.data.success && response.data.data.length > 0) {
            const def = response.data.data[0];
            definitionsCache[fieldName] = def;
            setDefinition(def);
          }
        })
        .catch(err => {
          console.warn('[DataTooltip] Failed to fetch definition:', err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (isVisible && definitionsCache[fieldName]) {
      setDefinition(definitionsCache[fieldName]);
    }
  }, [isVisible, fieldName, category, definition]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <span
      style={styles.container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <HelpCircle
        size={size}
        style={{
          ...styles.icon,
          ...(isVisible ? styles.iconHover : {}),
        }}
      />
      {isVisible && (
        <div style={styles.tooltip}>
          <div style={styles.tooltipArrow} />
          {loading ? (
            <span style={styles.loading}>Loading...</span>
          ) : definition ? (
            <>
              <div style={styles.title}>{definition.display_name || fieldName}</div>
              <div style={styles.description}>{definition.description}</div>
              {definition.data_source && (
                <div style={styles.source}>
                  Source: {definition.data_source}
                </div>
              )}
            </>
          ) : (
            <span style={styles.loading}>No definition available</span>
          )}
        </div>
      )}
    </span>
  );
};

export default DataTooltip;
