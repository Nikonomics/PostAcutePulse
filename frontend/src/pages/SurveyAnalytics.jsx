import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Form,
  Nav,
  Tab,
  OverlayTrigger,
  Tooltip,
  Table,
} from 'react-bootstrap';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChart3,
  ClipboardList,
  AlertTriangle,
  Tag,
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  MessageSquare,
  Info,
  Loader2,
  Lightbulb,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Flag,
  Target,
  CheckCircle2,
  XCircle,
  Equal,
  Map,
  Building2,
  ExternalLink,
  Clock,
  Users,
  Zap,
  Link2,
  Eye,
  Activity,
  Layers,
  Home,
  ChevronRight,
  FileQuestion,
} from 'lucide-react';
import './SurveyAnalytics.css';
import { getNationalOverview, getStateData, getFTagTrends } from '../api/surveyService';

// US States for dropdown
const US_STATES = [
  { code: 'ALL', name: 'National (All States)' },
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const TIME_PERIODS = [
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' },
  { value: '12months', label: 'Last 12 Months' },
];

// Mock data for Regional Hot Spots tab (TODO: Backend endpoint /api/survey/regional-hotspots/:stateCode not yet implemented)
const getRegionalHotSpotsData = (stateCode, period) => {
  const stateName = US_STATES.find(s => s.code === stateCode)?.name || stateCode;

  const periodMultipliers = {
    '30days': 0.33,
    '90days': 1,
    '12months': 4,
  };
  const multiplier = periodMultipliers[period] || 1;

  // Generate county data based on state
  const countyData = {
    CA: [
      { rank: 1, county: 'Los Angeles', surveys: Math.round(47 * multiplier), avgDefs: 6.2, ijCount: Math.round(3 * multiplier), topFTag: 'F0880', topFTagName: 'Infection Control' },
      { rank: 2, county: 'Orange', surveys: Math.round(23 * multiplier), avgDefs: 4.8, ijCount: Math.round(1 * multiplier), topFTag: 'F0689', topFTagName: 'Free of Accident Hazards' },
      { rank: 3, county: 'San Diego', surveys: Math.round(19 * multiplier), avgDefs: 5.1, ijCount: 0, topFTag: 'F0880', topFTagName: 'Infection Control' },
      { rank: 4, county: 'Riverside', surveys: Math.round(17 * multiplier), avgDefs: 5.4, ijCount: Math.round(1 * multiplier), topFTag: 'F0812', topFTagName: 'Food Safety' },
      { rank: 5, county: 'San Bernardino', surveys: Math.round(14 * multiplier), avgDefs: 5.8, ijCount: Math.round(2 * multiplier), topFTag: 'F0684', topFTagName: 'Quality of Care' },
      { rank: 6, county: 'Santa Clara', surveys: Math.round(12 * multiplier), avgDefs: 4.5, ijCount: 0, topFTag: 'F0758', topFTagName: 'Free from Medication Errors' },
      { rank: 7, county: 'Alameda', surveys: Math.round(11 * multiplier), avgDefs: 5.2, ijCount: Math.round(1 * multiplier), topFTag: 'F0880', topFTagName: 'Infection Control' },
      { rank: 8, county: 'Sacramento', surveys: Math.round(10 * multiplier), avgDefs: 4.9, ijCount: 0, topFTag: 'F0689', topFTagName: 'Free of Accident Hazards' },
      { rank: 9, county: 'Contra Costa', surveys: Math.round(8 * multiplier), avgDefs: 5.0, ijCount: 0, topFTag: 'F0812', topFTagName: 'Food Safety' },
      { rank: 10, county: 'Fresno', surveys: Math.round(7 * multiplier), avgDefs: 5.6, ijCount: Math.round(1 * multiplier), topFTag: 'F0684', topFTagName: 'Quality of Care' },
    ],
    TX: [
      { rank: 1, county: 'Harris', surveys: Math.round(52 * multiplier), avgDefs: 5.8, ijCount: Math.round(4 * multiplier), topFTag: 'F0880', topFTagName: 'Infection Control' },
      { rank: 2, county: 'Dallas', surveys: Math.round(38 * multiplier), avgDefs: 5.2, ijCount: Math.round(2 * multiplier), topFTag: 'F0689', topFTagName: 'Free of Accident Hazards' },
      { rank: 3, county: 'Tarrant', surveys: Math.round(24 * multiplier), avgDefs: 4.9, ijCount: Math.round(1 * multiplier), topFTag: 'F0880', topFTagName: 'Infection Control' },
      { rank: 4, county: 'Bexar', surveys: Math.round(21 * multiplier), avgDefs: 5.4, ijCount: Math.round(2 * multiplier), topFTag: 'F0812', topFTagName: 'Food Safety' },
      { rank: 5, county: 'Travis', surveys: Math.round(15 * multiplier), avgDefs: 4.6, ijCount: 0, topFTag: 'F0684', topFTagName: 'Quality of Care' },
    ],
  };

  // Default counties for other states
  const defaultCounties = [
    { rank: 1, county: 'County A', surveys: Math.round(25 * multiplier), avgDefs: 5.2, ijCount: Math.round(2 * multiplier), topFTag: 'F0880', topFTagName: 'Infection Control' },
    { rank: 2, county: 'County B', surveys: Math.round(18 * multiplier), avgDefs: 4.8, ijCount: Math.round(1 * multiplier), topFTag: 'F0689', topFTagName: 'Free of Accident Hazards' },
    { rank: 3, county: 'County C', surveys: Math.round(14 * multiplier), avgDefs: 5.0, ijCount: 0, topFTag: 'F0812', topFTagName: 'Food Safety' },
    { rank: 4, county: 'County D', surveys: Math.round(11 * multiplier), avgDefs: 5.3, ijCount: Math.round(1 * multiplier), topFTag: 'F0684', topFTagName: 'Quality of Care' },
    { rank: 5, county: 'County E', surveys: Math.round(8 * multiplier), avgDefs: 4.5, ijCount: 0, topFTag: 'F0758', topFTagName: 'Free from Medication Errors' },
  ];

  const counties = countyData[stateCode] || defaultCounties;

  return {
    state: stateCode,
    stateName,
    counties,
    clusters: [
      {
        id: 1,
        name: `East ${counties[0]?.county || 'Metro'} Cluster`,
        county: counties[0]?.county || 'County A',
        facilityCount: 4,
        dateRange: 'Dec 8-12, 2024',
        commonFTags: ['F0880', 'F0689'],
        commonFTagNames: ['Infection Control', 'Free of Accident Hazards'],
        note: 'Survey team appears to be working through this territory systematically',
        isActive: true,
      },
      {
        id: 2,
        name: `${counties[1]?.county || 'County B'} North`,
        county: counties[1]?.county || 'County B',
        facilityCount: 3,
        dateRange: 'Dec 1-5, 2024',
        commonFTags: ['F0812', 'F0758'],
        commonFTagNames: ['Food Safety', 'Free from Medication Errors'],
        note: 'Complaint-driven surveys concentrated in this area',
        isActive: false,
      },
    ],
    recentSurveys: [
      { facilityName: 'Santa Anita Convalescent', ccn: '555234', county: counties[0]?.county || 'County A', date: '2024-12-10', daysAgo: 9, defCount: 4, topFTag: 'F0880', topFTagName: 'Infection Control' },
      { facilityName: 'Valley Care SNF', ccn: '555345', county: counties[0]?.county || 'County A', date: '2024-12-08', daysAgo: 11, defCount: 7, topFTag: 'F0689', topFTagName: 'Free of Accident Hazards' },
      { facilityName: 'Pacific Gardens', ccn: '555456', county: counties[1]?.county || 'County B', date: '2024-12-06', daysAgo: 13, defCount: 3, topFTag: 'F0812', topFTagName: 'Food Safety' },
      { facilityName: 'Sunrise Healthcare Center', ccn: '555567', county: counties[2]?.county || 'County C', date: '2024-12-04', daysAgo: 15, defCount: 5, topFTag: 'F0880', topFTagName: 'Infection Control' },
      { facilityName: 'Golden State Nursing', ccn: '555678', county: counties[0]?.county || 'County A', date: '2024-12-02', daysAgo: 17, defCount: 2, topFTag: 'F0758', topFTagName: 'Free from Medication Errors' },
      { facilityName: 'Coastal Care Facility', ccn: '555789', county: counties[1]?.county || 'County B', date: '2024-11-28', daysAgo: 21, defCount: 6, topFTag: 'F0684', topFTagName: 'Quality of Care' },
      { facilityName: 'Mountain View SNF', ccn: '555890', county: counties[3]?.county || 'County D', date: '2024-11-25', daysAgo: 24, defCount: 4, topFTag: 'F0880', topFTagName: 'Infection Control' },
      { facilityName: 'Riverside Health Center', ccn: '555901', county: counties[3]?.county || 'County D', date: '2024-11-22', daysAgo: 27, defCount: 8, topFTag: 'F0689', topFTagName: 'Free of Accident Hazards' },
    ],
    summary: {
      totalSurveys: counties.reduce((sum, c) => sum + c.surveys, 0),
      totalIJ: counties.reduce((sum, c) => sum + c.ijCount, 0),
      avgDeficiencies: (counties.reduce((sum, c) => sum + c.avgDefs, 0) / counties.length).toFixed(1),
      activeClusters: 1,
    },
  };
};

/**
 * Summary Card Component - Ultra Compact Design
 */
const SummaryCard = ({ title, value, icon: Icon, variant = 'primary', tooltip }) => {
  return (
    <Card className={`survey-summary-card survey-summary-card--${variant}`}>
      <Card.Body className="summary-card-body">
        <div className="summary-card-row">
          <span className="summary-card-title">{title}</span>
          {tooltip && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip id={`tooltip-${title}`}>{tooltip}</Tooltip>}
            >
              <Info size={12} className="summary-card-info" />
            </OverlayTrigger>
          )}
          <span className={`summary-card-value text-${variant}`}>{value}</span>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Get trend icon and color based on trend direction
 */
const getTrendConfig = (trend) => {
  switch (trend) {
    case 'UP':
      return { icon: TrendingUp, color: '#dc2626', label: 'Increasing' };
    case 'DOWN':
      return { icon: TrendingDown, color: '#16a34a', label: 'Decreasing' };
    default:
      return { icon: Minus, color: '#6b7280', label: 'Stable' };
  }
};

/**
 * Custom tooltip for the F-Tag bar chart
 */
const FTagBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="ftag-chart-tooltip">
        <div className="tooltip-header">{data.code}</div>
        <div className="tooltip-name">{data.name}</div>
        <div className="tooltip-value">
          <strong>{data.count.toLocaleString()}</strong> citations
        </div>
        <div className="tooltip-change">
          {data.changePct > 0 ? '+' : ''}{data.changePct}% vs prior period
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Custom tooltip for the survey volume chart
 */
const VolumeChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="volume-chart-tooltip">
        <div className="tooltip-header">{label} 2024</div>
        <div className="tooltip-row">
          <span className="tooltip-label">Surveys:</span>
          <span className="tooltip-value">{payload[0]?.value?.toLocaleString()}</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Avg Deficiencies:</span>
          <span className="tooltip-value">{payload[1]?.value?.toFixed(1)}</span>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * Top F-Tags Bar Chart Component
 */
const TopFTagsChart = ({ data }) => {
  // Color bars based on trend
  const getBarColor = (trend) => {
    switch (trend) {
      case 'UP': return '#dc2626';
      case 'DOWN': return '#16a34a';
      default: return '#6b7280';
    }
  };

  return (
    <Card className="national-chart-card">
      <Card.Header className="chart-header">
        <h6 className="chart-title">
          <BarChart3 size={18} />
          Top 10 F-Tags by Citation Count
        </h6>
      </Card.Header>
      <Card.Body className="chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" tickFormatter={(val) => val.toLocaleString()} />
            <YAxis
              type="category"
              dataKey="code"
              tick={{ fontSize: 12 }}
              width={70}
            />
            <RechartsTooltip content={<FTagBarTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.trend)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#dc2626' }} />
            Trending Up
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#16a34a' }} />
            Trending Down
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#6b7280' }} />
            Stable
          </span>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * F-Tag Trend Table Component with sorting
 */
const FTagTrendTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });

  const sortedData = useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle string comparisons
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="sort-icon inactive" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="sort-icon active" />
      : <ArrowDown size={14} className="sort-icon active" />;
  };

  return (
    <Card className="national-table-card">
      <Card.Header className="table-header">
        <h6 className="table-title">
          <Tag size={18} />
          F-Tag Citation Trends
        </h6>
      </Card.Header>
      <Card.Body className="table-body">
        <div className="table-responsive">
          <Table className="ftag-trend-table" hover>
            <thead>
              <tr>
                <th onClick={() => handleSort('rank')} className="sortable">
                  Rank {getSortIcon('rank')}
                </th>
                <th onClick={() => handleSort('code')} className="sortable">
                  F-Tag {getSortIcon('code')}
                </th>
                <th onClick={() => handleSort('name')} className="sortable">
                  Description {getSortIcon('name')}
                </th>
                <th onClick={() => handleSort('count')} className="sortable text-end">
                  Citations {getSortIcon('count')}
                </th>
                <th onClick={() => handleSort('changePct')} className="sortable text-end">
                  Change {getSortIcon('changePct')}
                </th>
                <th className="text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item) => {
                const trendConfig = getTrendConfig(item.trend);
                const TrendIcon = trendConfig.icon;

                return (
                  <tr key={item.code}>
                    <td className="rank-cell">#{item.rank}</td>
                    <td>
                      <span className="ftag-code-badge">{item.code}</span>
                    </td>
                    <td className="description-cell">{item.name}</td>
                    <td className="text-end count-cell">
                      {item.count.toLocaleString()}
                    </td>
                    <td className="text-end">
                      <span
                        className={`change-badge ${item.changePct > 0 ? 'positive' : item.changePct < 0 ? 'negative' : 'neutral'}`}
                      >
                        {item.changePct > 0 ? '+' : ''}{item.changePct}%
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className="trend-indicator"
                        style={{ color: trendConfig.color }}
                        title={trendConfig.label}
                      >
                        <TrendIcon size={16} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Key Insights Box Component
 */
const KeyInsightsBox = ({ insights }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <Card className="insights-card">
      <Card.Header className="insights-header">
        <h6 className="insights-title">
          <Lightbulb size={18} />
          Key Insights
        </h6>
      </Card.Header>
      <Card.Body className="insights-body">
        <ul className="insights-list">
          {insights.map((insight, index) => (
            <li key={index} className="insight-item">
              <Info size={14} className="insight-icon" />
              {insight}
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
};

/**
 * Survey Volume Chart Component
 */
const SurveyVolumeChart = ({ data }) => {
  return (
    <Card className="national-chart-card">
      <Card.Header className="chart-header">
        <h6 className="chart-title">
          <TrendingUp size={18} />
          Monthly Survey Volume & Deficiency Trends
        </h6>
      </Card.Header>
      <Card.Body className="chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthLabel" />
            <YAxis
              yAxisId="left"
              tickFormatter={(val) => val.toLocaleString()}
              label={{ value: 'Surveys', angle: -90, position: 'insideLeft', offset: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 10]}
              label={{ value: 'Avg Deficiencies', angle: 90, position: 'insideRight', offset: 10 }}
            />
            <RechartsTooltip content={<VolumeChartTooltip />} />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="surveys"
              name="Survey Count"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: '#2563eb', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgDefs"
              name="Avg Deficiencies"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
};

/**
 * National Overview Tab Content
 */
const NationalOverviewTab = ({ data, selectedState, selectedPeriod }) => {
  const [overviewData, setOverviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await getNationalOverview(selectedPeriod);
        if (response.success) {
          setOverviewData(response.data);
        } else {
          console.error('Failed to load national overview:', response.error);
          setOverviewData(null);
        }
      } catch (error) {
        console.error('Error fetching national overview:', error);
        setOverviewData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedPeriod]);

  if (isLoading) {
    return (
      <div className="tab-content-area">
        <div className="overview-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading national overview data...</p>
        </div>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="tab-content-area">
        <div className="overview-error">
          <AlertTriangle size={32} />
          <p>Unable to load overview data</p>
        </div>
      </div>
    );
  }

  const periodLabel = TIME_PERIODS.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

  return (
    <div className="tab-content-area national-overview">
      <div className="overview-intro">
        <p>
          Showing {selectedState === 'ALL' ? 'national' : selectedState} survey trends
          for the <strong>{periodLabel.toLowerCase()}</strong>.
        </p>
      </div>

      {/* Key Insights - prominent at top */}
      <KeyInsightsBox insights={overviewData.insights} />

      {/* Charts Row */}
      <Row className="g-4 mt-2">
        <Col xs={12} lg={6}>
          <TopFTagsChart data={overviewData.topFTags} />
        </Col>
        <Col xs={12} lg={6}>
          <SurveyVolumeChart data={overviewData.monthlyVolume} />
        </Col>
      </Row>

      {/* F-Tag Trend Table */}
      <div className="mt-4">
        <FTagTrendTable data={overviewData.topFTags} />
      </div>
    </div>
  );
};

/**
 * Get status configuration for comparison cards
 */
const getComparisonStatus = (status) => {
  switch (status) {
    case 'ABOVE':
      return { icon: ArrowUp, color: '#dc2626', label: 'Above National', bgClass: 'status-above' };
    case 'BELOW':
      return { icon: ArrowDown, color: '#16a34a', label: 'Below National', bgClass: 'status-below' };
    default:
      return { icon: Equal, color: '#6b7280', label: 'At National', bgClass: 'status-at' };
  }
};

/**
 * State vs National Comparison Card
 */
const ComparisonCard = ({ title, stateValue, nationalValue, delta, status, format = 'number', stateLabel }) => {
  const statusConfig = getComparisonStatus(status);
  const StatusIcon = statusConfig.icon;

  const formatValue = (val) => {
    if (format === 'percent') {
      return `${(val * 100).toFixed(1)}%`;
    }
    if (format === 'decimal') {
      return val.toFixed(1);
    }
    return val.toLocaleString();
  };

  const formatDelta = (val) => {
    if (format === 'percent') {
      return `${val > 0 ? '+' : ''}${(val * 100).toFixed(2)}%`;
    }
    if (format === 'decimal') {
      return `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
    }
    return `${val > 0 ? '+' : ''}${val.toLocaleString()}`;
  };

  return (
    <Card className="comparison-card">
      <Card.Body>
        <div className="comparison-header">
          <span className="comparison-title">{title}</span>
          <span className={`comparison-status ${statusConfig.bgClass}`}>
            <StatusIcon size={12} />
            {statusConfig.label}
          </span>
        </div>
        <div className="comparison-values">
          <div className="comparison-state">
            <span className="value-label">{stateLabel || 'State'}</span>
            <span className="value-number">{formatValue(stateValue)}</span>
          </div>
          <div className="comparison-vs">vs</div>
          <div className="comparison-national">
            <span className="value-label">National</span>
            <span className="value-number">{formatValue(nationalValue)}</span>
          </div>
        </div>
        {delta !== undefined && (
          <div className={`comparison-delta ${status === 'ABOVE' ? 'delta-above' : status === 'BELOW' ? 'delta-below' : 'delta-at'}`}>
            {formatDelta(delta)} vs national average
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

/**
 * State F-Tag Priority Table
 */
const StateFTagPriorityTable = ({ data, stateName }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'stateRank', direction: 'asc' });

  const sortedData = useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="sort-icon inactive" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="sort-icon active" />
      : <ArrowDown size={14} className="sort-icon active" />;
  };

  // Highlight significant deltas (more than 3 ranks difference)
  const isSignificantDelta = (delta) => Math.abs(delta) >= 3;

  return (
    <Card className="state-ftag-table-card">
      <Card.Header className="table-header">
        <h6 className="table-title">
          <Target size={18} />
          {stateName} F-Tag Priorities
        </h6>
        <span className="table-subtitle">Compared to national rankings</span>
      </Card.Header>
      <Card.Body className="table-body">
        <div className="table-responsive">
          <Table className="state-ftag-table" hover>
            <thead>
              <tr>
                <th onClick={() => handleSort('stateRank')} className="sortable">
                  State Rank {getSortIcon('stateRank')}
                </th>
                <th onClick={() => handleSort('code')} className="sortable">
                  F-Tag {getSortIcon('code')}
                </th>
                <th>Description</th>
                <th onClick={() => handleSort('stateCount')} className="sortable text-end">
                  Citations {getSortIcon('stateCount')}
                </th>
                <th onClick={() => handleSort('statePct')} className="sortable text-end">
                  % of Total {getSortIcon('statePct')}
                </th>
                <th onClick={() => handleSort('nationalRank')} className="sortable text-center">
                  Nat'l Rank {getSortIcon('nationalRank')}
                </th>
                <th onClick={() => handleSort('delta')} className="sortable text-center">
                  Delta {getSortIcon('delta')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item) => (
                <tr key={item.code} className={isSignificantDelta(item.delta) ? 'highlight-row' : ''}>
                  <td className="rank-cell">#{item.stateRank}</td>
                  <td>
                    <span className="ftag-code-badge">{item.code}</span>
                  </td>
                  <td className="description-cell">{item.name}</td>
                  <td className="text-end count-cell">{item.stateCount.toLocaleString()}</td>
                  <td className="text-end">{item.statePct.toFixed(1)}%</td>
                  <td className="text-center">#{item.nationalRank}</td>
                  <td className="text-center">
                    <span className={`delta-badge ${item.delta < 0 ? 'delta-focus' : item.delta > 0 ? 'delta-lower' : 'delta-same'}`}>
                      {item.delta === 0 ? '—' : item.delta < 0 ? `↑${Math.abs(item.delta)}` : `↓${item.delta}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="table-legend-note">
          <Flag size={14} />
          <span>
            <strong>↑ Focus Area:</strong> F-Tag ranked higher in state than nationally (e.g., ↑6 = state prioritizes 6 ranks higher)
          </span>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Day of Week Distribution Chart
 */
const DayOfWeekChart = ({ data, stateName, peakDay, peakDayPct, nationalPeakPct }) => {
  // Find max value for highlighting
  const maxPct = Math.max(...data.map(d => d.pct));

  return (
    <Card className="enforcement-patterns-card">
      <Card.Header className="chart-header">
        <h6 className="chart-title">
          <Calendar size={18} />
          Survey Day Distribution
        </h6>
      </Card.Header>
      <Card.Body className="chart-body">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="shortDay" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 12 }} />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="day-chart-tooltip">
                      <div className="tooltip-header">{d.day}</div>
                      <div className="tooltip-row">
                        <span>{stateName}:</span>
                        <strong>{d.pct}%</strong>
                      </div>
                      <div className="tooltip-row">
                        <span>National:</span>
                        <strong>{d.nationalPct}%</strong>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="pct" name={stateName} radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pct === maxPct ? '#2563eb' : '#94a3b8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="enforcement-insight">
          <Info size={16} />
          <span>
            <strong>{stateName}</strong> surveys heavily on <strong>{peakDay}s</strong> — {peakDayPct}% vs {nationalPeakPct}% national average
          </span>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * State Insights Component
 */
const StateInsightsBox = ({ insights, stateName }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <Card className="state-insights-card">
      <Card.Header className="insights-header">
        <h6 className="insights-title">
          <Lightbulb size={18} />
          {stateName} Key Insights
        </h6>
      </Card.Header>
      <Card.Body className="insights-body">
        <ul className="insights-list">
          {insights.map((insight, index) => (
            <li key={index} className="insight-item">
              <Flag size={14} className="insight-icon" />
              {insight}
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
};

/**
 * State Deep Dive Tab Content
 */
const StateDeepDiveTab = ({ data, selectedState, selectedPeriod }) => {
  const [stateData, setStateData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedState && selectedState !== 'ALL') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const response = await getStateData(selectedState, selectedPeriod);
          if (response.success) {
            setStateData(response.data);
          } else {
            console.error('Failed to load state data:', response.error);
            setStateData(null);
          }
        } catch (error) {
          console.error('Error fetching state data:', error);
          setStateData(null);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [selectedState, selectedPeriod]);

  // Show prompt when no state selected
  if (selectedState === 'ALL') {
    return (
      <div className="tab-content-area">
        <div className="select-state-prompt">
          <MapPin size={48} strokeWidth={1.5} />
          <h4>Select a State</h4>
          <p>Choose a specific state from the dropdown above to see detailed survey analytics.</p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="tab-content-area">
        <div className="overview-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading {US_STATES.find(s => s.code === selectedState)?.name} data...</p>
        </div>
      </div>
    );
  }

  // Handle missing data
  if (!stateData) {
    return (
      <div className="tab-content-area">
        <div className="overview-error">
          <AlertTriangle size={32} />
          <p>Unable to load state data</p>
        </div>
      </div>
    );
  }

  const { comparison, ftagPriorities, dayOfWeekDistribution, insights, stateName, peakDay, peakDayPct, nationalPeakPct } = stateData;

  return (
    <div className="tab-content-area state-deep-dive">
      <div className="state-header">
        <h4 className="state-title">
          <MapPin size={20} />
          {stateName} Survey Analytics
        </h4>
        <p className="state-subtitle">
          Detailed metrics compared to national averages
        </p>
      </div>

      {/* Comparison Cards Row */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={4}>
          <ComparisonCard
            title="Surveys This Period"
            stateValue={comparison.surveys.state}
            nationalValue={comparison.surveys.national}
            stateLabel={selectedState}
            format="number"
          />
        </Col>
        <Col xs={12} md={4}>
          <ComparisonCard
            title="Avg Deficiencies"
            stateValue={comparison.avgDeficiencies.state}
            nationalValue={comparison.avgDeficiencies.national}
            delta={comparison.avgDeficiencies.delta}
            status={comparison.avgDeficiencies.status}
            stateLabel={selectedState}
            format="decimal"
          />
        </Col>
        <Col xs={12} md={4}>
          <ComparisonCard
            title="IJ Rate"
            stateValue={comparison.ijRate.state}
            nationalValue={comparison.ijRate.national}
            delta={comparison.ijRate.delta}
            status={comparison.ijRate.status}
            stateLabel={selectedState}
            format="percent"
          />
        </Col>
      </Row>

      {/* State Insights */}
      <StateInsightsBox insights={insights} stateName={stateName} />

      {/* Charts Row */}
      <Row className="g-4 mt-2">
        <Col xs={12} lg={5}>
          <DayOfWeekChart
            data={dayOfWeekDistribution}
            stateName={stateName}
            peakDay={peakDay}
            peakDayPct={peakDayPct}
            nationalPeakPct={nationalPeakPct}
          />
        </Col>
        <Col xs={12} lg={7}>
          {/* F-Tag Priority Table */}
          <StateFTagPriorityTable data={ftagPriorities} stateName={stateName} />
        </Col>
      </Row>
    </div>
  );
};

/**
 * Map Placeholder Card for V1
 */
const MapPlaceholder = ({ stateName }) => {
  return (
    <Card className="map-placeholder-card">
      <Card.Body>
        <div className="map-placeholder-content">
          <Map size={40} strokeWidth={1.5} />
          <h5>Interactive Map Coming Soon</h5>
          <p>
            County-level heat map visualization for {stateName} will be available in a future update.
          </p>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * County Leaderboard Table
 */
const CountyLeaderboardTable = ({ counties, stateName }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });

  const sortedData = useMemo(() => {
    const sorted = [...counties];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [counties, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="sort-icon inactive" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="sort-icon active" />
      : <ArrowDown size={14} className="sort-icon active" />;
  };

  return (
    <Card className="county-leaderboard-card">
      <Card.Header className="table-header">
        <h6 className="table-title">
          <MapPin size={18} />
          County Activity Leaderboard
        </h6>
        <span className="table-subtitle">{stateName} - Top counties by survey volume</span>
      </Card.Header>
      <Card.Body className="table-body">
        <div className="table-responsive">
          <Table className="county-leaderboard-table" hover>
            <thead>
              <tr>
                <th onClick={() => handleSort('rank')} className="sortable">
                  Rank {getSortIcon('rank')}
                </th>
                <th onClick={() => handleSort('county')} className="sortable">
                  County {getSortIcon('county')}
                </th>
                <th onClick={() => handleSort('surveys')} className="sortable text-end">
                  Surveys {getSortIcon('surveys')}
                </th>
                <th onClick={() => handleSort('avgDefs')} className="sortable text-end">
                  Avg Defs {getSortIcon('avgDefs')}
                </th>
                <th onClick={() => handleSort('ijCount')} className="sortable text-center">
                  IJ Count {getSortIcon('ijCount')}
                </th>
                <th>Top F-Tag</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((county) => (
                <tr key={county.county}>
                  <td className="rank-cell">#{county.rank}</td>
                  <td className="county-name-cell">
                    <MapPin size={14} className="county-icon" />
                    {county.county}
                  </td>
                  <td className="text-end count-cell">{county.surveys}</td>
                  <td className="text-end">
                    <span className={`avg-defs-badge ${county.avgDefs >= 5.5 ? 'high' : county.avgDefs >= 5.0 ? 'medium' : 'low'}`}>
                      {county.avgDefs.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    {county.ijCount > 0 ? (
                      <span className="ij-badge">{county.ijCount}</span>
                    ) : (
                      <span className="ij-none">—</span>
                    )}
                  </td>
                  <td>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip id={`ftag-${county.county}`}>{county.topFTagName}</Tooltip>}
                    >
                      <span className="ftag-code-badge">{county.topFTag}</span>
                    </OverlayTrigger>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Activity Clusters Component
 */
const ActivityClusters = ({ clusters, stateName }) => {
  if (!clusters || clusters.length === 0) {
    return (
      <Card className="activity-clusters-card">
        <Card.Header className="clusters-header">
          <h6 className="clusters-title">
            <Zap size={18} />
            Activity Clusters
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="no-clusters">
            <Users size={24} strokeWidth={1.5} />
            <p>No significant activity clusters detected in {stateName}</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="activity-clusters-card">
      <Card.Header className="clusters-header">
        <h6 className="clusters-title">
          <Zap size={18} />
          Activity Clusters
        </h6>
        <span className="clusters-count">{clusters.length} detected</span>
      </Card.Header>
      <Card.Body className="clusters-body">
        {clusters.map((cluster) => (
          <div key={cluster.id} className={`cluster-item ${cluster.isActive ? 'active' : ''}`}>
            <div className="cluster-header">
              <span className="cluster-name">{cluster.name}</span>
              {cluster.isActive && (
                <span className="cluster-active-badge">
                  <span className="pulse-dot" />
                  Active
                </span>
              )}
            </div>
            <div className="cluster-details">
              <div className="cluster-stat">
                <Building2 size={14} />
                <span>{cluster.facilityCount} facilities</span>
              </div>
              <div className="cluster-stat">
                <Calendar size={14} />
                <span>{cluster.dateRange}</span>
              </div>
            </div>
            <div className="cluster-ftags">
              {cluster.commonFTags.map((tag, idx) => (
                <OverlayTrigger
                  key={tag}
                  placement="top"
                  overlay={<Tooltip id={`cluster-ftag-${cluster.id}-${tag}`}>{cluster.commonFTagNames[idx]}</Tooltip>}
                >
                  <span className="cluster-ftag-badge">{tag}</span>
                </OverlayTrigger>
              ))}
            </div>
            {cluster.note && (
              <div className="cluster-note">
                <Info size={12} />
                <span>{cluster.note}</span>
              </div>
            )}
          </div>
        ))}
      </Card.Body>
    </Card>
  );
};

/**
 * Recent Survey Feed Component
 */
const RecentSurveyFeed = ({ surveys, stateName }) => {
  const [showCount, setShowCount] = useState(5);

  const visibleSurveys = surveys.slice(0, showCount);
  const hasMore = surveys.length > showCount;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="recent-surveys-card">
      <Card.Header className="feed-header">
        <h6 className="feed-title">
          <Clock size={18} />
          Recent Surveys
        </h6>
        <span className="feed-subtitle">Last {surveys.length} surveys in {stateName}</span>
      </Card.Header>
      <Card.Body className="feed-body">
        <div className="survey-feed-list">
          {visibleSurveys.map((survey, index) => (
            <div key={`${survey.ccn}-${index}`} className="survey-feed-item">
              <div className="feed-item-main">
                <a
                  href={`/facility-metrics/${survey.ccn}`}
                  className="facility-link"
                >
                  {survey.facilityName}
                  <ExternalLink size={12} />
                </a>
                <div className="feed-item-meta">
                  <span className="meta-county">
                    <MapPin size={12} />
                    {survey.county}
                  </span>
                  <span className="meta-date">
                    {formatDate(survey.date)}
                    <span className="days-ago">({survey.daysAgo}d ago)</span>
                  </span>
                </div>
              </div>
              <div className="feed-item-stats">
                <span className={`def-count ${survey.defCount >= 5 ? 'high' : ''}`}>
                  {survey.defCount} defs
                </span>
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip id={`feed-ftag-${survey.ccn}`}>{survey.topFTagName}</Tooltip>}
                >
                  <span className="ftag-code-badge small">{survey.topFTag}</span>
                </OverlayTrigger>
              </div>
            </div>
          ))}
        </div>
        {hasMore && (
          <button
            className="show-more-btn"
            onClick={() => setShowCount((prev) => Math.min(prev + 5, surveys.length))}
          >
            Show More ({surveys.length - showCount} remaining)
          </button>
        )}
      </Card.Body>
    </Card>
  );
};

/**
 * Regional Hot Spots Tab Content
 */
const RegionalHotSpotsTab = ({ data, selectedState, selectedPeriod }) => {
  const [hotSpotsData, setHotSpotsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedState && selectedState !== 'ALL') {
      setIsLoading(true);
      const timer = setTimeout(() => {
        const regionalData = getRegionalHotSpotsData(selectedState, selectedPeriod);
        setHotSpotsData(regionalData);
        setIsLoading(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [selectedState, selectedPeriod]);

  // Show prompt when no state selected
  if (selectedState === 'ALL') {
    return (
      <div className="tab-content-area">
        <div className="select-state-prompt">
          <Flame size={48} strokeWidth={1.5} />
          <h4>Select a State</h4>
          <p>Choose a specific state from the dropdown above to see regional hot spots and activity patterns.</p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="tab-content-area">
        <div className="overview-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading regional data...</p>
        </div>
      </div>
    );
  }

  // Handle missing data
  if (!hotSpotsData) {
    return (
      <div className="tab-content-area">
        <div className="overview-error">
          <AlertTriangle size={32} />
          <p>Unable to load regional data</p>
        </div>
      </div>
    );
  }

  const { counties, clusters, recentSurveys, stateName, summary } = hotSpotsData;

  return (
    <div className="tab-content-area regional-hot-spots">
      <div className="regional-header">
        <div className="regional-title-section">
          <h4 className="regional-title">
            <Flame size={20} />
            {stateName} Regional Activity
          </h4>
          <p className="regional-subtitle">
            Survey hot spots and geographic patterns
          </p>
        </div>
        <div className="regional-summary-stats">
          <div className="summary-stat">
            <span className="stat-value">{summary.totalSurveys}</span>
            <span className="stat-label">Total Surveys</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{summary.avgDeficiencies}</span>
            <span className="stat-label">Avg Deficiencies</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value ij-highlight">{summary.totalIJ}</span>
            <span className="stat-label">IJ Citations</span>
          </div>
          {summary.activeClusters > 0 && (
            <div className="summary-stat">
              <span className="stat-value cluster-highlight">{summary.activeClusters}</span>
              <span className="stat-label">Active Cluster{summary.activeClusters > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <Row className="g-4">
        {/* Left Column - County Table */}
        <Col xs={12} lg={7}>
          <CountyLeaderboardTable counties={counties} stateName={stateName} />
        </Col>

        {/* Right Column - Map Placeholder, Clusters, Feed */}
        <Col xs={12} lg={5}>
          <div className="regional-sidebar">
            <MapPlaceholder stateName={stateName} />
            <ActivityClusters clusters={clusters} stateName={stateName} />
            <RecentSurveyFeed surveys={recentSurveys} stateName={stateName} />
          </div>
        </Col>
      </Row>
    </div>
  );
};

/**
 * F-Tag Trend Line Chart with selector
 */
const FTagTrendLineChart = ({ trendData, selectedFTags, availableFTags, onToggleFTag }) => {
  // Custom tooltip for the line chart
  const TrendChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="ftag-trend-tooltip">
          <div className="tooltip-header">{label}</div>
          <div className="tooltip-values">
            {payload.map((entry, index) => (
              <div key={index} className="tooltip-row" style={{ color: entry.color }}>
                <span className="tooltip-ftag">{entry.dataKey}:</span>
                <span className="tooltip-count">{entry.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="ftag-trend-chart-card">
      <Card.Header className="chart-header">
        <div className="chart-header-content">
          <h6 className="chart-title">
            <Activity size={18} />
            F-Tag Citation Trends Over Time
          </h6>
          <span className="chart-subtitle">
            Click F-Tags in the table below to toggle visibility ({selectedFTags.length} selected)
          </span>
        </div>
      </Card.Header>
      <Card.Body className="chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={trendData}
            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11 }} />
            <RechartsTooltip content={<TrendChartTooltip />} />
            <Legend />
            {availableFTags.filter(ftag => selectedFTags.includes(ftag.code)).map((ftag) => (
              <Line
                key={ftag.code}
                type="monotone"
                dataKey={ftag.code}
                name={ftag.code}
                stroke={ftag.color}
                strokeWidth={2}
                dot={{ fill: ftag.color, strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
};

/**
 * F-Tag Selector Table
 */
const FTagSelectorTable = ({ availableFTags, selectedFTags, onToggleFTag, onFocusFTag, focusedFTag, ftagDetails }) => {
  const handleRowClick = (code) => {
    onToggleFTag(code);
    onFocusFTag(code);
  };

  return (
    <Card className="ftag-selector-card">
      <Card.Header className="selector-header">
        <h6 className="selector-title">
          <Layers size={18} />
          F-Tag Selector
        </h6>
        <span className="selector-hint">Click rows to toggle on chart & view details</span>
      </Card.Header>
      <Card.Body className="selector-body">
        <div className="table-responsive">
          <Table className="ftag-selector-table" hover>
            <thead>
              <tr>
                <th className="col-visible"></th>
                <th>F-Tag</th>
                <th>Description</th>
                <th className="text-end">Citations</th>
                <th className="text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {availableFTags.map((ftag) => {
                const isSelected = selectedFTags.includes(ftag.code);
                const isFocused = focusedFTag === ftag.code;
                const details = ftagDetails[ftag.code];
                const trendConfig = getTrendConfig(details?.trend);
                const TrendIcon = trendConfig.icon;

                return (
                  <tr
                    key={ftag.code}
                    className={`ftag-row ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                    onClick={() => handleRowClick(ftag.code)}
                  >
                    <td className="col-visible">
                      <span
                        className={`visibility-indicator ${isSelected ? 'visible' : ''}`}
                        style={{ backgroundColor: isSelected ? ftag.color : 'transparent' }}
                      >
                        {isSelected && <Eye size={12} />}
                      </span>
                    </td>
                    <td>
                      <span className="ftag-code-badge" style={{ borderColor: ftag.color }}>
                        {ftag.code}
                      </span>
                    </td>
                    <td className="description-cell">{ftag.name}</td>
                    <td className="text-end count-cell">
                      {details?.currentCount?.toLocaleString() || '—'}
                    </td>
                    <td className="text-center">
                      <span className="trend-indicator" style={{ color: trendConfig.color }}>
                        <TrendIcon size={14} />
                        <span className="trend-pct">
                          {details?.changePct > 0 ? '+' : ''}{details?.changePct || 0}%
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * F-Tag Detail Card
 */
const FTagDetailCard = ({ ftag, details }) => {
  if (!details) return null;

  const trendConfig = getTrendConfig(details.trend);
  const TrendIcon = trendConfig.icon;

  // Colors for severity bars
  const severityColors = {
    'D': '#22c55e',
    'E': '#84cc16',
    'F': '#facc15',
    'G': '#f97316',
    'H-L': '#dc2626',
  };

  return (
    <Card className="ftag-detail-card">
      <Card.Header className="detail-header">
        <div className="detail-header-main">
          <span className="ftag-code-badge large" style={{ borderColor: ftag.color }}>
            {details.code}
          </span>
          <h6 className="detail-title">{details.name}</h6>
        </div>
        <div className="detail-trend" style={{ color: trendConfig.color }}>
          <TrendIcon size={18} />
          <span>{details.changePct > 0 ? '+' : ''}{details.changePct}%</span>
        </div>
      </Card.Header>
      <Card.Body className="detail-body">
        <p className="detail-description">{details.description}</p>

        <div className="detail-stats">
          <div className="stat-item">
            <span className="stat-label">Current Period</span>
            <span className="stat-value">{details.currentCount?.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Prior Period</span>
            <span className="stat-value muted">{details.priorCount?.toLocaleString()}</span>
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="severity-section">
          <h6 className="section-label">Severity Distribution</h6>
          <div className="severity-bars">
            {details.severityDistribution?.map((sev) => (
              <div key={sev.severity} className="severity-bar-item">
                <div className="severity-bar-header">
                  <span className="severity-label">{sev.severity}</span>
                  <span className="severity-pct">{sev.pct}%</span>
                </div>
                <div className="severity-bar-track">
                  <div
                    className="severity-bar-fill"
                    style={{
                      width: `${sev.pct}%`,
                      backgroundColor: severityColors[sev.severity] || '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Co-Citations */}
        <div className="cocitations-section">
          <h6 className="section-label">Common Co-Citations</h6>
          <div className="cocitations-list">
            {details.coCitations?.map((coCite) => (
              <div key={coCite.code} className="cocitation-item">
                <span className="cocitation-ftag">{coCite.code}</span>
                <span className="cocitation-name">{coCite.name}</span>
                <span className="cocitation-pct">{coCite.coOccurrencePct}%</span>
              </div>
            ))}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Emerging Patterns Table
 */
const EmergingPatternsTable = ({ patterns }) => {
  return (
    <Card className="emerging-patterns-card">
      <Card.Header className="patterns-header">
        <h6 className="patterns-title">
          <Flame size={18} />
          Emerging Patterns
        </h6>
        <span className="patterns-subtitle">F-Tags with biggest increases (90 days)</span>
      </Card.Header>
      <Card.Body className="patterns-body">
        <div className="table-responsive">
          <Table className="emerging-patterns-table" hover>
            <thead>
              <tr>
                <th>F-Tag</th>
                <th>Description</th>
                <th className="text-end">Current</th>
                <th className="text-end">Prior</th>
                <th className="text-center">Change</th>
                <th className="text-center">IJ Rate</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((pattern, index) => (
                <tr key={pattern.code} className={index === 0 ? 'highlight-row' : ''}>
                  <td>
                    <span className="ftag-code-badge">{pattern.code}</span>
                  </td>
                  <td className="description-cell">{pattern.name}</td>
                  <td className="text-end count-cell">{pattern.current.toLocaleString()}</td>
                  <td className="text-end muted-cell">{pattern.prior.toLocaleString()}</td>
                  <td className="text-center">
                    <span className="change-badge positive">
                      <TrendingUp size={12} />
                      +{pattern.changePct}%
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`ij-rate-badge ${pattern.ijPct >= 5 ? 'high' : ''}`}>
                      {pattern.ijPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Correlation Insights Component
 */
const CorrelationInsights = ({ insights }) => {
  return (
    <Card className="correlation-insights-card">
      <Card.Header className="insights-header">
        <h6 className="insights-title">
          <Link2 size={18} />
          Citation Correlation Insights
        </h6>
      </Card.Header>
      <Card.Body className="insights-body">
        <ul className="correlation-list">
          {insights.map((insight, index) => (
            <li key={index} className={`correlation-item ${insight.increase ? 'increase' : ''}`}>
              {insight.increase ? (
                <TrendingUp size={14} className="correlation-icon increase" />
              ) : (
                <Link2 size={14} className="correlation-icon" />
              )}
              <span>{insight.text}</span>
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
};

/**
 * F-Tag Trends Tab Content
 */
const FTagTrendsTab = ({ data, selectedState, selectedPeriod }) => {
  const [trendsData, setTrendsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFTags, setSelectedFTags] = useState(['F0880', 'F0689', 'F0812', 'F0684', 'F0686']); // Top 5 pre-selected
  const [focusedFTag, setFocusedFTag] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await getFTagTrends(selectedPeriod, 10);
        if (response.success) {
          setTrendsData(response.data);
        } else {
          console.error('Failed to load F-Tag trends:', response.error);
          setTrendsData(null);
        }
      } catch (error) {
        console.error('Error fetching F-Tag trends:', error);
        setTrendsData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedState, selectedPeriod]);

  // Handle toggling F-Tags in the chart
  const handleToggleFTag = (code) => {
    setSelectedFTags((prev) => {
      if (prev.includes(code)) {
        // Don't allow deselecting all - keep at least one
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  // Handle clicking on an F-Tag to show details
  const handleFocusFTag = (code) => {
    setFocusedFTag((prev) => (prev === code ? null : code));
  };

  if (isLoading) {
    return (
      <div className="tab-content-area">
        <div className="overview-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading F-Tag trends data...</p>
        </div>
      </div>
    );
  }

  if (!trendsData) {
    return (
      <div className="tab-content-area">
        <div className="overview-error">
          <AlertTriangle size={32} />
          <p>Unable to load F-Tag trends data</p>
        </div>
      </div>
    );
  }

  const { trendData, ftagDetails, emergingPatterns, correlationInsights, availableFTags } = trendsData;

  // Get focused F-Tag details
  const focusedDetails = focusedFTag ? ftagDetails[focusedFTag] : null;
  const focusedFTagInfo = focusedFTag ? availableFTags.find(f => f.code === focusedFTag) : null;

  return (
    <div className="tab-content-area ftag-trends">
      <div className="ftag-trends-header">
        <h4 className="trends-title">
          <Activity size={20} />
          F-Tag Trend Analysis
        </h4>
        <p className="trends-subtitle">
          Track citation patterns and identify emerging enforcement priorities
        </p>
      </div>

      {/* Main Grid Layout */}
      <Row className="g-4">
        {/* Left Column - Chart and Selector */}
        <Col xs={12} lg={8}>
          <FTagTrendLineChart
            trendData={trendData}
            selectedFTags={selectedFTags}
            availableFTags={availableFTags}
            onToggleFTag={handleToggleFTag}
          />

          <div className="mt-4">
            <FTagSelectorTable
              availableFTags={availableFTags}
              selectedFTags={selectedFTags}
              onToggleFTag={handleToggleFTag}
              onFocusFTag={handleFocusFTag}
              focusedFTag={focusedFTag}
              ftagDetails={ftagDetails}
            />
          </div>
        </Col>

        {/* Right Column - Details and Insights */}
        <Col xs={12} lg={4}>
          <div className="ftag-trends-sidebar">
            {/* F-Tag Detail Card - shown when F-Tag is focused */}
            {focusedDetails && focusedFTagInfo ? (
              <FTagDetailCard ftag={focusedFTagInfo} details={focusedDetails} />
            ) : (
              <Card className="ftag-detail-prompt">
                <Card.Body>
                  <div className="detail-prompt-content">
                    <Eye size={32} strokeWidth={1.5} />
                    <h6>View F-Tag Details</h6>
                    <p>Click any row in the table to view detailed analysis including severity distribution and co-citations.</p>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Correlation Insights */}
            <div className="mt-4">
              <CorrelationInsights insights={correlationInsights} />
            </div>
          </div>
        </Col>
      </Row>

      {/* Emerging Patterns - Full Width */}
      <div className="mt-4">
        <EmergingPatternsTable patterns={emergingPatterns} />
      </div>
    </div>
  );
};

/**
 * Complaint Insights Tab Content (V2 Placeholder)
 */
const ComplaintInsightsTab = () => {
  // Mock aggregate data we "have" from snf_facilities
  const previewStats = {
    avgComplaintsPerFacility: 28.9,
    highComplaintFacilities: 1247,
    nationalSubstantiationRate: 34.2,
    complaintDrivenSurveyPct: 18.5,
  };

  return (
    <div className="tab-content-area complaint-insights-placeholder">
      {/* Coming Soon Header */}
      <div className="coming-soon-header">
        <div className="coming-soon-icon">
          <Clock size={48} strokeWidth={1.5} />
        </div>
        <h4 className="coming-soon-title">Complaint Intelligence Coming Soon</h4>
        <span className="v2-badge">V2 Feature</span>
      </div>

      <p className="coming-soon-description">
        Complaint-driven surveys are inherently unpredictable, but we're building tools to help you
        monitor complaint activity and prepare accordingly. This section will provide actionable
        insights into complaint patterns and their impact on survey outcomes.
      </p>

      <Row className="g-4 mt-3">
        {/* What's Planned */}
        <Col xs={12} md={6}>
          <Card className="planned-features-card">
            <Card.Header className="planned-header">
              <h6 className="planned-title">
                <Layers size={18} />
                What We're Building
              </h6>
            </Card.Header>
            <Card.Body>
              <ul className="planned-features-list">
                <li>
                  <TrendingUp size={16} className="feature-icon" />
                  <div className="feature-content">
                    <span className="feature-name">Complaint Volume Trends</span>
                    <span className="feature-desc">Track complaint filings by facility, region, and state over time</span>
                  </div>
                </li>
                <li>
                  <CheckCircle2 size={16} className="feature-icon" />
                  <div className="feature-content">
                    <span className="feature-name">Substantiation Rate Analysis</span>
                    <span className="feature-desc">See which complaint categories lead to citations most often</span>
                  </div>
                </li>
                <li>
                  <Tag size={16} className="feature-icon" />
                  <div className="feature-content">
                    <span className="feature-name">Common Complaint Categories</span>
                    <span className="feature-desc">Identify trending complaint types and emerging patterns</span>
                  </div>
                </li>
                <li>
                  <Clock size={16} className="feature-icon" />
                  <div className="feature-content">
                    <span className="feature-name">Time-to-Survey Patterns</span>
                    <span className="feature-desc">Understand typical lag between complaint filing and survey</span>
                  </div>
                </li>
                <li>
                  <Calendar size={16} className="feature-icon" />
                  <div className="feature-content">
                    <span className="feature-name">Weekend Survey Correlation</span>
                    <span className="feature-desc">Analyze complaint-driven survey timing patterns</span>
                  </div>
                </li>
              </ul>
            </Card.Body>
          </Card>
        </Col>

        {/* Data Preview */}
        <Col xs={12} md={6}>
          <Card className="data-preview-card">
            <Card.Header className="preview-header">
              <h6 className="preview-title">
                <Eye size={18} />
                Data Preview
              </h6>
              <span className="preview-badge">From Current Dataset</span>
            </Card.Header>
            <Card.Body>
              <p className="preview-intro">
                We already have some complaint data available. Here's a snapshot of what we can show:
              </p>
              <div className="preview-stats-grid">
                <div className="preview-stat">
                  <span className="preview-stat-value">{previewStats.avgComplaintsPerFacility}</span>
                  <span className="preview-stat-label">Avg Complaints per Facility</span>
                </div>
                <div className="preview-stat">
                  <span className="preview-stat-value">{previewStats.highComplaintFacilities.toLocaleString()}</span>
                  <span className="preview-stat-label">High Complaint Facilities (&gt;50)</span>
                </div>
                <div className="preview-stat">
                  <span className="preview-stat-value">{previewStats.nationalSubstantiationRate}%</span>
                  <span className="preview-stat-label">National Substantiation Rate</span>
                </div>
                <div className="preview-stat">
                  <span className="preview-stat-value">{previewStats.complaintDrivenSurveyPct}%</span>
                  <span className="preview-stat-label">Surveys Complaint-Driven</span>
                </div>
              </div>
              <div className="preview-note">
                <Info size={14} />
                <span>Full complaint analytics will include historical trends, category breakdowns, and facility-level insights.</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Bottom CTA */}
      <div className="coming-soon-footer">
        <MessageSquare size={20} />
        <span>Have feedback on what complaint insights would be most valuable? Let us know!</span>
      </div>
    </div>
  );
};

/**
 * Empty State Component for when no data is available
 */
const EmptyState = ({ stateName, periodLabel }) => (
  <div className="empty-state">
    <div className="empty-state-icon">
      <FileQuestion size={48} strokeWidth={1.5} />
    </div>
    <h4 className="empty-state-title">No Survey Data Found</h4>
    <p className="empty-state-message">
      No survey data found for <strong>{stateName}</strong> in the selected time period ({periodLabel}).
    </p>
    <p className="empty-state-hint">
      Try expanding to 12 months or selecting a different state.
    </p>
  </div>
);

/**
 * Loading Skeleton for Summary Cards - Ultra Compact
 */
const SummarySkeleton = () => (
  <Row className="g-2 mb-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <Col key={i} xs={6} lg={3}>
        <Card className="survey-summary-card skeleton-card">
          <Card.Body className="summary-card-body">
            <div className="skeleton-row">
              <div className="skeleton-line skeleton-label" />
              <div className="skeleton-line skeleton-number" />
            </div>
          </Card.Body>
        </Card>
      </Col>
    ))}
  </Row>
);

/**
 * SurveyAnalytics Page Component
 */
const SurveyAnalytics = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params or defaults
  const [selectedState, setSelectedState] = useState(
    searchParams.get('state') || 'ALL'
  );
  const [selectedPeriod, setSelectedPeriod] = useState(
    searchParams.get('period') || '90days'
  );
  const [activeTab, setActiveTab] = useState(() => {
    // If state is specified in URL, default to state tab
    const urlState = searchParams.get('state');
    return urlState && urlState !== 'ALL' ? 'state' : 'national';
  });
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get current state name for display
  const currentStateName = useMemo(() => {
    if (selectedState === 'ALL') return 'National';
    return US_STATES.find(s => s.code === selectedState)?.name || selectedState;
  }, [selectedState]);

  // Get current period label for display
  const currentPeriodLabel = useMemo(() => {
    return TIME_PERIODS.find(p => p.value === selectedPeriod)?.label || selectedPeriod;
  }, [selectedPeriod]);

  // Update document title when state changes
  useEffect(() => {
    const title = selectedState === 'ALL'
      ? 'Survey Analytics - SNFalyze'
      : `${currentStateName} Survey Analytics - SNFalyze`;
    document.title = title;

    // Cleanup: restore default title on unmount
    return () => {
      document.title = 'SNFalyze';
    };
  }, [selectedState, currentStateName]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedState !== 'ALL') params.set('state', selectedState);
    if (selectedPeriod !== '90days') params.set('period', selectedPeriod);
    setSearchParams(params, { replace: true });
  }, [selectedState, selectedPeriod, setSearchParams]);

  // Fetch summary data when filters change
  useEffect(() => {
    const fetchSummaryData = async () => {
      setIsLoading(true);
      try {
        if (selectedState === 'ALL') {
          // Fetch national overview data
          const response = await getNationalOverview(selectedPeriod);
          if (response.success) {
            const { summary, topFTags } = response.data;
            setSummaryData({
              surveyCount: parseInt(summary.survey_count) || 0,
              avgDeficiencies: parseFloat(summary.avg_deficiencies) || 0,
              ijRate: parseFloat(summary.ij_rate) || 0,
              topFTag: topFTags?.[0] ? {
                code: topFTags[0].code,
                name: topFTags[0].name,
                count: topFTags[0].count
              } : null
            });
          }
        } else {
          // Fetch state-specific data
          const response = await getStateData(selectedState, selectedPeriod);
          if (response.success) {
            const { comparison, ftagPriorities } = response.data;
            setSummaryData({
              surveyCount: comparison?.surveys?.state || 0,
              avgDeficiencies: comparison?.avgDeficiencies?.state || 0,
              ijRate: comparison?.ijRate?.state || 0,
              topFTag: ftagPriorities?.[0] ? {
                code: ftagPriorities[0].code,
                name: ftagPriorities[0].name,
                count: ftagPriorities[0].stateCount
              } : null
            });
          }
        }
      } catch (error) {
        console.error('Error fetching summary data:', error);
        setSummaryData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaryData();
  }, [selectedState, selectedPeriod]);

  // Handle state change
  const handleStateChange = (e) => {
    setSelectedState(e.target.value);
    // If selecting a specific state, switch to state deep dive tab
    if (e.target.value !== 'ALL' && activeTab === 'national') {
      setActiveTab('state');
    }
  };

  // Format IJ rate as percentage
  const formatIJRate = (rate) => {
    if (!rate) return '0.0%';
    return `${(rate * 100).toFixed(1)}%`;
  };

  return (
    <div className="survey-analytics-page">
      {/* Breadcrumb Navigation */}
      <nav className="survey-breadcrumb" aria-label="Breadcrumb">
        <ol className="breadcrumb-list">
          <li className="breadcrumb-item">
            <Link to="/dashboard" className="breadcrumb-link">
              <Home size={14} />
              <span>Home</span>
            </Link>
          </li>
          <li className="breadcrumb-separator">
            <ChevronRight size={14} />
          </li>
          <li className="breadcrumb-item">
            {selectedState === 'ALL' ? (
              <span className="breadcrumb-current">Survey Analytics</span>
            ) : (
              <Link to="/survey-analytics" className="breadcrumb-link">
                Survey Analytics
              </Link>
            )}
          </li>
          {selectedState !== 'ALL' && (
            <>
              <li className="breadcrumb-separator">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <span className="breadcrumb-current">{currentStateName}</span>
              </li>
            </>
          )}
        </ol>
      </nav>

      {/* Header Section */}
      <div className="page-header">
        <div className="header-content">
          <div className="title-section">
            <h1 className="page-title">
              <ClipboardList size={28} />
              Survey Analytics
            </h1>
            <p className="page-subtitle">
              Analyzing <strong>{currentStateName.toLowerCase()}</strong> survey patterns over the <strong>{currentPeriodLabel.toLowerCase()}</strong>
            </p>
          </div>

          <div className="header-controls">
            <Form.Select
              className="state-selector"
              value={selectedState}
              onChange={handleStateChange}
              aria-label="Select state for analysis"
            >
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </Form.Select>

            <div className="period-toggle" role="group" aria-label="Select time period">
              {TIME_PERIODS.map((period) => (
                <button
                  key={period.value}
                  className={`period-btn ${selectedPeriod === period.value ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod(period.value)}
                  aria-pressed={selectedPeriod === period.value}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <SummarySkeleton />
      ) : (
        <Row className="g-2 mb-3">
          <Col xs={6} lg={3}>
            <SummaryCard
              title="Surveys"
              value={summaryData?.surveyCount?.toLocaleString() || '0'}
              variant="primary"
              tooltip={`Total standard health surveys completed ${selectedState === 'ALL' ? 'nationwide' : `in ${selectedState}`}`}
            />
          </Col>
          <Col xs={6} lg={3}>
            <SummaryCard
              title="Avg Deficiencies"
              value={summaryData?.avgDeficiencies?.toFixed(1) || '0.0'}
              variant="info"
              tooltip="Average number of deficiency citations per survey"
            />
          </Col>
          <Col xs={6} lg={3}>
            <SummaryCard
              title="IJ Rate"
              value={formatIJRate(summaryData?.ijRate)}
              variant={summaryData?.ijRate > 0.02 ? 'danger' : 'warning'}
              tooltip="Percentage of surveys resulting in Immediate Jeopardy citations"
            />
          </Col>
          <Col xs={6} lg={3}>
            <SummaryCard
              title="Top F-Tag"
              value={summaryData?.topFTag?.code || 'N/A'}
              variant="secondary"
              tooltip={summaryData?.topFTag ? `${summaryData.topFTag.name} (${summaryData.topFTag.count?.toLocaleString() || 0} citations)` : 'Most frequently cited deficiency'}
            />
          </Col>
        </Row>
      )}

      {/* Tab Navigation */}
      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Card className="analytics-tabs-card">
          <Card.Header className="analytics-tabs-header">
            <Nav variant="tabs" className="analytics-nav-tabs" role="tablist" aria-label="Survey analytics sections">
              <Nav.Item role="presentation">
                <Nav.Link eventKey="national" role="tab" aria-selected={activeTab === 'national'}>
                  <BarChart3 size={16} aria-hidden="true" />
                  National Overview
                </Nav.Link>
              </Nav.Item>
              <Nav.Item role="presentation">
                <Nav.Link eventKey="state" role="tab" aria-selected={activeTab === 'state'}>
                  <MapPin size={16} aria-hidden="true" />
                  State Deep Dive
                </Nav.Link>
              </Nav.Item>
              <Nav.Item role="presentation">
                <Nav.Link eventKey="hotspots" role="tab" aria-selected={activeTab === 'hotspots'}>
                  <Flame size={16} aria-hidden="true" />
                  Regional Hot Spots
                </Nav.Link>
              </Nav.Item>
              <Nav.Item role="presentation">
                <Nav.Link eventKey="ftags" role="tab" aria-selected={activeTab === 'ftags'}>
                  <TrendingUp size={16} aria-hidden="true" />
                  F-Tag Trends
                </Nav.Link>
              </Nav.Item>
              <Nav.Item role="presentation">
                <Nav.Link eventKey="complaints" className="v2-tab" role="tab" aria-selected={activeTab === 'complaints'}>
                  <MessageSquare size={16} aria-hidden="true" />
                  Complaint Insights
                  <span className="v2-indicator" aria-label="Coming in version 2">V2</span>
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>

          <Card.Body className="analytics-tabs-body">
            <Tab.Content>
              <Tab.Pane eventKey="national">
                <NationalOverviewTab
                  data={summaryData}
                  selectedState={selectedState}
                  selectedPeriod={selectedPeriod}
                />
              </Tab.Pane>
              <Tab.Pane eventKey="state">
                <StateDeepDiveTab
                  data={summaryData}
                  selectedState={selectedState}
                  selectedPeriod={selectedPeriod}
                />
              </Tab.Pane>
              <Tab.Pane eventKey="hotspots">
                <RegionalHotSpotsTab
                  data={summaryData}
                  selectedState={selectedState}
                  selectedPeriod={selectedPeriod}
                />
              </Tab.Pane>
              <Tab.Pane eventKey="ftags">
                <FTagTrendsTab
                  data={summaryData}
                  selectedState={selectedState}
                  selectedPeriod={selectedPeriod}
                />
              </Tab.Pane>
              <Tab.Pane eventKey="complaints">
                <ComplaintInsightsTab />
              </Tab.Pane>
            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>
    </div>
  );
};

export default SurveyAnalytics;
