import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Card, ProgressBar, OverlayTrigger, Tooltip, Table } from 'react-bootstrap';
import {
  Calendar,
  AlertTriangle,
  TrendingUp,
  ClipboardList,
  HelpCircle,
  Bell,
  MapPin,
  ArrowRight,
  Info,
  Map,
  Shield,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import TabEmpty from '../shared/TabEmpty';
import './SurveyIntelligenceTab.css';

// Mock data - will be replaced with API call
const getMockSurveyData = (facilityId) => ({
  facilityId: facilityId || '555123',
  lastSurveyDate: '2024-03-15',
  daysSinceSurvey: 287,
  riskLevel: 'ELEVATED',
  probability7Days: 0.34,
  probability14Days: 0.52,
  probability30Days: 0.67,
  prepItemsCount: 4,
  surveyWindow: {
    windowOpens: '2025-03-01',
    federalMaximum: '2025-06-15',
    stateAverageInterval: 337,
    percentThroughWindow: 65,
  },
  bellwetherSignal: {
    active: true,
    facilityName: 'Santa Anita Convalescent Hospital',
    facilityCCN: '555234',
    surveyDate: '2024-12-10',
    daysSince: 9,
    typicalFollowRange: { min: 8, max: 12 },
  },
  nearbyActivity: {
    summary: '3 facilities within 10 miles surveyed in last 14 days. F0880 (Infection Control) cited at all 3.',
    facilities: [
      {
        name: 'Santa Anita Convalescent Hospital',
        ccn: '555234',
        distance: 3.2,
        surveyDate: '2024-12-10',
        daysAgo: 9,
        deficiencyCount: 4,
        topFTag: 'F0880',
        topFTagDescription: 'Infection Control',
      },
      {
        name: 'Valley Care Skilled Nursing',
        ccn: '555345',
        distance: 5.1,
        surveyDate: '2024-12-08',
        daysAgo: 11,
        deficiencyCount: 7,
        topFTag: 'F0689',
        topFTagDescription: 'Free of Accident Hazards',
      },
      {
        name: 'Sunrise Healthcare Center',
        ccn: '555456',
        distance: 7.8,
        surveyDate: '2024-11-28',
        daysAgo: 21,
        deficiencyCount: 3,
        topFTag: 'F0812',
        topFTagDescription: 'Food Safety',
      },
    ],
  },
  prepPriorities: [
    {
      priority: 'CRITICAL',
      fTag: 'F0880',
      fTagName: 'Infection Control',
      reason: 'Cited 2x in last 3 years + trending up 18% regionally',
      facilityCitationCount: 2,
      regionalTrend: 'UP',
      regionalTrendPct: 18,
    },
    {
      priority: 'HIGH',
      fTag: 'F0689',
      fTagName: 'Free of Accident Hazards',
      reason: 'Trending up in Los Angeles County (+23% this quarter)',
      facilityCitationCount: 0,
      regionalTrend: 'UP',
      regionalTrendPct: 23,
    },
    {
      priority: 'MODERATE',
      fTag: 'F0758',
      fTagName: 'Free from Medication Errors',
      reason: 'California state enforcement focus area',
      facilityCitationCount: 1,
      regionalTrend: 'STABLE',
      stateFocus: true,
    },
  ],
});

/**
 * Get color variant based on days since survey
 * Green if <270, Yellow if 270-365, Red if >365
 */
const getDaysSinceColor = (days) => {
  if (days < 270) return 'success';
  if (days <= 365) return 'warning';
  return 'danger';
};

/**
 * Get color variant based on risk level
 */
const getRiskLevelColor = (level) => {
  const colors = {
    LOW: 'success',
    MODERATE: 'info',
    ELEVATED: 'warning',
    HIGH: 'danger',
  };
  return colors[level] || 'secondary';
};

/**
 * Get color variant based on prep items count
 * Red if >3, Yellow if 2-3, Green if 0-1
 */
const getPrepItemsColor = (count) => {
  if (count <= 1) return 'success';
  if (count <= 3) return 'warning';
  return 'danger';
};

/**
 * Format date for display
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format date as "Month Year" (e.g., "March 2025")
 */
const formatMonthYear = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Summary Card Component - matches ProFormaTab styling
 */
const SummaryCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'primary',
  children
}) => (
  <Card className={`survey-summary-card border-${variant}`}>
    <Card.Body>
      <div className="d-flex justify-content-between align-items-start">
        <div className="summary-card-content">
          <div className="text-muted small">{title}</div>
          <h3 className={`mb-1 text-${variant}`}>{value}</h3>
          {subtitle && <div className="text-muted small">{subtitle}</div>}
          {children}
        </div>
        <div className={`summary-icon bg-${variant} bg-opacity-10`}>
          {Icon && <Icon size={24} className={`text-${variant}`} />}
        </div>
      </div>
    </Card.Body>
  </Card>
);

