import React, { useState, useEffect, useRef } from 'react';

const SearchBar = ({ onSearch }) => {
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    // Debounce search by 300ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onSearch(inputValue);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, onSearch]);

  const handleClear = () => {
    setInputValue('');
    onSearch('');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'white',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      padding: '0 0.75rem',
      minWidth: '250px',
      maxWidth: '400px',
      flex: 1
    }}>
      <span style={{ color: '#6c757d', marginRight: '0.5rem' }}>🔍</span>
      <input
        type="text"
        placeholder="Search sources, fields, descriptions..."
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        style={{
          border: 'none',
          outline: 'none',
          padding: '0.5rem 0',
          flex: 1,
          fontSize: '0.9rem'
        }}
      />
      {inputValue && (
        <button
          onClick={handleClear}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.25rem',
            color: '#6c757d',
            cursor: 'pointer',
            padding: '0 0.25rem'
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default SearchBar;
