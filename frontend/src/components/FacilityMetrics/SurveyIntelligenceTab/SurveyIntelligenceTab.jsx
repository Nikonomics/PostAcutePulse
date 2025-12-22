import React, { useState, useEffect } from 'react';
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
  Network,
  Radio,
  Users,
  Loader,
} from 'lucide-react';
import TabEmpty from '../shared/TabEmpty';
import TabSkeleton from '../shared/TabSkeleton';
import { getFacilityIntelligence } from '../../../api/surveyService';
import './SurveyIntelligenceTab.css';

/**
 * Fetches survey intelligence data from the real API
 * Falls back to empty data on error
 */
const fetchSurveyIntelligence = async (facilityId) => {
  try {
    const response = await getFacilityIntelligence(facilityId);
    if (response.success) {
      return response.data;
    }
    console.error('Failed to fetch survey intelligence:', response.error);
    return null;
  } catch (error) {
    console.error('Error fetching survey intelligence:', error);
    return null;
  }
};

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
 * Loading Skeleton for Survey Intelligence Tab
 */
const SurveyIntelligenceSkeleton = () => (
  <div className="survey-intelligence-tab">
    {/* Summary Cards Skeleton */}
    <Row className="g-3 mb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Col key={i} xs={12} sm={6} lg={3}>
          <Card className="survey-summary-card skeleton-card">
            <Card.Body>
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-value" />
              <div className="skeleton-line skeleton-subtitle" />
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>

    {/* Survey Window Skeleton */}
    <Card className="survey-window-card mb-4 skeleton-card">
      <Card.Body>
        <div className="skeleton-line skeleton-header" />
        <div className="skeleton-timeline">
          <div className="skeleton-line skeleton-bar" />
        </div>
      </Card.Body>
    </Card>

    {/* Nearby Activity Skeleton */}
    <Card className="nearby-activity-card mb-4 skeleton-card">
      <Card.Body>
        <div className="skeleton-line skeleton-header" />
        <div className="skeleton-table-rows">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-line skeleton-row" />
          ))}
        </div>
      </Card.Body>
    </Card>
  </div>
);

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
const SurveyWindowSection = ({ surveyWindow, lastSurveyDate }) => {
  // Empty state if no survey history
  if (!lastSurveyDate) {
    return (
      <Card className="survey-window-card mb-4">
        <Card.Body>
          <div className="survey-window-header">
            <h5 className="mb-0">
              <Calendar size={18} className="me-2" />
              Survey Window
            </h5>
          </div>
          <div className="section-empty-state">
            <Calendar size={32} strokeWidth={1.5} />
            <p>No survey history available for this facility.</p>
            <span className="empty-state-hint">
              Survey window calculations require at least one prior survey.
            </span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (!surveyWindow) return null;

  const { windowOpens, federalMaximum, stateAverageInterval, percentThroughWindow } = surveyWindow;

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

  const DAY_FILTERS = [30, 60, 90];

  // Empty state if no nearby activity data
  if (!nearbyActivity || !nearbyActivity.facilities || nearbyActivity.facilities.length === 0) {
    return (
      <Card className="nearby-activity-card mb-4">
        <Card.Body>
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
          <div className="section-empty-state">
            <MapPin size={32} strokeWidth={1.5} />
            <p>No surveys recorded within 25 miles in the last 90 days.</p>
            <span className="empty-state-hint">
              Survey activity will appear here when facilities nearby are surveyed.
            </span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  const { summary, facilities } = nearbyActivity;
  const filteredFacilities = facilities.filter((f) => f.daysAgo <= dayFilter);

  return (
    <Card className="nearby-activity-card mb-4">
      <Card.Body>
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

        {summary && (
          <div className="nearby-insight-box">
            <Info size={16} className="insight-icon" />
            <p className="insight-text">{summary}</p>
          </div>
        )}

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

        <div className="nearby-activity-actions">
          <button className="view-map-btn" onClick={() => {}}>
            <Map size={16} />
            View on Map
          </button>
          <Link
            to={`/survey-analytics?state=${facilityState || ''}`}
            className="state-trends-link"
          >
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
  // Empty state if no priorities
  if (!prepPriorities || prepPriorities.length === 0) {
    return (
      <Card className="prep-priorities-card mb-4">
        <Card.Body>
          <div className="prep-priorities-header">
            <h5 className="mb-0">
              <Shield size={18} className="me-2" />
              My Prep Priorities
            </h5>
          </div>
          <div className="section-empty-state">
            <CheckCircle2 size={32} strokeWidth={1.5} className="text-success" />
            <p>No prep priorities identified.</p>
            <span className="empty-state-hint">
              Your facility is in good standing. Continue maintaining current compliance standards.
            </span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="prep-priorities-card mb-4">
      <Card.Body>
        <div className="prep-priorities-header">
          <h5 className="mb-0">
            <Shield size={18} className="me-2" />
            My Prep Priorities
          </h5>
          <span className="priority-count-badge">
            {prepPriorities.length} items
          </span>
        </div>

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

        <div className="prep-priorities-footer">
          <button className="view-checklist-btn" onClick={() => {}}>
            <CheckCircle2 size={16} />
            View Full Checklist
          </button>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Bellwether Network Section Component
 * Shows facilities that predict this facility's survey timing
 */
const BellwetherNetworkSection = ({ bellwetherNetwork }) => {
  const networkTooltip = (
    <Tooltip id="network-tooltip" className="bellwether-network-tooltip">
      <strong>What's a Bellwether Network?</strong>
      <p className="mb-0 mt-1">
        Bellwether facilities are surveyed before you in a predictable pattern.
        When they're surveyed, you typically follow within a certain number of days.
        Tracking these patterns helps you anticipate when your survey may occur.
      </p>
    </Tooltip>
  );

  const hasBellwethers = bellwetherNetwork?.bellwethers?.length > 0;
  const hasFollowers = bellwetherNetwork?.followers?.length > 0;
  const hasNetwork = hasBellwethers || hasFollowers;

  return (
    <Card className="bellwether-network-card mb-4">
      <Card.Body>
        <div className="bellwether-network-header">
          <h5 className="mb-0">
            <Network size={18} className="me-2" />
            My Bellwether Network
          </h5>
          <OverlayTrigger
            placement="top"
            overlay={networkTooltip}
            trigger={['hover', 'focus']}
          >
            <button className="network-help-btn" aria-label="What's a bellwether network?">
              <HelpCircle size={16} />
              <span>What's this?</span>
            </button>
          </OverlayTrigger>
        </div>

        {hasNetwork ? (
          <div className="bellwether-network-grid">
            <div className="network-column bellwethers-column">
              <div className="network-column-header">
                <Radio size={16} className="column-icon" />
                <span>Facilities that predict your survey</span>
              </div>
              {hasBellwethers ? (
                <div className="network-list">
                  {bellwetherNetwork.bellwethers.map((facility) => (
                    <div key={facility.ccn} className="network-facility-item">
                      <div className="facility-main">
                        <Link
                          to={`/facility-metrics/${facility.ccn}`}
                          className="network-facility-link"
                        >
                          {facility.name}
                        </Link>
                        <span className="lead-time">
                          leads by {facility.avgLeadDays} days avg
                          <span className="lead-range">
                            ({facility.rangeMin}-{facility.rangeMax} days)
                          </span>
                        </span>
                      </div>
                      <div className="facility-status">
                        {facility.signalActive ? (
                          <span className="signal-badge signal-active">
                            <span className="signal-dot"></span>
                            ACTIVE SIGNAL
                          </span>
                        ) : (
                          <span className="signal-badge signal-inactive">
                            <span className="signal-dot"></span>
                            No signal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="network-empty-text">No bellwether patterns identified yet.</p>
              )}
            </div>

            <div className="network-column followers-column">
              <div className="network-column-header">
                <Users size={16} className="column-icon" />
                <span>Facilities that follow you</span>
              </div>
              {hasFollowers ? (
                <div className="network-list">
                  {bellwetherNetwork.followers.map((facility) => (
                    <div key={facility.ccn} className="network-facility-item">
                      <div className="facility-main">
                        <Link
                          to={`/facility-metrics/${facility.ccn}`}
                          className="network-facility-link"
                        >
                          {facility.name}
                        </Link>
                        <span className="follow-time">
                          follows by {facility.avgFollowDays} days avg
                          <span className="follow-range">
                            ({facility.rangeMin}-{facility.rangeMax} days)
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="network-empty-text">No follower patterns identified yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="network-no-data">
            <Network size={32} strokeWidth={1.5} />
            <p>No bellwether patterns identified yet.</p>
            <span className="network-no-data-hint">
              Patterns are detected after multiple survey cycles.
            </span>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

/**
 * SurveyIntelligenceTab - Shows survey timing predictions and risk for a facility
 */
const SurveyIntelligenceTab = ({ facility }) => {
  const [surveyData, setSurveyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (facility) {
      setIsLoading(true);
      fetchSurveyIntelligence(facility.ccn || facility.federal_provider_number)
        .then((data) => {
          setSurveyData(data);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [facility]);

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

  // Show loading state
  if (isLoading) {
    return <SurveyIntelligenceSkeleton />;
  }

  // Handle case where data failed to load
  if (!surveyData) {
    return (
      <TabEmpty
        icon={<AlertTriangle size={48} strokeWidth={1.5} />}
        title="Unable to Load Data"
        message="Survey intelligence data could not be loaded. Please try again later."
      />
    );
  }

  const daysSinceColor = getDaysSinceColor(surveyData.daysSinceSurvey);
  const prepItemsColor = getPrepItemsColor(surveyData.prepItemsCount);
  const probability30Pct = Math.round(surveyData.probability30Days * 100);

  return (
    <div className="survey-intelligence-tab">
      {/* 1. Summary Cards Row */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Days Since Survey"
            value={surveyData.daysSinceSurvey}
            subtitle={`Last survey: ${formatDate(surveyData.lastSurveyDate)}`}
            icon={Calendar}
            variant={daysSinceColor}
          />
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <SummaryCard
            title="Risk Level"
            value={<RiskBadge level={surveyData.riskLevel} />}
            subtitle="Based on timing + local activity"
            icon={AlertTriangle}
            variant={getRiskLevelColor(surveyData.riskLevel)}
          />
        </Col>

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

      {/* 2. Bellwether Alert - conditional, only shows if active */}
      <BellwetherAlert bellwether={surveyData.bellwetherSignal} />

      {/* 3. Survey Window Timeline */}
      <SurveyWindowSection
        surveyWindow={surveyData.surveyWindow}
        lastSurveyDate={surveyData.lastSurveyDate}
      />

      {/* 4. Nearby Survey Activity */}
      <NearbySurveyActivity
        nearbyActivity={surveyData.nearbyActivity}
        facilityState={facility.state}
      />

      {/* 5. Prep Priorities */}
      <PrepPrioritiesSection prepPriorities={surveyData.prepPriorities} />

      {/* 6. Bellwether Network */}
      <BellwetherNetworkSection bellwetherNetwork={surveyData.bellwetherNetwork} />
    </div>
  );
};

export default SurveyIntelligenceTab;