/**
 * Risk Level Badge Component
 */
const RiskBadge = ({ level }) => {
  const color = getRiskLevelColor(level);
  return (
    <span className={`risk-badge risk-badge-${color}`}>
      {level}
    </span>
  );
};

/**
 * Survey Window Timeline Component
 * Shows visual progress through the survey window
 */
const SurveyWindowSection = ({ surveyWindow }) => {
  if (!surveyWindow) return null;

  const { windowOpens, federalMaximum, stateAverageInterval, percentThroughWindow } = surveyWindow;

  // Determine color based on position in window
  const getProgressColor = (percent) => {
    if (percent < 50) return 'success';
    if (percent < 80) return 'warning';
    return 'danger';
  };

  return (
    <Card className="survey-window-card mb-4">
      <Card.Body>
        <div className="survey-window-header">
          <h5 className="mb-0">
            <Calendar size={18} className="me-2" />
            Survey Window
          </h5>
          <span className="state-interval-badge">
            State avg: {stateAverageInterval} days
          </span>
        </div>

        {/* Timeline Progress Bar */}
        <div className="survey-timeline">
          <div className="timeline-labels">
            <div className="timeline-label timeline-label-start">
              <span className="label-title">Window Opens</span>
              <span className="label-date">{formatMonthYear(windowOpens)}</span>
            </div>
            <div className="timeline-label timeline-label-end">
              <span className="label-title">Federal Max</span>
              <span className="label-date">{formatMonthYear(federalMaximum)}</span>
            </div>
          </div>

          <div className="timeline-bar-container">
            <div className="timeline-bar">
              <div
                className={`timeline-progress timeline-progress-${getProgressColor(percentThroughWindow)}`}
                style={{ width: `${Math.min(percentThroughWindow, 100)}%` }}
              />
              {/* Current position marker */}
              <div
                className="timeline-marker"
                style={{ left: `${Math.min(percentThroughWindow, 100)}%` }}
              >
                <div className="marker-dot" />
                <div className="marker-label">
                  <span className="marker-text">Today</span>
                  <span className="marker-percent">{percentThroughWindow}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key milestones */}
          <div className="timeline-milestones">
            <div className="milestone milestone-start">
              <div className="milestone-dot" />
            </div>
            <div className="milestone milestone-end">
              <div className="milestone-dot" />
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Bellwether Alert Component
 * Shows when a bellwether facility has been surveyed recently
 */
const BellwetherAlert = ({ bellwether }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!bellwether || !bellwether.active) return null;

  const { facilityName, facilityCCN, daysSince, typicalFollowRange } = bellwether;

  const bellwetherTooltip = (
    <Tooltip id="bellwether-tooltip" className="bellwether-tooltip">
      <strong>What's a Bellwether?</strong>
      <p className="mb-0 mt-1">
        Bellwether facilities are surveyed on predictable patterns in your area.
        When they get surveyed, facilities nearby often follow within a specific window.
        This alert means you should prepare for an increased likelihood of survey activity.
      </p>
    </Tooltip>
  );

  return (
    <div className="bellwether-alert">
      <div className="bellwether-icon">
        <Bell size={20} />
      </div>
      <div className="bellwether-content">
        <div className="bellwether-title">
          <span className="bellwether-label">BELLWETHER ALERT</span>
          <OverlayTrigger
            placement="top"
            overlay={bellwetherTooltip}
            trigger={['hover', 'focus']}
          >
            <button className="bellwether-help" aria-label="What's a bellwether?">
              <HelpCircle size={14} />
              <span>What's this?</span>
            </button>
          </OverlayTrigger>
        </div>
        <p className="bellwether-message">
          <Link to={`/facility-metrics/${facilityCCN}`} className="bellwether-facility-link">
            {facilityName}
          </Link>{' '}
          (CCN: {facilityCCN}) was surveyed{' '}
          <strong>{daysSince} days ago</strong>. You typically follow within{' '}
          <strong>{typicalFollowRange.min}-{typicalFollowRange.max} days</strong>.
        </p>
      </div>
    </div>
  );
};

