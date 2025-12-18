import React from 'react';
import { Syringe, Users, UserCheck } from 'lucide-react';

const formatPercent = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return `${parseFloat(value).toFixed(1)}%`;
};

const getVaccinationStatus = (rate) => {
  if (rate === null || rate === undefined) return 'unknown';
  if (rate >= 90) return 'excellent';
  if (rate >= 75) return 'good';
  if (rate >= 50) return 'moderate';
  return 'low';
};

const getStatusClass = (status) => {
  const classes = {
    excellent: 'status-good',
    good: 'status-good',
    moderate: 'status-warning',
    low: 'status-bad',
    unknown: 'status-neutral'
  };
  return classes[status] || 'status-neutral';
};

const VaccinationMetric = ({ label, rate, upToDateRate, icon: Icon }) => {
  const status = getVaccinationStatus(rate);

  return (
    <div className="vaccination-metric">
      <div className="vaccination-metric-header">
        <Icon size={16} className={getStatusClass(status)} />
        <span className="vaccination-metric-label">{label}</span>
      </div>
      <div className="vaccination-metric-values">
        <div className="vaccination-primary">
          <span className={`vaccination-rate ${getStatusClass(status)}`}>
            {formatPercent(rate)}
          </span>
          <span className="vaccination-rate-label">vaccinated</span>
        </div>
        {upToDateRate !== null && upToDateRate !== undefined && (
          <div className="vaccination-secondary">
            <span className="vaccination-uptodate">{formatPercent(upToDateRate)}</span>
            <span className="vaccination-rate-label">up to date</span>
          </div>
        )}
      </div>
    </div>
  );
};

const CovidVaccinationCard = ({ facility }) => {
  const covidData = facility?.covidData;

  if (!covidData) {
    return (
      <div className="metrics-card covid-vaccination-card">
        <div className="metrics-card-header">
          <Syringe size={18} className="status-neutral" />
          <h4>COVID-19 Vaccination</h4>
        </div>
        <div className="covid-no-data">
          <p>Vaccination data not available for this facility</p>
        </div>
      </div>
    );
  }

  const staffRate = parseFloat(covidData.staff_vaccination_rate);
  const residentRate = parseFloat(covidData.resident_vaccination_rate);
  const avgRate = (!isNaN(staffRate) && !isNaN(residentRate))
    ? ((staffRate + residentRate) / 2).toFixed(1)
    : null;

  return (
    <div className="metrics-card covid-vaccination-card">
      <div className="metrics-card-header">
        <Syringe size={18} className="status-neutral" />
        <h4>COVID-19 Vaccination</h4>
        {avgRate && (
          <span className={`vaccination-badge ${getStatusClass(getVaccinationStatus(parseFloat(avgRate)))}`}>
            {avgRate}% avg
          </span>
        )}
      </div>

      <div className="covid-vaccination-content">
        <VaccinationMetric
          label="Healthcare Staff"
          rate={covidData.staff_vaccination_rate}
          upToDateRate={covidData.staff_up_to_date_rate}
          icon={UserCheck}
        />

        <VaccinationMetric
          label="Residents"
          rate={covidData.resident_vaccination_rate}
          upToDateRate={covidData.resident_up_to_date_rate}
          icon={Users}
        />
      </div>

      {covidData.extract_date && (
        <div className="covid-data-date">
          Data as of {new Date(covidData.extract_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      )}
    </div>
  );
};

export default CovidVaccinationCard;
