import React from 'react';
import { RatesTableProps, RateItem } from './types';
import { formatCurrency } from './utils';
import ConfidenceIndicator from './ConfidenceIndicator';

const containerStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  backgroundColor: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: '#111827',
  borderBottom: '1px solid #e5e7eb',
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontWeight: 500,
};

const emptyStyle: React.CSSProperties = {
  padding: '2rem 1rem',
  textAlign: 'center',
  color: '#9ca3af',
  fontSize: '0.875rem',
};

const footerStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#f9fafb',
  borderTop: '1px solid #e5e7eb',
  fontSize: '0.75rem',
  color: '#9ca3af',
};

const RatesTable: React.FC<RatesTableProps> = ({ rates, type }) => {
  const hasRates = rates.value && Array.isArray(rates.value) && rates.value.length > 0;
  const title = type === 'private_pay' ? 'Private Pay Rates' : 'Medicaid Rates';
  const columnHeader = type === 'private_pay' ? 'Unit Type' : 'Care Level';

  // Check if any private pay rates have care level add-ons
  const hasCareLevels = type === 'private_pay' && hasRates &&
    rates.value!.some((rate: any) => rate.care_levels && Object.keys(rate.care_levels).length > 0);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h4 style={titleStyle}>{title}</h4>
        <ConfidenceIndicator
          confidence={rates.confidence}
          source={rates.source}
        />
      </div>

      {hasRates ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{columnHeader}</th>
                <th style={thRightStyle}>Monthly Rate</th>
                {hasCareLevels && <th style={thRightStyle}>Care Level Add-ons</th>}
              </tr>
            </thead>
            <tbody>
              {rates.value!.map((rate: any, index: number) => (
                <tr key={index}>
                  <td style={tdStyle}>
                    {type === 'private_pay' ? (rate.unit_type || 'Standard') : (rate.care_level || `Level ${index + 1}`)}
                  </td>
                  <td style={tdRightStyle}>
                    {formatCurrency(rate.monthly_rate)}
                  </td>
                  {hasCareLevels && (
                    <td style={tdRightStyle}>
                      {rate.care_levels && Object.keys(rate.care_levels).length > 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {Object.entries(rate.care_levels).map(([level, amount]: [string, any]) =>
                            `${level}: +${formatCurrency(amount)}`
                          ).join(', ')}
                        </span>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={emptyStyle}>
          No {type === 'private_pay' ? 'private pay' : 'Medicaid'} rate data available
        </div>
      )}

      {/* Source footer */}
      {rates.source && hasRates && (
        <div style={footerStyle}>
          Source: <span style={{ color: '#6b7280' }}>{rates.source}</span>
        </div>
      )}
    </div>
  );
};

export default RatesTable;
