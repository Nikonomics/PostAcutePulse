import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { MonthlyTrendPoint, ExtractedField, SourceReference } from './types';
import { formatPercent, formatNumber, parseSourceReference, getSourceDisplayText, isSourceClickable } from './utils';

interface CensusTrendChartsProps {
  monthlyTrends: ExtractedField<MonthlyTrendPoint[]> | undefined;
  currentOccupancy: ExtractedField<number>;
  currentADC: ExtractedField<number>;
  currentPayerMix: {
    medicaid_pct: ExtractedField<number>;
    medicare_pct: ExtractedField<number>;
    private_pay_pct: ExtractedField<number>;
  };
  bedCount?: number;
  onSourceClick?: (sourceRef: SourceReference) => void;
}

const COLORS = {
  occupancy: '#3b82f6',     // Blue
  adc: '#10b981',           // Emerald
  medicaid: '#6366f1',      // Indigo
  medicare: '#22c55e',      // Green
  privatePay: '#a855f7',    // Purple
  gridLine: '#e5e7eb',
};

const chartContainerStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  padding: '1rem',
  marginBottom: '1rem',
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.75rem',
};

const noDataStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '120px',
  color: '#9ca3af',
  fontSize: '0.875rem',
  backgroundColor: '#f9fafb',
  borderRadius: '0.5rem',
  border: '1px dashed #d1d5db',
  textAlign: 'center',
  padding: '1rem',
};

const currentValueStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.75rem',
  padding: '0.75rem 1rem',
  backgroundColor: '#f0fdf4',
  borderRadius: '0.375rem',
  border: '1px solid #bbf7d0',
  flexWrap: 'wrap',
};

const sourceButtonStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#6b7280',
  backgroundColor: '#f3f4f6',
  padding: '0.125rem 0.375rem',
  borderRadius: '0.25rem',
  border: 'none',
  cursor: 'pointer',
  marginLeft: 'auto',
};

/**
 * Format month label for X-axis (e.g., "2024-06" -> "Jun '24")
 */
const formatMonthLabel = (month: string): string => {
  if (!month) return '';

  // Handle "YYYY-MM" format
  const dateMatch = month.match(/^(\d{4})-(\d{2})$/);
  if (dateMatch) {
    const [, year, monthNum] = dateMatch;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(monthNum, 10) - 1] || month;
    return `${monthName} '${year.slice(2)}`;
  }

  // Handle "MMM YYYY" format (already formatted)
  if (month.match(/^[A-Za-z]{3}\s+\d{4}$/)) {
    const [mmm, yyyy] = month.split(' ');
    return `${mmm} '${yyyy.slice(2)}`;
  }

  return month;
};

/**
 * Custom tooltip for the charts
 */
