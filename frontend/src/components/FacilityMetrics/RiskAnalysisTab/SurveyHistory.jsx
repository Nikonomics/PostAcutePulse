import React, { useState } from 'react';
import { Calendar, ClipboardList, CheckCircle, AlertCircle } from 'lucide-react';
import DeficiencyDrillDown from './DeficiencyDrillDown';

/**
 * Format a date string to a readable format
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Get survey type badge color
 */
const getSurveyTypeColor = (surveyType) => {
  if (!surveyType) return '#6b7280';
  const type = surveyType.toLowerCase();
  if (type.includes('complaint')) return '#ef4444';
  if (type.includes('annual') || type.includes('standard')) return '#3b82f6';
  if (type.includes('follow')) return '#f59e0b';
  if (type.includes('initial')) return '#22c55e';
  return '#6b7280';
};

/**
 * SurveyHistory component displays a timeline of past surveys
 */
const SurveyHistory = ({ surveyDates = [], loading = false, ccn, facilityName }) => {
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [selectedSurveyDate, setSelectedSurveyDate] = useState(null);

  const handleDeficiencyClick = (surveyDate) => {
    setSelectedSurveyDate(surveyDate);
    setDrillDownOpen(true);
  };

  // Show loading skeleton
  if (loading) {
    return (
      <div className="survey-history-card">
        <div className="survey-history-header">
          <Calendar size={20} className="survey-history-icon" />
          <h3>Survey History</h3>
        </div>
        <div className="survey-history-skeleton">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="survey-skeleton-item">
              <div className="skeleton skeleton-date" />
              <div className="skeleton skeleton-type" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state
  if (!surveyDates || surveyDates.length === 0) {
    return (
      <div className="survey-history-card">
        <div className="survey-history-header">
          <Calendar size={20} className="survey-history-icon" />
          <h3>Survey History</h3>
        </div>
        <div className="survey-history-empty">
          <ClipboardList size={40} strokeWidth={1.5} />
          <p>No survey history available for this facility.</p>
        </div>
      </div>
    );
  }

  // Group surveys by year for better organization
  const surveysByYear = surveyDates.reduce((acc, survey) => {
    const year = survey.survey_date
      ? new Date(survey.survey_date).getFullYear()
      : 'Unknown';
    if (!acc[year]) acc[year] = [];
    acc[year].push(survey);
    return acc;
  }, {});

  // Sort years descending
  const sortedYears = Object.keys(surveysByYear).sort((a, b) => b - a);

  return (
    <div className="survey-history-card">
      <div className="survey-history-header">
        <Calendar size={20} className="survey-history-icon" />
        <h3>Survey History</h3>
        <span className="survey-count">{surveyDates.length} surveys</span>
      </div>

      <div className="survey-history-content">
        {sortedYears.map((year) => (
          <div key={year} className="survey-year-group">
            <div className="survey-year-label">{year}</div>
            <div className="survey-timeline">
              {surveysByYear[year].map((survey, idx) => (
                <div key={idx} className="survey-timeline-item">
                  <div className="survey-timeline-dot" />
                  <div className="survey-timeline-content">
                    <div className="survey-date-row">
                      <span className="survey-date">{formatDate(survey.survey_date)}</span>
                      {survey.deficiency_count != null && survey.deficiency_count > 0 && (
                        <button
                          className="survey-deficiency-count clickable"
                          onClick={() => handleDeficiencyClick(survey.survey_date)}
                        >
                          <AlertCircle size={12} />
                          {survey.deficiency_count} deficiencies
                        </button>
                      )}
                      {survey.deficiency_count === 0 && (
                        <span className="survey-deficiency-none">
                          <CheckCircle size={12} />
                          No deficiencies
                        </span>
                      )}
                    </div>
                    <span
                      className="survey-type-badge"
                      style={{ backgroundColor: getSurveyTypeColor(survey.survey_type) }}
                    >
                      {survey.survey_type || 'Survey'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Deficiency Drill-Down Modal */}
      <DeficiencyDrillDown
        isOpen={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        ccn={ccn}
        facilityName={facilityName}
        surveyDate={selectedSurveyDate}
      />
    </div>
  );
};

export default SurveyHistory;