/**
 * Nearby Survey Activity Component
 * Shows recent surveys at facilities near this one
 */
const NearbySurveyActivity = ({ nearbyActivity, facilityState }) => {
  const [dayFilter, setDayFilter] = useState(30);

  if (!nearbyActivity) return null;

  const { summary, facilities } = nearbyActivity;

  // Filter facilities based on selected day range
  const filteredFacilities = facilities.filter((f) => f.daysAgo <= dayFilter);

  const DAY_FILTERS = [30, 60, 90];

  return (
    <Card className="nearby-activity-card mb-4">
      <Card.Body>
        {/* Header with filter toggle */}
        <div className="nearby-activity-header">
          <h5 className="mb-0">
            <MapPin size={18} className="me-2" />
            Nearby Survey Activity
          </h5>
          <div className="day-filter-toggle">
            {DAY_FILTERS.map((days) => (
              <button
                key={days}
                className={`day-filter-btn ${dayFilter === days ? 'active' : ''}`}
                onClick={() => setDayFilter(days)}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        {/* Insight Box */}
        {summary && (
          <div className="nearby-insight-box">
            <Info size={16} className="insight-icon" />
            <p className="insight-text">{summary}</p>
          </div>
        )}

        {/* Facilities Table */}
        {filteredFacilities.length > 0 ? (
          <div className="nearby-table-wrapper">
            <Table className="nearby-activity-table" hover>
              <thead>
                <tr>
                  <th>Facility Name</th>
                  <th>Distance</th>
                  <th>Survey Date</th>
                  <th>Days Ago</th>
                  <th>Deficiencies</th>
                  <th>Top F-Tag</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map((facility) => (
                  <tr key={facility.ccn}>
                    <td>
                      <Link
                        to={`/facility-metrics/${facility.ccn}`}
                        className="facility-name-link"
                      >
                        {facility.name}
                      </Link>
                    </td>
                    <td>{facility.distance} mi</td>
                    <td>{formatDate(facility.surveyDate)}</td>
                    <td>
                      <span className={`days-ago-badge ${facility.daysAgo <= 14 ? 'recent' : ''}`}>
                        {facility.daysAgo}
                      </span>
                    </td>
                    <td>
                      <span className={`deficiency-count ${facility.deficiencyCount >= 5 ? 'high' : ''}`}>
                        {facility.deficiencyCount}
                      </span>
                    </td>
                    <td>
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip id={`ftag-${facility.ccn}`}>
                            {facility.topFTagDescription}
                          </Tooltip>
                        }
                      >
                        <span className="ftag-badge">{facility.topFTag}</span>
                      </OverlayTrigger>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="no-nearby-activity">
            <p>No survey activity within {dayFilter} days in this area.</p>
          </div>
        )}

        {/* Action Links */}
        <div className="nearby-activity-actions">
          <button className="view-map-btn" onClick={() => alert('Map view coming soon!')}>
            <Map size={16} />
            View on Map
          </button>
          <Link to="/survey-analytics" className="state-trends-link">
            See {facilityState || 'State'} Trends
            <ArrowRight size={16} />
          </Link>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Get priority indicator emoji and color class
 */
const getPriorityConfig = (priority) => {
  const configs = {
    CRITICAL: { emoji: '🔴', colorClass: 'priority-critical', label: 'Critical' },
    HIGH: { emoji: '🟠', colorClass: 'priority-high', label: 'High' },
    MODERATE: { emoji: '🟡', colorClass: 'priority-moderate', label: 'Moderate' },
    LOW: { emoji: '🟢', colorClass: 'priority-low', label: 'Low' },
  };
  return configs[priority] || configs.MODERATE;
};

/**
 * Prep Priorities Section Component
 * Shows what the facility should focus on preparing for
 */
const PrepPrioritiesSection = ({ prepPriorities }) => {
  if (!prepPriorities || prepPriorities.length === 0) return null;

  return (
    <Card className="prep-priorities-card mb-4">
      <Card.Body>
        {/* Header */}
        <div className="prep-priorities-header">
          <h5 className="mb-0">
            <Shield size={18} className="me-2" />
            My Prep Priorities
          </h5>
          <span className="priority-count-badge">
            {prepPriorities.length} items
          </span>
        </div>

        {/* Priority List */}
        <div className="priority-list">
          {prepPriorities.map((item, index) => {
            const priorityConfig = getPriorityConfig(item.priority);

            return (
              <div key={`${item.fTag}-${index}`} className={`priority-item ${priorityConfig.colorClass}`}>
                <div className="priority-indicator">
                  <span className="priority-emoji">{priorityConfig.emoji}</span>
                  <span className="priority-label">{priorityConfig.label}</span>
                </div>

                <div className="priority-content">
                  <div className="priority-ftag">
                    <span className="ftag-code">{item.fTag}</span>
                    <span className="ftag-separator">-</span>
                    <span className="ftag-name">{item.fTagName}</span>
                  </div>
                  <p className="priority-reason">{item.reason}</p>

                  {/* Citation indicator */}
                  {item.facilityCitationCount > 0 && (
                    <div className="priority-citation-badge">
                      <AlertTriangle size={12} />
                      Cited {item.facilityCitationCount}x at this facility
                    </div>
                  )}
                </div>

                <div className="priority-action">
                  <ChevronRight size={20} />
                </div>
              </div>
            );
          })}
        </div>

        {/* View Full Checklist Button */}
        <div className="prep-priorities-footer">
          <button
            className="view-checklist-btn"
            onClick={() => alert('Full checklist coming soon!')}
          >
            <CheckCircle2 size={16} />
            View Full Checklist
          </button>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * SurveyIntelligenceTab - Shows survey timing predictions and risk for a facility
 */
const SurveyIntelligenceTab = ({ facility }) => {
  // Show empty state if no facility selected
  if (!facility) {
    return (
      <TabEmpty
        icon={<Calendar size={48} strokeWidth={1.5} />}
        title="Select a Facility"
        message="Use the search above to select a facility and view survey intelligence."
      />
    );
  }

  // Get survey data (mock for now)
  const surveyData = getMockSurveyData(facility.ccn || facility.federal_provider_number);

  const daysSinceColor = getDaysSinceColor(surveyData.daysSinceSurvey);
  const prepItemsColor = getPrepItemsColor(surveyData.prepItemsCount);
  const probability30Pct = Math.round(surveyData.probability30Days * 100);

  return (
    <div className="survey-intelligence-tab">
      {/* Summary Cards Row */}
      <Row className="g-3 mb-4">
        {/* Card 1: Days Since Survey */}
        <Col xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Days Since Survey"
            value={surveyData.daysSinceSurvey}
            subtitle={`Last survey: ${formatDate(surveyData.lastSurveyDate)}`}
            icon={Calendar}
            variant={daysSinceColor}
          />
        </Col>

        {/* Card 2: Risk Level */}
        <Col xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Risk Level"
            value={<RiskBadge level={surveyData.riskLevel} />}
            subtitle="Based on timing + local activity"
            icon={AlertTriangle}
            variant={getRiskLevelColor(surveyData.riskLevel)}
          />
        </Col>

        {/* Card 3: 30-Day Probability */}
        <Col xs={12} sm={6} lg={3}>
          <SummaryCard
            title="30-Day Probability"
            value={`${probability30Pct}%`}
            subtitle="Chance of survey in next 30 days"
            icon={TrendingUp}
            variant="primary"
          >
            <ProgressBar
              now={probability30Pct}
              variant={probability30Pct > 50 ? 'warning' : 'primary'}
              className="mt-2 probability-bar"
            />
          </SummaryCard>
        </Col>

        {/* Card 4: Prep Items */}
        <Col xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Prep Items"
            value={surveyData.prepItemsCount}
            subtitle="High priority items"
            icon={ClipboardList}
            variant={prepItemsColor}
          />
        </Col>
      </Row>

      {/* Bellwether Alert - shows if signal is active */}
      <BellwetherAlert bellwether={surveyData.bellwetherSignal} />

      {/* Survey Window Timeline */}
      <SurveyWindowSection surveyWindow={surveyData.surveyWindow} />

      {/* Nearby Survey Activity */}
      <NearbySurveyActivity
        nearbyActivity={surveyData.nearbyActivity}
        facilityState={facility.state}
      />

      {/* Prep Priorities */}
      <PrepPrioritiesSection prepPriorities={surveyData.prepPriorities} />
    </div>
  );
};

export default SurveyIntelligenceTab;
