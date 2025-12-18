import React, { useMemo } from 'react';
import { ClipboardCheck, AlertCircle, Flame, Clock } from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getDaysSince = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getUrgencyStatus = (days) => {
  if (days === null) return 'unknown';
  // CMS requires standard surveys every 9-15 months
  // 365 days = ~12 months (within normal range)
  // 455+ days = 15+ months (overdue)
  if (days > 455) return 'overdue';
  if (days > 365) return 'due-soon';
  return 'normal';
};

const SurveyItem = ({ label, date, icon: Icon, showDaysSince = false }) => {
  const daysSince = getDaysSince(date);
  const status = showDaysSince ? getUrgencyStatus(daysSince) : 'normal';

  return (
    <div className={`survey-item status-${status}`}>
      <div className="survey-item-icon">
        <Icon size={16} />
      </div>
      <div className="survey-item-content">
        <span className="survey-item-label">{label}</span>
        <span className="survey-item-date">{formatDate(date)}</span>
        {showDaysSince && daysSince !== null && (
          <span className={`survey-item-days status-${status}`}>
            {daysSince} days ago
          </span>
        )}
      </div>
    </div>
  );
};

const SurveyInfoCard = ({ facility }) => {
  // Group surveys by type and get most recent of each
  const surveysByType = useMemo(() => {
    const surveyDates = facility?.surveyDates || [];
    const grouped = {};
    surveyDates.forEach(survey => {
      const type = (survey.survey_type || 'Unknown').toLowerCase();
      if (!grouped[type] || new Date(survey.survey_date) > new Date(grouped[type].survey_date)) {
        grouped[type] = survey;
      }
    });
    return grouped;
  }, [facility?.surveyDates]);

  const surveyDates = facility?.surveyDates || [];

  const lastHealth = surveysByType['health'] || surveysByType['standard'] || null;
  const lastComplaint = surveysByType['complaint'] || null;
  const lastFireSafety = surveysByType['fire safety'] || surveysByType['life safety'] || null;

  // Calculate days since last standard health survey
  const daysSinceHealth = getDaysSince(lastHealth?.survey_date);
  const urgencyStatus = getUrgencyStatus(daysSinceHealth);

  if (surveyDates.length === 0) {
    return (
      <div className="metrics-card survey-info-card">
        <div className="metrics-card-header">
          <ClipboardCheck size={18} className="status-neutral" />
          <h4>Survey History</h4>
        </div>
        <div className="survey-no-data">
          <p>Survey date information not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-card survey-info-card">
      <div className="metrics-card-header">
        <ClipboardCheck size={18} className="status-neutral" />
        <h4>Survey History</h4>
        {daysSinceHealth !== null && (
          <span className={`survey-status-badge status-${urgencyStatus}`}>
            {urgencyStatus === 'overdue' ? 'Overdue' :
             urgencyStatus === 'due-soon' ? 'Due Soon' :
             `${daysSinceHealth}d ago`}
          </span>
        )}
      </div>

      <div className="survey-content">
        <SurveyItem
          label="Last Health Survey"
          date={lastHealth?.survey_date}
          icon={ClipboardCheck}
          showDaysSince={true}
        />

        {lastComplaint && (
          <SurveyItem
            label="Last Complaint Survey"
            date={lastComplaint.survey_date}
            icon={AlertCircle}
          />
        )}

        {lastFireSafety && (
          <SurveyItem
            label="Last Fire Safety Survey"
            date={lastFireSafety.survey_date}
            icon={Flame}
          />
        )}
      </div>

      {/* Survey Frequency Note */}
      <div className="survey-note">
        <Clock size={12} />
        <span>Standard surveys required every 9-15 months</span>
      </div>
    </div>
  );
};

export default SurveyInfoCard;