const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '0.75rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    }}>
      <p style={{ margin: 0, fontWeight: 600, color: '#111827', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
        {formatMonthLabel(label)}
      </p>
      {payload.map((entry: any, index: number) => (
        <p key={index} style={{ margin: '0.25rem 0', color: entry.color, fontSize: '0.875rem' }}>
          {entry.name}: {valueFormatter ? valueFormatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

/**
 * Source citation button component
 */
const SourceButton: React.FC<{
  source: string | undefined;
  onSourceClick?: (sourceRef: SourceReference) => void;
}> = ({ source, onSourceClick }) => {
  if (!source) return null;

  const sourceRef = parseSourceReference(source);
  if (!sourceRef || !isSourceClickable(sourceRef)) {
    // Just show the source text without making it clickable
    return (
      <span style={{ ...sourceButtonStyle, cursor: 'default' }} title={source}>
        {getSourceDisplayText(sourceRef) || source.substring(0, 20)}
      </span>
    );
  }

  return (
    <button
      style={sourceButtonStyle}
      onClick={() => onSourceClick?.(sourceRef)}
      title={`View source: ${source}`}
    >
      {getSourceDisplayText(sourceRef)}
    </button>
  );
};

/**
 * CensusTrendCharts - Displays T12 trendlines for occupancy, ADC, and payer mix
 */
const CensusTrendCharts: React.FC<CensusTrendChartsProps> = ({
  monthlyTrends,
  currentOccupancy,
  currentADC,
  currentPayerMix,
  bedCount,
  onSourceClick,
}) => {
  // Check if we have actual trend data
  const trendData = useMemo(() => {
    const hasRealData = monthlyTrends?.value && Array.isArray(monthlyTrends.value) && monthlyTrends.value.length > 0;
    if (hasRealData) {
      return monthlyTrends!.value;
    }
    return [];
  }, [monthlyTrends]);

  const hasData = trendData.length > 0;

  // Calculate trend direction (comparing first half to second half)
  const calculateTrend = (data: MonthlyTrendPoint[], key: keyof MonthlyTrendPoint): 'up' | 'down' | 'flat' => {
    if (data.length < 4) return 'flat';
    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid);
    const secondHalf = data.slice(mid);

    const firstAvg = firstHalf.reduce((sum, d) => sum + (Number(d[key]) || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + (Number(d[key]) || 0), 0) / secondHalf.length;

    const diff = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (diff > 2) return 'up';
    if (diff < -2) return 'down';
    return 'flat';
  };

  const occupancyTrend = hasData ? calculateTrend(trendData, 'occupancy_pct') : 'flat';
  const adcTrend = hasData ? calculateTrend(trendData, 'average_daily_census') : 'flat';

  const trendIcon = (trend: 'up' | 'down' | 'flat') => {
    if (trend === 'up') return <span style={{ color: '#22c55e' }}>↑</span>;
    if (trend === 'down') return <span style={{ color: '#ef4444' }}>↓</span>;
    return <span style={{ color: '#9ca3af' }}>→</span>;
  };

  return (
    <div>
      {/* Occupancy & ADC - Side by Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
        {/* Occupancy */}
        <div style={chartContainerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={chartTitleStyle}>Occupancy {hasData ? 'Trend (T12)' : ''}</h4>
            {hasData && (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {trendIcon(occupancyTrend)} Trending {occupancyTrend}
              </span>
            )}
          </div>

          {/* Current Value with Source */}
          {currentOccupancy?.value !== null && (
            <div style={currentValueStyle}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Current:</span>
              <span style={{ fontWeight: 700, color: '#059669', fontSize: '1.25rem' }}>
                {formatPercent(currentOccupancy.value)}
              </span>
              <SourceButton source={currentOccupancy.source} onSourceClick={onSourceClick} />
            </div>
          )}

          {hasData ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthLabel}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  width={45}
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatPercent(v)} />} />
                <defs>
                  <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.occupancy} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.occupancy} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="occupancy_pct"
                  stroke={COLORS.occupancy}
                  fill="url(#occupancyGradient)"
                  strokeWidth={2}
                  name="Occupancy"
                  dot={{ fill: COLORS.occupancy, strokeWidth: 0, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={noDataStyle}>
              <span>Monthly trend data will appear once census reports with monthly breakdowns are processed</span>
            </div>
          )}
        </div>

        {/* Average Daily Census */}
        <div style={chartContainerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={chartTitleStyle}>Average Daily Census {hasData ? '(T12)' : ''}</h4>
            {hasData && (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {trendIcon(adcTrend)} Trending {adcTrend}
              </span>
            )}
          </div>

          {/* Current Value with Source */}
          {currentADC?.value !== null && (
            <div style={currentValueStyle}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Current:</span>
              <span style={{ fontWeight: 700, color: '#059669', fontSize: '1.25rem' }}>
                {formatNumber(currentADC.value)}
              </span>
              {bedCount && (
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  / {bedCount} beds
                </span>
              )}
              <SourceButton source={currentADC.source} onSourceClick={onSourceClick} />
            </div>
          )}

          {hasData ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthLabel}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  width={35}
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${formatNumber(v)} residents`} />} />
                <defs>
                  <linearGradient id="adcGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.adc} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.adc} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="average_daily_census"
                  stroke={COLORS.adc}
                  fill="url(#adcGradient)"
                  strokeWidth={2}
                  name="ADC"
                  dot={{ fill: COLORS.adc, strokeWidth: 0, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={noDataStyle}>
              <span>Monthly trend data will appear once census reports with monthly breakdowns are processed</span>
            </div>
          )}
        </div>
      </div>

      {/* Payer Mix Trend */}
      <div style={chartContainerStyle}>
        <h4 style={chartTitleStyle}>Payer Mix {hasData ? 'Trend (T12)' : ''}</h4>

        {/* Current Payer Mix Summary with Sources */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {currentPayerMix?.medicaid_pct?.value !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: COLORS.medicaid, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Medicaid:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                {formatPercent(currentPayerMix.medicaid_pct.value)}
              </span>
            </div>
          )}
          {currentPayerMix?.medicare_pct?.value !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: COLORS.medicare, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Medicare:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                {formatPercent(currentPayerMix.medicare_pct.value)}
              </span>
            </div>
          )}
          {currentPayerMix?.private_pay_pct?.value !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: COLORS.privatePay, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Private Pay:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                {formatPercent(currentPayerMix.private_pay_pct.value)}
              </span>
            </div>
          )}
          {/* Show source for payer mix - use medicaid source as representative */}
          {currentPayerMix?.medicaid_pct?.source && (
            <SourceButton source={currentPayerMix.medicaid_pct.source} onSourceClick={onSourceClick} />
          )}
        </div>

        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                width={45}
              />
              <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatPercent(v)} />} />
              <Legend
                wrapperStyle={{ fontSize: '0.75rem' }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="medicaid_pct"
                stroke={COLORS.medicaid}
                strokeWidth={2}
                name="Medicaid"
                dot={{ fill: COLORS.medicaid, strokeWidth: 0, r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="medicare_pct"
                stroke={COLORS.medicare}
                strokeWidth={2}
                name="Medicare"
                dot={{ fill: COLORS.medicare, strokeWidth: 0, r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="private_pay_pct"
                stroke={COLORS.privatePay}
                strokeWidth={2}
                name="Private Pay"
                dot={{ fill: COLORS.privatePay, strokeWidth: 0, r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={noDataStyle}>
            <span>Monthly trend data will appear once census reports with monthly breakdowns are processed</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CensusTrendCharts;
